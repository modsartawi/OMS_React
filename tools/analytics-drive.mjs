// Analytics drive (spec 766 Testing Decisions, web seam 2) — ONE drive for the whole analytics area.
//
// Drives the REAL app in Chromium against STUBBED analytics doors (`./analytics-stubs.mjs`): the wire is
// spec 766 §C, proposed and owned by BackOffice 3378, and no live SIS.Api serves it yet.
//
// Each ticket adds its scenarios as named async functions in SCENARIOS below; `DRIVE_ONLY=767,768` runs
// just those tickets' scenarios. A scenario opens its own page with `open({ dir, dark, ...stubOptions })`
// and reports with `check(name, pass, detail)`; screenshots go under SHOTS.
//
// 767 — the view page draws its bar, behind the probe:
//   1. the probe absent (a bare 404), or `canView: false`: the Analytics group is not in the nav, a typed
//      `/analytics/view/:id` shows the denied card, and no Item/Query call is made;
//   2. allowed, en light: the group and its leaf show; the view asks `Analytics/Query` for `{ viewId, revision }`,
//      shows the loading frame (`aria-busy`) while the answer is held, then draws five bars in the
//      CHANNEL's fixed slot (not the rank), the generated title from the model labels, "data as of 09:45";
//   3. ar: the page is RTL but the chart box is LTR, the category axis is reversed and the value axis is on
//      the right; the figures read left to right;
//   4. dark: each bar paints the DARK `--chart-N` token;
//   5. `ANALYTICS-404` on the item is the not-found state; `ANALYTICS-401` on the query the no-access state;
//   6. no page errors.
//
// 769 — the donut, the table with cell bars, the heatmap and the combo, each in en, ar and dark:
//   donut: nine stores → five slices in --chart-1…5 plus ink-grey "Other (4)", painted per theme; a donut
//          over a rate is refused in words; table: top 5 by orders, cell bars in proportion, figures
//          isolated, the grid RTL under ar; heatmap: min at the hue's floor, max full, the gap unpainted,
//          the first weekday at the reading start, a tooltip per cell, the table view; combo: two panes,
//          one y-axis each, each bar exactly over its line point (one shared x-axis).
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. DRIVE_PORT=5201 node tools/analytics-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { ITEMS, QUERY, installAnalyticsStubs, refusal } from './analytics-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`
const SHOTS = 'tools/.analytics-shots'
mkdirSync(SHOTS, { recursive: true })
const ONLY = (process.env.DRIVE_ONLY ?? '').split(',').filter(Boolean)

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

/** A fresh page: `dir` 'ltr' | 'rtl' (`oms.locale`), `dark` (`oms.darkMode`), plus the stub options. */
async function open({ dir = 'ltr', dark = false, ...stubs } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(
    ({ dir, dark }) => {
      localStorage.setItem('oms.locale', dir === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.darkMode', String(dark))
      localStorage.setItem('oms.railExpanded', 'true')
    },
    { dir, dark },
  )
  const stub = await installAnalyticsStubs(page, stubs)
  return { context, page, errors, ...stub }
}

const analyticsLinks = (page) =>
  page.locator('nav a[href^="/analytics"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

/** The bars in DOM order, each with its fill attribute and its computed paint. */
const bars = (page) =>
  page.locator('[data-chart="bar"] .recharts-bar-rectangle path').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { fill: el.getAttribute('fill'), paint: getComputedStyle(el).fill, x: r.x + r.width / 2 }
    }),
  )

/** A token's computed colour, resolved the way a painted fill reports it (`rgb(…)`). */
const tokenPaint = (page, token) =>
  page.evaluate((token) => {
    const probe = document.createElement('div')
    probe.style.color = `var(${token})`
    document.body.appendChild(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  }, token)

/** Category tick labels with their on-screen x, in DOM order. */
const xTicks = (page) =>
  page.locator('[data-chart="bar"] .recharts-xAxis-tick-labels text').evaluateAll((els) =>
    els.map((el) => ({ text: el.textContent.trim(), x: el.getBoundingClientRect().x })),
  )

// The answer is ranked aggregator, app, store, web, callcenter; the CATALOGUE order (the fixed slots) is
// app 1, web 2, callcenter 3, aggregator 4, store 5.
const EXPECTED_FILLS = ['var(--chart-4)', 'var(--chart-1)', 'var(--chart-5)', 'var(--chart-2)', 'var(--chart-3)']

// ── 767 ──────────────────────────────────────────────────────────────────────────────────────────────
async function probeHides() {
  for (const access of ['absent', { canView: false, canCurate: true }]) {
    const label = access === 'absent' ? 'probe absent' : 'canView false'
    const { context, page, calls, errors } = await open({ access })
    await page.goto(`${BASE}/analytics/view/v-bar`)
    // A refused probe is the denial sentence; an absent door (404) the unreachable one. Both deny.
    const card = page.locator('[role="alert"]', { hasText: /No access to analytics|Analytics can.t be reached/ })
    await card.waitFor({ timeout: 10000 })
    check(`767 ${label}: a typed view URL shows the denied card`, true, (await card.innerText()).split('\n')[0])
    check(`767 ${label}: no Item or Query is asked`, !calls.some((c) => c.startsWith('Analytics/Item') || c === 'Analytics/Query'), calls.join(' '))
    await page.waitForTimeout(300)
    check(`767 ${label}: the Analytics group is not in the nav`, (await analyticsLinks(page)).length === 0 && !(await page.locator('aside').allInnerTexts()).join(' ').includes('Analytics'))
    // (The breadcrumb names the route from the full menu on every screen, granted or not; the rail is what hides.)
    check(`767 ${label}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

async function drawsBar({ dir, dark }) {
  const label = `${dir}${dark ? '-dark' : ''}`
  const { context, page, calls, bodies, errors } = await open({ dir, dark, queryDelayMs: 900 })
  await page.goto(`${BASE}/analytics/view/v-bar`)

  const frame = page.locator('[data-chart-frame]')
  await frame.waitFor({ timeout: 10000 })
  check(`767 ${label}: the loading frame is busy while the answer is held`, (await frame.getAttribute('aria-busy')) === 'true')
  await page.locator('[data-chart="bar"] .recharts-bar-rectangle path').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(200)
  check(`767 ${label}: the frame settles (aria-busy false)`, (await frame.getAttribute('aria-busy')) === 'false')

  check(`767 ${label}: the leaf shows once canView is true`, (await analyticsLinks(page)).includes('/analytics'))
  const asked = bodies['Analytics/Query']?.at(-1)
  check(`767 ${label}: Query is asked for the saved view by id and revision`, JSON.stringify(asked) === JSON.stringify({ viewId: 'v-bar', revision: ITEMS['v-bar'].revision }), JSON.stringify(asked))
  check(`767 ${label}: Model and Item are read`, calls.includes('Analytics/Model') && calls.includes('Analytics/Item/v-bar'))

  const drawn = await bars(page)
  check(`767 ${label}: five bars`, drawn.length === QUERY['v-bar'].rows.length, String(drawn.length))
  check(`767 ${label}: each bar in its channel's FIXED slot, not its rank`, JSON.stringify(drawn.map((b) => b.fill)) === JSON.stringify(EXPECTED_FILLS), drawn.map((b) => b.fill).join(' '))
  const paints = await Promise.all(EXPECTED_FILLS.map((f) => tokenPaint(page, f.slice(4, -1))))
  check(`767 ${label}: each bar paints its token in this theme`, JSON.stringify(drawn.map((b) => b.paint)) === JSON.stringify(paints), drawn.map((b) => b.paint).join(' '))

  const title = (await page.locator('[data-analytics-view-title]').innerText()).replace(/[⁨⁩]/g, '')
  check(`767 ${label}: the generated title reads from the model labels`, title === 'Orders by Channel', title)
  const asOf = await page.locator('[data-analytics-as-of]').innerText()
  check(`767 ${label}: "data as of" from dataAsOf`, asOf.includes('09:45') && (await page.locator('[data-analytics-as-of] bdi[dir="ltr"]').count()) === 1, asOf)

  const ticks = await xTicks(page)
  check(`767 ${label}: the category axis reads the channel labels`, JSON.stringify(ticks.map((t) => t.text)) === JSON.stringify(['Aggregators', 'App', 'In store', 'Web', 'Call center']), ticks.map((t) => t.text).join(', '))
  const box = page.locator('[data-chart="bar"]')
  check(`767 ${label}: the chart box is LTR`, (await box.getAttribute('dir')) === 'ltr')
  const htmlDir = await page.evaluate(() => document.documentElement.dir || 'ltr')
  const firstLeft = ticks[0].x < ticks.at(-1).x
  const yAxis = await page.locator('[data-chart="bar"] .recharts-yAxis-tick-labels').evaluate((el) => el.getBoundingClientRect().x)
  const boxX = await box.evaluate((el) => { const r = el.getBoundingClientRect(); return r.x + r.width / 2 })
  if (dir === 'rtl') {
    check(`767 ${label}: the page is RTL`, htmlDir === 'rtl')
    check(`767 ${label}: mirrored through props — the first category on the right`, !firstLeft && drawn[0].x > drawn.at(-1).x)
    check(`767 ${label}: the value axis stands on the right`, yAxis > boxX, `${yAxis} > ${boxX}`)
  } else {
    check(`767 ${label}: the first category on the left, the value axis on the left`, firstLeft && yAxis < boxX)
  }
  if (dark) check(`767 ${label}: the page is dark`, await page.evaluate(() => document.documentElement.classList.contains('dark')))

  await page.screenshot({ path: `${SHOTS}/767-view-${label}.png` })
  check(`767 ${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function refusals() {
  {
    const { context, page, errors } = await open({ items: { ...ITEMS, 'v-gone': refusal('ANALYTICS-404', 'Gone.', 404) } })
    await page.goto(`${BASE}/analytics/view/v-gone`)
    const state = page.locator('[data-analytics-state="not-found"]')
    await state.waitFor({ timeout: 10000 })
    check('767 ANALYTICS-404 on the item: the not-found state, in its own words', (await state.innerText()).includes('not found or was deleted'), (await state.innerText()).replace(/\s+/g, ' '))
    check('767 404: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open({ query: { ...QUERY, 'v-bar': refusal('ANALYTICS-401', 'No grant.', 403) } })
    await page.goto(`${BASE}/analytics/view/v-bar`)
    const state = page.locator('[data-analytics-state="no-access"]')
    await state.waitFor({ timeout: 10000 })
    check('767 ANALYTICS-401 on the query: the no-access state', (await state.innerText()).includes("You don't have access to analytics"), (await state.innerText()).replace(/\s+/g, ' '))
    check('767 401: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page } = await open()
    await page.goto(`${BASE}/analytics`)
    await page.locator('[data-analytics-home-empty]').waitFor({ timeout: 10000 })
    check('767 the menu leaf opens the home (empty until 770)', true)
    await context.close()
  }
}

// ── 769 ──────────────────────────────────────────────────────────────────────────────────────────────
// The donut, the table with cell bars, the heatmap and the combo, each in en, ar and dark.

/** Relative luminance of any CSS paint, resolved by letting a canvas draw it. */
const luminance = (page, paint) =>
  page.evaluate((paint) => {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const g = c.getContext('2d')
    g.fillStyle = paint
    g.fillRect(0, 0, 1, 1)
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
    const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin(r) + 0.7152 * lin(gr) + 0.0722 * lin(b)
  }, paint)

async function drawsForms({ dir, dark }) {
  const label = `${dir}${dark ? '-dark' : ''}`
  const rtl = dir === 'rtl'

  // Donut: nine stores → the five largest in the five hues, the other four folded into ink-grey "Other".
  {
    const { context, page, errors } = await open({ dir, dark })
    await page.goto(`${BASE}/analytics/view/v-donut`)
    const sectors = page.locator('[data-chart="donut"] .recharts-pie-sector path')
    await sectors.first().waitFor({ timeout: 10000 })
    const drawn = await sectors.evaluateAll((els) => els.map((el) => ({ fill: el.getAttribute('fill'), paint: getComputedStyle(el).fill })))
    const want = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--ink-3)']
    check(`769 ${label} donut: five slices plus "Other", largest first, Other in ink grey`, JSON.stringify(drawn.map((d) => d.fill)) === JSON.stringify(want), drawn.map((d) => d.fill).join(' '))
    const paints = await Promise.all(want.map((f) => tokenPaint(page, f.slice(4, -1))))
    check(`769 ${label} donut: each slice paints its token in this theme`, JSON.stringify(drawn.map((d) => d.paint)) === JSON.stringify(paints), drawn.map((d) => d.paint).join(' '))
    const legend = (await page.locator('[data-chart-legend="donut"]').innerText()).replace(/[⁨⁩]/g, '')
    check(`769 ${label} donut: the legend names Other (4) and the total 4,500`, legend.includes('Other (4)') && legend.includes('4,500') && legend.includes('P001'), legend.replace(/\s+/g, ' '))
    check(`769 ${label} donut: the ring is in the LTR box`, (await page.locator('[data-chart="donut"]').getAttribute('dir')) === 'ltr')
    await page.screenshot({ path: `${SHOTS}/769-donut-${label}.png` })
    check(`769 ${label} donut: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // Donut over a rate: refused, nothing drawn.
  if (!dark && !rtl) {
    const { context, page, errors } = await open({ dir, dark })
    await page.goto(`${BASE}/analytics/view/v-donut-rate`)
    const refused = page.locator('[data-analytics-refused="donut-shape"]')
    await refused.waitFor({ timeout: 10000 })
    check(`769 ${label} donut over a rate: refused in words, no ring`, (await refused.innerText()).includes('A donut takes one additive measure') && (await page.locator('[data-chart="donut"]').count()) === 0)
    check(`769 ${label} donut refused: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // Table: sorted by orders, largest first, the top 5 kept, bars in proportion, each value isolated.
  {
    const { context, page, errors } = await open({ dir, dark })
    await page.goto(`${BASE}/analytics/view/v-table`)
    const rows = page.locator('[data-chart="table"] .ag-row[row-index]')
    await rows.first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(200)
    const read = await rows.evaluateAll((els) =>
      els
        .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
        .map((r) => ({
          store: r.querySelector('[col-id="store"]')?.textContent?.trim(),
          orders: r.querySelector('[col-id="orders"]')?.textContent?.trim(),
          bar: r.querySelector('[col-id="orders"] [data-cell-bar]')?.getAttribute('data-cell-bar'),
          isolated: !!r.querySelector('[col-id="till_value"] bdi[dir="ltr"]'),
        })),
    )
    // Orders 900, 837, 774, 711, 648 kept of nine: each bar is its share of 900.
    check(`769 ${label} table: the top 5 by orders, largest first`, JSON.stringify(read.map((r) => r.store)) === JSON.stringify(['P001', 'P002', 'P003', 'P004', 'P005']), read.map((r) => r.store).join(' '))
    check(`769 ${label} table: the orders cell bars run in proportion to the column's largest`, JSON.stringify(read.map((r) => r.bar)) === JSON.stringify(['100', '93', '86', '79', '72']), read.map((r) => r.bar).join(' '))
    check(`769 ${label} table: a figure is formatted and isolated in its own cell`, read[0]?.orders === '900' && read.every((r) => r.isolated), read.map((r) => r.orders).join(' '))
    const note = await page.locator('[data-table-top-n]').innerText()
    check(`769 ${label} table: says the top N cut rows`, note.replace(/[⁨⁩]/g, '').includes('top 5 rows'), note)
    if (rtl) check(`769 ${label} table: the grid mirrors (AG Grid RTL)`, (await page.locator('[data-chart="table"] .ag-rtl').count()) > 0)
    await page.screenshot({ path: `${SHOTS}/769-table-${label}.png` })
    check(`769 ${label} table: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // Heatmap: one hue, min faintest, max fullest, an empty cell unpainted, tooltips and the table view.
  {
    const { context, page, errors } = await open({ dir, dark })
    await page.goto(`${BASE}/analytics/view/v-heatmap`)
    const cells = page.locator('[data-chart="heatmap"] [data-heatmap-cell]')
    await cells.first().waitFor({ timeout: 10000 })
    check(`769 ${label} heatmap: 5 weekdays × 4 hours`, (await cells.count()) === 20, String(await cells.count()))
    const fillOf = (k) => page.locator(`[data-heatmap-cell="${k}"]`).getAttribute('data-fill')
    const [minF, maxF, gap] = await Promise.all([fillOf('Sun|08'), fillOf('Thu|20'), fillOf('Wed|16')])
    check(`769 ${label} heatmap: min at the floor of the hue, max the full hue, the gap unpainted`, minF.includes('var(--chart-1) 12%') && maxF.includes('var(--chart-1) 100%') && gap === '', `${minF} | ${maxF} | ${gap}`)
    const bg = (k) => page.locator(`[data-heatmap-cell="${k}"]`).evaluate((el) => getComputedStyle(el).backgroundColor)
    const [minL, maxL, cardL] = await Promise.all([
      bg('Sun|08').then((p) => luminance(page, p)),
      bg('Thu|20').then((p) => luminance(page, p)),
      tokenPaint(page, '--card').then((p) => luminance(page, p)),
    ])
    // Either theme: the faint end sits nearer the card than the full hue; in light, it is the lighter.
    check(`769 ${label} heatmap: the minimum reads nearer the card than the maximum`, Math.abs(minL - cardL) < Math.abs(maxL - cardL) && (dark || minL > maxL), `min ${minL.toFixed(3)} max ${maxL.toFixed(3)} card ${cardL.toFixed(3)}`)
    const heads = await page.locator('[data-chart="heatmap"] [data-heatmap-x]').evaluateAll((els) => els.map((e) => ({ k: e.getAttribute('data-heatmap-x'), x: e.getBoundingClientRect().x })))
    const sun = heads.find((h) => h.k === 'Sun')
    const thu = heads.find((h) => h.k === 'Thu')
    check(`769 ${label} heatmap: the first weekday at the reading start`, rtl ? sun.x > thu.x : sun.x < thu.x, `Sun ${sun.x} Thu ${thu.x}`)
    check(`769 ${label} heatmap: the grid is in the LTR box`, (await page.locator('[data-chart="heatmap"]').getAttribute('dir')) === 'ltr')
    await page.locator('[data-heatmap-cell="Thu|20"]').hover()
    const tip = page.locator('[data-heatmap-tooltip]')
    await tip.waitFor({ timeout: 3000 })
    const tipText = await tip.innerText()
    check(`769 ${label} heatmap: a cell's tooltip names its members and value`, tipText.includes('Thu') && tipText.includes('20') && tipText.includes('200'), tipText.replace(/\s+/g, ' '))
    await page.screenshot({ path: `${SHOTS}/769-heatmap-${label}.png` })
    await page.locator('[data-heatmap-table-toggle]').click()
    const tableRows = await page.locator('[data-heatmap-table] tbody tr').count()
    check(`769 ${label} heatmap: the table view lists every cell`, tableRows === 20, String(tableRows))
    check(`769 ${label} heatmap: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // Combo: two panes on one shared x-axis, bars above, the line below, one y-axis each.
  {
    const { context, page, errors } = await open({ dir, dark })
    await page.goto(`${BASE}/analytics/view/v-combo`)
    const barsSel = page.locator('[data-combo-pane="volume"] .recharts-bar-rectangle path')
    await barsSel.first().waitFor({ timeout: 10000 })
    const centres = (els) => els.map((el) => { const r = el.getBoundingClientRect(); return r.x + r.width / 2 })
    const barX = await barsSel.evaluateAll(centres)
    const dotX = await page.locator('[data-combo-pane="rate"] .recharts-line-dots circle').evaluateAll(centres)
    check(`769 ${label} combo: five bars above, five line points below`, barX.length === 5 && dotX.length === 5, `${barX.length}/${dotX.length}`)
    check(`769 ${label} combo: the panes share the x-axis (each bar over its point)`, barX.length === 5 && barX.every((x, i) => Math.abs(x - dotX[i]) < 2), barX.map((x, i) => (x - dotX[i]).toFixed(1)).join(' '))
    const yAxes = await Promise.all(['volume', 'rate'].map((k) => page.locator(`[data-combo-pane="${k}"] .recharts-yAxis`).count()))
    check(`769 ${label} combo: each pane has its own single y-axis`, yAxes[0] === 1 && yAxes[1] === 1, yAxes.join('/'))
    check(`769 ${label} combo: only the lower pane shows the x labels`, (await page.locator('[data-combo-pane="volume"] .recharts-xAxis-tick-labels text').count()) === 0 && (await page.locator('[data-combo-pane="rate"] .recharts-xAxis-tick-labels text').count()) > 0)
    check(`769 ${label} combo: time reads in order from the reading start`, rtl ? barX[0] > barX.at(-1) : barX[0] < barX.at(-1))
    const titles = await page.locator('[data-combo-pane-title]').allInnerTexts()
    check(`769 ${label} combo: the panes are titled by their measures`, titles.join('|') === 'Orders|On-time share', titles.join('|'))
    await page.screenshot({ path: `${SHOTS}/769-combo-${label}.png` })
    check(`769 ${label} combo: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

const SCENARIOS = [
  ['767', probeHides],
  ['767', () => drawsBar({ dir: 'ltr', dark: false })],
  ['767', () => drawsBar({ dir: 'rtl', dark: false })],
  ['767', () => drawsBar({ dir: 'ltr', dark: true })],
  ['767', refusals],
  ['769', () => drawsForms({ dir: 'ltr', dark: false })],
  ['769', () => drawsForms({ dir: 'rtl', dark: false })],
  ['769', () => drawsForms({ dir: 'ltr', dark: true })],
]

try {
  for (const [ticket, run] of SCENARIOS) {
    if (ONLY.length && !ONLY.includes(ticket)) continue
    // A scenario that throws (a timeout) is one FAIL, and the next scenario still runs.
    await run().catch((e) => check(`${ticket} ${run.name || 'scenario'} ran to the end`, false, String(e).split('\n')[0]))
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
