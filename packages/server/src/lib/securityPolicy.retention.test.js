import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY, mergePolicy } from './securityPolicy.js';

test('보관 기간 기본값은 대화·파일 영구, 감사 로그는 기존 180일', () => {
  assert.equal(DEFAULT_POLICY.retention.messageDays, 0);
  assert.equal(DEFAULT_POLICY.retention.fileAuditDays, 180);
  assert.equal(DEFAULT_POLICY.retention.auditAccessDays, 0);
});

test('보관 기간 일부만 바꿔도 나머지는 유지된다', () => {
  const next = mergePolicy(DEFAULT_POLICY, { retention: { messageDays: 365 } });
  assert.equal(next.retention.messageDays, 365);
  assert.equal(next.retention.fileAuditDays, 180);
});

test('음수·소수·범위 초과 보관 기간은 거부한다', () => {
  for (const bad of [-1, 1.5, 36501, 'abc']) {
    assert.ok(mergePolicy(DEFAULT_POLICY, { retention: { messageDays: bad } }).error, String(bad));
  }
});

test('예전에 저장된 정책(retention 없음)도 기본값으로 채워 읽는다', () => {
  const legacy = { screenLockMinutes: 5, twoFactor: 'optional', maxChatWindows: 0, fileTransfer: DEFAULT_POLICY.fileTransfer };
  assert.equal(mergePolicy(legacy, null).retention.messageDays, 0);
});
