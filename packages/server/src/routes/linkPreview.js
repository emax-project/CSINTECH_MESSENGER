import { Router } from 'express';
import { verifySessionToken } from '../auth.js';
import { safeFetch } from '../lib/ssrfGuard.js';

const LINK_PREVIEW_TIMEOUT_MS = 10000;
const LINK_PREVIEW_MAX_BYTES = 2 * 1024 * 1024; // 2MB (메타가 뒤에 있는 페이지 대비)

function isValidHttpUrl(s) {
  if (typeof s !== 'string' || !s.trim()) return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractOgMeta(html) {
  const result = { title: null, description: null, imageUrl: null };
  if (!html || typeof html !== 'string') return result;

  // 1) 표준: property="og:xxx" content="..." (줄바꿈 허용)
  const re = /<meta[\s\S]*?(?:property|name)=["'](?:og:|twitter:)(title|description|image)["'][\s\S]*?content=["']([^"']*)["'][\s\S]*?\/?>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const key = m[1].toLowerCase();
    const val = (m[2] || '').trim();
    if (key === 'title' && !result.title) result.title = val;
    else if (key === 'description' && !result.description) result.description = val;
    else if (key === 'image' && !result.imageUrl) result.imageUrl = val;
  }
  // 2) content 먼저 나오는 경우
  const re2 = /<meta[\s\S]*?content=["']([^"']*)["'][\s\S]*?(?:property|name)=["'](?:og:|twitter:)(title|description|image)["'][\s\S]*?\/?>/gi;
  while ((m = re2.exec(html)) !== null) {
    const key = m[2].toLowerCase();
    const val = (m[1] || '').trim();
    if (key === 'title' && !result.title) result.title = val;
    else if (key === 'description' && !result.description) result.description = val;
    else if (key === 'image' && !result.imageUrl) result.imageUrl = val;
  }
  // 3) 단일 따옴표
  const re3 = /<meta[\s\S]*?(?:property|name)=['](?:og:|twitter:)(title|description|image)['][\s\S]*?content=[']([^']*)['][\s\S]*?\/?>/gi;
  while ((m = re3.exec(html)) !== null) {
    const key = m[1].toLowerCase();
    const val = (m[2] || '').trim();
    if (key === 'title' && !result.title) result.title = val;
    else if (key === 'description' && !result.description) result.description = val;
    else if (key === 'image' && !result.imageUrl) result.imageUrl = val;
  }
  // 4) meta 조각 단위로 검사 (티스토리 등 속성 순서/공백 다양)
  const metaBlocks = html.split(/<meta\s+/i);
  for (let i = 1; i < metaBlocks.length; i++) {
    const block = metaBlocks[i];
    const hasImage = /(?:property|name)=["'](?:og:|twitter:)(?:image)["']/i.test(block) || /(?:og:|twitter:)image/i.test(block);
    if (hasImage && !result.imageUrl) {
      const contentMatch = block.match(/content=["']([^"']+)["']/);
      if (contentMatch) result.imageUrl = contentMatch[1].trim();
    }
    const hasTitle = /(?:property|name)=["'](?:og:|twitter:)(?:title)["']/i.test(block);
    if (hasTitle && !result.title) {
      const contentMatch = block.match(/content=["']([^"']+)["']/);
      if (contentMatch) result.title = contentMatch[1].trim();
    }
    const hasDesc = /(?:property|name)=["'](?:og:|twitter:)(?:description)["']/i.test(block);
    if (hasDesc && !result.description) {
      const contentMatch = block.match(/content=["']([^"']+)["']/);
      if (contentMatch) result.description = contentMatch[1].trim();
    }
  }
  // Fallback: <title>
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim();
  }
  return result;
}

export function linkPreviewRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
    const payload = await verifySessionToken(token);
    if (!payload) return res.status(401).json({ error: '유효하지 않은 세션입니다.' });

    const url = (req.query.url || '').toString().trim();
    if (!isValidHttpUrl(url)) return res.status(400).json({ error: '유효한 URL을 입력해 주세요.' });

    let controller;
    try {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), LINK_PREVIEW_TIMEOUT_MS);
      const response = await safeFetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'CSIN-Tech-LinkPreview/1.0 (com.csintech.message)' },
      });
      clearTimeout(timeout);
      if (!response.ok) {
        return res.status(502).json({ error: '링크 정보를 가져올 수 없습니다.' });
      }
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('text/html')) {
        return res.status(400).json({ error: 'HTML 페이지만 미리보기할 수 있습니다.' });
      }
      const buf = await response.arrayBuffer();
      if (buf.byteLength > LINK_PREVIEW_MAX_BYTES) {
        return res.status(413).json({ error: '페이지가 너무 큽니다.' });
      }
      const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      const meta = extractOgMeta(html);
      let imageUrl = meta.imageUrl || null;
      if (imageUrl) {
        try {
          const base = new URL(url);
          if (imageUrl.startsWith('//')) imageUrl = base.protocol + imageUrl;
          else if (imageUrl.startsWith('/')) imageUrl = base.origin + imageUrl;
        } catch {
          // keep as-is
        }
      }
      return res.json({
        url,
        title: meta.title || null,
        description: meta.description || null,
        imageUrl,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: '요청 시간이 초과되었습니다.' });
      }
      return res.status(502).json({ error: '링크 정보를 가져올 수 없습니다.' });
    }
  });

  // 썸네일 이미지 프록시 (외부 이미지가 차단돼도 우리 서버 경유로 표시)
  const IMAGE_TIMEOUT_MS = 5000;
  const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2MB
  router.get('/image', async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).end();
    const payload = await verifySessionToken(token);
    if (!payload) return res.status(401).end();

    const imageUrl = (req.query.imageUrl || '').toString().trim();
    if (!isValidHttpUrl(imageUrl)) return res.status(400).end();
    const referer = (req.query.referer || '').toString().trim();
    const fetchHeaders = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
    if (referer && isValidHttpUrl(referer)) fetchHeaders.Referer = referer;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
      const response = await safeFetch(imageUrl, {
        signal: controller.signal,
        headers: fetchHeaders,
      });
      clearTimeout(timeout);
      if (!response.ok) return res.status(502).end();
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const isImage = contentType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(imageUrl);
      if (!isImage) return res.status(400).end();
      const buf = await response.arrayBuffer();
      if (buf.byteLength > IMAGE_MAX_BYTES) return res.status(413).end();
      res.set('Cache-Control', 'public, max-age=3600');
      const mime = contentType.startsWith('image/') ? contentType.split(';')[0].trim() : 'image/jpeg';
      res.type(mime);
      res.end(Buffer.from(buf));
    } catch (err) {
      if (err.name === 'AbortError') return res.status(504).end();
      return res.status(502).end();
    }
  });

  return router;
}
