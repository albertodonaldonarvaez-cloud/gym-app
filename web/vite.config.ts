import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'logo.svg'],
      manifest: {
        name: 'GymAura',
        short_name: 'GymAura',
        description: 'Tu entrenamiento personal en el bolsillo',
        theme_color: '#007AFF',
        background_color: '#F2F2F7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/client',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gym-app\.tecti-cloud\.com\/api\/v1\/routines/,
            handler: 'NetworkFirst',
            options: { cacheName: 'routine-cache', networkTimeoutSeconds: 5 }
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/.+\.gif$/,
            handler: 'CacheFirst',
            options: { cacheName: 'gif-cache', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } }
          },
        ]
      }
    })
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
    outDir: 'dist', sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'clsx'],
        }
      }
    }
  }
})
