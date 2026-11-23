import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clearLock, isLocked, recordFailure } from './loginAttempts.js';

describe('clearLock (관리자 강제 해제)', () => {
  it('연속 실패로 잠긴 계정을 풀고 true를 돌려준다', () => {
    for (let i = 0; i < 5; i += 1) recordFailure('u-clear-1');
    assert.equal(isLocked('u-clear-1'), true);
    assert.equal(clearLock('u-clear-1'), true);
    assert.equal(isLocked('u-clear-1'), false);
  });

  it('2차 인증 잠금(mfa:<id>)도 함께 푼다', () => {
    for (let i = 0; i < 5; i += 1) recordFailure('mfa:u-clear-2');
    assert.equal(isLocked('mfa:u-clear-2'), true);
    assert.equal(clearLock('u-clear-2'), true);
    assert.equal(isLocked('mfa:u-clear-2'), false);
  });

  it('잠금이 없으면 false', () => {
    assert.equal(clearLock('u-clear-none'), false);
  });
});
