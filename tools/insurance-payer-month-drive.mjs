// Payer months drive (oms 896; BackOffice spec 1623, tickets 1628, 1639, 1644, 1648) — drives the REAL app in
// Chromium against MOCKED `InsurancePayerMonthWeb/*` envelopes.
//
// ⚠ No live SIS.Api: the stubs are the shapes BackOffice built (`PayerMonthRowResponse`,
// `PayerMonthCloseAllResponse`, `PayerMonthAuditResponse`, `CorrectionRegisterEntry`, `{ canManage }`, the
// `INS-1626x` refusals), and the stub's month read follows `GetMonth`: ledger rows + corrected payers, and
// `?activity=true` adds the payers with sales. The staging walk is the ticket's last Proof box.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/insurance-payer-month-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAGE_URL = BASE + '/insurance-rules/payer-months?year=2026&month=10'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '')

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const NEVER = '0001-01-01T00:00:00'
const blank = (customerId) => ({
  customerId, year: 2026, month: 10, isClosed: false, hasRow: false,
  lastAction: '', lastActionBy: '', lastActionAt: NEVER, lastActionReason: '', correctionCount: 0,
})

const CORRECTION = {
  linkGroupId: 'LG-1', storeCode: '1001', tillStoreCode: '1002', originalTrxNumber: '445566',
  originalTransactionId: 'T-1', returnTransactionId: 'R-1', saleTransactionId: 'S-1', customerId: 'MEDGULF',
  businessDay: '2026-10-14T00:00:00', periodYear: 2026, periodMonth: 10, direction: 'Refund', netAmount: 12.5,
  patientAmountOld: 40, patientAmountNew: 27.5, reasonCode: 'WRONG_COPAY', reasonNameEn: 'Wrong co-pay',
  reasonNameAr: 'نسبة تحمل خاطئة', reasonNote: 'patient brought the card late', pincodeUsed: true,
  actor: 'mgr1001', createdAt: '2026-10-15T11:20:00',
  lines: [
    { lineNumber: 1, materialNumber: '100200', description: 'Panadol 500', patientAmountOld: 20, patientAmountNew: 10, coverageGroup: 'G1', isRejected: false, movedButUntouched: false },
    { lineNumber: 2, materialNumber: '100300', description: 'Augmentin', patientAmountOld: 20, patientAmountNew: 17.5, coverageGroup: '', isRejected: true, movedButUntouched: true },
  ],
}

let scenario
let calls
const reset = (over = {}) => {
  scenario = {
    access: { canManage: true },
    // The ledger: BUPA is closed. MEDGULF has a correction but no ledger row. AXA and TAWUNIYA had sales only.
    ledger: {
      BUPA: { ...blank('BUPA'), isClosed: true, hasRow: true, lastAction: 'Close', lastActionBy: 'nalharbi', lastActionAt: '2026-11-02T10:15:00', lastActionReason: 'statement sent' },
    },
    corrections: { MEDGULF: 2 },
    sales: ['AXA', 'BUPA', 'MEDGULF', 'TAWUNIYA'],
    audit: {
      BUPA: [{ actor: 'nalharbi', action: 'Close', customerId: 'BUPA', year: 2026, month: 10, reason: 'statement sent', beforeValue: 'Open', afterValue: 'Closed', createdAt: '2026-11-02T10:15:00' }],
    },
    refusal: null,
    ...over,
  }
  calls = { month: [], close: [], reopen: [], closeAll: [], audit: [], corrections: [] }
}

const row = (payer) => ({ ...(scenario.ledger[payer] ?? blank(payer)), correctionCount: scenario.corrections[payer] ?? 0 })
const monthRows = (activity) => {
  const set = new Set([...Object.keys(scenario.ledger), ...Object.keys(scenario.corrections), ...(activity ? scenario.sales : [])])
  return [...set].sort().map(row)
}
let clock = 0
const act = (payer, action, reason) => {
  const at = `2026-11-13T12:${String(10 + clock++).padStart(2, '0')}:00`
  scenario.ledger[payer] = { ...blank(payer), isClosed: action === 'Close', hasRow: true, lastAction: action, lastActionBy: 'msartawi', lastActionAt: at, lastActionReason: reason }
  ;(scenario.audit[payer] ??= []).push({ actor: 'msartawi', action, customerId: payer, year: 2026, month: 10, reason, beforeValue: '', afterValue: '', createdAt: at })
  return row(payer)
}

async function run() {
  const browser = await chromium.launch()
  const errors = []

  const open = async (dir = 'ltr') => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
    page.setDefaultNavigationTimeout(90000)
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
    await page.addInitScript((d) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
    }, dir)
    await page.route('**/api/**', async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      const path = decodeURIComponent(url.pathname.split('/api/')[1])
      const method = req.method()
      if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
      if (path === 'InsurancePayerMonthWeb/Access') return route.fulfill(envelope(scenario.access))
      let m = path.match(/^InsurancePayerMonthWeb\/Months\/(\d+)\/(\d+)$/)
      if (m && method === 'GET') {
        const activity = url.searchParams.get('activity') === 'true'
        calls.month.push({ year: m[1], month: m[2], query: url.search, csrf: req.headers()['x-web-client'] ?? null })
        return route.fulfill(envelope(monthRows(activity)))
      }
      m = path.match(/^InsurancePayerMonthWeb\/(Audit|Corrections)\/([^/]+)\/(\d+)\/(\d+)$/)
      if (m && method === 'GET') {
        const payer = m[2]
        if (m[1] === 'Audit') {
          calls.audit.push(payer)
          return route.fulfill(envelope(scenario.audit[payer] ?? []))
        }
        calls.corrections.push(payer)
        return route.fulfill(envelope(payer === 'MEDGULF' ? [CORRECTION, { ...CORRECTION, linkGroupId: 'LG-2', direction: 'Collect', pincodeUsed: false, reasonNote: '', lines: [] }] : []))
      }
      m = path.match(/^InsurancePayerMonthWeb\/(Close|Reopen|CloseAll)$/)
      if (m && method === 'POST') {
        const body = JSON.parse(req.postData() || '{}')
        const bucket = m[1] === 'Close' ? 'close' : m[1] === 'Reopen' ? 'reopen' : 'closeAll'
        calls[bucket].push({ body, csrf: req.headers()['x-web-client'] ?? null })
        if (scenario.refusal) {
          const code = scenario.refusal
          return route.fulfill(envelope(null, { status: 400, success: false, message: 'server sentence', errors: [{ errorCode: code, errorMessage: 'server sentence' }] }))
        }
        if (bucket === 'closeAll') {
          const payers = monthRows(true).map((r) => act(r.customerId, 'Close', body.reason))
          return route.fulfill(envelope({ year: 2026, month: 10, closedCount: payers.length, payers }))
        }
        return route.fulfill(envelope(act(body.customerId, bucket === 'close' ? 'Close' : 'Reopen', body.reason)))
      }
      return route.fulfill(envelope({}))
    })
    return page
  }

  const table = (page) => page.textContent('[data-testid=payer-month-table]').then(strip)
  const rowSel = (payer) => `[data-testid=payer-month-row][data-payer="${payer}"]`

  // 1 — the page opens on the ledger read, without activity.
  reset()
  let page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=payer-month-table]')
  check('the opening read is Months/2026/10 with no activity', calls.month.length === 1 && calls.month[0].query === '', JSON.stringify(calls.month))
  check('…sent with the X-Web-Client CSRF header', !!calls.month[0].csrf, String(calls.month[0].csrf))
  let text = await table(page)
  check('it lists the ledger payer and the corrected payer, not the sales-only ones', text.includes('BUPA') && text.includes('MEDGULF') && !text.includes('AXA') && !text.includes('TAWUNIYA'))
  check('BUPA reads Closed, with who, when and why', text.includes('Closed') && text.includes('nalharbi') && text.includes('2026-11-02 10:15') && text.includes('statement sent'))
  check('Close all is not offered before the activity list is read', (await page.locator('[data-testid=payer-month-close-all]').count()) === 0)

  // 2 — Reopen on a closed row only; Close with its correction count elsewhere.
  check('Reopen shows on the closed row only', (await page.locator(`${rowSel('BUPA')} [data-testid=payer-month-reopen]`).count()) === 1 && (await page.locator(`${rowSel('MEDGULF')} [data-testid=payer-month-reopen]`).count()) === 0)
  check('the closed row offers no Close', (await page.locator(`${rowSel('BUPA')} [data-testid=payer-month-close]`).count()) === 0)
  check('the corrections count shows on the close action', strip(await page.textContent(`${rowSel('MEDGULF')} [data-testid=payer-month-close-count]`)) === '2')
  check('…and its title says to review them', strip(await page.getAttribute(`${rowSel('MEDGULF')} [data-testid=payer-month-close]`, 'title')).includes('2 corrections to review'))

  // 3 — no timer.
  await page.waitForTimeout(2500)
  check('no read on a timer', calls.month.length === 1)

  // 4 — Show payers with activity.
  await page.click('[data-testid=payer-month-show-activity]')
  await page.waitForSelector('[data-testid=payer-month-close-all]')
  check('"Show payers with activity" sends activity=true', calls.month.at(-1).query === '?activity=true', calls.month.at(-1).query)
  text = await table(page)
  check('…and lists every payer with sales', ['AXA', 'BUPA', 'MEDGULF', 'TAWUNIYA'].every((p) => text.includes(p)))
  check('Close all states its count from that list', strip(await page.textContent('[data-testid=payer-month-close-all]')).includes('4 payers'))

  // 5 — Close without a reason is not sent.
  await page.click(`${rowSel('AXA')} [data-testid=payer-month-close]`)
  await page.waitForSelector('[data-testid=payer-month-reason]')
  check('the dialog names the payer and the month', strip(await page.textContent('[data-testid=payer-month-dialog]')).includes('AXA for 2026-10'))
  check('confirm is aria-disabled while the reason is blank', (await page.getAttribute('[data-testid=payer-month-confirm]', 'aria-disabled')) === 'true')
  await page.click('[data-testid=payer-month-confirm]', { force: true })
  await page.waitForTimeout(300)
  check('a blank confirm posts nothing', calls.close.length === 0)
  await page.fill('[data-testid=payer-month-reason]', '   ')
  await page.click('[data-testid=payer-month-confirm]', { force: true })
  await page.waitForTimeout(300)
  check('a whitespace reason posts nothing', calls.close.length === 0)
  await page.fill('[data-testid=payer-month-reason]', 'x'.repeat(513))
  check('the field counts against 512', strip(await page.textContent('[data-testid=payer-month-reason-count]')) === '513 / 512')
  check('513 characters cannot confirm', (await page.getAttribute('[data-testid=payer-month-confirm]', 'aria-disabled')) === 'true')
  await page.fill('[data-testid=payer-month-reason]', 'statement agreed with AXA')
  await page.click('[data-testid=payer-month-confirm]')
  await page.waitForSelector('[data-testid=payer-month-dialog]', { state: 'detached' })
  check('Close posts the payer, period and reason — and no actor', JSON.stringify(calls.close[0]?.body) === JSON.stringify({ customerId: 'AXA', year: 2026, month: 10, reason: 'statement agreed with AXA' }), JSON.stringify(calls.close[0]?.body))
  check('…with the CSRF header', !!calls.close[0]?.csrf)
  await page.waitForFunction(() => document.querySelector('[data-testid=payer-month-row][data-payer="AXA"]')?.getAttribute('data-state') === 'closed')
  check('AXA now reads closed, and offers Reopen', (await page.locator(`${rowSel('AXA')} [data-testid=payer-month-reopen]`).count()) === 1)
  check('the close did not re-scan the month', calls.month.filter((c) => c.query === '?activity=true').length === 1)

  // 6 — Reopen, and the history shows both acts.
  await page.click(`${rowSel('AXA')} [data-testid=payer-month-reopen]`)
  await page.fill('[data-testid=payer-month-reason]', 'late correction from store 1001')
  await page.click('[data-testid=payer-month-confirm]')
  await page.waitForSelector('[data-testid=payer-month-dialog]', { state: 'detached' })
  check('Reopen posts to …/Reopen', calls.reopen.length === 1 && calls.reopen[0].body.customerId === 'AXA')
  await page.waitForFunction(() => document.querySelector('[data-testid=payer-month-row][data-payer="AXA"]')?.getAttribute('data-state') === 'reopened')
  await page.click(`${rowSel('AXA')} [data-testid=payer-month-details]`)
  await page.waitForSelector('[data-testid=payer-month-history-line] >> nth=1')
  const history = await page.locator('[data-testid=payer-month-history-line]').allTextContents()
  check('its history shows both acts, oldest first', history.length === 2 && strip(history[0]).includes('Closed') && strip(history[0]).includes('statement agreed with AXA') && strip(history[1]).includes('Reopened') && strip(history[1]).includes('late correction'), JSON.stringify(history.map(strip)))
  check('history read as Audit/AXA/2026/10', calls.audit.includes('AXA'))
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-testid=payer-month-sheet]', { state: 'detached' })

  // 7 — the corrections register.
  await page.click(`${rowSel('MEDGULF')} [data-testid=payer-month-details]`)
  await page.waitForSelector('[data-testid=payer-month-correction]')
  const reg = strip(await page.textContent('[data-testid=payer-month-corrections]'))
  check('the register lists each correction', (await page.locator('[data-testid=payer-month-correction]').count()) === 2)
  check('…with store, invoice, direction, amount, reason, note and the pincode flag', ['1001', '445566', 'Refund to patient', '12.500', 'WRONG_COPAY · Wrong co-pay', 'patient brought the card late', 'Pay-out pincode used'].every((w) => reg.includes(w)), reg.slice(0, 400))
  check('…and its lines beneath, rejected and moved marked', reg.includes('Panadol 500') && reg.includes('Rejected from cover') && reg.includes('Moved by the cap'))
  await page.keyboard.press('Escape')

  // 8 — Close all: one ask, one request, the list re-reads.
  const ledgerReadsBefore = calls.month.filter((c) => c.query === '').length
  const activityReadsBefore = calls.month.filter((c) => c.query === '?activity=true').length
  await page.click('[data-testid=payer-month-close-all]')
  await page.waitForSelector('[data-testid=payer-month-reason]')
  const ask = strip(await page.textContent('[data-testid=payer-month-dialog]'))
  check('Close all states how many payers it closes', ask.includes('Close 4 payers for 2026-10'), ask.slice(0, 200))
  check('…how many are already closed', ask.includes('1 of them is already closed'))
  check('…and the month’s corrections', strip(await page.textContent('[data-testid=payer-month-dialog-corrections]')).includes('2 corrections'))
  await page.fill('[data-testid=payer-month-reason]', 'October month-end')
  await page.click('[data-testid=payer-month-confirm]')
  await page.waitForSelector('[data-testid=payer-month-dialog]', { state: 'detached' })
  check('Close all sends ONE request, naming no payer', calls.closeAll.length === 1 && JSON.stringify(calls.closeAll[0].body) === JSON.stringify({ year: 2026, month: 10, reason: 'October month-end' }), JSON.stringify(calls.closeAll))
  await page.waitForTimeout(500)
  check('…and the list re-reads (the ledger read again)', calls.month.filter((c) => c.query === '').length > ledgerReadsBefore)
  check('…and the activity list re-reads too', calls.month.filter((c) => c.query === '?activity=true').length === activityReadsBefore + 1)
  const states = await page.locator('[data-testid=payer-month-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
  check('every row now reads closed', states.length === 4 && states.every((s) => s === 'closed'), JSON.stringify(states))
  await page.waitForSelector('[data-sonner-toast]')
  check('…and the toast says how many', strip(await page.textContent('[data-sonner-toast]')).includes('4 payers closed'))

  // 9 — a different month opens on its ledger read again; Close all is withdrawn.
  await page.selectOption('[data-testid=payer-month-month]', '9')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('month') === '9')
  await page.waitForTimeout(500)
  check('changing the month reads its ledger, no activity', calls.month.at(-1).month === '9' && calls.month.at(-1).query === '', JSON.stringify(calls.month.at(-1)))
  check('…and Close all is not offered for it', (await page.locator('[data-testid=payer-month-close-all]').count()) === 0)
  const scansBefore = calls.month.filter((c) => c.query === '?activity=true').length
  await page.selectOption('[data-testid=payer-month-month]', '10')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('month') === '10')
  await page.waitForTimeout(500)
  check('coming back to the scanned month opens on its ledger, with no new scan', calls.month.filter((c) => c.query === '?activity=true').length === scansBefore && (await page.locator('[data-testid=payer-month-close-all]').count()) === 0)
  await page.click('[data-testid=payer-month-year]', { clickCount: 3 })
  await page.keyboard.type('2025')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('year') === '2025')
  check('a year can be typed digit by digit', (await page.inputValue('[data-testid=payer-month-year]')) === '2025')
  await page.close()

  // 10 — a refusal renders in the dialog, in the page's words, and the dialog stays.
  reset({ refusal: 'INS-16264' })
  page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector(`${rowSel('MEDGULF')} [data-testid=payer-month-close]`)
  await page.click(`${rowSel('MEDGULF')} [data-testid=payer-month-close]`)
  await page.fill('[data-testid=payer-month-reason]', 'month-end')
  await page.click('[data-testid=payer-month-confirm]')
  await page.waitForFunction(() => document.querySelector('[data-testid=payer-month-dialog]')?.textContent?.includes('Nothing was written'))
  check('INS-16264 shows its sentence, and the dialog stays open', await page.isVisible('[data-testid=payer-month-reason]'))
  await page.close()

  // 11 — the access probe: no → denied, no read, and no leaf.
  reset({ access: { canManage: false } })
  page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[role=alert]')
  check('canManage=false: denied, and no month read', strip(await page.textContent('[role=alert]')).includes('No access to payer months') && calls.month.length === 0)
  check('canManage=false: no leaf in the nav', (await page.locator('a[href="/insurance-rules/payer-months"]').count()) === 0)
  await page.close()
  reset()
  page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=payer-month-table]')
  check('canManage=true: the nav carries the leaf', (await page.locator('a[href="/insurance-rules/payer-months"]').count()) > 0)
  await page.close()

  // 12 — RTL. `oms.locale=ar` flips the direction only: the app's `lng` stays `en` until Arabic is switched on
  // (src/core/i18n.ts), so the Arabic bundle is proved by `i18n-keys.test.ts`, not here.
  reset()
  page = await open('rtl')
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=payer-month-table]')
  check('RTL: the document is dir=rtl', (await page.getAttribute('html', 'dir')) === 'rtl')
  const cells = await page.locator(`${rowSel('BUPA')} td`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the payer column is rightmost', cells[0] > cells[1], JSON.stringify(cells))
  check('RTL: the time still reads 2026-11-02 10:15', strip(await page.textContent(rowSel('BUPA'))).includes('2026-11-02 10:15'))
  await page.click('[data-testid=payer-month-show-activity]')
  await page.waitForSelector('[data-testid=payer-month-close-all]')
  const toolbar = await page.locator('[data-testid=payer-month-toolbar] > *').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the toolbar reads right to left (year before month)', toolbar[0] > toolbar[1], JSON.stringify(toolbar))
  await page.screenshot({ path: process.env.SHOT || 'payer-month-rtl.png', fullPage: true })
  await page.close()

  check('no page errors', errors.length === 0, errors.join(' | '))
  await browser.close()

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
