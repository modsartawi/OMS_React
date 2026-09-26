// Add slip drive (spec 319, ticket 322) — drives the REAL app in Chromium against STUBBED
// envelopes shaped exactly as BackOffice 2035 records them under `## Web contract` (Add slip),
// cross-checked against AttachmentWebEndpoints.cs, AttachmentUploadHandler.cs,
// AttachmentFormFields.cs, AttachmentUploadResult.cs, AttachmentRefusal.cs and
// AttachmentMessages.cs on pricing2:
//   - `POST AttachmentWeb/Upload`, multipart, one file per request, parts ClientRequestId,
//     OwnerKind, OwnerKey, Category, Kind, File — answers the stored AttachmentDto at 200, or a
//     bilingual coded refusal (English + Environment.NewLine + Arabic).
//
// ⚠️ Stubbed, never live: no SIS.Api with the File Server key set is up for this wave.
//
// Verifies ticket 322's drive Proof:
//   1. three files picked, one too large and one the wrong type: both refused in the browser,
//      only one request sent — and the 10,485,760-byte edge sent;
//   2. the request carries exactly the six parts, no SourceDevice, and the row's own owner key;
//   3. a FILE_SERVER_UNREACHABLE retried with the SAME ClientRequestId (the bodies asserted);
//   4. a NOT_SET_UP (the same 503) offering no retry, its message as sent; a bare 403 and a
//      coded refusal offering none either; a network failure and a non-JSON 502 offering one;
//   5. a 200 re-reading ByOwner (the new slip shows "Web · <uploadedBy>"), the grid NOT refetched;
//   6. the drawer not dismissible while a file is in flight (close disabled, Escape, backdrop);
//   7. a collected Collections row taking Add as readily, under its own day's key (C3);
//   8. Add hidden when the probe lacks CASH_CLOSE (and for a bare string "CASH_CLOSE");
//   9. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/slip-add-drive.mjs
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
const refusal = (status, code, message, data = null) =>
  envelope(data, { status, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })

/** AttachmentMessages.Bilingual: English + Environment.NewLine + Arabic. */
const bilingual = (en, ar) => `${en}\r\n${ar}`
const MSG = {
  unreachable: bilingual('The file server could not be reached. Try again.', 'تعذر الوصول إلى خادم الملفات. حاول مرة أخرى.'),
  notSetUp: bilingual('The attachment store is not set up on this server.', 'مخزن المرفقات غير مُعدّ على هذا الخادم.'),
  captureReused: bilingual(
    'This capture was already used for something else. Take it again.',
    'سبق استخدام هذه اللقطة لغرض آخر. التقطها مرة أخرى.',
  ),
}

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
  slipCount: 0,
}
const READY_ROWS = [DAY]
const readyId = (row) => `DAY:${row.shiftId}`

const SHIFT = {
  storeId: 'P019',
  openedAt: '2026-09-02T08:00:00',
  closedAt: '2026-09-02T23:10:40',
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
  businessDay: '2026-09-02T00:00:00',
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
  salesDate: '2026-09-02T00:00:00',
  currencyKey: 'SAR',
  slipCount: 3,
}
const COLLECTION_ROWS = [SHIFT]

// ---- the stubbed doors ----
let probe = { categories: ['CASH_CLOSE'], withdrawCategories: ['CASH_CLOSE'] }
/** Queue of answers for the next uploads; an empty queue answers 200. */
let uploadAnswers = []
let uploadHold = null
let uploads = []
let byOwnerCalls = []
let readyCalls = 0
let filed = {}
/** Every stored upload gets its own id, across resets. */
let storedSeq = 0

/** Split a multipart body into its parts: name, filename (a file part) and value. */
function parts(request) {
  const type = request.headers()['content-type'] ?? ''
  const boundary = /boundary=(.+)$/.exec(type)?.[1]
  const body = request.postDataBuffer()?.toString('latin1') ?? ''
  if (!boundary) return { type, list: [] }
  const list = body
    .split(`--${boundary}`)
    .slice(1, -1)
    .map((chunk) => {
      const [head, ...rest] = chunk.replace(/^\r\n/, '').split('\r\n\r\n')
      const name = /name="([^"]*)"/.exec(head)?.[1]
      const filename = /filename="([^"]*)"/.exec(head)?.[1] ?? null
      const value = rest.join('\r\n\r\n').replace(/\r\n$/, '')
      return { name, filename, value: filename === null ? Buffer.from(value, 'latin1').toString('utf8') : null, size: value.length }
    })
  return { type, list }
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 2600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.split('/api/')[1]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    if (path === 'AttachmentWeb/Access') return route.fulfill(envelope(probe))
    if (path === 'CollectionWeb/Ready') {
      readyCalls += 1
      return route.fulfill(envelope(READY_ROWS, { siblings: { slipCountsUnavailable: false } }))
    }
    if (path === 'CollectionWeb/Collections')
      return route.fulfill(envelope(COLLECTION_ROWS, { siblings: { slipCountsUnavailable: false } }))
    if (path === 'AttachmentWeb/ByOwner') {
      const ownerKey = url.searchParams.get('ownerKey')
      byOwnerCalls.push(ownerKey)
      return route.fulfill(envelope(filed[ownerKey] ?? [], { siblings: { withdrawn: [] } }))
    }
    if (path === 'AttachmentWeb/Upload' && request.method() === 'POST') {
      const body = parts(request)
      uploads.push(body)
      if (uploadHold) await uploadHold
      const answer = uploadAnswers.shift() ?? 'ok'
      if (answer === 'unreachable') return route.fulfill(refusal(503, 'FILE_SERVER_UNREACHABLE', MSG.unreachable))
      if (answer === 'notSetUp') return route.fulfill(refusal(503, 'NOT_SET_UP', MSG.notSetUp))
      if (answer === 'captureReused') return route.fulfill(refusal(409, 'CAPTURE_REUSED', MSG.captureReused))
      if (answer === 'bare403') return route.fulfill({ status: 403, body: '' })
      if (answer === 'html502')
        return route.fulfill({ status: 502, contentType: 'text/html', body: '<html><body>502 Bad Gateway</body></html>' })
      if (answer === 'abort') return route.abort('connectionreset')
      const get = (n) => body.list.find((p) => p.name === n)
      const ownerKey = get('OwnerKey')?.value
      const dto = {
        attachmentId: `01K60UPLOAD${String(storedSeq++).padStart(15, '0')}`,
        status: 'STORED',
        ownerKind: 'STORE_DAY',
        ownerKey,
        category: 'CASH_CLOSE',
        kind: 'ECR_SLIP',
        fileName: get('File')?.filename,
        sizeBytes: get('File')?.size,
        storedAt: '2026-09-26T10:15:30.1234567',
        sourceDevice: '',
        uploadedBy: 'U900',
      }
      filed[ownerKey] = [dto, ...(filed[ownerKey] ?? [])]
      return route.fulfill(envelope(dto))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/322-${name}.png`, fullPage: false })
  const drawer = () => page.locator('dialog[data-region="slip-drawer"]')
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(slips|ready|collections|collection|common)\.[a-zA-Z]+(\.[a-zA-Z-]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const load = async (path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
    await page.locator('.ag-row').first().waitFor()
  }
  const openDay = async (cell) => {
    await cell.getByRole('button').click()
    await drawer().waitFor()
    await drawer().locator('[data-testid="slip-list"], [data-testid="slip-empty"]').first().waitFor()
  }
  const readyCell = () => page.locator(`.ag-row[row-id="${readyId(DAY)}"] [col-id="slipCount"]`).first()
  const payload = (name, size, mimeType) => ({ name, mimeType, buffer: Buffer.alloc(size, 0x41) })
  const pick = (...files) => drawer().getByTestId('slip-add-input').setInputFiles(files)
  const row = (name) => drawer().locator(`li[data-upload="${name}"]`)
  const status = (name) => row(name).getAttribute('data-status')
  const settled = (name) =>
    page.waitForFunction(
      (n) => {
        const li = document.querySelector(`dialog[data-region="slip-drawer"] li[data-upload="${n}"]`)
        return li && !['queued', 'sending'].includes(li.getAttribute('data-status'))
      },
      name,
      { timeout: 8000 },
    ).catch(() => {})
  const value = (body, name) => body.list.find((p) => p.name === name)?.value
  const retryButton = (name) => row(name).getByTestId('slip-upload-retry')
  const closeDrawer = async () => {
    await page.getByTestId('slip-drawer-close').click()
    await drawer().waitFor({ state: 'detached' })
  }
  const reset = () => {
    uploadAnswers = []
    uploadHold = null
    uploads = []
    byOwnerCalls = []
  }

  // ════════════════════════════ READY ════════════════════════════
  reset()
  await load(READY)
  const readyCallsAtLoad = readyCalls
  await openDay(readyCell())
  check('Add — shown in a 0 day’s drawer', (await drawer().getByTestId('slip-add').count()) === 1)
  check('Add — the picker is multi-select and offers jpg/jpeg/png/pdf', await drawer().getByTestId('slip-add-input').evaluate((el) => el.multiple && el.accept === '.jpg,.jpeg,.png,.pdf'))

  // ---- 1. three files: one too large, one the wrong type ----
  byOwnerCalls = []
  await pick(
    payload('good-slip.jpg', 2048, 'image/jpeg'),
    payload('huge-slip.jpg', 10_485_761, 'image/jpeg'),
    payload('notes.txt', 64, 'text/plain'),
  )
  await settled('good-slip.jpg')
  await shot('three-picked')
  check('pick — only one request sent for the three files', uploads.length === 1, `${uploads.length} requests`)
  check('pick — the good file is stored', (await status('good-slip.jpg')) === 'stored')
  check('pick — the oversize file is refused in the browser, with its reason', (await status('huge-slip.jpg')) === 'local-refused' && (await row('huge-slip.jpg').innerText()).includes('larger than 10 MB'))
  check('pick — the wrong type is refused in the browser, with its reason', (await status('notes.txt')) === 'local-refused' && (await row('notes.txt').innerText()).includes('only JPG, PNG or PDF'))
  check('pick — neither refused file was sent', uploads.every((u) => !u.list.some((p) => ['huge-slip.jpg', 'notes.txt'].includes(p.filename))))

  // ---- 2. the six parts ----
  const first = uploads[0]
  check('form — multipart/form-data with a boundary the browser set', /^multipart\/form-data; boundary=/.test(first.type), first.type)
  check('form — exactly the six parts, in order', JSON.stringify(first.list.map((p) => p.name)) === JSON.stringify(['ClientRequestId', 'OwnerKind', 'OwnerKey', 'Category', 'Kind', 'File']), first.list.map((p) => p.name).join(','))
  check('form — no SourceDevice', !first.list.some((p) => p.name === 'SourceDevice'))
  check('form — OwnerKind STORE_DAY, Category CASH_CLOSE, Kind ECR_SLIP', value(first, 'OwnerKind') === 'STORE_DAY' && value(first, 'Category') === 'CASH_CLOSE' && value(first, 'Kind') === 'ECR_SLIP')
  check('form — OwnerKey is the row’s own store day', value(first, 'OwnerKey') === 'P019/2026-09-20', value(first, 'OwnerKey'))
  check('form — ClientRequestId is a v4 UUID', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value(first, 'ClientRequestId') ?? ''), value(first, 'ClientRequestId'))
  const filePart = first.list.find((p) => p.name === 'File')
  check('form — the File part is the picked file, under its name', filePart?.filename === 'good-slip.jpg' && filePart?.size === 2048)

  // ---- 5. a 200 re-reads ByOwner; the grid is not refetched ----
  await drawer().locator('[data-testid="slip-list"]').waitFor({ timeout: 8000 }).catch(() => {})
  check('200 — ByOwner is read again', byOwnerCalls.length >= 1 && byOwnerCalls.every((k) => k === 'P019/2026-09-20'), JSON.stringify(byOwnerCalls))
  const newRow = drawer().locator('tr[data-slip]').first()
  check('200 — the new slip lands in the list', (await newRow.innerText().catch(() => '')).includes('good-slip.jpg'))
  check('200 — …as "Web · <uploadedBy>"', (await newRow.locator('[data-cell="till"]').innerText().catch(() => '')) === 'Web \u00b7 U900')
  check('200 — the grid is not reloaded under the user', readyCalls === readyCallsAtLoad, `${readyCalls - readyCallsAtLoad} grid reads`)
  check('200 — the row’s count stays as the grid last read it (stale until reload)', (await readyCell().innerText()).trim() === '0')

  // ---- the 10 MiB edge is sent ----
  reset()
  await pick(payload('edge-slip.png', 10_485_760, 'image/png'))
  await settled('edge-slip.png')
  check('edge — exactly 10,485,760 bytes is sent and stored', uploads.length === 1 && (await status('edge-slip.png')) === 'stored')

  // ---- 3. FILE_SERVER_UNREACHABLE, retried with the same id ----
  reset()
  uploadAnswers = ['unreachable']
  await pick(payload('flaky-slip.jpg', 1024, 'image/jpeg'))
  await settled('flaky-slip.jpg')
  await shot('unreachable')
  const flakyText = await row('flaky-slip.jpg').innerText()
  check('unreachable — refused, with the server’s message as sent (English, then Arabic)', (await status('flaky-slip.jpg')) === 'refused' && flakyText.includes('could not be reached') && flakyText.includes('تعذر الوصول إلى خادم الملفات'), flakyText)
  check('unreachable — offers a retry', (await retryButton('flaky-slip.jpg').count()) === 1)
  await retryButton('flaky-slip.jpg').click()
  await settled('flaky-slip.jpg')
  check('retry — a second request was sent, and it is stored', uploads.length === 2 && (await status('flaky-slip.jpg')) === 'stored')
  const [a, b] = uploads
  check('retry — the SAME ClientRequestId on both bodies', value(a, 'ClientRequestId') && value(a, 'ClientRequestId') === value(b, 'ClientRequestId'), `${value(a, 'ClientRequestId')} / ${value(b, 'ClientRequestId')}`)
  check('retry — the same owner key and file on both bodies', value(a, 'OwnerKey') === value(b, 'OwnerKey') && a.list.find((p) => p.name === 'File')?.filename === b.list.find((p) => p.name === 'File')?.filename)
  check('retry — no retry offered once stored', (await retryButton('flaky-slip.jpg').count()) === 0)

  // A newly picked copy of the same file is a new capture: a new id.
  await pick(payload('flaky-slip.jpg', 1024, 'image/jpeg'))
  await page.waitForFunction(() => document.querySelectorAll('dialog li[data-upload="flaky-slip.jpg"][data-status="stored"]').length === 2, null, { timeout: 8000 }).catch(() => {})
  check('re-pick — a new pick of the same file gets a new ClientRequestId', uploads.length === 3 && value(uploads[2], 'ClientRequestId') !== value(a, 'ClientRequestId'))

  // ---- 4. no retry where it cannot help; one where it can ----
  let offlineId = null
  for (const [answer, name, retry, expect] of [
    ['notSetUp', 'not-set-up.jpg', false, 'مخزن المرفقات غير مُعدّ'],
    ['captureReused', 'reused.jpg', false, 'already used for something else'],
    ['bare403', 'forbidden.jpg', false, '403'],
    ['abort', 'offline.jpg', true, ''],
    ['html502', 'gateway.jpg', true, ''],
  ]) {
    reset()
    uploadAnswers = [answer]
    await pick(payload(name, 512, 'image/jpeg'))
    await settled(name)
    const text = await row(name).innerText()
    check(`${answer} — refused${expect ? ', message shown' : ''}`, (await status(name)) === 'refused' && text.includes(expect), text.replace(/\s+/g, ' '))
    check(`${answer} — ${retry ? 'offers a retry' : 'offers NO retry'}`, (await retryButton(name).count()) === (retry ? 1 : 0))
    if (answer === 'notSetUp') await shot('not-set-up')
    if (answer === 'abort') offlineId = value(uploads[0], 'ClientRequestId')
  }

  // ---- 6. not dismissible while in flight ----
  reset()
  let release
  uploadHold = new Promise((r) => (release = r))
  await pick(payload('slow-slip.jpg', 1024, 'image/jpeg'))
  await page.waitForFunction(() => document.querySelector('dialog li[data-upload="slow-slip.jpg"]')?.getAttribute('data-status') === 'sending')
  await shot('in-flight')
  check('in flight — the close button is disabled', await page.getByTestId('slip-drawer-close').isDisabled())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('in flight — Escape (twice) does not dismiss', (await drawer().count()) === 1 && (await drawer().evaluate((d) => d.open)))
  await page.mouse.click(20, 500)
  await page.waitForTimeout(200)
  check('in flight — a backdrop click does not dismiss', (await drawer().count()) === 1 && (await drawer().evaluate((d) => d.open)))
  check('in flight — the file was sent once', uploads.length === 1)
  release()
  uploadHold = null
  await settled('slow-slip.jpg')
  check('in flight — once stored, the drawer closes', await (async () => {
    await closeDrawer()
    return (await drawer().count()) === 0
  })())

  // Re-opened: the settled files are forgotten; a file a retry can still help keeps its row (and id).
  await openDay(readyCell())
  const kept = await drawer().locator('li[data-upload]').evaluateAll((lis) => lis.map((li) => `${li.getAttribute('data-upload')}:${li.getAttribute('data-status')}`))
  check('re-open — stored and finally-refused uploads are gone; only the two retryable ones remain', JSON.stringify(kept) === JSON.stringify(['offline.jpg:refused', 'gateway.jpg:refused']), kept.join(','))
  check('re-open — …still offering their retry', (await retryButton('offline.jpg').count()) === 1 && (await retryButton('gateway.jpg').count()) === 1)
  reset()
  await retryButton('offline.jpg').click()
  await settled('offline.jpg')
  check('re-open — a retry after close/re-open still sends the SAME id', uploads.length === 1 && (await status('offline.jpg')) === 'stored' && value(uploads[0], 'ClientRequestId') === offlineId, `${value(uploads[0], 'ClientRequestId')} / ${offlineId}`)
  await noRawKeys('ready — Add')
  await closeDrawer()

  // ═════════════════════════ CASH COLLECTIONS ═════════════════════════
  reset()
  await load(COLLECTIONS)
  await openDay(page.locator('.ag-row[row-index="0"] [col-id="slipCount"]').first())
  check('collections — a collected row’s drawer offers Add too (C3)', (await drawer().getByTestId('slip-add').count()) === 1)
  await pick(payload('emailed.pdf', 4096, 'application/pdf'))
  await settled('emailed.pdf')
  check('collections — filed under the row’s own day, P019/2026-09-02', uploads.length === 1 && value(uploads[0], 'OwnerKey') === 'P019/2026-09-02' && (await status('emailed.pdf')) === 'stored', value(uploads[0], 'OwnerKey'))
  await shot('collections-add')
  await noRawKeys('collections — Add')
  await closeDrawer()

  // ════════════════════ THE PROBE HIDES ADD ════════════════════
  for (const [name, answer] of [
    ['a probe without CASH_CLOSE', { categories: ['OTHER'], withdrawCategories: [] }],
    ['a bare string "CASH_CLOSE"', { categories: 'CASH_CLOSE', withdrawCategories: 'CASH_CLOSE' }],
  ]) {
    probe = answer
    await load(READY)
    check(`hidden — ${name}: no Add and no count to open`, (await page.getByTestId('slip-add').count()) === 0 && (await page.locator('[data-slip-open]').count()) === 0)
  }
  probe = { categories: ['CASH_CLOSE'], withdrawCategories: ['CASH_CLOSE'] }

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
