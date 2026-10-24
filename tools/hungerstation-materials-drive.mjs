// HungerStation materials drive (ticket 555, BackOffice spec 3028).
//
// Drives the REAL app in Chromium against STUBS of the HungerStation door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md § Materials) — the
// doors (BackOffice 3035) are not on staging, so there is no live SIS.Api to point at (the live walk
// is 557). Every fixture emits EXACTLY the contract's fields, on the REAL envelope { statusCode,
// success, message, errors: [{ errorCode, internalErrorCode, errorMessage }], data }, every refusal's
// errorMessage is "<English> / <Arabic>", and a missing grant is a BARE 403:
//   GET  HungerStationWeb/Access                         → { canManageStores, canManageCatalog, canViewOrders }
//   GET  HungerStationWeb/Materials?q=&state=&skip=&take= → { total, rows }
//   PUT  HungerStationWeb/Materials/{materialNumber}     → the row; DHS-00008/00009
//   POST HungerStationWeb/Materials/Import               → { added, updated, unknown }; DHS-00008/00010
//
// It asserts:
//   1. the Materials leaf opens the page (one probe call); without canManageCatalog the leaf is
//      hidden and the URL shows the denied card with no Materials call;
//   2. the list asks state=active, skip=0, take=100; the columns show; a null updatedAt is blank;
//      a set flag reads as a badge; the status bar says "Showing 1–100 of 250";
//   3. state and text land in the URL and drive the door; Next / Previous page the server
//      (skip in the URL and the door); a pasted URL drives the door; Clear resets;
//   4. change one: the boxes open on the row, Save waits for a change and a reason, the PUT body is
//      exactly { disabled, deleted, reason }, the row updates in place with no list read; DHS-00008
//      inline at the reason; DHS-00009 inline, the list read again, Save off;
//   5. import a paste: the preview counts rows, disabled, deleted, repeats (last wins) and the
//      header; a non-number and a bad mark are listed and keep Import off; over 5000 refused,
//      5000 allowed; the POST body is exactly { rows, reason }; the answer shows added, updated
//      and the unknown numbers, Copy puts them on the clipboard; DHS-00010 inline;
//   6. import an .xlsx: the sheet fills the rows (tab-separated), the preview and body follow;
//      an unreadable file says so;
//   7. under RTL (direction only — `lng` stays `en` app-wide) machine values and counts are
//      isolated, change and import work, a refusal's code is isolated, nothing errors.
//
//   1. run the app:  npx vite --port 5235 --strictPort
//   2. DRIVE_PORT=5235 node tools/hungerstation-materials-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.hungerstation-materials-shots'
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
const bare403 = { status: 403, contentType: 'text/plain', body: '' }

/** A material row exactly as the contract has it. */
const material = (materialNumber, over = {}) => ({
  materialNumber,
  sku: `SKU${materialNumber.slice(-4)}`,
  nameEn: `Item ${materialNumber}`,
  nameAr: `صنف ${materialNumber}`,
  disabled: false,
  deleted: false,
  updatedAt: '2026-10-20T09:15:00',
  updatedBy: 'CATMGR',
  ...over,
})

// 250 active materials (three pages of 100), then the flagged ones.
const MATERIALS = [
  material('000000000000101234', { sku: 'PAN500', nameEn: 'Panadol 500mg', nameAr: 'بنادول ٥٠٠ ملغ' }),
  // Listed by an older import: its stamp arrives null, no updater.
  material('000000000000101235', { updatedAt: null, updatedBy: '' }),
  ...Array.from({ length: 248 }, (_, i) => material(String(200000 + i))),
  material('000000000000300001', { disabled: true, nameEn: 'Disabled item' }),
  material('000000000000300002', { deleted: true, nameEn: 'Deleted item' }),
  material('000000000000300003', { disabled: true, deleted: true, nameEn: 'Both' }),
]
const stateOf = (m) => (m.deleted ? 'deleted' : m.disabled ? 'disabled' : 'active')

function materialsAnswer(qs) {
  const state = qs.get('state') ?? 'active'
  const q = (qs.get('q') ?? '').toLowerCase()
  const skip = Number(qs.get('skip') ?? 0)
  const take = Number(qs.get('take') ?? 100)
  const rows = MATERIALS.filter(
    (m) =>
      (state === 'any' || stateOf(m) === state) &&
      (!q || m.materialNumber.startsWith(q) || m.sku.toLowerCase().startsWith(q) || m.nameEn.toLowerCase().includes(q) || m.nameAr.includes(q)),
  )
  return { total: rows.length, rows: rows.slice(skip, skip + take) }
}

const REFUSALS = {
  'DHS-00008': [400, 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'],
  'DHS-00009': [404, 'No such material in the HungerStation list. / لا توجد مادة بهذا الرقم في قائمة هنقرستيشن.'],
  'DHS-00010': [400, 'The import holds a row that is not a material number. / الاستيراد يحوي صفًا ليس رقم مادة.'],
}
const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

// ── A minimal .xlsx (stored zip, inline strings) — enough for the app's core reader ──────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
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
        `<row r="${r + 1}">${row
          .map((v, c) => (v === '' ? '' : `<c r="${colName(c)}${r + 1}" t="inlineStr"><is><t>${v}</t></is></c>`))
          .join('')}</row>`,
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

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true }

const browser = await chromium.launch()

async function open(dir, { access = ALL } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const lists = []
  const writes = []
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
    if (p === 'HungerStationWeb/Materials' && req.method() === 'GET') {
      lists.push(url.search.slice(1))
      return route.fulfill(envelope(materialsAnswer(url.searchParams)))
    }
    if (p === 'HungerStationWeb/Materials/Import' && req.method() === 'POST') {
      const body = req.postDataJSON()
      writes.push({ method: 'POST', path: p, body })
      if (body.reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
      if (body.reason === 'trigger 00010') return route.fulfill(refuse('DHS-00010'))
      const known = new Set(MATERIALS.map((m) => m.materialNumber))
      const unknown = body.rows.filter((r) => r.materialNumber.startsWith('9')).map((r) => r.materialNumber)
      const updated = body.rows.filter((r) => known.has(r.materialNumber)).length
      return route.fulfill(envelope({ added: body.rows.length - updated - unknown.length, updated, unknown }))
    }
    if (p.startsWith('HungerStationWeb/Materials/') && req.method() === 'PUT') {
      const body = req.postDataJSON()
      const number = decodeURIComponent(p.slice('HungerStationWeb/Materials/'.length))
      writes.push({ method: 'PUT', path: p, body })
      if (body.reason === 'trigger 00008') return route.fulfill(refuse('DHS-00008'))
      if (number === '200005') return route.fulfill(refuse('DHS-00009'))
      const row = MATERIALS.find((m) => m.materialNumber === number)
      return route.fulfill(envelope({ ...row, disabled: body.disabled, deleted: body.deleted, updatedAt: '2026-10-24T11:30:00', updatedBy: 'MSARTAWI' }))
    }
    if (p === 'DeliverectWeb/Access') return route.fulfill(envelope({ ...ALL, canManageTerms: true }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, lists, writes }
}

/** Wait until the grid holds `n` rows and has settled. AG Grid renders only the rows in view, so a
 *  page longer than the viewport is waited for by its rendered rows filling the view. */
const waitRows = async (page, n) => {
  await page.waitForFunction(
    (count) => {
      const rendered = new Set([...document.querySelectorAll('[data-materials-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size
      return (count > 20 ? rendered >= 15 : rendered === count) && !document.querySelector('[data-materials-grid] .ag-overlay-loading-center')
    },
    n,
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}

/** One row's cell text by material number and column id. */
const cell = (page, number, colId) =>
  page.evaluate(
    ([n, col]) => {
      const pinned = [...document.querySelectorAll('[data-materials-grid] .ag-row[row-index] [col-id="materialNumber"]')].find(
        (el) => el.textContent === n,
      )
      if (!pinned) return null
      const i = pinned.closest('.ag-row').getAttribute('row-index')
      const target = document.querySelector(`[data-materials-grid] .ag-row[row-index="${i}"] [col-id="${col}"]`)
      return target ? target.textContent.trim() : null
    },
    [number, colId],
  )

/** A 5000-line value is set in one go (React's own setter + one input event): `fill` stalls on it
 *  (the Deliverect catalog drive's finding). */
const setText = (page, value) =>
  page.locator('[data-import-text]').evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)

const urlSearch = (page) => new URL(page.url()).search.slice(1)
const statusText = (page) => page.locator('[data-status-count]').innerText()
const lastList = (lists) => lists.at(-1)

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/materials"]').first().click()
  await waitRows(page, 100)
  check('1: the Materials leaf opens the page', (await page.locator('h1').innerText()) === 'HungerStation materials')
  check('1: the leaf and the page gate cost ONE probe call', calls.filter((c) => c === 'HungerStationWeb/Access').length === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { ...ALL, canManageCatalog: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/stores"]').first().waitFor({ timeout: 5000 })
  check('1: without canManageCatalog the Materials leaf is hidden', (await page.locator('nav a[href="/hungerstation/materials"]').count()) === 0)
  check('1: …and the Stores leaf stays', (await page.locator('nav a[href="/hungerstation/stores"]').count()) === 1)
  await page.goto(`${BASE}/hungerstation/materials`)
  await page.getByText('No access to HungerStation materials').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card and asks no Materials call', !calls.includes('HungerStationWeb/Materials'))
  check('1 (denied): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–4: the list, filters, paging, change one ─────────────────────────────────────────────────
{
  const { context, page, errors, lists, writes } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/materials`)
  await waitRows(page, 100)

  // 2
  check('2: the list asks state=active, skip=0, take=100', lists[0] === 'state=active&skip=0&take=100', lists[0])
  check('2: the URL stays bare at the defaults', urlSearch(page) === '')
  check(
    '2: material, SKU, both names, updated at/by show',
    (await cell(page, '000000000000101234', 'sku')) === 'PAN500' &&
      (await cell(page, '000000000000101234', 'nameEn')) === 'Panadol 500mg' &&
      (await cell(page, '000000000000101234', 'nameAr')) === 'بنادول ٥٠٠ ملغ' &&
      (await cell(page, '000000000000101234', 'updatedAt')) === '2026-10-20 09:15' &&
      (await cell(page, '000000000000101234', 'updatedBy')) === 'CATMGR',
  )
  check('2: a null updatedAt renders blank', (await cell(page, '000000000000101235', 'updatedAt')) === '')
  check('2: a clear flag is blank', (await cell(page, '000000000000101234', 'disabled')) === '' && (await cell(page, '000000000000101234', 'deleted')) === '')
  check('2: the status bar says Showing 1–100 of 250', (await statusText(page)) === 'Showing 1–100 of 250', await statusText(page))
  await page.screenshot({ path: `${SHOTS}/ltr-list.png` })

  // 3: paging
  await page.locator('[data-materials-next]').click()
  await page.waitForFunction(() => document.querySelector('[data-status-count]')?.textContent === 'Showing 101–200 of 250', null, { timeout: 10000 })
  check('3: Next puts skip=100 in the URL', urlSearch(page) === 'skip=100', urlSearch(page))
  check('3: …and asks the door for skip=100', lastList(lists) === 'state=active&skip=100&take=100', lastList(lists))
  await page.locator('[data-materials-next]').click()
  await page.waitForFunction(() => document.querySelector('[data-status-count]')?.textContent === 'Showing 201–250 of 250', null, { timeout: 10000 })
  await waitRows(page, 50)
  check('3: the last page holds 50 rows and Next is off', await page.locator('[data-materials-next]').isDisabled())
  await page.locator('[data-materials-previous]').click()
  await page.waitForFunction(() => document.querySelector('[data-status-count]')?.textContent === 'Showing 101–200 of 250', null, { timeout: 10000 })
  check('3: Previous goes back a page', urlSearch(page) === 'skip=100')

  // 3: state + text
  await page.locator('[data-filter-state]').selectOption('any')
  await page.waitForFunction(() => document.querySelector('[data-status-count]')?.textContent === 'Showing 1–100 of 253', null, { timeout: 10000 })
  check('3: a state change lands in the URL and starts at the first page', urlSearch(page) === 'state=any', urlSearch(page))
  check('3: …and drives the door', lastList(lists) === 'state=any&skip=0&take=100')
  await page.locator('[data-filter-q]').fill('0000000000003000')
  await page.locator('[data-materials-search]').click()
  await waitRows(page, 3)
  check('3: the text lands in the URL', urlSearch(page) === 'state=any&q=0000000000003000', urlSearch(page))
  check('3: …and drives the door', lastList(lists) === 'q=0000000000003000&state=any&skip=0&take=100', lastList(lists))
  check(
    '3: a set flag reads as a badge — disabled, deleted, both',
    (await cell(page, '000000000000300001', 'disabled')) === 'Disabled' &&
      (await cell(page, '000000000000300002', 'deleted')) === 'Deleted' &&
      (await cell(page, '000000000000300003', 'disabled')) === 'Disabled' &&
      (await cell(page, '000000000000300003', 'deleted')) === 'Deleted',
  )
  check('3: the count says 3 materials', (await statusText(page)) === '3 materials')
  await page.locator('[data-filter-state]').selectOption('deleted')
  await waitRows(page, 2)
  check('3: state=deleted keeps the text', urlSearch(page) === 'state=deleted&q=0000000000003000' && lastList(lists) === 'q=0000000000003000&state=deleted&skip=0&take=100')
  await page.locator('[data-materials-clear]').click()
  await waitRows(page, 100)
  check('3: Clear resets the URL and the box', urlSearch(page) === '' && (await page.locator('[data-filter-q]').inputValue()) === '')
  await page.goto(`${BASE}/hungerstation/materials?state=disabled&q=Disabled`)
  await waitRows(page, 1)
  check('3: a pasted URL drives the door and the filters', lastList(lists) === 'q=Disabled&state=disabled&skip=0&take=100' && (await page.locator('[data-filter-state]').inputValue()) === 'disabled')
  await page.goto(`${BASE}/hungerstation/materials?state=gone`)
  await waitRows(page, 100)
  check('3: a state the door does not know is read as active, never sent', lastList(lists) === 'state=active&skip=0&take=100')

  // 4: change one
  await page.goto(`${BASE}/hungerstation/materials`)
  await waitRows(page, 100)
  const listsBefore = lists.length
  await page.locator('[data-material-change="000000000000101234"]').click()
  const dlg = page.locator('[data-change-dialog]')
  await dlg.waitFor({ timeout: 5000 })
  check('4: the boxes open on the row', !(await page.locator('[data-change-disabled]').isChecked()) && !(await page.locator('[data-change-deleted]').isChecked()))
  await page.locator('[data-reason-input]').fill('Out of stock everywhere')
  check('4: Save waits for a change', await page.locator('[data-reason-confirm]').isDisabled())
  await page.locator('[data-change-disabled]').check()
  await page.locator('[data-reason-input]').fill('')
  check('4: …and for a reason', await page.locator('[data-reason-confirm]').isDisabled())
  await page.locator('[data-reason-input]').fill('trigger 00008')
  await page.locator('[data-reason-confirm]').click()
  const r8 = page.locator('[data-reason-dialog] [data-inline-refusal="DHS-00008"]')
  await r8.waitFor({ timeout: 5000 })
  check('4: DHS-00008 shows inline at the reason, the dialog open', (await dlg.count()) === 1)
  await page.locator('[data-reason-input]').fill('  مخزون غير متوفر  ')
  await page.locator('[data-reason-confirm]').click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })
  const put = writes.at(-1)
  check(
    '4: the PUT carries exactly { disabled, deleted, reason }, trimmed, to the material',
    put.method === 'PUT' &&
      put.path === 'HungerStationWeb/Materials/000000000000101234' &&
      JSON.stringify(put.body) === JSON.stringify({ disabled: true, deleted: false, reason: 'مخزون غير متوفر' }),
    JSON.stringify(put),
  )
  await page.waitForFunction(() => !!document.querySelector('[data-materials-grid] [data-flag-disabled]'), null, { timeout: 5000 })
  check(
    '4: the row updates in place — flag, updated at, updated by',
    (await cell(page, '000000000000101234', 'disabled')) === 'Disabled' &&
      (await cell(page, '000000000000101234', 'updatedAt')) === '2026-10-24 11:30' &&
      (await cell(page, '000000000000101234', 'updatedBy')) === 'MSARTAWI',
  )
  check('4: …with no list read', lists.length === listsBefore, `${lists.length} vs ${listsBefore}`)

  await page.locator('[data-material-change="200005"]').click()
  await dlg.waitFor({ timeout: 5000 })
  await page.locator('[data-change-deleted]').check()
  await page.locator('[data-reason-input]').fill('Delisted')
  await page.locator('[data-reason-confirm]').click()
  const r9 = page.locator('[data-change-gone] [data-inline-refusal="DHS-00009"]')
  await r9.waitFor({ timeout: 5000 })
  check('4: DHS-00009 shows inline with the server’s sentence', (await r9.locator('bdi:not([dir])').innerText()) === REFUSALS['DHS-00009'][1])
  check('4: …Save is off', await page.locator('[data-reason-confirm]').isDisabled())
  await page.waitForTimeout(400)
  check('4: …and the list is read again', lists.length > listsBefore)
  await page.screenshot({ path: `${SHOTS}/ltr-change-gone.png` })
  await page.locator('[data-reason-cancel]').click()
  check('2–4: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5–6: import ──────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, lists, writes } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/materials`)
  await waitRows(page, 100)
  await page.locator('[data-materials-import]').click()
  const dlg = page.locator('[data-import-dialog]')
  await dlg.waitFor({ timeout: 5000 })
  const preview = async () =>
    page.evaluate(() => {
      const n = (sel) => document.querySelector(sel)?.getAttribute(sel.slice(1, -1)) ?? null
      return {
        rows: n('[data-preview-rows]'),
        disabled: n('[data-preview-disabled]'),
        deleted: n('[data-preview-deleted]'),
        repeats: n('[data-preview-repeats]'),
        header: document.querySelector('[data-import-header] bdi')?.textContent ?? null,
        problems: [...document.querySelectorAll('[data-import-problem]')].map((li) => `${li.getAttribute('data-problem-line')}:${li.getAttribute('data-import-problem')}`),
      }
    })

  await page.locator('[data-import-text]').fill(
    ['Material\tDisabled\tDeleted', '000000000000101234\tX\t', '200001\t\tX', '900001\ttrue\tfalse', '200001\tx\t', 'Panadol\tX', '200002\tY'].join('\n'),
  )
  await page.locator('[data-reason-input]').fill('Weekly catalog')
  let pv = await preview()
  check('5: the preview counts rows, disabled, deleted and repeats', pv.rows === '3' && pv.disabled === '3' && pv.deleted === '0' && pv.repeats === '1', JSON.stringify(pv))
  check('5: the header is said and skipped', pv.header === 'Material\tDisabled\tDeleted', JSON.stringify(pv.header))
  check('5: a non-number and a bad mark are listed with their lines', JSON.stringify(pv.problems) === JSON.stringify(['6:material', '7:mark']), JSON.stringify(pv.problems))
  check('5: …and keep Import off', await page.locator('[data-reason-confirm]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/ltr-import-preview.png` })

  // Fix the bad rows.
  await page.locator('[data-import-text]').fill(
    ['Material\tDisabled\tDeleted', '000000000000101234\tX\t', '200001\t\tX', '900001\ttrue\tfalse', '200001\tx\t'].join('\n'),
  )
  pv = await preview()
  check('5: fixed, nothing is listed and Import is on', pv.problems.length === 0 && (await page.locator('[data-reason-confirm]').isEnabled()))

  await page.locator('[data-reason-input]').fill('trigger 00010')
  await page.locator('[data-reason-confirm]').click()
  const r10 = page.locator('[data-import-dialog] [data-inline-refusal="DHS-00010"]')
  await r10.waitFor({ timeout: 5000 })
  check('5: DHS-00010 shows inline under the rows, the server’s sentence', (await r10.locator('bdi:not([dir])').innerText()) === REFUSALS['DHS-00010'][1])
  check('5: …shown once (not again as a dialog error)', (await page.locator('[data-reason-error]').count()) === 0)

  const listsBefore = lists.length
  await page.locator('[data-reason-input]').fill('Weekly catalog')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-import-result]').waitFor({ timeout: 5000 })
  const post = writes.at(-1)
  check(
    '5: the POST carries exactly { rows, reason } — booleans, last repeat wins, header and blanks out',
    post.method === 'POST' &&
      JSON.stringify(post.body) ===
        JSON.stringify({
          rows: [
            { materialNumber: '000000000000101234', disabled: true, deleted: false },
            { materialNumber: '200001', disabled: true, deleted: false },
            { materialNumber: '900001', disabled: true, deleted: false },
          ],
          reason: 'Weekly catalog',
        }),
    JSON.stringify(post.body),
  )
  check(
    '5: the answer shows added, updated and the unknown count',
    (await page.locator('[data-result-added]').getAttribute('data-result-added')) === '0' &&
      (await page.locator('[data-result-updated]').getAttribute('data-result-updated')) === '2' &&
      (await page.locator('[data-result-unknown-count]').getAttribute('data-result-unknown-count')) === '1',
  )
  check('5: the unknown numbers are listed', (await page.locator('[data-result-unknown] li').allInnerTexts()).join() === '900001')
  await page.locator('[data-result-copy]').click()
  await page.waitForTimeout(300)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  check('5: Copy puts the unknown list on the clipboard', clip.replace(/\r\n/g, '\n') === '900001', JSON.stringify(clip))
  await page.waitForTimeout(300)
  check('5: the list is read again after the import', lists.length > listsBefore)
  await page.screenshot({ path: `${SHOTS}/ltr-import-result.png` })
  await page.locator('[data-result-close]').click()

  // 5: the cap.
  const numbers = (n) => Array.from({ length: n }, (_, i) => String(400000 + i))
  await page.locator('[data-materials-import]').click()
  await dlg.waitFor({ timeout: 5000 })
  await page.locator('[data-reason-input]').fill('Big one')
  await setText(page, numbers(5001).join('\n'))
  await page.locator('[data-import-over-cap]').waitFor({ timeout: 5000 })
  check('5: 5001 rows are refused here, Import off', await page.locator('[data-reason-confirm]').isDisabled())
  await setText(page, numbers(5000).join('\n'))
  await page.waitForTimeout(200)
  check('5: 5000 rows are allowed', (await page.locator('[data-import-over-cap]').count()) === 0 && (await page.locator('[data-reason-confirm]').isEnabled()))

  // 6: an .xlsx.
  await page.locator('[data-import-file]').setInputFiles({
    name: 'hs-materials.xlsx',
    mimeType: XLSX,
    buffer: workbook([['Material', 'Disabled', 'Deleted'], ['200010', 'X', ''], ['200011', '', 'X'], ['200010', '', ''], ['900077', 'X', 'X', 'a note']]),
  })
  await page.locator('[data-import-file-note="info"]').waitFor({ timeout: 5000 })
  check('6: the sheet fills the rows, tab-separated, first three columns (trailing blanks dropped by the reader)', (await page.locator('[data-import-text]').inputValue()) === 'Material\tDisabled\tDeleted\n200010\tX\n200011\t\tX\n200010\n900077\tX\tX', JSON.stringify(await page.locator('[data-import-text]').inputValue()))
  check('6: the file note says how many rows were read', (await page.locator('[data-import-file-note]').innerText()) === 'Read ⁨4⁩ rows from ⁨hs-materials.xlsx⁩.', await page.locator('[data-import-file-note]').innerText())
  pv = await preview()
  check('6: the preview follows the sheet', pv.rows === '3' && pv.disabled === '1' && pv.deleted === '2' && pv.repeats === '1' && pv.header === 'Material\tDisabled\tDeleted', JSON.stringify(pv))
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-import-result]').waitFor({ timeout: 5000 })
  check(
    '6: the sheet’s body is sent — the later 200010 row wins',
    JSON.stringify(writes.at(-1).body.rows) ===
      JSON.stringify([
        { materialNumber: '200010', disabled: false, deleted: false },
        { materialNumber: '200011', disabled: false, deleted: true },
        { materialNumber: '900077', disabled: true, deleted: true },
      ]),
    JSON.stringify(writes.at(-1).body.rows),
  )
  await page.locator('[data-result-close]').click()
  await page.locator('[data-materials-import]').click()
  await dlg.waitFor({ timeout: 5000 })
  await page.locator('[data-import-file]').setInputFiles({ name: 'notes.xlsx', mimeType: XLSX, buffer: Buffer.from('not a workbook') })
  await page.locator('[data-import-file-note="error"]').waitFor({ timeout: 5000 })
  check('6: an unreadable file says so', /could not be read/.test(await page.locator('[data-import-file-note]').innerText()))
  check('5–6: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: RTL ────────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, writes } = await open('rtl')
  await page.goto(`${BASE}/hungerstation/materials`)
  await waitRows(page, 100)
  check('7: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  const isolated = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-materials-grid] .ag-row [col-id="materialNumber"]')]
    return [cells.length, cells.filter((c) => c.querySelector('bdi[dir="ltr"]')).length]
  })
  check('7: every rendered material number is isolated left-to-right', isolated[0] >= 15 && isolated[0] === isolated[1], JSON.stringify(isolated))
  const times = await page.evaluate(() => [...document.querySelectorAll('[data-materials-grid] [col-id="updatedAt"] bdi[dir="ltr"]')].map((b) => b.textContent))
  check('7: updated at is isolated', times.includes('2026-10-20 09:15'))
  const range = await page.locator('[data-status-count] bdi[dir="ltr"]').allInnerTexts()
  check('7: the page range is isolated WHOLE, the total on its own', JSON.stringify(range) === JSON.stringify(['1–100', '250']), JSON.stringify(range))
  await page.screenshot({ path: `${SHOTS}/rtl-list.png` })

  await page.locator('[data-material-change="200001"]').click()
  await page.locator('[data-change-dialog]').waitFor({ timeout: 5000 })
  check('7: the dialog isolates the material number', (await page.locator('[data-dialog-material] bdi[dir="ltr"]').innerText()) === '200001')
  await page.locator('[data-change-deleted]').check()
  await page.locator('[data-reason-input]').fill('سبب')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-change-dialog]').waitFor({ state: 'detached', timeout: 5000 })
  check('7: change works under RTL', writes.at(-1).path === 'HungerStationWeb/Materials/200001' && writes.at(-1).body.deleted === true)

  await page.locator('[data-materials-import]').click()
  await page.locator('[data-import-dialog]').waitFor({ timeout: 5000 })
  await page.locator('[data-import-text]').fill('200001\tX\nبنادول')
  const problemValue = await page.locator('[data-import-problem="material"] bdi:not([dir])').innerText()
  check('7: a problem row’s value is isolated as free text, its line as a number', problemValue === 'بنادول' && (await page.locator('[data-import-problem] bdi[dir="ltr"]').innerText()) === '2')
  await page.locator('[data-import-text]').fill('200001\tX')
  await page.locator('[data-reason-input]').fill('trigger 00010')
  await page.locator('[data-reason-confirm]').click()
  const r10 = page.locator('[data-import-dialog] [data-inline-refusal="DHS-00010"]')
  await r10.waitFor({ timeout: 5000 })
  check('7: DHS-00010 inline under RTL, its code isolated', (await r10.locator('bdi[dir="ltr"]').innerText()) === 'DHS-00010')
  await page.screenshot({ path: `${SHOTS}/rtl-import-refusal.png` })
  await page.locator('[data-reason-input]').fill('سبب')
  await page.locator('[data-reason-confirm]').click()
  await page.locator('[data-import-result]').waitFor({ timeout: 5000 })
  check('7: import works under RTL', JSON.stringify(writes.at(-1).body) === JSON.stringify({ rows: [{ materialNumber: '200001', disabled: true, deleted: false }], reason: 'سبب' }))
  check('7: the answer’s counts are isolated', (await page.locator('[data-result-updated] bdi[dir="ltr"]').innerText()) === '1')
  check('rtl: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
