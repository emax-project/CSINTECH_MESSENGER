import { useState, useRef, useEffect, useCallback, type ComponentType } from 'react';
import { View, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import RNWebView, { type WebViewNavigation } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/mobbin';

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

  const handleNavChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

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
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavChange}
        startInLoadingState
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
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
