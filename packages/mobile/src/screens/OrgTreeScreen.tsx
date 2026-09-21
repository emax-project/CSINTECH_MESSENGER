import { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AntDesign from '@expo/vector-icons/AntDesign';
import type { User } from '@emax/shared';
import { orgApi, usersApi } from '../api';
import { useAuthStore } from '../store';
import { getOrgFavorites, setOrgFavorites } from '../storage';
import Avatar from '../components/Avatar';

const COMPANY_NAME = '이맥스';

type NavParamList = {
  OrgTree: undefined;
  UserDetail: { userId: string; userName: string; deptName?: string; initialPhone?: string | null; initialJobTitle?: string | null };
  Chat: { roomId: string; roomName: string };
};

export default function OrgTreeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<NavParamList>>();
  const myId = useAuthStore((s) => s.user?.id);
  const myUser = useAuthStore((s) => s.user);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set());

  useEffect(() => {
    getOrgFavorites().then((ids) => setStarred(new Set(ids)));
  }, []);

  // 가벼운 트리(부서 구조 + 인원수만)만 받고, 실제로 펼친 부서의 사용자만 그때그때 지연 로드한다.
  const { data: tree = [], isLoading } = useQuery({
    queryKey: ['org-tree', 'shallow'],
    queryFn: orgApi.treeShallow,
  });

  const { data: onlineData } = useQuery({
    queryKey: ['org-online'],
    queryFn: orgApi.online,
    refetchInterval: 30000,
  });
  const onlineSet = useMemo(() => new Set(onlineData?.userIds ?? []), [onlineData?.userIds]);

  // 펼쳐진(보이는) 부서 id만 — 회사가 접혀 있으면 그 아래 부서는 화면에 안 보이므로 로드 대상 제외.
  const expandedDeptIds = useMemo(() => {
    const ids: string[] = [];
    tree.forEach((c) => {
      if (!expanded.has(c.id)) return;
      c.departments.forEach((d) => {
        if (expanded.has(d.id)) ids.push(d.id);
      });
    });
    return ids;
  }, [tree, expanded]);

  const deptUserQueries = useQueries({
    queries: expandedDeptIds.map((id) => ({
      queryKey: ['org-department-users', id],
      queryFn: () => orgApi.departmentUsers(id),
      staleTime: 60000,
    })),
  });
  const deptUsersMap = useMemo(() => {
    const map: Record<string, User[]> = {};
    expandedDeptIds.forEach((id, i) => {
      const users = deptUserQueries[i]?.data;
      if (users) map[id] = users;
    });
    return map;
  }, [expandedDeptIds, deptUserQueries]);

  // 조직도 로딩(=부서를 펼쳤는지)과 무관하게 내 소속 부서 이름을 바로 알 수 있도록 별도로 가져온다.
  const { data: affiliationData } = useQuery({
    queryKey: ['users', 'affiliations'],
    queryFn: usersApi.affiliations,
    enabled: !!myId,
  });
  const myDeptName = affiliationData?.affiliations?.find((a) => a.active)?.departmentName ?? '';

  const sortedTree = useMemo(() => {
    return tree
      .map((c) => ({
        ...c,
        departments: [...c.departments].sort((a, b) => {
          const aStar = starred.has(a.id) ? 1 : 0;
          const bStar = starred.has(b.id) ? 1 : 0;
          return bStar - aStar;
        }),
      }))
      .sort((a, b) => {
        const aStar = starred.has(a.id) ? 1 : 0;
        const bStar = starred.has(b.id) ? 1 : 0;
        return bStar - aStar;
      });
  }, [tree, starred]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      setOrgFavorites([...next]);
      return next;
    });
  };

  const handleUserPress = (user: { id: string; name: string; phone?: string | null; jobTitle?: string | null }, deptName?: string) => {
    nav.navigate('UserDetail', { userId: user.id, userName: user.name, deptName, initialPhone: user.phone ?? undefined, initialJobTitle: user.jobTitle ?? undefined });
  };

  const canGoBack = nav.canGoBack();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.headerBg} />
        <View style={styles.header}>
          {canGoBack ? (
            <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.headerCompany}>{COMPANY_NAME}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="search-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.whiteCard}>
          <View style={styles.center}><ActivityIndicator color="#007aff" /></View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerBg} />
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.headerCompany}>{COMPANY_NAME}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <TouchableOpacity style={styles.profileArea} onPress={() => myId && nav.navigate('UserDetail', { userId: myId, userName: myUser?.name ?? '나', deptName: myDeptName, initialPhone: myUser?.phone ?? undefined, initialJobTitle: myUser?.jobTitle ?? undefined })} activeOpacity={0.7}>
            <View style={styles.avatarWrap}>
              <Avatar uri={myUser?.avatarUrl || (myId ? `/users/${myId}/avatar` : null)} name={myUser?.name} size={52} borderRadius={26} />
              {myId && onlineSet.has(myId) && <View style={[styles.onlineDot, styles.onlineDotLarge]} />}
            </View>
            <View style={styles.myProfileInfo}>
              {myDeptName ? <Text style={styles.myProfileDept}>{myDeptName}</Text> : null}
              <Text style={styles.myProfileName}>{myUser?.name ?? '사용자'}</Text>
              <View style={styles.myProfileStatusRow}>
                {myId && onlineSet.has(myId) && <Text style={styles.onlineLabel}>접속중</Text>}
                {myUser?.statusMessage ? (
                  <Text style={styles.myProfileStatus} numberOfLines={1}>{myUser.statusMessage}</Text>
                ) : null}
              </View>
            </View>
        </TouchableOpacity>

        <View style={styles.whiteCard}>
          {sortedTree.map((company, idx) => (
            <View key={company.id} style={styles.companyBlock}>
              <TouchableOpacity style={styles.companyRow} onPress={() => toggle(company.id)}>
                <Ionicons name={expanded.has(company.id) ? 'chevron-down' : 'chevron-forward'} size={18} color={expanded.has(company.id) ? '#007aff' : '#8e8e93'} style={styles.chevron} />
                <Text style={[styles.companyName, expanded.has(company.id) && styles.companyNameExpanded]}>{company.name}</Text>
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => toggleStar(company.id)}>
                  <AntDesign name="star" size={20} color={starred.has(company.id) ? '#007aff' : '#8e8e93'} />
                </TouchableOpacity>
              </TouchableOpacity>

              {expanded.has(company.id) && company.departments.map((dept) => {
                // 지연 로드: 아직 안 펼쳤으면 deptUsers는 빈 배열 — 표시용 총원은 서버가 준
                // userCount(항상 정확)를 쓰고, 접속중 인원은 로드된 뒤에만 알 수 있다.
                const deptUsers = deptUsersMap[dept.id] ?? dept.users;
                const deptLoaded = expanded.has(dept.id) ? dept.id in deptUsersMap : true;
                const onlineCount = deptUsers.filter((u) => onlineSet.has(u.id)).length;
                const total = dept.userCount ?? deptUsers.length;
                return (
                  <View key={dept.id} style={styles.deptBlock}>
                    <TouchableOpacity style={styles.deptRow} onPress={() => toggle(dept.id)}>
                      <Ionicons name={expanded.has(dept.id) ? 'chevron-down' : 'chevron-forward'} size={16} color={expanded.has(dept.id) ? '#007aff' : '#8e8e93'} style={styles.chevron} />
                      <Text style={[styles.deptName, expanded.has(dept.id) && styles.deptNameExpanded]}>{dept.name}</Text>
                      <Text style={styles.deptCount}>{deptLoaded ? `${onlineCount}/${total}` : `…/${total}`}</Text>
                      <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => toggleStar(dept.id)}>
                        <AntDesign name="star" size={18} color={starred.has(dept.id) ? '#007aff' : '#8e8e93'} />
                      </TouchableOpacity>
                    </TouchableOpacity>

                    {expanded.has(dept.id) && !deptLoaded && (
                      <View style={styles.deptLoading}><ActivityIndicator size="small" color="#007aff" /></View>
                    )}
                    {expanded.has(dept.id) && deptUsers.map((user) => {
                      const isOnline = onlineSet.has(user.id);
                      return (
                      <TouchableOpacity
                        key={user.id}
                        style={styles.userRow}
                        onPress={() => handleUserPress(user, dept.name)}
                        activeOpacity={0.6}
                      >
                        <View style={styles.avatarWrap}>
                          <Avatar uri={user.avatarUrl || `/users/${user.id}/avatar`} name={user.name} size={40} borderRadius={20} />
                          {isOnline && <View style={styles.onlineDot} />}
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{user.name}</Text>
                          <View style={styles.userStatusRow}>
                            {isOnline && <Text style={styles.onlineLabel}>접속중</Text>}
                            {user.statusMessage ? (
                              <Text style={styles.userStatus} numberOfLines={1}>{user.statusMessage}</Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.userRight}>
                          {user.id !== myId && (
                            <Ionicons name="chatbubble-outline" size={20} color="#007aff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );})}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const HEADER_BG_HEIGHT = 120;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e3a5f' },

  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_BG_HEIGHT,
    backgroundColor: '#1e3a5f',
  },

  header: {
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 2,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCompany: { flex: 1, fontSize: 17, fontWeight: '600', color: '#fff', marginLeft: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  profileArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e5eb',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },

  whiteCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 4,
    marginTop: -20,
    minHeight: 400,
  },

  myProfileInfo: { flex: 1, marginLeft: 12 },
  myProfileDept: { fontSize: 13, color: '#8e8e93', marginBottom: 1 },
  myProfileName: { fontSize: 16, fontWeight: '600', color: '#000' },
  myProfileStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  myProfileStatus: { fontSize: 12, color: '#8e8e93', flex: 1 },

  companyBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5ea',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  chevron: { width: 24, marginRight: 4 },
  companyName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#000' },
  companyNameExpanded: { color: '#007aff' },

  deptBlock: {
    marginLeft: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f2f2f7',
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  deptName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#000' },
  deptNameExpanded: { color: '#007aff' },
  deptCount: { fontSize: 13, color: '#8e8e93', marginRight: 12 },
  deptLoading: { paddingVertical: 12, alignItems: 'center' },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 16,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f2f2f7',
  },
  avatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34c759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineDotLarge: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5 },
  userInfo: { flex: 1 },
  userRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineLabel: { fontSize: 12, color: '#34c759', fontWeight: '500' },
  userName: { fontSize: 15, fontWeight: '500', color: '#000' },
  userStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  userStatus: { fontSize: 12, color: '#8e8e93', flex: 1 },
});
