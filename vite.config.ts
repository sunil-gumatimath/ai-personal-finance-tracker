import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-icon.svg"],
      manifest: {
        name: "FinanceTrack",
        short_name: "FinanceTrack",
        description: "AI-Powered Personal Finance Tracker",
        theme_color: "#000000",
        icons: [
          {
            src: "pwa-192x192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
          },
          {
            src: "pwa-512x512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/neon-auth': {
        target: 'https://ep-odd-block-a13wgvy0.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/neon-auth\/auth/, ''),
      },
    },
  },
  build: {
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Function form routes transitive deps (e.g. recharts -> d3,
        // react-markdown -> remark/micromark, @neondatabase/auth -> better-auth)
        // into the right chunk so the main `index` bundle stays small and
        // no chunk exceeds the size warning limit. Matching is done by exact
        // package name to avoid accidentally pulling in third-party
        // `*/react*` adapters (which previously caused a neon <->
        // react-vendor circular chunk).
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Extract the package name (handles @scope/pkg and pkg).
          const match = id.match(/node_modules[\\/\\\\]((?:@[^/\\\\]+[\\/\\\\])?[^/\\\\]+)/)
          const pkg = match ? match[1].replace(/\\/g, '/') : ''

          // Charts: recharts + its d3/victory vendor deps
          if (
            pkg === 'recharts' ||
            pkg === 'victory-vendor' ||
            pkg === 'd3-array' ||
            pkg === 'd3-shape' ||
            pkg === 'd3-scale' ||
            pkg === 'd3-scale-chromatic' ||
            pkg === 'd3-interpolate' ||
            pkg === 'd3-time' ||
            pkg === 'd3-time-format' ||
            pkg === 'd3-path' ||
            pkg === 'd3-format' ||
            pkg === 'd3-color'
          ) {
            return 'charts'
          }

          // Markdown rendering (react-markdown pulls in remark/micromark/hast)
          if (
            pkg === 'react-markdown' ||
            pkg === 'remark-gfm' ||
            pkg === 'remark-smarters' ||
            pkg === 'remark-parse' ||
            pkg === 'remark-rehype' ||
            pkg === 'remark-mdast' ||
            pkg === 'micromark' ||
            pkg.startsWith('micromark-') ||
            pkg.startsWith('mdast-') ||
            pkg.startsWith('hast-') ||
            pkg.startsWith('unist-') ||
            pkg === 'unified' ||
            pkg === 'bail' ||
            pkg === 'trough' ||
            pkg === 'vfile' ||
            pkg === 'vfile-message' ||
            pkg === 'character-entities' ||
            pkg === 'character-reference-parser' ||
            pkg === 'decode-named-character-reference' ||
            pkg === 'comma-separated-tokens' ||
            pkg === 'space-separated-tokens' ||
            pkg === 'property-information' ||
            pkg.startsWith('estree-')
          ) {
            return 'markdown'
          }

          // Neon auth + serverless + the auth framework it bundles
          // (better-auth, @better-fetch, jose, zod, @neondatabase/auth-ui,
          // captcha providers, radix-ui copies it vendors, etc.).
          if (
            pkg.startsWith('@neondatabase/') ||
            pkg === 'better-auth' ||
            pkg.startsWith('@better-auth/') ||
            pkg === '@better-fetch/fetch' ||
            pkg === 'jose' ||
            pkg === 'zod' ||
            pkg === '@daveyplate/better-auth-ui' ||
            pkg === '@daveyplate/better-auth-tanstack' ||
            pkg === '@captchafox/react' ||
            pkg === '@hcaptcha/react-hcaptcha' ||
            pkg === '@marsidev/react-turnstile' ||
            pkg === '@wojtekmaj/react-recaptcha-v3' ||
            pkg === '@hookform/resolvers' ||
            pkg === 'react-hook-form' ||
            pkg === '@supabase/auth-js'
          ) {
            return 'neon'
          }

          // Google Generative AI SDK (only used by the AI chat feature)
          if (pkg === '@google/generative-ai') return 'ai-vendor'

          if (pkg === 'date-fns') return 'date-utils'
          if (pkg === 'lucide-react') return 'icons'
          if (pkg.startsWith('@radix-ui/')) return 'ui-vendor'

          // React core + router — matched by exact package name only.
          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-router' || pkg === 'react-router-dom' || pkg === '@remix-run/router') {
            return 'react-vendor'
          }

          // Small shared misc libs
          if (
            pkg === 'sonner' ||
            pkg === 'next-themes' ||
            pkg === 'class-variance-authority' ||
            pkg === 'tailwind-merge' ||
            pkg === 'clsx'
          ) {
            return 'misc-vendor'
          }
        },
      },
    },
  },
})
