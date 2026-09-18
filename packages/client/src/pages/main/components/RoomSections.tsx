import { memo, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      {/* TOPIC Section */}
      <div>
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
              <span className="min-w-[16px] h-4 px-[5px] rounded-full bg-brand text-white text-[10px] font-bold inline-flex items-center justify-center">
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
        {sectionOpen.topic && (
          <>
            {roomsError ? (
              <div className="px-4 py-2 text-xs text-[#c62828]">목록을 불러올 수 없습니다</div>
            ) : topicRooms.length === 0 && (folders?.length ?? 0) === 0 ? (
              <div className={cn('px-4 py-2 text-xs', isDark ? 'text-[#64748b]' : 'text-slate-500')}>아젠다가 없습니다</div>
            ) : (
              <div className="pl-1">
                {(folders ?? []).map((f) => {
                  const rooms = roomsByFolder.get(f.id) ?? [];
                  const isOpen = folderOpen[f.id] !== false;
                  const folderUnread = rooms.reduce((s, r) => s + (r.unreadCount ?? 0), 0);
                  return (
                    <div key={f.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1.5 w-full py-1.5 px-3 border-none bg-transparent text-xs cursor-pointer text-left',
                          isDark ? 'text-[#94a3b8]' : 'text-[#64748b]',
                        )}
                        onClick={() => toggleFolder(f.id)}
                      >
                        <span className="inline-flex items-center justify-center">
                          <UIChevron open={isOpen} size={10} color={isDark ? '#94a3b8' : '#64748b'} />
                        </span>
                        <span>{f.name}</span>
                        <span className="text-[11px] opacity-80">({rooms.length})</span>
                        {folderUnread > 0 && (
                          <span className="min-w-[16px] h-4 px-[5px] rounded-full bg-brand text-white text-[10px] font-bold inline-flex items-center justify-center">
                            {folderUnread > 99 ? '99+' : folderUnread}
                          </span>
                        )}
                      </button>
                      {isOpen && <ul className="list-none m-0 p-0">{rooms.map(renderRoomItem)}</ul>}
                    </div>
                  );
                })}
                {(roomsByFolder.get(null) ?? []).length > 0 && (
                  <div>
                    <div className={cn('py-1.5 px-3 text-[11px]', isDark ? 'text-[#64748b]' : 'text-slate-500')}>미분류</div>
                    <ul className="list-none m-0 p-0">{(roomsByFolder.get(null) ?? []).map(renderRoomItem)}</ul>
                  </div>
                )}
              </div>
            )}
            {joinablePublicRooms.length > 0 && (
              <div className="px-4 pt-1 pb-2">
                <div className={cn('text-[11px] mb-1', isDark ? 'text-[#64748b]' : 'text-slate-500')}>공개 채널</div>
                {joinablePublicRooms.map((pr) => (
                  <div key={pr.id} className="flex items-center justify-between py-1 text-xs">
                    <span className={cn(isDark ? 'text-[#94a3b8]' : 'text-slate-500')}>{pr.name}</span>
                    <button
                      type="button"
                      className={cn(
                        'border-none text-[11px] px-2 py-0.5 rounded cursor-pointer',
                        isDark ? 'bg-[#475569] text-[#e2e8f0]' : 'bg-slate-200 text-slate-900',
                      )}
                      onClick={() => void onJoinPublicRoom(pr.id)}
                    >참가</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* CHAT Section */}
      <div className={cn('border-t-2 mt-1', isDark ? 'border-t-[#334155]' : 'border-t-[#e2e8f0]')}>
        <button
          type="button"
          className={cn(
            'flex items-center justify-between w-full py-[7px] px-3 border-none cursor-pointer text-left',
            isDark ? 'bg-white/[0.04]' : 'bg-white',
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
              <span className="min-w-[16px] h-4 px-[5px] rounded-full bg-brand text-white text-[10px] font-bold inline-flex items-center justify-center">
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
        {sectionOpen.chat && (
          chatRooms.length === 0 ? (
            <div className={cn('px-4 py-2 text-xs', isDark ? 'text-[#64748b]' : 'text-slate-500')}>채팅이 없습니다</div>
          ) : (
            <ul className="list-none m-0 p-0">{chatRooms.map(renderRoomItem)}</ul>
          )
        )}
      </div>
    </div>
  );
}

export default memo(RoomSections);
