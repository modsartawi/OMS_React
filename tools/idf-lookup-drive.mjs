// Insurance rules ▸ IDF lookup drive (BackOffice spec 3157 / door 3168; oms ticket 625).
//
// Drives the REAL app in Chromium against a STUB of the lookup door, on the REAL envelope. Fixtures and the handler
// are `tools/idf-stubs.mjs` (`// --- 625 ---`, `idfLookupStub`; the deciding master is named through 619's masters
// door, `IDF_MASTER_TAW` added to its state):
//   GET IdfPriority/lookup → `IDF_LOOKUPS` (an insurer-decided answer; a general fallback with three skipped tiers
//   and the cash rule, no insurer); any other item → a business refusal (`IDF-00019`)
// The stubs carry the shapes 3168 / 3166 built (oms 628): payer = the insurer customer id, the door's tier words.
//
// It verifies, in LTR and RTL:
//   1. the IDF lookup leaf is in the rail and lit; before a search the page asks for one and reads no door;
//   2. a search typed in the form lands in the URL and is sent to the door (no blank document type);
//   3. an insurer-decided answer: tier, named master, kind, version number, priority, thresholds, one skipped tier
//      with its reason, the ranked group with source tiers, the looked-up row marked, values isolated;
//   4. a shared URL with a general fallback: three skipped tiers in the fixed order, 4 / 1, the cash rule shown;
//   5. a business refusal (unknown item) shows the server's message; a bare 403 is "You do not have access";
//   6. no raw keys, no page errors.
//
//   1. run the app:  npx vite --port 5205 --strictPort
//   2. node tools/idf-lookup-drive.mjs        (DRIVE_PORT overrides 5205)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState, IDF_MASTER_TAW } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5205}`

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
  const lookups = []
  const state = newIdfState()
  state.masters.push(structuredClone(IDF_MASTER_TAW))
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
    const hit = idfStub(req.method(), p + url.search, req.postDataJSON?.() ?? null, { state, deny, reads, lookups })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, lookups }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|lookup\.|masters\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltrIn = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
const text = async (loc) => strip(await loc.innerText())

// The app's `lng` stays `en` (Arabic not switched on): the RTL pass reads English words in a mirrored page (619's
// house pattern); the Arabic bundle and Arabic reasons / descriptions are proven by the pure tests.
for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads, lookups } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/lookup`)
    await page.locator('[data-idf-lookup-hint]').waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator('a[href="/insurance-rules/idf/lookup"]')
    check(`${dir} 1. the rail has the IDF lookup leaf, lit`, (await leaf.count()) >= 1 && (await leaf.first().getAttribute('aria-current')) === 'page')
    check(`${dir} 1. the title`, (await text(page.locator('h1').first())) === 'IDF lookup')
    check(`${dir} 1. before a search: a hint, no door read`, !reads.lookup, JSON.stringify(reads))

    await page.fill('[data-lookup-field="item"]', ' 100300 ')
    await page.fill('[data-lookup-field="store"]', 'P019')
    await page.fill('[data-lookup-field="payer"]', '0001100412')
    await page.click('[data-lookup-submit]')
    await page.locator('[data-idf-lookup-answer]').waitFor({ timeout: 60000 })
    const u = new URL(page.url())
    check(`${dir} 2. the search lands in the URL`, u.pathname === '/insurance-rules/idf/lookup' && u.search === '?item=100300&store=P019&payer=0001100412', u.search)
    check(`${dir} 2. sent to the door, no blank document type`, lookups.length >= 1 && lookups.every((q) => q === 'item=100300&store=P019&payer=0001100412'), JSON.stringify(lookups))

    const ans = page.locator('[data-idf-lookup-answer]')
    const dec = page.locator('[data-lookup-decision]')
    check(`${dir} 3. deciding tier: insurer`, (await ans.getAttribute('data-deciding-tier')) === 'insurer' && (await text(dec.locator('[data-col="tier"]'))) === 'Insurer')
    check(`${dir} 3. the master named in a bdi, its kind`, (await text(dec.locator('[data-col="master"] bdi'))) === 'Tawuniya general' && (await text(dec.locator('[data-col="kind"]'))) === 'Insurer')
    check(`${dir} 3. the live version's number, ltr`, (await text(dec.locator('[data-col="version"]'))) === 'version 2' && JSON.stringify(await ltrIn(dec.locator('[data-col="version"]'))) === '["2"]')
    check(`${dir} 3. priority and "hard above 5, reminder above 2"`, (await text(dec.locator('[data-col="priority"]'))) === 'Priority 2' && (await text(dec.locator('[data-col="thresholds"]'))) === 'Hard above 5, reminder above 2' && JSON.stringify(await ltrIn(dec.locator('[data-col="thresholds"]'))) === '["5","2"]')
    check(`${dir} 3. no cash line when the answer does not carry it`, (await page.locator('[data-lookup-cash]').count()) === 0)
    const skipped = await page.locator('[data-lookup-skipped] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-tier')))
    check(`${dir} 3. one skipped tier with its reason in a bdi`, JSON.stringify(skipped) === '["insurerAtStoreList"]' && (await text(page.locator('[data-lookup-skipped] li [data-col="reason"] bdi'))) === 'Store P019 is not on the pilot list' && (await text(page.locator('[data-lookup-skipped] li [data-col="tier"]'))) === 'Insurer on a store list')
    const rows = await page.locator('[data-lookup-group] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-item')}:${e.hasAttribute('data-looked-up')}:${e.querySelector('[data-col="sourceTier"]').textContent}`))
    check(`${dir} 3. the ranked group as sent, source tiers, the looked-up row marked`, JSON.stringify(rows) === JSON.stringify(['100200:false:Insurer', '100300:true:Insurer', '100400:false:General']), JSON.stringify(rows))
    const mine = page.locator('[data-lookup-group] tr[data-looked-up]')
    check(`${dir} 3. the marked row: item and priority ltr, description bdi, "Looked up"`, JSON.stringify(await ltrIn(mine)) === '["100300","2"]' && (await text(mine.locator('[data-col="description"] bdi'))) === 'Adol 500 mg' && (await text(mine.locator('[data-col="item"]'))).endsWith('Looked up'), JSON.stringify(await ltrIn(mine)))
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // a shared link: the general fallback
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/lookup?item=200100&store=P001&documentType=Cash`)
    await page.locator('[data-idf-lookup-answer]').waitFor({ timeout: 60000 }).catch(() => {})
    const ans = page.locator('[data-idf-lookup-answer]')
    check(`${dir} 4. a shared URL fills the form`, (await page.inputValue('[data-lookup-field="documentType"]')) === 'Cash' && (await page.inputValue('[data-lookup-field="item"]')) === '200100')
    check(`${dir} 4. general decided, no master named`, (await ans.getAttribute('data-deciding-tier')) === 'general' && (await page.locator('[data-lookup-decision] [data-col="general"]').count()) === 1 && (await page.locator('[data-lookup-decision] [data-col="master"]').count()) === 0)
    const skipped = await page.locator('[data-lookup-skipped] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-tier')))
    check(`${dir} 4. three skipped tiers in the fixed order (no insurer: the payer is optional)`, JSON.stringify(skipped) === '["insurerAtStoreList","insurer","store"]', JSON.stringify(skipped))
    check(`${dir} 4. thresholds 4 and 1`, (await text(page.locator('[data-lookup-decision] [data-col="thresholds"]'))) === 'Hard above 4, reminder above 1')
    check(`${dir} 4. a cash document type cannot force a pick → the cash rule shown`, (await page.locator('[data-lookup-cash]').count()) === 1)
    const rows = await page.locator('[data-lookup-group] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-item')}:${e.hasAttribute('data-looked-up')}`))
    check(`${dir} 4. the looked-up row marked`, JSON.stringify(rows) === '["200050:false","200100:true"]', JSON.stringify(rows))
    check(`${dir} 4. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/lookup?item=999999&store=P019&payer=0001100412`)
    await page.locator('[data-idf-lookup-error]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 5. an unknown item: the server's message, no answer`, (await text(page.locator('[data-idf-lookup-error]'))).includes('Item 999999 is not a known item.') && (await page.locator('[data-idf-lookup-answer]').count()) === 0)
    check(`${dir} 5. no page errors (refusal)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['lookup'] })
    await page.goto(`${BASE}/insurance-rules/idf/lookup?item=100300&store=P019&payer=0001100412`)
    await page.locator('[data-idf-lookup-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 5. a bare 403 → "You do not have access"`, (await page.locator('[data-idf-lookup-denied]').count()) === 1 && (await text(page.locator('[data-idf-lookup-denied]'))).startsWith('You do not have access') && (await page.locator('[data-idf-lookup-answer]').count()) === 0)
    check(`${dir} 5. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
