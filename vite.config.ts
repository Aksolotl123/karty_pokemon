/// <reference types="vitest/config" />
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Na GitHub Pages aplikacja działa pod /<nazwa-repo>/ — ustawiane w workflow.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Karty Pokémon — skaner kolekcji',
        short_name: 'Karty Pokémon',
        description: 'Skanuj karty Pokémon aparatem, prowadź inwentarz i wymieniaj dublety.',
        lang: 'pl',
        start_url: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1b1d2a',
        theme_color: '#1b1d2a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['tesseract/**'],
        runtimeCaching: [
          {
            // Silnik OCR (kilka MB) — pobierany raz, potem z pamięci telefonu.
            urlPattern: ({ url }) => url.pathname.includes('/tesseract/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-engine', expiration: { maxEntries: 10 } },
          },
          {
            // Tylko odpowiedzi 200: „opaque” (status 0) Chrome liczy jako ~7 MB każda i szybko zapchałyby limit.
            urlPattern: ({ url }) => url.hostname === 'assets.tcgdex.net',
            handler: 'CacheFirst',
            options: { cacheName: 'card-images', expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 180 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'api.tcgdex.net',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'card-data', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
