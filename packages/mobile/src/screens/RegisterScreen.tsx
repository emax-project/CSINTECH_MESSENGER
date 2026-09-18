import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authApi, setBaseUrl, setBaseUrlOverride, ensureHttps } from '../api';
import { useAuthStore } from '../store';
import { getStoredBaseUrl } from '../storage';

type RootStackParamList = { Login: undefined; Register: undefined };
type NavProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

// 서버의 회원가입 비밀번호 정책 오류 코드를 사용자 문구로 변환.
// 회원가입은 LDAP 연동 중엔 막혀 있으므로 로컬 정책(4자 이상) 기준만 온다.
function registerErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const map: Record<string, string> = {
    PASSWORD_TOO_SHORT: '비밀번호는 4자 이상이어야 합니다.',
    REGISTER_DISABLED: 'LDAP 연동 중에는 회원가입을 사용할 수 없습니다. 관리자에게 계정을 요청해 주세요.',
  };
  return map[msg] || msg;
}

export default function RegisterScreen() {
  const navigation = useNavigation<NavProp>();
  const [serverUrl, setServerUrl] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    getStoredBaseUrl().then((base) => {
      setServerUrl(base || 'https://');
      setBaseUrlOverride(base || null);
      setInitialized(true);
    });
  }, []);

  const handleSubmit = async () => {
    setError('');
    const httpsResult = ensureHttps(serverUrl);
    if (!httpsResult.ok) {
      setError(httpsResult.error);
      return;
    }
    setBaseUrl(httpsResult.url);
    setBaseUrlOverride(httpsResult.url);
    setLoading(true);
    try {
      const { user, token } = await authApi.register(email, password, name);
      setAuth(user, token);
    } catch (err) {
      setError(registerErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>EMAX</Text>
        <Text style={styles.subtitle}>새 계정 만들기</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>서버 주소</Text>
          <TextInput
            style={styles.input}
            placeholder="https://message.회사명.com"
            placeholderTextColor="#a0a5bc"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>이름</Text>
          <TextInput
            style={styles.input}
            placeholder="이름 입력"
            placeholderTextColor="#a0a5bc"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="name@company.com"
            placeholderTextColor="#a0a5bc"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="비밀번호 입력"
            placeholderTextColor="#a0a5bc"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>회원가입</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.footer}>
          <Text style={styles.footerText}>
            이미 계정이 있으신가요? <Text style={styles.link}>로그인</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 80,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
    marginBottom: 36,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3a3a3c',
    marginBottom: 6,
  },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e5ea',
    borderRadius: 10,
    fontSize: 15,
    backgroundColor: '#f2f2f7',
    color: '#000',
  },
  error: {
    padding: 12,
    backgroundColor: 'rgba(255,59,48,0.08)',
    borderRadius: 8,
    color: '#ff3b30',
    fontSize: 13,
    marginBottom: 16,
  },
  button: {
    padding: 16,
    backgroundColor: '#007aff',
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#8e8e93',
  },
  link: {
    color: '#007aff',
    fontWeight: '600',
  },
});
