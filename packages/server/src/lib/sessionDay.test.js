import test from 'node:test';
import assert from 'node:assert/strict';
import { startOfTodayKst, isIssuedToday } from './sessionDay.js';

// 2026-11-20 14:00 KST = 2026-11-20 05:00 UTC
const NOW = Date.UTC(2026, 10, 20, 5, 0, 0);
const MIDNIGHT_KST = Date.UTC(2026, 10, 19, 15, 0, 0) / 1000; // 2026-11-20 00:00 KST

test('한국 시간 자정을 기준으로 한다', () => {
  assert.equal(startOfTodayKst(NOW), MIDNIGHT_KST);
});

test('자정 직전·직후 경계', () => {
  assert.equal(isIssuedToday(MIDNIGHT_KST, NOW), true);
  assert.equal(isIssuedToday(MIDNIGHT_KST - 1, NOW), false);
});

test('UTC로는 같은 날이어도 한국 시간으로 전날이면 거부한다', () => {
  // 2026-11-20 08:00 KST 시각(=11-19 23:00 UTC)에 발급, 그리고 지금은 11-20 UTC 05:00
  const issuedYesterdayKst = Date.UTC(2026, 10, 19, 14, 0, 0) / 1000; // 11-19 23:00 KST
  assert.equal(isIssuedToday(issuedYesterdayKst, NOW), false);
});

test('iat가 없으면 거부한다', () => {
  assert.equal(isIssuedToday(undefined, NOW), false);
});
