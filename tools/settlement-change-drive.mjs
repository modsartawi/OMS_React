// Settlement change-request drive (spec 342, the web half of BackOffice spec 2190) — drives
// the REAL app in Chromium against STUBBED envelopes shaped exactly as BackOffice 2191–2195
// record them under `## Web contract`. One drive for the wave; each ticket adds its section.
//
// ⚠️ Stubbed, never live: no SIS.Api with the 2190 wave is up, and the assertions are about
// behaviour on SPECIFIC answers (a row with a waiting request, one without, a server too old
// to send the field) a live door will not produce on demand.
//
// Ticket 351 — the "change waiting" mark (W10, 2191's one additive Ledger field):
//   1. the open lanes: on the Shortage and Surplus tabs every drawn row shows the mark
//      exactly when its `openChangeRequestId` is not `''` — and some rows of each kind are
//      drawn, so "only where set" is proven rather than vacuous;
//   2. Awaiting approval and Theft: the same, on their own rows;
//   3. Cash waiting: a receipt is not an entry and carries no mark, even where its entry has
//      a change waiting;
//   4. the Ledger: an id marks, `''` does not, and a row WITHOUT the field marks nothing;
//   5. an SIS.Api older than the wave (no field on any row): nothing is marked, nothing
//      crashes;
//   6. the mark is named in words (aria-label + tooltip), and no raw t() key or page error
//      appears anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-change-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/settlement'
const OPEN_ROUTE = `${ROUTE}/open`
const LEDGER_ROUTE = `${ROUTE}/ledger`

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

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

const ACCOUNTANT = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenSettlement: true,
  canSuperviseSettlement: false,
}

/** 2191's sample id — the request waiting on a row the drive marks by hand. */
const REQUEST_ID = '01K6G8Z3N4QH5V2C7M9R1T0XYB'

let scenario = {}
let FX = null

/** An SIS.Api older than the wave: the same rows, the field not sent at all. */
const strip = (rows) => rows.map(({ openChangeRequestId, ...rest }) => rest)
const answer = (rows) => (scenario.oldServer ? strip(rows) : rows)

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )
  /** Requests Chromium aborted because the machine's network changed — see `go`. */
  let netChanged = 0
  page.on('requestfailed', (r) => /ERR_NETWORK_CHANGED/.test(r.failure()?.errorText ?? '') && netChanged++)

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = route.request().url().split('/api/')[1].split('?')[0]
    const q = (k) => url.searchParams.get(k) || ''

    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCOUNTANT))
    if (path === 'Settlement/Ledger') {
      // 🔑 One door, three readings — the lane (`status=OPEN`), the queue
      // (`status=PENDING_APPROVAL`) and the Ledger view's own criteria.
      if (q('status') === 'OPEN') return route.fulfill(envelope(answer(FX.open)))
      if (q('status') === 'PENDING_APPROVAL') return route.fulfill(envelope(answer(FX.pending)))
      return route.fulfill(
        envelope(answer(FX.ledger.filter((r) => !q('entryKind') || r.entryKind === q('entryKind')))),
      )
    }
    if (path === 'Settlement/Uncollected') return route.fulfill(envelope(FX.uncollected))
    if (path === 'Settlement/Orphans' || path === 'Settlement/Fleet' || path === 'Settlement/Branches')
      return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const appears = async (selector, timeout = 8000) =>
    page.waitForSelector(selector, { timeout }).then(() => true).catch(() => false)
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(150)
  }
  /**
   * ⚠️ A navigation that Chromium itself aborted is RETRIED, and only that — the theft
   * drive's reasoning, unchanged: `net::ERR_NETWORK_CHANGED` is the harness's weather,
   * not the screen's behaviour. Nothing else is retried.
   */
  const go = async (to) => {
    for (let attempt = 1; ; attempt++) {
      const before = netChanged
      const mark = errors.length
      let aborted = false
      try {
        await page.goto(BASE + to)
        await settle()
      } catch (e) {
        if (!/ERR_NETWORK_CHANGED/.test(String(e))) throw e
        aborted = true
      }
      if (!aborted && netChanged === before) return
      if (attempt >= 6) throw new Error(`the network changed under ${attempt} loads of ${to} in a row`)
      errors.length = mark
      await page.waitForTimeout(500)
    }
  }
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const labels = await page.$$eval('[data-testid="change-waiting-mark"]', (els) =>
      els.map((e) => `${e.getAttribute('aria-label')} ${e.getAttribute('title')}`).join(' '),
    )
    check(
      `${where} → no raw t() key on screen`,
      !/\b(changeRequest|open|ledger|account)\.[a-z]+\.[a-zA-Z]|settlement:/.test(`${text} ${labels}`),
    )
  }

  /** Every row the region's grids have DRAWN: its id, its number, and whether it is marked. */
  const drawn = (region) =>
    // ⚠️ `.ag-row` that holds the entry-number cell, not a container class: AG Grid's
    // container names move between versions, and the number cell is the mark's home.
    page.$$eval(`[data-region="${region}"] .ag-row`, (rows) =>
      rows
        .filter((r) => r.querySelector('[col-id="entryNumber"]'))
        .map((r) => ({
          id: r.getAttribute('row-id'),
          number: r.querySelector('[col-id="entryNumber"]')?.textContent?.trim() ?? '',
          marked: !!r.querySelector('[data-testid="change-waiting-mark"]'),
        })),
    )
  /**
   * 🔑 **The ticket's whole claim, per drawn row**: marked ⇔ the answer named a waiting
   * request. Asserted over EVERY row on screen, and only counted as proof when both kinds
   * were drawn — a screen of unmarked rows would pass "nothing wrongly marked" vacuously.
   */
  const marksMatch = async (where, region, rows, { expectBoth = true } = {}) => {
    const byId = new Map(rows.map((r) => [r.settlementEntryId, !!r.openChangeRequestId]))
    const seen = await drawn(region)
    const wrong = seen.filter((r) => byId.get(r.id) !== r.marked)
    const marked = seen.filter((r) => r.marked).length
    check(
      `${where} → every drawn row is marked exactly where its openChangeRequestId is set`,
      seen.length > 0 && wrong.length === 0,
      `${seen.length} drawn, ${wrong.length} wrong${wrong.length ? ' ' + JSON.stringify(wrong.slice(0, 3)) : ''}`,
    )
    if (expectBoth)
      check(
        `…and the screen holds both kinds (${marked} marked, ${seen.length - marked} not)`,
        marked > 0 && marked < seen.length,
      )
    return seen
  }
  const onTab = async (tab) => {
    await go(`${OPEN_ROUTE}?tab=${tab}`)
    await appears(`[role="tab"][data-tab="${tab}"][aria-selected="true"]`)
    await appears('[data-region="settlement-open"] .ag-row')
    await settle()
  }

  await go('/login')
  FX = await page.evaluate(async () => {
    const lane = await import('/src/features/collection/settlement/open-lane-fixture.ts')
    const approval = await import('/src/features/collection/settlement/approval-fixture.ts')
    const theft = await import('/src/features/collection/settlement/theft-fixture.ts')
    return {
      lane: lane.SETTLEMENT_OPEN_LANE,
      uncollected: lane.SETTLEMENT_UNCOLLECTED,
      pendingLane: approval.PENDING_LANE,
      theftLedger: theft.THEFT_LEDGER,
    }
  })

  // The thefts, by number, from 339's fixture: 1412 pending, 1413 approved, 1414 rejected.
  const theftRow = (n) => structuredClone(FX.theftLedger.find((r) => r.entryNumber === n))
  const approvedTheft = { ...theftRow(1413), openChangeRequestId: REQUEST_ID }
  // A second approved theft with nothing waiting, so the Theft tab holds both kinds.
  const quietTheft = { ...theftRow(1413), settlementEntryId: '01K6CQ7Y3T9V2N8M4R5B6D7F9C', entryNumber: 1416 }
  FX.open = [...FX.lane, approvedTheft, quietTheft]
  // The queue: 1203 has a change waiting; 1202, 1207 and the pending theft do not.
  FX.pending = [
    ...FX.pendingLane.map((r) => (r.entryNumber === 1203 ? { ...r, openChangeRequestId: REQUEST_ID } : r)),
    theftRow(1412),
  ]
  // The Ledger: an id, `''`, and a row whose server sent NO field — absent ≡ `''`.
  const absent = theftRow(1414)
  delete absent.openChangeRequestId
  FX.ledger = [{ ...theftRow(1412), openChangeRequestId: REQUEST_ID }, theftRow(1413), absent]

  // ---- 1. the open lanes: Shortage and Surplus ----
  scenario = {}
  await onTab('owing')
  check('🔑 the lane fixture holds marked rows — 2191\'s field rides the lane answer', FX.open.some((r) => r.openChangeRequestId))
  await marksMatch('Shortage tab', 'settlement-open', FX.open)
  const mark = page.locator('[data-region="settlement-open"] [data-testid="change-waiting-mark"]').first()
  check('the mark is named in words — aria-label "Change waiting"', (await mark.getAttribute('aria-label')) === 'Change waiting' && (await mark.getAttribute('role')) === 'img')
  check('…and its tooltip says what it means and where to look', /change request is waiting on this entry/i.test((await mark.getAttribute('title')) ?? ''))
  check('🚩 the mark is not a button — the row\'s own click opens the entry', (await page.locator('[data-region="settlement-open"] [data-testid="change-waiting-mark"] button, [data-region="settlement-open"] button [data-testid="change-waiting-mark"]').count()) === 0)
  await noRawKeys('the Shortage tab')
  await shot('351-owing')
  await onTab('owed')
  await marksMatch('Surplus tab', 'settlement-open', FX.open)

  // ---- 2. Awaiting approval and Theft ----
  await onTab('pending')
  const queue = await marksMatch('Awaiting approval tab', 'settlement-open', FX.pending)
  check('…1203 is the marked one in the queue', queue.find((r) => r.number.startsWith('1203'))?.marked === true && queue.filter((r) => r.marked).length === 1, JSON.stringify(queue))
  await noRawKeys('the Awaiting approval tab')
  await shot('351-pending')
  await onTab('theft')
  const thefts = await marksMatch('Theft tab', 'settlement-open', FX.open)
  check('…1413 marked, 1416 not', thefts.find((r) => r.number.startsWith('1413'))?.marked === true && thefts.find((r) => r.number.startsWith('1416'))?.marked === false, JSON.stringify(thefts))

  // ---- 3. Cash waiting ----
  await onTab('cash')
  const receipts = await drawn('settlement-open')
  const markedEntries = new Set(FX.open.filter((r) => r.openChangeRequestId).map((r) => String(r.entryNumber)))
  check('🚩 a receipt is not an entry: the cash tab draws no mark', receipts.length > 0 && receipts.every((r) => !r.marked), `${receipts.length} drawn`)
  check('…even on a receipt whose entry has a change waiting', FX.uncollected.some((u) => markedEntries.has(String(u.entryNumber))))

  // ---- 4. the Ledger ----
  await go(LEDGER_ROUTE)
  await page.locator('[data-region="ledger-kind"] [data-chip="THEFT"]').click()
  await page
    .waitForFunction(() => (document.querySelector('[data-region="settlement-ledger"]')?.textContent ?? '').includes('1414'), null, { timeout: 8000 })
    .catch(() => {})
  await settle()
  const ledger = await marksMatch('the Ledger', 'settlement-ledger', FX.ledger)
  check('🔑 an id marks (1412), \'\' does not (1413), and a row without the field marks nothing (1414)', ledger.find((r) => r.number.startsWith('1412'))?.marked === true && ledger.find((r) => r.number.startsWith('1413'))?.marked === false && ledger.find((r) => r.number.startsWith('1414'))?.marked === false, JSON.stringify(ledger))
  check('…the entry-number cell still reads the number first', ledger.every((r) => /^\d+$/.test(r.number)), JSON.stringify(ledger.map((r) => r.number)))
  await noRawKeys('the Ledger')
  await shot('351-ledger')

  // ---- 5. an SIS.Api older than the wave ----
  scenario = { oldServer: true }
  for (const tab of ['owing', 'pending', 'theft']) {
    await onTab(tab)
    const rows = await drawn('settlement-open')
    check(`🚩 old server, ${tab} tab: rows drawn and none marked`, rows.length > 0 && rows.every((r) => !r.marked), `${rows.length} drawn`)
  }
  await go(LEDGER_ROUTE)
  await page.locator('[data-region="ledger-kind"] [data-chip="THEFT"]').click()
  await appears('[data-region="settlement-ledger"] .ag-row')
  await settle()
  const oldLedger = await drawn('settlement-ledger')
  check('…and the Ledger too', oldLedger.length === 3 && oldLedger.every((r) => !r.marked), `${oldLedger.length} drawn`)

  // ---- 6. ----
  check('no page error anywhere', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
