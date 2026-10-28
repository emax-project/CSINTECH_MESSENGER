// google-services.json은 .gitignore에 있어 EAS 클라우드 빌드 서버로 자동 전달되지
// 않는다 — 로컬 빌드에서는 디스크의 실제 파일을, EAS 빌드에서는 파일 환경변수로
// 올린 GOOGLE_SERVICES_JSON(런타임에 임시 경로로 치환됨)을 쓰도록 동적으로 분기한다.
module.exports = {
  expo: {
    name: 'Crew',
    slug: 'crew',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.emax.crew',
      infoPlist: {
        NSCameraUsageDescription: '프로필 사진 촬영 및 파일 첨부를 위해 카메라 접근이 필요합니다.',
        NSPhotoLibraryUsageDescription: '프로필 사진 및 파일 첨부를 위해 사진 라이브러리 접근이 필요합니다.',
        NSFaceIDUsageDescription: '자동 로그인을 위해 Face ID가 필요합니다.',
        NSMicrophoneUsageDescription: '음성 메시지 녹음을 위해 마이크 접근이 필요합니다.',
        NSUserNotificationsUsageDescription: '새 메시지, 멘션 등 실시간 알림을 받기 위해 알림 권한이 필요합니다.',
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      package: 'com.emax.crew',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#151F2B',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      permissions: [
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VIDEO',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'RECORD_AUDIO',
        'USE_BIOMETRIC',
        'USE_FINGERPRINT',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
        'POST_NOTIFICATIONS',
      ],
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#151F2B',
        },
      ],
      'expo-asset',
      'expo-font',
      'expo-secure-store',
      'expo-sharing',
      'expo-status-bar',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
        },
      ],
    ],
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: '1b2603b3-02ac-4aa3-a620-3a9447e885f5',
      },
    },
    owner: 'emaxit',
  },
};
