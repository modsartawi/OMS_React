// Pick support drive (ticket 496; BackOffice brief 2691, spec 2685, ADR 0085). Tickets 497–499
// EXTEND this file; ticket 500's live drive is a separate file.
//
// Drives the REAL app in Chromium against a STUB of the brief's wire contract — the doors are built
// (BackOffice 2687–2690) but not confirmed deployed, so there is no live SIS.Api to point at. The
// stub emits EXACTLY the brief's JSON (its "…" placeholders filled with plain sentences):
//   GET SdDocumentWeb/Access            → { canOpenList, canOpenDetail, canOpenPickSupport? }
//   GET PickSupport/Resolve?key=        → PickSupportResolution
//   GET PickSupport/Delivery/{no}       → PickSupportDiagnosis | PICK-00002 envelope
//   POST PickSupport/Delivery/{no}/Fix  → PickSupportFixResult | PICK-00224 / PICK-00225 | bare 403
// Fixtures: all three verdicts, an order with two deliveries, a serial held by a PUT_BACK_BASKET and
// a STUCK document, a reconstructed timeline row, a PICK-00002 envelope and a bare 403.
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`), it asserts:
//   1. without the flag the leaf is hidden and the URL shows the denied card, with no door call;
//   2. with it the leaf shows; Enter on a typed number calls Resolve with ?key= and holds it in the URL;
//   3. ?key=8006777365 renders the STUCK diagnosis with EVERY section, and no Apply fix button;
//   4. the shape card shows the code, the server's EN beside AR (each in its own direction), the fix
//      and the action tags; the refusal is monospace; history reads from → to in reading order;
//   5. the document tree expands to lines and units; picked / required reads "1 / 3" left to right;
//   6. a STARTED transfer (STO set, posted at the floor) reads "started"; the floor reads "—";
//   7. the timeline keeps the server's order, its reconstructed row is italic, tagged, with a
//      tooltip; the source filter and the key box narrow it;
//   8. Copy puts copy.text — and copy.json — on the clipboard byte for byte;
//   9. ?key= survives a reload;
//  10. an order gives a pick list (chips, stuck marker); a row opens its HEALTHY diagnosis;
//  11. a serial gives the holds table: PUT_BACK_BASKET neutral, STUCK linking to its diagnosis;
//  12. UNKNOWN reads "Unknown — escalate" with the copy prominent, the refusal in it, no fix;
//  13. matched:false shows the server's EN and AR sentences;
//  14. PICK-00002 shows the server's message with its code beside it; a 403 the UI's sentence;
//  15. no page errors.
// Ticket 497 (the fix) adds, with `canFixPickSupport` granted:
//  16. no Apply fix on HEALTHY or UNKNOWN; one per shape card on STUCK;
//  17. the dialog shows the shape code, the server's explanation and fix EN beside AR, the action
//      tags, reason maxLength 512 + the ~180 hint, reference maxLength 40; Confirm stays off until
//      both are non-blank after trimming;
//  18. a double click on Confirm sends ONE POST whose body carries exactly shape, reason, complaintRef;
//  19. on success the panel turns HEALTHY, the timeline shows SUPPORT_FIX, the dialog shows the
//      store's EN beside AR and each copy button copies its text verbatim; no second press offered;
//  20. `diagnosis: null` re-GETs the delivery and is still a success;
//  21. PICK-00224 keeps the dialog open with its code and message and offers Refresh diagnosis;
//      PICK-00225 offers no refresh; a bare 403 reads "You do not have access to apply fixes".
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/pick-support-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.pick-support-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: null, serverTime: '2026-10-15 09:41:07', data }),
})

/** The brief's refusal envelope (HTTP 400, `data` absent). */
const refusal = (errorCode, message) => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 400,
    success: false,
    message,
    errors: [{ errorCode, internalErrorCode: null, errorMessage: message }],
    serverTime: '2026-10-15 09:41:07',
  }),
})

const FLOOR = '0001-01-01T00:00:00'

// ── The brief's JSON ──────────────────────────────────────────────────────────────────────────

const COPY_TEXT =
  'Pick support - delivery 8006777365\nVerdict: STUCK\nRefusal: Picking document PD0000999 belongs to store 1112 and cannot be consumed here.\n' +
  'Shape DONOR_AT_OLD_ORDER_STORE\n  الفرع 1139: ألغِ الفاتورة المفتوحة\nTransfer: -\n'
const COPY_JSON = '{\n  "deliveryNo": "8006777365",\n  "verdict": "STUCK"\n}'

const resolved = (deliveryNo, over = {}) => ({
  deliveryNo,
  orderNo: '1000456789',
  currentStore: '1139',
  closeStatus: '',
  matchedBy: ['DELIVERY'],
  shapes: [],
  ...over,
})

const resolution = (key, over = {}) => ({ key, matched: true, messageEn: null, messageAr: null, deliveries: [], serials: [], ...over })

const RESOLVE = {
  // The brief's example, verbatim.
  8006777365: resolution('8006777365', { deliveries: [resolved('8006777365', { shapes: ['DONOR_AT_OLD_ORDER_STORE'] })] }),
  // An order with two deliveries.
  1000456789: resolution('1000456789', {
    deliveries: [
      resolved('8006777365', { matchedBy: ['ORDER'], shapes: ['DONOR_AT_OLD_ORDER_STORE'] }),
      resolved('8006777366', { matchedBy: ['ORDER'], currentStore: '1112', closeStatus: 'C' }),
    ],
  }),
  // A serial held twice: a put-back basket, and the stuck delivery's document.
  SN12345: resolution('SN12345', {
    deliveries: [
      resolved('8006777366', { matchedBy: ['SERIAL'], currentStore: '1112', closeStatus: 'C' }),
      resolved('8006777365', { matchedBy: ['SERIAL'], shapes: ['DONOR_AT_OLD_ORDER_STORE'] }),
    ],
    serials: [
      {
        serialNumber: 'SN12345',
        gtin: '06281234567890',
        documentNo: 'PD0001234',
        sourceType: 'OMS',
        sourceKey: '8006777366',
        storeCode: '1112',
        documentState: 'PUTBACK',
        consumedByTrx: '',
        deliveryNo: '8006777366',
        hold: 'PUT_BACK_BASKET',
        shapes: [],
        explanationEn: 'Store 1112 holds this unit in a put-back basket: the store must confirm Put back.',
        explanationAr: 'الفرع 1112 يحتفظ بهذه الوحدة في سلة إرجاع: على الفرع تأكيد الإرجاع.',
      },
      {
        serialNumber: 'SN12345',
        gtin: '06281234567890',
        documentNo: 'PD0000999',
        sourceType: 'DNR',
        sourceKey: 'DR0000123',
        storeCode: '1207',
        documentState: 'COMPLETE',
        consumedByTrx: '',
        deliveryNo: '8006777365',
        hold: 'STUCK',
        shapes: ['DONOR_AT_OLD_ORDER_STORE'],
        explanationEn: 'Delivery 8006777365 is stuck in DONOR_AT_OLD_ORDER_STORE; fixing the delivery ends this hold.',
        explanationAr: 'التوصيل 8006777365 عالق؛ إصلاح التوصيل ينهي هذا الاحتجاز.',
      },
    ],
  }),
  // A delivery in two shapes (ticket 497: two cards, two buttons).
  8006777368: resolution('8006777368', {
    deliveries: [resolved('8006777368', { shapes: ['DONOR_AT_OLD_ORDER_STORE', 'ENDED_STILL_HOLDS'] })],
  }),
  8006777367: resolution('8006777367', { deliveries: [resolved('8006777367', { currentStore: '1207' })] }),
  8006777300: resolution('8006777300', { deliveries: [resolved('8006777300')] }),
  ZZZ: resolution('ZZZ', {
    matched: false,
    messageEn:
      "Nothing matches 'ZZZ': it is not an order, delivery, till transaction, picking document, donor request or serial the system knows. Ask the store for another number.",
    messageAr: "لا شيء يطابق 'ZZZ': ليس طلباً ولا توصيلاً ولا حركة صندوق ولا مستند تجهيز ولا طلب متبرع ولا رقماً تسلسلياً يعرفه النظام. اطلب من الفرع رقماً آخر.",
  }),
}

const timelineEntry = (over) => ({
  at: '2026-10-01T10:12:40',
  source: 'DONOR_REQUEST',
  key: 'DR0000123',
  seq: 0,
  eventType: 'RAISE',
  actor: '1112-ph01',
  approvedBy: '',
  reason: '',
  complaintRef: '',
  detail: '',
  reconstructed: false,
  ...over,
})

const donorRequest = (over) => ({
  requestNo: 'DR0000123',
  deliveryNo: '8006777365',
  orderStore: '1112',
  donorStore: '1207',
  state: 'TRANSFERRED',
  documentNo: 'PD0000999',
  documentState: 'COMPLETE',
  documentRevision: 1,
  documentVoidReason: '',
  picked: 2,
  required: 2,
  unitsPicked: 2,
  isEditable: false,
  isCancellable: false,
  isRefusable: false,
  isRefusalOutstanding: false,
  raisedBy: '1112-ph01',
  raisedAt: '2026-10-01T10:12:40',
  changedBy: '',
  changedAt: FLOOR,
  fulfilledAt: '2026-10-01T10:40:00',
  outcome: '',
  outcomeReason: '',
  outcomeBy: '',
  outcomeAt: FLOOR,
  lockedAt: FLOOR,
  lockedBy: '',
  // A STARTED transfer: the STO is set, the posted time is still the floor.
  transferStoNo: '4500001234',
  transferredAt: FLOOR,
  transferSapDocumentNo: '',
  orderStoreName: '',
  deliverySlot: '',
  driverName: '',
  isDeliveryReady: false,
  reference: 'DNR:DR0000123',
  lines: [
    {
      deliveryLine: 1,
      itemNumber: '100200',
      description: 'Panadol 500mg',
      uom: 'BOX',
      requestedQuantity: 2,
      requestedUnits: 2,
      picked: 2,
      covered: 2,
      coveredUnits: 2,
      canGiveStated: false,
      canGiveQuantity: 0,
      refusedUncovered: 0,
      descriptionAr: '',
      isSerialised: true,
      isLotTracked: true,
      state: '',
    },
  ],
  ...over,
})

const pickDocument = (over) => ({
  documentNo: 'PD0001234',
  sourceType: 'OMS',
  sourceKey: '8006777365',
  storeCode: '1112',
  state: 'OPEN',
  revision: 2,
  voidReason: '',
  createdAt: '2026-10-01T09:00:00',
  createdBy: '1112-ph01',
  lastPickAt: '2026-10-01T09:30:00',
  lastPickBy: '1112-ph01',
  confirmedAt: FLOOR,
  confirmedBy: '',
  consumedByStore: '',
  consumedByTrx: '',
  confirmMode: '',
  picked: 1,
  required: 3,
  lines: [
    {
      lineNumber: 1,
      sourceLine: 10,
      itemNumber: '100200',
      description: 'Panadol 500mg',
      quantity: 3,
      uom: 'BOX',
      shortQuantity: 0,
      shortReason: '',
      isPickable: true,
      coveredQuantity: 0,
      owedUnits: 3,
      coveredUnits: 0,
      required: 3,
      picked: 1,
      state: 'PARTIAL',
      units: [
        {
          pickIndex: 1,
          pickType: 'SCAN',
          channel: 'HHT',
          scannedText: '0106281234567890215SN12345',
          barcode: '06281234567890',
          gtin: '06281234567890',
          serialNumber: 'SN12345',
          batchLot: 'B2026A',
          expiryDate: '2027-06-30',
          overrideReason: '',
          pickedBy: '1112-ph01',
          approvedBy: '',
          pickedAt: '2026-10-01T09:30:00',
          device: 'HHT-07',
        },
      ],
    },
  ],
  ...over,
})

const SHAPE = {
  shape: 'DONOR_AT_OLD_ORDER_STORE',
  explanationEn:
    'Delivery 8006777365 was moved to store 1139, but the picking document of donor request DR0000123 is still tied to its old order store.',
  explanationAr: 'نُقل التوصيل 8006777365 إلى الفرع 1139، لكن مستند تجهيز طلب المتبرع DR0000123 لا يزال مرتبطاً بفرع الطلب القديم.',
  fixEn: 'End the donor document as the store change would have: close it TRANSFERRED OUT at the old order store.',
  fixAr: 'أنهِ مستند المتبرع كما كان سيفعل تغيير الفرع: أغلقه محوَّلاً إلى الخارج في فرع الطلب القديم.',
  tellTheStoreEn:
    'Store 1139: void the open invoice of delivery 8006777365, re-open the order from the worklist, and pick every line from your own shelf.',
  tellTheStoreAr: 'الفرع 1139: ألغِ الفاتورة المفتوحة للتوصيل 8006777365، وأعد فتح الطلب من قائمة العمل، وجهّز كل سطر من رفّك.',
  requests: [
    { requestNo: 'DR0000123', documentNo: 'PD0000999', orderStore: '1112', donorStore: '1207', state: 'TRANSFERRED', action: 'CLOSE_TRANSFERRED_OUT' },
  ],
  documents: [{ documentNo: 'PD0001234', storeCode: '1112', state: 'OPEN', action: 'PUT_BACK_OR_VOID' }],
}

const REFUSAL_TEXT = 'Picking document PD0000999 belongs to store 1112 and cannot be consumed here.'

const diagnosis = (deliveryNo, over = {}) => ({
  deliveryNo,
  orderNo: '1000456789',
  currentStore: '1139',
  readyStatus: '',
  closeStatus: '',
  verdict: 'HEALTHY',
  refusalText: null,
  storeHistory: [],
  documents: [],
  donorRequests: [],
  shapes: [],
  timeline: [],
  copy: { text: `Pick support - delivery ${deliveryNo}\n`, json: `{\n  "deliveryNo": "${deliveryNo}"\n}` },
  ...over,
})

const DIAGNOSIS = {
  8006777365: diagnosis('8006777365', {
    verdict: 'STUCK',
    refusalText: REFUSAL_TEXT,
    storeHistory: [
      { at: '2026-10-02T14:03:11', by: 'agent01', documentNo: '8006777365', actionType: 'DCST', fromStore: '1112', toStore: '1139' },
    ],
    documents: [
      pickDocument(),
      pickDocument({ documentNo: 'PD0000999', sourceType: 'DNR', sourceKey: 'DR0000123', storeCode: '1207', state: 'COMPLETE', picked: 2, required: 2, lines: [] }),
    ],
    donorRequests: [donorRequest()],
    shapes: [SHAPE],
    timeline: [
      timelineEntry({ reconstructed: true }),
      timelineEntry({ at: '2026-10-01T10:30:00', source: 'PICK_DOCUMENT', key: 'PD0000999', seq: 1, eventType: 'PICK', actor: '1207-ph02' }),
      timelineEntry({ at: '2026-10-01T11:00:00', source: 'DONOR_REQUEST', key: 'DR0000123', seq: 3, eventType: 'TRANSFER_STARTED', actor: 'DRS' }),
      timelineEntry({ at: '2026-10-02T14:03:11', source: 'DELIVERY_LOG', key: '8006777365', eventType: 'DCST', actor: 'agent01', detail: 'Store moved' }),
    ],
    copy: { text: COPY_TEXT, json: COPY_JSON },
  }),
  8006777366: diagnosis('8006777366', { currentStore: '1112', closeStatus: 'C' }),
  8006777368: diagnosis('8006777368', {
    verdict: 'STUCK',
    refusalText: REFUSAL_TEXT,
    shapes: [
      SHAPE,
      {
        ...SHAPE,
        shape: 'ENDED_STILL_HOLDS',
        explanationEn: 'Delivery 8006777368 has ended, but its picking document PD0001234 still holds a unit.',
        explanationAr: 'انتهى التوصيل 8006777368، لكن مستند تجهيزه PD0001234 لا يزال يحتجز وحدة.',
        requests: [],
      },
    ],
  }),
  8006777367: diagnosis('8006777367', {
    currentStore: '1207',
    verdict: 'UNKNOWN',
    refusalText: 'Picking document PD0004444 is open at store 1112 and only that store may consume it.',
    copy: { text: 'Pick support - delivery 8006777367\nVerdict: UNKNOWN\n', json: '{\n  "verdict": "UNKNOWN"\n}' },
  }),
}

// After the fix (ticket 497): HEALTHY, the donor document closed TRANSFERRED OUT, and a SUPPORT_FIX
// step on both the picking document and the donor request.
const FIX_REASON = 'Store 1139 cannot invoice after the move'
const FIX_REF = 'CMP-2026-10-0412'
const FIXED_DIAGNOSIS = diagnosis('8006777365', {
  ...DIAGNOSIS[8006777365],
  verdict: 'HEALTHY',
  refusalText: null,
  shapes: [],
  donorRequests: [donorRequest({ documentState: 'VOIDED', documentVoidReason: 'TRANSFERRED_OUT' })],
  timeline: [
    ...DIAGNOSIS[8006777365].timeline,
    timelineEntry({
      at: '2026-10-15T09:41:07',
      source: 'PICK_DOCUMENT',
      key: 'PD0000999',
      seq: 2,
      eventType: 'SUPPORT_FIX',
      actor: 'support01',
      reason: FIX_REASON,
      complaintRef: FIX_REF,
      detail: `DONOR_AT_OLD_ORDER_STORE; complaint ${FIX_REF}; ${FIX_REASON}`,
    }),
    timelineEntry({
      at: '2026-10-15T09:41:07',
      source: 'DONOR_REQUEST',
      key: 'DR0000123',
      seq: 4,
      eventType: 'SUPPORT_FIX',
      actor: 'support01',
      reason: FIX_REASON,
      complaintRef: FIX_REF,
    }),
  ],
  copy: { text: 'Pick support - delivery 8006777365\nVerdict: HEALTHY\n', json: '{\n  "verdict": "HEALTHY"\n}' },
})
const fixResult = (diagnosis) => ({
  shape: 'DONOR_AT_OLD_ORDER_STORE',
  tellTheStoreEn: SHAPE.tellTheStoreEn,
  tellTheStoreAr: SHAPE.tellTheStoreAr,
  diagnosis,
})
const NOT_IN_SHAPE = 'Delivery 8006777365 is not in shape DONOR_AT_OLD_ORDER_STORE — nothing was changed; refresh its diagnosis'
const NO_REASON = 'Delivery 8006777365: a reason and a complaint reference are required — nothing was changed'

// ── The harness ──────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch()

/** `grant`: false (no flag), true (open), 'fix' (open + fix). `fixMode`: how the Fix door answers. */
async function open(dir, { grant = true, fixMode = 'ok' } = {}) {
  const state = { fixMode, fixed: false, fixBodies: [] }
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
    // The exact string the app hands the clipboard. Reading the OS clipboard back is not byte-exact
    // on Windows (it turns LF into CRLF), so the byte-for-byte proof is what was WRITTEN.
    if (navigator.clipboard) {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard)
      navigator.clipboard.writeText = (text) => {
        window.__copied = text
        return write(text)
      }
    }
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p + url.search)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'support01', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(
        envelope(
          grant
            ? { canOpenList: true, canOpenDetail: true, canOpenPickSupport: true, ...(grant === 'fix' ? { canFixPickSupport: true } : {}) }
            : { canOpenList: true, canOpenDetail: true },
        ),
      )
    if (p === 'PickSupport/Resolve') {
      const key = url.searchParams.get('key') ?? ''
      // A 403 has NO body (brief "The envelope").
      if (key === 'DENIED') return route.fulfill({ status: 403, body: '' })
      // Once fixed, the serial is no longer held by the stuck delivery's document.
      if (key === 'SN12345' && state.fixed)
        return route.fulfill(
          envelope({
            ...RESOLVE.SN12345,
            deliveries: RESOLVE.SN12345.deliveries.filter((d) => d.deliveryNo !== '8006777365'),
            serials: RESOLVE.SN12345.serials.filter((h) => h.hold !== 'STUCK'),
          }),
        )
      const answer = RESOLVE[key]
      return route.fulfill(
        envelope(
          answer ??
            resolution(key, {
              matched: false,
              messageEn: `Nothing matches '${key}'.`,
              messageAr: `لا شيء يطابق '${key}'.`,
            }),
        ),
      )
    }
    const fixDoor = /^PickSupport\/Delivery\/([^/]+)\/Fix$/.exec(p)
    if (fixDoor && route.request().method() === 'POST') {
      state.fixBodies.push(route.request().postData())
      // Slow enough that a double click lands while the first press is still in flight.
      await new Promise((r) => setTimeout(r, 500))
      if (state.fixMode === '403') return route.fulfill({ status: 403, body: '' })
      if (state.fixMode === '224') return route.fulfill(refusal('PICK-00224', NOT_IN_SHAPE))
      if (state.fixMode === '225') return route.fulfill(refusal('PICK-00225', NO_REASON))
      state.fixed = true
      return route.fulfill(envelope(fixResult(state.fixMode === 'null' ? null : FIXED_DIAGNOSIS)))
    }
    const delivery = /^PickSupport\/Delivery\/([^/]+)$/.exec(p)
    if (delivery) {
      const no = decodeURIComponent(delivery[1])
      if (state.fixed && no === '8006777365') return route.fulfill(envelope(FIXED_DIAGNOSIS))
      if (DIAGNOSIS[no]) return route.fulfill(envelope(DIAGNOSIS[no]))
      return route.fulfill(refusal('PICK-00002', `Delivery ${no} not found`))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, state }
}

const omsLinks = (page) =>
  page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

const doorCalls = (calls) => calls.filter((c) => c.startsWith('PickSupport/'))

/** What the app last put on the clipboard (exact), and what the OS clipboard holds (line ends normalised). */
const clipboard = (page) =>
  page.evaluate(async () => ({ written: window.__copied ?? null, read: (await navigator.clipboard.readText()).replace(/\r\n/g, '\n') }))

/** Whether a text reads left to right on screen: its first character's box starts left of its last's. */
const readsLtr = (locator) =>
  locator.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode)
    if (!nodes.length) return null
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const box = (node, i) => {
      const r = document.createRange()
      r.setStart(node, i)
      r.setEnd(node, i + 1)
      return r.getBoundingClientRect()
    }
    const firstIdx = first.textContent.search(/\S/)
    const lastIdx = last.textContent.length - 1 - [...last.textContent].reverse().join('').search(/\S/)
    return box(first, firstIdx).left < box(last, lastIdx).left
  })

async function drive(dir) {
  const label = dir
  const rtl = dir === 'rtl'

  // ── 1: no flag → hidden leaf, denied card, no door call ──────────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir, { grant: false })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/deliveries"]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    const links = await omsLinks(page)
    check(`${label}: without the flag the Pick support leaf is hidden`, !links.includes('/oms/pick-support'), links.join(' · '))
    await page.goto(`${BASE}/oms/pick-support?key=8006777365`)
    const card = page.locator('[role="alert"]', { hasText: 'No access to Pick support' })
    await card.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(`${label}: the URL shows the denied card and never calls a door`, (await card.count()) === 1 && doorCalls(calls).length === 0, doorCalls(calls).join(','))
    check(`${label}: no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–9: the STUCK diagnosis, typed in ──────────────────────────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir)
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/pick-support"]').first().waitFor({ timeout: 20000 })
    check(`${label}: with the flag the leaf shows`, (await omsLinks(page)).includes('/oms/pick-support'))
    await page.locator('nav a[href="/oms/pick-support"]').first().click()
    await page.locator('[data-ps-key]').waitFor({ timeout: 20000 })
    check(`${label}: Search is the default tab`, (await page.locator('[data-ps-tab="search"][aria-selected="true"]').count()) === 1)
    await page.locator('[data-ps-key]').fill('  8006777365 ')
    await page.locator('[data-ps-key]').press('Enter')
    await page.locator('[data-ps-panel="8006777365"]').waitFor({ timeout: 20000 })
    check(
      `${label}: Enter calls Resolve with the trimmed key, and holds it in the URL`,
      calls.includes('PickSupport/Resolve?key=8006777365') && new URL(page.url()).search === '?key=8006777365',
      `${page.url()} · ${doorCalls(calls).join(',')}`,
    )
    check(`${label}: one delivery and no serials → its diagnosis`, calls.includes('PickSupport/Delivery/8006777365'))

    const panel = page.locator('[data-ps-panel="8006777365"]')
    check(`${label}: the verdict is STUCK, shown as the code`, (await panel.getAttribute('data-ps-verdict')) === 'stuck' && (await panel.locator('[data-ps-verdict-code="STUCK"]').count()) === 1)
    const sections = await panel.locator('[data-ps-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ps-section')))
    check(`${label}: every section is drawn`, ['refusal', 'history', 'documents', 'requests', 'timeline'].every((s) => sections.includes(s)), sections.join(','))

    // 4: the shape card
    const card = panel.locator('[data-ps-card="DONOR_AT_OLD_ORDER_STORE"]')
    check(`${label}: one card for the one shape, with its code`, (await panel.locator('[data-ps-card]').count()) === 1 && (await card.locator('code', { hasText: 'DONOR_AT_OLD_ORDER_STORE' }).count()) === 1)
    const explanation = card.locator('[data-ps-enar="explanation"]')
    const en = explanation.locator('[data-ps-en]')
    const ar = explanation.locator('[data-ps-ar]')
    check(`${label}: the explanation is the server's EN and AR, verbatim`, (await en.innerText()) === SHAPE.explanationEn && (await ar.innerText()) === SHAPE.explanationAr)
    const dirs = await Promise.all([en, ar].map((l) => l.evaluate((el) => getComputedStyle(el).direction)))
    check(`${label}: the EN reads LTR and the AR RTL, whatever the page`, dirs[0] === 'ltr' && dirs[1] === 'rtl', dirs.join(','))
    const boxes = await Promise.all([en, ar].map((l) => l.boundingBox()))
    check(`${label}: EN and AR sit side by side`, boxes[0] && boxes[1] && Math.abs(boxes[0].y - boxes[1].y) < 4 && (rtl ? boxes[0].x > boxes[1].x : boxes[0].x < boxes[1].x), JSON.stringify(boxes))
    check(
      `${label}: the fix sentence is the server's, EN and AR`,
      (await card.locator('[data-ps-enar="fix"] [data-ps-en]').innerText()) === SHAPE.fixEn && (await card.locator('[data-ps-enar="fix"] [data-ps-ar]').innerText()) === SHAPE.fixAr,
    )
    check(
      `${label}: per-request and per-document action tags, as codes`,
      (await card.locator('[data-ps-card-requests] [data-ps-action="CLOSE_TRANSFERRED_OUT"]').count()) === 1 &&
        (await card.locator('[data-ps-card-documents] [data-ps-action="PUT_BACK_OR_VOID"]').count()) === 1,
    )
    check(`${label}: without canFixPickSupport there is no Apply fix button, and no tell-the-store text`, (await page.getByRole('button', { name: /apply fix/i }).count()) === 0 && !(await panel.innerText()).includes(SHAPE.tellTheStoreEn))
    const refusalBlock = panel.locator('[data-ps-section="refusal"] [data-ps-refusal]')
    check(
      `${label}: the refusal is the server's sentence, in monospace`,
      (await refusalBlock.innerText()) === REFUSAL_TEXT && /mono/i.test(await refusalBlock.evaluate((el) => getComputedStyle(el).fontFamily)),
    )
    const from = panel.locator('[data-ps-move="0"] [data-ps-from]')
    const to = panel.locator('[data-ps-move="0"] [data-ps-to]')
    const [fb, tb] = [await from.boundingBox(), await to.boundingBox()]
    check(
      `${label}: the store move reads from 1112 → to 1139 in reading order`,
      (await from.innerText()) === '1112' && (await to.innerText()) === '1139' && (rtl ? fb.x > tb.x : fb.x < tb.x),
      `${fb?.x} ${tb?.x}`,
    )
    check(`${label}: the move's time is shown as sent`, (await panel.locator('[data-ps-move="0"]').innerText()).includes('2026-10-02T14:03:11'))

    // 5: the document tree
    const doc = panel.locator('[data-ps-document="PD0001234"]')
    check(`${label}: documents are told apart by sourceType`, (await panel.locator('[data-ps-document="PD0000999"] summary code', { hasText: 'DNR' }).count()) === 1 && (await doc.locator('summary code', { hasText: 'OMS' }).count()) === 1)
    await doc.locator('summary').click()
    await doc.locator('[data-ps-units="1"]').waitFor({ timeout: 5000 })
    const units = await doc.locator('[data-ps-units="1"]').innerText()
    check(`${label}: a document expands to its lines and units (serial, batch, expiry)`, units.includes('SN12345') && units.includes('B2026A') && units.includes('2027-06-30'), units.replace(/\s+/g, ' '))
    const count = doc.locator('[data-ps-line="1"] [data-ps-count]')
    check(`${label}: picked / required reads "1 / 3", left to right`, (await count.innerText()) === '1 / 3' && (await readsLtr(count)) === true)

    // 6: the donor request and its started transfer
    const req = panel.locator('[data-ps-request="DR0000123"]')
    check(`${label}: an STO with a floor posted time reads "started"`, (await req.getAttribute('data-ps-transfer')) === 'started' && (await req.locator('[data-ps-started]').innerText()) === 'started')
    check(`${label}: the request's picked / required reads "2 / 2" and no floor stamp leaks`, (await req.locator('[data-ps-count]').innerText()) === '2 / 2' && !(await panel.innerText()).includes('0001-01-01'))

    // 7: the timeline
    const rows = panel.locator('[data-ps-timeline] tbody tr')
    const order = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-ps-event')))
    check(`${label}: the timeline keeps the server's order`, order.join(',') === 'RAISE,PICK,TRANSFER_STARTED,DCST', order.join(','))
    const recon = panel.locator('[data-ps-timeline] tr[data-reconstructed]')
    const reconStyle = await recon.evaluate((el) => getComputedStyle(el).fontStyle)
    const tag = recon.locator('[data-ps-reconstructed]')
    check(
      `${label}: the reconstructed row is italic, tagged, with a tooltip`,
      (await recon.count()) === 1 && reconStyle === 'italic' && (await tag.innerText()) === 'reconstructed' && /stamp columns/.test((await tag.getAttribute('title')) ?? ''),
    )
    await panel.locator('[data-ps-timeline-source]').selectOption('DONOR_REQUEST')
    const bySource = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-ps-event')))
    check(`${label}: the source filter narrows and keeps the order`, bySource.join(',') === 'RAISE,TRANSFER_STARTED', bySource.join(','))
    await panel.locator('[data-ps-timeline-source]').selectOption('')
    await panel.locator('[data-ps-timeline-key]').fill('pd00')
    const byKey = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-ps-event')))
    check(`${label}: the key box narrows by key`, byKey.join(',') === 'PICK', byKey.join(','))
    await panel.locator('[data-ps-timeline-key]').fill('')
    const stampOrder = panel.locator('[data-ps-timeline] tbody tr').first().locator('td').first().locator('bdi').first()
    check(`${label}: a timeline time reads left to right`, (await readsLtr(stampOrder)) === true)
    await page.screenshot({ path: `${SHOTS}/${dir}-stuck.png`, fullPage: true })

    // 8: Copy, byte for byte
    await page.evaluate(() => navigator.clipboard.writeText('-'))
    await panel.locator('[data-ps-copy="text"]').first().click()
    await page.waitForTimeout(200)
    const copied = await clipboard(page)
    check(
      `${label}: Copy as text puts copy.text on the clipboard byte for byte`,
      copied.written === COPY_TEXT && copied.read === COPY_TEXT && (await page.getByText('Diagnosis copied').count()) > 0,
      JSON.stringify(copied).slice(0, 120),
    )
    await panel.locator('[data-ps-copy="json"]').first().click()
    await page.waitForTimeout(200)
    const copiedJson = await clipboard(page)
    check(`${label}: Copy as JSON puts copy.json on the clipboard byte for byte`, copiedJson.written === COPY_JSON && copiedJson.read === COPY_JSON, JSON.stringify(copiedJson))

    // 9: reload
    await page.reload()
    await page.locator('[data-ps-panel="8006777365"]').waitFor({ timeout: 20000 })
    check(`${label}: ?key= survives a reload, input and diagnosis alike`, (await page.locator('[data-ps-key]').inputValue()) === '8006777365' && new URL(page.url()).search === '?key=8006777365')
    const reads = () => calls.filter((c) => c === 'PickSupport/Delivery/8006777365').length
    const before = reads()
    await page.locator('[data-ps-key]').press('Enter')
    await page.waitForTimeout(600)
    check(`${label}: Enter on the same number asks again — the diagnosis too, not only Resolve`, reads() === before + 1, `${before} → ${reads()}`)
    check(`${label}: no page errors (stuck)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 10: an order → a pick list ─────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/oms/pick-support?key=1000456789`)
    await page.locator('[data-ps-section="list"]').waitFor({ timeout: 20000 })
    const rows = page.locator('[data-ps-section="list"] [data-ps-row]')
    const order = await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-ps-row')))
    check(`${label}: an order gives a pick list of its two deliveries, in the server's order`, order.join(',') === '8006777365,8006777366', order.join(','))
    check(
      `${label}: matchedBy reads as a chip and the stuck marker sits on the stuck row only`,
      (await page.locator('[data-ps-row="8006777365"] [data-ps-matched-by="ORDER"]').innerText()) === 'Order' &&
        (await page.locator('[data-ps-row][data-ps-stuck]').count()) === 1 &&
        (await page.locator('[data-ps-row="8006777365"][data-ps-stuck]').count()) === 1,
    )
    check(`${label}: no diagnosis is read before a row is opened`, (await page.locator('[data-ps-panel]').count()) === 0)
    await page.goto(`${BASE}/oms/pick-support?key=1000456789&delivery=8006777399`)
    await page.locator('[data-ps-section="list"]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    check(`${label}: a ?delivery= the key did not resolve to draws nothing under the list`, (await page.locator('[data-ps-panel]').count()) === 0)
    await page.locator('[data-ps-open="8006777366"]').click()
    await page.locator('[data-ps-panel="8006777366"]').waitFor({ timeout: 20000 })
    check(
      `${label}: a row opens its diagnosis — HEALTHY reads "Nothing is stuck"`,
      (await page.locator('[data-ps-panel="8006777366"]').getAttribute('data-ps-verdict')) === 'healthy' &&
        (await page.locator('[data-ps-healthy]').innerText()).includes('Nothing is stuck') &&
        new URL(page.url()).searchParams.get('delivery') === '8006777366',
    )
    check(`${label}: a HEALTHY diagnosis still offers Copy`, (await page.locator('[data-ps-panel="8006777366"] [data-ps-copy="text"]').count()) === 1)
    await page.screenshot({ path: `${SHOTS}/${dir}-order.png`, fullPage: true })
    check(`${label}: no page errors (order)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 11: a serial → the holds table ─────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/oms/pick-support?key=SN12345`)
    await page.locator('[data-ps-section="holds"]').waitFor({ timeout: 20000 })
    const putBack = page.locator('[data-ps-hold="PUT_BACK_BASKET"]')
    const stuck = page.locator('[data-ps-hold="STUCK"]')
    check(
      `${label}: PUT_BACK_BASKET is neutral, with the server's explanation EN beside AR`,
      (await putBack.getAttribute('data-ps-hold-view')) === 'neutral' &&
        (await putBack.locator('[data-ps-en]').innerText()) === RESOLVE.SN12345.serials[0].explanationEn &&
        (await putBack.locator('[data-ps-ar]').innerText()) === RESOLVE.SN12345.serials[0].explanationAr &&
        (await putBack.locator('[data-ps-hold-open]').count()) === 0,
    )
    check(`${label}: STUCK is a warning linking to its delivery`, (await stuck.getAttribute('data-ps-hold-view')) === 'stuck' && (await stuck.locator('[data-ps-hold-open="8006777365"]').count()) === 1)
    await stuck.locator('[data-ps-hold-open="8006777365"]').click()
    await page.locator('[data-ps-panel="8006777365"]').waitFor({ timeout: 20000 })
    check(`${label}: the STUCK hold opens its delivery's diagnosis`, (await page.locator('[data-ps-panel="8006777365"]').getAttribute('data-ps-verdict')) === 'stuck')
    await page.screenshot({ path: `${SHOTS}/${dir}-serial.png`, fullPage: true })
    check(`${label}: no page errors (serial)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 12–14: UNKNOWN, no match, PICK-00002, 403 ───────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/oms/pick-support?key=8006777367`)
    const panel = page.locator('[data-ps-panel="8006777367"]')
    await panel.waitFor({ timeout: 20000 })
    const esc = panel.locator('[data-ps-escalate]')
    check(
      `${label}: UNKNOWN reads "Unknown — escalate" with the copy prominent and the refusal in it`,
      (await panel.getAttribute('data-ps-verdict')) === 'escalate' &&
        (await esc.innerText()).includes('Unknown — escalate') &&
        (await esc.locator('[data-ps-copy-group="prominent"]').count()) === 1 &&
        (await esc.locator('[data-ps-refusal]').innerText()) === DIAGNOSIS[8006777367].refusalText,
    )
    check(`${label}: UNKNOWN has no shape card and no fix button`, (await panel.locator('[data-ps-card]').count()) === 0 && (await page.getByRole('button', { name: /fix/i }).count()) === 0)
    await page.locator('[data-ps-copy-group="prominent"] [data-ps-copy="text"]').click()
    await page.waitForTimeout(200)
    check(`${label}: the escalate copy is copy.text verbatim`, (await clipboard(page)).written === DIAGNOSIS[8006777367].copy.text)
    await page.screenshot({ path: `${SHOTS}/${dir}-unknown.png`, fullPage: true })

    await page.locator('[data-ps-key]').fill('ZZZ')
    await page.locator('[data-ps-key]').press('Enter')
    const none = page.locator('[data-ps-no-match]')
    await none.waitFor({ timeout: 20000 })
    check(
      `${label}: matched:false shows the server's EN and AR sentence, not an error`,
      (await none.locator('[data-ps-en]').innerText()) === RESOLVE.ZZZ.messageEn &&
        (await none.locator('[data-ps-ar]').innerText()) === RESOLVE.ZZZ.messageAr &&
        (await page.locator('[data-ps-failure]').count()) === 0,
    )

    await page.locator('[data-ps-key]').fill('8006777300')
    await page.locator('[data-ps-key]').press('Enter')
    const failure = page.locator('[data-ps-failure="refused"]')
    await failure.waitFor({ timeout: 20000 })
    check(
      `${label}: PICK-00002 shows the server's message with its code beside it`,
      (await failure.locator('[data-ps-error-code="PICK-00002"]').innerText()) === 'PICK-00002' &&
        (await failure.locator('[data-ps-error-message]').innerText()) === 'Delivery 8006777300 not found',
    )
    const codeBox = await failure.locator('[data-ps-error-code]').boundingBox()
    const msgBox = await failure.locator('[data-ps-error-message]').boundingBox()
    check(`${label}: the code sits beside the message, on its line`, codeBox && msgBox && Math.abs(codeBox.y - msgBox.y) < 6, JSON.stringify([codeBox, msgBox]))
    await page.screenshot({ path: `${SHOTS}/${dir}-not-found.png`, fullPage: true })

    await page.locator('[data-ps-key]').fill('DENIED')
    await page.locator('[data-ps-key]').press('Enter')
    const denied = page.locator('[data-ps-failure="denied"]')
    await denied.waitFor({ timeout: 20000 })
    check(`${label}: a bare 403 reads "You do not have access to Pick support"`, (await denied.innerText()).trim() === 'You do not have access to Pick support')
    check(`${label}: no page errors (unknown, no match, refusals)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// ── 16–21 (ticket 497): Apply fix ─────────────────────────────────────────────────────────────

const fixCalls = (calls) => calls.filter((c) => /^PickSupport\/Delivery\/[^/]+\/Fix$/.test(c))
const deliveryReads = (calls) => calls.filter((c) => c === 'PickSupport/Delivery/8006777365').length

/** Opens the STUCK delivery with the fix granted, and its dialog with both fields filled. */
async function openFixDialog(dir, fixMode) {
  const ctx = await open(dir, { grant: 'fix', fixMode })
  await ctx.page.goto(`${BASE}/oms/pick-support?key=8006777365`)
  await ctx.page.locator('[data-ps-apply-fix="DONOR_AT_OLD_ORDER_STORE"]').click({ timeout: 20000 })
  const dialog = ctx.page.locator('[data-ps-fix-dialog]')
  await dialog.waitFor({ timeout: 5000 })
  await dialog.locator('[data-ps-fix-reason]').fill(FIX_REASON)
  await dialog.locator('[data-ps-fix-reference]').fill(FIX_REF)
  return { ...ctx, dialog }
}

async function driveFix(dir) {
  const label = `${dir} fix`
  const rtl = dir === 'rtl'

  // 16: no button on HEALTHY or UNKNOWN, even with the grant
  {
    const { context, page, errors } = await open(dir, { grant: 'fix' })
    await page.goto(`${BASE}/oms/pick-support?key=1000456789&delivery=8006777366`)
    await page.locator('[data-ps-panel="8006777366"]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(`${label}: HEALTHY has no Apply fix button`, (await page.locator('[data-ps-apply-fix]').count()) === 0)
    await page.goto(`${BASE}/oms/pick-support?key=8006777367`)
    await page.locator('[data-ps-panel="8006777367"]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: UNKNOWN has no Apply fix button`,
      (await page.locator('[data-ps-apply-fix]').count()) === 0 && (await page.getByRole('button', { name: /apply fix/i }).count()) === 0,
    )
    check(`${label}: no page errors (no button)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 16b: a delivery in two shapes gets two cards and two buttons, each opening its own shape
  {
    const { context, page, errors } = await open(dir, { grant: 'fix' })
    await page.goto(`${BASE}/oms/pick-support?key=8006777368`)
    const panel = page.locator('[data-ps-panel="8006777368"]')
    await panel.waitFor({ timeout: 20000 })
    const shapes = await panel.locator('[data-ps-apply-fix]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ps-apply-fix')))
    check(
      `${label}: two shapes → two cards, each with its own Apply fix`,
      (await panel.locator('[data-ps-card]').count()) === 2 && shapes.join(',') === 'DONOR_AT_OLD_ORDER_STORE,ENDED_STILL_HOLDS',
      shapes.join(','),
    )
    await panel.locator('[data-ps-apply-fix="ENDED_STILL_HOLDS"]').click()
    const dialog = page.locator('[data-ps-fix-dialog="ENDED_STILL_HOLDS"]')
    await dialog.waitFor({ timeout: 5000 })
    check(
      `${label}: the second button opens the dialog on its own shape`,
      (await dialog.locator('[data-ps-enar="explanation"] [data-ps-en]').innerText()) === DIAGNOSIS[8006777368].shapes[1].explanationEn,
    )
    check(`${label}: no page errors (two shapes)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 17–19: the dialog, one POST, success with a diagnosis
  {
    const { context, page, errors, calls, state } = await open(dir, { grant: 'fix' })
    await page.goto(`${BASE}/oms/pick-support?key=8006777365`)
    const panel = page.locator('[data-ps-panel="8006777365"]')
    await panel.waitFor({ timeout: 20000 })
    const buttons = panel.locator('[data-ps-apply-fix]')
    await buttons.first().waitFor({ timeout: 5000 })
    check(
      `${label}: one Apply fix on the one shape card`,
      (await buttons.count()) === 1 && (await panel.locator('[data-ps-card="DONOR_AT_OLD_ORDER_STORE"] [data-ps-apply-fix]').innerText()).trim() === 'Apply fix',
    )
    await buttons.click()
    const dialog = page.locator('[data-ps-fix-dialog="DONOR_AT_OLD_ORDER_STORE"]')
    await dialog.waitFor({ timeout: 5000 })
    check(`${label}: the dialog shows the shape code`, (await dialog.locator('code', { hasText: 'DONOR_AT_OLD_ORDER_STORE' }).count()) >= 1)
    const en = dialog.locator('[data-ps-enar="explanation"] [data-ps-en]')
    const ar = dialog.locator('[data-ps-enar="explanation"] [data-ps-ar]')
    const [eb, ab] = [await en.boundingBox(), await ar.boundingBox()]
    check(
      `${label}: the explanation and fix are the server's EN beside AR`,
      (await en.innerText()) === SHAPE.explanationEn &&
        (await ar.innerText()) === SHAPE.explanationAr &&
        (await dialog.locator('[data-ps-enar="fix"] [data-ps-en]').innerText()) === SHAPE.fixEn &&
        (await dialog.locator('[data-ps-enar="fix"] [data-ps-ar]').innerText()) === SHAPE.fixAr &&
        eb &&
        ab &&
        Math.abs(eb.y - ab.y) < 4 &&
        (rtl ? eb.x > ab.x : eb.x < ab.x),
      JSON.stringify([eb, ab]),
    )
    check(
      `${label}: the dialog lists the request and the document with their action tags`,
      (await dialog.locator('[data-ps-card-requests] [data-ps-action="CLOSE_TRANSFERRED_OUT"]').count()) === 1 &&
        (await dialog.locator('[data-ps-card-documents] [data-ps-action="PUT_BACK_OR_VOID"]').count()) === 1,
    )
    const reason = dialog.locator('[data-ps-fix-reason]')
    const reference = dialog.locator('[data-ps-fix-reference]')
    check(
      `${label}: reason is a textarea of maxLength 512 with the ~180 hint; reference maxLength 40`,
      (await reason.evaluate((el) => el.tagName)) === 'TEXTAREA' &&
        (await reason.getAttribute('maxlength')) === '512' &&
        (await reference.getAttribute('maxlength')) === '40' &&
        /180/.test(await dialog.locator('[data-ps-fix-reason-hint]').innerText()),
    )
    const confirm = page.locator('[data-ps-fix-confirm]')
    const off0 = await confirm.isDisabled()
    await reason.fill('   \n  ')
    await reference.fill(FIX_REF)
    const off1 = await confirm.isDisabled()
    await reason.fill(`  ${FIX_REASON} `)
    await reference.fill('   ')
    const off2 = await confirm.isDisabled()
    await reference.fill(` ${FIX_REF} `)
    const on = await confirm.isEnabled()
    check(`${label}: Confirm stays off until both are non-blank after trimming`, off0 && off1 && off2 && on, `${off0} ${off1} ${off2} ${on}`)
    await page.screenshot({ path: `${SHOTS}/${dir}-fix-dialog.png`, fullPage: true })

    const readsBefore = deliveryReads(calls)
    await confirm.dblclick()
    await page.locator('[data-ps-fix-done]').waitFor({ timeout: 10000 })
    await page.waitForTimeout(600)
    check(`${label}: a double click sends ONE POST`, fixCalls(calls).length === 1 && state.fixBodies.length === 1, fixCalls(calls).join(','))
    const body = JSON.parse(state.fixBodies[0] ?? '{}')
    check(
      `${label}: the body carries exactly shape, reason and complaintRef (trimmed; no actor)`,
      Object.keys(body).sort().join(',') === 'complaintRef,reason,shape' &&
        body.shape === 'DONOR_AT_OLD_ORDER_STORE' &&
        body.reason === FIX_REASON &&
        body.complaintRef === FIX_REF,
      state.fixBodies[0],
    )
    check(
      `${label}: the panel takes the returned diagnosis — HEALTHY, no shape card, no re-GET`,
      (await panel.getAttribute('data-ps-verdict')) === 'healthy' && (await panel.locator('[data-ps-card]').count()) === 0 && deliveryReads(calls) === readsBefore,
      `${readsBefore} → ${deliveryReads(calls)}`,
    )
    const fixes = await panel
      .locator('[data-ps-timeline] tr[data-ps-event="SUPPORT_FIX"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-ps-timeline-row')))
    check(`${label}: the timeline shows SUPPORT_FIX on the picking document and the donor request`, fixes.join(',') === 'PD0000999,DR0000123', fixes.join(','))
    const tellEn = dialog.locator('[data-ps-tell-lang="en"] [data-ps-tell-text]')
    const tellAr = dialog.locator('[data-ps-tell-lang="ar"] [data-ps-tell-text]')
    const [teb, tab] = [await tellEn.boundingBox(), await tellAr.boundingBox()]
    check(
      `${label}: the dialog shows the store's instructions, EN beside AR, as sent`,
      (await tellEn.innerText()) === SHAPE.tellTheStoreEn &&
        (await tellAr.innerText()) === SHAPE.tellTheStoreAr &&
        teb &&
        tab &&
        Math.abs(teb.y - tab.y) < 4 &&
        (rtl ? teb.x > tab.x : teb.x < tab.x),
      JSON.stringify([teb, tab]),
    )
    const tellDirs = await Promise.all([tellEn, tellAr].map((l) => l.evaluate((el) => getComputedStyle(el).direction)))
    check(`${label}: the store's EN reads LTR and its AR RTL`, tellDirs.join(',') === 'ltr,rtl', tellDirs.join(','))
    await dialog.locator('[data-ps-tell-copy="en"]').click()
    await page.waitForTimeout(200)
    const copiedEn = (await clipboard(page)).written
    await dialog.locator('[data-ps-tell-copy="ar"]').click()
    await page.waitForTimeout(200)
    const copiedAr = (await clipboard(page)).written
    check(
      `${label}: each copy button copies its language verbatim`,
      copiedEn === SHAPE.tellTheStoreEn && copiedAr === SHAPE.tellTheStoreAr,
      JSON.stringify([copiedEn, copiedAr]),
    )
    check(
      `${label}: a fix that stood offers Close only — no Confirm, no retry, no failure`,
      (await page.locator('[data-ps-fix-confirm]').count()) === 0 &&
        (await page.locator('[data-ps-fix-close]').count()) === 1 &&
        (await dialog.locator('[data-ps-failure]').count()) === 0,
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-fix-done.png`, fullPage: true })
    await page.locator('[data-ps-fix-close]').click()
    await page.waitForTimeout(300)
    check(`${label}: Close leaves the HEALTHY panel`, (await page.locator('[data-ps-fix-dialog]').count()) === 0 && (await panel.locator('[data-ps-healthy]').count()) === 1)
    check(`${label}: no page errors (fix)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 19b: a fix opened from a serial's STUCK hold — the lookup that named the delivery stops naming it
  // once fixed, so it is read again only when the dialog closes, never under the open dialog.
  {
    const { context, page, errors, calls } = await open(dir, { grant: 'fix' })
    const resolves = () => calls.filter((c) => c === 'PickSupport/Resolve?key=SN12345').length
    await page.goto(`${BASE}/oms/pick-support?key=SN12345`)
    await page.locator('[data-ps-hold-open="8006777365"]').click({ timeout: 20000 })
    await page.locator('[data-ps-apply-fix="DONOR_AT_OLD_ORDER_STORE"]').click({ timeout: 20000 })
    const dialog = page.locator('[data-ps-fix-dialog]')
    await dialog.locator('[data-ps-fix-reason]').fill(FIX_REASON)
    await dialog.locator('[data-ps-fix-reference]').fill(FIX_REF)
    const before = resolves()
    await page.locator('[data-ps-fix-confirm]').click()
    await page.locator('[data-ps-fix-done]').waitFor({ timeout: 10000 })
    await page.waitForTimeout(800)
    check(
      `${label}: from a serial's hold, the dialog stays open with the store's text — the lookup is not re-read under it`,
      (await dialog.locator('[data-ps-tell-lang="en"] [data-ps-tell-text]').innerText()) === SHAPE.tellTheStoreEn && resolves() === before,
      `${before} → ${resolves()}`,
    )
    await page.locator('[data-ps-fix-close]').click()
    await page.waitForTimeout(800)
    check(
      `${label}: Close re-reads the lookup, which no longer holds the serial at the stuck delivery`,
      resolves() === before + 1 && (await page.locator('[data-ps-hold="STUCK"]').count()) === 0,
      `${before} → ${resolves()}`,
    )
    check(`${label}: no page errors (serial fix)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 20: diagnosis null → re-GET, still a success
  {
    const { context, page, errors, calls, dialog } = await openFixDialog(dir, 'null')
    const before = deliveryReads(calls)
    await page.locator('[data-ps-fix-confirm]').click()
    await page.locator('[data-ps-fix-done]').waitFor({ timeout: 10000 })
    await page.locator('[data-ps-panel="8006777365"][data-ps-verdict="healthy"]').waitFor({ timeout: 10000 })
    check(`${label}: diagnosis:null re-GETs the delivery and the panel turns HEALTHY`, deliveryReads(calls) === before + 1, `${before} → ${deliveryReads(calls)}`)
    check(
      `${label}: diagnosis:null is a success — the store's text, no failure, no retry`,
      (await dialog.locator('[data-ps-tell-lang="en"] [data-ps-tell-text]').innerText()) === SHAPE.tellTheStoreEn &&
        (await dialog.locator('[data-ps-failure]').count()) === 0 &&
        (await page.locator('[data-ps-fix-confirm]').count()) === 0,
    )
    check(`${label}: no page errors (null)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 21: PICK-00224, PICK-00225, a bare 403
  {
    const { context, page, errors, calls, dialog } = await openFixDialog(dir, '224')
    await page.locator('[data-ps-fix-confirm]').click()
    const err = dialog.locator('[data-ps-fix-error="PICK-00224"]')
    await err.waitFor({ timeout: 10000 })
    check(
      `${label}: PICK-00224 keeps the dialog open with its code beside the server's sentence, input kept`,
      (await err.locator('[data-ps-error-code="PICK-00224"]').innerText()) === 'PICK-00224' &&
        (await err.locator('[data-ps-error-message]').innerText()) === NOT_IN_SHAPE &&
        (await dialog.locator('[data-ps-fix-reason]').inputValue()) === FIX_REASON,
    )
    check(
      `${label}: PICK-00224 offers Refresh diagnosis, and no second press`,
      (await page.locator('[data-ps-fix-refresh]').count()) === 1 && (await page.locator('[data-ps-fix-confirm]').isDisabled()),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-fix-224.png`, fullPage: true })
    const before = deliveryReads(calls)
    await page.locator('[data-ps-fix-refresh]').click()
    await page.waitForTimeout(800)
    check(
      `${label}: Refresh diagnosis closes the dialog and reads the delivery again`,
      (await page.locator('[data-ps-fix-dialog]').count()) === 0 && deliveryReads(calls) === before + 1,
      `${before} → ${deliveryReads(calls)}`,
    )
    check(`${label}: no page errors (224)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, dialog } = await openFixDialog(dir, '225')
    await page.locator('[data-ps-fix-confirm]').click()
    const err = dialog.locator('[data-ps-fix-error="PICK-00225"]')
    await err.waitFor({ timeout: 10000 })
    check(
      `${label}: PICK-00225 shows its code and sentence, offers no refresh, and Confirm stays available`,
      (await err.locator('[data-ps-error-code="PICK-00225"]').count()) === 1 &&
        (await err.locator('[data-ps-error-message]').innerText()) === NO_REASON &&
        (await page.locator('[data-ps-fix-refresh]').count()) === 0 &&
        (await page.locator('[data-ps-fix-confirm]').isEnabled()),
    )
    check(`${label}: no page errors (225)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, dialog } = await openFixDialog(dir, '403')
    await page.locator('[data-ps-fix-confirm]').click()
    const err = dialog.locator('[data-ps-failure="denied"]')
    await err.waitFor({ timeout: 10000 })
    check(`${label}: a bare 403 reads "You do not have access to apply fixes"`, (await err.innerText()).trim() === 'You do not have access to apply fixes')
    check(`${label}: no page errors (403)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await drive('ltr')
await driveFix('ltr')
await drive('rtl')
await driveFix('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
