// Guards on an insured OMS order drive (oms ticket 616; BackOffice spec 3126, doors 3142/3143 + the check's
// answer door 3128/3134). Contract: BackOffice/.issues/assets/3126-oms-react-insurance-rules-brief.md.
//
// Drives the REAL app in Chromium against STUBS (no live SIS.Api). Doors stubbed:
//   GET  SdDocumentWeb/DeliveryDocumentList        → rows with `guardState` (none|actionNeeded|pending|unchecked)
//   GET  SdDocumentWeb/Access                      → + guessed `canOverrideGuard` (INS_GUARD), `canReleaseGuardHold`
//   GET  SdDocumentWeb/(Delivery|Document)/{no}    → the 078 capture 8000000121 + `guardState` + `guards`
//   GET  Guards/Reasons                            → NCPDP intervention / outcome / reason, accepts, caps
//   POST Guards/{checkId}/Answer                   → { decisionId } (409 GUARD-LINES-CHANGED on a stale lineHash)
//   POST Oms/Orders/{no}/Guards/Recheck → new guards (the brief's spelling; `{id}` read as the document no)
//   POST Oms/Orders/{no}/Guards/Release → { reason }
// In LTR and RTL it asserts:
//   1. the order list shows "Guard check: action needed" / "Guard check pending" pills; none is blank;
//   2. Delivery details of a held order: the panel, its state, "2 lines need an answer"… and the dialog:
//      REFUSE says remove or change; WARN is a tick; OVERRIDE asks intervention + outcome (+ reason where the
//      rule asks), the exception line says "passed by HQ exception EX-41"; codes in ltr isolates; Send disabled;
//   3. Check again posts Recheck and the refusal is gone; the triad is required before Send; a capped reason;
//      the exact Answer body; the order is read again;
//   4. without INS_GUARD an OVERRIDE can only be removed or changed (no triad fields), and Send stays off;
//   5. a pending order: Release only with the release grant; the reason dialog; the exact Release body;
//   6. a stale lineHash refusal stays in the dialog with its code;
//   7. no page errors; RTL keeps codes ltr.
//
//   1. run the app:  npx vite --port 5137 --strictPort
//   2. DRIVE_PORT=5137 node tools/insurance-order-guards-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { envelope, orderGuardsStub, ORDER_GUARDS_HELD, ORDER_GUARD_LINES } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5137}`
const SHOTS = 'tools/.insurance-order-guards-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const capture = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000121-driver-assigned.json', 'utf8')).data
const HELD = '8000000121'
const PENDING = '8000000122'

const docLines = () => ORDER_GUARD_LINES.map((l) => ({ ...(capture.lines?.[0] ?? {}), ...l, quantity: 1 }))

const ROW = (deliveryNo, guardState) => ({
  deliveryNo,
  documentNo: deliveryNo,
  deliveryDocumentType: 'Forward',
  orderNo: '900100',
  storeCode: '1017',
  documentDate: '2026-10-27T00:00:00',
  deliveryType: 'Delivery',
  documentType: 'CLCN',
  documentSource: 'WEB',
  entryTime: '2026-10-27T09:00:00',
  isActiveInStore: true,
  timeSlotDescription: '',
  timeSlotDay: '',
  deliveryScheduleFromTime: '',
  deliveryScheduleToTime: '',
  customerPhone: '0500000000',
  customerName: 'Patient',
  rescheduled: false,
  rescheduledUser: '',
  rescheduledTime: '',
  rescheduledReason: '',
  rescheduledReasonCategory: '',
  netTotal: 120,
  paidAmount: 0,
  deliveryFees: 0,
  amountDue: 120,
  courierCode: '',
  courierDriverId: '',
  courierDriverName: '',
  courierDriverPhone: '',
  customerOtp: '',
  lastAction: '',
  readyStatus: '',
  clearStatus: '',
  deliveryStatus: '',
  closeStatus: '',
  reasonDescription: '',
  outForDeliveryTime: '',
  actualDeliveryTime: '',
  validTo: '',
  cityName: '',
  districtName: '',
  street1: '',
  note: '',
  isExpressDelivery: false,
  expressCourierId: '',
  documentReason: '',
  failedJobsCount: 0,
  ...(guardState ? { guardState } : {}),
})

const browser = await chromium.launch()

async function open(dir, grants) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4\d\d)/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  const orders = {
    [HELD]: { guardState: 'actionNeeded', guards: ORDER_GUARDS_HELD },
    [PENDING]: { guardState: 'pending', guards: null },
  }
  const writes = []
  const opts = { writes, answerRefusal: null }
  const reads = {}
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = req.url().split('/api/')[1].split('?')[0]
    const method = req.method()
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1017' }))
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true, ...grants }))
    if (p === 'SdDocumentWeb/DeliveryDocumentList')
      return route.fulfill(envelope([ROW(HELD, 'actionNeeded'), ROW(PENDING, 'pending'), ROW('8000000123', 'none'), ROW('8000000124', 'unchecked'), ROW('8000000125')]))
    const doorNo = p.match(/^Oms\/Orders\/(\d+)\/Guards\//)?.[1]
    const order = orders[doorNo] ?? orders[HELD]
    const body = method === 'POST' ? JSON.parse(req.postData() || 'null') : null
    const hit = orderGuardsStub(method, p, body, order, opts)
    if (hit) return route.fulfill(hit)
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) {
      reads[doc[1]] = (reads[doc[1]] ?? 0) + 1
      const o = orders[doc[1]]
      if (!o) return route.fulfill(envelope(null, { status: 400, success: false, message: 'Not found' }))
      return route.fulfill(envelope({ ...capture, documentNo: doc[1], lines: docLines(), guardState: o.guardState, guards: o.guards }))
    }
    if (/\/(Logs|Outbox|DonorRequests|PrescriptionSessions)$/.test(p)) return route.fulfill(envelope([]))
    if (/\/Callout$/.test(p)) return route.fulfill(envelope({ asOf: '2026-10-27T10:00:00', deliveryNumber: '', callouts: [] }))
    if (/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, writes, opts, orders, reads }
}

const openDetail = async (page, no) => {
  await page.goto(`${BASE}/oms/delivery/${no}`)
  await page.locator('[data-order-guards]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(200)
}
const dialog = (page) => page.locator('dialog[open] [data-guard-dialog]')
const item = (page, key) => page.locator(`[data-guard-item="${key}"]`)
const pick = (page, key, field, code) => item(page, key).locator(`select[data-guard-${field}]`).selectOption(code)
const sendDisabled = (page) => page.locator('[data-guard-send]').isDisabled()

for (const dir of ['ltr', 'rtl']) {
  const L = dir.toUpperCase()

  // ── 1: the order list ────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { canOverrideGuard: true, canReleaseGuardHold: true })
    await page.goto(`${BASE}/oms/deliveries`)
    check(`${L} 1: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    await page.locator('[data-query-search]').click().catch(() => {})
    await page.waitForSelector('.ag-row .ag-cell[col-id="guardState"]', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(400)
    const cells = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll('.ag-row')]
          .filter((r) => r.querySelector('.ag-cell[col-id="guardState"]'))
          .map((r) => [r.getAttribute('row-index'), r.querySelector('.ag-cell[col-id="guardState"]').textContent.trim()]),
      ),
    )
    const header = await page.locator('.ag-header-cell[col-id="guardState"] .ag-header-cell-text').textContent().catch(() => null)
    const words = Object.values(cells)
    check(`${L} 1: the Guard check column`, header?.trim() === 'Guard check', String(header))
    check(
      `${L} 1: "Guard check: action needed", "Guard check pending", "not checked", and blank for none / absent`,
      words.includes('Guard check: action needed') && words.includes('Guard check pending') && words.includes('Guard check: not checked') && words.filter((w) => w === '').length === 2,
      JSON.stringify(cells),
    )
    check(`${L} 1: the pills carry their state`, (await page.locator('.ag-row [data-guard-state="actionNeeded"]').count()) === 1 && (await page.locator('.ag-row [data-guard-state="pending"]').count()) === 1)
    await page.screenshot({ path: `${SHOTS}/${dir}-1-list.png` })
    check(`${L} 1: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–3: a held order with INS_GUARD: refuse, recheck, the triad, the answer ─────────────────────
  {
    const { context, page, errors, writes, reads } = await open(dir, { canOverrideGuard: true, canReleaseGuardHold: false })
    await openDetail(page, HELD)
    const panel = page.locator('[data-order-guards]')
    check(`${L} 2: the panel shows the state`, (await panel.getAttribute('data-order-guards')) === 'actionNeeded' && (await panel.locator('[data-guard-state="actionNeeded"]').textContent())?.trim() === 'Guard check: action needed')
    check(`${L} 2: "3 lines need an answer" (10, 20, 30; the exception and pass lines do not)`, (await panel.locator('[data-order-guards-lines]').textContent())?.trim() === '3 lines need an answer')
    check(`${L} 2: no Release without the release grant`, (await page.locator('[data-order-guards-release]').count()) === 0)
    await page.locator('[data-order-guards-answer]').click()
    await dialog(page).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    check(`${L} 2: one section per line, in order`, JSON.stringify(await page.locator('[data-guard-line]').evaluateAll((e) => e.map((x) => x.getAttribute('data-guard-line')))) === '["10","20","30","40","50"]')
    check(`${L} 2: the line names its item as one ltr pair`, (await page.locator('[data-guard-line="20"] [data-guard-item-name] bdi[dir="ltr"]').textContent()) === '102200 · Atorvastatin 20mg 30s')
    check(`${L} 2: REFUSE → remove or change`, (await item(page, '10:G-001').locator('[data-guard-instruction="remove"]').textContent())?.includes('Remove or change this line on the order'))
    check(`${L} 2: an unknown fact is named`, (await item(page, '10:G-001').locator('[data-guard-unknowns] bdi[dir="ltr"]').textContent()) === 'daysSupply')
    check(`${L} 2: WARN → a tick`, (await item(page, '20:G-003').locator('[data-guard-ack]').count()) === 1)
    check(
      `${L} 2: OVERRIDE → intervention, outcome and reason (G-002 asks one), G-005 no reason`,
      (await item(page, '20:G-002').locator('select').count()) === 3 && (await item(page, '30:G-005').locator('select').count()) === 2,
    )
    check(`${L} 2: an inactive intervention is not offered`, (await item(page, '20:G-002').locator('select[data-guard-intervention] option[data-code="MR"]').count()) === 0)
    check(`${L} 2: the exception line says passed by HQ exception EX-41`, /Passed by HQ exception\s*EX-41/.test((await item(page, '40:G-004').locator('[data-guard-exception]').textContent()) ?? '') && (await item(page, '40:G-004').locator('[data-guard-exception] bdi[dir="ltr"]').textContent()) === 'EX-41')
    check(`${L} 2: a pass line says no rule fired`, (await page.locator('[data-guard-line="50"] [data-guard-passed]').count()) === 1)
    check(`${L} 2: conflict and Nphies codes in ltr isolates`, (await item(page, '10:G-001').locator('[data-guard-conflict] bdi[dir="ltr"]').textContent()) === 'MX' && (await item(page, '10:G-001').locator('[data-guard-nphies] bdi[dir="ltr"]').textContent()) === 'CV-4-2')
    check(`${L} 2: the suggestion, value isolated`, (await item(page, '20:G-002').locator('[data-guard-suggestion="4"] bdi[dir="ltr"]').textContent()) === '4')
    check(`${L} 2: the Arabic message is an rtl isolate`, (await item(page, '20:G-002').locator('bdi[dir="rtl"][lang="ar"]').textContent())?.startsWith('6 وحدة'))
    check(`${L} 2: Send disabled while a line is refused`, (await sendDisabled(page)) && (await page.locator('[data-guard-status]').getAttribute('data-guard-status')) === 'refused')
    await page.screenshot({ path: `${SHOTS}/${dir}-2-dialog.png`, fullPage: true })
    await page.locator('[data-guard-cancel]').click()

    // 3: the line was changed on the order; Check again.
    const readsBefore = reads[HELD]
    await page.locator('[data-order-guards-recheck]').click()
    await page.waitForFunction((n) => true, readsBefore)
    await page.waitForTimeout(800)
    check(`${L} 3: Check again posts Recheck for the order`, writes.some((w) => w.door === 'recheck' && w.documentNo === HELD))
    check(`${L} 3: the order is read again`, reads[HELD] > readsBefore, `${readsBefore} → ${reads[HELD]}`)
    check(`${L} 3: now 2 lines need an answer`, (await page.locator('[data-order-guards-lines]').textContent())?.trim() === '2 lines need an answer')
    await page.locator('[data-order-guards-answer]').click()
    await dialog(page).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    check(`${L} 3: the refusal is gone; line 10 passes`, (await item(page, '10:G-001').count()) === 0 && (await page.locator('[data-guard-line="10"] [data-guard-passed]').count()) === 1)
    check(`${L} 3: "3 answers still needed"`, (await page.locator('[data-guard-status]').textContent())?.trim() === '3 answers still needed')
    await pick(page, '20:G-002', 'intervention', 'M0')
    check(`${L} 3: intervention alone → outcome missing`, (await item(page, '20:G-002').getAttribute('data-problem')) === 'outcomeMissing')
    await pick(page, '20:G-002', 'outcome', '1B')
    check(`${L} 3: no reason → reason missing, Send off`, (await item(page, '20:G-002').getAttribute('data-problem')) === 'reasonMissing' && (await sendDisabled(page)))
    await pick(page, '20:G-002', 'reason', '07')
    await item(page, '20:G-002').locator('[data-guard-note]').fill('  prescriber called  ')
    await item(page, '20:G-003').locator('[data-guard-ack]').check()
    check(`${L} 3: still one open (G-005)`, (await sendDisabled(page)) && (await page.locator('[data-guard-status]').textContent())?.trim() === '1 answer still needed')
    await pick(page, '30:G-005', 'intervention', 'P0')
    await pick(page, '30:G-005', 'outcome', '1A')
    check(`${L} 3: every rule answered → Send on`, !(await sendDisabled(page)) && (await page.locator('[data-guard-status]').getAttribute('data-guard-status')) === 'ready')
    const readsBeforeSend = reads[HELD]
    await page.locator('[data-guard-send]').click()
    await page.waitForFunction(() => !document.querySelector('dialog[open] [data-guard-dialog]'), null, { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(600)
    const ans = writes.find((w) => w.door === 'answer')
    check(
      `${L} 3: the exact Answer body to the new check`,
      ans?.checkId === 'CHK-7002' &&
        JSON.stringify(ans.body) ===
          JSON.stringify({
            lineHash: 'h-7002-a',
            user: 'msartawi',
            answers: [
              { line: 20, ruleId: 'G-002', intervention: 'M0', outcome: '1B', reason: '07', note: 'prescriber called' },
              { line: 20, ruleId: 'G-003', ack: true },
              { line: 30, ruleId: 'G-005', intervention: 'P0', outcome: '1A' },
            ],
          }),
      JSON.stringify(ans),
    )
    check(`${L} 3: the dialog closes, a toast names the decision, the order is read again`, (await dialog(page).count()) === 0 && (await page.locator('[data-sonner-toast]').filter({ hasText: 'DEC-9001' }).count()) === 1 && reads[HELD] > readsBeforeSend)
    check(`${L} 3: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 4: without INS_GUARD; 6: a stale lineHash refusal ───────────────────────────────────────────
  {
    const { context, page, errors, opts, orders } = await open(dir, { canOverrideGuard: false })
    await openDetail(page, HELD)
    await page.locator('[data-order-guards-answer]').click()
    await dialog(page).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    check(
      `${L} 4: without INS_GUARD an OVERRIDE can only be removed or changed`,
      (await item(page, '20:G-002').locator('[data-guard-instruction="noGrant"]').count()) === 1 && (await item(page, '20:G-002').locator('select').count()) === 0 && (await item(page, '30:G-005').locator('[data-guard-instruction="noGrant"]').count()) === 1,
    )
    check(`${L} 4: the WARN may still be ticked, Send stays off`, (await item(page, '20:G-003').locator('[data-guard-ack]').count()) === 1 && (await sendDisabled(page)))
    await page.locator('[data-guard-cancel]').click()
    await context.close()
    check(`${L} 4: no page errors`, errors.length === 0, errors.join(' | '))
    void opts
    void orders
  }
  {
    const { context, page, errors, opts, orders } = await open(dir, { canOverrideGuard: true })
    orders[HELD].guards = (await import('./insurance-rules-stubs.mjs')).ORDER_GUARDS_RECHECKED
    await openDetail(page, HELD)
    await page.locator('[data-order-guards-answer]').click()
    await dialog(page).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    // A capped reason: `04` once.
    await pick(page, '20:G-002', 'intervention', 'M0')
    await pick(page, '20:G-002', 'outcome', '1B')
    await pick(page, '20:G-002', 'reason', '04')
    check(`${L} 6: a capped reason may be picked once`, (await item(page, '20:G-002').getAttribute('data-problem')) === '')
    await item(page, '20:G-003').locator('[data-guard-ack]').check()
    await pick(page, '30:G-005', 'intervention', 'R0')
    await pick(page, '30:G-005', 'outcome', '1C')
    opts.answerRefusal = { status: 409, message: 'The order lines changed since the check.', errorCode: 'GUARD-LINES-CHANGED' }
    await page.locator('[data-guard-send]').click()
    await page.locator('[data-guard-error]').waitFor({ timeout: 10000 }).catch(() => {})
    check(
      `${L} 6: a refusal stays in the dialog with its sentence and its code`,
      (await dialog(page).count()) === 1 &&
        (await page.locator('[data-guard-error="GUARD-LINES-CHANGED"] bdi[dir="ltr"]').textContent()) === 'GUARD-LINES-CHANGED' &&
        ((await dialog(page).textContent()) ?? '').includes('The order lines changed since the check.'),
    )
    check(`${L} 6: what was picked is kept`, (await item(page, '20:G-002').locator('select[data-guard-reason]').inputValue()) === '04')
    await page.screenshot({ path: `${SHOTS}/${dir}-6-refusal.png`, fullPage: true })
    check(`${L} 6: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: a suggestion applied (review 3126 P2, stories 6 / 35): a CHANGE answer, no grant, no triad ─────────────
  {
    const { context, page, errors, writes, orders } = await open(dir, { canOverrideGuard: false })
    orders[HELD].guards = (await import('./insurance-rules-stubs.mjs')).ORDER_GUARDS_RECHECKED
    await openDetail(page, HELD)
    await page.locator('[data-order-guards-answer]').click()
    await dialog(page).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
    check(`${L} 7: a rule with a suggestion offers Apply; one without does not`, (await item(page, '20:G-002').locator('[data-guard-apply="offered"]').count()) === 1 && (await item(page, '20:G-003').locator('[data-guard-apply]').count()) === 0)
    await item(page, '20:G-002').locator('[data-guard-apply]').click()
    check(`${L} 7: applied → the no-grant instruction goes, the line says it goes on changed`, (await item(page, '20:G-002').getAttribute('data-applied')) === 'yes' && (await item(page, '20:G-002').locator('[data-guard-instruction]').count()) === 0 && (await item(page, '20:G-002').locator('[data-guard-applied]').count()) === 1)
    await item(page, '30:G-005').locator('[data-guard-apply]').click()
    await item(page, '20:G-003').locator('[data-guard-ack]').check()
    check(`${L} 7: every rule answered → Send on without INS_GUARD`, !(await sendDisabled(page)))
    await page.screenshot({ path: `${SHOTS}/${dir}-7-applied.png`, fullPage: true })
    await page.locator('[data-guard-send]').click()
    await page.waitForTimeout(800)
    const ans = writes.find((w) => w.door === 'answer')
    check(
      `${L} 7: the exact Answer body carries the CHANGE answers`,
      JSON.stringify(ans?.body) ===
        JSON.stringify({
          lineHash: 'h-7002-a',
          user: 'msartawi',
          answers: [
            { line: 20, ruleId: 'G-002', change: { maxQuantity: '4' } },
            { line: 20, ruleId: 'G-003', ack: true },
            { line: 30, ruleId: 'G-005', change: { maxDaysSupply: '34' } },
          ],
        }),
      JSON.stringify(ans),
    )
    check(`${L} 7: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5: release a pending order ─────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { canReleaseGuardHold: false })
    await openDetail(page, PENDING)
    check(`${L} 5: a pending order shows "Guard check pending" and no Answer`, (await page.locator('[data-order-guards] [data-guard-state="pending"]').textContent())?.trim() === 'Guard check pending' && (await page.locator('[data-order-guards-answer]').count()) === 0)
    check(`${L} 5: no Release without the release grant`, (await page.locator('[data-order-guards-release]').count()) === 0)
    await context.close()
    check(`${L} 5: no page errors (no grant)`, errors.length === 0, errors.join(' | '))
  }
  {
    const { context, page, errors, writes, reads } = await open(dir, { canReleaseGuardHold: true })
    await openDetail(page, PENDING)
    await page.locator('[data-order-guards-release]').click()
    const confirm = page.locator('dialog[open] [data-reason-confirm]')
    await confirm.waitFor({ timeout: 10000 }).catch(() => {})
    check(`${L} 5: the release dialog names the order in an ltr isolate`, ((await page.locator('dialog[open]').textContent()) ?? '').includes('goes on without its guard check') && (await page.locator(`dialog[open] bdi[dir="ltr"]`).filter({ hasText: PENDING }).count()) >= 1)
    check(`${L} 5: Release disabled without a reason`, await confirm.isDisabled())
    await page.locator('dialog[open] textarea').fill('  Insurer approved by phone  ')
    const before = reads[PENDING]
    await confirm.click()
    await page.waitForFunction(() => !document.querySelector('dialog[open] [data-reason-confirm]'), null, { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(600)
    const rel = writes.find((w) => w.door === 'release')
    check(`${L} 5: the exact Release body`, rel?.documentNo === PENDING && JSON.stringify(rel.body) === JSON.stringify({ reason: 'Insurer approved by phone' }), JSON.stringify(rel))
    check(`${L} 5: released — the order is read again and the panel goes`, reads[PENDING] > before && (await page.locator('[data-order-guards]').count()) === 0)
    await page.screenshot({ path: `${SHOTS}/${dir}-5-released.png` })
    check(`${L} 5: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
