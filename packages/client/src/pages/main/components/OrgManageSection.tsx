import { memo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi, type CompanyItem, type DepartmentItem, type JobTitleItem } from '../../../api';
import { useAccentStyles } from '../../../hooks/useAccentStyles';
import { cn } from '../../../utils/cn';
import UIPromptModal from '../../../components/ui/UIPromptModal';

/** 목록이 비어 있을 때 '기본 직급 채우기'로 한 번에 넣을 값 */
const DEFAULT_JOB_TITLES = [
  '사원', '주임', '대리', '과장', '차장', '부장',
  '이사', '상무', '전무', '부사장', '사장',
];

type Props = {
  isDark: boolean;
  isNarrowLayout?: boolean;
  /** 탭 안에 들어갈 때: 바깥 카드와 제목을 상위(AdminSection)가 그리므로 생략 */
  embedded?: boolean;
};

const ICON = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 이름 변경 */
function PencilIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** 상위 부서 이동 */
function MoveIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M4 4v7a3 3 0 0 0 3 3h9" />
      <path d="m13 11 3 3-3 3" />
    </svg>
  );
}

/** 순번 올리기 / 내리기 */
function CaretIcon({ up }: { up: boolean }) {
  return (
    <svg {...ICON} aria-hidden style={{ transform: up ? undefined : 'rotate(180deg)' }}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

/** 삭제 */
function TrashIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
    </svg>
  );
}

/** 부서 폴더 (조직도 화면과 같은 모양) */
function FolderIcon({ open, color }: { open: boolean; color?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill={open ? color ?? '#3b82f6' : '#94a3b8'} aria-hidden style={{ flexShrink: 0 }}>
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  );
}

/** 서버가 돌려주는 오류 코드를 사람이 읽을 문구로 */
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const map: Record<string, string> = {
    DEPARTMENT_EXISTS: '같은 상위 부서 아래에 같은 이름이 이미 있습니다.',
    DEPARTMENT_NOT_FOUND: '부서를 찾을 수 없습니다.',
    MOVE_TARGET_NOT_FOUND: '옮길 부서를 찾을 수 없습니다.',
    PARENT_NOT_FOUND: '상위 부서를 찾을 수 없습니다.',
    CANNOT_MOVE_INTO_SELF: '자기 자신을 상위 부서로 지정할 수 없습니다.',
    CANNOT_MOVE_INTO_DESCENDANT: '하위 부서를 상위로 지정할 수 없습니다.',
    COMPANY_NOT_FOUND: '회사를 찾을 수 없습니다.',
    JOB_TITLE_EXISTS: '같은 이름의 직급이 이미 있습니다.',
    JOB_TITLE_IN_USE: '이 직급을 쓰는 사용자가 있어 지울 수 없습니다. 사용 인원이 0이 된 뒤에 지울 수 있습니다.',
    'Admin only': '관리자만 사용할 수 있습니다.',
  };
  return map[msg] || msg;
}

function OrgManageSection({ isDark, isNarrowLayout = false, embedded = false }: Props) {
  const accent = useAccentStyles(isDark);
  const queryClient = useQueryClient();
  const [newDept, setNewDept] = useState('');
  const [newParentId, setNewParentId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newJob, setNewJob] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Electron에서 window.prompt가 동작하지 않아 모달로 값을 받는다
  const [prompting, setPrompting] = useState<
    { kind: 'move' | 'deleteMove'; dept: DepartmentItem } | null
  >(null);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [editingJobName, setEditingJobName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: companies = [] } = useQuery<CompanyItem[]>({
    queryKey: ['org', 'companies'],
    queryFn: orgApi.companies,
  });
  const { data: departments = [] } = useQuery<DepartmentItem[]>({
    queryKey: ['org', 'departments'],
    queryFn: orgApi.departments,
  });
  const { data: jobTitles = [] } = useQuery<JobTitleItem[]>({
    queryKey: ['org', 'job-titles'],
    queryFn: orgApi.jobTitles,
  });

  const refresh = () => {
    // 조직도·사용자 목록·콤보 제안이 모두 같은 데이터를 보므로 함께 무효화
    queryClient.invalidateQueries({ queryKey: ['org'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const run = <T,>(fn: () => Promise<T>, onOk: (r: T) => void) => {
    setError(null);
    setNotice(null);
    fn()
      .then((r) => {
        onOk(r);
        refresh();
      })
      .catch((e) => setError(friendlyError(e)));
  };

  const addDept = () => {
    const name = newDept.trim();
    if (!name) return;
    const parent = departments.find((d) => d.id === newParentId);
    run(() => orgApi.createDepartment(name, newParentId || null), (d) => {
      setNewDept('');
      setNotice(
        parent ? `'${parent.name}' 아래에 '${d.name}'을(를) 추가했습니다.` : `'${d.name}' 부서를 추가했습니다.`,
      );
    });
  };

  /** 자기 자신과 자기 하위는 상위 후보에서 뺀다(순환 방지). */
  const moveCandidates = (dept: DepartmentItem) => {
    const descendants = new Set<string>([dept.id]);
    let grew = true;
    while (grew) {
      grew = false;
      departments.forEach((d) => {
        if (d.parentId && descendants.has(d.parentId) && !descendants.has(d.id)) {
          descendants.add(d.id);
          grew = true;
        }
      });
    }
    return departments.filter((d) => !descendants.has(d.id));
  };

  const applyMove = (dept: DepartmentItem, targetId: string) => {
    setPrompting(null);
    const chosen = departments.find((d) => d.id === targetId);
    run(() => orgApi.moveDepartment(dept.id, targetId || null), () => {
      setNotice(
        chosen ? `'${dept.name}'을(를) '${chosen.path}' 아래로 옮겼습니다.` : `'${dept.name}'을(를) 최상위로 옮겼습니다.`,
      );
    });
  };

  const saveRename = (dept: DepartmentItem) => {
    const name = editingName.trim();
    if (!name || name === dept.name) {
      setEditingId(null);
      return;
    }
    run(() => orgApi.renameDepartment(dept.id, name), () => {
      setEditingId(null);
      setNotice(`'${dept.name}' → '${name}'으로 변경했습니다.`);
    });
  };

  const removeDept = (dept: DepartmentItem) => {
    if (dept.userCount > 0) {
      if (departments.filter((d) => d.id !== dept.id).length === 0) {
        setError('소속 인원을 옮길 다른 부서가 없습니다. 부서를 먼저 만들어 주세요.');
        return;
      }
      setPrompting({ kind: 'deleteMove', dept });
      return;
    }
    const childCount = departments.filter((d) => d.parentId === dept.id).length;
    const extra = childCount > 0 ? `\n하위 부서 ${childCount}개는 삭제되지 않고 한 단계 위로 올라갑니다.` : '';
    if (!window.confirm(`'${dept.path}' 부서를 삭제할까요?${extra}`)) return;
    run(() => orgApi.deleteDepartment(dept.id), (r) => {
      setNotice(
        r.promotedChildren
          ? `'${dept.name}'를 삭제하고 하위 부서 ${r.promotedChildren}개를 위로 올렸습니다.`
          : `'${dept.name}' 부서를 삭제했습니다.`,
      );
    });
  };

  const applyDeleteWithMove = (dept: DepartmentItem, destId: string) => {
    const dest = departments.find((d) => d.id === destId);
    if (!dest) return;
    setPrompting(null);
    if (!window.confirm(`${dept.userCount}명을 '${dest.path}'로 옮기고 '${dept.name}'를 삭제합니다.`)) return;
    run(() => orgApi.deleteDepartment(dept.id, dest.id), (r) => {
      setNotice(`${r.movedUsers}명을 '${r.movedTo}'로 옮기고 '${dept.name}'를 삭제했습니다.`);
    });
  };

  const reorderCompany = (company: CompanyItem, direction: 'up' | 'down') => {
    run(() => orgApi.reorderCompany(company.id, direction), (r) => {
      if (!r.moved) setNotice(`'${company.name}'는 이미 ${direction === 'up' ? '맨 위' : '맨 아래'}입니다.`);
    });
  };

  const reorderDept = (dept: DepartmentItem, direction: 'up' | 'down') => {
    run(() => orgApi.reorderDepartment(dept.id, direction), (r) => {
      if (!r.moved) setNotice(`'${dept.name}'는 이미 ${direction === 'up' ? '맨 위' : '맨 아래'}입니다.`);
    });
  };

  const reorderJob = (job: JobTitleItem, direction: 'up' | 'down') => {
    run(() => orgApi.reorderJobTitle(job.name, direction), (r) => {
      if (!r.moved) setNotice(`'${job.name}'는 이미 ${direction === 'up' ? '맨 위' : '맨 아래'}입니다.`);
    });
  };

  const addJobTitle = () => {
    const name = newJob.trim();
    if (!name) return;
    run(() => orgApi.createJobTitle(name), (j) => {
      setNewJob('');
      setNotice(`'${j.name}' 직급을 추가했습니다.`);
    });
  };

  const removeJobTitle = (job: JobTitleItem) => {
    if (!window.confirm(`'${job.name}' 직급을 목록에서 지울까요?`)) return;
    run(() => orgApi.deleteJobTitle(job.name), () => {
      setNotice(`'${job.name}' 직급을 지웠습니다.`);
    });
  };

  const saveJobRename = (job: JobTitleItem) => {
    const to = editingJobName.trim();
    if (!to || to === job.name) {
      setEditingJob(null);
      return;
    }
    if (job.userCount > 0 && !window.confirm(`'${job.name}' 직급인 ${job.userCount}명을 '${to}'(으)로 함께 바꿉니다.`)) {
      return;
    }
    run(() => orgApi.renameJobTitle(job.name, to), (r) => {
      setEditingJob(null);
      setNotice(
        r.updated > 0
          ? `'${job.name}' → '${to}' 로 바꿨습니다. (사용자 ${r.updated}명 반영)`
          : `'${job.name}' → '${to}' 로 바꿨습니다.`,
      );
    });
  };

  /** 목록이 비어 있을 때 흔한 직급을 한 번에 채워 넣는다. */
  const fillDefaults = () => {
    const existing = new Set(jobTitles.map((j) => j.name));
    const missing = DEFAULT_JOB_TITLES.filter((t) => !existing.has(t));
    if (missing.length === 0) return;
    setError(null);
    setNotice(null);
    missing
      .reduce<Promise<unknown>>((chain, name) => chain.then(() => orgApi.createJobTitle(name)), Promise.resolve())
      .then(() => {
        refresh();
        setNotice(`기본 직급 ${missing.length}개를 추가했습니다.`);
      })
      .catch((e) => {
        refresh();
        setError(friendlyError(e));
      });
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hasChildren = (id: string) => departments.some((d) => d.parentId === id);

  // 트리 연결선을 그리려면 각 부서가 형제 중 마지막인지, 조상이 누구인지 알아야 한다.
  const deptById = new Map(departments.map((d) => [d.id, d]));
  const isLastChild = (() => {
    const groups = new Map<string, DepartmentItem[]>();
    departments.forEach((d) => {
      const key = d.parentId ?? '__root__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    });
    const map = new Map<string, boolean>();
    groups.forEach((list) => list.forEach((d, i) => map.set(d.id, i === list.length - 1)));
    return map;
  })();
  /** 최상위부터 바로 위 부모까지 */
  const ancestorsOf = (dept: DepartmentItem) => {
    const out: DepartmentItem[] = [];
    let cur = dept.parentId ? deptById.get(dept.parentId) : undefined;
    while (cur) {
      out.unshift(cur);
      cur = cur.parentId ? deptById.get(cur.parentId) : undefined;
    }
    return out;
  };

  // 목록은 서버가 트리 순서로 주므로, 접힌 부서의 자손만 걸러내면 된다.
  const visibleDepartments = (() => {
    const hiddenUnder = new Set<string>();
    return departments.filter((d) => {
      if (d.parentId && hiddenUnder.has(d.parentId)) {
        hiddenUnder.add(d.id);
        return false;
      }
      if (collapsed.has(d.id)) hiddenUnder.add(d.id);
      return true;
    });
  })();

  const border = isDark ? 'border-slate-600' : 'border-slate-200';
  const line = isDark ? 'bg-slate-600' : 'bg-slate-300';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const text = isDark ? 'text-slate-200' : 'text-slate-700';
  const sectionBg = isDark ? 'bg-slate-700' : 'bg-slate-50';
  const rowBg = isDark ? 'bg-slate-800' : 'bg-white';
  const inputCls = cn(
    'w-full rounded-lg border px-3 py-2.5 text-sm outline-none box-border',
    isNarrowLayout && 'min-h-[44px] text-base',
    isDark
      ? 'border-slate-600 bg-slate-900 text-slate-200 placeholder:text-slate-500'
      : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400',
  );
  const btnCls = cn(
    'shrink-0 rounded-lg border px-3 py-2.5 text-[13px] font-semibold cursor-pointer',
    isDark ? 'border-slate-600 bg-transparent text-slate-200' : accent.custom ? 'border-[var(--color-brand-dark)] bg-transparent text-[var(--color-brand-dark)]' : 'border-slate-200 bg-transparent text-slate-700',
  );
  const linkBtn = cn(
    'shrink-0 whitespace-nowrap border-none bg-transparent font-semibold cursor-pointer',
    isNarrowLayout ? 'px-2.5 py-2 text-sm' : 'px-1.5 py-1 text-xs',
  );
  // 좁은 화면(터치 조작)에서는 아이콘 버튼 히트 영역을 44px 권장 기준에 가깝게 키운다.
  const iconBtn = cn(
    'inline-flex shrink-0 items-center justify-center rounded border-none bg-transparent p-0 cursor-pointer align-middle',
    isNarrowLayout ? 'h-9 w-9' : 'h-6 w-6',
    isDark ? 'text-slate-300 hover:bg-slate-700 active:bg-slate-600' : accent.custom ? 'text-[var(--color-brand-dark)] hover:bg-[rgba(var(--color-brand-dark-rgb),0.1)] active:bg-[rgba(var(--color-brand-dark-rgb),0.2)]' : 'text-slate-500 hover:bg-slate-100 active:bg-slate-200',
  );
  const iconBtnDanger = cn(
    'inline-flex shrink-0 items-center justify-center rounded border-none bg-transparent p-0 cursor-pointer align-middle',
    isNarrowLayout ? 'h-9 w-9' : 'h-6 w-6',
    isDark ? 'text-red-400 hover:bg-slate-700 active:bg-slate-600' : 'text-red-500 hover:bg-slate-100 active:bg-slate-200',
  );
  // 액션 버튼끼리 붙어서 오조작하지 않도록 좁은 화면에서 사이 간격을 넉넉히 준다.
  const actionGroupCls = cn('inline-flex items-center', isNarrowLayout && 'gap-0.5');

  return (
    <div className={cn('flex flex-col gap-4', !embedded && cn('rounded-[10px] px-3.5 py-3', sectionBg))}>
      <div>
        {!embedded && (
          <h4 className={cn('m-0 text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>
            부서 · 직급 관리
          </h4>
        )}
        <p className={cn(embedded ? 'mt-0' : 'mt-1', 'mb-0 text-xs leading-relaxed', muted)}>
          하위 부서를 만들 수 있습니다. 여기서 정리한 이름이 사용자 등록의 추천 목록에 그대로 쓰입니다.
        </p>
      </div>

      {/* 회사 */}
      {companies.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={cn('text-[13px] font-semibold', text)}>회사</span>
          <p className={cn('m-0 text-xs leading-relaxed', muted)}>
            여러 회사(법인)가 있을 때 조직도·부서 관리에 노출되는 순서입니다.
          </p>
          <div className={cn('overflow-x-auto rounded-lg border', border)}>
            <table className="w-full min-w-[430px] border-collapse text-[13px]">
              <thead>
                <tr className={cn(isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                  <th className={cn('w-12 px-2 py-1.5 text-center font-semibold', muted)}>순번</th>
                  <th className={cn('px-2 py-1.5 text-left font-semibold', muted)}>회사명</th>
                  <th className={cn('w-16 px-2 py-1.5 text-right font-semibold', muted)}>부서</th>
                  <th className={cn('w-20 px-2 py-1.5 text-right font-semibold', muted)}>인원</th>
                  <th className={cn('px-2 py-1.5 text-right font-semibold', muted, isNarrowLayout ? 'w-24' : 'w-16')}>관리</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className={cn('border-t', border, rowBg)}>
                    <td className={cn('px-2 py-1.5 text-center tabular-nums', muted)}>{c.order}</td>
                    <td className={cn('px-2 py-1.5', text)}>{c.name}</td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', muted)}>{c.departmentCount}</td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', muted)}>{c.userCount}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      <span className={actionGroupCls}>
                        <button
                          type="button"
                          title="순번 올리기"
                          aria-label={`${c.name} 순번 올리기`}
                          onClick={() => reorderCompany(c, 'up')}
                          className={iconBtn}
                        >
                          <CaretIcon up />
                        </button>
                        <button
                          type="button"
                          title="순번 내리기"
                          aria-label={`${c.name} 순번 내리기`}
                          onClick={() => reorderCompany(c, 'down')}
                          className={iconBtn}
                        >
                          <CaretIcon up={false} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 부서 */}
      <div className="flex flex-col gap-2">
        <span className={cn('text-[13px] font-semibold', text)}>부서</span>

        <div className={cn('flex gap-2', isNarrowLayout && 'flex-col')}>
          <input
            type="text"
            value={newDept}
            placeholder="추가할 부서명"
            onChange={(e) => setNewDept(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addDept();
            }}
            className={inputCls}
          />
          <select
            value={newParentId}
            onChange={(e) => setNewParentId(e.target.value)}
            className={cn(inputCls, !isNarrowLayout && 'max-w-[200px]')}
          >
            <option value="">최상위 부서로</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {'\u00A0'.repeat(d.depth * 2)}
                {d.name} 아래
              </option>
            ))}
          </select>
          <button type="button" onClick={addDept} disabled={!newDept.trim()} className={cn(btnCls, 'disabled:opacity-50')}>
            추가
          </button>
        </div>

        {departments.length === 0 ? (
          <p className={cn('m-0 text-xs', muted)}>등록된 부서가 없습니다.</p>
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border', border)}>
            <table className="w-full min-w-[500px] border-collapse text-[13px]">
              <thead>
                <tr className={cn(isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                  <th className={cn('w-12 px-2 py-1.5 text-center font-semibold', muted)}>순번</th>
                  <th className={cn('px-2 py-1.5 text-left font-semibold', muted)}>부서명</th>
                  <th className={cn('w-16 px-2 py-1.5 text-right font-semibold', muted)}>직속</th>
                  <th className={cn('w-20 px-2 py-1.5 text-right font-semibold', muted)}>하위 포함</th>
                  <th className={cn('px-2 py-1.5 text-right font-semibold', muted, isNarrowLayout ? 'w-[210px]' : 'w-[152px]')}>관리</th>
                </tr>
              </thead>
              <tbody>
                {visibleDepartments.map((d) => {
                  const expandable = hasChildren(d.id);
                  const isCollapsed = collapsed.has(d.id);
                  return (
                    <tr key={d.id} className={cn('border-t', border, rowBg)}>
                      <td className={cn('px-2 py-1.5 text-center tabular-nums', muted)}>{d.order}</td>
                      <td className="p-0">
                        <div className={cn('flex items-stretch', isNarrowLayout ? 'min-h-[44px]' : 'min-h-[34px]')}>
                          {/* 조상 세로 가이드: 그 조상이 마지막 형제가 아니면 선을 잇는다 */}
                          {ancestorsOf(d).map((a) => (
                            <span key={a.id} className="relative w-4 shrink-0" aria-hidden>
                              {!isLastChild.get(a.id) && (
                                <span className={cn('absolute left-1/2 top-0 h-full w-px', line)} />
                              )}
                            </span>
                          ))}
                          {/* 자기 위치의 └ 또는 ├ */}
                          {d.depth > 0 && (
                            <span className="relative w-4 shrink-0" aria-hidden>
                              <span
                                className={cn('absolute left-1/2 top-0 w-px', line)}
                                style={{ height: isLastChild.get(d.id) ? '50%' : '100%' }}
                              />
                              <span className={cn('absolute left-1/2 top-1/2 h-px w-1/2', line)} />
                            </span>
                          )}
                          <div className="flex min-w-0 flex-1 items-center gap-1 py-1.5 pr-2 pl-1">
                            {expandable ? (
                              <button
                                type="button"
                                aria-label={isCollapsed ? `${d.name} 펼치기` : `${d.name} 접기`}
                                aria-expanded={!isCollapsed}
                                onClick={() => toggleCollapse(d.id)}
                                className={cn(
                                  'flex shrink-0 items-center justify-center rounded-[3px] border leading-none cursor-pointer',
                                  isNarrowLayout ? 'h-[22px] w-[22px] text-sm' : 'h-[15px] w-[15px] text-[10px]',
                                  border,
                                  muted,
                                  isDark ? 'bg-slate-900' : 'bg-white',
                                )}
                              >
                                {isCollapsed ? '+' : '−'}
                              </button>
                            ) : (
                              <span className={cn('shrink-0', isNarrowLayout ? 'h-[22px] w-[22px]' : 'h-[15px] w-[15px]')} aria-hidden />
                            )}
                            <FolderIcon color={accent.custom ? accent.theme.accent : undefined} open={expandable && !isCollapsed} />
                            {editingId === d.id ? (
                              <input
                                autoFocus
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveRename(d);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                className={cn(inputCls, 'min-w-0 px-2 py-1 text-[13px]')}
                              />
                            ) : (
                              <span className={cn('min-w-0 truncate', text)} title={d.path}>
                                {d.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', muted)}>{d.userCount}</td>
                      <td className={cn('px-2 py-1.5 text-right tabular-nums', muted)}>
                        {d.totalUserCount}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        {editingId === d.id ? (
                          <>
                            <button type="button" onClick={() => saveRename(d)} className={cn(linkBtn, accent.custom ? 'text-[var(--color-brand-dark)]' : 'text-blue-500')}>
                              저장
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className={cn(linkBtn, muted)}>
                              취소
                            </button>
                          </>
                        ) : (
                          <span className={actionGroupCls}>
                            <button
                              type="button"
                              title="순번 올리기"
                              aria-label={`${d.name} 순번 올리기`}
                              onClick={() => reorderDept(d, 'up')}
                              className={iconBtn}
                            >
                              <CaretIcon up />
                            </button>
                            <button
                              type="button"
                              title="순번 내리기"
                              aria-label={`${d.name} 순번 내리기`}
                              onClick={() => reorderDept(d, 'down')}
                              className={iconBtn}
                            >
                              <CaretIcon up={false} />
                            </button>
                            <button
                              type="button"
                              title="이름 변경"
                              aria-label={`${d.name} 이름 변경`}
                              onClick={() => {
                                setEditingId(d.id);
                                setEditingName(d.name);
                              }}
                              className={iconBtn}
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              title="상위 부서 이동"
                              aria-label={`${d.name} 상위 부서 이동`}
                              onClick={() => setPrompting({ kind: 'move', dept: d })}
                              className={iconBtn}
                            >
                              <MoveIcon />
                            </button>
                            <button
                              type="button"
                              title="삭제"
                              aria-label={`${d.name} 삭제`}
                              onClick={() => removeDept(d)}
                              className={iconBtnDanger}
                            >
                              <TrashIcon />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 직급 */}
      <div className="flex flex-col gap-2">
        <span className={cn('text-[13px] font-semibold', text)}>직급</span>
        <p className={cn('m-0 text-xs leading-relaxed', muted)}>
          아직 아무도 쓰지 않는 직급도 미리 등록해 둘 수 있습니다. 이름을 바꾸면 그 직급인
          사람 전체가 함께 바뀝니다.
        </p>

        <div className={cn('flex gap-2', isNarrowLayout && 'flex-col')}>
          <input
            type="text"
            value={newJob}
            placeholder="추가할 직급명"
            onChange={(e) => setNewJob(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addJobTitle();
            }}
            className={inputCls}
          />
          <button
            type="button"
            onClick={addJobTitle}
            disabled={!newJob.trim()}
            className={cn(btnCls, 'disabled:opacity-50')}
          >
            추가
          </button>
        </div>

        {jobTitles.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className={cn('m-0 text-xs', muted)}>등록된 직급이 없습니다.</p>
            <button type="button" onClick={fillDefaults} className={btnCls}>
              기본 직급 채우기 (사원 ~ 사장)
            </button>
          </div>
        ) : (
          <div className={cn('overflow-x-auto rounded-lg border', border)}>
            <table className="w-full min-w-[430px] border-collapse text-[13px]">
              <thead>
                <tr className={cn(isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                  <th className={cn('w-12 px-2 py-1.5 text-center font-semibold', muted)}>순번</th>
                  <th className={cn('px-2 py-1.5 text-left font-semibold', muted)}>직급명</th>
                  <th className={cn('w-20 px-2 py-1.5 text-right font-semibold', muted)}>사용 인원</th>
                  <th className={cn('w-20 px-2 py-1.5 text-center font-semibold', muted)}>상태</th>
                  <th className={cn('px-2 py-1.5 text-right font-semibold', muted, isNarrowLayout ? 'w-[168px]' : 'w-[124px]')}>관리</th>
                </tr>
              </thead>
              <tbody>
                {jobTitles.map((j) => (
                  <tr key={j.name} className={cn('border-t', border, rowBg)}>
                    <td className={cn('px-2 py-1.5 text-center tabular-nums', muted)}>
                      {j.order ?? '-'}
                    </td>
                    <td className="px-2 py-1.5">
                      {editingJob === j.name ? (
                        <input
                          autoFocus
                          type="text"
                          value={editingJobName}
                          onChange={(e) => setEditingJobName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveJobRename(j);
                            if (e.key === 'Escape') setEditingJob(null);
                          }}
                          className={cn(inputCls, 'min-w-0 px-2 py-1 text-[13px]')}
                        />
                      ) : (
                        <span className={cn('truncate', text)}>{j.name}</span>
                      )}
                    </td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', muted)}>{j.userCount}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={cn('text-[11px]', muted)}
                        title={
                          j.inMaster
                            ? '직급 목록에 등록된 값입니다.'
                            : '목록에 등록되지 않고 사용자에게만 붙어 있는 값입니다.'
                        }
                      >
                        {j.inMaster ? '등록' : '미등록'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      {editingJob === j.name ? (
                        <>
                          <button type="button" onClick={() => saveJobRename(j)} className={cn(linkBtn, accent.custom ? 'text-[var(--color-brand-dark)]' : 'text-blue-500')}>
                            저장
                          </button>
                          <button type="button" onClick={() => setEditingJob(null)} className={cn(linkBtn, muted)}>
                            취소
                          </button>
                        </>
                      ) : (
                        <span className={actionGroupCls}>
                          {j.inMaster && (
                            <>
                              <button
                                type="button"
                                title="순번 올리기"
                                aria-label={`${j.name} 순번 올리기`}
                                onClick={() => reorderJob(j, 'up')}
                                className={iconBtn}
                              >
                                <CaretIcon up />
                              </button>
                              <button
                                type="button"
                                title="순번 내리기"
                                aria-label={`${j.name} 순번 내리기`}
                                onClick={() => reorderJob(j, 'down')}
                                className={iconBtn}
                              >
                                <CaretIcon up={false} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            title="이름 변경"
                            aria-label={`${j.name} 이름 변경`}
                            onClick={() => {
                              setEditingJob(j.name);
                              setEditingJobName(j.name);
                            }}
                            className={iconBtn}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            title="삭제"
                            aria-label={`${j.name} 삭제`}
                            onClick={() => removeJobTitle(j)}
                            className={iconBtnDanger}
                          >
                            <TrashIcon />
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {error && <div className="text-xs text-red-500">{error}</div>}
      {notice && <div className={cn('text-xs', isDark ? 'text-emerald-400' : 'text-emerald-600')}>{notice}</div>}

      {prompting?.kind === 'move' && (
        <UIPromptModal
          isDark={isDark}
          title="상위 부서 이동"
          message={`'${prompting.dept.path}'을(를) 어디 아래로 옮길까요?`}
          options={[
            { value: '', label: '(최상위로)' },
            ...moveCandidates(prompting.dept).map((d) => ({ value: d.id, label: d.path })),
          ]}
          allowFreeText={false}
          allowEmpty
          confirmLabel="이동"
          onSubmit={(v) => applyMove(prompting.dept, v)}
          onClose={() => setPrompting(null)}
        />
      )}

      {prompting?.kind === 'deleteMove' && (
        <UIPromptModal
          isDark={isDark}
          title="부서 삭제"
          message={`'${prompting.dept.path}'에 ${prompting.dept.userCount}명이 있습니다.\n이 인원을 옮길 부서를 고르세요.`}
          options={departments
            .filter((d) => d.id !== prompting.dept.id)
            .map((d) => ({ value: d.id, label: d.path }))}
          allowFreeText={false}
          confirmLabel="옮기고 삭제"
          onSubmit={(v) => applyDeleteWithMove(prompting.dept, v)}
          onClose={() => setPrompting(null)}
        />
      )}
    </div>
  );
}

export default memo(OrgManageSection);
