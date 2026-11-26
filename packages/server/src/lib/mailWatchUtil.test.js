import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { displayFrom, senderLabel, buildMailPayload, pickNewRows, markSeen, pruneSeen, dbNowFunction } from './mailWatchUtil.js';

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

describe('senderLabel', () => {
  it('prefers the name, then the address', () => {
    assert.equal(senderLabel({ mm_fromName: '김철수', mm_fromAddr: 'c@x.com' }), '김철수');
    assert.equal(senderLabel({ mm_fromName: '', mm_fromAddr: 'c@x.com' }), 'c@x.com');
    assert.equal(senderLabel({}), '알 수 없음');
  });
});

describe('buildMailPayload', () => {
  const row = { mm_id: 'AB-1', mm_fromName: '김철수', mm_fromAddr: 'c@x.com', mm_subject: '회의 자료' };

  it('includes the subject only when allowed', () => {
    assert.deepEqual(buildMailPayload(row, true), { mailId: 'AB-1', from: '김철수', subject: '회의 자료' });
    assert.equal(buildMailPayload(row, false).subject, '');
  });

  it('truncates long subjects', () => {
    const long = buildMailPayload({ ...row, mm_subject: 'a'.repeat(300) }, true).subject;
    assert.equal(long.length, 121);
    assert.ok(long.endsWith('…'));
  });
});

describe('pickNewRows', () => {
  it('drops seen, stale, and recipient-less rows', () => {
    const rows = [
      { mm_id: 'a', du_userId: 'hong', age_sec: 5 },
      { mm_id: 'b', du_userId: 'kim', age_sec: 5000 },
      { mm_id: 'c', du_userId: null, age_sec: 5 },
      { mm_id: 'd', du_userId: 'lee', age_sec: 600 },
      { mm_id: 'e', du_userId: 'lee', age_sec: 5 },
    ];
    const seen = new Map([['e', 1]]);
    assert.deepEqual(pickNewRows(rows, seen, 600).map((r) => r.mm_id), ['a', 'd']);
  });
});

describe('markSeen / pruneSeen', () => {
  it('records rows and prunes old entries', () => {
    const seen = new Map();
    markSeen(seen, [{ mm_id: 'a' }, { mm_id: 'b' }], 1000);
    markSeen(seen, [{ mm_id: 'c' }], 5000);
    pruneSeen(seen, 6000, 2000);
    assert.deepEqual([...seen.keys()], ['c']);
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
