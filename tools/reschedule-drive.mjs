// Reschedule drive (ticket 970, BackOffice spec 4354 "a reason on every reschedule") — drives the REAL
// app in Chromium against a STUBBED wire, serving a captured delivery from
// `.issues/assets/078-document-payloads/`.
//
// Asserts:
//   1. the dialog opens with no reason chosen, though the server's list has reasons;
//   2. save is off while no reason is chosen — clicking it posts nothing;
//   3. choosing a reason turns save on, and the move posts with that reason on the delivery door;
//   4. the reason is cleared again on the next open, and the day and time are seeded again (a reopen
//      onto an unchanged slot list once left the time cleared behind the first window on screen);
//   5. a move the server refuses (the coming no-reason refusal, BackOffice 4384) is toasted in the
//      server's own words.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/reschedule-drive.mjs          (DRIVE_PORT=<port> for another port;
//      PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
const DELIVERY = '8000000253'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message }] : [],
    data,
  }),
})

const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)
const SLOTS = {
  slots: [
    {
      day: 'SATURDAY',
      date: tomorrow,
      fullDay: `${tomorrow} SATURDAY`,
      times: [
        { time: '15:00 - 18:00', status: true, slotId: 'S15', slotFrom: `${tomorrow}T15:00:00`, slotTo: `${tomorrow}T18:00:00` },
      ],
    },
  ],
  handOverLimit: null,
}
const REASONS = [
  { reasonCode: 'CUST', reasonCategory: 'Customer', reasonDescription: 'Customer asked for another slot' },
  { reasonCode: 'STOR', reasonCategory: 'Store', reasonDescription: 'Store could not make the slot' },
]

const reasonSelect = (page) => page.locator('dialog[open] #reschedule-reason')
const commit = (page) => page.locator('dialog[open] [data-reschedule-commit]')
const openDialog = async (page) => {
  await page.locator('[data-command="reschedule"]').click()
  await reasonSelect(page).waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
}

async function run() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const wire = { posted: [], reschedule: () => envelope(true) }
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', 'DocumentDetails:03', 'DocumentDetails:02']))
    if (p.startsWith('Slots/AvailableSlots/')) return route.fulfill(envelope(SLOTS))
    if (p === 'Slots/RescheduleReasons') return route.fulfill(envelope(REASONS))
    if (p === 'SdDocumentWeb/RescheduleDelivery' || p === 'SdDocumentWeb/RescheduleDocument') {
      wire.posted.push({ path: p, body: JSON.parse(route.request().postData() || '{}') })
      return route.fulfill(wire.reschedule())
    }
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  await page.goto(`${BASE}/oms/delivery/${DELIVERY}`)
  await page.locator('section[aria-label="Actions"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)

  // 1. no reason on open
  await openDialog(page)
  const opened = {
    reason: await reasonSelect(page).inputValue(),
    day: await page.locator('dialog[open] #reschedule-day').inputValue(),
    time: await page.locator('dialog[open] #reschedule-time').inputValue(),
    shown: (await reasonSelect(page).evaluate((s) => s.options[s.selectedIndex]?.textContent ?? '')).trim(),
  }
  check(
    'the dialog opens with no reason chosen (the day and time are seeded, the reason is not)',
    opened.reason === '' && opened.day === '0' && opened.time === 'S15' && opened.shown === 'Choose a reason',
    JSON.stringify(opened),
  )

  // 2. save is off, a click posts nothing
  check('save is off while no reason is chosen', await commit(page).isDisabled())
  await commit(page).click({ force: true })
  await page.waitForTimeout(400)
  check(
    'trying to save posts nothing and keeps the dialog open',
    wire.posted.length === 0 && (await reasonSelect(page).count()) === 1,
    `posted=${wire.posted.length}`,
  )

  // 3. choose a reason, save
  await reasonSelect(page).selectOption('CUST')
  check('choosing a reason turns save on', !(await commit(page).isDisabled()))
  await commit(page).click()
  await page.waitForTimeout(800)
  const post = wire.posted.at(-1)
  check(
    'the move posts with the chosen reason, on the delivery door',
    wire.posted.length === 1 &&
      post.path === 'SdDocumentWeb/RescheduleDelivery' &&
      post.body.reasonCode === 'CUST' &&
      post.body.slotId === 'S15' &&
      post.body.documentNo === DELIVERY,
    JSON.stringify(post),
  )
  const done = await page.$$eval('[data-sonner-toast][data-type="success"]', (ts) => ts.map((t) => t.textContent))
  check('the move is toasted done', done.some((t) => t.includes('rescheduled')), JSON.stringify(done))

  // 4. cleared on the next open
  await openDialog(page)
  const reopened = {
    reason: await reasonSelect(page).inputValue(),
    day: await page.locator('dialog[open] #reschedule-day').inputValue(),
    time: await page.locator('dialog[open] #reschedule-time').inputValue(),
  }
  check(
    'the reason is cleared on the next open (the day and time are seeded again), and save is off',
    reopened.reason === '' && reopened.day === '0' && reopened.time === 'S15' && (await commit(page).isDisabled()),
    JSON.stringify(reopened),
  )

  // 5. the server's refusal is shown in its own words
  const REFUSAL = 'A reschedule needs a reason. Nothing was changed.'
  wire.reschedule = () =>
    envelope(null, { status: 400, success: false, message: REFUSAL, errorCode: 'RESCHEDULE_REASON_REQUIRED' })
  await reasonSelect(page).selectOption('STOR')
  await commit(page).click()
  await page.waitForTimeout(800)
  const refused = await page.$$eval('[data-sonner-toast][data-type="error"]', (ts) => ts.map((t) => t.textContent))
  check('a refused move is toasted with the server’s message', refused.some((t) => t.includes(REFUSAL)), JSON.stringify(refused))

  check('no page errors', errors.length === 0, errors.join(' | '))
  await browser.close()

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
