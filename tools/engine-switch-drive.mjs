// Engine switch drive (spec 2737, ticket 517, re-pointed in 528): Admin ▸ Store engine switch, HQ
// flips a store's engine.
//
// Drives the REAL app in Chromium against STUBS of the REAL doors (BackOffice 2745, brief § Doors;
// SIS.Api RuleSwitchWebEndpoints / RuleEngineSwitchService), on the rule doors' envelope
// { success, data }, a refusal { success:false, statusCode, message, errors:[{ errorCode, errorMessage }] },
// and a missing grant a BARE 403 with no body:
//   POST Rules/Authoring/Lookups/stores { q }   → open stores by code prefix or name, at most 50, the
//                                                 engine in `detail` (D310 has no row: BonusBuy)
//   POST Rules/Switch/Flip { storeCode, engine, reason }
//                                               → the change; a Rule → BonusBuy flip answers `inFlight`
//                                                 (null when nothing is); the first `refuseFlip` flips
//                                                 are refused RULES_REASON_REQUIRED
//   GET  Rules/Switch/History?storeCode=        → { store, changes } newest first
// Never a live SIS.Api.
//
// It asserts:
//   1. the Admin group ends with a Store engine switch leaf, ungated, that opens /admin/engine-switch;
//   2. HQ's stores list with their engine (no row reads Bonus buys) and the flip to the other one;
//   3. the search goes to HQ as `q` (code or name), the engine filter narrows the answer, both kept
//      in the address; an answer of 50 says HQ answers the first 50;
//   4. a flip to the rule engine says "next shift open", refuses a blank reason without sending,
//      shows HQ's refusal with its code and marks the reason, then flips with { storeCode, engine,
//      reason } trimmed and NO `from`; the dialog closes, the row reads Rule engine, the history opens;
//   5. a flip back says the in-flight list comes after it; HQ's reply carries `inFlight`, and the
//      dialog then shows it — live campaigns in EN + AR, paying sessions (a never-set time reads —),
//      store-scope budgets, the truncation note — as a warning, the flip already made; Done closes;
//   6. a flip back that warned of nothing closes straight away; a flip HQ answers from the engine it
//      moved to (another admin got there first) says the store was already on it;
//   7. a row opens the store's history: the engine now and who set it, each flip's who, when (local),
//      from → to, reason, and what it left in flight; a store never set says so; it closes;
//   8. a bare 403 names the missing grant: on the list (RuleAuthoring), on the flip and the history
//      (RuleEngineSwitch) — never "HTTP 403";
//   9. no page errors.
// Dropped from 517's drive: the in-flight READ before the flip and its failure path (step 6 then) —
// 2745 has no such door; the warning is on the flip's reply (ticket 528). The changed by / at /
// reason columns: the stores lookup answers none of them; the history pane shows who set it now.
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

// The rule doors' envelopes (SIS.Api `RuleEndpointResults`).
const ok = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
const refused = (status, errorCode, message) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ success: false, statusCode: status, message, errors: [{ errorCode, errorMessage: message }] }),
})
/** A missing grant: SIS.Api's grant filter answers 403 with no body. */
const bare403 = { status: 403, body: '' }

const REASON_REFUSED = 'A flip of a store\u2019s engine needs a reason.'
const NEVER = '0001-01-01T00:00:00'

// HQ's open stores (the Store master) and the engine row it holds per store (absent = no row).
const STORES = () => [
  { code: 'R101', name: 'Riyadh, Olaya' },
  { code: 'J204', name: 'Jeddah, Tahlia' },
  { code: 'D310', name: 'Dammam, Corniche' },
  { code: 'M01', name: 'Manama, Seef' },
  ...Array.from({ length: 52 }, (_, i) => ({ code: `P${String(i + 1).padStart(3, '0')}`, name: `Pharmacy ${i + 1}` })),
]
const change = (storeCode, fromEngine, engine, changedBy, changedAt, reason, inFlight = null) => ({
  storeCode, fromEngine, engine, changedBy, changedAt, reason, inFlight,
})
const IN_FLIGHT_R101 = {
  liveCampaigns: [
    { code: 'WKND20', nameEn: 'Weekend coupon: 20% off', nameAr: 'قسيمة نهاية الأسبوع: خصم 20%' },
    { code: 'BASE-EARN', nameEn: 'Base earn', nameAr: 'كسب النقاط الأساسي' },
  ],
  openSessions: [
    { sessionId: 'CC-R101-0091', channel: 'callcenter', openedAt: '2026-10-16T17:55:00', paidAt: '2026-10-16T17:58:00' },
    { sessionId: 'CC-R101-0092', channel: 'callcenter', openedAt: '2026-10-16T18:10:00', paidAt: NEVER },
  ],
  storeBudgets: [{ campaignId: 'WKND20', budgetId: 'store-money', periodKey: '2026-10', used: 1250.5, held: 40 }],
  truncated: true,
}
const HISTORY = () => ({
  R101: [change('R101', 'BonusBuy', 'Rule', 'reem', '2026-10-01T07:30:00', 'Pilot wave 1')],
  J204: [
    change('J204', 'BonusBuy', 'Rule', 'reem', '2026-10-05T07:00:00', 'Pilot wave 2'),
    change('J204', 'Rule', 'BonusBuy', 'omar', '2026-10-03T09:15:00', 'Till rollback', {
      liveCampaigns: [{ code: 'WKND20', nameEn: 'Weekend coupon', nameAr: 'قسيمة' }], openSessions: [], storeBudgets: [], truncated: false,
    }),
    change('J204', 'BonusBuy', 'Rule', 'omar', '2026-10-02T08:00:00', 'First try'),
  ],
  M01: [change('M01', 'BonusBuy', 'Rule', 'ali', '2026-10-06T06:45:00', 'Bahrain pilot')],
})

const browser = await chromium.launch()

async function open({ refuseFlip = 0, deny = '' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const flips = []
  const lookups = []
  const stores = STORES()
  const history = HISTORY()
  // HQ's StorePromotionEngine rows: D310 and the P stores have none.
  const engines = { R101: 'Rule', J204: 'Rule', M01: 'Rule' }
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
    if (p === 'Auth/Me') return route.fulfill(ok({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Rules/Authoring/Lookups/stores' && req.method() === 'POST') {
      if (deny === 'stores') return route.fulfill(bare403)
      const q = (req.postDataJSON()?.q ?? '').trim()
      lookups.push(q)
      // RuleLookupService.StoresAsync: code StartsWith or Description Contains (a CI collation), by code, at most 50.
      const hit = stores
        .filter((s) => !q || s.code.toLowerCase().startsWith(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.code.localeCompare(b.code))
        .slice(0, 50)
      return route.fulfill(ok(hit.map((s) => ({
        code: s.code, name: { en: s.name, ar: '' }, detail: engines[s.code] === 'Rule' ? 'Rule' : 'BonusBuy', articles: null, entries: null, neverDiscount: false,
      }))))
    }
    if (p === 'Rules/Switch/History' && req.method() === 'GET') {
      if (deny === 'switch') return route.fulfill(bare403)
      const store = url.searchParams.get('storeCode')
      const changes = history[store] ?? []
      const set = store in engines
      return route.fulfill(ok({
        store: {
          storeCode: store, engine: engines[store] === 'Rule' ? 'Rule' : 'BonusBuy', isSet: set,
          changedAt: set ? changes[0]?.changedAt ?? null : null, changedBy: set ? changes[0]?.changedBy ?? null : null,
        },
        changes,
      }))
    }
    if (p === 'Rules/Switch/Flip' && req.method() === 'POST') {
      const body = req.postDataJSON()
      flips.push(body)
      if (deny === 'switch') return route.fulfill(bare403)
      if (refusals > 0) {
        refusals--
        return route.fulfill(refused(400, 'RULES_REASON_REQUIRED', REASON_REFUSED))
      }
      const from = engines[body.storeCode] === 'Rule' ? 'Rule' : 'BonusBuy'
      const inFlight = from === 'Rule' && body.engine === 'BonusBuy' && body.storeCode === 'R101' ? IN_FLIGHT_R101 : null
      const c = change(body.storeCode, from, body.engine, 'msartawi', '2026-10-16T18:30:00', body.reason, inFlight)
      engines[body.storeCode] = body.engine
      ;(history[body.storeCode] ??= []).unshift(c)
      return route.fulfill(ok(c))
    }
    if (/Access$/.test(p)) return route.fulfill(ok({ canOpen: false, screenAllowed: false, allowed: false }))
    return route.fulfill(ok([]))
  })
  /** Another admin's flip, out of this page's sight. */
  const overtake = (storeCode, engine) => {
    history[storeCode].unshift(change(storeCode, engines[storeCode] === 'Rule' ? 'Rule' : 'BonusBuy', engine, 'omar', '2026-10-16T18:29:00', 'Elsewhere'))
    engines[storeCode] = engine
  }
  return { context, page, errors, calls, flips, lookups, overtake }
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
const FOUR = ['D310', 'J204', 'M01', 'R101']
const dialog = (page) => page.locator('[data-flip-dialog]')
const flipCalls = (calls) => calls.filter((c) => c.startsWith('POST Rules/Switch/Flip'))
// The four named stores sit behind a search: the P stores (no comma in their names) fill HQ's first 50 otherwise.
const searchFour = async (page) => {
  await field(page, 'search').fill(',')
  await waitRows(page, FOUR)
}

{
  const { context, page, errors, calls, flips, lookups, overtake } = await open({ refuseFlip: 1 })
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
  check('1: ungated — no probe call for the leaf', !calls.some((c) => /Switch\/Access|EngineSwitch\/Access/.test(c)))
  check('1: the NewPos facts sit under the lede (517 review)', /Only effective on NewPos stores\. A NewPos rollback resets the store to bonus buys\./.test(await text(page.locator('[data-engine-newpos]'))))

  // ── 2 + 3 ── the first answer is HQ's first 50
  await page.locator('[data-status-capped]').waitFor({ timeout: 10000 })
  check('3: an empty search asks HQ with q ""', lookups[0] === '' && !calls.some((c) => /StorePromotionEngine/.test(c)), JSON.stringify(lookups))
  check('3: an answer of 50 says HQ answers at most 50', /HQ answers at most 50 stores to a search: narrow it/.test(await text(page.locator('[data-status-capped]'))) && /50 stores/.test(await text(page.locator('[data-status-count]'))))
  await searchFour(page)
  check('2: HQ\u2019s stores list', JSON.stringify(await gridIds(page)) === JSON.stringify(FOUR))
  check('2: a store with no row reads Bonus buys', (await cell(page, 'D310', 'engine')) === 'Bonus buys')
  check('2: a flipped store reads Rule engine', (await cell(page, 'R101', 'engine')) === 'Rule engine')
  check('2: the store reads code · name', (await cell(page, 'R101', 'store')) === 'R101 · Riyadh, Olaya', await cell(page, 'R101', 'store'))
  check('2: the count, and no cap note under 50', /4 stores/.test(await text(page.locator('[data-status-count]'))) && (await page.locator('[data-status-capped]').count()) === 0)
  check('2: each row offers the flip to the other engine',
    /Flip to the rule engine/.test(await text(page.locator('[data-flip-open="D310"]'))) && /Flip back to bonus buys/.test(await text(page.locator('[data-flip-open="R101"]'))))
  check('2: no changed by / at / reason columns (the lookup answers none)', (await page.locator('[data-engine-grid] .ag-header-cell[col-id="changedBy"]').count()) === 0)

  await field(page, 'search').fill('olaya')
  await waitRows(page, ['R101'])
  check('3: the search finds a store by name, asked of HQ as q', lookups.at(-1) === 'olaya', JSON.stringify(lookups.slice(-3)))
  await field(page, 'search').fill('m01')
  await waitRows(page, ['M01'])
  check('3: …or by code, any case, kept in the address', new URL(page.url()).searchParams.get('search') === 'm01' && lookups.at(-1) === 'm01')
  await searchFour(page)
  await field(page, 'engine').selectOption('BonusBuy')
  await waitRows(page, ['D310'])
  check('3: the engine filter reads a missing row as Bonus buys', JSON.stringify(await gridIds(page)) === '["D310"]' && new URL(page.url()).searchParams.get('engine') === 'BonusBuy')
  await field(page, 'engine').selectOption('Rule')
  await waitRows(page, ['J204', 'M01', 'R101'])
  check('3: …and Rule engine lists the flipped, without asking HQ again', new URL(page.url()).searchParams.get('engine') === 'Rule' && lookups.at(-1) === ',')
  await field(page, 'engine').selectOption('')
  await waitRows(page, FOUR)
  await page.screenshot({ path: `${SHOTS}/528-list.png`, fullPage: true })

  // ── 4 ── flip D310 to the rule engine
  await page.locator('[data-flip-open="D310"]').click()
  await dialog(page).waitFor({ timeout: 5000 })
  check('4: a flip to the rule engine asks the reason', (await dialog(page).getAttribute('data-flip-step')) === 'reason' && (await page.locator('[data-flip-in-flight-after]').count()) === 0)
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
    (await text(page.locator('[data-flip-refusal]'))).includes(REASON_REFUSED) && (await page.locator('[data-refusal-code="RULES_REASON_REQUIRED"]').count()) === 1)
  check('4: …and RULES_REASON_REQUIRED marks the reason', (await page.locator('[data-flip-reason]').getAttribute('aria-invalid')) === 'true')
  await page.locator('[data-flip-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 })
  check('4: the flip sends { storeCode, engine, reason } trimmed, and no `from`',
    JSON.stringify(flips.at(-1)) === JSON.stringify({ storeCode: 'D310', engine: 'Rule', reason: 'Pilot wave 3: Eastern province' }), JSON.stringify(flips.at(-1)))
  await page.waitForFunction(() => document.querySelector('[data-engine-grid] .ag-row[row-id="D310"] [data-engine]')?.getAttribute('data-engine') === 'Rule', null, { timeout: 5000 })
  check('4: the row reads Rule engine (HQ asked again)', (await cell(page, 'D310', 'engine')) === 'Rule engine')
  check('4: a toast says it flips at the next shift open', /D310 · Dammam, Corniche flips to the rule engine/.test(await text(page.locator('[data-sonner-toaster]'))))
  await page.locator('[data-history="D310"] [data-history-entry="0"]').waitFor({ timeout: 5000 })
  check('4: the store\u2019s history opens on the new line',
    /From Bonus buys to Rule engine/.test(await text(page.locator('[data-history="D310"] [data-history-entry="0"]'))) &&
    /Pilot wave 3: Eastern province/.test(await text(page.locator('[data-history="D310"] [data-history-entry="0"]'))) &&
    new URL(page.url()).searchParams.get('store') === 'D310')
  check('4: …and reads who set it now', /Set 2026-10-16 18:30 · msartawi/.test(await text(page.locator('[data-history="D310"] [data-history-now-by]'))))

  // ── 5 ── flip R101 back to bonus buys: the in-flight list comes on the reply
  await page.locator('[data-flip-open="R101"]').click()
  await dialog(page).waitFor({ timeout: 5000 })
  check('5: a flip back asks the reason first, and says HQ lists what is in flight after it',
    (await dialog(page).getAttribute('data-flip-step')) === 'reason' && /lists it after the flip\. It never blocks/.test(await text(page.locator('[data-flip-in-flight-after]'))))
  check('5: no read before the flip', !calls.some((c) => /InFlight/.test(c)))
  await page.locator('[data-flip-reason]').fill('Till fault at R101')
  await page.locator('[data-flip-confirm]').click()
  await page.locator('[data-in-flight]').waitFor({ timeout: 5000 })
  check('5: the flip went out with its reason', JSON.stringify(flips.at(-1)) === JSON.stringify({ storeCode: 'R101', engine: 'BonusBuy', reason: 'Till fault at R101' }), JSON.stringify(flips.at(-1)))
  check('5: the dialog then shows what is still in flight, the flip already made',
    (await dialog(page).getAttribute('data-flip-step')) === 'inFlight' && /back on bonus buys/.test(await text(page.locator('[data-in-flight]'))) &&
    /5 things are still in flight/.test(await text(page.locator('[data-in-flight]'))) && /nothing was blocked/.test(await text(page.locator('[data-in-flight]'))))
  const count = (k) => page.locator(`[data-in-flight-list="${k}"]`).getAttribute('data-in-flight-count')
  check('5: live campaigns, paying sessions, store-scope budgets', (await count('liveCampaigns')) === '2' && (await count('openSessions')) === '2' && (await count('storeBudgets')) === '1')
  const wk = page.locator('[data-in-flight-list="liveCampaigns"] [data-in-flight-item="WKND20"]')
  check('5: a live campaign reads its name in EN and AR', (await text(wk.locator('[data-says-en]'))) === 'Weekend coupon: 20% off' && (await text(wk.locator('[data-says-ar]'))) === 'قسيمة نهاية الأسبوع: خصم 20%' && (await wk.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
  check('5: a paying session reads its id, channel, local opened and paid', /CC-R101-0091 callcenter opened 2026-10-16 17:55, paid 2026-10-16 17:58/.test(await text(page.locator('[data-in-flight-item="CC-R101-0091"]'))), await text(page.locator('[data-in-flight-item="CC-R101-0091"]')))
  check('5: a never-set time reads —, never 0001', /paid —/.test(await text(page.locator('[data-in-flight-item="CC-R101-0092"]'))) && !/0001/.test(await text(page.locator('[data-in-flight]'))))
  check('5: a store budget reads campaign · budget, period, used and held', /WKND20 · store-money 2026-10 used 1250\.5, held 40/.test(await text(page.locator('[data-in-flight-list="storeBudgets"]'))), await text(page.locator('[data-in-flight-list="storeBudgets"]')))
  check('5: truncated says some were left out', /at most 100 of each kind/.test(await text(page.locator('[data-in-flight-truncated]'))))
  await page.screenshot({ path: `${SHOTS}/528-in-flight.png`, fullPage: true })
  await page.waitForFunction(() => document.querySelector('[data-engine-grid] .ag-row[row-id="R101"] [data-engine]')?.getAttribute('data-engine') === 'BonusBuy', null, { timeout: 5000 })
  check('5: the row already reads Bonus buys behind the list', (await cell(page, 'R101', 'engine')) === 'Bonus buys')
  await page.locator('[data-flip-done]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('[data-history="R101"] [data-history-entry="1"]').waitFor({ timeout: 5000 })
  check('5: Done closes and opens the history, the flip back on top with what it left in flight',
    /From Rule engine to Bonus buys/.test(await text(page.locator('[data-history="R101"] [data-history-entry="0"]'))) &&
    /Left 5 things in flight/.test(await text(page.locator('[data-history="R101"] [data-history-entry="0"]'))) &&
    /From Bonus buys to Rule engine/.test(await text(page.locator('[data-history="R101"] [data-history-entry="1"]'))))

  // ── 6 ── M01 flips back with nothing in flight: the dialog closes
  await page.locator('[data-flip-open="M01"]').click()
  await page.locator('[data-flip-reason]').fill('Bahrain pilot paused')
  await page.locator('[data-flip-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 })
  check('6: a flip back that warned of nothing closes straight away', flips.at(-1)?.storeCode === 'M01' && flips.at(-1)?.engine === 'BonusBuy' && (await page.locator('[data-in-flight]').count()) === 0)
  // Another admin flips D310 back while this list still reads Rule engine.
  overtake('D310', 'BonusBuy')
  await page.locator('[data-flip-open="D310"]').click()
  await page.locator('[data-flip-reason]').fill('Till rollback again')
  await page.locator('[data-flip-confirm]').click()
  await dialog(page).waitFor({ state: 'detached', timeout: 5000 })
  await page.waitForFunction(() => [...document.querySelectorAll('[data-sonner-toaster]')].some((t) => t.textContent.includes('was already on bonus buys')), null, { timeout: 5000 })
  check('6: a flip from a stale list says the store was already on that engine', /D310 · Dammam, Corniche was already on bonus buys/.test(await text(page.locator('[data-sonner-toaster]'))))
  await page.locator('[data-history-close]').click()

  // ── 7 ── J204's history from its row
  await gridRow(page, 'J204').locator('.ag-cell[col-id="store"]').click()
  await page.locator('[data-history="J204"] [data-history-entry="2"]').waitFor({ timeout: 5000 })
  const e0 = await text(page.locator('[data-history="J204"] [data-history-entry="0"]'))
  const e1 = await text(page.locator('[data-history="J204"] [data-history-entry="1"]'))
  check('7: a row opens its history: who, when (local), from → to, reason',
    /2026-10-05 07:00 · reem/.test(e0) && /From Bonus buys to Rule engine/.test(e0) && /Pilot wave 2/.test(e0), e0)
  check('7: a flip back reads what it left in flight', /From Rule engine to Bonus buys/.test(e1) && /Left 1 thing in flight/.test(e1), e1)
  check('7: the engine now and who set it', (await page.locator('[data-history="J204"] [data-history-now]').getAttribute('data-history-now')) === 'Rule' && /Set 2026-10-05 07:00 · reem/.test(await text(page.locator('[data-history="J204"] [data-history-now-by]'))))
  check('7: the history is asked by store', calls.some((c) => c === 'GET Rules/Switch/History?storeCode=J204'))
  await page.screenshot({ path: `${SHOTS}/528-history.png`, fullPage: true })
  await page.locator('[data-history-close]').click()
  await page.locator('[data-history]').waitFor({ state: 'detached', timeout: 3000 })
  check('7: it closes, and leaves the address', !new URL(page.url()).searchParams.has('store'))
  await field(page, 'search').fill('p05')
  await waitRows(page, ['P050', 'P051', 'P052'])
  await gridRow(page, 'P051').locator('.ag-cell[col-id="store"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-history="P051"] [data-history-never-set]').waitFor({ timeout: 3000 })
  check('7: Enter on a row opens its history; a store HQ holds no row for says so',
    new URL(page.url()).searchParams.get('store') === 'P051' && /holds no setting/.test(await text(page.locator('[data-history="P051"] [data-history-never-set]'))) &&
    (await page.locator('[data-history="P051"] [data-history-empty]').count()) === 1)

  check('9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page, errors } = await open({ deny: 'stores' })
  await page.goto(`${BASE}/admin/engine-switch`)
  await page.locator('[data-engine-switch] [role="alert"]').waitFor({ timeout: 15000 })
  const said = await text(page.locator('[data-engine-switch] [role="alert"]'))
  check('8: a bare 403 on the list names the builder\u2019s grant', /RuleAuthoring/.test(said) && !/HTTP 403/.test(said), said)
  check('9: no page errors (list refused)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page, errors, flips } = await open({ deny: 'switch' })
  await page.goto(`${BASE}/admin/engine-switch?search=%2C&store=R101`)
  await page.locator('[data-history="R101"] [role="alert"]').waitFor({ timeout: 15000 })
  const hist = await text(page.locator('[data-history="R101"] [role="alert"]'))
  check('8: a bare 403 on the history names the switch grant', /RuleEngineSwitch, display/.test(hist) && !/HTTP 403/.test(hist), hist)
  await page.locator('[data-flip-open="D310"]').click()
  await page.locator('[data-flip-reason]').fill('Pilot')
  await page.locator('[data-flip-confirm]').click()
  await page.locator('[data-flip-refusal]').waitFor({ timeout: 5000 })
  const flip = await text(page.locator('[data-flip-refusal]'))
  check('8: a bare 403 on the flip names the switch grant', /RuleEngineSwitch, change/.test(flip) && !/HTTP 403/.test(flip) && flips.length === 1, flip)
  check('9: no page errors (switch refused)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
