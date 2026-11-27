// Reschedule drive (ticket 970, BackOffice spec 4354 "a reason on every reschedule"; reconciled with BackOffice 4384)
// — drives the REAL app against a STUBBED wire, serving a captured delivery from
// `.issues/assets/078-document-payloads/`. Run left to right and right to left (`oms.locale = 'ar'` sets dir="rtl";
// the words stay English, as on every screen, until Arabic is switched on). `ar/document.json` is checked to hold an
// Arabic word for each of the dialog's English ones.
//
// Asserts, in each direction:
//   1. the dialog opens with no reason chosen, though the server's list (`GET Slots/RescheduleReasons`) has reasons;
//   2. save is off while no reason is chosen — clicking it posts nothing;
//   3. choosing a reason turns save on, and the move posts with that reason on the delivery door;
//   4. the reason is cleared again on the next open, and the day and time are seeded again (a reopen
//      onto an unchanged slot list once left the time cleared behind the first window on screen);
//   5. the server's refusal of a move with no reason — BackOffice 4384's `SDS-00054`
//      (`SdDocumentScheduleErrorCodes.RescheduleReasonRequired`, a 400 in the usual envelope) — is toasted in the
//      user's language with its code; any other refusal (`SDS-00053`, an unknown reason) in the server's own words.
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
const WORDS = {
  en: JSON.parse(readFileSync('src/locales/en/document.json', 'utf8')),
  ar: JSON.parse(readFileSync('src/locales/ar/document.json', 'utf8')),
}

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
    errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: message }] : [],
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
// BackOffice 4384's refusal, exactly as `SdDocumentService_MoveReason.RefuseRescheduleWithNoReason` throws it.
const NO_REASON = { code: 'SDS-00054', message: 'A reschedule needs a reason: choose why the delivery moves.' }
const UNKNOWN_REASON = { code: 'SDS-00053', message: 'Reschedule reason does not exist.' }

const reasonSelect = (page) => page.locator('dialog[open] #reschedule-reason')
const commit = (page) => page.locator('dialog[open] [data-reschedule-commit]')
const openDialog = async (page) => {
  await page.locator('[data-command="reschedule"]').click()
  await reasonSelect(page).waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
}
const toasts = (page, type) => page.$$eval(`[data-sonner-toast][data-type="${type}"]`, (ts) => ts.map((t) => t.textContent ?? ''))
const plain = (s) => s.replace(/[⁦-⁩]/g, '')

async function pass(browser, lang) {
  const L = lang.toUpperCase()
  // i18next's `lng` stays `en` (`src/core/i18n.ts`): `oms.locale = 'ar'` turns the page right to left, its words stay
  // English until Arabic is switched on, so both passes read the English words; `ar/document.json` is checked below.
  const w = WORDS.en
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.addInitScript((l) => localStorage.setItem('oms.locale', l), lang)
  const page = await context.newPage()
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
  await page.locator('[data-command="reschedule"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
  check(`${L} the page reads in its direction`, (await page.getAttribute('html', 'dir')) === (lang === 'ar' ? 'rtl' : 'ltr'))

  // 1. no reason on open
  await openDialog(page)
  const opened = {
    reason: await reasonSelect(page).inputValue(),
    day: await page.locator('dialog[open] #reschedule-day').inputValue(),
    time: await page.locator('dialog[open] #reschedule-time').inputValue(),
    shown: (await reasonSelect(page).evaluate((s) => s.options[s.selectedIndex]?.textContent ?? '')).trim(),
  }
  check(
    `${L} the dialog opens with no reason chosen (the day and time are seeded, the reason is not)`,
    opened.reason === '' && opened.day === '0' && opened.time === 'S15' && opened.shown === w.reschedule.reasonPlaceholder,
    JSON.stringify(opened),
  )
  check(
    `${L} the dialog says why save is off, in its own words`,
    (await page.locator('dialog[open]').textContent()).includes(w.reschedule.reasonNeeded),
  )

  // 2. save is off, a click posts nothing
  check(`${L} save is off while no reason is chosen`, await commit(page).isDisabled())
  await commit(page).click({ force: true })
  await page.waitForTimeout(400)
  check(
    `${L} trying to save posts nothing and keeps the dialog open`,
    wire.posted.length === 0 && (await reasonSelect(page).count()) === 1,
    `posted=${wire.posted.length}`,
  )

  // 3. choose a reason, save
  await reasonSelect(page).selectOption('CUST')
  check(`${L} choosing a reason turns save on`, !(await commit(page).isDisabled()))
  await commit(page).click()
  await page.waitForTimeout(800)
  const post = wire.posted.at(-1)
  check(
    `${L} the move posts with the chosen reason, on the delivery door`,
    wire.posted.length === 1 &&
      post.path === 'SdDocumentWeb/RescheduleDelivery' &&
      post.body.reasonCode === 'CUST' &&
      post.body.slotId === 'S15' &&
      post.body.documentNo === DELIVERY,
    JSON.stringify(post),
  )
  const done = await toasts(page, 'success')
  check(`${L} the move is toasted done`, done.some((t) => t.includes(w.reschedule.doneDetail)), JSON.stringify(done))

  // 4. cleared on the next open
  await openDialog(page)
  const reopened = {
    reason: await reasonSelect(page).inputValue(),
    day: await page.locator('dialog[open] #reschedule-day').inputValue(),
    time: await page.locator('dialog[open] #reschedule-time').inputValue(),
  }
  check(
    `${L} the reason is cleared on the next open (the day and time are seeded again), and save is off`,
    reopened.reason === '' && reopened.day === '0' && reopened.time === 'S15' && (await commit(page).isDisabled()),
    JSON.stringify(reopened),
  )

  // 5. the server's no-reason refusal (SDS-00054), worded in the user's language with its code
  wire.reschedule = () => envelope(null, { status: 400, success: false, message: NO_REASON.message, errorCode: NO_REASON.code })
  await reasonSelect(page).selectOption('STOR')
  await commit(page).click()
  await page.waitForTimeout(800)
  const refused = (await toasts(page, 'error')).map(plain)
  const worded = w.reschedule.reasonRefused.replace('{{code}}', NO_REASON.code)
  check(
    `${L} the no-reason refusal (${NO_REASON.code}) is toasted in the page's words with its code`,
    refused.some((t) => t.includes(worded)),
    JSON.stringify(refused),
  )
  const codeIsolated = await page.$$eval('[data-sonner-toast][data-type="error"]', (ts) =>
    ts.some((t) => /⁨SDS-00054⁩/.test(t.textContent ?? '')),
  )
  check(`${L} the code inside the sentence is isolated (FSI…PDI)`, codeIsolated)

  // 5b. any other refusal keeps the server's own words
  wire.reschedule = () =>
    envelope(null, { status: 400, success: false, message: UNKNOWN_REASON.message, errorCode: UNKNOWN_REASON.code })
  await openDialog(page)
  await reasonSelect(page).selectOption('CUST')
  await commit(page).click()
  await page.waitForTimeout(800)
  const other = await toasts(page, 'error')
  check(`${L} another refusal (${UNKNOWN_REASON.code}) is toasted in the server's own words`, other.some((t) => t.includes(UNKNOWN_REASON.message)), JSON.stringify(other))

  check(`${L} no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function run() {
  // The dialog's Arabic words wait in `ar/document.json`, one for every English one, `{{code}}` kept.
  const missing = Object.keys(WORDS.en.reschedule).filter((k) => !WORDS.ar.reschedule?.[k])
  check('the dialog has an Arabic word for every English one', missing.length === 0, missing.join(', '))
  check('the Arabic refusal keeps its code', (WORDS.ar.reschedule?.reasonRefused ?? '').includes('{{code}}'))

  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
  for (const lang of ['en', 'ar']) await pass(browser, lang)
  await browser.close()

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
