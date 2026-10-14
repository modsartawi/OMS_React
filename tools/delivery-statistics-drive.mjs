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
const store = (storeCode, over = {}) => ({ storeCode, flow: flow(), misses: misses(), avgHandOverMinutes: 92.4, ...over })
const statistics = (over = {}) => ({
  asOf: `${TODAY}T09:35:00`,
  flow: flow(),
  misses: misses(),
  avgHandOverMinutes: 87.46,
  series: [
    { bucket: `${TODAY}T08:00:00`, cameIn: 0, handedOver: 0 },
    { bucket: `${TODAY}T09:00:00`, cameIn: 12, handedOver: 7 },
  ],
  stores: [store('P001'), store('P019')],
  ...over,
})
/** An older SIS.Api: no `trips` at all, and nothing handed over yet (a null average). */
const olderServer = () => {
  const { trips: _dropped, ...noTrips } = flow({ handedOver: 0, delivered: 0, pickedUp: 0 })
  return statistics({ flow: noTrips, avgHandOverMinutes: null, stores: [{ ...store('P001'), flow: noTrips, avgHandOverMinutes: null }] })
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
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: grant, canOpenDetail: true }))
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

const waitFigures = (page) => page.locator('[data-statistics-band="flow"]').waitFor({ timeout: 20000 })

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
    const order = await page.locator('[data-statistics-band="flow"] [data-figure-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-figure-tile')))
    check(`${label}: the flow band in order, ending at Handed over, then its two halves`, same(order, ['cameIn', 'madeReady', 'outForDelivery', 'handedOver', 'delivered', 'pickedUp']), order.join(','))
    const split = await page.locator('[data-statistics-split] [data-figure-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-figure-tile')))
    const splitText = await page.locator('[data-statistics-split]').innerText()
    check(
      `${label}: Delivered (home delivery) and Picked up (pick in store) sit apart, as Handed over's halves`,
      same(split, ['delivered', 'pickedUp']) && /Handed over, by delivery type/.test(splitText) && /Home delivery/.test(splitText) && /Pick in store/.test(splitText),
      split.join(','),
    )
    check(`${label}: Handed over says what it holds`, /Delivered \+ picked up/.test(await page.locator('[data-figure-tile="handedOver"]').innerText()))
    const missOrder = await page.locator('[data-statistics-band="misses"] [data-figure-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-figure-tile')))
    check(
      `${label}: the misses band in order, then Avg hand-over`,
      same(missOrder, ['returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled', 'avgHandOver']),
      missOrder.join(','),
    )
    check(`${label}: Came in reads the server's count, grouped`, f.cameIn?.bdi === '1,234', JSON.stringify(f.cameIn))
    check(
      `${label}: Trips is Out for delivery's sub-caption`,
      (await page.locator('[data-figure-tile="outForDelivery"] [data-figure="trips"]').count()) === 1 && f.trips?.text === 'Trips 412' && f.trips.bdi === '412',
      JSON.stringify(f.trips),
    )
    check(`${label}: Handed over is the SERVER's figure, not Delivered + Picked up`, f.handedOver?.bdi === '1,093', JSON.stringify(f.handedOver))
    check(`${label}: a real 0 reads 0`, f.rejected?.bdi === '0', JSON.stringify(f.rejected))
    check(`${label}: Avg hand-over reads the minutes with its unit`, f.avgHandOver?.bdi === '87.46' && f.avgHandOver.text === '87.46min', JSON.stringify(f.avgHandOver))
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
    check(`${label}: a dropped trips reads "—", never 0`, f.trips?.bdi === '—' && f.trips.text === 'Trips —', JSON.stringify(f.trips))
    check(`${label}: a null average reads "—" with no unit, never 0`, f.avgHandOver?.bdi === '—' && f.avgHandOver.text === '—', JSON.stringify(f.avgHandOver))
    check(`${label}: a sent 0 still reads 0 beside them`, f.handedOver?.bdi === '0', JSON.stringify(f.handedOver))
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
    `${label}: the table's columns: store, the flow with Trips beside Out for delivery, the misses, Avg hand-over`,
    headers.length === 14 &&
    same(
      headerIds,
      ['storeCode', 'cameIn', 'madeReady', 'outForDelivery', 'trips', 'handedOver', 'delivered', 'pickedUp', 'returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled', 'avgHandOverMinutes'],
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
  check(`${label}: every cell is isolated by the grid base`, cells.count === 3 * 14 && cells.isolated, JSON.stringify(cells))
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
  check(`${label}: the chart sits between the misses band and the store table`, same(bands, ['flow', 'misses', 'chart', 'stores']), bands.join(','))
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
await driveChart('ltr')
await driveChart('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
