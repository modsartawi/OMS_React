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
    check(`${label}: the flow band in order`, same(order, ['cameIn', 'madeReady', 'outForDelivery', 'delivered', 'pickedUp', 'handedOver']), order.join(','))
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

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
