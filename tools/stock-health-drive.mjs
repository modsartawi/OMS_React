// Stock health drive (oms 908; BackOffice spec 3991, door 3992, grant 3994).
//
// Drives the REAL app in Chromium against a STUB of the doors, in the shapes 3992 shipped (the brief's "Changes" lines,
// `C:\Work\DMSCO\BackOffice\.issues\assets\3991-oms-react-stock-health-brief.md`), camelCase:
//   GET StockHealth/Access → { screenAllowed }
//   GET StockHealth        → { readAt, signals[] }   (S1..S7; S8 drsQueue only once 3993 ships)
// In LTR and RTL, light and dark, it asserts:
//   1. without the grant: no leaf, the URL shows the denied card, no StockHealth call;
//   2. with it: the leaf sits right after Store stages; the tiles come in the server's order, one per signal;
//   3. each tile's tone follows its verdict (noAnswer is did-not-answer, red-outlined, never neutral; null is neutral);
//      the header counts the judged signals that are not good; "as of" is the server's wall-clock, unshifted;
//   4. a tile shows at most four figures; a tile with a link is a link, one without is not;
//   5. the Refresh button re-reads, and so does the 60-second timer;
//   6. with S8 present and every judged signal good: eight tiles and "All good";
//   7. a tile opens its link;
//   8. no page errors.
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

// ── Fixtures, 3992's shapes ─────────────────────────────────────────────────────────────────────
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
  sig('takeDoor', 'good', 'No take failed at the door today.', [
    { label: 'Takes today', value: 120 },
    { label: 'Failed', value: 0 },
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
  sig('drsQueue', 'good', 'The DRS queue is draining.', [{ label: 'Waiting', value: 0 }]),
]

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
    check(`${dir}/${theme} 4 at most four figures`, (await page.locator('[data-health-tile="storeStages"] [data-health-figure]').count()) === 4)
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
    check(`${dir} 6 header reads All good`, /All good/.test(await page.locator('[data-health-header]').innerText()))
    await page.screenshot({ path: `${SHOTS}/${dir}-all-good.png`, fullPage: true })
    check(`${dir} 6 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
