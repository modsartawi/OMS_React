// 853 — an unsaved report or board runs its panels with their bound parameters (stubbed analytics doors, through
// `./analytics-stubs.mjs`, whose draft door mirrors BackOffice 3419's: the draft's bound period sets the answer's period).
//
//   1. designer (the product's sample report): every panel asks `{ draft, panelId, values }` — no params, no bindings,
//      never by item; the bound period rides in `values`;
//   2. the top strip's Period → Last 7 days: each bound panel asks again with `values.period` = last-7-days, and its
//      answer's period is the 7 days;
//   3. Applies to: untick p1 → p1 alone asks again, with no `values.period` (its own period); the others keep their keys;
//   4. editing a text block re-runs no panel;
//   5. Preview as a runner follows the viewer's Period (by draft);
//   6. the unsaved board's Preview follows its Period (by draft);
//   7. a draft the server refuses as a whole (ANALYTICS-411) shows the refusal on every panel; an edit that fixes it
//      asks again and the panels answer. No page errors. en (LTR) and ar (RTL). (A runner never reaching the draft
//      door is not driven: the designer and the board editor are author-only routes.)
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. DRIVE_PORT=5199 node tools/draft-run-853-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { ITEMS, LIST, LIST_777, MODEL_827, installAnalyticsStubs, refusal } from './analytics-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = '.issues/assets/853-shots'
mkdirSync(SHOTS, { recursive: true })
const AUTHOR = { canView: true, canAuthor: true, canCurate: false }
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open({ dir, list = [...LIST, ITEMS['v-825']], draftRefuse }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(({ dir }) => localStorage.setItem('oms.locale', dir === 'rtl' ? 'ar' : 'en'), { dir })
  // Every Query body, in order, with the answer's period (what the draft door ran).
  const asked = []
  page.on('response', async (res) => {
    if (!res.url().includes('/api/Analytics/Query') || res.request().method() !== 'POST') return
    const body = res.request().postDataJSON() ?? {}
    const data = (await res.json().catch(() => null))?.data
    asked.push({ body, period: data?.period ?? null, status: res.status() })
  })
  await installAnalyticsStubs(page, { access: AUTHOR, model: MODEL_827, list, draftRefuse })
  return { context, page, errors, asked }
}

/** Wait until `count` answers past `n` have landed (or `ms` passes), then a beat for any stray extra ask. */
const answered = async (page, asked, n, count, ms = 8000) => {
  for (let t = 0; t < ms && asked.length - n < count; t += 100) await page.waitForTimeout(100)
  await page.waitForTimeout(600)
}
const settle = (page) => page.waitForLoadState('networkidle').then(() => page.waitForTimeout(400))
const isDraftBody = (b) => !!b.draft && !!b.panelId && !!b.values && !('params' in b) && !('bindings' in b) && !b.itemId && !b.definition
const since = (asked, n) => asked.slice(n)
const byPanel = (list) => Object.fromEntries(list.map((a) => [a.body.panelId, a]))

async function sampleDesigner(page) {
  await page.goto(`${BASE}/analytics/new?kind=report`, { timeout: 240000 })
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 120000 })
  await page.locator('[data-designer-tutorial-action]').click()
  await page.locator('[data-designer-tutorial-load]').click()
  await page.locator('[data-designer-tutorial-close]').click()
  await page.locator('[data-designer-block="p4"]').waitFor({ timeout: 10000 })
}

async function designer({ dir }) {
  const tag = `853 ${dir}`
  const { context, page, errors, asked } = await open({ dir })

  // 1. The sample report: every panel by draft, the bound period (its default, yesterday) in values.
  await sampleDesigner(page)
  await settle(page)
  const first = byPanel(asked.filter((a) => a.body.draft))
  const ids = ['p1', 'p2', 'p3', 'p4']
  check(`${tag}: every designer panel asks by draft`, ids.every((id) => first[id]) && asked.every((a) => isDraftBody(a.body)), JSON.stringify(asked.map((a) => Object.keys(a.body))))
  check(`${tag}: … with the whole working report (its sections)`, ids.every((id) => Array.isArray(first[id]?.body.draft.sections) && first[id].body.draft.sections.length > 0))
  check(`${tag}: … and the bound period at its default in values`, ids.every((id) => first[id]?.body.values?.period?.token === 'yesterday'), JSON.stringify(ids.map((id) => first[id]?.body.values)))
  check(`${tag}: … which the server runs (answer: yesterday)`, ids.every((id) => first[id]?.period?.from === '2026-11-05' && first[id]?.period?.to === '2026-11-05'), JSON.stringify(ids.map((id) => first[id]?.period)))

  // 2. Top Period → Last 7 days: each bound panel asks again with it.
  let n = asked.length
  await page.locator('[data-board-filters] [data-board-filter-period]').first().selectOption('last-7-days')
  await answered(page, asked, n, 4)
  const seven = byPanel(since(asked, n))
  check(`${tag}: Period → Last 7 days re-asks every bound panel`, ids.every((id) => seven[id]?.body.values?.period?.token === 'last-7-days'), JSON.stringify(since(asked, n).map((a) => [a.body.panelId, a.body.values?.period])))
  check(`${tag}: … by draft, and they answer the 7 days`, ids.every((id) => seven[id] && isDraftBody(seven[id].body) && seven[id].period?.from === '2026-10-30' && seven[id].period?.to === '2026-11-05'), JSON.stringify(ids.map((id) => seven[id]?.period)))
  await page.screenshot({ path: `${SHOTS}/853-designer-7d-${dir}.png`, fullPage: true })

  // 3. Applies to: untick p1 → p1 alone asks again, at its own period.
  await page.locator('[data-designer-outline="param:period"]').click()
  await page.locator('[data-param-binding="p1"]').waitFor({ timeout: 5000 })
  n = asked.length
  await page.locator('[data-param-binding="p1"] button').first().click()
  await answered(page, asked, n, 1)
  const unbound = since(asked, n)
  check(`${tag}: unticking p1 in Applies to re-asks p1 alone`, unbound.length === 1 && unbound[0].body.panelId === 'p1', JSON.stringify(unbound.map((a) => a.body.panelId)))
  check(`${tag}: … with no period in values (it runs at its own)`, unbound[0] && !('period' in (unbound[0].body.values ?? {})) && isDraftBody(unbound[0].body), JSON.stringify(unbound[0]?.body.values))
  check(`${tag}: … and the draft it sends no longer binds period there`, unbound[0] && !unbound[0].body.draft.bindings?.period?.p1)
  // The sample's views run over yesterday of their own.
  check(`${tag}: … answered at the view's own period (yesterday), not the 7 days`, unbound[0]?.period?.from === '2026-11-05' && unbound[0]?.period?.to === '2026-11-05', JSON.stringify(unbound[0]?.period))

  // 4. Editing a text block re-runs no panel.
  await page.locator('[data-designer-outline="block:t1"]').click()
  const text = page.locator('[data-designer-text-field="en"]').first()
  await text.waitFor({ timeout: 5000 })
  n = asked.length
  await text.fill('Edited words {{fig:p1:till_value}}.')
  await settle(page)
  check(`${tag}: editing a text block re-runs no panel`, asked.length === n, JSON.stringify(since(asked, n).map((a) => a.body.panelId)))

  // 5. Preview as a runner follows the viewer's Period.
  await page.locator('[data-designer-preview]').click()
  await page.locator('[data-designer-preview-page="draft"]').waitFor({ timeout: 10000 })
  await settle(page)
  n = asked.length
  await page.locator('[data-designer-preview-page] [data-board-filter-period]').first().selectOption('last-30-days')
  await answered(page, asked, n, 3)
  const thirty = byPanel(since(asked, n))
  check(`${tag}: Preview as a runner: Period → Last 30 days re-asks the bound panels by draft`, ['p2', 'p3', 'p4'].every((id) => isDraftBody(thirty[id]?.body ?? {}) && thirty[id].body.values?.period?.token === 'last-30-days'), JSON.stringify(since(asked, n).map((a) => [a.body.panelId, a.body.values?.period])))
  check(`${tag}: … and p1 (unbound) is not re-asked`, !thirty.p1)
  await page.screenshot({ path: `${SHOTS}/853-preview-30d-${dir}.png`, fullPage: true })
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function boardPreview({ dir }) {
  const tag = `853 board ${dir}`
  const { context, page, errors, asked } = await open({ dir, list: LIST_777 })
  await page.goto(`${BASE}/analytics/new?kind=board`, { timeout: 240000 })
  await page.locator('[data-board-editor="new"]').waitFor({ timeout: 10000 })
  await page.locator('[data-board-palette-add="v-kpi"]').click()
  await page.locator('[data-editor-panel]').first().waitFor({ timeout: 5000 })
  await settle(page)
  await page.locator('[data-board-preview-open]').click()
  await page.locator('[data-board-preview] [data-board-grid]').waitFor({ timeout: 10000 })
  await settle(page)
  const opened = asked.filter((a) => a.body.draft)
  check(`${tag}: the unsaved board's Preview asks by draft (its panels)`, opened.length >= 1 && opened.every((a) => isDraftBody(a.body) && Array.isArray(a.body.draft.panels)), JSON.stringify(asked.map((a) => Object.keys(a.body))))
  const bound = opened.at(-1)?.body.values?.period
  check(`${tag}: … the panel carries its bound period`, !!bound, JSON.stringify(opened.at(-1)?.body.values))
  const n = asked.length
  await page.locator('[data-board-preview] [data-board-filter-period]').first().selectOption('last-7-days')
  await answered(page, asked, n, 1)
  const after = since(asked, n)
  check(`${tag}: Period → Last 7 days re-asks it by draft with values.period`, after.length >= 1 && after.every((a) => isDraftBody(a.body) && a.body.values?.period?.token === 'last-7-days'), JSON.stringify(after.map((a) => a.body.values)))
  check(`${tag}: … answered over the 7 days`, after.every((a) => a.period?.from === '2026-10-30'), JSON.stringify(after.map((a) => a.period)))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function refusedDraft({ dir }) {
  const tag = `853 refused ${dir}`
  // The server's save check refuses the draft while its first text block reads "broken".
  const isBroken = (body) => (body.draft.sections ?? []).some((s) => s.blocks.some((b) => b.kind === 'text' && /broken/.test(b.text?.en ?? '')))
  const { context, page, errors, asked } = await open({ dir, draftRefuse: (body) => (isBroken(body) ? refusal('ANALYTICS-411', 'The draft has problems a save would refuse.', 400) : null) })
  await sampleDesigner(page)
  await settle(page)
  await page.locator('[data-designer-outline="block:t1"]').click()
  const text = page.locator('[data-designer-text-field="en"]').first()
  await text.waitFor({ timeout: 5000 })
  // A period change re-asks every panel while the draft is broken: each shows the refusal.
  await text.fill('broken')
  let n = asked.length
  await page.locator('[data-board-filters] [data-board-filter-period]').first().selectOption('last-7-days')
  await answered(page, asked, n, 4)
  const refused = since(asked, n)
  check(`${tag}: a draft refused as a whole refuses every panel's ask`, refused.length === 4 && refused.every((a) => a.status === 400), JSON.stringify(refused.map((a) => [a.body.panelId, a.status])))
  const shown = await page.locator('[data-report-panel] [data-board-panel-state="refused"]').count()
  check(`${tag}: … and every panel shows it as refused`, shown === 4, String(shown))
  await page.screenshot({ path: `${SHOTS}/853-refused-${dir}.png`, fullPage: true })
  // Fixing the text asks again, and the panels answer.
  n = asked.length
  await text.fill('Fixed words {{fig:p1:till_value}}.')
  await answered(page, asked, n, 4)
  const again = since(asked, n)
  check(`${tag}: … the panels answer again`, (await page.locator('[data-report-panel] [data-board-panel-state="refused"]').count()) === 0)
  check(`${tag}: the edit that fixes the draft re-asks the refused panels`, ['p1', 'p2', 'p3', 'p4'].every((id) => again.some((a) => a.body.panelId === id && a.status === 200)), JSON.stringify(again.map((a) => [a.body.panelId, a.status])))
  // An answered panel is not re-asked by a further unrelated edit.
  n = asked.length
  await text.fill('Fixed words again {{fig:p1:till_value}}.')
  await page.waitForTimeout(1500)
  check(`${tag}: … and once answered, another edit re-asks none`, asked.length === n, String(asked.length - n))
  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

for (const dir of ['ltr', 'rtl']) {
  await designer({ dir })
  await refusedDraft({ dir })
  await boardPreview({ dir })
}
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
