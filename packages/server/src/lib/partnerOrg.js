/**
 * 거래처 조직/사원 조회.
 * 스키마: DEPT_TREE_V, HR_EMPLOYEE_MASTER, HR_EMPLOYEE_INFO, HR_EMPLOYEE_APPOINTMENT
 */
import { getPartnerOrgSource, getPartnerPool, sql } from './partnerMssql.js';
import { fetchHrTitleMap, pickEmployeeJobTitle } from './partnerHrTitles.js';

const WORK_STATE_ACTIVE = process.env.PARTNER_WORK_STATE_ACTIVE || 'hr009100';

/** @typedef {{ deptCode: string, deptName: string, upDept: string | null, level: number, businessCode: string | null }} PartnerDept */
/** @typedef {{ masterId: string, empNo: string | null, name: string, email: string | null, phone: string | null, deptCode: string | null, positionCode: string | null, dutyCode: string | null }} PartnerEmployee */

/** IP 열리기 전 로컬 검증용 목 데이터 */
export function getMockPartnerOrg() {
  /** @type {PartnerDept[]} */
  const departments = [
    { deptCode: 'ROOT', deptName: '본사', upDept: null, level: 1, businessCode: 'BS01' },
    { deptCode: 'DEV', deptName: '개발본부', upDept: 'ROOT', level: 2, businessCode: 'BS01' },
    { deptCode: 'DEV1', deptName: '플랫폼팀', upDept: 'DEV', level: 3, businessCode: 'BS01' },
    { deptCode: 'SALES', deptName: '영업본부', upDept: 'ROOT', level: 2, businessCode: 'BS01' },
  ];
  /** @type {PartnerEmployee[]} */
  const employees = [
    {
      masterId: '1001',
      empNo: 'E1001',
      name: '김파트너',
      email: 'partner1@example.com',
      phone: '010-1111-1111',
      deptCode: 'DEV1',
      positionCode: 'hr001100',
      dutyCode: null,
    },
    {
      masterId: '1002',
      empNo: 'E1002',
      name: '이영업',
      email: 'partner2@example.com',
      phone: '010-2222-2222',
      deptCode: 'SALES',
      positionCode: 'hr001200',
      dutyCode: null,
    },
  ];
  return { departments, employees, source: 'mock' };
}

/**
 * 오늘(yyyyMMdd) 문자열.
 * @param {Date} [now]
 */
export function yyyymmdd(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function fetchDepartmentsFromMssql(pool) {
  const result = await pool.request().query(`
    SELECT
      DEPT_CD   AS deptCode,
      DEPT_NM   AS deptName,
      UP_DEPT   AS upDept,
      LV        AS level,
      BS_CD     AS businessCode
    FROM DEPT_TREE_V
    ORDER BY LV ASC, DEPT_CD ASC
  `);
  return (result.recordset || []).map((r) => ({
    deptCode: String(r.deptCode || '').trim(),
    deptName: String(r.deptName || '').trim() || String(r.deptCode || '').trim(),
    upDept: r.upDept == null || String(r.upDept).trim() === '' ? null : String(r.upDept).trim(),
    level: Number(r.level) || 1,
    businessCode: r.businessCode == null ? null : String(r.businessCode).trim(),
  })).filter((d) => d.deptCode);
}

/**
 * 재직 + 현재 발령 1건 기준 사원.
 * dbo.hr_date_appointment_id 가 없으면 최신 승인 발령으로 폴백.
 */
async function fetchEmployeesFromMssql(pool, asOf = yyyymmdd()) {
  const req = pool.request();
  req.input('asOf', sql.VarChar(8), asOf);
  req.input('workState', sql.VarChar(32), WORK_STATE_ACTIVE);

  let result;
  try {
    result = await req.query(`
      SELECT
        m.hr_employee_master_id AS masterId,
        m.emp_no                AS empNo,
        m.emp_name              AS name,
        i.email                 AS email,
        i.celephone             AS phone,
        a.hr_department_code    AS deptCode,
        a.position_code         AS positionCode,
        a.duty_code             AS dutyCode,
        a.rank_code             AS rankCode
      FROM HR_EMPLOYEE_MASTER m
      INNER JOIN HR_EMPLOYEE_APPOINTMENT a
        ON a.hr_employee_appointment_id = dbo.hr_date_appointment_id(m.hr_employee_master_id, @asOf)
      LEFT JOIN HR_EMPLOYEE_INFO i
        ON i.hr_employee_master_id = m.hr_employee_master_id
      WHERE m.retire_date IS NULL
        AND a.work_state_code = @workState
        AND a.approve_yn = 1
    `);
  } catch (err) {
    // 함수 미존재 등 → 최신 승인 발령 폴백
    console.warn('[partnerOrg] hr_date_appointment_id failed, fallback to latest appointment:', err?.message || err);
    const req2 = pool.request();
    req2.input('workState', sql.VarChar(32), WORK_STATE_ACTIVE);
    result = await req2.query(`
      SELECT
        m.hr_employee_master_id AS masterId,
        m.emp_no                AS empNo,
        m.emp_name              AS name,
        i.email                 AS email,
        i.celephone             AS phone,
        a.hr_department_code    AS deptCode,
        a.position_code         AS positionCode,
        a.duty_code             AS dutyCode,
        a.rank_code             AS rankCode
      FROM HR_EMPLOYEE_MASTER m
      CROSS APPLY (
        SELECT TOP 1 *
        FROM HR_EMPLOYEE_APPOINTMENT ax
        WHERE ax.hr_employee_master_id = m.hr_employee_master_id
          AND ax.approve_yn = 1
        ORDER BY ax.appointment_date DESC, ax.hr_employee_appointment_id DESC
      ) a
      LEFT JOIN HR_EMPLOYEE_INFO i
        ON i.hr_employee_master_id = m.hr_employee_master_id
      WHERE m.retire_date IS NULL
        AND a.work_state_code = @workState
    `);
  }

  return (result.recordset || []).map((r) => {
    const positionCode = r.positionCode == null || String(r.positionCode).trim() === '' ? null : String(r.positionCode).trim();
    const dutyCode = r.dutyCode == null || String(r.dutyCode).trim() === '' ? null : String(r.dutyCode).trim();
    const rankCode = r.rankCode == null || String(r.rankCode).trim() === '' ? null : String(r.rankCode).trim();
    return {
      masterId: String(r.masterId),
      empNo: r.empNo == null ? null : String(r.empNo).trim(),
      name: String(r.name || '').trim() || String(r.empNo || r.masterId),
      email: r.email == null || String(r.email).trim() === '' ? null : String(r.email).trim().toLowerCase(),
      phone: r.phone == null || String(r.phone).trim() === '' ? null : String(r.phone).trim(),
      deptCode: r.deptCode == null || String(r.deptCode).trim() === '' ? null : String(r.deptCode).trim(),
      positionCode,
      dutyCode,
      rankCode,
      jobTitle: null,
    };
  });
}

/**
 * @returns {Promise<{ departments: PartnerDept[], employees: PartnerEmployee[], source: string }>}
 */
export async function fetchPartnerOrg() {
  const source = getPartnerOrgSource();
  if (source === 'off') {
    throw new Error('PARTNER_ORG_SOURCE=off');
  }
  if (source === 'mock') {
    return getMockPartnerOrg();
  }

  const pool = await getPartnerPool();
  const [departments, employees, titleMap] = await Promise.all([
    fetchDepartmentsFromMssql(pool),
    fetchEmployeesFromMssql(pool),
    fetchHrTitleMap(pool),
  ]);
  return {
    departments,
    employees: employees.map((e) => ({
      ...e,
      jobTitle: pickEmployeeJobTitle(e, titleMap),
    })),
    source: 'mssql',
  };
}
