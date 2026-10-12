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
//   6. a refused push (UNBALANCED) and a codeless 500 read as the console's failure inside the confirm;
//   7. privacy: nothing of the snapshot logged, stored or put in the URL; no page errors.
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
const SALE_TEXT = JSON.stringify(FAKE_SALE, null, 2)
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
      const r = REGISTERS[code]
      return route.fulfill(r ? envelope(r) : envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
    }
    if (p === 'ActionSync/Replay') {
      const body = route.request().postDataJSON()
      pushes.push(body)
      if (body.registerId === 'R03') return route.fulfill(envelope(null, { status: 400, success: false, message: 'The tenders do not add up to the total.', errorCode: 'UNBALANCED' }))
      if (body.registerId === 'R01') return route.fulfill(envelope(null, { status: 500, success: false, message: '' }))
      return route.fulfill(envelope(RESULT))
    }
    if (p === 'ActionSync/Audit') return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, pushes, logged }
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
  const { context, page, errors, calls, pushes, logged } = await open({ canReplay: true })
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
  check('2. a pasted return reads as a Return and says only a completed sale can be pushed', (await summary(page, 'kind')) === 'Return' && (await page.locator('[data-replay-not-ready]').count()) === 1)

  await json.fill(SALE_TEXT)
  await page.locator('[data-replay-not-ready]').waitFor({ state: 'detached', timeout: 5000 })
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
  check('3. …its NOT_NEWPOS_STORE refusal shows as the console failure with its code', (await page.locator('[data-replay-error-code="NOT_NEWPOS_STORE"]').count()) === 1 && /NOT_NEWPOS_STORE/.test(await page.locator('[data-replay-error="registers"]').innerText()) && /could not be read/.test(await page.locator('[data-replay-error="registers"]').innerText()))
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
  check('6. a refused push (UNBALANCED) shows in the confirm as the console failure, with its code', (await page.locator('[data-replay-error-code="UNBALANCED"]').count()) === 1 && /could not be replayed/.test(refused) && /UNBALANCED/.test(refused), refused)
  check('6. …the confirm stays open (the earlier result went when the register changed)', (await page.locator('dialog[open] [data-replay-confirm]').count()) === 1 && (await page.locator('[data-replay-result]').count()) === 0)
  await page.locator('[data-replay-confirm-cancel]').click()
  await page.locator('[data-replay-register]').selectOption('R01')
  await page.locator('[data-replay-push]').click()
  check('6. a fresh confirm carries no earlier refusal', (await page.locator('[data-replay-error="push"]').count()) === 0)
  await page.locator('[data-replay-confirm-push]').click()
  await page.locator('[data-replay-error="push"]').waitFor({ timeout: 5000 })
  check('6. a codeless 500 shows a failure with no code', (await page.locator('[data-replay-error-code=""]').count()) === 1, await page.locator('[data-replay-error="push"]').innerText())
  await page.screenshot({ path: `${SHOTS}/refused-500.png` })
  await page.locator('[data-replay-confirm-cancel]').click()

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
