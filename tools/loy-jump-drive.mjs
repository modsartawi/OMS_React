// Loy jump drive (ticket 427) — the app-wide palette's *Open loyalty member N* row,
// driven in Chromium against MOCKED envelopes (`LoyWeb/*`, `SdDocumentWeb/Access`).
// 🚩 NOTHING here is driven against a live SIS.Api — the `LoyWeb` door is the same
// stubbed contract `loy-member-drive.mjs` asserts.
//
// It verifies ticket 427's drive Proof bullet:
//   1. a Loy-only session: a pasted mobile yields ONLY the member row, aimed; Enter
//      resolves it in one call and lands on the profile, with the bar AS TYPED, and
//      🚩 the mobile never reaches the URL and the entry keeps no lookup;
//   2. a jump made ON a profile still runs: a Loy ID cascades (LOY-00100 on mobile)
//      and switches member;
//   3. 🚩 a reload and a Back after a jump never re-run the lookup;
//   4. a double miss shows the field's own sentence, the box holding what was typed;
//   5. an Arabic layout's digits resolve;
//   6. both grants: delivery, document, then the member — delivery aimed;
//   7. 🚩 a denied Loy probe offers no member row; words never offer one.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/loy-jump-drive.mjs
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
const notFound = (message) =>
  envelope(null, {
    status: 400,
    success: false,
    message,
    errors: [{ errorCode: 'LOY-00100', errorMessage: message, internalErrorCode: '' }],
  })

const member = (loyId, mobile, fullName) => ({
  loyId,
  mobileCountry: 'SA',
  mobile,
  fullName,
  birthDate: '1990-11-08T00:00:00',
  gender: 'F',
  email: null,
  nationality: 'SA',
  nationalId: null,
  insuranceCompany: null,
  cityCode: 'RUH',
  preferredLanguage: 'AR',
  joinDate: '2021-03-14T00:00:00',
  lastUpdate: '2026-07-31T09:12:00',
  tier: 'G',
  tierPointsBalance: 0,
  pendingPoints: 0,
  pointsBalance: 0,
  pointsBalanceAmount: 0,
  pointsBalanceAmountCurrency: 'SAR',
  pointsExpireSoon: 0,
  memberType: 'M',
  blockedReason: null,
  isBlocked: false,
  isArchived: false,
})
const MOBILE_KEY = '966555000111'
const MEMBER_1 = member('100001293', MOBILE_KEY, 'Nouf Al-Harbi')
const LOYID_2 = '100002468'
const MEMBER_2 = member(LOYID_2, '966555000222', 'Faisal Al-Qahtani')

let grants = { loy: true, detail: false }
let calls = []
let slowMobile = false

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
  })

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'LoyWeb/Access') return route.fulfill(envelope({ canOpenLoyMember: grants.loy }))
    if (path === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: grants.detail, canOpenDetail: grants.detail }))
    if (path.startsWith('LoyWeb/MemberByMobile/')) {
      const key = decodeURIComponent(path.split('LoyWeb/MemberByMobile/')[1] || '')
      calls.push(`byMobile:${key}`)
      if (slowMobile && key === MOBILE_KEY) await new Promise((r) => setTimeout(r, 1500))
      if (key === MOBILE_KEY) return route.fulfill(envelope(MEMBER_1))
      return route.fulfill(notFound(`Customer with ${key} doesn't exists`))
    }
    if (path.startsWith('LoyWeb/Member/')) {
      const key = decodeURIComponent(path.split('LoyWeb/Member/')[1] || '')
      calls.push(`byLoyId:${key}`)
      if (key === MEMBER_1.loyId) return route.fulfill(envelope(MEMBER_1))
      if (key === LOYID_2) return route.fulfill(envelope(MEMBER_2))
      return route.fulfill(notFound(`Customer ${key} doesn't exists`))
    }
    if (path.startsWith('LoyWeb/Reports/LoyMemberActions'))
      return route.fulfill(envelope({ items: [], recordsCount: 0, page: 1, pageSize: 25 }))
    if (path.startsWith('LoyWeb/Reports/')) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const input = page.locator('[data-palette-input]')
  /** Ctrl+K, type, and report the Jump rows shown and the aimed row. */
  const ask = async (query) => {
    await page.locator('body').click({ position: { x: 5, y: 600 } })
    await page.keyboard.press('Control+k')
    await input.waitFor({ timeout: 5000 })
    await input.fill(query)
    await page.waitForTimeout(150)
    const rows = await page.$$eval('[data-palette-row]', (els) => els.map((e) => e.dataset.paletteRow))
    const aimed = await page.$$eval('[data-palette-aimed]', (els) => els.map((e) => e.dataset.paletteAimed)[0] ?? null)
    return { jump: rows.filter((r) => r.startsWith('jump:')), aimed }
  }
  const usrState = () => page.evaluate(() => window.history.state?.usr ?? null)
  const field = page.getByLabel('Look up a loyalty member', { exact: true })

  // ---- 1: Loy-only, a pasted mobile ------------------------------------------
  grants = { loy: true, detail: false }
  await page.goto(BASE + '/')
  await page.waitForLoadState('networkidle')
  let shown = await ask('+966 55 500 0111')
  check('a pasted mobile yields ONLY the member row', JSON.stringify(shown.jump) === '["jump:member"]', shown.jump.join())
  check('and it is the aimed row', shown.aimed === 'jump:member', String(shown.aimed))
  const value = await page.$eval('[data-palette-row="jump:member"] [data-palette-value]', (el) => ({
    text: el.textContent,
    isolated: !!el.querySelector('bdi[dir="ltr"]'),
  }))
  check('the row shows the key as typed, isolated', value.text === '+966 55 500 0111' && value.isolated, JSON.stringify(value))
  calls = []
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/loy\/members\/100001293$/, { timeout: 10000 })
  await page.getByText('Nouf Al-Harbi').first().waitFor({ timeout: 10000 })
  // The route's own background re-read by Loy ID follows (233: the seeded cache, then a
  // re-read); what must not happen is a second mobile lookup or a cascade to the Loy ID.
  check('🚩 a mobile resolves in ONE lookup call, compacted', calls[0] === `byMobile:${MOBILE_KEY}` && calls.filter((c) => c.startsWith('byMobile')).length === 1 && !calls.includes(`byLoyId:${MOBILE_KEY}`), calls.join())
  check('🚩 the mobile never reaches the URL', !/966|555/.test(new URL(page.url()).pathname.replace('100001293', '') + new URL(page.url()).search), page.url())
  check('the bar carries the searched key AS TYPED', /\+966 55 500 0111/.test(await page.textContent('body')))
  check('the profile entry keeps no lookup', (await usrState())?.lookup === undefined, JSON.stringify(await usrState()))

  // ---- 2: a jump ON a profile switches member (Loy ID cascade) -----------------
  shown = await ask(LOYID_2)
  check('a bare Loy ID, Loy-only: the member row alone', JSON.stringify(shown.jump) === '["jump:member"]', shown.jump.join())
  calls = []
  await page.keyboard.press('Enter')
  await page.waitForURL(new RegExp(`/loy/members/${LOYID_2}$`), { timeout: 10000 })
  await page.getByText('Faisal Al-Qahtani').first().waitFor({ timeout: 10000 })
  check('a Loy ID cascades: mobile misses, then the Loy ID', calls[0] === `byMobile:${LOYID_2}` && calls[1] === `byLoyId:${LOYID_2}`, calls.join())
  check('the jump ran although the page was already mounted on a profile', (await page.getByText('Nouf Al-Harbi').count()) === 0)

  // ---- 3: reload and Back never re-run ----------------------------------------
  calls = []
  await page.reload()
  await page.getByText('Faisal Al-Qahtani').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  check('🚩 a reload reads by Loy ID and never re-runs the lookup', !calls.some((c) => c.startsWith('byMobile')), calls.join())
  calls = []
  await page.goBack()
  await page.waitForTimeout(800)
  check('🚩 Back never re-runs a lookup', !calls.some((c) => c.startsWith('byMobile')), `${page.url()} ${calls.join()}`)
  check('Back returns to where the jump began — the previous member, not a bare field', /\/loy\/members\/100001293$/.test(page.url()) && (await usrState())?.lookup === undefined, page.url())
  calls = []
  await page.goBack()
  await page.waitForTimeout(800)
  check('and once more to the screen the first jump was made from', new URL(page.url()).pathname === '/', `${page.url()} ${calls.join()}`)
  check('🚩 still no lookup re-run', !calls.some((c) => c.startsWith('byMobile')), calls.join())
  await page.goto(BASE + '/loy/members')
  await field.waitFor({ timeout: 10000 })

  // ---- 4: a double miss --------------------------------------------------------
  await ask('0555000999')
  calls = []
  await page.keyboard.press('Enter')
  await page.getByText(/No member matches/).waitFor({ timeout: 10000 })
  check('a double miss tried both keys', calls.join() === 'byMobile:0555000999,byLoyId:0555000999', calls.join())
  check('the box holds what was typed', (await field.inputValue()) === '0555000999', await field.inputValue())
  check('a miss stays on the lookup route', /\/loy\/members$/.test(page.url()), page.url())

  // ---- 5: Arabic digits --------------------------------------------------------
  shown = await ask('٩٦٦٥٥٥٠٠٠١١١')
  check('an Arabic layout’s number offers the member row', JSON.stringify(shown.jump) === '["jump:member"]', shown.jump.join())
  calls = []
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/loy\/members\/100001293$/, { timeout: 10000 })
  check('and resolves on ASCII digits', calls[0] === `byMobile:${MOBILE_KEY}`, calls.join())

  // ---- 5b: 🚩 a jump made while a lookup is in flight wins -----------------------
  await page.goto(BASE + '/loy/members')
  await field.waitFor({ timeout: 10000 })
  slowMobile = true
  await field.fill('+966 55 500 0111')
  await page.getByRole('button', { name: /^Look up$/ }).click()
  await ask(LOYID_2)
  await page.keyboard.press('Enter')
  await page.waitForURL(new RegExp(`/loy/members/${LOYID_2}$`), { timeout: 10000 })
  await page.waitForTimeout(2500) // past the slow lookup's answer
  slowMobile = false
  check('🚩 the slower, earlier lookup never takes the agent back to its member', new RegExp(`/loy/members/${LOYID_2}$`).test(page.url()) && (await page.getByText('Nouf Al-Harbi').count()) === 0, page.url())

  // ---- 6: both grants ----------------------------------------------------------
  grants = { loy: true, detail: true }
  await page.goto(BASE + '/')
  await page.waitForLoadState('networkidle')
  shown = await ask('80001237')
  check('both grants: delivery, document, then the member', JSON.stringify(shown.jump) === '["jump:delivery","jump:document","jump:member"]', shown.jump.join())
  check('🚩 delivery keeps Enter', shown.aimed === 'jump:delivery', String(shown.aimed))
  shown = await ask('+966 55 500 0111')
  check('a pasted mobile still offers only the member row', JSON.stringify(shown.jump) === '["jump:member"]', shown.jump.join())

  // ---- 7: denied, and words ----------------------------------------------------
  grants = { loy: false, detail: true }
  await page.goto(BASE + '/')
  await page.waitForLoadState('networkidle')
  shown = await ask('80001237')
  check('🚩 a denied Loy probe offers no member row', JSON.stringify(shown.jump) === '["jump:delivery","jump:document"]', shown.jump.join())
  grants = { loy: true, detail: true }
  await page.goto(BASE + '/')
  await page.waitForLoadState('networkidle')
  shown = await ask('members')
  check('words never offer a member row', !shown.jump.includes('jump:member'), shown.jump.join())

  check('no script errors', errors.length === 0, errors.join(' | '))
  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
