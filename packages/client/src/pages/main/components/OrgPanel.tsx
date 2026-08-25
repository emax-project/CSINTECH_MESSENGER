import { memo, useMemo, useState } from 'react';
import type { OrgCompany, OrgDepartment, OrgGroup } from '../../../api';
import type { OnlinePresenceMap } from '../../../utils/presence';
import UICloseButton from '../../../components/ui/UICloseButton';
import OrgTree, { type OrgUserContextMenuHandler } from './OrgTree';
import { PanelDragHeader, PanelNoDragWrap } from '../../../components/PanelDragHeader';
import { cn } from '../../../utils/cn';
import { flattenDepartments } from '../../../utils/orgTree';

type OrgTab = 'people' | 'groups';

type OrgPanelProps = {
  isDark: boolean;
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  showOnlineOnly: boolean;
  onToggleOnlineOnly: () => void;
  orgLoading: boolean;
  orgError: boolean;
  orgTree: OrgCompany[];
  orgGroups: OrgGroup[];
  companyMemberCounts?: Record<string, number>;
  treeOpen: Record<string, boolean>;
  orgStarred: Set<string>;
  onToggleOrgStar: (id: string) => void;
  onlineUserIds: Set<string>;
  onlinePresence?: OnlinePresenceMap;
  myId?: string;
  myEmail?: string;
  socketConnected: boolean;
  onRetryOrg: () => void;
  onToggleTree: (key: string) => void;
  onOpenDirectMessage: (userId: string) => void | Promise<void>;
  onUserContextMenu: OrgUserContextMenuHandler;
  onCreateOrgGroup: () => void;
  onRenameOrgGroup: (group: OrgGroup) => void;
  onDeleteOrgGroup: (group: OrgGroup) => void;
  onCreateChatFromOrgGroup: (group: OrgGroup) => void;
  hasStatusIcon: (status?: string | null) => boolean;
  renderStatusIcon: (status: string, size?: number) => JSX.Element | null;
};

function topLevelDepts(company: OrgCompany): OrgDepartment[] {
  return company.departments ?? [];
}

function OrgPanel({
  isDark,
  panelWrapStyle,
  searchQuery,
  onSearchQueryChange,
  showOnlineOnly,
  onToggleOnlineOnly,
  orgLoading,
  orgError,
  orgTree,
  orgGroups,
  companyMemberCounts,
  treeOpen,
  orgStarred,
  onToggleOrgStar,
  onlineUserIds,
  onlinePresence = {},
  myId,
  myEmail,
  socketConnected,
  onRetryOrg,
  onToggleTree,
  onOpenDirectMessage,
  onUserContextMenu,
  onCreateOrgGroup,
  onRenameOrgGroup,
  onDeleteOrgGroup,
  onCreateChatFromOrgGroup,
  hasStatusIcon,
  renderStatusIcon,
}: OrgPanelProps) {
  const wrap = panelWrapStyle(820);
  const [tab, setTab] = useState<OrgTab>('people');
  const [peopleFilter, setPeopleFilter] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string | null; label: string }> = [{ key: null, label: '전체' }];
    const multiCompany = (orgTree?.length ?? 0) > 1;

    for (const company of orgTree ?? []) {
      if (multiCompany) {
        chips.push({ key: `company:${company.id}`, label: company.name });
      }
      for (const dept of topLevelDepts(company)) {
        chips.push({ key: `dept:${dept.id}`, label: dept.name });
      }
    }
    return chips;
  }, [orgTree]);

  // 선택된 상위 부서 필터가 트리에서 사라지면 초기화
  const filterStillValid = useMemo(() => {
    if (!peopleFilter) return true;
    if (peopleFilter.startsWith('company:')) {
      return (orgTree ?? []).some((c) => c.id === peopleFilter.slice('company:'.length));
    }
    if (peopleFilter.startsWith('dept:')) {
      const id = peopleFilter.slice('dept:'.length);
      return (orgTree ?? []).some((c) => flattenDepartments(c.departments ?? []).some((d) => d.id === id));
    }
    return true;
  }, [orgTree, peopleFilter]);

  const activeFilter = filterStillValid ? peopleFilter : null;

  return (
    <div
      className={cn(wrap.className, isDark ? 'bg-slate-900' : 'bg-[#f7f8fa]')}
      style={wrap.style}
    >
      <PanelDragHeader className="shrink-0 px-5 pt-5 pb-0">
        <PanelNoDragWrap className="w-full">
          <h2
            className={cn(
              'm-0 mb-4 text-[22px] font-bold tracking-tight',
              isDark ? 'text-white' : 'text-slate-900',
            )}
          >
            연락처
          </h2>
          <div
            className={cn(
              'flex gap-5 border-b',
              isDark ? 'border-slate-700/80' : 'border-slate-200/90',
            )}
            role="tablist"
            aria-label="연락처 보기"
          >
            {([
              ['people', '사람'],
              ['groups', '내 그룹'],
            ] as const).map(([id, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSelectMode(false);
                    setTab(id);
                  }}
                  className={cn(
                    'relative -mb-px border-none bg-transparent px-0 pb-3 text-[15px] font-semibold cursor-pointer transition-colors',
                    active
                      ? (isDark ? 'text-white' : 'text-slate-900')
                      : (isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'),
                  )}
                >
                  {label}
                  {active && (
                    <span
                      className={cn(
                        'absolute inset-x-0 bottom-0 h-[2px] rounded-full',
                        isDark ? 'bg-white' : 'bg-slate-900',
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </PanelNoDragWrap>
      </PanelDragHeader>

      <div className="shrink-0 flex items-center gap-2 px-5 py-3">
        <PanelNoDragWrap className="relative min-w-0 flex-1">
          <span
            className={cn(
              'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2',
              isDark ? 'text-slate-500' : 'text-slate-400',
            )}
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="이름·부서 검색"
            aria-label="멤버 검색"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className={cn(
              'w-full rounded-2xl border-none py-2.5 pl-10 pr-10 text-[15px] outline-none',
              'focus-visible:ring-2 focus-visible:ring-brand-dark/25',
              isDark
                ? 'bg-slate-800 text-slate-100 placeholder:text-slate-500'
                : 'bg-white text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
            )}
          />
          {searchQuery.trim().length > 0 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">
              <UICloseButton
                size="sm"
                variant="subtle"
                onClick={() => onSearchQueryChange('')}
                aria-label="검색어 지우기"
                title="검색어 지우기"
              />
            </span>
          )}
        </PanelNoDragWrap>

        <PanelNoDragWrap>
          <button
            type="button"
            role="switch"
            aria-checked={showOnlineOnly}
            onClick={onToggleOnlineOnly}
            title="온라인만 보기"
            className={cn(
              'shrink-0 inline-flex h-[42px] items-center gap-1.5 rounded-2xl border-none px-3.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors',
              showOnlineOnly
                ? 'bg-brand-dark text-white'
                : isDark
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-white text-slate-600 hover:bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                showOnlineOnly ? 'bg-emerald-300' : 'bg-emerald-500',
              )}
            />
            온라인
          </button>
        </PanelNoDragWrap>

        {tab === 'groups' && (
          <PanelNoDragWrap>
            <button
              type="button"
              onClick={onCreateOrgGroup}
              title="내 그룹 만들기"
              className={cn(
                'shrink-0 inline-flex h-[42px] items-center rounded-2xl border-none px-3.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors',
                isDark
                  ? 'bg-slate-800 text-brand-light hover:bg-slate-700'
                  : 'bg-white text-brand-dark hover:bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
              )}
            >
              + 그룹
            </button>
          </PanelNoDragWrap>
        )}
      </div>

      {tab === 'people' && (
        <div className="shrink-0 flex items-start gap-2 px-5 pb-2">
          <PanelNoDragWrap className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {filterChips.map((chip) => {
                const active = activeFilter === chip.key;
                return (
                  <button
                    key={chip.key ?? 'all'}
                    type="button"
                    onClick={() => setPeopleFilter(chip.key)}
                    className={cn(
                      'rounded-full border-none px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors',
                      active
                        ? 'bg-brand-dark text-white'
                        : isDark
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'bg-white text-slate-600 hover:bg-slate-50 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </PanelNoDragWrap>

          <PanelNoDragWrap>
            <button
              type="button"
              onClick={() => setSelectMode((v) => !v)}
              title={selectMode ? '선택 종료' : '여러 명 선택'}
              className={cn(
                'shrink-0 rounded-full border-none px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors',
                selectMode
                  ? 'bg-brand-dark text-white'
                  : isDark
                    ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    : 'bg-transparent text-slate-400 hover:text-slate-700',
              )}
            >
              {selectMode ? '완료' : '선택'}
            </button>
          </PanelNoDragWrap>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pb-4">
        <OrgTree
          isDark={isDark}
          view={tab === 'groups' ? 'groups' : 'people'}
          peopleFilter={tab === 'people' ? activeFilter : null}
          selectMode={selectMode}
          orgLoading={orgLoading}
          orgError={orgError}
          orgTree={orgTree}
          orgGroups={orgGroups}
          companyMemberCounts={companyMemberCounts}
          treeOpen={treeOpen}
          orgStarred={orgStarred}
          onToggleOrgStar={onToggleOrgStar}
          onlineUserIds={onlineUserIds}
          onlinePresence={onlinePresence}
          myId={myId}
          myEmail={myEmail}
          socketConnected={socketConnected}
          onRetryOrg={onRetryOrg}
          onToggleTree={onToggleTree}
          onOpenDirectMessage={onOpenDirectMessage}
          onUserContextMenu={onUserContextMenu}
          onRenameOrgGroup={onRenameOrgGroup}
          onDeleteOrgGroup={onDeleteOrgGroup}
          onCreateChatFromOrgGroup={onCreateChatFromOrgGroup}
          hasStatusIcon={hasStatusIcon}
          renderStatusIcon={renderStatusIcon}
        />
      </div>
    </div>
  );
}

export default memo(OrgPanel);
