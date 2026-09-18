import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { electronNoDragClass } from './MacElectronDragBar';
import { cn } from '../utils/cn';
import { electronDragStyle, electronNoDragStyle, isMacElectron } from '../utils/electronChrome';

/** 패널 제목 줄 — 모든 패널 동일 높이·패딩 */
export const PANEL_TITLE_ROW =
  'shrink-0 flex items-center justify-between gap-2 h-[52px] min-h-[52px] px-5 border-b';

/** 검색·탭 등 2번째 줄 */
export const PANEL_TOOLBAR_ROW =
  'shrink-0 flex items-center gap-2 h-[48px] min-h-[48px] px-5 border-b';

export function panelHeaderBorder(isDark: boolean) {
  return isDark ? 'border-[#3a3f46]' : 'border-[#dde1e6]';
}

/** 패널 제목 줄 배경 — 조직도·대화 등 공통 톤 */
export function panelTitleRowBg(isDark: boolean) {
  return isDark ? 'bg-slate-800' : 'bg-[#e8ecf2]';
}

type PanelDragHeaderProps = {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** macOS Electron: 패널 상단 드래그 영역 */
export function PanelDragHeader({ className, style, children }: PanelDragHeaderProps) {
  const macDrag = isMacElectron();
  return (
    <div
      className={cn('electron-drag', className)}
      style={{ ...(macDrag ? electronDragStyle : undefined), ...style }}
    >
      {children}
    </div>
  );
}

export function panelTitleClass(isDark: boolean) {
  return cn(
    'm-0 text-base font-bold leading-none pointer-events-none shrink-0 truncate',
    isDark ? 'text-white' : 'text-slate-900',
  );
}

export function usePanelNoDrag() {
  const macDrag = isMacElectron();
  return {
    macDrag,
    noDragClass: macDrag ? electronNoDragClass : undefined,
    noDragStyle: macDrag ? electronNoDragStyle : undefined,
  };
}

const INTERACTIVE_TAGS = new Set(['button', 'input', 'textarea', 'select', 'a', 'label']);

function isInteractiveElement(element: ReactElement) {
  const type = element.type;
  if (typeof type === 'string' && INTERACTIVE_TAGS.has(type)) return true;
  if (element.props.role === 'button') return true;
  return typeof element.props.onClick === 'function';
}

/** drag 영역 안 interactive 요소에 no-drag를 직접 부여 (macOS Electron) */
function applyNoDragToTree(
  node: ReactNode,
  noDragClass?: string,
  noDragStyle?: CSSProperties,
): ReactNode {
  if (!noDragClass) return node;

  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;

    if (isInteractiveElement(child)) {
      return cloneElement(child, {
        className: cn(child.props.className, noDragClass),
        style: { ...child.props.style, ...noDragStyle },
      });
    }

    if (child.props.children) {
      return cloneElement(child, {
        children: applyNoDragToTree(child.props.children, noDragClass, noDragStyle),
      });
    }

    return child;
  });
}

type PanelNoDragWrapProps = {
  children: ReactNode;
  className?: string;
};

export function PanelNoDragWrap({ children, className }: PanelNoDragWrapProps) {
  const { noDragClass, noDragStyle } = usePanelNoDrag();
  return (
    <div className={className}>
      {applyNoDragToTree(children, noDragClass, noDragStyle)}
    </div>
  );
}

type PanelTitleRowProps = {
  isDark: boolean;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function PanelTitleRow({ isDark, title, left, right, compact, className, style }: PanelTitleRowProps) {
  return (
    <div
      className={cn(
        PANEL_TITLE_ROW,
        panelHeaderBorder(isDark),
        compact && 'h-[44px] min-h-[44px]',
        className,
      )}
      style={style}
    >
      {left ? <div className="flex shrink-0 items-center">{left}</div> : null}
      <PanelDragHeader className="flex min-h-0 min-w-0 flex-1 items-center gap-2 self-stretch">
        {title ? <h3 className={panelTitleClass(isDark)}>{title}</h3> : null}
        <span className="min-w-0 flex-1 self-stretch" aria-hidden />
      </PanelDragHeader>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

type PanelToolbarRowProps = {
  isDark: boolean;
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

/** 패널 2번째 줄 (검색·탭) — 클릭 가능해야 하므로 drag 영역 사용 안 함 */
export function PanelToolbarRow({ isDark, children, className, compact }: PanelToolbarRowProps) {
  const { noDragClass, noDragStyle } = usePanelNoDrag();
  return (
    <div
      className={cn(
        PANEL_TOOLBAR_ROW,
        panelHeaderBorder(isDark),
        compact && 'h-[40px] min-h-[40px]',
        className,
      )}
    >
      {applyNoDragToTree(children, noDragClass, noDragStyle)}
    </div>
  );
}

export { electronNoDragClass };
