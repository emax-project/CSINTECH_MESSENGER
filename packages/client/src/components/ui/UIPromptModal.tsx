import { useAccentStyles } from '../../hooks/useAccentStyles';
import { useState } from 'react';
import { cn } from '../../utils/cn';
import UIModal from './UIModal';

export type PromptOption = { value: string; label: string };

type Props = {
  isDark: boolean;
  title: string;
  /** 입력창 위에 보여줄 안내. 줄바꿈(\n)을 그대로 살린다. */
  message?: string;
  /** 고를 수 있는 목록. 비우면 자유 입력만 받는다. */
  options?: PromptOption[];
  /** 목록에 없는 값도 직접 입력할 수 있게 할지 */
  allowFreeText?: boolean;
  defaultValue?: string;
  placeholder?: string;
  inputType?: 'text' | 'password';
  confirmLabel?: string;
  /** 빈 값 제출을 허용할지 (직급 지우기처럼 '없음'이 의미 있는 경우) */
  allowEmpty?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

/**
 * window.prompt 대체 모달.
 * Electron에서는 prompt()가 동작하지 않으므로 목록 선택·자유 입력이 필요한 곳은 이걸 쓴다.
 */
export default function UIPromptModal({
  isDark,
  title,
  message,
  options,
  allowFreeText = true,
  defaultValue = '',
  placeholder,
  inputType = 'text',
  confirmLabel = '확인',
  allowEmpty = false,
  onSubmit,
  onClose,
}: Props) {
  const accent = useAccentStyles(isDark);
  const [value, setValue] = useState(defaultValue);
  const hasOptions = (options?.length ?? 0) > 0;
  const canSubmit = allowEmpty || value.trim().length > 0;

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
    background: isDark ? '#1e293b' : '#fff',
    color: isDark ? '#e2e8f0' : '#333',
    fontSize: 14,
    boxSizing: 'border-box' as const,
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(value.trim());
  };

  return (
    <UIModal title={title} onClose={onClose} width={400}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
        {message && (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
              color: isDark ? '#94a3b8' : '#64748b',
            }}
          >
            {message}
          </p>
        )}

        {hasOptions && (
          <div
            className={cn('overflow-auto rounded-lg border')}
            style={{
              maxHeight: 200,
              borderColor: isDark ? '#475569' : '#e2e8f0',
            }}
          >
            {options!.map((opt) => (
              <button
                key={opt.value || '__empty__'}
                type="button"
                onClick={() => setValue(opt.value)}
                style={value === opt.value ? accent.secondaryStyle : undefined}
                className={cn(
                  'block w-full truncate border-none px-3 py-2.5 text-left text-[13px] cursor-pointer',
                  value === opt.value
                    ? isDark
                      ? 'bg-slate-600 text-slate-100'
                      : 'bg-slate-200 text-slate-900'
                    : isDark
                      ? 'bg-transparent text-slate-200'
                      : 'bg-transparent text-slate-700',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {(allowFreeText || !hasOptions) && (
          <input
            autoFocus={!hasOptions}
            type={inputType}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            style={{ ...inputStyle, ...accent.inputStyle }}
          />
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            style={accent.primaryStyle}
            className="flex-1 px-4 py-2 border-none rounded-lg bg-gradient-to-br from-brand-light to-brand-dark text-white text-[13px] font-semibold cursor-pointer disabled:opacity-60"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-lg border text-[13px] font-semibold cursor-pointer',
              isDark
                ? 'border-slate-600 bg-transparent text-slate-200'
                : accent.custom ? 'border-[var(--color-brand-dark)] bg-transparent text-[var(--color-brand-dark)]' : 'border-slate-200 bg-transparent text-slate-700',
            )}
          >
            취소
          </button>
        </div>
      </div>
    </UIModal>
  );
}
