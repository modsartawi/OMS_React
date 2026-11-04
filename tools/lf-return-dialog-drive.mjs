// LF return-dialog drive (ticket 761, spec 759 F3) — the SAME Return dialog as
// `tools/return-dialog-drive.mjs`, opened on a LOCAL FULFILLMENT delivery. Drives
// the real app in Chromium; only the wire is stubbed (BackOffice 3370 create +
// 3373 refusals are not built yet).
//
// The LF delivery is synthesised from the real capture `8000000253`: only
// `deliveryDocumentType: 'LF'`, `canReturn`, the return arithmetic, the
// conditions and the address are overridden.
//
// Asserts the ticket's Proof (return-drive):
//   1. Return opens the dialog on an LF delivery for a session holding only the
//      LF grant (03) — the bonded `canCreateReturn` is false here;
//   2. NO reason choice: no radiogroup, no RTRF/RF card — the one-line LF
//      statement instead; the pickup address panel and the note are there;
//   3. the fee grid offers FLFD alone (the DFEE on the same delivery is not an
//      LF fee), UNTICKED, at its condAmount (condValue is the structural 0);
//   4. the submit gate skips "choose a reason": lines → quantity → summary;
//   5. quantities clamp 1..remaining (stepper and typed);
//   6. the body says RTRF, carries FLFD by type when ticked, the address, and no
//      amount; a double Submit posts once; a retry after a dropped answer posts
//      the SAME requestId;
//   7. each LF named refusal (outside window, Refund-Only not allowed, return
//      already open, LF grant missing) renders its banner — server sentence +
//      code, "was not created" title, dialog and form intact, no toast;
//   8. a 403 from the door revokes the LF grant: Return leaves the bar.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/lf-return-dialog-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

const DELIVERY = DOCUMENTS['8000000253']
const BASE_LINE = DELIVERY.lines[0]
const line = (lineNumber, itemNumber, quantity, returnedQuantity) => {
  const l = { ...BASE_LINE, lineNumber, itemNumber, quantity, unitPrice: 100, deleted: false }
  if (returnedQuantity !== undefined) l.returnedQuantity = returnedQuantity
  return l
}
const BASE_CONDITION = DELIVERY.conditions[0]
const fee = (condDocumentLine, condType, conditionDescription, condCategory, condAmount, originOfCond) => ({
  ...BASE_CONDITION,
  condDocumentLine,
  condType,
  conditionDescription,
  condCategory,
  condAmount,
  condValue: 0,
  originOfCond,
})

const LF_NO = '8000000253'
DOCUMENTS[LF_NO] = {
  ...DELIVERY,
  deliveryDocumentType: 'LF',
  canReturn: true,
  returnRefusal: null,
  returnWindowEndsOn: '2026-11-10',
  lines: [line(10, '208713', 4), line(20, '208714', 9, 5)],
  conditions: [
    fee(0, 'FLFD', 'Local Fulfillment Delivery Fee', 'F', 15, 'M'),
    // A bonded-style fee on the same delivery: NOT an LF fee (3369 D4), never offered.
    fee(0, 'DFEE', 'Delivery Fees', 'F', 12, 'M'),
    fee(0, 'PTPA', 'PostToAccount', 'P', 0, 'M'),
    fee(10, 'FLFD', 'Local Fulfillment Delivery Fee', 'F', 15, 'H'),
  ],
  shippingAddress: {
    ...DELIVERY.shippingAddress,
    cityCode: 'C01',
    cityName: 'Riyadh',
    districtCode: 'D12',
    districtName: 'Al-Olaya',
    street1: 'King Abdulaziz Rd',
    street2: '',
    buildingNumber: '7420',
    postalCode: '12381',
    shortAddress: 'RIYD2938',
    gpsLat: 24.7136,
    gpsLon: 46.6753,
  },
}

/**
 * The four LF named refusals (3369 §Wire / 3373). ⚠ SHAPES contractual, VALUES
 * illustrative: the codes are samples — the dialog branches on none of them.
 */
const refusal = (errorCode, message) => ({
  statusCode: 400,
  success: false,
  message,
  errors: [{ errorCode, internalErrorCode: '', errorMessage: message }],
  data: null,
})
const LF_REFUSALS = {
  outsideWindow: refusal('LF_RETURN_OUTSIDE_WINDOW', 'The return window for this delivery closed on 2026-11-10.'),
  refundOnly: refusal('LF_RETURN_REFUND_ONLY_NOT_ALLOWED', 'A local fulfillment return must be collected before it is refunded.'),
  returnOpen: refusal('LF_RETURN_ALREADY_OPEN', 'A return is already open on this delivery.'),
  grantMissing: refusal('LF_RETURN_GRANT_MISSING', 'You are not allowed to create local fulfillment returns.'),
}

const CREATED = { documentNo: '7000000913', orderNo: '2000000551', documentReason: 'RTRF', storeCode: 'BZ03', replayed: false }

const posts = []
/** 'created' | 'dropped' | 'forbidden' | a key of LF_REFUSALS */
let createMode = 'created'
let createDelay = 0

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const expectedNoise = (text) => /Failed to load resource.*(40[03]|ERR_CONNECTION_FAILED)/.test(text)
  page.on('console', (m) => m.type() === 'error' && !expectedNoise(m.text()) && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access')
      // The LF grant (03) alone: the bonded `canCreateReturn` is NOT held.
      return route.fulfill(
        envelope({ canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: false, canCreateLocalFulfillmentReturn: true }),
      )
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (p === 'SdDocumentWeb/CreateReturn') {
      posts.push(JSON.parse(route.request().postData() || '{}'))
      if (createDelay) await new Promise((resolve) => setTimeout(resolve, createDelay))
      if (createMode === 'dropped') return route.abort('connectionfailed')
      if (createMode === 'forbidden')
        // A BARE 403 — the grant filter refusing before any handler ran (the oms-viewer drive's shape).
        return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      if (LF_REFUSALS[createMode])
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify(LF_REFUSALS[createMode]) })
      return route.fulfill(envelope(CREATED))
    }
    if (p === 'SdDocument/Districts') return route.fulfill(envelope([]))
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const dialog = () => page.locator('dialog')
  const gate = () => page.locator('[data-return-gate]')
  const submit = () => page.locator('[data-return-submit]')
  const pick = (n) => page.locator(`[data-return-pick="${n}"]`)
  const qty = (n) => page.locator(`[data-return-qty="${n}"]`)
  const minus = (n) => page.locator(`[data-return-step="${n}:-1"]`)
  const plus = (n) => page.locator(`[data-return-step="${n}:1"]`)
  const banner = () => page.locator('[data-return-refusal]')
  const returnButton = () => page.getByRole('button', { name: 'Return Document' })
  const toasts = () => page.locator('[data-sonner-toast]')
  const settleToasts = () =>
    page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 0, null, { timeout: 20000 })
  const cancel = async () => {
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.waitForTimeout(200)
  }
  const openDialog = async () => {
    await returnButton().click()
    await dialog().waitFor()
    await page.waitForTimeout(150)
  }

  await page.goto(`${BASE}/oms/document/${LF_NO}`)
  await page.locator('section[aria-label="Actions"]').waitFor()
  await page.waitForTimeout(200)

  // ------------------------------------------------------------- 1 · it opens
  check('Return Document is drawn and takeable on the LF delivery with the 03 grant alone', await returnButton().isEnabled())
  await openDialog()
  check('pressing it opens the SAME return dialog', (await page.locator('#modal-title').innerText()).trim() === `Return ${LF_NO}`)

  // ----------------------------------------------------- 2 · no reason choice
  check(
    'there is NO reason choice — no radiogroup, no Return-and-refund or Refund-only card',
    (await dialog().locator('[role="radiogroup"]').count()) === 0 &&
      (await page.locator('[data-return-reason]').count()) === 0 &&
      !(await dialog().innerText()).includes('Refund only'),
  )
  const statement = page.locator('[data-return-lf-statement]')
  check(
    'the one-line statement stands in its place — the driver collects, the refund follows the warehouse',
    (await statement.count()) === 1 &&
      (await statement.innerText()).includes('Return and refund') &&
      (await statement.innerText()).includes("The driver collects from the customer, and the refund follows the warehouse's check of what arrived."),
    (await statement.innerText()).replace(/\n/g, ' '),
  )
  check(
    'the pickup address panel is there from the start, pre-filled from the delivery',
    (await page.locator('[data-return-address-toggle]').count()) === 1 && (await dialog().innerText()).includes('RIYD2938'),
  )
  check('and the note is there', (await page.locator('[data-return-note-field]').count()) === 1)

  // ------------------------------------------------------------- 3 · FLFD only
  const feeRows = page.locator('[data-return-fee-row]')
  check(
    'the fee grid offers FLFD alone — the DFEE on the same delivery is not an LF fee',
    (await feeRows.count()) === 1 && (await page.locator('[data-return-fee-row="FLFD"]').count()) === 1,
    String(await feeRows.count()),
  )
  check('FLFD is UNTICKED on open', !(await page.locator('[data-return-fee="FLFD"]').isChecked()))
  const flfdAmount = (await page.locator('[data-return-fee-amount="FLFD"]').innerText()).trim()
  check('at its condAmount — 15, never the structural 0 on condValue', /^15(\.00)?$/.test(flfdAmount), flfdAmount)

  // --------------------------------------------- 4 · the gate skips the reason
  check('nothing ticked: the lines sentence', (await gate().innerText()).trim() === 'Select at least one line to return.')
  await pick(10).check()
  await page.waitForTimeout(100)
  check(
    'a line ticked: straight to the summary — never "Choose what happens to the goods."',
    (await gate().innerText()).trim() === '1 line' && (await gate().getAttribute('data-return-gate')) === 'ok',
    (await gate().innerText()).trim(),
  )
  check('and Create return is takeable', await submit().isEnabled())
  await qty(10).fill('')
  await qty(10).blur()
  await page.waitForTimeout(100)
  check('a cleared box: the quantity sentence', (await gate().innerText()).trim() === 'A returned quantity must be at least 1.')

  // ------------------------------------------------------------ 5 · the clamp
  await qty(10).fill('99')
  await qty(10).blur()
  await page.waitForTimeout(100)
  check('a typed over-cap value clamps to what is left', (await qty(10).inputValue()) === '4', await qty(10).inputValue())
  check('and + is disabled at the cap', await plus(10).isDisabled())
  await qty(10).fill('0')
  await qty(10).blur()
  await page.waitForTimeout(100)
  check('a typed 0 lands at 1, and − is disabled there', (await qty(10).inputValue()) === '1' && (await minus(10).isDisabled()))
  await pick(20).check()
  await page.waitForTimeout(100)
  check('the partly-returned line pre-fills its remainder — 4 of 9', (await qty(20).inputValue()) === '4', await qty(20).inputValue())

  // ------------------------------------------- 6 · the body, and one requestId
  await page.locator('[data-return-fee="FLFD"]').check()
  await page.waitForTimeout(100)
  check('the summary counts FLFD — 2 lines · 1 fee', (await gate().innerText()).trim() === '2 lines · 1 fee', (await gate().innerText()).trim())

  posts.length = 0
  createMode = 'dropped'
  await submit().click()
  await page.waitForTimeout(600)
  check('a dropped answer keeps the dialog open with the "may not have been created" banner', (await banner().innerText()).includes('may not have been created'))
  createMode = 'created'
  createDelay = 800
  await submit().dblclick()
  await page.waitForTimeout(1400)
  createDelay = 0
  check('the retry posts once more, double-click notwithstanding — two posts in all', posts.length === 2, String(posts.length))
  check(
    'and BOTH carry the same requestId — the retry replays, it cannot book a second pickup',
    posts.length === 2 && posts[0].requestId && posts[0].requestId === posts[1].requestId,
    posts.map((b) => b.requestId).join(' / '),
  )
  const body = posts[1] ?? {}
  check('the body says RTRF — the only LF reason', body.reason === 'RTRF', body.reason)
  check('it names FLFD by type, and nothing else', JSON.stringify(body.conditionTypes) === '["FLFD"]', JSON.stringify(body.conditionTypes))
  check(
    'it carries the ticked lines at their quantities',
    JSON.stringify(body.lines) === JSON.stringify([
      { lineNumber: 10, itemNumber: '208713', quantity: 1 },
      { lineNumber: 20, itemNumber: '208714', quantity: 4 },
    ]),
    JSON.stringify(body.lines),
  )
  check('and the pickup address', body.shippingAddress?.shortAddress === 'RIYD2938')
  const keys = []
  const numbers = []
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (typeof v === 'number') return void numbers.push(v)
    if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) (keys.push(k), walk(c))
  }
  walk(body)
  check(
    'NOT ONE field carries an amount — the whole body, walked; 15 and 100 nowhere',
    !keys.some((k) => /price|amount|discount|vat|tax|total|charge|refund|money|cost|rate|net|gross/i.test(k)) &&
      !numbers.includes(15) &&
      !numbers.includes(100),
    JSON.stringify(body),
  )
  check('success closes the dialog', (await dialog().count()) === 0)
  check(
    'and the toast says what happens next on an LF return',
    (await toasts().first().innerText()).includes("The driver will collect the goods; the refund follows the warehouse's check."),
    (await toasts().first().innerText()).replace(/\n/g, ' '),
  )
  await settleToasts()

  // ---------------------------------------------------- 7 · each LF refusal
  for (const [name, answer] of Object.entries(LF_REFUSALS)) {
    createMode = name
    await openDialog()
    await pick(10).check()
    await page.locator('[data-return-fee="FLFD"]').check()
    await page.waitForTimeout(100)
    await submit().click()
    await page.waitForTimeout(500)
    const text = (await banner().count()) ? (await banner().innerText()).replace(/\n/g, ' ') : ''
    check(
      `${name}: the banner says the return was NOT created, with the server's own sentence and code`,
      text.includes('The return was not created') &&
        text.includes(answer.message) &&
        (await page.locator('[data-return-refusal-code]').innerText()).trim() === answer.errors[0].errorCode &&
        (await page.locator('[data-return-retry-safe]').count()) === 0,
      text,
    )
    check(
      `${name}: the dialog stays open with the form intact, and no toast is raised`,
      (await dialog().count()) === 1 &&
        (await pick(10).isChecked()) &&
        (await page.locator('[data-return-fee="FLFD"]').isChecked()) &&
        (await toasts().count()) === 0,
    )
    await cancel()
  }
  check('a business refusal leaves the LF grant alone — Return is still on the bar', (await returnButton().count()) === 1)

  // ------------------------------------------------- 8 · a 403 revokes LF 03
  createMode = 'forbidden'
  await openDialog()
  await pick(10).check()
  await page.waitForTimeout(100)
  await submit().click()
  await page.waitForTimeout(500)
  check('a 403 still lands in the dialog banner', (await banner().count()) === 1)
  await cancel()
  await page.waitForTimeout(200)
  check('and it revokes the LF grant: Return Document leaves the LF delivery\'s bar', (await returnButton().count()) === 0)

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
