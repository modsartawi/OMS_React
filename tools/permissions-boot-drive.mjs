// oms 909 (BackOffice spec 4002): a cold load reads ONE `Auth/Permissions` and ZERO `*/Access` — drives the REAL app
// against a REAL SIS.Api (nothing stubbed).
//
//   1. run the app:  SIS_API=http://<sis-api-host> npx vite --port 5199
//   2. node tools/permissions-boot-drive.mjs
//
//   Signed out (default): the boot asks `Auth/Me` and `Auth/Permissions` in parallel, the permissions 401 is quiet (no
//   "session ended" toast), the app lands on /login, and no `*/Access` route is called.
//   Signed in — the walk the release is measured by (time to a settled menu):
//        SIS_SIGN_IN=window            — a visible browser opens on /login; sign in there by hand
//        SIS_COOKIE=<sis_session>      — reuse an existing session cookie
//   Then: one `Auth/Permissions`, zero `*/Access` (the AuthzAdmin role-list read only on its own page), the rail drawn.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({ headless: process.env.SIS_SIGN_IN !== 'window' })
const context = await browser.newContext()
let signedIn = false

if (process.env.SIS_COOKIE) {
  await context.addCookies([{ name: 'sis_session', value: process.env.SIS_COOKIE, url: BASE }])
  signedIn = true
} else if (process.env.SIS_SIGN_IN === 'window') {
  const login = await context.newPage()
  await login.goto(`${BASE}/login`)
  console.log('Sign in in the window…')
  const until = Date.now() + 5 * 60_000
  while (!signedIn && Date.now() < until) {
    signedIn = (await context.cookies(BASE)).some((c) => c.name === 'sis_session') && !new URL(login.url()).pathname.startsWith('/login')
    if (!signedIn) await login.waitForTimeout(250)
  }
  await login.close()
}

const page = await context.newPage()
const calls = []
const t0 = Date.now()
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname.startsWith('/api/')) calls.push({ path: url.pathname.slice(5), at: Date.now() - t0 })
})
const toasts = []
page.on('console', (m) => m.type() === 'error' && console.log('  console:', m.text().slice(0, 200)))

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })

if (signedIn) {
  // The rail draws once the one answer is in; wait for a nav link, then a quiet second for stragglers.
  await page.waitForSelector('nav a[href]', { timeout: 60_000 }).catch(() => {})
  const settledAt = Date.now() - t0
  await page.waitForTimeout(1500)
  const links = await page.locator('nav a[href]').count()
  check('the rail drew (time to a settled menu)', links > 0, `${links} links at ${settledAt} ms`)
} else {
  await page.waitForURL(/\/login/, { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(1500)
  check('an anonymous boot lands on /login', new URL(page.url()).pathname === '/login', page.url())
  toasts.push(...(await page.locator('[data-sonner-toast]').allTextContents()))
  check('the quiet permissions 401 raises no "session ended" toast', toasts.length === 0, toasts.join(' | '))
}

const perms = calls.filter((c) => c.path === 'Auth/Permissions')
const me = calls.filter((c) => c.path === 'Auth/Me')
const access = calls.filter((c) => /\/Access$|CacheAccess$/.test(c.path))
check('exactly one Auth/Permissions call', perms.length === 1, perms.map((c) => `${c.at} ms`).join(', '))
check('Auth/Permissions starts beside Auth/Me, not after it', me.length > 0 && perms.length > 0 && Math.abs(perms[0].at - me[0].at) < 500, `Me ${me[0]?.at} ms, Permissions ${perms[0]?.at} ms`)
check('zero */Access calls', access.length === 0, access.map((c) => c.path).join(', '))
console.log(`\n${calls.length} /api calls: ${[...new Set(calls.map((c) => c.path))].join(', ')}`)

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
