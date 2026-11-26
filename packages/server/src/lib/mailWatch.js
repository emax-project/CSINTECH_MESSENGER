/**
 * 새 메일 팝업 알림 — 메일 서버(MailCarrier) DB의 "메일 알림 목록"(WpuMailNotifyList)을
 * 주기적으로 읽어, 메신저에 접속 중인 수신자에게 `mail` 소켓 이벤트를 보낸다.
 *
 * - MAIL_WATCH_ENABLED=true 일 때만 동작한다(기본 꺼짐). 다른 서버 배포에는 영향이 없다.
 * - WpuMailNotifyList는 받는 사람(du_id)마다 한 행이 생기는 알림 테이블이라, 여러 명에게 간 메일도 사람별로 정확히 한 번 알린다.
 * - 읽는 것은 알림 행(보낸 사람·제목)과 수신자 아이디(McDomainUser.du_userId)뿐이다. 메일 본문과 비밀번호 컬럼은 조회하지 않는다.
 * - 메일 제목은 접속 중인 수신자에게 소켓으로만 보내고, 메신저 DB·로그에는 저장하지 않는다.
 * - 오프라인 사용자는 건너뛴다(팝업은 접속 중일 때만 의미가 있다).
 */
import sql from 'mssql';
import { prisma } from '../db.js';
import { buildMailPayload, pickRowsToNotify, dbNowFunction, resolveCursor } from './mailWatchUtil.js';

const CURSOR_KEY = 'mail_watch_cursor';
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

async function loadCursor(pool) {
  const r = await pool.request().query('SELECT MAX(mn_id) AS m FROM dbo.WpuMailNotifyList');
  const max = r.recordset[0]?.m ?? 0;
  const saved = await prisma.appSetting.findUnique({ where: { key: CURSOR_KEY }, select: { value: true } });
  // 처음 켤 때는 지금까지의 알림을 보내지 않도록 현재 최대 번호에서 시작한다.
  return resolveCursor(saved?.value, max);
}

async function saveCursor(id) {
  const value = String(id);
  await prisma.appSetting.upsert({
    where: { key: CURSOR_KEY },
    create: { key: CURSOR_KEY, value },
    update: { value },
  });
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

/** 한 번 조회해서 알린다. 테스트와 시작 코드에서 쓰도록 분리했다. */
export async function pollMailOnce(io, state) {
  const pool = await getPool();
  if (state.cursor === null || state.cursor === undefined) state.cursor = await loadCursor(pool);
  const limit = intEnv('MAIL_WATCH_BATCH', 200, 1, 1000);
  const maxAgeSec = intEnv('MAIL_WATCH_MAX_AGE_SEC', 600, 30, 86400);
  const showSubject = String(process.env.MAIL_WATCH_SHOW_SUBJECT || 'true').toLowerCase() !== 'false';
  const nowFn = dbNowFunction(process.env.MAIL_WATCH_DB_TIME);

  const result = await pool
    .request()
    .input('after', sql.Int, state.cursor)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        n.mn_id, n.mm_id, n.mn_from, n.mn_subject, u.du_userId,
        DATEDIFF(SECOND, n.mn_rstime, ${nowFn}) AS age_sec
      FROM dbo.WpuMailNotifyList n
      LEFT JOIN dbo.McDomainUser u ON u.du_id = n.du_id
      WHERE n.mn_id > @after
      ORDER BY n.mn_id ASC
    `);
  const rows = result.recordset;
  if (!rows.length) return 0;

  const targets = pickRowsToNotify(rows, maxAgeSec);
  const byMailId = await resolveUserIds(new Set(targets.map((r) => String(r.du_userId).trim().toLowerCase())));
  let sent = 0;
  for (const row of targets) {
    const userIds = byMailId.get(String(row.du_userId).trim().toLowerCase());
    if (!userIds?.length) continue;
    const payload = buildMailPayload(row, showSubject);
    for (const uid of userIds) io.to(`user:${uid}`).emit('mail', payload);
    sent += 1;
  }

  // 수신자가 없거나 오래된 행도 처리한 것으로 보고 기준 번호를 넘긴다.
  const lastId = Number(rows[rows.length - 1].mn_id);
  if (lastId > state.cursor) {
    state.cursor = lastId;
    await saveCursor(lastId);
  }
  return sent;
}

export function startMailWatch(io) {
  if (!isMailWatchEnabled()) return;
  const intervalMs = intEnv('MAIL_WATCH_INTERVAL_SEC', 15, 5, 300) * 1000;
  const state = { cursor: null };
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
