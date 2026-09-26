// Withdraw drive (spec 319, ticket 323) — drives the REAL app in Chromium against STUBBED
// envelopes shaped exactly as BackOffice 2035 records them under `## Web contract` (Access and
// Withdraw), cross-checked against AttachmentWebEndpoints.cs, AttachmentWithdrawResult.cs,
// AttachmentWithdrawReasons.cs, AttachmentWithdrawGrantEndpointFilter.cs, WithdrawnAttachmentDto.cs
// and AttachmentMessages.cs on pricing2:
//   - `GET AttachmentWeb/Access` answers `{ categories, withdrawCategories }`;
//   - `POST AttachmentWeb/{attachmentId}/Withdraw`, JSON `{ reasonCode, note }`, answers the
//     withdrawn item at 200 (the row UNCHANGED when it was already withdrawn), a bilingual coded
//     400 `reasonCode` / `note`, 404 `NOT_FOUND`, 503 `NOT_SET_UP`, or a bare 403 with no body.
//
// ⚠️ Stubbed, never live: no SIS.Api with the File Server key set is up for this wave.
//
// Verifies ticket 323's drive Proof:
//   1. Withdraw hidden without the withdraw grant (missing, empty, a bare string), while
//      Withdrawn (n) is still shown;
//   2. the dialog naming the slip, saying it is final, listing the five reasons in order;
//      Other blocked until a note is typed; confirm disabled while in flight (one request);
//   3. a 200 moving the slip into Withdrawn (n), clearing its preview (URL revoked), re-reading
//      ByOwner, and NOT reloading the grid;
//   4. a repeat 200 (already withdrawn) leaving the row unchanged;
//   5. a 400 (message, input kept), a 404 (said, closed, re-read), a 403 (said, action gone for
//      this drawer) and a 503 NOT_SET_UP (message, no retry);
//   6. a collected Collections row withdrawing as readily (C3);
//   7. Escape in the dialog closing the dialog only, never the drawer;
//   8. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/slip-withdraw-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const READY = '/collection/ready'
const COLLECTIONS = '/collection/collections'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = null, siblings = {} } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, serverTime: '2026-09-26T09:00:00', data, ...siblings }),
})
const refusal = (status, code, message) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })

/** AttachmentMessages.Bilingual: English + Environment.NewLine + Arabic. */
const bilingual = (en, ar) => `${en}\r\n${ar}`
const MSG = {
  invalidReason: bilingual('The withdrawal is not valid: check reasonCode.', 'طلب السحب غير صالح: تحقق من reasonCode.'),
  noteRequired: bilingual(
    'Write a note saying why: a note is required when the reason is Other.',
    'اكتب ملاحظة توضح السبب: الملاحظة مطلوبة عندما يكون السبب «سبب آخر».',
  ),
  notFound: bilingual('The attachment was not found.', 'لم يتم العثور على المرفق.'),
  notSetUp: bilingual('Attachments are not set up on this server.', 'المرفقات غير مهيأة على هذا الخادم.'),
}

/** AttachmentWithdrawReasons on pricing2: the server's own copies of each label. */
const SERVER_LABELS = {
  WRONG_STORE_DAY: ['Wrong store or day', 'فرع أو يوم غير صحيح'],
  UNREADABLE: ['Unreadable', 'غير مقروء'],
  DUPLICATE: ['Duplicate', 'مكرر'],
  NOT_ECR_SLIP: ['Not an ECR slip', 'ليس إيصال جهاز الدفع (ECR)'],
  OTHER: ['Other', 'سبب آخر'],
}

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenAssignment: false,
  canOpenSettlement: false,
  canSuperviseSettlement: false,
  canOpenReady: true,
}

// ---- the grids (320's rows) ----
const DAY = {
  kind: 'DAY',
  storeId: 'P019',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  currencyKey: 'SAR',
  businessDay: '2026-09-20T00:00:00',
  shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X0Y',
  zNumber: 412,
  settlementDocumentId: '',
  entryNumber: 0,
  cashToHandOver: 1000.5,
  surplusDeducted: 250.0,
  readySince: '2026-09-20T23:05:12',
  daysWaiting: 5,
  cardTotal: 640.0,
  slipCount: 4,
}
const READY_ROWS = [DAY]
const readyId = (row) => `DAY:${row.shiftId}`

const SHIFT = {
  storeId: 'P019',
  openedAt: '2026-09-02T08:00:00',
  closedAt: '2026-09-02T23:10:40',
  systemCash: 5420.5,
  countedCash: 5420.5,
  variance: 0.0,
  varianceReasonCode: '',
  varianceReasonText: '',
  openingFloat: 200.0,
  countedCashNet: 5220.5,
  retainedFloat: 200.0,
  netCollected: 5220.5,
  cardTotal: 1310.25,
  cardTransactionCount: 9,
  businessDay: '2026-09-02T00:00:00',
  collectorOperatorId: 'COLL-9',
  collectionReceiptId: '01K5YQ2M8N3P4R5S6T7V8W9X0Y',
  collectionReceiptNo: 91234,
  collectedAt: '2026-09-12T10:15:00',
  zReportIds: '01K5XW0A1B2C3D4E5F6G7H8J9K',
  collectorName: 'فهد القحطاني',
  storeName: 'Al-Dawaa P019',
  profitCenter: 'PH-019',
  storeText: 'PH-019 (P019)',
  closerOperatorId: 'MGR-01',
  closerName: 'Pharmacist One',
  salesDate: '2026-09-02T00:00:00',
  currencyKey: 'SAR',
  slipCount: 1,
}
const COLLECTION_ROWS = [SHIFT]

// ---- the slips (AttachmentDto, every shipped field) ----
const slip = (id, ownerKey, fileName, sourceDevice, uploadedBy, storedAt) => ({
  attachmentId: id,
  status: 'STORED',
  ownerKind: 'STORE_DAY',
  ownerKey,
  category: 'CASH_CLOSE',
  kind: 'ECR_SLIP',
  fileName,
  sizeBytes: 2048,
  storedAt,
  sourceDevice,
  uploadedBy,
})
const READY_KEY = 'P019/2026-09-20'
const SHIFT_KEY = 'P019/2026-09-02'
const WRONG = slip('01K60A000000000000000WRONG', READY_KEY, 'wrong-store.jpg', 'P001-01', '20145', '2026-09-20T23:12:44.1234567')
const STALE = slip('01K60A000000000000000STALE', READY_KEY, 'already-withdrawn.png', '', 'U123', '2026-09-20T23:00:00')
const KEEP = slip('01K60A0000000000000000KEEP', READY_KEY, 'good-slip.jpg', 'P001-02', '20146', '2026-09-20T22:58:00')
const OTHER = slip('01K60A000000000000000OTHER', READY_KEY, 'second.jpg', 'P001-02', '20146', '2026-09-20T22:50:00')
const OLD = slip('01K60A00000000000000000OLD', READY_KEY, 'old-duplicate.jpg', '', 'U123', '2026-09-19T20:00:00')
const SHIFT_SLIP = slip('01K60A00000000000000SHIFT', SHIFT_KEY, 'collected-day.jpg', 'P001-01', '20145', '2026-09-02T23:00:00')

/** WithdrawnAttachmentDto, as the register holds it. */
const asWithdrawn = (s, reasonCode, note, withdrawnBy, withdrawnAt) => ({
  attachmentId: s.attachmentId,
  category: s.category,
  kind: s.kind,
  fileName: s.fileName,
  sourceDevice: s.sourceDevice,
  uploadedBy: s.uploadedBy,
  storedAt: s.storedAt,
  withdrawnBy,
  withdrawnAt,
  reasonCode,
  reasonLabel: SERVER_LABELS[reasonCode][0],
  reasonLabelArabic: SERVER_LABELS[reasonCode][1],
  note,
})

// ---- the stubbed register ----
let register = {}
let probe = { categories: ['CASH_CLOSE'], withdrawCategories: ['CASH_CLOSE'] }
let withdrawAnswers = []
let withdrawHold = null
let withdrawCalls = []
let byOwnerCalls = []
let contentCalls = {}
let readyCalls = 0
let collectionsCalls = 0
let clock = 0

/** A fresh register: the Ready day's four stored slips and one withdrawn long ago. */
function seed() {
  register = {
    [READY_KEY]: {
      stored: [WRONG, STALE, KEEP, OTHER, OLD],
      withdrawn: [asWithdrawn(OLD, 'DUPLICATE', '', 'U777', '2026-09-24T08:00:00')],
    },
    [SHIFT_KEY]: { stored: [SHIFT_SLIP], withdrawn: [] },
  }
  clock = 0
}

/** Someone else withdraws STALE while this drawer's list still shows it as stored. */
function withdrawBehindTheListsBack() {
  const day = register[READY_KEY]
  day.withdrawn = [...day.withdrawn, asWithdrawn(STALE, 'DUPLICATE', '', 'U777', '2026-09-25T08:00:00')]
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 2600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.goto('about:blank')
  const jpeg = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    c.getContext('2d').fillRect(0, 0, 8, 8)
    return c.toDataURL('image/jpeg').split(',')[1]
  })
  const JPEG_BYTES = Buffer.from(jpeg, 'base64')

  await page.addInitScript(() => {
    const made = []
    const revoked = []
    const create = URL.createObjectURL.bind(URL)
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.createObjectURL = (b) => {
      const u = create(b)
      made.push(u)
      return u
    }
    URL.revokeObjectURL = (u) => {
      revoked.push(u)
      return revoke(u)
    }
    window.__urls = { made, revoked }
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.split('/api/')[1]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    if (path === 'AttachmentWeb/Access') return route.fulfill(envelope(probe))
    if (path === 'CollectionWeb/Ready') {
      readyCalls += 1
      return route.fulfill(envelope(READY_ROWS, { siblings: { slipCountsUnavailable: false } }))
    }
    if (path === 'CollectionWeb/Collections') {
      collectionsCalls += 1
      return route.fulfill(envelope(COLLECTION_ROWS, { siblings: { slipCountsUnavailable: false } }))
    }
    if (path === 'AttachmentWeb/ByOwner') {
      const ownerKey = url.searchParams.get('ownerKey')
      byOwnerCalls.push(ownerKey)
      const day = register[ownerKey] ?? { stored: [], withdrawn: [] }
      const withdrawnIds = new Set(day.withdrawn.map((w) => w.attachmentId))
      const stored = day.stored.filter((s) => !withdrawnIds.has(s.attachmentId))
      // Sent in register order; the drawer sorts Withdrawn newest first itself.
      return route.fulfill(envelope(stored, { siblings: { withdrawn: day.withdrawn } }))
    }
    const content = /^AttachmentWeb\/([^/]+)\/Content$/.exec(path ?? '')
    if (content) {
      const id = decodeURIComponent(content[1])
      contentCalls[id] = (contentCalls[id] ?? 0) + 1
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: JPEG_BYTES })
    }
    const withdraw = /^AttachmentWeb\/([^/]+)\/Withdraw$/.exec(path ?? '')
    if (withdraw && request.method() === 'POST') {
      const id = decodeURIComponent(withdraw[1])
      const body = request.postDataJSON()
      withdrawCalls.push({ id, body, contentType: request.headers()['content-type'] })
      if (withdrawHold) await withdrawHold
      const answer = withdrawAnswers.shift() ?? 'ok'
      if (answer === 'reasonCode') return route.fulfill(refusal(400, 'reasonCode', MSG.invalidReason))
      if (answer === 'note') return route.fulfill(refusal(400, 'note', MSG.noteRequired))
      if (answer === 'notFound') return route.fulfill(refusal(404, 'NOT_FOUND', MSG.notFound))
      if (answer === 'notSetUp') return route.fulfill(refusal(503, 'NOT_SET_UP', MSG.notSetUp))
      if (answer === 'bare403') return route.fulfill({ status: 403, body: '' })
      const day = Object.values(register).find((d) => d.stored.some((s) => s.attachmentId === id))
      const already = day?.withdrawn.find((w) => w.attachmentId === id)
      // Already withdrawn: the row UNCHANGED (who, when and why stay the first withdrawal's).
      if (already) return route.fulfill(envelope(already))
      const stored = day.stored.find((s) => s.attachmentId === id)
      clock += 1
      const row = asWithdrawn(stored, body.reasonCode, body.note, 'U456', `2026-09-26T11:0${clock}:00.1234567`)
      day.withdrawn = [...day.withdrawn, row]
      return route.fulfill(envelope(row))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/323-${name}.png`, fullPage: false })
  const drawer = () => page.locator('dialog[data-region="slip-drawer"]')
  const dialog = () => page.locator('dialog:not([data-region="slip-drawer"]):has([data-region="slip-withdraw"])')
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(slips|ready|collections|collection|common)\.[a-zA-Z]+(\.[a-zA-Z_-]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const load = async (path) => {
    await page.goto(BASE + path)
    await page.waitForLoadState('networkidle')
    await page.locator('.ag-row').first().waitFor()
  }
  const readyCell = () => page.locator(`.ag-row[row-id="${readyId(DAY)}"] [col-id="slipCount"]`).first()
  const openDay = async (cell) => {
    await cell.getByRole('button').click()
    await drawer().waitFor()
    await drawer().locator('[data-testid="slip-list"], [data-testid="slip-empty"]').first().waitFor()
  }
  const closeDrawer = async () => {
    await page.getByTestId('slip-drawer-close').click()
    await drawer().waitFor({ state: 'detached' })
  }
  const listRow = (s) => drawer().locator(`tr[data-slip="${s.attachmentId}"]`)
  const listIds = () => drawer().locator('tr[data-slip]').evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-slip')))
  const withdrawnIds = () =>
    drawer().locator('li[data-withdrawn]').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-withdrawn')))
  const preview = async (s) => {
    await listRow(s).getByRole('button').click()
    await drawer().locator(`[data-preview-for="${s.attachmentId}"][data-preview-kind="image"] img`).waitFor({ timeout: 8000 })
  }
  const withdrawButton = () => drawer().getByTestId('slip-withdraw')
  const openDialog = async () => {
    await withdrawButton().click()
    await dialog().waitFor()
  }
  const confirm = () => dialog().getByTestId('slip-withdraw-confirm')
  const reason = (code) => dialog().locator(`input[data-reason="${code}"]`)
  const note = () => dialog().getByTestId('slip-withdraw-note')
  const dialogGone = () => dialog().waitFor({ state: 'detached', timeout: 8000 })
  const withdrawnCount = async () => {
    const summary = drawer().locator('[data-testid="slip-withdrawn"] summary')
    return (await summary.count()) ? (await summary.innerText()).trim() : ''
  }
  const reset = () => {
    withdrawAnswers = []
    withdrawHold = null
    withdrawCalls = []
    byOwnerCalls = []
    contentCalls = {}
  }

  // ════════════════════════════ READY — the grant holder ════════════════════════════
  seed()
  reset()
  await load(READY)
  const readyAtLoad = readyCalls
  const collectionsAtLoad = collectionsCalls
  await openDay(readyCell())
  check('holder — Withdraw is not offered before a slip is picked', (await withdrawButton().count()) === 0)
  await preview(WRONG)
  check('holder — Withdraw sits beside Download on the previewed slip', (await withdrawButton().count()) === 1 && (await drawer().getByTestId('slip-download').count()) === 1)
  check('holder — its accessible name names the slip', (await withdrawButton().getAttribute('aria-label')) === 'Withdraw wrong-store.jpg')

  // ---- the dialog ----
  await openDialog()
  await shot('dialog')
  const named = await dialog().getByTestId('slip-withdraw-slip').innerText()
  check('dialog — names the slip: file name, till, uploaded at', named.includes('wrong-store.jpg') && named.includes('P001-01') && named.includes('2026-09-20 23:12:44'), named.replace(/\s+/g, ' '))
  const finalText = await dialog().getByTestId('slip-withdraw-final').innerText()
  check('dialog — says the withdrawal is final, and that a mistake is fixed by adding the file again', /final/i.test(finalText) && /add the file again/i.test(finalText), finalText)
  const reasons = await dialog().locator('input[data-reason]').evaluateAll((els) => els.map((el) => [el.getAttribute('data-reason'), el.closest('label').innerText.trim()]))
  const expected = Object.entries(SERVER_LABELS).map(([code, [en, ar]]) => [code, `${en} · ${ar}`])
  check('dialog — the five reasons, in contract order, each English beside Arabic', JSON.stringify(reasons) === JSON.stringify(expected), JSON.stringify(reasons))
  check('dialog — confirm is disabled until a reason is picked', await confirm().isDisabled())
  check('dialog — the note is capped at 200 characters', (await note().getAttribute('maxlength')) === '200')
  check('dialog — says only the first 200 characters are kept', (await dialog().innerText()).includes('first 200 characters'))

  // ---- Escape closes the dialog only ----
  await page.keyboard.press('Escape')
  await dialogGone()
  check('Escape — closes the dialog…', (await dialog().count()) === 0)
  check('Escape — …and never the drawer', (await drawer().count()) === 1 && (await drawer().evaluate((d) => d.open)))

  // ---- Other blocked until a note is typed ----
  await openDialog()
  await reason('OTHER').check()
  check('Other — confirm disabled while the note is blank', await confirm().isDisabled())
  await note().fill('    ')
  check('Other — …and while it is only whitespace', await confirm().isDisabled())
  check('Other — the note is marked required', (await note().getAttribute('required')) !== null && (await dialog().innerText()).includes('Required when the reason is Other'))
  await note().fill('  Belongs to P020  ')
  check('Other — enabled once a note is typed', await confirm().isEnabled())
  await reason('DUPLICATE').check()
  await note().fill('')
  check('a code other than Other — enabled without a note', await confirm().isEnabled())
  await reason('OTHER').check()
  await note().fill('  Belongs to P020  ')

  // ---- the 200, held in flight ----
  const urlsBefore = await page.evaluate(() => [...window.__urls.made])
  const contentBefore = contentCalls[WRONG.attachmentId] ?? 0
  let release
  withdrawHold = new Promise((r) => (release = r))
  byOwnerCalls = []
  await confirm().click()
  await page.waitForFunction(() => document.querySelector('[data-testid="slip-withdraw-confirm"]')?.disabled === true)
  check('in flight — confirm is disabled, and says so', (await confirm().isDisabled()) && (await confirm().innerText()).includes('Withdrawing'))
  await confirm().click({ force: true }).catch(() => {})
  await confirm().dblclick({ force: true }).catch(() => {})
  // Twice: the browser may close a modal dialog on a repeated Escape however its cancel is refused.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  check('in flight — the dialog cannot be dismissed, even by a repeated Escape', (await dialog().count()) === 1 && (await dialog().evaluate((d) => d.open)))
  release()
  withdrawHold = null
  await dialogGone()
  await drawer().locator(`li[data-withdrawn="${WRONG.attachmentId}"]`).waitFor({ state: 'attached', timeout: 8000 }).catch(() => {})
  await shot('withdrawn')
  check('200 — exactly one request for the presses', withdrawCalls.length === 1, `${withdrawCalls.length} requests`)
  check('200 — POST AttachmentWeb/{attachmentId}/Withdraw, as JSON', withdrawCalls[0]?.id === WRONG.attachmentId && /^application\/json/.test(withdrawCalls[0]?.contentType ?? ''), JSON.stringify(withdrawCalls[0]))
  check('200 — the body is exactly { reasonCode, note }, the note trimmed', JSON.stringify(withdrawCalls[0]?.body) === JSON.stringify({ reasonCode: 'OTHER', note: 'Belongs to P020' }), JSON.stringify(withdrawCalls[0]?.body))
  check('200 — the dialog closes', (await dialog().count()) === 0)
  check('200 — ByOwner is read again', byOwnerCalls.length >= 1 && byOwnerCalls.every((k) => k === READY_KEY), JSON.stringify(byOwnerCalls))
  check('200 — the slip leaves the list', !(await listIds()).includes(WRONG.attachmentId), (await listIds()).join(','))
  check('200 — …and heads Withdrawn (n)', (await withdrawnIds())[0] === WRONG.attachmentId && (await withdrawnCount()) === 'Withdrawn (2)', `${await withdrawnCount()} ${(await withdrawnIds()).join(',')}`)
  const wRow = drawer().locator(`li[data-withdrawn="${WRONG.attachmentId}"]`)
  await drawer().locator('[data-testid="slip-withdrawn"] summary').click()
  const wText = await wRow.innerText()
  check('200 — Withdrawn shows who, when and why, as the server sent them', wText.includes('Withdrawn by U456 at 2026-09-26 11:01:00') && (await wRow.locator('[data-cell="reason"]').innerText()) === 'Reason: Other سبب آخر' && wText.includes('Belongs to P020'), wText.replace(/\s+/g, ' '))
  check('200 — its preview is cleared', (await drawer().locator(`[data-preview-for="${WRONG.attachmentId}"]`).count()) === 0 && (await withdrawButton().count()) === 0)
  const urlsAfter = await page.evaluate(() => ({ made: [...window.__urls.made], revoked: [...window.__urls.revoked] }))
  check('200 — the preview’s object URL is revoked', urlsBefore.length >= 1 && urlsBefore.every((u) => urlsAfter.revoked.includes(u)), `${urlsBefore.length} made, ${urlsAfter.revoked.length} revoked`)
  check('200 — its bytes are never fetched again', (contentCalls[WRONG.attachmentId] ?? 0) === contentBefore)
  check('200 — the drawer says it was withdrawn', (await drawer().getByTestId('slip-withdraw-notice').innerText()).includes('wrong-store.jpg was withdrawn'))
  check('200 — the grids are not reloaded under the user', readyCalls === readyAtLoad && collectionsCalls === collectionsAtLoad, `${readyCalls - readyAtLoad} Ready reads`)
  check('200 — the row’s count stays as the grid last read it (stale until reload)', (await readyCell().innerText()).trim() === '4')
  await noRawKeys('ready — withdrawn')

  // ---- a repeat 200: the row was already withdrawn ----
  reset()
  withdrawBehindTheListsBack()
  check('repeat — the stale list still shows the already-withdrawn slip as stored', (await listIds()).includes(STALE.attachmentId))
  await preview(STALE)
  await openDialog()
  await reason('WRONG_STORE_DAY').check()
  await confirm().click()
  await dialogGone()
  await page.waitForFunction((id) => !document.querySelector(`dialog[data-region="slip-drawer"] tr[data-slip="${id}"]`), STALE.attachmentId, { timeout: 8000 }).catch(() => {})
  const sRow = drawer().locator(`li[data-withdrawn="${STALE.attachmentId}"]`)
  const sText = await sRow.innerText().catch(() => '')
  check('repeat — a plain success: the slip leaves the list', withdrawCalls.length === 1 && !(await listIds()).includes(STALE.attachmentId))
  check('repeat — the row is unchanged: the FIRST withdrawal’s who, when and why', sText.includes('Withdrawn by U777 at 2026-09-25 08:00:00') && (await sRow.locator('[data-cell="reason"]').innerText()) === 'Reason: Duplicate مكرر', sText.replace(/\s+/g, ' '))
  check('repeat — Withdrawn (n) counts it once', (await withdrawnCount()) === 'Withdrawn (3)' && (await withdrawnIds()).filter((id) => id === STALE.attachmentId).length === 1, await withdrawnCount())

  // ---- 400 reasonCode, then 400 note: the message, the input kept ----
  reset()
  await preview(KEEP)
  await openDialog()
  await reason('UNREADABLE').check()
  await note().fill('faded print')
  withdrawAnswers = ['reasonCode']
  let release400
  withdrawHold = new Promise((r) => (release400 = r))
  await confirm().click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  release400()
  withdrawHold = null
  const err400 = dialog().getByTestId('slip-withdraw-error')
  await err400.waitFor()
  const err400Text = await err400.innerText()
  check('400 reasonCode — the server’s message in the dialog, as sent (English, then Arabic)', err400Text.includes('check reasonCode') && err400Text.includes('طلب السحب غير صالح'), err400Text)
  check('400 reasonCode — the dialog stays, with the input kept', (await dialog().count()) === 1 && (await reason('UNREADABLE').isChecked()) && (await note().inputValue()) === 'faded print')
  check('400 reasonCode — confirm can be pressed again', await confirm().isEnabled())
  withdrawAnswers = ['note']
  await confirm().click()
  await page.waitForFunction(() => document.querySelector('[data-testid="slip-withdraw-error"]')?.innerText.includes('note is required'), null, { timeout: 8000 }).catch(() => {})
  const noteErr = await dialog().getByTestId('slip-withdraw-error').innerText().catch(() => '')
  check('400 note — its message in the dialog, the input kept', noteErr.includes('a note is required') && noteErr.includes('الملاحظة مطلوبة') && (await note().inputValue()) === 'faded print', noteErr)
  check('400 — nothing was withdrawn', (await listIds()).includes(KEEP.attachmentId))
  await shot('400')

  // ---- 503 NOT_SET_UP: the message, no retry ----
  withdrawAnswers = ['notSetUp']
  await confirm().click()
  await page.waitForFunction(() => document.querySelector('[data-testid="slip-withdraw-error"]')?.getAttribute('data-answer') === 'not-set-up', null, { timeout: 8000 }).catch(() => {})
  const setUpText = await dialog().getByTestId('slip-withdraw-error').innerText().catch(() => '')
  check('503 NOT_SET_UP — the message as sent', setUpText.includes('not set up on this server') && setUpText.includes('المرفقات غير مهيأة'), setUpText)
  check('503 NOT_SET_UP — no retry: confirm stays disabled', await confirm().isDisabled())
  check('503 NOT_SET_UP — …and no retry button of any kind', (await dialog().getByRole('button', { name: /retry|try again/i }).count()) === 0)
  await dialog().getByTestId('slip-withdraw-cancel').click()
  await dialogGone()
  check('503 NOT_SET_UP — Cancel closes the dialog, the drawer stays', (await dialog().count()) === 0 && (await drawer().count()) === 1)

  // ---- 404 NOT_FOUND: say so, close, re-read ----
  reset()
  await openDialog()
  await reason('DUPLICATE').check()
  withdrawAnswers = ['notFound']
  await confirm().click()
  await dialogGone()
  await drawer().getByTestId('slip-withdraw-notice').waitFor()
  const goneNotice = drawer().getByTestId('slip-withdraw-notice')
  check('404 — the dialog closes', (await dialog().count()) === 0)
  check('404 — the drawer says it is no longer a stored slip you can withdraw', (await goneNotice.getAttribute('data-answer')) === 'gone' && (await goneNotice.innerText()).includes('good-slip.jpg is no longer a stored slip you can withdraw'), await goneNotice.innerText())
  const goneText = await goneNotice.innerText()
  check('404 — …with the server’s own words under it, as sent (English, then Arabic)', goneText.includes('The attachment was not found.') && goneText.includes('لم يتم العثور على المرفق.'), goneText)
  await page.waitForTimeout(300)
  check('404 — ByOwner is read again', byOwnerCalls.includes(READY_KEY), JSON.stringify(byOwnerCalls))
  await shot('404')

  // ---- a bare 403: said, and the action taken away for this drawer ----
  reset()
  await preview(OTHER)
  await openDialog()
  await reason('UNREADABLE').check()
  withdrawAnswers = ['bare403']
  await confirm().click()
  await dialogGone()
  const forbidden = drawer().getByTestId('slip-withdraw-notice')
  await forbidden.waitFor()
  check('403 — the dialog closes and the drawer says the account may not withdraw', (await forbidden.getAttribute('data-answer')) === 'forbidden' && (await forbidden.innerText()).includes('may not withdraw'), await forbidden.innerText())
  check('403 — Withdraw is gone from this drawer', (await withdrawButton().count()) === 0)
  await preview(KEEP)
  check('403 — …for every slip in it', (await withdrawButton().count()) === 0)
  check('403 — the slip is still listed', (await listIds()).includes(OTHER.attachmentId))
  await shot('403')
  await noRawKeys('ready — refusals')
  await closeDrawer()

  // ════════════════════ CASH COLLECTIONS — a collected row (C3) ════════════════════
  reset()
  await load(COLLECTIONS)
  const collectionsBefore = collectionsCalls
  await openDay(page.locator('.ag-row[row-index="0"] [col-id="slipCount"]').first())
  await preview(SHIFT_SLIP)
  check('collections — a collected row’s drawer offers Withdraw too (C3)', (await withdrawButton().count()) === 1)
  await openDialog()
  await reason('NOT_ECR_SLIP').check()
  await confirm().click()
  await dialogGone()
  await drawer().locator(`li[data-withdrawn="${SHIFT_SLIP.attachmentId}"]`).waitFor({ state: 'attached', timeout: 8000 }).catch(() => {})
  check('collections — withdrawn under its own day', withdrawCalls.length === 1 && withdrawCalls[0].id === SHIFT_SLIP.attachmentId && byOwnerCalls.every((k) => k === SHIFT_KEY) && (await withdrawnIds()).includes(SHIFT_SLIP.attachmentId), JSON.stringify(byOwnerCalls))
  check('collections — its body carries an empty note for a code that needs none', JSON.stringify(withdrawCalls[0]?.body) === JSON.stringify({ reasonCode: 'NOT_ECR_SLIP', note: '' }), JSON.stringify(withdrawCalls[0]?.body))
  check('collections — the list is empty now, and the grid is not reloaded', (await drawer().getByTestId('slip-empty').count()) === 1 && collectionsCalls === collectionsBefore)
  await noRawKeys('collections — withdrawn')
  await closeDrawer()

  // ════════════════════ WITHOUT THE WITHDRAW GRANT ════════════════════
  for (const [name, answer] of [
    ['a collector (no withdrawCategories)', { categories: ['CASH_CLOSE'] }],
    ['an empty withdrawCategories', { categories: ['CASH_CLOSE'], withdrawCategories: [] }],
    ['a bare string "CASH_CLOSE"', { categories: ['CASH_CLOSE'], withdrawCategories: 'CASH_CLOSE' }],
  ]) {
    seed()
    reset()
    probe = answer
    await load(READY)
    await openDay(readyCell())
    await preview(KEEP)
    check(`hidden — ${name}: the drawer opens and previews, with no Withdraw`, (await withdrawButton().count()) === 0 && (await drawer().getByTestId('slip-download').count()) === 1)
    check(`hidden — ${name}: Withdrawn (n) is still shown`, (await withdrawnCount()) === 'Withdrawn (1)', await withdrawnCount())
    await closeDrawer()
  }
  probe = { categories: ['CASH_CLOSE'], withdrawCategories: ['CASH_CLOSE'] }

  // ---- a fresh drawer reads the probe again (the 403 was this drawer's) ----
  seed()
  await load(READY)
  await openDay(readyCell())
  await preview(KEEP)
  check('a new drawer — Withdraw is offered again from the probe', (await withdrawButton().count()) === 1)
  await closeDrawer()

  check('no page error anywhere', errors.length === 0, errors.slice(0, 3).join(' || '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
