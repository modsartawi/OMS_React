// Insurance rules ▸ Approvals drive (BackOffice spec 3126 / doors 3139 + 3140; oms ticket 611).
//
// Drives the REAL app in Chromium against STUBS, on the REAL envelope. Fixtures and handlers are
// `tools/insurance-rules-stubs.mjs` (`// --- 611 ---`, `approvalStub`, then 615's metrics for the shadow figures and
// 607's reads). ONE HQ store per direction, shared by the author (nalharbi) and the approver (falotaibi).
// 🚩 NOTHING here is driven against a live SIS.Api (3139 / 3140 are built, not yet met live). The draft's back-test
// is found through `GET …/Backtests` (3140). Ticket 618 swaps the doors.
//
// It verifies, in LTR and RTL:
//   1. the Approvals leaf; the draft, its revision; Ask for approval waits for a back-test (none, of an older
//      revision, running) with its reason, and clicking it writes nothing;
//   2. the running back-test finishes (polled) → Ask for approval opens; HQ's checks pass; a server refusal shows
//      the server's words; the author asks with a note → waiting, and the author has nothing left to do;
//   3. the same user holding the approver role cannot approve their own submission;
//   4. the approver sends it back with a note; the author reads it and asks again; the approver approves →
//      draft rules into shadow today, and a new version naming the approver;
//   5. shadow (the approver's clock 2026-10-30): G-003 15 days, its shadow fires, promoted with no reason;
//      G-008 10 days needs a reason (disabled, writes nothing), then promoted with one; the author has no promote;
//   6. versions: who · when (one ltr isolate), the note (an Arabic one rtl), "No note"; restore asks first, makes
//      a NEW draft revision, and its back-test is now out of date;
// The UI language stays English in both passes (`lng` is `en`, 607); RTL flips the direction only.
//   1b. HQ refusing Submit 409 GUARDS_BACKTEST_MISSING is shown in words, with a link to run one;
//   7. a bare 403 is "You do not have access"; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5208 --strictPort
//   2. node tools/insurance-approvals-drive.mjs        (DRIVE_PORT overrides 5208)
import { createRequire } from 'node:module'
import { BACKTEST_DONE, BACKTEST_DONE_ID, approvalStub, envelope, insuranceMetricsStub, insuranceRulesStub, newApprovalStore } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5208}`
const AUTHOR = { user: 'nalharbi', viewer: { author: true, approver: false } }
const APPROVER = { user: 'falotaibi', viewer: { author: false, approver: true } }

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, store, who, { now = '2026-10-27T10:30:00', deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.clock.install({ time: new Date(`${now}+03:00`) })
  const errors = []
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
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: who.user, currentStoreCode: 'P001' }))
    const body = req.postData() ? JSON.parse(req.postData()) : undefined
    const hit =
      approvalStub(req.method(), p, body, { store, ...who, now, deny }) ??
      insuranceMetricsStub(req.method(), p, url.searchParams) ??
      insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/insurance-rules/approvals`)
  return { context, page, errors }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|approvals):|\b(draft\.state|why|shadow|versions|backtest|action|done|note|checks)\.[a-zA-Z]/.test(await page.locator('main').innerText())
const isDisabled = async (loc) => (await loc.getAttribute('aria-disabled')) === 'true' || (await loc.isDisabled())
const ready = (page) => page.locator('[data-approval-panel]').waitFor({ timeout: 30000 })
const writesTo = (store, tail) => store.writes.filter((w) => w.path.endsWith(tail))
const shadowIds = (page) => page.locator('[data-shadow-rule]').evaluateAll((els) => els.map((e) => e.getAttribute('data-shadow-rule')))
const ruleState = (store, id) => store.draft.rules.find((r) => r.id === id)?.state

for (const dir of ['ltr', 'rtl']) {
  // ── 1. no back-test / an older one ────────────────────────────────────────────────────────────
  for (const [label, backtest, why] of [
    ['no back-test', null, 'noBacktest'],
    ['a back-test of revision 11', { ...BACKTEST_DONE, revision: 11 }, 'backtestStale'],
  ]) {
    const store = newApprovalStore({ backtest })
    const { context, page } = await open(dir, store, AUTHOR)
    await ready(page)
    await page.locator('[data-checks="pass"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 1. ${label}: Ask for approval is disabled with its reason`, (await isDisabled(page.locator('[data-action="submit"]'))) && (await page.locator(`[data-why="${why}"]`).count()) === 1)
    check(`${dir} 1. ${label}: a link to run one`, (await page.locator('[data-backtest-standing] a[href="/insurance-rules/simulator"]').count()) === 1)
    await page.locator('[data-action="submit"]').click({ force: true })
    await page.waitForTimeout(300)
    check(`${dir} 1. ${label}: clicking it writes nothing`, writesTo(store, '/Submit').length === 0)
    await context.close()
  }

  // ── 1b. HQ refuses Submit 409 GUARDS_BACKTEST_MISSING (3140): the words, a link to run one, the back-tests re-read ──
  {
    const store409 = newApprovalStore()
    const { context, page, errors } = await open(dir, store409, AUTHOR)
    await ready(page)
    await page.locator('[data-backtest-standing="current"]').waitFor({ timeout: 10000 }).catch(() => {})
    await page.locator('[data-checks="pass"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 1b. the draft's back-test is found through GET …/Backtests (no id anywhere)`, (await page.locator('[data-backtest-standing="current"]').count()) === 1)
    // Behind the screen, HQ no longer holds a finished back-test of revision 12.
    store409.backtests[BACKTEST_DONE_ID].revision = 11
    await page.locator('[data-action="submit"]').click()
    await page.locator('[data-action-refused="GUARDS_BACKTEST_MISSING"]').waitFor({ timeout: 10000 }).catch(() => {})
    const refused = page.locator('[data-action-refused="GUARDS_BACKTEST_MISSING"]')
    check(`${dir} 1b. GUARDS_BACKTEST_MISSING is shown in words`, strip(await refused.innerText().catch(() => '')).includes('HQ found no finished back-test of this revision of the draft. Run one, then ask again.'), strip(await refused.innerText().catch(() => '')))
    check(`${dir} 1b. with a link to run one`, (await refused.locator('a[href="/insurance-rules/simulator"]').count()) === 1)
    await page.locator('[data-backtest-standing="stale"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 1b. the back-tests are read again: now out of date, Ask waits`, (await page.locator('[data-backtest-standing="stale"]').count()) === 1 && (await page.locator('[data-why="backtestStale"]').count()) === 1)
    check(`${dir} 1b. no raw keys`, await noRawKeys(page))
    check(`${dir} 1b. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  const store = newApprovalStore({ backtest: { ...BACKTEST_DONE, status: 'running', progress: 0.4 } })

  // ── 1–2. the author ───────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, store, AUTHOR)
    await ready(page)
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has the Approvals leaf`, (await page.locator('a[href="/insurance-rules/approvals"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'Approvals', strip(await page.locator('h1').first().innerText()))
    check(`${dir} 1. the draft is being authored, revision 12 an ltr isolate`, (await page.locator('[data-approval-state]').getAttribute('data-approval-state')) === 'draft' && (await page.locator('[data-draft-revision] bdi[dir="ltr"]').innerText()) === '12')
    check(`${dir} 1. the back-test is running, 40% ltr`, (await page.locator('[data-backtest-standing]').getAttribute('data-backtest-standing')) === 'running' && (await page.locator('[data-backtest-standing] bdi[dir="ltr"]').first().innerText()) === '40%')
    check(`${dir} 1. running: Ask for approval disabled`, (await isDisabled(page.locator('[data-action="submit"]'))) && (await page.locator('[data-why="backtestRunning"]').count()) === 1)
    check(`${dir} 1. its reason in words`, strip(await page.locator('[data-why]').innerText()) === 'Wait for the back-test to finish.')

    // 2. the back-test finishes; the page polls it
    store.backtests[BACKTEST_DONE_ID] = structuredClone(BACKTEST_DONE)
    await page.locator('[data-backtest-standing="current"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 2. the finished back-test is read by polling`, (await page.locator('[data-backtest-standing="current"]').count()) === 1)
    check(`${dir} 2. HQ's checks pass`, (await page.locator('[data-checks="pass"]').count()) === 1)
    const submit = page.locator('[data-action="submit"]')
    check(`${dir} 2. Ask for approval opens`, !(await isDisabled(submit)) && (await page.locator('[data-why]').count()) === 0)

    // a server refusal reads the server's words (the draft changed hands behind the screen)
    store.meta.state = 'pending'
    await submit.click()
    await page.locator('[data-action-refused]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 2. a refusal shows the server's words`, strip(await page.locator('[data-action-refused]').innerText()).includes('the draft is already waiting for approval'))
    store.meta.state = 'editing'

    await page.locator('[data-note]').fill('GLP-1 rules: ready for review')
    await submit.click()
    await page.locator('[data-approval-state="waiting"]').waitFor({ timeout: 10000 }).catch(() => {})
    const sub = writesTo(store, '/Submit')
    check(`${dir} 2. Submit carries the draft's revision and the note`, sub.length === 2 && sub[1].body.revision === 12 && sub[1].body.note === 'GLP-1 rules: ready for review', JSON.stringify(sub))
    check(`${dir} 2. waiting for approval; the draft rules wait too`, (await page.locator('[data-approval-state="waiting"]').count()) === 1 && ruleState(store, 'G-006') === 'waiting' && ruleState(store, 'G-011') === 'waiting')
    check(`${dir} 2. asked by · when, one ltr isolate`, strip(await page.locator('[data-submitted] bdi[dir="ltr"]').innerText()) === 'nalharbi · 2026-10-27 10:30')
    // 618: BackOffice has no insurance-rules grant probe, so the screen cannot tell an author from an approver; it
    // offers both and HQ refuses. What it CAN tell: the asker never approves their own request.
    check(`${dir} 2. the asker's Approve / Send back are off: their own submission`, (await isDisabled(page.locator('[data-action="approve"]'))) && (await page.locator('[data-why="ownSubmission"]').count()) === 1)
    check(`${dir} 2. two shadow rules (promote offered; HQ refuses an author a bare 403)`, (await page.locator('[data-shadow-rule]').count()) === 2)
    check(`${dir} 2. no raw keys`, await noRawKeys(page))
    check(`${dir} 2. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 3. the author holding the approver role too ─────────────────────────────────────────────
  {
    const { context, page } = await open(dir, store, { user: 'NALHARBI', viewer: { author: true, approver: true } })
    await ready(page)
    const approve = page.locator('[data-action="approve"]')
    check(`${dir} 3. own submission: Approve and Send back disabled, with the reason`, (await isDisabled(approve)) && (await isDisabled(page.locator('[data-action="sendBack"]'))) && (await page.locator('[data-why="ownSubmission"]').count()) === 1)
    await approve.click({ force: true })
    await page.waitForTimeout(300)
    check(`${dir} 3. clicking it writes nothing`, writesTo(store, '/Approve').length === 0)
    await context.close()
  }

  // ── 4. send back, ask again, approve ────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, store, APPROVER)
    await ready(page)
    check(`${dir} 4. the approver reads the author's note`, strip(await page.locator('[data-submitted-note]').innerText()) === 'GLP-1 rules: ready for review')
    check(`${dir} 4. Approve and Send back are open`, !(await isDisabled(page.locator('[data-action="approve"]'))) && !(await isDisabled(page.locator('[data-action="sendBack"]'))))
    await page.locator('[data-note]').fill('أضف رمز ICD للسكري')
    await page.locator('[data-action="sendBack"]').click()
    await page.locator('[data-approval-state="draft"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 4. sent back: a draft again, its rules too`, writesTo(store, '/SendBack').length === 1 && writesTo(store, '/SendBack')[0].body.note === 'أضف رمز ICD للسكري' && ruleState(store, 'G-006') === 'draft')
    // 618: no grant probe — the draft's Ask is offered to anyone; HQ answers an approver without the author grant a bare 403.
    check(`${dir} 4. on a draft the next step is Ask for approval`, (await page.locator('[data-action="submit"]').count()) === 1)
    await context.close()
  }
  {
    const { context, page } = await open(dir, store, AUTHOR)
    await ready(page)
    check(`${dir} 4. the author reads who sent it back and why (Arabic rtl)`, strip(await page.locator('[data-sent-back] bdi[dir="ltr"]').innerText()) === 'falotaibi' && strip(await page.locator('[data-sent-back] p bdi').innerText()) === 'أضف رمز ICD للسكري')
    await page.locator('[data-checks="pass"]').waitFor({ timeout: 10000 }).catch(() => {})
    await page.locator('[data-action="submit"]').click()
    await page.locator('[data-approval-state="waiting"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 4. the author asks again`, store.meta.state === 'pending')
    await context.close()
  }

  // ── 4–5. approve, then promote (the approver's clock: 2026-10-30) ───────────────────────────
  {
    const { context, page, errors } = await open(dir, store, APPROVER, { now: '2026-10-30T10:00:00' })
    await ready(page)
    await page.locator('[data-action="approve"]').click()
    await page.locator('[data-approval-state="draft"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 4. approved: the draft rules into shadow today`, ruleState(store, 'G-006') === 'shadow' && store.draft.rules.find((r) => r.id === 'G-006').shadowSince === '2026-10-30')
    await page.locator('[data-version="5"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 4. a new version, by the approver`, strip(await page.locator('[data-version="5"] [data-col="byAt"] bdi[dir="ltr"]').innerText()) === 'falotaibi · 2026-10-30 10:00')
    await page.locator('[data-shadow-rule="G-006"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5. shadow lists the rules in shadow`, JSON.stringify(await shadowIds(page)) === JSON.stringify(['G-003', 'G-005', 'G-006', 'G-008', 'G-011']), JSON.stringify(await shadowIds(page)))

    const g3 = page.locator('[data-shadow-rule="G-003"]')
    await g3.locator('[data-shadow-fires="240"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 5. G-003: since 2026-10-15, 15 days, 240 shadow fires, each ltr`, (await g3.locator('[data-shadow-since] bdi[dir="ltr"]').innerText()) === '2026-10-15' && (await g3.locator('[data-shadow-days] bdi[dir="ltr"]').innerText()) === '15' && (await g3.locator('[data-shadow-fires] bdi[dir="ltr"]').innerText()) === '240')
    check(`${dir} 5. G-003: the name in the reader's language, isolated`, (await g3.locator('bdi[data-rule-name]').innerText()) === 'GLP-1: four pens per 28 days', await g3.locator('[data-rule-name]').innerText())
    check(`${dir} 5. G-003: no reason asked after 14 days`, (await g3.locator('[data-skip-reason]').count()) === 0 && !(await isDisabled(g3.locator('[data-promote]'))))
    await g3.locator('[data-promote]').click()
    await page.locator('[data-shadow-rule="G-003"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    const p3 = writesTo(store, '/Rules/G-003/Promote')
    check(`${dir} 5. G-003 promoted with no reason; it leaves shadow`, p3.length === 1 && JSON.stringify(p3[0].body) === '{}' && ruleState(store, 'G-003') === 'live' && (await page.locator('[data-shadow-rule="G-003"]').count()) === 0)

    const g8 = page.locator('[data-shadow-rule="G-008"]')
    check(`${dir} 5. G-008: 10 days, no fires yet`, (await g8.locator('[data-shadow-days] bdi[dir="ltr"]').innerText()) === '10' && (await g8.locator('[data-shadow-fires]').getAttribute('data-shadow-fires')) === '0')
    check(`${dir} 5. G-008: under 14 days needs a reason`, (await g8.locator('[data-skip-reason]').count()) === 1 && (await isDisabled(g8.locator('[data-promote]'))) && (await g8.locator('[data-promote-why="reason"]').count()) === 1)
    await g8.locator('[data-promote]').click({ force: true })
    await page.waitForTimeout(300)
    check(`${dir} 5. G-008: clicking with no reason writes nothing`, writesTo(store, '/Rules/G-008/Promote').length === 0)
    await g8.locator('[data-skip-reason]').fill('SFDA confirmed the list; payer asked for it live')
    await g8.locator('[data-promote]').click()
    await page.locator('[data-shadow-rule="G-008"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    const p8 = writesTo(store, '/Rules/G-008/Promote')
    check(`${dir} 5. G-008 promoted with its reason`, p8.length === 1 && p8[0].body.skipReason === 'SFDA confirmed the list; payer asked for it live' && ruleState(store, 'G-008') === 'live')
    check(`${dir} 5. no raw keys`, await noRawKeys(page))
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6. versions, restore ────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, store, AUTHOR, { now: '2026-10-30T11:00:00' })
    await ready(page)
    await page.locator('[data-version]').first().waitFor({ timeout: 10000 })
    const versions = await page.locator('[data-version]').evaluateAll((els) => els.map((e) => e.getAttribute('data-version')))
    check(`${dir} 6. versions newest first`, JSON.stringify(versions) === JSON.stringify(['7', '6', '5', '4', '3', '2']), JSON.stringify(versions))
    check(`${dir} 6. a version: number and who · when ltr, the note`, (await page.locator('[data-version="4"] [data-col="version"] bdi[dir="ltr"]').innerText()) === '4' && strip(await page.locator('[data-version="4"] [data-col="byAt"] bdi[dir="ltr"]').innerText()) === 'falotaibi · 2026-10-20 11:15' && strip(await page.locator('[data-version="4"] [data-col="note"] bdi').innerText()) === 'SFDA not-marketed guard into shadow.')
    check(`${dir} 6. an Arabic note isolated, a missing one says so`, (await page.locator('[data-version="3"] [data-col="note"] bdi').innerText()) === 'أقلام GLP-1 كل 28 يوماً في وضع الظل' && strip(await page.locator('[data-version="2"] [data-col="note"]').innerText()) === 'No note', strip(await page.locator('[data-version="2"]').innerText()))
    // Approved: the draft row is gone, the door shows the new version at revision 0 (3139) — nothing to ask about.
    check(`${dir} 6. after the approval there is no draft: nothing to ask for`, (await page.locator('[data-draft-revision] bdi[dir="ltr"]').innerText()) === '0' && (await page.locator('[data-action="submit"]').count()) === 0)
    await page.locator('[data-restore="3"]').click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 6. restore asks first`, strip(await dialog.innerText()).includes('Version 3 replaces the current draft as a new draft.'), strip(await dialog.innerText().catch(() => '')))
    check(`${dir} 6. nothing written before the answer`, writesTo(store, '/Restore').length === 0)
    await dialog.locator('button').last().click()
    await page.locator('[data-draft-revision] bdi:text-is("1")').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 6. restored as a NEW draft`, writesTo(store, '/Versions/3/Restore').length === 1 && (await page.locator('[data-draft-revision] bdi[dir="ltr"]').innerText()) === '1')
    await page.locator('[data-backtest-standing="stale"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 6. its back-test is now out of date: Ask for approval waits`, (await page.locator('[data-backtest-standing="stale"]').count()) === 1 && (await page.locator('[data-why="backtestStale"]').count()) === 1)
    check(`${dir} 6. the draft is version 3's: shadow holds G-003 only`, JSON.stringify(await shadowIds(page)) === JSON.stringify(['G-003']), JSON.stringify(await shadowIds(page)))
    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7. a bare 403 ───────────────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, newApprovalStore(), AUTHOR, { deny: ['InsuranceRules/Guards/Draft'] })
    await page.locator('[data-approvals-denied]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 7. a bare 403 is "You do not have access"`, (await page.locator('[data-approvals-denied]').count()) === 1 && strip(await page.locator('[data-approvals-denied]').innerText()).startsWith('You do not have access'))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
