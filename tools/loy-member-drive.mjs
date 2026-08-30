// Loy member lookup drive (ticket 233, spec 231) — drives the REAL app in
// Chromium against MOCKED `LoyWeb/*` envelopes.
//
// ⚠ The `LoyWeb` door does not exist: it is a BackOffice dependency on a parallel
// track (spec 231 "Boundaries: the BackOffice door"), and spec 231's standing
// verification rule — inherited from decision 228 — says no ticket in this wave
// may be called done on the strength of a live call. So the network is stubbed at
// Playwright against the shapes in 223's field inventory, which makes the stub a
// contract assertion rather than a convenience. 🚩 NOTHING here is driven against
// a live SIS.Api.
//
// It verifies ticket 233's flow Proof bullet:
//   1. `/loy/members` is one field and nothing else — no bar, no member;
//   2. a blank submit is silent — no call, no message;
//   3. a mobile resolves in ONE call, navigates to `/loy/members/:loyId`, and
//      collapses the field into a bar carrying THE SEARCHED KEY;
//   4. a Loy ID resolves in TWO — the LOY-00100 cascade, invisible to the agent;
//   5. Change reopens the field pre-filled; New lookup returns to the empty field;
//   6. a double miss is a neutral sentence naming what was typed, with the box
//      left exactly as typed and the URL unchanged;
//   7. 🚩 a bare 403 says THAT and never "no member matches", and never cascades;
//   8. a cold load of `/loy/members/:loyId` shows the bar with the LoyId.
//
// And ticket 234's (scenarios 10–12 below):
//  10. granted — the Loyalty group appears in the nav and its item routes to the
//      screen, on ONE shared probe call;
//  11. 🚩 denied — the group is absent AND a typed deep link to `/loy/members`
//      lands on the denied backstop, not on the lookup field;
//  12. 🚩 a probe that THROWS behaves exactly like a denial (fail-closed), and
//      the member read never fires on the way to the backstop.
//
// And ticket 235's (scenarios 14–19):
//  14. 🚩 an ordinary member wears the tier chip and NO status chip;
//  15. 🚩 the member-details disclosure starts SHUT, opens, and shuts again;
//  16. blocked / archived / archived-and-blocked wear one, one and three chips —
//      additively, with no precedence rule between them;
//  17. 🚩 an unknown tier and an unseeded blocked reason render as bare codes,
//      never as a raw `loy:tier.X`;
//  18. Expiring is tinted only when it is non-zero;
//  19. 🚩 an unset `0001-01-01` birth date renders as absent, not as a date.
//
// And ticket 236's (scenarios 20–26):
//  20. Activities is the landing tab and fetches ON LANDING — one call, and the
//      caption names the ceiling with no warning below the cap;
//  21. 🚩 a tab fetches only when OPENED — a cold `?tab=sales` makes NO
//      LastActivities call at all, and opening Activities makes exactly one;
//  22. `?tab=` survives a reload, and an unknown value falls back to Activities;
//  23. the six columns, signed 2dp points, a blank Expires on a debit, a decoded
//      status and a bare code for an unseeded one — and 🚩 no colour on the sign
//      and 🚩 no total row anywhere;
//  24. a member at exactly the cap shows the caption AND the at-cap warning, and
//      🚩 a bare row count is shown nowhere;
//  25. a failed tab fails INSIDE the tab — header and strip intact, no toast —
//      with a Retry that refetches only that tab;
//  26. an empty member shows the Activities sentence, never a shared "No data",
//      and never the failure banner.
//
// And ticket 237's (scenarios 27–30):
//  27. Sales fetches only when OPENED; the eight columns; a date-only Date with
//      no fabricated 00:00; one basket as several lines under one receipt;
//      🚩 a return reading `-1.00 · 12.00 · -12.00`; 🚩 NO Currency column on the
//      SAR-only member; and 🚩 no total row anywhere;
//  28. 🚩 a mixed-currency window grows the Currency column, draws BHD at THREE
//      decimals, and leaves the SAR lines beside it at two;
//  29. the at-cap warning fires at exactly 500 and not at 499;
//  30. an empty tab speaks in SALES' own words, and the timed-out report fails
//      inside its tab with a Retry that refetches only that tab.
//
// And ticket 238's (scenarios 31–35):
//  31. 🚩 the LoyId is on EVERY actions call including page 2 and 3, and the page
//      size asked for is 25 — not the pager's other caller's 50;
//  32. a 312-action member states its REAL total ("312 actions.", no ceiling and
//      no at-cap hedging) and pages Prev/Next 25 at a time;
//  33. 🚩 a 4-action member grows NO pager, and 🚩 the tab offers no sort and no
//      filter — the one tab where their absence is the decision;
//  34. 🚩 an unresolved main/sub action code renders as the RAW code, and 🚩 no
//      member-snapshot field (name, mobile, email, city, blocked reason) reaches
//      a column;
//  35. an empty tab speaks in ACTIONS' own words, and a failed one fails inside
//      its tab with a Retry that refetches only that tab.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/loy-member-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

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

// A member not found is a **400 business outcome** carrying LOY-00100 — not a
// 404, not a null `data` (223 §0). This is the only refusal that cascades.
const notFound = (message) =>
  envelope(null, {
    status: 400,
    success: false,
    message,
    errors: [{ errorCode: 'LOY-00100', errorMessage: message, internalErrorCode: '' }],
  })

// `LoyMemberModel` as the `LoyWeb` projection hands it over — every field from
// 223 §1 that the screen reads, plus 230's `memberType` amendment. The engine
// machinery (`profile`, `accrualFactor`, `redemptionFactor`, `exchangeRate`,
// `pointsExpireSoonDays`, `profileUpdated`) is deliberately absent: it is drawn
// nowhere, so a stub that supplied it would be testing a screen nobody built.
const MEMBER = {
  loyId: '100001293',
  mobileCountry: 'SA',
  mobile: '966555000111',
  fullName: 'Nouf Al-Harbi',
  birthDate: '1990-11-08T00:00:00',
  gender: 'F',
  email: 'nouf.h@example.com',
  nationality: 'SA',
  nationalId: '1098443217',
  insuranceCompany: null,
  cityCode: 'RUH',
  preferredLanguage: 'AR',
  joinDate: '2021-03-14T00:00:00',
  lastUpdate: '2026-07-31T09:12:00',
  tier: 'G',
  tierPointsBalance: 8940,
  pendingPoints: 320,
  pointsBalance: 12480,
  pointsBalanceAmount: 561,
  pointsBalanceAmountCurrency: 'SAR',
  pointsExpireSoon: 1200,
  memberType: 'M',
  blockedReason: null,
}

// The stubbed loyalty base: one member, reachable by mobile 966555000111 and by
// LoyId 100001293. Everything else misses.
const MOBILE_KEY = '966555000111'
const LOYID_KEY = '100001293'

// A SECOND member, by LoyId only. He exists for one assertion (scenario 33c):
// two members are the only way to drive what a member change does to a tab's own
// state, and one stubbed member cannot change into anybody.
const LOYID_KEY_2 = '100002468'
const MEMBER_2 = {
  ...MEMBER,
  loyId: LOYID_KEY_2,
  mobile: '966555000222',
  fullName: 'Faisal Al-Otaibi',
  gender: 'M',
  email: 'faisal.o@example.com',
  nationalId: '1044556677',
}

/** The lookup field's DOM id, as `MemberLookupPage` sets it. */
const FIELD_ID = 'loy-member-lookup'

// `LastActivityModel` rows as the report hands them over (223 §2), narrowed to
// the fields the tab draws. 🚩 `points` arrives ALREADY SIGNED — the stub is not
// negating anything the client then re-derives, because `AddActivity` negates
// `SpendPoints` in place server-side and there is no client-side debit table.
const ACTIVITY_ROWS = [
  {
    activityId: '900003',
    activityType: 'ACRL',
    description: 'Purchase accrual',
    activityDateTime: '2026-08-02T14:35:00',
    activityStatus: 'P',
    expiryDate: '2027-08-02T00:00:00',
    points: 240.25,
    referenceNumber: 'TRX-8841203',
  },
  {
    // A debit: signed negative, and the server's own rule blanks its expiry.
    activityId: '900002',
    activityType: 'RDEM',
    description: 'Redemption',
    activityDateTime: '2026-07-28T09:04:00',
    activityStatus: 'N',
    expiryDate: '2027-07-28T00:00:00',
    points: -450.5,
    referenceNumber: 'TRX-8830117',
  },
  {
    // 🚩 An unseeded status code — it must render BARE, never as a raw
    // `loy:activityStatus.Z`.
    activityId: '900001',
    activityType: 'ADJC',
    description: 'Manual adjustment',
    activityDateTime: '2026-07-11T16:20:00',
    activityStatus: 'Z',
    expiryDate: '0001-01-01T00:00:00',
    points: 500,
    referenceNumber: 'ADJ-00412',
  },
]

/** A filler row set of exactly `n` rows, for the below-cap / at-cap captions. */
const activityRows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    ...ACTIVITY_ROWS[0],
    activityId: String(800000 - i),
    referenceNumber: `TRX-${800000 - i}`,
  }))

// `LoyaltySalesLine` rows as the report hands them over (223 §3), narrowed to the
// fields the tab draws. 🚩 A row is one sales LINE — the first two share a
// receipt number because they are two items in one basket, which is the grain
// the tab must not roll up. 🚩 `qty` and `amount` are signed on a return and
// `unitPrice` is NOT — the stub carries the receipt's own shape, so the drive is
// asserting a rendering and not a client-side sign derivation that does not
// exist.
const SALES_ROWS = [
  {
    storeCode: '1001',
    trxNumber: 'R-88412',
    trxDate: '2026-07-30T00:00:00',
    itemNumber: '300221',
    itemDescription: 'Panadol Extra 24 tab',
    unitPrice: 12,
    qty: 2,
    amount: 24,
    currency: 'SAR',
  },
  {
    storeCode: '1001',
    trxNumber: 'R-88412',
    trxDate: '2026-07-30T00:00:00',
    itemNumber: '300984',
    itemDescription: 'Vitamin D3 1000IU',
    unitPrice: 45.5,
    qty: 1,
    amount: 45.5,
    currency: 'SAR',
  },
  {
    // 🚩 The return line. It must read `-1.00 · 12.00 · -12.00` — signed qty and
    // amount against an UNSIGNED unit price. That is the receipt.
    storeCode: '1001',
    trxNumber: 'R-88377',
    trxDate: '2026-07-22T00:00:00',
    itemNumber: '300221',
    itemDescription: 'Panadol Extra 24 tab',
    unitPrice: 12,
    qty: -1,
    amount: -12,
    currency: 'SAR',
  },
]

// The same member, having also shopped in Bahrain. 🚩 BHD is the footprint's only
// 3-decimal currency and its stores are live, so this window is what makes the
// Currency column appear AND what proves 3dp is not 2dp with a label.
const MIXED_SALES_ROWS = [
  ...SALES_ROWS,
  {
    storeCode: '9101',
    trxNumber: 'R-70115',
    trxDate: '2026-06-18T00:00:00',
    itemNumber: '300221',
    itemDescription: 'Panadol Extra 24 tab',
    unitPrice: 4.275,
    qty: 2,
    amount: 8.55,
    currency: 'BHD',
  },
]

/** A filler sales window of exactly `n` lines, for the 500-line at-cap caption. */
const salesRows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    ...SALES_ROWS[0],
    trxNumber: `R-${700000 + i}`,
  }))

// `LoyMemberActionModel` rows as the report hands them over (223 §4). 🚩 The stub
// carries the member snapshot the wire really does denormalise onto every row —
// `mobile`, `fullName`, `email`, `cityName`, `blockedReason`, `joinedDate` — so
// that "no member-snapshot field reaches a column" is asserted against a payload
// that actually contains one, and not against a stub that quietly agrees.
// 🚩 `blockedReason` here is the joined DESCRIPTION, unlike the member payload's
// code under the same name: the trap the model layer names apart.
const actionRow = (n) => ({
  actionNo: String(n),
  loyId: LOYID_KEY,
  mainActionType: 'MUPD',
  mainActionDescription: 'Member update',
  subActionType: 'CHMB',
  subActionDescription: 'Change mobile',
  actionDateTime: '2026-07-30T11:04:00',
  actionData: '0555000111 → 0555000222',
  actionData2: 'web',
  userId: 'msartawi',
  branchId: '1001',
  staffId: '4417',
  mobile: '966555000111',
  fullName: 'Nouf Al-Harbi',
  email: 'nouf.h@example.com',
  gender: 'F',
  cityName: 'Riyadh',
  profileUpdated: true,
  insuranceCompany: 'Bupa',
  blockedReason: 'Mobile moved to another account',
  joinedDate: '2021-03-14T00:00:00',
})

// 🚩 The first row of page one carries NEITHER description — both joins are LEFT
// JOINs and go null on a code that is in the data but not in its type table. It
// must render `SNUP` / `USTP`, never two empty cells.
const unresolvedRow = {
  ...actionRow(4471),
  mainActionType: 'SNUP',
  mainActionDescription: null,
  subActionType: 'USTP',
  subActionDescription: null,
}

/** One page of `n` rows out of a `total`-row audit trail. */
const actionsPage = (rows, page, total) => ({
  records: rows,
  currentPage: page,
  pageSize: 25,
  pageRecordsCount: rows.length,
  totalPages: Math.max(1, Math.ceil(total / 25)),
  recordsCount: total,
})

// Scenario state, mutated between steps, and the call log the "one call" /
// "two calls" assertions read.
//
// `access` is ticket 234's axis: `granted` | `denied` | `throws`. The last one is
// the case the whole ticket exists for — a probe that errors must be
// indistinguishable from a refusal, never "probably fine".
// `memberOver` is ticket 235's axis: the fields the header derives its chips and
// its points block from, overridden per scenario so one stubbed member can be an
// ordinary one, an archived one, a blocked one or all of them at once.
// `activities` is ticket 236's axis: the rows the report answers with, or the
// string `throws` for the raw-500-with-no-envelope that a timed-out report
// actually produces (`ExecuteAsync` rethrows anything that is not a
// `DomainException`) — the failure the tab's Retry exists for.
// `sales` is ticket 237's axis, and it carries the same `throws` case — on this
// tab it is not a hypothetical: a 500-line scan of `RetailTrxDetail` timing out
// on a heavy member is the failure the scoped Retry was argued for.
// `actions` is ticket 238's axis, and it is a TOTAL rather than a row set: this
// is the one read that pages, so the stub serves the slice the client asked for
// out of a trail of that size — which is the only way "312 actions, 25 a page"
// can be driven rather than asserted.
let scenario = {
  doorShut: false,
  access: 'granted',
  memberOver: {},
  activities: ACTIVITY_ROWS,
  sales: SALES_ROWS,
  actions: { total: 312 },
}
// The member reads only. The probe is logged apart so the "one call" / "two
// calls" cascade assertions keep meaning what they said before the gate existed,
// and the report calls are logged apart again so "a tab fetches only when it is
// opened" is counted and not inferred.
let calls = []
let accessCalls = 0
let activityCalls = []
let salesCalls = []
// 🚩 The actions log keeps the whole QUERY, not just the key: the constraint this
// tab exists under is that `loyId` is on every call including page 2, and a log
// of keys could not tell the difference between that and the estate-wide read.
let actionCalls = []

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    // A stubbed 400/403 is the SUBJECT of half this drive; Chromium logs every
    // non-2xx response as a console error, so those are filtered out and only a
    // real script failure counts.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )

    // The area's ONE probe (234). Not grant-gated server-side — it must be able
    // to answer a session that holds nothing — so a denial is a 200 saying no,
    // while `throws` is the transport falling over on the way.
    if (path === 'LoyWeb/Access') {
      accessCalls += 1
      if (scenario.access === 'throws') return route.fulfill({ status: 500, body: 'boom' })
      // 🚩 A BARE 403 — no envelope, no code: what a portal call to a route
      // missing `.AllowCookieSession()`, or refused by the grant filter, comes
      // back as (224). A refusal, not an outage.
      if (scenario.access === 'refused') return route.fulfill({ status: 403, body: 'Forbidden' })
      return route.fulfill(envelope({ canOpenLoyMember: scenario.access === 'granted' }))
    }

    if (path.startsWith('LoyWeb/MemberByMobile/')) {
      const key = decodeURIComponent(path.split('LoyWeb/MemberByMobile/')[1] || '')
      calls.push(`byMobile:${key}`)
      // 🚩 An ungranted portal call gets a BARE 403 — no envelope, no code (224).
      // This is the case the whole cascade rule exists for.
      if (scenario.doorShut) return route.fulfill({ status: 403, body: 'Forbidden' })
      if (key === MOBILE_KEY) return route.fulfill(envelope({ ...MEMBER, ...scenario.memberOver }))
      return route.fulfill(notFound(`Customer with ${key} doesn't exists`))
    }
    // The Activities tab's read (236). 🚩 No existence check server-side — a
    // member with no history and a member who does not exist both answer
    // `200 []`, which is why the tab's empty state is a fact and not a refusal.
    if (path.startsWith('LoyWeb/Reports/LastActivities/')) {
      const key = decodeURIComponent(path.split('LoyWeb/Reports/LastActivities/')[1] || '')
      activityCalls.push(key)
      // 🚩 A RAW 500 with no envelope — what a report that timed out on a heavy
      // member actually returns, and the case the scoped Retry is for.
      if (scenario.activities === 'throws') return route.fulfill({ status: 500, body: 'boom' })
      return route.fulfill(envelope(scenario.activities))
    }
    // The Sales tab's read (237). Same raw SQL with no existence check, and the
    // same raw-500-with-no-envelope failure — except here that failure is the
    // LIKELY one, because this is the query that scans 500 lines.
    if (path.startsWith('LoyWeb/Reports/LoyaltySales/')) {
      const key = decodeURIComponent(path.split('LoyWeb/Reports/LoyaltySales/')[1] || '')
      salesCalls.push(key)
      if (scenario.sales === 'throws') return route.fulfill({ status: 500, body: 'boom' })
      return route.fulfill(envelope(scenario.sales))
    }

    // The Actions tab's read (238) — the only PAGED one, and the only one with a
    // real `recordsCount`. 🚩 Called without a `LoyId` the real report answers
    // the first 25 actions of the whole estate; the stub logs the query verbatim
    // so the drive can see that the client never makes that call.
    if (path === 'LoyWeb/Reports/LoyMemberActions') {
      const query = new URL(url).searchParams
      actionCalls.push({
        loyId: query.get('loyId'),
        page: query.get('page'),
        pageSize: query.get('pageSize'),
      })
      if (scenario.actions === 'throws') return route.fulfill({ status: 500, body: 'boom' })
      // `second` is the OTHER member's trail size, so one scenario can hold two
      // members of very different volumes — which is what makes "page 3 of A
      // must not survive into B" drivable at all.
      const total =
        query.get('loyId') === LOYID_KEY_2 && scenario.actions.second !== undefined
          ? scenario.actions.second
          : scenario.actions.total
      const page = Number(query.get('page') || 1)
      const first = (page - 1) * 25
      // `blankPage` is the stranding case: a page inside a real total that comes
      // back with no rows. Contrived, but it is the one state where hiding the
      // footer would leave an agent with nothing to read and no way back.
      const length = scenario.actions.blankPage === page ? 0 : Math.max(0, Math.min(25, total - first))
      const rows = Array.from({ length }, (_, i) =>
        // Row one of page one is the unresolved-code row; the rest resolve.
        first + i === 0 ? unresolvedRow : actionRow(5000 - (first + i)),
      )
      return route.fulfill(envelope(actionsPage(rows, page, total)))
    }

    if (path.startsWith('LoyWeb/Member/')) {
      const key = decodeURIComponent(path.split('LoyWeb/Member/')[1] || '')
      calls.push(`byLoyId:${key}`)
      if (scenario.doorShut) return route.fulfill({ status: 403, body: 'Forbidden' })
      if (key === LOYID_KEY) return route.fulfill(envelope({ ...MEMBER, ...scenario.memberOver }))
      if (key === LOYID_KEY_2) return route.fulfill(envelope(MEMBER_2))
      return route.fulfill(notFound(`Customer ${key} doesn't exists`))
    }

    // Any other probe → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const field = page.getByLabel('Look up a loyalty member', { exact: true })
  const lookUp = page.getByRole('button', { name: /^Look up$/ })

  // Fill the box and wait for the CONTROLLED value to settle before submitting.
  // Playwright's `fill` returns as soon as the DOM input is set, which on a field
  // that React has just re-mounted (after a navigation) can land before the
  // component's own state does — and React then writes its state back over the
  // typed text. Every assertion about what was searched depends on the box
  // holding what the drive typed, so the wait is part of typing here.
  const type = async (text) => {
    await field.fill(text)
    await page.waitForFunction(
      ([id, want]) => document.getElementById(id)?.value === want,
      [FIELD_ID, text],
      { timeout: 5000 },
    )
  }

  // ---- Scenario 1: the field is the page ---------------------------------
  await page.goto(BASE + '/loy/members')
  await lookUp.waitFor({ timeout: 15000 })
  check('the empty state is one field, opening blank', (await field.inputValue()) === '')
  check(
    'no identity bar and no member before a lookup',
    (await page.getByText('Searched', { exact: true }).count()) === 0 &&
      (await page.getByText('Nouf Al-Harbi').count()) === 0,
  )
  check(
    'the hint says what the field TAKES',
    /either one resolves the member/.test(await page.textContent('body')),
  )
  check(
    '🚩 the copy never publishes the internal ordering (story 3)',
    !/mobile first/i.test(await page.textContent('body')),
  )
  check(
    'nothing to cancel on the empty state — that IS the state',
    (await page.getByRole('button', { name: /^Cancel$/ }).count()) === 0,
  )

  // ---- Scenario 2: a blank submit is silent ------------------------------
  calls = []
  await lookUp.click()
  await page.waitForTimeout(300)
  check('a blank submit makes NO call', calls.length === 0, calls.join(', '))
  check(
    'a blank submit says nothing at all',
    !/No member matches/.test(await page.textContent('body')) &&
      (await page.getByRole('alert').count()) === 0,
  )

  // ---- Scenario 3: a mobile resolves in ONE call -------------------------
  calls = []
  await type('+966 55 500 0111')
  await lookUp.click()
  await page.waitForURL(/\/loy\/members\/100001293$/, { timeout: 10000 })
  check(
    '🚩 a mobile hit takes ONE call, on the compacted key',
    calls.length === 1 && calls[0] === 'byMobile:966555000111',
    calls.join(', '),
  )
  check('a resolved member lives at /loy/members/:loyId', /100001293$/.test(page.url()), page.url())

  await page.getByText('Nouf Al-Harbi').waitFor({ timeout: 10000 })
  const body = await page.textContent('body')
  check('the bar carries the searched key AS TYPED', /Searched/.test(body) && /\+966 55 500 0111/.test(body))
  check('the member owns the screen: the name is the header', /Nouf Al-Harbi/.test(body))
  check(
    'the identity line reads Loy ID · Mobile · Joined · Updated',
    /100001293/.test(body) &&
      /966555000111/.test(body) &&
      /14 Mar 2021/.test(body) &&
      /31 Jul 2026/.test(body),
  )
  check(
    'the seeded cache means no loading flash — the resolve never re-reads BY MOBILE',
    !calls.slice(1).some((c) => c.startsWith('byMobile:')),
    calls.join(', '),
  )
  check('the name appears exactly once (the bar carries the key, not the member)',
    (body.match(/Nouf Al-Harbi/g) || []).length === 1)

  // ---- Scenario 4: Change reopens the field pre-filled -------------------
  await page.getByRole('button', { name: /^Change$/ }).click()
  await field.waitFor({ timeout: 5000 })
  check('Change reopens the field PRE-FILLED with what was typed',
    (await field.inputValue()) === '+966 55 500 0111')
  check('the member stays on screen while the field is open',
    /Nouf Al-Harbi/.test(await page.textContent('body')))

  // Change is reversible — Cancel puts the bar back, unchanged.
  await page.getByRole('button', { name: /^Cancel$/ }).click()
  await page.getByRole('button', { name: /^Change$/ }).waitFor({ timeout: 5000 })
  check('Cancel returns to the bar with the searched key intact',
    /Searched/.test(await page.textContent('body')))
  await page.getByRole('button', { name: /^Change$/ }).click()
  await field.waitFor({ timeout: 5000 })

  // ---- Scenario 5: a Loy ID cascades, invisibly --------------------------
  calls = []
  await type('100001293')
  await lookUp.click()
  await page.waitForTimeout(600)
  check(
    '🚩 a Loy ID misses the mobile and resolves on the retry — TWO calls',
    calls.join(', ') === 'byMobile:100001293, byLoyId:100001293',
    calls.join(', '),
  )
  check('the cascade is invisible: the member simply resolves',
    /Nouf Al-Harbi/.test(await page.textContent('body')))
  check('the bar now carries the Loy ID that was typed',
    /Searched/.test(await page.textContent('body')))

  // ---- Scenario 6: New lookup returns to the empty field -----------------
  await page.getByRole('button', { name: /^New lookup$/ }).click()
  await page.waitForURL(/\/loy\/members$/, { timeout: 5000 })
  check('New lookup returns to the empty field', (await field.inputValue()) === '')
  check('and the member is gone with it',
    !/Nouf Al-Harbi/.test(await page.textContent('body')))

  // ---- Scenario 7: a double miss is a neutral sentence -------------------
  calls = []
  await type('0555000999')
  await lookUp.click()
  await page.waitForTimeout(600)
  const missBody = await page.textContent('body')
  check(
    'a double miss is TWO calls and then a client sentence',
    calls.join(', ') === 'byMobile:0555000999, byLoyId:0555000999',
    calls.join(', '),
  )
  check('the sentence names what was searched', /No member matches 0555000999/.test(missBody))
  check(
    '🚩 no toast and no error banner — a not-found is a fact, not a failure',
    (await page.getByRole('alert').count()) === 0,
  )
  check('🚩 the box is never rewritten', (await field.inputValue()) === '0555000999')
  check('a miss does not navigate', /\/loy\/members$/.test(page.url()), page.url())

  // ---- Scenario 7b: the last five members you FOUND (239) -----------------
  // Two hits so far — '+966 55 500 0111' (scenario 3) and '100001293'
  // (scenario 5) — and one miss, '0555000999', immediately above.
  const chipNames = async () =>
    (await page.locator('ul[aria-label="Recent searches"] button').allTextContents()).map((s) =>
      s.trim(),
    )
  check(
    'the two searches that FOUND someone are chips, newest first',
    JSON.stringify(await chipNames()) === JSON.stringify(['100001293', '+966 55 500 0111']),
    JSON.stringify(await chipNames()),
  )
  check(
    '🚩 the miss left NO chip — the bar is people you looked at, not numbers you mistyped',
    !(await chipNames()).includes('0555000999'),
    JSON.stringify(await chipNames()),
  )

  // 🚩 sessionStorage, not component state: a reload must keep them. (That it is
  // not localStorage is asserted below, where it can be seen rather than assumed.)
  await page.reload()
  await field.waitFor({ timeout: 10000 })
  check(
    '🚩 a reload keeps the bar — the chips are in sessionStorage, not in a component',
    JSON.stringify(await chipNames()) === JSON.stringify(['100001293', '+966 55 500 0111']),
    JSON.stringify(await chipNames()),
  )
  check(
    '🚩 and NOT in localStorage — a loyalty key must not outlive the tab on a shared workstation',
    (await page.evaluate(() =>
      Object.keys(window.localStorage).some((k) => k.toLowerCase().includes('recent')),
    )) === false,
  )

  calls = []
  await page.locator('ul[aria-label="Recent searches"] button', { hasText: '100001293' }).click()
  await page.waitForURL(/\/loy\/members\/100001293$/, { timeout: 10000 })
  check(
    '🚩 a chip runs the ORDINARY search — the same cascade, not a shortcut to the LoyId route',
    calls.join(', ') === 'byMobile:100001293, byLoyId:100001293',
    calls.join(', '),
  )
  await page.getByText('Nouf Al-Harbi').waitFor({ timeout: 10000 })
  check('and the member resolves from it', /Nouf Al-Harbi/.test(await page.textContent('body')))

  await page.getByRole('button', { name: /^New lookup$/ }).click()
  await page.waitForURL(/\/loy\/members$/, { timeout: 5000 })
  await page.locator('ul[aria-label="Recent searches"]').waitFor({ timeout: 10000 })
  check(
    'searching a key again moves it to the front instead of growing a second chip',
    JSON.stringify(await chipNames()) === JSON.stringify(['100001293', '+966 55 500 0111']),
    JSON.stringify(await chipNames()),
  )

  // ---- Scenario 8: 🚩 a shut door says THAT ------------------------------
  scenario.doorShut = true
  calls = []
  await type('0555000111')
  await lookUp.click()
  await page.waitForTimeout(600)
  const shutBody = await page.textContent('body')
  check(
    '🚩 a bare 403 does NOT cascade — one call, not two',
    calls.join(', ') === 'byMobile:0555000111',
    calls.join(', '),
  )
  check('🚩 a shut door NEVER reads as "no member matches"',
    !/No member matches 0555000111/.test(shutBody))
  check('the refusal shows itself as an error', (await page.getByRole('alert').count()) >= 1)
  check('the refusal names the status it got', /403/.test(shutBody), shutBody.slice(0, 200))
  scenario.doorShut = false

  // ---- Scenario 9: a cold load of the member URL ------------------------
  calls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('Nouf Al-Harbi').waitFor({ timeout: 10000 })
  const coldBody = await page.textContent('body')
  check(
    '🚩 a cold load re-reads BY KEY and does not replay the cascade',
    calls.join(', ') === 'byLoyId:100001293',
    calls.join(', '),
  )
  check('the bar falls back to the LoyId with no navigation state',
    /Searched/.test(coldBody) && /100001293/.test(coldBody))

  // ---- Scenario 10: granted — the nav offers the screen (234) -------------
  // Every OTHER leaf's probe answers `{}` from the catch-all above, so a
  // fail-closed shell leaves exactly one group standing: this one.
  // Counted from this load onwards: every earlier `goto` legitimately re-probed,
  // and what is being asserted is one call per PAGE LIFE shared by two consumers.
  accessCalls = 0
  await page.goto(BASE + '/')
  // Scoped to the sidebar: the home page lists the same destinations as cards, and
  // what this ticket gates is the NAV.
  const sidebar = page.locator('#layout-sidebar')
  const loyaltyGroup = sidebar.getByRole('button', { name: /^Loyalty$/ })
  await loyaltyGroup.waitFor({ timeout: 15000 })
  check('granted: the Loyalty group appears in the nav', (await loyaltyGroup.count()) === 1)
  await loyaltyGroup.click()
  const memberLeaf = sidebar.getByRole('link', { name: /Member lookup/ })
  await memberLeaf.waitFor({ timeout: 5000 })
  await memberLeaf.click()
  await page.waitForURL(/\/loy\/members$/, { timeout: 10000 })
  await lookUp.waitFor({ timeout: 10000 })
  check('the item routes to the lookup screen', /\/loy\/members$/.test(page.url()), page.url())
  check(
    'the nav and the screen share ONE probe call, not one each',
    accessCalls === 1,
    `accessCalls=${accessCalls}`,
  )

  // ---- Scenario 11: 🚩 denied — hidden AND backstopped --------------------
  scenario.access = 'denied'
  calls = []
  await page.goto(BASE + '/loy/members')
  await page.getByRole('alert').first().waitFor({ timeout: 15000 })
  const deniedBody = await page.textContent('body')
  check(
    '🚩 denied: a typed deep link lands on the DENIED BACKSTOP, not the field',
    /No access to Loyalty/.test(deniedBody) &&
      (await page.getByLabel('Look up a loyalty member', { exact: true }).count()) === 0,
  )
  check('the backstop names the grant, not a failure', /administrator/.test(deniedBody))
  check(
    '🚩 denied: the Loyalty group is absent from the nav',
    (await sidebar.getByRole('button', { name: /^Loyalty$/ }).count()) === 0,
  )
  check(
    '🚩 an ungranted deep link never fires the member read',
    calls.length === 0,
    calls.join(', '),
  )

  // ---- Scenario 12: 🚩 a probe that THROWS is a denial --------------------
  scenario.access = 'throws'
  calls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByRole('alert').first().waitFor({ timeout: 15000 })
  const thrownBody = await page.textContent('body')
  check(
    '🚩 a thrown probe FAILS CLOSED — the screen is denied, not opened',
    (await page.getByLabel('Look up a loyalty member', { exact: true }).count()) === 0 &&
      !/Nouf Al-Harbi/.test(thrownBody),
  )
  check(
    'and says the access could not be checked rather than claiming a refusal',
    /unavailable|could not be checked|500/.test(thrownBody),
  )
  check(
    '🚩 the Loyalty group is absent for a thrown probe too',
    (await sidebar.getByRole('button', { name: /^Loyalty$/ }).count()) === 0,
  )
  check(
    '🚩 a thrown probe never fires the member read either',
    calls.length === 0,
    calls.join(', '),
  )
  // ---- Scenario 13: 🚩 a bare 403 reads as a REFUSAL, not an outage --------
  scenario.access = 'refused'
  calls = []
  await page.goto(BASE + '/loy/members')
  await page.getByRole('alert').first().waitFor({ timeout: 15000 })
  const refusedBody = await page.textContent('body')
  check(
    '🚩 a bare 403 denies with the ADMINISTRATOR sentence, not "try again in a moment"',
    /No access to Loyalty/.test(refusedBody) && !/Try again in a moment/.test(refusedBody),
  )
  check(
    'a 403 hides the group and never fires the member read either',
    (await sidebar.getByRole('button', { name: /^Loyalty$/ }).count()) === 0 && calls.length === 0,
    calls.join(', '),
  )
  scenario.access = 'granted'

  // ---- Ticket 235: the member header ------------------------------------
  // A fresh `goto` per variant, deliberately: the member lives in one TanStack
  // cache entry keyed by LoyId, so a reload is how the stub's next variant is
  // actually read rather than served from the last one.
  const showMember = async (over) => {
    scenario.memberOver = over
    await page.goto(BASE + '/loy/members/100001293')
    await page.getByText('Nouf Al-Harbi').waitFor({ timeout: 10000 })
    return page.textContent('body')
  }
  const statusChips = /Archived|Non-loyalty|Family|Blocked/

  // ---- Scenario 14: an ordinary member wears ONE chip ---------------------
  const ordinary = await showMember({})
  check('the tier chip decodes G to its word', /Gold/.test(ordinary))
  check(
    '🚩 an ordinary member shows NO status chip — silence is the Active state',
    !statusChips.test(ordinary),
  )
  check(
    'the points block states the balance, its SAR equivalent and the three label-size figures',
    /12,480/.test(ordinary) &&
      /561\.00 SAR/.test(ordinary) &&
      /320/.test(ordinary) &&
      /1,200/.test(ordinary) &&
      /8,940/.test(ordinary) &&
      /within 30 days/.test(ordinary),
  )
  check(
    '🚩 engine machinery is drawn nowhere',
    // 🚩 The machinery is named by its LABELS, not by the bare words: since 236
    // the Activities tab below the header renders the server's own English for an
    // activity type, and "Redemption" is a thing that HAPPENED to the member. The
    // factors are what must never appear, and a factor always arrives labelled.
    !/W\|D|Accrual factor|Redemption factor|Exchange rate|expire soon days/i.test(ordinary),
  )

  // ---- Scenario 15: the disclosure starts shut ---------------------------
  check(
    '🚩 the disclosure starts SHUT — a screen opened forty times a day is not forty screens of PII',
    !/nouf\.h@example\.com/.test(ordinary) && !/National ID/.test(ordinary),
  )
  const disclose = page.getByRole('button', { name: /More member details/ })
  check('and it offers itself', (await disclose.count()) === 1)
  await disclose.click()
  await page.getByText('nouf.h@example.com').waitFor({ timeout: 5000 })
  const opened = await page.textContent('body')
  check(
    'opening it shows the long tail — email, birth date, national ID, insurance company',
    /nouf\.h@example\.com/.test(opened) &&
      /08 Nov 1990/.test(opened) &&
      /1098443217/.test(opened) &&
      /Insurance company/.test(opened),
  )
  check(
    '🚩 a passed-through code is labelled AS a code, never as a name',
    // The label may not promise a name the screen does not have: "City code"
    // over `RUH`, never "City" (229 clause 5).
    /Gender code/.test(opened) && /Nationality code/.test(opened) && /City code/.test(opened),
  )
  await page.getByRole('button', { name: /Hide member details/ }).click()
  await page.waitForTimeout(200)
  check('and it shuts again', !/nouf\.h@example\.com/.test(await page.textContent('body')))

  // ---- Scenario 16: blocked, archived, and both --------------------------
  const blocked = await showMember({ blockedReason: 'CM' })
  check(
    'a blocked member says so IN WORDS, decoded from CM',
    /Blocked · Mobile moved to another account/.test(blocked),
  )
  check('and keeps its tier chip beside it', /Gold/.test(blocked))

  const archived = await showMember({ memberType: 'A' })
  check('an archived member carries the type chip', /Archived/.test(archived))
  check('🚩 and no blocked chip — the two facts are independent', !/Blocked/.test(archived))

  const both = await showMember({ memberType: 'A', blockedReason: 'IA' })
  check(
    '🚩 archived AND blocked shows THREE chips — neither fact hides behind the other',
    /Gold/.test(both) && /Archived/.test(both) && /Blocked · Inactive/.test(both),
  )

  const family = await showMember({ memberType: 'F' })
  check('a family member carries its own type chip', /Family/.test(family))

  // ---- Scenario 17: 🚩 an unknown code renders BARE -----------------------
  const unknown = await showMember({ tier: 'X', blockedReason: 'XZ' })
  check(
    '🚩 an unknown tier renders as its bare code, never as a raw translation key',
    (await page.getByText('X', { exact: true }).count()) === 1 &&
      !/loy:tier|tier\.gold/.test(unknown),
  )
  check(
    '🚩 an unseeded blocked reason degrades to the code too',
    /Blocked · XZ/.test(unknown) && !/blockedReason\./.test(unknown),
  )

  // ---- Scenario 18: expiring is tinted only when non-zero ----------------
  const expiringValue = page.locator('xpath=//span[text()="Expiring"]/following-sibling::span[1]')
  const pendingValue = page.locator('xpath=//span[text()="Pending"]/following-sibling::span[1]')
  const inkOf = (loc) => loc.evaluate((el) => getComputedStyle(el).color)

  await showMember({})
  const tintedExpiring = await inkOf(expiringValue)
  const neutralPending = await inkOf(pendingValue)
  check(
    '1,200 points expiring is tinted — it is the one figure that carries a colour',
    tintedExpiring !== neutralPending,
    `${tintedExpiring} vs ${neutralPending}`,
  )

  await showMember({ pointsExpireSoon: 0 })
  const quietExpiring = await inkOf(expiringValue)
  check(
    '🚩 nothing expiring is QUIET — the tint would stop meaning anything otherwise',
    quietExpiring === (await inkOf(pendingValue)),
    `${quietExpiring} vs ${neutralPending}`,
  )

  // ---- Scenario 19: 🚩 the 0001-01-01 birth date is not a fact ------------
  await showMember({ birthDate: '0001-01-01T00:00:00' })
  await page.getByRole('button', { name: /More member details/ }).click()
  // Read the field's OWN value, not the page text: the LoyId `100001293` happens
  // to contain `0001`, so a body-wide regex would be asserting nothing.
  const birthValue = page.locator('xpath=//dt[text()="Birth date"]/following-sibling::dd[1]')
  await birthValue.waitFor({ timeout: 5000 })
  check(
    '🚩 an unset birth date renders as absent, never as 0001-01-01',
    (await birthValue.textContent()) === '—',
    await birthValue.textContent(),
  )
  scenario.memberOver = {}

  // ---- Ticket 236: the tab shell and the Activities tab -------------------
  const tab = (name) => page.getByRole('tab', { name })
  const cell = (rowIndex, colId) =>
    page.locator(`.ag-row[row-index="${rowIndex}"] .ag-cell[col-id="${colId}"]`).first()
  const cellText = async (rowIndex, colId) => (await cell(rowIndex, colId).textContent()).trim()

  // ---- Scenario 20: Activities is the landing tab, and it fetches ---------
  activityCalls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('Purchase accrual').first().waitFor({ timeout: 10000 })
  check(
    'Activities is the tab an agent lands on, and it fetches ON LANDING — one call',
    activityCalls.join(', ') === '100001293',
    activityCalls.join(', '),
  )
  // Four since ticket 302 put Profile at the front of the strip — the three
  // report peers plus the member itself.
  check('the strip offers all three report peers, behind Profile', (await page.getByRole('tab').count()) === 4)
  check(
    'Activities is the selected tab with no ?tab= at all',
    (await tab(/^Activities$/).getAttribute('aria-selected')) === 'true',
  )
  const landed = await page.textContent('body')
  check('🚩 the caption names the ceiling', /Most recent 100 activities\./.test(landed))
  check(
    '🚩 below the cap it stays quiet — three rows warn about nothing',
    !/There may be older activity not shown/.test(landed),
  )
  check(
    '🚩 a bare row count is shown NOWHERE — a count reads as completeness',
    !/\b3 activities\b/.test(landed) && !/showing 3\b/i.test(landed),
  )
  check(
    '🚩 the member header and the bar are untouched by the tab below them',
    /Nouf Al-Harbi/.test(landed) && /Searched/.test(landed),
  )

  // ---- Scenario 21: 🚩 a tab fetches only when it is OPENED ---------------
  activityCalls = []
  await page.goto(BASE + '/loy/members/100001293?tab=sales')
  await page.getByText('Vitamin D3 1000IU').first().waitFor({ timeout: 10000 })
  check(
    '🚩 a cold load on another tab makes NO activities call at all',
    activityCalls.length === 0,
    activityCalls.join(', '),
  )
  check(
    'the named tab is the selected one',
    (await tab(/^Sales$/).getAttribute('aria-selected')) === 'true',
  )
  check(
    'and the member above it resolved anyway — only the TAB is lazy',
    /Nouf Al-Harbi/.test(await page.textContent('body')),
  )
  await tab(/^Activities$/).click()
  await page.getByText('Purchase accrual').first().waitFor({ timeout: 10000 })
  check(
    '🚩 opening the tab is what fetches it — exactly one call, then',
    activityCalls.join(', ') === '100001293',
    activityCalls.join(', '),
  )
  check('the URL follows the open tab', /\?tab=activities$/.test(page.url()), page.url())
  // Back to Sales and forward again: the window is already held, so it is not
  // re-read. A read-only screen has nothing to be stale about.
  await tab(/^Sales$/).click()
  await tab(/^Activities$/).click()
  await page.getByText('Purchase accrual').first().waitFor({ timeout: 5000 })
  check(
    'a tab already read is not re-read on the way back — cached per member',
    activityCalls.length === 1,
    activityCalls.join(', '),
  )

  // ---- Scenario 22: ?tab= survives a reload, junk falls back --------------
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('312 actions.').waitFor({ timeout: 10000 })
  await page.reload()
  await page.getByText('312 actions.').waitFor({ timeout: 10000 })
  check(
    '🚩 ?tab= survives a reload — a link lands where it meant to',
    (await tab(/^Actions$/).getAttribute('aria-selected')) === 'true',
  )
  activityCalls = []
  await page.goto(BASE + '/loy/members/100001293?tab=purchases')
  await page.getByText('Purchase accrual').first().waitFor({ timeout: 10000 })
  check(
    '🚩 an unknown ?tab= falls back to Activities rather than erroring',
    (await tab(/^Activities$/).getAttribute('aria-selected')) === 'true',
  )

  // ---- Scenario 23: the six columns, and what the Points column may say ---
  const rowsBody = await page.textContent('body')
  check(
    'the six columns are the six 226 settled',
    /Date/.test(rowsBody) &&
      /Activity/.test(rowsBody) &&
      /Points/.test(rowsBody) &&
      /Status/.test(rowsBody) &&
      /Expires/.test(rowsBody) &&
      /Reference/.test(rowsBody),
  )
  check(
    '🚩 points arrive already signed and draw to exactly two decimals',
    /\+240\.25/.test(rowsBody) && /-450\.50/.test(rowsBody) && /\+500\.00/.test(rowsBody),
  )
  check(
    "🚩 Expires is blank on a debit — the server's own rule, points <= 0",
    (await cellText(1, 'expires')) === '',
    await cellText(1, 'expires'),
  )
  check(
    '🚩 and blank on a 0001-01-01 sentinel too',
    (await cellText(2, 'expires')) === '',
    await cellText(2, 'expires'),
  )
  check('a credit keeps its expiry date', (await cellText(0, 'expires')) !== '')
  check(
    'a closed status code decodes to its word',
    (await cellText(1, 'status')) === 'Pending',
    await cellText(1, 'status'),
  )
  check(
    '🚩 an unseeded status renders BARE, never as a raw translation key',
    (await cellText(2, 'status')) === 'Z' && !/activityStatus\./.test(rowsBody),
    await cellText(2, 'status'),
  )
  const inkAt = (loc) => loc.evaluate((el) => getComputedStyle(el).color)
  check(
    '🚩 the sign is NEVER coloured — the Activity column already names the direction',
    (await inkAt(cell(0, 'points'))) === (await inkAt(cell(1, 'points'))),
    `${await inkAt(cell(0, 'points'))} vs ${await inkAt(cell(1, 'points'))}`,
  )
  check(
    '🚩 no total row anywhere — a sum of server-rounded rows would not equal the balance',
    (await page.locator('.ag-floating-bottom .ag-row').count()) === 0,
  )
  // 🚩 Sort is ON here, unlike the Nphies lists: the entire window is already in
  // the browser and the caption says which window it is, so sorting reorders the
  // RESULT and not a page. Driven rather than asserted from a colDef.
  await page.locator('.ag-header-cell[col-id="points"]').click()
  await page.waitForTimeout(200)
  check(
    'the whole window is held, so the Points column really sorts',
    (await cellText(0, 'points')) === '-450.50',
    await cellText(0, 'points'),
  )

  // ---- Scenario 24: 🚩 at exactly the cap, the warning fires --------------
  scenario.activities = activityRows(40)
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('Most recent 100 activities.').waitFor({ timeout: 10000 })
  const below = await page.textContent('body')
  check(
    'a 40-row member states the ceiling and nothing more',
    /Most recent 100 activities\./.test(below) &&
      !/There may be older activity not shown/.test(below),
  )
  check('🚩 and its row count is nowhere on screen', !/\b40 activities\b/.test(below))

  scenario.activities = activityRows(100)
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('There may be older activity not shown.').waitFor({ timeout: 10000 })
  check(
    '🚩 a member at exactly the cap gets BOTH — silence would be the false negative that matters',
    /Most recent 100 activities\./.test(await page.textContent('body')),
  )

  // ---- Scenario 25: 🚩 a failed tab fails INSIDE the tab ------------------
  scenario.activities = 'throws'
  calls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByRole('button', { name: /^Retry$/ }).waitFor({ timeout: 15000 })
  const failedBody = await page.textContent('body')
  check(
    '🚩 the member header survives a failed tab — one slow report does not cost the member',
    /Nouf Al-Harbi/.test(failedBody) && /12,480/.test(failedBody),
  )
  check(
    'the other tabs are untouched and still reachable',
    (await page.getByRole('tab').count()) === 4,
  )
  check(
    'the failure names WHICH tab could not be read, and carries the server sentence too',
    // A raw 500 carries no envelope, so the server half is the generic sentence —
    // which is exactly why the tab's own title has to say what was absent.
    /could not be read/.test(failedBody) &&
      /unexpected error/i.test(failedBody) &&
      (await page.getByRole('alert').count()) >= 1,
  )
  check(
    '🚩 empty and failed are never conflated — the empty sentence is absent here',
    !/No loyalty activity for this member/.test(failedBody),
  )
  check(
    '🚩 no toast — the state is already fully visible in the tab being looked at',
    (await page.locator('[data-sonner-toast]').count()) === 0,
  )

  // The Retry refetches THAT TAB and nothing else.
  scenario.activities = ACTIVITY_ROWS
  activityCalls = []
  const memberCallsBeforeRetry = calls.length
  await page.getByRole('button', { name: /^Retry$/ }).click()
  await page.getByText('Purchase accrual').first().waitFor({ timeout: 10000 })
  check(
    'Retry refetches the tab — the likeliest failure is transient and often fine on a second attempt',
    activityCalls.length >= 1,
    activityCalls.join(', '),
  )
  check(
    '🚩 and ONLY that tab — the member is not re-read',
    calls.length === memberCallsBeforeRetry,
    `${calls.length} vs ${memberCallsBeforeRetry}`,
  )

  // ---- Scenario 26: an empty member speaks in its own words ---------------
  scenario.activities = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('No loyalty activity for this member.').waitFor({ timeout: 10000 })
  const emptyBody = await page.textContent('body')
  check(
    '🚩 an empty tab says what was ABSENT, in this tab\'s own words — never a shared "No data"',
    /No loyalty activity for this member\./.test(emptyBody) && !/No data/.test(emptyBody),
  )
  check(
    '🚩 an empty tab is not a failure — no banner, no Retry',
    (await page.getByRole('button', { name: /^Retry$/ }).count()) === 0 &&
      !/could not be read/.test(emptyBody),
  )
  check(
    'and the ceiling is still stated — the caption describes the query, not the answer',
    /Most recent 100 activities\./.test(emptyBody),
  )
  scenario.activities = ACTIVITY_ROWS

  // ---- Ticket 237: the Sales tab ------------------------------------------

  // ---- Scenario 27: Sales fetches on OPEN, and the SAR-only member ---------
  salesCalls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('Purchase accrual').first().waitFor({ timeout: 10000 })
  check(
    '🚩 landing on Activities makes NO sales call — the 500-line scan is not paid for unasked',
    salesCalls.length === 0,
    salesCalls.join(', '),
  )
  await tab(/^Sales$/).click()
  await page.getByText('Vitamin D3 1000IU').first().waitFor({ timeout: 10000 })
  check(
    'opening Sales is what fetches it — exactly one call',
    salesCalls.join(', ') === '100001293',
    salesCalls.join(', '),
  )
  const salesBody = await page.textContent('body')
  check(
    'the eight columns are the eight 226 settled',
    /Date/.test(salesBody) &&
      /Receipt/.test(salesBody) &&
      /Store code/.test(salesBody) &&
      /Item no\./.test(salesBody) &&
      /\bItem\b/.test(salesBody) &&
      /Qty/.test(salesBody) &&
      /Unit price/.test(salesBody) &&
      /Amount/.test(salesBody),
  )
  check(
    '🚩 the SAR-only member spends NO width on a Currency column',
    (await page.locator('.ag-header-cell[col-id="currency"]').count()) === 0,
  )
  check(
    '🚩 the channel columns 226 struck are drawn nowhere',
    !/Trx type/i.test(salesBody) && !/Doc type/i.test(salesBody),
  )
  check(
    '🚩 the caption names the ceiling and three lines warn about nothing',
    /Most recent 500 sales lines\./.test(salesBody) &&
      !/There may be older lines not shown/.test(salesBody),
  )
  check(
    '🚩 a bare row count is shown NOWHERE on a capped tab',
    !/\b3 sales\b/i.test(salesBody) && !/showing 3\b/i.test(salesBody),
  )
  check(
    '🚩 the date is DATE-ONLY — TrxTime is not selected, so a clock would be fabricated',
    (await cellText(0, 'trxDate')) === '30 Jul 2026' && !/\b00:00\b/.test(salesBody),
    await cellText(0, 'trxDate'),
  )
  check(
    'one basket is several lines sharing one receipt — the grain is not rolled up',
    (await cellText(0, 'trxNumber')) === 'R-88412' &&
      (await cellText(1, 'trxNumber')) === 'R-88412' &&
      (await cellText(0, 'itemNumber')) !== (await cellText(1, 'itemNumber')),
  )
  check(
    'Item is the headline — "what did they buy" is one column',
    (await cellText(1, 'item')) === 'Vitamin D3 1000IU',
    await cellText(1, 'item'),
  )
  check(
    '🚩 a return reads like the receipt: -1.00 · 12.00 · -12.00',
    (await cellText(2, 'qty')) === '-1.00' &&
      (await cellText(2, 'unitPrice')) === '12.00' &&
      (await cellText(2, 'amount')) === '-12.00',
    `${await cellText(2, 'qty')} · ${await cellText(2, 'unitPrice')} · ${await cellText(2, 'amount')}`,
  )
  check(
    '🚩 a sale volunteers no plus — only the return carries a sign',
    (await cellText(0, 'qty')) === '2.00' && (await cellText(0, 'amount')) === '24.00',
    `${await cellText(0, 'qty')} · ${await cellText(0, 'amount')}`,
  )
  check(
    '🚩 nothing is summed — the report selects no exchange rate, so no total row exists',
    (await page.locator('.ag-floating-bottom .ag-row').count()) === 0,
  )
  // Sort is on for the same reason as Activities: the whole window is held.
  await page.locator('.ag-header-cell[col-id="amount"]').click()
  await page.waitForTimeout(200)
  check(
    'the whole 500-line window is held, so Amount really sorts',
    (await cellText(0, 'amount')) === '-12.00',
    await cellText(0, 'amount'),
  )

  // ---- Scenario 28: 🚩 the Bahrain member, and three decimals -------------
  scenario.sales = MIXED_SALES_ROWS
  await page.goto(BASE + '/loy/members/100001293?tab=sales')
  await page.locator('.ag-header-cell[col-id="currency"]').waitFor({ timeout: 10000 })
  check(
    '🚩 more than one distinct currency in the window grows the Currency column',
    (await page.locator('.ag-header-cell[col-id="currency"]').count()) === 1,
  )
  check(
    'and it states the row currency rather than implying it',
    (await cellText(3, 'currency')) === 'BHD' && (await cellText(0, 'currency')) === 'SAR',
    `${await cellText(0, 'currency')} / ${await cellText(3, 'currency')}`,
  )
  check(
    '🚩 a BHD line draws THREE decimals — the dinar is not a riyal with another label',
    (await cellText(3, 'unitPrice')) === '4.275' && (await cellText(3, 'amount')) === '8.550',
    `${await cellText(3, 'unitPrice')} · ${await cellText(3, 'amount')}`,
  )
  check(
    '🚩 and the SAR lines beside it still draw two — money formats per ITS OWN row',
    (await cellText(0, 'unitPrice')) === '12.00' && (await cellText(1, 'amount')) === '45.50',
    `${await cellText(0, 'unitPrice')} · ${await cellText(1, 'amount')}`,
  )

  // ---- Scenario 29: 🚩 at exactly 500, the warning fires ------------------
  scenario.sales = salesRows(499)
  await page.goto(BASE + '/loy/members/100001293?tab=sales')
  await page.getByText('Most recent 500 sales lines.').waitFor({ timeout: 15000 })
  check(
    'a 499-line member states the ceiling and nothing more',
    !/There may be older lines not shown/.test(await page.textContent('body')),
  )
  scenario.sales = salesRows(500)
  await page.goto(BASE + '/loy/members/100001293?tab=sales')
  await page.getByText('There may be older lines not shown.').waitFor({ timeout: 15000 })
  check(
    '🚩 a member at exactly the cap gets BOTH — silence would be the false negative that matters',
    /Most recent 500 sales lines\./.test(await page.textContent('body')),
  )

  // ---- Scenario 30: the empty and the failed tab, in Sales' own words ------
  scenario.sales = []
  await page.goto(BASE + '/loy/members/100001293?tab=sales')
  await page.getByText('No sales lines for this member.').waitFor({ timeout: 10000 })
  const emptySales = await page.textContent('body')
  check(
    '🚩 an empty Sales tab says SALES were absent — never a shared "No data", never Activities\' sentence',
    !/No data/.test(emptySales) && !/No loyalty activity/.test(emptySales),
  )
  check(
    '🚩 an empty tab is not a failure — no banner, no Retry',
    (await page.getByRole('button', { name: /^Retry$/ }).count()) === 0 &&
      !/could not be read/.test(emptySales),
  )
  check(
    'and the ceiling is still stated — the caption describes the query, not the answer',
    /Most recent 500 sales lines\./.test(emptySales),
  )

  scenario.sales = 'throws'
  calls = []
  activityCalls = []
  await page.goto(BASE + '/loy/members/100001293?tab=sales')
  await page.getByRole('button', { name: /^Retry$/ }).waitFor({ timeout: 15000 })
  const failedSales = await page.textContent('body')
  check(
    '🚩 the timed-out report fails INSIDE its tab — the member header survives it',
    /Nouf Al-Harbi/.test(failedSales) && /12,480/.test(failedSales),
  )
  check(
    'the failure names WHICH read broke, and carries the server sentence too',
    /The sales lines could not be read\./.test(failedSales) &&
      /unexpected error/i.test(failedSales) &&
      (await page.getByRole('alert').count()) >= 1,
  )
  check(
    '🚩 empty and failed are never conflated — the empty sentence is absent here',
    !/No sales lines for this member/.test(failedSales),
  )
  check(
    '🚩 no toast — the state is already fully visible in the tab being looked at',
    (await page.locator('[data-sonner-toast]').count()) === 0,
  )
  check(
    'the other tabs are untouched and still reachable',
    (await page.getByRole('tab').count()) === 4,
  )

  // The Retry refetches THAT TAB and nothing else — the whole reason it is here.
  scenario.sales = SALES_ROWS
  salesCalls = []
  const memberCallsBeforeSalesRetry = calls.length
  await page.getByRole('button', { name: /^Retry$/ }).click()
  await page.getByText('Vitamin D3 1000IU').first().waitFor({ timeout: 10000 })
  check(
    'Retry refetches the tab — a SQL timeout on a heavy member is transient',
    salesCalls.length >= 1,
    salesCalls.join(', '),
  )
  check(
    '🚩 and ONLY that tab — neither the member nor Activities is re-read',
    calls.length === memberCallsBeforeSalesRetry && activityCalls.length === 0,
    `${calls.length} vs ${memberCallsBeforeSalesRetry}, activities ${activityCalls.length}`,
  )

  // ---- Ticket 238: the Actions tab ---------------------------------------

  // ---- Scenario 31: 🚩 the LoyId is on EVERY call, and the size is 25 ------
  scenario.sales = SALES_ROWS
  scenario.actions = { total: 312 }
  actionCalls = []
  await page.goto(BASE + '/loy/members/100001293')
  await page.getByText('Purchase accrual').first().waitFor({ timeout: 10000 })
  check(
    '🚩 landing on Activities makes NO actions call — the audit read is not paid for unasked',
    actionCalls.length === 0,
    JSON.stringify(actionCalls),
  )
  await tab(/^Actions$/).click()
  await page.getByText('312 actions.').waitFor({ timeout: 10000 })
  check(
    'opening Actions is what fetches it — exactly one call',
    actionCalls.length === 1,
    JSON.stringify(actionCalls),
  )
  check(
    '🚩 and it carries the LoyId — a bare call would answer the whole estate',
    actionCalls[0].loyId === LOYID_KEY,
    JSON.stringify(actionCalls[0]),
  )
  check(
    "🚩 it asks for 25 a page — the server's own default, not the pager's other caller's 50",
    actionCalls[0].pageSize === '25',
    JSON.stringify(actionCalls[0]),
  )

  // ---- Scenario 32: a real total, and Prev/Next 25 at a time --------------
  const actionsBody = await page.textContent('body')
  check(
    '🚩 the caption states the REAL total, with no ceiling and no hedging',
    /312 actions\./.test(actionsBody) &&
      !/Most recent/.test(actionsBody) &&
      !/there may be older/i.test(actionsBody),
  )
  check(
    'the seven columns are the seven 226 settled',
    /When/.test(actionsBody) &&
      /Action/.test(actionsBody) &&
      /Sub-action/.test(actionsBody) &&
      /Details/.test(actionsBody) &&
      /Details 2/.test(actionsBody) &&
      /\bBy\b/.test(actionsBody) &&
      /Branch code/.test(actionsBody),
  )
  // 🚩 Read from the grid's own `aria-rowcount` (rows + the header row), not by
  // counting DOM rows: AG Grid virtualizes, so a 25-row page only ever renders
  // the dozen that fit and a DOM count would be measuring the viewport height.
  const rowCount = async () =>
    Number(await page.locator('[aria-rowcount]').first().getAttribute('aria-rowcount')) - 1
  check('a page is 25 rows', (await rowCount()) === 25, String(await rowCount()))
  const previous = page.getByRole('button', { name: /^Previous$/ })
  const next = page.getByRole('button', { name: /^Next$/ })
  check('the pager reads Page 1 of 13 — 312 walked 25 at a time', /Page 1 of 13/.test(actionsBody))
  check('Previous is inert on page 1 — there is nowhere back to', await previous.isDisabled())
  check('🚩 Next is live, driven by the real total and not by a capped flag', await next.isEnabled())

  await next.click()
  await page.getByText('Page 2 of 13').waitFor({ timeout: 10000 })
  check(
    '🚩 page 2 carries the LoyId too — paging is where it would be dropped',
    actionCalls.length === 2 && actionCalls[1].loyId === LOYID_KEY && actionCalls[1].page === '2',
    JSON.stringify(actionCalls[1]),
  )
  check('page 2 is a full page too', (await rowCount()) === 25, String(await rowCount()))
  check('and Previous wakes up', await previous.isEnabled())

  // The last page: Next goes inert on arithmetic, not on a flag nobody sent.
  await page.getByRole('button', { name: /^Previous$/ }).click()
  await page.getByText('Page 1 of 13').waitFor({ timeout: 10000 })
  check('Previous walks back', /Page 1 of 13/.test(await page.textContent('body')))

  scenario.actions = { total: 30 }
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('30 actions.').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByText('Page 2 of 2').waitFor({ timeout: 10000 })
  check(
    '🚩 on the last page Next goes inert — arithmetic on a real total, not a guess',
    await page.getByRole('button', { name: /^Next$/ }).isDisabled(),
  )
  check('and the short last page is the remainder', (await rowCount()) === 5, String(await rowCount()))

  // ---- Scenario 33: 🚩 a one-page member grows no pager, and no sort -------
  scenario.actions = { total: 4 }
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('4 actions.').waitFor({ timeout: 10000 })
  check(
    '🚩 a 4-action member grows NO pager — the house rule, and most members',
    (await page.getByRole('button', { name: /^Next$/ }).count()) === 0 &&
      // Scoped to the tab panel: the shell's own sidebar is a `nav` too, and
      // what must be absent is the FOOTER.
      (await page.locator('#loy-tab-panel nav').count()) === 0,
  )
  check('and still states its real total', /4 actions\./.test(await page.textContent('body')))
  check(
    '🚩 the tab offers no sort — a sort over page 3 of N reorders a page, not a result',
    (await page.locator('.ag-header-cell.ag-header-cell-sortable').count()) === 0,
  )
  check(
    '🚩 and no filter, for the same reason',
    (await page.locator('.ag-header-cell-menu-button, .ag-floating-filter').count()) === 0,
  )

  // A trail of one. The caption is a sentence before it is a number, and the
  // en bundle carries both forms rather than the `1 actions.` a single
  // interpolation would print.
  scenario.actions = { total: 1 }
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('1 action.').waitFor({ timeout: 10000 })
  check(
    'a member with ONE action reads "1 action." — the caption is a sentence, not a template',
    !(await page.textContent('body')).includes('1 actions.'),
  )

  // ---- Scenario 33b: 🚩 an empty page keeps its way back -------------------
  scenario.actions = { total: 312, blankPage: 2 }
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('312 actions.').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByText('No actions on this page.').waitFor({ timeout: 10000 })
  check(
    '🚩 the empty sentence is about the PAGE, not the member — "no actions recorded for this member" under a caption reading "312 actions." contradicts the line above it',
    !(await page.textContent('body')).includes('No actions recorded for this member.'),
  )
  check(
    '🚩 a page that comes back empty inside a real total KEEPS its pager — no rows to read and no way back is the one stranding state',
    (await page.locator('#loy-tab-panel nav').count()) === 1 &&
      (await page.getByRole('button', { name: /^Previous$/ }).isEnabled()),
  )
  check(
    'and the way back works',
    (await (async () => {
      await page.getByRole('button', { name: /^Previous$/ }).click()
      await page.getByText('Page 1 of 13').waitFor({ timeout: 10000 })
      return page.textContent('body')
    })()).includes('Member update'),
  )

  // ---- Scenario 33c: 🚩 a page number does not follow the agent to another member ----
  // The stranding state 33b guards against by keeping the pager, reached the
  // other way: a page number that outlives the member it was a page OF. Only a
  // navigation that keeps `?tab=actions` across a `:loyId` change can do it —
  // Change drops the tab and lands on Activities, so the reachable path is the
  // browser's own Back between two members whose Actions tab was open. React
  // Router keeps the same element across a param change, so without a key on the
  // tab shell `ActionsTab`'s `useState(1)` simply carries over.
  scenario.actions = { total: 4, second: 312 }
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('4 actions.').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /^Change$/ }).click()
  await type(LOYID_KEY_2)
  await lookUp.click()
  await page.getByText('Faisal Al-Otaibi').waitFor({ timeout: 10000 })
  await page.getByRole('tab', { name: 'Actions' }).click()
  await page.getByText('312 actions.').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByText('Page 2 of 13').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /^Next$/ }).click()
  await page.getByText('Page 3 of 13').waitFor({ timeout: 10000 })

  actionCalls = []
  await page.goBack()
  await page.getByText('Nouf Al-Harbi').waitFor({ timeout: 10000 })
  await page.getByText('4 actions.').waitFor({ timeout: 10000 })
  check(
    '🚩 no page but the first is ever asked of him — page 3 belonged to the other member, and asking for it here is an empty page with no pager to leave by',
    // An empty log is the PASS this assertion wants most: page 1 of this member
    // is already in the cache from the top of the scenario, so a remounted tab
    // asks nothing at all. What must not appear is a read of any other page.
    actionCalls.every((c) => c.loyId === LOYID_KEY && c.page === '1'),
    JSON.stringify(actionCalls),
  )
  check(
    'and his four actions are on screen, not an empty tab',
    (await rowCount()) === 4 &&
      !(await page.textContent('body')).includes('No actions recorded for this member.'),
    String(await rowCount()),
  )

  scenario.actions = { total: 4 }
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('4 actions.').waitFor({ timeout: 10000 })

  // ---- Scenario 34: the row — a raw code, and no PII ----------------------
  const actionCell = async (rowIndex, colId) =>
    (await page.locator(`.ag-row[row-index="${rowIndex}"] .ag-cell[col-id="${colId}"]`).first().textContent()).trim()
  check(
    '🚩 an unresolved main action renders its RAW code, never an empty cell',
    (await actionCell(0, 'action')) === 'SNUP',
    await actionCell(0, 'action'),
  )
  check(
    '🚩 and so does an unresolved sub-action',
    (await actionCell(0, 'subAction')) === 'USTP',
    await actionCell(0, 'subAction'),
  )
  check(
    'a resolved code shows the server’s own English',
    (await actionCell(1, 'action')) === 'Member update' &&
      (await actionCell(1, 'subAction')) === 'Change mobile',
    `${await actionCell(1, 'action')} / ${await actionCell(1, 'subAction')}`,
  )
  check(
    'By answers "who did this to my account", and the free-form slots are both shown',
    (await actionCell(0, 'userId')) === 'msartawi' &&
      (await actionCell(0, 'actionData')).includes('0555000222') &&
      (await actionCell(0, 'actionData2')) === 'web',
  )
  const grid = await page.locator('.ag-root-wrapper').first().textContent()
  check(
    '🚩 NOT ONE member-snapshot field reaches the grid — the member is the header, not 25 rows of PII',
    !/Nouf Al-Harbi/.test(grid) &&
      !/nouf\.h@example\.com/.test(grid) &&
      !/966555000111/.test(grid) &&
      !/Riyadh/.test(grid) &&
      !/Bupa/.test(grid) &&
      !/Mobile moved to another account/.test(grid),
    grid.slice(0, 200),
  )
  check(
    'and the member is still whole in the header above it',
    /Nouf Al-Harbi/.test(await page.textContent('body')),
  )

  // ---- Scenario 35: empty and failed, in ACTIONS' own words ---------------
  scenario.actions = { total: 0 }
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByText('No actions recorded for this member.').waitFor({ timeout: 10000 })
  const emptyActions = await page.textContent('body')
  check(
    '🚩 an empty tab says ACTIONS were absent — never a shared "No data", never another tab\'s sentence',
    !/No data/.test(emptyActions) &&
      !/No sales lines/.test(emptyActions) &&
      !/No loyalty activity/.test(emptyActions),
  )
  check(
    '🚩 an empty tab is not a failure — no banner, no Retry, and no pager',
    (await page.getByRole('button', { name: /^Retry$/ }).count()) === 0 &&
      (await page.getByRole('button', { name: /^Next$/ }).count()) === 0 &&
      !/could not be read/.test(emptyActions),
  )
  check(
    'and the real total is still stated — zero is a count, not a missing one',
    /0 actions\./.test(emptyActions),
  )

  scenario.actions = 'throws'
  calls = []
  activityCalls = []
  await page.goto(BASE + '/loy/members/100001293?tab=actions')
  await page.getByRole('button', { name: /^Retry$/ }).waitFor({ timeout: 15000 })
  const failedActions = await page.textContent('body')
  check(
    '🚩 a failed audit read fails INSIDE its tab — the member header survives it',
    /Nouf Al-Harbi/.test(failedActions) && /12,480/.test(failedActions),
  )
  check(
    'the failure names WHICH read broke, and carries the server sentence too',
    /The member actions could not be read\./.test(failedActions) &&
      /unexpected error/i.test(failedActions) &&
      (await page.getByRole('alert').count()) >= 1,
  )
  check(
    '🚩 no caption is invented for a read that never answered — a total it does not have',
    !/actions\./.test(failedActions.replace(/The member actions could not be read\./, '')),
  )
  check(
    '🚩 no toast — the state is already fully visible in the tab being looked at',
    (await page.locator('[data-sonner-toast]').count()) === 0,
  )
  check('the other tabs are untouched and still reachable', (await page.getByRole('tab').count()) === 4)

  scenario.actions = { total: 312 }
  actionCalls = []
  const memberCallsBeforeActionsRetry = calls.length
  await page.getByRole('button', { name: /^Retry$/ }).click()
  await page.getByText('312 actions.').waitFor({ timeout: 10000 })
  check(
    'Retry refetches the tab',
    actionCalls.length >= 1,
    JSON.stringify(actionCalls),
  )
  check(
    '🚩 and ONLY that tab — neither the member nor another tab is re-read',
    calls.length === memberCallsBeforeActionsRetry && activityCalls.length === 0,
    `${calls.length} vs ${memberCallsBeforeActionsRetry}, activities ${activityCalls.length}`,
  )

  check('no page errors anywhere in the drive', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length) process.exitCode = 1
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
