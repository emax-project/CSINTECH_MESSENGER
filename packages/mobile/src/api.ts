import type { User, Room, Message, Folder, MentionItem, Bookmark, Event, Project, TaskItem, TaskComment } from '@emax/shared';

let baseUrlOverride: string | null = null;

export function setBaseUrlOverride(url: string | null): void {
  baseUrlOverride = url;
}

export function getBaseUrl(): string {
  return baseUrlOverride ?? '';
}

export function setBaseUrl(url: string): void {
  const trimmed = url.replace(/\/$/, '');
  baseUrlOverride = trimmed;
}

const __DEV__ = process.env.NODE_ENV !== 'production';

export function ensureHttps(url: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: '서버 주소를 입력해 주세요.' };
  let u = trimmed;
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = `http://${u}`;
  }
  if (!__DEV__ && u.startsWith('http://')) {
    return { ok: false, error: '보안 연결(https)이 필요합니다. https:// 로 시작하는 주소를 입력해 주세요.' };
  }
  return { ok: true, url: u.replace(/\/$/, '') };
}

let tokenGetter: (() => string | null) | null = null;
let onUnauthorized: (() => void) | null = null;

export function setTokenGetter(getter: () => string | null): void {
  tokenGetter = getter;
}

export function setOnUnauthorized(handler: () => void): void {
  onUnauthorized = handler;
}

export function getToken(): string | null {
  return tokenGetter?.() ?? null;
}

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) (h as Record<string, string>)['Authorization'] = `Bearer ${t}`;
  return h;
}

export const api = {
  async post(path: string, body: object) {
    const base = getBaseUrl();
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const serverMsg = (data as { error?: string })?.error;
      if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
        onUnauthorized?.();
        throw new Error(serverMsg || '다른 기기에서 로그인되어 로그아웃되었습니다.');
      }
      throw new Error(serverMsg || (res.status === 500 ? '서버 오류가 발생했습니다' : res.statusText));
    }
    return data;
  },
  async get(path: string) {
    const base = getBaseUrl();
    const res = await fetch(`${base}${path}`, { headers: headers() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const serverMsg = (data as { error?: string })?.error;
      if (res.status === 401) {
        onUnauthorized?.();
        throw new Error(serverMsg || '다른 기기에서 로그인되어 로그아웃되었습니다.');
      }
      throw new Error(serverMsg || res.statusText);
    }
    return data;
  },
  async put(path: string, body: object) {
    const base = getBaseUrl();
    const res = await fetch(`${base}${path}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string })?.error || res.statusText);
    return data;
  },
  async delete(path: string) {
    const base = getBaseUrl();
    const res = await fetch(`${base}${path}`, { method: 'DELETE', headers: headers() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string })?.error || res.statusText);
    return data;
  },
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }) as Promise<{ user: User; token: string }>,
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }) as Promise<{ user: User; token: string }>,
  me: () => api.get('/auth/me') as Promise<{ user: User }>,
  logout: () => api.post('/auth/logout', {}) as Promise<{ ok: boolean }>,
};

export const usersApi = {
  list: () => api.get('/users') as Promise<User[]>,
  /** 내 소속 부서(들). 조직도 트리 로딩과 무관하게 내 부서 이름을 바로 알 수 있다. */
  affiliations: () =>
    api.get('/users/me/affiliations') as Promise<{ departmentId: string | null; affiliations: UserAffiliation[] }>,
  updateProfile: (data: { phone?: string | null; jobTitle?: string | null; statusMessage?: string | null }) =>
    api.put('/users/me', data) as Promise<{ ok: boolean }>,
  uploadAvatar: async (uri: string) => {
    const base = getBaseUrl();
    const formData = new FormData();
    formData.append('avatar', { uri, type: 'image/jpeg', name: 'avatar.jpg' } as any);
    const res = await fetch(`${base}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` } as any,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || '업로드 실패');
    return data as { avatarUrl: string };
  },
  deleteAvatar: () => api.delete('/users/me/avatar') as Promise<{ ok: boolean }>,
};

export const roomsApi = {
  list: () => api.get('/rooms') as Promise<Room[]>,
  get: (id: string) => api.get(`/rooms/${id}`) as Promise<Room>,
  create: (otherUserId: string) => api.post('/rooms', { otherUserId }) as Promise<Room & { members: { user: User }[] }>,
  createDM: (otherUserId: string) => api.post('/rooms', { otherUserId }) as Promise<Room>,
  createTopic: (data: { name: string; description?: string; isPublic?: boolean; viewMode?: string; memberIds: string[]; folderId?: string; initials?: string }) =>
    api.post('/rooms/topic', data) as Promise<Room>,
  addMembers: (roomId: string, userIds: string[], isPublic?: boolean) =>
    api.post(`/rooms/${roomId}/members`, { userIds, isPublic }) as Promise<Room>,
  markRead: (roomId: string) => api.post(`/rooms/${roomId}/read`, {}) as Promise<{ ok: boolean }>,
  messages: (roomId: string, cursor?: string) =>
    api.get(`/rooms/${roomId}/messages${cursor ? `?cursor=${cursor}` : ''}`) as Promise<{
      messages: Message[];
      nextCursor: string | null;
      hasMore: boolean;
    }>,
};

export const foldersApi = {
  list: () => api.get('/folders') as Promise<Folder[]>,
};

export const mentionsApi = {
  list: () => api.get('/mentions') as Promise<MentionItem[]>,
  markRead: (id: string) => api.post(`/mentions/${id}/read`, {}) as Promise<{ ok: boolean }>,
};

export const bookmarksApi = {
  list: () => api.get('/bookmarks') as Promise<Bookmark[]>,
  remove: (messageId: string) => api.delete(`/bookmarks/${messageId}`) as Promise<{ ok: boolean }>,
};

export const eventsApi = {
  list: () => api.get('/events') as Promise<Event[]>,
  create: (data: { title: string; startAt: string; endAt: string; description?: string }) =>
    api.post('/events', data) as Promise<Event>,
  update: (id: string, data: Partial<{ title: string; startAt: string; endAt: string; description: string }>) =>
    api.put(`/events/${id}`, data) as Promise<Event>,
  remove: (id: string) => api.delete(`/events/${id}`) as Promise<{ ok: boolean }>,
};

export type OrgDepartmentLite = {
  id: string;
  name: string;
  users: User[];
  /** treeShallow()에서만 내려온다: 아직 users를 안 가져온 상태에서도 정확한 인원수를 보여줄 수 있음. */
  userCount?: number;
};
export type OrgCompany = { id: string; name: string; departments: OrgDepartmentLite[] };

export type UserAffiliation = {
  departmentId: string;
  departmentName: string;
  companyId: string;
  companyName: string;
  label: string;
  active: boolean;
};

export const orgApi = {
  tree: () => api.get('/org/tree') as Promise<OrgCompany[]>,
  /** 부서 구조 + 인원수만 가벼운 트리로. 사용자 목록은 departmentUsers()로 부서별 지연 로드. */
  treeShallow: () => api.get('/org/tree?shallow=1') as Promise<OrgCompany[]>,
  /** 부서를 펼칠 때 그 부서 소속 사용자 목록만 가져온다. */
  departmentUsers: (departmentId: string) => api.get(`/org/departments/${departmentId}/users`) as Promise<User[]>,
  online: () => api.get('/org/online') as Promise<{ userIds: string[] }>,
};

export const announcementApi = {
  get: () => api.get('/announcement') as Promise<{ content: string | null }>,
};

export const projectsApi = {
  list: (roomId: string) => api.get(`/projects/room/${roomId}`) as Promise<Project[]>,
  /** 프로젝트 하나(선택된 탭)의 태스크 전체. 칸반을 열 때(=프로젝트 선택 시) 따로 불러온다. */
  tasks: (projectId: string) => api.get(`/projects/${projectId}/tasks`) as Promise<TaskItem[]>,
  create: (data: { roomId: string; name: string; description?: string }) =>
    api.post('/projects', data) as Promise<Project>,
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put(`/projects/${id}`, data) as Promise<Project>,
  remove: (id: string) => api.delete(`/projects/${id}`) as Promise<{ ok: boolean }>,
  createBoard: (projectId: string, name: string) =>
    api.post(`/projects/${projectId}/boards`, { name }) as Promise<{ id: string; name: string; position: number }>,
  updateBoard: (projectId: string, boardId: string, name: string) =>
    api.put(`/projects/${projectId}/boards/${boardId}`, { name }) as Promise<{ ok: boolean }>,
  deleteBoard: (projectId: string, boardId: string) =>
    api.delete(`/projects/${projectId}/boards/${boardId}`) as Promise<{ ok: boolean }>,
  createTask: (projectId: string, data: { boardId: string; title: string; description?: string; assigneeId?: string; priority?: string; startDate?: string; dueDate?: string }) =>
    api.post(`/projects/${projectId}/tasks`, data) as Promise<TaskItem>,
  updateTask: (projectId: string, taskId: string, data: Partial<{ title: string; description: string; assigneeId: string | null; priority: string; startDate: string | null; dueDate: string | null; boardId: string }>) =>
    api.put(`/projects/${projectId}/tasks/${taskId}`, data) as Promise<TaskItem>,
  deleteTask: (projectId: string, taskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`) as Promise<{ ok: boolean }>,
  moveTask: (projectId: string, taskId: string, boardId: string, position: number) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/move`, { boardId, position }) as Promise<{ ok: boolean }>,
  comments: (projectId: string, taskId: string) =>
    api.get(`/projects/${projectId}/tasks/${taskId}/comments`) as Promise<TaskComment[]>,
  addComment: (projectId: string, taskId: string, content: string) =>
    api.post(`/projects/${projectId}/tasks/${taskId}/comments`, { content }) as Promise<TaskComment>,
};

export function getSocketUrl(): string {
  return getBaseUrl();
}

export type FileAsset = { uri: string; name?: string; mimeType?: string };

export const filesApi = {
  upload: async (roomId: string, asset: FileAsset, content?: string): Promise<Message> => {
    const formData = new FormData();
    formData.append('roomId', roomId);
    formData.append('file', {
      uri: asset.uri,
      name: asset.name || 'file',
      type: asset.mimeType || 'application/octet-stream',
    } as any);
    if (content) formData.append('content', content);

    const base = getBaseUrl();
    const t = getToken();
    const res = await fetch(`${base}/files/upload`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data as { error?: string })?.error;
      if (res.status === 401) onUnauthorized?.();
      throw new Error(msg || '업로드에 실패했습니다.');
    }
    return data as Message;
  },
  async fetchBlob(messageId: string): Promise<Blob> {
    const base = getBaseUrl();
    const t = getToken();
    const res = await fetch(`${base}/files/download/${messageId}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string })?.error || '다운로드에 실패했습니다.');
    }
    return res.blob();
  },
};
