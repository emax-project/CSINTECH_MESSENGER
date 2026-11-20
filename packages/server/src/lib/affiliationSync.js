/**
 * 그룹웨어 → 메신저 겸직 동기화 — 요청 검증과 변경분 계산(DB를 쓰지 않는 순수 함수).
 * 규격: docs/groupware-affiliations.md
 */

export const MAX_USERS_PER_REQUEST = 500;
export const MAX_AFFILIATIONS_PER_USER = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanString(v, max) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

/**
 * 요청 본문을 검증·정리한다.
 * @returns {{ users: Array<{ email: string, affiliations: Array<{ companyName: string, departmentName: string }> }>, errors: Array<{ index: number, reason: string }>, fatal?: string }}
 */
export function normalizeAffiliationRequest(body) {
  const list = Array.isArray(body?.users) ? body.users : null;
  if (!list || list.length === 0) return { users: [], errors: [], fatal: 'USERS_REQUIRED' };
  if (list.length > MAX_USERS_PER_REQUEST) return { users: [], errors: [], fatal: 'TOO_MANY_USERS' };

  const users = [];
  const errors = [];
  const seen = new Set();
  list.forEach((item, index) => {
    const email = cleanString(item?.email, 254).toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      errors.push({ index, reason: 'INVALID_EMAIL' });
      return;
    }
    if (seen.has(email)) {
      errors.push({ index, reason: 'DUPLICATE_EMAIL' });
      return;
    }
    if (!Array.isArray(item?.affiliations)) {
      errors.push({ index, reason: 'AFFILIATIONS_REQUIRED' });
      return;
    }
    if (item.affiliations.length > MAX_AFFILIATIONS_PER_USER) {
      errors.push({ index, reason: 'TOO_MANY_AFFILIATIONS' });
      return;
    }
    const affiliations = [];
    const keys = new Set();
    for (const a of item.affiliations) {
      const companyName = cleanString(a?.companyName, 100);
      const departmentName = cleanString(a?.departmentName, 200);
      if (!companyName || !departmentName) {
        errors.push({ index, reason: 'COMPANY_AND_DEPARTMENT_REQUIRED' });
        return;
      }
      const key = `${companyName.toLowerCase()}::${departmentName.toLowerCase()}`;
      if (keys.has(key)) continue;
      keys.add(key);
      affiliations.push({ companyName, departmentName });
    }
    seen.add(email);
    users.push({ email, affiliations });
  });
  return { users, errors };
}

/**
 * 현재 겸직과 그룹웨어가 보낸 겸직을 비교해 추가·삭제할 부서를 구한다.
 * - 직속 부서(primaryId)는 겸직 표에서도 함께 관리되므로 지우지 않는다.
 * - 보낸 겸직 중 메신저에서 못 찾은 부서가 있으면(allResolved=false) 삭제는 하지 않는다 —
 *   이름이 안 맞아서 기존 겸직이 통째로 지워지는 사고를 막는다.
 * @param {string[]} currentIds 지금 UserAffiliation에 있는 부서 id
 * @param {string[]} desiredIds 그룹웨어가 보낸 겸직 중 메신저에서 찾은 부서 id
 * @param {string | null} primaryId User.departmentId
 * @param {boolean} allResolved 보낸 겸직을 전부 찾았는가
 * @param {boolean} replace false면 추가만 한다
 */
export function diffAffiliations(currentIds, desiredIds, primaryId, allResolved, replace = true) {
  const current = new Set(currentIds.map(String));
  const desired = new Set(desiredIds.map(String));
  const toAdd = [...desired].filter((id) => !current.has(id));
  const toRemove = replace && allResolved
    ? [...current].filter((id) => !desired.has(id) && id !== String(primaryId || ''))
    : [];
  return { toAdd, toRemove };
}
