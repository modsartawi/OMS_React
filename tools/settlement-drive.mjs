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
/** Ticket 270's estate: 1394 fleet rows and the wrong-money lane, both read out of
 *  `fleet-fixture.ts`, the module the vitest suites pin.
 *
 *  WARNING **274 narrowed this to the doors that exist.** The cash-waiting lane, the
 *  ageing count and the flat cross-estate ledger were served here for five tickets
 *  and are served by no SIS.Api door (`.afk/FINDINGS-274.md` B1-B3). A stub is not
 *  allowed to be more generous than the server it stands in for - that is precisely
 *  how those three got built. */
let FLEET = []
/** KEY The OPEN ESTATE off the Store master - a genuinely different set from FLEET,
 *  which holds only the branches carrying settlement rows. See the stub. */
let BRANCHES = []
let ORPHANS = []
/** The server's own roster, for the fleet stub's scope filter. Never sent to a screen. */
let ASSIGNMENT = {}
/** What each committed batch posted, keyed by `batchId` — the stub's stand-in for the
 *  entries table `Settlement/Bulk/Cancel` loops over. */
const BATCHES = {}
let bulkCancelCalls = []
/** Every scope the fleet door was asked for, in order — 274 put the scope on the
 *  wire, so *did the control actually refetch* is a thing this drive can now see. */
let fleetScopes = []
/** Every limit `Settlement/Branches` was asked for - the door defaults to 500 and the
 *  estate is 1394, the same truncation 274 found on the fleet. */
let branchCalls = []
/** KEY The cross-estate ledger (BackOffice 1199 §3), built from the SAME entries the
 *  account door serves - so "entry 143 lands on the right branch" is a claim the drive
 *  can actually check rather than a stub agreeing with itself. Each row carries the
 *  branch's name and its own currencyKey, which is what makes a KSA+Bahrain result
 *  honest and is why nothing on that view totals a column. */
let LEDGER = []
/** The footprint's 3-decimal branches. 0688 is Al-Muharraq — Bahraini, and the fixture's
 *  reason for existing (D10: `95.250` is not `95.25`). */
const BHD_BRANCHES = new Set(['0688'])
/** Every criteria set the ledger door was asked for - including the ones it REFUSED,
 *  so "the screen never issues the empty question" is visible here. */
let ledgerCalls = []
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

/** Ticket 273's two bulk doors. The four preview payloads come out of the app's own
 *  `bulk-fixture.ts` (one transcription, shared with `bulk.test.ts`); which one a
 *  file gets is decided by its NAME, because this stub parses no spreadsheets
 *  either. */
let BULK = {}
/** Every preview this stub has minted, by the `batchId` it minted — so the commit
 *  can be answered against the file that was actually previewed. */
const PREVIEWS = {}
/** The file contents already committed. A second preview of one of them is what
 *  raises the *posted N minutes ago* banner — the content hash, warning and never
 *  refusing. */
const COMMITTED = new Set()
let previewCalls = []
let commitCalls = []
let batchSeq = 0
/** 🔑 The entry of a committed batch whose cancel LOSES the race — a till consumes
 *  part of it a millisecond before the batch withdrawal reaches it. It is how the
 *  drive proves the ticket's *"reporting which rows a till already consumed"*. */
let BATCH_RACE_ENTRY = ''
/** …and the one a till had ALREADY partly consumed before the withdrawal was even
 *  drawn, which the plan must name without ever attempting. */
let BATCH_PRECONSUMED_ENTRY = ''

/** One multipart part, off the raw body. This stub reads the upload the same way
 *  the server will — by part NAME, never by position. */
const part = (raw, name) => {
  const m = raw.match(new RegExp(`name="${name}"[^]*?\r\n\r\n([^]*?)\r\n--`))
  return m ? m[1] : ''
}
const uploadedName = (raw) => (raw.match(/filename="([^"]*)"/) || [])[1] || ''

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
    // KEY **274: the scope is the SERVER's.** The client sends
    // `?scope=mine|unassigned|all` and the door filters - with the estate-wide
    // carve-out (`OrphanCount > 0 OR UncollectedCount > 0`) OR'd into every scoped
    // predicate, so a branch carrying wrong money rows whatever the scope says. The
    // stub honours the parameter the same way, reading the generator's own
    // assignment off the fixture module.
    if (path === 'Settlement/Fleet') {
      const scope = url.searchParams.get('scope') || 'all'
      fleetScopes.push(scope)
      const limit = Number(url.searchParams.get('limit') || 500)
      // WARNING The limit is asked for by the client because the door's own default is
      // 500 and the estate is 1394 - the truncation 274 found. Honour it here so a
      // client that stopped sending it fails the drive instead of silently losing 894
      // branches.
      const inScope = (row) =>
        scope === 'all' ||
        ASSIGNMENT[row.storeId] === scope ||
        row.hasOrphan ||
        row.hasUncollectedReceipt
      return route.fulfill(envelope(FLEET.filter(inScope).slice(0, limit)))
    }
    // KEY **The picker's address book, and it is NOT the fleet** (BackOffice 1199).
    // The fleet is *branches with settlement activity*; this is the open Store master.
    // The stub keeps them genuinely different sets - see BRANCHES_ONLY below - so a
    // client that went back to resolving a typed branch against the fleet fails here
    // instead of silently losing every branch nobody has posted to yet.
    if (path === 'Settlement/Branches') {
      branchCalls.push(Number(url.searchParams.get('limit') || 500))
      return route.fulfill(envelope(BRANCHES.slice(0, Number(url.searchParams.get('limit') || 500))))
    }
    // The one enumerated lane. Estate-wide, always, and it takes no scope at all.
    if (path === 'Settlement/Orphans') return route.fulfill(envelope(ORPHANS))
    // KEY **The cross-estate lookup** (BackOffice 1199 §3) - the door that resolves an
    // entry NUMBER to the branch it is on, which `Settlement/Account` cannot because it
    // takes the storeId the caller is ringing up to ask for.
    //
    // WARNING **The stub REFUSES an unfiltered call, exactly as the door does.** This is
    // the one place a stub being more generous than its server would hide a real defect:
    // an unfiltered ledger is bounded only by the cap, so it answers "the newest 500
    // entries in the estate" while looking like the ledger. A client that stopped
    // guarding would silently start asking for that - so it fails here instead.
    if (path === 'Settlement/Ledger') {
      const q = (k) => (url.searchParams.get(k) || '').trim()
      const entryNumber = q('entryNumber')
      const asked = ['entryNumber', 'storeId', 'entryKind', 'status', 'batchId', 'postedFrom', 'postedTo']
        .some((k) => q(k) !== '')
      ledgerCalls.push(Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'limit')))
      if (!asked)
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'At least one ledger criterion is required.',
            errors: ['SettlementLedgerCriterionRequired'],
          }),
        )
      const limit = Number(url.searchParams.get('limit') || 500)
      const rows = LEDGER.filter(
        (r) =>
          (entryNumber === '' || String(r.entryNumber) === entryNumber) &&
          (q('storeId') === '' || r.storeId === q('storeId')) &&
          (q('entryKind') === '' || r.entryKind === q('entryKind')) &&
          (q('status') === '' || r.status === q('status')) &&
          (q('batchId') === '' || r.batchId === q('batchId')) &&
          (q('postedFrom') === '' || r.postedAt.slice(0, 10) >= q('postedFrom')) &&
          // WARNING A bare date means the WHOLE of that day - the server compares against
          // the next midnight, exclusively. Comparing the date part is the same rule.
          (q('postedTo') === '' || r.postedAt.slice(0, 10) <= q('postedTo')),
      )
      // Newest first, and a TOTAL order because the entry number is unique estate-wide.
      return route.fulfill(
        envelope([...rows].sort((a, b) => b.entryNumber - a.entryNumber).slice(0, limit)),
      )
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
      // WARNING **274: cancel-as-a-unit no longer arrives here.** 273 withdrew a batch
      // by looping this door once per row, because it believed there was no bulk
      // door. There is - `Settlement/Bulk/Cancel` - and it is stubbed below.
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
            // 274: the act's answer carries the entry's resulting status on both
            // doors - refused, so it is unchanged.
            status: 'OPEN',
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
            status: found?.entry.status ?? 'OPEN',
          }),
        )
      if (found) {
        found.entry.status = 'CANCELLED'
        found.entry.closedByStaffId = '30117'
        found.entry.closedAt = '2026-08-13T09:20:00'
        found.entry.closedReason = body.reason
      }
      return route.fulfill(
        envelope({
          accepted: true,
          refusalReason: '',
          remainingAmount: found?.entry.amount ?? 0,
          status: 'CANCELLED',
        }),
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
      // 274: cancel and close-out share ONE server type, so this answers
      // `refusalReason` and `status` as well - the asymmetry 272 transcribed from D8
      // does not exist on the wire.
      return route.fulfill(
        envelope({
          accepted: true,
          remainingAmount: forgiven,
          refusalReason: '',
          status: 'CLOSED_OUT',
        }),
      )
    }
    if (path === 'Settlement/Repair') {
      const body = route.request().postDataJSON() || {}
      repairCalls.push(body)
      // 🔑 The race, lost: a document arrived for this consumption between the list
      // being drawn and the button being pressed. The server's guard is inside its
      // UPDATE, so nothing happened — and it is a 200, not a failure.
      // WARNING 274: the field is `remainingAmount`, not `remainingAfter` - 270
      // transcribed the consumption row's spelling onto the act's answer, and it read
      // `undefined`. The answer also carries the ids and the amount restored.
      if (body.settlementConsumptionId === NOOP_CONSUMPTION)
        return route.fulfill(
          envelope({
            accepted: false,
            noOp: true,
            settlementEntryId: '',
            settlementConsumptionId: '',
            amount: 0,
            remainingAmount: 0,
            refusalReason: 'CONSUMPTION_NO_LONGER_ORPHAN',
          }),
        )
      // …and the ordinary repair: the money goes back on the entry, and the lane it
      // came from no longer holds it.
      const repaired = ORPHANS.find(
        (o) => o.settlementConsumptionId === body.settlementConsumptionId,
      )
      ORPHANS = ORPHANS.filter(
        (o) => o.settlementConsumptionId !== body.settlementConsumptionId,
      )
      return route.fulfill(
        envelope({
          accepted: true,
          noOp: false,
          settlementEntryId: repaired?.settlementEntryId ?? '',
          // The COMPENSATING row the repair wrote, not the orphan it repaired.
          settlementConsumptionId: `${body.settlementConsumptionId}R`,
          amount: repaired?.amount ?? 0,
          remainingAmount: 450,
          refusalReason: '',
        }),
      )
    }
    // ---- ticket 273: the second posting door ----
    // 🚩 **The stub parses nothing either.** Which preview a file gets is decided by
    // its NAME, exactly as the client decides nothing about its contents: spec 267
    // D7 puts all parsing on the server, and a drive that parsed a CSV in node would
    // be proving a code path this app deliberately does not have.
    if (path === 'Settlement/Bulk/Preview') {
      const raw = route.request().postData() || ''
      const name = uploadedName(raw)
      const content = part(raw, 'file')
      const entryKind = part(raw, 'entryKind')
      previewCalls.push({ name, entryKind, bytes: content.length })

      const base = name.includes('bad')
        ? BULK.BAD_ROW_PREVIEW
        : name.includes('header')
          ? BULK.BAD_HEADER_PREVIEW
          : name.includes('dup')
            ? BULK.DUPLICATE_PREVIEW
            : COMMITTED.has(content)
              ? // 🔑 The content hash WARNS and never refuses: the same rows going up
                // a second time is a real thing finance does, and refusing would make
                // a genuine repeat unpostable.
                BULK.REPLAY_PREVIEW
              : BULK.CLEAN_PREVIEW

      // KEY **274: the CLIENT mints the batch id, and it must be a ULID.** 273 had the
      // server minting it here. The real door takes it as a required form field and
      // refuses anything that is not 26 characters of Crockford base-32 - because the
      // batch's ENTRY IDS are derived from it, so two ids sharing their last 21
      // characters would mint the same entries and silently replay. The stub enforces
      // it, or a client that stopped sending one would pass this drive.
      const batchId = part(raw, 'batchId')
      if (!/^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$/.test(batchId))
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'BatchId must be a 26-character ULID minted by the client at preview.',
            errors: [
              { errorCode: 'SettlementBulkBatchIdInvalid', internalErrorCode: '', errorMessage: '' },
            ],
          }),
        )
      PREVIEWS[batchId] = { name, content, preview: base }
      return route.fulfill(envelope({ ...base, batchId, entryKind: entryKind || base.entryKind }))
    }
    if (path === 'Settlement/Bulk/Commit') {
      const raw = route.request().postData() || ''
      const batchId = part(raw, 'batchId')
      const content = part(raw, 'file')
      commitCalls.push({ batchId, name: uploadedName(raw), entryKind: part(raw, 'entryKind') })
      const previewed = PREVIEWS[batchId]
      if (!previewed)
        return route.fulfill(
          envelope(null, { status: 409, success: false, message: 'No such batch.' }),
        )

      // KEY **The sheet changed between review and commit.** The client cannot detect
      // that and must not try - it never read the file - so the server refuses on the
      // hash it was handed back.
      //
      // WARNING **274 settled the SHAPE of that refusal, and 273 had it backwards.**
      // It is a **200 carrying `accepted: false`**, exactly like cancel and repair -
      // the server decided, and a decision is not a crash. The stub answers that way
      // now, which is what makes the screen's `if (!result.accepted)` path real: under
      // the old error-shaped stub, a client that read `posted` and ignored `accepted`
      // would still have passed.
      // WARNING A drive cannot rewrite a file under a live `File` handle mid-run, so
      // the edit is expressed by NAME: `august-edited.csv` previews and then refuses.
      const sentHash = part(raw, 'contentHash')
      if (
        previewed.name.includes('edited') ||
        content !== previewed.content ||
        sentHash !== previewed.preview.contentHash
      )
        return route.fulfill(
          envelope({
            batchId,
            accepted: false,
            refusalReason: 'This sheet has changed since it was previewed.',
            posted: 0,
            replayed: false,
            entryNumbers: [],
            errors: [],
            warnings: [],
          }),
        )

      // WARNING **274: the batch is held HERE, not pushed into a ledger.** 273 wrote a
      // full entry row per line into the cross-estate ledger so the withdrawal screen
      // could fetch them back. There is no such door (B1) - and there is no need, now
      // that `Settlement/Bulk/Cancel` withdraws the batch as a unit and reports each
      // row itself.
      const rows = previewed.preview.rows
      const entryNumbers = []
      const posted = []
      for (const row of rows) {
        const entryNumber = nextEntryNumber++
        entryNumbers.push(entryNumber)
        posted.push({
          settlementEntryId: `01J9SETLBULK${entryNumber}`,
          entryNumber,
          storeId: row.storeCode,
          amount: row.amount,
          remainingAmount: row.amount,
          status: 'OPEN',
        })
      }
      // The THIRD row is one a till reached first, before the withdrawal was even
      // drawn - the batch cancel must NAME it rather than count it…
      if (posted[2]) {
        posted[2].remainingAmount = posted[2].amount - 100
        BATCH_PRECONSUMED_ENTRY = posted[2].settlementEntryId
      }
      // …and the SECOND is the one whose cancel loses its race mid-act.
      BATCH_RACE_ENTRY = `01J9SETLBULK${entryNumbers[1]}`
      BATCHES[batchId] = posted
      COMMITTED.add(content)
      return route.fulfill(
        envelope({
          batchId,
          accepted: true,
          refusalReason: '',
          posted: rows.length,
          replayed: false,
          entryNumbers,
          errors: [],
          warnings: [],
        }),
      )
    }
    // ---- ticket 273 / 1186: the batch, withdrawn as a UNIT ----
    // KEY **The door 273 did not know existed.** It is a loop over the per-entry
    // cancel, server-side, reporting each row's own outcome - so a row a till already
    // consumed is refused and NAMED, never written off for sharing a batch.
    if (path === 'Settlement/Bulk/Cancel') {
      const body = route.request().postDataJSON() || {}
      bulkCancelCalls.push(body)
      const entries = BATCHES[body.batchId] || []
      const rows = entries.map((e) => {
        // The pre-consumed row and the race-loser both refuse, for the two different
        // reasons an accountant has to be able to tell apart.
        if (e.settlementEntryId === BATCH_PRECONSUMED_ENTRY)
          return {
            ...e,
            accepted: false,
            refusalReason: 'A till consumed part of this entry.',
            status: 'OPEN',
          }
        if (e.settlementEntryId === BATCH_RACE_ENTRY)
          return {
            ...e,
            accepted: false,
            refusalReason: 'A till consumed part of this entry.',
            remainingAmount: 300,
            status: 'OPEN',
          }
        return { ...e, accepted: true, refusalReason: '', status: 'CANCELLED' }
      })
      const cancelled = rows.filter((r) => r.accepted).length
      return route.fulfill(
        envelope({
          batchId: body.batchId,
          total: rows.length,
          cancelled,
          refused: rows.length - cancelled,
          rows,
        }),
      )
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
  // KEY The ledger is the SAME entries, flattened across branches and labelled with the
  // two things a cross-branch list needs that a one-branch account gets from its
  // heading: the store's NAME and its own CURRENCY. Derived rather than transcribed, so
  // "entry 143 lands on the right branch" is checked against the account the screen
  // would then open - a hand-written second copy could agree with the wrong branch and
  // the drive would pass.
  LEDGER = Object.values(ACCOUNTS).flatMap((account) =>
    account.entries.map((e) => ({
      ...e,
      storeName: account.storeName,
      // WARNING The BHD branch is what makes the mixed-currency column real. A stub that
      // gave every row SAR would let the Currency column stay hidden and the per-row
      // precision go unproven - which is the defect D10 exists to forbid.
      //
      // Resolved from the STORE CODE rather than off the account fixture, because 274
      // removed `currencyKey` from those accounts - the account door does not send one
      // (B6) and the ledger door does. 0688 is Al-Muharraq, the footprint's only
      // 3-decimal branch. The stub plays the server, and the server reads Plants.
      currencyKey: BHD_BRANCHES.has(account.storeId) ? 'BHD' : 'SAR',
    })),
  )
  // …and 270's estate, from the module the vitest suites assert against: 1394
  // branches, 1255 of them assigned to nobody, four orphan consumptions and 140
  // ageing entries of which 47 are in scope.
  const estate = await page.evaluate(async () => {
    const m = await import('/src/features/collection/settlement/fleet-fixture.ts')
    return {
      fleet: m.SETTLEMENT_FLEET,
      branches: m.SETTLEMENT_BRANCHES,
      orphans: m.SETTLEMENT_ORPHANS,
      // The stub plays the SERVER, so it gets the roster the server has — see the
      // export's own docblock. No screen may read this.
      assignment: m.SETTLEMENT_ASSIGNMENT,
    }
  })
  FLEET = estate.fleet
  BRANCHES = estate.branches
  ORPHANS = estate.orphans
  ASSIGNMENT = estate.assignment
  // …and 273's four preview payloads, from the module `bulk.test.ts` asserts
  // against: a clean month, one with an unresolvable code, one with a duplicate
  // warning, and the same file coming back a second time.
  BULK = await page.evaluate(async () => {
    const m = await import('/src/features/collection/settlement/bulk-fixture.ts')
    return {
      CLEAN_PREVIEW: m.CLEAN_PREVIEW,
      BAD_ROW_PREVIEW: m.BAD_ROW_PREVIEW,
      BAD_HEADER_PREVIEW: m.BAD_HEADER_PREVIEW,
      DUPLICATE_PREVIEW: m.DUPLICATE_PREVIEW,
      REPLAY_PREVIEW: m.REPLAY_PREVIEW,
    }
  })
  // The oldest orphan is the one whose document arrives mid-click. Ordered on
  // `consumedAt`: 274 found the door sends no `ageDays` (B2), and the timestamp is
  // the same server clock at better resolution.
  NOOP_CONSUMPTION = [...ORPHANS].sort((a, b) =>
    a.consumedAt < b.consumedAt ? -1 : a.consumedAt > b.consumedAt ? 1 : 0,
  )[0].settlementConsumptionId

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
    journal.includes('written off') && journal.includes('400.00'),
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
  check('🚩 …while its Amount still says what was actually posted', (await cancelledCells('amount')).includes('180.00'))
  // WARNING **274 changed what can be asserted here, and the change is a FINDING.**
  // No read door carries `currencyKey` (`FINDINGS-274.md` B6), so the screen cannot
  // draw at the branch's own precision - it draws through
  // `formatMoneyOfUnknownCurrency`, which refuses to ROUND rather than pretending to
  // know the currency. What that preserves is every digit that means money; what it
  // cannot restore is a trailing zero, because `95.250` and `95.25` are the same
  // IEEE-754 number.
  check(
    '⚠️ 274 → 0688 draws its figures without inventing or losing one, currency unknown',
    text.includes('95.25') && text.includes('640.00'),
  )
  check(
    '🔑 …and a genuine third decimal SURVIVES — the fils D10 exists for',
    // The assertion that still bites: a figure carrying real fils must not be
    // rounded to two places. 0688's own amounts have none, so this is checked at the
    // unit level (`account-projection.test.ts`); here we prove the SAR case is
    // untouched, which is the regression the workaround could have caused.
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
    // rather than a request away. ⚠️ Waited for by its OWN subject — the address —
    // rather than by a fixed 150 ms, which went red at random on 272's runs and is
    // the reason a proof tool stops being believed.
    await page
      .waitForFunction((want) => new URLSearchParams(location.search).get('q') === want, q, {
        timeout: 4000,
      })
      .catch(() => {})
    await page.waitForTimeout(60)
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

  // ---- the ONE lane that has a door ----
  //
  // WARNING **274 removed two of the three.** Cash waiting has no door that
  // enumerates it and ageing has no threshold to count against (`FINDINGS-274.md`
  // B2/B3), so this drive no longer serves or asserts them. A stub more generous
  // than the server is exactly how they came to be built.
  text = await openDoor()
  check('270 → the door opens on MY BRANCHES', (await page.locator('[data-region="settlement-scope"] button[aria-pressed="true"]').innerText()).includes('My branches'))
  check(
    '🔑 wrong money is ENUMERATED IN FULL — one row per orphan consumption',
    (await laneRows('wrong-money')) === ORPHANS.length,
    `${await laneRows('wrong-money')} rows`,
  )
  check(
    '274 → the two lanes with no door behind them are GONE, not empty',
    (await page.locator('[data-lane="cash-waiting"]').count()) === 0 &&
      (await page.locator('[data-lane="ageing"]').count()) === 0,
  )

  // ---- 🔑 THE CARVE-OUT: the load-bearing part of this ticket ----
  // 0331 is UNASSIGNED in the fixture, deliberately, and carries an orphan. It must
  // be on this screen under scope = mine — which after 274 is the SERVER's doing:
  // the fleet stub ORs `hasOrphan` into every scoped predicate, exactly as the door
  // does, and the orphan lane takes no scope at all.
  check(
    '🔑 an UNASSIGNED branch’s wrong money is on screen under scope = MINE',
    (await page.locator('[data-lane="wrong-money"] li').filter({ hasText: '0331' }).count()) === 1,
  )
  const mineRows = await laneRows('wrong-money')
  const mineFleetCalls = fleetScopes.length
  await page.locator('[data-region="settlement-scope"] button[data-scope="all"]').click()
  await page.waitForTimeout(200)
  check(
    '🔑 274 → changing the scope REFETCHES, because the scope is now on the wire',
    fleetScopes.length > mineFleetCalls && fleetScopes.at(-1) === 'all',
    fleetScopes.join(' → '),
  )
  check(
    '🔑 …and the enumerated lane did NOT move when the scope did',
    (await laneRows('wrong-money')) === mineRows,
  )
  check('270 → widening is one click and is never locked', page.url().includes('scope=all'))
  check('⚠️ the screen says the lane is estate-wide, rather than leaving it to be inferred', (await mainText()).includes('whole estate'))

  // ---- the search: two keys, one box ----
  //
  // WARNING D2 asked for four. City is not on the fleet row (B5) and an entry number
  // needs the ledger door that does not exist (B1); both are recorded rather than
  // faked, so neither is asserted here.
  text = await openDoor()
  check('🔑 search finds a branch by CODE', (await search('0331')).includes('Al-Nakheel'))
  check('🔑 search finds the same branch by name in ARABIC', (await search('النخيل')).includes('0331'))
  check('🔑 …and by name in ENGLISH', (await search('Al-Nakheel')).includes('0331'))
  await search('0331')
  check(
    '🔑 the scope never refuses — an unassigned branch is still found under MINE',
    (await page.locator('[data-hit="0331"]').count()) === 1,
  )
  // WARNING 274: the fleet is scoped SERVER-SIDE now, so *mine* holds a couple of
  // dozen branches rather than the estate — the cap is proven at scope=all, which is
  // the answer that actually holds 1394 rows.
  await page.locator('[data-region="settlement-scope"] button[data-scope="all"]').click()
  await page.waitForTimeout(200)
  await search('Pharmacy')
  check(
    '270 → a broad query is capped and says how many matched',
    /Showing 20 of \d{3,}/.test(await page.locator('[data-region="search-results"]').innerText()),
    (await page.locator('[data-region="search-results"]').innerText()).split('\n')[0],
  )
  check(
    '270 → a query that matches nothing says so',
    (await search('zzzz')) === '' && (await mainText()).includes('No branch matches that'),
    (await mainText()).replace(/\n/g, ' ').slice(0, 90),
  )

  // ---- a search hit is an ADDRESS: it lands on 269's account ----
  await search('0142')
  await page.locator('[data-hit="0142"]').click()
  await appears('[data-region="branch-account"]')
  check('270 → a search hit opens the BRANCH ACCOUNT 269 built', (await page.locator('[data-region="branch-account"]').count()) === 1 && page.url().includes('store=0142'), page.url())

  // ---- an entry number jumps STRAIGHT to that entry's branch: GONE ----
  //
  // WARNING **274 removed this, and it is the loss that hurts most.** *"Entry 143,
  // whichever branch it is on"* is the phone call the box existed for, and spec 1173
  // mints `EntryNumber` precisely because it is the handle finance and the branch
  // settle by. Resolving one needs a cross-estate lookup, and `Settlement/Ledger`
  // does not exist (`FINDINGS-274.md` B1). `Settlement/Account` cannot stand in: it
  // takes the `storeId` the caller is asking for.
  //
  // The two checks that stood here — the jump, and landing on the ENTRY rather than
  // merely the branch, with its journal open underneath — come back with that door.

  await openDoor()
  await search('999999')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  check(
    '274 → a bare number that names no branch does not navigate',
    !page.url().includes('store='),
    page.url(),
  )
  const numericCode = FLEET.find((r) => /^[1-9]\d*$/.test(r.storeId))
  await openDoor()
  // Scoped server-side now — widen before asking for a branch that is not *mine*.
  await page.locator('[data-region="settlement-scope"] button[data-scope="all"]').click()
  await page.waitForTimeout(200)
  await search(numericCode.storeId)
  await page.keyboard.press('Enter')
  await appears('[data-region="branch-account"]')
  check(
    '🔑 an EXACT branch code goes to that branch, beating every other match',
    page.url().includes(`store=${numericCode.storeId}`),
    `${numericCode.storeId} → ${page.url()}`,
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
  const noopRow = orphanRows().filter({ hasText: ORPHANS.find((o) => o.settlementConsumptionId === NOOP_CONSUMPTION)?.storeId ?? '—' })
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
    '🚩 coming back from a branch keeps the widened scope',
    page.url().includes('scope=all') && !page.url().includes('store='),
    page.url(),
  )

  // ---- the flat cross-estate ledger: GONE ----
  //
  // WARNING **Fifteen checks stood here until ticket 274.** They drove a view over
  // `Settlement/Ledger` — filter-first, capped, per-currency footer, a row as a way
  // through to its branch, and the filter surviving a Back — and every one of them
  // was green against a stub for a door BackOffice never built. Spec 1173 D13 lists
  // six doors and a cross-estate lookup is not among them (`FINDINGS-274.md` B1).
  //
  // KEY That is the whole lesson of this ticket in one deleted block: a drive is only
  // as honest as its stub. These passed for five tickets and proved nothing.
  //
  // The ask stands and is well-founded — 1173 mints `EntryNumber` and calls it the
  // handle finance and the branch settle by on the phone, then gives nobody a way to
  // resolve one. When that door lands, this section and its screen come back.

  // ---- and the namespace, again, over 270's new copy ----
  text = await openDoor()
  check('🚩 270’s keys are all registered — no raw t() key on screen', !/settlement:|\bworklist\.|\bsearch\.|\brepair\./.test(text))

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

  // ---- KEY 274/1199: THE PICKER SEARCHES THE ESTATE, NOT THE LEDGER ----
  //
  // The bug this door was minted for. The form resolved a typed branch against
  // `Settlement/Fleet`, whose every UNION branch drives off the settlement tables -
  // so it could only ever name a branch that ALREADY had settlement rows. On a
  // migrated-but-unused database it named none at all, and the only door that mints
  // the first row could not be reached without one. 9001/9002/9003 exist in the
  // Store master and on no settlement door whatsoever: if the picker ever goes back
  // to the fleet, these four checks are what turn red.
  await typeBranch('9001')
  check(
    '🔑 274 → a branch NOTHING has ever been posted to is postable',
    (await page.locator('[data-testid="post-branch-resolved"]').getAttribute('data-store')) === '9001' &&
      !(await reviewBlocked()),
    (await page.locator('[data-testid="post-branch-resolved"]').innerText()).replace(/\n/g, ' '),
  )
  check(
    '🔑 …and it is NOT on the fleet, which is what makes that check mean something',
    !FLEET.some((r) => r.storeId === '9001') && BRANCHES.some((b) => b.storeId === '9001'),
  )
  check(
    '🚩 …asked for with a limit the estate FITS IN — the door defaults to 500 of 1394',
    branchCalls.length > 0 && branchCalls.every((n) => n >= 1394),
    `limits asked: ${[...new Set(branchCalls)].join(', ')}`,
  )
  // The pairing master LABELS this list. It never filters it - so a branch served by
  // somebody else resolves and posts, and says whose it is while doing so.
  check(
    '🔑 274 → the accountant’s OWN branch is marked as theirs',
    (await page.locator('[data-testid="post-branch-served-by"]').innerText()).includes('Served by you'),
  )
  await typeBranch('9002')
  check(
    '🚩 …and somebody ELSE’s branch is NAMED and still postable — the pairing ranks, it never gates',
    (await page.locator('[data-testid="post-branch-served-by"]').innerText()).includes('محاسب آخر') &&
      !(await reviewBlocked()),
    (await page.locator('[data-testid="post-branch-served-by"]').innerText()).replace(/\n/g, ' '),
  )
  await typeBranch('9003')
  check(
    '⚠️ …and a branch paired to NOBODY says so plainly, rather than looking unloaded',
    (await page.locator('[data-testid="post-branch-served-by"]').innerText()).includes('nobody') &&
      !(await reviewBlocked()),
  )
  // The city: D2's third search key, which the fleet row has never carried.
  await typeBranch('Dammam')
  check(
    '🔑 274 → a branch is findable by its CITY, the key the fleet row cannot carry',
    (await page.locator('[data-testid="post-branch-resolved"]').count()) === 1 ||
      (await page.locator('[data-testid="post-branch-ambiguous"]').count()) === 1,
  )
  await typeBranch('0331')
  await page.locator('dialog [data-kind="SURPLUS"]').click()
  await typeAmount('1,234.5')
  check(
    '271 → the read-back groups the figure and words it',
    (await wordsText()).includes('1,234.50') &&
      (await wordsText()).includes('one thousand two hundred thirty-four') &&
      (await wordsText()).includes('thousandths'),
    (await wordsText()).replace(/\n/g, ' '),
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
  // WARNING **274: the words can no longer name the currency, or round to it.** No
  // read door carries `currencyKey` (B6), so the amount is worded at the scale money
  // is HELD at - three decimals - and through the generic bank. Wording it at two
  // would read a Bahraini `95.505` back as *95.51*, get it approved, and store
  // `95.505`: the words and the ledger disagreeing, which is what D4 exists to stop.
  // The guard itself is intact; what it lost is the noun.
  check(
    '⚠️ 274 → the read-back words the figure without inventing a currency',
    (await wordsText()).includes('50,000.567') &&
      (await wordsText()).includes('fifty thousand') &&
      !(await wordsText()).includes('riyals'),
    (await wordsText()).replace(/\n/g, ' '),
  )
  // WARNING **The smallest-unit refusal softened, deliberately.** `0.004` is below
  // what a SAR branch can count - but this screen no longer knows the branch is
  // Saudi, and a client may not refuse money on a currency it is guessing. The
  // server refuses it with `SettlementAmountRoundsToZero`, a 400 that names the
  // reason. What the client still refuses is what rounds to zero at the LEDGER's own
  // scale, which is true of every branch in the footprint.
  await typeAmount('0.0004')
  check(
    '⚠️ a figure below the LEDGER’s own scale is still refused, and says why',
    (await reviewBlocked()) && (await page.locator('[data-testid="post-amount-too-small"]').count()) === 1,
  )
  // 🚩 …and no cap anywhere: a legitimately large entry reviews and commits like any
  // other. The guard is the sentence, not a threshold.
  await typeAmount('9000000')
  check(
    '🚩 there is NO numeric cap — a nine-million entry reviews like any other',
    !(await reviewBlocked()) && (await wordsText()).includes('nine million'),
    (await wordsText()).replace(/\n/g, ' ').slice(0, 90),
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
    (await page.locator('[data-testid="post-review-figure"]').innerText()).includes('50,000.567') &&
      (await page.locator('[data-testid="post-review-words"]').innerText()).includes('fifty thousand'),
    await page.locator('[data-testid="post-review-words"]').innerText(),
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
  // KEY **This is the check B6 is FOR.** 0688 is Bahraini; its fils are real money.
  // With no currency on the wire the screen can no longer say *dinars and fils* - but
  // it must still not ROUND them away, which is the half that costs money.
  check(
    '🔑 274 → a Bahraini amount keeps its fils, even with no currency to name them',
    (await wordsText()).includes('95.5') && (await wordsText()).includes('five hundred thousandths'),
    (await wordsText()).replace(/\n/g, ' '),
  )
  await typeAmount('95.505')
  check(
    '🔑 …and a third decimal is neither rounded away nor invented',
    (await wordsText()).includes('95.505'),
    (await wordsText()).replace(/\n/g, ' '),
  )
  await typeAmount('95.5')
  await page.locator('[data-testid="post-reason"]').fill('August stocktake difference.')
  await page.locator('[data-testid="post-review"]').click()
  postCalls = []
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  check(
    '🔑 …and the BHD entry lands at three decimals, the server’s own figure read back',
    postCalls[0]?.amount === 95.5 && (await dialogText()).includes('95.5'),
    `${postCalls[0]?.amount} · ${(await dialogText()).replace(/\n/g, ' ').slice(0, 80)}`,
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
    '272 → …and says WHY it can be withdrawn whole',
    (await correctionText()).includes('95.25') && (await correctionText()).includes('as though it never happened'),
    (await correctionText()).replace(/\n/g, ' ').slice(0, 100),
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

  // ═══ Ticket 273 — a month's audit uploads, previews and commits ═══════════════
  //
  // 🔑 The second posting door, beside 271's single form, which is untouched. Every
  // check below is about one of the ticket's two guards — the preview grid's
  // resolved BRANCH NAME per row, and the file's total IN WORDS at the commit — or
  // about the all-or-nothing rule that decides whether the button is there at all.
  //
  // ⚠️ The sheets are bytes, not spreadsheets: nothing on either side of this drive
  // parses one (spec 267 D7 puts all parsing on the server), so a file's NAME is
  // what picks the preview the stub answers with.
  const sheet = (name, body) => ({
    name,
    mimeType: name.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv',
    buffer: Buffer.from(body),
  })
  const CSV_ROWS = 'store,amount,reason\n0142,500,july\n0207,1250.50,july\n0331,4300,july\n0455,120000,july\n0688,2650,july\n'

  const openUpload = async () => {
    scenario = { accessBody: ALL, access403: false, access500: false }
    await page.goto(BASE + ROUTE)
    await page.waitForLoadState('networkidle')
    await page.locator('[data-testid="bulk-open"]').click()
    return appears('[data-region="bulk-upload"]')
  }
  const upload = async (file) => {
    await page.locator('[data-testid="bulk-file"]').setInputFiles(file)
    await page.locator('[data-testid="bulk-preview"]').click()
    await appears('[data-testid="bulk-rows"], [data-testid="bulk-blockers"]')
    await page.waitForTimeout(80)
    return page.locator('[data-region="bulk-upload"]').innerText()
  }
  const uploadText = async () => page.locator('[data-region="bulk-upload"]').innerText()
  const previewRows = async () => page.locator('[data-testid="bulk-rows"] tbody tr').count()
  const commitLabel = async () => page.locator('[data-testid="bulk-commit"]').innerText()
  const commitBlocked = async () =>
    (await page.locator('[data-testid="bulk-commit"]').getAttribute('aria-disabled')) === 'true'

  check('273 → the upload door sits BESIDE the single form, not instead of it', await openUpload(), '')
  check(
    '273 → the kind is chosen for the WHOLE FILE, and the sheet carries no kind column',
    (await uploadText()).includes('One kind per file') &&
      (await page.locator('[data-region="bulk-kind"] button').count()) === 2,
  )

  // ---- the ordinary month ----
  let bulkText = await upload(sheet('august.csv', CSV_ROWS))
  const csvRows = await previewRows()
  const csvLabel = await commitLabel()
  check('🔑 every previewed row shows its BRANCH NAME, resolved from the code', csvRows === 5 && bulkText.includes('Al-Rawdah') && bulkText.includes('Qurtubah') && !bulkText.includes('No branch has this code'), `${csvRows} rows`)
  check(
    '🔑 the commit carries the file’s total IN WORDS, and it is the sum of the rows',
    (await page.locator('[data-testid="bulk-total-words"]').innerText()).includes(
      'one hundred twenty-eight thousand seven hundred riyals and fifty halalas',
    ) && bulkText.includes('128,700.50'),
    await page.locator('[data-testid="bulk-total-words"]').innerText(),
  )
  check(
    '🔑 …and the guard is ON THE BUTTON, in words — not merely on the screen',
    csvLabel.includes('5') &&
      csvLabel.includes('one hundred twenty-eight thousand seven hundred riyals and fifty halalas'),
    csvLabel,
  )
  check(
    '⚠️ …and NOT once per row — the in-words guard does not survive multiplication',
    (await page.locator('[data-testid="bulk-total-words"]').count()) === 1,
  )

  // ---- the same rows as an .xlsx ----
  await page.locator('[data-testid="bulk-back"]').click()
  await page.waitForTimeout(80)
  bulkText = await upload(sheet('august.xlsx', CSV_ROWS + ' xlsx'))
  check(
    '🔑 an .xlsx and a .csv of the same rows preview IDENTICALLY',
    (await previewRows()) === csvRows && (await commitLabel()) === csvLabel,
    `${await previewRows()} rows · ${await commitLabel()}`,
  )
  check(
    '…and the client uploaded BYTES — it read neither file',
    previewCalls.length === 2 &&
      previewCalls.every((c) => c.entryKind === 'SHORTAGE' && c.bytes > 0),
    JSON.stringify(previewCalls.map((c) => c.name)),
  )

  // ---- one unresolvable code stops the whole file ----
  await page.locator('[data-testid="bulk-back"]').click()
  await page.waitForTimeout(80)
  bulkText = await upload(sheet('august-bad.csv', CSV_ROWS.replace('0331', '9999')))
  check(
    '🔑 an unresolvable code is a HARD ERROR and blocks the WHOLE file',
    (await commitBlocked()) &&
      (await commitLabel()).includes('Fix the sheet') &&
      bulkText.includes('branch has the code 9999'),
    (await commitLabel()) + ' · ' + String(await commitBlocked()),
  )
  check(
    '⚠️ …while the good rows are still shown — finance fixes the sheet against them',
    (await previewRows()) === 5 &&
      (await page.locator('[data-testid="bulk-rows"] tr[data-unresolved="true"]').count()) === 1,
  )
  check(
    '🚩 …and the bad row is named IN WORDS, not left as a blank cell',
    bulkText.includes('No branch has this code'),
  )

  // ---- a sheet missing a required header ----
  // ⚠️ The ticket's own open question: a missing required header must refuse NAMING
  // WHAT IT EXPECTED. The column travels on the blocker and is rendered.
  await page.locator('[data-testid="bulk-back"]').click()
  await page.waitForTimeout(80)
  bulkText = await upload(sheet('august-header.csv', 'store,reason\n0142,july\n'))
  check(
    '⚠️ a missing required header refuses the FILE, naming the column it expected',
    // WARNING 274: the wire locates a fault by machine CODE, not by spreadsheet
    // column, so the column is named in the server's own MESSAGE rather than in a
    // field the screen re-renders. The ticket's open question is still answered -
    // the refusal says which column it expected - just by the party that knows.
    (await commitBlocked()) &&
      bulkText.includes('The file itself') &&
      bulkText.includes('amount') &&
      (await previewRows().catch(() => 0)) === 0,
    bulkText.replace(/\n/g, ' ').slice(0, 120),
  )

  // ---- a duplicate warns on its row and commits ----
  await page.locator('[data-testid="bulk-back"]').click()
  await page.waitForTimeout(80)
  bulkText = await upload(sheet('august-dup.csv', CSV_ROWS + '# dup\n'))
  check(
    '🔑 a duplicate-kind row WARNS on its own row and still commits',
    !(await commitBlocked()) &&
      (await page.locator('[data-testid="bulk-rows"] tr[data-warned="true"]').count()) === 1 &&
      bulkText.includes('already carries an open shortage'),
    String(await commitBlocked()),
  )
  check(
    '🚩 …and the screen says WHY it is not a refusal — never stricter than the single form',
    bulkText.includes('never stricter than the single form'),
  )

  // ---- upload → preview → commit ----
  await page.locator('[data-testid="bulk-back"]').click()
  await page.waitForTimeout(80)
  await upload(sheet('august.csv', CSV_ROWS))
  commitCalls = []
  await page.locator('[data-testid="bulk-commit"]').click()
  await appears('[data-region="bulk-done"]')
  const doneText = await page.locator('[data-region="bulk-done"]').innerText()
  const BATCH = await page.locator('[data-region="bulk-done"]').getAttribute('data-batch')
  check(
    '🔑 the drive walks upload → preview → commit, and the COMMIT RE-SENDS THE FILE',
    commitCalls.length === 1 &&
      commitCalls[0].name === 'august.csv' &&
      commitCalls[0].batchId === BATCH &&
      doneText.includes('5 entries are posted'),
    JSON.stringify(commitCalls[0] ?? {}),
  )
  check(
    '…and the confirmation carries the entry numbers and a way to withdraw the batch',
    doneText.includes('Entry numbers') &&
      (await page.locator('[data-testid="bulk-done-withdraw"]').count()) === 1,
  )

  // ---- the same file, a second time ----
  await page.locator('[data-testid="bulk-close"]').click()
  await openUpload()
  bulkText = await upload(sheet('august.csv', CSV_ROWS))
  check(
    '🔑 re-uploading the same file surfaces the *already posted* banner…',
    // WARNING 274: it arrives as a file-level WARNING (rowNumber 0) carrying the
    // server's own sentence, not the structured `replay` object 273 modelled - so the
    // screen renders it as data, and `bulk.ts` lifts row 0 out of the per-row map
    // because a grid keyed by row would have nowhere to put it.
    (await page.locator('[data-testid="bulk-file-notice"]').count()) === 1 &&
      bulkText.includes('was posted on') &&
      bulkText.includes('ضحى'),
    (await page.locator('[data-testid="bulk-file-notice"]').innerText().catch(() => '')).slice(0, 90),
  )
  check(
    '🔑 …and STILL ALLOWS the post — a hash warns, it never refuses',
    !(await commitBlocked()),
  )

  // ---- the sheet edited between review and commit ----
  await page.locator('[data-testid="bulk-back"]').click()
  await page.waitForTimeout(80)
  await upload(sheet('august-edited.csv', CSV_ROWS))
  await page.locator('[data-testid="bulk-commit"]').click()
  await appears('[data-testid="bulk-refusal"]')
  check(
    '🔑 editing the sheet between preview and commit is REFUSED on the hash',
    (await page.locator('[data-region="bulk-done"]').count()) === 0 &&
      (await page.locator('[data-testid="bulk-refusal"]').innerText()).includes('has changed'),
    await page.locator('[data-testid="bulk-refusal"]').innerText(),
  )
  check(
    '⚠️ …and the refusal offers the way through: preview it again',
    (await page.locator('[data-testid="bulk-again"]').count()) === 1,
  )
  // 🚩 272's ruling, applied to this door: a refused act is not re-offered
  // unchanged, or it becomes a button someone presses in a loop.
  check(
    '🚩 …and the commit button is GONE while the refusal stands',
    (await page.locator('[data-testid="bulk-commit"]').count()) === 0 &&
      (await page.locator('[data-testid="bulk-again-footer"]').count()) === 1,
  )
  check(
    '🚩 273’s keys are all registered — no raw t() key on the upload door',
    !/settlement:|\bbulk\./.test(await uploadText()),
  )

  // ---- cancel as a unit ----
  //
  // KEY **274 replaced a client-side loop with the door built for this.** 273 fetched
  // the batch's rows from the cross-estate ledger, decided per row which were still
  // cancellable, and called `Settlement/Cancel` once each. `Settlement/Bulk/Cancel`
  // does that loop server-side and reports every row's own outcome — so the drive now
  // asserts ONE call and a report, not N calls and a browser-assembled summary.
  //
  // WARNING The pre-flight listing went with it: nothing enumerates a batch's entries
  // (B1), so the act is NAMED rather than previewed. The reason field is what makes
  // it deliberate.
  //
  // 🚩 The batch is still an ADDRESS, so *"finance sent the wrong file"* is one repair
  // an hour and a reload after the commit — this navigation is the proof.
  await page.goto(`${BASE}${ROUTE}?view=batch&batch=${BATCH}`)
  await appears('[data-region="batch-withdraw"]')
  await page.waitForTimeout(120)
  let batchText = await page.locator('[data-region="batch-withdraw"]').innerText()
  check(
    '273 → a batch is reachable by ADDRESS alone, an hour and a reload later',
    batchText.includes('Withdraw an uploaded batch') && batchText.includes(BATCH),
    batchText.replace(/\n/g, ' ').slice(0, 90),
  )
  check(
    '⚠️ …and the act says what a till has already taken is NOT withdrawn by it',
    batchText.includes('never retro-voided') || batchText.includes('already spent'),
    batchText.replace(/\n/g, ' ').slice(0, 120),
  )
  bulkCancelCalls = []
  cancelCalls = []
  await page.locator('[data-testid="batch-reason"]').fill('Finance sent the wrong file for July.')
  await page.locator('[data-testid="batch-commit"]').click()
  await appears('[data-region="batch-outcome"]')
  await page.waitForTimeout(150)
  batchText = await page.locator('[data-region="batch-outcome"]').innerText()
  check(
    '🔑 274 → the batch is withdrawn in ONE call to the bulk door, not N per-entry ones',
    bulkCancelCalls.length === 1 &&
      bulkCancelCalls[0].batchId === BATCH &&
      bulkCancelCalls[0].reason === 'Finance sent the wrong file for July.' &&
      cancelCalls.length === 0,
    `${bulkCancelCalls.length} bulk · ${cancelCalls.length} per-entry`,
  )
  check(
    '🔑 …and the rows a till got to FIRST are named, with the remaining they came back with',
    (await page.locator('[data-testid="batch-refused"] li').count()) === 2 &&
      batchText.includes('A till consumed part of this entry.'),
    batchText.replace(/\n/g, ' ').slice(0, 140),
  )
  check(
    '🚩 …and a partly-withdrawn batch is not an ERROR — the withdrawn are reported too',
    (await page.locator('[data-testid="batch-withdrawn"] li').count()) === 3 &&
      !(await page.locator('body').innerText()).includes('could not be sent'),
    batchText.replace(/\n/g, ' ').slice(0, 90),
  )
  check(
    '🚩 273’s keys are all registered — no raw t() key on the withdrawal',
    !/settlement:|\bbatch\./.test(batchText),
  )

  // ---- the cross-estate ledger (BackOffice 1199 §3) ----
  //
  // KEY **The question the spec's own design invited and nothing could answer.** 1173
  // mints `entryNumber` and calls it the handle finance and the branch settle by on the
  // phone; `Settlement/Account` takes the storeId the caller is ringing up to ASK for.
  // Ticket 270 built this view against a door that did not exist and 274 deleted it
  // rather than fake it (B1) - so every check below is on a path that has never once
  // been exercised against a server-shaped answer.
  // WARNING It waits for the view to SETTLE - a row, the prompt or the empty sentence -
  // rather than for a duration. The grid mounts before its rows land, so a bare timeout
  // made the first read of a column race the render: it passed, then failed, then
  // passed, which is a check nobody can trust.
  const openLedger = async (search) => {
    scenario = { accessBody: ALL, access403: false, access500: false }
    await page.goto(`${BASE}${ROUTE}?view=ledger${search}`)
    await page.waitForLoadState('networkidle')
    await page
      .locator(
        '[data-region="settlement-ledger"] .ag-row, [data-testid="ledger-prompt"], [data-testid="ledger-empty"]',
      )
      .first()
      .waitFor({ timeout: 8000 })
    return page.locator('[data-region="settlement-ledger"]').innerText()
  }
  const ledgerRows = () => page.locator('[data-region="settlement-ledger"] .ag-row').count()

  // The way IN, from the door — a button beside the search box, because the two answer
  // different questions: that box finds a BRANCH, this finds an ENTRY.
  await openDoor()
  ledgerCalls = []
  await page.locator('[data-testid="ledger-open"]').click()
  await page.waitForLoadState('networkidle')
  // WARNING Wait for a ROW, not for a duration. The grid mounts before its rows land, so
  // a bare timeout made the first read of the branch column race the render — it passed,
  // then failed, then passed, which is a check nobody can trust.
  await appears('[data-region="settlement-ledger"] .ag-row')
  let ledgerText = await page.locator('[data-region="settlement-ledger"]').innerText()
  check(
    '🔑 1199 → the door opens the ledger on EVERYTHING STILL OPEN, which is the question asked',
    new URL(page.url()).searchParams.get('view') === 'ledger' &&
      new URL(page.url()).searchParams.get('status') === 'OPEN' &&
      ledgerCalls.length === 1 &&
      ledgerCalls[0].status === 'OPEN',
    `${page.url().split('?')[1] ?? ''} · ${JSON.stringify(ledgerCalls[0] ?? {})}`,
  )
  const ledgerCol = (colId) =>
    page.locator(`[data-region="settlement-ledger"] .ag-row [col-id="${colId}"]`).allInnerTexts()
  let branchCodes = await ledgerCol('storeId')
  check(
    '🔑 …and it answers with OPEN entries from MORE THAN ONE branch — which is the whole point',
    (await ledgerRows()) > 1 && new Set(branchCodes).size > 1,
    `${await ledgerRows()} rows · ${JSON.stringify(branchCodes)}`,
  )
  // WARNING Read off the STATUS CELLS, not the region's text: the chip bar names all four
  // statuses by design, so a text scan would find the word "Cancelled" on a screen that
  // is correctly showing none.
  check(
    '⚠️ …and NOTHING here is closed — a status chip that let a CANCELLED row through would lie about what is owed',
    (await ledgerCol('status')).every((s) => s.includes('Open')),
    JSON.stringify(await ledgerCol('status')),
  )

  // 🔑 THE HEADLINE: a bare number, and the branch comes back NAMED.
  ledgerCalls = []
  ledgerText = await openLedger('&entry=143')
  check(
    '🔑 1199 → an entry number alone resolves to ONE row, and it names the branch',
    (await ledgerRows()) === 1 &&
      ledgerText.includes('0142') &&
      ledgerText.includes('Al-Rawdah'),
    ledgerText.replace(/\n/g, ' ').slice(0, 140),
  )
  check(
    '…and the criterion went ON THE WIRE as an entryNumber, not as a client-side filter',
    ledgerCalls.length === 1 && ledgerCalls[0].entryNumber === '143',
    JSON.stringify(ledgerCalls[0] ?? {}),
  )
  // 🚩 And it is a way THROUGH: the ledger says which branch, the account is where an
  // entry is acted on — with its journal in front of you, which is the correction this
  // screen must not make easy from a list.
  await page.locator('[data-region="settlement-ledger"] .ag-row').first().click()
  await page.waitForLoadState('networkidle')
  await appears('[data-region="entry-journal"]')
  check(
    '🔑 …and clicking the row lands on THAT branch’s account, opened on THAT entry',
    new URL(page.url()).searchParams.get('store') === '0142' &&
      new URL(page.url()).searchParams.get('entry') === '143' &&
      (await page.locator('[data-region="entry-journal"]').count()) === 1,
    page.url().split('?')[1] ?? '',
  )

  // WARNING **THE EMPTY QUESTION IS NEVER ASKED.** The door refuses it with a 400, and a
  // screen that issued it anyway would show an error banner for arriving on a blank
  // lookup. This is the check that keeps `hasCriterion` honest.
  ledgerCalls = []
  ledgerText = await openLedger('')
  check(
    '🚩 1199 → an unfiltered ledger issues NO REQUEST and prompts instead of erroring',
    ledgerCalls.length === 0 &&
      (await page.locator('[data-testid="ledger-prompt"]').count()) === 1 &&
      !ledgerText.includes('could not'),
    ledgerText.replace(/\n/g, ' ').slice(0, 120),
  )

  // WARNING The two views share the `?store=` key on purpose — `view=` is the only thing
  // that may decide which screen draws. A body that checked the branch first would
  // silently open the ACCOUNT here, answering a different question with nothing on
  // screen to say so.
  ledgerText = await openLedger('&store=0688')
  check(
    '🔑 1199 → `view=ledger&store=…` draws the LEDGER, not that branch’s account',
    (await page.locator('[data-region="settlement-ledger"]').count()) === 1 &&
      (await page.locator('[data-region="entry-journal"]').count()) === 0,
  )
  check(
    '…and the branch criterion is shown as a removable pill, so a reader can see what narrowed it',
    (await page.locator('[data-testid="ledger-branch-pill"]').count()) === 1,
  )
  // 🔑 D10, on the one view where the currency genuinely varies row by row. 0688 is
  // Bahraini: `95.250` is three real digits of money, and drawing it at two loses a
  // fils silently.
  check(
    '🔑 1199 → a BHD branch’s figures keep their third decimal on the ledger',
    /\d\.\d{3}\b/.test(ledgerText),
    ledgerText.replace(/\n/g, ' ').slice(0, 140),
  )

  // A pure-SAR answer hides the Currency column (244 §7); an answer holding both shows
  // it, because two figures at different precisions are not comparable without it.
  const currencyCells = async () =>
    page.locator('[data-region="settlement-ledger"] .ag-row [col-id="currencyKey"]').count()
  check(
    '⚠️ …and a single-currency result does NOT draw a Currency column of noise',
    (await currencyCells()) === 0,
  )
  await openLedger('&status=OPEN')
  check(
    '🔑 …while a result that MIXES riyals and dinars draws it, because they are not comparable',
    (await currencyCells()) > 0,
  )
  // 🚩 …and still totals nothing. A Σ over that column adds dinars to riyals.
  check(
    '🚩 …and the ledger states NO total, on a column that spans two currencies',
    !(await page.locator('[data-region="settlement-ledger"]').innerText()).includes('Total'),
  )

  // A chip narrows, and pressing the active one clears it — a filter with no way off is
  // a filter a reader has to reload the page to escape.
  ledgerCalls = []
  await page.locator('[data-region="ledger-kind"] button[data-chip="SURPLUS"]').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(120)
  check(
    '1199 → a kind chip narrows the question, keeping the status already asked',
    new URL(page.url()).searchParams.get('kind') === 'SURPLUS' &&
      new URL(page.url()).searchParams.get('status') === 'OPEN' &&
      ledgerCalls.at(-1)?.entryKind === 'SURPLUS',
    JSON.stringify(ledgerCalls.at(-1) ?? {}),
  )
  await page.locator('[data-region="ledger-kind"] button[data-chip="SURPLUS"]').click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(120)
  check(
    '🚩 …and pressing the ACTIVE chip clears it, rather than trapping the reader in a filter',
    new URL(page.url()).searchParams.get('kind') === null,
    page.url().split('?')[1] ?? '',
  )

  // An entry number that matches nothing is a real answer to a real question — usually a
  // mistyped digit — and must not read as a failure.
  ledgerText = await openLedger('&entry=999999')
  check(
    '⚠️ 1199 → an entry number that matches nothing says so, and is not worded as an error',
    (await page.locator('[data-testid="ledger-empty"]').count()) === 1 &&
      !ledgerText.includes('could not'),
    ledgerText.replace(/\n/g, ' ').slice(0, 120),
  )

  // 🚩 A hand-edited address DEGRADES: the unreadable criterion drops, the readable ones
  // stand, and the reader lands on a screen rather than on a banner.
  ledgerCalls = []
  ledgerText = await openLedger('&status=OPENISH&entry=143')
  check(
    '🚩 1199 → an unreadable criterion in a pasted URL is DROPPED, not sent and not thrown on',
    ledgerCalls.length === 1 &&
      ledgerCalls[0].status === undefined &&
      ledgerCalls[0].entryNumber === '143' &&
      (await ledgerRows()) === 1,
    JSON.stringify(ledgerCalls[0] ?? {}),
  )

  check(
    '🚩 1199’s keys are all registered — no raw t() key on the ledger',
    !/settlement:|\bledger\./.test(await page.locator('[data-region="settlement-ledger"]').innerText()),
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
