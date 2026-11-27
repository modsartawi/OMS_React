// The retired advisor's links (ticket 974, BackOffice 4397, spec 4354 §20) — drives the REAL app against a STUBBED
// wire. The old order link's door is BackOffice 4397's `GET SourcingAdvisor/Results/OrderRun?orderNumber=`; the stub
// answers the replies its own test reads (`Tests/Data.Tests/SourcingAdvisor/OldOrderLinkTests.cs`).
//
// Left to right and right to left (`oms.locale = 'ar'` sets dir="rtl"; the app's words stay English), asserts:
//   1. the menu's "Sourcing advisor" opens the comparison results page, and the old advisor's address redirects there;
//   2. an old order link with a stored run opens it in the simulator (`?run=`), under the run grant;
//   3. under the view grant alone, the link says the run is stored and offers no simulator;
//   4. with no stored run, the link says so and offers a replay, which opens the simulator set to replay the ORDER
//      (not the delivery number the link carried), with nothing run; without the run grant, no replay is offered;
//   5. a number that names no order says so; a blank one never asks the door;
//   6. the order number is isolated left to right; no page error and no raw key on the link's page.
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/sourcing-old-link-drive.mjs
//      (PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
const VIEW = 'SourcingAdvisor:01'
// The run grant as `@/core/sourcing-advisor/access` reads it today (the simulator's reconciler may rename it).
const RUN = /canRunSourcingAdvisor = \(p: Permissions\): boolean => p\.has\('([^']+)'\)/.exec(
  (await import('node:fs')).readFileSync('src/core/sourcing-advisor/access.ts', 'utf8'),
)[1]

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

// The door's replies, shaped as `ResultsOrderRunReply` (camelCase), as OldOrderLinkTests reads them.
const ORDER = '4500718264'
const DELIVERY = '8000000253'
const reply = (over) => ({ asked: ORDER, orderNumber: ORDER, orderKnown: true, runId: null, state: null, ranAt: null, hasSummary: false, offerReplay: false, ...over })
const ORDER_RUNS = {
  [ORDER]: reply({ runId: '94397R01', state: 'COMPARISON', ranAt: '2026-11-24T10:15:00', hasSummary: true }),
  // A delivery with no stored run: its order is named, and a replay is offered.
  [DELIVERY]: reply({ asked: DELIVERY, offerReplay: true }),
  943979999: reply({ asked: '943979999', orderNumber: '', orderKnown: false }),
}

async function pass(browser, lang) {
  const L = lang.toUpperCase()
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await context.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'true')
  }, lang)
  const page = await context.newPage()
  const wire = { grants: [VIEW, RUN], asked: [] }
  const errors = []
  page.on('pageerror', (e) => errors.push(`${new URL(page.url()).pathname}: ${e}`))
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', ...wire.grants]))
    if (p === 'SourcingAdvisor/Results/OrderRun') {
      const n = url.searchParams.get('orderNumber') ?? ''
      wire.asked.push(n)
      if (n.trim() === '')
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'orderNumber is required.', errors: [{ errorCode: 'RESULTS-400', internalErrorCode: '', errorMessage: 'orderNumber is required.' }] }))
      return route.fulfill(envelope(ORDER_RUNS[n] ?? reply({ asked: n, orderNumber: '', orderKnown: false })))
    }
    if (p === 'SourcingAdvisor/Workbench') return route.fulfill(envelope({ maps: null }))
    if (p === 'SourcingAdvisor/WeightSets') return route.fulfill(envelope([]))
    return route.fulfill(envelope(null))
  })
  const path = () => new URL(page.url()).pathname + new URL(page.url()).search
  const settle = () => page.waitForTimeout(700)

  // 1. the menu opens the results page; the old address redirects there
  // Start on another OMS screen, so the OMS group stands open in the rail.
  await page.goto(`${BASE}/oms/sourcing-simulator`)
  const leaf = page.locator('nav a[href="/oms/sourcing-results"]').first()
  await leaf.waitFor({ timeout: 20000 })
  check(`${L} the menu's "Sourcing advisor" points at the results page`, ((await leaf.textContent()) ?? '').includes('Sourcing advisor'))
  check(`${L} no menu entry opens the old advisor`, (await page.locator('nav a[href="/oms/sourcing-advisor"]').count()) === 0)
  await leaf.click()
  await page.waitForURL('**/oms/sourcing-results**', { timeout: 10000 })
  const heading = page.locator('main h1', { hasText: 'Comparison results' })
  await heading.first().waitFor({ timeout: 10000 }).catch(() => {})
  check(`${L} the entry opens the comparison results page`, new URL(page.url()).pathname === '/oms/sourcing-results' && (await heading.count()) === 1)
  await page.goto(`${BASE}/oms/sourcing-advisor?from=2026-10-01&city=Tabuk`)
  await page.waitForURL('**/oms/sourcing-results**', { timeout: 10000 })
  check(`${L} the old advisor's address redirects to the results page, its old filters dropped`, path() === '/oms/sourcing-results', path())

  // 2. a stored run opens in the simulator
  await page.goto(`${BASE}/oms/sourcing-advisor/order/${ORDER}`)
  await page.waitForURL('**/oms/sourcing-simulator**', { timeout: 10000 }).catch(() => {})
  check(`${L} a stored run opens in the simulator by its link`, path() === '/oms/sourcing-simulator?run=94397R01' && wire.asked.at(-1) === ORDER, path())

  // 4. none: a replay is offered, of the order the delivery names
  errors.length = 0
  await page.goto(`${BASE}/oms/sourcing-advisor/order/${DELIVERY}`)
  await page.locator('[data-order-link="none"]').waitFor({ timeout: 10000 })
  const replayLink = page.locator('a[data-order-link-replay]')
  check(`${L} with none, the page says so`, ((await page.locator('[data-order-link="none"]').textContent()) ?? '').includes('has no stored run'))
  check(`${L} the order number is isolated left to right`, (await page.locator('[data-order-link="none"] bdi[dir="ltr"]').first().textContent()) === ORDER)
  check(`${L} a replay of the order (not the delivery) is offered`, (await replayLink.getAttribute('href')) === `/oms/sourcing-simulator?replay=${ORDER}`)
  check(`${L} the way back leads to the delivery`, (await page.locator('a[data-order-link-back]').getAttribute('href')) === `/oms/delivery/${DELIVERY}`)
  const body = (await page.locator('main').textContent()) ?? ''
  check(`${L} no raw key on the link's page`, !/sourcing-order-link:|none\.line|\{\{/.test(body))
  check(`${L} no page error on the link's page`, errors.length === 0, errors.join(' | '))
  await replayLink.click()
  await page.locator('[data-sim-start]').first().waitFor({ timeout: 15000 })
  await settle()
  check(
    `${L} the replay opens the simulator set to replay the order, nothing run`,
    (await page.locator('[data-sim-start]').first().getAttribute('data-sim-start')) === 'replay' &&
      (await page.locator('input[data-sim-field="orderNumber"]').inputValue()) === ORDER,
  )

  // 5. unknown, and blank
  errors.length = 0
  await page.goto(`${BASE}/oms/sourcing-advisor/order/943979999`)
  await page.locator('[data-order-link="unknown"]').waitFor({ timeout: 10000 })
  check(`${L} a number that names no order says so`, ((await page.locator('[data-order-link="unknown"]').textContent()) ?? '').includes('943979999'))
  const before = wire.asked.length
  await page.goto(`${BASE}/oms/sourcing-advisor/order/%20`)
  await page.locator('[data-order-link="no-order"]').waitFor({ timeout: 10000 })
  check(`${L} a blank number never asks the door`, wire.asked.length === before)

  // 3. under the view grant alone
  wire.grants = [VIEW]
  await page.goto(`${BASE}/oms/sourcing-advisor/order/${ORDER}`)
  await page.locator('[data-order-link="stored"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(
    `${L} under the view grant alone, a stored run is named but the simulator not opened`,
    new URL(page.url()).pathname === `/oms/sourcing-advisor/order/${ORDER}` &&
      ((await page.locator('[data-order-link="stored"]').textContent()) ?? '').includes('needs the simulator'),
  )
  await page.goto(`${BASE}/oms/sourcing-advisor/order/${DELIVERY}`)
  await page.locator('[data-order-link="none"]').waitFor({ timeout: 10000 })
  check(`${L} under the view grant alone, no replay is offered`, (await page.locator('a[data-order-link-replay]').count()) === 0)
  check(`${L} no page error on the link's pages`, errors.length === 0, errors.join(' | '))

  // the gate: no view grant, no door
  wire.grants = []
  const asked = wire.asked.length
  await page.goto(`${BASE}/oms/sourcing-advisor/order/${ORDER}`)
  await page.locator('[role="alert"]').first().waitFor({ timeout: 10000 })
  check(`${L} without the view grant, the denial and no door asked`, wire.asked.length === asked)
  check(`${L} the page reads in its direction`, (await page.getAttribute('html', 'dir')) === (lang === 'ar' ? 'rtl' : 'ltr'))
  await context.close()
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
try {
  for (const lang of ['en', 'ar']) await pass(browser, lang)
} catch (e) {
  console.error(e)
  results.push({ name: 'the drive ran to its end', pass: false })
}
await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
