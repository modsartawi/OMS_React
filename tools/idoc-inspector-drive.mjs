// IDoc Inspector drive (spec 1386) — drives the REAL app in Chromium against
// STUBBED `IDocInspector/*` envelopes.
//
// ⚠️ Stubbed because the door is NOT BUILT: BackOffice 1387 (the grant seed, the
// screen gate, the grant filter and `Access`) is open. Everything ticket 296
// asserts is a client decision and is assertable on stubs; what a stub cannot
// prove is that the server answers this shape, and 1387's own tests are where
// that lives.
//
// 🚩 ONE drive file for the whole wave — 297–300 EXTEND this file rather than
// starting a second one (the shape `invoice-drive.mjs` set for spec 261).
//
// Ticket 296 — the access spine:
//   1. screenAllowed:true  → the Reports group carries an IDoc inspector leaf,
//      and the screen renders its title, its lookup bar and its landing state.
//   2. screenAllowed:false → NO IDoc inspector leaf, while the Invoices leaf
//      beside it is UNAFFECTED — two screens, two grants, one nav group.
//   3. a hand-typed /reports/idoc-inspector on a denied session → the inspector's
//      OWN no-access sentence, not an error, not a retry, and not the invoices
//      screen's wording.
//   4. the access probe is called ONCE per visit (nav leaf + screen gate share
//      one key) and a refused probe is NOT retried.
//   5. an unreachable probe (500) reads as unavailable — the other sentence.
//   6. the local required-field refusal: Look up with a blank half issues nothing
//      and says which half is missing.
//   7. no raw i18n keys anywhere — the `reports` namespace carries the screen.
//
// Ticket 297 — the lookup shows the documents:
//   8. a complete key issues exactly ONE `Transaction` call, carrying both halves.
//   9. the rail carries one card per generated document, and one per IDoc TYPE
//      where the types differ.
//  10. 🔑 selecting a document and opening a line make NO further request — the
//      whole graph arrived in one call.
//  11. a line opens IN PLACE: the expansion is a row of the SAME table, and it
//      carries the line's conditions AND its item details. Never a third level.
//  12. ⚠️ an empty source tag renders as a dimmed `unknown`, NEVER as `pos`.
//  13. payments and FI lines carry NO provenance column at all, and say so.
//  14. the export badge distinguishes all three states.
//  15. the minted-by filter filters the TAG only, and a filtered expansion says
//      how many conditions the line really has.
//
// Ticket 298 — every empty result names its verdict:
//  22. 🔑 each of the SEVEN empty verdicts REPLACES the document area with its
//      OWN named sentence — no two alike, and never a blank page.
//  23. ⚠️ `Parked` reads as "the workflow has not shipped yet" — never as a
//      failure, an error or something pending.
//  24. ⚠️ `GaveUp` never reads as success, even though the underlying row has its
//      processed flag set.
//  25. ⚠️ held documents are NOT an empty state: the graph renders in FULL under
//      an attention banner, and the held document is marked on its own card.
//  26. 🔑 a legacy stamp with documents renders everything AND names the
//      disagreement, quoting the offending column value.
//  27. an UNKNOWN verdict code fails loudly rather than rendering blank — with a
//      graph it still draws the graph, without one it names the raw code.
//
// Ticket 300 — the codes render raw with their label as secondary text:
//  16. 🔑 every code renders its RAW value, with the legend's label beside it or
//      on it — the label never REPLACES the code.
//  17. a code the legend does not carry renders alone; nothing is invented.
//  18. ⚠️ the three empty strings render DISTINCTLY — an empty source tag is
//      `unknown`, an empty disc-type code is a NO-MAPPING defect, and the two do
//      not read alike.
//  19. 🔑 `Metadata` is fetched ONCE per session and reused across lookups and
//      document switches.
//  20. a refused `Metadata` costs the labels and NOT the screen — every code is
//      still there, raw.
//  21. the condition-type description comes from the ROW, not from the legend.
//
// Ticket 299 — the verdict strip offers one download per IDoc type present:
//  28. 🔑 one button per IDoc TYPE, on the VERDICT STRIP — never per line, never
//      per document, and two documents of one type are still ONE button.
//  29. no document ⇒ no button and no caveat.
//  30. 🚩 an unbatched document — and a held one — still offer their download:
//      export state changes what the consultant is told, not what they can take.
//  31. ⚠️ the reconstruction caveat is visible beside the buttons, and never
//      claims to be what SAP received.
//  32. 🔑 the file arrives through the blob helper with NO navigation, under the
//      name the server's `Content-Disposition` gave it.
//  33. 🔑 aggregated and financial are TWO downloads yielding TWO files.
//  34. 🔑 a failed download surfaces its BUSINESS message, not a generic error —
//      and a BARE 403 reads as a refusal rather than as a fault.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs) —
// it is NOT a dependency of this repo.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/idoc-inspector-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const URL = BASE + '/reports/idoc-inspector'

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

// Scenario state, mutated between reloads. `accessBody` is the probe's 200
// answer; `accessStatus` lets a scenario refuse the probe itself (an unmarked
// route, or a cookie branch that said no — issue 802), which is a DIFFERENT arm
// from a 200 denial and must read differently.
let scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
// The invoices grant, answered independently: the point of scenario 2 is that
// the two leaves in one nav group move apart.
let invoiceAllowed = true
let accessCalls = 0
// Every `IDocInspector/Transaction` query string seen — 296 asserts this stays
// EMPTY (the slice issues no lookup at all), and 297 will assert what is in it.
let transactionQueries = []
// What `Transaction` answers. 296 never issues one; 297 swaps in a graph.
let transactionBody = { verdict: 'NoSuchTransaction', attention: null, documents: [] }
// ---- ticket 299's download -------------------------------------------------
// Every `IDocInspector/Download` query string seen, and what the route answers.
// `downloadStatus` 200 answers the XML raw — not base64, not enveloped, which is
// the whole reason the client reaches it through the blob helper. Anything else
// is a failure at that status, with `downloadCode` as the envelope's `errorCode`;
// 403 is answered BARE, with no body at all, exactly as the grant filter does.
let downloadQueries = []
let downloadStatus = 200
let downloadCode = null
// ⚠️ The server owns the filename and the client uses what it is given, so the
// stamp here is FIXED rather than "now": a drive that let the client build the
// name would be asserting the fallback rather than the contract. It is named per
// TYPE because the server names it per type — which is what makes two downloads
// two files rather than one file taken twice.
const disposition = (idocType) =>
  `attachment; filename="idoc_${idocType}_S042_00114600051234_20260830-1432.xml"`

// ---- ticket 300's legend ---------------------------------------------------
// ⚠️ A SAMPLE of what `IDocInspector/Metadata` reflects, not a copy of the nine
// vocabularies — the point of the route is that this repo carries no copy. The
// three blanks come first with the server's own names for them, and `hungerstn`
// is deliberately ABSENT so the drive can assert an unknown code renders alone.
let metadataCalls = 0
let metadataStatus = 200
const METADATA = {
  legend: {
    sourceTag: [
      { code: '', name: 'SourceUnknown' },
      { code: 'pos', name: 'Pos' },
    ],
    conditionSource: [
      { code: '', name: 'OriginNotSet' },
      { code: 'M', name: 'Manual' },
      { code: 'B', name: 'BonusBuy' },
    ],
    conditionClass: [
      { code: 'B', name: 'Prices' },
      { code: 'D', name: 'DiscountOrSurcharge' },
    ],
    conditionControl: [
      { code: 'A', name: 'Adjust' },
      { code: 'F', name: 'Fixed' },
    ],
    iDocType: [
      { code: 'AGG', name: 'Aggregation' },
      { code: 'SAPR', name: 'SalesAsPerReceipt' },
      { code: 'FI', name: 'FinancialDocument' },
    ],
    // Reflected from `BillingTypeConstants` server-side, so the `name` is the C#
    // identifier and the `code` is the persisted word.
    billingType: [
      { code: 'STANDARD_POS', name: 'StandardPOS' },
      { code: 'Insurance', name: 'Insurance' },
    ],
    workflowType: [{ code: 'ZAGG', name: 'Aggregated' }],
    paymentGroup: [{ code: '01', name: 'Cash' }],
    errorType: [
      { code: '', name: 'NoError' },
      { code: 'PRICING', name: 'PricingFailure' },
    ],
  },
  registeredWorkflowTypes: ['ZAGG'],
}

// ---- ticket 297's stub graph ---------------------------------------------
// ⚠️ Hand-shaped, not captured: BackOffice 1388 (the route that serves this) is
// open, so there is no real response to record. What a stub cannot prove is that
// the server sends this shape.
const condition = (over = {}) => ({
  seq: 1,
  conditionType: 'ZPR0',
  conditionTypeDescription: 'Base price',
  // 🔑 Arithmetic that holds: 200.00 × 11.5% = 23.00. A stub whose three terms
  // disagree would let a real projection bug read as ordinary.
  conditionBaseValue: 200,
  conditionRate: 11.5,
  conditionRateUnit: '%',
  conditionValue: 23,
  conditionClass: 'B',
  conditionControl: 'A',
  // ⚠️ A REAL mapping by default. An empty `discTypeCode` means *no SAP mapping
  // was found* and is a DEFECT (ticket 300), so it is asked for explicitly below
  // rather than arriving on every condition by accident.
  discTypeCode: '3301',
  sourceTag: 'pos',
  conditionSource: 'B',
  // ⚠️ `false` by default and asked for explicitly: a post condition is ordinary
  // and real, but it is the TINTED one, so it must never arrive by accident.
  isPostCondition: false,
  ...over,
})
const line = (over = {}) => ({
  itemNumber: 1,
  itemTypeCode: 'ZTAN',
  materialNumber: '1000174',
  quantity: 2,
  salesUom: 'EA',
  salesAmount: 23,
  promotionId: '',
  batchNumber: 'B24A917',
  isReturn: false,
  isPostItem: false,
  sourceTag: 'pos',
  conditions: [condition()],
  itemDetails: [{ seq: 1, attributeName: 'PARTNER', attributeValue: '0000401288' }],
  ...over,
})
// ⚠️ Reconciled against the SHIPPED `IDocInspectorDocument` (ticket 300). The
// property is `iDocType`, not `idocType` — SIS.Api sets no naming policy, so the
// Web camelCase pass stops at the first uppercase run followed by a lowercase
// letter. And there is no `paymentGroupId`, `splitAmount` or `splitRatio`: 297
// modelled those from 1381's prototype while 1388 was open, and the payload
// carries none of them. `billingType` was a fourth until the DTO and the
// projection grew it.
const aggDocument = {
  iDocType: 'AGG',
  // ⚠️ A REAL `BillingTypeConstants` member. They are WORDS, not the four-letter
  // SAP codes the rest of this screen carries — a stub spelling it `ZAGG` would
  // pass while telling the screen a lie about the shape of the vocabulary.
  billingType: 'STANDARD_POS',
  receiptNumber: '4211900771',
  pharmacyId: '0421',
  exportState: 'exported',
  // ⚠️ `false` by default and asked for explicitly (ticket 298): a held document
  // is a FINDING, so it must never arrive on a stub by accident.
  isHeld: false,
  batch: { id: 'K7QF2M8ZR41X9S042S_AGG', exportedAt: '2026-08-27T03:10:00' },
  lines: [
    line(),
    // 🔑 The untagged line, and its untagged condition. This is the row the
    // provenance column exists for.
    line({
      itemNumber: 2,
      materialNumber: '1000116',
      sourceTag: '',
      conditions: [condition({ sourceTag: '' })],
      itemDetails: [{ seq: 1, attributeName: 'EMPLOYEE', attributeValue: '20418' }],
    }),
    // A POS line whose FEE condition an enricher minted — the case the filter
    // exists to answer.
    line({
      itemNumber: 3,
      materialNumber: '9000021',
      sourceTag: 'pos',
      conditions: [
        condition(),
        condition({
          seq: 2,
          conditionType: 'COFF',
          conditionTypeDescription: 'Commission fee',
          // 🔑 A PARTNER COMMISSION — added after the original invoice, which is
          // exactly what a post condition is. It sits on an ORDINARY line, which
          // is the pair that proves the two tints are independent.
          isPostCondition: true,
          sourceTag: 'hungerstn',
          conditionSource: 'M',
          conditionClass: 'D',
          conditionControl: 'F',
          // ⚠️ The third first-class empty string: NO SAP mapping was found. A
          // defect, and it must not read like the `unknown` chip beside it.
          discTypeCode: '',
        }),
      ],
    }),
    // 🔑 A POST LINE — added after the original invoice rather than sold at the
    // till. Its own conditions are ORDINARY, which together with the commission
    // on line 3 proves the two tints are independent in BOTH directions.
    line({
      itemNumber: 4,
      materialNumber: '9000044',
      itemTypeCode: 'ZPOS',
      isPostItem: true,
      sourceTag: 'pos',
      itemDetails: [],
    }),
  ],
  payments: [
    {
      seq: 1,
      conditionType: 'CASH',
      typeCode: '3301',
      cardType: '',
      authorizationNo: '',
      amount: 95.4,
    },
  ],
  fiItems: [],
}
const fiDocument = {
  ...aggDocument,
  iDocType: 'FI',
  // The middle export state — sealed into a batch that has not left yet.
  exportState: 'batched-not-exported',
  // ⚠️ The .NET default, NOT null: the batch row's exported-at column is a
  // non-nullable `DateTime`, so this is what an unexported batch really carries.
  batch: { id: 'K7QF2M8ZR41X9S042S_FI', exportedAt: '0001-01-01T00:00:00' },
  // ⚠️ An FI document CAN carry line items. The payments-vs-FI-lines pane is the
  // mutually-exclusive slot; the line table is not part of it.
  lines: [line({ itemNumber: 1, materialNumber: '1000174' })],
  payments: [],
  fiItems: [
    {
      fiTypeNumber: '1',
      glAccount: '410010',
      profitCenter: 'PC0421',
      fiTypeCode: '1302',
      assignment: 'TRX99881',
      amount: 82.96,
    },
  ],
}
const unbatchedDocument = {
  ...aggDocument,
  iDocType: 'SAPR',
  receiptNumber: '4211900772',
  // The 3.1% both existing loaders miss.
  exportState: 'not-batched',
  batch: null,
}
const PROCESSED = {
  verdict: 'Processed',
  attention: null,
  documents: [aggDocument, fiDocument, unbatchedDocument],
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'IDocInspector/Access') {
      accessCalls++
      if (scenario.accessStatus !== 200)
        return route.fulfill(
          envelope(null, { status: scenario.accessStatus, success: false, message: 'Forbidden.' }),
        )
      return route.fulfill(envelope(scenario.accessBody))
    }
    if (path === 'IDocInspector/Metadata') {
      metadataCalls++
      if (metadataStatus !== 200)
        return route.fulfill(
          envelope(null, { status: metadataStatus, success: false, message: 'Forbidden.' }),
        )
      return route.fulfill(envelope(METADATA))
    }
    if (path === 'IDocInspector/Download') {
      const query = url.split('?')[1] || ''
      downloadQueries.push(query)
      // 🚩 A BARE 403: no envelope, no errorCode, no body at all — what the grant
      // filter actually answers.
      if (downloadStatus === 403) return route.fulfill({ status: 403, body: '' })
      if (downloadStatus !== 200)
        return route.fulfill(
          envelope(null, {
            status: downloadStatus,
            success: false,
            message: 'This transaction has no document of that IDoc type.',
            errors: downloadCode
              ? [{ errorCode: downloadCode, internalErrorCode: '', errorMessage: 'download' }]
              : [],
          }),
        )
      const idocType = new URLSearchParams(query).get('idocType') || ''
      // ⚠️ The success body is the XML RAW — not base64, not enveloped. Its single
      // BOM is the server's guarantee (BackOffice 1393) and is asserted there, at
      // the byte level; what a stub can show is that the client saves the bytes
      // it was handed, untouched.
      return route.fulfill({
        status: 200,
        contentType: 'application/xml',
        headers: {
          'Content-Disposition': disposition(idocType),
          'X-IDoc-Inspector-Audit-Id': '01J8ZC9K3M7Q',
        },
        body: Buffer.from(`﻿<?xml version="1.0"?><${idocType}/>`, 'utf8'),
      })
    }
    if (path === 'IDocInspector/Transaction') {
      transactionQueries.push(url.split('?')[1] || '')
      return route.fulfill(envelope(transactionBody))
    }
    if (path === 'RetailInvoice/Access')
      return route.fulfill(envelope({ screenAllowed: invoiceAllowed }))
    // Any other probe/endpoint → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const visit = async (url) => {
    accessCalls = 0
    metadataCalls = 0
    transactionQueries = []
    await page.goto(url)
    await page.waitForLoadState('networkidle')
  }

  const storeField = () => page.getByPlaceholder(/S042/)
  const trxField = () => page.getByPlaceholder(/00114600051234/)
  // ⚠️ `networkidle` is not enough on its own: react-query renders the answer a
  // tick AFTER the response settles, so reading the pane straight afterwards
  // returns the previous verdict (or the shimmer). Without this settle every
  // verdict assertion below passes one answer behind itself, which is a green
  // suite over a screen showing the wrong sentence.
  const lookUp = async () => {
    await page.getByRole('button', { name: /^Look up$/ }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(200)
  }

  // ---- Scenario 1: granted ------------------------------------------------
  scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
  invoiceAllowed = true
  await visit(URL)

  check(
    'granted → the Reports group appears in the menu',
    (await page.getByRole('button', { name: /^Reports$/i }).count()) === 1,
  )
  const leaf = page.getByRole('link', { name: /^IDoc inspector$/i })
  check('granted → the IDoc inspector leaf appears under it', (await leaf.count()) === 1)
  const leafHref = (await leaf.count()) ? await leaf.first().getAttribute('href') : null
  check(
    'granted → the leaf points at /reports/idoc-inspector',
    leafHref === '/reports/idoc-inspector',
    leafHref ?? 'no leaf',
  )

  const main = await page.locator('main').innerText()
  check('granted → the screen renders its title', /IDoc inspector/i.test(main), main.split('\n')[0] || '')
  check(
    'granted → the screen renders its subtitle',
    /SAP rail generated/i.test(main),
    main.slice(0, 140).split('\n').join(' '),
  )
  check(
    '🚩 the screen LANDS EMPTY — the landing state, which is NOT a verdict',
    /Nothing to show yet/i.test(main),
    main.split('\n').join(' ').slice(0, 160),
  )
  check(
    'the lookup bar carries BOTH halves of the key',
    (await storeField().count()) === 1 && (await trxField().count()) === 1,
  )
  check(
    '🚩 focus lands on the store field on mount',
    await storeField().evaluate((el) => el === document.activeElement),
  )
  check(
    '🚩 nothing is looked up on mount — the screen cannot guess a transaction',
    transactionQueries.length === 0,
    transactionQueries.join(' | '),
  )
  check(
    '🚩 the access probe is called ONCE per visit (nav leaf + gate share one key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // 🚩 The namespace is load-bearing and nothing else catches it: unregistered
  // keys render RAW to the user, and i18next's fallback drops the `reports:`
  // prefix — so the tell is the KEY PATH, not the prefix.
  const shellText = await page.locator('body').innerText()
  const rawKey = shellText.match(/(?:^|\s)(?:reports:)?(?:idocInspector|invoice|menu|access)\.[a-zA-Z.]+/)
  check(
    '🚩 no raw i18n keys on the page — the `reports` namespace carries the screen',
    rawKey === null,
    (rawKey || [''])[0],
  )

  // ---- Scenario 6 (here, while granted): the local required-field refusal ---
  // 🚩 A blank store or transaction number is the server's 400 branch. Reaching
  // it would be a client bug, so Look up on an incomplete key issues NOTHING.
  await lookUp()
  let text = await page.locator('main').innerText()
  check(
    '🚩 Look up on an empty form issues NO request',
    transactionQueries.length === 0,
    transactionQueries.join(' | '),
  )
  // ⚠️ Read off the refusal ELEMENT and not the page text: the landing hint says
  // "Enter a store and a transaction number to see the documents…", so a text
  // match for the refusal's own opening words passes with no refusal rendered.
  const refusal = () => page.locator('#idoc-lookup-error')
  check(
    'the empty Look up names BOTH missing halves, locally',
    (await refusal().count()) === 1 &&
      /Enter a store and a transaction number to look one up/i.test(await refusal().innerText()),
    (await refusal().count()) ? await refusal().innerText() : 'no refusal rendered',
  )
  await storeField().fill('S042')
  await lookUp()
  text = await page.locator('main').innerText()
  check(
    '🚩 a store alone still issues nothing, and names the MISSING half only',
    transactionQueries.length === 0 &&
      (await refusal().count()) === 1 &&
      /^Enter a transaction number to look up/i.test(await refusal().innerText()),
    (await refusal().count()) ? await refusal().innerText() : 'no refusal rendered',
  )
  await storeField().fill('')
  await trxField().fill('00114600051234')
  await lookUp()
  text = await page.locator('main').innerText()
  check(
    '🔑 a transaction number alone is refused too — the store is half the key here',
    transactionQueries.length === 0 &&
      (await refusal().count()) === 1 &&
      /^Enter a store —/i.test(await refusal().innerText()),
    (await refusal().count()) ? await refusal().innerText() : 'no refusal rendered',
  )
  await page.getByRole('button', { name: /^Reset$/ }).click()
  text = await page.locator('main').innerText()
  check(
    'Reset returns the screen to the landing state, refusal cleared',
    /Nothing to show yet/i.test(text) &&
      (await refusal().count()) === 0 &&
      (await storeField().inputValue()) === '' &&
      (await trxField().inputValue()) === '',
  )

  // ---- Scenario 2: denied, arriving from elsewhere ------------------------
  // The probe answers a denial with 200 — a boolean to read, never an error to
  // catch — so this is the ORDINARY refusal, not an outage.
  scenario = { accessBody: { screenAllowed: false }, accessStatus: 200 }
  await visit(BASE + '/')
  check(
    '🚩 denied → no IDoc inspector leaf in the menu',
    (await page.getByRole('link', { name: /^IDoc inspector$/i }).count()) === 0,
  )
  check(
    '🔑 …while the Invoices leaf beside it is UNAFFECTED — two grants, one group',
    (await page.getByRole('link', { name: /^Invoices$/i }).count()) === 1,
  )

  // ---- Scenario 3: denied, hand-typed URL ---------------------------------
  // 🚩 The probe only HIDES the menu. A user who pastes the URL reaches the
  // screen and must be told, in words, that they have no access.
  await visit(URL)
  const deniedText = await page.locator('main').innerText()
  check(
    '🚩 hand-typed URL on a denied session → the no-access SENTENCE',
    /No access to the IDoc inspector/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    '🔑 …in the INSPECTOR\'s words, not the invoices screen\'s',
    !/access to invoices/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    '🔑 a denial names the remedy (an administrator) and never a retry',
    /administrator/i.test(deniedText) && !/Try again/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 200),
  )
  check(
    '🚩 denied → NOT an empty screen and NOT a generic error',
    !/Nothing to show yet/i.test(deniedText) && !/unexpected/i.test(deniedText),
    deniedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    'denied → the lookup bar is not rendered at all',
    (await storeField().count()) === 0 && (await trxField().count()) === 0,
  )
  check(
    '🚩 a 200 denial is asked ONCE and never re-asked',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // ---- Scenario 4: the probe itself refuses (403) -------------------------
  // A different arm from a 200 denial: the route is unmarked, or the cookie
  // branch said no (issue 802). Still a REFUSAL rather than an outage, so it
  // must not invite a retry loop against a permanently shut door.
  scenario = { accessBody: null, accessStatus: 403 }
  await visit(URL)
  const refusedText = await page.locator('main').innerText()
  check(
    'a 403 on the probe reads as a refusal, not as "try again in a moment"',
    /No access to the IDoc inspector/i.test(refusedText) && !/Try again/i.test(refusedText),
    refusedText.split('\n').join(' ').slice(0, 160),
  )
  check(
    '🚩 a refused probe is not retried (retry:false travels with the key)',
    accessCalls === 1,
    `${accessCalls} call(s)`,
  )

  // ---- Scenario 5: the probe is unreachable (500) -------------------------
  // The other sentence: an outage the user can retry, distinct from a refusal
  // they cannot. ⚠️ The door is unbuilt today, so this is the arm a real session
  // would hit right now — and it must NOT read as "you lack the grant".
  scenario = { accessBody: null, accessStatus: 500 }
  await visit(URL)
  const downText = await page.locator('main').innerText()
  check(
    'an unreachable probe reads as unavailable (a retry), not as a refusal',
    /unavailable/i.test(downText) && !/No access to the IDoc inspector/i.test(downText),
    downText.split('\n').join(' ').slice(0, 160),
  )
  check(
    'an unreachable probe hides the leaf too — fail-closed, not fail-open',
    (await page.getByRole('link', { name: /^IDoc inspector$/i }).count()) === 0,
  )

  // ---- Ticket 297: the lookup shows the transaction's documents -----------
  scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
  transactionBody = PROCESSED
  await visit(URL)
  await storeField().fill('S042')
  await trxField().fill('00114600051234')
  await lookUp()

  check(
    '🔑 a complete key issues exactly ONE Transaction call — the whole graph, one request',
    transactionQueries.length === 1,
    transactionQueries.join(' | '),
  )
  check(
    'the call carries BOTH halves of the key, under the names the contract binds',
    /storeCode=S042/.test(transactionQueries[0] || '') &&
      /trxNumber=00114600051234/.test(transactionQueries[0] || ''),
    transactionQueries[0] || 'no call',
  )

  const cards = page.locator('[data-document-card]')
  check(
    'aLookupRendersOneTabPerGeneratedIDocType — one rail card per document',
    (await cards.count()) === 3,
    `${await cards.count()} card(s)`,
  )
  const railText = await cards.allInnerTexts()
  check(
    '…and every generated IDoc TYPE is on the rail, raw',
    /AGG/.test(railText.join(' ')) &&
      /FI/.test(railText.join(' ')) &&
      /SAPR/.test(railText.join(' ')),
    railText.join(' | ').replace(/\n/g, ' '),
  )

  check(
    'theExportStateBadgeDistinguishesAllThreeStates — three states, three sentences',
    /Exported/.test(railText[0]) &&
      /Batched, not exported/.test(railText[1]) &&
      /Not batched/.test(railText[2]),
    railText.join(' | ').replace(/\n/g, ' '),
  )
  check(
    '🔑 "batched, not exported" is NOT drawn as exported — the state a boolean loses',
    !/^Exported$/m.test(railText[1]),
    railText[1].replace(/\n/g, ' '),
  )

  // ---- the untagged row ---------------------------------------------------
  const paneText = () => page.locator('main').innerText()
  let bodyText = await paneText()
  const unknownChips = page.locator('[data-source-tag="unknown"]')
  check(
    'anEmptySourceTagRendersAsUnknownNotAsPos — the dimmed `unknown` chip is drawn',
    (await unknownChips.count()) >= 1,
    `${await unknownChips.count()} unknown chip(s)`,
  )
  check(
    '⚠️ …and the untagged LINE is not labelled `pos` — the substitution has no path',
    await page
      .locator('[data-line="2"]')
      .evaluate((row) => row.querySelector('[data-source-tag="pos"]') === null),
  )

  // ---- opening a line -----------------------------------------------------
  const requestsBefore = transactionQueries.length
  await page.locator('[data-line="1"]').click()
  await page.waitForTimeout(120)
  check(
    'openingALineShowsItsConditionsAndItemDetailsInPlace — the expansion appears',
    (await page.locator('[data-line-expansion="1"]').count()) === 1,
  )
  const expansionText = (await page.locator('[data-line-expansion="1"]').count())
    ? await page.locator('[data-line-expansion="1"]').innerText()
    : ''
  check(
    '…carrying the conditions of that line',
    /conditions/i.test(expansionText) && /ZPR0/.test(expansionText),
    expansionText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '…and its ITEM DETAILS, in the same disclosure — never a third level',
    /item details/i.test(expansionText) && /PARTNER/.test(expansionText),
    expansionText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '⚠️ the batch on the line is named as a batch (CHARG), not as an IDoc batch',
    /CHARG/i.test(expansionText),
    expansionText.replace(/\n/g, ' ').slice(0, 200),
  )
  // ---- post items and post conditions ------------------------------------
  // Added AFTER the original invoice (a partner commission, say). Tinted so they
  // can be scanned, and NAMED so the tint is never the only carrier.
  const postLine = page.locator('[data-line="4"][data-post-item="true"]')
  check(
    'a POST line is marked as post — and marked in WORDS, not by colour alone',
    (await postLine.count()) === 1 && /Post/.test(await postLine.innerText()),
    (await postLine.count()) ? (await postLine.innerText()).split('\n').join(' ') : 'no post line',
  )
  check(
    '⚠️ an ORDINARY line carries no post mark — the flag is read, not assumed',
    (await page.locator('[data-line="1"][data-post-item="true"]').count()) === 0 &&
      !/Post/.test(await page.locator('[data-line="1"]').innerText()),
    (await page.locator('[data-line="1"]').innerText()).split('\n').join(' ').slice(0, 120),
  )
  // 🔑 The independence, both ways: a POST CONDITION on an ORDINARY line.
  await page.locator('[data-line="3"]').click()
  await page.waitForTimeout(150)
  check(
    '🔑 a post CONDITION is tinted on an ordinary line — the two flags are independent',
    (await page.locator('[data-condition="2"][data-post-condition="true"]').count()) === 1 &&
      (await page.locator('[data-line="3"][data-post-item="true"]').count()) === 0,
    'commission on a till-sold line',
  )
  check(
    '⚠️ …and the ordinary condition beside it is NOT tinted',
    (await page.locator('[data-condition="1"][data-post-condition="true"]').count()) === 0,
    'seq 1 untinted',
  )
  await page.locator('[data-line="3"]').click()
  await page.waitForTimeout(150)

  check(
    'a condition shows the BASE the rate was applied to, so the row can be checked',
    /Base/i.test(expansionText) && /200\.00/.test(expansionText),
    expansionText.replace(/\n/g, ' ').slice(0, 260),
  )
  check(
    '⚠️ …and the rate carries its UNIT beside it — `11.50` alone is percent or riyals',
    /11\.50\s*%/.test(expansionText.replace(/\n/g, ' ')),
    expansionText.replace(/\n/g, ' ').slice(0, 260),
  )
  check(
    '🚩 IN PLACE — the expansion is a row of the SAME table as the line it opened',
    await page.evaluate(() => {
      const row = document.querySelector('[data-line="1"]')
      const exp = document.querySelector('[data-line-expansion="1"]')
      return !!row && !!exp && row.closest('table') === exp.closest('table')
    }),
  )
  check(
    '🔑 opening a line touches NO network — the graph arrived in one call',
    transactionQueries.length === requestsBefore,
    `${transactionQueries.length - requestsBefore} extra call(s)`,
  )
  await page.locator('[data-line="1"]').click()
  await page.waitForTimeout(120)
  check(
    'the line closes again — disclosure, and nothing auto-opens',
    (await page.locator('[data-line-expansion="1"]').count()) === 0,
  )

  // ---- the minted-by filter ----------------------------------------------
  check(
    'the filter bar offers the tags present, including `unknown`',
    (await page.locator('[data-minted-by="hungerstn"]').count()) === 1 &&
      (await page.locator('[data-minted-by="unknown"]').count()) === 1,
  )
  await page.locator('[data-minted-by="hungerstn"]').click()
  await page.waitForTimeout(120)
  check(
    '🔑 a line survives on the tag of its CONDITION, not only its own',
    (await page.locator('[data-line]').count()) === 1 &&
      (await page.locator('[data-line="3"]').count()) === 1,
    `${await page.locator('[data-line]').count()} line(s) shown`,
  )
  await page.locator('[data-line="3"]').click()
  await page.waitForTimeout(120)
  const filteredExpansion = await page.locator('[data-line-expansion="3"]').innerText()
  check(
    '🚩 a filtered expansion says `1 of 2` — never a line that only ever had one condition',
    /1 of 2/i.test(filteredExpansion),
    filteredExpansion.replace(/\n/g, ' ').slice(0, 160),
  )
  await page.locator('[data-minted-by-clear]').click()
  await page.waitForTimeout(120)
  check(
    'clearing the filter restores every line',
    // Four since the post line joined the stub: an ordinary line, the untagged
    // one, the one carrying the commission, and the post line itself.
    (await page.locator('[data-line]').count()) === 4,
    `${await page.locator('[data-line]').count()} line(s)`,
  )
  // Leave a filter ON across the document switch below — the trap is a filter
  // that survives onto a document whose bar has no button to clear it with.
  await page.locator('[data-minted-by="hungerstn"]').click()
  await page.waitForTimeout(120)

  // ---- payments and FI lines carry no provenance --------------------------
  const payments = page.locator('[data-pane="payments"]')
  const paymentsText = (await payments.count()) ? await payments.innerText() : ''
  check(
    'paymentAndFiRowsShowNoProvenanceColumn — the payments pane has NO Minted by column',
    (await payments.count()) === 1 && !/minted by/i.test(paymentsText),
    paymentsText.replace(/\n/g, ' ').slice(0, 160) || 'no pane',
  )
  check(
    '🔑 …and SAYS these rows carry none, rather than drawing an empty column',
    /carry no source tag at all/i.test(paymentsText),
    paymentsText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '…while the LINE table beside it does carry the column',
    /minted by/i.test(await page.locator('table').first().innerText()),
  )

  const selectBefore = transactionQueries.length
  await page.locator('[data-document-card="1"]').click()
  await page.waitForTimeout(150)
  check(
    '🔑 selecting a document touches NO network either',
    transactionQueries.length === selectBefore,
    `${transactionQueries.length - selectBefore} extra call(s)`,
  )
  const paneAfterSwitch = await paneText()
  check(
    '⚠️ an unexported batch says so — never the .NET default date the column carries',
    /Not exported/.test(paneAfterSwitch) && !/0001-01-01/.test(paneAfterSwitch),
    paneAfterSwitch.replace(/\n/g, ' ').slice(0, 220),
  )
  check(
    '🚩 switching documents clears the filter — a filter with no button left to clear it is a trap',
    (await page.locator('[data-minted-by-clear]').count()) === 0,
  )

  const fiPane = page.locator('[data-pane="fi"]')
  const fiText = (await fiPane.count()) ? await fiPane.innerText() : ''
  check(
    'the FI document shows its FI lines — one pane, never two with one empty',
    (await fiPane.count()) === 1 &&
      (await page.locator('[data-pane="payments"]').count()) === 0 &&
      /410010/.test(fiText),
    fiText.replace(/\n/g, ' ').slice(0, 160) || 'no FI pane',
  )
  check(
    '⚠️ an FI document KEEPS its line items — the pane is the exclusive slot, the table is not',
    (await page.locator('[data-line]').count()) === 1,
    `${await page.locator('[data-line]').count()} line(s) on the FI document`,
  )
  check(
    '🔑 the FI pane has no provenance column either, and says so',
    !/minted by/i.test(fiText) && /carry no source tag at all/i.test(fiText),
    fiText.replace(/\n/g, ' ').slice(0, 160),
  )

  // ---- the re-ask rule ----------------------------------------------------
  const beforeReask = transactionQueries.length
  await lookUp()
  check(
    '🚩 Look up on the SAME key RE-ASKS the server rather than answering from cache',
    transactionQueries.length === beforeReask + 1,
    `${transactionQueries.length - beforeReask} call(s)`,
  )

  // ---- an answer with no documents ---------------------------------------
  // ⚠️ The sentence is ticket 298's — this verdict's OWN, not one placeholder
  // standing in for ten. What 297 asserts here is the frame: an empty answer is
  // never a blank page, and never the LANDING state, which on this screen means
  // something else entirely.
  transactionBody = { verdict: 'Parked', attention: null, documents: [] }
  await trxField().fill('00114600059999')
  await lookUp()
  bodyText = await paneText()
  check(
    'an answer with no documents is a sentence, not a blank page',
    /has not shipped yet/i.test(bodyText) && !/Nothing to show yet/i.test(bodyText),
    bodyText.replace(/\n/g, ' ').slice(0, 200),
  )
  check(
    '…and no rail is drawn over it',
    (await page.locator('[data-document-card]').count()) === 0,
  )

  // ---- Ticket 300: the codes render raw, with their label beside them -----
  transactionBody = PROCESSED
  metadataStatus = 200
  await visit(URL)
  await storeField().fill('S042')
  await trxField().fill('00114600051234')
  await lookUp()

  check(
    '🔑 theLegendIsFetchedOncePerSessionAndReused — ONE Metadata call for the whole visit',
    metadataCalls === 1,
    `${metadataCalls} call(s)`,
  )

  const railNow = await page.locator('[data-document-card]').allInnerTexts()
  check(
    '🔑 everyCodeRendersItsRawValue — the IDoc type shows AGG *and* its label',
    /AGG/.test(railNow[0]) && /Aggregation/.test(railNow[0]),
    railNow[0].replace(/\n/g, ' '),
  )
  check(
    '⚠️ …and the label never REPLACES the code — a consultant pastes the code',
    /AGG/.test(railNow[0]) &&
      /SAPR/.test(railNow.join(' ')) &&
      /SalesAsPerReceipt/.test(railNow.join(' ')),
    railNow.join(' | ').replace(/\n/g, ' '),
  )

  const strip = await page.locator('main').innerText()
  check(
    '…the document strip carries the same code + label pair',
    /IDoc type/i.test(strip) && /Aggregation/.test(strip),
    strip.replace(/\n/g, ' ').slice(0, 220),
  )
  check(
    '🚩 the two fields the payload STILL does not carry are gone — no `undefined`, no `0%` split',
    !/undefined/i.test(strip) && !/Payment group/i.test(strip) && !/split/i.test(strip),
    strip.replace(/\n/g, ' ').slice(0, 260),
  )
  check(
    'the billing type is on the strip, raw, with the legend’s label beside it',
    /Billing type/i.test(strip) &&
      /STANDARD_POS/.test(strip) &&
      /StandardPOS/.test(strip),
    strip.replace(/\n/g, ' ').slice(0, 260),
  )

  // The three empty strings and the unknown code, side by side on one open line.
  await page.locator('[data-line="3"]').click()
  await page.waitForTimeout(150)

  // A tag the legend does not carry — nothing is invented for it. It lives on the
  // open line's second condition, which is why the line is opened first.
  const knownTag = page.locator('[data-source-tag="pos"]').first()
  const unknownToLegend = page.locator('[data-source-tag="hungerstn"]').first()
  check(
    'a tag the legend DOES carry gets its label',
    (await knownTag.getAttribute('data-source-tag-label')) === 'Pos',
    String(await knownTag.getAttribute('data-source-tag-label')),
  )
  check(
    '⚠️ aCodeWithNoLabelRendersAlone — an unknown code keeps its value and invents no label',
    (await unknownToLegend.count()) === 1 &&
      (await unknownToLegend.getAttribute('data-source-tag-label')) === null &&
      (await unknownToLegend.innerText()) === 'hungerstn',
    String(await unknownToLegend.getAttribute('data-source-tag-label')),
  )
  const exp3 = await page.locator('[data-line-expansion="3"]').innerText()
  check(
    '🔑 conditionTypeDescriptionComesFromTheRowNotTheLegend — the row\'s own description renders',
    /COFF/.test(exp3) && /Commission fee/.test(exp3),
    exp3.replace(/\n/g, ' ').slice(0, 200),
  )
  check(
    'the condition CLASS and CONTROL ride as marks carrying the legend\'s names',
    (await page.locator('[data-code-mark="conditionClass:D"]').count()) === 1 &&
      (await page.locator('[data-code-mark="conditionClass:D"]').getAttribute('title')) ===
        'DiscountOrSurcharge',
    String(await page.locator('[data-code-mark="conditionClass:D"]').getAttribute('title')),
  )
  check(
    '⚠️ theThreeMeaningsOfEmptyStringRenderDistinctly — an unmapped disc code is a NO-MAPPING defect',
    (await page.locator('[data-disc-type="unmapped"]').count()) === 1 &&
      /no mapping/i.test(await page.locator('[data-disc-type="unmapped"]').innerText()),
    (await page.locator('[data-disc-type="unmapped"]').innerText()) || 'not drawn',
  )
  check(
    '…and it does NOT read like the empty SOURCE TAG beside it — two blanks, two sentences',
    (await page.locator('[data-disc-type="unmapped"]').innerText()) !==
      (await page.locator('[data-source-tag="unknown"]').first().innerText()),
  )

  const switchBefore = metadataCalls
  await page.locator('[data-document-card="1"]').click()
  await page.waitForTimeout(150)
  await lookUp()
  // Review follow-up: the minted-by buttons are a source-tag render site too, and
  // an unlabelled code must get no tooltip rather than one echoing itself.
  check(
    'the minted-by button names its tag from the legend',
    (await page.locator('[data-minted-by="pos"]').getAttribute('title')) === 'Pos',
    String(await page.locator('[data-minted-by="pos"]').getAttribute('title')),
  )
  check(
    '⚠️ …and a tag the legend does not carry gets NO tooltip — never the code echoed back',
    (await page.locator('[data-minted-by="hungerstn"]').getAttribute('title')) === null,
    String(await page.locator('[data-minted-by="hungerstn"]').getAttribute('title')),
  )

  check(
    '🔑 …and it is NOT re-fetched by a second lookup or a document switch',
    metadataCalls === switchBefore,
    `${metadataCalls - switchBefore} extra call(s)`,
  )

  // ---- a refused legend costs the labels and NOT the screen ---------------
  metadataStatus = 403
  await visit(URL)
  await storeField().fill('S042')
  await trxField().fill('00114600051234')
  await lookUp()
  // Open a line, so the assertion reaches the CONDITION codes too and not only
  // the rail's — the legend is absent at every depth or at none.
  await page.locator('[data-line="1"]').click()
  await page.waitForTimeout(150)
  const noLegend = await page.locator('main').innerText()
  check(
    '⚠️ a refused Metadata still renders every RAW code — labels are decoration, codes are not',
    /AGG/.test(noLegend) && /ZPR0/.test(noLegend) && !/Aggregation/.test(noLegend),
    noLegend.replace(/\n/g, ' ').slice(0, 220),
  )
  check(
    '…and the screen is not an error and not empty',
    (await page.locator('[data-document-card]').count()) === 3 && !/unexpected/i.test(noLegend),
  )
  metadataStatus = 200

  // ---- Ticket 298: the ten verdicts ---------------------------------------
  // 🔑 A lookup that finds nothing NEVER shows a blank page. Every one of these
  // is a 200 carrying a machine code; the wording is entirely this repo's.
  scenario = { accessBody: { screenAllowed: true }, accessStatus: 200 }
  await visit(URL)

  // 🚩 The key is held CONSTANT across these scenarios on purpose — what changes
  // is the server's ANSWER — so every Look up here is a re-ask of the same key,
  // which is the path that would answer from cache if `onLookup` did not refetch.
  const askFor = async (body) => {
    transactionBody = body
    await storeField().fill('S042')
    await trxField().fill('00114600051234')
    await lookUp()
    return await page.locator('main').innerText()
  }
  const verdictBlock = () => page.locator('[data-verdict]')

  const EMPTY_VERDICTS = [
    'Parked',
    'Queued',
    'Retrying',
    'GaveUp',
    'Legacy',
    'StampedNotEnqueued',
    'NoSuchTransaction',
  ]
  const said = {}
  for (const verdict of EMPTY_VERDICTS) {
    await askFor({ verdict, attention: null, documents: [] })
    const block = (await verdictBlock().count()) === 1 ? await verdictBlock().innerText() : ''
    said[verdict] = block
    check(
      'eachVerdictCodeMapsToItsOwnCopy - ' + verdict + ' replaces the document area',
      (await verdictBlock().getAttribute('data-verdict')) === verdict &&
        block.trim().length > 40 &&
        // The graph is GONE, not merely empty: the verdict IS the document area.
        (await page.locator('[data-document-card]').count()) === 0,
      block.replace(/\n/g, ' ').slice(0, 120),
    )
  }
  check(
    '🔑 …and no two of the seven say the same thing',
    new Set(Object.values(said)).size === EMPTY_VERDICTS.length,
    new Set(Object.values(said)).size + ' distinct of ' + EMPTY_VERDICTS.length,
  )

  check(
    '⚠️ parkedReadsAsNotYetShippedNotAsFailure',
    /has not shipped yet/i.test(said.Parked) && !/fail|error|pending/i.test(said.Parked),
    said.Parked.replace(/\n/g, ' ').slice(0, 200),
  )
  check(
    '⚠️ gaveUpDoesNotReadAsSuccess - the processed flag is named, never celebrated',
    !/\b(success|delivered|complete|finished|done|sent)\b/i.test(said.GaveUp) &&
      /processed flag/i.test(said.GaveUp),
    said.GaveUp.replace(/\n/g, ' ').slice(0, 220),
  )

  // ---- held documents are NOT an empty state ------------------------------
  const heldText = await askFor({
    verdict: 'ProcessedWithHeldDocuments',
    attention: null,
    documents: [
      { ...aggDocument, exportState: 'not-batched', batch: null, isHeld: true },
      fiDocument,
    ],
  })
  check(
    '⚠️ heldDocumentsRenderInFullUnderABanner - the graph renders, in full',
    (await page.locator('[data-document-card]').count()) === 2,
    (await page.locator('[data-document-card]').count()) + ' card(s)',
  )
  check(
    '…under an ATTENTION banner, which is not an error banner',
    (await page.locator('[data-attention="held"]').count()) === 1 &&
      (await page.locator('[role="alert"]').count()) === 0,
    heldText.replace(/\n/g, ' ').slice(0, 200),
  )
  check(
    '🔑 …and WHICH document is held is marked on its card',
    (await page.locator('[data-held]').count()) === 1 &&
      (await page.locator('[data-held="0"]').count()) === 1,
    (await page.locator('[data-held]').count()) + ' marked',
  )

  // ---- the tenth verdict: documents outrank the export-version column ------
  await askFor({
    verdict: 'ProcessedButStampedLegacy',
    attention: { code: 'EXPORT_VERSION_DISAGREES', exportVersion: 'L' },
    documents: [aggDocument, fiDocument, unbatchedDocument],
  })
  check(
    '🔑 aLegacyStampWithDocumentsRendersEverythingAndNamesTheDisagreement',
    (await page.locator('[data-document-card]').count()) === 3,
    (await page.locator('[data-document-card]').count()) + ' card(s)',
  )
  const disagree = page.locator('[data-attention="disagreement"]')
  const disagreeText = (await disagree.count()) ? await disagree.innerText() : 'no banner'
  check(
    '…and the banner names the disagreement AND quotes the offending value',
    (await disagree.count()) === 1 && /column says L\b/.test(disagreeText),
    disagreeText.replace(/\n/g, ' ').slice(0, 220),
  )
  check(
    '⚠️ …and it diagnoses nothing and offers no repair',
    /names the disagreement/i.test(disagreeText) &&
      (await disagree.locator('button').count()) === 0,
    disagreeText.replace(/\n/g, ' ').slice(-120),
  )
  await askFor({
    verdict: 'ProcessedButStampedLegacy',
    attention: { code: 'EXPORT_VERSION_DISAGREES', exportVersion: '' },
    documents: [aggDocument],
  })
  check(
    '🚩 a NULL column is quoted as EMPTY, never as an invented stamp',
    /column is empty/i.test(await disagree.innerText()),
    (await disagree.innerText()).replace(/\n/g, ' ').slice(0, 180),
  )

  // ---- an unrecognised code fails loudly ----------------------------------
  const unknownEmpty = await askFor({
    verdict: 'PartiallyReconciled',
    attention: null,
    documents: [],
  })
  check(
    '⚠️ anUnknownVerdictCodeFailsLoudlyRatherThanRenderingBlank',
    (await verdictBlock().getAttribute('data-verdict-known')) === 'false' &&
      /PartiallyReconciled/.test(unknownEmpty),
    unknownEmpty.replace(/\n/g, ' ').slice(0, 220),
  )
  check(
    '…and it does NOT borrow one of the ten sentences',
    !/has not shipped yet/i.test(unknownEmpty) && !/legacy IDoc uploader/i.test(unknownEmpty),
    unknownEmpty.replace(/\n/g, ' ').slice(0, 200),
  )
  await askFor({ verdict: 'PartiallyReconciled', attention: null, documents: [aggDocument] })
  check(
    '🔑 an unknown verdict WITH a graph still draws the graph, under the loud banner',
    (await page.locator('[data-document-card]').count()) === 1 &&
      (await page.locator('[data-attention="unknownVerdict"]').count()) === 1,
    String(await page.locator('[data-document-card]').count()),
  )

  // 🚩 A finding attached to an EMPTY verdict still renders. The banners live
  // above the branch rather than inside the documents half, so a block the server
  // hangs on a verdict with nothing to draw is not silently dropped — which a pure
  // test cannot see, because it is a layout decision.
  const emptyWithFinding = await askFor({
    verdict: 'Legacy',
    attention: { code: 'SOMETHING_NEW', exportVersion: null },
    documents: [],
  })
  check(
    '🚩 an attention block on an EMPTY verdict is still drawn, above the named verdict',
    (await page.locator('[data-attention="unknownAttention"]').count()) === 1 &&
      /legacy IDoc uploader/i.test(emptyWithFinding),
    emptyWithFinding.replace(/\n/g, ' ').slice(0, 220),
  )

  // ==========================================================================
  // Ticket 299 — the verdict strip offers one download per IDoc type present.
  // ==========================================================================
  const downloadButton = (idocType) =>
    page.getByRole('button', {
      name: new RegExp(`Download the ${idocType} XML for this transaction`),
    })

  /**
   * Click a type's Download and wait for whatever it produces — the file save, or
   * the sentence that says why there is none.
   *
   * ⚠️ The download event is awaited alongside the click rather than after it: a
   * save fires as soon as the bytes land, and Playwright drops an event nobody
   * was listening for.
   */
  const clickDownload = async (idocType) => {
    const save = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
    await downloadButton(idocType).click()
    const saved = await save
    await page.waitForTimeout(150)
    return saved
  }

  // ---- one button per TYPE present ----------------------------------------
  downloadQueries = []
  await askFor(PROCESSED)
  check(
    '🔑 one download button per IDoc TYPE present — AGG, FI and SAPR',
    (await page.locator('[data-download-type]').count()) === 3 &&
      (await page.locator('[data-download-type="AGG"]').count()) === 1 &&
      (await page.locator('[data-download-type="FI"]').count()) === 1 &&
      (await page.locator('[data-download-type="SAPR"]').count()) === 1,
    (await page.locator('[data-download-type]').allTextContents()).join(' | '),
  )
  check(
    '🚩 the buttons sit on the VERDICT STRIP — not on a card and not on a line',
    (await page.locator('[data-verdict] [data-download-type]').count()) === 3,
  )
  check(
    '🚩 no download button on a document card or inside a line',
    (await page.locator('[data-document-card] [data-download-type]').count()) === 0,
  )
  check(
    '⚠️ the reconstruction caveat is shown BESIDE the buttons, not behind a hover',
    /rebuilt from the database rows as they stand now/i.test(
      await page.locator('[data-download-caveat]').innerText(),
    ),
    await page.locator('[data-download-caveat]').innerText(),
  )
  check(
    '…and it never claims to be what SAP received',
    /not the file SAP received/i.test(await page.locator('[data-download-caveat]').innerText()),
  )
  check(
    '🚩 the button carries the RAW type code, per ticket 300’s rule for the screen',
    /AGG/.test(await page.locator('[data-download-type="AGG"]').innerText()),
    await page.locator('[data-download-type="AGG"]').innerText(),
  )

  // ---- two documents of ONE type are still ONE download --------------------
  await askFor({
    verdict: 'Processed',
    attention: null,
    documents: [aggDocument, { ...aggDocument, receiptNumber: '4211900999' }],
  })
  check(
    '🔑 two documents of the SAME type offer ONE download, not two',
    (await page.locator('[data-download-type]').count()) === 1 &&
      (await page.locator('[data-document-card]').count()) === 2,
    `${await page.locator('[data-download-type]').count()} button(s)`,
  )

  // ---- an unbatched document still offers its download ---------------------
  await askFor({ verdict: 'Processed', attention: null, documents: [unbatchedDocument] })
  check(
    '🚩 an UNBATCHED document still offers its download — export state changes the telling, not the taking',
    (await page.locator('[data-download-type="SAPR"]').count()) === 1 &&
      !(await page.locator('[data-download-type="SAPR"]').isDisabled()),
  )
  // …and a HELD one too. A held document is a finding, never a refusal.
  await askFor({
    verdict: 'ProcessedWithHeldDocuments',
    attention: { code: 'DOCUMENTS_HELD', exportVersion: null },
    documents: [{ ...aggDocument, isHeld: true, exportState: 'not-batched', batch: null }],
  })
  check(
    '🚩 a HELD document still offers its download',
    (await page.locator('[data-download-type="AGG"]').count()) === 1 &&
      !(await page.locator('[data-download-type="AGG"]').isDisabled()),
  )

  // ---- no documents ⇒ no download button ----------------------------------
  await askFor({ verdict: 'NoSuchTransaction', attention: null, documents: [] })
  check(
    '🔑 no download button appears when no documents exist',
    (await page.locator('[data-download-type]').count()) === 0 &&
      (await page.locator('[data-download-caveat]').count()) === 0,
  )
  // …and the strip's OWN guard, which the empty verdict above cannot reach: a
  // graph renders, but every document carries a blank IDoc type. ⚠️ `idocType` is
  // REQUIRED on the wire, so a button here could only ever produce
  // `400 IDOC_TYPE_REQUIRED` — a refusal the screen would have offered itself.
  await askFor({
    verdict: 'Processed',
    attention: null,
    documents: [{ ...aggDocument, iDocType: '' }],
  })
  check(
    '⚠️ a graph whose documents carry NO IDoc type offers no button and no caveat',
    (await page.locator('[data-document-card]').count()) === 1 &&
      (await page.locator('[data-download-type]').count()) === 0 &&
      (await page.locator('[data-download-caveat]').count()) === 0,
  )

  // ---- the download itself -------------------------------------------------
  await askFor(PROCESSED)
  downloadQueries = []
  const urlBeforeDownload = page.url()
  const savedAgg = await clickDownload('AGG')
  check(
    '🔑 clicking AGG saves a file — through the blob helper, with no navigation',
    savedAgg !== null && page.url() === urlBeforeDownload,
    savedAgg ? savedAgg.suggestedFilename() : 'no download event',
  )
  check(
    '⚠️ the FILENAME is the server’s, off Content-Disposition — the client builds none',
    savedAgg !== null && savedAgg.suggestedFilename() === 'idoc_AGG_S042_00114600051234_20260830-1432.xml',
    savedAgg ? savedAgg.suggestedFilename() : 'no download event',
  )
  check(
    '🔑 the request carries the key AND the required idocType, and nothing else',
    downloadQueries.length === 1 &&
      downloadQueries[0].includes('storeCode=S042') &&
      downloadQueries[0].includes('trxNumber=00114600051234') &&
      downloadQueries[0].includes('idocType=AGG') &&
      downloadQueries[0].split('&').length === 3,
    downloadQueries.join(' | '),
  )
  check(
    '🚩 the successful download said nothing — no error beside the buttons',
    (await page.locator('[data-download-error]').count()) === 0,
  )

  // ---- two types are TWO downloads, never a bundle -------------------------
  const savedFi = await clickDownload('FI')
  check(
    '🔑 aggregated and financial are TWO downloads yielding TWO files — never a bundle',
    savedFi !== null &&
      savedAgg !== null &&
      savedFi.suggestedFilename() !== savedAgg.suggestedFilename() &&
      downloadQueries.length === 2 &&
      downloadQueries[1].includes('idocType=FI'),
    downloadQueries.join(' | '),
  )

  // ---- a failure reads as a business message ------------------------------
  downloadStatus = 404
  downloadCode = 'IDOC_TYPE_NOT_PRESENT'
  const failedSave = await clickDownload('AGG')
  const errorFor = async (idocType) => {
    const line = page.locator(`[data-download-error-type="${idocType}"]`)
    return (await line.count()) === 1 ? await line.innerText() : ''
  }
  const failureText = await errorFor('AGG')
  check(
    '🔑 a failed download surfaces its BUSINESS message, not a generic error',
    failedSave === null &&
      /no document of that IDoc type/i.test(failureText) &&
      !/could not be produced/i.test(failureText),
    failureText.replace(/\n/g, ' ').slice(0, 200),
  )
  check(
    '…and it names WHICH type failed, because three buttons sit beside it',
    /AGG/.test(failureText),
    failureText.replace(/\n/g, ' ').slice(0, 120),
  )
  check(
    '🚩 a failed download leaves the buttons live — the button IS the retry',
    !(await page.locator('[data-download-type="AGG"]').isDisabled()),
  )

  // ⚠️ A BARE 403 carries no envelope and no code, so there is no server sentence
  // to prefer — reading its "unexpected status" message would tell a refused user
  // something went wrong when in fact they were told no.
  downloadStatus = 403
  downloadCode = null
  await clickDownload('FI')
  const downloadRefusedText = await errorFor('FI')
  check(
    '⚠️ a BARE 403 on the download reads as a refusal, not as a generic failure',
    /don.t have access/i.test(downloadRefusedText),
    downloadRefusedText.replace(/\n/g, ' ').slice(0, 160),
  )
  check(
    '🚩 two types failing for DIFFERENT reasons both keep saying so — one slot would erase one',
    (await page.locator('[data-download-error]').count()) === 2 &&
      /no document of that IDoc type/i.test(await errorFor('AGG')) &&
      /don.t have access/i.test(await errorFor('FI')),
    `${await page.locator('[data-download-error]').count()} message(s)`,
  )

  // ---- a fresh ANSWER clears the failures ---------------------------------
  // 🚩 Look up on the SAME key takes the refetch path — nothing unmounts — so a
  // stale failure would otherwise sit under a graph that just came back clean.
  downloadStatus = 200
  downloadCode = null
  await lookUp()
  check(
    '🚩 a fresh answer clears the previous download failures',
    (await page.locator('[data-download-error]').count()) === 0 &&
      (await page.locator('[data-download-type]').count()) === 3,
  )

  // Back to the ordinary answer, so the raw-key sweep below reads a full graph.
  await askFor(PROCESSED)

  const graphKeys = (await page.locator('body').innerText()).match(
    /(?:^|\s)(?:reports:)?idocInspector\.[a-zA-Z.]+/,
  )
  check(
    '🚩 no raw i18n keys on the rendered graph either',
    graphKeys === null,
    (graphKeys || [''])[0],
  )

  // The denied/refused scenarios answer non-2xx on purpose, which the browser
  // logs as a resource-load failure — expected, not an app fault.
  // …and 299's download scenarios add a deliberate 404 (a type not present) to
  // that list.
  const realErrors = errors.filter((e) => !/status of (403|404|500)/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
