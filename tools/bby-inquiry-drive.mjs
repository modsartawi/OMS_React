// BBY Inquiry drive (ticket 062) — drives the REAL app in Chromium against MOCKED
// Bby/* envelopes, because SIS.Api's Bby/* endpoints don't exist yet (code-complete /
// runtime-blocked posture, like NC 032–038). Verifies the ticket's three flow Proof
// bullets:
//   1. access allowed + rows → the four-column grid renders active rows.
//   2. access allowed + empty rows → the no-results empty state (not a broken screen).
//   3. access 404 → screen SHOWN (fail-open); access screenAllowed:false → denied card
//      AND the Pricing menu leaf hidden.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/bby-inquiry-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199'
const URL = BASE + '/pricing/bonus-buy-inquiry'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { ok = true, status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const ROW = (over) => ({
  bbyNumber: '100234',
  description: 'Buy 2 Pepsi get 1 free',
  bbyProfile: 'STD',
  validFrom: '20260101',
  validTo: '20261231',
  validFromTime: '000000',
  validToTime: '235959',
  promoNumber: 'PR-9',
  linkCategoryBuy: 'A',
  linkCategoryGet: 'A',
  bbyStatus: 'A',
  offerId: 'OF-1',
  limitNumber: 0,
  minValue: 0,
  maxValue: 0,
  condTargetType: 'P',
  includes: '',
  excludes: '',
  score: 0,
  originFilter: '',
  priceListType: '',
  isStackable: false,
  allowNestedStacking: false,
  stackingExcludes: '',
  loyGroups: '',
  loyTiers: '',
  createdAt: '2026-07-01T10:00:00Z',
  createdBy: 'msartawi',
  isActive: true,
  ...over,
})

// scenario state, mutated between reloads
let scenario = { accessBody: { screenAllowed: true }, access404: false, rows: [ROW({}), ROW({ bbyNumber: '100235', description: '10% off shampoo', isActive: false, bbyStatus: 'I' })] }

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Bby/Access') {
      if (scenario.access404)
        return route.fulfill(envelope(null, { ok: false, status: 404, success: false, message: 'not found' }))
      return route.fulfill(envelope(scenario.accessBody))
    }
    if (path === 'Bby/List') return route.fulfill(envelope({ rows: scenario.rows, capReached: false }))
    // Any other probe/endpoint → benign empty success so no leaf crashes.
    return route.fulfill(envelope({}))
  })

  // ---- Scenario 1: allowed + rows ----
  scenario = { accessBody: { screenAllowed: true }, access404: false, rows: [ROW({}), ROW({ bbyNumber: '100235', description: '10% off shampoo', isActive: false, bbyStatus: 'I' })] }
  await page.goto(URL)
  await page.waitForSelector('.ag-row', { timeout: 15000 }).catch(() => {})
  const rowCount = await page.locator('.ag-row').count()
  check('allowed + rows → grid renders active rows', rowCount === 2, `${rowCount} rows`)
  const firstCell = await page.locator('.ag-row[row-index="0"] .ag-cell').first().innerText().catch(() => '')
  check('identity cell shows the BBY number', firstCell.includes('100234'), firstCell)
  const activeDot = await page.locator('.ag-row[row-index="0"] span[title]').count()
  check('active row shows the "valid today" marker', activeDot >= 1)
  const bodyText = await page.locator('main').innerText()
  check('status code A renders as its label (Activated)', bodyText.includes('Activated'), '')
  check('valid-from formatted yyyy-MM-dd', bodyText.includes('2026-01-01'))

  // menu leaf visible when allowed
  const leaf = await page.getByRole('link', { name: /BBY Inquiry/i }).count()
  check('Pricing menu shows the BBY Inquiry leaf when allowed', leaf >= 1)

  // ---- Scenario 2: allowed + empty ----
  scenario.rows = []
  await page.reload()
  await page.waitForLoadState('networkidle')
  const emptyText = await page.locator('main').innerText()
  check('allowed + empty rows → no-results empty state', emptyText.includes('No Bonus Buys'), '')
  check('empty state, not a grid', (await page.locator('.ag-row').count()) === 0)

  // ---- Scenario 3a: access 404 → fail-open (shown) ----
  scenario = { access404: true, rows: [ROW({})] }
  await page.reload()
  await page.waitForSelector('.ag-row', { timeout: 15000 }).catch(() => {})
  check('access 404 → screen SHOWN (fail-open), grid renders', (await page.locator('.ag-row').count()) === 1)
  const leaf404 = await page.getByRole('link', { name: /BBY Inquiry/i }).count()
  check('access 404 → menu leaf still shown (fail-open)', leaf404 >= 1)

  // ---- Scenario 3b: screenAllowed:false → denied card + leaf hidden ----
  scenario = { accessBody: { screenAllowed: false }, access404: false, rows: [ROW({})] }
  await page.reload()
  await page.waitForLoadState('networkidle')
  const deniedText = await page.locator('main').innerText()
  check('screenAllowed:false → in-page denied card', deniedText.includes('No access'), '')
  check('screenAllowed:false → grid NOT rendered', (await page.locator('.ag-row').count()) === 0)
  const leafDenied = await page.getByRole('link', { name: /BBY Inquiry/i }).count()
  check('screenAllowed:false → menu leaf hidden', leafDenied === 0, `${leafDenied} leaves`)

  // The fail-open scenario (3a) intentionally 404s Bby/Access, which the browser logs
  // as a resource-load 404 — expected, not an app fault. Filter it out.
  const realErrors = errors.filter((e) => !/status of 404/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
