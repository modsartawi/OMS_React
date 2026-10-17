// Sessions drive (spec 2737, ticket 518): Campaigns ▸ Sessions, support's view of the customer sessions.
//
// Drives the REAL app in Chromium against STUBS. No HQ contract exists yet (BackOffice 2760 is
// unbuilt), so the stubs serve the PROVISIONAL shapes of `src/core/models/rule-campaign.ts` on the
// REAL envelope { statusCode, success, message, errors: [{ errorCode, internalErrorCode,
// errorMessage }], data }; ticket 520 re-points them:
//   GET  RuleCampaign/Lookups/Stores          → tools/campaigns-fixtures.mjs `lookup`
//   GET  RuleCampaign/Sessions?store=&date=&status= → the rows below, filtered by store, created day, status
//   GET  RuleCampaign/Sessions/{saleId}       → one session whole; an unknown id is refused (404)
//   GET  RuleCampaign/SessionAccess           → { canCancel } (per run: true, false, or a refusal)
//   POST RuleCampaign/Sessions/{saleId}/Cancel → the session cancelled + its rollback; the first
//                                               `refuseCancel` cancels are refused
// Never a live SIS.Api.
//
// It asserts:
//   1. the Campaigns group has a Sessions leaf, ungated, that opens /campaigns/sessions and lights itself;
//   2. nothing is listed (or asked) until a store is chosen;
//   3. a store lists its sessions of the LOCAL day (today by default), the filter kept in the address;
//   4. the status and the day filter the list;
//   5. a row opens the session: status, member, channel, local moments and money;
//   6. Events: calls, holds, budget and journal movements and refusals, oldest first by local time,
//      each call's moment, requestId, cart version and HQ's reply (as free text); refusals in EN + AR;
//   7. Cart items: each line's effects (labels in EN + AR) and its unit allocation;
//   8. Campaigns: each campaign's outcome — applied with what it gave, not met with the messages in
//      EN + AR, skipped with HQ's reason, lost with the winner;
//   9. Cancel session asks first; Keep sends nothing; a refusal shows HQ's message and code; the
//      cancel then shows the rollback — budgets released, coupon uses refunded, created codes
//      disabled, points reversed — and the session reads Cancelled with no Cancel left;
//  10. Back lands on the list of the session's store and day, which reads it Cancelled;
//  11. a sale id is looked up; an unknown one shows HQ's refusal;
//  12. a cancelled or returned session offers no Cancel, even with the permission;
//  13. without the permission — or when the access door fails — no Cancel is drawn;
//  14. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/sessions-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { lookup } from './campaigns-fixtures.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.campaigns-shots'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/campaigns-drive.mjs).
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

const CANCEL_REFUSED = 'The sale is still being late-closed at HQ; try again in a minute.'
const NOT_FOUND = 'No customer session has this sale id.'

const S = (id, o) => ({
  id, store: 'R101', channel: 'POS', memberId: null, status: 'closed', currency: 'SAR', gross: 0, discount: 0, net: 0,
  created: '2026-10-16T09:00:00', lastActivity: '2026-10-16T09:05:00',
  calls: [], holds: [], budgets: [], journal: [], refusals: [], lines: [], campaigns: [], ...o,
})
const says = (en, ar) => ({ en, ar })
const unit = (n, campaignCode, discount, returned = false) => ({ unit: n, campaignCode, discount, returned })

/** The session the drive reads whole: a closed sale at Riyadh Olaya with a coupon, points and a created code. */
const MAIN_ID = 'R101-2026-1016-0042'
const MAIN = S(MAIN_ID, {
  memberId: 'M-208877', status: 'closed', gross: 199, discount: 22, net: 177,
  created: '2026-10-16T10:00:05', lastActivity: '2026-10-16T10:03:20',
  // HQ answers each list in its own order — the close call first — and the page puts them in time order.
  calls: [
    { at: '2026-10-16T10:03:20', moment: 'close', requestId: 'req-4', cartVersion: 3, reply: 'Closed: 3 effects, 1 code created.', ok: true },
    { at: '2026-10-16T10:00:05', moment: 'attach', requestId: 'req-1', cartVersion: 1, reply: 'Member M-208877 attached.', ok: true },
    { at: '2026-10-16T10:01:10', moment: 'subtotal', requestId: 'req-2', cartVersion: 2, reply: 'Priced: SAR 22.00 off, 1 refusal.', ok: true },
    { at: '2026-10-16T10:03:00', moment: 'pay', requestId: 'req-3', cartVersion: 3, reply: 'Budgets held.', ok: true },
  ],
  refusals: [
    { at: '2026-10-16T10:01:10', requestId: 'req-2', campaignCode: 'PTS-50OFF', code: 'RULE_COUPON_SECOND', reason: says('Only one coupon per sale.', 'قسيمة واحدة فقط لكل عملية بيع.') },
  ],
  holds: [{ at: '2026-10-16T10:03:00', requestId: 'req-3', campaignCode: 'WKND20', budget: 'Discount money', limit: 'money', amount: 22, kind: 'held' }],
  budgets: [{ at: '2026-10-16T10:03:20', requestId: 'req-4', campaignCode: 'WKND20', budget: 'Discount money', limit: 'money', amount: 22, kind: 'committed' }],
  journal: [
    { at: '2026-10-16T10:03:20', requestId: 'req-4', campaignCode: 'WKND20', kind: 'couponRedeemed', code: 'WKND20', points: null },
    { at: '2026-10-16T10:03:20', requestId: 'req-4', campaignCode: 'BASE-EARN', kind: 'pointsEarned', code: null, points: 120 },
    { at: '2026-10-16T10:03:20', requestId: 'req-4', campaignCode: 'NEXT-VISIT', kind: 'couponCreated', code: 'NV-7KQ2', points: null },
  ],
  lines: [
    {
      line: 1, sku: 'SUN-50', name: 'Sunblock SPF 50', qty: 2, gross: 110, discount: 22, net: 88,
      effects: [{ campaignCode: 'WKND20', kind: 'discount', amount: 22, points: null, label: says('Weekend 20%', 'خصم نهاية الأسبوع 20%'), coupon: null }],
      units: [unit(1, 'WKND20', 11), unit(2, 'WKND20', 11)],
    },
    { line: 2, sku: 'SER-VC', name: 'Vitamin C serum 30ml', qty: 1, gross: 89, discount: 0, net: 89, effects: [], units: [unit(1, null, 0)] },
  ],
  campaigns: [
    { campaignId: 'WKND20', code: 'WKND20', name: says('Weekend coupon: 20% off', 'قسيمة نهاية الأسبوع: خصم 20%'), version: 3, outcome: 'applied', reason: null, lostTo: null, notMet: [], discount: 22, points: 0 },
    { campaignId: 'BASE-EARN', code: 'BASE-EARN', name: says('Base earn', 'كسب النقاط الأساسي'), version: 1, outcome: 'applied', reason: null, lostTo: null, notMet: [], discount: 0, points: 120 },
    {
      campaignId: 'GP-BEAUTY15', code: 'GP-BEAUTY15', name: says('Gold & Platinum: 15% off Beauty', 'الذهبي والبلاتيني: خصم 15% على التجميل'), version: 2, outcome: 'notMet', reason: null, lostTo: null,
      notMet: [says('For Gold and Platinum members', 'لأعضاء الفئة الذهبية والبلاتينية')], discount: 0, points: 0,
    },
    { campaignId: 'PTS-50OFF', code: 'PTS-50OFF', name: says('SAR 50 off for points', 'خصم 50 ريال مقابل النقاط'), version: null, outcome: 'skipped', reason: 'a second coupon on the sale', lostTo: null, notMet: [], discount: 0, points: 0 },
    { campaignId: 'SUN-3FOR2', code: 'SUN-3FOR2', name: says('Suncare 3 for 2', 'العناية بالشمس 3 بسعر 2'), version: 4, outcome: 'lost', reason: null, lostTo: 'BABY-BUNDLE', notMet: [], discount: 0, points: 0 },
  ],
})

const ROLLBACK = {
  budgets: [{ campaignCode: 'WKND20', budget: 'Discount money', limit: 'money', amount: 22 }],
  coupons: [{ campaignCode: 'WKND20', code: 'WKND20' }],
  createdCodes: [{ campaignCode: 'NEXT-VISIT', code: 'NV-7KQ2' }],
  points: [{ campaignCode: 'BASE-EARN', kind: 'earnReversed', points: 120 }],
}

const SESSIONS = () => [
  structuredClone(MAIN),
  S('R101-2026-1016-0043', { status: 'open', gross: 45.5, net: 45.5, created: '2026-10-16T11:12:00', lastActivity: '2026-10-16T11:12:30' }),
  S('R101-2026-1016-0040', { status: 'cancelled', memberId: 'M-055410', gross: 60, net: 60, created: '2026-10-16T08:40:00', lastActivity: '2026-10-16T09:00:00' }),
  S('R101-2026-1016-0039', { status: 'returned', gross: 30, net: 30, created: '2026-10-16T08:10:00', lastActivity: '2026-10-16T12:00:00' }),
  S('R101-2026-1015-0101', { status: 'closed', gross: 15, net: 15, created: '2026-10-15T20:00:00', lastActivity: '2026-10-15T20:01:00' }),
  S('M01-2026-1016-0007', { store: 'M01', currency: 'BHD', gross: 14.444, discount: 1, net: 13.444, created: '2026-10-16T10:00:00', lastActivity: '2026-10-16T10:02:00' }),
]
const rowOf = ({ calls, holds, budgets, journal, refusals, lines, campaigns, ...row }) => row

const browser = await chromium.launch()

async function open({ access = 'yes', refuseCancel = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const cancels = []
  const sessions = SESSIONS()
  let refusals = refuseCancel
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.clock.setFixedTime(new Date('2026-10-16T18:30:00+03:00'))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = decodeURIComponent(url.pathname.split('/api/')[1])
    calls.push(`${req.method()} ${p}${url.search}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    // PROVISIONAL doors (ticket 520 re-points them).
    if (p === 'RuleCampaign/Lookups/Stores') return route.fulfill(envelope(lookup('stores', url.searchParams.get('search') ?? '')))
    if (p === 'RuleCampaign/SessionAccess') {
      if (access === 'fails') return route.fulfill(envelope(null, { status: 500, success: false, message: 'Access door down.' }))
      return route.fulfill(envelope({ canCancel: access === 'yes' }))
    }
    if (p === 'RuleCampaign/Sessions' && req.method() === 'GET') {
      const store = url.searchParams.get('store')
      const date = url.searchParams.get('date')
      const status = url.searchParams.get('status')
      return route.fulfill(envelope(sessions.filter((s) => s.store === store && s.created.startsWith(date) && (!status || s.status === status)).map(rowOf)))
    }
    const cancel = /^RuleCampaign\/Sessions\/(.+)\/Cancel$/.exec(p)
    if (cancel && req.method() === 'POST') {
      cancels.push(cancel[1])
      if (refusals > 0) {
        refusals--
        return route.fulfill(envelope(null, { status: 409, success: false, message: CANCEL_REFUSED, errorCode: 'RULE_SESSION_CLOSING' }))
      }
      const s = sessions.find((x) => x.id === cancel[1])
      s.status = 'cancelled'
      s.lastActivity = '2026-10-16T18:30:00'
      s.calls.push({ at: '2026-10-16T18:30:00', moment: 'cancel', requestId: 'req-support-1', cartVersion: 3, reply: 'Cancelled by support.', ok: true })
      s.budgets.push({ at: '2026-10-16T18:30:00', requestId: 'req-support-1', campaignCode: 'WKND20', budget: 'Discount money', limit: 'money', amount: 22, kind: 'released' })
      return route.fulfill(envelope({ session: s, rollback: ROLLBACK }))
    }
    const one = /^RuleCampaign\/Sessions\/([^/]+)$/.exec(p)
    if (one && req.method() === 'GET') {
      const s = sessions.find((x) => x.id === one[1])
      return route.fulfill(s ? envelope(s) : envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_SESSION_NOT_FOUND' }))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, cancels }
}

const field = (page, name) => page.locator(`[data-sessions-field="${name}"]`)
const gridIds = (page) => page.$$eval('[data-sessions-grid] .ag-row[row-id]', (rows) => rows.map((r) => r.getAttribute('row-id')).sort())
const text = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim()
const fact = (page, k) => text(page.locator(`[data-session-fact="${k}"] dd`))
/** Waits until the grid holds exactly these sessions (a count alone can match the answer before). */
const waitRows = (page, ids) =>
  page.waitForFunction(
    (want) => JSON.stringify([...document.querySelectorAll('[data-sessions-grid] .ag-row[row-id]')].map((r) => r.getAttribute('row-id')).sort()) === want,
    JSON.stringify([...ids].sort()),
    { timeout: 10000 },
  )
const DAY16 = ['R101-2026-1016-0039', 'R101-2026-1016-0040', 'R101-2026-1016-0042', 'R101-2026-1016-0043']
const listCalls = (calls) => calls.filter((c) => c.startsWith('GET RuleCampaign/Sessions?'))

{
  const { context, page, errors, calls, cancels } = await open({ refuseCancel: 1 })
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns/sessions"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Sessions leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns/sessions`)
  await page.locator('[data-sessions]').waitFor({ timeout: 15000 })
  check('1: it opens /campaigns/sessions and lights itself, not Campaigns',
    (await leaf.getAttribute('aria-current')) === 'page' && (await page.locator('a[href="/campaigns"]').first().getAttribute('aria-current')) !== 'page')
  check('1: ungated — no probe call for the leaf', !calls.some((c) => /RuleCampaign\/Access/.test(c)))

  // ── 2 ──
  check('2: nothing is listed until a store is chosen', (await page.locator('[data-sessions-needs-store]').isVisible()) && listCalls(calls).length === 0)
  check('2: the day starts on the local today', (await field(page, 'date').inputValue()) === '2026-10-16')

  // ── 3 ──
  await field(page, 'store').selectOption('R101')
  await waitRows(page, DAY16)
  check('3: a store lists its sessions of the local day', JSON.stringify(await gridIds(page)) === JSON.stringify(['R101-2026-1016-0039', 'R101-2026-1016-0040', 'R101-2026-1016-0042', 'R101-2026-1016-0043']), JSON.stringify(await gridIds(page)))
  check('3: the door is asked for the store and the local day, no status', listCalls(calls).at(-1) === 'GET RuleCampaign/Sessions?store=R101&date=2026-10-16', listCalls(calls).at(-1))
  check('3: the store is kept in the address', new URL(page.url()).searchParams.get('store') === 'R101')
  const row42 = page.locator(`[data-sessions-grid] .ag-row[row-id="${MAIN_ID}"]`)
  check('3: a row reads its status, member, money and local moments',
    /Closed/.test(await text(row42)) && /M-208877/.test(await text(row42)) && /177\.00/.test(await text(row42)) && /2026-10-16 10:03:20/.test(await text(row42)), await text(row42))
  check('3: a walk-in reads as one', /Walk-in/.test(await text(page.locator('[data-sessions-grid] .ag-row[row-id="R101-2026-1016-0043"]'))))
  check('3: the count', /4 sessions/.test(await text(page.locator('[data-status-count]'))))

  // ── 4 ──
  await field(page, 'status').selectOption('closed')
  await waitRows(page, [MAIN_ID])
  check('4: a status filters the list, and is sent', JSON.stringify(await gridIds(page)) === JSON.stringify([MAIN_ID]) && listCalls(calls).at(-1).endsWith('&status=closed'))
  await field(page, 'status').selectOption('')
  await waitRows(page, DAY16)
  await field(page, 'date').fill('2026-10-15')
  await waitRows(page, ['R101-2026-1015-0101'])
  check('4: another day lists that day', JSON.stringify(await gridIds(page)) === JSON.stringify(['R101-2026-1015-0101']) && new URL(page.url()).searchParams.get('date') === '2026-10-15')
  await field(page, 'date').fill('2026-10-16')
  await waitRows(page, DAY16)
  await page.screenshot({ path: `${SHOTS}/518-list.png`, fullPage: true })

  // ── 5 ──
  await row42.locator('.ag-cell[col-id="channel"]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions/${MAIN_ID}`)
  await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
  check('5: a row opens the session by its sale id', /R101-2026-1016-0042/.test(await text(page.locator('h1'))))
  check('5: its status, member, channel and store', (await page.locator('[data-session-status]').getAttribute('data-session-status')) === 'closed' &&
    (await fact(page, 'member')) === 'M-208877' && (await fact(page, 'channel')) === 'POS' && (await fact(page, 'store')) === 'R101')
  check('5: local moments and money', (await fact(page, 'created')) === '2026-10-16 10:00:05' && (await fact(page, 'net')) === 'SAR 177.00' && (await fact(page, 'discount')) === 'SAR 22.00')

  // ── 6 ──
  await page.locator('[data-session-events]').waitFor()
  const events = await page.$$eval('[data-session-events] .ag-row[row-id]', (rows) =>
    rows
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((r) => `${r.querySelector('[col-id="at"]')?.textContent?.trim()} ${r.querySelector('[data-event]')?.getAttribute('data-event')}`))
  check('6: calls and movements oldest first by local time, the call before what it caused',
    JSON.stringify(events) === JSON.stringify([
      '2026-10-16 10:00:05 call', '2026-10-16 10:01:10 call', '2026-10-16 10:01:10 refusal', '2026-10-16 10:03:00 call', '2026-10-16 10:03:00 hold',
      '2026-10-16 10:03:20 call', '2026-10-16 10:03:20 budget', '2026-10-16 10:03:20 journal', '2026-10-16 10:03:20 journal', '2026-10-16 10:03:20 journal',
    ]), JSON.stringify(events))
  const subtotal = page.locator('[data-session-events] .ag-row', { has: page.locator('[data-event-moment="subtotal"]') })
  check('6: a call shows its moment, request id, cart version and HQ\'s reply',
    /Subtotal/.test(await text(subtotal)) && /req-2/.test(await text(subtotal)) && (await text(subtotal.locator('[col-id="cartVersion"]'))) === '2' &&
      (await subtotal.locator('[data-event-reply] bdi').innerText()) === 'Priced: SAR 22.00 off, 1 refusal.')
  const refusal = page.locator('[data-session-events] [data-event="refusal"]')
  check('6: a refusal shows its code and its reason in both languages',
    (await refusal.locator('[data-event-refusal]').getAttribute('data-event-refusal')) === 'RULE_COUPON_SECOND' &&
      (await refusal.locator('[data-says-en]').innerText()) === 'Only one coupon per sale.' && (await refusal.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
  const evText = await text(page.locator('[data-session-events]'))
  check('6: holds, budget and journal movements read as sentences',
    /Held SAR 22\.00 of Discount money/.test(evText) && /Counted SAR 22\.00 against Discount money/.test(evText) && /Coupon WKND20 redeemed/.test(evText) &&
      /120 points earned/.test(evText) && /Coupon NV-7KQ2 created/.test(evText), evText)
  check('6: grid cells carry no FSI / PDI (they would reach Ctrl+C)', !/[⁦-⁩]/.test(evText))
  await page.screenshot({ path: `${SHOTS}/518-events.png`, fullPage: true })

  // ── 7 ──
  await page.locator('[data-session-tab="cart"]').click()
  await page.locator('[data-session-cart]').waitFor()
  const l1 = page.locator('[data-session-line-effects="1"]')
  check('7: a line shows its campaign\'s effect, its label in both languages',
    /WKND20\s*SAR 22\.00 off/.test(await text(l1)) && (await l1.locator('[data-says-en]').innerText()) === 'Weekend 20%' && (await l1.locator('[data-says-ar]').innerText()) === 'خصم نهاية الأسبوع 20%', await text(l1))
  check('7: …and its unit allocation', (await text(page.locator('[data-session-units="1"]'))) === 'Unit 1: WKND20, SAR 11.00 off Unit 2: WKND20, SAR 11.00 off', await text(page.locator('[data-session-units="1"]')))
  check('7: a line no campaign touched says so', /No campaign touched this line/.test(await text(page.locator('[data-session-line-effects="2"]'))) && /Unit 1: no discount/.test(await text(page.locator('[data-session-units="2"]'))))

  // ── 8 ──
  await page.locator('[data-session-tab="campaigns"]').click()
  await page.locator('[data-session-campaigns]').waitFor()
  const c = (code) => page.locator(`[data-session-campaign="${code}"]`)
  check('8: an applied campaign with its version and what it took off', (await c('WKND20').getAttribute('data-outcome')) === 'applied' && /Version 3/.test(await text(c('WKND20'))) && /Took SAR 22\.00 off/.test(await text(c('WKND20'))))
  check('8: points given', /Gave 120 points/.test(await text(c('BASE-EARN'))))
  check('8: not met — the failed condition\'s message in both languages',
    (await c('GP-BEAUTY15').locator('[data-session-campaign-not-met] [data-says-en]').innerText()) === 'For Gold and Platinum members' &&
      (await c('GP-BEAUTY15').locator('[data-session-campaign-not-met] [data-says-ar]').innerText()) === 'لأعضاء الفئة الذهبية والبلاتينية')
  check('8: skipped — HQ\'s reason', (await c('PTS-50OFF').locator('[data-session-campaign-reason]').innerText()) === 'a second coupon on the sale')
  check('8: lost — to whom', /Lost its group to BABY-BUNDLE/.test(await text(c('SUN-3FOR2'))))
  check('8: both names of a campaign', (await c('WKND20').locator('[data-says-ar]').first().innerText()) === 'قسيمة نهاية الأسبوع: خصم 20%')

  // ── 9 ──
  const cancelOpen = page.locator('[data-session-cancel-open]')
  check('9: Cancel session is offered to support holding the permission', await cancelOpen.isVisible())
  await cancelOpen.click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('9: it asks first, saying what is rolled back', /budget counters go down/.test(await text(dialog)) && /R101-2026-1016-0042/.test(await text(dialog)))
  await dialog.getByRole('button', { name: 'Keep the session' }).click()
  await dialog.waitFor({ state: 'detached' })
  check('9: Keep sends nothing', cancels.length === 0)
  await cancelOpen.click()
  await page.locator('[data-session-cancel-confirm]').click()
  await page.locator('[data-session-cancel-refusal]').waitFor({ timeout: 5000 })
  check('9: a refused cancel shows HQ\'s message and its code, and stays open',
    /late-closed at HQ/.test(await text(page.locator('[data-session-cancel-refusal]'))) &&
      (await page.locator('[data-session-cancel-refusal] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_SESSION_CLOSING' && (await page.locator('dialog[open]').count()) === 1)
  await page.locator('[data-session-cancel-confirm]').click()
  await page.locator('[data-session-rollback]').waitFor({ timeout: 5000 })
  check('9: the cancel POSTs the sale id', JSON.stringify(cancels) === JSON.stringify([MAIN_ID, MAIN_ID]))
  const rb = (k) => page.locator(`[data-rollback="${k}"]`)
  check('9: the rollback — budgets released', (await rb('budgets').getAttribute('data-rollback-count')) === '1' && /WKND20\s*Released SAR 22\.00 of Discount money/.test(await text(rb('budgets'))), await text(rb('budgets')))
  check('9: …coupon uses refunded', /WKND20 is free again/.test(await text(rb('coupons'))))
  check('9: …created codes disabled', /NV-7KQ2 disabled/.test(await text(rb('createdCodes'))))
  check('9: …points reversed', /BASE-EARN\s*120 points earned taken back/.test(await text(rb('points'))), await text(rb('points')))
  check('9: the session reads Cancelled, with no Cancel left',
    (await page.locator('[data-session-status]').getAttribute('data-session-status')) === 'cancelled' && (await cancelOpen.count()) === 0 && (await page.locator('dialog[open]').count()) === 0)
  await page.locator('[data-session-tab="events"]').click()
  check('9: its events now end with the cancel call and the release', /Cancel/.test(await text(page.locator('[data-session-events] [data-event-moment="cancel"]'))) &&
    /Released SAR 22\.00 of Discount money/.test(await text(page.locator('[data-session-events]'))))
  await page.screenshot({ path: `${SHOTS}/518-cancelled.png`, fullPage: true })

  // ── 10 ──
  await page.locator('[data-session-back]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions?store=R101&date=2026-10-16`)
  await waitRows(page, DAY16)
  check('10: Back lands on the list of its store and day, which reads it Cancelled', /Cancelled/.test(await text(row42)), await text(row42))
  await field(page, 'status').selectOption('cancelled')
  await waitRows(page, [MAIN_ID, 'R101-2026-1016-0040'])
  await page.locator('[data-session-link="R101-2026-1016-0040"]').click()
  await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
  await page.locator('[data-session-back]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions?store=R101&date=2026-10-16&status=cancelled`)
  check('10: Back keeps the list as it was left, its status filter too', (await field(page, 'status').inputValue()) === 'cancelled')
  await field(page, 'status').selectOption('')

  // ── 11 ──
  await field(page, 'saleId').fill('NOPE-1')
  await page.locator('[data-sessions-open]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions/NOPE-1`)
  await page.getByText(NOT_FOUND).waitFor({ timeout: 5000 })
  check('11: an unknown sale id shows HQ\'s refusal', await page.getByText(NOT_FOUND).isVisible())
  await page.locator('[data-session-back]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions?store=R101&date=2026-10-16`)
  check('11: …and Back from it lands on the list it was looked up from', true)
  await field(page, 'saleId').fill('  M01-2026-1016-0007 ')
  await field(page, 'saleId').press('Enter')
  await page.waitForURL(`${BASE}/campaigns/sessions/M01-2026-1016-0007`)
  await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
  check('11: a sale id is looked up (trimmed), any store — BHD at three decimals', (await fact(page, 'net')) === 'BHD 13.444', await fact(page, 'net'))

  // ── 12 ──
  for (const id of ['R101-2026-1016-0040', 'R101-2026-1016-0039']) {
    await page.goto(`${BASE}/campaigns/sessions/${id}`)
    await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
    check(`12: no Cancel on a ${await page.locator('[data-session-status]').getAttribute('data-session-status')} session`, (await page.locator('[data-session-cancel-open]').count()) === 0)
  }
  await page.goto(`${BASE}/campaigns/sessions/R101-2026-1016-0043`)
  await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
  check('12: …but one on an open session', (await page.locator('[data-session-cancel-open]').count()) === 1)

  check('14: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

for (const access of ['no', 'fails']) {
  const { context, page, errors, calls } = await open({ access })
  await page.goto(`${BASE}/campaigns/sessions/${MAIN_ID}`)
  await page.locator('[data-session-facts]').waitFor({ timeout: 15000 })
  for (let i = 0; i < 30 && !calls.some((c) => c.startsWith('GET RuleCampaign/SessionAccess')); i++) await page.waitForTimeout(100)
  await page.waitForTimeout(300)
  check(`13: ${access === 'no' ? 'without the permission' : 'when the access door fails'}, no Cancel is drawn`,
    calls.some((c) => c.startsWith('GET RuleCampaign/SessionAccess')) && (await page.locator('[data-session-cancel-open]').count()) === 0)
  check(`13: …and the session still reads (${access})`, (await page.locator('[data-session-events]').count()) === 1)
  check(`14: no page errors (${access})`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
