// Settlement description drive (spec 308, ticket 311) — drives the REAL app in Chromium
// against STUBBED envelopes shaped exactly as BackOffice 1980 records them under
// `## Web contract`: the accountant's description (`reason`) is REQUIRED on
// `Settlement/Post` (400 `SettlementReasonRequired`, message English then Arabic) and on
// every row of `Settlement/Bulk/Preview` / `Commit` (`REASON_REQUIRED` in `errors[]`,
// the commit answering `ROW_ERRORS`).
//
// ⚠️ Stubbed, never live: no SIS.Api with 1980 is up for this wave, and the assertions
// are about behaviour on SPECIFIC answers (a refusal), which a live door will not
// produce on demand for a description the form already refuses. The branch is 309's
// `approval-fixture.ts` (0719); the bulk files are `bulk-fixture.ts`'s.
//
// Verifies ticket 311's screen Proof:
//   1. the single post: the box is marked required; an empty or spaces-only description
//      blocks Review and SAYS why; a padded one is posted trimmed, in the contract's body;
//   2. the server's refusal (SettlementReasonRequired) is its own sentence, and the form
//      goes back to the box with the text still in it; loading and error on the branch;
//   3. the template marks the description column required, and its file still reads
//      `StoreCode,Amount,Reason` with a description on every example row;
//   4. the upload: loading, an empty answer, an error, and a REASON_REQUIRED row shown
//      AGAINST its row (and in the blocker list), with the commit blocked;
//   5. a commit refused with ROW_ERRORS lands back on the preview with the row named;
//   6. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-description-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/settlement'
const UPLOAD_ROUTE = `${ROUTE}/upload`

/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

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

const ACCESS = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenSettlement: true,
  canSuperviseSettlement: false,
}

/** The server's own sentence, verbatim — `SettlementAccountantService.ReasonRequiredMessage`
 *  on BackOffice main (1980 §1 records its shape, English then Arabic on the next line,
 *  but not its words). */
const REQUIRED_MESSAGE =
  "A description is required — it prints on the branch's papers, so no entry is posted without one.\n" +
  'البيان مطلوب — يُطبع على أوراق الفرع، فلا يُرحَّل قيد بدونه.'

let scenario = {}
let FX = null
let postCalls = []
let previewCalls = 0
let commitCalls = 0
/** Held open to show a loading state; released by the scenario. */
let hold = null

const reset = (flags = {}) => {
  scenario = { ...flags }
  postCalls = []
  previewCalls = 0
  commitCalls = 0
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, acceptDownloads: true })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]

    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCESS))
    if (path === 'Settlement/Branches') {
      if (scenario.holdBranches && hold) await hold.promise
      if (scenario.branchesFail)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The server fell over.' }))
      return route.fulfill(
        envelope([{ storeId: FX.store, storeName: FX.storeName, city: 'Riyadh', area: 'Central', servedBy: '', isMine: true }]),
      )
    }
    if (path === 'Settlement/Account')
      return route.fulfill(envelope({ storeId: FX.store, storeName: FX.storeName, entries: FX.entries, consumptions: [] }))
    if (path === 'Settlement/Post') {
      const body = route.request().postDataJSON()
      postCalls.push(body)
      // 🔑 1980 §1: a blank description is a 400 through the envelope. `refuse` makes the
      // stub refuse whatever arrives — the only way to reach the server's refusal from a
      // form that already refuses a blank one.
      if (scenario.refuse || !(body.reason ?? '').trim())
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: REQUIRED_MESSAGE,
            errors: [{ errorCode: 'SettlementReasonRequired', errorMessage: REQUIRED_MESSAGE }],
          }),
        )
      // 1980 §1's sample response, echoing the trimmed reason.
      return route.fulfill(
        envelope({
          settlementEntryId: '01J9ZC4K7Q2M8V5T3N6R1X0B9D',
          entryNumber: 1042,
          storeId: body.storeId,
          storeName: FX.storeName,
          entryKind: body.entryKind,
          amount: body.amount,
          reason: body.reason.trim(),
          postedByStaffId: 'ACC1',
          postedByName: 'Accountant One',
          postedAt: '2026-09-24T19:05:11.203',
          status: 'OPEN',
        }),
      )
    }
    if (path === 'Settlement/Bulk/Preview') {
      previewCalls++
      if (hold) await hold.promise
      if (scenario.previewFails)
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The file yielded no rows.',
            errors: [{ errorCode: 'SettlementBulkEmpty', errorMessage: 'The file yielded no rows.' }],
          }),
        )
      if (scenario.emptyPreview)
        return route.fulfill(envelope({ ...FX.clean, rows: [], rowCount: 0, total: 0, canCommit: false }))
      return route.fulfill(envelope(scenario.blank ? FX.blank : FX.clean))
    }
    if (path === 'Settlement/Bulk/Commit') {
      commitCalls++
      // 1980 §2: the commit of a file with blank rows — nothing posted, the same errors.
      return route.fulfill(
        envelope({
          batchId: FX.clean.batchId,
          accepted: false,
          refusalReason: 'ROW_ERRORS',
          posted: 0,
          replayed: false,
          entryNumbers: [],
          // Two refusals on row 3 — the sentence must still count ONE row.
          errors: [...FX.blank.errors, { ...FX.blank.errors[0], code: 'AMOUNT_ROUNDS_TO_ZERO', message: 'Rounds to nothing.' }],
          warnings: [],
        }),
      )
    }
    if (path === 'Settlement/Ledger' || path === 'Settlement/Uncollected' || path === 'Settlement/Orphans' || path === 'Settlement/Fleet')
      return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const appears = async (selector, timeout = 8000) =>
    page.waitForSelector(selector, { timeout }).then(() => true).catch(() => false)
  const bodyText = async () => page.locator('body').innerText()
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(150)
  }
  const go = async (to) => {
    await page.goto(BASE + to)
    await settle()
  }
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true })
  const noRawKeys = async (where) => {
    const text = await bodyText()
    check(`${where} → no raw t() key on screen`, !/\b(post|bulk|reasonField)\.[a-z]+\.?[a-zA-Z]*\b|settlement:/.test(text))
  }
  const reviewBlocked = async () =>
    (await page.locator('[data-testid="post-review"]').getAttribute('aria-disabled')) === 'true'
  const openPost = async () => {
    await go(ROUTE)
    await page.locator('[data-testid="post-open"]').first().click()
    await appears('[data-region="post-entry"]')
  }
  const fillPost = async (reason) => {
    await page.locator('[data-testid="post-branch"]').fill(FX.store)
    await page.locator('[data-testid="post-amount"]').fill('250')
    await page.locator('[data-testid="post-reason"]').fill(reason)
    await page.waitForTimeout(120)
  }
  const reasonError = () => page.locator('[data-testid="post-reason-error"]')

  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  FX = await page.evaluate(async () => {
    const a = await import('/src/features/collection/settlement/approval-fixture.ts')
    const b = await import('/src/features/collection/settlement/bulk-fixture.ts')
    return {
      entries: a.APPROVAL_ENTRIES,
      store: a.APPROVAL_STORE,
      storeName: a.APPROVAL_STORE_NAME,
      clean: b.CLEAN_PREVIEW,
      blank: b.BLANK_DESCRIPTION_PREVIEW,
    }
  })

  // ---- 1. the single post: required, said, and sent trimmed ----
  reset()
  await openPost()
  check('🔑 the description box is marked required — in words on the label, and to assistive tech',
    (await page.locator('[data-testid="post-reason-required"]').innerText()).trim() === 'required' &&
      (await page.locator('[data-testid="post-reason"]').getAttribute('aria-required')) === 'true')
  check('…a form just opened says nothing is missing yet', (await reasonError().count()) === 0)
  check('the hint says why: it prints on the branch’s papers', (await page.locator('[data-region="post-reason"]').innerText()).includes("prints on the branch's papers"))
  await fillPost('')
  check('🔑 with branch and amount but no description, Review is blocked', await reviewBlocked())
  // `force`: the button is aria-disabled, which Playwright will not press — a person can.
  await page.locator('[data-testid="post-review"]').click({ force: true })
  await page.waitForTimeout(120)
  check('🔑 …and pressing it SAYS why, instead of doing nothing',
    (await reasonError().count()) === 1 && (await reasonError().innerText()).includes('Write a description') &&
      (await page.locator('[data-testid="post-reason"]').getAttribute('aria-invalid')) === 'true' &&
      (await page.locator('[data-region="post-review"]').count()) === 0)
  await noRawKeys('the post form, description missing')
  await shot('311-post-required')

  await page.locator('[data-testid="post-reason"]').fill('     ')
  await page.waitForTimeout(120)
  check('🔑 a description of only spaces is blank — Review stays blocked and the error stays', (await reviewBlocked()) && (await reasonError().count()) === 1)

  await page.locator('[data-testid="post-reason"]').fill('  مرتجع شبكة — فاتورة 1042  ')
  await page.waitForTimeout(120)
  check('a real description clears the error and opens Review', !(await reviewBlocked()) && (await reasonError().count()) === 0)
  await page.locator('[data-testid="post-review"]').click()
  await appears('[data-region="post-review"]')
  check('the review step reads the description back trimmed', (await page.locator('[data-testid="post-review-reason"]').innerText()) === 'مرتجع شبكة — فاتورة 1042')
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  check('🔑 the post body is the contract’s four fields, the description TRIMMED',
    postCalls.length === 1 &&
      JSON.stringify(postCalls[0]) === JSON.stringify({ storeId: FX.store, entryKind: 'SHORTAGE', amount: 250, reason: 'مرتجع شبكة — فاتورة 1042' }),
    JSON.stringify(postCalls))
  check('…and the entry is posted', (await page.locator('[data-region="post-done"]').getAttribute('data-entry')) === '1042')
  check('no post was sent while the description was missing', postCalls.length === 1)

  // ---- 2. the server's refusal, and the branch box's loading and error ----
  reset({ refuse: true })
  await openPost()
  await fillPost('Stocktake difference')
  await page.locator('[data-testid="post-review"]').click()
  await appears('[data-region="post-review"]')
  await page.locator('[data-testid="post-commit"]').click()
  await appears('text=A description is required')
  await settle()
  let text = await bodyText()
  check('🔑 SettlementReasonRequired is the SERVER’s sentence — never "could not be posted"', text.includes("A description is required — it prints on the branch's papers") && !text.includes('The entry could not be posted.'))
  check('…and the form goes back to the box, with the text still in it',
    (await page.locator('[data-region="post-review"]').count()) === 0 &&
      (await page.locator('[data-testid="post-reason"]').inputValue()) === 'Stocktake difference' &&
      (await page.locator('[data-region="post-done"]').count()) === 0)
  await shot('311-post-refused')
  check('🔑 …standing ON the description box, English then Arabic on its own line',
    (await reasonError().innerText()) === REQUIRED_MESSAGE &&
      (await page.locator('[data-testid="post-reason"]').getAttribute('aria-invalid')) === 'true')
  await page.locator('[data-testid="post-reason"]').fill('Stocktake difference, July')
  await page.waitForTimeout(120)
  check('…and it steps aside once the text it refused is changed', (await reasonError().count()) === 0)

  reset({ holdBranches: true })
  let release
  hold = { promise: new Promise((r) => (release = r)) }
  await page.goto(BASE + ROUTE)
  await page.locator('[data-testid="post-open"]').first().click()
  await appears('[data-region="post-entry"]')
  await page.locator('[data-testid="post-branch"]').fill(FX.store)
  await page.locator('[data-testid="post-reason"]').fill('x')
  check('while the estate loads, the branch box says so and Review is blocked', (await page.locator('[data-region="post-branch"]').innerText()).includes('Loading the estate') && (await reviewBlocked()))
  release()
  hold = null
  reset({ branchesFail: true })
  await openPost()
  check('an estate that failed to load is said, not read as “no such branch”', (await appears('[data-testid="post-branch-unavailable"]')) && (await page.locator('[data-testid="post-branch-none"]').count()) === 0)

  // ---- 3. the template ----
  reset()
  await go(UPLOAD_ROUTE)
  await appears('[data-region="bulk-template"]')
  check('🔑 the template marks the description column required',
    (await page.locator('[data-region="bulk-template"] [data-column="Reason"]').getAttribute('data-required')) === 'true' &&
      (await page.locator('[data-region="bulk-template"] [data-column="Reason"]').innerText()).includes('required'))
  check('…and says why, and that a row without one is refused', (await page.locator('[data-region="bulk-template"] [data-column="Reason"]').innerText()).includes('A row without one is refused'))
  check('every column of the three is marked — none of them may be left out', (await page.locator('[data-region="bulk-template"] [data-required="true"]').count()) === 3)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-testid="bulk-template-download"]').click(),
  ])
  const fs = await import('node:fs/promises')
  const csv = await fs.readFile(await download.path(), 'utf8')
  const lines = csv.split('\r\n').filter(Boolean)
  check('the downloaded file still leads with StoreCode,Amount,Reason — the door reads the header by name', lines[0] === 'StoreCode,Amount,Reason', lines[0])
  check('…and every example row carries a description', lines.slice(1).every((l) => l.split(',')[2]?.trim()), lines.slice(1).join(' | '))
  await noRawKeys('the template')
  await shot('311-template')

  // ---- 4. the upload: loading, empty, error, and a blank row refused ON its row ----
  const upload = async () => {
    await page.locator('[data-testid="bulk-file"]').setInputFiles({ name: 'july.csv', mimeType: 'text/csv', buffer: Buffer.from('StoreCode,Amount,Reason\n0142,500,x\n0207,1250.5,\n') })
    await page.locator('[data-testid="bulk-preview"]').click()
  }
  reset({ blank: true })
  await go(UPLOAD_ROUTE)
  hold = { promise: new Promise((r) => (release = r)) }
  await upload()
  await page.waitForTimeout(200)
  check('while the server reads the file, the screen says so', (await bodyText()).includes('Sending the file and reading it back'))
  release()
  hold = null
  await appears('[data-testid="bulk-rows"]')
  await settle()
  const row3 = page.locator('[data-testid="bulk-rows"] tr[data-row="3"]')
  check('🔑 row 3 wears the server’s refusal — on the row itself', (await row3.getAttribute('data-refused')) === 'true' && (await row3.locator('[data-testid="bulk-row-error"]').innerText()).includes('This row has no description'))
  check('…in both of the server’s languages, as it sent them', (await row3.locator('[data-testid="bulk-row-error"]').innerText()).includes('هذا السطر بلا بيان'))
  check('…its blank cell says “No description” rather than nothing', (await row3.locator('[data-testid="bulk-row-no-description"]').innerText()) === 'No description')
  check('…and no other row is marked refused', (await page.locator('[data-testid="bulk-rows"] tr[data-refused="true"]').count()) === 1)
  check('the blocker list names the same row', (await page.locator('[data-testid="bulk-blockers"] [data-blocker-row="3"]').innerText()).includes('Row 3'))
  check('🔑 nothing in the file can be posted', (await page.locator('[data-testid="bulk-commit"]').getAttribute('aria-disabled')) === 'true')
  await page.locator('[data-testid="bulk-commit"]').click({ force: true })
  await page.waitForTimeout(200)
  check('…and pressing the blocked button sends nothing', commitCalls === 0)
  await noRawKeys('the refused preview')
  await shot('311-bulk-refused-row')

  reset({ emptyPreview: true })
  await go(UPLOAD_ROUTE)
  await upload()
  await appears('[data-testid="bulk-rows"]')
  await settle()
  check('an answer with no rows previews as empty and cannot commit', (await page.locator('[data-testid="bulk-rows"] tbody tr').count()) === 0 && (await page.locator('[data-testid="bulk-commit"]').getAttribute('aria-disabled')) === 'true')

  reset({ previewFails: true })
  await go(UPLOAD_ROUTE)
  await upload()
  await appears('text=The file yielded no rows.')
  check('a 400 on the preview is the server’s own sentence, and the file step stays', (await bodyText()).includes('The file yielded no rows.') && (await page.locator('[data-testid="bulk-file"]').count()) === 1)

  // ---- 5. a commit refused with ROW_ERRORS lands back on the preview ----
  reset()
  await go(UPLOAD_ROUTE)
  await upload()
  await appears('[data-testid="bulk-rows"]')
  await settle()
  check('a clean preview can commit', (await page.locator('[data-testid="bulk-commit"]').getAttribute('aria-disabled')) === null)
  await page.locator('[data-testid="bulk-commit"]').click()
  await appears('[data-testid="bulk-rows"] tr[data-refused="true"]')
  await settle()
  text = await bodyText()
  check('🔑 ROW_ERRORS lands back on the preview, the refused row named ON the grid',
    commitCalls === 1 && (await page.locator('[data-testid="bulk-rows"] tr[data-row="3"]').getAttribute('data-refused')) === 'true' && (await page.locator('[data-region="bulk-done"]').count()) === 0)
  check('…said in words, never the machine code', text.includes('the server refused 1 row, named in the grid') && !text.includes('ROW_ERRORS'))
  check('…and the commit is blocked until the sheet is fixed', (await page.locator('[data-testid="bulk-commit"]').getAttribute('aria-disabled')) === 'true')
  await noRawKeys('the ROW_ERRORS preview')
  await shot('311-bulk-row-errors')

  check('no page error and no React crash, across every scenario', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
