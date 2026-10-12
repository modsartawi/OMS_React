// Deliverect catalog drive (ticket 479, BackOffice spec 2615).
//
// Drives the REAL app in Chromium against STUBS of the Deliverect door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md § Catalog; Platforms
// and Accounts reads) — BackOffice 2623 is not built, so there is no live SIS.Api to point at. Every
// fixture emits EXACTLY the contract's fields, on the REAL envelope { statusCode, success, message,
// errors: [{ errorCode, internalErrorCode, errorMessage }], data }, and every refusal's errorMessage
// is "<English> / <Arabic>":
//   GET  DeliverectWeb/Access                      → { canManageStores, canManageCatalog, canViewOrders, canManageTerms }
//   GET  DeliverectWeb/Whitelist?q=&state=&skip=&take=
//                                                  → { total, rows: [{ materialNumber, nameEn, nameAr, gtins, disabled,
//                                                      deleted, excludedPlatforms, updatedAt, updatedBy }] }
//   POST DeliverectWeb/Whitelist/Import            → { added, reactivated, unknown }; DLV-00012
//   PUT  DeliverectWeb/Whitelist/{material}        → body { disabled, deleted, reason }
//   PUT  DeliverectWeb/Exclusions/{material}       → body { platforms, reason }; DLV-00004, DLV-00005
//   POST DeliverectWeb/Catalog/Push?account=       → { fileId, status, rows }; DLV-00011
//   GET  DeliverectWeb/Platforms                   → 200 [{ platformKey, displayName, channelId, creditCustomer, active }]
//                                                    OR 403 (the contract puts it behind canManageTerms)
//   GET  DeliverectWeb/Accounts                    → 200 [{ accountKey, deliverectAccountId, active }] OR 403 (same)
//
// It asserts:
//   1. the Catalog leaf joins the Deliverect group on canManageCatalog, after Orders; without it the
//      leaf is hidden and the URL shows the denied card with no Whitelist call; one probe call;
//   2. the grid: material, both names (bidi), GTINs as one isolate, disabled / deleted flags, the
//      excluded platforms as chips, updated at / by; state and text land on the door and the URL;
//      a pasted URL drives the door; paging sends take=500 and Next sends skip=500;
//   3. import by paste: header skipped, repeats dropped, the count; the POST body is exactly
//      { materialNumbers, reason }; the answer shows added / re-activated / the unknown list, and
//      Copy puts the unknown list on the clipboard; DLV-00012 shows inline; over 5000 is refused
//      on screen with NO call;
//   4. import by .xlsx: a one-column workbook fills the list; a two-column one and one over 5000
//      rows are refused client-side;
//   5. disable / restore / delete send { disabled, deleted, reason } as the row's state allows (a restore
//      undoes one step: a deleted row that was disabled comes back disabled);
//   6. exclusions: a box per platform, unticked = excluded, the note says "out of stock on that
//      platform only"; Save is off until something changes; the PUT REPLACES the set and KEEPS a
//      key the Platforms read does not list (shown as a read-only chip); Platforms 403 → the
//      "platform list unavailable" state, Save disabled, no PUT;
//   7. push: the account from Accounts → POST Catalog/Push?account=…, the file id, status and rows
//      shown; DLV-00011 shows Deliverect's answer inline; Accounts 403 → a typed account key;
//   8. under RTL (direction) machine values are isolated, and an exclusion save works.
//
//   1. run the app:  npx vite --port 5196 --strictPort
//   2. DRIVE_PORT=5196 node tools/deliverect-catalog-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { crc32 } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.deliverect-catalog-shots'
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
  'DLV-00011': [502, 'Deliverect refused the call: too many deletions. / رفضت Deliverect الطلب: حذف كثير.'],
  'DLV-00012': [400, 'Row 2 is not a material number. / الصف 2 ليس رقم مادة.'],
  Forbidden: [403, 'Access denied. / تم رفض الوصول.'],
}
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

/** A whitelist row exactly as the contract has it. */
const material = (materialNumber, over = {}) => ({
  materialNumber,
  nameEn: 'Panadol 500mg 24 tabs',
  nameAr: 'بنادول 500 ملغ 24 قرص',
  gtins: ['6281001234567', '6281001234574'],
  disabled: false,
  deleted: false,
  excludedPlatforms: [],
  updatedAt: '2026-10-12T10:05:00',
  updatedBy: 'HSADMIN',
  ...over,
})

const ROWS = [
  material('101234', { excludedPlatforms: ['KEETA'] }),
  // OLDAPP is not in the Platforms read: it must be kept and shown read-only.
  material('101235', { nameEn: 'Vitamin C', nameAr: 'فيتامين سي', gtins: ['6281009999990'], excludedPlatforms: ['OLDAPP', 'JAHEZ'] }),
  material('101236', { nameEn: 'Brufen 400', nameAr: 'بروفين 400', disabled: true }),
  material('101237', { nameEn: 'Old item', nameAr: 'صنف قديم', disabled: true, deleted: true, gtins: [] }),
]

const PLATFORMS = [
  { platformKey: 'JAHEZ', displayName: 'Jahez', channelId: 0, creditCustomer: '0001100001', active: true },
  { platformKey: 'KEETA', displayName: 'Keeta', channelId: 7, creditCustomer: '0001100002', active: true },
  { platformKey: 'MRSOOL', displayName: 'Mrsool', channelId: 9, creditCustomer: null, active: false },
]
const ACCOUNTS = [
  { accountKey: 'OlaCare', deliverectAccountId: '64fACC01', active: true },
  { accountKey: 'AlDawaa', deliverectAccountId: '64fACC02', active: true },
]

const stateOf = (r) => (r.deleted ? 'deleted' : r.disabled ? 'disabled' : 'active')
function whitelistAnswer(qs) {
  const state = qs.get('state') ?? 'active'
  const q = (qs.get('q') ?? '').toLowerCase()
  const rows = ROWS.filter(
    (r) => (state === 'any' || stateOf(r) === state) && (!q || [r.materialNumber, r.nameEn, r.nameAr].some((v) => v.toLowerCase().includes(q))),
  )
  return { total: rows.length, rows }
}

// ── A minimal .xlsx (stored zip, inline strings) — enough for the app's core reader ──────────────
function zip(files) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8')
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBuf, data)
    centrals.push(central, nameBuf)
    offset += 30 + nameBuf.length + data.length
  }
  const dir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(dir.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, dir, end])
}
const colName = (i) => String.fromCharCode(65 + i)
function workbook(rows) {
  const sheet = rows
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row.map((v, c) => `<c r="${colName(c)}${r + 1}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`,
    )
    .join('')
  return zip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': '<?xml version="1.0"?><workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet><sheetData>${sheet}</sheetData></worksheet>`,
  })
}
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManageTerms: true }

const browser = await chromium.launch()

async function open(dir, { access = ALL, platforms = 'ok', accounts = 'ok', total = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const lists = []
  const writes = []
  page.on('pageerror', (e) => errors.push(String(e)))
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
    const body = () => JSON.parse(req.postData() ?? 'null')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DeliverectWeb/Access') return route.fulfill(envelope(access))
    if (p === 'DeliverectWeb/Platforms') return route.fulfill(platforms === 'ok' ? envelope(PLATFORMS) : refuse('Forbidden'))
    if (p === 'DeliverectWeb/Accounts') return route.fulfill(accounts === 'ok' ? envelope(ACCOUNTS) : refuse('Forbidden'))
    if (p === 'DeliverectWeb/Whitelist' && req.method() === 'GET') {
      lists.push(url.search.slice(1))
      const answer = whitelistAnswer(url.searchParams)
      return route.fulfill(envelope(total === null ? answer : { ...answer, total }))
    }
    if (p === 'DeliverectWeb/Whitelist/Import' && req.method() === 'POST') {
      const b = body()
      writes.push({ door: 'import', body: b })
      if (b.materialNumbers.includes('BAD-ROW')) return route.fulfill(refuse('DLV-00012'))
      return route.fulfill(envelope({ added: 2, reactivated: 1, unknown: b.materialNumbers.filter((m) => m.startsWith('9')) }))
    }
    let m = /^DeliverectWeb\/(Whitelist|Exclusions)\/([^/]+)$/.exec(p)
    if (m && req.method() === 'PUT') {
      writes.push({ door: m[1], material: decodeURIComponent(m[2]), body: body() })
      return route.fulfill(envelope(null))
    }
    if (p === 'DeliverectWeb/Catalog/Push' && req.method() === 'POST') {
      const account = url.searchParams.get('account')
      writes.push({ door: 'push', account, body: body() })
      if (account === 'AlDawaa') return route.fulfill(refuse('DLV-00011'))
      return route.fulfill(envelope({ fileId: 'f-01J9ZK', status: 'processing', rows: 1234 }))
    }
    if (p === 'MaterialWeb/Access') return route.fulfill(envelope({ canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, lists, writes }
}

const waitRows = async (page, n) => {
  await page.waitForFunction(
    (count) =>
      new Set([...document.querySelectorAll('[data-catalog-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size ===
        count && !document.querySelector('[data-catalog-grid] .ag-overlay-loading-center'),
    n,
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}
const cellLoc = (page, id, colId) => page.locator(`[data-catalog-grid] .ag-row[row-id="${id}"] [col-id="${colId}"]`)
const cell = async (page, id, colId) => ((await cellLoc(page, id, colId).count()) ? (await cellLoc(page, id, colId).innerText()).trim() : null)
const urlSearch = (page) => new URL(page.url()).search.slice(1)
const lastList = (lists) => new URLSearchParams(lists.at(-1))
const dialog = (page) => page.locator('dialog[open]')
const closed = (page) => page.locator('dialog[open]').waitFor({ state: 'detached', timeout: 10000 })
const giveReason = async (page, text) => page.locator('dialog[open] [data-reason-input]').fill(text)
const ACTIVE = ROWS.filter((r) => stateOf(r) === 'active').length

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/catalog"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/deliverect"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check(
    '1: the Catalog leaf joins the group after Orders',
    JSON.stringify(hrefs) === JSON.stringify(['/deliverect/stores', '/deliverect/orders', '/deliverect/catalog']),
    hrefs.join(),
  )
  check('1: the leaf reads "Catalog"', (await page.locator('nav a[href="/deliverect/catalog"]').first().innerText()).trim() === 'Catalog')
  await page.locator('nav a[href="/deliverect/catalog"]').first().click()
  await waitRows(page, ACTIVE)
  check('1: the group, its leaves and the page gate cost ONE probe call', calls.filter((c) => c === 'DeliverectWeb/Access').length === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canManageCatalog: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/stores"]').first().waitFor({ timeout: 5000 })
  check('1: 🚩 without canManageCatalog the Catalog leaf is hidden', (await page.locator('nav a[href="/deliverect/catalog"]').count()) === 0)
  await page.goto(`${BASE}/deliverect/catalog`)
  await page.getByText('No access to the Deliverect catalog').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card and asks no Whitelist call', !calls.includes('DeliverectWeb/Whitelist'))
  check('1 (denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page } = await open('ltr', { access: { canManageStores: false, canManageCatalog: true, canViewOrders: false, canManageTerms: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Deliverect$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/deliverect/catalog"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/deliverect"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: a session holding only canManageCatalog gets a one-leaf group', JSON.stringify(hrefs) === JSON.stringify(['/deliverect/catalog']), hrefs.join())
  await context.close()
}

// ── 2: the grid and its filters ────────────────────────────────────────────────────────────────
{
  const { context, page, errors, lists } = await open('ltr')
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  const first = lastList(lists)
  check('2: the first read is state=active, skip=0, take=500', first.get('state') === 'active' && first.get('skip') === '0' && first.get('take') === '500', lists.at(-1))
  check('2: material', (await cell(page, '101234', 'materialNumber')) === '101234')
  check('2: the English name', (await cell(page, '101234', 'nameEn')) === 'Panadol 500mg 24 tabs')
  check('2: the Arabic name, isolated as free text', (await cellLoc(page, '101234', 'nameAr').locator('bdi').first().innerText()) === 'بنادول 500 ملغ 24 قرص')
  check('2: the GTINs are ONE ltr isolate', (await cellLoc(page, '101234', 'gtins').locator('bdi[dir="ltr"]').allInnerTexts()).join('|') === '6281001234567, 6281001234574')
  const chips = await cellLoc(page, '101235', 'excludedPlatforms').locator('[data-platform-chip]').evaluateAll((els) => els.map((e) => e.dataset.platformChip))
  check('2: the excluded platforms are chips', JSON.stringify(chips) === JSON.stringify(['OLDAPP', 'JAHEZ']), chips.join())
  check('2: updated at', (await cell(page, '101234', 'updatedAt')) === '2026-10-12 10:05')
  check('2: updated by', (await cell(page, '101234', 'updatedBy')) === 'HSADMIN')
  check('2: an active row offers Disable and Delete', (await cellLoc(page, '101234', 'actions').locator('[data-row-action]').evaluateAll((els) => els.map((e) => e.dataset.rowAction))).join() === 'disable,delete')
  check('2: the count reads 2 materials', (await page.locator('[data-status-count]').innerText()).trim() === '2 materials')

  await page.locator('[data-filter-state="disabled"]').click()
  await waitRows(page, 1)
  check('2: the state filter lands on the door and the URL', lastList(lists).get('state') === 'disabled' && urlSearch(page) === 'state=disabled')
  check('2: a disabled row shows its flag and offers Restore and Delete', (await cellLoc(page, '101236', 'disabled').locator('[data-whitelist-flag="disabled"]').count()) === 1 &&
    (await cellLoc(page, '101236', 'actions').locator('[data-row-action]').evaluateAll((els) => els.map((e) => e.dataset.rowAction))).join() === 'restore,delete')
  await page.locator('[data-filter-state="any"]').click()
  await waitRows(page, ROWS.length)
  check('2: a deleted row shows both flags and offers Restore only', (await cellLoc(page, '101237', 'deleted').locator('[data-whitelist-flag="deleted"]').count()) === 1 &&
    (await cellLoc(page, '101237', 'actions').locator('[data-row-action]').evaluateAll((els) => els.map((e) => e.dataset.rowAction))).join() === 'restore')
  await page.locator('[data-filter-q]').fill('vitamin')
  await page.locator('[data-catalog-search]').click()
  await waitRows(page, 1)
  check('2: text lands on the door and the URL', lastList(lists).get('q') === 'vitamin' && new URLSearchParams(urlSearch(page)).get('q') === 'vitamin')
  await page.locator('[data-catalog-clear]').click()
  await waitRows(page, ACTIVE)
  check('2: Clear returns to the default', urlSearch(page) === '' && lastList(lists).get('state') === 'active' && !lastList(lists).get('q'))
  await page.goto(`${BASE}/deliverect/catalog?state=deleted&q=old`)
  await waitRows(page, 1)
  check('2: a pasted URL drives the door', lastList(lists).get('state') === 'deleted' && lastList(lists).get('q') === 'old')
  await page.screenshot({ path: `${SHOTS}/ltr-grid.png` })
  check('2: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, lists } = await open('ltr', { total: 1234 })
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  check('2: total > rows shows the page range', /Showing\s*1–2\s*of\s*1,234/.test(await page.locator('[data-status-count]').innerText()))
  // A search typed but not submitted does not ride the pager.
  await page.locator('[data-filter-q]').fill('typed-not-searched')
  await page.locator('[data-catalog-next]').click()
  await page.waitForFunction(() => location.search.includes('skip=500'))
  await page.waitForTimeout(300)
  check('2: Next sends skip=500, take=500', lastList(lists).get('skip') === '500' && lastList(lists).get('take') === '500')
  check('2: … with the SUBMITTED search, not the one typed', !lastList(lists).get('q') && !urlSearch(page).includes('typed'), urlSearch(page))
  await context.close()
}
{
  // A page past the end (rows: [] for skip > 0) goes back to the last page that holds rows.
  const { context, page, lists } = await open('ltr')
  await page.route('**/api/DeliverectWeb/Whitelist?*', (route) => {
    const qs = new URL(route.request().url()).searchParams
    lists.push(qs.toString())
    return route.fulfill(envelope(Number(qs.get('skip')) > 0 ? { total: 500, rows: [] } : { total: 500, rows: ROWS.slice(0, 2) }))
  })
  await page.goto(`${BASE}/deliverect/catalog?skip=1000`)
  await page.waitForFunction(() => !location.search.includes('skip=1000'), null, { timeout: 10000 })
  await page.waitForTimeout(300)
  check('2: a page past the end snaps back to the last page (skip=0 for 500 rows)', urlSearch(page) === '' && lastList(lists).get('skip') === '0', urlSearch(page))
  await context.close()
}

// ── 3–4: import ────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes, lists } = await open('ltr')
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  await page.locator('[data-catalog-import]').click()
  await dialog(page).locator('[data-import-dialog]').waitFor()
  await page.locator('[data-import-text]').fill('Material\n 101234 \n901111\n101234\n\n902222, 101240')
  check('3: the header line is skipped and said', (await page.locator('[data-import-header]').innerText()).includes('Material'))
  check('3: the count is distinct materials, repeats said', (await page.locator('[data-import-count]').getAttribute('data-import-count')) === '4' && /1 repeat dropped/.test(await page.locator('[data-import-count]').innerText()))
  check('3: Import waits for a reason', await page.locator('[data-reason-confirm]').isDisabled())
  await giveReason(page, '  New online range — نطاق جديد  ')
  const before = lists.length
  await page.locator('[data-reason-confirm]').click()
  await dialog(page).locator('[data-import-result]').waitFor({ timeout: 10000 })
  const sent = writes.find((w) => w.door === 'import')
  check(
    '3: the POST body is exactly { materialNumbers, reason } — trimmed, de-duplicated, header dropped',
    JSON.stringify(sent?.body) === JSON.stringify({ materialNumbers: ['101234', '901111', '902222', '101240'], reason: 'New online range — نطاق جديد' }),
    JSON.stringify(sent?.body),
  )
  check('3: the answer shows added and re-activated', (await page.locator('[data-result-added]').innerText()) === '2' && (await page.locator('[data-result-reactivated]').innerText()) === '1')
  const unknown = await page.locator('[data-result-unknown] li').allInnerTexts()
  check('3: the unknown list is shown', JSON.stringify(unknown) === JSON.stringify(['901111', '902222']), unknown.join())
  await page.locator('[data-result-copy]').click()
  await page.waitForTimeout(300)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  // The OS clipboard may hand the line breaks back as CRLF (Windows).
  check('3: Copy puts the unknown list on the clipboard, one per line', clip.replace(/\r\n/g, '\n') === '901111\n902222', JSON.stringify(clip))
  await page.screenshot({ path: `${SHOTS}/ltr-import-result.png` })
  await page.locator('[data-result-close]').click()
  await closed(page)
  check('3: the import re-reads the whitelist', lists.length > before)

  // DLV-00012 inline, the dialog staying open.
  await page.locator('[data-catalog-import]').click()
  await page.locator('[data-import-text]').fill('101234\nBAD-ROW')
  await giveReason(page, 'Retry')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-inline-refusal="DLV-00012"]').waitFor({ timeout: 10000 })
  check('3: DLV-00012 shows inline with the server’s words', (await page.locator('[data-inline-refusal="DLV-00012"]').innerText()).includes('Row 2 is not a material number. / الصف 2 ليس رقم مادة.'))
  check('3: the dialog stays open on the refusal', (await dialog(page).locator('[data-import-dialog]').count()) === 1)

  // Over 5000: refused on screen, nothing sent.
  const imports = writes.filter((w) => w.door === 'import').length
  // A 5001-line value is set in one go (React's own setter + one input event): `fill` stalls on it.
  await page.locator('[data-import-text]').evaluate((el, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, Array.from({ length: 5001 }, (_, i) => String(300000 + i)).join('\n'))
  await page.locator('[data-import-over-cap]').waitFor()
  const overCap = await page.locator('[data-import-over-cap]').innerText()
  check('3: 5001 materials are refused on screen', /at most\W*5,000\W*materials\. Remove\W*1\W*material/.test(overCap), overCap)
  check('3: … and Import is disabled', await page.locator('[data-reason-confirm]').isDisabled())
  check('3: … and nothing was sent', writes.filter((w) => w.door === 'import').length === imports)

  // 4: an .xlsx.
  await page.locator('[data-import-file]').setInputFiles({ name: 'materials.xlsx', mimeType: XLSX, buffer: workbook([['Material'], ['101250'], ['101251'], ['101250']]) })
  await page.locator('[data-import-file-note="info"]').waitFor({ timeout: 5000 })
  check('4: a one-column workbook fills the list (header and repeats dropped)', (await page.locator('[data-import-text]').inputValue()) === '101250\n101251')
  check('4: … and the file’s header and repeat are said, as a paste’s are', (await page.locator('[data-import-header]').innerText()).includes('Material') && /1\W*repeat dropped/.test(await page.locator('[data-import-count]').innerText()))
  const readNote = await page.locator('[data-import-file-note]').innerText()
  check('4: … and says so', /2\W*materials read from/.test(readNote), readNote)
  await page.locator('[data-import-file]').setInputFiles({ name: 'two.xlsx', mimeType: XLSX, buffer: workbook([['Material', 'Name'], ['101250', 'Panadol']]) })
  await page.locator('[data-import-file-note="error"]').waitFor({ timeout: 5000 })
  check('4: a two-column workbook is refused', /more than one column/.test(await page.locator('[data-import-file-note]').innerText()))
  check('4: … and the list is left as it was', (await page.locator('[data-import-text]').inputValue()) === '101250\n101251')
  await page.locator('[data-import-file]').setInputFiles({
    name: 'big.xlsx',
    mimeType: XLSX,
    buffer: workbook(Array.from({ length: 5003 }, (_, i) => [String(400000 + i)])),
  })
  await page.waitForFunction(() => /5,003\W*materials/.test(document.querySelector('[data-import-file-note]')?.textContent ?? ''), null, { timeout: 10000 })
  check('4: a workbook over 5000 rows is refused client-side', /at most\W*5,000\W*\. Split the file/.test(await page.locator('[data-import-file-note]').innerText()))
  check('4: … and not loaded', (await page.locator('[data-import-text]').inputValue()) === '101250\n101251')
  // "Over 5000 rows" counts the sheet's rows: 5001 rows of only two distinct numbers are refused too.
  await page.locator('[data-import-file]').setInputFiles({
    name: 'repeats.xlsx',
    mimeType: XLSX,
    buffer: workbook(Array.from({ length: 5001 }, (_, i) => [String(500000 + (i % 2))])),
  })
  await page.waitForFunction(() => /5,001\W*materials/.test(document.querySelector('[data-import-file-note]')?.textContent ?? ''), null, { timeout: 10000 })
  check('4: a sheet over 5000 ROWS is refused even when its distinct materials are fewer', (await page.locator('[data-import-text]').inputValue()) === '101250\n101251')
  await page.locator('[data-import-file]').setInputFiles({ name: 'notes.xlsx', mimeType: XLSX, buffer: Buffer.from('not a workbook') })
  await page.waitForFunction(() => /could not be read/.test(document.querySelector('[data-import-file-note]')?.textContent ?? ''), null, { timeout: 5000 })
  check('4: an unreadable file says so', true)
  check('3–4: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: disable / restore / delete ──────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('ltr')
  await page.goto(`${BASE}/deliverect/catalog?state=any`)
  await waitRows(page, ROWS.length)
  const act = async (materialNumber, action, reason) => {
    await page.locator(`[data-row-material="${materialNumber}"][data-row-action="${action}"]`).click()
    await dialog(page).locator(`[data-action-note="${action}"]`).waitFor()
    await giveReason(page, reason)
    await page.locator('[data-reason-confirm]').click()
    await closed(page)
    return writes.at(-1)
  }
  let w = await act('101234', 'disable', 'Recall')
  check('5: Disable PUTs Whitelist/101234 { disabled: true, deleted: false, reason }', w.door === 'Whitelist' && w.material === '101234' && JSON.stringify(w.body) === JSON.stringify({ disabled: true, deleted: false, reason: 'Recall' }), JSON.stringify(w))
  w = await act('101236', 'restore', 'Back in range')
  check('5: Restore PUTs { disabled: false, deleted: false, reason }', w.material === '101236' && JSON.stringify(w.body) === JSON.stringify({ disabled: false, deleted: false, reason: 'Back in range' }), JSON.stringify(w))
  await page.locator('[data-row-material="101236"][data-row-action="delete"]').click()
  check('5: Delete confirms on the danger button', (await page.locator('[data-reason-confirm]').getAttribute('class')).includes('danger'))
  await page.locator('[data-reason-cancel]').click()
  await closed(page)
  w = await act('101236', 'delete', 'Discontinued')
  check('5: Delete keeps the disabled flag: { disabled: true, deleted: true, reason }', JSON.stringify(w.body) === JSON.stringify({ disabled: true, deleted: true, reason: 'Discontinued' }), JSON.stringify(w))
  w = await act('101237', 'restore', 'Relisted')
  check('5: Restoring a deleted (and disabled) row undoes the delete only — it stays disabled', JSON.stringify(w.body) === JSON.stringify({ disabled: true, deleted: false, reason: 'Relisted' }), JSON.stringify(w.body))
  check('5: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: platform exclusions ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('ltr')
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  await page.locator('[data-row-exclusions="101235"]').click()
  await dialog(page).locator('[data-exclusions-boxes]').waitFor({ timeout: 10000 })
  const boxes = await page.locator('[data-exclusion-box]').evaluateAll((els) => els.map((e) => `${e.dataset.exclusionBox}:${e.checked}`))
  check('6: a box per platform; unticked = excluded', JSON.stringify(boxes) === JSON.stringify(['JAHEZ:false', 'KEETA:true', 'MRSOOL:true']), boxes.join())
  check('6: the note says excluded means out of stock on that platform only', /out of stock on that platform only/.test(await page.locator('[data-exclusions-note]').innerText()))
  const unlisted = await page.locator('[data-exclusions-unlisted] [data-platform-chip]').evaluateAll((els) => els.map((e) => e.dataset.platformChip))
  check('6: 🚩 a key the read does not list is a read-only chip', JSON.stringify(unlisted) === JSON.stringify(['OLDAPP']), unlisted.join())
  await giveReason(page, 'Keeta delisting')
  check('6: Save stays off until something changes', await page.locator('[data-reason-confirm]').isDisabled())
  await page.locator('[data-exclusion-box="KEETA"]').uncheck()
  await page.locator('[data-exclusion-box="JAHEZ"]').check()
  check('6: Save is on once changed', !(await page.locator('[data-reason-confirm]').isDisabled()))
  await page.screenshot({ path: `${SHOTS}/ltr-exclusions.png` })
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  const w = writes.at(-1)
  check(
    '6: the PUT REPLACES the set and KEEPS the unlisted key',
    w.door === 'Exclusions' && w.material === '101235' && JSON.stringify(w.body) === JSON.stringify({ platforms: ['KEETA', 'OLDAPP'], reason: 'Keeta delisting' }),
    JSON.stringify(w),
  )
  await page.locator('[data-row-exclusions="101234"]').click()
  await dialog(page).locator('[data-exclusions-boxes]').waitFor({ timeout: 10000 })
  await page.locator('[data-exclusion-box="KEETA"]').check()
  await giveReason(page, 'Back on Keeta')
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  check('6: ticking every box sends [] — back on every platform', JSON.stringify(writes.at(-1).body) === JSON.stringify({ platforms: [], reason: 'Back on Keeta' }))
  check('6: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, writes } = await open('ltr', { platforms: 'refused' })
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  await page.locator('[data-row-exclusions="101234"]').click()
  await dialog(page).locator('[data-exclusions-unavailable]').waitFor({ timeout: 10000 })
  check('6 (403): the "platform list unavailable" state shows', /platform list is unavailable/i.test(await page.locator('[data-exclusions-unavailable]').innerText()))
  check('6 (403): 🚩 no box is drawn', (await page.locator('[data-exclusion-box]').count()) === 0)
  await giveReason(page, 'Try anyway')
  check('6 (403): 🚩 Save is disabled', await page.locator('[data-reason-confirm]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/ltr-exclusions-403.png` })
  await page.locator('[data-reason-cancel]').click()
  await closed(page)
  check('6 (403): nothing was sent', !writes.some((w) => w.door === 'Exclusions'))
  check('6 (403): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: push the catalog ────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('ltr')
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  await page.locator('[data-catalog-push]').click()
  await dialog(page).locator('[data-push-account-select]').waitFor()
  check('7: Push waits for an account', await page.locator('[data-push-confirm]').isDisabled())
  await page.locator('[data-push-account-select]').selectOption('OlaCare')
  await page.locator('[data-push-confirm]').click()
  await page.locator('[data-push-result]').waitFor({ timeout: 10000 })
  const w = writes.at(-1)
  check('7: POST Catalog/Push?account=OlaCare', w.door === 'push' && w.account === 'OlaCare', JSON.stringify(w))
  check('7: the file id, status and rows are shown', (await page.locator('[data-push-file-id]').innerText()) === 'f-01J9ZK' && (await page.locator('[data-push-status]').innerText()) === 'processing' && (await page.locator('[data-push-rows]').innerText()) === '1,234')
  check('7: a second click cannot push the same account again', await page.locator('[data-push-confirm]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/ltr-push.png` })
  await page.locator('[data-push-account-select]').selectOption('AlDawaa')
  await page.locator('[data-push-confirm]').click()
  await page.locator('[data-push-refusal="DLV-00011"]').waitFor({ timeout: 10000 })
  check('7: DLV-00011 shows Deliverect’s answer inline', (await page.locator('[data-push-refusal]').innerText()).includes('too many deletions. / رفضت Deliverect الطلب: حذف كثير.'))
  check('7: … and the earlier success no longer stands beside it', (await page.locator('[data-push-result]').count()) === 0)
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, writes } = await open('ltr', { accounts: 'refused' })
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  await page.locator('[data-catalog-push]').click()
  await dialog(page).locator('[data-push-account-input]').waitFor({ timeout: 10000 })
  check('7 (403): the account is typed, and the dialog says why', (await page.locator('[data-push-account-fallback]').count()) === 1)
  await page.locator('[data-push-account-input]').fill(' OlaCare ')
  await page.locator('[data-push-confirm]').click()
  await page.locator('[data-push-result]').waitFor({ timeout: 10000 })
  check('7 (403): a typed key is pushed trimmed', writes.at(-1).account === 'OlaCare')
  check('7 (403): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: RTL ─────────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('rtl')
  await page.goto(`${BASE}/deliverect/catalog`)
  await waitRows(page, ACTIVE)
  check('8: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('8: the material is one ltr isolate', (await cellLoc(page, '101234', 'materialNumber').locator('bdi[dir="ltr"]').innerText()) === '101234')
  check('8: the GTINs are ONE ltr isolate', (await cellLoc(page, '101234', 'gtins').locator('bdi[dir="ltr"]').count()) === 1)
  check('8: each platform chip is its own ltr isolate', (await cellLoc(page, '101235', 'excludedPlatforms').locator('[data-platform-chip] bdi[dir="ltr"]').count()) === 2)
  check('8: the count isolates its number', (await page.locator('[data-status-count] bdi[dir="ltr"]').innerText()) === '2')
  await page.screenshot({ path: `${SHOTS}/rtl-grid.png` })
  await page.locator('[data-row-exclusions="101235"]').click()
  await dialog(page).locator('[data-exclusions-boxes]').waitFor({ timeout: 10000 })
  check('8: the dialog’s material is an ltr isolate, its names free text', (await page.locator('[data-dialog-material] bdi[dir="ltr"]').innerText()) === '101235' && (await page.locator('[data-dialog-material] bdi:not([dir])').count()) === 2)
  await page.locator('[data-exclusion-box="MRSOOL"]').uncheck()
  await giveReason(page, 'استثناء مرسول')
  await page.screenshot({ path: `${SHOTS}/rtl-exclusions.png` })
  await page.locator('[data-reason-confirm]').click()
  await closed(page)
  check('8: an exclusion save works under RTL', JSON.stringify(writes.at(-1).body) === JSON.stringify({ platforms: ['JAHEZ', 'MRSOOL', 'OLDAPP'], reason: 'استثناء مرسول' }), JSON.stringify(writes.at(-1)?.body))
  await page.locator('[data-catalog-import]').click()
  await page.locator('[data-import-text]').fill('101234\n101235')
  check('8: the import list is an ltr box', (await page.locator('[data-import-text]').getAttribute('dir')) === 'ltr')
  await page.screenshot({ path: `${SHOTS}/rtl-import.png` })
  check('8: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
