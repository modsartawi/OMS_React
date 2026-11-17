// Copilot map drive (oms-react 884, BackOffice spec 3630 M42, ticket 3641): the screenshots for the proof box "A reader
// with the view grant only sees the map on the local stack, in English and in Arabic".
//
// The REAL app (dev server) with the doors stubbed: the reader holds the analytics VIEW grant only
// (`Analytics/Access` → canView, no author / curator / SQL; `Copilot/Access` → canAsk, no curate / MCP). The panel asks
// one question and `Copilot/Ask` answers with 3641's wire: one table carrying a map part — till sales by store (size)
// with the change on the previous week (colour, kind `change`), 12 stores in the development base-map file's box
// (central Riyadh, 46.60-46.80 E, 24.60-24.80 N; BackOffice 3634) plus one store with no coordinates, so the
// "not on the map" line shows. The base map is the dev server's own `/basemap/ksa-bh.pmtiles` (206 ranges).
// Network OFF: every request to a host other than the dev server is aborted and counted (must be 0).
//
// Writes .issues/assets/884-copilot-map-{en,ar}.png (the panel), 884-copilot-map-card-en.png (a store's card open) and
// 884-copilot-map-larger-en.png ("Larger map" open).
// Manual-run, like every drive here; not a CI gate.
//
//   1. run the app:  npx vite --port 5208 --strictPort
//   2. DRIVE_PORT=5208 node tools/copilot-map-drive.mjs        (DRIVE_ONLY=en,ar,card-en,larger-en to run some)
//
// Headless Edge with software graphics, as the map drives before it (879, 883).
import { createRequire } from 'node:module'
import { MODEL } from './analytics-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5208}`
const OUT = '.issues/assets'
const ONLY = (process.env.DRIVE_ONLY ?? '').split(',').filter(Boolean)
const label = (en, ar) => ({ en, ar })
const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// The reader: the analytics view grant, nothing more.
const ANALYTICS_ACCESS = { canView: true, canAuthor: false, canCurate: false, canSql: false }
const COPILOT_ACCESS = { canAsk: true, canUseMcp: false, canCurate: false }

// [store, name, latitude, longitude, till sales SAR, change %, step]
const STORES = [
  ['P001', 'Olaya', '24.6943', '46.6853', '184250.75', '8.4', 'better'],
  ['P002', 'Malaz', '24.6612', '46.7311', '142900.10', '-2.1', 'same'],
  ['P003', 'Sulimaniyah', '24.7065', '46.6995', '131480.00', '12.7', 'better'],
  ['P004', 'Murabba', '24.6489', '46.7102', '98720.40', '-7.9', 'worse'],
  ['P005', 'Wurud', '24.7244', '46.6702', '91310.25', '3.6', 'same'],
  ['P006', 'Diplomatic Quarter', '24.6801', '46.6283', '76540.00', '-11.3', 'worse'],
  ['P007', 'Rawdah', '24.7352', '46.7604', '68215.90', '5.0', 'better'],
  ['P008', 'Nakheel', '24.7561', '46.6420', '64880.00', '-4.8', 'same'],
  ['P009', 'Naseem', '24.7280', '46.7891', '52310.60', '-6.2', 'worse'],
  ['P010', 'Shifa', '24.6152', '46.7208', '41975.30', '9.9', 'better'],
  ['P011', 'Aziziyah', '24.6045', '46.7632', '33400.00', null, 'none'],
  ['P012', 'Yasmin', '24.7820', '46.6511', '27650.45', '1.2', 'same'],
]
const UNPLACED = ['P013', 'Qurtubah (new)', null, null, '15220.00', null, 'none']

const col = (key, role, en, ar, unit = null, calculation = null) => ({
  key,
  role,
  label: label(en, ar),
  unit,
  shape: role === 'measure' ? (unit === 'percent' ? 'rate' : 'additive') : null,
  dateBasis: null,
  calculation,
  variant: null,
})
const MAP_TABLE = {
  step: 0,
  columns: [
    col('store', 'dimension', 'Store', 'الفرع'),
    col('till_value', 'measure', 'Till sales', 'مبيعات نقاط البيع', 'SAR'),
    col('change', 'measure', 'Change in Till sales', 'التغير في مبيعات نقاط البيع', 'percent', { kind: 'change', measure: 'till_value', of: null, within: null }),
    col('latitude', 'place', 'latitude', 'latitude'),
    col('longitude', 'place', 'longitude', 'longitude'),
    col('store_name', 'place', 'Store name', 'اسم الفرع'),
    col('city', 'place', 'City', 'المدينة'),
    col('hollow', 'legend', 'hollow', 'hollow'),
    col('colour_step', 'legend', 'colour_step', 'colour_step'),
  ],
  rows: [...STORES, UNPLACED].map(([store, name, lat, lon, sales, change, step]) => ({
    values: [store, sales, change, lat, lon, name, 'Riyadh', 'false', step],
    isTotal: null,
  })),
  total: STORES.length + 1,
  truncated: false,
  periodFrom: '2026-11-09',
  periodTo: '2026-11-15',
  previous: null,
  previousFrom: '2026-11-02',
  previousTo: '2026-11-08',
  dataAsOf: '2026-11-16T08:00:00',
  notes: { untilReached: null, untilReachedByParent: null, notSplit: null, notFiltered: null, dataGap: null },
  query: {
    measures: ['till_value'],
    dimensions: ['store'],
    filters: [{ dimension: 'city', values: ['riyadh'] }],
    period: 'last-week',
    calculations: [{ key: 'change', kind: 'change', measure: 'till_value' }],
  },
  map: {
    legend: {
      size: { key: 'till_value', label: label('Till sales', 'مبيعات نقاط البيع'), min: 15220, max: 184250.75, additive: true },
      colour: {
        key: 'change',
        label: label('Change in Till sales', 'التغير في مبيعات نقاط البيع'),
        kind: 'change',
        steps: [
          { id: 'worse', from: null, to: -5, label: label('Worse: down 5 % or more', 'أسوأ: انخفاض 5 % أو أكثر') },
          { id: 'same', from: -5, to: 5, label: label('About the same: less than 5 % either way', 'نفسه تقريبا: أقل من 5 % في أي اتجاه') },
          { id: 'better', from: 5, to: null, label: label('Better: up 5 % or more', 'أفضل: ارتفاع 5 % أو أكثر') },
          { id: 'none', from: null, to: null, label: label('No earlier figure', 'لا يوجد رقم سابق') },
        ],
      },
      notOnMap: 1,
    },
  },
}
const QUESTION = { en: 'Show me last week’s sales by store in Riyadh on a map', ar: 'اعرض لي مبيعات الأسبوع الماضي حسب الفرع في الرياض على خريطة' }
const WORDS = {
  en:
    'Last week (9–15 November) Olaya sold the most in Riyadh, SAR 184,250.75, up 8.4 % on the week before. ' +
    'Diplomatic Quarter fell the most, down 11.3 %. Qurtubah has no coordinates yet, so it is in the table but not on the map.',
  ar:
    'في الأسبوع الماضي (9–15 نوفمبر) كان فرع العليا الأعلى مبيعا في الرياض، 184,250.75 ريال، بارتفاع 8.4 % عن الأسبوع الذي قبله. ' +
    'وكان الحي الدبلوماسي الأكثر انخفاضا، 11.3 %. فرع قرطبة بلا إحداثيات بعد، فهو في الجدول وليس على الخريطة.',
}
const answerIn = (lang) => ({ ...ANSWER, answer: WORDS[lang] })
const ANSWER = {
  conversationId: 'c-0884',
  questionNo: 1,
  answer: WORDS.en,
  orderRefs: [],
  trace: [{ tool: 'semantic_query', input: { measures: ['till_value'], dimensions: ['store'], period: 'last-week' }, rows: 13, ms: 240, ok: true }],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude-opus-5-5',
  askedAt: '2026-11-17T10:15:00',
  tables: [MAP_TABLE],
}

async function scenario(browser, name, { lang, card = false, larger = false }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1500 }, deviceScaleFactor: 1 })
  const outside = []
  const basemap = []
  const asks = []
  const accessReads = []
  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      outside.push(url.href)
      return route.abort()
    }
    if (url.pathname === '/basemap/ksa-bh.pmtiles') {
      const res = await route.fetch()
      basemap.push(res.status())
      return route.fulfill({ response: res })
    }
    const p = url.pathname.split('/api/')[1]
    if (p === undefined) return route.continue()
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'reader884', currentStoreCode: 'P001' }))
    if (p === 'Copilot/Access') return route.fulfill(envelope(COPILOT_ACCESS))
    if (p === 'Analytics/Access') {
      accessReads.push(p)
      return route.fulfill(envelope(ANALYTICS_ACCESS))
    }
    if (p === 'Analytics/Model') return route.fulfill(envelope(MODEL))
    if (p === 'Copilot/Starters') return route.fulfill(envelope({ starters: [] }))
    if (p === 'Copilot/Ask') {
      asks.push(req.postDataJSON())
      await new Promise((r) => setTimeout(r, 400))
      return route.fulfill(envelope(answerIn(lang)))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  const page = await context.newPage()
  await page.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'true')
  }, lang)
  const errors = []
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(`${BASE}/`)
  const button = page.locator('#layout-topbar [data-copilot-button]')
  await button.waitFor({ timeout: 30000 })
  // The shell has no language switch yet (`@/core/i18n` boots `en`; `oms.locale` sets only `<html dir>`). For Arabic,
  // switch the app's own i18next instance, as the print pages do with `?lang=ar` — before the question, so the map
  // mounts in Arabic (its language is read at mount).
  if (lang === 'ar') await page.evaluate(async () => (await import('/src/core/i18n.ts')).default.changeLanguage('ar'))
  await button.click()
  const sheet = page.locator('dialog[data-copilot-sheet]')
  await sheet.locator('[data-copilot-question]').fill(QUESTION[lang])
  await sheet.locator('[data-copilot-send]').click()
  await sheet.locator('[data-copilot-answer]').waitFor({ timeout: 15000 })
  const mapFrame = sheet.locator('[data-map-state]').first()
  await mapFrame.waitFor({ timeout: 30000 })
  await page.waitForFunction(() => document.querySelector('dialog[data-copilot-sheet] [data-map-state]')?.getAttribute('data-map-state') !== 'drawing', null, { timeout: 60000 })
  const mapState = await mapFrame.getAttribute('data-map-state')
  await sheet.locator('[data-copilot-table] .ag-row').first().waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)

  let cardText = null
  if (card) {
    // A store's card: move over the map until a card shows (the points are on a canvas, so search it).
    const box = await mapFrame.boundingBox()
    outer: for (let y = box.y + 8; y < box.y + box.height - 8; y += 6) {
      for (let x = box.x + 8; x < box.x + box.width - 8; x += 6) {
        await page.mouse.move(x, y)
        const c = await sheet.locator('[data-map-card]').count()
        if (c) {
          await page.waitForTimeout(150)
          cardText = (await sheet.locator('[data-map-card]').first().innerText()).replace(/\s+/g, ' ').trim()
          if (/Riyadh/.test(cardText)) {
            await page.mouse.click(x, y) // pin it, so it stays for the picture
            await page.waitForTimeout(300)
            break outer
          }
        }
      }
    }
  }

  const state = await page.evaluate(() => {
    const s = document.querySelector('dialog[data-copilot-sheet]')
    return {
      dir: document.documentElement.dir,
      legend: s.querySelector('[data-map-legend]')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      notOnMap: s.querySelector('[data-map-not-on-map]')?.innerText.replace(/\s+/g, ' ').trim() ?? null,
      credit: s.querySelector('a[href="https://www.openstreetmap.org/copyright"]')?.textContent ?? null,
      larger: s.querySelector('[data-copilot-map-larger]') !== null,
      tableRows: new Set([...s.querySelectorAll('[data-copilot-table] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size,
      sendLabel: s.querySelector('[data-copilot-send]')?.innerText.trim() ?? null,
      authorOnly: s.querySelector('[data-copilot-view-open], [data-copilot-open-view]') !== null,
    }
  })

  // The whole answer in one picture: the sheet's scrolling body grows to its content for the shot.
  await page.evaluate(() => {
    const s = document.querySelector('dialog[data-copilot-sheet]')
    const answer = s.querySelector('[data-copilot-answer]')
    answer?.closest('[data-copilot-turn]')?.scrollIntoView({ block: 'start' })
  })
  await page.waitForTimeout(300)
  const file = `${OUT}/884-copilot-map-${card ? 'card-' : ''}${lang}.png`
  await sheet.screenshot({ path: file })

  // "Larger map": the same map in a wide dialog, where fewer stores are grouped.
  let largerState = null
  let largerFile = null
  if (larger) {
    await sheet.locator('[data-copilot-map-larger]').click()
    await page.waitForFunction(() => document.querySelectorAll('[data-map-state]').length > 1, null, { timeout: 30000 })
    await page.waitForFunction(() => [...document.querySelectorAll('[data-map-state]')].every((m) => m.getAttribute('data-map-state') !== 'drawing'), null, { timeout: 60000 })
    await page.waitForTimeout(600)
    const frames = page.locator('[data-map-state]')
    largerState = await frames.nth((await frames.count()) - 1).getAttribute('data-map-state')
    largerFile = `${OUT}/884-copilot-map-larger-${lang}.png`
    await page.locator('dialog[open]').last().screenshot({ path: largerFile })
  }
  await context.close()
  return { name, mapState, largerState, largerFile, ...state, cardText, basemapStatuses: [...new Set(basemap)], asks: asks.length, analyticsAccessReads: accessReads.length, outsideRequests: outside.length, outside, consoleErrors: errors, file }
}

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const results = []
let failed = false
const runs = [
  ['en', { lang: 'en' }],
  ['ar', { lang: 'ar' }],
  ['card-en', { lang: 'en', card: true }],
  ['larger-en', { lang: 'en', larger: true }],
]
try {
  for (const [name, opts] of runs) {
    if (ONLY.length && !ONLY.includes(name)) continue
    const r = await scenario(browser, name, opts)
    results.push(r)
    if (r.mapState !== 'drawn' || r.outsideRequests || !r.legend || !r.notOnMap || r.credit !== '© OpenStreetMap' || r.tableRows === 0) failed = true
    if (opts.lang === 'ar' && r.dir !== 'rtl') failed = true
    if (opts.card && !r.cardText) failed = true
    if (opts.larger && r.largerState !== 'drawn') failed = true
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify(results, null, 1))
console.log(failed ? 'copilot-map-drive: FAILED' : 'copilot-map-drive: ok')
process.exit(failed ? 1 : 0)
