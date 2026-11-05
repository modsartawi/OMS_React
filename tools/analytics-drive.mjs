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
// 770 — the home lists Items in groups, with search (en and ar dir):
//   1. Certified, Shared, then Mine, newest first within each, from a list served in neither order;
//   2. each item's tier badge, owner and last change (LTR-isolated); an untitled view's generated title;
//   3. search narrows by an English or an Arabic title, without another call; no match says so;
//   4. a view opens `/analytics/view/:id`, a board `/analytics/board/:id`;
//   5. an empty list is the how-to-start empty state.
//
// 771 — a board's filters re-ask every panel and stream each answer (en, ar and dark):
//   1. the panels sit in logical order on the 12-column grid (mirrored under ar); the ask box is in the header;
//   2. each panel asks Query for its view with the board's period as a relative token and no filters;
//   3. picking a region: within 0.5 s the strip shows "Updating… n of N" and every view panel is busy; then
//      the panels land one by one (KPI, bar, line, area) and the strip counts 1/4, 2/4, 3/4 on the way;
//   4. every re-ask carries the region; the URL carries it too (the permalink);
//   5. a store change leaves the opted-out area panel idle with its key unchanged, and re-asks the others;
//   6. reloading the permalink restores the filters; a period preset goes to the URL and the wire as its token.
//
// 772 - clicking a mark cross-filters the other panels, and drill by keeps a breadcrumb (en and ar):
//   1. a store row click: the other panels go busy, the clicked one and the opted-out one do not; only the
//      reached panels re-ask, each with `crossFilter`; the URL carries it; the board says it in words;
//   2. the same click again clears it; 3. drill by from the point into City: only that panel re-asks, as an
//      inline definition, with a breadcrumb back (not in the URL); "Save as view" waits for 775;
//   4. a bar click cross-filters on its channel, and the permalink restores it on reload.
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. DRIVE_PORT=5201 node tools/analytics-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { DELAYS_771, DELAYS_772, ITEMS, QUERY, installAnalyticsStubs, refusal } from './analytics-stubs.mjs'
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
    await page.locator('[data-analytics-home-header]').waitFor({ timeout: 10000 })
    check('767 the menu leaf opens the home', true)
    await context.close()
  }
}

// ── 768 ──────────────────────────────────────────────────────────────────────────────────────────────
// Each form draws in en / ar / dark with its tooltip:
//   KPI: the Σ headline, ▲ 12.0 % on the previous period, a sparkline with a tooltip; from a zero previous ▲ with no %;
//   line × 2 measures and line × 7 stores (five named + "Other (2)" in ink grey, a legend of six);
//   stacked area × 5 channels; horizontal, stacked and grouped bars; a stacked rate is refused;
//   every chart: a tooltip on hover, Recharts' accessibility layer, the LTR box, mirrored under RTL.

/** Hover a point and return the tooltip's text ('' when none showed). */
async function hoverTooltip(page, selector, at) {
  const box = await page.locator(selector).boundingBox()
  const { x, y } = at ?? { x: box.x + box.width * 0.5, y: box.y + box.height * 0.45 }
  await page.mouse.move(x, y)
  await page.waitForTimeout(150)
  const tip = page.locator(`${selector} .recharts-tooltip-wrapper`)
  if (!(await tip.count())) return ''
  const visible = await tip.first().evaluate((el) => getComputedStyle(el).visibility !== 'hidden')
  return visible ? (await tip.first().innerText()).replace(/\s+/g, ' ').trim() : ''
}

const strokes = (page, sel) =>
  page.locator(sel).evaluateAll((els) => els.map((el) => ({ attr: el.getAttribute('stroke'), paint: getComputedStyle(el).stroke })))

async function forms768({ dir, dark }) {
  const label = `${dir}${dark ? '-dark' : ''}`
  const { context, page, errors } = await open({ dir, dark })
  const rtl = dir === 'rtl'
  const goto = async (id, chart) => {
    await page.goto(`${BASE}/analytics/view/${id}`)
    await page.locator(`[data-chart="${chart}"]`).first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(250)
  }
  const shot = (name) => page.screenshot({ path: `${SHOTS}/768-${name}-${label}.png` })
  const a11y = async (sel) => (await page.locator(`${sel} svg.recharts-surface[tabindex="0"]`).count()) > 0
  const axisOnRight = async (sel, axis) => {
    const box = await page.locator(sel).boundingBox()
    const x = await page.locator(`${sel} .recharts-${axis}-tick-labels`).first().evaluate((el) => el.getBoundingClientRect().x)
    return x > box.x + box.width / 2
  }

  // KPI
  await goto('v-kpi', 'kpi')
  const kpiValue = (await page.locator('[data-kpi-value]').innerText()).trim()
  check(`768 ${label} KPI: the headline is the sum over the days`, kpiValue === '12,840', kpiValue)
  const delta = page.locator('[data-kpi-delta]')
  check(`768 ${label} KPI: ▲ 12.0% on the previous period`, (await delta.getAttribute('data-kpi-delta')) === 'up' && (await delta.innerText()).includes('12.0%'), (await delta.innerText()).replace(/\s+/g, ' '))
  check(`768 ${label} KPI: the previous figure is named, isolated`, (await page.locator('[data-kpi-previous] bdi[dir="ltr"]').innerText()) === '11,464')
  const sparkTip = await hoverTooltip(page, '[data-chart="sparkline"]')
  check(`768 ${label} KPI: the sparkline has a tooltip`, /Orders/.test(sparkTip), sparkTip)
  await shot('kpi')

  await goto('v-kpi-zero', 'kpi')
  const zero = (await page.locator('[data-kpi-delta]').innerText()).replace(/\s+/g, ' ')
  check(`768 ${label} KPI from a zero previous: up, with no %`, (await page.locator('[data-kpi-delta]').getAttribute('data-kpi-delta')) === 'up' && !zero.includes('%') && zero.includes('40'), zero)

  // Line × two measures
  const sel = '[data-chart="line"]'
  await goto('v-line-measures', 'line')
  check(`768 ${label} line × 2 measures: two lines in slots 1 and 2`, JSON.stringify((await strokes(page, `${sel} .recharts-line-curve`)).map((s) => s.attr)) === JSON.stringify(['var(--chart-1)', 'var(--chart-2)']))
  check(`768 ${label} line × 2 measures: a legend of two`, (await page.locator(`${sel} .recharts-legend-item`).count()) === 2)
  const lineTip = await hoverTooltip(page, sel)
  check(`768 ${label} line: a tooltip names both measures`, lineTip.includes('Orders') && lineTip.includes('Deliveries'), lineTip)
  check(`768 ${label} line: the accessibility layer`, await a11y(sel))
  const days = await page.locator(`${sel} .recharts-xAxis-tick-labels text`).evaluateAll((els) => els.map((e) => ({ t: e.textContent.trim(), x: e.getBoundingClientRect().x })))
  const earliestLeft = days.length > 1 && days[0].x < days.at(-1).x
  check(`768 ${label} line: the days run ${rtl ? 'right to left' : 'left to right'}`, rtl ? !earliestLeft : earliestLeft, days.map((d) => d.t).join(', '))
  check(`768 ${label} line: the value axis on the ${rtl ? 'right' : 'left'}`, (await axisOnRight(sel, 'yAxis')) === rtl)
  check(`768 ${label} line: the chart box is LTR`, (await page.locator(sel).getAttribute('dir')) === 'ltr')
  await shot('line-measures')

  // Line × 7 stores → five plus Other
  await goto('v-line-stores', 'line')
  const lines = await strokes(page, `${sel} .recharts-line-curve`)
  check(`768 ${label} line × 7 stores: five named lines plus Other`, lines.length === 6, String(lines.length))
  const legend = await page.locator(`${sel} .recharts-legend-item`).allInnerTexts()
  check(`768 ${label} line × 7 stores: the legend names P001–P005 and Other`, JSON.stringify(legend.map((s) => s.trim())) === JSON.stringify(['P001', 'P002', 'P003', 'P004', 'P005', 'Other (2)']), legend.join(', '))
  const ink = await tokenPaint(page, '--ink-3')
  check(`768 ${label} Other is ink grey`, lines.at(-1)?.attr === 'var(--ink-3)' && lines.at(-1)?.paint === ink, `${lines.at(-1)?.paint} vs ${ink}`)
  const storeTip = await hoverTooltip(page, sel)
  check(`768 ${label} line × stores: the tooltip includes Other`, storeTip.includes('Other'), storeTip)
  await shot('line-stores')

  // Stacked area: ranked aggregator, app, web, store, callcenter; painted by the channel's fixed slot.
  const area = '[data-chart="area"]'
  await goto('v-area', 'area')
  check(`768 ${label} area: five stacked areas`, (await page.locator(`${area} .recharts-area`).count()) === 5 && (await page.locator(area).getAttribute('data-chart-stacking')) === 'stacked')
  const areaFills = await page.locator(`${area} .recharts-area-area`).evaluateAll((els) => els.map((e) => e.getAttribute('fill')))
  check(`768 ${label} area: each channel in its fixed slot`, JSON.stringify(areaFills) === JSON.stringify(['var(--chart-4)', 'var(--chart-1)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-3)']), areaFills.join(' '))
  const areaTip = await hoverTooltip(page, area)
  check(`768 ${label} area: a tooltip`, /Aggregators/.test(areaTip) && /App/.test(areaTip), areaTip)
  check(`768 ${label} area: the accessibility layer`, await a11y(area))
  await shot('area')

  // Horizontal bar, SAR format
  const hb = '[data-chart="bar"]'
  await goto('v-bar-horizontal', 'bar')
  check(`768 ${label} horizontal bar: the box says horizontal`, (await page.locator(hb).getAttribute('data-chart-orientation')) === 'horizontal')
  const hbars = await page.locator(`${hb} .recharts-bar-rectangle path`).evaluateAll((els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { fill: e.getAttribute('fill'), w: r.width, h: r.height, y: r.y, x: r.x } }),
  )
  check(`768 ${label} horizontal bar: five bars, wider than tall, in channel slots`, hbars.length === 5 && hbars.every((b) => b.w > b.h) && hbars[0].fill === 'var(--chart-4)', hbars.map((b) => b.fill).join(' '))
  check(`768 ${label} horizontal bar: the category axis on the ${rtl ? 'right' : 'left'}`, (await axisOnRight(hb, 'yAxis')) === rtl)
  const hTip = hbars.length ? await hoverTooltip(page, hb, { x: hbars[0].x + hbars[0].w / 2, y: hbars[0].y + hbars[0].h / 2 }) : ''
  check(`768 ${label} horizontal bar: the tooltip in SAR`, /SAR\s182,400\.50/.test(hTip), hTip)
  await shot('bar-horizontal')

  // Stacked and grouped bars
  for (const mode of ['stacked', 'grouped']) {
    await goto(`v-bar-${mode}`, 'bar')
    const rects = await page.locator(`${hb} .recharts-bar-rectangle path`).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().x)))
    const columns = new Set(rects).size
    check(`768 ${label} ${mode} bar: 3 stores × 5 channels`, rects.length === 15, String(rects.length))
    check(`768 ${label} ${mode} bar: ${mode === 'stacked' ? 'one column per store' : 'each channel side by side'}`, mode === 'stacked' ? columns === 3 : columns === 15, `${columns} columns`)
    check(`768 ${label} ${mode} bar: a legend of five channels`, (await page.locator(`${hb} .recharts-legend-item`).count()) === 5)
    const tip = await hoverTooltip(page, hb)
    check(`768 ${label} ${mode} bar: a tooltip`, /App/.test(tip), tip)
    check(`768 ${label} ${mode} bar: the accessibility layer`, await a11y(hb))
    await shot(`bar-${mode}`)
  }

  // A rate never stacks
  await page.goto(`${BASE}/analytics/view/v-rate-stacked`)
  const refused = page.locator('[data-analytics-refused="rateStacked"]')
  await refused.waitFor({ timeout: 10000 })
  check(`768 ${label} a stacked rate is refused, in words`, (await refused.innerText()).includes('never stacked'), (await refused.innerText()).replace(/\s+/g, ' '))
  check(`768 ${label} no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
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

// ── 770 ──────────────────────────────────────────────────────────────────────────────────────────────
/** The home's groups in screen order, each with its item ids in screen order. */
const homeGroups = (page) =>
  page.locator('[data-analytics-group]').evaluateAll((els) =>
    els.map((g) => [g.getAttribute('data-analytics-group'), [...g.querySelectorAll('[data-analytics-item]')].map((i) => i.getAttribute('data-analytics-item'))]),
  )
const clean = (s) => s.replace(/[⁨⁩]/g, '').replace(/\s+/g, ' ').trim()

async function homeLists({ dir }) {
  const { context, page, calls, errors } = await open({ dir })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-group]').first().waitFor({ timeout: 10000 })
  check(`770 ${dir}: the home reads Analytics/Items`, calls.includes('Analytics/Items'))

  const ALL = [['certified', ['v-cert', 'b-ops']], ['shared', ['v-titled', 'b-shared']], ['personal', ['v-bar', 'v-old']]]
  const groups = await homeGroups(page)
  check(`770 ${dir}: Certified, then Shared, then Mine, newest first within each`, JSON.stringify(groups) === JSON.stringify(ALL), JSON.stringify(groups))
  const headings = await page.locator('[data-analytics-group] h2').allInnerTexts()
  check(`770 ${dir}: the group headings`, JSON.stringify(headings.map((h) => clean(h).replace(/\s*\d+$/, ''))) === JSON.stringify(['Certified', 'Shared', 'Mine']), headings.map(clean).join(' | '))

  const row = (id) => page.locator(`[data-analytics-item="${id}"]`)
  check(`770 ${dir}: an untitled view shows its generated title`, clean(await row('v-bar').locator('[data-analytics-item-title]').innerText()) === 'Orders by Channel')
  check(`770 ${dir}: each item shows its tier badge`, (await row('b-ops').locator('[data-analytics-item-tier="certified"]').innerText()).includes('Certified') && (await row('v-old').locator('[data-analytics-item-tier]').innerText()).includes('Personal'))
  const owner = clean(await row('b-shared').locator('[data-analytics-item-owner]').innerText())
  check(`770 ${dir}: each item shows its owner`, owner === 'Owner aalharbi', owner)
  const changed = clean(await row('b-shared').locator('[data-analytics-item-changed]').innerText())
  check(`770 ${dir}: each item shows its last change, isolated LTR`, changed === 'Changed Nov 3, 2026 · 16:40' && (await row('b-shared').locator('[data-analytics-item-changed] bdi[dir="ltr"]').count()) === 1, changed)
  if (dir === 'rtl') check('770 rtl: the page is RTL', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  await page.screenshot({ path: `${SHOTS}/770-home-${dir}.png` })

  const search = page.locator('input[data-analytics-home-search]')
  const before = calls.length
  await search.fill('orders')
  await page.waitForTimeout(150)
  const byEn = await homeGroups(page)
  check(`770 ${dir}: search "orders" narrows to English titles, the generated one included`, JSON.stringify(byEn) === JSON.stringify([['certified', ['v-cert']], ['shared', ['v-titled']], ['personal', ['v-bar']]]), JSON.stringify(byEn))
  await search.fill('الرياض')
  await page.waitForTimeout(150)
  const byAr = await homeGroups(page)
  check(`770 ${dir}: search in Arabic matches the Arabic title`, JSON.stringify(byAr) === JSON.stringify([['shared', ['b-shared']]]), JSON.stringify(byAr))
  check(`770 ${dir}: typing asks no further door`, calls.slice(before).filter((c) => c.startsWith('Analytics/')).length === 0, calls.slice(before).join(' '))
  if (dir === 'ltr') await page.screenshot({ path: `${SHOTS}/770-home-search-ar.png` })
  await search.fill('refunds')
  await page.locator('[data-analytics-home-no-match]').waitFor({ timeout: 5000 })
  check(`770 ${dir}: a search that matches nothing says so`, (await homeGroups(page)).length === 0)
  await search.fill('')
  await page.waitForTimeout(150)
  check(`770 ${dir}: clearing the search lists everything again`, JSON.stringify(await homeGroups(page)) === JSON.stringify(ALL))

  if (dir === 'ltr') {
    await row('v-titled').locator('a').click()
    await page.waitForURL('**/analytics/view/v-titled', { timeout: 5000 })
    await page.locator('[data-analytics-view="v-titled"]').waitFor({ timeout: 10000 })
    check('770 a view opens /analytics/view/:id', true)
    await page.goBack()
    await row('b-ops').locator('a').click()
    await page.waitForURL('**/analytics/board/b-ops', { timeout: 5000 })
    await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
    check('770 a board opens /analytics/board/:id', true)
  }
  check(`770 ${dir}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function homeEmpty() {
  const { context, page, errors } = await open({ list: [] })
  await page.goto(`${BASE}/analytics`)
  const empty = page.locator('[data-analytics-home-empty]')
  await empty.waitFor({ timeout: 10000 })
  const words = clean(await empty.innerText())
  check('770 no items: the empty state explains how to start', words.startsWith('No boards or views yet') && words.includes('Ask the OMS'), words)
  await page.screenshot({ path: `${SHOTS}/770-home-empty.png` })
  check('770 empty: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// 782 — the ask box on /analytics hands its question to the ONE copilot panel:
//   1. the copilot probe denies (or is absent): no ask box on the home;
//   2. granted: the top-bar button opens the panel EMPTY (the examples, an empty box, no Ask call);
//      then the ask box opens the same panel with the question sent — one `Copilot/Ask` carrying
//      exactly `{ question }` — and its answer in the thread; the ask box is emptied;
//   3. ar: the same, sent by Enter; no page errors.
// It waits on the probes' answers, not on the home's markup, which 770 rewrites.
async function askBox({ dir = 'ltr' } = {}) {
  const tag = `782 ${dir}`
  const probed = (page) => page.waitForResponse((r) => r.url().includes('/api/Copilot/Access'), { timeout: 10000 })
  for (const copilot of ['denied', 'absent']) {
    const { context, page, errors } = await open({ dir, copilot })
    const answered = probed(page)
    await page.goto(`${BASE}/analytics`)
    await answered
    await page.waitForTimeout(600)
    check(`${tag} copilot ${copilot}: no ask box on the home`, (await page.locator('[data-analytics-ask]').count()) === 0)
    check(`${tag} copilot ${copilot}: no top-bar button either`, (await page.locator('[data-copilot-button]').count()) === 0)
    check(`${tag} copilot ${copilot}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  const { context, page, errors, calls, bodies } = await open({ dir, copilot: 'granted' })
  await page.goto(`${BASE}/analytics`)
  const box = page.locator('[data-analytics-ask-question]')
  await box.waitFor({ timeout: 10000 })
  check(`${tag}: the ask box shows on the home`, true)
  await page.screenshot({ path: `${SHOTS}/782-home-${dir}.png` })

  // The top-bar button: the panel opens empty and nothing is asked.
  await page.locator('[data-copilot-button]').click()
  await page.locator('[data-copilot-sheet] [data-copilot-panel]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check(`${tag}: the top-bar button opens the panel with its examples`, (await page.locator('[data-copilot-sheet] [data-copilot-examples]').count()) === 1)
  check(`${tag}: … and an empty question box`, (await page.locator('[data-copilot-sheet] [data-copilot-question]').inputValue()) === '')
  check(`${tag}: … and no Copilot/Ask call`, !calls.includes('Copilot/Ask'))
  await page.screenshot({ path: `${SHOTS}/782-button-${dir}.png` })
  await page.keyboard.press('Escape')
  await page.locator('[data-copilot-sheet]').waitFor({ state: 'detached', timeout: 5000 })

  // The ask box: the same panel opens with the question sent.
  const question = 'Which channel took the most orders last month?'
  await box.fill(question)
  if (dir === 'rtl') await box.press('Enter')
  else await page.locator('[data-analytics-ask-send]').click()
  await page.locator('[data-copilot-sheet] [data-copilot-turn]').waitFor({ timeout: 10000 })
  const asks = bodies['Copilot/Ask'] ?? []
  check(`${tag}: the ask box sends ONE Copilot/Ask`, asks.length === 1, JSON.stringify(asks))
  check(`${tag}: … carrying exactly { question }`, JSON.stringify(asks[0]) === JSON.stringify({ question }), JSON.stringify(asks[0]))
  const asked = await page.locator('[data-copilot-sheet] [data-copilot-asked]').first().innerText()
  check(`${tag}: the panel shows the question asked`, asked.includes(question), asked)
  const answer = await page.locator('[data-copilot-sheet] [data-copilot-answer]').first().innerText()
  check(`${tag}: … and its answer`, answer.includes('Aggregators took the most orders'), answer)
  check(`${tag}: the panel's own box stays empty`, (await page.locator('[data-copilot-sheet] [data-copilot-question]').inputValue()) === '')
  check(`${tag}: the ask box is emptied`, (await box.inputValue()) === '')
  await page.screenshot({ path: `${SHOTS}/782-asked-${dir}.png` })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 771 ──────────────────────────────────────────────────────────────────────────────────────────────
const VIEW_PANELS = ['p-kpi', 'p-bar', 'p-line', 'p-area']
const panelStates = (page) =>
  page.locator('[data-board-panel-kind="view"]').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.boardPanel, e.dataset.boardPanelState])))
const allIdle = (page) =>
  page.waitForFunction(
    (ids) =>
      ids.every((id) => document.querySelector(`[data-board-panel="${id}"]`)?.dataset.boardPanelState === 'idle') &&
      document.querySelector('[data-board-stream]')?.dataset.boardStream === 'idle',
    VIEW_PANELS,
    { timeout: 15000 },
  )
/** Record, from now, when every view panel is busy, when each lands (goes idle) and every count the strip shows. */
const watchStream = (page) =>
  page.evaluate(() => {
    const log = { t0: performance.now(), landed: {}, counts: [], busyAt: null, clickAt: null }
    window.__stream = log
    // Timed from the user's click as the page receives it, not from the driver's call (its actionability waits).
    document.addEventListener('click', () => (log.clickAt ??= performance.now() - log.t0), { capture: true, once: true })
    const tick = () => {
      const cards = ['p-kpi', 'p-bar', 'p-line', 'p-area'].map((id) => document.querySelector(`[data-board-panel="${id}"]`))
      const strip = document.querySelector('[data-board-stream-count]')?.dataset.boardStreamCount
      if (strip && log.counts.at(-1) !== strip) log.counts.push(strip)
      if (log.busyAt === null && strip && cards.every((c) => c.dataset.boardPanelState === 'busy')) log.busyAt = performance.now() - log.t0
      for (const c of cards) {
        const id = c.dataset.boardPanel
        if (c.dataset.boardPanelState === 'busy') log.landed[id] = null
        else if (log.landed[id] === null) log.landed[id] = performance.now() - log.t0
      }
      if (performance.now() - log.t0 < 8000) requestAnimationFrame(tick)
    }
    tick()
  })
const pickMember = async (page, filter, member) => {
  const box = page.locator(`[data-testid="board-filter-${filter}"]`)
  await box.locator('[data-multi-select-trigger]').click()
  await box.locator(`[data-option="${member}"] input`).waitFor({ timeout: 5000 })
  return box
}
const lastBodies = (bodies, n) => (bodies['Analytics/Query'] ?? []).slice(-n)

async function board771({ dir, dark = false }) {
  const tag = `771 ${dir}${dark ? '-dark' : ''}`
  const { context, page, bodies, errors } = await open({ dir, dark, queryDelayFor: DELAYS_771, copilot: 'granted' })
  await page.goto(`${BASE}/analytics/board/b-ops`)
  await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
  await allIdle(page)

  const order = await page.locator('[data-board-grid] > [data-board-panel]').evaluateAll((els) => els.map((e) => e.dataset.boardPanel))
  check(`${tag}: the panels read in logical order`, JSON.stringify(order) === JSON.stringify(['p-head', 'p-kpi', 'p-bar', 'p-line', 'p-area', 'p-donut', 'p-note']), order.join(' '))
  check(`${tag}: a donut panel draws through the view page's form dispatch (769)`, await page.locator('[data-board-panel="p-donut"] [data-chart="donut"]').isVisible())
  const donutKey = await page.locator('[data-board-panel="p-donut"]').getAttribute('data-panel-key')
  const box = (id) => page.locator(`[data-board-panel="${id}"]`).boundingBox()
  const kpi = await box('p-kpi')
  const bar = await box('p-bar')
  check(`${tag}: the grid mirrors with the direction (the KPI ${dir === 'rtl' ? 'right' : 'left'} of the bar)`, dir === 'rtl' ? kpi.x > bar.x : kpi.x < bar.x, `${kpi.x} vs ${bar.x}`)
  check(`${tag}: the ask box sits in the board's header row`, await page.locator('[data-analytics-board-header] [data-analytics-ask]').isVisible())
  const first = (bodies['Analytics/Query'] ?? []).filter((b) => b.viewId !== 'v-donut')
  check(`${tag}: the panel opted out of every filter sends neither filters nor a period`, JSON.stringify((bodies['Analytics/Query'] ?? []).find((b) => b.viewId === 'v-donut')) === JSON.stringify({ viewId: 'v-donut', revision: 3, filters: [] }))
  check(
    `${tag}: each panel asks for its view, the period as a relative token, no filters`,
    first.length === 4 && first.every((b) => b.period === 'last-30-days' && b.filters.length === 0 && typeof b.revision === 'number'),
    JSON.stringify(first),
  )
  if (!dark) await page.screenshot({ path: `${SHOTS}/771-board-${dir}.png`, fullPage: true })

  // A region change: the strip and every card busy within 0.5 s, then the panels land one by one.
  const regionBox = await pickMember(page, 'region', 'central')
  await watchStream(page)
  await regionBox.locator('[data-option="central"] input').click()
  await page.waitForTimeout(300)
  if (!dark) await page.screenshot({ path: `${SHOTS}/771-streaming-${dir}.png`, fullPage: true })
  await allIdle(page)
  const log = await page.evaluate(() => window.__stream)
  const busyIn = log.busyAt - (log.clickAt ?? 0)
  check(`${tag}: within 0.5 s of the click the strip shows and every view panel is busy`, log.busyAt !== null && busyIn < 500, `${Math.round(busyIn)} ms after the click`)
  const landed = VIEW_PANELS.map((id) => log.landed[id])
  const oneByOne = landed.every((t, i) => typeof t === 'number' && (i === 0 || t - landed[i - 1] > 300))
  check(`${tag}: the panels land one by one (KPI, bar, line, area)`, oneByOne, landed.map((t) => Math.round(t)).join(' < '))
  check(`${tag}: the strip counts n of N on the way`, ['0/4', '1/4', '2/4', '3/4'].every((c) => log.counts.includes(c)), log.counts.join(' '))
  const reAsked = lastBodies(bodies, 4)
  check(
    `${tag}: every re-ask carries the region`,
    reAsked.length === 4 && reAsked.every((b) => JSON.stringify(b.filters) === JSON.stringify([{ dimension: 'region', values: ['central'] }])),
    JSON.stringify(reAsked.map((b) => b.filters)),
  )
  check(`${tag}: the fully opted-out donut keeps its key and never re-asks`, (await page.locator('[data-board-panel="p-donut"]').getAttribute('data-panel-key')) === donutKey && bodies['Analytics/Query'].filter((b) => b.viewId === 'v-donut').length === 1)
  check(`${tag}: the URL carries the region (the permalink)`, new URL(page.url()).searchParams.getAll('region').join() === 'central', page.url())
  await page.keyboard.press('Escape')

  // A store change: the area panel opted out of it, so it stays idle and keeps its key.
  const keyOf = (id) => page.locator(`[data-board-panel="${id}"]`).getAttribute('data-panel-key')
  const areaKey = await keyOf('p-area')
  const before = (bodies['Analytics/Query'] ?? []).length
  const storeBox = await pickMember(page, 'store', 'P001')
  await storeBox.locator('[data-option="P001"] input').click()
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-kpi"]')?.dataset.boardPanelState === 'busy', null, { timeout: 2000 })
  const during = await panelStates(page)
  await allIdle(page)
  const asked = (bodies['Analytics/Query'] ?? []).slice(before).map((b) => b.viewId)
  check(`${tag}: a store change leaves the opted-out area panel idle`, during['p-area'] === 'idle' && during['p-bar'] === 'busy', JSON.stringify(during))
  check(
    `${tag}: … with its key unchanged, and re-asks only the three it reaches`,
    (await keyOf('p-area')) === areaKey && asked.sort().join() === 'v-bar,v-kpi,v-line-measures',
    asked.join(' '),
  )
  await page.keyboard.press('Escape')

  // The permalink: a reload restores the filters, and a period preset goes to the URL as its token.
  await page.reload()
  await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
  await allIdle(page)
  const chips = await page.locator('[data-board-filters] [data-chip]').evaluateAll((els) => els.map((e) => e.dataset.chip).sort())
  check(`${tag}: reloading the permalink restores the filters`, chips.join() === 'P001,central', chips.join())
  await page.locator('[data-board-filter-period]').selectOption('last-week')
  await page.waitForFunction(() => document.querySelector('[data-board-stream]')?.dataset.boardStream === 'running', null, { timeout: 2000 })
  await allIdle(page)
  const periods = lastBodies(bodies, 4).map((b) => b.period)
  check(
    `${tag}: a period preset goes to the URL and the wire as its relative token`,
    new URL(page.url()).searchParams.get('period') === 'last-week' && periods.every((p) => p === 'last-week'),
    `${page.url()} ${periods}`,
  )
  if (dark) await page.screenshot({ path: `${SHOTS}/771-board-dark.png`, fullPage: true })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 772 ──────────────────────────────────────────────────────────────────────────────────────────────
const states772 = (page) =>
  page.locator('[data-board-panel-kind="view"]').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.boardPanel, e.dataset.boardPanelState])))
const idle772 = (page) =>
  page.waitForFunction(
    () =>
      [...document.querySelectorAll('[data-board-panel-kind="view"]')].every((e) => e.dataset.boardPanelState === 'idle') &&
      document.querySelector('[data-board-stream]')?.dataset.boardStream === 'idle',
    null,
    { timeout: 15000 },
  )
/** Click the store table's row for `store`, and read every panel's state as soon as `expectBusy` goes busy. */
const clickStoreRow = async (page, store, expectBusy = 'p-bar') => {
  await page.locator('[data-board-panel="p-stores"] .ag-row').filter({ hasText: store }).first().locator('.ag-cell').first().click()
  await page.waitForFunction((id) => document.querySelector(`[data-board-panel="${id}"]`)?.dataset.boardPanelState === 'busy', expectBusy, { timeout: 2000 })
  return states772(page)
}

async function board772({ dir }) {
  const tag = `772 ${dir}`
  const { context, page, bodies, errors } = await open({ dir, queryDelayFor: DELAYS_772 })
  await page.goto(`${BASE}/analytics/board/b-stores`)
  await page.locator('[data-analytics-board="b-stores"]').waitFor({ timeout: 10000 })
  await idle772(page)
  const asked = () => (bodies['Analytics/Query'] ?? []).length
  const since = (n) => (bodies['Analytics/Query'] ?? []).slice(n)
  const keyOf = (id) => page.locator(`[data-board-panel="${id}"]`).getAttribute('data-panel-key')
  const keys0 = { stores: await keyOf('p-stores'), fixed: await keyOf('p-fixed') }

  // 1. Click the P001 row: the other panels go busy, the clicked panel and the opted-out one do not.
  let n = asked()
  const during = await clickStoreRow(page, 'P001')
  check(
    `${tag}: a store row click puts the other panels busy, not the clicked one nor the opted-out`,
    during['p-bar'] === 'busy' && during['p-kpi'] === 'busy' && during['p-stores'] === 'idle' && during['p-fixed'] === 'idle',
    JSON.stringify(during),
  )
  await idle772(page)
  const crossed = since(n)
  check(
    `${tag}: only the bar and the KPI re-ask, each with the cross-filter on store P001`,
    crossed.map((b) => b.viewId).sort().join() === 'v-bar,v-kpi' &&
      crossed.every((b) => JSON.stringify(b.crossFilter) === JSON.stringify({ dimension: 'store', values: ['P001'] })),
    JSON.stringify(crossed),
  )
  check(`${tag}: the clicked and the opted-out panels keep their keys`, (await keyOf('p-stores')) === keys0.stores && (await keyOf('p-fixed')) === keys0.fixed)
  const url = new URL(page.url()).searchParams
  check(`${tag}: the URL carries the cross-filter`, url.get('cross') === 'store:P001' && url.get('crossFrom') === 'p-stores', page.url())
  check(`${tag}: the board says what it is filtered by`, ((await page.locator('[data-board-cross="store:P001"]').textContent()) ?? '').includes('P001'))
  check(`${tag}: the clicked row is marked`, (await page.locator('[data-board-panel="p-stores"] .ag-row.bg-accent').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/772-cross-${dir}.png`, fullPage: true })

  // 2. The same click again clears it: the others re-ask without it, the URL drops it.
  n = asked()
  const clearing = await clickStoreRow(page, 'P001')
  await idle772(page)
  const cleared = since(n)
  check(
    `${tag}: clicking the row again clears it (the others re-ask without it, the clicked panel stays)`,
    clearing['p-stores'] === 'idle' && cleared.every((b) => !('crossFilter' in b) && b.viewId !== 'v-table'),
    JSON.stringify(cleared),
  )
  check(`${tag}: … and the URL and the words drop it`, !new URL(page.url()).searchParams.has('cross') && (await page.locator('[data-board-cross]').count()) === 0, page.url())

  // 3. Drill by: from P001 into City, in place, with a breadcrumb back.
  await clickStoreRow(page, 'P001')
  await idle772(page)
  const menu = page.locator('[data-board-panel="p-stores"] [data-board-drill-menu]')
  const offered = await menu.locator('[data-drill-into]').evaluateAll((els) => els.map((e) => e.dataset.drillInto))
  check(`${tag}: the drill menu offers the other allowed category dimensions`, offered.join() === 'channel_group,city,region,country', offered.join())
  check(`${tag}: "Save as view" is shown, disabled until the view editor (775)`, (await menu.locator('[data-drill-action="saveAsView"]').getAttribute('aria-disabled')) === 'true')
  n = asked()
  await menu.locator('[data-drill-into="city"]').click()
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-stores"]')?.dataset.boardPanelState === 'busy', null, { timeout: 2000 })
  const drillDuring = await states772(page)
  await idle772(page)
  const drilled = since(n)
  check(`${tag}: drill by re-asks only that panel`, drilled.length === 1 && drillDuring['p-bar'] === 'idle', JSON.stringify(drillDuring))
  const d = drilled[0]?.definition?.query
  check(
    `${tag}: … as an inline definition by City, filtered to the point`,
    !drilled[0]?.viewId && JSON.stringify(d?.dimensions) === '["city"]' && JSON.stringify(d?.filters) === JSON.stringify([{ dimension: 'store', values: ['P001'] }]),
    JSON.stringify(drilled[0]),
  )
  const crumbs = page.locator('[data-board-panel="p-stores"] [data-board-drill-crumbs] [data-crumb]')
  const crumbText = await crumbs.evaluateAll((els) => els.map((e) => e.textContent.replace(/[›⁨⁩]/g, '').trim()))
  check(
    `${tag}: drill by shows its breadcrumb`,
    crumbText.length === 2 && crumbText[0] === 'Store' && crumbText[1].includes('P001') && crumbText[1].includes('City'),
    JSON.stringify(crumbText),
  )
  const cities = await page.locator('[data-board-panel="p-stores"] .ag-row').evaluateAll((els) => els.map((e) => e.textContent))
  check(`${tag}: the panel draws the drilled answer`, cities.length === 2 && cities.some((c) => c.includes('riyadh')), JSON.stringify(cities))
  check(`${tag}: the drill is not in the URL`, [...new URL(page.url()).searchParams.keys()].every((k) => !/drill/i.test(k)), page.url())
  await page.screenshot({ path: `${SHOTS}/772-drill-${dir}.png`, fullPage: true })
  await crumbs.first().locator('button').click()
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-stores"]')?.dataset.boardDrillDepth === '0', null, { timeout: 2000 })
  await idle772(page)
  check(
    `${tag}: the first crumb goes back to the view`,
    (await page.locator('[data-board-panel="p-stores"] [data-board-drill-crumbs]').count()) === 0 && (await keyOf('p-stores')) === keys0.stores,
  )

  // 4. A bar click cross-filters on its channel; the permalink restores it on reload.
  n = asked()
  await page.locator('[data-board-panel="p-bar"] .recharts-bar-rectangle path').first().click()
  await page.waitForFunction(() => new URL(location.href).searchParams.get('cross')?.startsWith('channel_group:'), null, { timeout: 2000 })
  await idle772(page)
  const byBar = since(n)
  check(
    `${tag}: a bar click cross-filters the others on its channel`,
    byBar.length > 0 && byBar.every((b) => b.viewId !== 'v-bar' && b.viewId !== 'v-area' && b.crossFilter?.dimension === 'channel_group'),
    JSON.stringify(byBar),
  )
  await page.reload()
  await page.locator('[data-analytics-board="b-stores"]').waitFor({ timeout: 10000 })
  await idle772(page)
  const reloaded = lastBodies(bodies, 4)
  check(
    `${tag}: reloading the permalink restores the cross-filter`,
    (await page.locator('[data-board-cross^="channel_group:"]').count()) === 1 && reloaded.filter((b) => b.crossFilter).length === 2,
    JSON.stringify(reloaded.map((b) => [b.viewId, b.crossFilter])),
  )
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

const SCENARIOS = [
  ['767', probeHides],
  ['767', () => drawsBar({ dir: 'ltr', dark: false })],
  ['767', () => drawsBar({ dir: 'rtl', dark: false })],
  ['767', () => drawsBar({ dir: 'ltr', dark: true })],
  ['767', refusals],
  ['768', () => forms768({ dir: 'ltr', dark: false })],
  ['768', () => forms768({ dir: 'rtl', dark: false })],
  ['768', () => forms768({ dir: 'ltr', dark: true })],
  ['769', () => drawsForms({ dir: 'ltr', dark: false })],
  ['769', () => drawsForms({ dir: 'rtl', dark: false })],
  ['769', () => drawsForms({ dir: 'ltr', dark: true })],
  ['770', () => homeLists({ dir: 'ltr' })],
  ['770', () => homeLists({ dir: 'rtl' })],
  ['770', homeEmpty],
  ['782', () => askBox({ dir: 'ltr' })],
  ['782', () => askBox({ dir: 'rtl' })],
  ['771', () => board771({ dir: 'ltr' })],
  ['771', () => board771({ dir: 'rtl' })],
  ['771', () => board771({ dir: 'ltr', dark: true })],
  ['772', () => board772({ dir: 'ltr' })],
  ['772', () => board772({ dir: 'rtl' })],
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
