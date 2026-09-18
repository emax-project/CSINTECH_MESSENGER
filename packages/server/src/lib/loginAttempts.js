/**
 * 로컬 계정(비 LDAP) 로그인 무차별 대입 방어.
 * LDAP 경로는 디렉터리 서버가 자체적으로 계정 잠금을 처리하지만(ldap.js의
 * ACCOUNT_LOCKED 매핑), bcrypt로 직접 비교하는 로컬 계정 경로엔 시도 횟수
 * 제한이 없었다. 프로세스 메모리에 사용자 id 기준으로만 카운트를 두므로
 * (존재하지 않는 이메일은 auth.js에서 이 모듈에 도달하기 전에 걸러진다)
 * 임의 문자열로 맵을 부풀리는 방식의 DoS는 발생하지 않는다.
 */

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15분

// userId -> { count: number, lockedUntil: number }
const attempts = new Map();

function now() {
  return Date.now();
}

/** 현재 잠겨 있으면 true. 잠금 시간이 지났으면 기록을 지우고 false. */
export function isLocked(userId) {
  const key = String(userId);
  const entry = attempts.get(key);
  if (!entry?.lockedUntil) return false;
  if (entry.lockedUntil > now()) return true;
  attempts.delete(key);
  return false;
}

/** 로그인 실패 기록. 임계치에 도달하면 잠그고 카운트를 초기화한다. */
export function recordFailure(userId) {
  const key = String(userId);
  const entry = attempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now() + LOCK_DURATION_MS;
    entry.count = 0;
  }
  attempts.set(key, entry);
}

/** 로그인 성공 시 실패 기록 초기화. */
export function recordSuccess(userId) {
  attempts.delete(String(userId));
}
