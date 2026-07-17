import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Dev-only proxy: the browser talks same-origin (/api/...) so the HttpOnly
// sis_session cookie round-trips untouched; SIS.Api itself serves at the root,
// so the /api prefix is stripped (matches the Angular prototype's proxy.conf.json).
// Staging/production are same-origin under IIS — no proxy, no CORS anywhere.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5111',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
