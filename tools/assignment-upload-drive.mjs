// Assignment upload drive (spec 308, ticket 318) — drives the REAL app in Chromium against
// STUBBED envelopes shaped exactly as BackOffice 1996 records them under `## Web contract`:
// `POST CollectionWeb/Assignment/Upload/Preview` (multipart `file`) and `…/Upload/Commit`
// (multipart `file` + `contentHash`), behind the EXISTING CollectionAssignment grant.
//
// ⚠️ Stubbed, never live: no SIS.Api with 1996 is up for this wave, and the assertions are about
// specific outcomes (a refused row, a hash mismatch, a re-press) a live door will not produce on
// demand.
//
// Verifies ticket 318's screen Proof:
//   1. the gate: the upload lives on the assignment page, behind canOpenAssignment and nothing new;
//   2. the template: the three columns named, and a download whose header is exactly the contract's;
//   3. loading, then the contract's preview sample: changes per store, in the roster's names, the
//      refused row named, Apply withheld;
//   4. a clean file: Apply counts the changes; a double press sends ONE commit that re-sends the
//      same file with the preview's hash; the Branches grid refetches and the notice says so;
//   5. a re-press answer (accepted, applied 0) reads as nothing needed changing;
//   6. refusals: HASH_MISMATCH, ROW_ERRORS folded back onto the preview, the 400 envelopes (own key
//      and the server's words), a 500, and the bare 403;
//   7. empty: a file already as the estate stands offers nothing to apply;
//   8. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/assignment-upload-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/assignment'

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = null } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenAssignment: true,
  canOpenSettlement: false,
  canSuperviseSettlement: false,
  canOpenReady: false,
}

const person = (staffId, displayName, role) => ({
  staffId,
  displayName,
  role,
  supervisorId: '',
  isActive: true,
  updatedBy: 'seed',
  updatedAt: '2026-09-01T00:00:00',
})
const ROSTER = [
  person('4466', 'ضحى', 'ACCOUNTANT'),
  person('4471', 'سارة العتيبي', 'ACCOUNTANT'),
  person('5120', 'فهد القحطاني', 'COLLECTOR'),
]
const branch = (storeCode, accountantId, collectorId) => ({
  storeCode,
  storeName: `Al-Dawaa ${storeCode}`,
  city: 'Riyadh',
  area: 'Central',
  accountantId,
  collectorId,
  updatedBy: 'seed',
  updatedAt: '2026-09-01T00:00:00',
})
const BRANCHES = [branch('P019', '4466', '5120'), branch('P020', '4466', '5120'), branch('P021', '', '')]

/** 1996's preview sample, VERBATIM. */
const SAMPLE = {
  contentHash: '9f2c4e0b7d1a5c3e8b6f0a2d4c6e8f1a3b5d7f9e0c2a4b6d8f0e1c3a5b7d9f2e',
  rowCount: 3,
  changeCount: 2,
  unchangedCount: 1,
  canCommit: false,
  rows: [
    { rowNumber: 2, storeCode: 'P019', storeName: 'Al-Dawaa P019',
      currentAccountantId: '4466', accountantId: '4471', accountantChanges: true,
      currentCollectorId: '5120', collectorId: '5120', collectorChanges: false, changes: true },
    { rowNumber: 3, storeCode: 'P020', storeName: 'Al-Dawaa P020',
      currentAccountantId: '4466', accountantId: '4466', accountantChanges: false,
      currentCollectorId: '5120', collectorId: '5120', collectorChanges: false, changes: false },
    { rowNumber: 4, storeCode: 'P9X9', storeName: 'P9X9',
      currentAccountantId: '', accountantId: '4471', accountantChanges: true,
      currentCollectorId: '', collectorId: '', collectorChanges: false, changes: true },
  ],
  errors: [
    { rowNumber: 4, storeCode: 'P9X9', column: 'StoreCode', code: 'UNKNOWN_STORE',
      message: "'P9X9' is not an open branch.\n'P9X9' ليس فرعاً مفتوحاً." },
  ],
}
/** The sheet with row 4 fixed to P021 — two branches change, one already holds it. */
const CLEAN = {
  ...SAMPLE,
  canCommit: true,
  rows: [
    SAMPLE.rows[0],
    SAMPLE.rows[1],
    { ...SAMPLE.rows[2], storeCode: 'P021', storeName: 'Al-Dawaa P021' },
  ],
  errors: [],
}
/** A sheet of the estate exactly as it stands. */
const SAME = { ...CLEAN, rowCount: 1, changeCount: 0, unchangedCount: 1, rows: [SAMPLE.rows[1]] }

/** 1996's commit sample, VERBATIM. */
const APPLIED = {
  accepted: true,
  refusalReason: '',
  applied: 2,
  appliedStoreCodes: ['P019', 'P021'],
  unchanged: 1,
  errors: [],
  updatedBy: '4401',
  updatedAt: '2026-09-25T10:14:32.517',
}
const REFUSED = { ...APPLIED, accepted: false, applied: 0, appliedStoreCodes: [], unchanged: 0, updatedBy: '', updatedAt: '0001-01-01T00:00:00' }

let access = ACCESS
let scenario = {}
let branchCalls = 0
let previewCalls = 0
let commitCalls = 0
let lastPreviewBody = ''
let lastCommitBody = ''
/** Held open to show a pending state; released by the scenario. */
let hold = null

const fileRefusal = (code, message) =>
  envelope(null, { status: 400, success: false, message, errors: [{ errorCode: code, message }] })

async function run() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: '4401', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(access))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    if (path === 'CollectionWeb/Assignment/People') return route.fulfill(envelope(ROSTER))
    if (path === 'CollectionWeb/Assignment/Branches') {
      branchCalls++
      return route.fulfill(envelope(BRANCHES))
    }
    if (path === 'CollectionWeb/Assignment/Upload/Preview') {
      previewCalls++
      lastPreviewBody = route.request().postData() ?? ''
      if (hold) await hold
      const p = scenario.preview
      if (p === 'unreadable')
        return route.fulfill(fileRefusal('AssignmentUploadFileUnreadable', 'The file has no StoreCode column.\nلا يحتوي الملف على عمود الفرع.'))
      if (p === 'type')
        return route.fulfill(fileRefusal('AssignmentUploadFileTypeUnsupported', 'Only .xlsx and .csv files are supported.\nالملفات المقبولة'))
      if (p === 'error') return route.fulfill(envelope(null, { status: 500, success: false, message: 'boom' }))
      if (p === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (p === 'same') return route.fulfill(envelope(SAME))
      if (p === 'clean') return route.fulfill(envelope(CLEAN))
      return route.fulfill(envelope(SAMPLE))
    }
    if (path === 'CollectionWeb/Assignment/Upload/Commit') {
      commitCalls++
      lastCommitBody = route.request().postData() ?? ''
      if (hold) await hold
      const c = scenario.commit
      if (c === 'again') return route.fulfill(envelope({ ...APPLIED, applied: 0, appliedStoreCodes: [], unchanged: 3, updatedBy: '', updatedAt: '0001-01-01T00:00:00' }))
      if (c === 'hash')
        return route.fulfill(envelope({ ...REFUSED, refusalReason: 'HASH_MISMATCH',
          errors: [{ rowNumber: 0, storeCode: '', column: '', code: 'HASH_MISMATCH', message: 'This file is not the one that was previewed.\nهذا الملف' }] }))
      if (c === 'rows')
        return route.fulfill(envelope({ ...REFUSED, refusalReason: 'ROW_ERRORS',
          errors: [{ rowNumber: 2, storeCode: 'P019', column: 'AccountantId', code: 'STAFF_INACTIVE', message: "'4471' is inactive.\nغير نشط" }] }))
      return route.fulfill(envelope(APPLIED))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/318-${name}.png`, fullPage: true })
  const dialog = () => page.locator('[data-region="assignment-upload"]')
  const dialogText = async () => (await dialog().innerText()).replace(/\s+/g, ' ')
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(assignment|collection|common|upload)\.[a-zA-Z]+(\.[a-zA-Z_]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const load = async () => {
    await page.goto(BASE + ROUTE)
    await page.waitForLoadState('networkidle')
  }
  const openUpload = async () => {
    await page.getByTestId('assignment-upload-open').click()
    await dialog().waitFor()
  }
  const chooseFile = async (name = 'finance-sheet.csv') =>
    page.getByTestId('upload-file').setInputFiles({
      name,
      mimeType: 'text/csv',
      buffer: Buffer.from('StoreCode,AccountantId,CollectorId\r\nP019,4471,\r\nP020,,5120\r\nP9X9,4471,\r\n'),
    })
  const previewFile = async (sc) => {
    scenario = { ...scenario, preview: sc }
    await openUpload()
    await chooseFile()
    await page.getByTestId('upload-preview').click()
    // The answer lands as a preview or as a banner — wait for whichever it is.
    await page
      .locator('[data-testid="upload-rows"], [data-testid="upload-nothing"], [data-region="assignment-upload"] [role="alert"]')
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => {})
  }
  const closeDialog = async () => {
    await page.keyboard.press('Escape')
    await dialog().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  }

  // ---- 1. the gate ----
  access = { ...ACCESS, canOpenAssignment: false }
  await load()
  check('gate — without canOpenAssignment there is no upload (the page is refused)', (await page.getByTestId('assignment-upload-open').count()) === 0 && (await page.locator('main').innerText()).includes('No access to this screen'))
  access = ACCESS
  await load()
  await page.locator('.ag-row').first().waitFor()
  check('gate — the assignment grant alone opens the upload, beside the bulk flows', (await page.getByTestId('assignment-upload-open').count()) === 1)

  // ---- 2. the template ----
  await openUpload()
  const cols = await page.locator('[data-region="upload-template"] [data-column]').evaluateAll((els) => els.map((e) => e.getAttribute('data-column')))
  check('template — the three columns, named as the door reads them', cols.join(',') === 'StoreCode,AccountantId,CollectorId', cols.join(','))
  check('template — a blank cell is said to leave that side alone', (await dialogText()).includes('A blank cell leaves that side as it is'))
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('upload-template-download').click()])
  const csv = readFileSync(await download.path(), 'utf8')
  check('template — the download is the header alone, exactly StoreCode,AccountantId,CollectorId', download.suggestedFilename() === 'collection-assignment-template.csv' && csv === 'StoreCode,AccountantId,CollectorId\r\n', JSON.stringify(csv))
  check('template — Preview waits for a file', (await page.getByTestId('upload-preview').getAttribute('aria-disabled')) === 'true')
  await shot('file-step')
  await noRawKeys('file step')
  await closeDialog()

  // ---- 3. loading, then the contract sample ----
  let release
  hold = new Promise((r) => (release = r))
  scenario = { preview: 'sample' }
  previewCalls = 0
  await openUpload()
  await chooseFile()
  check('file — the chosen file is named', (await page.getByTestId('upload-file-name').innerText()).includes('finance-sheet.csv'))
  await page.getByTestId('upload-preview').click()
  const reading = page.getByRole('status', { name: 'Reading the file…' })
  await reading.waitFor({ timeout: 5000 }).catch(() => {})
  check('loading — the dialog says it is reading the file', (await reading.count()) === 1)
  release()
  hold = null
  await page.getByTestId('upload-rows').waitFor()
  check('preview — one multipart call carrying the file part', previewCalls === 1 && lastPreviewBody.includes('name="file"; filename="finance-sheet.csv"'), lastPreviewBody.slice(0, 120))
  const text = await dialogText()
  check('preview — the summary counts rows, changes and unchanged', text.includes('3 rows read · changes: 2 · already as the file says: 1'), text.slice(0, 160))
  const row2 = page.locator('[data-row="2"]')
  check('preview — a change reads was → will be, in the roster’s names', (await row2.locator('[data-slot="accountantId"] [data-change="changes"]').innerText()).replace(/\s+/g, '') === 'ضحى4466→سارةالعتيبي4471', await row2.locator('[data-slot="accountantId"]').innerText())
  check('preview — the slot the file leaves alone reads as what the branch keeps', (await row2.locator('[data-slot="collectorId"] [data-change="none"]').count()) === 1)
  check('preview — an unchanged row says so', (await page.locator('[data-row="3"]').innerText()).includes('No change') && (await page.locator('[data-row="3"]').getAttribute('data-changes')) === null)
  const row4 = page.locator('[data-row="4"]')
  check('preview — the refused row is marked and says why, in the screen’s own words', (await row4.getAttribute('data-refused')) === 'true' && (await row4.innerText()).includes("'P9X9' is not an open branch.") && !(await row4.innerText()).includes('ليس'))
  check('preview — the empty slot reads as nobody', (await row4.locator('[data-slot="collectorId"]').innerText()).includes('— nobody —'))
  check('preview — the refused row is named above the grid', (await page.getByTestId('upload-blockers').innerText()).includes("Row 4: 'P9X9' is not an open branch."))
  const commitBtn = page.getByTestId('upload-commit')
  check('preview — Apply is withheld while a row is refused', (await commitBtn.getAttribute('aria-disabled')) === 'true' && (await commitBtn.innerText()).includes('Fix the refused rows first'))
  commitCalls = 0
  await commitBtn.click({ force: true })
  check('preview — …and pressing it anyway sends nothing', commitCalls === 0)
  await shot('refused-row')
  await noRawKeys('preview')

  // ---- 4. a clean file, applied once ----
  await page.getByTestId('upload-back').click()
  scenario = { preview: 'clean' }
  await chooseFile()
  await page.getByTestId('upload-preview').click()
  await page.getByTestId('upload-rows').waitFor()
  check('clean — Apply counts the branches that change', (await commitBtn.innerText()).includes('Apply to 2 branches') && (await commitBtn.getAttribute('aria-disabled')) === null)
  branchCalls = 0
  commitCalls = 0
  hold = new Promise((r) => (release = r))
  await commitBtn.dblclick()
  await commitBtn.click({ force: true, timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(200)
  check('commit — a double press (and a third) sends ONE commit', commitCalls === 1, `${commitCalls} commits`)
  check('commit — the button says it is applying', (await commitBtn.innerText()).includes('Applying…'))
  release()
  hold = null
  await page.getByTestId('upload-done-count').waitFor()
  check('commit — the same file re-sent, with the preview’s hash verbatim', lastCommitBody.includes('name="file"; filename="finance-sheet.csv"') && lastCommitBody.includes('name="contentHash"') && lastCommitBody.includes(SAMPLE.contentHash))
  check('done — the count and the branches, as the server answered', (await dialogText()).includes('2 branches assigned from the file.') && (await dialogText()).includes('Changed: P019, P021') && (await dialogText()).includes('1 row already had what the file says'))
  await page.waitForLoadState('networkidle')
  check('done — the Branches grid refetches the truth', branchCalls === 1, `${branchCalls} refetches`)
  check('done — no Apply is offered again', (await page.getByTestId('upload-commit').count()) === 0)
  await shot('done')
  await page.getByTestId('upload-close').click()
  check('done — the page says the file changed branches', (await page.locator('main').innerText()).includes('2 branches were changed from the file.'))
  await noRawKeys('done')

  // ---- 5. a re-press answer ----
  scenario = { preview: 'clean', commit: 'again' }
  await openUpload()
  await chooseFile()
  await page.getByTestId('upload-preview').click()
  await page.getByTestId('upload-rows').waitFor()
  branchCalls = 0
  await page.getByTestId('upload-commit').click()
  await page.getByTestId('upload-done-count').waitFor()
  check('re-press — accepted with applied 0 reads as nothing needed changing', (await page.getByTestId('upload-done-count').innerText()).includes('Nothing needed changing'))
  check('re-press — …and nothing is refetched', branchCalls === 0)
  await closeDialog()

  // ---- 6. refusals ----
  scenario = { preview: 'clean', commit: 'hash' }
  await openUpload()
  await chooseFile()
  await page.getByTestId('upload-preview').click()
  await page.getByTestId('upload-rows').waitFor()
  await page.getByTestId('upload-commit').click()
  await page.getByTestId('upload-refusal').waitFor()
  check('HASH_MISMATCH — the refusal says the file is not the one previewed', (await page.getByTestId('upload-refusal').innerText()).includes('This file is not the one that was previewed'))
  check('HASH_MISMATCH — Apply is replaced by Preview again', (await page.getByTestId('upload-commit').count()) === 0 && (await page.getByTestId('upload-again-footer').innerText()).includes('Preview the file again'))
  await page.getByTestId('upload-again').click()
  check('HASH_MISMATCH — Preview again returns to the file step', (await page.getByTestId('upload-preview').count()) === 1)
  await closeDialog()

  scenario = { preview: 'clean', commit: 'rows' }
  await openUpload()
  await chooseFile()
  await page.getByTestId('upload-preview').click()
  await page.getByTestId('upload-rows').waitFor()
  await page.getByTestId('upload-commit').click()
  await page.locator('[data-row="2"][data-refused="true"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('ROW_ERRORS — the row gone bad is named on the preview, by staff id and slot', (await page.locator('[data-row="2"]').innerText()).includes("Accountant '4471' is inactive on the collection roster."))
  check('ROW_ERRORS — Apply is withheld again', (await page.getByTestId('upload-commit').getAttribute('aria-disabled')) === 'true')
  await shot('row-errors')
  await closeDialog()

  await previewFile('unreadable')
  check('400 unreadable — the server’s own words, which name the problem, in English only', (await dialogText()).includes('The file has no StoreCode column.') && !(await dialogText()).includes('لا يحتوي'), await dialogText())
  await closeDialog()
  await previewFile('type')
  check('400 file type — the screen’s own sentence', (await dialogText()).includes('Only .xlsx and .csv files can be uploaded.'))
  await closeDialog()
  await previewFile('error')
  const SERVER_FAULT = 'The OMS API encountered an unexpected error. Please try again.'
  check('500 — reads as a server fault, no preview', (await dialogText()).includes(SERVER_FAULT) && (await page.getByTestId('upload-rows').count()) === 0)
  await closeDialog()
  await previewFile('forbidden')
  check('403 — the bare 403 reads as a refusal, not "unexpected (HTTP 403)"', (await dialogText()).includes('Your account is not allowed to assign branches') && !(await dialogText()).includes('403'))
  await shot('forbidden')
  await noRawKeys('refusals')
  await closeDialog()

  // ---- 6b. an answer from an earlier opening ----
  scenario = { preview: 'clean' }
  hold = new Promise((r) => (release = r))
  await openUpload()
  await chooseFile()
  await page.getByTestId('upload-preview').click()
  await closeDialog()
  await openUpload()
  release()
  hold = null
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
  check('stale — a preview answered after the dialog was closed and reopened is not drawn', (await page.getByTestId('upload-rows').count()) === 0 && (await page.getByTestId('upload-preview').count()) === 1)
  await chooseFile()
  await page.getByTestId('upload-preview').click()
  await page.getByTestId('upload-rows').waitFor()
  await page.getByTestId('upload-back').click()
  check('back — the file is picked again, not kept behind an empty picker', (await page.getByTestId('upload-file-name').count()) === 0 && (await page.getByTestId('upload-preview').getAttribute('aria-disabled')) === 'true')
  await closeDialog()

  // ---- 7. empty ----
  await previewFile('same')
  check('nothing to apply — the file already matches, and says so', (await page.getByTestId('upload-nothing').count()) === 1 && (await page.getByTestId('upload-commit').innerText()).includes('Nothing to apply') && (await page.getByTestId('upload-commit').getAttribute('aria-disabled')) === 'true')
  await noRawKeys('empty')
  await closeDialog()

  check('no page error anywhere', errors.length === 0, errors.slice(0, 3).join(' || '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
