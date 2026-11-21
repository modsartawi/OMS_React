// Ticket 936 drive — a material's drill-down shows our price and every competitor's history, with its source
// (BackOffice spec 4127, decision 8). Drives the REAL app in Chromium against STUBBED `PriceWatch/*` envelopes.
//
// Stubs: `PriceWatch/Alerts/Mine` + `Matching/Coverage` (shipped, as the 934 drive), `Materials/{m}/Comparison` (shipped
// fields as read from BackOffice `pricing2` `PriceWatchComparisonService.cs` on 2026-11-21) PLUS the ⚠ GUESSED BO 4128
// extension — `ourHistory`, and per side `matchId`, `matchedByUser`, `matchedAt`, `authoritativeSource`, `source`,
// `history[]` (scratchpad 4127/contracts.md "BO 4128"). `Matches/{matchId}/Break` (shipped MatchWire). Still owed: the
// dev walk on PriceWatch_Dev once BO 4128 ships.
//
//   1. a manager opens the drill-down from an alert row's material: the URL gains ?material= (tab kept); the sheet
//      reads the comparison; our basic + effective price show.
//   2. the chart draws; its key names each series' source — NAHDI's authoritative Mindsite solid, Scraper faint.
//   3. a comparable match shows the per-unit price; the comparison gap reads "competitor cheaper" for a negative gap.
//   4. Break asks first, then POSTs Matches/M-1/Break and reads the comparison again.
//   5. close drops ?material=, the alerts stay.
//   6. a viewer (PriceWatch:03): the drill-down opens by URL, no Break.
//   7. a pre-4128 answer (no history, no match id): "no price history yet", Break disabled with its reason.
//   8. RTL: renders, no raw keys. No page errors anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/price-drilldown-drive.mjs
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
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')

const ALERT = {
  alertId: 'A-1', materialNumber: '100012345', competitorCode: 'NAHDI', matchId: 'M-1', listingId: 'L-1',
  status: 'OPEN', isLive: true, categoryCode: 'A004', thresholdPercent: 5, currency: 'SAR',
  ourBasicPrice: 25, ourEffectivePrice: 22.5, ourPriceDay: '2026-11-21',
  theirRegularPrice: 21, theirOfferPrice: 19.95, theirPrice: 19.95, sellerName: 'Nahdi Online',
  observedAt: '2026-11-21T08:15:00', previousObservedAt: null, gapAmount: 2.55, gapPercent: 11.33,
  thirtyDayUnits: 400, unitsSource: 'SALES', valueAtRisk: 1020, recommendedPrice: 19.95, recommendedFrom: 'NAHDI',
  floorStatus: 'NOT_SET', floorText: 'floor not set', openedAt: '2026-11-21T08:20:00', updatedAt: '2026-11-21T08:20:00',
  resolvedAt: null, resolvedReason: '', dismissedAtGapPercent: 0, categoryManager: 'CM01', ownerUserId: 'msartawi',
}
const obs = (id, at, source, auth, regular, offer) => ({ priceId: id, observedAt: at, source, isAuthoritative: auth, regularPrice: regular, offerPrice: offer, sellerName: 'Nahdi Online', inStock: true })
const NAHDI = {
  competitorCode: 'NAHDI', competitorName: 'Nahdi', matchKind: 'Exact', madeBy: 'Barcode',
  listingUrl: 'https://nahdi.example/p/1', listingTitle: 'Panadol Extra 24 tablets',
  hasPrice: true, regularPrice: 21, offerPrice: 19.95, observedAt: '2026-11-21T08:15:00',
  sellerName: 'Nahdi Online', isPlatformSeller: true, inStock: true, isStale: false, isGone: false,
  gapPercent: -11.3, mayAlert: true, perUnitBasis: '', ourPricePerUnit: null, theirPricePerUnit: null,
  // GUESSED (BO 4128)
  matchId: 'M-1', matchedByUser: 'jdoe', matchedAt: '2026-10-01T09:00:00', authoritativeSource: 'MINDSITE', source: 'MINDSITE',
  history: [
    obs('p1', '2026-11-19T08:00:00', 'MINDSITE', true, 21, null),
    obs('p2', '2026-11-19T09:00:00', 'SCRAPER', false, 21.5, null),
    obs('p3', '2026-11-20T08:00:00', 'MINDSITE', true, 21, 20.5),
    obs('p4', '2026-11-20T09:00:00', 'SCRAPER', false, 21.5, 20),
    obs('p5', '2026-11-21T08:15:00', 'MINDSITE', true, 21, 19.95),
  ],
}
const AMAZON = {
  competitorCode: 'AMAZON_SA', competitorName: 'Amazon SA', matchKind: 'Comparable', madeBy: 'Person',
  listingUrl: 'https://amazon.example/dp/2', listingTitle: 'Panadol Extra 48 tablets',
  hasPrice: true, regularPrice: 39, offerPrice: null, observedAt: '2026-11-21T07:00:00',
  sellerName: 'Pharma Seller', isPlatformSeller: false, inStock: true, isStale: true, isGone: false,
  gapPercent: -13.3, mayAlert: false, perUnitBasis: 'piece', ourPricePerUnit: 0.9375, theirPricePerUnit: 0.8125,
  matchId: 'M-2', matchedByUser: 'asmith', matchedAt: '2026-10-05T12:00:00', authoritativeSource: 'SCRAPER', source: 'SCRAPER',
  history: [obs('a1', '2026-11-20T07:00:00', 'SCRAPER', true, 39, null), obs('a2', '2026-11-21T07:00:00', 'SCRAPER', true, 39, null)],
}
const COMPARISON = {
  material: '100012345', referenceStore: '1001', pricedAt: '2026-11-21T06:00:00', isPriced: true, unpricedReason: '',
  currency: 'SAR', basicPrice: 25, effectivePrice: 22.5, competitors: [NAHDI, AMAZON],
  ourHistory: [
    { priceDay: '2026-11-19', isPriced: true, basicPrice: 25, effectivePrice: 25 },
    { priceDay: '2026-11-20', isPriced: true, basicPrice: 25, effectivePrice: 25 },
    { priceDay: '2026-11-21', isPriced: true, basicPrice: 25, effectivePrice: 22.5 },
  ],
}
// A pre-4128 server: the shipped wire only.
const strip4128 = ({ matchId, matchedByUser, matchedAt, authoritativeSource, source, history, ...rest }) => rest
const PRE_4128 = { ...COMPARISON, ourHistory: undefined, competitors: COMPARISON.competitors.map(strip4128) }

const browser = await chromium.launch()

async function open(keys, { dir = 'ltr', comparison = COMPARISON } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  let broken = false
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.split('/api/')[1]
    calls.push({ path, method: req.method(), body: req.postData() })
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
    if (path === 'PriceWatch/Matching/Coverage') return route.fulfill(envelope([]))
    if (path === 'PriceWatch/Alerts/Mine' || path === 'PriceWatch/Alerts') return route.fulfill(envelope([ALERT]))
    if (path === 'PriceWatch/Materials/100012345/Comparison')
      return route.fulfill(envelope(broken ? { ...comparison, competitors: comparison.competitors.filter((c) => c.matchId !== 'M-1') } : comparison))
    if (path === 'PriceWatch/Matches/M-1/Break') {
      broken = true
      return route.fulfill(envelope({ matchId: 'M-1', materialNumber: '100012345', listingId: 'L-1', competitorCode: 'NAHDI', matchKind: 'Exact', madeBy: 'Barcode', matchedByUser: 'jdoe', matchedAt: '2026-10-01T09:00:00', candidateId: '', ourSizeValue: 0, ourSizeUnit: '', theirSizeValue: 0, theirSizeUnit: '', mayAlert: true, isBroken: true, brokenBy: 'msartawi', brokenAt: '2026-11-22T10:00:00' }))
    }
    return route.fulfill(envelope({}))
  })
  return { page, context, errors, calls }
}

const rawKey = (text) => text.match(/\b(?:price-command-center:)?(?:drilldown|alerts|tabs|access)\.[a-zA-Z.-]+\b/)

try {
  // ── 1–5: a manager ──
  {
    const { page, context, errors, calls } = await open(['PriceWatch:03', 'PriceWatch:06'])
    await page.goto(ROOT + '?tab=alerts')
    await page.waitForSelector('[data-open-drilldown="100012345"]')
    await page.click('[data-open-drilldown="100012345"]')
    await page.waitForSelector('[data-drilldown="100012345"] [data-match-row]')
    const u = new URL(page.url())
    check('1. the alert row opens the drill-down by ?material=, the tab kept', u.searchParams.get('material') === '100012345' && u.searchParams.get('tab') === 'alerts', u.search)
    check('1. the comparison is read', calls.some((c) => c.path === 'PriceWatch/Materials/100012345/Comparison'))
    const sheet = page.locator('[data-drilldown="100012345"]')
    const ours = strip(await sheet.locator('[data-drilldown-ours]').innerText())
    check('1. our basic and effective price show', ours.includes('25.00') && ours.includes('22.50'), ours)

    // 2. chart + key
    check('2. the price history chart draws', (await sheet.locator('[data-chart="line"]').count()) === 1)
    check('2. …with lines', (await sheet.locator('.recharts-line').count()) >= 5, String(await sheet.locator('.recharts-line').count()))
    const faint = await sheet.locator('[data-series-key="NAHDI.SCRAPER.offer"]').getAttribute('data-series-faint')
    const solid = await sheet.locator('[data-series-key="NAHDI.MINDSITE.offer"]').getAttribute('data-series-faint')
    check('2. NAHDI Mindsite (authoritative) is solid, Scraper faint', solid === 'false' && faint === 'true', `${solid}/${faint}`)
    const key = strip(await sheet.locator('[data-history-key]').innerText())
    check('2. the key names each source', key.includes('Mindsite (authoritative)') && key.includes('from Scraper'), key)
    const opacities = await sheet.locator('.recharts-line path.recharts-curve').evaluateAll((els) => els.map((e) => e.getAttribute('stroke-opacity')))
    check('2. the chart draws the faint lines faint', opacities.includes('0.4') && opacities.includes('1'), JSON.stringify(opacities))

    // 3. per unit + gap
    const amazon = strip(await sheet.locator('[data-match-row="AMAZON_SA"]').innerText())
    check('3. the comparable match shows the per-unit price', amazon.includes('0.9375 / piece') && amazon.includes('0.8125 / piece'), amazon)
    check('3. a negative comparison gap reads "competitor cheaper"', amazon.includes('Competitor cheaper by 13.3%'), amazon)
    const nahdi = strip(await sheet.locator('[data-match-row="NAHDI"]').innerText())
    check('3. who and when, and the price source', nahdi.includes('jdoe') && nahdi.includes('Price source: Mindsite') && nahdi.includes('By barcode'), nahdi)

    // 4. break
    const reads = calls.filter((c) => c.path === 'PriceWatch/Materials/100012345/Comparison').length
    await sheet.locator('[data-match-break="M-1"]').click()
    check('4. Break asks first', (await sheet.locator('[data-match-break-confirm="M-1"]').count()) === 1 && !calls.some((c) => c.path.endsWith('/Break')))
    await sheet.locator('[data-match-break-yes="M-1"]').click()
    await page.waitForSelector('text=Product match broken.')
    const sent = calls.find((c) => c.path === 'PriceWatch/Matches/M-1/Break')
    check('4. Break POSTs Matches/M-1/Break', !!sent && sent.method === 'POST')
    await page.waitForFunction(() => document.querySelectorAll('[data-drilldown] [data-match-row="NAHDI"]').length === 0)
    check('4. …and the comparison is read again', calls.filter((c) => c.path === 'PriceWatch/Materials/100012345/Comparison').length > reads)
    check('4. …the price alerts too', calls.filter((c) => c.path === 'PriceWatch/Alerts/Mine').length > 1)

    const text = strip(await page.locator('body').innerText())
    check('1–4. no raw i18n keys', !rawKey(text), String(rawKey(text)))
    await page.screenshot({ path: 'tools/.price-command-center-shots/drilldown.png', fullPage: true }).catch(() => {})

    // 5. close
    await page.click('[data-drilldown-close]')
    await page.waitForFunction(() => !document.querySelector('[data-drilldown]'))
    const after = new URL(page.url())
    check('5. close drops ?material=, the tab kept', !after.searchParams.has('material') && after.searchParams.get('tab') === 'alerts', after.search)
    check('5. the price alerts stay', (await page.locator('[data-alert-row]').count()) === 1)
    check('1–5. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: a viewer, by URL ──
  {
    const { page, context, errors } = await open(['PriceWatch:03'])
    await page.goto(ROOT + '?material=100012345')
    await page.waitForSelector('[data-drilldown] [data-match-row]')
    check('6. the drill-down opens straight from the URL', true)
    check('6. a viewer sees no Break', (await page.locator('[data-match-break]').count()) === 0)
    check('6. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: a pre-4128 answer ──
  {
    const { page, context, errors } = await open(['PriceWatch:03', 'PriceWatch:06'], { comparison: PRE_4128 })
    await page.goto(ROOT + '?material=100012345')
    await page.waitForSelector('[data-drilldown] [data-match-row]')
    check('7. no history: says so, no chart', (await page.locator('[data-drilldown-history-empty]').count()) === 1 && (await page.locator('[data-chart]').count()) === 0)
    const btn = page.locator('[data-match-row="NAHDI"] [data-match-break]')
    check('7. Break is disabled with its reason', (await btn.getAttribute('aria-disabled')) === 'true' && /match id/.test((await btn.getAttribute('title')) ?? ''))
    check('7. who and when not recorded', strip(await page.locator('[data-match-row="NAHDI"]').innerText()).includes('Who and when not recorded'))
    check('7. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: RTL ──
  {
    const { page, context, errors } = await open(['PriceWatch:03', 'PriceWatch:06'], { dir: 'rtl' })
    await page.goto(ROOT + '?material=100012345')
    await page.waitForSelector('[data-drilldown] [data-match-row]')
    const text = strip(await page.locator('body').innerText())
    check('8. RTL renders the drill-down', (await page.locator('[data-drilldown] [data-match-row]').count()) === 2)
    const rate = strip(await page.locator('[data-match-per-unit]').innerText())
    // `lng` is pinned to en app-wide until Arabic is switched on (core/i18n.ts): the Arabic basis is proven in the unit test.
    check('8. RTL: the per-unit rate reads whole, number first', /0\.8125 \/ (piece|قطعة)/.test(rate), rate)
    check('8. RTL: no raw i18n keys', !rawKey(text), String(rawKey(text)))
    check('8. RTL: no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/drilldown-rtl.png', fullPage: true }).catch(() => {})
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
