// Copilot drive (ticket 735, spec 734 D7/D10/D11/D12) — "ask-and-answer".
//
// Drives the REAL app in Chromium against a STUB of the two doors — `Copilot/Access` and `Copilot/Ask`
// are BackOffice BO-1, unbuilt, so there is no live SIS.Api to point at. The stub answers EXACTLY the
// D10 wire, camelCase:
//   GET  Copilot/Access → { canAsk, canUseMcp }        (granted, refused, absent = a bare 404)
//   POST Copilot/Ask    { question, conversationId? }
//        → { conversationId, questionNo, answer, orderRefs, trace, outcome, stoppedEarly, servedBy, askedAt }
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl") it asserts:
//   1. no grant (`canAsk: false`): no button in the top bar, and `/copilot` shows the denied card;
//   2. an absent probe (a bare 404): no button, `/copilot` closed — the probe fails closed;
//   3. granted: the button opens the panel, which shows the two D12 example questions;
//   4. an example fills the question box (the order placeholder selected, so typing replaces it);
//   5. sending shows the working state for the whole call, posts `{ question }`, then shows the stubbed
//      answer: its paragraphs, bullet list and table, every piece of text in a `<bdi>`;
//   6. `/copilot` renders the same panel, examples and all;
//   7. 1,001 characters cannot be sent (Send disabled, the limit named, Enter asks nothing); 1,000 can;
//   8. no page errors.
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. DRIVE_PORT=5201 node tools/copilot-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`

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

// ── Fixture, the D10 wire exactly ──────────────────────────────────────────────────────────────
const ANSWER_TEXT = [
  'Order 7000123456 was 42 minutes late.',
  'The courier search needed a second round.',
  '',
  '- Round 1 at 3 km: no take',
  '- Round 2 widened to 6 km: taken',
  '',
  '| Stage | Minutes |',
  '|---|---:|',
  '| Pick | 18 |',
  '| Callout | 31 |',
].join('\n')
const ANSWER = {
  conversationId: 'c-0001',
  questionNo: 1,
  answer: ANSWER_TEXT,
  orderRefs: ['7000123456'],
  trace: [
    { tool: 'order_timeline', input: { order: '7000123456' }, rows: 9, ms: 120, ok: true },
    { tool: 'order_delay_facts', input: { order: '7000123456' }, rows: 1, ms: 80, ok: true },
  ],
  outcome: 'answered',
  stoppedEarly: false,
  servedBy: 'anthropic/claude-opus-5-5',
  askedAt: '2026-11-03T10:15:00',
}
const ASK_DELAY_MS = 1200

// ── The harness ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch()

async function open(dir, { access = 'granted', onAsk = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const asks = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Copilot/Access') {
      if (access === 'absent') return route.fulfill({ status: 404, contentType: 'text/plain', body: '' })
      return route.fulfill(envelope({ canAsk: access === 'granted', canUseMcp: false }))
    }
    if (p === 'Copilot/Ask') {
      asks.push({ method: req.method(), body: req.postDataJSON() })
      // Ticket 737's scenario answers each question its own way (a follow-up, a refusal…).
      if (onAsk) return route.fulfill(onAsk(req.postDataJSON(), asks.length))
      await new Promise((r) => setTimeout(r, ASK_DELAY_MS))
      return route.fulfill(envelope(ANSWER))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, asks }
}

const WORDS = {
  denied: 'No access to Ask the OMS',
  unavailable: 'Ask the OMS is unavailable',
  late: 'Why was order X late?',
  hungerstation: 'HungerStation orders in Riyadh this week versus last?',
  working: 'Working on your question',
  tooLong: 'at most',
}

const button = (page) => page.locator('#layout-topbar [data-copilot-button]')

async function drive(dir) {
  const label = dir

  // ── 1: no grant ──
  {
    const { context, page, errors } = await open(dir, { access: 'refused' })
    await page.goto(`${BASE}/`)
    await page.locator('#layout-topbar').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1200)
    check(`${label}: no grant — no "Ask the OMS" button`, (await button(page).count()) === 0)
    await page.goto(`${BASE}/copilot`)
    const denied = page.locator('[role="alert"]', { hasText: WORDS.denied })
    await denied.waitFor({ timeout: 20000 })
    check(`${label}: no grant — /copilot shows the denied card, no panel`, (await page.locator('[data-copilot-panel]').count()) === 0)
    check(`${label}: no page errors (no grant)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2: an absent probe ──
  {
    const { context, page } = await open(dir, { access: 'absent' })
    await page.goto(`${BASE}/`)
    await page.locator('#layout-topbar').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1200)
    check(`${label}: absent probe (404) — no button (fails closed)`, (await button(page).count()) === 0)
    await page.goto(`${BASE}/copilot`)
    await page.locator('[role="alert"]', { hasText: WORDS.unavailable }).waitFor({ timeout: 20000 })
    check(`${label}: absent probe — /copilot stays closed`, (await page.locator('[data-copilot-panel]').count()) === 0)
    await context.close()
  }

  // ── 3–5, 7: granted, in the top bar's sheet ──
  {
    const { context, page, errors, asks } = await open(dir)
    await page.goto(`${BASE}/`)
    await button(page).waitFor({ timeout: 20000 })
    check(`${label}: granted — the button is in the top bar`, (await button(page).count()) === 1)
    await button(page).click()
    const sheet = page.locator('dialog[data-copilot-sheet]')
    await sheet.locator('[data-copilot-panel]').waitFor({ timeout: 20000 })
    const examples = sheet.locator('[data-copilot-example]')
    const exampleTexts = (await examples.allTextContents()).map((s) => s.trim())
    check(
      `${label}: the panel opens with the two example questions`,
      exampleTexts.length === 2 && exampleTexts[0] === WORDS.late && exampleTexts[1] === WORDS.hungerstation,
      exampleTexts.join(' · '),
    )

    const box = sheet.locator('[data-copilot-question]')
    await examples.nth(0).click()
    await page.waitForTimeout(150)
    const selected = await box.evaluate((el) => el.value.slice(el.selectionStart, el.selectionEnd))
    check(`${label}: an example fills the box, the order placeholder selected`, (await box.inputValue()) === WORDS.late && selected === 'X', `${await box.inputValue()} [${selected}]`)
    await page.keyboard.type('7000123456')
    check(`${label}: typing replaces the placeholder`, (await box.inputValue()) === 'Why was order 7000123456 late?')

    await sheet.locator('[data-copilot-send]').click()
    const working = sheet.locator('[data-copilot-working]')
    await working.waitFor({ timeout: 5000 })
    check(`${label}: sending shows the working state`, (await working.textContent()).includes(WORDS.working))
    check(`${label}: Send is disabled while working`, await sheet.locator('[data-copilot-send]').isDisabled())
    const answer = sheet.locator('[data-copilot-answer]')
    await answer.waitFor({ timeout: 10000 })
    check(`${label}: the working state ends with the answer`, (await working.count()) === 0)
    check(
      `${label}: POST Copilot/Ask carries exactly { question }`,
      asks.length === 1 && asks[0].method === 'POST' && JSON.stringify(asks[0].body) === JSON.stringify({ question: 'Why was order 7000123456 late?' }),
      JSON.stringify(asks),
    )
    const paras = (await answer.locator('p').allTextContents()).map((s) => s.trim())
    const items = (await answer.locator('li').allTextContents()).map((s) => s.trim())
    const head = (await answer.locator('th').allTextContents()).map((s) => s.trim())
    const cells = (await answer.locator('td').allTextContents()).map((s) => s.trim())
    check(
      `${label}: the answer's paragraph keeps its two lines`,
      paras.length === 1 && paras[0] === 'Order 7000123456 was 42 minutes late.\nThe courier search needed a second round.',
      JSON.stringify(paras),
    )
    check(`${label}: the answer's bullet list`, JSON.stringify(items) === JSON.stringify(['Round 1 at 3 km: no take', 'Round 2 widened to 6 km: taken']), JSON.stringify(items))
    check(
      `${label}: the answer's simple table`,
      JSON.stringify(head) === JSON.stringify(['Stage', 'Minutes']) && JSON.stringify(cells) === JSON.stringify(['Pick', '18', 'Callout', '31']),
      `${head} | ${cells}`,
    )
    const unisolated = await answer.evaluate((el) =>
      [...el.querySelectorAll('p, li, th, td')].filter((n) => !(n.children.length === 1 && n.firstElementChild.tagName === 'BDI' && !n.firstElementChild.hasAttribute('dir'))).length,
    )
    check(`${label}: every piece of answer text is free text in a <bdi> (dir auto)`, unisolated === 0, `${unisolated} not isolated`)
    check(`${label}: the question asked is shown above the answer`, ((await sheet.locator('[data-copilot-asked] bdi').textContent()) ?? '') === 'Why was order 7000123456 late?')

    // ── 7: the limit ──
    const send = sheet.locator('[data-copilot-send]')
    const count = sheet.locator('[data-copilot-count] bdi')
    await box.fill('a'.repeat(1001))
    await page.waitForTimeout(100)
    check(`${label}: 1,001 characters — Send is disabled`, await send.isDisabled())
    check(`${label}: 1,001 characters — the limit is named`, ((await sheet.locator('[data-copilot-form]').textContent()) ?? '').includes(WORDS.tooLong) && (await box.getAttribute('aria-invalid')) === 'true')
    check(`${label}: the count shows 1001 / 1000, isolated left to right`, (await count.textContent()) === '1001 / 1000' && (await count.getAttribute('dir')) === 'ltr', await count.textContent())
    await box.press('Enter')
    await page.waitForTimeout(400)
    check(`${label}: 1,001 characters — Enter asks nothing`, asks.length === 1, `${asks.length} asks`)
    await box.fill('a'.repeat(1000))
    await page.waitForTimeout(100)
    check(`${label}: 1,000 characters — Send is enabled`, !(await send.isDisabled()))

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    check(`${label}: the sheet closes`, (await page.locator('dialog[data-copilot-sheet]').count()) === 0)
    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: /copilot, the same panel as a page ──
  {
    const { context, page, errors, asks } = await open(dir)
    await page.goto(`${BASE}/copilot`)
    const panel = page.locator('main [data-copilot-panel], [data-copilot-panel]').first()
    await panel.waitFor({ timeout: 20000 })
    const exampleTexts = (await panel.locator('[data-copilot-example]').allTextContents()).map((s) => s.trim())
    check(`${label}: /copilot renders the panel with the two examples`, exampleTexts.length === 2 && exampleTexts[1] === WORDS.hungerstation, exampleTexts.join(' · '))
    check(`${label}: /copilot is a page, not the sheet`, (await page.locator('dialog[data-copilot-sheet]').count()) === 0 && (await page.locator('h1', { hasText: 'Ask the OMS' }).count()) === 1)
    await panel.locator('[data-copilot-example]').nth(1).click()
    await page.keyboard.press('Enter')
    await panel.locator('[data-copilot-answer]').waitFor({ timeout: 10000 })
    check(`${label}: /copilot asks and answers`, asks.length === 1 && asks[0].body.question === WORDS.hungerstation, JSON.stringify(asks.map((a) => a.body)))
    check(`${label}: no page errors (/copilot)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// ── Ticket 737 (spec 734 D5, D7) — "follow-up-and-refusals" ───────────────────────────────────
// In LTR and RTL (Arabic, with the English answer the model sends) it asserts:
//   a. a follow-up posts the first answer's `conversationId`; the thread numbers both by `questionNo`;
//   b. an answer whose outcome is `cannot-answer` is styled as such, not as an error;
//   c. "New conversation" clears the thread and the next question posts no id;
//   d. each D7 code renders its own words, never the raw code — 402 with its reset time in an `Ltr`;
//      an unknown code shows the server's message;
//   e. `COPILOT-406` replaces the box with the offer of a new conversation, which brings it back;
//   f. question 10 does the same;
//   g. under RTL the page is dir="rtl" and the English answer sits in a dir-auto `<bdi>`.
const REFUSALS = [
  { code: 'COPILOT-401', status: 403, words: 'does not hold the copilot grant' },
  { code: 'COPILOT-402', status: 429, words: 'limit of questions for this hour', data: { resetAt: '2026-11-03T11:00:00' }, time: '2026-11-03 11:00' },
  { code: 'COPILOT-403', status: 400, words: 'looks like it holds personal data. Remove it and ask again' },
  { code: 'COPILOT-404', status: 400, words: 'AI service could not be reached' },
  { code: 'COPILOT-405', status: 400, words: 'The question is too long' },
  { code: 'COPILOT-499', status: 400, words: 'A brand-new refusal the panel has no words for.' },
]
const refusalEnvelope = ({ code, status, data = null }) =>
  envelope(data, { status, success: false, message: code === 'COPILOT-499' ? 'A brand-new refusal the panel has no words for.' : `Server text for ${code}.`, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: 'x' }] })

const reply = (conversationId, questionNo, extra = {}) =>
  envelope({ ...ANSWER, conversationId, questionNo, answer: `Answer number ${questionNo}.`, ...extra })

async function followUpAndRefusals(dir) {
  const label = `${dir} follow-up-and-refusals`
  const onAsk = (body) => {
    const q = body.question
    const refusal = REFUSALS.find((r) => q === `refuse ${r.code}`)
    if (refusal) return refusalEnvelope(refusal)
    if (q === 'refuse COPILOT-406') return refusalEnvelope({ code: 'COPILOT-406', status: 409 })
    if (q === 'first') return reply('c-0042', 1)
    if (q === 'follow-up') return reply('c-0042', 2, { outcome: 'cannot-answer', answer: 'The OMS holds nothing on that.' })
    if (q === 'tenth') return reply('c-0077', 10)
    return reply('c-0077', 1)
  }
  const { context, page, errors, asks } = await open(dir, { onAsk })
  await page.goto(`${BASE}/copilot`)
  const panel = page.locator('[data-copilot-panel]').first()
  await panel.waitFor({ timeout: 20000 })
  const box = panel.locator('[data-copilot-question]')
  const turns = panel.locator('[data-copilot-turn]')
  const askIt = async (q) => {
    const before = await turns.count()
    await box.fill(q)
    await box.press('Enter')
    await page.waitForFunction((n) => document.querySelectorAll('[data-copilot-turn]').length > n, before, { timeout: 10000 })
  }

  // g. RTL
  if (dir === 'rtl') check(`${label}: the page is dir="rtl"`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')

  // a. follow-up
  await askIt('first')
  await askIt('follow-up')
  check(`${label}: the first question posts no id`, JSON.stringify(asks[0].body) === JSON.stringify({ question: 'first' }), JSON.stringify(asks[0]?.body))
  check(`${label}: a follow-up posts the answer's conversationId`, JSON.stringify(asks[1].body) === JSON.stringify({ question: 'follow-up', conversationId: 'c-0042' }), JSON.stringify(asks[1]?.body))
  const nos = await panel.locator('[data-copilot-turn-no] bdi').evaluateAll((els) => els.map((e) => `${e.textContent}/${e.getAttribute('dir')}`))
  check(`${label}: the thread numbers its questions by questionNo, each an Ltr`, JSON.stringify(nos) === JSON.stringify(['1/ltr', '2/ltr']), JSON.stringify(nos))
  check(`${label}: the thread keeps both questions`, (await turns.count()) === 2)
  const firstPara = turns.nth(0).locator('[data-copilot-answer] p bdi')
  check(`${label}: the English answer sits in a dir-auto <bdi>`, (await firstPara.textContent()) === 'Answer number 1.' && !(await firstPara.getAttribute('dir')))

  // b. cannot-answer
  const second = turns.nth(1)
  check(
    `${label}: cannot-answer is styled as such, not as an error`,
    (await second.getAttribute('data-copilot-outcome')) === 'cannot-answer' &&
      (await second.locator('[data-copilot-cannot-answer]').count()) === 1 &&
      (await second.locator('[role="alert"]').count()) === 0 &&
      ((await second.textContent()) ?? '').includes('The OMS could not answer this'),
  )

  // c. New conversation
  await panel.locator('[data-copilot-new]').click()
  await page.waitForTimeout(150)
  check(`${label}: "New conversation" clears the thread and brings back the examples`, (await turns.count()) === 0 && (await panel.locator('[data-copilot-example]').count()) === 2)
  await askIt('after new')
  check(`${label}: after "New conversation" the next question posts no id`, JSON.stringify(asks[2].body) === JSON.stringify({ question: 'after new' }), JSON.stringify(asks[2]?.body))

  // d. every refusal reads plainly
  for (const r of REFUSALS) {
    await askIt(`refuse ${r.code}`)
    const shown = turns.last().locator('[data-copilot-refusal]')
    const text = ((await shown.textContent()) ?? '').trim()
    check(`${label}: ${r.code} shows its own words, no raw code`, text.includes(r.words) && !text.includes('COPILOT-') && !text.includes('Server text for'), text)
    if (r.time) {
      const time = shown.locator('bdi[dir="ltr"]')
      check(`${label}: ${r.code} names its reset time in an Ltr`, (await time.count()) === 1 && (await time.textContent()) === r.time, await shown.innerHTML())
    }
    check(`${label}: ${r.code} keeps the box`, (await panel.locator('[data-copilot-form]').count()) === 1)
  }
  check(`${label}: refusals keep the conversation's id`, asks.slice(3).every((a) => a.body.conversationId === 'c-0077'), JSON.stringify(asks.slice(3).map((a) => a.body.conversationId)))

  // e. 406
  await askIt('refuse COPILOT-406')
  const over = ((await turns.last().locator('[data-copilot-refusal]').textContent()) ?? '').trim()
  check(`${label}: COPILOT-406 shows its own words`, over.includes('expired or is full') && !over.includes('COPILOT-'), over)
  check(`${label}: COPILOT-406 replaces the box with the offer`, (await panel.locator('[data-copilot-form]').count()) === 0 && (await panel.locator('[data-copilot-offer]').count()) === 1)
  await panel.locator('[data-copilot-offer-new]').click()
  await box.waitFor({ timeout: 5000 })
  check(`${label}: the offer starts a new conversation`, (await turns.count()) === 0)

  // f. question 10
  await askIt('tenth')
  check(`${label}: the offer of a new conversation replaces the box at question 10`, (await panel.locator('[data-copilot-form]').count()) === 0 && ((await panel.locator('[data-copilot-offer]').textContent()) ?? '').includes('10 questions'))
  check(`${label}: question 10 posts no stale id`, JSON.stringify(asks.at(-1).body) === JSON.stringify({ question: 'tenth' }), JSON.stringify(asks.at(-1).body))

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
  await followUpAndRefusals('ltr')
  await followUpAndRefusals('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
