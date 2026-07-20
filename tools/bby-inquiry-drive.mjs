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

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
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

// ticket 066 — Bby/Detail payloads (BbyDetailDto contract 058). A rows-mode BBY with
// a grouping Buy row (members chip) + two Get conditions, and a Document total-discount.
const DETAIL_ROWS = {
  header: {
    bbyNumber: '100234', description: 'Buy 2 Panadol, get 1 free', bbyProfile: 'HEALTH_PROMO',
    validFrom: '20260101', validTo: '20261231', validFromTime: '000000', validToTime: '235959',
    promoNumber: 'PR-24817', offerId: 'OFR-6621', linkCategoryBuy: 'A', linkCategoryGet: 'O',
    bbyStatus: 'A', condTargetType: 'M', minValue: 0, maxValue: 0, limitNumber: 1, score: 100,
    isStackable: false, allowNestedStacking: false, loyGroups: 'NAHDI_PLUS', loyTiers: 'GOLD',
    includes: '', excludes: 'TOBACCO',
  },
  org: { salesOrganization: '1000', distributionChannel: '10', plant: '1201', currency: 'SAR' },
  buy: [
    // A grouping standing for 42 SKUs → the paged members drilldown (067), 3 pages of 20.
    { lineItemPos: '10', prereqType: 'MGP', isGrouping: true, identifier: 'GRP-PANADOL-24',
      materialNumber: null, description: null, qty: 2, uom: 'EA', minValue: 0, memberCount: 42 },
  ],
  get: [
    { condNumber: '01', isGrouping: false, identifier: '5900001234', materialNumber: '5900001234',
      description: 'Panadol Extra 24s', discountType: '%', conditionType: 'ZB03', condValue: 0,
      condValueP: 100, scaleType: 'A', qty: 1, uom: 'EA', pricingUnit: 1, pricingUnitUom: 'EA', memberCount: 0 },
    { condNumber: '02', isGrouping: false, identifier: '5900004417', materialNumber: '5900004417',
      description: 'Panadol Cold 24s', discountType: 'R', conditionType: 'ZB02', condValue: 8.5,
      condValueP: 0, scaleType: 'A', qty: 1, uom: 'EA', pricingUnit: 1, pricingUnitUom: 'EA', memberCount: 0 },
    // A Get-side grouping keyed by condNumber (067) — drilldown opens with side=get.
    { condNumber: '03', isGrouping: true, identifier: 'GRP-VITAMINS-8', materialNumber: null,
      description: null, discountType: '%', conditionType: 'ZB03', condValue: 0, condValueP: 20,
      scaleType: 'A', qty: 1, uom: 'EA', pricingUnit: 1, pricingUnitUom: 'EA', memberCount: 8 },
  ],
  totalDiscount: null,
}

// ticket 067 — Bby/GroupingMembers pages (BbyGroupMembersDto). One deterministic
// page slice per (side, groupingKey, page); `total` drives the pager range/footer.
const MEMBERS_TOTAL = { buy: 42, get: 8 }
const memberPage = (side, groupingKey, page, pageSize) => {
  const total = MEMBERS_TOTAL[side] ?? 0
  const start = (page - 1) * pageSize
  const members = []
  for (let i = start; i < Math.min(start + pageSize, total); i++) {
    members.push({
      materialNumber: `${side === 'buy' ? '5900' : '4400'}${String(i + 1).padStart(4, '0')}`,
      description: `${side} member ${i + 1}`,
      qty: 1,
      uom: 'EA',
    })
  }
  return { side, groupingKey, total, page, pageSize, members }
}
let lastMembersQuery = ''
const DETAIL_DOC = {
  header: {
    ...DETAIL_ROWS.header, bbyNumber: '100235', description: 'Al-Rajhi card — 5% off basket',
    condTargetType: 'R', minValue: 100, bbyStatus: 'A',
  },
  org: { ...DETAIL_ROWS.org },
  buy: [],
  get: [],
  totalDiscount: { discountType: '%', conditionType: 'ZB03', condValue: 0, condValueP: 5, requirement: 100 },
}

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
    if (path === 'Bby/Detail') {
      // ticket 066 — the modal payload. `detailMode` selects the branch under test.
      const mode = scenario.detailMode || 'rows'
      if (mode === 'notfound')
        return route.fulfill(
          envelope(null, {
            ok: false,
            status: 404,
            success: false,
            message: 'This Bonus Buy has no detail record.',
            errors: [{ errorCode: 'BBY_NOT_FOUND', message: 'This Bonus Buy has no detail record.' }],
          }),
        )
      return route.fulfill(envelope(mode === 'document' ? DETAIL_DOC : DETAIL_ROWS))
    }
    if (path === 'Bby/GroupingMembers') {
      lastMembersQuery = url.includes('?') ? url.split('?')[1] : ''
      const q = new URLSearchParams(lastMembersQuery)
      return route.fulfill(
        envelope(
          memberPage(q.get('side'), q.get('groupingKey'), Number(q.get('page')), Number(q.get('pageSize'))),
        ),
      )
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
  check('Details button opens the modal', (await page.locator('dialog[open]').count()) >= 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('modal closes on Escape', (await page.locator('dialog[open]').count()) === 0)

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

  // ---- ticket 066: the Details modal (rows branch, document branch, not-found) ----
  scenario = { accessBody: { screenAllowed: true }, access404: false, rows: [ROW({}), ROW({ bbyNumber: '100235', description: 'Al-Rajhi card — 5% off basket', condTargetType: 'R', isActive: true }), ROW({ bbyNumber: '100999', description: 'Orphaned number', isActive: false, bbyStatus: 'I' })], detailMode: 'rows' }
  await page.goto(URL)
  await page.waitForSelector('.ag-row', { timeout: 15000 }).catch(() => {})

  // Rows branch: open row 0 → header recap + Buy/Get tables + members chip.
  await page.getByRole('button', { name: /Details/i }).first().click()
  await page.locator('dialog[open]').getByText(/Buy side/i).waitFor({ timeout: 5000 }).catch(() => {})
  const mBody = await page.locator('dialog[open]').innerText().catch(() => '')
  check('modal shows the BBY number recap', mBody.includes('100234'), mBody.slice(0, 60))
  check('modal shows the Organisation panel', /Sales org/i.test(mBody))
  check('modal shows the Buy side table', /Buy side/i.test(mBody))
  check('modal shows the Get side table', /Get side/i.test(mBody))
  check('Get row formats amount discount with currency (SAR)', /SAR/.test(mBody))
  check('grouping Buy row shows the "N members" chip', /42 members/i.test(mBody), mBody.match(/\d+ members/)?.[0] || '')
  check('Get side table shows a condition value (100)', /100/.test(mBody))
  // Close via backdrop-less path (Escape) → grid intact behind.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('modal closed, grid still intact (rows preserved)', (await page.locator('dialog[open]').count()) === 0 && (await page.locator('.ag-row').count()) === 3)

  // Document branch: total-discount card instead of a Get table.
  scenario.detailMode = 'document'
  await page.getByRole('button', { name: /Details/i }).nth(1).click()
  await page.locator('dialog[open]').getByText(/total discount/i).waitFor({ timeout: 5000 }).catch(() => {})
  const docBody = await page.locator('dialog[open]').innerText().catch(() => '')
  check('Document mode shows the total-discount card', /total discount/i.test(docBody), docBody.slice(0, 80))
  check('total-discount card shows the basket requirement', /Basket requirement/i.test(docBody))
  check('total-discount card shows the 5% figure', /5/.test(docBody) && /%/.test(docBody))
  check('Document mode Buy side shows the empty note', /qualification is basket value/i.test(docBody))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // Not-found branch: BBY_NOT_FOUND (404 business) → not-found card, not "unexpected".
  // Use a fresh, uncached number (row 2 = 100999) so react-query actually refetches.
  scenario.detailMode = 'notfound'
  await page.getByRole('button', { name: /Details/i }).nth(2).click()
  await page.waitForSelector('dialog[open] [role="alert"]', { timeout: 5000 }).catch(() => {})
  const nfBody = await page.locator('dialog[open]').innerText().catch(() => '')
  check('not-found → the "Bonus Buy not found" card', /not found/i.test(nfBody) && !/unexpected/i.test(nfBody), nfBody.slice(0, 80))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // ---- ticket 067: the paged grouping-members drilldown (Buy side + Get side) ----
  scenario.detailMode = 'rows'
  await page.getByRole('button', { name: /Details/i }).first().click()
  await page.locator('dialog[open]').getByText(/Buy side/i).waitFor({ timeout: 5000 }).catch(() => {})

  const nested = () => page.locator('dialog[open]').filter({ hasText: 'Grouping members' })

  // Buy-side grouping chip → nested drilldown opens, page 1 keyed by side=buy + matGrouping.
  await page.getByRole('button', { name: /Show the 42 members/i }).click()
  await nested().getByText(/Showing 1–20 of 42/).waitFor({ timeout: 5000 }).catch(() => {})
  check('Buy grouping chip opens the members drilldown (nested modal)', (await nested().count()) === 1)
  check(
    'drilldown page 1 footer shows the range + total (1–20 of 42)',
    /Showing 1–20 of 42/.test(await nested().innerText().catch(() => '')),
    (await nested().innerText().catch(() => '')).match(/Showing[^\n]*/)?.[0] || '',
  )
  check(
    'GroupingMembers queried with side=buy + groupingKey=matGrouping + page=1',
    /side=buy/.test(lastMembersQuery) && /groupingKey=GRP-PANADOL-24/.test(lastMembersQuery) && /page=1/.test(lastMembersQuery),
    lastMembersQuery,
  )

  // Next → page 2 (21–40 of 42), query page advances.
  await nested().getByRole('button', { name: /^Next$/i }).click()
  await nested().getByText(/Showing 21–40 of 42/).waitFor({ timeout: 5000 }).catch(() => {})
  check('Next pages forward (21–40 of 42)', /Showing 21–40 of 42/.test(await nested().innerText().catch(() => '')))
  check('Next sends page=2', /page=2/.test(lastMembersQuery), lastMembersQuery)

  // Close the nested modal (Escape closes the topmost dialog) → Detail modal survives.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('closing the drilldown returns to the Detail modal (still open)', (await nested().count()) === 0 && (await page.locator('dialog[open]').count()) === 1)

  // Get-side grouping chip → drilldown opens keyed by side=get + condNumber.
  await page.getByRole('button', { name: /Show the 8 members/i }).click()
  await nested().getByText(/Showing 1–8 of 8/).waitFor({ timeout: 5000 }).catch(() => {})
  check('Get grouping chip opens the drilldown keyed by side=get + condNumber', (await nested().count()) === 1)
  check(
    'Get-side GroupingMembers queried with side=get + groupingKey=condNumber (03)',
    /side=get/.test(lastMembersQuery) && /groupingKey=03/.test(lastMembersQuery),
    lastMembersQuery,
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

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
