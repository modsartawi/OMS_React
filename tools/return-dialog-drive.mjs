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
//  10. (293) the fee grid renders STACKED below the line grid, both visible at
//      once; only the header fee rows survive, at their `condAmount` rate;
//      every fee is unticked on open and the header carries NO select-all;
//      the note is optional — the bar reaches its ready summary with it empty.
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
  // Two header delivery fees, each with its distributed `'H'` copy on a line,
  // plus a header row of another category. ⚠ `condValue` is left at the
  // structural `0` the live wire sends on a header row — the money is
  // `condAmount`, and a grid reading the wrong one shows a fee costing nothing.
  conditions: [
    fee(0, 'DFEE', 'Delivery Fees', 'F', 12, 'M'),
    fee(0, 'FBBD', 'Beyond Border Delivery Fee', 'F', 25, 'M'),
    fee(0, 'PTPA', 'PostToAccount', 'P', 0, 'M'),
    fee(10, 'DFEE', 'Delivery Fees', 'F', 12, 'H'),
    fee(10, 'FBBD', 'Beyond Border Delivery Fee', 'F', 25, 'H'),
  ],
  // The capture's own shipping address is entirely blank, which proves nothing
  // about carrying an address across — so this one is populated. Only the
  // VALUES are invented; the shape is the wire's own.
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
 * The cached `SdDocument/Districts` lookup the picker reads — the SAME read the
 * Change Store picker already makes. Two districts in one city and one in
 * another, so choosing has a city to change.
 */
const district = (districtCode, districtNameEn, cityCode, cityNameEn) => ({
  districtCode,
  cityCode,
  cityNameAr: '',
  cityNameEn,
  magentoCityEn: '',
  magentoCityAr: '',
  districtNameAr: '',
  districtNameEn,
  storeCode: '1000',
  insuranceStoreCode: '',
  tempStoreCode: '',
  createdOn: '',
  createdBy: '',
  updatedOn: '',
  updatedBy: '',
  latitude: 0,
  longitude: 0,
})
const DISTRICTS = [
  district('D77', 'An-Nakheel', 'C01', 'Riyadh'),
  district('D40', 'Al-Faisaliyah', 'C02', 'Jeddah'),
]
// ⚠ The delivery's own district (`D12`, Al-Olaya) is deliberately NOT in the
// lookup: the live list is ~1.7k rows and nothing guarantees it carries the one
// a delivery was addressed to. The picker must still show it as the current
// value, and choosing it again must be a way BACK.

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
    if (p === 'SdDocument/Districts') return route.fulfill(envelope(DISTRICTS))
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
  // With the lines answered the bar moves ON to the third sentence rather than
  // to the summary — the reason is what is now missing (ticket 292, section 11
  // walks the whole order and section 12 sees the summary arrive).
  check(
    'with a line ticked and a quantity set, the bar moves on to the reason sentence',
    (await gate().innerText()).trim() === 'Choose what happens to the goods.' &&
      (await gate().getAttribute('data-return-gate')) === 'blocked',
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
  // A reason is chosen here only so the SUMMARY is reachable — it is the last of
  // the three sentences, and the count is what the summary states.
  await page.locator('[data-return-reason="RTRF"]').click()
  await page.waitForTimeout(100)
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

  // ------------------------------ 10 · the reason: neither card pre-selected
  const reason = (code) => page.locator(`[data-return-reason="${code}"]`)
  const addressPanel = () => page.locator('[data-return-address-panel]')
  const on = async (code) => (await reason(code).getAttribute('data-on')) === '1'
  check(
    'on open NEITHER reason card is selected — an immediate refund is never a default',
    !(await on('RTRF')) &&
      !(await on('RF')) &&
      (await reason('RTRF').getAttribute('aria-checked')) === 'false' &&
      (await reason('RF').getAttribute('aria-checked')) === 'false',
  )
  check(
    'each card carries its CONSEQUENCE, not just its title',
    (await reason('RTRF').innerText()).includes(
      'The courier collects from the customer. The refund is issued once the goods arrive.',
    ) &&
      (await reason('RF').innerText()).includes(
        'Refunded now. No collection is booked and the customer keeps the goods.',
      ),
    (await reason('RF').innerText()).replace(/\n/g, ' '),
  )

  // --------------------------- 11 · the reason sentence is the THIRD, and last
  await pick(10).check()
  await page.waitForTimeout(100)
  check(
    'with a line ticked and its quantity valid, the bar names the reason sentence',
    (await gate().innerText()).trim() === 'Choose what happens to the goods.' &&
      (await gate().getAttribute('data-return-gate')) === 'blocked',
    (await gate().innerText()).trim(),
  )
  check('and Create return is still disabled', await submit().isDisabled())

  // ------------------------------- 12 · the address panel appears and vanishes
  check(
    'before a reason is chosen there is no address panel — nothing collects yet',
    (await addressPanel().count()) === 0,
  )
  await reason('RF').click()
  await page.waitForTimeout(100)
  check(
    'choosing Refund only REMOVES the address panel from the DOM — not greyed, absent',
    (await addressPanel().count()) === 0 && (await on('RF')),
  )
  check(
    'and the bar flips to the summary — the third sentence is answered',
    (await gate().innerText()).trim() === '1 line' &&
      (await gate().getAttribute('data-return-gate')) === 'ok',
    (await gate().innerText()).trim(),
  )
  await reason('RTRF').click()
  await page.waitForTimeout(100)
  check(
    'choosing Return and refund brings it back',
    (await addressPanel().count()) === 1 && (await on('RTRF')) && !(await on('RF')),
  )

  // ------------------------- 13 · the collapsed summary, then the full field set
  const addrSummary = () => page.locator('[data-return-address-summary]')
  const field = (name) => page.locator(`[data-return-addr="${name}"]`)
  const SUMMARY = 'Al-Olaya, Riyadh · King Abdulaziz Rd 7420 · RIYD2938'
  check(
    'the address opens COLLAPSED, as one line of the delivery own address',
    (await addrSummary().count()) === 1 &&
      (await addrSummary().innerText()).trim() === SUMMARY &&
      (await field('street1').count()) === 0,
    (await addrSummary().innerText()).trim(),
  )
  check(
    'and offers a Change affordance rather than an open six-field form',
    (await page.locator('[data-return-address-toggle]').innerText()).includes('Change'),
  )
  await page.locator('[data-return-address-toggle]').click()
  await page.waitForTimeout(100)
  check(
    'Change expands it to the whole field set the carrier reads',
    (await page.locator('[data-return-district]').count()) === 1 &&
      (await page.locator('[data-return-city]').count()) === 1 &&
      (await field('street1').inputValue()) === 'King Abdulaziz Rd' &&
      (await field('buildingNumber').inputValue()) === '7420' &&
      (await field('postalCode').inputValue()) === '12381' &&
      (await field('shortAddress').inputValue()) === 'RIYD2938' &&
      (await field('street2').count()) === 1,
  )
  check(
    'with the sentence saying what it decides — where the courier collects',
    (await addressPanel().innerText()).includes(
      'This is where the courier collects. It is pre-filled from the delivery',
    ),
  )
  check(
    'no box count and no total weight — dropped by spec 289 D9',
    !/box|weight/i.test(await addressPanel().innerText()),
  )

  // -------------------------------- 14 · the district picker, and a derived city
  const districtSelect = page.locator('[data-return-district]')
  check(
    'the district is a PICKER off the cached lookup, not free text',
    (await districtSelect.evaluate((el) => el.tagName)) === 'SELECT' &&
      (await districtSelect.locator('option').count()) === 3,
    String(await districtSelect.locator('option').count()),
  )
  check(
    'pre-selected on the district the delivery already carries',
    (await districtSelect.locator('option:checked').innerText()).trim() === 'Al-Olaya',
    (await districtSelect.locator('option:checked').innerText()).trim(),
  )
  await districtSelect.selectOption({ label: 'Al-Faisaliyah' })
  await page.waitForTimeout(100)
  check(
    'choosing a district DERIVES the city — the two can never disagree',
    (await page.locator('[data-return-city]').inputValue()) === 'Jeddah',
    await page.locator('[data-return-city]').inputValue(),
  )
  check(
    'and leaves the street alone — a district is not an address',
    (await field('street1').inputValue()) === 'King Abdulaziz Rd',
  )
  check(
    'the city is read-only — it is derived, not typed',
    await page.locator('[data-return-city]').evaluate((el) => el.readOnly),
  )
  await districtSelect.selectOption({ label: 'Al-Olaya' })
  await page.waitForTimeout(100)
  check(
    'the delivery own district is a way BACK — choosing it restores its city too',
    (await page.locator('[data-return-city]').inputValue()) === 'Riyadh' &&
      (await districtSelect.locator('option:checked').innerText()).trim() === 'Al-Olaya',
    await page.locator('[data-return-city]').inputValue(),
  )

  // ---------------- 15 · cancelling discards the edit; the delivery is untouched
  await field('street1').fill('Somewhere Else Ave')
  // The summary rail beneath reads the delivery's SHORT address, so editing that
  // one is what makes an accidental write-through visible on the screen behind.
  await field('shortAddress').fill('CHANGED9999')
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.waitForTimeout(200)
  const beneath = await page.locator('main').innerText()
  check(
    'the address ON THE DELIVERY is never touched — only the one that would post',
    beneath.includes('RIYD2938') && !beneath.includes('CHANGED9999'),
    beneath
      .split('\n')
      .filter((l) => /RIYD|CHANGED/.test(l))
      .join(' | '),
  )
  await openDialog()
  check(
    'and reopening starts from the delivery again — no reason, no address panel',
    !(await on('RTRF')) && !(await on('RF')) && (await addressPanel().count()) === 0,
  )
  await pick(10).check()
  await reason('RTRF').click()
  await page.waitForTimeout(100)
  check(
    'the summary is the delivery own address once more — the edit went with the cancel',
    (await addrSummary().innerText()).trim() === SUMMARY,
    (await addrSummary().innerText()).trim(),
  )

  // ------------------------------------- 16 · the reason group arrows, as a radiogroup does
  await reason('RTRF').focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(100)
  check(
    'the reason cards ARROW like the radiogroup they claim to be, and the panel follows',
    (await on('RF')) && !(await on('RTRF')) && (await addressPanel().count()) === 0,
  )

  // ------------------------------------- 17 · the fee grid, STACKED below the lines
  const feeGrid = () => page.locator('[data-return-fees]')
  const feeRow = (type) => page.locator(`[data-return-fee-row="${type}"]`)
  const feePick = (type) => page.locator(`[data-return-fee="${type}"]`)
  const feeAmount = async (type) =>
    (await page.locator(`[data-return-fee-amount="${type}"]`).innerText()).trim()
  check(
    'the fee grid is STACKED below the line grid — both visible at once, neither behind a tab',
    (await feeGrid().count()) === 1 &&
      (await feeGrid().isVisible()) &&
      (await row(10).isVisible()),
    await feeGrid().getAttribute('data-return-fees'),
  )
  // Their vertical order, measured — a grid that renders above the lines, or in
  // a second column, is not what D12 asked for.
  const lineBox = await row(10).boundingBox()
  const feeBox = await feeGrid().boundingBox()
  check(
    'and it sits BELOW them, not beside them',
    feeBox.y > lineBox.y,
    `lines y=${Math.round(lineBox.y)} · fees y=${Math.round(feeBox.y)}`,
  )
  check(
    'only the HEADER fee rows are offered — the per-line copies and the payment row are not',
    (await page.locator('[data-return-fee-row]').count()) === 2 &&
      (await feeRow('DFEE').count()) === 1 &&
      (await feeRow('FBBD').count()) === 1 &&
      (await feeRow('PTPA').count()) === 0,
    String(await page.locator('[data-return-fee-row]').count()),
  )
  check(
    'each at its RATE — condAmount, never the structural zero on condValue, and never the copies summed',
    (await feeAmount('DFEE')) === '12.00' && (await feeAmount('FBBD')) === '25.00',
    `${await feeAmount('DFEE')} / ${await feeAmount('FBBD')}`,
  )

  // ------------------------------- 18 · unticked on open, and no select-all
  check(
    'every fee is UNTICKED on open — refunding one is a concession, never a default',
    !(await feePick('DFEE').isChecked()) && !(await feePick('FBBD').isChecked()),
  )
  check(
    'and there is NO select-all in the fee grid header — no one-click way past the guard',
    (await feeGrid().locator('thead input').count()) === 0 &&
      (await feeGrid().locator('[data-return-select-all]').count()) === 0,
  )
  check(
    'the guard says why, so an empty column reads as deliberate rather than forgotten',
    (await feeGrid().innerText()).includes(
      'Refunding a fee is a concession — tick only what is being given back',
    ),
  )
  await feePick('DFEE').check()
  await page.waitForTimeout(100)
  check(
    'a fee ticks one at a time, and the other stays where it was',
    (await feePick('DFEE').isChecked()) && !(await feePick('FBBD').isChecked()),
  )

  // ------------------------------------------- 19 · the note is OPTIONAL
  const noteBox = () => page.locator('[data-return-note-field] textarea')
  check(
    'the note is one free-text field, and it is the last of them',
    (await noteBox().count()) === 1 && (await noteBox().inputValue()) === '',
  )
  check(
    'labelled as optional, and asking for the return own reason rather than for commentary',
    (await page.locator('[data-return-note-field] label').innerText()).includes('optional') &&
      (await noteBox().getAttribute('placeholder')) ===
        'Why is this coming back? The warehouse reads this when the goods arrive.',
    (await page.locator('[data-return-note-field] label').innerText()).trim(),
  )
  check(
    'and the bar reaches its READY summary with the note left empty — nothing is required of it',
    (await gate().getAttribute('data-return-gate')) === 'ok' &&
      (await noteBox().inputValue()) === '',
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
