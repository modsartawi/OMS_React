import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// --- Build stamp (issue 435) -------------------------------------------------
// Computed once so the `define` constants and the /version.json asset agree byte
// for byte. Git failures degrade to 'unknown' rather than breaking the build.
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

function gitSha(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim()
    let dirty = ''
    try {
      if (execSync('git status --porcelain').toString().trim()) dirty = '-dirty'
    } catch {
      /* status unavailable — report the clean sha */
    }
    return sha + dirty
  } catch {
    return 'unknown'
  }
}

function localBuildTime(): string {
  // Local wall-clock, per the estate no-utc-time rule — never UTC / ISO-Z.
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const VERSION: string = pkg.version
const SHA = gitSha()
const BUILD_TIME = localBuildTime()

// Emits /version.json into dist/ so an operator can GET it same-origin (no login)
// to see which build is live. Build-only — dev serves nothing here.
function versionAsset(): Plugin {
  return {
    name: 'oms-version-asset',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: VERSION, sha: SHA, buildTime: BUILD_TIME }, null, 2) + '\n',
      })
    },
  }
}

// Dev-only proxy: the browser talks same-origin (/api/...) so the HttpOnly
// sis_session cookie round-trips untouched; SIS.Api itself serves at the root,
// so the /api prefix is stripped (matches the Angular prototype's proxy.conf.json).
// Staging/production are same-origin under IIS — no proxy, no CORS anywhere; the
// prod client uses base `/` (see src/core/api.ts, issue 435).
export default defineConfig({
  plugins: [react(), tailwindcss(), versionAsset()],
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
    __BUILD_SHA__: JSON.stringify(SHA),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      // DataSync (spec 558, ticket 559) is its own service. Listed BEFORE '/api': the first
      // matching key wins. Production is unchanged — IIS on the SIS.Api host proxies /DataSync/*.
      // DATASYNC_API points it elsewhere; only that run loosens TLS and rewrites the cookie.
      '/api/DataSync': {
        target: process.env.DATASYNC_API || 'http://127.0.0.1:5280',
        changeOrigin: true,
        ...(process.env.DATASYNC_API ? { secure: false, cookieDomainRewrite: '' } : {}),
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      '/api': {
        // SIS_API points the proxy at another SIS.Api (staging, for a live drive — ticket 455).
        // Only that run loosens TLS and rewrites the session cookie onto localhost.
        target: process.env.SIS_API || 'http://localhost:5111',
        changeOrigin: true,
        ...(process.env.SIS_API ? { secure: false, cookieDomainRewrite: '' } : {}),
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
