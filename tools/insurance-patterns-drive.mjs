// Insurance pattern cases drive (oms 922; BackOffice spec 4050) — drives the REAL app in Chromium against MOCKED
// `Insurance/Patterns/*` envelopes (`./insurance-patterns-stubs.mjs`: BackOffice 4053 is not built, so every shape is the
// guessed contract) and a stand-in for Google's Maps JavaScript (no key, no billed load, no network), so the real
// adapter (`src/core/map/google-engine.ts`) is watched drawing the route's lines.
//
// Proves, on the running app: no grant → no nav entry and "no access"; the list's filters (in the URL), paging and the
// server's order; the case screen's route (legs in time order, travel in the warning colour, a delivery a point with no
// leg), the legs table when the map cannot draw; a mark round-trip and the previous-clearance banner; and the RTL layout
// in Arabic words (screenshots to SHOT_DIR).
//
//   1. run the app:  npx vite --port 5231 --strictPort
//   2. DRIVE_PORT=5231 SHOT_DIR=<dir> node tools/insurance-patterns-drive.mjs
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { permissions } from './permissions-stub.mjs'
import { businessRefusal, CLEARED_CASE, envelope, KEYS, patternsDoors, patternsState, standInGoogle, STORES, TRAVEL_CASE } from './insurance-patterns-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOT_DIR = process.env.SHOT_DIR || '.'
const LIST = BASE + '/insurance/patterns'
const CASE = (id) => `${LIST}/${id}`
const MAPS = { key: 'drive-stand-in-key' }

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const placeOf = (code) => ({ lat: STORES[code].lat, lng: STORES[code].lon })
/** Whether a wait ended in time: a review check must fail, not stop the drive, when what it waits for never comes. */
const settles = (promise) => promise.then(() => true, () => false)
const apiPath = (req) => decodeURIComponent(new URL(req.url()).pathname.split('/api/')[1] ?? '')

async function run() {
  const browser = await chromium.launch()
  const errors = []
  const googleAsked = []

  /**
   * One request handled on purpose (spec 4050 review): the next request `match` accepts is held until `release()` (a slow
   * server) when `held`, and answered with `answer` instead of the stub when given. `arrived` resolves once it is in.
   */
  const special = []
  const once = (match, { answer = null, held = false } = {}) => {
    const s = { match, answer, used: false }
    s.released = held ? new Promise((r) => (s.release = r)) : Promise.resolve()
    s.arrived = new Promise((r) => (s.arrive = r))
    special.push(s)
    return s
  }

  /** A page signed in with `keys`, the pattern doors stubbed from `state`, Google stood in when the case has a key. */
  const open = async (state, { keys = [KEYS.analyst], dir = 'ltr' } = {}) => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultNavigationTimeout(90000)
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
    page.on('request', (r) => /googleapis|gstatic/.test(new URL(r.url()).hostname) && googleAsked.push(r.url()))
    await page.addInitScript((d) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
    }, dir)
    if (state.maps) await standInGoogle(page)
    const doors = patternsDoors(state)
    // The app's own origin only: Google's script lives under `/maps/api/js`, and a later route is asked first.
    await page.route(`${BASE}/api/**`, async (route) => {
      const req = route.request()
      const path = decodeURIComponent(new URL(req.url()).pathname.split('/api/')[1])
      if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
      if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
      const s = special.find((x) => !x.used && x.match(req))
      if (s) {
        s.used = true
        s.arrive()
        await s.released
        if (s.answer) return route.fulfill(s.answer)
      }
      return route.fulfill(doors(req) ?? envelope({}))
    })
    return page
  }
  const lastList = (state) => state.calls.list.at(-1)?.query ?? {}
  const waitUntil = async (fn, ms = 8000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (fn()) return true
      await new Promise((r) => setTimeout(r, 50))
    }
    return fn()
  }
  const rowIds = (page) => page.locator('[data-testid=patterns-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-case')))

  // ── 1. No grant: no nav entry, the routes say "no access", and no door is asked ─────────────────────────────────
  for (const [label, keys] of [
    ['no key at all', []],
    ['the investigator and manager keys without the analyst’s', [KEYS.investigator, KEYS.manager, KEYS.block]],
  ]) {
    const state = patternsState()
    const page = await open(state, { keys })
    await page.goto(LIST)
    await page.waitForSelector('text=No access to pattern cases')
    check(`no grant (${label}): the list shows "no access"`, strip(await page.textContent('[role=alert]')).includes('No access to pattern cases'))
    check(`no grant (${label}): no nav entry`, (await page.locator('a[href="/insurance/patterns"]').count()) === 0)
    await page.goto(CASE(TRAVEL_CASE.caseId))
    await page.waitForSelector('text=No access to pattern cases')
    check(`no grant (${label}): a case's route shows "no access" too`, true)
    check(`no grant (${label}): no pattern door was asked`, state.calls.list.length === 0 && state.calls.detail.length === 0, JSON.stringify(state.calls))
    await page.close()
  }

  // ── 2. The list: the grant opens it, the server's order, paging ─────────────────────────────────────────────────
  let state = patternsState()
  let page = await open(state)
  await page.goto(LIST)
  await page.waitForSelector('[data-testid=patterns-table]')
  check('the grant: the nav carries the Pattern cases leaf', (await page.locator('a[href="/insurance/patterns"]').count()) > 0)
  check('the opening read asks page 1 of 25 and nothing else (no order: the server orders)', same(state.calls.list[0].query, { skip: '0', take: '25' }), JSON.stringify(state.calls.list[0]?.query))
  check('…with the X-Web-Client header', !!state.calls.list[0].csrf)
  check('the caption counts every match', strip(await page.textContent('[data-testid=patterns-count]')) === '62 cases', strip(await page.textContent('[data-testid=patterns-caption]')))
  let ids = await rowIds(page)
  check('page 1 shows 25 rows', ids.length === 25, String(ids.length))
  const scores = await page.locator('[data-testid=patterns-row]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-score'))))
  check('strongest first: the scores never rise down the page', scores.every((s, i) => i === 0 || s <= scores[i - 1]), JSON.stringify(scores))
  check('the pager reads page 1 of 3', strip(await page.textContent('nav[aria-label="Result pages"]')).includes('Page 1 of 3'))
  const firstPage = ids
  await page.click('nav[aria-label="Result pages"] button:has-text("Next")')
  await waitUntil(() => lastList(state).skip === '25')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '2')
  await page.waitForFunction((first) => document.querySelector('[data-testid=patterns-row]')?.getAttribute('data-case') !== first, firstPage[0])
  ids = await rowIds(page)
  check('Next asks skip=25 and writes page=2 to the address', lastList(state).skip === '25' && ids.length === 25 && !ids.includes(firstPage[0]))

  // ── 3. The filters: each reaches the door under its name, back on page 1, kept in the address ───────────────────
  await page.selectOption('[data-testid=patterns-filter-signal]', 'travel')
  await waitUntil(() => lastList(state).signal === 'travel')
  check('a signal is sent as signal=travel, back on page 1', lastList(state).signal === 'travel' && lastList(state).skip === '0', JSON.stringify(lastList(state)))
  await page.waitForFunction(() => new URL(location.href).search === '?signal=travel')
  check('…and the address keeps it (and drops the page)', true)
  await page.selectOption('[data-testid=patterns-filter-status]', 'open')
  await waitUntil(() => lastList(state).status === 'open')
  await page.selectOption('[data-testid=patterns-filter-severity]', 'action')
  await waitUntil(() => lastList(state).severity === 'action')
  check('status and severity are sent with it', same(lastList(state), { signal: 'travel', status: 'open', severity: 'action', skip: '0', take: '25' }), JSON.stringify(lastList(state)))
  const statuses = await page.locator('[data-testid=patterns-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')))
  check('…and the rows are the open ones', statuses.length > 0 && statuses.every((s) => s === 'open'), JSON.stringify(statuses))
  await page.fill('[data-testid=patterns-filter-store]', '4090')
  await waitUntil(() => lastList(state).storeCode === '4090')
  check('a store typed is sent as storeCode once typing stops', lastList(state).storeCode === '4090')
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=patterns-row]').length === 1)
  const row = strip(await page.textContent('[data-testid=patterns-row]'))
  check('the one case touching 4090 reads number, stores, dispenses, span, longest leg, gap, signals, score, status, value', ['PC-000123', '1001 · Olaya', '2040 · Buraydah Central', '4090 · Qurtubah (new)', '2 d 10 h', '637 km', '1 h 20 min', 'Impossible travel', 'Pharmacy hopping', 'Action', 'Open', '1840.50'].every((w) => row.includes(w)), row)
  const before = state.calls.list.length
  await page.fill('[data-testid=patterns-filter-from]', '2026-11-19')
  await page.fill('[data-testid=patterns-filter-to]', '2026-11-01')
  await page.waitForSelector('text=The period ends before it starts.')
  await page.waitForTimeout(400)
  check('a period that ends before it starts is refused on the page, and never asked for', !state.calls.list.slice(before).some((c) => c.query.from === '2026-11-19' && c.query.to === '2026-11-01'), JSON.stringify(state.calls.list.slice(before).map((c) => c.query)))
  await page.fill('[data-testid=patterns-filter-from]', '2026-11-01')
  await page.fill('[data-testid=patterns-filter-to]', '2026-11-30')
  await waitUntil(() => lastList(state).from === '2026-11-01' && lastList(state).to === '2026-11-30')
  check('a period is sent as from and to', lastList(state).from === '2026-11-01' && lastList(state).to === '2026-11-30', JSON.stringify(lastList(state)))
  await page.click('[data-testid=patterns-filter-clear]')
  await page.waitForFunction(() => new URL(location.href).search === '')
  await waitUntil(() => same(lastList(state), { skip: '0', take: '25' }))
  check('Clear filters empties the address and asks with no filter', same(lastList(state), { skip: '0', take: '25' }) && (await page.inputValue('[data-testid=patterns-filter-store]')) === '')
  await page.goto(LIST + '?signal=overlap&status=cleared&page=2')
  await waitUntil(() => lastList(state).signal === 'overlap')
  // Asked as pasted (the page falls back once the answer is in: review 5, below), so any read of it counts.
  const pasted = { signal: 'overlap', status: 'cleared', skip: '25', take: '25' }
  check('a pasted address is read back as filters and page', state.calls.list.some((c) => same(c.query, pasted)), JSON.stringify(lastList(state)))
  // Review 5: nine cases match, so page 2 is empty. It falls back to the last page (page 1), never "no case matches"
  // beside a count of 9 with no pager to leave by.
  const clamped = await settles(page.waitForFunction(() => !new URL(location.href).searchParams.has('page'), null, { timeout: 8000 }))
  await waitUntil(() => lastList(state).skip === '0')
  check(
    'an emptied page past the first falls back to the last page (page 1): its rows, no "no case matches"',
    clamped && same(lastList(state), { signal: 'overlap', status: 'cleared', skip: '0', take: '25' }) && (await page.locator('[data-testid=patterns-row]').count()) === 9 && (await page.locator('[data-testid=patterns-empty]').count()) === 0,
    JSON.stringify({ clamped, last: lastList(state), url: page.url() }),
  )
  await page.close()

  // ── 4. The case screen, the map drawn by the real adapter on a stand-in Google ─────────────────────────────────
  state = patternsState({ maps: MAPS })
  page = await open(state)
  await page.goto(LIST + '?store=4090')
  await page.click('[data-testid=patterns-row-case]')
  await page.waitForURL(`**/insurance/patterns/${TRAVEL_CASE.caseId}`)
  await page.waitForSelector('[data-testid=pattern-case]')
  check('a case number opens its screen at /insurance/patterns/:caseId', state.calls.detail.at(-1) === TRAVEL_CASE.caseId)
  const header = strip(await page.textContent('[data-testid=pattern-case-header]'))
  check('the header: case number, status, severity, score, signals', ['Case PC-000123', 'Open', 'Action', 'Score 4', 'Impossible travel', 'Pharmacy hopping'].every((w) => header.includes(w)), header)
  check('the header keeps a place for the case’s actions (923, 924), holding nothing yet', (await page.locator('[data-testid=pattern-case-actions]').count()) === 1 && (await page.locator('[data-testid=pattern-case-actions] > *').count()) === 0)
  const clearance = strip(await page.textContent('[data-testid=pattern-clearance]'))
  check('a previous clearance of the same patient shows at the top: who, when, why, and a link', clearance.includes('This patient was cleared before') && clearance.includes('Case PC-000099 was cleared by analyst2 on 2026-10-01 12:00.') && clearance.includes('Chronic patient who travels for work'), clearance)
  await page.waitForSelector('[data-map-state=drawn]', { timeout: 20000 })
  check('the map draws (the stand-in reports tiles loaded and idle)', true)
  const lines = await page.evaluate(() => window.__googleStandIn.polylines)
  const ink = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('[data-map-state]'))
    return { worse: s.getPropertyValue('--map-worse').trim(), ring: s.getPropertyValue('--map-ring').trim() }
  })
  check('three legs are drawn (the leg to the store without coordinates is not)', lines.length === 3, JSON.stringify(lines.map((l) => l.path)))
  check('…in time order: Olaya → Buraydah → Hail → Olaya', same(lines.map((l) => l.path), [[placeOf('1001'), placeOf('2040')], [placeOf('2040'), placeOf('5060')], [placeOf('5060'), placeOf('1001')]]), JSON.stringify(lines.map((l) => l.path)))
  check('the leg that fired the travel signal is drawn in the warning colour (--map-worse), the others plain (--map-ring)', lines[0]?.strokeColor === ink.worse && lines[1]?.strokeColor === ink.ring && lines[2]?.strokeColor === ink.ring && ink.worse !== ink.ring, JSON.stringify({ lines: lines.map((l) => l.strokeColor), ink }))
  const dammam = placeOf('3050')
  check('the delivery from Dammam is a point with no leg in or out', !lines.some((l) => l.path.some((p) => p.lat === dammam.lat && p.lng === dammam.lng)))
  check('a leg takes no tap', lines.every((l) => l.clickable === false))
  check('the travel leg is drawn above the plain ones (Hail, Buraydah, Riyadh lie nearly on one line)', lines[0]?.zIndex > lines[1]?.zIndex && lines[0]?.zIndex > lines[2]?.zIndex && lines[0]?.strokeWeight > lines[1]?.strokeWeight, JSON.stringify(lines.map((l) => [l.zIndex, l.strokeWeight])))
  const words = (await page.locator('[data-map-line]').allTextContents()).map(strip)
  check('each leg is labelled with its number, km and time', same(words, ['1 · 312 km · 1 h 40 min', '2 · 215 km · 1 d 4 h', '3 · 637 km · 1 d 3 h']), JSON.stringify(words))
  check('one point per store with coordinates: Olaya, Buraydah, Dammam (the delivery), Hail', (await page.locator('[data-map-markers] [data-feature=point]').count()) === 4)
  check('the store without coordinates is listed under the map', strip(await page.textContent('[data-testid=pattern-route-unplaced]')).includes('4090 · Qurtubah (new)'))
  check('the legend names the warning colour', strip(await page.textContent('[data-testid=pattern-route-legend]')).includes('A leg that fired the travel signal'))
  const signals = strip(await page.textContent('[data-testid=pattern-signals]'))
  check('each signal shows with its EN and AR words', signals.includes('312 km in 1 h 40 min, Olaya to Buraydah Central') && signals.includes('312 كم في 1 س 40 د') && signals.includes('5 صيدليات في 3 أيام'), signals)
  const timeline = page.locator('[data-testid=pattern-dispense]')
  check('the timeline lists every dispense', (await timeline.count()) === 6)
  const firstDispense = strip(await timeline.nth(0).textContent())
  check('…with store, time, item, quantity, days’ supply, payer, channel, pharmacist', ['1001 · Olaya', '2026-11-10 09:15', '100200 · Insulin glargine 100 IU/ml', '2', '30', 'BUPA', 'Counter', 'phx1001'].every((w) => firstDispense.includes(w)), firstDispense)
  check('…the delivery marked as a point, not a leg', strip(await page.textContent('[data-testid=pattern-dispense][data-counter=false]')).includes('Delivery: a point, not a leg'))
  check('…an unknown days’ supply says so', strip(await timeline.nth(3).textContent()).includes('Not known'))
  check('the previous cases are linked', strip(await page.textContent('[data-testid=pattern-previous]')).includes('PC-000099') && (await page.locator(`[data-testid=pattern-previous] a[href="/insurance/patterns/${CLEARED_CASE.caseId}"]`).count()) === 1)

  // ── 5. A mark round-trips ───────────────────────────────────────────────────────────────────────────────────────
  const reads = state.calls.detail.length
  check('the save button is held while nothing is chosen, its reason in its title', (await page.getAttribute('[data-testid=pattern-mark-save]', 'aria-disabled')) === 'true' && (await page.getAttribute('[data-testid=pattern-mark-save]', 'title')) === 'Choose a status.')
  await page.click('[data-testid=pattern-mark-save]', { force: true })
  await page.waitForSelector('text=Choose a status.')
  check('saving with no status says so, and sends nothing', state.calls.marks.length === 0)
  await page.selectOption('[data-testid=pattern-mark-status]', 'cleared')
  await page.click('[data-testid=pattern-mark-save]', { force: true })
  await page.waitForSelector('text=Write a note that says why.')
  check('saving with no note says so, and sends nothing', state.calls.marks.length === 0)
  const note = 'Known chronic traveller: works in Buraydah on Mondays.'
  await page.fill('[data-testid=pattern-mark-note]', `  ${note}  `)
  await page.click('[data-testid=pattern-mark-save]')
  await page.waitForSelector('[data-sonner-toast]:has-text("Mark saved")')
  check('the mark posts the status and the trimmed note — and no actor', same(state.calls.marks[0]?.body, { status: 'cleared', note }), JSON.stringify(state.calls.marks[0]?.body))
  check('…with the X-Web-Client header', !!state.calls.marks[0]?.csrf)
  await waitUntil(() => state.calls.detail.length > reads)
  await page.waitForFunction(() => document.querySelector('[data-testid=pattern-case]')?.getAttribute('data-status') === 'cleared')
  check('the case is read again and now reads Cleared', strip(await page.textContent('[data-testid=pattern-case-header]')).includes('Cleared'))
  const newest = strip(await page.textContent('[data-testid=pattern-mark] >> nth=0'))
  check('the new mark is listed first: status, who and when, and the note', newest.includes('Cleared') && newest.includes('msartawi on 2026-11-19 11:10') && newest.includes(note), newest)
  check('the form is empty again', (await page.inputValue('[data-testid=pattern-mark-note]')) === '' && (await page.inputValue('[data-testid=pattern-mark-status]')) === '')
  check('the map was not started again by the re-read (one map made)', (await page.evaluate(() => window.__googleStandIn.maps.length)) === 1)
  const arabic = 'المريض مزمن ويعمل في بريدة أيام الاثنين'
  await page.selectOption('[data-testid=pattern-mark-status]', 'watching')
  await page.fill('[data-testid=pattern-mark-note]', arabic)
  await page.click('[data-testid=pattern-mark-save]')
  await waitUntil(() => state.calls.marks.length === 2)
  await page.waitForFunction(() => document.querySelector('[data-testid=pattern-case]')?.getAttribute('data-status') === 'watching')
  check('an Arabic note round-trips as typed', state.calls.marks[1].body.note === arabic && strip(await page.textContent('[data-testid=pattern-mark] >> nth=0')).includes(arabic))

  // ── 6. A refused mark: the server's sentence, and the draft stays ───────────────────────────────────────────────
  state.markRefusal = { code: 'CASE_CLOSED', message: 'This case is closed; reopen it before marking.' }
  await page.selectOption('[data-testid=pattern-mark-status]', 'confirmed')
  await page.fill('[data-testid=pattern-mark-note]', 'Three pharmacies in one morning.')
  await page.click('[data-testid=pattern-mark-save]')
  await page.waitForSelector('text=This case is closed; reopen it before marking.')
  check('a refused mark shows the server’s sentence under "The mark was not saved"', strip(await page.textContent('[data-testid=pattern-mark-form]')).includes('The mark was not saved'))
  check('…and keeps the draft', (await page.inputValue('[data-testid=pattern-mark-note]')) === 'Three pharmacies in one morning.')
  state.markRefusal = null

  // ── 7. The list is read again after a mark ──────────────────────────────────────────────────────────────────────
  await page.goto(LIST + '?store=4090')
  await page.waitForSelector('[data-testid=patterns-row]')
  check('back on the list, the case reads its new status', (await page.getAttribute('[data-testid=patterns-row]', 'data-status')) === 'watching')

  // ── 8. The previous clearance links to the earlier case ─────────────────────────────────────────────────────────
  await page.goto(CASE(TRAVEL_CASE.caseId))
  await page.click('[data-testid=pattern-clearance-link]')
  await page.waitForURL(`**/insurance/patterns/${CLEARED_CASE.caseId}`)
  await page.waitForFunction(() => document.querySelector('[data-testid=pattern-case-number]')?.textContent?.includes('PC-000099'))
  check('the clearance links to the earlier case, which reads Cleared and has no banner of its own', strip(await page.textContent('[data-testid=pattern-case-header]')).includes('Cleared') && (await page.locator('[data-testid=pattern-clearance]').count()) === 0)
  await page.close()

  // ── 9. No `maps` part: the map cannot draw, the legs are a table, Google is never asked ─────────────────────────
  googleAsked.length = 0
  state = patternsState()
  page = await open(state)
  await page.goto(CASE(TRAVEL_CASE.caseId))
  await page.waitForSelector('[data-testid=pattern-route-cannot-draw]')
  const legRows = page.locator('[data-testid=pattern-leg]')
  check('with no key the map says it cannot draw, and the legs show as a table', (await legRows.count()) === 4)
  const legText = (await legRows.allTextContents()).map(strip)
  check('…numbered in time order as on the map, with km, time and speed', legText[0].startsWith('1') && legText[0].includes('1001 · Olaya') && legText[0].includes('2040 · Buraydah Central') && legText[0].includes('312 km') && legText[0].includes('1 h 40 min') && legText[0].includes('187 km/h'), legText[0])
  check('…the travel leg marked, the leg to the store without coordinates marked not on the map', legText[0].includes('Impossible travel') && legText[3].includes('Not on the map') && legText[3].includes('4090 · Qurtubah (new)'), JSON.stringify(legText))
  check('…and Google is never asked without a key', googleAsked.length === 0, googleAsked.join(' '))
  await page.goto(CASE('01JNOSUCHCASE'))
  await page.waitForSelector('text=The case could not be read')
  check('an unknown case shows the server’s sentence', strip(await page.textContent('[role=alert]')).includes('No case has this id.'))
  await page.close()

  // ── 10. RTL, in Arabic words ────────────────────────────────────────────────────────────────────────────────────
  // `oms.locale=ar` flips the direction at boot; the app's `lng` stays `en` until Arabic is switched on (core/i18n), so
  // the drive switches the SAME i18next instance the app uses to Arabic, to render the namespace's Arabic words.
  const toArabic = (p) => p.evaluate(async () => (await import('/src/core/i18n.ts')).default.changeLanguage('ar'))
  state = patternsState({ maps: MAPS })
  page = await open(state, { dir: 'rtl' })
  await page.goto(CASE(TRAVEL_CASE.caseId))
  await page.waitForSelector('[data-map-state=drawn]', { timeout: 20000 })
  await toArabic(page)
  await page.waitForSelector('text=المسار')
  await page.waitForSelector('[data-map-state=drawn]', { timeout: 20000 })
  check('RTL: the document is dir=rtl', (await page.getAttribute('html', 'dir')) === 'rtl')
  const body = strip(await page.textContent('[data-testid=pattern-case]'))
  check('RTL: the case reads in Arabic, no raw key on screen', body.includes('الحالة PC-000123') && body.includes('الخط الزمني') && body.includes('العلامات') && !/case\.(route|marks|timeline|facts)\.|status\.|signal\./.test(body), body.slice(0, 300))
  const facts = await page.locator('[data-testid=pattern-facts] [data-fact]').evaluateAll((els) => els.slice(0, 3).map((e) => e.getBoundingClientRect().x))
  check('RTL: the facts read right to left', facts[0] > facts[1] && facts[1] > facts[2], JSON.stringify(facts))
  const routeBox = await page.locator('[data-testid=pattern-route]').boundingBox()
  const marksBox = await page.locator('[data-testid=pattern-marks]').boundingBox()
  check('RTL: the route stands at the reading start (right), the marks beside it', routeBox.x > marksBox.x, JSON.stringify({ routeBox, marksBox }))
  const cols = await page.locator('[data-testid=pattern-timeline] th').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the timeline’s first column (store) is rightmost', cols[0] > cols[1] && cols[1] > cols[2], JSON.stringify(cols))
  const back = await page.locator('[data-testid=pattern-case-back]').boundingBox()
  check('RTL: the back link sits at the right, no wider than its words', back.x > 800 && back.width < 400, JSON.stringify(back))
  const leg1 = strip((await page.locator('[data-map-line]').allTextContents())[0])
  check('RTL: a leg’s words read in Arabic with Latin digits', leg1 === '1 · 312 كم · 1 س 40 د', leg1)
  await page.screenshot({ path: join(SHOT_DIR, '922-insurance-pattern-case-rtl-ar.png'), fullPage: true })
  await page.goto(LIST)
  await page.waitForSelector('[data-testid=patterns-table]')
  await toArabic(page)
  await page.waitForSelector('text=حالات أنماط الصرف')
  const listCols = await page.locator('[data-testid=patterns-table] th').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the list’s first column (case) is rightmost', listCols[0] > listCols[1], JSON.stringify(listCols))
  const filterBoxes = await page.locator('[data-testid=patterns-filters] > *').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x))
  check('RTL: the filters read right to left (store first)', filterBoxes[0] > filterBoxes[1], JSON.stringify(filterBoxes))
  check('RTL: the count reads in Arabic', strip(await page.textContent('[data-testid=patterns-count]')) === '62 حالة', strip(await page.textContent('[data-testid=patterns-count]')))
  await page.screenshot({ path: join(SHOT_DIR, '922-insurance-pattern-list-rtl-ar.png'), fullPage: true })
  await page.close()

  // ── 11. Review 9 and 4: beside a drawn map, the leg it cannot draw; two nearby stores stay two points ─────────────
  state = patternsState({ maps: MAPS })
  page = await open(state)
  await page.goto(CASE(TRAVEL_CASE.caseId))
  await page.waitForSelector('[data-map-state=drawn]', { timeout: 20000 })
  const offMap = (await page.locator('[data-testid=pattern-leg]').allTextContents()).map(strip)
  check(
    'beside a drawn map, the leg it cannot draw (to the store without coordinates) is listed, numbered 4 as in time order',
    offMap.length === 1 && offMap[0].startsWith('4') && offMap[0].includes('4090 · Qurtubah (new)') && offMap[0].includes('Not on the map'),
    JSON.stringify(offMap),
  )
  // Olaya and Malaz are 5.6 km apart: at the fitted zoom they would join under one opaque group disc, over their legs.
  await page.click(`[data-testid=pattern-previous] a[href="/insurance/patterns/${CLEARED_CASE.caseId}"]`)
  await page.waitForSelector(`[data-testid=pattern-case][data-case="${CLEARED_CASE.caseId}"]`)
  await page.waitForSelector('[data-map-state=drawn]', { timeout: 20000 })
  const marks = await page.locator('[data-map-markers] [data-feature]').evaluateAll((els) => els.map((e) => e.getAttribute('data-feature')))
  check('a route never joins its stores into a group: two stores 5.6 km apart are two points, their legs readable', same(marks, ['point', 'point']), JSON.stringify(marks))
  check('…and the two legs between them read on the map', same((await page.locator('[data-map-line]').allTextContents()).map(strip), ['1 · 5.6 km · 1 d 20 h\n2 · 5.6 km · 2 d 13 h']))

  // ── 12. Review 1: another case starts afresh — nothing typed on one case is carried to the next ─────────────────
  // PC-000099 is cached now. Back to PC-000123, a draft typed, then Forward: the page is reused for the cached case.
  await page.goBack()
  await page.waitForSelector(`[data-testid=pattern-case][data-case="${TRAVEL_CASE.caseId}"]`)
  await page.selectOption('[data-testid=pattern-mark-status]', 'confirmed')
  await page.fill('[data-testid=pattern-mark-note]', 'A draft typed on PC-000123.')
  await page.goForward()
  await page.waitForSelector(`[data-testid=pattern-case][data-case="${CLEARED_CASE.caseId}"]`)
  check(
    'another case starts afresh: the mark drafted on the last case is not carried to it',
    (await page.inputValue('[data-testid=pattern-mark-note]')) === '' && (await page.inputValue('[data-testid=pattern-mark-status]')) === '',
    JSON.stringify([await page.inputValue('[data-testid=pattern-mark-status]'), await page.inputValue('[data-testid=pattern-mark-note]')]),
  )
  await page.close()

  // ── 13. Review 10: a case opened at an address with its id padded is read again after a mark ─────────────────────
  state = patternsState()
  page = await open(state)
  await page.goto(`${LIST}/%20${TRAVEL_CASE.caseId}`)
  await page.waitForSelector('[data-testid=pattern-case][data-status=open]')
  let readsBefore = state.calls.detail.length
  await page.selectOption('[data-testid=pattern-mark-status]', 'watching')
  await page.fill('[data-testid=pattern-mark-note]', 'Opened from a pasted link with a space in it.')
  await page.click('[data-testid=pattern-mark-save]')
  await page.waitForSelector('[data-sonner-toast]:has-text("Mark saved")')
  const reread = await settles(page.waitForFunction(() => document.querySelector('[data-testid=pattern-case]')?.getAttribute('data-status') === 'watching', null, { timeout: 6000 }))
  check('a case opened at a padded address is read again after a mark: it reads Watching', reread && state.calls.detail.length > readsBefore, JSON.stringify({ reread, reads: state.calls.detail }))
  await page.close()

  // ── 14. Review 8 and 7: a note typed while a mark saves is kept; a failed re-read keeps the case ─────────────────
  special.length = 0
  state = patternsState()
  page = await open(state)
  await page.goto(CASE(TRAVEL_CASE.caseId))
  await page.waitForSelector('[data-testid=pattern-case][data-status=open]')
  const markPost = once((r) => r.method() === 'POST' && /\/Marks$/.test(apiPath(r)), { held: true })
  await page.selectOption('[data-testid=pattern-mark-status]', 'confirmed')
  await page.fill('[data-testid=pattern-mark-note]', 'First note.')
  await page.click('[data-testid=pattern-mark-save]')
  await markPost.arrived
  const later = 'A second thought, typed while the first was saving.'
  await page.fill('[data-testid=pattern-mark-note]', later)
  markPost.release()
  await page.waitForSelector('[data-sonner-toast]:has-text("Mark saved")')
  await settles(page.waitForFunction(() => document.querySelector('[data-testid=pattern-case]')?.getAttribute('data-status') === 'confirmed', null, { timeout: 6000 }))
  await page.waitForTimeout(300)
  const noteNow = () => page.evaluate(() => document.querySelector('[data-testid=pattern-mark-note]')?.value ?? null)
  check('the mark saved is the note sent, not the one typed after', state.calls.marks.at(-1)?.body.note === 'First note.', JSON.stringify(state.calls.marks.at(-1)))
  check('a note typed while a mark was saving is kept, not wiped by the save', (await noteNow()) === later, String(await noteNow()))

  // The case's re-read after the next mark fails: the case stays on screen, as last read.
  const failedRead = once((r) => r.method() === 'GET' && /^Insurance\/Patterns\/Cases\/[^/]+$/.test(apiPath(r)), {
    answer: businessRefusal('CASES_BUSY', 'The case store is busy; try again in a minute.', 503),
  })
  await page.selectOption('[data-testid=pattern-mark-status]', 'watching')
  await page.fill('[data-testid=pattern-mark-note]', 'Asked the payer for the claims.')
  await page.click('[data-testid=pattern-mark-save]')
  await settles(Promise.race([failedRead.arrived, new Promise((_, no) => setTimeout(no, 6000))]))
  await page.waitForTimeout(400)
  const stale = await settles(page.waitForSelector('[data-testid=pattern-case-stale]', { timeout: 6000 }))
  check(
    'a failed re-read keeps the case on screen, with a banner saying it could not be read again',
    stale && (await page.locator('[data-testid=pattern-case]').count()) === 1 && strip(await page.textContent('[data-testid=pattern-case-stale]')).includes('The case store is busy; try again in a minute.'),
  )
  if (stale) {
    readsBefore = state.calls.detail.length
    await page.click('[data-testid=pattern-case-retry]')
    await settles(page.waitForSelector('[data-testid=pattern-case-stale]', { state: 'detached', timeout: 6000 }))
    check('"Read again" reads the case: it reads Watching and the banner goes', state.calls.detail.length > readsBefore && (await page.getAttribute('[data-testid=pattern-case]', 'data-status')) === 'watching' && (await page.locator('[data-testid=pattern-case-stale]').count()) === 0)
  } else check('"Read again" reads the case: it reads Watching and the banner goes', false, 'no banner to read again from')
  await page.close()

  check('no page errors', errors.length === 0, errors.join(' | '))
  await browser.close()

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
