// Sync console onboarding drive (ticket 449, spec 444) — drives the REAL New store wizard, Sync pending
// list, store page Location tab and Edit store in Chromium against STUBBED `ActionSync/*` and `Store/*`
// envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 2541/2542 are unbuilt, and ticket 450 is
// the live walk.
//
// It verifies:
//   1. one store through both steps (canOnboard): the code checked live (lowercase refused, never
//      re-cased), the template location P001 preselected and C011 one click away, Preview before Create,
//      a changed input invalidating the preview, Create posting the SAME inputs, a result per row;
//   2. a paste of 5 with one bad row: TSV with a header, the lowercase code marked before any call, then
//      fixed, previewed and created — created, skipped and refused rows;
//   3. without canOnboard the wizard starts at step 2 (ActionSync/Locations), and a failed connection
//      test reads as a WARNING, polled every 2 s;
//   4. Sync pending: Finish opens step 2 for that code; Dismiss of a selection, with a reason;
//   5. Edit location on the Location tab, and Edit store (canOnboard only, never on a WPF store);
//   6. view only: no wizard, no New store link, no Finish / Dismiss / Edit.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-onboard-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-onboard-shots'
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

const loop = () => ({ lastPassAt: '2026-10-09T12:03:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null })
const noLoop = () => ({ lastPassAt: null, lastPassOutcome: 'None', lastErrorAt: null, lastError: null })
const workerStore = (code) => ({
  code,
  description: `Store ${code}`,
  host: 'Worker',
  isPaused: false,
  controlPending: false,
  states: ['onWorker'],
  lastConnectOkAt: '2026-10-09T12:03:10',
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: loop(),
  pull: loop(),
  pendingActions: 12,
  oldestPendingActionAt: '2026-10-09T11:50:00',
  lastTrxPulledAt: '2026-10-09T12:02:00',
  healthUpdatedAt: '2026-10-09T12:03:30',
  controlVersion: 4,
  appliedVersion: 4,
  appliedAt: '2026-10-09T09:00:00',
})
const wpfStore = (code) => ({
  ...workerStore(code),
  host: 'Wpf',
  states: ['onWpf'],
  lastConnectOkAt: null,
  push: noLoop(),
  pull: noLoop(),
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: null,
  healthUpdatedAt: null,
  controlVersion: 0,
  appliedVersion: 0,
  appliedAt: null,
})

const LOCATION = (code) => ({ code, description: `Store ${code}`, ip: '10.20.1.11', instance: 'SQLEXPRESS', dbName: 'POS', groupId: 'G01', father: 'BackOffice', isPosSyncEnabled: true })
const SUMMARY = { asOf: '2026-10-09T12:04:31', total: 2, counts: { all: 2, onWorker: 1, onWpf: 1, paused: 0, offline: 0, behind: 0, erroring: 0, controlPending: 0 } }
const TEMPLATES = new Set(['P001', 'C011'])

// Store masters that exist, and the codes that already have a sync location.
const seedMasters = () => new Set(['P001', 'P002', 'P134', 'P135', 'P990', 'P991', 'WH01'])
const seedLocations = () => new Set(['P001', 'P002', 'P134'])
const seedPending = () => [
  { code: 'P990', description: 'Madinah Quba', city: 'Madinah', createdAt: '2026-10-07T10:12:00' },
  { code: 'P991', description: 'Taif Shihar', city: 'Taif', createdAt: '2026-10-08T09:00:00' },
  { code: 'WH01', description: 'Central warehouse', city: 'Riyadh', createdAt: '2019-03-01T08:00:00' },
]
// How each new location's connection test moves, one step per read. The last step repeats.
const TEST_SCRIPTS = {
  P990: [['Running', null], ['Failed', 'connect timeout (5 s): 10.30.90.11,1433']],
  P991: [['Done', 'OK, 231 ms']],
}

const browser = await chromium.launch()

async function open({ canOperate = true, canOnboard = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } })
  const page = await context.newPage()
  await page.clock.install({ time: new Date('2026-10-09T12:04:00') })
  const errors = []
  const calls = []
  const posts = []
  const masters = seedMasters()
  const locations = seedLocations()
  let pending = seedPending()
  const commands = []
  const steps = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    const q = url.searchParams
    const method = route.request().method()
    calls.push(`${method} ${p}${url.search}`)
    const body = method === 'POST' ? route.request().postDataJSON() : null
    if (body) posts.push({ door: p, body })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'ActionSync/Access') return route.fulfill(envelope({ screenAllowed: true, canOperate, canOnboard }))
    if (p === 'ActionSync/Workers') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Fleet/Summary') return route.fulfill(envelope(SUMMARY))
    if (p === 'ActionSync/Store') {
      const code = q.get('code')
      return route.fulfill(code === 'P002' ? envelope(wpfStore(code)) : envelope(workerStore(code)))
    }
    if (p === 'ActionSync/Store/Hours') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Store/Counters') return route.fulfill(envelope({ items: [] }))
    if (p === 'ActionSync/Store/Location') return route.fulfill(envelope(LOCATION(q.get('code'))))
    if (p === 'ActionSync/Audit') return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    if (p === 'ActionSync/PendingStores') {
      const pg = Number(q.get('page'))
      const size = Number(q.get('pageSize'))
      return route.fulfill(envelope({ items: pending.slice((pg - 1) * size, pg * size), total: pending.length, page: pg, pageSize: size }))
    }
    if (p === 'ActionSync/PendingStores/Dismiss') {
      pending = pending.filter((r) => !body.codes.includes(r.code))
      return route.fulfill(envelope({ auditId: 'A-77' }))
    }
    if (p === 'ActionSync/Commands' && method === 'GET') {
      // The wizard's read: the newest connection tests. Each read moves every followed test one step.
      for (const c of commands) {
        const script = TEST_SCRIPTS[c.code]
        const i = Math.min(steps[c.id] ?? 0, script.length - 1)
        steps[c.id] = i + 1
        ;[c.status, c.result] = script[i]
      }
      const items = commands.filter((c) => !q.get('kind') || c.kind === q.get('kind'))
      return route.fulfill(envelope({ items, total: items.length, page: 1, pageSize: Number(q.get('pageSize')) }))
    }
    if (p === 'ActionSync/Locations') {
      const res = body.rows.map((row, i) => {
        const dup = body.rows.findIndex((r) => r.code === row.code) !== i
        const error = !/^[A-Z0-9]{4}$/.test(row.code)
          ? 'BAD_CODE'
          : !TEMPLATES.has(body.templateCode)
            ? 'NO_TEMPLATE'
            : dup
              ? 'DUPLICATE_IN_BATCH'
              : !masters.has(row.code)
                ? 'NO_STORE'
                : locations.has(row.code)
                  ? 'LOCATION_EXISTS'
                  : null
        let testId = null
        if (!error && !body.preview) {
          locations.add(row.code)
          pending = pending.filter((r) => r.code !== row.code)
          testId = `T-${row.code}`
          commands.unshift({ id: testId, batchId: 'B-900', code: row.code, kind: 'ConnectionTest', objectId: null, fromDate: null, status: 'Pending', result: null, requestedBy: 'msartawi', requestedAt: '2026-10-09T12:05:00', finishedAt: null })
        }
        return { code: row.code, ok: !error, error, host: error ? null : 'Worker', connectionTestCommandId: testId }
      })
      return route.fulfill(envelope({ results: res }))
    }
    if (p === 'ActionSync/Locations/Edit') return route.fulfill(envelope({ auditId: 'A-80' }))
    if (p === 'Store/Onboard/Preview' || p === 'Store/Onboard') {
      const real = p === 'Store/Onboard'
      const res = body.rows.map((row) => {
        const exists = masters.has(row.code)
        const base = { code: row.code, storeCreated: false, storeSkipped: false, locationCreated: false, ok: false, error: null, warning: null }
        if (!/^[A-Z0-9]{4}$/.test(row.code)) return { ...base, error: 'BAD_CODE' }
        if (!TEMPLATES.has(body.locationTemplateCode)) return { ...base, error: 'NO_TEMPLATE' }
        if (exists && locations.has(row.code)) return { ...base, storeSkipped: true, error: 'LOCATION_EXISTS' }
        if (real) {
          masters.add(row.code)
          locations.add(row.code)
        }
        // P988's box is not installed yet: the test fails, and the row is still created — with a warning.
        const warning = real && row.code === 'P988' ? 'connect timeout (5 s): 10.23.238.11,1433' : null
        return { ...base, storeCreated: !exists, storeSkipped: exists, locationCreated: true, ok: true, warning }
      })
      return route.fulfill(envelope({ results: res }))
    }
    if (p === 'Store/Edit') return route.fulfill(envelope({ auditId: 'A-81' }))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, posts }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const waitFor = async (page, fn, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true
    await page.waitForTimeout(100)
  }
  return false
}
const toastText = async (page, re) => {
  const t = page.locator('[data-sonner-toast]').filter({ hasText: re })
  await t.first().waitFor({ timeout: 5000 }).catch(() => {})
  return (await t.count()) > 0 ? strip(await t.first().innerText()) : ''
}
const field = (page, name) => page.locator(`[data-field="${name}"]`)
const codeCheck = (page) => page.locator('[data-code-check]').getAttribute('data-code-check')
const codeText = async (page) => strip(await page.locator('[data-code-check]').innerText())
const doors = (posts, door) => posts.filter((x) => x.door === door)
const cellText = async (page, grid, code, col) =>
  strip(await page.locator(`[data-tab-grid="${grid}"] .ag-row`).filter({ has: page.locator(`[col-id="code"]`, { hasText: new RegExp(`^${code}$`) }) }).locator(`[col-id="${col}"]`).innerText().catch(() => ''))
const tick = (page, code) => page.locator(`.ag-row[row-id="${code}"] .ag-selection-checkbox input`).click()

// ── 1: one store through both steps ─────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open()
  await page.goto(`${BASE}/admin/sync/new-store`)
  await page.locator('[data-wizard]').waitFor({ timeout: 20000 })
  check('1. with canOnboard the wizard starts at step 1, the store master', (await page.locator('[data-wizard]').getAttribute('data-wizard')) === 'master' && (await page.locator('[data-wizard-step]').getAttribute('data-wizard-step')) === '1')
  check('1. the console bar offers New store and Sync pending', (await page.locator('[data-console-page="newStore"]').count()) === 1 && (await page.locator('[data-console-page="pending"]').count()) === 1)

  await field(page, 'code').fill('p987')
  check('1. a lowercase code is refused as typed, not upper-cased', (await codeCheck(page)) === 'lowercase' && (await field(page, 'code').inputValue()) === 'p987' && (await codeText(page)) === 'Lowercase is refused. Type the code in capitals.', await codeText(page))
  check('1. …and Next stays disabled', await page.locator('[data-wizard-next]').isDisabled())
  await field(page, 'code').fill('P98')
  check('1. three characters fail the format', (await codeCheck(page)) === 'format')
  await field(page, 'code').fill('P98A5')
  check('1. five characters fail the format', (await codeCheck(page)) === 'format')
  await field(page, 'code').fill('P987')
  check('1. P987 passes', (await codeCheck(page)) === 'ok' && !(await page.locator('[data-wizard-next]').isDisabled()))
  await field(page, 'description').fill('Riyadh Yasmin 2')
  await field(page, 'city').fill('Riyadh')
  await field(page, 'area').fill('Yasmin')
  await field(page, 'address').fill('Anas Ibn Malik Rd')
  await field(page, 'phone').fill('0112345678')
  await field(page, 'cr').fill('1010998877')
  check('1. the template store is preselected P001', (await field(page, 'template-store').inputValue()) === 'P001')
  await page.screenshot({ path: `${SHOTS}/step1.png`, fullPage: true })
  await page.locator('[data-wizard-next]').click()

  check('1. step 2 asks for the IP and the template location', (await page.locator('[data-wizard-step]').getAttribute('data-wizard-step')) === '2' && (await field(page, 'ip').count()) === 1)
  check('1. the template location is preselected P001', (await field(page, 'template-location').inputValue()) === 'P001' && (await page.locator('[data-template-choice="P001"]').getAttribute('aria-pressed')) === 'true')
  await page.locator('[data-template-choice="C011"]').click()
  check('1. C011 is one click away', (await field(page, 'template-location').inputValue()) === 'C011')
  await page.locator('[data-template-choice="P001"]').click()
  check('1. the Counter = 0 assumption sits beside Create', /Counters start at 0/.test(await page.locator('[data-counter-note]').innerText()))
  await field(page, 'ip').fill('10.23.237.11')
  check('1. Preview waits for a reason; Create for a preview', (await page.locator('[data-wizard-preview-button]').isDisabled()) && (await page.locator('[data-wizard-create]').isDisabled()))
  await page.locator('[data-reason-input]').fill('  Opening Nov 1, ticket OPS-4412  ')
  await page.locator('[data-wizard-preview-button]').click()
  await waitFor(page, async () => doors(posts, 'Store/Onboard/Preview').length === 1)
  const want = {
    templateStore: 'P001',
    rows: [{ code: 'P987', description: 'Riyadh Yasmin 2', city: 'Riyadh', area: 'Yasmin', address: 'Anas Ibn Malik Rd', phone: '0112345678', cr: '1010998877', ip: '10.23.237.11' }],
    reason: 'Opening Nov 1, ticket OPS-4412',
    alsoCreateLocation: true,
    locationTemplateCode: 'P001',
  }
  const pv = doors(posts, 'Store/Onboard/Preview')[0]?.body
  check('1. Preview posts Store/Onboard/Preview with both steps and the trimmed reason', JSON.stringify(pv) === JSON.stringify(want), JSON.stringify(pv))
  await page.locator('[data-wizard-preview="fresh"]').waitFor({ timeout: 5000 })
  const pvSentence = strip(await page.locator('[data-preview-sentence]').innerText())
  check('1. the preview says what would happen', pvSentence === 'Preview. Stores to create: 1. Already existing, step 1 skipped: 0. Refused: 0. Warnings: 0.', pvSentence)
  check('1. …row by row ("Will create", "Will add")', (await cellText(page, 'onboard-preview', 'P987', 'store')) === 'Will create' && (await cellText(page, 'onboard-preview', 'P987', 'location')) === 'Will add, on worker')
  check('1. Create is now offered', !(await page.locator('[data-wizard-create]').isDisabled()))
  await page.screenshot({ path: `${SHOTS}/preview.png`, fullPage: true })

  await field(page, 'ip').fill('10.23.237.12')
  check('1. a changed IP invalidates the preview', (await page.locator('[data-wizard-preview]').getAttribute('data-wizard-preview')) === 'stale' && (await page.locator('[data-wizard-create]').isDisabled()) && /changed since the preview/.test(await page.locator('[data-preview-hint]').innerText()))
  await field(page, 'ip').fill('10.23.237.11')
  check('1. …and putting it back makes the same preview fresh again', (await page.locator('[data-wizard-preview]').getAttribute('data-wizard-preview')) === 'fresh')
  await page.locator('[data-wizard-create]').click()
  await waitFor(page, async () => doors(posts, 'Store/Onboard').length === 1)
  const created = doors(posts, 'Store/Onboard')[0]?.body
  check('1. Create posts Store/Onboard with the SAME inputs', JSON.stringify(created) === JSON.stringify(want), JSON.stringify(created))
  await page.locator('[data-wizard-result]').waitFor({ timeout: 5000 })
  const toast = await toastText(page, /Stores created/)
  check('1. one toast sentence with the counts', toast === 'Stores created: 1. Already existing, step 1 skipped: 0. Refused: 0. Warnings: 0.', toast)
  check('1. the result row: store created, location added', (await cellText(page, 'onboard-result', 'P987', 'store')) === 'Created' && (await cellText(page, 'onboard-result', 'P987', 'location')) === 'Added, on worker')
  check('1. …and links to the new store\'s page', (await page.locator('[data-result-store="P987"]').getAttribute('href')) === '/admin/sync/store/P987')
  await page.screenshot({ path: `${SHOTS}/result-one.png`, fullPage: true })
  check('no page errors (one store)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 2: a paste of 5 with one bad row ────────────────────────────────────────────────────────
{
  const { context, page, errors, posts, calls } = await open()
  await page.goto(`${BASE}/admin/sync/new-store`)
  await page.locator('[data-wizard]').waitFor({ timeout: 20000 })
  await page.locator('[data-input-mode="paste"]').check()
  const rows = [
    'Code\tDescription\tCity\tArea\tAddress\tPhone\tCR\tIP',
    'P987\tRiyadh Yasmin 2\tRiyadh\tYasmin\tAnas Ibn Malik Rd\t0112345678\t1010998877\t10.23.237.11',
    'P988\tJeddah Obhur\tJeddah\tObhur\tPrince Abdullah Al Faisal\t0122223344\t4030112233\t10.23.238.11',
    '',
    'p989\tKhobar Ulaya\tKhobar\tUlaya\tKing Fahd Rd\t0138887766\t2051334455\t10.23.239.11',
    'P134\tOlaya 2\tRiyadh\tOlaya\tOlaya St\t0114445566\t1010223344\t10.20.134.11',
    'P135\tOlaya 3\tRiyadh\tOlaya\tOlaya St\t0114445567\t1010223345\t10.20.135.11',
  ]
  await page.locator('[data-paste]').fill(rows.join('\n'))
  await page.locator('[data-tab-grid="paste"] .ag-row').first().waitFor({ timeout: 5000 })
  check('2. five rows read, the header skipped and the blank line ignored', (await page.locator('[data-tab-grid="paste"] .ag-row').count()) === 5 && (await page.locator('[data-paste-tally]').getAttribute('data-paste-tally')) === '5 1', await page.locator('[data-paste-tally]').getAttribute('data-paste-tally'))
  const tally = strip(await page.locator('[data-paste-tally]').innerText())
  check('2. the tally says one is marked', tally === '5 rows read, 1 marked. The header row was skipped.', tally)
  check('2. the lowercase row is marked where it was pasted (line 5)', (await page.locator('[data-paste-row="5"]').getAttribute('data-paste-problems')) === 'CODE_LOWERCASE' && strip(await page.locator('[data-paste-row="5"]').innerText()) === 'Lowercase code refused')
  check('2. …its code is shown as pasted, never upper-cased', (await page.locator('[data-tab-grid="paste"] [col-id="code"]').allInnerTexts()).map(strip).includes('p989'))
  check('2. nothing can go on while a row is marked', await page.locator('[data-wizard-next]').isDisabled())
  check('2. …and no call was made for the paste', !calls.some((c) => /^POST /.test(c)))
  await page.screenshot({ path: `${SHOTS}/paste-marked.png`, fullPage: true })

  await page.locator('[data-paste]').fill(rows.join('\n').replace('p989', 'P989'))
  check('2. fixed, every row is ready', await waitFor(page, async () => (await page.locator('[data-paste-tally]').getAttribute('data-paste-tally')) === '5 0'))
  await page.locator('[data-wizard-next]').click()
  check('2. step 2 takes the IPs from the rows', /from the pasted rows \(5 rows\)/.test(strip(await page.locator('[data-wizard-paste-ip]').innerText())))
  await page.locator('[data-reason-input]').fill('Five new stores, OPS-4420')
  await page.locator('[data-wizard-preview-button]').click()
  await page.locator('[data-wizard-preview="fresh"]').waitFor({ timeout: 5000 })
  const pv = doors(posts, 'Store/Onboard/Preview')[0]?.body
  check('2. the preview carries the five rows in order', JSON.stringify(pv?.rows.map((r) => r.code)) === '["P987","P988","P989","P134","P135"]' && pv.rows[2].ip === '10.23.239.11', JSON.stringify(pv?.rows.map((r) => r.code)))
  check('2. the preview marks the existing store as skipping step 1', (await cellText(page, 'onboard-preview', 'P135', 'store')) === 'Exists, skips to step 2')
  await page.locator('[data-wizard-create]').click()
  await page.locator('[data-wizard-result]').waitFor({ timeout: 5000 })
  const sentence = strip(await page.locator('[data-result-sentence]').innerText())
  check('2. one sentence: created, skipped, refused, warnings', sentence === 'Stores created: 3. Already existing, step 1 skipped: 2. Refused: 1. Warnings: 1.', sentence)
  check('2. a refused row shows its words and its code', strip(await page.locator('[data-failure="P134"]').innerText()) === 'Already has a sync location LOCATION_EXISTS' && (await page.locator('[data-failure="P134"]').getAttribute('data-failure-code')) === 'LOCATION_EXISTS')
  const warn = await cellText(page, 'onboard-result', 'P988', 'test')
  check('2. the failed connection test is a WARNING, and the store is still created', warn === 'Could not connect yet connect timeout (5 s): 10.23.238.11,1433' && (await cellText(page, 'onboard-result', 'P988', 'store')) === 'Created', warn)
  check('2. …the warning is not drawn as a refusal', (await page.locator('[data-failure="P988"]').count()) === 0)
  const toast = await toastText(page, /Stores created/)
  check('2. a mixed answer toasts as a warning', /Stores created: 3/.test(toast) && (await page.locator('[data-sonner-toast][data-type="warning"]').count()) === 1, toast)
  await page.screenshot({ path: `${SHOTS}/result-paste.png`, fullPage: true })
  check('no page errors (paste)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 3: without canOnboard — step 2 alone, the test followed to a warning ────────────────────
{
  const { context, page, errors, posts, calls } = await open({ canOnboard: false })
  await page.goto(`${BASE}/admin/sync/new-store`)
  await page.locator('[data-wizard]').waitFor({ timeout: 20000 })
  check('3. without canOnboard the wizard starts at step 2', (await page.locator('[data-wizard]').getAttribute('data-wizard')) === 'location' && (await page.locator('[data-step="master"]').count()) === 0 && (await field(page, 'city').count()) === 0)
  check('3. …with no way to the store master', (await page.locator('[data-wizard-master], [data-wizard-skip]').count()) === 0)
  await page.locator('[data-input-mode="paste"]').check()
  await page.locator('[data-paste]').fill('code,description,ip\nP990,"Madinah Quba, Gate 2",10.30.90.11\nP991,Taif Shihar,10.30.91.11')
  await page.locator('[data-tab-grid="paste"] .ag-row').first().waitFor({ timeout: 5000 })
  check('3. CSV with a quoted comma reads as two rows', (await page.locator('[data-paste-tally]').getAttribute('data-paste-tally')) === '2 0')
  // No door lists templates: a wrong code is the door's NO_TEMPLATE, row by row.
  await field(page, 'template-location').fill('Z999')
  await page.locator('[data-reason-input]').fill('Finishing P990 and P991')
  await page.locator('[data-wizard-preview-button]').click()
  await page.locator('[data-wizard-preview="fresh"]').waitFor({ timeout: 5000 })
  await waitFor(page, async () => (await page.locator('[data-failure-code="NO_TEMPLATE"]').count()) === 2)
  const nt = [await page.locator('[data-failure-code="NO_TEMPLATE"]').count(), strip(await page.locator('[data-failure="P990"]').innerText().catch(() => '')), await page.locator('[data-wizard-create]').isDisabled()]
  check('3. a wrong template code comes back NO_TEMPLATE, listed with its words', nt[0] === 2 && nt[1] === 'No such template NO_TEMPLATE' && nt[2], JSON.stringify(nt))
  await page.locator('[data-template-choice="C011"]').click()
  await page.locator('[data-wizard-preview-button]').click()
  await waitFor(page, async () => doors(posts, 'ActionSync/Locations').length === 2)
  await page.locator('[data-wizard-preview="fresh"]').waitFor({ timeout: 5000 })
  const pv = doors(posts, 'ActionSync/Locations')[1]?.body
  const want = { templateCode: 'C011', rows: [{ code: 'P990', description: 'Madinah Quba, Gate 2', ip: '10.30.90.11' }, { code: 'P991', description: 'Taif Shihar', ip: '10.30.91.11' }], reason: 'Finishing P990 and P991', preview: true }
  check('3. Preview posts ActionSync/Locations with preview: true', JSON.stringify(pv) === JSON.stringify(want), JSON.stringify(pv))
  check('3. …and no store-master door is called', doors(posts, 'Store/Onboard/Preview').length === 0)
  await page.locator('[data-wizard-create]').click()
  await page.locator('[data-wizard-result]').waitFor({ timeout: 5000 })
  const real = doors(posts, 'ActionSync/Locations')[2]?.body
  check('3. Create posts the SAME inputs with preview: false', JSON.stringify(real) === JSON.stringify({ ...want, preview: false }), JSON.stringify(real))
  check('3. both tests start as "Testing…"', (await cellText(page, 'onboard-result', 'P990', 'test')) === 'Testing…' && (await cellText(page, 'onboard-result', 'P991', 'test')) === 'Testing…')
  const reads = () => calls.filter((c) => c === 'GET ActionSync/Commands?kind=ConnectionTest&page=1&pageSize=200').length
  check('3. …and nothing is read before 2 s', reads() === 0)
  await page.clock.runFor(2_000)
  await waitFor(page, async () => reads() === 1)
  check('3. 2 s later: P991 is OK, P990 still testing', (await waitFor(page, async () => (await cellText(page, 'onboard-result', 'P991', 'test')) === 'Connection OK OK, 231 ms')) && (await cellText(page, 'onboard-result', 'P990', 'test')) === 'Testing…', await cellText(page, 'onboard-result', 'P991', 'test'))
  await page.clock.runFor(2_000)
  check('3. P990\'s failed test reads as a warning with the worker\'s words', await waitFor(page, async () => (await cellText(page, 'onboard-result', 'P990', 'test')) === 'Could not connect yet connect timeout (5 s): 10.30.90.11,1433'), await cellText(page, 'onboard-result', 'P990', 'test'))
  check('3. …drawn as a warning badge, not a refusal', (await page.locator('[data-result-test="warning"]').count()) === 1 && (await page.locator('[data-failure]').count()) === 0)
  await page.clock.runFor(10_000)
  await page.waitForTimeout(200)
  check('3. the poll stops once every test has ended', reads() === 2, String(reads()))
  await page.screenshot({ path: `${SHOTS}/result-locations.png`, fullPage: true })
  check('no page errors (locations)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 4: Sync pending — Finish and Dismiss ────────────────────────────────────────────────────
{
  const { context, page, errors, posts, calls } = await open()
  await page.goto(`${BASE}/admin/sync/pending`)
  await page.locator('.ag-row[row-id="P990"]').waitFor({ timeout: 20000 })
  check('4. the pending list reads the door, paged at 50', calls.includes('GET ActionSync/PendingStores?page=1&pageSize=50') && (await page.locator('[data-pending-list] .ag-row').count()) === 3)
  await page.locator('[data-pending-finish="P990"]').click()
  await page.locator('[data-wizard]').waitFor({ timeout: 5000 })
  check('4. Finish opens the wizard at step 2 for that code', page.url().endsWith('/admin/sync/new-store?code=P990') && (await page.locator('[data-wizard]').getAttribute('data-wizard')) === 'location' && (await field(page, 'code').inputValue()) === 'P990')
  check('4. …with its description carried over and the code fixed', (await field(page, 'description').inputValue()) === 'Madinah Quba' && (await field(page, 'code').getAttribute('readonly')) !== null)
  check('4. …and a Finish is the one store it names: no Paste many', (await page.locator('[data-input-mode]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/finish.png`, fullPage: true })

  await page.goto(`${BASE}/admin/sync/pending`)
  await page.locator('.ag-row[row-id="WH01"]').waitFor({ timeout: 20000 })
  check('4. Dismiss waits for a selection', await page.locator('[data-pending-dismiss]').isDisabled())
  await tick(page, 'WH01')
  await tick(page, 'P991')
  check('4. two ticks select two stores', await waitFor(page, async () => (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '2'))
  await page.locator('[data-pending-dismiss]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('4. Dismiss asks for a reason, listing the codes', strip(await dialog.locator('#modal-title').innerText()) === 'Dismiss: 2 stores' && strip(await dialog.locator('[data-reason-codes]').innerText()) === 'WH01, P991' && (await dialog.locator('[data-reason-confirm]').isDisabled()))
  await dialog.locator('[data-reason-input]').fill('Not a real store')
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => doors(posts, 'ActionSync/PendingStores/Dismiss').length === 1)
  const body = doors(posts, 'ActionSync/PendingStores/Dismiss')[0]?.body
  check('4. Dismiss posts the codes and the reason', JSON.stringify(body) === JSON.stringify({ codes: ['WH01', 'P991'], reason: 'Not a real store' }), JSON.stringify(body))
  const toast = await toastText(page, /dismissed/)
  check('4. one toast, and the list refetches without them', toast === '2 stores dismissed from the pending list.' && (await waitFor(page, async () => (await page.locator('[data-pending-list] .ag-row').count()) === 1)), toast)
  check('4. the selection is cleared', (await page.locator('[data-selection-count]').getAttribute('data-selection-count')) === '0')
  await page.screenshot({ path: `${SHOTS}/dismissed.png`, fullPage: true })
  check('no page errors (pending)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: Edit location and Edit store ─────────────────────────────────────────────────────────
{
  const { context, page, errors, posts } = await open()
  await page.goto(`${BASE}/admin/sync/store/P001?tab=location`)
  await page.locator('[data-edit-location-open]').waitFor({ timeout: 20000 })
  await page.locator('[data-edit-location-open]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  const fields = await dialog.locator('[data-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-field')))
  check('5. Edit location offers description, IP, instance and database — no credential', JSON.stringify(fields) === '["description","ip","instance","dbName"]' && (await dialog.locator('input[type="password"]').count()) === 0, JSON.stringify(fields))
  check('5. …opened on the location as read', (await dialog.locator('[data-field="ip"]').inputValue()) === '10.20.1.11')
  await dialog.locator('[data-reason-input]').fill('New store server')
  check('5. Save waits for a change', await dialog.locator('[data-reason-confirm]').isDisabled())
  await dialog.locator('[data-field="ip"]').fill(' 10.20.1.12 ')
  await dialog.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => doors(posts, 'ActionSync/Locations/Edit').length === 1)
  const body = doors(posts, 'ActionSync/Locations/Edit')[0]?.body
  check('5. Edit location posts the four fields, trimmed, and the reason', JSON.stringify(body) === JSON.stringify({ code: 'P001', description: 'Store P001', ip: '10.20.1.12', instance: 'SQLEXPRESS', dbName: 'POS', reason: 'New store server' }), JSON.stringify(body))
  check('5. …with a toast', (await toastText(page, /sync location of store/)) === 'The sync location of store P001 was saved.')

  // Edit store: canOnboard, a worker store.
  await page.locator('[data-edit-store-open]').click()
  const d2 = page.locator('dialog[open]')
  await d2.waitFor()
  check('5. Edit store opens with the description filled', (await d2.locator('[data-field="description"]').inputValue()) === 'Store P001' && (await d2.locator('[data-field="city"]').inputValue()) === '')
  await d2.locator('[data-reason-input]').fill('Address moved')
  check('5. Save waits for every field (no blank overwrite)', await d2.locator('[data-reason-confirm]').isDisabled())
  for (const [k, v] of [['city', 'Riyadh'], ['area', 'Olaya'], ['address', 'Olaya St 12'], ['phone', '0114445566'], ['cr', '1010223344']]) await d2.locator(`[data-field="${k}"]`).fill(v)
  await d2.locator('[data-reason-confirm]').click()
  await waitFor(page, async () => doors(posts, 'Store/Edit').length === 1)
  const sb = doors(posts, 'Store/Edit')[0]?.body
  check('5. Edit store posts the address fields and the reason', JSON.stringify(sb) === JSON.stringify({ code: 'P001', description: 'Store P001', city: 'Riyadh', area: 'Olaya', address: 'Olaya St 12', phone: '0114445566', cr: '1010223344', reason: 'Address moved' }), JSON.stringify(sb))
  await page.screenshot({ path: `${SHOTS}/edit-store.png`, fullPage: true })

  await page.goto(`${BASE}/admin/sync/store/P002`)
  await page.locator('[data-wpf-note]').waitFor({ timeout: 20000 })
  check('5. a WPF store offers no Edit store', (await page.locator('[data-edit-store-open]').count()) === 0)
  check('no page errors (edits)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open({ canOnboard: false })
  await page.goto(`${BASE}/admin/sync/store/P001`)
  await page.locator('[data-store-controls]').waitFor({ timeout: 20000 })
  check('5. without canOnboard, no Edit store', (await page.locator('[data-edit-store-open]').count()) === 0)
  check('no page errors (no canOnboard)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: view only ────────────────────────────────────────────────────────────────────────────
{
  const { context, page, errors, calls } = await open({ canOperate: false, canOnboard: false })
  await page.goto(`${BASE}/admin/sync/new-store`)
  await page.locator('[data-onboard-none]').waitFor({ timeout: 20000 })
  check('6. view only: the wizard has no form', (await page.locator('[data-wizard], input, textarea').count()) === 0)
  check('6. …and the console bar has no New store link', (await page.locator('[data-console-page="newStore"]').count()) === 0 && (await page.locator('[data-console-page="pending"]').count()) === 1)
  await page.goto(`${BASE}/admin/sync/pending`)
  await page.locator('.ag-row[row-id="P990"]').waitFor({ timeout: 20000 })
  check('6. view only: the pending list reads, with no checkbox, Finish or Dismiss', (await page.locator('.ag-selection-checkbox, .ag-header-select-all, [data-pending-finish], [data-pending-bar], [data-pending-dismiss]').count()) === 0)
  await page.goto(`${BASE}/admin/sync/store/P001?tab=location`)
  await page.locator('[data-location]').waitFor({ timeout: 20000 })
  check('6. view only: no Edit location, no Edit store', (await page.locator('[data-edit-location-open], [data-edit-store-open]').count()) === 0)
  check('6. …and nothing was posted', !calls.some((c) => /^POST /.test(c)))
  check('no page errors (view only)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
