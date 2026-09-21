import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, TextInput, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, roomsApi, usersApi, authApi } from '../api';
import { useAuthStore } from '../store';
import Avatar from '../components/Avatar';

type RouteParams = {
  UserDetail: { userId: string; userName: string; deptName?: string; initialPhone?: string | null; initialJobTitle?: string | null };
};

export default function UserDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'UserDetail'>>();
  const nav = useNavigation<NativeStackNavigationProp<any>>();
  const { userId, userName, deptName, initialPhone, initialJobTitle } = route.params;
  const myId = useAuthStore((s) => s.user?.id);

  const queryClient = useQueryClient();
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get(`/users/${userId}`) as Promise<{ id: string; name: string; email: string; phone?: string | null; jobTitle?: string | null; statusMessage?: string | null; avatarUrl?: string }>,
    enabled: !!userId,
  });

  const u = user
    ? { ...user, phone: user.phone ?? initialPhone ?? null, jobTitle: user.jobTitle ?? initialJobTitle ?? null }
    : { id: userId, name: userName, email: '', phone: initialPhone ?? null, jobTitle: initialJobTitle ?? null, statusMessage: null, avatarUrl: undefined };
  const isMe = u.id === myId;

  const [editingPhone, setEditingPhone] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleSavePhone = async () => {
    if (!isMe) return;
    setSaving(true);
    try {
      const phone = String(editPhone ?? '').trim() || null;
      await usersApi.updateProfile({ phone });
      const { user: updated } = await authApi.me();
      if (updated) useAuthStore.getState().setAuth?.(updated, useAuthStore.getState().token);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      // 쿼리 키가 'org-tree'/'org-department-users'(하이픈)라 ['org']는 prefix 매치가 안 된다 —
      // 각각 명시적으로 무효화해야 조직도 화면이 최신 정보로 갱신된다.
      queryClient.invalidateQueries({ queryKey: ['org-tree'] });
      queryClient.invalidateQueries({ queryKey: ['org-department-users'] });
      setEditingPhone(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '프로필 저장에 실패했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setSaving(false);
    }
  };

  const startEditPhone = () => {
    if (!isMe) return;
    setEditPhone(String(u.phone ?? ''));
    setEditingPhone(true);
  };

  const handleChangeAvatar = async () => {
    if (!isMe) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진을 선택하려면 갤러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploadingAvatar(true);
    try {
      const { avatarUrl } = await usersApi.uploadAvatar(result.assets[0].uri);
      const { user: updated } = await authApi.me();
      if (updated) useAuthStore.getState().setAuth?.(updated, useAuthStore.getState().token);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      // 쿼리 키가 'org-tree'/'org-department-users'(하이픈)라 ['org']는 prefix 매치가 안 된다 —
      // 각각 명시적으로 무효화해야 조직도 화면이 최신 정보로 갱신된다.
      queryClient.invalidateQueries({ queryKey: ['org-tree'] });
      queryClient.invalidateQueries({ queryKey: ['org-department-users'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    } catch {
      Alert.alert('오류', '프로필 사진 업로드에 실패했습니다.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChat = async () => {
    if (isMe) return;
    try {
      const room = await roomsApi.createDM(u.id);
      nav.navigate('Chat', { roomId: room.id, roomName: room.name || u.name });
    } catch {
      Alert.alert('오류', '채팅방을 열 수 없습니다.');
    }
  };

  const handleEmail = () => {
    if (isMe || !u.email) return;
    Linking.openURL(`mailto:${u.email}`).catch(() => Alert.alert('오류', '메일 앱을 열 수 없습니다.'));
  };

  const handleCall = () => {
    if (isMe) return;
    const phone = u.phone?.trim().replace(/\s/g, '');
    if (!phone) {
      Alert.alert('연락처 없음', '전화번호가 등록되지 않았습니다.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('오류', '전화 앱을 열 수 없습니다.'));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{deptName || '프로필'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={isMe ? handleChangeAvatar : undefined} disabled={!isMe || uploadingAvatar} style={{ position: 'relative' }}>
            <Avatar uri={u.avatarUrl || `/users/${u.id}/avatar`} name={u.name} size={96} borderRadius={48} />
            {isMe && (
              <View style={styles.avatarOverlay}>
                {uploadingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={24} color="#fff" />}
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.nameRow}>
            <Text style={styles.profileName}>{u.name}</Text>
            {(u.jobTitle ?? '') ? <Text style={styles.profileJobTitle}> {u.jobTitle}</Text> : null}
          </View>
          {u.statusMessage ? <Text style={styles.profileStatus}>{u.statusMessage}</Text> : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleChat} disabled={isMe}>
            <Ionicons name="chatbubble-outline" size={24} color="#007aff" />
            <Text style={styles.actionLabel}>대화</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleEmail} disabled={isMe || !u.email}>
            <Ionicons name="mail-outline" size={24} color="#007aff" />
            <Text style={styles.actionLabel}>메일</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCall} disabled={isMe || !u.phone?.trim()}>
            <Ionicons name="call-outline" size={24} color="#007aff" />
            <Text style={styles.actionLabel}>전화</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          {u.email ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>메일</Text>
              <Text style={styles.infoValue}>{u.email}</Text>
            </View>
          ) : null}
          {deptName ? (
            <TouchableOpacity style={styles.infoRow}>
              <Text style={styles.infoLabel}>부서</Text>
              <Text style={styles.infoValue}>{deptName}</Text>
              <Ionicons name="chevron-forward" size={18} color="#8e8e93" />
            </TouchableOpacity>
          ) : null}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>연락처</Text>
            {isMe && editingPhone ? (
              <View style={styles.phoneEditRow}>
                <TextInput
                  style={styles.phoneInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="010-1234-5678"
                  placeholderTextColor="#8e8e93"
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={handleSavePhone}
                  autoFocus
                />
                <TouchableOpacity style={styles.phoneSaveBtn} onPress={handleSavePhone} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.phoneSaveBtnText}>저장</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.phoneCancelBtn} onPress={() => setEditingPhone(false)} disabled={saving}>
                  <Text style={styles.phoneCancelBtnText}>취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.infoValueTouch} onPress={startEditPhone} disabled={!isMe}>
                <Text style={[styles.infoValue, !(u.phone ?? '').trim() && styles.infoValuePlaceholder]}>
                  {(u.phone ?? '').trim() || (isMe ? '탭하여 편집' : '-')}
                </Text>
                {isMe && <Ionicons name="chevron-forward" size={18} color="#8e8e93" />}
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea',
  },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#000', textAlign: 'center' },
  headerSpacer: { width: 36 },
  headerIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  profileSection: { alignItems: 'center', paddingVertical: 24 },
  avatarOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' },
  profileName: { fontSize: 20, fontWeight: '600', color: '#000' },
  profileJobTitle: { fontSize: 16, color: '#8e8e93', fontWeight: '400' },
  profileStatus: { fontSize: 14, color: '#8e8e93', marginTop: 4 },

  actions: {
    flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20,
    backgroundColor: '#f8f9fa', marginHorizontal: 16, borderRadius: 12,
  },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 12, fontWeight: '500', color: '#007aff' },

  infoSection: { marginTop: 24, marginHorizontal: 16 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea',
  },
  infoLabel: { width: 60, fontSize: 14, color: '#8e8e93' },
  infoValue: { flex: 1, fontSize: 15, color: '#000' },
  infoValueTouch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoValuePlaceholder: { color: '#8e8e93' },
  phoneEditRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInput: { flex: 1, borderWidth: 1, borderColor: '#e5e5ea', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: '#000' },
  phoneSaveBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#007aff', minWidth: 60, alignItems: 'center' },
  phoneSaveBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  phoneCancelBtn: { paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  phoneCancelBtnText: { fontSize: 14, color: '#8e8e93' },
});
