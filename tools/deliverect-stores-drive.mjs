// Deliverect stores drive (ticket 477, BackOffice spec 2615).
//
// Drives the REAL app in Chromium against STUBS of the Deliverect door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md) — none of the
// `DeliverectWeb/*` doors is built, so there is no live SIS.Api to point at. Every fixture emits
// EXACTLY the contract's fields, on the REAL envelope { statusCode, success, message,
// errors: [{ errorCode, internalErrorCode, errorMessage }], data }, and every refusal's
// errorMessage is "<English> / <Arabic>":
//   GET    DeliverectWeb/Access            → { canManageStores, canManageCatalog, canViewOrders, canManageTerms }
//   GET    DeliverectWeb/Stores?account=&linked=&q=  → store rows (sync and status NULL — 2624/2625 unshipped)
//   POST   DeliverectWeb/Stores            → the row; DLV-00001/2/3/9; the direct-HungerStation warning
//   PUT    DeliverectWeb/Stores/{store}    → move
//   DELETE DeliverectWeb/Stores/{store}?reason=  → remove
//   GET    DeliverectWeb/Accounts          → 200 [{ accountKey, deliverectAccountId, active }] OR 403
//   PUT    DeliverectWeb/Sync/{store}/Active  → pause / resume { active, reason }; DLV-00001/9   (480)
//   GET    DeliverectWeb/Sync/{store}/Logs?take=  → [{ logId, syncType, startTime, endTime, status,
//                                                     rows, fileId, callbackStatus, error }]   (480)
//
// ── 477 (this slice) ── it asserts:
//   1. the Deliverect group comes LAST (after Materials) with ONE leaf, Stores; the group, the leaf
//      and the page gate cost ONE probe call; without canManageStores the group is hidden and the URL
//      shows the denied card with no Stores call;
//   2. the rows render; the state reads Linked / Onboarded, not linked; the direct-HungerStation
//      badge shows; with every sync and status NULL there is NO sync or status column;
//   3. account, linked and text filters land in the URL and drive the door with the same params; a
//      pasted URL drives the door; Clear resets;
//   4. onboard sends exactly { storeCode, accountKey, reason } (reason trimmed, unicode kept); Confirm
//      waits for a store, an account and a 1–200 character reason; 201 characters are refused inline;
//   5. the direct-HungerStation answer is a WARNING (attention, role=status), the dialog closes and
//      no error shows;
//   6. DLV-00001 and DLV-00002 show inline at the store, DLV-00003 at the account, DLV-00009 at the
//      reason — the server's own "<English> / <Arabic>" sentence, the dialog staying open;
//   7. move says the link will be cleared, cannot pick the current account, and PUTs { accountKey, reason };
//   8. remove says the sync stops and the link is cleared, and DELETEs with ?reason= (Arabic kept);
//   9. Accounts refused (403): the account field is a typed key with the rows' accounts as
//      suggestions, the filter offers the rows' accounts, and a typed key onboards;
//  10. under RTL (direction only — `lng` stays `en` app-wide) machine values are isolated, a refusal
//      and a remove work, and nothing errors;
//  11. once a row carries sync / status (2624/2625 shipped), their columns appear — on that data only.
//
// ── 480 (appended; 1–11 above are 477's and stay unchanged) ── with the browser clock fixed at
// 2026-10-12 11:00 local, against populated sync blocks, it asserts:
//  12. the sync columns (active, health, last full, last delta, last status, last error); the health
//      reads Up to date / Failed / Overdue / Paused / Not run yet; a failed row is RED and an overdue
//      row AMBER, a paused store is never overdue, a row with a null sync block gets no sync cells and
//      no sync actions; the overdue badge says which run is behind; a tick of the clock turns a store
//      overdue without a refetch;
//  13. pause says in words that it stops the stock pushes only (the store stays listed, still receives
//      orders), waits for a reason, and PUTs exactly { active: false, reason } (trimmed, unicode
//      kept); resume PUTs { active: true, reason }; DLV-00009 shows inline at the reason and another
//      refusal in the dialog with its code, the dialog staying open;
//  14. the logs drawer reads Logs?take=50 and shows type, start, end, rows, status, file id, the
//      `processed` callback and the error; a failed run is red; a refused read shows its code; an
//      empty log says so; Escape closes it;
//  15. under RTL the health, the dialog note and the drawer's machine values are isolated, and a
//      pause works.
//
//   1. run the app:  npx vite --port 5196 --strictPort
//   2. DRIVE_PORT=5196 node tools/deliverect-stores-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.deliverect-stores-shots'
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

/** A store row exactly as the contract has it — sync and status null until 2624/2625 ship. */
const store = (storeCode, over = {}) => ({
  storeCode,
  storeName: 'Riyadh Olaya',
  accountKey: 'OlaCare',
  deliverectLocationId: '64f0c2a91b',
  onboardedAt: '2026-10-12T10:00:00',
  onboardedBy: 'HSADMIN',
  linkedAt: '2026-10-12T10:05:00',
  onDirectHungerStation: false,
  sync: null,
  status: null,
  ...over,
})

const STORES = [
  store('1234'),
  store('0099', { storeName: 'Jeddah Tahlia', deliverectLocationId: null, linkedAt: null }),
  store('2001', { storeName: 'صيدلية الدواء - العليا', accountKey: 'AlDawaa', onDirectHungerStation: true }),
]

const ACCOUNTS = [
  { accountKey: 'OlaCare', deliverectAccountId: '5f1a00aa', active: true },
  { accountKey: 'AlDawaa', deliverectAccountId: '5f1a00bb', active: true },
  { accountKey: 'Dormant', deliverectAccountId: '5f1a00cc', active: false },
]

const REFUSALS = {
  'DLV-00001': [404, 'No such store. / لا يوجد فرع بهذا الرمز.'],
  'DLV-00002': [409, 'The store is already onboarded on a Deliverect account. / الفرع مسجّل مسبقًا على حساب Deliverect.'],
  'DLV-00003': [400, 'No such account, or the account is inactive. / لا يوجد حساب بهذا المفتاح، أو الحساب غير نشط.'],
  'DLV-00009': [400, 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'],
}
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}
const WARNING = 'Store 0777 is on the direct HungerStation rail: HungerStation stays on the direct rail for it. / الفرع 0777 على مسار هنقرستيشن المباشر.'

// 480: a sync log row exactly as the contract has it.
const logRow = (logId, over = {}) => ({
  logId,
  syncType: 'D',
  startTime: '2026-10-12T10:30:00',
  endTime: '2026-10-12T10:30:41',
  status: 'S',
  rows: 1204,
  fileId: 'inv-7f3a9c',
  callbackStatus: 'processed',
  error: null,
  ...over,
})
const SYNC_LOGS = {
  1234: [
    logRow('01JD0003', { startTime: '2026-10-12T10:30:00', endTime: null, rows: 0, fileId: null, callbackStatus: null }),
    logRow('01JD0002', { status: 'E', rows: 0, fileId: null, callbackStatus: null, error: 'Deliverect refused the file: location unknown' }),
    logRow('01JF0001', { syncType: 'F', startTime: '2026-10-12T07:05:00', endTime: '2026-10-12T07:09:12', rows: 18240 }),
  ],
}

function storesAnswer(qs, list = STORES) {
  const account = qs.get('account')
  const linked = qs.get('linked')
  const q = (qs.get('q') ?? '').toLowerCase()
  return list.filter(
    (s) =>
      (!account || s.accountKey === account) &&
      (!linked || (linked === 'yes') === (s.deliverectLocationId !== null)) &&
      (!q || s.storeCode.includes(q) || s.storeName.toLowerCase().includes(q)),
  )
}

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManageTerms: true }

const browser = await chromium.launch()

async function open(dir, { access = ALL, accounts = 'ok', stores = STORES } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const lists = []
  const writes = []
  const logReads = []
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
    if (p === 'DeliverectWeb/Accounts') {
      if (accounts === 'ok') return route.fulfill(envelope(ACCOUNTS))
      return route.fulfill(
        envelope(null, { status: 403, success: false, message: 'Access denied. / تم رفض الوصول.', errorCode: 'Forbidden' }),
      )
    }
    if (p === 'DeliverectWeb/Stores' && req.method() === 'GET') {
      lists.push(url.search.slice(1))
      return route.fulfill(envelope(storesAnswer(url.searchParams, stores)))
    }
    if (p === 'DeliverectWeb/Stores' && req.method() === 'POST') {
      const body = req.postDataJSON()
      writes.push({ method: 'POST', path: p, body })
      if (body.reason === 'trigger 00009') return route.fulfill(refuse('DLV-00009'))
      if (body.storeCode === '9999') return route.fulfill(refuse('DLV-00001'))
      if (STORES.some((s) => s.storeCode === body.storeCode)) return route.fulfill(refuse('DLV-00002'))
      if (!ACCOUNTS.some((a) => a.accountKey === body.accountKey && a.active)) return route.fulfill(refuse('DLV-00003'))
      const row = store(body.storeCode, {
        storeName: 'New store',
        accountKey: body.accountKey,
        deliverectLocationId: null,
        linkedAt: null,
        onDirectHungerStation: body.storeCode === '0777',
      })
      return route.fulfill(envelope(row, { message: body.storeCode === '0777' ? WARNING : '' }))
    }
    if (p.startsWith('DeliverectWeb/Stores/') && req.method() === 'PUT') {
      writes.push({ method: 'PUT', path: p, body: req.postDataJSON() })
      const code = decodeURIComponent(p.slice('DeliverectWeb/Stores/'.length))
      const row = STORES.find((s) => s.storeCode === code)
      return route.fulfill(envelope({ ...row, accountKey: req.postDataJSON().accountKey, deliverectLocationId: null, linkedAt: null }))
    }
    if (p.startsWith('DeliverectWeb/Stores/') && req.method() === 'DELETE') {
      writes.push({ method: 'DELETE', path: p, reason: url.searchParams.get('reason') })
      return route.fulfill(envelope(null))
    }
    // 480: the stock sync doors (contract § Stock sync).
    if (/^DeliverectWeb\/Sync\/[^/]+\/Active$/.test(p) && req.method() === 'PUT') {
      const body = req.postDataJSON()
      writes.push({ method: 'PUT', path: p, body })
      if (body.reason === 'trigger 00009') return route.fulfill(refuse('DLV-00009'))
      if (body.reason === 'trigger 00001') return route.fulfill(refuse('DLV-00001'))
      return route.fulfill(envelope(null))
    }
    if (/^DeliverectWeb\/Sync\/[^/]+\/Logs$/.test(p) && req.method() === 'GET') {
      const code = decodeURIComponent(p.split('/')[2])
      logReads.push({ code, search: url.search.slice(1) })
      if (code === '2001') return route.fulfill(refuse('DLV-00001'))
      return route.fulfill(envelope(SYNC_LOGS[code] ?? []))
    }
    // Materials' leaves are shown so the Deliverect group's place after them can be read.
    if (p === 'MaterialWeb/Access') return route.fulfill(envelope({ canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, lists, writes, logReads }
}

/** Wait until the grid holds `n` rows (a row is drawn once per pinned/centre section) and has settled. */
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

/** One row's cell text by store code and column id. */
const cell = (page, code, colId) =>
  page.evaluate(
    ([c, col]) => {
      const pinned = [...document.querySelectorAll('[data-stores-grid] .ag-row[row-index] [col-id="storeCode"]')].find(
        (el) => el.textContent === c,
      )
      if (!pinned) return null
      const index = pinned.closest('.ag-row').getAttribute('row-index')
      const target = [...document.querySelectorAll(`[data-stores-grid] .ag-row[row-index="${index}"] [col-id="${col}"]`)][0]
      return target ? target.textContent.trim() : null
    },
    [code, colId],
  )

const urlSearch = (page) => new URL(page.url()).search.slice(1)
const dialog = (page) => page.locator('dialog[open]')

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  const groups = await page.locator('nav button[aria-expanded]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check(
    '1: the Deliverect group comes LAST, right after Materials',
    // The user menu at the rail foot also carries aria-expanded; it is not a menu group.
    groups.indexOf('Deliverect') === groups.indexOf('Materials') + 1 &&
      groups.indexOf('Materials') >= 0 &&
      groups.slice(groups.indexOf('Deliverect') + 1).every((g) => /msartawi/.test(g)),
    groups.join(' · '),
  )
  await header.first().click()
  await page.locator('nav a[href="/deliverect/stores"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/deliverect"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: ONE leaf — Stores; 478/479/482 add theirs with their pages', JSON.stringify(hrefs) === JSON.stringify(['/deliverect/stores']), hrefs.join())
  const leafText = await page.locator('nav a[href="/deliverect/stores"]').first().innerText()
  check('1: the leaf reads "Stores"', leafText.trim() === 'Stores', leafText)
  await page.locator('nav a[href="/deliverect/stores"]').first().click()
  await waitRows(page, 3)
  check(
    '1: the group, its leaf and the page gate cost ONE probe call',
    calls.filter((c) => c === 'DeliverectWeb/Access').length === 1,
    String(calls.filter((c) => c === 'DeliverectWeb/Access').length),
  )
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canManageStores: false } })
  await page.goto(`${BASE}/`)
  await page.locator('nav button[aria-expanded]', { hasText: /^Materials$/ }).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  check(
    '1: without canManageStores the Deliverect group (its only leaf) is hidden',
    (await page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ }).count()) === 0 &&
      (await page.locator('nav a[href="/deliverect/stores"]').count()) === 0,
  )
  await page.goto(`${BASE}/deliverect/stores`)
  await page.getByText('No access to Deliverect stores').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card and asks no Stores call', !calls.includes('DeliverectWeb/Stores'))
  check('1 (denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–8: the page, its filters and its three writes (Accounts readable) ─────────────────────
{
  const { context, page, errors, lists, writes } = await open('ltr')
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 3)

  // 2: the rows
  check('2: the list asks the door with no params (linked=any is the default)', lists[0] === '', JSON.stringify(lists))
  check('2: a store with a location reads Linked', (await cell(page, '1234', 'state')) === 'Linked', await cell(page, '1234', 'state'))
  check(
    '2: a null location reads Onboarded, not linked',
    (await cell(page, '0099', 'state')) === 'Onboarded, not linked' && (await cell(page, '0099', 'linkedAt')) === '',
    await cell(page, '0099', 'state'),
  )
  check('2: the location and onboarded at/by show', (await cell(page, '1234', 'deliverectLocationId')) === '64f0c2a91b' && (await cell(page, '1234', 'onboardedAt')) === '2026-10-12 10:00' && (await cell(page, '1234', 'onboardedBy')) === 'HSADMIN')
  check('2: the direct-HungerStation badge shows on its store only', (await cell(page, '2001', 'onDirectHungerStation')) === 'Direct HungerStation' && (await cell(page, '1234', 'onDirectHungerStation')) === '')
  check(
    '2: 🚩 every sync and status null → NO sync or status column',
    (await page.locator('[data-stores-grid] [col-id="sync"]').count()) === 0 && (await page.locator('[data-stores-grid] [col-id="status"]').count()) === 0,
  )
  check('2: the count reads 3 stores', (await page.locator('[data-status-count]').innerText()) === '3 stores')
  await page.screenshot({ path: `${SHOTS}/ltr-list.png` })

  // 3: the filters
  const accountOptions = await page.locator('[data-filter-account] option').evaluateAll((els) => els.map((e) => e.value))
  check('3: the account filter offers the Accounts read', JSON.stringify(accountOptions) === JSON.stringify(['', 'AlDawaa', 'Dormant', 'OlaCare']), accountOptions.join())
  await page.locator('[data-filter-account]').selectOption('OlaCare')
  await waitRows(page, 2)
  check('3: account lands in the URL and on the door', urlSearch(page) === 'account=OlaCare' && lists.at(-1) === 'account=OlaCare', `${urlSearch(page)} / ${lists.at(-1)}`)
  await page.locator('[data-filter-linked]').selectOption('no')
  await waitRows(page, 1)
  check('3: linked=no lands in the URL and on the door', urlSearch(page) === 'account=OlaCare&linked=no' && lists.at(-1) === 'account=OlaCare&linked=no', lists.at(-1))
  await page.locator('[data-stores-clear]').click()
  await waitRows(page, 3)
  await page.locator('[data-filter-q]').fill(' olaya ')
  await page.locator('[data-stores-search]').click()
  await waitRows(page, 1)
  check('3: the text filter is trimmed into q on the door', urlSearch(page) === 'q=olaya' && lists.at(-1) === 'q=olaya', lists.at(-1))
  await page.goto(`${BASE}/deliverect/stores?account=AlDawaa&linked=yes`)
  await waitRows(page, 1)
  check('3: a pasted URL drives the door with the same query string', lists.at(-1) === 'account=AlDawaa&linked=yes', lists.at(-1))
  await page.locator('[data-stores-clear]').click()
  await waitRows(page, 3)
  check('3: Clear resets the URL', urlSearch(page) === '')
  // A typed but unsubmitted store is taken along by a filter change, never left showing over a
  // list that ignored it.
  await page.locator('[data-filter-q]').fill('jeddah')
  await page.locator('[data-filter-linked]').selectOption('no')
  await waitRows(page, 1)
  check('3: a filter change applies the text box as it reads', lists.at(-1) === 'linked=no&q=jeddah', lists.at(-1))
  await page.locator('[data-stores-clear]').click()
  await waitRows(page, 3)

  // 4: onboard — the reason rule
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  const confirm = page.locator('[data-reason-confirm]')
  check('4: Confirm waits for a store, an account and a reason', await confirm.isDisabled())
  await page.locator('[data-onboard-store]').fill('0555')
  await page.locator('[data-account-select]').selectOption('OlaCare')
  check('4: still waiting for the reason', await confirm.isDisabled())
  const inactive = await page.locator('[data-account-select] option[value="Dormant"]').evaluate((o) => o.disabled)
  check('4: an inactive account is shown but cannot be chosen', inactive)
  await page.locator('[data-reason-input]').fill('ع'.repeat(201))
  check(
    '4: 201 characters are refused inline and Confirm stays off',
    (await page.locator('[data-reason-too-long]').count()) === 1 && (await confirm.isDisabled()) && (await page.locator('[data-reason-count]').innerText()) === '201 / 200',
  )
  const reason = '  فرع جديد على OlaCare  '
  await page.locator('[data-reason-input]').fill(reason)
  check('4: a 1–200 character reason enables Confirm', !(await confirm.isDisabled()))
  const listsBefore = lists.length
  await confirm.click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const post = writes.at(-1)
  check(
    '4: onboard POSTs exactly { storeCode, accountKey, reason }, the reason trimmed and unicode kept',
    JSON.stringify(post.body) === JSON.stringify({ storeCode: '0555', accountKey: 'OlaCare', reason: reason.trim() }),
    JSON.stringify(post.body),
  )
  await page.waitForTimeout(400)
  check('4: the list is asked again after the write', lists.length > listsBefore)
  check('4: no warning for a store off the direct rail', (await page.locator('[data-onboard-warning]').count()) === 0)

  // 5: the warning path
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('pilot store')
  await page.locator('[data-onboard-store]').fill('0777')
  await page.locator('[data-account-select]').selectOption('AlDawaa')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const warning = page.locator('[data-onboard-warning="0777"]')
  await warning.waitFor({ timeout: 5000 })
  check('5: the direct-HungerStation answer is a warning (role=status), not an alert', (await warning.getAttribute('role')) === 'status')
  check('5: it is the attention tone, never danger', /bg-attention-050/.test(await warning.getAttribute('class')) && !/danger/.test(await warning.getAttribute('class')))
  check('5: it carries the server’s own sentence', (await page.locator('[data-onboard-warning-message]').innerText()) === WARNING)
  check('5: and no error banner shows', (await page.locator('[role="alert"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-warning.png` })
  await page.locator('[data-onboard-warning-dismiss]').click()
  check('5: the warning can be dismissed', (await page.locator('[data-onboard-warning]').count()) === 0)

  // 6: the refusals, inline
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('try')
  await page.locator('[data-account-select]').selectOption('OlaCare')
  await page.locator('[data-onboard-store]').fill('1234')
  await page.locator('[data-reason-confirm]').click()
  const r2 = page.locator('[data-onboard-dialog] [data-inline-refusal="DLV-00002"]')
  await r2.waitFor({ timeout: 5000 })
  check('6: DLV-00002 shows inline at the store, in the server’s words', (await r2.innerText()).includes(REFUSALS['DLV-00002'][1]))
  check('6: and not twice (no banner)', (await dialog(page).locator('[data-reason-error]').count()) === 0)
  check('6: the dialog stays open, the reason kept', (await page.locator('[data-reason-input]').inputValue()) === 'try')
  await page.locator('[data-onboard-store]').fill('9999')
  check('6: editing the field clears its refusal', (await page.locator('[data-inline-refusal]').count()) === 0)
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-onboard-dialog] [data-inline-refusal="DLV-00001"]').waitFor({ timeout: 5000 })
  check('6: DLV-00001 shows inline at the store', true)
  await page.locator('[data-onboard-store]').fill('0600')
  await page.locator('[data-reason-input]').fill('trigger 00009')
  await page.locator('[data-reason-confirm]').click()
  const r9 = dialog(page).locator('[data-inline-refusal="DLV-00009"]')
  await r9.waitFor({ timeout: 5000 })
  check('6: DLV-00009 shows inline at the reason, in the server’s words', (await r9.innerText()).includes(REFUSALS['DLV-00009'][1]))
  await page.screenshot({ path: `${SHOTS}/ltr-refusal.png` })
  await page.locator('[data-reason-cancel]').click()
  await dialog(page).waitFor({ state: 'detached' })

  // 7: move
  await page.locator('[data-store-move="1234"]').click()
  await dialog(page).waitFor()
  const moveNote = await page.locator('[data-reason-note]').innerText()
  check('7: move says the link to Deliverect is cleared', /link to Deliverect is cleared/.test(moveNote) && /1234/.test(moveNote), moveNote)
  const moveOptions = await page.locator('[data-account-select] option').evaluateAll((els) => els.map((e) => e.value))
  check('7: the current account is not offered', !moveOptions.includes('OlaCare') && moveOptions.includes('AlDawaa'), moveOptions.join())
  await page.locator('[data-account-select]').selectOption('AlDawaa')
  await page.locator('[data-reason-input]').fill('account change')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const put = writes.at(-1)
  check(
    '7: move PUTs { accountKey, reason } to Stores/1234',
    put.method === 'PUT' && put.path === 'DeliverectWeb/Stores/1234' && JSON.stringify(put.body) === JSON.stringify({ accountKey: 'AlDawaa', reason: 'account change' }),
    JSON.stringify(put),
  )

  // 8: remove
  await page.locator('[data-store-remove="0099"]').click()
  await dialog(page).waitFor()
  const removeNote = await page.locator('[data-reason-note]').innerText()
  check('8: remove says the sync stops and the link is cleared', /stock sync stops/.test(removeNote) && /link to Deliverect is cleared/.test(removeNote), removeNote)
  await page.locator('[data-reason-input]').fill('أغلق الفرع')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const del = writes.at(-1)
  check('8: remove DELETEs Stores/0099 with ?reason= (Arabic kept)', del.method === 'DELETE' && del.path === 'DeliverectWeb/Stores/0099' && del.reason === 'أغلق الفرع', JSON.stringify(del))

  check('ltr: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: Accounts refused (403) — the contract gap's fallback ──────────────────────────────────
{
  const { context, page, errors, writes } = await open('ltr', { accounts: 'refused' })
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 3)
  await page.waitForTimeout(300)
  const accountOptions = await page.locator('[data-filter-account] option').evaluateAll((els) => els.map((e) => e.value))
  check('9: the filter offers the accounts seen on the rows', JSON.stringify(accountOptions) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), accountOptions.join())
  await page.locator('[data-filter-account]').selectOption('AlDawaa')
  await waitRows(page, 1)
  const afterFilter = await page.locator('[data-filter-account] option').evaluateAll((els) => els.map((e) => e.value))
  check('9: filtering by one account never shrinks the choice', JSON.stringify(afterFilter) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), afterFilter.join())
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  check('9: the account field is a typed key, with the hint', (await page.locator('[data-account-input]').count()) === 1 && (await page.locator('[data-account-select]').count()) === 0 && (await page.locator('[data-account-fallback]').count()) === 1)
  const suggestions = await page.locator('dialog datalist option').evaluateAll((els) => els.map((e) => e.value))
  check('9: its suggestions are the rows’ accounts', JSON.stringify(suggestions) === JSON.stringify(['AlDawaa', 'OlaCare']), suggestions.join())
  await page.locator('[data-onboard-store]').fill('0601')
  await page.locator('[data-account-input]').fill('Nope')
  await page.locator('[data-reason-input]').fill('typed key')
  await page.locator('[data-reason-confirm]').click()
  const r3 = page.locator('[data-inline-refusal="DLV-00003"]')
  await r3.waitFor({ timeout: 5000 })
  check('9 / 6: a wrong typed key is DLV-00003, inline at the account', (await r3.innerText()).includes(REFUSALS['DLV-00003'][1]))
  await page.locator('[data-account-input]').fill('OlaCare')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check('9: a typed key onboards', JSON.stringify(writes.at(-1).body) === JSON.stringify({ storeCode: '0601', accountKey: 'OlaCare', reason: 'typed key' }))
  check('9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: RTL ─────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('rtl')
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 3)
  check('10: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  // ⚠️ The app's `lng` stays `en` everywhere (core/i18n.ts): `oms.locale=ar` sets the DIRECTION only,
  // so the copy here is English under RTL. The Arabic bundle is proven by its registration and by
  // the vitest mirror test (i18n-keys.test.ts); an owner's eye on rendered Arabic is outstanding.
  check('10: the page renders mirrored', (await page.locator('h1').innerText()) === 'Deliverect stores')
  const codes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-stores-grid] [col-id="storeCode"] bdi[dir="ltr"]')].map((b) => b.textContent),
  )
  check('10: store codes are isolated left-to-right (0099 keeps its zeros)', codes.includes('0099') && codes.includes('1234'), codes.join())
  check('10: the count isolates its number', (await page.locator('[data-status-count] bdi[dir="ltr"]').innerText()) === '3')
  await page.screenshot({ path: `${SHOTS}/rtl-list.png` })
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  await page.locator('[data-onboard-store]').fill('0777')
  await page.locator('[data-account-select]').selectOption('OlaCare')
  await page.locator('[data-reason-input]').fill('سبب')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  const title = page.locator('[data-onboard-warning] p.font-semibold bdi[dir="ltr"]')
  await title.waitFor({ timeout: 5000 })
  check('10: the warning isolates its store code', (await title.innerText()) === '0777')
  await page.screenshot({ path: `${SHOTS}/rtl-warning.png` })
  await page.locator('[data-store-move="1234"]').click()
  await dialog(page).waitFor()
  const isolated = await page.locator('[data-reason-note] bdi[dir="ltr"]').allInnerTexts()
  check('10: the move note isolates the store and the account', JSON.stringify(isolated) === JSON.stringify(['1234', 'OlaCare']), isolated.join())
  await page.screenshot({ path: `${SHOTS}/rtl-move.png` })
  await page.locator('[data-reason-cancel]').click()
  await dialog(page).waitFor({ state: 'detached' })
  // A refusal and a remove, mirrored.
  await page.locator('[data-stores-onboard]').click()
  await dialog(page).waitFor()
  await page.locator('[data-onboard-store]').fill('1234')
  await page.locator('[data-account-select]').selectOption('OlaCare')
  await page.locator('[data-reason-input]').fill('سبب')
  await page.locator('[data-reason-confirm]').click()
  const rtlRefusal = page.locator('[data-onboard-dialog] [data-inline-refusal="DLV-00002"]')
  await rtlRefusal.waitFor({ timeout: 5000 })
  check('10: DLV-00002 shows inline under RTL, its code isolated', (await rtlRefusal.locator('bdi[dir="ltr"]').innerText()) === 'DLV-00002')
  await page.screenshot({ path: `${SHOTS}/rtl-refusal.png` })
  await page.locator('[data-reason-cancel]').click()
  await dialog(page).waitFor({ state: 'detached' })
  await page.locator('[data-store-remove="2001"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('إزالة')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check('10: remove works under RTL', writes.at(-1).method === 'DELETE' && writes.at(-1).path === 'DeliverectWeb/Stores/2001')
  check('rtl: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 11: populated sync / status (what 2624 / 2625 will send) ────────────────────────────────
{
  const populated = [
    store('1234', {
      sync: { active: true, lastFullRun: '2026-10-12T07:05:00', lastDeltaRun: '2026-10-12T10:30:00', lastStatus: 'S', lastError: null },
      status: { state: 'busy', since: '2026-10-12T10:40:00', reason: 'Rush' },
    }),
    store('0099', { deliverectLocationId: null, linkedAt: null }),
  ]
  const { context, page, errors } = await open('ltr', { stores: populated })
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 2)
  check('11: a row carrying sync shows the stock sync column', (await cell(page, '1234', 'sync')) === 'Active', await cell(page, '1234', 'sync'))
  check('11: a row carrying status shows the store status column', (await cell(page, '1234', 'status')) === 'Busy', await cell(page, '1234', 'status'))
  check('11: a row whose blocks are null leaves its cells empty', (await cell(page, '0099', 'sync')) === '' && (await cell(page, '0099', 'status')) === '')
  check('11: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ═══ 480: the stock sync ══════════════════════════════════════════════════════════════════════

/** The populated sync blocks (what 2624 will send), read at 2026-10-12 11:00 local. */
const syncBlock = (over = {}) => ({
  active: true,
  lastFullRun: '2026-10-12T07:05:00',
  lastDeltaRun: '2026-10-12T10:30:00',
  lastStatus: 'S',
  lastError: null,
  ...over,
})
/** A store linked well before the clock, so the first-run grace after a link (sync-health) is behind it. */
const synced = (code, over = {}) => store(code, { linkedAt: '2026-10-01T09:00:00', ...over })
const SYNCED = [
  synced('1234', { sync: syncBlock() }),
  synced('0099', { storeName: 'Jeddah Tahlia', sync: syncBlock({ lastStatus: 'E', lastError: 'Deliverect refused the file: location unknown' }) }),
  synced('2001', {
    storeName: 'صيدلية الدواء - العليا',
    accountKey: 'AlDawaa',
    sync: syncBlock({ lastFullRun: '2026-10-11T07:04:00', lastDeltaRun: '2026-10-12T08:00:00' }),
  }),
  synced('3001', { storeName: 'Dammam Corniche', sync: syncBlock({ active: false, lastFullRun: '2026-10-01T07:05:00', lastDeltaRun: '2026-10-01T09:00:00' }) }),
  synced('4001', {
    storeName: 'Khobar',
    deliverectLocationId: null,
    linkedAt: null,
    sync: syncBlock({ lastFullRun: null, lastDeltaRun: null, lastStatus: null }),
  }),
  synced('5001', { storeName: 'Abha' }),
]
const ELEVEN = new Date(2026, 9, 12, 11, 0, 0)
const FSI = '⁨'
const PDI = '⁩'

/** The classes of one row (its pinned and centre parts) by store code. */
const rowClasses = (page, code) =>
  page.evaluate((c) => {
    const pinned = [...document.querySelectorAll('[data-stores-grid] .ag-row[row-index] [col-id="storeCode"]')].find(
      (el) => el.textContent === c,
    )
    const index = pinned?.closest('.ag-row')?.getAttribute('row-index')
    return [...document.querySelectorAll(`[data-stores-grid] .ag-row[row-index="${index}"]`)].map((r) => r.className).join(' ')
  }, code)

/** The ground a row's centre part actually paints (its `::after`), by store code — a class alone
 *  proves nothing if the theme paints over it. */
const painted = (page, code) =>
  page.evaluate((c) => {
    const pinned = [...document.querySelectorAll('[data-stores-grid] .ag-row[row-index] [col-id="storeCode"]')].find(
      (el) => el.textContent === c,
    )
    const index = pinned?.closest('.ag-row')?.getAttribute('row-index')
    const parts = [...document.querySelectorAll(`[data-stores-grid] .ag-row[row-index="${index}"]`)]
    return parts.length ? parts.map((r) => getComputedStyle(r, '::after').backgroundColor).join(' ') : null
  }, code)

// ── 12: the sync columns, the health and the highlight ────────────────────────────────────────
{
  const { context, page, errors } = await open('ltr', { stores: SYNCED })
  await page.clock.install({ time: ELEVEN })
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 6)
  const headers = await page.locator('[data-stores-grid] .ag-header-cell-text').allInnerTexts()
  check(
    '12: the sync columns are drawn — active, health, last full, last delta, last status, last error',
    ['Stock sync', 'Sync health', 'Last full run', 'Last delta run', 'Last status', 'Last error'].every((h) => headers.includes(h)),
    headers.join(' | '),
  )
  const health = {}
  for (const c of ['1234', '0099', '2001', '3001', '4001', '5001']) health[c] = await cell(page, c, 'syncHealth')
  check(
    '12: health reads Up to date / Failed / Overdue / Paused / Not run yet, and nothing on a null block',
    JSON.stringify(health) ===
      JSON.stringify({ 1234: 'Up to date', 2001: 'Overdue', 3001: 'Paused', 4001: 'Not run yet', 5001: '', '0099': 'Failed' }),
    JSON.stringify(health),
  )
  check('12: 🚩 a failed row is RED', /--danger-050/.test(await rowClasses(page, '0099')))
  check('12: an overdue row is AMBER', /--attention-050/.test(await rowClasses(page, '2001')))
  const grounds = { ok: await painted(page, '1234'), failed: await painted(page, '0099'), overdue: await painted(page, '2001') }
  check(
    '12: 🚩 the highlight is PAINTED — failed and overdue rows each draw a ground of their own',
    new Set(Object.values(grounds)).size === 3 && !Object.values(grounds).includes(null),
    JSON.stringify(grounds),
  )
  const quiet = await Promise.all(['1234', '3001', '4001', '5001'].map((c) => rowClasses(page, c)))
  check(
    '12: 🚩 ok, paused (stale runs), not linked and null-block rows are not highlighted',
    quiet.every((k) => !/--danger-050|--attention-050/.test(k)),
  )
  const why = await page.locator('[data-sync-health="overdue"]').getAttribute('title')
  check(
    '12: the overdue badge says which run is behind',
    why === `No full run since ${FSI}07:00${PDI} today. No run in the last ${FSI}60${PDI} minutes.`,
    why,
  )
  check(
    '12: last full / last delta read as local wall-clock',
    (await cell(page, '1234', 'lastFullRun')) === '2026-10-12 07:05' && (await cell(page, '1234', 'lastDeltaRun')) === '2026-10-12 10:30',
  )
  check(
    '12: last status and last error as sent',
    (await cell(page, '0099', 'lastStatus')) === 'E' && (await cell(page, '0099', 'lastError')) === 'Deliverect refused the file: location unknown',
  )
  check('12: the 477 sync cell still reads Active / Paused', (await cell(page, '1234', 'sync')) === 'Active' && (await cell(page, '3001', 'sync')) === 'Paused')
  check(
    '12: Pause on an active store, Resume on a paused one',
    (await page.locator('[data-sync-toggle="1234"]').innerText()) === 'Pause sync' &&
      (await page.locator('[data-sync-toggle="3001"]').innerText()) === 'Resume sync',
  )
  check('12: a null sync block has no sync actions', (await page.locator('[data-sync-toggle="5001"], [data-sync-logs="5001"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/sync-grid.png` })
  // The clock moves: 1234's last run was 10:30, so at 11:31 it is behind — with no refetch.
  await page.clock.fastForward('31:00')
  await page.waitForTimeout(300)
  check('12: a tick of the clock turns a store overdue without a refetch', (await cell(page, '1234', 'syncHealth')) === 'Overdue', await cell(page, '1234', 'syncHealth'))
  check('12: …and its row turns amber on the same tick', /--attention-050/.test(await rowClasses(page, '1234')))
  check('12: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: pause and resume, with a reason ──────────────────────────────────────────────────────
{
  const { context, page, errors, writes, lists } = await open('ltr', { stores: SYNCED })
  await page.clock.setFixedTime(ELEVEN)
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 6)
  await page.locator('[data-sync-toggle="1234"]').click()
  await dialog(page).waitFor()
  const note = await page.locator('[data-sync-note="pause"]').innerText()
  check('13: the pause note says it stops the stock pushes ONLY', /stops the stock pushes only/.test(note), note)
  check('13: …the store stays listed and still receives orders', /stays listed/.test(note) && /still receive orders/.test(note))
  check('13: the note isolates the store code', (await page.locator('[data-sync-note] bdi[dir="ltr"]').innerText()) === '1234')
  check('13: Confirm waits for a reason', await page.locator('[data-reason-confirm]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/sync-pause.png` })
  await page.locator('[data-reason-input]').fill('trigger 00009')
  await page.locator('[data-reason-confirm]').click()
  const r9 = page.locator('[data-reason-dialog] [data-inline-refusal="DLV-00009"]')
  await r9.waitFor({ timeout: 5000 })
  check("13: DLV-00009 shows inline at the reason, the server's own sentence", /A reason is required .* \/ السبب مطلوب/.test(await r9.innerText()))
  await page.locator('[data-reason-input]').fill('trigger 00001')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-reason-error="DLV-00001"]').waitFor({ timeout: 5000 })
  check('13: another refusal shows in the dialog with its code, the dialog open', (await dialog(page).count()) === 1)
  const before = lists.length
  await page.locator('[data-reason-input]').fill('  مخزون خاطئ — bad stock  ')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check(
    '13: pause PUTs exactly { active: false, reason } — trimmed, unicode kept',
    writes.at(-1).path === 'DeliverectWeb/Sync/1234/Active' &&
      JSON.stringify(writes.at(-1).body) === JSON.stringify({ active: false, reason: 'مخزون خاطئ — bad stock' }),
    JSON.stringify(writes.at(-1)),
  )
  await page.waitForTimeout(400)
  check('13: the list is read again after the write', lists.length > before)
  await page.locator('[data-sync-toggle="3001"]').click()
  await dialog(page).waitFor()
  check('13: resume says the pushes start again', /starts sending its stock to Deliverect again/.test(await page.locator('[data-sync-note="resume"]').innerText()))
  await page.locator('[data-reason-input]').fill('fixed')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check(
    '13: resume PUTs exactly { active: true, reason }',
    writes.at(-1).path === 'DeliverectWeb/Sync/3001/Active' && JSON.stringify(writes.at(-1).body) === JSON.stringify({ active: true, reason: 'fixed' }),
  )
  check('13: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 14: the logs drawer ──────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, logReads } = await open('ltr', { stores: SYNCED })
  await page.clock.setFixedTime(ELEVEN)
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 6)
  await page.locator('[data-sync-logs="1234"]').click()
  const drawer = page.locator('dialog[open][data-sync-logs-drawer="1234"]')
  await drawer.waitFor()
  await drawer.locator('[data-sync-logs-table]').waitFor({ timeout: 5000 })
  check('14: it reads Logs?take=50 for the store', JSON.stringify(logReads) === JSON.stringify([{ code: '1234', search: 'take=50' }]), JSON.stringify(logReads))
  const heads = await drawer.locator('thead th').allInnerTexts()
  check(
    '14: type, start, end, rows, status, file id, callback, error',
    JSON.stringify(heads) === JSON.stringify(['Type', 'Start', 'End', 'Rows', 'Status', 'File id', 'Deliverect callback', 'Error']),
    heads.join(' | '),
  )
  const read = (id, col) => drawer.locator(`[data-sync-log="${id}"] [data-log-${col}]`).innerText()
  const full = {}
  for (const col of ['type', 'start', 'end', 'rows', 'status', 'file', 'callback']) full[col] = await read('01JF0001', col)
  check(
    '14: the full run — Full, its times, rows grouped, Success S, file id, processed',
    JSON.stringify(full) ===
      JSON.stringify({
        type: 'Full',
        start: '2026-10-12 07:05',
        end: '2026-10-12 07:09',
        rows: '18,240',
        status: 'Success S',
        file: 'inv-7f3a9c',
        callback: 'processed',
      }),
    JSON.stringify(full),
  )
  check(
    '14: a failed run is red and shows its error',
    (await drawer.locator('[data-sync-log="01JD0002"]').getAttribute('class')).includes('bg-danger-050') &&
      (await read('01JD0002', 'error')) === 'Deliverect refused the file: location unknown' &&
      (await read('01JD0002', 'status')) === 'Failed E',
  )
  check(
    '14: a run still going reads Running, and a missing callback reads Not yet',
    (await read('01JD0003', 'end')) === 'Running' && (await read('01JD0003', 'callback')) === 'Not yet' && (await read('01JD0003', 'type')) === 'Delta',
  )
  check(
    '14: the title is the store · name pair, isolated once',
    (await drawer.locator('[data-sync-logs-title] bdi[dir="ltr"]').count()) === 1 &&
      (await drawer.locator('[data-sync-logs-title]').innerText()) === '1234 · Riyadh Olaya',
  )
  await page.screenshot({ path: `${SHOTS}/sync-logs.png` })
  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'detached', timeout: 5000 })
  check('14: Escape closes the drawer', (await page.locator('dialog[open]').count()) === 0)
  await page.locator('[data-sync-logs="2001"]').click()
  await page.locator('[data-sync-logs-error="DLV-00001"]').waitFor({ timeout: 5000 })
  check("14: a refused read shows the server's sentence", /No such store\. \/ لا يوجد/.test(await page.locator('[data-sync-logs-error]').innerText()))
  await page.locator('[data-sync-logs-close]').click()
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
  await page.locator('[data-sync-logs="0099"]').click()
  await page.locator('[data-sync-logs-empty]').waitFor({ timeout: 5000 })
  check('14: an empty log says no sync has run', (await page.locator('[data-sync-logs-empty]').innerText()) === 'No stock sync has run for this store yet.')
  check('14: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 15: RTL ──────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('rtl', { stores: SYNCED })
  await page.clock.setFixedTime(ELEVEN)
  await page.goto(`${BASE}/deliverect/stores`)
  await waitRows(page, 6)
  check(
    '15: dir is rtl and the health still reads',
    (await page.evaluate(() => document.documentElement.dir)) === 'rtl' && (await cell(page, '0099', 'syncHealth')) === 'Failed',
  )
  check(
    '15: the times isolate left-to-right',
    (await page.locator('[data-stores-grid] [col-id="lastFullRun"] bdi[dir="ltr"]').first().innerText()) === '2026-10-12 07:05',
  )
  await page.screenshot({ path: `${SHOTS}/rtl-sync-grid.png` })
  await page.locator('[data-sync-logs="1234"]').click()
  const drawer = page.locator('dialog[open][data-sync-logs-drawer="1234"]')
  await drawer.locator('[data-sync-logs-table]').waitFor({ timeout: 5000 })
  const iso = await drawer.locator('[data-sync-log="01JF0001"] bdi[dir="ltr"]').allInnerTexts()
  check(
    '15: the drawer isolates each machine value whole',
    ['2026-10-12 07:05', '18,240', 'inv-7f3a9c', 'processed'].every((v) => iso.includes(v)),
    iso.join(' | '),
  )
  await page.screenshot({ path: `${SHOTS}/rtl-sync-logs.png` })
  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'detached' })
  await page.locator('[data-sync-toggle="2001"]').click()
  await dialog(page).waitFor()
  await page.locator('[data-reason-input]').fill('توقف')
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 10000 })
  check('15: pause works under RTL', writes.at(-1).path === 'DeliverectWeb/Sync/2001/Active' && writes.at(-1).body.active === false)
  check('15: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
