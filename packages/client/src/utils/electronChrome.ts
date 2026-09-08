/** Electron frameless 창 드래그/트래픽 라이트 유틸 */
import type { CSSProperties } from 'react';

export const MAC_TRAFFIC_LIGHTS_WIDTH = 78;
/** macOS hiddenInset — 트래픽 라이트 아래 콘텐츠 시작 높이 */
export const MAC_TOP_INSET = 40;
export const MAC_TRAFFIC_LIGHTS_ZONE_HEIGHT = 40;
/** macOS: 트래픽 라이트(최대 ~78px)가 사이드바 안에 들어가도록 */
export const MAC_SIDEBAR_WIDTH = MAC_TRAFFIC_LIGHTS_WIDTH;

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|Macintosh/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent);
}

export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.electronAPI) return true;
  return typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
}

export function isMacElectron(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.electronAPI?.platform === 'darwin') return true;
  return isElectron() && isMacPlatform();
}

export function isWinElectron(): boolean {
  return isElectron() && window.electronAPI!.platform === 'win32';
}

export const electronDragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;
export const electronNoDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties;

export function applyWindowPinClass(pinned: boolean) {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('electron-pinned', pinned);
}
