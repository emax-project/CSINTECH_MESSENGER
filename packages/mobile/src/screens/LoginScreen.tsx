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
import { getStoredBaseUrl, getLastEmail, setStoredBaseUrl, setLastEmail } from '../storage';

type RootStackParamList = { Login: undefined; Register: undefined };
type NavProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    (async () => {
      const [base, lastEmail] = await Promise.all([getStoredBaseUrl(), getLastEmail()]);
      setServerUrl(base || 'http://');
      setEmail(lastEmail);
      setBaseUrlOverride(base || null);
      setInitialized(true);
    })();
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
      const { user, token } = await authApi.login(email, password);
      setAuth(user, token);
      await Promise.all([setStoredBaseUrl(httpsResult.url), setLastEmail(email)]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isNetwork = /fetch|network|connection|refused/i.test(msg) || msg === '';
      setError(
        isNetwork
          ? '서버에 연결할 수 없습니다. 서버 주소를 확인해 주세요. (https:// 필요)'
          : msg || '로그인 실패'
      );
    } finally {
      setLoading(false);
    }
  };

  if (!initialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007aff" />
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
        <Text style={styles.title}>Crew</Text>
        <Text style={styles.subtitle}>업무 메신저에 로그인</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>서버 주소</Text>
          <TextInput
            style={styles.input}
            placeholder="http://서버주소:포트"
            placeholderTextColor="#a0a5bc"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.hint}>예: http://192.168.0.10:4000</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>아이디 또는 이메일</Text>
          <TextInput
            style={styles.input}
            placeholder="wtkim 또는 wtkim@csin.kr"
            placeholderTextColor="#a0a5bc"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="default"
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
            <Text style={styles.buttonText}>로그인</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.footer}>
          <Text style={styles.footerText}>
            계정이 없으신가요? <Text style={styles.link}>회원가입</Text>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
  hint: {
    fontSize: 12,
    color: '#aeaeb2',
    marginTop: 4,
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
