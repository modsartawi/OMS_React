// Materials LIVE drive (ticket 455, BackOffice spec 2544) — the four screens against REAL doors.
//
// The four stubbed drives (tools/materials-{search,detail,stock,gs1}-drive.mjs) stay the regression
// for the screens' behaviour: they pin exact fixture values no real database holds. This drive is
// their live twin. It stubs NOTHING, signs in for real, and asserts what holds for any real data:
// every MaterialWeb door answers on the envelope, each answer carries exactly the contract's keys
// (C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md), and each screen
// renders what came back. The inputs are real values the owner picks, in
// tools/materials-live-inputs.json — a "TODO" input SKIPs its checks, and a SKIP is not green.
//
//   1. point the dev proxy at the SIS.Api under test and run the app:
//        $env:SIS_API='https://<staging-host>'; npx vite --port 5244 --strictPort
//      (SIS_API unset = the local SIS.Api on :5111)
//   2. sign in one of two ways, the secret never in the repo:
//        SIS_USER=<id> SIS_PASS=<pw>   — POST Auth/Login through the proxy
//        SIS_COOKIE=<sis_session>      — a cookie copied from a browser session
//   3. DRIVE_PORT=5244 node tools/materials-live-drive.mjs [--only search,detail,stock,gs1]
//
// Read-only: every door is a read (Stock and Gs1/Check are POSTs with a body, nothing more).
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5244}`
const SHOTS = 'tools/.materials-live-shots'
mkdirSync(SHOTS, { recursive: true })

const argv = process.argv.slice(2)
const onlyAt = argv.indexOf('--only')
const ONLY = onlyAt === -1 ? ['search', 'detail', 'stock', 'gs1'] : (argv[onlyAt + 1] ?? '').split(',').filter(Boolean)

const INPUTS = JSON.parse(readFileSync('tools/materials-live-inputs.json', 'utf8'))
const todo = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && /^TODO/.test(v)) || (Array.isArray(v) && (v.length === 0 || v.some(todo)))

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const skipped = []
const skip = (name, why) => {
  skipped.push(name)
  console.log(`SKIP  ${name} — ${why}`)
}

// ── The contract's keys, door by door ─────────────────────────────────────────────────────────────

const ROW_KEYS = [
  'materialNumber', 'description', 'description2', 'aCode', 'aDesc', 'bCode', 'bDesc', 'cCode', 'cDesc',
  'dCode', 'dDesc', 'eCode', 'eDesc', 'vendorNo', 'vendorName', 'brand', 'manufacturer', 'status',
  'itemType', 'blocked', 'serialised', 'unitPriceExVat', 'hasInfo',
]
const KEYS = {
  access: ['canSearchMaterials', 'canCheckStock', 'canCheckGs1'],
  search: ['resolvedAs', 'resolvedFrom', 'limited', 'rows'],
  row: ROW_KEYS,
  level: ['code', 'description'],
  facet: ['value', 'label'],
  detail: ['master', 'barcodes', 'batches'],
  master: [
    ...ROW_KEYS, 'vendorName2', 'manufactureCode', 'manufactureName', 'sfdaCode', 'wasfatyCode', 'houseBrand',
    'otcList', 'itemGrade', 'abc', 'categoryManager', 'purchaseGroup', 'materialGroup', 'itemClass', 'uomBase',
    'salesUom', 'purchaseUom', 'trackingType', 'temperature', 'createdDate',
  ],
  barcode: ['barcode', 'uom', 'quantity', 'isMain'],
  batch: ['batch', 'vendorBatch', 'expiry'],
  stock: ['cells', 'storesAsked', 'materialsAsked'],
  cell: ['materialNumber', 'storeCode', 'storeName', 'atp', 'sapUnrestricted', 'pos', 'oms', 'updatedAt'],
  storeSet: ['value', 'label', 'storeCount'],
  gs1: ['code', 'duplicate', 'parse', 'material', 'materialReason', 'batch', 'status', 'soldRef', 'heldBy', 'historyCount'],
  parse: ['valid', 'gtin', 'expiry', 'lot', 'serial', 'issues'],
  history: ['date', 'time', 'trxType', 'storeCode', 'storeName', 'machine', 'trxNumber', 'lot', 'lotMismatch'],
}

/** The keys an object carries that the contract does not, and the contract's keys it lacks. */
function keyDrift(obj, expected) {
  if (!obj || typeof obj !== 'object') return 'not an object'
  const have = Object.keys(obj)
  const extra = have.filter((k) => !expected.includes(k))
  const missing = expected.filter((k) => !have.includes(k))
  return extra.length || missing.length ? `extra [${extra}] missing [${missing}]` : ''
}
const shapeCheck = (name, obj, expected) => {
  const drift = keyDrift(obj, expected)
  check(name, drift === '', drift)
}

// ── Sign-in and the page harness ──────────────────────────────────────────────────────────────────

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })

if (process.env.SIS_COOKIE) {
  await context.addCookies([{ name: 'sis_session', value: process.env.SIS_COOKIE, url: BASE }])
} else if (process.env.SIS_USER) {
  const res = await context.request.post(`${BASE}/api/Auth/Login`, {
    headers: { 'Content-Type': 'application/json', 'X-Web-Client': '1' },
    data: { userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' },
  })
  const body = await res.json().catch(() => null)
  const cookies = await context.cookies(BASE)
  if (!cookies.some((c) => c.name === 'sis_session')) {
    console.error(`Login did not set a session cookie (HTTP ${res.status()}): ${body?.message ?? ''}`)
    console.error('If the account needs an OTP, sign in in a browser and pass SIS_COOKIE instead.')
    process.exit(2)
  }
  console.log(`Signed in as ${body?.data?.userId ?? process.env.SIS_USER}.`)
} else {
  console.error('Set SIS_USER + SIS_PASS, or SIS_COOKIE.')
  process.exit(2)
}

/** Every MaterialWeb answer the page receives: path, status, envelope. */
const answers = []
const errors = []
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
page.on('response', async (res) => {
  const url = new URL(res.url())
  const at = url.pathname.indexOf('/api/MaterialWeb/')
  if (at === -1) return
  const body = await res.json().catch(() => null)
  answers.push({ path: url.pathname.slice(at + 5), query: url.searchParams, status: res.status(), body })
})
await page.addInitScript(() => {
  localStorage.setItem('oms.locale', 'en')
  localStorage.setItem('oms.railExpanded', 'true')
})

/** The latest answer of one door, after `since` answers had been seen. */
const answerOf = (door, since = 0) => answers.slice(since).filter((a) => a.path === door || a.path.startsWith(door + '/')).at(-1)
const waitAnswer = async (door, since) => {
  for (let i = 0; i < 300; i++) {
    const a = answerOf(door, since)
    if (a) return a
    await page.waitForTimeout(100)
  }
  return null
}
const ok = (a) => !!a && a.status === 200 && a.body?.success === true
const why = (a) => (a ? `HTTP ${a.status} ${a.body?.errors?.[0]?.errorCode ?? ''} ${a.body?.message ?? ''}`.trim() : 'no answer')

const gridRows = (sel) =>
  page.evaluate((s) => new Set([...document.querySelectorAll(`${s} .ag-row[row-index]`)].map((r) => r.getAttribute('row-index'))).size, sel)

// ── The access probe ──────────────────────────────────────────────────────────────────────────────

await page.goto(`${BASE}/materials`)
const probe = await waitAnswer('MaterialWeb/Access', 0)
check('access: MaterialWeb/Access answers', ok(probe), why(probe))
const grants = probe?.body?.data ?? {}
shapeCheck('access: exactly the three flags', grants, KEYS.access)
console.log(`      this session: ${JSON.stringify(grants)}`)

// ── materials-search ──────────────────────────────────────────────────────────────────────────────

async function searchFor(text) {
  const since = answers.length
  await page.locator('[data-material-q]').fill(text)
  await page.locator('[data-material-search]').click()
  const a = await waitAnswer('MaterialWeb/Search', since)
  await page.waitForTimeout(400)
  return a
}

if (ONLY.includes('search')) {
  if (grants.canSearchMaterials !== true) {
    skip('search', 'this session lacks canSearchMaterials')
  } else {
    await page.locator('[data-material-box]').waitFor({ timeout: 20000 })
    const cases = [
      ['an English word', INPUTS.searchText, 'text', null],
      ['an Arabic word', INPUTS.searchArabic, 'text', null],
      ['a barcode', INPUTS.barcode, 'barcode', 'barcode'],
      ['a GS1 scan', INPUTS.gs1Scan, 'gs1', 'gs1'],
      ['an SFDA/Wasfaty code', INPUTS.sfdaCode, 'code', 'code'],
    ]
    let shaped = false
    for (const [label, q, resolvedAs, chip] of cases) {
      if (todo(q)) { skip(`search: ${label}`, 'no input'); continue }
      const a = await searchFor(q.replace(/\{GS\}/g, '\u001d'))
      check(`search: ${label} answers`, ok(a), why(a))
      if (!ok(a)) continue
      if (!shaped) { shapeCheck('search: the answer carries exactly the contract keys', a.body.data, KEYS.search) }
      const rows = a.body.data?.rows ?? []
      check(`search: ${label} resolves as "${resolvedAs}"`, a.body.data?.resolvedAs === resolvedAs, String(a.body.data?.resolvedAs))
      check(`search: ${label} finds rows`, rows.length > 0, String(rows.length))
      if (rows[0] && !shaped) { shapeCheck('search: a row carries exactly the contract keys', rows[0], KEYS.row); shaped = true }
      const drawn = await gridRows('[data-material-grid]')
      check(`search: ${label} — the grid draws the rows`, drawn > 0, `${drawn} drawn / ${rows.length} answered`)
      const chipKind = (await page.locator('[data-resolved-chip]').count()) ? await page.locator('[data-resolved-chip]').getAttribute('data-resolved-chip') : null
      check(`search: ${label} — resolved chip ${chip ?? 'absent'}`, chipKind === chip, String(chipKind))
    }

    // A → C level path, through the cascade.
    const levelsSince = answers.length
    await page.goto(`${BASE}/materials`)
    await page.locator('[data-material-box]').waitFor({ timeout: 20000 })
    const path = INPUTS.levelPath
    if (todo(path)) {
      skip('search: an A→C level path', 'no input')
    } else {
      for (const [i, code] of path.entries()) {
        const level = 'ABC'[i]
        const since = answers.length
        const root = page.locator(`[data-material-filter="level${level}"]`)
        await root.locator('[data-picker-trigger]').click()
        const a = await waitAnswer('MaterialWeb/Levels', since)
        check(`search: Levels ${level} answers`, ok(a), why(a))
        const values = a?.body?.data ?? []
        if (values[0]) shapeCheck(`search: a level ${level} value carries exactly { code, description }`, values[0], KEYS.level)
        check(`search: Levels ${level} offers no blank code and no null description`, values.every((v) => v.code?.trim() && v.description !== null))
        if (i > 0) check(`search: Levels ${level} is asked under the level above`, a?.query.getAll(`${'abc'[i - 1]}Level`).includes(path[i - 1]), a?.query.toString())
        const option = root.locator(`[data-picker-option="${code}"] input`)
        const offered = await option.waitFor({ timeout: 10000 }).then(() => true, () => false)
        check(`search: level ${level} offers ${code}`, offered)
        if (!offered) { await page.keyboard.press('Escape'); break }
        await option.click()
        await page.keyboard.press('Escape')
      }
      const a = await waitAnswer('MaterialWeb/Search', levelsSince)
      check('search: the level path searches and finds rows', ok(a) && (a.body.data?.rows?.length ?? 0) > 0, why(a))
    }

    // Facets: one kind, any value.
    const since = answers.length
    const vendor = page.locator('[data-material-filter="vendor"]')
    if (await vendor.count()) {
      await vendor.locator('[data-picker-trigger]').click()
      const a = await waitAnswer('MaterialWeb/Facets', since)
      check('search: Facets answers', ok(a), why(a))
      if (a?.body?.data?.[0]) shapeCheck('search: a facet value carries exactly { value, label }', a.body.data[0], KEYS.facet)
      await page.keyboard.press('Escape')
    }
    await page.screenshot({ path: `${SHOTS}/search.png` })
  }
}

// ── materials-detail ──────────────────────────────────────────────────────────────────────────────

if (ONLY.includes('detail')) {
  const no = INPUTS.serialisedMaterial
  if (grants.canSearchMaterials !== true) {
    skip('detail', 'this session lacks canSearchMaterials')
  } else if (todo(no)) {
    skip('detail', 'no serialisedMaterial input')
  } else {
    const since = answers.length
    await page.goto(`${BASE}/materials/${encodeURIComponent(no)}`)
    const a = await waitAnswer('MaterialWeb/Material', since)
    check(`detail: Material/${no} answers`, ok(a), why(a))
    if (ok(a)) {
      const d = a.body.data
      shapeCheck('detail: { master, barcodes, batches }', d, KEYS.detail)
      shapeCheck('detail: the master carries exactly the contract keys', d.master, KEYS.master)
      if (d.barcodes[0]) shapeCheck('detail: a barcode carries exactly the contract keys', d.barcodes[0], KEYS.barcode)
      if (d.batches[0]) shapeCheck('detail: a batch carries exactly the contract keys', d.batches[0], KEYS.batch)
      check('detail: the input material IS serialised', d.master.serialised === true)
      await page.locator('[data-material-master]').waitFor({ timeout: 20000 })
      const tabs = await page.locator('[data-material-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-material-tab')))
      const wantStock = grants.canCheckStock === true
      check(`detail: the tabs are master, barcodes, batches${wantStock ? ', stock' : ' (no stock: no grant)'}`, JSON.stringify(tabs) === JSON.stringify(['master', 'barcodes', 'batches', ...(wantStock ? ['stock'] : [])]), tabs.join())
      await page.locator('[data-material-tab="batches"]').click()
      await page.waitForTimeout(500)
      const batchRows = await gridRows('[data-material-grid="batches"]')
      check('detail: the Batches tab draws the batches', d.batches.length === 0 ? batchRows === 0 : batchRows > 0, `${batchRows} drawn / ${d.batches.length} answered`)
      if (wantStock) {
        const s = answers.length
        await page.locator('[data-material-tab="stock"]').click()
        const st = await waitAnswer('MaterialWeb/Stock', s)
        check('detail: the Stock tab asks MaterialWeb/Stock and gets stock', ok(st), why(st))
        await page.waitForTimeout(800)
        const unavailable = await page.locator('[data-stock-unavailable]').count()
        check('detail: the Stock tab draws a summary, not the unavailable panel', unavailable === 0 && (await page.locator('[data-material-stock-summary]').count()) === 1)
      }
      await page.screenshot({ path: `${SHOTS}/detail.png` })
    }
  }
}

// ── materials-stock ───────────────────────────────────────────────────────────────────────────────

if (ONLY.includes('stock')) {
  if (grants.canCheckStock !== true) {
    skip('stock', 'this session lacks canCheckStock')
  } else if (todo(INPUTS.stockMaterials) || todo(INPUTS.stockCity)) {
    skip('stock', 'no stockMaterials / stockCity input')
  } else {
    const since = answers.length
    await page.goto(`${BASE}/materials/stock`)
    await page.locator('[data-stock-materials]').waitFor({ timeout: 20000 })
    await page.locator('[data-stock-materials]').fill(INPUTS.stockMaterials.join('\n'))
    await page.locator('[data-stock-set-kind]').selectOption('city')
    const sets = await waitAnswer('MaterialWeb/StoreSets', since)
    check('stock: StoreSets?kind=city answers', ok(sets), why(sets))
    if (sets?.body?.data?.[0]) shapeCheck('stock: a store set carries exactly { value, label, storeCount }', sets.body.data[0], KEYS.storeSet)
    const offered = await page.locator(`[data-stock-set-value] option[value="${INPUTS.stockCity}"]`).waitFor({ state: 'attached', timeout: 10000 }).then(() => true, () => false)
    check(`stock: the city set "${INPUTS.stockCity}" is offered`, offered)
    if (offered) {
      const s2 = answers.length
      await page.locator('[data-stock-set-value]').selectOption(INPUTS.stockCity)
      await page.locator('[data-stock-set-add]').click()
      const stores = await waitAnswer('MaterialWeb/StoreSets', s2)
      check('stock: the city\'s stores answer', ok(stores) && (stores.body.data?.length ?? 0) > 0, why(stores))
      await page.waitForTimeout(500)
      const s3 = answers.length
      await page.locator('[data-stock-check]').click()
      const st = await waitAnswer('MaterialWeb/Stock', s3)
      check('stock: MaterialWeb/Stock answers (not MAT-00004)', ok(st), why(st))
      if (ok(st)) {
        shapeCheck('stock: the answer carries exactly { cells, storesAsked, materialsAsked }', st.body.data, KEYS.stock)
        if (st.body.data.cells[0]) shapeCheck('stock: a cell carries exactly the contract keys', st.body.data.cells[0], KEYS.cell)
        check(`stock: ${INPUTS.stockMaterials.length} materials were asked`, st.body.data.materialsAsked === INPUTS.stockMaterials.length, String(st.body.data.materialsAsked))
        await page.locator('[data-stock-summary]').waitFor({ timeout: 20000 })
        check('stock: the summary is drawn, not the unavailable panel', (await page.locator('[data-stock-unavailable]').count()) === 0)
      }
    }
    await page.screenshot({ path: `${SHOTS}/stock.png` })
  }
}

// ── materials-gs1 ─────────────────────────────────────────────────────────────────────────────────

if (ONLY.includes('gs1')) {
  if (grants.canCheckGs1 !== true) {
    skip('gs1', 'this session lacks canCheckGs1')
  } else if (todo(INPUTS.gs1SoldScan)) {
    skip('gs1', 'no gs1SoldScan input')
  } else {
    const since = answers.length
    await page.goto(`${BASE}/materials/gs1`)
    await page.locator('[data-gs1-scan]').waitFor({ timeout: 20000 })
    await page.locator('[data-gs1-scan]').fill(INPUTS.gs1SoldScan.replace(/\{GS\}/g, '\u001d'))
    await page.locator('[data-gs1-scan]').press('Enter')
    const a = await waitAnswer('MaterialWeb/Gs1/Check', since)
    check('gs1: Gs1/Check answers', ok(a), why(a))
    if (ok(a)) {
      const ans = a.body.data?.[0]
      shapeCheck('gs1: an answer carries exactly the contract keys', ans, KEYS.gs1)
      shapeCheck('gs1: its parse carries exactly the contract keys', ans?.parse, KEYS.parse)
      check('gs1: the known sold unit reads SOLD', ans?.status === 'SOLD', `${ans?.status} (${ans?.materialReason ?? ans?.material?.materialNumber})`)
      check('gs1: …and has a history', (ans?.historyCount ?? 0) > 0, String(ans?.historyCount))
      await page.locator('[data-gs1-card="answered"]').waitFor({ timeout: 20000 })
      check('gs1: the card shows SOLD', (await page.locator('[data-gs1-card-status]').getAttribute('data-gs1-card-status')) === 'SOLD')
      const h = answers.length
      await page.locator('[data-gs1-card-show-history]').click()
      const hist = await waitAnswer('MaterialWeb/Gs1/History', h)
      check('gs1: Gs1/History answers', ok(hist), why(hist))
      if (hist?.body?.data?.[0]) shapeCheck('gs1: a history row carries exactly the contract keys', hist.body.data[0], KEYS.history)
      const drawn = await page.locator('[data-gs1-history-row]').first().waitFor({ timeout: 10000 }).then(() => page.locator('[data-gs1-history-row]').count(), () => 0)
      check('gs1: the history is drawn', drawn > 0 && drawn === (hist?.body?.data?.length ?? -1), `${drawn} drawn / ${hist?.body?.data?.length} answered`)
    }
    await page.screenshot({ path: `${SHOTS}/gs1.png` })
  }
}

// ── Every door answered on the envelope ───────────────────────────────────────────────────────────

const bad = answers.filter((a) => a.status >= 500 || a.body === null || typeof a.body?.success !== 'boolean')
check('every MaterialWeb answer is an envelope, none a 5xx', bad.length === 0, bad.map((a) => `${a.path} ${why(a)}`).join(' | '))
check('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed, ${skipped.length} skipped${skipped.length ? ' (' + skipped.join(', ') + ')' : ''}.`)
process.exit(failed || skipped.length ? 1 : 0)
