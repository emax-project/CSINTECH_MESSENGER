import { memo, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  orgApi,
  usersApi,
  type BulkRegisterResult,
  type BulkRegisterUserInput,
  type JobTitleItem,
  type OrgCompany,
} from '../../../api';
import { useAccentStyles } from '../../../hooks/useAccentStyles';
import { cn } from '../../../utils/cn';
import { departmentPaths } from '../../../utils/orgTree';
import UIComboBox from '../../../components/ui/UIComboBox';


const CSV_TEMPLATE =
  'email,name,phone,jobTitle,departmentName,companyName\n' +
  'hong@emax.com,홍길동,010-1234-5678,대리,개발부서,이맥스\n' +
  // 하위 부서는 '>'로 경로를 준다
  'kim@emax.com,김철수,010-2345-6789,과장,IT사업본부 > 프론트파트,이맥스\n';

const FAIL_REASON_LABEL: Record<string, string> = {
  INVALID_EMAIL: '이메일 형식 오류',
  NAME_REQUIRED: '이름 필수',
  PASSWORD_REQUIRED: '비밀번호 필요',
  DUPLICATE_IN_BATCH: '배치 내 중복 이메일',
  EMAIL_EXISTS: '이미 등록된 이메일',
  COMPANY_AND_DEPARTMENT_REQUIRED: '회사·부서 둘 다 필요',
  CREATE_FAILED: '생성 실패',
};

type FormRow = {
  key: string;
  email: string;
  name: string;
  phone: string;
  jobTitle: string;
  companyName: string;
  departmentName: string;
};

type FieldKey = Exclude<keyof FormRow, 'key'>;

type SuggestKey = 'jobTitle' | 'companyName' | 'departmentName';

const FIELDS: {
  field: FieldKey;
  label: string;
  placeholder: string;
  required?: boolean;
  /** 지정하면 입력+선택 콤보박스로 렌더링 */
  suggest?: SuggestKey;
}[] = [
  { field: 'email', label: '이메일', placeholder: 'email@emax.com', required: true },
  { field: 'name', label: '이름', placeholder: '홍길동', required: true },
  { field: 'phone', label: '연락처', placeholder: '010-1234-5678' },
  { field: 'jobTitle', label: '직급', placeholder: '대리', suggest: 'jobTitle' },
  { field: 'companyName', label: '회사', placeholder: '이맥스', suggest: 'companyName' },
  { field: 'departmentName', label: '부서', placeholder: '개발부서 (하위: 본부 > 팀)', suggest: 'departmentName' },
];

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyRow(): FormRow {
  return {
    key: newKey(),
    email: '',
    name: '',
    phone: '',
    jobTitle: '',
    companyName: '이맥스',
    departmentName: '',
  };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function parseUsersCsv(text: string): FormRow[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error('CSV에 헤더와 데이터 행이 필요합니다.');
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => headers.indexOf(name);
  const emailI = idx('email');
  const nameI = idx('name');
  if (emailI < 0 || nameI < 0) {
    throw new Error('CSV 헤더에 email, name 컬럼이 필요합니다.');
  }

  const phoneI = idx('phone');
  const jobI = idx('jobtitle');
  const deptI = idx('departmentname');
  const companyI = idx('companyname');

  const rows: FormRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const email = cols[emailI] ?? '';
    const name = cols[nameI] ?? '';
    if (!email && !name) continue;
    rows.push({
      key: newKey(),
      email,
      name,
      phone: phoneI >= 0 ? (cols[phoneI] ?? '') : '',
      jobTitle: jobI >= 0 ? (cols[jobI] ?? '') : '',
      departmentName: deptI >= 0 ? (cols[deptI] ?? '') : '',
      companyName: companyI >= 0 ? (cols[companyI] ?? '') : '이맥스',
    });
  }
  if (rows.length === 0) {
    throw new Error('유효한 사용자 행이 없습니다.');
  }
  return rows;
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'users-bulk-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type BulkUserRegisterSectionProps = {
  isDark: boolean;
  isNarrowLayout?: boolean;
  /** 탭 안에 들어갈 때: 바깥 카드와 제목을 상위(AdminSection)가 그리므로 생략 */
  embedded?: boolean;
};

function BulkUserRegisterSection({
  isDark,
  isNarrowLayout = false,
  embedded = false,
}: BulkUserRegisterSectionProps) {
  const accent = useAccentStyles(isDark);
  const queryClient = useQueryClient();
  const [defaultPassword, setDefaultPassword] = useState('123456');
  const [rows, setRows] = useState<FormRow[]>(() => [emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkRegisterResult | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // 이미 Main/InviteModal 등에서 쓰는 캐시를 그대로 재사용합니다.
  const { data: orgTree = [] } = useQuery<OrgCompany[]>({
    queryKey: ['org', 'tree'],
    queryFn: orgApi.tree,
  });

  const companyOptions = useMemo(
    () => orgTree.map((c) => c.name).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ko')),
    [orgTree],
  );

  // 직급은 '부서 · 직급' 관리 화면과 같은 출처를 본다.
  // (예전엔 조직도 사용자 값 + 하드코딩 목록에서 만들어서 두 화면이 달라 보였다.)
  const { data: jobTitles = [] } = useQuery<JobTitleItem[]>({
    queryKey: ['org', 'job-titles'],
    queryFn: orgApi.jobTitles,
  });
  const jobTitleOptions = useMemo(() => jobTitles.map((j) => j.name), [jobTitles]);

  /** 회사를 고른 행은 그 회사의 부서만, 아직 안 골랐으면 전체 부서를 제안 */
  const departmentOptionsFor = (companyName: string) => {
    const target = companyName.trim().toLowerCase();
    const scoped = target ? orgTree.filter((c) => c.name.trim().toLowerCase() === target) : orgTree;
    const source = scoped.length > 0 ? scoped : orgTree;
    // 정렬하지 않는다. 조직도가 이미 관리 화면의 순번대로 내려주므로 그 순서를 그대로 쓴다.
    const names = new Set<string>();
    source.forEach((c) => departmentPaths(c.departments).forEach((path) => names.add(path)));
    return Array.from(names);
  };

  const optionsFor = (suggest: SuggestKey, row: FormRow) => {
    if (suggest === 'companyName') return companyOptions;
    if (suggest === 'jobTitle') return jobTitleOptions;
    return departmentOptionsFor(row.companyName);
  };

  const border = isDark ? 'border-slate-600' : 'border-slate-200';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const text = isDark ? 'text-slate-200' : 'text-slate-700';
  const cardBg = isDark ? 'bg-slate-800' : 'bg-white';
  const sectionBg = isDark ? 'bg-slate-700' : 'bg-slate-50';
  const inputCls = cn(
    'w-full rounded-lg border px-3 py-2.5 text-sm outline-none box-border',
    isNarrowLayout && 'min-h-[44px] text-base',
    isDark
      ? 'border-slate-600 bg-slate-900 text-slate-200 placeholder:text-slate-500'
      : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400',
  );

  const updateRow = (key: string, field: keyof FormRow, value: string) => {
    setResult(null);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setResult(null);
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (key: string) => {
    setResult(null);
    setRows((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((r) => r.key !== key)));
  };

  const onPickCsv = async (file: File) => {
    setCsvError(null);
    setResult(null);
    try {
      const text = await file.text();
      const parsed = parseUsersCsv(text);
      setRows(parsed);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'CSV 파싱 실패');
    }
  };

  const toUsers = (): BulkRegisterUserInput[] =>
    rows
      .map((r) => ({
        email: r.email.trim(),
        name: r.name.trim(),
        phone: r.phone.trim() || undefined,
        jobTitle: r.jobTitle.trim() || undefined,
        companyName: r.companyName.trim() || undefined,
        departmentName: r.departmentName.trim() || undefined,
      }))
      .filter((u) => u.email || u.name);

  const onSubmit = async () => {
    const users = toUsers();
    if (users.length === 0) {
      alert('등록할 사용자를 입력해 주세요.');
      return;
    }
    if (!defaultPassword.trim() || defaultPassword.trim().length < 4) {
      alert('기본 비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await usersApi.bulkRegister({
        defaultPassword: defaultPassword.trim(),
        users,
      });
      setResult(res);
      if (res.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['org'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      }
      if (res.failed === 0) {
        setRows([emptyRow()]);
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : '일괄 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const filledCount = toUsers().length;

  const secondaryBtnCls = cn(
    'rounded-lg border px-3.5 py-2.5 text-[13px] font-semibold cursor-pointer',
    isNarrowLayout && 'flex-1 min-h-[44px]',
    isDark
      ? 'border-slate-600 bg-transparent text-slate-200'
      : 'border-slate-200 bg-transparent text-slate-700',
  );

  const primaryBtnCls = cn(
    'border-none rounded-lg bg-gradient-to-br from-brand-light to-brand-dark text-white text-[13px] font-semibold cursor-pointer disabled:opacity-60',
    isNarrowLayout ? 'w-full min-h-[48px] px-4 py-3 text-[15px]' : 'px-4 py-2',
  );

  return (
    <div className={cn('flex flex-col gap-3', !embedded && cn('rounded-[10px] px-3.5 py-3', sectionBg))}>
      <div>
        {!embedded && (
          <h4 className={cn('m-0 text-sm font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>
            사용자 일괄 등록
          </h4>
        )}
        <p className={cn(embedded ? 'mt-0' : 'mt-1', 'mb-0 text-xs leading-relaxed', muted)}>
          {isNarrowLayout
            ? '한 명씩 카드를 채워 등록하세요. 회사·부서가 없으면 자동 생성됩니다.'
            : '직접 입력하거나 CSV로 불러온 뒤 등록합니다. 회사·부서명이 없으면 자동 생성됩니다.'}
        </p>
      </div>

      <div>
        <label className={cn('mb-1 block text-xs', muted)}>기본 비밀번호</label>
        <input
          type="text"
          value={defaultPassword}
          onChange={(e) => setDefaultPassword(e.target.value)}
          placeholder="등록 시 사용할 초기 비밀번호"
          autoComplete="new-password"
          className={cn(inputCls, !isNarrowLayout && 'max-w-[280px]')}
        />
      </div>

      {isNarrowLayout ? (
        <div className="flex flex-col gap-3">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className={cn('rounded-xl border p-3', border, cardBg)}
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <span className={cn('text-[13px] font-semibold', text)}>
                  {row.name.trim() || `사용자 ${index + 1}`}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className={cn(
                      'shrink-0 border-none bg-transparent px-2 py-1 text-xs font-semibold cursor-pointer',
                      isDark ? 'text-red-400' : 'text-red-600',
                    )}
                  >
                    삭제
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {FIELDS.map(({ field, label, placeholder, required, suggest }) => (
                  <div key={field}>
                    <label className={cn('mb-1 block text-[11px] font-medium', muted)}>
                      {label}{required ? ' *' : ''}
                    </label>
                    {suggest ? (
                      <UIComboBox
                        isDark={isDark}
                        value={row[field]}
                        options={optionsFor(suggest, row)}
                        placeholder={placeholder}
                        className={inputCls}
                        onChange={(v) => updateRow(row.key, field, v)}
                      />
                    ) : (
                      <input
                        type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                        inputMode={field === 'email' ? 'email' : field === 'phone' ? 'tel' : undefined}
                        autoCapitalize={field === 'email' ? 'none' : undefined}
                        autoCorrect="off"
                        value={row[field]}
                        placeholder={placeholder}
                        onChange={(e) => updateRow(row.key, field, e.target.value)}
                        className={inputCls}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('max-h-80 overflow-auto rounded-lg border', border)}>
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className={cn('text-left', isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                {FIELDS.map(({ field, label, required }) => (
                  <th key={field} className={cn('px-1.5 py-2 font-semibold', muted)}>
                    {label}{required ? ' *' : ''}
                  </th>
                ))}
                <th className="w-10 px-1.5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className={cn('border-t', border)}>
                  {FIELDS.map(({ field, placeholder, suggest }) => (
                    <td key={field} className="p-1">
                      {suggest ? (
                        <UIComboBox
                          isDark={isDark}
                          value={row[field]}
                          options={optionsFor(suggest, row)}
                          placeholder={placeholder}
                          className={cn(inputCls, 'px-2 py-1.5 pr-5 text-[13px]')}
                          onChange={(v) => updateRow(row.key, field, v)}
                        />
                      ) : (
                        <input
                          type="text"
                          value={row[field]}
                          placeholder={placeholder}
                          onChange={(e) => updateRow(row.key, field, e.target.value)}
                          className={cn(inputCls, 'px-2 py-1.5 text-[13px]')}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      title="행 삭제"
                      onClick={() => removeRow(row.key)}
                      className={cn('border-none bg-transparent p-1 text-base leading-none cursor-pointer', muted)}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={cn('flex flex-wrap gap-2', isNarrowLayout && 'flex-col')}>
        <button type="button" onClick={addRow} className={secondaryBtnCls} style={accent.secondaryStyle}>
          + {isNarrowLayout ? '사람 추가' : '행 추가'}
        </button>

        {!isNarrowLayout && (
          <>
            <button type="button" onClick={downloadTemplate} className={secondaryBtnCls} style={accent.secondaryStyle}>
              CSV 템플릿
            </button>
            <label
              style={accent.secondaryStyle}
              className={cn(
                secondaryBtnCls,
                'inline-flex items-center justify-center',
                isDark ? 'bg-slate-600 border-slate-600' : 'bg-slate-200 border-slate-200',
              )}
            >
              CSV 불러오기
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickCsv(f);
                  e.target.value = '';
                }}
              />
            </label>
          </>
        )}

        {isNarrowLayout && (
          <details className={cn('rounded-lg border px-3 py-2', border)}>
            <summary className={cn('cursor-pointer text-[13px] font-semibold list-none', text)}>
              CSV로 불러오기 (선택)
            </summary>
            <p className={cn('mt-2 mb-2 text-[11px] leading-relaxed', muted)}>
              PC에서 만든 CSV를 가져올 수 있습니다. 모바일에서는 직접 입력이 더 편합니다.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={downloadTemplate} className={secondaryBtnCls} style={accent.secondaryStyle}>
                템플릿
              </button>
              <label
                style={accent.secondaryStyle}
                className={cn(
                  secondaryBtnCls,
                  'inline-flex items-center justify-center',
                  isDark ? 'bg-slate-600 border-slate-600' : 'bg-slate-200 border-slate-200',
                )}
              >
                파일 선택
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickCsv(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </details>
        )}
      </div>

      {csvError && <div className="text-xs text-red-600">{csvError}</div>}

      <button
        type="button"
        className={primaryBtnCls}
        style={accent.primaryStyle}
        disabled={submitting || filledCount === 0}
        onClick={() => void onSubmit()}
      >
        {submitting ? '등록 중...' : `${filledCount}명 등록`}
      </button>

      {result && (
        <div className={cn('text-[13px]', text)}>
          <div className="mb-1.5">
            성공 {result.created}명 · 실패 {result.failed}명
          </div>
          {result.errors.length > 0 && (
            <ul className={cn('m-0 pl-[18px] text-xs', muted)}>
              {result.errors.map((e) => (
                <li key={`${e.row}-${e.email}`}>
                  행 {e.row} ({e.email || '—'}): {FAIL_REASON_LABEL[e.reason] || e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(BulkUserRegisterSection);
