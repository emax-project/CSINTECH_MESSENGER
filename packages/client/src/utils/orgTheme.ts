/**
 * 조직도 상단 영역/선택 부서 강조색 테마 (톤다운 파스텔 10종 제안).
 * 'default'는 색상 오버라이드 없이 기존 파란색 브랜드 컬러를 그대로 쓴다
 * ("1) 현 색상 유지" 요건). 다크 모드는 대상에서 제외 — 파스텔 배경은
 * 라이트 모드 전제로 설계되어 있어, 다크 모드에서는 테마 선택과 무관하게
 * 기존 슬레이트 톤을 그대로 사용한다.
 */
export type OrgThemeId =
  | 'default'
  | 'sage'
  | 'dustblue'
  | 'eucalyptus'
  | 'mauve'
  | 'rose'
  | 'olive'
  | 'mistblue'
  | 'warmgray'
  | 'peach'
  | 'deepocean';

export type OrgTheme = {
  id: OrgThemeId;
  label: string;
  /** 상단 영역(제목·탭) 배경색 */
  headerBg: string;
  /** 선택된 팀/부서 배경색 */
  activeBg: string;
  /** 선택된 팀/부서 텍스트색 */
  activeText: string;
  /** 탭 강조/포인트색 */
  accent: string;
};

export const ORG_THEMES: OrgTheme[] = [
  { id: 'default', label: '기본(파란색 유지)', headerBg: '', activeBg: '', activeText: '', accent: '' },
  { id: 'sage', label: '세이지 그린', headerBg: '#F0FDF4', activeBg: '#DCFCE7', activeText: '#166534', accent: '#15803D' },
  { id: 'dustblue', label: '더스트 블루', headerBg: '#F8FAFC', activeBg: '#E0F2FE', activeText: '#0369A1', accent: '#0284C7' },
  { id: 'eucalyptus', label: '유칼립투스 틸', headerBg: '#F0FDFA', activeBg: '#CCFBF1', activeText: '#0F766E', accent: '#0D9488' },
  { id: 'mauve', label: '소프트 모브', headerBg: '#EEF2FF', activeBg: '#E0E7FF', activeText: '#3730A3', accent: '#4F46E5' },
  { id: 'rose', label: '드라이 로즈', headerBg: '#FFF1F2', activeBg: '#FFE4E6', activeText: '#9F1239', accent: '#E11D48' },
  { id: 'olive', label: '올리브 카키', headerBg: '#F7FEE7', activeBg: '#ECFCCB', activeText: '#3F6212', accent: '#65A30D' },
  { id: 'mistblue', label: '미스트 블루그레이', headerBg: '#F1F5F9', activeBg: '#E2E8F0', activeText: '#334155', accent: '#475569' },
  { id: 'warmgray', label: '웜 그레이지', headerBg: '#FAFAF9', activeBg: '#E7E5E4', activeText: '#44403C', accent: '#78716C' },
  { id: 'peach', label: '소프트 피치', headerBg: '#FFFBEB', activeBg: '#FEF3C7', activeText: '#92400E', accent: '#D97706' },
  { id: 'deepocean', label: '딥 오션 스모크', headerBg: '#F0F9FF', activeBg: '#E0F2FE', activeText: '#1E40AF', accent: '#1D4ED8' },
];

export function getOrgTheme(id: string | undefined): OrgTheme {
  return ORG_THEMES.find((t) => t.id === id) ?? ORG_THEMES[0];
}
