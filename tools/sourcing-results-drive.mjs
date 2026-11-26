// Comparison results drive (ticket 971, BackOffice spec 4354 §17) — drives the REAL app against a STUBBED wire. The
// results doors (BackOffice 4393) are not built and not specified: the stub serves the page's PROVISIONAL shapes
// (`src/core/models/sourcing-results.ts`) with the summary reply the model tests read
// (`src/features/oms/sourcing-results/stub-summary.json`, the results prototype's 14 days).
//
// Left to right and right to left (`oms.locale = 'ar'` sets dir="rtl"; the app's words stay English, as on every
// screen, so the RTL pass proves the mirroring and the isolation), asserts:
//   1. the page opens under today's advisor view grant, and says no access without it;
//   2. the sentence, the six segments, the two brackets and the line under the bar, figures isolated LTR;
//      under Arabic the first segment stands at the reading start (the right);
//   3. the three panels: the promise check's words, the cost notice and no riyal figure, a mark with no orders greyed;
//   4. "Where the plans differ": the rows per view, no estimate for "outside the rules", the view in the URL;
//   5. a segment opens its orders in the drawer, the figure sent to the door; the list sorts and pages;
//   6. one order opens its card, the advisor's plan beside what happened, and "Open the stored run in the simulator";
//   7. a mark's count opens its orders; a filter re-reads the summary; the seven tabs, a pending one says so;
//   8. no page error and no raw key.
//
//   1. run the app:  npx vite --port 5203 --strictPort
//   2. DRIVE_PORT=5203 node tools/sourcing-results-drive.mjs
//      (PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`
const SHOTS = 'tools/.sourcing-results-shots'
mkdirSync(SHOTS, { recursive: true })

const SUMMARY = JSON.parse(readFileSync('src/features/oms/sourcing-results/stub-summary.json', 'utf8'))

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

// ── the orders behind a figure, and one order (PROVISIONAL shapes) ────────────────────────────────
const CLASSES = ['SAME_PLAN', 'ANOTHER_STORE', 'ANOTHER_MODE', 'FEWER_SHIPMENTS', 'OUTSIDE_RULES']
const CHANNELS = ['IOS', 'ROID', 'WEB', 'CALL_CENTRE']
const CITIES = ['Riyadh', 'Jeddah', 'الدمام', 'Makkah']
const ENDINGS = ['ON_TIME', 'ON_TIME', 'LATE', 'RETURNED', 'CANCELLED', 'CUSTOMER_CANCELLED']
const ORDER_TOTAL = 137
const orderRows = (page, pageSize, figure) => {
  const fixedClass = figure.startsWith('segment:ANOTHER_STORE') ? 'ANOTHER_STORE' : null
  const from = (page - 1) * pageSize
  const rows = []
  for (let i = from; i < Math.min(ORDER_TOTAL, from + pageSize); i++) {
    const cls = fixedClass ?? CLASSES[i % CLASSES.length]
    rows.push({
      orderNumber: String(4500718000 + i),
      landedAt: `2026-11-${String(12 + (i % 14)).padStart(2, '0')} ${String(8 + (i % 14)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
      channel: CHANNELS[i % CHANNELS.length],
      city: CITIES[i % CITIES.length],
      wholePlan: cls,
      storesOnly: cls === 'ANOTHER_MODE' ? 'SAME_PLAN' : cls,
      estimateMinutes: cls === 'OUTSIDE_RULES' || cls === 'SAME_PLAN' ? null : 6 + (i % 9) - 4,
      ending: ENDINGS[i % ENDINGS.length],
      stockShortLine: i % 11 === 0,
    })
  }
  return { total: ORDER_TOTAL, page, pageSize, rows }
}
const orderCard = (orderNumber) => ({
  orderNumber,
  runId: '01JDQ7Y3K2M5N8P0R4S6T9V1WX',
  landedAt: '2026-11-20 14:10:00',
  channel: 'IOS',
  city: 'Riyadh',
  wholePlan: 'ANOTHER_STORE',
  storesOnly: 'ANOTHER_STORE',
  estimateMinutes: 9,
  ending: 'LATE',
  plan: [{ mode: 'DAWAA_NOW', store: 'P901', storeName: 'Al Malqa 1', km: 2.1, lines: 2, when: { en: 'by 15:02', ar: 'بحلول 15:02' } }],
  happened: [
    {
      mode: 'DAWAA_NOW',
      store: 'P910',
      storeName: 'An Nakheel 3',
      km: 3.4,
      lines: 2,
      when: { en: 'delivered 15:21, stamp 15:20: late by 1 min', ar: 'سُلّم 15:21، الختم 15:20: متأخر دقيقة' },
    },
  ],
})

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────
const isLtrIsolate = (locator) => locator.evaluate((el) => !!el.closest('bdi[dir="ltr"]') || !!el.querySelector('bdi[dir="ltr"]'))
const box = async (locator) => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }

async function scenario(browser, lang) {
  const tag = `[${lang}]`
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await context.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'false')
    // Every client-side navigation, so a link to a route this branch does not have yet is still seen.
    window.__navs = []
    const push = history.pushState.bind(history)
    history.pushState = (state, title, url) => {
      window.__navs.push(String(url))
      return push(state, title, url)
    }
  }, lang)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  const wire = { summaries: [], orders: [], cards: [], grant: true }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(wire.grant ? ['SourcingAdvisor:01'] : []))
    if (p === 'SourcingAdvisor/Results/Summary') {
      wire.summaries.push(Object.fromEntries(url.searchParams))
      return route.fulfill(envelope(SUMMARY))
    }
    if (p === 'SourcingAdvisor/Results/Orders') {
      const q = Object.fromEntries(url.searchParams)
      wire.orders.push(q)
      return route.fulfill(envelope(orderRows(Number(q.page), Number(q.pageSize), q.figure ?? '')))
    }
    if (p === 'SourcingAdvisor/Results/Order') {
      wire.cards.push(url.searchParams.get('orderNumber'))
      return route.fulfill(envelope(orderCard(url.searchParams.get('orderNumber'))))
    }
    return route.fulfill(envelope({}))
  })

  // 1. without the grant: the denial
  if (lang === 'en') {
    wire.grant = false
    await page.goto(`${BASE}/oms/sourcing-results`)
    await page.getByRole('alert').first().waitFor({ timeout: 15000 })
    const denied = await page.getByRole('alert').first().innerText()
    check(`${tag} without the advisor view grant the page says no access`, /No access to the comparison results/.test(denied), denied.slice(0, 80))
    wire.grant = true
  }

  await page.goto(`${BASE}/oms/sourcing-results`)
  await page.locator('[data-results-top]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  check(`${tag} the page opens under the advisor view grant and reads the summary once`, wire.summaries.length >= 1, JSON.stringify(wire.summaries[0]))
  check(
    `${tag} the first read asks for 14 days of all three channels`,
    wire.summaries[0]?.period === '14' && wire.summaries[0]?.channelGroup === 'ALL',
    JSON.stringify(wire.summaries[0]),
  )
  const dir = await page.evaluate(() => document.documentElement.dir)
  check(`${tag} the page direction`, dir === (lang === 'ar' ? 'rtl' : 'ltr'), dir)

  // 2. the sentence, the bar, the brackets
  const sentence = await page.locator('[data-results-sentence]').innerText()
  check(
    `${tag} the sentence carries the orders compared and the two shares`,
    sentence.includes('39,870') && sentence.includes('77.6%') && sentence.includes('68.8%'),
    sentence,
  )
  check(`${tag} the sentence's figures are isolated LTR`, (await page.locator('[data-results-sentence] bdi[dir="ltr"]').count()) === 3)
  const segments = await page.locator('[data-segment]').evaluateAll((els) => els.map((e) => e.getAttribute('data-segment')))
  check(
    `${tag} the bar draws the six segments in the spec's order`,
    JSON.stringify(segments) === JSON.stringify(['SAME_PLAN', 'SAME_STORES_OTHER_WAY', 'ANOTHER_STORE', 'CALLOUT_FALLBACK', 'OUTSIDE_RULES', 'NOT_COMPARABLE']),
    segments.join(','),
  )
  const storesBracket = await page.locator('[data-bracket="stores"]').innerText()
  const planBracket = await page.locator('[data-bracket="plan"]').innerText()
  check(`${tag} the stores bracket reads same stores 77.6%`, storesBracket.includes('77.6%'), storesBracket)
  check(`${tag} the plan bracket reads same plan 68.8%`, planBracket.includes('68.8%'), planBracket)
  const first = await box(page.locator('[data-segment="SAME_PLAN"]'))
  const second = await box(page.locator('[data-segment="SAME_STORES_OTHER_WAY"]'))
  const last = await box(page.locator('[data-segment="NOT_COMPARABLE"]'))
  const storesBox = await box(page.locator('[data-bracket="stores"]'))
  const planBox = await box(page.locator('[data-bracket="plan"]'))
  check(
    `${tag} the first segment stands at the reading start`,
    lang === 'ar' ? first.x > last.x : first.x < last.x,
    `first.x=${Math.round(first.x)} last.x=${Math.round(last.x)}`,
  )
  const storesSpan = lang === 'ar' ? [second.x, first.x + first.width] : [first.x, second.x + second.width]
  check(
    `${tag} the stores bracket spans the first two segments, the plan bracket the first`,
    Math.abs(storesBox.width - (storesSpan[1] - storesSpan[0])) < 3 && Math.abs(planBox.width - first.width) < 3,
    `stores=${Math.round(storesBox.width)} vs ${Math.round(storesSpan[1] - storesSpan[0])}, plan=${Math.round(planBox.width)} vs ${Math.round(first.width)}`,
  )
  const hatch = await page.locator('[data-segment="CALLOUT_FALLBACK"]').evaluate((el) => getComputedStyle(el).backgroundImage)
  check(`${tag} the callout fallback is hatched`, hatch.includes('repeating-linear-gradient'), hatch.slice(0, 40))
  const runs = await page.locator('[data-results-runs]').innerText()
  check(`${tag} the line under the bar: landed, run and not ended yet, not run`, runs.includes('43,512') && runs.includes('2,310') && runs.includes('1,332'), runs)
  check(`${tag} the segments add up: no mismatch note`, (await page.locator('[data-results-mismatch]').count()) === 0)
  check(`${tag} a legend count is an LTR isolate`, await isLtrIsolate(page.locator('[data-drill="segment:ANOTHER_STORE"] bdi').first()))

  // 3. the panels
  const states = await page.locator('[data-promise-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-promise-row')}=${e.getAttribute('data-promise-state')}`))
  check(
    `${tag} the promise check: Dawaa Now and slot inside the band, pick-up two rows with a target and no band`,
    JSON.stringify(states) === JSON.stringify(['DAWAA_NOW=inside', 'SLOT=inside', 'PICK_UP:APP_SITE=target', 'PICK_UP:CALL_CENTRE=target']),
    states.join(' '),
  )
  check(`${tag} pick-up rows draw no band`, (await page.locator('[data-promise-row^="PICK_UP"] [data-gauge-band]').count()) === 0)
  const notice = await page.locator('[data-cost-notice]').innerText()
  check(`${tag} the cost notice says no riyal total, 5 of 6 rates assumed`, notice.includes('5') && notice.includes('6') && notice.includes('No riyal total'), notice)
  const pageText = await page.locator('[data-sourcing-results]').innerText()
  check(`${tag} no riyal figure anywhere on the page`, !/SAR\s*\d|\d\s*SAR|ر\.س/.test(pageText))
  check(`${tag} a mark with no orders in the period is greyed`, (await page.locator('[data-mark="NO_ROUTING_EQUIVALENT"][data-mark-none]').count()) === 1)

  // 4. where the plans differ
  const wholeRows = await page.locator('[data-differ-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-differ-row')))
  check(
    `${tag} the whole plan lists the differing classes, then same plan as the reference`,
    JSON.stringify(wholeRows) === JSON.stringify(['ANOTHER_STORE', 'ANOTHER_MODE', 'FEWER_SHIPMENTS', 'MORE_SHIPMENTS', 'OUTSIDE_RULES', 'SAME_PLAN']),
    wholeRows.join(','),
  )
  check(
    `${tag} outside the rules has no estimate, and says why`,
    (await page.locator('[data-differ-row="OUTSIDE_RULES"] [data-differ-estimate="none"]').count()) === 1,
  )
  check(`${tag} the fixed note stands under the table`, (await page.locator('[data-differ-note]').innerText()).length > 80)
  const hatchedEnding = await page.locator('[data-differ-row="ANOTHER_STORE"] [data-ending="CUSTOMER_CANCELLED"]').evaluate((el) => getComputedStyle(el).backgroundImage)
  check(`${tag} the customer's own cancellation is hatched`, hatchedEnding.includes('repeating-linear-gradient'))
  await page.screenshot({ path: `${SHOTS}/${lang}-page.png`, fullPage: true })
  await page.locator('[data-differ-view="STORES_ONLY"]').click()
  await page.waitForTimeout(300)
  const storesRows = await page.locator('[data-differ-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-differ-row')))
  check(
    `${tag} the stores only lists another store, the callout fallback, outside the rules, then same plan`,
    JSON.stringify(storesRows) === JSON.stringify(['ANOTHER_STORE', 'CALLOUT_FALLBACK', 'OUTSIDE_RULES', 'SAME_PLAN']),
    storesRows.join(','),
  )
  check(`${tag} the view is kept in the URL`, page.url().includes('view=STORES_ONLY'), page.url())

  // 5. a segment opens its orders
  await page.locator('[data-segment="ANOTHER_STORE"]').click()
  const drawer = page.locator('dialog[open][data-results-drawer]')
  await drawer.waitFor({ timeout: 10000 })
  await drawer.locator('[data-order-row]').first().waitFor({ timeout: 10000 })
  const firstAsk = wire.orders.at(-1)
  check(
    `${tag} the segment opens its orders, the figure sent to the door`,
    (await drawer.getAttribute('data-results-drawer')) === 'segment:ANOTHER_STORE' && firstAsk?.figure === 'segment:ANOTHER_STORE' && firstAsk?.period === '14',
    JSON.stringify(firstAsk),
  )
  check(`${tag} the drawer lists one page of 25`, (await drawer.locator('[data-order-row]').count()) === 25)
  await drawer.locator('[data-sort="orderNumber"]').click()
  await page.waitForTimeout(400)
  check(`${tag} a column header sorts the list`, wire.orders.at(-1)?.sort === 'orderNumber' && wire.orders.at(-1)?.descending === 'false', JSON.stringify(wire.orders.at(-1)))
  await drawer.locator('nav button').last().click()
  await page.waitForTimeout(400)
  check(`${tag} the pager asks for the next page`, wire.orders.at(-1)?.page === '2', JSON.stringify(wire.orders.at(-1)))
  check(`${tag} an order number is an LTR isolate`, await isLtrIsolate(drawer.locator('[data-order] bdi').first()))

  // 6. one order
  const orderNo = await drawer.locator('[data-order]').first().getAttribute('data-order')
  await drawer.locator('[data-order]').first().click()
  await drawer.locator('[data-order-card]').waitFor({ timeout: 10000 })
  const plan = await drawer.locator('[data-card-side="plan"]').innerText()
  const happened = await drawer.locator('[data-card-side="happened"]').innerText()
  check(`${tag} the card reads the chosen order`, wire.cards.at(-1) === orderNo, `${orderNo}`)
  check(
    `${tag} the advisor's plan beside what happened, in the server's words`,
    plan.includes('P901') && plan.includes('by 15:02') && happened.includes('P910') && happened.includes('delivered 15:21'),
    `${plan.replace(/\n/g, ' ')} | ${happened.replace(/\n/g, ' ')}`,
  )
  const dashed = await drawer.locator('[data-card-side="happened"]').evaluate((el) => getComputedStyle(el).borderStyle)
  check(`${tag} what happened sits in a dashed box`, dashed.includes('dashed'), dashed)
  await page.screenshot({ path: `${SHOTS}/${lang}-drawer.png` })
  await drawer.locator('[data-open-simulator]').click()
  await page.waitForTimeout(500)
  const navs = await page.evaluate(() => window.__navs)
  check(
    `${tag} "Open the stored run in the simulator" opens the run (the simulator's route is ticket 962's)`,
    navs.some((u) => u.includes('/oms/sourcing-simulator?run=01JDQ7Y3K2M5N8P0R4S6T9V1WX')),
    navs.join(' '),
  )

  // 7. a mark's count, a filter, the tabs
  await page.goto(`${BASE}/oms/sourcing-results`)
  await page.locator('[data-results-top]').waitFor({ timeout: 15000 })
  await page.locator('[data-drill="mark:RANGE_NOT_CONFIRMED"]').click()
  await page.locator('dialog[open][data-results-drawer="mark:RANGE_NOT_CONFIRMED"]').waitFor({ timeout: 10000 })
  check(`${tag} a mark's count opens its orders`, wire.orders.at(-1)?.figure === 'mark:RANGE_NOT_CONFIRMED', JSON.stringify(wire.orders.at(-1)))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check(`${tag} Escape closes the drawer`, (await page.locator('dialog[open][data-results-drawer]').count()) === 0)

  const before = wire.summaries.length
  await page.locator('[data-period="30"]').click()
  await page.locator('[data-run-mark="ROAD_NOT_MEASURED"]').click()
  await page.locator('[data-filter="stock-short-line"]').click()
  await page.waitForTimeout(600)
  const ask = wire.summaries.at(-1)
  check(
    `${tag} the filters re-read the summary: 30 days, the run's mark, a line the stock figure could not cover`,
    wire.summaries.length > before && ask?.period === '30' && ask?.marks === 'ROAD_NOT_MEASURED' && ask?.stockShortLine === 'true',
    JSON.stringify(ask),
  )
  await page.locator('[data-filter="set"]').selectOption({ index: 1 })
  await page.waitForTimeout(500)
  check(`${tag} the candidate set by name and version`, wire.summaries.at(-1)?.weightSet === 'Baseline' && wire.summaries.at(-1)?.weightSetVersion === '2', JSON.stringify(wire.summaries.at(-1)))

  const tabs = await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))
  check(
    `${tag} the seven tabs in the spec's order`,
    JSON.stringify(tabs) === JSON.stringify(['breakdowns', 'outside-rules', 'checks', 'later-slots', 'not-run', 'trials', 'phase-2-bar']),
    tabs.join(','),
  )
  await page.locator('[data-tab="trials"]').click()
  await page.waitForTimeout(300)
  check(
    `${tag} a tab not built yet says so, and the tab is kept in the URL`,
    (await page.locator('[data-tab-panel="trials"] [data-tab-pending]').count()) === 1 && page.url().includes('tab=trials'),
    page.url(),
  )

  // 8. no error, no raw key
  const all = await page.locator('main').innerText()
  check(`${tag} no raw i18n key on the page`, !/\b(top|promise|cost|marks|differ|tabs|drawer|card|filters)\.[a-zA-Z]+/.test(all))
  check(`${tag} no page error`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

async function run() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
  try {
    for (const lang of ['en', 'ar']) await scenario(browser, lang)
  } finally {
    await browser.close()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
