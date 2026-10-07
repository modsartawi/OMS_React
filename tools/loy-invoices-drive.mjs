// Loy Invoices tab drive (ticket 428, spec 2443) — the member screen's Invoices tab and
// its Resend, driven in Chromium against MOCKED `LoyWeb/*` envelopes in the shapes of
// BackOffice 2446 (the read) and 2445 (the requeue). 🚩 NOTHING here is driven against a
// live SIS.Api; the live walk waits on 2445 + 2446 (BackOffice 2447).
//
//   1. the list: one row per receipt, each status worded (a skip names its reason, the
//      never-queued sentence says why), the online order's email named as such;
//   2. Resend shows only on resendable rows; the dialog names the receipt and the
//      address and asks for no case reference;
//   3. Resend → Queued: POST on the receipt's route with an empty body, the toast,
//      and the tab re-read showing the receipt waiting in the queue;
//   4. AlreadyQueued says it is already waiting;
//   5. a refusal is drawn inside the dialog in the server's words, nothing re-read;
//   6. 🚩 a look-only session sees the statuses and no Resend column;
//   7. an empty window has its own sentence; a failed read fails inside the tab with
//      a Retry that re-reads.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/loy-invoices-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

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

const LOYID = '100001293'
const MEMBER = {
  loyId: LOYID,
  mobileCountry: 'SA',
  mobile: '966555000111',
  fullName: 'Nouf Al-Harbi',
  birthDate: '1990-11-08T00:00:00',
  gender: 'F',
  email: 'nouf.h@example.com',
  nationality: 'SA',
  nationalId: null,
  insuranceCompany: null,
  cityCode: 'RUH',
  preferredLanguage: 'AR',
  joinDate: '2021-03-14T00:00:00',
  lastUpdate: '2026-07-31T09:12:00',
  tier: 'G',
  tierPointsBalance: 0,
  pendingPoints: 0,
  pointsBalance: 0,
  pointsBalanceAmount: 0,
  pointsBalanceAmountCurrency: 'SAR',
  pointsExpireSoon: 0,
  memberType: 'M',
  blockedReason: null,
  isBlocked: false,
  isArchived: false,
}

const receipt = (trxNumber, over) => ({
  storeCode: '1001',
  trxNumber,
  trxDate: '2026-10-01T00:00:00',
  documentType: 1,
  status: 'Sent',
  skipReason: null,
  lastAttemptAt: '2026-10-01T10:12:00',
  recipient: 'nouf.h@example.com',
  recipientSource: 'Profile',
  resendable: true,
  notResendableReason: null,
  ...over,
})
const freshRows = () => [
  receipt('000101', { status: 'Skipped', skipReason: 'NO_EMAIL' }),
  receipt('000102', { status: 'Sent', recipient: 'order.buyer@example.com', recipientSource: 'Order' }),
  receipt('000103', { status: 'Queued', resendable: false, notResendableReason: 'QUEUED', lastAttemptAt: null }),
  receipt('000104', { status: 'NotQueued', resendable: false, notResendableReason: 'NOT_QUEUED', lastAttemptAt: null, recipient: null, recipientSource: null }),
  receipt('000105', { status: 'Failed' }),
  receipt('000106', { status: 'Skipped', skipReason: 'INVALID_EMAIL', resendable: false, notResendableReason: 'INVALID_EMAIL', recipient: null, recipientSource: null }),
]

let state = { edit: true, rows: freshRows(), read: 'ok' }
let invoiceReads = 0
let actionReads = 0
let requeues = []

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = req.url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'LoyWeb/Access')
      return route.fulfill(envelope({ canOpenLoyMember: true, canEditLoyMember: state.edit, canRemoveLoyMemberMobile: false }))
    if (path === `LoyWeb/Member/${LOYID}`) return route.fulfill(envelope(MEMBER))
    if (path === `LoyWeb/Reports/Invoices/${LOYID}`) {
      invoiceReads += 1
      if (state.read === 'throws') return route.fulfill({ status: 500, body: 'boom' })
      return route.fulfill(envelope(state.read === 'empty' ? [] : state.rows))
    }
    const requeue = path.match(/^LoyWeb\/Member\/(\d+)\/Invoices\/([^/]+)\/([^/]+)\/Requeue$/)
    if (requeue && req.method() === 'POST') {
      const trx = decodeURIComponent(requeue[3])
      requeues.push({ loyId: requeue[1], store: decodeURIComponent(requeue[2]), trx, body: req.postData() })
      if (trx === '000105')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'There is no valid email on the profile — fix it on the Profile tab first.',
            errors: [{ errorCode: 'LOY-00460', errorMessage: 'There is no valid email on the profile — fix it on the Profile tab first.' }],
          }),
        )
      const row = state.rows.find((r) => r.trxNumber === trx)
      const already = row?.status === 'Queued'
      if (row) Object.assign(row, { status: 'Queued', resendable: false, notResendableReason: 'QUEUED' })
      return route.fulfill(envelope({ result: already ? 'AlreadyQueued' : 'Queued', recipient: row?.recipient ?? '', recipientSource: 'Profile' }))
    }
    if (path === 'LoyWeb/Reports/LoyMemberActions') {
      actionReads += 1
      return route.fulfill(envelope({ records: [], currentPage: 1, pageSize: 25, pageRecordsCount: 0, totalPages: 0, recordsCount: 0 }))
    }
    if (path.startsWith('LoyWeb/Reports/')) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const cell = (trx, col) => page.locator(`.ag-row[row-id^="1001|${trx}|"] [col-id="${col}"]`).first()
  const cellText = async (trx, col) => ((await cell(trx, col).textContent()) ?? '').trim()
  const resendButtons = () => page.locator('[data-testid="loy-invoice-resend"]')
  const dialog = page.getByRole('dialog')
  /** Distinct receipts drawn — AG Grid repeats a row in each of its containers. */
  const rowCount = () =>
    page.$$eval('.ag-row[row-id]', (els) => new Set(els.map((e) => e.getAttribute('row-id'))).size)

  // ---- 1: the list ------------------------------------------------------------
  await page.goto(`${BASE}/loy/members/${LOYID}?tab=invoices`)
  await page.locator('.ag-row').first().waitFor({ timeout: 15000 })
  check('the Invoices tab sits after Sales and before Actions',
    JSON.stringify(await page.getByRole('tab').allTextContents()) === JSON.stringify(['Profile', 'Activities', 'Sales', 'Invoices', 'Actions']),
    JSON.stringify(await page.getByRole('tab').allTextContents()))
  check('one row per receipt', (await rowCount()) === 6)
  check('a skip names its reason', (await cellText('000101', 'status')) === 'Skipped: no email on the profile', await cellText('000101', 'status'))
  check('the never-queued sentence says why', /insurance, credit and non-emailing stores' invoices are never emailed/.test(await cellText('000104', 'status')))
  check('a receipt the rail would skip now says why beside the address', /No address to send to\s*\(would be skipped: the email address is not valid\)/.test(await cellText('000106', 'recipient')), await cellText('000106', 'recipient'))
  check('waiting reads as waiting', (await cellText('000103', 'status')) === 'Waiting in the queue')
  check('an e-commerce receipt names the online order’s email', /order\.buyer@example\.com\s*the online order's email/.test(await cellText('000102', 'recipient')), await cellText('000102', 'recipient'))
  check('the address is isolated as a machine value', (await cell('000101', 'recipient').locator('bdi[dir="ltr"]').count()) === 1)
  check('no address reads as such', (await cellText('000104', 'recipient')) === 'No address to send to')

  // ---- 2: Resend only where offered ------------------------------------------
  check('Resend shows on the three resendable rows only', (await resendButtons().count()) === 3, String(await resendButtons().count()))
  check('🚩 no Resend on a waiting, a never-queued or a not-resendable row',
    (await cell('000103', 'resend').locator('button').count()) === 0 &&
      (await cell('000104', 'resend').locator('button').count()) === 0 &&
      (await cell('000106', 'resend').locator('button').count()) === 0)

  // ---- 3: Resend → Queued -------------------------------------------------------
  // Open Actions once first: it then sits in the cache, so a read on returning to it
  // can only come from the requeue's invalidation.
  await page.getByRole('tab', { name: 'Actions' }).click()
  await page.getByText('No actions recorded for this member.').waitFor({ timeout: 5000 })
  await page.getByRole('tab', { name: 'Invoices' }).click()
  await page.locator('.ag-row').first().waitFor({ timeout: 10000 })
  await cell('000101', 'resend').locator('button').click()
  await dialog.waitFor({ timeout: 5000 })
  check('the dialog names the receipt as store · receipt', ((await page.getByTestId('loy-invoice-resend-receipt').textContent()) ?? '').trim() === '1001 · 000101')
  check('the dialog names the address', /nouf\.h@example\.com/.test((await page.getByTestId('loy-invoice-resend-recipient').textContent()) ?? ''))
  check('🚩 no case reference is asked for', (await dialog.locator('input, textarea').count()) === 0)
  const readsBefore = invoiceReads
  const actionsBefore = actionReads
  await page.getByTestId('loy-invoice-resend-confirm').click()
  await page.getByText(/Invoice queued for .*nouf\.h@example\.com.*It will be emailed within a few minutes\./).waitFor({ timeout: 5000 })
  check('POST on the receipt’s route with an empty body',
    requeues.length === 1 && requeues[0].loyId === LOYID && requeues[0].store === '1001' && requeues[0].trx === '000101' && requeues[0].body === '{}',
    JSON.stringify(requeues))
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 5000 })
  check('the dialog closes on success', (await dialog.count()) === 0)
  await page.waitForTimeout(500)
  check('the tab is re-read', invoiceReads === readsBefore + 1, `${readsBefore} → ${invoiceReads}`)
  check('and the receipt now reads waiting, with no Resend', (await cellText('000101', 'status')) === 'Waiting in the queue' && (await cell('000101', 'resend').locator('button').count()) === 0)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await page.getByText('No actions recorded for this member.').waitFor({ timeout: 5000 })
  check('🚩 the Actions trail, already cached, is read again after the requeue', actionReads === actionsBefore + 1, `${actionsBefore} → ${actionReads}`)
  await page.getByRole('tab', { name: 'Invoices' }).click()
  await page.locator('.ag-row').first().waitFor({ timeout: 10000 })

  // ---- 4: AlreadyQueued -------------------------------------------------------
  // A colleague queued 000102 between the read and the press.
  await cell('000102', 'resend').locator('button').click()
  state.rows.find((r) => r.trxNumber === '000102').status = 'Queued'
  await page.getByTestId('loy-invoice-resend-confirm').click()
  const already = await page
    .getByText('This invoice is already waiting in the queue, so nothing was added.')
    .waitFor({ timeout: 5000 })
    .then(() => true, () => false)
  check('AlreadyQueued says it is already waiting', already)
  check('🚩 and never says it queued', (await page.getByText(/Invoice queued/).count()) <= 1)

  // ---- 5: a refusal -----------------------------------------------------------
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), null, { timeout: 5000 })
  const readsBeforeRefusal = invoiceReads
  await cell('000105', 'resend').locator('button').click()
  await page.getByTestId('loy-invoice-resend-confirm').click()
  await dialog.getByText(/fix it on the Profile tab first/).waitFor({ timeout: 5000 })
  check('a refusal is drawn inside the dialog in the server’s words', (await dialog.count()) === 1)
  await page.waitForTimeout(300)
  check('🚩 a business refusal re-reads the Invoices tab once — its row was stale', invoiceReads === readsBeforeRefusal + 1, `${readsBeforeRefusal} → ${invoiceReads}`)
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  // ---- 6: look-only -----------------------------------------------------------
  state = { edit: false, rows: freshRows(), read: 'ok' }
  await page.goto(`${BASE}/loy/members/${LOYID}?tab=invoices`)
  await page.locator('.ag-row').first().waitFor({ timeout: 15000 })
  check('🚩 a look-only session sees the statuses', (await cellText('000101', 'status')) === 'Skipped: no email on the profile')
  check('🚩 and no Resend column at all',
    (await page.locator('.ag-header-cell[col-id="resend"]').count()) === 0 && (await resendButtons().count()) === 0)

  // ---- 7: empty and failed ----------------------------------------------------
  state = { edit: true, rows: freshRows(), read: 'empty' }
  await page.goto(`${BASE}/loy/members/${LOYID}?tab=invoices`)
  const emptySaid = await page
    .getByText('No receipts in the last 90 days.')
    .waitFor({ timeout: 15000 })
    .then(() => true, () => false)
  check('an empty window has its own sentence, and no grid', emptySaid && (await page.locator('.ag-row').count()) === 0)
  state.read = 'throws'
  await page.goto(`${BASE}/loy/members/${LOYID}?tab=invoices`)
  await page.getByText('The receipts could not be read.').waitFor({ timeout: 15000 })
  check('a failed read fails inside the tab, header intact', (await page.getByText('Nouf Al-Harbi').count()) >= 1)
  state.read = 'ok'
  await page.getByRole('button', { name: 'Retry' }).click()
  await page.locator('.ag-row').first().waitFor({ timeout: 10000 })
  check('Retry re-reads the tab', (await rowCount()) === 6)

  check('no script errors', errors.length === 0, errors.join(' | '))
  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
