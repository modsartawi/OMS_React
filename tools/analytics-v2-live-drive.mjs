// Analytics v2 LIVE drive — spec 819 / ticket 835 (BackOffice spec 3408, its server half).
//
// Walks the web against a REAL SIS.Api (no stubs) and records every Analytics/* and Copilot/* call it makes, so each
// difference from the stubbed wire is a drift report (835's drift rule: correct BackOffice 3408 first, then 819's
// transcription, then the client). The acceptance case runs on whatever data the SIS.Api's Cube serves:
//   0. the probe, the model (the v2 areas and measures), the health;
//   1. the owner's sentence in the copilot builds a report (create_report), with its assumptions and next steps;
//   2. its designer opens and every panel answers (no refused or failed panel), live figures as chips;
//   3. its page runs: every panel answers, the Words door fills each figure, no raw token;
//   4. Share with a role from AudienceCandidates;
//   5. a daily schedule to audience members, then Send now; the run is kept;
//   6. the email arrives in the local Mailpit with its PDF;
//   7. the print route a scheduled render opens (ADR 0125: ticket, render doors, data-print-ready).
//
// Run (ticket 835's local rig, 2026-11-07: SIS.Api on :5111, Cube on the Docker host, Mailpit on :18025):
//   1. npx vite --port 5173 --strictPort          (5173: the SIS.Api worker's Analytics:ReportWorker:WebBaseUrl)
//   2. sign in one of three ways, the secret never in the repo:
//        SIS_SIGN_IN=window            — a visible browser opens on /login; sign in there by hand
//        SIS_USER=<id> SIS_PASS=<pw>   — POST Auth/Login through the proxy
//        SIS_COOKIE=<sis_session>      — a cookie copied from a browser session
//      A good sign-in is kept in DRIVE_STATE (outside the repo) and reused while it still answers the probe.
//   3. DRIVE_PORT=5173 DRIVE_STATE=<file> DRIVE_OUT=<dir> [MAILPIT=http://10.211.55.2:18025] node tools/analytics-v2-live-drive.mjs
//      DRIVE_STEPS=0,1,2 runs only those steps (a report id from an earlier run: REPORT_ID=…).
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5173}`
const OUT = process.env.DRIVE_OUT || 'tools/.analytics-v2-live'
const STATE = process.env.DRIVE_STATE || `${OUT}/state.json`
const MAILPIT = process.env.MAILPIT || 'http://10.211.55.2:18025'
const SHOTS = '.issues/assets/835-shots'
const STEPS = (process.env.DRIVE_STEPS ?? '').split(',').filter(Boolean).map(Number)
const step = (n) => STEPS.length === 0 || STEPS.includes(n)
mkdirSync(OUT, { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const WIRE = `${OUT}/wire.jsonl`
writeFileSync(WIRE, '')

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const note = (text) => console.log(`NOTE  ${text}`)
const SENTENCE =
  'How were sales for each channel yesterday? Focus on two order types, HungerStation and QC, compare them, and show their cancellation rates. The period is a parameter that defaults to yesterday and can be changed. Save it as a report template my team can re-run, schedule it every day by email to named people, and include charts.'
/** A token left raw on screen: v2's `{{fig:…}}` (3408 drift 7) or the web's earlier `{p1:total}`. */
const RAW_TOKEN = /\{\{fig:[^}]*\}\}|\{p\d+:[a-z_]+\}/

// ── Sign-in (kept in DRIVE_STATE while it still answers) ──────────────────────────────────────────
const WINDOW = process.env.SIS_SIGN_IN === 'window'
const browser = await chromium.launch({ headless: !WINDOW })
const probe = async (ctx) => {
  const res = await ctx.request.get(`${BASE}/api/Analytics/Access`, { headers: { 'X-Web-Client': '1' } }).catch(() => null)
  return res?.status() === 200 ? (await res.json()).data : null
}
let context = existsSync(STATE) ? await browser.newContext({ storageState: STATE, viewport: { width: 1600, height: 1300 } }) : null
let access = context ? await probe(context) : null
if (!access) {
  await context?.close()
  context = await browser.newContext({ viewport: { width: 1600, height: 1300 } })
  if (WINDOW) {
    const login = await context.newPage()
    await login.goto(`${BASE}/login`)
    console.log('Sign in in the browser window that just opened (5 minutes)…')
    let signedIn = false
    for (let i = 0; i < 1500 && !signedIn; i++) {
      signedIn = (await context.cookies(BASE)).some((c) => c.name === 'sis_session') && !new URL(login.url()).pathname.startsWith('/login')
      if (!signedIn) await login.waitForTimeout(200)
    }
    if (!signedIn) {
      console.error('No sign-in within 5 minutes.')
      process.exit(2)
    }
    await login.close()
  } else if (process.env.SIS_COOKIE) {
    await context.addCookies([{ name: 'sis_session', value: process.env.SIS_COOKIE, url: BASE }])
  } else if (process.env.SIS_USER) {
    await context.request.post(`${BASE}/api/Auth/Login`, {
      headers: { 'Content-Type': 'application/json', 'X-Web-Client': '1' },
      data: { userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' },
    })
  } else {
    console.error('No kept sign-in: set SIS_SIGN_IN=window, SIS_USER + SIS_PASS, or SIS_COOKIE.')
    process.exit(2)
  }
  access = await probe(context)
  if (!access) {
    console.error('Signed in, but Analytics/Access does not answer 200.')
    process.exit(2)
  }
  await context.storageState({ path: STATE })
}
console.log(`Signed in; the probe answers ${JSON.stringify(access)}.`)

// ── The wire recorder: every Analytics/* and Copilot/* call, with its body and its answer ─────────
const wire = []
context.on('response', async (res) => {
  const url = new URL(res.url())
  const m = url.pathname.match(/^\/api\/((?:Analytics|Copilot)\/.*)$/)
  if (!m) return
  const req = res.request()
  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const row = {
    at: new Date().toISOString(),
    method: req.method(),
    path: m[1],
    query: url.search,
    status: res.status(),
    sent: req.postData() ? safeJson(req.postData()) : null,
    code: body?.errors?.[0]?.errorCode ?? null,
    message: body?.message ?? null,
    data: body?.data ?? null,
  }
  wire.push(row)
  appendFileSync(WIRE, JSON.stringify(row) + '\n')
  if (row.status >= 400) console.log(`WIRE  ${row.status} ${row.method} ${row.path}${row.query} ${row.code ?? ''} ${row.message ?? ''}`.trim())
})
function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}
const api = async (method, path, data) => {
  const res = await context.request.fetch(`${BASE}/api/${path}`, { method, data, headers: { 'X-Web-Client': '1' } })
  const body = await res.json().catch(() => null)
  return { status: res.status(), body, data: body?.data }
}
const errors = []
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(e.message))
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/835-${name}.png`, fullPage: true }).catch(() => {})
/** Each board panel on the page and its state (`idle`, `empty`, `refused`, `failed`, `loading`). */
const panelStates = (p, scope = 'body') =>
  p.locator(`${scope} [data-board-panel]`).evaluateAll((els) =>
    els.map((e) => `${e.closest('[data-designer-block],[data-report-panel]')?.dataset.designerBlock ?? e.closest('[data-report-panel]')?.dataset.reportPanel ?? '?'}:${e.dataset.boardPanelState}`),
  )
const settle = (p, scope = 'body', timeout = 60000) =>
  p
    .waitForFunction(
      (s) => {
        const ps = [...document.querySelectorAll(`${s} [data-board-panel]`)]
        return ps.length > 0 && ps.every((e) => !['loading', 'busy'].includes(e.dataset.boardPanelState) && e.getAttribute('aria-busy') !== 'true')
      },
      scope,
      { timeout },
    )
    .catch(() => {})
const failedOn = (since, re) => wire.slice(since).filter((r) => re.test(r.path) && r.status >= 400)

// ── 0. The probe, the model, the health ──────────────────────────────────────────────────────────
if (step(0)) {
  check('0: the probe carries canView, canAuthor and canCurate as booleans', ['canView', 'canAuthor', 'canCurate'].every((k) => typeof access[k] === 'boolean'), JSON.stringify(access))
  check('0: this account may author (the walk builds and schedules)', access.canAuthor === true)
  const model = await api('GET', 'Analytics/Model')
  const views = model.data?.views ?? model.data?.areas ?? []
  const measures = (model.data?.measures ?? []).map((m) => m.key)
  writeFileSync(`${OUT}/model.json`, JSON.stringify(model.data, null, 1))
  check('0: the model answers', model.status === 200 && measures.length > 0, `HTTP ${model.status}, ${measures.length} measures, ${views.length} views`)
  for (const key of ['cancellation_rate', 'net_value_sar', 'till_sales']) note(`model measure ${key}: ${measures.includes(key) ? 'present' : 'ABSENT'}`)
  note(`model views: ${views.map((v) => v.key ?? v.name ?? v).join(', ')}`)
  const health = await api('GET', 'Analytics/Health')
  note(`health: HTTP ${health.status} ${JSON.stringify(health.data ?? health.body?.message).slice(0, 300)}`)
}

// ── 1. The owner's sentence builds a report ──────────────────────────────────────────────────────
let reportId = process.env.REPORT_ID ?? null
if (step(1) && !reportId) {
  const since = wire.length
  await page.goto(`${BASE}/analytics`)
  const button = page.locator('#layout-topbar [data-copilot-button]')
  const sheet = page.locator('dialog[data-copilot-sheet]')
  await button.waitFor({ timeout: 30000 })
  await button.click()
  await sheet.locator('[data-copilot-question]').fill(SENTENCE)
  const t0 = Date.now()
  await sheet.locator('[data-copilot-send]').click()
  const asked = await page.waitForResponse((r) => r.url().includes('/api/Copilot/Ask'), { timeout: 240000 }).catch(() => null)
  // the recorder parses the body on its own tick: read it here, not from `wire`
  const answer = asked ? { data: (await asked.json().catch(() => null))?.data ?? null } : null
  check('1: the copilot answers the sentence', asked?.status() === 200 && answer?.data != null, `${Math.round((Date.now() - t0) / 1000)} s, HTTP ${asked?.status()} ${answer?.code ?? ''} ${answer?.message ?? ''}`)
  const d = answer?.data ?? {}
  writeFileSync(`${OUT}/copilot-answer.json`, JSON.stringify(d, null, 1))
  note(`served by ${d.servedBy}; outcome ${d.outcome}; stoppedEarly ${d.stoppedEarly}; trace ${JSON.stringify((d.trace ?? []).map((t) => [t.tool, t.ok]))}`)
  check('1: the copilot finished within its limits (not stoppedEarly)', d.stoppedEarly === false, String(d.answer ?? '').slice(0, 200))
  const built = (d.reportRefs ?? [])[0]
  check('1: create_report built one report (reportRefs)', !!built?.id, JSON.stringify(d.reportRefs))
  check('1: … with its assumptions, one line each in both languages', Array.isArray(d.assumptions) && d.assumptions.length > 0, JSON.stringify(d.assumptions)?.slice(0, 300))
  check('1: … and next steps (Share…, Schedule…), not a share or a schedule done', Array.isArray(built?.nextSteps ?? d.nextSteps), JSON.stringify(built?.nextSteps ?? d.nextSteps))
  reportId = built?.id ?? null
  if (reportId) {
    const link = sheet.locator(`[data-copilot-report-open="${reportId}"]`)
    await link.waitFor({ timeout: 10000 }).catch(() => {})
    check('1: the answer offers its designer', (await link.getAttribute('href').catch(() => null)) === `/analytics/report/${reportId}/edit`, String(await link.getAttribute('href').catch(() => null)))
    // The words asked to share and to schedule: the panel draws both links, to the report page's own dialogs.
    const steps = await sheet
      .locator(`[data-copilot-report-steps="${reportId}"] [data-copilot-report-step]`)
      .evaluateAll((els) => els.map((e) => `${e.dataset.copilotReportStep}=${e.getAttribute('href')}`))
      .catch(() => [])
    check(
      '1: … Share and Schedule links to the report’s dialogs',
      steps.join(',') === `share=/analytics/report/${reportId}#share,schedule=/analytics/report/${reportId}#schedule`,
      steps.join(','),
    )
    const assumed = await sheet.locator('[data-copilot-assumptions] li').count().catch(() => 0)
    check('1: … the assumptions listed under the answer', assumed === (d.assumptions?.length ?? -1) && assumed > 0, `${assumed} drawn of ${d.assumptions?.length}`)
    check('1: … and no report link written into the answer itself', !/\]\((\/reports\/|report:)/.test(String(d.answer ?? '')), String(d.answer ?? '').match(/\[[^\]]*\]\([^)]*\)/g)?.join(' ') ?? '')
  }
  await shot(page, '1-copilot')
  await page.keyboard.press('Escape')
}
if (!reportId) {
  console.log('No report to walk: stopping.')
  await finish()
}
writeFileSync(`${OUT}/report-id.txt`, reportId)
note(`report ${reportId}`)

// ── 2. Its designer ──────────────────────────────────────────────────────────────────────────────
if (step(2)) {
  const since = wire.length
  await page.goto(`${BASE}/analytics/report/${reportId}/edit`)
  const opened = await page.locator(`[data-report-designer="${reportId}"]`).waitFor({ timeout: 30000 }).then(() => true, () => false)
  check('2: the designer opens the report', opened, page.url())
  await settle(page, '[data-designer-sections]')
  const states = await panelStates(page, '[data-designer-sections]')
  check('2: every panel in the designer answers (none refused, none failed)', states.length > 0 && states.every((s) => /:(idle|empty)$/.test(s)), states.join(' '))
  const chips = await page.locator('[data-designer-figure-chip]').evaluateAll((els) => els.map((e) => `${e.textContent?.trim()}=${e.dataset.figureOk}`))
  check('2: live figures show as chips, each an existing figure', chips.length > 0 && chips.every((c) => c.endsWith('=yes')), chips.join(' | ') || 'no chips')
  check('2: no raw token in the designer', !RAW_TOKEN.test(await page.locator('[data-designer-sections]').innerText().catch(() => '')))
  const period = await page.locator('[data-board-param="period"] [data-board-filter-period]').first().inputValue().catch(() => null)
  check('2: the period parameter defaults to yesterday', period === 'yesterday', String(period))
  const bad = failedOn(since, /^Analytics\//)
  check('2: no Analytics door refused the designer', bad.length === 0, bad.map((r) => `${r.status} ${r.path} ${r.code ?? ''} ${r.message ?? ''}`).join(' | '))
  await shot(page, '2-designer')
}

// ── 3. Its page ──────────────────────────────────────────────────────────────────────────────────
if (step(3)) {
  const since = wire.length
  await page.goto(`${BASE}/analytics/report/${reportId}`)
  const opened = await page.locator(`[data-analytics-report="${reportId}"]`).waitFor({ timeout: 30000 }).then(() => true, () => false)
  check('3: the report page opens', opened)
  await settle(page, `[data-analytics-report="${reportId}"]`)
  const states = await panelStates(page, `[data-analytics-report="${reportId}"]`)
  check('3: every panel answers on the page', states.length > 0 && states.every((s) => /:(idle|empty)$/.test(s)), states.join(' '))
  const asks = wire.slice(since).filter((r) => r.path === 'Analytics/Query')
  check('3: each panel asks Query by report and panel, with the period', asks.length > 0 && asks.every((r) => r.sent?.itemId === reportId && r.sent?.panelId && r.status === 200), asks.map((r) => `${r.sent?.panelId}:${r.status}`).join(' '))
  const words = wire.slice(since).filter((r) => /^Analytics\/Report\/.+\/Words$/.test(r.path))
  check('3: the Words door answers', words.length > 0 && words.every((r) => r.status === 200), words.map((r) => `${r.status} ${r.code ?? ''} ${r.message ?? ''}`).join(' | '))
  const figures = await page.locator('[data-report-figure]').evaluateAll((els) => els.map((e) => `${e.dataset.reportFigure}=${e.textContent?.trim()}`))
  note(`figures on the page: ${figures.join(' | ') || 'none'}`)
  check('3: no raw token on the page', !RAW_TOKEN.test(await page.locator(`[data-analytics-report="${reportId}"]`).innerText().catch(() => '')))
  const bad = failedOn(since, /^Analytics\//)
  check('3: no Analytics door refused the page', bad.length === 0, bad.map((r) => `${r.status} ${r.path} ${r.code ?? ''} ${r.message ?? ''}`).join(' | '))
  await shot(page, '3-report-en')
}

// ── 4. Share with a role ─────────────────────────────────────────────────────────────────────────
if (step(4)) {
  const since = wire.length
  await page.goto(`${BASE}/analytics/report/${reportId}`)
  await page.locator(`[data-analytics-report="${reportId}"]`).waitFor({ timeout: 30000 })
  const share = page.locator('[data-analytics-action="share"]')
  if ((await share.count()) === 0) {
    note('4: no Share action (already shared?) — skipped')
  } else {
    await share.click()
    await page.locator('[data-analytics-share="share"]').waitFor({ timeout: 10000 })
    await page.locator('[data-analytics-share-chosen]').click()
    const roles = page.locator('[data-testid="analytics-share-roles"]')
    await roles.locator('[data-multi-select-trigger]').click()
    const first = roles.locator('[data-option]').first()
    const got = await first.waitFor({ timeout: 15000 }).then(() => true, () => false)
    const cand = wire.slice(since).find((r) => r.path === 'Analytics/AudienceCandidates')
    check('4: AudienceCandidates answers with roles to offer', got && cand?.status === 200, `HTTP ${cand?.status} ${cand?.code ?? ''} ${JSON.stringify(cand?.data)?.slice(0, 200)}`)
    if (got) {
      const role = await first.getAttribute('data-option')
      await first.locator('input[type="checkbox"]').check()
      await page.keyboard.press('Escape')
      await page.locator('[data-analytics-share-save]').click()
      const header = page.locator('[data-analytics-report-header]')
      const chip = await header.locator('[data-analytics-audience="chosen"]').waitFor({ timeout: 15000 }).then(() => true, () => false)
      const posted = wire.slice(since).find((r) => /\/Share$/.test(r.path))
      check(`4: Share with ${role} lands, the chip names the audience`, chip && posted?.status === 200, `HTTP ${posted?.status} ${posted?.code ?? ''} ${posted?.message ?? ''} sent ${JSON.stringify(posted?.sent)}`)
      note(`4: the item now reads audience ${JSON.stringify(posted?.data?.audience)}`)
    }
    await shot(page, '4-shared')
  }
  const history = await api('GET', `Analytics/Item/${encodeURIComponent(reportId)}/History`)
  note(`4: History door (3408 drift 16/23) HTTP ${history.status}: ${JSON.stringify(history.data)?.slice(0, 300)}`)
}

// ── 5. A daily schedule, then Send now ───────────────────────────────────────────────────────────
let runId = null
const mailBefore = await fetch(`${MAILPIT}/api/v1/messages`).then((r) => r.json()).then((j) => j.total ?? 0).catch(() => null)
if (step(5)) {
  const since = wire.length
  await page.goto(`${BASE}/analytics/report/${reportId}`)
  await page.locator(`[data-analytics-report="${reportId}"]`).waitFor({ timeout: 30000 })
  await page.locator('[data-report-schedules]').click()
  await page.locator('[data-schedule-new]').click()
  const editor = page.locator('[data-schedule-editor="new"]')
  await editor.waitFor({ timeout: 10000 })
  await editor.locator('[data-schedule-time]').fill('06:30')
  const people = page.locator('[data-testid="analytics-schedule-recipients"]')
  await people.locator('[data-multi-select-trigger]').click()
  const options = people.locator('[data-option]:not([aria-disabled="true"])')
  const got = await options.first().waitFor({ timeout: 15000 }).then(() => true, () => false)
  const offered = await people.locator('[data-option]').evaluateAll((els) => els.map((e) => `${e.dataset.option}${e.getAttribute('aria-disabled') === 'true' ? '(off)' : ''}`))
  note(`5: recipients offered: ${offered.join(', ') || 'none'}`)
  check('5: at least one audience member can receive it', got, offered.join(', '))
  if (got) await options.first().locator('input[type="checkbox"]').check()
  await page.keyboard.press('Escape')
  await page.locator('[data-schedule-save]').click()
  const saved = await page.waitForResponse((r) => /\/Schedules$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null)
  const row = wire.slice(since).find((r) => /\/Schedules$/.test(r.path) && r.method === 'POST')
  check('5: the schedule saves', saved?.status() === 200, `HTTP ${row?.status} ${row?.code ?? ''} ${row?.message ?? ''} sent ${JSON.stringify(row?.sent)} data ${JSON.stringify(row?.data)?.slice(0, 300)}`)
  await shot(page, '5-schedule')
  const sid = row?.data?.id
  if (sid) {
    await page.locator(`[data-schedule-editor="${sid}"]`).waitFor({ timeout: 10000 }).catch(() => {})
    const sending = page.waitForResponse((r) => r.url().includes(`/Schedules/${sid}/SendNow`), { timeout: 15000 }).catch(() => null)
    await page.locator('[data-schedule-send-now]').click()
    const sent = await sending
    const now = wire.slice(since).find((r) => /\/SendNow$/.test(r.path))
    check('5: Send now is accepted', sent?.status() === 200, `HTTP ${now?.status} ${now?.code ?? ''} ${now?.message ?? ''} ${JSON.stringify(now?.data)?.slice(0, 300)}`)
    runId = now?.data?.id ?? now?.data?.runId ?? null
  }
  await page.keyboard.press('Escape')
}

// ── 6. The email in Mailpit, with its PDF; the kept run ──────────────────────────────────────────
if (step(6)) {
  let msg = null
  for (let i = 0; i < 60 && !msg && mailBefore !== null; i++) {
    const list = await fetch(`${MAILPIT}/api/v1/messages`).then((r) => r.json()).catch(() => null)
    if ((list?.total ?? 0) > mailBefore) msg = list.messages[0]
    else await page.waitForTimeout(5000)
  }
  check('6: the report email reaches the mailbox within 5 minutes', !!msg, msg ? `${msg.Subject} → ${msg.To?.map((t) => t.Address).join(', ')}` : `Mailpit ${mailBefore === null ? 'unreachable' : 'had nothing new'}`)
  if (msg) {
    const full = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then((r) => r.json())
    writeFileSync(`${OUT}/mail.json`, JSON.stringify({ ...full, HTML: undefined, Text: undefined }, null, 1))
    writeFileSync(`${OUT}/mail.html`, full.HTML ?? '')
    const pdf = (full.Attachments ?? []).find((a) => /pdf/i.test(a.ContentType))
    check('6: … with the charts as a PDF', !!pdf && pdf.Size > 1000, JSON.stringify((full.Attachments ?? []).map((a) => [a.FileName, a.ContentType, a.Size])))
    check('6: … from a company sender, to a company address', /@al-dawaa\.com\.sa$/i.test(full.From?.Address ?? '') && (full.To ?? []).every((t) => /@al-dawaa\.com\.sa$/i.test(t.Address)), `${full.From?.Address} → ${(full.To ?? []).map((t) => t.Address).join(', ')}`)
    check('6: … no raw token in the email', !RAW_TOKEN.test(full.HTML ?? ''))
  }
  await page.goto(`${BASE}/analytics/report/${reportId}/runs`)
  const listed = await page.locator(`[data-analytics-runs="${reportId}"]`).waitFor({ timeout: 20000 }).then(() => true, () => false)
  const runs = await page.locator('[data-run]').evaluateAll((els) => els.map((e) => `${e.dataset.run}:${e.querySelector('[data-run-outcome]')?.dataset.runOutcome}`))
  check('6: the kept runs list the send, with its outcome', listed && runs.length > 0, runs.join(' ') || 'none')
  await shot(page, '6-kept-runs')
}

// ── 7. The print route a scheduled render opens (ADR 0125) ───────────────────────────────────────
if (step(7)) {
  const since = wire.length
  await page.goto(`${BASE}/analytics/print/report/${reportId}?period=yesterday&lang=en&ticket=not-a-real-ticket`)
  await page.waitForTimeout(8000)
  const ready = await page.locator('[data-print-ready]').count()
  check('7: the print route sets data-print-ready once its panels drew (ADR 0125)', ready === 1, String(ready))
  const render = wire.slice(since).filter((r) => r.path.startsWith('Analytics/Render/'))
  check('7: the print route with a ticket asks the Render doors, not the session doors', render.length > 0, wire.slice(since).map((r) => r.path).join(', '))
  await shot(page, '7-print')
}

// ── ar ───────────────────────────────────────────────────────────────────────────────────────────
if (step(8)) {
  await page.goto(`${BASE}/analytics/report/${reportId}`)
  await page.evaluate(() => localStorage.setItem('i18nextLng', 'ar'))
  await page.reload()
  await page.locator(`[data-analytics-report="${reportId}"]`).waitFor({ timeout: 30000 })
  await settle(page, `[data-analytics-report="${reportId}"]`)
  check('8: the report reads RTL under Arabic', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('8: no raw token under Arabic', !RAW_TOKEN.test(await page.locator(`[data-analytics-report="${reportId}"]`).innerText().catch(() => '')))
  await shot(page, '8-report-ar')
  await page.evaluate(() => localStorage.setItem('i18nextLng', 'en'))
}

await finish()

async function finish() {
  const refused = wire.filter((r) => r.status >= 400)
  writeFileSync(`${OUT}/refused.json`, JSON.stringify(refused, null, 1))
  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '))
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed; ${wire.length} calls recorded in ${WIRE}, ${refused.length} refused (${OUT}/refused.json).`)
  await browser.close()
  process.exit(failed.length ? 1 : 0)
}
