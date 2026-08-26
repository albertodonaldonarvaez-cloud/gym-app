import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inline service worker registration with immediate activation
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'favicon.ico'],
      devOptions: {
        enabled: true, // enable in dev mode for testing
        type: 'module',
      },
      manifest: {
        id: '/client',                     // unique app identity for Android
        name: 'GymAura',
        short_name: 'GymAura',
        description: 'Tu entrenamiento personal en el bolsillo. Registra tus series, ve tu rutina y mejora cada sesion.',
        theme_color: '#007AFF',
        background_color: '#F2F2F7',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'portrait-primary',
        start_url: '/client',
        scope: '/',
        lang: 'es',
        dir: 'ltr',
        categories: ['health', 'fitness', 'sports'],
        prefer_related_applications: false,
        // App shortcuts (long-press on Android, right-click on desktop)
        shortcuts: [
          {
            name: 'Iniciar Entrenamiento',
            short_name: 'Entrenar',
            url: '/client',
            description: 'Ve a tu entrenamiento de hoy',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Catalogo de Ejercicios',
            short_name: 'Catalogo',
            url: '/client/catalog',
            description: 'Busca ejercicios',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Historial',
            short_name: 'Historial',
            url: '/client/history',
            description: 'Ver entrenamientos pasados',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
        // Icons: regular + maskable (Android adaptive icons)
        icons: [
          { src: '/icons/icon-76.png',   sizes: '76x76',   type: 'image/png' },
          { src: '/icons/icon-120.png',  sizes: '120x120', type: 'image/png' },
          { src: '/icons/icon-152.png',  sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-180.png',  sizes: '180x180', type: 'image/png' },
          { src: '/icons/icon-192.png',  sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png',  sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Screenshots for Android install dialog (shows a preview before installing)
        screenshots: [
          {
            src: '/icons/screenshot-mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'GymAura - Tu entrenamiento de hoy',
          },
        ],
      },
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Clean old caches on update
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Runtime caching strategies
        runtimeCaching: [
          // Routine API: network first (offline fallback to cache)
          {
            urlPattern: /\/api\/v1\/routines/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-routines',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // History + exercises API: stale while revalidate
          {
            urlPattern: /\/api\/v1\/(user\/workout-history|exercises)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-data',
              expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Exercise GIFs from GitHub CDN: cache first (they never change)
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.+\.(gif|png|jpg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts: cache first
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true, port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react'],
        }
      }
    }
  }
})
