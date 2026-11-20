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

describe('겸직 조회 DB 이름', () => {
  it('기본은 ERP DB(CSIN_DB)', async () => {
    const { multiDeptDbName } = await import('./partnerOrg.js');
    assert.equal(multiDeptDbName({}), 'CSIN_DB');
  });

  it('환경변수로 바꾸거나 끌 수 있다', async () => {
    const { multiDeptDbName } = await import('./partnerOrg.js');
    assert.equal(multiDeptDbName({ PARTNER_MSSQL_MULTI_DB: 'ERP_2' }), 'ERP_2');
    assert.equal(multiDeptDbName({ PARTNER_MSSQL_MULTI_DB: 'off' }), null);
    assert.equal(multiDeptDbName({ PARTNER_MSSQL_MULTI_DB: ' ' }), null);
  });

  it('식별자가 아닌 값은 쿼리에 넣지 않는다', async () => {
    const { multiDeptDbName } = await import('./partnerOrg.js');
    assert.equal(multiDeptDbName({ PARTNER_MSSQL_MULTI_DB: 'X]; DROP TABLE a;--' }), null);
  });
});
