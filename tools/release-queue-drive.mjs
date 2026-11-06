// Release download queue drive (ticket 791, BackOffice spec 3396 / 3401) — the read-only page.
//
// Drives the REAL app in Chromium against a STUB of 3401's doors, on its real wire (camelCase,
// `Sartawi.Retail.Data/Modules/PosRelease/Models/DownloadSlotAdminModels.cs`):
//   GET PosReleaseQueue/Access      → { canView, canManage }
//   GET PosReleaseQueue/Pool        → { poolName, poolSize, paused, isDefault, updatedAt, updatedBy, activeSlots }
//   GET PosReleaseQueue/Slots       → live slot[]
//   GET PosReleaseQueue/Queue       → { queueLength, oldestWaitSeconds, entries[] }
//   GET PosReleaseQueue/History?outcome=&store=&version=&skip=&take= → { total, skip, take, rows[] }
//   GET PosReleaseQueue/Convergence → { package, toVersion, downloaded, downloading, waiting }[]
// The live walk against a dev SIS.Api is still owed (the ticket's Done-when).
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. DRIVE_PORT=5199 node tools/release-queue-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})
const plain = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()

const POOL = { poolName: 'default', poolSize: 40, paused: false, isDefault: false, updatedAt: '2026-11-06T09:30:00', updatedBy: 'm.sartawi', activeSlots: 1 }
const SLOTS = [
  { leaseId: '01JLEASE1', storeCode: 'R101', machineCode: 'R101-T1', package: 'pos', channel: 'stable', fromVersion: '3.4.0', toVersion: '3.4.1', grantedAt: '2026-11-06T10:00:00', renewedAt: '2026-11-06T10:03:00', expiresAt: '2026-11-06T10:08:00', progressPercent: 62 },
]
const QUEUE = {
  queueLength: 3,
  oldestWaitSeconds: 15_000,
  entries: [
    { position: 1, storeCode: 'R101', machineCode: 'R101-T2', package: 'pos', toVersion: '3.4.1', urgent: false, firstAskedAt: '2026-11-06T06:00:00', lastAskedAt: '2026-11-06T10:04:00', waitSeconds: 15_000, waitedOverFourHours: true },
    { position: 2, storeCode: 'R200', machineCode: 'R200-T1', package: 'pos', toVersion: '3.4.1', urgent: true, firstAskedAt: '2026-11-06T09:00:00', lastAskedAt: '2026-11-06T10:04:00', waitSeconds: 3_900, waitedOverFourHours: false },
    { position: 3, storeCode: 'R101', machineCode: 'R101-T3', package: 'pos', toVersion: '3.4.1', urgent: false, firstAskedAt: '2026-11-06T09:30:00', lastAskedAt: '2026-11-06T10:04:00', waitSeconds: 2_100, waitedOverFourHours: false },
  ],
}
const HISTORY_ROWS = [
  { leaseId: '01JH1', storeCode: 'R300', machineCode: 'R300-T1', package: 'pos', channel: 'stable', fromVersion: '3.4.0', toVersion: '3.4.1', grantedAt: '2026-11-06T09:00:00', endedAt: '2026-11-06T09:04:10', durationSeconds: 250, outcome: 'released-done', progressPercent: 100, failureReason: '', freedBy: '' },
  { leaseId: '01JH2', storeCode: 'R301', machineCode: 'R301-T1', package: 'pos', channel: 'stable', fromVersion: '3.3.9', toVersion: '3.4.1', grantedAt: '2026-11-06T09:10:00', endedAt: '2026-11-06T09:12:00', durationSeconds: 120, outcome: 'released-failed', progressPercent: 40, failureReason: 'The remote server returned an error: (404) Not Found.', freedBy: '' },
]
const CONVERGENCE = [{ package: 'pos', toVersion: '3.4.1', downloaded: 30, downloading: 8, waiting: 2 }]

const browser = await chromium.launch()

async function drive(dir) {
  const L = dir
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const historyQueries = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'a.viewer', currentStoreCode: 'P001' }))
    if (p === 'PosReleaseQueue/Access') return route.fulfill(envelope({ canView: true, canManage: false }))
    if (p === 'PosReleaseQueue/Pool') return route.fulfill(envelope(POOL))
    if (p === 'PosReleaseQueue/Slots') return route.fulfill(envelope(SLOTS))
    if (p === 'PosReleaseQueue/Queue') return route.fulfill(envelope(QUEUE))
    if (p === 'PosReleaseQueue/Convergence') return route.fulfill(envelope(CONVERGENCE))
    if (p === 'PosReleaseQueue/History') {
      historyQueries.push(url.search)
      const outcome = url.searchParams.get('outcome')
      const rows = outcome === 'failed' ? HISTORY_ROWS.filter((r) => r.outcome === 'released-failed') : HISTORY_ROWS
      return route.fulfill(envelope({ total: rows.length, skip: 0, take: 50, rows }))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })

  await page.goto(`${BASE}/admin/release-queue`)
  await page.locator('[data-release-queue]').waitFor({ timeout: 20000 })
  check(`${L}: the menu leaf shows for a View holder`, (await page.locator('a[href="/admin/release-queue"]').count()) > 0)
  await page.locator('[data-pool]').waitFor()
  check(`${L}: pool strip — 1 / 40 in use`, plain(await page.locator('[data-pool-in-use]').innerText()).includes('1 / 40'), plain(await page.locator('[data-pool-in-use]').innerText()))

  // Live slots
  await page.locator('[data-grid="slots"] [data-slot-progress="62"]').waitFor({ timeout: 10000 })
  const slotRow = plain(await page.locator('[data-grid="slots"] .ag-row').first().innerText())
  check(`${L}: a live slot shows store, till, from–to and 62%`, slotRow.includes('R101-T1') && slotRow.includes('3.4.0–3.4.1') && slotRow.includes('62%'), slotRow)

  // Queue
  await page.locator('[data-tab="queue"]').click()
  await page.locator('[data-grid="queue"] .ag-row').first().waitFor({ timeout: 10000 })
  const first = plain(await page.locator('[data-grid="queue"] .ag-row[row-index="0"]').innerText())
  check(`${L}: queue position reads 1 / 3`, first.includes('1 / 3'), first)
  check(`${L}: the 4 h wait is flagged, the others not`, (await page.locator('[data-grid="queue"] [data-queue-flagged="true"]').count()) === 1)
  check(`${L}: the urgent till is marked`, (await page.locator('[data-grid="queue"] [data-queue-urgent]').count()) === 1)
  const order = await page.locator('[data-queue-store]').evaluateAll((els) => els.map((e) => e.getAttribute('data-queue-store')))
  check(`${L}: stores in grant order with their tills`, JSON.stringify(order) === '["R101","R200"]' && (await page.locator('[data-queue-store="R101"] [data-queue-till]').count()) === 2, JSON.stringify(order))
  check(`${L}: oldest wait 4:10:00`, plain(await page.locator('[data-queue-oldest]').innerText()).includes('4:10:00'))

  // History
  await page.locator('[data-tab="history"]').click()
  await page.locator('[data-grid="history"] .ag-row').first().waitFor({ timeout: 10000 })
  check(`${L}: history lists done and failed`, (await page.locator('[data-history-outcome="done"]').count()) === 1 && (await page.locator('[data-history-outcome="failed"]').count()) === 1)
  check(`${L}: a failure shows its reason`, plain(await page.locator('[data-history-reason]').innerText()).includes('404'))
  await page.locator('[data-history-field="outcome"]').selectOption('failed')
  await page.waitForFunction(() => document.querySelectorAll('[data-history-outcome]').length === 1, null, { timeout: 10000 })
  check(`${L}: the outcome filter goes to HQ`, historyQueries.some((q) => q.includes('outcome=failed')), historyQueries.join(' '))
  await page.locator('[data-history-field="store"]').fill('R301')
  await page.waitForFunction(() => location.search.includes('store=R301'), null, { timeout: 10000 })
  await page.waitForTimeout(300)
  check(`${L}: the store filter goes to HQ`, historyQueries.some((q) => q.includes('store=R301')), historyQueries.at(-1))

  // Convergence
  await page.locator('[data-tab="convergence"]').click()
  await page.locator('[data-convergence-row="3.4.1"]').waitFor({ timeout: 10000 })
  const shares = await page.locator('[data-convergence-row="3.4.1"] [data-share]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-share-pct'))))
  check(`${L}: convergence shares 75 / 20 / 5 add up to 100`, JSON.stringify(shares) === '[75,20,5]', JSON.stringify(shares))
  check(`${L}: no controls (792)`, (await page.locator('[data-release-queue] button:not([data-tab]):not([role="tab"])').count()) === 0)
  if (dir === 'rtl') check(`${L}: the page is RTL`, (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  await page.screenshot({ path: `${process.env.DRIVE_SHOTS || '.'}/release-queue-${dir}.png`, fullPage: false })
  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
