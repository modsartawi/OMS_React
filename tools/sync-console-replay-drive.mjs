// Sync console Replay page drive (ticket 472, spec 470) — drives the REAL Replay page in Chromium against
// STUBBED doors, shaped from spec 470's PROPOSED contract ("Contract (proposed; owned by the BackOffice spec)").
// 🚩 NOTHING here is driven against a live SIS.Api: the BackOffice half of receipt replay has no spec and no
// door yet. The snapshot is OBVIOUSLY FAKE data in the engine's real shape (PosTransactionSnapshot: Header,
// Lines[], Tenders[], …), since a real one carries customer, loyalty and tender data.
//
// It verifies:
//   1. without canReplay: no Replay link in the console nav, and a deep link to /admin/sync/replay shows the
//      in-page denial, with no JSON box and no Replay door asked;
//   2. with canReplay (and WITHOUT canOperate — the two grants are independent): the nav offers Replay and it
//      opens the page; an empty box says to paste and Push is disabled; broken JSON says where it breaks (line,
//      column); a pasted sale shows its summary (source store, receipt, transaction, kind, completed, training,
//      lines, total, tendered, balanced) and a return says only a completed sale can be pushed;
//   3. the target: a typed code is read on Enter (trimmed, upper-cased) and fills the register picker; a WPF
//      store's NOT_NEWPOS_STORE refusal shows as the console's failure with its code; Push waits for a register;
//   4. Push asks once, repeating the store and the register; Cancel sends nothing; Push sends
//      { targetStoreCode, registerId, snapshot } with snapshot the PARSED object exactly as pasted;
//   5. the result: the new receipt number, transaction, store, register, replayed-at time, "replay of" the
//      source receipt, the removed links in words; its Copy copies the receipt number and says so;
//   6. a refused push (UNBALANCED) reads in its own words and a codeless 500 as the console's failure, both
//      in the result area with the confirm closed (473 moved them out of the confirm);
//   7. privacy: nothing of the snapshot logged, stored or put in the URL; no page errors;
//   8. (473) every preflight warning (return, void, training, not completed, unbalanced with both figures)
//      keeps Push disabled and shows its words; every registers refusal shows its words under the store
//      field; every push refusal shows its words in the result area; an unknown code and a 500 fall back
//      to the console's shared failure.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-replay-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-replay-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope `src/core/api.ts` reads.
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

// A completed sale in the engine's real shape, every value obviously fake.
const FAKE_SALE = {
  SchemaVersion: 3,
  Header: {
    TransactionId: 'FAKE-TX-0001',
    StoreId: 'P999',
    RegisterId: 'R09',
    ReceiptNumber: 'FAKE-0009-000123',
    Status: 'Completed',
    IsReturn: false,
    IsTraining: false,
    GrandTotal: 115.5,
    TotalTendered: 120,
    TotalApplied: 115.5,
    TotalChange: 4.5,
    OpenedAt: '2026-10-12T09:00:00',
    CompletedAt: '2026-10-12T09:02:00',
    LoyaltyId: 'FAKE-LOYALTY-1',
  },
  Lines: [
    { LineNumber: 1, Sku: 'FAKE-SKU-1', Quantity: 1, Amount: 100 },
    { LineNumber: 2, Sku: 'FAKE-SKU-2', Quantity: 3, Amount: 15.5 },
  ],
  Conditions: [],
  Tenders: [
    { TenderType: 'Cash', Amount: 100, ChangeAmount: 4.5, AppliedAmount: 95.5, IsRefund: false },
    { TenderType: 'Card', Amount: 20, ChangeAmount: 0, AppliedAmount: 20, IsRefund: false, ProviderTransactionId: 'FAKE-CARD-PROOF', EntryMode: 'Tap' },
  ],
  Coupons: [],
  Loyalty: { MemberId: 'FAKE-LOYALTY-1', Name: 'Test Customer' },
  DocumentType: 'Sale',
  Insurance: null,
  Order: null,
}
const FAKE_RETURN = { ...FAKE_SALE, Header: { ...FAKE_SALE.Header, IsReturn: true } }
const withHeader = (over) => ({ ...FAKE_SALE, Header: { ...FAKE_SALE.Header, ...over } })
const SALE_TEXT = JSON.stringify(FAKE_SALE, null, 2)
// A codeless 500 reads as the console's usual failure: the sentence over core's server words (as 468's drawer).
const SERVER_FAILURE = 'The OMS API encountered an unexpected error. Please try again.'
const PRIVATE = /FAKE-CARD-PROOF|Test Customer|FAKE-LOYALTY|FAKE-SKU/

const REGISTERS = {
  P020: { storeCode: 'P020', registers: [{ registerId: 'R01', name: 'Register 1' }, { registerId: 'R02', name: 'Register 2' }, { registerId: 'R03', name: 'Register 3' }] },
}
const RESULT = {
  storeCode: 'P020',
  registerId: 'R02',
  transactionId: 'FAKE-TX-NEW-0042',
  receiptNumber: 'FAKE-0020-000777',
  replayedAt: '2026-10-12T12:40:05',
  replayOf: { storeCode: 'P999', receiptNumber: 'FAKE-0009-000123', transactionId: 'FAKE-TX-0001' },
  removed: ['tenderCapture', 'loyaltyMember'],
}

const browser = await chromium.launch()

async function open({ canReplay }) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const pushes = []
  const logged = []
  // 473: the code the next push is refused with ('500' for a codeless 500), set by section 8; null keeps the rules below.
  const stub = { pushCode: null }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    logged.push(m.text())
    if (m.type() === 'error' && !/status of [45]\d\d/.test(m.text())) errors.push(m.text())
  })
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
    // http://localhost is a secure context: the clipboard API path, recorded rather than real.
    window.__clip = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text) => (window.__clip.push(text), Promise.resolve()) },
    })
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    calls.push(p + url.search)
    const code = url.searchParams.get('code')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') {
      // Without the grant the door's older shape: no canReplay member at all.
      const access = { screenAllowed: true, canOperate: false, canOnboard: false }
      return route.fulfill(envelope(canReplay ? { ...access, canReplay: true } : access))
    }
    if (p === 'ActionSync/Replay/Registers') {
      if (code === 'P002') return route.fulfill(envelope(null, { status: 400, success: false, message: 'P002 is not a NewPos store.', errorCode: 'NOT_NEWPOS_STORE' }))
      if (code === 'P503') return route.fulfill(envelope(null, { status: 400, success: false, message: 'The store could not be reached.', errorCode: 'STORE_UNREACHABLE' }))
      if (code === 'P777') return route.fulfill(envelope(null, { status: 400, success: false, message: 'Something melted at the store.', errorCode: 'MELTED' }))
      const r = REGISTERS[code]
      return route.fulfill(r ? envelope(r) : envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
    }
    if (p === 'ActionSync/Replay') {
      const body = route.request().postDataJSON()
      pushes.push(body)
      if (stub.pushCode === '500') return route.fulfill(envelope(null, { status: 500, success: false, message: '' }))
      if (stub.pushCode) return route.fulfill(envelope(null, { status: 400, success: false, message: `Refused: ${stub.pushCode}.`, errorCode: stub.pushCode }))
      if (body.registerId === 'R03') return route.fulfill(envelope(null, { status: 400, success: false, message: 'The tenders do not add up to the total.', errorCode: 'UNBALANCED' }))
      if (body.registerId === 'R01') return route.fulfill(envelope(null, { status: 500, success: false, message: '' }))
      return route.fulfill(envelope(RESULT))
    }
    if (p === 'ActionSync/Audit') return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, pushes, logged, stub }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const navKeys = (page) => page.locator('[data-console-nav] [data-console-page]').evaluateAll((els) => els.map((e) => e.getAttribute('data-console-page')))
const summary = async (page, field) => strip(await page.locator(`[data-summary="${field}"]`).first().innerText())

// ── 1: without canReplay ────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open({ canReplay: false })
  await page.goto(`${BASE}/admin/sync/audit`)
  await page.locator('[data-console-nav]').waitFor({ timeout: 20000 })
  const keys = await navKeys(page)
  check('1. without canReplay the console nav has no Replay link', !keys.includes('replay') && keys.includes('fleet'), keys.join(','))
  await page.goto(`${BASE}/admin/sync/replay`)
  const denied = page.locator('[role="alert"]', { hasText: 'No access to receipt replay' })
  await denied.waitFor({ timeout: 10000 }).catch(() => {})
  check('1. a deep link shows the in-page denial', (await denied.count()) === 1)
  check('1. …with no JSON box and no Push', (await page.locator('[data-replay-json]').count()) === 0 && (await page.locator('[data-replay-push]').count()) === 0)
  check('1. …and no Replay door is asked', !calls.some((c) => c.startsWith('ActionSync/Replay')))
  await page.screenshot({ path: `${SHOTS}/denied.png` })
  check('no page errors (without canReplay)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2–7: with canReplay, without canOperate ─────────────────────────────────────────────────────
{
  const { context, page, errors, calls, pushes, logged, stub } = await open({ canReplay: true })
  await page.goto(`${BASE}/admin/sync/audit`)
  await page.locator('[data-console-page="replay"]').waitFor({ timeout: 20000 })
  const keys = await navKeys(page)
  check('2. with canReplay (no canOperate) the console nav offers Replay, last', keys[keys.length - 1] === 'replay', keys.join(','))
  await page.locator('[data-console-page="replay"]').click()
  await page.locator('[data-replay-json]').waitFor({ timeout: 10000 })
  check('2. the link opens /admin/sync/replay', new URL(page.url()).pathname === '/admin/sync/replay')
  check('2. the page is titled "Receipt replay"', (await page.locator('h1', { hasText: 'Receipt replay' }).count()) === 1)
  check('2. the JSON box is left to right and monospace', (await page.locator('[data-replay-json]').getAttribute('dir')) === 'ltr' && /font-mono/.test((await page.locator('[data-replay-json]').getAttribute('class')) ?? ''))
  check('2. an empty box says to paste, and Push is disabled', (await page.locator('[data-replay-preflight="empty"]').count()) === 1 && (await page.locator('[data-replay-push]').isDisabled()))

  const json = page.locator('[data-replay-json]')
  await json.fill('{\n  "Header": {,\n}')
  await page.locator('[data-replay-preflight="invalid"]').waitFor({ timeout: 5000 })
  check('2. broken JSON is not valid JSON…', (await page.locator('[data-replay-invalid="json"]').count()) === 1 && /not valid JSON/.test(await page.locator('[data-replay-preflight="invalid"]').innerText()))
  const broken = await page.locator('[data-replay-preflight="invalid"]').innerText()
  check('2. …and says where it breaks (line 2, column 14), the numbers isolated', strip(broken).endsWith('It breaks at line 2, column 14.') && broken.includes('⁨2⁩') && broken.includes('⁨14⁩'), broken)
  await json.fill('[1, 2]')
  await page.locator('[data-replay-invalid="notObject"]').waitFor({ timeout: 5000 })
  check('2. a JSON array is not a receipt', (await page.locator('[data-replay-invalid="notObject"]').count()) === 1)

  await json.fill(JSON.stringify(FAKE_RETURN, null, 2))
  await page.locator('[data-replay-preflight="summary"]').waitFor({ timeout: 5000 })
  // 473 replaced 472's "Only a completed sale can be pushed." line with the return's own warning (section 8 covers each).
  check('2. a pasted return reads as a Return and warns it cannot be pushed', (await summary(page, 'kind')) === 'Return' && (await page.locator('[data-replay-warning="return"]').count()) === 1)

  await json.fill(SALE_TEXT)
  await page.locator('[data-replay-warnings]').waitFor({ state: 'detached', timeout: 5000 })
  const facts = {
    sourceStore: await summary(page, 'sourceStore'),
    sourceReceipt: await summary(page, 'sourceReceipt'),
    sourceTransaction: await summary(page, 'sourceTransaction'),
    kind: await summary(page, 'kind'),
    completed: await summary(page, 'completed'),
    training: await summary(page, 'training'),
    lines: await summary(page, 'lines'),
    total: await summary(page, 'total'),
    tenderTotal: await summary(page, 'tenderTotal'),
    balanced: await summary(page, 'balanced'),
  }
  check(
    '2. a pasted sale shows its summary',
    JSON.stringify(facts) ===
      JSON.stringify({ sourceStore: 'P999', sourceReceipt: 'FAKE-0009-000123', sourceTransaction: 'FAKE-TX-0001', kind: 'Sale', completed: 'Yes', training: 'No', lines: '2', total: '115.500', tenderTotal: '115.500', balanced: 'Yes' }),
    JSON.stringify(facts),
  )
  check('2. the summary isolates the receipt and the total left to right', (await page.locator('[data-summary="sourceReceipt"] bdi[dir="ltr"]').count()) === 1 && (await page.locator('[data-summary="total"] bdi[dir="ltr"]').count()) === 1)
  check('2. a sale with no target yet: Push is still disabled', await page.locator('[data-replay-push]').isDisabled())
  await page.screenshot({ path: `${SHOTS}/summary.png` })

  // ── 3: the target ──
  const storeField = page.locator('[data-field="replay-store"]')
  await storeField.fill('p002')
  await storeField.blur()
  await page.locator('[data-replay-error="registers"]').waitFor({ timeout: 5000 })
  check('3. a WPF store is read on blur, upper-cased', calls.includes('ActionSync/Replay/Registers?code=P002'), calls.filter((c) => c.includes('Registers')).join(','))
  // 473: the refusal now reads in its own words (no raw code) instead of 472's console failure + code.
  check('3. …its NOT_NEWPOS_STORE refusal reads in its own words', (await page.locator('[data-replay-error-code="NOT_NEWPOS_STORE"]').count()) === 1 && /does not run NewPos/.test(await page.locator('[data-replay-error="registers"]').innerText()) && /could not be read/.test(await page.locator('[data-replay-error="registers"]').innerText()))
  check('3. …and the register picker stays empty and disabled', await page.locator('[data-replay-register]').isDisabled())
  await storeField.press('Enter')
  for (let i = 0; i < 30 && calls.filter((c) => c === 'ActionSync/Replay/Registers?code=P002').length < 2; i++) await page.waitForTimeout(100)
  check('3. the same refused code entered again asks the store once more', calls.filter((c) => c === 'ActionSync/Replay/Registers?code=P002').length === 2)

  await storeField.fill('  p020 ')
  await storeField.press('Enter')
  await page.locator('[data-replay-register] option[value="R02"]').waitFor({ state: 'attached', timeout: 5000 })
  check('3. Enter reads the trimmed, upper-cased code', calls.includes('ActionSync/Replay/Registers?code=P020') && (await storeField.inputValue()) === 'P020')
  const options = await page.locator('[data-replay-register] option').evaluateAll((els) => els.map((e) => [e.value, e.textContent.replace(/[\u2066-\u2069]/g, '')]))
  check('3. the register picker is filled from the door', JSON.stringify(options) === JSON.stringify([['', 'Pick a register'], ['R01', 'R01 · Register 1'], ['R02', 'R02 · Register 2'], ['R03', 'R03 · Register 3']]), JSON.stringify(options))
  check('3. the refusal is gone once the store answers', (await page.locator('[data-replay-error="registers"]').count()) === 0)
  check('3. Push waits for a register', await page.locator('[data-replay-push]').isDisabled())
  await page.locator('[data-replay-register]').selectOption('R02')
  check('3. a picked register enables Push', await page.locator('[data-replay-push]').isEnabled())

  // ── 4: confirm → push ──
  await page.locator('[data-replay-push]').click()
  const confirm = page.locator('dialog[open] [data-replay-confirm]')
  await confirm.waitFor({ timeout: 5000 })
  check('4. Push asks once, repeating the store and the register', strip(await page.locator('[data-replay-confirm-body]').innerText()) === 'It is written as a new sale at store P020, register R02 · Register 2.', await page.locator('[data-replay-confirm-body]').innerText())
  check('4. …each isolated left to right', (await page.locator('[data-replay-confirm-body] bdi[dir="ltr"]').count()) === 2)
  await page.locator('[data-replay-confirm-cancel]').click()
  await page.waitForTimeout(300)
  check('4. Cancel sends nothing and closes', pushes.length === 0 && (await page.locator('dialog[open]').count()) === 0)

  await page.locator('[data-replay-push]').click()
  await page.locator('[data-replay-confirm-push]').click()
  await page.locator('[data-replay-result]').waitFor({ timeout: 5000 })
  const body = pushes[0]
  check('4. one POST ActionSync/Replay', pushes.length === 1 && calls.filter((c) => c === 'ActionSync/Replay').length === 1)
  check('4. its body is { targetStoreCode, registerId, snapshot }', JSON.stringify(Object.keys(body ?? {}).sort()) === JSON.stringify(['registerId', 'snapshot', 'targetStoreCode']) && body.targetStoreCode === 'P020' && body.registerId === 'R02')
  check('4. …the snapshot is the PARSED object, exactly as pasted', typeof body?.snapshot === 'object' && JSON.stringify(body.snapshot) === JSON.stringify(FAKE_SALE))
  check('4. the confirm closes on success', (await page.locator('dialog[open]').count()) === 0)

  // ── 5: the result ──
  const result = page.locator('[data-replay-result]')
  check('5. the result shows the new receipt number, isolated', strip(await page.locator('[data-replay-receipt]').innerText()) === 'FAKE-0020-000777' && (await page.locator('[data-replay-receipt] bdi[dir="ltr"]').count()) === 1)
  const resultFacts = {
    transaction: strip(await result.locator('[data-summary="transaction"]').innerText()),
    store: strip(await result.locator('[data-summary="store"]').innerText()),
    register: strip(await result.locator('[data-summary="register"]').innerText()),
  }
  check('5. …its transaction, store and register', JSON.stringify(resultFacts) === JSON.stringify({ transaction: 'FAKE-TX-NEW-0042', store: 'P020', register: 'R02' }), JSON.stringify(resultFacts))
  const at = strip(await result.locator('[data-summary="at"]').innerText())
  check('5. …and the replayed-at time', /12:40/.test(at), at)
  const of = await page.locator('[data-replay-of]').innerText()
  check('5. "replay of" the source receipt, its values isolated (FSI…PDI)', strip(of) === 'Replay of receipt FAKE-0009-000123 at store P999' && of.includes('\u2068FAKE-0009-000123\u2069'), of)
  const removed = await page.locator('[data-replay-removed-link]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-replay-removed-link'), e.textContent]))
  check('5. the removed links in words', JSON.stringify(removed) === JSON.stringify([['tenderCapture', 'Captured tender proof and payment provider ids'], ['loyaltyMember', 'The loyalty member']]), JSON.stringify(removed))
  await page.locator('[data-replay-copy]').click()
  await page.locator('[data-replay-copy-status="copied"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('5. Copy copies the new receipt number', JSON.stringify(await page.evaluate(() => window.__clip)) === JSON.stringify(['FAKE-0020-000777']))
  check('5. …and says so beside it', (await page.locator('[data-replay-copy-status="copied"]').innerText()).trim() === 'Copied')
  await page.screenshot({ path: `${SHOTS}/result.png` })
  await json.press('End')
  await json.press('Space')
  await page.locator('[data-replay-result]').waitFor({ state: 'detached', timeout: 2000 }).catch(() => {})
  check('5. editing the JSON retires the result (it was about the JSON as pushed)', (await page.locator('[data-replay-result]').count()) === 0)
  check('5. …and the JSON stays in the box', (await json.inputValue()).startsWith(SALE_TEXT))

  // ── 6: refusals ──
  await page.locator('[data-replay-register]').selectOption('R03')
  await page.locator('[data-replay-push]').click()
  await page.locator('[data-replay-confirm-push]').click()
  await page.locator('[data-replay-error="push"]').waitFor({ timeout: 5000 })
  const refused = await page.locator('[data-replay-error="push"]').innerText()
  // 473: the refusal moved from the confirm to the result area, and reads in its own words.
  check('6. a refused push (UNBALANCED) reads in its own words under the failure sentence', (await page.locator('[data-replay-error-code="UNBALANCED"]').count()) === 1 && /could not be replayed/.test(refused) && /do not add up to the sale's total/.test(refused) && !/UNBALANCED/.test(refused), refused)
  check('6. …in the result area, with the confirm closed (the earlier result went when the register changed)', (await page.locator('dialog[open]').count()) === 0 && (await page.locator('dialog [data-replay-error]').count()) === 0 && (await page.locator('[data-replay-result]').count()) === 0)
  await page.locator('[data-replay-register]').selectOption('R01')
  check('6. picking another register retires the refusal', (await page.locator('[data-replay-error="push"]').count()) === 0)
  await page.locator('[data-replay-push]').click()
  await page.locator('[data-replay-confirm-push]').click()
  await page.locator('[data-replay-error="push"]').waitFor({ timeout: 5000 })
  const crashed = strip(await page.locator('[data-replay-error="push"]').innerText())
  check('6. a codeless 500 shows the console failure (core server sentence), with no code', (await page.locator('[data-replay-error-code=""]').count()) === 1 && crashed === `The receipt could not be replayed. ${SERVER_FAILURE}`, crashed)
  await page.screenshot({ path: `${SHOTS}/refused-500.png` })

  // ── 8 (473): every warning and every refusal in its own words ──
  await page.locator('[data-replay-register]').selectOption('R02')
  const pushDisabled = () => page.locator('[data-replay-push]').isDisabled()
  const warningsOf = () => page.locator('[data-replay-warning]').evaluateAll((els) => els.map((e) => e.getAttribute('data-replay-warning')))
  const WARNINGS = [
    ['return', FAKE_RETURN, 'This is a return. Only a sale can be replayed.'],
    ['void', withHeader({ Status: 'Voided' }), 'This sale was voided. Only a completed sale can be replayed.'],
    ['training', withHeader({ IsTraining: true }), 'This is a training sale. A training sale cannot be replayed.'],
    ['notCompleted', withHeader({ Status: 'Open' }), 'This sale is not completed. Only a completed sale can be replayed.'],
  ]
  for (const [warning, snapshot, words] of WARNINGS) {
    await json.fill(JSON.stringify(snapshot, null, 2))
    await page.locator(`[data-replay-warning="${warning}"]`).waitFor({ timeout: 5000 }).catch(() => {})
    const shown = await warningsOf()
    const text = strip(await page.locator(`[data-replay-warning="${warning}"]`).innerText().catch(() => ''))
    check(`8. a ${warning} warns in its own words`, JSON.stringify(shown) === JSON.stringify([warning]) && text === words, `${shown.join(',')} | ${text}`)
    check(`8. …and keeps Push disabled with a store and register picked (${warning})`, await pushDisabled())
  }
  const unbalanced = { ...FAKE_SALE, Tenders: [FAKE_SALE.Tenders[0], { ...FAKE_SALE.Tenders[1], AppliedAmount: 19.99 }] }
  await json.fill(JSON.stringify(unbalanced, null, 2))
  await page.locator('[data-replay-warning="unbalanced"]').waitFor({ timeout: 5000 }).catch(() => {})
  const unbalancedText = await page.locator('[data-replay-warning="unbalanced"]').innerText().catch(() => '')
  check('8. tenders a cent short warn with both figures', strip(unbalancedText) === 'The tenders add up to 115.490, not to the total of 115.500.', unbalancedText)
  check('8. …each figure isolated (FSI…PDI)', unbalancedText.includes('⁨115.490⁩') && unbalancedText.includes('⁨115.500⁩'))
  check('8. …and Push stays disabled', await pushDisabled())
  await json.fill(JSON.stringify(withHeader({ IsReturn: true, Status: 'Voided' }), null, 2))
  await page.locator('[data-replay-warning="void"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('8. a voided return warns as a return and a void', JSON.stringify(await warningsOf()) === JSON.stringify(['return', 'void']))
  await json.fill(JSON.stringify(withHeader({ IsTraining: true, Status: 'Open' }), null, 2))
  await page.locator('[data-replay-warning="notCompleted"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('8. every warning that applies is listed', JSON.stringify(await warningsOf()) === JSON.stringify(['training', 'notCompleted']))
  await page.screenshot({ path: `${SHOTS}/warnings.png` })
  await json.fill(SALE_TEXT)
  await page.locator('[data-replay-warnings]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check('8. a balanced, completed sale clears the warnings and enables Push', (await page.locator('[data-replay-warnings]').count()) === 0 && !(await pushDisabled()))

  // The registers door's refusals, under the store field.
  const REGISTER_REFUSALS = [
    ['P404', 'NO_STORE', 'There is no store with this code.'],
    ['P002', 'NOT_NEWPOS_STORE', 'This store does not run NewPos, so it cannot take a replay.'],
    ['P503', 'STORE_UNREACHABLE', "The store's database could not be reached. Try again in a moment."],
  ]
  for (const [store, code, words] of REGISTER_REFUSALS) {
    await storeField.fill(store)
    await storeField.press('Enter')
    const error = page.locator(`[data-replay-target] [data-replay-error="registers"][data-replay-error-code="${code}"]`)
    await error.waitFor({ timeout: 5000 }).catch(() => {})
    const text = strip(await error.innerText().catch(() => ''))
    check(`8. the registers door's ${code} shows its words under the store field`, text === `The store's registers could not be read. ${words}`, text)
    check(`8. …and Push is disabled (${code})`, await pushDisabled())
  }
  await storeField.fill('P777')
  await storeField.press('Enter')
  const melted = page.locator('[data-replay-target] [data-replay-error="registers"][data-replay-error-code="MELTED"]')
  await melted.waitFor({ timeout: 5000 }).catch(() => {})
  const meltedText = strip(await melted.innerText().catch(() => ''))
  check("8. an unknown registers code falls back to the console failure: the server's message and the code", meltedText === "The store's registers could not be read. Something melted at the store. MELTED", meltedText)
  await page.screenshot({ path: `${SHOTS}/registers-refused.png` })
  await storeField.fill('P020')
  await storeField.press('Enter')
  await page.locator('[data-replay-register] option[value="R02"]').waitFor({ state: 'attached', timeout: 5000 })
  await page.locator('[data-replay-register]').selectOption('R02')

  // The push's refusals, in the result area.
  const PUSH_REFUSALS = [
    ['NO_STORE', 'There is no store with this code.'],
    ['NOT_NEWPOS_STORE', 'This store does not run NewPos, so it cannot take a replay.'],
    ['STORE_UNREACHABLE', "The store's database could not be reached. Try again in a moment."],
    ['NO_REGISTER', 'This store has no such register. Pick another of its registers.'],
    ['BAD_SNAPSHOT', 'The server could not read this JSON as a receipt.'],
    ['NOT_A_SALE', 'This is a return or a voided sale. Only a sale can be replayed.'],
    ['NOT_COMPLETED', 'This sale is not completed. Only a completed sale can be replayed.'],
    ['TRAINING', 'This is a training sale. A training sale cannot be replayed.'],
    ['UNBALANCED', "The tenders do not add up to the sale's total."],
    // Any other code: the console's shared failure, its shared words with the code, or raw with the server's message.
    ['BAD_FIELD', 'A field is blank or too long BAD_FIELD'],
    ['MELTED', 'Refused: MELTED. MELTED'],
    ['500', null],
  ]
  const registerReads = () => calls.filter((c) => c === 'ActionSync/Replay/Registers?code=P020').length
  const TARGET_CODES = ['NO_STORE', 'NOT_NEWPOS_STORE', 'STORE_UNREACHABLE', 'NO_REGISTER']
  for (const [code, words] of PUSH_REFUSALS) {
    stub.pushCode = code
    const readsBefore = registerReads()
    await page.locator('[data-replay-push]').click()
    await page.locator('[data-replay-confirm-push]').click()
    const error = page.locator(`[data-replay-error="push"][data-replay-error-code="${code === '500' ? '' : code}"]`)
    await error.waitFor({ timeout: 5000 }).catch(() => {})
    const text = strip(await error.innerText().catch(() => ''))
    const want = words === null ? `The receipt could not be replayed. ${SERVER_FAILURE}` : `The receipt could not be replayed. ${words}`
    check(`8. a push refused with ${code === '500' ? 'a codeless 500' : code} shows ${words === null ? 'the console failure' : 'its words'} in the result area`, text === want, text)
    check(`8. …with the confirm closed (${code})`, (await page.locator('dialog[open]').count()) === 0)
    // The store's registers are read again after a refusal about the store or its register, and only then.
    const rereads = TARGET_CODES.includes(code)
    for (let i = 0; i < 20 && rereads && registerReads() === readsBefore; i++) await page.waitForTimeout(100)
    if (!rereads) await page.waitForTimeout(200)
    check(`8. …${rereads ? 'and the registers are read again' : 'and the registers are not read again'} (${code})`, (registerReads() > readsBefore) === rereads, `${readsBefore} → ${registerReads()}`)
  }
  stub.pushCode = null
  await page.screenshot({ path: `${SHOTS}/push-refused.png` })
  await page.locator('[data-replay-push]').click()
  check('8. opening the confirm again retires the last refusal', (await page.locator('[data-replay-error="push"]').count()) === 0)
  await page.locator('[data-replay-confirm-push]').click()
  await page.locator('[data-replay-result]').waitFor({ timeout: 5000 }).catch(() => {})
  check('8. …and the same push, no longer refused, shows its result', (await page.locator('[data-replay-result]').count()) === 1 && (await page.locator('[data-replay-error="push"]').count()) === 0)

  // ── 7: privacy ──
  check('7. nothing of the snapshot logged to the console', !logged.some((l) => PRIVATE.test(l)))
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
  check('7. nothing of the snapshot in localStorage or sessionStorage', !PRIVATE.test(stored) && !/FAKE-0009/.test(stored))
  check('7. nothing in the URL', page.url() === `${BASE}/admin/sync/replay`, page.url())
  check('7. history state carries no snapshot', !PRIVATE.test(JSON.stringify(await page.evaluate(() => history.state))))
  check('no page errors (with canReplay)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
