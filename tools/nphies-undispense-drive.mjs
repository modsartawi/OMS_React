// Undispense drive (ticket 898, BackOffice spec 3208, Nphies contract 1.2 §1.1 rows 19–21) — drives the
// REAL app in Chromium against MOCKED `Nphies/*` envelopes.
//
// ⚠ No live SIS.Api: the stubs are the shapes BackOffice 3725 built (`NphiesUndispenseRow`,
// `NphiesUndispenseList`, `NphiesUndispenseQueued`, the 1.2 `Nphies/Access` answer, the §6 refusal codes),
// so the stub is a contract assertion rather than a convenience.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/nphies-undispense-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAGE_URL = BASE + '/nphies/undispense'

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

const ROW = (over = {}) => ({
  id: '01JCZ00000000000000000000A',
  authId: 'AUTH-1',
  storeCode: '1001',
  returnTransactionId: 'TRX-1001-77',
  origin: 'return',
  requestedBy: '4711',
  requestedByName: '',
  note: '',
  state: 'failed',
  attempts: 3,
  lastError: 'Nphies service timed out',
  addedTime: '2026-11-13T09:00:00',
  processedTime: '2026-11-13T09:05:00',
  lastAttemptTime: '2026-11-13T09:05:00',
  retriedBy: null,
  retriedTime: null,
  ...over,
})

let scenario
let calls
const reset = (over = {}) => {
  scenario = {
    access: { canOpenNphies: true, canReleaseApprovalNumber: true, canUndispense: true, contractVersion: '1.2' },
    rows: [
      ROW(),
      ROW({ id: '01JCZ00000000000000000000B', authId: 'AUTH-2', storeCode: '2002', state: 'pending', attempts: 1, lastError: null, processedTime: null }),
      ROW({ id: '01JCZ00000000000000000000C', authId: 'AUTH-3', storeCode: '1001', state: 'done', attempts: 1, lastError: null, origin: 'support', requestedBy: 'msartawi', requestedByName: 'msartawi', note: 'legacy till return' }),
    ],
    truncated: false,
    undispenseRefusal: null,
    retryRefusal: null,
    ...over,
  }
  calls = { list: [], retry: [], undispense: [] }
}

/** The door's own filter (`NphiesUndispenseDesk.ListAsync`), so a stubbed filter is a filtered answer. */
const filterRows = (q) => {
  const states = (q.get('state') || '').split(',').filter(Boolean)
  return scenario.rows.filter(
    (r) =>
      (states.length === 0 || states.includes(r.state)) &&
      (!q.get('store') || r.storeCode === q.get('store')) &&
      (!q.get('authId') || r.authId === q.get('authId')) &&
      (!q.get('from') || r.addedTime.slice(0, 10) >= q.get('from')) &&
      (!q.get('to') || r.addedTime.slice(0, 10) <= q.get('to')),
  )
}

async function run() {
  const browser = await chromium.launch()
  const errors = []

  const open = async (dir = 'ltr') => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 950 } })
    // A cold Vite transform of the lazy chunk can outlast the 30 s default on this machine.
    page.setDefaultNavigationTimeout(90000)
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
    await page.addInitScript((d) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
    }, dir)
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      const path = decodeURIComponent(url.pathname.split('/api/')[1])
      const method = route.request().method()
      if (path === 'Auth/Me')
        return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
      if (path === 'Nphies/Access') return route.fulfill(envelope(scenario.access))
      if (path === 'Nphies/Undispense' && method === 'GET') {
        calls.list.push(Object.fromEntries(url.searchParams))
        return route.fulfill(envelope({ items: filterRows(url.searchParams), truncated: scenario.truncated, contractVersion: '1.2' }))
      }
      let m = path.match(/^Nphies\/Undispense\/([^/]+)\/Retry$/)
      if (m && method === 'POST') {
        calls.retry.push({ id: m[1], body: route.request().postData() })
        if (scenario.retryRefusal) {
          const [status, code] = scenario.retryRefusal
          return route.fulfill(envelope(null, { status, success: false, message: 'server sentence', errors: code ? [{ errorCode: code, errorMessage: code }] : [] }))
        }
        const row = scenario.rows.find((r) => r.id === m[1])
        Object.assign(row, { state: 'pending', attempts: 0, retriedBy: 'msartawi', retriedTime: '2026-11-13T10:00:00' })
        return route.fulfill(envelope({ request: row, created: false, contractVersion: '1.2' }))
      }
      m = path.match(/^Nphies\/Auth\/([^/]+)\/Undispense$/)
      if (m && method === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        calls.undispense.push({ authId: m[1], body })
        if (scenario.undispenseRefusal) {
          const [status, code] = scenario.undispenseRefusal
          return route.fulfill(envelope(null, { status, success: false, message: 'server sentence', errors: [{ errorCode: code, errorMessage: code }] }))
        }
        const request = ROW({ id: '01JCZ00000000000000000000Z', authId: m[1], state: 'pending', attempts: 0, lastError: null, processedTime: null, origin: 'support', requestedBy: 'msartawi', requestedByName: 'msartawi', note: body.note, addedTime: '2026-11-13T11:00:00' })
        scenario.rows = [request, ...scenario.rows]
        return route.fulfill(envelope({ request, created: true, contractVersion: '1.2' }))
      }
      if (path.startsWith('Nphies/AuthResponse/'))
        return route.fulfill(envelope({ id: 'AUTH-9', preAuthRef: '555', isDispensed: true, claimType: 0, claimProcessingCodes: 'Complete', adjudicationOutcome: 'approved', authLines: [], authSupportingInfos: [] }))
      if (path.startsWith('Nphies/ApprovalNumber/Releases/')) return route.fulfill(envelope({ items: [], contractVersion: '1.2' }))
      return route.fulfill(envelope({}))
    })
    return page
  }

  const gridText = (page) => page.textContent('[data-testid=undispense-grid]')
  const lastList = () => calls.list[calls.list.length - 1]

  // 1 — the list opens on pending + failed.
  reset()
  let page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=undispense-grid] .ag-row')
  check('the first read asks state=pending,failed and nothing else', JSON.stringify(calls.list[0]) === '{"state":"pending,failed"}', JSON.stringify(calls.list[0]))
  let text = await gridText(page)
  check('the failed and pending rows show; the done one does not', text.includes('AUTH-1') && text.includes('AUTH-2') && !text.includes('AUTH-3'))
  check('the columns: store, return, origin, attempts, last error', text.includes('2002') && text.includes('TRX-1001-77') && text.includes('Till return') && text.includes('Nphies service timed out'))
  check('the pending and failed chips are on, done off', (await page.getAttribute('[data-testid=undispense-state-pending]', 'aria-pressed')) === 'true' && (await page.getAttribute('[data-testid=undispense-state-failed]', 'aria-pressed')) === 'true' && (await page.getAttribute('[data-testid=undispense-state-done]', 'aria-pressed')) === 'false')
  check('the count says 2', (await page.textContent('[data-testid=undispense-count]')).replace(/[⁦-⁩]/g, '').includes('2 undispenses'))

  // 2 — filters.
  await page.click('[data-testid=undispense-state-done]')
  await page.fill('[data-testid=undispense-filter-store]', '1001')
  await page.fill('[data-testid=undispense-filter-from]', '2026-11-01')
  await page.fill('[data-testid=undispense-filter-to]', '2026-11-13')
  const before = calls.list.length
  check('typing does not refetch', calls.list.length === before)
  await page.click('[data-testid=undispense-search]')
  await page.waitForFunction((n) => true, before)
  await page.waitForTimeout(400)
  check('Search sends every filter under the door’s names', JSON.stringify(lastList()) === JSON.stringify({ state: 'pending,failed,done', store: '1001', from: '2026-11-01', to: '2026-11-13' }), JSON.stringify(lastList()))
  text = await gridText(page)
  check('store 1001 in all three states: AUTH-1 and AUTH-3, not AUTH-2', text.includes('AUTH-1') && text.includes('AUTH-3') && !text.includes('AUTH-2'))
  await page.fill('[data-testid=undispense-filter-auth]', 'AUTH-3')
  await page.click('[data-testid=undispense-search]')
  await page.waitForTimeout(400)
  check('the authorization filter is sent', lastList().authId === 'AUTH-3')
  check('a done row has no Retry', (await page.locator('[data-testid=undispense-retry]').count()) === 0)
  await page.click('[data-testid=undispense-reset]')
  await page.waitForTimeout(400)
  check('Reset reads pending,failed again', JSON.stringify(lastList()) === '{"state":"pending,failed"}')

  // 3 — Retry on a failed row only.
  check('one Retry: on the failed row, not the pending one', (await page.locator('[data-testid=undispense-retry]').count()) === 1)
  const listBefore = calls.list.length
  await page.click('[data-testid=undispense-retry]')
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=undispense-retry]').length === 0)
  check('Retry posts the request’s id, once', calls.retry.length === 1 && calls.retry[0].id === '01JCZ00000000000000000000A', JSON.stringify(calls.retry))
  check('…then the list is re-read', calls.list.length > listBefore)
  await page.waitForSelector('[data-sonner-toast]')
  check('…and says it went back to the queue', (await page.textContent('[data-sonner-toast]')).includes('Sent back to the queue'))
  text = await gridText(page)
  check('the retried row now reads pending', (await page.textContent('[row-id="01JCZ00000000000000000000A"]')).includes('Pending'))

  // 4 — no polling.
  const n = calls.list.length
  await page.waitForTimeout(3000)
  check('no refetch on a timer', calls.list.length === n)
  await page.close()

  // 5 — a refused retry: the page's own words, and a re-read.
  reset({ retryRefusal: [409, 'UNDISPENSE_NOT_FAILED'] })
  page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=undispense-retry]')
  await page.click('[data-testid=undispense-retry]')
  await page.waitForSelector('[data-sonner-toast]')
  check('a refused retry shows the page’s sentence', (await page.textContent('[data-sonner-toast]')).includes('not failed any more'))
  await page.close()

  // 6 — the manual undispense: blank-note guard, the body, the answer shown.
  reset()
  page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=undispense-manual]')
  check('the Undispense button is disabled with no id', await page.isDisabled('[data-testid=undispense-open]'))
  await page.fill('[data-testid=undispense-auth-id]', 'AUTH-9')
  await page.click('[data-testid=undispense-open]')
  await page.waitForSelector('[data-testid=undispense-note]')
  check('the dialog names the authorization', (await page.textContent('dialog')).includes('AUTH-9'))
  check('confirm is aria-disabled while the note is blank', (await page.getAttribute('[data-testid=undispense-confirm]', 'aria-disabled')) === 'true')
  await page.click('[data-testid=undispense-confirm]', { force: true })
  await page.waitForTimeout(300)
  check('a blank confirm posts nothing', calls.undispense.length === 0)
  await page.fill('[data-testid=undispense-note]', '   ')
  check('a whitespace note still cannot confirm', (await page.getAttribute('[data-testid=undispense-confirm]', 'aria-disabled')) === 'true')
  await page.fill('[data-testid=undispense-note]', 'Returned in full on the legacy till')
  check('a typed note enables confirm', (await page.getAttribute('[data-testid=undispense-confirm]', 'aria-disabled')) === 'false')
  await page.click('[data-testid=undispense-confirm]')
  await page.waitForSelector('dialog', { state: 'detached' })
  check('it posts to Nphies/Auth/AUTH-9/Undispense, once', calls.undispense.length === 1 && calls.undispense[0].authId === 'AUTH-9')
  check('🚩 the body is { note } alone', JSON.stringify(calls.undispense[0].body) === '{"note":"Returned in full on the legacy till"}', JSON.stringify(calls.undispense[0].body))
  await page.waitForTimeout(400)
  check('the list now shows that authorization in every state', JSON.stringify(lastList()) === '{"authId":"AUTH-9"}', JSON.stringify(lastList()))
  check('…and the new pending row is on it', (await gridText(page)).includes('Returned in full on the legacy till'))
  await page.close()

  // 7 — refusals render in the dialog, in the page's words.
  for (const [status, code, words] of [
    [409, 'INVOICE_NOT_FULLY_RETURNED', 'The invoice is not fully returned'],
    [404, 'INVOICE_NOT_FOUND', 'no completed sale'],
    [404, 'AUTH_NOT_FOUND', 'No authorization has this Id'],
  ]) {
    reset({ undispenseRefusal: [status, code] })
    page = await open()
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid=undispense-manual]')
    await page.fill('[data-testid=undispense-auth-id]', 'AUTH-9')
    await page.click('[data-testid=undispense-open]')
    await page.fill('[data-testid=undispense-note]', 'returned')
    await page.click('[data-testid=undispense-confirm]')
    await page.waitForFunction((w) => document.querySelector('dialog')?.textContent?.includes(w), words)
    check(`${code} shows its sentence in the dialog, which stays open`, await page.isVisible('[data-testid=undispense-note]'))
    await page.close()
  }

  // 8 — without canUndispense: the list, no buttons.
  for (const access of [
    { canOpenNphies: true, canReleaseApprovalNumber: true, canUndispense: false },
    { canOpenNphies: true },
  ]) {
    reset({ access })
    page = await open()
    await page.goto(PAGE_URL)
    await page.waitForSelector('[data-testid=undispense-grid] .ag-row')
    const label = 'canUndispense' in access ? 'canUndispense=false' : 'a probe without the field'
    check(`${label}: the list shows`, (await gridText(page)).includes('AUTH-1'))
    check(`${label}: no Retry`, (await page.locator('[data-testid=undispense-retry]').count()) === 0)
    check(`${label}: no manual Undispense`, (await page.locator('[data-testid=undispense-manual]').count()) === 0)
    await page.close()
  }

  // 9 — without the Nphies grant: the gate.
  reset({ access: { canOpenNphies: false } })
  page = await open()
  await page.goto(PAGE_URL)
  await page.waitForSelector('[role=alert]')
  check('without the Nphies grant: denied, and no list read', (await page.textContent('[role=alert]')).includes('No access') && calls.list.length === 0)
  await page.close()

  // 10 — the 751 link, and the truncation notice.
  reset({ truncated: true })
  page = await open()
  await page.goto(BASE + '/nphies/approval-release?id=AUTH-9')
  await page.waitForSelector('[data-testid=release-undispense-link]')
  check('a dispensed row on the release page links here', (await page.getAttribute('[data-testid=release-undispense-link]', 'href')) === '/nphies/undispense?authId=AUTH-9')
  await page.click('[data-testid=release-undispense-link]')
  await page.waitForSelector('[data-testid=undispense-filters]')
  await page.waitForTimeout(400)
  check('…which opens on that authorization in every state', JSON.stringify(lastList()) === '{"authId":"AUTH-9"}', JSON.stringify(lastList()))
  check('…and prefills the manual box', (await page.inputValue('[data-testid=undispense-auth-id]')) === 'AUTH-9')
  check('a truncated answer says so', await page.isVisible('[data-testid=undispense-truncated]'))
  check('the nav carries the leaf', (await page.locator('a[href="/nphies/undispense"]').count()) > 0)
  await page.close()

  // 11 — Arabic RTL.
  reset()
  page = await open('rtl')
  await page.goto(PAGE_URL)
  await page.waitForSelector('[data-testid=undispense-grid] .ag-row')
  check('RTL: the document is dir=rtl', (await page.getAttribute('html', 'dir')) === 'rtl')
  const chips = await page.locator('[data-testid^=undispense-state-]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the state chips read right to left', chips[0] > chips[1] && chips[1] > chips[2], JSON.stringify(chips))
  await page.screenshot({ path: process.env.SHOT || 'undispense-rtl.png', fullPage: true })
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
