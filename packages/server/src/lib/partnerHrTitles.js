/**
 * 거래처 HR 공통코드 → 직급/직책/직위 이름.
 * COMM_MU_CODE_DETAIL: hr001 직위, hr002 직책, hr003 직급
 */
import { getPartnerOrgSource, getPartnerPool } from './partnerMssql.js';

const HR_CODE_RE = /^hr\d{3}\d+$/i;
const TITLE_TTL_MS = 30 * 60 * 1000;

/** @type {{ at: number, map: Map<string, string> }} */
let cache = { at: 0, map: new Map() };

export function isHrCode(value) {
  return HR_CODE_RE.test(String(value || '').trim());
}

/** 저장된 값이 코드면 이름으로. 맵에 있으면 이름, 없으면 원문(클라이언트에서 한 번 더 처리). */
export function resolveHrTitle(raw, map) {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (map instanceof Map && map.has(v)) return map.get(v);
  if (isHrCode(v) && map instanceof Map && map.size > 0) return null;
  return v;
}

/** 직급(rank) → 직책(duty) → 직위(position) */
export function pickEmployeeJobTitle({ rankCode, dutyCode, positionCode } = {}, map) {
  for (const code of [rankCode, dutyCode, positionCode]) {
    const name = resolveHrTitle(code, map);
    if (name) return name;
  }
  return null;
}

export async function fetchHrTitleMap(pool) {
  const result = await pool.request().query(`
    SELECT CODE_DETAIL, MIN(CODE_NAME) AS CODE_NAME
    FROM COMM_MU_CODE_DETAIL
    WHERE CODE_MASTER IN ('hr001', 'hr002', 'hr003')
      AND CODE_DETAIL IS NOT NULL
      AND CODE_NAME IS NOT NULL
      AND (USE_YN = 1 OR USE_YN IS NULL)
    GROUP BY CODE_DETAIL
  `);
  const map = new Map();
  for (const row of result.recordset || []) {
    const code = String(row.CODE_DETAIL || '').trim();
    const name = String(row.CODE_NAME || '').trim();
    if (code && name) map.set(code, name);
  }
  return map;
}

export async function getHrTitleMap() {
  if (getPartnerOrgSource() !== 'mssql') return cache.map;
  if (cache.map.size > 0 && Date.now() - cache.at < TITLE_TTL_MS) return cache.map;
  const pool = await getPartnerPool();
  const map = await fetchHrTitleMap(pool);
  cache = { at: Date.now(), map };
  return map;
}
