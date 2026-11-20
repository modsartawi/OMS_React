// Ticket 932 drive — a promotion is written for KSA or Bahrain (BackOffice spec 4096). Drives the REAL
// app in Chromium against STUBBED `BbyMaintainWeb/*` envelopes.
//
// Stubs reconciled to the SHIPPED contract, BackOffice pricing2 e35485209 (4097 9c4d77c7c, 4098 0ac324ed9,
// review 1648fd2c3): `Promotion/List` rows and `Promotion/{number}` are `BbyPromotionDocument` (the pair,
// `currency`, `salesAreaEnglish` / `salesAreaArabic`, `salesAreaLocked`); `Promotion/Save` takes the pair
// (none on a change = keep the promotion's own); the lock refusal is `BBY-SALES-AREA-LOCKED` in its shipped
// text; `Upload` takes optional `salesOrganization` / `distributionChannel` form fields for a promotion the
// file creates. Still stubbed: the live walk is owed after the BackOffice deploy.
//
//   1. the list's Sales area column: a promotion with no pair (a pre-4096 server) reads KSA; a 1000 / 21
//      one reads Bahrain.
//   2. Create promotion: KSA preselected; picking Bahrain posts 1000 / 21 and opens the minted promotion,
//      which reads Bahrain with the select open (empty promotion).
//   3. a promotion holding bonus buys: the select is disabled with its one-line reason, and a name-only
//      Save sends no pair (the server keeps the promotion's own).
//   4. an old no-pair KSA promotion: a name-only Save sends no pair; moved to Bahrain: Save sends 1000 / 21;
//      the server's refusal is shown as any other (code, EN + AR).
//   5. no raw i18n keys; no page errors.
//   6. Upload from the Bahrain promotion sends salesOrganization 1000 / distributionChannel 21 (so a promotion
//      the file creates is Bahrain); from the no-pair promotion it sends neither.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/bby-sales-area-drive.mjs
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROOT = BASE + '/pricing/bonus-buy-maintenance'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const saved = (number) => ({ status: 'saved', number, refusals: [], warnings: [] })
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')

const BAHRAIN = {
  salesOrganization: '1000', distributionChannel: '21', currency: 'BHD',
  salesAreaEnglish: 'Bahrain retail — 1000 / 21 — BHD', salesAreaArabic: 'التجزئة - البحرين — 1000 / 21 — BHD',
}
const AUDIT = { createdBy: 'msartawi', createdAt: '2026-11-20T09:00:00', changedBy: 'msartawi', changedAt: '2026-11-20T09:00:00' }
// An old-server KSA promotion: no pair at all → reads KSA.
const KSA_OLD = { status: 'found', promoNumber: 'P000000001', name: 'Riyadh flyer', salesFrom: '2026-12-01', salesTo: '2026-12-31', bonusBuys: [] }
// A Bahrain promotion holding a bonus buy: the server says locked (BO 4098).
const BH_LOCKED = {
  status: 'found', promoNumber: 'P000000003', name: 'Manama flyer', salesFrom: '2026-12-01', salesTo: '2026-12-31',
  ...AUDIT, ...BAHRAIN, salesAreaLocked: true,
  bonusBuys: [{ bbyNumber: 'OMS000000301', description: '1 + 1', validFrom: '2026-12-01', validTo: '2026-12-31', bbyStatus: '1' }],
}
// What Create mints: an empty Bahrain promotion.
const BH_NEW = { status: 'found', promoNumber: 'P000000009', name: 'Bahrain launch', salesFrom: '2026-12-01', salesTo: '2026-12-31', ...AUDIT, ...BAHRAIN, salesAreaLocked: false, bonusBuys: [] }

const posts = []
const uploads = []
// The shipped BbyUploadResult: the file's P number was unknown, so the upload created it.
const UPLOADED = {
  status: 'saved', promoNumber: 'P000000010', promotionCreated: true,
  created: [{ row: 1, serial: '1', buyGroup: 'VICHY', getGroup: 'VICHY', bbyNumber: 'OMS000000401', bbyStatus: '1' }],
  updated: [], refusals: [], warnings: [],
}
/** A multipart form field's value, or undefined when the part is absent. */
const part = (body, name) => {
  const at = body.indexOf(`name="${name}"`)
  if (at < 0) return undefined
  const start = body.indexOf('\r\n\r\n', at) + 4
  return body.slice(start, body.indexOf('\r\n', start))
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const path = req.url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(['BbyMaintain:03']))
    if (path === 'BbyMaintainWeb/Promotion/List') return route.fulfill(envelope([KSA_OLD, BH_LOCKED]))
    if (path === `BbyMaintainWeb/Promotion/${KSA_OLD.promoNumber}`) return route.fulfill(envelope(KSA_OLD))
    if (path === `BbyMaintainWeb/Promotion/${BH_LOCKED.promoNumber}`) return route.fulfill(envelope(BH_LOCKED))
    if (path === `BbyMaintainWeb/Promotion/${BH_NEW.promoNumber}`) return route.fulfill(envelope(BH_NEW))
    if (path === 'BbyMaintainWeb/Upload') {
      uploads.push(req.postData() || '')
      return route.fulfill(envelope(UPLOADED))
    }
    if (path === 'BbyMaintainWeb/Promotion/Save') {
      const body = JSON.parse(req.postData() || '{}')
      posts.push(body)
      if (!body.promoNumber) return route.fulfill(envelope(saved(BH_NEW.promoNumber)))
      if (body.promoNumber === KSA_OLD.promoNumber && body.distributionChannel === '21')
        return route.fulfill(envelope({
          status: 'refused', number: body.promoNumber, warnings: [],
          // BbyMaintainRefusals.SalesAreaLocked, as shipped (a bonus buy landed since the page was read).
          refusals: [{
            code: 'BBY-SALES-AREA-LOCKED',
            english: "Promotion 'P000000001' holds 1 bonus buy(s), so its sales area stays 1000 / 20 and cannot become 1000 / 21: amounts already authored in one currency would be re-read in another.",
            arabic: "العرض الترويجي 'P000000001' يحتوي على 1 من عروض الشراء، لذا تبقى منطقة مبيعاته 1000 / 20 ولا يمكن أن تصبح 1000 / 21: المبالغ المُدخلة بعملة ستُقرأ بعملة أخرى.",
          }],
        }))
      return route.fulfill(envelope(saved(body.promoNumber)))
    }
    return route.fulfill(envelope({}))
  })

  const text = () => page.locator('body').innerText()
  const rawKey = async () => (await text()).match(/(?:bonus-buy-maintenance:)?(?:salesArea|list|create|promotion)\.[a-zA-Z.]+/)
  const select = page.locator('[data-testid="bby-sales-area"]')

  // ── 1. the list column ──
  await page.goto(ROOT)
  await page.waitForSelector('.ag-row[row-id="P000000003"]')
  const cell = async (n) => strip(await page.locator(`.ag-row[row-id="${n}"] [col-id="salesArea"]`).innerText()).trim()
  check('1. the list has a Sales area column', (await page.locator('.ag-header-cell[col-id="salesArea"]').innerText()).includes('Sales area'))
  check('1. a promotion with no pair reads KSA', (await cell('P000000001')) === 'KSA retail · 1000 / 20 · SAR', await cell('P000000001'))
  check('1. a 1000 / 21 promotion reads Bahrain', (await cell('P000000003')) === 'Bahrain retail · 1000 / 21 · BHD', await cell('P000000003'))

  // ── 2. create a Bahrain promotion ──
  await page.click('text=Create promotion')
  const dlg = page.locator('dialog')
  check('2. Create preselects KSA', (await dlg.locator('[data-testid="bby-sales-area"]').inputValue()) === 'ksa')
  const options = (await dlg.locator('[data-testid="bby-sales-area"] option').allInnerTexts()).map(strip)
  check('2. two named entries with pair and currency',
    JSON.stringify(options) === JSON.stringify(['KSA retail · 1000 / 20 · SAR', 'Bahrain retail · 1000 / 21 · BHD']), JSON.stringify(options))
  await dlg.locator('input[type="text"]').fill('Bahrain launch')
  await dlg.locator('input[type="date"]').nth(0).fill('2026-12-01')
  await dlg.locator('input[type="date"]').nth(1).fill('2026-12-31')
  await dlg.locator('[data-testid="bby-sales-area"]').selectOption('bahrain')
  await dlg.locator('button:has-text("Create")').click()
  await page.waitForURL('**/bonus-buy-maintenance/P000000009')
  const create = posts[0]
  check('2. Create posts no number and 1000 / 21',
    create && create.promoNumber === null && create.salesOrganization === '1000' && create.distributionChannel === '21', JSON.stringify(create))
  await page.waitForSelector('text=No bonus buys in this promotion yet.')
  check('2. the new promotion reads Bahrain', (await select.inputValue()) === 'bahrain')
  check('2. …and its select is open (no bonus buy yet)', await select.isEnabled())
  await page.screenshot({ path: 'tools/.bby-sales-area-shots/created.png', fullPage: true }).catch(() => {})

  // ── 3. the locked select ──
  await page.goto(`${ROOT}/${BH_LOCKED.promoNumber}`)
  await page.waitForSelector('.ag-row')
  check('3. a promotion holding bonus buys reads Bahrain', (await select.inputValue()) === 'bahrain')
  check('3. …with the select disabled', await select.isDisabled())
  check('3. …and its one-line reason', (await text()).includes('Locked: this promotion holds bonus buys'))
  const hintId = await select.getAttribute('aria-describedby')
  check('3. the reason describes the select', !!hintId)
  const nameBox = page.locator('input[type="text"]').nth(1)
  await nameBox.fill('Manama flyer 2')
  await page.locator('button:has-text("Save")').first().click()
  await page.waitForSelector('text=Promotion saved.')
  const nameSave = posts.at(-1)
  check('3. a name-only Save sends no pair (the server keeps the promotion’s own)',
    nameSave.promoNumber === 'P000000003' && nameSave.name === 'Manama flyer 2' && !('salesOrganization' in nameSave) && !('distributionChannel' in nameSave),
    JSON.stringify(nameSave))
  await page.screenshot({ path: 'tools/.bby-sales-area-shots/locked.png', fullPage: true }).catch(() => {})

  // ── 4. moving an empty KSA promotion, refused by the server ──
  await page.goto(`${ROOT}/${KSA_OLD.promoNumber}`)
  await page.waitForSelector('text=No bonus buys in this promotion yet.')
  check('4. an old promotion with no pair reads KSA, open', (await select.inputValue()) === 'ksa' && (await select.isEnabled()))
  const saveBtn = page.locator('button:has-text("Save")').first()
  check('4. Save waits for a change', await saveBtn.isDisabled())
  // Review fix: a name-only save of a document with no pair sends none back (never invents 1000 / 20).
  await page.locator('input[type="text"]').nth(1).fill('Riyadh flyer 2')
  await saveBtn.click()
  await page.waitForSelector('text=Promotion saved.')
  const oldSave = posts.at(-1)
  check('4. a name-only Save of a no-pair promotion sends no pair',
    oldSave.promoNumber === 'P000000001' && oldSave.name === 'Riyadh flyer 2' && !('salesOrganization' in oldSave) && !('distributionChannel' in oldSave),
    JSON.stringify(oldSave))
  await select.selectOption('bahrain')
  check('4. picking Bahrain enables Save', await saveBtn.isEnabled())
  await saveBtn.click()
  await page.waitForSelector('text=The promotion could not be saved.')
  const moved = posts.at(-1)
  check('4. Save sends 1000 / 21', moved.salesOrganization === '1000' && moved.distributionChannel === '21', JSON.stringify(moved))
  const body = await text()
  check('4. the refusal is shown with its code, EN and AR',
    body.includes('BBY-SALES-AREA-LOCKED') && body.includes('cannot become 1000 / 21') && body.includes('ولا يمكن أن تصبح'))

  // ── 6. the upload carries the page promotion's sales area ──
  const FILE = { name: 'Bahrain launch 2.txt', mimeType: 'text/plain', buffer: Buffer.from('1\tP000000010\n') }
  const upload = async (promoNumber) => {
    await page.goto(`${ROOT}/${promoNumber}`)
    await page.waitForSelector('button:has-text("Upload file")')
    await page.click('button:has-text("Upload file")')
    const udlg = page.locator('dialog')
    await udlg.locator('[data-testid="bby-upload-file"]').setInputFiles(FILE)
    await udlg.locator('button', { hasText: /^Upload$/ }).click()
    await udlg.locator('[data-outcome]').waitFor()
    return uploads.at(-1) || ''
  }
  const bh = await upload(BH_LOCKED.promoNumber)
  check('6. an upload from a Bahrain promotion sends 1000 / 21',
    part(bh, 'salesOrganization') === '1000' && part(bh, 'distributionChannel') === '21' && part(bh, 'validateOnly') === 'false',
    JSON.stringify([part(bh, 'salesOrganization'), part(bh, 'distributionChannel')]))
  const old = await upload(KSA_OLD.promoNumber)
  check('6. an upload from a no-pair promotion sends no pair (the door reads none as KSA)',
    !!old && part(old, 'salesOrganization') === undefined && part(old, 'distributionChannel') === undefined)

  // ── 5. hygiene ──
  const k = await rawKey()
  check('5. no raw i18n keys', k === null, (k || [''])[0])
  check('5. no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

await import('node:fs').then((fs) => fs.mkdirSync('tools/.bby-sales-area-shots', { recursive: true }))
run()
