// HungerStation LIVE drive (ticket 557, BackOffice spec 3028) — the three screens against the REAL doors.
//
// The stubbed drives (tools/hungerstation-{stores,materials,orders}-drive.mjs) stay the regression for
// the screens' behaviour: they pin fixture values no real estate holds. This is their live twin. It
// stubs NOTHING, signs in for real, and asserts what holds for any real estate against the contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md):
//   1. every read door answers on the envelope with exactly the contract's keys;
//   2. each filter returns only what it names (stores sync/health/chain/q, materials state, orders
//      outcome), paging pages, and the refusals that write nothing carry their codes;
//   3. each page draws what the door returned, in LTR and RTL, with the drawers (logs, push lines,
//      order detail, raw view) opened from real rows;
//   4. no page errors.
//
// 🚩 It READS only — the owner's ruling for a walk on PRODUCTION (2026-10-25):
//   - no onboard, edit, remove, pause/resume, sync now, materials import/change or order retry: those
//     proofs stay open in ticket 557 for staging or a named test store;
//   - material history (`GET …/Sync/{code}/Lines?material=`) is NEVER called: until BackOffice index
//     007 part 2 is in, each lookup scans ~118M rows. The drive only checks its entry point shows.
// A route guard enforces both in the browser: any non-GET `/api` call outside `Auth/*`, and any
// material-history read, is ABORTED and counted — a non-zero count fails the drive.
//
//   1. point the dev proxy at the SIS.Api under test and run the app:
//        $env:SIS_API='http://<host>'; npx vite --port 5250 --strictPort
//   2. sign in one of three ways, the secret never in the repo:
//        SIS_SIGN_IN=window            — a visible browser opens on /login; sign in there by hand
//        SIS_USER=<id> SIS_PASS=<pw>   — POST Auth/Login through the proxy
//        SIS_COOKIE=<sis_session>      — a cookie copied from a browser session
//   3. DRIVE_PORT=5250 node tools/hungerstation-live-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5250}`
const SHOTS = 'tools/.hungerstation-live-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const skipped = []
const skip = (name, why) => {
  skipped.push(name)
  console.log(`SKIP  ${name} — ${why}`)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const numbers = (s) => (strip(s).match(/\d[\d,]*/g) ?? []).map((n) => Number(n.replace(/,/g, '')))

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysFromToday = (n) => {
  const d = new Date()
  return day(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}
const TODAY = daysFromToday(0)

// ── The contract's keys, door by door ─────────────────────────────────────────────────────────────
// Restated by hand from src/core/models/hungerstation.ts (a plain-node drive cannot import TypeScript):
// a contract change edits both.
const ACCESS = ['canManageStores', 'canManageCatalog', 'canViewOrders']
const STORE = ['storeCode', 'storeName', 'chainKey', 'vendorId', 'onboardedAt', 'onboardedBy', 'updatedAt', 'updatedBy', 'sync']
const SYNC = ['active', 'lastFullRun', 'lastDeltaRun', 'lastRun', 'lastStatus', 'lastError', 'health']
const LOG = ['logId', 'syncType', 'startTime', 'endTime', 'status', 'rows', 'error']
const LINES_PAGE = ['logId', 'total', 'lines']
const LINE = ['materialNumber', 'active', 'quantity', 'maximumSalesQuantity', 'price', 'currencyKey', 'sentAt']
const MATERIALS_PAGE = ['total', 'rows']
const MATERIAL = ['materialNumber', 'sku', 'nameEn', 'nameAr', 'disabled', 'deleted', 'updatedAt', 'updatedBy']
const ORDERS_PAGE = ['total', 'rows']
const ORDER_BASE = [
  'orderId', 'orderCode', 'chainKey', 'vendorId', 'storeCode', 'receivedAt', 'hsStatus', 'documentNumber', 'outcome',
  'reason', 'replacedLines', 'total', 'currencyKey', 'alert', 'retryable',
]
const ORDER_ROW = [...ORDER_BASE, 'deliveries']
const ORDER_DETAIL = [...ORDER_BASE, 'lines', 'deliveries']
const ORDER_LINE = ['itemId', 'replacedId', 'sku', 'name', 'status', 'quantity', 'unitPrice', 'totalPrice', 'discount', 'materialNumber']
const DELIVERY = ['receiveId', 'receivedAt', 'run']
const RUN = ['status', 'attempts', 'lastAttemptAt', 'nextAttemptAt', 'error']
const RAW = ['receivedAt', 'body']
const ENVELOPE = ['statusCode', 'success', 'message', 'errors', 'data']

const keysOf = (o) => Object.keys(o ?? {}).sort()
const hasKeys = (o, want) => same(keysOf(o), [...want].sort())
const allKeys = (rows, want) => rows.every((r) => hasKeys(r, want))
const firstOff = (rows, want) => {
  const bad = rows.find((r) => !hasKeys(r, want))
  return bad ? `got [${keysOf(bad)}]` : ''
}
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const timeOrNull = (v) => v === null || LOCAL_TIME.test(v)
const MATERIAL_HISTORY = /\/HungerStationWeb\/Sync\/[^/]+\/Lines$/

// ── Sign-in ─────────────────────────────────────────────────────────────────────────────────────
const WINDOW = process.env.SIS_SIGN_IN === 'window'
const browser = await chromium.launch({ headless: !WINDOW })
const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
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
    console.error('If the account needs an OTP, use SIS_SIGN_IN=window or SIS_COOKIE instead.')
    process.exit(2)
  }
  console.log(`Signed in as ${body?.data?.userId ?? process.env.SIS_USER}.`)
} else {
  console.error('Set SIS_SIGN_IN=window, SIS_USER + SIS_PASS, or SIS_COOKIE.')
  process.exit(2)
}

// ── The read-only guard (browser) ───────────────────────────────────────────────────────────────
const blocked = []
await context.route('**/api/**', (route) => {
  const req = route.request()
  const path = new URL(req.url()).pathname
  if ((req.method() !== 'GET' && !path.startsWith('/api/Auth/')) || MATERIAL_HISTORY.test(path)) {
    blocked.push(`${req.method()} ${path}`)
    return route.abort()
  }
  return route.continue()
})

// ── The door reader (node) — GETs only, never material history ──────────────────────────────────
async function door(path, params) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) for (const one of [v].flat()) if (one !== null && one !== undefined) qs.append(k, String(one))
  const url = `${BASE}/api/${path}${qs.size ? '?' + qs : ''}`
  if (MATERIAL_HISTORY.test(new URL(url).pathname)) throw new Error(`refusing to call material history: ${path}`)
  const res = await context.request.get(url, { headers: { 'X-Web-Client': '1' } })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* a bare 403 has no envelope */
  }
  return { status: res.status(), body, text }
}
const refusal = (r) => r.body?.errors?.[0]?.errorCode
const onEnvelope = (r) => hasKeys(r.body, ENVELOPE)

// ═══ 1. Access ════════════════════════════════════════════════════════════════════════════════════
const access = await door('HungerStationWeb/Access')
check('1: Access answers 200 on the envelope', access.status === 200 && onEnvelope(access), `HTTP ${access.status}`)
check('1: Access holds exactly the three flags', hasKeys(access.body?.data, ACCESS), JSON.stringify(access.body?.data))
const flags = access.body?.data ?? {}
console.log(`      flags: ${JSON.stringify(flags)}`)

// ═══ 2. Stores (doors) ════════════════════════════════════════════════════════════════════════════
let stores = []
let logStore = null
let logs = []
if (!flags.canManageStores) {
  skip('2–3: stores, logs, push lines', 'the signed-in user lacks canManageStores')
} else {
  const chains = await door('HungerStationWeb/Chains')
  check('2: Chains is a list of strings', chains.status === 200 && Array.isArray(chains.body?.data) && chains.body.data.every((c) => typeof c === 'string'), JSON.stringify(chains.body?.data))

  const all = await door('HungerStationWeb/Stores')
  stores = all.body?.data ?? []
  check('2: Stores answers 200 with a list', all.status === 200 && Array.isArray(all.body?.data), `HTTP ${all.status}`)
  console.log(`      ${stores.length} onboarded stores`)
  check('2: every store row has exactly the contract keys', allKeys(stores, STORE), firstOff(stores, STORE))
  check('2: every sync block has exactly the contract keys', allKeys(stores.map((s) => s.sync), SYNC), firstOff(stores.map((s) => s.sync), SYNC))
  check('2: health is ok / failing / silent', stores.every((s) => ['ok', 'failing', 'silent'].includes(s.sync?.health)))
  check('2: lastStatus is S / E / null', stores.every((s) => [null, 'S', 'E'].includes(s.sync?.lastStatus)))
  check('2: times are local wall-clock with no offset, or null', stores.every((s) => [s.onboardedAt, s.updatedAt, s.sync?.lastFullRun, s.sync?.lastDeltaRun, s.sync?.lastRun].every(timeOrNull)))
  check('2: failing ⇔ the newest push in 24 h is E', stores.every((s) => (s.sync.health === 'failing') === (s.sync.lastStatus === 'E')))
  check('2: silent only on an active store with no push in 24 h', stores.filter((s) => s.sync.health === 'silent').every((s) => s.sync.active && s.sync.lastRun === null))
  check('2: chain keys are configured chains', stores.every((s) => (chains.body?.data ?? []).includes(s.chainKey)))
  const tally = (f) => stores.filter(f).length
  console.log(`      active ${tally((s) => s.sync.active)}, paused ${tally((s) => !s.sync.active)}; ok ${tally((s) => s.sync.health === 'ok')}, failing ${tally((s) => s.sync.health === 'failing')}, silent ${tally((s) => s.sync.health === 'silent')}`)

  for (const sync of ['active', 'paused']) {
    const r = await door('HungerStationWeb/Stores', { sync })
    const want = stores.filter((s) => s.sync.active === (sync === 'active')).map((s) => s.storeCode).sort()
    check(`2: sync=${sync} returns exactly the ${sync} stores`, same((r.body?.data ?? []).map((s) => s.storeCode).sort(), want), `${r.body?.data?.length} vs ${want.length}`)
  }
  for (const health of ['ok', 'failing', 'silent']) {
    const r = await door('HungerStationWeb/Stores', { health })
    const want = stores.filter((s) => s.sync.health === health).map((s) => s.storeCode).sort()
    check(`2: health=${health} returns exactly the ${health} stores`, same((r.body?.data ?? []).map((s) => s.storeCode).sort(), want), `${r.body?.data?.length} vs ${want.length}`)
  }
  const aChain = stores[0]?.chainKey
  if (aChain) {
    const r = await door('HungerStationWeb/Stores', { chain: aChain })
    check(`2: chain=${aChain} returns exactly that chain's stores`, same((r.body?.data ?? []).map((s) => s.storeCode).sort(), stores.filter((s) => s.chainKey === aChain).map((s) => s.storeCode).sort()))
    const rq = await door('HungerStationWeb/Stores', { q: stores[0].vendorId })
    check('2: q finds a store by its vendor id', (rq.body?.data ?? []).some((s) => s.storeCode === stores[0].storeCode))
  }
  const bad = await door('HungerStationWeb/Stores', { health: 'sideways' })
  check('2: an unknown filter is a 400 HungerStationFilterUnknown on the envelope', bad.status === 400 && refusal(bad) === 'HungerStationFilterUnknown', `HTTP ${bad.status} ${refusal(bad)}`)

  // ═══ 3. Logs and push lines (doors) ═══════════════════════════════════════════════════════════
  // The store with the newest push is the one most likely to hold lines.
  logStore = [...stores].filter((s) => s.sync.lastRun).sort((a, b) => b.sync.lastRun.localeCompare(a.sync.lastRun))[0] ?? stores[0] ?? null
  if (!logStore) {
    skip('3: logs and push lines', 'no onboarded store')
  } else {
    const code = encodeURIComponent(logStore.storeCode)
    const r = await door(`HungerStationWeb/Sync/${code}/Logs`, { take: 500 })
    logs = r.body?.data ?? []
    console.log(`      logs of ${logStore.storeCode}: ${logs.length}`)
    check('3: Logs answers 200 with a list', r.status === 200 && Array.isArray(r.body?.data), `HTTP ${r.status} ${refusal(r) ?? ''}`)
    check('3: every log row has exactly the contract keys', allKeys(logs, LOG), firstOff(logs, LOG))
    check('3: syncType F/D, status S/E, rows a number', logs.every((l) => ['F', 'D'].includes(l.syncType) && ['S', 'E'].includes(l.status) && Number.isInteger(l.rows)))
    check('3: newest first', logs.every((l, i) => i === 0 || logs[i - 1].startTime >= l.startTime))
    const oldest = daysFromToday(-16)
    check('3: at most 15 days back', logs.every((l) => l.startTime.slice(0, 10) >= oldest), logs.at(-1)?.startTime ?? '')
    const def = await door(`HungerStationWeb/Sync/${code}/Logs`)
    check('3: take defaults to 50', (def.body?.data ?? []).length === Math.min(50, logs.length), String(def.body?.data?.length))
    const over = await door(`HungerStationWeb/Sync/${code}/Logs`, { take: 501 })
    check('3: take=501 is a 400 HungerStationInputInvalid', over.status === 400 && refusal(over) === 'HungerStationInputInvalid', `HTTP ${over.status} ${refusal(over)}`)
    const none = await door('HungerStationWeb/Sync/ZZ-NO-STORE/Logs')
    check('3: a code with no store and no logs is DHS-00007', none.status === 404 && refusal(none) === 'DHS-00007', `HTTP ${none.status} ${refusal(none)}`)

    const push = logs.find((l) => l.rows > 0) ?? logs[0]
    if (!push) {
      skip('3: push lines', `${logStore.storeCode} has no push in 15 days`)
    } else {
      const linesPath = `HungerStationWeb/Sync/${code}/Logs/${encodeURIComponent(push.logId)}/Lines`
      const lp = await door(linesPath, { take: 50 })
      const page = lp.body?.data
      const lines = page?.lines ?? []
      console.log(`      push ${push.logId} (${push.syncType}, ${push.rows} rows): total ${page?.total}`)
      check('3: Lines answers with exactly logId, total, lines', lp.status === 200 && hasKeys(page, LINES_PAGE), `HTTP ${lp.status} ${refusal(lp) ?? ''}`)
      check('3: every line has exactly the contract keys', allKeys(lines, LINE), firstOff(lines, LINE))
      check('3: ordered by material number', lines.every((l, i) => i === 0 || lines[i - 1].materialNumber <= l.materialNumber))
      check('3: a not-sent value is null, a sent one its type', lines.every((l) => (l.active === null || typeof l.active === 'boolean') && (l.quantity === null || typeof l.quantity === 'number') && (l.price === null || typeof l.price === 'number')))
      check('3: total is at least the page', (page?.total ?? -1) >= lines.length && lines.length === Math.min(50, page?.total ?? 0))
      if ((page?.total ?? 0) > 50) {
        const p2 = await door(linesPath, { skip: 50, take: 50 })
        const overlap = (p2.body?.data?.lines ?? []).filter((l) => lines.some((m) => m.materialNumber === l.materialNumber))
        check('3: skip=50 pages to different lines', (p2.body?.data?.lines ?? []).length > 0 && overlap.length === 0)
      } else skip('3: line paging', `the push holds ${page?.total} lines`)
      if (lines[0]) {
        const one = await door(linesPath, { material: lines[0].materialNumber })
        check('3: material= matches exactly', (one.body?.data?.lines ?? []).every((l) => l.materialNumber === lines[0].materialNumber) && one.body?.data?.total >= 1)
      }
      const gone = await door(`HungerStationWeb/Sync/${code}/Logs/ZZ-NO-PUSH/Lines`)
      check('3: an unknown push is DHS-00015', gone.status === 404 && refusal(gone) === 'DHS-00015', `HTTP ${gone.status} ${refusal(gone)}`)
    }
  }
}

// ═══ 4. Materials (doors) ═════════════════════════════════════════════════════════════════════════
let materialsTotal = null
if (!flags.canManageCatalog) {
  skip('4: materials', 'the signed-in user lacks canManageCatalog')
} else {
  const r = await door('HungerStationWeb/Materials', { take: 50 })
  const page = r.body?.data
  const rows = page?.rows ?? []
  materialsTotal = page?.total ?? null
  console.log(`      materials (active): ${page?.total}`)
  check('4: Materials answers with exactly total, rows', r.status === 200 && hasKeys(page, MATERIALS_PAGE), `HTTP ${r.status} ${refusal(r) ?? ''}`)
  check('4: every material row has exactly the contract keys', allKeys(rows, MATERIAL), firstOff(rows, MATERIAL))
  check('4: the default state is active (neither disabled nor deleted)', rows.every((m) => !m.disabled && !m.deleted))
  for (const state of ['disabled', 'deleted']) {
    const s = await door('HungerStationWeb/Materials', { state, take: 50 })
    check(`4: state=${state} returns only ${state} materials`, s.status === 200 && (s.body?.data?.rows ?? []).every((m) => m[state]), `total ${s.body?.data?.total}`)
  }
  const any = await door('HungerStationWeb/Materials', { state: 'any', take: 1 })
  check('4: state=any counts at least the active ones', (any.body?.data?.total ?? -1) >= (page?.total ?? 0))
  if ((page?.total ?? 0) > 50) {
    const p2 = await door('HungerStationWeb/Materials', { skip: 50, take: 50 })
    const overlap = (p2.body?.data?.rows ?? []).filter((m) => rows.some((n) => n.materialNumber === m.materialNumber))
    check('4: skip=50 pages to different materials', (p2.body?.data?.rows ?? []).length > 0 && overlap.length === 0)
  }
  if (rows[0]) {
    const q = await door('HungerStationWeb/Materials', { q: rows[0].materialNumber })
    check('4: q finds a material by the start of its number', (q.body?.data?.rows ?? []).some((m) => m.materialNumber === rows[0].materialNumber))
  }
  const bad = await door('HungerStationWeb/Materials', { state: 'sideways' })
  check('4: an unknown state is a 400 on the envelope', bad.status === 400 && onEnvelope(bad), `HTTP ${bad.status} ${refusal(bad)}`)
}

// ═══ 5. Orders (doors) ════════════════════════════════════════════════════════════════════════════
let ordersToday = null
let anOrder = null
if (!flags.canViewOrders) {
  skip('5: orders', 'the signed-in user lacks canViewOrders')
} else {
  const FROM = daysFromToday(-30)
  const r = await door('HungerStationWeb/Orders', { from: FROM, to: TODAY, take: 100 })
  const page = r.body?.data
  const rows = page?.rows ?? []
  console.log(`      orders ${FROM}..${TODAY}: ${page?.total}`)
  check('5: Orders answers with exactly total, rows', r.status === 200 && hasKeys(page, ORDERS_PAGE), `HTTP ${r.status} ${refusal(r) ?? ''}`)
  check('5: every order row has exactly the contract keys', allKeys(rows, ORDER_ROW), firstOff(rows, ORDER_ROW))
  check('5: outcome is created / cancelled / failed / pending', rows.every((o) => ['created', 'cancelled', 'failed', 'pending'].includes(o.outcome)))
  check('5: retryable exactly when failed', rows.every((o) => o.retryable === (o.outcome === 'failed')))
  check('5: reason only on a failed order', rows.every((o) => o.outcome === 'failed' || o.reason === null))
  check('5: alert is null or "unmatched"', rows.every((o) => o.alert === null || o.alert === 'unmatched'))
  check('5: deliveries is a count on a list row', rows.every((o) => Number.isInteger(o.deliveries)))
  check('5: newest first, inside the window', rows.every((o, i) => (i === 0 || rows[i - 1].receivedAt >= o.receivedAt) && o.receivedAt.slice(0, 10) >= FROM && o.receivedAt.slice(0, 10) <= TODAY))
  const tally = Object.fromEntries(['created', 'cancelled', 'failed', 'pending'].map((k) => [k, rows.filter((o) => o.outcome === k).length]))
  console.log(`      first page: ${JSON.stringify(tally)}, unmatched ${rows.filter((o) => o.alert).length}`)
  for (const outcome of ['failed', 'created']) {
    const f = await door('HungerStationWeb/Orders', { from: FROM, to: TODAY, outcome, take: 100 })
    check(`5: outcome=${outcome} returns only ${outcome} orders`, f.status === 200 && (f.body?.data?.rows ?? []).every((o) => o.outcome === outcome), `total ${f.body?.data?.total}`)
  }
  const both = await door('HungerStationWeb/Orders', { from: FROM, to: TODAY, outcome: ['failed', 'pending'], take: 1 })
  const nf = await door('HungerStationWeb/Orders', { from: FROM, to: TODAY, outcome: 'failed', take: 1 })
  const np = await door('HungerStationWeb/Orders', { from: FROM, to: TODAY, outcome: 'pending', take: 1 })
  check('5: a repeated outcome is an OR', both.body?.data?.total === (nf.body?.data?.total ?? 0) + (np.body?.data?.total ?? 0), `${both.body?.data?.total} = ${nf.body?.data?.total} + ${np.body?.data?.total}`)
  if ((page?.total ?? 0) > 100) {
    const p2 = await door('HungerStationWeb/Orders', { from: FROM, to: TODAY, skip: 100, take: 100 })
    const overlap = (p2.body?.data?.rows ?? []).filter((o) => rows.some((n) => n.orderId === o.orderId))
    check('5: skip=100 pages to different orders', (p2.body?.data?.rows ?? []).length > 0 && overlap.length === 0)
  } else skip('5: order paging', `the window holds ${page?.total} orders`)
  const long = await door('HungerStationWeb/Orders', { from: daysFromToday(-31), to: TODAY })
  check('5: a 32-day window is a 400 HungerStationWindowInvalid', long.status === 400 && refusal(long) === 'HungerStationWindowInvalid', `HTTP ${long.status} ${refusal(long)}`)
  const late = await door('HungerStationWeb/Orders', { from: TODAY, to: daysFromToday(2) })
  check('5: a window ending after tomorrow is a 400 HungerStationWindowInvalid', late.status === 400 && refusal(late) === 'HungerStationWindowInvalid', `HTTP ${late.status} ${refusal(late)}`)
  const noWindow = await door('HungerStationWeb/Orders')
  check('5: no window is a 400 HungerStationWindowInvalid', noWindow.status === 400 && refusal(noWindow) === 'HungerStationWindowInvalid', `HTTP ${noWindow.status} ${refusal(noWindow)}`)
  const today = await door('HungerStationWeb/Orders', { from: TODAY, to: TODAY, take: 1 })
  ordersToday = today.body?.data?.total ?? null

  // The detail and raw view of one real order (prefer replaced lines, to see their order).
  anOrder = rows.find((o) => o.replacedLines > 0) ?? rows.find((o) => o.outcome === 'failed') ?? rows[0] ?? null
  if (!anOrder) {
    skip('5: order detail and raw view', 'no order in the last 30 days')
  } else {
    const d = await door(`HungerStationWeb/Orders/${encodeURIComponent(anOrder.orderId)}`)
    const det = d.body?.data
    console.log(`      detail of ${anOrder.orderId} (${anOrder.outcome}, ${det?.lines?.length} lines, ${det?.deliveries?.length} deliveries)`)
    check('5: the detail has exactly the contract keys', d.status === 200 && hasKeys(det, ORDER_DETAIL), `HTTP ${d.status} ${refusal(d) ?? ''}`)
    check('5: the detail repeats the row (deliveries now the list)', ORDER_BASE.every((k) => same(det?.[k], anOrder[k])) && det?.deliveries?.length === anOrder.deliveries)
    check('5: every line has exactly the contract keys (no currencyKey)', allKeys(det?.lines ?? [], ORDER_LINE), firstOff(det?.lines ?? [], ORDER_LINE))
    const lines = det?.lines ?? []
    check('5: a replacement sits right after the line it replaced (or its sibling)', lines.every((l, i) => l.replacedId === null || lines[i - 1]?.itemId === l.replacedId || lines[i - 1]?.replacedId === l.replacedId))
    check('5: every delivery has exactly the contract keys', allKeys(det?.deliveries ?? [], DELIVERY), firstOff(det?.deliveries ?? [], DELIVERY))
    check('5: deliveries oldest first', (det?.deliveries ?? []).every((x, i, a) => i === 0 || a[i - 1].receivedAt <= x.receivedAt))
    const runs = (det?.deliveries ?? []).map((x) => x.run).filter(Boolean)
    check('5: every run has exactly the contract keys', allKeys(runs, RUN), firstOff(runs, RUN))
    check('5: run status C/P/F; nextAttemptAt only on P; error null on C', runs.every((x) => ['C', 'P', 'F'].includes(x.status) && (x.status === 'P' || x.nextAttemptAt === null) && (x.status !== 'C' || x.error === null)))
    const first = det?.deliveries?.[0]
    if (first) {
      const raw = await door(`HungerStationWeb/Orders/${encodeURIComponent(anOrder.orderId)}/Deliveries/${encodeURIComponent(first.receiveId)}/Raw`)
      let parses = false
      try {
        JSON.parse(raw.body?.data?.body)
        parses = true
      } catch {
        /* not JSON */
      }
      check('5: the raw view has exactly receivedAt, body', raw.status === 200 && hasKeys(raw.body?.data, RAW), `HTTP ${raw.status} ${refusal(raw) ?? ''}`)
      check('5: body is a JSON STRING that parses', typeof raw.body?.data?.body === 'string' && parses)
    }
    const gone = await door('HungerStationWeb/Orders/ZZ-NO-ORDER')
    check('5: an unknown order is DHS-00011', gone.status === 404 && refusal(gone) === 'DHS-00011', `HTTP ${gone.status} ${refusal(gone)}`)
  }
}

// ═══ 6. The pages, LTR and RTL ════════════════════════════════════════════════════════════════════
async function openPage(dir, path) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.goto(`${BASE}${path}`)
  return { page, errors }
}
const settled = (page, grid) =>
  page.waitForFunction((g) => document.querySelector(`[${g}]`) && !document.querySelector(`[${g}] .ag-overlay-loading-center`), grid, { timeout: 30000 })

for (const dir of ['ltr', 'rtl']) {
  if (flags.canManageStores) {
    const { page, errors } = await openPage(dir, '/hungerstation/stores')
    await settled(page, 'data-stores-grid')
    await page.locator('[data-status-count]').first().waitFor({ timeout: 30000 })
    check(`6 ${dir}: dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir)) === dir)
    const count = numbers(await page.locator('[data-status-count]').first().innerText())
    check(`6 ${dir}: the stores count reads the door's ${stores.length}`, count.includes(stores.length), count.join())
    const health = await page.locator('[data-stores-grid] [data-health]').evaluateAll((els) => els.map((e) => e.getAttribute('data-health')))
    check(`6 ${dir}: health cells draw`, stores.length === 0 || health.length > 0, [...new Set(health)].join())
    check(`6 ${dir}: the material-history entry point shows (never opened — ruling)`, stores.length === 0 || (await page.locator('[data-store-material]').count()) > 0)
    await page.screenshot({ path: `${SHOTS}/${dir}-stores.png` })
    if (logStore) {
      await page.goto(`${BASE}/hungerstation/stores?logs=${encodeURIComponent(logStore.storeCode)}`)
      const drawer = page.locator('[data-hs-logs-drawer]')
      await drawer.locator('[data-hs-logs-table], [data-hs-logs-empty], [data-hs-logs-error], [data-hs-logs-unknown]').first().waitFor({ timeout: 30000 })
      const drawn = await drawer.locator('[data-hs-log]').count()
      check(`6 ${dir}: the logs drawer draws the door's ${logs.length} pushes`, drawn === logs.length, String(drawn))
      await page.screenshot({ path: `${SHOTS}/${dir}-logs.png` })
      const withLines = drawer.locator('[data-log-open-lines]')
      if ((await withLines.count()) > 0) {
        await withLines.first().click()
        await page.locator('[data-lines-table], [data-lines-notice], [data-lines-error]').first().waitFor({ timeout: 30000 })
        check(`6 ${dir}: a push opens its lines`, (await page.locator('[data-line]').count()) > 0 || (await page.locator('[data-lines-notice]').count()) > 0)
        await page.screenshot({ path: `${SHOTS}/${dir}-push-lines.png` })
      } else skip(`6 ${dir}: push lines page`, 'no push offers its lines')
    }
    check(`6 ${dir}: no page errors on Stores`, errors.length === 0, errors.join(' | '))
    await page.close()
  }
  if (flags.canManageCatalog) {
    const { page, errors } = await openPage(dir, '/hungerstation/materials')
    await settled(page, 'data-materials-grid')
    await page.locator('[data-status-count]').first().waitFor({ timeout: 30000 })
    const count = numbers(await page.locator('[data-status-count]').first().innerText())
    check(`6 ${dir}: the materials count reads the door's ${materialsTotal}`, count.includes(materialsTotal), count.join())
    await page.screenshot({ path: `${SHOTS}/${dir}-materials.png` })
    check(`6 ${dir}: no page errors on Materials`, errors.length === 0, errors.join(' | '))
    await page.close()
  }
  if (flags.canViewOrders) {
    const { page, errors } = await openPage(dir, '/hungerstation/orders')
    await settled(page, 'data-orders-grid')
    await page.locator('[data-status-count]').first().waitFor({ timeout: 30000 })
    const count = numbers(await page.locator('[data-status-count]').first().innerText())
    check(`6 ${dir}: the default window (today) reads the door's ${ordersToday}`, count.includes(ordersToday), `${count.join()} (${page.url()})`)
    await page.screenshot({ path: `${SHOTS}/${dir}-orders-today.png` })
    if (anOrder) {
      await page.goto(`${BASE}/hungerstation/orders?from=${daysFromToday(-30)}&to=${TODAY}&q=${encodeURIComponent(anOrder.orderId)}`)
      await settled(page, 'data-orders-grid')
      const details = page.locator(`[row-id="${anOrder.orderId}"] [data-order-details]`).first()
      await details.waitFor({ timeout: 30000 })
      await details.click()
      const drawer = page.locator('[data-order-drawer]')
      await drawer.locator('[data-order-lines], [data-order-error]').first().waitFor({ timeout: 30000 })
      check(`6 ${dir}: the detail drawer opens on the order`, (await drawer.locator('[data-order-error]').count()) === 0)
      check(`6 ${dir}: retry shows exactly when retryable (never clicked)`, ((await drawer.locator('[data-order-drawer-retry]').count()) > 0) === anOrder.retryable)
      await page.screenshot({ path: `${SHOTS}/${dir}-order-drawer.png` })
      const raw = drawer.locator('[data-order-raw]').first()
      if (await raw.count()) {
        await raw.click()
        const rawDrawer = page.locator('[data-raw-drawer]')
        await rawDrawer.locator('[data-raw-body], [data-raw-error]').first().waitFor({ timeout: 30000 })
        check(`6 ${dir}: the raw view is one ltr island`, (await rawDrawer.locator('pre[dir="ltr"][data-raw-body]').count()) === 1)
        await page.screenshot({ path: `${SHOTS}/${dir}-raw.png` })
      }
    }
    check(`6 ${dir}: no page errors on Orders`, errors.length === 0, errors.join(' | '))
    await page.close()
  }
}

// ═══ 7. The guard ═════════════════════════════════════════════════════════════════════════════════
check('7: 🚩 nothing wrote and material history was never called', blocked.length === 0, blocked.join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed, ${skipped.length} skipped${failed.length ? ' — FAILED: ' + failed.map((f) => f.name).join('; ') : ''}`)
process.exit(failed.length ? 1 : 0)
