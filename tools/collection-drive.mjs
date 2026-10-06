// Collections drive (ticket 253) — drives the REAL app in Chromium against a MOCKED
// CollectionWeb/Access envelope, because SIS.Api's CollectionWeb door doesn't exist yet
// (BackOffice 1090; ticket 259 is the wave-joining event). This is the wave's screens
// drive — later slices (254–258) EXTEND this file rather than starting a third.
//
// Verifies ticket 253's flow Proof bullet:
//   1. all four granted → the Collections group renders four items and all four routes
//      load their Pages;
//   2. one granted → a RAGGED group with exactly that item, and the ungranted routes
//      render the denied backstop rather than a broken screen;
//   3. none granted → NO group at all, and a hand-typed /collection/collections renders
//      the denied backstop;
//   4. the probe FAILING (a bare 403, which is exactly what the unbuilt door answers
//      today) → same as none-granted, hidden rather than crashing — and a 403 reads as
//      a REFUSAL (see an administrator), while a 500 reads as UNREACHABLE (try again).
//      Both deny; only the sentence differs.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/collection-drive.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const ROUTES = {
  collections: '/collection/collections',
  acrs: '/collection/acrs',
  deposits: '/collection/deposits',
  attempts: '/collection/attempts',
}
// The h1 each Page renders once its own guard admits the session.
const TITLES = {
  collections: 'Cash Collections',
  acrs: 'ACRs',
  deposits: 'Deposits',
  attempts: 'Collection Attempts',
}
const DENIED = 'No access to this screen'

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
}
const ALL = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
}

// ---- ticket 336: reading an exported workbook back ----
/** The entries of a zip, name → text (stored or deflated). Enough of a reader for the
 *  writer's own output — copied from `central-invoice-list-drive.mjs`, as each drive
 *  carries its own readers rather than sharing a harness. */
function unzipText(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  const entries = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const out = {}
  for (let i = 0; i < entries; i++) {
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataAt, dataAt + size)
    out[name] = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8')
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** XML text back to what Excel shows. */
const unXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Sheet 1 as rows of cells, each `{ text, numeric }` and placed by its own `r="C7"` reference,
 *  so a cell the writer left out does not shift its neighbours. `numeric` is the cell's TYPE
 *  in the file — the thing Excel totals by — not a guess from its text. */
function sheetCells(files) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unXml(m[1].replace(/<[^>]+>/g, '')),
  )
  const xml = files['xl/worksheets/sheet1.xml'] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const row = []
    for (const [, attrs, body] of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const letters = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? 'A'
      const index = [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n'
      const v = /<v>([\s\S]*?)<\/v>/.exec(body ?? '')?.[1]
      const text =
        type === 's' ? (shared[Number(v)] ?? '') : v !== undefined ? unXml(v) : unXml((body ?? '').replace(/<[^>]+>/g, ''))
      row[index] = { text, numeric: type === 'n' && v !== undefined }
    }
    return row
  })
}

// ---- ticket 254: the Cash Collections rows ----
// A stubbed CollectionWeb/Collections envelope, for the same reason Access is
// stubbed: the door is BackOffice 1090's and ticket 259 is the wave-joining event.
const pad = (n) => String(n).padStart(2, '0')
const todayIso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** `count` rows, all SAR unless told otherwise.
 *
 *  Variance carries the three meanings the screen must tell apart, pinned to the
 *  first three rows because 254's assertions locate them by row index: row 0 NULL
 *  (the "blank, not 0.00" proof), row 1 negative, row 2 a real zero.
 *
 *  🚩 Every row FROM 3 ON carries a real signed figure, and that is load-bearing
 *  rather than decorative: the export drive filters to store 1003 (`i % 7 === 2`,
 *  so rows 9, 16, 23 …), and while the whole tail was `0` every Variance cell in
 *  the exported file was blank or zero — which let 258's money sweep pass over a
 *  `Variance` mis-declared as `identity`, since the sweep skips empty cells and
 *  identity writes a bare 0 as blank. A signed column with substance is what
 *  gives that assertion teeth. */
/** BackOffice 1990's pair for a stub store — the seventh store (1007) has no profit center
 *  recorded, and its storeText is the code alone (ticket 314). */
function storePair(code) {
  return code === 1007
    ? { profitCenter: '', storeText: String(code) }
    : { profitCenter: `PH-${code}`, storeText: `PH-${code} (${code})` }
}

/** Copied from BackOffice 2151's sample response — never retyped. */
const SURPLUS_DESCRIPTION = 'مرتجع شبكة 5512'
const SHORTAGE_DESCRIPTION = 'عجز سابق'
/** Copied from BackOffice 2152's sample response — never retyped. */
const THEFT_DESCRIPTION = 'سرقة من الخزنة - بلاغ 5521'

/** Finance's figures and the already-sent fields for mock row `i` (ticket 335, BackOffice
 *  2151's `## Web contract`). Row 2 is the settlement receipt (`Short`); every ODD row carries
 *  a surplus deduction, so the Surplus column has negatives AND zeros on any filtered slice;
 *  the rest are regular days. `amount + surplus = netCollected` on every row. */
function financeFields(i) {
  const netCollected = 11975 + i
  const settlementReceipt = i === 2
  const deducted = !settlementReceipt && i % 2 === 1 ? 100 + i : 0
  return {
    collectionType: settlementReceipt ? 'Short' : deducted ? 'Regular+Surplus' : 'Regular',
    hasSurplus: deducted > 0,
    hasTheft: false,
    theftAmount: 0,
    amount: netCollected + deducted,
    surplus: deducted ? -deducted : 0,
    description: settlementReceipt ? SHORTAGE_DESCRIPTION : deducted ? SURPLUS_DESCRIPTION : '',
    cashSales: settlementReceipt ? 0 : netCollected + deducted,
    settlement: settlementReceipt ? netCollected : deducted ? -deducted : 0,
    settlementAdjustmentTotal: deducted,
    settlementEntryNumber: settlementReceipt || deducted ? 1400 + i : 0,
    settlementDescription: settlementReceipt ? SHORTAGE_DESCRIPTION : deducted ? SURPLUS_DESCRIPTION : '',
    shiftSettlementAdjustment: deducted,
    shiftSettlementEntryNumber: deducted ? 1400 + i : 0,
    shiftCardTotal: 8310.25 + i,
    receiptKind: settlementReceipt ? 'SETTLEMENT' : 'SHIFT',
    isSettlement: settlementReceipt,
    collectionStatus: 'COLLECTED',
    isOffSystem: false,
    offSystemAt: null,
    offSystemBy: '',
    offSystemReasonCode: '',
    offSystemReasonText: '',
    zNumber: settlementReceipt ? 0 : 412 + i,
    amendmentCount: 0,
    lastAmendedBy: '',
  }
}

function makeRows(count, { currency = 'SAR' } = {}) {
  return Array.from({ length: count }, (_, i) => ({
    ...financeFields(i),
    collectionReceiptId: `01J0COLLECT${String(i).padStart(16, '0')}`,
    collectionReceiptNo: 91000 + i,
    storeId: String(1001 + (i % 7)),
    storeName: `Al Dawaa Store ${1001 + (i % 7)}`,
    ...storePair(1001 + (i % 7)),
    collectorOperatorId: String(4470 + (i % 3)),
    collectorName: `Collector ${4470 + (i % 3)}`,
    closerOperatorId: String(7780 + (i % 5)),
    closerName: `Pharmacist ${7780 + (i % 5)}`,
    openedAt: `${todayIso()}T07:00:00`,
    closedAt: `${todayIso()}T15:04:00`,
    collectedAt: `${todayIso()}T15:40:00`,
    // Ticket 315: the sales day. Row 2 is a settlement receipt's `null` (blank on screen).
    businessDay: i === 2 ? null : `${todayIso()}T00:00:00`,
    salesDate: i === 2 ? '0001-01-01T00:00:00' : `${todayIso()}T00:00:00`,
    systemCash: 12480.5 + i,
    countedCash: 12475 + i,
    variance: i === 0 ? null : i === 1 ? -5.5 : i === 2 ? 0 : i % 2 === 0 ? 4.25 : -3.75,
    varianceReasonCode: i === 1 ? 'SHORT' : '',
    varianceReasonText: i === 1 ? 'Counted short at close' : '',
    openingFloat: 500,
    countedCashNet: 11975 + i,
    retainedFloat: 500,
    netCollected: 11975 + i,
    cardTotal: 8310.25 + i,
    cardTransactionCount: 96,
    zReportIds: `Z-${88121 + i}`,
    currencyKey: currency,
  }))
}

// ---- ticket 255: the ACR and Collection Attempt rows ----
// Stubbed for the same reason: CollectionWeb/Acrs and CollectionWeb/Attempts are
// BackOffice 1090's doors and ticket 259 is the wave-joining event.

/** `count` ACR rows. Row 0 is a still-OPEN ACR — `closedAt` at the .NET sentinel,
 *  `depositNumber` 0 — which is the "blank, not 0001-01-01 / not 0" proof. Row 1
 *  carries a NULL card total (blank, not 0.00) and row 2 a real zero. */
function makeAcrRows(count) {
  return Array.from({ length: count }, (_, i) => {
    const open = i === 0
    return {
      acrId: `01J0ACR${String(i).padStart(20, '0')}`,
      acrNumber: 40 + i,
      label: `Riyadh run ${40 + i}`,
      collectorOperatorId: String(4470 + (i % 3)),
      collectorName: `Collector ${4470 + (i % 3)}`,
      acrDate: `${todayIso()}T00:00:00`,
      status: open ? 'OPEN' : 'CLOSED',
      createdAt: `${todayIso()}T08:15:00`,
      closedAt: open ? '0001-01-01T00:00:00' : `${todayIso()}T19:32:00`,
      linkedCollectionCount: i === 2 ? 0 : 12,
      // Ticket 341: the row's three figures — banked = cash sales + settlement. Row 3
      // kept a surplus back (a NEGATIVE settlement); the rest handed a shortage over.
      cashSalesTotal: (i === 3 ? 144110.75 : 143610.75) + i,
      settlementTotal: i === 3 ? -200 : 300,
      bankedTotal: 143910.75 + i,
      cardTotalSum: i === 1 ? null : i === 2 ? 0 : 99120.5 + i,
      cardTransactionCountSum: 812,
      depositId: open ? '' : `01J0DEPOSIT${String(i).padStart(15, '0')}`,
      depositNumber: open ? 0 : 5500 + i,
      depositStatus: open ? '' : 'POSTED',
    }
  })
}

/** `count` collection-attempt rows. Nothing here is money — an attempt collected
 *  nothing, which is what makes it an attempt. */
function makeAttemptRows(count) {
  return Array.from({ length: count }, (_, i) => ({
    attemptId: `01J0ATTEMPT${String(i).padStart(16, '0')}`,
    collectorStaffId: String(4470 + (i % 3)),
    collectorName: `Collector ${4470 + (i % 3)}`,
    storeCode: String(1001 + (i % 7)),
    storeName: `Al Dawaa Store ${1001 + (i % 7)}`,
    ...storePair(1001 + (i % 7)),
    shiftId: `01J0SHIFT${String(i).padStart(18, '0')}`,
    businessDay: `${todayIso()}T00:00:00`,
    attemptTime: `${todayIso()}T09:12:00`,
    reasonCode: i % 2 ? 'STORE_CLOSED' : 'NO_CASH',
    reasonText: i % 2 ? 'Branch shut for maintenance' : '',
  }))
}

// ---- ticket 256: the Deposits payload ----
// ⚠️ Stubbed for the same reason, but this is the HARDEST door of the four:
// Deposit/Inquiry rides CollectorEndpointFilter, which demands an api-key PLUS a
// Mobile-channel Bearer session and has no cookie branch at all — so it needs a
// genuinely new door (BackOffice 1090), not an .AllowCookieSession() marker.
//
// 🚩 The one response that is NOT a bare list: `{ rows, balances }`, each row
// carrying its own `lines` and `attachments`. That shape is what makes the
// stacked detail region and the balances panel cost no fetch, and the drive
// asserts exactly that by counting requests across a selection change.

/** `count` deposit rows. Odd-indexed rows carry a DRIFTED claimed ACR — the
 *  screen's whole reason to exist — and every row carries two slips. Row 0 is
 *  deliberately CLEAN so that selecting row 1 is what makes a flag appear. */
function makeDepositRows(count) {
  return Array.from({ length: count }, (_, i) => {
    const drifted = i % 2 === 1
    const banked = 143910.75 + i
    return {
      depositId: `01J0DEPOSIT${String(i).padStart(15, '0')}`,
      depositNumber: 5500 + i,
      collectorOperatorId: String(4470 + (i % 3)),
      collectorName: `Collector ${4470 + (i % 3)}`,
      bankCode: i % 2 ? 'ANB' : 'RJHI',
      bankName: i % 2 ? 'Arab National Bank' : 'Al Rajhi Bank',
      status: i % 7 === 6 ? 'VOID' : 'POSTED',
      depositedAt: `${todayIso()}T11:20:00`,
      createdAt: `${todayIso()}T11:22:00`,
      calculatedAmount: banked,
      realAmount: banked,
      diffAmount: 0,
      reasonCode: '',
      noteText: '',
      voidedBy: i % 7 === 6 ? 'msartawi' : '',
      // The .NET sentinel on a deposit that was never voided — blank, not year 1.
      voidedAt: i % 7 === 6 ? `${todayIso()}T18:00:00` : '0001-01-01T00:00:00',
      voidReason: i % 7 === 6 ? 'Banked twice' : '',
      lines: [
        {
          acrId: `01J0ACR${String(i * 2).padStart(20, '0')}`,
          acrNumber: 40 + i * 2,
          netCollectedAtDeposit: banked,
          netCollectedNow: banked,
          // ⚠️ drift/hasDrift are get-only C# properties: they are ON THE WIRE,
          // computed in decimal. The client reads them and never subtracts.
          drift: 0,
          hasDrift: false,
        },
        {
          acrId: `01J0ACR${String(i * 2 + 1).padStart(20, '0')}`,
          acrNumber: 41 + i * 2,
          netCollectedAtDeposit: 1234.1,
          netCollectedNow: drifted ? 1634.1 : 1234.1,
          drift: drifted ? 400 : 0,
          hasDrift: drifted,
        },
      ],
      attachments: [
        {
          attachmentId: `01J0SLIP${String(i).padStart(18, '0')}`,
          url: `https://slips.example.test/deposit-${5500 + i}-a.jpg`,
          fileName: `slip-${5500 + i}-a.jpg`,
          createdAt: `${todayIso()}T11:23:00`,
        },
        {
          attachmentId: `01J0SLIPB${String(i).padStart(17, '0')}`,
          url: `https://slips.example.test/deposit-${5500 + i}-b.jpg`,
          fileName: `slip-${5500 + i}-b.jpg`,
          createdAt: `${todayIso()}T11:24:00`,
        },
      ],
    }
  })
}

/** The per-collector balance summary that rides in the SAME response. */
function makeBalances() {
  return [4470, 4471, 4472].map((id, i) => ({
    collectorOperatorId: String(id),
    collectorName: `Collector ${id}`,
    depositCount: 4 + i,
    totalCalculated: 143910.75 + i,
    totalReal: 143510.75 + i,
    // Positive: still owes the bank a trip. Row 2 is negative — last trip's
    // shortfall has since landed — and the sign stays the row's own.
    outstanding: i === 2 ? -412.5 : 400,
  }))
}

// scenario state, mutated between reloads
let scenario = { accessBody: ALL, access403: false }
let accessCalls = 0
let collectionsRows = makeRows(347)
let acrRows = makeAcrRows(213)
let attemptRows = makeAttemptRows(174)
let lastAcrsQuery = ''
let acrsCalls = 0
let lastAttemptsQuery = ''
let attemptsCalls = 0
let depositRows = makeDepositRows(163)
let depositBalances = makeBalances()
let lastDepositsQuery = ''
let depositsCalls = 0
/** The query string of the LAST CollectionWeb/Collections request — this is how
 *  the drive proves that Search/Reset promoted the draft, and that a keystroke
 *  did not. */
let lastCollectionsQuery = ''
let collectionsCalls = 0

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  // The nav these checks read is the labelled tree; since 385 the rail boots collapsed, so the
  // stored preference opens it (the toggle's own key, as a user who pinned it open).
  await page.addInitScript(() => localStorage.setItem('oms.railExpanded', 'true'))
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // Populated once the app is up — see below; the handler closes over the binding, not the value.
  let DOCS = { receipts: {}, acrs: {} }

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'CollectionWeb/Access') {
      accessCalls++
      // The bare 403 the default-deny inversion (issue 802) hands a browser while
      // the door is unmarked — the realistic pre-1090 answer, not a hypothetical.
      if (scenario.access403)
        return route.fulfill(
          envelope(null, { status: 403, success: false, message: 'Forbidden' }),
        )
      if (scenario.access500)
        return route.fulfill(
          envelope(null, { status: 500, success: false, message: 'Server error' }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    // The two DOCUMENT doors (ticket 259). This is the screens drive, so it does not assert
    // anything about how a document looks — collection-print-drive.mjs owns that. What it does
    // assert is that a row action's href RESOLVES to a rendering document rather than to the miss
    // backstop, and since 259 that costs a real call. Served from the app's own fixture modules,
    // loaded through the dev server (`loadDocumentFixtures`), so there is no second transcription.
    const receiptId = path.startsWith('CollectionWeb/Receipt/')
      ? decodeURIComponent(path.slice('CollectionWeb/Receipt/'.length))
      : null
    const acrFormId = path.startsWith('CollectionWeb/AcrForm/')
      ? decodeURIComponent(path.slice('CollectionWeb/AcrForm/'.length))
      : null
    if (receiptId !== null || acrFormId !== null) {
      const doc = receiptId !== null ? DOCS.receipts[receiptId] : DOCS.acrs[acrFormId]
      if (doc) return route.fulfill(envelope(doc))
      const code = receiptId !== null ? 'CollectionReceiptNotFound' : 'AcrNotFound'
      return route.fulfill(
        envelope(null, {
          status: 404,
          success: false,
          message: 'No such document.',
          errors: [{ errorCode: code, internalErrorCode: '', errorMessage: 'No such document.' }],
        }),
      )
    }
    if (path === 'CollectionWeb/Collections') {
      collectionsCalls++
      lastCollectionsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope(collectionsRows))
    }
    if (path === 'CollectionWeb/Acrs') {
      acrsCalls++
      lastAcrsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope(acrRows))
    }
    if (path === 'CollectionWeb/Deposits') {
      depositsCalls++
      lastDepositsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope({ rows: depositRows, balances: depositBalances }))
    }
    if (path === 'CollectionWeb/Attempts') {
      attemptsCalls++
      lastAttemptsQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      return route.fulfill(envelope(attemptRows))
    }
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  // The four receipts and four ACRs, read out of the app's OWN fixture modules rather than copied
  // in here: they are TypeScript, this drive is plain node, and vite is already serving `/src/**.ts`
  // as a transformed ES module. One transcription, and it is the one the tests pin.
  scenario = { accessBody: ALL, access403: false }
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  DOCS = await page.evaluate(async () => {
    const [v, a] = await Promise.all([
      import('/src/features/collection/inquiry/voucher-fixture.ts'),
      import('/src/features/collection/inquiry/acr-fixture.ts'),
    ])
    const byKey = (scenarios) => Object.fromEntries(scenarios.map((s) => [s.key, s.document]))
    return { receipts: byKey(v.VOUCHER_SCENARIOS), acrs: byKey(a.ACR_SCENARIOS) }
  })

  const railLinks = async () =>
    (await page.getByRole('link', { name: /Cash Collections|^ACRs$|^Deposits$|Collection Attempts/ }).all())
      .length
  const groupCount = async () => page.getByRole('button', { name: /^Collections$/ }).count()
  const mainText = async () => page.locator('main').innerText()

  // ---- Scenario 1: all four granted ----
  scenario = { accessBody: ALL, access403: false }
  for (const [key, route] of Object.entries(ROUTES)) {
    await page.goto(BASE + route)
    await page.waitForLoadState('networkidle')
    const text = await mainText()
    check(
      `all granted → ${route} loads its Page (${TITLES[key]})`,
      text.includes(TITLES[key]) && !text.includes(DENIED),
      text.replace(/\n/g, ' ').slice(0, 80),
    )
  }
  check('all granted → the Collections group renders', (await groupCount()) === 1)
  check('all granted → four items under it', (await railLinks()) === 4, `${await railLinks()} links`)

  // ONE probe for the whole area: four leaves + the screen's own guard share the
  // key, so react-query dedupes them into a single request per page life.
  accessCalls = 0
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check(
    'the four leaves + the screen guard cost ONE CollectionWeb/Access call',
    accessCalls === 1,
    `${accessCalls} calls`,
  )

  // ---- Scenario 2: one granted → a ragged group ----
  scenario = { accessBody: { ...NONE, canOpenDeposits: true }, access403: false }
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  check('Deposits only → the group is still there', (await groupCount()) === 1)
  check('Deposits only → exactly ONE item under it (a ragged group)', (await railLinks()) === 1)
  check(
    'Deposits only → and it is the Deposits one',
    (await page.getByRole('link', { name: /^Deposits$/ }).count()) === 1,
  )
  check('Deposits only → the Deposits Page opens', (await mainText()).includes(TITLES.deposits))

  // The ungranted sibling, hand-typed: the backstop, not a broken screen.
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  const raggedDenied = await mainText()
  check(
    'Deposits only → a hand-typed /collection/collections renders the denied backstop',
    raggedDenied.includes(DENIED) && !raggedDenied.includes(TITLES.collections),
    raggedDenied.replace(/\n/g, ' ').slice(0, 80),
  )

  // ---- Scenario 3: none granted ----
  scenario = { accessBody: NONE, access403: false }
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check('none granted → NO Collections group at all', (await groupCount()) === 0)
  check('none granted → no Collections leaves either', (await railLinks()) === 0)
  const noneText = await mainText()
  check(
    'none granted → a hand-typed URL renders the denied backstop',
    noneText.includes(DENIED),
    noneText.replace(/\n/g, ' ').slice(0, 80),
  )
  check('none granted → and NOT a blank screen', noneText.trim().length > 0)

  // ---- Scenario 4: the probe FAILS (the bare 403 the unbuilt door answers today) ----
  scenario = { accessBody: null, access403: true }
  for (const route of [ROUTES.acrs, ROUTES.attempts]) {
    await page.goto(BASE + route)
    await page.waitForLoadState('networkidle')
    check(`probe 403 → ${route} hides the group (fails closed)`, (await groupCount()) === 0)
    const text = await mainText()
    check(
      `probe 403 → ${route} renders the denied backstop, not a crash`,
      text.includes(DENIED),
      text.replace(/\n/g, ' ').slice(0, 80),
    )
  }

  // ---- Scenario 5: the probe is UNREACHABLE (500) → deny, but the other sentence ----
  scenario = { accessBody: null, access403: false, access500: true }
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  check('probe 500 → the group is hidden too (fails closed)', (await groupCount()) === 0)
  const unreachable = await mainText()
  check(
    'probe 500 → the UNREACHABLE sentence (a retry), not the administrator one',
    unreachable.includes('unavailable') && !unreachable.includes(DENIED),
    unreachable.replace(/\n/g, ' ').slice(0, 90),
  )

  // ================= ticket 254 — Cash Collections (opens BLANK since 423) =================
  scenario = { accessBody: ALL, access403: false, access500: false }
  const TODAY = todayIso()
  const LANDING_TITLE = 'Press Search to see collections'

  // Spec 2423 (ticket 423): the screen opens blank and issues NO request until Search.
  // Every later visit below goes through this: open the screen, then press Search.
  const openCollections = async (path = ROUTES.collections) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Search' }).click()
    await page.waitForLoadState('networkidle')
  }

  // ---- it lands BLANK: no query until Search (ticket 423) ----
  collectionsRows = makeRows(347)
  collectionsCalls = 0
  lastCollectionsQuery = ''
  await page.goto(BASE + ROUTES.collections)
  await page.waitForLoadState('networkidle')
  await page.getByText(LANDING_TITLE).first().waitFor({ timeout: 5000 }).catch(() => {})

  const q = () => new URLSearchParams(lastCollectionsQuery)
  check('423 — the screen issues NO query on landing', collectionsCalls === 0, `${collectionsCalls} calls`)
  check(
    '423 — …and the empty grid says to press Search',
    (await mainText()).includes(LANDING_TITLE) && (await page.locator('.ag-root').count()) === 0,
  )
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  check('423 — Search with every box empty issues ONE query', collectionsCalls === 1, `${collectionsCalls} calls`)
  check(
    '423 — …with no date on it — the today default is gone',
    !q().has('CollectionDateFrom') && !q().has('CollectionDateTo') && !q().has('BusinessDateFrom'),
    lastCollectionsQuery,
  )
  check('254 — the WPF Limit box is gone; 2,000 rides as a system cap', q().get('Limit') === '2000')
  check(
    '254 — an unset store/collector is DROPPED, not sent as an empty string',
    !lastCollectionsQuery.includes('StoreId') && !lastCollectionsQuery.includes('CollectorOperatorId'),
    lastCollectionsQuery,
  )
  check('254 — rows are on screen after the one Search', (await page.locator('.ag-row').count()) > 0)

  // ---- the floating per-column filter row is VISIBLE ON ARRIVAL ----
  check(
    '254 — the floating filter row is visible on arrival (inverting BBY’s default)',
    (await page.locator('.ag-floating-filter').count()) > 0,
    `${await page.locator('.ag-floating-filter').count()} floating filters`,
  )

  // ---- client paging at 50 over the WHOLE result ----
  const summary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('254 — the grid pages at 50 with the whole 347 present', /1 to 50 of 347/.test(summary), summary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const summary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('254 — Next walks the SAME fetched result, with no second request', /51 to 100 of 347/.test(summary2) && collectionsCalls === 1, `${summary2} · ${collectionsCalls} calls`)
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  // ---- the filter row narrows the WHOLE result, not the visible page ----
  const floatingFilter = (colId) =>
    page.locator(`.ag-header-row .ag-floating-filter[col-id="${colId}"] input`)
  // AG Grid debounces a floating filter's keystrokes (500ms) before applying it.
  const filterBy = async (colId, text) => {
    // Since 423 the dates sit at the far end of Saud's thirteen, past the viewport, and AG
    // Grid virtualizes a header away until it is scrolled to: walk right until it is drawn.
    for (let left = 0; left <= 4000 && (await floatingFilter(colId).count()) === 0; left += 400) {
      await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((el, x) => {
        el.scrollLeft = x
      }, left)
      await page.waitForTimeout(150)
    }
    await floatingFilter(colId).fill(text)
    await page.waitForTimeout(900)
    const summary = await page.locator('.ag-paging-row-summary-panel').innerText()
    return { summary, total: Number(/of (\d+)/.exec(summary)?.[1] ?? -1) }
  }
  const byStore = await filterBy('storeId', '1003')
  check(
    '254 — a per-column filter narrows all 347, not the 50 on screen',
    byStore.total > 0 && byStore.total < 347,
    byStore.summary,
  )
  await filterBy('storeId', '')

  // …and a date column filters on what the CELL shows, not on the raw ISO value.
  const byShownDate = await filterBy('collectedAt', `${TODAY} 15:40`)
  check('254 — typing the date the CELL shows matches', byShownDate.total === 347, byShownDate.summary)
  const byRawIso = await filterBy('collectedAt', `${TODAY}T15:40`)
  check(
    '254 — …and the raw ISO value, which is NOT on screen, matches nothing',
    byRawIso.total === 0,
    byRawIso.summary,
  )
  await filterBy('collectedAt', '')

  // ---- money: currency in the HEADER, right-aligned, blank ≠ 0.00 ----
  const headerText = async () => (await page.locator('.ag-header-row').first().innerText()).replace(/\n/g, ' | ')
  const headers = await headerText()
  check('254 — the currency is stated ONCE, in the money header', headers.includes('Net Collected (SAR)'), headers.slice(0, 160))
  const netCell = page.locator('.ag-row[row-index="0"] [col-id="netCollected"]')
  check('254 — money is grouped to the currency’s decimals', (await netCell.innerText()).trim() === '11,975.00', await netCell.innerText())
  check('254 — and right-aligned', (await netCell.getAttribute('class')).includes('text-end'))
  // (Variance, the column with a MISSING figure, is behind More columns since ticket 335:
  // its blank-is-not-zero proof is below, with the tail open.)

  // ---- the More-columns toggle reveals the forensic tail ----
  check('254 — the forensic tail is folded away on arrival', !headers.includes('Z Reports'))
  await page.getByRole('button', { name: 'More columns' }).click()
  // ⚠️ AG Grid virtualizes headers horizontally, so "is it there" has to be asked
  // by scrolling: read the header cells at both ends and union them.
  const allHeaders = async () => {
    const seen = new Set()
    // Three stops, not two: with the ACR tail open the money sits in the MIDDLE of the
    // grid (ticket 341 widened it), out of view from either end.
    for (const left of [0, 1200, 4000]) {
      await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((el, x) => {
        el.scrollLeft = x
      }, left)
      await page.waitForTimeout(200)
      for (const text of await page.locator('.ag-header-row').first().locator('.ag-header-cell-text').allInnerTexts())
        seen.add(text.trim())
    }
    return [...seen]
  }
  const opened = (await allHeaders()).join(' | ')
  check('254 — More columns reveals the tail (Z Reports, Closer, Currency)', opened.includes('Z Reports') && opened.includes('Closer') && opened.includes('Currency'), opened.slice(0, 260))
  check('254 — and nothing was dropped to make room', opened.includes('Receipt No#') && opened.includes('Net Collected (SAR)'))
  check(
    '335 — the six columns that left the landing grid are all in the tail',
    ['Receipt No#', 'Store Name', 'Collector Name', 'Variance (SAR)', 'Card Total (SAR)', 'Reason'].every((h) => opened.split(' | ').includes(h)),
    opened.slice(0, 400),
  )
  // A tail cell is virtualized until it is scrolled to: walk the grid until it is drawn.
  const tailCell = async (rowIndex, colId) => {
    const cell = page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`)
    for (let left = 0; left <= 6000; left += 500) {
      await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((el, x) => {
        el.scrollLeft = x
      }, left)
      await page.waitForTimeout(150)
      if ((await cell.count()) > 0) return (await cell.innerText()).trim()
    }
    return null
  }
  const missingVariance = await tailCell(0, 'variance')
  check('254 — a MISSING figure renders blank, not 0.00', missingVariance === '', JSON.stringify(missingVariance))
  const zeroVariance = await tailCell(2, 'variance')
  check('254 — …and a real zero still reads 0.00', zeroVariance === '0.00', JSON.stringify(zeroVariance))
  await page.getByRole('button', { name: 'More columns' }).click()

  // ---- the filter-row toggle reclaims the height ----
  await page.getByRole('button', { name: 'Filter row' }).click()
  check('254 — the filter row toggles off to reclaim the height', (await page.locator('.ag-floating-filter').count()) === 0)
  await page.getByRole('button', { name: 'Filter row' }).click()

  // ---- the criteria DRAFT: typing does not query; Search does ----
  const callsBeforeTyping = collectionsCalls
  await page.getByPlaceholder('Store code').fill('1003')
  await page.waitForTimeout(300)
  check('254 — typing a store code fires NO query (a draft is not a search)', collectionsCalls === callsBeforeTyping, `${collectionsCalls} vs ${callsBeforeTyping}`)
  check('254 — …and NO chip either: the grid is still showing the empty Search', (await page.getByText('Filtered').count()) === 0)

  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('254 — Search promotes the draft', collectionsCalls === callsBeforeTyping + 1 && q().get('StoreId') === '1003', lastCollectionsQuery)
  check('254 — …and NOW the chip lights: the grid really is filtered', (await page.getByText('Filtered').count()) > 0)

  // ---- Reset returns the landing state: un-searched (ticket 423) ----
  const callsBeforeReset = collectionsCalls
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '423 — Reset returns to the UN-SEARCHED landing: no query, press Search, the store cleared',
    collectionsCalls === callsBeforeReset &&
      (await mainText()).includes(LANDING_TITLE) &&
      (await page.getByPlaceholder('Store code').inputValue()) === '',
    `${collectionsCalls} vs ${callsBeforeReset}`,
  )
  check('254 — and the Filtered chip goes with it', (await page.getByText('Filtered').count()) === 0)

  // ---- the cap banner: reached, not merely large ----
  const CAP_TEXT = /reached the 2,000-row system cap/
  collectionsRows = makeRows(1999)
  await openCollections()
  check('254 — 1,999 rows is merely large: NO banner', !CAP_TEXT.test(await mainText()))

  collectionsRows = makeRows(2000)
  await openCollections()
  check('254 — 2,000 rows REACHED the cap: the amber banner fires', CAP_TEXT.test(await mainText()))

  // ---- an empty day says so, rather than looking broken ----
  collectionsRows = []
  await openCollections()
  const emptyText = await mainText()
  check('254 — an empty search reads as empty, not as an error', emptyText.includes('No collections match this search') && !CAP_TEXT.test(emptyText))

  // ---- a mixed-currency result states the currency per row instead ----
  collectionsRows = [...makeRows(3), ...makeRows(2, { currency: 'BHD' })]
  await openCollections()
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  // Scrolled, not read off the first screen: since 315's Business Date column the promoted
  // Currency column sits past the 1600px viewport, and AG Grid virtualizes it away.
  const mixedHeaders = (await allHeaders()).join(' | ')
  check(
    '254 — a mixed result drops the header code and promotes the Currency column',
    !mixedHeaders.includes('Net Collected (SAR)') && mixedHeaders.includes('Currency'),
    mixedHeaders.slice(0, 200),
  )
  const bhdCell = page.locator('.ag-row[row-index="4"] [col-id="netCollected"]')
  check('254 — and each figure keeps ITS row’s decimals (BHD draws three)', (await bhdCell.innerText()).trim() === '11,976.000', await bhdCell.innerText())

  // ============ ticket 335 — finance's sheet ============
  // Stubbed to BackOffice 2151's `## Web contract` (and 2152's, which fills the theft values
  // and adds no field): the six Type labels, the sheet's figures, and finance's row order —
  // collection date, then store, then business date, a settlement receipt last in its store.
  const day = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return todayIso(d)
  }
  const sheetRow = (i, over) => ({ ...makeRows(i + 1)[i], ...financeFields(0), ...over })
  // `سعود` is the collector of 2151's sample response, copied — never retyped.
  const SHEET = [
    sheetRow(0, {
      storeId: 'P001', storeText: 'PH-001 (P001)', collectorOperatorId: '4040', collectorName: 'سعود',
      collectedAt: `${day(-1)}T10:15:00`, businessDay: `${day(-2)}T00:00:00`,
      collectionType: 'Regular', amount: 5000, surplus: 0, netCollected: 5000, description: '',
    }),
    sheetRow(1, {
      storeId: 'P001', storeText: 'PH-001 (P001)', collectorOperatorId: '4040', collectorName: 'سعود',
      collectedAt: `${day(-1)}T10:20:00`, businessDay: null,
      collectionType: 'Short', receiptKind: 'SETTLEMENT', isSettlement: true, cashSales: 0, settlement: 300,
      amount: 300, surplus: 0, netCollected: 300, description: SHORTAGE_DESCRIPTION,
    }),
    sheetRow(2, {
      storeId: 'P003', storeText: 'PH-003 (P003)', collectorOperatorId: '4040', collectorName: 'سعود',
      collectedAt: `${day(-1)}T11:05:00`, businessDay: `${day(-5)}T00:00:00`,
      collectionType: 'Regular+Surplus', hasSurplus: true, cashSales: 2000, settlement: -1000,
      amount: 2000, surplus: -1000, netCollected: 1000, description: SURPLUS_DESCRIPTION,
    }),
    // Finance's fourth sample (BackOffice 2152): cash sales 3500, stolen 3000, banked 500.
    sheetRow(3, {
      storeId: 'P019', storeText: 'PH-019 (P019)', collectorOperatorId: '4041', collectorName: 'Collector 4041',
      collectedAt: `${day(0)}T09:00:00`, businessDay: `${day(-3)}T00:00:00`,
      collectionType: 'Regular+Stolen', hasTheft: true, theftAmount: 3000, cashSales: 500, settlement: 0,
      amount: 3500, surplus: -3000, netCollected: 500, description: THEFT_DESCRIPTION,
    }),
    sheetRow(4, {
      storeId: 'P019', storeText: 'PH-019 (P019)', collectorOperatorId: '4041', collectorName: 'Collector 4041',
      collectedAt: `${day(0)}T09:00:00`, businessDay: `${day(-1)}T00:00:00`,
      collectionType: 'Regular+Surplus+Stolen', hasSurplus: true, hasTheft: true, theftAmount: 200, cashSales: 1700, settlement: -400, settlementAdjustmentTotal: 400,
      // 2152: the surplus's description, then the theft's, joined by the server.
      amount: 1900, surplus: -600, netCollected: 1300, description: `${SURPLUS_DESCRIPTION} | ${THEFT_DESCRIPTION}`,
    }),
    sheetRow(5, {
      storeId: 'P020', storeText: 'P020', profitCenter: '', collectorOperatorId: '', collectorName: '',
      collectedAt: `${day(0)}T12:00:00`, businessDay: `${day(-1)}T00:00:00`,
      collectionType: 'Outside system', receiptKind: '', collectionStatus: 'OFF_SYSTEM', isOffSystem: true,
      offSystemAt: `${day(0)}T12:00:00`, offSystemBy: '4466', offSystemReasonCode: 'BANK_DIRECT', offSystemReasonText: 'Banked by the branch',
      zNumber: 0, slipCount: null,
      cashSales: 0, settlement: 0, amount: 0, surplus: 0, netCollected: 0, description: '',
    }),
  ]
  const TYPES = SHEET.map((r) => r.collectionType)

  await page.setViewportSize({ width: 3200, height: 900 })
  const openSheet = async (rows) => {
    collectionsRows = rows
    await openCollections()
    await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  }
  /** The header row in display order, the action column included. */
  const sheetHeaders = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.ag-header-row-column .ag-header-cell')]
        .map((cell) => ({
          index: Number(cell.getAttribute('aria-colindex')),
          text: cell.querySelector('.ag-header-cell-text')?.textContent?.trim() ?? '',
        }))
        .sort((a, b) => a.index - b.index)
        .map((cell) => cell.text),
    )
  /** One column read down the grid, in the order the rows are DRAWN. */
  const columnDown = async (colId) => {
    const out = []
    for (let i = 0; i < SHEET.length; i++)
      out.push((await page.locator(`.ag-row[row-index="${i}"] [col-id="${colId}"]`).innerText()).trim())
    return out
  }

  await openSheet(SHEET)
  const sheetHead = (await sheetHeaders()).join(' | ')
  check(
    '423 — the grid opens on Saud’s first 13, in Saud’s order',
    sheetHead ===
      'Open | Receipt No# | Store Code | Profit Center | Sales Date | Amount (SAR) | Surplus (SAR) | Net Collected (SAR) | Collector | Collector Name | Type | Description | Collection Date | Business Date',
    sheetHead,
  )
  check(
    '335 — the Type cell shows the server’s label for each shape, exactly as sent',
    (await columnDown('collectionType')).join(' | ') === TYPES.join(' | ') &&
      TYPES.join(' | ') === 'Regular | Short | Regular+Surplus | Regular+Stolen | Regular+Surplus+Stolen | Outside system',
    (await columnDown('collectionType')).join(' | '),
  )
  check(
    '335 — Surplus is the negative figure sent, and zero shows as 0.00 — never blank',
    (await columnDown('surplus')).join(' | ') === '0.00 | 0.00 | -1,000.00 | -3,000.00 | -600.00 | 0.00',
    (await columnDown('surplus')).join(' | '),
  )
  check(
    '335 — finance’s Regular+Stolen sample reads 3,500.00 / -3,000.00 / 500.00',
    (await columnDown('amount'))[3] === '3,500.00' && (await columnDown('netCollected'))[3] === '500.00',
    `${(await columnDown('amount'))[3]} / ${(await columnDown('netCollected'))[3]}`,
  )
  check(
    '335 — the Description is the settlement entry’s, Arabic intact, and blank on a regular day',
    JSON.stringify(await columnDown('description')) ===
      JSON.stringify(['', SHORTAGE_DESCRIPTION, SURPLUS_DESCRIPTION, THEFT_DESCRIPTION, `${SURPLUS_DESCRIPTION} | ${THEFT_DESCRIPTION}`, '']),
    JSON.stringify(await columnDown('description')),
  )
  check(
    '335 — Collector is the collector’s id',
    (await columnDown('collectorOperatorId')).join(' | ') === '4040 | 4040 | 4040 | 4041 | 4041 | ',
    (await columnDown('collectorOperatorId')).join(' | '),
  )
  check(
    '335 — a settlement receipt’s business date is blank beside its collection date',
    (await columnDown('businessDay'))[1] === '' && (await columnDown('collectedAt'))[1] === `${day(-1)} 10:20`,
    `${(await columnDown('businessDay'))[1]} · ${(await columnDown('collectedAt'))[1]}`,
  )
  check(
    '335 — the rows are drawn in the order the server sent them',
    (await columnDown('collectionType')).join(' | ') === TYPES.join(' | ') &&
      (await columnDown('storeId')).join(' | ') === SHEET.map((r) => r.storeId).join(' | '),
    (await columnDown('storeId')).join(' | '),
  )
  const sortedHeaders = () => page.locator('.ag-header-cell[aria-sort="ascending"], .ag-header-cell[aria-sort="descending"]').count()
  check('335 — …with no column sorted on arrival', (await sortedHeaders()) === 0, `${await sortedHeaders()} sorted`)
  const rawKeys = (await page.locator('body').innerText()).match(/\bcollections?\.[a-zA-Z]+(\.[a-zA-Z]+)+\b/g) ?? []
  check('335 — no raw t() key on the screen', rawKeys.length === 0, rawKeys.join(', '))
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/335-finance-sheet.png` })

  // The same rows sent in the OPPOSITE order come out in the opposite order: the grid is
  // echoing the response, not agreeing with it by a sort of its own.
  await openSheet([...SHEET].reverse())
  check(
    '335 — a response in another order is drawn in THAT order — the grid adds no sort of its own',
    (await columnDown('collectionType')).join(' | ') === [...TYPES].reverse().join(' | '),
    (await columnDown('collectionType')).join(' | '),
  )

  // …and a header click is still the user's to make.
  await openSheet(SHEET)
  await page.locator('.ag-header-cell[col-id="amount"] .ag-header-cell-label').click()
  await page.waitForTimeout(400)
  check(
    '335 — a header click still sorts: Amount ascending',
    (await columnDown('amount')).join(' | ') === '0.00 | 300.00 | 1,900.00 | 2,000.00 | 3,500.00 | 5,000.00',
    (await columnDown('amount')).join(' | '),
  )
  check('335 — …and the header says so', (await sortedHeaders()) === 1)

  // The collector filter still narrows by the id the column now shows.
  const collectorCallsBefore = collectionsCalls
  await page.getByPlaceholder('Operator id').fill('4041')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '335 — the collector filter still sends CollectorOperatorId',
    collectionsCalls === collectorCallsBefore + 1 && q().get('CollectorOperatorId') === '4041',
    lastCollectionsQuery,
  )

  await page.setViewportSize({ width: 1600, height: 900 })
  collectionsRows = makeRows(347)

  // ============ ticket 255 — ACRs and Attempts on the same template ============
  // The same landing/paging/toggle/filter-row proof as 254, plus the two things
  // that are these screens' own: the segmented Status control, and the deliberate
  // ABSENCE of a row action on Collection Attempts.

  // ---- ACRs: it lands ALREADY POPULATED, with no click ----
  acrsCalls = 0
  lastAcrsQuery = ''
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const qa = () => new URLSearchParams(lastAcrsQuery)
  check('255 — ACRs queries on MOUNT (no Load button to press)', acrsCalls === 1, `${acrsCalls} calls`)
  check(
    '255 — …and it queries a business date of TODAY (the name 316 gave it), at the system cap',
    qa().get('BusinessDateFrom') === TODAY && qa().get('BusinessDateTo') === TODAY && qa().get('Limit') === '2000',
    lastAcrsQuery,
  )
  check(
    '255 — an unset ACR No#/collector is DROPPED, not sent as an empty string',
    !lastAcrsQuery.includes('AcrNumber') && !lastAcrsQuery.includes('CollectorOperatorId'),
    lastAcrsQuery,
  )
  // The headline: All is the CLIENT's word for "no filter" and never travels.
  check(
    '255 — Status = All sends NOTHING: no Status param at all',
    !lastAcrsQuery.includes('Status'),
    lastAcrsQuery,
  )
  check('255 — ACR rows are on screen without a click', (await page.locator('.ag-row').count()) > 0)
  check(
    '255 — the floating filter row is visible on arrival (inverting BBY’s default)',
    (await page.locator('.ag-floating-filter').count()) > 0,
  )

  // ---- client paging at 50 over the WHOLE result ----
  const acrSummary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('255 — ACRs pages at 50 with the whole 213 present', /1 to 50 of 213/.test(acrSummary), acrSummary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const acrSummary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check(
    '255 — Next walks the SAME fetched result, with no second request',
    /51 to 100 of 213/.test(acrSummary2) && acrsCalls === 1,
    `${acrSummary2} · ${acrsCalls} calls`,
  )
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  // ---- the per-column filter row narrows the WHOLE result ----
  const byCollector = await filterBy('collectorName', 'Collector 4471')
  check(
    '255 — a per-column filter narrows all 213, not the 50 on screen',
    byCollector.total > 0 && byCollector.total < 213,
    byCollector.summary,
  )
  await filterBy('collectorName', '')

  // ---- the sentinels: a still-OPEN ACR shows blanks, not 0001-01-01 and not 0 ----
  const acrHeaders = await headerText()
  // Scrolled first: since 316's Collection Date column the money sits past the 1600px
  // viewport, and AG Grid virtualizes it away.
  await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((el) => {
    el.scrollLeft = 4000
  })
  await page.waitForTimeout(200)
  const acrCell = async (row, colId) =>
    (await page.locator(`.ag-row[row-index="${row}"] [col-id="${colId}"]`).innerText()).trim()
  check(
    '255 — …and still groups to two decimals',
    (await acrCell(0, 'bankedTotal')) === '143,910.75',
    await acrCell(0, 'bankedTotal'),
  )

  // ---- ticket 341: what each ACR holds, on the default grid ----
  // Read where the grid is scrolled to (its far end), and ordered by where each header
  // SITS: AG Grid does not keep its header DOM in visual order.
  const acrScrolledHeaders = (
    await page
      .locator('.ag-header-row')
      .first()
      .locator('.ag-header-cell')
      .evaluateAll((cells) =>
        cells
          .map((cell) => ({
            x: cell.getBoundingClientRect().left,
            text: (cell.querySelector('.ag-header-cell-text')?.textContent ?? '').trim(),
          }))
          .sort((a, b) => a.x - b.x)
          .map((cell) => cell.text),
      )
  ).join(' | ')
  check(
    '255 — money states NO currency in the header (the ACR row carries none)',
    acrScrolledHeaders.includes('Net Collected') && !acrScrolledHeaders.includes('Net Collected ('),
    acrScrolledHeaders,
  )
  check(
    '341 — Cash Sales, Settlement, Net Collected, Card Total and Card Slips are default columns, in that order',
    acrScrolledHeaders.includes('Cash Sales | Settlement | Net Collected | Card Total | Card Slips'),
    acrScrolledHeaders,
  )
  const held = {}
  for (const colId of ['cashSalesTotal', 'settlementTotal', 'bankedTotal', 'cardTotalSum', 'cardTransactionCountSum'])
    held[colId] = await acrCell(0, colId)
  check(
    '341 — all five carry a value — Net Collected is the banked total, no longer blank',
    held.cashSalesTotal === '143,610.75' &&
      held.settlementTotal === '300.00' &&
      held.bankedTotal === '143,910.75' &&
      held.cardTotalSum === '99,120.50' &&
      held.cardTransactionCountSum === '812',
    JSON.stringify(held),
  )
  check(
    '341 — a surplus kept back keeps its sign as sent',
    (await acrCell(3, 'settlementTotal')) === '-200.00',
    await acrCell(3, 'settlementTotal'),
  )
  check('341 — the Label column is still on the list', acrHeaders.includes('Label'), acrHeaders.slice(0, 200))
  const acrNullCard = page.locator('.ag-row[row-index="1"] [col-id="cardTotalSum"]')
  check(
    '255 — a MISSING figure renders blank, not 0.00',
    (await acrNullCard.innerText()).trim() === '',
    JSON.stringify(await acrNullCard.innerText()),
  )
  const acrZeroCard = page.locator('.ag-row[row-index="2"] [col-id="cardTotalSum"]')
  check(
    '255 — …and a real zero still reads 0.00',
    (await acrZeroCard.innerText()).trim() === '0.00',
    await acrZeroCard.innerText(),
  )

  // ---- the More-columns toggle reveals the forensic tail ----
  check('255 — the ACR forensic tail is folded away on arrival', !acrHeaders.includes('Deposit No#'))
  await page.getByRole('button', { name: 'More columns' }).click()
  const acrOpened = (await allHeaders()).join(' | ')
  check(
    '255 — More columns reveals the ACR tail (Created, Deposit No#, Deposit Id)',
    acrOpened.includes('Created') && acrOpened.includes('Deposit No#') && acrOpened.includes('Deposit Id'),
    acrOpened.slice(0, 260),
  )
  check('255 — and nothing was dropped to make room', acrOpened.includes('ACR No#') && acrOpened.includes('Net Collected'))

  // Row 0 is the still-OPEN ACR: Closed and Deposit No# are BLANK, not sentinels.
  const openClosed = page.locator('.ag-row[row-index="0"] [col-id="closedAt"]')
  check(
    '255 — a still-OPEN ACR shows a blank Closed, not 0001-01-01',
    (await openClosed.innerText()).trim() === '',
    JSON.stringify(await openClosed.innerText()),
  )
  const openDeposit = page.locator('.ag-row[row-index="0"] [col-id="depositNumber"]')
  check(
    '255 — an unbanked ACR shows a blank Deposit No#, not 0',
    (await openDeposit.innerText()).trim() === '',
    JSON.stringify(await openDeposit.innerText()),
  )
  await page.getByRole('button', { name: 'More columns' }).click()

  // ---- the segmented Status control drives a REAL re-query ----
  const statusButton = (name) => page.getByRole('radio', { name, exact: true })
  check('255 — the Status control offers exactly three states', (await page.getByRole('radio').count()) === 3)
  check('255 — and it lands on All', (await statusButton('All').getAttribute('aria-checked')) === 'true')

  const callsBeforeStatus = acrsCalls
  await statusButton('Open').click()
  await page.waitForTimeout(300)
  check(
    '255 — choosing a status is a DRAFT edit: it fires no query on its own',
    acrsCalls === callsBeforeStatus,
    `${acrsCalls} vs ${callsBeforeStatus}`,
  )
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Search promotes it, and OPEN travels as the server’s own string',
    acrsCalls === callsBeforeStatus + 1 && qa().get('Status') === 'OPEN',
    lastAcrsQuery,
  )
  check('255 — …and the Filtered chip lights', (await page.getByText('Filtered').count()) > 0)

  await statusButton('Closed').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('255 — CLOSED re-queries too', qa().get('Status') === 'CLOSED', lastAcrsQuery)

  await statusButton('All').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — going back to All REMOVES the param rather than sending "All"',
    !lastAcrsQuery.includes('Status'),
    lastAcrsQuery,
  )

  // ---- the ACR No# box, and Reset ----
  await page.getByPlaceholder('Number').fill('41')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — the ACR No# travels as AcrNumber, never as AcrId (which is the ULID)',
    qa().get('AcrNumber') === '41' && !lastAcrsQuery.includes('AcrId'),
    lastAcrsQuery,
  )
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Reset returns to today with the status and the number cleared',
    qa().get('BusinessDateFrom') === TODAY && !lastAcrsQuery.includes('AcrNumber') && !lastAcrsQuery.includes('Status'),
    lastAcrsQuery,
  )
  check('255 — and the Filtered chip goes with it', (await page.getByText('Filtered').count()) === 0)

  // ---- the ACR cap banner: reached, not merely large ----
  acrRows = makeAcrRows(1999)
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  check('255 — 1,999 ACRs is merely large: NO banner', !/reached the 2,000-row system cap/.test(await mainText()))
  acrRows = makeAcrRows(2000)
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  check('255 — 2,000 ACRs REACHED the cap: the amber banner fires', /reached the 2,000-row system cap/.test(await mainText()))

  acrRows = []
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  check('255 — an empty period reads as empty, not as an error', (await mainText()).includes('No ACRs in this period'))
  acrRows = makeAcrRows(213)

  // ---- Collection Attempts: the same template, minus the row action ----
  attemptsCalls = 0
  lastAttemptsQuery = ''
  await page.goto(BASE + ROUTES.attempts)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const qt = () => new URLSearchParams(lastAttemptsQuery)
  check('255 — Attempts queries on MOUNT', attemptsCalls === 1, `${attemptsCalls} calls`)
  check(
    '255 — …and it queries an attempt time of TODAY (316: the collection range), at the system cap',
    qt().get('CollectionDateFrom') === TODAY && qt().get('CollectionDateTo') === TODAY && qt().get('Limit') === '2000',
    lastAttemptsQuery,
  )
  check(
    '255 — an unset store/collector/reason is DROPPED, not sent empty',
    !lastAttemptsQuery.includes('StoreCode') &&
      !lastAttemptsQuery.includes('CollectorStaffId') &&
      !lastAttemptsQuery.includes('ReasonCode'),
    lastAttemptsQuery,
  )
  check(
    '255 — the floating filter row is visible on arrival',
    (await page.locator('.ag-floating-filter').count()) > 0,
  )

  const attemptSummary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('255 — Attempts pages at 50 with the whole 174 present', /1 to 50 of 174/.test(attemptSummary), attemptSummary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const attemptSummary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check(
    '255 — Next walks the SAME fetched result, with no second request',
    /51 to 100 of 174/.test(attemptSummary2) && attemptsCalls === 1,
    `${attemptSummary2} · ${attemptsCalls} calls`,
  )
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  const byStoreCode = await filterBy('storeCode', '1003')
  check(
    '255 — a per-column filter narrows all 174, not the 50 on screen',
    byStoreCode.total > 0 && byStoreCode.total < 174,
    byStoreCode.summary,
  )
  await filterBy('storeCode', '')

  const attemptHeaders = await headerText()
  check('255 — the Attempts forensic tail is folded away on arrival', !attemptHeaders.includes('Shift Id'))
  await page.getByRole('button', { name: 'More columns' }).click()
  const attemptOpened = (await allHeaders()).join(' | ')
  check(
    '255 — More columns reveals the tail (Reason Detail, Business Date, Shift Id, Collector Id)',
    ['Reason Detail', 'Business Date', 'Shift Id', 'Collector Id'].every((h) => attemptOpened.includes(h)),
    attemptOpened.slice(0, 260),
  )
  check('255 — and nothing was dropped to make room', attemptOpened.includes('Collection Date') && attemptOpened.includes('Store Code'))
  await page.getByRole('button', { name: 'More columns' }).click()

  // ⚠️ THE DELIBERATE ABSENCE. An attempt is immutable evidence, not a voucher —
  // the WPF withholds a row action on purpose and so does this screen. Asserted
  // rather than assumed, because "we forgot" and "we decided not to" look
  // identical in a screenshot.
  check(
    '255 — Collection Attempts exposes NO row action: no button inside any row',
    (await page.locator('.ag-center-cols-container .ag-row button').count()) === 0,
  )
  check(
    '255 — …and no action column either',
    (await page.locator('[col-id="actions"]').count()) === 0,
  )
  const urlBeforeRowClick = page.url()
  await page.locator('.ag-row[row-index="0"] [col-id="storeCode"]').click()
  await page.waitForTimeout(400)
  check(
    '255 — …and clicking a row goes nowhere, opens nothing',
    page.url() === urlBeforeRowClick && (await page.locator('[role="dialog"]').count()) === 0,
    page.url(),
  )

  // ---- the reason filter, Search/Reset, and the cap ----
  const callsBeforeReason = attemptsCalls
  await page.getByPlaceholder('Reason code').fill('OTHER')
  await page.waitForTimeout(300)
  check(
    '255 — typing a reason code fires NO query (a draft is not a search)',
    attemptsCalls === callsBeforeReason,
    `${attemptsCalls} vs ${callsBeforeReason}`,
  )
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Search promotes it under the endpoint’s own ReasonCode name',
    qt().get('ReasonCode') === 'OTHER',
    lastAttemptsQuery,
  )
  check('255 — …and the Filtered chip lights', (await page.getByText('Filtered').count()) > 0)
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '255 — Reset returns to today with the reason cleared',
    qt().get('CollectionDateFrom') === TODAY && !lastAttemptsQuery.includes('ReasonCode'),
    lastAttemptsQuery,
  )

  attemptRows = makeAttemptRows(2000)
  await page.goto(BASE + ROUTES.attempts)
  await page.waitForLoadState('networkidle')
  check('255 — 2,000 attempts REACHED the cap: the amber banner fires', /reached the 2,000-row system cap/.test(await mainText()))
  attemptRows = []
  await page.goto(BASE + ROUTES.attempts)
  await page.waitForLoadState('networkidle')
  check('255 — an empty period reads as empty, not as an error', (await mainText()).includes('No attempts in this period'))
  attemptRows = makeAttemptRows(174)

  // ============ ticket 256 — Deposits shows its lines and balances in place ============
  // The same landing/paging/toggle/filter-row proof as 254, plus the three things
  // that are this screen's own: a detail region that FOLLOWS THE SELECTED ROW out
  // of the response already in the browser, the drift flag on a claimed ACR that
  // moved after banking, and the collapsible POSTED-only balances panel.

  depositRows = makeDepositRows(163)
  depositBalances = makeBalances()
  depositsCalls = 0
  lastDepositsQuery = ''
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const qd = () => new URLSearchParams(lastDepositsQuery)
  check('256 — Deposits queries on MOUNT (no Load button to press)', depositsCalls === 1, `${depositsCalls} calls`)
  check(
    '256 — …and it queries a deposited-at of TODAY (316: the collection range), at the system cap',
    qd().get('CollectionDateFrom') === TODAY && qd().get('CollectionDateTo') === TODAY && qd().get('Limit') === '2000',
    lastDepositsQuery,
  )
  check(
    '256 — an unset number/collector/bank is DROPPED, not sent as an empty string',
    !lastDepositsQuery.includes('DepositNumber') &&
      !lastDepositsQuery.includes('CollectorOperatorId') &&
      !lastDepositsQuery.includes('BankCode'),
    lastDepositsQuery,
  )
  check(
    '256 — Status = All sends NOTHING: no Status param at all',
    !lastDepositsQuery.includes('Status'),
    lastDepositsQuery,
  )
  check(
    '256 — the floating filter row is visible on arrival (inverting BBY’s default)',
    (await page.locator('.ag-floating-filter').count()) > 0,
  )

  const depositSummary = await page.locator('.ag-paging-row-summary-panel').innerText()
  check('256 — Deposits pages at 50 with the whole 163 present', /1 to 50 of 163/.test(depositSummary), depositSummary)
  await page.locator('.ag-paging-button[data-ref="btNext"]').click()
  const depositSummary2 = await page.locator('.ag-paging-row-summary-panel').innerText()
  check(
    '256 — Next walks the SAME fetched result, with no second request',
    /51 to 100 of 163/.test(depositSummary2) && depositsCalls === 1,
    `${depositSummary2} · ${depositsCalls} calls`,
  )
  await page.locator('.ag-paging-button[data-ref="btFirst"]').click()

  // ---- the two stacked regions are BOTH on screen, out of the ONE response ----
  const detail = page.locator('[data-region="deposit-detail"]')
  check('256 — the detail region is STACKED IN PLACE, not behind a modal', (await detail.count()) > 0)
  check('256 — …and no dialog was opened to show it', (await page.locator('[role="dialog"]').count()) === 0)
  check(
    '256 — the balances panel is on screen too, still on ONE request',
    (await page.getByRole('button', { name: /Collector balances/ }).count()) === 1 && depositsCalls === 1,
    `${depositsCalls} calls`,
  )

  // ---- the region FOLLOWS the selected row, and selection costs NO fetch ----
  const detailText = async () => detail.innerText()
  check(
    '256 — it opens on the first deposit rather than on an empty panel',
    (await detailText()).includes('Deposit 5500'),
    (await detailText()).replace(/\n/g, ' ').slice(0, 90),
  )
  // 🚩 …and that row is REALLY selected, not merely described. A region that
  // defaulted to rows[0] without selecting it would show the grid highlighting
  // nothing while the panel named a deposit — two surfaces disagreeing.
  check(
    '256 — …and the grid really has that row SELECTED, so the two agree',
    (await page.locator('.ag-row-selected').count()) > 0 &&
      (await page.locator('.ag-row[row-index="0"]').first().getAttribute('class')).includes(
        'ag-row-selected',
      ),
  )
  // Row 0's claimed ACRs both still match what was banked — no flag.
  check(
    '256 — a deposit whose claimed ACRs still match renders NO drift flag',
    (await page.locator('[data-drift="true"]').count()) === 0,
  )

  const callsBeforeSelect = depositsCalls
  await page.locator('.ag-row[row-index="1"] [col-id="collectorName"]').click()
  await page.waitForTimeout(400)
  check(
    '256 — selecting a row MOVES the detail region to it',
    (await detailText()).includes('Deposit 5501'),
    (await detailText()).replace(/\n/g, ' ').slice(0, 90),
  )
  // 🚩 THE ASSERTION THE WHOLE `{ rows, balances }` SHAPE EXISTS FOR. `lines` and
  // `attachments` ride on the row, so following the selection is a re-render.
  check(
    '256 — …with NO second network call: the lines were already in the browser',
    depositsCalls === callsBeforeSelect,
    `${depositsCalls} vs ${callsBeforeSelect}`,
  )
  check(
    '256 — a claimed ACR that moved after banking renders its DRIFT FLAG',
    (await page.locator('[data-drift="true"]').count()) === 1,
    `${await page.locator('[data-drift="true"]').count()} flagged lines`,
  )
  check(
    '256 — …and the flag carries the SERVER’s own drift figure, not a subtraction',
    (await page.locator('[data-drift="true"]').innerText()).includes('400.00'),
    (await page.locator('[data-drift="true"]').innerText()).replace(/\n/g, ' '),
  )
  check(
    '256 — the line that still matches is NOT flagged alongside it',
    (await page.locator('[data-drift="false"]').count()) === 1,
  )

  // ---- deselecting is HONOURED, not swallowed ----
  // CTRL-click deselects in AG Grid. Pinning the region to the last selection
  // would leave it describing a row the grid shows as unselected; it says
  // "select a deposit" instead, which is true.
  await page
    .locator('.ag-row[row-index="1"] [col-id="collectorName"]')
    .click({ modifiers: ['Control'] })
  await page.waitForTimeout(300)
  check(
    '256 — CTRL-clicking the selected row deselects it, and the region says so',
    (await page.locator('.ag-row-selected').count()) === 0 &&
      (await detailText()).includes('Select a deposit'),
    (await detailText()).replace(/\n/g, ' ').slice(0, 90),
  )
  await page.locator('.ag-row[row-index="1"] [col-id="collectorName"]').click()
  await page.waitForTimeout(300)
  check(
    '256 — …and picking it again brings the region back, still with no request',
    (await detailText()).includes('Deposit 5501') && depositsCalls === callsBeforeSelect,
    `${depositsCalls} calls`,
  )

  // ---- the slips are ordinary links opening in a new tab ----
  const slip = page.getByRole('link', { name: 'slip-5501-a.jpg' })
  check('256 — each slip is an ordinary link', (await slip.count()) === 1)
  check('256 — …opening in a NEW TAB', (await slip.getAttribute('target')) === '_blank')
  check(
    '256 — …and it cannot reach back through window.opener',
    (await slip.getAttribute('rel')).includes('noopener'),
    await slip.getAttribute('rel'),
  )

  // ---- the balances panel: labelled POSTED only, collapses and reopens ----
  const balancesToggle = page.getByRole('button', { name: /Collector balances/ })
  check(
    '256 — the balances panel says POSTED only on its face',
    (await balancesToggle.innerText()).includes('POSTED only'),
    (await balancesToggle.innerText()).replace(/\n/g, ' '),
  )
  check('256 — it is open on arrival', (await balancesToggle.getAttribute('aria-expanded')) === 'true')
  check(
    '256 — …showing a row per collector, out of the SAME response',
    (await mainText()).includes('Collector 4471') && depositsCalls === callsBeforeSelect,
  )
  const outstandingText = await mainText()
  check(
    '256 — a negative outstanding keeps its own sign (last trip’s shortfall has landed)',
    outstandingText.includes('-412.50'),
  )
  await balancesToggle.click()
  await page.waitForTimeout(200)
  check(
    '256 — it COLLAPSES to reclaim the height',
    (await balancesToggle.getAttribute('aria-expanded')) === 'false' &&
      !(await mainText()).includes('Outstanding'),
  )
  await balancesToggle.click()
  await page.waitForTimeout(200)
  check(
    '256 — …and REOPENS, still without a request',
    (await balancesToggle.getAttribute('aria-expanded')) === 'true' &&
      (await mainText()).includes('Outstanding') &&
      depositsCalls === callsBeforeSelect,
    `${depositsCalls} calls`,
  )

  // ---- money, the sentinels, and the forensic tail ----
  const depositHeaders = await headerText()
  check(
    '256 — money states NO currency in the header (the deposit row carries none)',
    depositHeaders.includes('Calculated') && !depositHeaders.includes('Calculated ('),
    depositHeaders.slice(0, 200),
  )
  const bankedCell = page.locator('.ag-row[row-index="0"] [col-id="realAmount"]')
  check(
    '256 — …and still groups to two decimals, right-aligned',
    (await bankedCell.innerText()).trim() === '143,910.75' &&
      (await bankedCell.getAttribute('class')).includes('text-end'),
    await bankedCell.innerText(),
  )
  check('256 — the Deposits forensic tail is folded away on arrival', !depositHeaders.includes('Void Reason'))
  await page.getByRole('button', { name: 'More columns' }).click()
  const depositOpened = (await allHeaders()).join(' | ')
  check(
    '256 — More columns reveals the tail (Created, Bank Code, Note, the void trail)',
    ['Created', 'Bank Code', 'Note', 'Voided By', 'Voided', 'Void Reason'].every((h) =>
      depositOpened.includes(h),
    ),
    depositOpened.slice(0, 300),
  )
  check(
    '256 — and nothing was dropped to make room',
    depositOpened.includes('Deposit No#') && depositOpened.includes('Banked'),
  )
  // Row 0 was never voided: Voided is BLANK, not the .NET year-1 sentinel.
  const voidedCell = page.locator('.ag-row[row-index="0"] [col-id="voidedAt"]')
  check(
    '256 — a deposit that was never voided shows a blank Voided, not 0001-01-01',
    (await voidedCell.innerText()).trim() === '',
    JSON.stringify(await voidedCell.innerText()),
  )
  await page.getByRole('button', { name: 'More columns' }).click()

  // ⚠️ THE DELIBERATE ABSENCE, a second time and for a different reason than
  // Attempts': Deposit Inquiry has no printable document at all, so there is no
  // row action for 257 to add later.
  check(
    '256 — Deposits exposes NO row action: no button inside any grid row',
    (await page.locator('.ag-center-cols-container .ag-row button').count()) === 0,
  )

  // ---- the criteria DRAFT: typing does not query; Search does ----
  const callsBeforeBank = depositsCalls
  await page.getByPlaceholder('Bank code').fill('ANB')
  await page.waitForTimeout(300)
  check(
    '256 — typing a bank code fires NO query (a draft is not a search)',
    depositsCalls === callsBeforeBank,
    `${depositsCalls} vs ${callsBeforeBank}`,
  )
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('256 — Search promotes it under BankCode', qd().get('BankCode') === 'ANB', lastDepositsQuery)
  check('256 — …and the Filtered chip lights', (await page.getByText('Filtered').count()) > 0)

  // ---- the segmented Status control drives a REAL re-query ----
  const depositStatus = (name) => page.getByRole('radio', { name, exact: true })
  check('256 — the Status control offers exactly three states', (await page.getByRole('radio').count()) === 3)
  await depositStatus('Posted').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — POSTED travels as the server’s own string',
    qd().get('Status') === 'POSTED',
    lastDepositsQuery,
  )
  await depositStatus('Void').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check('256 — VOID re-queries too', qd().get('Status') === 'VOID', lastDepositsQuery)
  await depositStatus('All').click()
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — going back to All REMOVES the param rather than sending "All"',
    !lastDepositsQuery.includes('Status'),
    lastDepositsQuery,
  )

  // ---- the Deposit No# box, and Reset ----
  await page.getByPlaceholder('Number').fill('5501')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — the Deposit No# travels as DepositNumber, never as DepositId (the ULID)',
    qd().get('DepositNumber') === '5501' && !lastDepositsQuery.includes('DepositId'),
    lastDepositsQuery,
  )
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForLoadState('networkidle')
  check(
    '256 — Reset returns to today with the number, bank and status cleared',
    qd().get('CollectionDateFrom') === TODAY &&
      !lastDepositsQuery.includes('DepositNumber') &&
      !lastDepositsQuery.includes('BankCode') &&
      !lastDepositsQuery.includes('Status'),
    lastDepositsQuery,
  )
  check('256 — and the Filtered chip goes with it', (await page.getByText('Filtered').count()) === 0)

  // ---- the cap banner: reached, not merely large ----
  depositRows = makeDepositRows(1999)
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  check('256 — 1,999 deposits is merely large: NO banner', !CAP_TEXT.test(await mainText()))
  depositRows = makeDepositRows(2000)
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  check('256 — 2,000 deposits REACHED the cap: the amber banner fires', CAP_TEXT.test(await mainText()))

  // ---- an empty day says so, and takes both regions with it ----
  depositRows = []
  depositBalances = []
  await page.goto(BASE + ROUTES.deposits)
  await page.waitForLoadState('networkidle')
  const emptyDeposits = await mainText()
  check(
    '256 — an empty period reads as empty, not as an error',
    emptyDeposits.includes('No deposits in this period') && !CAP_TEXT.test(emptyDeposits),
  )
  depositRows = makeDepositRows(163)
  depositBalances = makeBalances()

  // ============ ticket 257 — a row opens its document, and an ACR its collections ============
  // The seam where the four screens meet the two documents. Three claims:
  //   1. Receipt ▸ and Form ▸ are ADDRESSES in a NEW TAB — the grid keeps its
  //      search, scroll and selection, and a document can be pasted into a ticket;
  //   2. Collections ▸ walks to Cash Collections scoped to that ACR in the SAME
  //      tab, and the scoped query carries AcrId and OMITS store/collector/period;
  //   3. the chip overrides and DISABLES the four inputs, survives a reload, and
  //      clears back to the ordinary today screen.

  // 🚩 Row 0 of each grid is given a FIXTURE KEY as its id, so that following the
  // link actually renders a document rather than the (correct, but uninteresting)
  // "this document no longer exists" backstop. Row 1's receipt id is blanked on
  // purpose: `CollectionReceiptId` is a server change still in flight (BackOffice
  // 1089), so an empty one is a real arrival and must draw NO link at all.
  collectionsRows = makeRows(347)
  collectionsRows[0].collectionReceiptId = 'posted'
  collectionsRows[1].collectionReceiptId = ''
  acrRows = makeAcrRows(213)
  acrRows[0].acrId = 'three-pages'

  await openCollections()
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const receiptLink = page.locator('.ag-row[row-index="0"] [col-id="actions"] a')
  check('257 — Cash Collections draws a row action', (await receiptLink.count()) === 1)
  check(
    '257 — Receipt ▸ addresses the document by its ULID',
    (await receiptLink.getAttribute('href')) === '/collection/receipt/posted',
    await receiptLink.getAttribute('href'),
  )
  check(
    '257 — …in a NEW TAB, so the grid keeps its search, scroll and selection',
    (await receiptLink.getAttribute('target')) === '_blank',
    await receiptLink.getAttribute('target'),
  )
  check(
    '257 — …and it cannot reach back through window.opener',
    (await receiptLink.getAttribute('rel')).includes('noopener'),
    await receiptLink.getAttribute('rel'),
  )
  check(
    '257 — a row with NO receipt id draws no link at all (1089 is still in flight)',
    (await page.locator('.ag-row[row-index="1"] [col-id="actions"] a').count()) === 0,
  )

  // The address really resolves — a link that 404s is a broken action, not a link.
  await page.goto(BASE + '/collection/receipt/posted')
  await page.waitForLoadState('networkidle')
  check(
    '257 — Receipt ▸ resolves to a RENDERING document, not to the miss backstop',
    (await page.locator('.print-sheet').count()) === 1,
    `${await page.locator('.print-sheet').count()} sheets`,
  )

  // ---- the ACRs grid's two actions ----
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const acrActions = page.locator('.ag-row[row-index="0"] [col-id="actions"] a')
  check('257 — an ACR row offers exactly TWO ways out', (await acrActions.count()) === 2)
  const formLink = acrActions.first()
  const collectionsLink = acrActions.nth(1)
  check(
    '257 — Form ▸ addresses the ACR document, in a NEW TAB',
    (await formLink.getAttribute('href')) === '/collection/acr/three-pages' &&
      (await formLink.getAttribute('target')) === '_blank',
    `${await formLink.getAttribute('href')} · ${await formLink.getAttribute('target')}`,
  )
  check(
    '257 — Collections ▸ carries the ACR as a query param — one SHAREABLE URL',
    (await collectionsLink.getAttribute('href')) === '/collection/collections?acr=three-pages',
    await collectionsLink.getAttribute('href'),
  )
  check(
    '257 — …and it stays in the SAME tab (a drill-down is not a document)',
    (await collectionsLink.getAttribute('target')) === null,
    await collectionsLink.getAttribute('target'),
  )

  // ⚠️ A RAGGED SESSION is an ordinary one: the four grants are independent, so an
  // account that can read ACRs and not Cash Collections exists. It keeps Form ▸
  // and is not offered a drill-down that would walk it into a denial screen.
  scenario = { accessBody: { ...NONE, canOpenAcrs: true }, access403: false, access500: false }
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  const raggedActions = page.locator('.ag-row[row-index="0"] [col-id="actions"] a')
  check(
    '257 — an ACR-only session keeps Form ▸ but is NOT offered Collections ▸',
    (await raggedActions.count()) === 1 &&
      (await raggedActions.first().getAttribute('href')) === '/collection/acr/three-pages',
    `${await raggedActions.count()} actions`,
  )
  scenario = { accessBody: ALL, access403: false, access500: false }

  await page.goto(BASE + '/collection/acr/three-pages')
  await page.waitForLoadState('networkidle')
  check(
    '257 — Form ▸ resolves to a RENDERING document across its pages',
    (await page.locator('.print-sheet').count()) === 3,
    `${await page.locator('.print-sheet').count()} sheets`,
  )

  // ---- Collections ▸ : the drill-down, clicked for real ----
  await page.goto(BASE + ROUTES.acrs)
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  collectionsCalls = 0
  lastCollectionsQuery = ''
  await page.locator('.ag-row[row-index="0"] [col-id="actions"] a').nth(1).click()
  // ⚠️ It is a ROUTER navigation, not a document load: there is no load event to
  // wait on, and the ACRs grid's own rows are still on screen while it happens.
  // Waiting on the URL is what makes this assertion about the drill-down rather
  // than about a race.
  await page.waitForURL('**/collection/collections?acr=three-pages', { timeout: 5000 })
  // …and then on a control only THIS screen has: the ACRs grid's rows are still
  // mounted while the lazy route loads, so `.ag-row` would resolve against the
  // screen we are leaving.
  await page.getByPlaceholder('Store code').waitFor({ timeout: 5000 })
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  check(
    '257 — Collections ▸ lands on Cash Collections, scoped, in the same tab',
    page.url().endsWith('/collection/collections?acr=three-pages'),
    page.url(),
  )
  // ⚠️ THE ASSERTION THE WHOLE CHIP EXISTS FOR. `AcrId` is an EXCLUSIVE filter:
  // the door ignores store, collector and period entirely when one is set, so
  // sending them would leave a query string that reads as a period filter.
  check(
    '257 — the scoped query carries AcrId and the cap…',
    q().get('AcrId') === 'three-pages' && q().get('Limit') === '2000',
    lastCollectionsQuery,
  )
  check(
    '257 — …and OMITS store, collector and the period entirely',
    !lastCollectionsQuery.includes('StoreId') &&
      !lastCollectionsQuery.includes('CollectorOperatorId') &&
      !lastCollectionsQuery.includes('FromDate') &&
      !lastCollectionsQuery.includes('ToDate'),  // also covers the four 315 date names
    lastCollectionsQuery,
  )

  const chip = page.getByText('three-pages')
  check('257 — a chip NAMES the ACR the view is scoped to', (await chip.count()) === 1)
  check(
    '257 — …and it REPLACES the Filtered chip rather than sitting beside it',
    (await page.getByText('Filtered').count()) === 0,
  )

  // The disabling is HONESTY, not decoration: a live date input over a scoped
  // result would let a supervisor set a range that silently does nothing.
  const dateInputs = page.locator('form input[type="date"]')
  check(
    '257 — the chip DISABLES all four date ends',
    (await dateInputs.count()) === 4 &&
      (await dateInputs.evaluateAll((els) => els.every((el) => el.disabled))),
  )
  check(
    '257 — …and Store and Collector',
    (await page.getByPlaceholder('Store code').isDisabled()) &&
      (await page.getByPlaceholder('Operator id').isDisabled()),
  )
  check(
    '257 — …and Search, since there is nothing left to promote',
    await page.getByRole('button', { name: 'Search' }).isDisabled(),
  )
  // ⚠️ OVERRIDDEN, not merely locked. A greyed box still reading today's date over
  // a grid scoped to an ACR that spans weeks would say "this period was applied and
  // then frozen" — the exact misreading the disabling exists to prevent.
  check(
    '257 — …and every overridden input shows NOTHING, not a frozen value',
    // All four ends — the collection pair is the one that held today underneath.
    (await dateInputs.evaluateAll((els) => els.every((el) => el.value === ''))) &&
      (await page.getByPlaceholder('Store code').inputValue()) === '',
    (await dateInputs.evaluateAll((els) => els.map((el) => el.value))).join(' · '),
  )

  // ---- the URL really is the scope: a reload reproduces the view ----
  collectionsCalls = 0
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  check(
    '257 — a RELOAD reproduces the scoped view (the URL is the only state there is)',
    q().get('AcrId') === 'three-pages' && (await page.getByText('three-pages').count()) === 1,
    `${lastCollectionsQuery} · ${page.url()}`,
  )

  // ---- clearing the chip: the param goes, and the un-searched landing comes back ----
  const callsBeforeClear = collectionsCalls
  await page.getByRole('button', { name: 'Clear the ACR and start over' }).click()
  await page.waitForLoadState('networkidle')
  await page.getByText(LANDING_TITLE).first().waitFor({ timeout: 5000 }).catch(() => {})
  check(
    '257 — clearing the chip DROPS the param from the URL',
    !page.url().includes('acr='),
    page.url(),
  )
  check(
    '423 — …and returns to the un-searched landing: press Search, no new query',
    (await mainText()).includes(LANDING_TITLE) && collectionsCalls === callsBeforeClear,
    `${collectionsCalls} vs ${callsBeforeClear}`,
  )
  check('257 — …with the chip gone', (await page.getByText('three-pages').count()) === 0)
  check(
    '257 — …and the four inputs live again',
    !(await dateInputs.nth(0).isDisabled()) &&
      !(await page.getByPlaceholder('Store code').isDisabled()) &&
      !(await page.getByRole('button', { name: 'Search' }).isDisabled()),
  )

  // ---- a hand-typed scope with no collections behind it reads as such ----
  collectionsRows = []
  await page.goto(BASE + ROUTES.collections + '?acr=three-pages')
  await page.waitForLoadState('networkidle')
  const scopedEmpty = await mainText()
  check(
    '257 — an ACR with nothing under it says SO, not "no collections in this period"',
    scopedEmpty.includes('No collections under this ACR'),
    scopedEmpty.replace(/\n/g, ' ').slice(0, 120),
  )
  collectionsRows = makeRows(347)

  // ============================================================================
  // ticket 336 — the export is a workbook, and it is THE GRID AS SHOWN
  // ============================================================================
  // (Ticket 258's CSV, its BOM and its `sep=` line are retired — BackOffice 2149 D4.)
  //
  // ⚠️ Two rules that look right while being wrong: a money cell written as text
  // sums to zero, and a receipt number written as a number is totalled and
  // reshaped. So this section reads the downloaded workbook's own XML back and
  // asserts each cell's TYPE, not just its text.
  //
  // 🚩 The file follows the More-columns toggle now. 258's CSV shipped every column
  // whatever the toggle said; "the grid as shown" rules the other way, so the grid
  // is filtered, sorted, exported with the toggle OFF and then again with it ON.

  // Wide enough that the default columns are all drawn: AG Grid virtualizes the ones
  // past the viewport away, and the file's columns are compared with the screen's own.
  await page.setViewportSize({ width: 3200, height: 900 })

  await openCollections()
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })

  const exportButton = page.getByRole('button', { name: 'Export' })
  check('336 — an Export button sits beside the two toggles', (await exportButton.count()) === 1)

  // ---- filter to one store, then sort by the money column, descending ----
  // Store `1003` is every 7th mock row → 50 of the 347.
  const exportFiltered = await filterBy('storeId', '1003')
  check('336 — the grid is narrowed to one store before exporting', exportFiltered.total === 50, exportFiltered.summary)
  // The label, not the cell: `.ag-header-cell[col-id=…]` also matches the floating
  // filter row's cell, and only the header row sorts.
  const netHeader = page.locator('.ag-header-cell[col-id="netCollected"] .ag-header-cell-label')
  await netHeader.click()
  await page.waitForTimeout(200)
  await netHeader.click() // second click = descending
  await page.waitForTimeout(400)

  /** Click Export and read the workbook back: its name, its sheet names, and sheet 1 as typed cells. */
  const exportWorkbook = async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      exportButton.click(),
    ])
    const files = unzipText(readFileSync(await download.path()))
    const grid = sheetCells(files)
    const head = (grid[0] ?? []).map((c) => c?.text ?? '')
    const body = grid.slice(1)
    /** One body cell by its header — `undefined` when the column is not in the file. */
    const at = (row, name) => (head.indexOf(name) < 0 ? undefined : row[head.indexOf(name)])
    return {
      name: download.suggestedFilename(),
      sheets: [...(files['xl/workbook.xml'] ?? '').matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => m[1]),
      files,
      head,
      body,
      at,
    }
  }

  const closed = await exportWorkbook()
  check(
    '336 — the file is a workbook named for the SCREEN and the day, with no time in it',
    closed.name === `collection-collections-${TODAY}.xlsx`,
    closed.name,
  )
  check(
    '336 — it is a real workbook: one sheet, named for the screen',
    closed.sheets.length === 1 && closed.sheets[0] === 'Cash Collections',
    closed.sheets.join('|'),
  )

  // ---- the visible columns, in the grid's order — and only those ----
  // The screen's own header row, read off the DOM in display order. The actions
  // column is on screen and holds links, not values: it is the one column left out.
  const shownHeaders = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll('.ag-header-row-column .ag-header-cell')]
        .map((cell) => ({
          id: cell.getAttribute('col-id'),
          index: Number(cell.getAttribute('aria-colindex')),
          text: cell.querySelector('.ag-header-cell-text')?.textContent?.trim() ?? '',
        }))
        .filter((cell) => cell.id !== 'actions')
        .sort((a, b) => a.index - b.index)
        .map((cell) => cell.text),
    )
  const onScreen = await shownHeaders()
  check(
    '336 — the file’s columns are the grid’s visible columns, in the grid’s order',
    onScreen.length === 13 && closed.head.join('|') === onScreen.join('|'),
    `file: ${closed.head.join('|')} · screen: ${onScreen.join('|')}`,
  )
  check(
    '336 — the folded columns are NOT in the file while More columns is off',
    ['Retained Float (SAR)', 'Retained Float', 'Currency', 'Z Reports', 'Store Name', 'Card Slips', 'Variance (SAR)'].every(
      (h) => !closed.head.includes(h),
    ),
    closed.head.join('|'),
  )
  check('336 — the actions column is not in the file', !closed.head.includes('Open') && !closed.head.includes(''), closed.head.join('|'))
  // The header is the grid's own, currency and all: one currency in the result
  // puts the code in the money headers, and the file says what the screen says.
  check('336 — a money header reads as the grid’s does', closed.head.includes('Net Collected (SAR)'), closed.head.join('|'))

  // ---- only the filtered rows, in the sorted order ----
  check('336 — the file holds ONLY the filtered rows (50 of 347), not the page and not the lot', closed.body.length === 50, `${closed.body.length} rows`)
  check(
    '336 — …all of them the store that was filtered to, written as TEXT',
    closed.body.every((r) => closed.at(r, 'Store Code')?.text === '1003' && !closed.at(r, 'Store Code')?.numeric),
    JSON.stringify(closed.at(closed.body[0], 'Store Code')),
  )
  const netValues = closed.body.map((r) => Number(closed.at(r, 'Net Collected (SAR)')?.text))
  check(
    '336 — …in the DESCENDING order the header click put them in',
    netValues.every((v, i) => Number.isFinite(v) && (i === 0 || netValues[i - 1] >= v)),
    `${netValues[0]} … ${netValues[netValues.length - 1]}`,
  )

  // ---- the money rule: a number, and therefore summable ----
  const moneyOffenders = (book, moneyCols) => {
    const bad = []
    for (const row of book.body)
      for (const name of moneyCols) {
        const cell = book.at(row, name)
        // A missing amount is an empty cell; anything present must be a NUMBER cell.
        if (cell && cell.text !== '' && !(cell.numeric && /^-?\d+(\.\d+)?$/.test(cell.text))) bad.push(`${name}=${cell.text}`)
      }
    return bad
  }
  const closedMoney = closed.head.filter((h) => h.endsWith('(SAR)'))
  check(
    '336 — the default grid carries finance’s three money columns: Amount, Surplus, Net Collected',
    closedMoney.join(', ') === 'Amount (SAR), Surplus (SAR), Net Collected (SAR)',
    closedMoney.join(', '),
  )
  check(
    '336 — every money cell is a NUMBER cell: no grouping, no symbol, not text',
    moneyOffenders(closed, closedMoney).length === 0,
    moneyOffenders(closed, closedMoney).slice(0, 3).join(' | '),
  )
  check(
    '336 — …and a real amount really is in there (not a column of blanks)',
    netValues[0] > 0 && closed.at(closed.body[0], 'Net Collected (SAR)')?.numeric === true,
    String(netValues[0]),
  )
  // 🚩 The sweep above SKIPS empty cells, so a money column blank all the way down
  // proves nothing. Assert the signed column has substance, minus included.
  // Surplus is the signed column of the default grid since ticket 335: a negative where a
  // surplus was deducted, and a real 0 — a NUMBER cell, not an empty one — where none was.
  const surpluses = closed.body.map((r) => closed.at(r, 'Surplus (SAR)')).filter((c) => c && c.text !== '')
  check(
    '336 — Surplus is a column with substance: negatives and zeros, all numbers, none blank',
    surpluses.length === closed.body.length &&
      surpluses.some((c) => Number(c.text) < 0) &&
      surpluses.some((c) => Number(c.text) === 0) &&
      surpluses.every((c) => c.numeric),
    `${surpluses.length}/${closed.body.length} filled · e.g. ${surpluses.slice(0, 3).map((c) => c.text).join(', ')}`,
  )
  check(
    '335 — Amount + Surplus = Net Collected on every exported row',
    closed.body.every(
      (r) => Number(closed.at(r, 'Amount (SAR)')?.text) + Number(closed.at(r, 'Surplus (SAR)')?.text) === Number(closed.at(r, 'Net Collected (SAR)')?.text),
    ),
  )
  const types = new Set(closed.body.map((r) => closed.at(r, 'Type')?.text))
  check(
    '335 — the Type column is in the file as the text the server sent',
    [...types].sort().join('|') === 'Regular|Regular+Surplus|Short' && !closed.at(closed.body[0], 'Type')?.numeric,
    [...types].join('|'),
  )

  // ---- the identity rule: text, and therefore unmangled ----
  const collectorId = closed.at(closed.body[0], 'Collector')
  check('336 — the collector id is a TEXT cell', /^\d+$/.test(collectorId?.text ?? '') && !collectorId?.numeric, JSON.stringify(collectorId))

  // ---- dates keep the screen's format ----
  check(
    '336 — a datetime column reads as the cell does (yyyy-MM-dd HH:mm)',
    closed.at(closed.body[0], 'Collection Date')?.text === `${TODAY} 15:40`,
    closed.at(closed.body[0], 'Collection Date')?.text,
  )
  check(
    '336 — a day-only column is yyyy-MM-dd',
    closed.at(closed.body[0], 'Business Date')?.text === TODAY,
    closed.at(closed.body[0], 'Business Date')?.text,
  )

  // ---- More columns ON: the folded tail joins the file ----
  await page.getByRole('button', { name: 'More columns' }).click()
  await page.waitForTimeout(500)
  const open = await exportWorkbook()
  check(
    '336 — with More columns ON the folded columns are in the file',
    ['Retained Float (SAR)', 'Currency', 'Z Reports', 'Sales Date', 'Collector Name', 'Receipt No#', 'Variance (SAR)', 'Profit Center (Store)'].every((h) => open.head.includes(h)),
    open.head.join('|'),
  )
  check(
    '336 — …after the default ones, which keep their order (Saud’s eighteen folded columns)',
    open.head.length === closed.head.length + 18 && open.head.slice(0, closed.head.length).join('|') === closed.head.join('|'),
    `${open.head.length} headers`,
  )
  check('336 — …still only the filtered rows', open.body.length === 50, `${open.body.length} rows`)
  const openMoney = open.head.filter((h) => h.endsWith('(SAR)'))
  check('336 — all ten money columns are there with the tail open', openMoney.length === 10, `${openMoney.length}: ${openMoney.join(', ')}`)
  check(
    '336 — …and every one of their cells is a NUMBER cell',
    moneyOffenders(open, openMoney).length === 0,
    moneyOffenders(open, openMoney).slice(0, 3).join(' | '),
  )
  const slipsCount = open.at(open.body[0], 'Card Slips')
  check('336 — a count is a number too', slipsCount?.numeric === true && slipsCount.text === '96', JSON.stringify(slipsCount))
  const receipt = open.at(open.body[0], 'Receipt No#')
  check('336 — the receipt number is a TEXT cell although the wire sends a number', /^\d+$/.test(receipt?.text ?? '') && !receipt?.numeric, JSON.stringify(receipt))
  // 🚩 The money sweep SKIPS empty cells, so a column blank all the way down proves nothing.
  const variances = open.body.map((r) => open.at(r, 'Variance (SAR)')).filter((c) => c && c.text !== '')
  check(
    '336 — Variance is a column with substance, negatives included, all numbers',
    variances.length === open.body.length && variances.some((c) => Number(c.text) < 0) && variances.every((c) => c.numeric),
    `${variances.length}/${open.body.length} filled · e.g. ${variances.slice(0, 3).map((c) => c.text).join(', ')}`,
  )
  await page.getByRole('button', { name: 'More columns' }).click()
  await page.waitForTimeout(300)

  // ---- a view filtered down to NOTHING offers no file ----
  // ⚠️ The button tracks what the FILE would hold, not what the query returned:
  // the export writes the rows after the filter, so a grid narrowed to nothing
  // must not hand back a headers-only workbook under the day's name.
  const emptyFilter = await filterBy('storeId', 'no-such-store')
  check('336 — a filter that matches nothing empties the grid', emptyFilter.total === 0, emptyFilter.summary)
  check('336 — …and the Export button goes DISABLED rather than writing a headers-only file', await exportButton.isDisabled())
  await filterBy('storeId', '')
  check('336 — …and comes back live when the filter does', await exportButton.isEnabled())

  // ---- Arabic survives the round trip ----
  // 🚩 Copied from `voucher-fixture.ts`, never retyped: a retyped Arabic string
  // looks right and is silently wrong, and no gate in this repo catches it.
  const ARABIC_NAME = 'عبدالله بن ناصر القحطاني'
  // The description is the accountant's free text on the default grid since ticket 335; the
  // collector's NAME is behind More columns, so the toggle goes on for this export.
  collectionsRows = makeRows(20).map((r) => ({ ...r, collectorName: ARABIC_NAME, description: SURPLUS_DESCRIPTION }))
  await openCollections()
  await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: 'More columns' }).click()
  await page.waitForTimeout(500)
  const arabic = await exportWorkbook()
  check(
    '336 — an Arabic collector name is in the workbook intact, on every row',
    arabic.body.length === 20 && arabic.body.every((r) => arabic.at(r, 'Collector Name')?.text === ARABIC_NAME),
    arabic.at(arabic.body[0], 'Collector Name')?.text,
  )
  check(
    '335 — …and so is an Arabic description',
    arabic.body.every((r) => arabic.at(r, 'Description')?.text === SURPLUS_DESCRIPTION),
    arabic.at(arabic.body[0], 'Description')?.text,
  )
  // A workbook part is XML, and XML is UTF-8 unless its declaration says otherwise — which is
  // what retired the CSV's BOM. The part holding the name must not declare anything else.
  const arabicPart = Object.values(arabic.files).find((xml) => xml.includes(ARABIC_NAME)) ?? ''
  const declared = /^<\?xml[^>]*\?>/.exec(arabicPart)?.[0] ?? ''
  check(
    '336 — …in an XML part that is UTF-8 (declared, or by XML’s default), so no BOM or sep= line is needed',
    declared !== '' && !/encoding="(?!UTF-8")/i.test(declared),
    declared,
  )
  collectionsRows = makeRows(347)

  // ---- the other three screens export too, through the same writer ----
  // ⚠️ **One writer, four screens** — so what each of these proves is that the
  // screen passed its OWN grid: its visible columns, its money as numbers and its
  // identity as text. The two that carry no money at all (Attempts) or no currency
  // (ACRs, Deposits) are the cases a writer designed against Cash Collections alone
  // would get wrong.
  const OTHERS = [
    {
      key: 'acrs',
      route: ROUTES.acrs,
      sheet: 'ACRs',
      // The folded tail: on the row, off the default grid, and so off the file.
      folded: ['Created', 'Closed', 'Closed By Id', 'First Collected', 'Last Collected', 'Collector Id', 'Deposit No#', 'Deposit Status', 'Deposit Id'],
      money: ['Cash Sales', 'Settlement', 'Net Collected', 'Card Total'],
      identity: 'ACR No#',
    },
    {
      key: 'deposits',
      route: ROUTES.deposits,
      sheet: 'Deposits',
      folded: ['Created', 'Collector Id', 'Bank Code', 'Note', 'Voided By', 'Voided', 'Void Reason'],
      money: ['Calculated', 'Banked', 'Difference'],
      identity: 'Deposit No#',
    },
    {
      key: 'attempts',
      route: ROUTES.attempts,
      sheet: 'Collection Attempts',
      folded: ['Reason Detail', 'Shift Id', 'Collector Id', 'Profit Center'],
      // 🚩 None. An attempt collected nothing — that is what makes it an attempt.
      money: [],
      identity: 'Store Code',
    },
  ]
  for (const screen of OTHERS) {
    await page.goto(BASE + screen.route)
    await page.waitForLoadState('networkidle')
    await page.locator('.ag-row').first().waitFor({ timeout: 5000 })
    const book = await exportWorkbook()
    check(`336 — ${screen.key} exports its own workbook`, book.name === `collection-${screen.key}-${TODAY}.xlsx`, book.name)
    check(`336 — ${screen.key}: one sheet, named for the screen`, book.sheets.join('|') === screen.sheet, book.sheets.join('|'))
    const shown = await shownHeaders()
    check(
      `336 — ${screen.key}: the file’s columns are the grid’s visible columns, in order`,
      shown.length > 0 && book.head.join('|') === shown.join('|'),
      `file: ${book.head.join('|')} · screen: ${shown.join('|')}`,
    )
    check(
      `336 — ${screen.key}: the folded columns stay out with the toggle OFF`,
      screen.folded.every((h) => !book.head.includes(h)),
      book.head.join('|'),
    )
    check(`336 — ${screen.key}: the file holds rows, not just a header`, book.body.length > 0, `${book.body.length} rows`)
    check(
      `336 — ${screen.key}: its money columns are all in the file (${screen.money.length})`,
      screen.money.every((h) => book.head.includes(h)),
      book.head.join('|'),
    )
    const offenders = moneyOffenders(book, screen.money)
    check(
      `336 — ${screen.key}: every money cell is a NUMBER cell (${screen.money.length} columns)`,
      offenders.length === 0 && (screen.money.length === 0 || book.body.some((r) => book.at(r, screen.money[0])?.numeric)),
      offenders.slice(0, 3).join(' | '),
    )
    const identity = book.at(book.body[0], screen.identity)
    check(
      `336 — ${screen.key}: ${screen.identity} is a TEXT cell`,
      (identity?.text ?? '') !== '' && !identity?.numeric,
      JSON.stringify(identity),
    )

    // …and the toggle is followed here too.
    await page.getByRole('button', { name: 'More columns' }).click()
    await page.waitForTimeout(500)
    const more = await exportWorkbook()
    check(
      `336 — ${screen.key}: with More columns ON the folded columns join the file`,
      screen.folded.every((h) => more.head.includes(h)) && more.head.length === book.head.length + screen.folded.length,
      more.head.join('|'),
    )
  }

  // Scenarios 4 and 5 intentionally 403/500 CollectionWeb/Access, which the browser logs
  // as a resource-load failure — expected, not an app fault. Filter them out.
  const realErrors = errors.filter((e) => !/status of (403|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
