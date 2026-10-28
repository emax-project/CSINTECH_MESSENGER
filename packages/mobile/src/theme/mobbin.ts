/**
 * Mobbin 디자인 언어 기반 토큰 — 모노크롬(흰 캔버스 + 잉크블랙), 스타디움 필
 * 인터랙션, 그림자 없는 틴트 기반 elevation. 원본은 Saans 가변 폰트(652/456/300)를
 * 쓰지만 상용 폰트라 구할 수 없어, 같은 가변축을 지원하는 Inter로 대체했다
 * (652→700, 456→500, 300→300, 600 그대로).
 */

export const colors = {
  primary: '#141414',
  onPrimary: '#ffffff',
  ink: '#141414',
  inkSoft: '#262626',
  textMuted: '#707070',
  textFaint: '#adadad',
  canvas: '#ffffff',
  canvasSoft: '#f3f3f3',
  field: '#f0f0f0',
  hairlineSoft: '#f0f0f0',
  hairline: '#e0e0e0',
  accent: '#0066ff',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 16,
  md: 24,
  full: 9999,
} as const;

const FONT = {
  light: 'Inter_300Light',
  regular: 'Inter_500Medium', // 456 대체
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold', // 652 대체
};

export const fonts = FONT;

export const typography = {
  heading1: { fontFamily: FONT.bold, fontSize: 56, lineHeight: 56 },
  heading2: { fontFamily: FONT.bold, fontSize: 44, lineHeight: 50 },
  heading3: { fontFamily: FONT.bold, fontSize: 32, lineHeight: 36 },
  heading4: { fontFamily: FONT.bold, fontSize: 24, lineHeight: 30 },
  title: { fontFamily: FONT.semibold, fontSize: 20, lineHeight: 26 },
  bodyLg: { fontFamily: FONT.light, fontSize: 20, lineHeight: 28 },
  body: { fontFamily: FONT.regular, fontSize: 16, lineHeight: 22 },
  bodySm: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 20 },
  link: { fontFamily: FONT.semibold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: FONT.semibold, fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: FONT.regular, fontSize: 12, lineHeight: 16 },
} as const;
