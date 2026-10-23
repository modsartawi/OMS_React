// Dispatch scorecard drive (ticket 543; BackOffice spec 2952, doors 2965).
//
// Drives the REAL app in Chromium against a STUB of the four doors — 2965 is merged on pricing2 but
// not deployed, so there is no live SIS.Api to point at. The stub answers EXACTLY the shapes of
// `DispatchScorecardModels.cs`, camelCase:
//   GET DispatchScorecard/Access    → { screenAllowed }            (allowed, not allowed, a bare 403)
//   GET DispatchScorecard/Grid      → { asOf, from, to, minimumBids, minimumAnswers, stores[], staff[] }
//   GET DispatchScorecard/Drill     → { asOf, from, to, figure, store, staff, rows[] }
//   GET DispatchScorecard/StoreCard → { asOf, from, to, row, measures[], classes[], staff[] }
// and a `CALLOUT-301` refusal on the Grid when asked for store `REFUSE`.
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl") it asserts:
//   1. not allowed (`screenAllowed: false`): the leaf is hidden, the URL shows the denied card, no Grid call;
//   2. a bare 403 on the probe: the denied card, no Grid call;
//   3. allowed: the leaf is in the OMS group; the Grid is asked for the last 30 days ending today;
//   4. each of the five ranked headers carries its better direction; a context header carries none
//      and does not sort;
//   5. the "too few" row sorts last unsorted, and a ranked header sorts both ways with the absent
//      figure after the numbers and the too-few row last BOTH ways (best ↔ worst);
//   6. the Staff tab (in the URL) ranks its two answer times, the too-few person last both ways;
//   7. a figure opens its drawer: the Drill is asked for that figure and store, the bids are listed,
//      the drawer's export is offered, and a bid row opens that delivery (`/oms/delivery/<no>`);
//   8. a store opens its report card: "#n of m" and the estate median exactly as sent, the stacked
//      bar by class, the context chips, its staff; a card measure opens its drill over the card;
//   9. export is offered on the grid and writes a workbook;
//  10. a range over 92 days is blocked before the call; the door's CALLOUT-301 reads as its message;
//  11. every figure is isolated left to right, also under RTL;
//  12. no page errors;
//  13. (review of 2952) a text filter holds an inner space ("Al Khobar"), asks nothing while typed, and
//      is applied — trimmed — on Enter, reaching the Grid and the URL.
//
//   1. run the app:  npx vite --port 5203 --strictPort
//   2. DRIVE_PORT=5203 node tools/dispatch-scorecard-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`
const SHOTS = 'tools/.dispatch-scorecard-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => {
  const d = new Date()
  return day(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}
const TODAY = daysAgo(0)
const FROM = daysAgo(29)

// ── Fixtures, the door's shapes exactly ────────────────────────────────────────────────────────
const storeRow = (store, name, over = {}) => ({
  store,
  name,
  city: 'Riyadh',
  region: 'Central',
  ignoreRate: 0.1,
  medianAnswerSeconds: 40,
  slowQuarterAnswerSeconds: 90,
  winRate: 0.4,
  declineRate: 0.05,
  ignoreRateRank: 2,
  medianAnswerRank: 2,
  slowQuarterAnswerRank: 2,
  winRateRank: 2,
  declineRateRank: 2,
  rankedBids: 40,
  tooFew: false,
  bids: 50,
  won: 20,
  lostRaces: 6,
  nearMisses: 2,
  passedWithStock: 2,
  passedShort: 3,
  passedUnknown: 1,
  ignored: 4,
  unseen: 5,
  unseenNotReached: 2,
  unseenNobodySignedIn: 2,
  unseenOldBuild: 1,
  beaten: 4,
  withdrawn: 1,
  answered: 36,
  darkOffers: 3,
  medianKm: 2.35,
  fallbacksReceived: 2,
  releasedAfterAward: 1,
  releasedByReason: { NO_STOCK: 1 },
  ...over,
})
// Ignore rate: P002 best (0.05), P001 (0.1), P003 worst (0.3), P004 no figure (null), P009 too few but LOWEST (0.01).
const STORES = [
  storeRow('P009', 'Olaya Small', { ignoreRate: 0.01, tooFew: true, rankedBids: 6, ignoreRateRank: null }),
  storeRow('P001', 'Malaz'),
  storeRow('P003', 'Sulay', { ignoreRate: 0.3, ignoreRateRank: 3 }),
  storeRow('P004', 'Naseem', { ignoreRate: null, ignoreRateRank: null }),
  storeRow('P002', 'Rawdah', { ignoreRate: 0.05, ignoreRateRank: 1 }),
]
const staffRow = (staff, over = {}) => ({
  staff,
  stores: ['P001'],
  answers: 20,
  won: 8,
  lostRaces: 3,
  nearMisses: 1,
  passedWithStock: 1,
  medianAnswerSeconds: 30,
  slowQuarterAnswerSeconds: 70,
  medianAnswerRank: 2,
  slowQuarterAnswerRank: 2,
  tooFew: false,
  ...over,
})
const STAFF = [
  staffRow('P001-ph03', { medianAnswerSeconds: 5, tooFew: true, answers: 3, medianAnswerRank: null }),
  staffRow('P001-ph01', { medianAnswerSeconds: 22, medianAnswerRank: 1 }),
  staffRow('P002-ph01', { stores: ['P002'], medianAnswerSeconds: 61, medianAnswerRank: 3 }),
]
const grid = () => ({ asOf: `${TODAY}T09:41:00`, from: `${FROM}T00:00:00`, to: `${TODAY}T00:00:00`, minimumBids: 20, minimumAnswers: 10, stores: STORES, staff: STAFF })

const DELIVERY = '8006777365'
const drillRow = (i, over = {}) => ({
  calloutId: `C${i}`,
  bidId: `B${i}`,
  subjectType: 'DELIVERY',
  subjectId: i === 1 ? DELIVERY : `80067773${70 + i}`,
  party: 'P001',
  class: i === 1 ? 'Ignored' : 'Won',
  ignoreReason: i === 1 ? 'ShownNotOpened' : '',
  offeredAt: `${TODAY}T08:0${i}:00`,
  deliveredAt: `${TODAY}T08:0${i}:05`,
  answeredAt: i === 1 ? null : `${TODAY}T08:0${i}:40`,
  answerSeconds: i === 1 ? null : 35,
  answeredBy: i === 1 ? '' : 'P001-ph01',
  answeredRegister: i === 1 ? '' : '01',
  awardedAt: null,
  nearMiss: false,
  distanceKm: 2.4,
  onlineTills: 2,
  signedInTills: 1,
  atp: 'covers',
  releaseReason: '',
  counted: i === 1,
  ...over,
})
const drill = (q) => ({
  asOf: `${TODAY}T09:41:00`,
  from: `${FROM}T00:00:00`,
  to: `${TODAY}T00:00:00`,
  figure: q.get('figure'),
  store: q.get('store') ?? '',
  staff: q.get('staff') ?? '',
  rows: [drillRow(1), drillRow(2), drillRow(3)],
})
const MEASURES = [
  { measure: 'ignoreRate', value: 0.1, rank: 3, of: 17, estateMedian: 0.115, better: 'lower' },
  { measure: 'medianAnswerSeconds', value: 40, rank: 5, of: 17, estateMedian: 61, better: 'lower' },
  { measure: 'slowQuarterAnswerSeconds', value: 90, rank: 6, of: 17, estateMedian: 120, better: 'lower' },
  { measure: 'winRate', value: 0.4, rank: 2, of: 17, estateMedian: 0.33, better: 'higher' },
  { measure: 'declineRate', value: null, rank: null, of: 16, estateMedian: 0.04, better: 'lower' },
]
const card = (store) => ({
  asOf: `${TODAY}T09:41:00`,
  from: `${FROM}T00:00:00`,
  to: `${TODAY}T00:00:00`,
  row: STORES.find((s) => s.store === store) ?? null,
  measures: MEASURES,
  classes: [
    { class: 'Won', count: 20 },
    { class: 'LostRace', count: 6 },
    { class: 'PassedWithStock', count: 2 },
    { class: 'PassedShort', count: 3 },
    { class: 'PassedUnknown', count: 1 },
    { class: 'Ignored', count: 4 },
    { class: 'Unseen', count: 5 },
    { class: 'Beaten', count: 4 },
    { class: 'Withdrawn', count: 0 },
  ],
  staff: STAFF.filter((s) => s.stores.includes(store)),
})

// ── The harness ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch()

async function open(dir, { access = 'allowed' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const queries = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    ;(queries[p] ??= []).push(url.searchParams)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    if (p === 'DispatchScorecard/Access') {
      // A bare 403: no envelope at all, as a route without AllowCookieSession answers.
      if (access === 'bare403') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      return route.fulfill(envelope({ screenAllowed: access === 'allowed' }))
    }
    if (p === 'DispatchScorecard/Grid') {
      if (url.searchParams.get('store') === 'REFUSE')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The range is at most 92 days.',
            errors: [{ errorCode: 'CALLOUT-301', internalErrorCode: '', errorMessage: 'The range is at most 92 days.' }],
          }),
        )
      return route.fulfill(envelope(grid()))
    }
    if (p === 'DispatchScorecard/Drill') return route.fulfill(envelope(drill(url.searchParams)))
    if (p === 'DispatchScorecard/StoreCard') return route.fulfill(envelope(card(url.searchParams.get('store'))))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, queries }
}

const omsLinks = (page) => page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

/** A grid's rows in their shown order (by row-index), each cell's text by column; pinned halves merged. */
const gridRows = (page, scope) =>
  page.evaluate((scope) => {
    const byIndex = new Map()
    for (const row of document.querySelectorAll(`${scope} .ag-row[row-index]`)) {
      const i = Number(row.getAttribute('row-index'))
      const cells = Object.fromEntries([...row.querySelectorAll('.ag-cell')].map((c) => [c.getAttribute('col-id'), c.textContent.trim()]))
      byIndex.set(i, { ...byIndex.get(i), ...cells })
    }
    return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, r]) => r)
  }, scope)

const storeOrder = async (page) => (await gridRows(page, '[data-sc-grid="stores"]')).map((r) => (r.store ?? '').slice(0, 4))
const staffOrder = async (page) => (await gridRows(page, '[data-sc-grid="staff"]')).map((r) => (r.staff ?? '').replace(/\s*(too few|قليل جدًا)$/, ''))

const sortBy = async (page, scope, colId, sort) => {
  await page.locator(`${scope} .ag-header-cell[col-id="${colId}"] .ag-header-cell-label`).click()
  await page.locator(`${scope} .ag-header-cell[col-id="${colId}"][aria-sort="${sort}"]`).waitFor({ timeout: 5000 })
  await page.waitForTimeout(150)
}

/** Whether a text reads left to right on screen: its first character's box starts left of its last's. */
const readsLtr = (locator) =>
  locator.evaluate((el) => {
    const text = el.textContent.trim()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const i = node.textContent.indexOf(text)
      if (i < 0) continue
      const box = (k) => {
        const r = document.createRange()
        r.setStart(node, k)
        r.setEnd(node, k + 1)
        return r.getBoundingClientRect()
      }
      return box(i).left < box(i + text.length - 1).left
    }
    return null
  })

const params = (q) => (q ? Object.fromEntries([...q.entries()]) : null)

// i18n stays `lng: 'en'` (the `ar` resources ride along for the retrofit); `oms.locale = 'ar'` only sets
// dir="rtl", so the copy reads the same in both runs.
const WORDS = { denied: 'No access to the dispatch scorecard', lower: 'lower is better', higher: 'higher is better', refusal: 'longer than 92 days', tooLong: 'at most' }

async function drive(dir) {
  const label = dir
  const words = WORDS

  // ── 1: not allowed ──
  {
    const { context, page, errors, calls } = await open(dir, { access: 'denied' })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.waitForTimeout(1500)
    const links = await omsLinks(page)
    check(`${label}: not allowed — the leaf is hidden`, !links.includes('/oms/dispatch-scorecard'), links.join(' · '))
    await page.goto(`${BASE}/oms/dispatch-scorecard`)
    const denied = page.locator('[role="alert"]', { hasText: words.denied })
    await denied.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(`${label}: not allowed — the URL shows the denied card and never asks for the Grid`, !calls.includes('DispatchScorecard/Grid'))
    check(`${label}: no page errors (not allowed)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2: a bare 403 ──
  {
    const { context, page, calls } = await open(dir, { access: 'bare403' })
    await page.goto(`${BASE}/oms/dispatch-scorecard`)
    const denied = page.locator('[role="alert"]', { hasText: words.denied })
    await denied.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    const links = await omsLinks(page)
    check(
      `${label}: a bare 403 on the probe — the denied card, the leaf hidden, no Grid call`,
      (await denied.count()) === 1 && !links.includes('/oms/dispatch-scorecard') && !calls.includes('DispatchScorecard/Grid'),
    )
    await context.close()
  }

  // ── 3–11: allowed ──
  {
    const { context, page, errors, calls, queries } = await open(dir)
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/dispatch-scorecard"]').first().waitFor({ timeout: 20000 })
    check(`${label}: allowed — the leaf is in the OMS group`, (await omsLinks(page)).includes('/oms/dispatch-scorecard'))
    await page.locator('nav a[href="/oms/dispatch-scorecard"]').first().click()
    await page.locator('[data-sc-grid="stores"] .ag-row[row-index]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    const askedGrid = params(queries['DispatchScorecard/Grid']?.[0])
    check(
      `${label}: the Grid is asked for the last 30 days ending today, no filters`,
      JSON.stringify(askedGrid) === JSON.stringify({ from: FROM, to: TODAY }),
      JSON.stringify(askedGrid),
    )
    check(`${label}: dir is ${dir}`, (await page.locator('html').getAttribute('dir')) === dir)

    // 4: direction labels; context header neither labelled nor sortable.
    const directions = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll('[data-sc-grid="stores"] [data-sc-header]')].map((h) => [
          h.getAttribute('data-sc-header'),
          h.querySelector('[data-sc-direction]')?.textContent.trim() ?? null,
        ]),
      ),
    )
    check(
      `${label}: each ranked header carries its better direction`,
      JSON.stringify(directions) ===
        JSON.stringify({
          ignoreRate: words.lower,
          medianAnswerSeconds: words.lower,
          slowQuarterAnswerSeconds: words.lower,
          winRate: words.higher,
          declineRate: words.lower,
        }),
      JSON.stringify(directions),
    )
    const before = await storeOrder(page)
    await page.locator('[data-sc-grid="stores"] .ag-header-cell[col-id="bids"] .ag-header-cell-label').click()
    await page.waitForTimeout(250)
    const bidsSort = await page.locator('[data-sc-grid="stores"] .ag-header-cell[col-id="bids"]').getAttribute('aria-sort')
    check(
      `${label}: a context column (Bids) is not ranked: no direction label, and its header does not sort`,
      (await page.locator('[data-sc-grid="stores"] .ag-header-cell[col-id="bids"] [data-sc-direction]').count()) === 0 &&
        (bidsSort === null || bidsSort === 'none') &&
        JSON.stringify(await storeOrder(page)) === JSON.stringify(before),
      `aria-sort=${bidsSort}`,
    )

    // 5: unsorted order: the server's, too-few last; then both directions of Ignore rate.
    check(`${label}: unsorted — the server's order, the too-few store last`, JSON.stringify(before) === JSON.stringify(['P001', 'P003', 'P004', 'P002', 'P009']), before.join(' '))
    const tooFewCell = page.locator('[data-sc-grid="stores"] [data-sc-store="P009"]').locator('xpath=..').locator('[data-sc-too-few]')
    check(`${label}: the too-few store is labelled`, (await tooFewCell.count()) === 1)
    await sortBy(page, '[data-sc-grid="stores"]', 'ignoreRate', 'ascending')
    const asc = await storeOrder(page)
    check(`${label}: Ignore rate ascending (best first) — absent after the figures, too-few last`, JSON.stringify(asc) === JSON.stringify(['P002', 'P001', 'P003', 'P004', 'P009']), asc.join(' '))
    await sortBy(page, '[data-sc-grid="stores"]', 'ignoreRate', 'descending')
    const desc = await storeOrder(page)
    check(`${label}: Ignore rate descending (worst first) — absent STILL after, too-few STILL last`, JSON.stringify(desc) === JSON.stringify(['P003', 'P001', 'P002', 'P004', 'P009']), desc.join(' '))
    const rateCells = (await gridRows(page, '[data-sc-grid="stores"]')).map((r) => r.ignoreRate)
    check(`${label}: a rate reads as a percent, the absent one as "—"`, JSON.stringify(rateCells) === JSON.stringify(['30.0%', '10.0%', '5.0%', '—', '1.0%']), rateCells.join(' '))
    const figureLink = page.locator('[data-sc-grid="stores"] .ag-row [data-sc-drill="ignoreRate"]').first()
    check(`${label}: a figure is isolated and reads left to right`, (await figureLink.locator('bdi[dir="ltr"]').count()) === 1 && (await readsLtr(figureLink)) === true)
    await page.screenshot({ path: `${SHOTS}/${label}-stores.png`, fullPage: true })

    // 9: export of the grid.
    const exportButton = page.locator('[data-sc-export]')
    check(`${label}: export is offered on the grid`, await exportButton.isEnabled())
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), exportButton.click()])
    check(`${label}: the grid exports a workbook`, /^dispatch-scorecard-\d{8}-\d{4}\.xlsx$/.test(download.suggestedFilename()), download.suggestedFilename())

    // 7: a figure opens its drawer.
    // Descending, row 1 is P001.
    await page.locator('[data-sc-grid="stores"] .ag-row[row-index="1"] [data-sc-drill="ignoreRate"]').click()
    const drawer = page.locator('dialog[data-sc-drawer="ignoreRate"]')
    await drawer.locator('[data-sc-drawer-grid] .ag-row[row-index]').first().waitFor({ timeout: 10000 })
    const askedDrill = params(queries['DispatchScorecard/Drill']?.at(-1))
    check(
      `${label}: a figure opens its drawer — the Drill asked for that figure and that store`,
      askedDrill?.figure === 'ignoreRate' && askedDrill?.store === 'P001' && askedDrill?.from === FROM && askedDrill?.to === TODAY,
      JSON.stringify(askedDrill),
    )
    const drillRows = await gridRows(page, 'dialog[data-sc-drawer="ignoreRate"]')
    check(`${label}: the drawer lists the bids, a rate's numerator marked Counted`, drillRows.length === 3 && drillRows[0].counted !== drillRows[1].counted, JSON.stringify(drillRows[0]))
    check(`${label}: the drawer's export is offered`, await drawer.locator('[data-sc-drawer-export]').isEnabled())
    const [drawerDownload] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), drawer.locator('[data-sc-drawer-export]').click()])
    check(`${label}: the drawer exports a workbook`, /^dispatch-scorecard-bids-\d{8}-\d{4}\.xlsx$/.test(drawerDownload.suggestedFilename()), drawerDownload.suggestedFilename())
    await page.screenshot({ path: `${SHOTS}/${label}-drawer.png` })
    await drawer.locator(`.ag-row[row-index="0"] .ag-cell[col-id="subjectId"]`).click()
    await page.waitForURL(`**/oms/delivery/${DELIVERY}`, { timeout: 10000 })
    check(`${label}: a bid row opens that delivery`, new URL(page.url()).pathname === `/oms/delivery/${DELIVERY}`, page.url())

    // 6: the Staff tab.
    await page.goto(`${BASE}/oms/dispatch-scorecard`)
    await page.locator('[data-sc-tab="staff"]').click()
    await page.locator('[data-sc-grid="staff"] .ag-row[row-index]').first().waitFor({ timeout: 10000 })
    check(`${label}: the Staff tab is in the URL`, new URL(page.url()).searchParams.get('tab') === 'staff')
    const staffDirections = await page.locator('[data-sc-grid="staff"] [data-sc-direction]').count()
    check(`${label}: the Staff tab labels its two ranked times`, staffDirections === 2, String(staffDirections))
    await sortBy(page, '[data-sc-grid="staff"]', 'medianAnswerSeconds', 'ascending')
    const sAsc = await staffOrder(page)
    check(`${label}: Staff median ascending — the too-few person (fastest) last`, JSON.stringify(sAsc) === JSON.stringify(['P001-ph01', 'P002-ph01', 'P001-ph03']), sAsc.join(' '))
    await sortBy(page, '[data-sc-grid="staff"]', 'medianAnswerSeconds', 'descending')
    const sDesc = await staffOrder(page)
    check(`${label}: Staff median descending — the too-few person STILL last`, JSON.stringify(sDesc) === JSON.stringify(['P002-ph01', 'P001-ph01', 'P001-ph03']), sDesc.join(' '))
    await page.locator('[data-sc-grid="staff"] .ag-row[row-index="0"] [data-sc-drill="lostRaces"]').click()
    await page.locator('dialog[data-sc-drawer="lostRaces"] [data-sc-drawer-grid] .ag-row[row-index]').first().waitFor({ timeout: 10000 })
    const staffDrill = params(queries['DispatchScorecard/Drill']?.at(-1))
    check(`${label}: a person's figure drills their own bids (staff, no store)`, staffDrill?.staff === 'P002-ph01' && !staffDrill?.store && staffDrill?.figure === 'lostRaces', JSON.stringify(staffDrill))
    await page.locator('dialog[data-sc-drawer="lostRaces"] [data-sc-close]').click()

    // 8: a store opens its report card.
    await page.locator('[data-sc-tab="stores"]').click()
    await page.locator('[data-sc-grid="stores"] [data-sc-store="P001"]').click()
    const cardSheet = page.locator('dialog[data-sc-card="P001"]')
    await cardSheet.locator('[data-sc-card-measures]').waitFor({ timeout: 10000 })
    check(`${label}: the StoreCard is asked for that store`, params(queries['DispatchScorecard/StoreCard']?.at(-1))?.store === 'P001')
    const cardRead = await cardSheet.evaluate((el) =>
      Object.fromEntries(
        [...el.querySelectorAll('[data-sc-card-measure]')].map((m) => [
          m.getAttribute('data-sc-card-measure'),
          {
            value: m.querySelector('[data-sc-card-value]').textContent.trim(),
            rank: [...m.querySelectorAll('[data-sc-card-rank] bdi')].map((b) => b.textContent.trim()),
            median: m.querySelector('[data-sc-card-median] bdi')?.textContent.trim(),
          },
        ]),
      ),
    )
    check(
      `${label}: the card reads "#n of m" and the estate median exactly as sent`,
      JSON.stringify(cardRead.ignoreRate) === JSON.stringify({ value: '10.0%', rank: ['3', '17'], median: '11.5%' }) &&
        JSON.stringify(cardRead.medianAnswerSeconds) === JSON.stringify({ value: '40 s', rank: ['5', '17'], median: '1:01' }) &&
        cardRead.declineRate.rank.length === 0 &&
        cardRead.declineRate.value === '—',
      JSON.stringify(cardRead),
    )
    const segments = await cardSheet.locator('[data-sc-card-segment]').evaluateAll((els) => els.map((e) => e.getAttribute('data-sc-card-segment')))
    check(
      `${label}: where its bids went — a stacked bar by class, empty classes left out`,
      JSON.stringify(segments) === JSON.stringify(['Won', 'LostRace', 'PassedWithStock', 'PassedShort', 'PassedUnknown', 'Ignored', 'Unseen', 'Beaten']),
      segments.join(' '),
    )
    check(`${label}: the context chips and its staff`, (await cardSheet.locator('[data-sc-card-context] > span').count()) === 6 && (await cardSheet.locator('[data-sc-card-person]').count()) === 2)
    await page.screenshot({ path: `${SHOTS}/${label}-card.png` })
    await cardSheet.locator('[data-sc-card-measure="winRate"]').click()
    const overCard = page.locator('dialog[data-sc-drawer="winRate"]')
    await overCard.locator('[data-sc-drawer-grid] .ag-row[row-index]').first().waitFor({ timeout: 10000 })
    check(`${label}: a card measure opens its drill over the card`, params(queries['DispatchScorecard/Drill']?.at(-1))?.store === 'P001' && (await overCard.isVisible()))
    await overCard.locator('[data-sc-close]').click()
    await cardSheet.locator('[data-sc-close]').click()

    // 10: the range guard and the door's refusal.
    const gridCalls = calls.filter((c) => c === 'DispatchScorecard/Grid').length
    await page.goto(`${BASE}/oms/dispatch-scorecard?from=${daysAgo(92)}&to=${TODAY}`)
    const problem = page.locator('[data-sc-problem="tooLong"]')
    await problem.waitFor({ timeout: 10000 })
    await page.waitForTimeout(400)
    check(
      `${label}: 93 days is blocked before the call`,
      (await problem.innerText()).includes(words.tooLong) && calls.filter((c) => c === 'DispatchScorecard/Grid').length === gridCalls,
      await problem.innerText(),
    )
    await page.goto(`${BASE}/oms/dispatch-scorecard?from=${daysAgo(91)}&to=${TODAY}`)
    await page.locator('[data-sc-grid="stores"] .ag-row[row-index]').first().waitFor({ timeout: 10000 })
    check(`${label}: 92 days is asked`, params(queries['DispatchScorecard/Grid']?.at(-1))?.from === daysAgo(91))
    await page.goto(`${BASE}/oms/dispatch-scorecard?store=REFUSE`)
    const refusal = page.locator('[data-sc-refusal="refusal.rangeTooLong"]')
    await refusal.waitFor({ timeout: 10000 })
    check(`${label}: the door's CALLOUT-301 reads as its own message`, (await refusal.innerText()).includes(words.refusal), (await refusal.innerText()).replace(/\s+/g, ' '))

    // 13: a text filter is a draft, applied on Enter.
    await page.goto(`${BASE}/oms/dispatch-scorecard`)
    await page.locator('[data-sc-grid="stores"] .ag-row[row-index]').first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    const beforeTyping = calls.filter((c) => c === 'DispatchScorecard/Grid').length
    const city = page.locator('input[data-sc-filter="city"]')
    await city.click()
    await city.pressSequentially(' Al Khobar ')
    await page.waitForTimeout(400)
    check(
      `${label}: a text filter holds an inner space and asks nothing while typed`,
      (await city.inputValue()) === ' Al Khobar ' && calls.filter((c) => c === 'DispatchScorecard/Grid').length === beforeTyping,
      `${JSON.stringify(await city.inputValue())} · ${calls.filter((c) => c === 'DispatchScorecard/Grid').length - beforeTyping} reads`,
    )
    await city.press('Enter')
    await page.waitForFunction(() => new URL(location.href).searchParams.get('city') === 'Al Khobar', null, { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(400)
    check(
      `${label}: Enter applies it trimmed, to the Grid and the URL`,
      params(queries['DispatchScorecard/Grid']?.at(-1))?.city === 'Al Khobar' &&
        new URL(page.url()).searchParams.get('city') === 'Al Khobar' &&
        (await city.inputValue()) === 'Al Khobar',
      `${params(queries['DispatchScorecard/Grid']?.at(-1))?.city} · ${page.url()}`,
    )
    await page.locator('[data-sc-reset]').click()
    await page.waitForTimeout(300)
    check(`${label}: reset clears the typed filter too`, (await city.inputValue()) === '' && !new URL(page.url()).searchParams.has('city'))

    check(`${label}: no page errors (allowed)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

try {
  await drive('ltr')
  await drive('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
