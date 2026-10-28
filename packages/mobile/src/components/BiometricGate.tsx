import { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../store';

type Props = {
  children: React.ReactNode;
  onAuthFail: () => void;
};

/** Expo Go에서는 Face ID 미지원 → 기기 비밀번호만 사용됨 */
const isExpoGo = Constants.appOwnership === 'expo';

export default function BiometricGate({ children, onAuthFail }: Props) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState<'checking' | 'prompt' | 'success' | 'skip'>('checking');
  const [error, setError] = useState('');
  const [authLabel, setAuthLabel] = useState('생체 인증으로 로그인');

  useEffect(() => {
    (async () => {
      if (!token) {
        setStatus('skip');
        return;
      }
      try {
        const enabled = await AsyncStorage.getItem('emax_biometric_enabled');
        if (enabled !== 'true') {
          setStatus('success');
          return;
        }
        const [hasHardware, isEnrolled, enrolledLevel, supportedTypes] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          'getEnrolledLevelAsync' in LocalAuthentication
            ? LocalAuthentication.getEnrolledLevelAsync()
            : Promise.resolve(0),
          'supportedAuthenticationTypesAsync' in LocalAuthentication
            ? LocalAuthentication.supportedAuthenticationTypesAsync()
            : Promise.resolve([]),
        ]);
        // 생체 인증 없으면 기기 비밀번호만 사용 (Expo Go, 시뮬레이터 등)
        const biometricAvailable = hasHardware && isEnrolled && supportedTypes.length > 0;
        if (!biometricAvailable && enrolledLevel === 1) {
          setAuthLabel('기기 비밀번호로 로그인');
        } else if (isExpoGo) {
          setAuthLabel('기기 비밀번호로 로그인 (Expo Go에서는 Face ID 미지원)');
        }
        if (!hasHardware || !isEnrolled) {
          setStatus('success');
          return;
        }
        setStatus('prompt');
        // 생체 실패 시 항상 기기 비밀번호 fallback 허용 (Expo Go, 인식 실패 등)
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Crew 로그인',
          fallbackLabel: '비밀번호 사용',
          disableDeviceFallback: false,
        });
        if (result.success) {
          setStatus('success');
        } else if (result.error === 'user_cancel') {
          logout();
          onAuthFail();
        } else if (result.error === 'user_fallback') {
          // fallback(비밀번호) 탭 후 취소한 경우 → 다시 시도 가능
          setError('인증이 취소되었습니다. 다시 시도해 주세요.');
        } else {
          setError('인증에 실패했습니다.');
        }
      } catch {
        setStatus('success');
      }
    })();
  }, [token, logout, onAuthFail]);

  const handleRetry = async () => {
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Crew 로그인',
        fallbackLabel: '비밀번호 사용',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setStatus('success');
      } else if (result.error === 'user_cancel') {
        logout();
        onAuthFail();
      } else if (result.error === 'user_fallback') {
        setError('인증이 취소되었습니다. 다시 시도해 주세요.');
      } else {
        setError('인증에 실패했습니다. 다시 시도해 주세요.');
      }
    } catch {
      setError('인증 중 오류가 발생했습니다.');
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem('emax_biometric_enabled', 'false'); // 다시 로그인 시 생체 인증 비활성화
    logout();
    onAuthFail();
  };

  if (status === 'skip' || status === 'success') {
    return <>{children}</>;
  }

  if (status === 'checking') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#475569" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require('../../assets/wordmark.png')} style={styles.wordmark} resizeMode="contain" />
      <Text style={styles.subtitle}>{authLabel}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleRetry}>
        <Text style={styles.buttonText}>인증하기</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>다시 로그인</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  wordmark: {
    width: 120,
    height: 29,
    alignSelf: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
  },
  error: {
    padding: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 8,
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    padding: 16,
    backgroundColor: '#475569',
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipBtn: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#64748b',
  },
});
