// Head office sees the expiry fallback's takes (BackOffice ticket 4277, spec 4275, ADR 0146, SIS.Stock 086).
//
// Drives the REAL app in Chromium against a STUB of SIS.Api's doors, in the shapes 4277 shipped, camelCase:
//   GET StockConsole/Stores/P077/Takes                → a fallback take, a Record refusal, a dates-disagree refusal
//   GET StockConsole/Stores/P077/ExpiryFallbackTakes  → inventory control's list (two rows)
//   GET HeldStockReport/Refusals                      → one refusal with the would-be batch
//   GET StoreStage, StoreStage/P077/Gates             → a Record store with its refusal days
// In LTR (en) and RTL (ar) it asserts:
//   1. the Takes tab's fallback box sends fallback=true; the column shows the mark, the would-be batch and the note, and
//      the pack's vendor batch shows;
//   2. inventory control's list reads nothing until Read, stops a 40-day range without asking, then reads the store and
//      days, shows its rows and totals, and exports;
//   3. the refusal report's fallback filter sends fallback=true and its rows show the would-be batch;
//   4. the stage sheet shows the refusal days with the fallback share and, in a Record store, the would-be placements;
//   5. no page errors. Screenshots in tools/.stock-fallback-shots.
//
//   1. run the app:  npx vite --port 5214 --strictPort
//   2. DRIVE_PORT=5214 node tools/stock-fallback-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5214}`
const SHOTS = 'tools/.stock-fallback-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

const blankTake = {
  takeId: null, item: null, nameEn: '', nameAr: '', code: null, stage: null, available: null, quantity: null,
  scannedVendorBatch: null, scannedExpiry: null, enteredBatch: null, batches: null, batch: null, batchWithStock: null,
  reason: null, asked: null, shadow: null, durationMs: null, statusCode: null, instance: null, isExpiryFallback: null,
  fallbackBatch: null, fallbackQuantity: null, fallbackNote: null,
}
const TAKES = {
  total: 3, page: 1, size: 25, failedLeftOut: true,
  rows: [
    { ...blankTake, kind: 'granted', at: '2026-11-25T09:12:00', takeId: 'T-9', item: '1001', nameEn: 'PANADOL 500MG TAB 24',
      nameAr: 'بنادول 500 مجم 24 قرص', code: 'Placed', quantity: 3, scannedVendorBatch: 'LOT77', scannedExpiry: '2027-03-31',
      isExpiryFallback: true, batches: [
        { batch: '0000123456', quantity: 1, state: 'Held', isExpiryFallback: false },
        { batch: '0000123999', quantity: 2, state: 'Held', isExpiryFallback: true },
      ] },
    { ...blankTake, kind: 'refused', at: '2026-11-25T09:10:00', takeId: 'T-8', item: '2001', nameEn: 'BRUFEN 400MG TAB 30',
      nameAr: 'بروفين 400 مجم 30 قرص', code: 'NotPlaced', asked: 2, reason: 'NoStockInBatch', isExpiryFallback: false,
      scannedVendorBatch: 'LOT88', scannedExpiry: '2027-05-00', fallbackBatch: '0000777001', fallbackQuantity: 2 },
    { ...blankTake, kind: 'refused', at: '2026-11-25T09:05:00', takeId: 'T-7', item: '2002', code: 'Refused', asked: 1,
      reason: 'NoStockInBatch', isExpiryFallback: false, scannedVendorBatch: 'LOT99', fallbackNote: 'ScannedDateDisagrees' },
  ],
}
const LIST = {
  store: 'P077', from: '2026-11-20T00:00:00', to: '2026-11-25T00:00:00', takes: 3, quantity: 5,
  rows: [
    { item: '1001', nameEn: 'PANADOL 500MG TAB 24', nameAr: 'بنادول 500 مجم 24 قرص', vendorBatch: 'LOT77', batch: '0000123999',
      expiryDate: '2027-03-31T00:00:00', takes: 2, quantity: 4, firstTakenAt: '2026-11-21T08:00:00', lastTakenAt: '2026-11-24T17:30:00' },
    { item: '7777', nameEn: '', nameAr: '', vendorBatch: 'X1', batch: '0000555000', expiryDate: null, takes: 1, quantity: 1,
      firstTakenAt: '2026-11-25T09:00:00', lastTakenAt: '2026-11-25T09:00:00' },
  ],
}
const STORE_ROW = {
  plant: 'P077', city: 'Riyadh', stage: 'Blocking', itemsWithStock: 10, sapStock: 100, tillStock: 90, gap: 10, heldStanding: 3,
  heldSold: 2, held: 5, reserved: null, reservedState: 'NeverComputed', reservedAt: null, free: 85, reservedIncluded: false,
  belowZero: 0, lastUpdate: '2026-11-25T10:00:00', oldestStandingAt: null, oldestSoldAt: null, sapPlace: null,
  sapLastAttempt: null, tillPlace: null, tillLastAttempt: null, driftBatches: 0, driftRanAt: null, placeholderStock: 0,
  flags: [], status: 'Ok',
}
const REFUSALS = {
  asOf: '2026-11-25T10:00:00', day: '2026-11-24T00:00:00', groups: [], multiBatchLines: [], lastResortTakes: [],
  storesUnreached: [],
  rows: [{
    takeId: 'T-8', store: 'P077', material: '2001', batch: '', quantityAsked: 2, quantityAvailable: 0, code: 'NotPlaced',
    reason: 'NoStockInBatch', batchWithStock: '', batchWithStockExpiry: null, batchWithStockQuantity: null,
    expiredQuantity: null, document: 'D1', user: 'U1', isShadow: false, stage: 'Blocking', sapFeedAgeSeconds: 30,
    posFeedAgeSeconds: 5, loggedAt: '2026-11-24T09:10:00', scannedVendorBatch: 'LOT88', scannedExpiry: '2027-05-00',
    fallbackBatch: '0000777001', fallbackQuantity: 2, fallbackNote: null,
  }],
}
const GATES = {
  store: 'P077', from: '2026-11-11T00:00:00', to: '2026-11-24T00:00:00', hold: true, measured: [], confirmed: [],
  notConfirmed: [], waived: [], expiryFallback: 'Record',
  refusalDays: [
    { day: '2026-11-23', takes: 200, refused: 3, refusalShare: 0.015, scannedTakes: 80, fallbackTakes: 0, fallbackShare: 0,
      wouldBePlacements: 2 },
    { day: '2026-11-24', takes: 0, refused: 0, refusalShare: null, scannedTakes: 0, fallbackTakes: 0, fallbackShare: null,
      wouldBePlacements: 0 },
  ],
}

const browser = await chromium.launch()

async function open(dir, path) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const asked = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    asked.push(p + url.search)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'owner', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions')
      return route.fulfill(permissions(['StockConsole:03', 'HeldStockReport:03', 'StoreStage:03']))
    if (p === 'StockConsole/Stores/P077/Takes') return route.fulfill(envelope(TAKES))
    if (p === 'StockConsole/Stores/P077/ExpiryFallbackTakes') return route.fulfill(envelope(LIST))
    if (p === 'StockConsole/Stores/P077')
      return route.fulfill(envelope({ readAt: '2026-11-25T10:00:00', reservedRun: { lastSuccessAt: null, lastNetting: null }, store: STORE_ROW }))
    if (p === 'HeldStockReport/Refusals') return route.fulfill(envelope(REFUSALS))
    if (p === 'StoreStage') return route.fulfill(envelope([{ store: 'P077', stage: 'Blocking', updatedAt: null, lastMove: null }]))
    if (p === 'StoreStage/P077/Gates') return route.fulfill(envelope(GATES))
    if (p === 'StoreStage/P077/ExpiryFallback') return route.fulfill(envelope({ store: 'P077', state: 'Record', changes: [] }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}${path}`)
  return { context, page, errors, asked }
}

for (const dir of ['ltr', 'rtl']) {
  console.log(`\n── ${dir.toUpperCase()} ──`)
  {
    const { context, page, errors, asked } = await open(dir, '/stock/console/store/P077?tab=takes&ran=1&day=2026-11-25&fallback=true')
    await page.locator('[data-take-fallback]').first().waitFor({ timeout: 15000 })
    check(`${dir} 1 asked fallback=true`, asked.some((a) => a.startsWith('StockConsole/Stores/P077/Takes') && a.includes('fallback=true')))
    check(`${dir} 1 the box says fallback only`, (await page.locator('[data-search-box="fallback"]').inputValue()) === 'true')
    const marks = await page.locator('[data-take-fallback]').evaluateAll((els) => els.map((e) => e.getAttribute('data-take-fallback')))
    check(`${dir} 1 placed, would be, and the note`,
      marks.join(',') === 'takes.fallback.placed,takes.fallback.wouldBe,takes.fallback.note', marks.join(','))
    const text = await page.locator('[data-list-grid="takes"]').innerText()
    check(`${dir} 1 the fallback batch and the would-be batch`, text.includes('0000123999') && text.includes('0000777001'))
    check(`${dir} 1 the pack's vendor batch`, text.includes('LOT77') && text.includes('LOT88'))
    await page.screenshot({ path: `${SHOTS}/takes-${dir}.png`, fullPage: true })
    check(`${dir} 1 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, asked } = await open(dir, '/stock/console/fallback')
    await page.locator('[data-fallback-form]').waitFor({ timeout: 15000 })
    check(`${dir} 2 the console's link is lit`, (await page.locator('[data-console-page="fallback"]').getAttribute('aria-current')) === 'page')
    check(`${dir} 2 nothing read before Read`, !asked.some((a) => a.includes('ExpiryFallbackTakes')))
    await page.locator('[data-fallback-box="store"]').fill('p077')
    await page.locator('[data-fallback-box="from"]').fill('2026-10-01')
    await page.locator('[data-fallback-box="to"]').fill('2026-11-09')
    await page.locator('[data-fallback-read]').click()
    await page.locator('[data-fallback-stopped="tooLong"]').waitFor({ timeout: 5000 })
    check(`${dir} 2 a 40-day range is stopped without asking`, !asked.some((a) => a.includes('ExpiryFallbackTakes')))
    await page.locator('[data-fallback-box="from"]').fill('2026-11-20')
    await page.locator('[data-fallback-box="to"]').fill('2026-11-25')
    await page.locator('[data-fallback-read]').click()
    await page.locator('[data-fallback-list="P077"]').waitFor({ timeout: 10000 })
    check(`${dir} 2 asked the store and its days`,
      asked.some((a) => a === 'StockConsole/Stores/P077/ExpiryFallbackTakes?from=2026-11-20&to=2026-11-25'), asked.join(' '))
    const grid = await page.locator('[data-list-grid="fallback"]').innerText()
    check(`${dir} 2 rows by material, vendor batch and batch`, grid.includes('LOT77') && grid.includes('0000123999') && grid.includes('0000555000'))
    check(`${dir} 2 totals`, (await page.locator('[data-fallback-totals]').getAttribute('data-fallback-totals')) === '3/5')
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.locator('[data-fallback-export]').click()])
    check(`${dir} 2 exports an xlsx`, download.suggestedFilename().endsWith('.xlsx'), download.suggestedFilename())
    await page.screenshot({ path: `${SHOTS}/list-${dir}.png`, fullPage: true })
    check(`${dir} 2 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, asked } = await open(dir, '/stock/refusals?tab=rows&day=2026-11-24&fallback=1')
    await page.locator('[data-hsr-filter="fallback"]').waitFor({ timeout: 15000 })
    await page.waitForTimeout(800)
    check(`${dir} 3 asked fallback=true`, asked.some((a) => a.startsWith('HeldStockReport/Refusals') && a.includes('fallback=true')), asked.join(' '))
    const body = await page.locator('body').innerText()
    check(`${dir} 3 the row shows the would-be batch and the pack's vendor batch`, body.includes('0000777001') && body.includes('LOT88'))
    await page.screenshot({ path: `${SHOTS}/refusals-${dir}.png`, fullPage: true })
    check(`${dir} 3 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, '/stock/store-stages?open=P077')
    await page.locator('[data-stage-refusal-days]').waitFor({ timeout: 15000 })
    check(`${dir} 4 the store's state`, (await page.locator('[data-stage-refusal-days]').getAttribute('data-stage-refusal-days')) === 'Record')
    check(`${dir} 4 one line per day`, (await page.locator('[data-refusal-day]').count()) === 2)
    const share = await page.locator('[data-refusal-day="2026-11-23"] [data-refusal-day-cell="refusalShare"]').innerText()
    check(`${dir} 4 the refusal share`, share.includes('1.50%'), share)
    const would = await page.locator('[data-refusal-day="2026-11-23"] [data-refusal-day-cell="wouldBePlacements"]').innerText()
    check(`${dir} 4 the would-be placements in a Record store`, would.trim() === '2', would)
    await page.locator('[data-stage-refusal-days]').screenshot({ path: `${SHOTS}/stage-${dir}.png` })
    check(`${dir} 4 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
