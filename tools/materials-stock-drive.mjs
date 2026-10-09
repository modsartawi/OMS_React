// Stock check drive (ticket 453, BackOffice spec 2544).
//
// Drives the REAL app in Chromium against STUBS of the Materials door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md) — none of the
// `MaterialWeb/*` doors is built, so there is no live SIS.Api to point at. Every stub is built from
// the contract's own example values (material 101234, stores 1001/1002 "Riyadh - Olaya", the
// CENTRAL set of 212, ATP 12 / SAP 15 / POS -2 / OMS -1 at 2026-10-09T10:42:00):
//   GET  MaterialWeb/Access                       → { canSearchMaterials, canCheckStock, canCheckGs1 }
//   POST MaterialWeb/Stock                        → { cells, storesAsked, materialsAsked }; MAT-00004
//   GET  MaterialWeb/StoreSets?kind=              → [{ value, label, storeCount }]
//   GET  MaterialWeb/StoreSets/{kind}/{value}     → [{ storeCode, storeName, city, closed }]
//   GET  SdDocument/StoreDetails                  → the existing store lookup
// The refusal envelope is the REAL SIS.Api shape `@/core/api` reads —
// errors: [{ errorCode, errorMessage, internalErrorCode }] — not the contract's abbreviation.
//
// It asserts:
//   1. the Stock check leaf opens the stock check's OWN page (the static route, not the
//      placeholder, not `:no`); without `canCheckStock` the leaf is hidden, the URL shows the
//      denied card, and no stock call is made;
//   2. `?material=` (repeatable) prefills the box through the same parse: de-duplicated, leading
//      zeros kept;
//   3. a pasted basket × a city set (plus a store found by name, one removed) renders the grid, the
//      exact request body reaches the door, and the summary line reads materials / stores / cells;
//   4. the zero and closed toggles reach the request (and the set call); "All stores" sends null;
//   5. MAT-00004 shows the unavailable panel and NO grid; Try again asks again;
//   6. the 51st material is refused on the client, with no call;
//   7. Export writes xlsx: identities as text, signed quantities as numbers, no isolates;
//   8. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/materials-stock-drive.mjs          (DRIVE_PORT=5244 for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.materials-stock-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/coupon-import-delete-drive.mjs).
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

/** A stock cell exactly as the contract has it. */
const cell = (materialNumber, storeCode, storeName, atp, sapUnrestricted, pos, oms, updatedAt = '2026-10-09T10:42:00') => ({
  materialNumber, storeCode, storeName, atp, sapUnrestricted, pos, oms, updatedAt,
})

const STORE_DETAILS = [
  { storeCode: '1001', city: 'RIYADH', region: 'CENTRAL', storeAddress: 'Riyadh - Olaya', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false },
  { storeCode: '1002', city: 'RIYADH', region: 'CENTRAL', storeAddress: 'Riyadh - Malaz', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false },
  { storeCode: '1003', city: 'RIYADH', region: 'CENTRAL', storeAddress: 'Riyadh - Nakheel', deliveryStore: false, latitude: '', longitude: '', wasfatyRefill: false },
  { storeCode: '2001', city: 'JEDDAH', region: 'WESTERN', storeAddress: 'جدة - التحلية', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false },
]

const STORE_SETS = {
  area: [{ value: 'CENTRAL', label: 'CENTRAL', storeCount: 212 }],
  city: [
    { value: 'RIYADH', label: 'RIYADH', storeCount: 2 },
    { value: 'JEDDAH', label: 'JEDDAH', storeCount: 1 },
  ],
  district: [],
  supervisor: [],
}

/** `StoreSets/{kind}/{value}`: RIYADH holds a closed store that only `includeClosed=true` returns. */
function setStores(kind, value, includeClosed) {
  if (kind === 'city' && value === 'RIYADH') {
    const open = [
      { storeCode: '1001', storeName: 'Riyadh - Olaya', city: 'RIYADH', closed: false },
      { storeCode: '1002', storeName: 'Riyadh - Malaz', city: 'RIYADH', closed: false },
    ]
    return includeClosed ? [...open, { storeCode: '1009', storeName: 'Riyadh - Closed', city: 'RIYADH', closed: true }] : open
  }
  if (kind === 'city' && value === 'JEDDAH') return [{ storeCode: '2001', storeName: 'جدة - التحلية', city: 'JEDDAH', closed: false }]
  return []
}

/** What `MaterialWeb/Stock` answers, by its body. Material 999999 makes Stock Visibility fail. */
function stockAnswer(body) {
  if (body.materials.includes('999999')) return 'unavailable'
  const cells = [
    cell('100777', '1002', 'Riyadh - Malaz', 3, 3, 0, 0, '2026-10-09T09:05:30'),
    cell('101234', '1001', 'Riyadh - Olaya', 12, 15, -2, -1),
    cell('101234', '1002', 'Riyadh - Malaz', 4, 4, 0, 0),
  ]
  if (body.includeZero) cells.push(cell('100777', '1001', 'Riyadh - Olaya', 0, 0, 0, 0))
  return {
    cells: cells.filter((c) => body.materials.includes(c.materialNumber) && (body.stores === null || body.stores.includes(c.storeCode))),
    storesAsked: body.stores === null ? 212 : body.stores.length,
    materialsAsked: body.materials.length,
  }
}

const ALL = { canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }

const browser = await chromium.launch()

async function open({ access = ALL } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const stockBodies = []
  const setCalls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4|5)\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'MaterialWeb/Access') return route.fulfill(envelope(access))
    if (p === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORE_DETAILS))
    if (p === 'MaterialWeb/Stock') {
      const body = JSON.parse(route.request().postData() ?? '{}')
      stockBodies.push({ method: route.request().method(), raw: route.request().postData(), body })
      const answer = stockAnswer(body)
      if (answer === 'unavailable')
        return route.fulfill(
          envelope(null, {
            status: 502,
            success: false,
            message: 'Stock Visibility is unavailable. Try again. / خدمة رؤية المخزون غير متاحة. حاول مرة أخرى.',
            errorCode: 'MAT-00004',
          }),
        )
      return route.fulfill(envelope(answer))
    }
    if (p === 'MaterialWeb/StoreSets') return route.fulfill(envelope(STORE_SETS[url.searchParams.get('kind')] ?? []))
    const set = /^MaterialWeb\/StoreSets\/([^/]+)\/([^/]+)$/.exec(p)
    if (set) {
      setCalls.push(`${decodeURIComponent(set[1])}/${decodeURIComponent(set[2])}?${url.searchParams.toString()}`)
      return route.fulfill(envelope(setStores(decodeURIComponent(set[1]), decodeURIComponent(set[2]), url.searchParams.get('includeClosed') === 'true')))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, stockBodies, setCalls }
}

/** Wait until the grid holds `n` rows (a row is drawn once per pinned/centre section) and has settled. */
const waitRows = async (page, n) => {
  await page.waitForFunction(
    (count) =>
      new Set([...document.querySelectorAll('[data-stock-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size === count &&
      !document.querySelector('[data-stock-grid] .ag-overlay-loading-center'),
    n,
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}

/** The grid's rows as `material|store|atp|sap|pos|oms|updated`, in display order. */
const gridRows = (page) =>
  page.evaluate(() => {
    const byIndex = new Map()
    for (const r of document.querySelectorAll('[data-stock-grid] .ag-row[row-index]')) {
      const i = Number(r.getAttribute('row-index'))
      const cells = byIndex.get(i) ?? {}
      for (const c of r.querySelectorAll('[col-id]')) cells[c.getAttribute('col-id')] = c.textContent.trim()
      byIndex.set(i, cells)
    }
    return [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, c]) => [c.materialNumber, c.storeCode, c.atp, c.sapUnrestricted, c.pos, c.oms, c.updatedAt].join('|'))
  })

/** Add a set through the kind and value selects. */
async function addSet(page, kind, value) {
  await page.locator('[data-stock-set-kind]').selectOption(kind)
  await page.locator(`[data-stock-set-value] option[value="${value}"]`).waitFor({ state: 'attached', timeout: 10000 })
  await page.locator('[data-stock-set-value]').selectOption(value)
  await page.locator('[data-stock-set-add]').click()
}

const chipCodes = (page) => page.locator('[data-stock-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-stock-chip')))

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

function sheetText(files) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => m[1].replace(/<[^>]+>/g, ''))
  const xml = files['xl/worksheets/sheet1.xml'] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)]
    .map((r) =>
      [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
        .map(([, attrs, body]) => {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? body.replace(/<[^>]+>/g, '')
          if (/t="s"/.test(attrs)) return shared[Number(v)]
          return (/t="n"|^(?![\s\S]*t=)/.test(attrs) && v !== '' ? 'n:' : '') + v
        })
        .join('|'),
    )
    .join('\n')
}

// ── 1: the menu, the static route, the gate ───────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Materials$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  const leaf = page.locator('nav a[href="/materials/stock"]').first()
  await leaf.waitFor({ timeout: 5000 })
  check('1: the Stock check leaf is shown under Materials', (await leaf.textContent()).trim() === 'Stock check')
  await leaf.click()
  await page.locator('[data-stock-materials]').waitFor({ timeout: 20000 })
  check('1: /materials/stock renders the stock check itself — the STATIC route, not the placeholder or :no', (await page.locator('[data-material-placeholder]').count()) === 0 && (await page.locator('h1', { hasText: 'Stock check' }).count()) === 1)
  check('1: the leaf is marked on its own page', (await page.locator('nav a[href="/materials/stock"][aria-current="page"]').count()) === 1)
  check('1: landing asks for no stock, and says what to do', !calls.includes('MaterialWeb/Stock') && (await page.locator('[data-stock-not-checked]').count()) === 1)
  check('1: Check stock is disabled with nothing chosen', await page.locator('[data-stock-check]').isDisabled())
  check('1: both toggles start OFF', !(await page.locator('[data-stock-include-zero]').isChecked()) && !(await page.locator('[data-stock-include-closed]').isChecked()) && !(await page.locator('[data-stock-all-stores]').isChecked()))
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open({ access: { canSearchMaterials: true, canCheckStock: false, canCheckGs1: true } })
  await page.goto(`${BASE}/materials/stock?material=101234`)
  await page.locator('nav a[href="/materials"]').first().waitFor({ timeout: 20000 })
  await page.locator('[role="alert"]', { hasText: 'No access to the stock check' }).waitFor({ timeout: 10000 })
  check('1: without canCheckStock the Stock check leaf is hidden (search and GS1 stay)', (await page.locator('nav a[href="/materials/stock"]').count()) === 0 && (await page.locator('nav a[href="/materials/gs1"]').count()) === 1)
  check('1: …and the typed URL shows the denied card, with no stock call', (await page.locator('[data-stock-materials]').count()) === 0 && !calls.includes('MaterialWeb/Stock'))
  check('1: no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–7: the check ────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, stockBodies, setCalls } = await open()

  // 2: the prefill
  await page.goto(`${BASE}/materials/stock?material=101234&material=0100777&material=101234`)
  await page.locator('[data-stock-materials]').waitFor({ timeout: 20000 })
  const box = await page.locator('[data-stock-materials]').inputValue()
  check('2: ?material= prefills the box, one per line, leading zeros kept', box === '101234\n0100777\n101234', JSON.stringify(box))
  check('2: …read through the same parse: two materials, the repeat folded', (await page.locator('[data-stock-material-count]').getAttribute('data-stock-material-count')) === '2' && /1 repeat left out/.test(await page.locator('[data-stock-material-count]').textContent()))
  check('2: the prefill makes no call by itself', !calls.includes('MaterialWeb/Stock'))
  check('2: with materials but no store, Check says why', (await page.locator('[data-stock-check]').isDisabled()) && /Choose stores/.test(await page.locator('[data-stock-why-not]').textContent()))

  // 3: a pasted basket × a city set
  await page.locator('[data-stock-materials]').fill('101234, 100777\n101234')
  await addSet(page, 'city', 'RIYADH')
  await page.locator('[data-stock-chip="1002"]').waitFor({ timeout: 10000 })
  const setOptions = await page.locator('[data-stock-set-value] option').evaluateAll((els) => els.map((e) => e.textContent))
  check('3: a set value shows its store count', setOptions.map((o) => o.replace(/[⁦-⁩]/g, '')).includes('RIYADH (2 stores)'), setOptions.join(' | '))
  check('3: the city set adds its stores as chips', JSON.stringify(await chipCodes(page)) === JSON.stringify(['1001', '1002']), (await chipCodes(page)).join())
  check('3: the set is asked with includeClosed=false', setCalls[0] === 'city/RIYADH?includeClosed=false', setCalls.join(' | '))
  // A store by name, then a duplicate by code, then remove it again.
  await page.locator('[data-stock-store-find]').fill('nakheel')
  await page.locator('[data-stock-store-option="1003"]').click()
  await page.locator('[data-stock-store-find]').fill('olaya')
  await page.locator('[data-stock-store-option="1001"]').waitFor({ timeout: 5000 })
  check('3: a store already chosen is offered disabled, never twice', await page.locator('[data-stock-store-option="1001"]').isDisabled())
  await page.locator('[data-stock-store-find]').fill('')
  check('3: a store found by name joins the chips, with a count', JSON.stringify(await chipCodes(page)) === JSON.stringify(['1001', '1002', '1003']) && /3 stores chosen/.test(await page.locator('[data-stock-store-count]').textContent()))
  await page.locator('[data-stock-chip="1003"] [data-stock-chip-remove]').click()
  check('3: a chip can be removed', JSON.stringify(await chipCodes(page)) === JSON.stringify(['1001', '1002']))
  // Adding the same set again adds nothing new.
  await addSet(page, 'city', 'RIYADH')
  await page.waitForTimeout(400)
  check('3: adding the set again merges without duplicates', JSON.stringify(await chipCodes(page)) === JSON.stringify(['1001', '1002']))

  await page.locator('[data-stock-check]').click()
  await waitRows(page, 3)
  const body1 = stockBodies.at(-1)
  check('3: the check is a POST to MaterialWeb/Stock', body1?.method === 'POST')
  check(
    '3: the exact request body reaches the door',
    body1?.raw === JSON.stringify({ materials: ['101234', '100777'], stores: ['1001', '1002'], includeZero: false, includeClosed: false }),
    body1?.raw,
  )
  const rows1 = await gridRows(page)
  check(
    '3: the grid has one row per material × store, sorted by material then ATP, signed quantities, local time unshifted',
    JSON.stringify(rows1) ===
      JSON.stringify(['100777|1002|3|3|0|0|2026-10-09 09:05', '101234|1001|12|15|-2|-1|2026-10-09 10:42', '101234|1002|4|4|0|0|2026-10-09 10:42']),
    rows1.join(' / '),
  )
  const names = await page.locator('[data-stock-grid] .ag-row[row-index="1"] [col-id="storeName"]').first().textContent()
  check('3: the store name column shows', names.trim() === 'Riyadh - Olaya', names)
  const summary = page.locator('[data-stock-summary]')
  check(
    '3: the summary line reads materials asked, stores asked, cells shown',
    (await summary.locator('[data-stock-summary-materials]').getAttribute('data-stock-summary-materials')) === '2' &&
      (await summary.locator('[data-stock-summary-stores]').getAttribute('data-stock-summary-stores')) === '2' &&
      (await summary.locator('[data-stock-summary-cells]').getAttribute('data-stock-summary-cells')) === '3' &&
      /Materials asked: 2/.test(await summary.textContent()) && /Cells shown: 3/.test(await summary.textContent()),
    await summary.textContent(),
  )
  // Sortable by material: a header click flips it.
  // It opens ascending (sortIndex 0), so one click turns it descending.
  await page.locator('[data-stock-grid] .ag-header-cell[col-id="materialNumber"]').click()
  await page.waitForTimeout(300)
  const sorted = (await gridRows(page)).map((r) => r.split('|')[0])
  check('3: the grid sorts by material', sorted[0] === '101234' && sorted.at(-1) === '100777', sorted.join())
  await page.screenshot({ path: `${SHOTS}/3-grid.png`, fullPage: true })

  // 7: export
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-stock-export]').click()])
  const sheet = sheetText(unzipText(readFileSync(await download.path())))
  const lines = sheet.split('\n')
  check('7: the file is named for material stock', /^material-stock.*\.xlsx$/.test(download.suggestedFilename()), download.suggestedFilename())
  check('7: the header row is the grid\'s columns', lines[0] === 'Material|Store|Store name|ATP|SAP unrestricted|POS|OMS|Last updated', lines[0])
  check('7: material and store are text; signed quantities are numbers', lines.some((l) => l === '101234|1001|Riyadh - Olaya|n:12|n:15|n:-2|n:-1|2026-10-09 10:42'), lines.join(' / '))
  check('7: no bidi isolates reach the file', !/[\u2066-\u2069]/.test(sheet))

  // 4: the toggles reach the request (and the set call); "All stores" sends null
  await page.locator('[data-stock-include-zero]').check()
  await page.locator('[data-stock-include-closed]').check()
  await addSet(page, 'city', 'RIYADH')
  await page.locator('[data-stock-chip="1009"]').waitFor({ timeout: 10000 })
  check('4: with closed stores on, the set is asked with includeClosed=true and brings its closed store', setCalls.at(-1) === 'city/RIYADH?includeClosed=true', setCalls.at(-1))
  const before = stockBodies.length
  await page.locator('[data-stock-check]').click()
  for (let i = 0; i < 50 && stockBodies.length === before; i++) await page.waitForTimeout(100)
  const body2 = stockBodies.at(-1)
  check('4: includeZero and includeClosed reach the body', stockBodies.length === before + 1 && body2.body.includeZero === true && body2.body.includeClosed === true, body2?.raw)
  check('4: the stores sent are the chips', JSON.stringify(body2.body.stores) === JSON.stringify(['1001', '1002', '1009']))
  await waitRows(page, 4)
  check('4: a zero cell shows once zeros are asked for', (await gridRows(page)).some((r) => r.startsWith('100777|1001|0|0|0|0')))

  await page.locator('[data-stock-all-stores]').check()
  check('4: "All stores" hides the chips and says every store', (await page.locator('[data-stock-chips]').count()) === 0 && /Every store/.test(await page.locator('[data-stock-store-count]').textContent()))
  const beforeAll = stockBodies.length
  await page.locator('[data-stock-check]').click()
  for (let i = 0; i < 50 && stockBodies.length === beforeAll; i++) await page.waitForTimeout(100)
  const body3 = stockBodies.at(-1)
  check('4: "All stores" sends stores: null', body3.raw.includes('"stores":null') && body3.body.stores === null, body3.raw)
  await page.locator('[data-stock-all-stores]').uncheck()
  check('4: turning All stores off gives the chips back', JSON.stringify(await chipCodes(page)) === JSON.stringify(['1001', '1002', '1009']))

  // 5: MAT-00004 → the unavailable panel, never an empty grid
  await page.locator('[data-stock-materials]').fill('101234 999999')
  const beforeFail = stockBodies.length
  await page.locator('[data-stock-check]').click()
  await page.locator('[data-stock-unavailable]').waitFor({ timeout: 10000 })
  check('5: MAT-00004 shows the "Stock Visibility unavailable" panel', /Stock Visibility unavailable/.test(await page.locator('[data-stock-unavailable]').textContent()))
  check('5: …and NO grid, no summary', (await page.locator('[data-stock-grid]').count()) === 0 && (await page.locator('[data-stock-summary]').count()) === 0)
  check('5: …and no toast says it', (await page.locator('[data-sonner-toast]', { hasText: /Stock Visibility/ }).count()) === 0)
  await page.screenshot({ path: `${SHOTS}/5-unavailable.png`, fullPage: true })
  await page.locator('[data-stock-retry]').click()
  await page.waitForTimeout(600)
  check('5: Try again asks the door again', stockBodies.length === beforeFail + 2, String(stockBodies.length - beforeFail))
  check('5: …and still shows the panel while it is down', (await page.locator('[data-stock-unavailable]').count()) === 1)

  // 6: the 51st material is refused on the client
  const fiftyOne = Array.from({ length: 51 }, (_, i) => String(300000 + i)).join('\n')
  await page.locator('[data-stock-materials]').fill(fiftyOne)
  const beforeCap = stockBodies.length
  await page.locator('[data-stock-cap-refused]').waitFor({ timeout: 5000 })
  check('6: the 51st material is refused under the box', /at most 50 materials/.test(await page.locator('[data-stock-cap-refused]').textContent()))
  check('6: …Check is disabled, so no call is made', (await page.locator('[data-stock-check]').isDisabled()) && stockBodies.length === beforeCap)
  await page.locator('[data-stock-materials]').fill(Array.from({ length: 50 }, (_, i) => String(300000 + i)).join(','))
  check('6: exactly 50 is allowed', (await page.locator('[data-stock-cap-refused]').count()) === 0 && !(await page.locator('[data-stock-check]').isDisabled()))

  check('8: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
