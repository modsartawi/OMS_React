// Dispatch board drive (ticket 541, BackOffice spec 2952) — drives the REAL board page in Chromium against
// STUBBED `DispatchBoard/*` envelopes, shaped from BackOffice `DispatchBoardModels.cs` /
// `DeliveryCalloutLock.cs`.
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2959 / 2964 are merged on pricing2 but not
// deployed. Never point this at a real host.
//
// It verifies, in LTR and RTL:
//   1. the menu leaf and the six tiles (figures and lines), the `asOf` stamp;
//   2. On callout now with a live countdown that moves on the 1 s clock and never goes below 0;
//      Closed · last 60 min with the outcome, the store and the lock;
//   3. the inspector: one row per bid — dark, ATP covers / short n / not checked, tills, the moments with
//      seconds from offer, the answer with staff and register, an unknown status rendered as itself;
//      a not-competed callout says why;
//   4. Release lock only on a locked callout and only with Execute; the reason picker blocks no reason and
//      Other-without-note; each CALLOUT-102/103/104 refusal and a non-lock failure show in the dialog; a
//      release sends { deliveryNumber, reason, note }, refreshes the board and offers Change store;
//   5. the filters reach the door and the URL, and a URL opens on them;
//   6. 30 s polling, paused in a hidden tab;
//   7. no Display → the gate's denial and no board read; a bare 403 on the board → "You do not have access".
//   8. (review of 2952) one failed poll keeps the last good board with a notice; while a new filter's
//      read is out, the previous board's countdowns keep counting (never 0:00 from a zero receipt time).
//
//   1. run the app:  npx vite --port 5201
//   2. node tools/dispatch-board-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`
const URL_ = `${BASE}/oms/dispatch-board`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

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

const pad = (n) => String(n).padStart(2, '0')
const stamp = (msAgo) => {
  const d = new Date(Date.now() - msAgo)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
const plus = (base, s) => {
  const d = new Date(new Date(base).getTime() + s * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const bid = (store, offeredAt, over = {}) => ({
  bidId: `${store}-b`,
  store,
  status: 'OPEN',
  offeredAt,
  distanceKm: 2.4,
  atpKnown: true,
  atpCoversBasket: true,
  atpShortLines: 0,
  onlineTills: 2,
  signedInTills: 1,
  dark: false,
  deliveredAt: null,
  deliveredRegister: '',
  shownAt: null,
  shownStaff: '',
  shownRegister: '',
  openedAt: null,
  openedStaff: '',
  openedRegister: '',
  answeredAt: null,
  answeredStaff: '',
  answeredRegister: '',
  closedAt: null,
  ignoreReason: '',
  ...over,
})

const callout = (no, over = {}) => ({
  calloutId: `C-${no}`,
  deliveryNumber: no,
  status: 'OPEN',
  outcome: 'Open',
  endReason: '',
  openedAt: stamp(60_000),
  expiresAt: stamp(-240_000),
  endedAt: null,
  secondsLeft: null,
  candidateCount: 3,
  locksDelivery: true,
  locked: false,
  awardedParty: '',
  awardedAt: null,
  takenByStaff: '',
  takenByDevice: '',
  fallbackParty: 'P001',
  fallbackAt: null,
  releasedAt: null,
  releasedBy: '',
  releaseReason: '',
  releaseNote: '',
  channel: 'HYBR',
  deliveryType: 'QC',
  city: 'Riyadh',
  cityCode: 'RUH',
  district: 'Olaya',
  value: 184.5,
  lineCount: 4,
  bids: [],
  ...over,
})

const O1 = stamp(70_000)
const OPEN = [
  callout('D9001', {
    secondsLeft: 3,
    openedAt: O1,
    bids: [
      bid('P014', O1, {
        status: 'OPEN',
        deliveredAt: plus(O1, 4),
        deliveredRegister: '02',
        shownAt: plus(O1, 9),
        shownStaff: 'amal',
        shownRegister: '02',
        openedAt: plus(O1, 15),
        openedStaff: 'amal',
        openedRegister: '02',
      }),
      bid('P022', O1, { dark: true, onlineTills: 0, signedInTills: 0, atpCoversBasket: false, atpShortLines: 2, distanceKm: 4.1 }),
      bid('P030', O1, { atpKnown: false, status: 'HANDED', distanceKm: 6.0 }),
    ],
  }),
  callout('D9002', { secondsLeft: 200, bids: [bid('P001', stamp(60_000))] }),
]

const T1 = stamp(20 * 60_000)
const TAKEN_LOCKED = callout('D8001', {
  status: 'TAKEN',
  outcome: 'Taken',
  openedAt: T1,
  endedAt: plus(T1, 75),
  locked: true,
  awardedParty: 'P014',
  awardedAt: plus(T1, 75),
  takenByStaff: 'amal',
  bids: [
    bid('P014', T1, {
      status: 'TAKEN',
      deliveredAt: plus(T1, 4),
      deliveredRegister: '02',
      shownAt: plus(T1, 9),
      shownStaff: 'amal',
      shownRegister: '02',
      openedAt: plus(T1, 20),
      openedStaff: 'amal',
      openedRegister: '02',
      answeredAt: plus(T1, 75),
      answeredStaff: 'amal',
      answeredRegister: '02',
      closedAt: plus(T1, 75),
    }),
    bid('P022', T1, { status: 'LOST', answeredAt: plus(T1, 80), answeredStaff: 'omar', answeredRegister: '01' }),
    bid('P030', T1, { status: 'EXPIRED', ignoreReason: 'ShownNotOpened', shownAt: plus(T1, 30) }),
  ],
})
const FELL_BACK = callout('D8002', {
  status: 'UNANSWERED',
  outcome: 'FellBack',
  endReason: 'Expired',
  openedAt: stamp(30 * 60_000),
  endedAt: stamp(25 * 60_000),
  locked: true,
  fallbackParty: 'P001',
  fallbackAt: stamp(25 * 60_000),
  bids: [bid('P009', stamp(30 * 60_000), { status: 'EXPIRED', ignoreReason: 'NotReached' })],
})
const NOT_COMPETED = callout('D8003', {
  status: 'NOT_OPENED',
  outcome: 'NotCompeted',
  endReason: 'OneCandidate',
  candidateCount: 1,
  openedAt: stamp(40 * 60_000),
  endedAt: stamp(40 * 60_000),
  locksDelivery: false,
})
const WITHDRAWN = callout('D8004', { status: 'WITHDRAWN', outcome: 'Withdrawn', endReason: 'Withdrawn', openedAt: stamp(50 * 60_000), endedAt: stamp(48 * 60_000), locksDelivery: false })

const TILES = {
  onCalloutNow: 2,
  oldestOpenAgeSeconds: 70,
  bidsAwaiting: 3,
  bidsAwaitingDark: 1,
  takenLastHour: 1,
  medianSecondsToTake: 75,
  fellBack: 1,
  notCompeted: 1,
  withdrawn: 1,
}

const browser = await chromium.launch()

async function open(dir, { access = { canOpenDispatchBoard: true, canReleaseLock: true }, boardStatus = 200, clock = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 } })
  const page = await context.newPage()
  if (clock) await page.clock.install()
  const errors = []
  const boards = []
  const releases = []
  const state = { releaseMode: 'ok', released: new Set(), boardFail: false, boardDelayMs: 0 }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'DispatchBoard/Access') return route.fulfill(envelope(access))
    if (p === 'DispatchBoard/Board') {
      boards.push(url.searchParams)
      if (boardStatus === 403) return route.fulfill({ status: 403, body: '' })
      if (state.boardDelayMs) await new Promise((r) => setTimeout(r, state.boardDelayMs))
      if (state.boardFail) return route.fulfill(envelope(null, { status: 500, success: false, message: 'Database timeout.', errorCode: 'SD-500' }))
      const store = url.searchParams.get('store')
      const closed = [TAKEN_LOCKED, FELL_BACK, NOT_COMPETED, WITHDRAWN].map((c) =>
        state.released.has(c.deliveryNumber) ? { ...c, locked: false, releasedAt: stamp(1000), releasedBy: 'msartawi', releaseReason: 'Other', releaseNote: 'n' } : c,
      )
      const keep = (c) => !store || c.bids.some((b) => b.store === store) || c.awardedParty === store || c.fallbackParty === store
      return route.fulfill(envelope({ asOf: stamp(0), windowMinutes: 60, tiles: TILES, open: OPEN.filter(keep), closed: closed.filter(keep) }))
    }
    if (p === 'DispatchBoard/ReleaseLock') {
      const body = JSON.parse(route.request().postData() ?? '{}')
      releases.push(body)
      const mode = state.releaseMode
      if (mode === 'ok') {
        state.released.add(body.deliveryNumber)
        return route.fulfill(
          envelope({ deliveryNumber: body.deliveryNumber, calloutId: `C-${body.deliveryNumber}`, heldBy: 'P014', releasedAt: stamp(0), releasedBy: 'msartawi', reason: body.reason, note: body.note ?? '' }),
        )
      }
      if (mode === 'SD-500') return route.fulfill(envelope(null, { status: 500, success: false, message: 'Database timeout.', errorCode: 'SD-500' }))
      return route.fulfill(envelope(null, { status: 400, success: false, message: 'server words', errorCode: mode }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, boards, releases, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const last = (a) => a[a.length - 1]
const text = async (loc) => strip(await loc.innerText())
const rowOf = (page, grid, no) => page.locator(`[data-${grid}-grid] .ag-row:has([data-delivery="${no}"])`).first()

const T = {
  ltr: {
    tile0: 'On callout now 2 oldest 1:10',
    tile1: 'Bids awaiting an answer 3 1 at a dark store',
    tile2: 'Taken · last 60 min 1 median time to take 1:15',
    title: 'Dispatch board',
    denied: 'You do not have access',
    release: 'Release lock',
  },
  // The app's language stays `en` until Arabic is switched on (`core/i18n.ts`: `lng: 'en'`); RTL is the
  // direction alone, so the same words are read, mirrored. The `ar` bundle ships beside the `en` one.
  get rtl() {
    return this.ltr
  },
}

for (const dir of ['ltr', 'rtl']) {
  const L = T[dir]
  // ── 1–5: the board with Execute ─────────────────────────────────────────────────────────────
  {
    const { context, page, errors, boards, releases, state } = await open(dir)
    await page.goto(URL_)
    await page.locator('[data-open-grid] [data-delivery="D9001"]').waitFor({ timeout: 20000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the title`, (await page.locator('h1').first().innerText()).trim() === L.title)
    check(`${dir} 1. the menu leaf is shown`, (await page.locator('a[href="/oms/dispatch-board"]').count()) >= 1)
    const tiles = await page.locator('[data-tile]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') + '=' + e.getAttribute('data-tile-value')))
    check(`${dir} 1. six tiles in order with their figures`, JSON.stringify(tiles) === JSON.stringify(['onCalloutNow=2', 'bidsAwaiting=3', 'takenLastHour=1', 'fellBack=1', 'notCompeted=1', 'withdrawn=1']), JSON.stringify(tiles))
    check(`${dir} 1. tile lines`, (await text(page.locator('[data-tile="onCalloutNow"]'))) === L.tile0 && (await text(page.locator('[data-tile="bidsAwaiting"]'))) === L.tile1 && (await text(page.locator('[data-tile="takenLastHour"]'))) === L.tile2, [await text(page.locator('[data-tile="onCalloutNow"]')), await text(page.locator('[data-tile="bidsAwaiting"]')), await text(page.locator('[data-tile="takenLastHour"]'))].join(' | '))
    check(`${dir} 1. the fell-back tile draws attention`, /border-t-attention/.test((await page.locator('[data-tile="fellBack"]').getAttribute('class')) ?? ''))
    check(`${dir} 1. asOf is shown`, (await page.locator('[data-as-of]').count()) === 1 && /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(await page.locator('[data-as-of]').innerText()))
    if (dir === 'rtl') {
      check('rtl 1. tile figures are ltr isolates', (await page.locator('[data-tile="onCalloutNow"] bdi[dir="ltr"]').first().innerText()) === '2')
    }

    // 2. countdown
    const cd = page.locator('[data-open-grid] .ag-row:has([data-delivery="D9002"]) [data-countdown]')
    const c1 = Number(await cd.getAttribute('data-countdown'))
    await page.waitForTimeout(2300)
    const c2 = Number(await cd.getAttribute('data-countdown'))
    check(`${dir} 2. the countdown moves on the 1 s clock`, c1 <= 200 && c1 - c2 >= 2 && c1 - c2 <= 3, `${c1} → ${c2}`)
    const low = page.locator('[data-open-grid] .ag-row:has([data-delivery="D9001"]) [data-countdown]')
    await page.waitForTimeout(1500)
    check(`${dir} 2. a due countdown stops at 0, never below`, (await low.getAttribute('data-countdown')) === '0' && strip(await low.innerText()).startsWith('0:00'), await low.innerText())
    if (dir === 'rtl') check('rtl 2. the countdown is an ltr isolate', (await low.locator('bdi[dir="ltr"]').first().innerText()) === '0:00')
    const closedRows = await page.locator('[data-closed-grid] [data-delivery]').evaluateAll((els) => els.map((e) => e.getAttribute('data-delivery')))
    check(`${dir} 2. closed grid holds the four closed callouts`, JSON.stringify(closedRows) === JSON.stringify(['D8001', 'D8002', 'D8003', 'D8004']), JSON.stringify(closedRows))
    const outcomes = await page.locator('[data-closed-grid] [data-outcome]').evaluateAll((els) => els.map((e) => e.getAttribute('data-outcome') + (e.querySelector('[data-locked]') ? '+lock' : '')))
    check(`${dir} 2. outcomes with the lock`, JSON.stringify(outcomes) === JSON.stringify(['Taken+lock', 'FellBack+lock', 'NotCompeted', 'Withdrawn']), JSON.stringify(outcomes))

    // 3. inspector — the first open callout by default
    const insp = page.locator('[data-inspector]')
    check(`${dir} 3. the inspector opens on the first open callout`, (await insp.getAttribute('data-inspector')) === 'C-D9001')
    check(`${dir} 3. one row per bid`, (await insp.locator('[data-bid]').count()) === 3)
    check(`${dir} 3. a dark store is marked dark with 0 / 0 tills`, (await insp.locator('[data-bid="P022"] [data-dark]').count()) === 1 && strip(await insp.locator('[data-bid="P022"] [data-tills]').innerText()) === '0 / 0')
    const atp = await insp.locator('[data-atp]').evaluateAll((els) => els.map((e) => e.getAttribute('data-atp')))
    check(`${dir} 3. ATP covers · short · not checked`, JSON.stringify(atp) === JSON.stringify(['covers', 'short', 'unknown']), JSON.stringify(atp))
    if (dir === 'ltr') check('ltr 3. short shows its line count', strip(await insp.locator('[data-bid="P022"] [data-atp]').innerText()) === 'short 2')
    const secs = await insp.locator('[data-bid="P014"] [data-moment]').evaluateAll((els) => els.map((e) => e.getAttribute('data-moment') + ':' + e.getAttribute('data-moment-seconds')))
    check(`${dir} 3. the moments carry seconds from offer`, JSON.stringify(secs) === JSON.stringify(['delivered:4', 'shown:9', 'opened:15']), JSON.stringify(secs))
    check(`${dir} 3. the last moment reads +0:15`, (await insp.locator('[data-bid="P014"] [data-seen]').innerText()).includes('+0:15'))
    check(`${dir} 3. an unknown bid status renders as itself`, strip(await insp.locator('[data-bid="P030"] [data-answer]').innerText()) === 'HANDED')
    check(`${dir} 3. an open callout's inspector counts down`, (await insp.locator('[data-inspector-countdown] [data-countdown]').count()) === 1)
    check(`${dir} 3. no Release lock on an open callout`, (await insp.locator('[data-release-open]').count()) === 0)

    // the taken callout: answer with staff and register, lost race, expired with its reason
    await rowOf(page, 'closed', 'D8001').click()
    await page.locator('[data-inspector="C-D8001"]').waitFor()
    check(`${dir} 3. the answer carries staff, register and +1:15`, /amal · .*02 · \+1:15/.test(strip(await insp.locator('[data-bid="P014"] [data-answered-by]').innerText())), await insp.locator('[data-bid="P014"] [data-answered-by]').innerText())
    check(`${dir} 3. lost and expired stay distinct, expired shows its ignore reason`, (await insp.locator('[data-bid-status="LOST"]').count()) === 1 && (await insp.locator('[data-bid="P030"] [data-ignore-reason="ShownNotOpened"]').count()) === 1)
    check(`${dir} 3. the locked line names the store`, (await insp.locator('[data-locked-line]').innerText()).includes('P014'))
    if (dir === 'rtl') check('rtl 3. the inspector delivery is an ltr isolate', (await insp.locator('[data-inspector-delivery] bdi[dir="ltr"]').innerText()) === 'D8001')

    // not competed
    await rowOf(page, 'closed', 'D8003').click()
    await page.locator('[data-inspector="C-D8003"]').waitFor()
    check(
      `${dir} 3. a not-competed callout says why, in words`,
      (await insp.locator('[data-not-competed-reason="OneCandidate"]').innerText()).trim() === 'only one store in reach' && (await insp.locator('[data-bid]').count()) === 0,
      await insp.locator('[data-not-competed]').innerText(),
    )

    // 4. Release lock
    await rowOf(page, 'closed', 'D8001').click()
    await page.locator('[data-inspector="C-D8001"] [data-release-open]').click()
    const dlg = page.locator('[data-release-dialog="D8001"]')
    await dlg.waitFor()
    check(`${dir} 4. the dialog opens with its title`, (await page.locator('#modal-title').innerText()).trim() === L.release)
    const confirm = page.locator('[data-release-confirm]')
    check(`${dir} 4. no reason → blocked`, (await confirm.isDisabled()) && (await dlg.locator('[data-release-blocked="reasonMissing"]').count()) === 1)
    await dlg.locator('[data-release-reason="Other"]').check()
    check(`${dir} 4. Other without a note → blocked`, (await confirm.isDisabled()) && (await dlg.locator('[data-release-blocked="noteMissing"]').count()) === 1)
    await dlg.locator('[data-release-note]').fill('  customer moved  ')
    check(`${dir} 4. Other with a note may be sent`, !(await confirm.isDisabled()))
    for (const code of ['CALLOUT-102', 'CALLOUT-103', 'CALLOUT-104']) {
      state.releaseMode = code
      await confirm.click()
      await dlg.locator(`[data-release-refusal="${code}"]`).waitFor({ timeout: 5000 }).catch(() => {})
      check(`${dir} 4. ${code} shows its own sentence in the dialog`, (await dlg.locator(`[data-release-refusal="${code}"]`).count()) === 1 && !(await dlg.locator(`[data-release-refusal="${code}"]`).innerText()).includes('server words'))
      // an edit clears the refusal
      await dlg.locator('[data-release-note]').fill('customer moved ')
    }
    state.releaseMode = 'SD-500'
    await confirm.click()
    await dlg.locator('[data-release-error="SD-500"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. any other failure shows the server's message and code`, (await dlg.locator('[data-release-error="SD-500"]').count()) === 1 && (await dlg.innerText()).includes('Database timeout.'))
    check(`${dir} 4. the body is { deliveryNumber, reason, note } trimmed`, JSON.stringify(last(releases)) === JSON.stringify({ deliveryNumber: 'D8001', reason: 'Other', note: 'customer moved' }), JSON.stringify(last(releases)))
    state.releaseMode = 'ok'
    const before = boards.length
    await confirm.click()
    await dlg.waitFor({ state: 'detached', timeout: 5000 })
    await page.locator('[data-inspector="C-D8001"] [data-change-store]').waitFor({ timeout: 5000 })
    check(`${dir} 4. a release closes the dialog and refreshes the board`, boards.length > before)
    check(`${dir} 4. Change store opens the delivery's details`, (await page.locator('[data-change-store]').getAttribute('href')) === '/oms/delivery/D8001')
    check(`${dir} 4. after release: no Release lock, no lock line`, (await insp.locator('[data-release-open]').count()) === 0 && (await insp.locator('[data-locked-line]').count()) === 0)
    await page.waitForTimeout(300)
    check(`${dir} 4. the closed grid drops the lock after the refetch`, (await rowOf(page, 'closed', 'D8001').locator('[data-locked]').count()) === 0)

    // 5. filters
    await page.locator('[data-filter="city"]').fill('Riyadh')
    await page.locator('[data-filter="store"]').fill('P014')
    await page.locator('[data-filter-apply]').click()
    for (let i = 0; i < 40 && last(boards).get('store') !== 'P014'; i++) await page.waitForTimeout(100)
    await page.waitForTimeout(300)
    const u = new URL(page.url()).searchParams
    check(`${dir} 5. filters land in the URL`, u.get('city') === 'Riyadh' && u.get('store') === 'P014' && !u.has('channel'), page.url())
    check(`${dir} 5. …and reach the door`, last(boards).get('city') === 'Riyadh' && last(boards).get('store') === 'P014' && !last(boards).has('channel'), last(boards).toString())
    check(`${dir} 5. the store filter narrows the board`, (await page.locator('[data-closed-grid] [data-delivery]').count()) === 1)
    await page.locator('[data-filter-clear]').click()
    await page.waitForTimeout(400)
    check(`${dir} 5. Clear empties the URL`, new URL(page.url()).search === '')
    check(`${dir} no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // a URL with filters opens on them
  {
    const { context, page, boards } = await open(dir)
    await page.goto(`${URL_}?channel=HYBR&city=RUH`)
    await page.locator('[data-tile]').first().waitFor({ timeout: 20000 })
    check(`${dir} 5. a URL opens on its filters`, boards[0].get('channel') === 'HYBR' && boards[0].get('city') === 'RUH' && (await page.locator('[data-filter="channel"]').inputValue()) === 'HYBR')
    await context.close()
  }

  // ── Display only: no Release lock ───────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, { access: { canOpenDispatchBoard: true, canReleaseLock: false } })
    await page.goto(URL_)
    await rowOf(page, 'closed', 'D8001').waitFor({ timeout: 20000 })
    await rowOf(page, 'closed', 'D8001').click()
    await page.locator('[data-inspector="C-D8001"]').waitFor()
    check(`${dir} 4. Display only: locked line shown, no Release lock`, (await page.locator('[data-locked-line]').count()) === 1 && (await page.locator('[data-release-open]').count()) === 0)
    await context.close()
  }

  // ── 7. no Display; a bare 403 on the board ──────────────────────────────────────────────────
  {
    const { context, page, boards } = await open(dir, { access: { canOpenDispatchBoard: false, canReleaseLock: true } })
    await page.goto(URL_)
    await page.getByText(L.denied).first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(`${dir} 7. without Display the gate denies, with no board read`, boards.length === 0 && (await page.locator('[data-dispatch-board]').count()) === 0)
    check(`${dir} 7. …and the menu leaf is hidden`, (await page.locator('a[href="/oms/dispatch-board"]').count()) === 0)
    await context.close()
  }
  {
    const { context, page } = await open(dir, { boardStatus: 403 })
    await page.goto(URL_)
    await page.locator('[data-board-denied]').waitFor({ timeout: 20000 })
    check(`${dir} 7. a bare 403 reads "${L.denied}", never an empty board`, (await page.locator('[data-board-denied]').innerText()).includes(L.denied) && (await page.locator('[data-tiles]').count()) === 0)
    await context.close()
  }
}

// ── 6. polling, paused in a hidden tab ──────────────────────────────────────────────────────────
{
  const { context, page, boards } = await open('ltr', { clock: true })
  await page.goto(URL_)
  await page.locator('[data-tile]').first().waitFor({ timeout: 20000 })
  const n0 = boards.length
  await page.clock.fastForward(31_000)
  await page.waitForTimeout(500)
  check('6. the board refetches every 30 s', boards.length === n0 + 1, `${n0} → ${boards.length}`)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  const n1 = boards.length
  await page.clock.fastForward(95_000)
  await page.waitForTimeout(500)
  check('6. a hidden tab stops polling', boards.length === n1, `${n1} → ${boards.length}`)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.fastForward(31_000)
  await page.waitForTimeout(500)
  check('6. shown again, it polls again', boards.length > n1, `${n1} → ${boards.length}`)
  await context.close()
}

// ── 8. a failed poll keeps the last good board; a new filter's read keeps the old countdowns ─────
{
  const { context, page, state } = await open('ltr', { clock: true })
  await page.goto(URL_)
  await page.locator('[data-open-grid] [data-delivery="D9001"]').waitFor({ timeout: 20000 })
  state.boardFail = true
  await page.clock.fastForward(31_000)
  await page.locator('[data-board-stale]').waitFor({ timeout: 5000 }).catch(() => {})
  check(
    '8. one failed poll keeps the last good board, with a notice',
    (await page.locator('[data-board-stale]').count()) === 1 &&
      (await page.locator('[data-open-grid] [data-delivery="D9001"]').count()) === 1 &&
      (await page.locator('[data-tile]').count()) === 6,
  )
  state.boardFail = false
  await page.clock.fastForward(31_000)
  await page.waitForTimeout(500)
  check('8. the next good poll clears the notice', (await page.locator('[data-board-stale]').count()) === 0)
  await context.close()
}
{
  const { context, page, state } = await open('ltr')
  await page.goto(URL_)
  await page.locator('[data-open-grid] [data-delivery="D9002"]').waitFor({ timeout: 20000 })
  state.boardDelayMs = 4000
  await page.locator('[data-filter="channel"]').fill('WEB')
  await page.locator('[data-filter-apply]').click()
  await page.waitForTimeout(1500)
  const left = Number(await page.locator('[data-open-grid] .ag-row:has([data-delivery="D9002"]) [data-countdown]').getAttribute('data-countdown'))
  check('8. while a new filter reads, the previous board keeps counting down (not 0:00)', left > 0, String(left))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
