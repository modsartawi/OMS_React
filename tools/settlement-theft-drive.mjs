// Settlement theft drive (spec 334, ticket 339) — drives the REAL app in Chromium against
// STUBBED envelopes shaped exactly as BackOffice 2150 records them under `## Web
// contract` (branch spec2149). A drive of its own, as 309's is: its question — what a
// theft is, and everything it is NOT — is served by its own fixture (`theft-fixture.ts`,
// the bytes theft.test.ts pins).
//
// ⚠️ Stubbed, never live: no SIS.Api with 2150 is up for this wave, and the assertions
// are about behaviour on SPECIFIC answers (an open-day refusal, a failed lookup) a live
// door will not produce on demand.
//
// Verifies ticket 339's screen behaviour:
//   1. the account: an approved theft is in NEITHER headline figure, is counted beside
//      them, draws no Remaining, and says the day it names;
//   2. correction: an approved theft offers Cancel to a supervisor and never a write-off;
//   3. decide, from the account: the dialog shows the day and — read off the entry's
//      ledger row — that day's cash variance beside the amount; the body names the entry;
//   4. decide, from the queue: the variance is on the row, and no lookup is made;
//   5. find: Open settlements has a Theft tab fed by kind THEFT, in neither other tab;
//      the front page's signpost still counts two jobs; the ledger filters by the kind;
//   6. post: Theft needs a business day, says it waits and moves no cash, and the
//      server's refusal for an open day stands on the day field;
//   7. bulk: the upload offers no Theft, and a refused theft row reads as any other;
//   8. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-theft-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/settlement'
const OPEN_ROUTE = `${ROUTE}/open`
const LEDGER_ROUTE = `${ROUTE}/ledger`
const UPLOAD_ROUTE = `${ROUTE}/upload`

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
const SUPERVISOR = { ...ACCOUNTANT, canSuperviseSettlement: true }

/** The refusal `Settlement/Post` answers for an open or unknown day — English, a
 *  newline, then Arabic, as the contract says the two theft codes are worded. */
const DAY_NOT_CLOSED = 'The business day is not closed for this store.\nيوم العمل غير مغلق لهذا الفرع.'

let scenario = {}
let FX = null
let entries = []
let approveCalls = []
let cancelCalls = []
let closeOutCalls = []
let ledgerCalls = []
let postCalls = []
let accountCalls = 0

const reset = (flags = {}) => {
  scenario = { access: ACCOUNTANT, ...flags }
  entries = structuredClone(FX.entries)
  approveCalls = []
  cancelCalls = []
  closeOutCalls = []
  ledgerCalls = []
  postCalls = []
  accountCalls = 0
}

/** The ledger's reading of an entry: the account row plus what only the ledger carries
 *  (name, currency, and — on a theft — the named day's three figures). */
const asLedgerRow = (e) => ({ ...FX.ledger.find((r) => r.settlementEntryId === e.settlementEntryId), ...e })

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
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(scenario.access))
    if (path === 'Settlement/Account') {
      accountCalls++
      if (q('storeId') !== FX.store)
        return route.fulfill(envelope({ storeId: q('storeId'), storeName: '', entries: [], consumptions: [] }))
      // ⚠️ The account door's rows: `businessDay`, and NONE of the three day figures.
      return route.fulfill(envelope({ storeId: FX.store, storeName: FX.storeName, entries, consumptions: [] }))
    }
    if (path === 'Settlement/Ledger') {
      const asked = Object.fromEntries([...url.searchParams])
      ledgerCalls.push(asked)
      if (q('entryNumber')) {
        if (scenario.lookupFails)
          return route.fulfill(envelope(null, { status: 500, success: false, message: 'Ledger read failed.' }))
        return route.fulfill(envelope(entries.filter((e) => String(e.entryNumber) === q('entryNumber')).map(asLedgerRow)))
      }
      if (scenario.noThefts && q('status') === 'OPEN')
        return route.fulfill(envelope(entries.filter((e) => e.status === 'OPEN' && e.entryKind !== 'THEFT').map(asLedgerRow)))
      // 🔑 `status=OPEN` returns THEFT rows too (the contract's own warning).
      const rows = entries
        .filter((e) => (!q('status') || e.status === q('status')) && (!q('entryKind') || e.entryKind === q('entryKind')))
        .map(asLedgerRow)
        .sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1))
      return route.fulfill(envelope(rows))
    }
    if (path === 'Settlement/Approve') {
      const body = route.request().postDataJSON()
      approveCalls.push(body)
      const entry = entries.find((e) => e.settlementEntryId === body.settlementEntryId)
      if (!entry || entry.status !== 'PENDING_APPROVAL')
        return route.fulfill(envelope({ accepted: false, refusalReason: 'ENTRY_NOT_PENDING', remainingAmount: entry?.remainingAmount ?? 0, status: entry?.status ?? '' }))
      Object.assign(entry, { status: 'OPEN', approvedByStaffId: 'SUP1', approvedAt: '2026-09-30T11:00:00' })
      return route.fulfill(envelope({ accepted: true, refusalReason: '', remainingAmount: entry.remainingAmount, status: 'OPEN' }))
    }
    if (path === 'Settlement/Cancel') {
      const body = route.request().postDataJSON()
      cancelCalls.push(body)
      const entry = entries.find((e) => e.settlementEntryId === body.settlementEntryId)
      Object.assign(entry, { status: 'CANCELLED', closedByStaffId: 'SUP1', closedAt: '2026-09-30T11:05:00', closedReason: body.reason })
      return route.fulfill(envelope({ accepted: true, refusalReason: '', remainingAmount: entry.remainingAmount, status: 'CANCELLED' }))
    }
    if (path === 'Settlement/CloseOut') {
      closeOutCalls.push(route.request().postDataJSON())
      return route.fulfill(envelope({ accepted: false, refusalReason: 'WRONG_KIND', remainingAmount: 0, status: 'OPEN' }))
    }
    if (path === 'Settlement/Branches')
      return route.fulfill(
        envelope([{ storeId: FX.store, storeName: FX.storeName, city: 'Riyadh', area: 'Central', servedBy: '', isMine: true }]),
      )
    if (path === 'Settlement/Post') {
      const body = route.request().postDataJSON()
      postCalls.push(body)
      if (body.entryKind === 'THEFT' && !body.businessDay)
        return route.fulfill(
          envelope(null, { status: 400, success: false, message: 'A theft needs a business day.', errors: [{ errorCode: 'SettlementTheftBusinessDayRequired', errorMessage: 'A theft needs a business day.' }] }),
        )
      // The stub's one open day: 28 September is still trading.
      if (body.entryKind === 'THEFT' && body.businessDay === '2026-09-28')
        return route.fulfill(
          envelope(null, { status: 400, success: false, message: DAY_NOT_CLOSED, errors: [{ errorCode: 'SettlementTheftDayNotClosed', errorMessage: DAY_NOT_CLOSED }] }),
        )
      if (body.entryKind === 'THEFT') return route.fulfill(envelope({ ...FX.posted, amount: Number(body.amount), businessDay: `${body.businessDay}T00:00:00` }))
      return route.fulfill(
        envelope({ settlementEntryId: '01K6POSTSHORT', entryNumber: 1500, amount: Number(body.amount), status: 'OPEN', businessDay: '0001-01-01T00:00:00' }),
      )
    }
    if (path === 'Settlement/Bulk/Preview')
      return route.fulfill(
        envelope({
          batchId: '01K6BATCHTHEFT0000000000AB',
          contentHash: 'sha256:7e57',
          entryKind: 'THEFT',
          rows: [{ rowNumber: 2, storeCode: FX.store, storeName: FX.storeName, currencyKey: 'SAR', amount: 3000, fileAmount: 3000, reason: 'x', awaitsApproval: false }],
          errors: [{ rowNumber: 2, storeCode: FX.store, code: 'THEFT_NOT_IN_BULK', message: 'Row 2: a theft is not accepted in a bulk file.' }],
          warnings: [],
          rowCount: 1,
          canCommit: false,
          total: 3000,
        }),
      )
    if (path === 'Settlement/Uncollected' || path === 'Settlement/Orphans' || path === 'Settlement/Fleet')
      return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const appears = async (selector, timeout = 8000) =>
    page.waitForSelector(selector, { timeout }).then(() => true).catch(() => false)
  const bodyText = async () => page.locator('body').innerText()
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(150)
  }
  /**
   * ⚠️ A navigation that Chromium itself aborted is RETRIED, and only that. When the
   * machine's network configuration changes mid-load, Chromium fails every in-flight
   * request with `net::ERR_NETWORK_CHANGED` — loopback ones included — and the app
   * lands on the router's *"Failed to fetch dynamically imported module"* boundary.
   * That is the harness's weather, not the screen's behaviour (measured while writing
   * this drive: 38 aborted requests in twelve loads, none in the next twelve). The
   * attempt's page errors and recorded calls are dropped with it, so a retried load is
   * counted once; nothing else is retried, and an assertion that fails stays failed.
   */
  const go = async (to) => {
    for (let attempt = 1; ; attempt++) {
      const before = netChanged
      const marks = [errors, ledgerCalls, postCalls, approveCalls, cancelCalls, closeOutCalls].map((a) => [a, a.length])
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
      for (const [list, length] of marks) list.length = length
      await page.waitForTimeout(500)
    }
  }
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
  const noRawKeys = async (where) => {
    const text = await bodyText()
    check(
      `${where} → no raw t() key on screen`,
      !/\b(approval|post|account|correction|ledger)\.[a-z]+\.[a-zA-Z]|settlement:|open\.(tabs|columns|empty|row|sections)\./.test(text),
    )
  }
  const count = async (tab) => page.locator(`[data-testid="open-count-${tab}"]`).innerText()

  await go('/login')
  FX = await page.evaluate(async () => {
    const m = await import('/src/features/collection/settlement/theft-fixture.ts')
    return {
      entries: m.THEFT_ENTRIES,
      ledger: m.THEFT_LEDGER,
      posted: m.THEFT_POST_RESULT,
      store: m.THEFT_STORE,
      storeName: m.THEFT_STORE_NAME,
      pendingId: m.PENDING_THEFT_ID,
      approvedId: m.APPROVED_THEFT_ID,
    }
  })

  // ---- 1. the account ----
  reset()
  await go(`${ROUTE}?store=${FX.store}`)
  let text = await page.locator('[data-region="account-headline"]').innerText()
  check('🔑 the headline is 200 of shortage and 150 of surplus — the approved 450.75 theft is in neither', text.includes('200.00') && text.includes('150.00') && !text.includes('600.75') && !text.includes('450.75'), text.replace(/\n/g, ' '))
  check('…it nets to a 50 shortage, with 2 entries open — the theft is not one a till can consume', text.includes('50.00') && text.includes('shortage — to be handed over') && /entries open\s*2/i.test(text))
  check('🔑 the approved theft is counted BESIDE the figures, as an entry', (await page.locator('[data-testid="account-theft-count"]').innerText()).startsWith('1 approved theft') && (await page.locator('[data-testid="account-theft-count"]').innerText()).includes('moves no cash'))
  check('…and the pending theft is counted as waiting', (await page.locator('[data-testid="account-pending-count"]').innerText()).startsWith('1 entry waits'))
  const grid = await page.locator('[data-region="branch-account"] .ag-root-wrapper').first().innerText()
  check('the grid labels the kind Theft · سرقة', (grid.match(/Theft · سرقة/g) ?? []).length === 3, `${(grid.match(/Theft · سرقة/g) ?? []).length} rows`)
  const remaining = await page.locator('[data-region="branch-account"] .ag-row [col-id="remainingAmount"]').allInnerTexts()
  check('🚩 no theft row draws a Remaining — only the shortage and the surplus do', remaining.filter((c) => c.trim() === '—').length === 3 && remaining.filter((c) => /\d/.test(c)).length === 2, remaining.join(' | '))
  await noRawKeys('the account')
  await shot('339-account')

  // ---- 1b. a pending theft, as an accountant ----
  await go(`${ROUTE}?store=${FX.store}&entry=1412`)
  await appears('[data-region="entry-approval"]')
  check('an accountant on a pending theft sees that it waits — and no Approve', (await page.locator('[data-region="entry-approval"]').getAttribute('data-approval')) === 'waiting' && (await page.locator('[data-testid="approval-open-approve"]').count()) === 0)
  text = await page.locator('[data-testid="journal-empty"]').innerText()
  check('the journal says a theft moves no cash, and names its day', text.includes('moves no cash') && text.includes('2026-09-27'), text)
  check('…and nothing can be cancelled or written off while it waits', (await page.locator('[data-testid="correction-act"]').count()) === 0)

  // ---- 1c. a rejected theft ----
  await go(`${ROUTE}?store=${FX.store}&entry=1414`)
  await appears('[data-testid="approval-rejected"]')
  text = await page.locator('[data-region="entry-approval"]').innerText()
  check('a rejected theft: the day keeps its variance and no shortage was posted', text.includes('keeps its cash variance') && text.includes('no shortage was posted') && !/surplus/i.test(text), text.replace(/\n/g, ' ').slice(0, 200))

  // ---- 2. correction on an approved theft ----
  await go(`${ROUTE}?store=${FX.store}&entry=1413`)
  await appears('[data-region="entry-correction"]')
  text = await page.locator('[data-region="entry-correction"]').innerText()
  check('an accountant is told only a supervisor can cancel an approved theft', (await page.locator('[data-region="entry-correction"]').getAttribute('data-correction')) === 'supervisor-only' && text.includes('approved theft') && (await page.locator('[data-testid="correction-act"]').count()) === 0)
  reset({ access: SUPERVISOR })
  await go(`${ROUTE}?store=${FX.store}&entry=1413`)
  await appears('[data-testid="correction-act"]')
  check('🔑 a supervisor is offered Cancel — and NO close-out', (await page.locator('[data-testid="correction-act"]').getAttribute('data-act')) === 'cancel' && (await page.locator('[data-testid="correction-act"]').count()) === 1)
  text = await page.locator('[data-testid="correction-cancel-why"]').innerText()
  check('…with a theft’s own reason: no remainder to write off, the day returns to its variance', text.includes('no remainder to write off') && text.includes('cash variance'), text)
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('بلاغ خاطئ')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('text=Entry 1413 is cancelled.')
  await settle()
  check('cancelling goes to Settlement/Cancel, and CloseOut is never called', cancelCalls.length === 1 && cancelCalls[0].settlementEntryId === FX.approvedId && closeOutCalls.length === 0, JSON.stringify(cancelCalls))

  // ---- 3. decide, from the account ----
  reset({ access: SUPERVISOR })
  await go(`${ROUTE}?store=${FX.store}&entry=1412`)
  await appears('[data-testid="approval-open-approve"]')
  await page.locator('[data-testid="approval-open-approve"]').click()
  await appears('[data-region="approval-dialog"]')
  await appears('[data-testid="approval-day-variance"][data-variance="short"]')
  const dialog = await page.locator('[data-region="approval-dialog"]').innerText()
  await shot('339-approve-dialog')
  check('🔑 the dialog shows the named day beside the amount', (await page.locator('[data-testid="approval-business-day"]').innerText()) === '2026-09-27' && (await page.locator('[data-testid="approval-amount"]').innerText()).includes('3,000.00') && (await page.locator('[data-testid="approval-amount"]').innerText()).includes('Theft · سرقة'))
  text = await page.locator('[data-testid="approval-day-variance"]').innerText()
  check('🔑 …and that day’s cash variance: 3,000 short, 500 counted against 3,500', text.includes('3,000.00 short') && text.includes('500.00 counted') && text.includes('3,500.00 of system cash'), text)
  check('…read off the entry’s own ledger row — the account door carries no day figures', ledgerCalls.some((c) => c.entryNumber === '1412'), JSON.stringify(ledgerCalls))
  check('the explanation says a theft moves no cash — and never calls it a deduction', (await page.locator('[data-testid="approval-explain"]').innerText()).includes('moves no cash') && !/deduct|keep this amount back/i.test(dialog), dialog.replace(/\n/g, ' ').slice(0, 220))
  await page.locator('[data-testid="approval-commit"]').click()
  await appears('text=Entry 1412 is approved and open.')
  await settle()
  check('the approve body names the entry and nothing else', approveCalls.length === 1 && JSON.stringify(approveCalls[0]) === JSON.stringify({ settlementEntryId: FX.pendingId }), JSON.stringify(approveCalls))
  text = await page.locator('[data-region="account-headline"]').innerText()
  check('🔑 approved → still not money: the figures have not moved, and 2 thefts are counted beside them', text.includes('200.00') && text.includes('150.00') && !text.includes('3,000') && (await page.locator('[data-testid="account-theft-count"]').innerText()).startsWith('2 approved thefts') && (await page.locator('[data-testid="account-pending-count"]').count()) === 0, text.replace(/\n/g, ' '))

  // A lookup that fails is said, and does not pass for "no variance".
  reset({ access: SUPERVISOR, lookupFails: true })
  await go(`${ROUTE}?store=${FX.store}&entry=1412`)
  await page.locator('[data-testid="approval-open-reject"]').click()
  await appears('[data-region="approval-dialog"]')
  await page.waitForFunction(() => /could not be read/.test(document.querySelector('[data-testid="approval-day-variance"]')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => {})
  text = await page.locator('[data-testid="approval-day-variance"]').innerText()
  check('🚩 a day whose cash could not be read says so — never “no variance”', text.includes('could not be read') && !/No variance/.test(text) && (await page.locator('[data-testid="approval-business-day"]').innerText()) === '2026-09-27', text)
  check('…and rejecting a theft says the day keeps its variance and no shortage is posted', (await page.locator('[data-testid="approval-explain"]').innerText()).includes('no shortage is posted'))

  // ---- 4. decide, from the queue ----
  reset({ access: SUPERVISOR })
  await go(`${OPEN_ROUTE}?tab=pending`)
  check('the queue lists the pending theft', (await count('pending')) === '1' && (await page.locator('[data-testid="pending-approve"]').count()) === 1)
  text = await page.locator('[data-region="settlement-open"] .ag-root-wrapper').first().innerText()
  check('…labelled Theft, with the day it names', text.includes('Theft · سرقة') && text.includes('for 2026-09-27'), text.replace(/\n/g, ' ').slice(0, 200))
  const before = ledgerCalls.length
  await page.locator('[data-testid="pending-approve"]').click()
  await appears('[data-testid="approval-day-variance"][data-variance="short"]')
  check('🔑 from the queue the variance is already on the row — no lookup is made', ledgerCalls.length === before && (await page.locator('[data-testid="approval-day-variance"]').innerText()).includes('3,000.00 short'), `${ledgerCalls.length - before} extra call(s)`)
  await noRawKeys('the queue’s dialog')
  await page.keyboard.press('Escape')

  // ---- 5. find ----
  reset()
  await go(OPEN_ROUTE)
  check('🔑 the tab strip: Shortage 1, Surplus 1, Theft 1 — one answer split three ways', (await count('owing')) === '1' && (await count('owed')) === '1' && (await count('theft')) === '1')
  check('…off ONE ledger call for OPEN, and none asking for the kind', ledgerCalls.filter((c) => c.status === 'OPEN').length === 1 && !ledgerCalls.some((c) => c.entryKind), JSON.stringify(ledgerCalls))
  await page.locator('[role="tab"][data-tab="theft"]').click()
  // The tab is an address: wait for the strip to say it is selected, not for a timer.
  await appears('[role="tab"][data-tab="theft"][aria-selected="true"]')
  await appears('[data-region="settlement-open"] .ag-row [col-id="businessDay"]')
  await settle()
  check('the Theft tab is an address: ?tab=theft', page.url().includes('tab=theft') && (await page.locator('[role="tab"][data-tab="theft"]').innerText()).startsWith('Theft'))
  text = await page.locator('[data-region="settlement-open"]').innerText()
  check('🔑 it lists the approved theft with its day, its amount and what the day was short', text.includes('1413') && text.includes('2026-09-20') && text.includes('450.75') && text.includes('450.75 short'), text.replace(/\n/g, ' ').slice(0, 300))
  check('…and neither the shortage, the surplus nor the pending theft', !text.includes('1410') && !text.includes('1411') && !text.includes('1412'))
  check('🚩 no chase and no age on a theft — nobody is rung about one', (await page.locator('[data-testid="open-chase-button"]').count()) === 0 && !/still open|last chased|\bage\b/i.test(text))
  check('the subtitle says a theft moves no cash, and never “deduct”', text.includes('moves no cash') && !/deduct/i.test(text))
  await noRawKeys('the theft tab')
  await shot('339-theft-tab')
  await go(`${OPEN_ROUTE}?tab=owed`)
  text = await page.locator('[data-region="settlement-open"] .ag-root-wrapper').first().innerText()
  check('🚩 the Surplus tab holds the surplus alone — the approved theft is not in it', text.includes('1411') && !text.includes('1413'))
  reset({ noThefts: true })
  await go(`${OPEN_ROUTE}?tab=theft`)
  check('an estate with no approved theft says so — its own good news, and the count is 0', (await page.locator('[data-testid="open-empty"]').innerText()).includes('No approved theft.') && (await count('theft')) === '0')
  reset()
  await go(ROUTE)
  await appears('[data-region="open-signpost"]')
  check('🚩 the front page’s signpost still counts the two jobs — a theft is nobody’s to chase', (await page.locator('[data-region="open-signpost"] [data-signpost]').count()) === 2 && (await page.locator('[data-signpost="theft"]').count()) === 0 && (await page.locator('[data-testid="signpost-count-owed"]').innerText()) === '1')

  reset()
  await go(LEDGER_ROUTE)
  check('the ledger offers Theft as a kind', (await page.locator('[data-region="ledger-kind"] [data-chip="THEFT"]').innerText()) === 'Theft · سرقة')
  await page.locator('[data-region="ledger-kind"] [data-chip="THEFT"]').click()
  // The grid draws its rows a frame after the answer lands — wait for the row itself,
  // by its entry number, not for a timer (and not for *a* row: the last answer's linger).
  const ledgerShows = (entry) =>
    page
      .waitForFunction((n) => (document.querySelector('[data-region="settlement-ledger"] .ag-center-cols-container')?.textContent ?? '').includes(n), entry, { timeout: 8000 })
      .catch(() => {})
  await ledgerShows('1412')
  await settle()
  check('…asks the door for entryKind=THEFT', ledgerCalls.some((c) => c.entryKind === 'THEFT') && page.url().includes('kind=THEFT'), JSON.stringify(ledgerCalls))
  text = await page.locator('[data-region="settlement-ledger"]').innerText()
  check('…and lists the three thefts with their business day', (await page.locator('[data-testid="ledger-count"]').innerText()).includes('3') && /business day/i.test(text) && text.includes('2026-09-27') && text.includes('2026-09-20'), text.replace(/\n/g, ' ').slice(300, 700))
  await page.locator('[data-region="ledger-kind"] [data-chip="SHORTAGE"]').click()
  await ledgerShows('1410')
  await settle()
  text = await page.locator('[data-region="settlement-ledger"]').innerText()
  check('…a result with no theft draws no Business day column', text.includes('1410') && !/business day/i.test(text), text.replace(/\n/g, ' ').slice(300, 600))

  // ---- 6. post ----
  reset()
  await go(`${ROUTE}?store=${FX.store}`)
  await page.locator('[data-testid="post-open"]').click()
  await appears('[data-region="post-entry"]')
  check('the post dialog offers three kinds, Theft last', (await page.locator('[data-region="post-kind"] [data-kind]').count()) === 3 && (await page.locator('[data-region="post-kind"] [data-kind]').last().getAttribute('data-kind')) === 'THEFT')
  check('a shortage asks for no business day', (await page.locator('[data-testid="post-business-day"]').count()) === 0)
  await page.locator('dialog [data-kind="THEFT"]').click()
  await appears('[data-testid="post-business-day"]')
  text = await page.locator('[data-testid="post-theft-note"]').innerText()
  check('🔑 choosing Theft says it always waits for a supervisor and moves no cash', text.includes('always waits for an accountant supervisor') && text.includes('moves no cash') && !/deduct/i.test(text), text)
  check('…and draws no standing position — there is none for a theft', (await page.locator('[data-testid="post-standing"], [data-testid="post-standing-clear"]').count()) === 0)
  await page.locator('[data-testid="post-amount"]').fill('3000')
  await page.locator('[data-testid="post-reason"]').fill('سرقة من الخزنة - بلاغ رقم 5521')
  await page.waitForTimeout(150)
  check('🔑 without a business day the form is not ready', (await page.locator('[data-testid="post-review"]').getAttribute('aria-disabled')) === 'true')
  await page.locator('[data-testid="post-review"]').click({ force: true })
  await page.waitForTimeout(150)
  check('…and a press on Review says which field is missing, and posts nothing', (await page.locator('[data-testid="post-business-day-error"]').innerText()).includes('Choose the business day') && (await page.locator('[data-region="post-review"]').count()) === 0 && postCalls.length === 0)
  await shot('339-post-form')

  // An open day: the server refuses, on the day field.
  await page.locator('[data-testid="post-business-day"]').fill('2026-09-28')
  await page.waitForTimeout(150)
  await page.locator('[data-testid="post-review"]').click()
  await appears('[data-region="post-review"]')
  text = await page.locator('[data-testid="post-review-consequence"]').innerText()
  check('the review reads the day back with the branch', text.includes('2026-09-28') && text.includes(FX.store) && text.includes('moves no cash'), text)
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-testid="post-business-day-error"]')
  text = await page.locator('[data-testid="post-business-day-error"]').innerText()
  check('🔑 the server’s refusal for an open day stands on the DAY field, in its own words', text.includes('The business day is not closed for this store.') && text.includes('يوم العمل غير مغلق'), text.replace(/\n/g, ' ⏎ '))
  check('…back on the form, with everything typed still in it', (await page.locator('[data-region="post-review"]').count()) === 0 && (await page.locator('[data-testid="post-amount"]').inputValue()) === '3000' && (await page.locator('[data-testid="post-business-day"]').inputValue()) === '2026-09-28')
  check('…and not as a toast that something failed', !/could not be posted/.test(await bodyText()))

  // A closed day posts.
  await page.locator('[data-testid="post-business-day"]').fill('2026-09-27')
  await page.waitForTimeout(150)
  check('changing the day clears the refusal', (await page.locator('[data-testid="post-business-day-error"]').count()) === 0)
  await page.locator('[data-testid="post-review"]').click()
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  const sent = postCalls.at(-1)
  check('🔑 the body is the contract’s: store, THEFT, amount, description and a bare yyyy-MM-dd day', JSON.stringify(sent) === JSON.stringify({ storeId: FX.store, entryKind: 'THEFT', amount: 3000, reason: 'سرقة من الخزنة - بلاغ رقم 5521', businessDay: '2026-09-27' }), JSON.stringify(sent))
  text = await page.locator('[data-region="post-done"]').innerText()
  check('🔑 the confirmation says it waits for a supervisor — as a theft, not as a surplus', (await page.locator('[data-testid="post-done-pending"]').innerText()).startsWith('This theft waits') && !/surplus|keep (it|this) back/i.test(text), text.replace(/\n/g, ' ').slice(0, 260))
  check('…with its number, its amount and the day the server stored', text.includes('Entry 1412 is posted.') && text.includes('3,000') && text.includes('2026-09-27'))
  await noRawKeys('the post confirmation')
  await shot('339-post-done')
  await page.locator('[data-testid="post-close"]').click()

  // The other kinds send no day.
  await page.locator('[data-testid="post-open"]').click()
  await appears('[data-region="post-entry"]')
  await page.locator('dialog [data-kind="THEFT"]').click()
  await page.locator('[data-testid="post-business-day"]').fill('2026-09-27')
  await page.locator('dialog [data-kind="SHORTAGE"]').click()
  await page.locator('[data-testid="post-amount"]').fill('75')
  await page.locator('[data-testid="post-reason"]').fill('عجز')
  await page.waitForTimeout(150)
  await page.locator('[data-testid="post-review"]').click()
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  check('🚩 a shortage sends NO business day — even one left in the box from a theft', postCalls.at(-1).entryKind === 'SHORTAGE' && !('businessDay' in postCalls.at(-1)), JSON.stringify(postCalls.at(-1)))

  // ---- 7. bulk ----
  reset()
  await go(UPLOAD_ROUTE)
  await appears('[data-region="bulk-kind"]')
  check('🔑 the upload offers two kinds — and no Theft', (await page.locator('[data-region="bulk-kind"] [data-kind]').count()) === 2 && (await page.locator('[data-region="bulk-kind"] [data-kind="THEFT"]').count()) === 0)
  check('…and none of its help text mentions one', !/theft|سرقة/i.test(await page.locator('[data-region="bulk-upload"]').innerText()))
  await page.locator('[data-testid="bulk-file"]').setInputFiles({ name: 'thefts.csv', mimeType: 'text/csv', buffer: Buffer.from('StoreCode,Amount,Reason\nP019,3000,x\n') })
  await page.locator('[data-testid="bulk-preview"]').click()
  await appears('[data-testid="bulk-blockers"]')
  text = await page.locator('[data-region="bulk-upload"]').innerText()
  check('a server refusal on a theft row is shown as any other: named, and nothing commits', text.includes('a theft is not accepted in a bulk file') && (await page.locator('[data-testid="bulk-commit"]').getAttribute('aria-disabled')) === 'true', text.replace(/\n/g, ' ').slice(0, 200))

  check('no page error and no React crash, across every scenario', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
