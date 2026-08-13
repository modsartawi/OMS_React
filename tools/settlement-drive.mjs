// Settlement account drive (spec 267, ticket 268) — drives the REAL app in Chromium
// against a MOCKED CollectionWeb/Access envelope. This is the wave's screens drive;
// 269–273 EXTEND this file rather than starting a second one.
//
// ⚠️ The envelope is stubbed for a reason that is not going away soon: the fifth
// grant `canOpenSettlement` does not exist on the live door (BackOffice spec 1173,
// joined by ticket 274), so a live probe answers FOUR booleans and this screen is
// shut for every real session today. Both of 268's Proof bullets are about which of
// two things a session sees, and only a stub can put a session on each side of that
// line. (Spec 267 §Testing Decisions: do not repoint a drive at live — its
// assertions are about behaviour on SPECIFIC responses.)
//
// Verifies ticket 268's Proof:
//   1. granted → the Settlement leaf appears as the FIFTH item of the existing
//      Collections group, and /collection/settlement renders the shell — header,
//      the inert scope control, the empty state;
//   2. ungranted → the leaf is ABSENT and a hand-typed /collection/settlement
//      renders the denied backstop rather than a broken screen — while the four
//      inquiry leaves the session DOES hold stay put (the ragged group);
//   3. the four-boolean answer the live door returns today behaves exactly as
//      ungranted — no leaf, route refused — with the other four untouched;
//   4. a 403 reads as a REFUSAL (see an administrator) and a 500 as UNREACHABLE
//      (try again); both deny, only the sentence differs;
//   5. the five leaves + the screen's own gate cost ONE CollectionWeb/Access call;
//   6. every t() call renders a real string — the `settlement` namespace is
//      registered, not merely created (a raw `settlement:menu.settlement` on screen
//      is the failure this catches).
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const ROUTE = '/collection/settlement'
const TITLE = 'Settlement account'
const LEAF = 'Settlement Account'
const DENIED = 'No access to this screen'
const UNREACHABLE = 'This screen is unavailable'

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

const NONE = {
  canOpenCollections: false,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenSettlement: false,
}
const ALL = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenSettlement: true,
}
/** What `CollectionWeb/Access` actually answers today: four flags, no fifth. */
const FOUR_FLAGS = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
}

let scenario = { accessBody: ALL, access403: false, access500: false }
let accessCalls = 0
/** The six hostile branches, filled from `settlement-fixture.ts` once the app is up. */
let ACCOUNTS = {}
/** Ticket 270's estate: 1394 fleet rows, the two enumerated lanes, the flat ledger —
 *  all three read out of `fleet-fixture.ts`, the module the vitest suites pin. */
let FLEET = []
let WORKLIST = { orphans: [], uncollected: [], ageingThresholdDays: 30 }
let LEDGER = []
/** The consumption whose document arrives MID-CLICK — the OLDEST orphan, picked
 *  once the fixture is loaded. Repairing it must come back a no-op (a 200 that
 *  changed nothing) rather than an error. */
let NOOP_CONSUMPTION = ''
let repairCalls = []
/** Ticket 271's write: every body the posting form sent, and the numbers the stub
 *  minted for them. An entry number is the handle finance settles by on the phone. */
let postCalls = []
let nextEntryNumber = 900
/** Ticket 272's two corrections, and 🔑 **the entry whose cancel LOSES the race**:
 *  0142/143 is untouched on the fixture, so the screen offers *Cancel* — and a till
 *  consumes 150 of it a millisecond before the button lands. */
let cancelCalls = []
let closeOutCalls = []
const RACE_ENTRY = '01J9SETL0142A'
/** …and the entry whose cancel is refused for a reason that is **not** this race:
 *  the remaining does not move, so there is nothing to write off instead and the
 *  screen must offer NOTHING rather than the same button again. */
const REFUSE_ENTRY = '01J9SETL0207B'

/** One entry across the six branches, with the account it belongs to — the stub
 *  writes through to the fixture so a refetch agrees with the answer it just gave. */
function findEntry(settlementEntryId) {
  for (const account of Object.values(ACCOUNTS)) {
    const entry = account.entries.find((e) => e.settlementEntryId === settlementEntryId)
    if (entry) return { account, entry }
  }
  return null
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // ⚠️ The browser logs a console error for every non-2xx response, and scenario 4
  // asks for a 403 and a 500 ON PURPOSE. Those two are the drive working, not the
  // app breaking — what this list is for is a React crash or an unhandled rejection,
  // so the expected transport noise is filtered out rather than the check weakened.
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/Failed to load resource/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = route.request().url().split('/api/')[1].split('?')[0]
    // ---- ticket 269: one branch's account ----
    // Served from the app's OWN fixture module (loaded below), never from a copy
    // pasted in here: the six hostile branches are one set of bytes, shared with the
    // vitest suite. ⚠️ Spec 267 §Testing Decisions forbids repointing this at live —
    // the live estate does not contain an orphan consumption or a CLOSED_OUT beside
    // a CANCELLED on demand, so a live drive would assert them vacuously.
    if (path === 'Settlement/Account') {
      const storeId = url.searchParams.get('storeId') || ''
      const account = ACCOUNTS[storeId]
      if (!account)
        return route.fulfill(
          envelope(null, { status: 404, success: false, message: 'No such branch' }),
        )
      return route.fulfill(envelope(account))
    }
    // ---- ticket 270: the door ----
    // The fleet is served ESTATE-WIDE whatever the scope asks for, which is what the
    // client sends (`scope=all`) — the scope is applied on the client so that the two
    // enumerated lanes stay estate-wide under every scope. See `scope.ts`.
    if (path === 'Settlement/Fleet') return route.fulfill(envelope(FLEET))
    if (path === 'Settlement/Worklist') return route.fulfill(envelope(WORKLIST))
    if (path === 'Settlement/Ledger') {
      const entryNumber = url.searchParams.get('entryNumber') || ''
      const storeId = url.searchParams.get('storeId') || ''
      const entryKind = url.searchParams.get('entryKind') || ''
      const status = url.searchParams.get('status') || ''
      const rows = LEDGER.filter(
        (r) =>
          (!entryNumber || String(r.entryNumber) === entryNumber) &&
          (!storeId || r.storeId === storeId) &&
          (!entryKind || r.entryKind === entryKind) &&
          (!status || r.status === status),
      ).slice(0, Number(url.searchParams.get('limit') || 500))
      return route.fulfill(envelope(rows))
    }
    // ---- ticket 271: posting one entry ----
    // 🔑 **The server rounds, and this stub rounds the same way** — to what the
    // branch can physically count (2 decimals at a SAR branch, 3 at a BHD one). The
    // answer carries the ROUNDED figure, which is what the screen's confirmation must
    // read back: the whole point of D4 is that the words an accountant approved and
    // the figure in the ledger cannot disagree. A stub that echoed the request would
    // have made that unprovable.
    if (path === 'Settlement/Post') {
      const body = route.request().postDataJSON() || {}
      postCalls.push(body)
      const account = ACCOUNTS[body.storeId]
      const decimals = account?.currencyKey === 'BHD' ? 3 : 2
      const factor = 10 ** decimals
      const amount = Math.round(Number(body.amount) * factor) / factor
      const entryNumber = nextEntryNumber++
      const settlementEntryId = `01J9SETLPOST${entryNumber}`
      if (account)
        account.entries = [
          ...account.entries,
          {
            settlementEntryId,
            entryNumber,
            storeId: body.storeId,
            entryKind: body.entryKind,
            amount,
            remainingAmount: amount,
            reason: body.reason,
            status: 'OPEN',
            batchId: '',
            postedByStaffId: '30117',
            postedByName: 'هدى القحطاني / Huda Al-Qahtani',
            postedAt: '2026-08-13T09:00:00',
            closedByStaffId: '',
            closedAt: '',
            closedReason: '',
          },
        ]
      return route.fulfill(envelope({ entryNumber, settlementEntryId, amount }))
    }
    // ---- ticket 272: the two corrections ----
    // 🔑 **A refusal is a 200 with a true remaining, never an error**, exactly as
    // the till's own consume is (D8). The stub therefore has to be able to LOSE the
    // race on demand — the live estate cannot be asked to consume an entry between a
    // list being drawn and a button being pressed, which is precisely why spec 267
    // forbids repointing this drive at live.
    if (path === 'Settlement/Cancel') {
      const body = route.request().postDataJSON() || {}
      cancelCalls.push(body)
      const found = findEntry(body.settlementEntryId)
      if (body.settlementEntryId === RACE_ENTRY) {
        // A till consumed 150 of the 500 a millisecond before this call landed. The
        // fixture moves with the refusal, so the refetch underneath agrees with the
        // figure the refusal carried — a stub that refused without moving would let
        // a screen that ignored the answer still look right.
        if (found && found.entry.remainingAmount === found.entry.amount) {
          found.entry.remainingAmount = 350
          found.account.consumptions.push({
            settlementConsumptionId: '01J9SCON0142A9',
            settlementEntryId: RACE_ENTRY,
            consumptionKind: 'CONSUME',
            storeId: '0142',
            amount: 150,
            remainingAfter: 350,
            documentType: 'SPECIAL_RECEIPT',
            documentId: 'SR01420021',
            documentNumber: 'SR-0142-0021',
            businessDay: '2026-08-13',
            consumedByOperatorId: '41207',
            consumedAt: '2026-08-13T08:58:00',
          })
        }
        return route.fulfill(
          envelope({
            accepted: false,
            refusalReason: 'A till consumed part of this entry.',
            remainingAmount: 350,
          }),
        )
      }
      // A refusal whose remaining did NOT move — not this race, and not an act the
      // screen may offer again unchanged.
      if (body.settlementEntryId === REFUSE_ENTRY)
        return route.fulfill(
          envelope({
            accepted: false,
            refusalReason: 'This entry belongs to a batch that is being cancelled.',
            remainingAmount: found?.entry.remainingAmount ?? 0,
          }),
        )
      if (found) {
        found.entry.status = 'CANCELLED'
        found.entry.closedByStaffId = '30117'
        found.entry.closedAt = '2026-08-13T09:20:00'
        found.entry.closedReason = body.reason
      }
      return route.fulfill(
        envelope({ accepted: true, refusalReason: '', remainingAmount: found?.entry.amount ?? 0 }),
      )
    }
    if (path === 'Settlement/CloseOut') {
      const body = route.request().postDataJSON() || {}
      closeOutCalls.push(body)
      const found = findEntry(body.settlementEntryId)
      const forgiven = found?.entry.remainingAmount ?? 0
      if (found) {
        // 🚩 The write-off touches NO consumption — the journal array is not
        // read here, let alone written. That is the property the screen shows by
        // leaving the journal on screen under the act.
        found.entry.status = 'CLOSED_OUT'
        found.entry.remainingAmount = 0
        found.entry.closedByStaffId = '30117'
        found.entry.closedAt = '2026-08-13T09:25:00'
        found.entry.closedReason = body.reason
      }
      return route.fulfill(envelope({ accepted: true, remainingAmount: forgiven }))
    }
    if (path === 'Settlement/Repair') {
      const body = route.request().postDataJSON() || {}
      repairCalls.push(body)
      // 🔑 The race, lost: a document arrived for this consumption between the list
      // being drawn and the button being pressed. The server's guard is inside its
      // UPDATE, so nothing happened — and it is a 200, not a failure.
      if (body.settlementConsumptionId === NOOP_CONSUMPTION)
        return route.fulfill(envelope({ accepted: false, noOp: true, remainingAfter: 0, refusalReason: '' }))
      // …and the ordinary repair: the money goes back on the entry, and the lane it
      // came from no longer holds it.
      WORKLIST = {
        ...WORKLIST,
        orphans: WORKLIST.orphans.filter(
          (o) => o.settlementConsumptionId !== body.settlementConsumptionId,
        ),
      }
      return route.fulfill(envelope({ accepted: true, noOp: false, remainingAfter: 450, refusalReason: '' }))
    }
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'CollectionWeb/Access') {
      accessCalls++
      // The bare 403 the default-deny inversion (issue 802) hands a browser while a
      // route is unmarked — the realistic answer for a young door, not a hypothetical.
      if (scenario.access403)
        return route.fulfill(envelope(null, { status: 403, success: false, message: 'Forbidden' }))
      if (scenario.access500)
        return route.fulfill(
          envelope(null, { status: 500, success: false, message: 'Server error' }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    // The neighbours' doors, answered with an empty LIST rather than the empty
    // object below: scenario 3 reads the nav from `/collection/collections`, whose
    // grid iterates its rows, and a `{}` there would crash a screen this drive is
    // not about. Their contents are `tools/collection-drive.mjs`'s business.
    if (
      path === 'CollectionWeb/Collections' ||
      path === 'CollectionWeb/Acrs' ||
      path === 'CollectionWeb/Attempts'
    )
      return route.fulfill(envelope([]))
    if (path === 'CollectionWeb/Deposits') return route.fulfill(envelope({ rows: [], balances: [] }))
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    // ⚠️ 268 fetches NOTHING of its own, and that is a thing this drive asserts
    // rather than merely tolerates — see the Settlement/* counter below.
    return route.fulfill(envelope({}))
  })

  // A ledger call from a ticket that is supposed to fetch nothing would be silent
  // otherwise: the stub above answers everything with a benign success.
  let settlementCalls = 0
  page.on('request', (r) => {
    if (/\/api\/Settlement/i.test(r.url())) settlementCalls++
  })

  const leafCount = async () => page.getByRole('link', { name: LEAF, exact: true }).count()
  const inquiryLeaves = async () =>
    (
      await page
        .getByRole('link', { name: /Cash Collections|^ACRs$|^Deposits$|Collection Attempts/ })
        .all()
    ).length
  const groupCount = async () => page.getByRole('button', { name: /^Collections$/ }).count()
  const mainText = async () => page.locator('main').innerText()
  const open = async (body, flags = {}) => {
    scenario = { accessBody: body, access403: false, access500: false, ...flags }
    await page.goto(BASE + ROUTE)
    await page.waitForLoadState('networkidle')
    return mainText()
  }

  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')

  // The six branches, read out of the app's OWN fixture module rather than copied in
  // here: it is TypeScript, this drive is plain node, and vite is already serving
  // `/src/**.ts` as a transformed ES module. One transcription, and it is the one
  // `account-projection.test.ts` pins. (`collection-drive.mjs` does the same.)
  ACCOUNTS = await page.evaluate(async () => {
    const m = await import('/src/features/collection/settlement/settlement-fixture.ts')
    return m.SETTLEMENT_ACCOUNTS
  })
  // …and 270's estate, from the module the vitest suites assert against: 1394
  // branches, 1255 of them assigned to nobody, four orphan consumptions and 140
  // ageing entries of which 47 are in scope.
  const estate = await page.evaluate(async () => {
    const m = await import('/src/features/collection/settlement/fleet-fixture.ts')
    return { fleet: m.SETTLEMENT_FLEET, worklist: m.SETTLEMENT_WORKLIST, ledger: m.SETTLEMENT_LEDGER }
  })
  FLEET = estate.fleet
  WORKLIST = estate.worklist
  LEDGER = estate.ledger
  // The oldest orphan is the one whose document arrives mid-click.
  NOOP_CONSUMPTION = [...WORKLIST.orphans].sort((a, b) => b.ageDays - a.ageDays)[0]
    .settlementConsumptionId

  // ---- Scenario 1: granted ----
  let text = await open(ALL)
  check('granted → the screen renders its header', text.includes(TITLE) && !text.includes(DENIED), text.replace(/\n/g, ' ').slice(0, 90))
  check('granted → the scope control renders all three states', ['My branches', 'Unassigned', 'All branches'].every((s) => text.includes(s)))
  // 🚩 268 rendered this control INERT and said so; 270 wired it, so the assertion
  // is now the opposite one: three live buttons, one of them pressed.
  check('granted → the scope control is LIVE (270 wired it)', (await page.locator('[data-region="settlement-scope"] button[aria-disabled="true"]').count()) === 0 && (await page.locator('[data-region="settlement-scope"] button[aria-pressed="true"]').count()) === 1)
  check('granted → the door renders its worklist', text.includes('What needs a human'))
  check('granted → the Collections group renders', (await groupCount()) === 1)
  check('granted → the Settlement leaf is the FIFTH item', (await leafCount()) === 1 && (await inquiryLeaves()) === 4)
  check('🚩 the namespace is REGISTERED — no raw t() key on screen', !/settlement:|\bshell\.|\bscope\./.test(text + (await page.locator('nav').innerText())))

  // ONE probe for the whole area: five leaves + the screen's own gate share the key,
  // so react-query dedupes them into a single request per page life. The fifth grant
  // must not have cost a sixth round trip.
  accessCalls = 0
  settlementCalls = 0
  await page.goto(BASE + ROUTE)
  await page.waitForLoadState('networkidle')
  check('the five leaves + the screen gate cost ONE CollectionWeb/Access call', accessCalls === 1, `${accessCalls} calls`)
  // 🚩 The door costs exactly TWO calls: the fleet and the worklist. No account, and
  // no ledger — the ledger is filter-first and the account is a destination, so
  // neither is fetched by arriving. (268 asserted zero here; the door is the slice
  // that spends.)
  check('🚩 the door fetches the fleet and the worklist, and nothing else', settlementCalls === 2, `${settlementCalls} calls`)

  // ---- Scenario 2: ungranted ----
  text = await open(NONE)
  check('ungranted → a hand-typed route renders the denied backstop', text.includes(DENIED) && !text.includes(TITLE))
  check('ungranted → the Settlement leaf is absent', (await leafCount()) === 0)

  // ---- Scenario 3: settlement refused, the four inquiries granted ----
  // The ragged group, and the case that matters most: this is the LIVE door today.
  text = await open(FOUR_FLAGS)
  check("🚩 today's four-boolean answer → the route refuses", text.includes(DENIED) && !text.includes(TITLE))
  check("🚩 today's four-boolean answer → no Settlement leaf…", (await leafCount()) === 0)
  // …read from a screen this session CAN open: the shell expands a group around the
  // leaf the current route belongs to, and on a refused settlement route there is no
  // such leaf, so the group is collapsed and its children are not in the DOM to count.
  await page.goto(BASE + '/collection/collections')
  await page.waitForLoadState('networkidle')
  check('🚩 …and the four inquiry leaves are untouched', (await inquiryLeaves()) === 4, `${await inquiryLeaves()} links`)
  check('🚩 …with no Settlement leaf beside them', (await leafCount()) === 0)

  // ---- Scenario 4: the probe itself fails ----
  text = await open(NONE, { access403: true })
  check('a 403 reads as a REFUSAL, not an outage', text.includes(DENIED) && !text.includes(UNREACHABLE))
  check('a 403 → the leaf is hidden too', (await leafCount()) === 0)
  text = await open(NONE, { access500: true })
  check('a 500 reads as UNREACHABLE — try again, not see an administrator', text.includes(UNREACHABLE) && !text.includes(DENIED))
  check('a 500 → the leaf is hidden too', (await leafCount()) === 0)

  // ═══ Ticket 269 — a branch's account is the destination ═══════════════════════
  //
  // Every check below is against one of the **six hostile branches** the prototype
  // chose because each broke a layout that looked fine on the easy case. There is
  // deliberately no happy-path branch in this section.
  const openAccount = async (code) => {
    scenario = { accessBody: ALL, access403: false, access500: false }
    await page.goto(`${BASE}${ROUTE}?store=${code}`)
    await page.waitForLoadState('networkidle')
    return mainText()
  }
  const journalText = async () => page.locator('[data-region="entry-journal"]').innerText()
  const selectEntry = async (entryId) => {
    await page.locator(`.ag-row[row-id="${entryId}"]`).first().click()
    await page.waitForTimeout(50)
    return journalText()
  }

  // ---- 0142: both kinds open at once ----
  text = await openAccount('0142')
  check(
    '0142 → the headline names the branch and the money it owes',
    text.includes('Al-Rawdah Pharmacy') && text.includes('455.50') && text.includes('this branch owes head office'),
  )
  check(
    '0142 → BOTH magnitudes render beside the net, never the net alone',
    text.includes('575.50') && text.includes('120.00'),
  )
  check(
    '⚠️ the headline says it is not settleable',
    text.includes('never settled') || text.includes('never cancel each other out'),
  )
  check('0142 → all three entries render', text.includes('143') && text.includes('151') && text.includes('128'))
  check('0142 → the kinds carry their Arabic beside the English (D9)', text.includes('عجز') && text.includes('فائض'))

  // ---- 0331: the ORPHAN (rule 1) ----
  text = await openAccount('0331')
  let journal = await selectEntry('01J9SETL0331A')
  check(
    '🔑 rule 1 — the undocumented consumption is NAMED IN WORDS, not a blank cell',
    journal.includes('No document — the close never completed'),
  )
  check(
    '🔑 …and the row is marked as such in the DOM, not only by colour',
    (await page.locator('[data-region="entry-journal"] tr[data-orphan="true"]').count()) === 1,
  )
  check('0331 → the orphan still shows what it left behind', journal.includes('300.00'))
  check(
    '🔑 …and the ENTRY row flags it too — an orphan is findable without opening every entry',
    (await page.locator('.ag-row[row-id="01J9SETL0331A"] [col-id="journalCount"]').first().innerText()).includes('no document'),
  )
  check(
    '🚩 the grid selects its first row for itself — the journal is highlighted, not merely shown',
    (await page.locator('.ag-row-selected').count()) === 1,
  )

  // ---- 0455: the REVERSAL (rule 2) ----
  text = await openAccount('0455')
  journal = await selectEntry('01J9SETL0455A')
  check('0455 → all four journal rows render', (await page.locator('[data-region="entry-journal"] tbody tr').count()) === 4)
  check(
    '🔑 rule 2 — the REVERSE row reads as a RESTORATION, never as another spend',
    journal.includes('Given back') && journal.includes('Void of SR-0455-0012'),
  )
  check(
    '🔑 …and exactly ONE row is flagged a restoration',
    (await page.locator('[data-region="entry-journal"] tr[data-restoration="true"]').count()) === 1,
  )
  check(
    '🚩 the restoration RAISES the remainder — the tell a spend never shows',
    (
      await page.locator('[data-region="entry-journal"] tr[data-restoration="true"] td').nth(2).innerText()
    ).includes('600.00'),
  )
  check('0455 → no orphan on a fully documented entry', (await page.locator('[data-region="entry-journal"] tr[data-orphan="true"]').count()) === 0)

  // ---- 0207: consumed to zero last night ----
  text = await openAccount('0207')
  journal = await selectEntry('01J9SETL0207A')
  check('0207 → the consumed entry reads as consumed BY A TILL', text.includes('Consumed by a till'))
  check('0207 → both of last night’s closes are in the journal', journal.includes('Z-51120') && journal.includes('Z-51204'))
  check('0207 → only the open shortage counts towards the position', text.includes('1,240.00'))

  // ---- 0512: square ----
  text = await openAccount('0512')
  check('0512 → a branch with history only reads as SQUARE', text.includes('square with head office'))
  // ⚠️ Square is not empty. A layout that only ever renders branches with a balance
  // has not been asked what it does with the ~220 that have none.
  check('0512 → …and its grid is NOT empty — the history is still there', text.includes('119') && text.includes('Consumed by a till'))
  check('0512 → its one closed entry still has its journal', (await selectEntry('01J9SETL0512A')).includes('SR-0512-0004'))

  // ---- 0688: the two correction states, and the BHD branch ----
  text = await openAccount('0688')
  check('0688 → the CLOSED_OUT entry reads as WRITTEN OFF, not as consumed', text.includes('Remainder written off'))
  journal = await selectEntry('01J9SETL0688A')
  check(
    '🚩 …its zero remaining had no consumption behind it — the write-off is named',
    journal.includes('written off') && journal.includes('400.000'),
  )
  check(
    '🚩 …and the journal below it is UNCHANGED — one row, the till’s own',
    (await page.locator('[data-region="entry-journal"] tbody tr').count()) === 1,
  )
  journal = await selectEntry('01J9SETL0688B')
  check('0688 → the CANCELLED entry has an EMPTY journal', journal.includes('Nothing was ever taken'))
  // 🚩 The wire still carries `remainingAmount: 180` on a CANCELLED entry — the
  // cancel closes the row without zeroing the figure. Drawing it under a Remaining
  // header would say the branch owes 180.000 it does not owe. The Amount column
  // still shows 180.000, and correctly: that IS what was posted.
  const cancelledCells = async (colId) =>
    page.locator(`.ag-row[row-id="01J9SETL0688B"] [col-id="${colId}"]`).first().innerText()
  check('🚩 …and draws NO remaining, though the wire still carries 180', (await cancelledCells('remainingAmount')).trim() === '—')
  check('🚩 …while its Amount still says what was actually posted', (await cancelledCells('amount')).includes('180.000'))
  check(
    '🔑 0688 is BHD → money renders at THREE decimals',
    text.includes('95.250') && text.includes('640.000'),
  )
  check(
    '🔑 …while the five SAR branches render at TWO — the same figure, read differently',
    (await openAccount('0142')).includes('75.50'),
  )

  // ---- the door, and the account's boundary ----
  await page.goto(BASE + ROUTE)
  await page.waitForLoadState('networkidle')
  check('no branch named → the DOOR stands, not the account', (await page.locator('[data-region="settlement-door"]').count()) === 1 && (await page.locator('[data-region="branch-account"]').count()) === 0)
  check('🚩 the door is a SEARCH BOX, never a dropdown of 1394 branches', (await page.locator('[data-region="settlement-door"] select, [data-region="settlement-door"] [role="combobox"]').count()) === 0 && (await page.locator('[data-testid="settlement-search"]').count()) === 1)

  // ═══ Ticket 270 — the door searches, and triages what needs a human ═══════════
  //
  // Every check below is against the ESTATE fixture — 1394 branches, 1255 of them
  // assigned to nobody. That size is the point: 269's six branches cannot prove a
  // door whose every claim is about what happens at scale.
  const openDoor = async (scope = '') => {
    scenario = { accessBody: ALL, access403: false, access500: false }
    await page.goto(`${BASE}${ROUTE}${scope ? `?scope=${scope}` : ''}`)
    await page.waitForLoadState('networkidle')
    return mainText()
  }
  const laneRows = async (lane) => page.locator(`[data-lane="${lane}"] li`).count()
  const search = async (q) => {
    await page.locator('[data-testid="settlement-search"]').fill(q)
    // The box writes the query into the URL, so the ranked list is a re-render away
    // rather than a request away — a short settle, not a network wait.
    await page.waitForTimeout(150)
    return page.locator('[data-region="search-results"]').innerText().catch(() => '')
  }
  /** Wait for a region to actually be on screen. A client-side navigation resolves
   *  `networkidle` before React has mounted what it navigated to, so every check
   *  that follows one waits for its own subject rather than for the network. */
  const appears = async (selector, timeout = 8000) =>
    page
      .waitForSelector(selector, { timeout })
      .then(() => true)
      .catch(() => false)

  // ---- the three lanes, triaged by what they cost ----
  text = await openDoor()
  check('270 → the door opens on MY BRANCHES', (await page.locator('[data-region="settlement-scope"] button[aria-pressed="true"]').innerText()).includes('My branches'))
  check(
    '🔑 wrong money is ENUMERATED IN FULL — one row per orphan consumption',
    (await laneRows('wrong-money')) === WORKLIST.orphans.length,
    `${await laneRows('wrong-money')} rows`,
  )
  check('270 → cash waiting is enumerated too, and shows an AGE', (await laneRows('cash-waiting')) === WORKLIST.uncollected.length && /prepared \d+ days ago/.test(text))
  check(
    '🔑 the ageing lane is a COUNT and a way through — never a card each',
    (await laneRows('ageing')) === 0 &&
      (await page.locator('[data-lane="ageing"]').innerText()).includes('47 entries') &&
      (await page.locator('[data-testid="open-ledger"]').count()) === 1,
    await page.locator('[data-lane="ageing"]').innerText(),
  )
  check('270 → the lanes are ordered wrong money → cash waiting → ageing', text.indexOf('Wrong money') < text.indexOf('Cash waiting') && text.indexOf('Cash waiting') < text.indexOf('Ageing'))

  // ---- 🔑 THE CARVE-OUT: the load-bearing part of this ticket ----
  // 0331 is UNASSIGNED in the fixture, deliberately. Its orphan consumption must be
  // on this screen under scope = mine; its ageing entries must not be counted.
  check(
    '🔑 an UNASSIGNED branch’s wrong money is on screen under scope = MINE',
    (await page.locator('[data-lane="wrong-money"] li').filter({ hasText: '0331' }).count()) === 1,
  )
  const ageingText = async () => page.locator('[data-lane="ageing"]').innerText()
  const mineAgeing = await ageingText()
  await page.locator('[data-region="settlement-scope"] button[data-scope="all"]').click()
  await page.waitForTimeout(120)
  check(
    '🔑 …while its AGEING entries only appear once the scope widens (47 → 140)',
    mineAgeing.includes('47 entries') && (await ageingText()).includes('140 entries'),
    `${mineAgeing.replace(/\n/g, ' ')} → ${(await ageingText()).replace(/\n/g, ' ')}`,
  )
  check(
    '🔑 …and the two enumerated lanes did NOT move when the scope did',
    (await laneRows('wrong-money')) === WORKLIST.orphans.length && (await laneRows('cash-waiting')) === WORKLIST.uncollected.length,
  )
  check('270 → widening is one click and is never locked', page.url().includes('scope=all'))
  check('⚠️ the screen says the two lanes are estate-wide, rather than leaving it to be inferred', (await mainText()).includes('whole estate'))

  // ---- the search: four keys, one box ----
  text = await openDoor()
  check('🔑 search finds a branch by CODE', (await search('0331')).includes('Al-Nakheel'))
  check('🔑 search finds the same branch by name in ARABIC', (await search('النخيل')).includes('0331'))
  check('🔑 …and by name in ENGLISH', (await search('Al-Nakheel')).includes('0331'))
  check('🔑 search finds a branch by CITY', (await search('Muharraq')).includes('0688'))
  await search('0331')
  check(
    '🔑 the scope RANKS and never refuses — an unassigned branch is still found under MINE',
    (await page.locator('[data-hit="0331"][data-in-scope="false"]').count()) === 1,
  )
  await search('Pharmacy')
  check('270 → a broad query is capped and says how many matched', /Showing 20 of \d{3,}/.test(await page.locator('[data-region="search-results"]').innerText()))
  check('270 → a query that matches nothing says so', (await search('zzzz')) === '' && (await mainText()).includes('No branch matches that'))

  // ---- a search hit is an ADDRESS: it lands on 269's account ----
  await search('0142')
  await page.locator('[data-hit="0142"]').click()
  await appears('[data-region="branch-account"]')
  check('270 → a search hit opens the BRANCH ACCOUNT 269 built', (await page.locator('[data-region="branch-account"]').count()) === 1 && page.url().includes('store=0142'), page.url())

  // ---- an entry number jumps STRAIGHT to that entry's branch ----
  await openDoor()
  await search('143')
  await page.keyboard.press('Enter')
  await appears('[data-region="branch-account"]')
  check(
    '🔑 “entry 143” lands on the account of the branch it is on, whichever that is',
    page.url().includes('store=0142') && (await page.locator('[data-region="branch-account"]').count()) === 1,
    page.url(),
  )
  // 🔑 …and on the ENTRY, not merely the branch (story 3). The account's grid
  // selects its own first displayed row, which after a sort is a different entry —
  // so the door names the one it sent the reader for, and the journal opens under it.
  check(
    '🔑 …and opens on entry 143 itself, with its journal underneath',
    (await page.locator('[data-region="entry-journal"]').getAttribute('data-entry')) === '143' &&
      (await page.locator('.ag-row-selected [col-id="entryNumber"]').innerText()).trim() === '143',
    await page.locator('[data-region="entry-journal"]').getAttribute('data-entry'),
  )
  await openDoor()
  await search('9999')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  check('270 → an entry number that matches nothing says so, and does not navigate', (await mainText()).includes('no entry 9999') && !page.url().includes('store='), page.url())
  // 🔑 A code that is ALSO an entry number goes to the BRANCH. Store codes are four
  // digits and entry numbers are unpadded ints, so the estate genuinely holds both
  // readings of the same string — and taking someone who typed their own branch's
  // code to a different branch's account is the worst thing this box could do.
  const collision = FLEET.find(
    (r) => /^[1-9]\d*$/.test(r.storeId) && LEDGER.some((e) => String(e.entryNumber) === r.storeId),
  )
  await openDoor()
  await search(collision.storeId)
  await page.keyboard.press('Enter')
  await appears('[data-region="branch-account"]')
  check(
    '🔑 an EXACT branch code beats an entry number of the same digits',
    page.url().includes(`store=${collision.storeId}`),
    `${collision.storeId} → ${page.url()}`,
  )

  // ---- Repair: the only write on this screen ----
  text = await openDoor()
  const orphanRows = () => page.locator('[data-lane="wrong-money"] li')
  const before = await orphanRows().count()
  await orphanRows().filter({ hasText: '0331' }).locator('button').click()
  check('270 → Repair opens a dialog naming the branch, the entry and the age', (await page.locator('dialog').innerText()).includes('0331'))
  await page.locator('[data-testid="repair-reason"]').fill('Close timed out on 2026-08-12; Z never written.')
  await page.locator('[data-testid="repair-confirm"]').click()
  await page.waitForTimeout(400)
  check('270 → the repair posts a consumption id and the reason typed', repairCalls.length === 1 && repairCalls[0].settlementConsumptionId === '01J9SCON0331A1' && repairCalls[0].reason.startsWith('Close timed out'))
  check('270 → …the lane refreshes and the repaired row is gone', (await orphanRows().count()) === before - 1, `${before} → ${await orphanRows().count()}`)
  check('270 → …and the toast says the money is back on the entry', (await page.locator('body').innerText()).includes('is back on the entry'))

  // 🔑 The no-op: a document arrived mid-click. It must read as nothing to do, NOT
  // as a failure — the row stays, and the sentence is the ticket's own.
  const noopRow = orphanRows().filter({ hasText: WORKLIST.orphans.find((o) => o.settlementConsumptionId === NOOP_CONSUMPTION)?.storeId ?? '—' })
  const noopBefore = await orphanRows().count()
  await noopRow.first().locator('button').click()
  await page.locator('[data-testid="repair-reason"]').fill('Sweep found no document.')
  await page.locator('[data-testid="repair-confirm"]').click()
  await page.waitForTimeout(400)
  check(
    '🔑 a repair whose document arrived mid-click reads as “nothing to repair”, not an error',
    (await page.locator('body').innerText()).includes('A document arrived for this consumption — nothing to repair'),
  )
  check('🔑 …and it is NOT an error surface — the row simply stays', (await orphanRows().count()) === noopBefore && !(await mainText()).toLowerCase().includes('could not be sent'))

  // ---- the address survives a round trip ----
  // 🚩 A widened scope is a decision the reader made; walking into a branch and back
  // must not quietly undo it, or the ageing count falls 140 → 47 with nothing on
  // screen to explain why.
  await openDoor('all')
  await search('0142')
  await page.locator('[data-hit="0142"]').click()
  await appears('[data-region="branch-account"]')
  await page.locator('main a[href*="scope=all"]').first().click()
  await appears('[data-lane="ageing"]')
  check(
    '🚩 coming back from a branch keeps the widened scope (140, not 47)',
    (await page.locator('[data-lane="ageing"]').innerText()).includes('140 entries') && !page.url().includes('store='),
    page.url(),
  )

  // ---- the flat cross-estate ledger ----
  await openDoor()
  await page.locator('[data-testid="open-ledger"]').click()
  await appears('[data-region="cross-estate-ledger"] .ag-row')
  check('270 → the ageing lane’s way through opens the LEDGER, seeded with open entries', (await page.locator('[data-region="cross-estate-ledger"]').count()) === 1 && (await page.locator('.ag-row').count()) > 0, `${page.url()} · ${await page.locator('.ag-row').count()} rows`)
  check('⚠️ the ledger says it is NOT the account', (await mainText()).includes('A lookup, not an account'), page.url())
  check('270 → its totals are a REPORT figure, per currency, never netted', /SAR · \d+ entries found/.test(await page.locator('[data-region="ledger-figures"]').innerText()) && (await page.locator('[data-region="ledger-figures"]').innerText()).includes('A report figure'))
  await page.locator('[data-testid="ledger-status"]').selectOption('')
  await page.locator('[data-testid="ledger-entry-number"]').fill('143')
  await page.locator('[data-region="cross-estate-ledger"] button[type="submit"]').click()
  await page.waitForTimeout(600)
  check('🔑 the ledger finds ONE entry across the whole estate', (await page.locator('.ag-row').count()) === 1, `${await page.locator('.ag-row').count()} rows`)
  await page.locator('.ag-row').first().click()
  await appears('[data-region="branch-account"]')
  check('270 → …and the row is a way through to that branch’s account', page.url().includes('store=0142') && (await page.locator('[data-region="branch-account"]').count()) === 1)
  // 🚩 …and the ledger's own filter is an address too: pressing Back out of the
  // account a row opened brings the same search back, rather than a blank form and a
  // fresh estate-wide query.
  await page.goBack()
  await appears('[data-region="cross-estate-ledger"] .ag-row')
  check(
    '🚩 Back out of an account restores the ledger’s own filter',
    (await page.locator('[data-testid="ledger-entry-number"]').inputValue()) === '143' && (await page.locator('.ag-row').count()) === 1,
    page.url(),
  )

  await page.goto(`${BASE}${ROUTE}?view=ledger`)
  await appears('[data-region="cross-estate-ledger"]')
  check('🔑 the ledger is FILTER-FIRST — it does not open on the estate', (await mainText()).includes('too big to open on nothing') && (await page.locator('.ag-row').count()) === 0)

  // ---- and the namespace, again, over 270's new copy ----
  text = await openDoor()
  check('🚩 270’s keys are all registered — no raw t() key on screen', !/settlement:|\bworklist\.|\bsearch\.|\bledger\.|\brepair\./.test(text))

  // ═══ Ticket 271 — one entry posts, and the screen reads it back in words ══════
  //
  // The two guards this ticket turns on are both *review* guards, not refusals: the
  // amount read back in words, and the branch's standing open position of the same
  // kind. Neither can be proven by a typecheck — they are sentences on a screen, and
  // the only way to know they say the right thing is to type a figure and read them.
  const dialogText = async () => page.locator('dialog').innerText()
  const openPost = async () => {
    await page.locator('[data-testid="post-open"]').click()
    await appears('[data-region="post-entry"]')
  }
  const typeBranch = async (q) => {
    await page.locator('[data-testid="post-branch"]').fill(q)
    await page.waitForTimeout(150)
  }
  const typeAmount = async (v) => {
    await page.locator('[data-testid="post-amount"]').fill(v)
    await page.waitForTimeout(80)
  }
  const reviewBlocked = async () =>
    (await page.locator('[data-testid="post-review"]').getAttribute('aria-disabled')) === 'true'
  const wordsText = async () => page.locator('[data-testid="post-amount-words"]').innerText()

  // ---- the form itself: one form, one toggle, and the toggle states a consequence ----
  await openDoor()
  await openPost()
  text = await dialogText()
  check(
    '🔑 271 → ONE form with a kind toggle, never two forms',
    (await page.locator('dialog').count()) === 1 && (await page.locator('dialog [data-kind]').count()) === 2,
  )
  check(
    '🔑 the toggle states the CONSEQUENCE, not the word',
    text.includes('The branch must hand this money over') && text.includes('The branch may keep this money back'),
  )
  check('271 → …with the domain words beside them, in both scripts (D9)', text.includes('عجز') && text.includes('فائض'))
  check('🚩 the branch is TYPED — there is no 1394-option dropdown', (await page.locator('dialog select, dialog [role="combobox"]').count()) === 0)

  // ---- the branch must resolve to EXACTLY ONE match ----
  await typeAmount('500')
  await page.locator('[data-testid="post-reason"]').fill('Monthly audit, May delivery difference.')
  await typeBranch('Pharmacy')
  check(
    '🔑 a branch that resolves to MORE THAN ONE match cannot be posted against',
    (await reviewBlocked()) && (await page.locator('[data-testid="post-branch-ambiguous"]').count()) === 1,
  )
  await typeBranch('zzzzzz')
  check(
    '🔑 …and neither can one that resolves to NONE',
    (await reviewBlocked()) && (await page.locator('[data-testid="post-branch-none"]').count()) === 1,
  )

  // ---- a surplus, posted from the door ----
  await typeBranch('0331')
  check(
    '271 → a typed code resolves to exactly one branch, named and with its currency',
    (await page.locator('[data-testid="post-branch-resolved"]').getAttribute('data-store')) === '0331' &&
      (await page.locator('[data-testid="post-branch-resolved"]').innerText()).includes('Al-Nakheel'),
  )
  check('271 → …and the form is postable once it has one', !(await reviewBlocked()))
  await page.locator('dialog [data-kind="SURPLUS"]').click()
  await typeAmount('1,234.5')
  check(
    '271 → the read-back groups the figure and words it',
    (await wordsText()).includes('1,234.50') && (await wordsText()).includes('one thousand two hundred thirty-four riyals and fifty halalas'),
  )
  postCalls = []
  await page.locator('[data-testid="post-review"]').click()
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  check(
    '🔑 a SURPLUS lands on the branch with the right kind and a minted entry number',
    postCalls.length === 1 &&
      postCalls[0].entryKind === 'SURPLUS' &&
      postCalls[0].storeId === '0331' &&
      postCalls[0].amount === 1234.5 &&
      (await page.locator('[data-region="post-done"]').getAttribute('data-entry')) === '900',
    JSON.stringify(postCalls[0] ?? {}),
  )
  check('271 → …and the number is on screen, because that is what the phone call quotes', (await dialogText()).includes('Entry 900 is posted'))
  await page.locator('[data-testid="post-close"]').click()

  // ---- a shortage, from the account, over the standing-position guard ----
  await openAccount('0142')
  await openPost()
  check(
    '271 → opened from an account, the branch arrives already resolved',
    (await page.locator('[data-testid="post-branch-resolved"]').getAttribute('data-store')) === '0142',
  )
  // The rest of the form first, so every "…and it still commits" check below is
  // about the guard under test and not about an empty box two fields away.
  const ARABIC_REASON = 'عجز مكتشف في جرد أغسطس — يُسلَّم للمحصّل'
  await typeAmount('500')
  await page.locator('[data-testid="post-reason"]').fill(ARABIC_REASON)
  await page.waitForTimeout(80)
  const standing = async () => page.locator('[data-testid="post-standing"]').innerText()
  check(
    '🔑 the standing open position of the SAME KIND is named BEFORE the review step',
    (await standing()).includes('575.50') &&
      (await standing()).includes('Entry 143') &&
      (await standing()).includes('Entry 128') &&
      (await page.locator('[data-standing-entry]').count()) === 2,
    (await standing()).replace(/\n/g, ' '),
  )
  check('🚩 …and it warns rather than refusing — the duplicate is permitted by design', (await standing()).includes('Posting another is allowed') && !(await reviewBlocked()))
  await page.locator('dialog [data-kind="SURPLUS"]').click()
  check(
    '🚩 the two kinds are never netted — the surplus side stands alone',
    (await standing()).includes('120.00') && (await standing()).includes('Entry 151') && (await page.locator('[data-standing-entry]').count()) === 1,
  )
  await page.locator('dialog [data-kind="SHORTAGE"]').click()

  // 🔑 The Proof bullet: type a fractional amount at a 2-decimal branch and watch it.
  await typeAmount('50000.567')
  check(
    '🔑 the in-words read-back shows the ROUNDED figure for a 2-decimal branch',
    (await wordsText()).includes('50,000.57') && (await wordsText()).includes('fifty thousand riyals and fifty-seven halalas'),
    (await wordsText()).replace(/\n/g, ' '),
  )
  // ⚠️ …and the one figure that is refused is refused for a reason that is not a
  // cap: 0.004 at a SAR branch is zero to the branch, and an entry no till could
  // consume. The BHD branch below takes the same figure happily.
  await typeAmount('0.004')
  check(
    '⚠️ a figure below the branch’s smallest countable unit is refused, and says why',
    (await reviewBlocked()) && (await page.locator('[data-testid="post-amount-too-small"]').count()) === 1,
  )
  // 🚩 …and no cap anywhere: a legitimately large entry reviews and commits like any
  // other. The guard is the sentence, not a threshold.
  await typeAmount('9000000')
  check(
    '🚩 there is NO numeric cap — a nine-million entry reviews like any other',
    !(await reviewBlocked()) && (await wordsText()).includes('nine million riyals'),
  )
  await typeAmount('50000.567')

  check(
    '271 → the reason renders VERBATIM in what-the-branch-will-see, including Arabic',
    (await page.locator('[data-testid="post-reason-preview"]').innerText()).trim() === ARABIC_REASON,
  )

  await page.locator('[data-testid="post-review"]').click()
  await appears('[data-region="post-review"]')
  check(
    '🔑 the review step reads the amount back grouped AND in words',
    (await page.locator('[data-testid="post-review-figure"]').innerText()).includes('50,000.57') &&
      (await page.locator('[data-testid="post-review-words"]').innerText()).includes('fifty thousand riyals and fifty-seven halalas'),
  )
  check(
    '⚠️ the commit NAMES the immutability — chosen, not discovered',
    (await page.locator('[data-testid="post-immutability"]').innerText()).includes('cannot be changed'),
  )
  check('271 → …and the branch’s own words are still on screen at the commit', (await page.locator('[data-testid="post-review-reason"]').innerText()).trim() === ARABIC_REASON)

  postCalls = []
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  check(
    '🔑 a SHORTAGE lands with the right kind, and the client rounded NOTHING on the way',
    postCalls.length === 1 && postCalls[0].entryKind === 'SHORTAGE' && postCalls[0].amount === 50000.567 && postCalls[0].reason === ARABIC_REASON,
    JSON.stringify(postCalls[0] ?? {}),
  )
  const posted = await page.locator('[data-region="post-done"]').getAttribute('data-entry')
  check(
    '🔑 the confirmation shows the entry NUMBER and the amount the SERVER stored',
    (await dialogText()).includes(`Entry ${posted} is posted`) && (await dialogText()).includes('50,000.57'),
  )
  await page.locator('[data-testid="post-close"]').click()
  await page.waitForTimeout(500)
  check(
    '🔑 …and the account refreshes underneath it — the new entry is on the branch',
    (await mainText()).includes(posted) && (await page.locator(`.ag-row[row-id="01J9SETLPOST${posted}"]`).count()) === 1,
    `entry ${posted}`,
  )

  // ---- a BHD branch keeps its fils, in the words as well as in the figures ----
  await openAccount('0688')
  await openPost()
  await typeAmount('95.5')
  check(
    '🔑 a BHD branch reads back FULL FILS — three decimals in the figure and in the words',
    (await wordsText()).includes('95.500') && (await wordsText()).includes('ninety-five dinars and five hundred fils'),
    (await wordsText()).replace(/\n/g, ' '),
  )
  check('🚩 …and the currency it will be counted in is named on the resolved branch', (await page.locator('[data-testid="post-branch-resolved"]').innerText()).includes('BHD'))
  await page.locator('[data-testid="post-reason"]').fill('August stocktake difference.')
  await page.locator('[data-testid="post-review"]').click()
  postCalls = []
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  check(
    '🔑 …and the BHD entry lands at three decimals, the server’s own figure read back',
    postCalls[0]?.amount === 95.5 && (await dialogText()).includes('95.500'),
  )
  await page.locator('[data-testid="post-close"]').click()

  // ---- and the namespace, again, over 271's new copy ----
  await openDoor()
  await openPost()
  check('🚩 271’s keys are all registered — no raw t() key in the form', !/settlement:|\bpost\.|\bwords\./.test(await dialogText()))
  await page.keyboard.press('Escape')

  // ═══ Ticket 272 — one button corrects, and the audit reads as one column of time ═
  //
  // 🔑 The whole ticket is *which single affordance an entry shows*, and every check
  // below is therefore paired: the button that must be there, and the one that must
  // NOT be beside it. A menu offering both is the failure this slice exists to make
  // impossible.
  const correctionRegion = () => page.locator('[data-region="entry-correction"]')
  const correctionKind = async () => correctionRegion().getAttribute('data-correction')
  const actButtons = async () => page.locator('[data-testid="correction-act"]').count()
  const actKind = async () => page.locator('[data-testid="correction-act"]').getAttribute('data-act')
  const correctionText = async () => correctionRegion().innerText()
  const journalRows = async () => page.locator('[data-region="entry-journal"] tbody tr').count()
  const auditFacts = async () => page.locator('[data-region="entry-audit"] li').all()
  const auditKinds = async () =>
    Promise.all((await auditFacts()).map((li) => li.getAttribute('data-fact')))
  const auditText = async () => page.locator('[data-region="entry-audit"]').innerText()

  // ---- an untouched entry offers ONLY Cancel ----
  await openAccount('0688')
  await selectEntry('01J9SETL0688C') // 95.250 of 95.250 — nothing taken
  check(
    '🔑 272 → an untouched entry offers ONLY Cancel',
    (await correctionKind()) === 'cancel' &&
      (await actButtons()) === 1 &&
      (await actKind()) === 'cancel' &&
      !(await correctionText()).includes('Write off'),
    await correctionKind(),
  )
  check(
    '272 → …and says WHY it can be withdrawn whole, in the branch’s own currency',
    (await correctionText()).includes('95.250') && (await correctionText()).includes('as though it never happened'),
  )
  check(
    '⚠️ “changing the amount is not offered at all”, said out loud beside the button',
    (await page.locator('[data-testid="correction-no-amend"]').innerText()).includes(
      'Changing the amount is not offered at all',
    ),
  )

  // ---- a partly consumed entry offers ONLY the write-off ----
  await openAccount('0142')
  await selectEntry('01J9SETL0142B') // 120.00 of 320.00 — a till took 200
  check(
    '🔑 272 → a partly consumed entry offers ONLY the write-off, with the remaining on it',
    (await correctionKind()) === 'write-off' &&
      (await actButtons()) === 1 &&
      (await actKind()) === 'write-off' &&
      (await page.locator('[data-testid="correction-act"]').innerText()).includes('Write off the remaining 120.00') &&
      !(await correctionText()).includes('Cancel this entry'),
    await page.locator('[data-testid="correction-act"]').innerText(),
  )
  check(
    '🔑 …with the reason it cannot be cancelled BESIDE it — an answer, not a missing button',
    (await page.locator('[data-testid="correction-why"]').innerText()).includes('cannot be cancelled') &&
      (await page.locator('[data-testid="correction-why"]').innerText()).includes('120.00 of 320.00'),
  )

  // ---- 🔑 the journal stays on screen UNDER the act ----
  const journalBefore = await journalRows()
  await page.locator('[data-testid="correction-act"]').click()
  await appears('[data-testid="correction-reason"]')
  check(
    '🔑 the journal is VISIBLE DURING the correction — the act is a panel above it, not a modal',
    (await page.locator('[data-region="entry-journal"]').isVisible()) &&
      (await journalRows()) === journalBefore &&
      (await page.locator('dialog').count()) === 0,
  )
  await page.locator('[data-testid="correction-reason"]').fill('Finance wrote the rest off — August settlement.')
  await page.locator('[data-testid="correction-commit"]').click()
  await page.waitForTimeout(600)
  check(
    '272 → the write-off posts the entry id and the reason typed',
    closeOutCalls.length === 1 &&
      closeOutCalls[0].settlementEntryId === '01J9SETL0142B' &&
      closeOutCalls[0].reason.startsWith('Finance wrote the rest off'),
    JSON.stringify(closeOutCalls[0] ?? {}),
  )
  check(
    '🔑 …and the journal is UNCHANGED after it — a write-off touches no consumption',
    (await journalRows()) === journalBefore,
    `${journalBefore} → ${await journalRows()}`,
  )
  check(
    '272 → …the entry now reads as written off, and offers no correction at all',
    (await mainText()).includes('Remainder written off') && (await actButtons()) === 0,
  )

  // ---- a CANCELLED and a CLOSED_OUT entry offer NOTHING ----
  await openAccount('0688')
  await selectEntry('01J9SETL0688B') // CANCELLED
  check(
    '🔑 a CANCELLED entry offers NO correction button at all',
    (await correctionKind()) === 'none' &&
      (await actButtons()) === 0 &&
      (await page.locator('[data-testid="correction-none"]').innerText()).includes('was cancelled'),
  )
  await selectEntry('01J9SETL0688A') // CLOSED_OUT
  check(
    '🔑 a CLOSED_OUT entry offers NO correction button either',
    (await correctionKind()) === 'none' &&
      (await actButtons()) === 0 &&
      (await page.locator('[data-testid="correction-none"]').innerText()).includes('already written off'),
  )
  check(
    '⚠️ …and the no-amend sentence is on the stateless states too',
    (await correctionText()).includes('Changing the amount is not offered at all'),
  )
  await openAccount('0207')
  await selectEntry('01J9SETL0207A') // CONSUMED
  check(
    '272 → a CONSUMED entry offers none either — a till took all of it',
    (await correctionKind()) === 'none' && (await actButtons()) === 0,
  )

  // ---- 🔑 THE RACE: the load-bearing bullet of this ticket ----
  // 0142/143 is untouched, so the screen offers Cancel — and the stub has a till
  // consuming 150 of it a millisecond earlier. The refusal is a 200.
  await openAccount('0142')
  await selectEntry('01J9SETL0142A')
  check('🔑 the raced entry starts by offering Cancel', (await actKind()) === 'cancel')
  cancelCalls = []
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('Posted onto the wrong branch.')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('[data-testid="correction-race"]')
  check(
    '🔑 a cancel that LOST the race renders the recovery with the NEW remaining',
    (await page.locator('[data-testid="correction-race"]').innerText()).includes('A till consumed part of this entry') &&
      (await page.locator('[data-testid="correction-race"]').innerText()).includes('350.00'),
    (await page.locator('[data-testid="correction-race"]').innerText()).replace(/\n/g, ' '),
  )
  check(
    '🔑 …and it is NEVER an error toast — nothing on screen says the act failed',
    !(await page.locator('body').innerText()).includes('could not be sent') &&
      (await page.locator('[data-testid="correction-race"]').count()) === 1,
  )
  check(
    '🔑 …and the write-off is now IN REACH, in place of the cancel',
    (await actKind()) === 'write-off' &&
      (await actButtons()) === 1 &&
      (await page.locator('[data-testid="correction-act"]').innerText()).includes('350.00'),
    await page.locator('[data-testid="correction-act"]').innerText(),
  )
  closeOutCalls = []
  await page.locator('[data-testid="correction-act"]').click()
  // 🔑 The words go with the ACT, not with the entry: "posted onto the wrong branch"
  // is why someone wanted to CANCEL, and filing it against the write-off that
  // actually happened would put a reason nobody chose into the branch's history.
  check(
    '🔑 …with an EMPTY reason box — the cancel’s words do not ride into the write-off',
    (await page.locator('[data-testid="correction-reason"]').inputValue()) === '',
    await page.locator('[data-testid="correction-reason"]').inputValue(),
  )
  await page.locator('[data-testid="correction-reason"]').fill('A till took part of it first; writing the rest off.')
  await page.locator('[data-testid="correction-commit"]').click()
  await page.waitForTimeout(600)
  check(
    '🔑 …and the write-off COMPLETES from there',
    closeOutCalls.length === 1 &&
      closeOutCalls[0].settlementEntryId === RACE_ENTRY &&
      (await mainText()).includes('Remainder written off'),
    JSON.stringify(closeOutCalls[0] ?? {}),
  )

  // 🚩 …and the OTHER refusal: one whose remaining did not move. There is nothing
  // to write off instead, so the screen must offer NOTHING — re-drawing the same
  // Cancel button under a notice saying it was refused is the press-refuse-press
  // loop `correction.ts` forbids.
  await openAccount('0207')
  await selectEntry('01J9SETL0207B')
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('Withdrawing — posted in error.')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('[data-testid="correction-race"]')
  check(
    '🚩 a refusal that did NOT move the remaining offers no button at all',
    (await actButtons()) === 0 &&
      (await correctionKind()) === 'none' &&
      (await page.locator('[data-testid="correction-race"]').innerText()).includes(
        'belongs to a batch',
      ),
    await correctionText(),
  )
  check(
    '🚩 …and it is still not an error surface — the server’s own words, on a notice',
    !(await page.locator('body').innerText()).includes('could not be sent') &&
      !(await correctionText()).includes('Cancel this entry'),
  )
  // 🚩 …and there is a way BACK. Refusing to re-offer the act is right; stranding
  // the accountant on an entry that is still OPEN and still correctable is not.
  await page.locator('[data-testid="correction-dismiss"]').click()
  await page.waitForTimeout(120)
  check(
    '🚩 …and dismissing the notice brings the affordance back — refused is not stranded',
    (await actButtons()) === 1 &&
      (await actKind()) === 'cancel' &&
      (await page.locator('[data-testid="correction-race"]').count()) === 0,
    await correctionKind(),
  )

  // ---- the audit pane: one ordered column of local-time facts ----
  await openAccount('0455')
  await selectEntry('01J9SETL0455A')
  check(
    '🔑 the audit pane orders posting, consumption and void by their own local times',
    JSON.stringify(await auditKinds()) ===
      JSON.stringify(['posted', 'consumed', 'consumed', 'restored', 'consumed']),
    JSON.stringify(await auditKinds()),
  )
  check(
    '🔑 …renders the STORE CODE for a consumption and the POSTER’S NAME for a posting',
    (await auditText()).includes('from branch 0455') && (await auditText()).includes('by هدى القحطاني / Huda Al-Qahtani'),
  )
  check(
    '🔑 …and a REVERSE reads as a RESTORATION here too, consistent with the journal',
    (await page.locator('[data-region="entry-audit"] li[data-fact="restored"]').count()) === 1 &&
      (await page.locator('[data-region="entry-audit"] li[data-fact="restored"]').innerText()).includes('Given back'),
  )
  check(
    '⚠️ …and the pane names WHICH CLOCK, because nothing on screen otherwise could',
    (await auditText()).includes("branch's own local clock") && (await auditText()).includes('UTC'),
  )
  check(
    '⚠️ …with no address and no IP anywhere on it — a desk is not a person',
    !/\d{1,3}(\.\d{1,3}){3}/.test(await auditText()),
  )
  await openAccount('0688')
  await selectEntry('01J9SETL0688A')
  check(
    '🔑 a correction is a fact in the same column — the write-off AFTER the consumption it left standing',
    JSON.stringify(await auditKinds()) === JSON.stringify(['posted', 'consumed', 'written-off']),
    JSON.stringify(await auditKinds()),
  )
  check(
    '272 → …with the closer’s staff id and the branch’s own reason, verbatim',
    (await auditText()).includes('by staff 30117') && (await auditText()).includes('أُسقط الباقي'),
  )
  await openAccount('0331')
  await selectEntry('01J9SETL0331A')
  check(
    '🔑 an undocumented consumption is named IN WORDS on the audit row too, not only in the journal',
    (await auditText()).includes('No document — the close never completed'),
  )

  // ---- and the namespace, again, over 272's new copy ----
  check(
    '🚩 272’s keys are all registered — no raw t() key on either pane',
    !/settlement:|\bcorrection\.|\baudit\./.test((await correctionText()) + (await auditText())),
  )

  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length === 0 ? 0 : 1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
