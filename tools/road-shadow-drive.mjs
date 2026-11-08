// Road distance (Shadow) drive (ticket 859, BackOffice spec 3460 / door 3470) — drives the REAL Shadow report page in
// Chromium against STUBBED `DispatchBoard/*` envelopes, shaped from BackOffice `CalloutRoadShadowReport`
// (`CalloutRoadShadowReportService.cs`, pricing2). Never point this at a real host; the live read is 859's last Proof line.
//
// It verifies, in LTR and RTL:
//   1. the menu leaf is shown with the board's Display, and the default call sends `type=QC` over the last 7 days;
//   2. the four tiles and their shares of Measured; the fallbacks by reason, a known reason in words with its hint and
//      an unknown code raw; the total and its share; the warning above 2%; the median to 2 decimals beside its bids;
//   3. "All types" sends no type (the door's '') and keeps `type=` in the URL; a URL opens on its filters;
//   4. a `CALLOUT-301` refusal shows the server's own bilingual message;
//   5. an empty range says so and links to the delivery-type form; a null median reads "Not enough measured bids";
//      nothing measured shows "—" shares, never a divide-by-zero;
//   6. no Display → the gate's denial, no report read, and the menu leaf hidden.
//
//   1. run the app:  npx vite --port 5201
//   2. node tools/road-shadow-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`
const URL_ = `${BASE}/oms/dispatch-board/road-shadow`

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
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const today = new Date()
const TODAY = day(today)
const WEEK_AGO = day(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6))

// 200 measured; fallbacks 3 + 2 + 1 = 6 → 6 / 206 = 2.9% (high).
const FULL = {
  measured: 200,
  fallbacks: [
    { reason: 'TIMEOUT', count: 3 },
    { reason: 'GEOCODE_MISS', count: 2 },
    { reason: 'quota', count: 1 },
  ],
  roadWouldRemoveBids: 14,
  roadWouldWiden: 30,
  competedWouldDiffer: 9,
  measuredBids: 612,
  medianRoadToStraightRatio: 1.315,
}
const EMPTY = { measured: 0, fallbacks: [], roadWouldRemoveBids: 0, roadWouldWiden: 0, competedWouldDiffer: 0, measuredBids: 0, medianRoadToStraightRatio: null }
// Only fallbacks: nothing measured, so every tile share is "—" and the median is null.
const ONLY_FALLBACKS = { ...EMPTY, fallbacks: [{ reason: 'KEY', count: 4 }] }
const REFUSAL = 'The range is longer than 92 days. / الفترة أطول من 92 يومًا.'

const browser = await chromium.launch()

async function open(dir, { access = { canOpenDispatchBoard: true, canReleaseLock: false } } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(180000)
  const errors = []
  const reads = []
  const state = { body: FULL, refuse: false }
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
    if (p === 'SdDocument/DeliveryDocumentTypes')
      return route.fulfill(envelope([{ documentType: 'NOR', description: 'Normal' }, { documentType: 'QC', description: 'Quick commerce' }]))
    if (p === 'DispatchBoard/RoadShadow') {
      reads.push(url.searchParams)
      if (state.refuse) return route.fulfill(envelope(null, { status: 400, success: false, message: REFUSAL, errorCode: 'CALLOUT-301' }))
      const from = url.searchParams.get('from') ?? ''
      const to = url.searchParams.get('to') ?? ''
      return route.fulfill(
        envelope({ asOf: `${TODAY}T10:15:00`, from: `${from}T00:00:00`, to: `${to}T00:00:00`, type: url.searchParams.get('type') ?? '', ...state.body }),
      )
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const text = async (loc) => strip(await loc.innerText())
const last = (a) => a[a.length - 1]

for (const dir of ['ltr', 'rtl']) {
  // ── 1–3: the full week ────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, reads, state } = await open(dir)
    await page.goto(URL_)
    await page.locator('[data-rs-tiles]').waitFor({ timeout: 20000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the menu leaf is shown`, (await page.locator('a[href="/oms/dispatch-board/road-shadow"]').count()) >= 1)
    const first = reads[0]
    check(
      `${dir} 1. the default call sends type=QC over the last 7 days`,
      first?.get('type') === 'QC' && first?.get('from') === WEEK_AGO && first?.get('to') === TODAY,
      first?.toString(),
    )
    check(`${dir} 1. the type select shows QC`, (await page.locator('[data-rs-filter="type"]').inputValue()) === 'QC')

    const tile = (k) => page.locator(`[data-rs-tile="${k}"]`)
    const tiles = {
      measured: ['200', '100%'],
      removed: ['14', '7%'],
      widened: ['30', '15%'],
      competed: ['9', '4.5%'],
    }
    for (const [k, [v, share]] of Object.entries(tiles)) {
      check(
        `${dir} 2. tile ${k} reads ${v} and ${share} of measured`,
        (await tile(k).getAttribute('data-rs-tile-value')) === v && (await tile(k).locator('[data-rs-tile-share]').innerText()).includes(share),
      )
    }
    check(`${dir} 2. the tiles read in words`, (await text(tile('removed'))).startsWith('Would remove a store'), await text(tile('removed')))
    if (dir === 'rtl') {
      check('rtl 2. a tile figure is an ltr isolate', (await tile('measured').locator('bdi[dir="ltr"]').first().innerText()) === '200')
      check('rtl 2. a share is one ltr isolate, the % with it', (await tile('competed').locator('[data-rs-tile-share] bdi[dir="ltr"]').innerText()) === '4.5%')
    }

    const fb = page.locator('[data-rs-fallbacks]')
    const timeout = fb.locator('[data-rs-fallback="TIMEOUT"]')
    check(`${dir} 2. a known reason reads in words`, (await text(timeout.locator('[data-rs-fallback-label]'))).startsWith('Google timed out'))
    check(`${dir} 2. …with the runbook action as a hint`, (await text(timeout.locator('[data-rs-fallback-hint]'))).includes('GoogleRoutes:TimeoutSeconds'))
    check(`${dir} 2. a lower-case known code still reads in words`, (await fb.locator('[data-rs-fallback="QUOTA"]').getAttribute('data-rs-fallback-known')) === 'true')
    const unknown = fb.locator('[data-rs-fallback="GEOCODE_MISS"]')
    check(
      `${dir} 2. an unknown code stays raw`,
      (await unknown.getAttribute('data-rs-fallback-known')) === 'false' && (await text(unknown.locator('[data-rs-fallback-label]'))) === 'GEOCODE_MISS',
    )
    const total = fb.locator('[data-rs-fallbacks-total]')
    check(
      `${dir} 2. the total is 6, 2.9% of measured + fallbacks`,
      (await total.getAttribute('data-rs-fallbacks-total')) === '6' && (await total.getAttribute('data-rs-fallbacks-share')) === '2.9%',
    )
    check(
      `${dir} 2. above 2% the panel warns`,
      (await fb.getAttribute('data-rs-fallbacks-high')) === 'true' &&
        (await text(fb.locator('[data-rs-fallbacks-warning]'))) === 'Fallbacks are high: check the key and the quota before switching on',
    )
    const median = page.locator('[data-rs-median]')
    check(`${dir} 2. the median reads to 2 decimals`, (await median.locator('[data-rs-median-ratio]').getAttribute('data-rs-median-ratio')) === '1.32')
    check(`${dir} 2. …beside its measured bids`, (await text(median.locator('[data-rs-median-bids]'))) === 'over 612 measured bids')
    check(`${dir} 2. …with the helper line`, (await text(median)).includes('About 1.3 is normal in a city; much higher means long detours'))
    check(`${dir} 2. the as-of stamp shows`, (await text(page.locator('[data-rs-as-of]'))).startsWith('As of'))
    if (dir === 'rtl') check('rtl 2. the range is one ltr isolate', (await page.locator('[data-rs-covers] bdi[dir="ltr"]').count()) === 1)

    // 3. All types: no type to the door (its ''), `type=` in the URL.
    await page.locator('[data-rs-filter="type"]').selectOption('')
    await page.waitForTimeout(600)
    const all = last(reads)
    check(`${dir} 3. All types sends a blank type`, reads.length >= 2 && (all.get('type') ?? '') === '', all?.toString())
    check(`${dir} 3. …and keeps type= in the URL`, new URL(page.url()).search === '?type=', page.url())

    // A URL opens on its filters.
    await page.goto(`${URL_}?from=2026-10-01&to=2026-10-31&type=NOR`)
    await page.locator('[data-rs-tiles]').waitFor()
    const pasted = last(reads)
    check(
      `${dir} 3. a URL opens on its range and type`,
      pasted.get('from') === '2026-10-01' && pasted.get('to') === '2026-10-31' && pasted.get('type') === 'NOR' &&
        (await page.locator('[data-rs-filter="type"]').inputValue()) === 'NOR',
    )

    // (review) Picking only To before the default From keeps a 7-day window, never a reversed range.
    await page.goto(URL_)
    await page.locator('[data-rs-tiles]').waitFor()
    await page.locator('[data-rs-filter="to"]').fill('2026-10-15')
    await page.waitForTimeout(600)
    const picked = last(reads)
    check(
      `${dir} 3. a To before the default From keeps a 7-day window`,
      picked.get('from') === '2026-10-09' && picked.get('to') === '2026-10-15',
      picked.toString(),
    )

    // 4. A CALLOUT-301 refusal shows the server's own words.
    state.refuse = true
    await page.goto(`${URL_}?from=2026-01-01&to=2026-10-31`)
    await page.locator('[data-rs-failed]').waitFor()
    check(`${dir} 4. a long range is sent to the door`, last(reads).get('from') === '2026-01-01')
    check(`${dir} 4. CALLOUT-301 shows the server's bilingual message`, (await text(page.locator('[data-rs-failed]'))).includes(REFUSAL))
    state.refuse = false

    // 5. An empty range, and nothing-measured shares.
    state.body = EMPTY
    await page.goto(URL_)
    await page.locator('[data-rs-empty]').waitFor()
    check(
      `${dir} 5. an empty range asks whether the type is in Shadow`,
      (await text(page.locator('[data-rs-empty]'))).startsWith('No Shadow callouts in this range. Is the type set to Shadow?'),
    )
    check(`${dir} 5. …and links to the delivery-type form`, (await page.locator('[data-rs-empty] a').getAttribute('href')) === '/admin/delivery-types/QC')

    state.body = ONLY_FALLBACKS
    await page.goto(URL_)
    await page.locator('[data-rs-tiles]').waitFor()
    const shares = await page.locator('[data-rs-tile-share]').evaluateAll((els) => els.map((e) => e.getAttribute('data-rs-tile-share')))
    check(`${dir} 5. nothing measured shows "—" for every share`, shares.length === 4 && shares.every((s) => s === '—'), shares.join(','))
    check(`${dir} 5. a null median reads "Not enough measured bids"`, (await text(page.locator('[data-rs-median-none]'))) === 'Not enough measured bids')

    check(`${dir} no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: no Display ─────────────────────────────────────────────────────────────────────────
  {
    const { context, page, reads } = await open(dir, { access: { canOpenDispatchBoard: false, canReleaseLock: false } })
    await page.goto(URL_)
    await page.getByText('You do not have access').first().waitFor({ timeout: 20000 })
    check(`${dir} 6. no Display → the gate's denial and no report read`, reads.length === 0)
    check(`${dir} 6. …and the menu leaf is hidden`, (await page.locator('a[href="/oms/dispatch-board/road-shadow"]').count()) === 0)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
