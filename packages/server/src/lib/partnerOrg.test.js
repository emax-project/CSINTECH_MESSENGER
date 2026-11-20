import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMockPartnerOrg, yyyymmdd } from './partnerOrg.js';

describe('partnerOrg mock', () => {
  it('returns departments with tree keys', () => {
    const { departments, employees, source } = getMockPartnerOrg();
    assert.equal(source, 'mock');
    assert.ok(departments.length >= 3);
    assert.ok(departments.every((d) => d.deptCode && d.deptName));
    assert.ok(departments.some((d) => d.upDept === null));
    assert.ok(employees.every((e) => e.masterId && e.email));
  });

  it('yyyymmdd format', () => {
    assert.match(yyyymmdd(new Date('2026-08-25T00:00:00Z')), /^\d{8}$/);
  });
});

describe('겸직 발령 유형', () => {
  it('그룹웨어(자동결재선)와 같은 코드를 쓴다', async () => {
    const { MULTI_APPOINTMENT_TYPE, MULTI_RELEASE_TYPE } = await import('./partnerOrg.js');
    assert.equal(MULTI_APPOINTMENT_TYPE, 'hr013310');
    assert.equal(MULTI_RELEASE_TYPE, 'hr013070');
  });
});
