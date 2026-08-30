// Loy member ADMIN drive (spec 301) — drives the REAL app in Chromium against
// MOCKED `LoyWeb/*` envelopes.
//
// ⚠ The `LoyWeb` door does not exist, and the admin half of it is not even
// numbered yet (spec 301, "The backend half"). Spec 231's standing verification
// rule — inherited from decision 228 — says no ticket in this wave may be called
// done on the strength of a live call, so the network is stubbed at Playwright
// against the shapes the client designed. 🚩 NOTHING here is driven against a
// live SIS.Api, and the widened probe answer is this client's design intent
// rather than a shipped contract.
//
// Ticket 302's flow Proof bullet — `theTabDrawsControlsOnlyForTheAuthorityHeld`:
//   1. Profile LEADS the strip and Activities is still the landing tab;
//   2. a LOOK-ONLY session sees a read-only field list — 🚩 no control at all,
//      not even a disabled one, and no "you cannot edit this" banner;
//   3. an EDITOR sees the same fields as controls, plus the Status control and
//      the email-removal control;
//   4. a REMOVER additionally sees the mobile-removal control, inside the group
//      that is set visibly apart;
//   5. 🚩 every not-literally-true flag is a denial — a string `"true"`, an
//      absent flag, `{}` and a probe that THREW all draw the look-only tab;
//   6. 🚩 the three flags ride the ONE shared probe key: the nav leaf, the page
//      guard and the tab together make exactly ONE `LoyWeb/Access` call;
//   7. the mobile is read-only for every session, including the remover — it
//      changes through its own command (305), never as a profile field.
//
// Ticket 303's flow Proof bullet — `blockingRefreshesTheHeaderAndTheActionsTabWithoutAReload`:
//   8. ONE Status control offers whichever command applies, and blocking asks for
//      a reason from the server's list;
//   9. 🚩 the **system reason** `CR` is provably ABSENT from the picker — an
//      analyst must not be able to mark a member "removed at customer request"
//      without removing anything;
//  10. a block refreshes the HEADER chip and the ACTIONS tab with no reload, and
//      the control then offers Unblock;
//  11. 🚩 the control disables itself while in flight, and a double-click writes
//      ONE command — there is no server-side idempotency anywhere in the module.
//      The guard SURVIVES a tab switch, because the control does not;
//  12. 🚩 a business refusal keeps the analyst IN the dialog with the reason still
//      chosen, explained by name AND in the server's own sentence;
//  13. a grant refusal (403) says the authority is gone and offers no retry —
//      the command goes DEAD, not merely apologetic;
//  14. an unblock clears the reason with no further input, and its refusal is said
//      beside the control it has no dialog to keep the analyst in.
//
// Ticket 305's flow Proof bullet — `aRefusedMobileChangeLeavesTheMemberUntouched`:
//  22. the mobile changes through its OWN control behind its OWN confirmation —
//      never as a field on the profile form;
//  23. 🚩 a COLLISION refusal leaves the member untouched: the old number is still
//      on screen, the Actions tab gained no row, and the analyst is still in the
//      confirmation with the number they typed;
//  24. 🚩 the three refusals are named as THEMSELVES — a collision, a no-op and a
//      typo read as three different problems, each with the server's own sentence;
//  25. the screen refuses what it can see for itself — the number the member
//      already has, and anything that is not digits — before any call is made;
//  26. a successful change moves the HEADER and the Actions tab with no reload,
//      and the confirmation says what is TRUE about verification (no OTP is sent);
//  27. a grant refusal (403) takes the command away rather than merely apologising;
//  28. the control disables itself in flight — a double-click writes ONE change —
//      and it leaves the Status command alone, because they are unrelated writes;
//  29. none of it reaches a reader: a look-only session has no mobile control.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/loy-member-admin-drive.mjs
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

const LOYID_KEY = '100001293'

// `LoyMemberModel` as the `LoyWeb` projection hands it over — the same stub the
// lookup drive carries, so the two drives cannot disagree about the member.
const MEMBER = {
  loyId: LOYID_KEY,
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

// The three sessions the ticket is about, plus the four answers that must behave
// exactly like the first one. 🚩 `looseEdit` and `absentFlags` are the whole
// point: being wrong here fails OPEN on a customer-PII surface, so a string
// `"true"` and a flag the door forgot must both draw the read-only tab.
const SESSIONS = {
  lookOnly: { canOpenLoyMember: true, canEditLoyMember: false, canRemoveLoyMemberMobile: false },
  editor: { canOpenLoyMember: true, canEditLoyMember: true, canRemoveLoyMemberMobile: false },
  remover: { canOpenLoyMember: true, canEditLoyMember: true, canRemoveLoyMemberMobile: true },
  looseEdit: { canOpenLoyMember: true, canEditLoyMember: 'true', canRemoveLoyMemberMobile: 1 },
  absentFlags: { canOpenLoyMember: true },
  objectFlags: { canOpenLoyMember: true, canEditLoyMember: {}, canRemoveLoyMemberMobile: null },
}

// `GET LoyWeb/BlockedReasons` as the door is designed to answer it (ticket 303).
// 🚩 `CR` rides the answer flagged as a **system reason** on purpose: the drive
// asserts the CLIENT drops it, so the picker stays honest even against a door
// that forgot to filter.
const BLOCKED_REASONS = [
  { code: 'CM', description: 'Mobile moved to another account', systemReason: false },
  { code: 'IA', description: 'Inactive', systemReason: false },
  { code: 'CR', description: 'Removed at customer request', systemReason: true },
]

let scenario = { access: 'lookOnly', memberOver: {} }
let accessCalls = 0

// ---- ticket 303: the member the COMMANDS write to -------------------------
// The member is MUTABLE here because the whole point of the block/unblock
// scenarios is that the screen re-reads and moves with no reload. `actionRows`
// grows the way the trail does, so "the Actions tab reflects it" is asserted
// against a row the command actually produced rather than against a fixture.
let memberState = null
let actionRows = []
let commandCalls = { block: 0, unblock: 0 }
/** The refusal the next command answers with, or null for success. */
let commandRefusal = null
/** How long the next command takes — the in-flight window the disable guards. */
let commandDelay = 0
/** How `LoyWeb/BlockedReasons` answers: `ok`, `empty`, or `fails`. */
let reasonsAnswer = 'ok'

// ---- ticket 304: the profile command --------------------------------------
/** How many profile writes the door has seen, and the body of the last one —
 *  the whole point of the blank-tolerance scenario is asserted against what the
 *  browser ACTUALLY sent, not against what the form appears to hold. */
let profileCalls = 0
let profileBody = null
/** The refusal the next profile save answers with, or null for success. */
let profileRefusal = null
/** How long the next profile save takes — the in-flight window the disable
 *  guards, and the only double-submit protection that exists anywhere. */
let profileDelay = 0
/** Whether the member READ fails — the door being down under a reload. */
let memberReadFails = false

// ---- ticket 305: the mobile command ---------------------------------------
/** How many mobile writes the door has seen, and what the last one carried —
 *  the number is asserted against what the browser ACTUALLY sent, because the
 *  client compacts and the door normalises. */
let mobileCalls = 0
let mobileBody = null
/** The refusal the next mobile change answers with, or null for success. */
let mobileRefusal = null
/** How long the next mobile change takes — the in-flight window the disable
 *  guards, and the only double-submit protection that exists anywhere. */
let mobileDelay = 0

const trailRow = (type, description, data) => ({
  actionNo: String(900 + actionRows.length),
  mainActionType: type,
  mainActionDescription: description,
  subActionType: null,
  subActionDescription: null,
  actionDateTime: '2026-08-30T11:04:00',
  actionData: data,
  actionData2: null,
  userId: 'msartawi',
  branchId: '1001',
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    // A stubbed 500 is the SUBJECT of one scenario; Chromium logs every non-2xx
    // as a console error, so only a real script failure counts.
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )

    // The area's ONE probe, now answering three flags (spec 301). Counted so the
    // "one key, one call" property is asserted rather than assumed.
    if (path === 'LoyWeb/Access') {
      accessCalls += 1
      // A probe that THREW — the case the fail-closed rule exists for. There is
      // no 404-tolerant catch anywhere on this path.
      if (scenario.access === 'throws') return route.fulfill({ status: 500, body: 'boom' })
      return route.fulfill(envelope(SESSIONS[scenario.access]))
    }

    // ---- ticket 304: the profile command ----------------------------------
    // Matched before the member read below, which shares the prefix.
    if (/^LoyWeb\/Member\/[^/]+\/Profile$/.test(path)) {
      profileCalls += 1
      profileBody = route.request().postDataJSON()
      if (profileDelay) await sleep(profileDelay)
      if (profileRefusal) return route.fulfill(profileRefusal)
      memberState = {
        ...memberState,
        fullName: profileBody.fullName,
        email: profileBody.email,
        // The wire carries a birth date as a stamp and a sentinel for "unset" —
        // the door writing the form's `yyyy-MM-dd` back in the shape the read
        // hands over is what makes the round trip honest.
        birthDate: profileBody.birthDate
          ? `${profileBody.birthDate}T00:00:00`
          : '0001-01-01T00:00:00',
        gender: profileBody.gender,
        nationality: profileBody.nationality,
        nationalId: profileBody.nationalId,
        cityCode: profileBody.cityCode,
        preferredLanguage: profileBody.preferredLanguage,
        insuranceCompany: profileBody.insuranceCompany,
        // 🚩 The stamp MOVES on a write. It is what the stale guard is built on,
        // so a door that answered the old one would make the guard untestable.
        lastUpdate: '2026-08-30T11:04:00',
      }
      actionRows = [trailRow('UPD', 'Member updated', 'profile'), ...actionRows]
      return route.fulfill(envelope(null))
    }

    // ---- ticket 305: the mobile command ------------------------------------
    // Matched before the member read below, which shares the prefix.
    if (/^LoyWeb\/Member\/[^/]+\/Mobile$/.test(path)) {
      mobileCalls += 1
      mobileBody = route.request().postDataJSON()
      if (mobileDelay) await sleep(mobileDelay)
      // 🚩 A refusal writes NOTHING — no member change and no trail row. The
      // delegated handler refuses a collision rather than taking the number from
      // its current holder, so the member is never left half-edited.
      if (mobileRefusal) return route.fulfill(mobileRefusal)
      memberState = { ...memberState, mobile: mobileBody.mobile }
      actionRows = [trailRow('MOB', 'Mobile changed', mobileBody.mobile), ...actionRows]
      return route.fulfill(envelope(null))
    }

    // ---- ticket 303: the two writes ---------------------------------------
    // Matched BEFORE the member read below, which would otherwise swallow both
    // (they hang off the same `LoyWeb/Member/{id}` prefix).
    if (/^LoyWeb\/Member\/[^/]+\/(Block|Unblock)$/.test(path)) {
      const kind = path.endsWith('/Block') ? 'block' : 'unblock'
      commandCalls[kind] += 1
      if (commandDelay) await sleep(commandDelay)
      if (commandRefusal) return route.fulfill(commandRefusal)
      if (kind === 'block') {
        const body = route.request().postDataJSON() || {}
        memberState = { ...memberState, blockedReason: body.blockedReason }
        actionRows = [trailRow('BLK', 'Member blocked', body.blockedReason), ...actionRows]
      } else {
        memberState = { ...memberState, blockedReason: null }
        actionRows = [trailRow('UBK', 'Member unblocked', ''), ...actionRows]
      }
      return route.fulfill(envelope(null))
    }

    // The reasons an agent may pick. `empty` is seed data with nothing offerable;
    // `fails` is the raw 500 the scoped Retry exists for.
    if (path === 'LoyWeb/BlockedReasons') {
      if (reasonsAnswer === 'fails') return route.fulfill({ status: 500, body: 'boom' })
      return route.fulfill(envelope(reasonsAnswer === 'empty' ? [] : BLOCKED_REASONS))
    }

    if (path.startsWith('LoyWeb/Member/')) {
      if (memberReadFails) return route.fulfill({ status: 500, body: 'boom' })
      return route.fulfill(envelope(memberState ?? { ...MEMBER, ...scenario.memberOver }))
    }

    // The three report tabs are not ticket 302's subject; they answer empty so
    // nothing beside the Profile tab can fail the drive. 303's block/unblock DO
    // land in the Actions trail, which is what `actionRows` carries.
    if (path.startsWith('LoyWeb/Reports/LoyMemberActions'))
      return route.fulfill(
        envelope({
          records: actionRows,
          currentPage: 1,
          pageSize: 25,
          pageRecordsCount: actionRows.length,
          totalPages: 1,
          recordsCount: actionRows.length,
        }),
      )
    if (path.startsWith('LoyWeb/Reports/')) return route.fulfill(envelope([]))

    return route.fulfill(envelope({}))
  })

  const panel = page.locator('#loy-tab-panel')
  const profileTab = page.getByRole('tab', { name: 'Profile' })

  /** Every command the open tab offers, by name, case folded — the labels are
   *  uppercased by CSS and `innerText` honours `text-transform`. */
  const buttonNames = async () =>
    (await panel.getByRole('button').allInnerTexts()).map((text) => text.trim().toLowerCase())

  /** Load the member fresh under one probe answer, and open the named tab. */
  const open = async (access, { tab = 'profile', memberOver = {} } = {}) => {
    scenario = { access, memberOver }
    accessCalls = 0
    // 🚩 The member and its trail are reset per load and then MUTATED by the
    // commands, so every 303 assertion is made against what the write actually
    // did rather than against a fixture that agrees with the test by design.
    memberState = { ...MEMBER, ...memberOver }
    actionRows = []
    commandCalls = { block: 0, unblock: 0 }
    commandRefusal = null
    commandDelay = 0
    reasonsAnswer = 'ok'
    profileCalls = 0
    profileBody = null
    profileRefusal = null
    profileDelay = 0
    memberReadFails = false
    mobileCalls = 0
    mobileBody = null
    mobileRefusal = null
    mobileDelay = 0
    await page.goto(`${BASE}/loy/members/${LOYID_KEY}${tab ? `?tab=${tab}` : ''}`)
    await page.getByRole('tablist').waitFor({ timeout: 15000 })
    if (tab === 'profile') await panel.getByText('Membership').waitFor({ timeout: 10000 })
  }

  // ---- Scenario 1: Profile leads the strip, Activities still lands ---------
  await open('lookOnly', { tab: '' })
  check(
    'Profile LEADS the strip, before the three reports',
    (await page.getByRole('tab').allInnerTexts()).map((s) => s.trim()).join('|') ===
      'Profile|Activities|Sales|Actions',
    (await page.getByRole('tab').allInnerTexts()).join('|'),
  )
  check(
    '🚩 and Activities is STILL the landing tab (227 #7 holds for the many who only read)',
    (await page.getByRole('tab', { name: 'Activities' }).getAttribute('aria-selected')) === 'true' &&
      (await profileTab.getAttribute('aria-selected')) === 'false',
  )
  check(
    'Profile opens when it is asked for, and only then',
    (await (async () => {
      await profileTab.click()
      await panel.getByText('Membership').waitFor({ timeout: 10000 })
      return page.url()
    })()).includes('tab=profile'),
  )

  // ---- Scenario 2: the look-only rendering ---------------------------------
  await open('lookOnly')
  // 🚩 Section and field labels are uppercased by CSS and `innerText` honours
  // `text-transform`, so every text assertion below folds case rather than
  // asserting the stylesheet by accident.
  const lookOnlyText = (await panel.innerText()).toLowerCase()
  check(
    '🚩 a look-only session sees NO control at all — no input, no button, disabled or otherwise',
    (await panel.locator('input').count()) === 0 &&
      (await panel.locator('button').count()) === 0 &&
      (await panel.locator('select, textarea').count()) === 0,
    `${await panel.locator('input').count()} inputs, ${await panel.locator('button').count()} buttons`,
  )
  check(
    '🚩 and no apology for what it cannot do — no read-only banner anywhere',
    !/cannot|not allowed|permission|read-only|no access/i.test(lookOnlyText),
  )
  check(
    'it draws the nine editable-later fields as plain facts',
    [
      'full name',
      'email',
      'birth date',
      'gender code',
      'nationality code',
      'national id',
      'city code',
      'preferred language',
      'insurance company',
    ].every((label) => lookOnlyText.includes(label)) && lookOnlyText.includes('nouf al-harbi'),
  )
  check(
    'and the forever-read-only facts beside them',
    ['loy id', 'member type', 'mobile', 'points balance', 'pending points', 'tier', 'tier points', 'joined', 'last update', 'blocked reason'].every(
      (label) => lookOnlyText.includes(label),
    ) && lookOnlyText.includes('966555000111') && lookOnlyText.includes('12,480'),
  )
  check(
    '🚩 an absent value reads as absent, not as a gap',
    lookOnlyText.includes('—'),
  )
  check(
    'the removal group is not drawn at all for a reader',
    !lookOnlyText.includes('contact removal') && !lookOnlyText.includes('remove email'),
  )
  check(
    '🚩 the whole screen cost ONE probe call — nav leaf, page guard and tab share the key',
    accessCalls === 1,
    `${accessCalls} calls`,
  )

  // ---- Scenario 3: the editor's rendering ---------------------------------
  await open('editor')
  const editorText = (await panel.innerText()).toLowerCase()
  check(
    'an editor sees the same nine fields as CONTROLS',
    (await panel.locator('input[id^="loy-profile-"]').count()) === 9,
    `${await panel.locator('input[id^="loy-profile-"]').count()} profile inputs`,
  )
  check(
    '🚩 and exactly ONE control besides them — the mobile’s own (305), never a tenth field',
    (await panel.locator('input').count()) === 10 &&
      (await panel.locator('#loy-mobile-new').count()) === 1,
    `${await panel.locator('input').count()} inputs in all`,
  )
  check(
    'the controls hold the member as loaded, not an empty form',
    (await panel.locator('#loy-profile-fullName').inputValue()) === 'Nouf Al-Harbi' &&
      (await panel.locator('#loy-profile-email').inputValue()) === 'nouf.h@example.com',
  )
  check(
    '🚩 a control holds the value that will be SENT — the birth date as yyyy-MM-dd, not as its display form',
    (await panel.locator('#loy-profile-birthDate').inputValue()) === '1990-11-08',
    await panel.locator('#loy-profile-birthDate').inputValue(),
  )
  check(
    'the Status control appears, offering the one that applies',
    (await buttonNames()).includes('block member') &&
      !(await buttonNames()).includes('unblock member'),
    (await buttonNames()).join(' / '),
  )
  check(
    'the email-removal control appears, in a group of its own',
    editorText.includes('contact removal') && editorText.includes('remove email'),
  )
  check(
    '🚩 but NOT the mobile removal — that is the third tier',
    !editorText.includes('remove mobile'),
  )
  check(
    '🚩 and the mobile is still read-only for an editor — it changes through its own command',
    (await panel.locator('input[id^="loy-profile-"]').count()) === 9 &&
      (await panel.locator('#loy-profile-mobile').count()) === 0,
  )
  check(
    'the removal group says out loud that it is not account deletion',
    /not account deletion/i.test(editorText),
  )
  check('one probe call for the editor too', accessCalls === 1, `${accessCalls} calls`)

  // A blocked member flips the ONE status control rather than growing a second.
  await open('editor', { memberOver: { blockedReason: 'CM' } })
  // Read off the BUTTONS rather than the panel text: "Unblock member" contains
  // "block member", so a text assertion could not tell the two commands apart.
  const blockedButtons = await buttonNames()
  check(
    'a blocked member is offered Unblock, and only Unblock',
    blockedButtons.includes('unblock member') && !blockedButtons.includes('block member'),
    blockedButtons.join(' / '),
  )

  // ---- Scenario 4: the remover's rendering --------------------------------
  await open('remover')
  const removerText = (await panel.innerText()).toLowerCase()
  check(
    'a remover sees the mobile-removal control',
    removerText.includes('remove mobile'),
  )
  check(
    'it sits INSIDE the removal group, apart from the profile fields',
    (await panel.locator('section', { hasText: 'Contact removal' }).getByText('Remove mobile').count()) === 1,
  )
  check(
    'and keeps everything the editor had',
    removerText.includes('remove email') &&
      (await panel.locator('input[id^="loy-profile-"]').count()) === 9 &&
      (await panel.locator('#loy-mobile-new').count()) === 1,
  )

  // ---- Scenario 5: every loose answer is a denial --------------------------
  for (const [answer, why] of [
    ['looseEdit', 'a string "true" and a 1'],
    ['absentFlags', 'flags the door never sent'],
    ['objectFlags', 'an object and a null where a boolean was promised'],
  ]) {
    await open(answer)
    check(
      `🚩 ${why} draws the LOOK-ONLY tab`,
      (await panel.locator('input').count()) === 0 && (await panel.locator('button').count()) === 0,
      `${await panel.locator('input').count()} inputs, ${await panel.locator('button').count()} buttons`,
    )
  }

  // A probe that threw does not reach this tab at all — the page's own
  // fail-closed guard lands on the denied backstop first, which is the stronger
  // outcome and the one 234 pinned. Asserted here so a later change that made
  // the tab tolerant of a thrown probe would still be caught.
  scenario = { access: 'throws', memberOver: {} }
  accessCalls = 0
  await page.goto(`${BASE}/loy/members/${LOYID_KEY}?tab=profile`)
  await page.getByRole('alert').waitFor({ timeout: 15000 })
  check(
    '🚩 a probe that THREW never renders the tab — the screen denies before it draws',
    (await page.getByRole('tablist').count()) === 0 &&
      (await page.locator('#loy-tab-panel').count()) === 0,
  )

  // ======================================================================
  // Ticket 303 — the first member command that writes
  // ======================================================================
  const statusButton = page.locator('[data-testid="loy-status-command"]')
  const confirmButton = page.locator('[data-testid="loy-status-confirm"]')
  const reasonSelect = page.locator('#loy-block-reason')
  const dialog = page.locator('dialog')

  /** Open the Actions tab and come back, so its (empty) page is CACHED. Without
   *  this the tab would fetch on every open and "the command refreshed it" would
   *  be proved by a remount rather than by the invalidation. */
  const warmActionsCache = async () => {
    await page.getByRole('tab', { name: 'Actions' }).click()
    await panel.getByText(/no actions/i).waitFor({ timeout: 10000 })
    await profileTab.click()
    await panel.getByText('Membership').waitFor({ timeout: 10000 })
  }

  const actionsText = async () => {
    await page.getByRole('tab', { name: 'Actions' }).click()
    await page.waitForTimeout(400)
    return (await panel.innerText()).toLowerCase()
  }

  // ---- Scenario 6: blocking asks for a reason, and CR is not on the list ---
  await open('editor')
  await warmActionsCache()
  // 🚩 Stamped on the window so "without a reload" is PROVED rather than
  // asserted: a navigation would wipe this.
  await page.evaluate(() => {
    window.__driveMark = 'alive'
  })

  await statusButton.click()
  await reasonSelect.waitFor({ timeout: 10000 })
  const options = await page.locator('#loy-block-reason option').allInnerTexts()
  check(
    'blocking asks for a reason, from the server’s own list',
    options.includes('Mobile moved to another account') && options.includes('Inactive'),
    options.join(' / '),
  )
  check(
    '🚩 the SYSTEM reason is provably absent from the picker — CR cannot be chosen by hand',
    !options.some((o) => /removed at customer request/i.test(o)) &&
      (await page.locator('#loy-block-reason option[value="CR"]').count()) === 0,
    options.join(' / '),
  )
  check(
    'and the confirm is dead until a reason is chosen — a block always says why',
    (await confirmButton.getAttribute('aria-disabled')) === 'true',
  )

  // ---- Scenario 7: the write, the in-flight disable, and the refresh ------
  await reasonSelect.selectOption('CM')
  check(
    'choosing a reason arms the confirm',
    (await confirmButton.getAttribute('aria-disabled')) === null,
  )
  commandDelay = 700
  // 🚩 Two clicks, deliberately. There is NO server-side idempotency anywhere in
  // the module — the correlation id is pass-through and the trail service mints
  // its own — so a second write would produce a second member update snapshot and
  // a second trail row. The client's disable is the only guard there is.
  await confirmButton.click()
  await page.waitForTimeout(120)
  const disabledInFlight = (await confirmButton.getAttribute('aria-disabled')) === 'true'
  await confirmButton.click({ force: true })
  await dialog.waitFor({ state: 'detached', timeout: 15000 })
  check('🚩 the control disables itself while the write is in flight', disabledInFlight)
  check(
    '🚩 and a double-click writes exactly ONE command — the client is the only guard',
    commandCalls.block === 1,
    `${commandCalls.block} block calls`,
  )

  check(
    'the HEADER moves with no reload — the blocked chip appears',
    /blocked · mobile moved to another account/i.test(await page.innerText('body')) &&
      (await page.evaluate(() => window.__driveMark)) === 'alive',
  )
  check(
    'and the ONE Status control now offers Unblock, and only Unblock',
    (await buttonNames()).includes('unblock member') &&
      !(await buttonNames()).includes('block member'),
    (await buttonNames()).join(' / '),
  )
  check(
    'the ACTIONS tab reflects the command too — its cached page was invalidated',
    /member blocked/i.test(await actionsText()) &&
      (await page.evaluate(() => window.__driveMark)) === 'alive',
  )

  // ---- Scenario 7b: the guard outlives the CONTROL --------------------------
  // 🚩 The tab shell mounts only the open tab, so a control holding "in flight"
  // in its own state forgets it the moment an analyst clicks Actions and comes
  // back — and presses again. With no server-side idempotency that is a second
  // member update snapshot and a second trail row.
  await open('editor', { memberOver: { blockedReason: 'CM' } })
  commandDelay = 1500
  await statusButton.click()
  await page.waitForTimeout(150)
  await page.getByRole('tab', { name: 'Actions' }).click()
  await profileTab.click()
  await panel.getByText('Membership').waitFor({ timeout: 10000 })
  const armedAfterRemount = await statusButton.isEnabled()
  await statusButton.click({ force: true })
  await page.waitForTimeout(1800)
  check(
    '🚩 the in-flight guard SURVIVES a tab switch — a remounted control is still dead',
    !armedAfterRemount && commandCalls.unblock === 1,
    `${commandCalls.unblock} unblock calls, remount armed: ${armedAfterRemount}`,
  )
  check(
    'and the command still refreshed the member, though the tab it started on had unmounted',
    !/blocked ·/i.test(await page.innerText('body')),
  )

  // ---- Scenario 8: a business refusal is explained, and keeps the analyst --
  await open('editor')
  await statusButton.click()
  await reasonSelect.waitFor({ timeout: 10000 })
  await reasonSelect.selectOption('IA')
  commandRefusal = envelope(null, {
    status: 400,
    success: false,
    message: 'Blocked reason IA is not configured for this store.',
    errors: [{ errorCode: 'LOY-00105', errorMessage: '', internalErrorCode: '' }],
  })
  await confirmButton.click()
  await dialog.getByRole('alert').waitFor({ timeout: 10000 })
  const refusalText = await dialog.innerText()
  check(
    '🚩 a business refusal keeps the analyst IN the dialog, with the reason still chosen',
    (await dialog.count()) === 1 && (await reasonSelect.inputValue()) === 'IA',
    await reasonSelect.inputValue(),
  )
  check(
    '🚩 and is explained by NAME and in the server’s own sentence — never flattened to one',
    /that blocked reason was not accepted/i.test(refusalText) &&
      /is not configured for this store/i.test(refusalText),
    refusalText.replace(/\s+/g, ' ').slice(0, 160),
  )
  check(
    'the member is untouched by a refusal — the header still says nothing about a block',
    !/blocked ·/i.test(await page.innerText('body')),
  )

  // The same dialog, the same reason, once the refusal is gone: a refusal is a
  // pause, not a dead end.
  commandRefusal = null
  await confirmButton.click()
  await dialog.waitFor({ state: 'detached', timeout: 15000 })
  check(
    'and a retry from the same dialog goes through with the reason that was already chosen',
    commandCalls.block === 2 && /blocked · inactive/i.test(await page.innerText('body')),
  )

  // ---- Scenario 9: a grant refusal is not an outage ------------------------
  await open('editor')
  await statusButton.click()
  await reasonSelect.waitFor({ timeout: 10000 })
  await reasonSelect.selectOption('CM')
  commandRefusal = envelope(null, {
    status: 403,
    success: false,
    message: 'Forbidden.',
    errors: [],
  })
  await confirmButton.click()
  await dialog.getByRole('alert').waitFor({ timeout: 10000 })
  const grantText = await dialog.innerText()
  check(
    '🚩 a 403 says the AUTHORITY is gone and offers no retry — it is not an outage',
    /no longer holds the authority/i.test(grantText) && /will not help/i.test(grantText),
    grantText.replace(/\s+/g, ' ').slice(0, 160),
  )
  // 🚩 And offers none as an AFFORDANCE, not only in words: pressing again would
  // be the retry loop the rule exists to prevent, so the command goes dead where
  // it stands.
  commandRefusal = null
  await confirmButton.click({ force: true })
  await page.waitForTimeout(400)
  check(
    '🚩 and the command goes DEAD — a grant refusal takes the button away, not just the words',
    (await confirmButton.getAttribute('aria-disabled')) === 'true' &&
      commandCalls.block === 1 &&
      (await dialog.count()) === 1,
    `${commandCalls.block} block calls`,
  )

  // ---- Scenario 10: unblocking clears the reason with no further input -----
  await open('editor', { memberOver: { blockedReason: 'CM' } })
  await warmActionsCache()
  check(
    'a blocked member opens on Unblock, and the header says why they are blocked',
    (await buttonNames()).includes('unblock member') &&
      /blocked · mobile moved to another account/i.test(await page.innerText('body')),
  )
  commandRefusal = envelope(null, {
    status: 400,
    success: false,
    message: 'That member could not be found.',
    errors: [{ errorCode: 'LOY-00100', errorMessage: '', internalErrorCode: '' }],
  })
  await statusButton.click()
  await panel.getByRole('alert').waitFor({ timeout: 10000 })
  check(
    '🚩 an unblock has no dialog, so its refusal is said BESIDE the control',
    (await dialog.count()) === 0 &&
      /this member no longer exists/i.test(await panel.innerText()) &&
      /could not be found/i.test(await panel.innerText()),
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )

  commandRefusal = null
  await statusButton.click()
  await page.waitForFunction(() => !/Blocked ·/i.test(document.body.innerText), null, {
    timeout: 15000,
  })
  check(
    'unblocking clears the reason with NO further input — one press, no dialog',
    commandCalls.unblock === 2 && (await buttonNames()).includes('block member'),
    (await buttonNames()).join(' / '),
  )
  check(
    'and the Actions tab shows the unblock too',
    /member unblocked/i.test(await actionsText()),
  )

  // ---- Scenario 11: the two answers that are not rows ---------------------
  await open('editor')
  reasonsAnswer = 'empty'
  await statusButton.click()
  await dialog.getByText(/no blocked reason is available/i).waitFor({ timeout: 10000 })
  check(
    '🚩 an empty reason list renders as an empty LIST, never as a failure',
    /no blocked reason is available/i.test(await dialog.innerText()) &&
      (await reasonSelect.count()) === 0 &&
      (await dialog.getByRole('alert').count()) === 0 &&
      (await confirmButton.getAttribute('aria-disabled')) === 'true',
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 120),
  )
  // 🚩 And it is not a DEAD END: an empty answer is never held, so once an
  // administrator has seeded a reason, reopening the dialog finds it — without
  // the reload the sentence would otherwise be quietly demanding.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  reasonsAnswer = 'ok'
  await statusButton.click()
  await reasonSelect.waitFor({ timeout: 10000 })
  check(
    '🚩 an empty list is never cached — reopening after a reason is seeded finds it',
    (await page.locator('#loy-block-reason option').count()) === 3,
    `${await page.locator('#loy-block-reason option').count()} options`,
  )

  await open('editor')
  reasonsAnswer = 'fails'
  await statusButton.click()
  await dialog.getByRole('alert').waitFor({ timeout: 10000 })
  check(
    'a reasons read that FAILED says so and offers a scoped Retry — and blocks nothing',
    /could not be loaded/i.test(await dialog.innerText()) &&
      (await dialog.getByRole('button', { name: 'Retry' }).count()) === 1 &&
      (await confirmButton.getAttribute('aria-disabled')) === 'true',
  )
  // The Retry is real: with the door answering again, the picker fills.
  reasonsAnswer = 'ok'
  await dialog.getByRole('button', { name: 'Retry' }).click()
  await reasonSelect.waitFor({ timeout: 10000 })
  check(
    'and the Retry refetches only this list',
    (await page.locator('#loy-block-reason option').count()) === 3,
    `${await page.locator('#loy-block-reason option').count()} options`,
  )

  // ======================================================================
  // Ticket 304 — the profile command
  // ======================================================================
  // Flow Proof `aRefusedSaveKeepsEveryEdit`, plus the arrangement the pure
  // module cannot reach: which control is armed, what is marked as changed, and
  // where a refusal is drawn.
  const saveButton = page.locator('[data-testid="loy-profile-save"]')
  const discardButton = page.locator('[data-testid="loy-profile-discard"]')
  const field = (name) => page.locator(`#loy-profile-${name}`)
  const reloadButton = panel.getByRole('button', { name: /reload the member/i })
  const refusalEnvelope = (errorCode, message) =>
    envelope(null, {
      status: 400,
      success: false,
      message,
      errors: [{ errorCode, errorMessage: '', internalErrorCode: '' }],
    })

  // ---- Scenario 12: a sparse member is corrected without inventing a fact --
  // 🚩 THE ticket. A member with no recorded gender and no preferred language,
  // whose name is misspelt. The till's validator would refuse this save and make
  // the analyst make a fact about the customer up.
  await open('editor', { memberOver: { gender: null, preferredLanguage: null } })
  await warmActionsCache()
  await page.evaluate(() => {
    window.__driveMark = 'alive'
  })
  check(
    'Save and Discard are DEAD on an untouched form — a command recording no change is unwritable',
    !(await saveButton.isEnabled()) && !(await discardButton.isEnabled()),
  )
  await field('fullName').fill('  Nouf Al-Harbi ')
  check(
    '🚩 a whitespace-only edit is not a change — Save stays dead',
    !(await saveButton.isEnabled()) && /nothing has been changed/i.test(await panel.innerText()),
  )
  await field('fullName').fill('Nouf Al-Harbe')
  const changedChips = await panel.getByText('Changed', { exact: true }).count()
  const oneChangedSaid = /1 field changed/i.test(await panel.innerText())
  check(
    'a real edit arms Save and MARKS the field before anything is written',
    (await saveButton.isEnabled()) && oneChangedSaid && changedChips === 1,
    `${changedChips} chips, count said: ${oneChangedSaid}`,
  )
  await field('fullName').fill('Nouf Al-Harbi')
  check(
    '🚩 and a field returned to its stored value disarms it again',
    !(await saveButton.isEnabled()),
  )

  await field('fullName').fill('Nouf Al-Harbe')
  await saveButton.click()
  await page.waitForFunction(() => /profile was updated/i.test(document.body.innerText), null, {
    timeout: 15000,
  })
  check(
    '🚩 a member with NO gender and NO preferred language SAVES — nothing is invented',
    profileCalls === 1 && profileBody.gender === null && profileBody.preferredLanguage === null,
    JSON.stringify(profileBody),
  )
  check(
    '🚩 and nothing leaves the browser as an empty string — a blank is null on the wire',
    !Object.values(profileBody).includes(''),
  )
  check(
    'all nine fields go every time, plus the last-update echo the form opened on',
    Object.keys(profileBody).length === 10 && profileBody.lastUpdate === MEMBER.lastUpdate,
    `${Object.keys(profileBody).length} keys, echo ${profileBody.lastUpdate}`,
  )
  check(
    'the header moved with NO reload, and Save went dead again',
    (await page.evaluate(() => window.__driveMark)) === 'alive' &&
      /Nouf Al-Harbe/.test(await page.innerText('body')) &&
      !(await saveButton.isEnabled()),
  )
  check(
    'and the Actions tab shows the update — a command that did not refresh it looks like it did not happen',
    /member updated/i.test(await actionsText()),
  )

  // ---- Scenario 13: a shape failure is named against its field -------------
  await open('editor')
  await field('email').fill('not-an-address')
  await field('fullName').fill('Nouf Al-Harbee')
  await saveButton.click()
  check(
    '🚩 a shape failure names the FIELD, not the form, and sends nothing',
    profileCalls === 0 &&
      /does not look like an email/i.test(await panel.innerText()) &&
      (await field('email').getAttribute('aria-invalid')) === 'true' &&
      (await field('fullName').getAttribute('aria-invalid')) === null,
  )
  check(
    '🚩 and every typed value is still exactly where the analyst left it',
    (await field('email').inputValue()) === 'not-an-address' &&
      (await field('fullName').inputValue()) === 'Nouf Al-Harbee',
  )
  await field('email').fill('nouf.new@example.com')
  check(
    'fixing the field clears its own wording — the complaint does not outlive the cause',
    !/does not look like an email/i.test(await panel.innerText()) &&
      (await field('email').getAttribute('aria-invalid')) === null,
  )

  // ---- Scenario 14: a refused save keeps every edit ------------------------
  profileRefusal = refusalEnvelope('LOY-00107', 'City 0021 is not a known city.')
  await field('cityCode').fill('0021')
  await field('gender').fill('')
  await saveButton.click()
  await panel.getByRole('alert').waitFor({ timeout: 10000 })
  check(
    '🚩 a refusal speaks in the SERVER’s sentence with the screen’s wording in front',
    /that city was not accepted/i.test(await panel.innerText()) &&
      /is not a known city/i.test(await panel.innerText()),
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )
  check(
    'and it is marked against the field the door named',
    (await field('cityCode').getAttribute('aria-invalid')) === 'true',
  )
  check(
    '🚩 a refused save costs a retry and never the analyst’s typing — every edit survives',
    (await field('cityCode').inputValue()) === '0021' &&
      (await field('email').inputValue()) === 'nouf.new@example.com' &&
      (await field('fullName').inputValue()) === 'Nouf Al-Harbee' &&
      (await field('gender').inputValue()) === '' &&
      (await saveButton.isEnabled()),
  )
  check(
    '🚩 and clearing a recorded gender was itself a legal edit — the ruling runs both ways',
    /4 fields changed/i.test(await panel.innerText()),
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 120),
  )

  // ---- Scenario 15: the stale-write guard ---------------------------------
  profileRefusal = refusalEnvelope('LOY-00108', 'The member has changed since you loaded it.')
  await field('cityCode').fill('JED')
  await saveButton.click()
  await panel.getByText(/changed while you had the form open/i).waitFor({ timeout: 10000 })
  check(
    '🚩 a stale refusal says the member CHANGED — it is not an error and offers no retry',
    (await reloadButton.count()) === 1 &&
      /changed while you had the form open/i.test(await panel.innerText()),
  )
  check(
    'and it too keeps every edit — the reload is offered, never forced',
    (await field('cityCode').inputValue()) === 'JED' &&
      (await field('fullName').inputValue()) === 'Nouf Al-Harbee',
  )
  // The member really did move: someone else corrected the name while this form
  // was open. The reload is the one action that recovers from the clash.
  profileRefusal = null
  memberState = { ...memberState, fullName: 'Nouf Al-Harbi', lastUpdate: '2026-08-30T12:00:00' }
  await reloadButton.click()
  await page.waitForFunction(
    () => document.querySelector('#loy-profile-fullName')?.value === 'Nouf Al-Harbi',
    null,
    { timeout: 15000 },
  )
  check(
    'the reload replaces the form with the member as stored NOW, and disarms Save',
    (await field('cityCode').inputValue()) === 'RUH' &&
      !(await saveButton.isEnabled()) &&
      (await panel.getByText(/changed while you had the form open/i).count()) === 0,
  )

  // ---- Scenario 16: the in-flight disable is the only guard there is -------
  await open('editor')
  profileDelay = 700
  await field('nationalId').fill('1098443218')
  await saveButton.click()
  // The disable is asserted by WAITING for it inside the in-flight window rather
  // than by reading the DOM in the same tick as the click — React has not
  // necessarily flushed by then, and a race would make this scenario report on
  // the scheduler instead of on the guard.
  const saveDisabledInFlight = await saveButton
    .evaluate((el) => el.disabled)
    .then((disabled) =>
      disabled
        ? true
        : page
            .waitForFunction(
              () => document.querySelector('[data-testid="loy-profile-save"]')?.disabled === true,
              null,
              { timeout: 500 },
            )
            .then(
              () => true,
              () => false,
            ),
    )
  await saveButton.click({ force: true })
  await page.waitForFunction(() => /profile was updated/i.test(document.body.innerText), null, {
    timeout: 15000,
  })
  check(
    '🚩 Save disables itself in flight, and a double press writes ONE command',
    saveDisabledInFlight && profileCalls === 1,
    `${profileCalls} calls`,
  )

  // ---- Scenario 17: Discard, and a grant refusal --------------------------
  await open('editor')
  await field('gender').fill('M')
  await field('email').fill('someone.else@example.com')
  await discardButton.click()
  check(
    'Discard returns the member to as stored, and writes nothing',
    (await field('gender').inputValue()) === 'F' &&
      (await field('email').inputValue()) === 'nouf.h@example.com' &&
      !(await saveButton.isEnabled()) &&
      profileCalls === 0,
  )

  await open('editor')
  profileRefusal = { status: 403, contentType: 'application/json', body: '' }
  await field('fullName').fill('Nouf Al-Harbe')
  await saveButton.click()
  await panel.getByRole('alert').waitFor({ timeout: 10000 })
  check(
    '🚩 a grant refusal takes the command AWAY rather than merely apologising',
    /no longer holds the authority/i.test(await panel.innerText()) &&
      !(await saveButton.isEnabled()) &&
      (await field('fullName').inputValue()) === 'Nouf Al-Harbe',
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 140),
  )

  // ---- Scenario 18: the guard survives the session's FIRST save -----------
  // 🚩 The high finding `/code-review` caught. After one successful save the
  // form had no stamp of its own again and simply followed the live member — so
  // a colleague's edit landing afterwards raised NO stale warning, and the next
  // save's echo matched the door and silently clobbered them. The window is one
  // save wide, and every analyst opens the tab to make more than one correction.
  await open('editor')
  await field('fullName').fill('Nouf Al-Harbe')
  await saveButton.click()
  await page.waitForFunction(() => /profile was updated/i.test(document.body.innerText), null, {
    timeout: 15000,
  })
  const firstEcho = profileBody.lastUpdate
  // The re-read the write kicked off has landed when the header says so — which
  // is the moment the form adopts the stamp that save earned.
  await page.waitForFunction(() => /Nouf Al-Harbe/.test(document.body.innerText), null, {
    timeout: 15000,
  })

  // A colleague corrects the same member. The Status command re-reads without
  // unmounting this form — it sits on this very tab — so the facts move while
  // the controls keep what they were opened with, which is 302's note exactly.
  memberState = { ...memberState, fullName: 'Nouf Al-Harbi', lastUpdate: '2026-08-30T13:00:00' }
  await statusButton.click()
  await reasonSelect.waitFor({ timeout: 10000 })
  await reasonSelect.selectOption('IA')
  await confirmButton.click()
  await panel.getByText(/changed while you had the form open/i).waitFor({ timeout: 15000 })
  check(
    '🚩 a colleague’s edit AFTER this session’s first save still raises the stale warning',
    /changed while you had the form open/i.test(await panel.innerText()) &&
      (await reloadButton.count()) === 1,
  )

  await field('nationalId').fill('1098443218')
  await saveButton.click()
  await page.waitForFunction(
    () => document.querySelector('[data-testid="loy-profile-save"]')?.disabled === true,
    null,
    { timeout: 15000 },
  )
  check(
    '🚩 and the echo is the stamp the form OWNS — the first save’s, never the colleague’s',
    firstEcho === MEMBER.lastUpdate &&
      profileBody.lastUpdate === '2026-08-30T11:04:00' &&
      profileCalls === 2,
    `first ${firstEcho} → second ${profileBody.lastUpdate}`,
  )

  // ---- Scenario 19: a reload whose read failed keeps the edits -------------
  await open('editor')
  profileRefusal = refusalEnvelope('LOY-00108', 'The member has changed since you loaded it.')
  await field('fullName').fill('Nouf Al-Harbee')
  await saveButton.click()
  await panel.getByText(/changed while you had the form open/i).waitFor({ timeout: 10000 })
  memberReadFails = true
  await reloadButton.click()
  await panel.getByText(/could not be re-read/i).waitFor({ timeout: 25000 })
  check(
    '🚩 a reload whose READ failed replaces nothing, says so, and keeps every edit',
    (await field('fullName').inputValue()) === 'Nouf Al-Harbee' &&
      /could not be re-read/i.test(await panel.innerText()),
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 140),
  )

  // ---- Scenario 20: one in-flight guard per COMMAND -----------------------
  await open('editor')
  profileDelay = 900
  await field('gender').fill('M')
  await saveButton.click()
  await page.waitForFunction(
    () => document.querySelector('[data-testid="loy-profile-save"]')?.disabled === true,
    null,
    { timeout: 5000 },
  )
  check(
    '🚩 a profile save in flight leaves the Status command alone — they are unrelated writes',
    await statusButton.isEnabled(),
  )
  await page.waitForFunction(() => /profile was updated/i.test(document.body.innerText), null, {
    timeout: 15000,
  })

  // ---- Scenario 21: a look-only session still writes nothing ---------------
  await open('lookOnly')
  check(
    '🚩 and none of this reaches a reader — no Status control at all for look-only',
    (await statusButton.count()) === 0 && (await panel.locator('button').count()) === 0,
  )

  // ---- Scenario 21b: a member the shape check could not save at all --------
  // \U0001f6a9 The defect `/code-review` found on 305's pass, against 304's own ruling:
  // the checks ran over the whole DRAFT, so a member whose STORED email the regex
  // cannot parse was unsaveable outright — and an analyst fixing a misspelt name
  // had to blank a contact detail first, losing a way of reaching the customer to
  // correct something else entirely.
  await open('editor', { memberOver: { email: 'user@localhost' } })
  await field('fullName').fill('Nouf Al-Harbee')
  await saveButton.click()
  await page.waitForFunction(() => /profile was updated/i.test(document.body.innerText), null, {
    timeout: 15000,
  })
  check(
    '\U0001f6a9 a name is fixed on a member whose STORED email the regex cannot parse',
    profileCalls === 1 && profileBody.fullName === 'Nouf Al-Harbee',
    JSON.stringify(profileBody && profileBody.fullName),
  )
  check(
    'and the untouched address went out exactly as it was stored — nothing was blanked',
    profileBody.email === 'user@localhost',
    JSON.stringify(profileBody && profileBody.email),
  )
  // Touch it, though, and it is the analyst's to answer for.
  await field('email').fill('still not one')
  await saveButton.click()
  await page.waitForTimeout(400)
  check(
    'but a shape failure the analyst TYPED still stops the save, named against its field',
    profileCalls === 1 && /does not look like an email/i.test(await panel.innerText()),
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 120),
  )

  // ==== ticket 305: the mobile command ======================================
  const mobileInput = page.locator('[data-testid="loy-mobile-input"]')
  const mobileButton = page.locator('[data-testid="loy-mobile-command"]')
  const mobileConfirm = page.locator('[data-testid="loy-mobile-confirm"]')
  const mobileRefusalEnvelope = (errorCode, message) =>
    envelope(null, {
      status: 400,
      success: false,
      message,
      errors: [{ errorCode, errorMessage: '', internalErrorCode: '' }],
    })

  // ---- Scenario 22: its own control, never a field on the form -------------
  await open('editor')
  check(
    '🚩 the mobile has its OWN control and is NOT a field on the profile form',
    (await mobileButton.count()) === 1 &&
      (await panel.locator('#loy-profile-mobile').count()) === 0 &&
      (await panel.locator('input').count()) === 10,
    `${await panel.locator('input').count()} inputs`,
  )
  check(
    'and the control is dead until a number is typed — nothing to confirm, nothing to say',
    !(await mobileButton.isEnabled()) && (await panel.getByRole('alert').count()) === 0,
  )

  // ---- Scenario 23: the screen refuses what it can see for itself ----------
  await mobileInput.fill('966555000111')
  await page.waitForTimeout(150)
  check(
    '🚩 the number the member ALREADY has is refused before any call — a no-op writes no snapshot',
    !(await mobileButton.isEnabled()) &&
      /already has/i.test(await panel.innerText()) &&
      mobileCalls === 0,
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 120),
  )
  await mobileInput.fill('+966 555 000 111')
  await page.waitForTimeout(150)
  check(
    'and said differently is still the same number — the punctuation the field tolerates is not a change',
    !(await mobileButton.isEnabled()) && mobileCalls === 0,
  )
  await mobileInput.fill('96655500011X')
  await page.waitForTimeout(150)
  check(
    '🚩 a typo cannot become a credential — a number with a letter in it is refused as its OWN problem',
    !(await mobileButton.isEnabled()) &&
      /digits only/i.test(await panel.innerText()) &&
      !/already has/i.test(await panel.innerText()) &&
      mobileCalls === 0,
    (await panel.innerText()).replace(/\s+/g, ' ').slice(0, 120),
  )

  // ---- Scenario 24: THE ticket — a collision leaves the member untouched ---
  await open('editor')
  await warmActionsCache()
  await page.evaluate(() => {
    window.__driveMark = 'alive'
  })
  mobileRefusal = mobileRefusalEnvelope(
    'LOY-00109',
    'Mobile 966555000222 belongs to member 100004411.',
  )
  await mobileInput.fill('+966 55 500-0222')
  await mobileButton.click()
  await dialog.waitFor({ timeout: 10000 })
  check(
    'the confirmation shows the change about to be made, old number and new',
    /966555000111/.test(await dialog.innerText()) && /966555000222/.test(await dialog.innerText()),
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )
  check(
    '⚠️ and says what is TRUE about verification — the number is marked verified with NO code sent',
    /no confirmation code is sent/i.test(await dialog.innerText()),
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 200),
  )
  await mobileConfirm.click()
  await dialog.getByRole('alert').waitFor({ timeout: 10000 })
  const collisionText = await dialog.innerText()
  check(
    '🚩 a COLLISION is named as itself — not as a format problem, and in the server’s own sentence too',
    /already belongs to another member/i.test(collisionText) &&
      /belongs to member 100004411/i.test(collisionText),
    collisionText.replace(/\s+/g, ' ').slice(0, 200),
  )
  check(
    '🚩 and the analyst is still in the confirmation, with the number they typed',
    (await dialog.count()) === 1 && (await mobileInput.inputValue()) === '+966 55 500-0222',
    await mobileInput.inputValue(),
  )
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  check(
    '🚩 THE ticket: the refusal changed NOTHING — the member still carries the old number',
    /966555000111/.test(await page.innerText('body')) &&
      !/966555000222/.test(await panel.innerText()) &&
      memberState.mobile === '966555000111',
    memberState.mobile,
  )
  check(
    'the Actions tab gained no row either — a refused command is not a command',
    !/mobile changed/i.test(await actionsText()) && actionRows.length === 0,
    `${actionRows.length} rows`,
  )
  await profileTab.click()
  await panel.getByText('Membership').waitFor({ timeout: 10000 })

  // ---- Scenario 25: the other two refusals, each as itself -----------------
  // 🚩 The same-number refusal is reachable even though the screen checks for it:
  // the stored number is normalised server-side and the typed one is not, so
  // `0555000111` may BE this member's number and only the door can tell.
  mobileRefusal = mobileRefusalEnvelope('LOY-00110', 'The member already uses that number.')
  await mobileInput.fill('0555000111')
  await mobileButton.click()
  await mobileConfirm.click()
  await dialog.getByRole('alert').waitFor({ timeout: 10000 })
  check(
    '🚩 a no-op the screen could NOT see is refused as itself by the door — the courtesy is not the authority',
    /already this member/i.test(await dialog.innerText()) &&
      !/another member/i.test(await dialog.innerText()),
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )
  mobileRefusal = mobileRefusalEnvelope('LOY-00111', 'Mobile 4915112345678 is not a KSA number.')
  await mobileConfirm.click()
  await page.waitForTimeout(500)
  check(
    'an invalid number is refused as a THIRD distinct problem, and nothing was written',
    /not a valid mobile number/i.test(await dialog.innerText()) &&
      /not a KSA number/i.test(await dialog.innerText()) &&
      /966555000111/.test(await page.innerText('body')),
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )
  // The fourth code the Boundaries name. It is not this command's own — it is
  // the observed `LOY-00100` every command on this screen shares — which is why
  // it is worth proving HERE too.
  mobileRefusal = mobileRefusalEnvelope('LOY-00100', 'That member could not be found.')
  await mobileConfirm.click()
  await page.waitForTimeout(500)
  check(
    'a member who no longer exists is named as itself on this command too',
    /this member no longer exists/i.test(await dialog.innerText()) &&
      /could not be found/i.test(await dialog.innerText()),
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )
  // An unrecognised code still speaks — in the server's own words (api-envelope).
  mobileRefusal = mobileRefusalEnvelope('LOY-99999', 'Something nobody has named yet.')
  await mobileConfirm.click()
  await page.waitForTimeout(500)
  check(
    '🚩 and a code the screen does not know still speaks — in the SERVER’s sentence, never a generic one',
    /something nobody has named yet/i.test(await dialog.innerText()) &&
      !/unexpected/i.test(await dialog.innerText()),
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )

  // ---- Scenario 26: the write, and the refresh with no reload --------------
  mobileRefusal = null
  await mobileConfirm.click()
  await dialog.waitFor({ state: 'detached', timeout: 15000 })
  check(
    'a retry from the same confirmation goes through with the number already typed',
    mobileBody.mobile === '0555000111' && memberState.mobile === '0555000111',
    `${mobileCalls} calls, sent ${JSON.stringify(mobileBody)}`,
  )
  check(
    '🚩 the HEADER moves with no reload — the member signs in with the new number now',
    /0555000111/.test(await page.innerText('body')) &&
      (await page.evaluate(() => window.__driveMark)) === 'alive',
  )
  check(
    'the ACTIONS tab reflects the command too — its cached page was invalidated',
    /mobile changed/i.test(await actionsText()) &&
      (await page.evaluate(() => window.__driveMark)) === 'alive',
  )
  await profileTab.click()
  await panel.getByText('Membership').waitFor({ timeout: 10000 })
  check(
    'and the field is empty again — the change is done, so there is nothing left to send',
    (await mobileInput.inputValue()) === '' && !(await mobileButton.isEnabled()),
  )

  // ---- Scenario 27: a grant refusal takes the command away -----------------
  await open('editor')
  mobileRefusal = { status: 403, contentType: 'application/json', body: '' }
  await mobileInput.fill('966555000333')
  await mobileButton.click()
  await mobileConfirm.click()
  await dialog.getByRole('alert').waitFor({ timeout: 10000 })
  check(
    '🚩 a 403 says the AUTHORITY is gone and offers no retry — it is not an outage',
    /no longer holds the authority/i.test(await dialog.innerText()),
    (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )
  mobileRefusal = null
  await mobileConfirm.click({ force: true })
  await page.waitForTimeout(400)
  check(
    '🚩 and the command goes DEAD — a grant refusal takes the button away, not just the words',
    (await mobileConfirm.getAttribute('aria-disabled')) === 'true' && mobileCalls === 1,
    `${mobileCalls} mobile calls`,
  )

  // ---- Scenario 28: the in-flight guard, and who it does NOT touch ---------
  await open('editor')
  mobileDelay = 700
  await mobileInput.fill('966555000444')
  await mobileButton.click()
  await dialog.waitFor({ timeout: 10000 })
  // 🚩 Two clicks, deliberately — ticket 303's scenario 7, on this command.
  // There is no server-side idempotency anywhere in the module, so a second write
  // is a second **member update snapshot** and a second trail row.
  await mobileConfirm.click()
  await page.waitForTimeout(120)
  const mobileDisabledInFlight = (await mobileConfirm.getAttribute('aria-disabled')) === 'true'
  const statusArmedInFlight = await statusButton.isEnabled()
  await mobileConfirm.click({ force: true })
  await dialog.waitFor({ state: 'detached', timeout: 15000 })
  check('🚩 the control disables itself while the write is in flight', mobileDisabledInFlight)
  check(
    '🚩 and a double-click writes exactly ONE mobile change — the client is the only guard there is',
    mobileCalls === 1,
    `${mobileCalls} mobile calls`,
  )
  check(
    'and the Status command was never disabled by it — they are unrelated writes',
    statusArmedInFlight,
  )

  // ---- Scenario 29: none of this reaches a reader --------------------------
  await open('lookOnly')
  check(
    '🚩 a look-only session has no mobile control at all — the number is a fact they read',
    (await mobileButton.count()) === 0 && (await mobileInput.count()) === 0,
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
