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
//   3. search narrows by an English or an Arabic title at once (client-side), and the settled term goes to Items
//      as its `search` param (debounced); no match says so;
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
// 776 — saving follows the tiers (the session user is msartawi):
//   1. a Shared view of someone else's: "Edit" opens the editor, which says saving makes my copy; Save as my copy
//      posts `…/Copy` from the opened revision with my edits (no PUT) and lands on the Personal copy;
//   2. my own Shared view saves in place (`PUT` with `baseRevision`) and also offers "Save as copy";
//   3. a stale in-place save (405) names who saved last and when, and offers a copy or a reload: reload
//      starts the editor over from the server's item; the copy saves as my copy;
//   4. a 403 on an in-place save offers Save as my copy;
//   5. a Certified view: a curator saves in place, a non-curator as a copy; someone else's Personal view
//      offers no Edit; a copy whose source moved on says "the original changed since you copied it".
// 772 - clicking a mark cross-filters the other panels, and drill by keeps a breadcrumb (en and ar):
//   1. a store row click: the other panels go busy, the clicked one and the opted-out one do not; only the
//      reached panels re-ask, each with `crossFilter`; the URL carries it; the board says it in words;
//   2. the same click again clears it; 3. drill by from the point into City: only that panel re-asks, as an
//      inline definition, with a breadcrumb back (not in the URL); "Save as view" waits for 775;
//   4. a bar click cross-filters on its channel, and the permalink restores it on reload.
//
// 773 — every panel's actions, freshness and states (en, ar and dark; the clock frozen at 10:10):
//   1. a board of panels in every state: 408 and 409 show a retry while the neighbours render; 410 the area's
//      reason; empty "no data for these filters"; truncated "cut at the row cap";
//   2. "data as of 09:45", "fetched 10 minutes ago"; data 50 min old shows the "data is behind" chip
//      (icon + label, the attention status), 25 min old none;
//   3. retry draws the timed-out panel; refresh re-asks; the table view matches the chart's members, order
//      and figures; CSV (exact rows, no isolates), xlsx (a workbook) and PNG (from the SVG) download;
//   4. full screen in and out; the permalink carries the filters and names the panel, and opening it brings
//      the panel into view; the view page offers the same actions (a KPI holds PNG back, with its reason).
//
// 774 - drilling to detail from a store opens the Deliveries list already filtered (en and ar):
//   1. a store point on an orders panel offers "See deliveries"; a store point on a till-value panel does not;
//   2. it routes to /oms/deliveries, which searches that store over the board's period (last 30 days,
//      resolved against a frozen clock), shows the Store token, and clears its URL entry.
//
// 777 - the board editor lays panels out on the 12-column grid, mirrored under ar (en and ar):
//   1. the home's "New board" opens the editor; two views from the picker and a section header land below each
//      other at the inline start, each at least its chart type's minimum;
//   2. dragging the bar's handle to column 7 puts it at the inline END of row 0 (left of the KPI under ar);
//   3. the keyboard moves the section up and shrinks the KPI to its minimum, and no further (arrows mirrored
//      under ar), and the live region says where it is; resizing the bar by its corner pushes the section down;
//   4. an opt-out, the title and a 5-minute refresh; Save posts ONE board with those layouts, and the board page
//      draws the panels where the editor put them; Edit reopens them as saved and saves in place;
//   5. a board whose view was deleted shows "view removed" in that panel only, on the page and in the editor,
//      where the panel can be removed and the board saved; "Build a new view" saves a view and links it.
//
// 780 — auto-refresh and TV mode (the page clock faked; `runFor` moves it):
//   1. a `tv=1&refresh=30s` permalink opens in TV mode: no shell, the board fills the window, read-only filter
//      chips, panel actions kept; each view panel re-asks every 30 s, staggered 6 s apart (page-clock times);
//   2. nothing while hidden, one catch-up per panel on return; the cross-filter still works; Esc exits, keeping
//      the interval, filters and cross-filter; the TV button enters and its exit button leaves;
//   3. the saved default applies, Off stops the loop, the viewer's choice lasts the session (not saved), a new
//      session opens on the default; an anonymous TV permalink goes to login and back.
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. DRIVE_PORT=5201 node tools/analytics-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DELAYS_771, DELAYS_772, DELIVERIES_774, ITEMS, ITEMS_773, LIST_777, MODEL_773, PANEL_IDS_773, QUERY, QUERY_773, SEQUENCE_773, envelope, inlineAnswer, installAnalyticsStubs, refusal } from './analytics-stubs.mjs'
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

  // Review fix 14: a rate's members past five are drawn nowhere, and the panel says how many.
  await goto('v-rate-stores', 'line')
  const rateLines = await strokes(page, `${sel} .recharts-line-curve`)
  const notShown = page.locator('[data-analytics-not-shown]')
  check(`768 ${label} rate × 7 stores: five lines, no Other`, rateLines.length === 5, String(rateLines.length))
  check(
    `768 ${label} rate × 7 stores: "2 more not shown" on screen`,
    (await notShown.getAttribute('data-analytics-not-shown')) === '2' && noIsolates(await notShown.innerText()).startsWith('2 more not shown'),
    noIsolates(await notShown.innerText().catch(() => '')),
  )

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
  const { context, page, calls, errors, gets } = await open({ dir })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-group]').first().waitFor({ timeout: 10000 })
  check(`770 ${dir}: the home reads Analytics/Items`, calls.includes('Analytics/Items'))
  check(`770 ${dir}: … the whole list first: no search param`, JSON.stringify(gets['Analytics/Items']?.[0]) === '{}', JSON.stringify(gets['Analytics/Items']))

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
  // Review fix 15 (766 §C "GET Analytics/Items with kind and tier, plus search"): once typing stops the server
  // is asked with the search, once per settled term (debounced); the list narrowed at once, client-side.
  await page.waitForTimeout(500)
  const asked = (gets['Analytics/Items'] ?? []).map((q) => q.search ?? '')
  check(`770 ${dir}: the settled search goes to Items as its search param`, asked.at(-1) === 'الرياض', JSON.stringify(asked))
  check(`770 ${dir}: typing asks only Items, never per key`, calls.slice(before).every((c) => c === 'Analytics/Items') && asked.length <= 3, calls.slice(before).join(' '))
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

// ── 775: the chart editor ────────────────────────────────────────────────────────────────────────────
/** Tick `values` in the MultiSelect `data-testid=testId`, then close its panel. */
async function pick(page, testId, values) {
  const root = page.locator(`[data-testid="${testId}"]`)
  await root.locator('[data-multi-select-trigger]').click()
  for (const v of values) await root.locator(`[data-option="${v}"] input[type="checkbox"]`).check()
  await page.keyboard.press('Escape')
}
const offeredChoices = (page) =>
  page.locator('[data-analytics-choice][data-offered="yes"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-analytics-choice')))
const noIsolates = (s) => s.replace(/[⁦⁧⁨⁩]/g, '')

/**
 * 775 — build Q8 (median and p90 order-to-delivered by channel, last 7 days) from the model:
 *   1. the home's "New view" opens `/analytics/new?kind=view`; the callouts area is listed unavailable with
 *      its reason, and its measure is not offered;
 *   2. two percentiles by channel offer ONLY the table and the unstacked bars; the stacked bar and the donut
 *      say why not; an unavailable chip cannot be chosen;
 *   3. the preview asks `Analytics/Query` with the inline definition and draws the table through the view
 *      page's own dispatch; the generated title reads from the model labels;
 *   4. year to date → `ANALYTICS-407`, which offers the last 30 days; taking it redraws;
 *   5. save → ONE `POST Analytics/Item` (empty title, the definition) and the new view opens.
 */
async function editorBuildsQ8({ dir, dark }) {
  const tag = `775 ${dir}${dark ? '-dark' : ''}`
  const { context, page, bodies, errors } = await open({ dir, dark })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-new-view]').click()
  await page.locator('[data-analytics-editor]').waitFor({ timeout: 10000 })
  check(`${tag}: "New view" opens the builder`, page.url().endsWith('/analytics/new?kind=view'), page.url())
  check(`${tag}: the preview waits for a measure and a type`, (await page.locator('[data-analytics-preview-idle]').count()) === 1)
  const area = await page.locator('[data-analytics-unavailable-area="callouts"]').innerText()
  check(`${tag}: the unavailable area shows its reason`, area.includes('Waiting on the replica (753).'), area)
  await page.locator('[data-testid="editor-measures"] [data-multi-select-trigger]').click()
  check(`${tag}: a measure in an unavailable area is not offered`, (await page.locator('[data-testid="editor-measures"] [data-option="take_rate"]').count()) === 0)
  await page.keyboard.press('Escape')

  await pick(page, 'editor-measures', ['order_to_delivered_p50', 'order_to_delivered_p90'])
  await pick(page, 'editor-dimensions', ['channel_group'])
  const offered = await offeredChoices(page)
  check(`${tag}: Q8 offers only the table and the unstacked bars`, JSON.stringify(offered) === JSON.stringify(['bar-vertical', 'bar-horizontal', 'bar-grouped', 'table']), offered.join(', '))
  const whyStacked = await page.locator('[data-analytics-why="bar-stacked"]').innerText()
  const whyDonut = await page.locator('[data-analytics-why="donut"]').innerText()
  check(`${tag}: the stacked bar says a percentile is never stacked`, /never stacked/.test(whyStacked), whyStacked)
  check(`${tag}: the donut says why not`, /donut/i.test(whyDonut), whyDonut)
  await page.locator('[data-analytics-choice="donut"]').click({ force: true })
  check(`${tag}: an unavailable type cannot be chosen`, (await page.locator('[data-analytics-choice="donut"]').getAttribute('aria-pressed')) === 'false')

  await page.locator('[data-analytics-choice="table"]').click()
  const rows = page.locator('[data-analytics-preview] [data-chart="table"] .ag-row[row-index]')
  await rows.first().waitFor({ timeout: 10000 })
  check(`${tag}: the preview draws the table, one row per channel`, (await rows.count()) === 5, String(await rows.count()))
  const asked = bodies['Analytics/Query']?.at(-1)
  check(
    `${tag}: the preview asks Query with the inline definition`,
    asked?.definition?.chart?.type === 'table' &&
      JSON.stringify(asked.definition.query.measures) === JSON.stringify(['order_to_delivered_p50', 'order_to_delivered_p90']) &&
      JSON.stringify(asked.definition.query.dimensions) === JSON.stringify(['channel_group']) &&
      !('viewId' in asked),
    JSON.stringify(asked),
  )
  const previewTitle = noIsolates(await page.locator('[data-analytics-preview-title]').innerText())
  check(`${tag}: an empty title is generated from the model labels`, previewTitle === 'Median order to delivered and P90 order to delivered by Channel, last 30 days', previewTitle)
  const placeholderAr = noIsolates((await page.locator('[data-editor-title="ar"]').getAttribute('placeholder')) ?? '')
  check(`${tag}: … and in Arabic`, placeholderAr === 'الوسيط من الطلب إلى التسليم والمئين 90 من الطلب إلى التسليم حسب القناة، آخر 30 يومًا', placeholderAr)

  await page.locator('[data-editor-period]').selectOption('year-to-date')
  const refused = page.locator('[data-analytics-preview] [data-analytics-refusal="window"]')
  await refused.waitFor({ timeout: 10000 })
  const words = noIsolates(await refused.innerText())
  check(`${tag}: 407 names the percentile and its 92 days`, words.includes('Median order to delivered') && words.includes('92'), words)
  await page.screenshot({ path: `${SHOTS}/775-window-${dir}${dark ? '-dark' : ''}.png` })
  await refused.locator('[data-analytics-shorten="last-30-days"]').click()
  await rows.first().waitFor({ timeout: 10000 })
  check(`${tag}: taking the offer sets the last 30 days and redraws`, (await page.locator('[data-editor-period]').inputValue()) === 'last-30-days' && (await rows.count()) === 5)

  await page.locator('[data-editor-period]').selectOption('last-7-days')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/775-editor-${dir}${dark ? '-dark' : ''}.png`, fullPage: true })
  await page.locator('[data-editor-save]').click()
  await page.waitForURL('**/analytics/view/v-new', { timeout: 10000 })
  const made = bodies['Analytics/Item'] ?? []
  check(`${tag}: save sends ONE POST Analytics/Item`, made.length === 1, String(made.length))
  const body = made[0] ?? {}
  check(
    `${tag}: … a view with an empty title and the Q8 definition over the last 7 days`,
    body.kind === 'view' && body.title?.en === '' && body.title?.ar === '' && body.definition?.chart?.type === 'table' && body.definition?.query?.period === 'last-7-days',
    JSON.stringify(body),
  )
  await page.locator('[data-analytics-view="v-new"] [data-chart="table"] .ag-row[row-index]').first().waitFor({ timeout: 10000 })
  check(`${tag}: it lands on the new view, drawn`, (await page.locator('[data-analytics-view="v-new"] [data-chart="table"] .ag-row[row-index]').count()) === 5)
  if (dir === 'rtl') check(`${tag}: the page is RTL`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/**
 * 775 — the editor opened SEEDED (772's drill "Save as view" opens it so, via route state): a bar of orders
 * by store draws at once; a store's colour comes from the chart tokens only, a pick swaps, and the saved
 * member → slot map is written. Then 406 names the field and 410 shows the area's reason.
 */
async function editorSeededAndRefusals() {
  const tag = '775 seeded'
  const { context, page, bodies, errors } = await open({
    inlineQuery: (body) =>
      body.definition?.query?.dimensions?.includes('day')
        ? envelope({ field: 'query.dimensions[0]' }, { status: 400, success: false, message: 'Unknown member.', errors: [{ errorCode: 'ANALYTICS-406', internalErrorCode: '', errorMessage: 'Unknown member.' }] })
        : inlineAnswer(body.definition),
    create: refusal('ANALYTICS-410', 'The delivery area is not available yet.', 400),
  })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-home-header]').waitFor({ timeout: 10000 })
  const seed = { definition: { chart: { type: 'bar', orientation: 'vertical' }, query: { measures: ['orders'], dimensions: ['store'], filters: [], period: 'last-7-days' } } }
  await page.evaluate((seed) => {
    window.history.pushState({ usr: { editorSeed: seed }, key: 'seed775', idx: 1 }, '', '/analytics/new?kind=view')
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
  }, seed)
  await page.locator('[data-analytics-editor]').waitFor({ timeout: 10000 })
  check(`${tag}: the seeded type is chosen`, (await page.locator('[data-analytics-choice="bar-vertical"]').getAttribute('aria-pressed')) === 'true')
  check(`${tag}: the seeded period is set`, (await page.locator('[data-editor-period]').inputValue()) === 'last-7-days')
  await page.locator('[data-analytics-preview] [data-chart="bar"] .recharts-bar-rectangle path').first().waitFor({ timeout: 10000 })
  const p3 = page.locator('[data-analytics-colour-member="P003"]')
  await p3.waitFor({ timeout: 10000 })
  check(`${tag}: each member offers the five chart tokens only`, (await p3.locator('[data-colour-slot]').count()) === 5)
  // Review fix 17: a member reads by its name as one `code · name` pair (DimensionValues), never its bare key.
  await page.waitForFunction(() => document.querySelector('[data-analytics-colour-member="P003"] [data-analytics-colour-label]')?.textContent?.includes('Corniche'), null, { timeout: 5000 }).catch(() => {})
  const p3Label = noIsolates(await p3.locator('[data-analytics-colour-label]').innerText())
  check(`${tag}: the colour picker names P003 by its code · name pair`, p3Label === 'P003 · Corniche', p3Label)
  await p3.locator('[data-colour-slot="0"]').click()
  // The preview re-asks a moment after the pick (debounced), then repaints.
  await page.waitForFunction(() => document.querySelectorAll('[data-analytics-preview] [data-chart="bar"] .recharts-bar-rectangle path')[2]?.getAttribute('fill') === 'var(--chart-1)' && document.querySelectorAll('[data-analytics-preview] [data-chart="bar"] .recharts-bar-rectangle path')[0]?.getAttribute('fill') !== 'var(--chart-1)', null, { timeout: 5000 }).catch(() => {})
  const fills = await page.locator('[data-analytics-preview] [data-chart="bar"] .recharts-bar-rectangle path').evaluateAll((els) => els.map((e) => e.getAttribute('fill')))
  check(`${tag}: P003 takes --chart-1 and P001 its old slot`, fills[2] === 'var(--chart-1)' && fills[0] === 'var(--chart-3)', fills.join(' '))

  await page.locator('[data-editor-save]').click()
  const area = page.locator('[data-analytics-refusal="area"]')
  await area.waitFor({ timeout: 10000 })
  check(`${tag}: 410 shows the area's reason`, noIsolates(await area.innerText()).includes('The delivery area is not available yet.'), await area.innerText())
  const slots = bodies['Analytics/Item']?.[0]?.definition?.slots?.store ?? {}
  const values = Object.values(slots)
  check(`${tag}: the save carries the member → slot map, no slot twice`, slots.P003 === 0 && slots.P001 === 2 && new Set(values).size === values.length, JSON.stringify(slots))

  await pick(page, 'editor-dimensions', ['day'])
  await page.locator('[data-analytics-choice="table"]').click()
  const invalid = page.locator('[data-analytics-preview] [data-analytics-refusal="invalid"]')
  await invalid.waitFor({ timeout: 10000 })
  check(`${tag}: 406 names the offending field`, noIsolates(await invalid.innerText()).includes('query.dimensions[0]'), await invalid.innerText())
  check(`${tag}: … and marks the breakdowns invalid`, (await page.locator('[data-testid="editor-dimensions"] [data-multi-select-trigger][aria-invalid="true"], [data-testid="editor-dimensions"] [aria-invalid="true"]').count()) > 0)
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
  // Wait for the wave to START before waiting for it to end: until React commits the click the panels
  // still read idle, so `allIdle` alone can pass on the pre-click page and every check after it reads a
  // board the region has not reached yet (a slow commit made this look like "busy before the click").
  await page.waitForFunction(() => window.__stream.busyAt !== null, null, { timeout: 5000 }).catch(() => {})
  if (!dark) await page.screenshot({ path: `${SHOTS}/771-streaming-${dir}.png`, fullPage: true })
  await allIdle(page)
  const log = await page.evaluate(() => window.__stream)
  const busyIn = log.busyAt === null ? null : log.busyAt - (log.clickAt ?? 0)
  check(
    `${tag}: within 0.5 s of the click the strip shows and every view panel is busy`,
    busyIn !== null && busyIn < 500,
    busyIn === null ? 'never all busy within 5 s of the click' : `${Math.round(busyIn)} ms after the click`,
  )
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

// ── 776 ──────────────────────────────────────────────────────────────────────────────────────────────
/** Open `/analytics/view/:id`, follow its "Edit" (a real `<Link>` with route state) into the editor. */
async function editFromView(page, id) {
  await page.goto(`${BASE}/analytics/view/${id}`)
  const edit = page.locator('[data-analytics-edit]')
  await edit.waitFor({ timeout: 10000 })
  const how = await edit.getAttribute('data-analytics-edit')
  await edit.click()
  await page.locator('[data-analytics-editor]').waitFor({ timeout: 10000 })
  return how
}
const putBodies = (bodies) => Object.entries(bodies).filter(([k]) => k.startsWith('PUT '))
const conflict405 = envelope(
  { updatedBy: 'aalharbi', updatedAt: '2026-11-05T09:40:00', revision: 5 },
  { status: 409, success: false, message: 'Someone saved a newer revision.', errors: [{ errorCode: 'ANALYTICS-405', internalErrorCode: '', errorMessage: 'Someone saved a newer revision.' }] },
)

/** 776.1 — someone else's Shared view: Edit → Save as my copy posts `…/Copy`, never a PUT, and lands on the copy. */
async function savesTheirsAsMyCopy({ dir }) {
  const tag = `776 ${dir}`
  const { context, page, bodies, errors } = await open({ dir })
  const how = await editFromView(page, 'v-theirs-shared')
  check(`${tag}: someone else's Shared view offers Edit, as a copy`, how === 'copy', how)
  check(`${tag}: the editor is titled for editing`, (await page.getByRole('heading', { name: 'Edit analytics view' }).count()) === 1)
  check(
    `${tag}: it opens on the view's own definition and title`,
    (await page.locator('[data-editor-period]').inputValue()) === 'last-30-days' &&
      (await page.locator('[data-editor-title="en"]').inputValue()) === 'Orders by channel (Riyadh)' &&
      (await page.locator('[data-analytics-choice="bar-vertical"]').getAttribute('aria-pressed')) === 'true',
  )
  const standing = await page.locator('[data-analytics-save-standing="copy"]').innerText()
  check(`${tag}: it says saving makes my own Personal copy`, /Shared item is its owner's to change/.test(standing) && /Personal copy/.test(standing), standing)
  const save = page.locator('[data-editor-save]')
  check(
    `${tag}: the one save is "Save as my copy"`,
    (await save.getAttribute('data-editor-save-how')) === 'copy' && (await save.innerText()).trim() === 'Save as my copy' && (await page.locator('[data-editor-save-copy]').count()) === 0,
    await save.innerText(),
  )
  await page.locator('[data-editor-period]').selectOption('last-7-days')
  await page.locator('[data-analytics-preview] [data-chart="bar"] .recharts-bar-rectangle path').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/776-copy-${dir}.png`, fullPage: true })
  await save.click()
  await page.waitForURL('**/analytics/view/v-copy', { timeout: 10000 })
  const copies = bodies['Analytics/Item/v-theirs-shared/Copy'] ?? []
  const body = copies[0] ?? {}
  check(
    `${tag}: ONE POST …/Copy from the opened revision, carrying my edits`,
    copies.length === 1 && body.revision === 3 && body.definition?.query?.period === 'last-7-days' && body.title?.en === 'Orders by channel (Riyadh)',
    JSON.stringify(body),
  )
  check(`${tag}: … and no PUT, no new item`, putBodies(bodies).length === 0 && !bodies['Analytics/Item'], Object.keys(bodies).join(', '))
  await page.locator('[data-analytics-view="v-copy"] [data-chart="bar"] .recharts-bar-rectangle path').first().waitFor({ timeout: 10000 })
  check(`${tag}: it lands on my Personal copy, drawn, which I edit in place`, (await page.locator('[data-analytics-edit]').getAttribute('data-analytics-edit')) === 'in-place')
  if (dir === 'rtl') check(`${tag}: the page is RTL`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 776.2 — my own Shared view saves in place with `baseRevision`, and also offers "Save as copy". */
async function savesMineInPlace() {
  const tag = '776 in place'
  const { context, page, bodies, errors } = await open({})
  const how = await editFromView(page, 'v-mine-shared')
  check(`${tag}: my Shared view offers Edit, in place`, how === 'in-place', how)
  check(`${tag}: … with an explicit "Save as copy" beside Save`, (await page.locator('[data-editor-save-copy]').count()) === 1 && (await page.locator('[data-editor-save]').innerText()).trim() === 'Save view')
  check(`${tag}: no copy warning on my own item`, (await page.locator('[data-analytics-save-standing]').count()) === 0)
  await page.locator('[data-editor-period]').selectOption('last-7-days')
  await page.waitForTimeout(400)
  const askedBefore = (bodies['Analytics/Query'] ?? []).length
  await page.locator('[data-editor-save]').click()
  await page.waitForURL('**/analytics/view/v-mine-shared', { timeout: 10000 })
  const puts = bodies['PUT Analytics/Item/v-mine-shared'] ?? []
  check(
    `${tag}: ONE PUT with baseRevision 3 and the edit`,
    puts.length === 1 && puts[0].baseRevision === 3 && puts[0].definition?.query?.period === 'last-7-days' && !bodies['Analytics/Item/v-mine-shared/Copy'],
    JSON.stringify(puts),
  )
  const askedAt4 = () => (bodies['Analytics/Query'] ?? []).find((b) => b.viewId === 'v-mine-shared' && b.revision === 4)
  for (let i = 0; i < 50 && !askedAt4(); i++) await page.waitForTimeout(100)
  const asked = askedAt4() ?? (bodies['Analytics/Query'] ?? []).at(-1)
  check(`${tag}: the view re-reads at the new revision`, asked?.revision === 4, JSON.stringify(asked))
  const stale = (bodies['Analytics/Query'] ?? []).slice(askedBefore).filter((b) => b.viewId === 'v-mine-shared' && b.revision === 3).length
  check(`${tag}: … and never re-asks the old one after the save`, stale === 0, String(stale))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 776.3 — a stale in-place save: 405 names who and when, offers a copy or a reload; both work. */
async function staleSaveConflicts({ dir }) {
  const tag = `776 405 ${dir}`
  const { context, page, bodies, calls, errors } = await open({ dir, update: conflict405 })
  await editFromView(page, 'v-mine-shared')
  await page.locator('[data-editor-period]').selectOption('last-7-days')
  await page.waitForTimeout(400)
  await page.locator('[data-editor-save]').click()
  const note = page.locator('[data-analytics-refusal="conflict"]')
  await note.waitFor({ timeout: 10000 })
  const words = noIsolates(await page.locator('[data-analytics-conflict-words]').innerText())
  check(`${tag}: 405 names who saved last and when`, words.includes('aalharbi saved a newer revision') && words.includes('Nov 5, 2026 · 09:40'), words)
  check(`${tag}: … and offers a copy or a reload`, (await note.locator('[data-analytics-refusal-copy]').count()) === 1 && (await note.locator('[data-analytics-refusal-reload]').count()) === 1)
  check(`${tag}: the PUT carried the opened revision`, bodies['PUT Analytics/Item/v-mine-shared']?.[0]?.baseRevision === 3)
  await page.screenshot({ path: `${SHOTS}/776-conflict-${dir}.png`, fullPage: true })

  const reads = () => calls.filter((c) => c === 'Analytics/Item/v-mine-shared').length
  const before = reads()
  await note.locator('[data-analytics-refusal-reload]').click()
  await page.waitForFunction(() => document.querySelector('[data-editor-period]')?.value === 'last-30-days' && !document.querySelector('[data-analytics-refusal]'), null, { timeout: 10000 })
  check(`${tag}: reload re-reads the item and starts the editor over from it`, reads() > before && (await page.locator('[data-editor-period]').inputValue()) === 'last-30-days', `${before} → ${reads()}`)

  await page.locator('[data-editor-period]').selectOption('last-7-days')
  await page.waitForTimeout(400)
  await page.locator('[data-editor-save]').click()
  await note.waitFor({ timeout: 10000 })
  await note.locator('[data-analytics-refusal-copy]').click()
  await page.waitForURL('**/analytics/view/v-copy', { timeout: 10000 })
  const copy = bodies['Analytics/Item/v-mine-shared/Copy']?.[0] ?? {}
  check(`${tag}: the copy saves my edit as my copy`, copy.revision === 3 && copy.definition?.query?.period === 'last-7-days', JSON.stringify(copy))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 776.4 — the server's 403 on an in-place save still offers Save as my copy. */
async function notYoursOffersCopy() {
  const tag = '776 403'
  const { context, page, bodies, errors } = await open({ update: refusal('ANALYTICS-403', 'Not yours to edit in place.', 403) })
  await editFromView(page, 'v-mine-shared')
  await page.locator('[data-editor-save]').click()
  const note = page.locator('[data-analytics-refusal="not-yours"]')
  await note.waitFor({ timeout: 10000 })
  check(`${tag}: 403 says it is not mine to change in place`, /isn't yours to change in place/.test(await note.innerText()), await note.innerText())
  await note.locator('[data-analytics-refusal-copy]').click()
  await page.waitForURL('**/analytics/view/v-copy', { timeout: 10000 })
  check(`${tag}: Save as my copy posts …/Copy`, (bodies['Analytics/Item/v-mine-shared/Copy'] ?? []).length === 1)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 776.5 — Certified by grant, someone else's Personal offers nothing, a copy whose source moved on says so. */
async function tiersAndCopies() {
  const tag = '776 tiers'
  {
    const { context, page } = await open({ access: { canView: true, canCurate: true } })
    const how = await editFromView(page, 'v-cert-776')
    check(`${tag}: a curator edits a Certified view in place, and may copy it`, how === 'in-place' && (await page.locator('[data-editor-save-copy]').count()) === 1, how)
    await context.close()
  }
  const { context, page, errors } = await open({})
  const how = await editFromView(page, 'v-cert-776')
  const standing = await page.locator('[data-analytics-save-standing="copy"]').innerText()
  check(`${tag}: a non-curator saves a Certified view as a copy`, how === 'copy' && /Only curators change a Certified item/.test(standing), `${how} | ${standing}`)

  await page.goto(`${BASE}/analytics/view/v-theirs-personal`)
  await page.locator('[data-analytics-view="v-theirs-personal"] [data-analytics-view-title]').waitFor({ timeout: 10000 })
  check(`${tag}: someone else's Personal view offers no Edit`, (await page.locator('[data-analytics-edit]').count()) === 0)

  await page.goto(`${BASE}/analytics/view/v-copy-old`)
  const moved = page.locator('[data-analytics-view="v-copy-old"] [data-analytics-source-moved-on]')
  await moved.waitFor({ timeout: 10000 })
  check(`${tag}: a copy whose source moved on says so`, (await moved.innerText()).includes('The original changed since you copied it.'), await moved.innerText())
  await editFromView(page, 'v-copy-old')
  check(`${tag}: … and so does its editor`, (await page.locator('[data-analytics-editor] [data-analytics-source-moved-on]').count()) === 1)
  // Review fix 13 (story 64): a copied BOARD whose original moved on says so too.
  await page.goto(`${BASE}/analytics/board/b-copy-old`)
  const boardMoved = page.locator('[data-analytics-board="b-copy-old"] [data-analytics-source-moved-on]')
  await boardMoved.waitFor({ timeout: 10000 }).catch(() => {})
  check(`${tag}: a copied board whose source moved on says so`, (await boardMoved.innerText().catch(() => '')).includes('The original changed since you copied it.'))
  await page.goto(`${BASE}/analytics/board/b-779`)
  await page.locator('[data-analytics-board="b-779"] [data-analytics-board-title]').waitFor({ timeout: 10000 })
  check(`${tag}: … a board that is no copy does not`, (await page.locator('[data-analytics-source-moved-on]').count()) === 0)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 772 ──────────────────────────────────────────────────────────────────────────────────────────────
const states772 = (page) =>
  page.locator('[data-board-panel-kind="view"]').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.boardPanel, e.dataset.boardPanelState])))
const idle772 = (page) =>
  page.waitForFunction(
    () =>
      // 773: a settled panel is anything but loading/busy (idle, empty, failed, …).
      [...document.querySelectorAll('[data-board-panel-kind="view"]')].every((e) => !['loading', 'busy'].includes(e.dataset.boardPanelState)) &&
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
  check(`${tag}: "Save as view" waits for a drill`, (await menu.locator('[data-drill-action="saveAsView"]').count()) === 0)
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
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-kpi"]')?.dataset.boardPanelState === 'busy', null, { timeout: 2000 })
  await idle772(page)
  const byBar = since(n)
  check(
    // One cross-filter at a time: the bar replaces the store one, so the bar itself drops P001 (its own click never filters it).
    `${tag}: a bar click replaces the cross-filter: the others filter on its channel, the bar drops the store`,
    byBar.length === 3 &&
      byBar.every((b) => b.viewId !== 'v-area' && (b.viewId === 'v-bar' ? !('crossFilter' in b) : b.crossFilter?.dimension === 'channel_group')),
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

  // 5. "Save as view" from a drill opens the view editor (775) seeded with the drilled definition.
  await clickStoreRow(page, 'P001')
  await idle772(page)
  await page.locator('[data-board-panel="p-stores"] [data-drill-into="city"]').click()
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-stores"]')?.dataset.boardDrillDepth === '1', null, { timeout: 2000 })
  await idle772(page)
  await page.locator('[data-board-panel="p-stores"] [data-drill-action="saveAsView"]').click()
  await page.locator('[data-analytics-editor]').waitFor({ timeout: 10000 })
  // The title field is empty (a seeded drill has none); its placeholder is the title generated from the drill.
  const editorTitle = (await page.locator('[data-editor-title="en"]').getAttribute('placeholder')) ?? ''
  check(`${tag}: "Save as view" opens the editor seeded with the drill (by City)`, new URL(page.url()).pathname === '/analytics/new' && editorTitle.includes('City'), `${page.url()} ${editorTitle}`)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 778 ──────────────────────────────────────────────────────────────────────────────────────────────
const CURATOR = { canView: true, canCurate: true }
const tierActionsOn = (page) => page.locator('[data-analytics-action]').evaluateAll((els) => els.map((e) => e.dataset.analyticsAction))
const homeRow = (page, group, id) => page.locator(`[data-analytics-group="${group}"] [data-analytics-item="${id}"]`)

/** A curator certifies a Shared board: a frozen Certified copy leads the home; then delete it, and un-certify another. */
async function certifiesSharedBoard({ dir }) {
  const tag = `778 ${dir} curator`
  const { context, page, errors, bodies } = await open({ dir, access: CURATOR })
  await page.goto(`${BASE}/analytics/board/b-shared`)
  await page.locator('[data-analytics-board="b-shared"] [data-analytics-board-header] [data-analytics-tier-badge="shared"]').waitFor({ timeout: 15000 })
  await page.locator('[data-analytics-action="certify"]').waitFor({ timeout: 10000 })
  check(`${tag}: a Shared board of someone else's offers Certify only (no share, no delete)`, JSON.stringify(await tierActionsOn(page)) === '["certify"]', JSON.stringify(await tierActionsOn(page)))

  await page.locator('[data-analytics-action="certify"]').click()
  await page.locator('[data-analytics-certified-copy="b-shared-cert"]').waitFor({ timeout: 10000 })
  await page.locator('[data-analytics-action="certifyRevision"]').waitFor({ timeout: 10000 })
  const sent = bodies['Analytics/Item/b-shared/Certify']?.[0]
  check(`${tag}: Certify posts the revision on screen`, sent?.revision === 7, JSON.stringify(sent))
  check(`${tag}: once certified, Certify becomes "Certify this revision" into the copy`, JSON.stringify(await tierActionsOn(page)) === '["certifyRevision"]')
  check(`${tag}: the board itself stays Shared (its author's)`, (await page.locator('[data-analytics-board-header] [data-analytics-tier-badge]').getAttribute('data-analytics-tier-badge')) === 'shared')
  await page.screenshot({ path: `${SHOTS}/778-${dir}-certified-source.png` })

  await page.goto(`${BASE}/analytics`)
  await homeRow(page, 'certified', 'b-shared-cert').waitFor({ timeout: 10000 })
  check(`${tag}: on the home the certified copy is in Certified, with the Certified badge`, (await homeRow(page, 'certified', 'b-shared-cert').locator('[data-analytics-tier-badge="certified"]').count()) === 1)
  check(`${tag}: … and the Shared original stays in Shared`, (await homeRow(page, 'shared', 'b-shared').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/778-${dir}-home.png` })

  await homeRow(page, 'certified', 'b-shared-cert').locator('a').click()
  await page.locator('[data-analytics-board="b-shared-cert"] [data-analytics-tier-badge="certified"]').waitFor({ timeout: 10000 })
  await page.locator('[data-analytics-action="delete"]').waitFor({ timeout: 10000 })
  check(`${tag}: the certified board shows the Certified badge, and offers Un-certify and Delete`, JSON.stringify(await tierActionsOn(page)) === '["uncertify","delete"]', JSON.stringify(await tierActionsOn(page)))
  await page.screenshot({ path: `${SHOTS}/778-${dir}-certified-board.png` })

  await page.locator('[data-analytics-action="delete"]').click()
  await page.locator('[data-analytics-confirm="delete"]').click()
  await page.waitForURL(/\/analytics$/, { timeout: 10000 })
  await homeRow(page, 'shared', 'b-shared').waitFor({ timeout: 10000 })
  check(`${tag}: deleting the certified copy goes home, where it is gone`, (await page.locator('[data-analytics-item="b-shared-cert"]').count()) === 0 && (await page.locator('[data-analytics-group="certified"] [data-analytics-item="b-ops"]').count()) === 1)

  // Un-certify a Certified board: it leaves the Certified group.
  await page.goto(`${BASE}/analytics/board/b-ops`)
  await page.locator('[data-analytics-action="uncertify"]').waitFor({ timeout: 15000 })
  await page.locator('[data-analytics-action="uncertify"]').click()
  await page.locator('[data-analytics-confirm="uncertify"]').click()
  await page.locator('[data-analytics-board="b-ops"] [data-analytics-board-header] [data-analytics-tier-badge="shared"]').waitFor({ timeout: 10000 })
  check(`${tag}: un-certify makes the board no longer Certified`, true)
  await page.goto(`${BASE}/analytics`)
  await homeRow(page, 'shared', 'b-ops').waitFor({ timeout: 10000 })
  check(`${tag}: … and the home lists it under Shared`, (await page.locator('[data-analytics-group="certified"] [data-analytics-item="b-ops"]').count()) === 0)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** A viewer (no curator grant) sees the badges but no Certify, Un-certify or Delete on what is not theirs. */
async function viewerSeesNoCertify() {
  const tag = '778 viewer'
  const { context, page, errors } = await open({})
  await page.goto(`${BASE}/analytics/board/b-shared`)
  await page.locator('[data-analytics-board="b-shared"] [data-analytics-tier-badge="shared"]').waitFor({ timeout: 15000 })
  await page.locator('[data-board-panel="p-kpi"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check(`${tag}: a Shared board of someone else's offers no tier actions (no Certify)`, (await page.locator('[data-analytics-tier-actions]').count()) === 0)

  await page.goto(`${BASE}/analytics/board/b-ops`)
  await page.locator('[data-analytics-board="b-ops"] [data-analytics-board-header] [data-analytics-tier-badge="certified"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  check(`${tag}: a Certified board shows its badge, and no Un-certify or Delete`, (await page.locator('[data-analytics-action]').count()) === 0)

  await page.goto(`${BASE}/analytics/view/v-cert-776`)
  await page.locator('[data-analytics-view="v-cert-776"] [data-analytics-tier-badge="certified"]').waitFor({ timeout: 15000 })
  check(`${tag}: a Certified view shows the Certified badge`, (await page.locator('[data-analytics-view="v-cert-776"] [data-analytics-tier-badge="certified"]').innerText()).includes('Certified'))
  check(`${tag}: … and offers no tier actions`, (await page.locator('[data-analytics-action]').count()) === 0)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** An owner shares their Personal view in one click, takes it back, and deletes it. */
async function ownerSharesAndDeletes({ dir }) {
  const tag = `778 ${dir} owner`
  const { context, page, errors } = await open({ dir })
  const badge = (tier) => page.locator(`[data-analytics-view="v-bar"] [data-analytics-tier-badge="${tier}"]`)
  await page.goto(`${BASE}/analytics/view/v-bar`)
  await badge('personal').waitFor({ timeout: 15000 })
  await page.locator('[data-analytics-action="share"]').waitFor({ timeout: 10000 })
  check(`${tag}: my Personal view offers Share and Delete, and no Certify`, JSON.stringify(await tierActionsOn(page)) === '["share","delete"]', JSON.stringify(await tierActionsOn(page)))

  await page.locator('[data-analytics-action="share"]').click()
  await badge('shared').waitFor({ timeout: 10000 })
  await page.locator('[data-analytics-action="unshare"]').waitFor({ timeout: 10000 })
  check(`${tag}: Share is one click: the view is Shared and offers Unshare`, JSON.stringify(await tierActionsOn(page)) === '["unshare","delete"]')
  await page.screenshot({ path: `${SHOTS}/778-${dir}-shared-view.png` })
  await page.goto(`${BASE}/analytics`)
  await homeRow(page, 'shared', 'v-bar').waitFor({ timeout: 10000 })
  check(`${tag}: … and the home lists it under Shared`, (await homeRow(page, 'personal', 'v-bar').count()) === 0)

  await page.goto(`${BASE}/analytics/view/v-bar`)
  await page.locator('[data-analytics-action="unshare"]').click()
  await badge('personal').waitFor({ timeout: 10000 })
  check(`${tag}: Unshare takes it back to Personal`, (await page.locator('[data-analytics-action="share"]').count()) === 1)

  await page.locator('[data-analytics-action="delete"]').click()
  await page.locator('[data-analytics-confirm="delete"]').waitFor({ timeout: 5000 })
  check(`${tag}: Delete asks first`, !page.url().endsWith('/analytics'))
  await page.locator('[data-analytics-confirm="delete"]').click()
  await page.waitForURL(/\/analytics$/, { timeout: 10000 })
  await page.locator('[data-analytics-item="v-titled"]').waitFor({ timeout: 10000 })
  check(`${tag}: Delete goes home, where the view is gone`, (await page.locator('[data-analytics-item="v-bar"]').count()) === 0)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** A stale probe offered Certify; the server's `ANALYTICS-402` shows its reason and hides the action. */
async function staleProbeCertify402() {
  const tag = '778 402'
  const { context, page, errors } = await open({ access: CURATOR, certify: refusal('ANALYTICS-402', 'Needs the curator grant.', 403) })
  await page.goto(`${BASE}/analytics/board/b-shared`)
  await page.locator('[data-analytics-action="certify"]').waitFor({ timeout: 15000 })
  await page.locator('[data-analytics-action="certify"]').click()
  const note = page.locator('[data-analytics-tier-refusal="needs-curator"]')
  await note.waitFor({ timeout: 10000 })
  check(`${tag}: the reason is shown`, (await note.innerText()).includes('curator grant'), await note.innerText())
  check(`${tag}: … and Certify is hidden from then on`, (await page.locator('[data-analytics-action="certify"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/778-402.png` })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 773 ──────────────────────────────────────────────────────────────────────────────────────────────
const stubs773 = () => ({ items: ITEMS_773, query: QUERY_773, model: MODEL_773, querySequence: { 'v-773-slow': [...SEQUENCE_773['v-773-slow']] } })
/** Every panel has landed: none is loading or busy. */
const settled773 = (page) =>
  page.waitForFunction(
    (ids) => ids.every((id) => !['loading', 'busy', undefined].includes(document.querySelector(`[data-board-panel="${id}"]`)?.dataset.boardPanelState)),
    PANEL_IDS_773,
    { timeout: 15000 },
  )
const stateOf = (page, id) => page.locator(`[data-board-panel="${id}"]`).getAttribute('data-board-panel-state')
const download = async (page, click) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), click()])
  return { name: dl.suggestedFilename(), bytes: readFileSync(await dl.path()) }
}
const askedFor = (bodies, viewId) => (bodies['Analytics/Query'] ?? []).filter((b) => b.viewId === viewId).length

async function panels773({ dir, dark = false }) {
  const tag = `773 ${dir}${dark ? '-dark' : ''}`
  const { context, page, bodies, errors } = await open({ dir, dark, ...stubs773() })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  // 10:10: the fixtures' 09:45 is 25 min old (fine), the stale panel's 09:20 is 50 min (behind).
  await page.clock.setFixedTime(new Date('2026-11-05T10:10:00'))
  await page.goto(`${BASE}/analytics/board/b-773?region=central`)
  await page.locator('[data-analytics-board="b-773"]').waitFor({ timeout: 10000 })
  await settled773(page)
  const panel = (id) => page.locator(`[data-board-panel="${id}"]`)

  // ── States ──
  const states = Object.fromEntries(await Promise.all(PANEL_IDS_773.map(async (id) => [id, await stateOf(page, id)])))
  check(
    `${tag}: each panel shows its own state`,
    states['p-bar'] === 'idle' && states['p-slow'] === 'failed' && states['p-down'] === 'failed' && states['p-gone'] === 'unavailable' && states['p-empty'] === 'empty' && states['p-cut'] === 'idle' && states['p-stale'] === 'idle' && states['p-line'] === 'idle',
    JSON.stringify(states),
  )
  check(`${tag}: ANALYTICS-408 shows a retry`, (await panel('p-slow').locator('[data-panel-failed="ANALYTICS-408"] [data-panel-retry]').count()) === 1)
  check(`${tag}: ANALYTICS-409 shows a retry`, (await panel('p-down').locator('[data-panel-failed="ANALYTICS-409"] [data-panel-retry]').count()) === 1)
  const barsBeside = await panel('p-bar').locator('.recharts-bar-rectangle path').count()
  const lineBeside = await panel('p-line').locator('.recharts-line-curve').count()
  check(`${tag}: … while its neighbours render (the bar's 5 bars, the line's 2 lines)`, barsBeside === 5 && lineBeside === 2, `${barsBeside} bars, ${lineBeside} lines`)
  const gone = await panel('p-gone').locator('[data-panel-unavailable]').innerText()
  check(`${tag}: ANALYTICS-410 shows the area's reason`, gone.includes('Waiting on the replica (753).'), gone)
  const empty = await panel('p-empty').locator('[data-panel-empty]').innerText()
  check(`${tag}: an empty answer says "no data for these filters"`, empty.includes('No data for these filters.'), empty)
  const cut = await panel('p-cut').locator('[data-analytics-truncated]').innerText().catch(() => '')
  check(`${tag}: a truncated answer says it was cut at the row cap`, cut.includes('Cut at the row cap') && (await panel('p-bar').locator('[data-analytics-truncated]').count()) === 0, cut)

  // ── Freshness ──
  const behind = await panel('p-stale').locator('[data-analytics-behind]').innerText().catch(() => '')
  const behindIcon = await panel('p-stale').locator('[data-analytics-behind] svg').count()
  check(`${tag}: data 50 min old shows the "data is behind" chip, with an icon and a label`, behind.includes('Data is behind') && behindIcon === 1, behind)
  const behindTone = await panel('p-stale').locator('[data-analytics-behind] > span').evaluate((e) => getComputedStyle(e).backgroundColor)
  check(`${tag}: … in the attention status`, behindTone === (await tokenPaint(page, '--attention-050')), behindTone)
  check(`${tag}: data 25 min old shows no chip`, (await panel('p-bar').locator('[data-analytics-behind]').count()) === 0)
  const asOf = await panel('p-bar').locator('[data-analytics-as-of]').innerText()
  const fetched = await panel('p-bar').locator('[data-analytics-fetched]').innerText()
  check(`${tag}: "data as of 09:45" and "fetched 10 minutes ago"`, asOf.includes('09:45') && fetched.includes('Fetched 10 minutes ago'), `${asOf} | ${fetched}`)
  if (!dark) await page.screenshot({ path: `${SHOTS}/773-states-${dir}.png`, fullPage: true })

  // ── Retry ──
  const downAsked = askedFor(bodies, 'v-773-down')
  await panel('p-slow').locator('[data-panel-retry]').click()
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-slow"]')?.dataset.boardPanelState === 'idle', null, { timeout: 5000 })
  check(`${tag}: retrying the timed-out panel draws its answer`, (await panel('p-slow').locator('.recharts-bar-rectangle path').count()) === 2)
  await panel('p-down').locator('[data-panel-retry]').click()
  await page.waitForTimeout(100)
  await settled773(page)
  check(`${tag}: retrying the engine-down panel asks again and stays in its retry state`, askedFor(bodies, 'v-773-down') === downAsked + 1 && (await stateOf(page, 'p-down')) === 'failed', `${downAsked} → ${askedFor(bodies, 'v-773-down')}`)

  // ── Refresh ──
  const barAsked = askedFor(bodies, 'v-bar')
  await panel('p-bar').locator('[data-panel-action="refresh"]').click()
  await page.waitForTimeout(200)
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-bar"]')?.dataset.boardPanelState === 'idle', null, { timeout: 5000 })
  check(`${tag}: refresh re-asks the panel`, askedFor(bodies, 'v-bar') === barAsked + 1, `${barAsked} → ${askedFor(bodies, 'v-bar')}`)

  // ── Table view matches the chart ──
  const ticks = await panel('p-bar').locator('.recharts-xAxis-tick-labels text').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  await panel('p-bar').locator('[data-panel-action="table"]').click()
  await panel('p-bar').locator('[data-panel-table] .ag-row').first().waitFor({ timeout: 5000 })
  const tableRows = await panel('p-bar').locator('[data-panel-table] .ag-row').evaluateAll((rows) =>
    rows
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((r) => [r.querySelector('[col-id="channel_group"]')?.textContent.trim(), r.querySelector('[col-id="orders"]')?.textContent.trim()]),
  )
  check(`${tag}: the table view matches the chart (same members, same order)`, JSON.stringify(tableRows.map((r) => r[0])) === JSON.stringify(ticks), `${JSON.stringify(tableRows)} vs ${ticks}`)
  check(`${tag}: … with the chart's figures`, JSON.stringify(tableRows.map((r) => (r[1] ?? '').replace(/[^\d]/g, ''))) === JSON.stringify(['4200', '3100', '2600', '1800', '900']), JSON.stringify(tableRows))
  check(`${tag}: PNG is held back (with its reason) while the table shows`, (await panel('p-bar').locator('[data-panel-action="png"]').getAttribute('aria-disabled')) === 'true')
  if (!dark) await panel('p-bar').screenshot({ path: `${SHOTS}/773-table-${dir}.png` })
  await panel('p-bar').locator('[data-panel-action="table"]').click()
  await panel('p-bar').locator('[data-chart="bar"]').waitFor({ timeout: 5000 })

  // ── Downloads ──
  const csv = await download(page, () => panel('p-bar').locator('[data-panel-action="csv"]').click())
  const csvText = csv.bytes.toString('utf8')
  const wantCsv = '﻿Channel,Orders\r\nAggregators,4200\r\nApp,3100\r\nIn store,2600\r\nWeb,1800\r\nCall center,900\r\n'
  check(`${tag}: CSV downloads the panel's rows`, /^analytics-v-bar-\d{8}-\d{4}\.csv$/.test(csv.name) && csvText === wantCsv, `${csv.name} ${JSON.stringify(csvText)}`)
  check(`${tag}: … with no isolate in it`, !/[⁦-⁩]/.test(csvText))
  const xlsx = await download(page, () => panel('p-bar').locator('[data-panel-action="xlsx"]').click())
  check(`${tag}: xlsx downloads a workbook`, /^analytics-v-bar-\d{8}-\d{4}\.xlsx$/.test(xlsx.name) && xlsx.bytes.subarray(0, 2).toString() === 'PK' && xlsx.bytes.length > 1000, `${xlsx.name} ${xlsx.bytes.length} bytes`)
  const png = await download(page, () => panel('p-line').locator('[data-panel-action="png"]').click())
  const isPng = png.bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const pngW = isPng ? png.bytes.readUInt32BE(16) : 0
  const pngH = isPng ? png.bytes.readUInt32BE(20) : 0
  check(`${tag}: PNG downloads a picture serialised from the SVG`, /\.png$/.test(png.name) && isPng && pngW > 400 && pngH > 200 && png.bytes.length > 5000, `${png.name} ${pngW}×${pngH} ${png.bytes.length} bytes`)
  writeFileSync(`${SHOTS}/773-download-line-${dir}${dark ? '-dark' : ''}.png`, png.bytes)

  // ── Full screen ──
  await panel('p-bar').locator('[data-panel-action="fullscreen"]').click()
  const full = await page.waitForFunction(() => document.fullscreenElement?.dataset.boardPanel === 'p-bar', null, { timeout: 3000 }).then(() => true, () => false)
  check(`${tag}: full screen takes the panel to the whole screen`, full)
  if (full && !dark) await page.screenshot({ path: `${SHOTS}/773-fullscreen-${dir}.png` })
  await panel('p-bar').locator('[data-panel-action="fullscreen"]').click()
  const left = await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 3000 }).then(() => true, () => false)
  check(`${tag}: … and the same button leaves it`, left)

  // ── Permalink ──
  await panel('p-line').locator('[data-panel-action="permalink"]').click()
  await page.waitForTimeout(300)
  const link = await page.evaluate(() => navigator.clipboard.readText())
  const linkUrl = new URL(link)
  check(`${tag}: the permalink carries the board's filters and names the panel`, linkUrl.pathname === '/analytics/board/b-773' && linkUrl.searchParams.get('region') === 'central' && linkUrl.hash === '#panel-p-line', link)
  const other = await context.newPage()
  await installAnalyticsStubs(other, stubs773())
  await other.clock.setFixedTime(new Date('2026-11-05T10:10:00'))
  await other.goto(link)
  await other.locator('[data-board-panel="p-line"] [data-chart]').first().waitFor({ timeout: 10000 })
  await other.waitForTimeout(300)
  const top = (await other.locator('[data-board-panel="p-line"]').boundingBox()).y
  // Without the scroll it sits at ~1250 px, below the 900 px viewport; as the last row it can rise only so far.
  check(`${tag}: opening the permalink brings that panel into view`, top >= -1 && top < 600, `top ${Math.round(top)}`)
  await other.close()

  check(`${tag}: no page errors`, errors.filter((e) => !/status of 50\d/.test(e)).length === 0, errors.join(' | '))
  await context.close()
}

async function viewActions773({ dir }) {
  const tag = `773 view ${dir}`
  const { context, page, errors } = await open({ dir, ...stubs773() })
  await page.clock.setFixedTime(new Date('2026-11-05T10:10:00'))
  await page.goto(`${BASE}/analytics/view/v-bar`)
  await page.locator('[data-analytics-view] [data-chart="bar"]').waitFor({ timeout: 10000 })
  const actions = await page.locator('[data-analytics-view] [data-panel-action]').evaluateAll((els) => els.map((e) => e.dataset.panelAction))
  check(`${tag}: the view page offers the panel actions`, actions.join() === 'refresh,table,fullscreen,csv,xlsx,png,permalink', actions.join())
  const csv = await download(page, () => page.locator('[data-analytics-view] [data-panel-action="csv"]').click())
  check(`${tag}: … and its CSV is the view's rows`, csv.bytes.toString('utf8').startsWith('﻿Channel,Orders\r\nAggregators,4200\r\n'), JSON.stringify(csv.bytes.toString('utf8')))
  await page.locator('[data-analytics-view] [data-panel-action="fullscreen"]').click()
  const full = await page.waitForFunction(() => !!document.fullscreenElement?.matches('[data-analytics-view]'), null, { timeout: 3000 }).then(() => true, () => false)
  check(`${tag}: … and its full screen`, full)
  if (full) await page.evaluate(() => document.exitFullscreen())

  await page.goto(`${BASE}/analytics/view/v-kpi`)
  await page.locator('[data-analytics-view] [data-panel-action="png"]').waitFor({ timeout: 10000 })
  const kpiPng = page.locator('[data-analytics-view] [data-panel-action="png"]')
  check(`${tag}: a KPI (drawn in HTML) holds PNG back and says why`, (await kpiPng.getAttribute('aria-disabled')) === 'true' && /no picture/.test((await kpiPng.getAttribute('title')) ?? ''), await kpiPng.getAttribute('title'))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 779: history and revert ──────────────────────────────────────────────────────────────────────────
const revisionRows = (page) =>
  page.$$eval('[data-analytics-history] [data-analytics-revision]', (els) =>
    els.map((e) => ({ n: Number(e.getAttribute('data-analytics-revision')), viewing: e.getAttribute('data-viewing') === 'true', revert: !!e.querySelector('[data-analytics-revert]'), from: e.querySelector('[data-analytics-revision-reverted-from]')?.getAttribute('data-analytics-revision-reverted-from') ?? null })),
  )
const boardPanelIds = (page) => page.$$eval('[data-board-panel]', (els) => els.map((e) => e.getAttribute('data-board-panel')))
const waitFor = async (pred, ms = 10000) => {
  for (let i = 0; i < ms / 100; i++) {
    if (await pred()) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return false
}

/** 779.1 — my Shared board: the last revisions newest first, the viewed one marked; revert to 2, see the board change, undo it. */
async function revertsAndUndoes({ dir }) {
  const tag = `779 ${dir}`
  const { context, page, bodies, errors } = await open({ dir })
  await page.goto(`${BASE}/analytics/board/b-779`)
  await page.locator('[data-board-panel="p-line"]').waitFor({ timeout: 15000 })
  check(`${tag}: the board opens at revision 3 with three panels`, (await boardPanelIds(page)).join(',') === 'p-kpi,p-bar,p-line', (await boardPanelIds(page)).join(','))
  await page.locator('[data-analytics-history-open]').click()
  await page.locator('[data-analytics-history] [data-analytics-revision]').first().waitFor({ timeout: 10000 })
  const first = await revisionRows(page)
  check(
    `${tag}: history lists newest first, revision 3 marked as viewed, revert offered on the others`,
    JSON.stringify(first.map((r) => [r.n, r.viewing, r.revert])) === JSON.stringify([[3, true, false], [2, false, true], [1, false, true]]),
    JSON.stringify(first),
  )
  const who = clean(await page.locator('[data-analytics-revision="2"] [data-analytics-revision-who]').innerText())
  check(`${tag}: each revision says who and when`, /msartawi/.test(who) && /2026/.test(who), who)
  await page.screenshot({ path: `${SHOTS}/779-history-${dir}.png` })

  await page.locator('[data-analytics-revert="2"]').click()
  const changed = await waitFor(async () => (await boardPanelIds(page)).join(',') === 'p-kpi,p-bar')
  check(`${tag}: revert POSTs { revision: 2 }`, JSON.stringify(bodies['Analytics/Item/b-779/Revert']?.[0]) === '{"revision":2}', JSON.stringify(bodies['Analytics/Item/b-779/Revert']))
  check(`${tag}: … and the board changes back to revision 2's two panels`, changed, (await boardPanelIds(page)).join(','))
  await page.locator('[data-analytics-revert-done="4"]').waitFor({ timeout: 10000 })
  await waitFor(async () => (await revisionRows(page))[0]?.n === 4)
  const after = await revisionRows(page)
  check(
    `${tag}: the revert is a NEW revision 4, now viewed, recording it reverted to 2; 3 is still there`,
    after[0]?.n === 4 && after[0].viewing && after[0].from === '2' && after.some((r) => r.n === 3 && r.revert && !r.viewing) && after.length === 4,
    JSON.stringify(after),
  )
  await page.screenshot({ path: `${SHOTS}/779-reverted-${dir}.png` })

  await page.locator('[data-analytics-revert-undo="3"]').click()
  const undone = await waitFor(async () => (await boardPanelIds(page)).join(',') === 'p-kpi,p-bar,p-line')
  check(`${tag}: Undo reverts to revision 3`, JSON.stringify(bodies['Analytics/Item/b-779/Revert']?.[1]) === '{"revision":3}', JSON.stringify(bodies['Analytics/Item/b-779/Revert']))
  check(`${tag}: … and the board has its three panels again`, undone, (await boardPanelIds(page)).join(','))
  await waitFor(async () => (await revisionRows(page))[0]?.n === 5)
  const last = await revisionRows(page)
  check(`${tag}: the undo is itself revision 5 (reverted to 3), now viewed`, last[0]?.n === 5 && last[0].viewing && last[0].from === '3' && last.length === 5, JSON.stringify(last))
  check(`${tag}: no PUT or copy on the way`, putBodies(bodies).length === 0 && !Object.keys(bodies).some((k) => k.endsWith('/Copy')))
  if (dir === 'rtl') check(`${tag}: the page is RTL`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 774 ──────────────────────────────────────────────────────────────────────────────────────────────
async function detail774({ dir }) {
  const tag = `774 ${dir}`
  const { context, page, gets, errors } = await open({ dir, deliveries: DELIVERIES_774 })
  await page.clock.setFixedTime(new Date('2026-11-05T10:10:00'))
  await page.goto(`${BASE}/analytics/board/b-detail`)
  await page.locator('[data-analytics-board="b-detail"]').waitFor({ timeout: 10000 })
  await idle772(page)

  // 1. A till-value panel's store point offers drill by, but no detail drill.
  await page.locator('[data-board-panel="p-till"] .ag-row').filter({ hasText: 'P002' }).first().locator('.ag-cell').first().click()
  const tillMenu = page.locator('[data-board-panel="p-till"] [data-board-drill-menu]')
  await tillMenu.waitFor({ timeout: 5000 })
  await idle772(page)
  check(
    `${tag}: a till value offers no detail drill`,
    (await tillMenu.locator('[data-drill-into]').count()) > 0 && (await tillMenu.locator('[data-drill-action^="detail:"]').count()) === 0,
  )

  // 2. An orders panel's store point offers "See deliveries".
  await page.locator('[data-board-panel="p-stores"] .ag-row').filter({ hasText: 'P001' }).first().locator('.ag-cell').first().click()
  const see = page.locator('[data-board-panel="p-stores"] [data-drill-action="detail:deliveries"]')
  await see.waitFor({ timeout: 5000 })
  await idle772(page)
  check(`${tag}: a store point on an orders panel offers "See deliveries"`, ((await see.textContent()) ?? '').includes('See deliveries'), await see.textContent())
  await page.screenshot({ path: `${SHOTS}/774-menu-${dir}.png`, fullPage: true })

  // 3. It lands on the Deliveries list, searched for that store over the board's period.
  const listed = page.waitForResponse((r) => r.url().includes('/api/SdDocumentWeb/DeliveryDocumentList'), { timeout: 15000 })
  await see.click()
  await page.waitForFunction(() => location.pathname === '/oms/deliveries', null, { timeout: 10000 })
  await listed
  await page.locator('.ag-row', { hasText: '8000002' }).first().waitFor({ timeout: 10000 })
  const searched = gets['SdDocumentWeb/DeliveryDocumentList'] ?? []
  check(
    `${tag}: the Deliveries list searches store P001 over the last 30 days (2026-10-07 to 2026-11-05)`,
    searched.length === 1 && searched[0].StoreCode === 'P001' && searched[0].FromDate === '2026-10-07' && searched[0].ToDate === '2026-11-05',
    JSON.stringify(searched),
  )
  const bar = noIsolates(await page.locator('[role="search"]').first().innerText())
  check(
    `${tag}: the query bar shows the store and the range it searched, nothing left unsearched`,
    bar.includes('P001') && bar.includes('2026-10-07') && !/not searched/.test(bar),
    bar.replace(/\s+/g, ' ').slice(0, 200),
  )
  check(`${tag}: the URL entry is read once and cleared`, new URL(page.url()).search === '', page.url())
  await page.screenshot({ path: `${SHOTS}/774-deliveries-${dir}.png`, fullPage: true })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 779.2 — only someone who may edit the item sees its history. */
async function historyOnlyForEditors() {
  const tag = '779 who'
  const cases = [
    ['board/b-ops', '[data-board-panel]', { canView: true, canCurate: false }, false, "a Certified board, not a curator"],
    ['board/b-ops', '[data-board-panel]', { canView: true, canCurate: true }, true, 'a Certified board, as a curator'],
    ['view/v-theirs-shared', '[data-analytics-view] [data-analytics-view-title]', { canView: true, canCurate: false }, false, "someone else's Shared view"],
    ['view/v-mine-shared', '[data-analytics-view] [data-analytics-view-title]', { canView: true, canCurate: false }, true, 'my own Shared view'],
  ]
  for (const [path, ready, access, shown, what] of cases) {
    const { context, page, errors } = await open({ access })
    await page.goto(`${BASE}/analytics/${path}`)
    await page.locator(ready).first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(300)
    const count = await page.locator('[data-analytics-history-open]').count()
    check(`${tag}: ${what} ${shown ? 'shows' : 'hides'} History`, count === (shown ? 1 : 0), String(count))
    if (shown && path.startsWith('view/')) {
      await page.locator('[data-analytics-history-open]').click()
      await page.locator('[data-analytics-history] [data-analytics-revision]').first().waitFor({ timeout: 10000 })
      const rows = await revisionRows(page)
      check(`${tag}: ${what}: the view's history marks the revision viewed`, rows.length === 1 && rows[0].n === 3 && rows[0].viewing && !rows[0].revert, JSON.stringify(rows))
    }
    check(`${tag}: ${what}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// ── 777 ──────────────────────────────────────────────────────────────────────────────────────────────
const layoutOf = (page, id) => page.locator(`[data-editor-panel="${id}"]`).getAttribute('data-layout')
const boxOf = (page, sel) => page.locator(sel).boundingBox()

/** The centre of grid cell (col, row) on screen, columns counted from the inline start (the right under ar). */
async function cellPoint(page, col, row, dir) {
  const grid = page.locator('[data-board-editor-grid]')
  const g = await grid.boundingBox()
  const rows = Number(await grid.getAttribute('data-rows'))
  const colW = g.width / 12
  const pitch = (g.height + 12) / rows
  const fromStart = (col + 0.5) * colW
  return { x: dir === 'rtl' ? g.x + g.width - fromStart : g.x + fromStart, y: g.y + (row + 0.4) * pitch }
}

/** Press a handle and drag it so the pointer ends in cell (col, row). */
async function dragHandle(page, handle, col, row, dir) {
  const h = await boxOf(page, handle)
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  const to = await cellPoint(page, col, row, dir)
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
}

async function boardEditorBuilds({ dir }) {
  const tag = `777 ${dir}`
  const { context, page, bodies, errors } = await open({ dir, list: LIST_777 })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-new-board]').click()
  await page.locator('[data-board-editor="new"]').waitFor({ timeout: 10000 })
  check(`${tag}: "New board" opens the board editor`, page.url().endsWith('/analytics/new?kind=board'), page.url())

  // 1. Two views from the picker (mine and Shared are both offered) and a section header.
  const groups = await page.locator('[data-board-add-pick] optgroup').evaluateAll((els) => els.map((e) => e.getAttribute('label')))
  check(`${tag}: the picker groups Certified, Shared and my views`, JSON.stringify(groups) === JSON.stringify(['Certified', 'Shared', 'Personal']), groups.join(', '))
  for (const id of ['v-kpi', 'v-bar']) {
    await page.locator('[data-board-add-pick]').selectOption(id)
    await page.locator('[data-board-add-view]').click()
  }
  await page.locator('[data-board-add-section]').click()
  const ids = await page.locator('[data-editor-panel]').evaluateAll((els) => els.map((e) => e.dataset.editorPanel))
  check(`${tag}: three panels on the grid`, ids.length === 3, ids.join(', '))
  const [kpi, bar, head] = ids
  await page.waitForFunction((id) => document.querySelector(`[data-editor-panel="${id}"]`)?.dataset.editorPanelState === 'loaded', bar, { timeout: 10000 })
  const first = [await layoutOf(page, kpi), await layoutOf(page, bar), await layoutOf(page, head)]
  check(`${tag}: each lands below the last, at the inline start`, JSON.stringify(first) === JSON.stringify(['0,0,6,3', '0,3,6,3', '0,6,12,1']), first.join(' | '))
  await page.locator(`[data-editor-panel="${head}"] [data-editor-section="en"]`).fill('Orders')
  await page.locator(`[data-editor-panel="${head}"] [data-editor-section="ar"]`).fill('الطلبات')

  // 2. Drag the bar beside the KPI, at the inline end.
  await dragHandle(page, `[data-editor-move="${bar}"]`, 6, 0, dir)
  check(`${tag}: dragging the bar to column 7, row 1 places it there`, (await layoutOf(page, bar)) === '6,0,6,3', await layoutOf(page, bar))
  const kb = await boxOf(page, `[data-editor-panel="${kpi}"]`)
  const bb = await boxOf(page, `[data-editor-panel="${bar}"]`)
  check(`${tag}: the bar sits at the inline end of the row (${dir === 'rtl' ? 'left' : 'right'} of the KPI)`, dir === 'rtl' ? bb.x < kb.x : bb.x > kb.x, `kpi ${Math.round(kb.x)} bar ${Math.round(bb.x)}`)

  // 3. The keyboard: the section up into the gap, the KPI down to its minimum and no further.
  await page.locator(`[data-editor-move="${head}"]`).focus()
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp')
  check(`${tag}: ArrowUp moves the section up a row at a time`, (await layoutOf(page, head)) === '0,3,12,1', await layoutOf(page, head))
  const narrower = dir === 'rtl' ? 'Shift+ArrowRight' : 'Shift+ArrowLeft'
  await page.locator(`[data-editor-move="${kpi}"]`).focus()
  for (let i = 0; i < 6; i++) await page.keyboard.press(narrower)
  await page.keyboard.press('Shift+ArrowUp')
  await page.keyboard.press('Shift+ArrowUp')
  check(`${tag}: ${narrower} (mirrored) and Shift+ArrowUp shrink the KPI to its 2 x 2 minimum, no further`, (await layoutOf(page, kpi)) === '0,0,2,2', await layoutOf(page, kpi))
  const said = noIsolates(await page.locator('[data-board-editor-said]').innerText())
  check(`${tag}: the live region says where the panel is`, /column 1, row 1, 2 columns wide, 2 rows high/.test(said), said)
  const moveOn = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  await page.keyboard.press(moveOn)
  check(`${tag}: ${moveOn} moves toward the inline end`, (await layoutOf(page, kpi)) === '1,0,2,2', await layoutOf(page, kpi))

  // The bar's corner, dragged down a row: it grows to 4 rows and pushes the section down, never overlapping it.
  await dragHandle(page, `[data-editor-resize="${bar}"]`, 11, 3, dir)
  check(`${tag}: the corner resizes the bar to 4 rows`, (await layoutOf(page, bar)) === '6,0,6,4', await layoutOf(page, bar))
  check(`${tag}: … and the section it grew into is pushed below it`, (await layoutOf(page, head)) === '0,4,12,1', await layoutOf(page, head))

  // 4. An opt-out, the words, the refresh; then save.
  await page.locator(`[data-editor-panel="${bar}"] [data-editor-opt-out="store"]`).click()
  await page.locator('[data-board-title="en"]').fill('Ops desk')
  await page.locator('[data-board-title="ar"]').fill('مكتب العمليات')
  await page.locator('[data-board-refresh]').selectOption('300')
  await page.screenshot({ path: `${SHOTS}/777-editor-${dir}.png`, fullPage: true })
  check(`${tag}: a new board saves as a new item`, (await page.locator('[data-editor-save]').getAttribute('data-editor-save-how')) === 'create')
  await page.locator('[data-editor-save]').click()
  await page.waitForURL('**/analytics/board/b-new', { timeout: 10000 })
  const posted = bodies['Analytics/Item'] ?? []
  const sent = posted.at(-1) ?? {}
  const sentLayouts = (sent.definition?.panels ?? []).map((p) => `${p.kind}:${p.layout.x},${p.layout.y},${p.layout.w},${p.layout.h}`)
  check(`${tag}: ONE board posted, with the layouts as laid out`, posted.length === 1 && sent.kind === 'board' && JSON.stringify(sentLayouts) === JSON.stringify(['view:1,0,2,2', 'view:6,0,6,4', 'section:0,4,12,1']), JSON.stringify(sentLayouts))
  const sentBar = sent.definition?.panels?.find((p) => p.id === bar)
  check(
    `${tag}: … with the views by reference, the opt-out, the section words, the title and the refresh`,
    sentBar?.viewId === 'v-bar' && JSON.stringify(sentBar.optOut) === '["store"]' && sent.definition.panels[2].title.ar === 'الطلبات' && sent.title.en === 'Ops desk' && sent.definition.refresh === 300,
    JSON.stringify(sent).slice(0, 300),
  )

  // The board page draws them where the editor put them.
  await page.locator(`[data-board-panel="${bar}"]`).waitFor({ timeout: 10000 })
  const pk = await boxOf(page, `[data-board-panel="${kpi}"]`)
  const pb = await boxOf(page, `[data-board-panel="${bar}"]`)
  const ph = await boxOf(page, `[data-board-panel="${head}"]`)
  check(`${tag}: the board page draws the bar at the inline end and the section below`, (dir === 'rtl' ? pb.x < pk.x : pb.x > pk.x) && ph.y > pb.y, `kpi ${Math.round(pk.x)} bar ${Math.round(pb.x)} head ${Math.round(ph.y)}`)
  await page.screenshot({ path: `${SHOTS}/777-board-${dir}.png`, fullPage: true })

  // Reopen: the editor holds what was saved, and my own board saves in place.
  await page.locator('[data-analytics-board-edit]').click()
  await page.locator('[data-board-editor="b-new"]').waitFor({ timeout: 10000 })
  const again = [await layoutOf(page, kpi), await layoutOf(page, bar), await layoutOf(page, head)]
  check(`${tag}: Edit reopens the board as saved`, JSON.stringify(again) === JSON.stringify(['1,0,2,2', '6,0,6,4', '0,4,12,1']) && (await page.locator('[data-board-refresh]').inputValue()) === '300', again.join(' | '))
  check(`${tag}: … and my own board saves in place`, (await page.locator('[data-editor-save]').getAttribute('data-editor-save-how')) === 'in-place')
  await page.locator(`[data-editor-move="${head}"]`).focus()
  await page.keyboard.press('ArrowDown')
  await page.locator('[data-editor-save]').click()
  await page.waitForURL('**/analytics/board/b-new', { timeout: 10000 })
  const put = bodies['PUT Analytics/Item/b-new']?.at(-1)
  check(`${tag}: the in-place save PUTs with the opened revision and the moved section`, put?.baseRevision === 1 && put.definition.panels.find((p) => p.id === head)?.layout.y === 5, JSON.stringify(put?.definition?.panels?.map((p) => p.layout)))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function removedView({ dir }) {
  const tag = `777 ${dir} removed`
  const { context, page, bodies, errors } = await open({ dir, list: LIST_777 })
  await page.goto(`${BASE}/analytics/board/b-777`)
  await page.locator('[data-board-panel="p-gone"]').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-bar"]')?.dataset.boardPanelState === 'idle', null, { timeout: 10000 })
  const gone = page.locator('[data-board-panel="p-gone"]')
  check(`${tag}: the deleted view's panel says "view removed"`, (await gone.getAttribute('data-board-panel-state')) === 'removed' && /removed/.test(await gone.innerText()), await gone.innerText())
  check(`${tag}: … and the rest of the board still draws`, (await page.locator('[data-board-panel="p-bar"] [data-chart]').count()) === 1 && (await page.locator('[data-board-panel="p-head"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/777-removed-${dir}.png`, fullPage: true })
  await page.locator('[data-analytics-board-edit]').click()
  await page.locator('[data-board-editor="b-777"]').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('[data-editor-panel="p-gone"]')?.dataset.editorPanelState === 'removed', null, { timeout: 10000 })
  check(`${tag}: the editor shows it removed too`, (await page.locator('[data-editor-panel="p-gone"] [data-editor-view-removed]').count()) === 1)
  check(`${tag}: the editor opens on the board's saved refresh`, (await page.locator('[data-board-refresh]').inputValue()) === '60')
  await page.locator('[data-editor-remove="p-gone"]').click()
  await page.locator('[data-editor-save]').click()
  await page.waitForURL('**/analytics/board/b-777', { timeout: 10000 })
  const put = bodies['PUT Analytics/Item/b-777']?.at(-1)
  check(`${tag}: removing the panel and saving keeps the others`, JSON.stringify(put?.definition?.panels?.map((p) => p.id)) === '["p-head","p-bar"]' && put.baseRevision === 4 && put.definition.refresh === 60, JSON.stringify(put?.definition))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function buildsNewView() {
  const tag = '777 build a view'
  const { context, page, bodies, errors } = await open({ list: LIST_777 })
  await page.goto(`${BASE}/analytics/new?kind=board`)
  await page.locator('[data-board-editor="new"]').waitFor({ timeout: 10000 })
  await page.locator('[data-board-build-view]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-analytics-editor]').waitFor({ timeout: 10000 })
  check(`${tag}: "Build a new view" opens 775's editor in a dialog`, true)
  await pick(page, 'editor-measures', ['orders'])
  await pick(page, 'editor-dimensions', ['channel_group'])
  await dialog.locator('[data-analytics-choice="bar-vertical"]').click()
  await dialog.locator('[data-analytics-preview] [data-chart]').first().waitFor({ timeout: 10000 })
  await dialog.locator('[data-editor-save]').click()
  await page.locator('[data-editor-panel]').first().waitFor({ timeout: 10000 })
  const made = bodies['Analytics/Item']?.at(-1)
  const panel = page.locator('[data-editor-panel]').first()
  check(`${tag}: the view is saved as a view`, made?.kind === 'view', JSON.stringify(made)?.slice(0, 120))
  check(`${tag}: … the dialog closes and the board links it as a panel, still in the board editor`, (await page.locator('dialog[open]').count()) === 0 && page.url().endsWith('/analytics/new?kind=board') && (await panel.getAttribute('data-editor-panel-kind')) === 'view', page.url())
  await page.waitForFunction(() => document.querySelector('[data-editor-panel]')?.dataset.editorPanelState === 'loaded', null, { timeout: 10000 })
  const name = noIsolates(await panel.locator('[data-editor-panel-name]').innerText())
  check(`${tag}: the panel shows the new view (a bar: half the width, 3 rows)`, /Orders/.test(name) && (await panel.getAttribute('data-layout')) === '0,0,6,3', `${name} ${await panel.getAttribute('data-layout')}`)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 780 ──────────────────────────────────────────────────────────────────────────────────────────────
// The 771 board (five view panels). The page clock is Playwright's fake one, so the 30 s loop is moved by
// `fastForward`, not waited out; "hidden" is `document.hidden` overridden plus a `visibilitychange`.
const PANELS_780 = ['p-kpi', 'p-bar', 'p-line', 'p-area', 'p-donut']
const VIEWS_780 = ['v-kpi', 'v-bar', 'v-line-measures', 'v-area', 'v-donut']
const settled780 = (page) =>
  page.waitForFunction((ids) => ids.every((id) => !['loading', 'busy', undefined].includes(document.querySelector(`[data-board-panel="${id}"]`)?.dataset.boardPanelState)), PANELS_780, {
    timeout: 15000,
  })
const asks780 = (bodies) => VIEWS_780.map((v) => askedFor(bodies, v))
const sum = (xs) => xs.reduce((a, b) => a + b, 0)
const since = (now, before) => now.map((n, i) => n - before[i])
/**
 * Move the page clock on — `runFor`, so each timer fires at its own time (a jump would fire them all at its
 * end) — then give the re-asks a moment (real time) to reach the stubs and land.
 */
const forward = async (page, ms) => {
  await page.clock.runFor(ms)
  await page.waitForTimeout(250)
  await settled780(page)
}
/** Log each Query ask with the PAGE's clock (the fake one), so the drive reads when it was asked, not when it looked. */
const logAsks = (page) =>
  page.addInitScript(() => {
    window.__asks = []
    const real = window.fetch
    window.fetch = function (input, init) {
      try {
        if (String(input?.url ?? input).includes('Analytics/Query') && typeof init?.body === 'string') window.__asks.push({ t: Date.now(), viewId: JSON.parse(init.body).viewId })
      } catch {
        // not a JSON body: not a panel's ask
      }
      return real.apply(this, arguments)
    }
  })
const asksAt = (page) => page.evaluate(() => window.__asks.slice())
const setHidden = (page, hidden) =>
  page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)

async function tvPermalink780({ dir }) {
  const tag = `780 ${dir}`
  const { context, page, bodies, errors } = await open({ dir, copilot: 'granted' })
  await page.clock.install({ time: new Date('2026-11-05T10:10:00') })
  await logAsks(page)
  await page.goto(`${BASE}/analytics/board/b-ops?tv=1&refresh=30s&region=central`)
  await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
  await settled780(page)

  // ── TV mode from the permalink ──
  const board = await page.locator('[data-analytics-board="b-ops"]').boundingBox()
  const vp = page.viewportSize()
  check(`${tag}: a tv=1 permalink opens straight into TV mode`, (await page.locator('[data-analytics-board="b-ops"]').getAttribute('data-analytics-tv')) === 'on')
  check(`${tag}: … the shell is hidden (no rail, no top bar, no nav)`, (await page.locator('[data-shell="hidden"]').count()) === 1 && (await page.locator('nav, aside').count()) === 0, `${await page.locator('nav, aside').count()} nav/aside`)
  check(`${tag}: … the board fills the screen`, board && board.x === 0 && board.y === 0 && Math.round(board.width) === vp.width && Math.round(board.height) === vp.height, JSON.stringify(board))
  const chips = await page.locator('[data-board-filter-chips]').innerText().catch(() => '')
  check(
    `${tag}: … the filters are a read-only chip strip (period and region), not the strip's pickers`,
    (await page.locator('[data-board-filters]').count()) === 0 && chips.includes('Last 30 days') && chips.includes('Central') && (await page.locator('[data-board-filter-chips] button, [data-board-filter-chips] input, [data-board-filter-chips] select').count()) === 0,
    chips.replace(/\n/g, ' '),
  )
  check(`${tag}: … the ask box is not on the wall screen`, (await page.locator('[data-analytics-board-header] [data-analytics-ask]').count()) === 0)
  check(`${tag}: … the picker reads the permalink's 30 s`, (await page.locator('[data-board-refresh]').inputValue()) === '30s')
  check(`${tag}: … the panel actions are still there`, (await page.locator('[data-board-panel="p-bar"] [data-panel-action="refresh"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/780-tv-${dir}.png` })

  // ── The loop: five panels staggered 6 s apart over 30 s, each re-asked every 30 s (read on the page clock) ──
  const opened = (await asksAt(page)).length
  for (let i = 0; i < 12; i++) await forward(page, 6000)
  const loop = (await asksAt(page)).slice(opened)
  const per = VIEWS_780.map((v) => loop.filter((a) => a.viewId === v).map((a) => a.t))
  const gaps = per.flatMap((ts) => ts.slice(1).map((t, i) => t - ts[i]))
  check(`${tag}: refresh re-asks every view panel on the interval (the opted-out donut too)`, per.every((ts) => ts.length >= 2) && gaps.every((g) => Math.abs(g - 30_000) <= 1000), `${per.map((ts) => ts.length).join(',')} asks; gaps ${gaps.join(',')}`)
  const turn = VIEWS_780.map((_, i) => per[i][0] % 30_000).sort((a, b) => a - b)
  const spread = turn.slice(1).map((t, i) => t - turn[i])
  check(`${tag}: … staggered: the panels take turns 6 s apart, never at once`, spread.length === 4 && spread.every((d) => Math.abs(d - 6000) <= 1000), spread.join(','))
  const last = (bodies['Analytics/Query'] ?? []).filter((b) => b.viewId === 'v-bar').at(-1)
  check(`${tag}: … a re-ask keeps the board's filters`, JSON.stringify(last?.filters ?? []).includes('central'), JSON.stringify(last?.filters))

  // ── Paused while hidden, one catch-up on return ──
  await setHidden(page, true)
  let before = (await asksAt(page)).length
  for (let i = 0; i < 4; i++) await forward(page, 30_000)
  const whileHidden = (await asksAt(page)).length - before
  check(`${tag}: nothing is asked while the tab is hidden (2 min)`, whileHidden === 0, String(whileHidden))
  const back = await page.evaluate(() => Date.now())
  await setHidden(page, false)
  await page.waitForTimeout(300)
  await settled780(page)
  const catchUp = (await asksAt(page)).slice(before).filter((a) => a.t - back < 200)
  const caught = VIEWS_780.map((v) => catchUp.filter((a) => a.viewId === v).length)
  check(`${tag}: back on the tab, each panel catches up ONCE, at once`, caught.every((n) => n === 1), caught.join(','))
  before = (await asksAt(page)).length
  await forward(page, 30_000)
  check(`${tag}: … then the loop carries on`, (await asksAt(page)).length - before >= 4, String((await asksAt(page)).length - before))

  // ── Cross-filter still works in TV mode ──
  await page.locator('[data-board-panel="p-bar"] .recharts-bar-rectangle path').first().click()
  const crossed = await page.locator('[data-board-cross]').waitFor({ timeout: 5000 }).then(() => true, () => false)
  check(`${tag}: a bar click still cross-filters in TV mode`, crossed && new URL(page.url()).searchParams.has('cross'), page.url())
  await settled780(page)

  // ── Esc exits ──
  await page.keyboard.press('Escape')
  await page.locator('[data-analytics-board="b-ops"][data-analytics-tv="off"]').waitFor({ timeout: 5000 })
  const url = new URL(page.url())
  check(`${tag}: Esc exits TV mode: the shell is back, the strip's pickers are back`, (await page.locator('nav').count()) > 0 && (await page.locator('[data-board-filters]').count()) === 1 && (await page.locator('[data-shell="hidden"]').count()) === 0)
  check(`${tag}: … tv leaves the URL; the interval, filters and cross-filter stay`, !url.searchParams.has('tv') && url.searchParams.get('refresh') === '30s' && url.searchParams.get('region') === 'central' && url.searchParams.has('cross'), url.search)
  before = (await asksAt(page)).length
  await forward(page, 30_000)
  check(`${tag}: … and the board keeps refreshing outside TV mode`, (await asksAt(page)).length - before >= 4, String((await asksAt(page)).length - before))

  // ── The TV button goes back in, its exit button leaves ──
  await page.locator('[data-board-tv-enter]').click()
  await page.locator('[data-analytics-board="b-ops"][data-analytics-tv="on"]').waitFor({ timeout: 5000 })
  check(`${tag}: the TV mode button enters TV mode (tv=1 in the URL)`, new URL(page.url()).searchParams.get('tv') === '1')
  await page.locator('[data-board-tv-exit]').click()
  await page.locator('[data-analytics-board="b-ops"][data-analytics-tv="off"]').waitFor({ timeout: 5000 })
  check(`${tag}: … and its exit button leaves it`, !new URL(page.url()).searchParams.has('tv'))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function refreshChoice780() {
  const tag = '780'
  // The board's saved default: 1 min (saved in seconds, 777).
  const items = { ...ITEMS, 'b-ops': { ...ITEMS['b-ops'], definition: { ...ITEMS['b-ops'].definition, refresh: 60 } } }
  const { context, page, bodies, errors } = await open({ items })
  await page.clock.install({ time: new Date('2026-11-05T10:10:00') })
  await page.goto(`${BASE}/analytics/board/b-ops`)
  await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
  await settled780(page)
  const options = await page.locator('[data-board-refresh] option').evaluateAll((os) => os.map((o) => o.value))
  check(`${tag}: the picker offers Off, 30 s, 1 min, 5 min and 15 min`, JSON.stringify(options) === JSON.stringify(['off', '30s', '1m', '5m', '15m']), options.join(','))
  check(`${tag}: the board's saved default applies (1 min)`, (await page.locator('[data-board-refresh]').inputValue()) === '1m')
  let before = asks780(bodies)
  await forward(page, 60_000)
  check(`${tag}: … and re-asks every panel once a minute`, since(asks780(bodies), before).every((n) => n === 1), since(asks780(bodies), before).join(','))

  // The viewer picks Off: no more re-asks; the choice goes to the permalink, never to the board.
  await page.locator('[data-board-refresh]').selectOption('off')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('refresh') === 'off', null, { timeout: 5000 })
  await page.waitForTimeout(300)
  await settled780(page)
  before = asks780(bodies)
  await forward(page, 120_000)
  check(`${tag}: Off stops the loop`, sum(since(asks780(bodies), before)) === 0, since(asks780(bodies), before).join(','))
  check(`${tag}: … the choice goes to the permalink, and nothing is written to the board`, new URL(page.url()).searchParams.get('refresh') === 'off' && !Object.keys(bodies).some((k) => k.startsWith('PUT') || k === 'Analytics/Item'))

  // The viewer's choice lasts for the session: the bare board URL opens on it, not on the saved default.
  await page.locator('[data-board-refresh]').selectOption('5m')
  await page.goto(`${BASE}/analytics/board/b-ops`)
  await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
  check(`${tag}: the viewer's choice lasts for the session (5 min over the saved 1 min)`, (await page.locator('[data-board-refresh]').inputValue()) === '5m')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  // A new session (a fresh context) opens on the saved default again.
  const fresh = await open({ items })
  await fresh.page.goto(`${BASE}/analytics/board/b-ops`)
  await fresh.page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
  check(`${tag}: a new session opens on the board's saved default`, (await fresh.page.locator('[data-board-refresh]').inputValue()) === '1m')
  await fresh.context.close()

  // TV mode still needs a signed-in session: an anonymous wall screen lands on the login page.
  const anon = await open({})
  await anon.page.route('**/api/Auth/Me', (route) => route.fulfill(envelope({ authenticated: false })))
  await anon.page.goto(`${BASE}/analytics/board/b-ops?tv=1&refresh=30s`)
  await anon.page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {})
  const at = new URL(anon.page.url())
  check(`${tag}: a TV permalink without a session goes to the login page, which returns to the permalink`, at.pathname === '/login' && decodeURIComponent(at.searchParams.get('returnUrl') ?? '').includes('tv=1'), anon.page.url())
  await anon.context.close()
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
  ['773', () => panels773({ dir: 'ltr' })],
  ['773', () => panels773({ dir: 'rtl' })],
  ['773', () => panels773({ dir: 'ltr', dark: true })],
  ['773', () => viewActions773({ dir: 'ltr' })],
  ['774', () => detail774({ dir: 'ltr' })],
  ['774', () => detail774({ dir: 'rtl' })],
  ['775', () => editorBuildsQ8({ dir: 'ltr', dark: false })],
  ['775', () => editorBuildsQ8({ dir: 'rtl', dark: false })],
  ['775', () => editorBuildsQ8({ dir: 'ltr', dark: true })],
  ['775', editorSeededAndRefusals],
  ['776', () => savesTheirsAsMyCopy({ dir: 'ltr' })],
  ['776', () => savesTheirsAsMyCopy({ dir: 'rtl' })],
  ['776', savesMineInPlace],
  ['776', () => staleSaveConflicts({ dir: 'ltr' })],
  ['776', () => staleSaveConflicts({ dir: 'rtl' })],
  ['776', notYoursOffersCopy],
  ['776', tiersAndCopies],
  ['777', () => boardEditorBuilds({ dir: 'ltr' })],
  ['777', () => boardEditorBuilds({ dir: 'rtl' })],
  ['777', () => removedView({ dir: 'ltr' })],
  ['777', () => removedView({ dir: 'rtl' })],
  ['777', buildsNewView],
  ['779', () => revertsAndUndoes({ dir: 'ltr' })],
  ['779', () => revertsAndUndoes({ dir: 'rtl' })],
  ['779', historyOnlyForEditors],
  ['778', () => certifiesSharedBoard({ dir: 'ltr' })],
  ['778', () => certifiesSharedBoard({ dir: 'rtl' })],
  ['778', viewerSeesNoCertify],
  ['778', () => ownerSharesAndDeletes({ dir: 'ltr' })],
  ['778', () => ownerSharesAndDeletes({ dir: 'rtl' })],
  ['778', staleProbeCertify402],
  ['780', () => tvPermalink780({ dir: 'ltr' })],
  ['780', () => tvPermalink780({ dir: 'rtl' })],
  ['780', refreshChoice780],
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
