// Insurance rules ▸ IDF events drive (BackOffice spec 3157 / door 3167; oms ticket 626).
//
// Drives the REAL app in Chromium against a STUB of the events door (and 619's masters), on the REAL envelope.
// Fixtures and handlers are `tools/idf-stubs.mjs` (`// --- 626 ---`, `idfStub`):
//   GET IdfPriority/events → `IDF_EVENTS` (30 events, 25 a page), filtered by the stub as the door would
//   GET IdfPriority/masters → 619's `IDF_MASTERS` (the master filter's options and the rows' names)
// The stubs carry the shapes 3167 / 3169 built (oms 628): `{ page, pageSize, total, rows }`, `insurerCustomerId`,
// `alternativeTaken`, prices per base unit, the report's fixed counts and `totals`.
//
// It verifies, in LTR and RTL:
//   1. the IDF events leaf is in the rail and lit; 25 rows of 30, the total, the pager; the door asked only
//      from / to / page (empty fields dropped); machine values in `bdi[dir=ltr]`, master names in `bdi`;
//   2. the outcome filter offers the seven live outcomes (not the reserved two) and filters (address + door);
//   3. outcome AND master → nothing matches → the empty state; clearing the outcome lists the master's events;
//   4. page 2 holds the last 5; a filter change goes back to page 1;
//   5. a bare 403 is "You do not have access"; no raw keys; no page errors.
//   6. (627) the Swap report tab: the address says `tab=report`, the outcome filter is hidden, the door asked the
//      SHARED filter only (no outcome, no page); grouped rows master × store × payer with a count per outcome, the
//      money and the average time as `bdi[dir=ltr]`; Export asks `…/swap-report/export` with the same query and
//      saves the server's file; a master change re-asks both; back to the log; a bare 403 → no access.
// Stubs: `idfReportStub` (`// --- 627 ---`) — GET IdfPriority/swap-report and …/swap-report/export.
//
//   1. run the app:  npx vite --port 5206 --strictPort   (627 drove it on 5207: DRIVE_PORT=5207)
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
const noRawKeys = async (page) => !/insurance-(rules|idf):|events\.|report\.|menu\.idf|access\./.test(await page.locator('main').innerText())
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
const OUTCOME_WORDS = ['Reminder', 'Forced pick taken', 'Pick cancelled', 'Line abandoned', 'Skipped by exception', 'Refused (pre-authorisation)', 'Alternative taken']
const REPORT_COUNT_WORDS = ['Events', 'Reminders', 'Reminders: all candidates dearer', 'Forced picks taken', 'Alternatives taken', 'Picks cancelled', 'Lines abandoned', 'Skipped by exception', 'Refused (pre-authorisation)']

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
    check(`${dir} 1. a row: when (local), store + till, insurer customer id, document type, items`,
      JSON.stringify([...(await ltr(e1, 'at')), ...(await ltr(e1, 'store')), ...(await ltr(e1, 'payer')), ...(await ltr(e1, 'documentType')), ...(await ltr(e1, 'itemScanned')), ...(await ltr(e1, 'itemDispensed'))]) ===
        JSON.stringify(['2026-10-27 20:05', 'P001', '01', '0001100336', 'InsuranceOrder', '100201', '100901']),
      JSON.stringify(await ltr(e1, 'at')))
    check(`${dir} 1. a row: master by name in a bdi, its version, outcome word, time spent m:ss`,
      strip(await e1.locator('[data-col="master"] > span > bdi').first().innerText()) === 'Bupa general' &&
        strip(await e1.locator('[data-version]').innerText()) === 'version 3' &&
        strip(await e1.locator('[data-col="outcome"]').innerText()) === 'Forced pick taken' &&
        JSON.stringify(await ltr(e1, 'timeSpent')) === '["0:09"]' &&
        strip(await e1.locator('[data-col="source"]').innerText()) === 'Insurer' &&
        strip(await e1.locator('[data-col="decision"]').innerText()) === 'Forced pick' &&
        JSON.stringify([...(await ltr(e1, 'scannedPrice')), ...(await ltr(e1, 'dispensedPrice'))]) === '["13.500","11.250"]')
    const e13 = page.locator('[data-event="E-013"]')
    check(`${dir} 1. an alternative taken: its word, decision None`, strip(await e13.locator('[data-col="outcome"]').innerText()) === 'Alternative taken' && strip(await e13.locator('[data-col="decision"]').innerText()) === 'None')
    const e4 = page.locator('[data-event="E-004"]')
    check(`${dir} 1. a master not in the list shows its id; nothing dispensed is blank`,
      JSON.stringify(await ltr(e4, 'master')).includes('M-GONE') && strip(await e4.locator('[data-col="itemDispensed"]').innerText()) === '')

    // 2. the outcome filter
    const opts = await page.locator('[data-filter="outcome"] option').evaluateAll((els) => els.map((e) => e.textContent))
    check(`${dir} 2. outcome filter: any + the seven live outcomes, no reserved`, JSON.stringify(opts) === JSON.stringify(['Any outcome', ...OUTCOME_WORDS]), JSON.stringify(opts))
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
    // review fix: leaving an untouched store box (or pressing Enter in it) changes nothing — the page stays 2
    const readsBefore = reads.events?.length ?? 0
    await page.locator('[data-filter="store"]').focus()
    await page.locator('[data-filter="store"]').press('Enter')
    await page.locator('[data-filter="payer"]').focus()
    await page.locator('[data-filter="payer"]').blur()
    await page.waitForTimeout(400)
    check(`${dir} 4. an untouched store or payer box keeps page 2, no new read`, param(page, 'page') === '2' && (reads.events?.length ?? 0) === readsBefore, `${page.url()} ${readsBefore}→${reads.events?.length}`)
    before = await firstId(page)
    const urlWrites = []
    page.on('framenavigated', (f) => f === page.mainFrame() && urlWrites.push(f.url()))
    await page.locator('[data-filter="store"]').fill('P019')
    await page.locator('[data-filter="store"]').press('Enter')
    await settle(page, before)
    await page.waitForTimeout(300)
    check(`${dir} 4. Enter writes the typed store to the address once`, urlWrites.filter((u) => u.includes('store=P019')).length <= 1 && param(page, 'store') === 'P019', JSON.stringify(urlWrites))
    const stores = await attrs(page, 'data-event')
    check(`${dir} 4. a typed store filters and goes back to page 1`, param(page, 'page') === null && param(page, 'store') === 'P019' && lastRead(reads).store === 'P019' && lastRead(reads).page === '1' && stores.length === 15, `${page.url()} ${stores.length}`)

    check(`${dir} 5. no raw keys`, await noRawKeys(page))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    // 6. (627) the swap report tab
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/events?${WINDOW}&store=P019&outcome=pickCancelled`)
    await page.locator('[data-idf-events] tbody tr, [data-idf-events-empty]').first().waitFor({ timeout: 60000 })
    const tabs = await page.locator('[data-idf-events-tabs] [role="tab"]').evaluateAll((els) => els.map((e) => e.textContent))
    check(`${dir} 6. two tabs: Event log, Swap report`, JSON.stringify(tabs) === JSON.stringify(['Event log', 'Swap report']), JSON.stringify(tabs))
    await page.locator('[data-tab="report"]').click()
    await page.locator('[data-idf-report] tbody tr').first().waitFor({ timeout: 30000 })
    const rRows = page.locator('[data-idf-report] tbody tr')
    const lastQ = (k) => Object.fromEntries(new URLSearchParams(reads[k]?.at(-1) ?? ''))
    check(`${dir} 6. the address says tab=report; the report tab is selected`, param(page, 'tab') === 'report' && (await page.locator('[data-tab="report"]').getAttribute('aria-selected')) === 'true')
    check(`${dir} 6. the outcome filter is hidden on the report`, (await page.locator('[data-filter="outcome"]').count()) === 0 && (await page.locator('[data-filter="store"]').count()) === 1)
    check(`${dir} 6. the report door asked the shared filter only`, JSON.stringify(lastQ('report')) === JSON.stringify({ from: '2026-10-20', to: '2026-10-27', store: 'P019' }), JSON.stringify(lastQ('report')))
    const keys = await rRows.evaluateAll((els) => els.map((e) => e.getAttribute('data-row')))
    check(`${dir} 6. grouped rows master × store × payer`, JSON.stringify(keys) === JSON.stringify(['M-BUPA|P019|0001100336', 'M-OPS|P019|0001100412']), JSON.stringify(keys))
    const heads = await page.locator('[data-idf-report] thead th').evaluateAll((els) => els.map((e) => e.textContent))
    check(`${dir} 6. columns: master, store, insurer, the door's nine counts, price difference per base unit, average time`,
      JSON.stringify(heads) === JSON.stringify(['Master', 'Store', 'Insurer customer id', ...REPORT_COUNT_WORDS, 'Price difference on picks taken (per base unit)', 'Average time']), JSON.stringify(heads))
    const r1 = page.locator('[data-row="M-BUPA|P019|0001100336"]')
    const cells = async (row) => JSON.stringify(await row.locator('td').evaluateAll((els) => els.slice(1).map((e) => e.querySelector('bdi[dir="ltr"]')?.textContent ?? '')))
    check(`${dir} 6. a row: master by name in a bdi`, strip(await r1.locator('[data-col="master"] bdi').innerText()) === 'Bupa general' && (await r1.locator('[data-col="master"] bdi[dir="ltr"]').count()) === 0)
    check(`${dir} 6. a row: store, insurer, counts (0 when none), money (3 dp), average m:ss — each isolated LTR`,
      (await cells(r1)) === JSON.stringify(['P019', '0001100336', '3', '0', '0', '2', '0', '0', '1', '0', '0', '-12.250', '1:11']), await cells(r1))
    const tot = page.locator('[data-idf-report] tfoot [data-row="total"]')
    check(`${dir} 6. the door's totals row`, strip(await tot.locator('[data-col="master"]').innerText()) === 'Total' && JSON.stringify(await ltr(tot, 'count-events')) === '["9"]', JSON.stringify(await ltr(tot, 'count-events')))
    const total = strip(await page.locator('[data-idf-report-total]').innerText())
    check(`${dir} 6. the group count`, total === 'Groups: 2', total)

    // Export: the same query, the server's file saved under its own name
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('[data-idf-report-export]').click()])
    check(`${dir} 6. export asked …/swap-report/export with the report's query`, (reads.export?.length ?? 0) === 1 && reads.export.at(-1) === reads.report.at(-1), JSON.stringify(reads.export))
    const saved = await download.path().catch(() => null)
    check(`${dir} 6. export saved the server's file under its name`, download.suggestedFilename() === 'idf-swap-report.xlsx' && !!saved, download.suggestedFilename())

    // a filter change re-asks the report; the export follows it
    await page.locator('[data-filter="master"]').selectOption('M-OPS')
    await page.waitForFunction(() => document.querySelectorAll('[data-idf-report] tbody tr').length === 1, null, { timeout: 30000 }).catch(() => {})
    check(`${dir} 6. master filter: the door carries masterId; one group`, lastQ('report').masterId === 'M-OPS' && (await rRows.count()) === 1 && param(page, 'tab') === 'report')
    const r2 = page.locator('[data-row="M-OPS|P019|0001100412"]')
    check(`${dir} 6. no pick taken → zero money; 9400 ms → 0:09`, (await cells(r2)) === JSON.stringify(['P019', '0001100412', '6', '3', '0', '0', '0', '0', '0', '2', '1', '0.000', '0:09']), await cells(r2))
    await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('[data-idf-report-export]').click()])
    check(`${dir} 6. the second export carries the new filter`, lastQ('export').masterId === 'M-OPS' && reads.export.at(-1) === reads.report.at(-1), JSON.stringify(lastQ('export')))

    // back to the log: the outcome filter returns, still set from the address
    await page.locator('[data-tab="events"]').click()
    await rows(page).first().waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 6. back to the log: tab leaves the address, the outcome filter is back`,
      param(page, 'tab') === null && (await page.locator('[data-filter="outcome"]').inputValue()) === 'pickCancelled' && (await page.locator('[data-idf-report]').count()) === 0)
    check(`${dir} 6. no raw keys (report)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (report)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['report'] })
    await page.goto(`${BASE}/insurance-rules/idf/events?tab=report`)
    await page.locator('[data-idf-report-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 6. report: a bare 403 → "You do not have access"`, (await page.locator('[data-idf-report-denied]').count()) === 1 && (await page.locator('[data-idf-report]').count()) === 0)
    check(`${dir} 6. no page errors (report denied)`, errors.length === 0, errors.join(' | '))
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
