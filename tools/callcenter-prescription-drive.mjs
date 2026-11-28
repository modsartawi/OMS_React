// Ticket 1008 (spec 1006 D2, D4, D6, D8, D9) — a prescription order asks for the patient ID and the
// reference, and shows its rules. Drives the REAL app in Chromium with the wire stubbed at
// Playwright in the shapes BackOffice shipped (pricing2 e1433bf00, 4486/4487): `SetPrescription`
// answers the state, the blocker is `MISSING_PRESCRIPTION`, the lock is `canChangePaymentType: false`
// + `paymentTypeForcedReason: orderType` + `capabilityReasons.canChangePaymentType:
// PAYMENT_TYPE_FORCED`, and the fee is `{ amount: 0, waived: false, waivedReason: null }`.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. DRIVE_PORT=5199 node tools/callcenter-prescription-drive.mjs
//
//   A. an Nphies order with an empty basket and no prescription: the rail and the checklist name the
//      missing patient ID and reference, Items stays green (D2), Place order is dead, the payment
//      chip is locked with the prescription reason, the receipt carries no fee;
//   B. the section: the ID box keeps digits only (max 10); refusals land under their own field;
//      a whole pair commits on blur, the section settles into the ledger, submit comes alive, and
//      the read-back says the type and the reference;
//   C. the fields stay filled in across a switch to a phone order and back — a committed pair and
//      an uncommitted draft;
//   D. `NO_INSURANCE_STORE_FOR_DISTRICT` on a switch is worded on the picker; the zero fee is not
//      drawn as waived;
//   E. under Arabic, the blocker and the lock reason are Arabic;
//   F. (review finding 1) a committed pair does not reach the next order after an abandon;
//   G. (review finding 5) a switch refusal is retired by a change that moves the order's version,
//      and by an abandon and a fresh order.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
const fixture = (name) => raw(name).response.body.data

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})
const refusal = (code, message, status = 400) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, errorMessage: message }] })

let pass = 0
let fail = 0
const check = (m, c, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

const PRICED = fixture('02-two-lines-priced')
const ALL_TYPES = ['Ordinary', 'Wasfaty', 'Nphies']
const HOME = {
  addressNumber: '2',
  label: 'Home',
  cityCode: 'RUH',
  cityName: 'Riyadh',
  districtCode: '011',
  districtName: 'Malqa',
  line: 'King Fahd Rd',
}
const isRx = (type) => type === 'Wasfaty' || type === 'Nphies'
const settled = (h) => !!h.prescription?.patientId && !!h.prescription?.reference

/** The server's answer for a header: a prescription type locks payment and blocks on the pair. */
function derive(state) {
  const rx = isRx(state.header.orderType)
  const blockers = rx && !settled(state.header) ? ['MISSING_PRESCRIPTION'] : []
  return {
    ...state,
    header: {
      ...state.header,
      paymentType: 'CashOnDelivery',
      paymentTypeForcedReason: rx ? 'orderType' : null,
    },
    totals: {
      ...state.totals,
      // BO 4487 (D9): a prescription sub-source carries no fee — absent, not waived.
      deliveryFee: rx
        ? { ...PRICED.totals.deliveryFee, amount: 0, waived: false, waivedReason: null }
        : PRICED.totals.deliveryFee,
    },
    firedPromotions: rx ? [] : PRICED.firedPromotions,
    nearMisses: rx ? [] : state.nearMisses,
    capabilities: {
      ...state.capabilities,
      orderTypes: ALL_TYPES,
      canChangePaymentType: !rx,
      capabilityReasons: rx ? { canChangePaymentType: 'PAYMENT_TYPE_FORCED' } : {},
      submitBlockers: blockers,
      canSubmit: blockers.length === 0,
    },
  }
}

/** A delivery Nphies order, address and slot set, no items yet, no prescription. */
const NPHIES = derive({
  ...PRICED,
  lines: [],
  header: {
    ...PRICED.header,
    orderType: 'Nphies',
    address: HOME,
    slot: { slotId: 'S16', from: '16:00', to: '18:00', isActive: true },
    documentSource: 'CLCN',
    prescription: null,
  },
})

const browser = await chromium.launch()

async function open({ openState, locale = 'en', switchRefusal = null, nextOrder = null }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const wire = []
  let served = openState
  const bump = (next) => ({ ...next, version: served.version + 1, etag: `${served.etag}-${served.version + 1}` })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.addInitScript((lng) => {
    localStorage.setItem('oms.darkMode', 'false')
    localStorage.setItem('oms.locale', lng)
  }, locale)
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    let body = null
    if (route.request().method() === 'POST')
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
    wire.push({ path: p, body })
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Abandon') {
      const ended = served.transactionId
      if (nextOrder) served = nextOrder
      return route.fulfill(envelope({ outcome: 'abandoned', transactionId: ended }))
    }
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(served))
    if (p === 'CallCenterWeb/MyDocumentSources')
      return route.fulfill(envelope([{ documentSource: 'CLCN', description: 'Call center', isDefault: true }]))
    if (p === 'CallCenterWeb/SetPrescription') {
      // CallCenterPrescription.Validate: the ID first (ten ASCII digits after trimming), then the reference.
      const patientId = (body.patientId ?? '').trim()
      const reference = (body.reference ?? '').trim()
      if (!/^[0-9]{10}$/.test(patientId))
        return route.fulfill(refusal('PATIENT_ID_INVALID', 'The patient ID must be exactly 10 digits.'))
      if (!reference || reference.length > 50)
        return route.fulfill(refusal('REFERENCE_REQUIRED', 'The prescription reference is required.'))
      served = bump(derive({ ...served, header: { ...served.header, prescription: { patientId, reference } } }))
      return route.fulfill(envelope(served))
    }
    if (p === 'CallCenterWeb/SetOrderType') {
      if (switchRefusal)
        return route.fulfill(
          refusal(switchRefusal, 'No insurance store serves that district. Pick another address, or another order type.', 409),
        )
      // The prescription is KEPT across the switch (D10) — the server holds it on any type.
      served = bump(derive({ ...served, header: { ...served.header, orderType: body.orderType } }))
      return route.fulfill(envelope({ state: served, removed: { coupons: [], promotions: 0 } }))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  /** The server moves the order on behind the console (a second tab's address change). */
  const moveOn = () => {
    served = bump(served)
  }
  return { context, page, errors, wire, moveOn }
}

const text = async (page, selector) => ((await page.locator(selector).first().innerText()) ?? '').replace(/\s+/g, ' ')
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')
const count = (page, selector) => page.locator(selector).count()
const attr = (page, selector, name) => page.locator(selector).first().getAttribute(name)
const settle = (page) => page.waitForLoadState('networkidle')
const sends = (wire, path) => wire.filter((w) => w.path === `CallCenterWeb/${path}`)

async function pick(page, type) {
  await page.locator(`[data-cc-order-type-option="${type}"]`).click()
  await settle(page)
  await page.locator(`[data-cc-order-type="${type}"]`).waitFor({ timeout: 10_000 }).catch(() => {})
}

// ---- A + B + C ----
{
  console.log('\nA. an Nphies order with no items and no prescription')
  const { context, page, errors, wire } = await open({ openState: NPHIES })
  check('the rail Review step is amber', (await attr(page, '[data-cc-rail-step="review"]', 'data-cc-rail-state')) === 'missing')
  check('the rail Items step is green on an empty basket (D2)', (await attr(page, '[data-cc-rail-step="items"]', 'data-cc-rail-state')) === 'done')
  check('the checklist names the prescription row', (await attr(page, '[data-cc-check="prescription"]', 'data-cc-check-state')) === 'missing')
  check(
    '…in the blocker words',
    strip(await text(page, '[data-cc-check="prescription"]')).toLowerCase().includes('enter the patient id and reference'),
    strip(await text(page, '[data-cc-check="prescription"]')),
  )
  check('no "something else" row', (await count(page, '[data-cc-check="unknown"]')) === 0)
  check('Place order is dead', await page.locator('[data-cc-submit]').isDisabled())
  check('the ledger prescription field is blocked', (await attr(page, '[data-cc-ledger] [data-cc-chip="prescription"]', 'data-cc-chip-state')) === 'needsAttention')
  check('the payment word is not a control', (await count(page, '[data-cc-chip-open="payment"]')) === 0)
  check('…it reads cash on delivery', strip(await text(page, '[data-cc-chip="payment"]')).includes('cash on delivery'))
  check('the lock reason is the prescription one', (await count(page, '[data-cc-payment-locked="orderType"]')) === 1)
  check(
    '…"Prescription orders are paid on delivery."',
    strip(await text(page, '[data-cc-payment-locked]')) === 'Prescription orders are paid on delivery.',
    strip(await text(page, '[data-cc-payment-locked]')),
  )
  check('the receipt carries no fee', /^0[.,]00/.test(strip(await text(page, '[data-cc-delivery-fee]')).trim()), strip(await text(page, '[data-cc-delivery-fee]')))

  console.log('\nB. the prescription section')
  await page.locator('[data-cc-chip-open="prescription"]').click()
  check('the section opens', (await count(page, '[data-cc-section="prescription"]')) === 1)
  check('the reference is labelled "Approval / PreAuthRef"', strip(await text(page, '[data-cc-section="prescription"]')).includes('Approval / PreAuthRef'))
  const id = page.locator('[data-cc-prescription-id]')
  const ref = page.locator('[data-cc-prescription-reference]')
  await id.fill('10a2-34 56789 99')
  check('the ID box keeps digits only, ten at most', (await id.inputValue()) === '1023456789', await id.inputValue())
  await id.fill('')
  await id.pressSequentially('12a34')
  check('typed letters never land', (await id.inputValue()) === '1234', await id.inputValue())
  await id.press('Enter')
  await settle(page)
  await page.locator('[data-cc-prescription-error="patientId"]').waitFor({ timeout: 5_000 }).catch(() => {})
  check('Enter sends what is there', sends(wire, 'SetPrescription').length === 1)
  check(
    'PATIENT_ID_INVALID shows under the ID',
    strip(await text(page, '[data-cc-prescription-error="patientId"]')).includes('The patient ID is 10 digits'),
  )
  check('…and not under the reference', (await count(page, '[data-cc-prescription-error="reference"]')) === 0)
  await id.fill('1023456789')
  await id.press('Enter')
  await settle(page)
  await page.locator('[data-cc-prescription-error="reference"]').waitFor({ timeout: 5_000 }).catch(() => {})
  check('REFERENCE_REQUIRED shows under the reference', strip(await text(page, '[data-cc-prescription-error="reference"]')).includes('The reference is needed'))
  check('…and the ID error is gone', (await count(page, '[data-cc-prescription-error="patientId"]')) === 0)
  const before = sends(wire, 'SetPrescription').length
  await ref.fill('  PA-1 ')
  await ref.blur()
  await settle(page)
  await page.locator('[data-cc-section="prescription"]').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
  const last = sends(wire, 'SetPrescription').at(-1)
  check('a blur with both filled sends once', sends(wire, 'SetPrescription').length === before + 1)
  check(
    '…the pair, the reference trimmed, with its ids',
    last?.body?.patientId === '1023456789' && last?.body?.reference === 'PA-1' && last?.body?.transactionId === NPHIES.transactionId && !!last?.body?.requestId,
    JSON.stringify(last?.body),
  )
  check('the section settles', (await count(page, '[data-cc-section="prescription"]')) === 0)
  check('the ledger field is settled', (await attr(page, '[data-cc-ledger] [data-cc-chip="prescription"]', 'data-cc-chip-state')) === 'settled')
  check('…and reads "1023456789 · PA-1"', strip(await text(page, '[data-cc-ledger] [data-cc-chip="prescription"]')).includes('1023456789 · PA-1'))
  check('the checklist row is done', (await attr(page, '[data-cc-check="prescription"]', 'data-cc-check-state')) === 'done')
  check('Place order is live', !(await page.locator('[data-cc-submit]').isDisabled()))
  check(
    'the read-back says the type and the reference',
    strip(await text(page, '[data-cc-readback-clause="type"]')) === "It's an Nphies order, approval PA-1.",
    strip(await text(page, '[data-cc-readback-clause="type"]')),
  )

  console.log('\nC. a switch to a phone order and back')
  await pick(page, 'Ordinary')
  check('the prescription field is hidden on a phone order', (await count(page, '[data-cc-chip="prescription"]')) === 0)
  check('…no prescription row, no read-back type', (await count(page, '[data-cc-check="prescription"]')) + (await count(page, '[data-cc-readback-clause="type"]')) === 0)
  check('the payment is a control again', (await count(page, '[data-cc-chip-open="payment"]')) === 1)
  check('no lock reason', (await count(page, '[data-cc-payment-locked]')) === 0)
  await pick(page, 'Wasfaty')
  check('back on Wasfaty the field shows the pair', strip(await text(page, '[data-cc-ledger] [data-cc-chip="prescription"]')).includes('1023456789 · PA-1'))
  check('a settled switch does not open the section', (await count(page, '[data-cc-section="prescription"]')) === 0)
  await page.locator('[data-cc-chip-open="prescription"]').click()
  check('the boxes hold the pair', (await id.inputValue()) === '1023456789' && (await ref.inputValue()) === 'PA-1')
  check('the reference is now labelled "eRx number"', strip(await text(page, '[data-cc-section="prescription"]')).includes('eRx number'))
  check('the payment is locked again', (await count(page, '[data-cc-payment-locked="orderType"]')) === 1)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- C2. an uncommitted draft survives a switch ----
{
  console.log('\nC2. a draft typed but not committed survives a switch')
  const { context, page, errors, wire } = await open({ openState: NPHIES })
  await page.locator('[data-cc-chip-open="prescription"]').click()
  await page.locator('[data-cc-prescription-id]').fill('1023456789')
  await pick(page, 'Ordinary')
  check('nothing was sent for half a pair', sends(wire, 'SetPrescription').length === 0)
  check('the section is hidden on a phone order', (await count(page, '[data-cc-section="prescription"]')) === 0)
  await pick(page, 'Nphies')
  check('the switch back opens the section (nothing settled yet)', (await count(page, '[data-cc-section="prescription"]')) === 1)
  check('the typed ID is still there', (await page.locator('[data-cc-prescription-id]').inputValue()) === '1023456789')
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- D. refusal on switch; waived fee ----
{
  console.log('\nD. NO_INSURANCE_STORE_FOR_DISTRICT on a switch, and a waived fee')
  const ORDINARY = derive({ ...NPHIES, lines: PRICED.lines, header: { ...NPHIES.header, orderType: 'Ordinary' } })
  const { context, page, errors } = await open({ openState: ORDINARY, switchRefusal: 'NO_INSURANCE_STORE_FOR_DISTRICT' })
  await page.locator('[data-cc-order-type-option="Nphies"]').click()
  await page.locator('[data-cc-order-type-error]').waitFor({ timeout: 10_000 }).catch(() => {})
  check(
    'the picker words it like the district-without-store refusal',
    strip(await text(page, '[data-cc-order-type-error]')).includes('No insurance store serves'),
    strip(await text(page, '[data-cc-order-type-error]')),
  )
  check('the order stays a phone order', (await attr(page, '[data-cc-order-type-option="Ordinary"]', 'aria-pressed')) === 'true')
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()

  const WASFATY = derive({ ...NPHIES, header: { ...NPHIES.header, orderType: 'Wasfaty' } })
  const w = await open({ openState: WASFATY })
  check('the zero fee is not drawn as waived', (await count(w.page, '[data-cc-delivery-waived]')) === 0)
  check('no console errors', w.errors.length === 0, w.errors[0] ?? '')
  await w.context.close()
}

// ---- E. Arabic ----
{
  console.log('\nE. under Arabic')
  const { context, page, errors } = await open({ openState: NPHIES, locale: 'ar' })
  await page.evaluate(async () => (await import('/src/core/i18n.ts')).default.changeLanguage('ar'))
  check('the page is right-to-left', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('the checklist row is Arabic', strip(await text(page, '[data-cc-check="prescription"]')).includes('أدخل هوية المريض والمرجع'))
  check('the lock reason is Arabic', strip(await text(page, '[data-cc-payment-locked]')).includes('تُدفع عند التوصيل'))
  await page.locator('[data-cc-chip-open="prescription"]').click()
  check('the reference label is Arabic', strip(await text(page, '[data-cc-section="prescription"]')).includes('رقم الموافقة'))
  check('the ID box reads left-to-right', (await attr(page, '[data-cc-prescription-id]', 'dir')) === 'ltr')
  await page.locator('[data-cc-prescription-id]').fill('١٠٢٣٤٥٦٧٨٩')
  check('Arabic-Indic digits are read as digits', (await page.locator('[data-cc-prescription-id]').inputValue()) === '1023456789')
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

const NEXT_ID = 'TX-NEXT-ORDER-0001'
const NEXT_NPHIES = { ...NPHIES, transactionId: NEXT_ID, version: 1, etag: 'next-1' }

async function abandon(page) {
  await page.locator('[data-cc-abandon]').click()
  await page.locator('[data-cc-abandon-confirm]').click()
  // The old order's console leaves before the next one's arrives.
  await page.locator('[data-cc-console]').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
  await settle(page)
  await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
  await settle(page)
}

// ---- F. the next order starts with empty boxes (review finding 1) ----
{
  console.log('\nF. a committed pair does not reach the next order')
  const { context, page, errors } = await open({ openState: NPHIES, nextOrder: NEXT_NPHIES })
  await page.locator('[data-cc-chip-open="prescription"]').click()
  await page.locator('[data-cc-prescription-id]').fill('1023456789')
  await page.locator('[data-cc-prescription-reference]').fill('PA-1')
  await page.locator('[data-cc-prescription-reference]').blur()
  await settle(page)
  await page.locator('[data-cc-section="prescription"]').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
  check('the first order holds the pair', strip(await text(page, '[data-cc-ledger] [data-cc-chip="prescription"]')).includes('1023456789 · PA-1'))
  await abandon(page)
  check('the next order is on screen', (await page.locator('[data-cc-console]').count()) === 1)
  if ((await count(page, '[data-cc-section="prescription"]')) === 0)
    await page.locator('[data-cc-chip-open="prescription"]').click()
  check(
    'its boxes are empty',
    (await page.locator('[data-cc-prescription-id]').inputValue()) === '' &&
      (await page.locator('[data-cc-prescription-reference]').inputValue()) === '',
    `${await page.locator('[data-cc-prescription-id]').inputValue()} / ${await page.locator('[data-cc-prescription-reference]').inputValue()}`,
  )
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- G. a switch refusal is about the order and version it was raised on (review finding 5) ----
{
  console.log('\nG. a switch refusal is retired when the order moves on')
  const ORDINARY = derive({ ...NPHIES, lines: PRICED.lines, header: { ...NPHIES.header, orderType: 'Ordinary' } })
  const NEXT_ORDINARY = { ...ORDINARY, transactionId: NEXT_ID, version: 1, etag: 'next-1' }
  const refuse = async (page) => {
    await page.locator('[data-cc-order-type-option="Nphies"]').click()
    await page.locator('[data-cc-order-type-error]').waitFor({ timeout: 10_000 }).catch(() => {})
    await settle(page)
  }
  const { context, page, errors, moveOn } = await open({
    openState: ORDINARY,
    switchRefusal: 'NO_INSURANCE_STORE_FOR_DISTRICT',
    nextOrder: NEXT_ORDINARY,
  })
  await refuse(page)
  check('the refusal is worded', (await count(page, '[data-cc-order-type-error]')) === 1)
  moveOn()
  await page.locator('[data-cc-refresh]').click()
  await settle(page)
  await page.locator('[data-cc-order-type-error]').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
  check('a change that moves the version retires it', (await count(page, '[data-cc-order-type-error]')) === 0)
  await refuse(page)
  check('a fresh refusal is worded again', (await count(page, '[data-cc-order-type-error]')) === 1)
  await abandon(page)
  await page.locator('[data-cc-order-type-error]').waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
  check('a fresh order carries no refusal', (await count(page, '[data-cc-order-type-error]')) === 0)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
