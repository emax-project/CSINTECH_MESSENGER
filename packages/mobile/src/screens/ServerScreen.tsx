import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { setBaseUrlOverride, ensureHttps } from '../api';
import { getStoredBaseUrl, setStoredBaseUrl } from '../storage';
import AuthTextInput from '../components/AuthTextInput';
import PillButton from '../components/PillButton';
import { colors, spacing, typography } from '../theme/mobbin';

type RootStackParamList = { Server: undefined; ServiceWebView: { url: string } };
type NavProp = NativeStackNavigationProp<RootStackParamList, 'Server'>;

/**
 * 멀티테넌트 진입 화면 — 각 회사가 자체 서버를 운영하므로(Slack/Teams 워크스페이스
 * 방식), 접속 전에 "어느 회사 서비스인지"부터 입력받는다. 로그인·회원가입 전부
 * 그 서비스 자체 웹페이지(ServiceWebViewScreen)가 담당하므로 네이티브 로그인
 * 화면은 따로 두지 않는다.
 */
export default function ServerScreen() {
  const navigation = useNavigation<NavProp>();
  const [serverUrl, setServerUrl] = useState('https://');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStoredBaseUrl().then((base) => {
      if (base) setServerUrl(base);
    });
  }, []);

  const handleContinue = async () => {
    setError('');
    const result = ensureHttps(serverUrl);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLoading(true);
    try {
      setBaseUrlOverride(result.url);
      await setStoredBaseUrl(result.url);
      navigation.navigate('ServiceWebView', { url: result.url });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../../assets/wordmark.png')} style={styles.wordmark} resizeMode="contain" />
        <Text style={styles.subtitle}>회사 서비스 주소를 입력하세요.</Text>

        <AuthTextInput
          label="서비스 주소"
          placeholder="https://message.company.com"
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          hint="소속 회사가 안내한 서비스 주소를 입력해 주세요."
        />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <PillButton label="계속" onPress={handleContinue} loading={loading} style={styles.cta} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center', alignItems: 'stretch' },
  wordmark: { width: 140, height: 34, alignSelf: 'center', marginBottom: spacing.xs },
  subtitle: {
    ...typography.bodyLg,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorBox: {
    backgroundColor: colors.canvasSoft,
    borderRadius: 16,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySm, color: colors.ink },
  cta: { marginTop: spacing.xs },
});
