import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // GitHub Pages (https://<user>.github.io/WeightNote/) のサブパス配信用
  base: '/WeightNote/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'WeightNote',
        short_name: 'WeightNote',
        description: '体重・食事・飲水・歩数を毎日書き込む健康手帳アプリ',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#f5f5f0',
        background_color: '#f5f5f0',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
