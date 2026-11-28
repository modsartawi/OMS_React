// Ticket 1009 (spec 1006 D5) — a prescription that already has an open order is confirmed before
// submit. Drives the REAL app in Chromium with the wire stubbed at Playwright: contract v1.15 is
// PROPOSED (BackOffice 4488 open), so the `confirmationRequired` answer, `detail.documentNo` and the
// `confirmToken` re-send are this ticket's guessed shapes (ticket 1009 Comments).
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. DRIVE_PORT=5199 node tools/callcenter-duplicate-prescription-drive.mjs
//
//   A. a stubbed `activePrescription` opens the sheet naming the open order; Go back is focused, so
//      Enter goes back rather than confirming;
//   B. Go back and Esc send nothing and leave the order open;
//   C. Place anyway (double-clicked) sends once, with the token on the same requestId, and reaches
//      placed;
//   D. under Arabic, the sheet is Arabic and the order number reads left-to-right, isolated;
//   E. (review finding 3) a placed answer whose state still carries the ask is placed, not re-asked;
//   F. (review finding 2) an ask this console cannot state is named, and the next press is a new
//      requestId rather than a replay of the cached answer.
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
const EXISTING = '0090011111'
const MINTED = '0090012345'
const TOKEN = 'TOKEN-RX-1'

/** A Wasfaty delivery, prescription held, ready to place. */
const WASFATY = {
  ...PRICED,
  header: {
    ...PRICED.header,
    orderType: 'Wasfaty',
    documentType: 'WSFD',
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
    documentSource: 'CLCN',
    prescription: { patientId: '1023456789', reference: 'ERX-77' },
    paymentType: 'CashOnDelivery',
    paymentTypeForcedReason: 'orderType',
  },
  firedPromotions: [],
  nearMisses: [],
  capabilities: {
    ...PRICED.capabilities,
    orderTypes: ['Ordinary', 'Wasfaty', 'Nphies'],
    canChangePaymentType: false,
    capabilityReasons: { canChangePaymentType: 'orderType' },
    submitBlockers: [],
    canSubmit: true,
  },
}

const browser = await chromium.launch()

async function open({ locale = 'en', mode = 'normal' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const wire = []
  const served = WASFATY
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
  await page.route('**/api/**', async (route) => {
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
    if (p === 'CallCenterWeb/MyDocumentSources')
      return route.fulfill(envelope([{ documentSource: 'CLCN', description: 'Call center', isDefault: true }]))
    if (p === 'CallCenterWeb/Submit') {
      // A little latency, so a double click lands while the commit is in flight.
      await new Promise((r) => setTimeout(r, 300))
      if (mode === 'unconfirmable')
        return route.fulfill(
          envelope({
            outcome: 'confirmationRequired',
            documentNo: null,
            state: {
              ...served,
              pendingConfirmation: { kind: 'someLaterKind', confirmToken: 'TOKEN-X', expiresInMs: 120000, detail: {} },
            },
          }),
        )
      if (body?.confirmToken !== TOKEN)
        return route.fulfill(
          envelope({
            outcome: 'confirmationRequired',
            documentNo: null,
            state: {
              ...served,
              pendingConfirmation: {
                kind: 'activePrescription',
                confirmToken: TOKEN,
                expiresInMs: 120000,
                detail: { documentNo: EXISTING },
              },
            },
          }),
        )
      return route.fulfill(
        envelope({
          outcome: 'submitted',
          documentNo: MINTED,
          state: {
            ...served,
            status: 'submitted',
            version: served.version + 1,
            etag: `${served.etag}-s`,
            // E: a server that leaves the ask on the placed state.
            ...(mode === 'placedKeepsAsk'
              ? {
                  pendingConfirmation: {
                    kind: 'activePrescription',
                    confirmToken: TOKEN,
                    expiresInMs: 120000,
                    detail: { documentNo: EXISTING },
                  },
                }
              : {}),
          },
        }),
      )
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
const count = (page, selector) => page.locator(selector).count()
const settle = (page) => page.waitForLoadState('networkidle')
const submits = (wire) => wire.filter((w) => w.path === 'CallCenterWeb/Submit')
const SHEET = '[data-cc-confirm-sheet="activePrescription"]'

async function press(page) {
  await page.locator('[data-cc-submit]').click()
  await page.locator(SHEET).waitFor({ timeout: 10_000 }).catch(() => {})
  await settle(page)
}

// ---- A + B ----
{
  console.log('\nA. the ask opens the sheet naming the open order')
  const { context, page, errors, wire } = await open()
  check('Place order is live', !(await page.locator('[data-cc-submit]').isDisabled()))
  await press(page)
  check('one submit, no token', submits(wire).length === 1 && submits(wire)[0].body?.confirmToken === undefined)
  check('the duplicate-prescription sheet is open', (await count(page, SHEET)) === 1)
  const body = await text(page, '[data-cc-active-prescription-body]')
  check(
    'it names the open order',
    strip(body) === `This prescription already has an open order, ${EXISTING}. Place another one?`,
    body,
  )
  check('…the number isolated whole', body.includes(`\u2068${EXISTING}\u2069`))
  check('the buttons are Go back and Place anyway', (await text(page, '[data-cc-confirm-decline]')).trim() === 'Go back' && (await text(page, '[data-cc-confirm-accept]')).trim() === 'Place anyway')
  check('not drawn as placed', (await count(page, '[data-cc-order-placed]')) === 0)
  check(
    'Go back is the focused button',
    await page.evaluate(() => document.activeElement?.hasAttribute('data-cc-confirm-decline') ?? false),
  )
  await page.keyboard.press('Enter')
  await settle(page)
  check('Enter does not confirm — it goes back', (await count(page, SHEET)) === 0)
  check('…and sent nothing', submits(wire).length === 1)

  console.log('\nB. Go back and Esc send nothing')
  await press(page)
  check('a fresh press asks again', submits(wire).length === 2 && (await count(page, SHEET)) === 1)
  check('…on a new requestId', submits(wire)[1].body?.requestId !== submits(wire)[0].body?.requestId)
  await page.locator('[data-cc-confirm-decline]').click()
  await settle(page)
  check('Go back closes the sheet', (await count(page, SHEET)) === 0)
  check('…and sent nothing', submits(wire).length === 2)
  await press(page)
  await page.keyboard.press('Escape')
  await settle(page)
  check('Esc closes the sheet', (await count(page, SHEET)) === 0)
  check('…and sent nothing', submits(wire).length === 3)
  check('the order is still open', (await count(page, '[data-cc-order-placed]')) === 0 && !(await page.locator('[data-cc-submit]').isDisabled()))
  check('no failure line on the receipt', (await count(page, '[data-cc-submit-failed], [data-cc-confirm-error]')) === 0)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- C ----
{
  console.log('\nC. Place anyway sends once, with the token, and places')
  const { context, page, errors, wire } = await open()
  await press(page)
  const asked = submits(wire)[0]
  await page.locator('[data-cc-confirm-accept]').dblclick()
  await page.locator('[data-cc-order-placed]').waitFor({ timeout: 10_000 }).catch(() => {})
  await settle(page)
  const sent = submits(wire)
  check('exactly two submits: the ask and one commit', sent.length === 2, String(sent.length))
  check('the commit carries the token', sent[1]?.body?.confirmToken === TOKEN, JSON.stringify(sent[1]?.body))
  check('…on the same requestId', sent[1]?.body?.requestId === asked.body?.requestId)
  check('the order is placed', (await count(page, '[data-cc-order-placed]')) === 1)
  check('…with the minted number', strip(await text(page, '[data-cc-order-placed]')).includes(MINTED))
  check('the sheet is closed', (await count(page, SHEET)) === 0)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- D. Arabic ----
{
  console.log('\nD. under Arabic')
  const { context, page, errors, wire } = await open({ locale: 'ar' })
  await page.evaluate(async () => (await import('/src/core/i18n.ts')).default.changeLanguage('ar'))
  check('the page is right-to-left', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  await press(page)
  const body = await text(page, '[data-cc-active-prescription-body]')
  check(
    'the sheet is Arabic and names the order',
    strip(body) === `هذه الوصفة لها طلب مفتوح بالفعل، ${EXISTING}. هل تريد إنشاء طلب آخر؟`,
    body,
  )
  check('…the number isolated whole', body.includes(`\u2068${EXISTING}\u2069`))
  check('the buttons are Arabic', (await text(page, '[data-cc-confirm-decline]')).trim() === 'رجوع' && (await text(page, '[data-cc-confirm-accept]')).trim() === 'إنشاء الطلب على أي حال')
  check(
    'Go back is still the focused button',
    await page.evaluate(() => document.activeElement?.hasAttribute('data-cc-confirm-decline') ?? false),
  )
  await page.locator('[data-cc-confirm-accept]').click()
  await page.locator('[data-cc-order-placed]').waitFor({ timeout: 10_000 }).catch(() => {})
  check('Place anyway places it', (await count(page, '[data-cc-order-placed]')) === 1 && submits(wire).at(-1)?.body?.confirmToken === TOKEN)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- E. a placed answer that still carries the ask (review finding 3) ----
{
  console.log('\nE. a placed answer whose state still carries the ask is placed')
  const { context, page, errors, wire } = await open({ mode: 'placedKeepsAsk' })
  await press(page)
  await page.locator('[data-cc-confirm-accept]').click()
  await page.locator('[data-cc-order-placed]').waitFor({ timeout: 10_000 }).catch(() => {})
  await settle(page)
  check('the order is placed', (await count(page, '[data-cc-order-placed]')) === 1)
  check('…with the minted number', (await count(page, '[data-cc-order-placed]')) === 1 && strip(await text(page, '[data-cc-order-placed]')).includes(MINTED))
  check('the sheet did not reopen', (await count(page, SHEET)) === 0)
  check('two submits, no third', submits(wire).length === 2, String(submits(wire).length))
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- F. an ask this console cannot state (review finding 2) ----
{
  console.log('\nF. an ask this console cannot state, then a second press')
  const { context, page, errors, wire } = await open({ mode: 'unconfirmable' })
  await page.locator('[data-cc-submit]').click()
  await settle(page)
  await page.locator('[data-cc-submit-failed]').waitFor({ timeout: 10_000 }).catch(() => {})
  check('no sheet for a kind it cannot word', (await count(page, SHEET)) === 0)
  check('not drawn as placed', (await count(page, '[data-cc-order-placed]')) === 0)
  check(
    'the receipt says it could not confirm',
    (await count(page, '[data-cc-submit-failed]')) === 1 &&
      strip(await text(page, '[data-cc-submit-failed]')).includes('asked for a confirmation this console cannot show'),
  )
  await page.locator('[data-cc-submit]').click()
  await settle(page)
  const sent = submits(wire)
  check('the second press sends again', sent.length === 2, String(sent.length))
  check('…on a NEW requestId, not a replay', sent[1]?.body?.requestId && sent[1].body.requestId !== sent[0].body.requestId)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
