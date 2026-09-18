import { useThemeStore } from '../store';
import { getOrgTheme, type OrgThemeId } from '../utils/orgTheme';

/** 사용자 테마를 따르는 버튼과 입력창의 강조색. 기본·다크 테마는 기존 색상을 유지한다. */
export function useAccentStyles(isDark: boolean, themeId?: OrgThemeId) {
  const storedTheme = useThemeStore((s) => s.accentTheme);
  const theme = getOrgTheme(themeId ?? storedTheme);
  const custom = !isDark && theme.id !== 'default';
  return {
    theme,
    custom,
    primaryStyle: custom ? { background: theme.accent } : undefined,
    secondaryStyle: custom
      ? { background: theme.activeBg, color: theme.activeText, borderColor: theme.accent }
      : undefined,
    inputStyle: custom ? { borderColor: theme.accent, outlineColor: theme.accent } : undefined,
  };
}
