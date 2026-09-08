export const GROUPWARE_URL =
  (import.meta.env.VITE_GROUPWARE_URL || '').trim()
  || 'https://gwdemo.emaxit.co.kr:49598/login/loginPage';

export function openGroupware(path?: string) {
  const base = GROUPWARE_URL.replace(/\/$/, '');
  const url = path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : GROUPWARE_URL;
  const openExternal = window.electronAPI?.openExternal;
  if (openExternal) {
    void openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
