// People upload drive (spec 334, ticket 337) — drives the REAL app in Chromium against STUBBED
// envelopes shaped exactly as BackOffice 2156 records them under `## Web contract`:
// `POST CollectionWeb/Assignment/People/Upload/Preview` (multipart `file`) and `…/Upload/Commit`
// (multipart `file` + `contentHash`), behind the EXISTING CollectionAssignment grant.
//
// ⚠️ Stubbed, never live: no SIS.Api with 2156 is up for this wave, and the assertions are about
// specific outcomes (a refused row, a hash mismatch, a re-press) a live door will not produce on
// demand.
//
// Verifies ticket 337:
//   1. the upload sits on the People tab, behind canOpenAssignment and nothing new;
//   2. the template: the four columns named, a download that is exactly the header with no BOM;
//   3. the contract's preview sample: added / updated / unchanged with current and new values, the
//      refused row with both reasons, Apply withheld;
//   4. a clean file: a double press sends ONE commit that re-sends the same file with the preview's
//      hash; the People list refetches and shows the person the file added;
//   5. a re-press answer (accepted, nothing written) reads as nothing needed changing, no refetch;
//   6. refusals: HASH_MISMATCH, ROW_ERRORS folded back, a 400 in the server's words, and the bare
//      403, which hides the upload;
//   7. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/people-upload-drive.mjs
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

const person = (staffId, displayName, role, supervisorId = '') => ({
  staffId,
  displayName,
  role,
  supervisorId,
  isActive: true,
  updatedBy: 'seed',
  updatedAt: '2026-09-01T00:00:00',
})
const ROSTER = [
  person('4401', 'عبدالله المشرف', ''),
  person('4471', 'سارة العتيبي', 'ACCOUNTANT', '4401'),
  person('5120', 'نورة', 'COLLECTOR'),
]
/** The roster after the clean file: 5120 renamed and supervised, 5134 added. */
const ROSTER_AFTER = [
  ROSTER[0],
  ROSTER[1],
  { ...person('5120', 'نورة القحطاني', 'COLLECTOR', '4401'), updatedBy: '4401' },
  { ...person('5134', 'خالد الدوسري', 'COLLECTOR', '4401'), updatedBy: '4401' },
]

/** 2156's preview sample, VERBATIM. */
const SAMPLE = {
  contentHash: '4b1d0f6a9c2e7d35a8f0c1b2e3d4f5a6978b6c5d4e3f2a1b0c9d8e7f6a5b4c3d',
  rowCount: 3,
  addedCount: 1,
  updatedCount: 1,
  unchangedCount: 1,
  canCommit: false,
  rows: [
    { rowNumber: 2, staffId: '4471', change: 'UNCHANGED',
      currentName: 'سارة العتيبي', name: 'سارة العتيبي', nameChanges: false,
      currentRole: 'ACCOUNTANT', role: 'ACCOUNTANT', roleChanges: false,
      currentSupervisorId: '4401', supervisorId: '4401', supervisorChanges: false },
    { rowNumber: 3, staffId: '5120', change: 'UPDATED',
      currentName: 'نورة', name: 'نورة القحطاني', nameChanges: true,
      currentRole: 'COLLECTOR', role: 'COLLECTOR', roleChanges: false,
      currentSupervisorId: '', supervisorId: '4401', supervisorChanges: true },
    { rowNumber: 4, staffId: '5133', change: 'ADDED',
      currentName: '', name: 'محمد ١٢', nameChanges: true,
      currentRole: '', role: 'COLLECTOR', roleChanges: true,
      currentSupervisorId: '', supervisorId: '4499', supervisorChanges: true },
  ],
  errors: [
    { rowNumber: 4, staffId: '5133', column: 'Name', code: 'NAME_NOT_STORABLE',
      message: 'The name holds characters the collection roster cannot store exactly, such as Arabic-Indic digits (١٢٣) — type them as 123, or remove them.\nيحتوي الاسم على رموز لا تحفظها قائمة موظفي التحصيل كما هي، مثل الأرقام الهندية (١٢٣) — اكتبها 123 أو احذفها.' },
    { rowNumber: 4, staffId: '5133', column: 'SupervisorId', code: 'SUPERVISOR_UNKNOWN',
      message: "Supervisor '4499' is neither on the collection roster nor a row of this file.\nالمشرف '4499' غير مسجل في قائمة موظفي التحصيل ولا مذكور في هذا الملف." },
  ],
}
/** The sheet with row 4 fixed: a new collector 5134 supervised by 4401. */
const CLEAN = {
  ...SAMPLE,
  canCommit: true,
  rows: [
    SAMPLE.rows[0],
    SAMPLE.rows[1],
    { ...SAMPLE.rows[2], staffId: '5134', name: 'خالد الدوسري', supervisorId: '4401' },
  ],
  errors: [],
}

/** 2156's commit shape, for the clean file. */
const ACCEPTED = {
  accepted: true,
  refusalReason: '',
  added: 1,
  updated: 1,
  unchanged: 1,
  addedStaffIds: ['5134'],
  updatedStaffIds: ['5120'],
  errors: [],
  updatedBy: '4401',
  updatedAt: '2026-09-30T10:14:32.517',
}
const REFUSED = { ...ACCEPTED, accepted: false, added: 0, updated: 0, addedStaffIds: [], updatedStaffIds: [], unchanged: 0, updatedBy: '', updatedAt: '0001-01-01T00:00:00' }

let roster = ROSTER
let scenario = {}
let rosterCalls = 0
let previewCalls = 0
let commitCalls = 0
let lastPreviewBody = ''
let lastCommitBody = ''
let hold = null

const fileRefusal = (code, message) =>
  envelope(null, { status: 400, success: false, message, errors: [{ errorCode: code, message }] })

const SHEET = 'StaffId,Name,Role,SupervisorId\r\n4471,سارة العتيبي,ACCOUNTANT,4401\r\n5120,نورة القحطاني,COLLECTOR,4401\r\n5134,خالد الدوسري,COLLECTOR,4401\r\n'

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
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'CollectionWeb/AssignmentOptions')
      return route.fulfill(envelope({ accountants: [], collectors: [], supervisors: [], defaultScope: null }))
    if (path === 'CollectionWeb/Assignment/People') {
      rosterCalls++
      return route.fulfill(envelope(roster))
    }
    if (path === 'CollectionWeb/Assignment/Branches') return route.fulfill(envelope([]))
    if (path === 'CollectionWeb/Assignment/People/Upload/Preview') {
      previewCalls++
      lastPreviewBody = route.request().postData() ?? ''
      if (hold) await hold
      const p = scenario.preview
      if (p === 'unreadable')
        return route.fulfill(fileRefusal('PeopleUploadFileUnreadable', 'The file has no SupervisorId column.\nلا يحتوي الملف على عمود المشرف.'))
      if (p === 'forbidden') return route.fulfill({ status: 403, body: '' })
      if (p === 'coded403')
        return route.fulfill(envelope(null, { status: 403, success: false, message: 'The roster is frozen for the month-end close.\nس', errors: [{ errorCode: 'RosterFrozen', message: 'x' }] }))
      if (p === 'clean') return route.fulfill(envelope(CLEAN))
      return route.fulfill(envelope(SAMPLE))
    }
    if (path === 'CollectionWeb/Assignment/People/Upload/Commit') {
      commitCalls++
      lastCommitBody = route.request().postData() ?? ''
      if (hold) await hold
      const c = scenario.commit
      if (c === 'again')
        return route.fulfill(envelope({ ...ACCEPTED, added: 0, updated: 0, addedStaffIds: [], updatedStaffIds: [], unchanged: 3, updatedBy: '', updatedAt: '0001-01-01T00:00:00' }))
      if (c === 'hash')
        return route.fulfill(envelope({ ...REFUSED, refusalReason: 'HASH_MISMATCH',
          errors: [{ rowNumber: 0, staffId: '', column: '', code: 'HASH_MISMATCH', message: 'This file is not the one that was previewed.\nهذا الملف' }] }))
      if (c === 'rows')
        return route.fulfill(envelope({ ...REFUSED, refusalReason: 'ROW_ERRORS',
          errors: [{ rowNumber: 3, staffId: '5120', column: 'Role', code: 'ROLE_CHANGE_ORPHANS_BRANCHES', message: 'x\nس' }] }))
      roster = ROSTER_AFTER
      return route.fulfill(envelope(ACCEPTED))
    }
    return route.fulfill(envelope({}))
  })

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/337-${name}.png`, fullPage: true })
  const dialog = () => page.locator('[data-region="people-upload"]')
  const dialogText = async () => (await dialog().innerText()).replace(/\s+/g, ' ')
  const mainText = async () => (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    const raw = text.match(/\b(assignment|collection|common|upload|peopleUpload)\.[a-zA-Z]+(\.[a-zA-Z_]+)*\b/g) ?? []
    check(`${where} — no raw t() key on screen`, raw.length === 0, raw.join(', '))
  }
  const openUpload = async () => {
    await page.getByTestId('people-upload-open').click()
    await dialog().waitFor()
  }
  const chooseFile = async (name = 'people.csv') =>
    page.getByTestId('people-upload-file').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(SHEET) })
  const preview = async (sc, commit) => {
    scenario = { preview: sc, commit }
    await openUpload()
    await chooseFile()
    await page.getByTestId('people-upload-preview').click()
    await page
      .locator('[data-testid="people-upload-rows"], [data-region="people-upload"] [role="alert"]')
      .first()
      .waitFor({ timeout: 8000 })
      .catch(() => {})
  }
  const closeDialog = async () => {
    await page.keyboard.press('Escape')
    await dialog().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  }

  // ---- 1. the People tab ----
  await page.goto(BASE + ROUTE)
  await page.waitForLoadState('networkidle')
  check('branches tab — the people upload is not on it', (await page.getByTestId('people-upload-open').count()) === 0)
  await page.getByRole('tab', { name: 'People' }).click()
  check('people tab — the upload sits beside the roster, on the existing grant', (await page.getByTestId('people-upload-open').count()) === 1)

  // ---- 2. the template ----
  await openUpload()
  const cols = await page.locator('[data-region="people-upload-template"] [data-column]').evaluateAll((els) => els.map((e) => e.getAttribute('data-column')))
  check('template — the four columns, named as the door reads them', cols.join(',') === 'StaffId,Name,Role,SupervisorId', cols.join(','))
  check('template — a blank cell is said to be a value', (await page.getByTestId('people-upload-blank-rule').innerText()).includes('A blank cell is a value'))
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('people-upload-template-download').click()])
  const bytes = readFileSync(await download.path())
  check('template — the download is the header alone, no BOM', download.suggestedFilename() === 'collection-people-template.csv' && bytes.toString('utf8') === 'StaffId,Name,Role,SupervisorId\r\n' && bytes[0] !== 0xef, JSON.stringify(bytes.toString('utf8')))
  check('template — Preview waits for a file', (await page.getByTestId('people-upload-preview').getAttribute('aria-disabled')) === 'true')
  await shot('file-step')
  await noRawKeys('file step')
  await closeDialog()

  // ---- 3. the contract sample ----
  previewCalls = 0
  await preview('sample')
  check('preview — one multipart call carrying the file part', previewCalls === 1 && lastPreviewBody.includes('name="file"; filename="people.csv"'))
  const text = await dialogText()
  check('preview — the summary counts added, updated and unchanged', text.includes('3 rows read · added: 1 · updated: 1 · unchanged: 1'), text.slice(0, 160))
  const row = (n) => page.locator(`[data-row="${n}"]`)
  check('preview — each row says added / updated / unchanged', (await row(2).getAttribute('data-change')) === 'UNCHANGED' && (await row(3).getAttribute('data-change')) === 'UPDATED' && (await row(4).getAttribute('data-change')) === 'ADDED' && (await row(2).innerText()).includes('Unchanged') && (await row(3).innerText()).includes('Updated') && (await row(4).innerText()).includes('Added'))
  check('preview — an updated name reads current → new', (await row(3).locator('[data-field="name"] [data-change="changes"]').innerText()).replace(/\s+/g, '') === 'نورة→نورةالقحطاني', await row(3).locator('[data-field="name"]').innerText())
  check('preview — a supervisor set from nobody reads nobody → the roster’s name', (await row(3).locator('[data-field="supervisor"]').innerText()).replace(/\s+/g, '') === '—nobody—→عبدالله المشرف4401'.replace(/\s+/g, ''), await row(3).locator('[data-field="supervisor"]').innerText())
  check('preview — an unchanged role reads as what the person keeps', (await row(3).locator('[data-field="role"] [data-change="none"]').innerText()).includes('Collector'))
  check('preview — an added person shows the new values only', (await row(4).locator('[data-change="changes"]').count()) === 0 && (await row(4).innerText()).includes('محمد ١٢'))
  check('preview — the refused row wears both reasons, in the screen’s words', (await row(4).getAttribute('data-refused')) === 'true' && (await row(4).locator('[data-testid="people-upload-row-issue"]').count()) === 2 && (await row(4).innerText()).includes("Supervisor '4499' is neither on the collection roster nor a row of this file.") && (await row(4).innerText()).includes('Arabic-Indic digits') && !(await row(4).innerText()).includes('غير مسجل'))
  check('preview — the refused row is named above the grid', (await page.getByTestId('people-upload-blockers').innerText()).includes("Row 4: Supervisor '4499'"))
  const commitBtn = page.getByTestId('people-upload-commit')
  check('preview — Apply is disabled while a row is refused', (await commitBtn.getAttribute('aria-disabled')) === 'true' && (await commitBtn.innerText()).includes('Fix the refused rows first'))
  commitCalls = 0
  await commitBtn.click({ force: true })
  check('preview — …and pressing it anyway sends nothing', commitCalls === 0)
  await shot('refused-row')
  await noRawKeys('preview')

  // ---- 4. a clean file, applied once ----
  await page.getByTestId('people-upload-back').click()
  scenario = { preview: 'clean' }
  await chooseFile()
  await page.getByTestId('people-upload-preview').click()
  await page.getByTestId('people-upload-rows').waitFor()
  check('clean — a supervisor-less id the file names resolves; Apply counts the people', (await commitBtn.innerText()).includes('Apply to 2 people') && (await commitBtn.getAttribute('aria-disabled')) === null)
  rosterCalls = 0
  commitCalls = 0
  let release
  hold = new Promise((r) => (release = r))
  await commitBtn.dblclick()
  await commitBtn.click({ force: true, timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(200)
  check('commit — a double press (and a third) sends ONE commit', commitCalls === 1, `${commitCalls} commits`)
  check('commit — the button says it is applying', (await commitBtn.innerText()).includes('Applying…'))
  release()
  hold = null
  await page.getByTestId('people-upload-done-count').waitFor()
  check('commit — the same file re-sent, with the preview’s hash verbatim', lastCommitBody.includes('name="file"; filename="people.csv"') && lastCommitBody.includes('name="contentHash"') && lastCommitBody.includes(SAMPLE.contentHash) && lastCommitBody.includes('خالد الدوسري'))
  check('done — the counts and the people, as the server answered', (await dialogText()).includes('1 added and 1 updated from the file.') && (await dialogText()).includes('Added: 5134') && (await dialogText()).includes('Updated: 5120'))
  await page.waitForLoadState('networkidle')
  check('done — the People list refetches the roster', rosterCalls === 1, `${rosterCalls} refetches`)
  await shot('done')
  await page.getByTestId('people-upload-close').click()
  const listed = await mainText()
  check('done — the added person is in the list, and the renamed one is renamed', listed.includes('5134') && listed.includes('خالد الدوسري') && listed.includes('نورة القحطاني'))
  check('done — the tab says people were added or updated', (await page.getByTestId('people-upload-notice').innerText()).includes('2 people were added or updated from the file.'))
  await noRawKeys('done')

  // ---- 5. a re-press answer ----
  rosterCalls = 0
  await preview('clean', 'again')
  await page.getByTestId('people-upload-commit').click()
  await page.getByTestId('people-upload-done-count').waitFor()
  check('re-press — accepted with nothing written reads as nothing needed changing', (await page.getByTestId('people-upload-done-count').innerText()).includes('Nothing needed changing'))
  await page.waitForLoadState('networkidle')
  check('re-press — …and the list is not refetched', rosterCalls === 0)
  await closeDialog()

  // ---- 6. refusals ----
  await preview('clean', 'hash')
  await page.getByTestId('people-upload-commit').click()
  await page.getByTestId('people-upload-refusal').waitFor()
  check('HASH_MISMATCH — the refusal says the file is not the one previewed', (await page.getByTestId('people-upload-refusal').innerText()).includes('This file is not the one that was previewed'))
  check('HASH_MISMATCH — Apply is replaced by Preview again', (await page.getByTestId('people-upload-commit').count()) === 0 && (await page.getByTestId('people-upload-again-footer').innerText()).includes('Preview the file again'))
  await shot('hash-mismatch')
  await closeDialog()

  await preview('clean', 'rows')
  await page.getByTestId('people-upload-commit').click()
  await row(3).and(page.locator('[data-refused="true"]')).waitFor({ timeout: 5000 }).catch(() => {})
  check('ROW_ERRORS — the row gone bad is named on the preview', (await row(3).innerText()).includes("'5120' still serves branches in their current role."))
  check('ROW_ERRORS — Apply is withheld again', (await page.getByTestId('people-upload-commit').getAttribute('aria-disabled')) === 'true')
  await closeDialog()

  await preview('unreadable')
  check('400 unreadable — the server’s own words, in English only', (await dialogText()).includes('The file has no SupervisorId column.') && !(await dialogText()).includes('لا يحتوي'), await dialogText())
  await closeDialog()

  await preview('coded403')
  check('403 with a code — the server’s own words, and the upload stays', (await dialogText()).includes('The roster is frozen for the month-end close.') && (await page.getByTestId('people-upload-file').count()) === 1)
  await closeDialog()
  check('403 with a code — the button is still on the tab', (await page.getByTestId('people-upload-open').count()) === 1)

  await preview('forbidden')
  check('403 — the dialog says the account may not maintain the roster, and offers no picker', (await dialogText()).includes('not allowed to maintain the collection roster') && (await page.getByTestId('people-upload-file').count()) === 0 && !(await dialogText()).includes('403'))
  await shot('forbidden')
  await page.getByTestId('people-upload-close').click()
  check('403 — the upload is gone from the People tab', (await page.getByTestId('people-upload-open').count()) === 0)
  check('403 — the roster itself is still shown', (await mainText()).includes('سارة العتيبي'))
  await noRawKeys('refusals')

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
