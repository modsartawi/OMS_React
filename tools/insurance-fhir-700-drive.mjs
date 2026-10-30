// A monitor's back-test, approval and shadow (BackOffice spec 3271, door 3290; oms ticket 700).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/fhir-rules-stubs-700.mjs`): never a live SIS.Api.
// In LTR and RTL: Ask waits for a back-test that read the answers; the back-test reads as review items on answers, keys masked; a
// draft of monitors alone reads no sale figures; a guard-only draft's report is unchanged; ask, approve as another user, shadow,
// promote; a job that read no answers does not open Ask; an edit makes the back-test stale.
//
//   1. npx vite --port 5210 --strictPort
//   2. DRIVE_PORT=5210 node tools/insurance-fhir-700-drive.mjs
import { createRequire } from 'node:module'
import { approvalStub, envelope, insuranceRulesStub, newApprovalStore } from './insurance-rules-stubs.mjs'
import { windowLimitStub } from './fhir-rules-stubs-710.mjs'
import { monitorBacktestStub, monitorMetricsStub, monitorRule } from './fhir-rules-stubs-700.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`
const AUTHOR = { user: 'nalharbi', viewer: { author: true, approver: false } }
const APPROVER = { user: 'falotaibi', viewer: { author: false, approver: true } }
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch()
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const SIM = '/insurance-rules/simulator?tab=backtest&days=30'
const APPROVALS = '/insurance-rules/approvals'

/** One session on one HQ `store`. */
async function open(dir, store, who, stubOpts = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.clock.install({ time: new Date('2026-10-27T10:30:00+03:00') })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: who.user, currentStoreCode: 'P001' }))
    const body = req.postData() ? JSON.parse(req.postData()) : undefined
    const hit =
      windowLimitStub(req.method(), p, 180) ??
      monitorBacktestStub(req.method(), p, body, store, stubOpts) ??
      monitorMetricsStub(req.method(), p) ??
      approvalStub(req.method(), p, body, { store, ...who, now: '2026-10-27T10:30:00' }) ??
      insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  const go = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  }
  return { context, page, errors, go }
}

const withMonitors = (rules) => {
  const store = newApprovalStore({ backtest: null })
  store.draft.rules = [...store.draft.rules, ...rules]
  return store
}
const noRawKeys = async (page) => !/insurance-(rules|approvals|simulator):|\b(monitors|shadow|backtest)\.[a-zA-Z]/.test(await page.locator('main').innerText())
const start = async (page) => {
  await page.locator('[data-start-backtest]').click()
  await page.locator('[data-backtest-running]').waitFor({ timeout: 8000 }).catch(() => {})
}
const disabled = async (loc) => (await loc.getAttribute('aria-disabled')) === 'true' || (await loc.isDisabled())

for (const dir of ['ltr', 'rtl']) {
  try {
    // ── the flow: guards + monitors ─────────────────────────────────────────────────────────────
    const store = withMonitors([monitorRule('M-001', 'draft'), monitorRule('M-002', 'shadow', { shadowSince: '2026-10-05' })])
    const a = await open(dir, store, AUTHOR)
    await a.go(APPROVALS)
    await a.page.locator('[data-approval-panel]').waitFor({ timeout: 60000 })
    await a.page.locator('[data-action="submit"]').waitFor({ timeout: 10000 })
    check(`${dir} 1. Ask waits for a back-test`, (await disabled(a.page.locator('[data-action="submit"]'))) && (await a.page.locator('[data-why="noBacktest"]').count()) === 1)

    await a.go(SIM)
    await a.page.locator('[data-start-backtest]').waitFor({ timeout: 30000 })
    await a.page.locator('[data-backtest-monitors]').waitFor({ timeout: 10000 })
    check(`${dir} 2. the back-test says monitors replay kept answers`, (await a.page.locator('[data-backtest-monitors]').count()) === 1)
    await start(a.page)
    check(`${dir} 2. a run says it replays the kept answers too`, (await a.page.locator('[data-backtest-running]').innerText()).includes('kept answers'))
    await a.page.locator('[data-monitor-backtest]').waitFor({ timeout: 15000 })
    const fig = async (h) => strip(await a.page.locator(`[data-tile="${h}"] [data-figure]`).innerText())
    check(`${dir} 3. answers replayed`, (await fig('monitor-answers')) === '800')
    check(`${dir} 3. review items raised, by severity`, (await fig('monitor-raised')) === '4' && (await fig('monitor-action')) === '3' && (await fig('monitor-info')) === '1')
    check(`${dir} 3. answers raised on`, (await fig('monitor-raised-on')) === '2')
    const item = (i) => a.page.locator(`[data-monitor-item="${i}"]`)
    check(`${dir} 3. which answer, one isolate`, strip(await item(0).locator('[data-col="answer"] bdi[dir="ltr"]').innerText()) === 'nphies · ANS-7001')
    check(`${dir} 3. a patient key stays masked`, strip(await item(0).locator('[data-col="patient"]').innerText()) === '1*******83')
    check(`${dir} 3. one that arrived whole is masked here`, strip(await item(1).locator('[data-col="patient"]').innerText()) === '1*******08')
    check(`${dir} 3. the whole key is nowhere on the page`, !(await a.page.locator('main').innerText()).includes('1198765408'))
    check(`${dir} 3. each monitor's share`, (await a.page.locator('[data-monitor-rule-row="M-002"] [data-col="raised"]').innerText()).trim() === '1')
    const monitorText = await a.page.locator('[data-monitor-backtest]').innerText()
    check(`${dir} 3. the section speaks of no sale`, !/SAR|stopped|refus|pharmacist/i.test(monitorText), monitorText)
    check(`${dir} 3. the guards' figures still stand beside it`, (await a.page.locator('[data-tile="REFUSE"]').count()) === 1 && (await a.page.locator('[data-stopped]').count()) === 1)
    check(`${dir} 3. the start asked only for the window`, JSON.stringify(store.starts) === '[{"days":30}]', JSON.stringify(store.starts))
    check(`${dir} 3. no raw keys`, await noRawKeys(a.page))
    if (process.env.DRIVE_SHOTS) await a.page.screenshot({ path: `${process.env.DRIVE_SHOTS}/${dir}-700-report.png`, fullPage: true })

    await a.go(APPROVALS)
    await a.page.locator('[data-backtest-standing="current"]').waitFor({ timeout: 30000 })
    check(`${dir} 4. the panel says what it would raise`, (await a.page.locator('[data-backtest-raised="4"][data-backtest-raised-on="2"]').count()) === 1)
    const link = await a.page.locator('[data-backtest-raised-open]').getAttribute('href')
    check(`${dir} 4. it links to this job's report`, /tab=backtest/.test(link) && /id=BT-M1/.test(link), link)
    await a.page.locator('[data-checks="pass"], [data-checks="errors"]').first().waitFor({ timeout: 30000 })
    check(`${dir} 4. Ask opens`, !(await disabled(a.page.locator('[data-action="submit"]'))))
    await a.page.locator('[data-note]').fill('Monitors for review.')
    await a.page.locator('[data-action="submit"]').click()
    await a.page.locator('[data-approval-state="waiting"]').waitFor({ timeout: 10000 })
    check(`${dir} 4. the monitor waits with the draft`, store.draft.rules.find((r) => r.id === 'M-001').state === 'waiting')
    // No grant probe (618): the button is offered, and closed for whoever asked.
    check(`${dir} 4. the author cannot approve`, (await disabled(a.page.locator('[data-action="approve"]'))) && (await a.page.locator('[data-why="ownSubmission"]').count()) === 1)
    check(`${dir} no page errors, author`, a.errors.length === 0, a.errors.join(' | '))
    await a.context.close()

    // Another user approves; both monitors now in shadow, each read as a monitor.
    const b = await open(dir, store, APPROVER)
    await b.go(APPROVALS)
    await b.page.locator('[data-action="approve"]').waitFor({ timeout: 60000 })
    await b.page.locator('[data-checks="pass"], [data-checks="errors"]').first().waitFor({ timeout: 30000 })
    check(`${dir} 5. the approver reads what it would raise`, (await b.page.locator('[data-backtest-raised="4"]').count()) === 1)
    await b.page.locator('[data-action="approve"]').click()
    await b.page.locator('[data-shadow-rule="M-001"]').waitFor({ timeout: 15000 })
    check(`${dir} 5. approval puts the monitor in shadow, not live`, store.draft.rules.find((r) => r.id === 'M-001').state === 'shadow')
    check(`${dir} 5. the shadow section says what a monitor's shadow is`, (await b.page.locator('[data-shadow-monitor-hint]').count()) === 1)
    const shadow = b.page.locator('[data-shadow-rule="M-002"]')
    await shadow.locator('[data-shadow-fires="9"]').waitFor({ timeout: 10000 })
    check(`${dir} 5. a monitor's figure says raised`, (await shadow.innerText()).includes('Would have raised') && !(await shadow.innerText()).includes('Would have fired'))
    check(`${dir} 5. a monitor shows its own severity`, (await shadow.locator('[data-severity="action"]').count()) === 1)
    const guardShadow = b.page.locator('[data-shadow-rule="G-003"]')
    check(`${dir} 5. a guard's figure still says fired`, (await guardShadow.innerText()).includes('Would have fired'))

    // Under 14 days needs a reason, as a guard; 22 days does not.
    const young = b.page.locator('[data-shadow-rule="M-001"]')
    check(`${dir} 6. under 14 days needs a reason`, (await disabled(young.locator('[data-promote="M-001"]'))) && (await young.locator('[data-promote-why="reason"]').count()) === 1)
    await young.locator('[data-promote="M-001"]').click({ force: true })
    check(`${dir} 6. a refused promote writes nothing`, !store.writes.some((w) => w.path.endsWith('M-001/Promote')))
    await young.locator('[data-skip-reason]').fill('Owner asked.')
    await young.locator('[data-promote="M-001"]').click()
    await b.page.locator('[data-shadow-rule="M-001"]').waitFor({ state: 'detached', timeout: 10000 })
    check(`${dir} 6. promoted with a reason, live`, store.draft.rules.find((r) => r.id === 'M-001').state === 'live')
    await b.page.locator('[data-promote="M-002"]').click()
    await b.page.locator('[data-shadow-rule="M-002"]').waitFor({ state: 'detached', timeout: 10000 })
    check(`${dir} 6. 22 days promotes with no reason`, store.draft.rules.find((r) => r.id === 'M-002').state === 'live')
    check(`${dir} 6. no raw keys`, await noRawKeys(b.page))
    check(`${dir} no page errors, approver`, b.errors.length === 0, b.errors.join(' | '))
    await b.context.close()

    // ── monitors alone: no sale figures ─────────────────────────────────────────────────────────
    const alone = withMonitors([monitorRule('M-001', 'draft')])
    alone.draft.rules = alone.draft.rules.filter((r) => r.kind === 'monitor')
    const c = await open(dir, alone, AUTHOR, { guards: false })
    await c.go(SIM)
    await c.page.locator('[data-start-backtest]').waitFor({ timeout: 30000 })
    await start(c.page)
    await c.page.locator('[data-monitor-backtest]').waitFor({ timeout: 15000 })
    const noSale = (await Promise.all(['REFUSE', 'sar', 'requests', 'pharmacists'].map((h) => c.page.locator(`[data-tile="${h}"]`).count()))).every((n) => n === 0)
    check(`${dir} 7. monitors alone read no sale figures`, noSale && (await c.page.locator('[data-stopped], [data-stopped-none], [data-by-rule], [data-overlap]').count()) === 0)
    check(`${dir} 7. monitors alone do not read as refusals`, !/refuse|stopped|SAR/i.test(await c.page.locator('[data-backtest-report]').innerText()))

    // An edit moves the revision: the back-test is out of date, as a guard's.
    alone.draft.revision += 1
    await c.go(APPROVALS)
    await c.page.locator('[data-backtest-standing="stale"]').waitFor({ timeout: 30000 })
    check(`${dir} 8. an edit makes it stale and closes Ask`, (await disabled(c.page.locator('[data-action="submit"]'))) && (await c.page.locator('[data-why="backtestStale"]').count()) === 1)
    check(`${dir} 8. a stale job reads no raised line`, (await c.page.locator('[data-backtest-raised]').count()) === 0)
    await c.context.close()

    // ── a job of this revision that read no answers ─────────────────────────────────────────────
    const blind = withMonitors([monitorRule('M-001', 'draft')])
    const d = await open(dir, blind, AUTHOR, { section: null })
    await d.go(SIM)
    await d.page.locator('[data-start-backtest]').waitFor({ timeout: 30000 })
    await start(d.page)
    await d.page.locator('[data-backtest-report]').waitFor({ timeout: 15000 })
    await d.go(APPROVALS)
    await d.page.locator('[data-backtest-standing]').waitFor({ timeout: 30000 })
    await d.page.locator('[data-why="noBacktest"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 9. a job that read no answers does not open Ask`, (await disabled(d.page.locator('[data-action="submit"]'))) && (await d.page.locator('[data-why="noBacktest"]').count()) === 1)
    await d.context.close()

    // ── a guard-only draft: unchanged ───────────────────────────────────────────────────────────
    const plain = newApprovalStore({ backtest: null })
    const e = await open(dir, plain, AUTHOR, { section: null })
    await e.go(SIM)
    await e.page.locator('[data-start-backtest]').waitFor({ timeout: 30000 })
    await start(e.page)
    await e.page.locator('[data-backtest-report]').waitFor({ timeout: 15000 })
    await e.page.locator('[data-tile="REFUSE"]').waitFor({ timeout: 15000 })
    check(`${dir} 10. a guard's report has no monitor section or note`, (await e.page.locator('[data-monitor-backtest], [data-backtest-monitors]').count()) === 0)
    check(`${dir} 10. a guard's figures stand`, strip(await e.page.locator('[data-tile="REFUSE"] [data-figure]').innerText()) === '4' && (await e.page.locator('[data-stopped]').count()) === 1)
    await e.go(APPROVALS)
    await e.page.locator('[data-backtest-standing="current"]').waitFor({ timeout: 30000 })
    await e.page.locator('[data-checks="pass"], [data-checks="errors"]').first().waitFor({ timeout: 30000 })
    check(`${dir} 10. a guard's Ask opens, with no raised line`, !(await disabled(e.page.locator('[data-action="submit"]'))) && (await e.page.locator('[data-backtest-raised]').count()) === 0)
    await e.context.close()
  } catch (err) {
    check(`${dir} the drive ran through`, false, String(err))
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
