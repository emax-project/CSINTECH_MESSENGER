import { useState, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type Project, type TaskItem, type User } from '../api';
import { useThemeStore } from '../store';
import TaskDetailModal from './TaskDetailModal';
import TitleBar from './TitleBar';
import { getThemeTokens } from './ui/themeTokens';

type Props = {
  roomId: string;
  members: User[];
  onClose: () => void;
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

const DAY_WIDTH_DAY = 36;
const DAY_WIDTH_WEEK = 12;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 50;
const LEFT_PANEL_WIDTH = 220;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short' });
}

export default function GanttChart({ roomId, members, onClose }: Props) {
  const isDark = useThemeStore((s) => s.isDark);
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [zoom, setZoom] = useState<'day' | 'week'>('day');
  const timelineRef = useRef<HTMLDivElement>(null);

  const t = getThemeTokens(isDark);
  const bg = t.bgBase;
  const headerBg = isDark ? '#1e293b' : '#475569';
  const panelBg = t.bgSurface;
  const text = t.text;
  const sub = t.textMuted;
  const border = t.border;
  const gridLine = isDark ? '#1e293b' : '#e2e8f0';
  const todayColor = '#ef4444';

  const dayWidth = zoom === 'day' ? DAY_WIDTH_DAY : DAY_WIDTH_WEEK;

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', roomId],
    queryFn: () => projectsApi.list(roomId),
    enabled: !!roomId,
  });

  const project: Project | undefined = projects.find((p) => p.id === selectedProjectId) || projects[0];

  if (project && !selectedProjectId && projects.length > 0) {
    setSelectedProjectId(project.id);
  }

  // 태스크는 프로젝트 목록에 안 실려 온다 — 지금 보고 있는(선택된) 프로젝트 것만 따로 가져온다.
  // 쿼리 키가 ['projects', roomId, ...]로 시작해서 기존 invalidateQueries(['projects', roomId])가
  // 그대로 이 쿼리도 함께 무효화한다.
  const { data: tasks = [] } = useQuery({
    queryKey: ['projects', roomId, project?.id, 'tasks'],
    queryFn: () => projectsApi.tasks(project!.id),
    enabled: !!project?.id,
  });

  // Build rows: board headers + tasks grouped by board
  const rows = useMemo(() => {
    const boards = project?.boards || [];
    const result: Array<{ type: 'board'; name: string; count: number } | { type: 'task'; task: TaskItem }> = [];
    for (const board of boards) {
      const boardTasks = tasks.filter((t) => t.boardId === board.id).sort((a, b) => a.position - b.position);
      result.push({ type: 'board', name: board.name, count: boardTasks.length });
      for (const task of boardTasks) {
        result.push({ type: 'task', task });
      }
    }
    return result;
  }, [project, tasks]);

  // Calculate timeline range
  const { minDate, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    let min = addDays(today, -7);
    let max = addDays(today, 30);

    for (const t of tasks) {
      if (t.startDate) {
        const sd = startOfDay(new Date(t.startDate));
        if (sd < min) min = sd;
      }
      if (t.dueDate) {
        const dd = startOfDay(new Date(t.dueDate));
        if (dd > max) max = dd;
      }
    }

    min = addDays(min, -7);
    max = addDays(max, 7);
    const total = diffDays(min, max) + 1;
    return { minDate: min, maxDate: max, totalDays: total };
  }, [tasks]);

  const today = startOfDay(new Date());
  const todayOffset = diffDays(minDate, today);

  const handleUpdateTask = async (taskId: string, data: Record<string, unknown>) => {
    if (!project) return;
    try {
      await projectsApi.updateTask(project.id, taskId, data as Parameters<typeof projectsApi.updateTask>[2]);
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!project) return;
    try {
      await projectsApi.deleteTask(project.id, taskId);
      setSelectedTask(null);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const days: Array<{ date: Date; label: string; isWeekend: boolean; isToday: boolean }> = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(minDate, i);
      const dayOfWeek = d.getDay();
      days.push({
        date: d,
        label: `${d.getDate()}`,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isToday: d.getTime() === today.getTime(),
      });
    }
    return days;
  }, [minDate, totalDays, today]);

  // Group dates by month for month header
  const monthHeaders = useMemo(() => {
    const months: Array<{ label: string; startIdx: number; span: number }> = [];
    let currentMonth = '';
    for (let i = 0; i < dateHeaders.length; i++) {
      const m = formatMonth(dateHeaders[i].date);
      if (m !== currentMonth) {
        months.push({ label: m, startIdx: i, span: 1 });
        currentMonth = m;
      } else {
        months[months.length - 1].span++;
      }
    }
    return months;
  }, [dateHeaders]);

  const hasElectron = !!window.electronAPI;

  return (
    <div style={{ width: '100%', height: '100vh', background: bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Electron title bar */}
      {hasElectron && (
        <TitleBar title="간트 차트" isDark={isDark} />
      )}

      {/* Header bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: HEADER_HEIGHT, background: headerBg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={onClose} aria-label="뒤로" style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
            {project ? `${project.name} — 간트 차트` : '간트 차트'}
          </h2>
          {projects.length > 1 && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, outline: 'none' }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} style={{ color: '#0f172a' }}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setZoom('day')}
            style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: zoom === 'day' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            일
          </button>
          <button
            type="button"
            onClick={() => setZoom('week')}
            style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: zoom === 'week' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            주
          </button>
          <button
            type="button"
            onClick={() => {
              if (timelineRef.current) {
                const scrollTo = todayOffset * dayWidth - timelineRef.current.clientWidth / 2;
                timelineRef.current.scrollLeft = Math.max(0, scrollTo);
              }
            }}
            style={{ padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, background: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', marginLeft: 8 }}
          >
            오늘
          </button>
        </div>
      </div>

      {/* No project */}
      {!project ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sub, fontSize: 16 }}>
          프로젝트가 없습니다
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left panel: task list */}
          <div style={{ width: LEFT_PANEL_WIDTH, minWidth: LEFT_PANEL_WIDTH, flexShrink: 0, borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column', background: panelBg }}>
            {/* Left header (matches timeline header height) */}
            <div style={{ height: ROW_HEIGHT * 2, minHeight: ROW_HEIGHT * 2, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'flex-end', padding: '0 12px 8px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: sub }}>태스크</span>
            </div>
            {/* Left rows */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              {rows.map((row, idx) => {
                if (row.type === 'board') {
                  return (
                    <div key={`board-${idx}`} style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 12px', background: isDark ? '#334155' : '#e2e8f0', borderBottom: `1px solid ${border}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: text }}>{row.name} ({row.count})</span>
                    </div>
                  );
                }
                const t = row.task;
                return (
                  <div
                    key={t.id}
                    style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: `1px solid ${gridLine}`, cursor: 'pointer', gap: 6 }}
                    onClick={() => setSelectedTask(t)}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: PRIORITY_COLORS[t.priority], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: timeline */}
          <div ref={timelineRef} style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ minWidth: totalDays * dayWidth, position: 'relative' }}>
              {/* Month row */}
              <div style={{ height: ROW_HEIGHT, display: 'flex', borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, zIndex: 2, background: panelBg }}>
                {monthHeaders.map((mh, i) => (
                  <div key={i} style={{ width: mh.span * dayWidth, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: text, borderRight: `1px solid ${border}` }}>
                    {mh.label}
                  </div>
                ))}
              </div>
              {/* Day row */}
              <div style={{ height: ROW_HEIGHT, display: 'flex', borderBottom: `1px solid ${border}`, position: 'sticky', top: ROW_HEIGHT, zIndex: 2, background: panelBg }}>
                {dateHeaders.map((dh, i) => (
                  <div key={i} style={{
                    width: dayWidth, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: zoom === 'day' ? 11 : 9, color: dh.isToday ? todayColor : (dh.isWeekend ? sub : text),
                    fontWeight: dh.isToday ? 700 : 400,
                    borderRight: `1px solid ${gridLine}`,
                    background: dh.isWeekend ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : 'transparent',
                  }}>
                    {zoom === 'day' ? dh.label : (dh.date.getDay() === 1 ? dh.label : '')}
                  </div>
                ))}
              </div>

              {/* Task rows */}
              {rows.map((row, idx) => {
                if (row.type === 'board') {
                  return (
                    <div key={`board-row-${idx}`} style={{ height: ROW_HEIGHT, background: isDark ? '#334155' : '#e2e8f0', borderBottom: `1px solid ${border}` }} />
                  );
                }
                const t = row.task;
                const hasStart = !!t.startDate;
                const hasEnd = !!t.dueDate;

                let barLeft = 0;
                let barWidth = 0;
                let showBar = false;

                if (hasStart && hasEnd) {
                  const sd = startOfDay(new Date(t.startDate!));
                  const dd = startOfDay(new Date(t.dueDate!));
                  barLeft = diffDays(minDate, sd) * dayWidth;
                  barWidth = Math.max((diffDays(sd, dd) + 1) * dayWidth, dayWidth);
                  showBar = true;
                } else if (hasStart) {
                  const sd = startOfDay(new Date(t.startDate!));
                  barLeft = diffDays(minDate, sd) * dayWidth;
                  barWidth = dayWidth;
                  showBar = true;
                } else if (hasEnd) {
                  const dd = startOfDay(new Date(t.dueDate!));
                  barLeft = diffDays(minDate, dd) * dayWidth;
                  barWidth = dayWidth;
                  showBar = true;
                }

                return (
                  <div key={t.id} style={{ height: ROW_HEIGHT, position: 'relative', borderBottom: `1px solid ${gridLine}` }}>
                    {/* Weekend stripes */}
                    {dateHeaders.map((dh, di) => dh.isWeekend ? (
                      <div key={di} style={{ position: 'absolute', left: di * dayWidth, top: 0, width: dayWidth, height: ROW_HEIGHT, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }} />
                    ) : null)}
                    {/* Task bar */}
                    {showBar && (
                      <div
                        onClick={() => setSelectedTask(t)}
                        style={{
                          position: 'absolute',
                          left: barLeft,
                          top: 6,
                          width: barWidth,
                          height: ROW_HEIGHT - 12,
                          background: PRIORITY_COLORS[t.priority] + (isDark ? 'cc' : 'aa'),
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          paddingLeft: 6,
                          overflow: 'hidden',
                        }}
                        title={`${t.title}${t.assigneeName ? ` (@${t.assigneeName})` : ''}${hasStart && hasEnd ? `\n${new Date(t.startDate!).toLocaleDateString('ko-KR')} ~ ${new Date(t.dueDate!).toLocaleDateString('ko-KR')}` : ''}`}
                      >
                        {barWidth > dayWidth * 2 && (
                          <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.title}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Today line */}
              <div style={{
                position: 'absolute',
                left: todayOffset * dayWidth + dayWidth / 2,
                top: 0,
                bottom: 0,
                width: 2,
                background: todayColor,
                zIndex: 1,
                pointerEvents: 'none',
                opacity: 0.7,
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && project && (
        <TaskDetailModal
          task={selectedTask}
          projectId={project.id}
          members={members}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
