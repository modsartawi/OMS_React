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
    const tabReply = readingTabReply(p, url, wire)
    if (tabReply) return route.fulfill(envelope(tabReply))
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

  // 7b. the five reading tabs (ticket 972)
  await readingTabs(page, tag, lang, wire)

  // 8. no error, no raw key
  const all = await page.locator('main').innerText()
  check(`${tag} no raw i18n key on the page`, !/\b(top|promise|cost|marks|differ|tabs|drawer|card|filters)\.[a-zA-Z]+/.test(all))
  check(`${tag} no page error`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ── the five reading tabs (ticket 972) ───────────────────────────────────────────────────────────────
// Their doors (PROVISIONAL, like every results door) serve `stub-tabs.json`, the reply the model tests read.
const TABS = JSON.parse(readFileSync('src/features/oms/sourcing-results/stub-tabs.json', 'utf8'))
const TAB_DOORS = {
  'SourcingAdvisor/Results/Breakdowns': 'breakdowns',
  'SourcingAdvisor/Results/OutsideRules': 'outsideRules',
  'SourcingAdvisor/Results/Checks': 'checks',
  'SourcingAdvisor/Results/LaterSlots': 'laterSlots',
  'SourcingAdvisor/Results/NotRun': 'notRun',
}
function readingTabReply(p, url, wire) {
  const door = TAB_DOORS[p]
  if (!door) return null
  const q = Object.fromEntries(url.searchParams)
  ;(wire.tabs ??= {})[door] = [...(wire.tabs[door] ?? []), q]
  if (door !== 'breakdowns') return TABS[door]
  const { byRows, ...rest } = TABS.breakdowns
  return { by: q.by, rows: byRows[q.by]?.rows ?? [], ...rest }
}

async function readingTabs(page, tag, lang, wire) {
  const drawerFor = async (figure) => {
    await page.locator(`[data-drill="${figure}"]`).first().click()
    await page.locator(`dialog[open][data-results-drawer="${figure}"]`).waitFor({ timeout: 10000 })
    const asked = wire.orders.at(-1)?.figure
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    return asked
  }
  const tab = async (name) => {
    await page.locator(`[data-tab="${name}"]`).click()
    await page.locator(`[data-tab-panel="${name}"] [data-reading-tab="${name}"]`).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
  }
  const ltr = (sel) => isLtrIsolate(page.locator(sel).first())

  // Breakdowns: the default tab
  await page.goto(`${BASE}/oms/sourcing-results`)
  await page.locator('[data-breakdowns-table="MODE"]').waitFor({ timeout: 15000 })
  const firstAsk = wire.tabs.breakdowns.at(-1)
  check(`${tag} Breakdowns opens first and reads its door by mode, with the page's filters`, firstAsk?.by === 'MODE' && firstAsk?.period === '14', JSON.stringify(firstAsk))
  const modeRows = await page.locator('[data-breakdown-row]:not([data-breakdown-group])').evaluateAll((els) => els.map((e) => e.getAttribute('data-breakdown-row')))
  check(
    `${tag} Breakdowns by mode: the order's four modes in the spec's order`,
    JSON.stringify(modeRows) === JSON.stringify(['SLOT_ONLY', 'DAWAA_NOW_ONLY', 'SLOT_AND_DAWAA_NOW', 'BEYOND_BORDER']),
    modeRows.join(','),
  )
  const cols = await page.locator('[data-breakdowns-table] th[data-col]').count()
  check(`${tag} Breakdowns: nine figure columns beside the row name`, cols === 9, String(cols))
  const total = await page.locator('[data-breakdown-total]').innerText()
  check(`${tag} Breakdowns: the total row as sent`, total.includes('39,870') && total.includes('68.8%') && total.includes('77.6%'), total.replace(/\s+/g, ' '))
  check(
    `${tag} Breakdowns: a line the stock figure could not cover (6 rows) and the channel's own split (3 parts)`,
    (await page.locator('[data-breakdown-group="stock-short"]').count()) === 6 && (await page.locator('[data-breakdown-group="channel-split"]').count()) === 3,
  )
  check(`${tag} Breakdowns: a share is an LTR isolate`, await ltr('[data-breakdown-total] td:nth-child(3) bdi'))
  const nameCell = await box(page.locator('[data-breakdowns-table] thead th').first())
  const ordersCell = await box(page.locator('[data-breakdowns-table] th[data-col="orders"]'))
  check(`${tag} Breakdowns: the row name stands at the reading start`, lang === 'ar' ? nameCell.x > ordersCell.x : nameCell.x < ordersCell.x)
  check(`${tag} Breakdowns: who made the run, pairs cut by the cap per city, the own store passed over`,
    (await page.locator('[data-made-by="OMS"]').count()) === 1 &&
      (await page.locator('[data-pairs-cut-city="Dhahran"]').count()) === 1 &&
      (await page.locator('[data-breakdowns-card="store-passed-over"]').innerText()).includes('1,186'))
  check(`${tag} Breakdowns: a mode row's orders open them`, (await drawerFor('breakdown:MODE:SLOT_ONLY')) === 'breakdown:MODE:SLOT_ONLY')
  check(`${tag} Breakdowns: a stock-short row's orders open them`, (await drawerFor('stockShort:BOOK_AT_ZERO:SLOT')) === 'stockShort:BOOK_AT_ZERO:SLOT')
  check(`${tag} Breakdowns: a city's pairs cut open them`, (await drawerFor('pairsCut:Dammam')) === 'pairsCut:Dammam')
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-breakdowns.png`, fullPage: true })

  await page.locator('[data-breakdown-by="CITY"]').click()
  await page.locator('[data-breakdowns-table="CITY"]').waitFor({ timeout: 10000 })
  check(`${tag} Breakdowns by city asks the door by city`, wire.tabs.breakdowns.at(-1)?.by === 'CITY')
  const arabicCity = page.locator('[data-breakdown-row="الدمام والخبر"] bdi').first()
  check(`${tag} Breakdowns by city: a city name is free text in <bdi>`, (await arabicCity.count()) === 1 && (await arabicCity.getAttribute('dir')) !== 'ltr')
  check(`${tag} Breakdowns by city: "Other cities" in words`, (await page.locator('[data-breakdown-row="OTHER"]:not([data-breakdown-group])').innerText()).includes('Other cities'))
  await page.locator('[data-breakdown-by="CHANNEL"]').click()
  await page.locator('[data-breakdowns-table="CHANNEL"]').waitFor({ timeout: 10000 })
  check(`${tag} Breakdowns by channel: the channels named`, (await page.locator('[data-breakdown-row="IOS"]').innerText()).includes('App, iPhone'))
  await page.locator('[data-breakdown-by="DAY"]').click()
  await page.locator('[data-breakdowns-table="DAY"]').waitFor({ timeout: 10000 })
  const days = await page.locator('[data-breakdown-row]:not([data-breakdown-group])').evaluateAll((els) => els.map((e) => e.getAttribute('data-breakdown-row')))
  check(`${tag} Breakdowns by day: 14 days, oldest first`, days.length === 14 && days[0] === '2026-11-12' && days[13] === '2026-11-25', `${days.length} ${days[0]}..${days.at(-1)}`)
  check(`${tag} Breakdowns by day: a date is an LTR isolate`, await ltr('[data-breakdown-row="2026-11-12"] td:first-child bdi'))

  // Outside the advisor's rules
  await tab('outside-rules')
  check(`${tag} Outside the rules: the tab is kept in the URL and reads its door`, page.url().includes('tab=outside-rules') && wire.tabs.outsideRules?.length >= 1)
  const reasons = await page.locator('[data-outside-reason]').evaluateAll((els) => els.map((e) => e.getAttribute('data-outside-reason')))
  check(`${tag} Outside the rules: one row per reason`, JSON.stringify(reasons) === JSON.stringify(['NO_STOCK', 'OUT_OF_REACH', 'PRODUCT_RULE', 'BOOK_NEVER_HELD']), reasons.join(','))
  check(`${tag} Outside the rules: the line saying they are a group of their own`, /group of their own/.test(await page.locator('[data-outside-rules-group]').innerText()))
  check(`${tag} Outside the rules: a share bar per reason`, (await page.locator('[data-outside-reason] [data-chart="share-bar"]').count()) === 4)
  check(`${tag} Outside the rules: the Dawaa Now short-figure reason in words`, (await page.locator('[data-outside-reason="NO_STOCK"]').innerText()).includes('by Dawaa Now'))
  check(`${tag} Outside the rules: a reason with no orders opens nothing`, (await page.locator('[data-drill="outsideRules:BOOK_NEVER_HELD"]').count()) === 0)
  check(`${tag} Outside the rules: a reason's orders open them`, (await drawerFor('outsideRules:OUT_OF_REACH')) === 'outsideRules:OUT_OF_REACH')
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-outside-rules.png`, fullPage: true })

  // Promise and stock checks
  await tab('checks')
  check(`${tag} Checks: the promise check's four rows`, (await page.locator('[data-reading-tab="checks"] [data-promise-row]').count()) === 4)
  const bands = await page.locator('[data-distance-band]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-distance-band')}=${e.getAttribute('data-promise-state')}`))
  check(
    `${tag} Checks: Dawaa Now by distance band, 6 km or more under the band`,
    JSON.stringify(bands) === JSON.stringify(['KM_0_2=inside', 'KM_2_4=inside', 'KM_4_6=inside', 'KM_6_PLUS=under']),
    bands.join(' '),
  )
  check(`${tag} Checks: the express stamp's own share`, (await page.locator('[data-express-stamp]').innerText()).includes('81.9%'))
  check(`${tag} Checks: the stock check's two rows`, (await page.locator('[data-stock-check]').count()) === 2)
  check(`${tag} Checks: a distance band's shipments open them`, (await drawerFor('distanceBand:KM_6_PLUS')) === 'distanceBand:KM_6_PLUS')
  check(`${tag} Checks: covered deliveries ended for no stock open them`, (await drawerFor('stockCheck:COVERED:NO_STOCK')) === 'stockCheck:COVERED:NO_STOCK')
  check(`${tag} Checks: the shelf chance table holds 36 cells`, (await page.locator('[data-shelf-cell]:not([data-shelf-cell="none"])').count()) === 36)
  await page.locator('[data-shelf-mode="SLOT"]').click()
  await page.waitForTimeout(200)
  const cell = await page.locator('[data-shelf-cell="1:L0"]').innerText()
  check(`${tag} Checks: a cell carries the table's chance and its picks`, cell.includes('9.40%') && cell.includes('575 / 5,096') && cell.includes('11.3%'), cell.replace(/\s+/g, ' '))
  check(`${tag} Checks: a cell's figures are LTR isolates`, await ltr('[data-shelf-cell="1:L0"] [data-shelf-picks] bdi'))
  const few = page.locator('[data-shelf-cell="6:L10_PLUS"]')
  check(`${tag} Checks: "too few" where the figure expects under 50 failed lines`, (await few.getAttribute('data-reading')) === 'TOO_FEW' && (await few.innerText()).includes('too few'))
  const readings = await page.locator('[data-shelf-cell][data-reading]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-reading')))].sort())
  check(`${tag} Checks: other cells read inside what chance gives or enough to change`, readings.includes('INSIDE_CHANCE') && readings.includes('ENOUGH_TO_CHANGE'), readings.join(','))
  await page.locator('[data-shelf-second="HALVES"]').click()
  await page.waitForTimeout(200)
  const halves = await page.locator('[data-shelf-cell="1:L0"]').innerText()
  check(`${tag} Checks: "Counts by half-year" shows the three half-years`, halves.includes('13.35%') && halves.includes('9.12%') && halves.includes('8.93%'), halves.replace(/\s+/g, ' '))
  const shortRows = await page.locator('[data-short-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-short-row')}=${e.getAttribute('data-reading')}`))
  check(`${tag} Checks: the eight short-figure rows`, shortRows.length === 8, shortRows.join(' '))
  check(`${tag} Checks: pick-up's book-at-zero row reads not steady`, shortRows.includes('PICK_UP:BOOK_AT_ZERO=NOT_STEADY'))
  check(`${tag} Checks: each row marked from deliveries`, (await page.locator('[data-short-row] [data-row-source]').count()) === 8)
  const slotZero = await page.locator('[data-short-row="SLOT:BOOK_AT_ZERO"]').innerText()
  check(`${tag} Checks: a row's two ratios and the lines behind them`, slotZero.includes('0.88') && slotZero.includes('0.67') && slotZero.includes('840') && slotZero.includes('2,710'), slotZero.replace(/\s+/g, ' '))
  check(`${tag} Checks: the lines per channel group`, (await page.locator('[data-short-row="SLOT:BOOK_AT_ZERO"] [data-row-group]').count()) === 3)
  check(`${tag} Checks: the fixed note on the two ratios`, (await page.locator('[data-ratio-note]').innerText()).includes('about 0.9 there is a row that fits'))
  const fleet = await page.locator('[data-fleet-ratios]').innerText()
  check(`${tag} Checks: each mode's fleet ratio, the window and the number of counts`, fleet.includes('0.84') && fleet.includes('1.12') && fleet.includes('0.97') && fleet.includes('982'), fleet.replace(/\s+/g, ' '))
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-checks.png`, fullPage: true })

  // Later slots
  await tab('later-slots')
  const sentence = await page.locator('[data-later-slots-sentence]').innerText()
  check(`${tag} Later slots: one sentence with the count and its share`, sentence.includes('2,447') && sentence.includes('8.9%') && sentence.includes('27,550'), sentence.replace(/\s+/g, ' '))
  check(`${tag} Later slots: labelled evidence for phase 2`, (await page.locator('[data-phase2-evidence]').innerText()).includes('evidence for phase 2'))
  check(`${tag} Later slots: no riyal in the sentence`, !/SAR|ر\.س|riyal/i.test(sentence))
  await page.locator('[data-later-slots-chart] [data-chart="bar"] svg').first().waitFor({ timeout: 10000 })
  const bars = await page.locator('[data-later-slots-chart] .recharts-bar-rectangle').count()
  check(`${tag} Later slots: a bar per hour`, bars === 24 || bars === 23, String(bars))
  check(`${tag} Later slots: the count opens its orders`, (await drawerFor('laterSlot')) === 'laterSlot')
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-later-slots.png`, fullPage: true })

  // Orders not run
  await tab('not-run')
  const notRun = await page.locator('[data-not-run-reason]').evaluateAll((els) => els.map((e) => e.getAttribute('data-not-run-reason')))
  check(
    `${tag} Orders not run: the reasons, the stock read that failed three times among them`,
    JSON.stringify(notRun) === JSON.stringify(['WORKER_OFF', 'TOO_LATE', 'NO_RUN_AFTER_ATTEMPTS', 'STOCK_READ_FAILED']),
    notRun.join(','),
  )
  check(`${tag} Orders not run: the total as sent and what is not counted`, (await page.locator('[data-not-run-total]').innerText()).includes('1,332') && (await page.locator('[data-not-run-not-counted]').innerText()).includes('pick-up-only'))
  check(`${tag} Orders not run: a reason's orders open them`, (await drawerFor('notRun:STOCK_READ_FAILED')) === 'notRun:STOCK_READ_FAILED')
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-not-run.png`, fullPage: true })

  // every reading tab: built, no raw key, no riyal
  let pending = 0
  let raw = ''
  for (const name of ['breakdowns', 'outside-rules', 'checks', 'later-slots', 'not-run']) {
    await tab(name)
    pending += await page.locator(`[data-tab-panel="${name}"] [data-tab-pending]`).count()
    const text = await page.locator('[data-tab-panel]').innerText()
    const hit = text.match(/\b(reading|stockClasses|breakdowns|outsideRules|checks|laterSlots|notRun)\.[a-zA-Z]+/)
    if (hit) raw += `${name}:${hit[0]} `
    if (/SAR\s*\d|\d\s*SAR|ر\.س/.test(text)) raw += `${name}:riyal `
  }
  check(`${tag} the five reading tabs are built: none says pending`, pending === 0)
  check(`${tag} the five reading tabs: no raw key and no riyal figure`, raw === '', raw)
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
