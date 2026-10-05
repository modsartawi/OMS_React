// Bonus Buy Maintenance drive (BackOffice spec 2374) — drives the REAL app in Chromium
// against STUBBED `BbyMaintainWeb/*` envelopes.
//
// ⚠️ Stubbed: the doors shipped in BackOffice (2376–2382, merge 2abd345d5) and the stubs below
// answer in their SHIPPED shapes (reconciled at ticket 417), but no dev SIS.Api is known to carry
// them yet. What a stub proves is the client's decisions; the owner's walk proves the rest.
//
// 🚩 ONE drive file for the wave — 417 and 418 EXTEND this file.
//
// Ticket 416 — the promotion screen:
//   1. screenAllowed:true → a Bonus Buy Maintenance leaf under Pricing; false → none.
//   2. the list draws the promotions; Create promotion posts with NO number and opens
//      the promotion the server minted.
//   3. the overview header copies SAP's: number, name (max 40), SACH, the window with
//      Purchase/Listed equal and disabled.
//   4. the overview maps blank/1/2 to Activated/Planned/Deactivated.
//   5. Delete promotion is disabled while it holds bonus buys.
//   6. multi-select Activate calls once per number and shows each outcome, past a refusal.
//   7. Activate promotion refused → every refused bonus buy listed in both languages, and
//      the promotion is NOT refetched (nothing changed).
//   8. Copy → BonusBuy/Copy {sourceNumber, promoNumber} → the editor opens on the copy.
//   9. Copy from SAP… → a number prompt → the same copy.
//  10. Create / Display open the editor route.
//  11. no raw i18n keys; no page errors.
//
// Ticket 417 — the SAP-copy editor:
//  12. Display disables every input, offers no Check/Save, keeps Copy.
//  13. Change draws SAP's header, the 1000/20 org row, the Buy and Get grids; Curr/Pe reads
//      the currency + ex VAT for a Price and % for a percent.
//  14. Total Discount swaps the reward columns for the side panel, and back.
//  15. Total Minimum Value enables its amount.
//  16. Check posts the whole bonus buy (number, version, every line) and lists every refusal
//      with its code, English and Arabic, plus the warnings.
//  17. Save refused as stale → the reload prompt; Reload reads the bonus buy again.
//  18. Create: dates from the promotion; Save posts no number and opens Change on the minted one.
//  19. Local Material Grouping: an upper-cased id, Confirm, then a line picks it.
//  20. Engine Rules (Max value unavailable), Promotion Data and History of Changes tabs.
//  21. A SAP bonus buy opened for Change is read-only, with the SAP notice.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/bby-maintenance-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROOT = BASE + '/pricing/bonus-buy-maintenance'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

const saved = (number) => ({ status: 'saved', number, refusals: [], warnings: [] })
const refusal = (code, english, arabic) => ({ code, english, arabic })

const PROMO = {
  status: 'found',
  promoNumber: 'P000000001',
  name: 'Test By Sartawi',
  salesFrom: '2026-10-05T00:00:00',
  salesTo: '2026-10-31T00:00:00',
  bonusBuys: [
    { bbyNumber: 'OMS000000001', description: '1 + 1', validFrom: '2026-10-05', validTo: '2026-10-31', bbyStatus: '1' },
    { bbyNumber: 'OMS000000002', description: '10% - Coupon', validFrom: '2026-10-05', validTo: '2026-10-31', bbyStatus: '' },
    { bbyNumber: 'OMS000000003', description: 'OR rewards', validFrom: '2026-10-05', validTo: '2026-10-31', bbyStatus: '2' },
  ],
}
const EMPTY = { status: 'found', promoNumber: 'P000000002', name: 'Empty flyer', salesFrom: '2026-11-01', salesTo: '2026-11-30', bonusBuys: [] }

// Ticket 417: the editor's bonus buy — the owner's OR-price shape (2330 §6) with a grouping line.
const BBY = {
  bbyNumber: 'OMS000000124',
  version: '2026-10-05T09:14:03.117',
  promoNumber: 'P000000001',
  description: 'OR when apply discount',
  validFrom: '2026-10-05T00:00:00',
  validTo: '2026-10-31T00:00:00',
  limitNumber: 0,
  minValue: 100,
  linkCategoryBuy: 'A',
  linkCategoryGet: 'O',
  engineRules: { includes: null, excludes: null, originFilter: null, stackingExcludes: null, loyGroups: null, loyTiers: null, isStackable: false, maxValue: 0, score: 0, validFromTime: null, validToTime: null },
  totalDiscount: null,
  plants: [],
  customerCard: null,
  buy: [
    { material: '200033', grouping: null, quantity: 2, uom: 'EA', discountType: null },
    { material: null, grouping: 'GROUP1', quantity: 1, uom: 'EA', discountType: null },
  ],
  get: [
    { condNumber: 'OMS0000101', material: '200044', grouping: null, quantity: 3, uom: 'EA', scaleType: 'C', discountType: 'P', value: 15, requirement: null, scales: [] },
    { condNumber: 'OMS0000102', material: '200055', grouping: null, quantity: 2, uom: 'EA', scaleType: 'C', discountType: '%', value: 10, requirement: null, scales: [] },
  ],
  groupings: [{ id: 'GROUP1', materials: ['200011', '200012', '200013'] }],
}
const bbyDoc = (number, over = {}) => ({
  status: 'found', number, bonusBuy: { ...BBY, bbyNumber: number }, bbyStatus: '1', readOnly: false,
  version: BBY.version, changedBy: 'msartawi', changedAt: '2026-10-05T09:14:03', ...over,
})
let saveAnswer = 'stale'
let bonusBuyGets = 0

let allowed = true
const posts = [] // [path, body]
let promotionGets = 0

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const path = req.url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'BbyMaintainWeb/Access') return route.fulfill(envelope({ screenAllowed: allowed }))
    if (path === 'BbyMaintainWeb/Promotion/List') return route.fulfill(envelope([PROMO, EMPTY]))
    if (path.startsWith('BbyMaintainWeb/BonusBuy/') && req.method() === 'GET') {
      const n = decodeURIComponent(path.slice('BbyMaintainWeb/BonusBuy/'.length))
      bonusBuyGets++
      if (n === '000100001124') return route.fulfill(envelope(bbyDoc(n, { readOnly: true, bbyStatus: '' })))
      if (/^OMS0000001(24|25)$|^OMS00000000[129]$/.test(n))
        return route.fulfill(envelope(bbyDoc(n, { version: `v${bonusBuyGets}` })))
      return route.fulfill(envelope({ status: 'notFound', number: n, bonusBuy: null, bbyStatus: null, readOnly: false, version: null, changedBy: null, changedAt: null }))
    }
    if (path.startsWith('BbyMaintainWeb/') && req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      const op = path.slice('BbyMaintainWeb/'.length)
      posts.push([op, body])
      if (op === 'Promotion/Save') return route.fulfill(envelope(saved(body.promoNumber ?? 'P000000002')))
      if (op === 'Promotion/Activate') {
        // The shipped shape: each refused bonus buy in bonusBuys[], the same refusals flattened.
        const items = [
          { number: 'OMS000000001', status: 'refused', warnings: [], refusals: [
            refusal('BBY-051', 'Valid to is in the past.', 'تاريخ النهاية في الماضي.'),
            refusal('BBY-020', 'A Price must be above zero.', 'يجب أن يكون السعر أكبر من صفر.'),
          ] },
          { number: 'OMS000000003', status: 'refused', warnings: [], refusals: [
            refusal('BBY-030', 'Unknown material 999.', 'مادة غير معروفة 999.'),
          ] },
        ]
        return route.fulfill(
          envelope({ status: 'refused', number: PROMO.promoNumber, warnings: [], refusals: items.flatMap((i) => i.refusals), bonusBuys: items }),
        )
      }
      if (op === 'BonusBuy/Validate')
        return route.fulfill(
          envelope({
            status: 'refused',
            number: null,
            refusals: [
              refusal('BBY-DISCOUNT-TYPE', 'Get line 2: discount type N is not supported. Author free goods as 100 % off.', 'سطر الحصول 2: نوع الخصم N غير مدعوم.'),
              refusal('BBY-QUANTITY', 'Buy line 1: the quantity must be a whole number of at least 1.', 'سطر الشراء 1: يجب أن تكون الكمية عددًا صحيحًا لا يقل عن 1.'),
              refusal('BBY-MATERIAL-UNKNOWN', "Material '999' is not in the item master.", "المادة '999' غير موجودة."),
            ],
            warnings: [refusal('BBY-OUTSIDE-PROMOTION', 'The validity falls outside the promotion window.', 'الصلاحية خارج فترة العرض الترويجي.')],
          }),
        )
      if (op === 'BonusBuy/Save') {
        if (!body.bbyNumber) return route.fulfill(envelope(saved('OMS000000125')))
        if (saveAnswer === 'stale')
          return route.fulfill(
            envelope({
              status: 'refused',
              number: body.bbyNumber,
              warnings: [],
              refusals: [refusal('BBY-STALE-VERSION', `Bonus buy '${body.bbyNumber}' was changed by ayed at 10:02 after you opened it. Reload it and make your change again.`, `تم تعديل عرض الشراء '${body.bbyNumber}' بواسطة ayed بعد أن فتحته. أعد تحميله.`)],
            }),
          )
        return route.fulfill(envelope(saved(body.bbyNumber)))
      }
      if (op === 'BonusBuy/Activate') {
        if (body.bbyNumber === 'OMS000000003')
          return route.fulfill(
            envelope({
              status: 'refused',
              number: body.bbyNumber,
              warnings: [],
              refusals: [refusal('BBY-030', 'Unknown material 999.', 'مادة غير معروفة 999.')],
            }),
          )
        return route.fulfill(envelope(saved(body.bbyNumber)))
      }
      if (op === 'BonusBuy/Copy') return route.fulfill(envelope(saved('OMS000000009')))
      return route.fulfill(envelope(saved(body.bbyNumber ?? null)))
    }
    if (path === `BbyMaintainWeb/Promotion/${PROMO.promoNumber}`) {
      promotionGets++
      return route.fulfill(envelope(PROMO))
    }
    if (path === `BbyMaintainWeb/Promotion/${EMPTY.promoNumber}`) return route.fulfill(envelope(EMPTY))
    return route.fulfill(envelope({}))
  })

  const text = () => page.locator('body').innerText()
  const rawKey = async () => (await text()).match(/(?:bonus-buy-maintenance:)?(?:overview|promotion|list|create|copySap|editor|access|engine|grouping)\.[a-zA-Z.]+/)

  // ── 1. the nav leaf ──
  // The rail starts collapsed (its leaves live in a flyout), so expand it to read them.
  const expandRail = async () => {
    const btn = page.getByRole('button', { name: 'Expand menu' })
    if (await btn.count()) await btn.first().click()
    await page.waitForTimeout(300)
  }
  const leafHere = () => page.locator('a[href="/pricing/bonus-buy-maintenance"]').count()
  allowed = false
  await page.goto(BASE + '/pricing/bonus-buy-download')
  await page.waitForLoadState('networkidle')
  await expandRail()
  check('denied → no Bonus Buy Maintenance leaf', (await leafHere()) === 0)
  allowed = true
  await page.goto(ROOT)
  await page.waitForSelector('text=Create promotion')
  await expandRail()
  check('granted → the leaf is in the nav', (await leafHere()) > 0)

  // ── 2. the list + create ──
  await page.waitForSelector('.ag-row[row-id="P000000002"]')
  const listRows = await page.locator('.ag-row[row-id]').count()
  check('the list draws both promotions', listRows === 2, String(listRows))
  const range = await page.locator('.ag-row[row-id="P000000001"] [col-id="window"]').innerText()
  check('the window renders as one range', range.trim() === '2026-10-05 – 2026-10-31', JSON.stringify(range))
  await page.click('text=Create promotion')
  const dlg = page.locator('dialog')
  await dlg.locator('input[type="text"]').fill('Flyer')
  check('the name is capped at 40', (await dlg.locator('input[type="text"]').getAttribute('maxlength')) === '40')
  await dlg.locator('input[type="date"]').nth(0).fill('2026-11-01')
  await dlg.locator('input[type="date"]').nth(1).fill('2026-11-30')
  await dlg.locator('button:has-text("Create")').click()
  await page.waitForURL('**/bonus-buy-maintenance/P000000002')
  const create = posts.find(([op]) => op === 'Promotion/Save')
  check('Create posts with NO number', create && create[1].promoNumber === null && create[1].name === 'Flyer', JSON.stringify(create?.[1]))
  check('…and opens the promotion the server minted', page.url().endsWith('/P000000002'))
  await page.waitForSelector('text=No bonus buys in this promotion yet.')
  check('5. an empty promotion offers Delete promotion', await page.locator('button:has-text("Delete promotion")').isEnabled())

  // ── 3–5. the overview ──
  await page.goto(`${ROOT}/${PROMO.promoNumber}`)
  await page.waitForSelector('text=Change promotion: Bonus Buy Overview')
  await page.waitForSelector('.ag-row')
  const body = await text()
  check('3. the type is SACH SA-Promo Chain', body.includes('SACH') && body.includes('SA-Promo Chain'))
  const dates = page.locator('input[type="date"]')
  check('3. six period dates, four disabled', (await dates.count()) === 6 && (await page.locator('input[type="date"]:disabled').count()) === 4)
  check('3. Purchase from equals On sale from', (await dates.nth(2).inputValue()) === '2026-10-05')
  check('4. the three statuses read Planned / Activated / Deactivated',
    ['Planned', 'Activated', 'Deactivated'].every((s) => body.includes(s)))
  check('5. Delete promotion is disabled while it holds bonus buys', await page.locator('button:has-text("Delete promotion")').isDisabled())

  // ── 6. multi-select activate ──
  const rowCheck = (n) => page.locator(`.ag-row[row-id="${n}"] .ag-selection-checkbox input`).first()
  await rowCheck('OMS000000001').check()
  await rowCheck('OMS000000003').check()
  await rowCheck('OMS000000002').check()
  check('Change is disabled on a multi-select', await page.locator('button:has-text("Change")').first().isDisabled())
  posts.length = 0
  await page.locator('button', { hasText: /^Activate$/ }).click()
  await page.waitForSelector('[role="status"]:has-text("Refused")')
  const acts = posts.filter(([op]) => op === 'BonusBuy/Activate').map(([, b]) => b.bbyNumber)
  check('6. one call per number, past the refusal', acts.length === 3 && new Set(acts).size === 3, acts.join(','))
  const report = await page.locator('[role="status"]').last().innerText()
  check('6. each number’s outcome is shown', ['OMS000000001', 'OMS000000002', 'OMS000000003'].every((n) => report.includes(n)) && report.includes('Done') && report.includes('BBY-030'))

  // ── 7. promotion activate refused ──
  const before = promotionGets
  await page.click('button:has-text("Activate promotion")')
  await page.locator('dialog button:has-text("Yes")').click()
  await page.waitForSelector('text=Nothing changed. These bonus buys were refused:')
  const flip = await page.locator('[role="status"]').last().innerText()
  check('7. every refused bonus buy is listed', flip.includes('OMS000000001') && flip.includes('OMS000000003'))
  check('7. every refusal, in both languages', ['BBY-051', 'BBY-020', 'BBY-030'].every((c) => flip.includes(c)) && flip.includes('تاريخ النهاية في الماضي.'))
  await page.waitForTimeout(500)
  check('7. nothing changed, so the promotion was NOT refetched', promotionGets === before, `${before}→${promotionGets}`)

  // ── 8. copy ──
  await rowCheck('OMS000000002').uncheck()
  await rowCheck('OMS000000003').uncheck()
  posts.length = 0
  await page.locator('button', { hasText: /^Copy$/ }).click()
  await page.waitForURL('**/bonus-buy/OMS000000009')
  const copy = posts.find(([op]) => op === 'BonusBuy/Copy')
  check('8. Copy posts the source and this promotion', copy && copy[1].sourceNumber === 'OMS000000001' && copy[1].promoNumber === PROMO.promoNumber, JSON.stringify(copy?.[1]))
  check('8. …and opens the editor on the copy', !!(await page.waitForSelector('h1:has-text("Change Bonus Buy")', { timeout: 5000 }).catch(() => null)))

  // ── 9. copy from SAP ──
  await page.goto(`${ROOT}/${PROMO.promoNumber}`)
  await page.waitForSelector('.ag-row')
  posts.length = 0
  await page.click('text=Copy from SAP…')
  await page.locator('dialog input[type="text"]').fill(' 1000000048 ')
  await page.locator('dialog button', { hasText: /^Copy$/ }).click()
  await page.waitForURL('**/bonus-buy/OMS000000009')
  const sap = posts.find(([op]) => op === 'BonusBuy/Copy')
  check('9. Copy from SAP sends the trimmed number', sap && sap[1].sourceNumber === '1000000048', JSON.stringify(sap?.[1]))

  // ── 10. create / display ──
  await page.goto(`${ROOT}/${PROMO.promoNumber}`)
  await page.waitForSelector('.ag-row')
  await page.locator('button', { hasText: /^Create$/ }).click()
  await page.waitForURL('**/bonus-buy/new')
  check('10. Create opens the editor route', !!(await page.waitForSelector('h1:has-text("Create Bonus Buy")', { timeout: 5000 }).catch(() => null)))
  await page.goBack()
  await page.waitForSelector('.ag-row')
  await rowCheck('OMS000000002').check()
  await page.locator('button', { hasText: /^Display$/ }).click()
  await page.waitForURL('**/OMS000000002?mode=display')
  check('10. Display opens the editor read-only route', !!(await page.waitForSelector('h1:has-text("Display Bonus Buy")', { timeout: 5000 }).catch(() => null)))

  // ════════ Ticket 417 — the SAP-copy editor ════════
  const EDIT = `${ROOT}/${PROMO.promoNumber}/bonus-buy`
  const form = page.locator('fieldset').first()
  const report417 = () => page.locator('[role="status"]').last().innerText()

  // ── 12. display disables every input ──
  await page.goto(`${EDIT}/OMS000000002?mode=display`)
  await page.waitForSelector('h1:has-text("Display Bonus Buy")')
  await page.waitForSelector('table[data-grid="get"]')
  const controls = form.locator('input, select, textarea')
  const nControls = await controls.count()
  let enabled = 0
  for (let i = 0; i < nControls; i++) if (await controls.nth(i).isEnabled()) enabled++
  check('12. display disables every input in the form', nControls > 10 && enabled === 0, `${enabled}/${nControls} enabled`)
  check('12. display offers no Check and no Save', (await page.locator('button', { hasText: /^(Check|Save)$/ }).count()) === 0)
  check('12. display keeps Copy', (await page.locator('button', { hasText: /^Copy$/ }).count()) === 1)
  check('12. no Add line in display', (await page.locator('button:has-text("Add line")').count()) === 0)

  // ── 13. change: SAP's header, org, grids, Curr/Pe ──
  await page.goto(`${EDIT}/OMS000000124`)
  await page.waitForSelector('h1:has-text("Change Bonus Buy")')
  await page.waitForSelector('table[data-grid="get"]')
  const eb = await text()
  check('13. the header: number, text, Planned, BBCH, SAR',
    eb.includes('OMS000000124') && (await page.locator('input[maxlength="60"]').inputValue()) === 'OR when apply discount' &&
    eb.includes('Planned') && eb.includes('BBCH') && eb.includes('DWA-BB Profile chain') && eb.includes('SAR'))
  check('13. org row 1000 / 20, read-only type 01', eb.includes('1000') && eb.includes('Al-Dawaa Domestic') && eb.includes('Retail') && eb.includes('01 Organization'))
  check('13. no Requirement, Arb. Comb., price list or plant column', !/Requirement|Arb\. Comb|Price List|Plant/.test(eb))
  const buyRows = await page.locator('table[data-grid="buy"] tbody tr').count()
  const getRows = await page.locator('table[data-grid="get"] tbody tr').count()
  check('13. two buy lines and two get lines', buyRows === 2 && getRows === 2, `${buyRows}/${getRows}`)
  const groupingCell = await page.locator('table[data-grid="buy"] tbody tr').nth(1).innerText()
  check('13. a grouping line shows its member count', groupingCell.replace(/[⁦-⁩]/g, '').includes('3 materials'), JSON.stringify(groupingCell))
  const priceRow = await page.locator('table[data-grid="get"] tbody tr').nth(0).innerText()
  const pctRow = await page.locator('table[data-grid="get"] tbody tr').nth(1).innerText()
  check('13. Curr/Pe: a Price reads SAR + ex VAT', priceRow.includes('SAR') && priceRow.includes('ex VAT'), JSON.stringify(priceRow))
  check('13. Curr/Pe: a percent reads %, no ex VAT', pctRow.includes('%') && !pctRow.includes('ex VAT'), JSON.stringify(pctRow))

  // ── 14. total discount swaps the columns for the side panel ──
  const getCols = () => page.locator('table[data-grid="get"] thead th[data-col]').evaluateAll((ths) => ths.map((th) => th.dataset.col))
  check('14. unticked: reward columns in the grid, no side panel',
    (await getCols()).includes('discountType') && (await page.locator('[data-panel="total-discount"]').count()) === 0)
  await page.getByLabel('Total Discount').check()
  const ticked = await getCols()
  check('14. ticked: the reward columns leave the grid',
    !ticked.includes('discountType') && !ticked.includes('value') && !ticked.includes('currPe'), ticked.join(','))
  check('14. ticked: the side panel appears with its bundle-price hint',
    (await page.locator('[data-panel="total-discount"]').count()) === 1 && (await text()).includes('bundle price'))
  await page.getByLabel('Total Discount').uncheck()
  check('14. unticked again: the columns come back', (await getCols()).includes('currPe'))

  // ── 15. total minimum value enables its amount ──
  const amount = page.getByLabel('Minimum value amount')
  check('15. a read with 100 opens ticked, amount enabled', (await amount.isEnabled()) && (await amount.inputValue()) === '100')
  await page.getByLabel('Total Minimum Value').uncheck()
  check('15. unticked: the amount is disabled', await amount.isDisabled())
  await page.getByLabel('Total Minimum Value').check()

  // ── 16. check ──
  posts.length = 0
  await page.locator('button', { hasText: /^Check$/ }).click()
  await page.waitForSelector('text=Check found problems. Nothing was saved.')
  const v = posts.find(([op]) => op === 'BonusBuy/Validate')?.[1]
  check('16. Check posts the whole bonus buy',
    v && v.bbyNumber === 'OMS000000124' && v.version && v.get.length === 2 && v.get[0].condNumber === 'OMS0000101' &&
      v.buy[1].grouping === 'GROUP1' && v.minValue === 100 && v.groupings[0].id === 'GROUP1', JSON.stringify(v))
  const vr = await report417()
  check('16. every refusal with its code',
    ['BBY-DISCOUNT-TYPE', 'BBY-QUANTITY', 'BBY-MATERIAL-UNKNOWN'].every((c) => vr.includes(c)))
  check('16. …in English and Arabic', vr.includes('is not in the item master') && vr.includes('غير موجودة'))
  check('16. the warning is listed too', vr.includes('BBY-OUTSIDE-PROMOTION') && vr.includes('Warnings'))
  check('16. Check wrote nothing', !posts.some(([op]) => op === 'BonusBuy/Save'))

  // ── 17. stale version ──
  saveAnswer = 'stale'
  await page.locator('button', { hasText: /^Save$/ }).click()
  await page.waitForSelector('button:has-text("Reload")')
  const st = await report417()
  check('17. stale → the reload prompt, with the server sentence in both languages', st.includes('BBY-STALE-VERSION') && st.includes('أعد تحميله'))
  const gets = bonusBuyGets
  await page.getByLabel('Total Minimum Value').uncheck()
  await page.click('button:has-text("Reload")')
  await page.waitForFunction(() => !document.body.innerText.includes('Reload'), null, { timeout: 5000 }).catch(() => {})
  check('17. Reload reads the bonus buy again', bonusBuyGets > gets, `${gets}→${bonusBuyGets}`)
  check('17. …and the form starts again from the read', await page.getByLabel('Total Minimum Value').isChecked())

  // ── 18. create ──
  await page.goto(`${EDIT}/new`)
  await page.waitForSelector('h1:has-text("Create Bonus Buy")')
  check('18. the number is given on save', (await text()).includes('Given when you save'))
  const dts = page.locator('fieldset input[type="date"]')
  check('18. dates default from the promotion', (await dts.nth(0).inputValue()) === '2026-10-05' && (await dts.nth(1).inputValue()) === '2026-10-31')
  await page.locator('input[maxlength="60"]').fill('1 + 1')
  await page.locator('table[data-grid="buy"] tbody tr').first().getByLabel('Line Item Identifier').fill('200033')
  await page.locator('table[data-grid="get"] tbody tr').first().getByLabel('Line Item Identifier').fill('200033')
  await page.locator('table[data-grid="get"] tbody tr').first().getByLabel('Value').fill('100')
  posts.length = 0
  await page.locator('button', { hasText: /^Save$/ }).click()
  await page.waitForURL('**/bonus-buy/OMS000000125')
  const sv = posts.find(([op]) => op === 'BonusBuy/Save')?.[1]
  check('18. Save posts no number and no version', sv && sv.bbyNumber === null && sv.version === null && sv.promoNumber === 'P000000001', JSON.stringify(sv))
  check('18. …one buy line, one get line at 100 %', sv && sv.buy.length === 1 && sv.get[0].discountType === '%' && sv.get[0].value === 100 && sv.get[0].condNumber === null)
  check('18. …and opens Change on the minted number', !!(await page.waitForSelector('h1:has-text("Change Bonus Buy")', { timeout: 5000 }).catch(() => null)))
  check('18. the Saved report survives the move', (await text()).includes('Saved.'))

  // ── 19. local material grouping ──
  await page.locator('button', { hasText: /^Local Material Grouping$/ }).click()
  const gd = page.locator('dialog')
  await gd.locator('select').first().selectOption('')
  await gd.getByLabel('Material Grouping').fill('grp9')
  check('19. the id is upper-cased, at most 12', (await gd.getByLabel('Material Grouping').inputValue()) === 'GRP9' && (await gd.getByLabel('Material Grouping').getAttribute('maxlength')) === '12')
  check('19. status 3 Created Manually', (await gd.innerText()).includes('Created Manually'))
  await gd.getByLabel('Material', { exact: true }).first().fill('200091')
  await gd.locator('button:has-text("Confirm")').click()
  const firstBuy = page.locator('table[data-grid="buy"] tbody tr').first()
  await firstBuy.getByLabel('Line Item Type').selectOption('grouping')
  const opts = (await firstBuy.getByLabel('Line Item Identifier').locator('option').allInnerTexts()).map((o) => o.replace(/[⁦-⁩]/g, ''))
  check('19. a line picks from the bonus buy’s groupings', opts.includes('GRP9') && opts.includes('GROUP1'), opts.join(','))
  await page.locator('button', { hasText: /^Local Material Grouping$/ }).click()
  await gd.locator('select').first().selectOption('')
  await gd.getByLabel('Material Grouping').fill('group1')
  const loaded = await gd.getByLabel('Material', { exact: true }).evaluateAll((els) => els.map((e) => e.value))
  check('19. typing an existing id opens it — never a silent overwrite', loaded.includes('200011') && loaded.includes('200013'), loaded.join(','))
  await gd.locator('button:has-text("Cancel")').click()

  // ── 20. the other tabs ──
  await page.getByRole('tab', { name: 'Engine Rules' }).click()
  check('20. Engine Rules: Max value unavailable', (await page.getByLabel('Max value').isDisabled()) && (await text()).includes('Unavailable until the engine update.'))
  check('20. Engine Rules: time of day boxes', (await page.locator('fieldset input[type="time"]').count()) === 2)
  await page.getByRole('tab', { name: 'Promotion Data' }).click()
  check('20. Promotion Data shows the promotion', (await text()).includes('Test By Sartawi'))
  await page.getByRole('tab', { name: 'History of Changes' }).click()
  check('20. History of Changes shows the last write', (await text()).includes('msartawi') && (await text()).includes('Last saved'))
  await page.screenshot({ path: 'tools/.bby-maintenance-shots/editor-history.png', fullPage: true }).catch(() => {})

  // ── 21. a SAP bonus buy is read-only even in Change ──
  await page.goto(`${EDIT}/000100001124`)
  await page.waitForSelector('table[data-grid="get"]')
  check('21. the SAP notice shows', (await text()).includes('This is a SAP bonus buy.'))
  check('21. its inputs are disabled', (await page.locator('fieldset[data-readonly="true"]').count()) === 1 && (await page.locator('input[maxlength="60"]').isDisabled()))
  const k417 = await rawKey()
  check('21. no raw i18n keys on the editor', k417 === null, (k417 || [''])[0])
  await page.goto(`${EDIT}/OMS000000124`)
  await page.waitForSelector('table[data-grid="get"]')
  await page.screenshot({ path: 'tools/.bby-maintenance-shots/editor.png', fullPage: true }).catch(() => {})

  // ── 11. hygiene ──
  await page.goto(`${ROOT}/${PROMO.promoNumber}`)
  await page.waitForSelector('.ag-row')
  const k = await rawKey()
  check('11. no raw i18n keys', k === null, (k || [''])[0])
  await import('node:fs').then((fs) => fs.mkdirSync('tools/.bby-maintenance-shots', { recursive: true }))
  await page.screenshot({ path: 'tools/.bby-maintenance-shots/overview.png', fullPage: true }).catch(() => {})
  check('11. no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
