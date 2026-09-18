import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isLocked, recordFailure, recordSuccess } from './loginAttempts.js';

describe('loginAttempts', () => {
  it('locks after 5 failures and stays locked until then', () => {
    const uid = `user-${Math.random()}`;
    assert.equal(isLocked(uid), false);
    for (let i = 0; i < 4; i += 1) {
      recordFailure(uid);
      assert.equal(isLocked(uid), false);
    }
    recordFailure(uid); // 5번째 실패 → 잠금
    assert.equal(isLocked(uid), true);
  });

  it('clears the failure count on success', () => {
    const uid = `user-${Math.random()}`;
    recordFailure(uid);
    recordFailure(uid);
    recordSuccess(uid);
    for (let i = 0; i < 4; i += 1) {
      recordFailure(uid);
      assert.equal(isLocked(uid), false);
    }
  });

  it('tracks separate accounts independently', () => {
    const a = `user-${Math.random()}`;
    const b = `user-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) recordFailure(a);
    assert.equal(isLocked(a), true);
    assert.equal(isLocked(b), false);
  });
});
