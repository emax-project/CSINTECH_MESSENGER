/**
 * 새 메일 팝업 알림 — 메일 서버(MailCarrier 7) DB(MC7)에서 최근 받은 메일을 주기적으로 읽어,
 * 메신저에 접속 중인 수신자에게 `mail` 소켓 이벤트를 보낸다.
 *
 * - MAIL_WATCH_ENABLED=true 일 때만 동작한다(기본 꺼짐). 다른 서버 배포에는 영향이 없다.
 * - 받은편지함(McMailboxFolder.md_name = 'mcInbox')에 최근 들어온 메일(McMailboxMsg.mm_rsTime)만 본다.
 *   수신자는 McMailboxFolder.mb_id → McRsMailBox.mb_owner_id → McDomainUser.du_id 로 찾고,
 *   McDomainUser.du_userId 를 메신저 이메일의 @ 앞부분과 맞춘다.
 * - 읽는 컬럼은 메일 번호·보낸 사람·제목·수신자 아이디·받은 시각뿐이다. 본문(mm_summary, mm_search*)과
 *   비밀번호(du_pwd)는 조회하지 않는다.
 * - 기준 번호를 저장하지 않는다. 최근 maxAge 초 이내 메일만 보고, 이미 알린 메일은 메모리에서 기억한다.
 *   서버를 켠 직후 첫 조회는 알리지 않고 기록만 한다(재시작 때 같은 메일이 다시 뜨지 않게).
 *   그래서 서버가 꺼져 있던 동안 온 메일은 알리지 않는다(팝업은 접속 중일 때만 의미가 있다).
 * - 메일 제목은 접속 중인 수신자에게 소켓으로만 보내고, 메신저 DB·로그에는 저장하지 않는다.
 */
import sql from 'mssql';
import { prisma } from '../db.js';
import { buildMailPayload, dbNowFunction, markSeen, pickNewRows, pruneSeen } from './mailWatchUtil.js';

const MAX_RECIPIENTS_PER_TICK = 500;

export function isMailWatchEnabled() {
  return String(process.env.MAIL_WATCH_ENABLED || '').trim().toLowerCase() === 'true';
}

function intEnv(name, fallback, min, max) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

let poolPromise = null;

function buildConfig() {
  const server = process.env.MAIL_MSSQL_SERVER || process.env.PARTNER_MSSQL_SERVER || '';
  const user = process.env.MAIL_MSSQL_USER || '';
  if (!server || !user) throw new Error('MAIL_MSSQL_SERVER / MAIL_MSSQL_USER required');
  return {
    server,
    port: Number(process.env.MAIL_MSSQL_PORT || process.env.PARTNER_MSSQL_PORT || 1433),
    database: process.env.MAIL_MSSQL_DATABASE || 'MC7',
    user,
    password: process.env.MAIL_MSSQL_PASSWORD || '',
    options: {
      encrypt: String(process.env.MAIL_MSSQL_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(process.env.MAIL_MSSQL_TRUST_CERT || 'true').toLowerCase() !== 'false',
      enableArithAbort: true,
    },
    pool: { max: 2, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout: 15000,
  };
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig()).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

async function resetPool() {
  const p = poolPromise;
  poolPromise = null;
  try {
    (await p)?.close();
  } catch {
    // 이미 끊긴 연결은 무시
  }
}

/** 메일 아이디(du_userId) → 메신저 사용자 id. 메신저 사용자의 아이디는 이메일의 @ 앞부분이다. */
async function resolveUserIds(mailIds) {
  const ids = [...mailIds];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { OR: ids.map((id) => ({ email: { startsWith: `${id}@`, mode: 'insensitive' } })) },
    select: { id: true, email: true },
    take: MAX_RECIPIENTS_PER_TICK,
  });
  const byMailId = new Map();
  for (const u of users) {
    const local = u.email.slice(0, u.email.indexOf('@')).toLowerCase();
    if (!byMailId.has(local)) byMailId.set(local, []);
    byMailId.get(local).push(u.id);
  }
  return byMailId;
}

/** 한 번 조회해서 알린다. 테스트와 시작 코드에서 쓰도록 분리했다. state = { seen: Map, primed: boolean } */
export async function pollMailOnce(io, state) {
  const pool = await getPool();
  const limit = intEnv('MAIL_WATCH_BATCH', 500, 1, 2000);
  const maxAgeSec = intEnv('MAIL_WATCH_MAX_AGE_SEC', 600, 30, 86400);
  const showSubject = String(process.env.MAIL_WATCH_SHOW_SUBJECT || 'true').toLowerCase() !== 'false';
  const nowFn = dbNowFunction(process.env.MAIL_WATCH_DB_TIME);

  // 받은편지함의 최근 메일만. 메일마다(= 받는 사람 사서함마다) 한 행이라 여러 명에게 간 메일도 사람별로 정확히 한 번 알린다.
  const result = await pool
    .request()
    .input('win', sql.Int, maxAgeSec)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        g.mm_id, g.mm_fromName, g.mm_fromAddr, g.mm_subject, u.du_userId,
        DATEDIFF(SECOND, g.mm_rsTime, ${nowFn}) AS age_sec
      FROM dbo.McMailboxMsg g
      JOIN dbo.McMailboxFolder f ON f.md_id = g.md_id AND f.md_name = 'mcInbox'
      JOIN dbo.McRsMailBox m ON m.mb_id = f.mb_id
      JOIN dbo.McDomainUser u ON u.du_id = m.mb_owner_id
      WHERE g.mm_rsTime >= DATEADD(SECOND, -@win, ${nowFn})
      ORDER BY g.mm_rsTime DESC
    `);
  const rows = result.recordset;
  const nowMs = Date.now();

  // 켠 직후 첫 조회: 이미 있던 메일은 알리지 않고 기록만 한다.
  if (!state.primed) {
    markSeen(state.seen, rows, nowMs);
    state.primed = true;
    return 0;
  }

  const targets = pickNewRows(rows, state.seen, maxAgeSec);
  let sent = 0;
  if (targets.length) {
    const byMailId = await resolveUserIds(new Set(targets.map((r) => String(r.du_userId).trim().toLowerCase())));
    for (const row of targets) {
      const userIds = byMailId.get(String(row.du_userId).trim().toLowerCase());
      if (!userIds?.length) continue;
      const payload = buildMailPayload(row, showSubject);
      for (const uid of userIds) io.to(`user:${uid}`).emit('mail', payload);
      sent += 1;
    }
  }

  // 수신자가 없거나 오래된 행도 본 것으로 기록하고, 조회 구간을 벗어난 기록은 지운다.
  markSeen(state.seen, rows, nowMs);
  pruneSeen(state.seen, nowMs, maxAgeSec * 2 * 1000);
  return sent;
}

export function startMailWatch(io) {
  if (!isMailWatchEnabled()) return;
  const intervalMs = intEnv('MAIL_WATCH_INTERVAL_SEC', 15, 5, 300) * 1000;
  const state = { seen: new Map(), primed: false };
  let running = false;
  let lastErrorAt = 0;

  async function tick() {
    if (running) return;
    running = true;
    try {
      await pollMailOnce(io, state);
    } catch (e) {
      // 같은 오류가 15초마다 쌓이지 않도록 5분에 한 번만 남기고, 연결은 다시 만든다.
      if (Date.now() - lastErrorAt > 5 * 60 * 1000) {
        lastErrorAt = Date.now();
        console.error('[mail-watch]', e?.message || e);
      }
      await resetPool();
    } finally {
      running = false;
    }
  }

  console.log(`[startup] mail watch: enabled (every ${intervalMs / 1000}s)`);
  void tick();
  setInterval(tick, intervalMs).unref();
}
