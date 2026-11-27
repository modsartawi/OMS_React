// The receipt in the summary column (spec 983 D6, ticket 986) — drives the REAL app in
// Chromium, the wire stubbed at Playwright on contract v1.13 (C1: `totals.beforeDiscount`,
// `totals.discount`; BackOffice 4454).
//
//   1. run the app:  npx vite --port 5206 --strictPort
//   2. DRIVE_PORT=5206 node tools/callcenter-receipt-drive.mjs
//
// Asserts ticket 986's drive proof, light/LTR at 1366 and RTL at 1366:
//   1. a v1.13 order prints Original · Discount · Subtotal · VAT · Delivery fee · Total in
//      that order, each the stub's own figure verbatim — the stub's figures are the walk
//      basket of 4454 (214.28 / 20.73 / 193.55), and the payable deliberately is NOT the sum
//      of the rows, so a console that added would show something else;
//   2. *Caller saves …* carries the server's discount;
//   3. the receipt sits above *Before you place it*, in the summary column;
//   4. a v1.12 order (no `beforeDiscount`) draws no Original, no Discount and no pill;
//   5. a waived fee is struck out, marked free, and names its reason;
//   6. under RTL every figure is an LTR isolate, and the discount's sign stays in front.
// Screenshots → tools/.callcenter-receipt-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5206}`
const SHOTS = 'tools/.callcenter-receipt-shots'
mkdirSync(SHOTS, { recursive: true })

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
    .response.body.data

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

let pass = 0
let fail = 0
const ok = (c, m, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

/** Fixture 02 with an address and a slot, its totals replaced by a v1.13 stub. */
const PRICED = fixture('02-two-lines-priced')
const FEE = { amount: 15, waived: false, waivedReason: null, thresholdGross: 300, conditionType: 'DFEE' }
const V113_TOTALS = {
  beforeDiscount: 214.28,
  discount: 20.73,
  net: 193.55,
  vat: 29.03,
  gross: 222.58,
  deliveryFee: FEE,
  // ⚠ Not 222.58 + 15: the receipt must print the server's payable, not a sum.
  payable: 237.61,
}
const order = (totals) => ({
  ...PRICED,
  header: {
    ...PRICED.header,
    address: {
      addressNumber: '2',
      label: 'Home',
      cityCode: 'RUH',
      cityName: 'Riyadh',
      districtCode: '011',
      districtName: 'Malqa',
      line: 'King Fahd Rd',
    },
    slot: { slotId: 'S16', from: '16:00', to: '18:00', isActive: true },
  },
  totals,
  capabilities: { ...PRICED.capabilities, submitBlockers: [], canSubmit: true },
})
const { beforeDiscount: _b, discount: _d, ...V112_TOTALS } = V113_TOTALS
const STATES = {
  v113: order(V113_TOTALS),
  v112: order(V112_TOTALS),
  waived: order({ ...V113_TOTALS, deliveryFee: { ...FEE, waived: true, waivedReason: 'ThresholdReached' } }),
}

const browser = await chromium.launch()

async function open(state, { width = 1366, height = 900, dir = 'ltr' } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.addInitScript((d) => {
    localStorage.setItem('oms.darkMode', 'false')
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
  }, dir)
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  return { context, page, errors }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const figures = (page) =>
  page.locator('[data-cc-receipt-figure]').evaluateAll((els) =>
    els.map((el) => ({ id: el.getAttribute('data-cc-receipt-figure'), text: el.textContent.replace(/\s+/g, ' ').trim() })),
  )
const textOf = async (page, sel) =>
  (await page.locator(sel).count()) ? strip(await page.locator(sel).first().innerText()) : null

// ---- 1–3. v1.13, LTR ----
console.log('\nltr 1366 — v1.13 totals')
{
  const { context, page, errors } = await open(STATES.v113)
  const rows = await figures(page)
  ok(
    rows.map((r) => r.id).join() === 'original,discount,subtotal,vat',
    'the rows read Original · Discount · Subtotal · VAT, in that order',
    JSON.stringify(rows),
  )
  const want = { original: '214.28', discount: '\u221220.73', subtotal: '193.55', vat: '29.03' }
  ok(
    rows.every((r) => r.text.startsWith(want[r.id])),
    'each figure is the stub’s own, verbatim — the discount drawn as one taken off',
    JSON.stringify(rows),
  )
  const labels = await page.locator('[data-cc-receipt] dt').allInnerTexts()
  ok(
    ['Original', 'Discount', 'Subtotal', 'VAT', 'Delivery fee'].every((l, i) => labels[i] === l),
    'labelled Original · Discount · Subtotal · VAT · Delivery fee',
    JSON.stringify(labels),
  )
  ok((await textOf(page, '[data-cc-delivery-fee]'))?.startsWith('15.00'), 'the delivery fee stands at 15.00')
  ok(
    (await textOf(page, '[data-cc-payable]'))?.startsWith('237.61'),
    '🚩 the total is the server’s payable (237.61), not a sum of the rows',
    await textOf(page, '[data-cc-payable]'),
  )
  ok(
    /^Caller saves 20\.73/.test((await textOf(page, '[data-cc-saves]')) ?? ''),
    'Caller saves 20.73 — the server’s discount',
    await textOf(page, '[data-cc-saves]'),
  )
  const receiptBox = await page.locator('[data-cc-receipt] dl').boundingBox()
  const checklistBox = await page.locator('#cc-checklist').boundingBox()
  ok(
    receiptBox && checklistBox && receiptBox.y + receiptBox.height <= checklistBox.y + 1,
    'the receipt sits above Before you place it',
    JSON.stringify({ receiptBox, checklistBox }),
  )
  await page.locator('[data-cc-receipt]').screenshot({ path: `${SHOTS}/v113-ltr.png` })
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

// ---- 4. v1.12 ----
console.log('\nltr 1366 — v1.12 totals (no beforeDiscount)')
{
  const { context, page, errors } = await open(STATES.v112)
  const rows = await figures(page)
  ok(
    rows.map((r) => r.id).join() === 'subtotal,vat',
    '🚩 Original and Discount are hidden, not invented',
    JSON.stringify(rows),
  )
  ok((await page.locator('[data-cc-saves]').count()) === 0, 'and there is no Caller saves pill')
  ok((await textOf(page, '[data-cc-payable]'))?.startsWith('237.61'), 'the total still reads the server’s payable')
  await page.locator('[data-cc-receipt]').screenshot({ path: `${SHOTS}/v112-ltr.png` })
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

// ---- 5. the waived fee ----
console.log('\nltr 1366 — a waived fee')
{
  const { context, page, errors } = await open(STATES.waived)
  const struck = page.locator('[data-cc-delivery-waived] s[data-cc-delivery-struck]')
  ok(
    (await struck.count()) === 1 && strip(await struck.innerText()).startsWith('15.00'),
    'the waived fee’s own 15.00 is struck out',
    await textOf(page, '[data-cc-delivery-waived]'),
  )
  ok(/free$/.test((await textOf(page, '[data-cc-delivery-waived]')) ?? ''), 'and marked free')
  ok(
    (await page.locator('[data-cc-delivery-waived-reason="ThresholdReached"]').count()) === 1 &&
      /over the free-delivery threshold/.test((await textOf(page, '[data-cc-delivery-waived-reason]')) ?? ''),
    'and names its reason',
    await textOf(page, '[data-cc-delivery-waived-reason]'),
  )
  ok((await page.locator('[data-cc-delivery-fee], [data-cc-delivery-threshold]').count()) === 0, 'no standing fee, no threshold')
  ok(
    (await page.locator('[data-cc-delivery-waived] button, [data-cc-delivery-waived] input').count()) === 0,
    'the waiver is an outcome, never a control',
  )
  await page.locator('[data-cc-receipt]').screenshot({ path: `${SHOTS}/waived-ltr.png` })
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

// ---- 6. RTL ----
console.log('\nrtl 1366 — v1.13 totals')
{
  const { context, page, errors } = await open(STATES.waived, { dir: 'rtl' })
  const isolated = await page
    .locator('[data-cc-receipt-figure], [data-cc-payable], [data-cc-saves], [data-cc-delivery-struck]')
    .evaluateAll((els) => els.map((el) => !!el.querySelector('bdi[dir="ltr"]')))
  ok(isolated.length === 7 && isolated.every(Boolean), 'every figure is an LTR isolate', JSON.stringify(isolated))
  const discount = await page.locator('[data-cc-receipt-figure="discount"] bdi[dir="ltr"]').evaluate((el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    const sign = el.firstChild // the minus sign's text node
    const r = document.createRange()
    r.selectNodeContents(sign)
    const digits = el.querySelector('[data-numeric]').getBoundingClientRect()
    return { sign: r.getBoundingClientRect().left, digits: digits.left }
  })
  ok(discount.sign < discount.digits, 'the discount’s minus sign stays in front of its digits', JSON.stringify(discount))
  // `i18n.ts` keeps `lng: 'en'` until Arabic is switched on, so RTL here is the direction
  // only — the Arabic keys are carried, not yet drawn.
  ok(
    (await page.evaluate(() => document.documentElement.dir)) === 'rtl',
    'the page is right-to-left',
  )
  await page.locator('[data-cc-receipt]').screenshot({ path: `${SHOTS}/waived-rtl.png` })
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
