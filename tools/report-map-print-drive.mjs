// Report map print drive (ticket 883, BackOffice spec 3630 M34, M37, M38; ticket 910, ADR 0139: on Google): the REAL
// report print page, under a render ticket, with a map block and a bar block, printed to PDF the way the report
// renderer does (it waits for `data-print-ready`, then prints). The map is Google's: the stubbed model carries the
// `maps` part with the key from the environment. Google's hosts (`tools/google-map-hosts.mjs`, the one named list) are
// let through; every other outside request is aborted and counted (must be 0). The analytics ticket doors are stubbed
// here. Manual-run, like every drive here; not a CI gate. Each run makes billed map loads (the two drawn scenarios,
// three loads with the warm one): keep the runs few.
//
// Scenarios:
//   drawn-en / drawn-ar  Google draws the map; the page says ready only after it has; PDF to
//                        .issues/assets/910-report-map-<lang>.pdf. drawn-en also loads the page again in the same
//                        browser (warm cache) and records both times to ready.
//   blocked-en           every Google host is aborted: the map block is the table under "The map could not be drawn",
//                        the page says ready, and it still prints (.issues/assets/910-report-map-google-blocked-en.pdf)
//   refused-en           a key Google refuses (`gm_authFailure`): the same fall-back (PDF to the temp folder)
//   slow-en              Google's script is never answered: the loader gives up at 15 s, the same fall-back
//   no-key-en            the model carries no `maps` part: the same fall-back at once, and Google is never asked
//
//   1. run the app:  npx vite --port 5207 --strictPort        (the app only: no base-map file is needed any more)
//   2. GOOGLE_MAPS_KEY=<a browser key whose referrers allow localhost> DRIVE_PORT=5207 node tools/report-map-print-drive.mjs
//      (DRIVE_ONLY=drawn-en,blocked-en to run some). The key is never printed: every output line is passed through
//      `withoutKey`. Never write it into a file in git.
//
// Headless Edge with software graphics, as the PDF renderer (BackOffice 3635: `--enable-unsafe-swiftshader`). Google's
// map is raster here (`renderingType: RASTER`), so it needs no graphics card to print.
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { envelope, MODEL, REPORT_827, inlineAnswer } from './analytics-stubs.mjs'
import { GOOGLE_MAP_HOSTS, isGoogleMapHost, withoutKey } from './google-map-hosts.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`
const OUT = '.issues/assets'
const ONLY = (process.env.DRIVE_ONLY ?? '').split(',').filter(Boolean)
const label = (en, ar) => ({ en, ar })
const KEY = (process.env.GOOGLE_MAPS_KEY ?? '').trim()
// Not a key of anyone's: Google answers it with `gm_authFailure` (InvalidKeyMapError), no map load billed.
const REFUSED_KEY = 'AIzaSy-oms-react-910-not-a-key-0000000000'

// Seven stores in central Riyadh (the box 879-883 drew: 46.60-46.80 E, 24.60-24.80 N).
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
const modelWith = (key) => (key ? { ...MAP_MODEL, maps: { key } } : MAP_MODEL)

async function scenario(browser, name, { lang, key = KEY, blockGoogle = false, holdScript = false, warm = false, keep = true }) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  const outside = []
  const googleHosts = new Set()
  let googleRequests = 0
  let googleBlocked = 0
  const tickets = []
  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      if (isGoogleMapHost(url.hostname)) {
        if (blockGoogle) {
          googleBlocked++
          return route.abort()
        }
        if (holdScript && url.pathname === '/maps/api/js') return // never answered: the loader gives up at 15 s
        googleHosts.add(url.hostname)
        googleRequests++
        return route.continue()
      }
      outside.push(withoutKey(url.href, key))
      return route.abort()
    }
    const p = url.pathname.split('/api/')[1]
    if (p === undefined) return route.continue()
    if (p.startsWith('Analytics/Render/')) tickets.push(req.headers()['x-analytics-render-ticket'] ?? null)
    if (p === 'Analytics/Render/Model') return route.fulfill(envelope(modelWith(key)))
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
  page.on('console', (m) => m.type() === 'error' && errors.push(withoutKey(m.text(), key)))
  page.on('pageerror', (e) => errors.push(withoutKey(String(e), key)))
  const address = `${BASE}/analytics/print/report/r-883?period=last-7-days&lang=${lang}&ticket=T-883`

  // What the renderer does: open the page, wait for the marker, and look at the map at that moment.
  const openAndWait = async () => {
    let mapWhenNotReady = null
    const t0 = Date.now()
    await page.goto(address)
    const poll = setInterval(async () => {
      try {
        const s = await page.evaluate(() => ({ ready: document.querySelector('[data-print-ready]') !== null, map: document.querySelector('[data-map-state]')?.getAttribute('data-map-state') ?? null }))
        if (!s.ready) mapWhenNotReady = s.map
      } catch {}
    }, 250)
    await page.waitForSelector('[data-print-ready]', { timeout: 60000 })
    clearInterval(poll)
    return { readyAfterMs: Date.now() - t0, mapWhenNotReady }
  }
  const cold = await openAndWait()
  const warmRun = warm ? await openAndWait() : null
  const boxOf = () =>
    page.evaluate(() => {
      const r = document.querySelector('[data-map-state]')?.getBoundingClientRect()
      return r ? { width: Math.round(r.width), height: Math.round(r.height) } : null
    })
  const state = await page.evaluate(() => {
    const map = document.querySelector('[data-map-state]')
    const fellBack = document.querySelector('[data-map-fell-back]')
    return {
      map: map?.getAttribute('data-map-state') ?? null,
      fellBack: document.querySelector('[data-map-cannot-draw]')?.textContent ?? null,
      fallbackTableRows: fellBack ? fellBack.querySelectorAll('[data-map-table] .ag-row[row-index], [data-map-table] tbody tr').length : null,
      googleVersion: window.google?.maps?.version ?? null,
      // Google's own logo and terms, drawn by Google on the map (M34). Our own credit line is gone (908).
      googleLogo: !!map?.querySelector('img[alt="Google"], a[href*="maps.google.com/maps?"], a[title*="Google Maps"]'),
      googleTerms: [...(map?.querySelectorAll('.gm-style-cc') ?? [])].map((e) => e.textContent.trim()).filter(Boolean).join(' | ') || null,
      ourCredit: document.querySelector('a[href="https://www.openstreetmap.org/copyright"]')?.textContent ?? null,
      dir: document.documentElement.dir,
    }
  })
  const mapBox = await boxOf()
  const file = keep ? `${OUT}/910-report-map-${name.replace(/^drawn-/, '').replace(/^blocked-/, 'google-blocked-')}.pdf` : `${tmpdir()}/910-report-map-${name}.pdf`
  await page.emulateMedia({ media: 'print' })
  // The map's box in print: the same size it was drawn at (3635: a map resized between drawing and printing prints cut).
  const printBox = await boxOf()
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true })
  await context.close()
  return {
    name,
    readyAfterMs: cold.readyAfterMs,
    warmReadyAfterMs: warmRun?.readyAfterMs ?? null,
    mapStateJustBeforeReady: cold.mapWhenNotReady,
    ...state,
    mapBox,
    printBox,
    ticketHeaders: [...new Set(tickets)],
    googleHostsReached: [...googleHosts].sort(),
    googleRequests,
    googleBlocked,
    outsideRequestsAttempted: outside,
    consoleErrors: errors,
    pdf: file,
  }
}

if (!KEY) {
  console.error('report-map-print-drive: set GOOGLE_MAPS_KEY to a browser key whose referrers allow localhost')
  process.exit(2)
}
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
const failures = []
const runs = [
  ['drawn-en', { lang: 'en', warm: true }],
  ['drawn-ar', { lang: 'ar' }],
  ['blocked-en', { lang: 'en', blockGoogle: true }],
  ['refused-en', { lang: 'en', key: REFUSED_KEY, keep: false }],
  ['slow-en', { lang: 'en', holdScript: true, keep: false }],
  ['no-key-en', { lang: 'en', key: '', keep: false }],
]
try {
  for (const [name, opts] of runs) {
    if (ONLY.length && !ONLY.includes(name)) continue
    const r = await scenario(browser, name, opts)
    results.push(r)
    const fail = (why) => failures.push(`${name}: ${why}`)
    if (r.outsideRequestsAttempted.length) fail('a request outside Google’s list')
    if (r.ticketHeaders.some((h) => h !== 'T-883')) fail('a door read without the ticket')
    if (r.readyAfterMs > 60000) fail('not ready inside the report worker’s 60 s')
    if (r.googleHostsReached.some((h) => !GOOGLE_MAP_HOSTS.includes(h))) fail('a Google host off the list')
    if (name.startsWith('drawn-')) {
      if (r.map !== 'drawn' || r.fellBack !== null) fail(`the map is ${r.map}, not drawn`)
      if (!r.googleLogo) fail('no Google logo on the map')
      if (r.ourCredit !== null) fail('our own credit line is back')
      if (JSON.stringify(r.mapBox) !== JSON.stringify(r.printBox)) fail('the map was resized for print')
    } else {
      if (r.map !== null || !r.fellBack) fail('the map did not fall back to its table')
      if (opts.blockGoogle && r.googleBlocked === 0) fail('Google was not asked, so not blocked')
      if (opts.key === '' && (r.googleRequests || r.googleBlocked)) fail('Google was asked with no key')
      if (opts.holdScript && r.readyAfterMs < 15000) fail('ready before the loader gave up')
    }
  }
} finally {
  await browser.close()
}
console.log(withoutKey(JSON.stringify(results, null, 1), KEY))
for (const f of failures) console.log(`  FAILED ${f}`)
console.log(failures.length ? 'report-map-print-drive: FAILED' : 'report-map-print-drive: ok')
process.exit(failures.length ? 1 : 0)
