// Insurance rules ▸ IDF masters ▸ General drive (BackOffice spec 3185 / door 3191; oms ticket 647).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope. Fixtures and handlers are `tools/idf-stubs.mjs`
// (`// --- 619 ---`, `// --- 647 ---`, `idfStub`):
//   GET IdfPriority/masters                          → `IDF_MASTERS` (the general row last)
//   GET IdfPriority/general/items?search&idf&page    → `IDF_GENERAL_ITEMS`, 40 items over 4 groups, 25 a page
//
// It verifies, in LTR and RTL:
//   1. the masters list shows the General row: kind "General", no thresholds, no version, no Edit; its name opens
//      `/insurance-rules/idf/general`, and the IDF masters leaf stays lit there;
//   2. the General page names tier 4 (ltr) and says the WPF IDF screens still write it, unchecked; the Items tab is on;
//   3. its items: total, item / group / priority ltr, description in a bdi, 25 a page; Next reads page 2 into the address;
//   4. a typed search and a group filter apply on Enter, go back to page 1, stay in the address and are sent as
//      `search` / `idf`; a search nothing matches says so;
//   5. `/insurance-rules/idf/masters/general` lands on the General page;
//   6. a bare 403 on the items says "no access" while the header stays; no raw keys; no page errors.
//
// 648 / 649 / 650 / 651 extend this drive (their slots on the page).
//
// 651 (door 3195; `// --- 651 ---` in the stubs: GET IdfPriority/general/export · GET IdfPriority/general/template):
//   7. Export and Template sit in the General page's action row; each saves its file under the server's name;
//   8. no server name → the client's fallback names (`idf-general.xlsx`, `idf-general-template.xlsx`);
//   9. a refused export / template (JSON 400 envelope) toasts the server's message and saves nothing.
//
//   1. run the app:  npx vite --port 5214 --strictPort
//   2. node tools/idf-general-drive.mjs        (DRIVE_PORT overrides 5214)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
import { IDF_GENERAL_EXPORT_NAME, IDF_GENERAL_TEMPLATE_NAME } from './idf-stubs.mjs' // 651
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5214}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [], noFileName = false } = {}) {
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
    const hit = idfStub(req.method(), p + url.search, body, { state, reads, deny, noFileName })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|general\.|items\.|download\.|upload\.|masters\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
const itemRows = (page) => page.locator('[data-idf-items] tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-item')))
const groupsShown = (page) => page.locator('[data-idf-items] tbody tr').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-idf')))])
const search = (page) => new URL(page.url()).search
const readParams = (reads) => Object.fromEntries(new URLSearchParams(reads.generalItems?.at(-1) ?? ''))
const total = async (page) => strip(await page.locator('[data-idf-items-total]').innerText())
// An exact total ('Items: 4' as a substring would match 'Items: 40'), isolates stripped.
const totalIs = (page, n) =>
  page.waitForFunction((want) => (document.querySelector('[data-idf-items-total]')?.textContent ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim() === want, `Items: ${n}`, { timeout: 30000 })
const typeInto = async (page, field, value) => {
  await page.locator(`[data-idf-items-filter] [data-filter="${field}"]`).fill(value)
  await page.locator(`[data-idf-items-filter] [data-filter="${field}"]`).press('Enter')
}

// 651 · the download buttons
const G_EXPORT = '[data-idf-general-export]'
const G_TEMPLATE = '[data-idf-general-template]'
const download = async (page, sel) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(sel).click()])
  return { name: dl.suggestedFilename(), saved: (await dl.path()) != null }
}

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters`)
    await page.locator('[data-idf-masters] tbody tr[data-master="general"]').waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const g = page.locator('[data-idf-masters] tbody tr[data-master="general"]')
    check(
      `${dir} 1. the General row is listed last, kind General`,
      (await page.locator('[data-idf-masters] tbody tr').last().getAttribute('data-master')) === 'general' &&
        strip(await g.locator('[data-col="kind"]').innerText()) === 'General' &&
        (await g.getAttribute('data-kind')) === 'general',
    )
    check(
      `${dir} 1. no thresholds, no version, no Edit`,
      strip(await g.locator('[data-col="thresholds"]').innerText()) === '' &&
        (await g.locator('[data-col="version"], [data-col="noLive"]').count()) === 0 &&
        strip(await g.locator('[data-col="noVersion"]').innerText()) === '' &&
        (await g.locator('[data-idf-master-edit]').count()) === 0,
    )
    check(`${dir} 1. the other rows keep their Edit`, (await page.locator('[data-idf-master-edit]').count()) === 3)
    check(`${dir} 1. its name links to the General page`, (await g.locator('[data-idf-open-master]').getAttribute('href')) === '/insurance-rules/idf/general')
    await g.locator('[data-idf-open-master]').click()
    await page.waitForURL((u) => u.pathname === '/insurance-rules/idf/general', { timeout: 30000 })
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
    const leaf = page.locator('a[href="/insurance-rules/idf/masters"]')
    check(`${dir} 1. the IDF masters leaf stays lit on the General page`, (await leaf.count()) >= 1 && (await leaf.first().getAttribute('aria-current')) === 'page')

    // 2. header
    check(`${dir} 2. the title`, strip(await page.locator('[data-idf-general] h1').innerText()) === 'General master')
    const tier = page.locator('[data-idf-general-tier]')
    check(`${dir} 2. it names tier 4, the number ltr`, strip(await tier.innerText()).startsWith('Tier 4:') && JSON.stringify(await ltr(tier)) === '["4"]', strip(await tier.innerText()))
    check(`${dir} 2. the help says the WPF IDF screens still write it, unchecked`, /WPF IDF screens still write it too, unchecked/.test(strip(await page.locator('[data-idf-general-help]').innerText())))
    check(`${dir} 2. the Items tab is on`, (await page.locator('[data-idf-general-tabs] [data-tab="items"]').getAttribute('aria-selected')) === 'true')

    // 3. items
    check(`${dir} 3. the first read is page 1, unfiltered`, JSON.stringify(readParams(reads)) === '{"page":"1"}', JSON.stringify(readParams(reads)))
    check(`${dir} 3. the total counts every item, its figure ltr`, (await total(page)) === 'Items: 40' && JSON.stringify(await ltr(page.locator('[data-idf-items-total]'))) === '["40"]', await total(page))
    check(`${dir} 3. a page of 25 rows`, (await itemRows(page)).length === 25)
    const r = page.locator('[data-idf-items] tbody tr[data-item="300110"]')
    check(
      `${dir} 3. item, group, priority ltr; the description in a bdi`,
      JSON.stringify(await ltr(r.locator('[data-col="item"]'))) === '["300110"]' &&
        JSON.stringify(await ltr(r.locator('[data-col="group"]'))) === '["IDF-PARA-500"]' &&
        JSON.stringify(await ltr(r.locator('[data-col="priority"]'))) === '["2"]' &&
        strip(await r.locator('[data-col="description"] bdi:not([dir])').innerText()) === 'Adol general 11',
      strip(await r.locator('[data-col="description"]').innerText()),
    )
    await page.locator('[data-idf-general-items] nav[aria-label] button').last().click()
    await page.locator('[data-idf-items] tbody tr:first-child[data-item="300350"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. Next reads page 2 and keeps it in the address`, readParams(reads).page === '2' && search(page) === '?page=2' && (await itemRows(page)).length === 15, search(page))

    // 4. search + group
    await typeInto(page, 'q', 'brufen')
    await page.waitForURL((u) => u.search === '?q=brufen', { timeout: 30000 })
    await totalIs(page, 4)
    check(`${dir} 4. a search goes back to page 1 and is sent as search`, JSON.stringify(readParams(reads)) === '{"search":"brufen","page":"1"}', JSON.stringify(readParams(reads)))
    await typeInto(page, 'idf', 'IDF-IBU')
    await page.waitForURL((u) => u.search === '?q=brufen&idf=IDF-IBU', { timeout: 30000 })
    await totalIs(page, 1)
    check(
      `${dir} 4. a group keeps the search, sent as idf`,
      JSON.stringify(readParams(reads)) === '{"search":"brufen","idf":"IDF-IBU","page":"1"}' && JSON.stringify(await groupsShown(page)) === '["IDF-IBU"]' && JSON.stringify(await itemRows(page)) === '["300230"]',
      JSON.stringify(await itemRows(page)),
    )
    await typeInto(page, 'q', 'nothing-like-this')
    await page.locator('[data-idf-items-empty="noMatch"]').waitFor({ timeout: 30000 })
    check(`${dir} 4. a search nothing matches says so`, strip(await page.locator('[data-idf-items-empty]').innerText()) === 'No items match this search.')
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/general`)
    await page.waitForURL((u) => u.pathname === '/insurance-rules/idf/general', { timeout: 60000 })
    await page.locator('[data-idf-general-page]').waitFor({ timeout: 30000 })
    check(`${dir} 5. /idf/masters/general lands on the General page`, (await page.locator('[data-idf-master-page]').count()) === 0)
    check(`${dir} 5. no page errors (redirect)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['generalItems'] })
    await page.goto(`${BASE}/insurance-rules/idf/general`)
    await page.locator('[data-idf-items-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the items says no access; the header stays`, (await page.locator('[data-idf-items-denied]').count()) === 1 && (await page.locator('[data-idf-general]').count()) === 1)
    check(`${dir} 6. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 651 · Export / Template
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/general`)
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
    check(
      `${dir} 7. Export and Template sit in the action row`,
      (await page.locator(`[data-idf-general-actions] ${G_EXPORT}`).count()) === 1 && (await page.locator(`[data-idf-general-actions] ${G_TEMPLATE}`).count()) === 1,
    )
    const ex = await download(page, G_EXPORT)
    check(`${dir} 7. Export saves the general master under the server's name`, ex.saved && ex.name === IDF_GENERAL_EXPORT_NAME && reads.generalExport === 1, ex.name)
    const tpl = await download(page, G_TEMPLATE)
    check(`${dir} 7. Template saves the blank file under the server's name`, tpl.saved && tpl.name === IDF_GENERAL_TEMPLATE_NAME && reads.generalTemplate === 1, tpl.name)
    check(`${dir} 7. no raw keys (downloads)`, await noRawKeys(page))
    check(`${dir} 7. no page errors (downloads)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { noFileName: true })
    await page.goto(`${BASE}/insurance-rules/idf/general`)
    await page.locator(G_EXPORT).waitFor({ timeout: 60000 })
    const ex = await download(page, G_EXPORT)
    const tpl = await download(page, G_TEMPLATE)
    check(`${dir} 8. no server name → the client's fallback names`, ex.name === 'idf-general.xlsx' && tpl.name === 'idf-general-template.xlsx', `${ex.name} ${tpl.name}`)
    check(`${dir} 8. no page errors (fallback names)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, reads } = await open(dir, { deny: ['generalExport', 'generalTemplate'] })
    await page.goto(`${BASE}/insurance-rules/idf/general`)
    await page.locator(G_EXPORT).waitFor({ timeout: 60000 })
    let downloaded = false
    page.on('download', () => (downloaded = true))
    await page.locator(G_EXPORT).click()
    const exToast = page.locator('[data-sonner-toast]', { hasText: 'The file could not be exported' })
    await exToast.waitFor({ timeout: 10000 }).catch(() => {})
    check(
      `${dir} 9. a refused export toasts the server's message, no file`,
      (await exToast.count()) === 1 && /The general master could not be exported/.test(await exToast.innerText()) && !downloaded && reads.generalExport === 1,
    )
    await page.locator(G_TEMPLATE).click()
    const tplToast = page.locator('[data-sonner-toast]', { hasText: 'The template could not be downloaded' })
    await tplToast.waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 9. a refused template toasts the server's message, no file`, (await tplToast.count()) === 1 && /The general template could not be built/.test(await tplToast.innerText()) && !downloaded)
    check(`${dir} 9. the buttons are usable again after a refusal`, (await page.locator(G_EXPORT).isEnabled()) && (await page.locator(G_TEMPLATE).isEnabled()))
    check(`${dir} 9. no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
