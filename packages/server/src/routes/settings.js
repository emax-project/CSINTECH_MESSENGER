import { Router } from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../auth.js';
import { assertAdmin } from '../lib/admin.js';
import { isBlockedHostname } from '../lib/ssrfGuard.js';

export const settingsRouter = Router();

const EXTERNAL_SITE_KEY = 'external_site_url';
const GROUPWARE_URL_KEY = 'groupware_url';
const BRAND_NAME_KEY = 'brand_name';
const BRAND_LOGO_URL_KEY = 'brand_logo_url';

// 멀티테넌트 로그인 화면용: 로그인 전(토큰 없음) 상태에서 "이 서버 주소가 어느
// 회사 서버인지" 로고·회사명을 먼저 보여주기 위한 공개(무인증) 엔드포인트.
// authMiddleware가 걸리기 전에 등록해야 한다 — 아래 settingsRouter.use(authMiddleware)
// 이후 등록된 라우트만 인증이 필요하다.
settingsRouter.get('/branding', async (_req, res) => {
  try {
    const [name, logoUrl] = await Promise.all([
      readSettingUrl(BRAND_NAME_KEY),
      readSettingUrl(BRAND_LOGO_URL_KEY),
    ]);
    return res.json({ name: name || '', logoUrl: logoUrl || '' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '브랜드 정보를 불러오지 못했습니다' });
  }
});

settingsRouter.use(authMiddleware);

// 이 값은 클라이언트가 window.open/openExternal로 "열기"만 하는 용도입니다.
// 서버가 이 URL을 직접 fetch/요청하는 기능을 추가할 경우 SSRF가 될 수 있으므로,
// 절대 그대로 서버측 요청에 사용하지 말고 lib/ssrfGuard.js의 safeFetch를 통해서만
// 요청하세요. 아래 사설/루프백/링크로컬 대역 차단은 그 상황을 대비한 방어적 조치이며,
// 현재는 실제로 서버가 이 URL을 요청하지는 않습니다.
function normalizeExternalSiteUrl(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return { url: '' };
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { error: '올바른 주소를 입력해 주세요' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'http:// 또는 https:// 주소만 사용할 수 있습니다' };
  }
  if (isBlockedHostname(parsed.hostname)) {
    return { error: '사용할 수 없는 주소입니다' };
  }
  return { url: parsed.toString() };
}

async function readSettingUrl(key) {
  const row = await prisma.appSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  return row?.value || '';
}

async function writeSettingUrl(key, rawUrl, res) {
  const parsed = normalizeExternalSiteUrl(rawUrl);
  if (parsed.error) {
    res.status(400).json({ error: parsed.error });
    return null;
  }
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: parsed.url },
    update: { value: parsed.url },
  });
  return parsed.url;
}

/** 사이드바 링크 주소 조회 (로그인한 모든 사용자) */
settingsRouter.get('/external-site', async (_req, res) => {
  try {
    const url = await readSettingUrl(EXTERNAL_SITE_KEY);
    return res.json({ url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '링크 설정을 불러오지 못했습니다' });
  }
});

/** 사이드바 링크 주소 저장 (관리자만) */
settingsRouter.put('/external-site', async (req, res) => {
  try {
    if (!(await assertAdmin(req, res))) return;
    const url = await writeSettingUrl(EXTERNAL_SITE_KEY, req.body?.url, res);
    if (url === null) return;
    return res.json({ url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '링크 설정을 저장하지 못했습니다' });
  }
});

/** 그룹웨어 바로가기 주소 조회 (로그인한 모든 사용자) — 사이드바 '그룹웨어'·'메일' 버튼이 씀 */
settingsRouter.get('/groupware-url', async (_req, res) => {
  try {
    const url = await readSettingUrl(GROUPWARE_URL_KEY);
    return res.json({ url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '그룹웨어 주소를 불러오지 못했습니다' });
  }
});

/** 그룹웨어 바로가기 주소 저장 (관리자만) */
settingsRouter.put('/groupware-url', async (req, res) => {
  try {
    if (!(await assertAdmin(req, res))) return;
    const url = await writeSettingUrl(GROUPWARE_URL_KEY, req.body?.url, res);
    if (url === null) return;
    return res.json({ url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '그룹웨어 주소를 저장하지 못했습니다' });
  }
});

/** 로그인 화면·사이드바에 표시할 회사명·로고 저장 (관리자만) */
settingsRouter.put('/branding', async (req, res) => {
  try {
    if (!(await assertAdmin(req, res))) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : '';
    await prisma.appSetting.upsert({
      where: { key: BRAND_NAME_KEY },
      create: { key: BRAND_NAME_KEY, value: name },
      update: { value: name },
    });
    const rawLogoUrl = req.body?.logoUrl;
    if (typeof rawLogoUrl === 'string' && rawLogoUrl.trim()) {
      const logoUrl = await writeSettingUrl(BRAND_LOGO_URL_KEY, rawLogoUrl, res);
      if (logoUrl === null) return;
      return res.json({ name, logoUrl });
    }
    await prisma.appSetting.upsert({
      where: { key: BRAND_LOGO_URL_KEY },
      create: { key: BRAND_LOGO_URL_KEY, value: '' },
      update: { value: '' },
    });
    return res.json({ name, logoUrl: '' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '브랜드 설정을 저장하지 못했습니다' });
  }
});
