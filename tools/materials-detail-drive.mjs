// Material detail drive (ticket 452, BackOffice spec 2544).
//
// Drives the REAL app in Chromium against STUBS of the Materials door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md) — none of the
// `MaterialWeb/*` doors is built, so there is no live SIS.Api to point at. Every stub is built from
// the contract's own example values (material 101234 "PANADOL 500MG 24 TAB", A006 MEDICINE, vendor
// 200345 GSK, price 12.500, barcode 6281234567890, batch 0000123456 / A12 / 2027-03-31, store 1001
// "Riyadh - Olaya" at ATP 12 / SAP 15 / POS -2 / OMS -1 at 2026-10-09T10:42:00):
//   GET  MaterialWeb/Access               → { canSearchMaterials, canCheckStock, canCheckGs1 }
//   GET  MaterialWeb/Material/{no}        → { master, barcodes, batches }; MAT-00001 (404)
//   POST MaterialWeb/Stock                → { cells, storesAsked, materialsAsked }; MAT-00004 (502)
//   GET  Pricing/Access                   → { canOpen } (the simulator's own gate)
// The refusal envelope is the REAL SIS.Api shape `@/core/api` reads —
// errors: [{ errorCode, errorMessage, internalErrorCode }] — not the contract's abbreviation.
//
// It asserts:
//   1. /materials/:no renders the detail; /materials/stock and /materials/gs1 still render their
//      OWN pages (static routes rank above `:no`), and the placeholder is gone;
//   2. the header: number, EN and AR descriptions, the status / serialised / blocked badges;
//   3. Master: four labelled groups, each A–E level ONE "code · description" pair isolated LTR once,
//      the price at 3 decimals labelled ex VAT; a material without ItemInfo shows "not in material
//      info" IN PLACE OF the info groups, and has no Batches tab (not serialised);
//   4. Barcodes and Batches render their grids; Barcodes exports to xlsx with the barcode as text;
//   5. Stock: ONE POST with this material and stores: null; every store whose ATP ≠ 0, highest
//      first; the zero toggle sets includeZero and shows the zero stores; export writes xlsx;
//   6. MAT-00004 shows the "Stock Visibility unavailable" panel and NO grid;
//   7. without canCheckStock the Stock tab says "not permitted" and NO stock call is made; without
//      canSearchMaterials the page shows the denied card and asks for no material;
//   8. MAT-00001 shows "material not found" with a link back to the search;
//   9. "Check promotions in the simulator" lands on /pricing/simulation?material=101234 with ONE
//      item row prefilled (101234, qty 1, EA) and nothing processed; the plain simulator is unchanged;
//  10. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/materials-detail-drive.mjs          (DRIVE_PORT=5244 for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.materials-detail-shots'
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

/** The contract's example master, every field set (a serialised material with ItemInfo). */
const MASTER = {
  materialNumber: '101234',
  description: 'PANADOL 500MG 24 TAB',
  description2: 'بنادول ٥٠٠ ملغ ٢٤ قرص',
  aCode: 'A006', aDesc: 'MEDICINE',
  bCode: 'B010', bDesc: 'PAIN RELIEF',
  cCode: 'C0101', cDesc: 'ANALGESICS',
  dCode: 'D0101', dDesc: 'PARACETAMOL',
  eCode: 'E0101', eDesc: 'TABLETS',
  vendorNo: '200345', vendorName: 'GSK',
  brand: 'PANADOL', manufacturer: 'GSK',
  status: 'ACTIVE',
  itemType: 0,
  blocked: false,
  serialised: true,
  unitPriceExVat: 12.5,
  hasInfo: true,
  vendorName2: 'جي إس كي',
  manufactureCode: 'M100', manufactureName: 'GLAXOSMITHKLINE',
  sfdaCode: '0123-456', wasfatyCode: 'W-99812',
  houseBrand: 'N', otcList: 'OTC', itemGrade: 'A', abc: 'A',
  categoryManager: 'NOURA', purchaseGroup: 'P01',
  materialGroup: 'MG10',
  itemClass: 'RX',
  uomBase: 'EA', salesUom: 'EA', purchaseUom: 'CAR',
  trackingType: 1,
  temperature: '15-25 C',
  createdDate: '2019-04-02',
}

const INFO_FIELDS = [
  'aCode', 'aDesc', 'bCode', 'bDesc', 'cCode', 'cDesc', 'dCode', 'dDesc', 'eCode', 'eDesc',
  'vendorNo', 'vendorName', 'brand', 'manufacturer', 'status', 'vendorName2', 'manufactureCode', 'manufactureName',
  'sfdaCode', 'wasfatyCode', 'houseBrand', 'otcList', 'itemGrade', 'abc', 'categoryManager', 'purchaseGroup', 'itemClass', 'createdDate',
]

const MATERIALS = {
  '101234': {
    master: MASTER,
    barcodes: [
      { barcode: '6281234567890', uom: 'EA', quantity: 1, isMain: true },
      { barcode: '06281234567906', uom: 'CAR', quantity: 24, isMain: false },
    ],
    batches: [
      { batch: '0000123456', vendorBatch: 'A12', expiry: '2027-03-31' },
      { batch: '0000123401', vendorBatch: 'A09', expiry: '2026-11-30' },
    ],
  },
  // No ItemInfo row: every info field null; not serialised, so no batches; blocked.
  '0100777': {
    master: {
      ...Object.fromEntries(Object.entries(MASTER).map(([k, v]) => [k, INFO_FIELDS.includes(k) ? null : v])),
      materialNumber: '0100777',
      description: 'GAUZE SWAB 10X10',
      description2: null,
      serialised: false,
      blocked: true,
      hasInfo: false,
      unitPriceExVat: 3.75,
    },
    barcodes: [{ barcode: '6280000100777', uom: 'EA', quantity: 1, isMain: true }],
    batches: [],
  },
  // A material whose stock read fails (Stock Visibility down).
  '101299': {
    master: { ...MASTER, materialNumber: '101299', description: 'PANADOL EXTRA 24 TAB', serialised: false },
    barcodes: [],
    batches: [],
  },
}

const cell = (storeCode, storeName, atp, sapUnrestricted, pos, oms, updatedAt = '2026-10-09T10:42:00') => ({
  materialNumber: '101234', storeCode, storeName, atp, sapUnrestricted, pos, oms, updatedAt,
})

/** What `MaterialWeb/Stock` answers. A cell with every quantity zero is dropped unless includeZero. */
function stockAnswer(body) {
  if (body.materials.includes('101299')) return 'unavailable'
  const cells = [
    cell('1001', 'Riyadh - Olaya', 12, 15, -2, -1),
    cell('1002', 'Riyadh - Malaz', 4, 4, 0, 0, '2026-10-09T09:05:30'),
    // ATP zero but SAP 15: the door returns it (not every quantity is zero) — the tab leaves it out.
    cell('1003', 'Riyadh - Nakheel', 0, 15, 0, -15),
    cell('2001', 'جدة - التحلية', -1, 0, -1, 0),
  ]
  if (body.includeZero) cells.push(cell('1004', 'Riyadh - Closed shelf', 0, 0, 0, 0))
  return { cells: cells.sort((a, b) => b.atp - a.atp), storesAsked: 212, materialsAsked: 1 }
}

const ALL = { canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }

const browser = await chromium.launch()

async function open({ access = ALL } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const stockBodies = []
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
    const material = /^MaterialWeb\/Material\/(.+)$/.exec(p)
    if (material) {
      const answer = MATERIALS[decodeURIComponent(material[1])]
      if (!answer)
        return route.fulfill(
          envelope(null, { status: 404, success: false, message: 'Material not found. / المادة غير موجودة.', errorCode: 'MAT-00001' }),
        )
      return route.fulfill(envelope(answer))
    }
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
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false, canClear: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, stockBodies }
}

/** Wait until grid `key` holds `n` rows (a row is drawn once per pinned/centre section) and has settled. */
const waitRows = async (page, key, n) => {
  await page.waitForFunction(
    ([k, count]) =>
      new Set([...document.querySelectorAll(`[data-material-grid="${k}"] .ag-row[row-index]`)].map((r) => r.getAttribute('row-index'))).size === count &&
      !document.querySelector(`[data-material-grid="${k}"] .ag-overlay-loading-center`),
    [key, n],
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}

/** Grid `key`'s rows as `col|col|…` over `cols`, in display order. */
const gridRows = (page, key, cols) =>
  page.evaluate(
    ([k, colIds]) => {
      const byIndex = new Map()
      for (const r of document.querySelectorAll(`[data-material-grid="${k}"] .ag-row[row-index]`)) {
        const i = Number(r.getAttribute('row-index'))
        const cells = byIndex.get(i) ?? {}
        for (const c of r.querySelectorAll('[col-id]')) cells[c.getAttribute('col-id')] = c.textContent.trim()
        byIndex.set(i, cells)
      }
      return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => colIds.map((id) => c[id]).join('|'))
    },
    [key, cols],
  )

const tab = (page, name) => page.locator(`[data-material-tab="${name}"]`)
const field = async (page, id) => (await page.locator(`[data-material-field="${id}"]`).textContent()).trim()

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

async function exported(page, key) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-material-export="${key}"]`).click()])
  return { name: download.suggestedFilename(), sheet: sheetText(unzipText(readFileSync(await download.path()))) }
}

// ── 1–5: the detail of a serialised material with ItemInfo ────────────────────────────────────
{
  const { context, page, errors, calls, stockBodies } = await open()

  // 1: the dynamic route renders the detail; the static ones keep their own pages.
  await page.goto(`${BASE}/materials/101234`)
  await page.locator('[data-material-header]').waitFor({ timeout: 20000 })
  check('1: /materials/101234 renders the material detail', (await page.locator('[data-material-detail="101234"]').count()) === 1 && (await page.locator('h1', { hasText: /^Material$/ }).count()) === 1)
  check('1: the placeholder is gone', (await page.locator('[data-material-placeholder]').count()) === 0)
  check('1: the search leaf stays marked on a material', (await page.locator('nav a[href="/materials"][aria-current="page"]').count()) === 1)
  check('1: landing on Master asks for no stock', !calls.includes('MaterialWeb/Stock'))

  // 2: the header
  check('2: the header shows the number, isolated LTR', (await page.locator('[data-material-number] bdi[dir="ltr"]').textContent()) === '101234')
  check('2: …the EN description', (await page.locator('[data-material-description]').textContent()) === 'PANADOL 500MG 24 TAB')
  check('2: …the AR description, in its own isolate', (await page.locator('[data-material-description2] bdi').textContent()) === 'بنادول ٥٠٠ ملغ ٢٤ قرص')
  const badges = await page.locator('[data-material-badge]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-material-badge')}:${e.textContent}`))
  check('2: …the status and serialised badges (not blocked)', JSON.stringify(badges) === JSON.stringify(['status:Status ACTIVE', 'serialised:Serialised']), badges.join(' | '))

  // 3: Master
  const groups = await page.locator('[data-material-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-material-group')))
  check('3: Master draws the four labelled groups', JSON.stringify(groups) === JSON.stringify(['identity', 'hierarchy', 'commercial', 'logistics']), groups.join())
  const headings = await page.locator('[data-material-group] h2').allTextContents()
  check('3: …labelled Identity, Hierarchy, Commercial, Logistics', JSON.stringify(headings) === JSON.stringify(['Identity', 'Hierarchy', 'Commercial', 'Logistics']), headings.join())
  const levelA = await page.locator('[data-material-field="levelA"] bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
  check('3: each level is ONE "code · description" pair, isolated LTR once', JSON.stringify(levelA) === JSON.stringify(['A006 · MEDICINE']), levelA.join(' | '))
  check('3: …down to E', (await field(page, 'levelE')) === 'E0101 · TABLETS')
  check('3: the vendor is its number · name', (await field(page, 'vendor')) === '200345 · GSK')
  const priceLabel = await page.locator('[data-material-field="price"]').evaluate((dd) => dd.previousElementSibling.textContent)
  check('3: the price shows 3 decimals, labelled ex VAT', (await field(page, 'price')) === '12.500' && priceLabel === 'Price ex VAT', `${priceLabel}: ${await field(page, 'price')}`)
  check('3: SFDA, Wasfaty and the UoMs show', (await field(page, 'sfdaCode')) === '0123-456' && (await field(page, 'wasfatyCode')) === 'W-99812' && (await field(page, 'purchaseUom')) === 'CAR')
  check('3: a date-only value is shown as sent', (await field(page, 'createdDate')) === '2019-04-02')
  check('3: a serialised material has all four tabs', JSON.stringify(await page.locator('[data-material-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-material-tab')))) === JSON.stringify(['master', 'barcodes', 'batches', 'stock']))
  await page.screenshot({ path: `${SHOTS}/3-master.png`, fullPage: true })

  // 4: Barcodes, Batches
  await tab(page, 'barcodes').click()
  await waitRows(page, 'barcodes', 2)
  check('4: the tab lands in the URL (?tab=barcodes)', new URL(page.url()).searchParams.get('tab') === 'barcodes')
  const barcodes = await gridRows(page, 'barcodes', ['barcode', 'uom', 'quantity', 'isMain'])
  check('4: Barcodes lists barcode, UoM, quantity and the main flag', JSON.stringify(barcodes) === JSON.stringify(['6281234567890|EA|1|Main', '06281234567906|CAR|24|']), barcodes.join(' / '))
  const bx = await exported(page, 'barcodes')
  const bLines = bx.sheet.split('\n')
  check('4: Barcodes exports, named for the material', /^material-101234-barcodes-\d{8}-\d{4}\.xlsx$/.test(bx.name), bx.name)
  check('4: …the barcode as text (its leading zero kept), the quantity a number', bLines[0] === 'Barcode|UoM|Quantity|Main' && bLines.includes('6281234567890|EA|n:1|Main') && bLines.some((l) => /^06281234567906\|CAR\|n:24\|?$/.test(l)), bLines.join(' / '))
  await tab(page, 'batches').click()
  await waitRows(page, 'batches', 2)
  const batches = await gridRows(page, 'batches', ['batch', 'vendorBatch', 'expiry'])
  check('4: Batches lists SAP batch, vendor batch and expiry (as sent)', batches.includes('0000123456|A12|2027-03-31') && batches.includes('0000123401|A09|2026-11-30'), batches.join(' / '))
  check('4: still no stock asked before the Stock tab is opened', stockBodies.length === 0)

  // 5: Stock
  await tab(page, 'stock').click()
  await waitRows(page, 'stock', 3)
  check('5: the Stock tab asks the door ONCE', stockBodies.length === 1, String(stockBodies.length))
  check('5: …a POST with this one material, stores: null, both toggles off', stockBodies[0]?.method === 'POST' && stockBodies[0]?.raw === JSON.stringify({ materials: ['101234'], stores: null, includeZero: false, includeClosed: false }), stockBodies[0]?.raw)
  const stock = await gridRows(page, 'stock', ['storeCode', 'storeName', 'atp', 'sapUnrestricted', 'pos', 'oms', 'updatedAt'])
  check(
    '5: every store whose ATP ≠ 0, highest ATP first, signed, local time unshifted',
    JSON.stringify(stock) ===
      JSON.stringify(['1001|Riyadh - Olaya|12|15|-2|-1|2026-10-09 10:42', '1002|Riyadh - Malaz|4|4|0|0|2026-10-09 09:05', '2001|جدة - التحلية|-1|0|-1|0|2026-10-09 10:42']),
    stock.join(' / '),
  )
  check('5: the summary counts the stores shown', (await page.locator('[data-material-stock-summary]').getAttribute('data-material-stock-summary')) === '3' && /3 stores/.test(await page.locator('[data-material-stock-summary]').textContent()))
  await page.screenshot({ path: `${SHOTS}/5-stock.png`, fullPage: true })
  const sx = await exported(page, 'stock')
  const sLines = sx.sheet.split('\n')
  check('5: Stock exports, named for the material', /^material-101234-stock-\d{8}-\d{4}\.xlsx$/.test(sx.name), sx.name)
  check('5: …store as text, signed quantities as numbers, no isolates', sLines[0] === 'Store|Store name|ATP|SAP unrestricted|POS|OMS|Last updated' && sLines.includes('1001|Riyadh - Olaya|n:12|n:15|n:-2|n:-1|2026-10-09 10:42') && !/[\u2066-\u2069]/.test(sx.sheet), sLines.join(' / '))

  await page.locator('[data-material-stock-zero]').check()
  await waitRows(page, 'stock', 5)
  check('5: "show zero stores" asks again with includeZero: true', stockBodies.length === 2 && stockBodies[1].body.includeZero === true && stockBodies[1].body.stores === null, stockBodies.at(-1)?.raw)
  const withZero = (await gridRows(page, 'stock', ['storeCode', 'atp'])).join(' / ')
  check('5: …and the zero-ATP stores join, in ATP order', withZero === '1001|12 / 1002|4 / 1003|0 / 1004|0 / 2001|-1', withZero)
  await page.locator('[data-material-stock-zero]').uncheck()
  await waitRows(page, 'stock', 3)
  check('5: unticking hides them again', (await gridRows(page, 'stock', ['storeCode'])).join() === '1001,1002,2001')

  // A pasted link opens its tab.
  await page.goto(`${BASE}/materials/101234?tab=stock`)
  await waitRows(page, 'stock', 3)
  check('5: ?tab=stock opens the Stock tab directly', (await tab(page, 'stock').getAttribute('aria-selected')) === 'true')

  // 1 (cont.): the static routes still rank above :no.
  await page.goto(`${BASE}/materials/stock`)
  await page.locator('[data-stock-materials]').waitFor({ timeout: 20000 })
  check('1: /materials/stock is the stock check, not a material called "stock"', (await page.locator('[data-material-detail]').count()) === 0 && !calls.includes('MaterialWeb/Material/stock'))
  await page.goto(`${BASE}/materials/gs1`)
  await page.locator('[data-gs1-scan]').waitFor({ timeout: 20000 })
  check('1: /materials/gs1 is the GS1 check, not a material called "gs1"', (await page.locator('[data-material-detail]').count()) === 0 && !calls.includes('MaterialWeb/Material/gs1'))

  // Back to the search.
  await page.goto(`${BASE}/materials/101234`)
  await page.locator('[data-material-back]').click()
  await page.waitForURL(/\/materials$/, { timeout: 10000 })
  check('1: the back link returns to the material search', new URL(page.url()).pathname === '/materials')

  check('10: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 3: a material without ItemInfo, not serialised ───────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/materials/0100777`)
  await page.locator('[data-material-header]').waitFor({ timeout: 20000 })
  check('3: the number keeps its leading zero', (await page.locator('[data-material-number]').textContent()) === '0100777')
  const badges = await page.locator('[data-material-badge]').evaluateAll((els) => els.map((e) => e.getAttribute('data-material-badge')))
  check('3: badges: blocked and "not in material info" (no status: it is an info field)', JSON.stringify(badges) === JSON.stringify(['blocked', 'notInInfo']), badges.join())
  const sections = await page.locator('[data-material-master] > *').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-material-group') ?? (e.hasAttribute('data-material-not-in-info') ? 'notInInfo' : '?')),
  )
  check('3: hasInfo:false shows "not in material info" IN PLACE OF the hierarchy — no empty group', JSON.stringify(sections) === JSON.stringify(['identity', 'notInInfo', 'commercial', 'logistics']), sections.join())
  check('3: …saying so in words', /Not in material info/.test(await page.locator('[data-material-not-in-info]').textContent()))
  const fields = await page.locator('[data-material-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-material-field')))
  check('3: only the material\'s own fields are drawn — no empty vendor, brand or level row', JSON.stringify(fields) === JSON.stringify(['materialType', 'materialGroup', 'price', 'uomBase', 'salesUom', 'purchaseUom', 'trackingType', 'temperature']), fields.join())
  check('3: …the price still 3 decimals', (await field(page, 'price')) === '3.750')
  check('3: a material that is not serialised has no Batches tab', JSON.stringify(await page.locator('[data-material-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-material-tab')))) === JSON.stringify(['master', 'barcodes', 'stock']))
  await page.goto(`${BASE}/materials/0100777?tab=batches`)
  await page.locator('[data-material-master]').waitFor({ timeout: 20000 })
  check('3: …and ?tab=batches on it falls back to Master', (await tab(page, 'master').getAttribute('aria-selected')) === 'true')
  await page.screenshot({ path: `${SHOTS}/3-no-info.png`, fullPage: true })
  check('3: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: MAT-00004 ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, stockBodies } = await open()
  await page.goto(`${BASE}/materials/101299?tab=stock`)
  await page.locator('[data-stock-unavailable]').waitFor({ timeout: 20000 })
  check('6: MAT-00004 shows the "Stock Visibility unavailable" panel', /Stock Visibility unavailable/.test(await page.locator('[data-stock-unavailable]').textContent()))
  check('6: …and NO grid, no summary', (await page.locator('[data-material-grid="stock"]').count()) === 0 && (await page.locator('[data-material-stock-summary]').count()) === 0)
  const before = stockBodies.length
  await page.locator('[data-stock-retry]').click()
  for (let i = 0; i < 30 && stockBodies.length === before; i++) await page.waitForTimeout(100)
  check('6: Try again asks the door again', stockBodies.length === before + 1)
  await page.screenshot({ path: `${SHOTS}/6-unavailable.png`, fullPage: true })
  check('6: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: the grants ───────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open({ access: { canSearchMaterials: true, canCheckStock: false, canCheckGs1: false } })
  await page.goto(`${BASE}/materials/101234`)
  await page.locator('[data-material-header]').waitFor({ timeout: 20000 })
  await tab(page, 'stock').click()
  await page.locator('[data-material-stock-denied]').waitFor({ timeout: 10000 })
  check('7: without canCheckStock the Stock tab says "not permitted"', /Not permitted/.test(await page.locator('[data-material-stock-denied]').textContent()))
  check('7: …with no toggle and no grid', (await page.locator('[data-material-stock-zero]').count()) === 0 && (await page.locator('[data-material-grid="stock"]').count()) === 0)
  await page.waitForTimeout(500)
  check('7: …and NO stock call is made', !calls.includes('MaterialWeb/Stock'), calls.join())
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open({ access: { canSearchMaterials: false, canCheckStock: true, canCheckGs1: true } })
  await page.goto(`${BASE}/materials/101234`)
  await page.locator('[role="alert"]', { hasText: 'No access to material details' }).waitFor({ timeout: 20000 })
  check('7: without canSearchMaterials the page shows the denied card', (await page.locator('[data-material-detail]').count()) === 0)
  check('7: …and asks for no material', !calls.some((c) => c.startsWith('MaterialWeb/Material')), calls.join())
  check('7: no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: MAT-00001 ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/materials/999001`)
  await page.locator('[data-material-not-found]').waitFor({ timeout: 20000 })
  const text = await page.locator('[data-material-not-found]').textContent()
  check('8: MAT-00001 shows "Material not found", naming the number', /Material not found/.test(text) && /There is no material 999001\./.test(text), text)
  check('8: …and no tabs', (await page.locator('[data-material-tab]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/8-not-found.png`, fullPage: true })
  await page.locator('[data-material-not-found-back]').click()
  await page.waitForURL(/\/materials$/, { timeout: 10000 })
  check('8: its link goes back to the search', new URL(page.url()).pathname === '/materials')
  check('8: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: the simulator link ────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  // The plain simulator first: unchanged — one empty row.
  await page.goto(`${BASE}/pricing/simulation`)
  const firstRow = page.locator('table tbody tr').first()
  await firstRow.locator('input').first().waitFor({ timeout: 20000 })
  const plain = await page.locator('table tbody tr').evaluateAll((rows) => rows.map((r) => [...r.querySelectorAll('input')].map((i) => i.value).join('|')))
  check('9: without ?material= the simulator opens as always — one empty row', JSON.stringify(plain) === JSON.stringify(['|1|EA|']), plain.join(' / '))

  await page.goto(`${BASE}/materials/101234`)
  const link = page.locator('[data-material-simulator]')
  await link.waitFor({ timeout: 20000 })
  check('9: the link reads "Check promotions in the simulator"', (await link.textContent()).trim() === 'Check promotions in the simulator')
  check('9: …and is a plain path with the material', (await link.getAttribute('href')) === '/pricing/simulation?material=101234')
  await link.click()
  await page.waitForURL(/\/pricing\/simulation\?material=101234$/, { timeout: 10000 })
  await page.locator('table tbody tr input').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  const rows = await page.locator('table tbody tr').evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll('input')].map((i) => i.value).join('|')))
  check('9: the simulator lands with ONE row prefilled: 101234, qty 1, EA', JSON.stringify(rows) === JSON.stringify(['101234|1|EA|']), rows.join(' / '))
  check('9: …and processes nothing by itself', !calls.includes('Pricing/Simulate'), calls.filter((c) => c.startsWith('Pricing')).join())
  await page.screenshot({ path: `${SHOTS}/9-simulator.png`, fullPage: true })
  check('9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
