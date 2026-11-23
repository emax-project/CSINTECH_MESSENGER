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

/** 사번으로 그룹웨어 comm_user_id 조회. 중복이면 가장 작은 id(결정적). 없으면 null. */
export async function findCommUserId(pool, employeeId) {
  const emp = String(employeeId || '').trim();
  if (!emp) return null;
  const r = await pool
    .request()
    .input('emp', emp)
    .query("SELECT TOP 1 comm_user_id FROM dbo.comm_user WHERE use_yn = '1' AND CAST(employee_id AS VARCHAR(100)) = @emp ORDER BY comm_user_id");
  const id = r.recordset?.[0]?.comm_user_id;
  return id == null ? null : String(id);
}
