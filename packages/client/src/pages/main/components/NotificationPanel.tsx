import { memo, useState } from 'react';
import type { AnnouncementItem } from '../../../api';
import { cn } from '../../../utils/cn';
import { PanelTitleRow, PanelToolbarRow, panelTitleRowBg } from '../../../components/PanelDragHeader';
import MentionPanel, { type MentionItem } from './MentionPanel';
import AnnouncementPanel, { hasUnreadAnnouncements } from './AnnouncementPanel';
import { useThemeStore } from '../../../store';
import { getOrgTheme } from '../../../utils/orgTheme';

type NotificationTab = 'mention' | 'announcement';

type NotificationPanelProps = {
  isDark: boolean;
  mentions: MentionItem[];
  unreadMentionCount: number;
  items: AnnouncementItem[];
  isAdmin?: boolean;
  announcementEdit: string;
  announcementTitle: string;
  editingAnnouncementId: string | null;
  announcementSaving: boolean;
  onAnnouncementEditChange: (value: string) => void;
  onAnnouncementTitleChange: (value: string) => void;
  onStartCreateAnnouncement: () => void;
  onStartEditAnnouncement: (item: AnnouncementItem) => void;
  onCancelEditAnnouncement: () => void;
  onSaveAnnouncement: () => void | Promise<void>;
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  onSelectMention: (mention: MentionItem) => void | Promise<void>;
};

function NotificationPanel({
  isDark,
  mentions,
  unreadMentionCount,
  items,
  isAdmin,
  announcementEdit,
  announcementTitle,
  editingAnnouncementId,
  announcementSaving,
  onAnnouncementEditChange,
  onAnnouncementTitleChange,
  onStartCreateAnnouncement,
  onStartEditAnnouncement,
  onCancelEditAnnouncement,
  onSaveAnnouncement,
  panelWrapStyle,
  onSelectMention,
}: NotificationPanelProps) {
  const hasUnreadAnnouncementFlag = hasUnreadAnnouncements(items);
  const [tab, setTab] = useState<NotificationTab>(() => {
    if (unreadMentionCount > 0) return 'mention';
    if (hasUnreadAnnouncementFlag) return 'announcement';
    return 'mention';
  });

  const wrap = panelWrapStyle(760);
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';
  const tabClass = (active: boolean) =>
    cn(
      'relative rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
      active
        ? (useCustomAccent ? 'border-transparent text-white' : 'border-brand-dark bg-brand-dark text-white')
        : (useCustomAccent
            ? 'border-transparent bg-transparent'
            : isDark
              ? 'border-brand-dark/40 bg-transparent text-brand-light hover:bg-brand-dark/15'
              : 'border-brand-dark/40 bg-white text-brand-dark hover:bg-brand-dark/10'),
    );
  const tabStyle = (active: boolean): React.CSSProperties | undefined => {
    if (!useCustomAccent) return undefined;
    return active
      ? { background: orgTheme.accent }
      : { color: orgTheme.accent, background: orgTheme.activeBg };
  };

  return (
    <div className={wrap.className} style={wrap.style}>
      <PanelTitleRow
        isDark={isDark}
        title="알림"
        className={useCustomAccent ? undefined : panelTitleRowBg(isDark)}
        style={useCustomAccent ? { background: orgTheme.headerBg } : undefined}
      />

      <PanelToolbarRow isDark={isDark}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tabClass(tab === 'mention')} style={tabStyle(tab === 'mention')} onClick={() => setTab('mention')}>
            멘션
            {unreadMentionCount > 0 && (
              <span
                className={cn(
                  'ml-1 text-[11px] font-bold tabular-nums',
                  tab === 'mention'
                    ? 'text-white'
                    : (!useCustomAccent && (isDark ? 'text-brand-light' : 'text-brand-dark')),
                )}
                style={tab !== 'mention' && useCustomAccent ? { color: orgTheme.accent } : undefined}
              >
                {unreadMentionCount > 9 ? '9+' : unreadMentionCount}
              </span>
            )}
          </button>
          <button type="button" className={tabClass(tab === 'announcement')} style={tabStyle(tab === 'announcement')} onClick={() => setTab('announcement')}>
            공지
            {hasUnreadAnnouncementFlag && tab !== 'announcement' && (
              <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
            )}
          </button>
        </div>
      </PanelToolbarRow>

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === 'mention' ? (
          <MentionPanel
            embedded
            isDark={isDark}
            mentions={mentions}
            panelWrapStyle={panelWrapStyle}
            onSelectMention={onSelectMention}
          />
        ) : (
          <AnnouncementPanel
            embedded
            markSeen={tab === 'announcement'}
            isDark={isDark}
            items={items}
            isAdmin={isAdmin}
            announcementEdit={announcementEdit}
            announcementTitle={announcementTitle}
            editingId={editingAnnouncementId}
            announcementSaving={announcementSaving}
            onAnnouncementEditChange={onAnnouncementEditChange}
            onAnnouncementTitleChange={onAnnouncementTitleChange}
            onStartCreate={onStartCreateAnnouncement}
            onStartEdit={onStartEditAnnouncement}
            onCancelEdit={onCancelEditAnnouncement}
            onSaveAnnouncement={onSaveAnnouncement}
            panelWrapStyle={panelWrapStyle}
          />
        )}
      </div>
    </div>
  );
}

export default memo(NotificationPanel);
