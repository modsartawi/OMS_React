// Hybris stock stores drive (tickets 847 + 850, BackOffice spec 3447).
//
// Drives the REAL app in Chromium against STUBS of the guessed Hybris stock door contract
// (`tools/hybris-stock-stubs.mjs` — BackOffice 3453/3456 are not built, 2026-11-07), LTR and RTL.
//
// ── 847 ── it asserts:
//   1. the Hybris stock group is its own, right after HungerStation, its leaves on ONE probe call;
//      without the view grant (or on a bare 403) the group is hidden and the URL shows the denied card;
//   2. the mode banner reads Shadow (files Hybris does not import) / Live / Off, and "unknown" when
//      Status fails — never live; a standing alert shows under it;
//   3. every store lists with its flag; a marked store's health (delta behind → Unhealthy RED, full
//      overdue → Unhealthy RED, a failed last push AMBER, healthy, awaiting first full); an unmarked
//      store's health cells are blank; the marked filter and search reach the door and the URL;
//   4. Mark opens a reason dialog that says a full comes first; Confirm waits for a reason; it POSTs
//      Stores/{code}/Mark with exactly { reason } (trimmed, unicode kept); the row flips in place to
//      Marked / Awaiting first full with NO list re-read; HYS-00001 inline; HYS-00003 re-reads the
//      list and turns Confirm off;
//   5. Unmark says nothing is sent to Hybris and it keeps its last stock; the row flips to Not marked;
//   6. History opens a drawer (who, when, why, door), newest first, the new change on top;
//      `?history=<code>` opens it from a link; Escape closes it and takes it off the URL;
//   7. view-only (canView without canManage): no Mark / Unmark anywhere, a view-only note, History
//      still opens;
//   8. under RTL (direction only) the document is right-to-left, machine values are isolated, and
//      mark, unmark and history all work.
//
//   1. run the app:  npx vite --port 5247 --strictPort
//   2. DRIVE_PORT=5247 node tools/hybris-stock-stores-drive.mjs
import { createRequire } from 'node:module'
import { installStubs } from './hybris-stock-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4\d\d|5\d\d)/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  const stubs = await installStubs(page, opts)
  return { context, page, errors, ...stubs }
}

const GRID = '[data-stores-grid]'
const waitRows = async (page, n) => {
  await page.waitForFunction(
    ([g, count]) =>
      new Set([...document.querySelectorAll(`${g} .ag-row[row-index]`)].map((r) => r.getAttribute('row-index'))).size === count &&
      !document.querySelector(`${g} .ag-overlay-loading-center`),
    [GRID, n],
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}
const rowIndex = (page, code) =>
  page.evaluate(
    ([g, c]) => {
      const el = [...document.querySelectorAll(`${g} .ag-row[row-index] [col-id="storeCode"]`)].find((e) => e.textContent.trim() === c)
      return el ? el.closest('.ag-row').getAttribute('row-index') : null
    },
    [GRID, code],
  )
const cell = async (page, code, col) => {
  const i = await rowIndex(page, code)
  if (i === null) return null
  return page.evaluate(([g, i, col]) => document.querySelector(`${g} .ag-row[row-index="${i}"] [col-id="${col}"]`)?.textContent.trim() ?? null, [GRID, i, col])
}
const rowClass = async (page, code) => {
  const i = await rowIndex(page, code)
  return page.evaluate(([g, i]) => [...document.querySelectorAll(`${g} .ag-row[row-index="${i}"]`)].map((r) => r.className).join(' '), [GRID, i])
}
const dialog = (page) => page.locator('dialog[open]')
const urlSearch = (page) => new URL(page.url()).search.slice(1)
const groupHeaders = (page) => page.locator('nav button[aria-expanded]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
const run = (name) => !ONLY || ONLY.includes(name)

// ── 1: the menu and the gate ──────────────────────────────────────────────────────────────────
if (run('menu')) {
  const { context, page, errors, calls } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^Hybris stock$/ })
  await header.first().waitFor({ timeout: 20000 })
  const groups = await groupHeaders(page)
  // Its place among the groups (right after HungerStation) is pinned by src/layout/menu-hungerstation.test.ts;
  // here the other areas' probes are denied, so only the shown groups can be compared.
  check('1: the Hybris stock group is its own, before Insurance rules', groups.filter((g) => g === 'Hybris stock').length === 1 && groups.indexOf('Hybris stock') === groups.indexOf('Insurance rules') - 1, groups.join(' · '))
  await header.first().click()
  await page.locator('nav a[href="/hybris-stock/stores"]').first().click()
  await waitRows(page, 6)
  check('1: the page title reads Hybris stock stores', (await page.locator('h1').innerText()) === 'Hybris stock stores')
  const leaves = await page.locator('nav a[href^="/hybris-stock"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check('1: the leaves are Stores, Materials and Pushes', JSON.stringify(leaves) === JSON.stringify(['/hybris-stock/stores', '/hybris-stock/materials', '/hybris-stock/pushes']), leaves.join())
  check('1: the group, its leaves and the gate cost ONE probe call', calls.filter((c) => c === 'HybrisStockWeb/Access').length === 1)
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (run('menu')) {
  for (const access of [{ canView: false, canManage: false }, 403]) {
    const { context, page, errors, calls } = await open('ltr', { access })
    await page.goto(`${BASE}/`)
    await page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$|^Deliverect$|^Materials$/ }).first().waitFor({ timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(800)
    check(`1 (${JSON.stringify(access)}): the group is hidden (fail closed)`, !(await groupHeaders(page)).includes('Hybris stock'))
    await page.goto(`${BASE}/hybris-stock/stores`)
    await page.getByText(/No access to Hybris stock|This screen is unavailable/).first().waitFor({ timeout: 20000 })
    check(`1 (${JSON.stringify(access)}): the URL shows the denied card and no Stores call`, !calls.includes('HybrisStockWeb/Stores'))
    check(`1 (${JSON.stringify(access)}): no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// ── 2: the mode banner ────────────────────────────────────────────────────────────────────────
if (run('mode')) {
  for (const [opts, reading, words] of [
    [{ mode: 'shadow' }, 'shadow', /Shadow mode.*Hybris does not import/s],
    [{ mode: 'live' }, 'live', /Live.*hot folder/s],
    [{ mode: 'off' }, 'off', /sync is off/],
    [{ mode: 'bogus' }, 'unknown', /mode unknown.*Do not assume it is live/s],
    [{ status: 'fail' }, 'unknown', /mode unknown/],
  ]) {
    const { context, page, errors } = await open('ltr', opts)
    await page.goto(`${BASE}/hybris-stock/stores`)
    await waitRows(page, 6)
    await page.locator(`[data-mode-banner="${reading}"]`).waitFor({ timeout: 10000 })
    const text = await page.locator('[data-mode-banner]').innerText()
    check(`2: ${JSON.stringify(opts)} reads ${reading}`, words.test(text), text)
    if (reading === 'shadow') check('2: the interval shows', /Delta every 30 minutes/.test(text), text)
    if (reading === 'unknown') check(`2: ${JSON.stringify(opts)} never says live`, !/^Live/m.test(text))
    check(`2 (${reading}): no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  const { context, page } = await open('ltr', { alerts: [{ kind: 'storeBehind', message: 'Store 0099 delta is behind. / الفرع 0099 متأخر.', since: '2026-11-07T09:30:00' }] })
  await page.goto(`${BASE}/hybris-stock/stores`)
  await page.locator('[data-mode-alert="storeBehind"]').waitFor({ timeout: 10000 })
  check('2: a standing alert shows under the banner with its time', /Store 0099 delta is behind.*since 2026-11-07 09:30/s.test(await page.locator('[data-mode-alert="storeBehind"]').innerText()))
  await context.close()
}

// ── 3–6: list, health, filters, mark / unmark, history ─────────────────────────────────────────
async function stores(dir) {
  // Under RTL the direction flips and the copy stays English (`lng` is `en` app-wide; the Arabic
  // namespace ships beside it and is checked key for key by the i18n-keys tests).
  const ar = false
  const rtl = dir === 'rtl'
  const tag = dir === 'rtl' ? 'RTL' : 'LTR'
  const { context, page, errors, reads, writes } = await open(dir)
  await page.goto(`${BASE}/hybris-stock/stores`)
  await waitRows(page, 6)
  const storeReads = () => reads.filter((r) => r.path === 'HybrisStockWeb/Stores')

  check(`3 ${tag}: the list asks the door with no params`, storeReads()[0]?.search === '', JSON.stringify(storeReads()))
  check(`3 ${tag}: every store lists, marked and not`, (await cell(page, '1234', 'marked')) === (ar ? 'معلَّم' : 'Marked') && (await cell(page, '0450', 'marked')) === (ar ? 'غير معلَّم' : 'Not marked'))
  if (!rtl) {
    check('3: a healthy marked store reads Healthy, with its health times', (await cell(page, '1234', 'health')) === 'Healthy' && (await cell(page, '1234', 'lastDeltaAt')) === '2026-11-07 10:30' && (await cell(page, '1234', 'lastFullAt')) === '2026-11-06 03:05' && (await cell(page, '1234', 'nextFullDue')) === '2026-11-08 03:00')
    check('3: a delta behind is Unhealthy and RED', (await cell(page, '0099', 'health')) === 'Unhealthy' && (await cell(page, '0099', 'causes')) === 'Delta behind' && /danger-050/.test(await rowClass(page, '0099')))
    check('3: a full overdue is Unhealthy and RED, its error shown', (await cell(page, '2001', 'health')) === 'Unhealthy' && (await cell(page, '2001', 'causes')) === 'Full overdue' && /danger-050/.test(await rowClass(page, '2001')) && (await cell(page, '2001', 'lastError')) === 'Blob upload failed: 503 Server Busy')
    check('3: a failed last push on a store not behind is AMBER', (await cell(page, '3003', 'health')) === 'Last push failed' && /attention-050/.test(await rowClass(page, '3003')))
    check('3: an unmarked store has blank health cells and no highlight', (await cell(page, '0450', 'lastDeltaAt')) === '' && (await cell(page, '0450', 'nextFullDue')) === '' && !/danger-050|attention-050/.test(await rowClass(page, '0450')))
    check('3: the status bar counts stores, marked and unhealthy', /6 stores/.test(await page.locator('[data-status-count]').innerText()) && /4 marked/.test(await page.locator('[data-status-marked]').innerText()) && /2 unhealthy/.test(await page.locator('[data-status-unhealthy]').innerText()))
    const hint = await page.locator(`${GRID} [data-health="unhealthy"]`).first().getAttribute('title')
    check('3: the unhealthy badge says why in words', /more than two intervals/.test(hint ?? ''), hint)

    await page.locator('[data-filter-marked]').selectOption('marked')
    await waitRows(page, 4)
    check('3: the marked filter reaches the door and the URL', storeReads().at(-1).search === 'marked=marked' && urlSearch(page) === 'marked=marked')
    await page.locator('[data-filter-q]').fill('olaya')
    await page.locator('[data-stores-search]').click()
    await waitRows(page, 1)
    check('3: search reaches the door and the URL', storeReads().at(-1).search === 'marked=marked&q=olaya' && urlSearch(page) === 'marked=marked&q=olaya')
    await page.locator('[data-stores-clear]').click()
    await waitRows(page, 6)
    check('3: Clear resets the URL', urlSearch(page) === '')
  }
  if (rtl) {
    const dirOk = await page.evaluate(() => document.documentElement.dir === 'rtl')
    check('8 RTL: the document is right-to-left', dirOk)
    const isolated = await page.evaluate((g) => !!document.querySelector(`${g} [col-id="lastDeltaAt"] bdi[dir="ltr"], ${g} [col-id="lastDeltaAt"] [dir="ltr"]`), GRID)
    check('8 RTL: a time cell is isolated LTR', isolated)
  }

  // 4: mark
  const before = storeReads().length
  await page.locator('[data-store-mark="0450"]').click()
  const dlg = dialog(page)
  await dlg.locator('[data-mark-dialog="mark"]').waitFor({ state: 'attached', timeout: 5000 })
  const note = await dlg.locator('[data-reason-note]').innerText()
  check(`4 ${tag}: the mark note names the store and says a full comes first`, ar ? /0450/.test(note) && /كامل/.test(note) : /0450 · Khobar Mall/.test(note) && /first push is a full/.test(note), note)
  check(`4 ${tag}: Confirm waits for a reason`, await dlg.locator('[data-reason-confirm]').isDisabled())
  await dlg.locator('[data-reason-input]').fill('trigger 00001')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.locator('[data-inline-refusal="HYS-00001"]').waitFor({ timeout: 5000 })
  check(`4 ${tag}: HYS-00001 shows inline at the reason, the dialog open`, (await dlg.count()) === 1)
  await dlg.locator('[data-reason-input]').fill('  عاد للموقع — back on the website  ')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })
  const w = writes.at(-1)
  check(`4 ${tag}: it POSTs Stores/0450/Mark with exactly { reason }, trimmed, unicode kept`, w.path === 'HybrisStockWeb/Stores/0450/Mark' && JSON.stringify(w.body) === JSON.stringify({ reason: 'عاد للموقع — back on the website' }), JSON.stringify(w))
  await page.waitForTimeout(300)
  check(`4 ${tag}: the row flips in place to Marked, awaiting its first full`, (await cell(page, '0450', 'marked')) === (ar ? 'معلَّم' : 'Marked') && (await cell(page, '0450', 'health')) === (ar ? 'بانتظار أول إرسال كامل' : 'Awaiting first full'))
  check(`4 ${tag}: with no list re-read`, storeReads().length === before, `${before} → ${storeReads().length}`)

  // HYS-00003: changed meanwhile
  await page.locator('[data-store-mark="0451"]').click()
  await dlg.locator('[data-reason-input]').fill('trigger 00003')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.locator('[data-reason-error="HYS-00003"]').waitFor({ timeout: 5000 })
  await page.waitForTimeout(300)
  check(`4 ${tag}: HYS-00003 shows with its code, re-reads the list and turns Confirm off`, storeReads().length === before + 1 && (await dlg.locator('[data-reason-confirm]').isDisabled()))
  await dlg.locator('[data-reason-cancel]').click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })

  // 5: unmark
  await page.locator('[data-store-mark="1234"][data-to="unmark"]').click()
  await dlg.locator('[data-mark-dialog="unmark"]').waitFor({ state: 'attached', timeout: 5000 })
  const unote = await dlg.locator('[data-reason-note]').innerText()
  check(`5 ${tag}: the unmark note says nothing is sent and Hybris keeps its last stock`, ar ? /لا يُرسل شيء/.test(unote) : /Nothing is sent to Hybris/.test(unote) && /keeps the stock it was last sent/.test(unote), unote)
  await dlg.locator('[data-reason-input]').fill('Store closed for refit')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(300)
  check(`5 ${tag}: it POSTs Unmark and the row reads Not marked, its health blank`, writes.at(-1).path === 'HybrisStockWeb/Stores/1234/Unmark' && (await cell(page, '1234', 'marked')) === (ar ? 'غير معلَّم' : 'Not marked') && (await cell(page, '1234', 'lastDeltaAt')) === '')

  // 6: history
  await page.locator('[data-store-history="1234"]').click()
  const drawer = page.locator('[data-history-drawer="1234"]')
  await drawer.locator('[data-history-table]').waitFor({ timeout: 5000 })
  const actions = await drawer.locator('[data-history-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-history-row')))
  check(`6 ${tag}: the drawer lists every change newest first, the unmark just made on top`, JSON.stringify(actions) === JSON.stringify(['unmark', 'mark', 'unmark', 'mark']), actions.join())
  const first = await drawer.locator('[data-history-row]').first().innerText()
  check(`6 ${tag}: who, when, why and door show`, /MSARTAWI/.test(first) && /2026-11-07 10:45/.test(first) && /Store closed for refit/.test(first) && /oms-react/.test(first), first)
  check(`6 ${tag}: the URL carries ?history=1234`, urlSearch(page) === 'history=1234')
  await page.keyboard.press('Escape')
  await drawer.waitFor({ state: 'detached', timeout: 5000 })
  check(`6 ${tag}: Escape closes it and takes it off the URL`, urlSearch(page) === '')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}
if (run('stores')) {
  await stores('ltr')
  await stores('rtl')
}

if (run('stores')) {
  const { context, page, errors } = await open('ltr')
  await page.goto(`${BASE}/hybris-stock/stores?history=1234`)
  await page.locator('[data-history-drawer="1234"] [data-history-table]').waitFor({ timeout: 15000 })
  check('6: ?history=<code> opens the drawer from a link, titled code · name', /1234 · Riyadh Olaya/.test(await page.locator('[data-history-drawer="1234"] h2').innerText()))
  check('6 (link): no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: view only ──────────────────────────────────────────────────────────────────────────────
if (run('viewonly')) {
  const { context, page, errors } = await open('ltr', { access: { canView: true, canManage: false } })
  await page.goto(`${BASE}/hybris-stock/stores`)
  await waitRows(page, 6)
  check('7: view-only shows no Mark / Unmark', (await page.locator('[data-store-mark]').count()) === 0)
  check('7: view-only shows no push now', (await page.locator('[data-store-push], [data-push-materials]').count()) === 0)
  check('7: the status bar says view only', /View only/.test(await page.locator('[data-view-only]').innerText()))
  await page.locator('[data-store-history="1234"]').click()
  await page.locator('[data-history-drawer="1234"] [data-history-table]').waitFor({ timeout: 5000 })
  check('7: History still opens', true)
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
