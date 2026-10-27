// Insurance rules ▸ IDF events drive (BackOffice spec 3157 / door 3167; oms ticket 626).
//
// Drives the REAL app in Chromium against a STUB of the events door (and 619's masters), on the REAL envelope.
// Fixtures and handlers are `tools/idf-stubs.mjs` (`// --- 626 ---`, `idfStub`):
//   GET IdfPriority/events → `IDF_EVENTS` (30 events, 25 a page), filtered by the stub as the door would
//   GET IdfPriority/masters → 619's `IDF_MASTERS` (the master filter's options and the rows' names)
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3167 is unbuilt. Ticket 628 swaps in the doors.
//
// It verifies, in LTR and RTL:
//   1. the IDF events leaf is in the rail and lit; 25 rows of 30, the total, the pager; the door asked only
//      from / to / page (empty fields dropped); machine values in `bdi[dir=ltr]`, master names in `bdi`;
//   2. the outcome filter offers the six live outcomes (not the reserved two) and filters (address + door);
//   3. outcome AND master → nothing matches → the empty state; clearing the outcome lists the master's events;
//   4. page 2 holds the last 5; a filter change goes back to page 1;
//   5. a bare 403 is "You do not have access"; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5206 --strictPort
//   2. node tools/idf-events-drive.mjs        (DRIVE_PORT overrides 5206)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5206}`
const WINDOW = 'from=2026-10-20&to=2026-10-27'

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
    const hit = idfStub(req.method(), p + url.search, req.postDataJSON?.() ?? null, { state, deny, reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|events\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (row, col) => row.locator(`[data-col="${col}"] bdi[dir="ltr"]`).evaluateAll((els) => els.map((e) => e.textContent))
const rows = (page) => page.locator('[data-idf-events] tbody tr')
const ids = (page) => rows(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-event')))
const attrs = (page, a) => rows(page).evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), a)
const lastRead = (reads) => Object.fromEntries(new URLSearchParams(reads.events?.at(-1) ?? ''))
const param = (page, k) => new URL(page.url()).searchParams.get(k)
/** Wait until the rows' first id (or the empty state) changes from `before`. */
async function settle(page, before) {
  await page.waitForFunction(
    (b) => (document.querySelector('[data-idf-events] tbody tr')?.getAttribute('data-event') ?? (document.querySelector('[data-idf-events-empty]') ? 'EMPTY' : null)) !== b,
    before,
    { timeout: 30000 },
  ).catch(() => {})
}
const firstId = async (page) => ((await page.locator('[data-idf-events-empty]').count()) ? 'EMPTY' : await rows(page).first().getAttribute('data-event'))

// The app's `lng` stays `en` (Arabic not switched on); `oms.locale=ar` mirrors the page only — the house pattern.
// The Arabic words are proven by `events.test.ts`.
const OUTCOME_WORDS = ['Reminder', 'Forced pick taken', 'Pick cancelled', 'Line abandoned', 'Skipped by exception', 'Refused (pre-authorisation)']

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/events?${WINDOW}`)
    await rows(page).first().waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator('a[href="/insurance-rules/idf/events"]')
    check(`${dir} 1. the rail has the IDF events leaf, lit`, (await leaf.count()) >= 1 && (await leaf.first().getAttribute('aria-current')) === 'page')
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'IDF events')
    check(`${dir} 1. 25 rows of 30, newest first`, (await rows(page).count()) === 25 && (await ids(page))[0] === 'E-001')
    check(`${dir} 1. the total, isolated`, strip(await page.locator('[data-idf-events-total]').innerText()) === 'Events found: 30' && (await page.locator('[data-idf-events-total] bdi[dir="ltr"]').count()) === 1)
    check(`${dir} 1. the pager`, (await page.locator('nav[aria-label="Result pages"]').count()) === 1)
    check(`${dir} 1. the door asked from / to / page only`, JSON.stringify(lastRead(reads)) === JSON.stringify({ from: '2026-10-20', to: '2026-10-27', page: '1' }), JSON.stringify(lastRead(reads)))

    const e1 = page.locator('[data-event="E-001"]')
    check(`${dir} 1. a row: when (local), store, payer, document type, items`,
      JSON.stringify([...(await ltr(e1, 'at')), ...(await ltr(e1, 'store')), ...(await ltr(e1, 'payer')), ...(await ltr(e1, 'documentType')), ...(await ltr(e1, 'itemScanned')), ...(await ltr(e1, 'itemDispensed'))]) ===
        JSON.stringify(['2026-10-27 20:05', 'P001', 'BUPA', 'ZINS', '100201', '100901']),
      JSON.stringify(await ltr(e1, 'at')))
    check(`${dir} 1. a row: master by name in a bdi, its version, outcome word, time spent m:ss`,
      strip(await e1.locator('[data-col="master"] > span > bdi').first().innerText()) === 'Bupa general' &&
        strip(await e1.locator('[data-version]').innerText()) === 'version 3' &&
        strip(await e1.locator('[data-col="outcome"]').innerText()) === 'Forced pick taken' &&
        JSON.stringify(await ltr(e1, 'timeSpent')) === '["0:09"]')
    const e4 = page.locator('[data-event="E-004"]')
    check(`${dir} 1. a master not in the list shows its id; nothing dispensed is blank`,
      JSON.stringify(await ltr(e4, 'master')).includes('M-GONE') && strip(await e4.locator('[data-col="itemDispensed"]').innerText()) === '')

    // 2. the outcome filter
    const opts = await page.locator('[data-filter="outcome"] option').evaluateAll((els) => els.map((e) => e.textContent))
    check(`${dir} 2. outcome filter: any + the six live outcomes, no reserved`, JSON.stringify(opts) === JSON.stringify(['Any outcome', ...OUTCOME_WORDS]), JSON.stringify(opts))
    const masterOpts = await page.locator('[data-filter="master"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 2. master filter: any + 619's masters`, JSON.stringify(masterOpts) === JSON.stringify(['', 'M-BUPA', 'M-TAW-PILOT', 'M-OPS']), JSON.stringify(masterOpts))
    let before = await firstId(page)
    await page.locator('[data-filter="outcome"]').selectOption('pickCancelled')
    await settle(page, before)
    check(`${dir} 2. by outcome: the address and the door carry it`, param(page, 'outcome') === 'pickCancelled' && lastRead(reads).outcome === 'pickCancelled')
    const outs = await attrs(page, 'data-outcome')
    check(`${dir} 2. by outcome: only those rows, no pager`, outs.length === 5 && outs.every((o) => o === 'pickCancelled') && (await page.locator('nav[aria-label="Result pages"]').count()) === 0, JSON.stringify(outs))

    // 3. outcome AND master → empty; clear the outcome
    before = await firstId(page)
    await page.locator('[data-filter="master"]').selectOption('M-OPS')
    await settle(page, before)
    check(`${dir} 3. outcome + master: the door carries masterId`, lastRead(reads).masterId === 'M-OPS' && lastRead(reads).outcome === 'pickCancelled' && param(page, 'master') === 'M-OPS')
    check(`${dir} 3. nothing matches → the empty state`, (await page.locator('[data-idf-events-empty]').count()) === 1 && strip(await page.locator('[data-idf-events-empty]').innerText()) === 'No IDF events match these filters.')
    before = 'EMPTY'
    await page.locator('[data-filter="outcome"]').selectOption('')
    await settle(page, before)
    const ms = await attrs(page, 'data-master')
    check(`${dir} 3. the master's events, by name`, ms.length === 8 && ms.every((m) => m === 'M-OPS') && strip(await rows(page).first().locator('[data-col="master"] bdi').first().innerText()) === 'Operation pharmacies' && param(page, 'outcome') === null, JSON.stringify(ms))

    // 4. page 2, and a filter change goes back to page 1
    before = await firstId(page)
    await page.locator('[data-filter="master"]').selectOption('')
    await settle(page, before)
    before = await firstId(page)
    await page.locator('nav[aria-label="Result pages"] button').last().click()
    await settle(page, before)
    check(`${dir} 4. page 2: the last five, the address and the door say page 2`,
      JSON.stringify(await ids(page)) === JSON.stringify(['E-026', 'E-027', 'E-028', 'E-029', 'E-030']) && param(page, 'page') === '2' && lastRead(reads).page === '2',
      JSON.stringify(await ids(page)))
    check(`${dir} 4. page 2 reads "Page 2 of 2"`, strip(await page.locator('nav[aria-label="Result pages"] span').innerText()) === 'Page 2 of 2')
    before = await firstId(page)
    await page.locator('[data-filter="store"]').fill('P019')
    await page.locator('[data-filter="store"]').press('Enter')
    await settle(page, before)
    const stores = await attrs(page, 'data-event')
    check(`${dir} 4. a typed store filters and goes back to page 1`, param(page, 'page') === null && param(page, 'store') === 'P019' && lastRead(reads).store === 'P019' && lastRead(reads).page === '1' && stores.length === 15, `${page.url()} ${stores.length}`)

    check(`${dir} 5. no raw keys`, await noRawKeys(page))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['events'] })
    await page.goto(`${BASE}/insurance-rules/idf/events`)
    await page.locator('[data-idf-events-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 5. a bare 403 → "You do not have access", never an empty log`, (await page.locator('[data-idf-events-denied]').count()) === 1 && strip(await page.locator('[data-idf-events-denied]').innerText()).startsWith('You do not have access') && (await page.locator('[data-idf-events], [data-idf-events-empty]').count()) === 0)
    check(`${dir} 5. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
