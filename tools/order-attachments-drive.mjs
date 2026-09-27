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
// Ticket 330 adds `POST AttachmentWeb/Upload` (BackOffice 2061's What to build; AttachmentFormFields.cs and
// AttachmentUploadResult.cs on pricing2): the multipart body is PARSED and each part asserted in order —
// ClientRequestId, OwnerKind=SD_DOCUMENT, OwnerKey=<attachmentOwnerNo>, Category, Kind=PRESCRIPTION, Caption (only
// when not empty), the file; no SourceDevice. Then: an Arabic caption posted exactly as typed; a local type/size
// refusal with no request; ATTACHMENT_TOO_MANY (409) and the other refusals shown as sent with no retry; a
// failed-then-retried send keeping its ClientRequestId; exactly one ByOwner re-read after a 200; a send that
// survives a tab switch; a delivery's Add posting OwnerKey=<owner>.
//
// Ticket 331 adds `POST AttachmentWeb/{id}/Withdraw`, body `{ reasonCode, note }` (BackOffice 2062's Web contract;
// AttachmentWithdrawResult.cs + AttachmentWebEndpoints.cs on pricing2), and the probe's `withdrawCategories`: Withdraw…
// offered only with the grant for the order's category AND ByOwner's `withdrawReasons`, those reasons listed in the order
// sent with EN·AR labels as sent, WRONG_ORDER posted, Other disabled until a note is typed, the answers by code (400 keeps
// the input, 404 re-reads, 503 NOT_SET_UP no resend, a failure pressed again), a bare 403 removing Withdraw for the rest
// of the visit, and the withdrawn file under Withdrawn (n) after the one re-read. Nothing else is POSTed for the ATWD line.
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
// 2062's SD_DOCUMENT reasons, beside `data`, in its picker order — the SERVER's list, stubbed here; the web holds no
// copy. 331 lists exactly these, in this order, with these words.
const REASONS = [
  { code: 'WRONG_ORDER', label: 'Wrong order or customer', labelArabic: 'طلب أو عميل غير صحيح', noteRequired: false },
  { code: 'UNREADABLE', label: 'Unreadable', labelArabic: 'غير مقروء', noteRequired: false },
  { code: 'DUPLICATE', label: 'Duplicate', labelArabic: 'مكرر', noteRequired: false },
  { code: 'NOT_A_PRESCRIPTION', label: 'Not a prescription', labelArabic: 'ليس وصفة طبية', noteRequired: false },
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
/** Every Upload POST, its parts in the order sent (ticket 330). */
let uploads = []
/** The answers the next Uploads get, in order; empty → a 200 that files the file. */
let uploadAnswers = []
/** Files a 200 filed, newest first — ByOwner lists them ahead of STORED. */
let added = []
/** Hold the next Upload's answer until `releaseUpload()` (the tab-switch-mid-send case). */
let holdUpload = false
let releaseUpload = () => {}
/** What ByOwner sends as `withdrawReasons` (331): the list, left out (an older SIS.Api), or empty. */
let reasonsMode = 'sent'
/** Every Withdraw POST: the id in its path and its JSON body (331). */
let withdraws = []
/** The answers the next Withdraws get, in order; empty → a 200 that withdraws the file. */
let withdrawAnswers = []
/** Files a 200 withdrew, newest withdrawal first — ByOwner lists them under `withdrawn`, not `data`. */
let withdrawnNow = []
/** Every other non-GET request — the ATWD history line is the server's, so there must be none. */
let otherWrites = []

/**
 * A multipart body as [{ name, value | filename }], in the order sent. Read as latin1 (byte-safe), a text part's
 * value decoded back as UTF-8 — so an Arabic caption is compared byte for byte, exactly as the server reads it.
 */
function formParts(request) {
  const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/.exec(request.headers()['content-type'] ?? '')
  if (!boundary) return []
  const raw = (request.postDataBuffer() ?? Buffer.alloc(0)).toString('latin1')
  return raw
    .split(`--${boundary[1] ?? boundary[2]}`)
    .slice(1, -1)
    .map((chunk) => {
      const body = chunk.replace(/^\r\n/, '').replace(/\r\n$/, '')
      const cut = body.indexOf('\r\n\r\n')
      const head = body.slice(0, cut)
      const value = body.slice(cut + 4)
      const name = /[; ]name="([^"]*)"/.exec(head)?.[1]
      const filename = /filename="([^"]*)"/.exec(head)?.[1]
      return filename === undefined
        ? { name, value: Buffer.from(value, 'latin1').toString('utf8') }
        : { name, filename: Buffer.from(filename, 'latin1').toString('utf8'), size: value.length }
    })
}

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
      // 331: the withdraw grant for both of 2062's categories; a bare-string withdraw list; an ERX reader (2062 seeds no
      // ERX withdraw grant, so its withdrawCategories can never hold ERX).
      if (probe === 'withdrawer') return route.fulfill(envelope({ categories: ['P2E', 'ALTIBBI'], withdrawCategories: ['P2E', 'ALTIBBI'] }))
      if (probe === 'withdrawBareString') return route.fulfill(envelope({ categories: ['P2E', 'ALTIBBI'], withdrawCategories: 'P2E' }))
      if (probe === 'erxReader') return route.fulfill(envelope({ categories: ['ERX', 'P2E', 'ALTIBBI'], withdrawCategories: ['P2E', 'ALTIBBI'] }))
      return route.fulfill(envelope({ categories: ['P2E', 'ALTIBBI'], withdrawCategories: [] }))
    }
    if (p === 'AttachmentWeb/ByOwner') {
      byOwnerCalls.push({ ownerKind: url.searchParams.get('ownerKind'), ownerKey: url.searchParams.get('ownerKey') })
      if (byOwner === 'readNotAudited') return route.fulfill(refusal(503, 'READ_NOT_AUDITED', NOT_AUDITED))
      const reasons = reasonsMode === 'absent' ? {} : { withdrawReasons: reasonsMode === 'empty' ? [] : REASONS }
      if (byOwner === 'empty') return route.fulfill(envelope([], { siblings: { withdrawn: [], ...reasons } }))
      const withdrawnIds = new Set(withdrawnNow.map((w) => w.attachmentId))
      return route.fulfill(
        envelope(
          [...added, ...STORED.filter((s) => !goneIds.has(s.attachmentId) && !withdrawnIds.has(s.attachmentId))],
          { siblings: { withdrawn: [...WITHDRAWN, ...withdrawnNow], ...reasons } },
        ),
      )
    }
    const withdraw = /^AttachmentWeb\/([^/]+)\/Withdraw$/.exec(p ?? '')
    if (withdraw && route.request().method() === 'POST') {
      const id = decodeURIComponent(withdraw[1])
      const body = route.request().postDataJSON()
      withdraws.push({ id, body, contentType: route.request().headers()['content-type'] })
      const answer = withdrawAnswers.shift()
      if (answer) return route.fulfill(answer)
      const file = [...added, ...STORED].find((s) => s.attachmentId === id)
      const why = REASONS.find((r) => r.code === body.reasonCode)
      const row = {
        ...withdrawn(id, file.fileName, `2026-09-27T11:0${withdrawnNow.length}:00`, {
          category: file.category,
          sourceDevice: file.sourceDevice,
          uploadedBy: file.uploadedBy,
          storedAt: file.storedAt,
          withdrawnBy: 'msartawi',
          reasonCode: why.code,
          reasonLabel: why.label,
          reasonLabelArabic: why.labelArabic,
          note: body.note,
        }),
      }
      withdrawnNow = [row, ...withdrawnNow]
      return route.fulfill(envelope(row))
    }
    if (route.request().method() !== 'GET' && p !== 'AttachmentWeb/Upload') otherWrites.push(`${route.request().method()} ${p}`)
    if (p === 'AttachmentWeb/Upload' && route.request().method() === 'POST') {
      const parts = formParts(route.request())
      uploads.push(parts)
      if (holdUpload) {
        holdUpload = false
        await new Promise((r) => (releaseUpload = r))
      }
      const answer = uploadAnswers.shift()
      if (answer === 'network') return route.abort('connectionfailed')
      if (answer) return route.fulfill(answer)
      const part = (n) => parts.find((x) => x.name === n)
      const filed = {
        ...item(`01K61U${String(added.length + 1).padStart(20, '0')}`, part('File')?.filename ?? 'x', {
          caption: part('Caption')?.value ?? '',
          storedAt: `2026-09-27T10:0${added.length}:00`,
        }),
        ownerKey: part('OwnerKey')?.value,
        category: part('Category')?.value,
      }
      added = [filed, ...added]
      return route.fulfill(envelope(filed))
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
    uploads = []
    uploadAnswers = []
    added = []
    holdUpload = false
    reasonsMode = 'sent'
    withdraws = []
    withdrawAnswers = []
    withdrawnNow = []
    otherWrites = []
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
  check('330 — + Add prescription is offered in the opened tab', (await panel().getByTestId('slip-add').innerText()).trim() === 'Add prescription')

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
  check('331 — no Withdraw without the withdraw grant (read only: withdrawCategories [])', (await panel().getByTestId('slip-withdraw').count()) === 0)
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

  // ════════════════════ 6 · + Add prescription (ticket 330) ════════════════════
  const captionField = () => panel().getByTestId('slip-add-caption')
  const fileInput = () => panel().getByTestId('slip-add-input')
  const uploadRow = (name) => panel().locator(`[data-testid="slip-uploads"] li[data-upload="${name}"]`)
  const uploadStatus = (name) => uploadRow(name).getAttribute('data-status').catch(() => null)
  const waitUpload = (name, status) =>
    panel().locator(`li[data-upload="${name}"][data-status="${status}"]`).waitFor({ timeout: 8000 }).catch(() => {})
  const retryButton = (name) => uploadRow(name).getByTestId('slip-upload-retry')
  const partNames = (parts) => (parts ?? []).map((x) => x.name)
  const partValue = (parts, name) => (parts ?? []).find((x) => x.name === name)?.value
  const SEVEN = ['ClientRequestId', 'OwnerKind', 'OwnerKey', 'Category', 'Kind', 'Caption', 'File']
  const SIX = ['ClientRequestId', 'OwnerKind', 'OwnerKey', 'Category', 'Kind', 'File']
  const pdfFile = (name) => ({ name, mimeType: 'application/pdf', buffer: bytes[PDF.attachmentId].body })
  const pngFile = (name) => ({ name, mimeType: 'image/png', buffer: bytes[PNG.attachmentId].body })
  /** Type the caption (when given), then pick the file — the order the field's hint asks for. */
  const addFile = async (file, caption) => {
    if (caption !== undefined) await captionField().fill(caption)
    await fileInput().setInputFiles(file)
  }

  reset()
  fields = { [ORDER]: FULL }
  await open(`/oms/document/${ORDER}`)
  await selectTab()
  await panel().locator('[data-testid="slip-list"]').waitFor()
  await settle()
  const addRegion = panel().locator('[data-region="slip-add"]')
  check('add — nothing posted by the load or the first selection', uploads.length === 0)
  check('add — the button reads "Add prescription"', (await panel().getByTestId('slip-add').innerText()).trim() === 'Add prescription')
  const captionLabel = await addRegion.locator('label').innerText()
  check('add — the caption field is labelled, and says it is optional', captionLabel.trim() === 'Caption (optional)', captionLabel)
  check(
    'add — the field is labelled FOR the input (a click on the label focuses it)',
    await (async () => {
      await addRegion.locator('label').click()
      return captionField().evaluate((el) => document.activeElement === el)
    })(),
  )
  const addText = await addRegion.innerText()
  check('add — the hint: caption first, the first 200 characters kept', addText.includes('Type the caption before you pick the file. Only the first 200 characters are kept.'), addText)
  check('add — one file per Add: the picker is not multiple, the hint names one file', !(await fileInput().evaluate((el) => el.multiple)) && addText.includes('One JPG, PNG or PDF file, up to 10 MB.'))
  check('add — the caption reads in its own direction (dir="auto")', (await captionField().getAttribute('dir')) === 'auto')

  // ---- the browser's check: nothing sent ----
  await addFile({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a prescription') }, 'kept for the next pick')
  await page.waitForTimeout(300)
  check(
    'local refusal (type) — named with its reason, and NO request sent',
    (await uploadStatus('notes.txt')) === 'local-refused' && (await uploadRow('notes.txt').innerText()).includes('only JPG, PNG or PDF') && uploads.length === 0,
    `${uploads.length} sent`,
  )
  check('local refusal — the typed caption is kept for the next pick', (await captionField().inputValue()) === 'kept for the next pick')
  await addFile({ name: 'huge-scan.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10_485_761) })
  await page.waitForTimeout(300)
  check(
    'local refusal (size, 10,485,761 bytes) — named with its reason, and NO request sent',
    (await uploadStatus('huge-scan.pdf')) === 'local-refused' && (await uploadRow('huge-scan.pdf').innerText()).includes('larger than 10 MB') && uploads.length === 0,
    `${uploads.length} sent`,
  )

  // ---- a PDF with an Arabic caption ----
  const ARABIC_TYPED = 'وصفة أرسلها العميل بالبريد — صفحة ١ من ٢'
  let reads = byOwnerCalls.length
  await addFile(pdfFile('emailed prescription.pdf'), ARABIC_TYPED)
  await waitUpload('emailed prescription.pdf', 'stored')
  await settle()
  const sent = uploads[0]
  check('🔑 add — ONE request, its parts in the contract’s order, Caption between Kind and the file', uploads.length === 1 && JSON.stringify(partNames(sent)) === JSON.stringify(SEVEN), partNames(sent).join(','))
  check(
    'add — OwnerKind SD_DOCUMENT, OwnerKey the owner, Category the document’s, Kind PRESCRIPTION',
    partValue(sent, 'OwnerKind') === 'SD_DOCUMENT' && partValue(sent, 'OwnerKey') === OWNER && partValue(sent, 'Category') === 'P2E' && partValue(sent, 'Kind') === 'PRESCRIPTION',
    JSON.stringify(sent?.slice(1, 5)),
  )
  check('add — no SourceDevice part: a web row names no device', !partNames(sent).includes('SourceDevice'))
  const postedCaption = partValue(sent, 'Caption') ?? ''
  check(
    '🔑 add — the POSTED Caption part is the Arabic exactly as typed, byte for byte',
    Buffer.from(postedCaption, 'utf8').equals(Buffer.from(ARABIC_TYPED, 'utf8')),
    JSON.stringify(postedCaption),
  )
  const filePart = sent?.find((x) => x.name === 'File')
  check('add — the file part is the picked PDF, under its own name', filePart?.filename === 'emailed prescription.pdf' && filePart?.size === bytes[PDF.attachmentId].body.length, JSON.stringify(filePart))
  check('add — a ClientRequestId was minted for it', /\S/.test(partValue(sent, 'ClientRequestId') ?? ''))
  check('🔑 add — after the 200, exactly ONE ByOwner re-read', byOwnerCalls.length === reads + 1, `${byOwnerCalls.length - reads}`)
  const firstRow = panel().locator('tr[data-slip]').first()
  check(
    'add — the new file is listed first, its Arabic caption shown exactly',
    (await firstRow.getAttribute('data-slip')) === added[0]?.attachmentId && (await firstRow.locator('[data-cell="caption"]').innerText()) === ARABIC_TYPED,
  )
  check('add — the badge moved on with the list (6 → 7)', (await badge().innerText()) === String(STORED.length + 1), await badge().innerText())
  check('add — its upload row says Stored, and names its caption', (await uploadRow('emailed prescription.pdf').innerText()).includes('Stored') && (await uploadRow('emailed prescription.pdf').locator('[data-cell="upload-caption"]').innerText()) === ARABIC_TYPED)
  check('add — the caption field is cleared for the next file', (await captionField().inputValue()) === '')
  await shot('add-stored')

  // ---- no caption: no Caption part ----
  await addFile(pngFile('no-caption.png'), '   ')
  await waitUpload('no-caption.png', 'stored')
  await settle()
  check('add — a blank caption sends NO Caption part: the six parts', JSON.stringify(partNames(uploads[1])) === JSON.stringify(SIX), partNames(uploads[1]).join(','))

  // ---- ATTACHMENT_TOO_MANY: the server's cap, as sent, no retry ----
  const TOO_MANY = 'This order already has 10 files. Withdraw one before adding another.\nهذا الطلب يحمل ١٠ ملفات بالفعل. اسحب ملفًا قبل إضافة آخر.'
  uploadAnswers = [refusal(409, 'ATTACHMENT_TOO_MANY', TOO_MANY)]
  reads = byOwnerCalls.length
  let before = uploads.length
  const badgeBefore = await badge().innerText()
  await addFile(pdfFile('eleventh.pdf'))
  await waitUpload('eleventh.pdf', 'refused')
  await settle()
  const capText = await uploadRow('eleventh.pdf').locator('[data-cell="reason"]').innerText().catch(() => '')
  check('ATTACHMENT_TOO_MANY — sent (there is no client cap)', uploads.length === before + 1)
  check('ATTACHMENT_TOO_MANY — the server’s words as sent, English then Arabic', capText === TOO_MANY, JSON.stringify(capText))
  check('ATTACHMENT_TOO_MANY — no Retry offered', (await retryButton('eleventh.pdf').count()) === 0)
  check('ATTACHMENT_TOO_MANY — no re-read, the badge unchanged', byOwnerCalls.length === reads && (await badge().innerText()) === badgeBefore)
  check('ATTACHMENT_TOO_MANY — Add stays offered (no pre-disabled Add)', await panel().getByTestId('slip-add').isEnabled())
  await shot('add-too-many')

  // ---- every other refusal: as sent, no retry ----
  const bilingual = (en, ar) => `${en}\n${ar}`
  for (const [i, [label, answer, expected]] of [
    ['DOCUMENT_NOT_FOUND (404) — the unknown document', refusal(404, 'DOCUMENT_NOT_FOUND', bilingual('The document was not found.', 'لم يتم العثور على المستند.')), 'The document was not found.'],
    ['DOCUMENT_TAKES_NO_ATTACHMENTS (400)', refusal(400, 'DOCUMENT_TAKES_NO_ATTACHMENTS', bilingual('This document takes no attachments.', 'هذا المستند لا يقبل مرفقات.')), 'takes no attachments'],
    ['ATTACHMENT_KIND_NOT_ACCEPTED (400)', refusal(400, 'ATTACHMENT_KIND_NOT_ACCEPTED', bilingual('This kind of file is not accepted here.', 'هذا النوع من الملفات غير مقبول هنا.')), 'not accepted here'],
    ['CATEGORY_NOT_HELD (403)', refusal(403, 'CATEGORY_NOT_HELD', bilingual('You do not hold this category.', 'لا تملك هذه الفئة.')), 'do not hold this category'],
    ['TOO_LARGE (413)', refusal(413, 'TOO_LARGE', bilingual('The file is larger than 10 MB.', 'الملف أكبر من ١٠ ميغابايت.')), 'larger than 10 MB'],
    ['UNSUPPORTED_TYPE (415)', refusal(415, 'UNSUPPORTED_TYPE', bilingual('This file type is not supported.', 'نوع الملف غير مدعوم.')), 'not supported'],
    ['NOT_SET_UP (a coded 503)', refusal(503, 'NOT_SET_UP', NOT_SET_UP), 'not set up on this server'],
    ['a field-name 400 (Caption)', refusal(400, 'Caption', bilingual('Caption is not valid.', 'التعليق غير صالح.')), 'Caption is not valid.'],
    ['a bare 403 (no body)', { status: 403, body: '' }, null],
  ].entries()) {
    uploadAnswers = [answer]
    reads = byOwnerCalls.length
    before = uploads.length
    const name = `refused-${i}.pdf`
    await addFile(pdfFile(name))
    await waitUpload(name, 'refused')
    const text = await uploadRow(name).locator('[data-cell="reason"]').innerText().catch(() => '')
    check(
      `${label} — refused, shown as sent, no Retry, no re-read`,
      uploads.length === before + 1 &&
        (await uploadStatus(name)) === 'refused' &&
        (expected === null ? text.length > 0 : text.includes(expected)) &&
        (await retryButton(name).count()) === 0 &&
        byOwnerCalls.length === reads,
      JSON.stringify(text),
    )
  }
  check('DOCUMENT_NOT_FOUND — the Arabic line is shown too', (await uploadRow('refused-0.pdf').innerText()).includes('لم يتم العثور على المستند.'))

  // ---- a failed-then-retried send keeps its ClientRequestId (and its caption) ----
  const UNREACHABLE = 'The file server could not be reached. Try again.\nتعذر الوصول إلى خادم الملفات. حاول مرة أخرى.'
  for (const [label, first] of [
    ['FILE_SERVER_UNREACHABLE (a coded 503)', refusal(503, 'FILE_SERVER_UNREACHABLE', UNREACHABLE)],
    ['no answer (the network arm)', 'network'],
    ['a codeless 502 (not an envelope)', { status: 502, contentType: 'text/html', body: '<html>Bad Gateway</html>' }],
  ]) {
    uploadAnswers = [first]
    reads = byOwnerCalls.length
    before = uploads.length
    const name = `flaky-${label.split(' ')[0].toLowerCase()}.pdf`
    const caption = `retry keeps this — ${label.split(' ')[0]} — أعد المحاولة`
    await addFile(pdfFile(name), caption)
    await waitUpload(name, 'refused')
    check(`${label} — Retry is offered, nothing re-read yet`, (await retryButton(name).count()) === 1 && byOwnerCalls.length === reads)
    await retryButton(name).click()
    await waitUpload(name, 'stored')
    await settle()
    const [a, b] = uploads.slice(before)
    check(
      `🔑 ${label} — the retry is ONE more request under the SAME ClientRequestId`,
      uploads.length === before + 2 && partValue(a, 'ClientRequestId') === partValue(b, 'ClientRequestId'),
      `${partValue(a, 'ClientRequestId')} / ${partValue(b, 'ClientRequestId')}`,
    )
    check(`${label} — …and the same Caption`, partValue(a, 'Caption') === caption && partValue(b, 'Caption') === caption)
    check(`${label} — one ByOwner re-read, after the 200 only`, byOwnerCalls.length === reads + 1, `${byOwnerCalls.length - reads}`)
  }
  await shot('add-retried')

  // ---- a send survives a tab switch (the panel stays mounted) ----
  holdUpload = true
  before = uploads.length
  reads = byOwnerCalls.length
  await addFile(pngFile('slow.png'), 'held across a tab switch')
  await waitUpload('slow.png', 'sending')
  await page.locator('#tab-items').click()
  await page.waitForTimeout(300)
  await tab().click()
  await page.waitForTimeout(300)
  check('in flight — a tab switch loses nothing: still sending, one request', (await uploadStatus('slow.png')) === 'sending' && uploads.length === before + 1)
  releaseUpload()
  await waitUpload('slow.png', 'stored')
  await settle()
  check('in flight — it lands, and the list is re-read once', uploads.length === before + 1 && byOwnerCalls.length === reads + 1, `${byOwnerCalls.length - reads}`)
  await noRawKeys('order — add')

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
  await addFile(pdfFile('delivery-rx.pdf'), 'from the delivery page')
  await waitUpload('delivery-rx.pdf', 'stored')
  await settle()
  check(
    '🔑 delivery — Add posts OwnerKey=<attachmentOwnerNo>, never the delivery’s number',
    uploads.length === 1 && partValue(uploads[0], 'OwnerKey') === OWNER && partValue(uploads[0], 'OwnerKey') !== DELIVERY,
    partValue(uploads[0], 'OwnerKey'),
  )
  check('delivery — the owner’s list is re-read once after the 200', byOwnerCalls.length === 2 && byOwnerCalls[1].ownerKey === OWNER, JSON.stringify(byOwnerCalls))

  // ════════════════════ 7 · Withdraw… with the server's reasons (ticket 331) ════════════════════
  const dialog = () => page.locator('dialog:has([data-region="slip-withdraw"])')
  const withdrawButton = () => panel().getByTestId('slip-withdraw')
  const confirmButton = () => dialog().getByTestId('slip-withdraw-confirm')
  const reasonRadio = (code) => dialog().locator(`input[data-reason="${code}"]`)
  const noteField = () => dialog().getByTestId('slip-withdraw-note')
  const dialogGone = () => dialog().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  const openWithdraw = async (s) => {
    await pick(s)
    await withdrawButton().click()
    await dialog().waitFor()
  }
  const notice = () => panel().getByTestId('slip-withdraw-notice')
  const WITHDRAW_400 = 'The withdrawal is not valid: check reasonCode.\nطلب السحب غير صالح: تحقق من reasonCode.'
  const WITHDRAW_404 = 'The attachment was not found.\nلم يتم العثور على المرفق.'

  reset()
  probe = 'withdrawer'
  fields = { [ORDER]: FULL }
  await open(`/oms/document/${ORDER}`)
  check('withdraw — nothing posted by the load', withdraws.length === 0 && byOwnerCalls.length === 0)
  await selectTab()
  await panel().locator('[data-testid="slip-list"]').waitFor()
  await settle()
  check('withdraw — no Withdraw before a file is picked (it sits on the preview)', (await withdrawButton().count()) === 0)
  await pick(JPEG)
  check('withdraw — with the grant: Withdraw beside Download on the previewed file', (await withdrawButton().isVisible()) && (await panel().getByTestId('slip-download').isVisible()))
  check('withdraw — the button reads the panel’s "Withdraw", named for the file', (await withdrawButton().innerText()).trim() === 'Withdraw' && (await withdrawButton().getAttribute('aria-label')) === 'Withdraw rx-front.jpg')
  check('withdraw — reading the reasons asked nothing more: one ByOwner, no probe re-ask', byOwnerCalls.length === 1 && accessCalls === 1, `${byOwnerCalls.length} / ${accessCalls}`)

  await withdrawButton().click()
  await dialog().waitFor()
  await shot('withdraw-dialog')
  const dialogText = await dialog().innerText()
  check('dialog — titled with the order’s words', dialogText.includes('Withdraw a file'), dialogText.slice(0, 60))
  const namedFile = await dialog().getByTestId('slip-withdraw-slip').innerText()
  check('dialog — names the file, its source and when it was stored', namedFile.includes('rx-front.jpg') && namedFile.includes('P001-01') && namedFile.includes('2026-09-26 10:12:44'), namedFile.replace(/\s+/g, ' '))
  check('dialog — says the withdrawal is final', (await dialog().getByTestId('slip-withdraw-final').innerText()).includes('A withdrawal is final.'))
  const listed = await dialog().locator('input[data-reason]').evaluateAll((els) =>
    els.map((el) => ({ code: el.getAttribute('data-reason'), spans: [...el.closest('label').querySelectorAll('span')].map((s) => s.textContent) })),
  )
  check(
    '🔑 dialog — exactly the server’s reasons, in the order sent',
    JSON.stringify(listed.map((r) => r.code)) === JSON.stringify(REASONS.map((r) => r.code)),
    listed.map((r) => r.code).join(','),
  )
  check(
    '🔑 dialog — each label beside its labelArabic, exactly as sent',
    listed.every((r, i) => r.spans[0] === REASONS[i].label && r.spans[1] === REASONS[i].labelArabic),
    JSON.stringify(listed.map((r) => r.spans)),
  )
  check('dialog — the Arabic label is marked Arabic', (await dialog().locator('label span[lang="ar"]').count()) === REASONS.length)
  check('dialog — confirm is disabled until a reason is picked', await confirmButton().isDisabled())
  check('dialog — confirm reads "Withdraw file"', (await confirmButton().innerText()).trim() === 'Withdraw file')

  // ---- Other needs a note (the server's noteRequired) ----
  await reasonRadio('OTHER').check()
  check('Other — confirm stays disabled with no note', await confirmButton().isDisabled())
  check('Other — the note is marked required, and says so', (await noteField().getAttribute('required')) !== null && (await dialog().innerText()).includes('Required for this reason.'))
  await noteField().fill('   ')
  check('Other — a blank note keeps confirm disabled', await confirmButton().isDisabled())
  await noteField().fill('Scanned for the wrong visit')
  check('Other — a note with something in it makes confirm live', await confirmButton().isEnabled())
  await noteField().fill('')
  check('Other — clearing the note disables confirm again', await confirmButton().isDisabled())

  // ---- WRONG_ORDER needs none; a 400 keeps the input ----
  const NOTE_TYPED = '  يخص الطلب 2000000552  '
  await reasonRadio('WRONG_ORDER').check()
  check('WRONG_ORDER — confirm is live without a note (noteRequired false)', await confirmButton().isEnabled())
  await noteField().fill(NOTE_TYPED)
  withdrawAnswers = [refusal(400, 'reasonCode', WITHDRAW_400)]
  reads = byOwnerCalls.length
  await confirmButton().click()
  const err400 = dialog().getByTestId('slip-withdraw-error')
  await err400.waitFor({ timeout: 8000 }).catch(() => {})
  const err400Text = await err400.innerText().catch(() => '')
  check('400 reasonCode — the server’s message in the dialog, English then Arabic', err400Text.includes('check reasonCode') && err400Text.includes('طلب السحب غير صالح'), err400Text)
  check('400 reasonCode — the dialog stays, with the input kept', (await dialog().count()) === 1 && (await reasonRadio('WRONG_ORDER').isChecked()) && (await noteField().inputValue()) === NOTE_TYPED)
  check('400 reasonCode — confirm may be pressed again, and nothing was re-read', (await confirmButton().isEnabled()) && byOwnerCalls.length === reads)

  // ---- a failure: the message, and pressing again is safe ----
  withdrawAnswers = [{ status: 500, contentType: 'text/html', body: '<html>boom</html>' }]
  await confirmButton().click()
  await page.waitForFunction(() => document.querySelector('[data-testid="slip-withdraw-error"]')?.getAttribute('data-answer') === 'failed', null, { timeout: 8000 }).catch(() => {})
  check('a failure — shown in the dialog, the input kept, confirm live again', (await err400.getAttribute('data-answer').catch(() => '')) === 'failed' && (await confirmButton().isEnabled()) && (await reasonRadio('WRONG_ORDER').isChecked()))

  // ---- 200: WRONG_ORDER posted, the file moves under Withdrawn (n) ----
  const badgeBeforeWithdraw = Number(await badge().innerText())
  const postsBefore = withdraws.length
  await confirmButton().click()
  await dialogGone()
  await notice().waitFor({ timeout: 8000 }).catch(() => {})
  await settle()
  const posted = withdraws[postsBefore]
  check('🔑 200 — ONE more POST, to the file’s own Withdraw route', withdraws.length === postsBefore + 1 && posted?.id === JPEG.attachmentId, JSON.stringify(withdraws.map((w) => w.id)))
  check(
    '🔑 200 — the body is exactly { reasonCode: "WRONG_ORDER", note } with the note trimmed',
    JSON.stringify(Object.keys(posted?.body ?? {})) === JSON.stringify(['reasonCode', 'note']) &&
      posted.body.reasonCode === 'WRONG_ORDER' &&
      posted.body.note === NOTE_TYPED.trim(),
    JSON.stringify(posted?.body),
  )
  check('200 — sent as JSON', /application\/json/.test(posted?.contentType ?? ''), posted?.contentType)
  check('200 — the dialog closes', (await dialog().count()) === 0)
  check('200 — the tab says it was withdrawn', (await notice().innerText().catch(() => '')).includes('rx-front.jpg was withdrawn'))
  check('200 — the preview is dropped', (await panel().locator('[data-preview-for]').count()) === 0)
  check('🔑 200 — exactly ONE ByOwner re-read', byOwnerCalls.length === reads + 1, `${byOwnerCalls.length - reads}`)
  check('200 — the file leaves the stored list', (await listRow(JPEG).count()) === 0)
  check('200 — the badge follows the re-read list', (await badge().innerText()) === String(badgeBeforeWithdraw - 1), `${badgeBeforeWithdraw} → ${await badge().innerText()}`)
  const wd = panel().getByTestId('slip-withdrawn')
  check('200 — Withdrawn (n) counts it', (await wd.locator('summary').innerText()).trim() === `Withdrawn (${WITHDRAWN.length + 1})`)
  await wd.locator('summary').click()
  const firstWithdrawn = wd.locator('li[data-withdrawn]').first()
  check('200 — …newest withdrawal first: this one', (await firstWithdrawn.getAttribute('data-withdrawn')) === JPEG.attachmentId)
  const fwText = await firstWithdrawn.innerText()
  check('200 — …with who withdrew it and when (the wall clock as sent)', fwText.includes('Withdrawn by msartawi at 2026-09-27 11:00:00'), fwText)
  const fwReason = await firstWithdrawn.locator('[data-cell="reason"]').innerText()
  check('200 — …the server’s reasonLabel beside reasonLabelArabic', fwReason === 'Reason: Wrong order or customer طلب أو عميل غير صحيح', JSON.stringify(fwReason))
  const fwNote = await firstWithdrawn.locator('[data-cell="note"]').innerText().catch(() => '')
  check('200 — …and the note, Arabic exactly as posted', fwNote === `Note: ${NOTE_TYPED.trim()}`, JSON.stringify(fwNote))
  check('200 — …with no preview or download', (await firstWithdrawn.locator('button, a, img, iframe').count()) === 0)
  check('200 — nothing fetched the withdrawn file’s bytes again', contentCalls[JPEG.attachmentId] === 1, `${contentCalls[JPEG.attachmentId]}`)
  await shot('withdraw-done')

  // ---- 404: says so and re-reads ----
  await openWithdraw(PNG)
  await reasonRadio('DUPLICATE').check()
  withdrawAnswers = [refusal(404, 'NOT_FOUND', WITHDRAW_404)]
  reads = byOwnerCalls.length
  await confirmButton().click()
  await dialogGone()
  await page.waitForFunction(() => document.querySelector('[data-testid="slip-withdraw-notice"]')?.getAttribute('data-answer') === 'gone', null, { timeout: 8000 }).catch(() => {})
  await settle()
  const goneNotice = await notice().innerText().catch(() => '')
  check('404 NOT_FOUND — says the file is no longer one you can withdraw, with the server’s words', goneNotice.includes('emailed rx.png is no longer a stored file you can withdraw') && goneNotice.includes('لم يتم العثور على المرفق'), goneNotice)
  check('404 NOT_FOUND — the dialog closes and ByOwner is re-read once', (await dialog().count()) === 0 && byOwnerCalls.length === reads + 1, `${byOwnerCalls.length - reads}`)

  // ---- 503 NOT_SET_UP: the message, no resend ----
  await openWithdraw(PDF)
  await reasonRadio('UNREADABLE').check()
  withdrawAnswers = [refusal(503, 'NOT_SET_UP', NOT_SET_UP)]
  reads = byOwnerCalls.length
  before = withdraws.length
  await confirmButton().click()
  await page.waitForFunction(() => document.querySelector('[data-testid="slip-withdraw-error"]')?.getAttribute('data-answer') === 'not-set-up', null, { timeout: 8000 }).catch(() => {})
  const notSetUpText = await dialog().getByTestId('slip-withdraw-error').innerText().catch(() => '')
  check('503 NOT_SET_UP — the server’s message in the dialog', notSetUpText.includes('not set up on this server') && notSetUpText.includes('مخزن المرفقات'), notSetUpText)
  check('503 NOT_SET_UP — confirm cannot be pressed again', await confirmButton().isDisabled())
  check('503 NOT_SET_UP — one request, nothing re-read', withdraws.length === before + 1 && byOwnerCalls.length === reads)
  await dialog().getByTestId('slip-withdraw-cancel').click()
  await dialogGone()
  check('503 NOT_SET_UP — Cancel closes the dialog, Withdraw still offered', (await dialog().count()) === 0 && (await withdrawButton().isVisible()))

  // ---- a bare 403: Withdraw is gone for the rest of the visit ----
  await withdrawButton().click()
  await dialog().waitFor()
  await reasonRadio('NOT_A_PRESCRIPTION').check()
  withdrawAnswers = [{ status: 403, body: '' }]
  reads = byOwnerCalls.length
  before = withdraws.length
  await confirmButton().click()
  await dialogGone()
  await page.waitForFunction(() => document.querySelector('[data-testid="slip-withdraw-notice"]')?.getAttribute('data-answer') === 'forbidden', null, { timeout: 8000 }).catch(() => {})
  const forbiddenText = await notice().innerText().catch(() => '')
  check('bare 403 — says Withdraw was removed from this tab', forbiddenText.includes('Withdraw has been removed from this tab'), forbiddenText)
  check('🔑 bare 403 — Withdraw is gone from the previewed file', (await withdrawButton().count()) === 0 && (await panel().getByTestId('slip-download').isVisible()))
  check('bare 403 — one request, nothing re-read', withdraws.length === before + 1 && byOwnerCalls.length === reads)
  await shot('withdraw-forbidden')
  await pick(UNAUDITED)
  check('bare 403 — …and from every other file', (await withdrawButton().count()) === 0)
  await page.locator('#tab-log').click()
  await selectTab()
  await pick(PDF)
  check('bare 403 — …after a tab switch', (await withdrawButton().count()) === 0)
  await refreshButton().click()
  await settle()
  await pick(PDF)
  check('bare 403 — …and after the page’s Refresh (the probe still says yes)', (await withdrawButton().count()) === 0 && accessCalls === 1)
  check('ATWD — the web sends nothing for the order’s history line: no other write at all', otherWrites.length === 0, otherWrites.join(', '))
  await noRawKeys('order — withdraw')

  // ════════════════════ 8 · no Withdraw… without the grant, or without the server's reasons ════════════════════
  for (const [name, probeMode, mode, docFields] of [
    ['read only (withdrawCategories [])', 'holder', 'sent', FULL],
    ['a bare-string withdrawCategories "P2E"', 'withdrawBareString', 'sent', FULL],
    ['an ERX order (2062 has no ERX withdraw grant)', 'erxReader', 'sent', { ...FULL, attachmentCategory: 'ERX' }],
    ['no withdrawReasons (an older SIS.Api)', 'withdrawer', 'absent', FULL],
    ['an empty withdrawReasons', 'withdrawer', 'empty', FULL],
  ]) {
    reset()
    probe = probeMode
    reasonsMode = mode
    fields = { [ORDER]: docFields }
    await open(`/oms/document/${ORDER}`)
    await selectTab()
    await panel().locator('[data-testid="slip-list"]').waitFor()
    await pick(PNG)
    await panel().getByTestId('slip-download').waitFor()
    check(`no Withdraw — ${name}: the file previews, and no Withdraw beside Download`, (await panel().locator('[data-region="slip-preview"] img').count()) === 1 && (await withdrawButton().count()) === 0)
  }

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
