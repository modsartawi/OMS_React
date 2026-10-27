// Bonus-buy maintenance loyalty-group picker drive (oms ticket 636; BackOffice spec 3173, doors 3174 + 3179).
//
// Drives the REAL app in Chromium against STUBBED envelopes: `LoyGroupWeb/Access`, `LoyGroupWeb/Groups`
// (3174) and the bonus-buy save's new loyalty-group findings (3179) are deployed nowhere yet. It asserts:
//   1. with the view grant, the Engine Rules "Loyalty groups" field is a picker over
//      `Groups?includeInactive=true`: the inactive group greyed and marked, the bonus-buy's undefined code
//      STAFF_X kept as a flagged chip (D2);
//   2. ticking SILVER and taking GOLD off: Save posts ONE comma string, the unknown code kept;
//   3. Check: the unknown-group refusal and the inactive-group warning are listed under the field (and still
//      in the act report); a finding of another field is not;
//   4. without the grant the field is read-only text of the current codes, and no groups list is asked;
//   5. under RTL the picker still draws; no raw keys, no page errors.
//
// 🚩 The two finding codes are GUESSED (`BBY-LOY-GROUP-UNKNOWN` / `-INACTIVE`): 3179 names none.
//
//   1. run the app:  npx vite --port 5206 --strictPort
//   2. DRIVE_PORT=5206 node tools/bby-loy-groups-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5206}`
const EDIT = BASE + '/pricing/bonus-buy-maintenance/P000000001/bonus-buy'
const SHOTS = 'tools/.bby-loy-groups-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})
const refusal = (code, english, arabic) => ({ code, english, arabic })

const PROMO = {
  status: 'found', promoNumber: 'P000000001', name: 'Test By Sartawi',
  salesFrom: '2026-10-05T00:00:00', salesTo: '2026-10-31T00:00:00',
  bonusBuys: [{ bbyNumber: 'OMS000000124', description: 'OR when apply discount', validFrom: '2026-10-05', validTo: '2026-10-31', bbyStatus: '1' }],
}
const BBY = {
  bbyNumber: 'OMS000000124', version: '2026-10-05T09:14:03.117', promoNumber: 'P000000001',
  description: 'OR when apply discount', validFrom: '2026-10-05T00:00:00', validTo: '2026-10-31T00:00:00',
  limitNumber: 0, minValue: 0, linkCategoryBuy: 'A', linkCategoryGet: 'O',
  engineRules: {
    includes: null, excludes: null, originFilter: null, stackingExcludes: null,
    loyGroups: 'GOLD,STAFF_X', loyTiers: null, isStackable: false, maxValue: 0, score: 0, validFromTime: null, validToTime: null,
  },
  totalDiscount: null, plants: [], customerCard: null,
  buy: [{ material: '200033', grouping: null, quantity: 2, uom: 'EA', discountType: null }],
  get: [{ condNumber: 'OMS0000101', material: '200044', grouping: null, quantity: 1, uom: 'EA', scaleType: 'C', discountType: 'P', value: 15, requirement: null, scales: [] }],
  groupings: [],
}
const DOC = {
  status: 'found', number: 'OMS000000124', bonusBuy: BBY, bbyStatus: '1', readOnly: false,
  version: BBY.version, changedBy: 'msartawi', changedAt: '2026-10-05T09:14:03',
}
const GROUPS = [
  { groupId: 'g1', code: 'GOLD', nameEn: 'Gold members', nameAr: 'الذهبي', isActive: true, mobileCount: 120, liveBonusBuys: [] },
  { groupId: 'g2', code: 'SILVER', nameEn: 'Silver members', nameAr: 'الفضي', isActive: true, mobileCount: 80, liveBonusBuys: [] },
  { groupId: 'g3', code: 'RAMADAN_24', nameEn: 'Ramadan 2024', nameAr: 'رمضان ٢٠٢٤', isActive: false, mobileCount: 40, liveBonusBuys: [] },
]
const UNKNOWN = refusal('BBY-LOY-GROUP-UNKNOWN', 'Loyalty groups: STAFF_X is not a defined loyalty group.', 'مجموعات الولاء: STAFF_X ليست مجموعة ولاء معرّفة.')
const INACTIVE = refusal('BBY-LOY-GROUP-INACTIVE', 'Loyalty groups: RAMADAN_24 is inactive.', 'مجموعات الولاء: RAMADAN_24 غير نشطة.')
const OTHER = refusal('BBY-QUANTITY', 'Buy line 1: the quantity must be more than 0.', 'سطر الشراء ١: يجب أن تكون الكمية أكبر من ٠.')

async function open(dir, { canView }) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const posts = []
  const asked = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const [path, qs = ''] = req.url().split('/api/')[1].split('?')
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'BbyMaintainWeb/Access') return route.fulfill(envelope({ screenAllowed: true, canTest: true }))
    if (path === 'BbyMaintainWeb/Promotion/P000000001') return route.fulfill(envelope(PROMO))
    if (path === 'BbyMaintainWeb/BonusBuy/OMS000000124' && req.method() === 'GET') return route.fulfill(envelope(DOC))
    if (path === 'LoyGroupWeb/Access') return route.fulfill(envelope({ canView, canMaintain: false }))
    if (path === 'LoyGroupWeb/Groups') {
      asked.push(qs)
      return route.fulfill(envelope(GROUPS))
    }
    if (req.method() === 'POST' && path.startsWith('BbyMaintainWeb/')) {
      const op = path.slice('BbyMaintainWeb/'.length)
      posts.push([op, JSON.parse(req.postData() || '{}')])
      if (op === 'BonusBuy/Validate')
        return route.fulfill(envelope({ status: 'refused', number: 'OMS000000124', refusals: [OTHER, UNKNOWN], warnings: [INACTIVE] }))
      if (op === 'BonusBuy/Save')
        return route.fulfill(envelope({ status: 'refused', number: 'OMS000000124', refusals: [UNKNOWN], warnings: [] }))
    }
    return route.fulfill(envelope({}))
  })
  // A cold Vite optimises its deps on the first load: give it room.
  await page.goto(`${EDIT}/OMS000000124`, { timeout: 180000 })
  await page.waitForSelector('h1:has-text("Change Bonus Buy")', { timeout: 60000 })
  await page.getByRole('tab', { name: 'Engine Rules' }).click()
  return { browser, page, errors, posts, asked }
}

const rawKey = async (page) =>
  (await page.locator('body').innerText()).match(/(?:engine|multiSelect|picker|loyFindings)\.[a-zA-Z.]+/)

async function granted(dir) {
  const { browser, page, errors, posts, asked } = await open(dir, { canView: true })
  const picker = page.locator('[data-testid="bby-engine-loyGroups"]')
  await picker.locator('[data-chip="GOLD"]').waitFor()
  await page.waitForFunction(() => document.querySelector('[data-chip="STAFF_X"]')?.getAttribute('data-tone') === 'danger', null, { timeout: 5000 }).catch(() => {})

  // ── 1. the picker ──
  check(`${dir} 1. the options are asked with includeInactive=true`, asked.some((q) => q.includes('includeInactive=true')), asked.join(' | '))
  check(`${dir} 1. GOLD is a chosen chip with its name`, (await picker.locator('[data-chip="GOLD"]').innerText()).includes('Gold members'))
  const unknownChip = picker.locator('[data-chip="STAFF_X"]')
  check(`${dir} 1. the undefined STAFF_X is kept, flagged (D2)`,
    (await unknownChip.getAttribute('data-tone')) === 'danger' && (await unknownChip.innerText()).includes('Not a defined group'),
    await unknownChip.innerText())
  await picker.locator('[data-multi-select-trigger]').click()
  const inactive = picker.locator('[data-option="RAMADAN_24"]')
  check(`${dir} 1. the inactive group is offered, greyed and marked`,
    (await inactive.getAttribute('data-tone')) === 'muted' && (await inactive.innerText()).includes('Inactive'), await inactive.innerText())
  check(`${dir} 1. the options are the three defined groups`, (await picker.locator('[data-option]').count()) === 3)
  await page.screenshot({ path: `${SHOTS}/${dir}-picker-open.png` }).catch(() => {})
  if (dir === 'rtl') check('rtl 1. the page is right-to-left', (await page.locator('html').getAttribute('dir')) === 'rtl')

  // ── 2. pick → Save posts one comma string ──
  await picker.locator('[data-option="SILVER"] input').check()
  await page.keyboard.press('Escape')
  await picker.locator('[data-chip-remove="GOLD"]').click()
  check(`${dir} 2. the chips read STAFF_X, SILVER`,
    JSON.stringify(await picker.locator('[data-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chip')))) === '["STAFF_X","SILVER"]')
  await page.locator('button', { hasText: /^Save$/ }).click()
  await page.waitForFunction(() => document.querySelector('[data-testid="bby-engine-loyGroups-findings"]'), null, { timeout: 5000 }).catch(() => {})
  const sv = posts.find(([op]) => op === 'BonusBuy/Save')?.[1]
  check(`${dir} 2. Save posts the picked groups as ONE comma string, the unknown kept`,
    sv?.engineRules?.loyGroups === 'STAFF_X,SILVER', JSON.stringify(sv?.engineRules?.loyGroups))

  // ── 3. Check: the findings listed under the field ──
  await page.locator('button', { hasText: /^Check$/ }).click()
  await page.waitForFunction(() => document.querySelector('[data-testid="bby-engine-loyGroups-findings"] [data-finding="warned"]'), null, { timeout: 5000 }).catch(() => {})
  const findings = page.locator('[data-testid="bby-engine-loyGroups-findings"]')
  const refused = (await findings.locator('[data-finding="refused"]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  const warned = (await findings.locator('[data-finding="warned"]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(`${dir} 3. the unknown-group refusal is listed on the field, EN + AR`,
    refused.includes('BBY-LOY-GROUP-UNKNOWN') && refused.includes('STAFF_X is not a defined') && refused.includes('ليست مجموعة'), refused)
  check(`${dir} 3. the inactive-group warning is listed on the field`, warned.includes('BBY-LOY-GROUP-INACTIVE') && warned.includes('RAMADAN_24'), warned)
  check(`${dir} 3. another field's refusal is not listed on it`, !refused.includes('BBY-QUANTITY') && !warned.includes('BBY-QUANTITY'))
  check(`${dir} 3. the trigger is announced invalid`, (await picker.locator('[data-multi-select-trigger]').getAttribute('aria-invalid')) === 'true')
  const report = await page.locator('[role="status"]').first().innerText().catch(() => '')
  check(`${dir} 3. the act report still lists all three`, ['BBY-QUANTITY', 'BBY-LOY-GROUP-UNKNOWN', 'BBY-LOY-GROUP-INACTIVE'].every((c) => report.includes(c)))
  await page.screenshot({ path: `${SHOTS}/${dir}-findings.png`, fullPage: true }).catch(() => {})

  const k = await rawKey(page)
  check(`${dir} 5. no raw i18n keys`, k === null, (k || [''])[0])
  check(`${dir} 5. no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await browser.close()
}

async function denied(dir) {
  const { browser, page, errors, asked } = await open(dir, { canView: false })
  const field = page.locator('[data-testid="bby-engine-loyGroups"]')
  await field.waitFor()
  check(`${dir} 4. without the grant the field is read-only text of the codes`,
    (await field.getAttribute('data-loy-groups-readonly')) === '' && (await field.innerText()).includes('GOLD,STAFF_X'), await field.innerText())
  check(`${dir} 4. …with no picker and no groups list asked`,
    (await page.locator('[data-multi-select]').count()) === 0 && asked.length === 0, asked.join(' | '))
  check(`${dir} 4. no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await browser.close()
}

async function run() {
  for (const dir of ['ltr', 'rtl']) {
    await granted(dir)
    await denied(dir)
  }
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
