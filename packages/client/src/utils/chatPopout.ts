/** Electron에서는 대화를 기본으로 독립 창으로 연다. */
export function shouldOpenChatInNewWindow(): boolean {
  if (typeof window === 'undefined' || !window.electronAPI?.openChatWindow) return false;
  try {
    return localStorage.getItem('emax_chat_popout') !== '0';
  } catch {
    return true;
  }
}

export function openChatRoomWindow(roomId: string): boolean {
  if (!shouldOpenChatInNewWindow()) return false;
  void window.electronAPI!.openChatWindow!(roomId);
  return true;
}
