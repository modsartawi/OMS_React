// Mark delivered drive (ticket 2422, BackOffice spec 2417 / ADR 0065) — drives the REAL app in Chromium
// against STUBBED envelopes, with every `/api/**` request RECORDED.
//
// The wire, as BackOffice 2418–2421 shipped it:
//   - `GET  SdDocumentWeb/Access` → `{ canOpenList, canOpenDetail, canMarkDelivered }` (grant-free probe);
//   - `GET  SdDocumentWeb/MarkDeliveredReasons` → `[{ code, description }]`, `CARR`, `CUST`, `DAPP`, `OTHR`;
//   - `POST SdDocumentWeb/MarkDelivered` `{ deliveryNo, reasonCode, note? }` → `data: true`; a refusal is the
//     standard 400 envelope with an `SDD-` code (2420); without either grant a BARE 403.
//
// ⚠️ Stubbed, never live: this drive proves the client half. The ticket's manual walk against a local
// SIS.Api (a granted user marks an `O` delivery and sees the new log row) is not replaced by it.
//
// Asserts:
//   A. granted, a category-D delivery at `O`: the Delivery cluster's Mark Delivered… is enabled; the dialog
//      lists the four reasons by their locale labels; commit is disabled without a reason and on OTHR without
//      a note; the amount-due warning shows; the POST carries exactly { deliveryNo, reasonCode, note } with no
//      actor; a double click sends ONCE and Escape cannot dismiss mid-flight; success toasts, closes and
//      reloads the delivery, whose new status disables the command with its reason.
//   B. state: status `D` and a pending cancellation each disable it with their reason (aria-disabled, focusable).
//   C. hidden: no grant, an older API (field absent), a delivery-return (category T) — no cluster at all.
//   D. a 400 refusal (`SDD-02152`) is worded from the locale with its code, inline; the dialog stays open.
//   E. a 403 from the POST closes the dialog with a toast and removes the command.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/mark-delivered-drive.mjs
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
  { code: 'CARR', description: 'Carrier did not update the status' },
  { code: 'CUST', description: 'Customer confirmed receipt' },
  { code: 'DAPP', description: 'Driver app failed to record delivery' },
  { code: 'OTHR', description: 'Other (note required)' },
]

/** The delivery with its two gating codes set. */
const withStatus = (doc, deliveryStatus, closeStatus = '') => ({ ...doc, status: { ...doc.status, deliveryStatus, closeStatus } })

/**
 * A fresh context per scenario.
 * @param opts.access  the probe's data
 * @param opts.status  the delivery's starting `deliveryStatus` / `closeStatus`
 * @param opts.answer  (body) => fulfilment for POST MarkDelivered; default `data: true` and the delivery turns `D`
 */
async function open(browser, { access = { canOpenList: true, canOpenDetail: true, canMarkDelivered: true }, status = ['O', ''], answer } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  await page.addInitScript(() => localStorage.setItem('oms.railExpanded', 'true'))
  const errors = []
  const calls = []
  const posts = []
  let hold = null
  let current = { ...status }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = req.url().split('/api/')[1].split('?')[0]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope(access))
    if (p === 'SdDocumentWeb/MarkDeliveredReasons') return route.fulfill(envelope(REASONS))
    if (p === 'SdDocumentWeb/MarkDelivered' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}')
      posts.push(body)
      if (hold) await hold
      if (answer) return route.fulfill(answer(body))
      current = ['D', '']
      return route.fulfill(envelope(true))
    }
    const doc = /^SdDocumentWeb\/(Document|Delivery)\/([^/]+)$/.exec(p)
    if (doc) {
      const base = DOCS[doc[2]]
      return route.fulfill(envelope(doc[2] === DELIVERY ? withStatus(base, current[0], current[1]) : base))
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
const command = (page) => page.locator('[data-command="mark-delivered"]')
const cluster = (page) => page.getByRole('region', { name: 'Actions' }).getByText('Delivery', { exact: true })
const dialog = (page) => page.locator('dialog[open]')
const commit = (page) => dialog(page).locator('[data-mark-delivered-commit]')

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
    await shot(page, 'mark-delivered-cluster')
    check('A: the Delivery cluster shows Mark Delivered…', (await cluster(page).count()) === 1 && (await command(page).count()) === 1)
    check('A: it is takeable on O', (await command(page).getAttribute('aria-disabled')) === null && (await command(page).isEnabled()))
    check('A: it carries no check-mark icon', (await command(page).locator('svg.lucide-check, svg.lucide-circle-check, svg.lucide-check-circle').count()) === 0)

    await command(page).click()
    await dialog(page).waitFor()
    await dialog(page).locator('#mark-delivered-reason option[value="CARR"]').waitFor({ state: 'attached' })
    const title = await dialog(page).locator('h2').innerText()
    check('A: the dialog is titled with the delivery number', title.includes(DELIVERY), title)
    const options = await dialog(page).locator('#mark-delivered-reason option').allInnerTexts()
    check('A: the four reasons are listed by their labels', options.length === 5 && options.includes('Customer confirmed receipt'), options.join(' | '))
    check('A: the amount-due warning shows', (await dialog(page).locator('[data-mark-delivered-due]').count()) === 1)
    await shot(page, 'mark-delivered-dialog')
    check('A: commit is disabled without a reason', await commit(page).isDisabled())
    await dialog(page).locator('#mark-delivered-reason').selectOption('OTHR')
    check('A: on OTHR without a note it stays disabled', await commit(page).isDisabled())
    await dialog(page).locator('#mark-delivered-note').fill('   ')
    check('A: …and with a blank note', await commit(page).isDisabled())
    await dialog(page).locator('#mark-delivered-note').fill('  Left with the guard, driver phoned  ')
    check('A: a note enables it', await commit(page).isEnabled())
    check('A: the note field is capped at 100', (await dialog(page).locator('#mark-delivered-note').getAttribute('maxlength')) === '100')

    const release = holdPosts()
    await commit(page).dblclick()
    await page.waitForTimeout(400)
    check('A: in flight, commit reads Marking… and is disabled', (await commit(page).innerText()).includes('Marking') && (await commit(page).isDisabled()))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    check('A: in flight, Escape does not dismiss the dialog', (await dialog(page).count()) === 1)
    release()
    await page.getByText('Marked delivered', { exact: true }).waitFor()
    await page.waitForTimeout(500)
    check('A: a double click sent exactly ONE POST', posts.length === 1, `${posts.length}`)
    check(
      'A: the body is exactly { deliveryNo, reasonCode, note:<trimmed> } — no actor',
      JSON.stringify(posts[0]) === JSON.stringify({ deliveryNo: DELIVERY, reasonCode: 'OTHR', note: 'Left with the guard, driver phoned' }),
      JSON.stringify(posts[0]),
    )
    check('A: success closes the dialog', (await dialog(page).count()) === 0)
    check('A: success reloads the delivery', count(calls, /^GET SdDocumentWeb\/Delivery\//) === 2, `${count(calls, /^GET SdDocumentWeb\/Delivery\//)}`)
    check('A: success reloads the log', count(calls, /^GET SdDocumentWeb\/Document\/.+\/Logs$/) === 2, `${count(calls, /Logs$/)}`)
    check('A: the reloaded delivery (now D) disables the command with its reason', (await command(page).getAttribute('aria-disabled')) === 'true')
    check('A: ONE reasons read and ONE Access call', count(calls, /MarkDeliveredReasons$/) === 1 && count(calls, /^GET SdDocumentWeb\/Access$/) === 1)
    check('A: no page errors', errors.length === 0, errors.join(' | '))
    await shot(page, 'mark-delivered-after')
    await context.close()
  }

  // ============================================ B · state disables with a reason
  for (const [label, status, reason] of [
    ['delivered (D)', ['D', ''], 'Only a delivery that is out for delivery can be marked delivered.'],
    ['a pending cancellation', ['O', 'R'], 'A cancellation is pending on this delivery.'],
  ]) {
    const { context, page, posts } = await open(browser, { status })
    await openDelivery(page, DELIVERY)
    check(`B: ${label} — drawn, aria-disabled`, (await command(page).getAttribute('aria-disabled')) === 'true')
    await command(page).focus()
    const tip = await page.locator('#command-reason-mark-delivered').innerText()
    check(`B: ${label} — it states its reason`, tip === reason, tip)
    await command(page).click({ force: true })
    await page.waitForTimeout(200)
    check(`B: ${label} — clicking opens nothing`, (await dialog(page).count()) === 0 && posts.length === 0)
    await context.close()
  }

  // ============================================ C · hidden
  for (const [label, access, no] of [
    ['no grant', { canOpenList: true, canOpenDetail: true, canMarkDelivered: false }, DELIVERY],
    ['an older API (field absent)', { canOpenList: true, canOpenDetail: true }, DELIVERY],
    ['a delivery-return (T)', { canOpenList: true, canOpenDetail: true, canMarkDelivered: true }, RETURN],
  ]) {
    const { context, page, calls } = await open(browser, { access })
    await openDelivery(page, no)
    check(`C: ${label} — no Delivery cluster, no command`, (await cluster(page).count()) === 0 && (await command(page).count()) === 0)
    check(`C: ${label} — no reasons read`, count(calls, /MarkDeliveredReasons$/) === 0)
    await context.close()
  }

  // ============================================ D · a 400 refusal, worded from its code
  {
    const { context, page, calls } = await open(browser, {
      answer: () => refusal400('SDD-02152', 'Delivery is not out for delivery.'),
    })
    await openDelivery(page, DELIVERY)
    await command(page).click()
    await dialog(page).locator('#mark-delivered-reason option[value="CARR"]').waitFor({ state: 'attached' })
    await dialog(page).locator('#mark-delivered-reason').selectOption('CARR')
    await commit(page).click()
    await dialog(page).getByRole('alert').waitFor()
    const text = await dialog(page).getByRole('alert').innerText()
    check(
      'D: the refusal is the locale sentence with its code',
      text.includes('The delivery is no longer out for delivery. Refresh to see its status.') && text.includes('SDD-02152'),
      text,
    )
    check('D: the dialog stays open, the reason kept', (await dialog(page).count()) === 1 && (await dialog(page).locator('#mark-delivered-reason').inputValue()) === 'CARR')
    check('D: no reload after a refusal', count(calls, /^GET SdDocumentWeb\/Delivery\//) === 1)
    await shot(page, 'mark-delivered-refused')
    await context.close()
  }

  // ============================================ E · a 403 revokes
  {
    const { context, page, errors } = await open(browser, { answer: () => BARE_403 })
    await openDelivery(page, DELIVERY)
    await command(page).click()
    await dialog(page).locator('#mark-delivered-reason option[value="CUST"]').waitFor({ state: 'attached' })
    await dialog(page).locator('#mark-delivered-reason').selectOption('CUST')
    await commit(page).click()
    await page.getByText('Mark delivered is not open to you').waitFor()
    await page.waitForTimeout(300)
    check('E: a 403 closes the dialog with a toast', (await dialog(page).count()) === 0)
    check('E: …and removes the command', (await command(page).count()) === 0 && (await cluster(page).count()) === 0)
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
