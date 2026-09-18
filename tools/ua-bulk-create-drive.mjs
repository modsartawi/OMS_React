// Ua bulk create drive — External identities from a CSV. Mocked `/api/**`, real
// app, real browser (the tools/ua-channel-drive.mjs idiom). What it proves:
//   1. the vendor's own headers are read, and the preview blocks a bad email and
//      an admin role BEFORE anything is sent;
//   2. an id that already exists is skipped — NO upsert is ever posted for it;
//   3. every created row posts email channel, active, blank phone, and the role
//      is assigned AFTER its identity (the shell needs the identity first);
//   4. a refused role assignment leaves the row "role not assigned", and Retry
//      re-sends ONLY the assignment — never a second upsert;
//   5. a refused upsert is "not created" and never reaches the role door;
//   6. the results CSV carries every row with its outcome.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/ua-bulk-create-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const SHOTS = 'tools/.bulk-create-shots'
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
const refusal = (status, message, code) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: false, message, errors: code ? [code] : [], data: null }),
})

const CSV = [
  'ID Number,Full Name,Email Address,ROLE',
  '50385,Emad Ramadan,ramdanemad716@gmail.com,CALL_CENTER_AGENT', // created
  '2001,Clash With Staff,clash@gmail.com,CALL_CENTER_AGENT', // exists → skipped
  '50386,Bad Mail,not-an-email,CALL_CENTER_AGENT', // blocked
  '50387,Wants Admin,admin@gmail.com,AUTHZ_ADMIN', // blocked
  '50388,Role Refused,refused@gmail.com,call_center_agent', // roleFailed → retry ok
  '50389,Upsert Refused,upsert@gmail.com,CALL_CENTER_AGENT', // failed
  '50390,No Role,norole@gmail.com,', // created, no role
].join('\r\n')

const ROLES = [
  { roleName: 'CALL_CENTER_AGENT', description: '', isComposite: false, directHolderCount: 3, isProtected: false },
  { roleName: 'AUTHZ_ADMIN', description: '', isComposite: false, directHolderCount: 1, isProtected: true },
]

const calls = [] // ordered log of writes: ['upsert', id] | ['assign', id, role]
const upserts = {}
let refuse50388 = true

const browser = await chromium.launch()
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.route('**/api/**', async (route) => {
  const req = route.request()
  const path = req.url().split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
  if (path === 'UaAdminWeb/Access') return route.fulfill(envelope({ canOpen: true }))
  if (path === 'UaAdminWeb/ReportCounts')
    return route.fulfill(
      envelope({ allPeople: 1, notSeeded: 0, phoneGap: 0, awaitingActivation: 0, mustChangePassword: 0, disabled: 0 }),
    )
  if (path === 'AuthzAdminWeb/Roles') return route.fulfill(envelope(ROLES))
  if (path === 'UaAdminWeb/Employees' && req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}')
    calls.push(['upsert', body.employeeId])
    upserts[body.employeeId] = body
    if (body.employeeId === '50389') return route.fulfill(refusal(400, 'That does not look like an email address.', 'VALIDATION'))
    return route.fulfill(envelope({ success: true }))
  }
  if (path === 'AuthzAdminWeb/Users/AssignRole') {
    const body = JSON.parse(req.postData() || '{}')
    calls.push(['assign', body.userId, body.roleName])
    if (body.userId === '50388' && refuse50388) return route.fulfill(refusal(403, 'You may not assign this role.'))
    return route.fulfill(envelope({ success: true }))
  }
  const detail = /^UaAdminWeb\/Employees\/([^/]+)$/.exec(path)
  if (detail) {
    const id = decodeURIComponent(detail[1])
    return route.fulfill(envelope(id === '2001' ? { found: true, employeeId: '2001' } : { found: false }))
  }
  if (path === 'UaAdminWeb/Employees' || path.startsWith('UaAdminWeb/ReportCards/'))
    return route.fulfill(envelope({ rows: [], totalMatches: 0, rowCap: 50, isCapped: false }))
  return route.fulfill(envelope({}))
})

await page.goto(BASE + '/admin/ua-users')
await page.waitForSelector('main', { timeout: 20000 })
await page.getByRole('button', { name: /Bulk create/i }).click()
await page.locator('input[type=file]').setInputFiles({
  name: 'Call Center Agents.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('\uFEFF' + CSV, 'utf-8'),
})

// ---- 1 + 2. preview ---------------------------------------------------------
await page.getByRole('button', { name: /Create 4 identities/ }).waitFor({ timeout: 10000 })
const outcomes = async () =>
  Object.fromEntries(
    await page.$$eval('dialog tbody tr', (rows) =>
      rows.map((r) => [r.children[1].textContent.trim(), r.getAttribute('data-outcome')]),
    ),
  )
const preview = await outcomes()
check(
  'preview: 4 ready, existing id skipped, bad email + admin role blocked',
  JSON.stringify(preview) ===
    JSON.stringify({ 50385: 'ready', 2001: 'exists', 50386: 'blocked', 50387: 'blocked', 50388: 'ready', 50389: 'ready', 50390: 'ready' }),
  JSON.stringify(preview),
)
check('nothing is written by the preview', calls.length === 0, JSON.stringify(calls))
mkdirSync(SHOTS, { recursive: true })
await page.screenshot({ path: `${SHOTS}/preview.png` })

// ---- 3 + 5. run -------------------------------------------------------------
await page.getByRole('button', { name: /Create 4 identities/ }).click()
await page.getByRole('button', { name: /Download results CSV/ }).waitFor({ timeout: 15000 })
const after = await outcomes()
check(
  'run: created / role not assigned / not created, per row',
  after['50385'] === 'created' && after['50388'] === 'roleFailed' && after['50389'] === 'failed' && after['50390'] === 'created' && after['2001'] === 'exists',
  JSON.stringify(after),
)
check('the existing id was never upserted', !('2001' in upserts) && !('50386' in upserts) && !('50387' in upserts))
const u = upserts['50385']
check(
  'every create is email channel, active, blank phone',
  Object.values(upserts).every((b) => b.deliveryChannel === 'email' && b.isActive === true && b.phone === '') &&
    u.email === 'ramdanemad716@gmail.com' && u.displayName === 'Emad Ramadan',
  JSON.stringify(u),
)
check(
  'the role is assigned after its identity, in the catalog spelling, and never for a failed upsert',
  JSON.stringify(calls) ===
    JSON.stringify([
      ['upsert', '50385'], ['assign', '50385', 'CALL_CENTER_AGENT'],
      ['upsert', '50388'], ['assign', '50388', 'CALL_CENTER_AGENT'],
      ['upsert', '50389'],
      ['upsert', '50390'],
    ]),
  JSON.stringify(calls),
)
const refusedText = await page.locator('dialog tbody tr[data-outcome="roleFailed"]').textContent()
check('the refusal message is shown on the row', refusedText.includes('You may not assign this role.'), refusedText)
await page.screenshot({ path: `${SHOTS}/done.png` })

// ---- 6. results CSV ---------------------------------------------------------
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: /Download results CSV/ }).click(),
])
const file = readFileSync(await download.path(), 'utf-8')
check(
  'results CSV has every row and its outcome',
  file.split('\r\n').filter((l) => l.startsWith('"=""')).length === 7 &&
    file.includes('Already exists — skipped') && file.includes('Created — role not assigned') && file.includes('Not created'),
  download.suggestedFilename(),
)

// ---- 4. retry the role only -------------------------------------------------
refuse50388 = false
const before = calls.length
await page.getByRole('button', { name: /Retry role assignment \(1\)/ }).click()
await page.waitForFunction(() => !document.querySelector('dialog tbody tr[data-outcome="roleFailed"]'), null, { timeout: 10000 })
check(
  'retry re-sends only the assignment, and the row becomes created',
  JSON.stringify(calls.slice(before)) === JSON.stringify([['assign', '50388', 'CALL_CENTER_AGENT']]) &&
    (await outcomes())['50388'] === 'created',
  JSON.stringify(calls.slice(before)),
)

check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
