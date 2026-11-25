import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAffiliationRequest, diffAffiliations, MAX_USERS_PER_REQUEST } from './affiliationSync.js';

test('정상 요청은 이메일을 소문자로, 중복 겸직은 하나로 정리한다', () => {
  const r = normalizeAffiliationRequest({
    users: [{ email: ' A@Csin.KR ', affiliations: [
      { companyName: '씨에스인', departmentName: '경영지원부' },
      { companyName: '씨에스인 ', departmentName: '경영지원부' },
      { companyName: '예시컴퍼니', departmentName: '영업팀' },
    ] }],
  });
  assert.equal(r.errors.length, 0);
  assert.equal(r.users[0].email, 'a@csin.kr');
  assert.equal(r.users[0].affiliations.length, 2);
});

test('잘못된 항목은 errors에 모으고 나머지는 처리한다', () => {
  const r = normalizeAffiliationRequest({
    users: [
      { email: 'bad', affiliations: [] },
      { email: 'a@csin.kr', affiliations: [{ companyName: '', departmentName: 'x' }] },
      { email: 'b@csin.kr' },
      { email: 'c@csin.kr', affiliations: [] },
      { email: 'c@csin.kr', affiliations: [] },
    ],
  });
  assert.deepEqual(r.errors.map((e) => e.reason), ['INVALID_EMAIL', 'COMPANY_AND_DEPARTMENT_REQUIRED', 'AFFILIATIONS_REQUIRED', 'DUPLICATE_EMAIL']);
  assert.deepEqual(r.users.map((u) => u.email), ['c@csin.kr']);
});

test('빈 목록·과다 요청은 거부한다', () => {
  assert.equal(normalizeAffiliationRequest({}).fatal, 'USERS_REQUIRED');
  assert.equal(normalizeAffiliationRequest({ users: [] }).fatal, 'USERS_REQUIRED');
  const many = Array.from({ length: MAX_USERS_PER_REQUEST + 1 }, (_, i) => ({ email: `u${i}@x.kr`, affiliations: [] }));
  assert.equal(normalizeAffiliationRequest({ users: many }).fatal, 'TOO_MANY_USERS');
});

test('겸직 추가·삭제 계산 — 직속 부서는 지우지 않는다', () => {
  const d = diffAffiliations(['p', 'old'], ['p', 'new'], 'p', true);
  assert.deepEqual(d.toAdd, ['new']);
  assert.deepEqual(d.toRemove, ['old']);
  const keepPrimary = diffAffiliations(['p'], [], 'p', true);
  assert.deepEqual(keepPrimary.toRemove, []);
});

test('못 찾은 부서가 있으면 삭제하지 않고, replace=false면 추가만 한다', () => {
  assert.deepEqual(diffAffiliations(['old'], ['new'], 'p', false).toRemove, []);
  assert.deepEqual(diffAffiliations(['old'], ['new'], 'p', true, false).toRemove, []);
  assert.deepEqual(diffAffiliations(['old'], ['new'], 'p', true, false).toAdd, ['new']);
});
