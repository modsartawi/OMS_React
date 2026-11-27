// Store record list and kept runs drive (ticket 969, BackOffice spec 4354 §6, §12, §14, §19) — open the list, keep a
// run, open it by its link.
//
// Drives the REAL app against STUBS of doors BackOffice has not built (4373, the store record's read door; 4380, keep,
// list, open and delete). Neither ticket names a path or a field, so the stubs serve the app's PROVISIONAL shapes
// (`src/core/models/sourcing-store-record.ts`, the kept-run types in `src/core/models/sourcing-run.ts`) with the
// fixtures the model tests read:
//   GET    Auth/Permissions                → the run grant `SourcingAdvisorRun:06` (PROVISIONAL key) held or not
//   GET    SourcingAdvisor/StoreRecord     → `src/features/oms/sourcing-record/store-record.fixture.json`, or not built
//   POST   SourcingAdvisor/Advise          → the simulator's `advise-reply.fixture.json` (a held run)
//   POST   SourcingAdvisor/Runs/Keep       → the run kept under its name
//   GET    SourcingAdvisor/Runs/Kept       → `kept-runs.fixture.json` (one of them another keeper's) + the runs kept here
//   DELETE SourcingAdvisor/Runs/Kept       → the run gone from the list
//   GET    SourcingAdvisor/Runs/Open       → a stored run (its record the advise or replay fixture), or ADVISE-404
// Left to right and right to left (`oms.locale = 'ar'` sets dir="rtl"; the app's words stay English, as on every
// screen, so the RTL pass proves the mirroring and the isolation), it asserts:
//   1. without the run grant: no "Store record" leaf and the denied card;
//   2. the list: "how deliveries go at each store", built when, a tab per mode (slot delivery first), the counted-from
//      date, the channels each measure counts and the like-store rates said once per mode; a row per store with the
//      rate, like stores, deliveries behind it and cost or credit as sent; the neutral-default mark; the usual slot,
//      regular hours and till moves; "shown, not charged"; pick-up's "Ready after 30 minutes" counts the app and the
//      site only; Dawaa Now counts from 2026-11-02; the carrier modes keep no record; never "fault", "performance" or
//      "rating"; figures are LTR isolates; a record never built says so;
//   3. keep a run: the simulator runs a cart; "Keep and name this run" needs a name, then posts the run's number and
//      the name; the strip says it is kept and offers its link; the kept runs list shows the caller's own runs only,
//      newest first, the new one on top; deleting one's own asks first, then sends its number and drops it;
//   4. open it by its link: the list's "Open in the simulator" goes to `/oms/sourcing-simulator?run=<id>`, which asks
//      the stored-run read door (never the advise door), shows the stored plans with the run's name, keeper and engine,
//      sets its order back on the left and offers no keep; another keeper's hand-built run says a newer engine answers
//      differently and sets its cart back without the customer's point; a deleted run's link says it is not there;
//   5. no page errors.
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/sourcing-record-drive.mjs
//      (PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
const SHOTS = 'tools/.sourcing-record-shots'
mkdirSync(SHOTS, { recursive: true })

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const RECORD = json('../src/features/oms/sourcing-record/store-record.fixture.json')
const REPLY = json('../src/features/oms/sourcing-simulator/advise-reply.fixture.json')
const REPLAY = json('../src/features/oms/sourcing-simulator/replay-reply.fixture.json')
const KEPT = json('../src/features/oms/sourcing-simulator/kept-runs.fixture.json')
const RUN_GRANT = 'SourcingAdvisorRun:06'
const MALQA = '01JDQ7M4X9T2B6N8R3K5W1C0VA' // mine, a replay
const OMAR = '01JDN5R2V7K9P4T6A8G1J3S0WC' // another keeper's, hand-built
const DELETED = '01JD00DELETEDRUN0000000000'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: message }] : [], data }),
})
const text = async (locator) => ((await locator.textContent()) ?? '').replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
const isLtrIsolate = (locator) => locator.evaluate((el) => el.tagName === 'BDI' && el.getAttribute('dir') === 'ltr')
/** Whether a text reads left to right on screen: its first character's box starts left of its last's. */
const readsLtr = (locator) =>
  locator.evaluate((el) => {
    const t = el.textContent.trim()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = null
    let at = -1
    while (walker.nextNode()) {
      const i = walker.currentNode.textContent.indexOf(t)
      if (i >= 0) {
        node = walker.currentNode
        at = i
        break
      }
    }
    if (!node) return null
    const box = (k) => {
      const r = document.createRange()
      r.setStart(node, k)
      r.setEnd(node, k + 1)
      return r.getBoundingClientRect()
    }
    return box(at).left < box(at + t.length - 1).left
  })

/** The stored run the read door gives for a kept run: its record is the fixture's, under the run's number. */
const storedOf = (runId, kept) => {
  const run = kept.find((r) => r.runId === runId)
  if (!run) return null
  const base = run.orderNumber ? REPLAY : REPLY
  const record = { ...structuredClone(base), runId, ranAt: run.ranAt, engine: { name: 'plain-search', version: run.engine }, held: null }
  return { state: 'KEPT', kept: run, record, engineNow: run.engine === '2.3.1' ? null : '2.3.1' }
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})

async function open(dir, { granted = true, built = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4|5)\d\d|Failed to load resource/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  const wire = { calls: [], keeps: [], deletes: [], opens: [], advises: [], kept: structuredClone(KEPT) }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    const method = route.request().method()
    wire.calls.push(`${method} ${p}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', ...(granted ? [RUN_GRANT] : [])]))
    if (p === 'SourcingAdvisor/StoreRecord') return route.fulfill(envelope(built ? RECORD : { builtAt: null, windowFrom: null, windowTo: null, pairs: [], shown: [] }))
    if (p === 'SourcingAdvisor/Workbench') return route.fulfill(envelope({ maps: null }))
    if (p === 'SourcingAdvisor/WeightSets') return route.fulfill(envelope([]))
    if (p === 'SourcingAdvisor/Advise') {
      wire.advises.push(JSON.parse(route.request().postData() || '{}'))
      return route.fulfill(envelope(REPLY))
    }
    if (p === 'SourcingAdvisor/Runs/Keep') {
      const body = JSON.parse(route.request().postData() || '{}')
      wire.keeps.push(body)
      const run = {
        runId: body.runId,
        name: body.name,
        keptBy: 'msartawi',
        mine: true,
        keptAt: '2026-11-27 10:15:02',
        ranAt: REPLY.ranAt,
        kind: REPLY.kind,
        channel: REPLY.channel,
        orderNumber: null,
        weightSet: { name: 'Baseline', version: 1, draft: false },
        engine: REPLY.engine.version,
      }
      wire.kept.push(run)
      return route.fulfill(envelope(run))
    }
    if (p === 'SourcingAdvisor/Runs/Kept' && method === 'GET') return route.fulfill(envelope(wire.kept))
    if (p === 'SourcingAdvisor/Runs/Kept' && method === 'DELETE') {
      const runId = url.searchParams.get('runId')
      wire.deletes.push(runId)
      wire.kept = wire.kept.filter((r) => r.runId !== runId)
      return route.fulfill(envelope(null))
    }
    if (p === 'SourcingAdvisor/Runs/Open') {
      const runId = url.searchParams.get('runId')
      wire.opens.push(runId)
      const stored = storedOf(runId, wire.kept)
      return route.fulfill(stored ? envelope(stored) : envelope(null, { status: 404, success: false, message: 'The run is not found.', errorCode: 'ADVISE-404' }))
    }
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, wire }
}

async function recordDrive(dir) {
  const L = dir === 'rtl' ? 'RTL' : 'LTR'

  // 1. without the run grant
  if (dir === 'ltr') {
    const { context, page } = await open(dir, { granted: false })
    await page.goto(`${BASE}/oms/sourcing-record`)
    await page.getByRole('alert').first().waitFor({ timeout: 15000 })
    check(`${L} without the run grant the store record says no access`, /No access to the store record/.test(await page.getByRole('alert').first().innerText()))
    check(`${L} without the run grant there is no "Store record" leaf`, (await page.locator('a[href="/oms/sourcing-record"]').count()) === 0)
    await context.close()
  }

  // 2. the list
  const { context, page, errors, wire } = await open(dir)
  await page.goto(`${BASE}/oms/sourcing-record`)
  await page.locator('[data-mode-board="SLOT"]').waitFor({ timeout: 15000 })
  check(`${L} the run grant shows the "Store record" leaf`, (await page.locator('a[href="/oms/sourcing-record"]').count()) > 0)
  check(`${L} the record is read from its door`, wire.calls.includes('GET SourcingAdvisor/StoreRecord'))
  check(`${L} the page says how deliveries go at each store`, (await text(page.locator("main h1").first())) === "How deliveries go at each store")
  check(`${L} it says when the record was built`, (await page.locator('[data-record-built]').getAttribute('data-record-built')) === '2026-11-27 02:14:09')
  const tabs = await page.locator('[data-mode-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-mode-tab')))
  check(`${L} a tab per mode, slot delivery open first`, JSON.stringify(tabs) === JSON.stringify(['SLOT', 'PICK_UP', 'DAWAA_NOW', 'CARRIERS']) && (await page.locator('[data-mode-tab="SLOT"]').getAttribute('aria-selected')) === 'true', tabs.join(','))
  const slot = page.locator('[data-mode-board="SLOT"]')
  check(`${L} the counted-from date said once for the mode`, (await slot.locator('[data-counted-from]').getAttribute('data-counted-from')) === '2026-08-29' && (await slot.locator('[data-counted-from]').count()) === 1)
  check(`${L} "late" counts the app, the site and the call centre`, (await slot.locator('[data-measure-channels="late"] [data-channels]').getAttribute('data-channels')) === 'APP SITE CALL_CENTRE')
  const like300 = await text(slot.locator('[data-like-stores] [data-band="FROM_300"]'))
  check(`${L} the like-store rates per band said once: 300 or more, late 3.8%`, like300.includes('300 deliveries or more') && like300.includes('3.8%') && like300.includes('1.2%') && like300.includes('2.4%'), like300)
  const p901 = slot.locator('[data-store-row="P901"]')
  const late901 = await text(p901.locator('[data-measure-cell="late"]'))
  const row901 = await text(p901)
  check(`${L} P901's late: steadied 3.1% beside like stores 3.8%`, late901 === '3.1%3.8%' && (await p901.locator('[data-measure-cell="late"] b').innerText()) === '3.1%', late901)
  check(`${L} the deliveries behind it and the cost or credit, as sent`, row901.includes('19 / 612') && row901.includes('SAR -0.063') && row901.includes('credit') && row901.includes('SAR -0.287'), row901)
  check(`${L} the usual slot, the regular hours and the till moves`, row901.includes('10:00–12:00') && row901.includes('58.0%') && row901.includes('52.0%'), row901)
  check(`${L} shown, not charged: last count, count factor, a donor's refusals`, row901.includes('2026-10-14') && row901.includes('1.08'), row901)
  const p911 = slot.locator('[data-store-row="P911"]')
  check(
    `${L} a store with no slot deliveries runs on the neutral default, marked with why`,
    (await p911.locator('[data-neutral="NO_DELIVERIES"]').count()) === 3 && (await p911.getAttribute('data-row-neutral')) === '' && (await text(p911.locator('[data-neutral]').first())).includes('neutral default'),
  )
  check(`${L} a store pair is one LTR isolate`, await isLtrIsolate(p901.locator('td').first().locator('bdi').first()))
  check(`${L} a range of slot hours reads left to right`, await readsLtr(p901.locator('[data-slot-hours] bdi').first()))
  check(`${L} a count of bad endings reads left to right`, await readsLtr(p901.locator('[data-measure-cell="late"] + td bdi').first()))
  if (dir === 'rtl') check(`${L} the page runs right to left`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  await page.screenshot({ path: `${SHOTS}/${dir}-slot.png`, fullPage: true })

  await page.locator('[data-mode-tab="PICK_UP"]').click()
  const pickUp = page.locator('[data-mode-board="PICK_UP"]')
  await pickUp.waitFor({ timeout: 5000 })
  check(`${L} the tab is kept in the URL`, page.url().includes('mode=PICK_UP'), page.url())
  check(
    `${L} pick-up's "Ready after 30 minutes" counts the app and the site only`,
    (await text(pickUp.locator('[data-measure-channels="readyLate"]'))).startsWith('Ready after 30 minutes') && (await pickUp.locator('[data-measure-channels="readyLate"] [data-channels]').getAttribute('data-channels')) === 'APP SITE',
  )
  await page.locator('[data-mode-tab="DAWAA_NOW"]').click()
  const dn = page.locator('[data-mode-board="DAWAA_NOW"]')
  await dn.waitFor({ timeout: 5000 })
  check(`${L} Dawaa Now counts from 2026-11-02`, (await dn.locator('[data-counted-from]').getAttribute('data-counted-from')) === '2026-11-02')
  check(`${L} Dawaa Now's one measure: callout ignored`, (await dn.locator('[data-measure-channels]').count()) === 1 && (await text(dn.locator('[data-measure-channels]'))).startsWith('Callout ignored'))
  await page.locator('[data-mode-tab="CARRIERS"]').click()
  const carriers = page.locator('[data-mode-board="CARRIERS"]')
  await carriers.waitFor({ timeout: 5000 })
  check(`${L} the carrier modes keep no record: six pairs on the neutral default`, (await carriers.locator('[data-carrier-pair]').count()) === 6 && (await carriers.locator('[data-neutral="NO_RECORD"]').count()) === 6)
  for (const tab of ['SLOT', 'PICK_UP', 'DAWAA_NOW']) {
    await page.locator(`[data-mode-tab="${tab}"]`).click()
    await page.locator(`[data-mode-board="${tab}"]`).waitFor({ timeout: 5000 })
    const words = (await page.locator('main').innerText()).toLowerCase()
    check(`${L} ${tab}: never "fault", "performance" or "rating"`, !/\bfault|performance|rating\b/.test(words))
  }
  check(`${L} no raw locale keys`, !/sourcing-record:|\b(col|shared|measure|neutral)\.[a-zA-Z]+\b/.test(await page.locator('main').innerText()))
  check(`${L} the store record: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  if (dir === 'ltr') {
    const notBuilt = await open(dir, { built: false })
    await notBuilt.page.goto(`${BASE}/oms/sourcing-record`)
    await notBuilt.page.locator('[data-record-not-built]').waitFor({ timeout: 15000 })
    check(`${L} a record the nightly pass never built says so`, /has not been built yet/.test(await notBuilt.page.locator('[data-record-not-built]').innerText()))
    await notBuilt.context.close()
  }
}

async function keptDrive(dir) {
  const L = dir === 'rtl' ? 'RTL' : 'LTR'
  const { context, page, errors, wire } = await open(dir)

  // 3. keep a run
  await page.goto(`${BASE}/oms/sourcing-simulator`)
  await page.locator('[data-sim-cart]').waitFor({ timeout: 15000 })
  await page.locator('[data-sim-field="channel"]').selectOption('IOS')
  for (const [i, [item, qty]] of [
    ['100234', '2'],
    ['100871', '1'],
    ['104410', '1'],
  ].entries()) {
    if (i > 0) await page.locator('[data-sim-add-line]').click()
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-item]`).fill(item)
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-qty]`).fill(qty)
  }
  await page.locator('[data-sim-field="lat"]').fill('24.7741')
  await page.locator('[data-sim-field="lng"]').fill('46.7386')
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-keep-run="keep"]').waitFor({ timeout: 15000 })
  check(`${L} a held run offers to be kept, saying how long it is held`, (await text(page.locator('[data-keep-run]'))).includes('Held until 20:12'))
  await page.locator('[data-keep-open]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor({ timeout: 5000 })
  await dialog.locator('[data-keep-confirm]').click()
  await page.waitForTimeout(200)
  check(`${L} keeping needs a name`, (await dialog.innerText()).includes('Give the run a name.') && wire.keeps.length === 0)
  const name = 'Three lines from Al Malqa, evening'
  await dialog.locator('[data-keep-name]').fill(name)
  await dialog.locator('[data-keep-confirm]').click()
  await page.locator('[data-keep-done]').waitFor({ timeout: 10000 })
  check(`${L} keep posts the run's number and its name`, JSON.stringify(wire.keeps.at(-1)) === JSON.stringify({ runId: REPLY.runId, name }), JSON.stringify(wire.keeps.at(-1)))
  const done = await text(page.locator('[data-keep-done]'))
  check(`${L} the run says it is kept, with its link to copy`, done.startsWith(`Kept as${name}`) && (await page.locator(`[data-keep-done] [data-copy-run-link="${REPLY.runId}"]`).count()) === 1, done)
  await page.screenshot({ path: `${SHOTS}/${dir}-kept.png`, fullPage: true })

  await page.locator('[data-keep-done] [data-kept-runs-link]').click()
  await page.locator('[data-kept-table]').waitFor({ timeout: 15000 })
  const listed = await page.locator('[data-kept-run]').evaluateAll((els) => els.map((e) => e.getAttribute('data-kept-run')))
  check(
    `${L} the kept runs list: the caller's own, newest first, the new one on top; another keeper's is not listed`,
    JSON.stringify(listed) === JSON.stringify([REPLY.runId, MALQA, '01JDP2Z8C4H6F1Q9Y7E3M5D2KB', '01JDM8T6B3W5N2X4Q9H7L1F0PD']) && !listed.includes(OMAR),
    listed.join(','),
  )
  check(`${L} a run number in the list is an LTR isolate`, await isLtrIsolate(page.locator(`[data-kept-run="${MALQA}"] td`).first().locator('bdi[dir="ltr"]').first()))
  const draftRow = await text(page.locator('[data-kept-run="01JDM8T6B3W5N2X4Q9H7L1F0PD"]'))
  check(`${L} a run kept on a draft says so`, draftRow.includes('changed, not saved'), draftRow)
  await page.screenshot({ path: `${SHOTS}/${dir}-list.png`, fullPage: true })

  await page.locator('[data-kept-delete="01JDM8T6B3W5N2X4Q9H7L1F0PD"]').click()
  await page.locator('dialog[open]').waitFor({ timeout: 5000 })
  check(`${L} delete asks first, and nothing is sent yet`, (await page.locator('dialog[open]').innerText()).includes('Its link stops opening for everyone') && wire.deletes.length === 0)
  await page.locator('dialog[open] [data-kept-delete-confirm]').click()
  await page.locator('[data-kept-run="01JDM8T6B3W5N2X4Q9H7L1F0PD"]').waitFor({ state: 'detached', timeout: 10000 })
  check(`${L} delete sends the run's number, and the run leaves the list`, wire.deletes.at(-1) === '01JDM8T6B3W5N2X4Q9H7L1F0PD' && (await page.locator('[data-kept-run]').count()) === 3)

  // 4. open it by its link
  const advisesBefore = wire.advises.length
  await page.locator(`[data-kept-open="${MALQA}"]`).click()
  await page.waitForURL(new RegExp(`/oms/sourcing-simulator\\?run=${MALQA}$`), { timeout: 10000 })
  await page.locator(`[data-stored-run="${MALQA}"]`).waitFor({ timeout: 15000 })
  check(`${L} the link opens the simulator straight away, asking the stored-run read door, not the advise door`, wire.opens.at(-1) === MALQA && wire.advises.length === advisesBefore, JSON.stringify(wire.opens))
  const banner = await text(page.locator('[data-stored-run]'))
  check(`${L} it says which run: kept, its name, its keeper and engine`, banner.includes('A kept run, opened by its link') && banner.includes('Malqa replay, insulin cold chain') && banner.includes('msartawi') && banner.includes('2.3.1'), banner)
  check(`${L} today's engine gives the stored plans`, (await page.locator('[data-stored-same-engine]').count()) === 1)
  check(`${L} the stored plans are shown`, (await page.locator('[data-plan-card]').count()) === REPLAY.plans.length)
  check(
    `${L} its order is set back on the left`,
    (await page.locator('[data-sim-start]').getAttribute('data-sim-start')) === 'replay' && (await page.locator('[data-sim-field="orderNumber"]').inputValue()) === '4500718264',
  )
  check(`${L} a stored run offers no keep, and no "stale" note`, (await page.locator('[data-keep-run]').count()) === 0 && (await page.locator('[data-run-stale]').count()) === 0)
  check(`${L} the run's name is a free-text isolate`, await page.locator('[data-stored-name] bdi').evaluate((el) => el.tagName === 'BDI' && !el.hasAttribute('dir')))
  await page.screenshot({ path: `${SHOTS}/${dir}-opened.png`, fullPage: true })

  await page.goto(`${BASE}/oms/sourcing-simulator?run=${OMAR}`)
  await page.locator(`[data-stored-run="${OMAR}"]`).waitFor({ timeout: 15000 })
  const differs = await text(page.locator('[data-stored-engine-differs]'))
  check(`${L} another keeper's run opens by its link; a newer engine answers differently, the stored plans stay the truth`, differs.includes('engine 2.3.1') && differs.includes('engine 2.2.4') && differs.includes('stay the truth'), differs)
  check(`${L} the engines in that sentence are isolated`, await page.locator('[data-stored-engine-differs]').evaluate((el) => el.textContent.includes('⁨2.3.1⁩')))
  check(
    `${L} its cart is set back without the customer's point`,
    (await page.locator('[data-sim-start]').getAttribute('data-sim-start')) === 'build' &&
      (await page.locator('[data-sim-line="1"] [data-sim-line-item]').inputValue()) === '100234' &&
      (await page.locator('[data-sim-field="lat"]').inputValue()) === '' &&
      (await text(page.locator('[data-stored-set-back]'))).includes('never stored'),
  )

  await page.goto(`${BASE}/oms/sourcing-simulator?run=${DELETED}`)
  await page.locator(`[data-stored-gone="${DELETED}"]`).waitFor({ timeout: 15000 })
  check(`${L} a deleted run's link says the run is not there`, (await text(page.locator('[data-stored-gone]'))).includes('This run is not there'))
  check(`${L} kept runs: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

try {
  await recordDrive('ltr')
  await keptDrive('ltr')
  await recordDrive('rtl')
  await keptDrive('rtl')
} catch (e) {
  console.error(e)
  results.push({ name: 'the drive ran to its end', pass: false })
}
await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
