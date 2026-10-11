// SAP export console store-day drive (ticket 461, BackOffice spec 2579) — drives the REAL store-day
// page in Chromium against STUBBED `SapExport/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2580–2583 are unbuilt, and ticket 466
// is the live walk. Never point this at a real host.
//
// It verifies:
//   1. with `screenAllowed: true` the Reports group carries a SAP export leaf, AFTER the IDoc
//      inspector, pointing at /reports/sap-export; the store page (a placeholder until 464) opens a
//      store-day (it was 461's entry page; 463 made that the fleet);
//   2. the header: store, day, "as of", the total, a chip per label with its count in the label's
//      token, and the export-accounting verdict — `breaks` in the danger token;
//   3. the first read asks for page 1 of 50 with no label or state; label chips reach the request as a
//      REPEATED `label`, the legend as a REPEATED `state`, each back on page 1, and Clear drops them;
//   4. the legend lists only the states present that day, each with its meaning;
//   5. paging walks the door's pages at 50;
//   6. the grid: a row's state + meaning, label badge (held for inventory never red), rail, version,
//      the watermark on a legacy row, hours past day end, the reason, an N1 row's "held 1 of 2" with
//      its missing-rows hint, and its flags as chips;
//   7. each row links to /reports/idoc-inspector?store=<code>&trx=<trxNumber>;
//   8. an older door's answer (no flags, held, reason or accounting) still draws, reading `agrees`;
//      a newer door's unknown label count is shown as a plain chip, not a filter;
//   9. a refusal (`DAY_OUT_OF_WINDOW`) shows its own sentence;
//  10. with `screenAllowed: false` (and with a 403 on the probe) the leaf is hidden and the page guards
//      itself, with no store-day read.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sap-export-storeday-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sap-export-storeday-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope `src/core/api.ts` reads (copied from sync-console-fleet-drive.mjs).
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const CODE = 'P014'
const DAY = '2026-10-09'
const ZERO_FLAGS = { X1: 0, X1p: 0, X2: 0, X3: 0, X4: 0, legacyResend: 0, failClosedNoDetail: 0 }

const row = (i, over = {}) => ({
  trxNumber: `T${String(i).padStart(6, '0')}`,
  machineCode: 'M01',
  trxDate: DAY,
  counter: 50000 + i,
  rail: 'new',
  state: 'N4',
  label: 'behind',
  version: 'N',
  trxType: 1,
  documentType: 1,
  customerId: null,
  reason: 'Sealed batch not exported yet',
  hoursPastDayEnd: 31.5,
  held: null,
  flags: [],
  watermark: null,
  ...over,
})

// 120 unfinished rows in the door's order (worst first): three pages at 50. Row 1 is an N1 hold, row 2
// a legacy L10 with its watermark, row 3 a double-sent N9, row 4 held for inventory.
const ROWS = Array.from({ length: 120 }, (_, k) => {
  const i = k + 1
  if (i === 1)
    return row(i, { state: 'N1', label: 'stuck', reason: 'Charges mismatch: posting questioned', hoursPastDayEnd: null, held: { held: 1, of: 2, missingRows: true }, flags: ['X2'] })
  if (i === 2) return row(i, { rail: 'legacy', state: 'L10', label: 'stuck', version: 'L', reason: 'Passed below the watermark with no log', hoursPastDayEnd: null, watermark: 51234 })
  if (i === 3) return row(i, { state: 'N9', label: 'stuck', version: null, reason: 'Gave up after three failures', hoursPastDayEnd: null, flags: ['X1p', 'X4'] })
  if (i === 4) return row(i, { rail: 'legacy', state: 'L9', label: 'heldForInventory', version: 'L', reason: '', hoursPastDayEnd: 55, watermark: 51234 })
  return row(i)
})

const storeDay = (rows, over = {}) => ({
  code: CODE,
  day: DAY,
  asOf: '2026-10-11T08:15:00',
  total: 840,
  labels: { exported: 700, byDesign: 20, waiting: 0, heldForInventory: 1, behind: 116, stuck: 3 },
  states: { N5: 650, L1: 50, L3: 20, N4: 116, N1: 1, L10: 1, N9: 1, L9: 1 },
  flags: { ...ZERO_FLAGS, X1p: 1, X2: 1, X4: 1 },
  accounting: 'breaks',
  rows,
  ...over,
})

const browser = await chromium.launch()

async function open({ access = { screenAllowed: true }, accessStatus = 200, othersOpen = false, refuse = null, old = false, newer = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SapExport/Access') {
      // The contract: a refused caller gets a bare 403 with no body on every door but Access; a
      // 403 here too stands for a broken door, which must hide the leaf all the same.
      if (accessStatus !== 200) return route.fulfill({ status: accessStatus, body: '' })
      return route.fulfill(envelope(access))
    }
    if (p === 'SapExport/StoreDay') {
      calls.push(url.searchParams)
      if (refuse) return route.fulfill(envelope(null, { status: 400, success: false, message: refuse.message, errorCode: refuse.code }))
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      const labels = url.searchParams.getAll('label')
      const states = url.searchParams.getAll('state')
      const matching = ROWS.filter((r) => (labels.length === 0 || labels.includes(r.label)) && (states.length === 0 || states.includes(r.state)))
      let items = matching.slice((pg - 1) * size, pg * size)
      if (old) {
        // A 2580-only door: no reasons, holds or flags on the rows, no flag counts or verdict.
        items = items.map(({ flags: _f, held: _h, reason: _r, ...rest }) => rest)
        const { flags: _f, accounting: _a, ...head } = storeDay({ items, total: matching.length, page: pg, pageSize: size })
        return route.fulfill(envelope(head))
      }
      // A door newer than this bundle: a label count it does not know yet.
      const extra = newer ? { labels: { exported: 700, byDesign: 20, waiting: 0, heldForInventory: 1, behind: 116, stuck: 3, parked: 12 } } : {}
      return route.fulfill(envelope(storeDay({ items, total: matching.length, page: pg, pageSize: size }, extra)))
    }
    // Every other probe: shut, or (to see where the leaf sits among its siblings) open.
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: othersOpen, screenAllowed: othersOpen, allowed: othersOpen, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const callText = (sp) => (sp ? '?' + sp.toString() : '')
const lastCall = (calls) => calls[calls.length - 1]
const waitForCall = async (page, calls, pred) => {
  for (let i = 0; i < 40; i++) {
    if (calls.length && pred(lastCall(calls))) return true
    await page.waitForTimeout(100)
  }
  return false
}
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const STORE_DAY_URL = `${BASE}/reports/sap-export/store/${CODE}/day/${DAY}`

// ── 1: the leaf and the placeholder ───────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ othersOpen: true })
  await page.goto(`${BASE}/reports/sap-export/store/${CODE}`)
  await page.locator('[data-open-day-form]').waitFor({ timeout: 20000 })
  const reports = page.getByRole('button', { name: /^Reports$/i })
  if ((await page.locator('nav a[href="/reports/sap-export"]').count()) === 0 && (await reports.count())) await reports.first().click()
  const leaf = page.locator('nav a[href="/reports/sap-export"]')
  check('1. granted → the SAP export leaf appears', (await leaf.count()) === 1)
  check('1. …labelled SAP export', strip(await leaf.first().innerText()) === 'SAP export', await leaf.first().innerText().catch(() => ''))
  const reportLeaves = await page.locator('nav a[href^="/reports/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  const at = reportLeaves.indexOf('/reports/sap-export')
  check('1. …in the Reports group, right after the IDoc inspector', at > 0 && reportLeaves[at - 1] === '/reports/idoc-inspector', JSON.stringify(reportLeaves))
  const adminLeaves = await page.locator('nav a[href^="/admin/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1. …and NOT in Admin, whose last leaf stays Store sync', !adminLeaves.includes('/reports/sap-export') && (adminLeaves.length === 0 || adminLeaves[adminLeaves.length - 1] === '/admin/sync'), JSON.stringify(adminLeaves))
  await page.locator('[data-open-day-day]').fill(DAY)
  await page.locator('[data-open-day-submit]').click()
  await page.locator(`[data-store-day-page="${CODE}/${DAY}"]`).waitFor({ timeout: 10000 })
  check('1. the store placeholder opens the store-day page', page.url().endsWith(`/reports/sap-export/store/${CODE}/day/${DAY}`), page.url())
  check('no page errors (leaf)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–7: the page ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(STORE_DAY_URL)
  await page.locator('[data-inspector-link="T000001"]').waitFor({ timeout: 20000 })

  // 2. the header
  const header = strip(await page.locator('[data-store-day-header]').innerText())
  check('2. the header names the store and the day', /Store P014 · 2026-10-09/.test(header), header)
  check('2. …the "as of" stamp, unshifted', /Classified live at 2026-10-11 08:15/.test(header), header)
  check('2. …and the total', /840 transactions that day/.test(header), header)
  const chips = await page.locator('[data-label-chip]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-label-chip')}:${e.getAttribute('data-token')}:${e.innerText.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()}`))
  check(
    '2. a chip per label, worst first, each with its count and its token',
    sameList(chips, [
      'stuck:danger:3 Stuck',
      'behind:warningStrong:116 Behind',
      'heldForInventory:info:1 Held for inventory',
      'waiting:neutral:0 Waiting',
      'exported:success:700 Exported',
      'byDesign:muted:20 By design',
    ]),
    JSON.stringify(chips),
  )
  const heldChipClass = await page.locator('[data-label-chip="heldForInventory"]').getAttribute('class')
  check('2. held for inventory is never red', !/danger/.test(heldChipClass ?? ''), heldChipClass)
  const verdict = page.locator('[data-accounting="breaks"] [data-token]')
  check('2. a breaks day shows the danger badge', (await verdict.getAttribute('data-token')) === 'danger' && /bg-danger-050/.test((await verdict.getAttribute('class')) ?? '') && strip(await verdict.innerText()) === 'Breaks')

  // 3. the first read
  const first = calls[0]
  check('3. the first read asks for page 1 of 50, no label or state', first.get('code') === CODE && first.get('day') === DAY && first.get('page') === '1' && first.get('pageSize') === '50' && first.getAll('label').length === 0 && first.getAll('state').length === 0, callText(first))
  check('3. the list counts the rows', strip(await page.locator('[data-listed]').innerText()) === '120 transactions listed')

  // 4. the legend
  const legend = await page.locator('[data-state-chip]').evaluateAll((els) => els.map((e) => e.innerText.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()))
  check(
    '4. the legend lists the states present, in the ladder order, each with its meaning',
    sameList(legend, ['L1 Exported 50', 'L3 Excluded by rule 20', 'L9 Pending above the watermark 1', 'L10 Passed over 1', 'N1 Held 1', 'N4 Sealed, not exported 116', 'N5 Exported 650', 'N9 Gave up 1']),
    JSON.stringify(legend),
  )

  // 6. the grid
  const cell = async (rowIndex, col) => strip(await page.locator(`[row-index="${rowIndex}"] [col-id="${col}"]`).first().innerText())
  check('6. a row shows its state code and meaning', (await cell(0, 'state')) === 'N1 Held', await cell(0, 'state'))
  check('6. …its label badge', (await cell(0, 'label')) === 'Stuck' && (await page.locator('[row-index="0"] [col-id="label"] [data-token]').getAttribute('data-token')) === 'danger')
  check('6. an N1 row shows "held 1 of 2" with the missing-rows hint', (await cell(0, 'held')) === 'held 1 of 2 Missing rows', await cell(0, 'held'))
  check('6. …its reason, as free text', (await cell(0, 'reason')) === 'Charges mismatch: posting questioned' && (await page.locator('[row-index="0"] [col-id="reason"] bdi').count()) === 1)
  check('6. …and its flags as chips', (await page.locator('[row-index="0"] [col-id="flags"] [data-flags]').getAttribute('data-flags')) === 'X2' && (await cell(0, 'flags')) === 'Processed, stamped legacy')
  check('6. a new-rail row shows no watermark', (await page.locator('[row-index="0"] [data-watermark]').count()) === 0)
  check('6. a legacy row shows its rail, version and the watermark beside its counter', (await cell(1, 'rail')) === 'Legacy' && (await cell(1, 'version')) === 'L' && (await cell(1, 'counter')) === '50002 watermark 51234', `${await cell(1, 'rail')} | ${await cell(1, 'counter')}`)
  check('6. a NULL version reads None, double-send pending is a danger chip', (await cell(2, 'version')) === 'None' && (await page.locator('[row-index="2"] [col-id="flags"] [data-token]').first().getAttribute('data-token')) === 'danger')
  check('6. a held-for-inventory row is info, never red, with its age', (await page.locator('[row-index="3"] [col-id="label"] [data-token]').getAttribute('data-token')) === 'info' && (await cell(3, 'hoursPastDayEnd')) === '55')
  check('6. a behind row shows its hours past day end', (await cell(4, 'hoursPastDayEnd')) === '31.5')
  check('6. the door order is kept (worst first, not re-sorted)', (await cell(0, 'trxNumber')) === 'T000001' && (await cell(4, 'trxNumber')) === 'T000005')

  // 7. the inspector link
  const href = await page.locator('[data-inspector-link="T000001"]').getAttribute('href')
  check('7. a row links to the inspector with store and trx', href === `/reports/idoc-inspector?store=${CODE}&trx=T000001`, href)
  await page.screenshot({ path: `${SHOTS}/store-day.png`, fullPage: true })

  // 5. paging
  await page.getByRole('button', { name: 'Next' }).click()
  check('5. Next asks for page 2 of 50', await waitForCall(page, calls, (c) => c.get('page') === '2' && c.get('pageSize') === '50'), callText(lastCall(calls)))
  await page.locator('[data-inspector-link="T000051"]').waitFor()
  check('5. page 2 draws rows 51–100', (await page.locator('[data-inspector-link="T000001"]').count()) === 0)
  const readout = strip(await page.locator('nav[aria-label="Result pages"]').innerText())
  check('5. the pager reads page 2 of 3', /Page 2 of 3/.test(readout), readout)

  // 3. the filters
  await page.locator('[data-label-chip="behind"]').click()
  check('3. a label chip sets label, back on page 1', await waitForCall(page, calls, (c) => sameList(c.getAll('label'), ['behind']) && c.get('page') === '1'), callText(lastCall(calls)))
  await page.locator('[data-label-chip="stuck"]').click()
  check('3. a second chip repeats label, worst first', await waitForCall(page, calls, (c) => sameList(c.getAll('label'), ['stuck', 'behind'])), callText(lastCall(calls)))
  check('3. both chips read as pressed', (await page.locator('[data-label-chip][aria-pressed="true"]').count()) === 2)
  await page.locator('[data-state-chip="N1"]').click()
  check('3. a legend entry sets state, beside the labels', await waitForCall(page, calls, (c) => sameList(c.getAll('state'), ['N1']) && sameList(c.getAll('label'), ['stuck', 'behind'])), callText(lastCall(calls)))
  await page.locator('[data-state-chip="L10"]').click()
  check('3. a second entry repeats state, in the ladder order', await waitForCall(page, calls, (c) => sameList(c.getAll('state'), ['L10', 'N1'])), callText(lastCall(calls)))
  await page.locator('[data-inspector-link="T000002"]').waitFor()
  check('3. the filtered list draws only the matching rows', (await page.locator('[data-inspector-link]').count()) === 2)
  await page.locator('[data-clear-filters]').click()
  check('3. Clear drops every label and state', await waitForCall(page, calls, (c) => c.getAll('label').length === 0 && c.getAll('state').length === 0 && c.get('page') === '1'), callText(lastCall(calls)))
  check('3. …and nothing reads as pressed', (await page.locator('[aria-pressed="true"]').count()) === 0)

  const back = page.locator('[data-store-day-back]')
  check('7. the back link goes up to the store page', (await back.getAttribute('href')) === `/reports/sap-export/store/${CODE}` && strip(await back.innerText()) === `Store ${CODE}`, await back.getAttribute('href'))

  // 7. the link opens the inspector (462 makes it open on the transaction).
  await page.locator('[data-inspector-link="T000001"]').click()
  await page.waitForURL(/\/reports\/idoc-inspector/, { timeout: 10000 })
  check('7. the link opens the IDoc inspector', new URL(page.url()).pathname === '/reports/idoc-inspector', page.url())
  check('no page errors (store-day)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: an older door ──────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ old: true })
  await page.goto(STORE_DAY_URL)
  await page.locator('[data-inspector-link="T000001"]').waitFor({ timeout: 20000 })
  check('8. an older door still draws its rows', (await page.locator('[data-inspector-link]').count()) === 50)
  check('8. …its verdict reads agrees, in the success token', (await page.locator('[data-accounting="agrees"] [data-token]').getAttribute('data-token')) === 'success')
  check('8. …with no hold, no flags and a blank reason', (await page.locator('[data-held]').count()) === 0 && (await page.locator('[data-flags]').count()) === 0 && strip(await page.locator('[row-index="0"] [col-id="reason"]').innerText()) === '')
  check('no page errors (older door)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page, errors } = await open({ newer: true })
  await page.goto(STORE_DAY_URL)
  await page.locator('[data-label-unknown="parked"]').waitFor({ timeout: 20000 })
  check("8. a newer door's unknown label is shown with its count, as a plain chip", strip(await page.locator('[data-label-unknown="parked"]').innerText()) === '12 parked' && (await page.locator('button[data-label-unknown]').count()) === 0)
  check('no page errors (newer door)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: a refusal ──────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ refuse: { code: 'DAY_OUT_OF_WINDOW', message: 'The day is outside the census window.' } })
  await page.goto(STORE_DAY_URL)
  await page.getByText("This day is outside the console's 30-day window.").waitFor({ timeout: 20000 })
  check('9. a refusal shows its own sentence, and no rows', (await page.locator('[data-inspector-link]').count()) === 0)
  check('no page errors (refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: no view grant ─────────────────────────────────────────────────────────────────────────
for (const [name, opts] of [
  ['screenAllowed: false', { access: { screenAllowed: false } }],
  ['a 403 on the probe', { accessStatus: 403 }],
]) {
  const { context, page, errors, calls } = await open(opts)
  await page.goto(STORE_DAY_URL)
  await page.getByText(name === 'a 403 on the probe' ? /No access to SAP export|This screen is unavailable/ : 'No access to SAP export').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check(`10. ${name} → the leaf is hidden`, (await page.locator('nav a[href="/reports/sap-export"]').count()) === 0)
  check(`10. ${name} → the page guards itself, with no store-day read`, (await page.locator('[data-store-day-page]').count()) === 0 && calls.length === 0, String(calls.length))
  check(`no page errors (${name})`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
