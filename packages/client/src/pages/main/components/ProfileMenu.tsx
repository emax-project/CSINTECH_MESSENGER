import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import type { UserAffiliation } from '../../../api';

type StatusOption = { id: string; label: string };

type ProfileMenuProps = {
  isDark: boolean;
  name: string;
  avatarSrc: string;
  currentStatus: string;
  statusOptions: StatusOption[];
  renderStatusIcon: (status: string, size?: number) => ReactNode;
  onSetStatus: (status: string) => void;
  affiliations: UserAffiliation[];
  onSwitchAffiliation?: (departmentId: string) => void;
  currentDeptLabel?: string;
  onLock?: () => void;
  onLogout: () => void;
  onQuit?: () => void;
  onClose: () => void;
};

export default function ProfileMenu({
  isDark,
  name,
  avatarSrc,
  currentStatus,
  statusOptions,
  renderStatusIcon,
  onSetStatus,
  affiliations,
  onSwitchAffiliation,
  currentDeptLabel,
  onLock,
  onLogout,
  onQuit,
  onClose,
}: ProfileMenuProps) {
  const itemClass = cn(
    'flex w-full items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[13px] cursor-pointer',
    isDark ? 'hover:bg-slate-700 text-slate-100' : 'hover:bg-slate-50 text-slate-800',
  );
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = cn('my-1 h-px', isDark ? 'bg-slate-600' : 'bg-slate-200');
  const active = currentStatus || '온라인';
  const showAffiliations = affiliations.length > 1;

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 cursor-default border-none bg-transparent" aria-label="닫기" onClick={onClose} />
      <div
        className={cn(
          'absolute bottom-11 left-11 z-50 w-[248px] rounded-xl border py-1.5 shadow-xl',
          isDark ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-800',
        )}
      >
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="relative h-9 w-9 shrink-0">
            <img src={avatarSrc} alt="" className="h-full w-full rounded-full object-cover" />
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-[1px] shadow">
              {renderStatusIcon(active, 12)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold">{name}</div>
            <div className={cn('mt-0.5 truncate text-[11px]', muted)}>
              {currentDeptLabel || affiliations.find((a) => a.active)?.label || ''}
            </div>
          </div>
        </div>

        <div className={divider} />
        <div className={cn('px-3 pb-1 text-[11px] font-semibold', muted)}>업무 상태</div>
        {statusOptions.map((opt) => {
          const selected = opt.id === active;
          return (
            <button
              key={opt.id}
              type="button"
              className={itemClass}
              onClick={() => { onSetStatus(opt.id); onClose(); }}
            >
              {renderStatusIcon(opt.id, 14)}
              <span className="flex-1">{opt.label}</span>
              {selected && <span className="text-[12px] text-brand">✓</span>}
            </button>
          );
        })}

        {showAffiliations && (
          <>
            <div className={divider} />
            <div className={cn('px-3 pb-1 text-[11px] font-semibold', muted)}>표시 법인/부서</div>
            {affiliations.map((aff) => (
              <button
                key={aff.departmentId}
                type="button"
                className={itemClass}
                onClick={() => { onSwitchAffiliation?.(aff.departmentId); onClose(); }}
              >
                <span className="flex-1 truncate">{aff.label}</span>
                {aff.active && <span className="text-[12px] text-brand">✓</span>}
              </button>
            ))}
          </>
        )}

        <div className={divider} />
        {onLock && (
          <button type="button" className={itemClass} onClick={() => { onLock(); onClose(); }}>
            화면 잠금
          </button>
        )}
        <button type="button" className={itemClass} onClick={() => { onLogout(); onClose(); }}>
          로그아웃
        </button>
        {onQuit && (
          <button type="button" className={cn(itemClass, 'text-red-600')} onClick={() => { onQuit(); onClose(); }}>
            프로그램 종료
          </button>
        )}
      </div>
    </>
  );
}
