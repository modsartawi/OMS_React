// Insurance rules ▸ Metrics drive (BackOffice spec 3126, door 3141; oms ticket 615).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section 615):
//   GET InsuranceRules/Metrics?by=rule|store|pharmacist|day&from&to → METRICS[by]
//   GET InsuranceRules/Flags                                      → FLAGS
//   GET InsuranceRules/Settings/Flags                             → FLAG_SETTINGS
//   PUT InsuranceRules/Settings/Flags                             → the thresholds edited (review 3126 P5)
//   GET InsuranceRules/Rejections?payer&from&to                   → REJECTIONS (filtered by payer)
// 🚩 NOTHING here is driven against a live SIS.Api: 3141 is unbuilt. Ticket 618 swaps in the live doors.
//
// It verifies, in LTR and RTL:
//   1. the Metrics leaf is in the rail; /insurance-rules/metrics opens on Metrics per Rule over the last 30 local days;
//   2. the tiles: fires, shadow fires, the override rate weighed by override fires, SAR protected labelled "estimate",
//      rejections after a pass; every figure an ltr isolate;
//   3. per rule: most fires first, the id a link to the rule, the fires bar by severity, outcome mix, rate, SAR, time;
//   4. per store and per day: the address and the door follow; days in calendar order, the SVG chart's first day at
//      the reading start (right under RTL), pointing at a day reads its fires;
//   5. a reversed window is refused before any read;
//   6. Flags: each flag with its reason in numbers, and the thresholds;
//   7. Rejections: ranked by SAR, codes ltr / the payer's words a <bdi>, the live-guard mark, the totals with the SAR
//      no live guard covers; picking a payer lands in the address and the door;
//   8. a bare 403 on each read is "You do not have access";
//   9. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5136 --strictPort
//   2. node tools/insurance-metrics-drive.mjs        (DRIVE_PORT overrides 5136)
import { createRequire } from 'node:module'
import { envelope, insuranceMetricsStub, insuranceRulesStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5136}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const writes = []
  const stubOpts = { deny, writes }
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const asked = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    stubOpts.asked = asked
    stubOpts.body = req.method() === 'PUT' ? JSON.parse(req.postData() || 'null') : null
    // 618: HQ's metrics name a rule by id only; the screen reads names from the guard draft.
    const hit = insuranceMetricsStub(req.method(), p, url.searchParams, stubOpts) ?? insuranceRulesStub(req.method(), p, null)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, asked, writes }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|metrics):|\b(tabs|tiles|columns|reason|rejections|flags|window|outcome|chart)\.\w/.test(await page.locator('main').innerText())
const rowKeys = (page) => page.locator('[data-metrics-table] tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-row')))
const lastAsk = (asked, door) => [...asked].reverse().find((a) => a.door === door)?.params
const settle = (page) => page.waitForTimeout(400)

/** Today and today − 29, local in Riyadh (the browser's zone). */
async function defaultWindow(page) {
  return page.evaluate(() => {
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const now = new Date()
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 12)), to: iso(now) }
  })
}

for (const dir of ['ltr', 'rtl']) {
  // ── 1–5: Metrics ─────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, asked } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/metrics`)
    await page.locator('[data-metrics-table] tbody tr').first().waitFor({ timeout: 30000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has the Metrics leaf`, (await page.locator('a[href="/insurance-rules/metrics"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'Metrics')
    check(`${dir} 1. Metrics tab and Rule are picked`, (await page.locator('[data-tab="metrics"]').getAttribute('aria-selected')) === 'true' && (await page.locator('[data-by="rule"]').getAttribute('aria-pressed')) === 'true')
    const win = await defaultWindow(page)
    check(`${dir} 1. the door is asked per rule over the last 30 local days`, JSON.stringify(lastAsk(asked, 'metrics')) === JSON.stringify({ by: 'rule', ...win, daily: 'false' }), JSON.stringify(lastAsk(asked, 'metrics')))
    check(`${dir} 1. the window inputs show it`, (await page.locator('[data-window-from]').inputValue()) === win.from && (await page.locator('[data-window-to]').inputValue()) === win.to)

    // 2. tiles
    const tile = async (k) => strip(await page.locator(`[data-tile="${k}"] [data-figure]`).innerText())
    const tiles = [await tile('fires'), await tile('shadowFires'), await tile('overrideRate'), await tile('sarProtected'), await tile('rejectionsAfterPass')]
    check(`${dir} 2. tiles: 100 fires, 240 shadow, 86% overridden, 4375.50 SAR, 3 rejections`, JSON.stringify(tiles) === JSON.stringify(['100', '240', '86%', '4375.50', '3']), JSON.stringify(tiles))
    check(`${dir} 2. SAR protected is labelled an estimate`, strip(await page.locator('[data-tile="sarProtected"] [data-estimate]').innerText()) === 'estimate')
    check(`${dir} 2. every tile figure is an ltr isolate`, (await page.locator('[data-tile] [data-figure] bdi[dir="ltr"]').count()) === 5)

    // 3. per rule
    check(`${dir} 3. most fires first`, JSON.stringify(await rowKeys(page)) === JSON.stringify(['G-002', 'G-007', 'G-010', 'G-001', 'G-003']), JSON.stringify(await rowKeys(page)))
    const g7 = page.locator('[data-row="G-007"]')
    check(`${dir} 3. the rule id is an ltr isolate linking to the rule, with its name`, (await g7.locator('a[data-rule-link] bdi[dir="ltr"]').innerText()) === 'G-007' && (await g7.locator('a[data-rule-link]').getAttribute('href')) === '/insurance-rules/guards/G-007' && strip(await g7.locator('[data-rule-name]').innerText()) === 'GLP-1 without a diabetes diagnosis')
    const segs = await page.locator('[data-row="G-002"] [data-fires-bar] [data-segment]').evaluateAll((els) => els.map((e) => e.getAttribute('data-segment')))
    check(`${dir} 3. the fires bar: G-002 all override, full length`, JSON.stringify(segs) === JSON.stringify(['override']) && (await page.locator('[data-row="G-002"] [data-fires-bar] > span').getAttribute('style')).includes('100%'))
    check(`${dir} 3. G-010's bar is 45% of the busiest`, (await page.locator('[data-row="G-010"] [data-fires-bar] > span').getAttribute('style')).includes('45%'))
    const mix = await page.locator('[data-row="G-002"] [data-outcome-bar] [data-segment]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-segment')}=${e.getAttribute('data-count')}`))
    check(`${dir} 3. G-002 outcome mix`, JSON.stringify(mix) === JSON.stringify(['overridden=36', 'unanswered=4']), JSON.stringify(mix))
    check(`${dir} 3. the mix's tooltip names each share`, strip((await page.locator('[data-row="G-002"] [data-outcome-bar]').getAttribute('title')) ?? '') === 'Overridden: 36 (90%); Unanswered: 4 (10%)', (await page.locator('[data-row="G-002"] [data-outcome-bar]').getAttribute('title')) ?? '')
    const cells = async (k) => Promise.all(['overrideRate', 'sarProtected', 'rejectionsAfterPass', 'timeAdded'].map(async (c) => strip(await page.locator(`[data-row="${k}"] [data-col="${c}"]`).innerText())))
    check(`${dir} 3. G-002: 90%, 845.50, 1, 12.4 s`, JSON.stringify(await cells('G-002')) === JSON.stringify(['90%', '845.50', '1', '12.4 s']), JSON.stringify(await cells('G-002')))
    check(`${dir} 3. G-007: no time measured is a dash`, JSON.stringify(await cells('G-007')) === JSON.stringify(['80%', '2210.00', '2', '—']), JSON.stringify(await cells('G-007')))
    check(`${dir} 3. the SAR column says estimate`, strip(await page.locator('[data-metrics-table] th').nth(5).innerText()) === 'SAR protected (estimate)')
    check(`${dir} 3. no raw keys`, await noRawKeys(page))

    // 4. per store, per day
    await page.locator('[data-by="store"]').click()
    await page.waitForFunction(() => document.querySelector('[data-metrics-table]')?.getAttribute('data-metrics-table') === 'store', null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 4. per store: the address and the door follow`, new URL(page.url()).searchParams.get('by') === 'store' && lastAsk(asked, 'metrics')?.by === 'store')
    check(`${dir} 4. per store: most fires first, codes ltr`, JSON.stringify(await rowKeys(page)) === JSON.stringify(['P001', 'P019']) && (await page.locator('[data-row="P001"] [data-col="key"] bdi[dir="ltr"]').innerText()) === 'P001')
    await page.locator('[data-by="day"]').click()
    await page.locator('[data-day-chart]').waitFor({ timeout: 10000 }).catch(() => {})
    await page.locator('[data-row="2026-10-24"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 4. per day: calendar order`, JSON.stringify(await rowKeys(page)) === JSON.stringify(['2026-10-24', '2026-10-25', '2026-10-26']), JSON.stringify(await rowKeys(page)))
    const xs = await page.locator('[data-chart-day]').evaluateAll((els) => els.map((g) => Number(g.querySelector('[data-chart-bar]').getAttribute('x'))))
    check(`${dir} 4. the chart's first day sits at the reading start`, dir === 'ltr' ? xs[0] < xs[2] : xs[0] > xs[2], JSON.stringify(xs))
    const stack = await page.locator('[data-chart-day="2026-10-24"] [data-chart-bar]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chart-bar')))
    check(`${dir} 4. a day stacks refuse, override, warn`, JSON.stringify(stack) === JSON.stringify(['refuse', 'override', 'warn']))
    await page.locator('[data-chart-day="2026-10-24"] rect').first().hover({ force: true })
    check(`${dir} 4. pointing at a day reads its fires`, strip(await page.locator('[data-chart-readout]').innerText()) === '2026-10-24: 5 refused, 12 overridable, 6 warned', strip(await page.locator('[data-chart-readout]').innerText()))
    check(`${dir} 4. the readout's values are ltr isolates`, (await page.locator('[data-chart-readout] bdi[dir="ltr"]').count()) === 4)

    // 5. a reversed window
    const reads = asked.filter((a) => a.door === 'metrics').length
    await page.locator('[data-window-from]').fill('2026-12-01')
    await settle(page)
    check(`${dir} 5. a reversed window is refused, never read`, (await page.locator('[data-window-problem="reversed"]').count()) === 1 && asked.filter((a) => a.door === 'metrics').length === reads && new URL(page.url()).searchParams.get('from') === '2026-12-01')
    await page.locator('[data-window-from]').fill('2026-10-01')
    await page.locator('[data-metrics-table]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5. a fixed window reads again`, lastAsk(asked, 'metrics')?.from === '2026-10-01' && (await page.locator('[data-window-problem]').count()) === 0)
    check(`${dir} 9. no page errors (metrics)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: Flags ─────────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/metrics?tab=flags`)
    await page.locator('[data-flags-table] tbody tr').first().waitFor({ timeout: 30000 })
    const flagRows = await page.locator('[data-flags-table] tbody tr').evaluateAll((els) => els.map((e) => e.getAttribute('data-flag-row')))
    check(`${dir} 6. every current flag`, JSON.stringify(flagRows) === JSON.stringify(['G-002:noisy', 'G-003:jump', 'G-004:silent']), JSON.stringify(flagRows))
    const reasons = (await page.locator('[data-flags-table] [data-reason]').allInnerTexts()).map(strip)
    check(
      `${dir} 6. each with its reason in numbers`,
      JSON.stringify(reasons) === JSON.stringify(['36 of 40 fires overridden (90%)', '240 fires against a previous average of 16 (×15)', 'It has never fired']),
      JSON.stringify(reasons),
    )
    check(`${dir} 6. reason numbers are ltr isolates`, (await page.locator('[data-flag-row="G-002:noisy"] [data-reason] bdi[dir="ltr"]').count()) === 3)
    check(`${dir} 6. the flag pill with since`, (await page.locator('[data-flag-row="G-003:jump"] [data-flag="jump"]').getAttribute('data-since')) === '2026-10-25' && strip(await page.locator('[data-flag-row="G-003:jump"] [data-col="since"]').innerText()) === '2026-10-25')
    check(
      `${dir} 6. the thresholds, and a flag never pauses`,
      strip(await page.locator('[data-flag-thresholds]').innerText()) ===
        'A rule is noisy when more than 80% of at least 30 fires in 30 days were overridden, silent after 60 days with no fire, and jumps when it fires 10 times its previous average. A flag never pauses a rule.',
    )
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    check(`${dir} 9. no page errors (flags)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6b: the thresholds are edited (review 3126 P5, PUT …/Settings/Flags) ─────────────────────────
  {
    const { context, page, errors, writes } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/metrics?tab=flags`)
    await page.locator('[data-flag-settings-edit]').waitFor({ timeout: 30000 })
    await page.locator('[data-flag-settings-edit]').click()
    const form = page.locator('[data-flag-settings-form]')
    check(`${dir} 6b. the form reads the current thresholds, the rate as a percent`, (await form.locator('[data-input="noisyPct"]').inputValue()) === '80' && (await form.locator('[data-input="silentDays"]').inputValue()) === '60')
    // 618: HQ takes whole numbers from 1 (3141): a jump of 1.5 is refused, 1 is allowed.
    await form.locator('[data-input="jumpFactor"]').fill('1.5')
    check(`${dir} 6b. a jump that is not a whole number is refused, Save off`, (await form.locator('[data-flag-settings-problems="jumpFactor"]').count()) === 1 && (await form.locator('[data-flag-settings-save]').isDisabled()))
    await form.locator('[data-input="jumpFactor"]').fill('8')
    await form.locator('[data-input="noisyPct"]').fill('75')
    await form.locator('[data-flag-settings-save]').click()
    await page.locator('[data-flag-settings-form]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    const put = writes.find((w) => w.door === 'saveFlagSettings')
    check(`${dir} 6b. the exact PUT body`, JSON.stringify(put?.body) === JSON.stringify({ noisyOverridePct: 75, noisyMinFires: 30, noisyDays: 30, silentDays: 60, jumpFactor: 8, jumpDays: 30, jumpMinFires: 10 }), JSON.stringify(put))
    check(
      `${dir} 6b. the sentence reads the saved thresholds`,
      strip(await page.locator('[data-flag-thresholds]').innerText()).startsWith('A rule is noisy when more than 75% of at least 30 fires') &&
        strip(await page.locator('[data-flag-thresholds]').innerText()).includes('fires 8 times'),
    )
    check(`${dir} 6b. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: Rejections ────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, asked } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/metrics?tab=rejections`)
    await page.locator('[data-rejections-table] tbody tr').first().waitFor({ timeout: 30000 })
    const ranked = await page.locator('[data-rejections-table] tbody tr').evaluateAll((els) =>
      els.map((e) => `${e.getAttribute('data-rejection-row')}:${e.querySelector('[data-col="code"]').textContent.replace(/[\u2066-\u2069]/g, '')}:${e.getAttribute('data-live-guard')}`),
    )
    check(
      `${dir} 7. ranked by SAR, marking the live guard`,
      JSON.stringify(ranked) === JSON.stringify(['1:CV-4-5:false', '2:الكمية تتجاوز الحد المسموح:true', '3:CV-4-8:true', '4:BE-1-4:false']),
      JSON.stringify(ranked),
    )
    check(`${dir} 7. a code is ltr, the payer's words a plain <bdi>`, (await page.locator('[data-rejection-row="1"] [data-code] bdi[dir="ltr"]').innerText()) === 'CV-4-5' && (await page.locator('[data-rejection-row="2"] bdi[data-words]:not([dir])').count()) === 1)
    check(`${dir} 7. payer, kind, count and SAR are ltr`, JSON.stringify(await Promise.all(['payer', 'sameKind', 'count', 'sar'].map(async (c) => strip(await page.locator(`[data-rejection-row="1"] [data-col="${c}"] bdi[dir="ltr"]`).innerText())))) === JSON.stringify(['TAWUNIYA', 'E1497', '6', '5400.00']))
    check(`${dir} 7. the bar: the top SAR full, the last 12%`, (await page.locator('[data-rejection-row="1"] [data-sar-bar]').getAttribute('data-sar-bar')) === '1.00' && (await page.locator('[data-rejection-row="4"] [data-sar-bar]').getAttribute('data-sar-bar')) === '0.12')
    check(`${dir} 7. the guard mark reads`, strip(await page.locator('[data-rejection-row="1"] [data-col="liveGuard"]').innerText()) === 'No live guard' && strip(await page.locator('[data-rejection-row="3"] [data-col="liveGuard"]').innerText()) === 'Live guard')
    check(`${dir} 7. the totals name the SAR no live guard covers`, strip(await page.locator('[data-rejection-totals]').innerText()) === '32 rejections worth 10560.50 SAR; 6040.00 SAR of it on 2 rows with no live guard.', strip(await page.locator('[data-rejection-totals]').innerText()))
    const opts = (await page.locator('[data-payer] option').allInnerTexts()).map(strip)
    check(`${dir} 7. the payers to pick`, JSON.stringify(opts) === JSON.stringify(['Every payer', 'BUPA', 'MEDGULF', 'TAWUNIYA']), JSON.stringify(opts))
    await page.locator('[data-payer]').selectOption('BUPA')
    await page.waitForFunction(() => document.querySelectorAll('[data-rejections-table] tbody tr').length === 2, null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 7. a payer lands in the address and the door`, new URL(page.url()).searchParams.get('payer') === 'BUPA' && lastAsk(asked, 'rejections')?.payer === 'BUPA')
    check(`${dir} 7. only its rows, the choice kept`, (await page.locator('[data-rejections-table] tbody tr').count()) === 2 && (await page.locator('[data-payer] option').count()) === 4)
    check(`${dir} 7. no raw keys`, await noRawKeys(page))
    check(`${dir} 9. no page errors (rejections)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: a bare 403 on each read ───────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, { deny: ['metrics', 'flags', 'flagSettings', 'rejections'] })
    for (const [tab, hook] of [['metrics', 'metrics-denied'], ['flags', 'flags-denied'], ['rejections', 'rejections-denied']]) {
      await page.goto(`${BASE}/insurance-rules/metrics?tab=${tab}`)
      await page.locator(`[data-${hook}]`).waitFor({ timeout: 20000 }).catch(() => {})
      check(`${dir} 8. a bare 403 on ${tab} → "You do not have access"`, (await page.locator(`[data-${hook}]`).count()) === 1 && strip(await page.locator(`[data-${hook}]`).innerText()).startsWith('You do not have access') && (await page.locator('table').count()) === 0)
    }
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
