import { Router } from 'express';
import { prisma } from '../db.js';
import { internalSyncLimiter } from '../lib/authRateLimit.js';
import { sharedKeyMatches } from '../lib/ssoToken.js';
import { diffAffiliations, normalizeAffiliationRequest } from '../lib/affiliationSync.js';

/**
 * 서비스-투-서비스 내부 API — 그룹웨어 서버가 호출한다(사용자 세션과 무관).
 * 인증: 헤더 x-internal-secret = 환경변수 INTEGRATION_SHARED_SECRET (그룹웨어와 같은 값).
 * 규격: docs/groupware-affiliations.md
 */
export const internalRouter = Router();

const PLACEHOLDER_SECRETS = new Set(['change-me', 'changeme', 'change_me', 'CHANGE_ME', 'CHANGE_ME_openssl_rand_hex_32']);

function requireIntegrationSecret(req, res, next) {
  const secret = (process.env.INTEGRATION_SHARED_SECRET || '').trim();
  // 미설정이거나 예시 값 그대로면 연동을 꺼 둔다(fail-closed)
  if (!secret || PLACEHOLDER_SECRETS.has(secret)) {
    return res.status(503).json({ ok: false, error: 'integration disabled' });
  }
  if (!sharedKeyMatches(String(req.get('x-internal-secret') || ''), secret)) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  return next();
}

internalRouter.use(internalSyncLimiter, requireIntegrationSecret);

/**
 * 법인 이름 + 부서 이름(또는 '본부 > 팀' 경로)으로 메신저 부서를 찾는다.
 * @returns {Promise<{ id: string } | { error: 'COMPANY_NOT_FOUND' | 'DEPARTMENT_NOT_FOUND' | 'DEPARTMENT_AMBIGUOUS' }>}
 */
async function findDepartment(companyName, departmentName, createMissing) {
  let company = await prisma.company.findFirst({
    where: { name: { equals: companyName, mode: 'insensitive' } },
  });
  if (!company) {
    if (!createMissing) return { error: 'COMPANY_NOT_FOUND' };
    company = await prisma.company.create({ data: { name: companyName } });
  }

  const segments = departmentName.split('>').map((v) => v.trim()).filter(Boolean);
  if (segments.length === 0) return { error: 'DEPARTMENT_NOT_FOUND' };

  // 이름만 오면(경로 없음) 법인 안 어느 단계에 있든 이름으로 찾는다. 같은 이름이 둘 이상이면 모호하므로 건너뛴다.
  if (segments.length === 1) {
    const matches = await prisma.department.findMany({
      where: { companyId: company.id, name: { equals: segments[0], mode: 'insensitive' } },
      select: { id: true },
      take: 2,
    });
    if (matches.length === 1) return { id: matches[0].id };
    if (matches.length > 1) return { error: 'DEPARTMENT_AMBIGUOUS' };
    if (!createMissing) return { error: 'DEPARTMENT_NOT_FOUND' };
    const created = await prisma.department.create({ data: { name: segments[0], companyId: company.id, parentId: null } });
    return { id: created.id };
  }

  let parentId = null;
  let department = null;
  for (const segment of segments) {
    department = await prisma.department.findFirst({
      where: { companyId: company.id, parentId, name: { equals: segment, mode: 'insensitive' } },
    });
    if (!department) {
      if (!createMissing) return { error: 'DEPARTMENT_NOT_FOUND' };
      department = await prisma.department.create({ data: { name: segment, companyId: company.id, parentId } });
    }
    parentId = department.id;
  }
  return { id: department.id };
}

/**
 * POST /internal/users/affiliations — 사용자별 겸직(소속 부서 목록)을 맞춘다.
 * body: { users: [{ email, affiliations: [{ companyName, departmentName }] }], replace?: boolean, createMissing?: boolean }
 *  - replace(기본 true): 보내지 않은 겸직은 지운다. 직속 부서와, 못 찾은 부서가 섞인 사용자는 지우지 않는다.
 *  - createMissing(기본 false): 메신저에 없는 법인·부서를 새로 만든다.
 */
internalRouter.post('/users/affiliations', async (req, res) => {
  try {
    const { users, errors, fatal } = normalizeAffiliationRequest(req.body);
    if (fatal) return res.status(400).json({ ok: false, error: fatal });
    const replace = req.body?.replace !== false;
    const createMissing = req.body?.createMissing === true;

    const deptCache = new Map();
    const resolve = async (companyName, departmentName) => {
      const key = `${companyName.toLowerCase()}::${departmentName.toLowerCase()}`;
      if (!deptCache.has(key)) deptCache.set(key, await findDepartment(companyName, departmentName, createMissing));
      return deptCache.get(key);
    };

    const result = { ok: true, updated: 0, unchanged: 0, added: 0, removed: 0, notFound: [], unresolved: [], invalid: errors };

    for (const item of users) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: item.email },
          select: { id: true, departmentId: true, affiliations: { select: { departmentId: true } } },
        });
        if (!user) {
          result.notFound.push(item.email);
          continue;
        }

        const desiredIds = [];
        let allResolved = true;
        for (const a of item.affiliations) {
          const found = await resolve(a.companyName, a.departmentName);
          if ('id' in found) {
            desiredIds.push(found.id);
          } else {
            allResolved = false;
            result.unresolved.push({ email: item.email, companyName: a.companyName, departmentName: a.departmentName, reason: found.error });
          }
        }

        const { toAdd, toRemove } = diffAffiliations(
          user.affiliations.map((r) => r.departmentId),
          desiredIds,
          user.departmentId,
          allResolved,
          replace,
        );
        if (toAdd.length === 0 && toRemove.length === 0) {
          result.unchanged += 1;
          continue;
        }
        await prisma.$transaction([
          ...toAdd.map((departmentId) => prisma.userAffiliation.upsert({
            where: { userId_departmentId: { userId: user.id, departmentId } },
            create: { userId: user.id, departmentId },
            update: {},
          })),
          ...(toRemove.length
            ? [prisma.userAffiliation.deleteMany({ where: { userId: user.id, departmentId: { in: toRemove } } })]
            : []),
        ]);
        result.updated += 1;
        result.added += toAdd.length;
        result.removed += toRemove.length;
      } catch (err) {
        console.error('[internal/affiliations] user failed:', item.email, err);
        result.invalid.push({ email: item.email, reason: 'UPDATE_FAILED' });
      }
    }

    console.log(`[internal] 겸직 동기화: 요청 ${users.length}명, 변경 ${result.updated}, 변경 없음 ${result.unchanged}, 사용자 없음 ${result.notFound.length}, 부서 못 찾음 ${result.unresolved.length}`);
    return res.json(result);
  } catch (err) {
    console.error('[internal/affiliations]', err);
    return res.status(500).json({ ok: false, error: 'affiliation sync failed' });
  }
});
