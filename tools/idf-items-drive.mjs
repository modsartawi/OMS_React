// Insurance rules ▸ IDF master ▸ Items drive (BackOffice spec 3185 / door 3187; oms ticket 643).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope. Fixtures and handlers are `tools/idf-stubs.mjs`
// (`// --- 619 ---`, `// --- 623 ---`, `// --- 643 ---`, `idfStub`):
//   GET IdfPriority/masters                                          → `IDF_MASTERS`
//   GET IdfPriority/masters/{id}/versions                            → `IDF_VERSIONS` (623)
//   GET IdfPriority/masters/{id}/versions/{vid}/entries?search&idf&page → `IDF_ENTRIES`, 25 a page
//
// It verifies, in LTR and RTL:
//   1. a master's page shows its live version's items: total, item / group / priority ltr, description in a bdi,
//      the live version picked, no "not live" mark;
//   2. paging reads the next page and keeps it in the address;
//   3. a typed search (number or description) and a group filter apply on Enter, go back to page 1, stay in the
//      address, and are sent as `search` / `idf`; a search nothing matches says so;
//   4. picking an old version shows its items marked not live (its number ltr) and keeps the filters; "Show the live
//      version" goes back; a link naming an old version opens on it;
//   5. a master with no live version says so and reads no items; a one-page version grows no pager;
//   6. a bare 403 on the items says "no access" while the rest of the page stays; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5211 --strictPort
//   2. node tools/idf-items-drive.mjs        (DRIVE_PORT overrides 5211)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5211}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
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
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit = idfStub(req.method(), p + url.search, body, { state, reads, deny })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|items\.|upload\.|versions\.|masters\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
const itemRows = (page) => page.locator('[data-idf-items] tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-item')))
const groupsShown = (page) => page.locator('[data-idf-items] tbody tr').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-idf')))])
const search = (page) => new URL(page.url()).search
const lastRead = (reads) => reads.entries?.at(-1) ?? null
const readParams = (reads) => Object.fromEntries(new URLSearchParams(lastRead(reads)?.qs ?? ''))
const total = async (page) => strip(await page.locator('[data-idf-items-total]').innerText())
const firstItemIs = (page, item) => page.locator(`[data-idf-items] tbody tr:first-child[data-item="${item}"]`).waitFor({ timeout: 30000 })

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const section = page.locator('[data-idf-items-section]')
    check(`${dir} 1. the live version's items are read`, JSON.stringify({ m: lastRead(reads)?.masterId, v: lastRead(reads)?.versionId }) === '{"m":"M-BUPA","v":"V-11"}', JSON.stringify(lastRead(reads)))
    check(`${dir} 1. the live version is picked, and not marked not live`, (await page.locator('[data-idf-items-version]').inputValue()) === 'V-11' && (await page.locator('[data-idf-items-not-live]').count()) === 0 && (await page.locator('[data-idf-items-show-live]').count()) === 0)
    check(`${dir} 1. the picker lists every version, the live one named`, JSON.stringify(await page.locator('[data-idf-items-version] option').evaluateAll((els) => els.map((e) => e.textContent.replace(/[\u2066-\u2069]/g, '')))) === JSON.stringify(['Version 3 (live)', 'Version 2', 'Version 1']))
    check(`${dir} 1. the total counts every item, its figure ltr`, (await total(page)) === 'Items: 60' && JSON.stringify(await ltr(section.locator('[data-idf-items-total]'))) === '["60"]', await total(page))
    check(`${dir} 1. a page of 25 rows`, (await itemRows(page)).length === 25)
    const r1 = page.locator('[data-idf-items] tbody tr[data-item="100110"]')
    check(`${dir} 1. item, group, priority ltr; the description in a bdi`, JSON.stringify(await ltr(r1.locator('[data-col="item"]'))) === '["100110"]' && JSON.stringify(await ltr(r1.locator('[data-col="group"]'))) === '["IDF-PARA-500"]' && JSON.stringify(await ltr(r1.locator('[data-col="priority"]'))) === '["2"]' && strip(await r1.locator('[data-col="description"] bdi:not([dir])').innerText()) === 'Adol 110 mg')
    check(`${dir} 1. no item column has a mark or actions column`, (await page.locator('[data-idf-items] [data-col="mark"], [data-idf-items] [data-col="actions"]').count()) === 0)

    // 2. paging
    await page.locator('[data-idf-items-section] nav[aria-label] button').last().click()
    await firstItemIs(page, '100350')
    check(`${dir} 2. Next reads page 2 and keeps it in the address`, readParams(reads).page === '2' && search(page) === '?page=2', search(page))

    // 3. search
    await page.locator('[data-idf-items-filter] [data-filter="q"]').fill('adol')
    await page.locator('[data-idf-items-filter] [data-filter="q"]').press('Enter')
    await page.waitForURL((u) => u.search === '?q=adol', { timeout: 30000 })
    await page.locator('[data-idf-items-total]').filter({ hasText: 'Items: 18' }).waitFor({ timeout: 30000 })
    check(`${dir} 3. a search goes back to page 1 and is sent as search`, JSON.stringify(readParams(reads)) === '{"search":"adol","page":"1"}', JSON.stringify(readParams(reads)))
    check(`${dir} 3. the search matches descriptions (Panadol, Adol, Fevadol)`, (await itemRows(page)).length === 18 && (await total(page)) === 'Items: 18')
    await page.locator('[data-idf-items-filter] [data-filter="idf"]').fill('IDF-IBU')
    await page.locator('[data-idf-items-filter] [data-filter="idf"]').press('Enter')
    await page.waitForURL((u) => u.search === '?q=adol&idf=IDF-IBU', { timeout: 30000 })
    await page.locator('[data-idf-items-total]').filter({ hasText: 'Items: 3' }).waitFor({ timeout: 30000 })
    check(`${dir} 3. a group keeps the search, sent as idf`, JSON.stringify(readParams(reads)) === '{"search":"adol","idf":"IDF-IBU","page":"1"}' && JSON.stringify(await groupsShown(page)) === '["IDF-IBU"]', JSON.stringify(readParams(reads)))
    const before = reads.entries.length
    await page.locator('[data-idf-items-filter] [data-filter="q"]').focus()
    await page.locator('[data-idf-items-filter] [data-filter="q"]').press('Enter')
    await page.waitForTimeout(300)
    check(`${dir} 3. leaving an untouched box reads nothing`, reads.entries.length === before)
    await page.locator('[data-idf-items-filter] [data-filter="q"]').fill('100190')
    await page.locator('[data-idf-items-filter] [data-filter="q"]').press('Enter')
    await page.locator('[data-idf-items-empty="noMatch"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. a search nothing matches says so`, strip(await page.locator('[data-idf-items-empty]').innerText()) === 'No items match this search.')
    await page.locator('[data-idf-items-filter] [data-filter="idf"]').fill('')
    await page.locator('[data-idf-items-filter] [data-filter="idf"]').press('Enter')
    await page.waitForURL((u) => u.search === '?q=100190', { timeout: 30000 })
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 30000 })
    check(`${dir} 3. a search by item number finds it`, JSON.stringify(await itemRows(page)) === '["100190"]')
    await page.locator('[data-idf-items-filter] [data-filter="q"]').fill('')
    await page.locator('[data-idf-items-filter] [data-filter="q"]').press('Enter')
    await page.waitForURL((u) => u.search === '', { timeout: 30000 })
    await page.locator('[data-idf-items-total]').filter({ hasText: 'Items: 60' }).waitFor({ timeout: 30000 })

    // 4. an old version
    await page.locator('[data-idf-items-filter] [data-filter="idf"]').fill('IDF-PARA-500')
    await page.locator('[data-idf-items-filter] [data-filter="idf"]').press('Enter')
    await page.waitForURL((u) => u.search === '?idf=IDF-PARA-500', { timeout: 30000 })
    await page.locator('[data-idf-items-version]').selectOption('V-7')
    await page.locator('[data-idf-items-not-live="V-7"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-items-total]').filter({ hasText: 'Items: 2' }).waitFor({ timeout: 30000 })
    check(`${dir} 4. picking v2 reads V-7 and keeps the group, in the address`, lastRead(reads)?.versionId === 'V-7' && search(page) === '?version=V-7&idf=IDF-PARA-500', search(page))
    check(`${dir} 4. its items show`, JSON.stringify(await itemRows(page)) === '["100200","100300"]', JSON.stringify(await itemRows(page)))
    const mark = page.locator('[data-idf-items-not-live]')
    check(`${dir} 4. it is marked not live, its number ltr`, strip(await mark.innerText()) === 'You are looking at version 2. It is not live.' && JSON.stringify(await ltr(mark)) === '["2"]', strip(await mark.innerText()))
    await page.locator('[data-idf-items-show-live]').click()
    await page.waitForURL((u) => u.search === '?idf=IDF-PARA-500', { timeout: 30000 })
    await page.locator('[data-idf-items-total]').filter({ hasText: 'Items: 10' }).waitFor({ timeout: 30000 })
    check(`${dir} 4. "Show the live version" goes back to it`, lastRead(reads)?.versionId === 'V-11' && (await page.locator('[data-idf-items-not-live]').count()) === 0 && (await page.locator('[data-idf-items-version]').inputValue()) === 'V-11')
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA?version=V-2`)
    await page.locator('[data-idf-items-not-live="V-2"]').waitFor({ timeout: 60000 })
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 30000 })
    check(`${dir} 4. a link naming v1 opens on it, marked not live`, (await page.locator('[data-idf-items-version]').inputValue()) === 'V-2' && JSON.stringify(await ltr(page.locator('[data-idf-items-not-live]'))) === '["1"]' && JSON.stringify(await itemRows(page)) === '["100200","100400"]')
    check(`${dir} 4. only v1's items are read`, (reads.entries ?? []).every((r) => r.versionId === 'V-2'), JSON.stringify(reads.entries))
    check(`${dir} 4. no page errors (old version link)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-TAW-PILOT`)
    await page.locator('[data-idf-items-no-live]').waitFor({ timeout: 60000 })
    check(`${dir} 5. a master with no live version says so and reads no items`, strip(await page.locator('[data-idf-items-no-live]').innerText()) === 'This master has no live version yet. Upload a file and publish it to see its items here.' && !reads.entries && (await page.locator('[data-idf-items-version]').count()) === 0)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-OPS`)
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
    check(`${dir} 5. a one-page version: every row, no pager`, (await itemRows(page)).length === 4 && (await page.locator('[data-idf-items-section] nav[aria-label]').count()) === 0)
    const blankAr = page.locator('[data-idf-items] tbody tr[data-item="100300"] [data-col="description"]')
    check(`${dir} 5. a description blank in one language reads the other`, strip(await blankAr.innerText()) === 'Adol 500 mg')
    check(`${dir} 5. no page errors (no live / one page)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['entries'] })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await page.locator('[data-idf-items-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the items says no access; the header and versions stay`, (await page.locator('[data-idf-items-denied]').count()) === 1 && (await page.locator('[data-idf-master="M-BUPA"]').count()) === 1 && (await page.locator('[data-idf-versions]').count()) === 1)
    check(`${dir} 6. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
