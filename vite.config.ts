import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'manifest.json', 'alarm.wav', 'push-sw.js'],
        manifest: {
          id: '/',
          name: 'হাত খরচ - Expense & Cost Task Manager',
          short_name: 'হাত খরচ',
          description: 'Smart personal expense, task reminder & income tracker with monthly budget planning and analytics.',
          theme_color: '#042F2E',
          background_color: '#042F2E',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          clientsClaim: true,
          skipWaiting: true,
          cleanupOutdatedCaches: true,
          importScripts: ['/push-sw.js'],
          globPatterns: ['**/*.{css,html,ico,png,svg,woff,woff2,wav}', 'assets/index*.js', 'assets/vendor-*.js'],
          globIgnores: ['**/xlsx*', '**/jspdf*', '**/html2canvas*', '**/jszip*', '**/purify*', '**/aistudio/**'],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
                return 'vendor-react';
              }
              if (id.includes('/framer-motion/') || id.includes('/motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) {
                return 'vendor-motion';
              }
              if (id.includes('/lucide-react/')) {
                return 'vendor-icons';
              }
              if (id.includes('/@capacitor/')) {
                return 'vendor-capacitor';
              }
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname ?? '.', '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: false,
      ws: false as const,
      watch: null,
    },
  };
});
