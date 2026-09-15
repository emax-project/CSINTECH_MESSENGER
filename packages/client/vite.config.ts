import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  // Electron: base './'. 웹 배포(Docker) 시 VITE_BASE_URL='/' 로 빌드해 asset 절대 경로 사용
  base: process.env.VITE_BASE_URL ?? './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-socket': ['socket.io-client'],
          'vendor-recharts': ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '^/(auth|users|rooms|org|files|announcement|events|polls|projects|bookmarks|mentions|memos|link-preview|folders|settings)': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '^/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
  },
});
