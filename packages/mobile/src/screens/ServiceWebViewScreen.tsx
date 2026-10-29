import { useState, useRef, useEffect, useCallback, type ComponentType } from 'react';
import { View, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import RNWebView, { type WebViewNavigation } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/mobbin';
import { useAuthStore } from '../store';
import type { User } from '@emax/shared';

// 모노레포에서 packages/mobile이 루트와 다른 React 버전(19.x)을 써서 중첩
// 설치되는데, react-native-webview의 forwardRef 타입이 이 둘을 같은 타입으로
// 못 알아봐서 모든 prop이 never로 깨지는 문제가 있다 — 이 컴포넌트에서만 느슨한
// 타입으로 우회한다.
const WebView = RNWebView as unknown as ComponentType<Record<string, unknown>>;

type RootStackParamList = {
  Server: undefined;
  ServiceWebView: { url: string };
};
type RouteProps = RouteProp<RootStackParamList, 'ServiceWebView'>;
type NavProp = NativeStackNavigationProp<RootStackParamList, 'ServiceWebView'>;

/**
 * 서비스 주소에 접속하면 로그인부터 전체 화면을 웹뷰로 그대로 보여준다 — CSIN-Tech
 * 웹/데스크톱 클라이언트와 동일한 화면을 그대로 띄우는 방식이라, 네이티브 로그인
 * 화면이 따로 필요 없다. 이 웹페이지 자체가 로그인·대화·조직도 전부를 담당한다.
 */
export default function ServiceWebViewScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavProp>();
  const { url } = route.params;
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<{ goBack: () => void } | null>(null);
  const canGoBackRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const hideLoading = useCallback(() => {
    clearLoadingTimeout();
    setLoading(false);
  }, [clearLoadingTimeout]);

  const handleNavChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  const setAuth = useAuthStore((s) => s.setAuth);

  // 웹뷰 안의 웹앱이 로그인/로그아웃될 때 window.ReactNativeWebView.postMessage로
  // 보내는 신호를 받아 네이티브 쪽 인증 상태에 반영한다 — 이게 있어야 푸시 알림
  // 등록·생체 인증 잠금이 동작한다(둘 다 네이티브 토큰 유무로 켜짐).
  const handleMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as
        | { type: 'csin-auth'; token: string; user?: User }
        | { type: 'csin-logout' };
      if (msg.type === 'csin-auth') {
        setAuth(msg.user ?? null, msg.token);
      } else if (msg.type === 'csin-logout') {
        setAuth(null, null);
      }
    } catch {
      /* 우리 쪽 신호가 아닌 메시지는 무시 */
    }
  }, [setAuth]);

  // 실시간 메신저 특성상 웹소켓/롱폴링 연결이 계속 떠있으면 안드로이드
  // 웹뷰가 onLoadEnd(onPageFinished)를 끝까지 안 보내는 경우가 있어, 로딩
  // 진행률이 거의 끝났거나 일정 시간이 지나면 오버레이를 강제로 걷어낸다.
  const handleLoadProgress = useCallback((e: { nativeEvent: { progress: number } }) => {
    if (e.nativeEvent.progress >= 0.95) hideLoading();
  }, [hideLoading]);

  useEffect(() => clearLoadingTimeout, [clearLoadingTimeout]);

  // 안드로이드 뒤로가기: 웹뷰 안에서 더 갈 곳이 있으면 웹뷰 내비게이션, 없으면
  // 서비스 주소 화면으로 돌아간다(앱 자체는 종료하지 않음).
  useEffect(() => {
    const onBackPress = () => {
      if (canGoBackRef.current) {
        webviewRef.current?.goBack();
        return true;
      }
      navigation.navigate('Server');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={() => {
          setLoading(true);
          clearLoadingTimeout();
          loadingTimeoutRef.current = setTimeout(hideLoading, 15000);
        }}
        onLoadEnd={hideLoading}
        onLoadProgress={handleLoadProgress}
        onNavigationStateChange={handleNavChange}
        onMessage={handleMessage}
        startInLoadingState
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        androidLayerType="hardware"
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.ink} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  webview: { flex: 1 },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
