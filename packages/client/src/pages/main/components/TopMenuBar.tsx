import { memo } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

type ActivePanel = 'none' | 'mention' | 'bookmark' | 'rooms' | 'schedule' | 'settings';

type TopMenuBarProps = {
  isDark: boolean;
  activePanel: ActivePanel;
  setActivePanel: Dispatch<SetStateAction<ActivePanel>>;
  unreadMentionCount: number;
  totalUnreadCount: number;
  notificationsSnoozedUntil: number;
  onOpenSidebar?: () => void;
};

function TopMenuBar({
  isDark,
  activePanel,
  setActivePanel,
  unreadMentionCount,
  totalUnreadCount,
  notificationsSnoozedUntil,
  onOpenSidebar,
}: TopMenuBarProps) {
  const togglePanel = (panel: Exclude<ActivePanel, 'none'>) => {
    setActivePanel((prev) => (prev === panel ? 'none' : panel));
  };

  const btnStyle = (active: boolean): CSSProperties => ({
    width: 34,
    height: 34,
    padding: 0,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? (isDark ? '#334155' : '#f1f5f9') : 'transparent',
    color: active ? (isDark ? 'var(--color-brand-light)' : 'var(--color-brand-dark)') : (isDark ? '#94a3b8' : '#64748b'),
  });

  return (
    <div className={cn(
      'sticky top-0 z-20 shrink-0 min-h-[46px] flex items-center justify-between px-3 border-b gap-2',
      isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200',
    )}>
      <div className="flex items-center gap-1 min-w-0">
        {onOpenSidebar && (
          <button
            type="button"
            style={btnStyle(false)}
            onClick={onOpenSidebar}
            title="연락처"
            aria-label="연락처 열기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 justify-end">
        <button
          type="button"
          style={btnStyle(activePanel === 'mention')}
          onClick={() => togglePanel('mention')}
          title="멘션"
          className="relative"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
          </svg>
          {unreadMentionCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
              {unreadMentionCount > 9 ? '9+' : unreadMentionCount}
            </span>
          )}
        </button>

        <button type="button" style={btnStyle(activePanel === 'bookmark')} onClick={() => togglePanel('bookmark')} title="북마크">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>

        <button type="button" style={btnStyle(activePanel === 'rooms')} onClick={() => togglePanel('rooms')} title="대화" className="relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {totalUnreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </span>
          )}
        </button>

        <button type="button" style={btnStyle(activePanel === 'schedule')} onClick={() => togglePanel('schedule')} title="일정">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>

        <button type="button" style={btnStyle(activePanel === 'settings')} onClick={() => togglePanel('settings')} title="설정" className="relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.7.1 1.41.1 2.11 0H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
          </svg>
          {notificationsSnoozedUntil > Date.now() && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
        </button>
      </div>
    </div>
  );
}

export default memo(TopMenuBar);
