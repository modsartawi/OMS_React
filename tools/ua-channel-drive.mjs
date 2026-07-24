// Ua delivery-channel drive (ticket 722) — proves an administrator can put a
// person on email from this screen alone, and that a person on email with no
// address is VISIBLE rather than silently accepted.
//
// There is no unit runner in this repo yet, so the proof is the same idiom as
// tools/status-badge-drive.mjs: mocked `/api/**`, real app, real browser. What it
// asserts, one per the ticket's Proof list:
//   1. create with an email + the email channel round-trips to the API — the
//      captured POST body is checked field by field, not just "a call happened";
//   2. the channel selector DEFAULTS to sms on a new identity;
//   3. an existing identity switches sms→email and email→sms, both directions
//      reaching the API;
//   4. an identity marked email with no address is flagged — in the grid pill,
//      in the derived status, and as an alert in the detail pane.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/ua-channel-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const SHOTS = 'tools/.channel-shots'

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

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

const ROW = (employeeId, over) => ({
  employeeId,
  displayName: `Person ${employeeId}`,
  phone: '0500000000',
  phoneClass: 'usable',
  email: '',
  deliveryChannel: 'sms',
  isActive: true,
  isSeeded: true,
  credentialState: 'active',
  isTotpEnrolled: false,
  lastLoginAt: '2026-07-01T09:00:00',
  ...over,
})

// 2001 is the estate default; 2002 is the Egypt team done right; 2003 is the
// decoy the server accepts and this screen has to expose.
const ROWS = [
  ROW('2001', {}),
  ROW('2002', { deliveryChannel: 'email', email: 'collector@dmsco-eg.com' }),
  ROW('2003', { deliveryChannel: 'email', email: '', credentialState: 'none' }),
]
const byId = Object.fromEntries(ROWS.map((r) => [r.employeeId, r]))

const STATUS = (row) => ({
  found: true,
  employeeId: row.employeeId,
  displayName: row.displayName,
  phone: row.phone,
  phoneClass: row.phoneClass,
  email: row.email,
  deliveryChannel: row.deliveryChannel,
  isActive: row.isActive,
  createdAt: '2026-01-01T08:00:00',
  updatedAt: '2026-07-01T08:00:00',
  disabledAt: null,
  disabledBy: '',
  credentialState: row.credentialState,
  credentialCreatedAt: null,
  isTotpEnrolled: row.isTotpEnrolled,
  lastLoginAt: row.lastLoginAt,
})

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()))

// Every upsert body the screen sends, in order.
const upserts = []

await page.route('**/api/**', async (route) => {
  const req = route.request()
  const path = req.url().split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
  if (path === 'UaAdminWeb/Access') return route.fulfill(envelope({ canOpen: true }))
  if (path === 'UaAdminWeb/ReportCounts')
    return route.fulfill(
      envelope({ allPeople: 3, notSeeded: 0, phoneGap: 0, awaitingActivation: 1, mustChangePassword: 0, disabled: 0 }),
    )
  if (path === 'UaAdminWeb/Employees' && req.method() === 'POST') {
    upserts.push(JSON.parse(req.postData() || '{}'))
    return route.fulfill(envelope({ success: true }))
  }
  if (path.startsWith('UaAdminWeb/ReportCards/') || path === 'UaAdminWeb/Employees')
    return route.fulfill(envelope({ rows: ROWS, totalMatches: ROWS.length, rowCap: 50, isCapped: false }))
  const detail = /^UaAdminWeb\/Employees\/([^/]+)$/.exec(path)
  if (detail) {
    const row = byId[decodeURIComponent(detail[1])]
    return route.fulfill(row ? envelope(STATUS(row)) : envelope({ found: false }))
  }
  if (path.endsWith('/Sessions')) return route.fulfill(envelope([]))
  if (path.endsWith('/Audit')) return route.fulfill(envelope({ entries: [], totalEntries: 0, rowCap: 50, isCapped: false }))
  return route.fulfill(envelope({}))
})

await page.goto(BASE + '/admin/ua-users')
await page.waitForSelector('main', { timeout: 20000 })

// ---- 2. the selector defaults to SMS on a new identity ----------------------
await page.getByRole('button', { name: /New identity/i }).click()
await page.waitForSelector('#ni-channel', { timeout: 10000 })
const defaultChannel = await page.locator('#ni-channel').inputValue()
check('a new identity defaults to the sms channel', defaultChannel === 'sms', defaultChannel)

// A pristine form is not yet a person about to be created unreachable.
check('an empty create form raises no alarm', (await page.locator('[role="alert"]').count()) === 0)

// The blank-address alert fires the moment email is chosen, before any save.
await page.locator('#ni-id').fill('2004')
await page.locator('#ni-channel').selectOption('email')
const warnedInModal = await page.locator('[role="alert"]').first().isVisible()
check('choosing email with a blank address warns in the create modal', warnedInModal)

// ---- 1. create with an email on the email channel round-trips --------------
await page.locator('#ni-name').fill('Cairo Collector')
await page.locator('#ni-phone').fill('0100000000')
await page.locator('#ni-email').fill('cairo@dmsco-eg.com')
await page.getByRole('button', { name: /^Create$/ }).click()
await page.waitForTimeout(500)
const created = upserts.at(-1)
check(
  'create posts the email AND the email channel',
  !!created && created.employeeId === '2004' && created.email === 'cairo@dmsco-eg.com' && created.deliveryChannel === 'email',
  JSON.stringify(created),
)

// ---- 1b. an untouched channel/address is OMITTED, not sent blank ------------
// POST Employees is an upsert, so a "New identity" on an id that already exists
// edits that person: sending ''/'sms' unasked would clear a stored Egypt address
// and put them back on a channel that cannot reach them (721's null rule).
await page.getByRole('button', { name: /New identity/i }).click()
await page.waitForSelector('#ni-channel', { timeout: 10000 })
await page.locator('#ni-id').fill('2005')
await page.locator('#ni-name').fill('Riyadh Collector')
await page.locator('#ni-phone').fill('0500000001')
await page.getByRole('button', { name: /^Create$/ }).click()
await page.waitForTimeout(500)
const plain = upserts.at(-1)
check(
  'a plain sms create omits email and deliveryChannel entirely',
  !!plain && plain.employeeId === '2005' && !('email' in plain) && !('deliveryChannel' in plain),
  JSON.stringify(plain),
)

// ---- 4. the decoy is flagged in the grid -----------------------------------
await page.getByRole('button', { name: /People/i }).first().click()
await page.waitForSelector('tbody tr', { timeout: 10000 })
const cells = await page.$$eval('tbody tr', (rows) =>
  rows.map((r) => ({
    id: r.children[0].textContent.trim(),
    channel: r.children[3].textContent.trim(),
    status: r.children[4].textContent.trim(),
  })),
)
const std = cells.find((c) => c.id === '2001')
const egypt = cells.find((c) => c.id === '2002')
const decoy = cells.find((c) => c.id === '2003')
check('the grid names the channel each person is on', std?.channel === 'SMS' && egypt?.channel === 'Email', JSON.stringify(cells))
check('email with no address is flagged in the grid', decoy?.channel === 'Email — no address', decoy?.channel)
check(
  'email with no address blocks activation as no-email, not no-phone',
  decoy?.status === 'Blocked — no email',
  decoy?.status,
)

// ---- 4b. and in the detail pane --------------------------------------------
await page.getByText('Person 2003').first().click()
await page.waitForSelector('#ud-channel', { timeout: 10000 })
check('the detail pane alerts on email with no address', await page.locator('[role="alert"]').first().isVisible())
mkdirSync(SHOTS, { recursive: true })
await page.screenshot({ path: `${SHOTS}/ua-channel-flagged.png` })

// The alert answers the PENDING edit, not the last server read — typing the
// address clears it before any save, and emptying the phone box on the sms
// channel raises its twin.
await page.locator('#ud-email').fill('cairo2@dmsco-eg.com')
check('typing an address clears the alert before the save', (await page.locator('[role="alert"]').count()) === 0)
await page.locator('#ud-channel').selectOption('sms')
await page.locator('#ud-phone').fill('')
check('emptying the mobile on the sms channel alerts too', await page.locator('[role="alert"]').first().isVisible())

// ---- 3. an existing identity switches BOTH directions ----------------------
await page.getByText('Person 2001').first().click()
await page.waitForSelector('#ud-channel', { timeout: 10000 })
check('the detail select shows the stored channel', (await page.locator('#ud-channel').inputValue()) === 'sms')
await page.locator('#ud-channel').selectOption('email')
await page.getByRole('button', { name: /^Save$/ }).click()
await page.waitForTimeout(500)
const toEmail = upserts.at(-1)
check(
  'sms → email reaches the API with the phone and address intact',
  toEmail?.employeeId === '2001' && toEmail?.deliveryChannel === 'email' && toEmail?.phone === '0500000000',
  JSON.stringify(toEmail),
)

// A mobile-only edit must not carry the other two: '' and 'sms' are the CLEAR
// and an explicit channel write, so mirroring untouched boxes back would let a
// phone fix wipe an Egypt address.
await page.getByText('Person 2002').first().click()
await page.waitForSelector('#ud-channel', { timeout: 10000 })
await page.locator('#ud-phone').fill('0500000009')
await page.getByRole('button', { name: /^Save$/ }).click()
await page.waitForTimeout(500)
const phoneOnly = upserts.at(-1)
check(
  'a mobile-only edit omits the address and the channel',
  phoneOnly?.phone === '0500000009' && !('email' in phoneOnly) && !('deliveryChannel' in phoneOnly),
  JSON.stringify(phoneOnly),
)

await page.getByText('Person 2001').first().click()
await page.waitForSelector('#ud-channel', { timeout: 10000 })
await page.getByText('Person 2002').first().click()
await page.waitForSelector('#ud-channel', { timeout: 10000 })
check('an email-channel person loads as email', (await page.locator('#ud-channel').inputValue()) === 'email')
await page.locator('#ud-channel').selectOption('sms')
await page.getByRole('button', { name: /^Save$/ }).click()
await page.waitForTimeout(500)
const toSms = upserts.at(-1)
check(
  // The address is kept by NOT being sent: '' would be the clear, and the
  // administrator only switched the channel.
  'email → sms reaches the API without touching the address',
  toSms?.employeeId === '2002' && toSms?.deliveryChannel === 'sms' && !('email' in toSms),
  JSON.stringify(toSms),
)

check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
