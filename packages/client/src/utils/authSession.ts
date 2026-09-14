/** 당일 로그인만 유지. PC를 끄고 다음 날 켜면 다시 로그인한다. */
export const LOGIN_DATE_KEY = 'emax_login_date';

export function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isSessionFromToday(): boolean {
  try {
    return localStorage.getItem(LOGIN_DATE_KEY) === todayLocalDate();
  } catch {
    return false;
  }
}

export function markSessionToday(): void {
  try {
    localStorage.setItem(LOGIN_DATE_KEY, todayLocalDate());
  } catch {
    /* ignore */
  }
}

export function clearSessionDate(): void {
  try {
    localStorage.removeItem(LOGIN_DATE_KEY);
  } catch {
    /* ignore */
  }
}

/** 저장된 토큰이 오늘 로그인한 세션일 때만 반환 */
export function getActiveToken(): string | null {
  try {
    if (!isSessionFromToday()) return null;
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}
