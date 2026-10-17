// Engine switch drive (spec 2737, ticket 517): Admin ▸ Store engine switch, HQ flips a store's engine.
//
// Drives the REAL app in Chromium against STUBS. No HQ contract exists yet (BackOffice 2745 is
// unbuilt), so the stubs serve the PROVISIONAL shapes of `src/core/models/rule-campaign.ts` on the
// REAL envelope { statusCode, success, message, errors: [{ errorCode, internalErrorCode,
// errorMessage }], data }; ticket 520 re-points them:
//   GET  StorePromotionEngine/Stores                → the rows below (D310 has no row: engine null)
//   GET  StorePromotionEngine/InFlight?storeCode=   → R101's warning; M01's door fails; the rest empty
//   POST StorePromotionEngine/Flip                  → the row as HQ now holds it; the first
//                                                     `refuseFlip` flips are refused
//   GET  StorePromotionEngine/History?storeCode=    → the store's flips, newest first
// Never a live SIS.Api.
//
// It asserts:
//   1. the Admin group ends with a Store engine switch leaf, ungated, that opens /admin/engine-switch;
//   2. every store lists with its engine (no row reads Bonus buys), changed by / at (local) and reason;
//   3. the search (code or name) and the engine filter narrow the list, kept in the address;
//   4. a flip to the rule engine goes straight to the reason, says "next shift open", refuses a
//      blank reason without sending, shows HQ's refusal with its code, then flips with the reason
//      trimmed; the row reads Rule engine and the store's history opens on the new line;
//   5. a flip back first shows HQ's in-flight list (live campaigns in EN + AR, open call-center
//      sessions, store-scope budgets) as a warning that never blocks, then the reason, and flips;
//   6. when the in-flight check fails, the flip back still proceeds;
//   7. a row opens the store's history: who, when (local), from → to, reason; it closes;
//   8. a reader the server refuses sees HQ's refusal on the page;
//   9. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/engine-switch-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.campaigns-shots'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/campaigns-drive.mjs).
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

const FLIP_REFUSED = 'The store is mid-shift-close; try again in a minute.'
const DENIED = 'You do not hold the permission to flip a store\u2019s engine.'

const ROWS = () => [
  { storeCode: 'R101', storeName: 'Riyadh, Olaya', engine: 'Rule', changedBy: 'Reem (HQ)', changedAt: '2026-10-01T07:30:00', reason: 'Pilot wave 1' },
  { storeCode: 'J204', storeName: 'Jeddah, Tahlia', engine: 'Rule', changedBy: 'Reem (HQ)', changedAt: '2026-10-05T07:00:00', reason: 'Pilot wave 2' },
  { storeCode: 'D310', storeName: 'Dammam, Corniche', engine: null, changedBy: null, changedAt: null, reason: null },
  { storeCode: 'M01', storeName: 'Manama, Seef', engine: 'Rule', changedBy: 'Ali (Bahrain)', changedAt: '2026-10-06T06:45:00', reason: 'Bahrain pilot' },
]
const HISTORY = () => ({
  R101: [{ at: '2026-10-01T07:30:00', by: 'Reem (HQ)', from: null, to: 'Rule', reason: 'Pilot wave 1' }],
  J204: [
    { at: '2026-10-05T07:00:00', by: 'Reem (HQ)', from: 'BonusBuy', to: 'Rule', reason: 'Pilot wave 2' },
    { at: '2026-10-03T09:15:00', by: 'Omar (HQ)', from: 'Rule', to: 'BonusBuy', reason: 'Till rollback' },
    { at: '2026-10-02T08:00:00', by: 'Omar (HQ)', from: null, to: 'Rule', reason: 'First try' },
  ],
  D310: [],
  M01: [{ at: '2026-10-06T06:45:00', by: 'Ali (Bahrain)', from: null, to: 'Rule', reason: 'Bahrain pilot' }],
})
const IN_FLIGHT_R101 = {
  liveCampaigns: [
    { code: 'WKND20', name: { en: 'Weekend coupon: 20% off', ar: 'قسيمة نهاية الأسبوع: خصم 20%' } },
    { code: 'BASE-EARN', name: { en: 'Base earn', ar: 'كسب النقاط الأساسي' } },
  ],
  openSessions: [{ saleId: 'CC-R101-0091', created: '2026-10-16T17:55:00' }],
  budgets: [{ campaignCode: 'WKND20', budget: 'Discount money per store' }],
}

const browser = await chromium.launch()

async function open({ refuseFlip = 0, denied = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const flips = []
  const rows = ROWS()
  const history = HISTORY()
  let refusals = refuseFlip
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.clock.setFixedTime(new Date('2026-10-16T18:30:00+03:00'))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = decodeURIComponent(url.pathname.split('/api/')[1])
    calls.push(`${req.method()} ${p}${url.search}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    // PROVISIONAL doors (ticket 520 re-points them).
    if (p.startsWith('StorePromotionEngine/') && denied) {
      return route.fulfill(envelope(null, { status: 403, success: false, message: DENIED, errorCode: 'ENGINE_SWITCH_FORBIDDEN' }))
    }
    if (p === 'StorePromotionEngine/Stores') return route.fulfill(envelope(rows))
    if (p === 'StorePromotionEngine/InFlight') {
      const store = url.searchParams.get('storeCode')
      if (store === 'M01') return route.fulfill(envelope(null, { status: 500, success: false, message: 'In-flight check down.' }))
      return route.fulfill(envelope(store === 'R101' ? IN_FLIGHT_R101 : { liveCampaigns: [], openSessions: [], budgets: [] }))
    }
    if (p === 'StorePromotionEngine/History') return route.fulfill(envelope(history[url.searchParams.get('storeCode')] ?? []))
    if (p === 'StorePromotionEngine/Flip' && req.method() === 'POST') {
      const body = req.postDataJSON()
      flips.push(body)
      if (refusals > 0) {
        refusals--
        return route.fulfill(envelope(null, { status: 409, success: false, message: FLIP_REFUSED, errorCode: 'ENGINE_SWITCH_BUSY' }))
      }
      const r = rows.find((x) => x.storeCode === body.storeCode)
      history[r.storeCode].unshift({ at: '2026-10-16T18:30:00', by: 'msartawi', from: r.engine, to: body.engine, reason: body.reason })
      Object.assign(r, { engine: body.engine, changedBy: 'msartawi', changedAt: '2026-10-16T18:30:00', reason: body.reason })
      return route.fulfill(envelope(r))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, flips }
}

// Isolates (FSI…PDI) are invisible; the checks read what is seen.
const text = async (loc) => (await loc.innerText()).replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const field = (page, name) => page.locator(`[data-engine-field="${name}"]`)
const gridRow = (page, code) => page.locator(`[data-engine-grid] .ag-row[row-id="${code}"]`)
const cell = (page, code, col) => text(gridRow(page, code).locator(`.ag-cell[col-id="${col}"]`))
const gridIds = (page) => page.$$eval('[data-engine-grid] .ag-row[row-id]', (rows) => rows.map((r) => r.getAttribute('row-id')).sort())
const waitRows = (page, ids) =>
  page.waitForFunction(
    (want) => JSON.stringify([...document.querySelectorAll('[data-engine-grid] .ag-row[row-id]')].map((r) => r.getAttribute('row-id')).sort()) === want,
    JSON.stringify([...ids].sort()),
    { timeout: 10000 },
  )
const ALL = ['D310', 'J204', 'M01', 'R101']
const dialog = (page) => page.locator('[data-flip-dialog]')
const flipCalls = (calls) => calls.filter((c) => c.startsWith('POST StorePromotionEngine/Flip'))

{
  const { context, page, errors, calls, flips } = await open({ refuseFlip: 1 })
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/admin/engine-switch"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Store engine switch leaf is in the rail', (await leaf.isVisible()) && /Store engine switch/.test(await text(leaf)))
  check('1: …last in the Admin group', await leaf.evaluate((a) => {
    const group = a.closest('ul')
    const links = [...(group?.querySelectorAll('a') ?? [])]
    return links.at(-1) === a && links.some((l) => l.getAttribute('href')?.startsWith('/admin/'))
  }))
  await leaf.click()
  await page.waitForURL(`${BASE}/admin/engine-switch`)
  await page.locator('[data-engine-switch]').waitFor({ timeout: 15000 })
  check('1: it opens /admin/engine-switch and lights itself', (await leaf.getAttribute('aria-current')) === 'page')
  check('1: ungated — no probe call for the leaf', !calls.some((c) => /StorePromotionEngine\/Access|EngineSwitch\/Access/.test(c)))

  // ── 2 ──
  await waitRows(page, ALL)
  check('2: every store lists', JSON.stringify(await gridIds(page)) === JSON.stringify(ALL))
  check('2: a store with no row reads Bonus buys', (await cell(page, 'D310', 'engine')) === 'Bonus buys' && (await cell(page, 'D310', 'changedBy')) === '—')
  check('2: a flipped store reads Rule engine, who, when (local) and why',
    (await cell(page, 'R101', 'engine')) === 'Rule engine' && (await cell(page, 'R101', 'changedBy')) === 'Reem (HQ)' &&
    (await cell(page, 'R101', 'changedAt')) === '2026-10-01 07:30' && (await cell(page, 'R101', 'reason')) === 'Pilot wave 1')
  check('2: the store reads code · name', (await cell(page, 'R101', 'store')) === 'R101 · Riyadh, Olaya', await cell(page, 'R101', 'store'))
  check('2: the count', /4 stores/.test(await text(page.locator('[data-status-count]'))))
  check('2: each row offers the flip to the other engine',
    /Flip to the rule engine/.test(await text(page.locator('[data-flip-open="D310"]'))) && /Flip back to bonus buys/.test(await text(page.locator('[data-flip-open="R101"]'))))

  // ── 3 ──
  await field(page, 'search').fill('olaya')
  await waitRows(page, ['R101'])
  check('3: the search finds a store by name', JSON.stringify(await gridIds(page)) === '["R101"]')
  await field(page, 'search').fill('m01')
  await waitRows(page, ['M01'])
  check('3: …or by code, any case, kept in the address', new URL(page.url()).searchParams.get('search') === 'm01')
  await field(page, 'search').fill('')
  await field(page, 'engine').selectOption('BonusBuy')
  await waitRows(page, ['D310'])
  check('3: the engine filter reads a missing row as Bonus buys', JSON.stringify(await gridIds(page)) === '["D310"]' && new URL(page.url()).searchParams.get('engine') === 'BonusBuy')
  await field(page, 'engine').selectOption('Rule')
  await waitRows(page, ['J204', 'M01', 'R101'])
  check('3: …and Rule engine lists the flipped', JSON.stringify(await gridIds(page)) === '["J204","M01","R101"]' && new URL(page.url()).searchParams.get('engine') === 'Rule')
  await field(page, 'engine').selectOption('')
  await waitRows(page, ALL)
  await page.screenshot({ path: `${SHOTS}/517-list.png`, fullPage: true })

  // ── 4 ── flip D310 to the rule engine
  await page.locator('[data-flip-open="D310"]').click()
  await dialog(page).waitFor({ timeout: 5000 })
  check('4: a flip to the rule engine goes straight to the reason', (await dialog(page).getAttribute('data-flip-step')) === 'reason' && (await page.locator('[data-in-flight]').count()) === 0)
  check('4: the dialog names the store and the engine', /Flip D310 · Dammam, Corniche to the rule engine/.test(await text(page.locator('dialog'))))
  check('4: it says the flip takes effect at the next shift open', /next shift open/.test(await text(page.locator('[data-flip-shift-open]'))))
  await page.locator('[data-flip-confirm]').click()
  await page.locator('[data-flip-reason-required]').waitFor({ timeout: 3000 })
  check('4: a blank reason is refused, and nothing is sent', flipCalls(calls).length === 0 && (await page.locator('[data-flip-reason]').getAttribute('aria-invalid')) === 'true')
  await page.locator('[data-flip-reason]').fill('   ')
  await page.locator('[data-flip-confirm]').click()
  await page.waitForTimeout(200)
  check('4: …and so is a reason of spaces', flipCalls(calls).length === 0)
  await page.locator('[data-flip-reason]').fill('  Pilot wave 3: Eastern province  ')
  await page.locator('[data-flip-confirm]').click()
  await page.locator('[data-flip-refusal]').waitFor({ timeout: 5000 })
  check('4: HQ\u2019s refusal shows verbatim with its code',
    (await text(page.locator('[data-flip-refusal]'))).includes(FLIP_REFUSED) && (await page.locator('[data-refusal-code="ENGINE_SWITCH_BUSY"]').count()) === 1)
  await page.locator('[data-flip-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 })
  check('4: the flip sends the store, the engine and the reason trimmed',
    JSON.stringify(flips.at(-1)) === JSON.stringify({ storeCode: 'D310', from: 'BonusBuy', engine: 'Rule', reason: 'Pilot wave 3: Eastern province' }), JSON.stringify(flips.at(-1)))
  await page.waitForFunction(() => document.querySelector('[data-engine-grid] .ag-row[row-id="D310"] [data-engine]')?.getAttribute('data-engine') === 'Rule', null, { timeout: 5000 })
  check('4: the row reads Rule engine, by whom and when', (await cell(page, 'D310', 'engine')) === 'Rule engine' && (await cell(page, 'D310', 'changedBy')) === 'msartawi' && (await cell(page, 'D310', 'changedAt')) === '2026-10-16 18:30')
  check('4: a toast says it flips at the next shift open', /D310 · Dammam, Corniche flips to the rule engine/.test(await text(page.locator('[data-sonner-toaster]'))))
  await page.locator('[data-history="D310"] [data-history-entry="0"]').waitFor({ timeout: 5000 })
  check('4: the store\u2019s history opens on the new line',
    /From Bonus buys to Rule engine/.test(await text(page.locator('[data-history="D310"] [data-history-entry="0"]'))) &&
    /Pilot wave 3: Eastern province/.test(await text(page.locator('[data-history="D310"] [data-history-entry="0"]'))) &&
    new URL(page.url()).searchParams.get('store') === 'D310')
  await page.screenshot({ path: `${SHOTS}/517-flipped.png`, fullPage: true })

  // ── 5 ── flip R101 back to bonus buys
  await page.locator('[data-flip-open="R101"]').click()
  await dialog(page).waitFor({ timeout: 5000 })
  check('5: a flip back first shows the in-flight step', (await dialog(page).getAttribute('data-flip-step')) === 'inFlight')
  await page.locator('[data-in-flight]').waitFor({ timeout: 5000 })
  check('5: HQ\u2019s warning counts what is in flight and says it never blocks', /4 things are in flight/.test(await text(page.locator('[data-in-flight]'))) && /you can still flip back/.test(await text(page.locator('[data-in-flight]'))))
  const count = (k) => page.locator(`[data-in-flight-list="${k}"]`).getAttribute('data-in-flight-count')
  check('5: live campaigns, open call-center sessions, store-scope budgets', (await count('liveCampaigns')) === '2' && (await count('openSessions')) === '1' && (await count('budgets')) === '1')
  const wk = page.locator('[data-in-flight-list="liveCampaigns"] [data-in-flight-item="WKND20"]')
  check('5: a live campaign reads its name in EN and AR', (await text(wk.locator('[data-says-en]'))) === 'Weekend coupon: 20% off' && (await text(wk.locator('[data-says-ar]'))) === 'قسيمة نهاية الأسبوع: خصم 20%' && (await wk.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
  check('5: an open session reads its sale id and local opening', /CC-R101-0091 opened 2026-10-16 17:55/.test(await text(page.locator('[data-in-flight-item="CC-R101-0091"]'))))
  check('5: Continue is offered, never disabled', await page.locator('[data-flip-continue]').isEnabled())
  await page.screenshot({ path: `${SHOTS}/517-in-flight.png`, fullPage: true })
  await page.locator('[data-flip-continue]').click()
  check('5: …then the reason', (await dialog(page).getAttribute('data-flip-step')) === 'reason' && /next shift open/.test(await text(page.locator('[data-flip-shift-open]'))))
  await page.locator('[data-flip-back-step]').click()
  check('5: Back returns to the warning', (await dialog(page).getAttribute('data-flip-step')) === 'inFlight')
  await page.locator('[data-flip-continue]').click()
  await page.locator('[data-flip-reason]').fill('Till fault at R101')
  await page.locator('[data-flip-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 })
  check('5: the flip back proceeds with its reason', JSON.stringify(flips.at(-1)) === JSON.stringify({ storeCode: 'R101', from: 'Rule', engine: 'BonusBuy', reason: 'Till fault at R101' }), JSON.stringify(flips.at(-1)))
  await page.waitForFunction(() => document.querySelector('[data-engine-grid] .ag-row[row-id="R101"] [data-engine]')?.getAttribute('data-engine') === 'BonusBuy', null, { timeout: 5000 })
  check('5: the row reads Bonus buys', (await cell(page, 'R101', 'engine')) === 'Bonus buys')
  await page.locator('[data-history="R101"] [data-history-entry="1"]').waitFor({ timeout: 5000 })
  check('5: its history has the flip back on top',
    /From Rule engine to Bonus buys/.test(await text(page.locator('[data-history="R101"] [data-history-entry="0"]'))) &&
    /From Bonus buys to Rule engine/.test(await text(page.locator('[data-history="R101"] [data-history-entry="1"]'))))

  // ── 6 ── M01's in-flight check fails: the flip back still proceeds
  await page.locator('[data-flip-open="M01"]').click()
  await page.locator('[data-in-flight-failed]').waitFor({ timeout: 10000 })
  check('6: a failed in-flight check says so', /Could not read what is in flight/.test(await text(page.locator('[data-in-flight-failed]'))), await text(page.locator('[data-in-flight-failed]')))
  check('6: …and still offers Continue', await page.locator('[data-flip-continue]').isEnabled())
  await page.locator('[data-flip-continue]').click()
  await page.locator('[data-flip-reason]').fill('Bahrain pilot paused')
  await page.locator('[data-flip-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 })
  check('6: the flip back went through', flips.at(-1)?.storeCode === 'M01' && flips.at(-1)?.engine === 'BonusBuy')

  // ── 7 ── J204's history from its row
  await gridRow(page, 'J204').locator('.ag-cell[col-id="reason"]').click()
  await page.locator('[data-history="J204"] [data-history-entry="2"]').waitFor({ timeout: 5000 })
  const e0 = await text(page.locator('[data-history="J204"] [data-history-entry="0"]'))
  const e2 = await text(page.locator('[data-history="J204"] [data-history-entry="2"]'))
  check('7: a row opens its history: who, when (local), from → to, reason',
    /2026-10-05 07:00 · Reem \(HQ\)/.test(e0) && /From Bonus buys to Rule engine/.test(e0) && /Pilot wave 2/.test(e0), e0)
  check('7: a first flip reads from Bonus buys', /From Bonus buys to Rule engine/.test(e2) && /First try/.test(e2), e2)
  check('7: the history is asked by store', calls.some((c) => c === 'GET StorePromotionEngine/History?storeCode=J204'))
  await page.screenshot({ path: `${SHOTS}/517-history.png`, fullPage: true })
  await page.locator('[data-history-close]').click()
  await page.locator('[data-history]').waitFor({ state: 'detached', timeout: 3000 })
  check('7: it closes, and leaves the address', !new URL(page.url()).searchParams.has('store'))
  await gridRow(page, 'R101').locator('.ag-cell[col-id="store"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-history="R101"]').waitFor({ timeout: 3000 })
  check('7: Enter on a row opens its history too', new URL(page.url()).searchParams.get('store') === 'R101')

  check('9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page, errors } = await open({ denied: true })
  await page.goto(`${BASE}/admin/engine-switch`)
  await page.locator('[data-engine-switch] [role="alert"]').waitFor({ timeout: 15000 })
  check('8: a refused reader sees HQ\u2019s refusal', (await text(page.locator('[data-engine-switch] [role="alert"]'))).includes(DENIED))
  check('9: no page errors (refused)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
