// Insurance rules ▸ IDF masters ▸ General ▸ Change log drive (BackOffice spec 3185 / door 3194; oms ticket 650).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope. Fixtures and handlers are `tools/idf-stubs.mjs`
// (`// --- 650 ---`, `idfStub`):
//   GET IdfPriority/general/changes?item&idf&user&from&to&page  → `IDF_GENERAL_CHANGES`, 30 rows, newest first, 25 a page
//   GET IdfPriority/general/changes/export?item&idf&user&from&to → `.xlsx` `IDF_CHANGES_EXPORT_NAME`
//
// It verifies, in LTR and RTL:
//   1. the Change log tab opens at `?tab=changes`, reads page 1 of the whole log (no window), counts it, newest first;
//   2. a row: when / who / key / upload ltr, entity and action in words, the reason in a bdi; before → after as one
//      whole value per side — a set (no before), a clear (no after), a re-rank, and a group edit (free text, bdi);
//   3. Next reads page 2 into the address;
//   4. an item typed (Enter) and a window of local days filter, both kept in the address, sent by the door's names,
//      back to page 1; both ends of the window are counted (a change on the from day is in);
//   5. a to before from is refused on the screen — no read, Export disabled;
//   6. Export downloads the filtered rows (the filter without the page) under the server's name; a refused export
//      toasts the server's message;
//   7. back to Items drops the log's keys; a deep link `?tab=changes&user=aali` reads that user; a bare 403 says no
//      access; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 52650 --strictPort
//   2. node tools/idf-changes-drive.mjs        (DRIVE_PORT overrides 52650)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState, IDF_CHANGES_EXPORT_NAME } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 52650}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const state = newIdfState()
  const reads = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    const hit = idfStub(req.method(), p + url.search, null, { state, reads, ...opts })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|general\.|changes\.|items\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
const bdi = (loc) => loc.locator('bdi:not([dir])').evaluateAll((els) => els.map((e) => e.textContent))
const ids = (page) => page.locator('[data-idf-changes] tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-change')))
const search = (page) => new URL(page.url()).search
const lastRead = (reads, key = 'changes') => Object.fromEntries(new URLSearchParams(reads[key]?.at(-1) ?? ''))
const totalIs = (page, n) =>
  page.waitForFunction((want) => (document.querySelector('[data-idf-changes-total]')?.textContent ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim() === want, `Changes: ${n}`, { timeout: 30000 })
// The read a filter sends (the total alone cannot say it landed: the previous page stays on show while it loads).
const readSent = async (reads, want, key = 'changes') => {
  for (let i = 0; i < 300 && JSON.stringify(lastRead(reads, key)) !== want; i++) await new Promise((r) => setTimeout(r, 100))
}
const filter = (page, field) => page.locator(`[data-idf-changes-filter] [data-filter="${field}"]`)

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/general`)
    await page.locator('[data-idf-general-tabs] [data-tab="changes"]').waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the tab reads Change log`, strip(await page.locator('[data-idf-general-tabs] [data-tab="changes"]').innerText()) === 'Change log')
    await page.locator('[data-idf-general-tabs] [data-tab="changes"]').click()
    await page.locator('[data-idf-changes] tbody tr').first().waitFor({ timeout: 60000 })
    check(`${dir} 1. the address is ?tab=changes`, search(page) === '?tab=changes', search(page))
    check(`${dir} 1. the tab is on`, (await page.locator('[data-idf-general-tabs] [data-tab="changes"]').getAttribute('aria-selected')) === 'true')
    check(`${dir} 1. the first read is page 1 of the whole log, no window`, JSON.stringify(lastRead(reads)) === '{"page":"1"}', JSON.stringify(lastRead(reads)))
    await totalIs(page, 30)
    check(`${dir} 1. the total counts the log, its figure ltr`, JSON.stringify(await ltr(page.locator('[data-idf-changes-total]'))) === '["30"]')
    const first = await ids(page)
    check(`${dir} 1. 25 a page, newest first`, first.length === 25 && first[0] === 'C-30' && first[1] === 'C-29', first.slice(0, 3).join(','))

    // 2. rows
    const row = (id) => page.locator(`[data-idf-changes] tbody tr[data-change="${id}"]`)
    const cell = (id, col) => row(id).locator(`[data-col="${col}"]`)
    const set = 'C-30'
    check(
      `${dir} 2. when, who, key ltr; entity and action in words; reason in a bdi`,
      strip(await cell(set, 'at').innerText()).length > 0 &&
        (await ltr(cell(set, 'at'))).length === 1 &&
        JSON.stringify(await ltr(cell(set, 'by'))) === '["msartawi"]' &&
        JSON.stringify(await ltr(cell(set, 'key'))) === '["300110"]' &&
        strip(await cell(set, 'entity').innerText()) === 'Item' &&
        strip(await cell(set, 'action').innerText()) === 'Set' &&
        JSON.stringify(await bdi(cell(set, 'reason'))) === '["رفع الأولوية حسب المورد"]',
    )
    check(
      `${dir} 2. a first set: no before, the after one whole ltr value`,
      strip(await cell(set, 'before').innerText()) === 'None' && (await cell(set, 'before').locator('[data-none]').count()) === 1 && JSON.stringify(await ltr(cell(set, 'after'))) === '["IDF-PARA-500 · 1"]',
      strip(await cell(set, 'after').innerText()),
    )
    check(
      `${dir} 2. a re-rank from an upload: both sides, the upload id ltr`,
      JSON.stringify(await ltr(cell('C-29', 'before'))) === '["IDF-IBU · 3"]' && JSON.stringify(await ltr(cell('C-29', 'after'))) === '["IDF-IBU · 2"]' && JSON.stringify(await ltr(cell('C-29', 'upload'))) === '["GU-3"]',
    )
    check(
      `${dir} 2. a clear: the before, no after`,
      strip(await cell('C-27', 'action').innerText()) === 'Cleared' && JSON.stringify(await ltr(cell('C-27', 'before'))) === '["IDF-PPI · 2"]' && strip(await cell('C-27', 'after').innerText()) === 'None',
    )
    check(
      `${dir} 2. a group edit: its fields as free text, one bdi a side`,
      strip(await cell('C-26', 'entity').innerText()) === 'IDF group' &&
        strip(await cell('C-26', 'action').innerText()) === 'Edited' &&
        JSON.stringify(await bdi(cell('C-26', 'before'))) === '["Ibuprofen 400 mg"]' &&
        JSON.stringify(await bdi(cell('C-26', 'after'))) === '["Ibuprofen 400 mg · Tablet"]' &&
        (await ltr(cell('C-26', 'after'))).length === 0,
    )

    // 3. paging
    await page.locator('[data-idf-general-changes] nav[aria-label] button').last().click()
    await page.locator('[data-idf-changes] tbody tr:first-child[data-change="C-5"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. Next reads page 2 and keeps it in the address`, lastRead(reads).page === '2' && search(page) === '?tab=changes&page=2' && (await ids(page)).length === 5, search(page))

    // 4. item + window
    await filter(page, 'item').fill('300110')
    await filter(page, 'item').press('Enter')
    await page.waitForURL((u) => u.search === '?tab=changes&item=300110', { timeout: 30000 })
    await totalIs(page, 2)
    check(`${dir} 4. an item goes back to page 1, sent as item`, JSON.stringify(lastRead(reads)) === '{"item":"300110","page":"1"}', JSON.stringify(lastRead(reads)))
    await filter(page, 'from').fill('2026-10-21')
    await filter(page, 'to').fill('2026-10-27')
    await page.waitForURL((u) => u.search === '?tab=changes&item=300110&from=2026-10-21&to=2026-10-27', { timeout: 30000 })
    await readSent(reads, '{"item":"300110","from":"2026-10-21","to":"2026-10-27","page":"1"}')
    await totalIs(page, 2)
    check(
      `${dir} 4. both window ends are counted (a change on the from day is in), sent as from / to`,
      JSON.stringify(lastRead(reads)) === '{"item":"300110","from":"2026-10-21","to":"2026-10-27","page":"1"}' && JSON.stringify(await ids(page)) === '["C-30","C-18"]',
      JSON.stringify(lastRead(reads)),
    )
    await filter(page, 'from').fill('2026-10-22')
    await totalIs(page, 1)
    check(`${dir} 4. a later from leaves that day out`, JSON.stringify(await ids(page)) === '["C-30"]')

    // 5. to before from
    const before = reads.changes.length
    await filter(page, 'to').fill('2026-10-20')
    await page.locator('[data-window-problem="reversed"]').waitFor({ timeout: 30000 })
    await page.waitForTimeout(300)
    check(`${dir} 5. to before from is refused on the screen`, strip(await page.locator('[data-window-problem]').innerText()) === 'The to date is before the from date.')
    check(`${dir} 5. no read is sent, the table is gone`, reads.changes.length === before && (await page.locator('[data-idf-changes]').count()) === 0, `${reads.changes.length} vs ${before}`)
    check(`${dir} 5. Export is disabled`, await page.locator('[data-idf-changes-export]').isDisabled())
    await filter(page, 'to').fill('2026-10-27')
    await totalIs(page, 1)

    // 6. export
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('[data-idf-changes-export]').click()])
    check(`${dir} 6. Export saves the server's file`, dl.suggestedFilename() === IDF_CHANGES_EXPORT_NAME && (await dl.path()) !== null, dl.suggestedFilename())
    check(
      `${dir} 6. the export sends the filter, not the page`,
      JSON.stringify(lastRead(reads, 'changesExport')) === '{"item":"300110","from":"2026-10-22","to":"2026-10-27"}',
      JSON.stringify(lastRead(reads, 'changesExport')),
    )

    // 7. back to Items
    await page.locator('[data-idf-general-tabs] [data-tab="items"]').click()
    await page.locator('[data-idf-general-items]').waitFor({ timeout: 30000 })
    check(`${dir} 7. Items drops the log's keys`, search(page) === '', search(page))
    check(`${dir} 7. no raw keys`, await noRawKeys(page))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, reads } = await open(dir, { refuseChangesExport: true })
    await page.goto(`${BASE}/insurance-rules/idf/general?tab=changes&user=aali`)
    await page.locator('[data-idf-changes] tbody tr').first().waitFor({ timeout: 60000 })
    await totalIs(page, 10)
    check(`${dir} 7. a deep link reads that user`, JSON.stringify(lastRead(reads)) === '{"user":"aali","page":"1"}' && (await filter(page, 'user').inputValue()) === 'aali', JSON.stringify(lastRead(reads)))
    check(`${dir} 7. no raw keys (log)`, await noRawKeys(page))
    await page.locator('[data-idf-changes-export]').click()
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'The change log could not be exported' })
    await toast.first().waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 6. a refused export toasts the server's message`, (await toast.count()) >= 1 && /not available right now/.test(strip(await toast.first().innerText())), (await toast.count()) ? strip(await toast.first().innerText()) : 'no toast')
    check(`${dir} 7. no page errors (deep link)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['changes'] })
    await page.goto(`${BASE}/insurance-rules/idf/general?tab=changes`)
    await page.locator('[data-idf-changes-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 7. a bare 403 on the log says no access; the header stays`, (await page.locator('[data-idf-changes-denied]').count()) === 1 && (await page.locator('[data-idf-general]').count()) === 1)
    check(`${dir} 7. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
