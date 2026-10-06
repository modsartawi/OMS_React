// Settlement ledger filters drive (spec 2423, ticket 426) — drives the REAL app in
// Chromium against STUBBED envelopes shaped as the oms ticket's `## Wire contract`
// (BackOffice 2430, committed on afk/spec2423 as 2e5713ca1 with the same names).
//
// ⚠️ Stubbed, never live: no SIS.Api with 2430 is up for this wave. The stub filters
// nothing — what is asserted is what the SCREEN sends and what it draws.
//
// Verifies ticket 426's screen behaviour:
//   1. the Ledger's three new criteria — Amount From/To, Profit center, Posted by — each
//      go on the wire under the door's camelCase names, each ALONE is a question (no
//      prompt, one call), an empty one is never sent, and an unreadable amount drops;
//   2. the Posted-by picker lists the roster's accountants, still shows a staff id the
//      roster does not name, and a roster this session may not read (403) leaves it
//      empty with the rest of the ledger working;
//   3. Approved by → Approved at sit after Posted at on the Ledger AND the Account; the
//      name shows, the staff id stands in for a blank or absent name, an unapproved
//      entry is blank in both;
//   4. the audit pane names the approver;
//   5. the server's refusal (From above To) is shown as its own message;
//   6. no raw t() key and no page error anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/settlement-ledger-filters-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/collection/settlement'
const LEDGER_ROUTE = `${ROUTE}/ledger`

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

const STORE = '0719'
const UNSTAMPED = '0001-01-01T00:00:00'
const MAJED = { staffId: 'SUP1', displayName: 'ماجد العتيبي / Majed Al-Otaibi' }
const HUDA = { staffId: 'ACC7', displayName: 'هدى الشمري / Huda Al-Shammari' }

const ROSTER = {
  accountants: [HUDA, { staffId: 'ACC9', displayName: 'Omar Haddad' }],
  collectors: [{ staffId: 'COL1', displayName: 'Saeed' }],
  supervisors: [MAJED],
  defaultScope: null,
}

const entry = (o) => ({
  storeId: STORE,
  entryKind: 'SURPLUS',
  remainingAmount: o.amount,
  status: 'OPEN',
  batchId: '',
  postedByStaffId: HUDA.staffId,
  postedByName: HUDA.displayName,
  closedByStaffId: '',
  closedAt: '',
  closedReason: '',
  approvedByStaffId: '',
  approvedAt: UNSTAMPED,
  approvedByName: '',
  rejectedByStaffId: '',
  rejectedAt: UNSTAMPED,
  rejectedReason: '',
  businessDay: UNSTAMPED,
  ...o,
})

/** Four entries, one per approver shape the ticket names. */
const ENTRIES = [
  // Approved after 2430: the name was stamped.
  entry({
    settlementEntryId: '01K426A',
    entryNumber: 1301,
    amount: 800,
    reason: 'مرتجع شبكة — عميل 5410',
    postedAt: '2026-09-21T15:58:00',
    approvedByStaffId: MAJED.staffId,
    approvedAt: '2026-09-21T16:00:00',
    approvedByName: MAJED.displayName,
  }),
  // Approved before 2430: no back-fill, so the name is blank.
  entry({
    settlementEntryId: '01K426B',
    entryNumber: 1302,
    amount: 650,
    reason: 'مرتجع شبكة — عميل 5411',
    postedAt: '2026-09-20T10:00:00',
    approvedByStaffId: 'SUP2',
    approvedAt: '2026-09-20T12:30:00',
    approvedByName: '',
  }),
  // Never needed approval.
  entry({
    settlementEntryId: '01K426C',
    entryNumber: 1303,
    entryKind: 'SHORTAGE',
    amount: 120,
    reason: 'عجز صندوق',
    postedAt: '2026-09-19T09:00:00',
  }),
]
/** An older SIS.Api: the field is ABSENT, not blank. */
const { approvedByName: _dropped, ...OLD_SHAPE } = entry({
  settlementEntryId: '01K426D',
  entryNumber: 1304,
  amount: 900,
  reason: 'مرتجع شبكة — عميل 5412',
  postedAt: '2026-09-18T09:00:00',
  approvedByStaffId: 'SUP3',
  approvedAt: '2026-09-18T11:00:00',
})
ENTRIES.push(OLD_SHAPE)

const asLedger = (e) => ({ ...e, storeName: 'السلامة / Al-Salamah', currencyKey: 'SAR' })

let scenario = {}
let ledgerCalls = []
let rosterCalls = 0
const reset = (flags = {}) => {
  scenario = { ...flags }
  ledgerCalls = []
  rosterCalls = 0
}

async function run() {
  const browser = await chromium.launch()
  // Wide, so AG Grid's column virtualisation draws every column the checks read.
  const page = await browser.newPage({ viewport: { width: 2600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = route.request().url().split('/api/')[1].split('?')[0]

    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'CollectionWeb/Access') return route.fulfill(envelope(ACCOUNTANT))
    if (path === 'CollectionWeb/AssignmentOptions') {
      rosterCalls++
      // A session holding only the settlement grant: BackOffice 1196's disjunction
      // does not include it.
      if (scenario.roster403) return route.fulfill(envelope(null, { status: 403, success: false }))
      return route.fulfill(envelope(ROSTER))
    }
    if (path === 'Settlement/Ledger') {
      const asked = Object.fromEntries([...url.searchParams].filter(([k]) => k !== 'limit'))
      ledgerCalls.push(asked)
      // The door's own refusals, as 2430 states them.
      if (Object.keys(asked).length === 0)
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'At least one ledger criterion is required.',
            errors: ['SettlementLedgerCriterionRequired'],
          }),
        )
      if (asked.amountFrom && asked.amountTo && Number(asked.amountFrom) > Number(asked.amountTo))
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'Amount From is above Amount To.',
            errors: ['InquiryAmountRange'],
          }),
        )
      return route.fulfill(envelope(ENTRIES.map(asLedger)))
    }
    if (path === 'Settlement/Account')
      return route.fulfill(
        envelope({ storeId: STORE, storeName: 'السلامة / Al-Salamah', entries: ENTRIES, consumptions: [] }),
      )
    if (path.startsWith('Settlement/ChangeRequest'))
      return route.fulfill(envelope(null, { status: 404, success: false }))
    if (path === 'Settlement/Uncollected' || path === 'Settlement/Orphans' || path === 'Settlement/Fleet')
      return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const appears = async (selector, timeout = 8000) =>
    page.waitForSelector(selector, { timeout }).then(() => true).catch(() => false)
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(150)
  }
  const go = async (to) => {
    await page.goto(BASE + to)
    await settle()
  }
  const urlParams = () => new URL(page.url()).searchParams
  const lastCall = () => ledgerCalls.at(-1) ?? {}
  const noRawKeys = async (where) => {
    const text = await page.locator('body').innerText()
    check(
      `${where} → no raw t() key on screen`,
      !/\b(account|ledger|audit)\.[a-z]+\.[a-zA-Z]|settlement:/.test(text),
    )
  }
  /** A grid's column ids, in the order they are drawn. */
  const headerOrder = async (region) =>
    page.locator(`[data-region="${region}"] .ag-header-cell[col-id]`).evaluateAll((cells) =>
      cells
        .map((c) => ({ id: c.getAttribute('col-id'), at: Number(c.getAttribute('aria-colindex')) }))
        .sort((a, b) => a.at - b.at)
        .map((c) => c.id)
        // The floating-filter row repeats each column's id.
        .filter((id, i, all) => all.indexOf(id) === i),
    )
  const cellOf = async (region, rowId, colId) =>
    (
      await page
        .locator(`[data-region="${region}"] .ag-row[row-id="${rowId}"] [col-id="${colId}"]`)
        .first()
        .innerText()
    ).trim()

  // ---- 1. landing: still the prompt, still no request ----
  reset()
  await go(LEDGER_ROUTE)
  await appears('[data-testid="ledger-prompt"]')
  check(
    'the bare ledger still prompts and asks nothing',
    ledgerCalls.length === 0 && (await page.locator('[data-testid="ledger-prompt"]').count()) === 1,
  )
  const prompt = await page.locator('[data-testid="ledger-prompt"]').innerText()
  check('…and the prompt names the new criteria', /amount/i.test(prompt) && /profit center/i.test(prompt), prompt)
  await noRawKeys('the ledger landing')

  // ---- 2. Amount From alone ----
  await page.locator('[data-testid="ledger-amount-from"]').fill('1000')
  await page.locator('[data-testid="ledger-amount-from"]').press('Enter')
  await appears('[data-region="settlement-ledger"] .ag-row')
  await settle()
  check(
    '🔑 Amount From ALONE is a question: one call, amountFrom=1000 and nothing else',
    ledgerCalls.length === 1 && JSON.stringify(lastCall()) === JSON.stringify({ amountFrom: '1000' }),
    JSON.stringify(ledgerCalls),
  )
  check('…and it is in the address as amountFrom', urlParams().get('amountFrom') === '1000', page.url())

  // ---- 3. Amount To commits on leaving the box, not per keystroke ----
  const before = ledgerCalls.length
  await page.locator('[data-testid="ledger-amount-to"]').fill('2500.5')
  await page.waitForTimeout(200)
  check('typing alone sends nothing', ledgerCalls.length === before)
  await page.locator('[data-testid="ledger-profit-center"]').click()
  await settle()
  check(
    '…leaving the box sends amountTo beside amountFrom',
    lastCall().amountFrom === '1000' && lastCall().amountTo === '2500.5',
    JSON.stringify(lastCall()),
  )

  // ---- 4. an unreadable amount is refused, and the bound already asked stands ----
  const beforeDrop = ledgerCalls.length
  const historyBefore = await page.evaluate(() => history.length)
  await page.locator('[data-testid="ledger-amount-to"]').fill('1,000')
  await page.locator('[data-testid="ledger-amount-to"]').press('Enter')
  await settle()
  check(
    '🚩 an amount with a thousands separator is REFUSED, never guessed at — the 2500.5 bound stands, nothing sent',
    urlParams().get('amountTo') === '2500.5' &&
      urlParams().get('amountFrom') === '1000' &&
      ledgerCalls.length === beforeDrop,
    `${page.url()} · ${JSON.stringify(ledgerCalls.slice(beforeDrop))}`,
  )
  check(
    '…and the box shows the bound that is still asked',
    (await page.locator('[data-testid="ledger-amount-to"]').inputValue()) === '2500.5',
  )
  // A different spelling of the same amount is no change: no call, no history entry.
  await page.locator('[data-testid="ledger-amount-to"]').fill('2500.50')
  await page.locator('[data-testid="ledger-amount-to"]').press('Enter')
  await settle()
  check(
    '…and "2500.50" over 2500.5 is no change — no call and no history entry',
    ledgerCalls.length === beforeDrop && (await page.evaluate(() => history.length)) === historyBefore,
    `${ledgerCalls.length - beforeDrop} calls · history ${historyBefore} → ${await page.evaluate(() => history.length)}`,
  )
  // Emptying the box removes the bound.
  await page.locator('[data-testid="ledger-amount-to"]').fill('')
  await page.locator('[data-testid="ledger-amount-to"]').press('Enter')
  await settle()
  check(
    'emptying the box removes the bound, and no call after it carries one',
    urlParams().get('amountTo') === null &&
      ledgerCalls.slice(beforeDrop).every((c) => c.amountTo === undefined),
    page.url(),
  )

  // ---- 5. Profit center ----
  reset()
  await go(LEDGER_ROUTE)
  await page.locator('[data-testid="ledger-profit-center"]').fill('  P12 ')
  await page.locator('[data-testid="ledger-profit-center"]').press('Enter')
  await settle()
  check(
    '🔑 Profit center ALONE is a question: profitCenter=P12, trimmed',
    ledgerCalls.length === 1 && JSON.stringify(lastCall()) === JSON.stringify({ profitCenter: 'P12' }),
    JSON.stringify(ledgerCalls),
  )

  // ---- 6. Posted by ----
  reset()
  await go(LEDGER_ROUTE)
  const options = await page.locator('[data-testid="ledger-posted-by"] option').allInnerTexts()
  check(
    'the Posted-by picker lists "Any accountant" and the roster’s ACCOUNTANTS only',
    options.length === 3 &&
      options[0] === 'Any accountant' &&
      options.some((o) => o.includes('Huda Al-Shammari')) &&
      options.some((o) => o.includes('Omar Haddad')) &&
      !options.some((o) => o.includes('Majed') || o.includes('Saeed')),
    JSON.stringify(options),
  )
  check('…read once', rosterCalls === 1, `${rosterCalls}`)
  await page.locator('[data-testid="ledger-posted-by"]').selectOption('ACC7')
  await settle()
  check(
    '🔑 Posted by ALONE is a question: postedByStaffId=ACC7, exact',
    ledgerCalls.length === 1 && JSON.stringify(lastCall()) === JSON.stringify({ postedByStaffId: 'ACC7' }),
    JSON.stringify(ledgerCalls),
  )
  check('…in the address as postedBy', urlParams().get('postedBy') === 'ACC7', page.url())
  await page.locator('[data-testid="ledger-posted-by"]').selectOption('')
  await settle()
  check(
    '"Any accountant" clears it, back to the prompt with no further call',
    urlParams().get('postedBy') === null &&
      ledgerCalls.length === 1 &&
      (await page.locator('[data-testid="ledger-prompt"]').count()) === 1,
  )

  // A staff id the roster does not name still shows as itself.
  reset()
  await go(`${LEDGER_ROUTE}?postedBy=GONE1`)
  check(
    'a posted-by id the roster does not name is still shown, selected, as itself',
    (await page.locator('[data-testid="ledger-posted-by"]').inputValue()) === 'GONE1' &&
      lastCall().postedByStaffId === 'GONE1',
    JSON.stringify(lastCall()),
  )

  // ---- 7. Clear all ----
  reset()
  await go(`${LEDGER_ROUTE}?amountFrom=10&amountTo=20&profitCenter=P1&postedBy=ACC7`)
  check(
    'all four together travel at once',
    JSON.stringify(lastCall()) ===
      JSON.stringify({ amountFrom: '10', amountTo: '20', profitCenter: 'P1', postedByStaffId: 'ACC7' }),
    JSON.stringify(lastCall()),
  )
  check(
    '…and the boxes show what is being asked',
    (await page.locator('[data-testid="ledger-amount-from"]').inputValue()) === '10' &&
      (await page.locator('[data-testid="ledger-amount-to"]').inputValue()) === '20' &&
      (await page.locator('[data-testid="ledger-profit-center"]').inputValue()) === 'P1',
  )
  await page.getByRole('button', { name: 'Clear all' }).click()
  await settle()
  check(
    'Clear all empties the four boxes and returns to the prompt',
    (await page.locator('[data-testid="ledger-prompt"]').count()) === 1 &&
      (await page.locator('[data-testid="ledger-amount-from"]').inputValue()) === '' &&
      (await page.locator('[data-testid="ledger-profit-center"]').inputValue()) === '' &&
      (await page.locator('[data-testid="ledger-posted-by"]').inputValue()) === '',
  )

  // ---- 8. the server's refusal ----
  reset()
  await go(`${LEDGER_ROUTE}?amountFrom=500&amountTo=100`)
  // The app retries a failed read once, after a second.
  await appears('text=Amount From is above Amount To.', 8000)
  const banner = await page.locator('[data-region="settlement-ledger"]').innerText()
  check(
    'From above To is the SERVER’s refusal, shown in its own words',
    banner.includes('Amount From is above Amount To.'),
    banner.replace(/\n/g, ' ').slice(0, 200),
  )

  // ---- 9. a roster this session may not read ----
  reset({ roster403: true })
  await go(`${LEDGER_ROUTE}?status=OPEN`)
  await appears('[data-region="settlement-ledger"] .ag-row')
  check(
    'a 403 on the roster leaves the picker with "Any accountant" only, and the ledger still answers',
    (await page.locator('[data-testid="ledger-posted-by"] option').count()) === 1 &&
      (await page.locator('[data-region="settlement-ledger"] .ag-row').count()) === ENTRIES.length &&
      !(await page.locator('[data-region="settlement-ledger"]').innerText()).includes('could not'),
  )
  check(
    '…and the picker says the list could not be read, so an empty list is not read as "no accountants"',
    ((await page.locator('[data-testid="ledger-posted-by"]').getAttribute('title')) ?? '').includes(
      'could not be read',
    ),
  )

  // ---- 10. the columns, on the ledger ----
  reset()
  await go(`${LEDGER_ROUTE}?status=OPEN`)
  await appears('[data-region="settlement-ledger"] .ag-row')
  let order = await headerOrder('settlement-ledger')
  let at = order.indexOf('postedAt')
  check(
    '🔑 Ledger: Posted at → Approved by → Approved at',
    at > -1 && order[at + 1] === 'approvedBy' && order[at + 2] === 'approvedAt',
    JSON.stringify(order),
  )
  const headers = await page.locator('[data-region="settlement-ledger"] .ag-header-cell-text').allInnerTexts()
  check('…labelled Approved by and Approved at', headers.includes('Approved by') && headers.includes('Approved at'))
  check(
    'the stamped name shows',
    (await cellOf('settlement-ledger', '01K426A', 'approvedBy')) === MAJED.displayName &&
      (await cellOf('settlement-ledger', '01K426A', 'approvedAt')) === '2026-09-21 16:00',
  )
  check(
    '🔑 a blank name falls back to the staff id',
    (await cellOf('settlement-ledger', '01K426B', 'approvedBy')) === 'SUP2',
  )
  check(
    '…and so does a name an older SIS.Api never sent (no crash)',
    (await cellOf('settlement-ledger', '01K426D', 'approvedBy')) === 'SUP3',
  )
  check(
    'an unapproved entry is blank in both — no dash, no year-1 date',
    (await cellOf('settlement-ledger', '01K426C', 'approvedBy')) === '' &&
      (await cellOf('settlement-ledger', '01K426C', 'approvedAt')) === '',
  )
  await noRawKeys('the ledger grid')

  // ---- 11. the columns, on the account, and the audit pane ----
  reset()
  await go(`${ROUTE}?store=${STORE}&entry=1301`)
  await appears('[data-region="branch-account"] .ag-row')
  order = await headerOrder('branch-account')
  at = order.indexOf('postedAt')
  check(
    '🔑 Account: Posted at → Approved by → Approved at, the journal count after them',
    at > -1 && order[at + 1] === 'approvedBy' && order[at + 2] === 'approvedAt' && order.at(-1) === 'journalCount',
    JSON.stringify(order),
  )
  check(
    'the account draws the same approvers',
    (await cellOf('branch-account', '01K426A', 'approvedBy')) === MAJED.displayName &&
      (await cellOf('branch-account', '01K426B', 'approvedBy')) === 'SUP2' &&
      (await cellOf('branch-account', '01K426C', 'approvedBy')) === '',
  )
  await appears('[data-region="entry-audit"]')
  // The names are isolated whole (FSI…PDI) inside the sentence; read without the marks.
  const auditText = async () =>
    (await page.locator('[data-region="entry-audit"]').innerText()).replace(/[⁦-⁩]/g, '')
  let audit = await auditText()
  check(
    '🔑 the audit pane NAMES the approver',
    audit.includes(`by ${MAJED.displayName}`),
    audit.replace(/\n/g, ' ').slice(0, 240),
  )
  await go(`${ROUTE}?store=${STORE}&entry=1302`)
  await appears('[data-region="entry-audit"]')
  audit = await auditText()
  check(
    '…and falls back to the staff id where no name was stamped',
    audit.includes('by staff SUP2'),
    audit.replace(/\n/g, ' ').slice(0, 240),
  )
  await noRawKeys('the account')

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
