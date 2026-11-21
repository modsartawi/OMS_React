// Ticket 935 drive — the product grid: one row per watched material, one column per competitor (BackOffice spec 4127,
// decisions 6 and 8). Drives the REAL app in Chromium against STUBBED `PriceWatch/*` envelopes.
//
// ⚠ GUESSED contract: BO 4129 (`GET PriceWatch/Grid`) is NOT built. The stub follows the guessed shape in
// `src/core/models/price-watch.ts` (Grid section; from the 4127 contract notes): `?aLevel&bLevel&brand&competitor&
// competitorCheaper&sort=units|gap&page&pageSize` → `{ total, page, pageSize, competitors[], rows[{ …, cells[] }] }`.
// `PriceWatch/Matching/Coverage` (the competitor picker) is the SHIPPED door. Still owed: reconcile + dev walk.
//
//   1. a viewer (PriceWatch:03): the Grid tab shows; opening it reads `PriceWatch/Grid` sort=units, page=1.
//   2. rows: one per material; our column first (effective, basic, deal); one column per competitor, in server order.
//   3. cell states: PRICED with offer (struck regular, -%), OOS with last price, NOT_CARRIED, NO_MATCH, COMPARABLE_ONLY,
//      stale — each its own `data-grid-cell`; the marketplace cell names its seller.
//   4. the cheapest mark follows the flag — on a competitor cell, and on ours when we lead.
//   5. filters + sort reach the endpoint: competitor, competitorCheaper, sort=gap, A-level/B-level/brand on Apply.
//   6. server paging: Next reads page=2.
//   7. a row's material number opens its drill-down (936), the open tab kept.
//   8. RTL: renders, no raw keys. No page errors anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/price-grid-drive.mjs
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROOT = BASE + '/analytics/price-command-center?tab=grid'

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
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')

const COMPETITORS = [
  { competitorCode: 'NAHDI', name: 'Nahdi', kind: 'pharmacy', authoritativeSource: 'SCRAPER' },
  { competitorCode: 'AMAZON_SA', name: 'Amazon SA', kind: 'marketplace', authoritativeSource: 'MINDSITE' },
  { competitorCode: 'WHITES', name: 'Whites', kind: 'pharmacy', authoritativeSource: 'SCRAPER' },
]
const cell = (competitorCode, over) => ({
  competitorCode, state: 'PRICED', paidPrice: 18, regularPrice: 20, offerPrice: 18, offerPercent: 10, sellerName: '',
  isPlatformSeller: true, inStock: true, observedAt: '2026-11-21T08:15:00', isStale: false, isCheapest: false,
  gapPercent: -20, source: 'SCRAPER', ...over,
})
const none = { paidPrice: null, regularPrice: null, offerPrice: null, offerPercent: null, observedAt: null, gapPercent: null }
const row = (materialNumber, over) => ({
  materialNumber, title: 'Panadol Extra 24 tablets', brand: 'Panadol', aLevel: 'A004', bLevel: 'B0041', currency: 'SAR',
  basicPrice: 25, effectivePrice: 22.5, isPriced: true, dealText: '', appliedDealText: '10% off', thirtyDayUnits: 400,
  isCheapest: false, widestGapPercent: -20, cells: [], ...over,
})
const ROWS = [
  row('100000001', {
    cells: [
      cell('NAHDI', { isCheapest: true }),
      cell('AMAZON_SA', { sellerName: 'Pharma Hub KSA', isPlatformSeller: false, paidPrice: 19, offerPrice: null, offerPercent: null, regularPrice: 19 }),
      cell('WHITES', { state: 'OOS', inStock: false, paidPrice: 21, offerPrice: null, offerPercent: null, regularPrice: 21 }),
    ],
  }),
  row('100000002', {
    title: 'Vitamin D3 1000 IU', brand: 'Nature Made', isCheapest: true, appliedDealText: '', effectivePrice: 30, basicPrice: 30,
    cells: [
      cell('NAHDI', { state: 'NOT_CARRIED', ...none }),
      cell('AMAZON_SA', { state: 'COMPARABLE_ONLY', ...none }),
      cell('WHITES', { paidPrice: 34, offerPrice: null, offerPercent: null, regularPrice: 34, isStale: true }),
    ],
  }),
  row('100000003', { title: 'Brufen 400', brand: 'Brufen', cells: [cell('NAHDI', { state: 'NO_MATCH', ...none }), cell('AMAZON_SA', { state: 'NO_MATCH', ...none }), cell('WHITES', { state: 'NO_MATCH', ...none })] }),
]
const COVERAGE = COMPETITORS.map((c) => ({ competitorCode: c.competitorCode, competitorName: c.name, watched: 500, exact: 100, comparable: 10, notCarried: 5, open: 385 }))

const browser = await chromium.launch()

async function open(keys, { dir = 'ltr' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(180000) // a cold vite serves hundreds of modules; a busy box needs the slack
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.split('/api/')[1]
    calls.push({ path, params: Object.fromEntries(url.searchParams) })
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
    if (path === 'PriceWatch/Matching/Coverage') return route.fulfill(envelope(COVERAGE))
    if (path === 'PriceWatch/Alerts/Mine' || path === 'PriceWatch/Alerts') return route.fulfill(envelope([]))
    if (path === 'PriceWatch/Grid') {
      const p = Number(url.searchParams.get('page') || 1)
      return route.fulfill(envelope({ total: 120, page: p, pageSize: 50, competitors: COMPETITORS, rows: ROWS }))
    }
    return route.fulfill(envelope({}))
  })
  return { page, context, errors, calls }
}

const rawKey = (text) => text.match(/\b(?:price-command-center:)?(?:grid|alerts|tabs|access|menu)\.[a-zA-Z.-]+\b/)
const gridCalls = (calls) => calls.filter((c) => c.path === 'PriceWatch/Grid')
const last = (calls) => gridCalls(calls).at(-1)?.params ?? {}

try {
  {
    const { page, context, errors, calls } = await open(['PriceWatch:03'])
    await page.goto(BASE + '/analytics/price-command-center')
    await page.waitForSelector('[data-tab="grid"]')
    check('1. the Grid tab shows for a viewer', true)
    await page.click('[data-tab="grid"]')
    await page.waitForSelector('[data-grid-material="100000001"]')
    check('1. opening it reads PriceWatch/Grid sort=units page=1', last(calls).sort === 'units' && last(calls).page === '1', JSON.stringify(last(calls)))

    // 2. rows and columns
    const mats = await page.locator('.ag-row [data-grid-material]').evaluateAll((els) => els.map((e) => e.getAttribute('data-grid-material')))
    check('2. one row per watched material', mats.length === 3, JSON.stringify(mats))
    const headers = strip(await page.locator('.ag-header').innerText()).replace(/\s+/g, ' ')
    check('2. our price first, then one column per competitor in server order',
      /Our price.*Nahdi.*Amazon SA.*Whites/.test(headers), headers)
    const ours1 = strip(await page.locator('.ag-row[row-id="100000001"] [data-grid-ours]').innerText())
    check('2. our column: effective, basic beneath, deal text', /22\.50[\s\S]*Basic[\s\S]*25\.00[\s\S]*10% off/.test(ours1), ours1)

    // 3. states
    const r1 = page.locator('.ag-row[row-id="100000001"]')
    const r2 = page.locator('.ag-row[row-id="100000002"]')
    const priced = strip(await r1.locator('[col-id="competitor-NAHDI"]').innerText())
    check('3. PRICED with offer: paid, regular struck, -%', priced.includes('18.00') && priced.includes('20.00') && priced.includes('-10%'), priced)
    check('3. …struck through', (await r1.locator('[col-id="competitor-NAHDI"] .line-through').count()) === 1)
    const oos = strip(await r1.locator('[col-id="competitor-WHITES"]').innerText())
    check('3. OOS with its last price', oos.includes('Out of stock') && oos.includes('Last price') && oos.includes('21.00'), oos)
    check('3. NOT_CARRIED', (await r2.locator('[data-grid-cell="NOT_CARRIED"]').count()) === 1)
    check('3. COMPARABLE_ONLY', (await r2.locator('[data-grid-cell="COMPARABLE_ONLY"]').count()) === 1)
    check('3. NO_MATCH', (await page.locator('.ag-row[row-id="100000003"] [data-grid-cell="NO_MATCH"]').count()) === 3)
    check('3. stale is marked', (await r2.locator('[col-id="competitor-WHITES"] [data-grid-stale]').count()) === 1)
    const seller = strip(await r1.locator('[col-id="competitor-AMAZON_SA"]').innerText())
    check('3. the marketplace cell names its seller', seller.includes('Pharma Hub KSA'), seller)
    check('3. a pharmacy cell names no seller', (await r1.locator('[col-id="competitor-NAHDI"] [data-grid-seller]').count()) === 0)

    // 4. cheapest
    check('4. the flagged competitor cell is marked cheapest', (await r1.locator('[col-id="competitor-NAHDI"] [data-grid-cheapest]').count()) === 1)
    check('4. no other cell of that row is marked', (await r1.locator('[data-grid-cheapest]').count()) === 1)
    check('4. ours is marked when we lead', (await r2.locator('[data-grid-ours] [data-grid-cheapest]').count()) === 1)

    // 7. the material opens its drill-down (936)
    const link = await page.locator('.ag-row a[data-open-drilldown]').first().getAttribute('href')
    const linked = new URL(link ?? '', BASE)
    check('7. a row’s material opens its drill-down, the open tab kept (936)', linked.pathname === '/analytics/price-command-center' && /^\d+$/.test(linked.searchParams.get('material') ?? '') && linked.searchParams.get('tab') === 'grid', String(link))

    // 5. filters + sort
    await page.locator('[data-grid-competitor]').selectOption('AMAZON_SA')
    await page.waitForFunction(() => true)
    await page.waitForTimeout(300)
    check('5. competitor is sent', last(calls).competitor === 'AMAZON_SA', JSON.stringify(last(calls)))
    await page.click('[data-grid-cheaper]')
    await page.waitForTimeout(300)
    check('5. "a competitor is cheaper" is sent', last(calls).competitorCheaper === 'true', JSON.stringify(last(calls)))
    await page.locator('[data-grid-sort]').selectOption('gap')
    await page.waitForTimeout(300)
    check('5. sort=gap is sent', last(calls).sort === 'gap', JSON.stringify(last(calls)))
    await page.locator('[data-grid-a-level]').fill(' A004 ')
    await page.locator('[data-grid-b-level]').fill('B0041')
    await page.locator('[data-grid-brand]').fill('Panadol')
    await page.click('[data-grid-filters] button[type="submit"]')
    await page.waitForTimeout(300)
    const f = last(calls)
    check('5. A-level, B-level and brand are sent on Apply, trimmed', f.aLevel === 'A004' && f.bLevel === 'B0041' && f.brand === 'Panadol' && f.page === '1', JSON.stringify(f))

    // 6. paging
    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForTimeout(300)
    check('6. Next reads page=2, filters kept', last(calls).page === '2' && last(calls).sort === 'gap', JSON.stringify(last(calls)))

    const body = strip(await page.locator('body').innerText())
    check('1–7. no raw i18n keys', !rawKey(body), String(rawKey(body)))
    check('1–7. no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/grid.png', fullPage: true }).catch(() => {})
    await context.close()
  }

  // ── 8: RTL ──
  {
    const { page, context, errors } = await open(['PriceWatch:03'], { dir: 'rtl' })
    await page.goto(ROOT)
    await page.click('[data-tab="grid"]')
    await page.waitForSelector('[data-grid-material="100000001"]')
    const text = strip(await page.locator('body').innerText())
    check('8. RTL renders the grid', (await page.locator('.ag-row [data-grid-material]').count()) === 3)
    check('8. RTL: no raw i18n keys', !rawKey(text), String(rawKey(text)))
    check('8. RTL: no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/grid-rtl.png', fullPage: true }).catch(() => {})
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
