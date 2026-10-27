import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { Room } from '@emax/shared';
import { roomsApi } from '../api';
import { useAuthStore } from '../store';
import Avatar from '../components/Avatar';
import CreateRoomModal from '../components/CreateRoomModal';

type RootStackParamList = {
  Chat: { roomId: string; roomName: string; isTopic?: boolean; viewMode?: 'chat' | 'board' };
};

export default function RoomListScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const myId = useAuthStore((s) => s.user?.id);
  const [tab, setTab] = useState<'topic' | 'chat'>('topic');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: rooms = [], isLoading, refetch } = useQuery({
    queryKey: ['rooms', myId],
    queryFn: roomsApi.list,
    enabled: !!myId,
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.refetchQueries({ queryKey: ['rooms', myId] });
    }, [queryClient, myId])
  );

  const { topicUnread, chatUnread } = useMemo(() => {
    const list = rooms as Room[];
    const topic = list.filter((r) => r.isGroup && r.isTopic);
    const chat = list.filter((r) => !r.isGroup || !r.isTopic);
    return {
      topicUnread: topic.reduce((s, r) => s + (r.unreadCount ?? 0), 0),
      chatUnread: chat.reduce((s, r) => s + (r.unreadCount ?? 0), 0),
    };
  }, [rooms]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = (rooms as Room[]).filter((r) =>
      tab === 'topic' ? r.isGroup && r.isTopic : !r.isGroup || !r.isTopic
    );
    return q ? list.filter((r) => r.name?.toLowerCase().includes(q)) : list;
  }, [rooms, tab, q]);

  const getOtherMember = useCallback((room: Room) => {
    if (!room.isGroup && room.members?.length) {
      return room.members.find((m) => m.id !== myId) ?? null;
    }
    return null;
  }, [myId]);

  const getRoomDisplayName = useCallback((room: Room) => {
    if (room.name) return room.name;
    const other = getOtherMember(room);
    if (other) return other.name ?? '알 수 없음';
    return '채팅방';
  }, [getOtherMember]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: Room }) => {
    const name = getRoomDisplayName(item);
    const lastMsg = item.lastMessage;
    const unread = item.unreadCount ?? 0;
    const other = getOtherMember(item);
    const avatarUri = item.avatarUrl
      || (other?.avatarUrl)
      || (other?.id ? `/users/${other.id}/avatar` : null)
      || (item.isGroup ? `/rooms/${item.id}/avatar` : null);
    return (
      <TouchableOpacity
        style={styles.roomItem}
        onPress={() => nav.navigate('Chat', { roomId: item.id, roomName: name, isTopic: !!(item.isTopic), viewMode: item.viewMode || 'chat' })}
        activeOpacity={0.6}
      >
        <Avatar uri={avatarUri} initials={item.initials} name={name} size={48} borderRadius={14} />
        <View style={styles.roomInfo}>
          <View style={styles.roomHeader}>
            <Text style={styles.roomName} numberOfLines={1}>{name}</Text>
            {lastMsg && <Text style={styles.roomTime}>{formatTime(lastMsg.createdAt)}</Text>}
          </View>
          <View style={styles.roomFooter}>
            <Text style={styles.lastMsg} numberOfLines={1}>
              {lastMsg ? `${lastMsg.senderName}: ${lastMsg.content}` : '메시지 없음'}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const handleRoomCreated = useCallback(
    (roomId: string, roomName: string, isTopic?: boolean, viewMode?: 'chat' | 'board') => {
      setShowCreateModal(false);
      nav.navigate('Chat', {
        roomId,
        roomName,
        isTopic: !!isTopic,
        viewMode: viewMode ?? 'chat',
      });
    },
    [nav]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crew</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={28} color="#007aff" />
        </TouchableOpacity>
      </View>

      <CreateRoomModal
        mode={tab}
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleRoomCreated}
      />

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#8e8e93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="검색"
          placeholderTextColor="#8e8e93"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'topic' && styles.tabActive]}
          onPress={() => setTab('topic')}
        >
          <View style={styles.tabLabelWrap}>
            <Text style={[styles.tabText, tab === 'topic' && styles.tabTextActive]}>아젠다</Text>
            {topicUnread > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{topicUnread > 99 ? '99+' : topicUnread}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'chat' && styles.tabActive]}
          onPress={() => setTab('chat')}
        >
          <View style={styles.tabLabelWrap}>
            <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>채팅</Text>
            {chatUnread > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{chatUnread > 99 ? '99+' : chatUnread}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color="#6366f1" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : { paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>채팅방이 없습니다</Text>}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor="#6366f1" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 58,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#000' },
  addBtn: { padding: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 6,
    backgroundColor: '#f2f2f7', borderRadius: 10,
  },
  searchIcon: { marginLeft: 12 },
  searchInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 9, fontSize: 15, color: '#000' },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea',
  },
  tabBtn: { flex: 1, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#000' },
  tabLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { fontSize: 17, fontWeight: '600', color: '#8e8e93' },
  tabBadge: {
    backgroundColor: '#ff3b30', borderRadius: 10, minWidth: 20, paddingHorizontal: 6,
    paddingVertical: 2, alignItems: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#8e8e93', fontSize: 14 },
  roomItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, gap: 12,
  },
  roomInfo: { flex: 1 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  roomName: { fontSize: 16, fontWeight: '500', color: '#000', flex: 1, marginRight: 8 },
  roomTime: { fontSize: 13, color: '#8e8e93' },
  roomFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontSize: 14, color: '#8e8e93', flex: 1, marginRight: 8 },
  badge: {
    backgroundColor: '#ff3b30', borderRadius: 10, minWidth: 20, paddingHorizontal: 6,
    paddingVertical: 2, alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
