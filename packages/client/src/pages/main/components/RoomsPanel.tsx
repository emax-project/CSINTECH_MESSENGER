import { memo } from 'react';
import UICloseButton from '../../../components/ui/UICloseButton';
import RoomSections, { type RoomSectionsProps } from './RoomSections';
import {
  PanelNoDragWrap,
  PanelTitleRow,
  PanelToolbarRow,
  panelTitleRowBg,
  usePanelNoDrag,
} from '../../../components/PanelDragHeader';
import { cn } from '../../../utils/cn';
import { useThemeStore } from '../../../store';
import { getOrgTheme } from '../../../utils/orgTheme';

type RoomsPanelProps = RoomSectionsProps & {
  panelWrapStyle: (maxWidth: number) => { className: string; style: React.CSSProperties };
  roomSearchQuery: string;
  onRoomSearchQueryChange: (value: string) => void;
};

function RoomsPanel({
  panelWrapStyle,
  roomSearchQuery,
  onRoomSearchQueryChange,
  isDark,
  ...roomSectionsProps
}: RoomsPanelProps) {
  const { noDragClass, noDragStyle } = usePanelNoDrag();
  const wrap = panelWrapStyle(820);
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';
  return (
    <div
      className={cn(wrap.className, isDark ? 'bg-slate-900' : 'bg-white')}
      style={wrap.style}
    >
      <PanelTitleRow
        isDark={isDark}
        title="대화"
        className={useCustomAccent ? undefined : panelTitleRowBg(isDark)}
        style={useCustomAccent ? { background: orgTheme.headerBg } : undefined}
      />

      <PanelToolbarRow isDark={isDark} className={isDark ? 'bg-slate-900/80' : 'bg-white'}>
        <input
          type="text"
          placeholder="대화방 검색"
          aria-label="대화방 검색"
          value={roomSearchQuery}
          onChange={(e) => onRoomSearchQueryChange(e.target.value)}
          className={cn(
            noDragClass,
            'flex-1 px-2.5 py-1.5 border rounded-[6px] text-[13px] outline-none min-w-0 focus-visible:ring-2 focus-visible:ring-brand-dark/20',
            isDark
              ? 'border-slate-600 bg-slate-800 text-slate-200 placeholder:text-slate-500'
              : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400',
          )}
          style={noDragStyle}
        />
        {roomSearchQuery.trim().length > 0 && (
          <PanelNoDragWrap>
            <UICloseButton
              size="sm"
              variant="subtle"
              onClick={() => onRoomSearchQueryChange('')}
              aria-label="검색어 지우기"
              title="검색어 지우기"
            />
          </PanelNoDragWrap>
        )}
      </PanelToolbarRow>

      <RoomSections isDark={isDark} {...roomSectionsProps} />
    </div>
  );
}

export default memo(RoomsPanel);
