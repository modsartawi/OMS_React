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

const SCENARIOS = [
  ['767', probeHides],
  ['767', () => drawsBar({ dir: 'ltr', dark: false })],
  ['767', () => drawsBar({ dir: 'rtl', dark: false })],
  ['767', () => drawsBar({ dir: 'ltr', dark: true })],
  ['767', refusals],
  ['782', () => askBox({ dir: 'ltr' })],
  ['782', () => askBox({ dir: 'rtl' })],
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
