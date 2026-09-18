import { memo, useEffect, useRef, useState } from 'react';
import { PanelTitleRow, panelTitleRowBg } from '../../../components/PanelDragHeader';
import { cn } from '../../../utils/cn';
import { useThemeStore } from '../../../store';
import { getOrgTheme } from '../../../utils/orgTheme';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

type NotepadPanelProps = {
  isDark: boolean;
  value: string;
  onChange: (value: string) => void;
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  saveStatus: SaveStatus;
};

function saveStatusLabel(status: SaveStatus) {
  if (status === 'saving') return '저장 중…';
  if (status === 'saved') return '저장됨';
  if (status === 'error') return '저장 실패';
  return '';
}

function NotepadPanel({ isDark, value, onChange, panelWrapStyle, saveStatus }: NotepadPanelProps) {
  const wrap = panelWrapStyle(760);
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';
  // IME(한글) 조합 중 커서 튐 방지: 로컬 입력값을 따로 들고, 조합이 끝나면 부모로 올려보낸다.
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  useEffect(() => {
    if (!composingRef.current) setDraft(value);
  }, [value]);

  return (
    <div className={wrap.className} style={wrap.style}>
      <PanelTitleRow
        isDark={isDark}
        title="메모장"
        className={useCustomAccent
          ? 'border-[rgba(var(--color-brand-dark-rgb),0.2)] [&_h3]:text-[var(--color-brand-dark)]'
          : panelTitleRowBg(isDark)}
        style={useCustomAccent ? { background: orgTheme.headerBg } : undefined}
        right={
          <span
            className={cn(
              'text-[12px] tabular-nums',
              saveStatus === 'error'
                ? 'text-red-500'
                : isDark
                  ? 'text-slate-400'
                  : useCustomAccent
                    ? 'text-[var(--color-brand-dark)]'
                    : 'text-slate-500',
            )}
          >
            {saveStatusLabel(saveStatus)}
          </span>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            setDraft(e.currentTarget.value);
            onChange(e.currentTarget.value);
          }}
          placeholder="나만 볼 수 있는 메모입니다. 입력하면 자동으로 저장돼요."
          className={cn(
            'min-h-0 flex-1 resize-none rounded-lg border p-3 text-[13px] leading-relaxed outline-none transition-colors',
            isDark
              ? 'border-slate-700 bg-slate-900/60 text-slate-100 placeholder:text-slate-500'
              : useCustomAccent
                ? 'border-[rgba(var(--color-brand-dark-rgb),0.25)] bg-[rgba(var(--color-brand-dark-rgb),0.04)] text-slate-900 placeholder:text-slate-400 focus:border-[var(--color-brand-dark)]'
                : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400',
          )}
        />
      </div>
    </div>
  );
}

export default memo(NotepadPanel);
