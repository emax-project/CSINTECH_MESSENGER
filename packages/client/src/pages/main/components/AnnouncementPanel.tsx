import { memo, useEffect } from 'react';
import type { AnnouncementItem } from '../../../api';
import { cn } from '../../../utils/cn';
import { PanelTitleRow, panelTitleRowBg } from '../../../components/PanelDragHeader';
import { useThemeStore } from '../../../store';
import { getOrgTheme } from '../../../utils/orgTheme';

const SEEN_KEY = 'emax_announcement_seen_at';

export function getLatestAnnouncementUpdatedAt(items: AnnouncementItem[]): string | null {
  if (items.length === 0) return null;
  return items.reduce(
    (max, item) => (!max || item.updatedAt > max ? item.updatedAt : max),
    items[0].updatedAt,
  );
}

export function markAnnouncementSeen(updatedAt?: string | null) {
  if (!updatedAt) return;
  try {
    localStorage.setItem(SEEN_KEY, updatedAt);
  } catch {
    // ignore
  }
}

export function markAnnouncementsSeen(items: AnnouncementItem[]) {
  markAnnouncementSeen(getLatestAnnouncementUpdatedAt(items));
}

export function hasUnreadAnnouncement(updatedAt?: string | null): boolean {
  if (!updatedAt) return false;
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return true;
    return new Date(updatedAt).getTime() > new Date(seen).getTime();
  } catch {
    return false;
  }
}

export function hasUnreadAnnouncements(items: AnnouncementItem[]): boolean {
  if (items.length === 0) return false;
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return true;
    const seenTime = new Date(seen).getTime();
    return items.some((item) => new Date(item.updatedAt).getTime() > seenTime);
  } catch {
    return false;
  }
}

export function getNewestUnreadAnnouncement(items: AnnouncementItem[]): AnnouncementItem | null {
  if (!hasUnreadAnnouncements(items)) return null;
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return items[0] ?? null;
    const seenTime = new Date(seen).getTime();
    return items.find((item) => new Date(item.updatedAt).getTime() > seenTime) ?? null;
  } catch {
    return items[0] ?? null;
  }
}

type AnnouncementPanelProps = {
  isDark: boolean;
  items: AnnouncementItem[];
  isAdmin?: boolean;
  announcementEdit: string;
  announcementTitle: string;
  editingId: string | null;
  announcementSaving: boolean;
  onAnnouncementEditChange: (value: string) => void;
  onAnnouncementTitleChange: (value: string) => void;
  onStartCreate: () => void;
  onStartEdit: (item: AnnouncementItem) => void;
  onCancelEdit: () => void;
  onSaveAnnouncement: () => void | Promise<void>;
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  embedded?: boolean;
  markSeen?: boolean;
};

function AnnouncementPanel({
  isDark,
  items,
  isAdmin,
  announcementEdit,
  announcementTitle,
  editingId,
  announcementSaving,
  onAnnouncementEditChange,
  onAnnouncementTitleChange,
  onStartCreate,
  onStartEdit,
  onCancelEdit,
  onSaveAnnouncement,
  panelWrapStyle,
  embedded = false,
  markSeen = true,
}: AnnouncementPanelProps) {
  const wrap = panelWrapStyle(820);
  const isFormOpen = editingId !== null;
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';

  useEffect(() => {
    if (markSeen && items.length > 0) markAnnouncementsSeen(items);
  }, [items, markSeen]);

  const adminActions = isAdmin && (
    <div className="flex shrink-0 flex-wrap gap-2">
      {!isFormOpen ? (
        <button
          type="button"
          onClick={onStartCreate}
          className={cn(
            'border-none rounded-lg px-3 py-1.5 text-[13px] font-semibold cursor-pointer text-white',
            !useCustomAccent && (isDark ? 'bg-brand-dark hover:bg-brand-light' : 'bg-brand-dark hover:bg-brand-light'),
          )}
          style={useCustomAccent ? { background: orgTheme.accent } : undefined}
        >
          새 공지
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onCancelEdit}
            className={cn(
              'border-none rounded-lg px-3 py-1.5 text-[13px] font-semibold cursor-pointer',
              isDark ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            목록
          </button>
          <button
            type="button"
            disabled={announcementSaving}
            onClick={() => void onSaveAnnouncement()}
            className={cn(
              'border-none rounded-lg px-3 py-1.5 text-[13px] font-semibold cursor-pointer text-white',
              announcementSaving ? 'opacity-70 cursor-wait' : '',
              !useCustomAccent && 'bg-brand-dark hover:bg-brand-light',
            )}
            style={useCustomAccent ? { background: orgTheme.accent } : undefined}
          >
            {announcementSaving ? '저장 중...' : '저장'}
          </button>
        </>
      )}
    </div>
  );

  const form = (
    <div className="flex flex-col gap-3">
      <div>
        <div className={cn('mb-1.5 text-xs font-semibold', isDark ? 'text-slate-400' : 'text-slate-500')}>제목</div>
        <input
          value={announcementTitle}
          onChange={(e) => onAnnouncementTitleChange(e.target.value)}
          placeholder="공지 제목 (선택)"
          className={cn(
            'w-full rounded-xl border px-3 py-2 text-sm outline-none font-inherit',
            isDark
              ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500'
              : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400',
          )}
        />
      </div>
      <textarea
        value={announcementEdit}
        onChange={(e) => onAnnouncementEditChange(e.target.value)}
        placeholder="전체 공지 내용을 입력하세요."
        rows={12}
        className={cn(
          'w-full rounded-xl border px-4 py-3 text-sm leading-relaxed resize-y min-h-[220px] outline-none font-inherit',
          isDark
            ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500'
            : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400',
        )}
      />
    </div>
  );

  const list = (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <div className={cn('py-12 text-center text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
          등록된 전체 공지가 없습니다.
        </div>
      ) : (
        items.map((item) => (
          <article
            key={item.id}
            className={cn(
              'rounded-2xl border px-5 py-4',
              isDark ? 'border-slate-700 bg-slate-900/80' : 'border-slate-200 bg-white shadow-sm',
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className={cn('m-0 text-sm font-bold', isDark ? 'text-slate-100' : 'text-slate-900')}>
                  {item.title?.trim() || '전체 공지'}
                </h4>
                <div className={cn('mt-1 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  {new Date(item.updatedAt).toLocaleString('ko-KR')}
                </div>
              </div>
              {isAdmin && !isFormOpen && (
                <button
                  type="button"
                  onClick={() => onStartEdit(item)}
                  className={cn(
                    'shrink-0 border-none bg-transparent cursor-pointer text-xs font-semibold underline',
                    !useCustomAccent && (isDark ? 'text-brand-light' : 'text-brand-dark'),
                  )}
                  style={useCustomAccent ? { color: orgTheme.accent } : undefined}
                >
                  수정
                </button>
              )}
            </div>
            <div
              className={cn(
                'whitespace-pre-wrap break-words text-sm leading-relaxed',
                isDark ? 'text-slate-200' : 'text-slate-800',
              )}
            >
              {item.content}
            </div>
          </article>
        ))
      )}
    </div>
  );

  const body = isFormOpen && isAdmin ? form : list;

  if (embedded) {
    return (
      <div className="flex flex-1 min-h-0 flex-col overflow-auto p-5">
        {isAdmin && <div className="mb-3 flex justify-end">{adminActions}</div>}
        {body}
      </div>
    );
  }

  return (
    <div className={wrap.className} style={wrap.style}>
      <PanelTitleRow isDark={isDark} title="전체 공지" className={panelTitleRowBg(isDark)} right={adminActions || undefined} />
      <div className="flex-1 min-h-0 overflow-auto p-5">{body}</div>
    </div>
  );
}

export default memo(AnnouncementPanel);
