import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { roomsApi, type PinnedMessageItem } from '../api';
import { useThemeStore } from '../store';
import UIButton from './ui/UIButton';
import { getThemeTokens } from './ui/themeTokens';
import UIChevron from './ui/UIChevron';
import { getOrgTheme } from '../utils/orgTheme';

type Props = {
  roomId: string;
};

export default function PinnedMessages({ roomId }: Props) {
  const isDark = useThemeStore((s) => s.isDark);
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['rooms', roomId, 'pins'],
    queryFn: () => roomsApi.getPins(roomId),
    enabled: !!roomId,
  });

  const pins = data?.pins ?? [];

  if (pins.length === 0) return null;

  const t = getThemeTokens(isDark);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';
  const accent = useCustomAccent ? orgTheme.accent : t.primary;
  const bgColor = isDark ? 'rgba(91,141,239,0.14)' : 'rgba(var(--color-brand-dark-rgb),0.08)';
  const panelBg = t.bgSurface;
  const cardBg = isDark ? t.bgMuted : t.bgMuted;
  const textColor = t.text;
  const subColor = t.textMuted;
  const borderColor = t.border;

  const handleUnpin = async (messageId: string) => {
    try {
      await roomsApi.unpinMessage(roomId, messageId);
      queryClient.invalidateQueries({ queryKey: ['rooms', roomId, 'pins'] });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      style={{
        borderBottom: `1px solid ${borderColor}`,
        background: bgColor,
        boxShadow: isDark ? 'inset 0 -1px 0 rgba(91,141,239,0.2)' : 'inset 0 -1px 0 rgba(var(--color-brand-dark-rgb),0.12)',
      }}
    >
      <UIButton
        type="button"
        onClick={() => setExpanded(!expanded)}
        variant="ghost"
        style={{
          width: '100%',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: textColor,
          fontWeight: 700,
          borderRadius: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            borderRadius: 4,
            padding: '3px 7px',
            background: t.gradientPrimary,
            color: '#fff',
            lineHeight: 1,
          }}
        >
          중요
        </span>
        <span style={{ fontWeight: 700 }}>고정 메시지</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 999,
            padding: '2px 8px',
            background: accent,
            color: '#ffffff',
          }}
        >
          {pins.length}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.9, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {expanded ? '접기' : '펼치기'}
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <UIChevron open={expanded} size={12} color={subColor} />
          </span>
        </span>
      </UIButton>
      {expanded && (
        <div
          style={{
            padding: '12px 16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: panelBg,
            borderTop: `1px solid ${borderColor}`,
          }}
        >
          {pins.map((p: PinnedMessageItem) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                background: cardBg,
                border: `1px solid ${borderColor}`,
                boxShadow: isDark ? '0 1px 8px rgba(0,0,0,0.18)' : '0 1px 8px rgba(15,23,42,0.06)',
              }}
            >
              <span style={{ marginTop: 2, width: 7, height: 7, borderRadius: '50%', background: accent, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: subColor, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.message.sender.name}
                  </span>
                  <span style={{ fontSize: 11, color: subColor, flexShrink: 0 }}>
                    {new Date(p.message.createdAt).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: textColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'pre-wrap',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.45,
                  }}
                >
                  {p.message.content || '[내용 없음]'}
                </div>
              </div>
              <UIButton
                type="button"
                onClick={() => handleUnpin(p.message.id)}
                variant="ghost"
                size="sm"
                style={{ color: accent, padding: '6px 8px', flexShrink: 0 }}
              >
                해제
              </UIButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
