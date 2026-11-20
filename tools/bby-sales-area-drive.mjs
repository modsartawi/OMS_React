// Ticket 932 drive — a promotion is written for KSA or Bahrain (BackOffice spec 4096). Drives the REAL
// app in Chromium against STUBBED `BbyMaintainWeb/*` envelopes.
//
// ⚠️ Stubbed on a GUESSED contract: BO 4097 (the pair on the promotion) and BO 4098 (the locked flag and
// its refusal) are NOT built. The stubs answer in the reading of `src/core/models/bonus-buy-maintenance.ts`
// (`salesOrganization`, `distributionChannel`, `currency`, `salesAreaLocked` on the promotion; the pair on
// `Promotion/Save`). The refusal code `BBY-SALES-AREA-LOCKED` is invented here; the screen shows any code.
// Reconcile when BO 4097/4098 ship; the live walk is owed then.
//
//   1. the list's Sales area column: a promotion with no pair reads KSA; a 1000 / 21 one reads Bahrain.
//   2. Create promotion: KSA preselected; picking Bahrain posts 1000 / 21 and opens the minted promotion,
//      which reads Bahrain with the select open (empty promotion).
//   3. a promotion holding bonus buys: the select is disabled with its one-line reason, and a name-only
//      Save still sends the promotion's own pair.
//   4. an old no-pair KSA promotion: a name-only Save sends no pair; moved to Bahrain: Save sends 1000 / 21; the server's refusal is shown as
//      any other (code, EN + AR).
//   5. no raw i18n keys; no page errors.
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
  salesOrganizationName: 'Al-Dawaa Domestic', distributionChannelName: 'Bahrain Retail',
}
// An old-server KSA promotion: no pair at all → reads KSA.
const KSA_OLD = { status: 'found', promoNumber: 'P000000001', name: 'Riyadh flyer', salesFrom: '2026-12-01', salesTo: '2026-12-31', bonusBuys: [] }
// A Bahrain promotion holding a bonus buy: the server says locked (BO 4098).
const BH_LOCKED = {
  status: 'found', promoNumber: 'P000000003', name: 'Manama flyer', salesFrom: '2026-12-01', salesTo: '2026-12-31',
  ...BAHRAIN, salesAreaLocked: true,
  bonusBuys: [{ bbyNumber: 'OMS000000301', description: '1 + 1', validFrom: '2026-12-01', validTo: '2026-12-31', bbyStatus: '1' }],
}
// What Create mints: an empty Bahrain promotion.
const BH_NEW = { status: 'found', promoNumber: 'P000000009', name: 'Bahrain launch', salesFrom: '2026-12-01', salesTo: '2026-12-31', ...BAHRAIN, salesAreaLocked: false, bonusBuys: [] }

const posts = []

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
    if (path === 'BbyMaintainWeb/Promotion/Save') {
      const body = JSON.parse(req.postData() || '{}')
      posts.push(body)
      if (!body.promoNumber) return route.fulfill(envelope(saved(BH_NEW.promoNumber)))
      if (body.promoNumber === KSA_OLD.promoNumber && body.distributionChannel === '21')
        return route.fulfill(envelope({
          status: 'refused', number: body.promoNumber, warnings: [],
          refusals: [{ code: 'BBY-SALES-AREA-LOCKED', english: 'Promotion P000000001 holds a bonus buy; its sales area cannot change.', arabic: 'العرض الترويجي P000000001 يضم عرض شراء؛ لا يمكن تغيير منطقة البيع.' }],
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
  check('3. a name-only Save still sends the promotion’s own pair',
    nameSave.promoNumber === 'P000000003' && nameSave.name === 'Manama flyer 2' && nameSave.salesOrganization === '1000' && nameSave.distributionChannel === '21',
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
    body.includes('BBY-SALES-AREA-LOCKED') && body.includes('its sales area cannot change') && body.includes('لا يمكن تغيير منطقة البيع'))

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
