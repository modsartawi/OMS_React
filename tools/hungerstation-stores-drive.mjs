// HungerStation stores drive (ticket 551, BackOffice spec 3028).
//
// Drives the REAL app in Chromium against STUBS of the HungerStation door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md) — the doors
// (BackOffice 3030) are merged but not on staging, so there is no live SIS.Api to point at. Every
// fixture emits EXACTLY the contract's fields, on the REAL envelope { statusCode, success, message,
// errors: [{ errorCode, internalErrorCode, errorMessage }], data }, every refusal's errorMessage is
// "<English> / <Arabic>", and a refusal for a missing grant is a BARE 403 (no envelope):
//   GET  HungerStationWeb/Access                        → { canManageStores, canManageCatalog, canViewOrders }
//   GET  HungerStationWeb/Chains                        → ["OlaCare", "AlDawaa"]
//   GET  HungerStationWeb/Stores?chain=&sync=&health=&q= → store rows, each with its sync block
//   POST HungerStationWeb/Stores                        → the row; DHS-00001/2/3/4/5/6/8
//   PUT  HungerStationWeb/Stores/{store}                → the row; DHS-00005/6/7/8
//   DELETE HungerStationWeb/Stores/{store}?reason=      → data: null; DHS-00007/8 (552)
//   PUT  HungerStationWeb/Sync/{store}/Active           → the row; DHS-00007/8 (553)
//   POST HungerStationWeb/Sync/{store}/Now              → the push's log row; DHS-00007/8/13, 502 DHS-00014,
//                                                         409 HungerStationSyncBusy (553)
//
// Each browser context holds its OWN copy of the stores: a DELETE takes the store off it (a removed
// store is never listed), and a POST of a removed store's code brings it back on the body's chain
// and vendor id (the contract's revive). A POST of a code never listed is answered but not added.
//
// ── 551 (this slice) ── it asserts:
//   1. the HungerStation group is its OWN group, LAST, right after Deliverect, with a leaf per flag
//      (Stores, Materials, Orders); the group, its leaves and the page gate cost ONE probe call;
//      without canManageStores the Stores leaf is hidden (the others stay) and the URL shows the
//      denied card with no Stores call; a bare-403 probe hides the whole group; the Materials and
//      Orders placeholders render behind their own flags;
//   2. the rows render every column; a null onboardedAt / updatedAt and a "" store name are blank;
//      health reads OK / Failing / Silent / Paused — a failing row RED, a silent row AMBER, a paused
//      store reads Paused (never Silent) with no highlight;
//   3. chain, sync, health and text filters land in the URL and drive the door with the same
//      params; the chain filter offers the Chains read; a pasted URL drives the door; Clear resets;
//   4. onboard sends exactly { storeCode, chainKey, vendorId, reason } (trimmed, unicode kept);
//      Confirm waits for a store, a chain, a vendor id and a 1–200 character reason; 201 refused
//      inline; the list is read again;
//   5. DHS-00002/00003/00004 inline at the store, DHS-00005 at the vendor id, DHS-00006 at the
//      chain, DHS-00008 at the reason — the server's own sentence, the dialog staying open; DHS-00001
//      shows in the dialog with its code;
//   6. edit opens on the row's chain and vendor id, waits for a change, and PUTs exactly
//      { chainKey, vendorId, reason }; DHS-00005 inline at the vendor id; DHS-00007 says the store
//      is no longer onboarded and the list is read again;
//   7. Chains refused: the chain field is a typed key with the rows' chains as suggestions;
//   8. under RTL (direction only — `lng` stays `en` app-wide) machine values are isolated, a
//      refusal's code is isolated, onboard and edit work, and nothing errors.
//
// ── 552 (remove onboarding, and revive) ── it asserts:
//   9. a row's Remove opens a danger dialog that names the store and says, in words, that the stock
//      sync stops and orders are no longer fetched, the vendor id becomes free, logs / orders /
//      history stay readable, and the store is NOT taken off HungerStation (its portal does that);
//      it waits for a reason; it DELETEs Stores/{store} with the reason in the QUERY STRING (no
//      body), unicode kept and `&` / `#` inside it; the row leaves the list; DHS-00008 inline at the
//      reason; DHS-00007 (already removed) shows inline, the list is read again, and Remove is off;
//  10. onboarding the removed code again revives it on the dialog's chain and vendor id — the
//      freed vendor id is accepted — and the row is back;
//  11. under RTL: the remove note isolates the store; remove, DHS-00007 and revive all work.
//
// ── 553 (pause / resume, sync now) ── it asserts, LTR and RTL:
//  12. Pause on an active row / Resume on a paused one opens a reason dialog naming the store
//      (isolated); it PUTs Sync/{store}/Active with exactly { active, reason }; DHS-00008 inline; the
//      row flips in place (sync, health, the toggle's label) with NO list re-read; DHS-00007 says the
//      store is gone, re-reads the list and turns Confirm off;
//  13. Sync now says it is a FULL push to the LIVE HungerStation vendor (store and vendor id
//      isolated); it POSTs Sync/{store}/Now with exactly { reason }; while in flight the confirm and
//      the row's action show progress and a double click sends ONE push; the result reads the rows
//      sent and the status, and the row's sync block takes the push; it is off on a paused store
//      (and says why); DHS-00013 inline (the list re-read, the row Paused); 502 DHS-00014 shows
//      HungerStation's answer and says the push was recorded as failed (in the logs); 409
//      HungerStationSyncBusy says a push is already running — not an error state, no re-read;
//      DHS-00007 refreshes the list;
//  14. the same under RTL.
//
//   1. run the app:  npx vite --port 5231 --strictPort
//   2. DRIVE_PORT=5231 node tools/hungerstation-stores-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.hungerstation-stores-shots'
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
/** A missing grant: a BARE 403, no envelope, no body to read (contract § Common). */
const bare403 = { status: 403, contentType: 'text/plain', body: '' }

/** A sync block exactly as the contract has it. */
const sync = (over = {}) => ({
  active: true,
  lastFullRun: '2026-10-24T07:05:00',
  lastDeltaRun: '2026-10-24T10:30:00',
  lastRun: '2026-10-24T10:30:00',
  lastStatus: 'S',
  lastError: null,
  health: 'ok',
  ...over,
})
/** A store row exactly as the contract has it. */
const store = (storeCode, over = {}) => ({
  storeCode,
  storeName: 'Riyadh Olaya',
  chainKey: 'OlaCare',
  vendorId: 'abc12',
  onboardedAt: '2026-10-24T10:00:00',
  onboardedBy: 'HSADMIN',
  updatedAt: '2026-10-24T10:05:00',
  updatedBy: 'HSADMIN',
  sync: sync(),
  ...over,
})

const STORES = [
  store('1234'),
  store('0099', {
    storeName: 'Jeddah Tahlia',
    vendorId: 'jd099',
    sync: sync({ lastStatus: 'E', lastError: 'HTTP 500 from Delivery Hero', health: 'failing' }),
  }),
  store('2001', {
    storeName: 'صيدلية الدواء - العليا',
    chainKey: 'AlDawaa',
    vendorId: 'ad2001',
    sync: sync({ lastRun: null, lastStatus: null, health: 'silent' }),
  }),
  // A link from before spec 1867: its stamps arrive null; no Store row: the name is "".
  store('0450', {
    storeName: '',
    vendorId: 'old450',
    onboardedAt: null,
    onboardedBy: '',
    updatedAt: null,
    updatedBy: '',
    sync: sync({ active: false, lastRun: null, lastStatus: null, lastDeltaRun: null, health: 'ok' }),
  }),
]
const CHAINS = ['OlaCare', 'AlDawaa']

const REFUSALS = {
  'DHS-00001': [400, 'The vendor id is longer than its column. / رقم المورّد أطول من المسموح.'],
  'DHS-00002': [404, 'No such store in the store master. / لا يوجد فرع بهذا الرمز.'],
  'DHS-00003': [400, 'The store is closed. / الفرع مغلق.'],
  'DHS-00004': [409, 'The store is already onboarded. / الفرع مسجّل مسبقًا.'],
  'DHS-00005': [409, 'The vendor id belongs to another onboarded store. / رقم المورّد لفرع مسجّل آخر.'],
  'DHS-00006': [400, 'No such chain configured. / لا توجد سلسلة بهذا المفتاح.'],
  'DHS-00007': [404, 'The store is not onboarded. / الفرع غير مسجّل.'],
  'DHS-00008': [400, 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'],
  'DHS-00013': [409, "The store's stock sync is paused. / مزامنة مخزون الفرع موقوفة."],
  'DHS-00014': [502, 'HungerStation answered 422: vendor abc12 is closed. / ردّت هنقرستيشن 422: المورّد مغلق.'],
  HungerStationSyncBusy: [409, 'Another push of this store is running. / إرسال آخر لهذا الفرع جارٍ.'],
}
/** The push sync now answers (contract § Stock sync, the Logs row shape). */
const PUSH = { logId: '01JHSNOW', syncType: 'F', startTime: '2026-10-24T11:00:00', endTime: '2026-10-24T11:00:04', status: 'S', rows: 1812, error: null }
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

function storesAnswer(qs, list) {
  const chain = qs.get('chain')
  const syncF = qs.get('sync')
  const health = qs.get('health')
  const q = (qs.get('q') ?? '').toLowerCase()
  return list.filter(
    (s) =>
      (!chain || s.chainKey === chain) &&
      (!syncF || (syncF === 'active') === s.sync.active) &&
      (!health || s.sync.health === health) &&
      (!q || s.storeCode.includes(q) || s.storeName.toLowerCase().includes(q) || s.vendorId.toLowerCase().includes(q)),
  )
}

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true }
const DLV_ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManageTerms: true }

const browser = await chromium.launch()

async function open(dir, { access = ALL, chains = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const lists = []
  const writes = []
  // This context's own stores (552): a DELETE takes one off, a POST of a removed code revives it.
  const list = STORES.map((s) => ({ ...s }))
  const removed = new Set()
  // A sync now whose reason is "slow push" waits here until the drive releases it (553).
  const gate = { release: null }
  page.on('pageerror', (e) => errors.push(String(e)))
  // The browser logs every refused stub's status.
  page.on('console', (m) => m.type() === 'error' && !/status of (4\d\d|502)/.test(m.text()) && errors.push(m.text()))
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
    if (p === 'HungerStationWeb/Access') return route.fulfill(access === 403 ? bare403 : envelope(access))
    if (p === 'HungerStationWeb/Chains') return route.fulfill(chains === 'ok' ? envelope(CHAINS) : bare403)
    if (p === 'HungerStationWeb/Stores' && req.method() === 'GET') {
      lists.push(url.search.slice(1))
      return route.fulfill(envelope(storesAnswer(url.searchParams, list)))
    }
    if (p === 'HungerStationWeb/Stores' && req.method() === 'POST') {
      const body = req.postDataJSON()
      writes.push({ method: 'POST', path: p, body })
      if (body.reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
      if (body.vendorId === 'x'.repeat(40)) return route.fulfill(refuse('DHS-00001'))
      if (body.storeCode === '9999') return route.fulfill(refuse('DHS-00002'))
      if (body.storeCode === '0300') return route.fulfill(refuse('DHS-00003'))
      if (list.some((s) => s.storeCode === body.storeCode)) return route.fulfill(refuse('DHS-00004'))
      if (!CHAINS.includes(body.chainKey)) return route.fulfill(refuse('DHS-00006'))
      if (list.some((s) => s.vendorId === body.vendorId)) return route.fulfill(refuse('DHS-00005'))
      if (removed.has(body.storeCode)) {
        // The revive: the same store, back on the body's chain and vendor id.
        removed.delete(body.storeCode)
        const back = { ...STORES.find((s) => s.storeCode === body.storeCode), chainKey: body.chainKey, vendorId: body.vendorId, updatedBy: 'MSARTAWI' }
        list.push(back)
        return route.fulfill(envelope(back))
      }
      return route.fulfill(
        envelope(store(body.storeCode, { storeName: 'New store', chainKey: body.chainKey, vendorId: body.vendorId, sync: sync({ lastRun: null, lastStatus: null, lastFullRun: null, lastDeltaRun: null, health: 'silent' }) })),
      )
    }
    if (p.startsWith('HungerStationWeb/Stores/') && req.method() === 'PUT') {
      const body = req.postDataJSON()
      const code = decodeURIComponent(p.slice('HungerStationWeb/Stores/'.length))
      writes.push({ method: 'PUT', path: p, body })
      if (body.reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
      if (code === '0450') return route.fulfill(refuse('DHS-00007'))
      if (STORES.some((s) => s.storeCode !== code && s.vendorId === body.vendorId)) return route.fulfill(refuse('DHS-00005'))
      if (!CHAINS.includes(body.chainKey)) return route.fulfill(refuse('DHS-00006'))
      return route.fulfill(envelope({ ...STORES.find((s) => s.storeCode === code), chainKey: body.chainKey, vendorId: body.vendorId }))
    }
    if (p.startsWith('HungerStationWeb/Stores/') && req.method() === 'DELETE') {
      const code = decodeURIComponent(p.slice('HungerStationWeb/Stores/'.length))
      const reason = url.searchParams.get('reason')
      writes.push({ method: 'DELETE', path: p, search: url.search, keys: [...url.searchParams.keys()], reason, body: req.postData() })
      if (!reason || reason.trim().length > 200 || reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
      const at = list.findIndex((s) => s.storeCode === code)
      // 0450 was removed meanwhile, from another screen: the server no longer lists it.
      if (code === '0450') {
        if (at >= 0) list.splice(at, 1)
        return route.fulfill(refuse('DHS-00007'))
      }
      if (at < 0) return route.fulfill(refuse('DHS-00007'))
      list.splice(at, 1)
      removed.add(code)
      return route.fulfill(envelope(null))
    }
    if (p.startsWith('HungerStationWeb/Sync/') && p.endsWith('/Active') && req.method() === 'PUT') {
      const body = req.postDataJSON()
      const code = decodeURIComponent(p.slice('HungerStationWeb/Sync/'.length, -'/Active'.length))
      writes.push({ method: 'PUT', path: p, body })
      if (body.reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
      const at = list.findIndex((s) => s.storeCode === code)
      if (body.reason === 'trigger 00007' || at < 0) {
        if (at >= 0) list.splice(at, 1)
        return route.fulfill(refuse('DHS-00007'))
      }
      list[at] = { ...list[at], updatedBy: 'MSARTAWI', sync: { ...list[at].sync, active: body.active } }
      return route.fulfill(envelope(list[at]))
    }
    if (p.startsWith('HungerStationWeb/Sync/') && p.endsWith('/Now') && req.method() === 'POST') {
      const body = req.postDataJSON()
      const code = decodeURIComponent(p.slice('HungerStationWeb/Sync/'.length, -'/Now'.length))
      writes.push({ method: 'POST', path: p, body })
      if (body.reason === 'slow push') await new Promise((r) => (gate.release = r))
      if (body.reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
      if (body.reason === 'trigger busy') return route.fulfill(refuse('HungerStationSyncBusy'))
      const at = list.findIndex((s) => s.storeCode === code)
      if (body.reason === 'trigger 00007' || at < 0) {
        if (at >= 0) list.splice(at, 1)
        return route.fulfill(refuse('DHS-00007'))
      }
      // Paused from another screen meanwhile: the server's list says so too.
      if (body.reason === 'trigger 00013') list[at] = { ...list[at], sync: { ...list[at].sync, active: false } }
      if (!list[at].sync.active) return route.fulfill(refuse('DHS-00013'))
      const pushed = { ...list[at].sync, lastFullRun: PUSH.startTime, lastRun: PUSH.startTime }
      if (body.reason === 'trigger 00014') {
        // Recorded as failed — the row's sync block says so on the next read.
        list[at] = { ...list[at], sync: { ...pushed, lastStatus: 'E', lastError: 'HTTP 422', health: 'failing' } }
        return route.fulfill(refuse('DHS-00014'))
      }
      list[at] = { ...list[at], sync: { ...pushed, lastStatus: 'S', lastError: null, health: 'ok' } }
      return route.fulfill(envelope(PUSH))
    }
    // Deliverect's group is shown so the HungerStation group's place after it can be read.
    if (p === 'DeliverectWeb/Access') return route.fulfill(envelope(DLV_ALL))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, lists, writes, gate }
}

/** Wait until the grid holds `n` rows and has settled. */
const waitRows = async (page, n) => {
  await page.waitForFunction(
    (count) =>
      new Set([...document.querySelectorAll('[data-stores-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size ===
        count && !document.querySelector('[data-stores-grid] .ag-overlay-loading-center'),
    n,
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}

/** The row-index of a store code's row. */
const rowIndex = (page, code) =>
  page.evaluate((c) => {
    const pinned = [...document.querySelectorAll('[data-stores-grid] .ag-row[row-index] [col-id="storeCode"]')].find((el) => el.textContent === c)
    return pinned ? pinned.closest('.ag-row').getAttribute('row-index') : null
  }, code)

/** One row's cell text by store code and column id. */
const cell = async (page, code, colId) => {
  const index = await rowIndex(page, code)
  if (index === null) return null
  return page.evaluate(
    ([i, col]) => {
      const target = document.querySelector(`[data-stores-grid] .ag-row[row-index="${i}"] [col-id="${col}"]`)
      return target ? target.textContent.trim() : null
    },
    [index, colId],
  )
}

/** The classes of a row's centre section (where the row ground is painted). */
const rowClass = async (page, code) => {
  const index = await rowIndex(page, code)
  return page.evaluate((i) => [...document.querySelectorAll(`[data-stores-grid] .ag-row[row-index="${i}"]`)].map((r) => r.className).join(' '), index)
}

const urlSearch = (page) => new URL(page.url()).search.slice(1)
const dialog = (page) => page.locator('dialog[open]')
const groupHeaders = (page) => page.locator('nav button[aria-expanded]').evaluateAll((els) => els.map((e) => e.textContent.trim()))

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  const groups = await groupHeaders(page)
  check(
    '1: the HungerStation group is its own, LAST, right after Deliverect',
    groups.filter((g) => g === 'HungerStation').length === 1 &&
      groups.indexOf('HungerStation') === groups.indexOf('Deliverect') + 1 &&
      groups.slice(groups.indexOf('HungerStation') + 1).every((g) => /msartawi/.test(g)),
    groups.join(' · '),
  )
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/stores"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/hungerstation"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: a leaf per flag — Stores, Materials, Orders', JSON.stringify(hrefs) === JSON.stringify(['/hungerstation/stores', '/hungerstation/materials', '/hungerstation/orders']), hrefs.join())
  const texts = await page.locator('nav a[href^="/hungerstation"]').allInnerTexts()
  check('1: the leaves read Stores / Materials / Orders', JSON.stringify(texts.map((s) => s.trim())) === JSON.stringify(['Stores', 'Materials', 'Orders']), texts.join())
  await page.locator('nav a[href="/hungerstation/stores"]').first().click()
  await waitRows(page, 4)
  check('1: the page title reads HungerStation stores', (await page.locator('h1').innerText()) === 'HungerStation stores')
  check(
    '1: the group, its leaves and the page gate cost ONE probe call',
    calls.filter((c) => c === 'HungerStationWeb/Access').length === 1,
    String(calls.filter((c) => c === 'HungerStationWeb/Access').length),
  )
  await page.locator('nav a[href="/hungerstation/materials"]').first().click()
  await page.locator('[data-hs-placeholder="materials"]').waitFor({ timeout: 10000 })
  check('1: Materials opens its placeholder (555 fills it)', (await page.locator('h1').innerText()) === 'HungerStation materials')
  await page.locator('nav a[href="/hungerstation/orders"]').first().click()
  await page.locator('[data-hs-placeholder="orders"]').waitFor({ timeout: 10000 })
  check('1: Orders opens its placeholder (556 fills it)', (await page.locator('h1').innerText()) === 'HungerStation orders')
  check('1: still ONE probe call after three pages', calls.filter((c) => c === 'HungerStationWeb/Access').length === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canManageStores: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/materials"]').first().waitFor({ timeout: 5000 })
  check('1: without canManageStores the Stores leaf is hidden', (await page.locator('nav a[href="/hungerstation/stores"]').count()) === 0)
  check('1: …and the Materials and Orders leaves stay', (await page.locator('nav a[href="/hungerstation/orders"]').count()) === 1)
  await page.goto(`${BASE}/hungerstation/stores`)
  await page.getByText('No access to HungerStation stores').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card and asks no Stores call', !calls.includes('HungerStationWeb/Stores'))
  check('1 (denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: 403 })
  await page.goto(`${BASE}/`)
  await page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ }).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  check('1: a bare-403 probe hides the whole group (fail closed)', !(await groupHeaders(page)).includes('HungerStation'))
  await page.goto(`${BASE}/hungerstation/orders`)
  await page.getByText(/No access to HungerStation orders|This screen is unavailable/).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  check('1: a hand-typed placeholder URL stays closed too', (await page.locator('[data-hs-placeholder]').count()) === 0)
  check('1: and no Stores call', !calls.includes('HungerStationWeb/Stores'))
  check('1 (403): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open('ltr', { access: { canManageStores: true, canManageCatalog: false, canViewOrders: false } })
  await page.goto(`${BASE}/hungerstation/materials`)
  await page.getByText('No access to HungerStation materials').waitFor({ timeout: 20000 })
  check('1: the Materials placeholder stands behind canManageCatalog', (await page.locator('[data-hs-placeholder]').count()) === 0)
  check('1 (placeholder denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–6: the page, its filters, onboard and edit ──────────────────────────────────────────────
{
  const { context, page, errors, lists, writes } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/stores`)
  await waitRows(page, 4)

  // 2: the rows
  check('2: the list asks the door with no params (every filter at its default)', lists[0] === '', JSON.stringify(lists))
  check(
    '2: store, name, chain, vendor id, onboarded and updated at/by show',
    (await cell(page, '1234', 'storeName')) === 'Riyadh Olaya' &&
      (await cell(page, '1234', 'chainKey')) === 'OlaCare' &&
      (await cell(page, '1234', 'vendorId')) === 'abc12' &&
      (await cell(page, '1234', 'onboardedAt')) === '2026-10-24 10:00' &&
      (await cell(page, '1234', 'onboardedBy')) === 'HSADMIN' &&
      (await cell(page, '1234', 'updatedAt')) === '2026-10-24 10:05' &&
      (await cell(page, '1234', 'updatedBy')) === 'HSADMIN',
  )
  check(
    '2: the sync block shows — active, last full, last delta, last run and status',
    (await cell(page, '1234', 'sync')) === 'Active' &&
      (await cell(page, '1234', 'lastFullRun')) === '2026-10-24 07:05' &&
      (await cell(page, '1234', 'lastDeltaRun')) === '2026-10-24 10:30' &&
      (await cell(page, '1234', 'lastRun')) === '2026-10-24 10:30' &&
      (await cell(page, '1234', 'lastStatus')) === 'Success',
  )
  check(
    '2: a null onboardedAt / updatedAt and a "" store name render blank',
    (await cell(page, '0450', 'onboardedAt')) === '' && (await cell(page, '0450', 'updatedAt')) === '' && (await cell(page, '0450', 'storeName')) === '',
  )
  check('2: health reads OK', (await cell(page, '1234', 'health')) === 'OK')
  check(
    '2: failing reads Failing, with its status and error, and the row is RED',
    (await cell(page, '0099', 'health')) === 'Failing' &&
      (await cell(page, '0099', 'lastStatus')) === 'Error' &&
      (await cell(page, '0099', 'lastError')) === 'HTTP 500 from Delivery Hero' &&
      /danger-050/.test(await rowClass(page, '0099')),
  )
  check('2: silent reads Silent and the row is AMBER', (await cell(page, '2001', 'health')) === 'Silent' && /attention-050/.test(await rowClass(page, '2001')))
  check(
    '2: 🚩 a paused store reads Paused — not Silent — with no highlight',
    (await cell(page, '0450', 'health')) === 'Paused' && (await cell(page, '0450', 'sync')) === 'Paused' && !/danger-050|attention-050/.test(await rowClass(page, '0450')),
  )
  check('2: an ok row has no highlight', !/danger-050|attention-050/.test(await rowClass(page, '1234')))
  const failingTitle = await page.locator('[data-health="failing"]').first().getAttribute('title')
  check('2: the failing badge says why in words', failingTitle === 'The newest push in the last 24 hours failed.', failingTitle)
  check('2: the count reads 4 stores', (await page.locator('[data-status-count]').innerText()) === '4 stores')
  await page.screenshot({ path: `${SHOTS}/ltr-list.png` })

  // 3: the filters
  const chainOptions = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('3: the chain filter offers the Chains read', JSON.stringify(chainOptions) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), chainOptions.join())
  await page.locator('[data-filter-chain]').selectOption('OlaCare')
  await waitRows(page, 3)
  check('3: chain lands in the URL and on the door', urlSearch(page) === 'chain=OlaCare' && lists.at(-1) === 'chain=OlaCare', `${urlSearch(page)} / ${lists.at(-1)}`)
  await page.locator('[data-filter-sync]').selectOption('active')
  await waitRows(page, 2)
  check('3: sync=active lands in the URL and on the door', urlSearch(page) === 'chain=OlaCare&sync=active' && lists.at(-1) === 'chain=OlaCare&sync=active', lists.at(-1))
  await page.locator('[data-filter-health]').selectOption('failing')
  await waitRows(page, 1)
  check('3: health=failing lands in the URL and on the door', urlSearch(page) === 'chain=OlaCare&sync=active&health=failing' && lists.at(-1) === 'chain=OlaCare&sync=active&health=failing', lists.at(-1))
  await page.locator('[data-stores-clear]').click()
  await waitRows(page, 4)
  check('3: Clear resets the URL', urlSearch(page) === '')
  await page.locator('[data-filter-q]').fill(' ad2001 ')
  await page.locator('[data-stores-search]').click()
  await waitRows(page, 1)
  check('3: the text filter (a vendor id) is trimmed into q on the door', urlSearch(page) === 'q=ad2001' && lists.at(-1) === 'q=ad2001', lists.at(-1))
  await page.goto(`${BASE}/hungerstation/stores?sync=paused&health=ok`)
  await waitRows(page, 1)
  check('3: a pasted URL drives the door with the same query string', lists.at(-1) === 'sync=paused&health=ok', lists.at(-1))
  check('3: …and the filters read it back', (await page.locator('[data-filter-sync]').inputValue()) === 'paused' && (await page.locator('[data-filter-health]').inputValue()) === 'ok')
  await page.goto(`${BASE}/hungerstation/stores?health=bogus`)
  await waitRows(page, 4)
  check('3: a value the door does not know is never sent (it would be a 400)', lists.at(-1) === '', lists.at(-1))
  await page.locator('[data-stores-clear]').click()
  await waitRows(page, 4)

  // 4: onboard — the fields and the reason rule
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  const note = await page.locator('[data-reason-note]').innerText()
  check('4: the onboard note says a removed store comes back on this chain and vendor id', /removed comes back/.test(note), note)
  const confirm = page.locator('[data-reason-confirm]')
  check('4: Confirm waits for a store, a chain, a vendor id and a reason', await confirm.isDisabled())
  const dialogChains = await page.locator('[data-chain-select] option').evaluateAll((els) => els.map((e) => e.value))
  check('4: the chain field offers the Chains read', JSON.stringify(dialogChains) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), dialogChains.join())
  await page.locator('[data-onboard-store]').fill(' 0555 ')
  await page.locator('[data-chain-select]').selectOption('AlDawaa')
  await page.locator('[data-onboard-vendor]').fill(' new555 ')
  check('4: still waiting for the reason', await confirm.isDisabled())
  await page.locator('[data-reason-input]').fill('ه'.repeat(201))
  check(
    '4: 201 characters are refused inline and Confirm stays off',
    (await page.locator('[data-reason-too-long]').count()) === 1 && (await confirm.isDisabled()) && (await page.locator('[data-reason-count]').innerText()) === '201 / 200',
  )
  const reason = '  فرع جديد على هنقرستيشن 👍  '
  await page.locator('[data-reason-input]').fill(reason)
  check('4: a 1–200 character reason enables Confirm', !(await confirm.isDisabled()))
  const listsBefore = lists.length
  await confirm.click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check(
    '4: onboard POSTs exactly { storeCode, chainKey, vendorId, reason }, trimmed, unicode kept',
    JSON.stringify(writes.at(-1).body) === JSON.stringify({ storeCode: '0555', chainKey: 'AlDawaa', vendorId: 'new555', reason: reason.trim() }),
    JSON.stringify(writes.at(-1).body),
  )
  await page.waitForTimeout(400)
  check('4: the list is asked again after the write', lists.length > listsBefore)

  // 5: the refusals, inline
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('try')
  await page.locator('[data-chain-select]').selectOption('OlaCare')
  await page.locator('[data-onboard-vendor]').fill('fresh1')
  const atStore = async (storeCode, code) => {
    await page.locator('[data-onboard-store]').fill(storeCode)
    await page.locator('[data-reason-confirm]').click()
    const r = page.locator(`[data-onboard-dialog] [data-inline-refusal="${code}"]`)
    await r.waitFor({ timeout: 5000 })
    return r
  }
  const r4 = await atStore('1234', 'DHS-00004')
  check('5: DHS-00004 shows inline in the server’s words', (await r4.innerText()).includes(REFUSALS['DHS-00004'][1]))
  check(
    '5: …at the store field (the store input sits right above it)',
    await page.evaluate(() => {
      const r = document.querySelector('[data-inline-refusal="DHS-00004"]')
      return !!r && r.parentElement.querySelector('[data-onboard-store]') !== null
    }),
  )
  check('5: and not twice (no banner)', (await dialog(page).locator('[data-reason-error]').count()) === 0)
  check('5: the dialog stays open, the reason kept', (await page.locator('[data-reason-input]').inputValue()) === 'try')
  await page.locator('[data-onboard-store]').fill('0601')
  check('5: editing a field clears its refusal', (await page.locator('[data-inline-refusal]').count()) === 0)
  await atStore('9999', 'DHS-00002')
  check('5: DHS-00002 shows inline at the store', true)
  await atStore('0300', 'DHS-00003')
  check('5: DHS-00003 shows inline at the store', true)
  await page.locator('[data-onboard-store]').fill('0601')
  await page.locator('[data-onboard-vendor]').fill('abc12')
  await page.locator('[data-reason-confirm]').click()
  const r5 = page.locator('[data-onboard-dialog] [data-inline-refusal="DHS-00005"]')
  await r5.waitFor({ timeout: 5000 })
  check(
    '5: DHS-00005 shows inline at the vendor id',
    (await r5.innerText()).includes(REFUSALS['DHS-00005'][1]) &&
      (await page.evaluate(() => document.querySelector('[data-inline-refusal="DHS-00005"]').parentElement.querySelector('[data-onboard-vendor]') !== null)),
  )
  await page.locator('[data-onboard-vendor]').fill('fresh1')
  await page.locator('[data-reason-input]').fill('trigger 00008')
  await page.locator('[data-reason-confirm]').click()
  const r8 = dialog(page).locator('[data-inline-refusal="DHS-00008"]')
  await r8.waitFor({ timeout: 5000 })
  check('5: DHS-00008 shows inline at the reason, in the server’s words', (await r8.innerText()).includes(REFUSALS['DHS-00008'][1]))
  await page.screenshot({ path: `${SHOTS}/ltr-refusal.png` })
  await page.locator('[data-reason-input]').fill('long vendor')
  await page.locator('[data-onboard-vendor]').fill('x'.repeat(40))
  await page.locator('[data-reason-confirm]').click()
  const r1 = dialog(page).locator('[data-reason-error="DHS-00001"]')
  await r1.waitFor({ timeout: 5000 })
  check('5: DHS-00001 shows in the dialog with its code', (await dialog(page).innerText()).includes(REFUSALS['DHS-00001'][1]))
  await page.locator('[data-reason-cancel]').click()
  await dialog(page).waitFor({ state: 'detached' })

  // 6: edit
  await page.locator('[data-store-edit="1234"]').click()
  await dialog(page).waitFor()
  const editNote = await page.locator('[data-reason-note]').innerText()
  check('6: the edit note names the store', /1234/.test(editNote), editNote)
  check(
    '6: it opens on the row’s chain and vendor id',
    (await page.locator('[data-chain-select]').inputValue()) === 'OlaCare' && (await page.locator('[data-edit-vendor]').inputValue()) === 'abc12',
  )
  await page.locator('[data-reason-input]').fill('typo at onboarding')
  check('6: an unchanged edit cannot be sent, and says why', (await page.locator('[data-reason-confirm]').isDisabled()) && (await page.locator('[data-edit-unchanged]').count()) === 1)
  await page.locator('[data-edit-vendor]').fill('jd099')
  await page.locator('[data-reason-confirm]').click()
  const e5 = page.locator('[data-edit-dialog] [data-inline-refusal="DHS-00005"]')
  await e5.waitFor({ timeout: 5000 })
  check('6: DHS-00005 shows inline at the vendor id', (await e5.innerText()).includes(REFUSALS['DHS-00005'][1]))
  await page.locator('[data-edit-vendor]').fill(' abc13 ')
  await page.locator('[data-chain-select]').selectOption('AlDawaa')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const put = writes.at(-1)
  check(
    '6: edit PUTs exactly { chainKey, vendorId, reason } to Stores/1234',
    put.method === 'PUT' && put.path === 'HungerStationWeb/Stores/1234' && JSON.stringify(put.body) === JSON.stringify({ chainKey: 'AlDawaa', vendorId: 'abc13', reason: 'typo at onboarding' }),
    JSON.stringify(put),
  )
  await page.locator('[data-store-edit="0450"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-edit-vendor]').fill('old451')
  await page.locator('[data-reason-input]').fill('fix')
  const beforeGone = lists.length
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-edit-gone]').waitFor({ timeout: 5000 })
  const goneText = await page.locator('[data-edit-gone]').innerText()
  check('6: DHS-00007 says the store is no longer onboarded', /no longer onboarded/.test(goneText) && goneText.includes(REFUSALS['DHS-00007'][1]), goneText)
  await page.waitForTimeout(500)
  check('6: …and the list is read again', lists.length > beforeGone)
  check('6: …and the edit can no longer be sent', await page.locator('[data-reason-confirm]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/ltr-edit-gone.png` })
  await page.locator('[data-reason-cancel]').click()
  await dialog(page).waitFor({ state: 'detached' })

  check('ltr: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: Chains refused — the typed fallback ────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('ltr', { chains: 'refused' })
  await page.goto(`${BASE}/hungerstation/stores`)
  await waitRows(page, 4)
  await page.waitForTimeout(300)
  const options = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('7: the filter offers the chains seen on the rows', JSON.stringify(options) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), options.join())
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  check('7: the chain field is a typed key, with the hint', (await page.locator('[data-chain-input]').count()) === 1 && (await page.locator('[data-chain-fallback]').count()) === 1)
  await page.locator('[data-onboard-store]').fill('0602')
  await page.locator('[data-chain-input]').fill('Nope')
  await page.locator('[data-onboard-vendor]').fill('v602')
  await page.locator('[data-reason-input]').fill('typed chain')
  await page.locator('[data-reason-confirm]').click()
  const r6 = page.locator('[data-inline-refusal="DHS-00006"]')
  await r6.waitFor({ timeout: 5000 })
  check('7 / 5: a wrong chain is DHS-00006, inline at the chain', (await r6.innerText()).includes(REFUSALS['DHS-00006'][1]))
  await page.locator('[data-chain-input]').fill('OlaCare')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check('7: a typed chain onboards', JSON.stringify(writes.at(-1).body) === JSON.stringify({ storeCode: '0602', chainKey: 'OlaCare', vendorId: 'v602', reason: 'typed chain' }))
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: RTL ──────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('rtl')
  await page.goto(`${BASE}/hungerstation/stores`)
  await waitRows(page, 4)
  check('8: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  // ⚠️ `oms.locale=ar` sets the DIRECTION only (core/i18n.ts keeps `lng: en`), so the copy here is
  // English under RTL. The Arabic bundle is proven by its registration and the vitest mirror test.
  check('8: the page renders mirrored', (await page.locator('h1').innerText()) === 'HungerStation stores')
  const codes = await page.evaluate(() => [...document.querySelectorAll('[data-stores-grid] [col-id="storeCode"] bdi[dir="ltr"]')].map((b) => b.textContent))
  check('8: store codes are isolated left-to-right (0099 keeps its zeros)', codes.includes('0099') && codes.includes('1234'), codes.join())
  const vendors = await page.evaluate(() => [...document.querySelectorAll('[data-stores-grid] [col-id="vendorId"] bdi[dir="ltr"]')].map((b) => b.textContent))
  check('8: vendor ids are isolated left-to-right', vendors.includes('abc12') && vendors.includes('ad2001'), vendors.join())
  const times = await page.evaluate(() => [...document.querySelectorAll('[data-stores-grid] [col-id="lastFullRun"] bdi[dir="ltr"]')].map((b) => b.textContent))
  check('8: times are isolated whole', times.includes('2026-10-24 07:05'), times.join())
  check('8: the count isolates its number', (await page.locator('[data-status-count] bdi[dir="ltr"]').innerText()) === '4')
  check('8: the health highlight still paints under RTL', /danger-050/.test(await rowClass(page, '0099')) && /attention-050/.test(await rowClass(page, '2001')))
  await page.screenshot({ path: `${SHOTS}/rtl-list.png` })

  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  await page.locator('[data-onboard-store]').fill('1234')
  await page.locator('[data-chain-select]').selectOption('OlaCare')
  await page.locator('[data-onboard-vendor]').fill('rtl1')
  await page.locator('[data-reason-input]').fill('سبب')
  await page.locator('[data-reason-confirm]').click()
  const rtlRefusal = page.locator('[data-onboard-dialog] [data-inline-refusal="DHS-00004"]')
  await rtlRefusal.waitFor({ timeout: 5000 })
  check('8: DHS-00004 shows inline under RTL, its code isolated', (await rtlRefusal.locator('bdi[dir="ltr"]').innerText()) === 'DHS-00004')
  check('8: the server’s sentence is in its own <bdi>', (await rtlRefusal.locator('bdi:not([dir])').innerText()) === REFUSALS['DHS-00004'][1])
  await page.screenshot({ path: `${SHOTS}/rtl-refusal.png` })
  await page.locator('[data-onboard-store]').fill('0777')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check('8: onboard works under RTL', writes.at(-1).method === 'POST' && writes.at(-1).body.storeCode === '0777' && writes.at(-1).body.reason === 'سبب')

  await page.locator('[data-store-edit="2001"]').click()
  await dialog(page).waitFor()
  const isolated = await page.locator('[data-reason-note] bdi[dir="ltr"]').allInnerTexts()
  check('8: the edit note isolates the store', JSON.stringify(isolated) === JSON.stringify(['2001']), isolated.join())
  await page.screenshot({ path: `${SHOTS}/rtl-edit.png` })
  await page.locator('[data-edit-vendor]').fill('ad2002')
  await page.locator('[data-reason-input]').fill('تصحيح')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check('8: edit works under RTL', writes.at(-1).method === 'PUT' && writes.at(-1).path === 'HungerStationWeb/Stores/2001' && writes.at(-1).body.vendorId === 'ad2002')
  check('rtl: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9–11: remove onboarding, and revive (552) ───────────────────────────────────────────────────
/** Remove, DHS-00008, DHS-00007 and revive, in one direction. */
async function removeAndRevive(dir) {
  const tag = dir === 'rtl' ? '11 (rtl)' : '9'
  const reviveTag = dir === 'rtl' ? '11 (rtl)' : '10'
  const { context, page, errors, lists, writes } = await open(dir)
  await page.goto(`${BASE}/hungerstation/stores`)
  await waitRows(page, 4)

  // the dialog says what it does
  await page.locator('[data-store-remove="1234"]').click()
  await dialog(page).waitFor()
  const note = await page.locator('[data-reason-note]').innerText()
  check(`${tag}: the remove dialog names the store`, /1234/.test(note), note)
  const isolated = await page.locator('[data-reason-note] bdi[dir="ltr"]').allInnerTexts()
  check(`${tag}: …isolated whole`, JSON.stringify(isolated) === JSON.stringify(['1234']), isolated.join())
  const said = await page.locator('[data-remove-consequence]').allInnerTexts()
  check(
    `${tag}: it says the sync stops and orders are no longer fetched, the vendor id is freed, the history stays, and it is NOT taken off HungerStation`,
    said.length === 4 &&
      /stock sync stops/.test(said[0]) &&
      /orders are no longer fetched/.test(said[0]) &&
      /vendor id becomes free for another store/.test(said[1]) &&
      /logs, orders and history stay readable/.test(said[2]) &&
      /not taken off HungerStation/.test(said[3]) &&
      /HungerStation's portal/.test(said[3]),
    said.join(' | '),
  )
  check(`${tag}: it says how to bring the store back`, /onboard the same store code again/.test(await page.locator('[data-remove-revive]').innerText()))
  const confirm = page.locator('[data-reason-confirm]')
  check(`${tag}: Remove waits for a reason`, await confirm.isDisabled())
  check(`${tag}: …and confirms on the danger button`, /danger/.test((await confirm.getAttribute('class')) ?? ''))
  await page.screenshot({ path: `${SHOTS}/${dir}-remove.png` })

  // DHS-00008 at the reason
  await page.locator('[data-reason-input]').fill('trigger 00008')
  await confirm.click()
  const r8 = dialog(page).locator('[data-inline-refusal="DHS-00008"]')
  await r8.waitFor({ timeout: 5000 })
  check(`${tag}: DHS-00008 shows inline at the reason, the dialog open`, (await r8.innerText()).includes(REFUSALS['DHS-00008'][1]))

  // remove
  const reason = '  أُغلق الفرع & نُقل #2 50% 👍  '
  await page.locator('[data-reason-input]').fill(reason)
  await confirm.click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const del = writes.at(-1)
  check(
    `${tag}: DELETE Stores/1234 with the reason in the query string, trimmed, unicode and & # kept, no body`,
    del.method === 'DELETE' && del.path === 'HungerStationWeb/Stores/1234' && del.reason === reason.trim() && JSON.stringify(del.keys) === '["reason"]' && !del.body,
    JSON.stringify(del),
  )
  check(`${tag}: …percent-encoded on the wire`, /^\?reason=[\x21-\x7e]+$/.test(del.search), del.search)
  await waitRows(page, 3)
  check(`${tag}: the row leaves the list`, (await rowIndex(page, '1234')) === null)
  check(`${tag}: the count reads 3 stores`, (await page.locator('[data-status-count]').innerText()) === '3 stores')

  // DHS-00007: already removed (from another screen)
  await page.locator('[data-store-remove="0450"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('closing')
  const before = lists.length
  await confirm.click()
  await page.locator('[data-remove-gone]').waitFor({ timeout: 5000 })
  const gone = await page.locator('[data-remove-gone]').innerText()
  check(`${tag}: DHS-00007 shows inline — no longer onboarded, in the server's words`, /no longer onboarded/.test(gone) && gone.includes(REFUSALS['DHS-00007'][1]), gone)
  check(`${tag}: …with its code isolated`, (await page.locator('[data-remove-gone] [data-inline-refusal="DHS-00007"] bdi[dir="ltr"]').innerText()) === 'DHS-00007')
  check(`${tag}: …not twice (no banner)`, (await dialog(page).locator('[data-reason-error]').count()) === 0)
  await waitRows(page, 2)
  check(`${tag}: …the list is read again and the store is gone from it`, lists.length > before && (await rowIndex(page, '0450')) === null)
  check(`${tag}: …and Remove can no longer be sent`, await confirm.isDisabled())
  await page.screenshot({ path: `${SHOTS}/${dir}-remove-gone.png` })
  await page.locator('[data-reason-cancel]').click()
  await dialog(page).waitFor({ state: 'detached' })

  // 10: revive — onboard the removed code again
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  check(`${reviveTag}: the onboard note says a removed store comes back`, /removed comes back/.test(await page.locator('[data-reason-note]').innerText()))
  await page.locator('[data-onboard-store]').fill('1234')
  await page.locator('[data-chain-select]').selectOption('AlDawaa')
  await page.locator('[data-onboard-vendor]').fill('abc12')
  await page.locator('[data-reason-input]').fill('back on HungerStation')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check(
    `${reviveTag}: onboarding the removed code POSTs it with the dialog's chain and vendor id (the freed one)`,
    JSON.stringify(writes.at(-1).body) === JSON.stringify({ storeCode: '1234', chainKey: 'AlDawaa', vendorId: 'abc12', reason: 'back on HungerStation' }),
    JSON.stringify(writes.at(-1).body),
  )
  await waitRows(page, 3)
  check(`${reviveTag}: the store is back on the list, on the new chain`, (await cell(page, '1234', 'chainKey')) === 'AlDawaa' && (await cell(page, '1234', 'vendorId')) === 'abc12')
  check(`${dir}: (552) no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}
await removeAndRevive('ltr')
await removeAndRevive('rtl')

// ── 12–14: pause / resume, sync now (553) ───────────────────────────────────────────────────────
/** Pause, resume and DHS-00007 on the Active door, in one direction. */
async function pauseResume(dir) {
  const tag = dir === 'rtl' ? '14 (rtl)' : '12'
  const { context, page, errors, lists, writes } = await open(dir)
  await page.goto(`${BASE}/hungerstation/stores`)
  await waitRows(page, 4)
  const confirm = page.locator('[data-reason-confirm]')

  const toggle = (code) => page.locator(`[data-store-toggle-sync="${code}"]`)
  check(`${tag}: an active row offers Pause, a paused one Resume`, (await toggle('1234').innerText()).trim() === 'Pause' && (await toggle('0450').innerText()).trim() === 'Resume')

  await toggle('1234').click()
  await dialog(page).waitFor()
  check(
    `${tag}: the pause dialog is titled and names the store, isolated`,
    (await dialog(page).innerText()).includes("Pause a store's stock sync") && JSON.stringify(await page.locator('[data-reason-note] bdi[dir="ltr"]').allInnerTexts()) === '["1234"]',
  )
  check(`${tag}: Pause waits for a reason`, await confirm.isDisabled())
  await page.locator('[data-reason-input]').fill('trigger 00008')
  await confirm.click()
  await dialog(page).locator('[data-inline-refusal="DHS-00008"]').waitFor({ timeout: 5000 })
  check(`${tag}: DHS-00008 shows inline at the reason`, true)
  const reason = '  توقف مؤقت للجرد  '
  await page.locator('[data-reason-input]').fill(reason)
  const listsBefore = lists.length
  await confirm.click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const put = writes.at(-1)
  check(
    `${tag}: PUT Sync/1234/Active with exactly { active: false, reason }, trimmed`,
    put.method === 'PUT' && put.path === 'HungerStationWeb/Sync/1234/Active' && JSON.stringify(put.body) === JSON.stringify({ active: false, reason: reason.trim() }),
    JSON.stringify(put),
  )
  await page.waitForTimeout(500)
  check(
    `${tag}: the row flips in place — Paused, health Paused, the toggle reads Resume`,
    (await cell(page, '1234', 'sync')) === 'Paused' && (await cell(page, '1234', 'health')) === 'Paused' && (await toggle('1234').innerText()).trim() === 'Resume',
  )
  check(`${tag}: …with no list re-read`, lists.length === listsBefore, `${listsBefore} → ${lists.length}`)
  check(
    `${tag}: …and Sync now on it is off, saying why`,
    (await page.locator('[data-store-sync-now="1234"]').getAttribute('aria-disabled')) === 'true' &&
      /paused/.test((await page.locator('[data-store-sync-now="1234"]').getAttribute('title')) ?? ''),
  )

  await toggle('0450').click()
  await dialog(page).waitFor()
  check(`${tag}: the resume dialog is titled`, (await dialog(page).innerText()).includes("Resume a store's stock sync"))
  await page.locator('[data-reason-input]').fill('stock count done')
  await confirm.click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check(
    `${tag}: PUT Sync/0450/Active with exactly { active: true, reason }`,
    writes.at(-1).path === 'HungerStationWeb/Sync/0450/Active' && JSON.stringify(writes.at(-1).body) === JSON.stringify({ active: true, reason: 'stock count done' }),
  )
  await page.waitForTimeout(400)
  check(`${tag}: the resumed row reads Active, and Sync now is on`, (await cell(page, '0450', 'sync')) === 'Active' && (await page.locator('[data-store-sync-now="0450"]').getAttribute('aria-disabled')) === null)
  await page.screenshot({ path: `${SHOTS}/${dir}-paused.png` })

  await toggle('2001').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('trigger 00007')
  const beforeGone = lists.length
  await confirm.click()
  await page.locator('[data-sync-active-gone]').waitFor({ timeout: 5000 })
  const gone = await page.locator('[data-sync-active-gone]').innerText()
  check(`${tag}: DHS-00007 says the store is no longer onboarded, in the server's words`, /no longer onboarded/.test(gone) && gone.includes(REFUSALS['DHS-00007'][1]), gone)
  check(`${tag}: …not twice (no banner)`, (await dialog(page).locator('[data-reason-error]').count()) === 0)
  await waitRows(page, 3)
  check(`${tag}: …the list is read again, the store gone, Confirm off`, lists.length > beforeGone && (await rowIndex(page, '2001')) === null && (await confirm.isDisabled()))
  await page.locator('[data-reason-cancel]').click()
  await dialog(page).waitFor({ state: 'detached' })
  check(`${dir}: (553 pause/resume) no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** Sync now: success, in flight, the result, and each refusal, in one direction. */
async function syncNow(dir) {
  const tag = dir === 'rtl' ? '14 (rtl)' : '13'
  const { context, page, errors, lists, writes, gate } = await open(dir)
  await page.goto(`${BASE}/hungerstation/stores`)
  await waitRows(page, 4)
  const confirm = page.locator('[data-reason-confirm]')
  const action = (code) => page.locator(`[data-store-sync-now="${code}"]`)
  const nows = () => writes.filter((w) => w.method === 'POST' && w.path.endsWith('/Now'))

  // off on a paused store
  check(
    `${tag}: Sync now is off on a paused store, and its title says why`,
    (await action('0450').getAttribute('aria-disabled')) === 'true' && (await action('0450').getAttribute('title')) === 'The stock sync is paused. Resume it first.',
  )
  await action('0450').click({ force: true })
  await page.waitForTimeout(300)
  check(`${tag}: …clicking it opens nothing`, (await dialog(page).count()) === 0)

  // the confirmation
  await action('0099').click()
  await dialog(page).waitFor()
  const note = await page.locator('[data-reason-note]').innerText()
  check(`${tag}: the confirmation says it is a FULL push to the LIVE HungerStation vendor`, /full push/.test(note) && /live HungerStation vendor/.test(note), note)
  check(`${tag}: …store and vendor id isolated, each whole`, JSON.stringify(await page.locator('[data-reason-note] bdi[dir="ltr"]').allInnerTexts()) === '["0099","jd099"]')
  check(`${tag}: Push now waits for a reason`, await confirm.isDisabled())
  await page.screenshot({ path: `${SHOTS}/${dir}-sync-now.png` })

  // in flight: one push, progress on both the confirm and the row
  await page.locator('[data-reason-input]').fill('  slow push  ')
  await confirm.dblclick()
  await page.waitForFunction(() => document.querySelector('[data-store-sync-now="0099"]')?.hasAttribute('data-running'), null, { timeout: 5000 })
  check(`${tag}: in flight the confirm reads Sending… and is off`, (await confirm.isDisabled()) && /Sending/.test(await confirm.innerText()))
  check(
    `${tag}: …and the row's action shows progress and is off`,
    (await action('0099').getAttribute('aria-disabled')) === 'true' && (await action('0099').getAttribute('aria-busy')) === 'true' && /Pushing/.test(await action('0099').innerText()),
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-sync-now-running.png` })
  await page.waitForTimeout(300)
  check(`${tag}: a double click sends ONE push`, nows().length === 1, String(nows().length))
  const listsBefore = lists.length
  gate.release()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check(
    `${tag}: POST Sync/0099/Now with exactly { reason }, trimmed`,
    nows()[0].path === 'HungerStationWeb/Sync/0099/Now' && JSON.stringify(nows()[0].body) === JSON.stringify({ reason: 'slow push' }),
    JSON.stringify(nows()[0]),
  )
  const result = page.locator('[data-sync-now-result="0099"]')
  await result.waitFor({ timeout: 5000 })
  check(`${tag}: the result names the store`, /Push of store 0099/.test(await result.innerText()) && (await result.locator('bdi[dir="ltr"]').first().innerText()) === '0099')
  const line = await page.locator('[data-sync-now-result-line]').innerText()
  check(`${tag}: …and reads the rows sent and the status`, line === '1,812 materials sent. Status: Success.', line)
  check(`${tag}: …the rows isolated whole`, (await page.locator('[data-sync-now-result-line] bdi[dir="ltr"]').innerText()) === '1,812')
  await page.waitForTimeout(500)
  check(
    `${tag}: the row's sync block takes the push — last full and last run 11:00, Success, health OK`,
    (await cell(page, '0099', 'lastFullRun')) === '2026-10-24 11:00' &&
      (await cell(page, '0099', 'lastRun')) === '2026-10-24 11:00' &&
      (await cell(page, '0099', 'lastStatus')) === 'Success' &&
      (await cell(page, '0099', 'health')) === 'OK',
  )
  check(
    `${tag}: …the list read again, and the action back on`,
    lists.length > listsBefore && (await action('0099').getAttribute('aria-disabled')) === null && (await action('0099').getAttribute('data-running')) === null,
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-sync-now-result.png` })
  await page.locator('[data-sync-now-dismiss]').click()
  check(`${tag}: the result can be dismissed`, (await result.count()) === 0)

  const refused = async (code, reason) => {
    await action(code).click()
    await dialog(page).waitFor()
    await page.locator('[data-reason-input]').fill(reason)
    const before = lists.length
    await confirm.click()
    await page.locator('[data-sync-now-refusal]').waitFor({ timeout: 5000 })
    await page.waitForTimeout(400)
    return { panel: page.locator('[data-sync-now-refusal]'), reread: lists.length > before }
  }
  const close = async () => {
    await page.locator('[data-reason-cancel]').click()
    await dialog(page).waitFor({ state: 'detached' })
    await page.waitForTimeout(300)
  }

  // 502 DHS-00014
  {
    const { panel, reread } = await refused('1234', 'trigger 00014')
    const text = await panel.innerText()
    check(
      `${tag}: 502 DHS-00014 shows HungerStation's answer from the message`,
      (await panel.getAttribute('data-sync-now-refusal')) === 'hungerStationFailed' && text.includes(REFUSALS['DHS-00014'][1]),
      text,
    )
    check(`${tag}: …and says the push was recorded as failed, in the logs`, /recorded as failed/.test(text) && /logs/.test(text))
    check(
      `${tag}: …its code isolated, not twice (no banner)`,
      (await panel.locator('[data-inline-refusal="DHS-00014"] bdi[dir="ltr"]').innerText()) === 'DHS-00014' && (await dialog(page).locator('[data-reason-error]').count()) === 0,
    )
    check(`${tag}: …the list is read again, Push now still on (it can be tried again)`, reread && !(await confirm.isDisabled()))
    await page.screenshot({ path: `${SHOTS}/${dir}-sync-now-502.png` })
    await close()
    check(`${tag}: …and the row reads the failed push`, (await cell(page, '1234', 'lastStatus')) === 'Error' && (await cell(page, '1234', 'health')) === 'Failing')
  }

  // 409 busy
  {
    const { panel, reread } = await refused('2001', 'trigger busy')
    const text = await panel.innerText()
    check(
      `${tag}: 409 busy says a push is already running; try again shortly`,
      (await panel.getAttribute('data-sync-now-refusal')) === 'busy' && text.includes('A push is already running; try again shortly.'),
      text,
    )
    check(`${tag}: …and that nothing was recorded`, /Nothing was pushed or recorded/.test(text))
    check(
      `${tag}: …NOT an error state — a status, no danger, no banner`,
      (await panel.getAttribute('role')) === 'status' &&
        !/danger/.test((await panel.getAttribute('class')) ?? '') &&
        (await dialog(page).locator('[data-reason-error], [role="alert"]').count()) === 0,
    )
    check(`${tag}: …no list re-read, Push now still on`, !reread && !(await confirm.isDisabled()))
    await page.screenshot({ path: `${SHOTS}/${dir}-sync-now-busy.png` })
    await close()
  }

  // DHS-00013 — paused from elsewhere meanwhile
  {
    const { panel, reread } = await refused('0099', 'trigger 00013')
    const text = await panel.innerText()
    check(`${tag}: DHS-00013 shows inline — paused, in the server's words`, (await panel.getAttribute('data-sync-now-refusal')) === 'paused' && text.includes(REFUSALS['DHS-00013'][1]), text)
    check(`${tag}: …the list is read again, Push now off`, reread && (await confirm.isDisabled()))
    await close()
    check(`${tag}: …and the row reads Paused, its Sync now off`, (await cell(page, '0099', 'sync')) === 'Paused' && (await action('0099').getAttribute('aria-disabled')) === 'true')
  }

  // DHS-00007 — removed meanwhile
  {
    const { panel, reread } = await refused('2001', 'trigger 00007')
    check(`${tag}: DHS-00007 says the store is no longer onboarded`, (await panel.getAttribute('data-sync-now-refusal')) === 'gone' && /no longer onboarded/.test(await panel.innerText()))
    check(`${tag}: …the list is read again, Push now off`, reread && (await confirm.isDisabled()))
    await close()
    await waitRows(page, 3)
    check(`${tag}: …and the store is gone from the list`, (await rowIndex(page, '2001')) === null)
  }
  check(`${dir}: (553 sync now) no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}
await pauseResume('ltr')
await syncNow('ltr')
await pauseResume('rtl')
await syncNow('rtl')

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
