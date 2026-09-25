// Settlement supervision drive (spec 308, ticket 310) — drives the REAL app in Chromium
// against STUBBED envelopes shaped exactly as BackOffice 1979 records them under
// `## Web contract`: `Settlement/Cancel`, `Settlement/CloseOut` and `Settlement/Bulk/Cancel`
// are the accountant supervisor's alone, and answer anyone else a BARE 403.
//
// ⚠️ Stubbed, never live: no SIS.Api with 1979 is up for this wave, and the assertions
// are about behaviour on SPECIFIC answers (a refusal, a bare 403), which a live door
// will not produce on demand. The branch is 309's `approval-fixture.ts` (0719).
//
// Verifies ticket 310's screen Proof:
//   1. an accountant on an untouched and on a partly-used entry: the correction panel
//      names the act and the supervisor, and draws NO button;
//   2. a supervisor cancels (body = the contract's two fields) and writes off;
//   3. a cancel refused with REMAINING_INSUFFICIENT recovers into the write-off;
//   4. a bare 403 on cancel is named, re-reads the probe, and the button goes;
//   5. a 400 (reason too long) is the server's sentence, and the box keeps the text;
//   6. the batch withdrawal: an accountant sees the batch and who withdraws it, no box
//      and no button; a supervisor withdraws (the contract's three rows land in their
//      three groups); a 403 is named and takes the act away;
//   7. the bulk upload's confirmation offers the withdrawal link to a supervisor only;
//   8. loading and empty account states; no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-supervision-drive.mjs
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

const ACCOUNTANT = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenSettlement: true,
  canSuperviseSettlement: false,
}
const SUPERVISOR = { ...ACCOUNTANT, canSuperviseSettlement: true }

/** 1979 §3's own sample, verbatim but for the ids. */
const BATCH = '01J9Z6Q8M4B7W2K5T3N1R0P9XY'
const BULK_CANCEL_SAMPLE = {
  batchId: BATCH,
  total: 3,
  cancelled: 1,
  refused: 2,
  rows: [
    { settlementEntryId: 'B0000', entryNumber: 1101, storeId: 'P019', amount: 450.0, accepted: true, refusalReason: '', remainingAmount: 450.0, status: 'CANCELLED' },
    { settlementEntryId: 'B0001', entryNumber: 1102, storeId: 'P020', amount: 120.0, accepted: false, refusalReason: 'REMAINING_INSUFFICIENT', remainingAmount: 70.0, status: 'OPEN' },
    { settlementEntryId: 'B0002', entryNumber: 1103, storeId: 'P021', amount: 800.0, accepted: false, refusalReason: 'ENTRY_NOT_OPEN', remainingAmount: 800.0, status: 'PENDING_APPROVAL' },
  ],
}
/** …and the same batch after a supervisor rejected one of its rows first (1978 + 1979). */
const WITH_REJECTED = {
  ...BULK_CANCEL_SAMPLE,
  total: 4,
  refused: 3,
  rows: [
    ...BULK_CANCEL_SAMPLE.rows,
    { settlementEntryId: 'B0003', entryNumber: 1104, storeId: 'P022', amount: 700.0, accepted: false, refusalReason: 'ENTRY_NOT_OPEN', remainingAmount: 700.0, status: 'REJECTED' },
  ],
}

let scenario = {}
let FX = null
let entries = []
let cancelCalls = []
let closeOutCalls = []
let bulkCancelCalls = []
let accessCalls = 0
/** Held open to show a loading state; released by the scenario. */
let hold = null

const reset = (flags = {}) => {
  scenario = { access: ACCOUNTANT, ...flags }
  entries = structuredClone(FX.entries)
  // ⚠️ Drive-local: 1206 (surplus 120) has had 50 of it taken by a till, so the branch
  // holds one untouched entry (1201 → Cancel) and one partly-used one (1206 → Write off).
  const partly = entries.find((e) => e.entryNumber === 1206)
  partly.remainingAmount = 70
  cancelCalls = []
  closeOutCalls = []
  bulkCancelCalls = []
  accessCalls = 0
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
      if (hold) await hold.promise
      if (scenario.emptyAccount)
        return route.fulfill(envelope({ storeId: q('storeId'), storeName: FX.storeName, entries: [], consumptions: [] }))
      return route.fulfill(envelope({ storeId: FX.store, storeName: FX.storeName, entries, consumptions: [] }))
    }
    if (path === 'Settlement/Cancel' || path === 'Settlement/CloseOut') {
      const body = route.request().postDataJSON()
      const cancelling = path === 'Settlement/Cancel'
      ;(cancelling ? cancelCalls : closeOutCalls).push(body)
      // 🔑 1979: the bare 403 a session without settlement supervision gets — no body.
      if (scenario.forbidden) return route.fulfill({ status: 403, body: '' })
      if ((body.reason ?? '').length > 200)
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The reason may be at most 200 characters.',
            errors: [{ errorCode: 'SettlementReasonTooLong', errorMessage: 'The reason may be at most 200 characters.' }],
          }),
        )
      const entry = entries.find((e) => e.settlementEntryId === body.settlementEntryId)
      // A till took 30 a moment before the press: the guarded UPDATE refuses.
      if (cancelling && entry && scenario.tillFirst === entry.entryNumber) {
        entry.remainingAmount = entry.amount - 30
        return route.fulfill(
          envelope({ accepted: false, refusalReason: 'REMAINING_INSUFFICIENT', remainingAmount: entry.remainingAmount, status: 'OPEN' }),
        )
      }
      // Another supervisor cancelled it a moment ago: ENTRY_NOT_OPEN with its current status.
      if (entry && scenario.alreadyCancelled === entry.entryNumber) entry.status = 'CANCELLED'
      if (!entry || entry.status !== 'OPEN')
        return route.fulfill(
          envelope({ accepted: false, refusalReason: 'ENTRY_NOT_OPEN', remainingAmount: entry?.remainingAmount ?? 0, status: entry?.status ?? '' }),
        )
      if (cancelling) entry.status = 'CANCELLED'
      else Object.assign(entry, { status: 'CLOSED_OUT', remainingAmount: 0 })
      Object.assign(entry, { closedByStaffId: 'SUP1', closedAt: '2026-09-25T09:30:00', closedReason: body.reason })
      return route.fulfill(
        envelope({ accepted: true, refusalReason: '', remainingAmount: entry.remainingAmount, status: entry.status }),
      )
    }
    if (path === 'Settlement/Bulk/Cancel') {
      bulkCancelCalls.push(route.request().postDataJSON())
      if (hold) await hold.promise
      if (scenario.forbidden) return route.fulfill({ status: 403, body: '' })
      return route.fulfill(envelope(scenario.withRejected ? WITH_REJECTED : BULK_CANCEL_SAMPLE))
    }
    if (path === 'Settlement/Bulk/Preview') return route.fulfill(envelope(FX.preview))
    if (path === 'Settlement/Bulk/Commit')
      return route.fulfill(
        envelope({
          batchId: FX.preview.batchId,
          accepted: true,
          refusalReason: '',
          posted: 4,
          replayed: false,
          entryNumbers: [1401, 1402, 1403, 1404],
          errors: [],
          warnings: [],
        }),
      )
    if (path === 'Settlement/Branches')
      return route.fulfill(
        envelope([{ storeId: FX.store, storeName: FX.storeName, city: 'Riyadh', area: 'Central', servedBy: '', isMine: true }]),
      )
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
    check(`${where} → no raw t() key on screen`, !/\b(correction|batch|bulk)\.[a-z]+\.?[a-zA-Z]*\b|settlement:/.test(text))
  }
  const panel = () => page.locator('[data-region="entry-correction"]')
  const correctionKind = async () => panel().getAttribute('data-correction')

  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  FX = await page.evaluate(async () => {
    const m = await import('/src/features/collection/settlement/approval-fixture.ts')
    return {
      entries: m.APPROVAL_ENTRIES,
      preview: m.APPROVAL_PREVIEW,
      store: m.APPROVAL_STORE,
      storeName: m.APPROVAL_STORE_NAME,
    }
  })

  // ---- 1. an accountant: the act is named, and it is a supervisor's ----
  reset()
  await go(`${ROUTE}?store=${FX.store}&entry=1201`)
  await appears('[data-region="entry-correction"]')
  check('an accountant on an untouched entry sees the correction panel', (await panel().count()) === 1 && (await correctionKind()) === 'supervisor-only')
  check('🔑 …with NO Cancel button', (await page.locator('[data-testid="correction-act"]').count()) === 0 && (await page.locator('[data-testid="correction-reason"]').count()) === 0)
  let text = await page.locator('[data-testid="correction-supervisor-only"]').innerText()
  check('…and a sentence naming the supervisor who can cancel it', text.includes('only by an accountant supervisor') && text.includes('300.00') && text.includes('1201'), text)
  check('the no-amend line says a wrong entry is cancelled by a supervisor and re-posted', (await page.locator('[data-testid="correction-no-amend"]').innerText()).includes('cancelled by a supervisor and posted again'))
  await noRawKeys('the accountant’s correction panel')
  await shot('310-accountant-untouched')

  await go(`${ROUTE}?store=${FX.store}&entry=1206`)
  await appears('[data-testid="correction-supervisor-only"]')
  text = await page.locator('[data-testid="correction-supervisor-only"]').innerText()
  check('🔑 on a partly-used entry: NO write-off button, the remainder a supervisor could forgive named', (await page.locator('[data-testid="correction-act"]').count()) === 0 && text.includes('70.00 of 120.00') && text.includes('Only an accountant supervisor'), text)
  check('an entry that offers nothing still says why (a pending one) — not a supervisor sentence', await (async () => {
    await go(`${ROUTE}?store=${FX.store}&entry=1202`)
    await appears('[data-testid="correction-none"]')
    return (await correctionKind()) === 'none' && (await page.locator('[data-testid="correction-supervisor-only"]').count()) === 0
  })())
  check('an accountant sent no correction to the server', cancelCalls.length === 0 && closeOutCalls.length === 0)

  // ---- 2. a supervisor cancels, and writes off ----
  reset({ access: SUPERVISOR })
  await go(`${ROUTE}?store=${FX.store}&entry=1201`)
  await appears('[data-testid="correction-act"]')
  check('a supervisor on the untouched entry is offered ONE button — Cancel', (await page.locator('[data-testid="correction-act"]').count()) === 1 && (await page.locator('[data-testid="correction-act"]').getAttribute('data-act')) === 'cancel' && (await page.locator('[data-testid="correction-supervisor-only"]').count()) === 0)
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('  posted against the wrong branch  ')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('text=Entry 1201 is cancelled.')
  await settle()
  check('🔑 the cancel body is the contract’s two fields, the reason trimmed', cancelCalls.length === 1 && JSON.stringify(cancelCalls[0]) === JSON.stringify({ settlementEntryId: '01J9APPR0719S1', reason: 'posted against the wrong branch' }), JSON.stringify(cancelCalls))
  check('…and the entry now offers nothing: it is cancelled', (await correctionKind()) === 'none' && (await page.locator('[data-testid="correction-none"]').innerText()).includes('was cancelled'))
  await shot('310-supervisor-cancelled')

  await go(`${ROUTE}?store=${FX.store}&entry=1206`)
  await appears('[data-testid="correction-act"]')
  check('a supervisor on the partly-used entry is offered the write-off', (await page.locator('[data-testid="correction-act"]').getAttribute('data-act')) === 'write-off' && (await page.locator('[data-testid="correction-act"]').innerText()).includes('70.00'))
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('agreed with the branch to stop chasing')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('text=remainder is written off')
  await settle()
  check('the close-out body is the contract’s two fields', closeOutCalls.length === 1 && JSON.stringify(closeOutCalls[0]) === JSON.stringify({ settlementEntryId: '01J9APPR0719O3', reason: 'agreed with the branch to stop chasing' }), JSON.stringify(closeOutCalls))

  // ---- 3. the refusal: a till got there first ----
  reset({ access: SUPERVISOR, tillFirst: 1201 })
  await go(`${ROUTE}?store=${FX.store}&entry=1201`)
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('posted twice')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('[data-testid="correction-race"]')
  await settle()
  text = await panel().innerText()
  check('🔑 REMAINING_INSUFFICIENT is news, not an error — the write-off of 270.00 is offered', text.includes('270.00 is left') && (await page.locator('[data-testid="correction-act"]').getAttribute('data-act')) === 'write-off', text.replace(/\n/g, ' ').slice(0, 160))

  // …and ENTRY_NOT_OPEN: somebody else corrected it first.
  reset({ access: SUPERVISOR, alreadyCancelled: 1201 })
  await go(`${ROUTE}?store=${FX.store}&entry=1201`)
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('posted twice')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('[data-testid="correction-race"]')
  await settle()
  check('ENTRY_NOT_OPEN is a notice, not an error toast — and Cancel is not re-offered on top of it', (await page.locator('[data-testid="correction-race"]').count()) === 1 && !/could not be sent/.test(await bodyText()))
  check('…and once the account re-reads, the entry says it was cancelled', await (async () => {
    await page.locator('[data-testid="correction-dismiss"]').click()
    return (await correctionKind()) === 'none' && (await page.locator('[data-testid="correction-act"]').count()) === 0
  })())

  // ---- 4. the bare 403 ----
  reset({ access: SUPERVISOR, forbidden: true })
  await go(`${ROUTE}?store=${FX.store}&entry=1201`)
  const probesBefore = accessCalls
  scenario.revoked = true
  await page.locator('[data-testid="correction-act"]').click()
  await page.locator('[data-testid="correction-reason"]').fill('posted twice')
  await page.locator('[data-testid="correction-commit"]').click()
  await appears('text=this session does not hold settlement supervision')
  await settle()
  text = await bodyText()
  check('🔑 a bare 403 on Cancel is named — never "unexpected"', text.includes('Only an accountant supervisor can cancel an entry') && !/unexpected/i.test(text))
  check('…the probe is re-read, and the button and the reason box go', accessCalls > probesBefore && (await page.locator('[data-testid="correction-act"], [data-testid="correction-reason"]').count()) === 0 && (await correctionKind()) === 'supervisor-only', `${accessCalls - probesBefore} probe(s)`)
  await shot('310-cancel-403')

  // ---- 5. a 400: the server's sentence, and the words stay ----
  reset({ access: SUPERVISOR })
  await go(`${ROUTE}?store=${FX.store}&entry=1201`)
  await page.locator('[data-testid="correction-act"]').click()
  // The box stops at 200 (ReasonField), so the drive types past it through the DOM
  // to reach the door's own refusal.
  await page.locator('[data-testid="correction-reason"]').evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set
    set.call(el, 'x'.repeat(201))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.locator('[data-testid="correction-commit"]').click()
  await page.waitForTimeout(400)
  const sent400 = cancelCalls.length
  check(
    'a 400 (SettlementReasonTooLong) shows the server’s own sentence, and nothing is cancelled',
    sent400 === 1 && (await bodyText()).includes('at most 200 characters') && entries.find((e) => e.entryNumber === 1201).status === 'OPEN',
    `${sent400} call(s)`,
  )
  check('…and the reason box is still open', (await page.locator('[data-testid="correction-reason"]').count()) === 1)

  // ---- 6. the batch withdrawal ----
  reset()
  await go(`${UPLOAD_ROUTE}?batch=${BATCH}`)
  await appears('[data-region="batch-withdraw"]')
  check('an accountant opening a batch’s address sees the batch', (await page.locator('[data-region="batch-withdraw"]').getAttribute('data-batch')) === BATCH)
  check('🔑 …and who withdraws it — with NO reason box and NO button', (await page.locator('[data-testid="batch-supervisor-only"]').innerText()).includes('accountant supervisor') && (await page.locator('[data-testid="batch-commit"], [data-testid="batch-reason"]').count()) === 0)
  check('…and sent nothing', bulkCancelCalls.length === 0)
  await noRawKeys('the accountant’s batch withdrawal')
  await shot('310-batch-accountant')

  reset({ access: SUPERVISOR })
  await go(`${UPLOAD_ROUTE}?batch=${BATCH}`)
  check('a supervisor is offered the withdrawal', (await page.locator('[data-testid="batch-commit"]').count()) === 1 && (await page.locator('[data-testid="batch-supervisor-only"]').count()) === 0)
  await page.locator('[data-testid="batch-reason"]').fill("finance sent last month's file")
  let release
  hold = { promise: new Promise((r) => (release = r)) }
  await page.locator('[data-testid="batch-commit"]').click()
  await page.waitForTimeout(150)
  check('…the button says it is working while the door answers', (await page.locator('[data-testid="batch-commit"]').innerText()).includes('Withdrawing'))
  release()
  hold = null
  await appears('[data-region="batch-outcome"]')
  check('🔑 the bulk-cancel body is the contract’s two fields', bulkCancelCalls.length === 1 && JSON.stringify(bulkCancelCalls[0]) === JSON.stringify({ batchId: BATCH, reason: "finance sent last month's file" }), JSON.stringify(bulkCancelCalls))
  check('1979’s three rows land in their three groups — withdrawn, a till got there first, still pending',
    (await page.locator('[data-testid="batch-outcome-summary"]').innerText()).includes('1 of 3') &&
      (await page.locator('[data-testid="batch-withdrawn"] li').count()) === 1 &&
      (await page.locator('[data-testid="batch-refused"] li').count()) === 1 &&
      (await page.locator('[data-testid="batch-pending"] li[data-entry="1103"]').count()) === 1)
  await shot('310-batch-supervisor')

  reset({ access: SUPERVISOR, withRejected: true })
  await go(`${UPLOAD_ROUTE}?batch=${BATCH}`)
  await page.locator('[data-testid="batch-reason"]').fill('wrong file')
  await page.locator('[data-testid="batch-commit"]').click()
  await appears('[data-region="batch-outcome"]')
  text = await page.locator('[data-testid="batch-rejected"]').innerText()
  check('🚩 a row a supervisor already rejected is its own group — not "a till got there first", no remaining', (await page.locator('[data-testid="batch-rejected"] li[data-entry="1104"]').count()) === 1 && (await page.locator('[data-testid="batch-refused"] li[data-entry="1104"]').count()) === 0 && !text.includes('700.000 is what'), text.replace(/\n/g, ' '))
  await noRawKeys('the batch outcome')

  reset({ access: SUPERVISOR, forbidden: true })
  await go(`${UPLOAD_ROUTE}?batch=${BATCH}`)
  const batchProbes = accessCalls
  scenario.revoked = true
  await page.locator('[data-testid="batch-reason"]').fill('wrong file')
  await page.locator('[data-testid="batch-commit"]').click()
  await appears('text=Only an accountant supervisor can withdraw a batch')
  await settle()
  check('🔑 a bare 403 on the withdrawal is named in the banner', (await page.locator('[data-region="batch-withdraw"] [role="alert"]').innerText()).includes('nothing was withdrawn'))
  check('…the probe is re-read, and the act is taken away', accessCalls > batchProbes && (await page.locator('[data-testid="batch-commit"]').count()) === 0 && (await page.locator('[data-testid="batch-supervisor-only"]').count()) === 1)

  // ---- 7. the bulk upload's confirmation ----
  const commitAs = async (access) => {
    reset({ access })
    await go(UPLOAD_ROUTE)
    await page.locator('[data-region="bulk-kind"] [data-kind="SURPLUS"]').click()
    await page.locator('[data-testid="bulk-file"]').setInputFiles({ name: 'september.csv', mimeType: 'text/csv', buffer: Buffer.from('store,amount,reason\n0142,499.99,x\n0207,500,x\n0331,1250.50,x\n0455,120,x\n') })
    await page.locator('[data-testid="bulk-preview"]').click()
    await appears('[data-testid="bulk-rows"]')
    await page.locator('[data-testid="bulk-commit"]').click()
    await appears('[data-region="bulk-done"]')
  }
  await commitAs(ACCOUNTANT)
  check('🔑 an accountant’s confirmation carries NO withdrawal link', (await page.locator('[data-testid="bulk-done-withdraw"]').count()) === 0)
  text = await page.locator('[data-testid="bulk-done-withdraw-supervisor"]').innerText()
  check('…but names the supervisor and hands over the withdrawal ADDRESS to pass on', text.includes('accountant supervisor') && (await page.locator('[data-testid="bulk-done-withdraw-address"]').innerText()) === `${BASE}${UPLOAD_ROUTE}?batch=${FX.preview.batchId}`, text)
  check('…and the immutability line names the supervisor too', (await page.locator('[data-region="bulk-done"]').innerText()).includes('An accountant supervisor can cancel each'))
  await noRawKeys('the accountant’s bulk confirmation')
  await shot('310-bulk-done-accountant')
  await commitAs(SUPERVISOR)
  check('a supervisor’s confirmation carries the withdrawal link', (await page.locator('[data-testid="bulk-done-withdraw"]').count()) === 1 && (await page.locator('[data-testid="bulk-done-withdraw-supervisor"]').count()) === 0)

  // ---- 8. the account's loading and empty states ----
  reset()
  hold = { promise: new Promise((r) => (release = r)) }
  await page.goto(`${BASE}${ROUTE}?store=${FX.store}`)
  await page.waitForTimeout(300)
  check('while the account loads there is no correction panel yet', (await panel().count()) === 0)
  release()
  hold = null
  await settle()
  check('…and it arrives once the account does', (await panel().count()) === 1)
  reset({ emptyAccount: true })
  await go(`${ROUTE}?store=${FX.store}`)
  check('an empty account draws no correction panel', (await panel().count()) === 0)

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
