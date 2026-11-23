import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupwareTicketConfig, safeRedirectPath, requestGroupwareTicket } from './groupwareTicket.js';

describe('groupwareTicketConfig', () => {
  it('시크릿이 없거나 예시 값이면 null', () => {
    assert.equal(groupwareTicketConfig({}), null);
    assert.equal(groupwareTicketConfig({ INTEGRATION_SHARED_SECRET: 'CHANGE_ME_openssl_rand_hex_32' }), null);
  });
  it('주소 기본값과 끝 슬래시 제거', () => {
    assert.equal(groupwareTicketConfig({ INTEGRATION_SHARED_SECRET: 's' }).apiUrl, 'http://host.docker.internal:3101');
    assert.equal(groupwareTicketConfig({ INTEGRATION_SHARED_SECRET: 's', GROUPWARE_API_URL: 'http://x:1/' }).apiUrl, 'http://x:1');
  });
});

describe('safeRedirectPath', () => {
  it('내부 경로만 허용', () => {
    assert.equal(safeRedirectPath('/mail'), '/mail');
    assert.equal(safeRedirectPath('//evil.com'), null);
    assert.equal(safeRedirectPath('https://evil.com'), null);
    assert.equal(safeRedirectPath('/a\\b'), null);
    assert.equal(safeRedirectPath(''), null);
    assert.equal(safeRedirectPath(undefined), null);
  });
});

describe('requestGroupwareTicket', () => {
  const config = { secret: 'sec', apiUrl: 'http://gw' };
  it('헤더·본문을 만들어 티켓을 돌려준다', async () => {
    let seen;
    const fetchImpl = async (url, init) => {
      seen = { url, init };
      return { ok: true, json: async () => ({ ticket: 'T', expiresInMs: 30000 }) };
    };
    const r = await requestGroupwareTicket('42', '/mail', { config, fetchImpl });
    assert.equal(r.ticket, 'T');
    assert.equal(seen.url, 'http://gw/api/sso/ticket');
    assert.equal(seen.init.headers['x-internal-secret'], 'sec');
    assert.deepEqual(JSON.parse(seen.init.body), { commUserId: '42', redirect: '/mail' });
  });
  it('위험한 redirect는 null로 바꿔 보낸다', async () => {
    let body;
    const fetchImpl = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, json: async () => ({ ticket: 'T' }) }; };
    await requestGroupwareTicket('1', 'https://evil.com', { config, fetchImpl });
    assert.equal(body.redirect, null);
  });
  it('HTTP 오류·설정 없음은 던진다', async () => {
    await assert.rejects(requestGroupwareTicket('1', null, { config, fetchImpl: async () => ({ ok: false, status: 503 }) }), /HTTP_503/);
    await assert.rejects(requestGroupwareTicket('1', null, { config: null }), /NOT_CONFIGURED/);
  });
});
