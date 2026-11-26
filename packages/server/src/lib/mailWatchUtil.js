/** 새 메일 알림의 순수 로직(DB·소켓 없이 테스트 가능). */

const SUBJECT_MAX = 120;

/** "홍길동 <hong@x.com>" → "홍길동", 이름이 없으면 주소 그대로, 비어 있으면 '알 수 없음'. */
export function displayFrom(raw) {
  const s = String(raw || '').trim();
  if (!s) return '알 수 없음';
  const m = s.match(/^"?([^"<]*?)"?\s*<([^>]*)>\s*$/);
  if (m) return m[1].trim() || m[2].trim() || '알 수 없음';
  return s;
}

/** 소켓으로 보낼 알림 내용. showSubject가 false면 제목은 보내지 않는다. */
export function buildMailPayload(row, showSubject) {
  const subject = String(row.mn_subject || '').trim();
  return {
    mailId: String(row.mm_id),
    from: displayFrom(row.mn_from),
    subject: showSubject ? (subject.length > SUBJECT_MAX ? `${subject.slice(0, SUBJECT_MAX)}…` : subject) : '',
  };
}

/**
 * 이번에 알릴 행만 고른다. 서버가 오래 꺼져 있다가 켜졌을 때 쏟아지는
 * 오래된 메일(maxAgeSec 초과)과 수신자가 없는 행은 알리지 않는다.
 */
export function pickRowsToNotify(rows, maxAgeSec) {
  return rows.filter((row) => row.du_userId && Number(row.age_sec) <= maxAgeSec);
}

/** DB 시각 기준 함수. 메일 서버가 UTC로 저장하므로 기본은 utc. 허용 값 외에는 utc. */
export function dbNowFunction(mode) {
  return String(mode || '').trim().toLowerCase() === 'local' ? 'GETDATE()' : 'GETUTCDATE()';
}

/**
 * 저장된 기준 번호를 검증한다. 숫자가 아니거나, 테이블이 초기화되어 현재 최대 번호보다
 * 커진 경우에는 현재 최대 번호로 되돌린다(그렇지 않으면 새 메일을 영영 못 읽는다).
 */
export function resolveCursor(saved, maxId) {
  const max = Number.isFinite(Number(maxId)) ? Number(maxId) : 0;
  const n = Number(saved);
  if (saved === null || saved === undefined || saved === '' || !Number.isInteger(n) || n < 0) return max;
  return n > max ? max : n;
}
