// Slip drawer drive (spec 319, ticket 321) — drives the REAL app in Chromium against STUBBED
// envelopes shaped exactly as BackOffice 2034 + 2035 record them under `## Web contract`
// (cross-checked against AttachmentDto.cs, WithdrawnAttachmentDto.cs, AttachmentOwnerListResponse.cs,
// AttachmentContentResult.cs and AttachmentWebEndpoints.cs on pricing2):
//   - `GET AttachmentWeb/ByOwner?ownerKind=STORE_DAY&ownerKey=<storeId>/<yyyy-MM-dd>` answers the
//     day's STORED slips as `data` (each with `sourceDevice` and `uploadedBy`), and `withdrawn`
//     BESIDE `data`;
//   - `GET AttachmentWeb/{id}/Content` answers the bytes with the row's Content-Type, or an enveloped
//     refusal: 404 NOT_FOUND, 502 FILE_SERVER_MISSING.
//
// ⚠️ Stubbed, never live: no SIS.Api with the File Server key set is up for this wave.
//
// Verifies ticket 321's drive Proof:
//   1. clicking a count on each grid, and a 0, opens that row's own store day; a null is not clickable;
//   2. a jpeg, a png and a pdf previewing; another type offering download only;
//   3. the download saving under `fileName`, with no second fetch;
//   4. a 404 (said, and ByOwner re-read) and a 502 (said, no retry) on `/Content`;
//   5. Withdrawn (n) collapsed and expanded, newest first, with no preview or download inside;
//   6. every object URL revoked on selection change and on close (URL.revokeObjectURL counted);
//   7. loading, error and refusal on ByOwner;
//   8. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/slip-drawer-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const READY = '/collection/ready'
const COLLECTIONS = '/collection/collections'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = null, siblings = {} } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, serverTime: '2026-09-26T09:00:00', data, ...siblings }),
})
const refusal = (status, code, message) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenAssignment: false,
  canOpenSettlement: false,
  canSuperviseSettlement: false,
  canOpenReady: true,
}

// ---- the grids (320's rows) ----
const DAY = {
  kind: 'DAY',
  storeId: 'P019',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  currencyKey: 'SAR',
  businessDay: '2026-09-20T00:00:00',
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X0Y',
  zNumber: 412,
  settlementDocumentId: '',
  entryNumber: 0,
  cashToHandOver: 1000.5,
  surplusDeducted: 250.0,
  readySince: '2026-09-20T23:05:12',
  daysWaiting: 5,
  cardTotal: 640.0,
  slipCount: 6,
}
const RECEIPT = {
  ...DAY,
  kind: 'SETTLEMENT',
  businessDay: null,
  shiftId: '',
  zNumber: null,
  settlementDocumentId: '01K5ZC1A2B3C4D5E6F7G8H9J0K',
  entryNumber: 143,
  cashToHandOver: 120.5,
  surplusDeducted: null,
  readySince: '2026-09-23T10:41:00',
  daysWaiting: 2,
  cardTotal: null,
  slipCount: null,
}
/** A day near midnight's neighbour: its key must be its OWN date, 2026-09-24. */
const DAY_ZERO = {
  ...DAY,
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X1A',
  businessDay: '2026-09-24T00:00:00',
  zNumber: null,
  cashToHandOver: null,
  surplusDeducted: null,
  readySince: '2026-09-24T22:58:00',
  daysWaiting: 1,
  cardTotal: null,
  slipCount: 0,
}
const READY_ROWS = [DAY, RECEIPT, DAY_ZERO]
const readyId = (row) => (row.kind === 'SETTLEMENT' ? `SETTLEMENT:${row.settlementDocumentId}` : `DAY:${row.shiftId}`)

const SHIFT = {
  storeId: 'P019',
  openedAt: '2026-09-01T08:00:12',
  closedAt: '2026-09-01T23:10:40',
  systemCash: 5420.5,
  countedCash: 5420.5,
  variance: 0.0,
  varianceReasonCode: '',
  varianceReasonText: '',
  openingFloat: 200.0,
  countedCashNet: 5220.5,
  retainedFloat: 200.0,
  netCollected: 5220.5,
  cardTotal: 1310.25,
  cardTransactionCount: 9,
  businessDay: '2026-09-01T00:00:00',
  collectorOperatorId: 'COLL-9',
  collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
  collectionReceiptNo: 91234,
  collectedAt: '2026-09-12T10:15:00',
  zReportIds: '01K5XW0A1B2C3D4E5F6G7H8J9K',
  collectorName: 'فهد القحطاني',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  closerOperatorId: 'MGR-01',
  closerName: 'Pharmacist One',
  salesDate: '2026-09-01T00:00:00',
  currencyKey: 'SAR',
  slipCount: 0,
}
const COLLECTION_ROWS = [
  // One multi-shift receipt: each row opens its OWN business day.
  SHIFT,
  { ...SHIFT, openedAt: '2026-09-02T08:00:00', businessDay: '2026-09-02T00:00:00', salesDate: '2026-09-02T00:00:00', slipCount: 3 },
  {
    ...SHIFT,
    collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X01',
    collectionReceiptNo: 91235,
    businessDay: null,
    salesDate: '0001-01-01T00:00:00',
    collectedAt: '2026-09-12T09:00:00',
    slipCount: null,
  },
]

// ---- the slips (AttachmentDto: every shipped field, plus 2034's sourceDevice and 2035's uploadedBy) ----
const slip = (id, fileName, sourceDevice, uploadedBy, storedAt) => ({
  attachmentId: id,
  status: 'STORED',
  ownerKind: 'STORE_DAY',
  ownerKey: 'P019/2026-09-20',
  category: 'CASH_CLOSE',
  kind: 'ECR_SLIP',
  fileName,
  sizeBytes: 2048,
  storedAt,
  sourceDevice,
  uploadedBy,
})
const JPEG = slip('01K60A0000000000000000JPEG', 'ecr-slip-till-1.jpg', 'P001-01', '20145', '2026-09-20T23:12:44.1234567')
const PNG = slip('01K60A00000000000000000PNG', 'emailed slip.png', '', 'U123', '2026-09-21T09:30:05')
const PDF = slip('01K60A00000000000000000PDF', 'bank-terminal.pdf', 'P001-02', '20146', '2026-09-20T22:58:00')
const TXT = slip('01K60A00000000000000000TXT', 'notes.txt', '', 'U124', '2026-09-20T22:40:00')
const GONE = slip('01K60A0000000000000000GONE', 'withdrawn-meanwhile.jpg', 'P001-01', '20145', '2026-09-20T22:30:00')
const LOST = slip('01K60A0000000000000000LOST', 'lost-by-file-server.jpg', 'P001-01', '20145', '2026-09-20T22:20:00')
const STORED = [PNG, JPEG, PDF, TXT, GONE, LOST]

const withdrawn = (id, fileName, withdrawnAt, extra = {}) => ({
  attachmentId: id,
  category: 'CASH_CLOSE',
  kind: 'ECR_SLIP',
  fileName,
  sourceDevice: '',
  uploadedBy: 'U123',
  storedAt: '2026-09-24T22:31:07',
  withdrawnBy: 'U456',
  withdrawnAt,
  reasonCode: 'DUPLICATE',
  reasonLabel: 'Duplicate',
  reasonLabelArabic: 'مكرر',
  note: '',
  ...extra,
})
// Sent OLDEST first on purpose: the drawer must still show the newest withdrawal first.
const WITHDRAWN = [
  withdrawn('01K60W0000000000000000OLD1', 'older-duplicate.jpg', '2026-09-25T09:12:40'),
  withdrawn('01K60W0000000000000000NEW1', 'wrong-day.jpg', '2026-09-26T08:01:02', {
    sourceDevice: 'P001-01',
    uploadedBy: '20145',
    reasonCode: 'OTHER',
    reasonLabel: 'Other',
    reasonLabelArabic: 'سبب آخر',
    note: 'Belongs to P020',
  }),
]

const CONTENT_404 = 'The attachment was not found.\nلم يتم العثور على المرفق.'
const CONTENT_502 =
  'The file server could not return this file: File metadata missing.\nتعذر على خادم الملفات إرجاع هذا الملف: File metadata missing.'
const NOT_SET_UP = 'The attachment store is not set up on this server.\nمخزن المرفقات غير مُعدّ على هذا الخادم.'

let bytes = {}
let byOwner = 'normal'
let byOwnerHold = null
let byOwnerCalls = []
let contentCalls = {}
let goneIds = new Set()
let probe = 'holder'

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 2600, height: 1000 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  // Real image bytes, drawn by the browser itself, so the <img> truly decodes.
  await page.goto('about:blank')
  const drawn = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    c.getContext('2d').fillRect(0, 0, 8, 8)
    return { png: c.toDataURL('image/png').split(',')[1], jpeg: c.toDataURL('image/jpeg').split(',')[1] }
  })
  bytes = {
    [JPEG.attachmentId]: { type: 'image/jpeg', body: Buffer.from(drawn.jpeg, 'base64') },
    [PNG.attachmentId]: { type: 'image/png', body: Buffer.from(drawn.png, 'base64') },
    [PDF.attachmentId]: {
      type: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'),
    },
    [TXT.attachmentId]: { type: 'text/plain', body: Buffer.from('not a slip') },
  }

  // Count every object URL the page makes and every revoke, before the app loads.
  await page.addInitScript(() => {
    const made = []
    const revoked = []
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (b) => {
      const u = create(b)
      made.push(u)
      return u
    }
    URL.revokeObjectURL = (u) => {
      revoked.push(u)
      return revoke(u)
    }
    window.__urls = { made, revoked }
  })

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.split('/api/')[1]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    if (path === 'AttachmentWeb/Access') {
      if (probe === 'notSetUp') return route.fulfill(refusal(503, 'NOT_SET_UP', NOT_SET_UP))
      return route.fulfill(envelope({ categories: ['CASH_CLOSE'], withdrawCategories: ['CASH_CLOSE'] }))
    }
    if (path === 'CollectionWeb/Ready')
      return route.fulfill(envelope(READY_ROWS, { siblings: { slipCountsUnavailable: false } }))
    if (path === 'CollectionWeb/Collections')
      return route.fulfill(envelope(COLLECTION_ROWS, { siblings: { slipCountsUnavailable: false } }))
    if (path === 'AttachmentWeb/ByOwner') {
      const ownerKind = url.searchParams.get('ownerKind')
      const ownerKey = url.searchParams.get('ownerKey')
      byOwnerCalls.push({ ownerKind, ownerKey })
      if (byOwnerHold) await byOwnerHold
      if (byOwner === 'error') return route.fulfill(envelope(null, { status: 500, success: false, message: 'boom' }))
      if (byOwner === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (byOwner === 'notSetUp') return route.fulfill(refusal(503, 'NOT_SET_UP', NOT_SET_UP))
      if (ownerKey === 'P019/2026-09-20')
        return route.fulfill(
          envelope(
            STORED.filter((s) => !goneIds.has(s.attachmentId)),
            { siblings: { withdrawn: WITHDRAWN } },
          ),
        )
      return route.fulfill(envelope([], { siblings: { withdrawn: [] } }))
    }
    const content = /^AttachmentWeb\/([^/]+)\/Content$/.exec(path ?? '')
    if (content) {
      const id = decodeURIComponent(content[1])
      contentCalls[id] = (contentCalls[id] ?? 0) + 1
      if (id === GONE.attachmentId) {
        goneIds.add(id)
        return route.fulfill(refusal(404, 'NOT_FOUND', CONTENT_404))
      }
      if (id === LOST.attachmentId) return route.fulfill(refusal(502, 'FILE_SERVER_MISSING', CONTENT_502))
      const file = bytes[id]
      if (!file) return route.fulfill(refusal(404, 'NOT_FOUND', CONTENT_404))
      return route.fulfill({
        status: 200,
        contentType: file.type,
        headers: { 'Content-Disposition': `attachment; filename="x"` },
        body: file.body,
      })
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/321-${name}.png`, fullPage: false })
  const drawer = () => page.locator('dialog[data-region="slip-drawer"]')
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(slips|ready|collections|collection|common)\.[a-zA-Z]+(\.[a-zA-Z]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const load = async (path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
    await page.locator('.ag-row').first().waitFor()
  }
  const readyCell = (row) => page.locator(`.ag-row[row-id="${readyId(row)}"] [col-id="slipCount"]`).first()
  const indexCell = (i) => page.locator(`.ag-row[row-index="${i}"] [col-id="slipCount"]`).first()
  const urls = () => page.evaluate(() => ({ made: [...window.__urls.made], revoked: [...window.__urls.revoked] }))
  const listRow = (s) => drawer().locator(`tr[data-slip="${s.attachmentId}"]`)
  const pick = async (s) => {
    await listRow(s).getByRole('button').click()
    await drawer().locator(`[data-preview-for="${s.attachmentId}"]`).waitFor()
  }
  const previewKind = async (s) => {
    const el = drawer().locator(`[data-preview-for="${s.attachmentId}"][data-preview-kind]`)
    await el.waitFor({ timeout: 8000 }).catch(() => {})
    return el.count().then((n) => (n ? el.getAttribute('data-preview-kind') : null))
  }
  const closeDrawer = async () => {
    await page.getByTestId('slip-drawer-close').click()
    await drawer().waitFor({ state: 'detached' })
  }
  const reset = () => {
    byOwner = 'normal'
    byOwnerHold = null
    byOwnerCalls = []
    contentCalls = {}
    goneIds = new Set()
  }

  // ════════════════════════════ READY ════════════════════════════
  reset()
  await load(READY)
  check('ready — a known count is a button', (await readyCell(DAY).getByRole('button').count()) === 1)
  check('ready — a 0 is a button too', (await readyCell(DAY_ZERO).getByRole('button').count()) === 1)
  check('ready — a null count is a plain dash, not clickable', (await readyCell(RECEIPT).locator('button, a').count()) === 0)
  check('ready — …and nothing opens when the dash is clicked', await (async () => {
    await readyCell(RECEIPT).click()
    await page.waitForTimeout(300)
    return (await drawer().count()) === 0 && byOwnerCalls.length === 0
  })())

  // ---- 1. open a day ----
  await readyCell(DAY).getByRole('button').click()
  await drawer().waitFor()
  await drawer().locator('[data-testid="slip-list"]').waitFor()
  await shot('ready-drawer')
  check('ready — the drawer opens over the grid, same page', (await drawer().isVisible()) && page.url().endsWith(READY))
  const title = await drawer().locator('h2').innerText()
  check('ready — the drawer names its day (store, business date)', title.includes('PH-019 (P019)') && title.includes('2026-09-20'), title)
  check(
    'ready — ByOwner asked for STORE_DAY and the row’s own key',
    byOwnerCalls.length === 1 && byOwnerCalls[0].ownerKind === 'STORE_DAY' && byOwnerCalls[0].ownerKey === 'P019/2026-09-20',
    JSON.stringify(byOwnerCalls),
  )
  const order = await drawer().locator('tr[data-slip]').evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-slip')))
  check('ready — one row per stored slip, in the order sent', JSON.stringify(order) === JSON.stringify(STORED.map((s) => s.attachmentId)), order.join(','))
  check('ready — file name shown', (await listRow(JPEG).innerText()).includes('ecr-slip-till-1.jpg'))
  check(
    'ready — uploaded at is the wall clock as sent (T cut, fraction dropped, never re-zoned)',
    (await listRow(JPEG).locator('[data-cell="storedAt"]').innerText()) === '2026-09-20 23:12:44' &&
      (await listRow(PNG).locator('[data-cell="storedAt"]').innerText()) === '2026-09-21 09:30:05',
  )
  check('ready — a till upload names the device', (await listRow(JPEG).locator('[data-cell="till"]').innerText()) === 'P001-01')
  const webTill = await listRow(PNG).locator('[data-cell="till"]').innerText()
  check('ready — a web upload reads "Web · <uploadedBy>" (U+00B7)', webTill === 'Web \u00b7 U123', JSON.stringify(webTill))

  // ---- 2. previews ----
  await pick(JPEG)
  check('preview — a jpeg shows as an image', (await previewKind(JPEG)) === 'image')
  const img = drawer().locator('[data-region="slip-preview"] img')
  await img.waitFor()
  const jpegSrc = await img.getAttribute('src')
  check('preview — …from an object URL', jpegSrc?.startsWith('blob:'), jpegSrc)
  check('preview — …that actually decodes', await img.evaluate((el) => el.complete && el.naturalWidth > 0))
  await shot('preview-jpeg')

  await pick(PNG)
  check('preview — a png shows as an image', (await previewKind(PNG)) === 'image')
  await drawer().locator('[data-region="slip-preview"] img').waitFor()
  let u = await urls()
  check('preview — the jpeg’s URL is revoked when the selection changes', u.revoked.includes(jpegSrc))

  // ---- 3. download: the same blob, under fileName, no second fetch ----
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('slip-download').click()])
  check('download — saves under fileName', download.suggestedFilename() === 'emailed slip.png', download.suggestedFilename())
  const saved = await download.path().then((p) => require('node:fs').readFileSync(p))
  check('download — …the same bytes the preview shows', saved.equals(bytes[PNG.attachmentId].body))
  check('download — …with no second fetch', contentCalls[PNG.attachmentId] === 1, `${contentCalls[PNG.attachmentId]} fetches`)

  await pick(PDF)
  check('preview — a pdf shows in a frame', (await previewKind(PDF)) === 'pdf')
  const frameSrc = await drawer().locator('[data-region="slip-preview"] iframe').getAttribute('src')
  check('preview — …from an object URL', frameSrc?.startsWith('blob:'), frameSrc)
  await shot('preview-pdf')

  await pick(TXT)
  check('preview — another type shows no preview', (await previewKind(TXT)) === 'none' && (await drawer().getByTestId('slip-no-preview').count()) === 1)
  check('preview — …and no image or frame', (await drawer().locator('[data-region="slip-preview"] img, [data-region="slip-preview"] iframe').count()) === 0)
  const [txtDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('slip-download').click()])
  check('preview — …but its download still works', txtDownload.suggestedFilename() === 'notes.txt', txtDownload.suggestedFilename())

  // ---- 4. /Content refusals ----
  const callsBefore = byOwnerCalls.length
  await listRow(GONE).getByRole('button').click()
  await drawer().getByTestId('slip-gone').waitFor({ timeout: 8000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  const goneText = await drawer().getByTestId('slip-gone').innerText().catch(() => '')
  check('404 — says the slip is no longer readable', goneText.includes('withdrawn-meanwhile.jpg') && goneText.includes('no longer readable'), goneText)
  check('404 — ByOwner is read again', byOwnerCalls.length === callsBefore + 1, `${byOwnerCalls.length - callsBefore} re-reads`)
  await listRow(GONE).waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  check('404 — …and the slip leaves the list', (await listRow(GONE).count()) === 0)
  await shot('content-404')

  await listRow(LOST).getByRole('button').click()
  await drawer().getByTestId('slip-lost').waitFor({ timeout: 8000 }).catch(() => {})
  const lostText = await drawer().getByTestId('slip-lost').innerText().catch(() => '')
  check('502 — says the File Server lost the file, not the user’s fault', lostText.includes('no longer holds this file') && lostText.includes('not something you did'), lostText)
  check('502 — …with the server’s own words under it, as sent', lostText.includes('File metadata missing'))
  check('502 — …and no retry', (await drawer().locator('[data-region="slip-preview"]').getByRole('button', { name: /retry|try again/i }).count()) === 0)
  check('502 — …asked once (no automatic retry)', contentCalls[LOST.attachmentId] === 1, `${contentCalls[LOST.attachmentId]} fetches`)
  check('502 — download stays disabled with no bytes', await page.getByTestId('slip-download').isDisabled())
  await shot('content-502')

  // ---- 5. Withdrawn (n) ----
  const details = drawer().getByTestId('slip-withdrawn')
  check('withdrawn — the section says Withdrawn (n) with n = withdrawn.length', (await details.locator('summary').innerText()).trim() === `Withdrawn (${WITHDRAWN.length})`)
  check('withdrawn — collapsed by default', !(await details.evaluate((d) => d.open)) && !(await details.locator('li').first().isVisible()))
  await details.locator('summary').click()
  check('withdrawn — expands on a click', await details.evaluate((d) => d.open))
  await shot('withdrawn-open')
  const wOrder = await details.locator('li[data-withdrawn]').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-withdrawn')))
  check('withdrawn — newest withdrawal first (sent oldest first)', JSON.stringify(wOrder) === JSON.stringify(['01K60W0000000000000000NEW1', '01K60W0000000000000000OLD1']), wOrder.join(','))
  const newest = details.locator('li[data-withdrawn="01K60W0000000000000000NEW1"]')
  const older = details.locator('li[data-withdrawn="01K60W0000000000000000OLD1"]')
  const newestText = await newest.innerText()
  check('withdrawn — file name, till, who and when as sent', newestText.includes('wrong-day.jpg') && (await newest.locator('[data-cell="till"]').innerText()) === 'P001-01' && newestText.includes('Withdrawn by U456 at 2026-09-26 08:01:02'), newestText)
  check('withdrawn — a web upload’s till reads "Web · <uploadedBy>"', (await older.locator('[data-cell="till"]').innerText()) === 'Web \u00b7 U123')
  const reason = await older.locator('[data-cell="reason"]').innerText()
  check('withdrawn — the reason is reasonLabel beside reasonLabelArabic', reason.includes('Duplicate') && reason.includes('مكرر'), reason)
  check('withdrawn — the note is shown when given', newestText.includes('Belongs to P020') && (await older.locator('[data-cell="note"]').count()) === 0)
  check('withdrawn — no preview and no download inside', (await details.locator('button, a, img, iframe').count()) === 0)
  check('withdrawn — nothing ever fetched a withdrawn slip’s bytes', WITHDRAWN.every((w) => !contentCalls[w.attachmentId]))
  await noRawKeys('ready — drawer')

  // ---- 6. close revokes every object URL ----
  await pick(JPEG)
  await drawer().locator('[data-region="slip-preview"] img').waitFor()
  await closeDrawer()
  await page.waitForTimeout(200)
  u = await urls()
  const unrevoked = u.made.filter((x) => !u.revoked.includes(x))
  check('close — the drawer is gone and the grid is still there', (await drawer().count()) === 0 && (await page.locator('.ag-row').count()) > 0)
  check('close — every object URL made is revoked (URL.revokeObjectURL counted)', u.made.length > 0 && unrevoked.length === 0, `${u.made.length} made, ${u.revoked.length} revoke calls, ${unrevoked.length} left`)

  // Escape closes too.
  await readyCell(DAY).getByRole('button').click()
  await drawer().waitFor()
  await page.keyboard.press('Escape')
  await drawer().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check('close — Escape dismisses the drawer', (await drawer().count()) === 0)

  // ---- 1b. a 0 opens its own day, and says it has no slip ----
  byOwnerCalls = []
  await readyCell(DAY_ZERO).getByRole('button').click()
  await drawer().getByTestId('slip-empty').waitFor()
  await shot('ready-empty')
  check('0 — opens the row’s own day, P019/2026-09-24', byOwnerCalls.at(-1)?.ownerKey === 'P019/2026-09-24', JSON.stringify(byOwnerCalls))
  check('0 — says the day has no slip', (await drawer().getByTestId('slip-empty').innerText()).includes('No slip is filed for this day'))
  check('0 — no Withdrawn section when n = 0', (await drawer().getByTestId('slip-withdrawn').count()) === 0)
  await closeDrawer()

  // ---- 7. ByOwner: loading, error, refusal ----
  // A fresh page, so the day is not already cached (a re-opened day shows its last list while it re-reads).
  await load(READY)
  let release
  byOwnerHold = new Promise((r) => (release = r))
  await readyCell(DAY).getByRole('button').click()
  await drawer().waitFor()
  check('ByOwner — loading shows a status while the list is on its way', (await drawer().getByRole('status', { name: 'Loading the day’s slips…' }).count()) + (await drawer().getByRole('status', { name: "Loading the day's slips…" }).count()) > 0)
  release()
  byOwnerHold = null
  await drawer().locator('[data-testid="slip-list"]').waitFor()
  await closeDrawer()

  for (const [name, answer, expected] of [
    ['a 500 is an error', 'error', 'unexpected error'],
    ['a bare 403 is a refusal', 'forbidden', 'not allowed to read this day'],
    ['a 503 NOT_SET_UP shows the server’s message as sent', 'notSetUp', 'مخزن المرفقات'],
  ]) {
    byOwner = answer
    await readyCell(DAY).getByRole('button').click()
    await drawer().getByTestId('slip-list-error').waitFor({ timeout: 8000 }).catch(() => {})
    const text = await drawer().getByTestId('slip-list-error').innerText().catch(() => '')
    check(`ByOwner — ${name}`, text.toLowerCase().includes(expected.toLowerCase()) && (await drawer().getByTestId('slip-list').count()) === 0, text)
    if (answer === 'forbidden') await shot('byowner-refused')
    await closeDrawer()
  }
  byOwner = 'normal'
  await noRawKeys('ready — states')

  // ═════════════════════════ CASH COLLECTIONS ═════════════════════════
  reset()
  await load(COLLECTIONS)
  check('collections — the 0 and the 3 are buttons; the settlement row’s null is not', (await indexCell(0).getByRole('button').count()) === 1 && (await indexCell(1).getByRole('button').count()) === 1 && (await indexCell(2).locator('button, a').count()) === 0)
  await indexCell(1).getByRole('button').click()
  await drawer().waitFor()
  await drawer().getByTestId('slip-empty').waitFor()
  check('collections — a multi-shift receipt’s second row opens ITS day, P019/2026-09-02', byOwnerCalls.at(-1)?.ownerKey === 'P019/2026-09-02', JSON.stringify(byOwnerCalls))
  const cTitle = await drawer().locator('h2').innerText()
  check('collections — the drawer names that day', cTitle.includes('PH-019 (P019)') && cTitle.includes('2026-09-02'), cTitle)
  await shot('collections-drawer')
  await closeDrawer()
  await indexCell(0).getByRole('button').click()
  await drawer().waitFor()
  await drawer().getByTestId('slip-empty').waitFor()
  check('collections — the first row (a 0) opens its own day, P019/2026-09-01', byOwnerCalls.at(-1)?.ownerKey === 'P019/2026-09-01')
  await closeDrawer()
  check('collections — still on the collection screen', page.url().endsWith(COLLECTIONS))
  await noRawKeys('collections')

  // A refused probe hides the column, so no count can open anything.
  probe = 'notSetUp'
  await load(COLLECTIONS)
  check('probe refused — no slip button anywhere', (await page.locator('[data-slip-open]').count()) === 0)
  probe = 'holder'

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
