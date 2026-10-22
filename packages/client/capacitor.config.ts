import type { CapacitorConfig } from '@capacitor/core';

// CSINTECH 전용 모바일(iOS/Android) 앱 설정.
// Electron 빌드(packages/client/package.json의 build.appId/productName)와 동일한
// 식별자를 쓴다 — 같은 제품의 다른 플랫폼 빌드이기 때문.
//
// server.url을 거래처 서버로 직접 지정해, 앱 내용(화면/기능)은 앱을 다시 심사
// 올리지 않아도 서버만 배포하면 바로 반영된다(Electron의 loadURL과 같은 방식).
// 네이티브 설정(권한, 아이콘, 플러그인 등)을 바꿀 때만 스토어 재제출이 필요하다.
//
// HTTPS(msg.csin.kr, Caddy 리버스 프록시 + Let's Encrypt)로 전환 완료 —
// iOS NSAppTransportSecurity 예외·Android cleartext 허용은 더 이상 필요 없어 제거했다.
const config: CapacitorConfig = {
  appId: 'com.csintech.message',
  appName: 'CSIN-Tech',
  webDir: 'dist',
  server: {
    url: 'https://msg.csin.kr',
  },
};

export default config;
