import { memo } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { EmaxLogo } from '../../../components/EmaxLogo';
import { electronNoDragClass } from '../../../components/MacElectronDragBar';
import {
  electronDragStyle,
  electronNoDragStyle,
  isMacElectron,
} from '../../../utils/electronChrome';
import { cn } from '../../../utils/cn';

type ActivePanel = 'none' | 'notifications' | 'memo' | 'rooms' | 'schedule' | 'settings';

const GROUPWARE_URL = 'https://gwdemo.emaxit.co.kr:49598/login/loginPage';

function openGroupware() {
  const openExternal = window.electronAPI?.openExternal;
  if (openExternal) {
    void openExternal(GROUPWARE_URL);
    return;
  }
  window.open(GROUPWARE_URL, '_blank', 'noopener,noreferrer');
}

type LeftSidebarProps = {
  isDark: boolean;
  activePanel: ActivePanel;
  setActivePanel: Dispatch<SetStateAction<ActivePanel>>;
  unreadNotificationCount: number;
  unreadMemoCount: number;
  totalUnreadCount: number;
  notificationsSnoozedUntil: number;
  onNavigateHome: () => void;
};

function LeftSidebar({
  isDark,
  activePanel,
  setActivePanel,
  unreadNotificationCount,
  unreadMemoCount,
  totalUnreadCount,
  notificationsSnoozedUntil,
  onNavigateHome,
}: LeftSidebarProps) {
  const macDrag = isMacElectron();

  const togglePanel = (panel: Exclude<ActivePanel, 'none'>) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  };

  const btnStyle = (active: boolean): CSSProperties => ({
    width: 40,
    height: 40,
    padding: 0,
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? (isDark ? '#334155' : '#f1f5f9') : 'transparent',
    color: active ? (isDark ? 'var(--color-brand-light)' : 'var(--color-brand-dark)') : (isDark ? '#94a3b8' : '#64748b'),
  });

  return (
    <aside
      className={cn(
        'relative shrink-0 flex flex-col items-center py-2 gap-1 border-r',
        macDrag ? 'w-[78px]' : 'w-[56px]',
        macDrag && 'pt-1',
        macDrag && 'electron-drag',
        isDark ? 'bg-slate-800 border-r-slate-600' : 'bg-white border-r-slate-200',
      )}
      style={macDrag ? electronDragStyle : undefined}
      aria-label="메인 메뉴"
    >
      <button
        type="button"
        onClick={onNavigateHome}
        className={cn(
          electronNoDragClass,
          'flex items-center justify-center w-10 h-10 border-none bg-transparent p-0 m-0 cursor-pointer rounded-[10px]',
          activePanel === 'none' && (isDark ? 'bg-slate-700 ring-1 ring-brand/40' : 'bg-slate-100 ring-1 ring-brand/30'),
        )}
        style={macDrag ? electronNoDragStyle : undefined}
        title="연락처"
      >
        <EmaxLogo variant={isDark ? 'light' : 'accent'} size="md" />
      </button>

      <div className={cn('w-8 h-px my-1', isDark ? 'bg-slate-600' : 'bg-slate-200')} />

      <nav className="flex flex-col items-center gap-1">
        <button type="button" style={{ ...btnStyle(activePanel === 'rooms'), ...(macDrag ? electronNoDragStyle : {}) }} onClick={() => togglePanel('rooms')} title="대화" className={cn(electronNoDragClass, 'relative')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {totalUnreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </span>
          )}
        </button>

        <button type="button" style={{ ...btnStyle(activePanel === 'schedule'), ...(macDrag ? electronNoDragStyle : {}) }} onClick={() => togglePanel('schedule')} title="일정" className={electronNoDragClass}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>

        <button type="button" style={{ ...btnStyle(activePanel === 'memo'), ...(macDrag ? electronNoDragStyle : {}) }} onClick={() => togglePanel('memo')} title="쪽지" className={cn(electronNoDragClass, 'relative')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          {unreadMemoCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
              {unreadMemoCount > 9 ? '9+' : unreadMemoCount}
            </span>
          )}
        </button>

        <button
          type="button"
          style={{ ...btnStyle(activePanel === 'notifications'), ...(macDrag ? electronNoDragStyle : {}) }}
          onClick={() => togglePanel('notifications')}
          title="알림"
          className={cn(electronNoDragClass, 'relative')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unreadNotificationCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
              {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
            </span>
          )}
        </button>

        <button
          type="button"
          style={{ ...btnStyle(false), ...(macDrag ? electronNoDragStyle : {}) }}
          onClick={openGroupware}
          title="그룹웨어"
          className={electronNoDragClass}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>

        <button type="button" style={{ ...btnStyle(activePanel === 'settings'), ...(macDrag ? electronNoDragStyle : {}) }} onClick={() => togglePanel('settings')} title="설정" className={cn(electronNoDragClass, 'relative')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.7.1 1.41.1 2.11 0H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
          </svg>
          {notificationsSnoozedUntil > Date.now() && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
        </button>
      </nav>
    </aside>
  );
}

export default memo(LeftSidebar);
