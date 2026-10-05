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
// Ticket 418 — the upload dialog (BbyMaintainWeb/Upload, BackOffice 2381/2382; the stub answers
// in the SHIPPED BbyUploadResult shape):
//  22. the multipart parts: file (its name), validateOnly (418's activate part retired by 421).
//  23. check only → "passed", nothing written, would-be rows, and the overview NOT refetched.
//  24. a refused file → every refused row (row, serial, code, EN + AR), nothing written, no refetch.
//  25. a load → created numbers (Planned), the overview refetched; a second run → updated numbers.
//  26. a file whose AKTNR names another promotion offers a link to it; an empty file never goes up.
//
// Ticket 419 — Tested and Back to Planned (BackOffice spec 2396, ADR 0063). ⚠️ The doors are NOT
// built (BackOffice 2397/2398 open): MarkTested, BackToPlanned, Access.canTest and the test mark
// are stubbed in the SPEC'S READING, not a shipped DTO. Spec 2396 REVERSES 2374 here, so three
// earlier steps changed: 4 reads four statuses (Tested added), 6 activates a selection holding
// no Planned row (a Planned one is no longer offered Activate), 7's refusal names an untested
// bonus buy, and 8 re-selects the Planned row it copies.
//  27. the overview reads `3` as Tested and shows tested by / at / note.
//  28. a selection holding a Planned bonus buy is not offered Activate; the hint says test it first.
//  29. canTest + Planned → Mark Tested (held back while an edit is unsaved); the note prompt posts
//      { number, note } and the bonus buy is read again.
//  30. the four-eyes refusal is the server's, shown as is in EN + AR (never pre-blocked).
//  31. without canTest, Mark Tested is not offered.
//  32. Tested opens read-only (the lock hint, no Check/Save/line actions), shows its test mark,
//      and goes Back to Planned without a warning.
//  33. Activated asks before Back to Planned (the offer leaves the tills); No posts nothing.
//  34. Deactivated is locked too; a SAP bonus buy keeps its SAP hint and is offered neither act.
//
// Ticket 421 — the upload drops "activate" (BackOffice spec 2396; 2398/2399 open, so the stub
// keeps 418's SHIPPED BbyUploadResult shape, which 2396 does not change). Spec 2396 REVERSES
// 2374's upload-and-activate, so 418's steps 22 and 25 changed: 22 asserts NO activate part on
// any run (it asserted activate=false/true), and 25's load lands Planned (it ticked activate and
// read Activated).
//  35. no activate option; the help names 23 SCORE and 24 LOY_TIERS as OMS-only, SAP-refused.
//  36. a re-upload reaching a locked serial is refused: its row, serial, code and the server's
//      text naming number and status (EN + AR), row 0 the whole file, nothing written, no refetch.
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
    { bbyNumber: 'OMS000000004', description: 'Vichy 2nd p', validFrom: '2026-10-05', validTo: '2026-10-31', bbyStatus: '3',
      testedBy: 'ayed', testedAt: '2026-10-05T11:20:00', testNote: 'Two Vichy items and a coupon: 20 SR.' },
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
// Ticket 419: each OMS bonus buy's status as the stub's server holds it (default Planned), and the
// test mark the read carries. MarkTested / BackToPlanned move it, so a re-read shows the move.
const statusOf = { OMS000000002: '', OMS000000003: '2', OMS000000004: '3' }
const MARK = { testedBy: 'ayed', testedAt: '2026-10-05T11:20:00', testNote: 'Two Vichy items and a coupon: 20 SR.' }
const markOf = { OMS000000002: MARK, OMS000000004: MARK }
let canTest = true
let markAnswer = 'saved'

let allowed = true
const posts = [] // [path, body]
let promotionGets = 0
const uploads = [] // multipart bodies, as sent
let uploadAnswer = null

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
    if (path === 'BbyMaintainWeb/Access') return route.fulfill(envelope({ screenAllowed: allowed, canTest }))
    if (path === 'BbyMaintainWeb/Promotion/List') return route.fulfill(envelope([PROMO, EMPTY]))
    if (path.startsWith('BbyMaintainWeb/BonusBuy/') && req.method() === 'GET') {
      const n = decodeURIComponent(path.slice('BbyMaintainWeb/BonusBuy/'.length))
      bonusBuyGets++
      if (n === '000100001124') return route.fulfill(envelope(bbyDoc(n, { readOnly: true, bbyStatus: '' })))
      if (/^OMS0000001(24|25)$|^OMS00000000[1-49]$/.test(n))
        return route.fulfill(envelope(bbyDoc(n, {
          version: `v${bonusBuyGets}`, bbyStatus: statusOf[n] ?? '1',
          testedBy: null, testedAt: null, testNote: null, ...(markOf[n] ?? {}),
        })))
      return route.fulfill(envelope({ status: 'notFound', number: n, bonusBuy: null, bbyStatus: null, readOnly: false, version: null, changedBy: null, changedAt: null }))
    }
    // Multipart, not JSON: answered before the JSON POST branch parses its body.
    if (path === 'BbyMaintainWeb/Upload') {
      uploads.push(req.postData() || '')
      return route.fulfill(envelope(uploadAnswer))
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
            refusal('BBY-NOT-TESTED', 'Bonus buy OMS000000001 is Planned. Test it before activating.', 'عرض الشراء OMS000000001 مخطط. اختبره قبل التفعيل.'),
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
      // Ticket 419 — spec 2396's reading: { number, note } / { number } in, BbyMaintainOutcome out.
      if (op === 'BonusBuy/MarkTested') {
        if (markAnswer === 'fourEyes')
          return route.fulfill(envelope({
            status: 'refused', number: body.number, warnings: [],
            refusals: [refusal('BBY-TEST-OWN-WRITE', `msartawi last wrote bonus buy '${body.number}'. Someone else must test it.`, `آخر من عدّل عرض الشراء '${body.number}' هو msartawi. يجب أن يختبره شخص آخر.`)],
          }))
        statusOf[body.number] = '3'
        markOf[body.number] = { testedBy: 'ayed', testedAt: '2026-10-05T12:00:00', testNote: body.note }
        return route.fulfill(envelope(saved(body.number)))
      }
      if (op === 'BonusBuy/BackToPlanned') {
        statusOf[body.number] = '1'
        delete markOf[body.number]
        return route.fulfill(envelope(saved(body.number)))
      }
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
  const rawKey = async () => (await text()).match(/(?:bonus-buy-maintenance:)?(?:overview|promotion|list|create|copySap|editor|access|engine|grouping|upload|status|test|backToPlanned)\.[a-zA-Z.]+/)

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
  // 2396 reversal: four statuses now, Tested added.
  check('4. the four statuses read Planned / Tested / Activated / Deactivated',
    ['Planned', 'Tested', 'Activated', 'Deactivated'].every((s) => body.includes(s)))
  check('5. Delete promotion is disabled while it holds bonus buys', await page.locator('button:has-text("Delete promotion")').isDisabled())

  // ── 6. multi-select activate ──
  const rowCheck = (n) => page.locator(`.ag-row[row-id="${n}"] .ag-selection-checkbox input`).first()
  // 2396 reversal: a Planned row is no longer offered Activate (28), so the run is over Tested,
  // Activated and Deactivated rows.
  await rowCheck('OMS000000004').check()
  await rowCheck('OMS000000003').check()
  await rowCheck('OMS000000002').check()
  check('Change is disabled on a multi-select', await page.locator('button:has-text("Change")').first().isDisabled())
  posts.length = 0
  await page.locator('button', { hasText: /^Activate$/ }).click()
  await page.waitForSelector('[role="status"]:has-text("Refused")')
  const acts = posts.filter(([op]) => op === 'BonusBuy/Activate').map(([, b]) => b.bbyNumber)
  check('6. one call per number, past the refusal', acts.length === 3 && new Set(acts).size === 3, acts.join(','))
  const report = await page.locator('[role="status"]').last().innerText()
  check('6. each number’s outcome is shown', ['OMS000000004', 'OMS000000002', 'OMS000000003'].every((n) => report.includes(n)) && report.includes('Done') && report.includes('BBY-030'))

  // ── 7. promotion activate refused ──
  const before = promotionGets
  await page.click('button:has-text("Activate promotion")')
  await page.locator('dialog button:has-text("Yes")').click()
  await page.waitForSelector('text=Nothing changed. These bonus buys were refused:')
  const flip = await page.locator('[role="status"]').last().innerText()
  check('7. every refused bonus buy is listed', flip.includes('OMS000000001') && flip.includes('OMS000000003'))
  check('7. every refusal, in both languages', ['BBY-051', 'BBY-020', 'BBY-030'].every((c) => flip.includes(c)) && flip.includes('تاريخ النهاية في الماضي.'))
  // 2396: the promotion-level Activate stays offered; its refusal names each untested bonus buy.
  check('7. the untested bonus buy is listed with its refusal, through the same report',
    flip.includes('BBY-NOT-TESTED') && flip.includes('Test it before activating.') && flip.includes('اختبره قبل التفعيل.'))
  await page.waitForTimeout(500)
  check('7. nothing changed, so the promotion was NOT refetched', promotionGets === before, `${before}→${promotionGets}`)

  // ── 8. copy ──
  await rowCheck('OMS000000002').uncheck()
  await rowCheck('OMS000000003').uncheck()
  await rowCheck('OMS000000004').uncheck()
  await rowCheck('OMS000000001').check()
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
  // ── 22–26. the upload dialog ──
  // Its own block: 417's section above declares the same helper names.
  {
    const ub = (row, serial, bbyNumber, bbyStatus = '1') => ({ row, serial, buyGroup: 'VICHY', getGroup: 'VICHY', bbyNumber, bbyStatus })
    const ur = (row, serial, code, english, arabic) => ({ row, serial, code, english, arabic })
    const answer = (over) => ({
      status: 'saved', promoNumber: PROMO.promoNumber, promotionCreated: false,
      created: [], updated: [], refusals: [], warnings: [], ...over,
    })
    const FILE = { name: 'Vichy 2nd p - 20 SR.txt', mimeType: 'text/plain', buffer: Buffer.from('1\tP000000001\tBBCH\tVichy 2 p @ 20 SR\n') }
    /** One scalar part's value out of a multipart body. */
    const part = (body, name) => {
      const at = body.indexOf(`name="${name}"`)
      if (at < 0) return undefined
      const start = body.indexOf('\r\n\r\n', at) + 4
      return body.slice(start, body.indexOf('\r\n', start))
    }
    const udlg = page.locator('dialog')
    const pick = (file = FILE) => udlg.locator('[data-testid="bby-upload-file"]').setInputFiles(file)
    const runUpload = async (label = /^Upload$/) => {
      await udlg.locator('button', { hasText: label }).click()
      await udlg.locator('[data-outcome]').waitFor()
    }
    const again = () => udlg.locator('button:has-text("Upload another file")').click()

    await page.goto(`${ROOT}/${PROMO.promoNumber}`)
    await page.waitForSelector('.ag-row')
    check('the Upload file button is live', await page.locator('button:has-text("Upload file")').isEnabled())
    await page.click('button:has-text("Upload file")')
    await udlg.locator('[data-testid="bby-upload-file"]').waitFor()

    // 26. an empty file never goes up
    uploads.length = 0
    await pick({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) })
    check('26. an empty file is refused before the round trip',
      (await udlg.innerText()).includes('The file is empty.') && (await udlg.locator('button', { hasText: /^Upload$/ }).isDisabled()) && uploads.length === 0)

    // 23. check only
    uploadAnswer = answer({
      status: 'valid',
      created: [ub(1, '1', null), ub(6, '2', null)],
      warnings: [ur(1, '1', 'BBY-060', 'Valid from is before the promotion.', 'تاريخ البداية قبل العرض.')],
    })
    let gets = promotionGets
    await pick()
    await udlg.locator('[data-testid="bby-upload-check-only"]').check()
    await runUpload(/^Check file$/)
    check('22. the file part carries its name', !!uploads[0]?.includes('filename="Vichy 2nd p - 20 SR.txt"'))
    check('22. validateOnly=true, and no activate part (2396)',
      part(uploads[0], 'validateOnly') === 'true' && part(uploads[0], 'activate') === undefined,
      `${part(uploads[0], 'validateOnly')}/${part(uploads[0], 'activate')}`)
    let out = await udlg.innerText()
    check('23. check only says it passed and that nothing was written', out.includes('passed the check') && out.includes('Nothing was written.'))
    check('23. …and lists what would be created, numberless',
      out.includes('Would be created') && (await udlg.locator('[data-testid="bby-upload-created"] tbody tr').count()) === 2 && out.includes('new'))
    check('23. …and its warnings in both languages', out.includes('BBY-060') && out.includes('تاريخ البداية قبل العرض.'))
    await page.waitForTimeout(500)
    check('23. a check-only run never refreshes the overview', promotionGets === gets, `${gets}→${promotionGets}`)

    // 24. refused
    uploadAnswer = answer({
      status: 'refused',
      refusals: [
        ur(0, '', 'BBY-UPLOAD-PROMOTION', 'The promotion must be P and 9 digits.', 'يجب أن يكون رقم العرض P و9 أرقام.'),
        ur(3, '1', 'BBY-030', 'Unknown material 999.', 'مادة غير معروفة 999.'),
        ur(9, '2', 'BBY-UPLOAD-PAIRS-CHANGED', 'Serial 2 changed its groups.', 'تغيرت مجموعات التسلسل 2.'),
      ],
    })
    await again()
    check('the options survive "Upload another file"', await udlg.locator('[data-testid="bby-upload-check-only"]').isChecked())
    await udlg.locator('[data-testid="bby-upload-check-only"]').uncheck()
    gets = promotionGets
    await pick()
    await runUpload()
    out = await udlg.innerText()
    const refusedRows = await udlg.locator('[data-testid="bby-upload-refused"] tbody tr').allInnerTexts()
    check('24. every refused row is listed', refusedRows.length === 3, String(refusedRows.length))
    check('24. row 0 reads as the whole file', !!refusedRows[0]?.includes('Whole file'))
    check('24. a row carries its number, serial, code and both texts',
      /3\s+1\s+BBY-030/.test(refusedRows[1] ?? '') && refusedRows[1].includes('مادة غير معروفة 999.'), JSON.stringify(refusedRows[1]))
    check('24. a refused file says nothing was written', out.includes('was refused') && out.includes('Nothing was written.'))
    await page.waitForTimeout(500)
    check('24. …and the overview is NOT refetched', promotionGets === gets, `${gets}→${promotionGets}`)

    // 25. a load creates, a second run updates
    uploadAnswer = answer({ created: [ub(1, '1', 'OMS000000101'), ub(6, '2', 'OMS000000102')] })
    await again()
    gets = promotionGets
    uploads.length = 0
    await pick()
    await runUpload()
    check('22. a load sends validateOnly=false and still no activate part',
      part(uploads[0], 'activate') === undefined && part(uploads[0], 'validateOnly') === 'false')
    out = await udlg.innerText()
    check('25. a load lists the created numbers',
      out.includes('loaded into promotion') && out.includes('OMS000000101') && out.includes('OMS000000102') && !out.includes('Nothing was written.'))
    check('25. …and they land Planned', (await udlg.locator('[data-testid="bby-upload-created"]').innerText()).includes('Planned'))
    await page.waitForTimeout(500)
    check('25. a load refreshes the overview', promotionGets > gets, `${gets}→${promotionGets}`)
    uploadAnswer = answer({ updated: [ub(1, '1', 'OMS000000101'), ub(6, '2', 'OMS000000102')] })
    await again()
    await pick()
    await runUpload()
    check('25. a second run lists the same numbers as updated, none created',
      (await udlg.locator('[data-testid="bby-upload-updated"] tbody tr').count()) === 2 &&
        (await udlg.locator('[data-testid="bby-upload-created"]').count()) === 0)

    // 26. the file names another promotion
    uploadAnswer = answer({ promoNumber: 'P000000047', promotionCreated: true, created: [ub(1, '1', 'OMS000000201')] })
    await again()
    await pick()
    await runUpload()
    out = await udlg.innerText()
    check('26. a promotion the file created is said', out.includes('was created from the file'))
    check('26. …with a link to it', (await udlg.locator('a[href$="/P000000047"]').count()) === 1)
    const ku = await rawKey()
    check('26. no raw i18n keys in the dialog', ku === null, (ku || [''])[0])
    await import('node:fs').then((fs) => fs.mkdirSync('tools/.bby-maintenance-shots', { recursive: true }))
    await page.screenshot({ path: 'tools/.bby-maintenance-shots/upload.png' }).catch(() => {})
    await udlg.locator('button', { hasText: /^Close$/ }).click()
  }

  // ════════ Ticket 419 — Tested and Back to Planned (spec 2396, STUBBED in the spec's reading) ════════
  {
    const EDIT = `${ROOT}/${PROMO.promoNumber}/bonus-buy`
    const acts419 = () => posts.filter(([op]) => op === 'BonusBuy/MarkTested' || op === 'BonusBuy/BackToPlanned')
    const button = (name) => page.locator('button', { hasText: new RegExp(`^${name}$`) })
    const last = () => page.locator('[role="status"]').last().innerText()
    const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')

    // ── 27. the overview reads Tested and its test mark ──
    await page.goto(`${ROOT}/${PROMO.promoNumber}`)
    await page.waitForSelector('.ag-row[row-id="OMS000000004"]')
    const tested = strip(await page.locator('.ag-row[row-id="OMS000000004"]').innerText())
    check('27. status 3 reads Tested in the overview', tested.includes('Tested'), JSON.stringify(tested))
    const headers = await page.locator('.ag-header-cell-text').allInnerTexts()
    check('27. the overview has Tested by / Tested at / Test note columns',
      ['Tested by', 'Tested at', 'Test note'].every((h) => headers.includes(h)), headers.join(','))
    const byCell = strip(await page.locator('.ag-row[row-id="OMS000000004"] [col-id="testedBy"]').innerText())
    const atCell = strip(await page.locator('.ag-row[row-id="OMS000000004"] [col-id="testedAt"]').innerText())
    const noteCell = strip(await page.locator('.ag-row[row-id="OMS000000004"] [col-id="testNote"]').innerText())
    check('27. …with the tester, the time and the note',
      byCell.trim() === 'ayed' && atCell.trim() === '2026-10-05 11:20' && noteCell.includes('20 SR'), `${byCell}|${atCell}|${noteCell}`)
    const untested = strip(await page.locator('.ag-row[row-id="OMS000000001"] [col-id="testedBy"]').innerText())
    check('27. an untested row is blank there', untested.trim() === '', JSON.stringify(untested))

    // ── 28. Activate is not offered on a Planned bonus buy ──
    const rowCheck419 = (n) => page.locator(`.ag-row[row-id="${n}"] .ag-selection-checkbox input`).first()
    await rowCheck419('OMS000000001').check()
    const activate = button('Activate')
    check('28. one Planned row: Activate is not offered', await activate.isDisabled())
    check('28. …and its hint says it must be tested first',
      (await activate.getAttribute('title')) === 'A Planned bonus buy must be tested before it can be activated.')
    await rowCheck419('OMS000000004').check()
    check('28. a multi-select holding a Planned row: still not offered', await activate.isDisabled())
    await rowCheck419('OMS000000001').uncheck()
    check('28. Tested alone: Activate is offered', await activate.isEnabled())
    check('28. the promotion-level Activate stays offered', await button('Activate promotion').isEnabled())

    // ── 29. Mark Tested on a Planned bonus buy, with the grant ──
    canTest = true
    markAnswer = 'saved'
    await page.goto(`${EDIT}/OMS000000001`)
    await page.waitForSelector('table[data-grid="get"]')
    check('29. Planned + canTest → Mark Tested is offered', (await button('Mark Tested').count()) === 1)
    check('29. Planned → no Back to Planned', (await button('Back to Planned').count()) === 0)
    check('29. Planned is editable', (await page.locator('fieldset[data-readonly="true"]').count()) === 0 && (await button('Save').count()) === 1)
    // An unsaved edit holds Mark Tested back: it would attest the saved version, not this one.
    const text419 = page.locator('input[maxlength="60"]')
    await text419.fill('edited, not saved')
    check('29. an unsaved edit holds Mark Tested back, saying why',
      (await button('Mark Tested').isDisabled()) && (await button('Mark Tested').getAttribute('title')) === 'Save your changes first: Mark Tested marks the saved bonus buy.')
    await text419.fill('OR when apply discount')
    check('29. …and putting it back releases it', await button('Mark Tested').isEnabled())
    posts.length = 0
    await button('Mark Tested').click()
    const tdlg = page.locator('dialog')
    await tdlg.locator('[data-testid="bby-test-note"]').fill('  Basket of two, 20 SR.  ')
    check('29. the note is held to 200', (await tdlg.locator('[data-testid="bby-test-note"]').getAttribute('maxlength')) === '200')
    const gets419 = bonusBuyGets
    await tdlg.locator('button', { hasText: /^Mark Tested$/ }).click()
    await page.waitForSelector('text=Marked Tested. It can now be activated.')
    const mt = acts419().find(([op]) => op === 'BonusBuy/MarkTested')?.[1]
    check('29. MarkTested posts exactly { number, note } (spec 2396 reading)',
      mt && JSON.stringify(Object.keys(mt).sort()) === '["note","number"]' && mt.number === 'OMS000000001' && mt.note === 'Basket of two, 20 SR.',
      JSON.stringify(mt))
    await page.waitForSelector('fieldset[data-readonly="true"]', { timeout: 5000 }).catch(() => {})
    check('29. the bonus buy is read again', bonusBuyGets > gets419, `${gets419}→${bonusBuyGets}`)
    const after = strip(await text())
    check('29. …and now reads Tested, locked, with its test mark',
      after.includes('Tested') && (await page.locator('fieldset[data-readonly="true"]').count()) === 1 &&
        after.includes('Basket of two, 20 SR.') && (await button('Mark Tested').count()) === 0)

    // ── 30. the four-eyes refusal is the server's ──
    statusOf.OMS000000001 = '1'
    delete markOf.OMS000000001
    markAnswer = 'fourEyes'
    await page.goto(`${EDIT}/OMS000000001`)
    await page.waitForSelector('table[data-grid="get"]')
    // The session user (msartawi) is the last writer: the client still offers the act.
    check('30. the last writer is NOT pre-blocked on the client', (await button('Mark Tested').count()) === 1)
    await button('Mark Tested').click()
    await tdlg.locator('button', { hasText: /^Mark Tested$/ }).click()
    await page.waitForSelector('text=Not marked Tested:')
    const fe = await last()
    check('30. the refusal is shown as the server worded it, EN + AR',
      fe.includes('BBY-TEST-OWN-WRITE') && fe.includes('Someone else must test it.') && fe.includes('يجب أن يختبره شخص آخر.'))
    const blankNote = acts419().filter(([op]) => op === 'BonusBuy/MarkTested').at(-1)?.[1]
    check('30. a blank note goes as null', blankNote && blankNote.note === null, JSON.stringify(blankNote))
    check('30. a refusal leaves it Planned and editable', (await page.locator('fieldset[data-readonly="true"]').count()) === 0)

    // ── 31. without the grant ──
    canTest = false
    await page.goto(`${EDIT}/OMS000000001`)
    await page.waitForSelector('table[data-grid="get"]')
    check('31. no canTest → no Mark Tested', (await button('Mark Tested').count()) === 0)
    canTest = true

    // ── 32. Tested: locked, its mark, Back to Planned without a warning ──
    await page.goto(`${EDIT}/OMS000000004`)
    await page.waitForSelector('table[data-grid="get"]')
    const tb = strip(await text())
    check('32. status 3 reads Tested in the editor header', tb.includes('Tested'))
    check('32. Tested opens read-only, with the lock hint',
      (await page.locator('fieldset[data-readonly="true"]').count()) === 1 && tb.includes('Only a Planned bonus buy can change.'))
    check('32. no Check, no Save, no Add line, no Mark Tested',
      (await page.locator('button', { hasText: /^(Check|Save|Mark Tested)$/ }).count()) === 0 && (await page.locator('button:has-text("Add line")').count()) === 0)
    check('32. the test mark: by, at and the note',
      (await page.locator('[data-testid="bby-test-mark"]').count()) === 1 && tb.includes('ayed') && tb.includes('2026-10-05 11:20') && tb.includes('Two Vichy items'))
    check('32. Copy is still offered', (await button('Copy').count()) === 1)
    posts.length = 0
    await button('Back to Planned').click()
    await page.waitForSelector('text=Back to Planned. It can be changed now')
    check('32. Tested goes back with no confirmation', (await page.locator('dialog[open]').count()) === 0)
    const bp = acts419().find(([op]) => op === 'BonusBuy/BackToPlanned')?.[1]
    check('32. BackToPlanned posts exactly { number } (spec 2396 reading)',
      bp && JSON.stringify(Object.keys(bp)) === '["number"]' && bp.number === 'OMS000000004', JSON.stringify(bp))
    await page.waitForFunction(() => !document.querySelector('fieldset[data-readonly="true"]'), null, { timeout: 5000 }).catch(() => {})
    check('32. …and the re-read opens it for change, its mark gone',
      (await page.locator('fieldset[data-readonly="true"]').count()) === 0 && (await page.locator('[data-testid="bby-test-mark"]').count()) === 0)

    // ── 33. Activated asks first ──
    await page.goto(`${EDIT}/OMS000000002`)
    await page.waitForSelector('table[data-grid="get"]')
    check('33. Activated is locked too', (await page.locator('fieldset[data-readonly="true"]').count()) === 1 && (await button('Save').count()) === 0)
    posts.length = 0
    await button('Back to Planned').click()
    const ask = page.locator('dialog[open]')
    await ask.waitFor()
    const askText = await ask.innerText()
    check('33. the confirmation warns the offer leaves the tills', askText.includes('pulls the offer off every till') && askText.includes('OMS000000002'))
    await ask.locator('button:has-text("No")').click()
    await page.waitForTimeout(300)
    check('33. No posts nothing', acts419().length === 0)
    await button('Back to Planned').click()
    await page.locator('dialog[open] button:has-text("Yes")').click()
    await page.waitForSelector('text=Back to Planned. It can be changed now')
    check('33. Yes takes it back', acts419().some(([op, b]) => op === 'BonusBuy/BackToPlanned' && b.number === 'OMS000000002'))

    // ── 34. Deactivated locked; SAP keeps its own hint and gets neither act ──
    await page.goto(`${EDIT}/OMS000000003`)
    await page.waitForSelector('table[data-grid="get"]')
    check('34. Deactivated is locked and offered Back to Planned',
      (await page.locator('fieldset[data-readonly="true"]').count()) === 1 && (await button('Back to Planned').count()) === 1)
    await page.goto(`${EDIT}/000100001124`)
    await page.waitForSelector('table[data-grid="get"]')
    const sapText = await text()
    check('34. a SAP bonus buy keeps the SAP hint, not the lock hint',
      sapText.includes('This is a SAP bonus buy.') && !sapText.includes('Only a Planned bonus buy can change.'))
    check('34. …and is offered neither Mark Tested nor Back to Planned',
      (await page.locator('button', { hasText: /^(Mark Tested|Back to Planned)$/ }).count()) === 0)
    const k419 = await rawKey()
    check('34. no raw i18n keys', k419 === null, (k419 || [''])[0])
    statusOf.OMS000000004 = '3'
    markOf.OMS000000004 = MARK
    await page.goto(`${EDIT}/OMS000000004`)
    await page.waitForSelector('table[data-grid="get"]')
    await page.screenshot({ path: 'tools/.bby-maintenance-shots/editor-tested.png', fullPage: true }).catch(() => {})
  }

  // ════════ Ticket 421 — the upload drops activate (spec 2396) ════════
  {
    const ur = (row, serial, code, english, arabic) => ({ row, serial, code, english, arabic })
    const FILE = { name: 'Vichy 24 cols.txt', mimeType: 'text/plain', buffer: Buffer.from('1\tP000000001\tBBCH\tVichy 2 p @ 20 SR\n') }
    const udlg = page.locator('dialog')
    await page.goto(`${ROOT}/${PROMO.promoNumber}`)
    await page.waitForSelector('.ag-row')
    await page.click('button:has-text("Upload file")')
    await udlg.locator('[data-testid="bby-upload-file"]').waitFor()

    // ── 35. no activate option; columns 23–24 explained ──
    const form = await udlg.innerText()
    check('35. the dialog offers no activate option',
      (await udlg.locator('[data-testid="bby-upload-activate"]').count()) === 0 && !form.includes('Activate new bonus buys'), JSON.stringify(form))
    check('35. …but still offers Check only', (await udlg.locator('[data-testid="bby-upload-check-only"]').count()) === 1)
    const cols = await udlg.locator('[data-testid="bby-upload-oms-columns"]').innerText()
    check('35. the help names 23 SCORE and 24 LOY_TIERS as OMS-only, and SAP refusing them',
      /23 SCORE/.test(cols) && /24 LOY_TIERS/.test(cols) && cols.includes('OMS-only') && cols.includes('SAP will not load'), cols)
    check('35. …and says uploads land Planned', form.includes('always land Planned'))

    // ── 36. a locked serial ──
    uploadAnswer = {
      status: 'refused', promoNumber: PROMO.promoNumber, promotionCreated: false, created: [], updated: [], warnings: [],
      refusals: [
        ur(0, '', 'BBY-UPLOAD-LOCKED', 'The file reaches a bonus buy that is not Planned. Nothing was written.', 'يصل الملف إلى عرض غير مخطط. لم يُكتب شيء.'),
        ur(14, '3', 'BBY-UPLOAD-LOCKED', 'Serial 3 is OMS000000090, which is Tested.', 'التسلسل 3 هو OMS000000090 وحالته مختبر.'),
      ],
    }
    uploads.length = 0
    const gets = promotionGets
    await udlg.locator('[data-testid="bby-upload-file"]').setInputFiles(FILE)
    await udlg.locator('button', { hasText: /^Upload$/ }).click()
    await udlg.locator('[data-outcome]').waitFor()
    check('36. the load went up once, without activate', uploads.length === 1 && !uploads[0].includes('name="activate"'))
    const rows = await udlg.locator('[data-testid="bby-upload-refused"] tbody tr').allInnerTexts()
    check('36. both refusals are listed', rows.length === 2, String(rows.length))
    check('36. row 0 still reads as the whole file', !!rows[0]?.includes('Whole file'))
    check('36. the locked serial shows its row, serial, code, number and status in both languages',
      /14\s+3\s+BBY-UPLOAD-LOCKED/.test(rows[1] ?? '') && rows[1].includes('OMS000000090, which is Tested') && rows[1].includes('وحالته مختبر'),
      JSON.stringify(rows[1]))
    const out = await udlg.innerText()
    check('36. the file was refused and nothing was written', out.includes('was refused') && out.includes('Nothing was written.'))
    await page.waitForTimeout(500)
    check('36. …and the overview is NOT refetched', promotionGets === gets, `${gets}→${promotionGets}`)
    const k421 = await rawKey()
    check('36. no raw i18n keys', k421 === null, (k421 || [''])[0])
    await page.screenshot({ path: 'tools/.bby-maintenance-shots/upload-locked.png' }).catch(() => {})
    await udlg.locator('button', { hasText: /^Close$/ }).click()
  }

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
