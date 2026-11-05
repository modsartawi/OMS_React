// Copilot rules drive (ticket 790, BackOffice 3395) — curators edit the house rules, try a draft and roll back.
//
// Drives the REAL app in Chromium against a STATEFUL STUB of the doors: BackOffice 3395 is not minted, so there
// is no live SIS.Api to point at. The stub answers ticket 790's proposed wire, camelCase:
//   GET  Copilot/Access          → { canAsk, canUseMcp, canCurate }
//   GET  Copilot/Prompt          → { core, active: version }
//   GET  Copilot/Prompt/History  → version[] (newest first)
//   POST Copilot/Prompt          { text, note, baseVersion } → version   (COPILOT-411 when baseVersion is stale)
//   POST Copilot/Prompt/Try      { question, text }          → answer    (no conversation)
//   POST Copilot/Prompt/Revert   { version, baseVersion }    → version
//   POST Copilot/Ask             → answer with `promptVersion` = the active version
// where version = { version, text, savedBy, savedAt, note, revertedFrom }.
//
// The stub's Try answers as a model would: with rule 12 in the draft, one column per compared thing; without it,
// a "Metric | Value" list. That stands in for the live proof, which needs 3395 and a real model.
//
//   1. run the app:  npx vite --port 5203 --strictPort
//   2. DRIVE_PORT=5203 node tools/copilot-rules-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})
const refusal = (code, status, message) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })
const plain = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()

const CORE = 'You answer only from the OMS tools.\nNever invent an order number.'
const RULE_8 = '8. Write light markdown: paragraphs, lists and simple tables.'
const RULE_12 = '12. A comparison is a table with one column per compared thing.'
const V1_TEXT = `${RULE_8}\n${RULE_12}`
const COMPARE_Q = 'Compare Riyadh and Jeddah orders this week'

function stubState() {
  return {
    active: 1,
    versions: [{ version: 1, text: V1_TEXT, savedBy: 'seed', savedAt: '2026-11-05T18:00:00', note: 'Rules 8 and 12', revertedFrom: null }],
    saves: [],
    tries: [],
    reverts: [],
    asks: 0,
    refuse410: false,
  }
}
const activeOf = (s) => s.versions.find((v) => v.version === s.active)
function addVersion(s, text, note, savedBy, revertedFrom = null) {
  const version = Math.max(...s.versions.map((v) => v.version)) + 1
  const v = { version, text, savedBy, savedAt: `2026-11-06T10:${String(version).padStart(2, '0')}:00`, note, revertedFrom }
  s.versions.push(v)
  s.active = version
  return v
}
const answerFor = (text) =>
  text.includes('one column per compared thing')
    ? '| Metric | Riyadh | Jeddah |\n|---|---:|---:|\n| Orders | 120 | 98 |'
    : '| Metric | Value |\n|---|---|\n| Riyadh orders | 120 |\n| Jeddah orders | 98 |'

const browser = await chromium.launch()

async function open(dir, { curate = true, state = stubState() } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    const s = state
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'a.curator', currentStoreCode: 'P001' }))
    if (p === 'Copilot/Access') return route.fulfill(envelope({ canAsk: true, canUseMcp: false, canCurate: curate }))
    if (p.startsWith('Copilot/Prompt') && s.refuse410) return route.fulfill(refusal('COPILOT-410', 403, 'Not a copilot curator.'))
    if (p === 'Copilot/Prompt' && req.method() === 'GET') return route.fulfill(envelope({ core: CORE, active: activeOf(s) }))
    if (p === 'Copilot/Prompt/History') return route.fulfill(envelope([...s.versions].sort((a, b) => b.version - a.version)))
    if (p === 'Copilot/Prompt' && req.method() === 'POST') {
      const b = req.postDataJSON()
      s.saves.push(b)
      if (b.baseVersion !== s.active) return route.fulfill(refusal('COPILOT-411', 409, 'Someone saved first.'))
      return route.fulfill(envelope(addVersion(s, b.text, b.note, 'a.curator')))
    }
    if (p === 'Copilot/Prompt/Try') {
      const b = req.postDataJSON()
      s.tries.push(b)
      await new Promise((r) => setTimeout(r, 400))
      return route.fulfill(
        envelope({ conversationId: 'try', questionNo: 1, answer: answerFor(b.text), orderRefs: [], trace: [], outcome: 'answered', stoppedEarly: false, servedBy: 'gemini/gemini-3-pro', askedAt: '2026-11-06T10:00:00' }),
      )
    }
    if (p === 'Copilot/Prompt/Revert') {
      const b = req.postDataJSON()
      s.reverts.push(b)
      if (b.baseVersion !== s.active) return route.fulfill(refusal('COPILOT-411', 409, 'Someone saved first.'))
      const from = s.versions.find((v) => v.version === b.version)
      return route.fulfill(envelope(addVersion(s, from.text, null, 'a.curator', from.version)))
    }
    if (p === 'Copilot/Ask') {
      s.asks++
      return route.fulfill(
        envelope({ conversationId: 'c-1', questionNo: 1, answer: 'Fine.', orderRefs: [], trace: [], outcome: 'answered', stoppedEarly: false, servedBy: 'gemini/gemini-3-pro', promptVersion: s.active, askedAt: '2026-11-06T10:00:00' }),
      )
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, state }
}

const leaf = (page) => page.locator('a[href="/copilot/rules"]')
const text = (page) => page.locator('[data-rules-text]')
const save = (page) => page.locator('[data-rules-save]')
const toasts = async (page) => (await page.locator('[data-sonner-toast]').allInnerTexts()).map(plain)

async function ready(page) {
  await page.goto(`${BASE}/copilot/rules`)
  await page.locator('[data-rules-screen]').waitFor({ timeout: 20000 })
}

async function drive(dir) {
  const L = dir

  // ── a viewer without the grant ──
  {
    const { context, page, errors } = await open(dir, { curate: false })
    await page.goto(`${BASE}/`)
    await page.locator('#layout-topbar').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1200)
    check(`${L}: no curator grant — no Copilot rules menu item`, (await leaf(page).count()) === 0)
    await page.goto(`${BASE}/copilot/rules`)
    await page.locator('[role="alert"]', { hasText: 'No access to the copilot rules' }).waitFor({ timeout: 20000 })
    check(`${L}: no grant — the URL shows the no-access state, no editor`, (await page.locator('[data-rules-screen]').count()) === 0)
    check(`${L}: no page errors (no grant)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── COPILOT-410 from a door ──
  {
    const st = stubState()
    st.refuse410 = true
    const { context, page } = await open(dir, { state: st })
    await page.goto(`${BASE}/copilot/rules`)
    await page.locator('[data-rules-refused]').waitFor({ timeout: 20000 })
    check(`${L}: COPILOT-410 from Copilot/Prompt shows the same no-access state`, plain(await page.locator('[data-rules-refused]').innerText()).includes('No access to the copilot rules'))
    await context.close()
  }

  // ── a curator ──
  const { context, page, errors, state } = await open(dir)
  await ready(page)
  // A rail group opens on its active leaf, so the leaf is looked for on its own page.
  await leaf(page).first().waitFor({ timeout: 20000 }).catch(() => {})
  check(`${L}: a curator has the Copilot rules item`, (await leaf(page).count()) > 0 && plain(await leaf(page).first().innerText()).includes('Copilot rules'))

  const core = page.locator('[data-rules-core]')
  check(`${L}: the core is collapsed`, (await core.getAttribute('open')) === null)
  await core.locator('summary').click()
  check(`${L}: the core shows as text, read-only`, (await page.locator('[data-rules-core-text]').innerText()) === CORE && (await core.locator('textarea, input').count()) === 0)
  check(`${L}: version 1 and its saver`, plain(await page.locator('[data-rules-version]').innerText()).includes('Version 1 saved by seed'), plain(await page.locator('[data-rules-version]').innerText()))
  check(`${L}: the editor holds version 1`, (await text(page).inputValue()) === V1_TEXT)
  check(`${L}: the count is n / 4000 (the app's formatNumber)`, plain(await page.locator('[data-rules-count]').innerText()) === `Characters ${V1_TEXT.length} / 4000`, plain(await page.locator('[data-rules-count]').innerText()))
  check(`${L}: Save is disabled while nothing changed`, await save(page).isDisabled())
  check(`${L}: the try box says a try counts toward the limit`, plain(await page.locator('[data-rules-try-limit]').innerText()).includes('counts toward your copilot limit'))

  // Bidi: the textarea keeps its own direction, the count and version are Ltr isolates.
  check(`${L}: the house-rules textarea is dir="auto"`, (await text(page).getAttribute('dir')) === 'auto')
  check(`${L}: the count is one LTR isolate`, (await page.locator('[data-rules-count] bdi[dir="ltr"]').count()) === 1)
  check(`${L}: the version number is an LTR isolate`, (await page.locator('[data-rules-version] bdi[dir="ltr"]').count()) >= 2)

  // Blank and too long keep Save shut.
  await text(page).fill('   ')
  check(`${L}: blank — Save disabled, the field says why`, (await save(page).isDisabled()) && plain(await page.locator('[data-rules-editor]').innerText()).includes('cannot be blank'))
  await text(page).fill('a'.repeat(4001))
  check(`${L}: 4,001 characters — Save disabled, the limit named`, (await save(page).isDisabled()) && plain(await page.locator('[data-rules-editor]').innerText()).includes('at most 4000 characters'))

  // Try without rule 12: a Metric | Value list.
  const WITHOUT_12 = RULE_8
  await text(page).fill(WITHOUT_12)
  await page.locator('[data-rules-try-question]').fill(COMPARE_Q)
  await page.locator('[data-rules-try-run]').click()
  await page.locator('[data-rules-try-answer]').waitFor({ timeout: 10000 })
  const head1 = (await page.locator('[data-rules-try-answer] th').allInnerTexts()).map(plain)
  check(`${L}: Try sends the unsaved draft`, state.tries.length === 1 && JSON.stringify(state.tries[0]) === JSON.stringify({ question: COMPARE_Q, text: WITHOUT_12 }), JSON.stringify(state.tries))
  check(`${L}: without rule 12 the answer is a "Metric | Value" list`, JSON.stringify(head1) === JSON.stringify(['Metric', 'Value']), head1.join('|'))
  check(`${L}: the try is labelled a draft`, plain(await page.locator('[data-rules-try-answer]').innerText()).includes('Draft. Not saved, not in your conversations'))
  check(`${L}: the try draws the answer's own provenance`, (await page.locator('[data-rules-try-answer] [data-copilot-served-by]').count()) === 1)

  // Put it back and try again: one column per compared thing.
  await text(page).fill(`${V1_TEXT}\n13. Name the period.`)
  await page.locator('[data-rules-try-run]').click()
  await page.waitForFunction(() => document.querySelectorAll('[data-rules-try-answer] th').length === 3, null, { timeout: 10000 })
  const head2 = (await page.locator('[data-rules-try-answer] th').allInnerTexts()).map(plain)
  check(`${L}: with rule 12 back, one column per compared thing (a second try)`, state.tries.length === 2 && JSON.stringify(head2) === JSON.stringify(['Metric', 'Riyadh', 'Jeddah']), head2.join('|'))
  check(`${L}: trying saved nothing`, state.saves.length === 0 && (await page.locator('[data-rules-version]').getAttribute('data-rules-version')) === '1')

  // Leaving with an edited textarea asks first.
  await page.locator('nav a[href="/"]').first().click()
  await page.locator('[data-leave-dialog]').waitFor({ timeout: 5000 }).catch(() => {})
  check(`${L}: leaving with unsaved edits asks first`, (await page.locator('[data-leave-dialog]').count()) === 1)
  await page.locator('[data-leave-stay]').click()
  await page.locator('[data-leave-dialog]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check(
    `${L}: Stay closes the question and keeps the edits`,
    (await page.locator('[data-leave-dialog]').count()) === 0 && page.url().endsWith('/copilot/rules') && (await text(page).inputValue()).endsWith('13. Name the period.'),
  )

  // Save: version 2.
  await page.locator('[data-rules-note]').fill('Name the period')
  await page.waitForTimeout(300)
  { const nv = await page.locator('[data-rules-note]').evaluate((el) => el.tagName + ' ' + JSON.stringify(el.value) + ' ' + el.outerHTML.slice(0, 300)); check(`${L}: the note takes its text`, nv.includes('"Name the period"'), nv) }
  await save(page).click()
  await page.waitForFunction(() => document.querySelector('[data-rules-version]')?.getAttribute('data-rules-version') === '2', null, { timeout: 10000 })
  check(`${L}: Save posts the text, the note and baseVersion 1`, JSON.stringify(state.saves[0]) === JSON.stringify({ text: `${V1_TEXT}\n13. Name the period.`, note: 'Name the period', baseVersion: 1 }), JSON.stringify(state.saves))
  check(`${L}: the toast says version 2`, (await toasts(page)).some((x) => x.includes('Saved as version 2. The next question uses it.')), (await toasts(page)).join(' | '))
  await page.locator('[data-rules-history-row="2"][data-active]').waitFor({ timeout: 10000 })
  check(`${L}: history marks v2 active, newest first`, (await page.locator('[data-rules-history-row]').first().getAttribute('data-rules-history-row')) === '2')
  check(`${L}: saved — Save is shut again, the note cleared`, (await save(page).isDisabled()) && (await page.locator('[data-rules-note]').inputValue()) === '')

  // The copilot panel's next answer reads "rules v2".
  await page.locator('#layout-topbar [data-copilot-button]').click()
  const sheet = page.locator('dialog[data-copilot-sheet]')
  await sheet.locator('[data-copilot-question]').fill('How many orders today?')
  await sheet.locator('[data-copilot-send]').click()
  await sheet.locator('[data-copilot-rules]').waitFor({ timeout: 10000 })
  const served = plain(await sheet.locator('[data-copilot-served-by]').innerText())
  check(`${L}: the panel's answer reads "Answered by gemini/… · rules v2"`, served === 'Answered by gemini/gemini-3-pro · rules v2', served)
  check(`${L}: "v2" is an LTR isolate`, (await sheet.locator('[data-copilot-rules] bdi[dir="ltr"]').innerText()) === 'v2')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Restore version 1: version 3, reverted from 1.
  await page.locator('[data-rules-history-row="1"] button').click()
  await page.locator('[data-rules-compare="1"]').waitFor()
  check(
    `${L}: v1 opens read-only beside the current text`,
    (await page.locator('[data-rules-compare-old] [dir="auto"]').innerText()) === V1_TEXT &&
      (await page.locator('[data-rules-compare-current] [dir="auto"]').innerText()) === `${V1_TEXT}\n13. Name the period.`,
  )
  await page.locator('[data-rules-restore]').click()
  await page.locator('[data-rules-restore-dialog]').waitFor()
  check(`${L}: the confirm names the version`, plain(await page.locator('dialog', { has: page.locator('[data-rules-restore-dialog]') }).innerText()).includes('Restore version 1?'))
  await page.locator('[data-rules-restore-confirm]').click()
  await page.locator('[data-rules-history-row="3"][data-active]').waitFor({ timeout: 10000 })
  check(`${L}: Restore posts { version: 1, baseVersion: 2 }`, JSON.stringify(state.reverts[0]) === JSON.stringify({ version: 1, baseVersion: 2 }), JSON.stringify(state.reverts))
  check(`${L}: version 3, reverted from 1`, plain(await page.locator('[data-rules-history-row="3"]').innerText()).includes('reverted from v1'))
  check(`${L}: the editor holds v1's text as v3`, (await text(page).inputValue()) === V1_TEXT && (await page.locator('[data-rules-version]').getAttribute('data-rules-version')) === '3')
  check(`${L}: the active row has no Restore`, await (async () => {
    await page.locator('[data-rules-history-row="3"] button').click()
    return (await page.locator('[data-rules-restore]').count()) === 0
  })())

  // Someone saves first (a second tab): COPILOT-411's dialog, theirs and mine.
  addVersion(state, 'Their rules', 'other tab', 'b.curator')
  await text(page).fill('My rules')
  await save(page).click()
  await page.locator('[data-rules-conflict]').waitFor({ timeout: 10000 })
  check(
    `${L}: 411 — theirs and mine side by side`,
    (await page.locator('[data-rules-conflict-theirs] [dir="auto"]').innerText()) === 'Their rules' &&
      (await page.locator('[data-rules-conflict-mine] [dir="auto"]').innerText()) === 'My rules' &&
      plain(await page.locator('[data-rules-conflict-theirs]').innerText()).includes('v4'),
  )
  await page.locator('[data-rules-save-mine]').click()
  await page.waitForFunction(() => document.querySelector('[data-rules-version]')?.getAttribute('data-rules-version') === '5', null, { timeout: 10000 })
  check(`${L}: Save mine on top re-posts on version 4`, JSON.stringify(state.saves.at(-1)) === JSON.stringify({ text: 'My rules', note: null, baseVersion: 4 }), JSON.stringify(state.saves.at(-1)))

  // …and Keep theirs reloads theirs.
  addVersion(state, 'Theirs again', null, 'b.curator')
  await text(page).fill('Mine again')
  await save(page).click()
  await page.locator('[data-rules-conflict]').waitFor({ timeout: 10000 })
  await page.locator('[data-rules-keep-theirs]').click()
  await page.waitForTimeout(300)
  check(`${L}: Keep theirs loads version 6 into the editor`, (await text(page).inputValue()) === 'Theirs again' && (await page.locator('[data-rules-version]').getAttribute('data-rules-version')) === '6')
  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
