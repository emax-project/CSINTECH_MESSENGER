import { memo, useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { OrgCompany, OrgDepartment, OrgGroup, OrgUser } from '../../../api';
import type { OnlinePresenceMap } from '../../../utils/presence';
import UIChevron from '../../../components/ui/UIChevron';
import { cn } from '../../../utils/cn';
import { allOrgUsers, companyUsers, departmentUsers, flattenDepartments, listOrgPeople } from '../../../utils/orgTree';

const ACTIVE = '#5B8DEF';
const MUTED = '#cbd5e1';

function MobileIcon({ active }: { active: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
    </svg>
  );
}

function DesktopIcon({ active }: { active: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={active ? ACTIVE : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function InitialAvatar({
  name,
  isOnline,
  isDark,
  selected = false,
  selectMode = false,
}: {
  name: string;
  isOnline: boolean;
  isDark: boolean;
  selected?: boolean;
  selectMode?: boolean;
}) {
  const initial = (name?.trim()?.[0] || '?').toUpperCase();
  return (
    <span className="relative shrink-0">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold transition-colors',
          selected
            ? 'bg-brand-dark text-white'
            : isDark
              ? 'bg-slate-700 text-slate-200'
              : 'bg-[#eef1f6] text-slate-600',
        )}
      >
        {selected ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          initial
        )}
      </span>
      {!selectMode && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2',
            isDark ? 'border-slate-900' : 'border-white',
            isOnline ? 'bg-emerald-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300'),
          )}
          title={isOnline ? '온라인' : '오프라인'}
        />
      )}
    </span>
  );
}

export type OrgUserContextMenuHandler = (
  e: MouseEvent,
  user: OrgUser,
  opts?: { orgGroupId?: string; selectedUsers?: OrgUser[] },
) => void;

export type OrgTreeProps = {
  isDark: boolean;
  orgLoading: boolean;
  orgError: boolean;
  orgTree: OrgCompany[];
  orgGroups?: OrgGroup[];
  view?: 'people' | 'org' | 'groups';
  /** people 뷰: null=전체, company:id / dept:id */
  peopleFilter?: string | null;
  /** 다중 선택 모드 — 체크박스 대신 아바타 탭으로 선택 */
  selectMode?: boolean;
  companyMemberCounts?: Record<string, number>;
  treeOpen: Record<string, boolean>;
  /** Kept for parent API compatibility (sort/favorite handled upstream). */
  orgStarred?: Set<string>;
  onToggleOrgStar?: (id: string) => void;
  onlineUserIds: Set<string>;
  onlinePresence?: OnlinePresenceMap;
  myId?: string;
  myEmail?: string;
  socketConnected: boolean;
  onRetryOrg: () => void;
  onToggleTree: (key: string) => void;
  onOpenDirectMessage: (userId: string) => void | Promise<void>;
  onUserContextMenu: OrgUserContextMenuHandler;
  onRenameOrgGroup?: (group: OrgGroup) => void;
  onDeleteOrgGroup?: (group: OrgGroup) => void;
  onCreateChatFromOrgGroup?: (group: OrgGroup) => void;
  hasStatusIcon: (status?: string | null) => boolean;
  renderStatusIcon: (status: string, size?: number) => JSX.Element | null;
};

const countCompanyUsers = (company: OrgCompany) => companyUsers(company).length;

function SectionHeader({
  isDark,
  open,
  onToggle,
  label,
  count,
  trailing,
  depth = 0,
}: {
  isDark: boolean;
  open: boolean;
  onToggle: () => void;
  label: string;
  count?: number;
  trailing?: ReactNode;
  depth?: number;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-2xl px-2.5 py-2 transition-colors',
        isDark ? 'hover:bg-slate-800/70' : 'hover:bg-black/[0.03]',
      )}
      style={{ marginLeft: depth * 12 }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-none bg-transparent cursor-pointer',
          isDark ? 'text-slate-500' : 'text-slate-400',
        )}
        aria-label={open ? '접기' : '펼치기'}
      >
        <UIChevron open={open} size={13} />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-left text-[15px] font-semibold cursor-pointer',
          isDark ? 'text-slate-100' : 'text-slate-900',
        )}
      >
        {label}
      </button>
      {count != null && (
        <span className={cn('shrink-0 text-[12px] tabular-nums', isDark ? 'text-slate-500' : 'text-slate-400')}>
          {count}
        </span>
      )}
      {trailing}
    </div>
  );
}

function OrgUserRow({
  u,
  isDark,
  onlinePresence,
  onlineUserIds,
  myId,
  myEmail,
  socketConnected,
  selected,
  selectedUsers,
  selectMode,
  onToggleSelect,
  onOpenDirectMessage,
  onUserContextMenu,
  orgGroupId,
  hasStatusIcon,
  renderStatusIcon,
  depth = 0,
  subtitle,
}: {
  u: OrgUser;
  isDark: boolean;
  onlinePresence: OnlinePresenceMap;
  onlineUserIds: Set<string>;
  myId?: string;
  myEmail?: string;
  socketConnected: boolean;
  selected: boolean;
  selectedUsers: OrgUser[];
  selectMode: boolean;
  onToggleSelect: (userId: string) => void;
  onOpenDirectMessage: (userId: string) => void | Promise<void>;
  onUserContextMenu: OrgUserContextMenuHandler;
  orgGroupId?: string;
  hasStatusIcon: (status?: string | null) => boolean;
  renderStatusIcon: (status: string, size?: number) => JSX.Element | null;
  depth?: number;
  subtitle?: string;
}) {
  const isMe = String(u.id) === String(myId) || u.email === myEmail;
  const devices = onlinePresence[String(u.id)];
  const selfDesktop = isMe && socketConnected && detectSelfDesktop();
  const selfMobile = isMe && socketConnected && detectSelfMobile();
  const pcActive = devices ? !!devices.desktop : (selfDesktop || (onlineUserIds.has(String(u.id)) && !selfMobile));
  const mobileActive = devices ? !!devices.mobile : selfMobile;
  const isOnline = pcActive || mobileActive || onlineUserIds.has(String(u.id)) || (isMe && socketConnected);

  const openContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const multi = selected && selectedUsers.length > 1 ? selectedUsers : [u];
    onUserContextMenu(e, u, { orgGroupId, selectedUsers: multi });
  };

  const onRowActivate = () => {
    if (selectMode) onToggleSelect(u.id);
    else void onOpenDirectMessage(u.id);
  };

  return (
    <li className="list-none" style={{ marginLeft: depth * 12 }}>
      <div
        className={cn(
          'group flex h-12 items-center gap-2.5 rounded-2xl px-2.5 transition-colors cursor-pointer',
          selected
            ? (isDark ? 'bg-brand-dark/20' : 'bg-brand-dark/[0.08]')
            : (isDark ? 'hover:bg-slate-800/60' : 'hover:bg-black/[0.03]'),
        )}
        onClick={onRowActivate}
        onContextMenu={openContextMenu}
      >
        <InitialAvatar
          name={u.name}
          isOnline={isOnline}
          isDark={isDark}
          selected={selected}
          selectMode={selectMode}
        />

        <div className="min-w-0 flex-1 text-left">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                'truncate text-[15px] font-medium',
                isOnline
                  ? (isDark ? 'text-slate-100' : 'text-slate-900')
                  : (isDark ? 'text-slate-500' : 'text-slate-400'),
              )}
            >
              {u.name}
            </span>
            {isMe && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200/80 text-slate-600',
                )}
              >
                나
              </span>
            )}
            {u.statusMessage && hasStatusIcon(u.statusMessage) && (
              <span className="inline-flex shrink-0" title={u.statusMessage}>
                {renderStatusIcon(u.statusMessage, 13)}
              </span>
            )}
          </span>
          {(subtitle || u.jobTitle || u.email) && (
            <span className={cn('mt-0.5 block truncate text-[12px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
              {subtitle || u.jobTitle || u.email}
            </span>
          )}
        </div>

        {!selectMode && (
          <span className="inline-flex shrink-0 items-center gap-1 opacity-70">
            <span title={mobileActive ? '모바일 접속 중' : '모바일 오프라인'}>
              <MobileIcon active={mobileActive} />
            </span>
            <span title={pcActive ? 'PC 접속 중' : 'PC 오프라인'}>
              <DesktopIcon active={pcActive} />
            </span>
          </span>
        )}
      </div>
    </li>
  );
}

function detectSelfDesktop() {
  if (typeof window === 'undefined') return true;
  if (window.electronAPI) return true;
  return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

function detectSelfMobile() {
  return !detectSelfDesktop();
}

function GroupOverflowMenu({
  isDark,
  onRename,
  onDelete,
}: {
  isDark: boolean;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!onRename && !onDelete) return null;

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        title="더보기"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-xl border-none cursor-pointer text-[15px] font-bold tracking-widest',
          isDark ? 'bg-transparent text-slate-500 hover:bg-slate-700 hover:text-slate-200' : 'bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700',
        )}
      >
        ···
      </button>
      {open && (
        <div
          className={cn(
            'absolute right-0 top-9 z-20 min-w-[132px] overflow-hidden rounded-2xl p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.12)]',
            isDark ? 'bg-slate-800 ring-1 ring-slate-700' : 'bg-white ring-1 ring-slate-200/80',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {onRename && (
            <button
              type="button"
              className={cn(
                'block w-full rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[14px] cursor-pointer',
                isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-800 hover:bg-slate-50',
              )}
              onClick={() => {
                setOpen(false);
                onRename();
              }}
            >
              이름 변경
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className={cn(
                'block w-full rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-[14px] cursor-pointer text-red-500',
                isDark ? 'hover:bg-slate-700' : 'hover:bg-red-50',
              )}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SoftCard({
  isDark,
  children,
}: {
  isDark: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[20px]',
        isDark ? 'bg-slate-800/60' : 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
      )}
    >
      {children}
    </div>
  );
}

function OrgTree({
  isDark,
  orgLoading,
  orgError,
  orgTree,
  orgGroups = [],
  view = 'org',
  peopleFilter = null,
  selectMode = false,
  companyMemberCounts,
  treeOpen,
  onlineUserIds,
  onlinePresence = {},
  myId,
  myEmail,
  socketConnected,
  onRetryOrg,
  onToggleTree,
  onOpenDirectMessage,
  onUserContextMenu,
  onRenameOrgGroup,
  onDeleteOrgGroup,
  onCreateChatFromOrgGroup,
  hasStatusIcon,
  renderStatusIcon,
}: OrgTreeProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!selectMode) setSelectedIds(new Set());
  }, [selectMode]);

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectMany = (ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const usersById = (() => {
    const map = new Map<string, OrgUser>();
    if (view === 'groups') {
      orgGroups.forEach((g) => g.members.forEach((u) => map.set(u.id, u)));
    } else {
      allOrgUsers(orgTree).forEach((u) => map.set(u.id, u));
    }
    return map;
  })();

  const selectedUsers = [...selectedIds]
    .map((id) => usersById.get(id))
    .filter(Boolean) as OrgUser[];

  if (orgLoading && view !== 'groups') {
    return (
      <div className="flex flex-col gap-2 px-1 py-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={cn('h-14 rounded-[20px] animate-pulse', isDark ? 'bg-slate-800' : 'bg-white')}
          />
        ))}
      </div>
    );
  }

  if (orgError && view !== 'groups') {
    return (
      <SoftCard isDark={isDark}>
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <p className={cn('m-0 text-[15px] font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>
            연락처를 불러올 수 없습니다
          </p>
          <button
            type="button"
            onClick={onRetryOrg}
            className="cursor-pointer rounded-2xl border-none bg-brand-dark px-5 py-2.5 text-[14px] font-semibold text-white"
          >
            다시 시도
          </button>
        </div>
      </SoftCard>
    );
  }

  const userRowProps = {
    isDark,
    onlinePresence,
    onlineUserIds,
    myId,
    myEmail,
    socketConnected,
    selectedUsers,
    selectMode,
    onToggleSelect: toggleSelect,
    onOpenDirectMessage,
    onUserContextMenu,
    hasStatusIcon,
    renderStatusIcon,
  };

  if (view === 'people') {
    const deptScopeIds = (() => {
      if (!peopleFilter?.startsWith('dept:')) return null;
      const id = peopleFilter.slice('dept:'.length);
      for (const company of orgTree) {
        const found = flattenDepartments(company.departments ?? []).find((d) => d.id === id);
        if (found) return new Set(departmentUsers(found).map((u) => u.id));
      }
      return new Set<string>();
    })();

    const people = listOrgPeople(orgTree).filter((p) => {
      if (!peopleFilter) return true;
      if (peopleFilter.startsWith('company:')) return p.companyId === peopleFilter.slice('company:'.length);
      if (deptScopeIds) return deptScopeIds.has(p.id);
      return true;
    });

    // 같은 사람 중복 제거(필터 후 id 기준), 온라인 우선·이름순
    const seen = new Set<string>();
    const unique = people.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const isOnline = (id: string) => {
      const devices = onlinePresence[String(id)];
      if (devices) return !!(devices.desktop || devices.mobile);
      return onlineUserIds.has(String(id)) || (String(id) === String(myId) && socketConnected);
    };

    unique.sort((a, b) => {
      const ao = isOnline(a.id) ? 0 : 1;
      const bo = isOnline(b.id) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });

    if (unique.length === 0) {
      return (
        <SoftCard isDark={isDark}>
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className={cn('m-0 text-[15px] font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>
              해당하는 사람이 없습니다
            </p>
            <p className={cn('m-0 text-[13px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
              검색어나 필터를 바꿔 보세요
            </p>
          </div>
        </SoftCard>
      );
    }

    const allIds = unique.map((u) => u.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));

    return (
      <SoftCard isDark={isDark}>
        <div className="p-1.5">
          <div
            className={cn(
              'flex items-center justify-between gap-2 px-2.5 py-2',
              isDark ? 'text-slate-400' : 'text-slate-500',
            )}
          >
            {selectMode ? (
              <button
                type="button"
                onClick={() => toggleSelectMany(allIds, !allSelected)}
                className={cn(
                  'border-none bg-transparent p-0 text-[13px] font-semibold cursor-pointer',
                  isDark ? 'text-brand-light' : 'text-brand-dark',
                )}
              >
                {allSelected ? '선택 해제' : '전체 선택'}
              </button>
            ) : (
              <span className="text-[13px] font-medium">멤버</span>
            )}
            <span className="text-[12px] tabular-nums">
              {selectMode && selectedIds.size > 0 ? `${selectedIds.size}명 선택` : `${unique.length}명`}
            </span>
          </div>
          <ul className="m-0 list-none space-y-0.5 p-0">
            {unique.map((p) => (
              <OrgUserRow
                key={p.id}
                u={p}
                selected={selectedIds.has(p.id)}
                subtitle={[p.departmentPath, p.jobTitle].filter(Boolean).join(' · ')}
                {...userRowProps}
              />
            ))}
          </ul>
        </div>
      </SoftCard>
    );
  }

  if (view === 'groups') {
    if (orgGroups.length === 0) {
      return (
        <SoftCard isDark={isDark}>
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className={cn('m-0 text-[15px] font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>
              아직 그룹이 없습니다
            </p>
            <p className={cn('m-0 text-[13px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
              + 그룹으로 만들거나<br />연락처에서 우클릭으로 멤버를 추가하세요
            </p>
          </div>
        </SoftCard>
      );
    }

    return (
      <div className="space-y-2 px-1 py-1">
        {orgGroups.map((group) => {
          const groupKey = `orggroup-${group.id}`;
          const groupOpen = treeOpen[groupKey] !== false;
          return (
            <SoftCard key={group.id} isDark={isDark}>
              <div className="p-1.5">
                <SectionHeader
                  isDark={isDark}
                  open={groupOpen}
                  onToggle={() => onToggleTree(groupKey)}
                  label={group.name}
                  count={group.members.length}
                  trailing={(
                    <>
                      {selectMode && group.members.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const ids = group.members.map((m) => m.id);
                            const all = ids.every((id) => selectedIds.has(id));
                            toggleSelectMany(ids, !all);
                          }}
                          className={cn(
                            'shrink-0 rounded-xl border-none px-2.5 py-1.5 text-[12px] font-semibold cursor-pointer',
                            isDark
                              ? 'bg-slate-700 text-brand-light hover:bg-slate-600'
                              : 'bg-[#f2f4f8] text-brand-dark hover:bg-[#e8ecf3]',
                          )}
                        >
                          {group.members.every((m) => selectedIds.has(m.id)) ? '해제' : '선택'}
                        </button>
                      )}
                      {onCreateChatFromOrgGroup && (
                        <button
                          type="button"
                          title="그룹 채팅 만들기"
                          onClick={() => onCreateChatFromOrgGroup(group)}
                          className={cn(
                            'shrink-0 rounded-xl border-none px-2.5 py-1.5 text-[13px] font-semibold cursor-pointer',
                            isDark
                              ? 'bg-slate-700 text-brand-light hover:bg-slate-600'
                              : 'bg-[#f2f4f8] text-brand-dark hover:bg-[#e8ecf3]',
                          )}
                        >
                          채팅
                        </button>
                      )}
                      <GroupOverflowMenu
                        isDark={isDark}
                        onRename={onRenameOrgGroup ? () => onRenameOrgGroup(group) : undefined}
                        onDelete={onDeleteOrgGroup ? () => onDeleteOrgGroup(group) : undefined}
                      />
                    </>
                  )}
                />
                {groupOpen && (
                  <div className="px-1 pb-1">
                    {group.members.length === 0 ? (
                      <p className={cn('m-0 px-3 py-3 text-[13px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        멤버 없음 · 연락처에서 우클릭으로 추가
                      </p>
                    ) : (
                      <ul className="m-0 list-none space-y-0.5 p-0">
                        {group.members.map((u) => (
                          <OrgUserRow
                            key={u.id}
                            u={u}
                            orgGroupId={group.id}
                            selected={selectedIds.has(u.id)}
                            depth={1}
                            {...userRowProps}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </SoftCard>
          );
        })}
      </div>
    );
  }

  if (orgTree.length === 0) {
    return (
      <p className={cn('p-8 text-center text-[14px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
        표시할 조직이 없습니다.
      </p>
    );
  }

  const renderDept = (dept: OrgDepartment, depth: number) => {
    const deptKey = `dept-${dept.id}`;
    const deptOpen = treeOpen[deptKey] !== false;
    const children = dept.children ?? [];
    const deptIds = departmentUsers(dept).map((u) => u.id);
    const hasContent = dept.users.length > 0 || children.length > 0;

    return (
      <div key={dept.id}>
        <SectionHeader
          isDark={isDark}
          open={deptOpen}
          onToggle={() => onToggleTree(deptKey)}
          label={dept.name}
          count={deptIds.length}
          depth={depth}
          trailing={
            selectMode && deptIds.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const all = deptIds.every((id) => selectedIds.has(id));
                  toggleSelectMany(deptIds, !all);
                }}
                className={cn(
                  'shrink-0 rounded-xl border-none px-2 py-1 text-[11px] font-semibold cursor-pointer',
                  isDark
                    ? 'bg-slate-700 text-brand-light'
                    : 'bg-[#f2f4f8] text-brand-dark',
                )}
              >
                {deptIds.every((id) => selectedIds.has(id)) ? '해제' : '선택'}
              </button>
            ) : undefined
          }
        />
        {deptOpen && hasContent && (
          <div>
            {dept.users.length > 0 && (
              <ul className="m-0 list-none space-y-0.5 p-0">
                {dept.users.map((u) => (
                  <OrgUserRow
                    key={u.id}
                    u={u}
                    selected={selectedIds.has(u.id)}
                    depth={depth + 1}
                    {...userRowProps}
                  />
                ))}
              </ul>
            )}
            {children.map((child) => renderDept(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2 px-1 py-1">
      {orgTree.map((company) => {
        const companyKey = `company-${company.id}`;
        const companyOpen = treeOpen[companyKey] !== false;
        const memberCount = companyMemberCounts?.[company.id] ?? countCompanyUsers(company);
        const companyUserIds = companyUsers(company).map((u) => u.id);

        return (
          <SoftCard key={company.id} isDark={isDark}>
            <div className="p-1.5">
              <SectionHeader
                isDark={isDark}
                open={companyOpen}
                onToggle={() => onToggleTree(companyKey)}
                label={company.name}
                count={memberCount}
                trailing={
                  selectMode && companyUserIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const all = companyUserIds.every((id) => selectedIds.has(id));
                        toggleSelectMany(companyUserIds, !all);
                      }}
                      className={cn(
                        'shrink-0 rounded-xl border-none px-2 py-1 text-[11px] font-semibold cursor-pointer',
                        isDark
                          ? 'bg-slate-700 text-brand-light'
                          : 'bg-[#f2f4f8] text-brand-dark',
                      )}
                    >
                      {companyUserIds.every((id) => selectedIds.has(id)) ? '해제' : '선택'}
                    </button>
                  ) : undefined
                }
              />
              {companyOpen && (
                <div className="pb-1">
                  {company.departments.map((dept) => renderDept(dept, 1))}
                </div>
              )}
            </div>
          </SoftCard>
        );
      })}
    </div>
  );
}

export default memo(OrgTree);
