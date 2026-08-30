// Loy Profile tab SHOTS (tickets 302–304, spec 301) — the real app in Chromium
// against MOCKED `LoyWeb/*` envelopes, captured rather than asserted.
//
// ⚠ Its sibling `tools/loy-member-admin-drive.mjs` is the one that PROVES things
// (80 checks). This one proves nothing: it exists because the `LoyWeb` door does
// not, so `npm run dev` renders a member screen that can never load a member,
// and stubbing at Playwright is the only way to look at the finished screen.
// 🚩 Nothing here has met a live SIS.Api.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/loy-profile-shots.mjs
//   3. images land in .issues/assets/304-profile-form/
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const OUT = '.issues/assets/304-profile-form'
mkdirSync(OUT, { recursive: true })

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const refusalEnvelope = (errorCode, message) =>
  envelope(null, {
    status: 400,
    success: false,
    message,
    errors: [{ errorCode, errorMessage: '', internalErrorCode: '' }],
  })

const LOYID = '100001293'

// 🚩 A **sparse** member: no gender, no preferred language, no insurance
// company. The one the ticket is about — an analyst correcting the misspelt
// name must not be made to invent a fact about her.
const MEMBER = {
  loyId: LOYID,
  mobileCountry: 'SA',
  mobile: '966555000111',
  fullName: 'Nouf Al-Harbe',
  birthDate: '1990-11-08T00:00:00',
  gender: null,
  email: 'nouf.h@example.com',
  nationality: 'SA',
  nationalId: '1098443217',
  insuranceCompany: null,
  cityCode: 'RUH',
  preferredLanguage: null,
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

const SESSIONS = {
  lookOnly: { canOpenLoyMember: true, canEditLoyMember: false, canRemoveLoyMemberMobile: false },
  editor: { canOpenLoyMember: true, canEditLoyMember: true, canRemoveLoyMemberMobile: false },
}

let access = 'editor'
let memberState = { ...MEMBER }
let actionRows = []
let profileRefusal = null

const trailRow = (data) => ({
  actionNo: String(900 + actionRows.length),
  mainActionType: 'UPD',
  mainActionDescription: 'Member updated',
  subActionType: null,
  subActionDescription: null,
  actionDateTime: '2026-08-30T11:04:00',
  actionData: data,
  actionData2: null,
  userId: 'msartawi',
  branchId: '1001',
})

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } })

  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'LoyWeb/Access') return route.fulfill(envelope(SESSIONS[access]))

    if (/^LoyWeb\/Member\/[^/]+\/Profile$/.test(path)) {
      if (profileRefusal) return route.fulfill(profileRefusal)
      const body = route.request().postDataJSON()
      memberState = {
        ...memberState,
        fullName: body.fullName,
        email: body.email,
        birthDate: body.birthDate ? `${body.birthDate}T00:00:00` : '0001-01-01T00:00:00',
        gender: body.gender,
        nationality: body.nationality,
        nationalId: body.nationalId,
        cityCode: body.cityCode,
        preferredLanguage: body.preferredLanguage,
        insuranceCompany: body.insuranceCompany,
        lastUpdate: '2026-08-30T11:04:00',
      }
      actionRows = [trailRow('profile'), ...actionRows]
      return route.fulfill(envelope(null))
    }

    if (path.startsWith('LoyWeb/Member/')) return route.fulfill(envelope(memberState))
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
  const saveButton = page.locator('[data-testid="loy-profile-save"]')
  const field = (name) => page.locator(`#loy-profile-${name}`)

  let n = 0
  const shot = async (name, note) => {
    n += 1
    const file = `${OUT}/${String(n).padStart(2, '0')}-${name}.png`
    await page.screenshot({ path: file })
    console.log(`${file} — ${note}`)
  }

  const open = async (who) => {
    access = who
    memberState = { ...MEMBER }
    actionRows = []
    profileRefusal = null
    await page.goto(`${BASE}/loy/members/${LOYID}?tab=profile`)
    await panel.getByText('Membership').waitFor({ timeout: 15000 })
  }

  // 1 — a session that may only LOOK. No control at all, not even a disabled
  //     one, and no apology for what it cannot do.
  await open('lookOnly')
  await shot('look-only', 'may look: a read-only field list, no controls anywhere')

  // 2 — an EDITOR on the same sparse member, untouched. Save and Discard dead.
  await open('editor')
  await shot('editor-untouched', 'may edit: Save dead until something changes')

  // 3 — two real edits. The changed fields are marked BEFORE anything is sent.
  await field('fullName').fill('Nouf Al-Harbi')
  await field('cityCode').fill('JED')
  await page.waitForFunction(() => /2 fields changed/i.test(document.body.innerText), null, {
    timeout: 10000,
  })
  await shot('changed-marked', 'two fields changed, each marked, Save armed')

  // 4 — a shape failure, named against the field that caused it.
  await field('email').fill('not-an-address')
  await saveButton.click()
  await panel.getByText(/does not look like an email/i).waitFor({ timeout: 10000 })
  await shot('field-named', 'a shape failure names the FIELD, and nothing is sent')

  // 5 — the door refuses the city. The screen's wording AND the server's
  //     sentence, and every edit still exactly where it was typed.
  await field('email').fill('nouf.new@example.com')
  profileRefusal = refusalEnvelope('LOY-00107', 'City JED is not a known city.')
  await saveButton.click()
  await panel.getByRole('alert').waitFor({ timeout: 10000 })
  await shot('refusal-keeps-edits', 'a refused save costs a retry, never the typing')

  // 6 — the stale-write guard: the member moved underneath the form.
  profileRefusal = refusalEnvelope('LOY-00108', 'The member has changed since you loaded it.')
  await field('cityCode').fill('RUH')
  await saveButton.click()
  await panel.getByText(/changed while you had the form open/i).waitFor({ timeout: 10000 })
  await shot('stale-offers-reload', 'the member changed: a reload, never a retry')

  // 7 — the save that works. 🚩 The gender and the preferred language were never
  //     recorded and are still not: the body carried null for both.
  profileRefusal = null
  await saveButton.click()
  await page.waitForFunction(() => /profile was updated/i.test(document.body.innerText), null, {
    timeout: 15000,
  })
  await shot('saved', 'saved with gender and preferred language still blank')

  // 8 — where the command becomes visible to everyone else.
  await page.getByRole('tab', { name: 'Actions' }).click()
  await panel.getByText(/member updated/i).waitFor({ timeout: 10000 })
  await shot('actions-trail', 'the Actions trail, refreshed with no reload')

  await browser.close()
  console.log(`\n${n} shots in ${OUT}`)
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
