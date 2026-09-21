/** EMAX API 공용 타입 정의 (client, mobile 공유) */

export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  jobTitle?: string | null;
  createdAt?: string;
  isAdmin?: boolean;
  statusMessage?: string | null;
  avatarUrl?: string;
};

export type OrgUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string;
  statusMessage?: string | null;
};

export type OrgDepartment = { id: string; name: string; users: OrgUser[] };
export type OrgCompany = { id: string; name: string; departments: OrgDepartment[] };

export type ReactionGroup = { emoji: string; count: number; userIds: string[] };

export type PollOption = {
  id: string;
  text: string;
  voteCount: number;
  voterIds: string[];
};

export type Poll = {
  id: string;
  question: string;
  isMultiple: boolean;
  options: PollOption[];
  messageId?: string;
};

export type Room = {
  id: string;
  name: string;
  isGroup: boolean;
  isTopic?: boolean;
  viewMode?: 'chat' | 'board';
  folderId?: string | null;
  createdBy?: string | null;
  members: User[];
  lastMessage: { id: string; content: string; createdAt: string; senderName: string } | null;
  updatedAt: string;
  unreadCount?: number;
  lastReadAt?: string | null;
  avatarUrl?: string;
  initials?: string | null;
  isFavorite?: boolean;
};

export type Message = {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: User;
  readCount?: number;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  fileMimeType?: string | null;
  fileExpiresAt?: string | null;
  eventTitle?: string | null;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  eventDescription?: string | null;
  replyToId?: string | null;
  replyTo?: { id: string; content: string; sender: { id: string; name: string } } | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions?: ReactionGroup[];
  poll?: Poll | null;
  contextFilePath?: string | null;
  contextLine?: number | null;
  contextBranch?: string | null;
};

export type PinnedMessageItem = {
  id: string;
  pinnedAt: string;
  message: {
    id: string;
    content: string;
    sender: { id: string; name: string };
    createdAt: string;
    fileUrl?: string | null;
    fileName?: string | null;
  };
};

export type Event = {
  id: string;
  userId: string;
  title: string;
  startAt: string;
  endAt: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Bookmark = {
  id: string;
  messageId: string;
  createdAt: string;
  message: {
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string; name: string };
    fileUrl?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    room: { id: string; name: string };
  };
};

export type MentionItem = {
  id: string;
  messageId: string;
  readAt: string | null;
  message: {
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string; name: string };
    room: { id: string; name: string };
  };
};

export type ReaderInfo = { userId: string; userName: string; readAt: string };

export type FileInfo = {
  id: string;
  fileName: string | null;
  fileSize: number | null;
  fileMimeType: string | null;
  fileExpiresAt: string | null;
  createdAt: string;
  sender: { id: string; name: string };
};

export type PublicRoom = {
  id: string;
  name: string;
  memberCount: number;
  isMember: boolean;
  lastMessage: { content: string; createdAt: string; senderName: string } | null;
  updatedAt: string;
};

export type ThreadData = { parent: Message; replies: Message[] };

export type Project = {
  id: string;
  roomId: string;
  name: string;
  description?: string | null;
  createdBy: string;
  createdAt: string;
  boards: Board[];
  /** projectsApi.list()로 받은 프로젝트는 항상 비어 있다 — projectsApi.tasks(id)로 따로 가져올 것. */
  tasks: TaskItem[];
  /** projectsApi.list()에서만 내려온다: 태스크를 아직 안 가져온 상태에서도 정확한 개수를 보여줄 수 있음. */
  taskCount?: number;
};

export type Board = { id: string; projectId: string; name: string; position: number };

export type TaskItem = {
  id: string;
  projectId: string;
  boardId: string;
  title: string;
  description?: string | null;
  assigneeId?: string | null;
  assigneeName?: string | null;
  priority: 'low' | 'medium' | 'high';
  startDate?: string | null;
  dueDate?: string | null;
  position: number;
  createdBy: string;
  messageId?: string | null;
  createdAt: string;
  _count?: { comments: number };
};

export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  userName?: string;
  content: string;
  createdAt: string;
};

export type LinkPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
};

export type Folder = {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
};
