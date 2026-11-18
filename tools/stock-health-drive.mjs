// Stock health drive (oms 912; BackOffice spec 4011, door 4012, grant 3994).
//
// Drives the REAL app in Chromium against a STUB of the doors, in the shapes 4012 shipped (the brief's "Changes" lines,
// `C:\Work\DMSCO\BackOffice\.issues\assets\4011-oms-react-stock-health-brief.md`), camelCase:
//   GET StockHealth/Access → { screenAllowed }
//   GET StockHealth        → { readAt, signals[] }   (S1..S7; S8 drsQueue only once 3993 ships)
// In LTR and RTL, light and dark, it asserts:
//   1. without the grant: no leaf, the URL shows the denied card, no StockHealth call;
//   2. with it: the leaf sits right after Store stages; the tiles come in the server's order, one per signal;
//   3. each tile's tone follows its verdict (noAnswer is did-not-answer, red-outlined, never neutral; null is neutral);
//      the header counts the judged signals that are not good; "as of" is the server's wall-clock, unshifted;
//   4. a tile shows at most five figures (S7's stuck-seeding count shows); a tile with a link is a link, one without is not;
//   5. the Refresh button re-reads, and so does the 60-second timer;
//   6. with S8 present (3993's shape) and every judged signal good: eight tiles, S8 with its five figures, "All good";
//      S8 null ("DRS holds are off": every instance switched off, figures still shown) is neutral and not counted;
//      S8 judged per instance (two DRS instances, one slow): watch, the reason names the instance, header counts 1;
//   7. a tile opens its link;
//   8. no page errors;
//   9. S9 `batchBookVsSap` and S10 `negativeStock` (BackOffice spec 4013, door 4014, oms 913), in light and dark: ten tiles,
//      the two last, each with its five figures in order; S10 links to the refusals leaf, S9 has no link; green (both
//      good, "All good"), amber (both watch, header counts 2), red (S9 "the nightly comparison is off", S10 Blocking
//      negatives: both bad), and noAnswer (an older Stock Visibility answers 404: both did-not-answer, every other
//      signal still good, header counts 2).
//
//   1. run the app:  npx vite --port 5212 --strictPort
//   2. DRIVE_PORT=5212 node tools/stock-health-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`
const SHOTS = 'tools/.stock-health-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// ── Fixtures, 4012's shapes ─────────────────────────────────────────────────────────────────────
const READ_AT = '2026-11-17T00:30:05' // just after midnight: a UTC shift would show the previous day
const sig = (key, verdict, reason, figures, link = null, readAt = READ_AT) => ({ key, verdict, reason, figures, readAt, link })
const SEVEN = [
  sig('feeds', 'good', 'Every feed passed within its alarm limit.', [
    { label: 'SAP feed age (minutes)', value: 3.2 },
    { label: 'POS feed age (minutes)', value: 1.1 },
  ], 'oms/held-stock-report/refusals'),
  sig('batchWorker', 'watch', '12 row(s) wait to be applied, with no alert.', [
    { label: 'Unapplied rows', value: 12 },
    { label: 'Errored documents', value: 0 },
    { label: 'Alerts', value: 0 },
    { label: 'Lot copy lag (minutes)', value: 0.4 },
  ]),
  sig('hourlyCount', 'noAnswer', "Stock Visibility's Stock/SapCountStatus did not answer: it timed out.", [], 'oms/held-stock-report/refusals', null),
  sig('salePush', 'bad', "Last night's compare found 4 difference(s) between the pushes and the feed.", [
    { label: 'Yesterday within 10 s', value: '99.6%' },
    { label: 'Today within 10 s', value: null },
    { label: "Yesterday's disagreements", value: 0 },
    { label: "Last night's compare differences", value: 4 },
  ]),
  sig('takeDoor', 'good', 'No door call failed today.', [
    { label: 'Takes', value: 120 },
    { label: 'Failed calls', value: 0 },
    { label: 'Failed calls per 100 takes', value: 0 },
    { label: 'Skipped at the time limit', value: 0 },
  ], 'oms/held-stock-report/gates'),
  sig('holdSeamTills', null, '42 till(s) at 17 store(s) heard on the hold seam in the last hour.', [
    { label: 'Tills heard in the last hour', value: 42 },
    { label: 'Stores heard in the last hour', value: 17 },
  ], 'oms/held-stock-report/gates'),
  sig('storeStages', null, '30 Shadow, 2 Seeding, 5 Seeded, 1 Blocking.', [
    { label: 'Shadow', value: 30 },
    { label: 'Seeding', value: 2 },
    { label: 'Seeded', value: 5 },
    { label: 'Blocking', value: 1 },
    { label: 'Seeding over 24 hours', value: 0 },
  ], 'oms/store-stages'),
]
const ALL_GOOD_EIGHT = [
  ...SEVEN.map((s) => (s.verdict === null ? s : { ...s, verdict: 'good', readAt: READ_AT })),
  sig('drsQueue', 'good', "DRS DRSWEB01's queue to SIS.Api drains: 3 call(s) wait, the oldest under 15 minutes. DRS DRSWEB02's queue to SIS.Api is empty.", [
    { label: 'Unsent', value: 3 },
    { label: 'Oldest unsent (minutes)', value: 2.5 },
    { label: 'Failed, waiting to retry', value: 0 },
    { label: 'Last sent', value: '2026-11-17T00:29:40' },
    { label: 'Last heartbeat', value: '2026-11-17T00:29:55' },
  ]),
]

// S9/S10 (4014's shapes, the brief's 2026-11-18 (4014) "Changes" entry)
const S9_LABELS = ['Stores compared', 'Stores drifting', 'Drifting batches', 'Failed stores', 'Last run']
const S10_LABELS = ['Negative batches', 'In blocking stores', 'Would-be refusals today', 'Dummy batch quantity', 'Change since yesterday']
const s9 = (verdict, reason, values, readAt = READ_AT) =>
  sig('batchBookVsSap', verdict, reason, values.map((value, i) => ({ label: S9_LABELS[i], value })), null, readAt)
const s10 = (verdict, reason, values, readAt = READ_AT) =>
  sig('negativeStock', verdict, reason, values.map((value, i) => ({ label: S10_LABELS[i], value })), 'oms/held-stock-report/refusals', readAt)
const noAnswer404 = (key, door, link) =>
  sig(key, 'noAnswer', `Stock Visibility's ${door} did not answer: Stock Visibility's ${door} answered HTTP 404 Not Found.`, [], link, null)
const TEN = {
  green: [
    s9('good', 'The last comparison with SAP is clean: 3 store(s), 1200 batch(es), no drift.', [3, 0, 0, 0, '2026-11-17T02:00:10']),
    s10('good', 'No real batch is negative and no take would have been refused today.', [0, 0, 0, -4.5, 0]),
  ],
  amber: [
    s9('watch', '15 of 1000 compared batch(es) drift from SAP (1.5%), at 2 store(s); 1 store(s) failed in the last comparison with SAP.', [3, 2, 15, 1, '2026-11-17T02:00:10']),
    s10('watch', '3 negative real batch(es) in Seeded stores; 2 take(s) would have been refused today in Seeded stores.', [3, 0, 2, -12.25, 1]),
  ],
  red: [
    s9('bad', 'The nightly comparison with SAP is off (BatchDrift:Nightly on the Stock Visibility worker).', [0, 0, 0, 0, null]),
    s10('bad', '1 negative real batch(es) in Blocking stores; 2 take(s) refused today in Blocking stores; 3 negative real batch(es) in Seeded stores.', [4, 1, 0, -7, 2]),
  ],
  noAnswer: [
    noAnswer404('batchBookVsSap', 'Stock/BatchDrift/Status', null),
    noAnswer404('negativeStock', 'Stock/BatchBook/Negatives', 'oms/held-stock-report/refusals'),
  ],
}

const browser = await chromium.launch()

async function open(dir, { access = 'allowed', signals = SEVEN, dark = false, clock = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  if (clock) await page.clock.install()
  const errors = []
  const calls = { read: 0 }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(
    ({ d, dk }) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
      localStorage.setItem('oms.darkMode', dk ? 'true' : 'false')
    },
    { d: dir, dk: dark },
  )
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'StockHealth/Access') return route.fulfill(envelope({ screenAllowed: access === 'allowed' }))
    if (p === 'StoreStage/Access') return route.fulfill(envelope({ screenAllowed: true, canMove: false }))
    if (p === 'StockHealth') {
      calls.read++
      return route.fulfill(envelope({ readAt: READ_AT, signals }))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canView: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const omsLinks = (page) => page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])
const tiles = (page) => page.locator('[data-health-tile]')
const tileAttr = (page, attr) => tiles(page).evaluateAll((els, a) => els.map((e) => e.getAttribute(a)), attr)

for (const dir of ['ltr', 'rtl']) {
  console.log(`\n── ${dir.toUpperCase()} ──`)

  // 1. not allowed
  {
    const { context, page, errors, calls } = await open(dir, { access: 'denied' })
    await page.goto(`${BASE}/oms/stock-health`)
    await page.waitForLoadState('networkidle')
    check(`${dir} 1 denied: no leaf`, !(await omsLinks(page)).includes('/oms/stock-health'))
    check(`${dir} 1 denied: the denied card`, await page.getByText('No access to stock health').isVisible())
    check(`${dir} 1 denied: no StockHealth call`, calls.read === 0, String(calls.read))
    check(`${dir} 1 denied: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  for (const dark of [false, true]) {
    const theme = dark ? 'dark' : 'light'
    const { context, page, errors, calls } = await open(dir, { dark, clock: true })
    await page.goto(`${BASE}/oms/stock-health`)
    await tiles(page).first().waitFor({ timeout: 15000 })

    // 2. leaf + order
    check(`${dir}/${theme} 2 page direction`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const links = await omsLinks(page)
    check(`${dir}/${theme} 2 leaf right after Store stages`, links.indexOf('/oms/stock-health') === links.indexOf('/oms/store-stages') + 1, links.join(','))
    const order = await tileAttr(page, 'data-health-tile')
    check(`${dir}/${theme} 2 tiles in the server's order`, order.join(',') === SEVEN.map((s) => s.key).join(','), order.join(','))

    // 3. tones + header + as of
    const tones = await tileAttr(page, 'data-tone')
    check(`${dir}/${theme} 3 tones follow verdicts`, tones.join(',') === 'good,watch,noAnswer,bad,good,neutral,neutral', tones.join(','))
    const dead = page.locator('[data-health-tile="hourlyCount"]')
    check(`${dir}/${theme} 3 noAnswer says did not answer`, (await dead.locator('[data-health-verdict]').innerText()).trim() === 'Did not answer')
    const outline = await dead.evaluate((e) => getComputedStyle(e).borderTopWidth)
    check(`${dir}/${theme} 3 noAnswer is outlined`, outline === '2px', outline)
    check(`${dir}/${theme} 3 header counts 3`, /3 need attention/.test((await page.locator('[data-health-header]').innerText()).replace(/[\u2066-\u2069]/g, '')))
    const asOf = (await page.locator('[data-health-as-of]').innerText()).replace(/[\u2066-\u2069]/g, '')
    check(`${dir}/${theme} 3 as of, unshifted`, asOf === 'as of 2026-11-17 00:30:05', asOf)

    // 4. figures + links
    const s5 = await page.locator('[data-health-tile="takeDoor"] [data-health-figure]').evaluateAll((els) => els.map((e) => e.getAttribute('data-health-figure')))
    check(`${dir}/${theme} 4 takeDoor's four figures in order`, s5.join('|') === 'Takes|Failed calls|Failed calls per 100 takes|Skipped at the time limit', s5.join('|'))
    check(`${dir}/${theme} 4 storeStages shows all five figures`, (await page.locator('[data-health-tile="storeStages"] [data-health-figure]').count()) === 5)
    const tags = await tiles(page).evaluateAll((els) => els.map((e) => e.tagName))
    check(`${dir}/${theme} 4 linked tiles are links`, tags.join(',') === 'A,DIV,A,DIV,A,A,A', tags.join(','))
    await page.screenshot({ path: `${SHOTS}/${dir}-${theme}.png`, fullPage: true })

    // 5. refresh
    const before = calls.read
    await page.locator('[data-health-refresh]').click()
    await page.waitForTimeout(300)
    check(`${dir}/${theme} 5 Refresh re-reads`, calls.read === before + 1, `${before} → ${calls.read}`)
    const beforeTimer = calls.read
    await page.clock.runFor(61_000)
    await page.waitForTimeout(300)
    check(`${dir}/${theme} 5 the 60-second timer re-reads`, calls.read > beforeTimer, `${beforeTimer} → ${calls.read}`)

    // 7. a tile opens its link
    if (!dark) {
      await page.locator('[data-health-tile="takeDoor"]').click()
      await page.waitForURL('**/oms/held-stock-report/gates', { timeout: 5000 }).catch(() => {})
      check(`${dir}/${theme} 7 a tile opens its link`, new URL(page.url()).pathname === '/oms/held-stock-report/gates', page.url())
    }
    check(`${dir}/${theme} 8 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 6. S8 present, every judged signal good
  {
    const { context, page, errors } = await open(dir, { signals: ALL_GOOD_EIGHT })
    await page.goto(`${BASE}/oms/stock-health`)
    await tiles(page).first().waitFor({ timeout: 15000 })
    const order = await tileAttr(page, 'data-health-tile')
    check(`${dir} 6 eight tiles with drsQueue last`, order.length === 8 && order[7] === 'drsQueue', order.join(','))
    check(`${dir} 6 All good`, (await page.locator('[data-health-header]').getAttribute('data-health-header')) === 'allGood')
    check(`${dir} 6 S8 shows its five figures`, (await page.locator('[data-health-tile="drsQueue"] [data-health-figure]').count()) === 5)
    check(`${dir} 6 S8 has no link`, (await page.locator('[data-health-tile="drsQueue"]').evaluate((e) => e.tagName)) === 'DIV')
    check(`${dir} 6 header reads All good`, /All good/.test(await page.locator('[data-health-header]').innerText()))
    await page.screenshot({ path: `${SHOTS}/${dir}-all-good.png`, fullPage: true })
    check(`${dir} 6 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 6b. S8 null: every DRS instance beats with its holds off - the figures still show, neutral, not counted
  {
    const off = [
      ...ALL_GOOD_EIGHT.slice(0, 7),
      sig('drsQueue', null, 'DRS holds are off: DRSWEB01, DRSWEB02 said so in its last heartbeat.', ALL_GOOD_EIGHT[7].figures),
    ]
    const { context, page, errors } = await open(dir, { signals: off })
    await page.goto(`${BASE}/oms/stock-health`)
    await tiles(page).first().waitFor({ timeout: 15000 })
    const s8 = page.locator('[data-health-tile="drsQueue"]')
    check(`${dir} 6b S8 holds off is neutral`, (await s8.getAttribute('data-tone')) === 'neutral')
    check(`${dir} 6b S8 holds off keeps its five figures`, (await s8.locator('[data-health-figure]').count()) === 5)
    check(`${dir} 6b S8 holds off is not counted`, (await page.locator('[data-health-header]').getAttribute('data-health-header')) === 'allGood')
    check(`${dir} 6b no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 6c. S8 judged per instance: DRSWEB01 drains, DRSWEB02's oldest row is 22 minutes old - the worst (watch) wins
  {
    const slow = 'DRS DRSWEB02: 4 call(s) wait in its queue to SIS.Api, the oldest for 22 minutes; 1 failed and wait to retry.'
    const two = [
      ...ALL_GOOD_EIGHT.slice(0, 7),
      sig('drsQueue', 'watch', slow, [
        { label: 'Unsent', value: 7 },
        { label: 'Oldest unsent (minutes)', value: 22.4 },
        { label: 'Failed, waiting to retry', value: 1 },
        { label: 'Last sent', value: '2026-11-17T00:29:40' },
        { label: 'Last heartbeat', value: '2026-11-17T00:29:58' },
      ]),
    ]
    const { context, page, errors } = await open(dir, { signals: two })
    await page.goto(`${BASE}/oms/stock-health`)
    await tiles(page).first().waitFor({ timeout: 15000 })
    const s8 = page.locator('[data-health-tile="drsQueue"]')
    check(`${dir} 6c S8 worst instance wins: watch`, (await s8.getAttribute('data-tone')) === 'watch')
    check(`${dir} 6c S8 reason names the instance`, (await s8.locator('[data-health-reason]').innerText()).includes('DRSWEB02'))
    check(`${dir} 6c header counts 1`, /1 need attention/.test((await page.locator('[data-health-header]').innerText()).replace(/[\u2066-\u2069]/g, '')))
    await page.screenshot({ path: `${SHOTS}/${dir}-drs-watch.png`, fullPage: true })
    check(`${dir} 6c no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 9. S9 and S10 (spec 4013, door 4014): green, amber, red, noAnswer (404 from an older Stock Visibility), light and dark
  for (const dark of [false, true]) {
    const theme = dark ? 'dark' : 'light'
    for (const [name, pair] of Object.entries(TEN)) {
      const { context, page, errors } = await open(dir, { dark, signals: [...ALL_GOOD_EIGHT, ...pair] })
      await page.goto(`${BASE}/oms/stock-health`)
      await tiles(page).first().waitFor({ timeout: 15000 })
      const at = `${dir}/${theme} 9 ${name}`
      const order = await tileAttr(page, 'data-health-tile')
      check(`${at}: ten tiles, S9 and S10 last`, order.length === 10 && order[8] === 'batchBookVsSap' && order[9] === 'negativeStock', order.join(','))
      const tones = (await tileAttr(page, 'data-tone')).slice(8)
      const want = { green: 'good,good', amber: 'watch,watch', red: 'bad,bad', noAnswer: 'noAnswer,noAnswer' }[name]
      check(`${at}: tones`, tones.join(',') === want, tones.join(','))
      check(`${at}: the other eight unchanged (good, or neutral where figure-only)`, (await tileAttr(page, 'data-tone')).slice(0, 8).join(',') === 'good,good,good,good,good,neutral,neutral,good')
      const header = await page.locator('[data-health-header]').getAttribute('data-health-header')
      const text = (await page.locator('[data-health-header]').innerText()).replace(/[\u2066-\u2069]/g, '')
      check(`${at}: header`, name === 'green' ? header === 'allGood' : /2 need attention/.test(text), `${header} ${text}`)
      const s9t = page.locator('[data-health-tile="batchBookVsSap"]')
      const s10t = page.locator('[data-health-tile="negativeStock"]')
      check(`${at}: S9 has no link, S10 is a link`, (await s9t.evaluate((e) => e.tagName)) === 'DIV' && (await s10t.evaluate((e) => e.tagName)) === 'A')
      check(`${at}: S10 opens the refusals leaf`, (await s10t.getAttribute('href')) === '/oms/held-stock-report/refusals')
      if (name === 'noAnswer') {
        check(`${at}: S9 says did not answer`, (await s9t.locator('[data-health-verdict]').innerText()).trim() === 'Did not answer')
        check(`${at}: S10 is outlined`, (await s10t.evaluate((e) => getComputedStyle(e).borderTopWidth)) === '2px')
        check(`${at}: the reason names the door and the 404`, /Stock\/BatchBook\/Negatives.*404/.test(await s10t.locator('[data-health-reason]').innerText()))
      } else {
        const f9 = await s9t.locator('[data-health-figure]').evaluateAll((els) => els.map((e) => e.getAttribute('data-health-figure')))
        const f10 = await s10t.locator('[data-health-figure]').evaluateAll((els) => els.map((e) => e.getAttribute('data-health-figure')))
        check(`${at}: S9's five figures in order`, f9.join('|') === S9_LABELS.join('|'), f9.join('|'))
        check(`${at}: S10's five figures in order`, f10.join('|') === S10_LABELS.join('|'), f10.join('|'))
      }
      if (name === 'red') check(`${at}: S9 says the nightly comparison is off`, /nightly comparison with SAP is off/.test(await s9t.locator('[data-health-reason]').innerText()))
      await page.screenshot({ path: `${SHOTS}/${dir}-${theme}-s9-s10-${name}.png`, fullPage: true })
      check(`${at}: no page errors`, errors.length === 0, errors.join(' | '))
      await context.close()
    }
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
