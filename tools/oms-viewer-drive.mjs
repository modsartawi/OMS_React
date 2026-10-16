// View-only OMS drive (ticket 521, BackOffice 2763) — drives the REAL app in Chromium against
// STUBBED envelopes. BackOffice 2763 split Document Details' grant: `canOpenDetail` now only reads,
// the change doors need `canChangeDetail` and `CreateReturn` needs `canCreateReturn`.
//
// ⚠️ Stubbed, never live: the ticket's live check (a session bound to OMS_VIEWER on staging) waits
// on the BackOffice seed and the 2763 SIS.Api deploy.
//
// Asserts, on delivery 8000000253 (category D) opened at /oms/delivery/…:
//   A. a viewer — the two flags absent (an older SIS.Api) and explicitly false — reads the delivery
//      (header, spine) and sees no Actions bar, no command, no note composer; R / C / N open nothing.
//   B. `canChangeDetail` alone: the six change commands and the composer, no Return document.
//   C. `canCreateReturn` alone: Return document only, no composer.
//   D. the list: a viewer's inspector has no act rows and R opens nothing; a changer's has three.
//   E. a stale grant: a 403 from Add note's door revokes `canChangeDetail` and the commands go.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/oms-viewer-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

const DOCS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCS[capture.data.documentNo] = capture.data
}
const DELIVERY = '8000000253'

const LIST_ROW = {
  deliveryNo: DELIVERY,
  documentNo: '1000000401',
  deliveryDocumentType: 'Forward',
  orderNo: '900101',
  storeCode: '1017',
  documentDate: '2026-10-02T00:00:00',
  deliveryType: 'Delivery',
  documentType: 'CLCN',
  documentSource: 'Web',
  entryTime: '2026-10-02T14:42:00',
  isActiveInStore: true,
  timeSlotDescription: '10:00 - 12:00',
  deliveryScheduleFromTime: '2026-10-02T10:00:00',
  deliveryScheduleToTime: '2026-10-02T12:00:00',
  customerName: 'Noura Al-Harbi',
  customerPhone: '0510008238',
  rescheduled: false,
  netTotal: 475.22,
  paidAmount: 475.22,
  deliveryFees: 25,
  amountDue: 0,
  readyStatus: '',
  clearStatus: '',
  deliveryStatus: '',
  closeStatus: '',
  failedJobsCount: 0,
}

const BASE_ACCESS = { canOpenList: true, canOpenDetail: true }
const CHANGE_KINDS = ['change-store', 'close', 'force-close', 'request-close', 'reschedule', 'add-note'].sort()

async function open(browser, access, { forbidWrites = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const writes = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = req.url().split('/api/')[1].split('?')[0]
    if (req.method() === 'POST') writes.push(p)
    if (req.method() === 'POST' && forbidWrites) return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1017' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope(access))
    if (p === 'SdDocumentWeb/DeliveryDocumentList') return route.fulfill(envelope([LIST_ROW]))
    const doc = /^SdDocumentWeb\/(Document|Delivery)\/([^/]+)$/.exec(p)
    if (doc && DOCS[doc[2]]) return route.fulfill(envelope(DOCS[doc[2]]))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    if (p.startsWith('Slots/AvailableSlots/')) return route.fulfill(envelope({ slots: [] }))
    if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(p) || /\/(Logs|Outbox|DonorRequests)$/.test(p))
      return route.fulfill(envelope([]))
    return route.fulfill(envelope(p.startsWith('SdDocumentWeb/') || p.startsWith('Slots/') ? [] : {}))
  })
  return { context, page, errors, writes }
}

async function openDelivery(page) {
  await page.goto(`${BASE}/oms/delivery/${DELIVERY}`)
  await page.locator('[data-now-line]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
}

const commandsOn = (page) =>
  page.locator('[data-command]').evaluateAll((els) => els.map((e) => e.getAttribute('data-command')).sort())
const actionsBar = (page) => page.getByRole('region', { name: 'Actions' })
const composer = (page) => page.locator('#note-composer')
const openDialogs = (page) => page.locator('dialog[open]').count()

async function run() {
  const browser = await chromium.launch()
  try {
    // A. viewers
    for (const [label, access] of [
      ['older SIS.Api (fields absent)', BASE_ACCESS],
      ['explicit false', { ...BASE_ACCESS, canChangeDetail: false, canCreateReturn: false }],
    ]) {
      const { context, page, errors, writes } = await open(browser, access)
      await openDelivery(page)
      check(`A ${label}: the delivery reads (number in the header)`, (await page.getByText(DELIVERY).count()) > 0)
      check(`A ${label}: no Actions bar`, (await actionsBar(page).count()) === 0)
      check(`A ${label}: no command at all`, (await commandsOn(page)).length === 0, JSON.stringify(await commandsOn(page)))
      check(`A ${label}: no note composer`, (await composer(page).count()) === 0)
      await page.locator('body').click({ position: { x: 5, y: 5 } })
      for (const key of ['r', 'c', 'n']) await page.keyboard.press(key)
      await page.waitForTimeout(300)
      check(`A ${label}: R / C / N open nothing`, (await openDialogs(page)) === 0 && writes.length === 0)
      check(`A ${label}: no page errors`, errors.length === 0, errors.join(' | '))
      await context.close()
    }

    // B. change only
    {
      const { context, page, errors } = await open(browser, { ...BASE_ACCESS, canChangeDetail: true })
      await openDelivery(page)
      const kinds = await commandsOn(page)
      check('B change only: the six change commands, no return', JSON.stringify(kinds) === JSON.stringify(CHANGE_KINDS), JSON.stringify(kinds))
      check('B change only: the note composer is there', (await composer(page).count()) === 1)
      await page.locator('body').click({ position: { x: 5, y: 5 } })
      await page.keyboard.press('r')
      await page.waitForTimeout(400)
      check('B change only: R opens the reschedule dialog', (await openDialogs(page)) === 1)
      check('B change only: no page errors', errors.length === 0, errors.join(' | '))
      await context.close()
    }

    // C. return only
    {
      const { context, page, errors } = await open(browser, { ...BASE_ACCESS, canCreateReturn: true })
      await openDelivery(page)
      const kinds = await commandsOn(page)
      check('C return only: Return document alone', JSON.stringify(kinds) === JSON.stringify(['return-document']), JSON.stringify(kinds))
      check('C return only: no note composer', (await composer(page).count()) === 0)
      check('C return only: no page errors', errors.length === 0, errors.join(' | '))
      await context.close()
    }

    // E. a stale grant: the probe says change, the door says 403 — the change commands go
    {
      const { context, page, errors, writes } = await open(browser, { ...BASE_ACCESS, canChangeDetail: true }, { forbidWrites: true })
      await openDelivery(page)
      await composer(page).fill('Customer called')
      await page.locator('[data-composer-post]').click()
      await page.waitForTimeout(800)
      check('E 403 on Add note: the note was posted once', writes.length === 1, JSON.stringify(writes))
      check('E 403 on Add note: the change commands and the composer are gone', (await commandsOn(page)).length === 0 && (await composer(page).count()) === 0, JSON.stringify(await commandsOn(page)))
      check('E 403 on Add note: the delivery still reads', (await page.getByText(DELIVERY).count()) > 0)
      check('E no page errors', errors.length === 0, errors.join(' | '))
      await context.close()
    }

    // D. the list's acts
    for (const [label, access, expected] of [
      ['viewer', BASE_ACCESS, 0],
      ['return only', { ...BASE_ACCESS, canCreateReturn: true }, 0],
      ['changer', { ...BASE_ACCESS, canChangeDetail: true }, 3],
    ]) {
      const { context, page, errors } = await open(browser, access)
      await page.goto(`${BASE}/oms/deliveries`)
      await page.waitForSelector('[data-grid-empty="before"]', { timeout: 20000 }).catch(() => {})
      await page.locator('[data-query-search]').click({ timeout: 20000 })
      await page.waitForSelector('.ag-row .ag-cell[col-id="deliveryNo"]', { timeout: 20000 })
      await page.locator('.ag-row .ag-cell[col-id="deliveryNo"]').first().click()
      await page.waitForTimeout(400)
      const acts = await page.locator('[data-inspector-act]').count()
      check(`D ${label}: ${expected} act rows in the inspector`, acts === expected, String(acts))
      if (expected === 0) {
        await page.keyboard.press('r')
        await page.waitForTimeout(400)
        check(`D ${label}: R stays on the list`, new URL(page.url()).pathname === '/oms/deliveries', page.url())
      }
      check(`D ${label}: no page errors`, errors.length === 0, errors.join(' | '))
      await context.close()
    }
  } finally {
    await browser.close()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run()
