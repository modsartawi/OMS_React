// Sync console Store page drive (ticket 446, spec 444) — drives the REAL store page in Chromium
// against STUBBED `ActionSync/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2539 is unbuilt, and ticket 450 is the
// live walk.
//
// It verifies:
//   1. a worker store's header (code, description, host, door states, the pending badge read off
//      controlPending) and its health summary (reachable, backoff, push lag + oldest pending, last trx
//      pulled, each loop's last pass and last error);
//   2. the 24 h strip: one cell per hour from Store/Hours, coloured by the door's cell (an unknown cell
//      as noData), and the five-entry legend;
//   3. the six tabs in order; Counters opens first, a pull counter's log head and lag are blank;
//   4. Passes opens on 7 days ago, its picker is bounded to 30 days (an older date is pulled back to the
//      bound before any call), it pages at 50, and a pass opens its detail from Store/PassDetail;
//   5. Scripts shows the script id and its state, never SQL; Location shows no credentials;
//   6. Commands and Audit are placeholders; ?tab= opens a tab and survives a reload;
//   7. a WPF store shows only Counters and Passes, with the WPF note, no health and no strip;
//   8. a 404 NO_STORE shows "No such store", asked once, not a crash.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-store-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-store-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope `src/core/api.ts` reads (the contract abbreviates its error entries).
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const loop = (over = {}) => ({ lastPassAt: '2026-10-09T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null, ...over })
const noLoop = () => ({ lastPassAt: null, lastPassOutcome: 'None', lastErrorAt: null, lastError: null })

const WORKER_STORE = {
  code: 'P001',
  description: 'Olaya Main',
  host: 'Worker',
  isPaused: false,
  controlPending: true,
  states: ['onWorker', 'erroring', 'controlPending'],
  lastConnectOkAt: '2026-10-09T12:03:10',
  lastConnectFailAt: '2026-10-09T09:15:00',
  lastConnectError: 'A network-related error occurred (timeout 5 s)',
  backoffUntil: '2026-10-09T12:05:00',
  push: loop({ lastPassOutcome: 'Failed', lastErrorAt: '2026-10-09T11:31:02', lastError: 'Violation of PRIMARY KEY constraint' }),
  pull: loop(),
  pendingActions: 1240,
  oldestPendingActionAt: '2026-10-09T10:50:00',
  lastTrxPulledAt: '2026-10-09T12:02:00',
  healthUpdatedAt: '2026-10-09T12:03:30',
  controlVersion: 7,
  appliedVersion: 6,
  appliedAt: '2026-10-09T11:00:00',
}
const WPF_STORE = {
  code: 'P002',
  description: 'Tahlia',
  host: 'Wpf',
  isPaused: false,
  controlPending: false,
  states: ['onWpf'],
  lastConnectOkAt: null,
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: noLoop(),
  pull: noLoop(),
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: null,
  healthUpdatedAt: null,
  controlVersion: 0,
  appliedVersion: 0,
  appliedAt: null,
}
const STORES = { P001: WORKER_STORE, P002: WPF_STORE }

// 24 hours, oldest first: 08:00 yesterday … 07:00 … the cells cycle the five, with one cell a door newer
// than this bundle might send.
const CYCLE = ['work', 'idle', 'passErrors', 'connectFailOnly', 'noData', 'work']
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date(2026, 9, 8, 13 + i)
  const pad = (n) => String(n).padStart(2, '0')
  const hour = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`
  const cell = i === 23 ? 'melting' : CYCLE[i % CYCLE.length]
  return { hour, cell, pushPasses: 60, pullPasses: 120, connectFailures: 0, actionsPushed: 400, trxPulled: 90, errors: 0 }
})

const COUNTERS = {
  items: [
    { objectId: 'ItemMaster', bound: 'Out', lineNumber: 1, counter: 88120000, logHead: 88121240, lag: 1240, oldestPendingAt: '2026-10-09T10:50:00' },
    { objectId: 'ItemPrice', bound: 'Out', lineNumber: 2, counter: 88211731, logHead: 88211731, lag: 0, oldestPendingAt: null },
    { objectId: 'RetailTrx', bound: 'In', lineNumber: 15, counter: 4412019, logHead: null, lag: null, oldestPendingAt: null },
  ],
}

// 75 passes: two pages at 50.
const PASSES = Array.from({ length: 75 }, (_, i) => ({
  processId: `PR-${String(1000 - i)}`,
  loop: i % 2 ? 'pull' : 'push',
  startOn: `2026-10-0${9 - Math.floor(i / 20)}T${String(12 - (i % 12)).padStart(2, '0')}:03:58`,
  finishOn: `2026-10-0${9 - Math.floor(i / 20)}T${String(12 - (i % 12)).padStart(2, '0')}:04:00`,
  status: i === 3 ? 'Failed' : i === 5 ? 'Partial' : 'Ok',
  actionsCount: 412 + i,
  errorMessage: i === 3 ? 'Violation of PRIMARY KEY constraint' : null,
}))
const PASS_DETAIL = {
  items: [
    { lineNumber: 1, objectId: 'ItemMaster', identifiers: '100045', actionType: 'Upsert', counter: 88120001, lineStatus: 'Ok', startOn: '2026-10-09T11:31:02', finishOn: '2026-10-09T11:31:04', errorMessage: null },
    // One line, two chunks: a pass writes a row per object AND chunk, so line 2 repeats.
    { lineNumber: 2, objectId: 'ItemPrice', identifiers: '100040', actionType: 'Upsert', counter: 88120000, lineStatus: 'Ok', startOn: '2026-10-09T11:31:03', finishOn: '2026-10-09T11:31:04', errorMessage: null },
    { lineNumber: 2, objectId: 'ItemPrice', identifiers: '100046', actionType: 'Upsert', counter: 88120002, lineStatus: 'Error', startOn: '2026-10-09T11:31:04', finishOn: '2026-10-09T11:31:05', errorMessage: 'Violation of PRIMARY KEY constraint' },
  ],
}
const SCRIPTS = {
  items: [
    { scriptId: 'SCR-2026-0412', createdAt: '2026-10-01T09:00:00', isExecuted: true, lastAttempt: '2026-10-01T09:05:00', errorMessage: null },
    { scriptId: 'SCR-2026-0419', createdAt: '2026-10-08T09:00:00', isExecuted: false, lastAttempt: '2026-10-09T11:00:00', errorMessage: "Invalid column name 'Foo'" },
  ],
}
const LOCATION = { code: 'P001', description: 'Olaya Main', ip: '10.20.1.11', instance: 'SQLEXPRESS', dbName: 'POS', groupId: 'G01', father: 'BackOffice', isPosSyncEnabled: true }

const browser = await chromium.launch()

async function open({ failStoreAfter = Infinity, failHoursAfter = Infinity } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  // A fixed local "today", so the 30-day bound is checkable: 2026-10-09.
  await page.clock.install({ time: new Date('2026-10-09T12:04:00') })
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    calls.push(p + url.search)
    const code = url.searchParams.get('code')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate: false, canOnboard: false }))
    if (p === 'ActionSync/Store') {
      if (calls.filter((c) => c.startsWith('ActionSync/Store?')).length > failStoreAfter)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The store read failed.', errorCode: 'BOOM' }))
      const s = STORES[code]
      return route.fulfill(s ? envelope(s) : envelope(null, { status: 404, success: false, message: 'No store with this code.', errorCode: 'NO_STORE' }))
    }
    if (p === 'ActionSync/Store/Hours') {
      if (calls.filter((c) => c.startsWith('ActionSync/Store/Hours?')).length > failHoursAfter)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'The hours read failed.', errorCode: 'BOOM' }))
      return route.fulfill(envelope({ items: HOURS }))
    }
    if (p === 'ActionSync/Store/Counters') return route.fulfill(envelope(COUNTERS))
    if (p === 'ActionSync/Store/Passes') {
      const pg = Number(url.searchParams.get('page'))
      const size = Number(url.searchParams.get('pageSize'))
      return route.fulfill(envelope({ items: PASSES.slice((pg - 1) * size, pg * size), total: PASSES.length, page: pg, pageSize: size }))
    }
    if (p === 'ActionSync/Store/PassDetail') return route.fulfill(envelope(PASS_DETAIL))
    if (p === 'ActionSync/Store/Scripts') return route.fulfill(envelope(SCRIPTS))
    if (p === 'ActionSync/Store/Location') return route.fulfill(envelope(LOCATION))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls }
}

const strip = (s) => s.replace(/[\u2068\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitForCall = async (page, calls, want) => {
  for (let i = 0; i < 40; i++) {
    if (calls.some((c) => c === want)) return true
    await page.waitForTimeout(100)
  }
  return false
}
// An autoHeight grid draws its rows over a frame or two: wait for the count to settle.
const rowCount = async (page, sel, want) => {
  let n = 0
  for (let i = 0; i < 30; i++) {
    n = await page.locator(sel).count()
    if (n === want) return n
    await page.waitForTimeout(100)
  }
  return n
}
const tabList = (page) => page.locator('[role="tab"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))

// ── 1–6: a worker store ────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-header]').waitFor({ timeout: 20000 })

  const header = strip(await page.locator('[data-store-header]').innerText())
  check('1. the header shows the code and the description', /^P001 Olaya Main/.test(header), header)
  check('1. …the host', (await page.locator('[data-store-host="Worker"]').count()) === 1 && /Host Worker/.test(header), header)
  check('1. …the door states without the pending one', (await page.locator('[data-store-header] [data-states]').first().getAttribute('data-states')) === 'onWorker erroring')
  check('1. …and the pending badge read off controlPending', (await page.locator('[data-control-pending]').count()) === 1 && /Control pending/.test(header), header)
  const health = strip(await page.locator('[data-store-health]').innerText())
  check('1. health: as-of stamp, unshifted', /Health as of 2026-10-09 12:03/.test(health), health)
  check('1. health: reachable, last failure, backoff and the connect error', /Last connect 2026-10-09 12:03/.test(health) && /Last connect failure 2026-10-09 09:15/.test(health) && /Next try after \(backoff\) 2026-10-09 12:05/.test(health) && /timeout 5 s/.test(health), health)
  check('1. health: push lag with the oldest pending action', /1,240 actions pending/.test(health) && /Oldest pending action 2026-10-09 10:50/.test(health), health)
  check('1. health: last transaction pulled', /Last transaction pulled 2026-10-09 12:02/.test(health), health)
  const pushErr = strip(await page.locator('[data-loop="push"]').innerText())
  const pullErr = strip(await page.locator('[data-loop="pull"]').innerText())
  check('1. health: push loop failed, with its error and time', /Failed/.test(pushErr) && /2026-10-09 11:31 Violation of PRIMARY KEY constraint/.test(pushErr), pushErr)
  check('1. health: pull loop ok, no error', /Done/.test(pullErr) && /No error/.test(pullErr), pullErr)

  // 2: the strip.
  check('2. the strip asks Store/Hours for 24 hours', calls.includes('ActionSync/Store/Hours?code=P001&hours=24'), calls.filter((c) => c.includes('Hours')).join(','))
  await page.locator('[data-hour-cell]').first().waitFor()
  const cells = await page.locator('[data-hour-cell]').evaluateAll((els) => els.map((e) => e.getAttribute('data-hour-cell')))
  check('2. one cell per hour', cells.length === 24, String(cells.length))
  check('2. each cell is the door cell', cells.slice(0, 6).join(',') === 'work,idle,passErrors,connectFailOnly,noData,work', cells.join(','))
  check('2. an unknown cell is drawn as noData', cells[23] === 'noData')
  const swatches = await page.locator('[data-hour-cell]').evaluateAll((els) => els.slice(0, 5).map((e) => getComputedStyle(e).backgroundColor))
  check('2. the five cells draw in five colours', new Set(swatches).size === 5, swatches.join(' | '))
  const cellTitle = strip((await page.locator('[data-hour-cell]').nth(2).getAttribute('title')) || '')
  check('2. a cell names its hour and its reading, as one pair', cellTitle === '2026-10-08 15:00 · Pass errors', cellTitle)
  const legend = await page.locator('[data-legend]').evaluateAll((els) => els.map((e) => e.innerText.trim()))
  check('2. the legend lists the five cells', JSON.stringify(legend) === '["Passes ran, work moved","Checked, idle","Pass errors","Connect failures only","No data"]', JSON.stringify(legend))

  // 3: the tabs, Counters first.
  check('3. six tabs in the prototype order', JSON.stringify(await tabList(page)) === '["counters","passes","commands","scripts","audit","location"]', JSON.stringify(await tabList(page)))
  await page.locator('[data-tab-grid="counters"] .ag-row').first().waitFor()
  check('3. Counters opens first', (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'counters')
  check('3. …reading Store/Counters', calls.includes('ActionSync/Store/Counters?code=P001'))
  const c1 = strip(await page.locator('[data-tab-grid="counters"] .ag-row[row-id="1-ItemMaster-Out"]').innerText())
  check('3. a push counter shows counter, head, lag and oldest pending', /ItemMaster/.test(c1) && /Push/.test(c1) && /88,120,000/.test(c1) && /88,121,240/.test(c1) && /1,240/.test(c1) && /2026-10-09 10:50/.test(c1), c1)
  const pullHead = strip(await page.locator('.ag-row[row-id="15-RetailTrx-In"] [col-id="logHead"]').innerText())
  const pullLag = strip(await page.locator('.ag-row[row-id="15-RetailTrx-In"] [col-id="lag"]').innerText())
  check('3. a pull counter has a blank head and lag, not 0', pullHead === '' && pullLag === '', JSON.stringify([pullHead, pullLag]))
  check('3. no later tab has been read yet', !calls.some((c) => /Store\/(Passes|Scripts|Location)/.test(c)))
  await page.screenshot({ path: `${SHOTS}/store.png`, fullPage: true })

  // 4: passes.
  await page.locator('[data-tab="passes"]').click()
  check('4. Passes opens on 7 days ago, page 1 of 50', await waitForCall(page, calls, 'ActionSync/Store/Passes?code=P001&from=2026-10-02&page=1&pageSize=50'), calls.filter((c) => c.includes('Passes')).join(','))
  const picker = page.locator('[data-passes-from]')
  check('4. the picker is bounded to the last 30 days', (await picker.getAttribute('min')) === '2026-09-09' && (await picker.getAttribute('max')) === '2026-10-09')
  await page.locator('[data-tab-grid="passes"] .ag-row').first().waitFor()
  check('4. a page draws 50 passes', (await rowCount(page, '[data-tab-grid="passes"] .ag-row', 50)) === 50)
  const failedRow = strip(await page.locator('.ag-row[row-id="PR-997"]').innerText())
  check('4. a pass shows loop, outcome, actions and its error', /Pull/.test(failedRow) && /Failed/.test(failedRow) && /415/.test(failedRow) && /Violation of PRIMARY KEY/.test(failedRow), failedRow)
  await picker.fill('2026-08-01')
  check('4. an out-of-window date is held while the box is being typed in', !calls.some((c) => c.includes('from=2026-08-01')))
  await picker.blur()
  check('4. an older date is pulled back to the 30-day bound before the call', await waitForCall(page, calls, 'ActionSync/Store/Passes?code=P001&from=2026-09-09&page=1&pageSize=50'), calls.filter((c) => c.includes('Passes')).join(','))
  check('4. …and never sent past it', !calls.some((c) => c.includes('from=2026-08-01')))
  check('4. the picker shows the bound', (await picker.inputValue()) === '2026-09-09', await picker.inputValue())
  await page.getByRole('button', { name: 'Next' }).click()
  check('4. Next asks for page 2', await waitForCall(page, calls, 'ActionSync/Store/Passes?code=P001&from=2026-09-09&page=2&pageSize=50'))
  await page.locator('.ag-row[row-id="PR-950"]').waitFor()
  check('4. page 2 draws the last 25', (await rowCount(page, '[data-tab-grid="passes"] .ag-row', 25)) === 25)
  await page.getByRole('button', { name: 'Previous' }).click()
  await page.locator('[data-pass="PR-997"]').click()
  await page.locator('[data-pass-detail="PR-997"] .ag-row').first().waitFor({ timeout: 10000 })
  check('4. a pass opens its detail from Store/PassDetail', calls.includes('ActionSync/Store/PassDetail?processId=PR-997'))
  const dialogTitle = strip(await page.locator('dialog #modal-title').innerText())
  check('4. …titled with the pass id', dialogTitle === 'Pass PR-997', dialogTitle)
  const detail = strip(await page.locator('[data-pass-detail="PR-997"]').innerText())
  check('4. …listing its rows with status and error', /ItemPrice/.test(detail) && /Error/.test(detail) && /88,120,002/.test(detail) && /Violation of PRIMARY KEY/.test(detail), detail)
  check('4. …every row, even where a line number repeats', (await rowCount(page, '[data-pass-detail="PR-997"] .ag-row', 3)) === 3)
  await page.screenshot({ path: `${SHOTS}/pass-detail.png`, fullPage: true })
  await page.locator('[data-pass-detail-close]').click()
  check('4. Close shuts the detail', (await page.locator('dialog[open]').count()) === 0)

  // 5: scripts and location.
  await page.locator('[data-tab="scripts"]').click()
  await page.locator('[data-tab-grid="scripts"] .ag-row').first().waitFor()
  const scripts = strip(await page.locator('[data-tab-panel="scripts"]').innerText())
  check('5. Scripts shows each script id and state', /SCR-2026-0412/.test(scripts) && /Executed/.test(scripts) && /SCR-2026-0419/.test(scripts) && /Failed/.test(scripts) && /Invalid column name/.test(scripts), scripts)
  check('5. …read only: no SQL column, no control', !/\bSQL text\b|\bSELECT\b|\bINSERT\b/.test(scripts) && (await page.locator('[data-tab-panel="scripts"] button, [data-tab-panel="scripts"] textarea').count()) === 0, scripts)
  await page.locator('[data-tab="location"]').click()
  await page.locator('[data-location]').waitFor()
  const loc = strip(await page.locator('[data-location]').innerText())
  check('5. Location shows the location fields', /IP address 10\.20\.1\.11/.test(loc) && /Instance SQLEXPRESS/.test(loc) && /Database POS/.test(loc) && /Group G01/.test(loc) && /Father BackOffice/.test(loc) && /POS sync sweep Enabled/.test(loc), loc)
  check('5. …and no credentials, only a note that they stay on the server', (await page.locator('[data-location] input').count()) === 0 && /Credentials Never shown in the browser/.test(loc) && !/User ?ID|Password/i.test(loc), loc)

  // 6: placeholders, ?tab= and reload.
  await page.locator('[data-tab="commands"]').click()
  await page.locator('[data-tab-placeholder="commands"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('6. Commands is a placeholder', (await page.locator('[data-tab-placeholder="commands"]').count()) === 1)
  await page.locator('[data-tab="audit"]').click()
  await page.locator('[data-tab-placeholder="audit"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('6. Audit is a placeholder', (await page.locator('[data-tab-placeholder="audit"]').count()) === 1)
  await page.locator('[data-tab="scripts"]').click()
  check('6. the open tab is ?tab=', new URL(page.url()).searchParams.get('tab') === 'scripts', page.url())
  await page.reload()
  await page.locator('[data-tab-grid="scripts"]').waitFor({ timeout: 20000 })
  check('6. a reload reopens the same tab', (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'scripts')
  check('no page errors (worker store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6b: a failed header refresh keeps the tabs ─────────────────────────────────────────────────
{
  const { context, page, errors } = await open({ failStoreAfter: 1, failHoursAfter: 1 })
  await page.goto(`${BASE}/admin/sync/store/P001?tab=passes`)
  await page.locator('[data-tab-grid="passes"] .ag-row').first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'Next' }).click()
  await page.locator('.ag-row[row-id="PR-950"]').waitFor()
  // The 30 s refresh fails, and so does its one retry.
  await page.clock.runFor(31_000)
  await page.clock.runFor(3_000)
  await page.getByText('The store read failed.').waitFor({ timeout: 10000 })
  check('6b. a failed refresh drops the stale health', (await page.locator('[data-store-health]').count()) === 0)
  await page.getByText('The hours read failed.').waitFor({ timeout: 10000 })
  check('6b. …keeps the last good strip under its error', (await page.locator('[data-hour-cell]').count()) === 24)
  check('6b. …but keeps the tab the reader is on, at its page', (await page.locator('.ag-row[row-id="PR-950"]').count()) === 1 && (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'passes')
  check('no page errors (failed refresh)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: a WPF store ─────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P002?tab=location`)
  await page.locator('[data-store-header]').waitFor({ timeout: 20000 })
  check('7. the WPF note is shown', /still synced by WPF/.test(strip(await page.locator('[data-wpf-note]').innerText())))
  check('7. no health summary and no strip', (await page.locator('[data-store-health]').count()) === 0 && (await page.locator('[data-hour-strip]').count()) === 0)
  check('7. …and no hours read', !calls.some((c) => c.includes('Store/Hours')))
  check('7. only Counters and Passes', JSON.stringify(await tabList(page)) === '["counters","passes"]', JSON.stringify(await tabList(page)))
  check('7. a withheld ?tab= falls back to Counters', (await page.locator('[role="tab"][aria-selected="true"]').getAttribute('data-tab')) === 'counters')
  check('7. …and Location is never read', !calls.some((c) => c.includes('Store/Location')))
  check('7. the host reads WPF', /Host WPF/.test(strip(await page.locator('[data-store-header]').innerText())))
  await page.locator('[data-tab="passes"]').click()
  await page.locator('[data-tab-grid="passes"] .ag-row').first().waitFor()
  check('7. a WPF store\'s passes are listed', calls.some((c) => c.startsWith('ActionSync/Store/Passes?code=P002')))
  await page.screenshot({ path: `${SHOTS}/wpf.png`, fullPage: true })
  check('no page errors (WPF store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: NO_STORE ────────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/admin/sync/store/P999`)
  await page.locator('[data-no-store]').waitFor({ timeout: 20000 })
  const text = strip(await page.locator('[data-no-store]').innerText())
  check('8. NO_STORE shows "No such store"', /No such store/.test(text), text)
  check('8. …with the way back to the fleet', (await page.locator('a[href="/admin/sync"]').filter({ hasText: 'Back to the fleet' }).count()) === 1)
  await page.waitForTimeout(1500)
  // Past the 30 s refresh: a NO_STORE is the answer, so it is not polled either.
  await page.clock.runFor(65_000)
  await page.waitForTimeout(500)
  check('8. …asked once, not retried or polled', calls.filter((c) => c.startsWith('ActionSync/Store?')).length === 1, String(calls.filter((c) => c.startsWith('ActionSync/Store?')).length))
  check('8. …and nothing else of the store is read', !calls.some((c) => /Store\/(Hours|Counters)/.test(c)))
  await page.screenshot({ path: `${SHOTS}/no-store.png`, fullPage: true })
  check('no page errors (NO_STORE)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
