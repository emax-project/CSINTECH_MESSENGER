import type { OrgCompany, OrgDepartment, OrgUser } from '../api';

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

/** 사람 목록용: 부서·회사 메타가 붙은 사용자. */
export type OrgPerson = OrgUser & {
  companyId: string;
  companyName: string;
  departmentId: string;
  departmentName: string;
  departmentPath: string;
};

/** 조직도를 사람 단위로 편다(같은 사람이 여러 부서면 각각 한 줄). */
export function listOrgPeople(orgTree: OrgCompany[]): OrgPerson[] {
  const out: OrgPerson[] = [];
  for (const company of orgTree ?? []) {
    const walk = (list: OrgDepartment[], pathPrefix: string) => {
      for (const dept of list ?? []) {
        const path = pathPrefix ? `${pathPrefix} > ${dept.name}` : dept.name;
        for (const u of dept.users ?? []) {
          out.push({
            ...u,
            companyId: company.id,
            companyName: company.name,
            departmentId: dept.id,
            departmentName: dept.name,
            departmentPath: path,
          });
        }
        walk(dept.children ?? [], path);
      }
    };
    walk(company.departments ?? [], '');
  }
  return out;
}

/** 필터 칩용 부서 목록(평면, 경로 포함). */
export function listOrgDeptFilters(orgTree: OrgCompany[]): Array<{
  id: string;
  label: string;
  companyId: string;
}> {
  const out: Array<{ id: string; label: string; companyId: string }> = [];
  for (const company of orgTree ?? []) {
    const walk = (list: OrgDepartment[], pathPrefix: string) => {
      for (const dept of list ?? []) {
        const path = pathPrefix ? `${pathPrefix} > ${dept.name}` : dept.name;
        out.push({ id: dept.id, label: path, companyId: company.id });
        walk(dept.children ?? [], path);
      }
    };
    walk(company.departments ?? [], '');
  }
  return out;
}

/**
 * 부서 트리를 검색·필터 조건으로 거른다.
 * 자기 인원이 조건에 맞지 않아도 하위 부서에 남는 사람이 있으면 유지한다.
 * (그러지 않으면 인원이 없는 상위 본부가 사라지면서 하위 부서까지 통째로 없어진다.)
 */
export function filterDepartments(
  departments: OrgDepartment[],
  keepUser: (user: OrgUser) => boolean,
): OrgDepartment[] {
  return (departments ?? [])
    .map((dept) => {
      const children = filterDepartments(dept.children ?? [], keepUser);
      const users = (dept.users ?? []).filter(keepUser);
      return { ...dept, users, children };
    })
    .filter((dept) => dept.users.length > 0 || dept.children.length > 0);
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
