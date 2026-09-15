import UICloseButton from '../../../components/ui/UICloseButton';
import { cn } from '../../../utils/cn';

type Props = {
  isDark: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/** 내가 바꾼 부서 순서(로컬 저장)를 전부 되돌릴지 확인하는 모달. */
export default function DeptOrderResetModal({ isDark, onClose, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className={cn('w-[360px] max-w-[90%] rounded-xl p-5 shadow-lg', isDark ? 'bg-slate-800' : 'bg-white')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className={cn('m-0 text-[16px] font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>
            부서 순서 초기화
          </h3>
          <UICloseButton onClick={onClose} />
        </div>

        <p className={cn('m-0 mb-4 text-[14px] leading-relaxed', isDark ? 'text-slate-300' : 'text-slate-600')}>
          내가 바꾼 부서 순서를 모두 원래대로 되돌릴까요?
          <br />
          <span className={cn('text-[12px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
            나에게만 적용된 순서라 다른 사람 화면에는 영향이 없습니다.
          </span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'flex-1 cursor-pointer rounded-lg border py-2.5 text-[13px] font-semibold',
              isDark ? 'border-slate-600 bg-transparent text-slate-200' : 'border-slate-200 bg-transparent text-slate-700',
            )}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 cursor-pointer rounded-lg border-none bg-brand-dark py-2.5 text-[13px] font-semibold text-white"
          >
            초기화
          </button>
        </div>
      </div>
    </div>
  );
}
