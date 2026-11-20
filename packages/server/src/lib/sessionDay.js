/**
 * 로그인 유지 기준 — 발급일(한국 시간) 당일 자정까지만 유효하다.
 * 클라이언트는 PC 날짜만 보고 판단하므로, 서버도 자정이 지난 토큰을 거부한다.
 */
const KST_OFFSET_SEC = 9 * 60 * 60;
const DAY_SEC = 24 * 60 * 60;

/** 한국 시간 기준 오늘 00:00의 epoch(초). */
export function startOfTodayKst(nowMs = Date.now()) {
  const kstSec = Math.floor(nowMs / 1000) + KST_OFFSET_SEC;
  return kstSec - (kstSec % DAY_SEC) - KST_OFFSET_SEC;
}

/** SESSION_EXPIRE_AT_MIDNIGHT=true 일 때만 적용(기본 꺼짐 — 모바일 앱 등 장기 로그인에 영향). */
export function isMidnightExpiryEnabled() {
  return String(process.env.SESSION_EXPIRE_AT_MIDNIGHT || '').trim().toLowerCase() === 'true';
}

/** 토큰 발급 시각(iat, 초)이 오늘(KST) 자정 이후인가 */
export function isIssuedToday(iat, nowMs = Date.now()) {
  if (!Number.isFinite(iat)) return false;
  return iat >= startOfTodayKst(nowMs);
}
