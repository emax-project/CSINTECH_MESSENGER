import { memo, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { OrgCompany, OrgDepartment, OrgGroup, OrgUser } from '../../../api';
import type { OnlinePresenceMap } from '../../../utils/presence';
import { cn } from '../../../utils/cn';
import { allOrgUsers, companyUsers, departmentUsers, formatJobTitle } from '../../../utils/orgTree';
import DeptOrderResetModal from './DeptOrderResetModal';

const ACTIVE_BLUE = '#5B8DEF';
const INACTIVE_GRAY = '#c5c9d0';
const FOLDER_BLUE = '#5B8DEF';

function FolderIcon({ size = 15, active = true }: { size?: number; active?: boolean }) {
  const color = active ? FOLDER_BLUE : INACTIVE_GRAY;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden style={{ flexShrink: 0 }}>
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

function MobileIcon({ active }: { active: boolean }) {
  const color = active ? ACTIVE_BLUE : INACTIVE_GRAY;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
    </svg>
  );
}

function DesktopIcon({ active }: { active: boolean }) {
  const color = active ? ACTIVE_BLUE : INACTIVE_GRAY;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function ExpandBox({ open, onClick, isDark }: { open: boolean; onClick: () => void; isDark: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center border p-0 text-[11px] leading-none cursor-pointer rounded-[2px]',
        isDark
          ? 'border-slate-500 bg-slate-800 text-slate-300'
          : 'border-slate-300 bg-white text-slate-600',
      )}
      aria-label={open ? '접기' : '펼치기'}
    >
      {open ? '−' : '+'}
    </button>
  );
}

/**
 * 부서 노출 순서를 나만 보이게 바꾸는 개인화 설정. 관리자가 정한 전체 순서 위에 얹혀서,
 * 계정(myId)별로 이 브라우저/앱에만 저장된다(서버에 저장하지 않음 - 즐겨찾기와 같은 방식).
 */
const DEPT_ORDER_STORAGE_PREFIX = 'emax_org_dept_order_v1_';

function loadDeptOrder(myId?: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(DEPT_ORDER_STORAGE_PREFIX + (myId || 'anon'));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveDeptOrder(myId: string | undefined, order: Record<string, number>) {
  try {
    localStorage.setItem(DEPT_ORDER_STORAGE_PREFIX + (myId || 'anon'), JSON.stringify(order));
  } catch {
    /* 저장 실패해도 화면 동작에는 지장 없음 */
  }
}

function ResetIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

function DeptOrderButton({
  direction,
  disabled,
  onClick,
  isDark,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onClick: () => void;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={direction === 'up' ? '위로 이동 (나에게만 적용)' : '아래로 이동 (나에게만 적용)'}
      aria-label={direction === 'up' ? '부서 위로 이동' : '부서 아래로 이동'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border-none bg-transparent p-0 cursor-pointer disabled:cursor-default disabled:opacity-20',
        isDark ? 'text-slate-500 hover:bg-slate-700 hover:text-slate-300' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
      )}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ transform: direction === 'down' ? 'rotate(180deg)' : undefined }}
      >
        <path d="m6 15 6-6 6 6" />
      </svg>
    </button>
  );
}

export type OrgUserContextMenuHandler = (
  e: MouseEvent,
  user: OrgUser,
  opts?: { orgGroupId?: string; selectedUsers?: OrgUser[] },
) => void;

function FriendStar({
  active,
  isDark,
  onClick,
}: {
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={active ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      aria-label={active ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-none bg-transparent p-0 cursor-pointer transition-colors',
        active
          ? 'text-amber-400'
          : isDark
            ? 'text-slate-500 hover:text-slate-300'
            : 'text-slate-400 hover:text-slate-600',
      )}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

export type OrgTreeProps = {
  isDark: boolean;
  orgLoading: boolean;
  orgError: boolean;
  orgTree: OrgCompany[];
  orgGroups?: OrgGroup[];
  view?: 'org' | 'friends' | 'groups';
  /** combined: 부서 아래 사원 / split: 부서 트리와 선택 부서 사원 분리 */
  viewMode?: 'combined' | 'split';
  companyMemberCounts?: Record<string, number>;
  treeOpen: Record<string, boolean>;
  orgStarred: Set<string>;
  onToggleOrgStar: (id: string) => void;
  orgFriends: Set<string>;
  onToggleOrgFriend: (userId: string) => void;
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
  isFriend,
  onToggleFriend,
  onToggleSelect,
  onOpenDirectMessage,
  onUserContextMenu,
  orgGroupId,
  hasStatusIcon,
  renderStatusIcon,
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
  isFriend: boolean;
  onToggleFriend: (userId: string) => void;
  onToggleSelect: (userId: string) => void;
  onOpenDirectMessage: (userId: string) => void | Promise<void>;
  onUserContextMenu: OrgUserContextMenuHandler;
  orgGroupId?: string;
  hasStatusIcon: (status?: string | null) => boolean;
  renderStatusIcon: (status: string, size?: number) => JSX.Element | null;
}) {
  const isMe = String(u.id) === String(myId) || u.email === myEmail;
  const devices = onlinePresence[String(u.id)];
  const selfDesktop = isMe && socketConnected && detectSelfDesktop();
  const selfMobile = isMe && socketConnected && detectSelfMobile();
  const pcActive = devices ? !!devices.desktop : (selfDesktop || (onlineUserIds.has(String(u.id)) && !selfMobile));
  const mobileActive = devices ? !!devices.mobile : selfMobile;
  const isOnline = pcActive || mobileActive || onlineUserIds.has(String(u.id)) || (isMe && socketConnected);
  const jobLabel = formatJobTitle(u.jobTitle);

  const openContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const multi =
      selected && selectedUsers.length > 1
        ? selectedUsers
        : [u];
    onUserContextMenu(e, u, {
      orgGroupId,
      selectedUsers: multi,
    });
  };

  return (
    <li className="list-none">
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded px-1.5 py-[3px] transition-colors',
          selected
            ? (isDark ? 'bg-brand-dark/20' : 'bg-brand-dark/[0.10]')
            : (isDark ? 'hover:bg-slate-800/70' : 'hover:bg-[#f3f6fa]'),
        )}
        onContextMenu={openContextMenu}
      >
        <label className="flex shrink-0 cursor-pointer items-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(u.id)}
            className="h-3.5 w-3.5 cursor-pointer accent-brand"
          />
        </label>
        {u.statusMessage && hasStatusIcon(u.statusMessage) && (
          <span className="inline-flex shrink-0" title={u.statusMessage}>
            {renderStatusIcon(u.statusMessage, 12)}
          </span>
        )}
        <button
          type="button"
          title="더블 클릭하면 대화창이 열립니다"
          className={cn(
            'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-left text-[13px] cursor-pointer',
            isOnline
              ? (isDark ? 'text-slate-100 font-medium' : 'text-slate-800 font-medium')
              : (isDark ? 'text-slate-200' : 'text-slate-600'),
          )}
          onClick={() => onToggleSelect(u.id)}
          onDoubleClick={() => void onOpenDirectMessage(u.id)}
          onContextMenu={openContextMenu}
        >
          {jobLabel ? `[${jobLabel}]` : ''}
          {u.name}
          {isMe ? ' (나)' : ''}
        </button>
        <span className="inline-flex shrink-0 items-center gap-0.5">
          <span title={mobileActive ? '모바일 접속 중' : '모바일 오프라인'}>
            <MobileIcon active={mobileActive} />
          </span>
          <span title={pcActive ? 'PC 접속 중' : 'PC 오프라인'}>
            <DesktopIcon active={pcActive} />
          </span>
        </span>
        <FriendStar active={isFriend} isDark={isDark} onClick={() => onToggleFriend(u.id)} />
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

function OrgTree({
  isDark,
  orgLoading,
  orgError,
  orgTree,
  orgGroups = [],
  view = 'org',
  viewMode = 'combined',
  companyMemberCounts,
  treeOpen,
  orgFriends,
  onToggleOrgFriend,
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
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [deptOrder, setDeptOrder] = useState<Record<string, number>>(() => loadDeptOrder(myId));
  const [resettingDeptOrder, setResettingDeptOrder] = useState(false);
  useEffect(() => {
    setDeptOrder(loadDeptOrder(myId));
  }, [myId]);

  /** 같은 상위 부서 안 형제 목록을, 나에게만 적용되는 순서로 정렬한다. 순서가 없으면 원래(관리자) 순서 그대로. */
  const orderedChildren = (list: OrgDepartment[]): OrgDepartment[] =>
    list
      .map((d, i) => ({ d, key: deptOrder[d.id] ?? 1e9 + i }))
      .sort((a, b) => a.key - b.key)
      .map((w) => w.d);

  /** 부서를 형제 중 한 칸 위/아래로. 나에게만 저장되며(로컬), 전체 순서에는 영향 없다. */
  const reorderDept = (dept: OrgDepartment, siblings: OrgDepartment[], direction: 'up' | 'down') => {
    const index = siblings.findIndex((s) => s.id === dept.id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    setDeptOrder((prev) => {
      const next = { ...prev };
      reordered.forEach((d, i) => { next[d.id] = i + 1; });
      saveDeptOrder(myId, next);
      return next;
    });
  };
  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const n = Number(localStorage.getItem('emax_org_split_ratio'));
      return Number.isFinite(n) && n > 0.2 && n < 0.8 ? n : 0.45;
    } catch {
      return 0.45;
    }
  });
  const splitRootRef = useRef<HTMLDivElement | null>(null);
  const draggingSplit = useRef(false);
  const splitRatioRef = useRef(splitRatio);
  splitRatioRef.current = splitRatio;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingSplit.current || !splitRootRef.current) return;
      const rect = splitRootRef.current.getBoundingClientRect();
      if (rect.height < 40) return;
      const next = (e.clientY - rect.top) / rect.height;
      setSplitRatio(Math.min(0.75, Math.max(0.25, next)));
    };
    const onUp = () => {
      if (!draggingSplit.current) return;
      draggingSplit.current = false;
      try { localStorage.setItem('emax_org_split_ratio', String(splitRatioRef.current)); } catch { /* ignore */ }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

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
    return <p className={cn('p-4 text-[13px]', isDark ? 'text-slate-400' : 'text-slate-500')}>로딩 중...</p>;
  }
  if (orgError && view !== 'groups') {
    return (
      <div className="p-5 text-center">
        <p className="mb-1.5 text-sm font-semibold text-red-600">조직 데이터를 불러올 수 없습니다</p>
        <button
          type="button"
          onClick={onRetryOrg}
          className="cursor-pointer rounded-lg border-none bg-brand-dark px-4 py-2 text-[13px] font-semibold text-white"
        >
          다시 시도
        </button>
      </div>
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
    onToggleSelect: toggleSelect,
    onToggleFriend: onToggleOrgFriend,
    onOpenDirectMessage,
    onUserContextMenu,
    hasStatusIcon,
    renderStatusIcon,
  };

  if (view === 'friends') {
    const friends = allOrgUsers(orgTree)
      .filter((u) => orgFriends.has(String(u.id)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));

    if (orgFriends.size === 0) {
      return (
        <p className={cn('p-6 text-center text-[13px] leading-relaxed', isDark ? 'text-slate-400' : 'text-slate-500')}>
          즐겨찾기한 친구가 없습니다.<br />
          조직도에서 ★ 또는 우클릭으로 추가하세요.
        </p>
      );
    }

    if (friends.length === 0) {
      return (
        <p className={cn('p-6 text-center text-[13px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
          검색·온라인 필터에 맞는 친구가 없습니다.
        </p>
      );
    }

    return (
      <div className="px-2.5 py-2">
        <div className={cn('mb-1.5 px-1 text-[12px] tabular-nums', isDark ? 'text-slate-500' : 'text-slate-400')}>
          {friends.length}명
        </div>
        <ul className="m-0 list-none space-y-0.5 p-0">
          {friends.map((u) => (
            <OrgUserRow
              key={u.id}
              u={u}
              selected={selectedIds.has(u.id)}
              isFriend
              {...userRowProps}
            />
          ))}
        </ul>
      </div>
    );
  }

  if (view === 'groups') {
    if (orgGroups.length === 0) {
      return (
        <p className={cn('p-4 text-[13px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
          그룹이 없습니다. 상단 + 그룹으로 만들어 보세요.
        </p>
      );
    }
    return (
      <div className="px-2.5 py-1">
        {orgGroups.map((group) => {
          const groupKey = `orggroup-${group.id}`;
          const groupOpen = treeOpen[groupKey] !== false;
          const memberIds = group.members.map((m) => m.id);
          const allSelected = memberIds.length > 0 && memberIds.every((id) => selectedIds.has(id));
          return (
            <div key={group.id} className="mb-0.5">
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <ExpandBox isDark={isDark} open={groupOpen} onClick={() => onToggleTree(groupKey)} />
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => toggleSelectMany(memberIds, e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-brand"
                />
                <FolderIcon active={groupOpen} />
                <button
                  type="button"
                  onClick={() => onToggleTree(groupKey)}
                  className={cn(
                    'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-left text-[13px] font-semibold cursor-pointer',
                    groupOpen
                      ? (isDark ? 'text-brand-light' : 'text-brand-dark')
                      : (isDark ? 'text-slate-100' : 'text-slate-900'),
                  )}
                >
                  {group.name}
                </button>
                <span className={cn('shrink-0 text-[11px] tabular-nums', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  {group.members.length}
                </span>
                {onCreateChatFromOrgGroup && (
                  <button
                    type="button"
                    title="그룹 채팅 만들기"
                    onClick={() => onCreateChatFromOrgGroup(group)}
                    className={cn(
                      'shrink-0 border-none bg-transparent px-1 text-[11px] font-semibold cursor-pointer',
                      isDark ? 'text-brand-light' : 'text-brand-dark',
                    )}
                  >
                    채팅
                  </button>
                )}
                {onRenameOrgGroup && (
                  <button
                    type="button"
                    onClick={() => onRenameOrgGroup(group)}
                    className={cn('shrink-0 border-none bg-transparent px-1 text-[11px] cursor-pointer', isDark ? 'text-slate-400' : 'text-slate-500')}
                  >
                    수정
                  </button>
                )}
                {onDeleteOrgGroup && (
                  <button
                    type="button"
                    onClick={() => onDeleteOrgGroup(group)}
                    className="shrink-0 border-none bg-transparent px-1 text-[11px] text-red-600 cursor-pointer"
                  >
                    삭제
                  </button>
                )}
              </div>
              {groupOpen && (
                <ul className={cn(
                  'm-0 list-none border-l border-dashed py-0.5 pl-3 ml-[7px]',
                  isDark ? 'border-slate-600' : 'border-slate-200',
                )}>
                  {group.members.length === 0 ? (
                    <li className={cn('px-2 py-1 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      멤버 없음 · 조직도 탭에서 우클릭으로 추가
                    </li>
                  ) : (
                    group.members.map((u) => (
                      <OrgUserRow
                        key={u.id}
                        u={u}
                        orgGroupId={group.id}
                        selected={selectedIds.has(u.id)}
                        isFriend={orgFriends.has(String(u.id))}
                        {...userRowProps}
                      />
                    ))
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (orgTree.length === 0) {
    return <p className={cn('p-4 text-[13px]', isDark ? 'text-slate-400' : 'text-slate-500')}>표시할 조직이 없습니다.</p>;
  }

  /**
   * 부서는 하위 부서를 가질 수 있으므로 재귀로 그린다.
   * 체크박스는 하위 부서 인원까지 포함해 한 번에 선택되게 한다.
   */
  const renderDept = (dept: OrgDepartment, siblings: OrgDepartment[]) => {
    const deptKey = `dept-${dept.id}`;
    const deptOpen = !!treeOpen[deptKey];
    const children = orderedChildren(dept.children ?? []);
    // 이 부서 + 모든 하위 부서의 인원
    const deptIds = departmentUsers(dept).map((u) => u.id);
    const deptAllSelected = deptIds.length > 0 && deptIds.every((id) => selectedIds.has(id));
    const hasContent = viewMode === 'split'
      ? children.length > 0
      : (dept.users.length > 0 || children.length > 0);
    const isSelectedDept = selectedDeptId === dept.id;
    const siblingIndex = siblings.findIndex((s) => s.id === dept.id);

    return (
      <div key={dept.id} className="mt-0.5">
        <div
          className={cn(
            'flex items-center gap-1.5 px-1 py-0.5 rounded',
            isSelectedDept && viewMode === 'split' && (isDark ? 'bg-brand-dark/20' : 'bg-brand-dark/[0.08]'),
          )}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const users = departmentUsers(dept);
            if (users.length === 0) return;
            toggleSelectMany(users.map((u) => u.id), true);
            onUserContextMenu(e, users[0], { selectedUsers: users });
          }}
        >
          <ExpandBox isDark={isDark} open={deptOpen} onClick={() => onToggleTree(deptKey)} />
          <input
            type="checkbox"
            checked={deptAllSelected}
            onChange={(e) => toggleSelectMany(deptIds, e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-brand"
          />
          <FolderIcon active={deptOpen || isSelectedDept} />
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'split') setSelectedDeptId(dept.id);
              onToggleTree(deptKey);
            }}
            className={cn(
              'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-left text-[13px] font-semibold cursor-pointer',
              deptOpen || isSelectedDept
                ? (isDark ? 'text-brand-light' : 'text-brand-dark')
                : (isDark ? 'text-slate-300' : 'text-slate-600'),
            )}
          >
            {dept.name}
            <span className={cn('ml-0.5 font-normal tabular-nums', isDark ? 'text-slate-500' : 'text-slate-400')}>
              ({deptIds.length})
            </span>
          </button>
          <span className="inline-flex shrink-0 items-center">
            <DeptOrderButton
              direction="up"
              disabled={siblingIndex <= 0}
              onClick={() => reorderDept(dept, siblings, 'up')}
              isDark={isDark}
            />
            <DeptOrderButton
              direction="down"
              disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1}
              onClick={() => reorderDept(dept, siblings, 'down')}
              isDark={isDark}
            />
          </span>
        </div>
        {deptOpen && hasContent && (
          <div className={cn(
            'ml-[7px] border-l border-dashed pl-2',
            isDark ? 'border-slate-600' : 'border-slate-200',
          )}>
            {viewMode === 'combined' && dept.users.length > 0 && (
              <ul className="m-0 list-none py-0.5 pl-1">
                {dept.users.map((u) => (
                  <OrgUserRow
                    key={u.id}
                    u={u}
                    selected={selectedIds.has(u.id)}
                    isFriend={orgFriends.has(String(u.id))}
                    {...userRowProps}
                  />
                ))}
              </ul>
            )}
            {children.map((child) => renderDept(child, children))}
          </div>
        )}
      </div>
    );
  };

  const findDept = (depts: OrgDepartment[], id: string): OrgDepartment | null => {
    for (const d of depts) {
      if (d.id === id) return d;
      const found = findDept(d.children ?? [], id);
      if (found) return found;
    }
    return null;
  };

  const selectedDept = selectedDeptId
    ? orgTree.map((c) => findDept(c.departments ?? [], selectedDeptId)).find(Boolean) ?? null
    : null;
  const splitUsers = selectedDept ? (selectedDept.users ?? []) : [];

  return (
    <div
      ref={viewMode === 'split' ? splitRootRef : undefined}
      className={cn('px-2.5 py-1', viewMode === 'split' && 'flex h-full min-h-0 flex-col')}
    >
      <div
        className={viewMode === 'split' ? 'min-h-[80px] overflow-y-auto' : undefined}
        style={viewMode === 'split' ? { height: `${Math.round(splitRatio * 1000) / 10}%` } : undefined}
      >
      {Object.keys(deptOrder).length > 0 && (
        <div className="flex justify-end px-1 pb-1">
          <button
            type="button"
            onClick={() => setResettingDeptOrder(true)}
            title="내가 바꾼 부서 순서를 모두 원래대로 되돌립니다"
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
              isDark
                ? 'border-slate-600 text-slate-400 hover:border-slate-500 hover:bg-slate-700 hover:text-slate-200'
                : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700',
            )}
          >
            <ResetIcon />
            부서 순서 초기화
          </button>
        </div>
      )}
      {orgTree.map((company) => {
        const companyKey = `company-${company.id}`;
        const companyOpen = treeOpen[companyKey] !== false;
        const memberCount = companyMemberCounts?.[company.id] ?? countCompanyUsers(company);
        const companyUserIds = companyUsers(company).map((u) => u.id);
        const companyAllSelected =
          companyUserIds.length > 0 && companyUserIds.every((id) => selectedIds.has(id));
        const rootDepts = orderedChildren(company.departments ?? []);

        return (
          <div key={company.id} className="mb-0.5">
            <div className="flex items-center gap-1.5 px-1 py-0.5">
              <ExpandBox isDark={isDark} open={companyOpen} onClick={() => onToggleTree(companyKey)} />
              <input
                type="checkbox"
                checked={companyAllSelected}
                onChange={(e) => toggleSelectMany(companyUserIds, e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-brand"
              />
              <FolderIcon active={companyOpen} />
              <button
                type="button"
                onClick={() => onToggleTree(companyKey)}
                className={cn(
                  'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-left text-[13px] font-bold cursor-pointer',
                  companyOpen
                    ? (isDark ? 'text-brand-light' : 'text-brand-dark')
                    : (isDark ? 'text-slate-100' : 'text-slate-900'),
                )}
              >
                {company.name}
                <span className={cn('ml-0.5 font-normal tabular-nums', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  ({memberCount})
                </span>
              </button>
            </div>

            {companyOpen && (
              <div className={cn(
                'ml-[7px] border-l border-dashed pl-2',
                isDark ? 'border-slate-600' : 'border-slate-200',
              )}>
                {rootDepts.map((dept) => renderDept(dept, rootDepts))}
              </div>
            )}
          </div>
        );
      })}
      </div>
      {viewMode === 'split' && (
        <>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="조직도 영역 크기 조절"
            className={cn(
              'mx-1 my-0.5 h-1.5 shrink-0 cursor-row-resize rounded-full',
              isDark ? 'bg-slate-600 hover:bg-brand' : 'bg-slate-200 hover:bg-brand',
            )}
            onPointerDown={(e) => {
              e.preventDefault();
              draggingSplit.current = true;
            }}
          />
        <div className={cn(
          'min-h-[80px] flex-1 overflow-y-auto rounded-lg border px-2 py-2',
          isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50',
        )}>
          <div className={cn('mb-1.5 px-1 text-[12px] font-bold', isDark ? 'text-slate-300' : 'text-slate-600')}>
            {selectedDept ? `${selectedDept.name} · ${splitUsers.length}명` : '부서를 선택하세요'}
          </div>
          {selectedDept && splitUsers.length === 0 && (
            <p className={cn('px-1 text-[12px]', isDark ? 'text-slate-500' : 'text-slate-400')}>소속 사원이 없습니다.</p>
          )}
          <ul className="m-0 list-none space-y-0.5 p-0">
            {splitUsers.map((u) => (
              <OrgUserRow
                key={u.id}
                u={u}
                selected={selectedIds.has(u.id)}
                isFriend={orgFriends.has(String(u.id))}
                {...userRowProps}
              />
            ))}
          </ul>
        </div>
        </>
      )}
      {resettingDeptOrder && (
        <DeptOrderResetModal
          isDark={isDark}
          onClose={() => setResettingDeptOrder(false)}
          onConfirm={() => {
            setDeptOrder({});
            saveDeptOrder(myId, {});
          }}
        />
      )}
    </div>
  );
}

export default memo(OrgTree);
