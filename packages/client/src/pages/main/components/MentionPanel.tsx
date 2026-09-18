import { memo } from 'react';
import { PanelTitleRow, panelTitleRowBg } from '../../../components/PanelDragHeader';
import { cn } from '../../../utils/cn';

type MentionMessage = {
  room?: { id?: string; name?: string };
  sender?: { name?: string };
  content?: string;
  createdAt?: string;
};

export type MentionItem = {
  id: string;
  readAt?: string | null;
  message?: MentionMessage;
};

type MentionPanelProps = {
  isDark: boolean;
  mentions: MentionItem[];
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  onSelectMention: (mention: MentionItem) => void | Promise<void>;
  embedded?: boolean;
};

function MentionPanel({
  isDark,
  mentions,
  panelWrapStyle,
  onSelectMention,
  embedded = false,
}: MentionPanelProps) {
  const wrap = panelWrapStyle(760);
  const content = (
    <>
      {mentions.length === 0 ? (
        <div className={cn('p-8 text-center text-sm', isDark ? 'text-[#a7adb4]' : 'text-[#5e6470]')}>대화에서 @멘션 되면 여기에 표시됩니다</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {mentions.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={cn(
                  'px-5 py-3 cursor-pointer flex items-center gap-3 w-full border-none text-left',
                  !m.readAt ? (isDark ? 'bg-[rgba(91,141,239,0.08)]' : 'bg-[rgba(var(--color-brand-dark-rgb),0.04)]') : 'bg-transparent',
                )}
                onClick={() => void onSelectMention(m)}
              >
                {!m.readAt && <span style={{ width: 6, height: 6, borderRadius: 3, background: '#0f172a', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#0f172a' }}>{m.message?.sender?.name || '알 수 없음'}</span>
                    <span style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>{m.message?.room?.name || ''}</span>
                  </div>
                  <div style={{ fontSize: 13, color: isDark ? '#94a3b8' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message?.content || ''}</div>
                  <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 2 }}>{m.message?.createdAt ? new Date(m.message.createdAt).toLocaleString('ko-KR') : ''}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex-1 min-h-0 overflow-auto">{content}</div>;
  }

  return (
    <div className={wrap.className} style={wrap.style}>
      <PanelTitleRow isDark={isDark} title="멘션" className={panelTitleRowBg(isDark)} />
      <div className="flex-1 min-h-0 overflow-auto">{content}</div>
    </div>
  );
}

export default memo(MentionPanel);
