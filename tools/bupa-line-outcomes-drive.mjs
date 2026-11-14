// Bupa line outcomes drive (ticket 899; BackOffice spec 3888, doors 3889–3891).
//
// Drives the REAL app in Chromium against a STUB of the doors — 3889–3891 are not on staging yet. The stub answers the
// brief's shapes (`C:\Work\DMSCO\BackOffice\.issues\assets\3888-oms-react-bupa-outcomes-brief.md`), camelCase:
//   GET BupaLineOutcomes/Access         → { canView }
//   GET BupaLineOutcomes/report         → { from, to, summary[], details[], totals }
//   GET BupaLineOutcomes/report/export  → an .xlsx body with a Content-Disposition name
// and a coded refusal on the report when asked for store `REFUSE`.
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; the copy stays English while `lng` is `en`) it asserts:
//   1. without the grant: no leaf, the URL shows the denied card, no report call;
//   2. with it: the leaf sits right after Deliveries; the report is asked for the last 30 days ending today;
//   3. the summary lists the door's rows and a totals row; a voided row's dispensed side reads "—";
//   4. kind + store filters reach the URL and the report;
//   5. opening a summary row lists exactly its detail lines, each linking to its document;
//   6. a line expands to its act history; PICK reads "Resolve" / "حلّ", never "Pick";
//   7. export asks the export door with the SAME query as the report, and saves the server's file;
//   8. a range over 3 months is blocked before the call; the door's coded refusal shows inline;
//   9. no page errors.
//
//   1. run the app:  npx vite --port 5208 --strictPort
//   2. DRIVE_PORT=5208 node tools/bupa-line-outcomes-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5208}`
const SHOTS = 'tools/.bupa-line-outcomes-shots'
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

// ── Fixtures, the brief's shapes ───────────────────────────────────────────────────────────────
const panadol = { materialNumber: '100234', sfdaCode: '1234-56', nameEn: 'Panadol Extra 24s', nameAr: 'بانادول إكسترا 24' }
const summary = [
  {
    kind: 'resolved',
    sent: { materialNumber: null, sfdaCode: null, text: 'panadol extra', nameEn: null, nameAr: null },
    dispensed: panadol,
    orders: 2, lines: 2, linesQtyDiffers: 1, sentBaseUnits: 48, dispensedBaseUnits: 72,
  },
  {
    kind: 'voided',
    sent: { materialNumber: '200500', sfdaCode: '9988-11', text: null, nameEn: 'Brufen 400', nameAr: 'بروفين 400' },
    dispensed: null,
    orders: 1, lines: 1, linesQtyDiffers: 0, sentBaseUnits: 20, dispensedBaseUnits: 0,
  },
]
const details = [
  {
    documentNo: '2000000551', bupaReference: 'BCC-778801', approvalNo: 'APR-1', placedAt: `${daysAgo(3)}T10:15:00`,
    storeCode: 'P001', lineNumber: 1, kind: 'resolved',
    sent: { materialNumber: null, sfdaCode: null, text: 'Panadol Extra', quantity: 2, uom: 'PAK' },
    dispensed: { ...panadol, quantity: 3, uom: 'PAK' },
    acts: [
      { act: 'PICK', itemBefore: null, itemAfter: '100234', quantityBefore: 2, quantityAfter: 2, uomBefore: 'PAK', uomAfter: 'PAK', reason: 'Text resolved', user: 'P001-ph01', at: `${daysAgo(3)}T10:20:00` },
      { act: 'QUANTITY', itemBefore: '100234', itemAfter: '100234', quantityBefore: 2, quantityAfter: 3, uomBefore: 'PAK', uomAfter: 'PAK', reason: 'سبب بالعربية', user: 'P001-ph01', at: `${daysAgo(3)}T10:22:00` },
    ],
  },
  {
    documentNo: '2000000552', bupaReference: 'BCC-778802', approvalNo: null, placedAt: `${daysAgo(2)}T09:00:00`,
    storeCode: 'P002', lineNumber: 3, kind: 'resolved',
    sent: { materialNumber: null, sfdaCode: null, text: 'PANADOL EXTRA ', quantity: 2, uom: 'PAK' },
    dispensed: { ...panadol, quantity: 2, uom: 'PAK' },
    acts: [],
  },
  {
    documentNo: '2000000553', bupaReference: 'BCC-778803', approvalNo: 'APR-3', placedAt: `${daysAgo(1)}T12:00:00`,
    storeCode: 'P001', lineNumber: 2, kind: 'voided',
    sent: { materialNumber: '200500', sfdaCode: '9988-11', text: null, quantity: 1, uom: 'PAK' },
    dispensed: null,
    acts: [{ act: 'VOID', itemBefore: '200500', itemAfter: null, quantityBefore: 1, quantityAfter: 0, uomBefore: 'PAK', uomAfter: null, reason: 'Out of stock', user: 'P001-ph02', at: `${daysAgo(1)}T12:05:00` }],
  },
]
const report = (q) => ({
  from: q.get('from'),
  to: q.get('to'),
  summary,
  details,
  totals: { orders: 3, lines: 3, linesQtyDiffers: 1 },
})

const browser = await chromium.launch()

async function open(dir, { access = 'allowed' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, acceptDownloads: true })
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
    if (p === 'BupaLineOutcomes/Access') return route.fulfill(envelope({ canView: access === 'allowed' }))
    if (p === 'BupaLineOutcomes/report') {
      if (url.searchParams.get('store') === 'REFUSE')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'The range is at most 3 months.',
            errors: [{ errorCode: 'SD-00999', internalErrorCode: '', errorMessage: 'The range is at most 3 months.' }],
          }),
        )
      return route.fulfill(envelope(report(url.searchParams)))
    }
    if (p === 'BupaLineOutcomes/report/export')
      return route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': `attachment; filename="bupa-line-outcomes_${url.searchParams.get('from')}_${url.searchParams.get('to')}.xlsx"` },
        body: Buffer.from('PK-stub-xlsx'),
      })
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false, canView: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, queries }
}

const omsLinks = (page) => page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])
const last = (queries, p) => (queries[p] ?? []).at(-1)
const settle = (page) => page.waitForTimeout(400)
const summaryRows = (page) => page.locator('[data-blo-summary] .ag-row:not([row-index^="b-"])')

for (const dir of ['ltr', 'rtl']) {
  console.log(`\n── ${dir.toUpperCase()} ──`)

  // 1. not allowed
  {
    const { context, page, errors, queries } = await open(dir, { access: 'denied' })
    await page.goto(`${BASE}/oms/bupa-line-outcomes`)
    await page.waitForLoadState('networkidle')
    check(`${dir} 1 denied: no leaf`, !(await omsLinks(page)).includes('/oms/bupa-line-outcomes'))
    check(`${dir} 1 denied: no report call`, !queries['BupaLineOutcomes/report'])
    check(`${dir} 1 denied: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  const { context, page, errors, queries } = await open(dir)
  await page.goto(`${BASE}/oms/bupa-line-outcomes`)
  await summaryRows(page).first().waitFor({ timeout: 15000 })
  await settle(page)

  // 2. leaf + default range (and the page's direction: Arabic copy stays off until the locale ships — `lng` is `en`;
  //    the Arabic "حلّ" is pinned by outcomes.test.ts)
  check(`${dir} 2 page direction`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  const links = await omsLinks(page)
  check(`${dir} 2 leaf right after Deliveries`, links.indexOf('/oms/bupa-line-outcomes') === links.indexOf('/oms/deliveries') + 1, links.slice(0, 3).join(','))
  const q2 = last(queries, 'BupaLineOutcomes/report')
  check(`${dir} 2 report asked for the last 30 days`, q2?.get('from') === FROM && q2?.get('to') === TODAY && !q2?.has('store') && !q2?.has('kind'), q2?.toString())

  // 3. summary + totals + voided dash
  check(`${dir} 3 summary rows as sent`, (await summaryRows(page).count()) === 2)
  const totals = await page.locator('[data-blo-summary] .ag-row[row-index="b-0"]').first().innerText()
  check(`${dir} 3 totals row`, /3/.test(totals) && totals.includes('Total'), totals.replace(/\s+/g, ' '))
  const voidedDispensed = (await page.locator('[data-blo-summary] .ag-row[row-index="1"] [col-id="dispensedMaterial"]').first().innerText()).trim()
  check(`${dir} 3 voided dispensed reads —`, voidedDispensed === '—', voidedDispensed)
  await page.screenshot({ path: `${SHOTS}/${dir}-summary.png` })

  // 5. drill-down
  await page.locator('[data-blo-summary] .ag-row[row-index="0"] [col-id="kind"]').first().click()
  await page.locator('[data-blo-lines]').waitFor({ timeout: 5000 })
  const lineIds = await page.locator('[data-blo-line]').evaluateAll((els) => els.map((e) => e.getAttribute('data-blo-line')))
  check(`${dir} 5 the row's lines exactly`, JSON.stringify(lineIds) === JSON.stringify(['2000000551-1', '2000000552-3']), lineIds.join(','))
  const kinds = await page.locator('[data-blo-line-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-blo-line-kind')))
  check(`${dir} 5 each line shows its kind`, kinds.join(',') === 'resolved,resolved', kinds.join(','))
  const lit = () => page.locator('[data-blo-summary] .ag-row[class~="bg-primary/10"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('row-index')))])
  check(`${dir} 5 the open row is highlighted`, (await lit()).join(',') === '0', (await lit()).join(','))
  const href = await page.locator('[data-blo-document="2000000551"]').getAttribute('href')
  check(`${dir} 5 document links to its page`, href === '/oms/document/2000000551', href ?? '')

  // 6. act history
  await page.locator('[data-blo-line="2000000551-1"] [data-blo-acts-toggle]').click()
  await page.locator('[data-blo-acts="2000000551-1"]').waitFor({ timeout: 5000 })
  const pick = (await page.locator('[data-blo-acts="2000000551-1"] [data-blo-act="PICK"] td').first().innerText()).trim()
  check(`${dir} 6 PICK reads as Resolve`, pick === 'Resolve', pick)
  const actsText = await page.locator('[data-blo-acts="2000000551-1"]').innerText()
  check(`${dir} 6 never "Pick"`, !/\bPick\b/.test(actsText))
  check(`${dir} 6 acts list every act`, (await page.locator('[data-blo-acts="2000000551-1"] [data-blo-act]').count()) === 2)
  await page.screenshot({ path: `${SHOTS}/${dir}-drill.png`, fullPage: true })

  // voided row's lines
  await page.locator('[data-blo-summary] .ag-row[row-index="1"] [col-id="kind"]').first().click()
  await settle(page)
  const voidedLines = await page.locator('[data-blo-line]').evaluateAll((els) => els.map((e) => e.getAttribute('data-blo-line')))
  check(`${dir} 5 the highlight moves to the new row`, (await lit()).join(',') === '1', (await lit()).join(','))
  check(`${dir} 5 voided row opens its own line`, JSON.stringify(voidedLines) === JSON.stringify(['2000000553-2']), voidedLines.join(','))

  // 4. filters → URL + report
  await page.locator('[data-blo-filter="kind"]').selectOption('swapped')
  await page.locator('[data-blo-filter="store"]').fill(' p002 ')
  const asked = page
    .waitForRequest((r) => r.url().includes('BupaLineOutcomes/report?') && r.url().includes('store=P002'), { timeout: 10000 })
    .catch(() => null)
  await page.locator('[data-blo-apply]').click()
  await asked
  await settle(page)
  const q4 = last(queries, 'BupaLineOutcomes/report')
  check(`${dir} 4 kind + store reach the report`, q4?.get('kind') === 'swapped' && q4?.get('store') === 'P002', q4?.toString())
  check(`${dir} 4 the URL holds them`, page.url().includes('kind=swapped') && page.url().includes('store=P002'), page.url())

  // 7. export, same query
  const downloadP = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
  await page.locator('[data-blo-export]').click()
  const download = await downloadP
  const qx = last(queries, 'BupaLineOutcomes/report/export')
  check(`${dir} 7 export asked with the report's query`, qx?.toString() === q4?.toString(), `${qx?.toString()} vs ${q4?.toString()}`)
  check(`${dir} 7 a file is saved under the server's name`, download?.suggestedFilename() === `bupa-line-outcomes_${FROM}_${TODAY}.xlsx`, download?.suggestedFilename() ?? 'none')

  // 8. range over 3 months blocked; coded refusal inline
  await page.locator('[data-blo-reset]').click()
  await settle(page)
  const before = (queries['BupaLineOutcomes/report'] ?? []).length
  await page.locator('[data-blo-filter="from"]').fill(daysAgo(120))
  await settle(page)
  check(`${dir} 8 over 3 months is blocked before the call`,
    (await page.locator('[data-blo-problem="tooLong"]').count()) === 1 && (queries['BupaLineOutcomes/report'] ?? []).length === before)
  check(`${dir} 8 export is off while the range is refused`, !(await page.locator('[data-blo-export]').isEnabled()))
  await page.locator('[data-blo-reset]').click()
  await page.locator('[data-blo-filter="store"]').fill('refuse')
  await page.locator('[data-blo-apply]').click()
  await page.locator('[data-blo-refusal="SD-00999"]').waitFor({ timeout: 10000 }).catch(() => {})
  const refusal = await page.locator('[data-blo-refusal]').innerText().catch(() => '')
  check(`${dir} 8 the coded refusal shows inline`, refusal.includes('The range is at most 3 months.') && refusal.includes('refused'), refusal.replace(/\s+/g, ' '))
  await page.screenshot({ path: `${SHOTS}/${dir}-refusal.png` })

  check(`${dir} 9 no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
