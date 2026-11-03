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
// PROTOTYPE 754 — stands in for SIS.Api minting a Superset guest token for the signed-in user.
// Server-side: logs in with a service account and calls /api/v1/security/guest_token/.
function supersetGuestToken(): Plugin {
  const SS = process.env.SS_URL || 'http://10.211.55.2:8088'
  return {
    name: 'proto-754-superset-guest-token',
    configureServer(server) {
      server.middlewares.use('/ssguest', async (req, res) => {
        const id = new URL(req.url ?? '', 'http://x').searchParams.get('id') ?? ''
        const login = await fetch(`${SS}/api/v1/security/login`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'admin', password: 'Proto-754-demo!', provider: 'db' }),
        }).then((r) => r.json())
        const g = await fetch(`${SS}/api/v1/security/guest_token/`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.access_token}` },
          body: JSON.stringify({ user: { username: 'hq.demo', first_name: 'HQ', last_name: 'Demo' }, resources: [{ type: 'dashboard', id }], rls: [] }),
        }).then((r) => r.json())
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ token: g.token }))
      })
    },
  }
}

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
  plugins: [react(), tailwindcss(), versionAsset(), supersetGuestToken()],
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
      // PROTOTYPE 747 — the Ask variant's create-view call to local Metabase (same-origin, no CORS).
      '/mbapi': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (p) => p.replace(/^\/mbapi/, '/api') },
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
