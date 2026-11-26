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

/** 보낸 사람 표시: 이름(mm_fromName)이 있으면 이름, 없으면 주소(mm_fromAddr). */
export function senderLabel(row) {
  const name = String(row.mm_fromName || '').trim();
  if (name) return displayFrom(name);
  return displayFrom(row.mm_fromAddr);
}

/** 소켓으로 보낼 알림 내용. showSubject가 false면 제목은 보내지 않는다. */
export function buildMailPayload(row, showSubject) {
  const subject = String(row.mm_subject || '').trim();
  return {
    mailId: String(row.mm_id),
    from: senderLabel(row),
    subject: showSubject ? (subject.length > SUBJECT_MAX ? `${subject.slice(0, SUBJECT_MAX)}…` : subject) : '',
  };
}

/**
 * 이번에 알릴 행만 고른다.
 * - 이미 알린(또는 시작할 때 이미 있던) 메일(seen)은 제외한다.
 * - 수신자(du_userId)가 없거나 maxAgeSec보다 오래된 메일은 제외한다.
 */
export function pickNewRows(rows, seen, maxAgeSec) {
  return rows.filter((row) => row.du_userId && !seen.has(String(row.mm_id)) && Number(row.age_sec) <= maxAgeSec);
}

/** 조회된 행을 모두 "본 것"으로 기록한다(수신자가 없거나 오래된 행도 다시 보지 않도록). */
export function markSeen(seen, rows, nowMs) {
  for (const row of rows) seen.set(String(row.mm_id), nowMs);
}

/** 조회 구간보다 충분히 오래된 기록은 지워 메모리가 늘지 않게 한다. */
export function pruneSeen(seen, nowMs, ttlMs) {
  for (const [id, at] of seen) {
    if (nowMs - at > ttlMs) seen.delete(id);
  }
}

/** DB 시각 기준 함수. 메일 서버가 UTC로 저장하는 것으로 보고 기본은 utc. 허용 값 외에는 utc. */
export function dbNowFunction(mode) {
  return String(mode || '').trim().toLowerCase() === 'local' ? 'GETDATE()' : 'GETUTCDATE()';
}
