import { useEffect, useRef } from 'react';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import {
  getSocketUrl,
  navigateToLogin,
  roomsApi,
  type Message,
  type ReactionGroup,
  type Room,
} from '../../../api';
import { playNotificationSound } from '../../../utils/notificationSound';
import { isNotificationPopupEnabled } from '../../../utils/notificationPopup';

type MessagesPage = { messages: Message[]; nextCursor: string | null; hasMore: boolean };

type UseChatSocketParams = {
  token: string | null;
  roomId?: string;
  embedded?: boolean;
  room?: Room;
  myId?: string;
  socketRef: React.MutableRefObject<Socket | null>;
  setSocket: (next: Socket | null) => void;
  queryClient: QueryClient;
};

export function useChatSocket({
  token,
  roomId,
  embedded,
  room,
  myId,
  socketRef,
  setSocket,
  queryClient,
}: UseChatSocketParams) {
  const myIdRef = useRef<string | undefined>(myId);
  const roomNameRef = useRef<string>('');
  const roomIsTopicRef = useRef<boolean>(false);
  const lastMarkReadRef = useRef<number>(0);

  myIdRef.current = myId;
  roomNameRef.current = room?.name ?? '';
  roomIsTopicRef.current = !!room?.isTopic;

  useEffect(() => {
    if (!token || !roomId) return;
    if (socketRef.current?.connected) return;

    const url = getSocketUrl();
    const s = io(url, { path: '/socket.io', auth: { token } });
    socketRef.current = s;

    s.on('connect_error', (err: { message?: string }) => {
      if (err?.message?.includes('invalid token')) {
        try {
          localStorage.setItem('forcedLogoutMessage', '다른 기기에서 로그인되어 로그아웃되었습니다.');
          localStorage.removeItem('token');
          if (typeof window !== 'undefined') navigateToLogin();
        } catch {
          // ignore
        }
      }
    });

    s.on('error', (payload: { code?: string; message?: string }) => {
      console.error('[Socket error]', payload);
    });

    s.on('connect', () => s.emit('join_room', roomId));

    s.on('message', (msg: Message) => {
      if (msg.roomId !== roomId) return;
      const withDefaults = { ...msg, readCount: msg.readCount ?? 0, reactions: msg.reactions ?? [], poll: msg.poll ?? null };
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['rooms', roomId, 'messages'],
        (old) => {
          if (!old?.pages?.length) return { pages: [{ messages: [withDefaults], nextCursor: null, hasMore: false }], pageParams: [undefined] };
          const firstPage = old.pages[0];
          if (firstPage?.messages?.some((m) => m.id === msg.id)) return old;
          const updatedFirst = { ...firstPage, messages: [withDefaults, ...(firstPage.messages ?? [])] };
          return { ...old, pages: [updatedFirst, ...old.pages.slice(1, 5)] };
        }
      );

      // 방 목록만 갱신 (메시지 refetch 시 소켓으로 받은 새 메시지가 덮어써져 사라지는 문제 방지)
      const uid = myIdRef.current;
      if (uid) queryClient.refetchQueries({ queryKey: ['rooms', uid] });

      if (msg.senderId !== myIdRef.current) {
        const now = Date.now();
        if (now - lastMarkReadRef.current > 1000) {
          lastMarkReadRef.current = now;
          roomsApi.markRead(roomId).catch(() => {});
        }

        // 별도 채팅 창: 창이 백그라운드일 때 알림 표시 (Main에 소켓이 없을 수 있음)
        if (!embedded && typeof document !== 'undefined' && document.hidden) {
          try {
            const snoozed = Number(localStorage.getItem('notificationsSnoozedUntil') || 0);
            const mutedRaw = localStorage.getItem('mutedRoomIds');
            const muted = mutedRaw ? new Set(JSON.parse(mutedRaw).map(String)) : new Set();
            if (snoozed > Date.now() || muted.has(String(msg.roomId))) return;

            const senderName = msg.sender?.name ?? '알 수 없음';
            const isTopic = roomIsTopicRef.current;
            const roomName = roomNameRef.current;
            // 화면 공유·주변 시선 등으로 팝업이 노출될 수 있어, 프로필 사진·대화 내용은 절대
            // 보여주지 않는다 — 누가(발신자) 왔는지만 알리고 내용은 "메시지가 도착하였습니다."로 고정.
            const title = isTopic && roomName ? `[${roomName} 아젠다] ${senderName}` : `[대화방] ${senderName}`;
            const body = '메시지가 도착하였습니다.';
            playNotificationSound();
            const electronAPI = window.electronAPI;

            if (isNotificationPopupEnabled() && electronAPI?.showNotification) {
              electronAPI.showNotification(title, body, msg.roomId);
            } else if (isNotificationPopupEnabled() && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(title, { body });
            }
          } catch {
            // ignore
          }
        }
      }
    });

    s.on('message_updated', (payload: { id: string; roomId: string; content: string; editedAt: string }) => {
      if (payload.roomId !== roomId) return;
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['rooms', roomId, 'messages'],
        (old) => {
          if (!old?.pages?.length) return old ?? { pages: [], pageParams: [] };
          return { ...old, pages: old.pages.map((page) => ({ ...page, messages: (page.messages ?? []).map((m) => m.id === payload.id ? { ...m, content: payload.content, editedAt: payload.editedAt } : m) })) };
        }
      );
    });

    s.on('message_deleted', (payload: { id: string; roomId: string }) => {
      if (payload.roomId !== roomId) return;
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['rooms', roomId, 'messages'],
        (old) => {
          if (!old?.pages?.length) return old ?? { pages: [], pageParams: [] };
          return { ...old, pages: old.pages.map((page) => ({ ...page, messages: (page.messages ?? []).map((m) => m.id === payload.id ? { ...m, content: '[삭제된 메시지]', deletedAt: new Date().toISOString() } : m) })) };
        }
      );
    });

    s.on('reaction_updated', (payload: { messageId: string; reactions: ReactionGroup[] }) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['rooms', roomId, 'messages'],
        (old) => {
          if (!old?.pages?.length) return old ?? { pages: [], pageParams: [] };
          return { ...old, pages: old.pages.map((page) => ({ ...page, messages: (page.messages ?? []).map((m) => m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m) })) };
        }
      );
    });

    s.on('poll_voted', (payload: { messageId?: string; id: string; question: string; isMultiple: boolean; options: Array<{ id: string; text: string; voteCount: number; voterIds: string[] }> }) => {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['rooms', roomId, 'messages'],
        (old) => {
          if (!old?.pages?.length) return old ?? { pages: [], pageParams: [] };
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: (page.messages ?? []).map((m) => {
                if (m.poll && m.poll.id === payload.id) {
                  return { ...m, poll: { ...m.poll, options: payload.options } };
                }
                return m;
              }),
            })),
          };
        }
      );
    });

    s.on('message_pinned', () => {
      queryClient.invalidateQueries({ queryKey: ['rooms', roomId, 'pins'] });
    });
    s.on('message_unpinned', () => {
      queryClient.invalidateQueries({ queryKey: ['rooms', roomId, 'pins'] });
    });
    s.on('members_added', (payload: { roomId: string }) => {
      if (payload.roomId === roomId) {
        queryClient.refetchQueries({ queryKey: ['rooms', roomId] });
        queryClient.refetchQueries({ queryKey: ['rooms'] });
      }
    });
    s.on('member_left', () => {
      queryClient.refetchQueries({ queryKey: ['rooms', roomId] });
      queryClient.refetchQueries({ queryKey: ['rooms', roomId, 'messages'] });
    });

    const handleProjectEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['projects', roomId] });
    };
    s.on('project_updated', handleProjectEvent);
    s.on('task_created', handleProjectEvent);
    s.on('task_updated', handleProjectEvent);
    s.on('task_moved', handleProjectEvent);
    s.on('task_deleted', handleProjectEvent);

    s.on('room_read', (payload: { roomId: string; userId: string }) => {
      if (payload.roomId !== roomId || payload.userId === myIdRef.current) return;
      queryClient.setQueryData<InfiniteData<MessagesPage>>(
        ['rooms', roomId, 'messages'],
        (old) => {
          if (!old?.pages?.length) return old ?? { pages: [], pageParams: [] };
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: (page.messages ?? []).map((m) =>
                m.senderId === myIdRef.current ? { ...m, readCount: Math.max(m.readCount ?? 0, 1) } : m
              ),
            })),
          };
        }
      );
      queryClient.refetchQueries({ queryKey: ['rooms', roomId, 'messages'] });
    });

    s.on('mention', (payload: { roomId: string; senderName: string; content: string }) => {
      playNotificationSound();
      if (isNotificationPopupEnabled()) {
        // 멘션 내용도 화면 공유 등으로 유출될 수 있어 보여주지 않는다.
        window.electronAPI?.showNotification(
          `${payload.senderName}님이 회원님을 멘션했습니다`,
          '메시지가 도착하였습니다.'
        );
      }
    });

    setSocket(s);

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token, roomId, embedded, queryClient, setSocket, socketRef]);
}
