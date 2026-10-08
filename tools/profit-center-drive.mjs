// Profit center drive (spec 308, ticket 314) — drives the REAL app in Chromium against STUBBED
// envelopes shaped exactly as BackOffice 1990 records them under `## Web contract`:
// `GET CollectionWeb/Collections` and `GET CollectionWeb/Attempts` rows gain `profitCenter` +
// `storeText`; `GET CollectionWeb/AcrForm/{acrId}`'s `pages[].rows[]` and
// `GET CollectionWeb/Receipt/{id}`'s `pages[]` gain `storeText`.
//
// ⚠️ Stubbed, never live: no SIS.Api with 1990 is up for this wave, and the owner's Plants
// `ProfitCenter` column is the 1997 cutover's — a live door would answer `profitCenter: ""` on
// every row. The documents are the app's own `acr-fixture.ts` / `voucher-fixture.ts`, loaded
// through the dev server, so there is no second transcription; the contract's own samples are
// served beside them VERBATIM.
//
// Verifies ticket 314's screen Proof:
//   1. Collections: a Profit Center column on the DEFAULT grid, after finance's nine, drawing
//      the raw `profitCenter` as sent — `PH-019`, or blank (2026-10-03: the store code is already
//      on the grid); the composed `storeText` in the More-columns tail;
//   2. the ACRs' per-row data — the Collections door under `?acr=` — carries the same column;
//   3. Attempts: the same column beside Store Code, the raw value in the tail;
//   4. the CSV of both writes the pair, wrapped so a bare code keeps its zeros;
//   5. loading, empty, error (500), refusal (a 400 envelope) and a bare 403 on both lists;
//   6. the ACR form's رقم الصيدلية prints `storeText` in reading order (LTR inside the RTL row),
//      wraps inside its 52px cell rather than overflowing, and the sheet still breaks on A4 as
//      before; the voucher's Store. line prints it on one line, clear of the title block, on
//      one A4; the contract's own samples render as sent; a server without 1990 (no
//      `storeText` at all) prints the code as before; a miss is still the miss;
//   7. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/profit-center-drive.mjs
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const COLUMN = 'Profit Center (Store)'
const RAW = 'Profit Center'

// 210mm / 297mm at the CSS reference 96dpi.
const MM = 96 / 25.4
const A4_H = 297 * MM

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
const refusal = (code, message) =>
  envelope(null, { status: 400, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })

// Chromium writes one `/Type /Page` object per printed sheet.
const pdfPageCount = (buffer) => (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
}

/** 1990's Collections sample row, VERBATIM. */
const COLLECTION_SAMPLE = {
  storeId: 'P019',
  openedAt: '2026-09-02T08:00:12',
  closedAt: '2026-09-02T23:10:40',
  systemCash: 5420.5,
  countedCash: 5420.5,
  variance: 0.0,
  varianceReasonCode: '',
  varianceReasonText: '',
  amendmentCount: 0,
  lastAmendedBy: '',
  openingFloat: 200.0,
  countedCashNet: 5220.5,
  retainedFloat: 200.0,
  netCollected: 5220.5,
  cardTotal: 1310.25,
  cardTransactionCount: 9,
  receiptKind: 'SHIFT',
  settlementAdjustmentTotal: 0.0,
  settlementEntryNumber: 0,
  cashSales: 5220.5,
  settlement: 0.0,
  shiftSettlementAdjustment: 0.0,
  shiftSettlementEntryNumber: 0,
  settlementDescription: '',
  shiftCardTotal: 1310.25,
  isSettlement: false,
  collectionStatus: 'COLLECTED',
  isOffSystem: false,
  offSystemAt: null,
  offSystemBy: '',
  offSystemReasonCode: '',
  offSystemReasonText: '',
  businessDay: '2026-09-02T00:00:00',
  zNumber: 318,
  collectorOperatorId: 'COLL-9',
  collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
  collectionReceiptNo: 91234,
  collectedAt: '2026-09-12T10:15:00',
  zReportIds: '01K5XW0A1B2C3D4E5F6G7H8J9K',
  collectorName: 'فهد القحطاني',
  storeName: 'Al-Dawaa P019',
  closerOperatorId: 'MGR-01',
  closerName: 'Pharmacist One',
  salesDate: '2026-09-02T00:00:00',
  currencyKey: 'SAR',
  profitCenter: 'PH-019',
  storeText: 'PH-019',
}

/** Row order = row-index. The second is the contract's "none recorded" store. */
const COLLECTION_ROWS = [
  COLLECTION_SAMPLE,
  {
    ...COLLECTION_SAMPLE,
    collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X01',
    collectionReceiptNo: 91235,
    storeId: 'P020',
    storeName: 'Al-Dawaa P020',
    profitCenter: '',
    storeText: 'P020',
  },
]

/** 1993's attempt sample with 1990's pair "after storeName", as the contract words it. */
const ATTEMPT_ROWS = [
  {
    attemptId: '01K5YQ5H6J7K8M9N0P1Q2R3S4T',
    collectorStaffId: 'COLL-9',
    collectorName: 'فهد القحطاني',
    storeCode: 'P019',
    storeName: 'Al-Dawaa P019',
    profitCenter: 'PH-019',
    storeText: 'PH-019',
    shiftId: '',
    businessDay: '2026-09-02T00:00:00',
    attemptTime: '2026-09-05T10:15:00',
    reasonCode: 'NOT_PREPARED',
    reasonText: 'branch had not closed the day',
  },
  {
    attemptId: '01K5YQ5H6J7K8M9N0P1Q2R3S4U',
    collectorStaffId: 'COLL-9',
    collectorName: 'فهد القحطاني',
    storeCode: 'P020',
    storeName: 'Al-Dawaa P020',
    profitCenter: '',
    storeText: 'P020',
    shiftId: '',
    businessDay: '2026-09-02T00:00:00',
    attemptTime: '2026-09-05T11:40:00',
    reasonCode: 'STORE_CLOSED',
    reasonText: '',
  },
]

/** 1990's ACR-form row sample, VERBATIM. */
const ACR_ROW_SAMPLE = {
  seqText: '1', storeCode: 'P019', storeText: 'PH-019', salesDateText: '02/09/2026',
  cashText: '5420.50', cardText: '1310.25', totalText: '6730.75', settlementText: '—',
  netCollectedText: '5420.50', isSettlement: false, receiptNoText: '91234',
  pharmacistName: 'Pharmacist One', pharmacistId: 'MGR-01', notes: '', isShortfall: false,
}

/** 1990's receipt-page sample (abridged in the contract to the store fields and neighbours). */
const RECEIPT_PAGE_SAMPLE = {
  noText: '0000091234', storeCode: 'P019', storeText: 'PH-019',
  collectedAtText: '2026-09-12 10:15', collectorName: 'فهد القحطاني', collectorId: 'COLL-9',
}

const SCREENS = {
  collections: {
    route: '/collection/collections',
    door: 'CollectionWeb/Collections',
    rows: COLLECTION_ROWS,
    codeColumn: 'storeId',
    codeHeader: 'Store Code',
    // Ticket 423: Saud's order — the profit center is third, right after the store code.
    // 2026-10-03: the landing grid shows the RAW profit center, and the composed
    // `PH-019` waits in the tail (Saud's last column, Profit Center (Store)).
    landing: { colId: 'profitCenter', header: RAW, withPc: 'PH-019', none: '' },
    tail: { colId: 'storeText', header: COLUMN, withPc: 'PH-019', none: 'P020' },
    loading: 'Loading collections…',
    emptyTitle: 'No collections match this search',
    csvName: 'collection-collections',
  },
  attempts: {
    route: '/collection/attempts',
    door: 'CollectionWeb/Attempts',
    rows: ATTEMPT_ROWS,
    codeColumn: 'storeCode',
    codeHeader: 'Store Code',
    landing: { colId: 'storeText', header: COLUMN, withPc: 'PH-019', none: 'P020' },
    tail: { colId: 'profitCenter', header: RAW, withPc: 'PH-019', none: '' },
    loading: "Loading today's attempts…",
    emptyTitle: 'No attempts in this period',
    csvName: 'collection-attempts',
  },
}

let scenario = {}
let lastQuery = ''
let DOCS = { receipts: {}, acrs: {} }
/** Held open to show a loading state; released by the scenario. */
let hold = null

async function run() {
  const browser = await chromium.launch()
  // Wide enough that AG Grid's column virtualisation draws every default column.
  const page = await browser.newPage({ viewport: { width: 2600, height: 1100 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    const screen = Object.values(SCREENS).find((s) => s.door === path)
    if (screen) {
      lastQuery = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
      if (hold) await hold
      if (scenario.list === 'error')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The inquiry failed.' }))
      if (scenario.list === 'refusal') return route.fulfill(refusal('ServedByKindUnknown', 'Unknown served-by kind.'))
      if (scenario.list === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (scenario.list === 'empty') return route.fulfill(envelope([]))
      return route.fulfill(envelope(screen.rows))
    }
    if (scenario.paper === 'error' && /^CollectionWeb\/(AcrForm|Receipt)\//.test(path))
      return route.fulfill(envelope(null, { status: 500, success: false, message: 'The document failed.' }))
    if (path.startsWith('CollectionWeb/AcrForm/')) {
      const id = decodeURIComponent(path.slice('CollectionWeb/AcrForm/'.length))
      if (hold) await hold
      if (DOCS.acrs[id]) return route.fulfill(envelope(DOCS.acrs[id]))
      return route.fulfill(refusal('AcrNotFound', 'No such ACR.'))
    }
    if (path.startsWith('CollectionWeb/Receipt/')) {
      const id = decodeURIComponent(path.slice('CollectionWeb/Receipt/'.length))
      if (hold) await hold
      if (DOCS.receipts[id]) return route.fulfill(envelope(DOCS.receipts[id]))
      return route.fulfill(refusal('CollectionReceiptNotFound', 'No such collection receipt.'))
    }
    return route.fulfill(envelope({}))
  })

  // The documents, out of the app's OWN fixture modules.
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
  // The contract's own samples, served beside the fixtures.
  DOCS.acrs.contract = {
    ...DOCS.acrs.empty,
    pages: [{ ...DOCS.acrs.empty.pages[0], rows: [ACR_ROW_SAMPLE] }],
  }
  DOCS.receipts.contract = { pages: [{ ...DOCS.receipts.posted.pages[0], ...RECEIPT_PAGE_SAMPLE }] }
  // A SIS.Api without 1990 sends no `storeText` at all — the deploy-order state.
  const withoutStoreText = ({ storeText: _dropped, ...rest }) => rest
  DOCS.acrs['pre-1990'] = {
    ...DOCS.acrs.contract,
    pages: [{ ...DOCS.acrs.contract.pages[0], rows: [withoutStoreText(ACR_ROW_SAMPLE)] }],
  }
  DOCS.receipts['pre-1990'] = { pages: [withoutStoreText(DOCS.receipts.contract.pages[0])] }

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/314-${name}.png`, fullPage: true })
  const mainText = async () => page.locator('main').innerText()
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(collections|attempts|collection|common|access)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const cellText = async (rowIndex, colId) =>
    (await page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`).innerText()).trim()
  const headers = async () =>
    (await page.locator('.ag-header-cell-text').allInnerTexts()).map((s) => s.trim())
  const rowCount = async () => page.locator('.ag-row').count()
  const load = async (path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
    // Ticket 423: Cash Collections opens blank and loads nothing until Search.
    if (path === '/collection/collections') {
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await page.waitForLoadState('networkidle')
    }
  }

  /** Split one CSV line into cells, respecting the RFC-4180 quoting. */
  const splitRow = (line) => {
    const cells = []
    let current = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && quoted && line[i + 1] === '"') { current += '""'; i++ }
      else if (ch === '"') { quoted = !quoted; current += ch }
      else if (ch === ',' && !quoted) { cells.push(current); current = '' }
      else current += ch
    }
    cells.push(current)
    return cells
  }
  const unquote = (raw) =>
    raw.startsWith('"') && raw.endsWith('"') && raw.length > 1 ? raw.slice(1, -1).replace(/""/g, '"') : raw

  // ---- 1–4. both grids ----
  for (const [key, screen] of Object.entries(SCREENS)) {
    scenario = {}
    await load(screen.route)
    await page.locator('.ag-row').first().waitFor()
    await shot(`${key}-grid`)
    const { landing: front, tail } = screen
    const landing = await headers()
    check(`${key} — ${front.header} is on the DEFAULT grid`, landing.includes(front.header), landing.join(' | '))
    check(
      `${key} — …right after ${screen.before ?? screen.codeHeader}`,
      landing.indexOf(front.header) === landing.indexOf(screen.before ?? screen.codeHeader) + 1,
      landing.join(' | '),
    )
    check(`${key} — ${tail.header} waits in the tail`, !landing.includes(tail.header))

    check(`${key} — a store with a profit center reads ${front.withPc}, as sent`, (await cellText(0, front.colId)) === front.withPc, await cellText(0, front.colId))
    check(`${key} — a store with none reads ${JSON.stringify(front.none)}, never "()"`, (await cellText(1, front.colId)) === front.none, await cellText(1, front.colId))
    check(`${key} — the store code column is unchanged beside it`, (await cellText(0, screen.codeColumn)) === 'P019')

    const filter = page.locator(`.ag-floating-filter[col-id="${front.colId}"] input`)
    await filter.fill('PH-019')
    await page.waitForTimeout(700)
    check(`${key} — the floating filter finds the store by its profit center`, (await rowCount()) === 1 && (await cellText(0, front.colId)) === front.withPc, `${await rowCount()} rows`)
    if (front.none) {
      await filter.fill(front.none)
      await page.waitForTimeout(700)
      check(`${key} — …and by its code`, (await rowCount()) === 1 && (await cellText(0, front.colId)) === front.none, `${await rowCount()} rows`)
    }
    await filter.fill('')
    await page.waitForTimeout(700)

    await page.getByRole('button', { name: 'More columns' }).click()
    await page.waitForTimeout(300)
    const allHeaders = new Set()
    for (const left of [0, 4000]) {
      await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((el, x) => {
        el.scrollLeft = x
      }, left)
      await page.waitForTimeout(250)
      for (const text of await headers()) allHeaders.add(text)
    }
    check(`${key} — More columns reveals ${tail.header}`, allHeaders.has(tail.header), [...allHeaders].join(' | '))
    check(`${key} — …${tail.withPc} on the first row, ${JSON.stringify(tail.none)} on the store with none`, (await cellText(0, tail.colId)) === tail.withPc && (await cellText(1, tail.colId)) === tail.none)
    await page.getByRole('button', { name: 'More columns' }).click()
    await page.locator('.ag-body-horizontal-scroll-viewport').evaluate((el) => {
      el.scrollLeft = 0
    })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: 'Export' }).click(),
    ])
    check(`${key} — export: the file is the screen’s`, download.suggestedFilename().startsWith(screen.csvName), download.suggestedFilename())
    // Since ticket 336 the export is an .xlsx, which this CSV reader cannot parse; its cells are
    // proven by xlsx.test.ts instead.
    if (download.suggestedFilename().endsWith('.xlsx')) continue
    const csv = readFileSync(await download.path(), 'utf8')
    const lines = csv.replace(/^﻿/, '').split('\r\n').filter((l) => l !== '')
    const header = splitRow(lines[1])
    const body = lines.slice(2).map(splitRow)
    const at = (row, name) => unquote(row[header.indexOf(name)] ?? '')
    check(`${key} — export: both columns are in the file with the toggle OFF`, header.includes(COLUMN) && header.includes(RAW), header.join('|'))
    check(`${key} — export: the pair is written as sent, wrapped`, at(body[0], COLUMN) === '="PH-019"' && at(body[0], RAW) === '="PH-019"', `${at(body[0], COLUMN)} ${at(body[0], RAW)}`)
    check(`${key} — export: none recorded → the code alone, and an EMPTY raw cell`, at(body[1], COLUMN) === '="P020"' && at(body[1], RAW) === '', `${at(body[1], COLUMN)} ${JSON.stringify(at(body[1], RAW))}`)
    await noRawKeys(`${key} grid`)

    // ---- 5. the list's other states ----
    let release
    hold = new Promise((r) => (release = r))
    await page.goto(BASE + screen.route)
    // Ticket 423: Cash Collections loads nothing until Search.
    if (key === 'collections') await page.getByRole('button', { name: 'Search', exact: true }).click()
    const loading = page.getByRole('status', { name: screen.loading })
    await loading.first().waitFor({ timeout: 5000 }).catch(() => {})
    check(`${key} — loading: the list says it is loading`, (await loading.count()) > 0 && (await page.locator('.ag-root').count()) === 0)
    release()
    hold = null
    await page.waitForLoadState('networkidle')
    await page.locator('.ag-row').first().waitFor()
    check(`${key} — …and then draws the column`, (await cellText(0, screen.landing.colId)) === screen.landing.withPc)

    scenario = { list: 'empty' }
    await load(screen.route)
    check(`${key} — empty: the empty state, no grid`, (await mainText()).includes(screen.emptyTitle) && (await page.locator('.ag-root').count()) === 0)

    const SERVER_FAULT = 'The OMS API encountered an unexpected error. Please try again.'
    scenario = { list: 'error' }
    await load(screen.route)
    await page.getByText(SERVER_FAULT).first().waitFor({ timeout: 8000 }).catch(() => {})
    const errorText = await mainText()
    check(`${key} — error: a 500 reads as a server fault, no grid, never the empty state`, errorText.includes(SERVER_FAULT) && !errorText.includes(screen.emptyTitle) && (await page.locator('.ag-root').count()) === 0, errorText.replace(/\n/g, ' ').slice(-160))

    scenario = { list: 'refusal' }
    await load(screen.route)
    await page.getByText('Unknown served-by kind.').first().waitFor({ timeout: 8000 }).catch(() => {})
    const refusalText = await mainText()
    check(`${key} — refusal: a 400 envelope reads as its own message`, refusalText.includes('Unknown served-by kind.') && (await page.locator('.ag-root').count()) === 0, refusalText.replace(/\n/g, ' ').slice(-160))

    scenario = { list: 'forbidden' }
    await load(screen.route)
    await page.getByText('Unexpected API error (HTTP 403).').first().waitFor({ timeout: 8000 }).catch(() => {})
    const forbiddenText = await mainText()
    check(`${key} — a bare 403 is an error banner, never an empty list`, (await page.locator('.ag-root').count()) === 0 && !forbiddenText.includes(screen.emptyTitle) && forbiddenText.includes('Unexpected API error (HTTP 403).'), forbiddenText.replace(/\n/g, ' ').slice(-160))
    await noRawKeys(`${key} states`)
  }

  // ---- 2. the ACRs' per-row data: the Collections door under ?acr= ----
  scenario = {}
  await load('/collection/collections?acr=01K5YQ2M8N3P4R5S6T7V8W9X0Y')
  await page.locator('.ag-row').first().waitFor()
  check('acr drill-down — asks the Collections door by AcrId', new URLSearchParams(lastQuery).get('AcrId') === '01K5YQ2M8N3P4R5S6T7V8W9X0Y', lastQuery)
  const acrHeaders = await headers()
  check('acr drill-down — the ACR’s collections carry the profit center column', acrHeaders.includes(RAW) && (await cellText(0, 'profitCenter')) === 'PH-019', acrHeaders.join(' | '))
  await shot('acr-drill-down')

  // ---- 6a. the ACR form ----
  await page.setViewportSize({ width: 1600, height: 1200 })
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.print-sheet, [role="alert"]', { state: 'attached' })
  }
  const gotoAcr = async (id) => {
    await page.goto(`${BASE}/collection/acr/${id}`)
    await settle()
  }
  const storeCells = (sheet) => sheet.locator('.acr-c1:not(.acr-th) bdi')

  await gotoAcr('three-pages')
  const acrSheets = page.locator('.print-sheet')
  await shot('acr-form')
  check('acr — still THREE A4 sheets for 47 rows', (await acrSheets.count()) === 3, `${await acrSheets.count()}`)
  const first = storeCells(acrSheets.first())
  check('acr — رقم الصيدلية prints the server’s storeText', (await first.first().evaluate((el) => el.textContent)) === 'PH-1204')
  check('acr — …on every row of the page', (await first.count()) === 22 && (await first.allTextContents()).every((t) => /^PH-\d{4}$/.test(t)))
  check('acr — …as a left-to-right island inside the RTL row', (await first.first().evaluate((el) => getComputedStyle(el).direction)) === 'ltr')
  check('acr — …the profit center alone, never beside the code (owner ruling 2026-10-08)', (await first.allTextContents()).every((t) => !t.includes('(')))
  const overflow = await acrSheets.first().locator('.acr-c1:not(.acr-th)').evaluateAll((els) =>
    els.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
  )
  check('acr — the 52px cell wraps it rather than spilling into the next column', overflow === 0, `${overflow} overflowing`)
  const sheetBox = await acrSheets.first().boundingBox()
  const lastRow = await acrSheets.first().locator('.acr-tr').last().boundingBox()
  check('acr — a full page of 22 wrapped rows still ends inside its A4 sheet', lastRow.y + lastRow.height <= sheetBox.y + sheetBox.height && Math.abs(sheetBox.height - A4_H) < 2, `row ends @${(lastRow.y + lastRow.height).toFixed(0)}, sheet @${(sheetBox.y + sheetBox.height).toFixed(0)}`)
  check('acr — the PDF of 47 wrapped rows is still exactly 3 sheets', pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: true })) === 3)

  await gotoAcr('boundary')
  const lastSheet = page.locator('.print-sheet').nth(1)
  const lastSheetBox = await lastSheet.boundingBox()
  const summaryBox = await lastSheet.locator('.acr-summary').boundingBox()
  check('acr — 23 rows: the summary under the lone row still fits the last sheet', summaryBox.y + summaryBox.height <= lastSheetBox.y + lastSheetBox.height)
  check('acr — …and the PDF is still exactly 2 sheets', pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: true })) === 2)

  await gotoAcr('open')
  const openPage2 = storeCells(page.locator('.print-sheet').nth(1))
  check('acr — a store with no profit center prints its code alone', (await openPage2.first().evaluate((el) => el.textContent)) === '1398')

  await gotoAcr('contract')
  check('acr — the contract’s own row prints PH-019', (await storeCells(page.locator('.print-sheet').first()).first().evaluate((el) => el.textContent)) === 'PH-019')

  await gotoAcr('pre-1990')
  check('acr — a server without 1990 (no storeText) still prints the code, never a blank cell', (await storeCells(page.locator('.print-sheet').first()).first().evaluate((el) => el.textContent)) === 'P019')

  await page.emulateMedia({ media: 'print' })
  await gotoAcr('contract')
  check('acr — under print media it still prints', (await storeCells(page.locator('.print-sheet').first()).first().evaluate((el) => el.textContent)) === 'PH-019')
  await page.emulateMedia({ media: 'screen' })

  let release
  hold = new Promise((r) => (release = r))
  await page.goto(`${BASE}/collection/acr/three-pages`)
  await page.waitForSelector('[role="status"]')
  check('acr — loading: a sentence, never a blank sheet', (await page.locator('.print-sheet').count()) === 0)
  release()
  hold = null
  await settle()

  await gotoAcr('no-such-acr')
  check('acr — an unknown ACR is still the miss, not a blank sheet', (await page.locator('.print-sheet').count()) === 0 && (await page.locator('body').innerText()).includes('no longer exists'))

  scenario = { paper: 'error' }
  await gotoAcr('three-pages')
  const acrFault = await page.locator('body').innerText()
  check('acr — a 500 is a failure, never the miss and never a sheet', (await page.locator('.print-sheet').count()) === 0 && acrFault.includes('could not be fetched') && !acrFault.includes('no longer exists'), acrFault.replace(/\n/g, ' ').slice(0, 80))
  scenario = {}

  // ---- 6b. the voucher ----
  const gotoReceipt = async (id) => {
    await page.goto(`${BASE}/collection/receipt/${id}`)
    await settle()
  }
  const storeLine = () => page.locator('.cv-band-side--store .cv-stamp span').nth(1)

  await gotoReceipt('posted')
  await shot('voucher')
  check('voucher — the Store. line prints the server’s storeText', (await storeLine().textContent()) === 'PH-1042', await storeLine().textContent())
  check('voucher — …on ONE line', (await storeLine().evaluate((el) => el.getClientRects().length)) === 1)
  const stamp = await page.locator('.cv-band-side--store .cv-stamp').boundingBox()
  const title = await page.locator('.cv-title-col').first().boundingBox()
  check(
    'voucher — …clear of the RECEIPT VOUCHER title block',
    stamp.x >= title.x + title.width || stamp.x + stamp.width <= title.x,
    `stamp ${stamp.x.toFixed(0)}–${(stamp.x + stamp.width).toFixed(0)}, title ${title.x.toFixed(0)}–${(title.x + title.width).toFixed(0)}`,
  )
  check('voucher — …the profit center alone, never beside the code (owner ruling 2026-10-08)', !(await storeLine().textContent()).includes('('))
  check('voucher — still ONE A4 sheet, and one PDF page', (await page.locator('.print-sheet').count()) === 1 && pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: true })) === 1)

  await gotoReceipt('multishift')
  const multi = await page.locator('.cv-band-side--store .cv-stamp span:nth-child(2)').allTextContents()
  check('voucher — every page of a multi-shift receipt carries it', multi.length === 2 && multi.every((t) => t === 'PH-1042'), JSON.stringify(multi))

  await gotoReceipt('bhd')
  check('voucher — a store with no profit center prints its code alone', (await storeLine().textContent()) === '7301')

  await gotoReceipt('settlement')
  check('voucher — a settlement page carries it too', (await storeLine().textContent()) === 'PH-1042')

  await gotoReceipt('contract')
  check('voucher — the contract’s own page prints PH-019', (await storeLine().textContent()) === 'PH-019')

  await gotoReceipt('pre-1990')
  check('voucher — a server without 1990 (no storeText) still prints the code, never a blank line', (await storeLine().textContent()) === 'P019')

  hold = new Promise((r) => (release = r))
  await page.goto(`${BASE}/collection/receipt/posted`)
  await page.waitForSelector('[role="status"]')
  check('voucher — loading: a sentence, never a blank sheet', (await page.locator('.print-sheet').count()) === 0)
  release()
  hold = null
  await settle()

  await gotoReceipt('no-such-receipt')
  check('voucher — an unknown receipt is still the miss', (await page.locator('.print-sheet').count()) === 0 && (await page.locator('body').innerText()).includes('no longer exists'))

  scenario = { paper: 'error' }
  await gotoReceipt('posted')
  const receiptFault = await page.locator('body').innerText()
  check('voucher — a 500 is a failure, never the miss and never a sheet', (await page.locator('.print-sheet').count()) === 0 && receiptFault.includes('could not be fetched') && !receiptFault.includes('no longer exists'), receiptFault.replace(/\n/g, ' ').slice(0, 80))
  scenario = {}

  check('no page error anywhere', errors.length === 0, errors.slice(0, 3).join(' || '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
