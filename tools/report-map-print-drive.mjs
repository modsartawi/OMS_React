// Report map print drive (ticket 883, BackOffice spec 3630 M34, M37, M38): the REAL report print page, under a render
// ticket, with a map block and a bar block, printed to PDF the way the report renderer does (it waits for
// `data-print-ready`, then prints). It replaced 879's development proof page. Network OFF: every request to a host
// other than the dev server is aborted; the analytics ticket doors are stubbed here.
// Manual-run, like every drive here; not a CI gate.
//
// Scenarios:
//   drawn-en / drawn-ar  the map draws; the page says ready only after it has; PDF to .issues/assets/883-report-map-<lang>.pdf
//   timeout-en           the base map never answers; after 20 s the map block is the table with "The map could not be
//                        drawn", the page says ready, and it still prints (.issues/assets/883-report-map-timeout-en.pdf)
//
//   1. run the app:  npx vite --port 5207 --strictPort        (serves the dev base-map file; see tools/basemap-dev-file.mjs)
//   2. DRIVE_PORT=5207 node tools/report-map-print-drive.mjs   (DRIVE_ONLY=drawn-en to run one)
//
// Headless Edge with software graphics, as the PDF renderer (BackOffice 3635: `--enable-unsafe-swiftshader`).
import { createRequire } from 'node:module'
import { envelope, MODEL, REPORT_827, inlineAnswer } from './analytics-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`
const OUT = '.issues/assets'
const ONLY = (process.env.DRIVE_ONLY ?? '').split(',').filter(Boolean)
const label = (en, ar) => ({ en, ar })

// Seven stores inside the development base-map file's box (central Riyadh, 46.60-46.80 E, 24.60-24.80 N; BackOffice 3634).
const STORES = [
  ['P001', 'Olaya', 24.6943, 46.6853, 1200],
  ['P002', 'Malaz', 24.6612, 46.7311, 940],
  ['P003', 'Sulimaniyah', 24.7065, 46.6995, 780],
  ['P004', 'Murabba', 24.6489, 46.7102, 610],
  ['P005', 'Wurud', 24.7244, 46.6702, 450],
  ['P006', 'Diplomatic Quarter', 24.6801, 46.6283, 300],
  ['P007', 'Rawdah', 24.7352, 46.7604, 120],
]
const MAP_ANSWER = {
  columns: [
    { key: 'store', role: 'dimension' },
    { key: 'till_value', role: 'measure', shape: 'additive', unit: 'SAR' },
    { key: 'latitude', role: 'place' },
    { key: 'longitude', role: 'place' },
    { key: 'store_name', role: 'place' },
    { key: 'city', role: 'place' },
  ],
  rows: STORES.map(([store, name, latitude, longitude, value]) => ({ store, till_value: value, latitude, longitude, store_name: name, city: 'Riyadh' })),
  total: STORES.length,
  truncated: false,
  period: { from: '2026-10-30', to: '2026-11-05' },
  previous: [],
  fetchedAt: '2026-11-05T10:00:00',
  dataAsOf: '2026-11-05T09:45:00',
}
const def = (type, measures, dimensions) => ({ chart: { type }, query: { measures, dimensions, filters: [], period: 'last-30-days' } })
const BAR = def('bar', ['till_value'], ['channel_group'])
const REPORT = {
  ...REPORT_827,
  id: 'r-883',
  title: label('Stores on the map', 'الفروع على الخريطة'),
  definition: {
    params: REPORT_827.definition.params.filter((p) => p.key === 'period'),
    bindings: { period: { m1: true, b1: true } },
    sections: [
      {
        id: 's1',
        heading: label('Till sales by store', 'مبيعات نقاط البيع حسب الفرع'),
        blocks: [{ id: 'm1', kind: 'panel', title: label('Till sales by store', 'مبيعات نقاط البيع حسب الفرع'), definition: def('map', ['till_value'], ['store']) }],
      },
      { id: 's2', heading: label('By channel', 'حسب القناة'), blocks: [{ id: 'b1', kind: 'panel', title: label('Till sales by channel', 'مبيعات نقاط البيع حسب القناة'), definition: BAR }] },
    ],
  },
}
const MAP_MODEL = { ...MODEL, chartTypes: ['kpi', 'line', 'area', 'bar', 'donut', 'table', 'heatmap', 'combo', 'map'] }

async function scenario(browser, name, { lang, holdBaseMap = false }) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  const outside = []
  const tickets = []
  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      outside.push(url.href)
      return route.abort()
    }
    if (holdBaseMap && url.pathname === '/basemap/ksa-bh.pmtiles') return // never answered: the map cannot finish
    const p = url.pathname.split('/api/')[1]
    if (p === undefined) return route.continue()
    if (p.startsWith('Analytics/Render/')) tickets.push(req.headers()['x-analytics-render-ticket'] ?? null)
    if (p === 'Analytics/Render/Model') return route.fulfill(envelope(MAP_MODEL))
    if (p === 'Analytics/Render/Report/r-883') return route.fulfill(envelope(REPORT))
    if (p === 'Analytics/Render/Report/r-883/Words') return route.fulfill(envelope({ figures: {}, summary: { unavailable: 'No summary block.' } }))
    if (p === 'Analytics/Render/Query') {
      const body = req.postDataJSON() ?? {}
      return route.fulfill(envelope(body.panelId === 'm1' ? MAP_ANSWER : inlineAnswer(BAR, MODEL)))
    }
    return route.fulfill({ status: 404, contentType: 'text/plain', body: '' })
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))
  const t0 = Date.now()
  await page.goto(`${BASE}/analytics/print/report/r-883?period=last-7-days&lang=${lang}&ticket=T-883`)
  // What the renderer does: wait for the marker, and look at the map at that moment.
  let mapWhenNotReady = null
  const poll = setInterval(async () => {
    try {
      const s = await page.evaluate(() => ({ ready: document.querySelector('[data-print-ready]') !== null, map: document.querySelector('[data-map-state]')?.getAttribute('data-map-state') ?? null }))
      if (!s.ready) mapWhenNotReady = s.map
    } catch {}
  }, 250)
  await page.waitForSelector('[data-print-ready]', { timeout: 60000 })
  clearInterval(poll)
  const readyAfterMs = Date.now() - t0
  const state = await page.evaluate(() => ({
    map: document.querySelector('[data-map-state]')?.getAttribute('data-map-state') ?? null,
    fellBack: document.querySelector('[data-map-cannot-draw]')?.textContent ?? null,
    credit: document.querySelector('a[href="https://www.openstreetmap.org/copyright"]')?.textContent ?? null,
    dir: document.documentElement.dir,
  }))
  const file = `${OUT}/883-report-map-${name.replace(/^drawn-/, '')}.pdf`
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await context.close()
  return { name, readyAfterMs, mapStateJustBeforeReady: mapWhenNotReady, ...state, ticketHeaders: [...new Set(tickets)], outsideRequestsAttempted: outside, consoleErrors: errors, pdf: file }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
let failed = false
const runs = [
  ['drawn-en', { lang: 'en' }],
  ['drawn-ar', { lang: 'ar' }],
  ['timeout-en', { lang: 'en', holdBaseMap: true }],
]
for (const [name, opts] of runs) {
  if (ONLY.length && !ONLY.includes(name)) continue
  const r = await scenario(browser, name, opts)
  results.push(r)
  const timedOut = opts.holdBaseMap
  if (r.outsideRequestsAttempted.length || r.ticketHeaders.some((h) => h !== 'T-883')) failed = true
  if (!timedOut && (r.map !== 'drawn' || r.credit !== '© OpenStreetMap' || r.fellBack !== null)) failed = true
  if (timedOut && (r.map !== null || !r.fellBack || r.readyAfterMs < 20000)) failed = true
}
await browser.close()
console.log(JSON.stringify(results, null, 1))
console.log(failed ? 'report-map-print-drive: FAILED' : 'report-map-print-drive: ok')
process.exit(failed ? 1 : 0)
