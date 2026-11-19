// Drive: the Mini POS phone app (oms 916, BackOffice spec 4063) against a stubbed SIS.Api, at phone size.
//
// Proves the wiring the unit tests cannot: the two-step mobile sign-in, the door's answer choosing the screen (not
// assigned today; unlock), the basket's typed add carrying its entry mode with the channel key and the bearer, a
// refusal shown in English and Arabic, and submit landing on the order barcode. The camera itself is the 3709 phone
// trial's (a headless browser has none).
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
  body: JSON.stringify({ statusCode: status, success: false, message: en, errors: [{ errorCode: code, errorMessage: en }], data: { messageEn: en, messageAr: ar } }),
})

const state = (lines) => ({
  contractVersion: '1.1',
  transactionId: 'TX1',
  version: lines.length + 1,
  etag: `e${lines.length}`,
  status: 'open',
  replayed: false,
  header: { plant: 'S001', plantName: 'Al Olaya', customer: { customerId: 'L1', name: 'Sara', mobile: '0551234567', loyaltyAttached: true } },
  lines,
  totals: { net: 40 * lines.length, vat: 6 * lines.length, gross: 46 * lines.length, payable: 46 * lines.length, deliveryFee: { amount: 0, waived: false, thresholdGross: 0, conditionType: '' } },
  firedPromotions: [],
  nearMisses: [],
  pendingConfirmation: null,
  capabilities: { canAddItem: true, canSubmit: lines.length > 0 },
})
const line = { lineId: 'L1', itemNumber: '100045', description: 'Sunscreen SPF50', description2: '', qty: 1, uom: 'EA', uomOptions: [], unitPrice: { net: 40, gross: 46 }, lineTotal: { net: 40, gross: 46 }, conditions: [], promotions: [], atpAtScan: { quantity: 9, frozenAt: null, known: true }, belowAtpAtScan: false, warnings: [] }

async function run(door) {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {})
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const calls = []
  let lines = []

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
      return route.fulfill(ok({ outcome: 'opened', state: state(lines), existing: null }))
    }
    if (path === 'MiniPos/AddItem') {
      if (body.code === '111')
        return route.fulfill(refusal(422, 'MINIPOS_ITEM_PHARMACIST_ONLY', 'Sold by the pharmacist, please direct the customer to the counter.', 'يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.'))
      lines = [line]
      return route.fulfill(ok(state(lines)))
    }
    if (path === 'MiniPos/Submit') return route.fulfill(ok({ outcome: 'submitted', documentNo: '1000001181', state: null }))
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
  } else {
    await page.getByLabel('Barcode or item number').waitFor()
    const open = calls.find((c) => c.path === 'MiniPos/Open')
    check(open?.headers.authorization === 'Bearer tok-1', '[open] the door gets the mobile bearer')
    check(!('storeCode' in (open?.body ?? {})), '[open] the phone sends no store')

    await page.getByLabel('Barcode or item number').fill('111')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.locator('[data-refusal="MINIPOS_ITEM_PHARMACIST_ONLY"]').waitFor()
    check(await page.getByText('يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.').isVisible(), '[basket] the refusal shows in Arabic and English')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/minipos-refusal.png`, fullPage: true })

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
  }
  if (SHOTS && door !== 'open') await page.screenshot({ path: `${SHOTS}/minipos-${door}.png`, fullPage: true })
  check(errors.length === 0, `[${door}] no page error${errors.length ? ': ' + errors.join(' | ') : ''}`)
  await browser.close()
}

for (const door of ['notAssigned', 'locked', 'open']) await run(door)
if (fails.length) {
  console.error(`\n${fails.length} check(s) failed`)
  process.exit(1)
}
console.log('\nminipos drive: all checks passed')
