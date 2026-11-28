// Ticket 1007 (spec 1006 D1, D10, default A) — the agent picks the order type and sees what a
// switch took off. Drives the REAL app in Chromium with the wire stubbed at Playwright, in the
// shapes BackOffice shipped (pricing2 e1433bf00, 4485/4487): `SetOrderType { orderType,
// confirmToken? }` answers `{ state, removed { coupons[], promotions } }`, `header.documentType`
// does not move, and an Nphies switch on a delivery with lines asks `storeChange` first.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. DRIVE_PORT=5199 node tools/callcenter-order-type-drive.mjs
//
//   A. an Ordinary order with a fired offer and a coupon, switched to Wasfaty: one SetOrderType
//      send, the notice names the promotions and the coupon, the badge sits on the title and the
//      receipt, and the promotions panel is the one prescription line;
//   B. dismissing the notice; switching back to Ordinary (nothing removed) draws no notice and
//      takes the badge off;
//   C. the picker is hidden when only Ordinary is offered, and on a pre-1.15 state;
//   D. a refused switch (`ORDER_TYPE_NOT_OFFERED`) is worded on the picker, nothing changes;
//   E. under Arabic, the options and the notice are Arabic;
//   F. an Nphies switch that moves the store asks first (the storeChange sheet, nothing removed),
//      and the confirm is SetOrderType again with the same requestId and the token.
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

let pass = 0
let fail = 0
const check = (m, c, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

const PRICED = fixture('02-two-lines-priced')
const ALL_TYPES = ['Ordinary', 'Wasfaty', 'Nphies']

/** An Ordinary phone order mid-call: two lines, a fired offer, coupon SAVE10, all three types offered. */
const ORDINARY = {
  ...PRICED,
  header: {
    ...PRICED.header,
    orderType: 'Ordinary',
    coupons: [{ code: 'SAVE10', description: 'Coupon', amount: -3.87 }],
  },
  firedPromotions: [
    ...PRICED.firedPromotions,
    { offerId: 'BBY-2', description: '1+1 Spray', amount: -10, lineIds: ['L10'] },
  ],
  capabilities: { ...PRICED.capabilities, orderTypes: ALL_TYPES, canRemoveCoupon: true },
}

/** What the server answers for a switch: prescription types drop offers and coupons (D10). */
function switched(state, orderType) {
  const prescription = orderType !== 'Ordinary'
  const removed = prescription
    ? { coupons: (state.header.coupons ?? []).map((c) => c.code), promotions: state.firedPromotions.length }
    : { coupons: [], promotions: 0 }
  const next = {
    ...state,
    version: state.version + 1,
    etag: `${state.etag}-${orderType}`,
    header: {
      ...state.header,
      orderType,
      coupons: prescription ? [] : state.header.coupons,
    },
    firedPromotions: prescription ? [] : PRICED.firedPromotions,
    nearMisses: prescription ? [] : state.nearMisses,
  }
  return { state: next, removed }
}

const browser = await chromium.launch()

const STORE_CHANGE_TOKEN = 'TOKEN-NPHS-STORE'
/** The ask BO 4487 answers for an Nphies switch on a delivery with lines: the UNCHANGED state with a
 *  storeChange preview (fixture 05's detail), and nothing removed yet. */
const storeChangeAsk = (state) => ({
  state: {
    ...state,
    pendingConfirmation: {
      kind: 'storeChange',
      confirmToken: STORE_CHANGE_TOKEN,
      expiresInMs: 120000,
      detail: {
        ...raw('05-rebind-preview').preview.response.body.data.pendingConfirmation.detail,
        fromPlant: state.header.plant,
        fromPlantName: state.header.plantName,
        toPlant: '2002',
        toPlantName: 'Insurance branch',
      },
    },
  },
  removed: { coupons: [], promotions: 0 },
})

async function open({ openState, locale = 'en', refuse = false, asksStore = false }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const wire = []
  let served = openState
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
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(served))
    if (p === 'CallCenterWeb/SetOrderType') {
      if (refuse)
        return route.fulfill(
          envelope(null, {
            status: 409,
            success: false,
            message: 'Order type not offered.',
            errors: [{ errorCode: 'ORDER_TYPE_NOT_OFFERED', errorMessage: 'Order type not offered.' }],
          }),
        )
      if (asksStore && body.orderType === 'Nphies' && body.confirmToken !== STORE_CHANGE_TOKEN)
        return route.fulfill(envelope(storeChangeAsk(served)))
      const result = switched(served, body.orderType)
      if (asksStore && body.orderType === 'Nphies')
        result.state = { ...result.state, header: { ...result.state.header, plant: '2002', plantName: 'Insurance branch' } }
      served = result.state
      return route.fulfill(envelope(result))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  return { context, page, errors, wire }
}

const text = async (page, selector) => ((await page.locator(selector).first().innerText()) ?? '').replace(/\s+/g, ' ')
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')
const pressed = (page, type) => page.locator(`[data-cc-order-type-option="${type}"]`).getAttribute('aria-pressed')
const count = (page, selector) => page.locator(selector).count()

async function pick(page, type) {
  await page.locator(`[data-cc-order-type-option="${type}"]`).click()
  await page.waitForLoadState('networkidle')
  await page.locator(`[data-cc-order-type="${type}"]`).waitFor({ timeout: 10_000 }).catch(() => {})
}

// ---- A + B. Ordinary → Wasfaty → Ordinary ----
{
  console.log('\nA. an Ordinary order with a fired offer, switched to Wasfaty')
  const { context, page, errors, wire } = await open({ openState: ORDINARY })
  const options = await page.locator('[data-cc-order-type-option]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-cc-order-type-option')),
  )
  check('the picker offers Phone order · Wasfaty · Nphies', options.join(',') === 'Ordinary,Wasfaty,Nphies', options.join(','))
  check('it sits in the ledger, beside the source', (await count(page, '[data-cc-ledger] [data-cc-order-type]')) === 1)
  check('Phone order is the pressed option', (await pressed(page, 'Ordinary')) === 'true')
  check('the option words', strip(await text(page, '[data-cc-order-type]')).includes('Phone order'))
  check('no badge on a phone order', (await count(page, '[data-cc-order-type-badge]')) === 0)
  check('the panel lists the fired offers', (await count(page, '[data-cc-applied] li')) >= 2)
  check('no prescription line yet', (await count(page, '[data-cc-promotions-prescription]')) === 0)

  await pick(page, 'Wasfaty')
  const sends = wire.filter((w) => w.path === 'CallCenterWeb/SetOrderType')
  check('one SetOrderType send', sends.length === 1, String(sends.length))
  check(
    'it carries the type, the transaction and a request id',
    sends[0]?.body?.orderType === 'Wasfaty' && sends[0]?.body?.transactionId === ORDINARY.transactionId && !!sends[0]?.body?.requestId,
    JSON.stringify(sends[0]?.body),
  )
  check('Wasfaty is now the pressed option', (await pressed(page, 'Wasfaty')) === 'true')
  const notice = page.locator('[data-cc-order-type-removed]')
  check('the switch notice shows', (await notice.count()) === 1)
  const said = strip(await text(page, '[data-cc-order-type-removed]'))
  check(
    'it reads "Wasfaty order: 2 promotions and coupon SAVE10 were removed."',
    said.includes('Wasfaty order: 2 promotions and coupon SAVE10 were removed.'),
    said,
  )
  check('the badge is on the order title', (await count(page, '[data-cc-order-type-badge="title"]')) === 1)
  check('the badge is on the receipt', (await count(page, '[data-cc-order-type-badge="receipt"]')) === 1)
  check('the badge says Wasfaty', strip(await text(page, '[data-cc-order-type-badge="title"]')) === 'Wasfaty')
  check(
    'the panel says offers do not apply',
    strip(await text(page, '[data-cc-promotions-prescription]')) === "Offers don't apply to prescription orders.",
  )
  check('…instead of the Applied column and near-misses', (await count(page, '[data-cc-applied]')) === 0)
  check('the top bar counts no offers within reach', (await count(page, '[data-cc-guidance-count]')) === 0)

  console.log('\nB. dismiss, then back to Ordinary')
  await page.locator('[data-cc-order-type-removed-dismiss]').click()
  check('the notice dismisses', (await notice.count()) === 0)
  await pick(page, 'Ordinary')
  check('a second SetOrderType send', wire.filter((w) => w.path === 'CallCenterWeb/SetOrderType').length === 2)
  check('an empty removed draws no notice', (await notice.count()) === 0)
  check('the badge is gone', (await count(page, '[data-cc-order-type-badge]')) === 0)
  check('the panel lists offers again', (await count(page, '[data-cc-applied]')) === 1)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- C. hidden picker ----
{
  console.log('\nC. the picker is hidden when there is no choice')
  for (const [label, openState] of [
    ['only Ordinary offered', { ...ORDINARY, capabilities: { ...ORDINARY.capabilities, orderTypes: ['Ordinary'] } }],
    ['a pre-1.15 state', PRICED],
  ]) {
    const { context, page, errors } = await open({ openState })
    check(`${label}: no picker`, (await count(page, '[data-cc-order-type]')) === 0)
    check(`${label}: no badge`, (await count(page, '[data-cc-order-type-badge]')) === 0)
    check(`${label}: no console errors`, errors.length === 0, errors[0] ?? '')
    await context.close()
  }
}

// ---- D. refusal ----
{
  console.log('\nD. a refused switch')
  const { context, page, errors } = await open({ openState: ORDINARY, refuse: true })
  await page.locator('[data-cc-order-type-option="Nphies"]').click()
  await page.locator('[data-cc-order-type-error]').waitFor({ timeout: 10_000 }).catch(() => {})
  check(
    'the picker words ORDER_TYPE_NOT_OFFERED',
    strip(await text(page, '[data-cc-order-type-error]')).includes('This seat cannot take that order type'),
  )
  check('the order stays a phone order', (await pressed(page, 'Ordinary')) === 'true')
  check('no notice, no badge', (await count(page, '[data-cc-order-type-removed]')) + (await count(page, '[data-cc-order-type-badge]')) === 0)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- E. Arabic ----
{
  console.log('\nE. under Arabic')
  const { context, page, errors } = await open({ openState: ORDINARY, locale: 'ar' })
  // `oms.locale=ar` flips the direction at boot; the app's `lng` stays `en` until Arabic is switched
  // on (core/i18n), so the drive switches the SAME i18next instance the app uses (as
  // insurance-patterns-drive does).
  await page.evaluate(async () => (await import('/src/core/i18n.ts')).default.changeLanguage('ar'))
  check('the page is right-to-left', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('the options are Arabic', strip(await text(page, '[data-cc-order-type]')).includes('وصفتي'))
  await pick(page, 'Wasfaty')
  const said = strip(await text(page, '[data-cc-order-type-removed]'))
  check('the notice is Arabic', said.includes('طلب وصفتي: تمت إزالة عرضين والقسيمة SAVE10.'), said)
  check('the panel line is Arabic', strip(await text(page, '[data-cc-promotions-prescription]')).includes('لا تنطبق العروض'))
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- F. an Nphies switch that moves the store ----
{
  console.log('\nF. an Nphies switch on a delivery with lines asks storeChange first')
  const { context, page, errors, wire } = await open({ openState: ORDINARY, asksStore: true })
  await page.locator('[data-cc-order-type-option="Nphies"]').click()
  await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ timeout: 10_000 }).catch(() => {})
  check('the storeChange sheet opens', (await count(page, '[data-cc-confirm-sheet="storeChange"]')) === 1)
  check('it names the insurance store', strip(await text(page, '[data-cc-rebind-to]')).includes('Insurance branch'))
  check('nothing is removed yet: no notice', (await count(page, '[data-cc-order-type-removed]')) === 0)
  check('the order is still a phone order', (await pressed(page, 'Ordinary')) === 'true')
  await page.locator('[data-cc-confirm-accept]').click()
  await page.waitForLoadState('networkidle')
  await page.locator('[data-cc-order-type-removed]').waitFor({ timeout: 10_000 }).catch(() => {})
  const sends = wire.filter((w) => w.path === 'CallCenterWeb/SetOrderType')
  check('two SetOrderType sends: the ask and the confirm', sends.length === 2, String(sends.length))
  check(
    'the confirm re-sends the same requestId with the token',
    sends[1]?.body?.requestId === sends[0]?.body?.requestId &&
      sends[1]?.body?.confirmToken === STORE_CHANGE_TOKEN &&
      sends[1]?.body?.orderType === 'Nphies' &&
      sends[0]?.body?.confirmToken === undefined,
    JSON.stringify(sends.map((s) => s.body)),
  )
  check('the sheet closes', (await count(page, '[data-cc-confirm-sheet="storeChange"]')) === 0)
  check('Nphies is now the pressed option', (await pressed(page, 'Nphies')) === 'true')
  const said = strip(await text(page, '[data-cc-order-type-removed]'))
  check('the commit’s removed is drawn', said.includes('Nphies order: 2 promotions and coupon SAVE10 were removed.'), said)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
