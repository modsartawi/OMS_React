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
// 648 (door 3192: `PUT|DELETE IdfPriority/general/items/{itemNumber}`, stub `// --- 648 ---`) adds:
//  10. Set item: Save stays off until item, group, a whole priority >= 1 and a reason are there; the PUT carries
//      `{ idfNumber, priority, reason }` and the master grows by one;
//  11. a row's Edit starts from its group and priority (item fixed); a re-rank shows the new priority on the row;
//  12. a refused group shows the server's message in the dialog, which stays open, the row unchanged;
//  13. Clear asks for a reason, sends it in the DELETE body, and the item leaves the master.
//  14. (3185 review) clearing the only item on the last page falls back to the new last page, never an empty one.
//
// 649 / 650 / 651 extend this drive (their slots on the page).
//
// 654 (grants): 14. without `canEditGeneral` (`GET IdfPriority/Access`) no Set item, no row Edit / Clear and no Upload
//     block shows; Export, the Template (moved into the action row) and the Change log tab still do.
//
// 651 (door 3195; `// --- 651 ---` in the stubs: GET IdfPriority/general/export · GET IdfPriority/general/template):
//   7. Export sits in the General page's action row, Template beside 649's Upload (3185 review); each saves its file
//      under the server's name;
//   8. no server name → the client's fallback names (`idf-general.xlsx`, `idf-general-template.xlsx`);
//   9. a failed export / template (the real doors never refuse a read here: a 500) toasts and saves nothing.
//
//   1. run the app:  npx vite --port 5214 --strictPort
//   2. node tools/idf-general-drive.mjs        (DRIVE_PORT overrides 5214)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
import { IDF_GENERAL_EXPORT_NAME, IDF_GENERAL_TEMPLATE_NAME } from './idf-stubs.mjs' // 651
import { IDF_GENERAL_ITEMS } from './idf-stubs.mjs' // 3185 review
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
  const writes = [] // 648
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
    const hit = idfStub(req.method(), p + url.search, body, { state, reads, deny, noFileName, writes })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, writes, state }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|general\.|generalEdit\.|items\.|download\.|upload\.|masters\.|menu\.idf|access\./.test(await page.locator('main').innerText())
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
        JSON.stringify(await ltr(r.locator('[data-col="group"]'))) === '["IDF-PARA"]' &&
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
  // 648 · set, re-rank and clear one general item; a refused group
  {
    const { context, page, errors, writes } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/general`)
    await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
    const save = page.locator('[data-general-save]')
    const field = (dlg, f) => page.locator(`[data-idf-general-dialog="${dlg}"] [data-field="${f}"]`)
    check(`${dir} 10. each row has Edit and Clear`, (await page.locator('[data-idf-general-edit="300110"]').count()) === 1 && (await page.locator('[data-idf-general-clear="300110"]').count()) === 1)

    // 10. Set item
    await page.locator('[data-idf-general-set]').click()
    await page.locator('[data-idf-general-dialog="new"]').waitFor({ timeout: 30000 })
    check(`${dir} 10. Set item opens blank, Save off`, (await field('new', 'itemNumber').inputValue()) === '' && (await save.isDisabled()))
    await field('new', 'itemNumber').fill('300999')
    await field('new', 'idfNumber').fill('IDF-IBU')
    await field('new', 'priority').fill('0')
    await field('new', 'reason').fill('Added for the shortage')
    check(
      `${dir} 10. a priority of 0 is not a whole number >= 1; Save off`,
      (await page.locator('[data-idf-general-dialog="new"] [data-problem="priorityWholeNumber"]').count()) === 1 && (await save.isDisabled()),
    )
    await field('new', 'priority').fill('5')
    await field('new', 'reason').fill('')
    check(`${dir} 10. without a reason Save stays off`, await save.isDisabled())
    await field('new', 'reason').fill('Added for the shortage')
    check(`${dir} 10. all three valid, Save on`, await save.isEnabled())
    await save.click()
    await page.locator('[data-idf-general-dialog]').waitFor({ state: 'detached', timeout: 30000 })
    await totalIs(page, 41)
    const put = writes.at(-1)
    check(
      `${dir} 10. the PUT names the item and carries group, priority and reason; the master holds 41`,
      put?.method === 'PUT' && put.path === 'IdfPriority/general/items/300999' && JSON.stringify(put.body) === '{"idfNumber":"IDF-IBU","priority":5,"reason":"Added for the shortage"}',
      JSON.stringify(put),
    )

    // 11. Edit → re-rank
    await page.locator('[data-idf-general-edit="300110"]').click()
    await page.locator('[data-idf-general-dialog="300110"]').waitFor({ timeout: 30000 })
    check(
      `${dir} 11. Edit starts from the row (item fixed), Save off until a reason`,
      (await field('300110', 'itemNumber').inputValue()) === '300110' &&
        (await field('300110', 'itemNumber').isDisabled()) &&
        (await field('300110', 'idfNumber').inputValue()) === 'IDF-PARA' &&
        (await field('300110', 'priority').inputValue()) === '2' &&
        (await save.isDisabled()),
    )
    await field('300110', 'priority').fill('9')
    await field('300110', 'reason').fill('Re-ranked after the recall')
    await save.click()
    await page.locator('[data-idf-items] tbody tr[data-item="300110"][data-priority="9"]').waitFor({ timeout: 30000 }).catch(() => {})
    check(
      `${dir} 11. a re-rank shows on the row, its priority ltr`,
      JSON.stringify(await ltr(page.locator('[data-idf-items] tbody tr[data-item="300110"] [data-col="priority"]'))) === '["9"]' &&
        JSON.stringify(writes.at(-1)?.body) === '{"idfNumber":"IDF-PARA","priority":9,"reason":"Re-ranked after the recall"}',
      JSON.stringify(writes.at(-1)),
    )

    // 12. a refused group
    await page.locator('[data-idf-general-edit="300120"]').click()
    await page.locator('[data-idf-general-dialog="300120"]').waitFor({ timeout: 30000 })
    await field('300120', 'idfNumber').fill('IDF-NOPE')
    await field('300120', 'reason').fill('Moved to a new group')
    await save.click()
    await page.locator('[data-idf-general-refusal]').waitFor({ timeout: 30000 }).catch(() => {})
    const refusal = strip(await page.locator('[data-idf-general-refusal]').innerText().catch(() => ''))
    check(
      `${dir} 12. a refused group shows its message in the dialog, which stays open`,
      refusal.includes("'IDF-NOPE' is not an IDF group: add the group first.") && (await page.locator('[data-idf-general-dialog="300120"]').count()) === 1,
      refusal,
    )
    await page.locator('dialog button', { hasText: 'Cancel' }).click()
    await page.locator('[data-idf-general-dialog]').waitFor({ state: 'detached', timeout: 30000 })
    check(`${dir} 12. the refused row is unchanged`, (await page.locator('[data-idf-items] tbody tr[data-item="300120"]').getAttribute('data-idf')) === 'IDF-PARA')

    // 13. Clear
    await page.locator('[data-idf-general-clear="300110"]').click()
    await page.locator('[data-idf-general-clear-dialog="300110"]').waitFor({ timeout: 30000 })
    const confirm = page.locator('[data-general-clear-confirm]')
    check(`${dir} 13. Clear asks for a reason first`, await confirm.isDisabled())
    await page.locator('[data-idf-general-clear-dialog="300110"] [data-field="reason"]').fill('Withdrawn from the market')
    await confirm.click()
    await page.locator('[data-idf-general-clear-dialog]').waitFor({ state: 'detached', timeout: 30000 })
    await totalIs(page, 40)
    const del = writes.at(-1)
    check(
      `${dir} 13. the DELETE carries the reason in its body; the item leaves the master`,
      del?.method === 'DELETE' &&
        del.path === 'IdfPriority/general/items/300110' &&
        JSON.stringify(del.body) === '{"reason":"Withdrawn from the market"}' &&
        (await page.locator('[data-idf-items] tbody tr[data-item="300110"]').count()) === 0,
      JSON.stringify(del),
    )
    check(`${dir} 13. no raw keys`, await noRawKeys(page))
    check(`${dir} 13. no page errors (edits)`, errors.length === 0, errors.join(' | '))
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
      `${dir} 7. Export sits in the action row, Template beside Upload`,
      (await page.locator(`[data-idf-general-actions] ${G_EXPORT}`).count()) === 1 &&
        (await page.locator(`[data-idf-general-actions] ${G_TEMPLATE}`).count()) === 0 &&
        (await page.locator(`[data-idf-general-upload] ${G_TEMPLATE}`).count()) === 1 &&
        (await page.locator(`[data-idf-general-upload] [data-idf-general-upload-submit] ~ ${G_TEMPLATE}`).count()) === 1,
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
      `${dir} 9. a failed export toasts, no file`,
      (await exToast.count()) === 1 && !downloaded && reads.generalExport === 1,
    )
    await page.locator(G_TEMPLATE).click()
    const tplToast = page.locator('[data-sonner-toast]', { hasText: 'The template could not be downloaded' })
    await tplToast.waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 9. a failed template toasts, no file`, (await tplToast.count()) === 1 && !downloaded)
    check(`${dir} 9. the buttons are usable again after a refusal`, (await page.locator(G_EXPORT).isEnabled()) && (await page.locator(G_TEMPLATE).isEnabled()))
    check(`${dir} 9. no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// --- 3185 review --- the only item of the last page cleared → the new last page
for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, state } = await open(dir)
  state.general = structuredClone(IDF_GENERAL_ITEMS).slice(0, 26)
  const last = state.general[25].itemNumber
  await page.goto(`${BASE}/insurance-rules/idf/general?page=2`)
  await page.locator(`[data-idf-items] tbody tr[data-item="${last}"]`).waitFor({ timeout: 60000 })
  check(`${dir} 14. page 2 holds one item`, JSON.stringify(await itemRows(page)) === JSON.stringify([last]), JSON.stringify(await itemRows(page)))
  await page.locator(`[data-idf-general-clear="${last}"]`).click()
  await page.locator(`[data-idf-general-clear-dialog="${last}"] [data-field="reason"]`).fill('Withdrawn')
  await page.locator('[data-general-clear-confirm]').click()
  await page.locator('[data-idf-general-clear-dialog]').waitFor({ state: 'detached', timeout: 30000 })
  await page.waitForURL((u) => !u.searchParams.has('page'), { timeout: 30000 }).catch(() => {})
  await totalIs(page, 25).catch(() => {})
  check(
    `${dir} 14. the emptied page 2 falls back to page 1, its 25 rows, no "empty" message`,
    !new URL(page.url()).searchParams.has('page') && (await itemRows(page)).length === 25 && (await page.locator('[data-idf-items-empty]').count()) === 0,
    `${page.url()} ${(await itemRows(page)).length}`,
  )
  check(`${dir} 14. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// --- 654 --- without the general edit grant
for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, reads, state } = await open(dir)
  state.access = { canEditGeneral: false }
  await page.goto(`${BASE}/insurance-rules/idf/general`)
  await page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(500)
  check(`${dir} 14. the probe is read`, (reads.access ?? 0) >= 1)
  check(
    `${dir} 14. without canEditGeneral: no Set item, no row Edit / Clear, no Upload block`,
    (await page.locator('[data-idf-general-set], [data-idf-general-edit], [data-idf-general-clear], [data-idf-general-upload]').count()) === 0,
  )
  check(
    `${dir} 14. Export and Template still show, in the action row; the Change log tab too`,
    (await page.locator(`[data-idf-general-actions] ${G_EXPORT}`).count()) === 1 &&
      (await page.locator(`[data-idf-general-actions] ${G_TEMPLATE}`).count()) === 1 &&
      (await page.locator('[data-idf-general-tabs] [data-tab="changes"]').count()) === 1,
  )
  check(`${dir} 14. no raw keys; no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
