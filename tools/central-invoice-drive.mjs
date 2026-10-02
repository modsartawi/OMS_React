// Central invoice drive (ticket 332, BackOffice spec 2094 / ticket 2099) — drives the REAL app in
// Chromium against STUBBED envelopes, with every `/api/**` request RECORDED.
//
// The wire, as BackOffice 2099 shipped it (`CentralInvoiceWebEndpoints.cs`, `CentralInvoiceGrantEndpointFilter.cs`):
//   - `GET  Sd/CentralInvoice/Access` → `{ canOpen }` (cookie-only, NOT grant-gated: a denial is a 200);
//   - `POST Sd/CentralInvoice` `{ deliveryNos, reason }` → `data.results[] = { deliveryNo, verdict, code, message }`,
//     verdict `accepted` / `wait` / `refused`; a whole-request refusal (no reason, > 200) is the standard 400
//     envelope; without the grant a BARE 403 with no body.
//
// ⚠️ Stubbed, never live: this drive proves the client half. The ticket's own Proof is the owner's smoke test on
// dev SIS.Api (cookie mode), which this does not replace.
//
// Asserts:
//   A. granted, a delivery (category D): the Billing cluster's Central Invoice… opens the dialog; Send is disabled
//      without a reason and with a blank one; the POST carries exactly `{ deliveryNos:[no], reason:<trimmed> }` and
//      no actor; while in flight the button is disabled, the dialog cannot be dismissed and a double click sends
//      ONCE; the answer shows Queued + the message verbatim; wait and refused show their code + message; a 400
//      shows the server's sentence and keeps the reason.
//   B. granted, a delivery-return (category T) and an order: no action.
//   C. ungranted: no action, no nav leaf, the deep link is the denied card, zero POSTs; an unreachable probe (500)
//      is the same (fail closed); ONE Access call per page life.
//   D. a 403 from the dialog's POST: the dialog closes, the action AND the nav leaf disappear.
//   E. the bulk screen: reached from its nav leaf (Deliveries NOT co-lit); a pasted list of five (commas, spaces,
//      one duplicate) counts four + "1 duplicate collapsed"; the POST carries the four distinct numbers; four rows
//      with the right verdict, code and message; the summary; "Copy the ones to retry (3)" puts exactly those three
//      on the clipboard; a double click sends once; over 200 is held back with no POST; a 400 shows its sentence;
//      a CSV (semicolon) and the real rollout XLSX (when present on this machine) add their delivery column;
//      a 403 turns the screen into the denied card and removes the leaf.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/central-invoice-drive.mjs
import { createRequire } from 'node:module'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
const ROLLOUT_XLSX = 'C:/Work/DMSCO/BackOffice/.requirements/Deliveries not invoiced/not invoiced orders.xlsx'

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
const DELIVERY = '8000000253' // category D
const RETURN = '9000000003' // category T (a delivery-return)
const ORDER = '2000000551' // category X

const QUEUED_MSG = (no) => `Delivery ${no} is queued for a central invoice.`
const WAIT_MSG = 'Delivery 8000000121 changed in the last 24 hours; wait and send it again.'
const PICK_MSG = 'Delivery 8000000174 has a complete picking document P-000123; the store invoices it.'
const NOT_DELIVERY_MSG = '6314628864841 is not a delivery.'

/**
 * A fresh context per scenario.
 * @param opts.probe  'granted' | 'denied' | 'unreachable'
 * @param opts.answer (body) => fulfilment for each POST Sd/CentralInvoice; default answers every number accepted
 */
async function open(browser, { probe = 'granted', answer } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  // The nav these checks read is the labelled tree; since 385 the rail boots collapsed, so the
  // stored preference opens it (the toggle's own key, as a user who pinned it open).
  await page.addInitScript(() => localStorage.setItem('oms.railExpanded', 'true'))
  const errors = []
  const calls = []
  const posts = []
  let hold = null
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = req.url().split('/api/')[1].split('?')[0]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Sd/CentralInvoice/Access') {
      if (probe === 'unreachable') return route.fulfill(envelope(null, { status: 500, success: false, message: 'boom' }))
      return route.fulfill(envelope({ canOpen: probe === 'granted' }))
    }
    if (p === 'Sd/CentralInvoice' && req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}')
      posts.push(body)
      if (hold) await hold
      if (answer) return route.fulfill(answer(body))
      return route.fulfill(
        envelope({
          results: body.deliveryNos.map((no) => ({ deliveryNo: no, verdict: 'accepted', code: '', message: QUEUED_MSG(no) })),
        }),
      )
    }
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const doc = /^SdDocumentWeb\/(Document|Delivery)\/([^/]+)$/.exec(p)
    if (doc) return route.fulfill(envelope(DOCS[doc[2]]))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }))
    return route.fulfill(envelope([]))
  })

  /** Hold every POST until the returned function is called. */
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
const actionButton = (page) => page.locator('[data-central-invoice-action]')
const navLeaf = (page) => page.locator('nav').getByRole('link', { name: 'Raise central invoices' })
const dialog = (page) => page.locator('dialog[open]')
const sendButton = (page) => dialog(page).getByRole('button', { name: /^(Raise central invoice|Sending…)$/ })

async function openDelivery(page, no, openedAs = 'delivery') {
  await page.goto(`${BASE}/oms/${openedAs}/${no}`)
  await page.getByRole('region', { name: 'Actions' }).waitFor()
  await page.waitForTimeout(300)
}

async function run() {
  const browser = await chromium.launch()

  // ============================================ A · granted, a delivery: the dialog
  {
    const { context, page, errors, calls, posts, holdPosts } = await open(browser)
    await openDelivery(page, DELIVERY)
    await shot(page, 'delivery-billing-cluster')
    const billing = page.getByRole('region', { name: 'Actions' }).getByText('Billing', { exact: true })
    check('A: a delivery shows the Billing cluster with Central Invoice…', (await billing.count()) === 1 && (await actionButton(page).count()) === 1)
    check('A: the nav carries the Raise central invoices leaf', (await navLeaf(page).count()) === 1)

    await actionButton(page).click()
    await dialog(page).waitFor()
    const title = await dialog(page).locator('h2').innerText()
    check('A: the dialog is titled with the delivery number', title.includes(DELIVERY), title)
    check('A: Send is disabled without a reason', await sendButton(page).isDisabled())
    await dialog(page).locator('textarea').fill('   \n  ')
    check('A: …and with a blank one', await sendButton(page).isDisabled())
    await dialog(page).locator('textarea').fill('  Delivered during the rollout, never invoiced  ')
    check('A: a reason enables Send', await sendButton(page).isEnabled())

    const release = holdPosts()
    await sendButton(page).dblclick()
    await page.waitForTimeout(400)
    check('A: in flight, the button reads Sending… and is disabled', (await sendButton(page).innerText()).includes('Sending') && (await sendButton(page).isDisabled()))
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    check('A: in flight, Escape does not dismiss the dialog', (await dialog(page).count()) === 1)
    release()
    await dialog(page).locator('[data-central-invoice-answer]').waitFor()
    check('A: a double click sent exactly ONE POST', posts.length === 1, `${posts.length}`)
    check(
      'A: the body is exactly { deliveryNos:[no], reason:<trimmed> } — no actor',
      JSON.stringify(posts[0]) === JSON.stringify({ deliveryNos: [DELIVERY], reason: 'Delivered during the rollout, never invoiced' }),
      JSON.stringify(posts[0]),
    )
    await shot(page, 'dialog-queued')
    const answerText = await dialog(page).locator('[data-central-invoice-answer]').innerText()
    check('A: accepted reads Queued with the server message verbatim', answerText.includes('Queued') && answerText.includes(QUEUED_MSG(DELIVERY)), answerText)
    check('A: the answered dialog offers Close only', (await dialog(page).getByRole('button').allInnerTexts()).join('|') === 'Close')
    await dialog(page).getByRole('button', { name: 'Close' }).click()
    check('A: Close dismisses it', (await dialog(page).count()) === 0)

    // Re-opened: a fresh form, not the last verdict.
    await actionButton(page).click()
    await dialog(page).waitFor()
    check('A: re-opening starts a fresh request (empty reason, no verdict)', (await dialog(page).locator('textarea').inputValue()) === '' && (await dialog(page).locator('[data-central-invoice-answer]').count()) === 0)
    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    check('A: no Document reload after a send (only queued, nothing changed yet)', count(calls, /^GET SdDocumentWeb\/Delivery\//) === 1, `${count(calls, /^GET SdDocumentWeb\/Delivery\//)}`)
    check('A: ONE Access call for the menu, the page and the dialog', count(calls, /^GET Sd\/CentralInvoice\/Access$/) === 1, `${count(calls, /Sd\/CentralInvoice\/Access/)}`)
    check('A: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ---- A2 · wait, refused and a 400, each shown as the server sent it
  {
    let next = 'wait'
    const { context, page, posts } = await open(browser, {
      answer: (body) => {
        const no = body.deliveryNos[0]
        if (next === 'wait') return envelope({ results: [{ deliveryNo: no, verdict: 'wait', code: 'CINV-CHANGED-RECENTLY', message: WAIT_MSG }] })
        if (next === 'refused') return envelope({ results: [{ deliveryNo: no, verdict: 'refused', code: 'CINV-PICK-COMPLETE', message: PICK_MSG }] })
        return refusal400('CINV-REASON-REQUIRED', 'A central invoice needs a reason; nothing was queued.')
      },
    })
    await openDelivery(page, DELIVERY)
    for (const [kind, label, code, msg] of [
      ['wait', 'Wait', 'CINV-CHANGED-RECENTLY', WAIT_MSG],
      ['refused', 'Refused', 'CINV-PICK-COMPLETE', PICK_MSG],
    ]) {
      next = kind
      await actionButton(page).click()
      await dialog(page).locator('textarea').fill('reason')
      await sendButton(page).click()
      await dialog(page).locator('[data-central-invoice-answer]').waitFor()
      const text = await dialog(page).locator('[data-central-invoice-answer]').innerText()
      check(`A2: ${kind} reads ${label} with ${code} and the message verbatim`, text.includes(label) && text.includes(code) && text.includes(msg), text)
      await dialog(page).getByRole('button', { name: 'Close' }).click()
    }
    next = '400'
    await actionButton(page).click()
    await dialog(page).locator('textarea').fill('kept reason')
    await sendButton(page).click()
    await dialog(page).getByRole('alert').waitFor()
    const alert = await dialog(page).getByRole('alert').innerText()
    check('A2: a 400 shows the server sentence, in the form', alert.includes('needs a reason; nothing was queued'), alert)
    check('A2: …and keeps the reason and Send for a retry', (await dialog(page).locator('textarea').inputValue()) === 'kept reason' && (await sendButton(page).isEnabled()))
    check('A2: three POSTs, one per send', posts.length === 3, `${posts.length}`)
    await context.close()
  }

  // ============================================ B · granted, not a delivery: no action
  {
    const { context, page } = await open(browser)
    await openDelivery(page, RETURN)
    check('B: a delivery-return (category T) shows no Central Invoice…', (await actionButton(page).count()) === 0)
    await openDelivery(page, ORDER, 'document')
    check('B: an order shows no Central Invoice…', (await actionButton(page).count()) === 0)
    check('B: the nav leaf is still there (the grant is held)', (await navLeaf(page).count()) === 1)
    await context.close()
  }

  // ============================================ C · ungranted and unreachable: hidden everywhere
  for (const probe of ['denied', 'unreachable']) {
    const { context, page, calls } = await open(browser, { probe })
    await openDelivery(page, DELIVERY)
    check(`C(${probe}): no Central Invoice… on a delivery`, (await actionButton(page).count()) === 0)
    check(`C(${probe}): no Billing cluster`, (await page.getByRole('region', { name: 'Actions' }).getByText('Billing', { exact: true }).count()) === 0)
    check(`C(${probe}): no nav leaf`, (await navLeaf(page).count()) === 0)
    await page.goto(`${BASE}/oms/central-invoice`)
    await page.getByRole('alert').waitFor()
    const card = await page.getByRole('alert').innerText()
    check(
      `C(${probe}): the deep link is the ${probe === 'denied' ? 'denied' : 'unreachable'} card, not the screen`,
      (probe === 'denied' ? /No access to central invoicing/ : /unavailable/).test(card) && (await page.locator('#central-invoice-list').count()) === 0,
      card.replace(/\s+/g, ' '),
    )
    check(`C(${probe}): zero POSTs`, count(calls, /^POST /) === 0)
    await context.close()
  }

  // ============================================ D · a 403 from the dialog shuts the door
  {
    const { context, page, posts } = await open(browser, { answer: () => BARE_403 })
    await openDelivery(page, DELIVERY)
    await actionButton(page).click()
    await dialog(page).locator('textarea').fill('reason')
    await sendButton(page).click()
    await page.getByText('Central invoicing is not open to you').waitFor()
    await page.waitForTimeout(300)
    check('D: the 403 was one POST', posts.length === 1)
    check('D: the dialog closed', (await dialog(page).count()) === 0)
    check('D: the action is gone', (await actionButton(page).count()) === 0)
    check('D: the nav leaf is gone', (await navLeaf(page).count()) === 0)
    await context.close()
  }

  // ============================================ E · the bulk screen
  {
    const FIVE = ['8000000253', '8000000121', '8000000174', '6314628864841']
    const { context, page, errors, posts, holdPosts } = await open(browser, {
      answer: (body) => {
        if (body.deliveryNos.length === 1 && body.deliveryNos[0] === 'TOO-MANY')
          return refusal400('CINV-TOO-MANY', 'A request may raise at most 200 deliveries and this one names 201; nothing was queued. Split it and send each part.')
        if (body.deliveryNos.includes('FORBID')) return BARE_403
        const by = {
          8000000253: { verdict: 'accepted', code: '', message: QUEUED_MSG('8000000253') },
          8000000121: { verdict: 'wait', code: 'CINV-CHANGED-RECENTLY', message: WAIT_MSG },
          8000000174: { verdict: 'refused', code: 'CINV-PICK-COMPLETE', message: PICK_MSG },
          6314628864841: { verdict: 'refused', code: 'CINV-NOT-A-DELIVERY', message: NOT_DELIVERY_MSG },
        }
        return envelope({
          results: body.deliveryNos.map((no) => ({ deliveryNo: no, ...(by[no] ?? { verdict: 'accepted', code: '', message: QUEUED_MSG(no) }) })),
        })
      },
    })
    await page.goto(`${BASE}/oms/deliveries`)
    await navLeaf(page).waitFor()
    await navLeaf(page).click()
    await page.locator('#central-invoice-list').waitFor()
    check('E: the nav leaf opens the bulk screen', page.url().endsWith('/oms/central-invoice'))
    const litLeaves = await page
      .locator('nav a.bg-rail-accent')
      .allInnerTexts()
    check('E: only the central-invoice leaf is lit (not Deliveries)', litLeaves.length === 1 && litLeaves[0].includes('Raise central invoices'), litLeaves.join(' | '))

    const send = page.getByRole('button', { name: /^(Raise central invoices?|Sending…)$/ }).last()
    // Five values, one a duplicate, separated by newline, comma and spaces.
    await page.locator('#central-invoice-list').fill('8000000253\n8000000121, 8000000174\n  6314628864841  \n8000000121')
    const countText = await page.locator('[data-central-invoice-count]').innerText()
    check('E: a pasted list of five counts four distinct, one duplicate collapsed', /4 delivery numbers/.test(countText) && /1 duplicate collapsed/.test(countText), countText)
    check('E: Send is disabled without a reason', await send.isDisabled())
    await page.locator('#central-invoice-bulk-reason').fill('Rollout sheet, batch 1')
    check('E: a list and a reason enable Send', await send.isEnabled())

    const release = holdPosts()
    await send.dblclick()
    await page.waitForTimeout(400)
    check('E: in flight, Send is disabled and the list is locked', (await send.isDisabled()) && (await page.locator('#central-invoice-list').isDisabled()))
    release()
    await page.locator('[data-central-invoice-results] .ag-row').first().waitFor()
    await page.waitForTimeout(300)
    check('E: a double click sent exactly ONE POST', posts.length === 1, `${posts.length}`)
    check('E: the POST carries the four distinct numbers in pasted order', JSON.stringify(posts[0]?.deliveryNos) === JSON.stringify(FIVE), JSON.stringify(posts[0]))
    check('E: …and the trimmed reason', posts[0]?.reason === 'Rollout sheet, batch 1')

    const rows = await page.locator('[data-central-invoice-results] .ag-row').evaluateAll((els) =>
      els
        .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
        .map((row) => ['deliveryNo', 'verdict', 'code', 'message'].map((c) => row.querySelector(`[col-id="${c}"]`)?.innerText.trim() ?? '')),
    )
    const expected = [
      ['8000000253', 'Queued', '', QUEUED_MSG('8000000253')],
      ['8000000121', 'Wait', 'CINV-CHANGED-RECENTLY', WAIT_MSG],
      ['8000000174', 'Refused', 'CINV-PICK-COMPLETE', PICK_MSG],
      ['6314628864841', 'Refused', 'CINV-NOT-A-DELIVERY', NOT_DELIVERY_MSG],
    ]
    check('E: four rows — accepted, wait, refused and the non-delivery — each with its verdict, code and message', JSON.stringify(rows) === JSON.stringify(expected), JSON.stringify(rows))
    await shot(page, 'bulk-results')
    const summary = await page.locator('[data-central-invoice-summary]').innerText()
    check('E: the summary counts them', summary.includes('1 queued') && summary.includes('1 to retry later') && summary.includes('2 refused'), summary)

    const copy = page.getByRole('button', { name: /Copy the ones to retry/ })
    check('E: the copy button counts the three to retry', (await copy.innerText()).includes('(3)'))
    await copy.click()
    await page.waitForTimeout(300)
    // Normalised: the Windows clipboard hands back CRLF for the LF the page wrote.
    const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')
    check('E: the clipboard holds exactly the wait and refused numbers', clip === '8000000121\n8000000174\n6314628864841', JSON.stringify(clip))

    // Over the cap: held back, no POST.
    await page.locator('#central-invoice-list').fill(Array.from({ length: 201 }, (_, i) => String(8006000000 + i)).join('\n'))
    const over = await page.getByRole('alert').first().innerText()
    check('E: 201 distinct is held back with a sentence', /at most 200 deliveries/.test(over) && /Remove 1/.test(over), over)
    check('E: …and Send is disabled', await send.isDisabled())
    check('E: …and nothing was sent', posts.length === 1)

    // A 400 shows the server sentence.
    await page.locator('#central-invoice-list').fill('TOO-MANY')
    await send.click()
    await page.getByText('The request was not accepted').waitFor()
    const banner = await page.getByRole('alert').filter({ hasText: 'The request was not accepted' }).innerText()
    check('E: a 400 shows the server sentence', banner.includes('Split it and send each part.'), banner)

    // Files: a semicolon CSV, then the real rollout sheet, appended and deduped.
    await page.locator('#central-invoice-list').fill('')
    await page.locator('[data-central-invoice-file]').setInputFiles({
      name: 'arabic-excel.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('\uFEFFStore;Order No\r\n1109;8006456897\r\nP432;8006456512\r\n1109;8006456897\r\n', 'utf8'),
    })
    await page.waitForTimeout(300)
    check('E: a semicolon CSV adds its delivery column (store codes and header left out)', (await page.locator('#central-invoice-list').inputValue()) === '8006456897\n8006456512\n8006456897', JSON.stringify(await page.locator('#central-invoice-list').inputValue()))
    check('E: …and its repeat collapses in the count', /2 delivery numbers/.test(await page.locator('[data-central-invoice-count]').innerText()))
    // Code-review fixes: a CSV opening "PK" is still a CSV; a title row above the header adds no words.
    await page.locator('#central-invoice-list').fill('')
    await page.locator('[data-central-invoice-file]').setInputFiles({
      name: 'pk-store.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Deliveries not invoiced\nStore,Order No\nPK01,8006473324\n', 'utf8'),
    })
    await page.getByText(/Added 1 value from pk-store\.csv/).waitFor()
    check('E: a CSV with a title row and a "PK" store code adds only its delivery number', (await page.locator('#central-invoice-list').inputValue()) === '8006473324', JSON.stringify(await page.locator('#central-invoice-list').inputValue()))
    await page.locator('[data-central-invoice-file]').setInputFiles({
      name: 'old.xls',
      mimeType: 'application/vnd.ms-excel',
      buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x38, 0x00]),
    })
    await page.getByText(/old\.xls could not be read/).waitFor()
    check('E: an old binary .xls is refused and adds nothing', (await page.locator('#central-invoice-list').inputValue()) === '8006473324')
    if (existsSync(ROLLOUT_XLSX)) {
      await page.locator('#central-invoice-list').fill('')
      await page.locator('[data-central-invoice-file]').setInputFiles(ROLLOUT_XLSX)
      await page.getByText(/Added 84 values from not invoiced orders\.xlsx/).waitFor()
      const n = await page.locator('[data-central-invoice-count]').innerText()
      check('E: the real rollout XLSX adds its 84 deliveries', /84 delivery numbers/.test(n), n)
    } else check('E: the real rollout XLSX (skipped — not on this machine)', true)
    await page.locator('[data-central-invoice-file]').setInputFiles({ name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK\u0003\u0004garbage') })
    await page.getByText(/could not be read as a CSV or XLSX/).waitFor()
    check('E: an unreadable workbook says so and adds nothing', /84 delivery numbers|0 delivery numbers/.test(await page.locator('[data-central-invoice-count]').innerText()))

    // A 403 shuts the door: the screen becomes the denied card, the leaf goes.
    await page.locator('#central-invoice-list').fill('FORBID')
    await send.click()
    await page.getByText('No access to central invoicing').waitFor()
    check('E: a 403 turns the screen into the denied card', (await page.locator('#central-invoice-list').count()) === 0)
    check('E: …and removes the nav leaf', (await navLeaf(page).count()) === 0)
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
