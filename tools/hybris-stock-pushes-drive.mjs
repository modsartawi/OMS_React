// Hybris stock push log drive (ticket 849, BackOffice spec 3447).
//
// Drives the REAL app against STUBS of the guessed Hybris stock doors (`tools/hybris-stock-stubs.mjs`;
// BackOffice 3455 is not built, 2026-11-07), LTR and RTL. It asserts:
//   1. the log lists every push across stores, newest first, with type, started / finished, rows,
//      target, files and error; a sent push reads "Delivered to hot folder" (never "live"), a shadow
//      push "Shadow path (not imported)", a live one "Hybris hot folder"; a failed push RED; a push now
//      shows who asked and why;
//   2. store, type, status and date filters reach the door and the URL;
//   3. Lines opens a push's lines (skip 0, take 200): "Showing 1–200 of 812", page 2 asks skip=200;
//      filter by store and material; a filter matching nothing says so; the files show;
//   4. a push older than 15 days (or marked swept) says its lines were swept and asks no lines;
//   5. a line's History opens the material's history at that store — every quantity, its push type,
//      status and target; a push id there opens that push's lines;
//   6. `?history=<store>` (the stores page's link) asks for a material first; `?push=<id>` opens lines;
//      an unknown push says so (HYS-00008); Escape closes and clears the URL;
//   7. the stores page's Pushes and Material history land here with the store set;
//   8. under RTL: right-to-left, machine values isolated, the drawers work.
//
//   1. run the app:  npx vite --port 5247 --strictPort
//   2. DRIVE_PORT=5247 node tools/hybris-stock-pushes-drive.mjs
import { createRequire } from 'node:module'
import { installStubs } from './hybris-stock-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
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

const GRID = '[data-pushes-grid]'
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
const cell = (page, id, col) =>
  page.evaluate(
    ([g, id, col]) => {
      const el = [...document.querySelectorAll(`${g} .ag-row[row-index] [col-id="pushId"]`)].find((e) => e.textContent.trim() === id)
      if (!el) return null
      const i = el.closest('.ag-row').getAttribute('row-index')
      return document.querySelector(`${g} .ag-row[row-index="${i}"] [col-id="${col}"]`)?.textContent.trim() ?? null
    },
    [GRID, id, col],
  )
const rowClass = (page, id) =>
  page.evaluate(
    ([g, id]) => {
      const el = [...document.querySelectorAll(`${g} .ag-row[row-index] [col-id="pushId"]`)].find((e) => e.textContent.trim() === id)
      const i = el?.closest('.ag-row').getAttribute('row-index')
      return [...document.querySelectorAll(`${g} .ag-row[row-index="${i}"]`)].map((r) => r.className).join(' ')
    },
    [GRID, id],
  )
const urlSearch = (page) => decodeURIComponent(new URL(page.url()).search.slice(1))
const plain = (s) => s.replace(/[\u2066-\u2069]/g, '')

async function log(dir) {
  const tag = dir.toUpperCase()
  const { context, page, errors, reads } = await open(dir)
  const pushReads = () => reads.filter((r) => r.path === 'HybrisStockWeb/Pushes')
  const lineReads = () => reads.filter((r) => /\/Lines$/.test(r.path))
  await page.goto(`${BASE}/hybris-stock/pushes`)
  await waitRows(page, 7)

  // 1
  check(`1 ${tag}: the log asks skip=0&take=50 and lists every push`, pushReads()[0].search === 'skip=0&take=50')
  check(`1 ${tag}: a sent delta reads Delivered to hot folder, shadow path`, (await cell(page, 'P-0105', 'type')) === 'Delta' && (await cell(page, 'P-0105', 'status')) === 'Delivered to hot folder' && (await cell(page, 'P-0105', 'target')) === 'Shadow path (not imported)')
  check(`1 ${tag}: started, finished, rows and files show`, (await cell(page, 'P-0105', 'startedAt')) === '2026-11-07 10:30' && (await cell(page, 'P-0105', 'finishedAt')) === '2026-11-07 10:30' && (await cell(page, 'P-0105', 'rows')) === '812' && /aldawaastocklevel-20261107103000-1\.csv/.test(await cell(page, 'P-0105', 'files')))
  check(`1 ${tag}: a failed push is RED with its error`, (await cell(page, 'P-0103', 'status')) === 'Failed' && /danger-050/.test(await rowClass(page, 'P-0103')) && (await cell(page, 'P-0103', 'error')) === 'Blob upload failed: 503 Server Busy')
  check(`1 ${tag}: a push now shows who asked and why`, (await cell(page, 'P-0104', 'type')) === 'Push now — store' && (await cell(page, 'P-0104', 'requestedBy')) === 'HYBRIS1' && (await cell(page, 'P-0104', 'reason')) === 'Website showed stale stock')
  check(`1 ${tag}: a full split in three files lists them all`, (await cell(page, 'P-0101', 'files')).split(',').length === 3)
  check(`1 ${tag}: a running push reads Running`, (await cell(page, 'P-0100', 'status')) === 'Running')
  const text = await page.locator(GRID).innerText()
  check(`1 ${tag}: no cell says live on the website`, !/live on the website/i.test(text))
  check(`1 ${tag}: the page says what delivered to hot folder means`, /does not read whether it did/.test(await page.locator('[data-pushes-note]').innerText()))
  if (dir === 'rtl') check('8 RTL: right-to-left', await page.evaluate(() => document.documentElement.dir === 'rtl'))

  // 2
  if (dir === 'ltr') {
    await page.locator('[data-filter-type]').selectOption('F')
    await waitRows(page, 2)
    check('2: the type filter reaches the door and the URL', pushReads().at(-1).search === 'type=F&skip=0&take=50' && urlSearch(page) === 'type=F')
    await page.locator('[data-filter-status]').selectOption('S')
    await page.waitForTimeout(500)
    check('2: the status filter too', pushReads().at(-1).search === 'type=F&status=S&skip=0&take=50')
    await page.locator('[data-filter-store]').fill('0099')
    await page.locator('[data-pushes-search]').click()
    await waitRows(page, 1)
    check('2: the store filter on search', pushReads().at(-1).search === 'store=0099&type=F&status=S&skip=0&take=50' && urlSearch(page) === 'store=0099&type=F&status=S')
    await page.locator('[data-pushes-clear]').click()
    await waitRows(page, 7)
    await page.locator('[data-filter-from]').fill('2026-11-01')
    await page.waitForTimeout(500)
    await page.locator('[data-filter-to]').fill('2026-11-07')
    await waitRows(page, 6)
    check('2: the date range reaches the door as from / to', pushReads().at(-1).search === 'from=2026-11-01&to=2026-11-07&skip=0&take=50', pushReads().at(-1).search)
    await page.locator('[data-pushes-clear]').click()
    await waitRows(page, 7)
  }

  // 3: lines
  await page.locator('[data-push-lines="P-0105"]').click()
  const drawer = page.locator('[data-lines-drawer="P-0105"]')
  await drawer.locator('[data-lines-table]').waitFor({ timeout: 10000 })
  check(`3 ${tag}: Lines asks skip 0, take 200`, lineReads().at(-1).path === 'HybrisStockWeb/Pushes/P-0105/Lines' && lineReads().at(-1).search === 'skip=0&take=200', JSON.stringify(lineReads().at(-1)))
  check(`3 ${tag}: Showing 1–200 of 812`, /Showing 1–200 of 812/.test(plain(await drawer.locator('[data-lines-count]').innerText())))
  check(`3 ${tag}: the header shows type, status, target and files`, /Delta/.test(await drawer.locator('[data-lines-push]').innerText()) && /Delivered to hot folder/.test(await drawer.locator('[data-lines-push]').innerText()) && /aldawaastocklevel/.test(await drawer.locator('[data-lines-files]').innerText()))
  await drawer.locator('[data-lines-pager] button').last().click()
  await page.waitForFunction(() => /Showing 201/.test(document.querySelector('[data-lines-count]')?.textContent.replace(/[\u2066-\u2069]/g, '') ?? ''))
  check(`3 ${tag}: page 2 asks skip=200`, lineReads().at(-1).search === 'skip=200&take=200')
  await drawer.locator('[data-lines-store]').fill('2001')
  await drawer.locator('[data-lines-material]').fill('100002')
  await drawer.locator('[data-lines-search]').click()
  // The last page stands in until the filtered one lands: wait for the lines to be the filter's.
  await page.waitForFunction(() => {
    const lines = [...document.querySelectorAll('[data-line]')].map((e) => e.getAttribute('data-line'))
    return lines.length > 0 && lines.every((l) => l === '2001/100002')
  })
  check(`3 ${tag}: the store and material filter go to the door, back on page 1`, lineReads().at(-1).search === 'store=2001&material=100002&skip=0&take=200', lineReads().at(-1).search)
  const lines = await drawer.locator('[data-line]').evaluateAll((els) => els.map((e) => e.getAttribute('data-line')))
  check(`3 ${tag}: only matching lines show`, lines.length > 0 && lines.every((l) => l === '2001/100002'), lines.join())
  await drawer.locator('[data-lines-material]').fill('424242')
  await drawer.locator('[data-lines-search]').click()
  await drawer.locator('[data-lines-empty]').waitFor({ timeout: 5000 })
  check(`3 ${tag}: a filter matching nothing says so`, /No line matches/.test(await drawer.locator('[data-lines-empty]').innerText()))

  // 5: a line's history
  await drawer.locator('[data-lines-material]').fill('100002')
  await drawer.locator('[data-lines-store]').fill('1234')
  await drawer.locator('[data-lines-search]').click()
  await drawer.locator('[data-line-history="1234/100002"]').first().click()
  const hist = page.locator('[data-material-drawer="1234"]')
  await hist.locator('[data-material-table]').waitFor({ timeout: 10000 })
  check(`5 ${tag}: a line opens the material's history at its store`, reads.at(-1).path === 'HybrisStockWeb/Stores/1234/Materials/100002/History' && urlSearch(page) === 'history=1234&material=100002')
  const hl = await hist.locator('[data-material-line]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  check(`5 ${tag}: every quantity sent, newest first, with type, status and target`, hl.length === 3 && /2026-11-07 10:30 3 Delta Delivered to hot folder Shadow path/.test(plain(hl[0])) && /0 Push now — materials/.test(plain(hl[2])), hl.join(' | '))
  await hist.locator('[data-material-push="P-0104"]').click()
  await page.locator('[data-lines-drawer="P-0104"] [data-lines-table]').waitFor({ timeout: 10000 })
  check(`5 ${tag}: a push id in the history opens that push's lines`, urlSearch(page) === 'push=P-0104')
  await page.keyboard.press('Escape')
  await page.locator('[data-lines-drawer]').waitFor({ state: 'detached', timeout: 5000 })
  check(`6 ${tag}: Escape closes and clears the URL`, urlSearch(page) === '')

  // 4: swept
  await page.locator('[data-push-lines="P-0050"]').click()
  await page.locator('[data-lines-drawer="P-0050"] [data-lines-swept]').waitFor({ timeout: 5000 })
  check(`4 ${tag}: a swept push says its lines were swept after 15 days, and asks no lines`, /swept: lines are kept 15 days/.test(plain(await page.locator('[data-lines-swept]').innerText())) && !lineReads().some((r) => r.path.includes('P-0050')))
  await page.keyboard.press('Escape')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await log('ltr')
await log('rtl')

// 6: links
{
  const { context, page, errors, reads } = await open('ltr')
  await page.goto(`${BASE}/hybris-stock/pushes?history=2001`)
  const hist = page.locator('[data-material-drawer="2001"]')
  await hist.locator('[data-material-input]').waitFor({ timeout: 15000 })
  check('6: ?history=<store> asks for a material first, no history call', !reads.some((r) => /Materials\/.+\/History/.test(r.path)))
  await hist.locator('[data-material-input]').fill('100002')
  await hist.locator('[data-material-search]').click()
  await hist.locator('[data-material-empty]').waitFor({ timeout: 10000 })
  check('6: an empty history names the material and the store', /material 100002 at store 2001/.test(plain(await hist.locator('[data-material-empty]').innerText())))
  await page.goto(`${BASE}/hybris-stock/pushes?push=P-9999`)
  await page.locator('[data-lines-no-push]').waitFor({ timeout: 15000 })
  check('6: an unknown push (HYS-00008) says no such push', /No such push/.test(await page.locator('[data-lines-no-push]').innerText()))
  check('6: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// 7: from the stores page
{
  const { context, page, errors } = await open('ltr')
  await page.goto(`${BASE}/hybris-stock/stores`)
  await page.locator('[data-store-pushes="1234"]').waitFor({ timeout: 20000 })
  await page.locator('[data-store-pushes="1234"]').click()
  await page.waitForURL(/\/hybris-stock\/pushes\?store=1234$/, { timeout: 10000 })
  await waitRows(page, 5)
  check("7: a store's Pushes opens the log filtered to it", (await page.locator('[data-filter-store]').inputValue()) === '1234')
  await page.goto(`${BASE}/hybris-stock/stores`)
  await page.locator('[data-store-material="2001"]').click()
  await page.locator('[data-material-drawer="2001"] [data-material-input]').waitFor({ timeout: 10000 })
  check("7: a store's Material history opens the drawer on that store", /store=2001/.test(page.url()) && /history=2001/.test(page.url()))
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
