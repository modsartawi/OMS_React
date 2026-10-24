// HungerStation orders monitor drive (ticket 556, BackOffice spec 3028).
//
// Drives the REAL app in Chromium against STUBS of the HungerStation door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md § Orders monitor) —
// the doors (BackOffice 3036, 3037) are not on staging, so there is no live SIS.Api to point at. Every
// fixture emits EXACTLY the contract's fields, on the REAL envelope { statusCode, success, message,
// errors: [{ errorCode, internalErrorCode, errorMessage }], data }, every refusal's errorMessage is
// "<English> / <Arabic>", and a refusal for a missing grant is a BARE 403 (no envelope):
//   GET  HungerStationWeb/Access                              → { canManageStores, canManageCatalog, canViewOrders }
//   GET  HungerStationWeb/Chains                              → ["OlaCare", "AlDawaa"] OR bare 403
//   GET  HungerStationWeb/Orders?from=&to=&store=&chain=&outcome=&q=&skip=&take=
//                                                             → { total, rows: [{ orderId, orderCode, chainKey, vendorId,
//                                                                 storeCode, receivedAt, hsStatus, documentNumber, outcome,
//                                                                 reason, replacedLines, deliveries, total, currencyKey,
//                                                                 alert, retryable }] }; 400 HungerStationWindowInvalid
//   GET  HungerStationWeb/Orders/{orderId}                    → the row + lines[] { itemId, replacedId, sku, name, status,
//                                                                 quantity, unitPrice, totalPrice, discount, materialNumber }
//                                                                 + deliveries[] { receiveId, receivedAt, run: { status,
//                                                                 attempts, lastAttemptAt, nextAttemptAt, error } | null };
//                                                                 DHS-00011
//   GET  HungerStationWeb/Orders/{orderId}/Deliveries/{receiveId}/Raw → { receivedAt, body } (body a JSON STRING); DHS-00011
//   POST HungerStationWeb/Orders/{orderId}/Retry { reason }   → { orderId, receiveId, requeued }; DHS-00008/00011/00012
//
// With the browser in Asia/Riyadh and its clock fixed at 2026-10-24 11:00 local, it asserts:
//   1. the Orders leaf rides canViewOrders on the ONE probe (one call); without it the leaf is hidden
//      and the URL shows the denied card with no Orders call;
//   2. the grid: a bare URL is written out as today..today and sent with take=100; every column; the
//      four outcomes in words; a null store / document blank; the total and its currency ONE value
//      (`123.450 SAR`, no separate currency column); the store code links to its logs on the Stores
//      page (`?logs=<code>`, the 554 deep link) — only with canManageStores, else plain text and NO
//      Chains call (Chains rides canManageStores; the filter offers the rows' chains);
//   3. the unmatched alert: badged "Store not onboarded", the row on the attention ground, its link
//      opens the Stores page searched by the vendor id;
//   4. the window: 32 days refused with NO call; 31 sent; reversed; tomorrow sent, the day after out of
//      bounds; a server 400 HungerStationWindowInvalid shows inline;
//   5. filters: outcome is a repeated key (incl. replacedLines / unmatched) in the URL AND on the door;
//      the chain filter offers the Chains read, or the rows' chains when it is refused; store and text
//      land on Search; a pasted URL drives the door; Clear resets;
//   6. paging (the stub pages for real by skip/take): total > rows offers Next, which sends skip=100 and
//      shows DIFFERENT rows (page 2's), Previous goes back to page 1's;
//   7. the drawer: the fields; lines with each replacement right after the line it replaced and
//      HungerStation's line status, money in the order's currency; deliveries oldest first with their
//      run (Done / Waiting / Stopped, attempts, last, next only for P, error) and "intake failed" for a
//      null run; a refused detail read shows its code; an unmatched order leads with its alert + link;
//   8. the raw view: over the drawer, pretty-printed from the JSON string (values untouched), "As
//      received" verbatim, a non-JSON body as received, copy;
//   9. retry: hidden when not retryable (grid and drawer); asks a reason; says it re-runs the latest
//      run only; POSTs { reason }; the row then reads Pending; DHS-00012 inline and the row refreshed;
//      DHS-00011 inline; DHS-00008 under the reason;
//  10. under RTL (direction only — `lng` stays `en` app-wide) machine values are isolated, the raw body
//      is one LTR island, and a retry works.
//
//   1. run the app:  npx vite --port 5236 --strictPort
//   2. DRIVE_PORT=5236 node tools/hungerstation-orders-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.hungerstation-orders-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope.
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: message }] : [],
    data,
  }),
})
/** A missing grant: a BARE 403, no envelope (contract § Common). */
const bare403 = { status: 403, contentType: 'text/plain', body: '' }

const REFUSALS = {
  'DHS-00008': [400, 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'],
  'DHS-00011': [404, 'No such HungerStation order. / لا يوجد طلب هنقرستيشن بهذا الرقم.'],
  'DHS-00012': [409, 'The order is not failed. / الطلب ليس في حالة فشل.'],
  HungerStationWindowInvalid: [400, 'The window must start on or after 2000-01-01. / يجب أن تبدأ الفترة في 2000-01-01 أو بعده.'],
}
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

/** An order row exactly as the contract has it. */
const order = (orderId, over = {}) => ({
  orderId,
  orderCode: `C-${orderId.slice(-3)}`,
  chainKey: 'OlaCare',
  vendorId: 'abc12',
  storeCode: '1234',
  receivedAt: '2026-10-24T09:15:00',
  hsStatus: 'RECEIVED',
  documentNumber: `45000${orderId.slice(-3)}`,
  outcome: 'created',
  reason: null,
  replacedLines: 0,
  deliveries: 1,
  total: 123.45,
  currencyKey: 'SAR',
  alert: null,
  retryable: false,
  ...over,
})

const freshOrders = () => [
  order('hs-a001'),
  order('hs-a002', { outcome: 'failed', reason: 'Material 101 is not on the HungerStation list', documentNumber: null, retryable: true, deliveries: 2, total: 58.1 }),
  order('hs-a003', { outcome: 'cancelled', hsStatus: 'CANCELLED', chainKey: 'AlDawaa', vendorId: 'ad2001', storeCode: '2001' }),
  order('hs-a004', { outcome: 'pending', documentNumber: null, hsStatus: 'ACCEPTED' }),
  order('hs-a005', { outcome: 'pending', alert: 'unmatched', vendorId: 'zz999', storeCode: null, documentNumber: null }),
  order('hs-a006', { replacedLines: 1, total: 41.25 }),
  order('hs-a007', { outcome: 'failed', reason: 'SAP refused the document', documentNumber: null, retryable: true }),
]

const line = (itemId, over = {}) => ({
  itemId,
  replacedId: null,
  sku: `SKU-${itemId}`,
  name: 'Panadol 500mg 24 tabs',
  status: 'IN_CART',
  quantity: 2,
  unitPrice: 12.5,
  totalPrice: 25,
  discount: 1.25,
  materialNumber: '101234',
  ...over,
})
const run = (status, over = {}) => ({
  status,
  attempts: 1,
  lastAttemptAt: '2026-10-24T09:15:05',
  nextAttemptAt: null,
  error: null,
  ...over,
})
const DETAIL = {
  // Lines given with the replacement APART from the line it replaced: the page must move it up.
  'hs-a006': {
    lines: [
      line('L1'),
      line('L2', { status: 'REPLACED', name: 'بنادول أطفال' }),
      line('L3', { materialNumber: null }),
      line('L9', { replacedId: 'L2', sku: 'SKU-L9', name: 'Adol 500mg' }),
    ],
    deliveries: [{ receiveId: 'r-6001', receivedAt: '2026-10-24T09:15:00', run: run('C') }],
  },
  // Deliveries given NEWEST first: the page must show them oldest first.
  'hs-a002': {
    lines: [line('L1')],
    deliveries: [
      { receiveId: 'r-2002', receivedAt: '2026-10-24T09:20:00', run: run('F', { attempts: 5, lastAttemptAt: '2026-10-24T10:40:00', error: 'Material 101 is not on the HungerStation list' }) },
      { receiveId: 'r-2001', receivedAt: '2026-10-24T09:15:00', run: null },
    ],
  },
  'hs-a004': {
    lines: [line('L1')],
    deliveries: [{ receiveId: 'r-4001', receivedAt: '2026-10-24T09:15:00', run: run('P', { attempts: 2, nextAttemptAt: '2026-10-24T11:05:00', error: 'SAP timeout' }) }],
  },
}
const detailOf = (row) => ({
  ...row,
  ...(DETAIL[row.orderId] ?? { lines: [line('L1')], deliveries: [{ receiveId: `r-${row.orderId.slice(-3)}1`, receivedAt: row.receivedAt, run: run('C') }] }),
})

// The body as HungerStation sent it: compact, with values a parse-and-stringify would rewrite.
const RAW_BODY = '{"token":"t-1","order":{"code":"C-002","price":1.10,"items":[{"sku":"SKU-L1","name":"\\u0628\\u0646\\u0627\\u062f\\u0648\\u0644"}]},"note":""}'
const RAW = {
  'r-2002': { receivedAt: '2026-10-24T09:20:00', body: RAW_BODY },
  'r-2001': { receivedAt: '2026-10-24T09:15:00', body: 'not json — truncated webhook' },
}

const CHAINS = ['OlaCare', 'AlDawaa']

function ordersAnswer(qs, list) {
  const outcomes = qs.getAll('outcome')
  const store = qs.get('store')
  const chain = qs.get('chain')
  const q = (qs.get('q') ?? '').toLowerCase()
  const facts = (o) => [o.outcome, ...(o.replacedLines > 0 ? ['replacedLines'] : []), ...(o.alert === 'unmatched' ? ['unmatched'] : [])]
  const rows = list.filter(
    (o) =>
      (!outcomes.length || facts(o).some((f) => outcomes.includes(f))) &&
      (!store || o.storeCode === store) &&
      (!chain || o.chainKey === chain) &&
      (!q || [o.orderId, o.orderCode, o.documentNumber].some((v) => v?.toLowerCase().includes(q))),
  )
  // Paged for real: `total` is every match, `rows` only the page skip/take asks for.
  const skip = Number(qs.get('skip') ?? 0)
  const take = Number(qs.get('take') ?? 100)
  return { total: rows.length, rows: rows.slice(skip, skip + take) }
}

/** 243 more created orders, so the window holds 250 and pages past the first 100. */
const extraOrders = () =>
  Array.from({ length: 243 }, (_, i) => order(`hs-x${String(i + 1).padStart(3, '0')}`, { orderCode: `X-${String(i + 1).padStart(3, '0')}` }))

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true }
const ELEVEN = new Date('2026-10-24T11:00:00+03:00')

const browser = await chromium.launch()

async function open(dir, { access = ALL, chains = 'ok', many = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  await page.clock.setFixedTime(ELEVEN)
  const orders = many ? [...freshOrders(), ...extraOrders()] : freshOrders()
  const errors = []
  const calls = []
  const lists = []
  const retries = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // The browser logs every refused stub's status.
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
    if (p === 'HungerStationWeb/Access') return route.fulfill(envelope(access))
    if (p === 'HungerStationWeb/Chains') return route.fulfill(chains === 'ok' ? envelope(CHAINS) : bare403)
    if (p === 'HungerStationWeb/Stores') return route.fulfill(envelope([]))
    if (p === 'HungerStationWeb/Orders' && req.method() === 'GET') {
      lists.push(url.search.slice(1))
      if (url.searchParams.get('from') === '2026-10-01' && url.searchParams.get('to') === '2026-10-02') return route.fulfill(refuse('HungerStationWindowInvalid'))
      return route.fulfill(envelope(ordersAnswer(url.searchParams, orders)))
    }
    const m = /^HungerStationWeb\/Orders\/([^/]+)(?:\/(Retry)|\/Deliveries\/([^/]+)\/Raw)?$/.exec(p)
    if (m) {
      const id = decodeURIComponent(m[1])
      const row = orders.find((o) => o.orderId === id)
      if (m[2] === 'Retry' && req.method() === 'POST') {
        const body = req.postDataJSON()
        retries.push({ id, body })
        if (body.reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
        if (body.reason === 'trigger 00011') return route.fulfill(refuse('DHS-00011'))
        if (!row || !row.retryable) return route.fulfill(refuse('DHS-00012'))
        if (id === 'hs-a007') {
          // Someone else's retry already turned it into a document: no longer failed.
          Object.assign(row, { outcome: 'created', retryable: false, reason: null, documentNumber: '4500077' })
          return route.fulfill(refuse('DHS-00012'))
        }
        Object.assign(row, { outcome: 'pending', retryable: false, reason: null })
        return route.fulfill(envelope({ orderId: id, receiveId: 'r-2002', requeued: true }))
      }
      if (m[3]) {
        const raw = RAW[decodeURIComponent(m[3])]
        return raw ? route.fulfill(envelope(raw)) : route.fulfill(refuse('DHS-00011'))
      }
      if (id === 'hs-a003') return route.fulfill(refuse('DHS-00011'))
      return row ? route.fulfill(envelope(detailOf(row))) : route.fulfill(refuse('DHS-00011'))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, lists, retries, orders }
}

/** Wait until the grid holds `n` rows (a row is drawn once per pinned/centre section) and has settled. */
const waitRows = async (page, n) => {
  await page.waitForFunction(
    (count) =>
      new Set([...document.querySelectorAll('[data-orders-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size === count &&
      !document.querySelector('[data-orders-grid] .ag-overlay-loading-center'),
    n,
    { timeout: 20000 },
  ).catch(async (e) => {
    const seen = await page.evaluate(() => document.querySelectorAll('[data-orders-grid] .ag-row[row-index]').length)
    console.log(`waitRows(${n}) timed out at ${page.url()} — ${seen} row elements`)
    throw e
  })
  await page.waitForTimeout(150)
}

// A row id repeats across AG Grid's pinned containers; a CELL is in exactly one.
const cellLoc = (page, id, colId) => page.locator(`[data-orders-grid] .ag-row[row-id="${id}"] [col-id="${colId}"]`)
const cell = async (page, id, colId) => ((await cellLoc(page, id, colId).count()) ? (await cellLoc(page, id, colId).innerText()).trim() : null)
const painted = (page, id) =>
  page.evaluate(
    (rid) =>
      [...document.querySelectorAll(`[data-orders-grid] .ag-row[row-id="${rid}"]`)].map((r) => getComputedStyle(r, '::after').backgroundColor).join(' '),
    id,
  )
const urlSearch = (page) => new URL(page.url()).search.slice(1)
const lastList = (lists) => new URLSearchParams(lists.at(-1))
const N = 7

/** Type a reason and confirm — once the dialog has taken the text (Confirm enabled). */
const confirmWith = async (dialog, reason) => {
  const input = dialog.locator('[data-reason-input]')
  const confirm = dialog.locator('[data-reason-confirm]')
  await input.fill(reason)
  await confirm.click()
}

/** Click an outcome chip and wait until the URL has taken it (its pressed state reads the URL). */
const chip = async (page, o) => {
  const loc = page.locator(`[data-filter-outcome="${o}"]`)
  const was = await loc.getAttribute('aria-pressed')
  await loc.click()
  await page.waitForFunction(([sel, w]) => document.querySelector(sel)?.getAttribute('aria-pressed') !== w, [`[data-filter-outcome="${o}"]`, was])
}

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/orders"]').first().waitFor({ timeout: 15000 })
  check('1: the Orders leaf reads "Orders"', (await page.locator('nav a[href="/hungerstation/orders"]').first().innerText()).trim() === 'Orders')
  await page.locator('nav a[href="/hungerstation/orders"]').first().click()
  await waitRows(page, N)
  check('1: the leaf opens the monitor, not the placeholder', (await page.locator('[data-hs-placeholder]').count()) === 0)
  check('1: the group, its leaves and the page gate cost ONE probe call', calls.filter((c) => c === 'HungerStationWeb/Access').length === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canViewOrders: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/stores"]').first().waitFor({ timeout: 15000 })
  check('1: 🚩 without canViewOrders the Orders leaf is hidden (Stores stays)', (await page.locator('nav a[href="/hungerstation/orders"]').count()) === 0)
  await page.goto(`${BASE}/hungerstation/orders`)
  await page.getByText('No access to HungerStation orders').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card and asks no Orders call', !calls.includes('HungerStationWeb/Orders'))
  check('1 (denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–6: the grid, the alert, the window, the filters ───────────────────────────────────────
{
  const { context, page, errors, lists, calls } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/orders`)
  await waitRows(page, N)

  // 2
  check('2: a bare URL is written out as from=to=today', urlSearch(page) === 'from=2026-10-24&to=2026-10-24', urlSearch(page))
  check('2: the door gets both dates and take=100', lists.length === 1 && lists[0] === 'from=2026-10-24&to=2026-10-24&skip=0&take=100', lists.join(' | '))
  for (const [id, text] of [
    ['hs-a001', 'Created'],
    ['hs-a002', 'Failed'],
    ['hs-a003', 'Cancelled'],
    ['hs-a004', 'Pending'],
  ])
    check(`2: outcome ${text} renders`, (await cell(page, id, 'outcome')) === text, await cell(page, id, 'outcome'))
  check(
    '2: received at, order code, order id, chain, vendor id, store, HungerStation status',
    (await cell(page, 'hs-a003', 'receivedAt')) === '2026-10-24 09:15' &&
      (await cell(page, 'hs-a003', 'orderCode')) === 'C-003' &&
      (await cell(page, 'hs-a003', 'orderId')) === 'hs-a003' &&
      (await cell(page, 'hs-a003', 'chainKey')) === 'AlDawaa' &&
      (await cell(page, 'hs-a003', 'vendorId')) === 'ad2001' &&
      (await cell(page, 'hs-a003', 'storeCode')) === '2001' &&
      (await cell(page, 'hs-a003', 'hsStatus')) === 'CANCELLED',
  )
  check('2: document, reason, replaced lines, deliveries', (await cell(page, 'hs-a001', 'documentNumber')) === '45000001' && (await cell(page, 'hs-a002', 'reason')) === 'Material 101 is not on the HungerStation list' && (await cell(page, 'hs-a006', 'replacedLines')) === '1' && (await cell(page, 'hs-a002', 'deliveries')) === '2')
  check('2: 🚩 a null store and a null document render blank', (await cell(page, 'hs-a005', 'storeCode')) === '' && (await cell(page, 'hs-a005', 'documentNumber')) === '')
  check('2: 🚩 the total is ONE value, 3 decimals then its currency', (await cell(page, 'hs-a001', 'total')) === '123.450 SAR' && (await cell(page, 'hs-a002', 'total')) === '58.100 SAR')
  check('2: …and there is no separate currency column', (await page.locator('[data-orders-grid] .ag-header-cell[col-id="currencyKey"]').count()) === 0)
  check('2: the total is isolated once, whole, with no fsi marks', (await cellLoc(page, 'hs-a001', 'total').locator('bdi').allTextContents()).join('|') === '123.450 SAR')
  check(
    '2: 🚩 with canManageStores the store code links to its logs on the Stores page',
    (await page.locator('[data-orders-grid] [data-order-store-link="2001"]').getAttribute('href')) === '/hungerstation/stores?logs=2001',
  )
  check('2: …the Chains read is made (it rides canManageStores)', calls.includes('HungerStationWeb/Chains'))
  check('2: the count reads 7 orders', (await page.locator('[data-status-count]').innerText()) === '7 orders')

  // 3: the unmatched alert
  check('3: the unmatched order is badged "Store not onboarded"', /Store not onboarded/.test(await cell(page, 'hs-a005', 'alert')))
  check('3: no alert, no badge', (await cell(page, 'hs-a001', 'alert')) === '')
  const alertBg = await painted(page, 'hs-a005')
  const plainBg = await painted(page, 'hs-a001')
  check('3: 🚩 the unmatched row is painted on the attention ground', alertBg !== plainBg && /rgb\(/.test(alertBg), `${alertBg} vs ${plainBg}`)
  const link = cellLoc(page, 'hs-a005', 'alert').locator('[data-order-stores-link]')
  check('3: its action is a link to the Stores page searched by the vendor id — not a retry', (await link.getAttribute('href')) === '/hungerstation/stores?q=zz999' && (await link.innerText()) === 'Open HungerStation stores' && (await page.locator('[data-order-retry="hs-a005"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-list.png` })

  // 9 (part): retry hidden when not retryable
  const offered = await page.locator('[data-orders-grid] [data-order-retry]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-retry')).sort())
  check('9: 🚩 Retry is offered on the retryable rows ONLY', JSON.stringify(offered) === JSON.stringify(['hs-a002', 'hs-a007']), offered.join())

  // 5: outcome as repeated keys, including the two facts
  await chip(page, 'failed')
  await waitRows(page, 2)
  await chip(page, 'unmatched')
  await waitRows(page, 3)
  check('5: outcome is a repeated key in the URL', new URLSearchParams(urlSearch(page)).getAll('outcome').join() === 'failed,unmatched', urlSearch(page))
  check('5: …and on the door (OR within the key)', lastList(lists).getAll('outcome').join() === 'failed,unmatched', lists.at(-1))
  await chip(page, 'failed')
  await chip(page, 'unmatched')
  await chip(page, 'replacedLines')
  await waitRows(page, 1)
  check('5: replacedLines filters by the fact', lastList(lists).getAll('outcome').join() === 'replacedLines' && (await cell(page, 'hs-a006', 'orderCode')) === 'C-006')
  await chip(page, 'replacedLines')
  await waitRows(page, N)

  // 5: the chain filter offers the Chains read
  const chainOpts = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('5: the chain filter offers the Chains read', JSON.stringify(chainOpts) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), chainOpts.join())
  await page.locator('[data-filter-chain]').selectOption('AlDawaa')
  await waitRows(page, 1)
  check('5: chain lands in the URL and on the door', new URLSearchParams(urlSearch(page)).get('chain') === 'AlDawaa' && lastList(lists).get('chain') === 'AlDawaa')
  await page.locator('[data-filter-chain]').selectOption('')
  await waitRows(page, N)

  // store and text land on Search
  await page.locator('[data-filter-store]').fill('1234')
  await page.locator('[data-filter-q]').fill('c-006')
  const before = lists.length
  await page.waitForTimeout(300)
  check('5: typing alone sends nothing', lists.length === before)
  await page.locator('[data-orders-search]').click()
  await waitRows(page, 1)
  check('5: store and text land in the URL and on the door', lastList(lists).get('store') === '1234' && lastList(lists).get('q') === 'c-006' && new URLSearchParams(urlSearch(page)).get('q') === 'c-006', lists.at(-1))

  // 4: the window
  let sent = lists.length
  await page.locator('[data-filter-from]').fill('2026-09-23')
  await page.locator('[data-window-problem="tooLong"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
  check('4: 🚩 32 days (09-23..10-24, inclusive) are refused on screen with NO call', lists.length === sent && /at most ⁨31⁩ days/.test(await page.locator('[data-window-problem]').innerText()), await page.locator('[data-window-problem]').innerText())
  check('4: Search is disabled while the window is refused', await page.locator('[data-orders-search]').isDisabled())
  await page.locator('[data-filter-from]').fill('2026-09-24')
  await waitRows(page, 1)
  check('4: 31 days (09-24..10-24) are sent', lastList(lists).get('from') === '2026-09-24' && lastList(lists).get('to') === '2026-10-24', lists.at(-1))
  await page.locator('[data-filter-to]').fill('2026-09-01')
  await page.locator('[data-window-problem="reversed"]').waitFor({ timeout: 15000 })
  check('4: a reversed window is refused', (await page.locator('[data-window-problem]').innerText()).includes('before the start date'))
  // Each date change rewrites the URL from the query the page last RENDERED, so the drive waits for
  // a rendered sign of one change before making the next.
  await page.locator('[data-filter-to]').fill('2026-10-25')
  await page.locator('[data-window-problem="tooLong"]').waitFor({ timeout: 15000 })
  await page.locator('[data-filter-from]').fill('2026-10-24')
  await waitRows(page, 1)
  check('4: tomorrow is the last day allowed — sent', lastList(lists).get('to') === '2026-10-25', lists.at(-1))
  sent = lists.length
  await page.locator('[data-filter-to]').fill('2026-10-26')
  await page.locator('[data-window-problem="outOfBounds"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  check('4: 🚩 the day after tomorrow is out of bounds, with NO call', lists.length === sent && /2000-01-01.*2026-10-25/.test(await page.locator('[data-window-problem]').innerText()), await page.locator('[data-window-problem]').innerText())
  await page.screenshot({ path: `${SHOTS}/ltr-window-refused.png` })
  await page.locator('[data-filter-from]').fill('1999-12-31')
  await page.locator('[data-window-problem="tooLong"]').waitFor({ timeout: 15000 })
  await page.locator('[data-filter-to]').fill('2000-01-01')
  await page.locator('[data-window-problem="outOfBounds"]').waitFor({ timeout: 15000 })
  check('4: before 2000-01-01 is out of bounds', lists.length === sent)

  await page.locator('[data-orders-clear]').click()
  await waitRows(page, N)
  check('5: Clear resets to today..today, nothing else', urlSearch(page) === 'from=2026-10-24&to=2026-10-24' && (await page.locator('[data-filter-store]').inputValue()) === '' && (await page.locator('[data-filter-q]').inputValue()) === '', urlSearch(page))

  // 3: the link opens the Stores page, searched by the vendor id
  await cellLoc(page, 'hs-a005', 'alert').locator('[data-order-stores-link]').click()
  await page.waitForURL(/\/hungerstation\/stores\?q=zz999/, { timeout: 10000 })
  check('3: the alert link opens the Stores page with the vendor id searched', new URL(page.url()).searchParams.get('q') === 'zz999')
  check('2–6: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  // a pasted URL drives the door; a server 400 HungerStationWindowInvalid shows inline
  const { context, page, lists, errors } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/orders?from=2026-10-20&to=2026-10-24&chain=OlaCare&outcome=failed&outcome=pending&store=1234`)
  await waitRows(page, 3)
  const q = lastList(lists)
  check('5: a pasted URL drives the door with the same params', q.get('from') === '2026-10-20' && q.get('chain') === 'OlaCare' && q.getAll('outcome').join() === 'failed,pending' && q.get('store') === '1234', lists.at(-1))
  check('5: …and the chips, the chain and the store box show it', (await page.locator('[data-filter-outcome="pending"]').getAttribute('aria-pressed')) === 'true' && (await page.locator('[data-filter-chain]').inputValue()) === 'OlaCare' && (await page.locator('[data-filter-store]').inputValue()) === '1234')
  await page.goto(`${BASE}/hungerstation/orders?from=2026-10-01&to=2026-10-02`)
  const server = page.locator('[data-window-problem="server"] [data-inline-refusal="HungerStationWindowInvalid"]')
  await server.waitFor({ timeout: 10000 })
  check('4: a server 400 HungerStationWindowInvalid shows inline with its words and code', (await server.locator('bdi:not([dir])').innerText()) === REFUSALS.HungerStationWindowInvalid[1] && (await server.locator('bdi[dir="ltr"]').innerText()) === 'HungerStationWindowInvalid')
  check('4: …and not as the generic failure banner', (await page.getByText('The orders could not be loaded').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-window-server.png` })
  check('5 (pasted): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  // 5: Chains refused (bare 403) → the rows' chains
  const { context, page, errors } = await open('ltr', { chains: 403 })
  await page.goto(`${BASE}/hungerstation/orders`)
  await waitRows(page, N)
  const opts = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('5: Chains refused → the rows’ chains are offered', JSON.stringify(opts) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), opts.join())
  await page.locator('[data-filter-chain]').selectOption('AlDawaa')
  await waitRows(page, 1)
  const kept = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('5: filtering by one chain keeps the others on offer', JSON.stringify(kept) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), kept.join())
  check('5 (403): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  // 2 + 5 + 7: an orders user WITHOUT canManageStores — no Chains call, the rows' chains, plain store codes
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canManageStores: false } })
  await page.goto(`${BASE}/hungerstation/orders`)
  await waitRows(page, N)
  check('5: 🚩 without canManageStores the Chains read is never sent (it could only be a bare 403)', !calls.includes('HungerStationWeb/Chains'), calls.join())
  const opts = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('5: …the chain filter offers the rows’ chains', JSON.stringify(opts) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), opts.join())
  check(
    '2: 🚩 without canManageStores the store code is plain text (isolated), no link',
    (await page.locator('[data-order-store-link]').count()) === 0 && (await cellLoc(page, 'hs-a003', 'storeCode').locator('bdi[dir="ltr"]').innerText()) === '2001',
  )
  await page.locator('[data-order-details="hs-a001"]').click()
  const d1 = page.locator('dialog[open][data-order-drawer="hs-a001"]')
  await d1.locator('[data-order-lines]').waitFor({ timeout: 15000 })
  check('7: …nor in the drawer', (await d1.locator('[data-order-drawer-store-link]').count()) === 0 && (await d1.locator('[data-order-field="store"] dd').innerText()) === '1234')
  check('(no canManageStores): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  // 7: the drawer's store code is the 554 deep link — it opens the store's logs on the Stores page, even
  // for a store the list no longer holds (the Stores stub answers no rows: a removed store).
  const { context, page, errors } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/orders`)
  await waitRows(page, N)
  await page.locator('[data-order-details="hs-a001"]').click()
  const d1 = page.locator('dialog[open][data-order-drawer="hs-a001"]')
  await d1.locator('[data-order-lines]').waitFor({ timeout: 15000 })
  const link = d1.locator('[data-order-drawer-store-link="1234"]')
  check('7: 🚩 with canManageStores the drawer links the store code to its logs', (await link.getAttribute('href')) === '/hungerstation/stores?logs=1234' && (await link.locator('bdi[dir="ltr"]').innerText()) === '1234')
  await link.click()
  await page.waitForURL(/\/hungerstation\/stores\?logs=1234$/, { timeout: 15000 })
  await page.locator('dialog[open][data-hs-logs-drawer="1234"]').waitFor({ timeout: 15000 })
  check('7: …following it opens the logs drawer of a store the list does not hold', true)
  check('7 (store link): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: paging ───────────────────────────────────────────────────────────────────────────────
{
  const { context, page, lists } = await open('ltr', { many: true })
  await page.goto(`${BASE}/hungerstation/orders`)
  const status = page.locator('[data-status-count]')
  const statusReads = (text) => page.waitForFunction((t) => document.querySelector('[data-status-count]')?.textContent === t, text, { timeout: 20000 })
  await statusReads('Showing 1–100 of 250')
  await cellLoc(page, 'hs-a001', 'orderCode').waitFor({ timeout: 10000 })
  check('6: the bar says which part of the total shows', (await status.innerText()) === 'Showing 1–100 of 250')
  check('6: page 1 shows page 1’s rows', (await cell(page, 'hs-a001', 'orderCode')) === 'C-001' && (await cellLoc(page, 'hs-x094', 'orderCode').count()) === 0)
  check('6: Previous is disabled on the first page', await page.locator('[data-orders-previous]').isDisabled())
  await page.locator('[data-orders-next]').click()
  await page.waitForFunction(() => new URLSearchParams(location.search).get('skip') === '100')
  await statusReads('Showing 101–200 of 250')
  check('6: Next sends skip=100 and writes it to the URL', lastList(lists).get('skip') === '100' && lastList(lists).get('take') === '100', lists.at(-1))
  await cellLoc(page, 'hs-x094', 'orderCode').waitFor({ timeout: 10000 })
  check(
    '6: 🚩 page 2 shows DIFFERENT rows — the 101st order on, none of page 1’s',
    (await cell(page, 'hs-x094', 'orderCode')) === 'X-094' && (await cellLoc(page, 'hs-a001', 'orderCode').count()) === 0,
  )
  check('6: …and Next stays on (200 of 250)', !(await page.locator('[data-orders-next]').isDisabled()))
  await page.locator('[data-orders-previous]').click()
  await statusReads('Showing 1–100 of 250')
  await cellLoc(page, 'hs-a001', 'orderCode').waitFor({ timeout: 10000 })
  check('6: Previous goes back to page 1’s rows', (await cellLoc(page, 'hs-x094', 'orderCode').count()) === 0, lists.at(-1))
  await chip(page, 'failed')
  await page.waitForFunction(() => !new URLSearchParams(location.search).has('skip'))
  await waitRows(page, 2)
  check('6: a filter change starts again at the first page', lastList(lists).get('skip') === '0', lists.at(-1))
  await context.close()
}

// ── 7–9: the drawer, raw, retry ─────────────────────────────────────────────────────────────
{
  const { context, page, errors, lists, retries } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/orders`)
  await waitRows(page, N)

  // 7: lines with a replacement
  await page.locator('[data-order-details="hs-a006"]').click()
  const d6 = page.locator('dialog[open][data-order-drawer="hs-a006"]')
  await d6.locator('[data-order-lines] table').waitFor({ timeout: 15000 })
  check('7: the drawer is titled chain · order code', (await d6.locator('[data-order-title]').innerText()) === 'OlaCare · C-006')
  const order6 = await d6.locator('[data-order-line]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-line')))
  check('7: 🚩 the replacement is shown right after the line it replaced', JSON.stringify(order6) === JSON.stringify(['L1', 'L2', 'L9', 'L3']), order6.join())
  check('7: the replacement names the line it replaced', (await d6.locator('[data-order-line="L9"] [data-order-line-replaced-sku]').innerText()) === 'Replaces SKU-L2')
  check('7: HungerStation’s line status shows', (await d6.locator('[data-order-line="L2"] [data-order-line-status]').innerText()) === 'REPLACED' && (await d6.locator('[data-order-line="L9"] [data-order-line-status]').innerText()) === 'IN_CART')
  const lineText = await d6.locator('[data-order-line="L1"]').innerText()
  check('7: SKU, name, quantity, prices and discount in the ORDER’s currency, material', ['SKU-L1', 'Panadol 500mg 24 tabs', '2', '12.500 SAR', '25.000 SAR', '1.250 SAR', '101234'].every((v) => lineText.includes(v)), lineText)
  check('7: the fields: order id, vendor id, store, document, HungerStation status', (await d6.locator('[data-order-field="orderId"]').innerText()).includes('hs-a006') && (await d6.locator('[data-order-field="vendorId"]').innerText()).includes('abc12') && (await d6.locator('[data-order-field="document"]').innerText()).includes('45000006') && (await d6.locator('[data-order-field="hsStatus"]').innerText()).includes('RECEIVED'))
  check('7: Done run, error blank', (await d6.locator('[data-order-delivery="r-6001"] [data-order-run-label]').innerText()) === 'Done' && (await d6.locator('[data-order-delivery="r-6001"] [data-order-run-error]').innerText()) === '')
  check('9: no Retry in the drawer of an order that is not retryable', (await d6.locator('[data-order-drawer-retry]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-drawer-lines.png` })
  await page.keyboard.press('Escape')
  await d6.waitFor({ state: 'detached' })

  // 7: deliveries oldest first, a null run, a stopped run
  await page.locator('[data-order-details="hs-a002"]').click()
  const d2 = page.locator('dialog[open][data-order-drawer="hs-a002"]')
  await d2.locator('[data-order-deliveries] table').waitFor({ timeout: 15000 })
  const delOrder = await d2.locator('[data-order-delivery]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-delivery')))
  check('7: 🚩 deliveries oldest first', JSON.stringify(delOrder) === JSON.stringify(['r-2001', 'r-2002']), delOrder.join())
  check('7: a null run reads "intake failed before a run was written"', (await d2.locator('[data-order-delivery="r-2001"] [data-order-run-label]').innerText()) === 'Intake failed before a run was written')
  const f = d2.locator('[data-order-delivery="r-2002"]')
  check('7: a stopped run: Stopped, attempts, last attempt, its error, no next attempt', (await f.locator('[data-order-run-label]').innerText()) === 'Stopped' && (await f.locator('[data-order-run-attempts]').innerText()) === '5' && (await f.locator('[data-order-run-last]').innerText()) === '2026-10-24 10:40' && (await f.locator('[data-order-run-error]').innerText()) === 'Material 101 is not on the HungerStation list' && (await f.locator('[data-order-run-next]').innerText()) === '')
  check('7: the reason and the outcome show', (await d2.locator('[data-order-field="reason"]').innerText()).includes('Material 101') && (await d2.locator('[data-order-field="outcome"]').innerText()).includes('Failed'))
  check('9: Retry is offered in the drawer of a retryable order', (await d2.locator('[data-order-drawer-retry]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/ltr-drawer-deliveries.png` })

  // 8: raw over the drawer
  await f.locator('[data-order-raw="r-2002"]').click()
  const raw = page.locator('dialog[open][data-raw-drawer="r-2002"]')
  await raw.locator('[data-raw-body]').waitFor({ timeout: 15000 })
  const formatted = await raw.locator('[data-raw-body]').innerText()
  check('8: raw opens over the drawer, pretty-printed from the JSON string', (await raw.locator('[data-raw-body]').getAttribute('data-raw-body')) === 'formatted' && formatted.includes('\n  "order": {\n    "code": "C-002",'), formatted.slice(0, 80))
  check('8: 🚩 values untouched — 1.10 and the \\u escapes as sent', formatted.includes('"price": 1.10') && formatted.includes('"\\u0628\\u0646'), formatted)
  check('8: received at shows; read only', (await raw.locator('[data-raw-received-at]').innerText()).includes('2026-10-24 09:20') && (await raw.locator('textarea, input').count()) === 0)
  await raw.locator('[data-raw-verbatim]').click()
  check('8: "As received" shows the body verbatim', (await raw.locator('[data-raw-body]').innerText()) === RAW_BODY)
  await raw.locator('[data-raw-copy]').click()
  await page.getByText('Raw body copied').waitFor({ timeout: 15000 })
  check('8: Copy puts the verbatim body on the clipboard', (await page.evaluate(() => navigator.clipboard.readText())) === RAW_BODY)
  await page.screenshot({ path: `${SHOTS}/ltr-raw.png` })
  await page.keyboard.press('Escape')
  await raw.waitFor({ state: 'detached' })
  check('8: Escape closes the raw view and leaves the drawer', (await d2.count()) === 1)
  await d2.locator('[data-order-raw="r-2001"]').click()
  const raw1 = page.locator('dialog[open][data-raw-drawer="r-2001"]')
  await raw1.locator('[data-raw-body]').waitFor({ timeout: 15000 })
  check('8: a body that is not JSON is shown exactly as received', (await raw1.locator('[data-raw-body]').innerText()) === 'not json — truncated webhook' && /not valid JSON/.test(await raw1.locator('[data-raw-note]').innerText()))
  await page.keyboard.press('Escape')
  await raw1.waitFor({ state: 'detached' })

  // 9: retry from the drawer — reason required, latest-run note, DHS-00008, then success
  await d2.locator('[data-order-drawer-retry]').click()
  const dialog = page.locator('dialog[open]:has([data-retry-dialog="hs-a002"])')
  await dialog.waitFor({ timeout: 15000 })
  check('9: the retry says it re-runs the latest run only', /latest run only/.test(await dialog.locator('[data-reason-note]').innerText()))
  check('9: Confirm waits for a reason', (await dialog.locator('[data-reason-confirm]').isDisabled()) && retries.length === 0)
  await confirmWith(dialog, 'trigger 00008')
  await dialog.locator('[data-inline-refusal="DHS-00008"]').waitFor({ timeout: 15000 })
  check('9: DHS-00008 shows under the reason, the dialog open', (await dialog.count()) === 1)
  const listsBefore = lists.length
  await confirmWith(dialog, '  Material added to the list  ')
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  check('9: it POSTs to Orders/{id}/Retry with { reason } trimmed', retries.at(-1).id === 'hs-a002' && JSON.stringify(retries.at(-1).body) === JSON.stringify({ reason: 'Material added to the list' }), JSON.stringify(retries.at(-1)))
  await page.getByText('Retry queued').waitFor({ timeout: 15000 })
  await page.keyboard.press('Escape')
  await d2.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.querySelector('[data-orders-grid] .ag-row[row-id="hs-a002"] [col-id="outcome"]')?.textContent?.trim() === 'Pending', null, { timeout: 10000 })
  check('9: 🚩 the list is read again and the row reads Pending, Retry gone', lists.length > listsBefore && (await cell(page, 'hs-a002', 'outcome')) === 'Pending' && (await page.locator('[data-order-retry="hs-a002"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-retried.png` })

  // 9: DHS-00012 from the grid — inline, and the row refreshed
  await page.locator('[data-order-retry="hs-a007"]').click()
  const d7 = page.locator('dialog[open]:has([data-retry-dialog="hs-a007"])')
  await d7.waitFor({ timeout: 15000 })
  await confirmWith(d7, 'Retry after SAP fix')
  const r12 = d7.locator('[data-retry-refusal="DHS-00012"]')
  await r12.waitFor({ timeout: 15000 })
  check('9: DHS-00012 shows inline with the server’s words, the dialog open', (await r12.locator('[data-inline-refusal="DHS-00012"] bdi:not([dir])').innerText()) === REFUSALS['DHS-00012'][1] && /no longer failed/.test(await r12.innerText()))
  check('9: DHS-00012 is not shown a second time as a banner', (await d7.locator('[data-reason-error]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-retry-00012.png` })
  await page.waitForFunction(() => document.querySelector('[data-orders-grid] .ag-row[row-id="hs-a007"] [col-id="outcome"]')?.textContent?.trim() === 'Created', null, { timeout: 10000 })
  check('9: …and the row is refreshed (now Created, its document shown)', (await cell(page, 'hs-a007', 'documentNumber')) === '4500077')
  await d7.locator('[data-reason-cancel]').click()
  await d7.waitFor({ state: 'detached' })

  check('9 (setup): no retryable row left after the two retries', (await page.locator('[data-orders-grid] [data-order-retry]').count()) === 0)
  check('7–9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  // 9: DHS-00011 inline; 7: an unmatched order leads with its alert; a refused detail read
  const { context, page, errors } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/orders`)
  await waitRows(page, N)
  await page.locator('[data-order-retry="hs-a002"]').click()
  const dialog = page.locator('dialog[open]:has([data-retry-dialog="hs-a002"])')
  await dialog.waitFor({ timeout: 15000 })
  await confirmWith(dialog, 'trigger 00011')
  await dialog.locator('[data-retry-refusal="DHS-00011"]').waitFor({ timeout: 15000 })
  check('9: DHS-00011 shows inline', /No such HungerStation order/.test(await dialog.locator('[data-retry-refusal="DHS-00011"]').innerText()) && (await dialog.locator('[data-reason-error]').count()) === 0)
  await dialog.locator('[data-reason-cancel]').click()
  await dialog.waitFor({ state: 'detached' })

  await page.locator('[data-order-details="hs-a005"]').click()
  const d5 = page.locator('dialog[open][data-order-drawer="hs-a005"]')
  await d5.locator('[data-order-lines] table').waitFor({ timeout: 15000 })
  check('7: an unmatched order leads with its alert, naming onboard / revive', /no onboarded store/.test(await d5.locator('[data-order-alert="unmatched"]').innerText()) && /revive/.test(await d5.locator('[data-order-alert="unmatched"]').innerText()))
  check('7: …with the Stores link, and no Retry', (await d5.locator('[data-order-drawer-stores-link]').getAttribute('href')) === '/hungerstation/stores?q=zz999' && (await d5.locator('[data-order-drawer-retry]').count()) === 0)
  check('7: a null store and document are blank in the drawer', (await d5.locator('[data-order-field="store"] dd').innerText()) === '' && (await d5.locator('[data-order-field="document"] dd').innerText()) === '')
  await page.screenshot({ path: `${SHOTS}/ltr-drawer-unmatched.png` })
  await page.keyboard.press('Escape')
  await d5.waitFor({ state: 'detached' })

  await page.locator('[data-order-details="hs-a004"]').click()
  const d4 = page.locator('dialog[open][data-order-drawer="hs-a004"]')
  await d4.locator('[data-order-deliveries] table').waitFor({ timeout: 15000 })
  const w = d4.locator('[data-order-delivery="r-4001"]')
  check('7: a waiting run: Waiting, its next attempt, its last error', (await w.locator('[data-order-run-label]').innerText()) === 'Waiting' && (await w.locator('[data-order-run-next]').innerText()) === '2026-10-24 11:05' && (await w.locator('[data-order-run-error]').innerText()) === 'SAP timeout')
  await page.keyboard.press('Escape')
  await d4.waitFor({ state: 'detached' })

  await page.locator('[data-order-details="hs-a003"]').click()
  await page.locator('dialog[open][data-order-drawer="hs-a003"] [data-order-error="DHS-00011"]').waitFor({ timeout: 15000 })
  check('7: a refused detail read shows its code', /DHS-00011/.test(await page.locator('[data-order-error]').innerText()))
  await page.keyboard.press('Escape')
  check('7–9 (b): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: RTL ─────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, retries } = await open('rtl')
  await page.goto(`${BASE}/hungerstation/orders`)
  await waitRows(page, N)
  check('10: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  // ⚠️ `oms.locale=ar` sets the DIRECTION only (core/i18n.ts keeps `lng: en`), so the copy is English
  // under RTL. The Arabic bundle is proven by its registration and the vitest mirror test.
  check('10: the count isolates its number', (await page.locator('[data-status-count] bdi[dir="ltr"]').innerText()) === '7')
  const isolatedCodes = () => page.evaluate(() => [...document.querySelectorAll('[data-orders-grid] [col-id="orderCode"] bdi')].map((b) => b.textContent))
  await page.waitForFunction(() => document.querySelectorAll('[data-orders-grid] [col-id="orderCode"] bdi').length === 7, null, { timeout: 15000 }).catch(() => {})
  const codes = await isolatedCodes()
  check('10: grid values are isolated by the core base (a <bdi> per cell)', codes.includes('C-001') && codes.length === 7, codes.join())
  const unmatchedBg = await painted(page, 'hs-a005')
  check('10: the unmatched row still paints under RTL', unmatchedBg !== (await painted(page, 'hs-a001')))
  await page.screenshot({ path: `${SHOTS}/rtl-list.png` })
  await page.locator('[data-order-details="hs-a006"]').click()
  const d6 = page.locator('dialog[open][data-order-drawer="hs-a006"]')
  await d6.locator('[data-order-lines] table').waitFor({ timeout: 15000 })
  check('10: the title pair is one isolate', (await d6.locator('[data-order-title] bdi[dir="ltr"]').innerText()) === 'OlaCare · C-006')
  const iso = await d6.locator('[data-order-line="L1"] bdi[dir="ltr"]').allInnerTexts()
  check('10: a line’s machine values are isolated whole (money with its currency)', ['SKU-L1', '2', '12.500 SAR', '25.000 SAR', '1.250 SAR', '101234', 'IN_CART'].every((v) => iso.includes(v)), iso.join(' | '))
  check('10: a line’s name is free text (bdi, direction auto)', (await d6.locator('[data-order-line="L2"] bdi:not([dir])').first().innerText()) === 'بنادول أطفال')
  check('10: the replaced SKU is isolated inside its sentence', (await d6.locator('[data-order-line="L9"] [data-order-line-replaced-sku] bdi[dir="ltr"]').innerText()) === 'SKU-L2')
  await page.screenshot({ path: `${SHOTS}/rtl-drawer.png` })
  await page.keyboard.press('Escape')
  await d6.waitFor({ state: 'detached' })
  await page.locator('[data-order-details="hs-a002"]').click()
  const d2 = page.locator('dialog[open][data-order-drawer="hs-a002"]')
  await d2.locator('[data-order-raw="r-2002"]').click()
  const raw = page.locator('dialog[open][data-raw-drawer="r-2002"]')
  await raw.locator('[data-raw-body]').waitFor({ timeout: 15000 })
  check('10: the raw body is ONE ltr island', (await raw.locator('pre[dir="ltr"][data-raw-body]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/rtl-raw.png` })
  await page.keyboard.press('Escape')
  await raw.waitFor({ state: 'detached' })
  await d2.locator('[data-order-drawer-retry]').click()
  const dialog = page.locator('dialog[open]:has([data-retry-dialog="hs-a002"])')
  await dialog.waitFor({ timeout: 15000 })
  check('10: the retry note isolates the order code', (await dialog.locator('[data-reason-note] bdi[dir="ltr"]').innerText()) === 'C-002')
  await page.screenshot({ path: `${SHOTS}/rtl-retry.png` })
  await confirmWith(dialog, 'سبب')
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  check('10: retry works under RTL', retries.at(-1)?.id === 'hs-a002' && retries.at(-1).body.reason === 'سبب')
  check('10: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
