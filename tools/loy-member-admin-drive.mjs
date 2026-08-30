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

let scenario = { access: 'lookOnly', memberOver: {} }
let accessCalls = 0

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

    if (path.startsWith('LoyWeb/Member/')) {
      return route.fulfill(envelope({ ...MEMBER, ...scenario.memberOver }))
    }

    // The three report tabs are not this ticket's subject; they answer empty so
    // nothing beside the Profile tab can fail the drive.
    if (path.startsWith('LoyWeb/Reports/LoyMemberActions'))
      return route.fulfill(
        envelope({
          records: [],
          currentPage: 1,
          pageSize: 25,
          pageRecordsCount: 0,
          totalPages: 1,
          recordsCount: 0,
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
    (await panel.locator('input').count()) === 9,
    `${await panel.locator('input').count()} inputs`,
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
    removerText.includes('remove email') && (await panel.locator('input').count()) === 9,
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
