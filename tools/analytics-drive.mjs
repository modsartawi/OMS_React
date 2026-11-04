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

// ── 768 ──────────────────────────────────────────────────────────────────────────────────────────────
// Each form draws in en / ar / dark with its tooltip:
//   KPI: the Σ headline, ▲ 12.0 % on the previous period, a sparkline with a tooltip; from a zero previous ▲ with no %;
//   line × 2 measures and line × 7 stores (five named + "Other" in ink grey, a legend of six);
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
  check(`768 ${label} line × 7 stores: the legend names P001–P005 and Other`, JSON.stringify(legend.map((s) => s.trim())) === JSON.stringify(['P001', 'P002', 'P003', 'P004', 'P005', 'Other']), legend.join(', '))
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

const SCENARIOS = [
  ['767', probeHides],
  ['767', () => drawsBar({ dir: 'ltr', dark: false })],
  ['767', () => drawsBar({ dir: 'rtl', dark: false })],
  ['767', () => drawsBar({ dir: 'ltr', dark: true })],
  ['767', refusals],
  ['768', () => forms768({ dir: 'ltr', dark: false })],
  ['768', () => forms768({ dir: 'rtl', dark: false })],
  ['768', () => forms768({ dir: 'ltr', dark: true })],
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
