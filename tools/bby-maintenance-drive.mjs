// Bonus Buy Maintenance drive (BackOffice spec 2374) — drives the REAL app in Chromium
// against STUBBED `BbyMaintainWeb/*` envelopes.
//
// ⚠️ Stubbed because the doors are NOT BUILT: BackOffice 2376 and 2380 were open when
// ticket 416 landed. What a stub proves is the client's decisions; that the server answers
// these shapes is 2376/2380's to prove, and the owner's walk on a dev SIS.Api.
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
// Ticket 418 — the upload dialog (BbyMaintainWeb/Upload, BackOffice 2381/2382; the stub answers
// in the SHIPPED BbyUploadResult shape):
//  12. the multipart parts: file (its name), validateOnly, activate.
//  13. check only → "passed", nothing written, would-be rows, and the overview NOT refetched.
//  14. a refused file → every refused row (row, serial, code, EN + AR), nothing written, no refetch.
//  15. a load → created numbers, the overview refetched; a second run → updated numbers.
//  16. a file whose AKTNR names another promotion offers a link to it; an empty file never goes up.
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
const refusal = (code, en, ar, number) => ({ code, en, ar, number })

const PROMO = {
  promoNumber: 'P000000001',
  name: 'Test By Sartawi',
  salesFrom: '2026-10-05T00:00:00',
  salesTo: '2026-10-31T00:00:00',
  bonusBuys: [
    { bbyNumber: 'OMS000000001', text: '1 + 1', validFrom: '2026-10-05', validTo: '2026-10-31', status: '1' },
    { bbyNumber: 'OMS000000002', text: '10% - Coupon', validFrom: '2026-10-05', validTo: '2026-10-31', status: '' },
    { bbyNumber: 'OMS000000003', text: 'OR rewards', validFrom: '2026-10-05', validTo: '2026-10-31', status: '2' },
  ],
}
const EMPTY = { promoNumber: 'P000000002', name: 'Empty flyer', salesFrom: '2026-11-01', salesTo: '2026-11-30', bonusBuys: [] }

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
    if (path === 'BbyMaintainWeb/Access') return route.fulfill(envelope({ screenAllowed: allowed }))
    if (path === 'BbyMaintainWeb/Promotion/List')
      return route.fulfill(
        envelope([
          { promoNumber: PROMO.promoNumber, name: PROMO.name, salesFrom: PROMO.salesFrom, salesTo: PROMO.salesTo, bonusBuyCount: 3 },
          { promoNumber: EMPTY.promoNumber, name: EMPTY.name, salesFrom: EMPTY.salesFrom, salesTo: EMPTY.salesTo, bonusBuyCount: 0 },
        ]),
      )
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
      if (op === 'Promotion/Activate')
        return route.fulfill(
          envelope({
            status: 'refused',
            number: null,
            warnings: [],
            refusals: [
              refusal('BBY-051', 'Valid to is in the past.', 'تاريخ النهاية في الماضي.', 'OMS000000001'),
              refusal('BBY-020', 'A Price must be above zero.', 'يجب أن يكون السعر أكبر من صفر.', 'OMS000000001'),
              refusal('BBY-030', 'Unknown material 999.', 'مادة غير معروفة 999.', 'OMS000000003'),
            ],
          }),
        )
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
  const rawKey = async () => (await text()).match(/(?:bonus-buy-maintenance:)?(?:overview|promotion|list|create|copySap|editor|access|upload)\.[a-zA-Z.]+/)

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

  // ── 12–16. the upload dialog ──
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

  // 16. an empty file never goes up
  uploads.length = 0
  await pick({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) })
  check('16. an empty file is refused before the round trip',
    (await udlg.innerText()).includes('The file is empty.') && (await udlg.locator('button', { hasText: /^Upload$/ }).isDisabled()) && uploads.length === 0)

  // 13. check only
  uploadAnswer = answer({
    status: 'valid',
    created: [ub(1, '1', null), ub(6, '2', null)],
    warnings: [ur(1, '1', 'BBY-060', 'Valid from is before the promotion.', 'تاريخ البداية قبل العرض.')],
  })
  let gets = promotionGets
  await pick()
  await udlg.locator('[data-testid="bby-upload-check-only"]').check()
  await runUpload(/^Check file$/)
  check('12. the file part carries its name', !!uploads[0]?.includes('filename="Vichy 2nd p - 20 SR.txt"'))
  check('12. validateOnly=true, activate=false',
    part(uploads[0], 'validateOnly') === 'true' && part(uploads[0], 'activate') === 'false',
    `${part(uploads[0], 'validateOnly')}/${part(uploads[0], 'activate')}`)
  let out = await udlg.innerText()
  check('13. check only says it passed and that nothing was written', out.includes('passed the check') && out.includes('Nothing was written.'))
  check('13. …and lists what would be created, numberless',
    out.includes('Would be created') && (await udlg.locator('[data-testid="bby-upload-created"] tbody tr').count()) === 2 && out.includes('new'))
  check('13. …and its warnings in both languages', out.includes('BBY-060') && out.includes('تاريخ البداية قبل العرض.'))
  await page.waitForTimeout(500)
  check('13. a check-only run never refreshes the overview', promotionGets === gets, `${gets}→${promotionGets}`)

  // 14. refused
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
  check('14. every refused row is listed', refusedRows.length === 3, String(refusedRows.length))
  check('14. row 0 reads as the whole file', !!refusedRows[0]?.includes('Whole file'))
  check('14. a row carries its number, serial, code and both texts',
    /3\s+1\s+BBY-030/.test(refusedRows[1] ?? '') && refusedRows[1].includes('مادة غير معروفة 999.'), JSON.stringify(refusedRows[1]))
  check('14. a refused file says nothing was written', out.includes('was refused') && out.includes('Nothing was written.'))
  await page.waitForTimeout(500)
  check('14. …and the overview is NOT refetched', promotionGets === gets, `${gets}→${promotionGets}`)

  // 15. a load creates, a second run updates
  uploadAnswer = answer({ created: [ub(1, '1', 'OMS000000101', ''), ub(6, '2', 'OMS000000102', '')] })
  await again()
  gets = promotionGets
  uploads.length = 0
  await pick()
  await udlg.locator('[data-testid="bby-upload-activate"]').check()
  await runUpload()
  check('12. activate=true when ticked', part(uploads[0], 'activate') === 'true' && part(uploads[0], 'validateOnly') === 'false')
  out = await udlg.innerText()
  check('15. a load lists the created numbers',
    out.includes('loaded into promotion') && out.includes('OMS000000101') && out.includes('OMS000000102') && !out.includes('Nothing was written.'))
  check('15. …activated ones read Activated', (await udlg.locator('[data-testid="bby-upload-created"]').innerText()).includes('Activated'))
  await page.waitForTimeout(500)
  check('15. a load refreshes the overview', promotionGets > gets, `${gets}→${promotionGets}`)
  uploadAnswer = answer({ updated: [ub(1, '1', 'OMS000000101', ''), ub(6, '2', 'OMS000000102', '')] })
  await again()
  await udlg.locator('[data-testid="bby-upload-activate"]').uncheck()
  await pick()
  await runUpload()
  check('15. a second run lists the same numbers as updated, none created',
    (await udlg.locator('[data-testid="bby-upload-updated"] tbody tr').count()) === 2 &&
      (await udlg.locator('[data-testid="bby-upload-created"]').count()) === 0)

  // 16. the file names another promotion
  uploadAnswer = answer({ promoNumber: 'P000000047', promotionCreated: true, created: [ub(1, '1', 'OMS000000201')] })
  await again()
  await pick()
  await runUpload()
  out = await udlg.innerText()
  check('16. a promotion the file created is said', out.includes('was created from the file'))
  check('16. …with a link to it', (await udlg.locator('a[href$="/P000000047"]').count()) === 1)
  const ku = await rawKey()
  check('16. no raw i18n keys in the dialog', ku === null, (ku || [''])[0])
  await import('node:fs').then((fs) => fs.mkdirSync('tools/.bby-maintenance-shots', { recursive: true }))
  await page.screenshot({ path: 'tools/.bby-maintenance-shots/upload.png' }).catch(() => {})
  await udlg.locator('button', { hasText: /^Close$/ }).click()

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
