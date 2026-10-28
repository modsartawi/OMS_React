// Insurance rules ▸ IDF store lists drive (BackOffice spec 3157 / door 3162; oms ticket 620).
//
// Drives the REAL app in Chromium against a STUB of the store-lists door, on the REAL envelope. Fixtures and the
// handler are `tools/idf-stubs.mjs` (`// --- 620 ---`, `idfStoreListsStub`), in the shapes 3162 built (oms 628):
//   GET/POST IdfPriority/store-lists { code, nameEn, nameAr }, PUT …/{id} { nameEn, nameAr } (rename),
//   PUT …/{id}/stores { storeCodes } — no delete door.
//
// It verifies, in LTR and RTL:
//   1. the IDF store lists leaf is in the rail and lit; two lists (the pilot first) with code and store counts (ltr);
//   2. the pilot list carries the "Pilot" mark; no list offers delete;
//   3. create a list (POST { code, nameEn, nameAr }), rename it (PUT { nameEn, nameAr }; the code is kept);
//   4. open a list, add (de-duplicated, upper-cased) and remove stores, save → PUT …/stores with exactly the
//      visible set, the count follows;
//   5. refusals: an unknown store (IDF-00016, the codes named) and a taken code (IDF-00017), message + code;
//   6. no delete anywhere;
//   7. no raw keys, no page errors; a bare 403 on the read is "You do not have access".
//
//   1. run the app:  npx vite --port 5202 --strictPort
//   2. node tools/idf-store-lists-drive.mjs        (DRIVE_PORT overrides 5202)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5202}`

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
  const reads = {}
  const sent = []
  const state = newIdfState()
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
    const hit = idfStub(req.method(), p + url.search, req.postDataJSON?.() ?? null, { state, deny, reads, sent })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, sent }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|storeLists\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
const row = (page, id) => page.locator(`[data-store-list="${id}"]`)
const count = async (page, id) => (await ltr(row(page, id).locator('[data-col="stores"]'))).join('')
const chips = (page) => page.locator('[data-stores] [data-store]').evaluateAll((els) => els.map((e) => e.getAttribute('data-store')))
const until = async (fn, ms = 10000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads, sent } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/store-lists`)
    await page.locator('[data-idf-store-lists] tbody tr').first().waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator('a[href="/insurance-rules/idf/store-lists"]')
    check(`${dir} 1. the rail has the IDF store lists leaf, lit`, (await leaf.count()) >= 1 && (await leaf.first().getAttribute('aria-current')) === 'page')
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'IDF store lists')
    check(`${dir} 1. one read of the door`, reads.storeLists === 1, JSON.stringify(reads))
    const ids = await page.locator('[data-idf-store-lists] tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-store-list')))
    check(`${dir} 1. two lists, as sent (the pilot list first)`, JSON.stringify(ids) === '["SL-PILOT","SL-OPS"]', JSON.stringify(ids))
    check(`${dir} 1. store counts, ltr`, (await count(page, 'SL-OPS')) === '3' && (await count(page, 'SL-PILOT')) === '2')
    check(`${dir} 1. name in a bdi, code ltr`, strip(await row(page, 'SL-OPS').locator('[data-col="name"] bdi').first().innerText()) === 'Operation pharmacies' && JSON.stringify(await ltr(row(page, 'SL-OPS').locator('[data-col="code"]'))) === '["OPS"]')

    const pilot = row(page, 'SL-PILOT')
    check(`${dir} 2. the pilot list is marked "Pilot"`, (await pilot.locator('[data-pilot-mark]').count()) === 1 && strip(await pilot.locator('[data-pilot-mark]').innerText()) === 'Pilot')
    check(`${dir} 2. no list offers delete (3162 has no delete door)`, (await page.locator('[data-delete]').count()) === 0 && (await row(page, 'SL-OPS').locator('[data-pilot-mark]').count()) === 0)

    // 3. create (code + both names), rename (both names)
    await page.locator('[data-create-submit]').click()
    check(`${dir} 3. an empty create asks for the code and both names, sends nothing`, (await page.locator('[data-idf-store-list-create] [data-problem]').count()) === 3 && sent.length === 0)
    await page.locator('[data-create-code]').fill('NIGHT')
    await page.locator('[data-create-name-en]').fill('Night pharmacies')
    await page.locator('[data-create-name-ar]').fill('صيدليات الليل')
    await page.locator('[data-create-submit]').click()
    await row(page, 'SL-3').waitFor({ timeout: 10000 })
    check(`${dir} 3. create posts { code, nameEn, nameAr } and the list appears with 0 stores`, JSON.stringify(sent.at(-1)) === JSON.stringify({ method: 'POST', path: 'IdfPriority/store-lists', body: { code: 'NIGHT', nameEn: 'Night pharmacies', nameAr: 'صيدليات الليل' } }) && (await count(page, 'SL-3')) === '0', JSON.stringify(sent.at(-1)))
    check(`${dir} 3. the create boxes clear`, (await page.locator('[data-create-code]').inputValue()) === '' && (await page.locator('[data-create-name-en]').inputValue()) === '')
    await row(page, 'SL-3').locator('[data-rename="SL-3"]').click()
    check(`${dir} 3. rename starts from both names`, (await row(page, 'SL-3').locator('[data-rename-ar]').inputValue()) === 'صيدليات الليل')
    await row(page, 'SL-3').locator('[data-rename-en]').fill('Night shift pharmacies')
    await row(page, 'SL-3').locator('[data-rename-save]').click()
    const renamed = await until(async () => (await row(page, 'SL-3').locator('[data-rename-en]').count()) === 0 && strip(await row(page, 'SL-3').locator('[data-col="name"]').innerText()) === 'Night shift pharmacies')
    check(`${dir} 3. rename puts { nameEn, nameAr } and the row reads the new name; the code is kept`, renamed && JSON.stringify(sent.at(-1)) === JSON.stringify({ method: 'PUT', path: 'IdfPriority/store-lists/SL-3', body: { nameEn: 'Night shift pharmacies', nameAr: 'صيدليات الليل' } }) && JSON.stringify(await ltr(row(page, 'SL-3').locator('[data-col="code"]'))) === '["NIGHT"]', JSON.stringify(sent.at(-1)))

    // 4. open, add, remove, save
    await page.locator('[data-open="SL-OPS"]').click()
    await page.locator('[data-idf-store-list-editor="SL-OPS"]').waitFor()
    check(`${dir} 4. the editor shows the list's stores, each ltr`, JSON.stringify(await chips(page)) === '["P001","P002","P014"]' && JSON.stringify(await ltr(page.locator('[data-stores]'))) === '["P001","P002","P014"]')
    check(`${dir} 4. nothing to save before an edit`, await page.locator('[data-save-stores]').isDisabled())
    // review fix: dirty compares sets — removing a store and adding it back is not an edit
    await page.locator('[data-remove="P001"]').click()
    await page.locator('[data-add-input]').fill('p001')
    await page.locator('[data-add]').click()
    check(`${dir} 4. remove then re-add the same store: nothing to save`, JSON.stringify(await chips(page)) === '["P002","P014","P001"]' && (await page.locator('[data-save-stores]').isDisabled()), JSON.stringify(await chips(page)))
    await page.locator('[data-add-input]').fill('p020, P001  p021,,P020')
    await page.locator('[data-add]').click()
    check(`${dir} 4. add upper-cases and de-duplicates`, JSON.stringify(await chips(page)) === '["P002","P014","P001","P020","P021"]', JSON.stringify(await chips(page)))
    await page.locator('[data-remove="P002"]').click()
    const visible = await chips(page)
    check(`${dir} 4. remove drops the store`, JSON.stringify(visible) === '["P014","P001","P020","P021"]', JSON.stringify(visible))
    await page.locator('[data-save-stores]').click()
    await until(async () => (await count(page, 'SL-OPS')) === '4')
    check(`${dir} 4. save puts exactly the visible set`, JSON.stringify(sent.at(-1)) === JSON.stringify({ method: 'PUT', path: 'IdfPriority/store-lists/SL-OPS/stores', body: { storeCodes: visible } }), JSON.stringify(sent.at(-1)))
    check(`${dir} 4. the count follows, save disables again`, (await count(page, 'SL-OPS')) === '4' && (await until(() => page.locator('[data-save-stores]').isDisabled())))
    check(`${dir} 4. after the save the editor shows the server's set`, JSON.stringify(await chips(page)) === JSON.stringify(visible), JSON.stringify(await chips(page)))

    // 5. refusals: an unknown store (IDF-00016, the codes named), a taken code (IDF-00017)
    await page.locator('[data-add-input]').fill('q77')
    await page.locator('[data-add]').click()
    await page.locator('[data-save-stores]').click()
    const refusal = page.locator('[data-idf-store-lists-refusal]')
    await refusal.waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5. an unknown store is refused naming the code`, (await refusal.getAttribute('data-idf-store-lists-refusal')) === 'IDF-00016' && JSON.stringify(await ltr(refusal.locator('[data-bad-store-codes]'))) === '["Q77"]' && JSON.stringify(await ltr(refusal.locator('[data-refusal-code]'))) === '["IDF-00016"]')
    await page.locator('[data-remove="Q77"]').click()
    await page.locator('[data-create-code]').fill('OPS')
    await page.locator('[data-create-name-en]').fill('Again')
    await page.locator('[data-create-name-ar]').fill('مجددًا')
    await page.locator('[data-create-submit]').click()
    await until(async () => (await refusal.getAttribute('data-idf-store-lists-refusal').catch(() => null)) === 'IDF-00017')
    check(`${dir} 5. a taken code is refused with its message and code, ltr`, strip(await refusal.innerText()).includes('plain letters, digits and dashes') && JSON.stringify(await ltr(refusal.locator('[data-refusal-code]'))) === '["IDF-00017"]')
    check(`${dir} 5. the create keeps its input`, (await page.locator('[data-create-code]').inputValue()) === 'OPS')

    // 6. there is no delete anywhere, the new list included
    check(`${dir} 6. no delete is offered, even on a new list`, (await row(page, 'SL-3').locator('[data-delete]').count()) === 0 && !sent.some((x) => x.method === 'DELETE'))

    check(`${dir} 7. no raw keys`, await noRawKeys(page))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['storeLists'] })
    await page.goto(`${BASE}/insurance-rules/idf/store-lists`)
    await page.locator('[data-idf-store-lists-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 7. a bare 403 → "You do not have access", never an empty list`, (await page.locator('[data-idf-store-lists-denied]').count()) === 1 && strip(await page.locator('[data-idf-store-lists-denied]').innerText()).startsWith('You do not have access') && (await page.locator('[data-idf-store-lists], [data-idf-store-lists-empty]').count()) === 0)
    check(`${dir} 7. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
