import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditLogEntry, type AuditQuery, type AuditRow } from '../../../api';
import { useToastStore } from '../../../store';
import { useAccentStyles } from '../../../hooks/useAccentStyles';
import { cn } from '../../../utils/cn';

const STATUS_LABEL: Record<AuditRow['status'], string> = {
  NORMAL: '정상',
  DELETED: '삭제됨',
  EXPIRED: '파일 만료',
  ORPHAN: '계정·대화방 삭제 등',
};
const ACTION_LABEL: Record<AuditLogEntry['action'], string> = {
  SEARCH: '조회',
  EXPORT: '내보내기',
  FILE_DOWNLOAD: '파일 내려받기',
};

function toLocalDayStart(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}
function toLocalDayEnd(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { hour12: false });
}
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type Picked = { id: string; label: string };

/** 감사 조회: 사용자·대화방·기간을 지정해 대화와 첨부 파일(삭제·만료된 원본 포함)을 조회·내보낸다. 모든 조회는 이력에 남는다. */
export default function AuditSection({ isDark }: { isDark: boolean }) {
  const accent = useAccentStyles(isDark);
  const showToast = useToastStore((s) => s.show);

  const [userInput, setUserInput] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [pickedUser, setPickedUser] = useState<Picked | null>(null);
  const [pickedRoom, setPickedRoom] = useState<Picked | null>(null);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState<AuditQuery | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  const { data: userHits } = useQuery({
    queryKey: ['audit', 'users', userInput],
    queryFn: () => auditApi.searchUsers(userInput),
    enabled: userInput.trim().length > 0 && !pickedUser,
  });
  const { data: roomHits } = useQuery({
    queryKey: ['audit', 'rooms', roomInput],
    queryFn: () => auditApi.searchRooms(roomInput),
    enabled: roomInput.trim().length > 0 && !pickedRoom,
  });
  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ['audit', 'logs'],
    queryFn: () => auditApi.logs(50),
    enabled: logsOpen,
  });

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const title = isDark ? 'text-slate-200' : 'text-slate-800';
  const field = {
    padding: '8px 10px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`,
    background: isDark ? '#1e293b' : '#fff',
    color: isDark ? '#e2e8f0' : '#333',
    fontSize: 13,
    boxSizing: 'border-box' as const,
    ...accent.inputStyle,
  };
  const btn = cn(
    'rounded-md border-none px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40',
    isDark ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-white',
  );

  const buildQuery = (): AuditQuery | null => {
    if (!pickedUser && !pickedRoom) {
      showToast('조회할 사용자 또는 대화방을 선택해 주세요', 'error');
      return null;
    }
    if (!from || !to || from > to) {
      showToast('조회 기간을 올바르게 지정해 주세요', 'error');
      return null;
    }
    return {
      userId: pickedUser?.id,
      roomId: pickedRoom?.id,
      from: toLocalDayStart(from),
      to: toLocalDayEnd(to),
      q: keyword.trim() || undefined,
    };
  };

  const search = async () => {
    const q = buildQuery();
    if (!q) return;
    setBusy(true);
    try {
      const r = await auditApi.messages(q);
      setQuery(q);
      setRows(r.rows);
      setNextBefore(r.nextBefore);
      if (r.rows.length === 0) showToast('조건에 맞는 대화가 없습니다', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '조회에 실패했습니다', 'error');
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!query || !nextBefore) return;
    setBusy(true);
    try {
      const r = await auditApi.messages(query, nextBefore);
      setRows((prev) => [...prev, ...r.rows]);
      setNextBefore(r.nextBefore);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '조회에 실패했습니다', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const q = query ?? buildQuery();
    if (!q) return;
    if (!window.confirm('조건에 맞는 대화를 CSV 파일로 내보냅니다.\n내보내기 이력이 기록됩니다.')) return;
    setBusy(true);
    try {
      const { blob, headers } = await auditApi.exportCsv(q);
      saveBlob(blob, `audit-${today()}.csv`);
      showToast(headers.get('X-Audit-Truncated') === '1' ? '최대 건수까지만 내보냈습니다. 기간을 나눠 다시 내보내 주세요' : '내보내기를 완료했습니다', 'success');
      if (logsOpen) void refetchLogs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '내보내기에 실패했습니다', 'error');
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (row: AuditRow) => {
    setBusy(true);
    try {
      const { blob } = await auditApi.downloadFile(row.id);
      saveBlob(blob, row.fileName || 'download');
      if (logsOpen) void refetchLogs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '파일을 받지 못했습니다', 'error');
    } finally {
      setBusy(false);
    }
  };

  const picker = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    picked: Picked | null,
    setPicked: (p: Picked | null) => void,
    hits: Picked[],
    placeholder: string,
  ) => (
    <div className="flex flex-col gap-1">
      <span className={cn('text-xs font-semibold', title)}>{label}</span>
      {picked ? (
        <div className="flex items-center gap-2">
          <span className={cn('rounded px-2 py-1 text-xs', isDark ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-800')}>{picked.label}</span>
          <button type="button" className={cn('border-none bg-transparent text-xs cursor-pointer', muted)} onClick={() => { setPicked(null); setValue(''); }}>
            지정 해제
          </button>
        </div>
      ) : (
        <>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} style={field} />
          {value.trim() && hits.length > 0 && (
            <div className={cn('max-h-36 overflow-auto rounded-md border', isDark ? 'border-slate-600' : 'border-slate-200')}>
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setPicked(h)}
                  className={cn('block w-full border-none bg-transparent px-2 py-1.5 text-left text-xs cursor-pointer', isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100')}
                >
                  {h.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={cn('flex flex-col gap-3 rounded-lg px-3 py-2.5', isDark ? 'bg-slate-800' : 'bg-white')}>
      <div>
        <div className={cn('text-[13px] font-semibold', title)}>감사 조회</div>
        <p className={cn('mt-1 mb-0 text-xs leading-relaxed', muted)}>
          사용자(보낸 사람 기준) 또는 대화방과 기간을 지정해 대화·첨부 파일을 조회합니다. 사용자가 삭제하거나 만료되어 사라진 대화도 원본이 표시되며,
          조회·내보내기·파일 내려받기는 모두 이력에 기록됩니다.
        </p>
      </div>

      {picker('사용자', userInput, setUserInput, pickedUser, setPickedUser,
        (userHits?.users ?? []).map((u) => ({ id: u.id, label: `${u.name} (${u.email})` })), '이름 또는 이메일로 검색')}
      {picker('대화방', roomInput, setRoomInput, pickedRoom, setPickedRoom,
        (roomHits?.rooms ?? []).map((r) => ({ id: r.id, label: `${r.name || r.memberNames.join(', ')}${r.isGroup ? ' (그룹)' : ''}` })), '방 이름 또는 참여자 이름으로 검색')}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-semibold', title)}>시작일</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={field} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={cn('text-xs font-semibold', title)}>종료일</span>
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={field} />
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1">
          <span className={cn('text-xs font-semibold', title)}>내용 검색(선택)</span>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="키워드" style={field} />
        </label>
      </div>
      <span className={cn('text-xs', muted)}>기간은 최대 1년까지 지정할 수 있습니다.</span>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={busy} onClick={() => { void search(); }}>조회</button>
        <button type="button" className={btn} disabled={busy} onClick={() => { void exportCsv(); }}>CSV 내보내기</button>
        <button type="button" className={cn('border-none bg-transparent text-xs cursor-pointer', muted)} onClick={() => setLogsOpen((v) => !v)}>
          {logsOpen ? '조회 이력 닫기' : '조회 이력 보기'}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={`${r.id}-${r.status}`} className={cn('rounded-md px-2 py-1.5 text-xs', isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-50 text-slate-700')}>
              <div className={cn('flex flex-wrap gap-x-2', muted)}>
                <span>{formatTime(r.createdAt)}</span>
                <span>{r.roomName || '(이름 없음)'}</span>
                <span>{r.senderName}</span>
                {r.status !== 'NORMAL' && (
                  <span className="rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">{STATUS_LABEL[r.status]}</span>
                )}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap break-words">{r.originalContent ?? r.content}</div>
              {r.status !== 'NORMAL' && r.originalContent !== null && r.originalContent !== r.content && (
                <div className={cn('mt-0.5 text-[11px]', muted)}>화면 표시: {r.content}</div>
              )}
              {r.hasFile && (
                <button type="button" disabled={busy} onClick={() => { void downloadFile(r); }} className={cn('mt-1 border-none bg-transparent p-0 text-[11px] underline cursor-pointer', muted)}>
                  파일 받기: {r.fileName || '첨부 파일'}
                </button>
              )}
            </div>
          ))}
          {nextBefore && (
            <button type="button" className={btn} disabled={busy} onClick={() => { void loadMore(); }}>더 보기</button>
          )}
        </div>
      )}

      {logsOpen && (
        <div className="flex flex-col gap-1">
          <span className={cn('text-xs font-semibold', title)}>조회·내보내기 이력</span>
          {(logs?.logs ?? []).length === 0 && <span className={cn('text-xs', muted)}>이력이 없습니다.</span>}
          {(logs?.logs ?? []).map((l) => (
            <div key={l.id} className={cn('rounded-md px-2 py-1 text-[11px]', isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-600')}>
              {formatTime(l.createdAt)} · {l.userName} · {ACTION_LABEL[l.action]} · {l.resultCount}건
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
