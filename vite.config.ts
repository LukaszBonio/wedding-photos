import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const BASE_PATH = '/';

// Gold accent from the biel/beż/złoto palette; also used as the PWA theme color.
const THEME_COLOR = '#C8A96A';

export default defineConfig({
  base: BASE_PATH,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    VitePWA({
      // Auto-update the Service Worker: the app is single-use, so silently
      // shipping the newest shell is preferable to prompting the guest.
      registerType: 'autoUpdate',
      // The plugin injects the registration snippet itself, so main.ts stays
      // free of Service Worker wiring. Full offline behaviour lands in Stage 5.
      injectRegister: 'auto',
      // No Service Worker during local development for a cleaner debug loop.
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Zdjęcia weselne',
        short_name: 'Zdjęcia',
        description: 'Prześlij swoje zdjęcia do pary młodej.',
        lang: 'pl',
        dir: 'ltr',
        theme_color: THEME_COLOR,
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        icons: [
          { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + static assets are precached for full offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        // SPA navigations resolve to the precached shell (works offline).
        navigateFallback: `${BASE_PATH}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Deliberately no runtimeCaching: the Google Apps Script upload endpoint
        // is cross-origin and POST-only, so it is never intercepted or cached —
        // uploads always hit the network, and the offline queue (IndexedDB)
        // owns retries and resumption.
      },
    }),
  ],
  build: {
    target: 'es2022',
    // Keep the critical-path bundle lean; manual chunks tuned in Stage 4.
    chunkSizeWarningLimit: 250,
  },
  worker: {
    // The image-compression worker is authored as an ES module.
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.ts', 'src/schemas/**/*.ts', 'src/constants.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
});
