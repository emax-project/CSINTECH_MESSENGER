/**
 * 그룹웨어 기존 SSO(티켓) 연동.
 * 메신저 서버가 공유 시크릿(INTEGRATION_SHARED_SECRET)으로 그룹웨어 POST /api/sso/ticket 을 호출해
 * 30초짜리 1회용 티켓을 받고, 클라이언트는 그룹웨어 /sso?ticket=... 로 연다.
 * 메신저 사용자 ↔ 그룹웨어 사용자는 사번(User.externalEmpId = comm_user.employee_id)으로 잇는다.
 */

const DEFAULT_API_URL = 'http://host.docker.internal:3101';
const PLACEHOLDER_SECRETS = new Set(['', 'CHANGE_ME_openssl_rand_hex_32']);

/** 설정이 없거나 예시 값이면 null(연동 꺼짐). */
export function groupwareTicketConfig(env = process.env) {
  const secret = (env.INTEGRATION_SHARED_SECRET || '').trim();
  if (PLACEHOLDER_SECRETS.has(secret)) return null;
  const apiUrl = (env.GROUPWARE_API_URL || DEFAULT_API_URL).trim().replace(/\/+$/, '');
  return { secret, apiUrl };
}

/** 로그인 후 이동할 그룹웨어 내부 경로만 허용한다(절대 주소·프로토콜 상대 주소 거부). */
export function safeRedirectPath(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > 1024) return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return null;
  return v;
}

/** 그룹웨어 티켓 발급 요청. 실패하면 Error(code)를 던진다. */
export async function requestGroupwareTicket(commUserId, redirect, { config, fetchImpl = fetch } = {}) {
  if (!config) throw new Error('GROUPWARE_SSO_NOT_CONFIGURED');
  const res = await fetchImpl(`${config.apiUrl}/api/sso/ticket`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-secret': config.secret },
    body: JSON.stringify({ commUserId, redirect: safeRedirectPath(redirect) }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`GROUPWARE_TICKET_HTTP_${res.status}`);
  const data = await res.json().catch(() => ({}));
  if (typeof data?.ticket !== 'string' || !data.ticket) throw new Error('GROUPWARE_TICKET_EMPTY');
  return { ticket: data.ticket, expiresInMs: Number(data.expiresInMs) || 30_000 };
}

/** 법인·부서 이름 비교용 정규화: (주)/㈜/주식회사와 공백을 떼고 소문자로 만든다. */
export function normalizeCorporationName(name) {
  return String(name || '')
    .replace(/\(주\)|㈜|주식회사/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * 같은 사번의 계정이 법인마다 있을 수 있어 사용자의 소속 법인과 이름이 맞는 계정을 고른다.
 * rows: [{ comm_user_id, corporation_name }] (comm_user_id 오름차순). 이름이 맞는 계정이 없으면 가장 작은 id.
 */
export function pickCommUser(rows, corporationName) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const want = normalizeCorporationName(corporationName);
  const hit = want ? rows.find((r) => normalizeCorporationName(r.corporation_name) === want) : null;
  const picked = hit || rows[0];
  return picked?.comm_user_id == null ? null : String(picked.comm_user_id);
}

/** 사번(+소속 법인 이름)으로 그룹웨어 comm_user_id 조회. 없으면 null. */
export async function findCommUserId(pool, employeeId, corporationName) {
  const emp = String(employeeId || '').trim();
  if (!emp) return null;
  const r = await pool
    .request()
    .input('emp', emp)
    .query(`SELECT u.comm_user_id, c.corporation_name
              FROM dbo.comm_user u
              LEFT JOIN dbo.comm_corporation c ON c.comm_corporation_id = u.comm_corporation_id
             WHERE u.use_yn = '1' AND CAST(u.employee_id AS VARCHAR(100)) = @emp
             ORDER BY u.comm_user_id`);
  return pickCommUser(r.recordset, corporationName);
}
