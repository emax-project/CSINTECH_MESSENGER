import { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, useThemeStore, useViewingRoomStore } from './src/store';
import { setBaseUrlOverride, setTokenGetter, setOnUnauthorized, getSocketUrl, roomsApi, mentionsApi } from './src/api';
import { setGlobalSocket } from './src/socket';
import { useColors } from './src/theme';
import { getStoredBaseUrl } from './src/storage';
import { registerForPushNotifications, sendTokenToServer, showLocalNotification, setupNotificationResponseHandler } from './src/notifications';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Inter_300Light,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import BiometricGate from './src/components/BiometricGate';
import ServerScreen from './src/screens/ServerScreen';
import ServiceWebViewScreen from './src/screens/ServiceWebViewScreen';
import RoomListScreen from './src/screens/RoomListScreen';
import ChatScreen from './src/screens/ChatScreen';
import MoreScreen from './src/screens/MoreScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MentionScreen from './src/screens/MentionScreen';
import BookmarkScreen from './src/screens/BookmarkScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import OrgTreeScreen from './src/screens/OrgTreeScreen';
import UserDetailScreen from './src/screens/UserDetailScreen';
import KanbanScreen from './src/screens/KanbanScreen';
const AuthStack = createNativeStackNavigator();
const OrgTreeStack = createNativeStackNavigator();
const ChatStack = createNativeStackNavigator();
const MentionsStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();
export const navigationRef = createNavigationContainerRef();

function OrgTreeStackNav() {
  return (
    <OrgTreeStack.Navigator screenOptions={{ headerShown: false }}>
      <OrgTreeStack.Screen name="OrgTree" component={OrgTreeScreen} />
      <OrgTreeStack.Screen name="UserDetail" component={UserDetailScreen} />
      <OrgTreeStack.Screen name="Chat" component={ChatScreen} />
      <OrgTreeStack.Screen name="Kanban" component={KanbanScreen} />
    </OrgTreeStack.Navigator>
  );
}

function ChatStackNav() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="RoomList" component={RoomListScreen} />
      <ChatStack.Screen name="Chat" component={ChatScreen} />
      <ChatStack.Screen name="Kanban" component={KanbanScreen} />
    </ChatStack.Navigator>
  );
}

function MentionsStackNav() {
  return (
    <MentionsStack.Navigator screenOptions={{ headerShown: false }}>
      <MentionsStack.Screen name="Mentions" component={MentionScreen} />
      <MentionsStack.Screen name="Chat" component={ChatScreen} />
      <MentionsStack.Screen name="Kanban" component={KanbanScreen} />
    </MentionsStack.Navigator>
  );
}

function MoreStackNav() {
  return (
    <MoreStack.Navigator screenOptions={{ headerShown: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Bookmarks" component={BookmarkScreen} />
      <MoreStack.Screen name="Schedule" component={ScheduleScreen} />
    </MoreStack.Navigator>
  );
}

/** 생체 인증 통과 후에만 마운트됨 → 소켓 연결 시점을 인증 후로 지연 */
function MainTabsWithSocket({ baseUrlReady }: { baseUrlReady: boolean }) {
  const token = useAuthStore((s) => s.token);
  const globalSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token || !baseUrlReady) return;
    const url = getSocketUrl();
    if (!url) return;
    const s = io(url, { path: '/socket.io', auth: { token, device: 'mobile' }, reconnection: true, reconnectionDelay: 3000 });
    globalSocketRef.current = s;
    setGlobalSocket(s);
    s.on('connect', () => {
      console.log('[socket] global connected');
      roomsApi.list().then((rooms) => {
        for (const room of rooms) {
          s.emit('join_room', room.id);
        }
      }).catch(() => {});
    });
    s.on('message', (msg: { roomId?: string; content?: string; sender?: { id?: string; name?: string } }) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      const myId = useAuthStore.getState().user?.id;
      if (msg.sender?.id === myId) return;
      const viewingRoomId = useViewingRoomStore.getState().viewingRoomId;
      if (msg.roomId && msg.roomId !== viewingRoomId && msg.sender?.name) {
        const body = (msg.content || '').trim().slice(0, 80) || '새 메시지';
        const rooms = queryClient.getQueryData<{ id: string; name?: string }[]>(['rooms', myId]);
        const roomName = rooms?.find((r) => r.id === msg.roomId)?.name || '채팅';
        showLocalNotification(`${msg.sender.name}`, body, { roomId: msg.roomId, roomName });
      }
    });
    s.on('mention', (payload: { roomId?: string; senderName?: string; content?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['mentions'] });
      const viewingRoomId = useViewingRoomStore.getState().viewingRoomId;
      const myId = useAuthStore.getState().user?.id;
      if (payload.roomId && payload.roomId !== viewingRoomId && payload.senderName) {
        const body = (payload.content || '').trim().slice(0, 80) || '멘션했습니다';
        const rooms = queryClient.getQueryData<{ id: string; name?: string }[]>(['rooms', myId]);
        const roomName = rooms?.find((r) => r.id === payload.roomId)?.name || '채팅';
        showLocalNotification(`@ ${payload.senderName}`, body, { roomId: payload.roomId, roomName });
      }
    });
    return () => {
      s.removeAllListeners();
      s.disconnect();
      globalSocketRef.current = null;
      setGlobalSocket(null);
    };
  }, [token, baseUrlReady]);

  return <MainTabs />;
}

function MainTabs() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 16);
  const tabBarHeight = 56 + 12 + bottomInset + 16;

  const myId = useAuthStore((s) => s.user?.id);
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', myId],
    queryFn: roomsApi.list,
    enabled: !!myId,
  });
  const chatUnread = (rooms as { unreadCount?: number }[]).reduce((s, r) => s + (r.unreadCount ?? 0), 0);

  const { data: mentions = [] } = useQuery({
    queryKey: ['mentions'],
    queryFn: mentionsApi.list,
  });
  const mentionsUnread = (mentions as { readAt: string | null }[]).filter((m) => !m.readAt).length;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.tabActive,
        tabBarInactiveTintColor: c.tabInactive,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#c6c6c8',
          height: tabBarHeight,
          paddingBottom: bottomInset + 16,
          paddingTop: 12,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: 4 },
        tabBarItemStyle: { paddingVertical: 8 },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarBadgeStyle: { backgroundColor: '#ff3b30', color: '#fff' },
      }}
    >
      <Tab.Screen
        name="OrgTreeTab"
        component={OrgTreeStackNav}
        options={{
          tabBarLabel: '조직도',
          tabBarIcon: ({ color }) => (
            <Ionicons name="people-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MentionsTab"
        component={MentionsStackNav}
        options={{
          tabBarLabel: '멘션',
          tabBarBadge: mentionsUnread > 0 ? mentionsUnread : undefined,
          tabBarIcon: ({ color }) => (
            <Ionicons name="at-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStackNav}
        options={{
          tabBarLabel: '대화',
          tabBarBadge: chatUnread > 0 ? chatUnread : undefined,
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubbles-outline" size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreStackNav}
        options={{
          tabBarLabel: '더보기',
          tabBarIcon: ({ color }) => (
            <Ionicons name="ellipsis-horizontal" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isDark = useThemeStore((s) => s.isDark);
  const [baseUrlReady, setBaseUrlReady] = useState(false);
  const [needsServer, setNeedsServer] = useState(false);
  const [storedBaseUrl, setStoredBaseUrlState] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    getStoredBaseUrl().then((base) => {
      setBaseUrlOverride(base || null);
      setNeedsServer(!base);
      setStoredBaseUrlState(base || null);
      setBaseUrlReady(true);
    });
  }, []);

  useEffect(() => {
    setTokenGetter(() => useAuthStore.getState().token);
    setOnUnauthorized(() => useAuthStore.getState().logout());
  }, []);

  const pushRegistered = useRef(false);
  useEffect(() => {
    if (!token || Platform.OS === 'web') {
      pushRegistered.current = false;
      return;
    }
    const doRegister = () => {
      registerForPushNotifications().then((pushToken) => {
        if (pushToken) sendTokenToServer(pushToken);
      });
    };
    if (!pushRegistered.current) {
      pushRegistered.current = true;
      doRegister();
    }
    // 앱이 포그라운드로 돌아올 때 토큰 재등록 (꺼진 상태에서 첫 알림 후 누락 방지)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') doRegister();
    });
    return () => sub?.remove();
  }, [token]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    setupNotificationResponseHandler(navigationRef, queryClient);
  }, []);

  if (!baseUrlReady || !hasHydrated || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0f172a' : '#f1f5f9' }}>
        <ActivityIndicator size="large" color={isDark ? '#94a3b8' : '#475569'} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <BiometricGate onAuthFail={() => {}}>
          <AuthStack.Navigator
            screenOptions={{ headerShown: false }}
            initialRouteName={needsServer ? 'Server' : 'ServiceWebView'}
          >
            <AuthStack.Screen name="Server" component={ServerScreen} />
            <AuthStack.Screen
              name="ServiceWebView"
              component={ServiceWebViewScreen}
              initialParams={storedBaseUrl ? { url: storedBaseUrl } : undefined}
              options={{ animation: 'none' }}
            />
          </AuthStack.Navigator>
        </BiometricGate>
      </NavigationContainer>
    </QueryClientProvider>
    </SafeAreaProvider>
  );
}
