import { useThemeStore } from './store';

export const lightColors = {
  bg: '#f8f9fb',
  bgSecondary: '#ffffff',
  bgTertiary: '#f1f3f8',
  text: '#1a1d26',
  textSecondary: '#4a5068',
  textMuted: '#7c829d',
  textPlaceholder: '#a0a5bc',
  border: '#eceef5',
  accent: '#6366f1',
  accentLight: '#eef2ff',
  accentSoft: '#a5b4fc',
  success: '#10b981',
  danger: '#f43f5e',
  dangerBg: '#fff1f2',
  bubbleMine: '#6366f1',
  bubbleMineTxt: '#fff',
  bubbleOther: '#ffffff',
  bubbleOtherTxt: '#1a1d26',
  inputBg: '#f1f3f8',
  badge: '#f43f5e',
  tabActive: '#007aff',
  tabInactive: '#a0a5bc',
  card: '#ffffff',
  cardBorder: '#eceef5',
  shadow: 'rgba(0,0,0,0.04)',
  statusBar: 'dark' as 'light' | 'dark',
};

export const darkColors = {
  bg: '#0e1117',
  bgSecondary: '#161b26',
  bgTertiary: '#1c2132',
  text: '#e8eaf0',
  textSecondary: '#b0b6cc',
  textMuted: '#7c829d',
  textPlaceholder: '#555b73',
  border: '#262d3e',
  accent: '#818cf8',
  accentLight: 'rgba(129,140,248,0.12)',
  accentSoft: '#6366f1',
  success: '#34d399',
  danger: '#fb7185',
  dangerBg: 'rgba(244,63,94,0.12)',
  bubbleMine: '#6366f1',
  bubbleMineTxt: '#fff',
  bubbleOther: '#1c2132',
  bubbleOtherTxt: '#e8eaf0',
  inputBg: '#1c2132',
  badge: '#f43f5e',
  tabActive: '#818cf8',
  tabInactive: '#555b73',
  card: '#161b26',
  cardBorder: '#262d3e',
  shadow: 'rgba(0,0,0,0.2)',
  statusBar: 'light' as 'light' | 'dark',
};

export type ThemeColors = typeof lightColors;

export function useColors(): ThemeColors {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}
