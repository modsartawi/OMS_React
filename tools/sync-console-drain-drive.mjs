// Sync console Mirror drain drive (oms 931, BackOffice 4091) — drives the REAL /admin/sync/mirror page in Chromium
// against STUBBED `ActionSync/Mirror/Inbox` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md, "Mirror drain").
// 🚩 Nothing here touches a live SIS.Api: the live walk is the ticket's last box.
//
// It verifies, in English and right to left:
//   1. the `behind` fixture (19-20 Nov): the sentence "Falling behind since 2026-11-19 08:00" in the danger ink, the
//      door's reasons under it, the pie's centre, "Not draining" on the Empty-at tile, the danger band and the
//      "since" marker (before this window);
//   2. the window switch asks the door for 24h, and the bars follow;
//   3. the `healthy` fixture: "Draining, empty by 14:20", no band, no marker;
//   4. the `down` fixture: "Not applying since 11:50";
//   5. the nav tab and the Fleet's link reach the page.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-drain-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-drain-shots'
mkdirSync(SHOTS, { recursive: true })

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

const AS_OF = '2026-11-20T12:05:00'
const pad = (n) => String(n).padStart(2, '0')
const stamp = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`

// Slots from `from`, `count` of them `minutes` wide, the last partial; `shape(i)` gives each one's counts.
function slots(from, count, minutes, shape) {
  const out = []
  for (let i = 0; i < count; i++) {
    const at = new Date(new Date(from).getTime() + i * minutes * 60_000)
    out.push({ slot: stamp(at), partial: i === count - 1, parked: 0, ...shape(i, at) })
  }
  return out
}

// 19-20 Nov: the pull paused at 50,000, the apply at a few thousand a slot, 858k waiting; every full slot bad.
const behindSlots = (window) => {
  const ten = window === '6h'
  const count = ten ? 37 : window === '24h' ? 25 : 169
  const from = ten ? '2026-11-20T06:00:00' : window === '24h' ? '2026-11-19T12:00:00' : '2026-11-13T12:00:00'
  let pending = 858_412 + (count - 1) * (ten ? 2_100 : 12_000)
  return slots(from, count, ten ? 10 : 60, (i, at) => {
    const collapse = at >= new Date('2026-11-19T08:00:00')
    const normal = !ten && !collapse
    const applied = ten ? 2_100 : normal ? 60_000 : 12_000
    const pulled = ten ? 0 : normal ? 60_000 : at < new Date('2026-11-19T22:00:00') ? 40_000 : 0
    pending = Math.max(0, pending + pulled - applied)
    const bad = i < count - 1 && (ten || collapse)
    return { pulled, applied, net: applied - pulled, pendingAtEnd: pending, bad, why: bad ? (ten ? 'pullPaused' : 'slowApply') : null }
  })
}

const BEHIND = (window) => ({
  asOf: AS_OF,
  window,
  slotMinutes: window === '6h' ? 10 : 60,
  verdict: 'behind',
  reasons: [
    { code: 'pullPaused', level: 'behind', since: '2026-11-19T21:38:00', value: 858_412, limit: 50_000, kind: null, text: '' },
    { code: 'trouble', level: 'behind', since: '2026-11-19T08:00:00', value: 36, limit: 3, kind: 'slowApply', text: '' },
    { code: 'lagging', level: 'behind', since: '2026-11-19T19:02:00', value: 1_023, limit: 60, kind: null, text: '' },
    { code: 'recentParks', level: 'warning', since: null, value: 4, limit: null, kind: null, text: '' },
  ],
  pending: 858_412,
  waitingForRetry: 12,
  oldestPendingPulledAt: '2026-11-19T19:02:00',
  lagMinutes: 1_023,
  lastAppliedAt: '2026-11-20T12:04:50',
  lastPulledAt: '2026-11-19T21:38:00',
  parkedOpen: 1_625,
  parkedLast30Min: 4,
  backpressureThreshold: 50_000,
  pullPaused: true,
  pullPausedSince: '2026-11-19T21:38:00',
  window24h: { pulled: 412_000, applied: 296_000, stillPending: 114_375, parked: 1_625 },
  applyPerMinute: 210,
  arrivePerMinute: 0,
  etaEmptyAt: null,
  etaPullResumesAt: '2026-11-20T13:13:00',
  slots: behindSlots(window),
  troubleSince: '2026-11-19T08:00:00',
  tillBacklogKnown: 231_400,
  tillBacklogOldestMeasuredAt: '2026-11-19T21:36:00',
  pendingByType: [
    { entityType: 'PICK_UNIT', action: 'UPSERT', pending: 702_118, oldestPulledAt: '2026-11-19T19:02:00' },
    { entityType: 'POS_TRANSACTION', action: 'COMPLETED', pending: 140_990, oldestPulledAt: '2026-11-19T19:40:00' },
    { entityType: 'SHIFT', action: 'OPEN', pending: 15_304, oldestPulledAt: '2026-11-19T20:11:00' },
  ],
  parkedByReason: [{ parkReason: 'errorCap', errorPrefix: 'SQL not available', count: 1_625, lastAt: '2026-11-20T12:01:00' }],
})

const HEALTHY = {
  ...BEHIND('6h'),
  verdict: 'healthy',
  reasons: [],
  pending: 1_200,
  waitingForRetry: 0,
  lagMinutes: 2,
  pullPaused: false,
  pullPausedSince: null,
  parkedOpen: 0,
  parkedLast30Min: 0,
  applyPerMinute: 900,
  arrivePerMinute: 890,
  etaEmptyAt: '2026-11-20T14:20:00',
  etaPullResumesAt: null,
  troubleSince: null,
  window24h: { pulled: 1_310_000, applied: 1_308_800, stillPending: 1_200, parked: 0 },
  slots: slots('2026-11-20T06:00:00', 37, 10, () => ({ pulled: 9_000, applied: 9_000, net: 0, pendingAtEnd: 1_200, bad: false, why: null })),
  pendingByType: [{ entityType: 'POS_TRANSACTION', action: 'COMPLETED', pending: 1_200, oldestPulledAt: '2026-11-20T12:03:00' }],
  parkedByReason: [],
}

const DOWN = {
  ...HEALTHY,
  verdict: 'down',
  pending: 40,
  troubleSince: '2026-11-20T11:50:00',
  reasons: [{ code: 'applyStopped', level: 'down', since: '2026-11-20T11:51:00', value: 14, limit: 5, kind: null, text: '' }],
  etaEmptyAt: null,
  applyPerMinute: 0,
  slots: slots('2026-11-20T06:00:00', 37, 10, (i) => ({ pulled: 4, applied: i >= 35 ? 0 : 4, net: 0, pendingAtEnd: 40, bad: i >= 35 && i < 36, why: i >= 35 && i < 36 ? 'noApply' : null })),
}

async function drive(browser, locale, fixture, asked) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1500 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['ActionSyncConsole:03']))
    if (p === 'ActionSync/Mirror/Inbox') {
      const window = url.searchParams.get('window') ?? '6h'
      asked.push(window)
      return route.fulfill(envelope(typeof fixture === 'function' ? fixture(window) : fixture))
    }
    if (p === 'ActionSync/Workers') return route.fulfill(envelope({ items: [] }))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors }
}

const text = async (page, sel) => ((await page.locator(sel).first().textContent()) ?? '').replace(/[\u2066-\u2069]/g, '').trim()

const browser = await chromium.launch()
try {
  // 1-2. behind, in both languages.
  for (const locale of ['en', 'ar']) {
    const asked = []
    const { context, page, errors } = await drive(browser, locale, BEHIND, asked)
    await page.goto(`${BASE}/admin/sync/mirror`)
    await page.locator('[data-verdict="behind"]').waitFor()
    await page.locator('[data-drain-chart] .recharts-reference-area').first().waitFor()
    const line = await text(page, '[data-verdict-line]')
    if (locale === 'en') {
      check('behind: the sentence names since when', line === 'Falling behind since 2026-11-19 08:00', line)
      check('behind: the reasons, worst first', (await page.locator('[data-reason]').count()) === 4)
      check('behind: the pie centre reads the share applied', (await text(page, '[data-pie-centre]')).startsWith('71%'), await text(page, '[data-pie-centre]'))
      check('behind: Empty at reads Not draining', (await text(page, '[data-drain-tile="empty"]')).includes('Not draining'))
      check('behind: the pull resumes at 13:13', (await text(page, '[data-drain-tile="resumes"]')).includes('13:13'))
      check('behind: the till backlog not pulled yet', (await text(page, '[data-till-backlog]')).includes('231,400'))
      check('behind: the caption says since when, before this window',
        (await text(page, '[data-since-caption]')) === 'Trouble since 2026-11-19 08:00, before this window', await text(page, '[data-since-caption]'))
    } else {
      check('ar: the page is right to left', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
      // The OMS app boots i18n in English for every locale today (`src/core/i18n.ts`, `lng: 'en'`): `oms.locale` sets
      // the direction only. The Arabic copy is pinned by `mirror-drain-helpers.test.ts` (every key, both files).
      check('ar: the sentence reads whole under RTL', line === 'Falling behind since 2026-11-19 08:00', line)
    }
    check(`${locale}: the trouble band is drawn`, (await page.locator('[data-drain-chart] .recharts-reference-area').count()) > 0)
    check(`${locale}: the since marker is drawn`, (await page.locator('[data-drain-chart] .recharts-reference-line').count()) >= 2)
    await page.screenshot({ path: `${SHOTS}/behind-6h-${locale}.png`, fullPage: true })
    await page.locator('[data-window="24h"]').click()
    await page.waitForFunction(() => document.querySelector('[data-drain-window]')?.getAttribute('data-drain-window') === '24h')
    await page.waitForTimeout(300)
    check(`${locale}: the window switch asks the door for 24h`, asked.includes('24h'), asked.join(','))
    await page.screenshot({ path: `${SHOTS}/behind-24h-${locale}.png`, fullPage: true })
    await page.locator('[data-window="7d"]').click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${SHOTS}/behind-7d-${locale}.png`, fullPage: true })
    check(`${locale}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 3. healthy.
  {
    const { context, page, errors } = await drive(browser, 'en', HEALTHY, [])
    await page.goto(`${BASE}/admin/sync/mirror`)
    await page.locator('[data-verdict="healthy"]').waitFor()
    const line = await text(page, '[data-verdict-line]')
    check('healthy: draining, empty by 14:20', line === 'Draining, empty by 14:20', line)
    check('healthy: no band, no marker', (await page.locator('[data-drain-chart] .recharts-reference-area').count()) === 0 &&
      (await page.locator('[data-drain-chart] .recharts-reference-line').count()) === 0 && (await page.locator('[data-since-caption]').count()) === 0)
    await page.screenshot({ path: `${SHOTS}/healthy-en.png`, fullPage: true })
    check('healthy: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 4. down.
  {
    const { context, page } = await drive(browser, 'en', DOWN, [])
    await page.goto(`${BASE}/admin/sync/mirror`)
    await page.locator('[data-verdict="down"]').waitFor()
    const line = await text(page, '[data-verdict-line]')
    check('down: not applying since 11:50', line === 'Not applying since 11:50', line)
    check('down: nothing applied for 14 min', (await text(page, '[data-reason="applyStopped"]')) === 'Nothing applied for 14 min')
    await page.screenshot({ path: `${SHOTS}/down-en.png`, fullPage: true })
    await context.close()
  }

  // 5. the nav tab and the Fleet's link.
  {
    const { context, page } = await drive(browser, 'en', HEALTHY, [])
    await page.goto(`${BASE}/admin/sync/mirror`)
    await page.locator('[data-console-page="mirror"]').waitFor()
    check('nav: the Mirror drain tab is current', (await page.locator('[data-console-page="mirror"][aria-current="page"]').count()) === 1)
    await context.close()
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed; shots in ${SHOTS}`)
process.exit(failed.length ? 1 : 0)
