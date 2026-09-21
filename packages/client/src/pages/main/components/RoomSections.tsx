import { memo, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { Folder, PublicRoom, Room } from '../../../api';
import UIChevron from '../../../components/ui/UIChevron';
import { cn } from '../../../utils/cn';
import { useThemeStore } from '../../../store';
import { getOrgTheme } from '../../../utils/orgTheme';

type SectionOpen = { topic: boolean; chat: boolean };
type CreateGroupFor = 'topic' | 'chat';

export type RoomSectionsProps = {
  isDark: boolean;
  roomsError: unknown;
  folders: Folder[];
  topicRooms: Room[];
  chatRooms: Room[];
  topicUnreadCount: number;
  chatUnreadCount: number;
  sectionOpen: SectionOpen;
  roomsByFolder: Map<string | null, Room[]>;
  folderOpen: Record<string, boolean>;
  publicRooms: PublicRoom[];
  allRooms: Room[];
  toggleSection: (key: 'topic' | 'chat') => void;
  toggleFolder: (folderId: string) => void;
  setShowFolderManageModal: Dispatch<SetStateAction<boolean>>;
  setCreateGroupFor: Dispatch<SetStateAction<CreateGroupFor>>;
  setShowCreateGroupModal: Dispatch<SetStateAction<boolean>>;
  renderRoomItem: (room: Room) => JSX.Element;
  onJoinPublicRoom: (roomId: string) => Promise<void>;
};

function PlusIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden className="block shrink-0">
      <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 패널 전체(헤더·폴더·방·공개채널)를 하나의 가상 스크롤 목록으로 평탄화하기 위한 행 모델.
 * 방이 아주 많아져도(수백~수천) 화면에 보이는 만큼만 DOM에 렌더링된다.
 * 헤더·폴더 등은 높이가 방 행과 달라서(react-window처럼 고정 픽셀을 직접 정해줘야 하는 방식
 * 대신) react-virtuoso를 써서 각 행의 실제 렌더링 높이를 자동으로 측정하게 한다.
 */
type Row =
  | { kind: 'topic-header' }
  | { kind: 'topic-error' }
  | { kind: 'topic-empty' }
  | { kind: 'folder-header'; folder: Folder; rooms: Room[]; isOpen: boolean }
  | { kind: 'room'; room: Room }
  | { kind: 'unclassified-header'; count: number }
  | { kind: 'public-header' }
  | { kind: 'public-room'; room: PublicRoom }
  | { kind: 'chat-header' }
  | { kind: 'chat-empty' };

function rowKey(row: Row): string {
  switch (row.kind) {
    case 'room': return `room-${row.room.id}`;
    case 'public-room': return `public-room-${row.room.id}`;
    case 'folder-header': return `folder-${row.folder.id}`;
    default: return row.kind;
  }
}

function RoomSections({
  isDark,
  roomsError,
  folders,
  topicRooms,
  chatRooms,
  topicUnreadCount,
  chatUnreadCount,
  sectionOpen,
  roomsByFolder,
  folderOpen,
  publicRooms,
  allRooms,
  toggleSection,
  toggleFolder,
  setShowFolderManageModal,
  setCreateGroupFor,
  setShowCreateGroupModal,
  renderRoomItem,
  onJoinPublicRoom,
}: RoomSectionsProps) {
  const accentTheme = useThemeStore((s) => s.accentTheme);
  const orgTheme = getOrgTheme(accentTheme);
  const useCustomAccent = !isDark && orgTheme.id !== 'default';

  const joinablePublicRooms = useMemo(() => {
    const roomIds = new Set(allRooms.map((r) => r.id));
    return (Array.isArray(publicRooms) ? publicRooms : []).filter((pr) => !roomIds.has(pr.id));
  }, [publicRooms, allRooms]);

  const openCreateModal = (mode: CreateGroupFor) => {
    setCreateGroupFor(mode);
    setShowCreateGroupModal(true);
  };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ kind: 'topic-header' }];

    if (sectionOpen.topic) {
      if (roomsError) {
        out.push({ kind: 'topic-error' });
      } else if (topicRooms.length === 0 && (folders?.length ?? 0) === 0) {
        out.push({ kind: 'topic-empty' });
      } else {
        (folders ?? []).forEach((f) => {
          const rooms = roomsByFolder.get(f.id) ?? [];
          const isOpen = folderOpen[f.id] !== false;
          out.push({ kind: 'folder-header', folder: f, rooms, isOpen });
          if (isOpen) rooms.forEach((room) => out.push({ kind: 'room', room }));
        });
        const unclassified = roomsByFolder.get(null) ?? [];
        if (unclassified.length > 0) {
          out.push({ kind: 'unclassified-header', count: unclassified.length });
          unclassified.forEach((room) => out.push({ kind: 'room', room }));
        }
      }
      if (joinablePublicRooms.length > 0) {
        out.push({ kind: 'public-header' });
        joinablePublicRooms.forEach((room) => out.push({ kind: 'public-room', room }));
      }
    }

    out.push({ kind: 'chat-header' });
    if (sectionOpen.chat) {
      if (chatRooms.length === 0) out.push({ kind: 'chat-empty' });
      else chatRooms.forEach((room) => out.push({ kind: 'room', room }));
    }

    return out;
  }, [sectionOpen, roomsError, topicRooms, folders, roomsByFolder, folderOpen, joinablePublicRooms, chatRooms]);

  const renderRow = (row: Row) => {
    switch (row.kind) {
      case 'topic-header':
        return (
          <button
            type="button"
            className={cn(
              'flex items-center justify-between w-full py-[7px] px-3 border-none cursor-pointer text-left',
              isDark ? 'bg-white/[0.04]' : 'bg-white',
            )}
            onClick={() => toggleSection('topic')}
          >
            <span className="flex items-center gap-1.5">
              <span className={cn('w-3 h-3 inline-flex items-center justify-center', isDark ? 'text-slate-400' : 'text-slate-500')}>
                <UIChevron open={sectionOpen.topic} size={11} color={isDark ? '#94a3b8' : '#64748b'} />
              </span>
              <span className={cn('text-[13px] font-bold', isDark ? 'text-white' : 'text-slate-900')}>아젠다</span>
              <span className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>{topicRooms.length}개</span>
              {topicUnreadCount > 0 && (
                <span
                  className={cn('min-w-[16px] h-4 px-[5px] rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center', !useCustomAccent && 'bg-brand')}
                  style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                >
                  {topicUnreadCount > 99 ? '99+' : topicUnreadCount}
                </span>
              )}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                className={cn(
                  'h-[22px] px-2 rounded-[6px] border-none inline-flex items-center justify-center text-[11px] font-bold leading-none cursor-pointer shrink-0',
                  isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-900',
                )}
                onClick={(e) => { e.stopPropagation(); setShowFolderManageModal(true); }}
                title="폴더 관리"
              >폴더</button>
              <button
                type="button"
                className={cn(
                  'w-[22px] h-[22px] rounded-[6px] border-none text-white inline-flex items-center justify-center text-base leading-none cursor-pointer shrink-0',
                  !useCustomAccent && 'bg-brand',
                )}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                onClick={(e) => { e.stopPropagation(); openCreateModal('topic'); }}
                title="아젠다 만들기"
                aria-label="아젠다 만들기"
              ><PlusIcon /></button>
            </span>
          </button>
        );

      case 'topic-error':
        return <div className="px-4 py-2 text-xs text-[#c62828]">목록을 불러올 수 없습니다</div>;

      case 'topic-empty':
        return <div className={cn('px-4 py-2 text-xs', isDark ? 'text-[#64748b]' : 'text-slate-500')}>아젠다가 없습니다</div>;

      case 'folder-header': {
        const folderUnread = row.rooms.reduce((s, r) => s + (r.unreadCount ?? 0), 0);
        return (
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 w-full py-1.5 px-3 border-none bg-transparent text-xs cursor-pointer text-left',
              isDark ? 'text-[#94a3b8]' : 'text-[#64748b]',
            )}
            onClick={() => toggleFolder(row.folder.id)}
          >
            <span className="inline-flex items-center justify-center">
              <UIChevron open={row.isOpen} size={10} color={isDark ? '#94a3b8' : '#64748b'} />
            </span>
            <span>{row.folder.name}</span>
            <span className="text-[11px] opacity-80">({row.rooms.length})</span>
            {folderUnread > 0 && (
              <span
                className={cn('min-w-[16px] h-4 px-[5px] rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center', !useCustomAccent && 'bg-brand')}
                style={useCustomAccent ? { background: orgTheme.accent } : undefined}
              >
                {folderUnread > 99 ? '99+' : folderUnread}
              </span>
            )}
          </button>
        );
      }

      case 'room':
        return renderRoomItem(row.room);

      case 'unclassified-header':
        return <div className={cn('py-1.5 px-3 text-[11px]', isDark ? 'text-[#64748b]' : 'text-slate-500')}>미분류</div>;

      case 'public-header':
        return (
          <div className={cn('px-4 pt-1 pb-1 text-[11px]', isDark ? 'text-[#64748b]' : 'text-slate-500')}>공개 채널</div>
        );

      case 'public-room':
        return (
          <div className="flex items-center justify-between py-1 px-4 text-xs">
            <span className={cn(isDark ? 'text-[#94a3b8]' : 'text-slate-500')}>{row.room.name}</span>
            <button
              type="button"
              className={cn(
                'border-none text-[11px] px-2 py-0.5 rounded cursor-pointer',
                isDark ? 'bg-[#475569] text-[#e2e8f0]' : 'bg-slate-200 text-slate-900',
              )}
              onClick={() => void onJoinPublicRoom(row.room.id)}
            >참가</button>
          </div>
        );

      case 'chat-header':
        return (
          <button
            type="button"
            className={cn(
              'flex items-center justify-between w-full py-[7px] px-3 border-none cursor-pointer text-left border-t-2 mt-1',
              isDark ? 'bg-white/[0.04] border-t-[#334155]' : 'bg-white border-t-[#e2e8f0]',
            )}
            onClick={() => toggleSection('chat')}
          >
            <span className="flex items-center gap-1.5">
              <span className={cn('w-3 h-3 inline-flex items-center justify-center', isDark ? 'text-slate-400' : 'text-slate-500')}>
                <UIChevron open={sectionOpen.chat} size={11} color={isDark ? '#94a3b8' : '#64748b'} />
              </span>
              <span className={cn('text-[13px] font-bold', isDark ? 'text-white' : 'text-slate-900')}>채팅</span>
              <span className={cn('text-[11px]', isDark ? 'text-slate-400' : 'text-slate-500')}>{chatRooms.length}개</span>
              {chatUnreadCount > 0 && (
                <span
                  className={cn('min-w-[16px] h-4 px-[5px] rounded-full text-white text-[10px] font-bold inline-flex items-center justify-center', !useCustomAccent && 'bg-brand')}
                  style={useCustomAccent ? { background: orgTheme.accent } : undefined}
                >
                  {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                </span>
              )}
            </span>
            <button
              type="button"
              className={cn(
                'w-[22px] h-[22px] rounded-[6px] border-none text-white inline-flex items-center justify-center text-base leading-none cursor-pointer shrink-0',
                !useCustomAccent && 'bg-brand',
              )}
              style={useCustomAccent ? { background: orgTheme.accent } : undefined}
              onClick={(e) => { e.stopPropagation(); openCreateModal('chat'); }}
              title="1:1 채팅 만들기"
              aria-label="1:1 채팅 만들기"
            ><PlusIcon /></button>
          </button>
        );

      case 'chat-empty':
        return <div className={cn('px-4 py-2 text-xs', isDark ? 'text-[#64748b]' : 'text-slate-500')}>채팅이 없습니다</div>;

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <Virtuoso
        data={rows}
        computeItemKey={(_, row) => rowKey(row)}
        itemContent={(_, row) => renderRow(row)}
        style={{ height: '100%' }}
        className="overflow-x-hidden"
      />
    </div>
  );
}

export default memo(RoomSections);
