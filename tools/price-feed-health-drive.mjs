// Ticket 939 drive — the Feed health tab of the price command center (BackOffice spec 4127, decision 8). Drives the REAL
// app in Chromium against STUBBED `PriceWatch/*` envelopes.
//
// Stub contract:
//   - `GET PriceWatch/FeedHealth` base shape is SHIPPED (BackOffice `pricing2`, `PriceWatchFeedHealthService.cs`, read
//     2026-11-21).
//   - ⚠ GUESSED (BO 4131, not shipped): `crossCheckMarginPercent`, `effectivePriceJob`, and per competitor
//     `authoritativeSource`, `runsBySource[{ source, lastRun{…, errorMessage, isQuotaOrAuthError} }]`,
//     `crossCheck{ disagreements, examples[] }`.
//   - ⚠ GUESSED (BO 4128, not shipped): `PUT PriceWatch/Competitors/{competitor}/AuthoritativeSource` `{ source }` →
//     the competitor setting.
//   Source: the 4127 contract notes (scratchpad `4127/contracts.md`), from the BO ticket text. Still owed: the dev walk.
//
//   1. a manager: `?tab=feed-health` opens the tab; one run row per source per competitor; the quota refusal, the run
//      still going and the source that never ran read as such; the effective-price job shows its watched count.
//   2. the block shows with its reason, and nothing offers to clear it.
//   3. the cross-check flag lists its materials, each a link to the drill-down address.
//   4. the authority change: picking Mindsite opens the confirmation naming what changes; No sends nothing; Yes sends
//      `{ source: 'MINDSITE' }` to the competitor's door and reads feed health again.
//   5. a viewer (PriceWatch:03 only): feed health shows, no authority setting.
//   6. a server before BO 4131 (shipped shape only): renders the one latest run, no cross-check, no setting.
//   7. RTL (oms.locale = ar): renders, no raw keys. No page errors anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/price-feed-health-drive.mjs
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROOT = BASE + '/analytics/price-command-center?tab=feed-health'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')

const run = (over) => ({
  scrapeRunId: 'R-1', passKind: 'DAILY', passSlotAt: '2026-11-21T03:00:00', startedAt: '2026-11-21T03:00:05',
  finishedAt: '2026-11-21T03:20:00', listingsRead: 480, pricesWritten: 471, failures: 9, listingsGone: 2,
  isBlocked: false, blockReason: '', ...over,
})
const sourceRun = (over) => ({ ...run(over), errorMessage: '', isQuotaOrAuthError: false, ...over })
const competitor = (over) => ({
  competitorCode: 'PANDA', name: 'Panda', kind: 'pharmacy', isEnabled: true, isBlocked: false, blockedAt: null,
  blockReason: '', blockClearedAt: null, blockClearedBy: '', matchedListings: 500, staleListings: 12, goneListings: 3,
  lastRun: run({}), ...over,
})

// SHIPPED shape only — a server before BO 4131.
const SHIPPED = {
  at: '2026-11-21T09:00:00',
  staleAfterHours: 36,
  competitors: [
    competitor({ competitorCode: 'NAHDI', name: 'Nahdi', lastRun: run({ scrapeRunId: 'R-OLD' }) }),
    competitor({ competitorCode: 'AMAZON_SA', name: 'Amazon SA', kind: 'marketplace', isBlocked: true, blockedAt: '2026-11-20T22:00:00', blockReason: 'Captcha wall on listing pages' }),
  ],
}
// GUESSED (BO 4131) fields on top.
const GUESSED = {
  ...SHIPPED,
  crossCheckMarginPercent: 10,
  effectivePriceJob: {
    runId: 'J-1', runDay: '2026-11-21', referenceStore: '1001', startedAt: '2026-11-21T01:00:00', finishedAt: '2026-11-21T01:04:10',
    isFinished: true, materials: 1250, priced: 1238, unpriced: 12, failures: 0, durationSeconds: 250, hasError: false, errorMessage: '',
  },
  competitors: [
    competitor({
      competitorCode: 'NAHDI', name: 'Nahdi', authoritativeSource: 'SCRAPER',
      runsBySource: [{ source: 'SCRAPER', lastRun: sourceRun({ scrapeRunId: 'R-N', finishedAt: null }) }],
    }),
    competitor({
      competitorCode: 'PANDA', name: 'Panda', authoritativeSource: 'SCRAPER',
      runsBySource: [
        { source: 'SCRAPER', lastRun: sourceRun({ scrapeRunId: 'R-S' }) },
        { source: 'MINDSITE', lastRun: sourceRun({ scrapeRunId: 'R-M', listingsRead: 0, pricesWritten: 0, failures: 1, errorMessage: 'HTTP 429 quota exceeded', isQuotaOrAuthError: true }) },
      ],
      crossCheck: {
        disagreements: 3,
        examples: [
          { materialNumber: '100012345', day: '2026-11-20', scraperPaidPrice: 19.95, mindsitePaidPrice: 24.5, differencePercent: 22.8 },
          { materialNumber: '100067890', day: '2026-11-20', scraperPaidPrice: 10, mindsitePaidPrice: 11.5, differencePercent: 15 },
        ],
      },
    }),
    competitor({
      competitorCode: 'AMAZON_SA', name: 'Amazon SA', kind: 'marketplace', authoritativeSource: 'SCRAPER',
      isBlocked: true, blockedAt: '2026-11-20T22:00:00', blockReason: 'Captcha wall on listing pages',
      runsBySource: [{ source: 'SCRAPER', lastRun: sourceRun({ isBlocked: true, blockReason: 'Captcha wall on listing pages' }) }],
      crossCheck: { disagreements: 0, examples: [] },
    }),
  ],
}

const browser = await chromium.launch()

async function open(keys, { dir = 'ltr', health = GUESSED } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120000) // a cold or busy dev server can take a while to serve the first load
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.split('/api/')[1]
    calls.push({ path, method: req.method(), body: req.postData() })
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
    if (path === 'PriceWatch/FeedHealth') return route.fulfill(envelope(health))
    if (path === 'PriceWatch/Matching/Coverage') return route.fulfill(envelope([]))
    if (/^PriceWatch\/Alerts/.test(path)) return route.fulfill(envelope([]))
    const m = path.match(/^PriceWatch\/Competitors\/([^/]+)\/AuthoritativeSource$/)
    if (m && req.method() === 'PUT') {
      const body = JSON.parse(req.postData() || '{}')
      return route.fulfill(envelope({ competitorCode: m[1], name: 'Panda', kind: 'pharmacy', isEnabled: true, authoritativeSource: body.source, authoritativeSourceChangedBy: 'msartawi', authoritativeSourceChangedAt: '2026-11-21T10:00:00' }))
    }
    return route.fulfill(envelope({}))
  })
  return { page, context, errors, calls }
}

const rawKey = (text) => text.match(/\b(?:price-command-center:)?(?:feedHealth|alerts|tabs|access)\.[a-zA-Z.-]+\b/)

try {
  // ── 1–4: a manager ──
  {
    const { page, context, errors, calls } = await open(['PriceWatch:03', 'PriceWatch:06'])
    await page.goto(ROOT)
    await page.waitForSelector('[data-feed-run]')
    check('1. the Feed health tab is open', (await page.locator('[data-tab-panel]').getAttribute('data-tab-panel')) === 'feed-health')
    check('1. the strip offers Feed health', (await page.locator('[role="tablist"] [data-tab="feed-health"]').count()) === 1)
    const rows = await page.locator('[data-feed-run]').evaluateAll((els) => els.map((e) => e.getAttribute('data-feed-run')))
    check('1. one run row per source per competitor', JSON.stringify(rows) === JSON.stringify(['NAHDI:SCRAPER', 'NAHDI:MINDSITE', 'PANDA:SCRAPER', 'PANDA:MINDSITE', 'AMAZON_SA:SCRAPER', 'AMAZON_SA:MINDSITE']), JSON.stringify(rows))
    const quota = strip(await page.locator('[data-feed-run="PANDA:MINDSITE"]').innerText())
    check('1. a quota refusal reads as such, with its error', quota.includes('Quota or auth refused') && quota.includes('HTTP 429 quota exceeded'), quota)
    check('1. a run still going reads Running', (await page.locator('[data-feed-run="NAHDI:SCRAPER"] [data-run-state="running"]').count()) === 1)
    check('1. a source that never ran reads Never ran', (await page.locator('[data-feed-run="NAHDI:MINDSITE"] [data-run-state="never"]').count()) === 1)
    const scraper = strip(await page.locator('[data-feed-run="PANDA:SCRAPER"]').innerText())
    check('1. counts and failures on the run row', scraper.includes('480') && scraper.includes('471') && scraper.includes('9'), scraper)
    const job = strip(await page.locator('[data-effective-price-job="J-1"]').innerText())
    check('1. the effective-price job shows its watched count', job.includes('1,250') && job.includes('Watched'), job)

    // 2. block
    const block = strip(await page.locator('[data-feed-competitor="AMAZON_SA"]').innerText())
    check('2. the block shows with its reason', block.includes('Blocked since') && block.includes('Captcha wall on listing pages'), block)
    check('2. nothing offers to clear the block', (await page.locator('[data-feed-competitor="AMAZON_SA"] button').count()) === 0 && !/clear block|unblock/i.test(block))

    // 3. cross-check
    const flag = strip(await page.locator('[data-cross-check="PANDA"]').innerText())
    check('3. the cross-check flag names its count and margin', flag.includes('3 disagreements above 10.0 %'), flag)
    const href = await page.locator('[data-cross-check-material="100012345"]').getAttribute('href')
    check('3. each material links to the drill-down', href === '/analytics/price-command-center?material=100012345', String(href))
    check('3. both example materials listed', (await page.locator('[data-cross-check-material]').count()) === 2)
    check('3. the agreeing competitor says so', strip(await page.locator('[data-cross-check="AMAZON_SA"]').innerText()).includes('agree'))

    // 4. authority change — No, then Yes
    await page.locator('[data-authority-change="PANDA"]').selectOption('MINDSITE')
    const dlg = page.locator('dialog[open]')
    await dlg.waitFor()
    const msg = strip(await dlg.innerText())
    check('4. the confirmation names what changes', msg.includes('Mindsite’s prices will count for Panda; our scraper’s will not.'), msg)
    await dlg.getByRole('button', { name: 'No' }).click()
    await page.waitForTimeout(300)
    check('4. No sends nothing', !calls.some((c) => c.method === 'PUT'))
    check('4. …and the setting stays on what counts', (await page.locator('[data-authority-change="PANDA"]').inputValue()) === 'SCRAPER')
    const reads = calls.filter((c) => c.path === 'PriceWatch/FeedHealth').length
    await page.locator('[data-authority-change="PANDA"]').selectOption('MINDSITE')
    await page.locator('dialog[open]').getByRole('button', { name: 'Yes' }).click()
    // The toast's values are fsi-isolated, so match it with the isolates stripped.
    await page.waitForFunction(() =>
      document.body.innerText.replace(/[⁦-⁩]/g, '').includes('The authoritative price source for Panda is now Mindsite.'),
    )
    check('4. the change is confirmed in a toast', true)
    const put = calls.find((c) => c.method === 'PUT')
    check('4. Yes sends { source: MINDSITE } to the competitor’s door', put?.path === 'PriceWatch/Competitors/PANDA/AuthoritativeSource' && put.body === JSON.stringify({ source: 'MINDSITE' }), `${put?.path} ${put?.body}`)
    await page.waitForTimeout(300)
    check('4. feed health is read again', calls.filter((c) => c.path === 'PriceWatch/FeedHealth').length > reads)

    const all = strip(await page.locator('body').innerText())
    check('1–4. no raw i18n keys', !rawKey(all), String(rawKey(all)))
    check('1–4. no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/feed-health.png', fullPage: true }).catch(() => {})
    await context.close()
  }

  // ── 5: a viewer ──
  {
    const { page, context, errors } = await open(['PriceWatch:03'])
    await page.goto(ROOT)
    await page.waitForSelector('[data-feed-run]')
    check('5. a viewer sees feed health', (await page.locator('[data-feed-run]').count()) === 6)
    check('5. …with no authority setting', (await page.locator('[data-authority-change]').count()) === 0)
    check('5. …the authoritative source still named', (await page.locator('[data-feed-authority="SCRAPER"]').count()) === 3)
    check('5. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: a server before BO 4131 ──
  {
    const { page, context, errors } = await open(['PriceWatch:03', 'PriceWatch:06'], { health: SHIPPED })
    await page.goto(ROOT)
    await page.waitForSelector('[data-feed-run]')
    const rows = await page.locator('[data-feed-run]').evaluateAll((els) => els.map((e) => e.getAttribute('data-feed-run')))
    check('6. one latest run per competitor, source unreported', JSON.stringify(rows) === JSON.stringify(['NAHDI:any', 'AMAZON_SA:any']), JSON.stringify(rows))
    check('6. no cross-check, no setting, no job', (await page.locator('[data-cross-check], [data-authority-change], [data-effective-price-job]').count()) === 0)
    check('6. the block still shows', strip(await page.locator('body').innerText()).includes('Captcha wall on listing pages'))
    check('6. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: RTL ──
  {
    const { page, context, errors } = await open(['PriceWatch:03', 'PriceWatch:06'], { dir: 'rtl' })
    await page.goto(ROOT)
    await page.waitForSelector('[data-feed-run]')
    const text = strip(await page.locator('body').innerText())
    check('7. RTL renders the runs', (await page.locator('[data-feed-run]').count()) === 6)
    check('7. RTL: no raw i18n keys', !rawKey(text), String(rawKey(text)))
    check('7. RTL: no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/feed-health-rtl.png', fullPage: true }).catch(() => {})
    await context.close()
  }
} catch (e) {
  check('drive ran to the end', false, String(e))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
