// Delivery statistics LIVE drive (ticket 488, BackOffice 2639 + 2641, ADR 0081).
//
// The stubbed tools/delivery-statistics-drive.mjs stays the regression for the page's behaviour (it
// pins fixture values no real estate holds). This is its live twin: it stubs NOTHING, signs in for
// real, and asserts what holds for any real estate against `GET SdDocumentWeb/StoreStatistics`:
//   1. every answer is on the envelope with exactly the contract's keys (SdDocumentWebEndpoints'
//      class doc), Trips included;
//   2. Today, Yesterday and the 31-day Range, for all stores and for one store, with the leave-outs
//      on and off — each draws exactly what came back (figures, table rows, chart buckets);
//   3. totals: with no store chosen, every count equals the sum of the `stores[]` rows;
//   4. one store's answer equals its row in the all-store answer (Yesterday: a frozen day);
//   5. leave-outs only ever take away: churned off ≥ churned on, types left out ≤ none left out;
//   6. the 32-day guard makes no call; the door itself refuses 32 days with SDD-02131;
//   7. AsOf is at most 5 minutes old;
//   8. no page errors.
// It READS only: no door it calls writes anything.
//
// The till parity (the ticket's third proof) cannot be driven: the till's door is x-api-key. The drive
// PRINTS the one-store figures for the parity period; the owner reads the till's Statistics view for the
// same store and period and records both in the ticket.
//
//   1. point the dev proxy at the SIS.Api under test and run the app:
//        $env:SIS_API='https://<host>'; npx vite --port 5250 --strictPort
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => {
  const d = new Date()
  return day(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}
const TODAY = daysAgo(0)
const YESTERDAY = daysAgo(1)

// ── The contract's keys (SdDocumentWebEndpoints' class doc; src/core/models/delivery-statistics.ts) ──
const TOP = ['asOf', 'flow', 'misses', 'avgHandOverMinutes', 'series', 'stores']
const FLOW = ['cameIn', 'madeReady', 'outForDelivery', 'trips', 'delivered', 'pickedUp', 'handedOver']
const MISSES = ['returnedBack', 'rejected', 'rescheduled', 'closeRequested', 'closedOrCancelled']
const BUCKET = ['bucket', 'cameIn', 'handedOver']
const STORE = ['storeCode', 'flow', 'misses', 'avgHandOverMinutes']
const COUNTS = [...FLOW.map((k) => ['flow', k]), ...MISSES.map((k) => ['misses', k])]
const keysOf = (o) => Object.keys(o ?? {}).sort()
const hasKeys = (o, want) => same(keysOf(o), [...want].sort())

// ── Sign-in ─────────────────────────────────────────────────────────────────────────────────────
// SIS_SIGN_IN=window opens a visible browser on the login page; the owner signs in there (OTP and
// all), and the drive goes on once the session cookie lands. No secret ever reaches the drive.
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
    console.error('If the account needs an OTP, sign in in a browser and pass SIS_COOKIE instead.')
    process.exit(2)
  }
  console.log(`Signed in as ${body?.data?.userId ?? process.env.SIS_USER}.`)
} else {
  console.error('Set SIS_USER + SIS_PASS, or SIS_COOKIE.')
  process.exit(2)
}

// ── The page harness ────────────────────────────────────────────────────────────────────────────
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

const why = (a) => (a ? `HTTP ${a.status} ${a.body?.errors?.[0]?.errorCode ?? ''} ${a.body?.message ?? ''}`.trim() : 'no answer')

/** The figures as drawn: the number inside each tile's <bdi dir="ltr">. */
const drawn = () =>
  page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('[data-figure]')].map((el) => [el.getAttribute('data-figure'), el.querySelector('bdi[dir="ltr"]')?.textContent ?? null])),
  )
/** The table's row count off the grid's aria-rowcount (header row out): AG Grid draws only the rows in view. */
const tableCount = () =>
  page.evaluate(() => Number(document.querySelector('[data-statistics-stores] [aria-rowcount]')?.getAttribute('aria-rowcount') ?? 1) - 1)
const fmt = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 2 }))

/** Opens the page on a search, waits for its one statistics answer and the figures. */
async function load(label, search) {
  const since = answers.length
  await page.goto(`${BASE}/oms/delivery-statistics${search}`)
  for (let i = 0; i < 600 && answers.length === since; i++) await page.waitForTimeout(100)
  const a = answers.slice(since).at(-1)
  if (!a) {
    check(`${label}: the door answers`, false, 'no StoreStatistics request within 60s')
    return null
  }
  const ok = a.status === 200 && a.body?.success === true
  check(`${label}: the door answers on the envelope`, ok, ok ? '' : why(a))
  if (!ok) return null
  await page.locator('[data-statistics-band="flow"]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  return { query: a.query, data: a.body.data }
}

/** The contract, the page drawing what came back, and (all stores) the totals = the rows. */
async function verify(label, r, { granularity, buckets, allStores, store }) {
  const d = r.data
  check(`${label}: the answer has exactly the contract's keys`, hasKeys(d, TOP), keysOf(d).join(','))
  check(`${label}: flow and misses have exactly the contract's keys (Trips included)`, hasKeys(d.flow, FLOW) && hasKeys(d.misses, MISSES), `${keysOf(d.flow)} | ${keysOf(d.misses)}`)
  check(
    `${label}: every store row has exactly the contract's keys`,
    d.stores.every((s) => hasKeys(s, STORE) && hasKeys(s.flow, FLOW) && hasKeys(s.misses, MISSES)),
    d.stores.length ? keysOf(d.stores[0]).join(',') : 'no rows',
  )
  check(
    `${label}: ${buckets} ${granularity} buckets, each { bucket, cameIn, handedOver }`,
    d.series.length === buckets && d.series.every((b) => hasKeys(b, BUCKET)),
    `${d.series.length} bucket(s)`,
  )
  check(`${label}: the query is the page's (Granularity ${granularity}${store ? `, StoreCode ${store}` : ', no StoreCode'})`, r.query.Granularity === granularity && r.query.StoreCode === store, JSON.stringify(r.query))

  const f = await drawn()
  const wrong = COUNTS.filter(([band, k]) => f[k] !== fmt(d[band][k])).map(([band, k]) => `${k}: ${f[k]} vs ${d[band][k]}`)
  check(`${label}: every figure on the page is the server's`, wrong.length === 0, wrong.join('; '))
  const avg = d.avgHandOverMinutes
  check(
    `${label}: Avg hand-over is the server's`,
    avg === null ? f.avgHandOver === '—' : Math.abs(Number(f.avgHandOver.replace(/,/g, '')) - avg) < 0.01,
    `${f.avgHandOver} vs ${avg}`,
  )
  const rows = await tableCount()
  check(`${label}: the store table draws one row per store row`, rows === d.stores.length, `${rows} vs ${d.stores.length}`)
  const columns = await page.locator('[data-statistics-band="chart"] [data-chart-column]').count()
  check(`${label}: the chart draws every bucket`, columns === d.series.length, `${columns} vs ${d.series.length}`)

  if (allStores) {
    const off = COUNTS.filter(([band, k]) => d[band][k] !== d.stores.reduce((t, s) => t + (s[band][k] ?? 0), 0)).map(
      ([band, k]) => `${k}: ${d[band][k]} vs Σ ${d.stores.reduce((t, s) => t + (s[band][k] ?? 0), 0)}`,
    )
    check(`${label}: with no store chosen, every total is the sum of the store rows (${d.stores.length} stores)`, off.length === 0, off.join('; '))
    const series = ['cameIn', 'handedOver'].filter((k) => d.series.reduce((t, b) => t + b[k], 0) !== d.flow[k])
    check(`${label}: the series adds up to Came in and Handed over`, series.length === 0, series.map((k) => `${k}: Σ ${d.series.reduce((t, b) => t + b[k], 0)} vs ${d.flow[k]}`).join('; '))
  } else {
    const row = d.stores[0]
    check(
      `${label}: one store chosen → at most that store's row, and it equals the totals`,
      d.stores.length <= 1 && (!row || (row.storeCode === store && COUNTS.every(([band, k]) => row[band][k] === d[band][k]))),
      JSON.stringify(d.stores.map((s) => s.storeCode)),
    )
  }
}

const atMost = (narrow, wide) => COUNTS.filter(([band, k]) => (narrow[band][k] ?? 0) > (wide[band][k] ?? 0)).map(([, k]) => `${k}: ${narrow.flow[k] ?? narrow.misses[k]} > ${wide.flow[k] ?? wide.misses[k]}`)

// ── Today, all stores ───────────────────────────────────────────────────────────────────────────
const today = await load('Today, all stores', '')
if (today) {
  await verify('Today, all stores', today, { granularity: 'hour', buckets: 24, allStores: true })
  const asOf = today.data.asOf
  const ageMin = asOf ? (Date.now() - new Date(asOf).getTime()) / 60000 : null
  check('AsOf is at most 5 minutes old', ageMin !== null && ageMin >= -1 && ageMin <= 5, `asOf ${asOf}, ${ageMin === null ? '—' : ageMin.toFixed(1)} min old`)
  check('AsOf is shown on the page', (await page.locator('[data-statistics-as-of]').innerText()).includes(asOf?.slice(11, 16) ?? '@@'))
  await page.screenshot({ path: `${SHOTS}/today-all.png`, fullPage: true })
}

// ── Yesterday, all stores, leave-outs on and off ────────────────────────────────────────────────
const yAll = await load('Yesterday, all stores', '?period=yesterday')
if (yAll) {
  await verify('Yesterday, all stores', yAll, { granularity: 'hour', buckets: 24, allStores: true })
  await page.screenshot({ path: `${SHOTS}/yesterday-all.png`, fullPage: true })
}
const yChurned = await load('Yesterday, churned refills kept', '?period=yesterday&leaveOutChurned=false')
if (yChurned) {
  check('Yesterday, churned refills kept: the page sends LeaveOutChurned=false', yChurned.query.LeaveOutChurned === 'false', JSON.stringify(yChurned.query))
  await verify('Yesterday, churned refills kept', yChurned, { granularity: 'hour', buckets: 24, allStores: true })
  if (yAll) {
    const more = atMost(yAll.data, yChurned.data)
    check('Leaving churned refills out never adds: every figure ≤ with them kept', more.length === 0, more.join('; '))
  }
}

// The order types the page offers to leave out (read off its own picker).
await page.locator('[data-leave-out-types-trigger]').click()
await page.locator('[data-leave-out-types-panel]').waitFor()
const TYPES = await page.locator('[data-leave-out-type]').evaluateAll((els) => els.map((e) => e.getAttribute('data-leave-out-type')))
await page.keyboard.press('Escape')
const yTypes = TYPES.length ? await load(`Yesterday, ${TYPES.join('+')} left out`, `?period=yesterday&leaveOutTypes=${TYPES.join(',')}`) : null
if (yTypes) {
  check(`Yesterday, types left out: the page sends every offered type in LeaveOutTypes`, same(yTypes.query.LeaveOutTypes?.split(',').sort(), [...TYPES].sort()), JSON.stringify(yTypes.query))
  await verify('Yesterday, types left out', yTypes, { granularity: 'hour', buckets: 24, allStores: true })
  if (yAll) {
    const more = atMost(yTypes.data, yAll.data)
    check('Leaving order types out never adds: every figure ≤ with none left out', more.length === 0, more.join('; '))
  }
}

// ── One store ───────────────────────────────────────────────────────────────────────────────────
const top = yAll?.data.stores.slice().sort((a, b) => (b.flow.handedOver ?? 0) - (a.flow.handedOver ?? 0))[0]?.storeCode
const STORE_CODE = process.env.PARITY_STORE || top
if (!STORE_CODE) check('a store to drive one-store reads on', false, 'yesterday had no store rows and PARITY_STORE is unset')
const tOne = STORE_CODE ? await load(`Today, ${STORE_CODE}`, `?store=${STORE_CODE}`) : null
if (tOne) {
  await verify(`Today, ${STORE_CODE}`, tOne, { granularity: 'hour', buckets: 24, store: STORE_CODE })
  check(`Today, ${STORE_CODE}: the picker shows the store`, (await page.locator('[data-statistics-store]').inputValue()) === STORE_CODE)
}
const yOne = STORE_CODE ? await load(`Yesterday, ${STORE_CODE}`, `?period=yesterday&store=${STORE_CODE}`) : null
if (yOne) {
  await verify(`Yesterday, ${STORE_CODE}`, yOne, { granularity: 'hour', buckets: 24, store: STORE_CODE })
  await page.screenshot({ path: `${SHOTS}/yesterday-one.png`, fullPage: true })
  const row = yAll?.data.stores.find((s) => s.storeCode === STORE_CODE)
  if (row) {
    const off = COUNTS.filter(([band, k]) => row[band][k] !== yOne.data[band][k]).map(([band, k]) => `${k}: ${yOne.data[band][k]} vs ${row[band][k]}`)
    check(`Yesterday: ${STORE_CODE} alone equals its row in the all-store answer`, off.length === 0 && row.avgHandOverMinutes === yOne.data.avgHandOverMinutes, off.join('; '))
  }
}
const yOneChurned = STORE_CODE ? await load(`Yesterday, ${STORE_CODE}, churned kept`, `?period=yesterday&store=${STORE_CODE}&leaveOutChurned=false`) : null
if (yOneChurned) {
  await verify(`Yesterday, ${STORE_CODE}, churned kept`, yOneChurned, { granularity: 'hour', buckets: 24, store: STORE_CODE })
  if (yOne) {
    const more = atMost(yOne.data, yOneChurned.data)
    check(`${STORE_CODE}: leaving churned refills out never adds`, more.length === 0, more.join('; '))
  }
}

// ── The 31-day Range ────────────────────────────────────────────────────────────────────────────
const rAll = await load('Range 31 days, all stores', '?period=range&pick=31')
if (rAll) {
  check('Range 31 days: ends yesterday, by the day', same([rAll.query.From, rAll.query.To], [daysAgo(31), YESTERDAY]), JSON.stringify(rAll.query))
  await verify('Range 31 days, all stores', rAll, { granularity: 'day', buckets: 31, allStores: true })
  await page.screenshot({ path: `${SHOTS}/range31-all.png`, fullPage: true })
}
const rOne = STORE_CODE ? await load(`Range 31 days, ${STORE_CODE}`, `?period=range&pick=31&store=${STORE_CODE}`) : null
if (rOne) {
  await verify(`Range 31 days, ${STORE_CODE}`, rOne, { granularity: 'day', buckets: 31, store: STORE_CODE })
  const row = rAll?.data.stores.find((s) => s.storeCode === STORE_CODE)
  if (row) {
    const off = COUNTS.filter(([band, k]) => row[band][k] !== rOne.data[band][k]).map(([band, k]) => `${k}: ${rOne.data[band][k]} vs ${row[band][k]}`)
    check(`Range 31 days: ${STORE_CODE} alone equals its row in the all-store answer`, off.length === 0, off.join('; '))
  }
}
const rChurned = await load('Range 31 days, churned kept', '?period=range&pick=31&leaveOutChurned=false')
if (rChurned) {
  await verify('Range 31 days, churned kept', rChurned, { granularity: 'day', buckets: 31, allStores: true })
  if (rAll) {
    const more = atMost(rAll.data, rChurned.data)
    check('Range: leaving churned refills out never adds', more.length === 0, more.join('; '))
  }
}

// ── The 32-day guard ────────────────────────────────────────────────────────────────────────────
{
  const since = answers.length
  await page.goto(`${BASE}/oms/delivery-statistics?period=range&pick=custom&from=${daysAgo(31)}&to=${TODAY}`)
  await page.locator('[data-statistics-refused="tooLong"]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(1500)
  check('32 days inclusive is refused in the UI and makes NO call', answers.length === since, `${answers.length - since} call(s)`)
  await page.screenshot({ path: `${SHOTS}/guard32.png`, fullPage: true })
  const res = await context.request.get(`${BASE}/api/SdDocumentWeb/StoreStatistics?From=${daysAgo(31)}&To=${TODAY}&Granularity=day`, { headers: { 'X-Web-Client': '1' } })
  const body = await res.json().catch(() => null)
  check(
    'and the door itself refuses 32 days with SDD-02131 on the envelope',
    body?.success === false && body?.errors?.[0]?.errorCode === 'SDD-02131',
    `HTTP ${res.status()} ${body?.errors?.[0]?.errorCode ?? ''} ${body?.message ?? ''}`,
  )
}

check('no page errors', errors.length === 0, errors.join(' | '))

// ── The till parity record ──────────────────────────────────────────────────────────────────────
if (yOne) {
  const d = yOne.data
  console.log(`\nTill parity — store ${STORE_CODE}, Yesterday (${YESTERDAY}), churned refills left out, no order types left out.`)
  console.log('Read the till\'s Statistics view for the same store and day, and record both columns in ticket 488:')
  for (const k of FLOW) console.log(`  ${k.padEnd(18)} web ${fmt(d.flow[k]).padStart(8)}   till ____`)
  for (const k of MISSES) console.log(`  ${k.padEnd(18)} web ${fmt(d.misses[k]).padStart(8)}   till ____`)
  console.log(`  ${'avgHandOverMinutes'.padEnd(18)} web ${fmt(d.avgHandOverMinutes).padStart(8)}   till ____`)
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
