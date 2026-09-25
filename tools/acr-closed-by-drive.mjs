// ACR closed-by drive (spec 308, ticket 313) — drives the REAL app in Chromium against
// STUBBED envelopes shaped exactly as BackOffice 1987 records them under `## Web contract`:
// `GET CollectionWeb/Acrs` rows gain `closedBy` + `closedByName`, and
// `GET CollectionWeb/AcrForm/{acrId}`'s `form` gains `closedByText`.
//
// ⚠️ Stubbed, never live: no SIS.Api with 1987 is up for this wave (and POS_Server migration
// 090 is the 1997 cutover's), and the assertions are about SPECIFIC closers — the 23:59 sweep,
// a collector, an unresolved id, an open ACR, a pre-090 close — which a live door will not
// produce on demand. The ACR form documents are the app's own `acr-fixture.ts`, loaded through
// the dev server, so there is no second transcription.
//
// Verifies ticket 313's screen Proof:
//   1. the ACRs grid draws a Closed By column by default: SYSTEM reads "Closed automatically at
//      end of day", a collector reads as their name, an unresolved id as the echoed id, and an
//      OPEN or pre-090 ACR stays blank;
//   2. the floating filter and the sort work on what the cell shows; the raw id (SYSTEM
//      verbatim) is in the More-columns tail;
//   3. loading, empty, error (500), refusal (a 400 envelope) and a bare 403 on the list, and
//      the access probe's denial;
//   4. the ACR form prints أُغلق بواسطة as the fourth cell of the الحالة row — the server's
//      string as given, its two spaces kept, blank when '' — and a miss is still the miss;
//   5. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/acr-closed-by-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/acrs'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const SWEPT_EN = 'Closed automatically at end of day'
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

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
}

/** 1987's sample row, VERBATIM — the sweep closed it. */
const SAMPLE = {
  acrId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
  acrNumber: 1207,
  label: '23/09/2026 - north round',
  collectorOperatorId: 'COLL-9',
  collectorName: 'فهد القحطاني',
  acrDate: '2026-09-23T00:00:00',
  status: 'CLOSED',
  createdAt: '2026-09-24T08:12:40',
  closedAt: '2026-09-24T23:59:00.31',
  closedBy: 'SYSTEM',
  closedByName: 'SYSTEM',
  linkedCollectionCount: 3,
  cashSalesTotal: 7300.0,
  settlementTotal: 300.0,
  bankedTotal: 7600.0,
  cardTotalSum: 1250.5,
  cardTransactionCountSum: 14,
  depositId: '',
  depositNumber: 0,
  depositStatus: '',
}

/** The contract's other closers, each on the sample's shape. Row order = row-index. */
const ROWS = [
  SAMPLE,
  // The collector closed it (`Acr/Close`): the name resolved.
  { ...SAMPLE, acrId: '01K5YQ2M8N3P4R5S6T7V8W9X01', acrNumber: 1208, closedAt: '2026-09-24T18:02:11', closedBy: 'COLL-9', closedByName: 'فهد القحطاني' },
  // The collector closed it, and no Staff name resolved: the id is echoed.
  { ...SAMPLE, acrId: '01K5YQ2M8N3P4R5S6T7V8W9X02', acrNumber: 1209, collectorOperatorId: 'D-12', collectorName: 'D-12', closedAt: '2026-09-24T17:40:00', closedBy: 'D-12', closedByName: 'D-12' },
  // Still OPEN: nobody closed it.
  { ...SAMPLE, acrId: '01K5YQ2M8N3P4R5S6T7V8W9X03', acrNumber: 1210, status: 'OPEN', closedAt: '0001-01-01T00:00:00', closedBy: '', closedByName: '' },
  // CLOSED before POS_Server migration 090: nothing was recorded — blank, not "unknown".
  { ...SAMPLE, acrId: '01K5YQ2M8N3P4R5S6T7V8W9X04', acrNumber: 1150, closedAt: '2026-09-01T19:00:00', closedBy: '', closedByName: '' },
]

let scenario = {}
let DOCS = {}
/** Held open to show a loading state; released by the scenario. */
let hold = null

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
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
    if (path === 'CollectionWeb/Access') {
      if (scenario.access403) return route.fulfill({ status: 403, body: '' })
      return route.fulfill(envelope(ACCESS))
    }
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    if (path === 'CollectionWeb/Acrs') {
      if (hold) await hold
      if (scenario.acrs === 'error')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The ACR inquiry failed on the server.' }))
      if (scenario.acrs === 'refusal')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'Unknown served-by kind.',
            errors: [{ errorCode: 'ServedByKindUnknown', internalErrorCode: '', errorMessage: 'Unknown served-by kind.' }],
          }),
        )
      if (scenario.acrs === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (scenario.acrs === 'empty') return route.fulfill(envelope([]))
      return route.fulfill(envelope(ROWS))
    }
    if (path.startsWith('CollectionWeb/AcrForm/')) {
      const id = decodeURIComponent(path.slice('CollectionWeb/AcrForm/'.length))
      if (DOCS[id]) return route.fulfill(envelope(DOCS[id]))
      return route.fulfill(
        envelope(null, {
          status: 400,
          success: false,
          message: 'No such ACR.',
          errors: [{ errorCode: 'AcrNotFound', internalErrorCode: '', errorMessage: 'No such ACR.' }],
        }),
      )
    }
    return route.fulfill(envelope({}))
  })

  // The ACR form documents, out of the app's OWN fixture module.
  scenario = {}
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  DOCS = await page.evaluate(async () => {
    const a = await import('/src/features/collection/inquiry/acr-fixture.ts')
    return Object.fromEntries(a.ACR_SCENARIOS.map((s) => [s.key, s.document]))
  })
  // The contract's own collector example, on a one-page document.
  DOCS['by-hand-contract'] = {
    ...DOCS.empty,
    form: { ...DOCS.empty.form, closedByText: 'فهد القحطاني  (COLL-9)' },
  }

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/313-${name}.png`, fullPage: true })
  const mainText = async () => page.locator('main').innerText()
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(acrs|collection|document|access)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const cell = (rowIndex, colId) =>
    page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`)
  const cellText = async (rowIndex, colId) => (await cell(rowIndex, colId).innerText()).trim()
  const headers = async () =>
    (await page.locator('.ag-header-cell-text').allInnerTexts()).map((s) => s.trim())
  const load = async () => {
    await page.goto(BASE + ROUTE)
    await page.waitForLoadState('networkidle')
  }

  // ---- 1. the grid reads each closer ----
  scenario = {}
  await load()
  await page.locator('.ag-row').first().waitFor()
  await shot('grid')
  const defaultHeaders = await headers()
  check('the Closed By column is on the DEFAULT grid', defaultHeaders.includes('Closed By'), defaultHeaders.join(' | '))
  check(
    '…beside Status',
    defaultHeaders.indexOf('Closed By') === defaultHeaders.indexOf('Status') + 1,
    defaultHeaders.join(' | '),
  )
  check('the raw id column waits in the tail', !defaultHeaders.includes('Closed By Id'))

  const swept = await cellText(0, 'closedByName')
  check('the 23:59 sweep reads as a sentence', swept === SWEPT_EN, JSON.stringify(swept))
  check('…never as a person called SYSTEM', !swept.includes('SYSTEM'))
  const byHand = await cellText(1, 'closedByName')
  check('a collector’s close reads as their name, verbatim', byHand === 'فهد القحطاني', JSON.stringify(byHand))
  const echoed = await cellText(2, 'closedByName')
  check('an unresolved collector reads as the echoed id', echoed === 'D-12', JSON.stringify(echoed))
  const open = await cellText(3, 'closedByName')
  check('an OPEN ACR is blank', open === '', JSON.stringify(open))
  const pre090 = await cellText(4, 'closedByName')
  check('an ACR closed before anything was recorded is blank — not "unknown"', pre090 === '', JSON.stringify(pre090))
  check(
    'the cell is not truncated: the sentence fits its column',
    await cell(0, 'closedByName').evaluate((el) => {
      const inner = el.querySelector('.ag-cell-value') ?? el
      return inner.scrollWidth <= inner.clientWidth
    }),
  )

  // ---- 2. filter and sort on what is shown; the raw id in the tail ----
  const filter = page.locator('.ag-floating-filter[col-id="closedByName"] input')
  await filter.fill('automatically')
  await page.waitForTimeout(700)
  const filtered = await page.locator('.ag-row').count()
  check(
    'the floating filter finds the swept ACR by what the cell SAYS',
    filtered === 1 && (await cellText(0, 'acrNumber')) === '1207',
    `${filtered} rows`,
  )
  await filter.fill('SYSTEM')
  await page.waitForTimeout(700)
  check(
    '…and to the contract’s literal SYSTEM, though the cell never draws it',
    (await page.locator('.ag-row').count()) === 1 && (await cellText(0, 'closedByName')) === SWEPT_EN,
  )
  await filter.fill('')
  await page.waitForTimeout(700)
  check('…and clearing it brings every row back', (await page.locator('.ag-row').count()) === ROWS.length)

  await page.locator('.ag-header-cell[col-id="closedByName"] .ag-header-cell-label').click()
  await page.waitForTimeout(300)
  const sortedAsc = []
  for (let i = 0; i < ROWS.length; i++) sortedAsc.push(await cellText(i, 'closedByName'))
  // The echoed id D-12 sorts BETWEEN the two readings of the sweep: on the raw name the swept
  // ACR would follow it as "SYSTEM"; on the shown text it leads it as "Closed…".
  check(
    'sorting orders by the SHOWN text, not by the raw SYSTEM',
    JSON.stringify(sortedAsc) === JSON.stringify(['', '', SWEPT_EN, 'D-12', 'فهد القحطاني']),
    JSON.stringify(sortedAsc),
  )

  // Wide enough that AG Grid's column virtualisation draws the whole tail.
  await page.setViewportSize({ width: 3200, height: 900 })
  await load()
  await page.getByRole('button', { name: 'More columns' }).click()
  await page.waitForTimeout(300)
  const moreHeaders = await headers()
  check('More columns reveals Closed By Id', moreHeaders.includes('Closed By Id'), moreHeaders.join(' | '))
  check(
    '…beside Closed',
    moreHeaders.indexOf('Closed By Id') === moreHeaders.indexOf('Closed') + 1,
    moreHeaders.join(' | '),
  )
  check('the raw id is SYSTEM verbatim on the swept ACR', (await cellText(0, 'closedBy')) === 'SYSTEM')
  check('…and the collector’s staff id on a manual close', (await cellText(1, 'closedBy')) === 'COLL-9')
  const rawFilter = page.locator('.ag-floating-filter[col-id="closedBy"] input')
  await rawFilter.fill('SYSTEM')
  await page.waitForTimeout(700)
  check(
    'finance can still filter on the literal SYSTEM, in the tail',
    (await page.locator('.ag-row').count()) === 1,
  )
  await shot('grid-more')
  await noRawKeys('grid')
  await page.setViewportSize({ width: 1600, height: 900 })

  // ---- 3. the list's other states ----
  let release
  hold = new Promise((r) => (release = r))
  scenario = {}
  await page.goto(BASE + ROUTE)
  // The shimmer names itself to assistive tech (role=status, aria-label), not in visible text.
  const loading = page.getByRole('status', { name: "Loading today's ACRs…" })
  await loading.first().waitFor({ timeout: 5000 }).catch(() => {})
  check('loading — the list says it is loading', (await loading.count()) > 0 && (await page.locator('.ag-root').count()) === 0)
  release()
  hold = null
  await page.waitForLoadState('networkidle')
  await page.locator('.ag-row').first().waitFor()
  check('…and then draws the rows', (await page.locator('.ag-row').count()) === ROWS.length)

  scenario = { acrs: 'empty' }
  await load()
  check('empty — the empty state, no grid', (await mainText()).includes('No ACRs in this period') && (await page.locator('.ag-root').count()) === 0)
  await shot('empty')

  // An uncoded 500 is a server fault: the app's own sentence (core/api), after react-query's
  // one retry — so each failure waits for its banner rather than for network idle.
  const SERVER_FAULT = 'The OMS API encountered an unexpected error. Please try again.'
  scenario = { acrs: 'error' }
  await load()
  await page.getByText(SERVER_FAULT).first().waitFor({ timeout: 8000 }).catch(() => {})
  const errorText = await mainText()
  check('error — a 500 reads as a server fault, no grid', errorText.includes(SERVER_FAULT) && (await page.locator('.ag-root').count()) === 0, errorText.replace(/\n/g, ' ').slice(-160))
  check('…and never the empty state', !errorText.includes('No ACRs in this period'))

  scenario = { acrs: 'refusal' }
  await load()
  await page.getByText('Unknown served-by kind.').first().waitFor({ timeout: 8000 }).catch(() => {})
  const refusalText = await mainText()
  check('refusal — a 400 envelope reads as its own message', refusalText.includes('Unknown served-by kind.') && (await page.locator('.ag-root').count()) === 0, refusalText.replace(/\n/g, ' ').slice(-160))

  // A bare 403 (no envelope) is core/api's 'unknown' arm: its own sentence, naming the status.
  scenario = { acrs: 'forbidden' }
  await load()
  await page.getByText('Unexpected API error (HTTP 403).').first().waitFor({ timeout: 8000 }).catch(() => {})
  const forbiddenText = await mainText()
  check(
    'a bare 403 on the list is an error banner naming the status, never an empty list',
    (await page.locator('.ag-root').count()) === 0 && !forbiddenText.includes('No ACRs in this period') && forbiddenText.includes('Unexpected API error (HTTP 403).'),
    forbiddenText.replace(/\n/g, ' ').slice(-160),
  )
  await noRawKeys('states')

  scenario = { access403: true }
  await load()
  check('the probe refusing → the denied backstop', (await mainText()).includes(DENIED))

  // ---- 4. the ACR form's header ----
  scenario = {}
  // textContent, not innerText: innerText breaks a line between the cell's two blockified flex
  // items, and it is the value's own whitespace (the two spaces) that is under test.
  const formCellText = (n) =>
    page.locator('.acr-doc').first().locator('.acr-meta--last .acr-meta-cell').nth(n).evaluate((el) => el.textContent)
  const openForm = async (key) => {
    await page.goto(`${BASE}/collection/acr/${key}`)
    await page.waitForLoadState('networkidle')
    await page.locator('.acr-doc').first().waitFor()
  }

  await openForm('boundary')
  await shot('form-swept')
  check('the الحالة row carries FOUR cells', (await page.locator('.acr-doc').first().locator('.acr-meta--last .acr-meta-cell').count()) === 4)
  const sweptForm = await formCellText(3)
  check('the sweep prints the server’s string as given', sweptForm === 'أُغلق بواسطة: النظام (SYSTEM)', JSON.stringify(sweptForm))
  check('…on every page of the form', (await page.locator('.acr-doc .acr-meta--last').count()) === (await page.locator('.acr-doc').count()))

  await openForm('by-hand-contract')
  const handForm = await formCellText(3)
  check('the contract’s collector string keeps its TWO spaces', handForm === 'أُغلق بواسطة: فهد القحطاني  (COLL-9)', JSON.stringify(handForm))
  const boxes = await page.locator('.acr-doc').first().locator('.acr-meta--last .acr-meta-cell').evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), bottom: Math.round(r.bottom) })),
  )
  check('…and the four cells stay one strip (a long name wraps inside its own quarter)', new Set(boxes.map((b) => b.top)).size === 1 && new Set(boxes.map((b) => b.bottom)).size === 1, JSON.stringify(boxes))
  const docWidth = await page.locator('.acr-doc').first().evaluate((el) => [el.scrollWidth, el.clientWidth])
  check('…and the sheet is no wider for it', docWidth[0] <= docWidth[1], JSON.stringify(docWidth))

  await openForm('three-pages')
  const collectorForm = await formCellText(3)
  check('the fixture’s collector close prints name  (id)', collectorForm === 'أُغلق بواسطة: إبراهيم ياسين الشمري  (40219)', JSON.stringify(collectorForm))

  await openForm('open')
  const openForm_ = (await formCellText(3)).trim()
  check('an OPEN form prints the label and nothing else — no placeholder, no dash', openForm_ === 'أُغلق بواسطة:', JSON.stringify(openForm_))
  await shot('form-open')

  await page.emulateMedia({ media: 'print' })
  await openForm('boundary')
  check('under print media the closer still prints', (await formCellText(3)) === 'أُغلق بواسطة: النظام (SYSTEM)')
  await page.emulateMedia({ media: 'screen' })

  await page.goto(`${BASE}/collection/acr/no-such-acr`)
  await page.waitForLoadState('networkidle')
  check('an unknown ACR is still the miss, not a blank sheet', (await page.locator('.acr-doc').count()) === 0 && (await page.locator('body').innerText()).includes('This document no longer exists'))
  await noRawKeys('form')

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
