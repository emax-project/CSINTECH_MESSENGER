import type { CapacitorConfig } from '@capacitor/core';

// CSINTECH 전용 모바일(iOS/Android) 앱 설정.
// Electron 빌드(packages/client/package.json의 build.appId/productName)와 동일한
// 식별자를 쓴다 — 같은 제품의 다른 플랫폼 빌드이기 때문.
//
// server.url을 거래처 서버로 직접 지정해, 앱 내용(화면/기능)은 앱을 다시 심사
// 올리지 않아도 서버만 배포하면 바로 반영된다(Electron의 loadURL과 같은 방식).
// 네이티브 설정(권한, 아이콘, 플러그인 등)을 바꿀 때만 스토어 재제출이 필요하다.
//
// ⚠️ 지금 거래처 서버 주소가 http(평문)다. 앱스토어/플레이스토어에 실제로 제출하기
// 전에 반드시 HTTPS로 전환해야 한다 — 로그인·메시지가 암호화 없이 오가는 것은
// 심사 리스크이자 실제 보안 문제다. cleartext: true / NSAppTransportSecurity 예외는
// 과도기적 임시 설정이다.
const config: CapacitorConfig = {
  appId: 'com.csintech.message',
  appName: 'CSIN-Tech',
  webDir: 'dist',
  server: {
    url: 'http://121.143.3.163:3030',
    cleartext: true,
  },
};

export default config;
