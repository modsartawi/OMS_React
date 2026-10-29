// HungerStation promotions drive (oms-react 665–671, BackOffice spec 3201).
//
// Drives the REAL app in Chromium against STUBS of the HungerStation promotion doors. 🚩 The door
// contract asset (C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md)
// does not exist yet and no door is built (BackOffice 3211–3216), so the shapes are the provisional
// ones in src/core/models/hungerstation.ts § Promotions — and this drive PROVES its fixtures emit
// exactly those fields (§ 0), so the day the contract lands, one diff of that file re-checks both.
// Every answer rides the REAL envelope { statusCode, success, message, errors: [{ errorCode,
// internalErrorCode, errorMessage }], data }; a missing grant is a BARE 403 (no envelope).
//
// ── Extending it (666–671) ───────────────────────────────────────────────────────────────────────
// The stub server is the `DOORS` table: ONE entry per door of spec 3201 § Doors, in one place. A
// later ticket fills in its door's `handle` (the write doors answer 501 `NOT_STUBBED` until then, so
// an unexpected call fails loudly) and adds its scenario as a new numbered block at the bottom. A
// scenario bends a door without editing the table by passing `open(dir, { doors: { send: (ctx, m,
// req) => … } })`. Every call lands in `ctx.calls` as { door, method, path, query, body }.
// Fixture builders (`row`, `detail`, `part`, `store`, `item`, `send`) take overrides.
//
// Ticket 669 (§ 6) asserts, LTR and RTL: a partly refused detail lists the three refusals per store
// (counted, filtered by store, copied as filtered); the 24-hour part reads "No answer from
// HungerStation" with its hint; HungerStation's own times show local; Resend sends { reason } to
// …/Parts/{partId}/Resend, then the part reads Sending, its Resend is disabled and the sheet re-reads
// itself every 15 s until the part is answered (Sending → Live); DHS-00017 stays in the dialog.
//
// Ticket 665 asserts, with the browser in Asia/Riyadh at 2026-10-29 11:00 local:
//   0. every fixture's keys are EXACTLY the fields of its model interface (none invented, none missing);
//   1. the Promotions leaf rides canManagePromotions on the ONE probe; without it the leaf is hidden
//      and the URL shows the denied card with NO Promotions call;
//   2. the list: a bare URL sends skip=0&take=100; every column; the nine statuses in words and an
//      unknown one shown as itself; the type in words; the window one range;
//   3. filters ⇄ URL ⇄ door: chain, type, repeated status, name text on Search; a pasted URL drives
//      the door; Clear resets; paging sends skip=100;
//   4. the detail opens from Details (URL gains ?promotion=) and from a pasted URL; header, parts (name
//      sent + latest job status), stores (code, name, vendor id as sent), items (material, SKU,
//      subtype, value, max qty, part), sends (when, who, reason, HTTP, job status, newest first);
//      closing drops ?promotion=; a DHS-00016 reads "no such promotion"; a draft shows no parts/sends;
//   5. under RTL (direction only — `lng` stays `en` app-wide) machine values are isolated whole.
//
//   1. run the app:  npx vite --port 5265 --strictPort
//   2. DRIVE_PORT=5265 node tools/hungerstation-promotions-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.hungerstation-promotions-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// ── The envelope ───────────────────────────────────────────────────────────────────────────────

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
/** A missing grant: a BARE 403, no envelope. */
const bare403 = { status: 403, contentType: 'text/plain', body: '' }

/** Every refusal the doors name, `<English> / <Arabic>`. Later tickets add theirs here. */
const REFUSALS = {
  'DHS-00008': [400, 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'],
  'DHS-00016': [404, 'No such HungerStation promotion. / لا يوجد عرض ترويجي لهنقرستيشن بهذا المعرّف.'],
  'DHS-00017': [409, 'A part of the promotion is still sending. / جزء من العرض ما زال قيد الإرسال.'],
  NOT_STUBBED: [501, 'This door is not stubbed in the drive yet.'],
}
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

// ── Fixtures: one builder per model interface, each emitting EXACTLY its fields ────────────────

const row = (promotionId, over = {}) => ({
  promotionId,
  chainKey: 'OlaCare',
  name: `Promotion ${promotionId}`,
  type: 'STRIKETHROUGH',
  status: 'live',
  startAt: '2026-11-01T00:00:00',
  endAt: '2026-11-30T23:59:00',
  storeCount: 42,
  skuCount: 1000,
  lastSentAt: '2026-10-28T09:30:00',
  lastSentBy: 'msartawi',
  ...over,
})

const part = (partId, over = {}) => ({
  buyQuantity: null,
  getQuantity: null,
  subtype: null,
  value: null,
  partId,
  name: 'Ramadan',
  active: true,
  skuCount: 3,
  latestJobStatus: 'COMPLETED',
  unanswered: false,
  refusals: { invalidVendors: [], missingSkus: [], invalidDiscountedSkus: [] },
  ...over,
})

const store = (storeCode, over = {}) => ({ storeCode, storeName: `صيدلية ${storeCode}`, vendorId: `v-${storeCode}`, ...over })

const item = (materialNumber, over = {}) => ({
  itemId: `it-${materialNumber}`,
  materialNumber,
  sku: `SKU-${materialNumber}`,
  subtype: 'PERCENTAGE',
  value: 20,
  maxQuantity: null,
  buyQuantity: null,
  getQuantity: null,
  partId: 'pt-1',
  active: true,
  ...over,
})

const send = (sendId, over = {}) => ({
  sendId,
  partId: 'pt-1',
  kind: 'upsert',
  sentAt: '2026-10-28T09:30:00',
  sentBy: 'msartawi',
  reason: 'Ramadan launch',
  httpStatus: 202,
  jobId: `job-${sendId}`,
  jobStatus: 'COMPLETED',
  hsCreatedAt: '2026-10-28T09:30:02',
  hsUpdatedAt: '2026-10-28T09:31:40',
  pollAttempts: 2,
  lastPolledAt: '2026-10-28T09:31:40',
  unanswered: false,
  error: null,
  ...over,
})

const detail = (r, over = {}) => ({
  promotionId: r.promotionId,
  chainKey: r.chainKey,
  name: r.name,
  displayNameEn: `${r.name} — up to 20% off`,
  displayNameAr: 'خصم حتى ٢٠٪',
  type: r.type,
  hsReason: 'COMPETITIVENESS',
  startAt: r.startAt,
  endAt: r.endAt,
  orderLimit: null,
  globalLimit: null,
  defaultSubtype: 'PERCENTAGE',
  defaultValue: 20,
  status: r.status,
  allStores: false,
  replacesId: null,
  replacedById: null,
  createdAt: '2026-10-27T14:00:00',
  createdBy: 'msartawi',
  updatedAt: '2026-10-28T09:29:00',
  updatedBy: 'msartawi',
  sentAt: r.lastSentAt,
  sentBy: r.lastSentBy,
  switchedOffAt: null,
  switchedOffBy: null,
  switchedOffReason: null,
  parts: [part('pt-1', { name: r.name })],
  stores: [store('1001'), store('1002')],
  items: [item('101001'), item('101002'), item('101003')],
  sends: [send('s-1')],
  ...over,
})

const STATUSES = ['draft', 'sending', 'live', 'livePartlyRefused', 'failed', 'switchedOff', 'replaced', 'scheduled', 'ended']
const STATUS_WORDS = ['Draft', 'Sending', 'Live', 'Live with refusals', 'Failed', 'Switched off', 'Replaced', 'Scheduled', 'Ended']

/** One row per status, a bundle, two chains, and one status the contract does not name. */
const freshRows = () => [
  row('p-live', { name: 'Ramadan', status: 'live' }),
  row('p-refused', { name: 'Eid B2G1', type: 'SAME_ITEM_BUNDLE', status: 'livePartlyRefused', skuCount: 4, storeCount: 3 }),
  row('p-draft', { name: 'Winter draft', status: 'draft', lastSentAt: null, lastSentBy: null }),
  row('p-sending', { name: 'Flu season', status: 'sending' }),
  row('p-failed', { name: 'Vitamins', status: 'failed' }),
  row('p-off', { name: 'Back to school', status: 'switchedOff' }),
  row('p-replaced', { name: 'Summer v1', status: 'replaced' }),
  row('p-scheduled', { name: 'National Day', status: 'scheduled', chainKey: 'AlDawaa', startAt: '2026-12-01T00:00:00', endAt: '2026-12-02T23:59:00' }),
  row('p-ended', { name: 'Hajj', status: 'ended', startAt: '2026-06-01T00:00:00', endAt: '2026-06-10T23:59:00' }),
  row('p-unknown', { name: 'Mystery', status: 'paused' }),
]

/** The details the drive opens; any other row reads its default detail. */
const DETAILS = {
  'p-refused': (r) =>
    detail(r, {
      displayNameAr: 'اشترِ ٢ واحصل على ١',
      hsReason: 'OVERSTOCK',
      orderLimit: 2,
      globalLimit: 5000,
      parts: [
        part('pt-a', { name: 'Eid B2G1 · B2G1 50%', buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE', value: 50, skuCount: 2 }),
        part('pt-b', {
          name: 'Eid B2G1 · B3G1 5SAR',
          buyQuantity: 3,
          getQuantity: 1,
          subtype: 'ABSOLUTE',
          value: 5,
          skuCount: 1,
          latestJobStatus: 'QUEUED',
          unanswered: true,
          refusals: null,
        }),
      ],
      stores: [store('1001'), store('1002', { storeName: '' }), store('2001', { vendorId: 'hs-77821' })],
      items: [
        item('201001', { partId: 'pt-a', subtype: 'PERCENTAGE', value: 50, buyQuantity: 2, getQuantity: 1, maxQuantity: 6 }),
        item('201002', { partId: 'pt-a', subtype: 'PERCENTAGE', value: 50, buyQuantity: 2, getQuantity: 1 }),
        item('201003', { partId: 'pt-b', subtype: 'ABSOLUTE', value: 5, buyQuantity: 3, getQuantity: 1 }),
        item('201004', { partId: 'pt-b', subtype: 'ABSOLUTE', value: 5, buyQuantity: 3, getQuantity: 1, active: false }),
      ],
      // Given OLDEST first: the sheet must show them newest first.
      sends: [
        send('s-a1', { partId: 'pt-a', sentAt: '2026-10-28T09:30:00', reason: 'إطلاق العيد' }),
        send('s-b1', { partId: 'pt-b', sentAt: '2026-10-28T09:30:05', httpStatus: 202, jobStatus: 'QUEUED', unanswered: true, hsUpdatedAt: null }),
        send('s-b0', { partId: 'pt-b', sentAt: '2026-10-28T10:15:00', sentBy: 'aalharbi', httpStatus: 503, jobId: null, jobStatus: null, error: 'HungerStation unavailable' }),
      ],
    }),
  'p-draft': (r) => detail(r, { allStores: true, parts: [], stores: [], sends: [], items: [item('301001', { sku: null, partId: null })], sentAt: null, sentBy: null }),
}
const detailOf = (r) => (DETAILS[r.promotionId] ?? detail)(r)

/** 245 more live rows, so the list pages past the first 100. */
const extraRows = () => Array.from({ length: 245 }, (_, i) => row(`p-x${String(i + 1).padStart(3, '0')}`, { name: `Bulk ${String(i + 1).padStart(3, '0')}` }))

function listAnswer(qs, rows) {
  const statuses = qs.getAll('status')
  const chain = qs.get('chain')
  const type = qs.get('type')
  const q = (qs.get('q') ?? '').toLowerCase()
  const store = qs.get('store')
  const hits = rows.filter(
    (r) =>
      (!statuses.length || statuses.includes(r.status)) &&
      (!chain || r.chainKey === chain) &&
      (!type || r.type === type) &&
      (!q || r.name.toLowerCase().includes(q)) &&
      (!store || detailOf(r).stores.some((s) => s.storeCode === store)),
  )
  const skip = Number(qs.get('skip') ?? 0)
  const take = Number(qs.get('take') ?? 100)
  return { total: hits.length, rows: hits.slice(skip, skip + take) }
}

const storeChoice = (s, syncActive = true) => ({ storeCode: s.storeCode, storeName: s.storeName, vendorId: s.vendorId, syncActive })

// ── The stub doors: ONE entry per door of spec 3201 § Doors ────────────────────────────────────
// `handle(ctx, m, req, url)` returns what `route.fulfill` takes. Order matters only where a path
// could match two patterns (`Stores` before `{id}`).

const P = 'HungerStationWeb/Promotions'
const notStubbed = () => refuse('NOT_STUBBED')
const findRow = (ctx, m) => ctx.rows.find((r) => r.promotionId === decodeURIComponent(m[1]))

const DOORS = [
  { door: 'list', method: 'GET', path: new RegExp(`^${P}$`), handle: (ctx, _m, _req, url) => envelope(listAnswer(url.searchParams, ctx.rows)) },
  {
    door: 'stores',
    method: 'GET',
    path: new RegExp(`^${P}/Stores$`),
    handle: () => envelope([storeChoice(store('1001')), storeChoice(store('1002'), false), storeChoice(store('2001'))]),
  },
  {
    door: 'read',
    method: 'GET',
    path: new RegExp(`^${P}/([^/]+)$`),
    handle: (ctx, m) => {
      const r = findRow(ctx, m)
      return r ? envelope(detailOf(r)) : refuse('DHS-00016')
    },
  },
  // 666: save a draft (create), save / 670: edit in place.
  { door: 'create', method: 'POST', path: new RegExp(`^${P}$`), handle: notStubbed },
  { door: 'save', method: 'PUT', path: new RegExp(`^${P}/([^/]+)$`), handle: notStubbed },
  // 667 / 668: the checks and the part preview.
  { door: 'check', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Check$`), handle: notStubbed },
  // 666: send and refresh.
  { door: 'send', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Send$`), handle: notStubbed },
  { door: 'refresh', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Refresh$`), handle: notStubbed },
  // 669: resend a part.
  { door: 'resend', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Parts/([^/]+)/Resend$`), handle: notStubbed },
  // 670: remove items.
  { door: 'removeItems', method: 'POST', path: new RegExp(`^${P}/([^/]+)/RemoveItems$`), handle: notStubbed },
  // 671: replace and switch off.
  { door: 'replace', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Replace$`), handle: notStubbed },
  { door: 'switchOff', method: 'POST', path: new RegExp(`^${P}/([^/]+)/SwitchOff$`), handle: notStubbed },
]

// ── § 0: fixtures emit exactly the model's fields ────────────────────────────────────────────

/** The field names of `interface <name>` in the model file, `extends` included. */
function modelFields(source, name) {
  const m = new RegExp(`export interface ${name}(?: extends ([\\w, ]+))? \\{([\\s\\S]*?)\\n\\}`).exec(source)
  if (!m) throw new Error(`no interface ${name}`)
  const own = [...m[2].matchAll(/^ {2}(\w+)\??:/gm)].map((f) => f[1])
  const inherited = (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean).flatMap((parent) => modelFields(source, parent))
  return [...inherited, ...own]
}
{
  const source = readFileSync('src/core/models/hungerstation.ts', 'utf8')
  const sameKeys = (name, obj) => {
    const want = modelFields(source, name).sort()
    const got = Object.keys(obj).sort()
    check(`0: ${name} fixture keys are exactly the model's`, JSON.stringify(want) === JSON.stringify(got), `model ${want.join(',')} | stub ${got.join(',')}`)
  }
  const r = freshRows()[1]
  const d = detailOf(r)
  sameKeys('HungerStationPromotionRow', r)
  sameKeys('HungerStationPromotionsPage', listAnswer(new URLSearchParams(), freshRows()))
  sameKeys('HungerStationPromotionDetail', d)
  sameKeys('HungerStationPromotionPart', d.parts[0])
  sameKeys('HungerStationPromotionRefusals', d.parts[0].refusals)
  sameKeys('HungerStationPromotionStore', d.stores[0])
  sameKeys('HungerStationPromotionItem', d.items[0])
  sameKeys('HungerStationPromotionSend', d.sends[0])
  sameKeys('HungerStationPromotionStoreChoice', storeChoice(store('1001')))
  sameKeys('HungerStationAccessResult', { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManagePromotions: true })
}

// ── The browser ──────────────────────────────────────────────────────────────────────────────

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManagePromotions: true }
const ELEVEN = new Date('2026-10-29T11:00:00+03:00')

const browser = await chromium.launch()

async function open(dir, { access = ALL, chains = 'ok', many = false, doors = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  await page.clock.setFixedTime(ELEVEN)
  const ctx = { rows: many ? [...freshRows(), ...extraRows()] : freshRows(), calls: [] }
  const errors = []
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
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'HungerStationWeb/Access') return route.fulfill(envelope(access))
    if (p === 'HungerStationWeb/Chains') return route.fulfill(chains === 'ok' ? envelope(['OlaCare', 'AlDawaa']) : bare403)
    for (const d of DOORS) {
      const m = req.method() === d.method ? d.path.exec(p) : null
      if (!m) continue
      let body = null
      try {
        body = req.postDataJSON()
      } catch {
        body = req.postData()
      }
      ctx.calls.push({ door: d.door, method: d.method, path: p, query: url.search.slice(1), body })
      if (!access.canManagePromotions) return route.fulfill(bare403)
      return route.fulfill(await (doors[d.door] ?? d.handle)(ctx, m, req, url))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, ctx }
}

const GRID = '[data-promotions-grid]'
const lists = (ctx) => ctx.calls.filter((c) => c.door === 'list').map((c) => c.query)

/** Wait until the grid holds `n` rows and has settled. */
const waitRows = async (page, n) => {
  await page
    .waitForFunction(
      (count) =>
        new Set([...document.querySelectorAll('[data-promotions-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size === count &&
        !document.querySelector('[data-promotions-grid] .ag-overlay-loading-center'),
      n,
      { timeout: 20000 },
    )
    .catch(async (e) => {
      const seen = await page.evaluate(() => document.querySelectorAll('[data-promotions-grid] .ag-row[row-index]').length)
      console.log(`waitRows(${n}) timed out at ${page.url()} — ${seen} row elements`)
      throw e
    })
  await page.waitForTimeout(150)
}
const cellLoc = (page, id, colId) => page.locator(`${GRID} .ag-row[row-id="${id}"] [col-id="${colId}"]`)
const cell = async (page, id, colId) => ((await cellLoc(page, id, colId).count()) ? (await cellLoc(page, id, colId).innerText()).trim() : null)
const search = (page) => new URL(page.url()).searchParams
const N = freshRows().length

const chip = async (page, s) => {
  const loc = page.locator(`[data-filter-status="${s}"]`)
  const was = await loc.getAttribute('aria-pressed')
  await loc.click()
  await page.waitForFunction(([sel, w]) => document.querySelector(sel)?.getAttribute('aria-pressed') !== w, [`[data-filter-status="${s}"]`, was])
}

// ── 1: the menu leaf and the gate ──────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  const leaf = page.locator('nav a[href="/hungerstation/promotions"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Promotions leaf shows with canManagePromotions', (await leaf.innerText()).includes('Promotions'))
  await leaf.click()
  await waitRows(page, N)
  check('1: the leaf opens the list', new URL(page.url()).pathname === '/hungerstation/promotions')
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, ctx } = await open('ltr', { access: { ...ALL, canManagePromotions: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/orders"]').first().waitFor({ timeout: 15000 })
  check('1: without canManagePromotions the leaf is hidden (the others stay)', (await page.locator('nav a[href="/hungerstation/promotions"]').count()) === 0)
  await page.goto(`${BASE}/hungerstation/promotions`)
  await page.getByText('No access to HungerStation promotions').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card, and NO promotions door is called', ctx.calls.length === 0, JSON.stringify(ctx.calls))
  await context.close()
}

// ── 2–3: the list, its filters and paging ──────────────────────────────────────────────────────
{
  const { context, page, errors, ctx } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/promotions`)
  await waitRows(page, N)
  check('2: a bare URL sends the first page of 100, no filter', lists(ctx)[0] === 'skip=0&take=100', lists(ctx)[0])
  const headers = await page.locator(`${GRID} .ag-header-cell-text`).allInnerTexts()
  const want = ['Name', 'Chain', 'Type', 'Status', 'Window', 'Stores', 'SKUs', 'Last sent at', 'Last sent by', 'Actions']
  check('2: every column of the ticket', JSON.stringify(headers) === JSON.stringify(want), headers.join(' | '))
  const words = []
  for (const s of STATUSES) words.push(await cell(page, freshRows().find((r) => r.status === s).promotionId, 'status'))
  check('2: the nine statuses in words', JSON.stringify(words) === JSON.stringify(STATUS_WORDS), words.join(' | '))
  check('2: a status the contract does not name is shown as itself', (await cell(page, 'p-unknown', 'status')) === 'paused')
  check('2: the type in words', (await cell(page, 'p-refused', 'type')) === 'Same-item bundle' && (await cell(page, 'p-live', 'type')) === 'Strikethrough')
  check('2: the window is the local start and end as ONE range', (await cell(page, 'p-live', 'window')) === '2026-11-01 00:00 – 2026-11-30 23:59', await cell(page, 'p-live', 'window'))
  check('2: store and SKU counts', (await cell(page, 'p-refused', 'storeCount')) === '3' && (await cell(page, 'p-refused', 'skuCount')) === '4')
  check('2: last sent at / by', (await cell(page, 'p-live', 'lastSentAt')) === '2026-10-28 09:30' && (await cell(page, 'p-live', 'lastSentBy')) === 'msartawi')
  check('2: a never-sent draft has no last send', (await cell(page, 'p-draft', 'lastSentAt')) === '' && (await cell(page, 'p-draft', 'lastSentBy')) === '')
  check('2: the count', (await page.locator('[data-status-count]').innerText()).trim() === `${N} promotions`)
  await page.screenshot({ path: `${SHOTS}/ltr-list.png` })

  // Chain.
  const chainOpts = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('3: the chain filter offers the Chains read', JSON.stringify(chainOpts) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), chainOpts.join())
  await page.locator('[data-filter-chain]').selectOption('AlDawaa')
  await waitRows(page, 1)
  check('3: chain → URL and door', search(page).get('chain') === 'AlDawaa' && lists(ctx).at(-1) === 'chain=AlDawaa&skip=0&take=100', lists(ctx).at(-1))
  await page.locator('[data-filter-chain]').selectOption('')
  await waitRows(page, N)

  // Type.
  await page.locator('[data-filter-type]').selectOption('SAME_ITEM_BUNDLE')
  await waitRows(page, 1)
  check('3: type → URL and door', search(page).get('type') === 'SAME_ITEM_BUNDLE' && lists(ctx).at(-1) === 'type=SAME_ITEM_BUNDLE&skip=0&take=100', lists(ctx).at(-1))
  await page.locator('[data-filter-type]').selectOption('')
  await waitRows(page, N)

  // Status, repeated.
  await chip(page, 'live')
  await waitRows(page, 1)
  await chip(page, 'livePartlyRefused')
  await waitRows(page, 2)
  check('3: status is a repeated key in the URL', JSON.stringify(search(page).getAll('status')) === JSON.stringify(['live', 'livePartlyRefused']), page.url())
  check('3: … and on the door', lists(ctx).at(-1) === 'status=live&status=livePartlyRefused&skip=0&take=100', lists(ctx).at(-1))
  await chip(page, 'live')
  await chip(page, 'livePartlyRefused')
  await waitRows(page, N)

  // Name text lands on Search only.
  await page.locator('[data-filter-q]').fill('eid')
  const before = lists(ctx).length
  await page.waitForTimeout(300)
  check('3: typing a name sends nothing', lists(ctx).length === before)
  await page.locator('[data-promotions-search]').click()
  await waitRows(page, 1)
  check('3: Search sends the name', search(page).get('q') === 'eid' && lists(ctx).at(-1) === 'q=eid&skip=0&take=100', lists(ctx).at(-1))

  // Clear.
  await page.locator('[data-promotions-clear]').click()
  await waitRows(page, N)
  check('3: Clear resets URL, box and door', search(page).toString() === '' && (await page.locator('[data-filter-q]').inputValue()) === '' && lists(ctx).at(-1) === 'skip=0&take=100')

  // A pasted URL drives the door and the controls.
  await page.goto(`${BASE}/hungerstation/promotions?chain=OlaCare&status=draft&status=ended&q=a`)
  await waitRows(page, 2)
  check('3: a pasted URL drives the door', lists(ctx).at(-1) === 'chain=OlaCare&status=draft&status=ended&q=a&skip=0&take=100', lists(ctx).at(-1))
  check(
    '3: … and the controls',
    (await page.locator('[data-filter-chain]').inputValue()) === 'OlaCare' &&
      (await page.locator('[data-filter-q]').inputValue()) === 'a' &&
      (await page.locator('[data-filter-status="draft"]').getAttribute('aria-pressed')) === 'true',
  )
  check('2–3: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, ctx } = await open('ltr', { many: true })
  await page.goto(`${BASE}/hungerstation/promotions`)
  const statusReads = (text) => page.waitForFunction((t) => document.querySelector('[data-status-count]')?.textContent === t, text, { timeout: 20000 })
  await statusReads('Showing 1–100 of 255')
  await cellLoc(page, 'p-live', 'name').waitFor({ timeout: 10000 })
  check('3: total > rows reads "Showing 1–100 of 255"', true)
  check('3: Previous is disabled on the first page', await page.locator('[data-promotions-previous]').isDisabled())
  await page.locator('[data-promotions-next]').click()
  await statusReads('Showing 101–200 of 255')
  check('3: Next sends skip=100 and keeps it in the URL', lists(ctx).at(-1) === 'skip=100&take=100' && search(page).get('skip') === '100', lists(ctx).at(-1))
  // Page 2 starts at the 91st extra row (10 fresh rows, then 245 extras).
  await cellLoc(page, 'p-x091', 'name').waitFor({ timeout: 10000 })
  check('3: … showing page 2’s rows', (await cell(page, 'p-x091', 'name')) === 'Bulk 091' && (await cellLoc(page, 'p-live', 'name').count()) === 0)
  await page.locator('[data-promotions-previous]').click()
  await statusReads('Showing 1–100 of 255')
  await cellLoc(page, 'p-live', 'name').waitFor({ timeout: 10000 })
  check('3: Previous goes back', search(page).get('skip') === null && (await cell(page, 'p-live', 'name')) === 'Ramadan')
  await context.close()
}

// ── 4: the detail ──────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, ctx } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/promotions?status=livePartlyRefused`)
  await waitRows(page, 1)
  await page.locator('[data-promotion-details="p-refused"]').click()
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-refused"]')
  await sheet.locator('[data-promotion-parts] table').waitFor({ timeout: 15000 })
  check('4: Details puts ?promotion= in the URL, keeping the filters', search(page).get('promotion') === 'p-refused' && search(page).get('status') === 'livePartlyRefused')
  check('4: the detail door was read', ctx.calls.some((c) => c.door === 'read' && c.path === 'HungerStationWeb/Promotions/p-refused'))
  const field = async (f) => (await sheet.locator(`[data-promotion-field="${f}"] dd`).innerText()).trim()
  check('4: header — name', (await sheet.locator('[data-promotion-title]').innerText()) === 'Eid B2G1')
  check('4: header — EN and AR display names', (await field('displayNameEn')) === 'Eid B2G1 — up to 20% off' && (await field('displayNameAr')) === 'اشترِ ٢ واحصل على ١')
  check('4: header — HungerStation reason in words', (await field('hsReason')) === 'Overstock')
  check('4: header — limits', (await field('orderLimit')) === '2' && (await field('globalLimit')) === '5,000')
  check('4: header — window', (await field('window')) === '2026-11-01 00:00 – 2026-11-30 23:59', await field('window'))
  check('4: header — status', (await field('status')) === 'Live with refusals')
  check('4: header — type, chain, default discount', (await field('type')) === 'Same-item bundle' && (await field('chain')) === 'OlaCare' && (await field('defaultDiscount')).includes('20%'))
  check('4: header — created by and at', (await field('created')) === '2026-10-27 14:00 by msartawi', await field('created'))

  const partText = async (id, f) => (await sheet.locator(`[data-promotion-part="${id}"] [data-promotion-part-${f}]`).innerText()).replace(/\s+/g, ' ').trim()
  check('4: parts — one row per part', (await sheet.locator('[data-promotion-part]').count()) === 2)
  check('4: parts — the name sent to HungerStation', (await partText('pt-a', 'name')) === 'Eid B2G1 · B2G1 50%' && (await partText('pt-b', 'name')) === 'Eid B2G1 · B3G1 5SAR')
  check('4: parts — buy/get and discount', (await partText('pt-a', 'combination')) === 'B2G1' && (await partText('pt-b', 'discount')) === 'Amount off 5.000 SAR', await partText('pt-b', 'discount'))
  check('4: parts — latest job status (Completed; a 24h-queued one "No answer from HungerStation", 669)', (await partText('pt-a', 'status')) === 'Completed' && (await partText('pt-b', 'status')).startsWith('No answer from HungerStation'), await partText('pt-b', 'status'))

  const storeRows = await sheet.locator('[data-promotion-store]').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('td')].map((td) => td.textContent.trim())))
  check(
    '4: stores — code, name, vendor id as sent',
    JSON.stringify(storeRows) === JSON.stringify([['1001', 'صيدلية 1001', 'v-1001'], ['1002', '', 'v-1002'], ['2001', 'صيدلية 2001', 'hs-77821']]),
    JSON.stringify(storeRows),
  )

  const itemRows = await sheet.locator('[data-promotion-item]').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('td')].map((td) => td.textContent.trim())))
  check(
    '4: items — material, SKU, subtype, value, max qty, buy, get, part, state',
    JSON.stringify(itemRows[0]) === JSON.stringify(['201001', 'SKU-201001', 'Percentage off', '50%', '6', '2', '1', 'Eid B2G1 · B2G1 50%', 'Active']),
    JSON.stringify(itemRows[0]),
  )
  check('4: items — a removed item stays, read as Removed', JSON.stringify(itemRows[3]?.slice(-2)) === JSON.stringify(['Eid B2G1 · B3G1 5SAR', 'Removed']), JSON.stringify(itemRows[3]))
  check('4: items — an amount reads with SAR at 3 decimals, no max qty blank', itemRows[2]?.[3] === '5.000 SAR' && itemRows[2]?.[4] === '')

  const sendRows = await sheet.locator('[data-promotion-send]').evaluateAll((els) => els.map((e) => e.getAttribute('data-promotion-send')))
  check('4: sends — newest first', JSON.stringify(sendRows) === JSON.stringify(['s-b0', 's-b1', 's-a1']), sendRows.join())
  const sendCells = await sheet.locator('[data-promotion-send="s-b0"] td').allInnerTexts()
  check(
    '4: sends — when, who, reason, what, part, HTTP, job id, job status, error',
    JSON.stringify(sendCells.map((s) => s.trim())) ===
      JSON.stringify(['2026-10-28 10:15', 'aalharbi', 'Ramadan launch', 'Send', 'Eid B2G1 · B3G1 5SAR', '503', '', 'Not sent', 'HungerStation unavailable', '2026-10-28 09:30', '2026-10-28 09:31']),
    sendCells.join(' | '),
  )
  check('4: sends — HTTP 202 and the job status of an answered send', (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-http]').innerText()) === '202' && (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-status]').innerText()) === 'Completed')
  await page.screenshot({ path: `${SHOTS}/ltr-detail.png` })

  await page.locator('[data-promotion-close]').click()
  await sheet.waitFor({ state: 'detached', timeout: 10000 })
  check('4: closing drops ?promotion= and keeps the filters', search(page).get('promotion') === null && search(page).get('status') === 'livePartlyRefused')

  // A pasted URL opens the promotion.
  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-draft`)
  const draft = page.locator('dialog[open][data-promotion-sheet="p-draft"]')
  await draft.locator('[data-promotion-items] table').waitFor({ timeout: 15000 })
  check('4: a pasted ?promotion= opens it', (await draft.locator('[data-promotion-title]').innerText()) === 'Winter draft')
  check('4: a draft has no parts and no sends yet, says so', (await draft.locator('[data-promotion-parts]').innerText()).includes('parts are made when the promotion is sent') && (await draft.locator('[data-promotion-sends]').innerText()).includes('Never sent.'))
  check('4: a draft on all stores says so', (await draft.locator('[data-promotion-field="storesScope"] dd').innerText()).includes("All the chain's stores"))
  check('4: a draft item has no SKU and no part yet', (await draft.locator('[data-promotion-item="301001"] [data-promotion-item-sku]').innerText()) === '' && (await draft.locator('[data-promotion-item="301001"] [data-promotion-item-part]').innerText()) === '')

  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-gone`)
  const gone = page.locator('dialog[open][data-promotion-sheet="p-gone"] [data-promotion-error="DHS-00016"]')
  await gone.waitFor({ timeout: 15000 })
  check('4: DHS-00016 reads "no such promotion", with its code', (await gone.innerText()).includes('There is no such HungerStation promotion.') && (await gone.innerText()).includes('DHS-00016'))
  check('4: only read doors were called', ctx.calls.every((c) => c.door === 'list' || c.door === 'read'), [...new Set(ctx.calls.map((c) => c.door))].join())
  check('4: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: RTL ───────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('rtl')
  await page.goto(`${BASE}/hungerstation/promotions`)
  await waitRows(page, N)
  check('5: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('5: the count isolates its number', (await page.locator('[data-status-count] bdi[dir="ltr"]').innerText()) === String(N))
  const windows = await page.evaluate(() => [...document.querySelectorAll('[data-promotions-grid] [col-id="window"] bdi')].map((b) => b.textContent))
  check('5: the window cell is ONE isolate (the core base), not one per end', windows.includes('2026-11-01 00:00 – 2026-11-30 23:59'), windows.slice(0, 2).join(' | '))
  check('5: an unknown status is isolated inside its badge', (await cellLoc(page, 'p-unknown', 'status').locator('bdi[dir="ltr"]').innerText()) === 'paused')
  await page.screenshot({ path: `${SHOTS}/rtl-list.png` })
  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-refused`)
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-refused"]')
  await sheet.locator('[data-promotion-parts] table').waitFor({ timeout: 15000 })
  check('5: the header window is ONE ltr isolate', (await sheet.locator('[data-promotion-field="window"] bdi[dir="ltr"]').allInnerTexts()).join('|') === '2026-11-01 00:00 – 2026-11-30 23:59')
  check('5: display names are free text (bdi, direction auto)', (await sheet.locator('[data-promotion-field="displayNameAr"] bdi:not([dir])').innerText()) === 'اشترِ ٢ واحصل على ١')
  check('5: a part name is free text; its buy/get a machine value', (await sheet.locator('[data-promotion-part="pt-a"] [data-promotion-part-name] bdi:not([dir])').innerText()) === 'Eid B2G1 · B2G1 50%' && (await sheet.locator('[data-promotion-part="pt-a"] [data-promotion-part-combination] bdi[dir="ltr"]').innerText()) === 'B2G1')
  check('5: a vendor id as sent is isolated', (await sheet.locator('[data-promotion-store="2001"] [data-promotion-store-vendor] bdi[dir="ltr"]').innerText()) === 'hs-77821')
  check('5: a money value is ONE isolate with its currency', (await sheet.locator('[data-promotion-item="201003"] [data-promotion-item-value] bdi[dir="ltr"]').innerText()) === '5.000 SAR')
  check('5: the created by-at sentence isolates the time and the user apart (words carry the order)', JSON.stringify(await sheet.locator('[data-promotion-field="created"] bdi[dir="ltr"]').allInnerTexts()) === JSON.stringify(['2026-10-27 14:00', 'msartawi']))
  check('5: an Arabic send reason is free text', (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-reason] bdi:not([dir])').innerText()) === 'إطلاق العيد')
  await page.screenshot({ path: `${SHOTS}/rtl-detail.png` })
  check('5: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ══ 666: the strikethrough editor, Save draft, Send, Refresh ══════════════════════════════════════
// Its own section (669 builds beside it): the write doors are filled HERE, as `open(…, { doors })`
// overrides over a per-run `ctx.saved`, never by editing the DOORS table above. Asserts:
//   6. New → chain first → its stores (all ticked, paused kept, the frozen note) → header (start
//      now, end 23:59 of the day picked) → paste (header skipped and said, blank cells → default,
//      a repeat last-wins and counted) → Save draft with a reason: the create body FIELD FOR FIELD;
//      Send with a reason: { reason }; the promotion reads Sending, the editor is locked; Refresh
//      sends NO body and re-reads (Live);
//   7. refusals inline: DHS-00019 at the name, DHS-00008 at the reason, DHS-00018 marks the
//      material with no SKU on its row; a paste of 20,001 is refused before anything is sent;
//   8. a promotions-only user (no Chains read) types the chain, offered the chains seen;
//   9. RTL: the editor isolates its machine values.
{
  REFUSALS['DHS-00006'] = [404, 'No such HungerStation chain. / لا توجد سلسلة هنقرستيشن بهذا الاسم.']
  REFUSALS['DHS-00018'] = [400, 'A check still refuses: nothing was sent. / ما زال فحص يرفض: لم يُرسل شيء.']
  REFUSALS['DHS-00019'] = [409, 'The name is used by another promotion of the chain. / الاسم مستخدم لعرض آخر في السلسلة.']
}
const baseRead = DOORS.find((d) => d.door === 'read').handle

/** A saved draft as the server would answer it: blank cells resolved to the default. */
function draftOf(ctx, promotionId, body, prev = null) {
  const choices = { 1001: store('1001'), 1002: store('1002'), 2001: store('2001') }
  return {
    promotionId,
    chainKey: body.chainKey,
    name: body.name,
    displayNameEn: body.displayNameEn,
    displayNameAr: body.displayNameAr,
    type: body.type,
    hsReason: body.hsReason,
    startAt: body.startAt,
    endAt: body.endAt,
    orderLimit: body.orderLimit,
    globalLimit: body.globalLimit,
    defaultSubtype: body.defaultSubtype,
    defaultValue: body.defaultValue,
    status: 'draft',
    allStores: body.allStores,
    replacesId: null,
    replacedById: null,
    createdAt: prev?.createdAt ?? '2026-10-29T11:00:00',
    createdBy: 'msartawi',
    updatedAt: '2026-10-29T11:00:00',
    updatedBy: 'msartawi',
    sentAt: null,
    sentBy: null,
    switchedOffAt: null,
    switchedOffBy: null,
    switchedOffReason: null,
    parts: [],
    stores: body.allStores ? [] : body.storeCodes.map((c) => choices[c] ?? store(c)),
    items: body.items.map((i) =>
      item(i.materialNumber, { sku: null, partId: null, subtype: i.subtype ?? body.defaultSubtype, value: i.value ?? body.defaultValue, maxQuantity: i.maxQuantity }),
    ),
    sends: [],
  }
}

/** The 666 write doors over `ctx.saved`; `bend` swaps one door's answer for a scenario. */
const doors666 = (bend = {}) => ({
  read: (ctx, m, req, url) => {
    const id = decodeURIComponent(m[1])
    return ctx.saved?.[id] ? envelope(ctx.saved[id]) : baseRead(ctx, m, req, url)
  },
  create: (ctx, m, req) => {
    if (bend.create) {
      const bent = bend.create(ctx)
      if (bent) return bent
    }
    ctx.saved ??= {}
    const id = `p-new${Object.keys(ctx.saved).length + 1}`
    ctx.saved[id] = draftOf(ctx, id, req.postDataJSON())
    return envelope(ctx.saved[id])
  },
  save: (ctx, m, req) => {
    const id = decodeURIComponent(m[1])
    ctx.saved[id] = draftOf(ctx, id, req.postDataJSON(), ctx.saved[id])
    return envelope(ctx.saved[id])
  },
  send: (ctx, m) => {
    if (bend.send) {
      const bent = bend.send(ctx)
      if (bent) return bent
    }
    const id = decodeURIComponent(m[1])
    const p = ctx.saved[id]
    ctx.saved[id] = {
      ...p,
      status: 'sending',
      sentAt: '2026-10-29T11:00:00',
      sentBy: 'msartawi',
      stores: p.stores.length ? p.stores : [store('1001'), store('1002'), store('2001')],
      items: p.items.map((i) => ({ ...i, sku: `SKU-${i.materialNumber}`, partId: 'pt-n1' })),
      parts: [part('pt-n1', { name: p.name, skuCount: p.items.length, latestJobStatus: 'QUEUED', refusals: null })],
      sends: [send('s-n1', { partId: 'pt-n1', sentAt: '2026-10-29T11:00:00', reason: 'Go live', jobStatus: 'QUEUED', hsUpdatedAt: null })],
    }
    return envelope(ctx.saved[id])
  },
  refresh: (ctx, m) => {
    const id = decodeURIComponent(m[1])
    const p = ctx.saved[id]
    ctx.saved[id] = {
      ...p,
      status: 'live',
      parts: p.parts.map((x) => ({ ...x, latestJobStatus: 'COMPLETED', refusals: { invalidVendors: [], missingSkus: [], invalidDiscountedSkus: [] } })),
      sends: p.sends.map((s) => ({ ...s, jobStatus: 'COMPLETED' })),
    }
    return envelope(ctx.saved[id])
  },
})

const EDITOR = (id = 'new') => `dialog[open][data-promotion-editor="${id}"]`
const REASON = 'dialog[open] [data-reason-dialog]'
const PASTE = [
  ['Material', 'Subtype', 'Value', 'MaxQty'],
  ['101001', 'PERCENTAGE', '25', '3'],
  ['101002', '', '', ''],
  ['101003', 'FINAL_PRICE', '9.5', ''],
  ['101001', 'PERCENTAGE', '30', ''],
]
  .map((r) => r.join('\t'))
  .join('\r\n')
const callsOf = (ctx, door) => ctx.calls.filter((c) => c.door === door)

/** New → chain → header. */
async function startNew(page, { chain = 'OlaCare' } = {}) {
  await page.goto(`${BASE}/hungerstation/promotions`)
  await waitRows(page, N)
  await page.locator('[data-promotions-new]').click()
  const ed = page.locator(EDITOR())
  await ed.waitFor({ timeout: 15000 })
  if (chain) {
    await ed.locator('[data-editor-chain-select]').selectOption(chain)
    await ed.locator('[data-editor-store-list]').waitFor({ timeout: 15000 })
  }
  return ed
}
async function fillHeader(ed) {
  await ed.locator('[data-editor-name]').fill('Ramadan 666')
  await ed.locator('[data-editor-display-en]').fill('Up to 25% off')
  await ed.locator('[data-editor-display-ar]').fill('خصم حتى ٢٥٪')
  await ed.locator('[data-editor-default-value]').fill('20')
}
async function paste(page, ed, text) {
  await ed.locator('[data-editor-paste]').click()
  const dlg = page.locator('dialog[open] [data-import-dialog="promotion-items"]')
  await dlg.waitFor({ timeout: 10000 })
  await dlg.locator('[data-import-text]').fill(text)
  return dlg
}
async function reason(page, text) {
  const dlg = page.locator(REASON)
  await dlg.waitFor({ timeout: 10000 })
  await dlg.locator('[data-reason-input]').fill(text)
  await page.locator('dialog[open] [data-reason-confirm]').click()
}
const itemCell = async (ed, material, col) => (await ed.locator(`[data-editor-items-grid] .ag-row[row-id="${material}"] [col-id="${col}"]`).innerText()).trim()

/** § 0's check, for a body the browser sent. */
function sameKeysCheck(name, obj) {
  const source = readFileSync('src/core/models/hungerstation.ts', 'utf8')
  const want = modelFields(source, name).sort()
  const got = Object.keys(obj ?? {}).sort()
  check(`6: the ${name} sent has exactly the model's fields`, JSON.stringify(want) === JSON.stringify(got), `model ${want.join(',')} | sent ${got.join(',')}`)
}

// ── 6: make, save, send, refresh ─────────────────────────────────────────────────────────────
{
  const { context, page, errors, ctx } = await open('ltr', { doors: doors666() })
  const ed = await startNew(page)
  check('6: New opens the editor, ?edit=new in the URL', search(page).get('edit') === 'new')
  check('6: the chain comes first; its stores are read for it', callsOf(ctx, 'stores').at(-1)?.query === 'chain=OlaCare', callsOf(ctx, 'stores').at(-1)?.query)
  const ticks = await ed.locator('[data-editor-store]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-editor-store'), e.getAttribute('data-editor-store-on')]))
  check('6: every store of the chain ticked by default', JSON.stringify(ticks) === JSON.stringify([['1001', 'true'], ['1002', 'true'], ['2001', 'true']]), JSON.stringify(ticks))
  check('6: a paused store is offered, and says so', (await ed.locator('[data-editor-store="1002"] [data-editor-store-paused]').count()) === 1)
  check('6: the note says the list is frozen when sent, a later store does not join', /frozen when the promotion is sent: a store onboarded later does not join/.test(await ed.locator('[data-editor-stores-note]').innerText()))
  await ed.locator('[data-editor-stores-search]').fill('2001')
  check('6: the stores search narrows the list', (await ed.locator('[data-editor-store]').count()) === 1)
  await ed.locator('[data-editor-store="2001"] [data-editor-store-tick]').uncheck()
  await ed.locator('[data-editor-stores-search]').fill('')
  check('6: untick one: 2 / 3 ticked', (await ed.locator('[data-editor-stores-count]').innerText()).trim() === '2 / 3 ticked', await ed.locator('[data-editor-stores-count]').innerText())

  const box = (k) => ed.locator(`[data-editor-${k}]`).inputValue()
  check('6: start defaults to now (Saudi local)', (await box('start-date')) === '2026-10-29' && (await box('start-time')) === '11:00')
  check('6: end defaults to 23:59 of that day', (await box('end-date')) === '2026-10-29' && (await box('end-time')) === '23:59')
  await ed.locator('[data-editor-end-time]').fill('18:00')
  await ed.locator('[data-editor-end-date]').fill('2026-11-30')
  check('6: picking an end day takes 23:59 of it', (await box('end-date')) === '2026-11-30' && (await box('end-time')) === '23:59')
  check('6: Competitiveness is the default HungerStation reason', (await box('hs-reason')) === 'COMPETITIVENESS')
  await fillHeader(ed)
  await ed.locator('[data-editor-hs-reason]').selectOption('OVERSTOCK')
  await ed.locator('[data-editor-order-limit]').fill('2')
  check('6: Send waits for a saved draft', await ed.locator('[data-editor-send]').isDisabled())

  const dlg = await paste(page, ed, PASTE)
  await dlg.locator('[data-import-header-skipped]').waitFor({ timeout: 5000 })
  check('6: the header row is skipped and said', (await dlg.locator('[data-import-header-skipped]').innerText()).includes('Material'))
  check('6: the repeat is counted', (await dlg.locator('[data-import-repeats]').getAttribute('data-import-repeats')) === '1')
  await dlg.locator('[data-import-preview] .ag-row[row-index]').first().waitFor({ timeout: 5000 })
  const previewRows = new Set(await dlg.locator('[data-import-preview] .ag-row[row-index]').evaluateAll((els) => els.map((e) => e.getAttribute('row-index')))).size
  check('6: the preview grid shows the three materials', previewRows === 3, String(previewRows))
  check('6: the paste is used through the import dialog', (await page.locator('dialog[open] [data-import-send]').innerText()).replace(/[⁦-⁩]/g, '').trim() === 'Use 3 materials')
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"]').waitFor({ timeout: 10000 })
  check('6: three items, the repeat last-wins', (await ed.locator('[data-editor-items-count]').getAttribute('data-editor-items-count')) === '3' && (await itemCell(ed, '101001', 'value')) === '30%')
  check('6: a blank cell shows the default', (await itemCell(ed, '101002', 'subtype')) === 'Percentage off' && (await itemCell(ed, '101002', 'value')) === '20%')
  check('6: a final price reads in SAR', (await itemCell(ed, '101003', 'value')) === '9.500 SAR')
  await page.screenshot({ path: `${SHOTS}/ltr-editor.png` })

  await ed.locator('[data-editor-save]').click()
  await reason(page, '  Ramadan draft  ')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('edit') === 'p-new1', null, { timeout: 15000 })
  const body = callsOf(ctx, 'create')[0]?.body
  const want = {
    chainKey: 'OlaCare',
    name: 'Ramadan 666',
    displayNameEn: 'Up to 25% off',
    displayNameAr: 'خصم حتى ٢٥٪',
    type: 'STRIKETHROUGH',
    hsReason: 'OVERSTOCK',
    startAt: '2026-10-29T11:00:00',
    endAt: '2026-11-30T23:59:00',
    orderLimit: 2,
    globalLimit: null,
    defaultSubtype: 'PERCENTAGE',
    defaultValue: 20,
    allStores: false,
    storeCodes: ['1001', '1002'],
    items: [
      { materialNumber: '101001', subtype: 'PERCENTAGE', value: 30, maxQuantity: null, buyQuantity: null, getQuantity: null },
      { materialNumber: '101002', subtype: null, value: null, maxQuantity: null, buyQuantity: null, getQuantity: null },
      { materialNumber: '101003', subtype: 'FINAL_PRICE', value: 9.5, maxQuantity: null, buyQuantity: null, getQuantity: null },
    ],
    reason: 'Ramadan draft',
  }
  check('6: Save draft posts the create body field for field (wall time, no UTC, blank = null, reason trimmed)', JSON.stringify(body) === JSON.stringify(want), JSON.stringify(body))
  sameKeysCheck('HungerStationPromotionSaveBody', body)
  check('6: the saved id lands in the URL (?edit=p-new1)', search(page).get('edit') === 'p-new1')
  const ed2 = page.locator(EDITOR('p-new1'))
  await ed2.locator('[data-editor-state="saved"]').waitFor({ timeout: 10000 })
  check('6: saved, nothing reached HungerStation', callsOf(ctx, 'send').length === 0)

  // Save again: a PUT.
  await ed2.locator('[data-editor-global-limit]').fill('5000')
  await ed2.locator('[data-editor-state="dirty"]').waitFor({ timeout: 5000 })
  check('6: an edit since the save holds Send back', await ed2.locator('[data-editor-send]').isDisabled())
  await ed2.locator('[data-editor-save]').click()
  await reason(page, 'More uses')
  await ed2.locator('[data-editor-state="saved"]').waitFor({ timeout: 10000 })
  const put = callsOf(ctx, 'save')[0]
  check('6: saving again is a PUT on the draft', put?.path === 'HungerStationWeb/Promotions/p-new1' && put.body.globalLimit === 5000 && put.body.reason === 'More uses', JSON.stringify(put?.body))

  // Send.
  await ed2.locator('[data-editor-send]').click()
  await page.locator(REASON).waitFor({ timeout: 10000 })
  const note = await page.locator('dialog[open] [data-editor-send-note]').innerText()
  check('6: the Send dialog says what goes out', note.includes('2 stores with 3 materials'), note)
  await reason(page, 'Go live')
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-new1"]')
  await sheet.waitFor({ timeout: 15000 })
  check('6: Send posts { reason } only', JSON.stringify(callsOf(ctx, 'send')[0]?.body) === JSON.stringify({ reason: 'Go live' }) && callsOf(ctx, 'send')[0]?.path === 'HungerStationWeb/Promotions/p-new1/Send')
  await sheet.locator('[data-promotion-field="status"]').waitFor({ timeout: 10000 })
  check('6: the detail takes over, reading Sending', search(page).get('promotion') === 'p-new1' && search(page).get('edit') === null && (await sheet.locator('[data-promotion-field="status"] dd').innerText()).trim() === 'Sending')
  check('6: a sent promotion offers Refresh, not Edit', (await sheet.locator('[data-promotion-refresh]').count()) === 1 && (await sheet.locator('[data-promotion-edit]').count()) === 0)

  // Sending disables edit.
  await page.goto(`${BASE}/hungerstation/promotions?edit=p-new1`)
  const locked = page.locator(EDITOR('p-new1'))
  await locked.waitFor({ timeout: 20000 })
  await locked.locator('[data-editor-locked="sending"]').waitFor({ timeout: 20000 })
  check('6: while Sending the editor is locked', (await locked.locator('[data-editor-name]').isDisabled()) && (await locked.locator('[data-editor-paste]').isDisabled()) && (await locked.locator('[data-editor-save]').count()) === 0)

  // Refresh re-reads.
  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-new1`)
  const sheet2 = page.locator('dialog[open][data-promotion-sheet="p-new1"]')
  await sheet2.locator('[data-promotion-refresh]').waitFor({ timeout: 15000 })
  // (669's light poll may re-read meanwhile, so the read count is not asserted.)
  await sheet2.locator('[data-promotion-refresh]').click()
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-promotion-field="status"] dd')?.textContent?.trim() === 'Live', null, { timeout: 15000 })
  const r = callsOf(ctx, 'refresh')[0]
  check('6: Refresh posts NO body to …/Refresh', r?.path === 'HungerStationWeb/Promotions/p-new1/Refresh' && r.body === null, JSON.stringify(r))
  check('6: Refresh re-reads: Live, the part Completed', (await sheet2.locator('[data-promotion-part="pt-n1"] [data-promotion-part-status]').innerText()).trim() === 'Completed')
  check('6: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: refusals inline, and the cap ────────────────────────────────────────────────────────────
{
  let creates = 0
  const bend = {
    create: () => (++creates === 1 ? refuse('DHS-00019') : creates === 2 ? refuse('DHS-00008') : null),
    send: () => {
      const [status, message] = REFUSALS['DHS-00018']
      return envelope(
        {
          sendable: false,
          header: [],
          rows: [{ materialNumber: '101002', refusals: [{ code: 'NO_SKU', message: 'Material 101002 has no HungerStation SKU.' }], priceWarning: null }],
          parts: [],
          skuCount: 3,
        },
        { status, success: false, message, errorCode: 'DHS-00018' },
      )
    },
  }
  const { context, page, errors, ctx } = await open('ltr', { doors: doors666(bend) })
  const ed = await startNew(page)
  await fillHeader(ed)
  await ed.locator('[data-editor-end-date]').fill('2026-11-30')
  const dlg = await paste(page, ed, PASTE)
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"]').waitFor({ timeout: 10000 })

  await ed.locator('[data-editor-save]').click()
  await reason(page, 'first try')
  await page.locator('dialog[open] [data-inline-refusal="DHS-00019"]').first().waitFor({ timeout: 10000 })
  check('7: DHS-00019 (name in use) shows inline, at the name', (await ed.locator('[data-editor-name-refusal] [data-inline-refusal="DHS-00019"]').count()) === 1)
  check('7: … and not as a second banner in the dialog', (await page.locator('dialog[open] [data-reason-error]').count()) === 0)
  await page.locator('dialog[open] [data-reason-input]').fill('second try')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await page.locator('dialog[open] [data-inline-refusal="DHS-00008"]').waitFor({ timeout: 10000 })
  check('7: DHS-00008 shows inline at the reason', true)
  await page.locator('dialog[open] [data-reason-input]').fill('third try')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await page.waitForFunction(() => new URL(location.href).searchParams.get('edit') === 'p-new1', null, { timeout: 15000 })
  const ed2 = page.locator(EDITOR('p-new1'))
  await ed2.locator('[data-editor-state="saved"]').waitFor({ timeout: 10000 })
  await ed2.locator('[data-editor-send]').click()
  await reason(page, 'Go live')
  await page.locator('dialog[open] [data-reason-error="DHS-00018"]').waitFor({ timeout: 10000 })
  await page.locator('dialog[open] [data-reason-cancel]').click()
  await ed2.locator('[data-editor-rows-refused="1"]').waitFor({ timeout: 10000 })
  check('7: DHS-00018 names the material with no SKU on its row', (await itemCell(ed2, '101002', 'refusal')) === 'Material 101002 has no HungerStation SKU.' && (await itemCell(ed2, '101001', 'refusal')) === '')
  check('7: a refused Send leaves the draft a draft (no detail swap)', search(page).get('edit') === 'p-new1')
  await page.screenshot({ path: `${SHOTS}/ltr-editor-refused.png` })

  // The cap.
  const before = ctx.calls.length
  const big = Array.from({ length: 20001 }, (_, i) => String(500000 + i)).join('\n')
  await ed2.locator('[data-editor-paste]').click()
  const capDlg = page.locator('dialog[open] [data-import-dialog="promotion-items"]')
  await capDlg.waitFor({ timeout: 10000 })
  // 20,001 lines in one go (Playwright's fill types them too slowly): the native setter + input.
  await capDlg.locator('[data-import-text]').evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, big)
  await capDlg.locator('[data-import-over-cap]').waitFor({ timeout: 20000 })
  check('7: 20,001 materials are refused before anything is sent', (await page.locator('dialog[open] [data-import-send]').isDisabled()) && ctx.calls.length === before)
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: a promotions-only user types the chain ─────────────────────────────────────────────────
{
  const { context, page, errors, ctx } = await open('ltr', { access: { ...ALL, canManageStores: false }, chains: 'denied', doors: doors666() })
  const ed = await startNew(page, { chain: null })
  check('8: without the stores grant, no Chains read is made', ctx.calls.every((c) => c.path !== 'HungerStationWeb/Chains'))
  const offered = await ed.locator('#hs-promotion-chains option').evaluateAll((els) => els.map((e) => e.value))
  check('8: the chains seen on the list are offered', JSON.stringify(offered) === JSON.stringify(['AlDawaa', 'OlaCare']), offered.join())
  await ed.locator('[data-editor-chain-input]').fill('AlDawaa')
  await ed.locator('[data-editor-chain-input]').press('Enter')
  await ed.locator('[data-editor-store-list]').waitFor({ timeout: 15000 })
  check('8: a typed chain reads its stores through the promotions door', callsOf(ctx, 'stores').at(-1)?.query === 'chain=AlDawaa')
  check('8: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: RTL ───────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('rtl', { doors: doors666() })
  const ed = await startNew(page)
  check('9: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('9: the ticked count is ONE ltr isolate', (await ed.locator('[data-editor-stores-count] bdi[dir="ltr"]').allInnerTexts()).join('|') === '3 / 3')
  check('9: a store code is isolated', (await ed.locator('[data-editor-store="1001"] bdi[dir="ltr"]').innerText()) === '1001')
  const dlg = await paste(page, ed, PASTE)
  check('9: the pasted rows read left to right', (await dlg.locator('[data-import-text]').getAttribute('dir')) === 'ltr')
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"]').waitFor({ timeout: 10000 })
  check('9: a money cell is ONE isolate with its currency (the grid base)', (await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"] [col-id="value"] bdi').first().innerText()) === '9.500 SAR')
  await page.screenshot({ path: `${SHOTS}/rtl-editor.png` })
  check('9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: refusals per store, Resend, the light poll (ticket 669) ─────────────────────────────────
// Its own fixtures, through the read / resend door overrides — the DOORS table above is untouched.

const REFUSED_PT_A = {
  invalidVendors: [
    { storeCode: '2001', vendorId: 'hs-77821' },
    { storeCode: null, vendorId: 'hs-00009' },
  ],
  missingSkus: [
    {
      storeCode: '1001',
      vendorId: 'v-1001',
      skus: [
        { sku: 'SKU-201001', materialNumber: '201001' },
        { sku: 'HS-ORPHAN', materialNumber: null },
      ],
    },
    { storeCode: '1002', vendorId: 'v-1002', skus: [{ sku: 'SKU-201002', materialNumber: '201002' }] },
  ],
  invalidDiscountedSkus: [{ storeCode: '1001', vendorId: 'v-1001', skus: [{ sku: 'SKU-201002', materialNumber: '201002' }] }],
}
{
  const source = readFileSync('src/core/models/hungerstation.ts', 'utf8')
  const keys = (name, obj) => JSON.stringify(modelFields(source, name).sort()) === JSON.stringify(Object.keys(obj).sort())
  check(
    '6: refusal fixtures are exactly the model’s (refusals, vendor ref, store SKUs, refused SKU)',
    keys('HungerStationPromotionRefusals', REFUSED_PT_A) &&
      keys('HungerStationPromotionVendorRef', REFUSED_PT_A.invalidVendors[0]) &&
      keys('HungerStationPromotionStoreSkus', REFUSED_PT_A.missingSkus[0]) &&
      keys('HungerStationPromotionRefusedSku', REFUSED_PT_A.missingSkus[0].skus[0]),
  )
}

/** The p-refused detail as 669 reads it: pt-a refused, pt-b unanswered. A Resend of pt-a answers
 *  Sending; the next read is still Sending; the one after it HungerStation has answered: Live. */
function refusedDoors(state) {
  const base = () => detailOf(freshRows().find((r) => r.promotionId === 'p-refused'))
  const now = () => {
    const d = base()
    const [a, b] = d.parts
    if (state.resent === 0) return { ...d, parts: [{ ...a, refusals: REFUSED_PT_A }, b] }
    const answered = state.readsSinceResend >= 3
    return {
      ...d,
      status: answered ? 'live' : 'sending',
      parts: [
        {
          ...a,
          latestJobStatus: answered ? 'COMPLETED' : 'QUEUED',
          refusals: answered ? { invalidVendors: [], missingSkus: [], invalidDiscountedSkus: [] } : null,
        },
        b,
      ],
    }
  }
  return {
    read: (_ctx, m) => {
      if (decodeURIComponent(m[1]) !== 'p-refused') return refuse('DHS-00016')
      if (state.resent) state.readsSinceResend++
      return envelope(now())
    },
    resend: () => {
      if (state.refuse) return refuse(state.refuse)
      state.resent++
      state.readsSinceResend = 1 // the resend's own answer is the first post-resend read
      return envelope(now())
    },
  }
}

async function refusalScenario(dir) {
  const state = { resent: 0, readsSinceResend: 0, refuse: null }
  const { context, page, errors, ctx } = await open(dir, { doors: refusedDoors(state) })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const L = '6 ' + dir.toUpperCase() + ': '
  const reads = () => ctx.calls.filter((c) => c.door === 'read').length

  // The list's own filter for it.
  await page.goto(BASE + '/hungerstation/promotions')
  await waitRows(page, N)
  await chip(page, 'livePartlyRefused')
  await waitRows(page, 1)
  check(L + 'the "Live with refusals" filter sends status=livePartlyRefused', lists(ctx).at(-1) === 'status=livePartlyRefused&skip=0&take=100', lists(ctx).at(-1))

  await page.locator('[data-promotion-details="p-refused"]').click()
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-refused"]')
  const box = sheet.locator('[data-promotion-refusals]')
  await box.waitFor({ timeout: 15000 })
  const blocks = await sheet.locator('[data-promotion-refusal-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-promotion-refusal-part')))
  check(L + 'one refusal block — the refused part only (an unanswered part has none)', blocks.join() === 'pt-a', blocks.join())
  const counts = await box.locator('[data-refusal-list] [data-refusal-count]').allInnerTexts()
  check(L + 'the three lists, counted (2 stores, 3 missing, 1 over list)', JSON.stringify(counts) === JSON.stringify(['2', '3', '1']), counts.join())
  const rowsOf = (list) =>
    box.locator('[data-refusal-list="' + list + '"] tbody tr').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('td')].map((td) => td.textContent.trim())))
  // Under RTL only the direction changes: `lng` stays `en` app-wide (see § 5).
  const unresolved = 'Not one of our stores'
  check(
    L + 'invalid stores — our store code and the vendor id; an unresolved vendor says so',
    JSON.stringify(await rowsOf('invalidVendors')) === JSON.stringify([['2001', 'hs-77821'], [unresolved, 'hs-00009']]),
    JSON.stringify(await rowsOf('invalidVendors')),
  )
  check(
    L + 'missing materials per store — store, vendor, material, SKU',
    JSON.stringify(await rowsOf('missingSkus')) ===
      JSON.stringify([
        ['1001', 'v-1001', '201001', 'SKU-201001'],
        ['1001', 'v-1001', '', 'HS-ORPHAN'],
        ['1002', 'v-1002', '201002', 'SKU-201002'],
      ]),
    JSON.stringify(await rowsOf('missingSkus')),
  )
  check(L + 'promo price above list, per store', JSON.stringify(await rowsOf('invalidDiscountedSkus')) === JSON.stringify([['1001', 'v-1001', '201002', 'SKU-201002']]))

  // The store filter narrows all three; Copy copies as filtered.
  const opts = await box.locator('[data-refusal-store] option').evaluateAll((els) => els.map((e) => e.value))
  check(L + 'the store filter offers every refused store', JSON.stringify(opts) === JSON.stringify(['', '1001', '1002', '2001', 'vendor:hs-00009']), opts.join())
  await box.locator('[data-refusal-store]').selectOption('1001')
  check(
    L + 'store 1001 → no invalid store, 2 missing, 1 over list',
    (await rowsOf('invalidVendors')).length === 0 && (await rowsOf('missingSkus')).length === 2 && (await rowsOf('invalidDiscountedSkus')).length === 1,
  )
  check(L + 'an emptied list disables its Copy', await box.locator('[data-refusal-copy="invalidVendors"]').isDisabled())
  await box.locator('[data-refusal-copy="missingSkus"]').click()
  await page.waitForTimeout(300)
  // The OS clipboard may hand line ends back as CRLF (Windows); the page wrote LF.
  const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')
  check(L + 'Copy puts the filtered list on the clipboard, tab-separated, no isolates', clip === '1001\tv-1001\t201001\tSKU-201001\n1001\tv-1001\t\tHS-ORPHAN', JSON.stringify(clip))
  await box.locator('[data-refusal-store]').selectOption('')

  // The 24-hour part; HungerStation's own times.
  check(L + 'the 24-hour part says HungerStation never answered, with its hint', (await sheet.locator('[data-promotion-part="pt-b"] [data-promotion-part-unanswered]').count()) === 1)
  check(
    L + 'HungerStation’s own times, local',
    (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-hs-created]').innerText()) === '2026-10-28 09:30' &&
      (await sheet.locator('[data-promotion-send="s-b1"] [data-promotion-send-hs-updated]').innerText()) === '',
  )
  check(L + 'nothing Sending → no poll note', (await sheet.locator('[data-promotion-polling]').count()) === 0)

  if (dir === 'rtl') {
    const iso = await box.locator('[data-refusal-list="missingSkus"] tbody tr').first().locator('bdi[dir="ltr"]').allInnerTexts()
    check(L + 'a refused store code, vendor id, material and SKU are each ltr isolates', iso.join('|') === '1001|v-1001|201001|SKU-201001', iso.join('|'))
    check(L + 'the part name is free text', (await sheet.locator('[data-promotion-refusal-part="pt-a"] bdi:not([dir])').first().innerText()) === 'Eid B2G1 · B2G1 50%')
  }
  await page.screenshot({ path: SHOTS + '/' + dir + '-refusals.png' })

  // DHS-00017: the part is Sending after all — the dialog keeps it, with its code.
  state.refuse = 'DHS-00017'
  await sheet.locator('[data-promotion-part-resend="pt-a"]').click()
  const dialog = page.locator('dialog[open]:has([data-resend-dialog="pt-a"]):not(:has(dialog))')
  await dialog.waitFor({ timeout: 10000 })
  check(
    L + 'Resend opens the reason dialog naming the part; Confirm waits for a reason',
    (await dialog.innerText()).includes('Eid B2G1 · B2G1 50%') && (await dialog.locator('[data-reason-confirm]').isDisabled()),
  )
  await dialog.locator('textarea').fill('Stock synced')
  await dialog.locator('[data-reason-confirm]').click()
  await dialog.getByText('DHS-00017').first().waitFor({ timeout: 10000 })
  check(L + 'DHS-00017 stays in the dialog with its code', await dialog.isVisible())
  state.refuse = null

  // Resend for real.
  await dialog.locator('textarea').fill('  Stock synced  ')
  await dialog.locator('[data-reason-confirm]').click()
  await page.locator('[data-resend-dialog]').waitFor({ state: 'detached', timeout: 10000 })
  const resends = ctx.calls.filter((c) => c.door === 'resend')
  check(
    L + 'Resend posts { reason } (trimmed) to …/Parts/pt-a/Resend',
    resends.length === 2 &&
      resends[1].path === 'HungerStationWeb/Promotions/p-refused/Parts/pt-a/Resend' &&
      JSON.stringify(resends[1].body) === JSON.stringify({ reason: 'Stock synced' }),
    JSON.stringify(resends.at(-1)),
  )
  await sheet.locator('[data-promotion-part="pt-a"][data-promotion-part-job="QUEUED"]').waitFor({ timeout: 10000 })
  check(L + 'the answer lands at once — the part is Queued, its Resend disabled', await sheet.locator('[data-promotion-part-resend="pt-a"]').isDisabled())
  check(
    L + '… the promotion reads Sending, with the poll note',
    (await sheet.locator('[data-promotion-field="status"] [data-promotion-status]').getAttribute('data-promotion-status')) === 'sending' &&
      (await sheet.locator('[data-promotion-polling]').count()) === 1,
  )
  check(L + '… and the old refusals are gone (no final answer yet)', (await sheet.locator('[data-promotion-refusals]').count()) === 0)
  const readsAt = reads()
  // The light poll: the sheet re-reads by itself every 15 s until HungerStation has answered.
  await sheet.locator('[data-promotion-part="pt-a"][data-promotion-part-job="COMPLETED"]').waitFor({ timeout: 45000 })
  check(
    L + 'the light poll re-reads the detail on its own (Sending → Live)',
    reads() > readsAt && (await sheet.locator('[data-promotion-field="status"] [data-promotion-status]').getAttribute('data-promotion-status')) === 'live',
    String(reads() - readsAt),
  )
  check(
    L + '… the Resend is enabled again and the poll note gone',
    !(await sheet.locator('[data-promotion-part-resend="pt-a"]').isDisabled()) && (await sheet.locator('[data-promotion-polling]').count()) === 0,
  )
  const settled = reads()
  await page.waitForTimeout(16000)
  check(L + 'with nothing Sending the poll stops', reads() === settled, String(reads() - settled))
  check(L + 'only list, read and resend doors were called', ctx.calls.every((c) => ['list', 'read', 'resend'].includes(c.door)), [...new Set(ctx.calls.map((c) => c.door))].join())
  check(L + 'no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
await refusalScenario('ltr')
await refusalScenario('rtl')

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
