/**
 * 감사 조회 조건 해석과 CSV 변환(순수 함수). DB·Express에 의존하지 않아 단독으로 테스트할 수 있다.
 */

export const AUDIT_MAX_RANGE_DAYS = 366;
export const AUDIT_PAGE_DEFAULT = 100;
export const AUDIT_PAGE_MAX = 500;
export const AUDIT_EXPORT_MAX = 50000;

function parseDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 쿼리스트링에서 조회 조건을 꺼내 검증한다. 성공하면 { filter }, 실패하면 { error }.
 * 사용자 또는 대화방 중 하나와 기간(from~to)은 반드시 지정해야 한다(전체 덤프 방지).
 */
export function parseAuditFilter(query) {
  const userId = typeof query.userId === 'string' ? query.userId.trim() : '';
  const roomId = typeof query.roomId === 'string' ? query.roomId.trim() : '';
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (!userId && !roomId) return { error: 'AUDIT_TARGET_REQUIRED' };
  if (!from || !to) return { error: 'AUDIT_PERIOD_REQUIRED' };
  if (to.getTime() < from.getTime()) return { error: 'AUDIT_PERIOD_INVALID' };
  if (to.getTime() - from.getTime() > AUDIT_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    return { error: 'AUDIT_PERIOD_TOO_LONG' };
  }
  return { filter: { userId, roomId, q, from, to } };
}

export function parseAuditLimit(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return AUDIT_PAGE_DEFAULT;
  return Math.min(n, AUDIT_PAGE_MAX);
}

/** 로그에 남길 조회 조건(날짜는 ISO 문자열) */
export function auditParamsForLog(filter, extra = {}) {
  return JSON.stringify({
    userId: filter.userId || undefined,
    roomId: filter.roomId || undefined,
    q: filter.q || undefined,
    from: filter.from.toISOString(),
    to: filter.to.toISOString(),
    ...extra,
  });
}

/** 엑셀에서 수식으로 실행되지 않도록 앞의 = + - @ 를 막고, 쉼표·따옴표·줄바꿈을 CSV 규칙대로 감싼다 */
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const AUDIT_CSV_HEADER = [
  '시각', '대화방', '보낸 사람', '이메일', '내용', '상태', '원본 내용', '파일명', '파일 크기(byte)',
];

export function auditRowToCsv(row) {
  return [
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    row.roomName,
    row.senderName,
    row.senderEmail,
    row.content,
    row.status,
    row.originalContent,
    row.fileName,
    row.fileSize,
  ].map(csvCell).join(',');
}
