// Central invoice LIST drive (ticket 333, BackOffice spec 2094 / ticket 2100) — drives the REAL app in Chromium
// against STUBBED envelopes, with every `/api/**` request RECORDED.
//
// The wire, as BackOffice 2100 shipped it (`CentralInvoiceWebEndpoints.List`, `CentralInvoiceListService`):
//   `GET Sd/CentralInvoice?from&to&dateBasis&store&status` → `data.rows[] = { id, deliveryNo, storeCode, requestedBy,
//   requestedAt, reason, status, refusalCode, trxNumber, invoiceTotal, cashRemainder, pickDocumentNo, pickOutcome,
//   billedAt, country, serialisedInGs1Market, serials[] }`; money null while there is no invoice; `billedAt` the .NET
//   `0001-01-01` until billed; a bad filter is the standard 400 `CINV-LIST-FILTER`; without the grant a BARE 403.
//
// ⚠️ Stubbed, never live: this proves the client half. The ticket's Proof is the owner's smoke test on dev SIS.Api.
//
// Asserts:
//   A. granted: the "Central invoices" leaf opens /oms/central-invoices and is lit ALONE; ONE Access call; the landing
//      GET asks for the last 30 days by request day and names no store and no status.
//   B. the rows: a billed row shows its invoice number, total and cash remainder; a stranded row "Stranded" + its code;
//      a queued row shows NO money (never 0.00) and no billed-at; a Bahraini remainder keeps its third decimal; the GS1
//      flag reads "GS1 market"; the serials button opens the dialog listing the packs; a GS1+consumed row with no
//      serials says so; a non-GS1 voided row has no button.
//   C. filters: basis/store/status reach the GET trimmed and named as bound; a reversed range is refused in place,
//      Search disabled and no GET; a billing-day range asked of a never-billed status is refused the same way;
//      Reset asks the landing question again.
//   D. export: one .xlsx, named central-invoices-<stamp>; sheet 1 "Central invoices" carries the shown rows with labels
//      (not codes) and the cash remainder as a NUMBER; sheet 2 "Serials" carries one line per pack; a column filter
//      narrows both sheets.
//   E. a 400 shows the server's sentence; a 403 turns the screen into the denied card and drops BOTH leaves.
//   F. ungranted: neither leaf, the deep link is the denied card, zero list GETs.
//   G. regression: Screen 1's Export (the writer graduated to core) still writes its one "Delivery Documents" sheet.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/central-invoice-list-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = process.env.SHOTS || ''
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) })

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
const refusal400 = (code, message) =>
  envelope(null, { status: 400, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })
const BARE_403 = { status: 403, contentType: 'text/plain', body: '' }

const UNSET = '0001-01-01T00:00:00'
const pack = (serialNumber, pickDocumentNo = 'P-000123') => ({
  pickDocumentNo,
  gtin: '06281234567890',
  serialNumber,
  batchLot: 'B77',
  expiryDate: '271231',
})
const base = {
  requestedBy: 'msartawi',
  requestedAt: '2026-09-29T10:15:00',
  reason: 'Delivered during the pick-model rollout and never invoiced',
  refusalCode: '',
  country: 'SA',
  serialisedInGs1Market: false,
  serials: [],
}
const ROWS = [
  // Billed, KSA, serialised, consumed with two packs (one of them on a donor document).
  { ...base, id: 'A1', deliveryNo: '8006456897', storeCode: 'P983', status: 'BILLED', trxNumber: 'I8006456897',
    invoiceTotal: 151.5, cashRemainder: 51.5, pickDocumentNo: 'P-000123', pickOutcome: 'CONSUMED',
    billedAt: '2026-09-29T10:20:00', serialisedInGs1Market: true, serials: [pack('SN-0001'), pack('SN-0002', 'D-000045')] },
  // Stranded, with its code; no invoice.
  { ...base, id: 'A2', deliveryNo: '8006456512', storeCode: 'P983', status: 'STRANDED', refusalCode: 'CINV-PICK-COMPLETE',
    trxNumber: '', invoiceTotal: null, cashRemainder: null, pickDocumentNo: '', pickOutcome: '', billedAt: UNSET },
  // Queued: no money, no billed-at, no outcome.
  { ...base, id: 'A3', deliveryNo: '8006473324', storeCode: 'P101', status: 'QUEUED', trxNumber: '', invoiceTotal: null,
    cashRemainder: null, pickDocumentNo: '', pickOutcome: '', billedAt: UNSET },
  // Billed in Bahrain: a 3-decimal remainder; voided document; not GS1.
  { ...base, id: 'A4', deliveryNo: '8006480001', storeCode: 'B010', country: 'BH', status: 'BILLED', trxNumber: 'I8006480001',
    invoiceTotal: 20.755, cashRemainder: 5.125, pickDocumentNo: 'P-000200', pickOutcome: 'VOIDED', billedAt: '2026-09-28T09:00:00' },
  // Billed, KSA, GS1 + consumed, but the document held no serialised unit.
  { ...base, id: 'A5', deliveryNo: '8006480002', storeCode: 'P101', status: 'BILLED', trxNumber: 'I8006480002',
    invoiceTotal: 80, cashRemainder: 0, pickDocumentNo: 'P-000300', pickOutcome: 'CONSUMED', billedAt: '2026-09-28T11:00:00',
    serialisedInGs1Market: true, serials: [] },
]

async function open(browser, { probe = 'granted', answer } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  // The nav these checks read is the labelled tree; since 385 the rail boots collapsed, so the
  // stored preference opens it (the toggle's own key, as a user who pinned it open).
  await page.addInitScript(() => localStorage.setItem('oms.railExpanded', 'true'))
  const errors = []
  const calls = []
  const gets = []
  page.on('pageerror', (e) => errors.push(String(e)))
  if (process.env.DEBUG) page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 300)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: probe === 'granted' }))
    if (p === 'Sd/CentralInvoice' && req.method() === 'GET') {
      const q = Object.fromEntries(url.searchParams)
      gets.push(q)
      if (answer) return route.fulfill(answer(q))
      return route.fulfill(envelope({ rows: ROWS }))
    }
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    if (p === 'SdDocumentWeb/DeliveryDocumentList')
      return route.fulfill(envelope([{ deliveryNo: '8000000253', documentNo: '2000000551', storeCode: 'P001', netAmount: 12.5 }]))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, gets }
}

const count = (calls, re) => calls.filter((c) => re.test(c)).length
const listLeaf = (page) => page.locator('nav').getByRole('link', { name: 'Central invoices', exact: true })
const raiseLeaf = (page) => page.locator('nav').getByRole('link', { name: 'Raise central invoices' })
// A row id repeats across AG Grid's pinned containers; a CELL is in exactly one, so rows are found by a cell.
const gridRow = (page, id) => page.locator(`[data-central-invoice-list] .ag-row[row-id="${id}"] [col-id="deliveryNo"]`)
const cell = (page, id, colId) => page.locator(`[data-central-invoice-list] .ag-row[row-id="${id}"] [col-id="${colId}"]`)
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The entries of a zip, name → text (stored or deflated). Enough of a reader for the writer's own output. */
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

/** Sheet N's text with shared strings resolved, cells joined by | and rows by newline. */
function sheetText(files, n) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ''),
  )
  const xml = files[`xl/worksheets/sheet${n}.xml`] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)]
    .map((r) =>
      [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
        .map(([, attrs, body]) => {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? body.replace(/<[^>]+>/g, '')
          if (/t="s"/.test(attrs)) return shared[Number(v)]
          return (/t="n"|^(?![\s\S]*t=)/.test(attrs) && v !== '' ? 'n:' : '') + v
        })
        .join('|'),
    )
    .join('\n')
}

async function download(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download'), click()])
  const file = await dl.path()
  return { name: dl.suggestedFilename(), files: unzipText(readFileSync(file)) }
}

;(async () => {
  const browser = await chromium.launch()
  try {
    // ============================================ A + B · landing and the rows
    {
      const { context, page, errors, calls, gets } = await open(browser)
      await page.goto(`${BASE}/oms/deliveries`)
      await listLeaf(page).click()
      await page.waitForURL('**/oms/central-invoices')
      await gridRow(page, 'A1').waitFor()
      await shot(page, 'list')
      check('A: the leaf opens /oms/central-invoices', page.url().endsWith('/oms/central-invoices'))
      const lit = await page.locator('nav a[aria-current="page"]').allInnerTexts()
      check('A: the list leaf is lit alone', lit.length === 1 && /Central invoices/.test(lit[0]), JSON.stringify(lit))
      check('A: one Access call for the page life', count(calls, /Sd\/CentralInvoice\/Access$/) === 1, String(count(calls, /Sd\/CentralInvoice\/Access$/)))
      const today = new Date()
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)
      const q = gets[0] ?? {}
      check(
        'A: the landing GET is the last 30 days by request day, no store, no status',
        q.from === iso(from) && q.to === iso(today) && q.dateBasis === 'requested' && !('store' in q) && !('status' in q),
        JSON.stringify(q),
      )
      check('A: the count says five', /5 central invoices/.test(await page.locator('[data-central-invoice-list-count]').innerText()))

      const text = async (id, col) => (await cell(page, id, col).innerText()).trim()
      check('B: billed row — invoice number', (await text('A1', 'trxNumber')) === 'I8006456897')
      check('B: billed row — total and cash remainder', (await text('A1', 'invoiceTotal')) === '151.50' && (await text('A1', 'cashRemainder')) === '51.50')
      check('B: billed row — status and outcome', (await text('A1', 'status')) === 'Billed' && (await text('A1', 'pickOutcome')) === 'Consumed')
      check('B: stranded row — status and its code', (await text('A2', 'status')) === 'Stranded' && (await text('A2', 'refusalCode')) === 'CINV-PICK-COMPLETE')
      check(
        'B: queued row — no money (never 0.00), no billed-at, no outcome',
        (await text('A3', 'invoiceTotal')) === '' && (await text('A3', 'cashRemainder')) === '' &&
          (await text('A3', 'billedAt')) === '' && (await text('A3', 'pickOutcome')) === '',
      )
      check('B: a Bahraini remainder keeps its third decimal', (await text('A4', 'cashRemainder')) === '5.125', await text('A4', 'cashRemainder'))
      check('B: a covered KSA remainder is 0.00, not blank', (await text('A5', 'cashRemainder')) === '0.00')
      check('B: the GS1 flag reads "GS1 market" / "No"', (await text('A1', 'serialisedInGs1Market')) === 'GS1 market' && (await text('A4', 'serialisedInGs1Market')) === 'No')
      check('B: a non-GS1 voided row has no serials button', (await page.locator('[data-central-invoice-serials="8006480001"]').count()) === 0)

      await page.locator('[data-central-invoice-serials="8006456897"]').click()
      const detail = page.locator('dialog[open] [data-central-invoice-serial-detail]')
      await detail.waitFor()
      await shot(page, 'serials')
      const d = await detail.innerText()
      check('B: the serials dialog lists both packs with their documents', ['SN-0001', 'SN-0002', 'P-000123', 'D-000045', '06281234567890', 'B77', '271231'].every((s) => d.includes(s)), d.replace(/\s+/g, ' '))
      check('B: the dialog names the invoice', d.includes('I8006456897'))
      await page.keyboard.press('Escape')
      await page.locator('dialog[open]').waitFor({ state: 'detached' })
      await page.locator('[data-central-invoice-serials="8006480002"]').click()
      check('B: a GS1 consumed row with no serial says so', /holds no serialised unit/.test(await page.locator('dialog[open]').innerText()))
      await page.keyboard.press('Escape')
      check('A/B: no page errors', errors.length === 0, errors.join(' | '))

      // ============================================ C · filters
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Search' }) })
      await form.getByLabel('Date of').selectOption('billed')
      await form.getByLabel('Store', { exact: true }).fill('  P983 ')
      await form.getByLabel('Status').selectOption('BILLED')
      const before = gets.length
      await form.getByRole('button', { name: 'Search' }).click()
      await page.waitForTimeout(400)
      const q2 = gets[gets.length - 1]
      check('C: Search sends basis, trimmed store and status', gets.length === before + 1 && q2.dateBasis === 'billed' && q2.store === 'P983' && q2.status === 'BILLED', JSON.stringify(q2))
      await form.getByRole('button', { name: 'Search' }).click()
      await page.waitForTimeout(400)
      check('C: an unchanged Search asks again (a queued row may have billed)', gets.length === before + 2)

      await form.getByLabel('From', { exact: true }).fill('2026-09-20')
      await form.getByLabel('To', { exact: true }).fill('2026-09-10')
      const reversed = await form.getByRole('alert').innerText().catch(() => '')
      check('C: a reversed range is refused in place', /ends before it starts/.test(reversed), reversed)
      check('C: …and Search is disabled', await form.getByRole('button', { name: 'Search' }).isDisabled())
      const n = gets.length
      await form.getByLabel('To', { exact: true }).press('Enter')
      await page.waitForTimeout(300)
      check('C: …and Enter sends nothing', gets.length === n)
      await form.getByRole('button', { name: 'Reset' }).click()
      await form.getByLabel('Date of').selectOption('billed')
      await form.getByLabel('Status').selectOption('QUEUED')
      const pairing = await form.getByRole('alert').innerText().catch(() => '')
      check('C: billing dates with status Queued are refused in place', /Only billed central invoices have a billing date/.test(pairing), pairing)
      check('C: …and Search is disabled', await form.getByRole('button', { name: 'Search' }).isDisabled())
      await form.getByLabel('Status').selectOption('BILLED')
      check('C: billing dates with status Billed are fine', (await form.getByRole('alert').count()) === 0)
      await form.getByRole('button', { name: 'Reset' }).click()
      await page.waitForTimeout(400)
      const q3 = gets[gets.length - 1]
      check('C: Reset asks the landing question again', q3.from === iso(from) && q3.dateBasis === 'requested' && !('status' in q3), JSON.stringify(q3))

      // ============================================ D · export
      await gridRow(page, 'A1').waitFor()
      const all = await download(page, () => page.locator('[data-central-invoice-export]').click())
      check('D: one .xlsx named central-invoices-<stamp>', /^central-invoices-\d{8}-\d{4}\.xlsx$/.test(all.name), all.name)
      const wb = all.files['xl/workbook.xml'] ?? ''
      check('D: two sheets, "Central invoices" then "Serials"', /name="Central invoices"[\s\S]*name="Serials"/.test(wb))
      const s1 = sheetText(all.files, 1)
      const s1rows = s1.split('\n')
      check('D: sheet 1 is the header plus the five rows', s1rows.length === 6, String(s1rows.length))
      check('D: sheet 1 headers are the grid’s', s1rows[0].startsWith('Delivery|Store|Country|Requested by|Requested at|Reason|Status|Refusal code|Invoice number|Total|Cash remainder'), s1rows[0])
      const a1 = s1rows.find((r) => r.startsWith('8006456897')) ?? ''
      check('D: labels, not codes — Billed, Consumed, GS1 market', a1.includes('|Billed|') && a1.includes('|Consumed|') && a1.includes('|GS1 market|'), a1)
      check('D: the cash remainder is a NUMBER cell', a1.includes('|n:51.5|'), a1)
      check('D: the serial count is a number', a1.endsWith('|n:2'), a1)
      const a2 = s1rows.find((r) => r.startsWith('8006456512')) ?? ''
      check('D: the stranded row carries its code', a2.includes('|Stranded|CINV-PICK-COMPLETE|'), a2)
      const s2 = sheetText(all.files, 2).split('\n')
      check('D: sheet 2 is a header plus one line per pack', s2.length === 3 && s2[0] === 'Delivery|Invoice number|Store|Country|Picking document|GTIN|Serial number|Batch|Expiry|Serialised in a GS1 market', s2.join(' / '))
      check('D: a pack line stands on its own, its GTIN kept as text', s2[1] === '8006456897|I8006456897|P983|SA|P-000123|06281234567890|SN-0001|B77|271231|GS1 market', s2[1])
      await context.close()
    }

    // ============================================ D2 · a filtered grid exports only what it shows
    {
      const { context, page } = await open(browser, {
        answer: () => envelope({ rows: ROWS }),
      })
      await page.goto(`${BASE}/oms/central-invoices`)
      await gridRow(page, 'A1').waitFor()
      // A per-column filter on Country (AG Grid's own popup) narrows the grid client-side — the export must follow it.
      await page.locator('[data-central-invoice-list] .ag-header-cell[col-id="country"]').hover()
      const button = page.locator('[data-central-invoice-list] .ag-header-cell[col-id="country"] .ag-header-cell-filter-button')
      if (await button.count()) {
        await button.click()
        await page.locator('.ag-filter input[type="text"], .ag-filter .ag-input-field-input').first().fill('SA')
        await page.waitForTimeout(400)
        await page.keyboard.press('Escape')
        const countText = await page.locator('[data-central-invoice-list-count]').innerText()
        check('D2: the count says what is shown of what came back', /4 of 5 shown/.test(countText), countText)
        const filtered = await download(page, () => page.locator('[data-central-invoice-export]').click())
        const rows1 = sheetText(filtered.files, 1).split('\n')
        check('D2: sheet 1 holds only the shown rows', rows1.length === 5 && !rows1.some((r) => r.startsWith('8006480001')), String(rows1.length))
        check('D2: sheet 2 holds only the shown rows’ packs', sheetText(filtered.files, 2).split('\n').length === 3)
        // Clear the column filter, then ask regulatory's question: GS1 markets only.
        await page.locator('[data-central-invoice-list] .ag-header-cell[col-id="country"]').hover()
        await button.click()
        await page.locator('.ag-filter input[type="text"], .ag-filter .ag-input-field-input').first().fill('')
        await page.keyboard.press('Escape')
        await page.locator('[data-central-invoice-gs1-only]').check()
        await page.waitForTimeout(300)
        const gs1Count = await page.locator('[data-central-invoice-list-count]').innerText()
        check('D3: "GS1 markets only" shows the two flagged rows', /2 of 5 shown/.test(gs1Count), gs1Count)
        const gs1 = await download(page, () => page.locator('[data-central-invoice-export]').click())
        const gs1Rows = sheetText(gs1.files, 1).split('\n').slice(1).map((r) => r.split('|')[0])
        check('D3: …and the export follows', JSON.stringify(gs1Rows) === JSON.stringify(['8006456897', '8006480002']), JSON.stringify(gs1Rows))
        await page.locator('[data-central-invoice-gs1-only]').uncheck()
        await page.waitForTimeout(300)
        check('D3: unticked, all five are back', /5 central invoices/.test(await page.locator('[data-central-invoice-list-count]').innerText()))
      } else {
        check('D2: a column filter button exists on Country', false)
      }
      await context.close()
    }

    // ============================================ E · 400 and 403
    {
      const { context, page } = await open(browser, {
        answer: (q) =>
          q.store === 'BAD'
            ? refusal400('CINV-LIST-FILTER', "Status 'X' is not a central-invoice status; use QUEUED, BILLED or STRANDED.")
            : q.store === 'FORBID'
              ? BARE_403
              : envelope({ rows: ROWS }),
      })
      await page.goto(`${BASE}/oms/central-invoices`)
      await gridRow(page, 'A1').waitFor()
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Search' }) })
      await form.getByLabel('Store', { exact: true }).fill('BAD')
      await form.getByRole('button', { name: 'Search' }).click()
      await page.getByText('The list could not be loaded').waitFor()
      check('E: a 400 shows the server’s sentence', await page.getByText("Status 'X' is not a central-invoice status").isVisible())
      await form.getByLabel('Store', { exact: true }).fill('FORBID')
      await form.getByRole('button', { name: 'Search' }).click()
      await page.getByText('No access to central invoicing').waitFor()
      check('E: a 403 turns the screen into the denied card', (await page.locator('[data-central-invoice-list]').count()) === 0)
      check('E: …and drops both leaves', (await listLeaf(page).count()) === 0 && (await raiseLeaf(page).count()) === 0)
      await context.close()
    }

    // ============================================ F · ungranted
    {
      const { context, page, calls } = await open(browser, { probe: 'denied' })
      await page.goto(`${BASE}/oms/central-invoices`)
      await page.getByText('No access to central invoicing').waitFor()
      check('F: the deep link is the denied card', (await page.locator('[data-central-invoice-list]').count()) === 0)
      check('F: neither leaf is drawn', (await listLeaf(page).count()) === 0 && (await raiseLeaf(page).count()) === 0)
      check('F: zero list GETs', count(calls, /^GET Sd\/CentralInvoice$/) === 0)
      await context.close()
    }

    // ============================================ G · Screen 1's export still writes its sheet
    {
      const { context, page } = await open(browser)
      await page.goto(`${BASE}/oms/deliveries`)
      await page.locator('form button[type="submit"]').first().click()
      await page.locator('.ag-row .ag-cell').first().waitFor()
      const dl = await download(page, () => page.getByRole('toolbar').getByRole('button', { name: 'Export' }).click())
      check('G: Screen 1 exports delivery-documents-<stamp>.xlsx', /^delivery-documents-\d{8}-\d{4}\.xlsx$/.test(dl.name), dl.name)
      check('G: …one sheet, "Delivery Documents"', /name="Delivery Documents"/.test(dl.files['xl/workbook.xml'] ?? '') && !dl.files['xl/worksheets/sheet2.xml'])
      check('G: …holding the row', sheetText(dl.files, 1).includes('8000000253'))
      await context.close()
    }
  } catch (e) {
    console.error(e)
    check('drive ran to the end', false, String(e))
  } finally {
    await browser.close()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
})()
