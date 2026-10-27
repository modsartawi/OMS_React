// Insurance rules ▸ IDF masters drive (BackOffice spec 3157 / door 3161; oms ticket 619).
//
// Drives the REAL app in Chromium against a STUB of the masters door, on the REAL envelope. Fixtures and the
// handler are `tools/idf-stubs.mjs` (`// --- 619 ---`, `idfStub`):
//   GET IdfPriority/masters → `IDF_MASTERS` (an insurer master, an insurer master on a store list, a store master)
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3161 is unbuilt. Ticket 628 swaps in the doors.
//
// It verifies, in LTR and RTL:
//   1. the IDF masters leaf is in the rail and lit (`aria-current="page"`); `/insurance-rules/idf` opens it;
//   2. the rows: kind words, payer / store list (both on a scoped insurer master), names in the reader's language (en),
//      "hard above N, reminder above M" (defaults 4 and 1), the live version or "No live version yet";
//   3. machine values in `bdi[dir=ltr]`, names in `bdi`; no raw keys; no page errors;
//   4. a bare 403 is "You do not have access", never an empty list;
//   5. (621) New master / Edit: defaults 4 and 1; the form refuses a missing payer / store list / name and a
//      reminder above hard before sending; creates an insurer, an insurer scoped to a store list and a store master;
//      edits one (kind fixed); an overlapping scope is refused naming the clashing master, the input kept. The
//      store list column shows 620's list name.
//
//   1. run the app:  npx vite --port 5201 --strictPort   (621 drove it on 5208: DRIVE_PORT=5208)
//   2. node tools/idf-masters-drive.mjs        (DRIVE_PORT overrides 5201)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`

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
const noRawKeys = async (page) => !/insurance-(rules|idf):|masters\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (row, col) => row.locator(`[data-col="${col}"] bdi[dir="ltr"]`).evaluateAll((els) => els.map((e) => e.textContent))

// The app's `lng` stays `en` (core/i18n.ts: Arabic is not switched on yet); `oms.locale=ar` flips the page to
// RTL only. So the RTL pass reads the English words in a mirrored page, the house pattern; the Arabic bundle's
// mirror and the Arabic names are proven by `i18n-keys.test.ts` and `masters.test.ts`.
const WORDS = {
  ltr: {
    title: 'IDF masters',
    insurer: 'Insurer',
    store: 'Store',
    bupa: 'Bupa general',
    taw: 'Tawuniya on the pilot stores',
    ops: 'Operation pharmacies',
    thr: (h, r) => `Hard above ${h}, reminder above ${r}`,
    noLive: 'No live version yet',
    denied: 'You do not have access',
  },
}

for (const dir of ['ltr', 'rtl']) {
  const w = WORDS.ltr
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf`)
    await page.locator('[data-idf-masters] tbody tr').first().waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. /insurance-rules/idf opens the masters`, new URL(page.url()).pathname === '/insurance-rules/idf/masters', page.url())
    const leaf = page.locator('a[href="/insurance-rules/idf/masters"]')
    check(`${dir} 1. the rail has the IDF masters leaf, lit`, (await leaf.count()) >= 1 && (await leaf.first().getAttribute('aria-current')) === 'page')
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === w.title)
    check(`${dir} 1. one read of the door`, reads.masters === 1, JSON.stringify(reads))

    const ids = await page.locator('[data-idf-masters] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-master')}:${e.getAttribute('data-kind')}`))
    check(`${dir} 2. three rows, as sent`, JSON.stringify(ids) === JSON.stringify(['M-BUPA:insurer', 'M-TAW-PILOT:insurer', 'M-OPS:store']), JSON.stringify(ids))

    const bupa = page.locator('[data-master="M-BUPA"]')
    check(`${dir} 2. insurer: name by language in a bdi, kind word`, strip(await bupa.locator('[data-col="name"] bdi').innerText()) === w.bupa && strip(await bupa.locator('[data-col="kind"]').innerText()) === w.insurer)
    check(`${dir} 2. insurer: payer ltr, no store list`, JSON.stringify(await ltr(bupa, 'payer')) === '["BUPA"]' && strip(await bupa.locator('[data-col="storeList"]').innerText()) === '')
    check(`${dir} 2. insurer: its own thresholds, each value ltr`, strip(await bupa.locator('[data-col="thresholds"]').innerText()) === w.thr(5, 2) && JSON.stringify(await ltr(bupa, 'thresholds')) === '["5","2"]', strip(await bupa.locator('[data-col="thresholds"]').innerText()))
    check(`${dir} 2. insurer: live version number, by · at (local), note`, JSON.stringify(await ltr(bupa, 'version')) === '["3"]' && strip((await ltr(bupa, 'published')).join('')) === 'nalharbi · 2026-10-20 09:15' && strip(await bupa.locator('[data-col="note"] bdi').innerText()) === 'October refresh', JSON.stringify(await ltr(bupa, 'published')))

    const taw = page.locator('[data-master="M-TAW-PILOT"]')
    await taw.locator('bdi[data-store-list-id]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 2. insurer on a store list shows both (the list by its 620 name, 621)`, JSON.stringify(await ltr(taw, 'payer')) === '["TAWUNIYA"]' && strip(await taw.locator('[data-col="storeList"] bdi[data-store-list-id="SL-PILOT"]').innerText()) === 'Pilot rollout' && strip(await taw.locator('[data-col="name"] bdi').innerText()) === w.taw)
    check(`${dir} 2. no thresholds sent → 4 and 1`, strip(await taw.locator('[data-col="thresholds"]').innerText()) === w.thr(4, 1))
    check(`${dir} 2. no live version says so`, strip(await taw.locator('[data-col="noLive"]').innerText()) === w.noLive && (await taw.locator('[data-col="version"]').count()) === 0)

    const ops = page.locator('[data-master="M-OPS"]')
    check(`${dir} 2. store master: kind word, store list ltr, no payer`, strip(await ops.locator('[data-col="kind"]').innerText()) === w.store && strip(await ops.locator('[data-col="storeList"] bdi[data-store-list-id="SL-OPS"]').innerText()) === 'Operation pharmacies' && strip(await ops.locator('[data-col="payer"]').innerText()) === '' && strip(await ops.locator('[data-col="name"] bdi').innerText()) === w.ops)
    check(`${dir} 2. store master: version without a note`, JSON.stringify(await ltr(ops, 'version')) === '["1"]' && (await ops.locator('[data-col="note"] bdi').count()) === 0)

    check(`${dir} 3. no raw keys`, await noRawKeys(page))
    check(`${dir} 3. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['masters'] })
    await page.goto(`${BASE}/insurance-rules/idf/masters`)
    await page.locator('[data-idf-masters-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 4. a bare 403 → "You do not have access", never an empty list`, (await page.locator('[data-idf-masters-denied]').count()) === 1 && strip(await page.locator('[data-idf-masters-denied]').innerText()).startsWith(w.denied) && (await page.locator('[data-idf-masters], [data-idf-masters-empty]').count()) === 0)
    check(`${dir} 4. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 621 · create / edit, the overlap refusal
  {
    const { context, page, errors, sent } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters`)
    await page.locator('[data-idf-masters] tbody tr').first().waitFor({ timeout: 60000 })
    await page.locator('[data-master="M-TAW-PILOT"] bdi[data-store-list-id]').waitFor({ timeout: 30000 })
    const dlg = page.locator('[data-idf-master-dialog]')
    const field = (f) => dlg.locator(`[data-field="${f}"]`)
    const problems = async () => (await dlg.locator('[data-problem]').evaluateAll((els) => els.map((e) => e.getAttribute('data-problem')))).join(',')
    const thisOne = () => dlg.locator('[data-this-one]').getAttribute('data-tier')
    const save = () => page.locator('[data-master-save]').click()
    const closed = () => dlg.waitFor({ state: 'detached', timeout: 15000 }).then(() => true).catch(() => false)
    const writes = () => sent.filter((x) => x.path.startsWith('IdfPriority/masters'))
    const refusal = dlg.locator('[data-idf-master-refusal]')

    // create an insurer master
    await page.locator('[data-idf-master-new]').click()
    await dlg.waitFor()
    check(`${dir} 5. New master opens a create dialog with thresholds 4 and 1`, (await dlg.getAttribute('data-idf-master-dialog')) === 'new' && (await field('hard').inputValue()) === '4' && (await field('reminder').inputValue()) === '1')
    check(`${dir} 5. the help lists the four tiers in order and marks insurer`, JSON.stringify(await dlg.locator('[data-tier]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tier')))) === '["insurerStoreList","insurer","store","general"]' && (await thisOne()) === 'insurer')
    await save()
    check(`${dir} 5. an empty insurer form asks for payer and both names, sends nothing`, (await problems()) === 'payerRequired,nameRequired,nameRequired' && writes().length === 0, await problems())
    await field('payerCode').fill('axa')
    await field('nameEn').fill('AXA general')
    await field('nameAr').fill('أكسا العام')
    await field('reminder').fill('5')
    await save()
    check(`${dir} 5. reminder above hard is refused before sending`, (await problems()) === 'reminderAboveHard' && writes().length === 0, await problems())
    await field('reminder').fill('2')
    await save()
    check(`${dir} 5. insurer created: POST with the typed body`, (await closed()) && JSON.stringify(writes()[0]) === JSON.stringify({ method: 'POST', path: 'IdfPriority/masters', body: { kind: 'insurer', payerCode: 'AXA', storeListId: null, nameEn: 'AXA general', nameAr: 'أكسا العام', hardThreshold: 4, reminderThreshold: 2 } }), JSON.stringify(writes()))
    const axa = page.locator('[data-master="M-NEW-4"]')
    await axa.waitFor({ timeout: 15000 }).catch(() => {})
    check(`${dir} 5. the new insurer master is in the list`, (await axa.count()) === 1 && strip(await axa.locator('[data-col="thresholds"]').innerText()) === w.thr(4, 2))

    // create an insurer master scoped to a store list
    await page.locator('[data-idf-master-new]').click()
    await dlg.waitFor()
    await field('payerCode').fill('AXA')
    await field('storeListId').selectOption('SL-PILOT')
    await field('nameEn').fill('AXA pilot')
    await field('nameAr').fill('أكسا التجربة')
    check(`${dir} 5. a store list moves an insurer master to the first tier`, (await thisOne()) === 'insurerStoreList')
    await save()
    check(`${dir} 5. insurer + store list created`, (await closed()) && writes()[1]?.body?.storeListId === 'SL-PILOT' && writes()[1]?.body?.payerCode === 'AXA', JSON.stringify(writes()[1]))
    const axaPilot = page.locator('[data-master="M-NEW-5"]')
    await axaPilot.waitFor({ timeout: 15000 }).catch(() => {})
    check(`${dir} 5. the scoped master shows its payer and list name`, JSON.stringify(await ltr(axaPilot, 'payer')) === '["AXA"]' && strip(await axaPilot.locator('[data-col="storeList"] bdi[data-store-list-id]').innerText()) === 'Pilot rollout')

    // a store master: list required; an overlap is refused naming the clash, the input kept
    await page.locator('[data-idf-master-new]').click()
    await dlg.waitFor()
    await dlg.locator('[data-kind-option="store"]').check()
    check(`${dir} 5. a store master has no payer field and sits on the store tier`, (await field('payerCode').count()) === 0 && (await thisOne()) === 'store')
    await field('nameEn').fill('Operation pharmacies two')
    await field('nameAr').fill('صيدليات التشغيل ٢')
    await save()
    check(`${dir} 5. a store master without a store list is refused before sending`, (await problems()) === 'storeListRequired' && writes().length === 2, await problems())
    await field('storeListId').selectOption('SL-OPS')
    await save()
    await refusal.waitFor({ timeout: 15000 }).catch(() => {})
    const refusalText = strip(await refusal.innerText().catch(() => ''))
    check(`${dir} 5. overlap refused: code, message, the clashing master named`, (await refusal.getAttribute('data-idf-master-refusal').catch(() => null)) === 'OVERLAPPING_SCOPE' && refusalText.includes('This scope overlaps the master "Operation pharmacies" (M-OPS).') && strip(await refusal.locator('[data-clashing-master="M-OPS"]').innerText()) === 'Clashes with Operation pharmacies (M-OPS)', refusalText)
    check(`${dir} 5. the clash is isolated: name in a bdi, id ltr`, strip(await refusal.locator('[data-clashing-master] bdi:not([dir])').innerText()) === 'Operation pharmacies' && strip(await refusal.locator('[data-clashing-master] bdi[dir="ltr"]').innerText()) === 'M-OPS')
    check(`${dir} 5. the dialog stays open with the input kept`, (await dlg.count()) === 1 && (await field('nameEn').inputValue()) === 'Operation pharmacies two' && (await field('storeListId').inputValue()) === 'SL-OPS')
    await field('storeListId').selectOption('SL-PILOT')
    await save()
    check(`${dir} 5. store master created on a free list`, (await closed()) && writes()[3]?.body?.kind === 'store' && writes()[3]?.body?.payerCode === null && writes()[3]?.body?.storeListId === 'SL-PILOT', JSON.stringify(writes()[3]))
    const opsTwo = page.locator('[data-master="M-NEW-6"][data-kind="store"]')
    await opsTwo.waitFor({ timeout: 15000 }).catch(() => {})
    check(`${dir} 5. the store master is in the list`, (await opsTwo.count()) === 1)

    // edit: prefilled, kind fixed, PUT
    await page.locator('[data-idf-master-edit="M-BUPA"]').click()
    await dlg.waitFor()
    check(`${dir} 5. Edit opens prefilled with the kind fixed`, (await dlg.getAttribute('data-idf-master-dialog')) === 'M-BUPA' && (await field('payerCode').inputValue()) === 'BUPA' && (await field('hard').inputValue()) === '5' && (await field('reminder').inputValue()) === '2' && (await dlg.locator('[data-kind-option="store"]').isDisabled()) && (await dlg.locator('[data-kind-fixed]').count()) === 1)
    await field('hard').fill('6')
    await save()
    check(`${dir} 5. edit sends a PUT to the master`, (await closed()) && writes()[4]?.method === 'PUT' && writes()[4]?.path === 'IdfPriority/masters/M-BUPA' && writes()[4]?.body?.hardThreshold === 6, JSON.stringify(writes()[4]))
    await page.waitForFunction(() => /6/.test(document.querySelector('[data-master="M-BUPA"] [data-col="thresholds"]')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {})
    check(`${dir} 5. the list re-reads the edited thresholds`, strip(await page.locator('[data-master="M-BUPA"] [data-col="thresholds"]').innerText()) === w.thr(6, 2))

    // an edit into an overlap is refused too
    await page.locator('[data-idf-master-edit="M-NEW-4"]').click()
    await dlg.waitFor()
    await field('payerCode').fill('BUPA')
    await save()
    await refusal.waitFor({ timeout: 15000 }).catch(() => {})
    check(`${dir} 5. an edit into an overlap names the clash, input kept`, (await refusal.locator('[data-clashing-master="M-BUPA"]').count()) === 1 && strip(await refusal.locator('[data-clashing-master]').innerText()) === 'Clashes with Bupa general (M-BUPA)' && (await field('payerCode').inputValue()) === 'BUPA')
    await page.keyboard.press('Escape')

    check(`${dir} 5. no raw keys`, await noRawKeys(page))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
