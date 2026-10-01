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
// Ticket 343 — the change-request pane (W2–W8, 2191/2192's History + Raise):
//   7. the pane sits BELOW the approval pane and ABOVE the correction pane;
//   8. an accountant on an untouched entry: "Request a change", the form pre-filled with the
//      amount and Description, "lowest allowed" from History's spentAmount, Submit held while
//      nothing differs (also at holding scale), the raise sends ONLY the changed field, and the
//      waiting card is drawn from the answer BEFORE the held History re-read lands — then the
//      re-read's own row replaces it and the account is re-read;
//   9. a spent entry's floor (below it is refused in the form), a Description-only change, and
//      the form's state reset when the selection changes;
//  10. a finished entry says why; a supervisor reads "Change now"; a refused raise is said;
//  11. a 404 from History (bare) or Raise (envelope) says "not available yet" and nothing crashes.
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

/** 343's door state: what History and Raise answer, and what was asked of them. */
let cr = { histories: {}, historyCalls: [], raiseCalls: [], accountCalls: 0 }
const resetCr = (o = {}) => {
  cr = {
    histories: structuredClone(FX.histories),
    raise: () => FX.raisedAnswer,
    holdHistory: null,
    historyMissing: false,
    raiseMissing: false,
    historyCalls: [],
    raiseCalls: [],
    accountCalls: 0,
    ...o,
  }
}
const deferred = () => {
  let release
  const promise = new Promise((r) => (release = r))
  return { promise, release }
}

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
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(scenario.access ?? ACCOUNTANT))
    if (path === 'Settlement/Account') {
      cr.accountCalls++
      return route.fulfill(
        envelope(FX.accounts?.[q('storeId')] ?? { storeId: q('storeId'), storeName: '', entries: [], consumptions: [] }),
      )
    }
    if (path === 'Settlement/ChangeRequest/History') {
      const id = q('settlementEntryId')
      cr.historyCalls.push(id)
      const hold = cr.holdHistory
      if (hold) await hold.promise
      // ⚠️ A BARE 404 — what an SIS.Api without the route answers: no envelope at all.
      if (cr.historyMissing) return route.fulfill({ status: 404, contentType: 'text/plain', body: '' })
      return route.fulfill(envelope(cr.histories[id] ?? {}))
    }
    if (path === 'Settlement/Cancel' && cr.cancel) return route.fulfill(envelope(cr.cancel()))
    if (path === 'Settlement/ChangeRequest/Raise') {
      const body = route.request().postDataJSON()
      cr.raiseCalls.push(body)
      if (cr.raiseMissing)
        return route.fulfill(envelope(null, { status: 404, success: false, message: 'Not Found' }))
      return route.fulfill(envelope(cr.raise(body)))
    }
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

  // 343: the accounts and every History read, built IN the app from the contract-shaped
  // fixtures, so the stub serves exactly the shapes the pure suite is proven against.
  Object.assign(
    FX,
    await page.evaluate(async () => {
      const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
      const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
      const a0142 = structuredClone(acc.SETTLEMENT_ACCOUNTS['0142'])
      const a0688 = structuredClone(acc.SETTLEMENT_ACCOUNTS['0688'])
      const find = (a, n) => a.entries.find((e) => e.entryNumber === n)
      // A pending surplus on the same branch, so the approval pane is drawn above the new one.
      const e151 = find(a0142, 151)
      a0142.entries.push({
        ...e151,
        settlementEntryId: '01J9SETL0142P',
        entryNumber: 160,
        amount: 600,
        remainingAmount: 600,
        status: 'PENDING_APPROVAL',
      })
      // The SERVER's spent figures — 151's 200 is stated, never subtracted here.
      const spent = { 143: 0, 151: 200, 128: 0, 160: 0 }
      const histories = {}
      for (const e of a0142.entries)
        histories[e.settlementEntryId] = crf.historyOf(e, { spentAmount: spent[e.entryNumber] ?? 0 })
      for (const e of a0688.entries) histories[e.settlementEntryId] = crf.historyOf(e, { spentAmount: 0 })
      const e143 = find(a0142, 143)
      const waiting = crf.waitingRequestOn(e143, {
        changeRequestId: 'R-343',
        newAmount: 450,
        requestReason: 'typed 500 instead of 450',
      })
      return {
        accounts: { '0142': a0142, '0688': a0688 },
        histories,
        e143: e143.settlementEntryId,
        e151: e151.settlementEntryId,
        e128: find(a0142, 128).settlementEntryId,
        e143Reason: e143.reason,
        afterRaise143: crf.historyOf(e143, { spentAmount: 0, openRequest: waiting }),
        raisedAnswer: crf.raisedAnswerFor(e143, waiting, 0),
        belowSpent: crf.BELOW_SPENT_SAMPLE,
        requesterName: crf.REQUESTER.name,
      }
    }),
  )
  resetCr()

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

  // ======== Ticket 343 — the change-request pane ========
  scenario = {}
  resetCr()
  const pane = () => page.locator('[data-region="entry-change-request"]')
  const offerOf = async () => pane().getAttribute('data-offer')
  const tid = (id) => page.locator(`[data-testid="${id}"]`)
  const held = async () => (await tid('change-request-submit').getAttribute('aria-disabled')) === 'true'
  const textOf = async (id) => (await tid(id).count()) ? tid(id).first().innerText() : ''
  /** Select an entry by clicking its grid row — a selection change inside one page life. */
  const pickEntry = async (id, number) => {
    await page.locator(`[data-region="branch-account"] .ag-row[row-id="${id}"] [col-id="entryNumber"]`).first().click()
    await page
      .waitForFunction(
        (n) => document.querySelector('[data-region="entry-change-request"]')?.getAttribute('data-entry') === n,
        String(number),
        { timeout: 8000 },
      )
      .catch(() => {})
    await settle()
  }
  const crKeys = async (where) => {
    const text = await page.locator('body').innerText()
    check(`${where} → no raw t() key on screen`, !/\bchangeRequest\.[a-zA-Z]|settlement:/.test(text))
  }
  /** Is A before B in the document? */
  const before = (a, b) =>
    page.evaluate(([x, y]) => {
      const ex = document.querySelector(x)
      const ey = document.querySelector(y)
      return !!ex && !!ey && !!(ex.compareDocumentPosition(ey) & Node.DOCUMENT_POSITION_FOLLOWING)
    }, [a, b])

  // ---- 7. where the pane sits (W2) ----
  await go(`${ROUTE}?store=0142&entry=160`)
  await appears('[data-region="entry-change-request"][data-offer="ask"]')
  check('🔑 W2: the change-request pane sits BELOW the approval pane (a pending entry)…', await before('[data-region="entry-approval"]', '[data-region="entry-change-request"]'))
  check('…and ABOVE the correction pane', await before('[data-region="entry-change-request"]', '[data-region="entry-correction"]'))

  // ---- 8. an accountant asks to change an untouched entry ----
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-region="entry-change-request"][data-offer="ask"]')
  check('an untouched OPEN shortage offers "Request a change" to an accountant', (await textOf('change-request-open')).trim() === 'Request a change' && (await tid('change-request-open').getAttribute('data-mode')) === 'request')
  check('…and History was read for THIS entry', cr.historyCalls.includes(FX.e143))
  await tid('change-request-open').click()
  check('🔑 the form opens with the entry\'s current amount…', (await tid('change-request-amount').inputValue()) === '500')
  check('…and its Description filled in', (await tid('change-request-description').inputValue()) === FX.e143Reason)
  check('"lowest allowed" is History\'s spentAmount (0 here)', /Lowest allowed: 0\.00\b/.test(await textOf('change-request-floor')), await textOf('change-request-floor'))
  check('the Reason box is marked required', (await tid('change-request-reason-required').count()) === 1)
  check('🔑 Submit is held while nothing differs, and the form says so', (await held()) && (await tid('change-request-unchanged').count()) === 1)
  await tid('change-request-reason').fill('  typed 500 instead of 450  ')
  check('…still held with a Reason typed, as nothing differs', await held())
  await tid('change-request-amount').fill('500.0004')
  check('🔑 …and still held at 500.0004 — "nothing differs" is decided at holding scale', await held())
  await tid('change-request-amount').fill('450')
  check('a changed amount releases Submit and the "nothing differs" line goes', !(await held()) && (await tid('change-request-unchanged').count()) === 0)
  await crKeys('the change form')
  await shot('343-form')

  // Hold the re-read, so "drawn from the answer BEFORE the refetch" is observable.
  const hold = deferred()
  cr.holdHistory = hold
  const historyBefore = cr.historyCalls.length
  const accountBefore = cr.accountCalls
  cr.histories[FX.e143] = FX.afterRaise143
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-card"]')
  const sent = cr.raiseCalls.at(-1) ?? {}
  check('🔑 the raise sends ONLY the changed field — newAmount 450, newDescription null', sent.newAmount === 450 && sent.newDescription === null && sent.requestKind === 'CHANGE' && sent.settlementEntryId === FX.e143, JSON.stringify(sent))
  check('…with the Reason trimmed', sent.reason === 'typed 500 instead of 450')
  check('…and no field the contract did not name (no newBusinessDay on a shortage)', !('newBusinessDay' in sent))
  check('🔑 W8: the waiting card is drawn from the ANSWER while the History re-read is still held', cr.historyCalls.length > historyBefore && (await tid('change-request-card').getAttribute('data-request')) === 'R-343')
  check('…old → new, only what differs: the amount, not the Description', /500\.00 → 450\.00/.test(await textOf('change-request-card-amount')) && (await tid('change-request-card-description').count()) === 0, await textOf('change-request-card-amount'))
  check('…who asked (the session, until the server\'s row lands)', /Asked by msartawi/.test(await textOf('change-request-card-by')), await textOf('change-request-card-by'))
  check('…the Reason', (await textOf('change-request-card-reason')).trim() === 'typed 500 instead of 450')
  check('…and that the entry keeps working at its current figures until decided', /keeps working at its current figures until this request is decided/.test(await textOf('change-request-card-live')))
  check('the form is gone', (await tid('change-request-form').count()) === 0)
  hold.release()
  cr.holdHistory = null
  await page
    .waitForFunction((name) => (document.querySelector('[data-testid="change-request-card-by"]')?.textContent ?? '').includes(name), FX.requesterName, { timeout: 8000 })
    .catch(() => {})
  await settle()
  const by = await textOf('change-request-card-by')
  check('🔑 …then the re-read\'s own row replaces it: the requester and time are the server\'s', by.includes(FX.requesterName) && / on /.test(by), by)
  check('…and the account was re-read too (invalidateSettlement)', cr.accountCalls > accountBefore)
  check('the pane now reads "waiting"', (await offerOf()) === 'waiting')
  await crKeys('the waiting card')
  await shot('343-waiting')

  // ---- 9. a spent entry's floor; a Description-only change; state per entry ----
  await pickEntry(FX.e151, 151)
  check('🔑 another entry selected: nothing carried over from 143', (await offerOf()) === 'ask' && (await tid('change-request-form').count()) === 0 && (await tid('change-request-card').count()) === 0)
  await tid('change-request-open').click()
  check('…its form is its own: 320, and an empty Reason', (await tid('change-request-amount').inputValue()) === '320' && (await tid('change-request-reason').inputValue()) === '')
  check('🔑 the floor is History\'s spentAmount — 200.00, not anything computed from the row', /Lowest allowed: 200\.00\b/.test(await textOf('change-request-floor')), await textOf('change-request-floor'))
  await tid('change-request-reason').fill('surplus overstated')
  await tid('change-request-amount').fill('199.999')
  check('below the floor is refused in the form, and Submit held', (await held()) && /cannot go below it/.test(await textOf('change-request-amount-error')))
  await tid('change-request-amount').fill('0')
  check('…and so is a figure of zero', (await held()) && /greater than zero/.test(await textOf('change-request-amount-error')))
  await tid('change-request-amount').fill('200')
  check('exactly the floor is allowed', !(await held()))
  await pickEntry(FX.e128, 128)
  check('🔑 a selection change closes the form — the Reason typed for 151 goes with it', (await tid('change-request-form').count()) === 0)
  await tid('change-request-open').click()
  check('…open again on 128: an empty Reason', (await tid('change-request-reason').inputValue()) === '')
  await tid('change-request-description').fill('  adjustment for last month — corrected  ')
  await tid('change-request-reason').fill('description was incomplete')
  cr.raise = () => ({ ...FX.raisedAnswer, settlementEntryId: FX.e128, entryNumber: 128, changeRequestId: 'R-128', amount: 75.5, remainingAmount: 75.5 })
  // Held again: this stub's History for 128 never learns of the request, so the drawn card
  // is what is checked — the re-read replacing it is section 8's proof.
  const hold128 = deferred()
  cr.holdHistory = hold128
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-card"][data-request="R-128"]')
  const sent128 = cr.raiseCalls.at(-1) ?? {}
  check('🔑 a Description-only change sends newAmount null and the trimmed Description', sent128.newAmount === null && sent128.newDescription === 'adjustment for last month — corrected', JSON.stringify(sent128))
  check('…and the card names the Description, not the amount', (await tid('change-request-card-description').count()) === 1 && (await tid('change-request-card-amount').count()) === 0)
  hold128.release()
  cr.holdHistory = null
  await settle()

  // ---- 10. finished; a supervisor; a refused raise ----
  await go(`${ROUTE}?store=0688&entry=147`)
  await appears('[data-testid="change-request-finished"]')
  check('a cancelled entry offers nothing and says why', (await offerOf()) === 'finished' && /was cancelled/.test(await textOf('change-request-finished')) && (await tid('change-request-open').count()) === 0)

  scenario = { access: { ...ACCOUNTANT, canSuperviseSettlement: true } }
  resetCr()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  check('a supervisor is offered "Change now" (the offer cell 348 words)', (await textOf('change-request-open')).trim() === 'Change now' && (await tid('change-request-open').getAttribute('data-mode')) === 'now')

  scenario = {}
  resetCr({ raise: () => FX.belowSpent })
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  await tid('change-request-open').click()
  await tid('change-request-amount').fill('100')
  await tid('change-request-reason').fill('x')
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-notice"]')
  check('a refused raise is said, with its code, and the form stays', (await tid('change-request-notice').getAttribute('data-code')) === 'BELOW_SPENT' && (await tid('change-request-form').count()) === 1 && (await tid('change-request-card').count()) === 0)
  await crKeys('a refused raise')

  // A raise refused because a request now waits: the re-read (always, a refusal too) turns
  // the form into that request's card. (344 words the code; this is the re-read.)
  resetCr({
    raise: () => {
      cr.histories[FX.e143] = FX.afterRaise143
      return { ...FX.belowSpent, refusalReason: 'CHANGE_ALREADY_OPEN', changeRequestId: 'R-343', settlementEntryId: FX.e143, entryNumber: 143, amount: 500, remainingAmount: 500, spentAmount: 0 }
    },
  })
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  await tid('change-request-open').click()
  await tid('change-request-amount').fill('400')
  await tid('change-request-reason').fill('x')
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-card"][data-request="R-343"]')
  check('🔑 a raise refused CHANGE_ALREADY_OPEN re-reads History, and the waiting card replaces the form', (await tid('change-request-form').count()) === 0 && (await offerOf()) === 'waiting')

  // A supervisor's Cancel in the correction pane re-reads History too — the pane must not
  // keep offering a change on an entry that is now finished.
  scenario = { access: { ...ACCOUNTANT, canSuperviseSettlement: true } }
  resetCr()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  const a0142 = FX.accounts['0142']
  const e143Row = a0142.entries.find((e) => e.settlementEntryId === FX.e143)
  cr.cancel = () => {
    e143Row.status = 'CANCELLED'
    cr.histories[FX.e143] = { ...cr.histories[FX.e143], entryStatus: 'CANCELLED' }
    return { accepted: true, refusalReason: '', remainingAmount: 500, status: 'CANCELLED' }
  }
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('posted against the wrong branch')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('[data-testid="change-request-finished"]')
  check('🔑 after a Cancel elsewhere on the panel, the pane re-reads History and offers nothing', (await offerOf()) === 'finished' && (await tid('change-request-open').count()) === 0)
  e143Row.status = 'OPEN'
  cr.cancel = null
  scenario = {}

  // ---- 11. SIS.Api without the wave ----
  resetCr({ historyMissing: true })
  const errorsBefore404 = errors.length
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-unavailable"]')
  check('🔑 a bare 404 on History: "not available yet", never a crash', (await offerOf()) === 'not-shipped' && /not available yet/.test(await textOf('change-request-unavailable')))
  check('…and the rest of the panel works as before (the correction pane is drawn)', (await page.locator('[data-region="entry-correction"]').count()) === 1)
  check('…one History call — a 404 is not retried', cr.historyCalls.length === 1, String(cr.historyCalls.length))
  await crKeys('the unavailable pane')
  await shot('343-unavailable')
  resetCr({ raiseMissing: true })
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  await tid('change-request-open').click()
  await tid('change-request-amount').fill('450')
  await tid('change-request-reason').fill('x')
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-unavailable"]')
  check('a 404 envelope on Raise says the same', (await offerOf()) === 'not-shipped')
  check('…and neither 404 put an error on the page', errors.length === errorsBefore404, errors.slice(errorsBefore404, errorsBefore404 + 3).join(' | '))

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
