// Settlement approval drive (spec 308, ticket 309) — drives the REAL app in Chromium
// against STUBBED envelopes shaped exactly as BackOffice 1977 / 1978 record them under
// `## Web contract`. A drive of its own rather than a section of settlement-drive.mjs:
// that file is 3,500 lines of spec 267/282's estate, and this ticket's question — what
// counts as money once a supervisor is in the loop — is served by its own fixture
// (`approval-fixture.ts`, the bytes approval.test.ts pins).
//
// ⚠️ Stubbed, never live: no SIS.Api with 1977/1978 is up for this wave, and the
// assertions are about behaviour on SPECIFIC answers (a refusal, a bare 403), which a
// live door will not produce on demand.
//
// Verifies ticket 309's screen Proof:
//   1. the account: pending and rejected are LABELLED, the headline counts OPEN only
//      (keeps back 920, not 2,970), and the pending pair is counted beside it;
//   2. an accountant sees the wait and the rejection's reason — and no Approve/Reject;
//   3. a supervisor approves from the account: the dialog shows amount, branch, poster
//      and description, the body names the entry only, and the headline moves;
//   4. the queue (Open settlements ▸ Awaiting approval): loading, rows, Reject needs a
//      reason, a refusal (somebody got there first), a bare 403, empty, error;
//   5. the open lane's counts never include a pending row, even when the door sends one;
//   6. the ledger can be asked for pending and rejected;
//   7. the bulk preview marks the rows that will wait and still commits;
//   8. a posted 500 surplus confirms it waits;
//   9. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-approval-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/settlement'
const OPEN_ROUTE = `${ROUTE}/open`
const LEDGER_ROUTE = `${ROUTE}/ledger`
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

const ACCOUNTANT = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenSettlement: true,
  canSuperviseSettlement: false,
}
const SUPERVISOR = { ...ACCOUNTANT, canSuperviseSettlement: true }

let scenario = {}
let FX = null
/** The entries the stub holds — a deep copy per scenario, so an approve in one does
 *  not leak into the next. */
let entries = []
let queueExtra = []
let approveCalls = []
let rejectCalls = []
let ledgerCalls = []
let accessCalls = 0
let postCalls = []
/** Held open to show the queue's loading state; released by the scenario. */
let releaseQueue = null

const reset = (flags = {}) => {
  scenario = { access: ACCOUNTANT, ...flags }
  entries = structuredClone(FX.entries)
  queueExtra = structuredClone(FX.lane.filter((r) => r.storeId !== FX.store))
  approveCalls = []
  rejectCalls = []
  ledgerCalls = []
  postCalls = []
  accessCalls = 0
}

/** What the ledger door answers for a status: the stub plays the server, reading the
 *  same entries the account door serves, labelled as a lane row. */
const asLaneRow = (e) => {
  const lane = FX.lane.find((r) => r.settlementEntryId === e.settlementEntryId)
  return lane
    ? { ...lane, ...e }
    : { ...e, storeName: FX.storeName, currencyKey: 'SAR', servedBy: '', isMine: true, ageDays: 3 }
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = route.request().url().split('/api/')[1].split('?')[0]
    const q = (k) => url.searchParams.get(k) || ''

    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') {
      accessCalls++
      // After a 403 the probe is re-read and — as an administrator took the grant —
      // now answers without supervision.
      return route.fulfill(envelope(scenario.revoked ? ACCOUNTANT : scenario.access))
    }
    if (path === 'Settlement/Account') {
      if (scenario.accountFails)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'Account read failed.' }))
      if (q('storeId') !== FX.store) return route.fulfill(envelope({ storeId: q('storeId'), storeName: '', entries: [], consumptions: [] }))
      return route.fulfill(envelope({ storeId: FX.store, storeName: FX.storeName, entries, consumptions: [] }))
    }
    if (path === 'Settlement/Ledger') {
      const status = q('status')
      ledgerCalls.push(Object.fromEntries([...url.searchParams]))
      if (status === 'PENDING_APPROVAL' && q('sort') === 'age') {
        if (releaseQueue) await releaseQueue.promise
        if (scenario.queueFails)
          return route.fulfill(envelope(null, { status: 500, success: false, message: 'Ledger read failed.' }))
        if (scenario.queueEmpty) return route.fulfill(envelope([]))
        const rows = [...entries.filter((e) => e.status === 'PENDING_APPROVAL').map(asLaneRow), ...queueExtra.filter((r) => r.status === 'PENDING_APPROVAL')]
        return route.fulfill(envelope(rows.sort((a, b) => (a.postedAt < b.postedAt ? -1 : 1))))
      }
      if (status === 'OPEN' && q('sort') === 'age') {
        // ⚠️ A door answering WIDER than asked — one pending surplus rides in with the
        // open ones — so the drive can see the tab counts refuse to count it.
        const rows = entries.filter((e) => e.status === 'OPEN' || e.entryNumber === 1202).map(asLaneRow)
        return route.fulfill(envelope(rows))
      }
      return route.fulfill(envelope(entries.filter((e) => !status || e.status === status).map(asLaneRow)))
    }
    if (path === 'Settlement/Approve' || path === 'Settlement/Reject') {
      const body = route.request().postDataJSON()
      const approving = path === 'Settlement/Approve'
      ;(approving ? approveCalls : rejectCalls).push(body)
      // The bare 403 the door answers a session without settlement supervision: no body.
      if (scenario.supervision403) return route.fulfill({ status: 403, body: '' })
      if (!approving && !(body.reason ?? '').trim())
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'A reason is required.',
            errors: [{ errorCode: 'SettlementRejectReasonRequired', errorMessage: 'A reason is required.' }],
          }),
        )
      const entry = entries.find((e) => e.settlementEntryId === body.settlementEntryId) ??
        queueExtra.find((e) => e.settlementEntryId === body.settlementEntryId)
      // 🔑 Somebody got there first: another supervisor approved this one a moment ago.
      if (entry && scenario.takenFirst === entry.settlementEntryId) entry.status = 'OPEN'
      if (!entry || entry.status !== 'PENDING_APPROVAL')
        return route.fulfill(
          envelope({
            accepted: false,
            refusalReason: 'ENTRY_NOT_PENDING',
            remainingAmount: entry?.remainingAmount ?? 0,
            status: entry?.status ?? '',
          }),
        )
      entry.status = approving ? 'OPEN' : 'REJECTED'
      if (approving) Object.assign(entry, { approvedByStaffId: 'SUP1', approvedAt: '2026-09-25T09:00:00' })
      else Object.assign(entry, { rejectedByStaffId: 'SUP1', rejectedAt: '2026-09-25T09:00:00', rejectedReason: body.reason })
      return route.fulfill(
        envelope({ accepted: true, refusalReason: '', remainingAmount: entry.remainingAmount, status: entry.status }),
      )
    }
    if (path === 'Settlement/Branches')
      return route.fulfill(
        envelope([
          { storeId: FX.store, storeName: FX.storeName, city: 'Riyadh', area: 'Central', servedBy: '', isMine: true },
        ]),
      )
    if (path === 'Settlement/Post') {
      const body = route.request().postDataJSON()
      postCalls.push(body)
      // The stub plays SettlementApprovalRule: a SURPLUS of 500 or more, posted by a
      // session without supervision, waits.
      const waits = body.entryKind === 'SURPLUS' && Number(body.amount) >= 500 && !scenario.access.canSuperviseSettlement
      return route.fulfill(
        envelope({ settlementEntryId: '01J9APPRPOST', entryNumber: 1300, amount: Number(body.amount), status: waits ? 'PENDING_APPROVAL' : 'OPEN' }),
      )
    }
    if (path === 'Settlement/Bulk/Preview') return route.fulfill(envelope(FX.preview))
    if (path === 'Settlement/Uncollected' || path === 'Settlement/Orphans' || path === 'Settlement/Fleet')
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
    check(`${where} → no raw t() key on screen`, !/\bapproval\.[a-z]|settlement:|open\.(tabs|columns|empty)\.|bulk\.review\.[a-z]/.test(text))
  }

  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  FX = await page.evaluate(async () => {
    const m = await import('/src/features/collection/settlement/approval-fixture.ts')
    return {
      entries: m.APPROVAL_ENTRIES,
      lane: m.PENDING_LANE,
      preview: m.APPROVAL_PREVIEW,
      store: m.APPROVAL_STORE,
      storeName: m.APPROVAL_STORE_NAME,
      reason: m.REJECTED_REASON,
    }
  })

  // ---- 1. the account, as an accountant ----
  reset()
  await go(`${ROUTE}?store=${FX.store}`)
  let text = await page.locator('[data-region="account-headline"]').innerText()
  check('🔑 the headline keeps back 920 — the pending 1,350 and the rejected 700 are not money', text.includes('920.00') && !text.includes('2,970') && !text.includes('3,270'), text.replace(/\n/g, ' '))
  check('…owes 300 and nets to 620 kept back', text.includes('300.00') && text.includes('620.00') && text.includes('may keep back'))
  check('…with 3 entries open, and the 2 pending counted BESIDE the figures', /entries open\s*3/i.test(text) && (await page.locator('[data-testid="account-pending-count"]').innerText()).startsWith('2 surpluses wait'))
  const grid = await page.locator('[data-region="branch-account"] .ag-root-wrapper').first().innerText()
  check('pending and rejected rows are LABELLED in the grid', grid.includes('Awaiting approval') && grid.includes('Rejected'))
  await noRawKeys('the account')

  // ---- 2. an accountant: the wait, the reason, and no buttons ----
  await go(`${ROUTE}?store=${FX.store}&entry=1202`)
  await appears('[data-region="entry-approval"]')
  check('an accountant on a pending entry sees that it waits', (await page.locator('[data-region="entry-approval"]').getAttribute('data-approval')) === 'waiting' && (await page.locator('[data-testid="approval-waiting"]').innerText()).includes('No till can see it'))
  check('🚩 …and is offered NO Approve and NO Reject', (await page.locator('[data-testid="approval-open-approve"], [data-testid="approval-open-reject"]').count()) === 0)
  check('…nor a Cancel: the correction panel says why there is nothing to correct', (await page.locator('[data-testid="correction-act"]').count()) === 0 && (await page.locator('[data-testid="correction-none"]').innerText()).includes('waits for a supervisor'))
  await go(`${ROUTE}?store=${FX.store}&entry=1204`)
  await appears('[data-testid="approval-rejected"]')
  const rejected = await page.locator('[data-region="entry-approval"]').innerText()
  check('🔑 the accountant reads the rejection WITH the supervisor’s reason, Arabic intact', rejected.includes('SUP1') && (await page.locator('[data-testid="approval-rejected-reason"]').innerText()) === FX.reason, rejected.replace(/\n/g, ' ').slice(0, 120))
  check('…and the audit pane records it', (await page.locator('[data-fact="rejected"]').count()) === 1)
  await shot('309-account-rejected')

  // ---- 3. a supervisor approves from the account ----
  reset({ access: SUPERVISOR })
  await go(`${ROUTE}?store=${FX.store}&entry=1202`)
  await appears('[data-testid="approval-open-approve"]')
  check('a supervisor on a pending entry is offered Approve and Reject', (await page.locator('[data-testid="approval-open-approve"]').count()) === 1 && (await page.locator('[data-testid="approval-open-reject"]').count()) === 1)
  await go(`${ROUTE}?store=${FX.store}&entry=1201`)
  check('🚩 …and NOT on an open entry', (await page.locator('[data-region="entry-approval"]').count()) === 0)
  await go(`${ROUTE}?store=${FX.store}&entry=1202`)
  await page.locator('[data-testid="approval-open-approve"]').click()
  await appears('[data-region="approval-dialog"]')
  const dialog = await page.locator('[data-region="approval-dialog"]').innerText()
  await shot('309-approve-dialog')
  check('🔑 story 9: the amount, the branch, the accountant and the description, before the press', dialog.includes('600.00') && dialog.includes(FX.storeName) && dialog.includes('Huda Al-Qahtani') && dialog.includes('مرتجع شبكة — عميل 5521'), dialog.replace(/\n/g, ' ').slice(0, 160))
  await page.locator('[data-testid="approval-commit"]').click()
  await appears('text=Entry 1202 is approved and open.')
  await settle()
  check('the approve body names the entry and NOTHING else — the approver is the session', approveCalls.length === 1 && JSON.stringify(approveCalls[0]) === JSON.stringify({ settlementEntryId: '01J9APPR0719P1' }), JSON.stringify(approveCalls))
  text = await page.locator('[data-region="account-headline"]').innerText()
  check('🔑 approved → it is money now: the headline keeps back 1,520', text.includes('1,520.00') && (await page.locator('[data-testid="account-pending-count"]').innerText()).startsWith('1 surplus'), text.replace(/\n/g, ' '))

  // ---- 4. the queue ----
  reset({ access: SUPERVISOR })
  let release
  releaseQueue = { promise: new Promise((r) => (release = r)) }
  await page.goto(`${BASE}${OPEN_ROUTE}?tab=pending`)
  check('the queue shows its loading state while the door answers', await appears('[role="status"][aria-label="Loading the surpluses waiting for approval…"]', 4000))
  check('…and its count is unknown, never 0, while it does', (await page.locator('[data-testid="open-count-pending"]').innerText()) === '—')
  release()
  releaseQueue = null
  await settle()
  check('the queue lists the estate’s three pending surpluses', (await page.locator('[data-testid="open-count-pending"]').innerText()) === '3' && (await page.locator('[data-testid="pending-approve"]').count()) === 3)
  check('🚩 the Owing/Owed counts never include a pending row — even one the door sent', (await page.locator('[data-testid="open-count-owing"]').innerText()) === '1' && (await page.locator('[data-testid="open-count-owed"]').innerText()) === '2')
  const queueText = await page.locator('[data-region="settlement-open"]').innerText()
  check('each row carries the amount, the accountant and the description (story 9)', queueText.includes('512.750') && queueText.includes('Huda Al-Qahtani') && queueText.includes('عميل 7002'), '')
  await noRawKeys('the queue')
  await shot('309-queue-supervisor')

  // Reject needs a reason.
  await page.locator('[data-region="open-section-mine"] [data-testid="pending-reject"]').last().click()
  await appears('[data-region="approval-dialog"]')
  check('pressing Reject opens the dialog, not the account', (await page.locator('[data-region="approval-dialog"]').getAttribute('data-entry')) === '1203' && page.url().includes('/open'))
  check('🔑 Reject is refused until a reason is typed', (await page.locator('[data-testid="approval-commit"]').getAttribute('aria-disabled')) === 'true')
  // `force`: the button is aria-disabled, and the point is that pressing it anyway sends nothing.
  await page.locator('[data-testid="approval-commit"]').click({ force: true })
  await page.waitForTimeout(150)
  check('…and a press on it sends nothing', rejectCalls.length === 0)
  await page.locator('[data-testid="approval-reason"]').fill('   مبلغ مكرر — أعد الترحيل   ')
  await page.locator('[data-testid="approval-commit"]').click()
  await appears('text=Entry 1203 is rejected.')
  await settle()
  check('the reject body carries the entry and the TRIMMED reason', rejectCalls.length === 1 && rejectCalls[0].settlementEntryId === '01J9APPR0719P2' && rejectCalls[0].reason === 'مبلغ مكرر — أعد الترحيل', JSON.stringify(rejectCalls))
  check('…and the decided entry leaves the queue', (await page.locator('[data-testid="open-count-pending"]').innerText()) === '2')

  // The refusal: somebody got there first.
  reset({ access: SUPERVISOR, takenFirst: '01J9APPR0688P1' })
  await go(`${OPEN_ROUTE}?tab=pending`)
  await page.locator('[data-region="open-section-theirs"] [data-testid="pending-approve"]').click()
  await page.locator('[data-testid="approval-commit"]').click()
  await appears('text=was no longer waiting')
  text = await bodyText()
  check('🔑 a refusal is NEWS — it says what the entry is now, not that something failed', text.includes('Entry 1207 was no longer waiting — it is now Open. Nothing was changed.') && !/could not be sent/.test(text))

  // The bare 403: the grant went between the probe and the press.
  reset({ access: SUPERVISOR, supervision403: true })
  await go(`${OPEN_ROUTE}?tab=pending`)
  const probesBefore = accessCalls
  scenario.revoked = true
  await page.locator('[data-testid="pending-approve"]').first().click()
  await page.locator('[data-testid="approval-commit"]').click()
  await appears('text=You no longer hold settlement supervision')
  await settle()
  check('🔑 a bare 403 is named — not "something unexpected"', (await bodyText()).includes('You no longer hold settlement supervision') && !/unexpected/i.test(await bodyText()))
  check('…the probe is re-read, and the buttons go away', accessCalls > probesBefore && (await page.locator('[data-testid="pending-approve"]').count()) === 0, `${accessCalls - probesBefore} probe(s)`)

  // An accountant reads the same queue without buttons.
  reset()
  await go(`${OPEN_ROUTE}?tab=pending`)
  check('🚩 an accountant reads the queue — and has no Decision column', (await page.locator('[data-testid="open-count-pending"]').innerText()) === '3' && (await page.locator('[data-testid="pending-approve"]').count()) === 0 && !(await page.locator('[data-region="settlement-open"]').innerText()).includes('Decision'))

  // Empty, and error.
  reset({ queueEmpty: true })
  await go(`${OPEN_ROUTE}?tab=pending`)
  check('an empty queue is its own good news', (await page.locator('[data-testid="open-empty"]').innerText()).includes('Nothing waiting for approval.'))
  reset({ queueFails: true })
  await go(`${OPEN_ROUTE}?tab=pending`)
  // The app retries a read once (`retry: 1`), so the banner arrives after the retry.
  await appears('[data-region="settlement-open"] [role="alert"]')
  text = await page.locator('[data-region="settlement-open"]').innerText()
  check('🚩 a failed queue is a failure — never an empty queue, and its count is —', (await page.locator('[data-region="settlement-open"] [role="alert"]').count()) === 1 && !text.includes('Nothing waiting') && (await page.locator('[data-testid="open-count-pending"]').innerText()) === '—', text.replace(/\n/g, ' ').slice(0, 160))
  check('…and the other tabs still count on their own', (await page.locator('[data-testid="open-count-owing"]').innerText()) === '1')

  // ---- the account's own error state ----
  reset({ accountFails: true })
  await go(`${ROUTE}?store=${FX.store}`)
  await appears('[data-region="branch-account"] [role="alert"]')
  check('an account that cannot be read says so, and draws no headline', (await page.locator('[data-region="branch-account"] [role="alert"]').count()) === 1 && (await page.locator('[data-region="account-headline"]').count()) === 0)

  // ---- 6. the ledger can be asked for pending and rejected ----
  reset()
  await go(LEDGER_ROUTE)
  check('the ledger offers Pending and Rejected as statuses', (await page.locator('[data-region="ledger-status"] [data-chip="PENDING_APPROVAL"]').count()) === 1 && (await page.locator('[data-region="ledger-status"] [data-chip="REJECTED"]').count()) === 1)
  await page.locator('[data-region="ledger-status"] [data-chip="REJECTED"]').click()
  await settle()
  check('…and asks the door for it', ledgerCalls.some((c) => c.status === 'REJECTED') && (await page.locator('[data-testid="ledger-count"]').innerText()).includes('1'))

  // ---- 7. the bulk preview ----
  reset()
  await go(UPLOAD_ROUTE)
  await page.locator('[data-region="bulk-kind"] [data-kind="SURPLUS"]').click()
  await page.locator('[data-testid="bulk-file"]').setInputFiles({ name: 'september.csv', mimeType: 'text/csv', buffer: Buffer.from('store,amount,reason\n0142,499.99,x\n0207,500,x\n0331,1250.50,x\n0455,120,x\n') })
  await page.locator('[data-testid="bulk-preview"]').click()
  await appears('[data-testid="bulk-rows"]')
  check('🔑 the preview marks the two rows the server said will wait', (await page.locator('[data-testid="bulk-rows"] tr[data-awaits="true"]').count()) === 2 && (await page.locator('[data-testid="bulk-rows"] tr[data-row="3"][data-awaits="true"]').count()) === 1)
  check('…and counts them in words', (await page.locator('[data-testid="bulk-awaiting"]').innerText()).startsWith('2 rows will wait'))
  check('🚩 waiting blocks nothing — the file still commits', (await page.locator('[data-testid="bulk-commit"]').getAttribute('aria-disabled')) !== 'true' && (await page.locator('[data-testid="bulk-blockers"]').count()) === 0)
  await noRawKeys('the bulk preview')
  await shot('309-bulk-preview')

  // ---- 8. a posted 500 surplus confirms it waits ----
  reset()
  await go(`${ROUTE}?store=${FX.store}`)
  await page.locator('[data-testid="post-open"]').click()
  await appears('[data-region="post-entry"]')
  await page.locator('dialog [data-kind="SURPLUS"]').click()
  await page.locator('[data-testid="post-amount"]').fill('600')
  await page.locator('[data-testid="post-reason"]').fill('مرتجع شبكة — عميل 5600')
  await page.waitForTimeout(150)
  await page.locator('[data-testid="post-review"]').click()
  await page.locator('[data-testid="post-commit"]').click()
  await appears('[data-region="post-done"]')
  check('🔑 a posted 600 surplus says it WAITS for a supervisor', postCalls.length === 1 && (await page.locator('[data-testid="post-done-pending"]').count()) === 1, JSON.stringify(postCalls[0] ?? {}))

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
