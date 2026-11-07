// Mark returned back drive (oms-react 838, BackOffice spec 3433 / ADR 0126) — drives the REAL app in Chromium
// against STUBBED envelopes, with every `/api/**` request RECORDED. The sibling of `mark-delivered-drive.mjs`.
//
// The wire, as BackOffice 3434–3436 build it:
//   - `GET  SdDocumentWeb/Access` → `{ …, canMarkDelivered, canMarkReturnedBack }` (grant-free probe);
//   - `GET  SdDocumentWeb/MarkReturnedBackReasons` → `[{ code, description }]`, `CARB`, `DAPB`, `OTHB`, `STOR`;
//   - `POST SdDocumentWeb/MarkReturnedBack` `{ deliveryNo, reasonCode, note? }` → `data: true`; a refusal is the
//     standard 400 envelope with an `SDD-` code (3434, 3435); without either grant a BARE 403.
//
// ⚠️ Stubbed, never live: this drive proves the client half. The ticket's manual walk against a local
// SIS.Api (a granted user marks an `O` delivery returned back and sees `B` and the DRBK log row) is not
// replaced by it.
//
// Asserts:
//   A. granted (this grant only), a category-D delivery at `O`: the Delivery cluster shows Mark Returned Back…
//      and NOT Mark Delivered…; the dialog lists the four reasons by locale label; the reschedule line shows,
//      the express warning and any amount-due line do not; commit is disabled without a reason and on OTHB
//      without a note; the POST carries exactly { deliveryNo, reasonCode, note }; a double click sends ONCE
//      and Escape cannot dismiss mid-flight; success toasts, closes and reloads the delivery, whose new status
//      (`B`) disables the command with its reason.
//   A2. on an express delivery the five-minute close warning shows.
//   A3. both grants draw both commands; only Mark delivered's grant draws only Mark delivered.
//   B. state: status `D` and a pending cancellation each disable it with their reason.
//   C. hidden: no grant, an older API (field absent), a delivery-return (category T).
//   D. a 400 refusal (`SDD-02227`) is worded from the locale with its code, inline; the dialog stays open.
//   E. a 403 from the POST closes the dialog with a toast and removes only this command.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/mark-returned-back-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''
const shot = async (page, name) => SHOTS && page.screenshot({ path: path.join(SHOTS, `${name}.png`) })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})
const refusal400 = (code, message) =>
  envelope(null, { status: 400, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })
const BARE_403 = { status: 403, contentType: 'text/plain', body: '' }

const DOCS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCS[capture.data.documentNo] = capture.data
}
const DELIVERY = '8000000253' // category D, amountDue 242
const RETURN = '9000000003' // category T (a delivery-return)

const REASONS = [
  { code: 'CARB', description: 'Carrier did not update the status' },
  { code: 'DAPB', description: 'Driver app failed to record the return' },
  { code: 'OTHB', description: 'Other (note required)' },
  { code: 'STOR', description: 'Goods received back at the store' },
]

const BASE_ACCESS = { canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true }
const ONLY_THIS = { ...BASE_ACCESS, canMarkDelivered: false, canMarkReturnedBack: true }

/** The delivery with its two gating codes and its express flag set. */
const withStatus = (doc, deliveryStatus, closeStatus, express) => ({
  ...doc,
  isExpressDelivery: express,
  status: { ...doc.status, deliveryStatus, closeStatus },
})

async function open(browser, { access = ONLY_THIS, status = ['O', ''], express = false, answer } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('oms.railExpanded', 'true'))
  const errors = []
  const calls = []
  const posts = []
  let hold = null
  let current = [...status]
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = req.url().split('/api/')[1].split('?')[0]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope(access))
    if (p === 'SdDocumentWeb/MarkReturnedBackReasons') return route.fulfill(envelope(REASONS))
    if (p === 'SdDocumentWeb/MarkReturnedBack' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}')
      posts.push(body)
      if (hold) await hold
      if (answer) return route.fulfill(answer(body))
      current = ['B', '']
      return route.fulfill(envelope(true))
    }
    const doc = /^SdDocumentWeb\/(Document|Delivery)\/([^/]+)$/.exec(p)
    if (doc) {
      const base = DOCS[doc[2]]
      return route.fulfill(envelope(doc[2] === DELIVERY ? withStatus(base, current[0], current[1], express) : base))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }))
    return route.fulfill(envelope([]))
  })

  const holdPosts = () => {
    let release
    hold = new Promise((r) => (release = r))
    return () => {
      hold = null
      release()
    }
  }
  return { context, page, errors, calls, posts, holdPosts }
}

const count = (calls, re) => calls.filter((c) => re.test(c)).length
const command = (page) => page.locator('[data-command="mark-returned-back"]')
const delivered = (page) => page.locator('[data-command="mark-delivered"]')
const cluster = (page) => page.getByRole('region', { name: 'Actions' }).getByText('Delivery', { exact: true })
const dialog = (page) => page.locator('dialog[open]')
const commit = (page) => dialog(page).locator('[data-mark-returned-back-commit]')
const reasonsLoaded = (page) =>
  dialog(page).locator('#mark-returned-back-reason option[value="CARB"]').waitFor({ state: 'attached' })

async function openDelivery(page, no) {
  await page.goto(`${BASE}/oms/delivery/${no}`)
  await page.getByRole('region', { name: 'Actions' }).waitFor()
  await page.waitForTimeout(300)
}

async function run() {
  const browser = await chromium.launch()

  // ============================================ A · granted, out for delivery: the happy path
  {
    const { context, page, errors, calls, posts, holdPosts } = await open(browser)
    await openDelivery(page, DELIVERY)
    await shot(page, 'mark-returned-back-cluster')
    check('A: the Delivery cluster shows Mark Returned Back…', (await cluster(page).count()) === 1 && (await command(page).count()) === 1)
    check('A: this grant alone does not draw Mark Delivered…', (await delivered(page).count()) === 0)
    check('A: it is takeable on O', (await command(page).getAttribute('aria-disabled')) === null && (await command(page).isEnabled()))
    check('A: it carries no check-mark icon', (await command(page).locator('svg.lucide-check, svg.lucide-circle-check, svg.lucide-check-circle').count()) === 0)

    await command(page).click()
    await dialog(page).waitFor()
    await reasonsLoaded(page)
    const title = await dialog(page).locator('h2').innerText()
    check('A: the dialog is titled with the delivery number', title.includes(DELIVERY), title)
    const options = await dialog(page).locator('#mark-returned-back-reason option').allInnerTexts()
    check('A: the four reasons are listed by their labels', options.length === 5 && options.includes('Goods received back at the store'), options.join(' | '))
    check('A: the reschedule line shows', (await dialog(page).locator('[data-mark-returned-back-reschedule]').count()) === 1)
    check('A: no express warning on a non-express delivery', (await dialog(page).locator('[data-mark-returned-back-express]').count()) === 0)
    check('A: no amount-due line', (await dialog(page).locator('[data-mark-delivered-due]').count()) === 0)
    await shot(page, 'mark-returned-back-dialog')
    check('A: commit is disabled without a reason', await commit(page).isDisabled())
    await dialog(page).locator('#mark-returned-back-reason').selectOption('OTHB')
    check('A: on OTHB without a note it stays disabled', await commit(page).isDisabled())
    await dialog(page).locator('#mark-returned-back-note').fill('   ')
    check('A: …and with a blank note', await commit(page).isDisabled())
    await dialog(page).locator('#mark-returned-back-note').fill('  Customer refused at the door  ')
    check('A: a note enables it', await commit(page).isEnabled())
    check('A: the note field is capped at 100', (await dialog(page).locator('#mark-returned-back-note').getAttribute('maxlength')) === '100')

    const release = holdPosts()
    await commit(page).dblclick()
    await page.waitForTimeout(400)
    check('A: in flight, commit reads Marking… and is disabled', (await commit(page).innerText()).includes('Marking') && (await commit(page).isDisabled()))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    check('A: in flight, Escape does not dismiss the dialog', (await dialog(page).count()) === 1)
    release()
    await page.getByText('Marked returned back', { exact: true }).waitFor()
    await page.waitForTimeout(500)
    check('A: a double click sent exactly ONE POST', posts.length === 1, `${posts.length}`)
    check(
      'A: the body is exactly { deliveryNo, reasonCode, note:<trimmed> } — no actor',
      JSON.stringify(posts[0]) === JSON.stringify({ deliveryNo: DELIVERY, reasonCode: 'OTHB', note: 'Customer refused at the door' }),
      JSON.stringify(posts[0]),
    )
    check('A: success closes the dialog', (await dialog(page).count()) === 0)
    check('A: success reloads the delivery', count(calls, /^GET SdDocumentWeb\/Delivery\/[^/]+$/) === 2, `${count(calls, /^GET SdDocumentWeb\/Delivery\/[^/]+$/)}`)
    check('A: success reloads the log', count(calls, /^GET SdDocumentWeb\/Document\/.+\/Logs$/) === 2, `${count(calls, /Logs$/)}`)
    check('A: the reloaded delivery (now B) disables the command with its reason', (await command(page).getAttribute('aria-disabled')) === 'true')
    check('A: ONE reasons read and ONE Access call', count(calls, /MarkReturnedBackReasons$/) === 1 && count(calls, /^GET SdDocumentWeb\/Access$/) === 1)
    check('A: no page errors', errors.length === 0, errors.join(' | '))
    await shot(page, 'mark-returned-back-after')
    await context.close()
  }

  // ============================================ A2 · express warns of the automatic close
  {
    const { context, page } = await open(browser, { express: true })
    await openDelivery(page, DELIVERY)
    await command(page).click()
    await reasonsLoaded(page)
    const warning = dialog(page).locator('[data-mark-returned-back-express]')
    check('A2: the express warning shows', (await warning.count()) === 1 && (await warning.innerText()).includes('five minutes'))
    check('A2: the reschedule line still shows', (await dialog(page).locator('[data-mark-returned-back-reschedule]').count()) === 1)
    await shot(page, 'mark-returned-back-express')
    await context.close()
  }

  // ============================================ A3 · each grant draws its own command
  for (const [label, access, wantDelivered, wantReturned] of [
    ['both grants', { ...BASE_ACCESS, canMarkDelivered: true, canMarkReturnedBack: true }, 1, 1],
    ['only Mark delivered', { ...BASE_ACCESS, canMarkDelivered: true, canMarkReturnedBack: false }, 1, 0],
  ]) {
    const { context, page } = await open(browser, { access })
    await openDelivery(page, DELIVERY)
    check(
      `A3: ${label} — Mark Delivered ${wantDelivered}, Mark Returned Back ${wantReturned}`,
      (await delivered(page).count()) === wantDelivered && (await command(page).count()) === wantReturned && (await cluster(page).count()) === 1,
    )
    await context.close()
  }

  // ============================================ B · state disables with a reason
  for (const [label, status, reason] of [
    ['delivered (D)', ['D', ''], 'Only a delivery that is out for delivery can be marked returned back.'],
    ['a pending cancellation', ['O', 'R'], 'A cancellation is pending on this delivery.'],
  ]) {
    const { context, page, posts } = await open(browser, { status })
    await openDelivery(page, DELIVERY)
    check(`B: ${label} — drawn, aria-disabled`, (await command(page).getAttribute('aria-disabled')) === 'true')
    await command(page).focus()
    const tip = await page.locator('#command-reason-mark-returned-back').innerText()
    check(`B: ${label} — it states its reason`, tip === reason, tip)
    await command(page).click({ force: true })
    await page.waitForTimeout(200)
    check(`B: ${label} — clicking opens nothing`, (await dialog(page).count()) === 0 && posts.length === 0)
    await context.close()
  }

  // ============================================ C · hidden
  for (const [label, access, no] of [
    ['no grant', { ...BASE_ACCESS, canMarkDelivered: false, canMarkReturnedBack: false }, DELIVERY],
    ['an older API (field absent)', { ...BASE_ACCESS }, DELIVERY],
    ['a delivery-return (T)', ONLY_THIS, RETURN],
  ]) {
    const { context, page, calls } = await open(browser, { access })
    await openDelivery(page, no)
    check(`C: ${label} — no Delivery cluster, no command`, (await cluster(page).count()) === 0 && (await command(page).count()) === 0)
    check(`C: ${label} — no reasons read`, count(calls, /MarkReturnedBackReasons$/) === 0)
    await context.close()
  }

  // ============================================ D · a 400 refusal, worded from its code
  {
    const { context, page, calls } = await open(browser, {
      answer: () => refusal400('SDD-02227', 'Delivery is not out for delivery.'),
    })
    await openDelivery(page, DELIVERY)
    await command(page).click()
    await reasonsLoaded(page)
    await dialog(page).locator('#mark-returned-back-reason').selectOption('CARB')
    await commit(page).click()
    await dialog(page).getByRole('alert').waitFor()
    const text = await dialog(page).getByRole('alert').innerText()
    check(
      'D: the refusal is the locale sentence with its code',
      text.includes('The delivery is no longer out for delivery. Refresh to see its status.') && text.includes('SDD-02227'),
      text,
    )
    check('D: the dialog stays open, the reason kept', (await dialog(page).count()) === 1 && (await dialog(page).locator('#mark-returned-back-reason').inputValue()) === 'CARB')
    check('D: no reload after a refusal', count(calls, /^GET SdDocumentWeb\/Delivery\/[^/]+$/) === 1)
    await shot(page, 'mark-returned-back-refused')
    await context.close()
  }

  // ============================================ E · a 403 revokes this grant only
  {
    const { context, page, errors } = await open(browser, {
      access: { ...BASE_ACCESS, canMarkDelivered: true, canMarkReturnedBack: true },
      answer: () => BARE_403,
    })
    await openDelivery(page, DELIVERY)
    await command(page).click()
    await reasonsLoaded(page)
    await dialog(page).locator('#mark-returned-back-reason').selectOption('STOR')
    await commit(page).click()
    await page.getByText('Mark returned back is not open to you').waitFor()
    await page.waitForTimeout(300)
    check('E: a 403 closes the dialog with a toast', (await dialog(page).count()) === 0)
    check('E: …and removes Mark Returned Back…', (await command(page).count()) === 0)
    check('E: …but leaves Mark Delivered… (its own grant)', (await delivered(page).count()) === 1)
    check('E: the page itself stays open', (await page.getByRole('region', { name: 'Actions' }).count()) === 1)
    check('E: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
