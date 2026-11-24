import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuditFilter, parseAuditLimit, csvCell, auditRowToCsv, AUDIT_PAGE_MAX } from './auditQuery.js';

const ok = { userId: 'u1', from: '2026-11-01T00:00:00Z', to: '2026-11-30T00:00:00Z' };

test('사용자 또는 대화방과 기간이 모두 있어야 한다', () => {
  assert.equal(parseAuditFilter({ from: ok.from, to: ok.to }).error, 'AUDIT_TARGET_REQUIRED');
  assert.equal(parseAuditFilter({ userId: 'u1' }).error, 'AUDIT_PERIOD_REQUIRED');
  assert.equal(parseAuditFilter({ roomId: 'r1', from: ok.from }).error, 'AUDIT_PERIOD_REQUIRED');
  assert.ok(parseAuditFilter(ok).filter);
  assert.ok(parseAuditFilter({ roomId: 'r1', from: ok.from, to: ok.to }).filter);
});

test('기간이 거꾸로이거나 너무 길면 거부한다', () => {
  assert.equal(parseAuditFilter({ userId: 'u1', from: ok.to, to: ok.from }).error, 'AUDIT_PERIOD_INVALID');
  assert.equal(parseAuditFilter({ userId: 'u1', from: '2024-01-01', to: '2026-01-01' }).error, 'AUDIT_PERIOD_TOO_LONG');
  assert.equal(parseAuditFilter({ userId: 'u1', from: 'abc', to: ok.to }).error, 'AUDIT_PERIOD_REQUIRED');
});

test('페이지 크기는 기본 100, 최대 500', () => {
  assert.equal(parseAuditLimit(undefined), 100);
  assert.equal(parseAuditLimit('50'), 50);
  assert.equal(parseAuditLimit('99999'), AUDIT_PAGE_MAX);
  assert.equal(parseAuditLimit('-3'), 100);
});

test('CSV: 쉼표·따옴표·줄바꿈을 감싸고 수식 시작 문자를 막는다', () => {
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('줄\n바꿈'), '"줄\n바꿈"');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(10), '10');
});

test('행 하나를 CSV 한 줄로 만든다', () => {
  const line = auditRowToCsv({
    createdAt: new Date('2026-11-02T01:00:00Z'), roomName: '개발팀', senderName: '홍길동', senderEmail: 'a@b.c',
    content: '[삭제된 메시지]', status: '삭제됨', originalContent: '원본, 내용', fileName: null, fileSize: null,
  });
  assert.equal(line, '2026-11-02T01:00:00.000Z,개발팀,홍길동,a@b.c,[삭제된 메시지],삭제됨,"원본, 내용",,');
});
