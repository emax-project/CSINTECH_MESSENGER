import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSsoUrl, buildTicketUrl, openGroupware, openGroupwareWithSso, sameSiteRedirectPath } from './groupware';

describe('buildSsoUrl', () => {
  it('appends sso path and token', () => {
    expect(buildSsoUrl('https://gw.example.com/', '/sso', 'abc')).toBe('https://gw.example.com/sso?token=abc');
  });

  it('adds an encoded next target only when given', () => {
    const url = buildSsoUrl('https://gw.example.com', '/sso', 't', 'https://gw.example.com/mail?x=1');
    expect(url).toBe('https://gw.example.com/sso?token=t&next=https%3A%2F%2Fgw.example.com%2Fmail%3Fx%3D1');
  });
});

describe('openGroupwareWithSso', () => {
  const open = vi.fn();
  beforeEach(() => {
    open.mockReset();
    vi.stubGlobal('window', { open });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens the sso url when enabled', async () => {
    const fetchToken = vi.fn().mockResolvedValue({ token: 'tok' });
    const result = await openGroupwareWithSso('https://gw.example.com', 'https://gw.example.com', { enabled: true, path: '/sso' }, fetchToken);
    expect(result).toBe('sso');
    expect(open).toHaveBeenCalledWith('https://gw.example.com/sso?token=tok', '_blank', 'noopener,noreferrer');
  });

  it('passes the mail url as next when it differs from the groupware url', async () => {
    const fetchToken = vi.fn().mockResolvedValue({ token: 'tok' });
    await openGroupwareWithSso('https://gw.example.com', 'https://gw.example.com/mail', { enabled: true, path: '/sso' }, fetchToken);
    expect(open.mock.calls[0][0]).toContain('next=https%3A%2F%2Fgw.example.com%2Fmail');
  });

  it('opens the plain address when sso is disabled without asking for a token', async () => {
    const fetchToken = vi.fn();
    const result = await openGroupwareWithSso('https://gw.example.com', 'https://gw.example.com', { enabled: false, path: '/sso' }, fetchToken);
    expect(result).toBe('plain');
    expect(fetchToken).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('https://gw.example.com', '_blank', 'noopener,noreferrer');
  });

  it('falls back to the plain address when the token request fails', async () => {
    const fetchToken = vi.fn().mockRejectedValue(new Error('network'));
    const result = await openGroupwareWithSso('https://gw.example.com', 'https://gw.example.com', { enabled: true, path: '/sso' }, fetchToken);
    expect(result).toBe('plain');
    expect(open).toHaveBeenCalledWith('https://gw.example.com', '_blank', 'noopener,noreferrer');
  });

  it('keeps openGroupware behaviour for plain paths', () => {
    openGroupware('https://gw.example.com/', '/mail');
    expect(open).toHaveBeenCalledWith('https://gw.example.com/mail', '_blank', 'noopener,noreferrer');
  });
});

describe('그룹웨어 기존 SSO(티켓)', () => {
  const open = vi.fn();
  beforeEach(() => {
    open.mockReset();
    vi.stubGlobal('window', { open });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('buildTicketUrl은 /sso?ticket= 형태', () => {
    expect(buildTicketUrl('https://gw.example.com/', 'abc')).toBe('https://gw.example.com/sso?ticket=abc');
  });

  it('sameSiteRedirectPath는 같은 사이트 경로만 돌려준다', () => {
    expect(sameSiteRedirectPath('https://gw.example.com', 'https://gw.example.com/mail?x=1')).toBe('/mail?x=1');
    expect(sameSiteRedirectPath('https://gw.example.com', 'https://gw.example.com')).toBeUndefined();
    expect(sameSiteRedirectPath('https://gw.example.com', 'https://other.com/mail')).toBeUndefined();
  });

  it('mode가 ticket이면 티켓 주소로 열고 redirect를 서버에 넘긴다', async () => {
    const fetchToken = vi.fn().mockResolvedValue({ token: 'tk', mode: 'ticket' });
    const result = await openGroupwareWithSso('https://gw.example.com', 'https://gw.example.com/mail', { enabled: true, path: '/sso' }, fetchToken);
    expect(result).toBe('sso');
    expect(fetchToken).toHaveBeenCalledWith('/mail');
    expect(open).toHaveBeenCalledWith('https://gw.example.com/sso?ticket=tk', '_blank', 'noopener,noreferrer');
  });
});
