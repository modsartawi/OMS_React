// Deliverect orders monitor drive (ticket 478, BackOffice spec 2615).
//
// Drives the REAL app in Chromium against STUBS of the Deliverect door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md § Orders monitor) —
// BackOffice 2626 is not built, so there is no live SIS.Api to point at. Every fixture emits EXACTLY
// the contract's fields, on the REAL envelope { statusCode, success, message,
// errors: [{ errorCode, internalErrorCode, errorMessage }], data }, and every refusal's errorMessage is
// "<English> / <Arabic>":
//   GET  DeliverectWeb/Access                         → { canManageStores, canManageCatalog, canViewOrders, canManageTerms }
//   GET  DeliverectWeb/Orders?from=&to=&platform=&store=&outcome=&q=&skip=&take=
//                                                     → { total, rows: [{ deliverectOrderId, platformKey, channelOrderId,
//                                                         channelDisplayId, storeCode, accountKey, receivedAt, documentNumber,
//                                                         outcome, reason, droppedLines, lastStatusSent, lastStatusAt,
//                                                         lastStatusOk, total, currencyKey }] }
//   GET  DeliverectWeb/Orders/{id}                    → the row + lines[] { plu, name, quantity, unitPrice, fundedDiscount,
//                                                         materialNumber, dropped, droppedReason } + statuses[] { status,
//                                                         sentAt, ok, answer, attempts }; DLV-00006
//   GET  DeliverectWeb/Orders/{id}/Raw                → { rawBody, receivedAt } — 🚩 the contract names no data fields;
//                                                         HITL-478 rules this shape (core/models/deliverect.ts)
//   POST DeliverectWeb/Orders/{id}/Retry              → no body named; DLV-00006, DLV-00007
//   GET  DeliverectWeb/Platforms                      → 200 [{ platformKey, displayName, channelId, creditCustomer, active }]
//                                                         OR 403 (the contract puts it behind canManageTerms)
//
// With the browser in Asia/Riyadh and its clock fixed at 2026-10-12 11:00 local, it asserts:
//   1. the Orders leaf joins the Deliverect group on canViewOrders, after Stores; without canViewOrders
//      it is hidden and the URL shows the denied card with no Orders call; one probe call;
//   2. a bare /deliverect/orders writes from=to=today into the URL and sends both; "today" is the
//      LOCAL date (at 00:30 on the 13th it is the 13th — never toISOString's 12th);
//   3. each of the five outcomes renders in words; the last status reads "20 · Accepted" etc.; the
//      call's OK / Failed; the total has 3 decimals beside its currency; our document is a link; the
//      126 row is painted on the danger ground and says it needs a person; an unknown status code
//      shows raw;
//   4. outcome and platform are repeated keys in the URL AND on the door; store and text land on
//      Search; a pasted URL drives the door; a window over 31 days (inclusive) is refused on screen
//      with NO call, 31 days are sent; a reversed window is refused; Clear resets to today;
//   5. Platforms readable → its keys are offered; refused (403) → the rows' keys are offered;
//   6. the drawer reads Orders/{id}: the lines (a dropped one badged, with its reason), the statuses
//      in words with Deliverect's answer and the attempts, the document link; a 126 order leads with
//      the alert; a refused read shows its code; Escape closes it;
//   7. Raw opens over the drawer: received at, the body re-indented (values untouched), "As received"
//      shows it verbatim, a non-JSON body is shown as received;
//   8. Retry is offered on refused and statusFailed rows ONLY (grid and drawer); it confirms, POSTs
//      to Orders/{id}/Retry, and re-reads the list; DLV-00007 and DLV-00006 show inline with the
//      server's words, the dialog staying open;
//   9. Export writes deliverect-orders-*.xlsx: the shown columns minus actions, the total numeric;
//  10. paging: total > rows offers Next, which sends skip=200;
//  11. under RTL (direction only — `lng` stays `en` app-wide) machine values are isolated, the raw
//      body is one LTR island, and a retry works.
//
//   1. run the app:  npx vite --port 5196 --strictPort
//   2. DRIVE_PORT=5196 node tools/deliverect-orders-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.deliverect-orders-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/materials-search-drive.mjs).
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const REFUSALS = {
  'DLV-00006': [404, 'No such Deliverect order. / لا يوجد طلب Deliverect بهذا الرقم.'],
  'DLV-00007': [409, 'The order or its status call is not in a failed state. / الطلب أو استدعاء حالته ليس في حالة فشل.'],
}
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

/** An order row exactly as the contract has it. */
const order = (id, over = {}) => ({
  deliverectOrderId: id,
  platformKey: 'JAHEZ',
  channelOrderId: `J-${id}`,
  channelDisplayId: `D${id.slice(-3)}`,
  storeCode: '1234',
  accountKey: 'OlaCare',
  receivedAt: '2026-10-12T09:15:00',
  documentNumber: `45000${id.slice(-3)}`,
  outcome: 'created',
  reason: null,
  droppedLines: 0,
  lastStatusSent: 20,
  lastStatusAt: '2026-10-12T09:15:04',
  lastStatusOk: true,
  total: 123.45,
  currencyKey: 'SAR',
  ...over,
})

const ORDERS = [
  order('64fA001'),
  order('64fA002', { platformKey: 'KEETA', outcome: 'refused', reason: 'Store not linked', documentNumber: null, lastStatusSent: 120, total: 58.1 }),
  order('64fA003', { outcome: 'droppedLines', reason: 'Unknown PLU 999', droppedLines: 1, total: 41.25 }),
  order('64fA004', { platformKey: 'KEETA', outcome: 'cancelled', lastStatusSent: 110, storeCode: '0099' }),
  order('64fA005', { outcome: 'statusFailed', lastStatusSent: 90, lastStatusOk: false, reason: 'Deliverect timeout' }),
  order('64fA006', { platformKey: 'HSD', outcome: 'created', lastStatusSent: 126, lastStatusOk: true, reason: 'Cancel after invoicing' }),
  // NOT a contract code: proves an unnamed status shows raw, neutral.
  order('64fA007', { lastStatusSent: 100 }),
]

const line = (plu, over = {}) => ({
  plu,
  name: 'Panadol 500mg 24 tabs',
  quantity: 2,
  unitPrice: 12.5,
  fundedDiscount: 1.25,
  materialNumber: '101234',
  dropped: false,
  droppedReason: null,
  ...over,
})
const DETAIL_EXTRA = {
  '64fA003': {
    lines: [line('P-100'), line('P-999', { name: 'بنادول أطفال', materialNumber: null, dropped: true, droppedReason: 'Unknown PLU' })],
    statuses: [{ status: 20, sentAt: '2026-10-12T09:15:04', ok: true, answer: 'OK', attempts: 1 }],
  },
  '64fA005': {
    lines: [line('P-100')],
    statuses: [
      { status: 20, sentAt: '2026-10-12T09:15:04', ok: true, answer: 'OK', attempts: 1 },
      { status: 90, sentAt: '2026-10-12T10:02:00', ok: false, answer: 'Gateway timeout', attempts: 3 },
    ],
  },
  '64fA006': {
    lines: [line('P-100')],
    statuses: [
      { status: 20, sentAt: '2026-10-12T09:15:04', ok: true, answer: 'OK', attempts: 1 },
      { status: 90, sentAt: '2026-10-12T09:40:00', ok: true, answer: 'OK', attempts: 1 },
      { status: 126, sentAt: '2026-10-12T09:55:00', ok: true, answer: 'OK', attempts: 1 },
    ],
  },
  '64fA002': { lines: [line('P-100')], statuses: [{ status: 120, sentAt: '2026-10-12T09:15:02', ok: true, answer: 'OK', attempts: 1 }] },
}
const detailOf = (row) => ({ ...row, ...(DETAIL_EXTRA[row.deliverectOrderId] ?? { lines: [line('P-100')], statuses: [] }) })

// The body as Deliverect sent it: compact, with values a parse-and-stringify would rewrite.
const RAW_BODY = '{"_id":"64fA003","channelOrderDisplayId":"D003","payment":{"amount":4125,"decimalDigits":2},"rate":1.10,"items":[{"plu":"P-999","name":"\\u0628\\u0646\\u0627\\u062f\\u0648\\u0644"}],"note":""}'
const RAW = {
  '64fA003': { rawBody: RAW_BODY, receivedAt: '2026-10-12T09:15:00' },
  '64fA001': { rawBody: 'not json — signature mismatch dump', receivedAt: '2026-10-12T09:15:00' },
}

const PLATFORMS = [
  { platformKey: 'JAHEZ', displayName: 'Jahez', channelId: 0, creditCustomer: '0001100001', active: true },
  { platformKey: 'KEETA', displayName: 'Keeta', channelId: 7, creditCustomer: '0001100002', active: true },
  { platformKey: 'MRSOOL', displayName: 'Mrsool', channelId: 9, creditCustomer: null, active: false },
]

function ordersAnswer(qs, list) {
  const platforms = qs.getAll('platform')
  const outcomes = qs.getAll('outcome')
  const store = qs.get('store')
  const q = (qs.get('q') ?? '').toLowerCase()
  const rows = list.filter(
    (o) =>
      (!platforms.length || platforms.includes(o.platformKey)) &&
      (!outcomes.length || outcomes.includes(o.outcome)) &&
      (!store || o.storeCode === store) &&
      (!q || [o.channelOrderId, o.channelDisplayId, o.documentNumber, o.deliverectOrderId].some((v) => v?.toLowerCase().includes(q))),
  )
  return { total: rows.length, rows }
}

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManageTerms: true }
const ELEVEN = new Date('2026-10-12T11:00:00+03:00')

const browser = await chromium.launch()

async function open(dir, { access = ALL, platforms = 'ok', orders = ORDERS, total = null, at = ELEVEN } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
  const page = await context.newPage()
  await page.clock.setFixedTime(at)
  const errors = []
  const calls = []
  const lists = []
  const retries = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DeliverectWeb/Access') return route.fulfill(envelope(access))
    if (p === 'DeliverectWeb/Platforms') {
      if (platforms === 'ok') return route.fulfill(envelope(PLATFORMS))
      return route.fulfill(envelope(null, { status: 403, success: false, message: 'Access denied. / تم رفض الوصول.', errorCode: 'Forbidden' }))
    }
    if (p === 'DeliverectWeb/Orders' && req.method() === 'GET') {
      lists.push(url.search.slice(1))
      const answer = ordersAnswer(url.searchParams, orders)
      return route.fulfill(envelope(total === null ? answer : { ...answer, total }))
    }
    const m = /^DeliverectWeb\/Orders\/([^/]+)(\/Raw|\/Retry)?$/.exec(p)
    if (m) {
      const id = decodeURIComponent(m[1])
      const row = orders.find((o) => o.deliverectOrderId === id)
      if (m[2] === '/Retry' && req.method() === 'POST') {
        retries.push({ id, body: req.postData() })
        if (id === '64fA005' && retries.filter((r) => r.id === id).length > 1) return route.fulfill(refuse('DLV-00007'))
        if (id === '64fA002' && dir === 'rtl') return route.fulfill(envelope(null))
        if (id === '64fA002') return route.fulfill(refuse('DLV-00006'))
        return route.fulfill(envelope(null))
      }
      if (m[2] === '/Raw') return RAW[id] ? route.fulfill(envelope(RAW[id])) : route.fulfill(refuse('DLV-00006'))
      if (id === '64fA004') return route.fulfill(refuse('DLV-00006'))
      return row ? route.fulfill(envelope(detailOf(row))) : route.fulfill(refuse('DLV-00006'))
    }
    if (p === 'MaterialWeb/Access') return route.fulfill(envelope({ canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }))
    if (p === 'DeliverectWeb/Stores') return route.fulfill(envelope([]))
    if (p === 'DeliverectWeb/Accounts') return route.fulfill(envelope([]))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, lists, retries }
}

/** Wait until the grid holds `n` rows (a row is drawn once per pinned/centre section) and has settled. */
const waitRows = async (page, n) => {
  await page.waitForFunction(
    (count) =>
      new Set([...document.querySelectorAll('[data-orders-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size ===
        count && !document.querySelector('[data-orders-grid] .ag-overlay-loading-center'),
    n,
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}

// A row id repeats across AG Grid's pinned containers; a CELL is in exactly one.
const cellLoc = (page, id, colId) => page.locator(`[data-orders-grid] .ag-row[row-id="${id}"] [col-id="${colId}"]`)
const cell = async (page, id, colId) => ((await cellLoc(page, id, colId).count()) ? (await cellLoc(page, id, colId).innerText()).trim() : null)
const painted = (page, id) =>
  page.evaluate(
    (rid) =>
      [...document.querySelectorAll(`[data-orders-grid] .ag-row[row-id="${rid}"]`)]
        .map((r) => getComputedStyle(r, '::after').backgroundColor)
        .join(' '),
    id,
  )
const urlSearch = (page) => new URL(page.url()).search.slice(1)
const lastList = (lists) => new URLSearchParams(lists.at(-1))

/** The entries of a zip, name → text (copied from tools/central-invoice-list-drive.mjs). */
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

/** Sheet 1's rows, each cell as text ("n:" before a numeric cell), shared strings resolved. */
function sheetRows(files) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
  const xml = files['xl/worksheets/sheet1.xml'] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) =>
    [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map(([, attrs, body]) => {
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? body.replace(/<[^>]+>/g, '')
      if (/t="s"/.test(attrs)) return shared[Number(v)]
      return (/t="n"|^(?![\s\S]*t=)/.test(attrs) && v !== '' ? 'n:' : '') + v
    }),
  )
}

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/orders"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/deliverect"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: the Orders leaf joins the group after Stores', JSON.stringify(hrefs) === JSON.stringify(['/deliverect/stores', '/deliverect/orders']), hrefs.join())
  check('1: the leaf reads "Orders"', (await page.locator('nav a[href="/deliverect/orders"]').first().innerText()).trim() === 'Orders')
  await page.locator('nav a[href="/deliverect/orders"]').first().click()
  await waitRows(page, ORDERS.length)
  check('1: the group, its leaves and the page gate cost ONE probe call', calls.filter((c) => c === 'DeliverectWeb/Access').length === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canViewOrders: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/stores"]').first().waitFor({ timeout: 5000 })
  check('1: 🚩 without canViewOrders the Orders leaf is hidden (Stores stays)', (await page.locator('nav a[href="/deliverect/orders"]').count()) === 0)
  await page.goto(`${BASE}/deliverect/orders`)
  await page.getByText('No access to Deliverect orders').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card and asks no Orders call', !calls.includes('DeliverectWeb/Orders'))
  check('1 (denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page } = await open('ltr', { access: { ...ALL, canManageStores: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/orders"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/deliverect"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: a session holding only canViewOrders gets a one-leaf group', JSON.stringify(hrefs) === JSON.stringify(['/deliverect/orders']), hrefs.join())
  await context.close()
}

// ── 2–5: the default window, the rows, the filters ──────────────────────────────────────────
{
  const { context, page, errors, calls, lists } = await open('ltr')
  await page.goto(`${BASE}/deliverect/orders`)
  await waitRows(page, ORDERS.length)

  // 2
  check('2: a bare URL is written out as from=to=today', urlSearch(page) === 'from=2026-10-12&to=2026-10-12', urlSearch(page))
  check('2: the door gets both dates, and the page size', lists.length === 1 && lists[0] === 'from=2026-10-12&to=2026-10-12&skip=0&take=200', lists.join(' | '))

  // 3
  for (const [id, text] of [
    ['64fA001', 'Created'],
    ['64fA002', 'Refused'],
    ['64fA003', 'Dropped lines'],
    ['64fA004', 'Cancelled'],
    ['64fA005', 'Status failed'],
  ])
    check(`3: outcome ${text} renders`, (await cell(page, id, 'outcome')) === text, await cell(page, id, 'outcome'))
  check('3: the last status in words — 20 · Accepted', (await cell(page, '64fA001', 'lastStatus')) === '20 · Accepted', await cell(page, '64fA001', 'lastStatus'))
  check('3: 120 · Failed, 110 · Cancelled, 90 · Finalized', (await cell(page, '64fA002', 'lastStatus')) === '120 · Failed' && (await cell(page, '64fA004', 'lastStatus')) === '110 · Cancelled' && (await cell(page, '64fA005', 'lastStatus')) === '90 · Finalized')
  check('3: an unnamed status code shows raw', (await cell(page, '64fA007', 'lastStatus')) === '100', await cell(page, '64fA007', 'lastStatus'))
  check('3: the call reads OK / Failed', (await cell(page, '64fA001', 'lastStatusOk')) === 'OK' && (await cell(page, '64fA005', 'lastStatusOk')) === 'Failed')
  check('3: the total has 3 decimals, beside its currency', (await cell(page, '64fA001', 'total')) === '123.450' && (await cell(page, '64fA001', 'currencyKey')) === 'SAR' && (await cell(page, '64fA002', 'total')) === '58.100')
  check('3: received at, display id, store, platform, reason, dropped lines', (await cell(page, '64fA003', 'receivedAt')) === '2026-10-12 09:15' && (await cell(page, '64fA003', 'channelDisplayId')) === 'D003' && (await cell(page, '64fA004', 'storeCode')) === '0099' && (await cell(page, '64fA002', 'platformKey')) === 'KEETA' && (await cell(page, '64fA003', 'reason')) === 'Unknown PLU 999' && (await cell(page, '64fA003', 'droppedLines')) === '1')
  check('3: our document is a link to its page', (await cellLoc(page, '64fA001', 'documentNumber').locator('a').getAttribute('href')) === '/oms/document/45000001' && (await cell(page, '64fA002', 'documentNumber')) === '')
  const alert = await painted(page, '64fA006')
  const plain = await painted(page, '64fA001')
  check('3: 🚩 the 126 row is painted on the danger ground', alert !== plain && /rgb\(/.test(alert), `${alert} vs ${plain}`)
  check('3: the 126 row says it needs a person', /126 · Cancel failed/.test(await cell(page, '64fA006', 'lastStatus')) && (await cellLoc(page, '64fA006', 'lastStatus').locator('[data-needs-person]').innerText()) === 'Needs a person')
  check('3: the count reads 7 orders', (await page.locator('[data-status-count]').innerText()) === '7 orders')
  await page.screenshot({ path: `${SHOTS}/ltr-list.png` })

  // 4: outcome and platform as repeated keys
  await page.locator('[data-filter-outcome="refused"]').click()
  await waitRows(page, 1)
  await page.locator('[data-filter-outcome="statusFailed"]').click()
  await waitRows(page, 2)
  check('4: outcome is a repeated key in the URL', new URLSearchParams(urlSearch(page)).getAll('outcome').join() === 'refused,statusFailed', urlSearch(page))
  check('4: …and on the door', lastList(lists).getAll('outcome').join() === 'refused,statusFailed', lists.at(-1))
  check('4: the chip is pressed', (await page.locator('[data-filter-outcome="refused"]').getAttribute('aria-pressed')) === 'true')
  await page.locator('[data-filter-outcome="refused"]').click()
  await page.locator('[data-filter-outcome="statusFailed"]').click()
  await waitRows(page, ORDERS.length)

  // 5: Platforms readable → its keys
  const offered = await page.locator('[data-filter-platform]').evaluateAll((els) => els.map((e) => e.getAttribute('data-filter-platform')))
  check('5: Platforms readable → its keys are offered', JSON.stringify(offered) === JSON.stringify(['JAHEZ', 'KEETA', 'MRSOOL']), offered.join())
  await page.locator('[data-filter-platform="JAHEZ"]').click()
  await page.locator('[data-filter-platform="KEETA"]').click()
  await page.waitForFunction(() => new URLSearchParams(location.search).getAll('platform').length === 2)
  await waitRows(page, 6)
  check('4: platform is a repeated key in the URL and on the door', new URLSearchParams(urlSearch(page)).getAll('platform').join() === 'JAHEZ,KEETA' && lastList(lists).getAll('platform').join() === 'JAHEZ,KEETA', lists.at(-1))

  // store and text land on Search
  await page.locator('[data-filter-store]').fill('1234')
  await page.locator('[data-filter-q]').fill('d005')
  const before = lists.length
  await page.waitForTimeout(300)
  check('4: typing alone sends nothing', lists.length === before)
  await page.locator('[data-orders-search]').click()
  await waitRows(page, 1)
  check('4: store and text land in the URL and on the door', lastList(lists).get('store') === '1234' && lastList(lists).get('q') === 'd005' && new URLSearchParams(urlSearch(page)).get('q') === 'd005', lists.at(-1))

  // the window
  const sent = lists.length
  await page.locator('[data-filter-from]').fill('2026-09-11')
  await page.locator('[data-window-problem="tooLong"]').waitFor({ timeout: 5000 })
  await page.waitForTimeout(400)
  check('4: 🚩 32 days (09-11..10-12, inclusive) are refused on screen with NO call', lists.length === sent && /at most ⁨31⁩ days/.test(await page.locator('[data-window-problem]').innerText()), await page.locator('[data-window-problem]').innerText())
  check('4: the refused window stays in the URL as written', new URLSearchParams(urlSearch(page)).get('from') === '2026-09-11')
  check('4: Search is disabled while the window is refused', await page.locator('[data-orders-search]').isDisabled())
  await page.locator('[data-filter-from]').fill('2026-09-12')
  await waitRows(page, 1)
  check('4: 31 days (09-12..10-12) are sent', lastList(lists).get('from') === '2026-09-12' && lastList(lists).get('to') === '2026-10-12', lists.at(-1))
  await page.locator('[data-filter-to]').fill('2026-09-01')
  await page.locator('[data-window-problem="reversed"]').waitFor({ timeout: 5000 })
  check('4: a reversed window is refused', (await page.locator('[data-window-problem]').innerText()).includes('before the start date'))
  await page.screenshot({ path: `${SHOTS}/ltr-window-refused.png` })
  const beforeClear = lists.length
  await page.locator('[data-filter-from]').fill('')
  await page.locator('[data-window-problem="invalid"]').waitFor({ timeout: 5000 })
  await page.waitForTimeout(300)
  check('4: a cleared date stays empty and is refused — never silently today', lists.length === beforeClear && new URLSearchParams(urlSearch(page)).get('from') === '', urlSearch(page))

  await page.locator('[data-orders-clear]').click()
  await waitRows(page, ORDERS.length)
  check('4: Clear resets to today..today, nothing else', urlSearch(page) === 'from=2026-10-12&to=2026-10-12' && (await page.locator('[data-filter-store]').inputValue()) === '', urlSearch(page))
  check('2–5: no page errors', errors.length === 0, errors.join(' | '))
  check('2–5: one Platforms read', calls.filter((c) => c === 'DeliverectWeb/Platforms').length === 1)
  await context.close()
}
{
  // a pasted URL drives the door
  const { context, page, lists } = await open('ltr')
  await page.goto(`${BASE}/deliverect/orders?from=2026-10-01&to=2026-10-12&platform=KEETA&outcome=refused&outcome=cancelled&store=0099`)
  await waitRows(page, 1)
  const q = lastList(lists)
  check('4: a pasted URL drives the door with the same params', q.get('from') === '2026-10-01' && q.getAll('platform').join() === 'KEETA' && q.getAll('outcome').join() === 'refused,cancelled' && q.get('store') === '0099', lists.at(-1))
  check('4: …and the chips and store box show it', (await page.locator('[data-filter-outcome="cancelled"]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-filter-store]').inputValue()) === '0099')
  await context.close()
}
{
  // 2: today is LOCAL — 00:30 on the 13th in Riyadh is 21:30 UTC on the 12th.
  const { context, page } = await open('ltr', { at: new Date('2026-10-13T00:30:00+03:00') })
  await page.goto(`${BASE}/deliverect/orders`)
  await waitRows(page, ORDERS.length)
  check('2: 🚩 "today" is the LOCAL date (the 13th at 00:30), never toISOString’s 12th', urlSearch(page) === 'from=2026-10-13&to=2026-10-13', urlSearch(page))
  await context.close()
}
{
  // 5: Platforms refused (403) → the rows' keys
  const { context, page, errors } = await open('ltr', { platforms: 'refused' })
  await page.goto(`${BASE}/deliverect/orders`)
  await waitRows(page, ORDERS.length)
  const offered = await page.locator('[data-filter-platform]').evaluateAll((els) => els.map((e) => e.getAttribute('data-filter-platform')))
  check('5: Platforms refused (403) → the rows’ keys are offered', JSON.stringify(offered) === JSON.stringify(['HSD', 'JAHEZ', 'KEETA']), offered.join())
  await page.locator('[data-filter-platform="HSD"]').click()
  await waitRows(page, 1)
  const kept = await page.locator('[data-filter-platform]').evaluateAll((els) => els.map((e) => e.getAttribute('data-filter-platform')))
  check('5: filtering by one platform keeps the others on offer', JSON.stringify(kept) === JSON.stringify(['HSD', 'JAHEZ', 'KEETA']), kept.join())
  check('5 (403): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6–9: the drawer, raw, retry, export ─────────────────────────────────────────────────────
{
  const { context, page, errors, lists, retries } = await open('ltr')
  await page.goto(`${BASE}/deliverect/orders`)
  await waitRows(page, ORDERS.length)

  // 8: retry offered only where allowed
  const offeredRetry = await page.locator('[data-orders-grid] [data-order-retry]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-retry')).sort())
  check('8: 🚩 Retry is offered on the refused and statusFailed rows ONLY', JSON.stringify(offeredRetry) === JSON.stringify(['64fA002', '64fA005']), offeredRetry.join())

  // 6: the drawer
  await page.locator('[data-order-details="64fA003"]').click()
  const drawer = page.locator('dialog[open][data-order-drawer="64fA003"]')
  await drawer.locator('[data-order-lines] table').waitFor({ timeout: 5000 })
  check('6: the drawer is titled by platform · display id', (await drawer.locator('[data-order-title]').innerText()) === 'JAHEZ · D003')
  const dropped = drawer.locator('[data-order-line="P-999"]')
  check('6: a dropped line is badged, with its reason', (await dropped.getAttribute('data-order-line-dropped')) === '' && /Dropped/.test(await dropped.locator('[data-order-line-drop]').innerText()) && (await dropped.locator('[data-order-line-drop-reason]').innerText()) === 'Unknown PLU')
  check('6: a kept line is not badged', (await drawer.locator('[data-order-line="P-100"] [data-order-line-drop]').innerText()) === '')
  const lineText = await drawer.locator('[data-order-line="P-100"]').innerText()
  check('6: PLU, name, quantity, unit price, funded discount and material show', ['P-100', 'Panadol 500mg 24 tabs', '2', '12.500 SAR', '1.250 SAR', '101234'].every((v) => lineText.includes(v)), lineText)
  check('6: the statuses sent, in words', /20 · Accepted/.test(await drawer.locator('[data-order-status-row="20"]').innerText()))
  check('6: the document link', (await drawer.locator('[data-order-document-link]').getAttribute('href')) === '/oms/document/45000003')
  check('6: no Retry on a droppedLines order', (await drawer.locator('[data-order-drawer-retry]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-drawer.png` })

  // 7: raw over the drawer
  await drawer.locator('[data-order-raw]').click()
  const raw = page.locator('dialog[open][data-raw-drawer="64fA003"]')
  await raw.locator('[data-raw-body]').waitFor({ timeout: 5000 })
  const formatted = await raw.locator('[data-raw-body]').innerText()
  check('7: raw opens, re-indented', (await raw.locator('[data-raw-body]').getAttribute('data-raw-body')) === 'formatted' && formatted.includes('\n  "payment": {\n    "amount": 4125,'), formatted.slice(0, 80))
  check('7: 🚩 values untouched — 1.10 and the \\u escapes as sent', formatted.includes('"rate": 1.10') && formatted.includes('"\\u0628\\u0646'), formatted)
  check('7: received at shows', (await raw.locator('[data-raw-received-at]').innerText()).includes('2026-10-12 09:15'))
  await raw.locator('[data-raw-verbatim]').click()
  check('7: "As received" shows the body verbatim', (await raw.locator('[data-raw-body]').innerText()) === RAW_BODY)
  await page.screenshot({ path: `${SHOTS}/ltr-raw.png` })
  await page.keyboard.press('Escape')
  await raw.waitFor({ state: 'detached' })
  check('7: Escape closes the raw view and leaves the drawer', (await drawer.count()) === 1)
  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'detached' })

  // a non-JSON body
  await page.locator('[data-order-details="64fA001"]').click()
  await page.locator('dialog[open][data-order-drawer="64fA001"] [data-order-raw]').click()
  const raw1 = page.locator('dialog[open][data-raw-drawer="64fA001"]')
  await raw1.locator('[data-raw-body]').waitFor({ timeout: 5000 })
  check('7: a body that is not JSON is shown exactly as received', (await raw1.locator('[data-raw-body]').innerText()) === 'not json — signature mismatch dump' && /not valid JSON/.test(await raw1.locator('[data-raw-note]').innerText()))
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.locator('dialog[open]').first().waitFor({ state: 'detached' })

  // 6: the 126 order leads with the alert
  await page.locator('[data-order-details="64fA006"]').click()
  const d6 = page.locator('dialog[open][data-order-drawer="64fA006"]')
  await d6.locator('[data-order-statuses] table').waitFor({ timeout: 5000 })
  check('6: 🚩 a 126 order leads with the alert, in words', /needs a person/.test(await d6.locator('[data-order-alert]').innerText()))
  check('6: the 126 status row is marked and named', (await d6.locator('[data-order-status-row="126"]').getAttribute('data-order-status-alert')) === '' && /126 · Cancel failed/.test(await d6.locator('[data-order-status-row="126"]').innerText()))
  await page.screenshot({ path: `${SHOTS}/ltr-drawer-126.png` })
  await page.keyboard.press('Escape')
  await d6.waitFor({ state: 'detached' })

  // 6: a statusFailed order — Deliverect's answer and the attempts; Retry in the drawer
  await page.locator('[data-order-details="64fA005"]').click()
  const d5 = page.locator('dialog[open][data-order-drawer="64fA005"]')
  await d5.locator('[data-order-statuses] table').waitFor({ timeout: 5000 })
  check('6: Deliverect’s answer and the attempts show', (await d5.locator('[data-order-status-row="90"] [data-order-status-answer]').innerText()) === 'Gateway timeout' && (await d5.locator('[data-order-status-row="90"] [data-order-status-attempts]').innerText()) === '3' && (await d5.locator('[data-order-status-row="90"] [data-order-status-call]').innerText()) === 'Failed')
  check('8: Retry is offered in the drawer of a statusFailed order', (await d5.locator('[data-order-drawer-retry]').count()) === 1)

  // 8: retry, confirmed
  const listsBefore = lists.length
  await d5.locator('[data-order-drawer-retry]').click()
  const confirm = page.locator('dialog[open] [data-retry-dialog="64fA005"]')
  await confirm.waitFor({ timeout: 5000 })
  check('8: the retry asks first, saying what it does', /sends it to Deliverect again/.test(await confirm.locator('[data-retry-note]').innerText()) && retries.length === 0)
  await page.locator('[data-retry-confirm]').click()
  await confirm.waitFor({ state: 'detached', timeout: 10000 })
  check('8: it POSTs to Orders/{id}/Retry with an empty body', retries.length === 1 && retries[0].id === '64fA005' && retries[0].body === '{}', JSON.stringify(retries))
  await page.waitForTimeout(500)
  check('8: the list is read again', lists.length > listsBefore, `${listsBefore} → ${lists.length}`)

  // DLV-00007 on a second retry
  await d5.locator('[data-order-drawer-retry]').click()
  await confirm.waitFor({ timeout: 5000 })
  await page.locator('[data-retry-confirm]').click()
  const r7 = page.locator('[data-retry-refusal="DLV-00007"]')
  await r7.waitFor({ timeout: 5000 })
  check('8: DLV-00007 shows inline with the server’s words, the dialog open', (await r7.locator('[data-inline-refusal="DLV-00007"] bdi').first().innerText()).startsWith('The order or its status call is not in a failed state. / ') && (await confirm.count()) === 1)
  await page.screenshot({ path: `${SHOTS}/ltr-retry-00007.png` })
  await page.locator('[data-retry-cancel]').click()
  await confirm.waitFor({ state: 'detached' })
  await page.keyboard.press('Escape')
  await d5.waitFor({ state: 'detached' })

  // DLV-00006 from the grid
  await page.locator('[data-order-retry="64fA002"]').click()
  await page.locator('dialog[open] [data-retry-dialog="64fA002"]').waitFor({ timeout: 5000 })
  check('8: a refused order’s note says it runs again', /runs it again/.test(await page.locator('[data-retry-note]').innerText()))
  await page.locator('[data-retry-confirm]').click()
  await page.locator('[data-retry-refusal="DLV-00006"]').waitFor({ timeout: 5000 })
  check('8: DLV-00006 shows inline', /No such Deliverect order/.test(await page.locator('[data-retry-refusal="DLV-00006"]').innerText()))
  await page.locator('[data-retry-cancel]').click()

  // 6: a refused detail read
  await page.locator('[data-order-details="64fA004"]').click()
  await page.locator('dialog[open][data-order-drawer="64fA004"] [data-order-error="DLV-00006"]').waitFor({ timeout: 5000 })
  check('6: a refused detail read shows its code', /DLV-00006/.test(await page.locator('[data-order-error]').innerText()))
  await page.keyboard.press('Escape')

  // 9: export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-orders-export]').click()])
  const name = dl.suggestedFilename()
  const rows = sheetRows(unzipText(readFileSync(await dl.path())))
  check('9: the workbook is deliverect-orders-<stamp>.xlsx', /^deliverect-orders-\d{8}-\d{4}\.xlsx$/.test(name), name)
  check(
    '9: the shown columns, actions left out',
    JSON.stringify(rows[0]) ===
      JSON.stringify(['Received at', 'Delivery platform', 'Display id', 'Store', 'Our document', 'Outcome', 'Reason', 'Dropped lines', 'Last status sent', 'Status call', 'Status sent at', 'Total', 'Currency']),
    JSON.stringify(rows[0]),
  )
  const r1 = rows.find((r) => r.includes('D001'))
  check('9: a row as the grid shows it — the total numeric, the store and document as text', r1 && r1.includes('20 · Accepted') && r1.includes('n:123.45') && r1.includes('1234') && r1.includes('45000001') && r1.includes('SAR'), JSON.stringify(r1))
  check('9: every order is written', rows.length === ORDERS.length + 1, String(rows.length))
  check('6–9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: paging ──────────────────────────────────────────────────────────────────────────────
{
  const { context, page, lists } = await open('ltr', { total: 450 })
  await page.goto(`${BASE}/deliverect/orders`)
  await waitRows(page, ORDERS.length)
  check('10: the bar says which part of the total shows', (await page.locator('[data-status-count]').innerText()) === 'Showing 1–7 of 450')
  check('10: Previous is disabled on the first page', await page.locator('[data-orders-previous]').isDisabled())
  await page.locator('[data-orders-next]').click()
  await page.waitForFunction(() => new URLSearchParams(location.search).get('skip') === '200')
  await waitRows(page, ORDERS.length)
  check('10: Next sends skip=200 and writes it to the URL', lastList(lists).get('skip') === '200', lists.at(-1))
  await page.locator('[data-filter-outcome="refused"]').click()
  await page.waitForFunction(() => !new URLSearchParams(location.search).has('skip'))
  await waitRows(page, 1)
  check('10: a filter change starts again at the first page', lastList(lists).get('skip') === '0', lists.at(-1))
  await context.close()
}

// ── 11: RTL ─────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, retries } = await open('rtl')
  await page.goto(`${BASE}/deliverect/orders`)
  await waitRows(page, ORDERS.length)
  check('11: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('11: the last status pair is ONE ltr isolate', (await cellLoc(page, '64fA001', 'lastStatus').locator('bdi[dir="ltr"]').allInnerTexts()).join('|') === '20 · Accepted')
  check('11: the count isolates its number', (await page.locator('[data-status-count] bdi[dir="ltr"]').innerText()) === '7')
  await page.screenshot({ path: `${SHOTS}/rtl-list.png` })
  await page.locator('[data-order-details="64fA003"]').click()
  const drawer = page.locator('dialog[open][data-order-drawer="64fA003"]')
  await drawer.locator('[data-order-lines] table').waitFor({ timeout: 5000 })
  const iso = await drawer.locator('[data-order-line="P-100"] bdi[dir="ltr"]').allInnerTexts()
  check('11: a line’s machine values are isolated whole (money with its currency)', ['P-100', '2', '12.500 SAR', '1.250 SAR', '101234'].every((v) => iso.includes(v)), iso.join(' | '))
  check('11: a line’s name is free text (bdi, direction auto)', (await drawer.locator('[data-order-line="P-999"] bdi:not([dir])').first().innerText()) === 'بنادول أطفال')
  check('11: the title pair is one isolate', (await drawer.locator('[data-order-title] bdi[dir="ltr"]').innerText()) === 'JAHEZ · D003')
  await page.screenshot({ path: `${SHOTS}/rtl-drawer.png` })
  await drawer.locator('[data-order-raw]').click()
  const raw = page.locator('dialog[open][data-raw-drawer="64fA003"]')
  await raw.locator('[data-raw-body]').waitFor({ timeout: 5000 })
  check('11: the raw body is ONE ltr island', (await raw.locator('pre[dir="ltr"][data-raw-body]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/rtl-raw.png` })
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.locator('dialog[open]').first().waitFor({ state: 'detached' })
  await page.locator('[data-order-retry="64fA002"]').click()
  await page.locator('dialog[open] [data-retry-dialog="64fA002"]').waitFor({ timeout: 5000 })
  check('11: the retry note isolates the display id', (await page.locator('[data-retry-note] bdi[dir="ltr"]').innerText()) === 'D002')
  await page.screenshot({ path: `${SHOTS}/rtl-retry.png` })
  await page.locator('[data-retry-confirm]').click()
  await page.locator('dialog[open] [data-retry-dialog]').waitFor({ state: 'detached', timeout: 10000 })
  check('11: retry works under RTL', retries.at(-1)?.id === '64fA002')
  check('11: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
