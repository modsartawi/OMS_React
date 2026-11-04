// Closes after a take drive (ticket 758, spec 3326; the scorecard's Drill door, BackOffice 3339).
//
// Drives the REAL app in Chromium against a STUB of the scorecard's doors, answering EXACTLY the shapes of
// `DispatchScorecardModels.cs`, camelCase:
//   GET DispatchScorecard/Access → { screenAllowed }                         (allowed, not allowed)
//   GET DispatchScorecard/Drill  → { asOf, from, to, figure, store, staff, rows[] }
//     figure=failedTakeRate  every take won in the range (closed or not)
//     figure=fallbackCancels the FallbackStoreClosed rows (callout-level, bidId '')
//     figure=refusedCloses   the takes a store then tried to close, refused by the lock
// and a `CALLOUT-301` refusal on the Drill when asked for store `REFUSE`.
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl") it asserts:
//   1. not allowed: the leaf is hidden and the page shows the denied card, no Drill call;
//   2. allowed: the leaf "Closes after a take" is in the OMS group right after the scorecard and is the
//      one the rail marks; the page reads failedTakeRate + fallbackCancels for the last 30 days, ESTATE-WIDE
//      (no `store`, no `staff` sent);
//   3. the default lists only the failed takes (StoreClosed, CourierBlamedStore); a take not closed is never
//      listed; the outcome chips count every kind, the fallback close once (from the fallback read);
//   4. every column the ticket names, with who caused it in words and Failed take yes/no;
//   5. the courier's Arabic reason shows exactly as sent, in a <bdi>; the reasons rank identical text
//      ("Order Not Found in branch" × 2, trailing space and all) and an empty one reads "No reason given";
//   6. "All outcomes" shows the others, each with its own who-caused-it words (an unknown outcome reads
//      "Unclear"), and lands in the URL; a single chip narrows; "Failed takes only" returns to the default;
//   7. the export writes the grid's columns as shown (items one cell) and a second sheet of reason counts;
//   8. the Refused closes tab reads refusedCloses, lists attempts, shows the 6-month note on a swept row,
//      and its own export;
//   9. the store filter narrows the reads to that store; the door's CALLOUT-301 reads as its sentence;
//  10. the delivery number is isolated left to right (also under RTL) and opens that delivery;
//  11. no "no stock" words anywhere; no page errors.
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/closes-after-take-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
const SHOTS = 'tools/.closes-after-take-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => {
  const d = new Date()
  return day(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}
const TODAY = daysAgo(0)
const FROM = daysAgo(29)

// ── Fixtures, the door's shapes exactly ────────────────────────────────────────────────────────
const AR_REASON = 'الطلب غير موجود في الفرع'
const AR_ATTEMPT = 'العميل ألغى الطلب'
const ITEMS = [
  { itemNumber: '100234', quantity: 2, uom: 'EA' },
  { itemNumber: '100235', quantity: 1, uom: 'PAC' },
]
const row = (i, over = {}) => ({
  calloutId: `C${i}`,
  bidId: `B${i}`,
  subjectType: 'DELIVERY',
  subjectId: `80067773${pad(i)}`,
  party: 'P001',
  class: 'Won',
  ignoreReason: '',
  offeredAt: `${TODAY}T08:${pad(i)}:00`,
  deliveredAt: `${TODAY}T08:${pad(i)}:05`,
  answeredAt: `${TODAY}T08:${pad(i)}:40`,
  answerSeconds: 35,
  answeredBy: 'P001-ph01',
  answeredRegister: '01',
  awardedAt: `${TODAY}T08:${pad(i)}:45`,
  nearMiss: false,
  distanceKm: 2.4,
  onlineTills: 2,
  signedInTills: 1,
  atp: 'covers',
  releaseReason: '',
  counted: false,
  closedBy: '',
  closedAt: null,
  afterTakeOutcome: '',
  afterTakeReason: '',
  afterTakeCourier: '',
  items: [],
  atpShortLineCount: 0,
  atpShortLines: [],
  refusedAttempts: [],
  ...over,
})
const courier = (i, outcome, reason, over = {}) =>
  row(i, { closedBy: 'Outbox', closedAt: `${TODAY}T09:${pad(i)}:00`, afterTakeOutcome: outcome, afterTakeReason: reason, afterTakeCourier: 'alshrouqexpress', ...over })
const TAKEN = [
  row(1, { counted: true, closedBy: 'P001-ph02', closedAt: `${TODAY}T09:01:00`, afterTakeOutcome: 'StoreClosed', afterTakeReason: 'Customer unreachable', items: ITEMS.slice(0, 1) }),
  courier(2, 'CourierBlamedStore', AR_REASON, { counted: true, items: ITEMS, atp: 'unknown' }),
  courier(3, 'CourierBlamedStore', 'Order Not Found in branch', { counted: true, items: ITEMS }),
  courier(4, 'CourierBlamedStore', 'Order Not Found in branch ', { counted: true, party: 'P002', answeredBy: 'P002-ph01', items: ITEMS }),
  row(5), // taken, never closed: never listed
  courier(6, 'CourierNoReason', ''),
  row(7, { closedBy: 'hq-admin', closedAt: `${TODAY}T09:07:00`, afterTakeOutcome: 'OtherClose' }),
  // The won bid of a callout the fallback store then closed: listed once, from the fallback read.
  row(8, { afterTakeOutcome: 'FallbackStoreClosed', closedBy: 'P003-ph01', closedAt: `${TODAY}T09:08:00`, afterTakeReason: 'Customer asked to cancel' }),
  courier(9, 'CourierOtherReason', 'Customer cancelled'),
  courier(10, 'CourierLostParcel', 'Parcel lost'),
]
const FALLBACK = [
  row(8, {
    bidId: '',
    party: 'P003',
    class: 'FallbackCancel',
    answeredAt: null,
    answerSeconds: null,
    answeredBy: '',
    answeredRegister: '',
    counted: true,
    closedBy: 'P003-ph01',
    closedAt: `${TODAY}T09:08:00`,
    afterTakeOutcome: 'FallbackStoreClosed',
    afterTakeReason: 'Customer asked to cancel',
    items: ITEMS,
  }),
]
const REFUSED = [
  row(11, {
    counted: true,
    refusedAttempts: [
      { at: `${TODAY}T08:20:00`, closedBy: 'P001-ph01', register: '02', reason: AR_ATTEMPT },
      { at: `${TODAY}T08:22:00`, closedBy: 'P001-ph01', register: '02', reason: '' },
    ],
  }),
  row(12, { counted: true }), // past the 6-month sweep: still counted, its attempts gone
]
const ROWS = { failedTakeRate: TAKEN, fallbackCancels: FALLBACK, refusedCloses: REFUSED }
const drill = (q) => ({
  asOf: `${TODAY}T09:41:00`,
  from: `${FROM}T00:00:00`,
  to: `${TODAY}T00:00:00`,
  figure: q.get('figure'),
  store: q.get('store') ?? '',
  staff: q.get('staff') ?? '',
  rows: (ROWS[q.get('figure')] ?? []).filter((r) => !q.get('store') || r.party === q.get('store')),
})

// ── xlsx reading (the writer's own output) ─────────────────────────────────────────────────────
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
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
/** One sheet's rows, each a list of cell texts (shared strings resolved, inline strings read). */
function sheetRows(files, n) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unescape(m[1].replace(/<[^>]+>/g, '')))
  const xml = files[`xl/worksheets/sheet${n}.xml`] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
    [...r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(([, attrs, body = '']) => {
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? body.replace(/<[^>]+>/g, '')
      return /t="s"/.test(attrs) ? shared[Number(v)] : unescape(v)
    }),
  )
}

// ── The harness ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch()

async function open(dir, { access = 'allowed' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const queries = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    ;(queries[p] ??= []).push(url.searchParams)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    if (p === 'DispatchScorecard/Access') return route.fulfill(envelope({ screenAllowed: access === 'allowed' }))
    if (p === 'DispatchScorecard/Drill') {
      if (url.searchParams.get('store') === 'REFUSE')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The range is at most 92 days.',
            errors: [{ errorCode: 'CALLOUT-301', internalErrorCode: '', errorMessage: 'The range is at most 92 days.' }],
          }),
        )
      return route.fulfill(envelope(drill(url.searchParams)))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, queries }
}

const omsLinks = (page) => page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

/** A grid's rows in their shown order (by row-index), each cell's text by column; pinned halves merged. */
const gridRows = (page, scope) =>
  page.evaluate((scope) => {
    const byIndex = new Map()
    for (const row of document.querySelectorAll(`${scope} .ag-row[row-index]`)) {
      const i = Number(row.getAttribute('row-index'))
      const cells = Object.fromEntries([...row.querySelectorAll('.ag-cell')].map((c) => [c.getAttribute('col-id'), c.textContent.trim()]))
      byIndex.set(i, { ...byIndex.get(i), ...cells })
    }
    return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, r]) => r)
  }, scope)

/** Whether a text reads left to right on screen: its first character's box starts left of its last's. */
const readsLtr = (locator) =>
  locator.evaluate((el) => {
    const text = el.textContent.trim()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const i = node.textContent.indexOf(text)
      if (i < 0) continue
      const box = (k) => {
        const r = document.createRange()
        r.setStart(node, k)
        r.setEnd(node, k + 1)
        return r.getBoundingClientRect()
      }
      return box(i).left < box(i + text.length - 1).left
    }
    return null
  })

const params = (q) => (q ? Object.fromEntries([...q.entries()]) : null)
const drillCalls = (queries, figure) => (queries['DispatchScorecard/Drill'] ?? []).filter((q) => q.get('figure') === figure)
const settle = (page, ms = 350) => page.waitForTimeout(ms)
const NO_STOCK = /no stock|out of stock|not in stock|لا يوجد مخزون|نفد|نفاد/i

const CAUSE = {
  StoreClosed: 'The store: it closed the delivery itself',
  CourierBlamedStore: 'The store, according to the courier',
  FallbackStoreClosed: 'The fallback store',
  CourierOtherReason: 'The courier side: the reason does not name the store',
  CourierNoReason: 'Unclear: the courier gave no reason',
  OtherClose: 'Someone else (HQ, customer channel or system): see Closed by',
}
const COLUMNS = ['subjectId', 'party', 'offeredAt', 'answerSeconds', 'answeredBy', 'closedBy', 'closedAt', 'cause', 'afterTake', 'failedTake', 'reason', 'courier', 'items', 'atp']
const HEADERS = ['Delivery', 'Store', 'Offered', 'Answer time', 'Taken by', 'Closed by', 'Closed at', 'Who caused it', 'What happened', 'Failed take', 'Reason (as given)', 'Courier', 'Items', 'Stock at offer']
const PAGE = '/oms/dispatch-scorecard/closes'
const GRID = '[data-sc-grid="closes"]'

async function drive(dir) {
  const label = dir.toUpperCase()

  // 1. Not allowed.
  {
    const { context, page, queries } = await open(dir, { access: 'denied' })
    await page.goto(`${BASE}${PAGE}`)
    await settle(page, 1200)
    check(`${label}: not allowed — the leaf is hidden`, !(await omsLinks(page)).includes(PAGE))
    check(`${label}: not allowed — no Drill call`, !(queries['DispatchScorecard/Drill'] ?? []).length)
    await context.close()
  }

  const { context, page, errors, queries } = await open(dir)
  await page.goto(`${BASE}${PAGE}`)
  await page.locator(`${GRID} .ag-row`).first().waitFor({ timeout: 15000 })
  await settle(page, 500)

  // 2. The leaf and the estate-wide reads.
  const links = await omsLinks(page)
  check(`${label}: the leaf sits right after the scorecard`, links.indexOf(PAGE) === links.indexOf('/oms/dispatch-scorecard') + 1, links.join(' '))
  const marked = await page.locator('nav a[aria-current="page"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check(`${label}: the rail marks the closes leaf, not the scorecard`, marked.includes(PAGE) && !marked.includes('/oms/dispatch-scorecard'), marked.join(' '))
  const ft = params(drillCalls(queries, 'failedTakeRate').at(-1))
  const fc = params(drillCalls(queries, 'fallbackCancels').at(-1))
  check(
    `${label}: reads failedTakeRate + fallbackCancels for the last 30 days, estate-wide (no store, no staff)`,
    ft && fc && ft.from === FROM && ft.to === TODAY && !('store' in ft) && !('staff' in ft) && !('store' in fc) && !('staff' in fc),
    JSON.stringify([ft, fc]),
  )
  check(`${label}: the refused tab is not read until opened`, drillCalls(queries, 'refusedCloses').length === 0)

  // 3. The default: failed takes only.
  let rows = await gridRows(page, GRID)
  check(
    `${label}: the default lists only the failed takes (taken-not-closed never listed)`,
    rows.length === 4 && rows.every((r) => ['Closed by the store', 'Courier cancelled, naming the store'].includes(r.afterTake)) && !rows.some((r) => r.subjectId === '8006777305'),
    JSON.stringify(rows.map((r) => [r.subjectId, r.afterTake])),
  )
  const chips = Object.fromEntries(
    await page.locator('[data-sc-outcome]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-sc-outcome'), [e.textContent.trim(), e.getAttribute('aria-pressed')]])),
  )
  check(
    `${label}: the outcome chips count every kind (fallback close once), the two failed kinds pressed`,
    chips.StoreClosed?.[0].endsWith('1') &&
      chips.CourierBlamedStore?.[0].endsWith('3') &&
      chips.FallbackStoreClosed?.[0].endsWith('1') &&
      chips.CourierNoReason?.[0].endsWith('1') &&
      chips.OtherClose?.[0].endsWith('1') &&
      chips.CourierOtherReason?.[0].endsWith('1') &&
      chips.CourierLostParcel?.[0].endsWith('1') &&
      chips.StoreClosed[1] === 'true' &&
      chips.CourierBlamedStore[1] === 'true' &&
      chips.OtherClose[1] === 'false',
    JSON.stringify(chips),
  )
  check(`${label}: the count line reads the rows listed`, (await page.locator('[data-sc-count]').getAttribute('data-sc-count')) === '4')

  // 4. The columns.
  const headers = await page.locator(`${GRID} .ag-header-cell[col-id]`).evaluateAll((els) => els.map((h) => [h.getAttribute('col-id'), h.textContent.trim()]))
  const headerMap = Object.fromEntries(headers)
  check(
    `${label}: every column the ticket names, in its order (Delivery pinned at the start)`,
    // The pinned Delivery header lives in its own container, which AG Grid places after the body under RTL.
    JSON.stringify(headers.map(([c]) => c).filter((c) => c !== 'subjectId')) === JSON.stringify(COLUMNS.slice(1)) &&
      COLUMNS.every((c, i) => headerMap[c] === HEADERS[i]) &&
      (await page.locator(`${GRID} .ag-header-cell[col-id="subjectId"]`).evaluate((el) => !!el.closest('[class*="pinned"]'))),
    JSON.stringify(headers),
  )
  const byId = (id) => rows.find((r) => r.subjectId === id)
  const r1 = byId('8006777301')
  const r2 = byId('8006777302')
  check(
    `${label}: a store close — who caused it, failed take Yes, taker, closer, items as one value each`,
    r1?.cause === CAUSE.StoreClosed && r1.failedTake === 'Yes' && r1.answeredBy === 'P001-ph01' && r1.closedBy === 'P001-ph02' && r1.items === '100234 · 2 EA' && r1.closedAt === `${TODAY} 09:01`,
    JSON.stringify(r1),
  )
  check(
    `${label}: a courier blaming the store — "according to the courier", the courier as sent, stock Unknown`,
    r2?.cause === CAUSE.CourierBlamedStore && r2.failedTake === 'Yes' && r2.closedBy === 'Outbox' && r2.courier === 'alshrouqexpress' && r2.atp === 'Unknown',
    JSON.stringify(r2),
  )

  // 5. The reason as given, and the reasons ranked.
  const arCell = page.locator(`${GRID} .ag-row [data-sc-reason="text"]`).filter({ hasText: AR_REASON })
  check(
    `${label}: the courier's Arabic reason shows exactly as sent, in a <bdi>`,
    (await arCell.count()) === 1 && (await arCell.evaluate((el) => el.tagName)) === 'BDI' && (await arCell.textContent()) === AR_REASON,
  )
  const reasons = await page.locator('[data-sc-reason-count]').evaluateAll((els) =>
    els.map((e) => [e.querySelector('[data-sc-reason-text]').textContent, e.getAttribute('data-sc-reason-count')]),
  )
  check(
    `${label}: the reasons rank identical text, most first ("Order Not Found in branch" × 2)`,
    JSON.stringify(reasons) ===
      JSON.stringify([
        ['Order Not Found in branch', '2'],
        ['Customer unreachable', '1'],
        [AR_REASON, '1'],
      ]),
    JSON.stringify(reasons),
  )

  // 6. All outcomes, one chip, back to the default.
  await page.locator('[data-sc-outcomes-all]').click()
  await page.waitForFunction(() => new URL(location.href).searchParams.has('outcome'), null, { timeout: 5000 }).catch(() => {})
  await settle(page)
  rows = await gridRows(page, GRID)
  const r = Object.fromEntries(rows.map((x) => [x.subjectId, x]))
  check(
    `${label}: "All outcomes" lists the other closes too (9 rows), and lands in the URL`,
    rows.length === 9 && new URL(page.url()).searchParams.get('outcome')?.split(',').length === 7,
    `${rows.length} · ${page.url()}`,
  )
  check(
    `${label}: each other outcome says who caused it, Failed take No; an unknown outcome reads "Unclear", its code as sent`,
    r['8006777306']?.cause === CAUSE.CourierNoReason &&
      r['8006777306'].reason === 'No reason given' &&
      r['8006777307']?.cause === CAUSE.OtherClose &&
      r['8006777307'].closedBy === 'hq-admin' &&
      r['8006777309']?.cause === CAUSE.CourierOtherReason &&
      r['8006777310']?.cause === 'Unclear' &&
      r['8006777310'].afterTake === 'CourierLostParcel' &&
      ['8006777306', '8006777307', '8006777309', '8006777310'].every((k) => r[k].failedTake === 'No'),
    JSON.stringify(['06', '07', '09', '10'].map((k) => r[`80067773${k}`])),
  )
  check(
    `${label}: the fallback close is listed once, against the fallback store (P003), nobody "took" it`,
    rows.filter((x) => x.subjectId === '8006777308').length === 1 &&
      r['8006777308'].party === 'P003' &&
      r['8006777308'].cause === CAUSE.FallbackStoreClosed &&
      r['8006777308'].answeredBy === '—' &&
      r['8006777308'].failedTake === 'No',
    JSON.stringify(r['8006777308']),
  )
  await page.locator('[data-sc-outcomes-failed]').click()
  await settle(page)
  await page.locator('[data-sc-outcome="StoreClosed"]').click()
  await settle(page)
  rows = await gridRows(page, GRID)
  check(
    `${label}: unpicking a chip narrows (store closes gone, the courier's three stay)`,
    rows.length === 3 && rows.every((x) => x.afterTake === 'Courier cancelled, naming the store') && new URL(page.url()).searchParams.get('outcome') === 'CourierBlamedStore',
    `${rows.length} · ${page.url()}`,
  )
  await page.locator('[data-sc-outcomes-failed]').click()
  await settle(page)
  check(`${label}: "Failed takes only" returns to the default (nothing in the URL)`, !new URL(page.url()).searchParams.has('outcome') && (await gridRows(page, GRID)).length === 4)

  // 7. The export.
  {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('[data-sc-export]').click()])
    check(`${label}: the export names its workbook`, /^closes-after-take-\d{8}-\d{4}\.xlsx$/.test(dl.suggestedFilename()), dl.suggestedFilename())
    const files = unzipText(readFileSync(await dl.path()))
    const s1 = sheetRows(files, 1)
    const s2 = sheetRows(files, 2)
    const head = s1[0] ?? []
    const at = (name) => head.indexOf(name)
    const arRow = s1.find((x) => x.includes(AR_REASON))
    check(`${label}: sheet 1 carries the grid's columns as shown`, JSON.stringify(head) === JSON.stringify(HEADERS), JSON.stringify(head))
    check(
      `${label}: sheet 1 rows as shown — items one cell, who caused it in words, the reason as sent, no isolates`,
      s1.length === 5 &&
        arRow?.[at('Items')] === '100234 · 2 EA; 100235 · 1 PAC' &&
        arRow?.[at('Who caused it')] === CAUSE.CourierBlamedStore &&
        arRow?.[at('Delivery')] === '8006777302' &&
        !/[\u2066-\u2069]/.test(JSON.stringify(s1)),
      JSON.stringify(arRow),
    )
    check(
      `${label}: sheet 2 is the reason counts`,
      JSON.stringify(s2) ===
        JSON.stringify([
          ['Reason (as given)', 'Closes'],
          ['Order Not Found in branch', '2'],
          ['Customer unreachable', '1'],
          [AR_REASON, '1'],
        ]),
      JSON.stringify(s2),
    )
  }

  // 10 (on this page). The delivery number is isolated LTR.
  const link = page.locator(`${GRID} [data-sc-delivery="8006777302"] bdi`)
  check(`${label}: the delivery number reads left to right`, (await readsLtr(link)) === true)
  await page.screenshot({ path: `${SHOTS}/closes-${dir}.png` })

  // 11 (this tab).
  check(`${label}: no "no stock" words on the closes tab`, !NO_STOCK.test(await page.locator('main').innerText()))

  // 8. Refused closes.
  await page.locator('[data-sc-tab="refused"]').click()
  await page.locator('[data-sc-grid="refused"] .ag-row').first().waitFor({ timeout: 10000 })
  await settle(page, 500)
  const rf = params(drillCalls(queries, 'refusedCloses').at(-1))
  check(`${label}: the Refused tab reads refusedCloses, estate-wide`, rf && !('store' in rf) && !('staff' in rf) && new URL(page.url()).searchParams.get('tab') === 'refused', JSON.stringify(rf))
  const refusedRows = await gridRows(page, '[data-sc-grid="refused"]')
  const attempts = page.locator('[data-sc-grid="refused"] [data-sc-attempt]')
  check(
    `${label}: a refused close lists its attempts, each one line isolated whole; who caused it says the lock refused it`,
    refusedRows.length === 2 &&
      (await attempts.count()) === 2 &&
      (await attempts.first().innerText()).includes(AR_ATTEMPT) &&
      refusedRows.every((x) => x.cause === 'The store tried to back out; the lock refused it'),
    JSON.stringify(refusedRows.map((x) => [x.subjectId, x.cause, x.refusedAttempts])),
  )
  check(`${label}: a swept row shows the 6-month note`, (await page.locator('[data-sc-grid="refused"] [data-sc-attempts-swept]').count()) === 1)
  check(`${label}: the tab says these were not cancelled`, (await page.locator('[data-sc-refused-note]').innerText()).includes('not cancelled'))
  {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('[data-sc-export]').click()])
    const s1 = sheetRows(unzipText(readFileSync(await dl.path())), 1)
    check(
      `${label}: the Refused export carries its columns, attempts one cell`,
      /^refused-closes-\d{8}-\d{4}\.xlsx$/.test(dl.suggestedFilename()) && s1[0]?.includes('Refused close attempts') && s1.length === 3 && s1.some((x) => x.some((c) => c.includes(AR_ATTEMPT) && c.includes(';'))),
      JSON.stringify(s1),
    )
  }
  await page.screenshot({ path: `${SHOTS}/refused-${dir}.png` })
  await page.locator('[data-sc-tab="closes"]').click()
  await page.locator(`${GRID} .ag-row`).first().waitFor({ timeout: 10000 })

  // 9. The store filter, and the door's refusal.
  const store = page.locator('[data-sc-filter="store"]')
  await store.fill('P002')
  await store.press('Enter')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('store') === 'P002', null, { timeout: 5000 }).catch(() => {})
  await settle(page, 600)
  check(
    `${label}: the store filter narrows both reads to that store`,
    params(drillCalls(queries, 'failedTakeRate').at(-1))?.store === 'P002' && params(drillCalls(queries, 'fallbackCancels').at(-1))?.store === 'P002' && (await gridRows(page, GRID)).length === 1,
  )
  await store.fill('REFUSE')
  await store.press('Enter')
  await page.locator('[data-sc-refusal]').waitFor({ timeout: 5000 }).catch(() => {})
  check(
    `${label}: the door's CALLOUT-301 reads as its own sentence`,
    (await page.locator('[data-sc-refusal]').getAttribute('data-sc-refusal').catch(() => null)) === 'refusal.rangeTooLong' &&
      (await page.locator('[data-sc-refusal]').innerText()).includes('longer than 92 days'),
  )
  await page.locator('[data-sc-reset]').click()
  await page.locator(`${GRID} .ag-row`).first().waitFor({ timeout: 10000 })
  await settle(page)

  // 10. The delivery number opens that delivery.
  await page.locator(`${GRID} [data-sc-delivery="8006777302"]`).click()
  await page.waitForURL(/\/oms\/delivery\/8006777302$/, { timeout: 5000 }).catch(() => {})
  check(`${label}: the delivery number opens that delivery`, /\/oms\/delivery\/8006777302$/.test(page.url()), page.url())

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
