// Serial refusals drive (ticket 573; BackOffice spec 3049, doors 3054).
//
// Drives the REAL app in Chromium against a STUB of the three doors — 3054 is on a BackOffice branch, not deployed, so
// there is no live SIS.Api to point at. The stub answers EXACTLY the shapes of `SerialRefusalReportModels.cs`, camelCase:
//   GET SerialRefusal/Access → { screenAllowed }              (allowed, not allowed)
//   GET SerialRefusal/Report → { asOf, from, to, totals, days[], stores[], staff[], articles[], serials[], heldBy[], offenders[] }
//   GET SerialRefusal/Rows   → { asOf, from, to, truncated, rows[] }
// and a `PICK-00301` refusal on the Report when asked for store `REFUSE`.
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl") it asserts:
//   1. not allowed: the leaf is hidden, the URL shows the denied card, no Report call;
//   2. allowed: the leaf is in the OMS group; the Report is asked for the last 30 days ending today;
//   3. the tiles show the totals as sent;
//   4. the Staff tab lists the blank staff id as "unknown staff";
//   5. a staff row opens the Refusals tab: Rows asked with `staff=`, the drill line names them, the rows are listed;
//   6. the unknown staff row asks Rows with `noStaff=true` and never a blank `staff`;
//   7. "Show all" clears the drill; a truncated answer shows its note;
//   8. a store row narrows the scope (`stores=` on the Report and Rows) and opens its refusals;
//   9. a range over 92 days is blocked before the call; the door's PICK-00301 reads as its own sentence;
//  10. export is offered;
//  11. no page errors.
//
//   1. run the app:  npx vite --port 5207 --strictPort
//   2. DRIVE_PORT=5207 node tools/serial-refusals-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`
const SHOTS = 'tools/.serial-refusals-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n) => {
  const d = new Date()
  return day(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}
const TODAY = daysAgo(0)
const FROM = daysAgo(29)
const GTIN = '06281234567890'

// ── Fixtures, the door's shapes exactly ────────────────────────────────────────────────────────
const report = () => ({
  asOf: `${TODAY}T09:41:00`,
  from: `${FROM}T00:00:00`,
  to: `${TODAY}T00:00:00`,
  totals: { refusals: 41, sold: 37, held: 4, sameStore: 9, crossStore: 26, unknownSale: 2, unknownStaff: 7, stores: 3, staff: 5, serials: 30 },
  days: [
    { day: `${TODAY}T00:00:00`, store: 'P001', refusals: 6, sold: 5, held: 1 },
    { day: `${daysAgo(1)}T00:00:00`, store: 'P002', refusals: 3, sold: 3, held: 0 },
  ],
  stores: [
    { store: 'P001', name: 'Malaz', refusals: 25, sold: 22, held: 3, crossStore: 18, staff: 3, unknownStaff: 4 },
    { store: 'P002', name: 'Rawdah', refusals: 16, sold: 15, held: 1, crossStore: 8, staff: 2, unknownStaff: 3 },
  ],
  staff: [
    { staff: 'P001-ph01', refusals: 14, sold: 13, held: 1, serials: 9, stores: ['P001'], lastRefusedAt: `${TODAY}T08:10:00` },
    { staff: '', refusals: 7, sold: 7, held: 0, serials: 7, stores: ['P001', 'P002'], lastRefusedAt: `${TODAY}T07:00:00` },
    { staff: 'P002-ph04', refusals: 5, sold: 5, held: 0, serials: 3, stores: ['P002'], lastRefusedAt: `${daysAgo(2)}T12:00:00` },
  ],
  articles: [{ itemNumber: '100234', refusals: 12, serials: 8, stores: 2 }],
  serials: [
    {
      gtin: GTIN, serial: 'SN0001', itemNumber: '100234', refusals: 4, stores: 2, baskets: 3,
      firstRefusedAt: `${daysAgo(5)}T10:00:00`, lastRefusedAt: `${TODAY}T08:10:00`,
      last: { store: 'P001', till: 'T01', trxNumber: '00012345' },
    },
  ],
  heldBy: [{ heldStore: 'P003', refusals: 4, documents: 2, askingStores: 2 }],
  offenders: [
    {
      staff: 'P001-ph01', gtin: GTIN, serial: 'SN0001', itemNumber: '100234', times: 3, stores: 1, baskets: 2,
      firstRefusedAt: `${daysAgo(5)}T10:00:00`, lastRefusedAt: `${TODAY}T08:10:00`,
      last: { store: 'P001', till: 'T01', trxNumber: '00012345' },
    },
  ],
})
const refusal = (i, over = {}) => ({
  id: `01JB${i}`, refusedAt: `${TODAY}T08:1${i}:00`, storeCode: 'P001', staffId: 'P001-ph01', tillCode: 'T01',
  tillVersion: '261025', trxNumber: `0001234${i}`, gtin: GTIN, serial: 'SN0001', itemNumber: '100234', status: 'SOLD',
  soldStoreCode: 'P002', soldMachineCode: 'T09', soldTrxNumber: '00099887', heldDocumentNo: '', heldStoreCode: '', ...over,
})
const rows = (q) => ({
  asOf: `${TODAY}T09:41:00`,
  from: `${FROM}T00:00:00`,
  to: `${TODAY}T00:00:00`,
  truncated: q.get('staff') === 'P002-ph04',
  rows: q.get('noStaff') === 'true'
    ? [refusal(1, { staffId: '', trxNumber: '' })]
    : [refusal(1), refusal(2, { status: 'HELD', soldStoreCode: '', soldMachineCode: '', soldTrxNumber: '', heldDocumentNo: 'PD0042', heldStoreCode: 'P003' })],
})

const browser = await chromium.launch()

async function open(dir, { access = 'allowed' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const queries = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    ;(queries[p] ??= []).push(url.searchParams)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    if (p === 'SerialRefusal/Access') return route.fulfill(envelope({ screenAllowed: access === 'allowed' }))
    if (p === 'SerialRefusal/Report') {
      if (url.searchParams.get('stores') === 'REFUSE')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The range is at most 92 days.',
            errors: [{ errorCode: 'PICK-00301', internalErrorCode: '', errorMessage: 'The range is at most 92 days.' }],
          }),
        )
      return route.fulfill(envelope(report()))
    }
    if (p === 'SerialRefusal/Rows') return route.fulfill(envelope(rows(url.searchParams)))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, queries }
}

const omsLinks = (page) => page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])
const last = (queries, p) => (queries[p] ?? []).at(-1)
const settle = (page) => page.waitForTimeout(400)

for (const dir of ['ltr', 'rtl']) {
  console.log(`\n── ${dir.toUpperCase()} ──`)

  // 1. not allowed
  {
    const { context, page, errors, queries } = await open(dir, { access: 'denied' })
    await page.goto(`${BASE}/oms/serial-refusals`)
    await page.waitForLoadState('networkidle')
    check(`${dir} 1 denied: no leaf`, !(await omsLinks(page)).includes('/oms/serial-refusals'))
    check(`${dir} 1 denied: no Report call`, !queries['SerialRefusal/Report'])
    check(`${dir} 1 denied: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  const { context, page, errors, queries } = await open(dir)
  await page.goto(`${BASE}/oms/serial-refusals`)
  await page.locator('[data-sr-grid="staff"] .ag-row').first().waitFor({ timeout: 15000 })

  // 2. leaf + default range
  check(`${dir} 2 leaf in the OMS group`, (await omsLinks(page)).includes('/oms/serial-refusals'))
  const q = last(queries, 'SerialRefusal/Report')
  check(`${dir} 2 Report asked for the last 30 days`, q?.get('from') === FROM && q?.get('to') === TODAY, q?.toString())

  // 3. tiles
  const refusalsTile = (await page.locator('[data-sr-tile="refusals"] dd').textContent())?.trim()
  const crossTile = (await page.locator('[data-sr-tile="crossStore"] dd').textContent())?.trim()
  check(`${dir} 3 tiles as sent`, refusalsTile === '41' && crossTile === '26', `${refusalsTile} / ${crossTile}`)

  // 4. unknown staff
  check(`${dir} 4 blank staff reads as unknown`, (await page.locator('[data-sr-grid="staff"] [data-sr-unknown-staff]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/${dir}-staff.png` })

  // 5. staff row → refusals
  await page.locator('[data-sr-grid="staff"] .ag-row[row-index="0"] .ag-cell').nth(1).click()
  await page.locator('[data-sr-grid="refusals"] .ag-row').first().waitFor({ timeout: 10000 })
  const r5 = last(queries, 'SerialRefusal/Rows')
  check(`${dir} 5 Rows asked for the staff`, r5?.get('staff') === 'P001-ph01' && !r5?.has('noStaff'), r5?.toString())
  check(`${dir} 5 drill line names them`, ((await page.locator('[data-sr-drill]').textContent()) ?? '').includes('P001-ph01'))
  check(`${dir} 5 URL holds the drill`, page.url().includes('tab=refusals') && page.url().includes('staff=P001-ph01'))
  const listed = await page.locator('[data-sr-grid="refusals"] .ag-row[row-index]').evaluateAll(
    (els) => new Set(els.map((e) => e.getAttribute('row-index'))).size,
  )
  check(`${dir} 5 rows listed`, listed === 2, `${listed} rows`)
  const held = await page.locator('[data-sr-grid="refusals"] .ag-row[row-index="1"] [col-id="collision"]').textContent()
  check(`${dir} 5 a held row names its document`, (held ?? '').includes('PD0042'), held ?? '')
  await page.screenshot({ path: `${SHOTS}/${dir}-refusals.png` })

  // 7. show all
  await page.locator('[data-sr-drill-clear]').click()
  await settle(page)
  check(`${dir} 7 Show all clears the drill`, (await page.locator('[data-sr-drill]').count()) === 0 && !last(queries, 'SerialRefusal/Rows')?.has('staff'))

  // 6. unknown staff row → noStaff
  await page.locator('[data-sr-tab="staff"]').click()
  await page.locator('[data-sr-grid="staff"] .ag-row').first().waitFor()
  await page.locator('[data-sr-grid="staff"] .ag-row[row-index="1"] .ag-cell').nth(1).click()
  await page.locator('[data-sr-grid="refusals"] .ag-row').first().waitFor({ timeout: 10000 })
  const r6 = last(queries, 'SerialRefusal/Rows')
  check(`${dir} 6 unknown staff asks noStaff, never a blank staff`, r6?.get('noStaff') === 'true' && !r6?.has('staff'), r6?.toString())

  // 7b. truncated
  await page.locator('[data-sr-tab="staff"]').click()
  await page.locator('[data-sr-grid="staff"] .ag-row[row-index="2"] .ag-cell').nth(1).click()
  await page.locator('[data-sr-truncated]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 7 truncated answer shows its note`, (await page.locator('[data-sr-truncated]').count()) === 1)

  // 8. store row → scope
  await page.locator('[data-sr-tab="stores"]').click()
  await page.locator('[data-sr-grid="stores"] .ag-row').first().waitFor()
  await page.screenshot({ path: `${SHOTS}/${dir}-stores.png` })
  await page.locator('[data-sr-grid="stores"] .ag-row[row-index="1"] .ag-cell').nth(1).click()
  await page.locator('[data-sr-grid="refusals"] .ag-row').first().waitFor({ timeout: 10000 })
  await settle(page)
  check(`${dir} 8 a store row narrows the scope`,
    last(queries, 'SerialRefusal/Report')?.get('stores') === 'P002' && last(queries, 'SerialRefusal/Rows')?.get('stores') === 'P002')
  check(`${dir} 8 the stores box shows it`, (await page.locator('[data-sr-filter="stores"]').inputValue()) === 'P002')

  // 9. range too long, then the door's refusal
  await page.locator('[data-sr-reset]').click()
  await settle(page)
  const before = (queries['SerialRefusal/Report'] ?? []).length
  await page.locator('[data-sr-filter="from"]').fill(daysAgo(120))
  await settle(page)
  check(`${dir} 9 over 92 days is blocked before the call`,
    (await page.locator('[data-sr-problem="tooLong"]').count()) === 1 && (queries['SerialRefusal/Report'] ?? []).length === before)
  await page.locator('[data-sr-reset]').click()
  await page.locator('[data-sr-filter="stores"]').fill('refuse')
  await page.locator('[data-sr-apply]').click()
  await page.locator('[data-sr-refusal="refusal.rangeTooLong"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 9 PICK-00301 reads as its own sentence`, (await page.locator('[data-sr-refusal="refusal.rangeTooLong"]').count()) === 1)

  // 10. export offered
  await page.locator('[data-sr-reset]').click()
  await page.locator('[data-sr-tab="serials"]').click()
  await page.locator('[data-sr-grid="serials"] .ag-row').first().waitFor({ timeout: 10000 })
  check(`${dir} 10 export offered`, await page.locator('[data-sr-export]').isEnabled())
  await page.screenshot({ path: `${SHOTS}/${dir}-serials.png` })

  check(`${dir} 11 no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
