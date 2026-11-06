// Delivery statistics LIVE drive — spec 811 / ticket 817 (BackOffice 3404: 3405 courier, 3406 slot keeping,
// delivered per trip and Avg delivery time, 3407 the previous period). Supersedes the 488 drive.
//
// The stubbed tools/delivery-statistics-drive.mjs stays the regression for how the page DRAWS (it pins
// fixture values no real estate holds). This is its live twin: it stubs NOTHING, signs in for real, and
// asserts what holds for any real estate, following "What to check in 817" in the BackOffice brief
// (C:\Work\DMSCO\BackOffice\.issues\assets\3404-oms-react-situation-view-brief.md):
//   1. the envelope and the contract: the 488/2660 members, plus 3404's (root and store-row
//      avgDeliveryMinutes, the Delivery track's slot + deliveredPerTrip, both tracks' avgDeliveryMinutes,
//      previous) — their presence proves the 3405–3407 build;
//   2. totals = the sum of the store rows (flow, misses and each track's flow), all couriers and FREY;
//   3. slot keeping: inSlot + outOfSlot + noSlot = the Delivery track's Delivered; shares absent at 0;
//   4. couriers: each courier ≤ all couriers, figure by figure; the five couriers together ≤ all (the
//      rest = deliveries with no dispatch, and every pick-up); a courier counts no pick-up; DAWA answers
//      (no refusal); an unknown code is refused SDD-02132;
//   5. the previous window: Today = a week ago with `until` the next whole hour after asOf; Yesterday =
//      a week before, no `until`; a 7-day range ending yesterday = the 7 days before, no `until`; one
//      ending today = the 7 days before, with `until`; 31 days = the 31 days before; changePct absent
//      exactly when value is 0;
//   6. the page: it sends what the URL says (Courier included), its headline and funnel figures are the
//      server's, the courier caption shows and the Pick-up funnel goes under a courier;
//   7. the 32-day guard makes no call and the door refuses 32 days with SDD-02131; no page errors.
// It READS only: no door it calls writes anything.
//
// Till parity cannot be driven (the till's door is x-api-key): the drive PRINTS one store's Yesterday
// figures; the owner reads the till's Statistics view for the same store and day.
//
//   1. $env:SIS_API='http://172.23.10.110:4433'; npx vite --port 5250 --strictPort
//   2. sign in one of three ways, the secret never in the repo:
//        SIS_SIGN_IN=window            — a visible browser opens on /login; sign in there by hand
//        SIS_USER=<id> SIS_PASS=<pw>   — POST Auth/Login through the proxy
//        SIS_COOKIE=<sis_session>      — a cookie copied from a browser session
//   3. DRIVE_PORT=5250 [PARITY_STORE=P019] node tools/delivery-statistics-live-drive.mjs
//      PARITY_STORE unset = the store that handed most over yesterday.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5250}`
const SHOTS = 'tools/.delivery-statistics-live-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const note = (text) => console.log(`NOTE  ${text}`)

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => {
  const d = new Date()
  return day(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}
const TODAY = daysAgo(0)
const YESTERDAY = daysAgo(1)

// ── The contract (BackOffice 3404 brief; src/core/models/delivery-statistics.ts) ──────────────────
const FLOW = ['cameIn', 'madeReady', 'outForDelivery', 'trips', 'delivered', 'pickedUp', 'handedOver']
const MISSES = ['returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled']
const COUNTS = [...FLOW.map((k) => ['flow', k]), ...MISSES.map((k) => ['misses', k])]
const TRACK_FLOW = { delivery: ['cameIn', 'madeReady', 'outForDelivery', 'trips', 'handedOver'], pickUp: ['cameIn', 'madeReady', 'handedOver'] }
const COURIERS = ['FREY', 'OTOX', 'SMSA', 'SLNK', 'DAWA']
const has = (o, k) => o !== null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k)
const n = (v) => (typeof v === 'number' ? v : 0)

// ── Sign-in ─────────────────────────────────────────────────────────────────────────────────────
const WINDOW = process.env.SIS_SIGN_IN === 'window'
const browser = await chromium.launch({ headless: !WINDOW })
const context = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
if (WINDOW) {
  const login = await context.newPage()
  await login.goto(`${BASE}/login`)
  console.log('Sign in in the browser window that just opened (5 minutes)…')
  let signedIn = false
  for (let i = 0; i < 1500 && !signedIn; i++) {
    signedIn = (await context.cookies(BASE)).some((c) => c.name === 'sis_session') && !new URL(login.url()).pathname.startsWith('/login')
    if (!signedIn) await login.waitForTimeout(200)
  }
  if (!signedIn) {
    console.error('No sign-in within 5 minutes.')
    process.exit(2)
  }
  console.log('Signed in.')
  await login.close()
} else if (process.env.SIS_COOKIE) {
  await context.addCookies([{ name: 'sis_session', value: process.env.SIS_COOKIE, url: BASE }])
} else if (process.env.SIS_USER) {
  const res = await context.request
    .post(`${BASE}/api/Auth/Login`, {
      headers: { 'Content-Type': 'application/json', 'X-Web-Client': '1' },
      data: { userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' },
    })
    .catch((e) => {
      console.error(`No dev server answers on ${BASE} (${e.message.split('\n')[0]}). Start vite with SIS_API first.`)
      process.exit(2)
    })
  const body = await res.json().catch(() => null)
  if (!(await context.cookies(BASE)).some((c) => c.name === 'sis_session')) {
    console.error(`Login did not set a session cookie (HTTP ${res.status()}): ${body?.message ?? ''}`)
    process.exit(2)
  }
  console.log(`Signed in as ${body?.data?.userId ?? process.env.SIS_USER}.`)
} else {
  console.error('Set SIS_SIGN_IN=window, SIS_USER + SIS_PASS, or SIS_COOKIE.')
  process.exit(2)
}

// ── The door, read directly (through the proxy, on the signed-in session) ────────────────────────
const why = (res, body) => `HTTP ${res.status()} ${body?.errors?.[0]?.errorCode ?? ''} ${body?.message ?? ''}`.trim()
/** One read of the door. `q` is the door's own query (From, To, Granularity, StoreCode?, Courier?). */
async function door(q) {
  const qs = new URLSearchParams({ LeaveOutChurned: 'true', ...q })
  const res = await context.request.get(`${BASE}/api/SdDocumentWeb/StoreStatistics?${qs}`, { headers: { 'X-Web-Client': '1' } })
  const body = await res.json().catch(() => null)
  return { res, body, data: body?.success === true ? body.data : null }
}
async function read(label, q) {
  const r = await door(q)
  check(`${label}: the door answers on the envelope`, r.data !== null, r.data ? '' : why(r.res, r.body))
  return r.data
}

const PERIODS = {
  today: { From: TODAY, To: TODAY, Granularity: 'hour' },
  yesterday: { From: YESTERDAY, To: YESTERDAY, Granularity: 'hour' },
  range7: { From: daysAgo(7), To: YESTERDAY, Granularity: 'day' },
  range7today: { From: daysAgo(6), To: TODAY, Granularity: 'day' },
  range31: { From: daysAgo(31), To: YESTERDAY, Granularity: 'day' },
}

// ── 1. The build: 3404's members are on the wire ─────────────────────────────────────────────────
const yAll = await read('Yesterday, all stores', PERIODS.yesterday)
if (!yAll) {
  console.error('No answer for Yesterday: stopping.')
  await browser.close()
  process.exit(1)
}
{
  const d = yAll
  const del = d.tracks?.delivery
  const missing = [
    ['avgDeliveryMinutes', has(d, 'avgDeliveryMinutes')],
    ['previous', has(d, 'previous')],
    ['tracks.delivery.slot', has(del, 'slot')],
    ['tracks.delivery.deliveredPerTrip', has(del, 'deliveredPerTrip')],
    ['tracks.delivery.avgDeliveryMinutes', has(del, 'avgDeliveryMinutes')],
    ['tracks.pickUp.avgDeliveryMinutes', has(d.tracks?.pickUp, 'avgDeliveryMinutes')],
    ['stores[].avgDeliveryMinutes', d.stores.every((s) => has(s, 'avgDeliveryMinutes'))],
    ['stores[].tracks.delivery.slot', d.stores.every((s) => has(s.tracks?.delivery, 'slot'))],
  ].filter(([, ok]) => !ok)
  check('the answer carries every 3404 member (the 3405–3407 build is deployed)', missing.length === 0, missing.map(([k]) => k).join(', ') || `${d.stores.length} store rows`)
  check('flow and misses keep the 488 contract (Trips included)', FLOW.every((k) => has(d.flow, k)) && MISSES.every((k) => has(d.misses, k)))
  const slot = del?.slot
  if (slot) {
    check('slot carries its three counts', ['inSlot', 'outOfSlot', 'noSlot'].every((k) => typeof slot[k] === 'number'), JSON.stringify(slot))
  }
}

// ── 2/3. Totals, slot keeping, the shares ────────────────────────────────────────────────────────
function invariants(label, d, { allStores }) {
  if (allStores) {
    const off = COUNTS.filter(([band, k]) => n(d[band][k]) !== d.stores.reduce((t, s) => t + n(s[band][k]), 0)).map(
      ([band, k]) => `${k}: ${d[band][k]} vs Σ ${d.stores.reduce((t, s) => t + n(s[band][k]), 0)}`,
    )
    check(`${label}: every total is the sum of the store rows (${d.stores.length} rows)`, off.length === 0, off.join('; '))
    const trackOff = Object.entries(TRACK_FLOW).flatMap(([track, keys]) =>
      keys
        .filter((k) => n(d.tracks?.[track]?.flow?.[k]) !== d.stores.reduce((t, s) => t + n(s.tracks?.[track]?.flow?.[k]), 0))
        .map((k) => `${track}.${k}: ${d.tracks?.[track]?.flow?.[k]} vs Σ ${d.stores.reduce((t, s) => t + n(s.tracks?.[track]?.flow?.[k]), 0)}`),
    )
    check(`${label}: each track's flow is the sum of the store rows' tracks`, trackOff.length === 0, trackOff.join('; '))
    const slotOff = ['inSlot', 'outOfSlot', 'noSlot'].filter(
      (k) => n(d.tracks?.delivery?.slot?.[k]) !== d.stores.reduce((t, s) => t + n(s.tracks?.delivery?.slot?.[k]), 0),
    )
    check(`${label}: the slot counts are the sum of the store rows'`, slotOff.length === 0, slotOff.join(', '))
    const blank = d.stores.filter((s) => s.storeCode === '')
    if (blank.length) note(`${label}: a blank-store row is present (BackOffice 3429, callout Came in ${blank[0].flow.cameIn}); the page names it "Unassigned (callout)"`)
  }
  const del = d.tracks?.delivery
  const slot = del?.slot
  if (slot) {
    const judged = slot.inSlot + slot.outOfSlot + slot.noSlot
    check(
      `${label}: In slot + Out of slot + No slot = the Delivery track's Delivered`,
      judged === n(del.flow?.handedOver),
      `${slot.inSlot} + ${slot.outOfSlot} + ${slot.noSlot} = ${judged} vs Delivered ${del.flow?.handedOver}`,
    )
    check(
      `${label}: the shares are sent exactly when something was judged, and are 0–1`,
      judged === 0
        ? !has(slot, 'inSlotShare') && !has(slot, 'outOfSlotShare')
        : [slot.inSlotShare, slot.outOfSlotShare].every((x) => typeof x === 'number' && x >= 0 && x <= 1),
      JSON.stringify(slot),
    )
  }
  if (del && has(del, 'deliveredPerTrip')) {
    const trips = n(del.flow?.trips)
    check(
      `${label}: Delivered per trip is null with no trips, a number with trips`,
      trips === 0 ? del.deliveredPerTrip === null : typeof del.deliveredPerTrip === 'number',
      `trips ${trips}, deliveredPerTrip ${del.deliveredPerTrip}`,
    )
  }
}

invariants('Yesterday, all stores', yAll, { allStores: true })

// ── 5. The previous window ───────────────────────────────────────────────────────────────────────
function previousFigures(label, p) {
  const figures = ['cameIn', 'handedOver', 'avgDeliveryMinutes', 'inSlotShare', 'outOfSlotShare', 'deliveredPerTrip'].filter((k) => has(p, k))
  const bad = figures.filter((k) => {
    const f = p[k]
    return typeof f.value !== 'number' || typeof f.change !== 'number' || (f.value === 0 ? has(f, 'changePct') : typeof f.changePct !== 'number')
  })
  check(`${label}: each previous figure is { value, change, changePct } with changePct absent exactly at value 0`, bad.length === 0, bad.map((k) => `${k} ${JSON.stringify(p[k])}`).join('; ') || `${figures.length} figure(s)`)
  return figures.length
}
function previous(label, d, { from, to, until }) {
  const p = d.previous
  if (!p) return check(`${label}: a previous block is sent`, false)
  const pf = String(p.from).slice(0, 10)
  const pt = String(p.to).slice(0, 10)
  check(`${label}: the compared window is ${from} … ${to}`, pf === from && pt === to, `${p.from} … ${p.to}`)
  if (until === false) check(`${label}: no until`, !has(p, 'until'), String(p.until))
  else {
    const want = until
    check(`${label}: until is the next whole hour after asOf on the last compared day`, has(p, 'until') && String(p.until).startsWith(want), `until ${p.until}, want ${want}…, asOf ${d.asOf}`)
  }
  const count = previousFigures(label, p)
  if (count === 0) note(`${label}: the previous block has no figures — a 054 rebuild still pending, or no history for that window`)
  return count
}
/** `onDay` (yyyy-MM-dd) at the next whole hour after asOf's hour; hour 23 rolls to the next day's 00:00. */
const nextHour = (asOf, onDay) => {
  const h = asOf ? Number(String(asOf).slice(11, 13)) : new Date().getHours()
  const [y, m, dd] = onDay.split('-').map(Number)
  const at = new Date(y, m - 1, dd, h + 1)
  return `${day(at)}T${pad(at.getHours())}:00`
}

previous('Yesterday', yAll, { from: daysAgo(8), to: daysAgo(8), until: false })

const tAll = await read('Today, all stores', PERIODS.today)
if (tAll) {
  invariants('Today, all stores', tAll, { allStores: true })
  previous('Today', tAll, { from: daysAgo(7), to: daysAgo(7), until: nextHour(tAll.asOf, daysAgo(7)) })
  const ageMin = tAll.asOf ? (Date.now() - new Date(tAll.asOf).getTime()) / 60000 : null
  check('AsOf is at most 5 minutes old (the aggregator ticks)', ageMin !== null && ageMin >= -1 && ageMin <= 6, `asOf ${tAll.asOf}`)
}
const r7 = await read('Range 7 days ending yesterday', PERIODS.range7)
if (r7) {
  invariants('Range 7 days', r7, { allStores: true })
  previous('Range 7 days ending yesterday', r7, { from: daysAgo(14), to: daysAgo(8), until: false })
}
const r7t = await read('Range 7 days ending today', PERIODS.range7today)
if (r7t) previous('Range 7 days ending today', r7t, { from: daysAgo(13), to: daysAgo(7), until: nextHour(r7t.asOf, daysAgo(7)) })
const r31 = await read('Range 31 days', PERIODS.range31)
if (r31) {
  invariants('Range 31 days', r31, { allStores: true })
  const figures = previous('Range 31 days', r31, { from: daysAgo(62), to: daysAgo(32), until: false })
  check('Range 31 days: every previous figure is present (the 054 rebuild kept 62 days)', figures === 6, `${figures}/6`)
}

// ── 4. Couriers ──────────────────────────────────────────────────────────────────────────────────
const byCourier = {}
for (const c of COURIERS) {
  byCourier[c] = await read(`Yesterday, Courier ${c}`, { ...PERIODS.yesterday, Courier: c })
  const d = byCourier[c]
  if (!d) continue
  invariants(`Yesterday, ${c}`, d, { allStores: true })
  const more = COUNTS.filter(([band, k]) => n(d[band][k]) > n(yAll[band][k])).map(([band, k]) => `${k} ${d[band][k]} > ${yAll[band][k]}`)
  check(`Yesterday, ${c}: every figure is at most the all-couriers figure`, more.length === 0, more.join('; '))
  const pick = d.tracks?.pickUp?.flow
  check(`Yesterday, ${c}: no pick-up counts under a courier`, !pick || TRACK_FLOW.pickUp.every((k) => n(pick[k]) === 0), JSON.stringify(pick))
}
if (COURIERS.every((c) => byCourier[c])) {
  const over = COUNTS.filter(([band, k]) => COURIERS.reduce((t, c) => t + n(byCourier[c][band][k]), 0) > n(yAll[band][k])).map(
    ([band, k]) => `${k}: Σ ${COURIERS.reduce((t, c) => t + n(byCourier[c][band][k]), 0)} > ${yAll[band][k]}`,
  )
  check('Yesterday: the five couriers together never exceed all couriers (no delivery under two)', over.length === 0, over.join('; '))
  const rest = n(yAll.tracks?.delivery?.flow?.cameIn) - COURIERS.reduce((t, c) => t + n(byCourier[c].tracks?.delivery?.flow?.cameIn), 0)
  note(`Yesterday: home deliveries that came in with no dispatch = ${rest} (all ${yAll.tracks?.delivery?.flow?.cameIn}; ${COURIERS.map((c) => `${c} ${byCourier[c].tracks?.delivery?.flow?.cameIn}`).join(', ')})`)
}
{
  const r = await door({ ...PERIODS.yesterday, Courier: 'XXXX' })
  check('an unknown courier is refused SDD-02132 on the envelope', r.body?.success === false && r.body?.errors?.[0]?.errorCode === 'SDD-02132', why(r.res, r.body))
  const lower = await door({ ...PERIODS.yesterday, Courier: 'frey' })
  check('the courier code is case-insensitive', lower.data !== null && lower.data.flow.cameIn === byCourier.FREY?.flow.cameIn, why(lower.res, lower.body))
}

// ── One store ────────────────────────────────────────────────────────────────────────────────────
const top = yAll.stores.filter((s) => s.storeCode).slice().sort((a, b) => n(b.flow.handedOver) - n(a.flow.handedOver))[0]?.storeCode
const STORE = process.env.PARITY_STORE || top
let yOne = null
if (STORE) {
  yOne = await read(`Yesterday, ${STORE}`, { ...PERIODS.yesterday, StoreCode: STORE })
  if (yOne) {
    invariants(`Yesterday, ${STORE}`, yOne, { allStores: false })
    const row = yAll.stores.find((s) => s.storeCode === STORE)
    const off = row ? COUNTS.filter(([band, k]) => n(row[band][k]) !== n(yOne[band][k])).map(([band, k]) => `${k}: ${yOne[band][k]} vs ${row[band][k]}`) : ['no row']
    check(`Yesterday: ${STORE} alone equals its row in the all-store answer, Avg delivery time included`, off.length === 0 && row.avgDeliveryMinutes === yOne.avgDeliveryMinutes, off.join('; '))
  }
  const fOne = await read(`Yesterday, ${STORE}, FREY`, { ...PERIODS.yesterday, StoreCode: STORE, Courier: 'FREY' })
  if (fOne && yOne) {
    const more = COUNTS.filter(([band, k]) => n(fOne[band][k]) > n(yOne[band][k])).map(([, k]) => k)
    check(`Yesterday, ${STORE}: FREY is at most the store's all-couriers figures`, more.length === 0, more.join(', '))
  }
}

// ── 6. The page draws what the door sent ─────────────────────────────────────────────────────────
const answers = []
const errors = []
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
page.on('response', async (res) => {
  const url = new URL(res.url())
  if (!url.pathname.endsWith('/api/SdDocumentWeb/StoreStatistics')) return
  const body = await res.json().catch(() => null)
  answers.push({ query: Object.fromEntries(url.searchParams), status: res.status(), body })
})
await page.addInitScript(() => {
  localStorage.setItem('oms.locale', 'en')
  localStorage.setItem('oms.railExpanded', 'true')
})
const digits = (s) => (s === null || s === undefined ? null : s.replace(/[^\d.\-—]/g, ''))
async function open(label, search) {
  const since = answers.length
  await page.goto(`${BASE}/oms/delivery-statistics${search}`)
  for (let i = 0; i < 600 && answers.length === since; i++) await page.waitForTimeout(100)
  const a = answers.slice(since).at(-1)
  if (!a || !(a.status === 200 && a.body?.success === true)) {
    check(`${label}: the page's answer is on the envelope`, false, a ? `HTTP ${a.status}` : 'no request within 60s')
    return null
  }
  await page.locator('[data-statistics-headline]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  return { query: a.query, data: a.body.data }
}
async function pageFigures() {
  return page.evaluate(() => ({
    headline: Object.fromEntries(
      [...document.querySelectorAll('[data-statistics-headline] [data-figure-tile]')].map((el) => [el.getAttribute('data-figure-tile'), el.querySelector('[data-kpi-value]')?.textContent ?? null]),
    ),
    stages: Object.fromEntries([...document.querySelectorAll('[data-statistics-stages] [data-figure]')].map((el) => [el.getAttribute('data-figure'), el.textContent])),
    pickUpFunnel: !!document.querySelector('[data-statistics-funnels] [data-statistics-band="pickUp"]'),
    courierCaption: document.querySelector('[data-statistics-courier-caption]')?.textContent ?? null,
  }))
}
const fixed = (v, places) => (typeof v === 'number' ? v.toFixed(places) : '—')
function headlineIsServers(label, f, d) {
  const del = d.tracks?.delivery
  const want = {
    cameIn: String(d.flow.cameIn),
    handedOver: String(d.flow.handedOver),
    inSlot: typeof del?.slot?.inSlotShare === 'number' ? (del.slot.inSlotShare * 100).toFixed(1) : '—',
    outOfSlot: typeof del?.slot?.outOfSlotShare === 'number' ? (del.slot.outOfSlotShare * 100).toFixed(1) : '—',
    deliveredPerTrip: fixed(del?.deliveredPerTrip, 2),
    avgDeliveryMinutes: fixed(d.avgDeliveryMinutes, 1),
  }
  const off = Object.entries(want).filter(([id, w]) => {
    const got = digits(f.headline[id])
    if (w === '—') return got !== '—'
    return got === null || Math.abs(Number(got) - Number(w)) > (id === 'deliveredPerTrip' ? 0.011 : 0.051)
  })
  check(`${label}: the six headline figures are the server's`, off.length === 0, off.map(([id, w]) => `${id}: page ${f.headline[id]} vs ${w}`).join('; ') || JSON.stringify(f.headline))
}
function stagesAreServers(label, f, d) {
  const off = []
  for (const [track, keys] of Object.entries(TRACK_FLOW)) {
    for (const k of keys.filter((x) => x !== 'trips' && x !== 'handedOver')) {
      const got = f.stages[`${track}.${k}`]
      if (got !== undefined && Number(digits(got)) !== n(d.tracks?.[track]?.flow?.[k])) off.push(`${track}.${k}: ${got} vs ${d.tracks?.[track]?.flow?.[k]}`)
    }
  }
  check(`${label}: the funnel stages are the server's`, off.length === 0, off.join('; ') || `${Object.keys(f.stages).length} figures`)
}

const pY = await open('Page, Yesterday', '?period=yesterday')
if (pY) {
  check('Page, Yesterday: sends no Courier with all couriers', !('Courier' in pY.query), JSON.stringify(pY.query))
  const f = await pageFigures()
  headlineIsServers('Page, Yesterday', f, pY.data)
  stagesAreServers('Page, Yesterday', f, pY.data)
  check('Page, Yesterday: both funnels drawn and no courier caption with all couriers', f.pickUpFunnel && f.courierCaption === null)
  await page.screenshot({ path: `${SHOTS}/yesterday-all.png`, fullPage: true })
}
const pF = await open('Page, Yesterday, FarEye', '?period=yesterday&courier=FREY')
if (pF) {
  check('Page, FarEye: sends Courier=FREY', pF.query.Courier === 'FREY', JSON.stringify(pF.query))
  const f = await pageFigures()
  headlineIsServers('Page, FarEye', f, pF.data)
  check('Page, FarEye: the courier caption shows and the Pick-up funnel is not drawn', f.courierCaption !== null && !f.pickUpFunnel, String(f.courierCaption))
  await page.screenshot({ path: `${SHOTS}/yesterday-fareye.png`, fullPage: true })
}
{
  // An unknown courier in a link is sent as written; the page shows the server's refusal in its words.
  const since = answers.length
  await page.goto(`${BASE}/oms/delivery-statistics?period=yesterday&courier=XXXX`)
  for (let i = 0; i < 600 && answers.length === since; i++) await page.waitForTimeout(100)
  const a = answers.slice(since).at(-1)
  check('Page, unknown courier: sends Courier=XXXX and the door refuses SDD-02132', a?.query.Courier === 'XXXX' && a?.body?.errors?.[0]?.errorCode === 'SDD-02132', a ? `HTTP ${a.status}` : 'no request')
  await page.waitForTimeout(800)
  const shown = await page.locator('main').innerText()
  check("Page, unknown courier: the server's own message is shown", !!a?.body?.message && shown.includes(a.body.message), String(a?.body?.message))
  await page.screenshot({ path: `${SHOTS}/unknown-courier.png`, fullPage: true })
}
const pT = await open('Page, Today', '')
if (pT) {
  const compared = await page.locator('[data-statistics-compared]').innerText().catch(() => '')
  const until = String(pT.data.previous?.until ?? '').slice(11, 16)
  check("Page, Today: the compared window reads \"vs <last week's day> to <until>\"", compared.trim() === `vs ${daysAgo(7)} to ${until}`, compared)
  await page.screenshot({ path: `${SHOTS}/today-all.png`, fullPage: true })
}
const pR = await open('Page, Range 31 days', '?period=range&pick=31')
if (pR) {
  headlineIsServers('Page, Range 31 days', await pageFigures(), pR.data)
  await page.screenshot({ path: `${SHOTS}/range31-all.png`, fullPage: true })
}

// ── 7. The 32-day guard ──────────────────────────────────────────────────────────────────────────
{
  const since = answers.length
  await page.goto(`${BASE}/oms/delivery-statistics?period=range&pick=custom&from=${daysAgo(31)}&to=${TODAY}`)
  await page.locator('[data-statistics-refused="tooLong"]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(1500)
  check('32 days inclusive is refused in the UI and makes NO call', answers.length === since, `${answers.length - since} call(s)`)
  const r = await door({ From: daysAgo(31), To: TODAY, Granularity: 'day' })
  check('and the door itself refuses 32 days with SDD-02131', r.body?.success === false && r.body?.errors?.[0]?.errorCode === 'SDD-02131', why(r.res, r.body))
}

check('no page errors', errors.length === 0, errors.join(' | '))

// ── The till parity record ───────────────────────────────────────────────────────────────────────
if (yOne) {
  const d = yOne
  console.log(`\nTill parity — store ${STORE}, Yesterday (${YESTERDAY}), all couriers, churned refills left out, no types left out.`)
  console.log("Read the till's Statistics view for the same store and day (avgHandOverMinutes is not compared — 817 ruling):")
  const fmt = (v) => (v === null || v === undefined ? '—' : String(v))
  for (const k of FLOW) console.log(`  ${('flow.' + k).padEnd(28)} web ${fmt(d.flow[k]).padStart(6)}   till ____`)
  for (const k of MISSES) console.log(`  ${('misses.' + k).padEnd(28)} web ${fmt(d.misses[k]).padStart(6)}   till ____`)
  for (const [track, keys] of Object.entries(TRACK_FLOW)) for (const k of keys) console.log(`  ${(track + '.' + k).padEnd(28)} web ${fmt(d.tracks?.[track]?.flow?.[k]).padStart(6)}   till ____`)
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
