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
// last Bby/List query string seen (assert Search sends the built params), and the
// list response controls for the 064 flow (cap banner + a business date error).
let lastListQuery = ''

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
    if (path === 'Bby/List') {
      lastListQuery = url.includes('?') ? url.split('?')[1] : ''
      if (scenario.listError)
        return route.fulfill(
          envelope(null, {
            ok: false,
            status: 400,
            success: false,
            message: 'End date is before start date.',
            errors: [{ errorCode: 'INVALID_DATE_RANGE', message: 'End date is before start date.' }],
          }),
        )
      return route.fulfill(envelope({ rows: scenario.rows, capReached: scenario.capReached === true }))
    }
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

  // ---- ticket 063: the full 28-field grouped grid ----
  // AG Grid horizontally virtualizes columns, so DOM-count won't see all 28. Read the
  // authoritative total off aria-colcount, and union header text across a scroll sweep.
  const colCount = await page.locator('[role="treegrid"], [role="grid"]').first().getAttribute('aria-colcount')
  check('grid exposes all 28 columns (aria-colcount)', Number(colCount) === 28, `aria-colcount=${colCount}`)

  // Sweep the horizontal scroll, unioning every header + cell label we pass.
  const seen = new Set()
  const soak = async () => {
    ;(await page.locator('.ag-header-cell-text, .ag-header-group-text, .ag-cell').allInnerTexts()).forEach((s) => seen.add(s.trim()))
  }
  await soak()
  const maxScroll = await page.evaluate(() => {
    const vp = document.querySelector('.ag-body-horizontal-scroll-viewport')
    return vp ? vp.scrollWidth : 0
  })
  for (let x = 400; x <= maxScroll; x += 400) {
    await page.evaluate((sx) => {
      const vp = document.querySelector('.ag-body-horizontal-scroll-viewport')
      if (vp) vp.scrollLeft = sx
    }, x)
    await page.waitForTimeout(60)
    await soak()
  }

  const groups = ['Identity & offer', 'Validity', 'Buy/Get rules', 'Stacking', 'Loyalty', 'Audit']
  const missingGroups = groups.filter((g) => !seen.has(g))
  check('grid shows all six grouped headers', missingGroups.length === 0, missingGroups.join(', '))

  // Sticky identity column is pinned to the start (its own pinned-left containers).
  const pinnedText = (await page.locator('[class*="pinned-left"]').allInnerTexts()).join(' ')
  check(
    'identity column is pinned (sticky), carries the BBY number',
    pinnedText.includes('BBY #') && pinnedText.includes('100234'),
    pinnedText.replace(/\n/g, ' ').slice(0, 120),
  )

  // Details ▸ action renders per row and is clickable (modal wired in 066).
  const detailsBtns = await page.getByRole('button', { name: /Details/i }).count()
  check('Details action renders per row', detailsBtns === 2, `${detailsBtns} buttons`)
  await page.getByRole('button', { name: /Details/i }).first().click()
  check('Details button is clickable (no crash)', true)

  // Chips/labels seen during the sweep: And/Or link, Product target.
  check('link code A renders as And', seen.has('And'), '')
  check('condTarget P renders as Product', seen.has('Product'), '')

  // Filter row toggle (WPF ShowAutoFilterRow) — off by default, on after click.
  check('filter row hidden by default', (await page.locator('.ag-floating-filter').count()) === 0)
  await page.getByRole('button', { name: /Filter row/i }).click()
  await page.waitForTimeout(200)
  check('filter row appears after toggle', (await page.locator('.ag-floating-filter').count()) > 0)

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

  // ---- ticket 064: search toolbar (filtered chip + cap banner + date error) ----
  scenario = { accessBody: { screenAllowed: true }, access404: false, rows: [ROW({}), ROW({ bbyNumber: '100235', isActive: false, bbyStatus: 'I' })], capReached: false, listError: false }
  await page.goto(URL)
  await page.waitForSelector('.ag-row', { timeout: 15000 }).catch(() => {})
  check('search toolbar renders (BBY number field)', (await page.getByLabel(/BBY number/i).count()) >= 1)

  // Search by number → Bby/List queried with activeOnly cleared + the number, filtered chip shows.
  scenario.capReached = true
  await page.getByLabel(/BBY number/i).fill('100234')
  await page.getByRole('button', { name: /^Search$/i }).click()
  await page.waitForTimeout(400)
  check('Search sends activeOnly=false + bbyNumber (number clears Active only)', /activeOnly=false/.test(lastListQuery) && /bbyNumber=100234/.test(lastListQuery), lastListQuery)
  const chipCount = await page.getByText(/^Filtered$/).count()
  check('filtered chip shows after a search', chipCount >= 1)
  check('cap-reached amber banner shows when capReached', (await page.getByText(/first 1,000/i).count()) >= 1)

  // Reset → back to the active-only default: chip gone, query reverts to activeOnly=true only.
  scenario.capReached = false
  await page.getByRole('button', { name: /^Reset$/i }).click()
  await page.waitForTimeout(400)
  check('Reset restores active-only default (activeOnly=true, no bbyNumber)', /activeOnly=true/.test(lastListQuery) && !/bbyNumber=/.test(lastListQuery), lastListQuery)
  check('filtered chip gone after Reset', (await page.getByText(/^Filtered$/).count()) === 0)
  check('cap banner gone after Reset', (await page.getByText(/first 1,000/i).count()) === 0)

  // Reversed dates → business error 400 INVALID_DATE_RANGE → server message surfaced (not "unexpected").
  scenario.capReached = false
  scenario.listError = true
  await page.getByLabel(/Active during — from/i).fill('2026-12-31')
  await page.getByLabel(/Active during — to/i).fill('2026-01-01')
  await page.getByRole('button', { name: /^Search$/i }).click()
  await page.waitForTimeout(400)
  const errText = await page.locator('[role="alert"]').innerText().catch(() => '')
  check('date error surfaces the server message (not "unexpected")', /before start date/i.test(errText) && !/unexpected/i.test(errText), errText.slice(0, 80))
  check('date error carries the code-driven "Check the dates" title (apiErrorCode branch)', /Check the dates/i.test(errText), errText.slice(0, 80))
  scenario.listError = false

  // ---- ticket 065: Export CSV writes all 28 raw fields of the current set ----
  await page.getByRole('button', { name: /^Reset$/i }).click()
  await page.waitForTimeout(400)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Export CSV/i }).click(),
  ])
  const fs = require('fs')
  const csvPath = await download.path()
  const csv = fs.readFileSync(csvPath, 'utf8')
  const headerLine = csv.split(/\r?\n/)[0].replace(/^﻿/, '')
  const headerCols = headerLine.split(',').length
  check('CSV header carries all 28 columns', headerCols === 28, `${headerCols} cols`)
  check('CSV header includes BBY # + Valid from + Status', /BBY #/.test(headerLine) && /Valid from/.test(headerLine) && /Status/.test(headerLine), headerLine.slice(0, 80))
  // Raw values, not display chips: yyyyMMdd date + single-letter status code, NOT "2026-01-01"/"Activated".
  check('CSV cells are RAW (20260101 date, "A" status), not formatted', /20260101/.test(csv) && /(^|,)"?A"?(,|$)/m.test(csv) && !/Activated/.test(csv) && !/2026-01-01/.test(csv), '')

  // The fail-open scenario (3a) intentionally 404s Bby/Access, which the browser logs
  // as a resource-load 404 — expected, not an app fault. Filter it out.
  // The date-error scenario (064) intentionally returns 400 INVALID_DATE_RANGE — a
  // business outcome surfaced in-page, logged by the browser as a resource 400. Expected.
  const realErrors = errors.filter((e) => !/status of 404/.test(e) && !/status of 400/.test(e))
  check('no uncaught page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
