import { memo, useMemo, useState } from 'react';
import type { MemoItem } from '../../../api';
import UICloseButton from '../../../components/ui/UICloseButton';
import {
  PanelNoDragWrap,
  PanelTitleRow,
  PanelToolbarRow,
  panelTitleRowBg,
  usePanelNoDrag,
} from '../../../components/PanelDragHeader';
import { cn } from '../../../utils/cn';
import { useThemeStore } from '../../../store';
import { getOrgTheme } from '../../../utils/orgTheme';

export type { MemoItem };

type MemoTab = 'inbox' | 'sent';

type MemoPanelProps = {
  isDark: boolean;
  inbox: MemoItem[];
  sent: MemoItem[];
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  onOpenCompose: () => void;
  onMarkRead: (memo: MemoItem) => void | Promise<void>;
  onDelete: (memo: MemoItem) => void | Promise<void>;
};

function formatRecipients(memo: MemoItem) {
  return memo.recipients.map((r) => r.user.name).join(', ');
}

function MemoDetail({
  memo,
  tab,
  isDark,
  onBack,
  onDelete,
}: {
  memo: MemoItem;
  tab: MemoTab;
  isDark: boolean;
  onBack: () => void;
  onDelete: (memo: MemoItem) => void | Promise<void>;
}) {
  const isInbox = tab === 'inbox';
  const fromLabel = isInbox ? memo.sender.name : formatRecipients(memo);
  const metaLabel = isInbox ? '보낸 사람' : '받는 사람';
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <PanelTitleRow
        isDark={isDark}
        className={useCustomAccent ? undefined : panelTitleRowBg(isDark)}
        style={useCustomAccent ? { background: orgTheme.headerBg } : undefined}
        left={(
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'border-none bg-transparent p-1 cursor-pointer rounded-md text-sm font-semibold',
              isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            ← 목록
          </button>
        )}
        right={isInbox ? (
          <button
            type="button"
            onClick={() => void onDelete(memo)}
            className={cn(
              'border-none bg-transparent px-2 py-1 cursor-pointer rounded-md text-xs font-semibold',
              isDark ? 'text-red-400 hover:bg-slate-700' : 'text-red-600 hover:bg-red-50',
            )}
          >
            삭제
          </button>
        ) : undefined}
      />

      <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
        <h4 className={cn('m-0 mb-3 text-lg font-bold break-words', isDark ? 'text-white' : 'text-slate-900')}>
          {memo.subject}
        </h4>
        <div className={cn('mb-4 space-y-1 text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
          <div><span className="font-semibold">{metaLabel}: </span>{fromLabel}</div>
          <div>{new Date(memo.createdAt).toLocaleString('ko-KR')}</div>
        </div>
        <div
          className={cn(
            'whitespace-pre-wrap break-words rounded-xl border px-4 py-3 text-sm leading-relaxed',
            isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-white text-slate-800',
          )}
        >
          {memo.body}
        </div>
        {tab === 'sent' && (
          <div className={cn('mt-4 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
            {memo.recipients.map((r) => (
              <span key={r.id} className="mr-3">
                {r.user.name}{r.readAt ? ' (읽음)' : ' (안 읽음)'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function matchesMemoSearch(memo: MemoItem, tab: MemoTab, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const people =
    tab === 'inbox'
      ? memo.sender.name
      : memo.recipients.map((r) => r.user.name).join(' ');
  return (
    memo.subject.toLowerCase().includes(q) ||
    memo.body.toLowerCase().includes(q) ||
    people.toLowerCase().includes(q)
  );
}

function MemoPanel({
  isDark,
  inbox,
  sent,
  panelWrapStyle,
  onOpenCompose,
  onMarkRead,
  onDelete,
}: MemoPanelProps) {
  const wrap = panelWrapStyle(820);
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';
  const { noDragClass, noDragStyle } = usePanelNoDrag();
  const [tab, setTab] = useState<MemoTab>('inbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const list = tab === 'inbox' ? inbox : sent;
  const filteredList = useMemo(
    () => list.filter((m) => matchesMemoSearch(m, tab, searchQuery)),
    [list, tab, searchQuery],
  );
  const selectedMemo = useMemo(
    () => list.find((m) => m.id === selectedId) ?? null,
    [list, selectedId],
  );

  const handleOpen = (memo: MemoItem) => {
    setSelectedId(memo.id);
    if (tab === 'inbox' && !memo.readAt) void onMarkRead(memo);
  };

  if (selectedMemo) {
    return (
      <div className={wrap.className} style={wrap.style}>
        <MemoDetail
          memo={selectedMemo}
          tab={tab}
          isDark={isDark}
          onBack={() => setSelectedId(null)}
          onDelete={async (memo) => {
            await onDelete(memo);
            setSelectedId(null);
          }}
        />
      </div>
    );
  }

  const emptyMessage = (() => {
    if (list.length === 0) {
      return tab === 'inbox' ? '받은 쪽지가 없습니다' : '보낸 쪽지가 없습니다';
    }
    if (filteredList.length === 0) return '검색 결과가 없습니다';
    return null;
  })();

  return (
    <div className={wrap.className} style={wrap.style}>
      <PanelTitleRow
        isDark={isDark}
        title="쪽지"
        className={useCustomAccent ? undefined : panelTitleRowBg(isDark)}
        style={useCustomAccent ? { background: orgTheme.headerBg } : undefined}
        right={(
          <button
            type="button"
            onClick={onOpenCompose}
            className={cn(
              'shrink-0 border-none rounded-lg px-3 py-1.5 text-[13px] font-semibold cursor-pointer',
              !useCustomAccent && (isDark ? 'bg-brand-dark text-white hover:bg-brand-light' : 'bg-brand-dark text-white hover:bg-brand-light'),
              useCustomAccent && 'text-white',
            )}
            style={useCustomAccent ? { background: orgTheme.accent } : undefined}
          >
            쓰기
          </button>
        )}
      />

      <PanelToolbarRow isDark={isDark} className="p-0">
        {(['inbox', 'sent'] as MemoTab[]).map((key) => (
          <PanelNoDragWrap key={key} className="flex-1 h-full">
            <button
              type="button"
              onClick={() => { setTab(key); setSelectedId(null); }}
              className={cn(
                'w-full h-full text-sm font-semibold border-none cursor-pointer',
                tab === key
                  ? (useCustomAccent
                      ? 'border-b-2'
                      : (isDark ? 'text-brand-light border-b-2 border-brand-light bg-slate-800/50' : 'text-brand-dark border-b-2 border-brand-dark bg-brand-dark/5'))
                  : (isDark ? 'text-slate-400 bg-transparent' : 'text-slate-500 bg-transparent'),
              )}
              style={tab === key && useCustomAccent ? { color: orgTheme.activeText, borderColor: orgTheme.accent, background: orgTheme.activeBg } : undefined}
            >
              {key === 'inbox' ? '받은쪽지' : '보낸쪽지'}
            </button>
          </PanelNoDragWrap>
        ))}
      </PanelToolbarRow>

      <PanelToolbarRow isDark={isDark}>
        <div className={cn(noDragClass, 'relative flex-1 min-w-0')} style={noDragStyle}>
          <span
            className={cn(
              'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2',
              isDark ? 'text-slate-400' : 'text-slate-400',
            )}
            aria-hidden
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="제목, 내용, 이름 검색"
            aria-label="쪽지 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              'w-full rounded-[6px] border py-1.5 pl-8 pr-2.5 text-[13px] outline-none',
              isDark ? 'border-slate-600 bg-slate-700 text-slate-200 placeholder:text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-900 placeholder:text-slate-400',
            )}
          />
        </div>
        {searchQuery.trim().length > 0 && (
          <PanelNoDragWrap>
            <UICloseButton
              size="sm"
              variant="subtle"
              onClick={() => setSearchQuery('')}
              aria-label="검색어 지우기"
              title="검색어 지우기"
            />
          </PanelNoDragWrap>
        )}
      </PanelToolbarRow>

      <div className="flex-1 min-h-0 overflow-auto">
        {emptyMessage ? (
          <div className={cn('p-8 text-center text-sm', isDark ? 'text-[#a7adb4]' : 'text-[#5e6470]')}>
            {emptyMessage}
          </div>
        ) : (
          <ul className="list-none m-0 p-0">
            {filteredList.map((memo) => {
              const unread = tab === 'inbox' && !memo.readAt;
              const subtitle = tab === 'inbox' ? memo.sender.name : formatRecipients(memo);
              return (
                <li key={memo.id} className={cn('border-b', isDark ? 'border-[#3a3f46]' : 'border-[#eef0f3]')}>
                  <button
                    type="button"
                    onClick={() => handleOpen(memo)}
                    className={cn(
                      'w-full px-5 py-3 border-none text-left cursor-pointer flex items-start gap-3',
                      unread
                        ? (isDark ? 'bg-[rgba(91,141,239,0.08)]' : 'bg-[rgba(var(--color-brand-dark-rgb),0.04)]')
                        : 'bg-transparent',
                    )}
                  >
                    {unread && (
                      <span
                        className={cn('mt-2 w-1.5 h-1.5 rounded-full shrink-0', !useCustomAccent && 'bg-brand')}
                        style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-sm font-semibold truncate mb-0.5', isDark ? 'text-slate-100' : 'text-slate-900')}>
                        {memo.subject}
                      </div>
                      <div className={cn('text-xs truncate mb-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {subtitle}
                      </div>
                      <div className={cn('text-[11px] truncate', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        {memo.body}
                      </div>
                      <div className={cn('text-[11px] mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        {new Date(memo.createdAt).toLocaleString('ko-KR')}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default memo(MemoPanel);
