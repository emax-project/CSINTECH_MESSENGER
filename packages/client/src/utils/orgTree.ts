import type { OrgCompany, OrgDepartment, OrgUser } from '../api';

/**
 * 직급 표기. 그룹웨어 코드(hr00200004)는 사원/과장처럼 이름으로 바꾼다.
 */
const JOB_TITLE_DISPLAY_OVERRIDES: Record<string, string> = {
  '팀장(대우)': '팀장',
  hr00100001: '회장',
  hr00100002: '부회장',
  hr00100003: '대표이사',
  hr00100004: '부사장',
  hr00100005: '전무이사',
  hr00100006: '상무이사',
  hr00100007: '이사',
  hr00100008: '고문',
  hr00100009: '공장장',
  hr00100010: '사장',
  hr00100011: '이사대우',
  hr00100020: '부장',
  hr00100021: '부장대우',
  hr00100030: '차장',
  hr00100040: '과장',
  hr00100045: '기장',
  hr00100050: '대리',
  hr00100070: '주임',
  hr00100080: '사원',
  hr00100081: '촉탁사원',
  hr00100082: '사원(현장)',
  hr00100083: '사원(사무)',
  hr00100090: '직장',
  hr00100092: '반장',
  hr00100096: '조장',
  hr00200001: '회장',
  hr00200003: '대표이사',
  hr00200004: '사장',
  hr00200005: '전무',
  hr00200006: '상무',
  hr00200007: '이사',
  hr00200008: '본부장',
  hr00200009: '실장',
  hr00200010: '부장',
  hr00200011: '차장',
  hr00200012: '과장',
  hr00200016: '파트장',
  hr00200017: '팀장',
  hr00200018: '팀장',
  hr00200019: '부사장',
  hr00200020: '대리',
  hr00200023: '사원',
  hr00200030: '연구소장',
  hr00200031: '수석연구원',
  hr00200032: '책임연구원',
  hr00200033: '선임연구원',
  hr00200034: '주임연구원',
  hr00200035: '연구원',
  hr00300001: '회장',
  hr00300002: '대표이사',
  hr00300003: '사장',
  hr00300004: '전무',
  hr00300005: '상무',
  hr00300006: '이사',
  hr00300010: '실장',
  hr00300011: '소장',
  hr00300012: '부장',
  hr00300013: '차장',
  hr00300014: '과장',
  hr00300015: '대리',
  hr00300020: '사원',
};

export function formatJobTitle(jobTitle?: string | null): string {
  if (!jobTitle) return '';
  const trimmed = jobTitle.trim();
  if (JOB_TITLE_DISPLAY_OVERRIDES[trimmed]) return JOB_TITLE_DISPLAY_OVERRIDES[trimmed];
  if (/^hr\d{3}\d+$/i.test(trimmed)) return '';
  return trimmed;
}

/**
 * 부서는 parentId로 중첩된 트리다(children).
 * 아래 헬퍼를 쓰지 않고 company.departments만 훑으면 하위 부서 인원이 통째로 빠지므로,
 * "회사 전체"를 대상으로 하는 곳에서는 반드시 이 함수들을 쓴다.
 */

/** 부서 트리를 상위 → 하위 순서의 평면 배열로 편다. */
export function flattenDepartments(departments: OrgDepartment[]): OrgDepartment[] {
  const out: OrgDepartment[] = [];
  const walk = (list: OrgDepartment[]) => {
    list.forEach((d) => {
      out.push(d);
      walk(d.children ?? []);
    });
  };
  walk(departments ?? []);
  return out;
}

/** 회사에 속한 모든 사용자(하위 부서 포함). */
export function companyUsers(company: OrgCompany): OrgUser[] {
  return flattenDepartments(company.departments ?? []).flatMap((d) => d.users ?? []);
}

/** 부서와 그 하위 부서에 속한 모든 사용자. */
export function departmentUsers(department: OrgDepartment): OrgUser[] {
  return flattenDepartments([department]).flatMap((d) => d.users ?? []);
}

/** 조직도 전체의 모든 사용자. */
export function allOrgUsers(orgTree: OrgCompany[]): OrgUser[] {
  return (orgTree ?? []).flatMap(companyUsers);
}

/**
 * 부서 트리를 검색·필터 조건으로 거른다.
 * 자기 인원이 조건에 맞지 않아도 하위 부서에 남는 사람이 있으면 유지한다.
 * keepDept 가 true 인 부서는 이름 매칭 등으로 통째로 유지(인원 필터 완화).
 */
export function filterDepartments(
  departments: OrgDepartment[],
  keepUser: (user: OrgUser) => boolean,
  keepDept?: (dept: OrgDepartment) => boolean,
): OrgDepartment[] {
  return (departments ?? [])
    .map((dept) => {
      const children = filterDepartments(dept.children ?? [], keepUser, keepDept);
      const deptMatched = keepDept?.(dept) === true;
      const users = deptMatched
        ? (dept.users ?? [])
        : (dept.users ?? []).filter(keepUser);
      return { ...dept, users, children };
    })
    .filter((dept) => dept.users.length > 0 || dept.children.length > 0 || keepDept?.(dept) === true);
}

/**
 * 부서 트리를 '본부 > 팀 > 파트' 경로 문자열 목록으로 편다.
 * 서로 다른 본부에 같은 이름의 팀이 있을 수 있으므로,
 * 사용자 등록처럼 부서를 지목해야 하는 곳에서는 이름 대신 경로를 쓴다.
 */
export function departmentPaths(departments: OrgDepartment[]): string[] {
  const out: string[] = [];
  const walk = (list: OrgDepartment[], prefix: string) => {
    (list ?? []).forEach((d) => {
      const path = prefix ? `${prefix} > ${d.name}` : d.name;
      out.push(path);
      walk(d.children ?? [], path);
    });
  };
  walk(departments ?? [], '');
  return out;
}
