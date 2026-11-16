// Map proof drive (ticket 879, BackOffice spec 3630): the development proof page, `/dev/map-proof`, drawn over the
// development base-map file with the network OFF — every request to a host other than the dev server is aborted.
// Manual-run, like every drive here; not a CI gate.
//
// Per language (en, ar): waits for the panel's `data-map-state` to leave `drawing`, then reports the state, the
// requests that tried to leave the machine, the base-map byte-range answers, any 4xx/5xx, and the console errors, and
// saves a screenshot to `.issues/assets/879-map-proof-<lang>.png`.
//
//   1. run the app:  npx vite --port 5207 --strictPort        (serves the dev base-map file; see tools/basemap-dev-file.mjs)
//   2. DRIVE_PORT=5207 node tools/map-proof-drive.mjs
//
// Headless Edge with software graphics (`--use-angle=swiftshader`), as BackOffice 3634's check and the PDF renderer.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`
const OUT = '.issues/assets'

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const context = await browser.newContext({ viewport: { width: 1100, height: 760 } })
const outside = []
await context.route('**/*', (route) => {
  const url = new URL(route.request().url())
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue()
  outside.push(url.href)
  return route.abort()
})

let failed = false
const report = {}
for (const lang of ['en', 'ar']) {
  const page = await context.newPage()
  const errors = []
  const ranges = []
  const bad = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('response', (r) => {
    const u = new URL(r.url())
    if (u.pathname === '/basemap/ksa-bh.pmtiles') ranges.push(r.status())
    if (r.status() >= 400) bad.push(`${r.status()} ${u.pathname}`)
  })
  await page.goto(`${BASE}/dev/map-proof?lang=${lang}`)
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-map-state]')
    return el && el.getAttribute('data-map-state') !== 'drawing'
  }, null, { timeout: 60000 })
  const state = await page.getAttribute('[data-map-state]', 'data-map-state')
  const credit = await page.textContent('a[href="https://www.openstreetmap.org/copyright"]')
  const dir = await page.evaluate(() => document.documentElement.dir)
  const controlsLeft = await page.evaluate(() => !!document.querySelector('.maplibregl-ctrl-top-left .maplibregl-ctrl-zoom-in'))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/879-map-proof-${lang}.png` })
  report[lang] = { state, dir, credit, controlsAtTopLeft: controlsLeft, rangeAnswers: ranges.length, all206: ranges.every((s) => s === 206), bad, consoleErrors: errors }
  if (state !== 'drawn' || ranges.length === 0 || !ranges.every((s) => s === 206) || bad.length || credit !== '© OpenStreetMap') failed = true
  if (controlsLeft !== (lang === 'ar')) failed = true
  await page.close()
}
await browser.close()
report.outsideRequestsAttempted = outside
if (outside.length) failed = true
console.log(JSON.stringify(report, null, 1))
console.log(failed ? 'map-proof-drive: FAILED' : 'map-proof-drive: ok')
process.exit(failed ? 1 : 0)
