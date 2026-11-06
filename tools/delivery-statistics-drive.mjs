// Delivery statistics drive (ticket 484, BackOffice brief 2641, ADR 0081).
//
// Drives the REAL app in Chromium against a STUB of the brief's door — `GET
// SdDocumentWeb/StoreStatistics` (BackOffice 2641) is NOT built, so there is no live SIS.Api to
// point at. The stub emits EXACTLY the brief's fields, camelCase as every SdDocumentWeb door:
//   { asOf, flow: { cameIn, madeReady, outForDelivery, trips, delivered, pickedUp, handedOver },
//     misses: { returnedBack, rejected, rescheduled, closeRequested, closedOrCancelled },
//     avgHandOverMinutes, series: [ { bucket, cameIn, handedOver } ],
//     stores: [ { storeCode, flow, misses, avgHandOverMinutes } ] }
// plus one fixture that DROPS flow.trips (an older SIS.Api) and has a null average.
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`), it asserts:
//   1. without the list grant the leaf is hidden and the URL shows the denied card, no call;
//   2. with it, the leaf is last in the OMS group, and the group + page gate cost ONE probe call;
//   3. Today asks From = To = today by the hour, LeaveOutChurned=true, no StoreCode/LeaveOutTypes;
//   4. the flow band in order, Trips as Out for delivery's sub-caption, the misses band, Avg
//      hand-over, AsOf; Handed over is the SERVER's figure (the stub's is not Delivered + Picked
//      up); a real 0 reads 0; every number isolated with a <bdi dir="ltr">;
//   5. Today asks again after 5 minutes; Yesterday does not;
//   6. the three tabs: Yesterday (by the hour), Range's 7/14/31 picks ending yesterday (by the
//      day), a custom range ending today, all in the URL;
//   7. the 31-day guard: 32 days inclusive, or a reversed range, is refused and makes NO call;
//   8. "—" (never 0) when the server drops `trips` and sends a null average;
//   9. an SDD-02131 envelope is shown as the server's refusal;
//  10. no page errors;
//  11. (ticket 485) the scope: the store picker off the stubbed `SdDocument/StoreDetails`, each
//      option one isolated `code · city` pair, all stores by default; the churned switch ticked by
//      default; the order types off the stubbed `SdDocument/DocumentTypes` (order + Erx only).
//      Picking a store sends `StoreCode`; unticking churned sends `LeaveOutChurned=false`; leaving
//      out two types sends them comma-joined; a reload keeps all three, and every tab shares them.
//  12. (ticket 487) the per-store table: one row per stubbed store, ranked by Handed over
//      descending by default; sorting by Trips reorders the rows (numerically); a null average
//      reads "—" and sorts LAST both ways; the older server's absent `trips` reads "—", never 0;
//      with one store chosen the table stays, showing that one row; the store column is pinned to
//      the reading start (left in LTR, right in RTL).
//
//  13. (ticket 486) the chart: Today draws 24 hourly buckets, every third hour labelled; a 31-day
//      range draws 31 daily buckets labelled by day of the month; one axis whose top is the round
//      step over the larger series; time runs in reading order (the first bucket at the left in LTR,
//      at the right in RTL, its label under it); hovering a column, or the arrow keys on the focused
//      plot, writes its bucket and two values in the readout, each isolated; a real 0 reads 0.
//
//  14. (ticket 489, brief 2660) the two lanes. The stub adds EXACTLY the brief's optional fields, on
//      the totals and on every store row:
//        tracks: { delivery: { flow: { cameIn, madeReady, outForDelivery, trips, handedOver },
//                              misses: { …the five }, avgHandOverMinutes },
//                  pickUp:   { flow: { cameIn, madeReady, handedOver }, misses: { …the five },
//                              avgHandOverMinutes } },
//        unspecified
//      and the older-server fixture sends NO `tracks` and NO `unspecified` at all. It asserts the
//      store-wide group (Came in, Handed over, the Delivered | Picked up pair, Avg hand-over, the
//      Unspecified tile) with no store-wide Made ready / Out for delivery tile (decision A); the
//      Delivery lane's four stages ending at Delivered with "Trips N" on Out for delivery; the
//      Pick-up lane's three ending at Picked up with no Out stage; each lane's average after its
//      stages with no chevron before it; the stages in READING order (left→right in LTR,
//      right→left in RTL, the chevrons mirrored — 814 made the lanes funnels, see 18); the lane figures are the stub's tracks, not the
//      totals; Unspecified hidden at 0 (on a 2658 answer: tracks without misses) and when absent;
//      and the older server reads "—" across both lanes and both averages, never 0.
//
//  15. (ticket 490) the two "Did not go to plan" rows, one per track, from `tracks.*.misses`: the
//      Delivery row all five, always, in the till's order and accents; the Pick-up row Close requested
//      and Closed / cancelled always, Returned back / Rejected / Rescheduled hidden at 0 (the main
//      stub) and shown when not zero (a stub with a Pick-up Rejected of 2); each row in reading order;
//      the old single store-wide misses band gone; the no-`tracks` and the 2658 (tracks without
//      misses) stubs read "—" on every shown miss, the hide-when-zero three hidden; nothing beside the
//      store-wide Avg hand-over says "Delivered + picked up".
//
//  16. (ticket 491) the table's Delivery / Pick-up / All switch, above the table: All by default (no
//      `track` in the URL) with Unspecified as the last flow column; Delivery (track=delivery) and
//      Pick-up (track=pickUp) show each store's own `tracks` in the brief's columns, ranked by the
//      view's hand-over column; every column ranks with "—" last both ways; a stub store row with
//      no `tracks` (and no `unspecified`) reads "—" in every Delivery and Pick-up cell, never 0;
//      switching makes no call; a link keeps the view; an unknown track reads as All.
//
//  17. (ticket 812, spec 811) the headline strip. The stub adds the spec's optional fields (⚠ a web
//      proposal, BackOffice brief not filed): `avgDeliveryMinutes` on the totals, the stores and both
//      tracks; the Delivery track's `slot` and `deliveredPerTrip`; and the `previous` block (Today's
//      window with `until`, a Range's without). It asserts the six tiles in order with the stub's
//      figures, isolated; each change the server's (arrow from the sign, words from changePct), in
//      ink; no change line without a previous figure; the Delivered | Picked up split and "n of N
//      delivered" sub-lines; the compared window for Today and for a Range; the old Avg hand-over tile
//      gone; and "—" (never 0) from the older-server and 2658 fixtures, which drop every new field.
//
//  18. (ticket 814, spec 811) the funnels. The Delivery and Pick-up lanes are funnels: their stages top
//      to bottom, each figure isolated, each with a `core/charts` stage bar as long as its share of the
//      lane's Came in (none for an absent figure); the Delivery funnel's slot split bar of In slot |
//      Out of slot | No slot, its segments the stub's counts and its key the stub's counts and shares;
//      each lane's average is its Avg delivery time (`avgDeliveryMinutes`, not the hand-over average);
//      side by side at 1600px, stacked at 1000px; under RTL the bars grow from the right and the slot
//      split opens on the right; the older server draws no bar, the split reads "—".
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/delivery-statistics-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.delivery-statistics-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
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
const YESTERDAY = daysAgo(1)

// ── The brief's fields, exactly ────────────────────────────────────────────────────────────────
const flow = (over = {}) => ({ cameIn: 1234, madeReady: 1100, outForDelivery: 380, trips: 412, delivered: 640, pickedUp: 455, handedOver: 1093, ...over })
const misses = (over = {}) => ({ returnedBack: 21, rejected: 0, rescheduled: 9, closeRequested: 4, closedOrCancelled: 17, ...over })
// 489: the split by track (BackOffice 2658-2660). Its figures are NOT the totals' and do not add up to
// them (a stray out-for-delivery on a pick-up, the Unspecified deliveries): the page must read each as sent.
const tracks = () => ({
  delivery: {
    flow: { cameIn: 702, madeReady: 655, outForDelivery: 377, trips: 409, handedOver: 640 },
    misses: misses({ returnedBack: 20, rescheduled: 8, closeRequested: 1, closedOrCancelled: 11 }),
    avgHandOverMinutes: 96.25,
    // 812 (spec 811): slot keeping, Delivered per trip, Avg delivery time.
    slot: { inSlot: 512, outOfSlot: 96, noSlot: 32, inSlotShare: 0.8, outOfSlotShare: 0.15 },
    deliveredPerTrip: 1.56,
    avgDeliveryMinutes: 41.5,
  },
  pickUp: {
    flow: { cameIn: 529, madeReady: 444, handedOver: 455 },
    misses: misses({ returnedBack: 0, rescheduled: 0, closeRequested: 3, closedOrCancelled: 6 }),
    avgHandOverMinutes: 31.5,
    // 814: unlike the hand-over average, so the lane is seen to read Avg delivery time.
    avgDeliveryMinutes: 30.75,
  },
})
// 812 (spec 811): the previous block. Today's window: the same weekday last week up to the same time.
// Avg delivery time carries NO previous figure here: its tile must draw no change line.
const previousToday = () => ({
  from: daysAgo(7),
  to: daysAgo(7),
  until: '09:35',
  cameIn: { value: 1187, change: 47, changePct: 0.0396 },
  handedOver: { value: 1100, change: -7, changePct: -0.0064 },
  inSlotShare: { value: 0.8, change: 0, changePct: 0 },
  outOfSlotShare: { value: 0, change: 0.15, changePct: null },
  deliveredPerTrip: { value: 1.61, change: -0.05, changePct: -0.031 },
})
/** A Range's window: the equal-length range ending the day before From. */
const previousRange = () => ({ ...previousToday(), from: daysAgo(14), to: daysAgo(8), until: undefined })
/** A 2658 server: tracks without their misses. */
const tracksWithoutMisses = () => {
  const { delivery, pickUp } = tracks()
  // A 2658 server is older than spec 811 too: no slot keeping, Delivered per trip or Avg delivery time.
  const { misses: _d, slot: _s, deliveredPerTrip: _dp, avgDeliveryMinutes: _da, ...d } = delivery
  const { misses: _p, avgDeliveryMinutes: _pa, ...p } = pickUp
  return { delivery: d, pickUp: p }
}
const store = (storeCode, over = {}) => ({ storeCode, flow: flow(), misses: misses(), avgHandOverMinutes: 92.4, avgDeliveryMinutes: 40.1, tracks: tracks(), unspecified: 3, ...over })
const statistics = (over = {}) => ({
  asOf: `${TODAY}T09:35:00`,
  flow: flow(),
  misses: misses(),
  avgHandOverMinutes: 87.46,
  avgDeliveryMinutes: 38.2,
  previous: previousToday(),
  tracks: tracks(),
  unspecified: 3,
  series: [
    { bucket: `${TODAY}T08:00:00`, cameIn: 0, handedOver: 0 },
    { bucket: `${TODAY}T09:00:00`, cameIn: 12, handedOver: 7 },
  ],
  stores: [store('P001'), store('P019')],
  ...over,
})
/**
 * An older SIS.Api: no `trips` at all, nothing handed over yet (a null average), and — older than
 * 2658 — no `tracks` and no `unspecified` anywhere, the keys absent rather than null.
 */
const olderServer = () => {
  const { trips: _dropped, ...noTrips } = flow({ handedOver: 0, delivered: 0, pickedUp: 0 })
  // …and, older than spec 811, no `previous` and no `avgDeliveryMinutes` (the slot fields live in `tracks`).
  const { tracks: _t, unspecified: _u, previous: _p, avgDeliveryMinutes: _a, ...older } = statistics({ flow: noTrips, avgHandOverMinutes: null })
  const { tracks: _st, unspecified: _su, avgDeliveryMinutes: _sa, ...olderStore } = store('P001', { flow: noTrips, avgHandOverMinutes: null })
  return { ...older, stores: [olderStore] }
}

/** Three stores whose figures rank differently, every field sent; one handed nothing over (a null average). */
const rankedStores = () => [
  store('P001', { flow: flow({ trips: 150, handedOver: 300 }), avgHandOverMinutes: 92.4 }),
  store('P019', { flow: flow({ trips: 9, handedOver: 500 }), avgHandOverMinutes: 41.5 }),
  store('P007', { flow: flow({ trips: 60, handedOver: 0, delivered: 0, pickedUp: 0 }), avgHandOverMinutes: null }),
]

const browser = await chromium.launch()

async function open(dir, { grant = true, answer = () => statistics(), clock = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  if (clock) await page.clock.install()
  const errors = []
  const calls = []
  const statQueries = []
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
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: grant, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true }))
    if (p === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'SdDocumentWeb/StoreStatistics') {
      statQueries.push(url.searchParams)
      const a = answer(url.searchParams)
      if (a === 'tooLong')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The statistics range cannot be longer than 31 days.',
            errors: [{ errorCode: 'SDD-02131', internalErrorCode: '', errorMessage: 'The statistics range cannot be longer than 31 days.' }],
          }),
        )
      return route.fulfill(envelope(a))
    }
    // 485: the two EXISTING lookups the scope reads (no new door).
    if (p === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORES))
    if (p === 'SdDocument/DocumentTypes') return route.fulfill(envelope(DOCUMENT_TYPES))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, statQueries }
}

// The lookups' rows, as `SdDocument/StoreDetails` and `SdDocument/DocumentTypes` send them.
const storeRow = (storeCode, city) => ({ storeCode, city, region: 'C', storeAddress: '', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false })
const STORES = [storeRow('P019', 'Jeddah'), storeRow('P001', 'Riyadh')]
const DOCUMENT_TYPES = [
  { documentType: 'ZO', description: 'Online order', documentCategory: 'O' },
  { documentType: 'ZD', description: 'Home delivery', documentCategory: 'D' },
  { documentType: 'ZX', description: 'Erx prescription', documentCategory: 'X' },
  { documentType: 'ZC', description: 'Call center order', documentCategory: 'O' },
]
const FSI = '⁨'
const PDI = '⁩'

const omsLinks = (page) =>
  page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

const waitFigures = (page) => page.locator('[data-statistics-band="storeWide"]').waitFor({ timeout: 20000 })

/** A band's tiles, in DOM order. */
const tilesOf = (page, selector) => page.locator(`${selector} [data-figure-tile]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-figure-tile')))

/**
 * One funnel as drawn (814): its stage tiles and captions in DOM order, each stage's top edge, each
 * stage bar's fill (its share, as the bar's width over its track, and which edge it grows from), the
 * slot split (its state, its segments left to right with their widths, its key's figures), the
 * average, and the funnel's own box.
 */
const laneOf = (page, track) =>
  page.evaluate((track) => {
    const band = document.querySelector(`[data-statistics-band="${track}"]`)
    if (!band) return null
    const stages = [...band.querySelectorAll('[data-statistics-stages] [data-figure-tile]')]
    const avg = band.querySelector('[data-statistics-lane-average] [data-figure-tile]')
    const barOf = (stage) => {
      const box = stage.querySelector('[data-chart="stage-bar"]')
      if (!box) return null
      const fill = box.firstElementChild.getBoundingClientRect()
      const r = box.getBoundingClientRect()
      return {
        dir: box.getAttribute('dir'),
        pct: Math.round((fill.width / r.width) * 100),
        // A full bar touches both edges: it grows from either.
        from: fill.width >= r.width - 1 ? 'both' : Math.abs(fill.left - r.left) < 1 ? 'left' : Math.abs(fill.right - r.right) < 1 ? 'right' : 'none',
      }
    }
    const slot = band.querySelector('[data-statistics-slot]')
    const share = slot?.querySelector('[data-chart="share-bar"]')
    const box = band.getBoundingClientRect()
    return {
      heading: band.querySelector('h2')?.textContent.trim(),
      stages: stages.map((e) => e.getAttribute('data-figure-tile')),
      captions: stages.map((e) => e.firstElementChild.textContent.trim()),
      tops: stages.map((e) => Math.round(e.getBoundingClientRect().top)),
      bars: stages.map(barOf),
      slot: slot
        ? {
            state: slot.getAttribute('data-statistics-slot'),
            heading: slot.querySelector('h3')?.textContent.trim(),
            dir: share?.getAttribute('dir') ?? null,
            label: share?.getAttribute('aria-label') ?? null,
            dash: slot.querySelector('[data-slot-bar="none"]')?.textContent.trim() ?? null,
            segments: share
              ? [...share.querySelectorAll('[data-share-segment]')]
                  .map((e) => ({ id: e.getAttribute('data-share-segment'), left: e.getBoundingClientRect().left, w: e.getBoundingClientRect().width }))
                  .sort((a, b) => a.left - b.left)
                  .map((x) => ({ id: x.id, pct: Math.round((x.w / share.getBoundingClientRect().width) * 100) }))
              : [],
            keys: [...slot.querySelectorAll('[data-slot-key]')].map((e) => e.getAttribute('data-slot-key')),
          }
        : null,
      avg: avg?.getAttribute('data-figure-tile') ?? null,
      avgCaption: avg?.firstElementChild.textContent.trim() ?? null,
      avgTop: avg ? Math.round(avg.getBoundingClientRect().top) : null,
      box: { left: Math.round(box.left), right: Math.round(box.right), top: Math.round(box.top), bottom: Math.round(box.bottom) },
    }
  }, track)

/** Strictly increasing (LTR) or decreasing (RTL) — the stages in reading order. */
const inReadingOrder = (xs, dir) => xs.every((x, i) => i === 0 || (dir === 'rtl' ? x < xs[i - 1] : x > xs[i - 1]))

/** One "Did not go to plan" row as drawn: its caption, its tiles in DOM order, each tile's value, left edge and accent. */
const missesRowOf = (page, track) =>
  page.evaluate((track) => {
    const row = document.querySelector(`[data-statistics-band="misses"] [data-statistics-misses-row="${track}"]`)
    if (!row) return null
    const tiles = [...row.querySelectorAll('[data-figure-tile]')]
    return {
      heading: row.querySelector('h3')?.textContent.trim(),
      tiles: tiles.map((e) => e.getAttribute('data-figure-tile')),
      captions: tiles.map((e) => e.firstElementChild.textContent.trim()),
      values: tiles.map((e) => e.querySelector('[data-figure] bdi[dir="ltr"]')?.textContent ?? null),
      lefts: tiles.map((e) => Math.round(e.getBoundingClientRect().left)),
      accents: tiles.map((e) => [...e.classList].find((c) => c.startsWith('border-t-') && c !== 'border-t-2') ?? null),
    }
  }, track)
const NO_ROW = { heading: null, tiles: [], captions: [], values: [], lefts: [], accents: [] }
const MISS_IDS = ['returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled']
const isMiss = (k) => MISS_IDS.some((m) => k.endsWith(`.${m}`))

/** Every figure as drawn: its text, and whether the number sits in a <bdi dir="ltr">. */
const figures = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('[data-figure]')].map((el) => [
        el.getAttribute('data-figure'),
        { text: el.textContent.trim(), isolated: !!el.querySelector('bdi[dir="ltr"]'), bdi: el.querySelector('bdi[dir="ltr"]')?.textContent ?? null },
      ]),
    ),
  )

/**
 * 812: the headline strip as drawn — each tile in DOM order with its caption, its figure (and whether it
 * sits in a <bdi dir="ltr">), its change line (direction, the isolated change, the previous figure) and
 * the line under it with its isolated values; and the compared-window sentence with its isolates.
 */
const headlineOf = (page) =>
  page.evaluate(() => {
    const strip = document.querySelector('[data-statistics-headline]')
    if (!strip) return null
    const tiles = [...strip.querySelectorAll(':scope > [data-figure-tile]:has([data-chart="kpi"])')].map((el) => {
      const value = el.querySelector('[data-kpi-value]')
      const delta = el.querySelector('[data-kpi-delta]')
      const sub = el.querySelector('[data-figure$=".sub"]')
      return {
        id: el.getAttribute('data-figure-tile'),
        caption: el.firstElementChild.textContent.trim(),
        value: value?.textContent.trim() ?? null,
        valueIsolated: !!value?.querySelector('bdi[dir="ltr"]'),
        direction: delta?.getAttribute('data-kpi-delta') ?? null,
        change: delta?.querySelector('span bdi[dir="ltr"]')?.textContent ?? null,
        changeWords: delta?.querySelector('[aria-label]')?.getAttribute('aria-label') ?? null,
        previous: el.querySelector('[data-kpi-previous] bdi[dir="ltr"]')?.textContent ?? null,
        sub: sub?.textContent.trim() ?? null,
        subValues: sub ? [...sub.querySelectorAll('bdi[dir="ltr"]')].map((b) => b.textContent) : [],
        left: Math.round(el.getBoundingClientRect().left),
      }
    })
    const compared = document.querySelector('[data-statistics-compared]')
    return {
      tiles,
      compared: compared
        ? { kind: compared.getAttribute('data-statistics-compared'), text: compared.textContent.trim(), values: [...compared.querySelectorAll('bdi[dir="ltr"]')].map((b) => b.textContent) }
        : null,
    }
  })
const HEADLINE_IDS = ['cameIn', 'handedOver', 'inSlot', 'outOfSlot', 'deliveredPerTrip', 'avgDeliveryMinutes']

/**
 * The store table's rows in their shown order (by AG Grid's row-index, not DOM order), each cell's
 * text by column. The pinned store column draws its half of a row in a separate container, so the
 * halves are merged by row-index.
 */
const tableRows = (page) =>
  page.evaluate(() => {
    const byIndex = new Map()
    for (const row of document.querySelectorAll('[data-statistics-stores] .ag-row[row-index]')) {
      const i = Number(row.getAttribute('row-index'))
      const cells = Object.fromEntries([...row.querySelectorAll('.ag-cell')].map((c) => [c.getAttribute('col-id'), c.textContent.trim()]))
      byIndex.set(i, { ...byIndex.get(i), ...cells })
    }
    return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, r]) => r)
  })
/** Clicks a store-table header and waits for its sort to land. */
const sortBy = async (page, colId, sort) => {
  await page.locator(`[data-statistics-stores] .ag-header-cell[col-id="${colId}"] .ag-header-cell-label`).click()
  await page.locator(`[data-statistics-stores] .ag-header-cell[col-id="${colId}"][aria-sort="${sort}"]`).waitFor({ timeout: 5000 })
  await page.waitForTimeout(150)
}

const params = (q) => (q ? Object.fromEntries([...q.entries()]) : null)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ask = (from, to, granularity) => ({ From: from, To: to, Granularity: granularity, LeaveOutChurned: 'true' })

async function drive(dir) {
  const label = dir

  // ── 1: no list grant → hidden leaf, denied card, no call ────────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir, { grant: false })
    await page.goto(`${BASE}/`)
    await page.waitForTimeout(1200)
    const links = await omsLinks(page)
    check(`${label}: without the list grant the leaf is hidden`, !links.includes('/oms/delivery-statistics'), links.join(' · '))
    await page.goto(`${BASE}/oms/delivery-statistics`)
    const card = page.locator('[role="alert"]', { hasText: 'No access to delivery statistics' })
    await card.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: the URL shows the denied card and never asks for the statistics`,
      (await card.count()) === 1 && !calls.includes('SdDocumentWeb/StoreStatistics'),
    )
    check(`${label}: no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–4, 6, 7: granted ──────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, calls, statQueries } = await open(dir, {
      answer: (q) => (q.get('From') === daysAgo(31) ? 'tooLong' : statistics()),
    })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/delivery-statistics"]').first().waitFor({ timeout: 20000 })
    const links = await omsLinks(page)
    check(`${label}: the leaf is last in the OMS group`, links.at(-1) === '/oms/delivery-statistics', links.join(' · '))
    await page.locator('nav a[href="/oms/delivery-statistics"]').first().click()
    await waitFigures(page)
    check(
      `${label}: the OMS group and the page gate cost ONE probe call`,
      calls.filter((c) => c === 'SdDocumentWeb/Access').length === 1,
      String(calls.filter((c) => c === 'SdDocumentWeb/Access').length),
    )
    check(`${label}: dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

    // 3: Today on the wire
    check(
      `${label}: Today asks From = To = today by the hour, churned left out, all stores, no types`,
      statQueries.length === 1 && same(params(statQueries[0]), ask(TODAY, TODAY, 'hour')),
      JSON.stringify(params(statQueries[0])),
    )
    check(`${label}: Today is the selected tab and the URL is bare`, (await page.locator('[data-period-tab="today"][aria-pressed="true"]').count()) === 1 && new URL(page.url()).search === '')

    // 4: the figures
    const f = await figures(page)
    const order = await tilesOf(page, '[data-statistics-band="storeWide"]')
    check(
      `${label}: the headline strip: the six figures in order, then Unspecified — no Avg hand-over, no store-wide Made ready / Out for delivery`,
      same(order, [...HEADLINE_IDS, 'unspecified']),
      order.join(','),
    )
    // 812: the six headline figures, their server change and the compared window.
    const h = await headlineOf(page)
    const hb = Object.fromEntries((h?.tiles ?? []).map((x) => [x.id, x]))
    check(
      `${label}: the headline captions read Came in, Handed over, In slot, Out of slot, Delivered per trip, Avg delivery time`,
      same(h?.tiles.map((x) => x.caption), ['Came in', 'Handed over', 'In slot', 'Out of slot', 'Delivered per trip', 'Avg delivery time']),
      JSON.stringify(h?.tiles.map((x) => x.caption)),
    )
    check(
      `${label}: the headline figures are the stub's, each isolated whole`,
      same(h?.tiles.map((x) => x.value), ['1,234', '1,093', '80.0%', '15.0%', '1.56', '38.2 min']) && h.tiles.every((x) => x.valueIsolated),
      JSON.stringify(h?.tiles.map((x) => [x.value, x.valueIsolated])),
    )
    check(
      `${label}: each change is the server's — the arrow from its sign, the words from changePct — isolated, with the previous figure`,
      same(h?.tiles.map((x) => x.direction), ['up', 'down', 'flat', 'up', 'down', null]) &&
        same(h.tiles.map((x) => x.change), ['4.0%', '0.6%', '0.0%', '15.0%', '3.1%', null]) &&
        same(h.tiles.map((x) => x.previous), ['1,187', '1,100', '80.0%', '0.0%', '1.61', null]) &&
        hb.cameIn.changeWords === `Up ${FSI}4.0%${PDI} on the previous period`,
      JSON.stringify(h?.tiles.map((x) => [x.direction, x.change, x.previous, x.changeWords])),
    )
    check(
      `${label}: the change is drawn in ink, never a status colour`,
      (await page.locator('[data-statistics-headline] [data-kpi-delta] [class*="text-danger"], [data-statistics-headline] [data-kpi-delta] [class*="text-success"]').count()) === 0,
    )
    check(
      `${label}: Avg delivery time with no previous figure draws no change line`,
      (await page.locator('[data-figure-tile="avgDeliveryMinutes"] [data-kpi-delta]').count()) === 0,
    )
    check(
      `${label}: Handed over keeps the till's Delivered | Picked up split under it; In slot / Out of slot say n of N delivered`,
      hb.handedOver?.sub === 'Delivered 640 · Picked up 455' &&
        same(hb.handedOver.subValues, ['640', '455']) &&
        hb.inSlot?.sub === '512 of 640 delivered' &&
        same(hb.inSlot.subValues, ['512', '640']) &&
        hb.outOfSlot?.sub === '96 of 640 delivered' &&
        same(hb.outOfSlot.subValues, ['96', '640']) &&
        [hb.cameIn, hb.deliveredPerTrip, hb.avgDeliveryMinutes].every((x) => x?.sub === null),
      JSON.stringify([hb.handedOver?.sub, hb.inSlot?.sub, hb.outOfSlot?.sub]),
    )
    check(
      `${label}: Today's compared window reads "vs <day> to <time>", each value isolated`,
      h?.compared?.kind === 'until' && h.compared.text === `vs ${daysAgo(7)} to 09:35` && same(h.compared.values, [daysAgo(7), '09:35']),
      JSON.stringify(h?.compared),
    )
    check(`${label}: the six tiles read in reading order`, inReadingOrder(h?.tiles.map((x) => x.left) ?? [], dir), JSON.stringify(h?.tiles.map((x) => x.left)))
    const bandOrder = await page.locator('[data-statistics-band]').evaluateAll((els) => els.map((e) => e.getAttribute('data-statistics-band')))
    check(`${label}: the store-wide group, then the Delivery lane, then the Pick-up lane, then the misses`, same(bandOrder.slice(0, 4), ['storeWide', 'delivery', 'pickUp', 'misses']), bandOrder.join(','))

    // 489: the two lanes
    const dl = await laneOf(page, 'delivery')
    const pl = await laneOf(page, 'pickUp')
    check(
      `${label}: the Delivery lane — Came in → Made ready → Out for delivery → Delivered`,
      dl?.heading === 'Delivery' &&
        same(dl.stages, ['delivery.cameIn', 'delivery.madeReady', 'delivery.outForDelivery', 'delivery.delivered']) &&
        same(dl.captions, ['Came in', 'Made ready', 'Out for delivery', 'Delivered']),
      JSON.stringify(dl),
    )
    check(
      `${label}: the Pick-up lane — Came in → Made ready → Picked up, no Out for delivery`,
      pl?.heading === 'Pick-up' &&
        same(pl.stages, ['pickUp.cameIn', 'pickUp.madeReady', 'pickUp.pickedUp']) &&
        same(pl.captions, ['Came in', 'Made ready', 'Picked up']) &&
        (await page.locator('[data-statistics-band="pickUp"] [data-figure-tile*="outForDelivery"], [data-statistics-band="pickUp"] [data-figure*="trips"]').count()) === 0,
      JSON.stringify(pl),
    )
    // 814: funnels — stages top to bottom, each with a stage bar of its share of the lane's Came in.
    const down = (xs) => xs.every((y, i) => i === 0 || y > xs[i - 1])
    check(`${label}: each funnel's stages read top to bottom`, down(dl.tops) && down(pl.tops), `${dl.tops} | ${pl.tops}`)
    const near = (a, b, d = 1) => typeof a === 'number' && Math.abs(a - b) <= d
    const grows = dir === 'rtl' ? 'right' : 'left'
    check(
      `${label}: each stage bar is its share of the lane's Came in (702 / 529), in an LTR box`,
      dl.bars.every((b) => b?.dir === 'ltr') &&
        pl.bars.every((b) => b?.dir === 'ltr') &&
        [100, 93, 54, 91].every((x, i) => near(dl.bars[i].pct, x)) &&
        [100, 84, 86].every((x, i) => near(pl.bars[i].pct, x)),
      JSON.stringify([dl.bars, pl.bars]),
    )
    check(
      `${label}: the stage bars grow from the reading start (${grows}), mirrored through props`,
      [...dl.bars, ...pl.bars].every((b) => b?.from === grows || b?.from === 'both') && [...dl.bars, ...pl.bars].some((b) => b?.from === grows),
      JSON.stringify([...dl.bars, ...pl.bars].map((b) => b?.from)),
    )
    check(
      `${label}: the Delivery funnel's slot split — In slot | Out of slot | No slot, the stub's 512 / 96 / 32`,
      dl.slot?.state === 'drawn' &&
        dl.slot.heading === 'Slot keeping' &&
        dl.slot.dir === 'ltr' &&
        same(dl.slot.keys, ['inSlot', 'outOfSlot', 'noSlot']) &&
        same(dl.slot.segments.map((x) => x.id), dir === 'rtl' ? ['noSlot', 'outOfSlot', 'inSlot'] : ['inSlot', 'outOfSlot', 'noSlot']) &&
        [['inSlot', 80], ['outOfSlot', 15], ['noSlot', 5]].every(([id, x]) => near(dl.slot.segments.find((g) => g.id === id)?.pct, x, 2)) &&
        dl.slot.label === 'Slot keeping of delivered: In slot ⁨512⁩, Out of slot ⁨96⁩, No slot ⁨32⁩',
      JSON.stringify(dl.slot),
    )
    check(
      `${label}: the slot key reads the stub's counts and shares, each isolated; No slot carries no share`,
      f['delivery.slot.inSlot']?.bdi === '512' &&
        f['delivery.slot.inSlotShare']?.bdi === '80%' &&
        f['delivery.slot.outOfSlot']?.bdi === '96' &&
        f['delivery.slot.outOfSlotShare']?.bdi === '15%' &&
        f['delivery.slot.noSlot']?.bdi === '32' &&
        f['delivery.slot.noSlotShare'] === undefined,
      JSON.stringify(Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith('delivery.slot.')))),
    )
    check(`${label}: the Pick-up funnel has no slot split`, pl.slot === null)
    check(
      `${label}: each funnel's average comes after its stages: Avg delivery time`,
      dl.avg === 'delivery.avg' &&
        dl.avgCaption === 'Avg delivery time' &&
        pl.avg === 'pickUp.avg' &&
        pl.avgCaption === 'Avg delivery time' &&
        dl.avgTop > dl.tops.at(-1) &&
        pl.avgTop > pl.tops.at(-1),
      `${dl.avg} ${dl.avgCaption} ${dl.avgTop} · ${pl.avg} ${pl.avgCaption} ${pl.avgTop}`,
    )
    check(
      `${label}: wide (1600px), the funnels stand side by side, Delivery at the reading start`,
      dl.box.top === pl.box.top && (dir === 'rtl' ? dl.box.left > pl.box.right - 1 : pl.box.left > dl.box.right - 1),
      JSON.stringify([dl.box, pl.box]),
    )
    check(
      `${label}: the lanes read the stub's tracks as sent (not the totals, not derived)`,
      f['delivery.cameIn']?.bdi === '702' &&
        f['delivery.madeReady']?.bdi === '655' &&
        f['delivery.outForDelivery']?.bdi === '377' &&
        f['delivery.delivered']?.bdi === '640' &&
        f['pickUp.cameIn']?.bdi === '529' &&
        f['pickUp.madeReady']?.bdi === '444' &&
        f['pickUp.pickedUp']?.bdi === '455',
      JSON.stringify(Object.fromEntries(Object.entries(f).filter(([k]) => k.includes('.')).map(([k, v]) => [k, v.bdi]))),
    )
    check(
      `${label}: Trips is the Delivery lane's Out for delivery sub-caption, from tracks.delivery.flow.trips`,
      (await page.locator('[data-figure-tile="delivery.outForDelivery"] [data-figure="delivery.trips"]').count()) === 1 &&
        f['delivery.trips']?.text === 'Trips 409' &&
        f['delivery.trips'].bdi === '409' &&
        (await page.locator('[data-figure="trips"]').count()) === 0,
      JSON.stringify(f['delivery.trips']),
    )
    check(
      `${label}: each lane's average is its Avg delivery time (avgDeliveryMinutes), with the unit`,
      f['delivery.avg']?.bdi === '41.5' && f['delivery.avg'].text === '41.5min' && f['pickUp.avg']?.bdi === '30.75' && f['pickUp.avg'].text === '30.75min',
      `${JSON.stringify(f['delivery.avg'])} ${JSON.stringify(f['pickUp.avg'])}`,
    )
    // A narrower window: the funnels stack, Delivery above Pick-up.
    await page.setViewportSize({ width: 1000, height: 1000 })
    await page.waitForTimeout(200)
    const narrowDl = await laneOf(page, 'delivery')
    const narrowPl = await laneOf(page, 'pickUp')
    check(
      `${label}: narrow (1000px), the funnels stack, Delivery above Pick-up, each still top to bottom`,
      narrowPl.box.top >= narrowDl.box.bottom && down(narrowDl.tops) && down(narrowPl.tops),
      JSON.stringify([narrowDl.box, narrowPl.box]),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-today-narrow.png`, fullPage: true })
    await page.setViewportSize({ width: 1600, height: 1000 })
    await page.waitForTimeout(200)
    check(`${label}: the Unspecified tile shows the server's count`, f.unspecified?.bdi === '3' && /Unspecified/.test(await page.locator('[data-figure-tile="unspecified"]').innerText()), JSON.stringify(f.unspecified))
    // 490: the misses band is two rows, one per track; the old single store-wide band is gone.
    const missRows = await page.locator('[data-statistics-band="misses"] [data-statistics-misses-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-statistics-misses-row')))
    // A missing row records failed checks below rather than throwing and ending the pass.
    const dm = (await missesRowOf(page, 'delivery')) ?? NO_ROW
    const pm = (await missesRowOf(page, 'pickUp')) ?? NO_ROW
    check(
      `${label}: Did not go to plan is two rows, Delivery then Pick-up`,
      same(missRows, ['delivery', 'pickUp']) && dm?.heading === 'Delivery' && pm?.heading === 'Pick-up',
      `${missRows} · ${dm?.heading} · ${pm?.heading}`,
    )
    check(
      `${label}: the old single store-wide misses band is gone (no store-wide miss tile anywhere)`,
      (await page.locator(MISS_IDS.map((m) => `[data-figure-tile="${m}"]`).join(', ')).count()) === 0,
    )
    check(
      `${label}: the Delivery row shows all five, in the till's order, from tracks.delivery.misses (not the totals)`,
      same(dm.tiles, MISS_IDS.map((m) => `delivery.${m}`)) &&
        same(dm.captions, ['Returned back', 'Rejected', 'Rescheduled', 'Close requested', 'Closed / cancelled']) &&
        same(dm.values, ['20', '0', '8', '1', '11']),
      JSON.stringify(dm),
    )
    check(
      `${label}: the miss accents stay as on the till — failures danger, re-plans attention`,
      same(dm.accents, ['border-t-danger', 'border-t-danger', 'border-t-attention', 'border-t-attention', 'border-t-border']),
      dm.accents.join(','),
    )
    check(
      `${label}: the Pick-up row at zero hides Returned back, Rejected, Rescheduled; Close requested and Closed / cancelled stay`,
      same(pm.tiles, ['pickUp.closeRequested', 'pickUp.closedOrCancelled']) && same(pm.captions, ['Close requested', 'Closed / cancelled']) && same(pm.values, ['3', '6']),
      JSON.stringify(pm),
    )
    check(`${label}: each misses row reads in reading order`, inReadingOrder(dm.lefts, dir) && inReadingOrder(pm.lefts, dir), `${dm.lefts} | ${pm.lefts}`)
    // 812: the entry-based Avg hand-over tile has left the web.
    check(`${label}: the old Avg hand-over tile is gone`, (await page.locator('[data-figure-tile="avgHandOver"], [data-statistics-split]').count()) === 0)
    check(`${label}: Handed over is the SERVER's figure, not Delivered + Picked up`, hb.handedOver?.value === '1,093', JSON.stringify(hb.handedOver?.value))
    check(`${label}: a real 0 reads 0`, f['delivery.rejected']?.bdi === '0', JSON.stringify(f['delivery.rejected']))
    check(`${label}: every number is isolated`, Object.values(f).every((x) => x.isolated), Object.keys(f).filter((k) => !f[k].isolated).join(','))
    const asOf = await page.locator('[data-statistics-as-of]').innerText()
    check(
      `${label}: AsOf is shown, isolated, with the 5-minute note`,
      asOf.includes(`${TODAY} 09:35`) && /at most 5 minutes behind/.test(asOf) && (await page.locator('[data-statistics-as-of] bdi[dir="ltr"]').count()) === 1,
      asOf,
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-today.png`, fullPage: true })

    // 6: Yesterday
    await page.locator('[data-period-tab="yesterday"]').click()
    await page.waitForFunction(() => new URL(location.href).searchParams.get('period') === 'yesterday')
    await waitFigures(page)
    await page.waitForTimeout(200)
    check(`${label}: Yesterday asks yesterday alone, by the hour`, same(params(statQueries.at(-1)), ask(YESTERDAY, YESTERDAY, 'hour')), JSON.stringify(params(statQueries.at(-1))))

    // Range: 7 by default, then 14, ending yesterday, by the day
    await page.locator('[data-period-tab="range"]').click()
    await page.waitForFunction(() => new URL(location.href).searchParams.get('pick') === '7')
    await page.waitForTimeout(300)
    check(`${label}: Range opens on the 7-day pick ending yesterday, by the day`, same(params(statQueries.at(-1)), ask(daysAgo(7), YESTERDAY, 'day')), JSON.stringify(params(statQueries.at(-1))))
    const showing = await page.locator('[data-statistics-period]').innerText()
    check(
      `${label}: the range shown is one isolated value, start first`,
      showing.includes(`${daysAgo(7)} – ${YESTERDAY}`) && (await page.locator('[data-statistics-period] bdi[dir="ltr"]').count()) === 1,
      showing,
    )
    const pickLabels = await page.locator('[data-range-pick]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
    check(`${label}: the quick picks read as days, the cap isolated in its caption`,
      same(pickLabels, ['7 days', '14 days', '31 days', 'Custom']) &&
        (await page.locator('[data-range-pick="7"] bdi[dir="ltr"]').count()) === 1 &&
        (await page.locator('[data-statistics-controls] legend bdi[dir="ltr"]').textContent()) === '31',
      pickLabels.join(' · '))
    await page.screenshot({ path: `${SHOTS}/${dir}-range7.png`, fullPage: true })
    await page.locator('[data-range-pick="14"]').click()
    await page.waitForFunction(() => new URL(location.href).searchParams.get('pick') === '14')
    await page.waitForTimeout(300)
    check(`${label}: the 14-day pick ends yesterday`, same(params(statQueries.at(-1)), ask(daysAgo(14), YESTERDAY, 'day')), JSON.stringify(params(statQueries.at(-1))))

    // 9: the 31-day pick is allowed here, and the stub's server refuses it with SDD-02131
    await page.locator('[data-range-pick="31"]').click()
    const refusal = page.locator('[role="alert"]', { hasText: 'The statistics range cannot be longer than 31 days.' })
    await refusal.waitFor({ timeout: 20000 })
    check(`${label}: the 31-day pick ends yesterday`, same(params(statQueries.at(-1)), ask(daysAgo(31), YESTERDAY, 'day')), JSON.stringify(params(statQueries.at(-1))))
    check(
      `${label}: an SDD-02131 refusal is shown in the server's words, with no figures beside it`,
      (await refusal.count()) === 1 && (await page.locator('[data-statistics-band]').count()) === 0,
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-sdd02131.png`, fullPage: true })

    // Custom, ending today
    await page.locator('[data-range-pick="custom"]').click()
    await page.locator('[data-range-from]').waitFor()
    check(
      `${label}: Custom starts from the range on screen`,
      (await page.locator('[data-range-from]').inputValue()) === daysAgo(31) && (await page.locator('[data-range-to]').inputValue()) === YESTERDAY,
    )
    await page.locator('[data-range-from]').fill(daysAgo(5))
    await page.locator('[data-range-to]').fill(TODAY)
    await page.waitForFunction((t) => new URL(location.href).searchParams.get('to') === t, TODAY)
    await waitFigures(page)
    await page.waitForTimeout(200)
    check(`${label}: a custom range may end today`, same(params(statQueries.at(-1)), ask(daysAgo(5), TODAY, 'day')), JSON.stringify(params(statQueries.at(-1))))
    check(
      `${label}: the custom range lives in the URL`,
      new URL(page.url()).search === `?period=range&pick=custom&from=${daysAgo(5)}&to=${TODAY}`,
      new URL(page.url()).search,
    )

    // 7: the guard — 32 days inclusive, then reversed: refused, no call
    const before = statQueries.length
    await page.locator('[data-range-from]').fill(daysAgo(31))
    await page.locator('[data-statistics-refused="tooLong"]').waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
    check(
      `${label}: 32 days inclusive is refused in the UI and makes NO call`,
      statQueries.length === before && (await page.locator('[data-statistics-band]').count()) === 0,
      `${statQueries.length - before} call(s)`,
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-guard.png`, fullPage: true })
    await page.locator('[data-range-from]').fill(daysAgo(30))
    await waitFigures(page)
    await page.waitForTimeout(200)
    check(`${label}: 31 days inclusive ending today is asked for`, same(params(statQueries.at(-1)), ask(daysAgo(30), TODAY, 'day')), JSON.stringify(params(statQueries.at(-1))))
    const beforeReversed = statQueries.length
    await page.locator('[data-range-to]').fill(daysAgo(35))
    await page.locator('[data-statistics-refused="reversed"]').waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
    check(`${label}: a reversed range is refused and makes NO call`, statQueries.length === beforeReversed, `${statQueries.length - beforeReversed} call(s)`)

    // A reload keeps the period: the URL is the source of truth
    await page.locator('[data-range-to]').fill(TODAY)
    await waitFigures(page)
    await page.reload()
    await waitFigures(page)
    check(
      `${label}: a reload keeps the custom range`,
      (await page.locator('[data-period-tab="range"][aria-pressed="true"]').count()) === 1 && (await page.locator('[data-range-from]').inputValue()) === daysAgo(30),
    )
    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: an older server — no trips, a null average ───────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { answer: () => olderServer() })
    await page.goto(`${BASE}/oms/delivery-statistics`)
    await waitFigures(page)
    const f = await figures(page)
    // 812: no previous, no slot, no Delivered per trip, no Avg delivery time — "—", never 0, no change line.
    const h = await headlineOf(page)
    const hb = Object.fromEntries((h?.tiles ?? []).map((x) => [x.id, x]))
    check(
      `${label}: an older server's headline reads "—" on every figure it did not send, never 0`,
      same(h?.tiles.map((x) => x.id), HEADLINE_IDS) && same(h.tiles.map((x) => x.value), ['1,234', '0', '—', '—', '—', '—']) && h.tiles.every((x) => x.valueIsolated),
      JSON.stringify(h?.tiles.map((x) => x.value)),
    )
    check(
      `${label}: with no previous block no tile draws a change line and no compared window is named`,
      (await page.locator('[data-statistics-headline] [data-kpi-delta]').count()) === 0 && h?.compared === null,
    )
    check(
      `${label}: the older server's sub-lines read "—" where absent, and its real 0s read 0`,
      hb.inSlot?.sub === '— of — delivered' && hb.outOfSlot?.sub === '— of — delivered' && hb.handedOver?.sub === 'Delivered 0 · Picked up 0',
      JSON.stringify([hb.inSlot?.sub, hb.handedOver?.sub]),
    )
    // 489: no `tracks` at all — both lanes still drawn, stage for stage, every figure "—".
    const dl = await laneOf(page, 'delivery')
    const pl = await laneOf(page, 'pickUp')
    const laneFigures = Object.entries(f).filter(([k]) => (k.startsWith('delivery.') || k.startsWith('pickUp.')) && !isMiss(k))
    check(
      `${label}: with no tracks both lanes are drawn, stage for stage`,
      dl?.stages.length === 4 && pl?.stages.length === 3 && dl.avg === 'delivery.avg' && pl.avg === 'pickUp.avg',
      `${dl?.stages} | ${pl?.stages}`,
    )
    check(
      `${label}: with no tracks every lane figure reads "—", never 0`,
      // 10 lane figures + the slot key's three counts (814); no share is drawn where none was sent.
      laneFigures.length === 13 && laneFigures.filter(([k]) => !k.endsWith('.trips')).every(([, v]) => v.bdi === '—' && v.text === '—'),
      JSON.stringify(Object.fromEntries(laneFigures.map(([k, v]) => [k, v.text]))),
    )
    check(
      `${label}: with no tracks no stage bar is drawn and the slot split reads "—"`,
      [...dl.bars, ...pl.bars].every((b) => b === null) && dl.slot?.state === 'none' && dl.slot.dash === '—' && dl.slot.segments.length === 0,
      JSON.stringify([dl.bars, pl.bars, dl.slot]),
    )
    check(`${label}: with no tracks the Delivery lane's trips reads "—", never 0`, f['delivery.trips']?.bdi === '—' && f['delivery.trips'].text === 'Trips —', JSON.stringify(f['delivery.trips']))
    check(`${label}: with no unspecified the Unspecified tile is hidden`, (await page.locator('[data-figure-tile="unspecified"]').count()) === 0)
    // 490: no `tracks` — both misses rows still drawn; every shown miss "—", the hide-when-zero three hidden.
    const dm = await missesRowOf(page, 'delivery')
    const pm = await missesRowOf(page, 'pickUp')
    check(
      `${label}: with no tracks the Delivery misses row shows all five as "—", never 0`,
      same(dm?.tiles, MISS_IDS.map((m) => `delivery.${m}`)) && dm.values.every((v) => v === '—'),
      JSON.stringify(dm),
    )
    check(
      `${label}: with no tracks the Pick-up misses row shows only Close requested and Closed / cancelled, as "—"`,
      same(pm?.tiles, ['pickUp.closeRequested', 'pickUp.closedOrCancelled']) && same(pm.values, ['—', '—']),
      JSON.stringify(pm),
    )
    // 487: the store row reads the same dashes.
    await page.locator('[data-statistics-stores] .ag-row').first().waitFor({ timeout: 20000 })
    const older = await tableRows(page)
    check(
      `${label}: in the store table an absent trips and a null average read "—", never 0`,
      older.length === 1 && older[0].trips === '—' && older[0].avgHandOverMinutes === '—' && older[0].handedOver === '0',
      JSON.stringify(older),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-older-server.png`, fullPage: true })
    check(`${label}: no page errors (older server)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 14 (489): a 2658 server — tracks without misses — on a day with no Unspecified delivery ────
  {
    const { context, page, errors } = await open(dir, { answer: () => statistics({ tracks: tracksWithoutMisses(), unspecified: 0 }) })
    await page.goto(`${BASE}/oms/delivery-statistics`)
    await waitFigures(page)
    const f = await figures(page)
    check(`${label}: Unspecified at 0 hides its tile`, (await page.locator('[data-figure-tile="unspecified"]').count()) === 0 && f.unspecified === undefined)
    // 812: tracks from a server older than spec 811 carry no slot keeping, trips ratio or delivery time.
    const h = await headlineOf(page)
    check(
      `${label}: tracks without the spec-811 fields read "—" on In slot, Out of slot, Delivered per trip`,
      same(h?.tiles.slice(2, 5).map((x) => x.value), ['—', '—', '—']) && h.tiles[2].sub === '— of 640 delivered',
      JSON.stringify(h?.tiles.map((x) => [x.value, x.sub])),
    )
    check(
      `${label}: tracks without misses still draw both lanes and their averages`,
      // 814: the lane average is Avg delivery time, which a 2658 server never sends — "—", not its hand-over average.
      f['delivery.delivered']?.bdi === '640' && f['pickUp.pickedUp']?.bdi === '455' && f['delivery.avg']?.bdi === '—' && f['pickUp.avg']?.bdi === '—',
      JSON.stringify([f['delivery.avg'], f['pickUp.avg']]),
    )
    {
      const dl = await laneOf(page, 'delivery')
      check(
        `${label}: tracks without slot keeping draw the stage bars but no slot split ("—")`,
        dl?.bars.every((b) => b !== null) && dl.slot?.state === 'none' && dl.slot.dash === '—',
        JSON.stringify(dl?.slot),
      )
    }
    // 490: tracks without misses — every shown miss "—", the hide-when-zero three hidden.
    const dm = await missesRowOf(page, 'delivery')
    const pm = await missesRowOf(page, 'pickUp')
    check(
      `${label}: tracks without misses read "—" on both misses rows, never 0`,
      same(dm?.tiles, MISS_IDS.map((m) => `delivery.${m}`)) &&
        dm.values.every((v) => v === '—') &&
        same(pm?.tiles, ['pickUp.closeRequested', 'pickUp.closedOrCancelled']) &&
        same(pm.values, ['—', '—']),
      `${JSON.stringify(dm?.values)} | ${JSON.stringify(pm?.tiles)} ${JSON.stringify(pm?.values)}`,
    )
    check(`${label}: no page errors (2658 server)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 15 (490): bad data on a pick-up — a Pick-up Rejected that is not zero stays visible ─────────
  {
    const badPickUp = () => {
      const t = tracks()
      return { ...t, pickUp: { ...t.pickUp, misses: misses({ returnedBack: 0, rejected: 2, rescheduled: 0, closeRequested: 3, closedOrCancelled: 6 }) } }
    }
    const { context, page, errors } = await open(dir, { answer: () => statistics({ tracks: badPickUp() }) })
    await page.goto(`${BASE}/oms/delivery-statistics`)
    await waitFigures(page)
    const pm = await missesRowOf(page, 'pickUp')
    check(
      `${label}: a non-zero Pick-up Rejected is shown, in the till's order and accent; the zero two stay hidden`,
      same(pm?.tiles, ['pickUp.rejected', 'pickUp.closeRequested', 'pickUp.closedOrCancelled']) &&
        same(pm.captions, ['Rejected', 'Close requested', 'Closed / cancelled']) &&
        same(pm.values, ['2', '3', '6']) &&
        pm.accents[0] === 'border-t-danger' &&
        inReadingOrder(pm.lefts, dir),
      JSON.stringify(pm),
    )
    await page.locator('[data-statistics-band="misses"]').screenshot({ path: `${SHOTS}/${dir}-misses-bad-pick-up.png` })
    check(`${label}: no page errors (bad pick-up)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 812: a Range's compared window — the equal-length range before it, one isolated value ─────
  {
    const { context, page, errors } = await open(dir, { answer: () => statistics({ previous: previousRange() }) })
    await page.goto(`${BASE}/oms/delivery-statistics?period=range&pick=7`)
    await waitFigures(page)
    const h = await headlineOf(page)
    check(
      `${label}: a Range's compared window reads "vs <from> – <to>", the range isolated whole`,
      h?.compared?.kind === 'range' && h.compared.text === `vs ${daysAgo(14)} – ${daysAgo(8)}` && same(h.compared.values, [`${daysAgo(14)} – ${daysAgo(8)}`]),
      JSON.stringify(h?.compared),
    )
    await page.locator('[data-statistics-band="storeWide"]').screenshot({ path: `${SHOTS}/${dir}-headline-range.png` })
    check(`${label}: no page errors (headline range)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5: Today polls every 5 minutes; Yesterday does not ──────────────────────────────────────
  {
    const { context, page, errors, statQueries } = await open(dir, { clock: true })
    await page.goto(`${BASE}/oms/delivery-statistics`)
    await waitFigures(page)
    const first = statQueries.length
    await page.clock.runFor(5 * 60_000 + 1_000)
    await page.waitForTimeout(500)
    check(`${label}: Today asks again after 5 minutes`, statQueries.length === first + 1, `${first} → ${statQueries.length}`)
    await page.goto(`${BASE}/oms/delivery-statistics?period=yesterday`)
    await waitFigures(page)
    const afterYesterday = statQueries.length
    await page.clock.runFor(11 * 60_000)
    await page.waitForTimeout(500)
    check(`${label}: Yesterday does not poll`, statQueries.length === afterYesterday, `${afterYesterday} → ${statQueries.length}`)
    check(`${label}: no page errors (polling)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 11 (485): the store picker and the leave-outs ───────────────────────────────────────────
  {
    const { context, page, errors, statQueries } = await open(dir)
    /** Waits until the last statistics request asks exactly `want`. */
    const asked = async (want, ms = 10000) => {
      const end = Date.now() + ms
      while (Date.now() < end) {
        if (same(params(statQueries.at(-1)), want)) return true
        await page.waitForTimeout(100)
      }
      return false
    }
    const search = () => new URL(page.url()).searchParams
    await page.goto(`${BASE}/oms/delivery-statistics`)
    await waitFigures(page)
    const select = page.locator('[data-statistics-store]')
    const churned = page.locator('[data-leave-out-churned]')
    const typesCount = page.locator('[data-leave-out-types-count]')

    // The defaults: all stores, churned left out, no types.
    await page.locator('[data-statistics-store] option[value="P001"]').waitFor({ state: 'attached', timeout: 10000 })
    const storeOptions = await select.locator('option').evaluateAll((els) => els.map((e) => [e.value, e.textContent]))
    check(
      `${label}: the store picker opens on All stores, then each store as ONE isolated code · city pair in code order`,
      (await select.inputValue()) === '' &&
        same(storeOptions, [['', 'All stores'], ['P001', `${FSI}P001 · Riyadh${PDI}`], ['P019', `${FSI}P019 · Jeddah${PDI}`]]),
      JSON.stringify(storeOptions),
    )
    check(
      `${label}: Wasfaty churned refills is ticked (left out) by default, and no order type is left out`,
      (await churned.isChecked()) && (await typesCount.innerText()) === 'none',
    )

    // A store sends StoreCode.
    await select.selectOption('P019')
    await page.waitForFunction(() => new URL(location.href).searchParams.get('store') === 'P019')
    check(
      `${label}: picking a store sends StoreCode`,
      await asked({ ...ask(TODAY, TODAY, 'hour'), StoreCode: 'P019' }),
      JSON.stringify(params(statQueries.at(-1))),
    )

    // Unticking churned sends LeaveOutChurned=false.
    await churned.click() // URL-controlled: its state lands with the navigation, so wait on the URL, not the click
    await page.waitForFunction(() => new URL(location.href).searchParams.get('leaveOutChurned') === 'false')
    check(
      `${label}: unticking churned sends LeaveOutChurned=false`,
      await asked({ From: TODAY, To: TODAY, Granularity: 'hour', LeaveOutChurned: 'false', StoreCode: 'P019' }),
      JSON.stringify(params(statQueries.at(-1))),
    )

    // Two order types left out, sent comma-joined.
    await page.locator('[data-leave-out-types-trigger]').click()
    await page.locator('[data-leave-out-types-panel]').waitFor()
    const offered = await page.locator('[data-leave-out-type]').evaluateAll((els) => els.map((e) => e.getAttribute('data-leave-out-type')))
    check(`${label}: the order types offered are the order and Erx types, in caption order`, same(offered, ['ZC', 'ZX', 'ZO']), offered.join(','))
    await page.locator('[data-leave-out-type="ZO"] input').click()
    await page.locator('[data-leave-out-type="ZC"] input').click()
    await page.waitForFunction(() => new URL(location.href).searchParams.get('leaveOutTypes') === 'ZC,ZO')
    const afterTicks = await page.locator('[data-leave-out-type]').evaluateAll((els) => els.map((e) => e.getAttribute('data-leave-out-type')))
    check(`${label}: ticking moves no row: the list keeps its caption order`, same(afterTicks, ['ZC', 'ZX', 'ZO']), afterTicks.join(','))
    const scoped = { From: TODAY, To: TODAY, Granularity: 'hour', LeaveOutChurned: 'false', StoreCode: 'P019', LeaveOutTypes: 'ZC,ZO' }
    check(`${label}: leaving out two types sends them comma-joined`, await asked(scoped), JSON.stringify(params(statQueries.at(-1))))
    check(
      `${label}: the picker's count is isolated`,
      (await typesCount.innerText()) === '2' && (await page.locator('[data-leave-out-types-count] bdi[dir="ltr"]').count()) === 1,
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-scope.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await page.locator('[data-leave-out-types-panel]').waitFor({ state: 'detached' })

    // A reload keeps all three: the URL is the source of truth.
    const beforeReload = statQueries.length
    await page.reload()
    await waitFigures(page)
    await page.locator('[data-statistics-store] option[value="P019"]').waitFor({ state: 'attached', timeout: 10000 })
    check(
      `${label}: a reload keeps the store, the unticked churned switch and the two types`,
      (await select.inputValue()) === 'P019' &&
        !(await churned.isChecked()) &&
        (await typesCount.innerText()) === '2' &&
        search().get('leaveOutTypes') === 'ZC,ZO',
    )
    check(
      `${label}: and its first request asks the same scope`,
      statQueries.length > beforeReload && same(params(statQueries[beforeReload]), scoped),
      JSON.stringify(params(statQueries[beforeReload])),
    )

    // Every tab shares the scope.
    await page.locator('[data-period-tab="yesterday"]').click()
    check(
      `${label}: Yesterday keeps the store and the leave-outs`,
      await asked({ ...scoped, From: YESTERDAY, To: YESTERDAY }),
      JSON.stringify(params(statQueries.at(-1))),
    )
    await page.locator('[data-period-tab="range"]').click()
    check(
      `${label}: Range keeps the store and the leave-outs`,
      await asked({ ...scoped, From: daysAgo(7), To: YESTERDAY, Granularity: 'day' }),
      JSON.stringify(params(statQueries.at(-1))),
    )

    // Back to all stores and no types: the params drop off the wire and the URL.
    await select.selectOption('')
    await page.locator('[data-leave-out-types-trigger]').click()
    await page.locator('[data-leave-out-types-clear]').click()
    check(
      `${label}: All stores and Clear drop StoreCode and LeaveOutTypes`,
      await asked({ From: daysAgo(7), To: YESTERDAY, Granularity: 'day', LeaveOutChurned: 'false' }) &&
        !search().has('store') &&
        !search().has('leaveOutTypes'),
      JSON.stringify(params(statQueries.at(-1))),
    )
    check(`${label}: no page errors (scope)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

async function driveTable(dir) {
  const label = dir
  // ── 12 (487): the per-store table ───────────────────────────────────────────────────────────
  const { context, page, errors, statQueries } = await open(dir, {
    // One store asked → the door answers that store alone; all stores → all three.
    answer: (q) => statistics({ stores: q.get('StoreCode') ? rankedStores().filter((r) => r.storeCode === q.get('StoreCode')) : rankedStores() }),
  })
  await page.goto(`${BASE}/oms/delivery-statistics`)
  await waitFigures(page)
  await page.locator('[data-statistics-stores] .ag-row').first().waitFor({ timeout: 20000 })
  const order = async (col = 'storeCode') => (await tableRows(page)).map((r) => r[col])

  const headers = await page
    .locator('[data-statistics-stores] .ag-header-cell')
    .evaluateAll((els) => els.map((e) => [e.getAttribute('col-id'), e.querySelector('.ag-header-cell-text')?.textContent ?? '']))
  const headerOf = (id) => headers.find(([c]) => c === id)?.[1]
  // The pinned store header sits in its own container (after the rest in the DOM under RTL), so
  // the order is read with it first.
  const headerIds = ['storeCode', ...headers.map(([id]) => id).filter((id) => id !== 'storeCode')]
  check(
    `${label}: the table's All columns: store, the flow with Trips beside Out for delivery, Unspecified last of the flow (decision B), the misses, Avg hand-over`,
    headers.length === 15 &&
    same(
      headerIds,
      ['storeCode', 'cameIn', 'madeReady', 'outForDelivery', 'trips', 'handedOver', 'delivered', 'pickedUp', 'unspecified', 'returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled', 'avgHandOverMinutes'],
    ),
    headers.map(([id]) => id).join(','),
  )
  check(
    `${label}: header names come from the locale, with no isolate characters`,
    headers.every(([, text]) => text && !text.includes(FSI) && !text.includes(PDI)) &&
      headerOf('trips') === 'Trips' &&
      headerOf('handedOver') === 'Handed over' &&
      headerOf('delivered') === 'Delivered (home delivery)' &&
      headerOf('pickedUp') === 'Picked up (pick in store)' &&
      headerOf('unspecified') === 'Unspecified' &&
      headerOf('avgHandOverMinutes') === 'Avg hand-over (min)',
    headers.map(([, h]) => h).join(' | '),
  )
  const rows = await tableRows(page)
  check(`${label}: one row per stubbed store`, rows.length === 3, String(rows.length))
  check(
    `${label}: the default ranking is Handed over, descending`,
    same(await order(), ['P019', 'P001', 'P007']) &&
      (await page.locator('[data-statistics-stores] .ag-header-cell[col-id="handedOver"][aria-sort="descending"]').count()) === 1,
    (await order()).join(','),
  )
  const p001 = rows.find((r) => r.storeCode === 'P001')
  check(
    `${label}: a row reads the server's figures, grouped, a real 0 as 0`,
    p001?.cameIn === '1,234' && p001.trips === '150' && p001.rejected === '0' && p001.avgHandOverMinutes === '92.4' &&
      rows.find((r) => r.storeCode === 'P007')?.handedOver === '0',
    JSON.stringify(p001),
  )
  const cells = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-statistics-stores] .ag-row[row-index] .ag-cell')]
    return { count: all.length, isolated: all.every((c) => c.querySelector('bdi')) }
  })
  check(`${label}: every cell is isolated by the grid base`, cells.count === 3 * 15 && cells.isolated, JSON.stringify(cells))
  const pinned = await page
    .locator('[data-statistics-stores] .ag-row[row-index] .ag-cell[col-id="storeCode"]')
    .evaluateAll((els) =>
      els.map((e) =>
        e.classList.contains('ag-cell-last-left-pinned') ? 'left' : e.classList.contains('ag-cell-first-right-pinned') ? 'right' : 'unpinned',
      ),
    )
  check(
    `${label}: the store column is pinned to the reading start`,
    pinned.length === 3 && pinned.every((side) => side === (dir === 'rtl' ? 'right' : 'left')),
    pinned.join(','),
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-stores.png`, fullPage: true })

  // Sorting by Trips reorders the rows, as numbers (150 > 60 > 9, which text order would not give).
  await sortBy(page, 'trips', 'ascending')
  check(`${label}: sorting by Trips ascending reorders the rows numerically`, same(await order(), ['P019', 'P007', 'P001']), (await order()).join(','))
  await sortBy(page, 'trips', 'descending')
  check(`${label}: and descending`, same(await order(), ['P001', 'P007', 'P019']), (await order()).join(','))

  // A null average reads "—" and sorts LAST both ways.
  await sortBy(page, 'avgHandOverMinutes', 'ascending')
  const avgAsc = await order('avgHandOverMinutes')
  check(`${label}: Avg hand-over ascending puts the "—" last`, same(avgAsc, ['41.5', '92.4', '—']), avgAsc.join(','))
  await sortBy(page, 'avgHandOverMinutes', 'descending')
  const avgDesc = await order('avgHandOverMinutes')
  check(`${label}: Avg hand-over descending STILL puts the "—" last`, same(avgDesc, ['92.4', '41.5', '—']), avgDesc.join(','))

  // One store chosen: the table stays, showing that one row.
  await page.locator('[data-statistics-store] option[value="P001"]').waitFor({ state: 'attached', timeout: 10000 })
  await page.locator('[data-statistics-store]').selectOption('P001')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('store') === 'P001')
  await page.waitForFunction(
    () => new Set([...document.querySelectorAll('[data-statistics-stores] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size === 1,
    null,
    { timeout: 10000 },
  )
  check(
    `${label}: with one store chosen the table stays, showing that one row`,
    params(statQueries.at(-1))?.StoreCode === 'P001' && same(await order(), ['P001']),
    (await order()).join(','),
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-stores-one.png`, fullPage: true })
  check(`${label}: no page errors (store table)`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 16 (491): the table's Delivery / Pick-up / All switch ─────────────────────────────────────
/** One store's tracks with its own lane hand-overs and averages, so each view ranks differently. */
const tracksOf = (deliveredN, deliverAvg, pickedUpN, readyAvg) => {
  const t = tracks()
  t.delivery.flow.handedOver = deliveredN
  t.delivery.avgHandOverMinutes = deliverAvg
  t.pickUp.flow.handedOver = pickedUpN
  t.pickUp.avgHandOverMinutes = readyAvg
  return t
}
/** Two stores with tracks that rank apart from their totals, and one from a server older than 2660: no `tracks`, no `unspecified`. */
const trackStores = () => {
  const { tracks: _t, unspecified: _u, ...older } = store('P050', { flow: flow({ handedOver: 50 }) })
  return [
    store('P001', { flow: flow({ handedOver: 700 }), tracks: tracksOf(300, 96.25, 20, 31.5) }),
    store('P019', { flow: flow({ handedOver: 900 }), tracks: tracksOf(120, null, 80, 12), unspecified: 0 }),
    older,
  ]
}

/** The store table's header col-ids, the pinned store column first, and each header's text. */
const tableHeaders = async (page) => {
  const headers = await page
    .locator('[data-statistics-stores] .ag-header-cell')
    .evaluateAll((els) => els.map((e) => [e.getAttribute('col-id'), e.querySelector('.ag-header-cell-text')?.textContent ?? '']))
  return {
    ids: ['storeCode', ...headers.map(([id]) => id).filter((id) => id !== 'storeCode')],
    names: Object.fromEntries(headers),
    clean: headers.every(([, text]) => text && !text.includes(FSI) && !text.includes(PDI)),
  }
}

/** Clicks a view on the switch and waits for its grid, ranked by its hand-over column. */
const switchTo = async (page, track, handOver) => {
  await page.locator(`[data-statistics-track="${track}"]`).click()
  await page.locator(`[data-statistics-stores="${track}"] .ag-header-cell[col-id="${handOver}"][aria-sort="descending"]`).waitFor({ timeout: 10000 })
  await page.locator(`[data-statistics-stores="${track}"] .ag-row`).first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(150)
}

const pressed = (page) =>
  page.locator('[data-statistics-track]').evaluateAll((els) => els.filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.getAttribute('data-statistics-track')))

const DELIVERY_COLUMNS = ['storeCode', 'cameIn', 'madeReady', 'outForDelivery', 'trips', 'delivered', 'returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled', 'avgHandOverMinutes']
const PICK_UP_COLUMNS = ['storeCode', 'cameIn', 'madeReady', 'pickedUp', 'closeRequested', 'closedOrCancelled', 'avgHandOverMinutes']

async function driveTrackSwitch(dir) {
  const label = `${dir} track`
  const { context, page, errors, statQueries } = await open(dir, { answer: () => statistics({ stores: trackStores() }) })
  await page.goto(`${BASE}/oms/delivery-statistics`)
  await waitFigures(page)
  await page.locator('[data-statistics-stores="all"] .ag-row').first().waitFor({ timeout: 20000 })
  const order = async (col = 'storeCode') => (await tableRows(page)).map((r) => r[col])
  const urlTrack = () => page.evaluate(() => new URL(location.href).searchParams.get('track'))

  // All is the default: no `track` in the URL, the 487 columns plus Unspecified.
  const switchLabels = await page.locator('[data-statistics-track]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-statistics-track'), e.textContent.trim()]))
  check(
    `${label}: one switch above the table — All, Delivery, Pick-up — labelled from the locale, All pressed by default`,
    same(switchLabels, [['all', 'All'], ['delivery', 'Delivery'], ['pickUp', 'Pick-up']]) && same(await pressed(page), ['all']) && (await urlTrack()) === null,
    JSON.stringify(switchLabels),
  )
  const switchAbove = await page.evaluate(() => {
    const sw = document.querySelector('[data-statistics-track-switch]')?.getBoundingClientRect()
    const grid = document.querySelector('[data-statistics-stores]')?.getBoundingClientRect()
    return !!sw && !!grid && sw.bottom <= grid.top + 1
  })
  check(`${label}: the switch sits above the table`, switchAbove)
  const all = await tableHeaders(page)
  check(`${label}: All keeps today's columns with Unspecified as the last flow column`, all.ids.length === 15 && all.ids[8] === 'unspecified' && all.ids[7] === 'pickedUp', all.ids.join(','))
  check(`${label}: All ranks by Handed over, descending`, same(await order(), ['P019', 'P001', 'P050']), (await order()).join(','))
  check(
    `${label}: Unspecified reads each store's own figure: a 0 as 0, an absent one "—"`,
    same(await order('unspecified'), ['0', '3', '—']),
    (await order('unspecified')).join(','),
  )
  const asked = statQueries.length

  // Delivery: the lane's figures, per store, as the door sent them.
  await switchTo(page, 'delivery', 'delivered')
  const d = await tableHeaders(page)
  check(`${label}: Delivery is held in the URL as track=delivery`, (await urlTrack()) === 'delivery' && same(await pressed(page), ['delivery']))
  check(`${label}: Delivery's columns: the lane's stages with Trips, Delivered, the five misses, Avg time to deliver`, same(d.ids, DELIVERY_COLUMNS), d.ids.join(','))
  check(
    `${label}: Delivery's headers come from the locale, with no isolate characters`,
    d.clean && d.names.delivered === 'Delivered' && d.names.trips === 'Trips' && d.names.avgHandOverMinutes === 'Avg time to deliver (min)',
    JSON.stringify(d.names),
  )
  check(`${label}: Delivery ranks by Delivered, descending, by default`, same(await order(), ['P001', 'P019', 'P050']), (await order()).join(','))
  const dRows = await tableRows(page)
  const dP001 = dRows.find((r) => r.storeCode === 'P001')
  check(
    `${label}: a Delivery row reads tracks.delivery, not the store's totals`,
    dP001?.cameIn === '702' && dP001.trips === '409' && dP001.delivered === '300' && dP001.returnedBack === '20' && dP001.avgHandOverMinutes === '96.25',
    JSON.stringify(dP001),
  )
  const dOlder = dRows.find((r) => r.storeCode === 'P050')
  check(
    `${label}: a store row without tracks reads "—" in every Delivery cell, never 0`,
    !!dOlder && DELIVERY_COLUMNS.slice(1).every((c) => dOlder[c] === '—'),
    JSON.stringify(dOlder),
  )
  await sortBy(page, 'avgHandOverMinutes', 'ascending')
  check(`${label}: Avg time to deliver ascending puts the "—" last`, same(await order('avgHandOverMinutes'), ['96.25', '—', '—']), (await order('avgHandOverMinutes')).join(','))
  await sortBy(page, 'delivered', 'ascending')
  check(`${label}: Delivered ascending ranks numerically, the "—" last`, same(await order(), ['P019', 'P001', 'P050']), (await order()).join(','))
  await sortBy(page, 'delivered', 'descending')
  check(`${label}: and descending, the "—" STILL last`, same(await order(), ['P001', 'P019', 'P050']), (await order()).join(','))
  await page.screenshot({ path: `${SHOTS}/${dir}-stores-delivery.png`, fullPage: true })

  // Pick-up: no Out for delivery, no Trips, no Returned back / Rejected / Rescheduled.
  await switchTo(page, 'pickUp', 'pickedUp')
  const p = await tableHeaders(page)
  check(`${label}: Pick-up is held in the URL as track=pickUp`, (await urlTrack()) === 'pickUp' && same(await pressed(page), ['pickUp']))
  check(`${label}: Pick-up's columns: Came in, Made ready, Picked up, Close requested, Closed / cancelled, Avg time to ready`, same(p.ids, PICK_UP_COLUMNS), p.ids.join(','))
  check(
    `${label}: Pick-up's headers come from the locale`,
    p.clean && p.names.pickedUp === 'Picked up' && p.names.avgHandOverMinutes === 'Avg time to ready (min)',
    JSON.stringify(p.names),
  )
  check(`${label}: Pick-up ranks by Picked up, descending, by default`, same(await order(), ['P019', 'P001', 'P050']), (await order()).join(','))
  const pRows = await tableRows(page)
  check(
    `${label}: a Pick-up row reads tracks.pickUp`,
    // By column, not as one JSON: under RTL the pinned store cell is read after the rest.
    same(
      PICK_UP_COLUMNS.map((c) => pRows.find((r) => r.storeCode === 'P001')?.[c]),
      ['P001', '529', '444', '20', '3', '6', '31.5'],
    ),
    JSON.stringify(pRows.find((r) => r.storeCode === 'P001')),
  )
  const pOlder = pRows.find((r) => r.storeCode === 'P050')
  check(`${label}: a store row without tracks reads "—" in every Pick-up cell, never 0`, !!pOlder && PICK_UP_COLUMNS.slice(1).every((c) => pOlder[c] === '—'), JSON.stringify(pOlder))
  await sortBy(page, 'avgHandOverMinutes', 'ascending')
  check(`${label}: Avg time to ready ascending ranks numerically, the "—" last`, same(await order('avgHandOverMinutes'), ['12', '31.5', '—']), (await order('avgHandOverMinutes')).join(','))
  await sortBy(page, 'avgHandOverMinutes', 'descending')
  check(`${label}: and descending, the "—" STILL last`, same(await order('avgHandOverMinutes'), ['31.5', '12', '—']), (await order('avgHandOverMinutes')).join(','))
  const cells = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-statistics-stores] .ag-row[row-index] .ag-cell')]
    return { count: all.length, isolated: all.every((c) => c.querySelector('bdi')) }
  })
  check(`${label}: every Pick-up cell is isolated by the grid base`, cells.count === 3 * 7 && cells.isolated, JSON.stringify(cells))
  const pinned = await page
    .locator('[data-statistics-stores] .ag-row[row-index] .ag-cell[col-id="storeCode"]')
    .evaluateAll((els) => els.map((e) => (e.classList.contains('ag-cell-last-left-pinned') ? 'left' : e.classList.contains('ag-cell-first-right-pinned') ? 'right' : 'unpinned')))
  check(`${label}: the store column stays pinned to the reading start`, pinned.length === 3 && pinned.every((side) => side === (dir === 'rtl' ? 'right' : 'left')), pinned.join(','))
  await page.screenshot({ path: `${SHOTS}/${dir}-stores-pickup.png`, fullPage: true })
  check(`${label}: switching the view makes no call to the door`, statQueries.length === asked, `${asked} → ${statQueries.length}`)

  // A reload keeps the view; the other controls share the URL with it.
  await page.goto(`${BASE}/oms/delivery-statistics?store=P001&track=pickUp`)
  await page.locator('[data-statistics-stores="pickUp"] .ag-row').first().waitFor({ timeout: 20000 })
  check(`${label}: a link with track=pickUp opens on Pick-up, beside the store`, same(await pressed(page), ['pickUp']) && params(statQueries.at(-1))?.StoreCode === 'P001')
  // Back to All: the param drops off the URL.
  await switchTo(page, 'all', 'handedOver')
  check(`${label}: All drops track from the URL`, (await urlTrack()) === null && new URL(page.url()).searchParams.get('store') === 'P001', page.url())
  // An unknown track reads as All.
  await page.goto(`${BASE}/oms/delivery-statistics?track=unspecified`)
  await page.locator('[data-statistics-stores="all"] .ag-row').first().waitFor({ timeout: 20000 })
  check(`${label}: an unknown track reads as All`, same(await pressed(page), ['all']) && (await tableHeaders(page)).ids.length === 15)
  check(`${label}: no page errors (track switch)`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13 (486): the chart ───────────────────────────────────────────────────────────────────────
/** Every bucket from the asked From to To, by the asked granularity — as the door sends them, zeros included. */
const seriesFor = (q) => {
  const from = q.get('From')
  const to = q.get('To')
  if (q.get('Granularity') === 'hour')
    return Array.from({ length: 24 }, (_, h) => ({
      bucket: `${from}T${pad(h)}:00:00`,
      cameIn: h === 9 ? 12 : (h * 7) % 23,
      handedOver: h === 9 ? 7 : (h * 5) % 19,
    }))
  const out = []
  const [y, m, d] = from.split('-').map(Number)
  for (let i = 0; i < 62; i++) {
    const b = day(new Date(y, m - 1, d + i))
    out.push({ bucket: `${b}T00:00:00`, cameIn: 40 + i, handedOver: i % 4 === 0 ? 0 : 30 + i })
    if (b === to) break
  }
  return out
}

/** Each column's and each label's centre x, in bucket order, and the axes' text. */
const chartGeometry = (page) =>
  page.evaluate(() => {
    const centre = (el) => {
      const r = el.getBoundingClientRect()
      return r.left + r.width / 2
    }
    return {
      columns: [...document.querySelectorAll('[data-chart-column]')].map((g) => centre(g.querySelector('rect'))),
      labels: [...document.querySelectorAll('[data-chart-label]')].map(centre),
      texts: [...document.querySelectorAll('[data-chart-label]')].map((e) => e.textContent.trim()),
      isolatedLabels: [...document.querySelectorAll('[data-chart-label]')]
        .filter((e) => e.textContent.trim())
        .every((e) => e.querySelector('bdi[dir="ltr"]')),
      axis: [...document.querySelectorAll('[data-chart-axis] bdi[dir="ltr"]')].map((e) => e.textContent),
    }
  })

async function driveChart(dir) {
  const label = dir
  const { context, page, errors } = await open(dir, { answer: (q) => statistics({ series: seriesFor(q) }) })
  await page.goto(`${BASE}/oms/delivery-statistics`)
  await page.locator('[data-statistics-band="chart"] [data-chart-column]').first().waitFor({ timeout: 20000 })

  // Today, by the hour.
  const bands = await page.locator('[data-statistics-band]').evaluateAll((els) => els.map((e) => e.getAttribute('data-statistics-band')))
  check(`${label}: the chart sits between the misses band and the store table`, same(bands, ['storeWide', 'delivery', 'pickUp', 'misses', 'chart', 'stores']), bands.join(','))
  const today = await chartGeometry(page)
  check(
    `${label}: Today draws 24 hourly buckets`,
    today.columns.length === 24 && (await page.locator('[data-chart-granularity="hour"]').count()) === 1,
    String(today.columns.length),
  )
  check(
    `${label}: every third hour is labelled "HH", isolated`,
    same(today.texts.filter(Boolean), ['00', '03', '06', '09', '12', '15', '18', '21']) && today.isolatedLabels,
    today.texts.join('|'),
  )
  check(`${label}: one axis, its top the round step over the larger series (22 → 30)`, same(today.axis, ['30', '20', '10', '0']), today.axis.join(','))
  const forward = (xs) => xs.every((x, i) => i === 0 || (dir === 'rtl' ? x < xs[i - 1] : x > xs[i - 1]))
  check(
    `${label}: time runs in reading order (${dir === 'rtl' ? 'right to left' : 'left to right'})`,
    forward(today.columns),
    today.columns.map(Math.round).join(','),
  )
  check(
    `${label}: each label sits under its own column`,
    today.labels.length === 24 && today.labels.every((x, i) => Math.abs(x - today.columns[i]) < 3),
    today.labels.map((x, i) => Math.round(x - today.columns[i])).join(','),
  )
  const bars = await page
    .locator('[data-chart-column="9"] [data-chart-bar]')
    .evaluateAll((els) => els.map((e) => [e.getAttribute('data-chart-bar'), e.getBoundingClientRect().left]))
  check(
    `${label}: Came in and Handed over side by side, Came in first in reading order`,
    bars.length === 2 && bars[0][0] === 'cameIn' && (dir === 'rtl' ? bars[0][1] > bars[1][1] : bars[0][1] < bars[1][1]),
    JSON.stringify(bars),
  )
  const empty = await page.locator('[data-chart-column="0"] [data-chart-bar]').count()
  check(`${label}: a bucket of zeros draws no column`, empty === 0, String(empty))

  // The readout on hover.
  const readout = page.locator('[data-chart-readout]')
  check(
    `${label}: before any hover the readout says how to read the chart`,
    (await readout.getAttribute('data-chart-readout')) === '' && /Point at a column/.test(await readout.innerText()),
  )
  await page.locator('[data-chart-column="9"] rect').first().hover()
  await page.locator('[data-chart-readout="9"]').waitFor({ timeout: 5000 })
  check(
    `${label}: hovering 09:00 reads its two values, each isolated`,
    (await readout.innerText()) === '09:00 · Came in 12 · Handed over 7' &&
      same(await readout.locator('bdi[dir="ltr"]').allTextContents(), ['09:00', '12', '7']),
    await readout.innerText(),
  )
  await page.locator('[data-chart-column="0"] rect').first().hover()
  await page.locator('[data-chart-readout="0"]').waitFor({ timeout: 5000 })
  check(`${label}: a real 0 reads 0`, (await readout.innerText()) === '00:00 · Came in 0 · Handed over 0', await readout.innerText())
  await page.locator('[data-chart-column="9"] rect').first().hover()
  await page.locator('[data-chart-readout="9"]').waitFor({ timeout: 5000 })
  await page.screenshot({ path: `${SHOTS}/${dir}-chart-today.png`, fullPage: true })
  await page.mouse.move(5, 5)
  await page.locator('[data-chart-readout=""]').waitFor({ timeout: 5000 })
  check(`${label}: leaving the chart clears the readout`, true)

  // The keyboard: focus the plot, step forward with the arrow that points along the reading direction.
  await page.locator('[data-chart-plot]').focus()
  await page.locator('[data-chart-readout="0"]').waitFor({ timeout: 5000 })
  await page.keyboard.press(dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
  await page.locator('[data-chart-readout="1"]').waitFor({ timeout: 5000 })
  await page.keyboard.press('End')
  await page.locator('[data-chart-readout="23"]').waitFor({ timeout: 5000 })
  check(`${label}: the arrow keys step through the buckets in reading order`, (await readout.innerText()).startsWith('23:00 · '), await readout.innerText())

  // A 31-day range, by the day.
  await page.goto(`${BASE}/oms/delivery-statistics?period=range&pick=custom&from=${daysAgo(30)}&to=${TODAY}`)
  await page.locator('[data-chart-granularity="day"] [data-chart-column]').first().waitFor({ timeout: 20000 })
  const range = await chartGeometry(page)
  const dayOf = (n) => String(Number(daysAgo(n).slice(8)))
  check(`${label}: a 31-day range draws 31 daily buckets`, range.columns.length === 31, String(range.columns.length))
  check(
    `${label}: days are labelled by day of the month, every fifth`,
    same(range.texts.filter(Boolean), [30, 25, 20, 15, 10, 5, 0].map(dayOf)) && range.isolatedLabels,
    range.texts.join('|'),
  )
  check(`${label}: the range runs in reading order too`, forward(range.columns), range.columns.map(Math.round).join(','))
  await page.locator('[data-chart-column="30"] rect').first().hover()
  await page.locator('[data-chart-readout="30"]').waitFor({ timeout: 5000 })
  check(
    `${label}: hovering the last day reads its date and values`,
    (await readout.innerText()) === `${TODAY} · Came in 70 · Handed over 60`,
    await readout.innerText(),
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-chart-range31.png`, fullPage: true })
  check(`${label}: no page errors (chart)`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await driveTable('ltr')
await driveTable('rtl')
await driveTrackSwitch('ltr')
await driveTrackSwitch('rtl')
await driveChart('ltr')
await driveChart('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
