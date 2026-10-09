// Material search drive (ticket 451, BackOffice spec 2544).
//
// Drives the REAL app in Chromium against STUBS of the Materials door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md) — none of the
// `MaterialWeb/*` doors is built, so there is no live SIS.Api to point at. Every stub is built from
// the contract's own example values (material 101234, vendor 200345, A006/B010/C0101, …):
//   GET MaterialWeb/Access   → { canSearchMaterials, canCheckStock, canCheckGs1 }
//   GET MaterialWeb/Search   → { resolvedAs, resolvedFrom, limited, rows }; MAT-00006 refusal
//   GET MaterialWeb/Levels   → [{ code, description }] under the levels above
//   GET MaterialWeb/Facets   → [{ value, label }]
// The refusal envelope is the REAL SIS.Api shape `@/core/api` reads —
// errors: [{ errorCode, errorMessage, internalErrorCode }] — not the contract's abbreviation.
//
// It asserts:
//   1. the Materials group follows Pricing with its three leaves, and costs ONE probe call;
//      without `canSearchMaterials` the search leaf is hidden and the URL shows the denied card
//      with no search call; without `canCheckStock` the stock leaf and "check stock" are hidden;
//   2. each query kind renders rows — text, barcode, a raw GS1 scan (GS byte kept on the wire),
//      an SFDA/Wasfaty code, filters only — with a resolved chip for gs1 / barcode / code only;
//   3. MAT-00006 shows inline beside the box, never as a toast;
//   4. the cascade narrows: B is asked under A, changing A drops a B no longer offered, and
//      picking B never touches A;
//   5. the facets typeahead asks per kind and a vendor's value is its number; blocked is
//      three-state; every change lands in the URL with repeated params, and a pasted URL drives
//      the door with the very same query string;
//   6. the limited banner shows;
//   7. "check stock for selected" carries the ticked materials (leading zeros kept), and the 51st
//      tick is refused;
//   8. a row opens /materials/:no; /materials/stock and /materials/gs1 match their STATIC routes;
//   9. Export writes xlsx: no selection column, the price a number, identities as text, no isolates;
//  10. under RTL the vendor pair stays number-first and the chip's values are isolated; no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/materials-search-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.materials-search-shots'
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

const GS = '\u001d'
const GS1_SCAN = `0106281234567890172703311OA12${GS}21X9`

/** A search row exactly as the contract has it. */
const row = (materialNumber, over = {}) => ({
  materialNumber,
  description: 'PANADOL 500MG 24 TAB',
  description2: 'بنادول ٥٠٠ ملغ ٢٤ قرص',
  aCode: 'A006',
  aDesc: 'MEDICINE',
  bCode: 'B010',
  bDesc: 'PAIN RELIEF',
  cCode: 'C0101',
  cDesc: 'ANALGESICS',
  dCode: 'D0101',
  dDesc: 'PARACETAMOL',
  eCode: 'E0101',
  eDesc: 'TABLETS',
  vendorNo: '200345',
  vendorName: 'GSK',
  brand: 'PANADOL',
  manufacturer: 'GSK',
  status: 'ACTIVE',
  itemType: 0,
  blocked: false,
  serialised: true,
  unitPriceExVat: 12.5,
  hasInfo: true,
  ...over,
})

const ROWS = [
  row('101234'),
  row('0100777', {
    description: 'PANADOL EXTRA 24 TAB',
    description2: 'بنادول اكسترا',
    vendorName: 'شركة جي إس كي',
    blocked: true,
    serialised: false,
    unitPriceExVat: 9.125,
  }),
  // No ItemInfo row: levels, vendor, brand and status null.
  row('100999', {
    description: 'PANADOL SAMPLE',
    description2: null,
    aCode: null, aDesc: null, bCode: null, bDesc: null, cCode: null, cDesc: null,
    dCode: null, dDesc: null, eCode: null, eDesc: null,
    vendorNo: null, vendorName: null, brand: null, manufacturer: null, status: null,
    serialised: false,
    unitPriceExVat: null,
    hasInfo: false,
  }),
]

const many = (n) => Array.from({ length: n }, (_, i) => row(String(300000 + i), { description: `MATERIAL ${i}` }))

/** What `MaterialWeb/Search` answers, by its query. */
function searchAnswer(qs) {
  const q = qs.get('q')
  if (q === null) return { resolvedAs: null, resolvedFrom: null, limited: false, rows: ROWS.slice(0, 2) }
  if (q.length < 3 && [...qs.keys()].length === 1) return 'tooShort'
  if (q === '6281234567890')
    return { resolvedAs: 'barcode', resolvedFrom: { gtin: '06281234567890', barcode: '6281234567890' }, limited: false, rows: [ROWS[0]] }
  if (q === GS1_SCAN)
    return { resolvedAs: 'gs1', resolvedFrom: { gtin: '06281234567890', barcode: '6281234567890' }, limited: false, rows: [ROWS[0]] }
  if (q === 'SFDA-123') return { resolvedAs: 'code', resolvedFrom: null, limited: false, rows: ROWS.slice(0, 2) }
  if (q === 'limited') return { resolvedAs: 'text', resolvedFrom: null, limited: true, rows: ROWS.slice(0, 2) }
  if (q === 'many') return { resolvedAs: 'text', resolvedFrom: null, limited: false, rows: many(55) }
  return { resolvedAs: 'text', resolvedFrom: null, limited: false, rows: ROWS }
}

/** What `MaterialWeb/Levels` answers: B depends on A, as the door does. */
function levelsAnswer(qs) {
  const level = qs.get('level')
  const a = qs.getAll('aLevel')
  if (level === 'A') return [{ code: 'A006', description: 'MEDICINE' }, { code: 'A008', description: 'PERSONAL CARE' }]
  if (level === 'B') {
    const out = []
    if (a.length === 0 || a.includes('A006')) out.push({ code: 'B010', description: 'PAIN RELIEF' }, { code: 'B011', description: 'COLD & FLU' })
    if (a.length === 0 || a.includes('A008')) out.push({ code: 'B020', description: 'SKIN CARE' })
    return out
  }
  if (level === 'C') return [{ code: 'C0101', description: 'ANALGESICS' }]
  return []
}

const FACETS = {
  vendor: [{ value: '200345', label: 'GSK' }, { value: '0200346', label: 'SANOFI' }],
  brand: [{ value: 'PANADOL', label: 'PANADOL' }],
  manufacturer: [{ value: 'GSK', label: 'GSK' }],
  status: [{ value: 'ACTIVE', label: 'ACTIVE' }, { value: 'DISCONTINUED', label: 'DISCONTINUED' }],
}

const ALL = { canSearchMaterials: true, canCheckStock: true, canCheckGs1: true }

const browser = await chromium.launch()

async function open(dir, { access = ALL } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const searches = []
  const levelCalls = []
  const facetCalls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'MaterialWeb/Access') return route.fulfill(envelope(access))
    if (p === 'MaterialWeb/Search') {
      searches.push(url.search.slice(1))
      const answer = searchAnswer(url.searchParams)
      if (answer === 'tooShort')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'Type at least 3 characters to search. / اكتب 3 أحرف على الأقل للبحث.',
            errorCode: 'MAT-00006',
          }),
        )
      return route.fulfill(envelope(answer))
    }
    if (p === 'MaterialWeb/Levels') {
      levelCalls.push(url.search.slice(1))
      return route.fulfill(envelope(levelsAnswer(url.searchParams)))
    }
    if (p === 'MaterialWeb/Facets') {
      facetCalls.push(url.search.slice(1))
      const kind = url.searchParams.get('kind')
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      return route.fulfill(envelope((FACETS[kind] ?? []).filter((f) => f.label.toLowerCase().includes(q))))
    }
    // Pricing's leaves are shown so the Materials group's place after it can be read.
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, searches, levelCalls, facetCalls }
}

/** Wait until the grid holds `n` rows (a row is drawn once per pinned/centre section) and has settled. */
const waitRows = async (page, n) => {
  await page.waitForFunction(
    (count) =>
      new Set([...document.querySelectorAll('[data-material-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size === count &&
      !document.querySelector('[data-material-grid] .ag-overlay-loading-center'),
    n,
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}

const gridNumbers = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-material-grid] .ag-row[row-index] [col-id="materialNumber"]')]
      .map((c) => [Number(c.closest('.ag-row').getAttribute('row-index')), c.textContent])
      .sort((a, b) => a[0] - b[0])
      .map(([, text]) => text),
  )

/** One row's cell by material number and column id, wherever the section that holds it. */
const rowLocator = (page, no) =>
  page.locator('[data-material-grid] .ag-row', { has: page.locator('[col-id="materialNumber"]', { hasText: new RegExp(`^${no}$`) }) })

const urlSearch = (page) => new URL(page.url()).search.slice(1)

/** Submit the smart box. */
async function searchFor(page, text) {
  await page.locator('[data-material-q]').fill(text)
  await page.locator('[data-material-search]').click()
}

/** Open a picker, (optionally type), tick/untick one value, and close it. */
async function pick(page, name, value, find) {
  const root = page.locator(`[data-material-filter="${name}"]`)
  await root.locator('[data-picker-trigger]').click()
  if (find !== undefined) {
    await root.locator('[data-picker-query]').fill(find)
    // The typeahead asks once the typing has stood still (250 ms).
    await page.waitForTimeout(600)
  }
  const option = root.locator(`[data-picker-option="${value}"] input`)
  await option.waitFor({ timeout: 10000 })
  await option.click()
  await page.keyboard.press('Escape')
}

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

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Materials$/ })
  await header.first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  // The rail's group headers, in order (a group is collapsed until it holds the screen on view).
  const groups = await page.locator('nav button[aria-expanded]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check('1: the Materials group comes right after the Pricing group', groups.indexOf('Materials') === groups.indexOf('Pricing & Promotions') + 1 && groups.indexOf('Pricing & Promotions') >= 0, groups.join(' · '))
  await header.first().click()
  await page.locator('nav a[href="/materials"]').first().waitFor({ timeout: 5000 })
  const hrefs = await page.locator('nav a[href^="/materials"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: the three Materials leaves are shown, in order', JSON.stringify(hrefs) === JSON.stringify(['/materials', '/materials/stock', '/materials/gs1']), hrefs.join())
  const leafText = await page.locator('nav a[href^="/materials"]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check('1: the leaves say "Material", never item/product', JSON.stringify(leafText) === JSON.stringify(['Material search', 'Stock check', 'GS1 check']), leafText.join())
  await page.locator('nav a[href="/materials"]').first().click()
  await page.locator('[data-material-box]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('1: the group, its three leaves and the page gate cost ONE probe call', calls.filter((c) => c === 'MaterialWeb/Access').length === 1, String(calls.filter((c) => c === 'MaterialWeb/Access').length))
  check('1: the landing page asks for nothing until a search', !calls.includes('MaterialWeb/Search') && (await page.locator('[data-material-not-searched]').count()) === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open('ltr', { access: { canSearchMaterials: false, canCheckStock: true, canCheckGs1: true } })
  await page.goto(`${BASE}/materials/stock`)
  await page.locator('nav a[href="/materials/stock"]').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('1: without canSearchMaterials the search leaf is hidden (the others stay)', (await page.locator('nav a[href="/materials"]').count()) === 0 && (await page.locator('nav a[href="/materials/gs1"]').count()) === 1)
  await page.goto(`${BASE}/materials?q=panadol`)
  const card = page.locator('[role="alert"]', { hasText: 'No access to material search' })
  await card.waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('1: the URL shows the denied card and never searches', (await card.count()) === 1 && !calls.includes('MaterialWeb/Search'))
  check('1: no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  // An older drive's world: the probe answers nothing this client knows (an unstubbed door).
  const { context, page } = await open('ltr', { access: [] })
  await page.goto(`${BASE}/materials`)
  await page.locator('nav button[aria-expanded]', { hasText: /^Pricing/ }).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  const groups = await page.locator('nav button[aria-expanded]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check('1: a probe answer with no flags hides the whole group (fails closed)', !groups.includes('Materials') && (await page.locator('nav a[href^="/materials"]').count()) === 0, groups.join(' · '))
  await context.close()
}

// ── 2–9: granted, LTR ─────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, searches, levelCalls, facetCalls } = await open('ltr')
  await page.goto(`${BASE}/materials`)
  await page.locator('[data-material-box]').waitFor({ timeout: 20000 })

  // 2: each query kind
  await searchFor(page, 'panadol')
  await waitRows(page, 3)
  check('2: text → rows', JSON.stringify(await gridNumbers(page)) === JSON.stringify(['101234', '0100777', '100999']), (await gridNumbers(page)).join())
  check('2: text → no chip', (await page.locator('[data-resolved-chip]').count()) === 0)
  check('2: the search lands in the URL', urlSearch(page) === 'q=panadol', urlSearch(page))
  const count = await page.locator('[data-status-count]').innerText()
  check('2: the status bar counts the materials', /3 materials/.test(count), count)

  await searchFor(page, '6281234567890')
  await waitRows(page, 1)
  const chip = page.locator('[data-resolved-chip="barcode"]')
  await chip.waitFor({ timeout: 5000 })
  const chipText = await chip.innerText()
  check('2: barcode → its row and a chip "Barcode … is material 101234"', chipText.includes('Barcode 6281234567890 is material 101234'), chipText)
  check('2: the chip isolates each value once', (await chip.locator('bdi[dir="ltr"]').count()) === 2)

  await searchFor(page, GS1_SCAN)
  await page.locator('[data-resolved-chip="gs1"]').waitFor({ timeout: 10000 })
  const gs1Text = await page.locator('[data-resolved-chip="gs1"]').innerText()
  check('2: a GS1 scan → a chip naming its GTIN and material', gs1Text.includes('06281234567890') && gs1Text.includes('101234'), gs1Text)
  check(
    '2: the raw scan reaches the door byte for byte (GS kept)',
    new URLSearchParams(searches.at(-1)).get('q') === GS1_SCAN,
    JSON.stringify(new URLSearchParams(searches.at(-1)).get('q')),
  )

  await searchFor(page, 'SFDA-123')
  await page.locator('[data-resolved-chip="code"]').waitFor({ timeout: 10000 })
  await waitRows(page, 2)
  const codeText = await page.locator('[data-resolved-chip="code"]').innerText()
  check('2: an SFDA code matching two materials → a chip with the count', /SFDA or Wasfaty code SFDA-123 matched 2 materials/.test(codeText), codeText)

  // 3: MAT-00006 inline
  await searchFor(page, 'pa')
  const tooShort = page.locator('[data-material-too-short]')
  await tooShort.waitFor({ timeout: 10000 })
  const tooShortText = await tooShort.innerText()
  const box = await page.locator('[data-material-box]').boundingBox()
  const said = await tooShort.boundingBox()
  check('3: MAT-00006 shows the server sentence inline, inside the box form', /at least 3 characters/.test(tooShortText) && said.y < box.y + 80, tooShortText)
  check('3: MAT-00006 is never a toast', (await page.locator('[data-sonner-toast]').count()) === 0)
  check('3: MAT-00006 is not the general failure banner', (await page.locator('[role="alert"]', { hasText: 'The search failed' }).count()) === 0)
  await page.screenshot({ path: `${SHOTS}/ltr-too-short.png` })

  // 4: the cascade
  await page.locator('[data-material-clear]').click()
  await page.locator('[data-material-not-searched]').waitFor({ timeout: 5000 })
  check('4: Clear all empties the URL', urlSearch(page) === '', urlSearch(page))
  await pick(page, 'levelA', 'A006')
  await page.waitForFunction(() => location.search === '?aLevel=A006', null, { timeout: 5000 })
  await waitRows(page, 2)
  check('4: a level alone is a search (filters only → no chip)', (await page.locator('[data-resolved-chip]').count()) === 0)
  await page.locator('[data-material-filter="levelB"] [data-picker-trigger]').click()
  await page.locator('[data-material-filter="levelB"] [data-picker-option="B010"]').waitFor({ timeout: 10000 })
  const bOptions = await page.locator('[data-material-filter="levelB"] [data-picker-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-picker-option')))
  check('4: B is asked under the chosen A', levelCalls.includes('level=B&aLevel=A006'), levelCalls.join(' ; '))
  check('4: B offers only what exists under A006', JSON.stringify(bOptions) === JSON.stringify(['B010', 'B011']), bOptions.join())
  const pairText = await page.locator('[data-material-filter="levelB"] [data-picker-option="B010"]').innerText()
  check('4: a level shows as "code · description", isolated once', pairText.trim() === 'B010 · PAIN RELIEF' && (await page.locator('[data-material-filter="levelB"] [data-picker-option="B010"] bdi[dir="ltr"]').count()) === 1, pairText)
  await page.locator('[data-material-filter="levelB"] [data-picker-option="B010"] input').click()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => location.search === '?aLevel=A006&bLevel=B010', null, { timeout: 5000 })
  check('4: picking B never touches A', urlSearch(page) === 'aLevel=A006&bLevel=B010', urlSearch(page))
  // Change A: A006 → A008. B010 is not offered under A008, so it is dropped; A stays as chosen.
  await page.locator('[data-material-filter="levelA"] [data-picker-trigger]').click()
  await page.locator('[data-material-filter="levelA"] [data-picker-option="A006"] input').click()
  await page.locator('[data-material-filter="levelA"] [data-picker-option="A008"] input').click()
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => location.search === '?aLevel=A008', null, { timeout: 10000 }).catch(() => {})
  check('4: changing A drops the B choice no longer offered (B010 under A008)', urlSearch(page) === 'aLevel=A008', urlSearch(page))
  check('4: B was re-asked under the new A', levelCalls.includes('level=B&aLevel=A008'), levelCalls.join(' ; '))
  await page.waitForTimeout(300)
  check(
    '4: the pickers agree — A holds one choice, B none',
    (await page.locator('[data-material-filter="levelA"] [data-picker-count]').innerText()) === '1' &&
      (await page.locator('[data-material-filter="levelB"] [data-picker-count]').count()) === 0,
  )
  await page.screenshot({ path: `${SHOTS}/ltr-cascade.png` })

  // Enter in a picker's Find box narrows the list; it never submits the search form.
  {
    const before = searches.length
    await page.locator('[data-material-q]').fill('typed but not searched')
    await page.locator('[data-material-filter="levelA"] [data-picker-trigger]').click()
    await page.locator('[data-material-filter="levelA"] [data-picker-query]').fill('A00')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(400)
    check("4: Enter in a level's Find box is not a search", searches.length === before && !urlSearch(page).includes('q='), urlSearch(page))
    await page.keyboard.press('Escape')
    await page.locator('[data-material-filter="levelB"] [data-picker-trigger]').click()
    check("4: a level's Find box opens empty (A's text does not narrow B)", (await page.locator('[data-material-filter="levelB"] [data-picker-query]').inputValue()) === '')
    await page.keyboard.press('Escape')
    await page.locator('[data-material-q]').fill('')
  }

  // 5: facets, tri-state, URL
  await pick(page, 'vendor', '200345', 'gs')
  await page.waitForFunction(() => location.search.includes('vendor=200345'), null, { timeout: 5000 })
  check('5: the vendor typeahead asks the vendor facet with what was typed', facetCalls.some((c) => c === 'kind=vendor&q=gs'), facetCalls.join(' ; '))
  check('5: a vendor travels as its number', urlSearch(page) === 'aLevel=A008&vendor=200345', urlSearch(page))
  await pick(page, 'status', 'DISCONTINUED')
  check('5: the status typeahead asks its own kind', facetCalls.some((c) => c.startsWith('kind=status')), facetCalls.join(' ; '))
  await page.locator('[data-material-filter="blocked"] [data-tri="no"]').click()
  await page.waitForFunction(() => location.search.includes('blocked=false'), null, { timeout: 5000 })
  await page.locator('[data-material-filter="itemType"] [data-picker-trigger]').click()
  await page.locator('[data-material-filter="itemType"] [data-picker-query]').fill('0')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await page.locator('[data-material-take]').selectOption('500')
  await page.waitForFunction(() => location.search.includes('take=500'), null, { timeout: 5000 })
  const built = urlSearch(page)
  check(
    '5: every filter is in the URL in the contract order, lists repeated',
    built === 'aLevel=A008&vendor=200345&status=DISCONTINUED&blocked=false&itemType=0&take=500',
    built,
  )
  await page.waitForTimeout(400)
  check('5: the door got the URL\'s own query string', searches.at(-1) === built, searches.at(-1))

  // A shared link drives the door with the very same string.
  const shared = 'q=panadol&aLevel=A006&aLevel=A008&bLevel=B010&vendor=200345&blocked=false&serialised=true&take=500'
  const before = searches.length
  await page.goto(`${BASE}/materials?${shared}`)
  await waitRows(page, 3)
  await page.waitForTimeout(300)
  const sent = searches.slice(before)
  check('5: a pasted URL → the door is asked with the same query string', sent.includes(shared), sent.join(' ; '))
  check('5: …and the URL stays as pasted (no lower choice dropped that is offered)', urlSearch(page) === shared, urlSearch(page))
  check('5: the box shows the pasted text', (await page.locator('[data-material-q]').inputValue()) === 'panadol')

  // 6: limited
  await page.goto(`${BASE}/materials?q=limited`)
  await page.locator('[data-material-limited]').waitFor({ timeout: 10000 })
  const limitedText = await page.locator('[data-material-limited]').innerText()
  check('6: a limited answer shows "limited — narrow your search"', /Limited/.test(limitedText) && /Narrow your search/.test(limitedText), limitedText)
  await page.goto(`${BASE}/materials?q=panadol`)
  await waitRows(page, 3)
  check('6: an unlimited answer shows no banner', (await page.locator('[data-material-limited]').count()) === 0)

  // 2/9: the grid's cells
  const cells = await page.evaluate(() => {
    const byRow = (no) => {
      const index = [...document.querySelectorAll('[data-material-grid] .ag-row[row-index]')].find(
        (r) => r.querySelector('[col-id="materialNumber"]')?.textContent === no,
      )?.getAttribute('row-index')
      const rows = [...document.querySelectorAll(`[data-material-grid] .ag-row[row-index="${index}"]`)]
      const cell = (id) => rows.map((r) => r.querySelector(`[col-id="${id}"]`)).find(Boolean)
      return {
        price: cell('unitPriceExVat')?.textContent ?? '',
        vendor: cell('vendor')?.textContent ?? '',
        vendorLtr: !!cell('vendor')?.querySelector('bdi[dir="ltr"]'),
        blocked: cell('blocked')?.textContent ?? '',
        serialised: cell('serialised')?.textContent ?? '',
        aCode: cell('aCode')?.textContent ?? '',
        ar: cell('description2')?.querySelector('bdi')?.textContent ?? '',
      }
    }
    return { a: byRow('101234'), b: byRow('0100777'), none: byRow('100999') }
  })
  check('2: price is 3 decimals', cells.a.price === '12.500' && cells.b.price === '9.125', `${cells.a.price} ${cells.b.price}`)
  check('2: the vendor is "number · name", isolated left-to-right', cells.a.vendor === '200345 · GSK' && cells.a.vendorLtr, cells.a.vendor)
  check('2: badges — blocked and serialised', cells.b.blocked === 'Blocked' && cells.a.serialised === 'Serialised' && cells.a.blocked === '', JSON.stringify([cells.a, cells.b]))
  check('2: the AR description is isolated free text', cells.a.ar === 'بنادول ٥٠٠ ملغ ٢٤ قرص', cells.a.ar)
  check('2: a material with no ItemInfo still appears, with empty levels', cells.none.aCode === '' && cells.none.price === '', JSON.stringify(cells.none))
  check('2: a leading-zero material number is kept', (await gridNumbers(page)).includes('0100777'))
  await page.screenshot({ path: `${SHOTS}/ltr-results.png` })

  // 9: export
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-material-export]').click()])
  const sheet = sheetText(unzipText(readFileSync(await download.path())))
  const lines = sheet.split('\n')
  check('9: the export has a header and three rows', lines.length === 4, String(lines.length))
  check('9: no selection column — the first header is the material', lines[0].startsWith('Material|'), lines[0])
  check('9: the price is a number, the material and vendor are text', /\|n:12\.5$/.test(lines.find((l) => l.startsWith('101234')) ?? '') && (lines.find((l) => l.startsWith('0100777')) ?? '').includes('|200345 · '), sheet)
  check('9: no isolate characters in the file', !/[\u2066-\u2069]/.test(sheet))
  check('9: the file is named for materials', /^materials.*\.xlsx$/.test(download.suggestedFilename()), download.suggestedFilename())

  // 7: check stock for selected
  // The tick box is in the same pinned section as the material number.
  const tick = (no) => rowLocator(page, no).locator('input[type="checkbox"]').click()
  check('7: "check stock for selected" is disabled until a row is ticked', await page.locator('[data-material-check-stock]').isDisabled())
  await tick('101234')
  await tick('0100777')
  await page.locator('[data-selected-count]').waitFor({ timeout: 5000 })
  check('7: it counts the ticked rows', (await page.locator('[data-selected-count]').innerText()) === '2')
  await page.locator('[data-material-check-stock]').click()
  await page.waitForURL(/\/materials\/stock/, { timeout: 10000 })
  check('7: it carries the ticked materials, leading zeros kept', urlSearch(page) === 'material=101234&material=0100777', urlSearch(page))
  await page.locator('[data-material-placeholder="static"]').waitFor({ timeout: 10000 })
  check('8: /materials/stock matches its STATIC route, not /materials/:no', (await page.locator('[data-material-placeholder="static"]').count()) === 1)
  const marked = await page.locator('nav a[aria-current="page"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('8: on the stock page the rail marks the Stock check leaf alone', JSON.stringify(marked) === JSON.stringify(['/materials/stock']), marked.join())
  await page.goto(`${BASE}/materials/gs1`)
  await page.locator('[data-material-placeholder]').waitFor({ timeout: 10000 })
  check('8: /materials/gs1 matches its STATIC route', (await page.locator('[data-material-placeholder="static"]').count()) === 1)

  // 7: the 51st tick is refused
  await page.goto(`${BASE}/materials?q=many`)
  await page.locator('[data-status-count]', { hasText: '55 materials' }).waitFor({ timeout: 20000 })
  for (let i = 0; i < 51; i++) {
    // Rows are virtualised: scroll row i into the grid's viewport before ticking it.
    await page.evaluate((index) => {
      const viewport = document.querySelector('[data-material-grid] .ag-body-viewport')
      const first = document.querySelector('[data-material-grid] .ag-row[row-index]')
      if (viewport && first) viewport.scrollTop = Math.max(0, (index - 2) * first.getBoundingClientRect().height)
    }, i)
    const box = page.locator(`[data-material-grid] .ag-row[row-index="${i}"] input[type="checkbox"]`).first()
    await box.waitFor({ timeout: 5000 })
    await box.click()
  }
  await page.locator('[data-stock-cap-refused]').waitFor({ timeout: 5000 })
  const refused = await page.locator('[data-stock-cap-refused]').innerText()
  check('7: the 51st tick is refused, naming the cap', /at most 50 materials/.test(refused), refused)
  check('7: the count stays at 50', (await page.locator('[data-selected-count]').innerText()) === '50')
  // A shift-click RANGE that crosses the cap keeps the rows that fit and refuses only the rest.
  const boxAt = async (i) => {
    await page.evaluate((index) => {
      const viewport = document.querySelector('[data-material-grid] .ag-body-viewport')
      const first = document.querySelector('[data-material-grid] .ag-row[row-index]')
      if (viewport && first) viewport.scrollTop = Math.max(0, (index - 2) * first.getBoundingClientRect().height)
    }, i)
    const box = page.locator(`[data-material-grid] .ag-row[row-index="${i}"] input[type="checkbox"]`).first()
    await box.waitFor({ timeout: 5000 })
    return box
  }
  await (await boxAt(49)).click()
  await (await boxAt(48)).click()
  await page.locator('[data-selected-count]', { hasText: /^48$/ }).waitFor({ timeout: 5000 })
  await (await boxAt(48)).click()
  await (await boxAt(53)).click({ modifiers: ['Shift'] })
  await page.waitForTimeout(400)
  const afterRange = await page.locator('[data-selected-count]').innerText()
  check('7: a range tick past the cap keeps the rows that fit (50), refusing the rest', afterRange === '50' && (await page.locator('[data-stock-cap-refused]').count()) === 1, afterRange)
  await page.screenshot({ path: `${SHOTS}/ltr-cap.png` })

  // 8: a row opens its material
  await page.goto(`${BASE}/materials?q=panadol`)
  await waitRows(page, 3)
  await page.locator('[data-material-link]', { hasText: '0100777' }).click()
  await page.waitForURL(/\/materials\/0100777$/, { timeout: 10000 })
  await page.locator('[data-material-placeholder="material"]').waitFor({ timeout: 10000 })
  check('8: a row opens /materials/:no (the placeholder until 452)', true)
  await page.goBack()
  await waitRows(page, 3)
  check('8: Back returns to the same search', urlSearch(page) === 'q=panadol', urlSearch(page))

  check('ltr: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 1/7: without the stock grant ────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('ltr', { access: { canSearchMaterials: true, canCheckStock: false, canCheckGs1: false } })
  await page.goto(`${BASE}/materials?q=panadol`)
  await waitRows(page, 3)
  check('1: without canCheckStock the stock leaf is hidden', (await page.locator('nav a[href="/materials/stock"]').count()) === 0)
  check('1: without canCheckGs1 the GS1 leaf is hidden', (await page.locator('nav a[href="/materials/gs1"]').count()) === 0)
  check('7: without canCheckStock "check stock for selected" is hidden, and no row can be ticked', (await page.locator('[data-material-check-stock]').count()) === 0 && (await page.locator('[data-material-grid] input[type="checkbox"]').count()) === 0)
  check('no-stock: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: RTL ─────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('rtl')
  await page.goto(`${BASE}/materials?q=6281234567890`)
  await page.locator('[data-resolved-chip="barcode"]').waitFor({ timeout: 20000 })
  check('10: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('10: the chip isolates both values', (await page.locator('[data-resolved-chip] bdi[dir="ltr"]').count()) === 2)
  await page.goto(`${BASE}/materials?q=panadol`)
  await waitRows(page, 3)
  const vendor = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-material-grid] [col-id="vendor"] bdi[dir="ltr"]')]
    return cells.map((c) => c.textContent)
  })
  check('10: the vendor pair stays number-first under RTL (one LTR isolate per cell)', vendor.includes('200345 · شركة جي إس كي'), vendor.join(' | '))
  await page.screenshot({ path: `${SHOTS}/rtl-results.png` })
  check('rtl: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
