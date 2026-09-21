import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { Project, Board, TaskItem } from '@emax/shared';
import { projectsApi } from '../api';

type RouteParams = { Kanban: { roomId: string; roomName: string } };

const PRIORITY_COLORS: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#f43f5e' };
const PRIORITY_LABELS: Record<string, string> = { low: '낮음', medium: '보통', high: '높음' };

export default function KanbanScreen() {
  const route = useRoute<RouteProp<RouteParams, 'Kanban'>>();
  const nav = useNavigation();
  const queryClient = useQueryClient();
  const { roomId, roomName } = route.params;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showCreateTask, setShowCreateTask] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const { data: projects = [], isLoading } = useQuery({
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

  const boards = project?.boards || [];

  const getTasksForBoard = useCallback((boardId: string) => {
    return tasks.filter((t) => t.boardId === boardId).sort((a, b) => a.position - b.position);
  }, [tasks]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['projects', roomId] });

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    try {
      const created = await projectsApi.create({ roomId, name });
      setSelectedProjectId(created.id);
      setNewProjectName('');
      setShowNewProject(false);
      refresh();
    } catch {
      Alert.alert('오류', '프로젝트 생성에 실패했습니다.');
    }
  };

  const handleMoveTask = (task: TaskItem) => {
    const otherBoards = boards.filter((b) => b.id !== task.boardId);
    if (otherBoards.length === 0) return;
    Alert.alert(
      '태스크 이동',
      `"${task.title}"을(를) 어디로 이동하시겠습니까?`,
      [
        ...otherBoards.map((b) => ({
          text: b.name,
          onPress: async () => {
            if (!project) return;
            try {
              await projectsApi.moveTask(project.id, task.id, b.id, 0);
              refresh();
            } catch {
              Alert.alert('오류', '이동에 실패했습니다.');
            }
          },
        })),
        { text: '취소', style: 'cancel' as const },
      ],
    );
  };

  const renderTaskCard = (task: TaskItem) => (
    <TouchableOpacity
      key={task.id}
      style={styles.taskCard}
      onPress={() => setSelectedTask(task)}
      onLongPress={() => handleMoveTask(task)}
      activeOpacity={0.7}
    >
      <View style={styles.taskTop}>
        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
        <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] || '#a0a5bc' }]} />
      </View>
      {task.assigneeName && <Text style={styles.taskAssignee}>{task.assigneeName}</Text>}
      <View style={styles.taskMeta}>
        <Text style={styles.taskPriority}>{PRIORITY_LABELS[task.priority] || task.priority}</Text>
        {(task._count?.comments ?? 0) > 0 && (
          <Text style={styles.taskComments}>💬 {task._count!.comments}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderColumn = (board: Board) => {
    const boardTasks = getTasksForBoard(board.id);
    return (
      <View key={board.id} style={styles.column}>
        <View style={styles.columnHeader}>
          <Text style={styles.columnTitle}>{board.name}</Text>
          <Text style={styles.columnCount}>{boardTasks.length}</Text>
        </View>
        <FlatList
          data={boardTasks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => renderTaskCard(item)}
          contentContainerStyle={{ paddingBottom: 8 }}
          ListFooterComponent={
            <TouchableOpacity style={styles.addTaskBtn} onPress={() => setShowCreateTask(board.id)}>
              <Ionicons name="add-outline" size={16} color="#6366f1" />
              <Text style={styles.addTaskText}>태스크 추가</Text>
            </TouchableOpacity>
          }
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#4a5068" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{roomName} - 칸반</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Project selector */}
      <View style={styles.projectBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.projectChip, selectedProjectId === p.id && styles.projectChipActive]}
              onPress={() => setSelectedProjectId(p.id)}
            >
              <Text style={[styles.projectChipText, selectedProjectId === p.id && styles.projectChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.projectChipAdd} onPress={() => setShowNewProject(true)}>
            <Ionicons name="add-outline" size={16} color="#6366f1" />
            <Text style={styles.projectChipAddText}>새 프로젝트</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {showNewProject && (
        <View style={styles.newProjectRow}>
          <TextInput
            style={styles.newProjectInput}
            placeholder="프로젝트 이름"
            placeholderTextColor="#a0a5bc"
            value={newProjectName}
            onChangeText={setNewProjectName}
            autoFocus
          />
          <TouchableOpacity style={styles.newProjectConfirm} onPress={handleCreateProject}>
            <Text style={styles.newProjectConfirmText}>생성</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowNewProject(false); setNewProjectName(''); }}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color="#007aff" /></View>
      ) : !project ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>프로젝트가 없습니다</Text>
          <Text style={styles.emptyHint}>위에서 새 프로젝트를 만들어 보세요</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardScroll}>
          {boards.map((b) => renderColumn(b))}
        </ScrollView>
      )}

      {/* Task create inline */}
      {showCreateTask && project && (
        <TaskCreateInline
          projectId={project.id}
          boardId={showCreateTask}
          onDone={() => { setShowCreateTask(null); refresh(); }}
          onCancel={() => setShowCreateTask(null)}
        />
      )}

      {/* Task detail modal */}
      {selectedTask && project && (
        <TaskDetailInline
          task={selectedTask}
          project={project}
          boards={boards}
          onClose={() => { setSelectedTask(null); refresh(); }}
        />
      )}
    </View>
  );
}

function TaskCreateInline({ projectId, boardId, onDone, onCancel }: { projectId: string; boardId: string; onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await projectsApi.createTask(projectId, { boardId, title: title.trim() });
      onDone();
    } catch {
      Alert.alert('오류', '태스크 생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.inlineOverlay}>
      <View style={styles.inlineCard}>
        <Text style={styles.inlineTitle}>새 태스크</Text>
        <TextInput
          style={styles.inlineInput}
          placeholder="태스크 제목"
          placeholderTextColor="#a0a5bc"
          value={title}
          onChangeText={setTitle}
          autoFocus
        />
        <View style={styles.inlineActions}>
          <TouchableOpacity style={styles.inlineBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.inlineBtnText}>{saving ? '저장 중...' : '생성'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function TaskDetailInline({ task, project, boards, onClose }: { task: TaskItem; project: Project; boards: Board[]; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description || '');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    try {
      await projectsApi.updateTask(project.id, task.id, { title, description: desc || undefined });
      queryClient.invalidateQueries({ queryKey: ['projects', project.roomId] });
      setEditing(false);
    } catch {
      Alert.alert('오류', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('태스크 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          try {
            await projectsApi.deleteTask(project.id, task.id);
            queryClient.invalidateQueries({ queryKey: ['projects', project.roomId] });
            onClose();
          } catch {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const boardName = boards.find((b) => b.id === task.boardId)?.name || '';

  return (
    <View style={styles.inlineOverlay}>
      <View style={[styles.inlineCard, { maxHeight: '80%' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={styles.inlineTitle}>태스크 상세</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={22} color="#8e8e93" />
          </TouchableOpacity>
        </View>

        {editing ? (
          <>
            <TextInput style={styles.inlineInput} value={title} onChangeText={setTitle} placeholder="제목" placeholderTextColor="#a0a5bc" />
            <TextInput style={[styles.inlineInput, { height: 80, textAlignVertical: 'top' }]} value={desc} onChangeText={setDesc} placeholder="설명" placeholderTextColor="#a0a5bc" multiline />
            <View style={styles.inlineActions}>
              <TouchableOpacity style={styles.inlineBtn} onPress={handleSave} disabled={saving}>
                <Text style={styles.inlineBtnText}>{saving ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>취소</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.detailLabel}>제목</Text>
            <Text style={styles.detailValue}>{task.title}</Text>
            {task.description ? (
              <>
                <Text style={styles.detailLabel}>설명</Text>
                <Text style={styles.detailValue}>{task.description}</Text>
              </>
            ) : null}
            <Text style={styles.detailLabel}>상태</Text>
            <Text style={styles.detailValue}>{boardName}</Text>
            <Text style={styles.detailLabel}>우선순위</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] || '#a0a5bc' }]} />
              <Text style={styles.detailValue}>{PRIORITY_LABELS[task.priority] || task.priority}</Text>
            </View>
            {task.assigneeName && (
              <>
                <Text style={styles.detailLabel}>담당자</Text>
                <Text style={styles.detailValue}>{task.assigneeName}</Text>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={styles.inlineBtn} onPress={() => setEditing(true)}>
                <Text style={styles.inlineBtnText}>편집</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.inlineBtn, { backgroundColor: '#fecdd3' }]} onPress={handleDelete}>
                <Text style={[styles.inlineBtnText, { color: '#f43f5e' }]}>삭제</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#c6c6c8',
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#000', textAlign: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#8e8e93', fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#aeaeb2', marginTop: 4 },

  projectBar: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  projectChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f2f2f7', borderWidth: 1, borderColor: '#e5e5ea' },
  projectChipActive: { backgroundColor: '#007aff', borderColor: '#007aff' },
  projectChipText: { fontSize: 13, fontWeight: '600', color: '#8e8e93' },
  projectChipTextActive: { color: '#fff' },
  projectChipAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e5ea', borderStyle: 'dashed' },
  projectChipAddText: { fontSize: 13, fontWeight: '600', color: '#aeaeb2' },

  newProjectRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  newProjectInput: { flex: 1, backgroundColor: '#f2f2f7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: '#000' },
  newProjectConfirm: { backgroundColor: '#007aff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  newProjectConfirmText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cancelText: { fontSize: 13, color: '#8e8e93', fontWeight: '600', paddingHorizontal: 8 },

  boardScroll: { padding: 12, gap: 12 },
  column: { width: 280, backgroundColor: '#fff', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e5ea', maxHeight: '100%' },
  columnHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea',
  },
  columnTitle: { fontSize: 14, fontWeight: '600', color: '#000' },
  columnCount: { fontSize: 12, fontWeight: '600', color: '#8e8e93', backgroundColor: '#f2f2f7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  taskCard: {
    marginHorizontal: 10, marginTop: 8, padding: 12, backgroundColor: '#fff',
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e5ea',
  },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#000', flex: 1, marginRight: 8 },
  priorityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  taskAssignee: { fontSize: 12, color: '#8e8e93', marginTop: 4 },
  taskMeta: { flexDirection: 'row', gap: 8, marginTop: 6 },
  taskPriority: { fontSize: 11, color: '#aeaeb2' },
  taskComments: { fontSize: 11, color: '#aeaeb2' },

  addTaskBtn: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginHorizontal: 10, marginTop: 8, marginBottom: 10, padding: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#e5e5ea', borderStyle: 'dashed' },
  addTaskText: { fontSize: 13, color: '#aeaeb2', fontWeight: '600' },

  inlineOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  inlineCard: {
    width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20,
  },
  inlineTitle: { fontSize: 17, fontWeight: '600', color: '#000', marginBottom: 12 },
  inlineInput: {
    backgroundColor: '#f2f2f7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#000', marginBottom: 12,
  },
  inlineActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inlineBtn: { backgroundColor: '#007aff', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  inlineBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  detailLabel: { fontSize: 12, fontWeight: '600', color: '#8e8e93', marginTop: 8, marginBottom: 2 },
  detailValue: { fontSize: 15, color: '#000', marginBottom: 4 },
});
