// Ticket 934 drive — the price command center opens on the price alerts, with accept and dismiss (BackOffice spec 4127,
// decision 8). Drives the REAL app in Chromium against STUBBED `PriceWatch/*` envelopes.
//
// Stubs follow the SHIPPED contract read from BackOffice `pricing2` on 2026-11-21 (`PriceWatchWebEndpoints.cs`,
// `Alerts/PriceWatchAlertService.cs`, `Alerts/PriceWatchAlertDecisionService.cs`, `PriceWatchErrorCodes.cs`): camelCase
// `PriceWatchAlertView`, `Alerts/Mine` and `Alerts` with `status`/`competitor`/`category`, Accept with no body, Dismiss
// `{ reason, note }`, refusals HTTP 400 with `PWT-` codes. Nothing GUESSED. Still owed: the dev walk on PriceWatch_Dev.
//
//   1. a manager (PriceWatch:03 + :06): the page opens on the Alerts tab; Mine is read by default (`Alerts/Mine`,
//      status=live); the rows are ranked by value at risk whatever order they arrive in; only built tabs show.
//   2. a NOT_SET floor reads "Awaiting cost" with the lowest competitor price as a fact; no profitability verdict.
//   3. Dismiss: disabled without a reason; OTHER without a note stays disabled and says why; with a note it sends
//      `{ reason: 'OTHER', note }` trimmed. WRONG_MATCH warns that the product match is broken too.
//   4. Accept refused with PWT-00040 (the alert moved): the refusal shows with its code and the list is read again.
//   5. All reads `Alerts`; the competitor filter sends `competitor`.
//   6. a viewer (PriceWatch:03 only): the price alerts show, no Accept / Dismiss.
//   7. no View grant (PriceWatch:06 only): the denial, no tab strip, no PriceWatch read.
//   8. RTL (oms.locale = ar): renders, no raw keys. No page errors anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/price-command-center-drive.mjs
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

const alert = (over) => ({
  alertId: 'A-1', materialNumber: '100012345', competitorCode: 'NAHDI', matchId: 'M-1', listingId: 'L-1',
  status: 'OPEN', isLive: true, categoryCode: 'A004', thresholdPercent: 5, currency: 'SAR',
  ourBasicPrice: 25, ourEffectivePrice: 22.5, ourPriceDay: '2026-11-21',
  theirRegularPrice: 21, theirOfferPrice: 19.95, theirPrice: 19.95, sellerName: 'Nahdi Online',
  observedAt: '2026-11-21T08:15:00', previousObservedAt: null, gapAmount: 2.55, gapPercent: 11.33,
  thirtyDayUnits: 400, unitsSource: 'SALES', valueAtRisk: 1020, recommendedPrice: 19.95, recommendedFrom: 'NAHDI',
  floorStatus: 'NOT_SET', floorText: 'floor not set', openedAt: '2026-11-21T08:20:00', updatedAt: '2026-11-21T08:20:00',
  resolvedAt: null, resolvedReason: '', dismissedAtGapPercent: 0, categoryManager: 'CM01', ownerUserId: 'msartawi',
  ...over,
})
// Deliberately NOT in value-at-risk order: the client ranks them.
const MINE = [
  alert({ alertId: 'A-small', materialNumber: '100000001', valueAtRisk: 80, gapPercent: 6.1 }),
  alert({ alertId: 'A-big', materialNumber: '100000002', valueAtRisk: 5400, gapPercent: 14.2, competitorCode: 'AMAZON_SA', recommendedFrom: 'AMAZON_SA', theirOfferPrice: null, theirPrice: 21 }),
  alert({ alertId: 'A-mid', materialNumber: '100000003', valueAtRisk: 1020 }),
  alert({ alertId: 'A-taken', materialNumber: '100000004', valueAtRisk: 300, status: 'ACCEPTED' }),
]
const ALL = [...MINE, alert({ alertId: 'A-other', materialNumber: '100000009', valueAtRisk: 700, categoryManager: '', ownerUserId: '' })]
const COVERAGE = [
  { competitorCode: 'AMAZON_SA', competitorName: 'Amazon SA', watched: 500, exact: 120, comparable: 30, notCarried: 10, open: 340 },
  { competitorCode: 'NAHDI', competitorName: 'Nahdi', watched: 500, exact: 300, comparable: 20, notCarried: 5, open: 175 },
]

const browser = await chromium.launch()

async function open(keys, { dir = 'ltr' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.split('/api/')[1]
    calls.push({ path, params: Object.fromEntries(url.searchParams), body: req.postData() })
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
    if (path === 'PriceWatch/Matching/Coverage') return route.fulfill(envelope(COVERAGE))
    if (path === 'PriceWatch/Alerts/Mine') return route.fulfill(envelope(MINE))
    if (path === 'PriceWatch/Alerts') {
      const c = url.searchParams.get('competitor')
      return route.fulfill(envelope(c ? ALL.filter((a) => a.competitorCode === c) : ALL))
    }
    if (path === 'PriceWatch/Alerts/A-big/Accept')
      return route.fulfill(refusal('PWT-00040', "Price alert 'A-big' changed since it was read; reload and decide again."))
    if (/^PriceWatch\/Alerts\/[^/]+\/Dismiss$/.test(path)) {
      const body = JSON.parse(req.postData() || '{}')
      return route.fulfill(envelope({ ...MINE[0], status: 'DISMISSED', ...body }))
    }
    return route.fulfill(envelope({}))
  })
  return { page, context, errors, calls }
}

const rawKey = (text) => text.match(/\b(?:price-command-center:)?(?:alerts|dismiss|tabs|access|menu)\.[a-zA-Z.-]+\b/)

try {
  // ── 1–5: a manager ──
  {
    const { page, context, errors, calls } = await open(['PriceWatch:03', 'PriceWatch:06'])
    await page.goto(ROOT)
    await page.waitForSelector('[data-alert-row]')
    const body = strip(await page.locator('body').innerText())
    check('1. the page opens titled "Price command center"', body.includes('Price command center'))
    check('1. the Alerts tab is open', (await page.locator('[data-tab-panel]').getAttribute('data-tab-panel')) === 'alerts')
    const tabs = await page.locator('[role="tablist"] [data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))
    check('1. only built tabs show', JSON.stringify(tabs) === JSON.stringify(['alerts']), JSON.stringify(tabs))
    const mine = calls.find((c) => c.path === 'PriceWatch/Alerts/Mine')
    check('1. Mine is read by default, live', !!mine && mine.params.status === 'live' && !calls.some((c) => c.path === 'PriceWatch/Alerts'), JSON.stringify(mine?.params))
    check('1. the Mine chip is pressed', (await page.locator('[data-alert-scope="mine"]').getAttribute('aria-pressed')) === 'true')
    const order = await page.locator('[data-alert-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-alert-row')))
    check('1. ranked by value at risk', JSON.stringify(order) === JSON.stringify(['A-big', 'A-mid', 'A-taken', 'A-small']), JSON.stringify(order))

    // 2. awaiting cost
    const rec = strip(await page.locator('[data-alert-row="A-mid"] [data-alert-recommended]').innerText())
    check('2. a NOT_SET floor reads "Awaiting cost"', rec.includes('Awaiting cost'), rec)
    check('2. …with the lowest competitor price as a fact', rec.includes('19.95') && rec.includes('NAHDI'), rec)
    check('2. no profitability verdict, no server floor text', !/profitab|can.t match|floor not set/i.test(body))
    check('6a. Accept / Dismiss only on the open price alerts',
      (await page.locator('[data-alert-accept]').count()) === 3 && (await page.locator('[data-alert-accept="A-taken"]').count()) === 0)

    // 3. dismiss
    await page.click('[data-alert-dismiss="A-mid"]')
    const dlg = page.locator('dialog')
    const confirm = dlg.locator('[data-dismiss-confirm]')
    check('3. Dismiss is disabled without a reason', await confirm.isDisabled())
    check('3. …and says why', strip(await dlg.innerText()).includes('Pick a reason.'))
    await dlg.locator('[data-dismiss-reason]').selectOption('WRONG_MATCH')
    check('3. WRONG_MATCH warns the product match is broken too', strip(await dlg.innerText()).includes('Also breaks the product match'))
    await dlg.locator('[data-dismiss-reason]').selectOption('OTHER')
    check('3. OTHER without a note stays disabled', await confirm.isDisabled())
    check('3. …and says it needs a note', strip(await dlg.innerText()).includes('Other needs a note.'))
    await dlg.locator('[data-dismiss-note]').fill('   ')
    check('3. a blank note is no note', await confirm.isDisabled())
    await dlg.locator('[data-dismiss-note]').fill('  Supplier promo ends Friday  ')
    check('3. with a note Dismiss is enabled', await confirm.isEnabled())
    await confirm.click()
    await page.waitForSelector('text=Price alert dismissed.')
    const sent = calls.find((c) => c.path === 'PriceWatch/Alerts/A-mid/Dismiss')
    check('3. sends { reason: OTHER, note } trimmed', sent && sent.body === JSON.stringify({ reason: 'OTHER', note: 'Supplier promo ends Friday' }), sent?.body)
    check('3. the dialog closes', (await page.locator('dialog').count()) === 0)

    // 4. accept refused, the alert moved
    const reads = calls.filter((c) => c.path === 'PriceWatch/Alerts/Mine').length
    await page.click('[data-alert-accept="A-big"]')
    await page.waitForSelector('[data-alert-refusal="PWT-00040"]')
    const after = strip(await page.locator('body').innerText())
    check('4. the refusal shows with its code', after.includes('PWT-00040') && after.includes('The decision was refused.'))
    check('4. …saying the list was reloaded', after.includes('changed since it was read'))
    await page.waitForTimeout(300)
    check('4. the price alerts are read again', calls.filter((c) => c.path === 'PriceWatch/Alerts/Mine').length > reads)
    const accepted = calls.find((c) => c.path === 'PriceWatch/Alerts/A-big/Accept')
    check('4. Accept is a POST to the alert', !!accepted)

    // 5. All + competitor
    await page.click('[data-alert-scope="all"]')
    await page.waitForSelector('[data-alert-row="A-other"]')
    check('5. All reads Alerts', calls.some((c) => c.path === 'PriceWatch/Alerts' && c.params.status === 'live'))
    await page.locator('[data-alert-competitor]').selectOption('AMAZON_SA')
    await page.waitForFunction(() => document.querySelectorAll('[data-alert-row]').length === 1)
    check('5. the competitor filter sends competitor', calls.some((c) => c.path === 'PriceWatch/Alerts' && c.params.competitor === 'AMAZON_SA'))
    const all = strip(await page.locator('body').innerText())
    check('1–5. no raw i18n keys', !rawKey(all), String(rawKey(all)))
    check('1–5. no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/manager.png', fullPage: true }).catch(() => {})
    await context.close()
  }

  // ── 6: a viewer ──
  {
    const { page, context, errors } = await open(['PriceWatch:03'])
    await page.goto(ROOT)
    await page.waitForSelector('[data-alert-row]')
    check('6. a viewer sees the price alerts', (await page.locator('[data-alert-row]').count()) === 4)
    check('6. …with no Accept or Dismiss', (await page.locator('[data-alert-accept], [data-alert-dismiss]').count()) === 0)
    check('6. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: no View grant ──
  {
    const { page, context, calls } = await open(['PriceWatch:06', 'Analytics:03'])
    await page.goto(ROOT)
    await page.waitForSelector('text=No access to the price command center')
    check('7. Manage alone shows the denial', true)
    check('7. …with no tab strip', (await page.locator('[role="tablist"]').count()) === 0)
    check('7. …and no PriceWatch read', !calls.some((c) => c.path.startsWith('PriceWatch/')))
    check('7. the menu offers no price command center', (await page.locator('a[href="/analytics/price-command-center"]').count()) === 0)
    await context.close()
  }

  // ── 8: RTL ──
  {
    const { page, context, errors } = await open(['PriceWatch:03', 'PriceWatch:06'], { dir: 'rtl' })
    await page.goto(ROOT)
    await page.waitForSelector('[data-alert-row]')
    const text = strip(await page.locator('body').innerText())
    check('8. RTL renders the price alerts', (await page.locator('[data-alert-row]').count()) === 4)
    check('8. RTL: no raw i18n keys', !rawKey(text), String(rawKey(text)))
    check('8. RTL: no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/rtl.png', fullPage: true }).catch(() => {})
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
