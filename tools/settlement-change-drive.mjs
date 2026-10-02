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
// Ticket 344 — every refusal said by its code, with its next step (W7):
//  12. BELOW_SPENT refills the floor from the ANSWER's spentAmount (before the held re-read
//      lands), keeps the form as typed and holds Submit below it;
//  13. CHANGE_ALREADY_OPEN opens the request it names; with '' it re-reads History;
//  14. NO_CHANGE keeps the form; ENTRY_NOT_OPEN closes the pane; ENTRY_FINAL redraws at once;
//      an unknown code is named;
//  15. a 400 lands on its box (amount, Reason, the form), clears on the next keystroke, and an
//      unknown 400 keeps the server's own message. No sentence is the server's `message`.
//
// Ticket 345 — the requester withdraws their own waiting request (W6, 2194's Withdraw):
//  16. the requester's card shows Withdraw (Auth/Me's userId equals requestedByStaffId — the
//      match is STUBBED, the live check of the claim is still open); another accountant's
//      request shows none; a supervisor sees it only on a request they raised;
//  17. an accepted withdraw sends only { changeRequestId }, drops the card from the ANSWER
//      while the History re-read is still held, then re-reads History and the account;
//  18. NOT_REQUESTER and CHANGE_NOT_OPEN ("SUPERSEDED") are said from 344's map; after
//      NOT_REQUESTER the card stays and Withdraw is no longer offered on it; an accepted
//      answer not saying WITHDRAWN is "unconfirmed"; a 400 is said in 344's words, a bare
//      403 is named, and a 404 says "not available yet".
//
// Ticket 346 — a supervisor approves or rejects a waiting request (W6/W8, 2191–2195's Approve/Reject):
//  19. a supervisor's card shows Approve and Reject beside what the branch has spent TODAY
//      (History's spentAmount, newer than the account row); an accountant sees neither;
//  20. Approve sends only { changeRequestId }, and the pane redraws from the APPLIED answer
//      (the card gone, the corrected amount in the form) while the History re-read is held;
//      then History and the account are re-read;
//  21. a refused approve (BELOW_SPENT with today's spentAmount, CHANGE_STALE) keeps the card
//      OPEN with 344's sentence and the "reject it" step; ENTRY_FINAL redraws as finished;
//  22. Reject opens a required Reason box, sends { changeRequestId, reason }, and a 400 on
//      the Reason lands on that box;
//  23. a bare 403 is named, the probe re-read, and the buttons go; a 404 says "not available yet".
//
// Ticket 347 — delete, and "Reduce it to X" on a spent entry (W5, 2193's delete):
//  24. an untouched entry offers "Request delete" beside "Request a change" (a supervisor:
//      "Delete now"); the form asks for a Reason only, and the raise posts { settlementEntryId,
//      requestKind: "DELETE", reason } and NO figure field; the waiting card is a delete's,
//      drawn from the answer while the History re-read is held;
//  25. a spent entry offers no delete: the sentence, and "Reduce it to X" pre-fills the change
//      form with X, which posts newAmount X; a wholly spent entry says the sentence alone;
//  26. a stubbed DELETE_SPENT does the same from the ANSWER's spentAmount — said once, the
//      delete form gone, the refused delete's Reason carried into the change form; a re-read
//      stating a higher spent figure moves the offer with it; a wholly spent one offers none;
//  27. an approved delete redraws the entry as cancelled from the answer, before the re-read;
//      a 400 on a delete lands on its Reason box or the form's foot; no request is "cancelled".
//
// Ticket 348 — a supervisor's own change or delete applies at once (W1/W4, 2194):
//  28. a supervisor reads "Change now" / "Delete now", and both forms say "Applies
//      immediately — no approval step" before the press, the Reason still required; an
//      accountant's forms never say it;
//  29. an APPLIED answer redraws the corrected (or cancelled) entry with NO card while the
//      History re-read is held; a supervisor's raise answered OPEN draws the card as for
//      anyone; a refusal (CHANGE_STALE, changeRequestId '') stores nothing and draws no card;
//  30. a supervisor's raise refused CHANGE_ALREADY_OPEN opens the accountant's card with
//      Approve / Reject and says to decide it first; approving it offers "Change now" again.
//
// Ticket 349 — a theft's amount or business day (W4, 2195):
//  31. a theft's change form shows the post dialog's day box filled with the theft's day; a
//      shortage's form shows none; naming only the day it has is "nothing differs"; a
//      day-move posts the bare date (and newBusinessDay null on an amount-only change), and
//      the card names old → new day from the answer while the History re-read is held;
//  32. THEFT_DAY_COLLECTED on a raise is said by its code in the notice, the form kept as
//      typed (the web never shadows the collected day); on an approve the card stays OPEN
//      with the "reject it" step;
//  33. the 400s SettlementTheftDayNotClosed / SettlementTheftBusinessDayRequired land on the
//      day box in 344's words and clear on the next keystroke; an emptied box is held;
//  34. an approved day-move redraws the new day from the answer before the re-read lands.
//
// Ticket 352 — a direct act warns that a waiting request will be superseded (W12, 2194's direct doors):
//  35. the correction pane's Cancel confirm step says "the waiting change request will be
//      closed as superseded" only while History has an openRequest; a refused Cancel leaves
//      the card OPEN and says nothing new; an accepted one re-reads History, and the pane
//      shows the request SUPERSEDED (then the audit column carries it);
//  36. the Write off confirm step: the same sentence, only while a request waits;
//  37. the entry panel's Approve / Reject dialog of a pending entry: the same, from History;
//      an accepted Approve re-reads History and the pane shows the request superseded;
//  38. the Awaiting approval lane's Approve / Reject: the sentence only on a row whose
//      openChangeRequestId is not '' (351's field);
//  39. Bulk Cancel: "any change request waiting on an entry this withdraws…", unconditionally (nothing
//      enumerates a batch) — and never for an accountant, who has no act to confirm.
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
/** Every read of the Collections probe — a bare 403 must re-read it (W1). */
let accessCalls = 0

/** 343's door state: what History and Raise answer, and what was asked of them. */
let cr = { histories: {}, historyCalls: [], raiseCalls: [], accountCalls: 0 }
const resetCr = (o = {}) => {
  cr = {
    histories: structuredClone(FX.histories),
    raise: () => FX.raisedAnswer,
    holdHistory: null,
    historyMissing: false,
    raiseMissing: false,
    withdraw: () => ({}),
    withdrawMissing: false,
    withdrawCalls: [],
    // 346: Approve / Reject — what each answers, and every { door, body } sent.
    approve: () => ({}),
    reject: () => ({}),
    decideCalls: [],
    // 352: what each direct door answers (by path), and every { path, body } sent.
    direct: {},
    directCalls: [],
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
    if (path === 'CollectionWeb/Access') {
      accessCalls++
      return route.fulfill(envelope(scenario.access ?? ACCOUNTANT))
    }
    if (path === 'Settlement/ChangeRequest/Approve' || path === 'Settlement/ChangeRequest/Reject') {
      const door = path.endsWith('Approve') ? 'approve' : 'reject'
      const body = route.request().postDataJSON()
      cr.decideCalls.push({ door, body })
      if (cr.decideMissing)
        return route.fulfill(envelope(null, { status: 404, success: false, message: 'Not Found' }))
      // The bare 403 a session without settlement supervision gets — no body (2191).
      if (cr.decideForbidden) return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      if (cr.decideInvalid) {
        const { code, message } = cr.decideInvalid
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message,
            errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }],
          }),
        )
      }
      return route.fulfill(envelope(cr[door](body)))
    }
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
    // 352: the direct doors (Cancel, CloseOut, Approve, Reject, Bulk/Cancel) — unchanged shapes.
    if (cr.direct?.[path]) {
      cr.directCalls.push({ path, body: route.request().postDataJSON() })
      return route.fulfill(envelope(cr.direct[path]()))
    }
    if (path === 'Settlement/ChangeRequest/Raise') {
      const body = route.request().postDataJSON()
      cr.raiseCalls.push(body)
      if (cr.raiseMissing)
        return route.fulfill(envelope(null, { status: 404, success: false, message: 'Not Found' }))
      // 344: a 400 envelope — the code in `errors[0].errorCode`, as every Settlement door sends it.
      if (cr.raiseInvalid) {
        const { code, message } = cr.raiseInvalid
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message,
            errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }],
          }),
        )
      }
      return route.fulfill(envelope(cr.raise(body)))
    }
    if (path === 'Settlement/ChangeRequest/Withdraw') {
      const body = route.request().postDataJSON()
      cr.withdrawCalls.push(body)
      if (cr.withdrawMissing)
        return route.fulfill(envelope(null, { status: 404, success: false, message: 'Not Found' }))
      if (cr.withdrawForbidden) return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      if (cr.withdrawInvalid) {
        const { code, message } = cr.withdrawInvalid
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message,
            errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }],
          }),
        )
      }
      return route.fulfill(envelope(cr.withdraw(body)))
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
  check('…and is never told a supervisor will approve it — their change applies at once', /applies to the entry at once/.test(await textOf('change-request-why')) && !/A supervisor approves or rejects it/.test(await textOf('change-request-why')))

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

  // ======== Ticket 344 — every refusal said by its code ========
  /** A refused raise about entry 143 — 2192's sample shape, the entry's own figures. */
  const about143 = (o = {}) => ({
    ...FX.belowSpent,
    changeRequestId: '',
    requestStatus: '',
    settlementEntryId: FX.e143,
    entryNumber: 143,
    amount: 500,
    remainingAmount: 500,
    spentAmount: 0,
    description: FX.e143Reason,
    ...o,
  })
  /** Open 143's form, type, and press Submit — the History re-read optionally held. */
  const raise143 = async (amount, { hold = null, reason = 'figure was mistyped' } = {}) => {
    await go(`${ROUTE}?store=0142&entry=143`)
    await appears('[data-testid="change-request-open"]')
    await tid('change-request-open').click()
    await tid('change-request-amount').fill(amount)
    await tid('change-request-reason').fill(reason)
    cr.holdHistory = hold
    await tid('change-request-submit').click()
  }
  const noticeOf = async () => ({
    code: await tid('change-request-notice').getAttribute('data-code'),
    step: await tid('change-request-notice').getAttribute('data-step'),
    text: await textOf('change-request-notice'),
  })
  const SERVER_WORDS = 'Server sentence that must not be shown'

  // ---- 12. BELOW_SPENT refills the floor ----
  resetCr({
    raise: () => {
      // A till spent 350 since the pane read 0 — History will say so too, once re-read.
      cr.histories[FX.e143] = { ...cr.histories[FX.e143], remainingAmount: 150, spentAmount: 350 }
      return about143({ refusalReason: 'BELOW_SPENT', remainingAmount: 150, spentAmount: 350 })
    },
  })
  const holdBelow = deferred()
  await raise143('300', { hold: holdBelow })
  await appears('[data-testid="change-request-notice"]')
  let n = await noticeOf()
  check('🔑 BELOW_SPENT is said by its code, naming the answer\'s spent figure', n.code === 'BELOW_SPENT' && n.step === 'refill-floor' && /has spent 350\.00 from entry 143, so its amount cannot go below 350\.00/.test(n.text), JSON.stringify(n))
  check('🔑 …the floor is refilled from the ANSWER while the History re-read is still held', /Lowest allowed: 350\.00\b/.test(await textOf('change-request-floor')), await textOf('change-request-floor'))
  check('…the form stays, as typed', (await tid('change-request-form').count()) === 1 && (await tid('change-request-amount').inputValue()) === '300')
  check('…and the typed 300 is now below the floor: refused in the form, Submit held', (await held()) && /cannot go below it/.test(await textOf('change-request-amount-error')))
  await crKeys('a BELOW_SPENT refusal')
  await shot('344-below-spent')
  holdBelow.release()
  cr.holdHistory = null
  await settle()
  check('…and the re-read keeps the floor (History now says 350)', /Lowest allowed: 350\.00\b/.test(await textOf('change-request-floor')))
  await tid('change-request-amount').fill('350')
  check('…asking for exactly the refilled floor is allowed', !(await held()))

  // ---- 13. CHANGE_ALREADY_OPEN opens the named request; '' re-reads ----
  const otherWaiting = { ...FX.afterRaise143.openRequest, changeRequestId: 'R-777', requestReason: 'raised by a colleague' }
  resetCr({
    raise: () => {
      cr.histories[FX.e143] = { ...FX.afterRaise143, openRequest: otherWaiting, requests: [otherWaiting] }
      return about143({ refusalReason: 'CHANGE_ALREADY_OPEN', changeRequestId: 'R-777', requestStatus: 'OPEN' })
    },
  })
  await raise143('420')
  await appears('[data-testid="change-request-card"][data-request="R-777"]')
  n = await noticeOf()
  check('🔑 CHANGE_ALREADY_OPEN opens the request it names: R-777\'s card, the form gone', (await tid('change-request-card').getAttribute('data-request')) === 'R-777' && (await tid('change-request-form').count()) === 0 && (await offerOf()) === 'waiting')
  check('…and says so by its code', n.code === 'CHANGE_ALREADY_OPEN' && n.step === 'open-request' && /already waiting on entry 143\. It is decided or withdrawn/.test(n.text), JSON.stringify(n))
  check('…that request\'s own Reason is drawn, not the one just typed', (await textOf('change-request-card-reason')).trim() === 'raised by a colleague')
  await crKeys('CHANGE_ALREADY_OPEN')
  await shot('344-already-open')

  resetCr({
    raise: () => {
      cr.histories[FX.e143] = FX.afterRaise143
      // The History reads made BEFORE this answer — the re-read must come after it.
      cr.callsAtRaise = cr.historyCalls.length
      return about143({ refusalReason: 'CHANGE_ALREADY_OPEN' })
    },
  })
  await raise143('420')
  await appears('[data-testid="change-request-card"]')
  n = await noticeOf()
  check('🔑 CHANGE_ALREADY_OPEN with id \'\' re-reads History, which draws what waits now', n.step === 'reread' && /raised at the same moment/.test(n.text) && (await offerOf()) === 'waiting' && cr.historyCalls.length > cr.callsAtRaise, JSON.stringify(n))

  // ---- 14. NO_CHANGE stays; ENTRY_NOT_OPEN closes; ENTRY_FINAL redraws; unknown is named ----
  resetCr({ raise: () => about143({ refusalReason: 'NO_CHANGE' }) })
  await raise143('450')
  await appears('[data-testid="change-request-notice"]')
  n = await noticeOf()
  check('🔑 NO_CHANGE keeps the form, as typed', (await tid('change-request-form').count()) === 1 && (await tid('change-request-amount').inputValue()) === '450' && (await tid('change-request-reason').inputValue()) === 'figure was mistyped')
  check('…and says nothing would change', n.code === 'NO_CHANGE' && n.step === 'stay' && /Nothing would change/.test(n.text), JSON.stringify(n))

  resetCr({ raise: () => about143({ refusalReason: 'ENTRY_NOT_OPEN', settlementEntryId: '', entryNumber: 0, entryStatus: '' }) })
  await raise143('450')
  await appears('[data-region="entry-change-request"][data-offer="gone"]')
  n = await noticeOf()
  check('🔑 ENTRY_NOT_OPEN closes the pane: the sentence alone, nothing to press', /Entry 143 no longer exists/.test(n.text) && n.step === 'close' && (await tid('change-request-form').count()) === 0 && (await tid('change-request-open').count()) === 0, JSON.stringify(n))

  const holdFinal = deferred()
  resetCr({ raise: () => about143({ refusalReason: 'ENTRY_FINAL', entryStatus: 'CANCELLED' }) })
  await raise143('450', { hold: holdFinal })
  await appears('[data-testid="change-request-finished"]')
  n = await noticeOf()
  check('🔑 ENTRY_FINAL redraws from the answer at once — the finished sentence before the re-read lands', (await offerOf()) === 'finished' && /was cancelled/.test(await textOf('change-request-finished')) && n.code === 'ENTRY_FINAL' && n.step === 'redraw', JSON.stringify(n))
  holdFinal.release()
  cr.holdHistory = null
  await settle()

  resetCr({ raise: () => about143({ refusalReason: 'SOMETHING_NEW' }) })
  await raise143('450')
  await appears('[data-testid="change-request-notice"]')
  n = await noticeOf()
  check('an unknown 200 code is named, and the form stays', /The server answered SOMETHING_NEW/.test(n.text) && n.step === 'none' && (await tid('change-request-form').count()) === 1, JSON.stringify(n))

  // ---- 15. a 400 lands on its box ----
  resetCr({ raiseInvalid: { code: 'SettlementAmountRoundsToZero', message: SERVER_WORDS } })
  // 0.4 passes the form (it holds money at three places) and rounds to nothing at SAR's whole riyals.
  await raise143('0.4')
  await appears('[data-testid="change-request-amount-error"]')
  check('🔑 SettlementAmountRoundsToZero lands on the amount box, in our words', /rounds to nothing in the branch's currency/.test(await textOf('change-request-amount-error')) && (await tid('change-request-amount').getAttribute('aria-invalid')) === 'true', await textOf('change-request-amount-error'))
  check('…no notice, no server sentence, and the form stays', (await tid('change-request-notice').count()) === 0 && !(await page.locator('body').innerText()).includes(SERVER_WORDS) && (await tid('change-request-form').count()) === 1)
  await crKeys('a 400 on the amount')
  await shot('344-400-amount')
  await tid('change-request-amount').fill('4')
  check('…and the next keystroke clears it', (await tid('change-request-amount-error').count()) === 0)

  resetCr({ raiseInvalid: { code: 'SettlementChangeReasonRequired', message: SERVER_WORDS } })
  await raise143('450')
  await appears('[data-testid="change-request-reason-error"]')
  check('SettlementChangeReasonRequired lands on the Reason box', /A Reason is required/.test(await textOf('change-request-reason-error')) && (await tid('change-request-amount-error').count()) === 0)

  resetCr({ raiseInvalid: { code: 'SettlementChangeBodyRequired', message: SERVER_WORDS } })
  await raise143('450')
  await appears('[data-testid="change-request-form-error"]')
  check('a body code no box can fix lands on the form', (await tid('change-request-form-error').getAttribute('data-code')) === 'SettlementChangeBodyRequired' && /nothing was done/.test(await textOf('change-request-form-error')))

  resetCr({ raiseInvalid: { code: 'SettlementSomethingNew', message: 'The server says no.' } })
  await raise143('450')
  await appears('[data-testid="change-request-notice"]')
  check('🔑 an unknown 400 falls back to the server\'s message — the only place it is drawn', (await textOf('change-request-notice')).trim() === 'The server says no.' && (await tid('change-request-form').count()) === 1)
  await crKeys('ticket 344')

  // ======== Ticket 345 — the requester withdraws their own waiting request ========
  // 🚩 The match is STUBBED: Auth/Me answers userId "msartawi", and the request this
  // session raised carries requestedByStaffId "msartawi". That the two are the same claim
  // on a live SIS.Api is 345's open question.
  Object.assign(
    FX,
    await page.evaluate(async ([e143, e151]) => {
      const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
      const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
      const a = acc.SETTLEMENT_ACCOUNTS['0142']
      const row143 = a.entries.find((e) => e.settlementEntryId === e143)
      const row151 = a.entries.find((e) => e.settlementEntryId === e151)
      const mine = crf.waitingRequestOn(row143, {
        changeRequestId: 'R-345',
        newAmount: 450,
        requestedByStaffId: 'msartawi',
        requestedByName: 'msartawi',
        requestReason: 'typed 500 instead of 450',
      })
      // Another accountant's request — the fixture's own requester (30117).
      const theirs = crf.waitingRequestOn(row151, { changeRequestId: 'R-151', newAmount: 300 })
      return {
        mine345: mine,
        withMine143: crf.historyOf(row143, { spentAmount: 0, openRequest: mine }),
        withTheirs151: crf.historyOf(row151, { spentAmount: 200, openRequest: theirs }),
        quiet143: crf.historyOf(row143, { spentAmount: 0, requests: [{ ...mine, status: 'WITHDRAWN' }] }),
        withdrawn143: crf.withdrawnAnswerFor(row143, mine, 0),
        notRequester143: { ...crf.NOT_REQUESTER_SAMPLE, changeRequestId: 'R-345', settlementEntryId: e143, entryNumber: 143, amount: row143.amount, remainingAmount: row143.remainingAmount, description: row143.reason },
      }
    }, [FX.e143, FX.e151]),
  )
  /** 143 with this session's request waiting, 151 with another accountant's. */
  const resetWithdraw = (o = {}) => {
    resetCr(o)
    cr.histories[FX.e143] = structuredClone(FX.withMine143)
    cr.histories[FX.e151] = structuredClone(FX.withTheirs151)
  }
  const openCard = async (entry = 143) => {
    await go(`${ROUTE}?store=0142&entry=${entry}`)
    await appears('[data-testid="change-request-card"]')
  }

  // ---- 16. who is offered Withdraw ----
  scenario = {}
  resetWithdraw()
  await openCard(143)
  check('🔑 the requester\'s card shows Withdraw (session userId = requestedByStaffId, stubbed)', (await tid('change-request-withdraw').count()) === 1 && (await textOf('change-request-withdraw')).trim() === 'Withdraw')
  check('…on the card of the request this session raised', (await tid('change-request-card').getAttribute('data-request')) === 'R-345')
  await crKeys('the requester\'s card')
  await shot('345-requester')
  await pickEntry(FX.e151, 151)
  await appears('[data-testid="change-request-card"][data-request="R-151"]')
  check('🔑 another accountant\'s request: the card, and NO Withdraw', (await tid('change-request-card').getAttribute('data-request')) === 'R-151' && (await tid('change-request-withdraw').count()) === 0)
  check('…and nothing was withdrawn by looking', cr.withdrawCalls.length === 0)

  scenario = { access: { ...ACCOUNTANT, canSuperviseSettlement: true } }
  resetWithdraw()
  await openCard(143)
  check('a supervisor sees Withdraw on a request they raised themselves', (await tid('change-request-withdraw').count()) === 1)
  await pickEntry(FX.e151, 151)
  await appears('[data-testid="change-request-card"][data-request="R-151"]')
  check('…and not on an accountant\'s', (await tid('change-request-withdraw').count()) === 0)
  scenario = {}

  // ---- 17. an accepted withdraw ----
  resetWithdraw({
    withdraw: () => {
      cr.histories[FX.e143] = structuredClone(FX.quiet143)
      return FX.withdrawn143
    },
  })
  await openCard(143)
  const holdWithdraw = deferred()
  const historyBeforeW = cr.historyCalls.length
  const accountBeforeW = cr.accountCalls
  cr.holdHistory = holdWithdraw
  await tid('change-request-withdraw').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="change-request-card"]'), null, { timeout: 8000 }).catch(() => {})
  check('🔑 Withdraw sends ONLY { changeRequestId }', JSON.stringify(cr.withdrawCalls.at(-1)) === JSON.stringify({ changeRequestId: 'R-345' }), JSON.stringify(cr.withdrawCalls.at(-1)))
  check('🔑 W8: the card is gone from the ANSWER while the History re-read is still held', (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask' && cr.historyCalls.length > historyBeforeW)
  check('…the entry offers a change again, at its unchanged figures', (await tid('change-request-open').count()) === 1)
  check('…and the toast says withdrawn, never cancelled', /Your change request on entry 143 was withdrawn\./.test(await page.locator('body').innerText()) && !/cancelled/i.test(await page.locator('[data-sonner-toaster]').innerText().catch(() => '')))
  await shot('345-withdrawn')
  holdWithdraw.release()
  cr.holdHistory = null
  await settle()
  check('…then the re-read lands with no card', (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask')
  check('…and the account was re-read too', cr.accountCalls > accountBeforeW)
  await crKeys('an accepted withdraw')

  // ---- 18. refusals, said from 344's map ----
  resetWithdraw({ withdraw: () => FX.notRequester143 })
  await openCard(143)
  await tid('change-request-withdraw').click()
  await appears('[data-testid="change-request-notice"]')
  n = await noticeOf()
  check('🔑 NOT_REQUESTER is said by its code', n.code === 'NOT_REQUESTER' && n.step === 'not-requester' && /Only the person who raised this change request can withdraw it\. It stays waiting/.test(n.text), JSON.stringify(n))
  await settle()
  check('🔑 …the card stays, still waiting, and Withdraw is no longer offered on it', (await tid('change-request-card').getAttribute('data-request')) === 'R-345' && (await tid('change-request-withdraw').count()) === 0)
  await crKeys('NOT_REQUESTER')
  await shot('345-not-requester')

  resetWithdraw({
    withdraw: () => {
      // A supervisor's direct act superseded it meanwhile — History says nothing waits now.
      cr.histories[FX.e143] = structuredClone(FX.quiet143)
      return { ...FX.notRequester143, refusalReason: 'CHANGE_NOT_OPEN', requestStatus: 'SUPERSEDED' }
    },
  })
  await openCard(143)
  await tid('change-request-withdraw').click()
  await appears('[data-testid="change-request-notice"]')
  n = await noticeOf()
  check('🔑 CHANGE_NOT_OPEN ("SUPERSEDED") is said by its code, naming which end it met', n.code === 'CHANGE_NOT_OPEN' && n.step === 'redraw' && /superseded by a supervisor's direct act/.test(n.text), JSON.stringify(n))
  await settle()
  check('…and the re-read draws what is true: no card', (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask')
  check('no sentence anywhere calls a request "cancelled"', !/request (was|is) cancelled/i.test(await page.locator('body').innerText()))

  resetWithdraw({ withdraw: () => ({ ...FX.withdrawn143, requestStatus: 'OPEN' }) })
  await openCard(143)
  await tid('change-request-withdraw').click()
  await appears('[data-testid="change-request-notice"]')
  check('🚩 an accepted answer that does not say WITHDRAWN is neither withdrawn nor a refusal: it says so, and the card stays', /did not confirm the request was withdrawn/.test(await textOf('change-request-notice')) && !(await tid('change-request-notice').getAttribute('data-code')) && (await tid('change-request-card').count()) === 1 && !/Your change request on entry 143 was withdrawn/.test(await page.locator('body').innerText()))

  resetWithdraw({ withdrawInvalid: { code: 'SettlementChangeRequestRequired', message: SERVER_WORDS } })
  await openCard(143)
  await tid('change-request-withdraw').click()
  await appears('[data-testid="change-request-notice"]')
  check('a 400 on Withdraw is said in the notice line in 344\'s words, never the server\'s', (await tid('change-request-notice').getAttribute('data-code')) === 'SettlementChangeRequestRequired' && /not told which change request/.test(await textOf('change-request-notice')) && !(await page.locator('body').innerText()).includes(SERVER_WORDS))

  resetWithdraw({ withdrawForbidden: true })
  await openCard(143)
  await tid('change-request-withdraw').click()
  await page.waitForFunction(() => /was not withdrawn/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {})
  check('a bare 403 on Withdraw is named: the request was not withdrawn', /the change request was not withdrawn/.test(await page.locator('body').innerText()))

  resetWithdraw({ withdrawMissing: true })
  const errorsBeforeW404 = errors.length
  await openCard(143)
  await tid('change-request-withdraw').click()
  await appears('[data-testid="change-request-unavailable"]')
  check('a 404 on Withdraw says "not available yet", never a crash', (await offerOf()) === 'not-shipped' && errors.length === errorsBeforeW404)
  await crKeys('ticket 345')

  // ======== Ticket 346 — a supervisor approves or rejects a waiting request ========
  const SUPERVISOR = { ...ACCOUNTANT, canSuperviseSettlement: true }
  Object.assign(
    FX,
    await page.evaluate(async ([e151]) => {
      const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
      const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
      const row151 = acc.SETTLEMENT_ACCOUNTS['0142'].entries.find((e) => e.settlementEntryId === e151)
      // Another accountant's request: 320 → 300 (the fixture's requester, 30117).
      const theirs = crf.waitingRequestOn(row151, { changeRequestId: 'R-151', newAmount: 300 })
      // 🔑 TODAY's figures: a till has spent 5 more since the account row (320 / 120) was read.
      const today151 = { ...row151, remainingAmount: 115 }
      const corrected151 = { ...row151, amount: 300, remainingAmount: 95 }
      return {
        theirs151: theirs,
        today151: crf.historyOf(today151, { spentAmount: 205, openRequest: theirs }),
        // The server's corrected figures, stated — never derived here from what was asked.
        approved151: crf.approvedAnswerFor(row151, theirs, 205, { amount: 300, remainingAmount: 95 }),
        afterApprove151: crf.historyOf(corrected151, { spentAmount: 205, requests: [{ ...theirs, status: 'APPLIED' }] }),
        rejected151: crf.rejectedAnswerFor(today151, theirs, 205),
        afterReject151: crf.historyOf(today151, { spentAmount: 205, requests: [{ ...theirs, status: 'REJECTED' }] }),
        // 2192's BELOW_SPENT sample, about 151: a till spent past 300 while the request waited.
        belowSpent151: { ...crf.BELOW_SPENT_SAMPLE, changeRequestId: 'R-151', settlementEntryId: e151, entryNumber: 151, amount: 320, remainingAmount: 10, spentAmount: 310, description: row151.reason },
      }
    }, [FX.e151]),
  )
  /** 151 with another accountant's request waiting, read TODAY (spent 205). */
  const resetDecide = (o = {}) => {
    resetCr(o)
    cr.histories[FX.e151] = structuredClone(FX.today151)
  }
  const decided = (door) => cr.decideCalls.filter((c) => c.door === door).at(-1)

  // ---- 19. who is offered Approve / Reject, beside today's figures ----
  scenario = { access: SUPERVISOR }
  resetDecide()
  await openCard(151)
  check('🔑 a supervisor\'s card shows Approve and Reject', (await tid('change-request-approve').count()) === 1 && (await tid('change-request-reject').count()) === 1 && (await tid('change-request-card').getAttribute('data-request')) === 'R-151')
  check('…and no Withdraw on an accountant\'s request', (await tid('change-request-withdraw').count()) === 0)
  const spentNow = await textOf('change-request-spent-now')
  check('🔑 story 16: what the branch has spent TODAY — History\'s 205.00, not the account row\'s 200', /spent 205\.00 from entry 151, which stands at 320\.00/.test(spentNow), spentNow)
  check('…and nothing was decided by looking', cr.decideCalls.length === 0)
  await crKeys('the supervisor\'s card')
  await shot('346-supervisor')

  scenario = {}
  resetDecide()
  await openCard(151)
  check('🚩 an accountant sees the card and neither Approve nor Reject', (await tid('change-request-card').count()) === 1 && (await tid('change-request-approve').count()) === 0 && (await tid('change-request-reject').count()) === 0 && (await tid('change-request-decide').count()) === 0)

  // ---- 20. approve: redrawn from the answer, then re-read ----
  scenario = { access: SUPERVISOR }
  resetDecide({
    approve: () => {
      cr.histories[FX.e151] = structuredClone(FX.afterApprove151)
      return FX.approved151
    },
  })
  await openCard(151)
  const holdApprove = deferred()
  const historyBeforeA = cr.historyCalls.length
  const accountBeforeA = cr.accountCalls
  cr.holdHistory = holdApprove
  await tid('change-request-approve').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="change-request-card"]'), null, { timeout: 8000 }).catch(() => {})
  check('🔑 Approve sends ONLY { changeRequestId }', JSON.stringify(decided('approve')?.body) === JSON.stringify({ changeRequestId: 'R-151' }), JSON.stringify(decided('approve')))
  check('🔑 W8: the card is gone from the APPLIED answer while the History re-read is still held', (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask' && cr.historyCalls.length > historyBeforeA)
  await tid('change-request-open').click()
  check('🔑 …and the entry\'s figures are the ANSWER\'s: the form opens at 300, not the row\'s 320', (await tid('change-request-amount').inputValue()) === '300' && /Lowest allowed: 205\.00\b/.test(await textOf('change-request-floor')), `${await tid('change-request-amount').inputValue()} · ${await textOf('change-request-floor')}`)
  await tid('change-request-back').click()
  check('…the toast says approved and applied', /The change request on entry 151 was approved and applied\./.test(await page.locator('body').innerText()))
  await shot('346-approved')
  holdApprove.release()
  cr.holdHistory = null
  await settle()
  check('…then the re-read lands with no card', (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask')
  check('…and the account was re-read too', cr.accountCalls > accountBeforeA)
  await crKeys('an approved request')

  // ---- 21. a refused approve keeps the card OPEN ----
  resetDecide({
    approve: () => {
      // A till spent past 300 while it waited: History now says so, the request still OPEN.
      cr.histories[FX.e151] = { ...structuredClone(FX.today151), remainingAmount: 10, spentAmount: 310 }
      return FX.belowSpent151
    },
  })
  await openCard(151)
  const holdRefused = deferred()
  cr.holdHistory = holdRefused
  await tid('change-request-approve').click()
  await appears('[data-testid="change-request-notice"]')
  n = await noticeOf()
  check('🔑 a refused approve is said by its code, with today\'s spent figure from the ANSWER', n.code === 'BELOW_SPENT' && n.step === 'reject' && /spent 310\.00 from entry 151/.test(n.text), JSON.stringify(n))
  check('…and its next step: reject it with a Reason', /Reject it with a Reason/.test(await textOf('change-request-notice-step')))
  check('🔑 …the card stays, still OPEN, with Approve and Reject', (await tid('change-request-card').getAttribute('data-request')) === 'R-151' && (await tid('change-request-approve').count()) === 1 && (await tid('change-request-reject').count()) === 1 && (await offerOf()) === 'waiting')
  check('…beside today\'s spent, redrawn from the answer while the re-read is held', /spent 310\.00 from entry 151/.test(await textOf('change-request-spent-now')), await textOf('change-request-spent-now'))
  await shot('346-below-spent')
  holdRefused.release()
  cr.holdHistory = null
  await settle()
  check('…and still there once History is re-read', (await tid('change-request-card').count()) === 1 && (await tid('change-request-notice').count()) === 1)
  await tid('change-request-reject').click()
  check('🔑 opening Reject as told keeps the refusal on screen — the Reason is written against it', (await tid('change-request-reject-form').count()) === 1 && (await noticeOf()).code === 'BELOW_SPENT')
  await crKeys('a refused approve')

  resetDecide({ approve: () => ({ ...FX.belowSpent151, refusalReason: 'CHANGE_STALE', remainingAmount: 115, spentAmount: 205 }) })
  await openCard(151)
  await tid('change-request-approve').click()
  await appears('[data-testid="change-request-notice"]')
  n = await noticeOf()
  check('CHANGE_STALE at approval: the card stays, and the step is to reject it', n.code === 'CHANGE_STALE' && n.step === 'reject' && (await tid('change-request-card').count()) === 1, JSON.stringify(n))

  resetDecide({
    approve: () => {
      // A direct Cancel landed first: the request was superseded with it (2194).
      cr.histories[FX.e151] = { ...structuredClone(FX.today151), entryStatus: 'CANCELLED', openRequest: null }
      return { ...FX.belowSpent151, refusalReason: 'ENTRY_FINAL', entryStatus: 'CANCELLED', remainingAmount: 115, spentAmount: 205 }
    },
  })
  await openCard(151)
  const holdFinal151 = deferred()
  cr.holdHistory = holdFinal151
  await tid('change-request-approve').click()
  await appears('[data-testid="change-request-finished"]')
  n = await noticeOf()
  check('ENTRY_FINAL at approval redraws from the answer: the entry is finished, nothing to press', n.code === 'ENTRY_FINAL' && (await offerOf()) === 'finished' && (await tid('change-request-approve').count()) === 0, JSON.stringify(n))
  holdFinal151.release()
  cr.holdHistory = null
  await settle()
  check('…and the re-read agrees: finished', (await offerOf()) === 'finished')

  // 🚩 ENTRY_NOT_OPEN naming the entry is the server's unexplained fallback at approval
  // (SettlementChangeRequestStore.RefusedAsync): the request stays OPEN, so the pane must not close.
  resetDecide({ approve: () => ({ ...FX.belowSpent151, refusalReason: 'ENTRY_NOT_OPEN', remainingAmount: 115, spentAmount: 205 }) })
  await openCard(151)
  await tid('change-request-approve').click()
  await appears('[data-testid="change-request-notice"]')
  await settle()
  n = await noticeOf()
  check('ENTRY_NOT_OPEN at approval, the entry named: the card stays with Reject — never "no longer exists"', n.code === 'ENTRY_NOT_OPEN' && n.step === 'reread' && !/no longer exists/.test(n.text) && (await offerOf()) === 'waiting' && (await tid('change-request-reject').count()) === 1, JSON.stringify(n))

  // ---- 22. reject needs a Reason ----
  resetDecide({
    reject: () => {
      cr.histories[FX.e151] = structuredClone(FX.afterReject151)
      return FX.rejected151
    },
  })
  await openCard(151)
  await tid('change-request-reject').click()
  check('Reject opens a Reason box, marked required', (await tid('change-request-reject-form').count()) === 1 && (await tid('change-request-reject-reason-required').count()) === 1)
  const rejectHeld = async () => (await tid('change-request-reject-submit').getAttribute('aria-disabled')) === 'true'
  check('🔑 …and Reject is held while the Reason is empty', await rejectHeld())
  await tid('change-request-reject-submit').click({ force: true })
  check('…pressing it anyway sends nothing', cr.decideCalls.length === 0)
  await tid('change-request-reject-reason').fill('   ')
  check('…or only spaces', await rejectHeld())
  await tid('change-request-reject-back').click()
  check('Back closes the box and Approve / Reject return', (await tid('change-request-reject-form').count()) === 0 && (await tid('change-request-approve').count()) === 1)
  await tid('change-request-reject').click()
  await tid('change-request-reject-reason').fill('  branch confirmed the 320 was right  ')
  check('a Reason releases it', !(await rejectHeld()))
  await crKeys('the Reject box')
  await shot('346-reject')
  await tid('change-request-reject-submit').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="change-request-card"]'), null, { timeout: 8000 }).catch(() => {})
  check('🔑 Reject sends { changeRequestId, reason }, the Reason trimmed', JSON.stringify(decided('reject')?.body) === JSON.stringify({ changeRequestId: 'R-151', reason: 'branch confirmed the 320 was right' }), JSON.stringify(decided('reject')))
  check('…the card goes, and the toast says rejected, the entry unchanged', (await tid('change-request-card').count()) === 0 && /The change request on entry 151 was rejected\. The entry is unchanged\./.test(await page.locator('body').innerText()))
  check('…and no approve was sent', !decided('approve'))

  resetDecide({ decideInvalid: { code: 'SettlementRejectReasonRequired', message: SERVER_WORDS } })
  await openCard(151)
  await tid('change-request-reject').click()
  await tid('change-request-reject-reason').fill('not needed')
  await tid('change-request-reject-submit').click()
  await appears('[data-testid="change-request-reject-reason-error"]')
  check('a 400 on the Reason lands on the Reject box, in 344\'s words', /A Reason is required to reject/.test(await textOf('change-request-reject-reason-error')) && !(await page.locator('body').innerText()).includes(SERVER_WORDS))
  await tid('change-request-reject-reason').fill('not needed at all')
  check('…and the next keystroke clears it', (await tid('change-request-reject-reason-error').count()) === 0)

  // A Reject box belongs to ONE request: R-151 was withdrawn and R-152 raised meanwhile.
  resetDecide({
    reject: () => {
      cr.histories[FX.e151] = { ...structuredClone(FX.today151), openRequest: { ...FX.theirs151, changeRequestId: 'R-152', requestReason: 'a fresh ask' } }
      return { ...FX.rejected151, accepted: false, refusalReason: 'CHANGE_NOT_OPEN', requestStatus: 'WITHDRAWN' }
    },
  })
  await openCard(151)
  await tid('change-request-reject').click()
  await tid('change-request-reject-reason').fill('typed for R-151')
  await tid('change-request-reject-submit').click()
  await appears('[data-testid="change-request-card"][data-request="R-152"]')
  n = await noticeOf()
  check('CHANGE_NOT_OPEN on a reject is said by its code, and the re-read draws what waits now', n.code === 'CHANGE_NOT_OPEN' && /already withdrawn/.test(n.text) && (await tid('change-request-card').getAttribute('data-request')) === 'R-152', JSON.stringify(n))
  check('🔑 …and R-151\'s Reject box and Reason are NOT carried onto R-152', (await tid('change-request-reject-form').count()) === 0 && (await tid('change-request-reject').count()) === 1)
  await tid('change-request-reject').click()
  check('…opening Reject on R-152 starts empty', (await tid('change-request-reject-reason').inputValue()) === '')

  // ---- 23. a bare 403, and a 404 ----
  resetDecide({ decideForbidden: true })
  await openCard(151)
  const probesBefore = accessCalls
  // An administrator took the grant between the probe and the press: re-read, it says so.
  scenario = { access: ACCOUNTANT }
  await tid('change-request-approve').click()
  await page.waitForFunction(() => /no longer hold settlement supervision/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {})
  await settle()
  check('🔑 a bare 403 is named — the change request was not decided', /You no longer hold settlement supervision, so this change request was not decided/.test(await page.locator('body').innerText()))
  check('🔑 …the probe is re-read, and Approve / Reject go away', accessCalls > probesBefore && (await tid('change-request-approve').count()) === 0 && (await tid('change-request-reject').count()) === 0, `${accessCalls - probesBefore} probe(s)`)
  check('…while the card itself stays — a fact about the entry', (await tid('change-request-card').count()) === 1)

  scenario = { access: SUPERVISOR }
  resetDecide({ decideMissing: true })
  const errorsBeforeD404 = errors.length
  await openCard(151)
  await tid('change-request-approve').click()
  await appears('[data-testid="change-request-unavailable"]')
  check('a 404 on Approve says "not available yet", never a crash', (await offerOf()) === 'not-shipped' && errors.length === errorsBeforeD404)
  scenario = {}
  await crKeys('ticket 346')

  // ======== Ticket 347 — delete, and "Reduce it to X" on a spent entry ========
  Object.assign(
    FX,
    await page.evaluate(async ([e143]) => {
      const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
      const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
      const row143 = acc.SETTLEMENT_ACCOUNTS['0142'].entries.find((e) => e.settlementEntryId === e143)
      // Another accountant's delete, waiting on 143 (the fixture's requester, 30117).
      const del = crf.waitingRequestOn(row143, { changeRequestId: 'R-DEL', requestKind: 'DELETE', requestReason: 'posted against the wrong branch' })
      return {
        del143: del,
        withDelete143: crf.historyOf(row143, { spentAmount: 0, openRequest: del }),
        raisedDelete143: crf.raisedAnswerFor(row143, { changeRequestId: 'R-DEL-NEW' }, 0),
        // 2193's DELETE_SPENT sample, about 143: a till spent 120 since the pane read 0.
        deleteSpent143: { ...crf.DELETE_SPENT_SAMPLE, settlementEntryId: e143, entryNumber: 143, description: row143.reason },
        spent143: crf.historyOf({ ...row143, remainingAmount: 380 }, { spentAmount: 120 }),
        // 2193: an approved delete answers APPLIED, the entry CANCELLED, its figures unchanged, spent 0.
        approvedDelete143: crf.approvedAnswerFor(row143, del, 0, { entryStatus: 'CANCELLED' }),
        afterDelete143: crf.historyOf({ ...row143, status: 'CANCELLED' }, { spentAmount: 0, requests: [{ ...del, status: 'APPLIED' }] }),
        appliedDelete143: { ...crf.raisedAnswerFor(row143, { changeRequestId: 'R-DEL-NOW' }, 0), requestStatus: 'APPLIED', entryStatus: 'CANCELLED' },
      }
    }, [FX.e143]),
  )
  const delHeld = async () => (await tid('change-request-delete-submit').getAttribute('aria-disabled')) === 'true'
  const toastText = async () => page.locator('[data-sonner-toaster]').innerText().catch(() => '')

  // ---- 24. an untouched entry: Request delete, a Reason only, no figures sent ----
  scenario = {}
  resetCr()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-delete-open"]')
  check('🔑 an untouched entry offers "Request delete" beside "Request a change"', (await textOf('change-request-delete-open')).trim() === 'Request delete' && (await tid('change-request-open').count()) === 1 && (await tid('change-request-delete-open').getAttribute('data-mode')) === 'request')
  check('…and says nothing about spending — there is none', (await tid('change-request-remove').count()) === 0 && (await tid('change-request-reduce').count()) === 0)
  await tid('change-request-delete-open').click()
  check('🔑 the delete form asks for a Reason only — no amount, no Description', (await tid('change-request-delete-form').count()) === 1 && (await tid('change-request-delete-reason').count()) === 1 && (await tid('change-request-amount').count()) === 0 && (await tid('change-request-description').count()) === 0)
  check('…the Reason is marked required, and the form says what a delete does', (await tid('change-request-delete-reason-required').count()) === 1 && /Once approved, the entry is cancelled/.test(await textOf('change-request-delete-intro')))
  check('…Submit is held while the Reason is empty', await delHeld())
  await tid('change-request-delete-submit').click({ force: true })
  check('…pressing it anyway sends nothing', cr.raiseCalls.length === 0)
  await tid('change-request-delete-reason').fill('   ')
  check('…or only spaces', await delHeld())
  await tid('change-request-delete-reason').fill('  posted against the wrong branch  ')
  check('a Reason releases it', !(await delHeld()))
  await crKeys('the delete form')
  await shot('347-delete-form')
  const holdDel = deferred()
  const historyBeforeDel = cr.historyCalls.length
  cr.holdHistory = holdDel
  cr.raise = () => {
    cr.histories[FX.e143] = { ...structuredClone(FX.withDelete143), openRequest: { ...FX.del143, changeRequestId: 'R-DEL-NEW', requestedByStaffId: 'msartawi', requestedByName: 'msartawi' } }
    return FX.raisedDelete143
  }
  await tid('change-request-delete-submit').click()
  await appears('[data-testid="change-request-card"]')
  const sentDel = cr.raiseCalls.at(-1) ?? {}
  check('🔑 the delete posts { settlementEntryId, requestKind: "DELETE", reason } — and NO figure field', JSON.stringify(Object.keys(sentDel).sort()) === JSON.stringify(['reason', 'requestKind', 'settlementEntryId']) && sentDel.requestKind === 'DELETE' && sentDel.settlementEntryId === FX.e143 && sentDel.reason === 'posted against the wrong branch', JSON.stringify(sentDel))
  check('🔑 W8: a delete\'s card is drawn from the ANSWER while the History re-read is held', cr.historyCalls.length > historyBeforeDel && (await tid('change-request-card').getAttribute('data-kind')) === 'DELETE' && (await tid('change-request-card').getAttribute('data-request')) === 'R-DEL-NEW')
  check('…"A request to delete entry 143 is waiting", and no old → new rows — a delete lands no figure', /A request to delete entry 143 is waiting\./.test(await textOf('change-request-card')) && (await tid('change-request-card-amount').count()) === 0 && (await tid('change-request-card-description').count()) === 0)
  check('…the toast says a delete request was raised', /Delete request raised for entry 143\./.test(await toastText()))
  holdDel.release()
  cr.holdHistory = null
  await settle()
  check('…then the re-read\'s own row stands: still a delete, waiting', (await tid('change-request-card').getAttribute('data-kind')) === 'DELETE' && (await offerOf()) === 'waiting')
  await crKeys('a waiting delete')
  await shot('347-delete-waiting')

  scenario = { access: SUPERVISOR }
  resetCr()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-delete-open"]')
  check('a supervisor is offered "Delete now" (the offer cell 348 words)', (await textOf('change-request-delete-open')).trim() === 'Delete now' && (await tid('change-request-delete-open').getAttribute('data-mode')) === 'now')
  await tid('change-request-delete-open').click()
  check('…its form submits as "Delete entry 143 now"', (await textOf('change-request-delete-submit')).trim() === 'Delete entry 143 now')
  await tid('change-request-delete-reason').fill('posted twice')
  const holdNow = deferred()
  cr.holdHistory = holdNow
  cr.raise = () => FX.appliedDelete143
  await tid('change-request-delete-submit').click()
  await appears('[data-testid="change-request-finished"]')
  check('🔑 an APPLIED answer: the entry is cancelled, drawn from the answer — the outcome read from requestStatus', (await offerOf()) === 'finished' && /This entry was cancelled/.test(await textOf('change-request-finished')) && /Entry 143 is cancelled\./.test(await toastText()))
  holdNow.release()
  cr.holdHistory = null
  await settle()
  scenario = {}

  // ---- 25. a spent entry: no delete, the sentence, and "Reduce it to X" ----
  resetCr()
  await go(`${ROUTE}?store=0142&entry=151`)
  await appears('[data-testid="change-request-remove"]')
  check('🔑 a spent entry offers no delete', (await tid('change-request-delete-open').count()) === 0 && (await tid('change-request-open').count()) === 1)
  check('🔑 …it says the branch has spent X — History\'s 200.00 — so it cannot be deleted', (await textOf('change-request-spent')).trim() === 'The branch has spent 200.00 from this entry, so it cannot be deleted.', await textOf('change-request-spent'))
  check('…and offers "Reduce it to 200.00"', (await textOf('change-request-reduce')).trim() === 'Reduce it to 200.00')
  await crKeys('the reduce offer')
  await shot('347-reduce-offer')
  await tid('change-request-reduce').click()
  check('🔑 Reduce opens the change form with X filled in — 200, the Description as it stands', (await tid('change-request-form').count()) === 1 && (await tid('change-request-amount').inputValue()) === '200' && (await tid('change-request-description').inputValue()) === FX.accounts['0142'].entries.find((e) => e.settlementEntryId === FX.e151).reason)
  check('…X is the floor itself, so the amount is accepted', /Lowest allowed: 200\.00\b/.test(await textOf('change-request-floor')) && (await tid('change-request-amount-error').count()) === 0)
  check('…with an empty Reason to write', (await tid('change-request-reason').inputValue()) === '')
  await tid('change-request-reason').fill('only 200 was ever over')
  const holdReduce = deferred()
  cr.holdHistory = holdReduce
  cr.raise = () => ({ ...FX.raisedAnswer, settlementEntryId: FX.e151, entryNumber: 151, changeRequestId: 'R-RED', amount: 320, remainingAmount: 120, spentAmount: 200 })
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-card"][data-request="R-RED"]')
  const sentReduce = cr.raiseCalls.at(-1) ?? {}
  check('🔑 …and posts a CHANGE to exactly X: newAmount 200, newDescription null', sentReduce.requestKind === 'CHANGE' && sentReduce.newAmount === 200 && sentReduce.newDescription === null, JSON.stringify(sentReduce))
  holdReduce.release()
  cr.holdHistory = null
  await settle()

  resetCr()
  cr.histories[FX.e128] = { ...cr.histories[FX.e128], remainingAmount: 0, spentAmount: 75.5 }
  await go(`${ROUTE}?store=0142&entry=128`)
  await appears('[data-testid="change-request-remove"]')
  check('a wholly spent entry: the sentence alone — reducing to what it already is would change nothing', (await tid('change-request-remove').getAttribute('data-remove')) === 'spent-whole' && /spent 75\.50 from this entry, so it cannot be deleted/.test(await textOf('change-request-spent')) && (await tid('change-request-reduce').count()) === 0 && (await tid('change-request-delete-open').count()) === 0)

  // ---- 26. a stubbed DELETE_SPENT does the same, from the ANSWER ----
  /** Open 143's delete form, type a Reason, and press Submit with the History re-read held. */
  const delete143 = async (hold) => {
    await go(`${ROUTE}?store=0142&entry=143`)
    await appears('[data-testid="change-request-delete-open"]')
    await tid('change-request-delete-open').click()
    await tid('change-request-delete-reason').fill('posted twice')
    cr.holdHistory = hold
    await tid('change-request-delete-submit').click()
    await appears('[data-testid="change-request-notice"]')
  }
  resetCr({
    raise: () => {
      // A till spent 120 since the pane read 0 — History will say so too, once re-read.
      cr.histories[FX.e143] = structuredClone(FX.spent143)
      return FX.deleteSpent143
    },
  })
  const holdSpent = deferred()
  await delete143(holdSpent)
  n = await noticeOf()
  check('🔑 DELETE_SPENT is said by its code, naming the ANSWER\'s spent figure, while the re-read is held', n.code === 'DELETE_SPENT' && n.step === 'reduce' && /The branch has spent 120\.00 from entry 143, so it cannot be deleted\./.test(n.text), JSON.stringify(n))
  check('🔑 …and offers "Reduce it to 120.00" from the answer', (await tid('change-request-reduce').count()) === 1 && (await tid('change-request-reduce').getAttribute('data-to')) === '120' && /Reduce it to 120\.00/.test(await textOf('change-request-reduce')))
  check('…the delete form is gone, and no delete is offered now', (await tid('change-request-delete-form').count()) === 0 && (await tid('change-request-delete-open').count()) === 0)
  check('…said ONCE: the cell beneath keeps the act, not the sentence', (await tid('change-request-spent').count()) === 0 && (await page.locator('[data-region="entry-change-request"]').innerText()).split('cannot be deleted').length === 2)
  await crKeys('a DELETE_SPENT refusal')
  await shot('347-delete-spent')
  await tid('change-request-reduce').click()
  check('🔑 Reduce opens the change form at the answer\'s 120, the floor 120.00', (await tid('change-request-amount').inputValue()) === '120' && /Lowest allowed: 120\.00\b/.test(await textOf('change-request-floor')), `${await tid('change-request-amount').inputValue()} · ${await textOf('change-request-floor')}`)
  check('…carrying the refused delete\'s Reason, to edit', (await tid('change-request-reason').inputValue()) === 'posted twice')
  cr.raise = () => ({ ...FX.raisedAnswer, changeRequestId: 'R-RED-143', amount: 500, remainingAmount: 380, spentAmount: 120 })
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-card"][data-request="R-RED-143"]')
  const sentSpent = cr.raiseCalls.at(-1) ?? {}
  check('…and posts newAmount 120', sentSpent.requestKind === 'CHANGE' && sentSpent.newAmount === 120 && sentSpent.newDescription === null, JSON.stringify(sentSpent))
  holdSpent.release()
  cr.holdHistory = null
  await settle()

  // The till spent more again before History was re-read: the server's newer figure wins.
  resetCr({
    raise: () => {
      cr.histories[FX.e143] = { ...structuredClone(FX.spent143), remainingAmount: 350, spentAmount: 150 }
      return FX.deleteSpent143
    },
  })
  await delete143(null)
  await page.waitForFunction(() => document.querySelector('[data-testid="change-request-reduce"]')?.getAttribute('data-to') === '150', null, { timeout: 8000 }).catch(() => {})
  check('🔑 a re-read stating a higher spent figure moves the offer with it — "Reduce it to 150.00", never the stale 120', (await tid('change-request-reduce').count()) === 1 && /Reduce it to 150\.00/.test(await textOf('change-request-reduce')) && (await noticeOf()).code === 'DELETE_SPENT', await textOf('change-request-reduce'))
  check('…and the cell says its own sentence with that figure — the button never stands beside a stale X', (await textOf('change-request-spent')).trim() === 'The branch has spent 150.00 from this entry, so it cannot be deleted.', await textOf('change-request-spent'))

  // Spent the whole of it: no reduce (it would change nothing), and the sentence once.
  resetCr({
    raise: () => {
      cr.histories[FX.e143] = { ...structuredClone(FX.spent143), remainingAmount: 0, spentAmount: 500 }
      return { ...FX.deleteSpent143, remainingAmount: 0, spentAmount: 500 }
    },
  })
  await delete143(null)
  await settle()
  n = await noticeOf()
  check('a wholly spent DELETE_SPENT: said once, by its code, and nothing to reduce to', n.code === 'DELETE_SPENT' && n.step === 'none' && (await tid('change-request-reduce').count()) === 0 && (await tid('change-request-delete-open').count()) === 0 && (await page.locator('[data-region="entry-change-request"]').innerText()).split('cannot be deleted').length === 2, JSON.stringify(n))

  // ---- 27. an approved delete cancels the entry; 400s ----
  scenario = { access: SUPERVISOR }
  resetCr({
    approve: () => {
      cr.histories[FX.e143] = structuredClone(FX.afterDelete143)
      return FX.approvedDelete143
    },
  })
  cr.histories[FX.e143] = structuredClone(FX.withDelete143)
  await openCard(143)
  check('a supervisor reads the waiting delete, with Approve and Reject', (await tid('change-request-card').getAttribute('data-kind')) === 'DELETE' && (await tid('change-request-approve').count()) === 1)
  const holdApproveDel = deferred()
  cr.holdHistory = holdApproveDel
  await tid('change-request-approve').click()
  await appears('[data-testid="change-request-finished"]')
  check('🔑 an approved delete redraws the entry as CANCELLED from the answer, while the re-read is held', (await offerOf()) === 'finished' && /This entry was cancelled/.test(await textOf('change-request-finished')) && (await tid('change-request-card').count()) === 0 && (await tid('change-request-open').count()) === 0)
  check('…Approve sent only { changeRequestId }', JSON.stringify(cr.decideCalls.at(-1)?.body) === JSON.stringify({ changeRequestId: 'R-DEL' }))
  holdApproveDel.release()
  cr.holdHistory = null
  await settle()
  check('…and the re-read agrees: finished', (await offerOf()) === 'finished')
  check('🚩 W13: the ENTRY is cancelled; no request is ever called "cancelled"', !/request (was|is) cancelled|cancelled the (change )?request/i.test(`${await page.locator('body').innerText()} ${await toastText()}`))
  await crKeys('an approved delete')
  await shot('347-approved-delete')
  scenario = {}

  resetCr({ raiseInvalid: { code: 'SettlementDeleteTakesNoFigures', message: SERVER_WORDS } })
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-delete-open"]')
  await tid('change-request-delete-open').click()
  await tid('change-request-delete-reason').fill('posted twice')
  await tid('change-request-delete-submit').click()
  await appears('[data-testid="change-request-delete-error"]')
  check('a 400 SettlementDeleteTakesNoFigures lands at the delete form\'s foot, in 344\'s words', (await tid('change-request-delete-error').getAttribute('data-code')) === 'SettlementDeleteTakesNoFigures' && /A delete names no amount/.test(await textOf('change-request-delete-error')) && !(await page.locator('body').innerText()).includes(SERVER_WORDS))
  cr.raiseInvalid = { code: 'SettlementChangeReasonRequired', message: SERVER_WORDS }
  await tid('change-request-delete-reason').fill('posted twice!')
  check('…the next keystroke clears it', (await tid('change-request-delete-error').count()) === 0)
  await tid('change-request-delete-submit').click()
  await appears('[data-testid="change-request-delete-reason-error"]')
  check('…and a Reason 400 lands on the delete form\'s Reason box', /A Reason is required/.test(await textOf('change-request-delete-reason-error')))
  await crKeys('ticket 347')

  // ======== Ticket 348 — a supervisor's own change or delete applies at once ========
  Object.assign(
    FX,
    await page.evaluate(async ([e143]) => {
      const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
      const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
      const row143 = acc.SETTLEMENT_ACCOUNTS['0142'].entries.find((e) => e.settlementEntryId === e143)
      const corrected143 = { ...row143, amount: 300, remainingAmount: 300 }
      // The supervisor's own change, as History records it after 2194: requester and decider both theirs.
      const mineApplied = { ...crf.waitingRequestOn(row143, { changeRequestId: 'R-NOW', newAmount: 300, requestedByStaffId: 'msartawi', requestedByName: 'msartawi' }), status: 'APPLIED' }
      const supOpen = crf.waitingRequestOn(row143, { changeRequestId: 'R-SUP-OPEN', newAmount: 300, requestedByStaffId: 'msartawi', requestedByName: 'msartawi' })
      // An accountant's request already waiting on 143 (the fixture's requester, 30117).
      const theirs = crf.waitingRequestOn(row143, { changeRequestId: 'R-ACC', newAmount: 450, requestReason: 'typed 500 instead of 450' })
      /** A refused raise about 143 — 2194: a supervisor's own refusals store nothing. */
      const refusedAbout = (refusalReason, changeRequestId, requestStatus) => ({
        ...crf.APPLIED_SAMPLE,
        accepted: false,
        refusalReason,
        changeRequestId,
        requestStatus,
        settlementEntryId: e143,
        entryNumber: 143,
        amount: 500,
        remainingAmount: 500,
        spentAmount: 0,
        description: row143.reason,
        entryStatus: 'OPEN',
      })
      return {
        // 2194: a supervisor's own raise answers APPLIED with the corrected figures.
        applied143: crf.approvedAnswerFor(row143, { changeRequestId: 'R-NOW' }, 0, { amount: 300, remainingAmount: 300 }),
        afterApplied143: crf.historyOf(corrected143, { spentAmount: 0, requests: [mineApplied] }),
        supOpen143: crf.raisedAnswerFor(row143, supOpen, 0),
        withSupOpen143: crf.historyOf(row143, { spentAmount: 0, openRequest: supOpen }),
        withTheirs143: crf.historyOf(row143, { spentAmount: 0, openRequest: theirs }),
        alreadyOpen143: refusedAbout('CHANGE_ALREADY_OPEN', 'R-ACC', 'OPEN'),
        stale143: refusedAbout('CHANGE_STALE', '', ''),
        approvedTheirs143: crf.approvedAnswerFor(row143, theirs, 0, { amount: 450, remainingAmount: 450 }),
        afterTheirs143: crf.historyOf({ ...row143, amount: 450, remainingAmount: 450 }, { spentAmount: 0, requests: [{ ...theirs, status: 'APPLIED' }] }),
      }
    }, [FX.e143]),
  )
  /** Open 143's change form, type an amount and a Reason, and press Change with the History re-read held. */
  const change143 = async (amount, hold) => {
    await go(`${ROUTE}?store=0142&entry=143`)
    await appears('[data-testid="change-request-open"]')
    await tid('change-request-open').click()
    await tid('change-request-amount').fill(amount)
    await tid('change-request-reason').fill('typed 500 instead of 300')
    cr.holdHistory = hold
    await tid('change-request-submit').click()
  }
  const formGone = () =>
    page.waitForFunction(() => !document.querySelector('[data-testid="change-request-form"]'), null, { timeout: 8000 }).catch(() => {})

  // ---- 28. the supervisor's words: Change now / Delete now, and "applies immediately" first ----
  scenario = { access: SUPERVISOR }
  resetCr()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  check('🔑 a supervisor with nothing waiting reads "Change now" and "Delete now"', (await textOf('change-request-open')).trim() === 'Change now' && (await textOf('change-request-delete-open')).trim() === 'Delete now')
  await tid('change-request-open').click()
  check('🔑 the change form says "Applies immediately — no approval step" before the press', (await textOf('change-request-applies-now')).trim() === 'Applies immediately — no approval step. Entry 143 is changed the moment you confirm below.', await textOf('change-request-applies-now'))
  check('…said above the button that applies it', await before('[data-testid="change-request-applies-now"]', '[data-testid="change-request-submit"]'))
  check('…and the Reason is never said to wait for a supervisor\'s reading', !/the supervisor reads it before deciding/.test(await pane().innerText()) && /kept in the entry's history/.test(await pane().innerText()))
  await tid('change-request-amount').fill('300')
  check('…the Reason is still required: Change is held without one', (await held()) && (await textOf('change-request-submit')).trim() === 'Change entry 143 now')
  await tid('change-request-submit').click({ force: true })
  check('…and pressing it anyway sends nothing', cr.raiseCalls.length === 0)
  await tid('change-request-reason').fill('typed 500 instead of 300')
  check('…a Reason releases it', !(await held()))
  await crKeys('the supervisor\'s change form')
  await shot('348-change-now')
  await tid('change-request-back').click()
  await tid('change-request-delete-open').click()
  check('🔑 the delete form says it too', (await textOf('change-request-applies-now')).trim() === 'Applies immediately — no approval step. Entry 143 is cancelled the moment you confirm below.', await textOf('change-request-applies-now'))
  check('…and its Reason is required', await delHeld() && !/the supervisor reads it before deciding/.test(await pane().innerText()))
  await crKeys('the supervisor\'s delete form')
  await shot('348-delete-now')

  scenario = {}
  resetCr()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  await tid('change-request-open').click()
  check('🚩 an accountant\'s change form never says it applies immediately', (await tid('change-request-form').count()) === 1 && (await tid('change-request-applies-now').count()) === 0)
  await tid('change-request-back').click()
  await tid('change-request-delete-open').click()
  check('…nor their delete form', (await tid('change-request-delete-form').count()) === 1 && (await tid('change-request-applies-now').count()) === 0)

  // ---- 29. APPLIED redraws with no card; OPEN draws the card; a refusal stores nothing ----
  scenario = { access: SUPERVISOR }
  resetCr({
    raise: () => {
      cr.histories[FX.e143] = structuredClone(FX.afterApplied143)
      return FX.applied143
    },
  })
  const holdApplied = deferred()
  const accountBeforeApplied = cr.accountCalls
  await change143('300', holdApplied)
  await formGone()
  const sentNow = cr.raiseCalls.at(-1) ?? {}
  check('the supervisor\'s change posts the same body an accountant\'s does — no flag on the wire', JSON.stringify(sentNow) === JSON.stringify({ settlementEntryId: FX.e143, requestKind: 'CHANGE', newAmount: 300, newDescription: null, reason: 'typed 500 instead of 300' }), JSON.stringify(sentNow))
  check('🔑 APPLIED: no waiting card, while the History re-read is still held', (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask')
  check('…the toast says the entry is changed', /Entry 143 is changed\./.test(await toastText()))
  await tid('change-request-open').click()
  check('🔑 …and the entry is redrawn from the ANSWER: the form opens at 300, not the row\'s 500', (await tid('change-request-amount').inputValue()) === '300', await tid('change-request-amount').inputValue())
  await tid('change-request-back').click()
  holdApplied.release()
  cr.holdHistory = null
  await settle()
  check('…then the re-read lands, still with no card', (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask')
  check('…and the account was re-read too', cr.accountCalls > accountBeforeApplied)
  await crKeys('an applied change')
  await shot('348-applied')

  resetCr({ raise: () => FX.appliedDelete143 })
  const holdAppliedDel = deferred()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-delete-open"]')
  await tid('change-request-delete-open').click()
  await tid('change-request-delete-reason').fill('posted twice')
  cr.holdHistory = holdAppliedDel
  await tid('change-request-delete-submit').click()
  await appears('[data-testid="change-request-finished"]')
  check('🔑 an APPLIED delete: the entry is drawn cancelled, with no card, before the re-read', (await offerOf()) === 'finished' && (await tid('change-request-card').count()) === 0 && (await tid('change-request-delete-form').count()) === 0)
  holdAppliedDel.release()
  cr.holdHistory = null
  await settle()

  resetCr({ raise: () => FX.supOpen143 })
  const holdSupOpen = deferred()
  await change143('300', holdSupOpen)
  await appears('[data-testid="change-request-card"][data-request="R-SUP-OPEN"]')
  check('🔑 a supervisor\'s raise answered OPEN draws the card as for anyone — the answer, not the flag', (await offerOf()) === 'waiting' && (await tid('change-request-card').getAttribute('data-request')) === 'R-SUP-OPEN')
  check('…their own: Withdraw, beside Approve / Reject', (await tid('change-request-withdraw').count()) === 1 && (await tid('change-request-approve').count()) === 1)
  check('…and the toast says a request was raised, never that the entry changed', /Change request raised for entry 143\./.test(await toastText()))
  cr.histories[FX.e143] = structuredClone(FX.withSupOpen143)
  holdSupOpen.release()
  cr.holdHistory = null
  await settle()

  resetCr({ raise: () => FX.stale143 })
  await change143('300', null)
  await appears('[data-testid="change-request-notice"]')
  await settle()
  n = await noticeOf()
  check('🔑 a supervisor\'s refusal stores nothing: CHANGE_STALE said by its code, the form closed, no card', n.code === 'CHANGE_STALE' && n.step === 'redraw' && /has moved on since this was asked/.test(n.text) && (await tid('change-request-form').count()) === 0 && (await tid('change-request-card').count()) === 0 && (await offerOf()) === 'ask', JSON.stringify(n))

  // ---- 30. blocked by an accountant's request: open its card, decide it first ----
  resetCr({
    raise: () => {
      cr.histories[FX.e143] = structuredClone(FX.withTheirs143)
      return FX.alreadyOpen143
    },
    approve: () => {
      cr.histories[FX.e143] = structuredClone(FX.afterTheirs143)
      return FX.approvedTheirs143
    },
  })
  await change143('300', null)
  await appears('[data-testid="change-request-card"][data-request="R-ACC"]')
  await settle()
  n = await noticeOf()
  check('🔑 CHANGE_ALREADY_OPEN on a supervisor\'s raise: said by its code, and the accountant\'s card opens in the same pane', n.code === 'CHANGE_ALREADY_OPEN' && n.step === 'open-request' && (await tid('change-request-form').count()) === 0 && (await offerOf()) === 'waiting', JSON.stringify(n))
  check('🔑 …with Approve / Reject to decide it first, and no Withdraw — it is not theirs', (await tid('change-request-approve').count()) === 1 && (await tid('change-request-reject').count()) === 1 && (await tid('change-request-withdraw').count()) === 0)
  check('…the notice says to decide it first', /Approve or reject it below first\. Your own change or delete on entry 143 can be made once it is decided\./.test(await textOf('change-request-notice-step')), await textOf('change-request-notice-step'))
  await crKeys('a supervisor blocked by a waiting request')
  await shot('348-already-open')
  await tid('change-request-approve').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="change-request-card"]'), null, { timeout: 8000 }).catch(() => {})
  await settle()
  check('…Approve decides the accountant\'s request ({ changeRequestId: "R-ACC" })', JSON.stringify(cr.decideCalls.at(-1)?.body) === JSON.stringify({ changeRequestId: 'R-ACC' }))
  check('…and "Change now" is offered again on the corrected entry', (await offerOf()) === 'ask' && (await textOf('change-request-open')).trim() === 'Change now')
  check('…and "decide it first" is gone once it is decided', (await tid('change-request-notice-step').count()) === 0)

  scenario = {}
  resetCr({
    raise: () => {
      cr.histories[FX.e143] = structuredClone(FX.withTheirs143)
      return FX.alreadyOpen143
    },
  })
  await change143('300', null)
  await appears('[data-testid="change-request-card"][data-request="R-ACC"]')
  await settle()
  check('🚩 an accountant blocked the same way: the card, and no "decide it first" — they cannot', (await tid('change-request-approve').count()) === 0 && (await tid('change-request-notice-step').count()) === 0)
  await crKeys('ticket 348')

  // ======== Ticket 349 — a theft's amount or business day ========
  Object.assign(
    FX,
    await page.evaluate(async () => {
      const theft = await import('/src/features/collection/settlement/theft-fixture.ts')
      const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
      const account = structuredClone(theft.THEFT_ACCOUNT)
      const row = (n) => account.entries.find((e) => e.entryNumber === n)
      const t1413 = row(1413)
      const shortage1410 = row(1410)
      // 1413: an approved theft of 450.75 on 2026-09-20 — never spent (2195: the floor never bites).
      const dayMove = crf.waitingRequestOn(t1413, {
        changeRequestId: 'R-DAY',
        newBusinessDay: '2026-09-21T00:00:00',
        requestReason: 'reported against the wrong day',
      })
      const moved = { ...t1413, businessDay: '2026-09-21T00:00:00' }
      const histories = {}
      for (const e of account.entries) histories[e.settlementEntryId] = crf.historyOf(e, { spentAmount: 0 })
      /** 2195's sample, about 1413. */
      const collectedAbout1413 = {
        ...crf.THEFT_DAY_COLLECTED_SAMPLE,
        settlementEntryId: t1413.settlementEntryId,
        entryNumber: 1413,
        amount: 450.75,
        remainingAmount: 450.75,
        description: t1413.reason,
        businessDay: t1413.businessDay,
      }
      return {
        theftAccount: account,
        theftHistories: histories,
        t1413: t1413.settlementEntryId,
        t1410: shortage1410.settlementEntryId,
        t1413Reason: t1413.reason,
        raisedDay1413: crf.raisedAnswerFor(t1413, dayMove, 0),
        withDayMove1413: crf.historyOf(t1413, { spentAmount: 0, openRequest: dayMove }),
        // On a raise nothing is stored…
        dayCollected1413: { ...collectedAbout1413, changeRequestId: '', requestStatus: '' },
        // …and at approval the request stays OPEN.
        dayCollectedAtApproval1413: { ...collectedAbout1413, changeRequestId: 'R-DAY' },
        approvedDay1413: crf.approvedAnswerFor(t1413, dayMove, 0, { businessDay: '2026-09-21T00:00:00' }),
        afterDay1413: crf.historyOf(moved, { spentAmount: 0, requests: [{ ...dayMove, status: 'APPLIED' }] }),
      }
    }),
  )
  FX.accounts.P019 = FX.theftAccount
  Object.assign(FX.histories, FX.theftHistories)
  const THEFT_ROUTE = `${ROUTE}?store=P019&entry=1413`
  const dayBox = () => tid('change-request-day')
  const openTheftForm = async () => {
    await go(THEFT_ROUTE)
    await appears('[data-testid="change-request-open"]')
    await tid('change-request-open').click()
    await appears('[data-testid="change-request-form"]')
  }

  // ---- 31. the day box: a theft's alone, filled, and sent only when it moves ----
  scenario = {}
  resetCr()
  await openTheftForm()
  check('🔑 a theft\'s change form shows the day box, filled with the theft\'s day', (await dayBox().count()) === 1 && (await dayBox().inputValue()) === '2026-09-20' && (await dayBox().getAttribute('type')) === 'date', await dayBox().inputValue().catch(() => ''))
  check('…labelled as the post dialog labels it, and required', /Business day of the theft/.test(await page.locator('[data-region="change-request-day"]').innerText()) && (await dayBox().getAttribute('aria-required')) === 'true')
  check('…between the Description and the Reason', (await before('[data-testid="change-request-description"]', '[data-testid="change-request-day"]')) && (await before('[data-testid="change-request-day"]', '[data-testid="change-request-reason"]')))
  check('…and its amount floor is the server\'s 0 — a theft is never spent', /Lowest allowed: 0/.test(await textOf('change-request-floor')), await textOf('change-request-floor'))
  await tid('change-request-reason').fill('reported against the wrong day')
  check('🔑 naming only the day it already has is "nothing differs": held, and said with the day', (await held()) && /the amount, the Description or the business day/.test(await textOf('change-request-unchanged')))
  await tid('change-request-submit').click({ force: true })
  check('…and pressing it anyway sends nothing', cr.raiseCalls.length === 0)
  await crKeys('a theft\'s change form')
  await shot('349-theft-form')

  await go(`${ROUTE}?store=P019&entry=1410`)
  await appears('[data-testid="change-request-open"]')
  await tid('change-request-open').click()
  await appears('[data-testid="change-request-form"]')
  check('🚩 a shortage\'s form shows no day box', (await dayBox().count()) === 0 && (await tid('change-request-amount').count()) === 1)
  await tid('change-request-amount').fill('150')
  await tid('change-request-reason').fill('typo')
  await tid('change-request-submit').click()
  await settle()
  check('🚩 …and its raise names no newBusinessDay at all', JSON.stringify(cr.raiseCalls.at(-1)) === JSON.stringify({ settlementEntryId: FX.t1410, requestKind: 'CHANGE', newAmount: 150, newDescription: null, reason: 'typo' }), JSON.stringify(cr.raiseCalls.at(-1)))

  resetCr({
    raise: () => {
      cr.histories[FX.t1413] = structuredClone(FX.withDayMove1413)
      return FX.raisedDay1413
    },
  })
  await openTheftForm()
  await dayBox().fill('2026-09-21')
  await tid('change-request-reason').fill('reported against the wrong day')
  check('a moved day releases Submit', !(await held()))
  const holdDay = deferred()
  cr.holdHistory = holdDay
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-card"]')
  check('🔑 the day-move posts the bare date, and null for the amount and Description', JSON.stringify(cr.raiseCalls.at(-1)) === JSON.stringify({ settlementEntryId: FX.t1413, requestKind: 'CHANGE', newAmount: null, newDescription: null, newBusinessDay: '2026-09-21', reason: 'reported against the wrong day' }), JSON.stringify(cr.raiseCalls.at(-1)))
  check('🔑 the card names old → new day, drawn from the answer while the re-read is held', (await textOf('change-request-card-businessDay')).includes('2026-09-20') && (await textOf('change-request-card-businessDay')).includes('2026-09-21') && (await tid('change-request-card-amount').count()) === 0, await textOf('change-request-card-businessDay'))
  holdDay.release()
  cr.holdHistory = null
  await settle()
  check('…and the re-read\'s own row says the same', (await tid('change-request-card').getAttribute('data-request')) === 'R-DAY' && (await textOf('change-request-card-businessDay')).includes('2026-09-21'))
  await crKeys('a theft\'s waiting day-move')
  await shot('349-day-move-card')

  resetCr()
  await openTheftForm()
  await tid('change-request-amount').fill('400')
  await tid('change-request-reason').fill('counted again')
  await tid('change-request-submit').click()
  await settle()
  check('an amount-only change on a theft sends newBusinessDay null — the day is left as it is', JSON.stringify(cr.raiseCalls.at(-1)) === JSON.stringify({ settlementEntryId: FX.t1413, requestKind: 'CHANGE', newAmount: 400, newDescription: null, newBusinessDay: null, reason: 'counted again' }), JSON.stringify(cr.raiseCalls.at(-1)))

  // ---- 32. THEFT_DAY_COLLECTED: said by its code, in the notice ----
  resetCr({ raise: () => FX.dayCollected1413 })
  await openTheftForm()
  await dayBox().fill('2026-09-21')
  await tid('change-request-reason').fill('reported against the wrong day')
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-notice"]')
  await settle()
  n = await noticeOf()
  check('🔑 THEFT_DAY_COLLECTED on a raise is said by its code, in the notice line', n.code === 'THEFT_DAY_COLLECTED' && n.step === 'stay' && /has been collected, so it can no longer be corrected or deleted/.test(n.text), JSON.stringify(n))
  check('…the form kept as typed — another day may be picked', (await tid('change-request-form').count()) === 1 && (await dayBox().inputValue()) === '2026-09-21' && (await tid('change-request-reason').inputValue()) === 'reported against the wrong day')
  check('…not on the day box: the code answers a change that never moved the day too', (await tid('change-request-day-error').count()) === 0)
  check('…and nothing waits', (await tid('change-request-card').count()) === 0)
  await crKeys('THEFT_DAY_COLLECTED on a raise')
  await shot('349-day-collected')

  scenario = { access: SUPERVISOR }
  resetCr({ approve: () => FX.dayCollectedAtApproval1413 })
  cr.histories[FX.t1413] = structuredClone(FX.withDayMove1413)
  await go(THEFT_ROUTE)
  await appears('[data-testid="change-request-approve"]')
  await tid('change-request-approve').click()
  await appears('[data-testid="change-request-notice"]')
  await settle()
  n = await noticeOf()
  check('🔑 THEFT_DAY_COLLECTED at approval: the card stays OPEN, with the "reject it" step', n.code === 'THEFT_DAY_COLLECTED' && n.step === 'reject' && (await tid('change-request-card').getAttribute('data-request')) === 'R-DAY' && (await tid('change-request-notice-step').count()) === 1, JSON.stringify(n))
  scenario = {}

  // ---- 33. the day 400s land on the day box ----
  resetCr({ raiseInvalid: { code: 'SettlementTheftDayNotClosed', message: SERVER_WORDS } })
  await openTheftForm()
  await dayBox().fill('2026-09-25')
  await tid('change-request-reason').fill('reported against the wrong day')
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-day-error"]')
  check('🔑 a 400 SettlementTheftDayNotClosed lands on the day box, in 344\'s words', /not a closed day of this branch/.test(await textOf('change-request-day-error')) && (await tid('change-request-form-error').count()) === 0 && !(await page.locator('body').innerText()).includes(SERVER_WORDS), await textOf('change-request-day-error'))
  check('…the form kept as typed', (await dayBox().inputValue()) === '2026-09-25')
  await dayBox().fill('2026-09-19')
  check('…and the next keystroke clears it', (await tid('change-request-day-error').count()) === 0)
  cr.raiseInvalid = { code: 'SettlementTheftBusinessDayRequired', message: SERVER_WORDS }
  await tid('change-request-submit').click()
  await appears('[data-testid="change-request-day-error"]')
  check('…SettlementTheftBusinessDayRequired lands there too', /Pick the theft's business day/.test(await textOf('change-request-day-error')), await textOf('change-request-day-error'))
  await dayBox().fill('')
  check('an emptied day box is held in the form, and said on the box', (await held()) && /never left without one/.test(await textOf('change-request-day-error')), await textOf('change-request-day-error'))
  await crKeys('the day 400s')

  // ---- 34. an approved day-move redraws the new day from the answer ----
  scenario = { access: SUPERVISOR }
  resetCr({
    approve: () => {
      cr.histories[FX.t1413] = structuredClone(FX.afterDay1413)
      FX.accounts.P019.entries = FX.accounts.P019.entries.map((e) =>
        e.settlementEntryId === FX.t1413 ? { ...e, businessDay: '2026-09-21T00:00:00' } : e,
      )
      return FX.approvedDay1413
    },
  })
  cr.histories[FX.t1413] = structuredClone(FX.withDayMove1413)
  await go(THEFT_ROUTE)
  await appears('[data-testid="change-request-approve"]')
  check('a supervisor reads the waiting day-move, old → new', (await textOf('change-request-card-businessDay')).includes('2026-09-21'))
  const holdApproveDay = deferred()
  cr.holdHistory = holdApproveDay
  await tid('change-request-approve').click()
  await page.waitForFunction(() => !document.querySelector('[data-testid="change-request-card"]'), null, { timeout: 8000 }).catch(() => {})
  check('…Approve sent only { changeRequestId }', JSON.stringify(cr.decideCalls.at(-1)?.body) === JSON.stringify({ changeRequestId: 'R-DAY' }))
  await tid('change-request-open').click()
  check('🔑 the approved day-move is redrawn from the ANSWER: the form reopens on 2026-09-21, while the re-read is held', (await dayBox().inputValue()) === '2026-09-21', await dayBox().inputValue())
  await tid('change-request-back').click()
  holdApproveDay.release()
  cr.holdHistory = null
  await settle()
  await tid('change-request-open').click()
  check('…and once History and the account are re-read, the new day stands', (await dayBox().inputValue()) === '2026-09-21' && (await tid('change-request-card').count()) === 0)
  await crKeys('an approved day-move')
  await shot('349-approved-day-move')
  scenario = {}

  // ---- 35. ticket 350: every request in the audit column, and the "Changed" tag ----
  // 0142/151: posted 2026-08-11T09:02, a till took 200 at 2026-08-12T22:41. History holds
  // all five statuses and a supervisor's own change, listed NEWEST FIRST as the server does.
  const AUDIT = await page.evaluate(async () => {
    const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
    const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
    const e151 = acc.SETTLEMENT_ACCOUNTS['0142'].entries.find((e) => e.entryNumber === 151)
    const ask = (id, requestedAt, more = {}) =>
      crf.waitingRequestOn(e151, { changeRequestId: id, requestedAt, ...more })
    // 350 → 320: the entry stands at 320 today, so the applied change's old figure is 350.
    const applied = {
      ...crf.decidedRequest(ask('R-APP', '2026-08-11T10:00:00', { requestReason: 'typed 350 instead of 320' }), {
        status: 'APPLIED',
        decidedAt: '2026-08-11T12:00:00',
      }),
      oldAmount: 350,
      newAmount: 320,
    }
    const rejected = crf.decidedRequest(ask('R-REJ', '2026-08-12T09:00:00', { newAmount: 300 }), {
      status: 'REJECTED',
      decidedAt: '2026-08-12T15:00:00',
      decisionReason: 'no evidence attached',
    })
    const withdrawn = crf.decidedRequest(ask('R-WDR', '2026-08-13T08:00:00', { newAmount: 250 }), {
      status: 'WITHDRAWN',
      decidedAt: '2026-08-13T08:30:00',
      decidedByStaffId: crf.REQUESTER.staffId,
      decidedByName: crf.REQUESTER.name,
    })
    const superseded = crf.decidedRequest(ask('R-SUP', '2026-08-13T10:00:00', { newAmount: 260 }), {
      status: 'SUPERSEDED',
      decidedAt: '2026-08-14T09:00:00',
    })
    // A supervisor's own Description-only change: one applied fact, and the tag's LATER date.
    const own = crf.decidedRequest(
      ask('R-OWN', '2026-08-14T12:00:00', {
        newDescription: 'مرتجع شبكة — مصحح',
        requestedByStaffId: crf.SUPERVISOR.staffId,
        requestedByName: crf.SUPERVISOR.name,
        requestReason: 'wording of the description',
      }),
      { status: 'APPLIED', decidedAt: '2026-08-14T12:00:00' },
    )
    const waiting = ask('R-OPEN', '2026-08-15T11:00:00', { newAmount: 280, requestReason: 'recount' })
    return {
      history: crf.historyOf(e151, {
        spentAmount: 200,
        openRequest: waiting,
        requests: [waiting, own, superseded, withdrawn, rejected, applied],
      }),
      supervisor: crf.SUPERVISOR.name,
      requester: crf.REQUESTER.name,
    }
  })
  const facts = () =>
    page.$$eval('[data-region="entry-audit"] li[data-fact]', (lis) =>
      lis.map((li) => ({ kind: li.getAttribute('data-fact'), text: li.innerText })),
    )

  resetCr()
  cr.histories[FX.e151] = structuredClone(AUDIT.history)
  await go(`${ROUTE}?store=0142&entry=151`)
  await appears('[data-region="entry-audit"] li[data-fact="requested"]')
  await settle()
  let column = await facts()
  check(
    '🔑 the audit column holds every request\'s steps, merged BY TIME with the posting and the till',
    JSON.stringify(column.map((f) => f.kind)) ===
      JSON.stringify([
        'posted',
        'requested', 'request-applied',
        'requested', 'request-rejected',
        'consumed',
        'requested', 'request-withdrawn',
        'requested', 'request-superseded',
        'request-applied',
        'requested',
      ]),
    column.map((f) => f.kind).join(', '),
  )
  check('🔑 the posting states what it was POSTED at (350.00, the first applied change\'s old figure), not today\'s 320.00', /Posted 350\.00\b/.test(column[0].text), column[0].text)
  check('…all five statuses are there: raised (waiting), applied, rejected, withdrawn, superseded', ['requested', 'request-applied', 'request-rejected', 'request-withdrawn', 'request-superseded'].every((k) => column.some((f) => f.kind === k)))
  check('…and the times read in order, as received (local wall clock)', /^2026-08-11 10:00\b/.test(column[1].text) && /^2026-08-14 12:00\b/.test(column[10].text) && /^2026-08-15 11:00\b/.test(column[11].text), `${column[1].text} | ${column[11].text}`)
  check('a raise names the asker and the request\'s Reason, with old → new', column[1].text.includes(`by ${AUDIT.requester}`) && column[1].text.includes('typed 350 instead of 320') && /350\.00 → 320\.00/.test(column[1].text), column[1].text)
  check('the approval names the approving supervisor, under the name recorded then', column[2].text.includes(`by ${AUDIT.supervisor}`) && /approved — the entry was changed/.test(column[2].text), column[2].text)
  check('a rejection carries its own reason', column[4].text.includes('Change request rejected') && column[4].text.includes('no evidence attached'), column[4].text)
  check('a withdrawal names the requester; a supersede names the supervisor — never "cancelled"', column[7].text.includes('Change request withdrawn') && column[7].text.includes(`by ${AUDIT.requester}`) && column[9].text.includes('Change request superseded') && !/request cancelled/i.test(column.map((f) => f.text).join(' ')))
  check('🔑 a supervisor\'s own request is ONE applied fact, with its Reason', column.filter((f) => f.text.includes('wording of the description')).length === 1 && /Changed by a supervisor at once/.test(column[10].text), column[10].text)
  check('the waiting request is in the column too, with its Reason', column[11].text.includes('Change requested') && column[11].text.includes('recount'), column[11].text)

  const tag = tid('entry-changed-tag')
  check('🔑 the panel header says "Changed", in the change-request pane\'s header', (await tag.count()) === 1 && (await page.locator('[data-region="entry-change-request"] header [data-testid="entry-changed-tag"]').count()) === 1)
  check('🔑 …dated by the LATEST applied change (the own Description-only change)', /Changed\s+2026-08-14/.test(await textOf('entry-changed-tag')) && (await tag.getAttribute('data-at')) === '2026-08-14T12:00:00', await textOf('entry-changed-tag'))
  check('🔑 …with the earlier amount of the latest change that MOVED it — 350.00, not 320.00', /was 350\.00\b/.test(await textOf('entry-changed-earlier')), await textOf('entry-changed-earlier'))
  check('…and it is ONE History read, shared by the pane and the column', cr.historyCalls.filter((id) => id === FX.e151).length === 1, String(cr.historyCalls.length))
  await crKeys('the audit column with requests')
  check('…no raw audit key on screen', !/\baudit\.[a-zA-Z]/.test(await page.locator('body').innerText()))
  await shot('350-audit-and-tag')

  // An entry never changed has no tag, and its column is the entry's own facts only.
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-region="entry-audit"] li[data-fact]')
  await settle()
  check('an entry never changed shows no "Changed" tag', (await tid('entry-changed-tag').count()) === 0)
  check('…and its column holds no request fact', (await facts()).every((f) => !f.kind.startsWith('request')))

  // A Description-only change: the tag still says Changed, and — as the till does — that
  // the amount did not move, naming the amount it stands at.
  const reworded = await page.evaluate(async () => {
    const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
    const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
    const e143 = acc.SETTLEMENT_ACCOUNTS['0142'].entries.find((e) => e.entryNumber === 143)
    const words = crf.decidedRequest(
      crf.waitingRequestOn(e143, { changeRequestId: 'R-WORDS', newDescription: 'نقص في تسليم — مصحح', requestedAt: '2026-09-01T09:00:00' }),
      { status: 'APPLIED', decidedAt: '2026-09-01T10:00:00' },
    )
    return crf.historyOf(e143, { spentAmount: 0, requests: [words] })
  })
  cr.histories[FX.e143] = reworded
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="entry-changed-tag"]')
  check('a Description-only change is tagged Changed, "amount not changed: 500.00" — the till\'s words', /Changed\s+2026-09-01/.test(await textOf('entry-changed-tag')) && /amount not changed: 500\.00\b/.test(await textOf('entry-changed-earlier')), await textOf('entry-changed-tag'))

  // A 404 on History: the audit column is exactly as it was, and no tag.
  resetCr({ historyMissing: true })
  await go(`${ROUTE}?store=0142&entry=151`)
  await appears('[data-region="entry-audit"] li[data-fact]')
  await appears('[data-testid="change-request-unavailable"]')
  await settle()
  column = await facts()
  check('🔑 a 404 on History leaves the audit column as it is today — posted, consumed — and nothing crashes', JSON.stringify(column.map((f) => f.kind)) === JSON.stringify(['posted', 'consumed']), column.map((f) => f.kind).join(', '))
  check('…and draws no "Changed" tag', (await tid('entry-changed-tag').count()) === 0)
  resetCr()

  // ======== Ticket 352 — a direct act warns that a waiting request will be superseded ========
  const SUPERVISING = { ...ACCOUNTANT, canSuperviseSettlement: true }
  const SENTENCE = 'The waiting change request will be closed as superseded.'
  const e160Row = FX.accounts['0142'].entries.find((e) => e.entryNumber === 160)
  const W = await page.evaluate(async (e160) => {
    const acc = await import('/src/features/collection/settlement/settlement-fixture.ts')
    const crf = await import('/src/features/collection/settlement/change-request-fixture.ts')
    const find = (n) => acc.SETTLEMENT_ACCOUNTS['0142'].entries.find((e) => e.entryNumber === n)
    const e143 = find(143)
    const e151 = find(151)
    const w143 = crf.waitingRequestOn(e143, { changeRequestId: 'R-352-143', newAmount: 450, requestReason: 'typed 500 instead of 450' })
    const w151 = crf.waitingRequestOn(e151, { changeRequestId: 'R-352-151', newDescription: 'surplus — recount' })
    const w160 = crf.waitingRequestOn(e160, { changeRequestId: 'R-352-160', newAmount: 550 })
    // 2194's SUPERSEDED row: the supervisor whose direct act ended it, at the act's own time.
    const sup = (w, decidedAt) => crf.decidedRequest(w, { status: 'SUPERSEDED', decidedAt })
    return {
      waiting143: crf.historyOf(e143, { spentAmount: 0, openRequest: w143 }),
      cancelled143: crf.historyOf({ ...e143, status: 'CANCELLED' }, { spentAmount: 0, requests: [sup(w143, '2026-10-02T09:15:00')] }),
      waiting151: crf.historyOf(e151, { spentAmount: 200, openRequest: w151 }),
      waiting160: crf.historyOf(e160, { spentAmount: 0, openRequest: w160 }),
      approved160: crf.historyOf({ ...e160, status: 'OPEN' }, { spentAmount: 0, requests: [sup(w160, '2026-10-02T09:40:00')] }),
      supervisor: crf.SUPERVISOR.name,
    }
  }, e160Row)
  const warningIn = (region) => page.locator(`[data-region="${region}"] [data-testid="supersede-warning"]`)
  const warningSays = async (region, kind = 'entry') =>
    (await warningIn(region).count()) === 1 &&
    (await warningIn(region).getAttribute('data-supersede')) === kind &&
    (await warningIn(region).innerText()).trim() ===
      (kind === 'batch' ? 'Any change request waiting on an entry this withdraws will be closed as superseded.' : SENTENCE)
  const openCorrection = async () => {
    await page.locator('[data-testid="correction-act"]').click()
    await appears('[data-testid="correction-reason"]')
  }

  // ---- 35. Cancel ----
  scenario = { access: SUPERVISING }
  resetCr()
  cr.histories[FX.e143] = structuredClone(W.waiting143)
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-card"]')
  await openCorrection()
  check("🔑 Cancel's confirm step says the waiting change request will be closed as superseded", await warningSays('entry-correction'), await textOf('supersede-warning'))
  check('…said once, in the correction pane, before the Reason box', (await warningIn('entry-correction').count()) === 1 && (await before('[data-region="entry-correction"] [data-testid="supersede-warning"]', '[data-testid="correction-reason"]')))
  check('…and the History read is still ONE call, shared with the pane', cr.historyCalls.filter((id) => id === FX.e143).length === 1, String(cr.historyCalls.length))
  await shot('352-cancel-confirm')

  // A refused Cancel: the request stays OPEN, and nothing new is said about it.
  cr.direct['Settlement/Cancel'] = () => ({ accepted: false, refusalReason: 'ENTRY_NOT_OPEN', remainingAmount: 500, status: 'OPEN' })
  await page.locator('[data-testid="correction-reason"]').fill('posted against the wrong branch')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('[data-testid="correction-race"]')
  await settle()
  check('🔑 a refused Cancel leaves the card OPEN — nothing superseded, nothing new said', (await offerOf()) === 'waiting' && (await tid('change-request-superseded').count()) === 0 && (await tid('supersede-warning').count()) === 0, await offerOf())

  // An accepted Cancel: History is re-read, and the card shows the request superseded.
  const e143Account = FX.accounts['0142'].entries.find((e) => e.settlementEntryId === FX.e143)
  cr.direct['Settlement/Cancel'] = () => {
    e143Account.status = 'CANCELLED'
    cr.histories[FX.e143] = structuredClone(W.cancelled143)
    return { accepted: true, refusalReason: '', remainingAmount: 500, status: 'CANCELLED' }
  }
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-card"]')
  const readsBefore = cr.historyCalls.length
  await openCorrection()
  await page.locator('[data-testid="correction-reason"]').fill('posted against the wrong branch')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('[data-testid="change-request-superseded"]')
  await settle()
  check('the direct door is unchanged — { settlementEntryId, reason } to Settlement/Cancel', JSON.stringify(cr.directCalls.at(-1)) === JSON.stringify({ path: 'Settlement/Cancel', body: { settlementEntryId: FX.e143, reason: 'posted against the wrong branch' } }), JSON.stringify(cr.directCalls.at(-1)))
  check('🔑 after an accepted Cancel, History is re-read and the card shows the request SUPERSEDED', cr.historyCalls.length > readsBefore && (await tid('change-request-superseded').getAttribute('data-request')) === 'R-352-143' && (await tid('change-request-card').count()) === 0)
  check("…naming the supervisor whose act closed it, at the act's own time", (await textOf('change-request-superseded-by')) === `Closed on 2026-10-02 09:15 when ${W.supervisor} acted on the entry directly.`, await textOf('change-request-superseded-by'))
  check('…with what was asked (500.00 → 450.00) and why, and the finished sentence beneath', /500\.00\s*→\s*450\.00/.test(await textOf('change-request-superseded')) && (await textOf('change-request-superseded')).includes('typed 500 instead of 450') && (await offerOf()) === 'finished')
  check('🚩 the request is superseded, never "cancelled" (W13)', /superseded/.test(await textOf('change-request-superseded')) && !/request (was )?cancelled/i.test(await textOf('change-request-superseded')))
  await appears('[data-region="entry-audit"] li[data-fact="request-superseded"]')
  check("…and 350's audit column carries it", (await page.locator('[data-region="entry-audit"] li[data-fact="request-superseded"]').count()) === 1)
  check('…and the confirm step is gone with the act', (await tid('supersede-warning').count()) === 0)
  await crKeys('the superseded card')
  await shot('352-cancel-superseded')
  e143Account.status = 'OPEN'

  // Nothing waiting: the confirm step reads exactly as before.
  resetCr()
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-open"]')
  await openCorrection()
  check("🔑 with nothing waiting, Cancel's confirm step carries no sentence", (await tid('supersede-warning').count()) === 0)
  check('…and the pane shows no superseded card for an entry never changed', (await tid('change-request-superseded').count()) === 0)

  // History not answered yet: unknown, said as such — never the silence of "nothing waits".
  resetCr()
  cr.holdHistory = deferred()
  await page.goto(BASE + `${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-loading"]')
  await openCorrection()
  check('🚩 History still in flight: the confirm step says "any change request waiting on this entry…"', (await warningIn('entry-correction').getAttribute('data-supersede')) === 'unknown' && (await textOf('supersede-warning')) === 'Any change request waiting on this entry will be closed as superseded.', await textOf('supersede-warning'))
  cr.holdHistory.release()
  cr.holdHistory = null
  await page.waitForFunction(() => !document.querySelector('[data-testid="supersede-warning"]'), null, { timeout: 8000 }).catch(() => {})
  check('…and once it answers with nothing waiting, the sentence goes', (await tid('supersede-warning').count()) === 0)
  // A 404 on History: a server without the wave holds no request — a true none.
  resetCr({ historyMissing: true })
  await go(`${ROUTE}?store=0142&entry=143`)
  await appears('[data-testid="change-request-unavailable"]')
  await openCorrection()
  check('…a 404 on History is a true none: no sentence, and Cancel still works as before', (await tid('supersede-warning').count()) === 0 && (await tid('correction-commit').count()) === 1)

  // ---- 36. Write off ----
  resetCr()
  cr.histories[FX.e151] = structuredClone(W.waiting151)
  await go(`${ROUTE}?store=0142&entry=151`)
  await appears('[data-testid="change-request-card"]')
  check('(151 is partly spent — its correction is the write-off)', (await page.locator('[data-testid="correction-act"]').getAttribute('data-act')) === 'write-off')
  await openCorrection()
  check("🔑 Write off's confirm step says it too, while a request waits", await warningSays('entry-correction'))
  resetCr()
  await go(`${ROUTE}?store=0142&entry=151`)
  await appears('[data-testid="change-request-open"]')
  await openCorrection()
  check('…and not when nothing waits', (await tid('supersede-warning').count()) === 0)

  // ---- 37. the entry panel's Approve / Reject of a pending entry ----
  resetCr()
  cr.histories[e160Row.settlementEntryId] = structuredClone(W.waiting160)
  await go(`${ROUTE}?store=0142&entry=160`)
  await appears('[data-testid="approval-open-approve"]')
  await appears('[data-testid="change-request-card"]')
  await page.locator('[data-testid="approval-open-approve"]').click()
  await appears('[data-region="approval-dialog"]')
  check("🔑 the entry panel's Approve dialog says the waiting request will be superseded", await warningSays('approval-dialog'))
  await page.keyboard.press('Escape')
  await page.locator('[data-testid="approval-open-reject"]').click()
  await appears('[data-region="approval-dialog"]')
  check('…and so does its Reject dialog', await warningSays('approval-dialog'))
  await shot('352-entry-reject')
  await page.keyboard.press('Escape')
  // An accepted Approve: History re-read, the request superseded, the entry OPEN.
  cr.direct['Settlement/Approve'] = () => {
    e160Row.status = 'OPEN'
    cr.histories[e160Row.settlementEntryId] = structuredClone(W.approved160)
    return { accepted: true, refusalReason: '', remainingAmount: e160Row.amount, status: 'OPEN' }
  }
  await page.locator('[data-testid="approval-open-approve"]').click()
  await appears('[data-region="approval-dialog"]')
  await page.locator('[data-testid="approval-commit"]').click()
  await appears('[data-testid="change-request-superseded"]')
  await settle()
  check("🔑 after an accepted Approve, the re-read shows the request superseded beside the now-open entry's offer", (await tid('change-request-superseded').getAttribute('data-request')) === 'R-352-160' && (await offerOf()) === 'ask', await offerOf())
  e160Row.status = 'PENDING_APPROVAL'
  resetCr()
  await go(`${ROUTE}?store=0142&entry=160`)
  await appears('[data-testid="approval-open-approve"]')
  await appears('[data-testid="change-request-open"]')
  await page.locator('[data-testid="approval-open-approve"]').click()
  await appears('[data-region="approval-dialog"]')
  check('…and with nothing waiting, the dialog carries no sentence', (await tid('supersede-warning').count()) === 0)
  await page.keyboard.press('Escape')

  // ---- 38. the Awaiting approval lane ----
  resetCr()
  await onTab('pending')
  const laneDialog = async (number, act) => {
    const id = FX.pending.find((r) => r.entryNumber === number).settlementEntryId
    await page.locator(`[data-region="settlement-open"] .ag-row[row-id="${id}"] [data-testid="pending-${act}"]`).first().click()
    await appears(`[data-region="approval-dialog"][data-entry="${number}"]`)
  }
  await laneDialog(1203, 'approve')
  check("🔑 the lane's Approve on 1203 (openChangeRequestId set) says the request will be superseded", await warningSays('approval-dialog'))
  await page.keyboard.press('Escape')
  await laneDialog(1203, 'reject')
  check('…and its Reject', await warningSays('approval-dialog'))
  await shot('352-lane-reject')
  await page.keyboard.press('Escape')
  await laneDialog(1202, 'approve')
  check("🔑 1202 (openChangeRequestId '') carries no sentence", (await tid('supersede-warning').count()) === 0)
  await page.keyboard.press('Escape')
  check("…the lane read no History — the row's own field decides", cr.historyCalls.length === 0, String(cr.historyCalls.length))

  // ---- 39. Bulk Cancel ----
  await go(`${ROUTE}/upload?batch=B-352`)
  await appears('[data-testid="batch-commit"]')
  check('🔑 Bulk Cancel says it unconditionally — nothing enumerates a batch', await warningSays('batch-withdraw', 'batch'))
  await crKeys('the batch withdrawal')
  await shot('352-batch')
  scenario = {}
  await go(`${ROUTE}/upload?batch=B-352`)
  await appears('[data-testid="batch-supervisor-only"]')
  check('…an accountant has no act to confirm, so no sentence', (await tid('supersede-warning').count()) === 0)

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
