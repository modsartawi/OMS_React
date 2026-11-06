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
// 827 — a runner opens a report (spec 819 §E): the title and audience chip, the sections and their blocks in
//   order, each panel in v1's frame asking by report + panel with its bound values, no edit/TV/ask/cross-filter;
//   live figures filled from the Words door and isolated, no raw token; the summary written, then a failed check
//   dropping only it (and a missing figure's placeholder); the caveat and "may still rise" on report and board
//   panels; a period change re-asking panels and Words; Print carrying the values (A4, prints once idle);
//   a demo / non-report id is not found. en, ar and dark.
// 833 — an author schedules a report (spec 819 §E): the schedules dialog lists a suspended schedule with its reason
//   (a saved value no longer resolves, naming the parameter); a new daily schedule for Yesterday at 06:30 offers only
//   the candidates in the audience with the run grant and a company address (the others listed with why); a stubbed
//   ANALYTICS-414 names the third recipient; without them it saves the exact body; Send now posts and lands in the
//   kept runs; the runs list shows date, trigger, values, recipients and outcome, an artefact past 90 days as
//   "no longer kept", and a 410 on open turns a kept one to "no longer kept". en and ar.
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
// 822 (spec 819) — a runner sees no builder; the author grant unlocks it (en and ar):
//   1. a runner (`canView` without `canAuthor`, and a v1 answer with no `canAuthor` at all): the home has no
//      "New view" / "New board" and no ask box (the copilot granted); a view and a board show no Edit, history or
//      tier actions, but keep the panel's run, table, fullscreen, export and permalink, and the board its TV mode;
//      `/analytics/new?kind=view`, `?kind=board` and `/analytics/board/:id/edit` show the builder's no-access state;
//   2. an author sees them all, and the editor opens;
//   3. `ANALYTICS-415` on Share is worded, and the author's actions (Share, Edit) hide from then on.
//
// 826 (spec 819) — an author shares with roles and users; an outsider gets "not shared with you"; a curator
// narrows or reassigns (en and ar):
//   1. Share opens the dialog on Everyone; "Chosen" picks a role and, by employee id, a user (AudienceCandidates);
//      a deleted role is offered marked; Share posts `{ revision, audience }`; the chip names them on the view and
//      the home; a v1 Shared item reads "shared with everyone";
//   2. changing the audience PUTs `…/Audience` with no `baseRevision` and no item PUT; the history lists it;
//   3. `ANALYTICS-413` on a board link: "not shared with you", naming the owner (name `<bdi>`, id `Ltr`), no title,
//      no Query;
//   4. a curator: the chip marks the removed role; Narrow (Everyone off, only the audience's own entries, Unshare)
//      PUTs the narrower audience; Reassign posts `{ owner }`, the audience kept, the home lists the new owner.
//
// 823 (spec 819) — every parameter kind's control, the permalink, Reset and the notices (en and ar), on a board
// that carries its own parameters (`b-params`):
//   1. each panel asks `{ itemId, revision, panelId, values }` with only its bound parameters' values; the strip
//      draws all seven kinds; the author sees every "not filtered by …" on the line panel;
//   2. period, an open member search, a pinned one-value list, grain chips (allowed subset), a threshold (op +
//      number, in %), the top N stepper and typed value, a measure and a breakdown choice: each changes the URL
//      and re-keys only the panels it is bound to; a reload restores every value; Reset gives back the defaults;
//   3. a runner sees "not filtered by" only for what they moved; a link value outside a pinned list, and a
//      `fellBack` answer, show the fallback notice; a 412 names the parameter in the strip and marks its control.
//
// 828 (spec 819) — an author builds a report's structure in the designer (en and ar), in a 1440x1500 viewport so a
// drag never scrolls:
//   1. "New report" on the home opens `/analytics/new?kind=report`: outline, page and inspector; typing the title
//      is ONE undo step; three sections added and headed in the inspector;
//   2. a section dragged by its outline grip to the top (one step: Ctrl+Z puts it back, Ctrl+Y and Ctrl+Shift+Z
//      again), one dragged on the page by its heading grip; a text block added, dragged across sections in the
//      outline, and moved by the keyboard's up / down;
//   3. a section removed with no dialog: "Removed … · Undo" puts it back in its place; Redo removes it again;
//   4. Save posts `kind: 'report'` with the sections in order and opens `/analytics/report/r-new/edit` with the
//      history kept and the unsaved marker gone; a second save PUTs in place at `baseRevision` 1; Preview is the
//      runner's page with no tools.
//
// 829 (spec 819) — the designer edits every block (en and ar), building the 798 sample report by hand:
//   1. a chart or table is added and reshaped in the panel editor (net value by channel: only fitting types offered);
//      a saved view is copied ("copied from … revision 3", its series with it, `from` recorded); a cancellation
//      rate panel gets HungerStation and QC series by hand; the panel's parameter list unbinds and undoes;
//   2. a text block's words take live figures by "Insert a live figure" (and by typing a token): chips, never a raw
//      token, on the page, in the field and in the preview; an insert is one undo step;
//   3. the summary is added (a second is not offered), removed and undone;
//   4. removing a panel a figure names turns its chip red and Save lists the 411 problem, which opens the text;
//      undone, Save posts the panels, the series, the provenance, the tokens and one summary;
//   5. the sample report's copied panel says the original has changed since the copy.
//
// 830 (spec 819 §E) — Save as report: a runner is not offered it; an author on the 771 board saves it as a report
// (one POST `kind: 'report'`: the section panel the heading, the view panels inline in reading order with
// `from { viewId, revision }`, the text panel a text block, the parameters and bindings carried) and the designer
// opens on `/analytics/report/r-new/edit` holding the panels in order (en and ar).
//
// 832 (spec 819 §D) — the copilot builds a report that opens in the designer, and edits it there as one undo step
// (en and ar): the acceptance sentence (a stubbed `create_report`) answers "Open in designer", the assumptions as a
// list and "Built a report" in the trace, with no `reportContext` sent from the home; in the designer the follow-up
// "add the cancellation rate as a bar" sends the report in context `{ reportId, revision, draft }`, and its stubbed
// `reportEdit` lands as ONE step labelled "AI: …", unsaved and never PUT; Undo takes all of it back, Redo again.
//
// 831 (spec 819 §E) — the designer's tutorial (en and ar): "Tutorial" opens a checklist at the top of the inspector;
// a blank report ticks no step; built by hand, each step ticks itself from the draft (a KPI, one series, a rate with
// no series and words alone never do); a period moved off yesterday unticks. "Load the finished report" ticks all
// eight as one undo step; "Ask the copilot" sends the acceptance sentence to the copilot panel.
// 834 — spec 819's acceptance case end to end, in en, ar and dark (shots in `.issues/assets/834-shots/`):
//   1. the owner's sentence in the copilot answers with the report a stubbed `create_report` built;
//   2. "Open in designer" holds the expected report (the product's sample): the period defaulting to yesterday on
//      every panel, net sales by channel, HungerStation against QC for net sales and for the cancellation rate (its
//      caveat shown), the stores table, text with live figures; the tutorial ticks every step;
//   3. its page shares it with the team's roles (Share → chosen roles; the chip names them);
//   4. a daily schedule at 06:30 for Yesterday to two audience members, and Send now;
//   5. a runner (no author grant) sees no edit, share or schedule control, re-runs it for last week (every panel and
//      the Words re-asked, the URL carries it) and copies the link, which opens on last week;
//   6. the kept-run record of the send: its trigger, recipients, outcome, values, and the email it sent.
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. DRIVE_PORT=5201 node tools/analytics-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DELAYS_771, DELAYS_772, DELIVERIES_774, ITEMS, ITEMS_773, LIST, LIST_777, LIST_824, MODEL_773, NOT_SHARED_826, PANEL_IDS_773, QUERY, QUERY_773, QUERY_RETIRED, SEQUENCE_773, MODEL_825, MODEL_827, VIEW_825, CREATE_ANSWER_832, REPORT_832, CREATE_ANSWER_834, REPORT_834, editAnswer832, wordsAnswer827, wordsAnswer834, resolveAudience, envelope, inlineAnswer, installAnalyticsStubs, refusal } from './analytics-stubs.mjs'
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

/** A fresh page: `dir` 'ltr' | 'rtl' (`oms.locale`), `dark` (`oms.darkMode`), `height` (the viewport's), plus the stub options. */
async function open({ dir = 'ltr', dark = false, height = 900, ...stubs } = {}) {
  // `height`: 828's drag and drop needs a viewport tall enough that a drag never scrolls (Chromium drops a drag that does).
  const context = await browser.newContext({ viewport: { width: 1440, height } })
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

// ── 825 ──────────────────────────────────────────────────────────────────────────────────────────────
// Named series: HungerStation (channel = hungerstation) against QC (delivery_type = QC), in en, ar and dark.
//   1. a board's bar of the two series: each series in its own slot (--chart-1, --chart-2), distinct paints,
//      the legend naming both in the screen's language;
//   2. a legend click highlights that series (the other dims) and never cross-filters (no `cross=`, no chip,
//      no re-run); a bar click highlights its own series, and a second click clears;
//   3. the editor seeded with the view: the series fields hold both, donut and heatmap are not offered, the
//      preview draws two distinct bar series; KPI draws one tile per series side by side, each in its slot;
//   4. a fifth series is refused: "Add a series" stops at 4 and says so; a seeded fifth is listed and blocks the
//      save; the server's ANALYTICS-411 list reaches its series.
async function namedSeries825({ dir, dark }) {
  const tag = `825 ${dir}${dark ? '-dark' : ''}`
  const problems = [{ what: 'series', why: 'foreignDimension', series: 'qc', dimension: 'delivery_type' }]
  const { context, page, errors, bodies } = await open({
    dir,
    dark,
    model: MODEL_825,
    create: envelope({ problems }, { status: 400, success: false, message: 'Not saved.', errors: [{ errorCode: 'ANALYTICS-411', internalErrorCode: '', errorMessage: 'Not saved.' }] }),
  })
  const want = ['var(--chart-1)', 'var(--chart-2)']
  // The language stays en under RTL (`core/i18n`: `lng` is en; the direction follows `oms.locale`), so labels read in English.
  const names = ['HungerStation', 'QC']

  // 1. The board panel.
  await page.goto(`${BASE}/analytics/board/b-825`)
  const panelSel = '[data-board-panel="p-series"]'
  const sel = `${panelSel} [data-chart="bar"]`
  await page.locator(sel).waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  const groups = () =>
    page.locator(`${sel} .recharts-bar`).evaluateAll((gs) =>
      gs.map((g) => [...g.querySelectorAll('.recharts-bar-rectangle path')].map((p) => ({ fill: p.getAttribute('fill'), opacity: p.getAttribute('fill-opacity'), paint: getComputedStyle(p).fill }))),
    )
  const series = await groups()
  const paints = [await tokenPaint(page, '--chart-1'), await tokenPaint(page, '--chart-2')]
  check(`${tag}: the board's bar draws two series of seven days`, series.length === 2 && series.every((g) => g.length === 7), series.map((g) => g.length).join(' + '))
  check(`${tag}: HungerStation in slot 1, QC in slot 2`, series.length === 2 && series.every((g, i) => g.every((b) => b.fill === want[i])), JSON.stringify(series.map((g) => [...new Set(g.map((b) => b.fill))])))
  check(`${tag}: the two series paint distinct ${dark ? 'dark' : 'light'} colours`, series.length === 2 && series.every((g, i) => g.every((b) => b.paint === paints[i])) && paints[0] !== paints[1], JSON.stringify(paints))
  const legend = page.locator(`${sel} .recharts-legend-item`)
  const legendText = (await legend.allInnerTexts()).map((x) => noIsolates(x).trim())
  check(`${tag}: the legend names both series`, JSON.stringify(legendText) === JSON.stringify(names), JSON.stringify(legendText))
  const posts = () => (bodies['Analytics/Query'] ?? []).length
  const asked = posts()
  const highlight = () => page.locator(`${panelSel} [data-chart-highlight]`).getAttribute('data-chart-highlight')

  // 2. Highlight, never cross-filter.
  await legend.nth(1).click()
  await page.waitForTimeout(200)
  const lit = await highlight()
  const dimmed = await groups()
  check(`${tag}: a legend click highlights QC`, lit === 's1', lit)
  check(
    `${tag}: … HungerStation dims, QC stays full, both keep their colours`,
    dimmed[0]?.every((b) => b.opacity === '0.25') && dimmed[1]?.every((b) => b.opacity === '1') && dimmed.every((g, i) => g.every((b) => b.fill === want[i])),
    JSON.stringify(dimmed.map((g) => g[0])),
  )
  const noCross = async () => !new URL(page.url()).searchParams.has('cross') && (await page.locator('[data-board-cross]').count()) === 0
  check(`${tag}: … and never cross-filters (no cross= in the link, no chip, no re-run)`, (await noCross()) && posts() === asked, `${page.url()} posts ${asked}→${posts()}`)
  await page.locator(`${sel} .recharts-bar`).first().locator('.recharts-bar-rectangle').first().click()
  await page.waitForTimeout(200)
  check(`${tag}: a bar click highlights its own series, still no cross-filter`, (await highlight()) === 's0' && (await noCross()), `${await highlight()} ${page.url()}`)
  await legend.nth(0).click()
  await page.waitForTimeout(200)
  check(`${tag}: clicking the highlighted series again clears it`, (await highlight()) === '')
  await page.screenshot({ path: `${SHOTS}/825-board-${dir}${dark ? '-dark' : ''}.png` })

  // 3. The editor, seeded with the view.
  const seedEditor = async (definition) => {
    await page.goto(`${BASE}/analytics`)
    await page.locator('[data-analytics-home-header]').waitFor({ timeout: 10000 })
    await page.evaluate((seed) => {
      window.history.pushState({ usr: { editorSeed: seed }, key: 'seed825', idx: 1 }, '', '/analytics/new?kind=view')
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, { definition })
    await page.locator('[data-analytics-editor]').waitFor({ timeout: 10000 })
  }
  await seedEditor(VIEW_825)
  check(`${tag}: the editor holds both series`, (await page.locator('[data-editor-series-row]').count()) === 2)
  const off = await page.locator('[data-analytics-choice][data-offered="no"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-analytics-choice')))
  check(`${tag}: donut and heatmap take no series; a stacked bar is never offered`, ['donut', 'heatmap', 'bar-stacked'].every((c) => off.includes(c)), off.join(','))
  const pre = '[data-analytics-preview] [data-chart="bar"]'
  await page.locator(`${pre} .recharts-bar-rectangle path`).first().waitFor({ timeout: 10000 })
  const preFills = await page
    .locator(`${pre} .recharts-bar`)
    .evaluateAll((gs) => gs.map((g) => [...new Set([...g.querySelectorAll('.recharts-bar-rectangle path')].map((p) => p.getAttribute('fill')))]))
  check(`${tag}: the preview's bar draws HungerStation and QC in distinct slots`, JSON.stringify(preFills) === JSON.stringify(want.map((w) => [w])), JSON.stringify(preFills))
  const lastQuery = (bodies['Analytics/Query'] ?? []).at(-1)
  check(
    `${tag}: the preview asks with both series and their filters`,
    JSON.stringify(lastQuery?.definition?.series?.map((x) => x.filters[0])) ===
      JSON.stringify([{ dimension: 'channel_group', values: ['hungerstation'] }, { dimension: 'delivery_type', values: ['QC'] }]),
    JSON.stringify(lastQuery?.definition?.series),
  )

  await page.locator('[data-analytics-choice="kpi"]').click()
  const tiles = page.locator('[data-analytics-preview] [data-kpi-series="2"] [data-kpi-series-id]')
  await tiles.first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
  const tileInfo = await tiles.evaluateAll((els) =>
    els.map((el) => ({
      slot: el.getAttribute('data-slot'),
      swatch: getComputedStyle(el.querySelector('[data-kpi-swatch]')).backgroundColor,
      value: el.querySelector('[data-kpi-value]')?.textContent?.trim(),
      top: Math.round(el.getBoundingClientRect().top),
    })),
  )
  check(`${tag}: the KPI shows one figure per series, side by side`, tileInfo.length === 2 && tileInfo[0].top === tileInfo[1].top && tileInfo.every((x) => !!x.value), JSON.stringify(tileInfo))
  check(`${tag}: … each tile in its own series colour`, tileInfo[0]?.slot === '0' && tileInfo[1]?.slot === '1' && tileInfo[0].swatch !== tileInfo[1].swatch, JSON.stringify(tileInfo.map((x) => x.swatch)))
  const figures = tileInfo.map((x) => x.value)
  check(
    `${tag}: … each its own figure, with no total across them`,
    figures.length === 2 && figures[0] !== figures[1] && (await page.locator('[data-analytics-preview] [data-chart="kpi"]').count()) === 2,
    JSON.stringify(figures),
  )
  await page.screenshot({ path: `${SHOTS}/825-kpi-${dir}${dark ? '-dark' : ''}.png`, fullPage: true })

  // 4. A fifth series is refused.
  const add = page.locator('[data-editor-add-series]')
  await add.click()
  await add.click()
  check(
    `${tag}: four series, and "Add a series" stops there and says why`,
    (await page.locator('[data-editor-series-row]').count()) === 4 && (await add.isDisabled()) && (await page.locator('[data-editor-series-max]').count()) === 1,
  )
  await page.locator('[data-editor-save]').click()
  await page.locator('[data-editor-series-problem="foreignDimension"]').waitFor({ timeout: 10000 })
  const said = noIsolates(await page.locator('[data-editor-series-problem="foreignDimension"]').innerText())
  check(`${tag}: the server's ANALYTICS-411 is listed on its series`, said.includes(names[1]), said)
  const saved = (bodies['Analytics/Item'] ?? []).at(-1)
  check(`${tag}: the save sent the four series`, saved?.definition?.series?.length === 4, JSON.stringify(saved?.definition?.series?.map((x) => x.id)))
  await page.screenshot({ path: `${SHOTS}/825-editor-${dir}${dark ? '-dark' : ''}.png`, fullPage: true })

  const five = { ...VIEW_825, series: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, label: { en: id, ar: id }, filters: [] })) }
  await seedEditor(five)
  await page.locator('[data-editor-series-problem="tooMany"]').waitFor({ timeout: 10000 })
  check(`${tag}: a seeded fifth series is refused: listed, and the save is blocked`, await page.locator('[data-editor-save]').isDisabled())

  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 820 ──────────────────────────────────────────────────────────────────────────────────────────────
// A board's two-measure bar: each series in its own slot (orders --chart-1, deliveries --chart-2), the
// legend swatches matching, in en, ar and dark. Before 820 every bar carried its row's slot-0 fill.
async function multiSeriesBars820({ dir, dark }) {
  const tag = `820 ${dir}${dark ? '-dark' : ''}`
  const { context, page, errors } = await open({ dir, dark })
  await page.goto(`${BASE}/analytics/board/b-820`)
  const sel = '[data-board-panel="p-bars"] [data-chart="bar"]'
  await page.locator(sel).waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  const series = await page.locator(`${sel} .recharts-bar`).evaluateAll((groups) =>
    groups.map((g) => [...g.querySelectorAll('.recharts-bar-rectangle path')].map((p) => ({ fill: p.getAttribute('fill'), paint: getComputedStyle(p).fill }))),
  )
  const want = ['var(--chart-1)', 'var(--chart-2)']
  const paints = [await tokenPaint(page, '--chart-1'), await tokenPaint(page, '--chart-2')]
  check(`${tag}: two bar series of five bars each`, series.length === 2 && series.every((s) => s.length === 5), series.map((s) => s.length).join(' + '))
  check(`${tag}: each series draws every bar in its own slot`, series.length === 2 && series.every((s, i) => s.every((b) => b.fill === want[i])), JSON.stringify(series.map((s) => [...new Set(s.map((b) => b.fill))])))
  check(`${tag}: the two series paint distinct ${dark ? 'dark' : 'light'} colours`, series.length === 2 && series.every((s, i) => s.every((b) => b.paint === paints[i])) && paints[0] !== paints[1], JSON.stringify(paints))
  const legend = await page.locator(`${sel} .recharts-legend-item`).evaluateAll((items) =>
    items.map((li) => ({ text: li.textContent.trim(), fill: li.querySelector('path, rect')?.getAttribute('fill') ?? li.querySelector('path, rect')?.getAttribute('stroke') })),
  )
  check(`${tag}: the legend's swatches match the series`, legend.length === 2 && legend.every((l, i) => l.fill === want[i]), JSON.stringify(legend))
  await page.screenshot({ path: `${SHOTS}/820-board-${dir}${dark ? '-dark' : ''}.png` })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

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
  // 826: a curator also narrows a Shared item's audience and reassigns it.
  check(`${tag}: a Shared board of someone else's offers Narrow, Reassign and Certify (no share, no delete)`, JSON.stringify(await tierActionsOn(page)) === '["narrow","reassign","certify"]', JSON.stringify(await tierActionsOn(page)))

  await page.locator('[data-analytics-action="certify"]').click()
  await page.locator('[data-analytics-certified-copy="b-shared-cert"]').waitFor({ timeout: 10000 })
  await page.locator('[data-analytics-action="certifyRevision"]').waitFor({ timeout: 10000 })
  const sent = bodies['Analytics/Item/b-shared/Certify']?.[0]
  check(`${tag}: Certify posts the revision on screen`, sent?.revision === 7, JSON.stringify(sent))
  check(`${tag}: once certified, Certify becomes "Certify this revision" into the copy`, JSON.stringify(await tierActionsOn(page)) === '["narrow","reassign","certifyRevision"]')
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
  check(`${tag}: the certified board shows the Certified badge, and offers Un-certify and Delete`, JSON.stringify(await tierActionsOn(page)) === '["reassign","uncertify","delete"]', JSON.stringify(await tierActionsOn(page)))
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

  // 826: Share opens the share dialog, on Everyone (v1's share) until the owner chooses.
  await page.locator('[data-analytics-action="share"]').click()
  await page.locator('[data-analytics-share-save]').click()
  await badge('shared').waitFor({ timeout: 10000 })
  await page.locator('[data-analytics-action="unshare"]').waitFor({ timeout: 10000 })
  check(`${tag}: Share with everyone: the view is Shared and offers Share (its audience), Unshare`, JSON.stringify(await tierActionsOn(page)) === '["share","unshare","delete"]', JSON.stringify(await tierActionsOn(page)))
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
    ['board/b-ops', '[data-board-panel]', { canView: true, canAuthor: true, canCurate: false }, false, "a Certified board, not a curator"],
    ['board/b-ops', '[data-board-panel]', { canView: true, canCurate: true }, true, 'a Certified board, as a curator'],
    ['view/v-theirs-shared', '[data-analytics-view] [data-analytics-view-title]', { canView: true, canAuthor: true, canCurate: false }, false, "someone else's Shared view"],
    ['view/v-mine-shared', '[data-analytics-view] [data-analytics-view-title]', { canView: true, canAuthor: true, canCurate: false }, true, 'my own Shared view'],
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

  // 4. The store parameter left off the bar (824: in the parameter inspector — v1's opt-out is saved beside
  // the binding), the words, the refresh; then save.
  await page.locator('[data-board-param-edit="store"]').click()
  await page.locator(`[data-param-inspector="store"] [data-param-binding="${bar}"] button`).first().click()
  await page.locator('[data-param-inspector-close]').click()
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

/**
 * Review fix 12 (766 §B: "a definition that still names a removed member renders a 'this measure was retired'
 * panel and never fails the board"; story 86): a panel whose view names a measure gone from the model is the
 * retired state and is never asked; a 406 naming the field is the same state; the other panel draws; neither
 * title shows the raw key.
 */
async function retiredPanels({ dir }) {
  const tag = `review ${dir} retired`
  const { context, page, bodies, errors } = await open({ dir, query: { ...QUERY, ...QUERY_RETIRED } })
  await page.goto(`${BASE}/analytics/board/b-retired`)
  await page.locator('[data-board-panel="p-retired"]').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-bar"]')?.dataset.boardPanelState === 'idle', null, { timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('[data-board-panel="p-406"]')?.dataset.boardPanelState === 'retired', null, { timeout: 10000 }).catch(() => {})
  const state = async (id) => page.locator(`[data-board-panel="${id}"]`).getAttribute('data-board-panel-state')
  const words = async (id) => noIsolates(await page.locator(`[data-board-panel="${id}"]`).innerText())
  check(`${tag}: a view naming a measure gone from the model is the retired state`, (await state('p-retired')) === 'retired' && (await words('p-retired')).includes('This measure was retired'), await words('p-retired'))
  check(`${tag}: … and is never asked`, !(bodies['Analytics/Query'] ?? []).some((b) => b.viewId === 'v-retired'), JSON.stringify((bodies['Analytics/Query'] ?? []).map((b) => b.viewId)))
  check(`${tag}: … its title names a retired measure, never the raw key`, !(await words('p-retired')).includes('retired_orders') && (await words('p-retired')).includes('Retired measure'), await words('p-retired'))
  check(`${tag}: a 406 naming the field is the retired state too`, (await state('p-406')) === 'retired' && (await page.locator('[data-board-panel="p-406"] [data-panel-retired="query.measures[0]"]').count()) === 1, await words('p-406'))
  check(`${tag}: the rest of the board still draws`, (await page.locator('[data-board-panel="p-bar"] [data-chart]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/review-retired-${dir}.png`, fullPage: true })
  await page.goto(`${BASE}/analytics/view/v-retired`)
  await page.locator('[data-analytics-view="v-retired"]').waitFor({ timeout: 10000 })
  check(`${tag}: the view page shows the retired state too`, (await page.locator('[data-analytics-view="v-retired"]').getAttribute('data-board-panel-state')) === 'retired')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/**
 * Review fix 11 (766 story 23: "compare a period with the one before it"; §C `compareToPrevious`): the editor
 * offers the compare where the type shows it (KPI, line) and not elsewhere; the definition stores it and every
 * Query asks it; a KPI built in the editor shows its ▲▼ in the preview and on its saved view page; a line draws
 * the previous period dashed.
 */
async function compare766({ dir }) {
  const tag = `review ${dir} compare`
  const { context, page, bodies, errors } = await open({ dir })
  await page.goto(`${BASE}/analytics/new?kind=view`)
  await page.locator('[data-analytics-editor]').waitFor({ timeout: 10000 })
  await pick(page, 'editor-measures', ['orders'])
  await pick(page, 'editor-dimensions', ['day'])
  await page.locator('[data-analytics-choice="table"]').click()
  check(`${tag}: a table offers no compare`, (await page.locator('[data-editor-compare]').count()) === 0)
  await page.locator('[data-analytics-choice="kpi"]').click()
  const toggle = page.locator('[data-editor-compare]')
  await toggle.waitFor({ timeout: 5000 })
  check(`${tag}: a KPI offers the compare, off`, (await toggle.getAttribute('data-editor-compare')) === 'off')
  await toggle.click()
  const delta = page.locator('[data-analytics-preview] [data-kpi-delta]')
  await delta.waitFor({ timeout: 10000 }).catch(() => {})
  const asked = bodies['Analytics/Query']?.at(-1)
  check(`${tag}: the preview asks Query with compareToPrevious, stored in the definition`, asked?.compareToPrevious === true && asked?.definition?.query?.compareToPrevious === true, JSON.stringify(asked))
  check(`${tag}: the preview KPI shows its ▲▼ on the previous period`, (await delta.getAttribute('data-kpi-delta').catch(() => null)) === 'up')

  await page.locator('[data-analytics-choice="line"]').click()
  const dashed = page.locator('[data-analytics-preview] [data-chart="line"] .recharts-line-curve[stroke-dasharray]')
  await dashed.first().waitFor({ timeout: 10000 }).catch(() => {})
  const legend = (await page.locator('[data-analytics-preview] .recharts-legend-item').allInnerTexts()).map((s) => s.trim())
  check(`${tag}: a line draws the previous period dashed, named in the legend`, (await dashed.count()) === 1 && legend.includes('Previous period'), legend.join(', '))

  await page.locator('[data-analytics-choice="kpi"]').click()
  await delta.waitFor({ timeout: 10000 }).catch(() => {})
  await page.locator('[data-editor-save]').click()
  await page.waitForURL('**/analytics/view/v-new', { timeout: 10000 })
  check(`${tag}: the saved definition compares to the previous period`, bodies['Analytics/Item']?.at(-1)?.definition?.query?.compareToPrevious === true)
  const saved = page.locator('[data-analytics-view="v-new"] [data-kpi-delta]')
  await saved.waitFor({ timeout: 10000 }).catch(() => {})
  const viewAsk = (bodies['Analytics/Query'] ?? []).filter((b) => b.viewId === 'v-new').at(-1)
  check(`${tag}: the view page asks its view with compareToPrevious`, viewAsk?.compareToPrevious === true, JSON.stringify(viewAsk))
  check(`${tag}: the editor-built KPI shows ▲▼ on its own page`, (await saved.getAttribute('data-kpi-delta').catch(() => null)) === 'up')
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

// ── 785 ──────────────────────────────────────────────────────────────────────────────────────────────
// 785 — curators see how Cube and the dbt runs are going (BackOffice 3386's `GET Analytics/Health`):
//   1. a viewer (no curator grant): no status card, and the home never asks Analytics/Health;
//   2. a curator, everything fresh: "Cube is up and the marts are fresh", Cube Ready, Marts Fresh, the last good run
//      with its minutes, the last run "Intraday · Succeeded", the image version;
//   3. stale (the container's 503 body): the warning headline, Marts Behind, the last run refused by the gate;
//   4. no answer: the unreachable headline and no detail rows; a 402 refusal is said in words.
const STALE_785 = {
  status: 'fail',
  version: '1.0.0',
  cube: 'ready',
  marts: { status: 'stale', lastGoodRunAtRiyadh: '2026-11-05 07:15:03', minutesSince: 157, maxMinutes: 45, lastRun: 'intraday stale_source at 2026-11-05 09:30:04' },
  checkedAt: '2026-11-05T09:52:00',
}

async function status785({ dir = 'ltr', dark = false } = {}) {
  const tag = `785 ${dir}${dark ? ' dark' : ''}`
  {
    const { context, page, calls } = await open({ dir, dark })
    await page.goto(`${BASE}/analytics`)
    await page.locator('[data-analytics-group]').first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    check(`${tag}: a viewer sees no status card`, (await page.locator('[data-analytics-status]').count()) === 0)
    check(`${tag}: … and the home never asks Analytics/Health`, !calls.includes('Analytics/Health'), calls.join(','))
    await context.close()
  }
  const curator = { canView: true, canCurate: true }
  {
    const { context, page, errors } = await open({ dir, dark, access: curator })
    await page.goto(`${BASE}/analytics`)
    const card = page.locator('[data-analytics-status]')
    await card.locator('[data-analytics-status-headline]').waitFor({ timeout: 10000 })
    const text = clean(await card.innerText())
    check(`${tag}: fresh: the ok headline`, (await card.locator('[data-analytics-status-headline]').getAttribute('data-analytics-status-headline')) === 'ok', text)
    check(`${tag}: … Cube ready, marts fresh`, (await card.locator('[data-analytics-status-cube="ready"]').count()) === 1 && (await card.locator('[data-analytics-status-marts="fresh"]').count()) === 1)
    if (dir === 'ltr') check(`${tag}: … the words`, ['Cube is up and the marts are fresh', 'Ready', 'Fresh', '7 min ago', 'Intraday', 'Succeeded', '1.0.0', '09:45'].every((w) => text.includes(w)), text)
    // The app's language is still English (i18n `lng: 'en'`); under rtl only the direction flips.
    else check(`${tag}: … the page is RTL with the same words`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl' && ['Cube is up and the marts are fresh', 'Intraday', 'Succeeded'].every((w) => text.includes(w)), text)
    const runTime = await card.locator('[data-analytics-status-last-run] bdi[dir="ltr"]').last().innerText()
    check(`${tag}: … the run time is one LTR isolate (date · time)`, /09:45/.test(runTime) && /2026/.test(runTime), runTime)
    await page.screenshot({ path: `${SHOTS}/785-fresh-${dir}${dark ? '-dark' : ''}.png` })
    check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page } = await open({ dir, dark, access: curator, health: STALE_785 })
    await page.goto(`${BASE}/analytics`)
    const card = page.locator('[data-analytics-status]')
    await card.locator('[data-analytics-status-headline]').waitFor({ timeout: 10000 })
    const text = clean(await card.innerText())
    check(`${tag}: stale: the behind headline, a warning`, (await card.locator('[data-analytics-status-headline="behind"]').count()) === 1 && (await card.locator('[data-analytics-status-tone="warn"]').count()) === 1, text)
    check(`${tag}: … the last run refused by the freshness gate`, (await card.locator('[data-analytics-status-last-run="stale_source"]').count()) === 1, text)
    if (dir === 'ltr') check(`${tag}: … the words`, ['The marts are behind', 'Behind', '157 min ago', '(allowed 45 min)', 'Refused: the POS replica was behind'].every((w) => text.includes(w)), text)
    await page.screenshot({ path: `${SHOTS}/785-stale-${dir}${dark ? '-dark' : ''}.png` })
    await context.close()
  }
  if (dir === 'ltr' && !dark) {
    {
      const { context, page } = await open({ access: curator, health: { status: 'unreachable', checkedAt: '2026-11-05T09:52:00' } })
      await page.goto(`${BASE}/analytics`)
      const card = page.locator('[data-analytics-status]')
      await card.locator('[data-analytics-status-headline]').waitFor({ timeout: 10000 })
      check(`${tag}: no answer: the unreachable headline, no detail rows`, (await card.locator('[data-analytics-status-headline="unreachable"]').count()) === 1 && (await card.locator('dl').count()) === 0, clean(await card.innerText()))
      await context.close()
    }
    {
      const { context, page } = await open({ access: curator, health: refusal('ANALYTICS-402', 'The analytics status needs the analytics curator grant.') })
      await page.goto(`${BASE}/analytics`)
      const failed = page.locator('[data-analytics-status-failed]')
      await failed.waitFor({ timeout: 10000 })
      check(`${tag}: a refusal is said in words`, clean(await failed.innerText()).length > 0, clean(await failed.innerText()))
      await context.close()
    }
  }
}

// ── 822 ──────────────────────────────────────────────────────────────────────────────────────────────
const RUNNER = { canView: true, canAuthor: false, canCurate: false }
const AUTHOR = { canView: true, canAuthor: true, canCurate: false }
const noBuilder = (page) => page.getByRole('alert').filter({ hasText: /analytics builder|منشئ التحليلات/ })

async function runnerSeesNoBuilder({ dir = 'ltr', access = RUNNER, label = 'runner' } = {}) {
  const tag = `822 ${label} ${dir}`
  const { context, page, errors } = await open({ dir, access, copilot: 'granted' })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-item]').first().waitFor({ timeout: 15000 })
  // The copilot is granted (its top-bar button shows), so a missing ask box is the author grant's doing.
  await page.locator('[data-copilot-button]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
  check(`${tag}: the home lists items`, (await page.locator('[data-analytics-item]').count()) > 0)
  check(`${tag}: … no "New view"`, (await page.locator('[data-analytics-new-view]').count()) === 0)
  check(`${tag}: … no "New board"`, (await page.locator('[data-analytics-new-board]').count()) === 0)
  check(`${tag}: … no ask box (though the copilot is granted)`, (await page.locator('[data-analytics-ask]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/822-${label}-home-${dir}.png` })

  await page.goto(`${BASE}/analytics/view/v-mine-shared`)
  await page.locator('[data-analytics-view][data-board-panel-state="idle"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  check(`${tag}: my own Shared view shows no Edit`, (await page.locator('[data-analytics-edit]').count()) === 0)
  check(`${tag}: … no history`, (await page.locator('[data-analytics-history-open]').count()) === 0)
  check(`${tag}: … no tier actions (share, unshare, certify, delete)`, (await page.locator('[data-analytics-action]').count()) === 0)
  const kept = await page.locator('[data-panel-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-panel-action')))
  check(`${tag}: … but keeps run, table, fullscreen, export and permalink`, ['refresh', 'table', 'fullscreen', 'csv', 'xlsx', 'png', 'permalink'].every((a) => kept.includes(a)), kept.join(','))
  await page.screenshot({ path: `${SHOTS}/822-${label}-view-${dir}.png` })

  await page.goto(`${BASE}/analytics/board/b-shared`)
  await page.locator('[data-board-panel="p-kpi"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  check(`${tag}: a board shows no Edit`, (await page.locator('[data-analytics-board-edit]').count()) === 0)
  check(`${tag}: … no ask box`, (await page.locator('[data-analytics-ask]').count()) === 0)
  check(`${tag}: … no tier actions`, (await page.locator('[data-analytics-action]').count()) === 0)
  check(`${tag}: … but keeps TV mode`, (await page.locator('[data-board-tv-enter]').count()) === 1)

  for (const route of ['new?kind=view', 'new?kind=board', 'board/b-shared/edit']) {
    await page.goto(`${BASE}/analytics/${route}`)
    await noBuilder(page).waitFor({ timeout: 10000 }).catch(() => {})
    check(`${tag}: /analytics/${route} shows the builder's no-access state`, (await noBuilder(page).count()) === 1)
    check(`${tag}: … and no editor`, (await page.locator('[data-analytics-editor], [data-board-editor]').count()) === 0)
  }
  await page.screenshot({ path: `${SHOTS}/822-${label}-new-${dir}.png` })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function authorSeesBuilder({ dir = 'ltr' } = {}) {
  const tag = `822 author ${dir}`
  const { context, page, errors } = await open({ dir, access: AUTHOR, copilot: 'granted' })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-ask]').waitFor({ timeout: 15000 }).catch(() => {})
  check(`${tag}: the home has "New view"`, (await page.locator('[data-analytics-new-view]').count()) === 1)
  check(`${tag}: … "New board"`, (await page.locator('[data-analytics-new-board]').count()) === 1)
  check(`${tag}: … and the ask box`, (await page.locator('[data-analytics-ask]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/822-author-home-${dir}.png` })

  await page.goto(`${BASE}/analytics/view/v-mine-shared`)
  await page.locator('[data-analytics-edit]').waitFor({ timeout: 15000 }).catch(() => {})
  check(`${tag}: my own Shared view shows Edit`, (await page.locator('[data-analytics-edit]').count()) === 1)
  await page.locator('[data-analytics-action="unshare"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${tag}: … and its tier actions`, (await page.locator('[data-analytics-action="unshare"]').count()) === 1)

  await page.goto(`${BASE}/analytics/board/b-shared`)
  await page.locator('[data-board-panel="p-kpi"]').waitFor({ timeout: 15000 })
  check(`${tag}: a board shows the ask box`, (await page.locator('[data-analytics-ask]').count()) === 1)

  await page.goto(`${BASE}/analytics/new?kind=view`)
  await page.locator('[data-analytics-editor]').waitFor({ timeout: 15000 }).catch(() => {})
  check(`${tag}: /analytics/new opens the editor`, (await page.locator('[data-analytics-editor]').count()) === 1)
  check(`${tag}: … with no no-access state`, (await noBuilder(page).count()) === 0)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 826 ──────────────────────────────────────────────────────────────────────────────────────────────
/** The chip's words, without isolates. */
const chipText = async (scope) => noIsolates(await scope.locator('[data-analytics-audience]').first().innerText())
/** Type into a MultiSelect's search (a server search), wait for the option, tick it, close the panel. */
async function searchPick(page, testId, query, value) {
  const root = page.locator(`[data-testid="${testId}"]`)
  await root.locator('[data-multi-select-trigger]').click()
  // The search is debounced: wait for the door to be asked for what was typed.
  const asked = page.waitForRequest((r) => r.url().includes('Analytics/AudienceCandidates') && new URL(r.url()).searchParams.get('search') === query, { timeout: 10000 })
  await root.locator('input').first().fill(query)
  await asked
  await root.locator(`[data-option="${value}"] input[type="checkbox"]`).check({ timeout: 10000 })
  await page.keyboard.press('Escape')
}

/**
 * 826 — an author shares with a role and a user: my Personal view's Share opens the dialog; "Chosen" picks
 * Delivery operations and, by employee id, Khalid; Share posts `{ revision, audience }`; the chip names them on the
 * view and the home. Changing the audience goes through `PUT …/Audience` with no `baseRevision` (never 405), and
 * the history lists the change.
 */
async function sharesWithAudience826({ dir }) {
  const tag = `826 ${dir} share`
  const { context, page, errors, bodies, gets } = await open({ dir, access: AUTHOR })
  await page.goto(`${BASE}/analytics/view/v-bar`)
  await page.locator('[data-analytics-action="share"]').waitFor({ timeout: 15000 })
  check(`${tag}: a Personal view carries no audience chip`, (await page.locator('[data-analytics-audience]').count()) === 0)
  await page.locator('[data-analytics-action="share"]').click()
  await page.locator('[data-analytics-share="share"]').waitFor({ timeout: 5000 })
  check(`${tag}: the dialog opens on Everyone`, (await page.locator('[data-analytics-share-everyone]').getAttribute('aria-pressed')) === 'true')
  await page.locator('[data-analytics-share-chosen]').click()
  const roles = page.locator('[data-testid="analytics-share-roles"]')
  await roles.locator('[data-multi-select-trigger]').click()
  await roles.locator('[data-option="OLD_ECOM"]').waitFor({ timeout: 10000 })
  const oldRole = await roles.locator('[data-option="OLD_ECOM"]').innerText()
  check(`${tag}: a deleted role is offered marked "removed"`, /removed|أزيل/.test(oldRole), oldRole)
  await roles.locator('[data-option="DELIVERY_OPS"] input[type="checkbox"]').check()
  await page.keyboard.press('Escape')
  await searchPick(page, 'analytics-share-users', '10551', 'kalotaibi')
  const asked = (gets['Analytics/AudienceCandidates'] ?? []).map((g) => g.search)
  check(`${tag}: the people picker searches AudienceCandidates by employee id`, asked.includes('10551'), JSON.stringify(asked))
  await page.screenshot({ path: `${SHOTS}/826-${dir}-share-dialog.png` })
  await page.locator('[data-analytics-share-save]').click()
  await page.locator('[data-analytics-view="v-bar"] [data-analytics-tier-badge="shared"]').waitFor({ timeout: 10000 })
  const sent = bodies['Analytics/Item/v-bar/Share']?.[0]
  check(`${tag}: Share posts the revision and the audience`, JSON.stringify(sent) === JSON.stringify({ revision: 3, audience: { roles: ['DELIVERY_OPS'], users: ['kalotaibi'] } }), JSON.stringify(sent))
  const view = page.locator('[data-analytics-view="v-bar"]')
  await view.locator('[data-analytics-audience="chosen"]').waitFor({ timeout: 10000 })
  const chip = await chipText(view)
  // The role reads in the page's language (the drive's rtl may keep the en bundle).
  check(`${tag}: the view's chip names the role and the user`, /Delivery operations|عمليات التوصيل/.test(chip) && chip.includes('Khalid Alotaibi'), chip)
  check(`${tag}: … each name isolated`, (await view.locator('[data-analytics-audience-name] bdi').count()) === 2)

  // The owner changes the audience: the Audience door, not a revision.
  await page.locator('[data-analytics-action="share"]').click()
  await page.locator('[data-analytics-share="share"]').waitFor({ timeout: 5000 })
  await searchPick(page, 'analytics-share-roles', 'HQ', 'HQ_SALES')
  await page.locator('[data-analytics-share-save]').click()
  await page.locator('[data-analytics-share]').waitFor({ state: 'detached', timeout: 10000 })
  const put = bodies['PUT Analytics/Item/v-bar/Audience']?.[0]
  check(`${tag}: changing a Shared item's audience PUTs …/Audience with no baseRevision`, JSON.stringify(put) === JSON.stringify({ audience: { roles: ['DELIVERY_OPS', 'HQ_SALES'], users: ['kalotaibi'] } }), JSON.stringify(put))
  check(`${tag}: … and no item PUT (no definition revision, so no ANALYTICS-405)`, !bodies['PUT Analytics/Item/v-bar'])
  await view.locator('[data-analytics-audience-name="HQ_SALES"]').waitFor({ timeout: 10000 })
  check(`${tag}: … the chip follows`, (await view.locator('[data-analytics-audience-name]').count()) === 3)
  await page.locator('[data-analytics-history-open]').click()
  await page.locator('[data-analytics-history-event="audience"]').first().waitFor({ timeout: 10000 })
  check(`${tag}: the history lists the audience change above revision 3`, (await page.locator('[data-analytics-revision]').first().getAttribute('data-analytics-revision')) === '3')
  check(`${tag}: … and it cannot be reverted to`, (await page.locator('[data-analytics-history-event] [data-analytics-revert]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/826-${dir}-history.png` })
  await page.keyboard.press('Escape')

  await page.goto(`${BASE}/analytics`)
  await homeRow(page, 'shared', 'v-bar').waitFor({ timeout: 10000 })
  const row = await chipText(homeRow(page, 'shared', 'v-bar'))
  check(`${tag}: the home row carries the chip`, row.includes('Khalid Alotaibi'), row)
  const other = await chipText(homeRow(page, 'shared', 'v-titled'))
  check(`${tag}: a v1 Shared item (no audience) reads "shared with everyone"`, /everyone|الجميع/.test(other), other)
  await page.screenshot({ path: `${SHOTS}/826-${dir}-home.png` })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 826 — an outsider opens a link to a board outside its audience: `ANALYTICS-413`, naming the owner, no title or data. */
async function outsiderNotShared826({ dir }) {
  const tag = `826 ${dir} 413`
  const { context, page, errors, calls } = await open({ dir, access: AUTHOR, items: { ...ITEMS, 'b-826': NOT_SHARED_826 } })
  await page.goto(`${BASE}/analytics/board/b-826`)
  const state = page.locator('[data-analytics-state="not-shared"]')
  await state.waitFor({ timeout: 15000 })
  const words = noIsolates(await state.innerText())
  check(`${tag}: "not shared with you"`, /isn’t shared with you|غير مُشاركة معك/.test(words), words)
  check(`${tag}: … naming the owner, by name and id`, words.includes('Mohamed Sartawi') && words.includes('msartawi'), words)
  check(
    `${tag}: … the name isolated as free text, the id as a machine value`,
    (await state.locator('bdi:not([dir])').filter({ hasText: 'Mohamed Sartawi' }).count()) === 1 && (await state.locator('bdi[dir="ltr"]').filter({ hasText: 'msartawi' }).count()) === 1,
  )
  check(`${tag}: no title and no data: nothing of the board, no Query asked`, !(await page.content()).includes('Delivery desk') && !calls.includes('Analytics/Query'))
  await page.screenshot({ path: `${SHOTS}/826-${dir}-413.png` })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/**
 * 826 — a curator narrows and reassigns someone else's Shared board: the chip marks the deleted role; Narrow opens
 * the same dialog with Everyone off, the choice limited to what the audience holds, and Unshare; dropping the
 * removed role PUTs the narrower audience. Reassign hands it to Khalid (`POST …/Reassign { owner }`).
 */
async function curatorNarrowsAndReassigns826({ dir }) {
  const tag = `826 ${dir} curator`
  const { context, page, errors, bodies } = await open({ dir, access: { canView: true, canAuthor: true, canCurate: true } })
  await page.goto(`${BASE}/analytics/board/b-826`)
  const header = page.locator('[data-analytics-board="b-826"] [data-analytics-board-header]')
  await header.locator('[data-analytics-audience="chosen"]').waitFor({ timeout: 15000 })
  check(`${tag}: the board's chip marks the deleted role removed`, (await header.locator('[data-analytics-audience-name="OLD_ECOM"][data-removed="true"]').count()) === 1)
  await page.locator('[data-analytics-action="narrow"]').waitFor({ timeout: 10000 })
  check(`${tag}: a curator is offered Narrow and Reassign (no Share)`, JSON.stringify(await tierActionsOn(page)) === '["narrow","reassign","certify"]', JSON.stringify(await tierActionsOn(page)))

  await page.locator('[data-analytics-action="narrow"]').click()
  await page.locator('[data-analytics-share="narrow"]').waitFor({ timeout: 5000 })
  check(`${tag}: narrowing cannot widen to Everyone`, await page.locator('[data-analytics-share-everyone]').isDisabled())
  check(`${tag}: … the dialog offers Unshare`, (await page.locator('[data-analytics-share-unshare]').count()) === 1)
  check(`${tag}: … and Narrow waits for a narrower choice`, await page.locator('[data-analytics-share-save]').isDisabled())
  const roles = page.locator('[data-testid="analytics-share-roles"]')
  await roles.locator('[data-multi-select-trigger]').click()
  const offered = await roles.locator('[data-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-option')))
  check(`${tag}: … offering only the roles the audience holds`, JSON.stringify(offered) === '["DELIVERY_OPS","OLD_ECOM"]', JSON.stringify(offered))
  await roles.locator('[data-option="OLD_ECOM"] input[type="checkbox"]').uncheck()
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${SHOTS}/826-${dir}-narrow.png` })
  await page.locator('[data-analytics-share-save]').click()
  await page.locator('[data-analytics-share]').waitFor({ state: 'detached', timeout: 10000 })
  const put = bodies['PUT Analytics/Item/b-826/Audience']?.[0]
  check(`${tag}: Narrow PUTs the narrower audience`, JSON.stringify(put) === JSON.stringify({ audience: { roles: ['DELIVERY_OPS'], users: ['nalharbi'] } }), JSON.stringify(put))
  await header.locator('[data-analytics-audience-name="OLD_ECOM"]').waitFor({ state: 'detached', timeout: 10000 })
  check(`${tag}: … and the chip follows`, (await header.locator('[data-analytics-audience-name]').count()) === 2)

  await page.locator('[data-analytics-action="reassign"]').click()
  await page.locator('[data-analytics-reassign]').waitFor({ timeout: 5000 })
  await searchPick(page, 'analytics-reassign-owner', 'Khalid', 'kalotaibi')
  await page.screenshot({ path: `${SHOTS}/826-${dir}-reassign.png` })
  await page.locator('[data-analytics-reassign-save]').click()
  await page.locator('[data-analytics-reassign]').waitFor({ state: 'detached', timeout: 10000 })
  const handed = bodies['Analytics/Item/b-826/Reassign']?.[0]
  check(`${tag}: Reassign posts { owner }`, JSON.stringify(handed) === JSON.stringify({ owner: 'kalotaibi' }), JSON.stringify(handed))
  check(`${tag}: … and keeps the audience (the chip stays)`, (await header.locator('[data-analytics-audience-name]').count()) === 2)
  check(`${tag}: no item PUT was made (audience and owner are not revisions)`, !bodies['PUT Analytics/Item/b-826'])

  await page.goto(`${BASE}/analytics`)
  await homeRow(page, 'shared', 'b-826').waitFor({ timeout: 10000 })
  const owner = noIsolates(await homeRow(page, 'shared', 'b-826').locator('[data-analytics-item-owner]').innerText())
  check(`${tag}: the home lists the new owner`, owner.includes('kalotaibi'), owner)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function staleProbeShare415() {
  const tag = '822 415'
  const { context, page, errors } = await open({ access: AUTHOR, share: refusal('ANALYTICS-415', 'Needs the author grant.', 403) })
  await page.goto(`${BASE}/analytics/view/v-bar`)
  await page.locator('[data-analytics-action="share"]').waitFor({ timeout: 15000 })
  await page.locator('[data-analytics-action="share"]').click()
  await page.locator('[data-analytics-share-save]').click()
  const note = page.locator('[data-analytics-tier-refusal="needs-author"]')
  await note.waitFor({ timeout: 10000 })
  check(`${tag}: the reason is worded from the boards key`, (await note.innerText()).includes('needs the author grant'), await note.innerText())
  check(`${tag}: … Share is hidden from then on`, (await page.locator('[data-analytics-action="share"]').count()) === 0)
  check(`${tag}: … and so is Edit`, (await page.locator('[data-analytics-edit]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/822-415.png` })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 823 ──────────────────────────────────────────────────────────────────────────────────────────────
// A board that carries its own parameters (`b-params`, one of each of the seven kinds): each kind's control
// changes the URL and re-asks only the panels it is bound to, by item and panel; Reset; the fallback notice
// (a link value outside a declared list, and a `fellBack` answer); a 412 names its parameter in the strip;
// "not filtered by …" for the author (all) and a runner (only moved).
const P823 = ['p-kpi', 'p-bar', 'p-line']
const idle823 = (page) =>
  page.waitForFunction(
    (ids) =>
      ids.every((id) => ['idle', 'refused', 'failed', 'empty'].includes(document.querySelector(`[data-board-panel="${id}"]`)?.dataset.boardPanelState)) &&
      document.querySelector('[data-board-stream]')?.dataset.boardStream === 'idle',
    P823,
    { timeout: 15000 },
  )
const keys823 = (page) =>
  page.locator('[data-board-panel-kind="view"]').evaluateAll((els) => Object.fromEntries(els.map((e) => [e.dataset.boardPanel, e.dataset.panelKey])))
const url823 = (page) => new URL(page.url()).searchParams
const asks823 = (bodies, from) => (bodies['Analytics/Query'] ?? []).slice(from)

/** Do `act`, wait for the bound panels to re-key and settle; returns the panels re-keyed and the new asks. */
// 824 — an author declares a parameter on a board:
//   1. a new board with three views; the strip holds the six ready-made parameters, each with a gear;
//   2. "+ Parameter" opens the inspector (a pane beside the board, not a modal) on a members parameter, with
//      the seven kinds offered; the name is checked live (`tv` is reserved), then named `zone`, labelled in
//      English and Arabic, and pointed at the region;
//   3. "Applies to" is pre-filled: the KPI and the bar bound, the delivery-time panel not, saying why
//      (`notInArea`); the bar is unbound; the overview agrees cell by cell;
//   4. Save runs `validate` (nothing found) and posts params + bindings; the stubbed server answers 411 with two
//      problems — the list shows both, and each one opens the inspector on its field and focuses it;
//   5. saving again makes the board, whose page draws the zone parameter in its strip. No page errors.
async function declares824({ dir }) {
  const tag = `824 ${dir}`
  const problems = (body) => {
    const kpi = body.definition?.panels?.[0]?.id
    const msg = 'The board declares something invalid.'
    return envelope({ problems: [{ what: 'name', why: 'duplicate', param: 'zone' }, { what: 'binding', param: 'zone', panel: kpi, reason: 'notInArea' }] }, { status: 400, success: false, message: msg, errors: [{ errorCode: 'ANALYTICS-411', internalErrorCode: '', errorMessage: msg }] })
  }
  const { context, page, bodies, errors } = await open({ dir, list: LIST_824, create: (body, n) => (n === 1 ? problems(body) : null) })
  await page.goto(`${BASE}/analytics/new?kind=board`)
  await page.locator('[data-board-editor="new"]').waitFor({ timeout: 10000 })
  for (const id of ['v-kpi', 'v-bar', 'v-824-p50']) {
    await page.locator('[data-board-add-pick]').selectOption(id)
    await page.locator('[data-board-add-view]').click()
  }
  const [kpi, bar, p50] = await page.locator('[data-editor-panel]').evaluateAll((els) => els.map((e) => e.dataset.editorPanel))
  for (const id of [kpi, bar, p50]) await page.waitForFunction((x) => document.querySelector(`[data-editor-panel="${x}"]`)?.dataset.editorPanelState === 'loaded', id, { timeout: 10000 })
  const gears = await page.locator('[data-board-param-edit]').evaluateAll((els) => els.map((e) => e.dataset.boardParamEdit))
  check(`${tag}: the strip holds the six ready-made parameters, each with a gear`, JSON.stringify(gears) === JSON.stringify(['period', 'city', 'region', 'store', 'channel', 'country']), gears.join(', '))

  // 2. Declare.
  await page.locator('[data-board-param-add]').click()
  const inspector = page.locator('[data-param-inspector]')
  await inspector.waitFor({ timeout: 5000 })
  const kinds = await inspector.locator('[data-param-kind]').evaluateAll((els) => els.map((e) => e.dataset.paramKind))
  check(`${tag}: "+ Parameter" opens the inspector on a new members parameter, the seven kinds offered`, (await inspector.getAttribute('data-param-inspector')) === 'members' && kinds.length === 7 && (await inspector.locator('[data-param-kind="members"]').getAttribute('aria-pressed')) === 'true', kinds.join(', '))
  check(`${tag}: … in a pane beside the board, not a modal`, (await page.locator('[role="dialog"]').count()) === 0 && (await inspector.evaluate((el) => el.tagName)) === 'ASIDE')
  const box = await inspector.boundingBox()
  const grid = await page.locator('[data-board-grid], [data-editor-panel]').first().boundingBox()
  check(`${tag}: … on the inline end side`, dir === 'rtl' ? box.x < grid.x : box.x > grid.x, `inspector ${Math.round(box.x)} panel ${Math.round(grid.x)}`)
  await inspector.locator('[data-param-name]').fill('tv')
  const reserved = await inspector.locator('[data-param-field="name"]').innerText()
  check(`${tag}: the name is checked live: tv is reserved`, /reserved|محجوز/.test(reserved) && (await inspector.getAttribute('data-param-inspector')) === 'members', reserved)
  await inspector.locator('[data-param-name]').fill('zone')
  await page.locator('[data-param-inspector="zone"]').waitFor({ timeout: 3000 })
  await inspector.locator('[data-param-label="en"]').fill('Zone')
  await inspector.locator('[data-param-label="ar"]').fill('المنطقة')
  await inspector.locator('[data-param-dimension]').selectOption('region')
  check(`${tag}: a valid name is taken at once, and the strip shows the new parameter`, (await page.locator('[data-board-param-edit="zone"]').count()) === 1)

  // 3. Applies to.
  const bound = async () => Object.fromEntries(await inspector.locator('[data-param-binding]').evaluateAll((els) => els.map((e) => [e.dataset.paramBinding, e.dataset.paramBound])))
  const first = await bound()
  check(`${tag}: "Applies to" is pre-filled with every panel that can take it`, first[kpi] === 'true' && first[bar] === 'true' && first[p50] === 'false', JSON.stringify(first))
  const why = await inspector.locator(`[data-param-binding="${p50}"] [data-param-reason]`).getAttribute('data-param-reason')
  check(`${tag}: … and the panel it can't reach says why`, why === 'notInArea', String(why))
  await inspector.locator(`[data-param-binding="${bar}"] button`).first().click()
  check(`${tag}: the bar is unbound`, (await bound())[bar] === 'false')
  const cells = Object.fromEntries(await inspector.locator('[data-param-overview-row="zone"] [data-param-overview-cell]').evaluateAll((els) => els.map((e) => [e.dataset.paramOverviewCell, e.dataset.state])))
  check(`${tag}: the overview agrees: bound, unbound, can't`, cells[kpi] === 'bound' && cells[bar] === 'unbound' && cells[p50] === 'cannot', JSON.stringify(cells))
  const regionRow = Object.fromEntries(await inspector.locator('[data-param-overview-row="region"] [data-param-overview-cell]').evaluateAll((els) => els.map((e) => [e.dataset.paramOverviewCell, e.dataset.state])))
  check(`${tag}: … for every parameter (the ready-made region can't reach the delivery-time panel either)`, regionRow[p50] === 'cannot' && regionRow[kpi] === 'bound', JSON.stringify(regionRow))
  await page.screenshot({ path: `${SHOTS}/824-inspector-${dir}.png`, fullPage: true })
  await inspector.locator('[data-param-inspector-close]').click()

  // 4. Save: the server lists two problems, each taking the author to its field.
  await page.locator('[data-board-title="en"]').fill('Zones')
  await page.locator('[data-editor-save]').click()
  await page.locator('[data-declaration-problems="2"]').waitFor({ timeout: 5000 })
  const sent = (bodies['Analytics/Item'] ?? []).at(-1) ?? {}
  const zone = sent.definition?.params?.find((x) => x.name === 'zone')
  check(
    `${tag}: the save carries params and bindings: zone on region, bound to the KPI only`,
    zone?.kind === 'members' && zone.dimension === 'region' && zone.label?.ar === 'المنطقة' && JSON.stringify(sent.definition?.bindings?.zone) === JSON.stringify({ [kpi]: 'region' }) && sent.definition.params.length === 7,
    JSON.stringify(sent.definition?.bindings?.zone),
  )
  const said = noIsolates(await page.locator('[data-declaration-problems]').innerText())
  check(`${tag}: a 411 lists every problem`, (await page.locator('[data-declaration-problem]').count()) === 2 && /ANALYTICS-411/.test(said), said.slice(0, 200))
  await page.screenshot({ path: `${SHOTS}/824-refused-${dir}.png`, fullPage: true })
  await page.locator('[data-declaration-problem-go="0"]').click()
  await page.locator('[data-param-inspector="zone"]').waitFor({ timeout: 3000 })
  await page.waitForTimeout(100)
  check(`${tag}: the name problem opens the inspector and focuses the name`, await page.evaluate(() => document.activeElement?.hasAttribute('data-param-name')))
  await page.locator('[data-declaration-problem-go="1"]').click()
  await page.waitForTimeout(100)
  const at = await page.evaluate(() => document.activeElement?.closest('[data-param-binding]')?.getAttribute('data-param-binding'))
  check(`${tag}: the binding problem focuses that panel's binding`, at === kpi, String(at))

  // 5. Saved.
  await page.locator('[data-editor-save]').click()
  await page.waitForURL('**/analytics/board/b-new', { timeout: 10000 })
  await page.locator('[data-board-filters] [data-board-param="zone"]').first().waitFor({ timeout: 10000 })
  check(`${tag}: saved again, the board page's strip holds the zone parameter`, (await page.locator('[data-board-filters] [data-board-param="zone"]').count()) > 0)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function change823(page, bodies, act, expect) {
  const before = await keys823(page)
  const from = (bodies['Analytics/Query'] ?? []).length
  await act()
  await page
    .waitForFunction(
      ([ids, was]) => ids.every((id) => document.querySelector(`[data-board-panel="${id}"]`)?.dataset.panelKey !== was[id]),
      [expect, before],
      { timeout: 5000 },
    )
    .catch(() => {})
  await idle823(page)
  const after = await keys823(page)
  const rekeyed = P823.filter((id) => after[id] !== before[id]).sort()
  return { rekeyed, asks: asks823(bodies, from) }
}

async function params823({ dir }) {
  const tag = `823 ${dir}`
  const { context, page, bodies, errors } = await open({ dir })
  await page.goto(`${BASE}/analytics/board/b-params`)
  await page.locator('[data-analytics-board="b-params"]').waitFor({ timeout: 10000 })
  await idle823(page)

  const first = bodies['Analytics/Query'] ?? []
  const byPanel = Object.fromEntries(first.map((b) => [b.panelId, b]))
  check(
    `${tag}: each panel asks by item and panel, with the values of the parameters bound to it`,
    first.length === 3 &&
      first.every((b) => b.itemId === 'b-params' && b.revision === 6 && !('viewId' in b) && !('filters' in b)) &&
      Object.keys(byPanel['p-bar']?.values ?? {}).sort().join() === 'channel-one,on-time,period,region,split,top' &&
      Object.keys(byPanel['p-kpi']?.values ?? {}).sort().join() === 'figure,period,region' &&
      Object.keys(byPanel['p-line']?.values ?? {}).sort().join() === 'grain,period',
    JSON.stringify(first.map((b) => [b.panelId, Object.keys(b.values ?? {})])),
  )
  const kinds = await page.locator('[data-board-filters] [data-board-param-kind]').evaluateAll((els) => els.map((e) => e.dataset.boardParamKind))
  check(`${tag}: the strip draws one control per parameter, of all seven kinds`, kinds.join() === 'period,members,members,grain,threshold,topN,measure,breakdown', kinds.join())
  const author = await page.locator('[data-board-panel="p-line"] [data-board-not-filtered]').getAttribute('data-board-not-filtered').catch(() => null)
  check(`${tag}: the author sees every parameter the line is not filtered by`, author === 'region channel-one on-time top figure split', String(author))
  const bar = await page.locator('[data-board-panel="p-bar"] [data-board-not-filtered]').getAttribute('data-board-not-filtered').catch(() => null)
  check(`${tag}: … and the bar, bound to all but two, names just those two`, bar === 'grain figure', String(bar))
  check(`${tag}: Reset is off while every value is the author's`, await page.locator('[data-board-params-reset]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/823-strip-${dir}.png`, fullPage: true })

  const expectOnly = (name, r, panels, wire) =>
    check(
      `${tag}: ${name} re-asks only ${panels.join(' + ')}`,
      r.rekeyed.join() === [...panels].sort().join() &&
        r.asks.length >= panels.length &&
        r.asks.every((b) => panels.includes(b.panelId)) &&
        r.asks.every((b) => JSON.stringify(b.values[wire.param]) === JSON.stringify(wire.value)),
      `${r.rekeyed.join()} | ${JSON.stringify(r.asks.map((b) => [b.panelId, b.values?.[wire.param]]))}`,
    )

  // period
  let r = await change823(page, bodies, () => page.locator('[data-board-param="period"] [data-board-filter-period]').selectOption('last-week'), P823)
  expectOnly('the period', r, P823, { param: 'period', value: { kind: 'period', token: 'last-week' } })
  check(`${tag}: … and the URL carries period=last-week`, url823(page).get('period') === 'last-week', page.url())

  // members, open search, several
  r = await change823(
    page,
    bodies,
    async () => {
      const box = await pickMember(page, 'region', 'central')
      await box.locator('[data-option="central"] input').click()
      await page.keyboard.press('Escape')
    },
    ['p-bar', 'p-kpi'],
  )
  expectOnly('a region (open search)', r, ['p-bar', 'p-kpi'], { param: 'region', value: { kind: 'members', values: ['central'] } })
  check(`${tag}: … region=central in the URL`, url823(page).getAll('region').join() === 'central', page.url())

  // members, pinned, one value
  r = await change823(
    page,
    bodies,
    async () => {
      const box = page.locator('[data-testid="board-filter-channel-one"]')
      await box.locator('[data-multi-select-trigger]').click()
      const offered = await box.locator('[data-option]').evaluateAll((els) => els.map((e) => e.dataset.option))
      check(`${tag}: the pinned list offers only the author's members`, offered.join() === 'app,web,store', offered.join())
      await box.locator('[data-option="web"] input').click()
      await page.keyboard.press('Escape')
    },
    ['p-bar'],
  )
  expectOnly('one pinned channel', r, ['p-bar'], { param: 'channel-one', value: { kind: 'members', values: ['web'] } })
  check(`${tag}: … a one-value parameter holds only the last pick`, url823(page).getAll('channel-one').join() === 'web', page.url())

  // grain chips over the allowed subset
  const grains = await page.locator('[data-board-param="grain"] [data-board-grain]').evaluateAll((els) => els.map((e) => e.dataset.boardGrain))
  check(`${tag}: the grain offers only the allowed subset`, grains.join() === 'day,week', grains.join())
  r = await change823(page, bodies, () => page.locator('[data-board-param="grain"] [data-board-grain="week"]').click(), ['p-line'])
  expectOnly('the grain', r, ['p-line'], { param: 'grain', value: { kind: 'grain', grain: 'week' } })
  check(`${tag}: … grain=week`, url823(page).get('grain') === 'week')

  // threshold: an operator, then the number in the display unit
  r = await change823(page, bodies, () => page.locator('[data-board-param="on-time"] [data-board-threshold-op]').selectOption('gt'), ['p-bar'])
  expectOnly('the threshold operator', r, ['p-bar'], { param: 'on-time', value: { kind: 'threshold', op: 'gt', value: 5 } })
  check(`${tag}: a share threshold reads in percent`, /[%٪]/.test(await page.locator('[data-board-param="on-time"]').innerText()))
  r = await change823(page, bodies, () => page.locator('[data-board-param="on-time"] [data-board-threshold-value]').fill('85'), ['p-bar'])
  expectOnly('the threshold number (typed once, asked once)', r, ['p-bar'], { param: 'on-time', value: { kind: 'threshold', op: 'gt', value: 85 } })
  check(`${tag}: … on-time=gt:85`, url823(page).get('on-time') === 'gt:85', page.url())

  // top N stepper
  r = await change823(page, bodies, () => page.locator('[data-board-param="top"] [data-board-topn-step="1"]').click(), ['p-bar'])
  expectOnly('top N +1', r, ['p-bar'], { param: 'top', value: { kind: 'topN', n: 11 } })
  r = await change823(page, bodies, () => page.locator('[data-board-param="top"] [data-board-topn]').fill('25'), ['p-bar'])
  expectOnly('top N typed', r, ['p-bar'], { param: 'top', value: { kind: 'topN', n: 25 } })
  check(`${tag}: … top=25`, url823(page).get('top') === '25')

  // measure and breakdown
  r = await change823(page, bodies, () => page.locator('[data-board-param="figure"] select').selectOption('deliveries'), ['p-kpi'])
  expectOnly('the measure choice', r, ['p-kpi'], { param: 'figure', value: { kind: 'measure', key: 'deliveries' } })
  r = await change823(page, bodies, () => page.locator('[data-board-param="split"] select').selectOption('city'), ['p-bar'])
  expectOnly('the breakdown choice', r, ['p-bar'], { param: 'split', value: { kind: 'breakdown', key: 'city' } })
  check(`${tag}: … figure=deliveries&split=city`, url823(page).get('figure') === 'deliveries' && url823(page).get('split') === 'city')
  await page.screenshot({ path: `${SHOTS}/823-moved-${dir}.png`, fullPage: true })

  // The link carries every value: a reload restores them all, same keys.
  const moved = await keys823(page)
  await page.reload()
  await page.locator('[data-analytics-board="b-params"]').waitFor({ timeout: 10000 })
  await idle823(page)
  check(`${tag}: reloading the link restores every value (same keys)`, JSON.stringify(await keys823(page)) === JSON.stringify(moved))

  // Reset to defaults
  r = await change823(page, bodies, () => page.locator('[data-board-params-reset]').click(), P823)
  const qs = url823(page)
  check(
    `${tag}: Reset gives back the author's values`,
    qs.get('period') === 'last-30-days' && qs.getAll('region').length === 0 && qs.getAll('channel-one').join() === 'app' && !qs.has('grain') && !qs.has('on-time') && !qs.has('top') && !qs.has('figure') && !qs.has('split'),
    page.url(),
  )
  check(`${tag}: … every panel re-asks at the defaults, and Reset is off again`, r.rekeyed.length === 3 && (await page.locator('[data-board-params-reset]').isDisabled()), r.rekeyed.join())
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** A 412 refusal naming its parameter in `data` (⚠ `data.param`, proposed). */
const refusal412 = (param) => envelope({ param }, { status: 400, success: false, message: 'The value is out of range.', errors: [{ errorCode: 'ANALYTICS-412', internalErrorCode: '', errorMessage: 'The value is out of range.' }] })

async function notices823({ dir }) {
  const tag = `823 notices ${dir}`
  // A runner: "not filtered by" names only what they moved. A link asking a channel the author did not pin falls back.
  {
    const { context, page, errors } = await open({ dir, access: RUNNER })
    await page.goto(`${BASE}/analytics/board/b-params?top=5&channel-one=aggregator`)
    await page.locator('[data-analytics-board="b-params"]').waitFor({ timeout: 10000 })
    await idle823(page)
    const said = await page.locator('[data-board-panel="p-line"] [data-board-not-filtered]').getAttribute('data-board-not-filtered').catch(() => null)
    check(`${tag}: a runner sees "not filtered by" only for the parameter they moved`, said === 'top', String(said))
    const words = await page.locator('[data-board-panel="p-line"] [data-board-not-filtered]').innerText().catch(() => '')
    check(`${tag}: … in words, naming its label`, /Top|الأعلى/.test(words) && /Not filtered by|غير مُصفّى حسب/.test(words), words)
    const fell = page.locator('[data-board-param-notice="fellBack"][data-param="channel-one"]')
    check(`${tag}: a link value outside the pinned list shows the one-line fallback notice`, await fell.isVisible())
    const chips = await page.locator('[data-testid="board-filter-channel-one"] [data-chip]').evaluateAll((els) => els.map((e) => e.dataset.chip))
    check(`${tag}: … and the control shows the default`, chips.join() === 'app', chips.join())
    await page.screenshot({ path: `${SHOTS}/823-runner-fallback-${dir}.png`, fullPage: true })
    check(`${tag}: runner page has no errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // The server's own fallback (`fellBack[]`), and a 412 naming `top`.
  {
    const paramAnswer = (body, answer) => {
      if (body.values?.top?.n === 77) return refusal412('top')
      if (body.values?.split?.key === 'city') return { ...answer, fellBack: [{ param: 'split' }] }
      return answer
    }
    const { context, page, errors } = await open({ dir, paramAnswer })
    await page.goto(`${BASE}/analytics/board/b-params?split=city`)
    await page.locator('[data-analytics-board="b-params"]').waitFor({ timeout: 10000 })
    await idle823(page)
    check(`${tag}: a fellBack answer shows the fallback notice for its parameter`, await page.locator('[data-board-param-notice="fellBack"][data-param="split"]').isVisible())
    await page.goto(`${BASE}/analytics/board/b-params?top=77`)
    await page.locator('[data-analytics-board="b-params"]').waitFor({ timeout: 10000 })
    await idle823(page)
    const invalid = page.locator('[data-board-param-notice="invalid"][data-param="top"]')
    const invalidWords = await invalid.innerText().catch(() => '')
    check(`${tag}: ANALYTICS-412 names the parameter in the strip`, /Top|الأعلى/.test(invalidWords), invalidWords)
    check(`${tag}: … and marks its control invalid`, (await page.locator('[data-board-param="top"]').getAttribute('data-board-param-invalid')) === 'true')
    const states = await panelStates(page)
    check(`${tag}: … the refused panel says so, the others run`, states['p-bar'] === 'refused' && states['p-kpi'] === 'idle' && states['p-line'] === 'idle', JSON.stringify(states))
    await page.screenshot({ path: `${SHOTS}/823-412-${dir}.png`, fullPage: true })
    await page.locator('[data-board-params-reset]').click()
    await page.waitForFunction(() => document.querySelector('[data-board-panel="p-bar"]')?.dataset.boardPanelState === 'idle', null, { timeout: 5000 }).catch(() => {})
    await idle823(page)
    check(`${tag}: Reset clears the 412`, (await page.locator('[data-board-param-notice="invalid"]').count()) === 0 && (await page.locator('[data-board-panel="p-bar"]').getAttribute('data-board-panel-state')) === 'idle')
    check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// 827 — a runner opens a report: sections, panels, live figures, the summary or "unavailable", caveats, print.
const P827 = ['p1', 'p2', 'p3', 'p4']
const idle827 = (page) =>
  page
    .waitForFunction((ids) => ids.every((id) => ['idle', 'empty'].includes(document.querySelector(`[data-report-panel="${id}"] [data-board-panel]`)?.dataset.boardPanelState)), P827, { timeout: 10000 })
    .catch(() => {})
const figure827 = (page, token) => page.locator(`[data-report-figure="${token}"]`).first().innerText().catch(() => null)
const lastWords827 = (bodies) => (bodies['Analytics/Report/r-827/Words'] ?? []).at(-1)

async function report827({ dir, dark = false }) {
  const tag = `827 ${dir}${dark ? ' dark' : ''}`
  const state = { summary: 'written', drop: [] }
  const { context, page, bodies, errors } = await open({ dir, dark, access: RUNNER, model: MODEL_827, words: (body) => wordsAnswer827(body, state) })
  await page.goto(`${BASE}/analytics/report/r-827`)
  await page.locator('[data-analytics-report="r-827"]').waitFor({ timeout: 30000 })
  await idle827(page)
  await page.locator('[data-report-summary="written"]').waitFor({ timeout: 5000 }).catch(() => {})

  check(`${tag}: the title and the audience chip head the page`, (await page.locator('[data-analytics-report-title]').innerText()).length > 0 && (await page.locator('[data-analytics-report-header] [data-analytics-audience="chosen"]').count()) === 1)
  const sections = await page.locator('[data-report-section]').evaluateAll((els) => els.map((e) => e.dataset.reportSection))
  check(`${tag}: the sections in order`, sections.join() === 's1,s2,s3,s4', sections.join())
  const order = await page.locator('[data-report-sections] [data-report-panel], [data-report-sections] [data-report-text], [data-report-sections] [data-report-summary]').evaluateAll((els) =>
    els.map((e) => e.dataset.reportPanel ?? e.dataset.reportText ?? e.dataset.reportBlock),
  )
  check(`${tag}: each section's blocks in order (panels, text, summary)`, order.join() === 'p1,t1,p2,p3,t2,p4,sum', order.join())
  const states = await page.locator('[data-report-panel] [data-board-panel]').evaluateAll((els) => els.map((e) => e.dataset.boardPanelState))
  check(`${tag}: every panel draws in v1's panel frame`, states.length === 4 && states.every((x) => x === 'idle'), states.join())
  check(`${tag}: … with its freshness and actions`, (await page.locator('[data-report-panel] [data-analytics-as-of]').count()) === 4 && (await page.locator('[data-report-panel] [data-panel-actions]').count()) === 4)
  const first = bodies['Analytics/Query'] ?? []
  const by = Object.fromEntries(first.map((b) => [b.panelId, b]))
  check(
    `${tag}: each panel asks by the report and its panel, with the values bound to it`,
    first.length === 4 &&
      first.every((b) => b.itemId === 'r-827' && b.revision === 3 && !('viewId' in b) && !('crossFilter' in b)) &&
      Object.keys(by.p1?.values ?? {}).sort().join() === 'city,period' &&
      Object.keys(by.p3?.values ?? {}).sort().join() === 'grain,period',
    JSON.stringify(first.map((b) => [b.panelId, Object.keys(b.values ?? {})])),
  )
  const editing = await page.locator('[data-analytics-board-edit], a[href$="/edit"], [data-board-tv-enter], [data-analytics-ask], [data-editor-save], [data-analytics-share]').count()
  check(`${tag}: a runner sees no edit control, no TV mode and no ask box`, editing === 0, String(editing))
  check(`${tag}: no cross-filter is ever asked`, (bodies['Analytics/Query'] ?? []).every((b) => !b.crossFilter))

  const words = lastWords827(bodies)
  check(`${tag}: the Words door is asked once with the revision and every value`, (bodies['Analytics/Report/r-827/Words'] ?? []).length === 1 && words?.revision === 3 && Object.keys(words?.values ?? {}).sort().join() === 'city,grain,period', JSON.stringify(words))
  const total = await figure827(page, '{p1:total}')
  check(`${tag}: a live figure is filled from the Words answer`, total === 'SAR 1,250,000', String(total))
  const isolated = await page.locator('[data-report-figure="{p1:total}"] bdi[dir="ltr"]').count()
  check(`${tag}: … isolated whole as a machine value`, isolated === 1)
  const text = await page.locator('[data-report-sections]').innerText()
  check(`${tag}: no raw token reaches the reader`, !/\{p\d:[a-z_]+\}/.test(text))
  check(`${tag}: the summary is written`, (await page.locator('[data-report-summary="written"] [data-report-summary-text]').count()) === 1)
  check(`${tag}: the cancellation panel carries the model's caveat`, (await page.locator('[data-report-panel="p3"] [data-panel-caveat]').count()) === 1 && (await page.locator('[data-report-panel="p1"] [data-panel-caveat]').count()) === 0)
  const rising = await page.locator('[data-report-panel="p3"] [data-panel-still-rising]').getAttribute('data-panel-still-rising').catch(() => null)
  check(`${tag}: … and "may still rise" from its first young day`, rising === '2026-10-30' && (await page.locator('[data-report-panel="p1"] [data-panel-still-rising]').count()) === 0, String(rising))
  await page.screenshot({ path: `${SHOTS}/827-runner-${dir}${dark ? '-dark' : ''}.png`, fullPage: true })

  // A period change: every panel bound to it, and the Words, ask again; the figures follow.
  const from = (bodies['Analytics/Query'] ?? []).length
  await page.locator('[data-board-param="period"] [data-board-filter-period]').selectOption('last-week')
  await page.waitForFunction(() => document.querySelector('[data-report-figure="{p1:total}"]')?.textContent?.includes('1,000,000'), null, { timeout: 5000 }).catch(() => {})
  await idle827(page)
  const asks = (bodies['Analytics/Query'] ?? []).slice(from)
  check(`${tag}: a period change re-asks every panel with the new period`, P827.every((id) => asks.some((b) => b.panelId === id && b.values?.period?.token === 'last-week')), JSON.stringify(asks.map((b) => [b.panelId, b.values?.period])))
  check(`${tag}: … and the Words with it, and the figures follow`, lastWords827(bodies)?.values?.period?.token === 'last-week' && (await figure827(page, '{p1:total}')) === 'SAR 1,000,000', String(await figure827(page, '{p1:total}')))
  check(`${tag}: … and the URL carries period=last-week`, new URL(page.url()).searchParams.get('period') === 'last-week', page.url())

  // The number check fails: the summary alone drops; a figure the run lacks reads as a placeholder.
  state.summary = 'unavailable'
  state.drop = ['{p3:qc}']
  await page.locator('[data-board-param="period"] [data-board-filter-period]').selectOption('last-month')
  await page.locator('[data-report-summary="unavailable"]').waitFor({ timeout: 5000 }).catch(() => {})
  await idle827(page)
  check(`${tag}: a summary that fails its check reads "summary unavailable"`, (await page.locator('[data-report-summary="unavailable"]').count()) === 1 && (await page.locator('[data-report-summary-text]').count()) === 0)
  const kept = await page.locator('[data-report-panel] [data-board-panel]').evaluateAll((els) => els.map((e) => e.dataset.boardPanelState))
  check(`${tag}: … and drops only the summary: every section, panel and other figure stays`, kept.length === 4 && kept.every((x) => x === 'idle') && (await page.locator('[data-report-section]').count()) === 4 && (await figure827(page, '{p1:total}')) === 'SAR 4,375,000', kept.join())
  const missing = await page.locator('[data-report-figure-missing="{p3:qc}"]').innerText().catch(() => null)
  check(`${tag}: a figure the run lacks is a placeholder, never the raw token`, !!missing && !missing.includes('{') && !/\{p\d:/.test(await page.locator('[data-report-sections]').innerText()), String(missing))
  await page.screenshot({ path: `${SHOTS}/827-unavailable-${dir}${dark ? '-dark' : ''}.png`, fullPage: true })

  // Print carries the values on screen.
  const href = await page.locator('[data-report-print]').getAttribute('href')
  check(`${tag}: Print opens the print page with the values on screen`, !!href && href.startsWith('/analytics/print/report/r-827?') && new URLSearchParams(href.split('?')[1]).get('period') === 'last-month', String(href))
  // The same page (its stubs are the page's own), with the print dialog stubbed out.
  const print = page
  await print.addInitScript(() => {
    window.__printed = 0
    window.print = () => {
      window.__printed += 1
    }
  })
  const printFrom = (bodies['Analytics/Query'] ?? []).length
  await print.goto(`${BASE}${href}`)
  await print.locator('[data-report-print-page="ready"]').waitFor({ timeout: 10000 }).catch(() => {})
  await print.waitForFunction(() => window.__printed > 0, null, { timeout: 5000 }).catch(() => {})
  const printAsks = (bodies['Analytics/Query'] ?? []).slice(printFrom)
  check(`${tag}: the print page runs every panel with the link's values`, P827.every((id) => printAsks.some((b) => b.panelId === id && b.values?.period?.token === 'last-month')), JSON.stringify(printAsks.map((b) => [b.panelId, b.values?.period])))
  check(`${tag}: … its figures are that run's, and its chips name the values`, (await figure827(print, '{p1:total}')) === 'SAR 4,375,000' && (await print.locator('[data-board-filter-chips]').count()) === 1)
  check(`${tag}: … and it opens the print dialog once everything has landed`, (await print.evaluate(() => window.__printed)) === 1)
  const width = await print.locator('[data-analytics-report="r-827"]').evaluate((el) => el.getBoundingClientRect().width)
  check(`${tag}: … at A4 width`, Math.round(width) === 680, String(width))
  await print.screenshot({ path: `${SHOTS}/827-print-${dir}${dark ? '-dark' : ''}.png`, fullPage: true })

  if (dir === 'rtl') {
    check(`${tag}: the page is RTL`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
    // The app renders English under RTL today (i18n stays `en`; `dir` is the boot fact): the figure keeps its order.
    const iso = await page.locator('[data-report-text="t1"] [data-report-figure="{p1:total}"] bdi').getAttribute('dir').catch(() => null)
    check(`${tag}: the figure in the text stays a left-to-right isolate under RTL`, iso === 'ltr', String(iso))
  }
  if (dir === 'ltr' && !dark) {
    // A board panel shows the model's marks too.
    await page.goto(`${BASE}/analytics/board/b-827`)
    await page.locator('[data-board-panel="p-rate"][data-board-panel-state="idle"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${tag}: a board panel carries the caveat and "may still rise" too`, (await page.locator('[data-board-panel="p-rate"] [data-panel-caveat]').count()) === 1 && (await page.locator('[data-board-panel="p-rate"] [data-panel-still-rising]').count()) === 1)
    // The CTO demo's report ids are gone: not found. A board's id read as a report is not found either.
    await page.goto(`${BASE}/analytics/report/rep-demo-1`)
    await page.locator('[data-analytics-state]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${tag}: a demo report id falls to not-found`, (await page.locator('[data-analytics-state="not-found"]').count()) === 1)
    await page.goto(`${BASE}/analytics/report/b-827`)
    await page.locator('[data-analytics-state]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${tag}: an item that is not a report is not found as one`, (await page.locator('[data-analytics-state="not-found"]').count()) === 1)
  }
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// 833 — an author schedules the sample report to audience members; 414, Send now, suspended, and the kept runs.
async function schedules833({ dir }) {
  const tag = `833 ${dir}`
  const refused414 = envelope({ recipients: [{ id: 'sqahtani', why: 'runGrant' }] }, { status: 400, success: false, message: 'Invalid recipients.', errors: [{ errorCode: 'ANALYTICS-414', internalErrorCode: '', errorMessage: 'Invalid recipients.' }] })
  const { context, page, bodies, errors, calls } = await open({
    dir,
    access: AUTHOR,
    model: MODEL_827,
    // The first save is refused, naming Sara; the second goes through.
    scheduleSave: (_body, n) => (n === 1 ? refused414 : undefined),
    artefact: (runId) => (runId === 'run-410' ? { status: 410, contentType: 'text/plain', body: '' } : undefined),
  })
  await page.goto(`${BASE}/analytics/report/r-833`)
  await page.locator('[data-analytics-report="r-833"]').waitFor({ timeout: 30000 })
  await page.locator('[data-report-schedules]').click()
  await page.locator('[data-schedule-row="sch-old"]').waitFor({ timeout: 10000 })
  const old = page.locator('[data-schedule-row="sch-old"]')
  check(`${tag}: the suspended schedule says so`, (await old.locator('[data-schedule-state="suspended"]').count()) === 1)
  const why = await old.locator('[data-schedule-suspended="value"]').innerText().catch(() => '')
  check(`${tag}: … and why, naming the parameter`, /City|المدينة/.test(why), why)
  const oldSummary = await old.locator('[data-schedule-summary]').innerText()
  check(`${tag}: its cadence reads as a sentence, the days and time isolated`, oldSummary.includes('\u206808:00\u2069') && /Sunday|الأحد/.test(oldSummary) && /Wednesday|الأربعاء/.test(oldSummary), JSON.stringify(oldSummary))
  await page.screenshot({ path: `${SHOTS}/833-${dir}-list.png` })

  await page.locator('[data-schedule-new]').click()
  const editor = page.locator('[data-schedule-editor="new"]')
  await editor.waitFor({ timeout: 5000 })
  check(`${tag}: a new schedule opens daily, enabled`, (await editor.locator('[data-schedule-cadence="daily"]').getAttribute('aria-pressed')) === 'true' && (await editor.locator('[data-schedule-enabled="on"]').getAttribute('aria-pressed')) === 'true')
  await editor.locator('[data-board-param="period"] [data-board-filter-period]').selectOption('yesterday')
  await editor.locator('[data-schedule-time]').fill('06:30')
  // The candidates load unsearched: the three it may not send to are listed with why.
  await editor.locator('[data-schedule-barred="tkhan"]').waitFor({ timeout: 10000 })
  const bars = await editor.locator('[data-schedule-barred]').evaluateAll((els) => els.map((e) => `${e.dataset.scheduleBarred}:${e.dataset.scheduleBar}`))
  check(`${tag}: outside the audience, without the run grant and off the company domain are not offered`, bars.sort().join() === 'mnasser:runGrant,oyousef:audience,tkhan:address', bars.join())
  const root = page.locator('[data-testid="analytics-schedule-recipients"]')
  await root.locator('[data-multi-select-trigger]').click()
  await root.locator('[data-option="nalharbi"]').waitFor({ timeout: 10000 })
  const offered = await root.locator('[data-option]').evaluateAll((els) => els.map((e) => e.dataset.option))
  check(`${tag}: … the picker offers only the three who may receive it`, offered.sort().join() === 'kalotaibi,nalharbi,sqahtani', offered.join())
  for (const id of ['nalharbi', 'kalotaibi', 'sqahtani']) await root.locator(`[data-option="${id}"] input[type="checkbox"]`).check()
  await page.keyboard.press('Escape')
  await page.locator('[data-schedule-save]').click()
  await editor.locator('[data-schedule-refused="sqahtani"]').waitFor({ timeout: 10000 })
  const refusedText = await editor.locator('[data-schedule-refused="sqahtani"]').innerText()
  check(`${tag}: ANALYTICS-414 names the refused recipient and why`, refusedText.includes('Sara Alqahtani') && /run grant|صلاحية التشغيل/.test(refusedText), refusedText)
  await page.screenshot({ path: `${SHOTS}/833-${dir}-414.png` })
  await root.locator('[data-multi-select-trigger]').click()
  await root.locator('[data-option="sqahtani"] input[type="checkbox"]').uncheck()
  await page.keyboard.press('Escape')
  await page.locator('[data-schedule-save]').click()
  const savedEditor = page.locator('[data-schedule-editor="sch-2"]')
  await savedEditor.waitFor({ timeout: 10000 })
  const sent = (bodies['Analytics/Report/r-833/Schedules'] ?? []).at(-1)
  check(
    `${tag}: the save posts the cadence, Riyadh time, values, language, recipients and state`,
    JSON.stringify(sent?.cadence) === JSON.stringify({ kind: 'daily' }) &&
      sent?.time === '06:30' &&
      sent?.values?.period?.token === 'yesterday' &&
      Object.keys(sent?.values ?? {}).sort().join() === 'city,grain,period' &&
      ['en', 'ar'].includes(sent?.lang) &&
      JSON.stringify(sent?.recipients) === JSON.stringify(['nalharbi', 'kalotaibi']) &&
      sent?.enabled === true,
    JSON.stringify(sent),
  )

  const sending = page.waitForResponse((r) => r.url().includes('/Schedules/sch-2/SendNow'), { timeout: 10000 })
  await page.locator('[data-schedule-send-now]').click()
  await sending
  check(`${tag}: Send now posts the saved schedule`, calls.includes('Analytics/Report/r-833/Schedules/sch-2/SendNow'))
  await page.locator('[data-schedule-back]').click()
  await page.locator('[data-schedule-row="sch-2"]').waitFor({ timeout: 10000 })
  const summary = await page.locator('[data-schedule-row="sch-2"] [data-schedule-summary]').innerText()
  check(`${tag}: the list holds both, the new one daily at its isolated time`, (await page.locator('[data-schedule-row]').count()) === 2 && summary.includes('\u206806:30\u2069'), JSON.stringify(summary))
  check(`${tag}: … enabled, to two recipients`, (await page.locator('[data-schedule-row="sch-2"] [data-schedule-state="enabled"]').count()) === 1 && (await page.locator('[data-schedule-row="sch-2"] [data-schedule-recipients]').getAttribute('data-schedule-recipients')) === '2')
  await page.screenshot({ path: `${SHOTS}/833-${dir}-saved.png` })
  await page.keyboard.press('Escape')

  await page.locator('[data-report-runs]').click()
  await page.locator('[data-analytics-runs="r-833"]').waitFor({ timeout: 10000 })
  const rows = await page.locator('[data-run]').evaluateAll((els) => els.map((e) => e.dataset.run))
  check(`${tag}: the runs list leads with the run just sent`, rows.join() === 'run-now-3,run-410,run-old', rows.join())
  const now = page.locator('[data-run="run-now-3"]')
  check(
    `${tag}: … its trigger, recipients, outcome and values`,
    (await now.locator('[data-run-trigger="sendNow"]').count()) === 1 &&
      (await now.locator('[data-run-recipient]').count()) === 2 &&
      (await now.locator('[data-run-outcome="sent"]').count()) === 1 &&
      (await now.locator('[data-run-values] [data-board-filter-chips]').count()) === 1,
  )
  check(`${tag}: … with its email and PDF while kept`, (await now.locator('[data-run-html]').count()) === 1 && (await now.locator('[data-run-pdf]').count()) === 1)
  const popup = page.waitForEvent('popup', { timeout: 10000 })
  await now.locator('[data-run-html]').click()
  await popup
  check(`${tag}: opening the email asks the Html door`, calls.includes('Analytics/ReportRun/run-now-3/Html'))
  check(`${tag}: a run past 90 days says "no longer kept", the record still listed`, (await page.locator('[data-run="run-old"] [data-run-expired]').count()) === 1 && (await page.locator('[data-run="run-old"] [data-run-trigger="late"]').count()) === 1)
  check(`${tag}: … and names who was dropped from it`, (await page.locator('[data-run="run-old"] [data-run-dropped]').innerText()).includes('Sara Alqahtani'))
  await page.locator('[data-run="run-410"] [data-run-html]').click()
  await page.locator('[data-run="run-410"] [data-run-expired]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${tag}: a 410 on open turns a kept run to "no longer kept"`, (await page.locator('[data-run="run-410"] [data-run-expired]').count()) === 1)
  if (dir === 'rtl') check(`${tag}: the page is RTL`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  await page.screenshot({ path: `${SHOTS}/833-${dir}-runs.png`, fullPage: true })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 833 — a runner (in the audience, no author grant) sees no Schedules button, but the Kept runs link (a recipient's runs, story 127). */
async function runnerNoSchedules833() {
  const tag = '833 runner'
  const { context, page, errors } = await open({ access: RUNNER, model: MODEL_827 })
  await page.goto(`${BASE}/analytics/report/r-833`)
  await page.locator('[data-analytics-report="r-833"]').waitFor({ timeout: 30000 })
  check(`${tag}: no Schedules for a runner`, (await page.locator('[data-report-schedules]').count()) === 0)
  check(`${tag}: … but the Kept runs link, since a recipient may open their own runs`, (await page.locator('[data-report-runs]').count()) === 1)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 828 ──────────────────────────────────────────────────────────────────────────────────────────────
// The report designer: outline · page · inspector, the history, drag and drop and keyboard moves, save.
const sections828 = (page) => page.locator('[data-designer-sections] [data-designer-section]').evaluateAll((els) => els.map((e) => e.dataset.designerSection).join(','))
const blocks828 = (page, sid) =>
  page.locator(`[data-designer-section="${sid}"] [data-designer-block]`).evaluateAll((els) => els.map((e) => e.dataset.designerBlock).join(','))
const outlineGrip828 = (page, key) => page.locator(`[data-designer-outline-nav] [data-designer-grip="${key}"]`)
const outlineRow828 = (page, key) => page.locator(`[data-designer-outline="${key}"]`)

async function designer828({ dir }) {
  const tag = `828 ${dir}`
  const { context, page, bodies, errors } = await open({ dir, height: 1500, access: AUTHOR, model: MODEL_827 })
  await page.goto(`${BASE}/analytics`)
  await page.locator('[data-analytics-new-report]').click()
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 30000 })
  check(`${tag}: "New report" opens the designer`, page.url().endsWith('/analytics/new?kind=report'), page.url())
  check(
    `${tag}: outline, page and inspector side by side`,
    (await page.locator('[data-designer-outline-nav]').count()) === 1 && (await page.locator('[data-designer-page]').count()) === 1 && (await page.locator('[data-designer-inspector]').count()) === 1,
  )
  const undoBtn = page.locator('[data-designer-undo]')
  const redoBtn = page.locator('[data-designer-redo]')
  check(`${tag}: nothing to undo yet`, await undoBtn.isDisabled())

  // Typing the title: one step.
  await page.locator('[data-designer-title-input="en"]').pressSequentially('Weekly review', { delay: 15 })
  await page.locator('[data-designer-title]').click()
  await undoBtn.click()
  check(`${tag}: typing the title is ONE undo step`, (await page.locator('[data-designer-title-input="en"]').inputValue()) === '' && (await undoBtn.isDisabled()))
  await redoBtn.click()
  check(`${tag}: … and Redo brings it back`, (await page.locator('[data-designer-title-input="en"]').inputValue()) === 'Weekly review')

  // Three sections, headed in the inspector.
  for (const name of ['One', 'Two', 'Three']) {
    await page.locator('[data-designer-add-section]').click()
    await page.locator('[data-designer-section-inspector] [data-designer-heading="en"]').fill(name)
  }
  check(`${tag}: three sections in order`, (await sections828(page)) === 's1,s2,s3', await sections828(page))
  const outlined = await page.locator('[data-designer-outline^="section:"]').allInnerTexts()
  check(`${tag}: the outline names them`, outlined.map((x) => x.trim()).join(',') === 'One,Two,Three', outlined.join(','))
  check(`${tag}: the inspector is a pane, never a modal`, (await page.locator('[role="dialog"]').count()) === 0)

  // Drag s3 to the top by its outline grip: one step.
  await outlineGrip828(page, 'section:s3').dragTo(outlineRow828(page, 'section:s1'), { targetPosition: { x: 10, y: 2 } })
  check(`${tag}: a section dragged in the outline goes to the top`, (await sections828(page)) === 's3,s1,s2', await sections828(page))
  check(`${tag}: … and the page never scrolled for the drag`, (await page.evaluate(() => window.scrollY)) === 0)
  await page.locator('[data-designer-title]').click()
  await page.keyboard.press('Control+z')
  check(`${tag}: Ctrl+Z puts it back`, (await sections828(page)) === 's1,s2,s3', await sections828(page))
  await page.keyboard.press('Control+y')
  check(`${tag}: Ctrl+Y moves it again`, (await sections828(page)) === 's3,s1,s2', await sections828(page))
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+Shift+z')
  check(`${tag}: Ctrl+Shift+Z redoes too`, (await sections828(page)) === 's3,s1,s2', await sections828(page))

  // On the page: s2 dragged by its heading grip into the top half of s3 — before it.
  await page.locator('[data-designer-page] [data-designer-grip="section:s2"]').dragTo(page.locator('[data-designer-section="s3"]'), { targetPosition: { x: 40, y: 8 } })
  check(`${tag}: a section dragged on the page lands before the one it is dropped on (top half)`, (await sections828(page)) === 's2,s3,s1', await sections828(page))

  // A text block in s1, dragged across sections in the outline, then moved by the keyboard's up and down.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-add-text="s1"]').click()
  check(`${tag}: "Add to this section" adds a text block`, (await blocks828(page, 's1')) === 't1', await blocks828(page, 's1'))
  check(`${tag}: … selected in the inspector`, (await page.locator('[data-designer-block-inspector="t1"]').count()) === 1)
  await outlineGrip828(page, 'block:t1').dragTo(outlineRow828(page, 'section:s3'), { targetPosition: { x: 10, y: 6 } })
  check(`${tag}: a block dragged onto another section lands at its end`, (await blocks828(page, 's3')) === 't1' && (await blocks828(page, 's1')) === '', `${await blocks828(page, 's3')} | ${await blocks828(page, 's1')}`)
  await page.locator('[data-designer-outline-nav] [data-designer-up="outline-block:t1"]').click()
  check(`${tag}: up at a section's top crosses into the section above`, (await blocks828(page, 's2')) === 't1', await blocks828(page, 's2'))
  await page.locator('[data-designer-outline-nav] [data-designer-down="outline-block:t1"]').click()
  check(`${tag}: down brings it back`, (await blocks828(page, 's3')) === 't1', await blocks828(page, 's3'))

  // Remove s1: no dialog, "Removed … · Undo".
  await page.locator('[data-designer-page] [data-designer-remove="section:s1"]').click()
  check(`${tag}: a section is removed with no dialog`, (await sections828(page)) === 's2,s3' && (await page.locator('[role="dialog"], [role="alertdialog"]').count()) === 0, await sections828(page))
  const notice = (await page.locator('[data-designer-notice="section"]').innerText().catch(() => '')).trim()
  check(`${tag}: "Removed … · Undo" names it`, notice.includes('One'), notice)
  await page.locator('[data-designer-notice-undo]').click()
  check(`${tag}: Undo puts it back where it was`, (await sections828(page)) === 's2,s3,s1' && (await page.locator('[data-designer-notice]').count()) === 0, await sections828(page))
  await redoBtn.click()
  check(`${tag}: Redo removes it again`, (await sections828(page)) === 's2,s3', await sections828(page))
  await page.locator('[data-designer-title]').click()
  await page.keyboard.press('Control+z')
  check(`${tag}: … and Ctrl+Z restores it once more`, (await sections828(page)) === 's2,s3,s1', await sections828(page))
  await page.screenshot({ path: `${SHOTS}/828-designer-${dir}.png`, fullPage: false })

  // Save: a new Personal report, its designer opened with the history kept.
  check(`${tag}: unsaved before the save`, (await page.locator('[data-designer-unsaved-marker]').count()) === 1)
  await page.locator('[data-editor-save]').click()
  await page.waitForURL(/\/analytics\/report\/r-new\/edit$/, { timeout: 10000 })
  const created = (bodies['Analytics/Item'] ?? []).at(-1)
  check(
    `${tag}: Save posts a report with its sections in order`,
    created?.kind === 'report' && created?.title?.en === 'Weekly review' && created?.definition?.sections?.map((x) => x.id).join(',') === 's2,s3,s1' && created.definition.sections[1].blocks[0]?.id === 't1',
    JSON.stringify(created?.definition?.sections?.map((x) => x.id)),
  )
  await page.locator('[data-report-designer="r-new"]').waitFor({ timeout: 10000 })
  check(`${tag}: … opens its designer, the unsaved marker gone`, (await page.locator('[data-designer-unsaved-marker]').count()) === 0)
  check(`${tag}: … with the history kept`, !(await undoBtn.isDisabled()) && (await sections828(page)) === 's2,s3,s1')
  await page.locator('[data-designer-outline-nav] [data-designer-up="outline-section:s1"]').click()
  await page.locator('[data-editor-save]').click()
  await page.locator('[data-designer-unsaved-marker]').waitFor({ state: 'detached', timeout: 10000 })
  const put = (bodies['PUT Analytics/Item/r-new'] ?? []).at(-1)
  check(`${tag}: the next save is in place at baseRevision 1`, put?.baseRevision === 1 && put?.definition?.sections?.map((x) => x.id).join(',') === 's2,s1,s3', JSON.stringify(put && { b: put.baseRevision, s: put.definition?.sections?.map((x) => x.id) }))

  // Preview: the runner's page, no tools.
  await page.locator('[data-designer-preview]').click()
  await page.locator('[data-designer-preview-page]').waitFor({ timeout: 10000 })
  const previewed = await page.locator('[data-designer-preview-page] [data-report-section]').evaluateAll((els) => els.map((e) => e.dataset.reportSection).join(','))
  check(`${tag}: Preview shows the runner's page, sections in order`, previewed === 's2,s1,s3', previewed)
  check(`${tag}: … with no grip, tool or undo`, (await page.locator('[data-designer-grip], [data-designer-undo], [data-designer-remove]').count()) === 0)
  await page.locator('[data-designer-back]').click()
  check(`${tag}: back in the designer`, (await sections828(page)) === 's2,s1,s3')
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 829 ──────────────────────────────────────────────────────────────────────────────────────────────
// The designer's editors: the panel editor (provenance, area, measures, chart, series, parameters), the text editor
// with live figures as chips, the summary block, and the 411 list for a figure that names a missing panel.
const inspector829 = (page) => page.locator('[data-designer-inspector]')
const enChips829 = (page) => page.locator('[data-designer-text-field="en"] [data-figure-token]').evaluateAll((els) => els.map((e) => e.dataset.figureToken).join(','))

async function designer829({ dir }) {
  const tag = `829 ${dir}`
  const { context, page, bodies, errors } = await open({ dir, height: 1500, access: AUTHOR, model: MODEL_827, list: [...LIST, ITEMS['v-825']] })
  await page.goto(`${BASE}/analytics/new?kind=report`)
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 30000 })
  await page.locator('[data-designer-title-input="en"]').fill('Channel sales')
  await page.locator('[data-designer-add-section]').click()
  await page.locator('[data-designer-section-inspector] [data-designer-heading="en"]').fill('Sales by channel')
  // The report's period: declared first, so every panel added after binds to it.
  await page.locator('[data-designer-outline-add-param]').click()
  await page.locator('[data-param-kind="period"]').click()
  await page.locator('[data-param-inspector-close]').click()

  // 1a. A chart or table, reshaped: net value (till value) by channel, as vertical bars.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-add-panel="s1"]').click()
  await inspector829(page).locator('[data-designer-panel-editor="p1"]').waitFor({ timeout: 10000 })
  check(`${tag}: "Chart or table" adds a panel, opened in the panel editor`, (await page.locator('[data-designer-block="p1"]').count()) === 1)
  check(`${tag}: … a new panel is one figure (a KPI) to start`, (await page.locator('[data-analytics-choice="kpi"][aria-pressed="true"]').count()) === 1)
  await inspector829(page).locator('[data-analytics-chosen-measures] button').first().click()
  await inspector829(page).locator('[data-analytics-measure="till_value"]').click()
  await pick(page, 'editor-dimensions', ['channel_group'])
  const offered = await offeredChoices(page)
  check(`${tag}: only the fitting chart types are offered (no line without a date)`, !offered.includes('line') && offered.includes('bar-vertical'), offered.join(','))
  await page.locator('[data-analytics-choice="bar-vertical"]').click()
  await page.locator('[data-designer-block="p1"] [data-chart="bar"]').waitFor({ timeout: 10000 })
  check(`${tag}: the page draws the panel as edited`, (await page.locator('[data-designer-block="p1"] [data-chart="bar"]').count()) === 1)
  await page.locator('[data-designer-panel-title="en"]').fill('Net sales by channel')
  await page.locator('[data-designer-panel-title="ar"]').fill('صافي المبيعات حسب القناة')
  const outlined = await page.locator('[data-designer-outline="block:p1"]').innerText()
  check(`${tag}: the outline names the panel by its title`, outlined.includes('Net sales by channel'), outlined)

  // 1b. Copy a saved view: its definition inline, its provenance shown and recorded.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-copy-pick="s1"]').selectOption('v-825')
  await page.locator('[data-designer-copy-go="s1"]').click()
  await inspector829(page).locator('[data-designer-panel-editor="p2"]').waitFor({ timeout: 10000 })
  await page.locator('[data-designer-provenance="v-825"]').waitFor({ timeout: 10000 })
  const prov = noIsolates(await page.locator('[data-designer-provenance="v-825"]').innerText())
  check(`${tag}: "Copy a saved view" says where it came from and which revision`, prov.includes('HungerStation against QC') && prov.includes('3'), prov)
  check(`${tag}: … not changed since the copy`, (await page.locator('[data-designer-source-changed="no"]').count()) === 1)
  check(`${tag}: … its two series came with it`, (await inspector829(page).locator('[data-editor-series-row]').count()) === 2)

  // 1c. A cancellation rate panel with HungerStation and QC series, by hand.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-add-panel="s1"]').click()
  await inspector829(page).locator('[data-designer-panel-editor="p3"]').waitFor({ timeout: 10000 })
  await page.locator('[data-designer-panel-area]').selectOption('orders')
  check(`${tag}: picking the orders area starts on its measure`, (await inspector829(page).locator('[data-analytics-chosen-measures] button').count()) === 1)
  await pick(page, 'editor-dimensions', ['day'])
  await page.locator('[data-analytics-choice="line"]').click()
  check(`${tag}: over a date, a line is offered and taken`, (await page.locator('[data-analytics-choice="line"][aria-pressed="true"]').count()) === 1)
  for (const [i, en, ar, dim, value] of [
    [1, 'HungerStation', 'هنقرستيشن', 'channel_group', 'hungerstation'],
    [2, 'QC', 'التوصيل السريع', 'delivery_type', 'QC'],
  ]) {
    await page.locator('[data-editor-add-series]').click()
    const row = inspector829(page).locator(`[data-editor-series-row="s${i}"]`)
    await row.locator('[data-editor-series-label="en"]').fill(en)
    await row.locator('[data-editor-series-label="ar"]').fill(ar)
    await row.locator(`[data-editor-series-dimension="s${i}:0"]`).selectOption(dim)
    await pick(page, `editor-series-values-s${i}-0`, [value])
  }
  check(`${tag}: two named series on the rate panel`, (await inspector829(page).locator('[data-editor-series-row]').count()) === 2)
  const params = inspector829(page).locator('[data-designer-panel-param]')
  check(`${tag}: the panel's parameter list holds the report's parameters`, (await params.count()) > 0, String(await params.count()))
  const free = inspector829(page).locator('[data-designer-panel-param][data-bound="yes"]').first()
  if ((await free.count()) === 1) {
    const name = await free.getAttribute('data-designer-panel-param')
    const row = inspector829(page).locator(`[data-designer-panel-param="${name}"]`)
    await row.locator('[data-designer-panel-bind]').click()
    check(`${tag}: … a chip unbinds the parameter from the panel`, (await row.getAttribute('data-bound')) === 'no', name)
    await page.locator('[data-designer-undo]').click()
    check(`${tag}: … one undo step`, (await row.getAttribute('data-bound')) === 'yes')
  } else check(`${tag}: … a bound parameter to unbind`, false)

  // 2. A text block with live figures.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-add-text="s1"]').click()
  const en = page.locator('[data-designer-text-field="en"]')
  await en.click()
  await page.keyboard.type('HungerStation took ')
  await page.locator('[data-designer-figure-into="en"]').click()
  await page.locator('[data-designer-figure-panel]').selectOption('p2')
  await page.locator('[data-designer-figure-value]').selectOption('hs')
  await page.locator('[data-designer-figure-insert]').click()
  check(`${tag}: "Insert a live figure" writes a chip`, (await enChips829(page)) === '{p2:hs}', await enChips829(page))
  await en.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' orders against QC’s ')
  await page.locator('[data-designer-figure-value]').selectOption('qc')
  await page.locator('[data-designer-figure-insert]').click()
  check(`${tag}: … a second one where the caret was`, (await enChips829(page)) === '{p2:hs},{p2:qc}', await enChips829(page))
  await page.locator('[data-designer-undo]').click()
  check(`${tag}: an insert is one undo step`, (await enChips829(page)) === '{p2:hs}', await enChips829(page))
  await page.locator('[data-designer-redo]').click()
  await en.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type('; {p1:total} in all.')
  check(`${tag}: a token typed as words becomes a chip`, (await enChips829(page)) === '{p2:hs},{p2:qc},{p1:total}', await enChips829(page))
  const pageText = await page.locator('[data-designer-text="t1"]').innerText()
  const previewText = await page.locator('[data-designer-text-preview]').innerText()
  const fieldText = await en.innerText()
  const pageChips = await page.locator('[data-designer-text="t1"] [data-designer-figure-chip]').count()
  check(
    `${tag}: chips on the page, in the preview and in the field — never a raw token`,
    ![pageText, previewText, fieldText].some((x) => /\{p\d+:/.test(x)) && pageChips === 3,
    `${pageChips} | ${previewText}`,
  )
  check(`${tag}: each chip names its panel and figure`, noIsolates(await page.locator('[data-designer-text-preview-lang="en"] [data-designer-figure-chip="{p2:hs}"]').innerText()).includes('HungerStation'))
  await page.screenshot({ path: `${SHOTS}/829-text-${dir}.png`, fullPage: false })

  // 3. The summary: added once, removed, undone.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-add-summary="s1"]').click()
  check(`${tag}: the summary block is added`, (await page.locator('[data-designer-block="sum"]').count()) === 1 && (await page.locator('[data-designer-summary-explain]').count()) === 1)
  await page.locator('[data-designer-open-add="s1"]').click()
  check(`${tag}: … at most one: a second is not offered`, (await page.locator('[data-designer-add-summary="s1"]').getAttribute('aria-disabled')) === 'true')
  await page.locator('[data-designer-add-summary="s1"]').click({ force: true })
  check(`${tag}: … and clicking it adds none`, (await page.locator('[data-designer-block^="sum"]').count()) === 1)
  await page.locator('[data-designer-remove-block="sum"]').click()
  check(`${tag}: the summary is removed`, (await page.locator('[data-designer-block="sum"]').count()) === 0)
  await page.locator('[data-designer-notice-undo]').click()
  check(`${tag}: … and Undo brings it back`, (await page.locator('[data-designer-block="sum"]').count()) === 1)

  // 4. A figure naming a removed panel: a red chip, and Save lists it (411).
  await page.locator('[data-designer-outline="block:p1"]').click()
  await page.locator('[data-designer-remove-block="p1"]').click()
  await page.locator('[data-designer-outline="block:t1"]').click()
  check(`${tag}: a figure whose panel is gone is a red chip`, (await page.locator('[data-designer-text-field="en"] [data-figure-token="{p1:total}"][data-figure-ok="no"]').count()) === 1)
  const posts = (bodies['Analytics/Item'] ?? []).length
  await page.locator('[data-editor-save]').click()
  await page.locator('[data-declaration-problem="figure"]').waitFor({ timeout: 5000 })
  check(`${tag}: Save lists the figure that names a missing panel, and posts nothing`, (bodies['Analytics/Item'] ?? []).length === posts)
  await page.locator('[data-designer-outline="block:p2"]').click()
  await page.locator('[data-declaration-problem-go]').first().click()
  check(`${tag}: … the problem takes the author to the text`, (await page.locator('[data-designer-text-editor="t1"]').count()) === 1)
  await page.locator('[data-declaration-problems-close]').click()
  await page.locator('[data-designer-undo]').click()
  check(`${tag}: undone, the chip is whole again`, (await page.locator('[data-designer-text-field="en"] [data-figure-ok="no"]').count()) === 0)

  // Save: the sample report's blocks as built.
  await page.locator('[data-editor-save]').click()
  await page.waitForURL(/\/analytics\/report\/r-new\/edit$/, { timeout: 10000 })
  const made = (bodies['Analytics/Item'] ?? []).at(-1)
  const blocks = made?.definition?.sections?.[0]?.blocks ?? []
  const byId = Object.fromEntries(blocks.map((b) => [b.id, b]))
  check(`${tag}: Save posts the blocks in order`, blocks.map((b) => b.id).join(',') === 'p1,p2,p3,t1,sum', blocks.map((b) => b.id).join(','))
  check(
    `${tag}: … the panel as edited`,
    byId.p1?.definition?.chart?.type === 'bar' && byId.p1.definition.query.measures.join() === 'till_value' && byId.p1.definition.query.dimensions.join() === 'channel_group' && byId.p1.title?.en === 'Net sales by channel',
    JSON.stringify(byId.p1?.definition),
  )
  check(`${tag}: … the copy with its provenance`, byId.p2?.from?.viewId === 'v-825' && byId.p2.from.revision === 3 && byId.p2.definition?.series?.length === 2, JSON.stringify(byId.p2?.from))
  check(
    `${tag}: … the rate panel with HungerStation and QC`,
    byId.p3?.definition?.query?.measures?.join() === 'cancellation_rate' &&
      JSON.stringify(byId.p3.definition.series?.map((x) => [x.label.en, x.filters])) ===
        JSON.stringify([
          ['HungerStation', [{ dimension: 'channel_group', values: ['hungerstation'] }]],
          ['QC', [{ dimension: 'delivery_type', values: ['QC'] }]],
        ]),
    JSON.stringify(byId.p3?.definition?.series),
  )
  check(`${tag}: … the text with its tokens`, byId.t1?.text?.en === 'HungerStation took {p2:hs} orders against QC’s {p2:qc}; {p1:total} in all.', byId.t1?.text?.en)
  check(`${tag}: … and one summary`, blocks.filter((b) => b.kind === 'summary').length === 1)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 832: the copilot builds a report, then edits it in the designer as one undo step ─────────────────────────
const SENTENCE_832 =
  'How were sales for each channel yesterday? Focus on two order types, HungerStation and QC, compare them, and show their cancellation rates. The period is a parameter that defaults to yesterday and can be changed. Save it as a report template my team can re-run, schedule it every day by email to named people, and include charts.'
const EDIT_832 = 'add the cancellation rate as a bar'

async function copilotReport832({ dir }) {
  const tag = `832 ${dir}`
  const { context, page, bodies, errors } = await open({
    dir,
    height: 1500,
    access: AUTHOR,
    model: MODEL_827,
    copilot: 'granted',
    copilotAnswer: (body) => (body.reportContext ? editAnswer832(body) : CREATE_ANSWER_832),
  })
  await page.goto(`${BASE}/analytics`)
  const button = page.locator('#layout-topbar [data-copilot-button]')
  const sheet = page.locator('dialog[data-copilot-sheet]')
  const turns = sheet.locator('[data-copilot-turn]')
  await button.waitFor({ timeout: 30000 })
  await button.click()
  await sheet.locator('[data-copilot-question]').fill(SENTENCE_832)
  await sheet.locator('[data-copilot-send]').click()
  const openLink = turns.nth(0).locator('[data-copilot-report-open="r-832"]')
  await openLink.waitFor({ timeout: 10000 })
  const first = (bodies['Copilot/Ask'] ?? [])[0] ?? {}
  check(`${tag}: the acceptance sentence asks with no report in context`, first.reportContext === undefined && first.question === SENTENCE_832, JSON.stringify(Object.keys(first)))
  check(`${tag}: the built report reads "Open in designer", to its designer`, clean(await openLink.innerText()) === 'Open in designer' && (await openLink.getAttribute('href')) === '/analytics/report/r-832/edit', await openLink.getAttribute('href'))
  const title = clean(await turns.nth(0).locator('[data-copilot-report-title]').innerText())
  check(`${tag}: … titled in the reader's language`, title === 'Channel sales: HungerStation against QC', title)
  const assumed = await turns.nth(0).locator('[data-copilot-assumption]').allInnerTexts()
  check(`${tag}: the assumptions are a list, one line each`, assumed.length === 3 && clean(assumed[0]) === 'Period: a parameter, default yesterday', JSON.stringify(assumed))
  await turns.nth(0).locator('details[data-copilot-trace] summary').click()
  const traced = await turns.nth(0).locator('[data-copilot-trace-label]').allInnerTexts()
  check(`${tag}: the trace says "Built a report"`, traced.map(clean).includes('Built a report'), JSON.stringify(traced))
  await page.screenshot({ path: `${SHOTS}/832-built-${dir}.png` })
  const steps = await turns.nth(0).locator('[data-copilot-report-step]').evaluateAll((els) => els.map((e) => `${e.dataset.copilotReportStep}>${e.getAttribute('href')}`).join(','))
  check(`${tag}: the sentence asked to share and schedule, so the answer ends with "Share…" and "Schedule…" links to the report's dialogs`, steps === 'share>/analytics/report/r-832#share,schedule>/analytics/report/r-832#schedule', steps)

  // Open in designer: the sheet closes and the report is the designer's, nothing to undo yet.
  await openLink.click()
  await page.locator('[data-report-designer="r-832"]').waitFor({ timeout: 10000 })
  check(`${tag}: "Open in designer" opens its designer`, page.url().endsWith('/analytics/report/r-832/edit'), page.url())
  const undoBtn = page.locator('[data-designer-undo]')
  const redoBtn = page.locator('[data-designer-redo]')
  const before = await blocks828(page, 's2')
  check(`${tag}: … with nothing to undo`, (await undoBtn.isDisabled()) && before === 'p2,p3,t2', before)

  // The follow-up edits THAT report: one step, labelled with the request, never saved.
  await button.click()
  await sheet.locator('[data-copilot-question]').fill(EDIT_832)
  await sheet.locator('[data-copilot-send]').click()
  await turns.nth(1).locator('[data-copilot-report-edit="r-832"]').waitFor({ timeout: 10000 })
  const asked = (bodies['Copilot/Ask'] ?? [])[1]
  check(
    `${tag}: the follow-up sends the report in context { reportId, revision, draft }`,
    asked?.conversationId === 'c-832' && asked?.reportContext?.reportId === 'r-832' && asked.reportContext.revision === 1 && asked.reportContext.draft?.definition?.sections?.length === 4 && asked.reportContext.draft.title?.en === 'Channel sales: HungerStation against QC',
    JSON.stringify(asked && { c: asked.conversationId, r: asked.reportContext?.reportId, v: asked.reportContext?.revision }),
  )
  await turns.nth(1).locator('details[data-copilot-trace] summary').click()
  const traced2 = await turns.nth(1).locator('[data-copilot-trace-label]').allInnerTexts()
  check(`${tag}: the trace says "Edited the report"`, traced2.map(clean).includes('Edited the report'), JSON.stringify(traced2))
  await page.screenshot({ path: `${SHOTS}/832-edited-panel-${dir}.png` })
  await page.keyboard.press('Escape')
  await sheet.waitFor({ state: 'detached', timeout: 5000 })
  check(`${tag}: the edit lands in the designer`, (await blocks828(page, 's2')) === 'p2,p3,t2,p5', await blocks828(page, 's2'))
  const stepLabel = clean(await page.locator('[data-designer-ai-label]').innerText().catch(() => ''))
  check(`${tag}: … as one step labelled "AI: <the request>"`, stepLabel === `AI: ${EDIT_832}` || stepLabel === `الذكاء الاصطناعي: ${EDIT_832}`, stepLabel)
  check(`${tag}: … unsaved, and never saved by the AI`, (await page.locator('[data-designer-unsaved-marker]').count()) === 1 && Object.keys(bodies).every((k) => !k.startsWith('PUT ')), Object.keys(bodies).join(','))
  await page.screenshot({ path: `${SHOTS}/832-edited-designer-${dir}.png` })
  await undoBtn.click()
  check(`${tag}: one Undo takes the whole edit back`, (await blocks828(page, 's2')) === 'p2,p3,t2' && (await undoBtn.isDisabled()) && (await page.locator('[data-designer-ai-step]').count()) === 0, await blocks828(page, 's2'))
  check(`${tag}: … and the unsaved marker with it`, (await page.locator('[data-designer-unsaved-marker]').count()) === 0)
  await redoBtn.click()
  check(`${tag}: Redo puts it back`, (await blocks828(page, 's2')) === 'p2,p3,t2,p5', await blocks828(page, 's2'))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** Story 70: a report can be started from the builder (new view, new board), not only the home. */
async function builderNewReport828() {
  const tag = '828 builder'
  const { context, page, errors } = await open({ access: AUTHOR })
  for (const kind of ['view', 'board']) {
    await page.goto(`${BASE}/analytics/new?kind=${kind}`)
    const link = page.locator('[data-analytics-builder-new-report]')
    await link.waitFor({ timeout: 30000 }).catch(() => {})
    check(`${tag}: the new ${kind} builder offers "Start a report instead"`, (await link.count()) === 1 && (await link.getAttribute('href')) === '/analytics/new?kind=report', String(await link.getAttribute('href').catch(() => null)))
  }
  await page.locator('[data-analytics-builder-new-report]').click()
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 15000 }).catch(() => {})
  check(`${tag}: … which opens the report designer`, (await page.locator('[data-report-designer="new"]').count()) === 1)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** Stories 15 and 91: a report has a history — revisions, revert, and the audience event — on its page and in its designer. */
async function reportHistory827() {
  const tag = '827 history'
  const old = { title: { en: 'Channel sales (draft)', ar: 'مبيعات القنوات (مسودة)' }, definition: REPORT_832.definition }
  const revisions = {
    'r-832': [
      { revision: 1, updatedAt: '2026-11-01T08:15:00', updatedBy: 'msartawi', snapshot: old },
      { revision: 1, updatedAt: '2026-11-02T09:00:00', updatedBy: 'msartawi', event: 'audience' },
      { revision: 2, updatedAt: '2026-11-03T11:30:00', updatedBy: 'msartawi', snapshot: { title: REPORT_832.title, definition: REPORT_832.definition } },
    ],
  }
  const items = { ...ITEMS, 'r-832': { ...REPORT_832, revision: 2 } }
  {
    const { context, page, bodies, errors } = await open({ access: AUTHOR, model: MODEL_827, items, revisions })
    await page.goto(`${BASE}/analytics/report/r-832`)
    await page.locator('[data-analytics-report="r-832"]').waitFor({ timeout: 30000 })
    await page.locator('[data-analytics-history-open]').click()
    await page.locator('[data-analytics-revisions]').waitFor({ timeout: 10000 })
    check(`${tag}: the report page lists its revisions and the audience change`, (await page.locator('[data-analytics-revision]').count()) === 2 && (await page.locator('[data-analytics-history-event="audience"]').count()) === 1)
    await page.locator('[data-analytics-revert="1"]').click()
    await page.locator('[data-analytics-revert-done]').waitFor({ timeout: 10000 })
    check(`${tag}: revert writes a new revision`, (bodies['Analytics/Item/r-832/Revert'] ?? [])[0]?.revision === 1, JSON.stringify(bodies['Analytics/Item/r-832/Revert']))
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[data-analytics-report-title]')?.textContent?.includes('(draft)'), null, { timeout: 10000 }).catch(() => {})
    check(`${tag}: … and the page re-reads the report at it`, clean(await page.locator('[data-analytics-report-title]').innerText()).includes('(draft)'), await page.locator('[data-analytics-report-title]').innerText())
    check(`${tag}: page: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open({ height: 1500, access: AUTHOR, model: MODEL_827, items, revisions })
    await page.goto(`${BASE}/analytics/report/r-832/edit`)
    await page.locator('[data-report-designer="r-832"]').waitFor({ timeout: 30000 })
    await page.locator('[data-analytics-history-open]').click()
    await page.locator('[data-analytics-revert="1"]').click()
    await page.locator('[data-analytics-revert-done]').waitFor({ timeout: 10000 })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[data-designer-title]')?.textContent?.includes('(draft)'), null, { timeout: 10000 }).catch(() => {})
    check(`${tag}: in the designer, a revert lands the reverted report`, clean(await page.locator('[data-designer-title]').innerText()).includes('(draft)'), await page.locator('[data-designer-title]').innerText())
    check(`${tag}: … saved (no unsaved marker), and one Undo away from the draft before`, (await page.locator('[data-designer-unsaved-marker]').count()) === 0 && !(await page.locator('[data-designer-undo]').isDisabled()))
    check(`${tag}: designer: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

/** Story 95: Preview of a saved, unchanged report is the runner's page — its Words asked; a changed draft's are not. */
async function previewWords827() {
  const tag = '827 preview'
  const { context, page, bodies, errors } = await open({ height: 1500, access: AUTHOR, model: MODEL_827 })
  await page.goto(`${BASE}/analytics/report/r-832/edit`)
  await page.locator('[data-report-designer="r-832"]').waitFor({ timeout: 30000 })
  await page.locator('[data-designer-preview]').click()
  await page.locator('[data-designer-preview-page="saved"]').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelectorAll('[data-designer-preview-page] [data-report-figure]').length > 0, null, { timeout: 10000 }).catch(() => {})
  const asked = (bodies['Analytics/Report/r-832/Words'] ?? [])
  check(`${tag}: a saved report's preview asks the Words door as the runner's page does`, asked.length > 0 && asked[0].revision === 1, JSON.stringify(asked[0]))
  await page.locator('[data-designer-back]').click()
  await page.locator('[data-designer-title-input="en"]').fill('Changed')
  await page.locator('[data-designer-preview]').click()
  check(`${tag}: a changed draft previews as a draft`, (await page.locator('[data-designer-preview-page="draft"]').count()) === 1)
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 832 (story 108): "Share…" and "Schedule…" open the report's page with that dialog open; the AI shared and scheduled nothing. */
async function copilotSteps832({ dir }) {
  const tag = `832 steps ${dir}`
  for (const step of ['share', 'schedule']) {
    const { context, page, bodies, errors } = await open({ dir, access: AUTHOR, model: MODEL_827, copilot: 'granted', copilotAnswer: CREATE_ANSWER_832 })
    await page.goto(`${BASE}/analytics`)
    const button = page.locator('#layout-topbar [data-copilot-button]')
    const sheet = page.locator('dialog[data-copilot-sheet]')
    await button.waitFor({ timeout: 30000 })
    await button.click()
    await sheet.locator('[data-copilot-question]').fill(SENTENCE_832)
    await sheet.locator('[data-copilot-send]').click()
    await sheet.locator(`[data-copilot-report-step="${step}"]`).click()
    await page.locator('[data-analytics-report="r-832"]').waitFor({ timeout: 15000 })
    const dialog = step === 'share' ? '[data-analytics-share="share"]' : '[data-schedules]'
    await page.locator(dialog).waitFor({ timeout: 10000 }).catch(() => {})
    check(`${tag}: "${step === 'share' ? 'Share…' : 'Schedule…'}" opens the report with its ${step} dialog open`, (await page.locator(dialog).count()) === 1)
    check(`${tag}: … the hash is dropped, so a copied link never carries it`, !page.url().includes('#'), page.url())
    const wrote = Object.keys(bodies).filter((k) => /Share|Audience|Schedules/.test(k))
    check(`${tag}: … and nothing was shared or scheduled for the author`, wrote.length === 0, wrote.join(','))
    check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

/** 832 (story 101): a new report not saved yet is the report in context (no id); its edit lands as one undo step. */
async function copilotUnsaved832({ dir }) {
  const tag = `832 unsaved ${dir}`
  const { context, page, bodies, errors } = await open({
    dir,
    height: 1500,
    access: AUTHOR,
    model: MODEL_827,
    copilot: 'granted',
    copilotAnswer: (body) => (body.reportContext ? editAnswer832(body) : CREATE_ANSWER_832),
  })
  await page.goto(`${BASE}/analytics/new?kind=report`)
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 30000 })
  await page.locator('[data-designer-title-input="en"]').fill('Draft sales')
  await page.locator('[data-designer-add-section]').click()
  const button = page.locator('#layout-topbar [data-copilot-button]')
  const sheet = page.locator('dialog[data-copilot-sheet]')
  await button.click()
  await sheet.locator('[data-copilot-question]').fill(EDIT_832)
  await sheet.locator('[data-copilot-send]').click()
  await sheet.locator('[data-copilot-report-edit="new"]').waitFor({ timeout: 10000 }).catch(() => {})
  const asked = (bodies['Copilot/Ask'] ?? [])[0]
  check(
    `${tag}: the unsaved report is sent in context, with no id, revision 0 and its draft`,
    asked?.reportContext?.reportId === null && asked.reportContext.revision === 0 && asked.reportContext.draft?.title?.en === 'Draft sales' && asked.reportContext.draft.definition?.sections?.length === 1,
    JSON.stringify(asked?.reportContext && { r: asked.reportContext.reportId, v: asked.reportContext.revision }),
  )
  await page.keyboard.press('Escape')
  await sheet.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check(`${tag}: the edit lands in the unsaved designer`, (await blocks828(page, 's1')) === 'p5', await blocks828(page, 's1'))
  check(`${tag}: … as one step labelled with the request`, (await page.locator('[data-designer-ai-step]').count()) === 1)
  check(`${tag}: … and nothing was created or saved`, Object.keys(bodies).every((k) => !k.startsWith('PUT ') && k !== 'Analytics/Item'), Object.keys(bodies).join(','))
  await page.locator('[data-designer-undo]').click()
  check(`${tag}: one Undo takes it back`, (await blocks828(page, 's1')) === '', await blocks828(page, 's1'))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 829: the sample report's copied panel says the original has changed since the copy. */
async function provenance829() {
  const { context, page, errors } = await open({ height: 1500, access: AUTHOR, model: MODEL_827 })
  await page.goto(`${BASE}/analytics/report/r-827/edit`)
  await page.locator('[data-report-designer="r-827"]').waitFor({ timeout: 30000 })
  await page.locator('[data-designer-outline="block:p2"]').click()
  await page.locator('[data-designer-provenance="v-825"]').waitFor({ timeout: 10000 })
  check('829: a copied panel says "the original has changed since you copied it"', (await page.locator('[data-designer-source-changed-note]').count()) === 1)
  await page.locator('[data-designer-outline="block:t2"]').click()
  const chips = await page.locator('[data-designer-text-field="en"] [data-figure-token]').evaluateAll((els) => els.map((e) => `${e.dataset.figureToken}:${e.dataset.figureOk}`).join(','))
  check('829: the sample text’s four figures are chips, each a single value', chips === '{p2:hs}:yes,{p2:qc}:yes,{p3:hs}:yes,{p3:qc}:yes', chips)
  check('829: the page shows the text as chips', (await page.locator('[data-designer-text="t2"] [data-designer-figure-chip]').count()) === 4)
  check('829 provenance: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 830: Save as report ───────────────────────────────────────────────────────────────────────────────
// The 771 board (a section header first, five views, a text panel last; v1 filters and opt-outs).
async function saveAsReport830({ dir }) {
  const tag = `830 ${dir}`
  {
    const { context, page } = await open({ dir, access: RUNNER })
    await page.goto(`${BASE}/analytics/board/b-ops`)
    await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
    check(`${tag}: a runner is not offered "Save as report"`, (await page.locator('[data-analytics-board-save-report]').count()) === 0)
    await context.close()
  }
  const { context, page, bodies, errors } = await open({ dir, height: 1500, access: AUTHOR })
  await page.goto(`${BASE}/analytics/board/b-ops`)
  await page.locator('[data-analytics-board="b-ops"]').waitFor({ timeout: 10000 })
  const action = page.locator('[data-analytics-board-save-report]')
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-analytics-board-save-report]')
    return b && !b.disabled
  }, null, { timeout: 15000 })
  check(`${tag}: an author who may copy the board is offered "Save as report"`, (await action.innerText()).trim() !== '' && !/saveAsReport/.test(await action.innerText()) && (dir === 'rtl' || clean(await action.innerText()) === 'Save as report'), await action.innerText())
  await action.click()
  await page.locator('[data-report-designer="r-new"]').waitFor({ timeout: 15000 })
  check(`${tag}: it opens the new report in the designer`, page.url().endsWith('/analytics/report/r-new/edit'), page.url())
  const sent = (bodies['Analytics/Item'] ?? []).at(-1) ?? {}
  const blocks = sent.definition?.sections?.[0]?.blocks ?? []
  check(`${tag}: one item created, kind report, titled as the board`, (bodies['Analytics/Item'] ?? []).length === 1 && sent.kind === 'report' && sent.title?.en === 'Operations week', JSON.stringify(sent.title))
  check(
    `${tag}: the section panel is the heading, the panels follow in reading order`,
    sent.definition?.sections?.length === 1 && sent.definition.sections[0].heading.en === 'Orders' && blocks.map((b) => b.id).join(',') === 'p-kpi,p-bar,p-line,p-area,p-donut,p-note',
    blocks.map((b) => b.id).join(','),
  )
  const kpi = blocks.find((b) => b.id === 'p-kpi') ?? {}
  check(
    `${tag}: a view panel is copied inline with its provenance; the text panel is a text block`,
    kpi.kind === 'panel' && kpi.from?.viewId === 'v-kpi' && kpi.from?.revision === ITEMS['v-kpi'].revision && JSON.stringify(kpi.definition) === JSON.stringify(ITEMS['v-kpi'].definition) && blocks.at(-1)?.kind === 'text',
    JSON.stringify(kpi.from),
  )
  const binds = sent.definition?.bindings ?? {}
  check(
    `${tag}: the board's parameters and bindings are carried (the area panel's store opt-out stays out)`,
    (sent.definition?.params ?? []).map((p) => p.name).join(',') === 'period,city,region,store,channel,country' && binds.period?.['p-kpi'] === true && !binds.store?.['p-area'] && !binds.period?.['p-donut'],
    JSON.stringify(binds.store),
  )
  const shown = await blocks828(page, sent.definition?.sections?.[0]?.id ?? '')
  check(`${tag}: the designer holds the panels in order`, (await sections828(page)) === 'p-head' && shown === 'p-kpi,p-bar,p-line,p-area,p-donut,p-note', `${await sections828(page)} | ${shown}`)
  await page.screenshot({ path: `${SHOTS}/830-save-as-report-${dir}.png`, fullPage: false })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 831: the designer's tutorial builds the acceptance case, each step ticking itself from the draft ─────────────
const STEPS_831 = ['title', 'section', 'chart', 'series', 'rate', 'figure', 'summary', 'period']
const ticks831 = (page) =>
  page.locator('[data-designer-tutorial-step][data-done]').evaluateAll((els) => els.filter((e) => e.dataset.done === 'yes').map((e) => e.dataset.designerTutorialStep).join(','))
const progress831 = async (page) => noIsolates(await page.locator('[data-designer-tutorial-progress]').innerText()).trim()
const rawKeys831 = async (page) => ((await page.locator('body').innerText()).match(/\bdesigner\.tutorial\.[a-zA-Z.]+/g) ?? []).join(',')

async function tutorial831({ dir }) {
  const tag = `831 ${dir}`
  const { context, page, errors } = await open({ dir, height: 1500, access: AUTHOR, model: MODEL_827 })
  await page.goto(`${BASE}/analytics/new?kind=report`)
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 30000 })
  check(`${tag}: the tutorial is closed until asked for`, (await page.locator('[data-designer-tutorial]').count()) === 0)
  await page.locator('[data-designer-tutorial-action]').click()
  await page.locator('[data-designer-inspector] [data-designer-tutorial]').waitFor({ timeout: 5000 })
  check(`${tag}: "Tutorial" opens the checklist at the top of the inspector`, (await page.locator('[data-designer-inspector] > :first-child [data-designer-tutorial]').count()) === 1)
  check(`${tag}: a blank report ticks no step`, (await ticks831(page)) === '' && (await progress831(page)) === '0 / 8', `${await ticks831(page)} | ${await progress831(page)}`)
  check(`${tag}: … the next step says how`, (await page.locator('[data-designer-tutorial="title"]').count()) === 1)
  const sentence = noIsolates(await page.locator('[data-designer-tutorial-sentence]').innerText())
  check(`${tag}: the last step is "Or ask the copilot", with the acceptance sentence`, (await page.locator('[data-designer-tutorial-step="ask"]').count()) === 1 && sentence.length > 100, sentence.slice(0, 40))
  check(`${tag}: … and no ask button while the copilot is not there`, (await page.locator('[data-designer-tutorial-ask]').count()) === 0)
  check(`${tag}: no raw tutorial key on screen`, (await rawKeys831(page)) === '', await rawKeys831(page))
  await page.screenshot({ path: `${SHOTS}/831-blank-${dir}.png`, fullPage: false })
  const ticked = async (upTo, what) => {
    const want = STEPS_831.filter((s) => upTo.includes(s)).join(',')
    const got = await ticks831(page)
    check(`${tag}: ${what} ticks ${upTo.at(-1)}`, got === want, got)
  }
  const done = []

  // 1. The title, 2. a section.
  await page.locator('[data-designer-title-input="en"]').fill('Channel sales: HungerStation against QC')
  done.push('title')
  await ticked(done, 'typing a title')
  await page.locator('[data-designer-add-section]').click()
  await page.locator('[data-designer-section-inspector] [data-designer-heading="en"]').fill('Sales by channel')
  done.push('section')
  await ticked(done, 'adding a section')
  check(`${tag}: the tutorial stays at the top of the inspector, over the section editor`, (await page.locator('[data-designer-inspector] [data-designer-tutorial]').count()) === 1 && (await page.locator('[data-designer-section-inspector]').count()) === 1)

  // 3. Net sales by channel, as bars: a new panel starts as a KPI, which is not yet the chart.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-page] [data-designer-add-panel="s1"]').click()
  await inspector829(page).locator('[data-designer-panel-editor="p1"]').waitFor({ timeout: 10000 })
  await ticked(done, 'a KPI panel never')
  await inspector829(page).locator('[data-analytics-chosen-measures] button').first().click()
  await inspector829(page).locator('[data-analytics-measure="till_value"]').click()
  await pick(page, 'editor-dimensions', ['channel_group'])
  await page.locator('[data-analytics-choice="bar-vertical"]').click()
  done.push('chart')
  await ticked(done, 'net sales by channel as bars')

  // 4. Orders, HungerStation against QC: one series is not the comparison, two are.
  const series831 = async (rows) => {
    for (const [i, en, dim, value] of rows) {
      await page.locator('[data-editor-add-series]').click()
      const row = inspector829(page).locator(`[data-editor-series-row="s${i}"]`)
      await row.locator('[data-editor-series-label="en"]').fill(en)
      await row.locator(`[data-editor-series-dimension="s${i}:0"]`).selectOption(dim)
      await pick(page, `editor-series-values-s${i}-0`, [value])
    }
  }
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-page] [data-designer-add-panel="s1"]').click()
  await inspector829(page).locator('[data-designer-panel-editor="p2"]').waitFor({ timeout: 10000 })
  await inspector829(page).locator('[data-analytics-chosen-measures] button').first().click()
  await inspector829(page).locator('[data-analytics-measure="orders"]').click()
  await pick(page, 'editor-dimensions', ['day'])
  await page.locator('[data-analytics-choice="bar-vertical"]').click()
  await series831([[1, 'HungerStation', 'channel_group', 'hungerstation']])
  await ticked(done, 'HungerStation alone never')
  await series831([[2, 'QC', 'delivery_type', 'QC']])
  done.push('series')
  await ticked(done, 'HungerStation and QC')

  // 5. Their cancellation rates: the orders area, by day, with the same two series.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-page] [data-designer-add-panel="s1"]').click()
  await inspector829(page).locator('[data-designer-panel-editor="p3"]').waitFor({ timeout: 10000 })
  await page.locator('[data-designer-panel-area]').selectOption('orders')
  await pick(page, 'editor-dimensions', ['day'])
  await page.locator('[data-analytics-choice="line"]').click()
  await ticked(done, 'a rate without the series never')
  await series831([
    [1, 'HungerStation', 'channel_group', 'hungerstation'],
    [2, 'QC', 'delivery_type', 'QC'],
  ])
  done.push('rate')
  await ticked(done, 'the rate of HungerStation against QC')

  // 6. A sentence with a live figure.
  await page.locator('[data-designer-open-add="s1"]').click()
  await page.locator('[data-designer-page] [data-designer-add-text="s1"]').click()
  const en = page.locator('[data-designer-text-field="en"]')
  await en.click()
  await page.keyboard.type('HungerStation cancelled ')
  await ticked(done, 'words alone never')
  await page.locator('[data-designer-figure-into="en"]').click()
  await page.locator('[data-designer-figure-panel]').selectOption('p3')
  // A series made by hand is named s1, s2…: s1 is HungerStation.
  await page.locator('[data-designer-figure-value]').selectOption('s1')
  await page.locator('[data-designer-figure-insert]').click()
  done.push('figure')
  await ticked(done, 'a live figure')

  // 7. The AI summary, in a last section.
  await page.locator('[data-designer-add-section]').click()
  await page.locator('[data-designer-open-add="s2"]').click()
  await page.locator('[data-designer-page] [data-designer-add-summary="s2"]').click()
  done.push('summary')
  await ticked(done, 'the AI summary')

  // 8. The period: a new report starts with the ready-made period (story 19), bound to every chart as each was added,
  // at the board's default (last 30 days) — so not ticked until its default is yesterday; moved off yesterday it unticks.
  check(`${tag}: a new report holds the six ready-made parameters`, (await page.locator('[data-designer-outline^="param:"]').evaluateAll((els) => els.map((e) => e.dataset.designerOutline).join(','))) === 'param:period,param:city,param:region,param:store,param:channel,param:country')
  await ticked(done, 'the ready-made period at last 30 days never')
  await page.locator('[data-designer-outline="param:period"]').click()
  check(`${tag}: … and stays at the top of the parameter inspector`, (await page.locator('[data-param-inspector] [data-designer-tutorial]').count()) === 1)
  await page.locator('[data-param-inspector-close]').click()
  await page.locator('[data-board-filter-period]').selectOption('yesterday')
  done.push('period')
  await ticked(done, 'the period defaulting to yesterday on every chart')
  await page.locator('[data-board-filter-period]').selectOption('last-7-days')
  check(`${tag}: a period moved off yesterday unticks`, !(await ticks831(page)).includes('period'), await ticks831(page))
  await page.locator('[data-board-filter-period]').selectOption('yesterday')
  check(`${tag}: … and back on yesterday ticks again; every step done`, (await ticks831(page)) === STEPS_831.join(',') && (await progress831(page)) === '8 / 8', await progress831(page))
  check(`${tag}: done, the tutorial says so`, (await page.locator('[data-designer-tutorial-finished]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/831-done-${dir}.png`, fullPage: false })
  check(`${tag}: no raw tutorial key on screen`, (await rawKeys831(page)) === '', await rawKeys831(page))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** 831: "Load the finished report" ticks every step as one undoable step; "Or ask the copilot" asks the sentence. */
async function tutorialLoad831({ dir }) {
  const tag = `831 load ${dir}`
  const { context, page, bodies, errors } = await open({ dir, height: 1500, access: AUTHOR, model: MODEL_827, copilot: 'granted', copilotAnswer: CREATE_ANSWER_832 })
  await page.goto(`${BASE}/analytics/new?kind=report`)
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 30000 })
  await page.locator('[data-designer-tutorial-action]').click()
  await page.locator('[data-designer-tutorial-load]').click()
  check(`${tag}: "Load the finished report" ticks every step`, (await ticks831(page)) === STEPS_831.join(',') && (await progress831(page)) === '8 / 8', await ticks831(page))
  check(`${tag}: … the page holds its four sections`, (await sections828(page)) === 's1,s2,s3,s4', await sections828(page))
  await page.locator('[data-designer-block="p1"] [data-chart="bar"]').waitFor({ timeout: 10000 })
  check(`${tag}: … the page draws its panels`, (await page.locator('[data-designer-block="p1"] [data-chart="bar"]').count()) === 1)
  const title = noIsolates(await page.locator('[data-designer-title]').innerText()).trim()
  const arabic = (await page.evaluate(() => document.documentElement.lang)).startsWith('ar')
  check(`${tag}: … titled in the reader's language`, title === (arabic ? 'مبيعات القنوات: هنقرستيشن مقابل QC' : 'Channel sales: HungerStation against QC'), title)
  await page.screenshot({ path: `${SHOTS}/831-loaded-${dir}.png`, fullPage: false })
  await page.locator('[data-designer-undo]').click()
  check(`${tag}: one Undo takes it back to the blank report`, (await ticks831(page)) === '' && (await page.locator('[data-designer-empty]').count()) === 1 && (await page.locator('[data-designer-undo]').isDisabled()), await ticks831(page))

  // Or ask the copilot: the sentence goes to the copilot's own panel.
  const ask = page.locator('[data-designer-tutorial-ask]')
  await ask.waitFor({ timeout: 10000 })
  const sentence = noIsolates(await page.locator('[data-designer-tutorial-sentence]').innerText()).trim()
  await ask.click()
  const sheet = page.locator('dialog[data-copilot-sheet]')
  await sheet.locator('[data-copilot-report-open="r-832"]').waitFor({ timeout: 10000 })
  const asked = (bodies['Copilot/Ask'] ?? [])[0]
  check(`${tag}: "Ask the copilot" asks the acceptance sentence in the copilot panel`, asked?.question === sentence, asked?.question?.slice(0, 40))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 834: spec 819's acceptance case end to end — sentence → designer → share → schedule → runner → kept run ─────────
const SHOTS_834 = '.issues/assets/834-shots'
mkdirSync(SHOTS_834, { recursive: true })
const designerIdle834 = (page) =>
  page
    .waitForFunction((ids) => ids.every((id) => ['idle', 'empty'].includes(document.querySelector(`[data-designer-block="${id}"] [data-board-panel]`)?.dataset.boardPanelState)), P827, { timeout: 15000 })
    .catch(() => {})
/** The distinct painted fills of a block's bars. */
const paints834 = (page, scope) =>
  page.locator(`${scope} .recharts-bar-rectangle path`).evaluateAll((els) => [...new Set(els.map((el) => getComputedStyle(el).fill))])
/** A designer text block's live figures: chips naming each figure, `ok` when the figure exists on its panel. */
const chips834 = (page, id) => page.locator(`[data-designer-text="${id}"] [data-designer-figure-chip]`).evaluateAll((els) => els.map((e) => e.dataset.figureOk))
const RAW_TOKEN = /\{p\d:[a-z_]+\}/

async function acceptance834({ dir, dark = false }) {
  const mode = dark ? 'dark' : dir === 'rtl' ? 'ar' : 'en'
  const tag = `834 ${mode}`
  const shot = (page, step) => page.screenshot({ path: `${SHOTS_834}/834-${step}-${mode}.png`, fullPage: true })
  const author = await open({ dir, dark, height: 1500, access: AUTHOR, model: MODEL_827, copilot: 'granted', copilotAnswer: CREATE_ANSWER_834, words: wordsAnswer834 })
  const { page, bodies, calls, errors } = author
  const looks = async (page, where) => {
    const html = await page.evaluate(() => ({ dir: document.documentElement.dir, dark: document.documentElement.classList.contains('dark') }))
    check(`${tag}: ${where} is ${dir === 'rtl' ? 'RTL' : 'LTR'}${dark ? ' and dark' : ''}`, html.dir === dir && html.dark === dark, JSON.stringify(html))
  }

  // 1. The owner's sentence in the copilot.
  await page.goto(`${BASE}/analytics`)
  const button = page.locator('#layout-topbar [data-copilot-button]')
  const sheet = page.locator('dialog[data-copilot-sheet]')
  await button.waitFor({ timeout: 30000 })
  await button.click()
  await sheet.locator('[data-copilot-question]').fill(SENTENCE_832)
  await sheet.locator('[data-copilot-send]').click()
  const openLink = sheet.locator('[data-copilot-turn]').nth(0).locator('[data-copilot-report-open="r-834"]')
  await openLink.waitFor({ timeout: 10000 })
  const asked = (bodies['Copilot/Ask'] ?? [])[0] ?? {}
  check(`${tag} 1: the owner's sentence asks the copilot, with no report in context`, asked.question === SENTENCE_832 && asked.reportContext === undefined, JSON.stringify(Object.keys(asked)))
  check(`${tag} 1: the answer carries the built report to its designer`, (await openLink.getAttribute('href')) === '/analytics/report/r-834/edit', await openLink.getAttribute('href'))
  check(`${tag} 1: … with its assumptions, one line each`, (await sheet.locator('[data-copilot-assumption]').count()) === 3)
  await looks(page, 'the copilot')
  await shot(page, '1-copilot')

  // 2. The designer holds the expected report.
  await openLink.click()
  await page.locator('[data-report-designer="r-834"]').waitFor({ timeout: 15000 })
  await page.locator('[data-designer-block="p1"] [data-chart="bar"]').waitFor({ timeout: 15000 }).catch(() => {})
  await designerIdle834(page)
  check(`${tag} 2: "Open in designer" opens r-834's designer`, page.url().endsWith('/analytics/report/r-834/edit'), page.url())
  const layout = ['s1', 's2', 's3', 's4'].map((s) => blocks828(page, s))
  const blocks = (await Promise.all(layout)).join(' | ')
  check(`${tag} 2: four sections — sales by channel, HungerStation against QC, the stores, the summary`, (await sections828(page)) === 's1,s2,s3,s4' && blocks === 'p1,t1 | p2,p3,t2 | p4 | sum', blocks)
  const period = await page.locator('[data-board-param="period"] [data-board-filter-period]').first().inputValue().catch(() => null)
  check(`${tag} 2: the period parameter defaults to yesterday`, period === 'yesterday', String(period))
  check(`${tag} 2: net sales by channel draws as bars`, (await page.locator('[data-designer-block="p1"] [data-chart="bar"]').count()) === 1)
  const hsQc = await paints834(page, '[data-designer-block="p2"]')
  check(`${tag} 2: HungerStation against QC for net sales: two series, two paints`, hsQc.length === 2, hsQc.join(' / '))
  check(`${tag} 2: … and for the cancellation rate, as lines`, (await page.locator('[data-designer-block="p3"] [data-chart="line"]').count()) === 1)
  check(`${tag} 2: the rate carries the "inside OMS only" caveat, and only the rate`, (await page.locator('[data-designer-block="p3"] [data-panel-caveat]').count()) === 1 && (await page.locator('[data-designer-block="p1"] [data-panel-caveat], [data-designer-block="p2"] [data-panel-caveat]').count()) === 0)
  check(`${tag} 2: the stores table`, (await page.locator('[data-designer-block="p4"] [data-chart="table"]').count()) === 1)
  const chips = [...(await chips834(page, 't1')), '|', ...(await chips834(page, 't2'))].join('')
  check(`${tag} 2: text with live figures as chips, each an existing figure, never a raw token`, chips === 'yes|yesyesyesyes' && !RAW_TOKEN.test(await page.locator('[data-designer-sections]').innerText()), chips)
  check(`${tag} 2: the summary block`, (await page.locator('[data-designer-block="sum"]').count()) === 1)
  check(`${tag} 2: nothing to undo yet, nothing unsaved`, (await page.locator('[data-designer-undo]').isDisabled()) && (await page.locator('[data-designer-unsaved-marker]').count()) === 0)
  await page.locator('[data-designer-tutorial-action]').click()
  check(`${tag} 2: the tutorial ticks every step of the acceptance case from it`, (await ticks831(page)) === STEPS_831.join(',') && (await progress831(page)) === '8 / 8', await ticks831(page))
  await looks(page, 'the designer')
  await shot(page, '2-designer')

  // 3. Its page shares it with the team's roles.
  await page.goto(`${BASE}/analytics/report/r-834`)
  await page.locator('[data-analytics-report="r-834"]').waitFor({ timeout: 15000 })
  await idle827(page)
  check(`${tag} 3: a Personal report carries no audience chip, and offers Share`, (await page.locator('[data-analytics-report-header] [data-analytics-audience]').count()) === 0 && (await page.locator('[data-analytics-action="share"]').count()) === 1)
  await page.locator('[data-analytics-action="share"]').click()
  await page.locator('[data-analytics-share="share"]').waitFor({ timeout: 5000 })
  await page.locator('[data-analytics-share-chosen]').click()
  const roles = page.locator('[data-testid="analytics-share-roles"]')
  await roles.locator('[data-multi-select-trigger]').click()
  await roles.locator('[data-option="HQ_SALES"]').waitFor({ timeout: 10000 })
  for (const key of ['HQ_SALES', 'DELIVERY_OPS']) await roles.locator(`[data-option="${key}"] input[type="checkbox"]`).check()
  await page.keyboard.press('Escape')
  await shot(page, '3-share')
  await page.locator('[data-analytics-share-save]').click()
  const header = page.locator('[data-analytics-report-header]')
  await header.locator('[data-analytics-audience="chosen"]').waitFor({ timeout: 10000 })
  const shared = bodies['Analytics/Item/r-834/Share']?.[0]
  check(`${tag} 3: Share posts the revision and the chosen roles`, shared?.revision === 1 && JSON.stringify(shared?.audience?.roles) === JSON.stringify(['HQ_SALES', 'DELIVERY_OPS']) && !shared?.audience?.everyone, JSON.stringify(shared))
  const chip = await chipText(header)
  check(`${tag} 3: the report is Shared, its chip naming both roles, each isolated`, (await header.locator('[data-analytics-tier-badge="shared"]').count()) === 1 && /HQ Sales|مبيعات المركز الرئيسي/.test(chip) && /Delivery operations|عمليات التوصيل/.test(chip) && (await header.locator('[data-analytics-audience-name] bdi').count()) === 2, chip)

  // 4. A daily schedule, then Send now.
  await page.locator('[data-report-schedules]').click()
  await page.locator('[data-schedule-new]').click()
  const editor = page.locator('[data-schedule-editor="new"]')
  await editor.waitFor({ timeout: 5000 })
  check(`${tag} 4: a new schedule opens daily and enabled, on the report's own period (yesterday)`, (await editor.locator('[data-schedule-cadence="daily"]').getAttribute('aria-pressed')) === 'true' && (await editor.locator('[data-schedule-enabled="on"]').getAttribute('aria-pressed')) === 'true' && (await editor.locator('[data-board-param="period"] [data-board-filter-period]').inputValue()) === 'yesterday')
  await editor.locator('[data-schedule-time]').fill('06:30')
  const people = page.locator('[data-testid="analytics-schedule-recipients"]')
  await people.locator('[data-multi-select-trigger]').click()
  await people.locator('[data-option="nalharbi"]').waitFor({ timeout: 10000 })
  for (const id of ['nalharbi', 'kalotaibi']) await people.locator(`[data-option="${id}"] input[type="checkbox"]`).check()
  await page.keyboard.press('Escape')
  await shot(page, '4-schedule')
  await page.locator('[data-schedule-save]').click()
  await page.locator('[data-schedule-editor="sch-1"]').waitFor({ timeout: 10000 })
  const schedule = (bodies['Analytics/Report/r-834/Schedules'] ?? []).at(-1)
  check(
    `${tag} 4: the schedule saves daily at 06:30 Riyadh, for yesterday, to the two named people`,
    JSON.stringify(schedule?.cadence) === JSON.stringify({ kind: 'daily' }) && schedule?.time === '06:30' && schedule?.values?.period?.token === 'yesterday' && JSON.stringify(schedule?.recipients) === JSON.stringify(['nalharbi', 'kalotaibi']) && schedule?.enabled === true,
    JSON.stringify(schedule),
  )
  const sending = page.waitForResponse((r) => r.url().includes('/Schedules/sch-1/SendNow'), { timeout: 10000 })
  await page.locator('[data-schedule-send-now]').click()
  await sending
  await page.locator('[data-schedule-back]').click()
  await page.locator('[data-schedule-row="sch-1"]').waitFor({ timeout: 10000 })
  const summary = await page.locator('[data-schedule-row="sch-1"] [data-schedule-summary]').innerText()
  check(`${tag} 4: the list reads it daily at its isolated time, to two`, summary.includes('⁨06:30⁩') && (await page.locator('[data-schedule-row="sch-1"] [data-schedule-recipients]').getAttribute('data-schedule-recipients')) === '2', JSON.stringify(summary))
  await page.keyboard.press('Escape')

  // 5. A runner on the team re-runs it for last week and copies the link.
  const items = { ...ITEMS, 'r-834': { ...REPORT_834, tier: 'shared', audience: resolveAudience(shared?.audience) } }
  const runner = await open({ dir, dark, access: RUNNER, model: MODEL_827, items, words: wordsAnswer834 })
  await runner.context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const rp = runner.page
  await rp.goto(`${BASE}/analytics/report/r-834`)
  await rp.locator('[data-analytics-report="r-834"]').waitFor({ timeout: 30000 })
  await idle827(rp)
  const controls = await rp.locator('[data-report-edit], [data-analytics-action], [data-report-schedules], [data-board-tv-enter], [data-analytics-ask]').count()
  check(`${tag} 5: a runner gets no edit, share or schedule control`, controls === 0, String(controls))
  check(`${tag} 5: … and the Kept runs link, for the runs sent to them`, (await rp.locator('[data-report-runs]').count()) === 1)
  const firstAsks = runner.bodies['Analytics/Query'] ?? []
  check(`${tag} 5: every panel runs for yesterday by default`, P827.every((id) => firstAsks.some((b) => b.panelId === id && b.values?.period?.token === 'yesterday')), JSON.stringify(firstAsks.map((b) => [b.panelId, b.values?.period])))
  check(`${tag} 5: … its figures yesterday's`, (await figure827(rp, '{p1:total}')) === 'SAR 187,500', String(await figure827(rp, '{p1:total}')))
  const from = firstAsks.length
  await rp.locator('[data-board-param="period"] [data-board-filter-period]').selectOption('last-week')
  await rp.waitForFunction(() => document.querySelector('[data-report-figure="{p1:total}"]')?.textContent?.includes('1,000,000'), null, { timeout: 10000 }).catch(() => {})
  await idle827(rp)
  const reAsks = (runner.bodies['Analytics/Query'] ?? []).slice(from)
  check(`${tag} 5: last week re-runs every panel with it`, P827.every((id) => reAsks.some((b) => b.panelId === id && b.values?.period?.token === 'last-week' && b.itemId === 'r-834')), JSON.stringify(reAsks.map((b) => [b.panelId, b.values?.period])))
  check(
    `${tag} 5: … the Words too, and the figures follow (isolated)`,
    (runner.bodies['Analytics/Report/r-834/Words'] ?? []).at(-1)?.values?.period?.token === 'last-week' && (await figure827(rp, '{p1:total}')) === 'SAR 1,000,000' && (await rp.locator('[data-report-figure="{p2:hs}"] bdi[dir="ltr"]').count()) === 1,
    String(await figure827(rp, '{p1:total}')),
  )
  check(`${tag} 5: the cancellation rate keeps its caveat for the runner`, (await rp.locator('[data-report-panel="p3"] [data-panel-caveat]').count()) === 1)
  check(`${tag} 5: the URL carries period=last-week`, new URL(rp.url()).searchParams.get('period') === 'last-week', rp.url())
  await rp.locator('[data-report-copy-link]').click()
  const link = await rp.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check(`${tag} 5: Copy link copies the page with its values`, link === rp.url() && new URL(link).searchParams.get('period') === 'last-week', link)
  await looks(rp, "the runner's page")
  await shot(rp, '5-runner')
  // The copied link, opened afresh (a full load: nothing kept from the page that copied it).
  const again = rp
  await again.goto(`${BASE}/analytics`)
  const opened = (runner.bodies['Analytics/Query'] ?? []).length
  await again.goto(link || `${BASE}/analytics/report/r-834`)
  await again.locator('[data-analytics-report="r-834"]').waitFor({ timeout: 15000 })
  await idle827(again)
  const linkAsks = (runner.bodies['Analytics/Query'] ?? []).slice(opened)
  check(`${tag} 5: the copied link opens on last week`, (await again.locator('[data-board-param="period"] [data-board-filter-period]').inputValue()) === 'last-week' && P827.every((id) => linkAsks.some((b) => b.panelId === id && b.values?.period?.token === 'last-week')))
  if (dir === 'rtl') {
    const iso = await rp.locator('[data-report-text="t1"] [data-report-figure="{p1:total}"] bdi').getAttribute('dir').catch(() => null)
    check(`${tag} 5: a figure in the text stays a left-to-right isolate under RTL`, iso === 'ltr', String(iso))
  }
  check(`${tag} 5: no page errors for the runner`, runner.errors.length === 0, runner.errors.join(' | '))
  await runner.context.close()

  // 6. The kept-run record of the send.
  await page.locator('[data-report-runs]').click()
  await page.locator('[data-analytics-runs="r-834"]').waitFor({ timeout: 10000 })
  const runs = await page.locator('[data-run]').evaluateAll((els) => els.map((e) => e.dataset.run))
  check(`${tag} 6: the kept runs list the send`, runs.join() === 'run-now-1', runs.join())
  const run = page.locator('[data-run="run-now-1"]')
  check(
    `${tag} 6: … its trigger, its two recipients, "sent", and the values it ran with`,
    (await run.locator('[data-run-trigger="sendNow"]').count()) === 1 && (await run.locator('[data-run-recipient]').count()) === 2 && (await run.locator('[data-run-outcome="sent"]').count()) === 1 && (await run.locator('[data-run-values] [data-board-filter-chips]').count()) === 1,
  )
  check(`${tag} 6: … with the email and the PDF it sent, kept`, (await run.locator('[data-run-html]').count()) === 1 && (await run.locator('[data-run-pdf]').count()) === 1)
  const popup = page.waitForEvent('popup', { timeout: 10000 })
  await run.locator('[data-run-html]').click()
  await (await popup).close()
  check(`${tag} 6: opening the email asks its Html door`, calls.includes('Analytics/ReportRun/run-now-1/Html'))
  await looks(page, 'the kept runs')
  await shot(page, '6-kept-run')
  check(`${tag}: no page errors for the author`, errors.length === 0, errors.join(' | '))
  await author.context.close()
}

const SCENARIOS = [
  ['834', () => acceptance834({ dir: 'ltr' })],
  ['834', () => acceptance834({ dir: 'rtl' })],
  ['834', () => acceptance834({ dir: 'ltr', dark: true })],
  ['831', () => tutorial831({ dir: 'ltr' })],
  ['831', () => tutorial831({ dir: 'rtl' })],
  ['831', () => tutorialLoad831({ dir: 'ltr' })],
  ['831', () => tutorialLoad831({ dir: 'rtl' })],
  ['829', () => designer829({ dir: 'ltr' })],
  ['829', () => designer829({ dir: 'rtl' })],
  ['829', provenance829],
  ['832', () => copilotReport832({ dir: 'ltr' })],
  ['832', () => copilotReport832({ dir: 'rtl' })],
  ['828', () => builderNewReport828()],
  ['827', () => reportHistory827()],
  ['827', () => previewWords827()],
  ['832', () => copilotSteps832({ dir: 'ltr' })],
  ['832', () => copilotUnsaved832({ dir: 'ltr' })],
  ['832', () => copilotUnsaved832({ dir: 'rtl' })],
  ['830', () => saveAsReport830({ dir: 'ltr' })],
  ['830', () => saveAsReport830({ dir: 'rtl' })],
  ['828', () => designer828({ dir: 'ltr' })],
  ['828', () => designer828({ dir: 'rtl' })],
  ['833', () => schedules833({ dir: 'ltr' })],
  ['833', () => schedules833({ dir: 'rtl' })],
  ['833', runnerNoSchedules833],
  ['827', () => report827({ dir: 'ltr' })],
  ['827', () => report827({ dir: 'rtl' })],
  ['827', () => report827({ dir: 'ltr', dark: true })],
  ['824', () => declares824({ dir: 'ltr' })],
  ['824', () => declares824({ dir: 'rtl' })],
  ['826', () => sharesWithAudience826({ dir: 'ltr' })],
  ['826', () => sharesWithAudience826({ dir: 'rtl' })],
  ['826', () => outsiderNotShared826({ dir: 'ltr' })],
  ['826', () => outsiderNotShared826({ dir: 'rtl' })],
  ['826', () => curatorNarrowsAndReassigns826({ dir: 'ltr' })],
  ['826', () => curatorNarrowsAndReassigns826({ dir: 'rtl' })],
  ['823', () => params823({ dir: 'ltr' })],
  ['823', () => params823({ dir: 'rtl' })],
  ['823', () => notices823({ dir: 'ltr' })],
  ['823', () => notices823({ dir: 'rtl' })],
  ['822', () => runnerSeesNoBuilder({ dir: 'ltr' })],
  ['822', () => runnerSeesNoBuilder({ dir: 'rtl' })],
  ['822', () => runnerSeesNoBuilder({ dir: 'ltr', access: { canView: true, canCurate: false }, label: 'v1-answer' })],
  ['822', () => authorSeesBuilder({ dir: 'ltr' })],
  ['822', () => authorSeesBuilder({ dir: 'rtl' })],
  ['822', staleProbeShare415],
  ['825', () => namedSeries825({ dir: 'ltr', dark: false })],
  ['825', () => namedSeries825({ dir: 'rtl', dark: false })],
  ['825', () => namedSeries825({ dir: 'ltr', dark: true })],
  ['820', () => multiSeriesBars820({ dir: 'ltr', dark: false })],
  ['820', () => multiSeriesBars820({ dir: 'rtl', dark: false })],
  ['820', () => multiSeriesBars820({ dir: 'ltr', dark: true })],
  ['785', () => status785({ dir: 'ltr' })],
  ['785', () => status785({ dir: 'rtl' })],
  ['785', () => status785({ dir: 'ltr', dark: true })],
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
  ['review', () => retiredPanels({ dir: 'ltr' })],
  ['review', () => retiredPanels({ dir: 'rtl' })],
  ['review', () => compare766({ dir: 'ltr' })],
  ['review', () => compare766({ dir: 'rtl' })],
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
