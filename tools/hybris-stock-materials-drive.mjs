// Hybris stock materials drive (ticket 848, BackOffice spec 3447).
//
// Drives the REAL app against STUBS of the guessed Hybris stock doors (`tools/hybris-stock-stubs.mjs`;
// BackOffice 3454 is not built, 2026-11-07), LTR and RTL. It asserts:
//   1. the list: a page of 50 of 120, search and the enabled filter reach the door and the URL, page 2
//      asks skip=50; the page says an upload never deletes; the mode banner shows;
//   2. upload: a CSV goes as multipart part `file`; the preview groups new / changed / unchanged /
//      refused with their counts, each refused row with its reason in words (unknown material,
//      malformed, bad enabled value, repeated), a changed row says "Will be disabled"; Confirm waits
//      for a reason; commit POSTs Upload/{id}/Commit with exactly { reason }; the list is read again and
//      shows the change (a new material listed, a disabled one disabled) and nothing was removed;
//   3. an upload of only unchanged / refused rows says nothing changes and Commit stays off;
//      HYS-00007 (unreadable file) shows inline; HYS-00006 (preview gone) says choose the file again;
//   4. add: Confirm waits for a material number and a reason; POSTs exactly { materialNumber, reason };
//      HYS-00004 / HYS-00005 inline at the number;
//   5. disable / enable: PUT …/Enabled with exactly { enabled, reason }; the row flips in place;
//   6. download saves the list as a file;
//   7. view-only: no add / upload / toggle, download stays;
//   8. RTL: right-to-left, the preview's machine values isolated, an upload commits.
//
//   1. run the app:  npx vite --port 5247 --strictPort
//   2. DRIVE_PORT=5247 node tools/hybris-stock-materials-drive.mjs
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
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
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

const GRID = '[data-materials-grid]'
const waitRows = async (page, n) => {
  // The grid virtualises rows: a page of 50 renders only what fits, so a big page waits for 15.
  await page.waitForFunction(
    ([g, want, exact]) => {
      const size = new Set([...document.querySelectorAll(`${g} .ag-row[row-index]`)].map((r) => r.getAttribute('row-index'))).size
      return (exact ? size === want : size >= want) && !document.querySelector(`${g} .ag-overlay-loading-center`)
    },
    [GRID, Math.min(n, 15), n <= 15],
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}
/** Text as read, the invisible isolates (LRI…PDI, FSI) taken out. */
const plain = (s) => s.replace(/[⁦-⁩]/g, '')
const cell = (page, n, col) =>
  page.evaluate(
    ([g, n, col]) => {
      const el = [...document.querySelectorAll(`${g} .ag-row[row-index] [col-id="materialNumber"]`)].find((e) => e.textContent.trim() === n)
      if (!el) return null
      const i = el.closest('.ag-row').getAttribute('row-index')
      return document.querySelector(`${g} .ag-row[row-index="${i}"] [col-id="${col}"]`)?.textContent.trim() ?? null
    },
    [GRID, n, col],
  )
const dialog = (page) => page.locator('dialog[open]')
const urlSearch = (page) => new URL(page.url()).search.slice(1)

const FILE = [
  'MaterialNumber,Enabled',
  '200001', // new (known to the master, not listed)
  '200002,0', // new, disabled
  '100000,0', // changed: enabled → disabled
  '100001,1', // changed: disabled → enabled
  '100003', // unchanged (no enabled column)
  '100004,1', // unchanged
  '999999', // refused: unknown material
  'ABC-12', // refused: malformed
  '100005,maybe', // refused: bad enabled
  '100004,0', // refused: repeated
].join('\n')
const upload = async (page, name, text) =>
  page.locator('[data-upload-file]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(text, 'utf8') })

async function materials(dir) {
  const tag = dir.toUpperCase()
  const { context, page, errors, reads, writes } = await open(dir)
  const listReads = () => reads.filter((r) => r.path === 'HybrisStockWeb/Materials')
  await page.goto(`${BASE}/hybris-stock/materials`)
  await waitRows(page, 50)

  // 1: the list
  check(`1 ${tag}: the first page asks skip=0&take=50`, listReads()[0].search === 'skip=0&take=50', listReads()[0].search)
  check(`1 ${tag}: the page says an upload never deletes`, /never removes one/.test(await page.locator('[data-materials-never-deletes]').innerText()))
  check(`1 ${tag}: the mode banner shows`, (await page.locator('[data-mode-banner="shadow"]').count()) === 1)
  check(`1 ${tag}: the count reads the total`, /120 materials/.test(await page.locator('[data-status-count]').innerText()))
  if (dir === 'ltr') {
    await page.locator('[data-materials-pager] button').last().click()
    await page.waitForFunction(() => /page=2/.test(location.search))
    await page.waitForTimeout(600)
    await waitRows(page, 50)
    check('1: page 2 asks skip=50 and lands in the URL', listReads().at(-1).search === 'skip=50&take=50' && urlSearch(page) === 'page=2')
    await page.locator('[data-filter-enabled]').selectOption('disabled')
    await waitRows(page, 1)
    check('1: the enabled filter reaches the door and starts on page 1', listReads().at(-1).search === 'enabled=disabled&skip=0&take=50' && urlSearch(page) === 'enabled=disabled')
    check('1: a disabled material reads Disabled, its Arabic name kept', (await cell(page, '100001', 'enabled')) === 'Disabled' && (await cell(page, '100001', 'materialName')) === 'بنادول أقراص 500 ملغ')
    await page.locator('[data-materials-clear]').click()
    await page.waitForFunction(() => location.search === '')
    await waitRows(page, 50)
    await page.locator('[data-filter-q]').fill('panadol')
    await page.locator('[data-materials-search]').click()
    await page.waitForFunction(() => /q=panadol/.test(location.search))
    await waitRows(page, 1)
    check('1: search reaches the door and the URL', listReads().at(-1).search === 'q=panadol&skip=0&take=50' && urlSearch(page) === 'q=panadol')
    await page.locator('[data-materials-clear]').click()
    await waitRows(page, 50)
  } else {
    check('8 RTL: the document is right-to-left', await page.evaluate(() => document.documentElement.dir === 'rtl'))
  }

  // 2: upload with a preview, then commit
  await page.locator('[data-materials-upload]').click()
  const dlg = dialog(page)
  await dlg.locator('[data-upload-dialog]').waitFor({ timeout: 5000 })
  check(`2 ${tag}: the dialog says nothing changes until commit, and an upload never removes`, /never removes a material missing from the file/.test(await dlg.locator('[data-reason-note]').innerText()))
  check(`2 ${tag}: Commit is off before a file`, await dlg.locator('[data-reason-confirm]').isDisabled())
  await upload(page, 'list.csv', FILE)
  await dlg.locator('[data-upload-preview]').waitFor({ timeout: 10000 })
  const w = writes.find((x) => x.path === 'HybrisStockWeb/Materials/Upload/Preview')
  check(`2 ${tag}: the file goes as multipart part "file", named`, w?.hasFilePart && w.fileName === 'list.csv', JSON.stringify(w))
  const counts = await dlg.locator('[data-upload-group]').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute('data-upload-group'), e.getAttribute('data-count')])))
  check(`2 ${tag}: the preview counts 2 new, 2 changed, 2 unchanged, 4 refused`, JSON.stringify(counts) === JSON.stringify({ new: '2', changed: '2', unchanged: '2', refused: '4' }), JSON.stringify(counts))
  const tally = plain(await dlg.locator('[data-upload-refusals]').innerText())
  check(`2 ${tag}: the refused rows are tallied by reason`, /1 not a known material/.test(tally) && /1 not a material number/.test(tally) && /1 with an enabled value/.test(tally) && /1 repeated/.test(tally), tally)
  await dlg.locator('[data-upload-group="refused"]').click()
  const refused = await dlg.locator('[data-upload-rows="refused"] [data-upload-row]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  check(
    `2 ${tag}: each refused row shows its line, value and reason`,
    refused.length === 4 && /^8 999999 .*Not a known material$/.test(refused[0]) && /^9 ABC-12 .*Not a material number$/.test(refused[1]) && /^10 100005 .*not 1 \/ 0/.test(refused[2]) && /^11 100004 .*Already earlier/.test(refused[3]),
    refused.join(' | '),
  )
  await dlg.locator('[data-upload-group="changed"]').click()
  const changed = await dlg.locator('[data-upload-rows="changed"] [data-upload-row]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  check(`2 ${tag}: a changed row says what changes`, /Will be disabled$/.test(changed[0]) && /Will be enabled$/.test(changed[1]), changed.join(' | '))
  if (dir === 'rtl') {
    check('8 RTL: the preview isolates its material numbers', await dlg.locator('[data-upload-rows="changed"] [data-upload-row] bdi[dir="ltr"], [data-upload-rows="changed"] [data-upload-row] [dir="ltr"]').count() >= 2)
  }
  check(`2 ${tag}: Commit names the count and waits for a reason`, /Commit 4 changes/.test(plain(await dlg.locator('[data-reason-confirm]').innerText())) && (await dlg.locator('[data-reason-confirm]').isDisabled()))
  await dlg.locator('[data-reason-input]').fill('  November list from Hybris team  ')
  const before = listReads().length
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.waitFor({ state: 'detached', timeout: 10000 })
  const c = writes.at(-1)
  check(`2 ${tag}: commit POSTs Upload/U-1/Commit with exactly { reason }, trimmed`, c.path === 'HybrisStockWeb/Materials/Upload/U-1/Commit' && JSON.stringify(c.body) === JSON.stringify({ reason: 'November list from Hybris team' }), JSON.stringify(c))
  await page.waitForFunction((n) => true, before)
  await waitRows(page, 50)
  check(`2 ${tag}: the list is read again`, listReads().length > before)
  check(`2 ${tag}: the new material is listed and the changed one disabled`, (await cell(page, '200001', 'enabled')) !== null && (await cell(page, '100000', 'enabled')) === 'Disabled')
  check(`2 ${tag}: nothing was removed: 122 materials`, /122 materials/.test(await page.locator('[data-status-count]').innerText()))

  // 3: nothing to apply; unreadable; gone
  await page.locator('[data-materials-upload]').click()
  await dlg.locator('[data-upload-dialog]').waitFor({ timeout: 5000 })
  await upload(page, 'same.csv', '100004,1\n999999')
  await dlg.locator('[data-upload-nothing]').waitFor({ timeout: 10000 })
  await dlg.locator('[data-reason-input]').fill('no-op')
  check(`3 ${tag}: only unchanged / refused rows: nothing changes, Commit off`, await dlg.locator('[data-reason-confirm]').isDisabled())
  await upload(page, 'no-column.csv', 'Name\nfoo')
  await dlg.locator('[data-inline-refusal="HYS-00007"]').waitFor({ timeout: 10000 })
  check(`3 ${tag}: HYS-00007 shows inline with the server's sentence`, /no material column/.test(await dlg.locator('[data-inline-refusal="HYS-00007"]').innerText()))
  await upload(page, 'again.csv', '200003')
  await dlg.locator('[data-upload-group="new"][data-count="1"]').waitFor({ timeout: 10000 })
  await dlg.locator('[data-reason-input]').fill('trigger 00006')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.locator('[data-upload-gone]').waitFor({ timeout: 5000 })
  check(`3 ${tag}: HYS-00006 says the preview is gone, choose the file again; Commit off`, await dlg.locator('[data-reason-confirm]').isDisabled())
  await dlg.locator('[data-reason-cancel]').click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })

  // 4: add
  await page.locator('[data-materials-add]').click()
  await dlg.locator('[data-add-dialog]').waitFor({ timeout: 5000 })
  await dlg.locator('[data-reason-input]').fill('one-off')
  check(`4 ${tag}: Confirm waits for a material number`, await dlg.locator('[data-reason-confirm]').isDisabled())
  await dlg.locator('[data-add-number]').fill('12AB')
  check(`4 ${tag}: …a number of digits`, await dlg.locator('[data-reason-confirm]').isDisabled())
  await dlg.locator('[data-add-number]').fill('999999')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.locator('[data-inline-refusal="HYS-00004"]').waitFor({ timeout: 5000 })
  check(`4 ${tag}: HYS-00004 inline at the number, no banner`, (await dlg.locator('[data-reason-error]').count()) === 0)
  await dlg.locator('[data-add-number]').fill('100002')
  await dlg.locator('[data-reason-input]').fill('one-off ')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.locator('[data-inline-refusal="HYS-00005"]').waitFor({ timeout: 5000 })
  check(`4 ${tag}: HYS-00005 inline at the number`, true)
  await dlg.locator('[data-add-number]').fill(' 200003 ')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })
  check(`4 ${tag}: add POSTs exactly { materialNumber, reason }, trimmed`, JSON.stringify(writes.at(-1).body) === JSON.stringify({ materialNumber: '200003', reason: 'one-off' }), JSON.stringify(writes.at(-1)))

  // 5: disable / enable
  await waitRows(page, 50)
  const reads5 = listReads().length
  await page.locator('[data-material-toggle="100003"][data-to="disable"]').click()
  await dlg.locator('[data-enabled-dialog="disable"]').waitFor({ state: 'attached', timeout: 5000 })
  check(`5 ${tag}: the disable note says Hybris keeps what it was last sent`, /keeps the stock it was last sent/.test(await dlg.locator('[data-reason-note]').innerText()))
  await dlg.locator('[data-reason-input]').fill('Discontinued')
  await dlg.locator('[data-reason-confirm]').click()
  await dlg.waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForTimeout(300)
  check(`5 ${tag}: it PUTs …/100003/Enabled with exactly { enabled: false, reason }`, writes.at(-1).path === 'HybrisStockWeb/Materials/100003/Enabled' && JSON.stringify(writes.at(-1).body) === JSON.stringify({ enabled: false, reason: 'Discontinued' }))
  check(`5 ${tag}: the row flips in place, no re-read`, (await cell(page, '100003', 'enabled')) === 'Disabled' && listReads().length === reads5)

  // 6: download
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.locator('[data-materials-download]').click()])
  check(`6 ${tag}: download saves the list under the server's name`, download.suggestedFilename() === 'hybris-stock-materials.csv', download.suggestedFilename())
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await materials('ltr')
await materials('rtl')

{
  const { context, page, errors } = await open('ltr', { access: { canView: true, canManage: false } })
  await page.goto(`${BASE}/hybris-stock/materials`)
  await waitRows(page, 50)
  check('7: view-only: no add, upload or toggle', (await page.locator('[data-materials-add], [data-materials-upload], [data-material-toggle]').count()) === 0)
  check('7: view-only: download stays, the bar says view only', (await page.locator('[data-materials-download]').count()) === 1 && (await page.locator('[data-view-only]').count()) === 1)
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
