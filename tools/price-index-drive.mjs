// Ticket 938 drive — leadership reads the price index with us at 100, and the lowest-price score (BackOffice spec 4127,
// decisions 5 and 8). Drives the REAL app in Chromium against STUBBED `PriceWatch/*` and `Analytics/Query` envelopes.
//
// ⚠ GUESSED (BO 4132, not built): the Cube members. The stub answers `Analytics/Query` for the flipped
// `shelf_price_index` / `paid_price_index` (unit `share`, theirs ÷ ours: 1.10 → 110), `price_indexed_materials`, and the
// lowest-price score's `shelf_lowest_price_flagged` / `paid_lowest_price_flagged` / `lowest_price_counted`; dims
// `competitor`, `category`, `date` (grain day | week). Contract source: scratchpad 4127/contracts.md "BO 4132".
// `PriceWatch/Alerts/Mine` follows the SHIPPED contract (pricing2, 2026-11-21). Still owed: the walk on the 4132 image.
//
//   1. a user holding PriceWatch:03 + Analytics:03 with an OPEN price alert of their own: Alerts opens; Index is first.
//   2. the same user with none of their own: Index opens. A competitor above 100 reads "They are dearer" (fine), below
//      100 "They are cheaper" (the warning); the A-level table and the trend draw; the score tile reads flagged ÷ counted.
//   3. Shelf → Paid: the queries ask for the paid measures, and the figures change.
//   4. the score members refused (ANALYTICS-406, an image without 4132): the score says the figures are not in the model
//      yet; the index still shows.
//   5. PriceWatch:03 alone: no Index tab and no `Analytics/Query` call.
//   6. RTL (oms.locale = ar): renders, no raw keys. No page errors anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/price-index-drive.mjs
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROOT = BASE + '/analytics/price-command-center'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const refusal = (code, message) => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 400, success: false, message, errors: [{ errorMessage: message, errorCode: code, internalErrorCode: '' }], data: null }),
})
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')

const ALERT = {
  alertId: 'A-1', materialNumber: '100012345', competitorCode: 'NAHDI', matchId: 'M-1', listingId: 'L-1', status: 'OPEN', isLive: true,
  categoryCode: 'A004', thresholdPercent: 5, currency: 'SAR', ourBasicPrice: 25, ourEffectivePrice: 22.5, ourPriceDay: '2026-11-21',
  theirRegularPrice: 21, theirOfferPrice: 19.95, theirPrice: 19.95, sellerName: 'Nahdi Online', observedAt: '2026-11-21T08:15:00',
  previousObservedAt: null, gapAmount: 2.55, gapPercent: 11.33, thirtyDayUnits: 400, unitsSource: 'SALES', valueAtRisk: 1020,
  recommendedPrice: 19.95, recommendedFrom: 'NAHDI', floorStatus: 'NOT_SET', floorText: 'floor not set', openedAt: '2026-11-21T08:20:00',
  updatedAt: '2026-11-21T08:20:00', resolvedAt: null, resolvedReason: '', dismissedAtGapPercent: 0, categoryManager: 'CM01', ownerUserId: 'msartawi',
}
const COVERAGE = [
  { competitorCode: 'AMAZON_SA', competitorName: 'Amazon SA', watched: 500, exact: 120, comparable: 30, notCarried: 10, open: 340 },
  { competitorCode: 'NAHDI', competitorName: 'Nahdi', watched: 500, exact: 300, comparable: 20, notCarried: 5, open: 175 },
]
// Shares (theirs ÷ ours). Shelf: Nahdi dearer, Amazon cheaper. Paid: both cheaper.
const INDEX = { shelf: { NAHDI: 1.1, AMAZON_SA: 0.924 }, paid: { NAHDI: 0.97, AMAZON_SA: 0.881 } }
const SCORE = { shelf: { '': [45, 60], NAHDI: [50, 60], AMAZON_SA: [30, 60] }, paid: { '': [30, 60], NAHDI: [40, 60], AMAZON_SA: [20, 60] } }
const DAYS = ['2026-11-01', '2026-11-08', '2026-11-15']

function cube(q) {
  const basis = q.measures.some((m) => m.startsWith('paid_')) ? 'paid' : 'shelf'
  const index = `${basis}_price_index`
  const flagged = `${basis}_lowest_price_flagged`
  const dims = q.dimensions.join(',')
  const col = (key, role, unit) => ({ key, role, shape: role === 'measure' ? 'rate' : null, unit: unit ?? null })
  if (q.measures.includes(index)) {
    const comps = Object.keys(INDEX[basis])
    if (dims === 'competitor')
      return { columns: [col('competitor', 'dimension'), col(index, 'measure', 'share'), col('price_indexed_materials', 'measure', 'count')],
        rows: comps.map((c) => ({ competitor: c, [index]: INDEX[basis][c], price_indexed_materials: 120 })) }
    if (dims === 'category,competitor')
      return { columns: [col('category', 'dimension'), col('competitor', 'dimension'), col(index, 'measure', 'share')],
        rows: ['A001', 'A004'].flatMap((a, i) => comps.map((c) => ({ category: a, competitor: c, [index]: INDEX[basis][c] + i * 0.02 }))) }
    if (dims === 'competitor,date')
      return { columns: [col('competitor', 'dimension'), col('date', 'dimension'), col(index, 'measure', 'share')],
        rows: DAYS.flatMap((d, i) => comps.map((c) => ({ competitor: c, date: d + 'T00:00:00.000', [index]: INDEX[basis][c] + i * 0.01 }))) }
  }
  if (q.measures.includes(flagged)) {
    const cols = [col(flagged, 'measure', 'count'), col('lowest_price_counted', 'measure', 'count')]
    const row = (k) => ({ [flagged]: SCORE[basis][k][0], lowest_price_counted: SCORE[basis][k][1] })
    if (dims === '') return { columns: cols, rows: [row('')] }
    if (dims === 'competitor') return { columns: [col('competitor', 'dimension'), ...cols], rows: ['AMAZON_SA', 'NAHDI'].map((c) => ({ competitor: c, ...row(c) })) }
    if (dims === 'date') return { columns: [col('date', 'dimension'), ...cols], rows: DAYS.map((d, i) => ({ date: d, [flagged]: SCORE[basis][''][0] - i, lowest_price_counted: 60 })) }
  }
  return { columns: [], rows: [] }
}
const result = (r) => ({ ...r, total: r.rows.length, truncated: false, period: { from: '2026-10-26', to: '2026-11-22' }, previous: [], fetchedAt: '2026-11-22T08:00:00', dataAsOf: '2026-11-22T07:00:00' })

const browser = await chromium.launch()

async function open(keys, { dir = 'ltr', mine = [], scoreRefused = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.split('/api/')[1]
    const body = req.postData() ? JSON.parse(req.postData()) : null
    calls.push({ path, params: Object.fromEntries(url.searchParams), body })
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
    if (path === 'PriceWatch/Matching/Coverage') return route.fulfill(envelope(COVERAGE))
    if (path === 'PriceWatch/Alerts/Mine' || path === 'PriceWatch/Alerts') return route.fulfill(envelope(mine))
    if (path === 'Analytics/Query') {
      const q = body.definition.query
      if (scoreRefused && q.measures.some((m) => m.includes('lowest_price')))
        return route.fulfill(refusal('ANALYTICS-406', "Unknown measure 'shelf_lowest_price_flagged'."))
      return route.fulfill(envelope(result(cube(q))))
    }
    return route.fulfill(envelope({}))
  })
  return { page, context, errors, calls }
}

const rawKey = (text) => text.match(/\b(?:price-command-center:)?(?:index|alerts|tabs|access)\.[a-zA-Z.-]+\b/)
const BOTH = ['PriceWatch:03', 'Analytics:03']
const queried = (calls) => calls.filter((c) => c.path === 'Analytics/Query').flatMap((c) => c.body.definition.query.measures)

try {
  // ── 1: own open alerts → Alerts ──
  {
    const { page, context, errors } = await open(BOTH, { mine: [ALERT] })
    await page.goto(ROOT)
    await page.waitForSelector('[data-tab-panel="alerts"]')
    const tabs = await page.locator('[role="tablist"] [data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))
    check('1. Index is the first tab', tabs[0] === 'index', JSON.stringify(tabs))
    check('1. with an open price alert of their own, Alerts opens', (await page.locator('[data-tab-panel]').getAttribute('data-tab-panel')) === 'alerts')
    check('1. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–3: none of their own → Index ──
  {
    const { page, context, errors, calls } = await open(BOTH)
    await page.goto(ROOT)
    await page.waitForSelector('[data-tab-panel="index"]')
    await page.waitForSelector('[data-index-competitor="NAHDI"] [data-index-tone]')
    check('2. with no open price alert of their own, Index opens', true)
    const nahdi = page.locator('[data-index-competitor="NAHDI"]')
    const amazon = page.locator('[data-index-competitor="AMAZON_SA"]')
    check('2. 1.10 reads 110.0 "They are dearer"', strip(await nahdi.innerText()).includes('110.0') && strip(await nahdi.innerText()).includes('They are dearer'), strip(await nahdi.innerText()))
    check('2. …in the fine tone', (await nahdi.locator('[data-index-tone]').getAttribute('data-index-sev')) === 'ok')
    check('2. 0.924 reads 92.4 "They are cheaper"', strip(await amazon.innerText()).includes('92.4') && strip(await amazon.innerText()).includes('They are cheaper'), strip(await amazon.innerText()))
    check('2. …as the warning', (await amazon.locator('[data-index-tone]').getAttribute('data-index-sev')) === 'warn')
    check('2. competitors named off the coverage', strip(await nahdi.innerText()).includes('NAHDI · Nahdi'))
    await page.waitForSelector('[data-index-category="A004"]')
    check('2. the A-level table has a row per A-level', (await page.locator('[data-index-category]').count()) === 2)
    await page.waitForSelector('[data-index-section="trend"] svg')
    check('2. the trend draws', (await page.locator('[data-index-section="trend"] svg').count()) > 0)
    await page.waitForSelector('[data-index-score-tile]')
    const tiles = await page.locator('[data-index-score-tile]').allInnerTexts()
    check('2. score tiles: all competitors + one per competitor', tiles.length === 3, String(tiles.length))
    check('2. the overall tile reads 75.0% (45 ÷ 60)', strip(tiles[0]).includes('75.0%') && strip(tiles[0]).includes('45 of 60 materials'), strip(tiles[0]))
    const explains = await page.locator('[data-index-explain]').count()
    check('2. each figure has its one-line explanation', explains === 4, String(explains))
    check('2. shelf measures asked', queried(calls).includes('shelf_price_index') && queried(calls).includes('shelf_lowest_price_flagged') && !queried(calls).some((m) => m.startsWith('paid_')))

    // 3. Shelf → Paid
    await page.click('[data-index-basis-chip="paid"]')
    await page.waitForFunction(() => document.querySelector('[data-index-competitor="NAHDI"]')?.textContent?.includes('97.0'))
    check('3. Paid asks for the paid index', queried(calls).includes('paid_price_index'))
    check('3. …and the paid lowest-price score', queried(calls).includes('paid_lowest_price_flagged'))
    const nahdiPaid = strip(await nahdi.innerText())
    check('3. Nahdi on paid reads 97.0 "They are cheaper"', nahdiPaid.includes('97.0') && nahdiPaid.includes('They are cheaper'), nahdiPaid)
    await page.waitForFunction(() => document.querySelector('[data-index-score-tile]')?.textContent?.includes('50.0%'))
    check('3. the overall score on paid reads 50.0%', true)
    const text = strip(await page.locator('body').innerText())
    check('2–3. no raw i18n keys', !rawKey(text), String(rawKey(text)))
    check('2–3. no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/index.png', fullPage: true }).catch(() => {})
    await context.close()
  }

  // ── 4: score members not in the model ──
  {
    const { page, context, errors } = await open(BOTH, { scoreRefused: true })
    await page.goto(ROOT + '?tab=index')
    await page.waitForSelector('[data-index-competitor="NAHDI"] [data-index-tone]')
    await page.waitForSelector('[data-index-section="score"] [role="alert"]')
    const score = strip(await page.locator('[data-index-section="score"]').innerText())
    check('4. the score says its figures are not in the model yet', score.includes('not in the analytics model'), score)
    check('4. the index still shows', (await page.locator('[data-index-competitor]').count()) === 2)
    check('4. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5: PriceWatch view alone ──
  {
    const { page, context, calls } = await open(['PriceWatch:03'])
    await page.goto(ROOT)
    await page.waitForSelector('[data-tab-panel="alerts"]')
    check('5. no Index tab without Analytics:03', (await page.locator('[data-tab="index"]').count()) === 0)
    await page.waitForTimeout(300)
    check('5. …and no Analytics/Query call', !calls.some((c) => c.path === 'Analytics/Query'))
    await context.close()
  }

  // ── 6: RTL ──
  {
    const { page, context, errors } = await open(BOTH, { dir: 'rtl' })
    await page.goto(ROOT)
    await page.waitForSelector('[data-index-competitor="NAHDI"] [data-index-tone]')
    await page.waitForSelector('[data-index-score-tile]')
    const text = strip(await page.locator('body').innerText())
    check('6. RTL renders the price index', (await page.locator('[data-index-competitor]').count()) === 2)
    check('6. RTL: 110.0 reads whole', text.includes('110.0'))
    check('6. RTL: no raw i18n keys', !rawKey(text), String(rawKey(text)))
    check('6. RTL: no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/index-rtl.png', fullPage: true }).catch(() => {})
    await context.close()
  }
} catch (e) {
  check('drive ran to the end', false, String(e))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
