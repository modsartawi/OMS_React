// Insurance pattern reveal drive (oms 923; BackOffice spec 4050, door 4053 `POST …/Cases/{caseId}/Reveal`) — drives the
// REAL app in Chromium against MOCKED envelopes: the case doors of `./insurance-patterns-stubs.mjs` (922's) with this
// drive's own reveal door chained after them. BackOffice 4053 is not built, so every shape is the guessed contract.
//
// Proves, on the running app: "Show patient" shows with the investigator grant only; the send is held under 10
// characters (counted trimmed), says why and sends nothing; a reveal posts the trimmed reason and shows the patient key
// and member id, each isolated LTR, in the dialog only; once closed (Close or Escape) the patient is nowhere — not the
// page, the query or mutation cache, local or session storage, the address, history state, cookies, the title or the
// console — and the dialog opens empty; a refusal (the log write failed, even carrying an identity), an answer with
// nobody in it, and a bare 403 (the grant withdrawn under an open dialog) each show their words and no patient; Arabic,
// RTL (screenshot to SHOT_DIR).
//
//   1. run the app:  npx vite --port 5232 --strictPort
//   2. DRIVE_PORT=5232 SHOT_DIR=<dir> node tools/insurance-patterns-reveal-drive.mjs
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { permissions } from './permissions-stub.mjs'
import { businessRefusal, CLEARED_CASE, envelope, KEYS, patternsDoors, patternsState, TRAVEL_CASE } from './insurance-patterns-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOT_DIR = process.env.SHOT_DIR || '.'
const CASE = `${BASE}/insurance/patterns/${TRAVEL_CASE.caseId}`

/** The patient the stub reveals: synthetic, from the reserved test ranges, never a real id. */
const PATIENT = Object.freeze({ patientKey: 'NI:1000000019', memberId: 'TST-M-4471' })
/** A field nobody agreed to, sent beside them: it must never show. */
const POLICY = 'TST-POL-0001'
const SECRETS = [PATIENT.patientKey, PATIENT.memberId, POLICY]
const REASON = 'The payer asked for this case by letter 2026/118.'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const leaks = (text) => SECRETS.filter((s) => (text ?? '').includes(s))
/** Whether a wait ended in time: a review check must fail, not stop the drive, when what it waits for never comes. */
const settles = (promise) => promise.then(() => true, () => false)

/**
 * Requests held back on purpose (spec 4050 review: a slow server): the next request `match` accepts waits until
 * `release()`; `arrived` resolves once it is in.
 */
const held = []
const hold = (match) => {
  const h = { match, used: false }
  h.released = new Promise((r) => (h.release = r))
  h.arrived = new Promise((r) => (h.arrive = r))
  held.push(h)
  return h
}

/**
 * The reveal door (BackOffice 4053, guessed): `POST Insurance/Patterns/Cases/{caseId}/Reveal` `{ reason }` →
 * `{ patientKey, memberId }`, plus a policy number nobody agreed to. `state.revealAnswer` (a fulfil argument) answers
 * instead while set; `state.reveals` records what the app sent. Null for a path it does not own.
 */
function revealDoor(state) {
  return (request) => {
    const path = decodeURIComponent(new URL(request.url()).pathname.split('/api/')[1] ?? '')
    const m = path.match(/^Insurance\/Patterns\/Cases\/([^/]+)\/Reveal$/)
    if (!m || request.method() !== 'POST') return null
    const body = JSON.parse(request.postData() || '{}')
    state.reveals.push({ caseId: m[1], body, csrf: request.headers()['x-web-client'] ?? null })
    if (state.revealAnswer) return state.revealAnswer
    if (String(body.reason ?? '').trim().length < 10) return businessRefusal('REASON_TOO_SHORT', 'A reveal needs a reason of at least 10 characters.')
    return envelope({ ...PATIENT, policyNumber: POLICY })
  }
}

async function run() {
  const browser = await chromium.launch()
  const errors = []
  const consoleLines = []

  /** A page signed in with `access.keys` (read again at every permissions read), the doors stubbed from `state`. */
  const open = async (state, access, { dir = 'ltr' } = {}) => {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultNavigationTimeout(90000)
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => {
      consoleLines.push(m.text())
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
    })
    await page.addInitScript((d) => {
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
    }, dir)
    const doors = patternsDoors(state)
    const reveal = revealDoor(state)
    await page.route(`${BASE}/api/**`, async (route) => {
      const req = route.request()
      const path = decodeURIComponent(new URL(req.url()).pathname.split('/api/')[1])
      if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
      if (path === 'Auth/Permissions') {
        access.reads++
        return route.fulfill(permissions(access.keys))
      }
      const h = held.find((x) => !x.used && x.match(req))
      if (h) {
        h.used = true
        h.arrive()
        await h.released
      }
      return route.fulfill(doors(req) ?? reveal(req) ?? envelope({}))
    })
    return page
  }
  const newState = () => ({ ...patternsState(), reveals: [], revealAnswer: null })
  const investigator = () => ({ keys: [KEYS.analyst, KEYS.investigator], reads: 0 })

  const dialog = '[data-testid=pattern-reveal]'
  const openDialog = async (page) => {
    await page.click('[data-testid=pattern-reveal-open]')
    await page.waitForSelector(dialog)
  }
  const step = (page) => page.getAttribute(dialog, 'data-step')
  const sendHeld = (page) => page.getAttribute('[data-testid=pattern-reveal-send]', 'aria-disabled')
  const count = async (page) => strip(await page.textContent('[data-testid=pattern-reveal-count]'))
  const revealWith = async (page, reason) => {
    await page.fill('[data-testid=pattern-reveal-reason]', reason)
    await page.click('[data-testid=pattern-reveal-send]')
    await page.waitForFunction(() => ['shown', 'failed'].includes(document.querySelector('[data-testid=pattern-reveal]')?.getAttribute('data-step')))
  }

  /**
   * Everywhere a patient could linger, as text. The app's QueryClient is module-local (`app/main.tsx`), so it is found
   * on the React tree: the provider's `client` prop, under the root container.
   */
  const lingering = (page) =>
    page.evaluate(() => {
      const safe = (v) => {
        const seen = new WeakSet()
        try {
          return JSON.stringify(v, (_k, x) => (typeof x === 'object' && x !== null ? (seen.has(x) ? '[seen]' : (seen.add(x), x)) : x))
        } catch (e) {
          return `[unreadable: ${e}]`
        }
      }
      const dump = (s) => safe(Object.fromEntries(Array.from({ length: s.length }, (_, i) => [s.key(i), s.getItem(s.key(i))])))
      const root = document.getElementById('root')
      const containerKey = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))
      let client = null
      const stack = containerKey ? [root[containerKey]] : []
      while (stack.length && !client) {
        const fiber = stack.pop()
        const c = fiber.memoizedProps?.client
        if (c && typeof c.getQueryCache === 'function' && typeof c.getMutationCache === 'function') client = c
        if (fiber.sibling) stack.push(fiber.sibling)
        if (fiber.child) stack.push(fiber.child)
      }
      const queries = client ? client.getQueryCache().getAll() : []
      const mutations = client ? client.getMutationCache().getAll() : []
      return {
        found: client !== null,
        queryKeys: queries.map((q) => safe(q.queryKey)),
        mutationKeys: mutations.map((m) => safe(m.options.mutationKey ?? null)),
        sinks: {
          page: document.documentElement.outerHTML,
          queries: safe(queries.map((q) => q.state.data ?? null)),
          mutations: safe(mutations.map((m) => [m.state.variables ?? null, m.state.data ?? null])),
          localStorage: dump(localStorage),
          sessionStorage: dump(sessionStorage),
          address: location.href,
          historyState: safe(history.state ?? null),
          cookies: document.cookie,
          title: document.title,
        },
      }
    })
  const leaked = (where) => Object.entries(where.sinks).flatMap(([sink, text]) => leaks(text).map((s) => `${sink}: ${s}`))

  // ── 1. The grant: the button shows for an investigator only ─────────────────────────────────────────────────────
  for (const [label, keys] of [
    ['an analyst', [KEYS.analyst]],
    ['an analyst who may also manage and block', [KEYS.analyst, KEYS.manager, KEYS.block]],
  ]) {
    const state = newState()
    const page = await open(state, { keys, reads: 0 })
    await page.goto(CASE)
    await page.waitForSelector('[data-testid=pattern-case]')
    check(`without the investigator grant (${label}): no "Show patient", the case's actions hold nothing`, (await page.locator('[data-testid=pattern-reveal-open]').count()) === 0 && (await page.locator('[data-testid=pattern-case-actions] > *').count()) === 0)
    await page.close()
  }
  {
    const state = newState()
    const page = await open(state, { keys: [KEYS.investigator], reads: 0 })
    await page.goto(CASE)
    await page.waitForSelector('text=No access to pattern cases')
    check('the investigator grant alone does not open the case: "no access", no button, no case read', (await page.locator('[data-testid=pattern-reveal-open]').count()) === 0 && state.calls.detail.length === 0)
    await page.close()
  }

  let state = newState()
  let access = investigator()
  let page = await open(state, access)
  await page.goto(CASE)
  await page.waitForSelector('[data-testid=pattern-reveal-open]')
  check('with it: "Show patient" stands in the case’s actions', strip(await page.textContent('[data-testid=pattern-case-actions]')) === 'Show patient')
  check('nobody is on the page before a reveal', leaks(await page.content()).length === 0)

  // ── 2. The reason: held under 10 characters, counted trimmed; nothing sent ──────────────────────────────────────
  await openDialog(page)
  check('the dialog names the case', strip(await page.textContent('dialog[open] #modal-title')) === 'Show the patient of case PC-000123')
  check('it says the reveal is logged before the reason is asked', strip(await page.textContent('[data-testid=pattern-reveal-logged]')) === 'Each reveal is logged: your name, the time, this case and your reason go to the reveal log, which the insurance manager reads.')
  check('the reason box has the focus', (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'pattern-reveal-reason')
  check('empty: the send is held, its reason in its title, the count 0 / 250', (await sendHeld(page)) === 'true' && strip(await page.getAttribute('[data-testid=pattern-reveal-send]', 'title')) === 'Write at least 10 characters.' && (await count(page)) === '0 / 250')
  await page.fill('[data-testid=pattern-reveal-reason]', 'too short')
  check('9 characters: still held (9 / 250)', (await sendHeld(page)) === 'true' && (await count(page)) === '9 / 250')
  await page.fill('[data-testid=pattern-reveal-reason]', '   123456789   ')
  check('9 characters with spaces around them: still held, counted trimmed (9 / 250)', (await sendHeld(page)) === 'true' && (await count(page)) === '9 / 250')
  await page.click('[data-testid=pattern-reveal-send]', { force: true })
  // The figure in the sentence is isolated (FSI…PDI, the bidi rule), so the words are compared with the isolates stripped.
  await page.waitForFunction(() => (document.querySelector('[data-testid=pattern-reveal]')?.textContent ?? '').replace(/[⁦-⁩]/g, '').includes('Write at least 10 characters.'))
  check('sending anyway says why under the field, and asks the server nothing', state.reveals.length === 0)
  await page.fill('[data-testid=pattern-reveal-reason]', '0123456789')
  check('10 characters: the send is free, no reason in its title', (await sendHeld(page)) === 'false' && !(await page.getAttribute('[data-testid=pattern-reveal-send]', 'title')) && (await count(page)) === '10 / 250')
  await page.fill('[data-testid=pattern-reveal-reason]', 'x'.repeat(251))
  check('past 250 characters: held again, and says so', (await sendHeld(page)) === 'true' && strip(await page.getAttribute('[data-testid=pattern-reveal-send]', 'title')) === 'The reason is longer than 250 characters.')

  // ── 3. A reveal: the trimmed reason posted, the patient shown in the dialog only ───────────────────────────────
  await revealWith(page, `   ${REASON}   `)
  check('the reveal posts the trimmed reason — and nothing else, no actor', same(state.reveals[0]?.body, { reason: REASON }) && state.reveals[0]?.caseId === TRAVEL_CASE.caseId, JSON.stringify(state.reveals[0]))
  check('…once, with the X-Web-Client header', state.reveals.length === 1 && !!state.reveals[0].csrf)
  check('the dialog shows the patient', (await step(page)) === 'shown')
  check('…the patient key', strip(await page.textContent('[data-testid=pattern-reveal-patient-key]')) === PATIENT.patientKey)
  check('…and the member id', strip(await page.textContent('[data-testid=pattern-reveal-member-id]')) === PATIENT.memberId)
  const isolated = await page.locator('[data-testid=pattern-reveal-patient] bdi[dir=ltr]').allTextContents()
  check('…each a machine value isolated whole, left to right', same(isolated, [PATIENT.patientKey, PATIENT.memberId]), JSON.stringify(isolated))
  check('the policy number the server added is not shown', !(await page.content()).includes(POLICY))
  check('the reason logged with it is shown back', strip(await page.textContent('[data-testid=pattern-reveal-sent-reason]')) === REASON)
  check('it says the patient shows in this window only', strip(await page.textContent(dialog)).includes('The patient shows in this window only. Closing it clears them; showing them again is another logged reveal.'))
  check('no toast holds the patient', (await page.locator('[data-sonner-toast]').count()) === 0 || leaks(await page.locator('[data-sonner-toast]').allTextContents().then((t) => t.join(' '))).length === 0)
  check('Close has the focus', (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'pattern-reveal-close')

  // ── 4. Closed: the patient is nowhere, and the dialog opens empty ───────────────────────────────────────────────
  await page.click('[data-testid=pattern-reveal-close]')
  await page.waitForSelector(dialog, { state: 'detached' })
  let where = await lingering(page)
  check('the app’s query client is found and read (the case and the permissions are in it)', where.found && where.queryKeys.includes(JSON.stringify(['insurance-patterns', 'case', TRAVEL_CASE.caseId])) && where.queryKeys.includes(JSON.stringify(['auth', 'permissions'])), JSON.stringify(where.queryKeys))
  check('no query and no mutation was made for the reveal', !where.queryKeys.some((k) => /reveal/i.test(k)) && !where.mutationKeys.some((k) => /reveal/i.test(k)), JSON.stringify([where.queryKeys, where.mutationKeys]))
  check('after closing, the patient is nowhere: page, query and mutation caches, storage, address, history, cookies, title', leaked(where).length === 0, leaked(where).join(' | '))
  check('…nor in the console', consoleLines.every((l) => leaks(l).length === 0), consoleLines.filter((l) => leaks(l).length).join(' | '))
  await openDialog(page)
  check('opened again, the dialog is empty: no patient, no reason, the send held', (await step(page)) === 'asking' && (await page.inputValue('[data-testid=pattern-reveal-reason]')) === '' && (await page.locator('[data-testid=pattern-reveal-patient]').count()) === 0 && (await sendHeld(page)) === 'true')
  await revealWith(page, 'Second look for the payer, letter 2026/119.')
  check('a second look is a second logged reveal', state.reveals.length === 2 && (await step(page)) === 'shown')
  await page.keyboard.press('Escape')
  await page.waitForSelector(dialog, { state: 'detached' })
  where = await lingering(page)
  check('Escape closes it too, and the patient goes with it', leaked(where).length === 0, leaked(where).join(' | '))

  // ── 5. Refusals: their words, and nobody ────────────────────────────────────────────────────────────────────────
  const NOT_LOGGED = 'The reveal could not be logged, so no patient is shown.'
  state.revealAnswer = envelope({ ...PATIENT }, { status: 500, success: false, message: NOT_LOGGED, errors: [{ errorCode: 'REVEAL_NOT_LOGGED', errorMessage: NOT_LOGGED }] })
  await openDialog(page)
  await revealWith(page, REASON)
  const banner = strip(await page.textContent(`${dialog} [role=alert]`))
  check('the log write failed: "The patient was not shown" and the server’s sentence', (await step(page)) === 'failed' && banner.includes('The patient was not shown') && banner.includes(NOT_LOGGED), banner)
  check('…and nobody, though the refusal carried one', (await page.locator('[data-testid=pattern-reveal-patient]').count()) === 0 && leaks(await page.content()).length === 0)
  check('…the reason kept, the send free to try again', (await page.inputValue('[data-testid=pattern-reveal-reason]')) === REASON && (await sendHeld(page)) === 'false')
  state.revealAnswer = null
  await page.click('[data-testid=pattern-reveal-send]')
  await page.waitForFunction(() => document.querySelector('[data-testid=pattern-reveal]')?.getAttribute('data-step') === 'shown')
  check('tried again once the door is well: the patient, and the refusal gone', strip(await page.textContent('[data-testid=pattern-reveal-patient-key]')) === PATIENT.patientKey && (await page.locator(`${dialog} [role=alert]`).count()) === 0)
  await page.click('[data-testid=pattern-reveal-close]')
  await page.waitForSelector(dialog, { state: 'detached' })

  state.revealAnswer = envelope({})
  await openDialog(page)
  await revealWith(page, REASON)
  check('an answer with nobody in it: says so, and is never called logged', (await step(page)) === 'failed' && strip(await page.textContent(`${dialog} [role=alert]`)).includes('The server answered without a patient key, so nobody is shown.') && (await page.locator('[data-testid=pattern-reveal-patient]').count()) === 0)
  await page.click('[data-testid=pattern-reveal-cancel]')
  await page.waitForSelector(dialog, { state: 'detached' })

  // The grant is withdrawn on the server: its door answers a bare 403 (the grant filter, no envelope), and the next read
  // of the permissions says so.
  access.keys = [KEYS.analyst]
  state.revealAnswer = { status: 403, contentType: 'text/plain', body: '' }
  const reads = access.reads
  await openDialog(page)
  await revealWith(page, REASON)
  check('a bare 403: the dialog names the grant, and shows nobody', strip(await page.textContent(`${dialog} [role=alert]`)).includes('The server refused: showing a patient needs the insurance pattern investigator grant.') && (await page.locator('[data-testid=pattern-reveal-patient]').count()) === 0)
  await page.waitForFunction(() => document.querySelectorAll('[data-testid=pattern-reveal-open]').length === 0)
  check('…the app read its permissions again, and the button is gone while the dialog stays to say why', access.reads > reads && (await page.locator(dialog).count()) === 1)
  await page.click('[data-testid=pattern-reveal-cancel]')
  await page.waitForSelector(dialog, { state: 'detached' })
  check('…closed, nothing is left of it', (await page.locator('[data-testid=pattern-reveal-open]').count()) === 0 && (await page.locator('[data-testid=pattern-case-actions] > *').count()) === 0)
  check('every reveal went to the one case', state.reveals.every((r) => r.caseId === TRAVEL_CASE.caseId) && state.reveals.length === 6, String(state.reveals.length))
  await page.close()

  // ── 6. Arabic, right to left ────────────────────────────────────────────────────────────────────────────────────
  // `oms.locale=ar` flips the direction at boot; the drive switches the app's own i18next instance to Arabic (922's way).
  const toArabic = (p) => p.evaluate(async () => (await import('/src/core/i18n.ts')).default.changeLanguage('ar'))
  state = newState()
  access = investigator()
  page = await open(state, access, { dir: 'rtl' })
  await page.goto(CASE)
  await page.waitForSelector('[data-testid=pattern-reveal-open]')
  await toArabic(page)
  await page.waitForSelector('[data-testid=pattern-reveal-open] >> text=إظهار المريض')
  check('RTL: the document is dir=rtl and the button reads "إظهار المريض"', (await page.getAttribute('html', 'dir')) === 'rtl')
  await openDialog(page)
  check('RTL: the dialog names the case in Arabic, its number isolated', strip(await page.textContent('dialog[open] #modal-title')) === 'إظهار مريض الحالة PC-000123')
  check('RTL: it says the reveal is logged, in Arabic', strip(await page.textContent('[data-testid=pattern-reveal-logged]')) === 'يسجل كل كشف: يحفظ اسمك والوقت وهذه الحالة وسببك في سجل الكشف، ويطلع عليه مدير التأمين.')
  check('RTL: the send is held with its reason in Arabic', (await sendHeld(page)) === 'true' && strip(await page.getAttribute('[data-testid=pattern-reveal-send]', 'title')) === 'اكتب 10 أحرف على الأقل.')
  const arabicReason = 'طلبت الجهة الدافعة مراجعة هذه الحالة'
  await revealWith(page, arabicReason)
  check('RTL: an Arabic reason is sent as typed', same(state.reveals[0]?.body, { reason: arabicReason }), JSON.stringify(state.reveals[0]?.body))
  const labels = (await page.locator('[data-testid=pattern-reveal-patient] dt').allTextContents()).map(strip)
  check('RTL: the patient’s labels read in Arabic', same(labels, ['مفتاح المريض', 'رقم العضوية']), JSON.stringify(labels))
  check('RTL: the patient key and member id still read left to right, whole', same(await page.locator('[data-testid=pattern-reveal-patient] bdi[dir=ltr]').allTextContents(), [PATIENT.patientKey, PATIENT.memberId]))
  const dt = await page.locator('[data-testid=pattern-reveal-patient] dt').first().boundingBox()
  const dd = await page.locator('[data-testid=pattern-reveal-patient-key]').boundingBox()
  check('RTL: each label stands at the reading start (right) of its value', dt.x > dd.x, JSON.stringify({ dt, dd }))
  check('RTL: the reason logged is shown back as typed', strip(await page.textContent('[data-testid=pattern-reveal-sent-reason]')) === arabicReason)
  await page.screenshot({ path: join(SHOT_DIR, '923-insurance-pattern-reveal-rtl-ar.png') })
  await page.click('[data-testid=pattern-reveal-close]')
  await page.waitForSelector(dialog, { state: 'detached' })
  where = await lingering(page)
  check('RTL: closed, the patient is nowhere', leaked(where).length === 0, leaked(where).join(' | '))
  await page.close()

  // ── 7. Review 1: a reveal dialog never follows the reader to another case ────────────────────────────────────────
  // PC-000099 is read (and cached), then Back to PC-000123, the dialog opened with a reason, then Forward: the page is
  // reused for the cached case. A dialog still open there would post the reason to the OTHER case's Reveal.
  state = newState()
  access = investigator()
  page = await open(state, access)
  await page.goto(CASE)
  await page.waitForSelector('[data-testid=pattern-reveal-open]')
  await page.click(`[data-testid=pattern-previous] a[href="/insurance/patterns/${CLEARED_CASE.caseId}"]`)
  await page.waitForSelector(`[data-testid=pattern-case][data-case="${CLEARED_CASE.caseId}"]`)
  await page.goBack()
  await page.waitForSelector(`[data-testid=pattern-case][data-case="${TRAVEL_CASE.caseId}"]`)
  await openDialog(page)
  await page.fill('[data-testid=pattern-reveal-reason]', REASON)
  await page.goForward()
  await page.waitForSelector(`[data-testid=pattern-case][data-case="${CLEARED_CASE.caseId}"]`)
  await page.waitForTimeout(300)
  check('another case starts afresh: the reveal dialog opened on the last case closes with it', (await page.locator(dialog).count()) === 0, strip(await page.evaluate(() => document.querySelector('dialog')?.textContent ?? '')).slice(0, 120))
  check('…and no reveal was sent, to either case', state.reveals.length === 0, JSON.stringify(state.reveals))
  await page.close()

  // ── 8. Review 2: a reveal in flight cannot be closed by a double Escape ─────────────────────────────────────────
  // Chromium's close watcher lets a page refuse ONE Escape without a click or key between: the second `cancel` cannot be
  // prevented and the browser closes the dialog itself, while the app still holds it open.
  state = newState()
  access = investigator()
  page = await open(state, access)
  await page.goto(CASE)
  await openDialog(page)
  await page.fill('[data-testid=pattern-reveal-reason]', REASON)
  const slow = hold((r) => r.method() === 'POST' && /\/Reveal$/.test(new URL(r.url()).pathname))
  await page.click('[data-testid=pattern-reveal-send]')
  await slow.arrived
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const revealDialogOpen = () => page.evaluate(() => document.querySelector('[data-testid=pattern-reveal]')?.closest('dialog')?.open === true)
  check('a reveal in flight: a double Escape leaves the dialog open', await revealDialogOpen())
  slow.release()
  await page.waitForFunction(() => document.querySelector('[data-testid=pattern-reveal]')?.getAttribute('data-step') === 'shown')
  const shownOpen = await settles(page.waitForSelector('dialog[open] [data-testid=pattern-reveal-patient-key]', { state: 'visible', timeout: 4000 }))
  check('…the answer lands in the dialog on screen, the patient shown there', shownOpen)
  if (shownOpen) {
    await page.click('[data-testid=pattern-reveal-close]')
    await page.waitForSelector(dialog, { state: 'detached' })
    await openDialog(page)
    check('…and "Show patient" opens the dialog again after', (await step(page)) === 'asking' && (await revealDialogOpen()))
  } else check('…and "Show patient" opens the dialog again after', false, 'the dialog the answer landed in is not on screen')
  await page.close()

  check('no page errors', errors.length === 0, errors.join(' | '))
  check('nobody in the console, the whole run', consoleLines.every((l) => leaks(l).length === 0))
  await browser.close()

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
