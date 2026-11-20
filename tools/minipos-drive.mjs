// Drive: the Mini POS phone app (oms 928, 917, BackOffice spec 4063) against a stubbed SIS.Api, at phone size.
//
// Proves the wiring the unit tests cannot: the two-step mobile sign-in, the door's answer choosing the screen (not
// assigned today; unlock), the customer step before the basket (a new mobile signed up with the customer's code, then
// attached and shown with the tier), the basket's typed add carrying its entry mode with the channel key and the bearer,
// a refusal shown in English and Arabic, submit landing on the order barcode, my orders today with their statuses, a
// reopen refused while a till holds the order, a reopen and edit of an open order, and its resubmit through a lost
// connection: held while offline, and retried with the SAME request id. The camera itself is the 3709 phone trial's
// (a headless browser has none).
//
// The `faults` run (review 4063): a basket read the server refuses shows the refusal with Try again (never a blank
// screen); a submit refused with SESSION_CLOSED goes back to the door, which opens anew and SHOWS why; the language
// switch writes the phone's own key, never OMS's `oms.locale`.
//
//   1. run the app:  VITE_MINIPOS_API_KEY=drive-key npx vite --port 5199
//   2. node tools/minipos-drive.mjs          (SHOTS=<dir> saves a screenshot of each screen, never into the repo)
//
// Playwright resolves as the other drives' does; PLAYWRIGHT_FROM=<a package.json beside playwright(-core)> and
// CHROME=<chrome.exe> point it elsewhere.
import { createRequire } from 'node:module'

const require = createRequire(process.env.PLAYWRIGHT_FROM || 'C:/Playground/frontend/package.json')
let pw
try {
  pw = require('playwright')
} catch {
  pw = require('playwright-core')
}
const { chromium } = pw

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = process.env.SHOTS || ''
const fails = []
const check = (ok, what) => {
  console.log(`${ok ? '✓' : '✖'} ${what}`)
  if (!ok) fails.push(what)
}

const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }) })
const refusal = (status, code, en, ar) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: false, message: en, errors: [{ errorCode: code, errorMessage: en }], data: ar ? { messageEn: en, messageAr: ar } : null }),
})

const sara = { customerId: 'L77', name: 'Sara Al-Qahtani', mobile: '0551234567', loyaltyAttached: true }
const saraMember = { loyId: 'L77', mobile: '0551234567', fullName: 'Sara Al-Qahtani', tier: 'Gold', pointsBalance: 0, email: null }

// Every answer is a newer version, as the server's are (the phone keeps the newest: `applyState`).
let version = 0
const state = (transactionId, lines, customer) => ({
  contractVersion: '1.1',
  transactionId,
  version: ++version,
  etag: `e${version}`,
  status: 'open',
  replayed: false,
  header: { plant: 'S001', plantName: 'Al Olaya', customer },
  lines,
  totals: { net: 40 * lines.length, vat: 6 * lines.length, gross: 46 * lines.length, payable: 46 * lines.length, deliveryFee: { amount: 0, waived: false, thresholdGross: 0, conditionType: '' } },
  firedPromotions: [],
  nearMisses: [],
  pendingConfirmation: null,
  capabilities: { canAddItem: true, canSubmit: lines.length > 0 },
})
const line = (qty = 1) => ({ lineId: 'L1', itemNumber: '100045', description: 'Sunscreen SPF50', description2: '', qty, uom: 'EA', uomOptions: [], unitPrice: { net: 40, gross: 46 }, lineTotal: { net: 40 * qty, gross: 46 * qty }, conditions: [], promotions: [], atpAtScan: { quantity: 9, frozenAt: null, known: true }, belowAtpAtScan: false, warnings: [] })

async function run(door) {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const calls = []
  let lines = []
  let customer = null
  let resubmits = 0
  let opens = 0
  let stateReads = 0

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace(/^\/api\//, '')
    const body = req.postDataJSON?.() ?? null
    calls.push({ path, body, headers: req.headers() })
    if (path === 'UaAuth/Login') return route.fulfill(ok({ success: true, requiresTotp: true, challengeId: 'C1', token: null }))
    if (path === 'UaAuth/VerifyTotp') return route.fulfill(ok({ success: true, token: 'tok-1', userId: 'P100', displayName: 'Promoter One', expiresAt: null }))
    if (path === 'MiniPos/Open') {
      if (door === 'notAssigned')
        return route.fulfill(refusal(403, 'MINIPOS_NOT_ASSIGNED_TODAY', 'You are not assigned to a pharmacy today.', 'لست مكلّفاً بصيدلية اليوم.'))
      if (door === 'locked') return route.fulfill(refusal(403, 'MINIPOS_NOT_UNLOCKED', 'Scan your pharmacy QR code.', 'امسح رمز QR.'))
      opens += 1
      if (door === 'faults' && opens === 1)
        return route.fulfill(ok({ outcome: 'refusedExisting', state: null, existing: { transactionId: 'TX9', customerName: 'Sara Al-Qahtani', lineCount: 1, openedAt: '2026-11-19T09:00:00', plant: 'S001' } }))
      lines = []
      customer = null
      return route.fulfill(ok({ outcome: 'opened', state: state('TX1', lines, customer), existing: null }))
    }
    // ----- the customer (4070) -----
    if (path.startsWith('MiniPos/MemberByMobile/')) return route.fulfill(refusal(404, 'LOY-00100', 'Customer does not exist.'))
    if (path === 'MiniPos/SignUpByBranch') return route.fulfill(ok(true))
    if (path === 'MiniPos/ConfirmSignUpByBranch') {
      if (body.otp !== '4321') return route.fulfill(refusal(400, 'LOY-00110', 'The code is not correct.'))
      return route.fulfill(ok(saraMember))
    }
    if (path === 'MiniPos/AttachCustomer') {
      customer = body.customerId === 'L77' ? sara : null
      return route.fulfill(ok(state(body.transactionId, lines, customer)))
    }
    // ----- the basket -----
    if (path === 'MiniPos/AddItem') {
      if (!customer) return route.fulfill(refusal(409, 'NO_CUSTOMER_ATTACHED', 'Attach a customer first.'))
      if (body.code === '111')
        return route.fulfill(refusal(422, 'MINIPOS_ITEM_PHARMACIST_ONLY', 'Sold by the pharmacist, please direct the customer to the counter.', 'يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.'))
      lines = [line()]
      return route.fulfill(ok(state(body.transactionId, lines, customer)))
    }
    if (path === 'MiniPos/ChangeQty') {
      lines = [line(body.newQty)]
      return route.fulfill(ok(state(body.transactionId, lines, customer)))
    }
    if (path === 'MiniPos/State') {
      stateReads += 1
      if (stateReads === 1) return route.fulfill(refusal(500, 'MINIPOS_STATE_FAILED', 'The basket could not be read.', 'تعذّرت قراءة السلة.'))
      lines = [line()]
      customer = sara
      return route.fulfill(ok(state('TX9', lines, customer)))
    }
    if (path === 'MiniPos/Submit') {
      if (door === 'faults')
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 409, success: false, message: 'This order was already submitted.', errors: [{ errorCode: 'SESSION_CLOSED', errorMessage: 'This order was already submitted.' }], data: { reason: 'submitted' } }),
        })
      return route.fulfill(ok({ outcome: 'submitted', documentNo: '1000001181', state: null }))
    }
    // ----- my orders today, reopen, resubmit (4071) -----
    if (path === 'MiniPos/MyOrdersToday')
      return route.fulfill(
        ok([
          { documentNo: '1000001190', status: 'held', enteredAt: '2026-11-19T10:12:00', netTotal: 46, storeCode: 'S001', customerId: 'L12' },
          { documentNo: '1000001181', status: 'open', enteredAt: '2026-11-19T09:05:00', netTotal: 46, storeCode: 'S001', customerId: 'L77' },
          { documentNo: '1000001170', status: 'paid', enteredAt: '2026-11-19T08:41:00', netTotal: 23, storeCode: 'S001', customerId: 'L12' },
        ]),
      )
    if (path === 'MiniPos/Reopen') {
      if (body.documentNo === '1000001190')
        return route.fulfill(refusal(409, 'MINIPOS_ORDER_AT_TILL', 'This order is open at a till. Ask the cashier to cancel it first.', 'هذا الطلب مفتوح لدى الكاشير. اطلب من الكاشير إلغاءه أولاً.'))
      lines = [line()]
      customer = sara
      return route.fulfill(ok({ documentNo: body.documentNo, state: state('TX2', lines, customer) }))
    }
    if (path === 'MiniPos/Resubmit') {
      resubmits += 1
      if (resubmits === 1) return route.abort('internetdisconnected')
      return route.fulfill(ok({ outcome: 'submitted', documentNo: '1000001181', state: null }))
    }
    return route.fulfill(refusal(404, 'DRIVE_UNSTUBBED', `unstubbed ${path}`, ''))
  })

  await page.goto(`${BASE}/minipos/`)
  await page.evaluate(() => localStorage.removeItem('minipos.session'))
  await page.goto(`${BASE}/minipos/`)
  await page.getByLabel('Username').fill('P100')
  await page.getByLabel('Password').fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).last().click()
  await page.getByLabel('Code').fill('123456')
  await page.getByRole('button', { name: 'Verify' }).click()

  const login = calls.find((c) => c.path === 'UaAuth/Login')
  check(login?.body?.channel === 'mobile' && login.headers['x-api-key'] === 'drive-key', `[${door}] sign-in asks the mobile channel, with the channel key`)

  if (door === 'notAssigned') {
    await page.locator('[data-screen="not-assigned"]').waitFor()
    check(await page.getByText('لست مكلّفاً بصيدلية اليوم.').isVisible(), '[notAssigned] "not assigned today", in the server’s Arabic too')
  } else if (door === 'locked') {
    await page.locator('[data-screen="unlock"]').waitFor()
    check(true, '[locked] a sign-in that has not unlocked lands on the unlock screen')
  } else if (door === 'faults') {
    // ----- #2: a refused basket read is shown, with Try again -----
    await page.getByRole('button', { name: 'Continue this basket' }).click()
    await page.locator('[data-refusal="MINIPOS_STATE_FAILED"]').waitFor()
    check(await page.getByRole('button', { name: 'Try again' }).isVisible(), '[faults] a refused basket read shows the refusal and Try again, not a blank screen')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-state-refused.png`, fullPage: true })
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.locator('[data-line="100045"]').waitFor()
    check(stateReads === 2, '[faults] Try again reads the basket again, and it shows')

    // ----- #3, #4: a submit refused SESSION_CLOSED goes back to the door, and the refusal is shown on what it opens -----
    await page.getByRole('button', { name: 'Submit order' }).click()
    await page.locator('[data-screen="customer"]').waitFor()
    check(opens === 2, '[faults] a submit refused SESSION_CLOSED goes back to the door, which opens anew')
    await page.locator('[data-refusal="SESSION_CLOSED"]').waitFor({ timeout: 3000 }).catch(() => {})
    check(await page.locator('[data-refusal="SESSION_CLOSED"]').isVisible(), '[faults] the SESSION_CLOSED refusal is shown on the new basket, not cleared unseen')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-session-closed.png`, fullPage: true })

    // ----- #9: the phone's language is its own -----
    await page.getByTitle('Switch to Arabic').click()
    await page.waitForFunction(() => document.documentElement.dir === 'rtl')
    const keys = await page.evaluate(() => ({ phone: localStorage.getItem('minipos.locale'), oms: localStorage.getItem('oms.locale') }))
    check(keys.phone === 'ar' && keys.oms === null, '[faults] the language switch writes the phone’s key, never OMS’s oms.locale')
    await page.evaluate(() => localStorage.removeItem('minipos.locale'))
  } else {
    // ----- the customer step, before the basket -----
    await page.locator('[data-screen="customer"]').waitFor()
    const open = calls.find((c) => c.path === 'MiniPos/Open')
    check(open?.headers.authorization === 'Bearer tok-1', '[open] the door gets the mobile bearer')
    check(!('storeCode' in (open?.body ?? {})), '[open] the phone sends no store')
    check(!(await page.getByLabel('Barcode or item number').count()), '[customer] no basket before a customer is attached')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-customer.png`, fullPage: true })

    await page.getByLabel('Mobile').fill('0551234567')
    await page.getByRole('button', { name: 'Find' }).click()
    await page.locator('[data-step="not-member"]').waitFor()
    check(true, '[customer] a mobile the server does not know offers the sign-up')
    await page.getByLabel('Messages in').selectOption('A')
    await page.getByRole('button', { name: 'Sign up: send the code' }).click()
    await page.locator('[data-step="code-sent"]').waitFor()
    const send = calls.find((c) => c.path === 'MiniPos/SignUpByBranch')
    check(send?.body.mobile === '0551234567' && send.body.countryCode === 'SA' && send.body.preferredLanguage === 'A' && !('branchId' in send.body), '[customer] the sign-up sends the mobile as typed, and no branch')

    await page.getByLabel('The code the customer received').fill('1111')
    await page.getByRole('button', { name: 'Confirm and sign up' }).click()
    await page.locator('[data-refusal="LOY-00110"]').waitFor()
    check(true, '[customer] a wrong code is the server’s refusal, shown')
    await page.getByLabel('The code the customer received').fill('4321')
    await page.getByRole('button', { name: 'Confirm and sign up' }).click()

    await page.getByLabel('Barcode or item number').waitFor()
    const attach = calls.find((c) => c.path === 'MiniPos/AttachCustomer')
    check(attach?.body.customerId === 'L77' && attach.body.transactionId === 'TX1', '[customer] the new member is attached to the basket')
    check((await page.locator('[data-customer="L77"]').innerText()).includes('Sara Al-Qahtani') && (await page.locator('[data-tier]').innerText()).includes('Gold'), '[basket] the member’s name and tier are shown')

    // ----- the basket -----
    await page.getByLabel('Barcode or item number').fill('111')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.locator('[data-refusal="MINIPOS_ITEM_PHARMACIST_ONLY"]').waitFor()
    check(await page.getByText('يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.').isVisible(), '[basket] the refusal shows in Arabic and English')

    await page.getByLabel('Barcode or item number').fill('6281234567893')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.locator('[data-line="100045"]').waitFor()
    const add = calls.filter((c) => c.path === 'MiniPos/AddItem').at(-1)
    check(add?.body.entryMode === 'typed' && add.body.reader === null && add.body.qty === 1 && add.body.transactionId === 'TX1', '[basket] a typed add carries entry mode typed and no reader')
    check(!('price' in add.body) && !('storeCode' in add.body), '[basket] the add carries no price and no store')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-basket.png`, fullPage: true })

    await page.getByRole('button', { name: 'Submit order' }).click()
    await page.locator('svg[data-barcode="1000001181"]').waitFor()
    check(await page.locator('[data-order-no="1000001181"]').isVisible(), '[submitted] the order number shows, under its barcode')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-submitted.png`, fullPage: true })

    // ----- my orders today -----
    await page.getByRole('button', { name: 'My orders today' }).last().click()
    await page.locator('[data-order="1000001181"]').waitFor()
    check(
      (await page.locator('[data-order="1000001190"] [data-status-label]').innerText()) === 'At a till' &&
        (await page.locator('[data-order="1000001181"] [data-status-label]').innerText()) === 'Open' &&
        (await page.locator('[data-order="1000001170"] [data-status-label]').innerText()) === 'Paid',
      '[orders] each order shows the server’s status',
    )
    check(!(await page.locator('[data-order="1000001170"]').getByRole('button', { name: 'Edit' }).count()), '[orders] a paid order offers no edit')

    await page.locator('[data-order="1000001190"]').getByRole('button', { name: 'Edit' }).click()
    await page.locator('[data-refusal="MINIPOS_ORDER_AT_TILL"]').waitFor()
    check(await page.getByText('هذا الطلب مفتوح لدى الكاشير. اطلب من الكاشير إلغاءه أولاً.').isVisible(), '[orders] a reopen while a till holds the order is refused, in both languages')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-orders.png`, fullPage: true })

    // ----- reopen, edit, resubmit through a lost connection -----
    await page.locator('[data-order="1000001181"]').getByRole('button', { name: 'Edit' }).click()
    await page.locator('[data-editing="1000001181"]').waitFor()
    check(await page.locator('[data-customer="L77"]').isVisible(), '[reopen] the order comes back with its customer, straight to the basket')
    await page.getByRole('button', { name: 'One more' }).click()
    await page.waitForFunction(() => document.querySelector('[data-line="100045"]')?.textContent?.includes('92.00'))
    check(calls.some((c) => c.path === 'MiniPos/ChangeQty' && c.body.transactionId === 'TX2' && c.body.newQty === 2), '[reopen] the edit is a verb on the reopened basket')

    await context.setOffline(true)
    await page.locator('[data-screen="no-connection"]').waitFor()
    check(await page.getByRole('button', { name: 'Resubmit order' }).isDisabled(), '[offline] "no connection" is shown and resubmit is held')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-offline.png`, fullPage: true })
    await context.setOffline(false)
    await page.getByRole('button', { name: 'Resubmit order' }).waitFor({ state: 'visible' })
    await page.waitForFunction(() => !document.querySelector('[data-submit]')?.hasAttribute('disabled'))

    await page.getByRole('button', { name: 'Resubmit order' }).click()
    await page.locator('[data-screen="no-connection"]').waitFor()
    check(await page.locator('[data-editing="1000001181"]').isVisible(), '[lost] a resubmit that never reached the server leaves the basket, saying "no connection"')
    await page.getByRole('button', { name: 'Resubmit order' }).click()
    await page.locator('svg[data-barcode="1000001181"]').waitFor()
    const sent = calls.filter((c) => c.path === 'MiniPos/Resubmit')
    check(sent.length === 2 && sent[0].body.requestId === sent[1].body.requestId && sent[0].body.transactionId === 'TX2', '[lost] the retry re-sends the SAME request id')
    check(!calls.some((c) => c.path === 'MiniPos/Submit' && c.body.transactionId === 'TX2'), '[resubmit] a reopened order is resubmitted, never minted again')
    check(await page.getByText('Order updated').isVisible(), '[resubmit] the same order number, updated')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-resubmitted.png`, fullPage: true })
  }
  if (SHOTS && door !== 'open') await page.screenshot({ path: `${SHOTS}/minipos-${door}.png`, fullPage: true })
  check(errors.length === 0, `[${door}] no page error${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
}

for (const door of ['notAssigned', 'locked', 'open', 'faults']) await run(door)
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed`)
  process.exit(1)
}
console.log('\nminipos drive: all checks passed')
