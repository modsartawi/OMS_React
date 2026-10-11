// SAP export console store drive (ticket 464, BackOffice spec 2579) — drives the REAL store page in
// Chromium against STUBBED `SapExport/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2584 is unbuilt, and ticket 466 is the
// live walk. Never point this at a real host. The recompute is stubbed too: no rollup is touched.
//
// It verifies:
//   1. the header from `SapExport/Store`: code · name, the rollup stamp, the window's total, the label
//      counts in their tokens, the rail mix, oldest behind, break days and the markers;
//   2. the export facts: a missing SAP location (L6) and a missing counter row (L7) read as danger with
//      their plain-English cause; a null watermark / inventory date is blank; a healthy store has no
//      danger fact, its SAP locations counted and its watermark grouped;
//   3. the strip from `SapExport/Store/Days`: 30 cells oldest first, each in its worst label's token
//      (held for inventory never red), never-computed days dashed and muted, a breaks marker on the
//      day whose accounting breaks; hover shows the day's counts and verdict;
//   4. clicking a day opens its store-day page;
//   5. Recompute (whole window) posts `{ code }`, is busy while it runs, then re-reads the header and
//      the strip and says how many days it re-judged; the copy says it never touches export data;
//   6. Recompute on the store-day header posts `{ code, day }` (the live day is not re-read: it is not
//      from the rollup); the store's strip is re-read on the way back;
//   7. a recompute refusal (`DAY_OUT_OF_WINDOW`) shows its own sentence inline;
//   8. an unknown store (`404 NO_STORE`) shows a not-found state, with no strip;
//   9. with `screenAllowed: false` the page guards itself, with no store read.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sap-export-store-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sap-export-store-shots'
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

const ZERO_FLAGS = { X1: 0, X1p: 0, X2: 0, X3: 0, X4: 0, legacyResend: 0, failClosedNoDetail: 0 }
const ZERO_LABELS = { exported: 0, byDesign: 0, waiting: 0, heldForInventory: 0, behind: 0, stuck: 0 }

const STORES = {
  // A store whose master data is broken: not under SAP, no counter row.
  P014: {
    code: 'P014',
    description: 'Riyadh Olaya',
    total: 840,
    labels: { exported: 700, byDesign: 20, waiting: 0, heldForInventory: 1, behind: 116, stuck: 3 },
    states: { N5: 650, L1: 50, L3: 20, N4: 116, N1: 1, L6: 3 },
    flags: ZERO_FLAGS,
    railMix: { legacy: 40, new: 800 },
    oldestBehindHours: 31.5,
    breakDays: 2,
    legacyStalled: true,
    legacyInventoryGated: true,
    computedAt: '2026-10-11T08:00:00',
    facts: { underSap: false, sapLocations: 0, hasCounterRow: false, watermark: null, openDate: '2019-03-01', closed: false, inventoryDate: null },
  },
  P001: {
    code: 'P001',
    description: 'Jeddah Tahlia',
    total: 500,
    labels: { ...ZERO_LABELS, exported: 500 },
    states: { N5: 500 },
    flags: ZERO_FLAGS,
    railMix: { legacy: 0, new: 500 },
    oldestBehindHours: null,
    breakDays: 0,
    legacyStalled: false,
    legacyInventoryGated: false,
    computedAt: '2026-10-11T08:00:00',
    facts: { underSap: true, sapLocations: 2, hasCounterRow: true, watermark: 1234567, openDate: '2015-06-01', closed: true, inventoryDate: '2026-09-30' },
  },
}

// The window: 2026-09-11 … 2026-10-10, oldest first. The first two never computed.
const DAYS = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 8, 11 + i)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
const WORSTS = ['stuck', 'behind', 'heldForInventory', 'waiting', 'exported', 'byDesign']
const BREAK_DAY = DAYS[5]
const dayOf = (day, i) => {
  if (i < 2) return { day, noData: true, total: 0, worst: null, labels: ZERO_LABELS, states: {}, flags: ZERO_FLAGS, accounting: null, oldestBehindHours: null, computedAt: null }
  const worst = WORSTS[(i - 2) % WORSTS.length]
  const labels = { ...ZERO_LABELS, exported: 20, [worst]: worst === 'exported' ? 20 : 2 }
  return {
    day,
    noData: false,
    total: Object.values(labels).reduce((a, b) => a + b, 0),
    worst,
    labels,
    states: { N5: 20 },
    flags: ZERO_FLAGS,
    accounting: day === BREAK_DAY ? 'breaks' : 'agrees',
    oldestBehindHours: worst === 'behind' ? 12 : null,
    computedAt: '2026-10-11T08:00:00',
  }
}
// The door's order is oldest first; the stub sends it shuffled to prove the page keeps it.
const WINDOW = DAYS.map(dayOf)
const SHUFFLED = [...WINDOW.slice(15), ...WINDOW.slice(0, 15)]
const EXPECTED_TOKENS = WINDOW.map((d, i) => (i < 2 ? 'muted' : { stuck: 'danger', behind: 'warningStrong', heldForInventory: 'info', waiting: 'neutral', exported: 'success', byDesign: 'muted' }[d.worst]))

const storeDay = (code, day) => ({
  code,
  day,
  asOf: '2026-10-11T08:15:00',
  total: 22,
  labels: { ...ZERO_LABELS, exported: 20, stuck: 2 },
  states: { N5: 20, N9: 2 },
  flags: ZERO_FLAGS,
  accounting: 'agrees',
  rows: { items: [], total: 0, page: 1, pageSize: 50 },
})

const browser = await chromium.launch()

async function open({ access = { screenAllowed: true }, refuseRecompute = null, recomputeDelay = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const reads = { store: 0, days: 0, storeDay: 0 }
  const posts = []
  let recomputed = false
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    const code = url.searchParams.get('code')
    const noStore = () => route.fulfill(envelope(null, { status: 404, success: false, message: 'No store.', errorCode: 'NO_STORE' }))
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SapExport/Access') return route.fulfill(envelope(access))
    if (p === 'SapExport/Store') {
      reads.store++
      if (!STORES[code]) return noStore()
      // After a recompute the rollup stamp moves on: the re-read shows it.
      return route.fulfill(envelope(recomputed ? { ...STORES[code], computedAt: '2026-10-11T09:30:00' } : STORES[code]))
    }
    if (p === 'SapExport/Store/Days') {
      reads.days++
      if (!STORES[code]) return noStore()
      return route.fulfill(envelope({ items: SHUFFLED }))
    }
    if (p === 'SapExport/StoreDay') {
      reads.storeDay++
      return route.fulfill(envelope(storeDay(code, url.searchParams.get('day'))))
    }
    if (p === 'SapExport/Recompute') {
      const body = JSON.parse(req.postData() ?? '{}')
      posts.push({ method: req.method(), body })
      if (recomputeDelay) await new Promise((r) => setTimeout(r, recomputeDelay))
      if (refuseRecompute) return route.fulfill(envelope(null, { status: 400, success: false, message: refuseRecompute.message, errorCode: refuseRecompute.code }))
      recomputed = true
      return route.fulfill(envelope({ code: body.code, days: body.day ? 1 : 30, computedAt: '2026-10-11T09:30:00' }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, posts }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const until = async (page, pred) => {
  for (let i = 0; i < 50; i++) {
    if (pred()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const storeUrl = (code) => `${BASE}/reports/sap-export/store/${code}`
const text = async (page, sel) => strip(await page.locator(sel).first().innerText())

// ── 1–5: the broken store ─────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, reads, posts } = await open({ recomputeDelay: 700 })
  await page.goto(storeUrl('P014'))
  await page.locator('[data-strip-day]').first().waitFor({ timeout: 20000 })

  // 1. header
  check('1. the header names the store, code · name', (await text(page, '[data-store-heading]')) === 'Store P014 · Riyadh Olaya', await text(page, '[data-store-heading]'))
  check('1. …the rollup stamp, unshifted', (await text(page, '[data-as-of]')) === 'Numbers as of 2026-10-11 08:00', await text(page, '[data-as-of]'))
  check('1. …the window total', (await text(page, '[data-store-total]')) === '840 transactions in the window')
  const labels = await page.locator('[data-store-label]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-store-label')}:${e.getAttribute('data-token')}:${e.innerText.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()}`))
  check(
    '1. the label counts, worst first, in their tokens',
    sameList(labels, ['stuck:danger:3 Stuck', 'behind:warningStrong:116 Behind', 'heldForInventory:info:1 Held for inventory', 'waiting:neutral:0 Waiting', 'exported:success:700 Exported', 'byDesign:muted:20 By design']),
    JSON.stringify(labels),
  )
  check(
    '1. rail mix, oldest behind, break days',
    (await text(page, '[data-stat="rail-legacy"] dd')) === '40' && (await text(page, '[data-stat="rail-new"] dd')) === '800' && (await text(page, '[data-stat="oldestBehindHours"] dd')) === '31.5' && (await text(page, '[data-stat="breakDays"] dd')) === '2',
  )
  const markers = await page.locator('[data-store-markers] [data-marker]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-marker')}:${e.querySelector('[data-token]').getAttribute('data-token')}`))
  check('1. the stalled marker is danger, the held-for-inventory marker info', sameList(markers, ['legacyStalled:danger', 'legacyInventoryGated:info']), JSON.stringify(markers))

  // 2. facts
  const fact = (k) => page.locator(`[data-fact="${k}"]`)
  check('2. no SAP location is a danger fact', (await fact('underSap').getAttribute('data-danger')) === '' && strip(await fact('underSap').locator('[data-fact-value]').innerText()) === 'No SAP location')
  check('2. …with the L6 cause in plain English', /not in the export list/.test(await fact('underSap').locator('[data-fact-cause]').innerText()))
  check('2. a missing counter row is a danger fact', (await fact('counterRow').getAttribute('data-danger')) === '' && strip(await fact('counterRow').locator('[data-fact-value]').innerText()) === 'Missing')
  check('2. …with the L7 cause in plain English', /no export counter row/.test(await fact('counterRow').locator('[data-fact-cause]').innerText()))
  check('2. a null watermark and a null inventory date are blank', strip(await fact('watermark').locator('[data-fact-value]').innerText()) === '' && strip(await fact('inventoryDate').locator('[data-fact-value]').innerText()) === '')
  check('2. the open date and closed', strip(await fact('openDate').locator('[data-fact-value]').innerText()) === '2019-03-01' && strip(await fact('closed').locator('[data-fact-value]').innerText()) === 'No')
  check('2. only the two master-data facts are danger', (await page.locator('[data-fact][data-danger]').count()) === 2)

  // 3. strip
  const cells = await page.locator('[data-strip-day]').evaluateAll((els) => els.map((e) => ({ day: e.getAttribute('data-strip-day'), token: e.getAttribute('data-token'), noData: e.hasAttribute('data-no-data'), breaks: e.hasAttribute('data-breaks') })))
  check('3. thirty cells', cells.length === 30, String(cells.length))
  check('3. the strip is titled by its own length', (await text(page, '[data-strip-section] h3')) === 'The last 30 days', await text(page, '[data-strip-section] h3'))
  check('3. oldest first (the stub sent them shuffled)', sameList(cells.map((c) => c.day), DAYS), cells.map((c) => c.day).join(','))
  check('3. each in its worst label token', sameList(cells.map((c) => c.token), EXPECTED_TOKENS), cells.map((c) => c.token).join(','))
  check('3. the never-computed days are muted and marked noData', sameList(cells.filter((c) => c.noData).map((c) => c.day), DAYS.slice(0, 2)))
  const heldCell = cells.find((c, i) => WINDOW[i].worst === 'heldForInventory')
  const heldClass = (await page.locator(`[data-strip-day="${heldCell.day}"]`).getAttribute('class')) ?? ''
  check('3. a held-for-inventory day is info, never red', heldCell.token === 'info' && !/danger/.test(heldClass), heldClass)
  check('3. only the breaks day carries a marker', sameList(cells.filter((c) => c.breaks).map((c) => c.day), [BREAK_DAY]) && (await page.locator(`[data-strip-day="${BREAK_DAY}"] [data-breaks-marker]`).count()) === 1)
  check('3. the range reads oldest to newest', (await text(page, '[data-strip-range]')) === `${DAYS[0]} – ${DAYS[29]}`, await text(page, '[data-strip-range]'))

  const stuckDay = DAYS[2]
  check('3. a day card is hidden until hovered', !(await page.locator(`[data-day-card="${stuckDay}"]`).isVisible()))
  await page.locator(`[data-strip-day="${stuckDay}"]`).hover()
  const card = page.locator(`[data-day-card="${stuckDay}"]`)
  check('3. hover shows the day card', await card.isVisible())
  const counts = await card.locator('[data-day-card-count]').evaluateAll((els) => els.map((e) => e.innerText.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()))
  check("3. …with the day's label counts, worst first", sameList(counts, ['Stuck 2', 'Exported 20']), JSON.stringify(counts))
  check('3. …its total and its verdict', strip(await card.locator('[data-day-card-total]').innerText()) === '22 transactions' && (await card.locator('[data-day-card-accounting="agrees"]').count()) === 1)
  await page.locator(`[data-strip-day="${BREAK_DAY}"]`).hover()
  check('3. a breaks day says so on hover', /accounting breaks/.test(await page.locator(`[data-day-card="${BREAK_DAY}"]`).innerText()) && (await page.locator(`[data-day-card="${BREAK_DAY}"] [data-day-card-accounting="breaks"]`).count()) === 1)
  await page.locator(`[data-strip-day="${DAYS[0]}"]`).hover()
  check('3. a never-computed day says so on hover', (await page.locator(`[data-day-card="${DAYS[0]}"] [data-day-card-no-data]`).isVisible()))
  await page.mouse.move(0, 0)
  await page.screenshot({ path: `${SHOTS}/store.png`, fullPage: true })

  // 5. recompute the window
  const windowControl = page.locator('[data-recompute="window"]')
  check('5. the copy says it never touches export data', /never touches export data/.test(await windowControl.innerText()))
  const before = { ...reads }
  await windowControl.locator('[data-recompute-button]').click()
  await page.waitForTimeout(150)
  const busyButton = windowControl.locator('[data-recompute-button]')
  check('5. busy while it runs', (await busyButton.isDisabled()) && /Recomputing/.test(await busyButton.innerText()))
  await windowControl.locator('[data-recompute-done]').waitFor({ timeout: 10000 })
  check('5. it posts { code } — the whole window', posts.length === 1 && posts[0].method === 'POST' && sameList(posts[0].body, { code: 'P014' }), JSON.stringify(posts))
  check('5. …says how many days it re-judged', /Recomputed 30 days\. Numbers as of 2026-10-11 09:30\./.test(strip(await windowControl.locator('[data-recompute-done]').innerText())), await windowControl.locator('[data-recompute-done]').innerText())
  check('5. …then re-reads the header and the strip', await until(page, () => reads.store > before.store && reads.days > before.days), JSON.stringify({ before, after: reads }))
  await page.waitForFunction(() => document.querySelector('[data-as-of]')?.getAttribute('data-as-of') === '2026-10-11T09:30:00', null, { timeout: 5000 }).catch(() => {})
  check('5. …and the header shows the new stamp', (await text(page, '[data-as-of]')) === 'Numbers as of 2026-10-11 09:30', await text(page, '[data-as-of]'))
  check('5. the button is free again', !(await windowControl.locator('[data-recompute-button]').isDisabled()))

  // 4. a day click opens the store-day page
  const openDay = DAYS[10]
  await page.locator(`[data-strip-day="${openDay}"]`).click()
  await page.locator(`[data-store-day-page="P014/${openDay}"]`).waitFor({ timeout: 10000 })
  check('4. clicking a day opens its store-day page', new URL(page.url()).pathname === `/reports/sap-export/store/P014/day/${openDay}`, page.url())

  // 6. recompute one day, from the store-day header
  const dayControl = page.locator('[data-recompute="day"]')
  await dayControl.waitFor({ timeout: 10000 })
  check('6. the store-day header carries a per-day recompute, saying it never touches export data', /Recompute this day/.test(await dayControl.innerText()) && /never touches export data/.test(await dayControl.innerText()))
  const beforeDay = { ...reads }
  await dayControl.locator('[data-recompute-button]').click()
  await dayControl.locator('[data-recompute-done]').waitFor({ timeout: 10000 })
  check('6. it posts { code, day }', posts.length === 2 && sameList(posts[1].body, { code: 'P014', day: openDay }), JSON.stringify(posts[1]))
  check('6. …says it re-judged one day', /Recomputed 1 day\./.test(strip(await dayControl.locator('[data-recompute-done]').innerText())))
  await page.waitForTimeout(300)
  check('6. …and leaves the live store-day read alone (it is not from the rollup)', reads.storeDay === beforeDay.storeDay, JSON.stringify({ beforeDay, after: reads }))
  const daysBeforeBack = reads.days
  await page.locator('[data-store-day-back]').click()
  await page.locator('[data-strip-day]').first().waitFor({ timeout: 10000 })
  check('6. back on the store, the strip is re-read', await until(page, () => reads.days > daysBeforeBack), `${daysBeforeBack}→${reads.days}`)
  check('no page errors (store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2: a healthy store ────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(storeUrl('P001'))
  await page.locator('[data-fact="underSap"]').waitFor({ timeout: 20000 })
  const value = async (k) => strip(await page.locator(`[data-fact="${k}"] [data-fact-value]`).innerText())
  check('2. a healthy store has no danger fact and no cause', (await page.locator('[data-fact][data-danger]').count()) === 0 && (await page.locator('[data-fact-cause]').count()) === 0)
  check('2. …its SAP locations counted', (await value('underSap')) === 'Yes, 2 SAP locations', await value('underSap'))
  check('2. …its counter row present, its watermark grouped', (await value('counterRow')) === 'Present' && (await value('watermark')) === '1,234,567')
  check('2. …its dates and closed flag', (await value('openDate')) === '2015-06-01' && (await value('inventoryDate')) === '2026-09-30' && (await value('closed')) === 'Yes')
  check('1. a store with no markers draws none', (await page.locator('[data-store-markers]').count()) === 0)
  check('no page errors (healthy)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: a recompute refusal ────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open({ refuseRecompute: { code: 'DAY_OUT_OF_WINDOW', message: 'Day out of window.' } })
  await page.goto(`${storeUrl('P014')}/day/${DAYS[3]}`)
  const dayControl = page.locator('[data-recompute="day"]')
  await dayControl.waitFor({ timeout: 20000 })
  await dayControl.locator('[data-recompute-button]').click()
  await page.getByText("This day is outside the console's window.").waitFor({ timeout: 10000 })
  check('7. a DAY_OUT_OF_WINDOW refusal shows its own sentence inline', posts.length === 1 && (await dayControl.locator('[data-recompute-done]').count()) === 0)
  check('no page errors (refusal)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: NO_STORE ───────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open()
  await page.goto(storeUrl('Z999'))
  await page.locator('[data-store-not-found]').waitFor({ timeout: 20000 })
  check('8. an unknown store shows the not-found state', strip(await page.locator('[data-store-not-found] h2').innerText()) === 'There is no store Z999')
  check('8. …with no header, no strip and no recompute', (await page.locator('[data-store-header]').count()) === 0 && (await page.locator('[data-strip-section]').count()) === 0 && (await page.locator('[data-recompute]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/not-found.png` })
  check('no page errors (not found)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: no view grant ──────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, reads } = await open({ access: { screenAllowed: false } })
  await page.goto(storeUrl('P014'))
  await page.getByText('No access to SAP export').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check('9. without the grant the page guards itself, with no store read', (await page.locator('[data-store-page]').count()) === 0 && reads.store === 0 && reads.days === 0)
  check('no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
