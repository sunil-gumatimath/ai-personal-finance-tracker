import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FinanceTrack',
        short_name: 'FinanceTrack',
        description: 'Personal Finance Tracker Application',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router')) {
            return 'react-vendor';
          }
          // Supabase
          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }
          // Charts (recharts is large)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts-vendor';
          }
          // Google AI
          if (id.includes('@google/generative-ai')) {
            return 'ai-vendor';
          }
          // Date utilities
          if (id.includes('date-fns')) {
            return 'date-vendor';
          }
          // UI components (Radix)
          if (id.includes('@radix-ui')) {
            return 'ui-vendor';
          }
          // Other common utilities
          if (id.includes('lucide-react') ||
            id.includes('class-variance-authority') ||
            id.includes('clsx') ||
            id.includes('tailwind-merge')) {
            return 'utils-vendor';
          }
        },
      },
    },
  },
})
