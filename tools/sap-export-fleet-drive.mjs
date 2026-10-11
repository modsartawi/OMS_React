// SAP export console fleet drive (ticket 463, BackOffice spec 2579) — drives the REAL fleet page in
// Chromium against STUBBED `SapExport/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2584 is unbuilt, and ticket 466 is the
// live walk. Never point this at a real host.
//
// It verifies:
//   1. the tiles: seven counts from `Fleet/Summary`, each in its token (held for inventory never red,
//      a zero tile quiet), the "as of" stamp (the rollup's oldest computedAt, unshifted), and the
//      stale warning — shown at 2 h old, absent at 5 min;
//   2. the first list read asks for page 1 of 50, sort=worst, no label/state/rail/q;
//   3. the store tiles and the label chips reach the request as a REPEATED `label` (worst first), the
//      rail select as `rail`, the state picker as a REPEATED `state` (in the ladder order), the search
//      as `q`, the sort select as `sort` — each change back on page 1, and each one in the URL;
//   4. paging walks the door's pages at 50 and the page lives in the URL; a filter change resets it;
//   5. a URL with filters opens on them: the first read carries them and the controls show them;
//   6. the grid: code, name, label counts with zero cells blank, rail mix, oldest behind, break days,
//      the stalled / held-for-inventory markers;
//   7. a row opens /reports/sap-export/store/:code; the double-send tiles open the double-send list
//      with their flag;
//   8. a `400 BAD_FILTER` shows an inline error sentence, not a blank grid;
//   9. the tiles and the list refetch every 60 s;
//  10. with `screenAllowed: false` the page guards itself, with no fleet read.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sap-export-fleet-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sap-export-fleet-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope `src/core/api.ts` reads (copied from sync-console-fleet-drive.mjs).
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

/** The contract's time: local wall-clock, no offset. */
const pad = (n) => String(n).padStart(2, '0')
const localStamp = (msAgo) => {
  const d = new Date(Date.now() - msAgo)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const shown = (stamp) => stamp.slice(0, 16).replace('T', ' ')

const ZERO_FLAGS = { X1: 0, X1p: 0, X2: 0, X3: 0, X4: 0, legacyResend: 0, failClosedNoDetail: 0 }
const summary = (computedAt) => ({
  windowDays: 30,
  computedAt,
  stores: 120,
  tiles: { storesBehind: 14, storesStuck: 6, storesHeldForInventory: 2, doubleSent: 9, doubleSendPending: 3, accountingBreaks: 5, legacyStalled: 0 },
})

const store = (i, over = {}) => ({
  code: `P${String(i).padStart(3, '0')}`,
  description: `Store ${i}`,
  total: 500,
  labels: { exported: 480, byDesign: 10, waiting: 10, heldForInventory: 0, behind: 0, stuck: 0 },
  states: { N5: 480, L3: 10, N7: 10 },
  flags: ZERO_FLAGS,
  railMix: { legacy: 0, new: 500 },
  oldestBehindHours: null,
  breakDays: 0,
  legacyStalled: false,
  legacyInventoryGated: false,
  computedAt: '2026-10-11T08:00:00',
  ...over,
})

// 120 stores in the door's "worst" order: P014 first (stuck, behind, held, stalled and gated, breaks).
const STORES = [
  store(14, {
    description: 'Riyadh Olaya',
    total: 840,
    labels: { exported: 700, byDesign: 20, waiting: 0, heldForInventory: 1, behind: 116, stuck: 3 },
    states: { N5: 650, L1: 50, L3: 20, N4: 116, N1: 1, L10: 1, N9: 1, L9: 1 },
    railMix: { legacy: 40, new: 800 },
    oldestBehindHours: 31.5,
    breakDays: 2,
    legacyStalled: true,
    legacyInventoryGated: true,
  }),
  ...Array.from({ length: 120 }, (_, k) => k + 1)
    .filter((i) => i !== 14)
    .map((i) => store(i)),
]

const browser = await chromium.launch()

async function open({ access = { screenAllowed: true }, computedAt = localStamp(5 * 60_000), refuse = null, clock = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
  const page = await context.newPage()
  if (clock) await page.clock.install()
  const errors = []
  const calls = []
  const summaries = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SapExport/Access') return route.fulfill(envelope(access))
    if (p === 'SapExport/Fleet/Summary') {
      summaries.push(url.searchParams)
      return route.fulfill(envelope(summary(computedAt)))
    }
    if (p === 'SapExport/Fleet') {
      calls.push(url.searchParams)
      if (refuse) return route.fulfill(envelope(null, { status: 400, success: false, message: refuse.message, errorCode: refuse.code }))
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      const labels = url.searchParams.getAll('label')
      const states = url.searchParams.getAll('state')
      const rail = url.searchParams.get('rail')
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      let matching = STORES.filter(
        (s) =>
          (labels.length === 0 || labels.some((l) => s.labels[l] > 0)) &&
          (states.length === 0 || states.some((c) => (s.states[c] ?? 0) > 0)) &&
          (!rail || s.railMix[rail] > 0) &&
          (!q || s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
      )
      if (url.searchParams.get('sort') === 'code') matching = [...matching].sort((a, b) => a.code.localeCompare(b.code))
      return route.fulfill(envelope({ items: matching.slice((pg - 1) * size, pg * size), total: matching.length, page: pg, pageSize: size }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, summaries }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const callText = (sp) => (sp ? '?' + sp.toString() : '')
const lastCall = (calls) => calls[calls.length - 1]
const waitForCall = async (page, calls, pred) => {
  for (let i = 0; i < 40; i++) {
    if (calls.length && pred(lastCall(calls))) return true
    await page.waitForTimeout(100)
  }
  return false
}
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const FLEET_URL = `${BASE}/reports/sap-export`
const urlParams = (page) => new URL(page.url()).searchParams

// ── 1–4, 6, 7: the page ───────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open({ computedAt: localStamp(2 * 3600_000) })
  await page.goto(FLEET_URL)
  await page.locator('[data-store-link="P014"]').waitFor({ timeout: 20000 })

  // 1. tiles
  const tiles = await page
    .locator('[data-tile]')
    .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-tile')}:${e.getAttribute('data-tile-token')}:${e.innerText.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()}`))
  check(
    '1. seven tiles, each with its count and its token',
    sameList(tiles, [
      'storesBehind:warningStrong:14 Stores behind',
      'storesStuck:danger:6 Stores stuck',
      'storesHeldForInventory:info:2 Stores held for inventory',
      'doubleSent:danger:9 Double sent',
      'doubleSendPending:danger:3 Double send pending',
      'accountingBreaks:danger:5 Accounting breaks',
      'legacyStalled:muted:0 Legacy stalled',
    ]),
    JSON.stringify(tiles),
  )
  const heldClass = (await page.locator('[data-tile="storesHeldForInventory"]').getAttribute('class')) ?? ''
  check('1. the held-for-inventory tile is never red', !/danger/.test(heldClass), heldClass)
  const asOf = await page.locator('[data-as-of]').getAttribute('data-as-of')
  check('1. the "as of" stamp shows the rollup computedAt, unshifted', strip(await page.locator('[data-as-of]').innerText()) === `Numbers as of ${shown(asOf)}`, await page.locator('[data-as-of]').innerText())
  check('1. a 2-hour-old rollup raises the stale warning', (await page.locator('[data-stale]').count()) === 1 && /may be stale/.test(await page.locator('[data-stale]').innerText()))

  // 2. the first read
  const first = calls[0]
  check(
    '2. the first read asks for page 1 of 50, worst first, no filter',
    first.get('page') === '1' && first.get('pageSize') === '50' && first.get('sort') === 'worst' && first.getAll('label').length === 0 && first.getAll('state').length === 0 && !first.has('rail') && !first.has('q'),
    callText(first),
  )
  check('2. the list counts the stores', strip(await page.locator('[data-fleet-count]').innerText()) === '120 stores')
  check('2. a default view keeps a bare URL', new URL(page.url()).search === '', page.url())

  // 6. the grid
  const cell = async (rowIndex, col) => strip(await page.locator(`[row-index="${rowIndex}"] [col-id="${col}"]`).first().innerText())
  check('6. code and name', (await cell(0, 'code')) === 'P014' && (await cell(0, 'description')) === 'Riyadh Olaya')
  check(
    '6. the label counts, worst first',
    (await cell(0, 'label-stuck')) === '3' && (await cell(0, 'label-behind')) === '116' && (await cell(0, 'label-heldForInventory')) === '1' && (await cell(0, 'label-exported')) === '700' && (await cell(0, 'label-byDesign')) === '20',
  )
  check('6. a zero label count is blank', (await cell(0, 'label-waiting')) === '' && (await cell(1, 'label-stuck')) === '', `${await cell(0, 'label-waiting')}|${await cell(1, 'label-stuck')}`)
  check('6. the rail mix', (await cell(0, 'rail-legacy')) === '40' && (await cell(0, 'rail-new')) === '800')
  check('6. oldest behind in hours, and break days', (await cell(0, 'oldestBehindHours')) === '31.5' && (await cell(0, 'breakDays')) === '2' && (await cell(1, 'breakDays')) === '')
  const markers = await page.locator('[row-index="0"] [data-marker]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-marker')}:${e.querySelector('[data-token]').getAttribute('data-token')}`))
  check('6. the stalled marker is danger, the held-for-inventory marker info', sameList(markers, ['legacyStalled:danger', 'legacyInventoryGated:info']), JSON.stringify(markers))
  check('6. …and read as words', (await cell(0, 'markers')) === 'Legacy stalled Held for inventory', await cell(0, 'markers'))
  check('6. a clean store has no marker', (await page.locator('[row-index="1"] [data-marker]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/fleet.png`, fullPage: true })

  // 4. paging
  await page.getByRole('button', { name: 'Next' }).click()
  check('4. Next asks for page 2 of 50', await waitForCall(page, calls, (c) => c.get('page') === '2' && c.get('pageSize') === '50'), callText(lastCall(calls)))
  await page.locator('[data-store-link="P051"]').waitFor()
  check('4. …and puts page=2 in the URL', urlParams(page).get('page') === '2', page.url())

  // 3. the tiles and the filters
  await page.locator('[data-tile="storesStuck"]').click()
  check('3. the stuck tile sets label=stuck, back on page 1', await waitForCall(page, calls, (c) => sameList(c.getAll('label'), ['stuck']) && c.get('page') === '1'), callText(lastCall(calls)))
  check('3. …and the URL carries it, with no page', sameList(urlParams(page).getAll('label'), ['stuck']) && !urlParams(page).has('page'), page.url())
  check('3. the stuck tile reads as pressed', (await page.locator('[data-tile="storesStuck"]').getAttribute('aria-pressed')) === 'true')
  await page.locator('[data-label-chip="behind"]').click()
  check('3. a label chip repeats label, worst first', await waitForCall(page, calls, (c) => sameList(c.getAll('label'), ['stuck', 'behind'])), callText(lastCall(calls)))
  await page.locator('[data-tile="storesHeldForInventory"]').click()
  check('3. the held-for-inventory tile adds its label', await waitForCall(page, calls, (c) => sameList(c.getAll('label'), ['stuck', 'behind', 'heldForInventory'])), callText(lastCall(calls)))
  await page.locator('[data-tile="storesHeldForInventory"]').click()
  check('3. …and a second click takes it off', await waitForCall(page, calls, (c) => sameList(c.getAll('label'), ['stuck', 'behind'])), callText(lastCall(calls)))
  await page.locator('[data-fleet-rail]').selectOption('legacy')
  check('3. the rail select sets rail=legacy', await waitForCall(page, calls, (c) => c.get('rail') === 'legacy' && sameList(c.getAll('label'), ['stuck', 'behind'])), callText(lastCall(calls)))
  await page.locator('[data-state-picker] summary').click()
  const options = await page.locator('[data-state-option]').count()
  const n1Text = strip(await page.locator('label:has([data-state-option="N1"])').innerText())
  check('3. the state picker lists the 23 contract codes with their meanings', options === 23 && n1Text === 'N1 Held', `${options} | ${n1Text}`)
  await page.locator('[data-state-option="N1"]').click()
  await waitForCall(page, calls, (c) => sameList(c.getAll('state'), ['N1']))
  await page.locator('[data-state-option="L10"]').click()
  check('3. the picker repeats state, in the ladder order', await waitForCall(page, calls, (c) => sameList(c.getAll('state'), ['L10', 'N1'])), callText(lastCall(calls)))
  check('3. the chosen states show as chips', sameList(await page.locator('[data-state-chosen]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state-chosen'))), ['L10', 'N1']))
  await page.locator('[data-fleet-count]').click()
  check('3. the state picker closes on a click elsewhere', !(await page.locator('[data-state-picker]').evaluate((d) => d.open)))
  await page.locator('[data-fleet-search]').fill('olaya')
  check('3. the search box sets q once typing pauses', await waitForCall(page, calls, (c) => c.get('q') === 'olaya'), callText(lastCall(calls)))
  await page.locator('[data-fleet-sort]').selectOption('oldestBehind')
  check('3. the sort select sets sort=oldestBehind', await waitForCall(page, calls, (c) => c.get('sort') === 'oldestBehind'), callText(lastCall(calls)))
  const u = urlParams(page)
  check(
    '3. the URL carries every filter as the contract spells it',
    sameList(u.getAll('label'), ['stuck', 'behind']) && u.get('rail') === 'legacy' && sameList(u.getAll('state'), ['L10', 'N1']) && u.get('q') === 'olaya' && u.get('sort') === 'oldestBehind',
    page.url(),
  )
  await page.locator('[data-store-link="P014"]').waitFor()
  check('3. the filtered list draws only the matching store', (await page.locator('[data-store-link]').count()) === 1)

  await page.locator('[data-fleet-sort]').selectOption('code')
  check('3. the sort select sets sort=code', await waitForCall(page, calls, (c) => c.get('sort') === 'code' && c.get('page') === '1'), callText(lastCall(calls)))
  await page.locator('[data-fleet-sort]').selectOption('worst')
  check('3. back to worst first, which the URL leaves off', (await waitForCall(page, calls, (c) => c.get('sort') === 'worst')) && !urlParams(page).has('sort'), page.url())
  await page.locator('[data-fleet-sort]').selectOption('oldestBehind')
  await waitForCall(page, calls, (c) => c.get('sort') === 'oldestBehind')

  // 4. a filter change resets the page
  await page.locator('[data-clear-filters]').click()
  check('3. Clear drops every filter, keeping the sort', await waitForCall(page, calls, (c) => c.getAll('label').length === 0 && c.getAll('state').length === 0 && !c.has('rail') && !c.has('q') && c.get('sort') === 'oldestBehind'), callText(lastCall(calls)))
  await page.locator('[data-store-link="P001"]').waitFor()
  await page.getByRole('button', { name: 'Next' }).click()
  await waitForCall(page, calls, (c) => c.get('page') === '2')
  await page.locator('[data-fleet-rail]').selectOption('new')
  check('4. a filter change on page 2 asks for page 1', await waitForCall(page, calls, (c) => c.get('rail') === 'new' && c.get('page') === '1'), callText(lastCall(calls)))
  check('4. …and drops the page from the URL', !urlParams(page).has('page'), page.url())

  // 7. a row opens the store page — anywhere on the row, and through the code link
  const firstCode = await page.locator('[row-index="0"] [data-store-link]').getAttribute('data-store-link')
  await page.locator('[row-index="0"] [col-id="description"]').click()
  await page.waitForURL(/\/reports\/sap-export\/store\//, { timeout: 10000 })
  check('7. clicking a row opens its store page', new URL(page.url()).pathname === `/reports/sap-export/store/${firstCode}`, page.url())
  await page.goBack()
  await page.locator('[data-store-link]').first().waitFor({ timeout: 10000 })
  await page.locator('[data-store-link]').first().click()
  await page.waitForURL(/\/reports\/sap-export\/store\//, { timeout: 10000 })
  check('7. a row opens /reports/sap-export/store/:code', /\/reports\/sap-export\/store\/P\d{3}$/.test(new URL(page.url()).pathname), page.url())
  await page.locator('[data-store-page]').waitFor({ timeout: 10000 })
  check('7. …which draws (its placeholder until 464)', (await page.locator('[data-open-day-form]').count()) === 1)
  await page.goBack()
  await page.locator('[data-tile="doubleSendPending"]').waitFor({ timeout: 10000 })
  check('7. Back returns to the fleet with its filters', urlParams(page).get('rail') === 'new' && urlParams(page).get('sort') === 'oldestBehind', page.url())
  await page.locator('[data-tile="doubleSendPending"]').click()
  await page.waitForURL(/double-sends/, { timeout: 10000 })
  check('7. the double-send-pending tile opens the double-send list with flag=X1p', new URL(page.url()).pathname === '/reports/sap-export/double-sends' && urlParams(page).get('flag') === 'X1p', page.url())
  await page.goBack()
  await page.locator('[data-tile="doubleSent"]').click()
  await page.waitForURL(/double-sends/, { timeout: 10000 })
  check('7. the double-sent tile opens it with flag=X1', urlParams(page).get('flag') === 'X1', page.url())
  check('no page errors (fleet)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 1 (fresh) + 5: a fresh rollup, and a URL that opens on its filters ──────────────────────────
{
  const { context, page, errors, calls } = await open({ computedAt: localStamp(5 * 60_000) })
  await page.goto(`${FLEET_URL}?label=stuck&label=behind&rail=legacy&state=N1&q=olaya&sort=mostStuck&page=1`)
  await page.locator('[data-store-link="P014"]').waitFor({ timeout: 20000 })
  check('1. a 5-minute-old rollup raises no stale warning', (await page.locator('[data-stale]').count()) === 0)
  const first = calls[0]
  check(
    '5. a URL with filters opens on them: the first read carries them',
    sameList(first.getAll('label'), ['stuck', 'behind']) && first.get('rail') === 'legacy' && sameList(first.getAll('state'), ['N1']) && first.get('q') === 'olaya' && first.get('sort') === 'mostStuck' && first.get('page') === '1',
    callText(first),
  )
  check('5. the URL is canonicalised (page 1 left off)', !urlParams(page).has('page') || urlParams(page).get('page') === '1', page.url())
  check(
    '5. …and the controls show them',
    (await page.locator('[data-tile="storesStuck"]').getAttribute('aria-pressed')) === 'true' &&
      (await page.locator('[data-label-chip="behind"]').getAttribute('aria-pressed')) === 'true' &&
      (await page.locator('[data-fleet-rail]').inputValue()) === 'legacy' &&
      (await page.locator('[data-fleet-sort]').inputValue()) === 'mostStuck' &&
      (await page.locator('[data-fleet-search]').inputValue()) === 'olaya' &&
      (await page.locator('[data-state-chosen="N1"]').count()) === 1,
  )
  await page.goto(`${FLEET_URL}?label=parked&state=Z9&rail=both&sort=random&page=x`)
  await page.locator('[data-store-link="P014"]').waitFor({ timeout: 20000 })
  const odd = lastCall(calls)
  check('5. values the door would refuse are dropped, never sent', odd.getAll('label').length === 0 && odd.getAll('state').length === 0 && !odd.has('rail') && odd.get('sort') === 'worst' && odd.get('page') === '1', callText(odd))
  check('no page errors (URL)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page, errors } = await open({ computedAt: null })
  await page.goto(FLEET_URL)
  await page.locator('[data-store-link="P014"]').waitFor({ timeout: 20000 })
  check('1. a rollup that never computed says so, with no stale warning', strip(await page.locator('[data-as-of]').innerText()) === 'The rollup has not computed any numbers yet.' && (await page.locator('[data-stale]').count()) === 0)
  check('no page errors (never computed)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: BAD_FILTER ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ refuse: { code: 'BAD_FILTER', message: 'Unknown label.' } })
  await page.goto(FLEET_URL)
  await page.getByText('A filter on this page is not one the server knows.').waitFor({ timeout: 20000 })
  check('8. a 400 BAD_FILTER shows its own sentence inline', true)
  check('8. …with no grid and no empty-list sentence', (await page.locator('[data-fleet-grid]').count()) === 0 && (await page.locator('[data-fleet-empty]').count()) === 0)
  check('8. …while the tiles still draw', (await page.locator('[data-tile]').count()) === 7)
  check('no page errors (BAD_FILTER)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: refetch every 60 s ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, summaries } = await open({ clock: true })
  await page.goto(FLEET_URL)
  await page.locator('[data-store-link="P014"]').waitFor({ timeout: 20000 })
  const before = { fleet: calls.length, summary: summaries.length }
  await page.clock.fastForward(30_000)
  await page.waitForTimeout(300)
  check('9. nothing refetches at 30 s', calls.length === before.fleet && summaries.length === before.summary, `${calls.length}/${summaries.length}`)
  await page.clock.fastForward(31_000)
  for (let i = 0; i < 30 && (calls.length === before.fleet || summaries.length === before.summary); i++) await page.waitForTimeout(100)
  check('9. the list and the tiles refetch at 60 s', calls.length > before.fleet && summaries.length > before.summary, `${before.fleet}→${calls.length}, ${before.summary}→${summaries.length}`)
  check('no page errors (refetch)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: no view grant ─────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls, summaries } = await open({ access: { screenAllowed: false } })
  await page.goto(FLEET_URL)
  await page.getByText('No access to SAP export').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('10. without the grant the page guards itself, with no fleet read', (await page.locator('[data-fleet-page]').count()) === 0 && calls.length === 0 && summaries.length === 0)
  check('no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
