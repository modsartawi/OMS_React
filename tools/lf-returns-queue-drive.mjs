// "LF returns needing action" drive (ticket 764, spec 759 F6) — the Deliveries list's queue.
//
// Every /api/** call is stubbed (BackOffice 3376's read is unbuilt). On the real painted DOM:
//   - without LocalFulfillmentReturn 03 there is no Queues section, no palette row, and no read;
//   - with 03 the rail shows "LF returns needing action" under Queues, its count "—" until read;
//   - picking it fires ONE needing-action read, swaps the results grid for the queue's own grid,
//     presses no lens, and lists the three needing rows (a `refunded` row the stub sneaks in is NOT
//     listed) with return no., forward no., the reason in words and the age in days from bookedAt;
//   - the rail count then reads "3";
//   - a double-click opens the RETURN delivery's Document Details; Back lands on the queue again;
//     Enter on a row does the same;
//   - leaving the screen in-app and coming back keeps the queue on, even with a starred default
//     view that would otherwise apply on that fresh mount;
//   - picking a lens leaves the queue with no read;
//   - an empty answer says "Nothing needs action…", never "No search yet";
//   - a failed read says the server's message;
//   - under `oms.locale = ar` (RTL) the return no. is pinned at the reading start (the right) and
//     the rail row mirrors. The chrome stays English there (`lng` is pinned to `en` app-wide), so
//     the ar bundle's key coverage is proven in src/features/oms/deliveries/lf-returns.test.ts.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/lf-returns-queue-drive.mjs        (DRIVE_PORT=5280 for another port)
//
// Screenshots → tools/.lf-returns-queue-shots/.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.lf-returns-queue-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

/** A local wall-clock stamp `days` before today, as the server sends it (no offset). */
const daysAgo = (days, hh = '10:30') => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${hh}:00`
}

// Newest first, as 3376 sorts. 7004 is `refunded`: a drifted server row the queue must drop.
const NEEDING = [
  { returnDeliveryNo: '7000000101', forwardDeliveryNo: '8000000501', outcome: 'short', bookedAt: daysAgo(0, '08:05') },
  { returnDeliveryNo: '7000000102', forwardDeliveryNo: '8000000502', outcome: 'nothingReceived', bookedAt: daysAgo(1, '23:50') },
  { returnDeliveryNo: '7000000104', forwardDeliveryNo: '8000000504', outcome: 'refunded', bookedAt: daysAgo(2) },
  { returnDeliveryNo: '7000000103', forwardDeliveryNo: '8000000503', outcome: 'unanswered', bookedAt: daysAgo(15) },
]
const EXPECT = {
  en: [
    ['7000000101', '8000000501', 'Short', 'Today'],
    ['7000000102', '8000000502', 'Nothing received', '1 day'],
    ['7000000103', '8000000503', 'Unanswered', '15 days'],
  ],
}

const NEEDING_PATH = 'SdDocumentWeb/LocalFulfillmentReturnsNeedingAction'

function routeApi(state) {
  return async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1017' }),
      )
    if (path === 'SdDocumentWeb/Access')
      return route.fulfill(
        envelope({ canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true, canCreateLocalFulfillmentReturn: state.grant03 }),
      )
    if (path === NEEDING_PATH) {
      // A business refusal (enveloped, success:false) carries its message through; a bare 500 would
      // read core's generic server wording instead, by api.ts's taxonomy.
      if (state.fail) return route.fulfill(envelope(null, { status: 403, success: false, message: 'LocalFulfillmentReturn 03 was revoked' }))
      return route.fulfill(envelope(state.rows))
    }
    if (path === 'SdDocumentWeb/DeliveryDocumentList') return route.fulfill(envelope([]))
    if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path)) return route.fulfill(envelope([]))
    if (/^SdDocumentWeb\/(Delivery|Document)\//.test(path))
      return route.fulfill(envelope(null, { success: false, message: 'Not found in this drive' }))
    if (/Access$/.test(path)) return route.fulfill(envelope({ allowed: true, screenAllowed: true }))
    return route.fulfill(envelope({}))
  }
}

const browser = await chromium.launch()

/**
 * A layout-only view, not starred yet. The drive stars it from its ⋯ menu while the queue is on: a
 * starred default applies on a page open with no in-memory search, so Back from a queued return's
 * Details must NOT let it knock the operator out of the queue.
 */
const UNSTARRED = JSON.stringify({
  views: [{ id: 'v-star', name: 'Starred layout', query: null, lens: 'all', columnState: null, filterModel: null }],
  defaultId: null,
  legacyImported: true,
})

async function open({ locale = 'en', state, views = null }) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(
    ([l, v]) => {
      localStorage.setItem('oms.locale', l)
      if (v) localStorage.setItem('oms.deliveries.views.v1:msartawi', v)
    },
    [locale, views],
  )
  await page.route('**/api/**', routeApi(state))
  const requests = []
  page.on('request', (r) => r.url().includes('/api/') && requests.push(r.url().split('/api/')[1].split('?')[0]))
  await page.goto(BASE + '/oms/deliveries')
  await page.waitForSelector('[data-views-rail]', { timeout: 20000 })
  await page.waitForTimeout(300)
  return { context, page, requests, errors }
}

/** The queue grid's rows in order: [return, forward, reason, age]. */
const readQueue = (page) =>
  page.evaluate(() => {
    const grid = document.querySelector('[data-lf-returns-queue]')
    if (!grid) return null
    const byIndex = new Map()
    for (const cell of grid.querySelectorAll('.ag-row .ag-cell[col-id]')) {
      const row = cell.closest('.ag-row')
      const i = Number(row.getAttribute('row-index'))
      const entry = byIndex.get(i) ?? {}
      entry[cell.getAttribute('col-id')] = cell.textContent.trim()
      byIndex.set(i, entry)
    }
    return [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, e]) => [e.returnDeliveryNo, e.forwardDeliveryNo, e.reason, e.age])
  })

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── 1. Without 03 ──────────────────────────────────────────────────────────
{
  const state = { grant03: false, rows: NEEDING, fail: false }
  const { context, page, requests } = await open({ state })
  const section = await page.locator('[data-queue], #deliveries-queues').count()
  check('without 03: no Queues section and no queue row', section === 0, `${section} found`)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(300)
  await page.keyboard.type('LF returns')
  await page.waitForTimeout(300)
  const paletteRow = await page.getByText('Show: LF returns needing action').count()
  check('without 03: the palette offers no "Show: LF returns needing action"', paletteRow === 0)
  await page.keyboard.press('Escape')
  check('without 03: the needing-action read is never made', !requests.includes(NEEDING_PATH), requests.join(', '))
  await context.close()
}

// ── 2. With 03, English ────────────────────────────────────────────────────
{
  const state = { grant03: true, rows: NEEDING, fail: false }
  const { context, page, requests, errors } = await open({ state, views: UNSTARRED })
  const row = page.locator('[data-queue="lfReturns"]')
  const heading = (await page.locator('#deliveries-queues').textContent())?.trim()
  const label = (await row.textContent())?.trim() ?? ''
  check('with 03: the rail shows "LF returns needing action" under Queues', heading === 'Queues' && label.startsWith('LF returns needing action'), `"${heading}" · "${label}"`)
  const before = (await page.locator('[data-queue-count]').textContent())?.trim()
  check('with 03: before it is read its count reads "—" and no read was made', before === '—' && !requests.includes(NEEDING_PATH), `"${before}"`)

  const empty0 = await page.locator('[data-grid-empty="before"]').isVisible()
  await row.click()
  await page.waitForSelector('[data-lf-returns-queue] .ag-row', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(300)
  const reads = requests.filter((r) => r === NEEDING_PATH).length
  check('picking it makes ONE needing-action read', reads === 1, `${reads} reads`)
  const listed = await readQueue(page)
  check('it lists the three needing rows with reason and age in days, and drops the refunded one', same(listed, EXPECT.en), JSON.stringify(listed))
  const pressed = await page.evaluate(() => ({
    queue: document.querySelector('[data-queue="lfReturns"]')?.getAttribute('aria-pressed'),
    lenses: [...document.querySelectorAll('[data-lens]')].filter((l) => l.getAttribute('aria-pressed') === 'true').length,
    title: document.querySelector('[data-active-queue]')?.textContent?.trim(),
    resultsHidden: !document.querySelector('[data-grid-empty]') || document.querySelector('[data-grid-empty]').offsetParent === null,
  }))
  check(
    'the queue is pressed, no lens is, the title names it and the results grid is out of sight',
    pressed.queue === 'true' && pressed.lenses === 0 && pressed.title === 'LF returns needing action' && pressed.resultsHidden && empty0,
    JSON.stringify(pressed),
  )
  const count = (await page.locator('[data-queue-count]').textContent())?.trim()
  check('the rail count reads the listed rows, "3"', count === '3', `"${count}"`)
  await page.screenshot({ path: `${SHOTS}/queue-en.png` })

  // Star the view while the queue is on (Make default stars, it does not apply).
  const viewRow = page.locator('[data-view-row][data-view-name="Starred layout"]')
  await viewRow.hover()
  await viewRow.locator('[data-view-menu-trigger]').click()
  await page.locator('[data-view-menu] [data-view-action="toggleDefault"]').click()
  await page.waitForTimeout(200)
  const starredNow = await page.evaluate(() => ({
    star: !!document.querySelector('[data-view-row][data-view-name="Starred layout"] [data-view-default]'),
    queue: !!document.querySelector('[data-lf-returns-queue]'),
  }))
  check('starring a view while the queue is on keeps the queue (the fresh-mount check leans on the star)', starredNow.star && starredNow.queue, JSON.stringify(starredNow))

  // A double-click opens the RETURN delivery; Back lands on the queue again.
  await page.locator('[data-lf-returns-queue] .ag-row[row-index="1"] .ag-cell[col-id="reason"]').dblclick()
  await page.waitForURL(/\/oms\/delivery\//, { timeout: 5000 }).catch(() => {})
  check('a double-click opens the return delivery\'s Document Details', page.url().endsWith('/oms/delivery/7000000102'), page.url())
  await page.goBack()
  await page.waitForSelector('[data-lf-returns-queue] .ag-row', { timeout: 10000 }).catch(() => {})
  const back = await readQueue(page)
  check('Back lands on the queue again', same(back, EXPECT.en), JSON.stringify(back))

  // Leave the screen in-app and come back: the page mounts afresh with no search and a starred
  // default, which would apply on open — but the queue the operator left on stays on.
  await page.locator('a[href="/"]').first().click()
  await page.waitForURL((u) => u.pathname === '/', { timeout: 5000 }).catch(() => {})
  await page.goBack()
  await page.waitForSelector('[data-views-rail]', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
  const remount = await page.evaluate(() => ({
    queue: !!document.querySelector('[data-lf-returns-queue]'),
    view: document.querySelector('[data-active-view]')?.textContent?.trim() ?? null,
  }))
  check('a fresh mount keeps the queue on rather than applying the starred default view', remount.queue && remount.view === null, JSON.stringify(remount))

  // Enter on a focused row does the same.
  await page.locator('[data-lf-returns-queue] .ag-row[row-index="2"] .ag-cell[col-id="forwardDeliveryNo"]').click()
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/oms\/delivery\//, { timeout: 5000 }).catch(() => {})
  check('Enter on a row opens its return delivery', page.url().endsWith('/oms/delivery/7000000103'), page.url())
  await page.goBack()
  await page.waitForSelector('[data-lf-returns-queue]', { timeout: 10000 }).catch(() => {})

  // A lens leaves the queue, with no read.
  const n = requests.length
  await page.locator('[data-lens="attention"]').click()
  await page.waitForTimeout(300)
  const left = await page.evaluate(() => ({
    queue: !!document.querySelector('[data-lf-returns-queue]'),
    lens: document.querySelector('[data-lens="attention"]')?.getAttribute('aria-pressed'),
  }))
  check('picking a lens leaves the queue and makes no read', !left.queue && left.lens === 'true' && requests.length === n, JSON.stringify(left))

  // An empty answer is worded as nothing needing action.
  state.rows = []
  await page.locator('[data-queue="lfReturns"]').click()
  await page.waitForSelector('[data-lf-returns-empty]', { timeout: 10000 }).catch(() => {})
  const emptyText = (await page.locator('[data-lf-returns-empty]').textContent().catch(() => ''))?.trim()
  const noSearchVisible = await page.locator('[data-grid-empty="before"]').isVisible()
  check(
    'an empty answer says nothing needs action, not "no search yet"',
    emptyText === 'Nothing needs action: no LF return is unanswered, empty or short.' && !noSearchVisible,
    `"${emptyText}" · no-search visible ${noSearchVisible}`,
  )
  const zero = (await page.locator('[data-queue-count]').textContent())?.trim()
  check('the rail count then reads "0"', zero === '0', `"${zero}"`)
  await page.screenshot({ path: `${SHOTS}/empty-en.png` })

  // A failed read says the server's message.
  state.fail = true
  await page.locator('[data-queue="lfReturns"]').click()
  await page.waitForSelector('[data-lf-returns-error]', { timeout: 10000 }).catch(() => {})
  const failText = (await page.locator('[data-lf-returns-error]').textContent().catch(() => ''))?.trim() ?? ''
  check('a failed read says so, with the server\'s message', failText.includes('Could not load LF returns needing action') && failText.includes('LocalFulfillmentReturn 03 was revoked'), `"${failText}"`)

  check('no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 3. With 03, Arabic (RTL) ───────────────────────────────────────────────
{
  const state = { grant03: true, rows: NEEDING, fail: false }
  const { context, page } = await open({ locale: 'ar', state })
  await page.locator('[data-queue="lfReturns"]').click()
  await page.waitForSelector('[data-lf-returns-queue] .ag-row', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(300)
  // `lng` is pinned to `en` app-wide (Arabic chrome is not switched on yet), so the chrome reads
  // English under RTL; the ar bundle's coverage is proven in lf-returns.test.ts. Here: the layout.
  const listed = await readQueue(page)
  const dir = await page.evaluate(() => document.documentElement.dir)
  check('ar: the page is RTL and the queue lists the same rows', dir === 'rtl' && same(listed, EXPECT.en), `${dir} · ${JSON.stringify(listed)}`)
  const side = await page.evaluate(() => {
    const q = document.querySelector('[data-lf-returns-queue]')
    const a = q.querySelector('.ag-header-cell[col-id="returnDeliveryNo"]')?.getBoundingClientRect()
    const b = q.querySelector('.ag-header-cell[col-id="forwardDeliveryNo"]')?.getBoundingClientRect()
    return a && b ? (a.left > b.left ? 'right' : 'left') : null
  })
  check('ar: the return no. sits at the reading start (the right)', side === 'right', String(side))
  // The rail row's count sits at its inline end: the left under RTL.
  const rail = await page.evaluate(() => {
    const row = document.querySelector('[data-queue="lfReturns"]')?.getBoundingClientRect()
    const count = document.querySelector('[data-queue-count]')?.getBoundingClientRect()
    return row && count ? count.left - row.left < row.right - count.right : null
  })
  check('ar: the rail row mirrors, its count at the inline end (left)', rail === true, String(rail))
  await page.screenshot({ path: `${SHOTS}/queue-ar.png` })
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
