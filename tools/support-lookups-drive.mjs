// Support look-ups drive (spec 2737, ticket 519): Campaigns ▸ Coupon finder and Campaigns ▸ Customers.
//
// Drives the REAL app in Chromium against STUBS. No HQ contract exists yet (BackOffice 2754 and 2744
// name no door for these), so the stubs serve the PROVISIONAL shapes of
// `src/core/models/rule-campaign.ts` on the REAL envelope { statusCode, success, message, errors:
// [{ errorCode, internalErrorCode, errorMessage }], data }; ticket 520 re-points them:
//   GET RuleCampaign/Coupons/{code}            → one code found; an unknown code is refused (404)
//   GET RuleCampaign/Members?loyaltyId=|mobile= → the members matching the key (none, one, several)
//   GET RuleCampaign/Members/{id}/Wallet       → the member's coupon wallet (per run: rows, or a refusal)
//   GET RuleCampaign/Members/{id}/Budgets      → the profile-scope budgets the member has used
// Never a live SIS.Api.
//
// It asserts:
//   1. the Campaigns group has Coupon finder and Customers leaves, ungated, each lighting itself;
//   2. the finder asks nothing until a code is entered;
//   3. a code reads its campaign (code + EN + AR names, linking to its coupons), batch, kind, status,
//      local validity and its bound member; the code is kept in the address;
//   4. its uses: when (local), store, and the sale id linking to Sessions;
//   5. an unbound, unused code reads "Anyone" and no uses; validity with no bounds reads so;
//   6. an unknown code reads as no such code (not as a failure), with HQ's sentence under it;
//   7. the bound member links to Customers, which finds them by loyalty id;
//   8. Customers: the member's facts and points balance — spend vs tier, pending;
//   9. the wallet: each code (linking back to the finder) and its campaign in EN + AR, local validity;
//  10. budgets used: used / limit per period, used up, an overshoot named, BHD at three decimals;
//  11. a mobile shared by several members lists them; picking one looks it up by loyalty id;
//  12. a mobile no member has says so;
//  13. a wallet door that fails says so on its own, and the budgets still read;
//  14. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/support-lookups-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
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

const says = (en, ar) => ({ en, ar })
const WKND = says('Weekend coupon: 20% off', 'قسيمة نهاية الأسبوع: خصم 20%')
const NEXT = says('A coupon for next time', 'قسيمة للزيارة القادمة')
const GP = says('Gold & Platinum: 15% off Beauty', 'الذهبي والبلاتيني: خصم 15% على التجميل')
const WLCB = says('Welcome bonus', 'مكافأة الترحيب')
const BH = says('Bahrain spend and save', 'أنفق ووفر في البحرين')

const NOT_FOUND = 'No campaign coupon has this code.'
const WALLET_DOWN = 'SIS.Coupons did not answer.'

const COUPONS = {
  'WKND-9XH3PL': {
    code: 'WKND-9XH3PL', campaignId: 'WKND20', campaignCode: 'WKND20', campaignName: WKND, batch: 'B-20261001-01', kind: 'personal', status: 'used',
    from: '2026-10-01', until: '2026-10-31', member: 'M-100231',
    uses: [
      { at: '2026-10-16T10:03:20', store: 'R101', saleId: 'R101-2026-1016-0042' },
      { at: '2026-10-17T19:45:00', store: 'R205', saleId: 'R205-2026-1017-0311' },
    ],
  },
  'WKND-4F7K2Q': {
    code: 'WKND-4F7K2Q', campaignId: 'WKND20', campaignCode: 'WKND20', campaignName: WKND, batch: 'B-20261001-02', kind: 'random', status: 'unused',
    from: null, until: null, member: null, uses: [],
  },
}

const M = (id, name, mobile, o = {}) => ({ id, name, mobile, tier: 'Gold', points: { spend: 0, tier: 0, pending: 0 }, ...o })
const NOURA = M('M-100231', 'Noura Al-Qahtani', '0551234567', { points: { spend: 48.2, tier: 1260, pending: 35 } })
const MEMBERS = [
  NOURA,
  M('M-208877', 'Fahad Al-Harbi', '0559998888', { tier: null }),
  M('M-208878', 'Sara Al-Harbi', '0559998888', { tier: 'Silver' }),
]
const WALLETS = {
  'M-100231': [
    { code: 'WKND-T2M8VA', campaignId: 'WKND20', campaignCode: 'WKND20', campaignName: WKND, from: '2026-10-01', until: '2026-10-31' },
    { code: 'NV-7KQ2', campaignId: 'NEXT-VISIT', campaignCode: 'NEXT-VISIT', campaignName: NEXT, from: null, until: '2026-10-30' },
  ],
}
const MB = (campaignId, campaignName, budgetId, name, limit, value, period, used, currency = 'SAR') => ({
  campaignId, campaignCode: campaignId, campaignName, budgetId, name, limit, value, period, used, currency,
})
const BUDGETS = {
  'M-100231': [
    MB('GP-BEAUTY15', GP, 'b1', 'twice a month per member', 'uses', 2, 'month', 1),
    MB('WLCB', WLCB, 'b2', 'once per member, ever', 'uses', 1, 'lifetime', 1),
    MB('WKND20', WKND, 'b3', 'SAR 100 per member a year', 'money', 100, 'year', 112.5),
    MB('BH-SAVE', BH, 'b4', 'BHD 5 a week', 'money', 5, 'week', 1.25, 'BHD'),
  ],
}

const browser = await chromium.launch()

async function open({ wallet = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.clock.setFixedTime(new Date('2026-10-17T18:30:00+03:00'))
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
    const coupon = /^RuleCampaign\/Coupons\/([^/]+)$/.exec(p)
    if (coupon && req.method() === 'GET') {
      const c = COUPONS[coupon[1]]
      return route.fulfill(c ? envelope(c) : envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_COUPON_NOT_FOUND' }))
    }
    if (p === 'RuleCampaign/Members' && req.method() === 'GET') {
      const id = url.searchParams.get('loyaltyId')
      const mobile = url.searchParams.get('mobile')
      return route.fulfill(envelope(MEMBERS.filter((m) => (id ? m.id === id : m.mobile === mobile))))
    }
    const wal = /^RuleCampaign\/Members\/([^/]+)\/Wallet$/.exec(p)
    if (wal) {
      if (wallet === 'fails') return route.fulfill(envelope(null, { status: 502, success: false, message: WALLET_DOWN, errorCode: 'COUPONS_UNAVAILABLE' }))
      return route.fulfill(envelope(WALLETS[wal[1]] ?? []))
    }
    const bud = /^RuleCampaign\/Members\/([^/]+)\/Budgets$/.exec(p)
    if (bud) return route.fulfill(envelope(BUDGETS[bud[1]] ?? []))
    if (/^RuleCampaign\/Sessions\//.test(p)) return route.fulfill(envelope(null, { status: 404, success: false, message: 'No customer session has this sale id.', errorCode: 'RULE_SESSION_NOT_FOUND' }))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const text = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim()
const fact = (page, k) => text(page.locator(`[data-finder-fact="${k}"] dd`))
const memberFact = (page, k) => text(page.locator(`[data-member-fact="${k}"] dd`))
const gridRows = (page, grid) => page.$$eval(`[${grid}] .ag-row[row-index]`, (rows) =>
  rows
    .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
    .map((r) => [...r.querySelectorAll('.ag-cell')].map((c) => c.innerText.replace(/\s+/g, ' ').trim())),
)

{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/`)

  // ── 1 ──
  const finderLeaf = page.locator('a[href="/campaigns/coupon-finder"]').first()
  const customersLeaf = page.locator('a[href="/campaigns/customers"]').first()
  await finderLeaf.waitFor({ timeout: 15000 })
  check('1: the Coupon finder and Customers leaves are in the rail', (await finderLeaf.isVisible()) && (await customersLeaf.isVisible()))
  check('1: …labelled', (await text(finderLeaf)) === 'Coupon finder' && (await text(customersLeaf)) === 'Customers', `${await text(finderLeaf)} | ${await text(customersLeaf)}`)
  await finderLeaf.click()
  await page.waitForURL(`${BASE}/campaigns/coupon-finder`)
  await page.locator('[data-coupon-finder]').waitFor({ timeout: 10000 })
  check('1: the finder lights its own leaf', (await finderLeaf.getAttribute('aria-current')) === 'page' && (await page.locator('a[href="/campaigns"][aria-current="page"]').count()) === 0)

  // ── 2 ──
  check('2: nothing is asked until a code is entered', (await page.locator('[data-finder-empty]').isVisible()) && !calls.some((c) => c.includes('RuleCampaign/Coupons')))

  // ── 3 ──
  await page.locator('[data-finder-code]').fill('  WKND-9XH3PL ')
  await page.locator('[data-finder-find]').click()
  await page.locator('[data-finder-result="WKND-9XH3PL"]').waitFor({ timeout: 10000 })
  check('3: the code is looked up trimmed, and kept in the address', calls.includes('GET RuleCampaign/Coupons/WKND-9XH3PL') && page.url() === `${BASE}/campaigns/coupon-finder?code=WKND-9XH3PL`, page.url())
  check('3: its status', (await page.locator('[data-finder-status]').getAttribute('data-finder-status')) === 'used' && /Used/.test(await text(page.locator('[data-finder-status]'))))
  const campaign = page.locator('[data-finder-fact="campaign"]')
  check('3: its campaign — code, then the name in EN and AR', (await text(campaign.locator('[data-finder-campaign]'))) === 'WKND20' &&
    (await campaign.locator('[data-says-en]').innerText()) === WKND.en && (await campaign.locator('[data-says-ar]').innerText()) === WKND.ar)
  check('3: …the campaign links to its coupons page', (await campaign.locator('a').getAttribute('href')) === '/campaigns/WKND20/coupons')
  check('3: batch and kind', (await fact(page, 'batch')) === 'B-20261001-01' && (await fact(page, 'kind')) === 'Personal')
  check('3: validity as local days', (await fact(page, 'from')) === '2026-10-01' && (await fact(page, 'until')) === '2026-10-31')
  check('3: the member it is bound to', (await fact(page, 'member')) === 'M-100231')

  // ── 4 ──
  check('4: its uses are counted', /^2 uses$/.test(await text(page.locator('[data-finder-uses] h3'))), await text(page.locator('[data-finder-uses] h3')))
  await page.locator('[data-finder-uses-grid] .ag-row').first().waitFor({ timeout: 10000 })
  const uses = await gridRows(page, 'data-finder-uses-grid')
  check('4: each use — when (local), store, sale id', JSON.stringify(uses) === JSON.stringify([
    ['2026-10-16 10:03', 'R101', 'R101-2026-1016-0042'],
    ['2026-10-17 19:45', 'R205', 'R205-2026-1017-0311'],
  ]), JSON.stringify(uses))
  await page.screenshot({ path: `${SHOTS}/519-finder.png`, fullPage: true })
  await page.locator('[data-finder-sale="R101-2026-1016-0042"]').click()
  await page.waitForURL(`${BASE}/campaigns/sessions/R101-2026-1016-0042`)
  check('4: a sale id opens its customer session', true)
  await page.goBack()
  await page.locator('[data-finder-result="WKND-9XH3PL"]').waitFor({ timeout: 10000 })
  check('4: …and Back lands on the code, the box refilled', (await page.locator('[data-finder-code]').inputValue()) === 'WKND-9XH3PL')

  // ── 5 ──
  const asked = () => calls.filter((c) => c === 'GET RuleCampaign/Coupons/WKND-9XH3PL').length
  const before = asked()
  await page.locator('[data-finder-find]').click()
  for (let i = 0; i < 30 && asked() === before; i++) await page.waitForTimeout(100)
  check('4: Find on the same code reads it afresh', asked() === before + 1)
  await page.locator('[data-finder-code]').fill('wknd-4f7k 2q')
  await page.locator('[data-finder-code]').press('Enter')
  await page.locator('[data-finder-result="WKND-4F7K2Q"]').waitFor({ timeout: 10000 })
  check('5: a code typed lower-case or with a space is asked as it is kept', calls.includes('GET RuleCampaign/Coupons/WKND-4F7K2Q'))
  check('5: an unbound code is for anyone', (await fact(page, 'member')) === 'Anyone (not bound)')
  check('5: no bounds of its own read so', (await fact(page, 'from')) === 'At once' && (await fact(page, 'until')) === 'No end of its own')
  check('5: an unused code has no uses', (await page.locator('[data-finder-unused]').isVisible()) && /^0 uses$/.test(await text(page.locator('[data-finder-uses] h3'))))

  // ── 6 ──
  await page.locator('[data-finder-code]').fill('NOPE-000')
  await page.locator('[data-finder-find]').click()
  await page.locator('[data-finder-none]').waitFor({ timeout: 10000 })
  check('6: an unknown code reads as no such code, not a failure', (await text(page.locator('[data-finder-none]'))).startsWith('No coupon has the code NOPE-000.') && (await page.locator('[data-finder-refusal]').count()) === 0)
  check('6: …with HQ\'s sentence under it', (await text(page.locator('[data-finder-none]'))).includes(NOT_FOUND))

  // ── 7 ──
  await page.goto(`${BASE}/campaigns/coupon-finder?code=WKND-9XH3PL`)
  await page.locator('[data-finder-member="M-100231"]').click()
  await page.waitForURL(`${BASE}/campaigns/customers?loyaltyId=M-100231`)
  await page.locator('[data-member="M-100231"]').waitFor({ timeout: 10000 })
  check('7: the bound member opens in Customers, found by loyalty id', calls.includes('GET RuleCampaign/Members?loyaltyId=M-100231'))
  check('7: Customers lights its own leaf', (await customersLeaf.getAttribute('aria-current')) === 'page')

  // ── 8 ──
  check('8: the member — name, loyalty id, mobile, tier', (await text(page.locator('[data-member-name]'))) === 'Noura Al-Qahtani' &&
    (await memberFact(page, 'loyaltyId')) === 'M-100231' && (await memberFact(page, 'mobile')) === '0551234567' && (await memberFact(page, 'tier')) === 'Gold')
  const point = (k) => text(page.locator(`[data-member-point="${k}"] dd`))
  check('8: the points balance — spend vs tier, and pending', (await point('spend')) === '48.2' && (await point('tier')) === '1260' && (await point('pending')) === '35',
    `${await point('spend')} | ${await point('tier')} | ${await point('pending')}`)

  // ── 9 ──
  await page.locator('[data-wallet-grid] .ag-row').first().waitFor({ timeout: 10000 })
  check('9: the wallet counts its codes', (await page.locator('[data-member-wallet]').getAttribute('data-member-wallet')) === '2')
  const wallet = await gridRows(page, 'data-wallet-grid')
  check('9: each code, its campaign in EN + AR, its local validity', JSON.stringify(wallet) === JSON.stringify([
    ['WKND-T2M8VA', `WKND20 ${WKND.en} ${WKND.ar}`, '2026-10-01', '2026-10-31'],
    ['NV-7KQ2', `NEXT-VISIT ${NEXT.en} ${NEXT.ar}`, 'At once', '2026-10-30'],
  ]), JSON.stringify(wallet))

  // ── 10 ──
  await page.locator('[data-budgets-grid] .ag-row').first().waitFor({ timeout: 10000 })
  const budgets = await gridRows(page, 'data-budgets-grid')
  check('10: budgets used — used / limit per period', JSON.stringify(budgets.map((r) => [r[1], r[2], r[3]])) === JSON.stringify([
    ['twice a month per member', '1 / 2', 'This month'],
    ['once per member, ever', '1 / 1', 'Ever'],
    ['SAR 100 per member a year', 'SAR 112.50 / SAR 100.00 Over by SAR 12.50', 'This year'],
    ['BHD 5 a week', 'BHD 1.250 / BHD 5.000', 'This week'],
  ]), JSON.stringify(budgets))
  check('10: …each budget\'s campaign in EN + AR', budgets[0][0] === `GP-BEAUTY15 ${GP.en} ${GP.ar}`, budgets[0][0])
  check('10: used up at and past the limit, available below it', JSON.stringify(budgets.map((r) => r[4])) === JSON.stringify(['Available', 'Used up', 'Used up', 'Available']), JSON.stringify(budgets.map((r) => r[4])))
  await page.screenshot({ path: `${SHOTS}/519-customer.png`, fullPage: true })

  await page.locator('[data-wallet-code="NV-7KQ2"]').click()
  await page.waitForURL(`${BASE}/campaigns/coupon-finder?code=NV-7KQ2`)
  await page.locator('[data-finder-refusal], [data-finder-none], [data-finder-result]').first().waitFor({ timeout: 10000 })
  check('9: a wallet code opens in the finder', calls.includes('GET RuleCampaign/Coupons/NV-7KQ2'))

  // ── 11 ──
  await page.goto(`${BASE}/campaigns/customers`)
  await page.locator('[data-customers-empty]').waitFor({ timeout: 10000 })
  check('11: Customers asks nothing until a key is entered', !calls.some((c) => c.startsWith('GET RuleCampaign/Members?mobile')))
  await page.locator('[data-customers-by]').selectOption('mobile')
  await page.locator('[data-customers-value]').fill('0559998888')
  await page.locator('[data-customers-find]').click()
  await page.locator('[data-customers-several]').waitFor({ timeout: 10000 })
  check('11: a mobile is asked by mobile, kept in the address', calls.includes('GET RuleCampaign/Members?mobile=0559998888') && page.url().endsWith('/campaigns/customers?mobile=0559998888'))
  check('11: a mobile shared by several lists them', (await page.locator('[data-customers-pick]').count()) === 2 &&
    /Fahad Al-Harbi\s*M-208877 · 0559998888/.test(await text(page.locator('[data-customers-pick="M-208877"]'))), await text(page.locator('[data-customers-pick="M-208877"]')))
  await page.locator('[data-customers-pick="M-208878"]').click()
  await page.locator('[data-member="M-208878"]').waitFor({ timeout: 10000 })
  check('11: picking one looks it up by loyalty id', page.url().endsWith('/campaigns/customers?loyaltyId=M-208878') && (await memberFact(page, 'tier')) === 'Silver')
  await page.locator('[data-wallet-empty]').waitFor({ timeout: 10000 })
  await page.locator('[data-budgets-empty]').waitFor({ timeout: 10000 })
  check('11: an empty wallet and no budgets used say so', true)
  await page.goBack()
  await page.locator('[data-customers-several]').waitFor({ timeout: 10000 })
  check('11: Back returns to the list, the form refilled', (await page.locator('[data-customers-by]').inputValue()) === 'mobile' && (await page.locator('[data-customers-value]').inputValue()) === '0559998888')

  // ── 12 ──
  await page.locator('[data-customers-value]').fill('0500000000')
  await page.locator('[data-customers-find]').click()
  await page.locator('[data-customers-none]').waitFor({ timeout: 10000 })
  check('12: a mobile no member has says so', (await text(page.locator('[data-customers-none]'))) === 'No member has this mobile number.')

  check('14: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page, errors } = await open({ wallet: 'fails' })
  await page.goto(`${BASE}/campaigns/customers?loyaltyId=M-100231`)
  await page.locator('[data-member="M-100231"]').waitFor({ timeout: 15000 })
  await page.locator('[data-member-wallet] [role="alert"]').waitFor({ timeout: 10000 })
  check('13: a failed wallet door says so on its own', (await text(page.locator('[data-member-wallet] [role="alert"]'))).includes(WALLET_DOWN))
  await page.locator('[data-budgets-grid] .ag-row').first().waitFor({ timeout: 10000 })
  check('13: …and the budgets still read', (await page.locator('[data-member-budgets]').getAttribute('data-member-budgets')) === '4')
  check('14: no page errors (wallet fails)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
