import { describe, expect, it } from 'vitest';
import type { OrgDepartment } from '../api';
import { filterDepartments, pruneEmptyDepartments } from './orgTree';

const user = (id: string, name: string) => ({ id, name }) as never;
const dept = (id: string, name: string, users: unknown[] = [], children: OrgDepartment[] = []) =>
  ({ id, name, users, children }) as unknown as OrgDepartment;

describe('pruneEmptyDepartments', () => {
  it('인원이 없는 부서는 뺀다', () => {
    const tree = [dept('a', '빈부서'), dept('b', '있는부서', [user('1', '홍길동')])];
    expect(pruneEmptyDepartments(tree).map((d) => d.name)).toEqual(['있는부서']);
  });

  it('하위 부서에 사람이 있으면 상위 부서는 유지한다', () => {
    const tree = [dept('a', '본부', [], [dept('b', '팀', [user('1', '홍길동')])])];
    const out = pruneEmptyDepartments(tree);
    expect(out).toHaveLength(1);
    expect(out[0].children).toHaveLength(1);
  });

  it('하위 부서가 모두 비어 있으면 상위 부서도 뺀다', () => {
    const tree = [dept('a', '본부', [], [dept('b', '팀')])];
    expect(pruneEmptyDepartments(tree)).toEqual([]);
  });
});

describe('filterDepartments (부서 이름 검색)', () => {
  const tree = [
    dept('a', '관리본부', [user('1', '가')]),
    dept('b', '업무지원실', [user('2', '나')], [dept('c', '하위팀', [user('3', '다')])]),
  ];
  const keepDept = (d: { name?: string }) => !!d.name?.includes('업무지원실');

  it('이름이 맞은 부서만 남기고 하위 부서까지 유지한다', () => {
    const out = filterDepartments(tree, () => false, keepDept);
    expect(out.map((d) => d.name)).toEqual(['업무지원실']);
    expect(out[0].children.map((d) => d.name)).toEqual(['하위팀']);
    expect(out[0].children[0].users).toHaveLength(1);
  });
});
