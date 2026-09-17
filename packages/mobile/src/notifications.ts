import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { QueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useAuthStore } from './store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    console.warn('[push] 실제 기기에서만 푸시 알림을 받을 수 있습니다.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[push] 푸시 알림 권한이 거부되었습니다.');
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return tokenData.data;
}

export async function sendTokenToServer(pushToken: string): Promise<void> {
  try {
    await api.post('/users/me/device-token', {
      token: pushToken,
      platform: Platform.OS,
    });
  } catch (err) {
    console.warn('[push] 서버에 토큰 등록 실패:', err);
  }
}

export async function removeTokenFromServer(pushToken: string): Promise<void> {
  try {
    await api.delete('/users/me/device-token');
  } catch {
    // ignore
  }
}

/**
 * 로컬 알림 표시 (Expo Go에서도 동작)
 * 앱이 포그라운드일 때 소켓으로 메시지를 받으면 표시
 */
export async function showLocalNotification(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
      },
      trigger: null, // 즉시 표시
    });
  } catch (err) {
    console.warn('[notifications] showLocalNotification error:', err);
  }
}

// Navigation ref for notification tap → chat
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 실제 네비게이션 ref의 오버로드된 navigate와
// 구조적으로 맞추기 위한 느슨한 내부 타입 (런타임 동작에는 영향 없음)
type NavRef = { isReady: () => boolean; navigate: (...args: any[]) => void };

function navigateToChat(navRef: NavRef, roomId: string, roomName: string) {
  if (!navRef?.isReady?.()) return;
  try {
    navRef.navigate('ChatTab', { screen: 'Chat', params: { roomId, roomName } });
  } catch (err) {
    console.warn('[notifications] navigateToChat error:', err);
  }
}

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  navRef: NavRef,
  queryClient: QueryClient
) {
  if (!useAuthStore.getState().token) return; // 로그인 전이면 무시
  const data = response.notification.request.content.data as { roomId?: string; roomName?: string };
  const roomId = data?.roomId;
  if (!roomId) return;
  let roomName = data?.roomName || '채팅';
  if (roomName === '채팅') {
    const myId = useAuthStore.getState().user?.id;
    const rooms = queryClient.getQueryData<{ id: string; name?: string }[]>(['rooms', myId]);
    const room = rooms?.find((r) => r.id === roomId);
    if (room?.name) roomName = room.name;
  }
  navigateToChat(navRef, roomId, roomName);
}

/**
 * 알림 탭 시 해당 채팅방으로 이동
 */
export function setupNotificationResponseHandler(navRef: NavRef, queryClient: QueryClient) {
  const handler = (response: Notifications.NotificationResponse) => {
    if (navRef?.isReady?.()) handleNotificationResponse(response, navRef, queryClient);
  };

  const sub = Notifications.addNotificationResponseReceivedListener(handler);

  // 앱이 알림 탭으로 실행된 경우 (종료 상태에서)
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const tryNavigate = (retries = 5) => {
      if (navRef?.isReady?.()) {
        handler(response);
      } else if (retries > 0) {
        setTimeout(() => tryNavigate(retries - 1), 300);
      }
    };
    tryNavigate();
  });

  return () => sub.remove();
}
