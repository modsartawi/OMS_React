// Return-dialog drive (ticket 291, spec 289 D1/D3) — drives the REAL app in
// Chromium and serves the five captured payloads from
// `.issues/assets/078-document-payloads/` as the document response, exactly as
// `tools/document-actions-drive.mjs` does. The app is not stubbed, only the wire.
//
// ⚠ `canReturn` and `returnedQuantity` are BackOffice spec 1283 §2b additions
// that NO capture carries, so the returnable delivery is synthesised here from a
// real one (`8000000253`, a `DL` delivery whose single line is cloned into
// four). The mutation is the fixture; the rule under test is the app's.
//
// Asserts the ticket's Proof:
//   1. Return Document on a returnable delivery OPENS the dialog — and the
//      placeholder toast is gone;
//   2. the fully-returned line is ABSENT from the DOM, and the grid header says
//      how many were hidden — and a STRUCK line is absent too, counted apart
//      from the returned tally because nothing ever came back off it;
//   3. a partly-returned row reads *of N left*, an untouched one *of N
//      delivered* — two facts, phrased differently;
//   4. ticking a line wakes its stepper and pre-fills the remaining quantity;
//      `−` is disabled at 1 and `+` at the cap, so zero is unreachable by
//      pressing;
//   5. typed input lands in the same `[1, remaining]` range;
//   6. select-all ticks every VISIBLE row and leaves the hidden one out of the
//      count;
//   7. the submit bar states the lines sentence, then the quantity sentence, and
//      Create return is disabled in both;
//   8. the dialog claims NO grand total;
//   9. Cancel discards everything — reopening starts clean.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/return-dialog-drive.mjs
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

/**
 * The returnable delivery: four lines off one real one — untouched, partly
 * returned (twice over, so its remainder is neither the delivered quantity nor
 * the last return's), fully returned, and struck. Only the return arithmetic and
 * the `deleted` flag are overridden; every other field on the header and the
 * lines is the wire's own.
 */
const DELIVERY = DOCUMENTS['8000000253']
const BASE_LINE = DELIVERY.lines[0]
const line = (lineNumber, itemNumber, quantity, returnedQuantity, deleted = false) => {
  const l = { ...BASE_LINE, lineNumber, itemNumber, quantity, unitPrice: 100, deleted }
  if (returnedQuantity !== undefined) l.returnedQuantity = returnedQuantity
  return l
}
DOCUMENTS['8000000253'] = {
  ...DELIVERY,
  canReturn: true,
  lines: [
    line(10, '208713', 4),
    line(20, '208714', 9, 5),
    line(30, '208715', 6, 6),
    // Struck from the delivery: absent from the grid, and NOT counted among the
    // lines earlier returns took back — nothing was ever returned off it.
    line(40, '208716', 2, undefined, true),
  ],
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/Outbox$/.test(p) || /\/Logs$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const dialog = () => page.locator('dialog')
  const gate = () => page.locator('[data-return-gate]')
  const submit = () => page.locator('[data-return-submit]')
  const row = (n) => page.locator(`[data-return-row="${n}"]`)
  const pick = (n) => page.locator(`[data-return-pick="${n}"]`)
  const qty = (n) => page.locator(`[data-return-qty="${n}"]`)
  const minus = (n) => page.locator(`[data-return-step="${n}:-1"]`)
  const plus = (n) => page.locator(`[data-return-step="${n}:1"]`)

  const open = async (documentNo) => {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await page.locator('section[aria-label="Actions"]').waitFor()
    await page.waitForTimeout(150)
  }
  const openDialog = async () => {
    await page.getByRole('button', { name: 'Return Document' }).click()
    await dialog().waitFor()
    await page.waitForTimeout(150)
  }

  // ------------------------------------------------- 1 · the command opens it
  await open('8000000253')
  check(
    'Return Document is takeable on a delivery the server says canReturn for',
    await page.getByRole('button', { name: 'Return Document' }).isEnabled(),
  )
  await openDialog()
  check(
    'pressing it OPENS the return dialog over the delivery',
    (await dialog().isVisible()) &&
      (await page.locator('#modal-title').innerText()).trim() === 'Return 8000000253',
    (await page.locator('#modal-title').innerText()).trim(),
  )
  check(
    'and the placeholder toast is gone — nothing is announced instead of the screen',
    (await page.locator('[data-sonner-toast]').count()) === 0,
  )
  check(
    'the delivery it is about stays behind it — the band and rails are still mounted',
    (await page.locator('section[aria-label="Actions"]').count()) === 1,
  )

  // ------------------------------- 2 · the fully-returned line is ABSENT, and counted
  check(
    'the fully-returned line is absent from the DOM — not greyed, not disabled',
    (await row(30).count()) === 0 && (await row(10).count()) === 1 && (await row(20).count()) === 1,
  )
  const hidden = page.locator('[data-return-hidden]')
  check(
    'and the grid header says how many were hidden',
    (await hidden.getAttribute('data-return-hidden')) === '1' &&
      (await hidden.innerText()).trim() === '1 line already fully returned · not shown',
    (await hidden.innerText()).trim(),
  )

  const struck = page.locator('[data-return-not-returnable]')
  check(
    'a struck line is not offered either, and says so SEPARATELY from the returned tally',
    (await row(40).count()) === 0 &&
      (await struck.getAttribute('data-return-not-returnable')) === '1' &&
      (await struck.innerText()).trim() === '1 line cannot be returned · not shown',
    (await struck.innerText()).trim(),
  )

  // ---------------------------------------- 3 · of N left vs of N delivered
  const ofText = async (n) => (await page.locator(`[data-return-of="${n}"]`).innerText()).trim()
  check(
    'an untouched row reads *of N delivered*',
    (await ofText(10)) === 'of 4 delivered',
    await ofText(10),
  )
  check(
    'a partly-returned row reads *of N left* — the two are different facts, phrased differently',
    (await ofText(20)) === 'of 4 left',
    await ofText(20),
  )

  // ----------------------------------------------- 7a · the lines sentence first
  check(
    'with nothing ticked the bar names the lines sentence',
    (await gate().innerText()).trim() === 'Select at least one line to return.' &&
      (await gate().getAttribute('data-return-gate')) === 'blocked',
    (await gate().innerText()).trim(),
  )
  check('and Create return is disabled', await submit().isDisabled())

  // --------------------------------- 4 · the stepper is inert until its line is ticked
  check(
    'the stepper is inert until its line is ticked — the screen never invites a number it will not send',
    (await qty(10).isDisabled()) && (await minus(10).isDisabled()) && (await plus(10).isDisabled()),
  )
  await pick(10).check()
  await page.waitForTimeout(100)
  check(
    'ticking a line wakes its stepper and pre-fills everything still returnable',
    (await qty(10).inputValue()) === '4' && !(await qty(10).isDisabled()),
    await qty(10).inputValue(),
  )
  check(
    'and `+` is disabled at the cap, so the cap cannot be pressed past',
    await plus(10).isDisabled(),
  )
  await minus(10).click()
  await minus(10).click()
  await minus(10).click()
  await page.waitForTimeout(100)
  check(
    '`−` walks it down to 1 and then disables — zero is unreachable by pressing',
    (await qty(10).inputValue()) === '1' && (await minus(10).isDisabled()),
    await qty(10).inputValue(),
  )

  // ------------------------------------------ 5 · the keyboard is no way around it
  await qty(10).fill('99')
  await qty(10).blur()
  await page.waitForTimeout(100)
  check(
    'a typed over-cap value is clamped to what is left',
    (await qty(10).inputValue()) === '4',
    await qty(10).inputValue(),
  )
  await qty(10).fill('0')
  await qty(10).blur()
  await page.waitForTimeout(100)
  check(
    'and a typed 0 lands at 1 — the same range as the stepper',
    (await qty(10).inputValue()) === '1',
    await qty(10).inputValue(),
  )

  // ---------------------------------------- 7b · then the quantity sentence
  check(
    'with a line ticked and a quantity set, the bar flips to a summary of what is selected',
    (await gate().innerText()).trim() === '1 line' &&
      (await gate().getAttribute('data-return-gate')) === 'ok',
    (await gate().innerText()).trim(),
  )
  await qty(10).fill('')
  await qty(10).blur()
  await page.waitForTimeout(100)
  check(
    'a ticked line with a CLEARED quantity blocks on the quantity sentence — not the lines one',
    (await gate().innerText()).trim() === 'A returned quantity must be at least 1.',
    (await gate().innerText()).trim(),
  )
  check('and Create return is disabled there too', await submit().isDisabled())
  await plus(10).click()
  await page.waitForTimeout(100)
  check(
    '`+` on a cleared box steps to 1 — the bottom of the range, not a leap to the cap',
    (await qty(10).inputValue()) === '1',
    await qty(10).inputValue(),
  )

  // ------------------------------------------------------------ 6 · select-all
  await page.locator('[data-return-select-all]').check()
  await page.waitForTimeout(100)
  check(
    'select-all ticks every VISIBLE row — returning a whole delivery is one click',
    (await pick(10).isChecked()) && (await pick(20).isChecked()),
  )
  check(
    'each at its own remaining quantity',
    (await qty(10).inputValue()) === '4' && (await qty(20).inputValue()) === '4',
    `${await qty(10).inputValue()} / ${await qty(20).inputValue()}`,
  )
  check(
    'and the hidden line is left out of the count — 2 lines, not 3',
    (await gate().innerText()).trim() === '2 lines',
    (await gate().innerText()).trim(),
  )

  // ------------------------------------------------------ 8 · no grand total
  const bodyText = await dialog().innerText()
  check(
    'the dialog claims NO grand total — the server recomputes discount and VAT pro-rata',
    !/total/i.test(bodyText) && (await dialog().locator('tfoot').count()) === 0,
    bodyText.split('\n').filter((l) => /total/i.test(l)).join(' | '),
  )
  const lineValue = async (n) =>
    (await page.locator(`[data-return-value="${n}"]`).innerText()).trim()
  check(
    'per-line value IS shown, as context, for the quantity selected',
    (await lineValue(10)) === '400.00' && (await lineValue(20)) === '400.00',
    `${await lineValue(10)} / ${await lineValue(20)}`,
  )

  // ------------------------------------------------ 9 · Cancel discards everything
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.waitForTimeout(200)
  check('Cancel dismisses the dialog', (await dialog().count()) === 0)
  await openDialog()
  check(
    'and reopening starts clean — nothing ticked, the lines sentence back',
    !(await pick(10).isChecked()) &&
      (await qty(10).inputValue()) === '' &&
      (await gate().innerText()).trim() === 'Select at least one line to return.',
    (await gate().innerText()).trim(),
  )

  // ------------------------------------------------------------ the word `close`
  check(
    'the word `close` never appears on this screen — a return is not a cancellation',
    !/\bclose\b/i.test(await dialog().innerText()),
  )

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
