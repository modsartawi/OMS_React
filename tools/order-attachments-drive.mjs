// Order attachments drive (spec 324, ticket 327) — drives the REAL app in Chromium against STUBBED
// envelopes, with the network COUNTED. The document is a captured payload from
// `.issues/assets/078-document-payloads/` with the three attachment fields patched in, shaped exactly as
// the BackOffice contracts record them (cross-checked against the committed code on pricing2):
//   - `GET SdDocumentWeb/Document/{no}` / `Delivery/{no}` — `attachmentOwnerNo` + `attachmentCount`
//     (2063, SdDocumentHeaderModel.cs: both omitted when null) and `attachmentCategory` (2077's
//     `## Web contract` STUB — not built yet; omitted when null);
//   - `GET AttachmentWeb/Access` — `{ categories, withdrawCategories }`, or a 503 `NOT_SET_UP` / bare 403;
//   - `GET AttachmentWeb/ByOwner?ownerKind=SD_DOCUMENT&ownerKey=<attachmentOwnerNo>` — `data` = AttachmentDto[]
//     (with 2056's `caption` and 2067's `storeCode`), `withdrawn` + `withdrawReasons` BESIDE `data`
//     (AttachmentOwnerListResponse.cs), or a 503 `READ_NOT_AUDITED`;
//   - `GET AttachmentWeb/{id}/Content` — the bytes, or 404 `NOT_FOUND` / 502 `FILE_SERVER_MISSING` /
//     503 `READ_NOT_AUDITED` (AttachmentContentResult.cs).
//
// ⚠️ Stubbed, never live: no SIS.Api serving 2077 is up for this wave.
//
// 🔑 THE PROOF IS THE COUNT. Every ByOwner and every /Content writes an audit row on the server, so:
//   - ZERO ByOwner on page load, exactly ONE on the tab's first selection, none on re-selection;
//   - Refresh before opening reads none; Refresh after opening reads one;
//   - no /Content until a file is clicked.
//
// Also: the tab hidden for no owner, no category, a refused probe, a malformed probe and a category not
// held; the badge from the model, then from the list, absent → none, 0 → 0; the list (name, caption,
// stamps, source); jpeg/png/pdf previews; download without a second fetch; the 404 / 502 /
// READ_NOT_AUDITED answers; Withdrawn (n); object URLs revoked on leave; a delivery lists its OWNER's files.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/order-attachments-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'

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
  body: JSON.stringify({ statusCode: status, success, message, errors, serverTime: '2026-09-27T09:00:00', data, ...siblings }),
})
const refusal = (status, code, message) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })

// ---- the documents: captured payloads, the attachment fields patched per case ----
const CAPTURED = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  CAPTURED[capture.data.documentNo] = capture.data
}
const ORDER = '2000000551'
const DELIVERY = '8000000253'
/** The fields each number answers with; a field left out is ABSENT on the wire, as the server omits a null. */
let fields = {}

// ---- the order's files (AttachmentDto: every field on pricing2) ----
const OWNER = ORDER
const item = (id, fileName, { caption = '', sourceDevice = '', uploadedBy = 'U123', storedAt, category = 'P2E' }) => ({
  attachmentId: id,
  status: 'STORED',
  ownerKind: 'SD_DOCUMENT',
  ownerKey: OWNER,
  category,
  kind: 'PRESCRIPTION',
  fileName,
  sizeBytes: 4096,
  storedAt,
  sourceDevice,
  uploadedBy,
  caption,
  storeCode: sourceDevice && !sourceDevice.startsWith('KEY:') ? 'P001' : '',
})
const ARABIC_CAPTION = 'الوصفة الطبية — صفحة ٢'
const JPEG = item('01K61A0000000000000000JPEG', 'rx-front.jpg', { caption: 'Front page', sourceDevice: 'P001-01', uploadedBy: '20145', storedAt: '2026-09-26T10:12:44.1234567' })
const PNG = item('01K61A00000000000000000PNG', 'emailed rx.png', { caption: ARABIC_CAPTION, storedAt: '2026-09-26T09:30:05' })
const PDF = item('01K61A00000000000000000PDF', 'altibbi.pdf', { sourceDevice: 'KEY:U777', uploadedBy: 'U777', storedAt: '2026-09-26T08:58:00', category: 'ALTIBBI' })
const GONE = item('01K61A0000000000000000GONE', 'withdrawn-meanwhile.jpg', { sourceDevice: 'P001-01', storedAt: '2026-09-26T08:30:00' })
const LOST = item('01K61A0000000000000000LOST', 'lost-by-file-server.jpg', { sourceDevice: 'P001-01', storedAt: '2026-09-26T08:20:00' })
const UNAUDITED = item('01K61A00000000000000NOAUD', 'unaudited.jpg', { sourceDevice: 'P001-01', storedAt: '2026-09-26T08:10:00' })
const STORED = [JPEG, PNG, PDF, GONE, LOST, UNAUDITED]

const withdrawn = (id, fileName, withdrawnAt, extra = {}) => ({
  attachmentId: id,
  category: 'P2E',
  kind: 'PRESCRIPTION',
  fileName,
  sourceDevice: '',
  uploadedBy: 'U123',
  storedAt: '2026-09-25T22:31:07',
  withdrawnBy: 'U456',
  withdrawnAt,
  reasonCode: 'DUPLICATE',
  reasonLabel: 'Duplicate',
  reasonLabelArabic: 'مكرر',
  note: '',
  ...extra,
})
// Sent OLDEST first on purpose: the list must still show the newest withdrawal first.
const WITHDRAWN = [
  withdrawn('01K61W0000000000000000OLD1', 'older-duplicate.jpg', '2026-09-25T23:12:40'),
  withdrawn('01K61W0000000000000000NEW1', 'wrong-customer.jpg', '2026-09-26T07:01:02', {
    sourceDevice: 'P001-01',
    uploadedBy: '20145',
    reasonCode: 'WRONG_ORDER',
    reasonLabel: 'Wrong order or customer',
    reasonLabelArabic: 'طلب أو عميل غير صحيح',
    note: 'Belongs to 2000000552',
  }),
]
// 2062's SD_DOCUMENT reasons, beside `data`. 327 does not read them (331 does); they ride along so the
// list is proven not to trip over the sibling.
const REASONS = [
  { code: 'WRONG_ORDER', label: 'Wrong order or customer', labelArabic: 'طلب أو عميل غير صحيح', noteRequired: false },
  { code: 'OTHER', label: 'Other', labelArabic: 'سبب آخر', noteRequired: true },
]

const CONTENT_404 = 'The attachment was not found.\nلم يتم العثور على المرفق.'
const CONTENT_502 =
  'The file server could not return this file: File metadata missing.\nتعذر على خادم الملفات إرجاع هذا الملف: File metadata missing.'
const NOT_AUDITED = 'The read could not be recorded, so the file is not shown.\nتعذر تسجيل القراءة، لذلك لا يُعرض الملف.'
const NOT_SET_UP = 'The attachment store is not set up on this server.\nمخزن المرفقات غير مُعدّ على هذا الخادم.'

let probe = 'holder'
let byOwner = 'normal'
let byOwnerCalls = []
let contentCalls = {}
let accessCalls = 0
let documentCalls = 0
let goneIds = new Set()
let bytes = {}

const contentTotal = () => Object.values(contentCalls).reduce((a, b) => a + b, 0)

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1800, height: 1100 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

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
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    // Leaving lands on the deliveries list: its grid and its filter lookups answer empty lists.
    if (p === 'SdDocumentWeb/DeliveryDocumentList' || /^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes|StoreDetails)$/.test(p))
      return route.fulfill(envelope([]))
    const doc = /^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/.exec(p)
    if (doc) {
      documentCalls += 1
      return route.fulfill(envelope({ ...CAPTURED[doc[1]], ...(fields[doc[1]] ?? {}) }))
    }
    if (/\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    if (p === 'AttachmentWeb/Access') {
      accessCalls += 1
      if (probe === 'notSetUp') return route.fulfill(refusal(503, 'NOT_SET_UP', NOT_SET_UP))
      if (probe === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (probe === 'bareString') return route.fulfill(envelope({ categories: 'P2E', withdrawCategories: 'P2E' }))
      if (probe === 'otherCategory') return route.fulfill(envelope({ categories: ['ERX'], withdrawCategories: [] }))
      return route.fulfill(envelope({ categories: ['P2E', 'ALTIBBI'], withdrawCategories: [] }))
    }
    if (p === 'AttachmentWeb/ByOwner') {
      byOwnerCalls.push({ ownerKind: url.searchParams.get('ownerKind'), ownerKey: url.searchParams.get('ownerKey') })
      if (byOwner === 'readNotAudited') return route.fulfill(refusal(503, 'READ_NOT_AUDITED', NOT_AUDITED))
      if (byOwner === 'empty') return route.fulfill(envelope([], { siblings: { withdrawn: [], withdrawReasons: REASONS } }))
      return route.fulfill(
        envelope(
          STORED.filter((s) => !goneIds.has(s.attachmentId)),
          { siblings: { withdrawn: WITHDRAWN, withdrawReasons: REASONS } },
        ),
      )
    }
    const content = /^AttachmentWeb\/([^/]+)\/Content$/.exec(p ?? '')
    if (content) {
      const id = decodeURIComponent(content[1])
      contentCalls[id] = (contentCalls[id] ?? 0) + 1
      if (id === GONE.attachmentId) {
        goneIds.add(id)
        return route.fulfill(refusal(404, 'NOT_FOUND', CONTENT_404))
      }
      if (id === LOST.attachmentId) return route.fulfill(refusal(502, 'FILE_SERVER_MISSING', CONTENT_502))
      if (id === UNAUDITED.attachmentId) return route.fulfill(refusal(503, 'READ_NOT_AUDITED', NOT_AUDITED))
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

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/327-${name}.png`, fullPage: false })
  const tab = () => page.locator('#tab-attachments')
  const badge = () => tab().locator('.tabular-nums')
  const panel = () => page.locator('#tabpanel-attachments')
  const refreshButton = () => page.locator('[aria-label="Document status"] button', { hasText: 'Refresh' })
  const listRow = (s) => panel().locator(`tr[data-slip="${s.attachmentId}"]`)
  const urls = () => page.evaluate(() => ({ made: [...window.__urls.made], revoked: [...window.__urls.revoked] }))
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
  }
  const open = async (route) => {
    await page.goto(BASE + route)
    await page.locator('[aria-label="Document summary"]').waitFor()
    await settle()
  }
  const selectTab = async () => {
    await tab().click()
    await settle()
  }
  const pick = async (s) => {
    await listRow(s).getByRole('button').click()
    await panel().locator(`[data-preview-for="${s.attachmentId}"]`).waitFor()
  }
  const previewKind = async (s) => {
    const el = panel().locator(`[data-preview-for="${s.attachmentId}"][data-preview-kind]`)
    await el.waitFor({ timeout: 8000 }).catch(() => {})
    return el.count().then((n) => (n ? el.getAttribute('data-preview-kind') : null))
  }
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(document|attachments|common)[.:][a-zA-Z]+(\.[a-zA-Z]+)+\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const reset = () => {
    probe = 'holder'
    byOwner = 'normal'
    byOwnerCalls = []
    contentCalls = {}
    accessCalls = 0
    documentCalls = 0
    goneIds = new Set()
  }
  const FULL = { attachmentOwnerNo: OWNER, attachmentCount: 3, attachmentCategory: 'P2E' }

  // ════════════════════ 1 · the tab is HIDDEN unless all three hold ════════════════════
  for (const [name, docFields, probeMode] of [
    ['no owner', { attachmentCount: 3, attachmentCategory: 'P2E' }, 'holder'],
    ['no category (BackOffice 2077 not served)', { attachmentOwnerNo: OWNER, attachmentCount: 3 }, 'holder'],
    ['a refused probe (503 NOT_SET_UP)', FULL, 'notSetUp'],
    ['a refused probe (bare 403)', FULL, 'forbidden'],
    ['a malformed probe (bare-string categories "P2E")', FULL, 'bareString'],
    ['a category the session does not hold', FULL, 'otherCategory'],
  ]) {
    reset()
    probe = probeMode
    fields = { [ORDER]: docFields }
    await open(`/oms/document/${ORDER}`)
    const tabs = await page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => e.id))
    check(
      `hidden — ${name}: no Attachments tab and no panel`,
      (await tab().count()) === 0 && (await panel().count()) === 0 && tabs.length === 4,
      tabs.join(','),
    )
    check(`hidden — ${name}: no ByOwner and no /Content`, byOwnerCalls.length === 0 && contentTotal() === 0, JSON.stringify(byOwnerCalls))
  }
  check('hidden — with no owner or no category the probe is not even asked', await (async () => {
    reset()
    fields = { [ORDER]: { attachmentOwnerNo: OWNER, attachmentCount: 3 } }
    await open(`/oms/document/${ORDER}`)
    return accessCalls === 0
  })(), `${accessCalls} probe calls`)

  // ════════════════════ 2 · the audited read: zero on load, one on first selection ════════════════════
  reset()
  fields = { [ORDER]: FULL }
  await open(`/oms/document/${ORDER}`)
  await shot('loaded')
  const tabs = await page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => e.id))
  check('tab — Attachments is drawn, fifth and last', JSON.stringify(tabs) === JSON.stringify(['tab-items', 'tab-conditions', 'tab-log', 'tab-jobs', 'tab-attachments']), tabs.join(','))
  check('tab — named "Attachments"', (await tab().innerText()).replace(/\s*\d+\s*$/, '').trim() === 'Attachments')
  check('badge — the model’s count before the list loads', (await badge().innerText()) === '3', await badge().innerText())
  check('badge — titled as files', (await tab().locator('span[title]').getAttribute('title')) === '3 files')
  check('🔑 load — ZERO ByOwner requests on page load', byOwnerCalls.length === 0, JSON.stringify(byOwnerCalls))
  check('load — no /Content either', contentTotal() === 0)
  check('load — the page opens on Items, the panel hidden', (await page.locator('#tabpanel-items').isVisible()) && (await panel().isHidden()))
  check('load — the probe asked once', accessCalls === 1, `${accessCalls}`)

  // Refresh BEFORE the tab is opened reads the document again, and no files.
  const docsBefore = documentCalls
  await refreshButton().click()
  await settle()
  check('refresh before opening — the document is read again', documentCalls === docsBefore + 1, `${documentCalls - docsBefore}`)
  check('🔑 refresh before opening — reads NO ByOwner', byOwnerCalls.length === 0, JSON.stringify(byOwnerCalls))

  await selectTab()
  await panel().locator('[data-testid="slip-list"]').waitFor()
  await settle()
  await shot('opened')
  check(
    '🔑 first selection — exactly ONE ByOwner, SD_DOCUMENT under attachmentOwnerNo',
    byOwnerCalls.length === 1 && byOwnerCalls[0].ownerKind === 'SD_DOCUMENT' && byOwnerCalls[0].ownerKey === OWNER,
    JSON.stringify(byOwnerCalls),
  )
  check('🔑 first selection — no /Content: no file is selected for you', contentTotal() === 0 && (await panel().locator('[data-preview-for]').count()) === 0)
  check('first selection — the preview says to pick a file', (await panel().locator('[data-region="slip-preview"]').innerText()).includes('Pick a file to preview it.'))
  check('badge — now the STORED list’s length (6), over the model’s stale 3', (await badge().innerText()) === String(STORED.length), await badge().innerText())
  check('badge — …titled as files', (await tab().locator('span[title]').getAttribute('title')) === `${STORED.length} files`)
  check('tab — aria-selected, and its panel visible', (await tab().getAttribute('aria-selected')) === 'true' && (await panel().isVisible()))

  await page.locator('#tab-items').click()
  await settle()
  check('switch away — the panel stays mounted (hidden), its list kept', (await panel().isHidden()) && (await panel().locator('tr[data-slip]').count()) === STORED.length)
  await selectTab()
  check('🔑 re-selection — NO new ByOwner', byOwnerCalls.length === 1, `${byOwnerCalls.length}`)
  await page.locator('#tab-log').click()
  await selectTab()
  check('🔑 a third selection — still one ByOwner', byOwnerCalls.length === 1, `${byOwnerCalls.length}`)

  // ---- the list ----
  const order = await panel().locator('tr[data-slip]').evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-slip')))
  check('list — one row per STORED file, in the order sent', JSON.stringify(order) === JSON.stringify(STORED.map((s) => s.attachmentId)), order.join(','))
  check('list — the file name', (await listRow(JPEG).innerText()).includes('rx-front.jpg'))
  check('list — the caption when not empty', (await listRow(JPEG).locator('[data-cell="caption"]').innerText()) === 'Front page')
  const arabic = await listRow(PNG).locator('[data-cell="caption"]').innerText()
  check('list — an Arabic caption shown exactly as sent', arabic === ARABIC_CAPTION, JSON.stringify(arabic))
  check('list — no caption line for an empty caption', (await listRow(PDF).locator('[data-cell="caption"]').count()) === 0)
  check(
    'list — stored at is the wall clock as sent (T cut, fraction dropped, never re-zoned)',
    (await listRow(JPEG).locator('[data-cell="storedAt"]').innerText()) === '2026-09-26 10:12:44' &&
      (await listRow(PNG).locator('[data-cell="storedAt"]').innerText()) === '2026-09-26 09:30:05',
  )
  check('list — a till file names its device', (await listRow(JPEG).locator('[data-cell="till"]').innerText()) === 'P001-01')
  const web = await listRow(PNG).locator('[data-cell="till"]').innerText()
  check('list — a web file reads "Web · <uploadedBy>" (U+00B7)', web === 'Web \u00b7 U123', JSON.stringify(web))
  check('list — a partner’s KEY:<UserId> device is shown as sent', (await listRow(PDF).locator('[data-cell="till"]').innerText()) === 'KEY:U777')
  const heads = await panel().locator('thead th').allInnerTexts()
  check('list — the source column is "Source", not the slip’s "Till"', heads.map((h) => h.trim()).join('|') === 'File name|Uploaded at|Source', heads.join('|'))
  check('327 — no Add yet (330)', (await panel().locator('[data-region="slip-add"]').count()) === 0)

  // ---- Refresh after opening: one re-read ----
  await refreshButton().click()
  await settle()
  check('🔑 refresh after opening — exactly ONE more ByOwner', byOwnerCalls.length === 2, `${byOwnerCalls.length}`)
  check('refresh after opening — …and still no /Content', contentTotal() === 0)

  // ---- previews ----
  await pick(JPEG)
  check('preview — a jpeg shows as an image', (await previewKind(JPEG)) === 'image')
  const img = panel().locator('[data-region="slip-preview"] img')
  await img.waitFor()
  const jpegSrc = await img.getAttribute('src')
  check('preview — …from an object URL that decodes', jpegSrc?.startsWith('blob:') && (await img.evaluate((el) => el.complete && el.naturalWidth > 0)), jpegSrc)
  check('preview — the click fetched exactly that file, once', contentTotal() === 1 && contentCalls[JPEG.attachmentId] === 1)
  check('327 — no Withdraw on the previewed file yet (331)', (await panel().getByTestId('slip-withdraw').count()) === 0)
  await shot('preview-jpeg')

  await pick(PNG)
  check('preview — a png shows as an image', (await previewKind(PNG)) === 'image')
  await panel().locator('[data-region="slip-preview"] img').waitFor()
  let u = await urls()
  check('preview — the jpeg’s object URL is revoked when the selection changes', u.revoked.includes(jpegSrc))

  const [download] = await Promise.all([page.waitForEvent('download'), panel().getByTestId('slip-download').click()])
  check('download — saves under fileName', download.suggestedFilename() === 'emailed rx.png', download.suggestedFilename())
  const saved = await download.path().then((p) => readFileSync(p))
  check('download — …the same bytes the preview shows', saved.equals(bytes[PNG.attachmentId].body))
  check('🔑 download — …with no second fetch', contentCalls[PNG.attachmentId] === 1, `${contentCalls[PNG.attachmentId]} fetches`)

  await pick(PDF)
  check('preview — a pdf shows in a frame', (await previewKind(PDF)) === 'pdf')
  const frameSrc = await panel().locator('[data-region="slip-preview"] iframe').getAttribute('src')
  check('preview — …from an object URL', frameSrc?.startsWith('blob:'), frameSrc)
  await shot('preview-pdf')

  // ---- /Content answers, by code ----
  const readsBefore = byOwnerCalls.length
  await listRow(GONE).getByRole('button').click()
  await panel().getByTestId('slip-gone').waitFor({ timeout: 8000 }).catch(() => {})
  await settle()
  const goneText = await panel().getByTestId('slip-gone').innerText().catch(() => '')
  check('404 NOT_FOUND — says it was withdrawn meanwhile', goneText.includes('withdrawn-meanwhile.jpg') && goneText.includes('no longer readable'), goneText)
  check('404 NOT_FOUND — ByOwner is read again, once', byOwnerCalls.length === readsBefore + 1, `${byOwnerCalls.length - readsBefore}`)
  await listRow(GONE).waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  check('404 NOT_FOUND — …and the file leaves the list', (await listRow(GONE).count()) === 0)
  check('404 NOT_FOUND — the badge follows the re-read list', (await badge().innerText()) === String(STORED.length - 1), await badge().innerText())

  await listRow(LOST).getByRole('button').click()
  await panel().getByTestId('slip-lost').waitFor({ timeout: 8000 }).catch(() => {})
  const lostText = await panel().getByTestId('slip-lost').innerText().catch(() => '')
  check('502 FILE_SERVER_MISSING — lost, not the user’s fault', lostText.includes('no longer holds this file') && lostText.includes('not something you did'), lostText)
  check('502 FILE_SERVER_MISSING — the server’s own words under it', lostText.includes('File metadata missing'))
  check('502 FILE_SERVER_MISSING — no retry, asked once', (await panel().locator('[data-region="slip-preview"]').getByRole('button', { name: /retry|try again/i }).count()) === 0 && contentCalls[LOST.attachmentId] === 1)
  check('502 FILE_SERVER_MISSING — download stays disabled with no bytes', await panel().getByTestId('slip-download').isDisabled())

  await listRow(UNAUDITED).getByRole('button').click()
  await panel().getByTestId('slip-preview-error').waitFor({ timeout: 8000 }).catch(() => {})
  const unauditedText = await panel().getByTestId('slip-preview-error').innerText().catch(() => '')
  check('503 READ_NOT_AUDITED — the server’s message as sent, English then Arabic', unauditedText.includes('could not be recorded') && unauditedText.includes('تعذر تسجيل القراءة'), unauditedText)
  check(
    '503 READ_NOT_AUDITED — nothing shown: no image, no frame, no preview kind',
    (await panel().locator('[data-region="slip-preview"] img, [data-region="slip-preview"] iframe').count()) === 0 &&
      (await panel().locator(`[data-preview-for="${UNAUDITED.attachmentId}"][data-preview-kind]`).count()) === 0,
  )
  check('503 READ_NOT_AUDITED — no re-read of the list', byOwnerCalls.length === readsBefore + 1)
  await shot('content-refusals')

  // ---- Withdrawn (n) ----
  const details = panel().getByTestId('slip-withdrawn')
  check('withdrawn — "Withdrawn (n)", n = withdrawn.length', (await details.locator('summary').innerText()).trim() === `Withdrawn (${WITHDRAWN.length})`)
  check('withdrawn — collapsed by default', !(await details.evaluate((d) => d.open)) && !(await details.locator('li').first().isVisible()))
  await details.locator('summary').click()
  check('withdrawn — expands on a click', await details.evaluate((d) => d.open))
  const wOrder = await details.locator('li[data-withdrawn]').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-withdrawn')))
  check('withdrawn — newest withdrawal first (sent oldest first)', JSON.stringify(wOrder) === JSON.stringify(['01K61W0000000000000000NEW1', '01K61W0000000000000000OLD1']), wOrder.join(','))
  const newest = details.locator('li[data-withdrawn="01K61W0000000000000000NEW1"]')
  const newestText = await newest.innerText()
  check('withdrawn — name, source, who and when', newestText.includes('wrong-customer.jpg') && (await newest.locator('[data-cell="till"]').innerText()) === 'P001-01' && newestText.includes('Withdrawn by U456 at 2026-09-26 07:01:02'), newestText)
  const reason = await newest.locator('[data-cell="reason"]').innerText()
  check('withdrawn — the server’s reasonLabel beside reasonLabelArabic', reason.includes('Wrong order or customer') && reason.includes('طلب أو عميل غير صحيح'), reason)
  check('withdrawn — the note', newestText.includes('Belongs to 2000000552'))
  check('withdrawn — no preview, download or caption inside', (await details.locator('button, a, img, iframe, [data-cell="caption"]').count()) === 0)
  check('withdrawn — nothing ever fetched a withdrawn file’s bytes', WITHDRAWN.every((w) => !contentCalls[w.attachmentId]))
  await shot('withdrawn-open')
  await noRawKeys('order — tab')

  // ---- leaving revokes every object URL, and drops the list ----
  await pick(JPEG)
  await panel().locator('[data-region="slip-preview"] img').waitFor()
  await page.locator('[aria-label="Document identity"] a').first().click()
  await page.waitForURL(/\/oms\/deliveries/)
  await settle()
  u = await urls()
  const unrevoked = u.made.filter((x) => !u.revoked.includes(x))
  check('leave — every object URL made is revoked (URL.revokeObjectURL counted)', u.made.length > 0 && unrevoked.length === 0, `${u.made.length} made, ${unrevoked.length} left`)

  const readsAtLeave = byOwnerCalls.length
  await page.goBack()
  await page.locator('[aria-label="Document summary"]').waitFor()
  await settle()
  check('come back — no ByOwner on the page load, again', byOwnerCalls.length === readsAtLeave, `${byOwnerCalls.length - readsAtLeave}`)
  check('come back — the page opens on Items, the badge from the model again', (await page.locator('#tabpanel-items').isVisible()) && (await badge().innerText()) === '3')
  await selectTab()
  await panel().locator('[data-testid="slip-list"]').waitFor()
  check('come back — selecting reads again (gcTime 0 dropped the list on leave), once', byOwnerCalls.length === readsAtLeave + 1, `${byOwnerCalls.length - readsAtLeave}`)

  // ---- one document to another on the SAME route: the page stays mounted, the latch must not ----
  // The router is moved in place (history + popstate, as a Back/Forward does), so this page is
  // never remounted; then Back returns to the opened order. Its files must wait for a click again.
  const OTHER = '8000000121'
  const readsBeforeMove = byOwnerCalls.length
  await page.evaluate((to) => {
    history.pushState({ usr: null, key: 'drive327', idx: (history.state?.idx ?? 0) + 1 }, '', to)
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
  }, `/oms/document/${OTHER}`)
  await page.locator('[aria-label="Document identity"]', { hasText: OTHER }).waitFor()
  await settle()
  const movedInPlace = await page.evaluate(() => location.pathname)
  await page.goBack()
  await page.locator('[aria-label="Document identity"]', { hasText: ORDER }).waitFor()
  await settle()
  check(
    '🔑 in-route Back to an opened order — no ByOwner until the tab is selected again',
    movedInPlace === `/oms/document/${OTHER}` && byOwnerCalls.length === readsBeforeMove,
    `${byOwnerCalls.length - readsBeforeMove} reads`,
  )
  check('in-route Back — the page shows Items, the tab not selected', (await page.locator('#tabpanel-items').isVisible()) && (await tab().getAttribute('aria-selected')) === 'false')
  await selectTab()
  check('in-route Back — selecting reads once', byOwnerCalls.length === readsBeforeMove + 1, `${byOwnerCalls.length - readsBeforeMove}`)

  // ════════════════════ 3 · the badge's other cases ════════════════════
  reset()
  fields = { [ORDER]: { attachmentOwnerNo: OWNER, attachmentCategory: 'P2E' } }
  await open(`/oms/document/${ORDER}`)
  check('badge — an absent count: the tab, and NO badge (never 0)', (await tab().count()) === 1 && (await badge().count()) === 0)
  await selectTab()
  await panel().locator('[data-testid="slip-list"]').waitFor()
  check('badge — …until the list loads: then its length', (await badge().innerText().catch(() => '')) === String(STORED.length))

  reset()
  fields = { [ORDER]: { ...FULL, attachmentCount: 0 } }
  byOwner = 'empty'
  await open(`/oms/document/${ORDER}`)
  check('badge — a count of 0 shows 0', (await badge().innerText().catch(() => '')) === '0')
  await selectTab()
  await panel().getByTestId('slip-empty').waitFor({ timeout: 8000 }).catch(() => {})
  check('empty — says the order has no file', (await panel().getByTestId('slip-empty').innerText().catch(() => '')) === 'No file is attached to this order.')
  check('empty — no Withdrawn section when n = 0', (await panel().getByTestId('slip-withdrawn').count()) === 0)
  check('empty — the badge is the list’s 0', (await badge().innerText()) === '0')

  // ════════════════════ 4 · ByOwner READ_NOT_AUDITED: the message, no list ════════════════════
  reset()
  fields = { [ORDER]: FULL }
  byOwner = 'readNotAudited'
  await open(`/oms/document/${ORDER}`)
  await selectTab()
  await panel().getByTestId('slip-list-error').waitFor({ timeout: 8000 }).catch(() => {})
  const listError = await panel().getByTestId('slip-list-error').innerText().catch(() => '')
  check('ByOwner READ_NOT_AUDITED — the server’s message, as sent', listError.includes('could not be recorded') && listError.includes('تعذر تسجيل القراءة'), listError)
  check('ByOwner READ_NOT_AUDITED — no list, and NOT the empty sentence', (await panel().getByTestId('slip-list').count()) === 0 && (await panel().getByTestId('slip-empty').count()) === 0)
  check('ByOwner READ_NOT_AUDITED — asked once, no automatic retry', byOwnerCalls.length === 1, `${byOwnerCalls.length}`)
  check('ByOwner READ_NOT_AUDITED — the badge stays the model’s count', (await badge().innerText()) === '3')
  await shot('byowner-not-audited')
  await noRawKeys('order — refused list')

  // ════════════════════ 5 · a delivery lists its OWNER's files ════════════════════
  reset()
  fields = { [DELIVERY]: FULL }
  await open(`/oms/delivery/${DELIVERY}`)
  check('delivery — the tab shows, no ByOwner on load', (await tab().count()) === 1 && byOwnerCalls.length === 0)
  await selectTab()
  await panel().locator('[data-testid="slip-list"]').waitFor()
  check(
    '🔑 delivery — ByOwner asks for attachmentOwnerNo, never the route’s number',
    byOwnerCalls.length === 1 && byOwnerCalls[0].ownerKey === OWNER && byOwnerCalls[0].ownerKey !== DELIVERY,
    JSON.stringify(byOwnerCalls),
  )

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
