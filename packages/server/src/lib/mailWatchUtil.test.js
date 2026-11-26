import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { displayFrom, buildMailPayload, pickRowsToNotify, dbNowFunction, resolveCursor } from './mailWatchUtil.js';

describe('displayFrom', () => {
  it('extracts the display name, falls back to the address, and handles empty input', () => {
    assert.equal(displayFrom('홍길동 <hong@x.com>'), '홍길동');
    assert.equal(displayFrom('"Hong Gildong" <hong@x.com>'), 'Hong Gildong');
    assert.equal(displayFrom('<hong@x.com>'), 'hong@x.com');
    assert.equal(displayFrom('hong@x.com'), 'hong@x.com');
    assert.equal(displayFrom('  '), '알 수 없음');
    assert.equal(displayFrom(null), '알 수 없음');
  });
});

describe('buildMailPayload', () => {
  const row = { mm_id: 'AB-1', mn_from: '김철수 <c@x.com>', mn_subject: '회의 자료' };

  it('includes the subject only when allowed', () => {
    assert.deepEqual(buildMailPayload(row, true), { mailId: 'AB-1', from: '김철수', subject: '회의 자료' });
    assert.equal(buildMailPayload(row, false).subject, '');
  });

  it('truncates long subjects', () => {
    const long = buildMailPayload({ ...row, mn_subject: 'a'.repeat(300) }, true).subject;
    assert.equal(long.length, 121);
    assert.ok(long.endsWith('…'));
  });
});

describe('pickRowsToNotify', () => {
  it('drops stale rows and rows without a recipient', () => {
    const rows = [
      { mn_id: 1, du_userId: 'hong', age_sec: 5 },
      { mn_id: 2, du_userId: 'kim', age_sec: 5000 },
      { mn_id: 3, du_userId: null, age_sec: 5 },
      { mn_id: 4, du_userId: 'lee', age_sec: 600 },
    ];
    assert.deepEqual(pickRowsToNotify(rows, 600).map((r) => r.mn_id), [1, 4]);
  });
});

describe('dbNowFunction', () => {
  it('defaults to UTC and only switches to local when asked', () => {
    assert.equal(dbNowFunction(undefined), 'GETUTCDATE()');
    assert.equal(dbNowFunction('utc'), 'GETUTCDATE()');
    assert.equal(dbNowFunction('LOCAL'), 'GETDATE()');
    assert.equal(dbNowFunction("x'; DROP TABLE a;--"), 'GETUTCDATE()');
  });
});

describe('resolveCursor', () => {
  it('starts from the current max, keeps a valid saved cursor, and repairs a reset table', () => {
    assert.equal(resolveCursor(undefined, 19211), 19211);
    assert.equal(resolveCursor(null, 19211), 19211);
    assert.equal(resolveCursor('19000', 19211), 19000);
    assert.equal(resolveCursor('25000', 19211), 19211);
    assert.equal(resolveCursor('abc', 19211), 19211);
    assert.equal(resolveCursor('5', null), 0);
  });
});
