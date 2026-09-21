import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type Project, type TaskItem, type User } from '../api';
import { useThemeStore } from '../store';
import TaskCreateModal from './TaskCreateModal';
import TaskDetailModal from './TaskDetailModal';
import TitleBar from './TitleBar';
import { cn } from '../utils/cn';

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

const PRIORITY_LABELS: Record<string, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
};

export default function KanbanBoard({ roomId, members, onClose }: Props) {
  const isDark = useThemeStore((s) => s.isDark);
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateTask, setShowCreateTask] = useState<string | null>(null); // boardId
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingBoardName, setEditingBoardName] = useState('');
  const [addingBoard, setAddingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', roomId],
    queryFn: () => projectsApi.list(roomId),
    enabled: !!roomId,
  });

  const project: Project | undefined = projects.find((p) => p.id === selectedProjectId) || projects[0];

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // 태스크는 프로젝트 목록에 안 실려 온다 — 지금 보고 있는(선택된) 프로젝트 것만 따로 가져온다.
  // 쿼리 키가 ['projects', roomId, ...]로 시작해서 기존 invalidateQueries(['projects', roomId])가
  // 그대로 이 쿼리도 함께 무효화한다.
  const { data: tasks = [] } = useQuery({
    queryKey: ['projects', roomId, project?.id, 'tasks'],
    queryFn: () => projectsApi.tasks(project!.id),
    enabled: !!project?.id,
  });

  const boards = project?.boards || [];

  const getTasksForBoard = useCallback((boardId: string) => {
    return tasks.filter((t) => t.boardId === boardId).sort((a, b) => a.position - b.position);
  }, [tasks]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const created = await projectsApi.create({ roomId, name: newProjectName.trim() });
      setSelectedProjectId(created.id);
      setNewProjectName('');
      setShowCreateProject(false);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || !confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?`)) return;
    try {
      await projectsApi.delete(project.id);
      setSelectedProjectId(null);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTask = async (data: { boardId: string; title: string; description?: string; assigneeId?: string; priority: string; dueDate?: string }) => {
    if (!project) return;
    try {
      await projectsApi.createTask(project.id, data);
      setShowCreateTask(null);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleDrop = async (boardId: string) => {
    if (!project || !dragTaskId) return;
    const task = tasks.find((t) => t.id === dragTaskId);
    if (!task || task.boardId === boardId) {
      setDragTaskId(null);
      setDragOverBoardId(null);
      return;
    }
    const boardTasks = getTasksForBoard(boardId);
    const newPosition = boardTasks.length;
    try {
      await projectsApi.moveTask(project.id, dragTaskId, boardId, newPosition);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
    setDragTaskId(null);
    setDragOverBoardId(null);
  };

  const handleAddBoard = async () => {
    if (!project || !newBoardName.trim()) return;
    try {
      await projectsApi.addBoard(project.id, newBoardName.trim());
      setNewBoardName('');
      setAddingBoard(false);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateBoard = async (boardId: string) => {
    if (!project || !editingBoardName.trim()) return;
    try {
      await projectsApi.updateBoard(project.id, boardId, editingBoardName.trim());
      setEditingBoardId(null);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    if (!project) return;
    const boardTasks = getTasksForBoard(boardId);
    if (boardTasks.length > 0 && !confirm('이 보드의 태스크도 모두 삭제됩니다. 계속하시겠습니까?')) return;
    try {
      await projectsApi.deleteBoard(project.id, boardId);
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    } catch (err) {
      console.error(err);
    }
  };

  const hasElectron = !!window.electronAPI;

  return (
    <div className={cn('flex h-full min-h-0 w-full flex-col overflow-hidden', isDark ? 'bg-slate-900' : 'bg-white')}>
      {/* Electron title bar */}
      {hasElectron && (
        <TitleBar title="프로젝트 보드" isDark={isDark} />
      )}
      {/* Header */}
      <div className={cn('shrink-0 flex items-center justify-between px-4 h-[50px]', isDark ? 'bg-slate-800' : 'bg-brand-dark')}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="뒤로"
            className="border-none bg-transparent text-white cursor-pointer py-1 px-2 flex items-center justify-center"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="m-0 text-base font-bold text-white">
            {project ? project.name : '프로젝트 관리'}
          </h2>
          {projects.length > 1 && (
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="py-1 px-2 rounded-md border-none bg-white/15 text-white text-[13px] outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="text-slate-700">{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.electronAPI?.openGanttWindow) {
                window.electronAPI.openGanttWindow(roomId);
              } else {
                window.open(`${window.location.origin}/gantt/${roomId}`, '_blank', 'width=1200,height=700');
              }
            }}
            className="py-1.5 px-3 border border-white/30 rounded-md bg-transparent text-white text-xs cursor-pointer"
          >
            간트 차트
          </button>
          <button
            type="button"
            onClick={() => setShowCreateProject(true)}
            className="py-1.5 px-3 border border-white/30 rounded-md bg-transparent text-white text-xs cursor-pointer"
          >
            + 프로젝트
          </button>
          {project && (
            <button
              type="button"
              onClick={handleDeleteProject}
              className="py-1.5 px-3 border border-white/30 rounded-md bg-transparent text-red-300 text-xs cursor-pointer"
            >
              삭제
            </button>
          )}
        </div>
      </div>

      {/* Create project modal */}
      {showCreateProject && (
        <div className="fixed inset-0 z-[10010] bg-black/50 flex items-center justify-center" onClick={() => setShowCreateProject(false)}>
          <div
            className={cn('rounded-xl p-6 w-[360px] max-w-[90%] shadow-[0_8px_32px_rgba(0,0,0,0.3)]', isDark ? 'bg-slate-800' : 'bg-white')}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={cn('mb-4 text-base font-semibold', isDark ? 'text-slate-100' : 'text-slate-900')}>새 프로젝트</h3>
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              placeholder="프로젝트 이름"
              autoFocus
              className={cn(
                'w-full py-2.5 px-3 border rounded-lg text-sm outline-none mb-3 box-border',
                isDark ? 'border-slate-700 bg-slate-700 text-slate-100' : 'border-slate-300 bg-slate-100 text-slate-900'
              )}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateProject(false)}
                className={cn(
                  'py-2 px-4 border rounded-lg bg-transparent text-[13px] cursor-pointer',
                  isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
                )}
              >
                취소
              </button>
              <button type="button" onClick={handleCreateProject} className="py-2 px-4 border-none rounded-lg bg-brand-dark text-white text-[13px] font-semibold cursor-pointer">만들기</button>
            </div>
          </div>
        </div>
      )}

      {/* Board content */}
      {!project ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className={cn('text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>프로젝트가 없습니다</p>
          <button
            type="button"
            onClick={() => setShowCreateProject(true)}
            className="py-3 px-6 border-none rounded-lg bg-brand-dark text-white text-sm font-semibold cursor-pointer"
          >
            프로젝트 만들기
          </button>
        </div>
      ) : (
        <div className="flex-1 flex gap-3 p-4 overflow-hidden">
          {boards.map((board) => {
            const boardTasks = getTasksForBoard(board.id);
            const isDragOver = dragOverBoardId === board.id;
            return (
              <div
                key={board.id}
                className={cn(
                  'flex-1 min-w-[200px] flex flex-col rounded-xl overflow-hidden border-2',
                  isDragOver ? 'border-dashed border-slate-900' : 'border-transparent',
                  isDark ? 'bg-slate-800/50' : 'bg-slate-200'
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverBoardId(board.id); }}
                onDragLeave={() => setDragOverBoardId(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(board.id); }}
              >
                {/* Column header */}
                <div className="py-3 px-3.5 flex items-center justify-between">
                  {editingBoardId === board.id ? (
                    <input
                      value={editingBoardName}
                      onChange={(e) => setEditingBoardName(e.target.value)}
                      onBlur={() => handleUpdateBoard(board.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateBoard(board.id); if (e.key === 'Escape') setEditingBoardId(null); }}
                      autoFocus
                      className={cn(
                        'flex-1 py-1 px-2 border rounded text-[13px] font-semibold outline-none',
                        isDark ? 'border-slate-700 bg-slate-700 text-slate-100' : 'border-slate-300 bg-slate-100 text-slate-900'
                      )}
                    />
                  ) : (
                    <span
                      className={cn('text-[13px] font-bold cursor-pointer', isDark ? 'text-slate-100' : 'text-slate-900')}
                      onDoubleClick={() => { setEditingBoardId(board.id); setEditingBoardName(board.name); }}
                    >
                      {board.name} ({boardTasks.length})
                    </span>
                  )}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCreateTask(board.id)}
                      className={cn('border-none bg-transparent text-lg cursor-pointer px-1 leading-none', isDark ? 'text-slate-400' : 'text-slate-500')}
                      title="태스크 추가"
                    >
                      +
                    </button>
                    {boards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBoard(board.id)}
                        className={cn('border-none bg-transparent text-sm cursor-pointer px-1 leading-none', isDark ? 'text-slate-400' : 'text-slate-500')}
                        title="보드 삭제"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2">
                  {boardTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', task.id); setDragTaskId(task.id); }}
                      onDragEnd={() => { setDragTaskId(null); setDragOverBoardId(null); }}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        'py-2.5 px-3 rounded-lg cursor-grab border shadow-sm',
                        dragTaskId === task.id ? 'opacity-50' : 'opacity-100',
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      )}
                    >
                      <div className={cn('text-[13px] font-semibold mb-1.5', isDark ? 'text-slate-100' : 'text-slate-900')}>
                        {task.title}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[10px] font-semibold py-0.5 px-1.5 rounded"
                          style={{
                            backgroundColor: PRIORITY_COLORS[task.priority] + '20',
                            color: PRIORITY_COLORS[task.priority],
                          }}
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                        {task.assigneeName && (
                          <span className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>@{task.assigneeName}</span>
                        )}
                        {task.dueDate && (
                          <span className={cn(
                            'text-[11px]',
                            new Date(task.dueDate) < new Date()
                              ? 'text-red-500'
                              : isDark ? 'text-slate-400' : 'text-slate-500'
                          )}>
                            {new Date(task.dueDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {(task._count?.comments ?? 0) > 0 && (
                          <span className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>
                            {'\uD83D\uDCAC'}{task._count!.comments}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add task button at bottom */}
                <button
                  type="button"
                  onClick={() => setShowCreateTask(board.id)}
                  className={cn(
                    'mx-2 mb-2 p-2 border border-dashed rounded-lg bg-transparent text-xs cursor-pointer text-center',
                    isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
                  )}
                >
                  + 태스크 추가
                </button>
              </div>
            );
          })}

          {/* Add board column */}
          <div className="flex-1 min-w-[200px]">
            {addingBoard ? (
              <div className={cn('rounded-xl p-3', isDark ? 'bg-slate-800/50' : 'bg-slate-200')}>
                <input
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddBoard(); if (e.key === 'Escape') setAddingBoard(false); }}
                  placeholder="보드 이름"
                  autoFocus
                  className={cn(
                    'w-full py-2 px-2.5 border rounded-md text-[13px] outline-none mb-2 box-border',
                    isDark ? 'border-slate-700 bg-slate-700 text-slate-100' : 'border-slate-300 bg-slate-100 text-slate-900'
                  )}
                />
                <div className="flex gap-1.5">
                  <button type="button" onClick={handleAddBoard} className="py-1.5 px-3 border-none rounded-md bg-brand-dark text-white text-xs font-semibold cursor-pointer">추가</button>
                  <button
                    type="button"
                    onClick={() => setAddingBoard(false)}
                    className={cn(
                      'py-1.5 px-3 border rounded-md bg-transparent text-xs cursor-pointer',
                      isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
                    )}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingBoard(true)}
                className={cn(
                  'w-full p-4 border-2 border-dashed rounded-xl bg-transparent text-[13px] cursor-pointer text-center',
                  isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
                )}
              >
                + 보드 추가
              </button>
            )}
          </div>
        </div>
      )}

      {/* Task Create Modal */}
      {showCreateTask && project && (
        <TaskCreateModal
          boards={boards}
          members={members}
          defaultBoardId={showCreateTask}
          onSubmit={handleCreateTask}
          onClose={() => setShowCreateTask(null)}
        />
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
