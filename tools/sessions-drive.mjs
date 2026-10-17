// Sessions drive (spec 2737, tickets 518, 527): Campaigns ▸ Sessions, support's view of the customer sessions.
//
// Drives the REAL app in Chromium against STUBS of the REAL doors (BackOffice 2760, brief § "HQ contract:
// support sessions (2760)"; shapes from SIS.Api `RuleSupportService` and SIS.Rules' session contracts).
// Success is `{ success: true, data }`; a refusal `{ success: false, statusCode, message, errors: [{ errorCode,
// errorMessage }] }`; a missing grant a BARE 403 with no body:
//   GET  Rules/Support/Sessions?storeCode=&from=&state=&take=  → summaries of the store's sessions OPENED that day
//   GET  Rules/Support/Session?sessionId=                       → the lookup; an unknown sale is 404 RULES_SESSION_NOT_FOUND
//   POST Rules/Support/Cancel { sessionId, requestId, reason }  → { reply, rollback, repeated, session }; a request id the
//                                                                 session already answered is `repeated: true`, empty rollback
//   the store lookup (the builder's; ticket 523 re-points it)   → tools/campaigns-fixtures.mjs `lookup`
// Never a live SIS.Api.
//
// It asserts:
//   1. the Campaigns group has a Sessions leaf, ungated, that opens /campaigns/sessions and lights itself;
//   2. nothing is listed (or asked) until a store is chosen;
//   3. a store lists its sessions of the LOCAL day (today by default) — `from` alone, `take=500` — the filter kept
//      in the address; a row reads its state, coupon and local moments, a stamp never reached reads blank;
//   4. the state and the day filter the list (`state=` sent);
//   5. a row opens the session: state, store, channel, ruleset, the stamps it reached (none it did not), money;
//   6. Events: calls, journal lines and budget events, oldest first by local time, the call before what it
//      caused; a call's verb, the state it left, request id and cart version; its reply's refusals in EN + AR;
//   7. Cart items: each line's effects summed per campaign (labels in EN + AR) and its units, a returned unit;
//   8. Campaigns: what each campaign gave, its refusals in EN + AR, the sale's own refusal, the coupon, the points;
//   9. Cancel session asks first and asks WHY: Keep sends nothing; no reason (or one past 500) sends nothing; a
//      refusal shows HQ's message, its code and what it means; each press sends a new request id; the cancel then
//      shows the rollback and the session reads Returned, the support cancel's person and reason in its events;
//  10. Back lands on the list of the session's store and day, which reads it Returned;
//  11. a sale id is looked up; an unknown one shows HQ's refusal; BHD at three decimals;
//  12. no Cancel on an open, cancelled or returned session; one on a paying session;
//  13. a press HQ never answered (the network dropped after the cancel landed) is retried with the SAME request
//      id, and HQ's `repeated: true` reads as "nothing moved now";
//  14. a bare 403 says which grant is missing — on Cancel, on the list, on a session; without the store lookup
//      the store code is typed;
//  15. no page errors.
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

// The rule doors' envelopes (SIS.Api `RuleEndpointResults`).
const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const refused = (status, errorCode, message) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ success: false, statusCode: status, message, errors: [{ errorCode, errorMessage: message }] }),
})
/** A missing grant: SIS.Api's grant filter answers 403 with no body. */
const bare403 = { status: 403, body: '' }

const NOT_FOUND = 'HQ holds no customer session for sale NOPE-1: it never paid or closed online.'
const REUSED = 'Request id req-x was already answered by another call of this session.'

const says = (en, ar) => ({ en, ar })
const summary = (sessionId, o = {}) => ({
  sessionId, storeCode: 'R101', channel: 'POS', state: 'closed', rulesetVersion: 7, cartVersion: 3, currency: 'SAR', decimals: 2,
  couponCode: null, openedAt: '2026-10-16T09:00:00', paidAt: '2026-10-16T09:04:00', closedAt: '2026-10-16T09:05:00',
  cancelledAt: null, returnedAt: null, updatedAt: '2026-10-16T09:05:00', ...o,
})
const reply = (state, o = {}) => ({
  sessionId: '', state, rulesetVersion: 7, cartVersion: 3, currency: 'SAR', decimals: 2, effects: [], points: [], refusals: [],
  prompts: [], messages: [], offers: [], allocation: [], createdCoupons: [], ...o,
})
const cartLine = (lineNumber, article, quantity, net, category = 'A001') => ({
  lineNumber, article, quantity, unit: 'EA', baseUnitQuantity: quantity, gross: net, netBeforePromotion: net, vatRate: 15,
  category, fee: false, attributes: {},
})
const cart = (lines, o = {}) => ({
  storeCode: 'R101', country: 'SA', channel: 'POS', currency: 'SAR', decimals: 2, lines, coupons: [], flags: [],
  requestedPoints: 0, pointValue: 0, burnNotAuthorized: false, ...o,
})
const lookupOf = (session, o = {}) => ({
  session, calls: [], cart: null, effects: [], points: [], returned: [], holds: [], movements: [], budgetEvents: [],
  refusals: [], coupon: null, createdCoupons: [], pointsActivities: [], ...o,
})
const effect = (campaign, line, unit, amount, label = null, o = {}) => ({ campaign, rule: 'r1', effect: 'discountItems', line, unit, amount, label, freeGoods: false, ...o })
const call = (verb, requestId, at, state, cartVersion = 3, o = {}) => ({ verb, requestId, at, cartVersion, state, by: null, note: null, reply: reply(state, o) })
const move = (movementId, kind, at, amount, o = {}) => ({ movementId, counterId: 'cnt-1', campaign: 'WKND20', budget: 'money-cap', kind, amount, expiresAt: null, at, ...o })

const WKND = says('Weekend 20%', 'خصم نهاية الأسبوع 20%')
const SECOND = { code: 'RULES_COUPON_SECOND', campaign: 'PTS-50OFF', rule: 'r1', budget: null, reason: says('Only one coupon per sale.', 'قسيمة واحدة فقط لكل عملية بيع.') }
const BURN = { code: 'RULES_BURN_NOT_AUTHORIZED', campaign: null, rule: null, budget: null, reason: says('The member did not authorise the burn.', 'لم يأذن العضو باستبدال النقاط.') }
const CREATED = { campaign: 'NEXT-VISIT', rule: 'r1', template: 'NV-T', validDays: 30, validFrom: '2026-10-16T00:00:00', validTo: '2026-11-15T00:00:00', label: says('Your next visit: 10% off', 'زيارتك القادمة: خصم 10%'), code: 'NV-7KQ2', state: 'created' }

/** The session the drive reads whole: a partly returned sale at Riyadh Olaya with a coupon, points and a created code. */
const MAIN_ID = 'R101-2026-1016-0042'
const MAIN_EFFECTS = [effect('WKND20', 1, 0, 11, WKND), effect('WKND20', 1, 1, 11, WKND)]
const mainLookup = () =>
  lookupOf(
    summary(MAIN_ID, { state: 'partiallyReturned', couponCode: 'WKND20', openedAt: '2026-10-16T10:00:05', paidAt: '2026-10-16T10:03:00', closedAt: '2026-10-16T10:03:20', returnedAt: '2026-10-16T12:00:00', updatedAt: '2026-10-16T12:00:00' }),
    {
      // Oldest first, as HQ answers the ring; the journal comes in its own list.
      calls: [
        call('pay', 'req-1', '2026-10-16T10:03:00', 'paying', 3, { effects: MAIN_EFFECTS, refusals: [SECOND] }),
        call('close', 'req-2', '2026-10-16T10:03:20', 'closed', 3, { effects: MAIN_EFFECTS, createdCoupons: [CREATED] }),
        call('returns', 'req-3', '2026-10-16T12:00:00', 'partiallyReturned', 4),
      ],
      cart: cart([cartLine(2, 'SER-VC', 1, 89, 'A004'), cartLine(1, 'SUN-50', 2, 110)]),
      effects: MAIN_EFFECTS,
      points: [{ campaign: 'BASE-EARN', rule: 'r1', effect: 'awardPoints', amount: 120, desired: 120, tierAmount: 0, unit: 'PTS', activity: 'earn', activates: null, expires: null, tender: false, value: 0 }],
      returned: [{ line: 1, unit: 1 }],
      movements: [
        // HQ's own order is by time; the page reads every list in time order anyway.
        move('m-3', 'return', '2026-10-16T12:00:00.200', 11),
        move('m-1', 'hold', '2026-10-16T10:03:00.100', 22, { expiresAt: '2026-10-16T10:33:00' }),
        move('m-2', 'commit', '2026-10-16T10:03:20.100', 22),
      ],
      budgetEvents: [{ eventId: 'e-1', campaign: 'WKND20', budget: 'money-cap', reason: 'expiredHold', desired: 22, awarded: 22, used: 1010, limit: 1000, at: '2026-10-16T10:03:20.300' }],
      refusals: [SECOND, BURN],
      coupon: { code: 'WKND20', redeemTransactionId: 'CTX-881', refunds: [] },
      createdCoupons: [CREATED],
      pointsActivities: [{ activityId: 'act-1', requestId: 'req-2', refRequestId: '', loyId: 'M-208877', activityType: 'earn', status: 'posted', points: 120, at: '2026-10-16T10:03:21' }],
    },
  )

const PAYING_ID = 'R101-2026-1016-0044'
const payingLookup = () =>
  lookupOf(summary(PAYING_ID, { state: 'paying', openedAt: '2026-10-16T13:00:00', paidAt: '2026-10-16T13:02:00', closedAt: null, updatedAt: '2026-10-16T13:02:00' }), {
    calls: [call('pay', 'req-p1', '2026-10-16T13:02:00', 'paying')],
    cart: cart([cartLine(1, 'SUN-50', 1, 55)]),
    effects: [effect('WKND20', 1, 0, 11)],
    holds: [{ counterId: 'cnt-1', campaign: 'WKND20', budget: 'money-cap', scopeKey: '', periodKey: '2026-10', declared: 1000, amount: 11, released: false }],
    movements: [move('mp-1', 'hold', '2026-10-16T13:02:00.100', 11, { expiresAt: '2026-10-16T13:32:00' })],
  })

const SESSIONS = () => [
  mainLookup(),
  payingLookup(),
  lookupOf(summary('R101-2026-1016-0043', { state: 'open', openedAt: '2026-10-16T11:12:00', paidAt: null, closedAt: null, updatedAt: '2026-10-16T11:12:30' })),
  lookupOf(summary('R101-2026-1016-0040', { state: 'cancelled', openedAt: '2026-10-16T08:40:00', closedAt: null, cancelledAt: '2026-10-16T09:00:00' })),
  lookupOf(summary('R101-2026-1016-0039', { state: 'returned', openedAt: '2026-10-16T08:10:00', returnedAt: '2026-10-16T12:00:00' })),
  lookupOf(summary('R101-2026-1015-0101', { openedAt: '2026-10-15T20:00:00' })),
  lookupOf(summary('M01-2026-1016-0007', { storeCode: 'M01', currency: 'BHD', decimals: 3, openedAt: '2026-10-16T10:00:00' }), {
    cart: cart([cartLine(1, 'BH-1', 1, 14.444)], { currency: 'BHD', decimals: 3 }),
    effects: [effect('BH-1OFF', 1, 0, 1)],
  }),
]

const browser = await chromium.launch()

/**
 * `cancel`: what the cancel door does — 'ok', 'denied' (bare 403), or a list consumed one per press of
 * 'refuse' (409 RULES_REQUEST_ID_REUSED), 'drop' (the cancel lands, the answer is lost) and 'ok'.
 */
async function open({ cancel = ['ok'], list = 'ok', stores = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const cancels = []
  const sessions = SESSIONS()
  const answered = new Map()
  const plan = Array.isArray(cancel) ? [...cancel] : null
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d|net::ERR_FAILED|net::ERR_CONNECTION_RESET/.test(m.text()) && errors.push(m.text()))
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
    if (p === 'Auth/Me') return route.fulfill(ok({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    // The store lookup, on the builder's door it calls today (the provisional one) or the real one (ticket 523).
    if (p === 'RuleCampaign/Lookups/Stores' || p === 'Rules/Authoring/Lookups/stores') {
      if (stores === 'denied') return route.fulfill(bare403)
      const rows = lookup('stores', url.searchParams.get('search') ?? '')
      return route.fulfill(ok(p.startsWith('Rules/') ? rows.map((s) => ({ code: s.code, name: { en: s.name, ar: '' }, detail: 'Rule', articles: [], entries: 0, neverDiscount: false })) : rows))
    }
    if (p === 'Rules/Support/Sessions' && req.method() === 'GET') {
      if (list === 'denied') return route.fulfill(bare403)
      const store = url.searchParams.get('storeCode')
      const from = url.searchParams.get('from')
      const state = url.searchParams.get('state')
      const rows = sessions
        .map((l) => l.session)
        .filter((s) => s.storeCode === store && s.openedAt.startsWith(from) && (!state || s.state === state))
        .sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
      return route.fulfill(ok(rows))
    }
    if (p === 'Rules/Support/Session' && req.method() === 'GET') {
      const l = sessions.find((x) => x.session.sessionId === url.searchParams.get('sessionId'))
      return route.fulfill(l ? ok(l) : refused(404, 'RULES_SESSION_NOT_FOUND', NOT_FOUND))
    }
    if (p === 'Rules/Support/Cancel' && req.method() === 'POST') {
      const body = req.postDataJSON()
      cancels.push(body)
      if (cancel === 'denied') return route.fulfill(bare403)
      const l = sessions.find((x) => x.session.sessionId === body.sessionId)
      if (answered.has(body.requestId)) return route.fulfill(ok({ ...answered.get(body.requestId), repeated: true, rollback: { movements: [], budgetEvents: [], couponRefund: null, createdCoupons: [], pointsActivities: [] }, session: l }))
      const step = plan.shift() ?? 'ok'
      if (step === 'refuse') return route.fulfill(refused(409, 'RULES_REQUEST_ID_REUSED', REUSED))
      if (step === 'stale') {
        // Another support agent cancelled it first.
        l.session = { ...l.session, state: 'cancelled', cancelledAt: '2026-10-16T18:29:00', updatedAt: '2026-10-16T18:29:00' }
        return route.fulfill(refused(409, 'RULES_SESSION_CANCELLED', 'Sale R101-2026-1016-0044 is already cancelled.'))
      }
      // The cancel lands at HQ.
      const paying = l.session.state === 'paying'
      const after = paying ? 'cancelled' : 'returned'
      l.session = { ...l.session, state: after, updatedAt: '2026-10-16T18:30:00', ...(paying ? { cancelledAt: '2026-10-16T18:30:00' } : { returnedAt: '2026-10-16T18:30:00' }) }
      const rollback = paying
        ? { movements: [move('mp-2', 'release', '2026-10-16T18:30:00.100', 11)], budgetEvents: [], couponRefund: null, createdCoupons: [], pointsActivities: [] }
        : {
            movements: [move('m-4', 'return', '2026-10-16T18:30:00.100', 11)],
            budgetEvents: [],
            couponRefund: { transactionId: 'CTX-990', requestId: body.requestId, at: '2026-10-16T18:30:00' },
            createdCoupons: [{ ...CREATED, state: 'disabled' }],
            pointsActivities: [{ activityId: 'act-2', requestId: body.requestId, refRequestId: 'req-2', loyId: 'M-208877', activityType: 'reverse', status: 'posted', points: -120, at: '2026-10-16T18:30:00' }],
          }
      l.calls.push({ verb: 'support-cancel', requestId: body.requestId, at: '2026-10-16T18:30:00', cartVersion: 4, state: after, by: 'msartawi', note: body.reason, reply: reply(after) })
      l.movements.push(...rollback.movements)
      if (rollback.couponRefund) l.coupon = { ...l.coupon, refunds: [rollback.couponRefund] }
      if (!paying) {
        l.createdCoupons = rollback.createdCoupons
        l.pointsActivities.push(...rollback.pointsActivities)
      }
      const answer = { reply: reply(after), rollback, repeated: false, session: l }
      answered.set(body.requestId, answer)
      if (step === 'drop') return route.abort('connectionreset')
      return route.fulfill(ok(answer))
    }
    if (/Access$/.test(p)) return route.fulfill(ok({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(ok([]))
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
const DAY16 = ['R101-2026-1016-0039', 'R101-2026-1016-0040', 'R101-2026-1016-0042', 'R101-2026-1016-0043', PAYING_ID]
const listCalls = (calls) => calls.filter((c) => c.startsWith('GET Rules/Support/Sessions?'))
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

{
  const { context, page, errors, calls, cancels } = await open({ cancel: ['refuse', 'ok'] })
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns/sessions"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Sessions leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns/sessions`)
  await page.locator('[data-sessions]').waitFor({ timeout: 15000 })
  check('1: it opens /campaigns/sessions and lights itself, not Campaigns',
    (await leaf.getAttribute('aria-current')) === 'page' && (await page.locator('a[href="/campaigns"]').first().getAttribute('aria-current')) !== 'page')
  check('1: ungated — no probe call for the leaf', !calls.some((c) => /RuleCampaign\/Access|Rules\/[A-Za-z]+\/Access/.test(c)), calls.filter((c) => /Access/.test(c)).join(' | '))

  // ── 2 ──
  check('2: nothing is listed until a store is chosen', (await page.locator('[data-sessions-needs-store]').isVisible()) && listCalls(calls).length === 0)
  check('2: the day starts on the local today', (await field(page, 'date').inputValue()) === '2026-10-16')

  // ── 3 ──
  await field(page, 'store').selectOption('R101')
  await waitRows(page, DAY16)
  check('3: a store lists its sessions of the local day', JSON.stringify(await gridIds(page)) === JSON.stringify([...DAY16].sort()), JSON.stringify(await gridIds(page)))
  check('3: the door is asked for the store and the local day as `from` alone, at the cap',
    listCalls(calls).at(-1) === 'GET Rules/Support/Sessions?storeCode=R101&from=2026-10-16&take=500', listCalls(calls).at(-1))
  check('3: the store is kept in the address', new URL(page.url()).searchParams.get('store') === 'R101')
  const row42 = page.locator(`[data-sessions-grid] .ag-row[row-id="${MAIN_ID}"]`)
  check('3: a row reads its state, coupon and local moments',
    /Partly returned/.test(await text(row42)) && /WKND20/.test(await text(row42)) && /2026-10-16 10:00:05/.test(await text(row42)) && /2026-10-16 12:00:00/.test(await text(row42)), await text(row42))
  check('3: a stamp never reached reads blank', (await text(page.locator('[data-sessions-grid] .ag-row[row-id="R101-2026-1016-0043"] [col-id="paidAt"]'))) === '')
  const order = await page.$$eval('[data-sessions-grid] .ag-row[row-id]', (rs) => rs.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((r) => r.getAttribute('row-id')))
  check('3: newest opened first', order[0] === PAYING_ID && order.at(-1) === 'R101-2026-1016-0039', JSON.stringify(order))
  check('3: the count', /5 sessions/.test(await text(page.locator('[data-status-count]'))))

  // ── 4 ──
  await field(page, 'status').selectOption('closed')
  await page.getByText('No session matches.').waitFor({ timeout: 10000 })
  check('4: a state is sent', listCalls(calls).at(-1) === 'GET Rules/Support/Sessions?storeCode=R101&from=2026-10-16&state=closed&take=500', listCalls(calls).at(-1))
  await field(page, 'status').selectOption('partiallyReturned')
  await waitRows(page, [MAIN_ID])
  check('4: a state filters the list', JSON.stringify(await gridIds(page)) === JSON.stringify([MAIN_ID]))
  await field(page, 'status').selectOption('')
  await waitRows(page, DAY16)
  await field(page, 'date').fill('2026-10-15')
  await waitRows(page, ['R101-2026-1015-0101'])
  check('4: another day lists that day', new URL(page.url()).searchParams.get('date') === '2026-10-15' && listCalls(calls).at(-1).includes('from=2026-10-15'))
  await field(page, 'date').fill('2026-10-16')
  await waitRows(page, DAY16)
  await page.screenshot({ path: `${SHOTS}/527-list.png`, fullPage: true })

  // ── 5 ──
  await row42.locator('.ag-cell[col-id="channel"]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions/${MAIN_ID}`)
  await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
  check('5: a row opens the session by its sale id', /R101-2026-1016-0042/.test(await text(page.locator('h1'))) && calls.includes(`GET Rules/Support/Session?sessionId=${MAIN_ID}`))
  check('5: its state, store, channel, ruleset and coupon', (await page.locator('[data-session-status]').getAttribute('data-session-status')) === 'partiallyReturned' &&
    (await fact(page, 'store')) === 'R101' && (await fact(page, 'channel')) === 'POS' && (await fact(page, 'ruleset')) === '7' && (await fact(page, 'coupon')) === 'WKND20')
  check('5: the stamps it reached, local; none it did not', (await fact(page, 'opened')) === '2026-10-16 10:00:05' && (await fact(page, 'paid')) === '2026-10-16 10:03:00' &&
    (await fact(page, 'returnedAt')) === '2026-10-16 12:00:00' && (await page.locator('[data-session-fact="cancelledAt"]').count()) === 0)
  check('5: its money, from the cart and the effects', (await fact(page, 'before')) === 'SAR 199.00' && (await fact(page, 'discount')) === 'SAR 22.00' && (await fact(page, 'net')) === 'SAR 177.00',
    `${await fact(page, 'before')} / ${await fact(page, 'discount')} / ${await fact(page, 'net')}`)

  // ── 6 ──
  await page.locator('[data-session-events]').waitFor()
  const events = await page.$$eval('[data-session-events] .ag-row[row-id]', (rows) =>
    rows
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((r) => `${r.querySelector('[col-id="at"]')?.textContent?.trim()} ${r.querySelector('[data-event]')?.getAttribute('data-event')}`))
  check('6: calls, journal lines and budget events oldest first, the call before what it caused',
    JSON.stringify(events) === JSON.stringify([
      '2026-10-16 10:03:00 call', '2026-10-16 10:03:00 movement', '2026-10-16 10:03:20 call', '2026-10-16 10:03:20 movement',
      '2026-10-16 10:03:20 budgetEvent', '2026-10-16 12:00:00 call', '2026-10-16 12:00:00 movement',
    ]), JSON.stringify(events))
  const pay = page.locator('[data-session-events] .ag-row', { has: page.locator('[data-event-verb="pay"]') })
  check('6: a call shows its verb, the state it left, its request id and cart version',
    /Pay/.test(await text(pay)) && /left it Paying/.test(await text(pay)) && /req-1/.test(await text(pay)) && (await text(pay.locator('[col-id="cartVersion"]'))) === '3', await text(pay))
  check('6: …and the refusals its reply carried, code and reason in both languages',
    (await pay.locator('[data-refusal="RULES_COUPON_SECOND"] [data-says-en]').innerText()) === 'Only one coupon per sale.' &&
      (await pay.locator('[data-refusal="RULES_COUPON_SECOND"] [data-says-ar]').getAttribute('dir')) === 'rtl' && /1 refusal/.test(await text(pay)))
  const evText = await text(page.locator('[data-session-events]'))
  check('6: journal lines and budget events read as sentences',
    /Held 22 of budget money-cap/.test(evText) && /expires 2026-10-16 10:33:00/.test(evText) && /Counted 22 against budget money-cap/.test(evText) &&
      /Gave 11 back to budget money-cap/.test(evText) && /A hold expired before close/.test(evText) && /used 1010 against a limit of 1000/.test(evText), evText)
  check('6: grid cells carry no FSI / PDI (they would reach Ctrl+C)', !/[⁦-⁩]/.test(evText))
  await page.screenshot({ path: `${SHOTS}/527-events.png`, fullPage: true })

  // ── 7 ──
  await page.locator('[data-session-tab="cart"]').click()
  await page.locator('[data-session-cart]').waitFor()
  const l1 = page.locator('[data-session-line-effects="1"]')
  check('7: a line shows its campaign\'s effect summed over its units, its label in both languages',
    /WKND20\s*SAR 22\.00 off/.test(await text(l1)) && (await l1.locator('[data-says-en]').innerText()) === 'Weekend 20%' && (await l1.locator('[data-says-ar]').innerText()) === 'خصم نهاية الأسبوع 20%', await text(l1))
  check('7: …its units, 1-based, and the one returned',
    /^Unit 1: SAR 11\.00 off by\s*WKND20 Unit 2: SAR 11\.00 off by\s*WKND20\s*returned$/.test(await text(page.locator('[data-session-units="1"]'))) &&
      (await page.locator('[data-session-units="1"] [data-session-unit="1"]').getAttribute('data-returned')) === 'true', await text(page.locator('[data-session-units="1"]')))
  check('7: a line no campaign touched says so', /No campaign touched this line/.test(await text(page.locator('[data-session-line-effects="2"]'))) && /Unit 1: no discount/.test(await text(page.locator('[data-session-units="2"]'))))
  check('7: lines in line order, net after promotions', (await text(page.locator('[data-session-cart] .ag-row[row-id="1"] [col-id="netAfter"]'))) === '88.00')

  // ── 8 ──
  await page.locator('[data-session-tab="campaigns"]').click()
  await page.locator('[data-session-campaigns]').waitFor()
  const c = (code) => page.locator(`[data-session-campaign="${code}"]`)
  check('8: a campaign with what it took off', (await c('WKND20').getAttribute('data-outcome')) === 'applied' && /Took SAR 22\.00 off/.test(await text(c('WKND20'))))
  check('8: points awarded', /Awarded 120 PTS/.test(await text(c('BASE-EARN'))))
  check('8: a code created, its label in both languages', /Created code NV-7KQ2 \(created\)/.test(await text(c('NEXT-VISIT'))) && (await c('NEXT-VISIT').locator('[data-says-ar]').innerText()) === 'زيارتك القادمة: خصم 10%')
  check('8: a refused campaign, HQ\'s reason in both languages',
    (await c('PTS-50OFF').getAttribute('data-outcome')) === 'refused' && (await c('PTS-50OFF').locator('[data-says-en]').innerText()) === 'Only one coupon per sale.')
  check('8: the sale\'s own refusal', /RULES_BURN_NOT_AUTHORIZED/.test(await text(page.locator('[data-session-section="sale-refusals"]'))))
  check('8: the coupon and the points posted', /WKND20 redeemed in transaction CTX-881/.test(await text(page.locator('[data-session-section="coupon"]'))) &&
    /earn of 120 for member M-208877 \(posted\)/.test(await text(page.locator('[data-session-section="points-activities"]'))))

  // ── 9 ──
  const cancelOpen = page.locator('[data-session-cancel-open]')
  check('9: Cancel session is offered on a partly returned session', await cancelOpen.isVisible())
  await cancelOpen.click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('9: it asks first, saying a closed sale is a full return', /returns every unit still out/.test(await text(dialog)) && /R101-2026-1016-0042/.test(await text(dialog)))
  await dialog.getByRole('button', { name: 'Keep the session' }).click()
  await dialog.waitFor({ state: 'detached' })
  check('9: Keep sends nothing', cancels.length === 0)
  await cancelOpen.click()
  const confirm = page.locator('[data-session-cancel-confirm]')
  const reasonBox = page.locator('[data-session-cancel-reason]')
  await confirm.click()
  check('9: no reason, nothing sent — the reason is asked for',
    cancels.length === 0 && (await page.locator('[data-session-cancel-reason-hint]').getAttribute('data-session-cancel-reason-hint')) === 'required')
  await reasonBox.fill('x'.repeat(501))
  await confirm.click()
  check('9: a reason past 500 characters is not sent',
    cancels.length === 0 && (await page.locator('[data-session-cancel-reason-hint]').getAttribute('data-session-cancel-reason-hint')) === 'tooLong')
  await reasonBox.fill('  Customer disputes the sale; manager approved  ')
  await confirm.click()
  await page.locator('[data-session-cancel-refusal]').waitFor({ timeout: 5000 })
  const refusal = await text(page.locator('[data-session-cancel-refusal]'))
  check('9: a refused cancel shows HQ\'s message, its code and what it means, and stays open',
    refusal.includes(REUSED) && /Press again to send a new one/.test(refusal) &&
      (await page.locator('[data-session-cancel-refusal] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULES_REQUEST_ID_REUSED' && (await page.locator('dialog[open]').count()) === 1)
  await confirm.click()
  await page.locator('[data-session-rollback]').waitFor({ timeout: 5000 })
  check('9: the cancel POSTs the sale id, a request id and the reason trimmed',
    cancels.length === 2 && cancels.every((b) => b.sessionId === MAIN_ID && UUID.test(b.requestId) && b.reason === 'Customer disputes the sale; manager approved'), JSON.stringify(cancels))
  check('9: each press sends a new request id', cancels[0].requestId !== cancels[1].requestId)
  const rb = (k) => page.locator(`[data-rollback="${k}"]`)
  check('9: the rollback — the budget journal', (await rb('budgets').getAttribute('data-rollback-count')) === '1' && /WKND20\s*Gave 11 back to budget money-cap/.test(await text(rb('budgets'))), await text(rb('budgets')))
  check('9: …the coupon refunded', /WKND20 refunded in transaction CTX-990/.test(await text(rb('coupon'))), await text(rb('coupon')))
  check('9: …created codes disabled', /NV-7KQ2 is now disabled/.test(await text(rb('createdCodes'))))
  check('9: …points given back', /reverse -120 for member M-208877/.test(await text(rb('points'))), await text(rb('points')))
  check('9: the session reads Returned, with no Cancel left',
    (await page.locator('[data-session-status]').getAttribute('data-session-status')) === 'returned' && /it is now Returned/.test(await text(page.locator('[data-session-rollback]'))) &&
      (await cancelOpen.count()) === 0 && (await page.locator('dialog[open]').count()) === 0)
  await page.locator('[data-session-tab="events"]').click()
  const sc = page.locator('[data-session-events] .ag-row', { has: page.locator('[data-event-verb="support-cancel"]') })
  check('9: its events now end with the support cancel, its person and reason', /Support cancel/.test(await text(sc)) && /By msartawi/.test(await text(sc)) &&
    (await sc.locator('[data-event-note] bdi').innerText()) === 'Customer disputes the sale; manager approved')
  await page.screenshot({ path: `${SHOTS}/527-cancelled.png`, fullPage: true })

  // ── 10 ──
  await page.locator('[data-session-back]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions?store=R101&date=2026-10-16`)
  await waitRows(page, DAY16)
  check('10: Back lands on the list of its store and day, which reads it Returned', /Returned/.test(await text(row42)) && !/Partly/.test(await text(row42)), await text(row42))
  await field(page, 'status').selectOption('cancelled')
  await waitRows(page, ['R101-2026-1016-0040'])
  await page.locator('[data-session-link="R101-2026-1016-0040"]').click()
  await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
  await page.locator('[data-session-back]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions?store=R101&date=2026-10-16&status=cancelled`)
  check('10: Back keeps the list as it was left, its state filter too', (await field(page, 'status').inputValue()) === 'cancelled')
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
  for (const id of ['R101-2026-1016-0043', 'R101-2026-1016-0040', 'R101-2026-1016-0039']) {
    await page.goto(`${BASE}/campaigns/sessions/${id}`)
    await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
    check(`12: no Cancel on a ${await page.locator('[data-session-status]').getAttribute('data-session-status')} session`, (await page.locator('[data-session-cancel-open]').count()) === 0)
  }
  await page.goto(`${BASE}/campaigns/sessions/${PAYING_ID}`)
  await page.locator('[data-session-facts]').waitFor({ timeout: 10000 })
  check('12: …but one on a paying session', (await page.locator('[data-session-cancel-open]').count()) === 1)
  await page.locator('[data-session-tab="campaigns"]').click()
  check('12: a paying session shows the budget it holds', /Holds 11 of budget money-cap/.test(await text(page.locator('[data-session-campaign="WKND20"]'))))

  check('15: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: a press HQ never answered ──
{
  const { context, page, errors, cancels } = await open({ cancel: ['drop'] })
  await page.goto(`${BASE}/campaigns/sessions/${PAYING_ID}`)
  await page.locator('[data-session-cancel-open]').click()
  check('13: a paying session\'s cancel says its holds are released', /releases every budget it holds/.test(await text(page.locator('dialog[open]'))))
  await page.locator('[data-session-cancel-reason]').fill('Till froze at payment')
  await page.locator('[data-session-cancel-confirm]').click()
  await page.locator('[data-session-cancel-refusal]').waitFor({ timeout: 5000 })
  check('13: the lost answer shows as a failure', /Cannot reach the OMS API/.test(await text(page.locator('[data-session-cancel-refusal]'))))
  check('13: …and the retry is held to the same reason', await page.locator('[data-session-cancel-reason]').evaluate((e) => e.readOnly) && /retries it as it was/.test(await text(page.locator('dialog[open]'))))
  await page.locator('[data-session-cancel-confirm]').click()
  await page.locator('[data-session-rollback]').waitFor({ timeout: 5000 })
  check('13: the retry sends the SAME request id', cancels.length === 2 && cancels[0].requestId === cancels[1].requestId, JSON.stringify(cancels))
  check('13: HQ\'s repeat reads as "nothing moved now", the session Cancelled',
    (await page.locator('[data-session-rollback]').getAttribute('data-repeated')) === 'true' && (await page.locator('[data-rollback-repeated]').isVisible()) &&
      (await page.locator('[data-rollback="budgets"]').getAttribute('data-rollback-count')) === '0' &&
      (await page.locator('[data-session-status]').getAttribute('data-session-status')) === 'cancelled')
  check('15: no page errors (13)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13: a session that moved on meanwhile ──
{
  const { context, page, errors, cancels } = await open({ cancel: ['stale'] })
  await page.goto(`${BASE}/campaigns/sessions/${PAYING_ID}`)
  await page.locator('[data-session-cancel-open]').click()
  await page.locator('[data-session-cancel-reason]').fill('Customer left')
  await page.locator('[data-session-cancel-confirm]').click()
  await page.locator('[data-session-cancel-refusal]').waitFor({ timeout: 5000 })
  await page.locator('[data-session-status="cancelled"]').waitFor({ timeout: 5000 })
  check('13: a stale refusal explains itself, the session is read afresh, and Confirm has nothing left to send',
    /already cancelled\. It is read afresh/.test(await text(page.locator('[data-session-cancel-refusal]'))) &&
      (await page.locator('[data-session-cancel-confirm]').isDisabled()) && cancels.length === 1)
  check('15: no page errors (13 stale)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 14: bare 403s ──
{
  const { context, page, errors, cancels } = await open({ cancel: 'denied' })
  await page.goto(`${BASE}/campaigns/sessions/${MAIN_ID}`)
  await page.locator('[data-session-cancel-open]').click()
  await page.locator('[data-session-cancel-reason]').fill('Duplicate sale')
  await page.locator('[data-session-cancel-confirm]').click()
  await page.locator('[data-session-cancel-refusal]').waitFor({ timeout: 5000 })
  const denied = await text(page.locator('[data-session-cancel-refusal]'))
  check('14: a bare 403 on Cancel names the missing grant', /do not hold the support grant to cancel/.test(denied) && !/HTTP 403/.test(denied) && cancels.length === 1, denied)
  check('14: …it wrote nothing, so the reason stays editable', !(await page.locator('[data-session-cancel-reason]').evaluate((e) => e.readOnly)))
  check('15: no page errors (14 cancel)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors, calls } = await open({ list: 'denied', stores: 'denied' })
  await page.goto(`${BASE}/campaigns/sessions`)
  await field(page, 'storeCode').waitFor({ timeout: 15000 })
  check('14: without the store lookup, the store code is typed', /do not hold its grant\. Type the store code instead/.test(await text(page.locator('[data-sessions-stores-failed]'))) && (await field(page, 'store').count()) === 0)
  await field(page, 'storeCode').fill('R101')
  await field(page, 'storeCode').press('Enter')
  await page.getByText('You do not hold the support grant to read customer sessions').waitFor({ timeout: 5000 })
  check('14: …and a bare 403 on the list names the missing grant', listCalls(calls).at(-1) === 'GET Rules/Support/Sessions?storeCode=R101&from=2026-10-16&take=500', listCalls(calls).at(-1))
  check('15: no page errors (14 list)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
