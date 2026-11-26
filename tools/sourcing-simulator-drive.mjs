// Sourcing simulator drive (ticket 962, BackOffice spec 4354 §19) — build a cart, run it, switch cards to table.
// Ticket 966 adds the Solver tab's five diagrams (`solverDrive`, its steps listed above it): the flow graph's chunk is
// asked for only when the graph opens.
//
// Drives the REAL app against a STUB of the advise door BackOffice 4355–4357 have not built, answering EXACTLY the
// BackOffice 4281 wire (its worked example, cut to the full level: `src/features/oms/sourcing-simulator/
// advise-reply.fixture.json`, the same reply the model tests read):
//   GET  Auth/Permissions           → the run grant `SourcingAdvisorRun:06` (PROVISIONAL key) held or not
//   GET  SourcingAdvisor/Workbench  → no map key (PROVISIONAL door): the map cannot draw, the point is typed
//   POST SourcingAdvisor/Advise     → the fixture, a variant of it, or a door error (true HTTP status + code)
// Left to right and right to left (`oms.locale = 'ar'`, the page's direction) it asserts:
//   1. without the run grant: no menu leaf, the denied card, and the door is never asked;
//   2. with it: the leaf, the cart, Run off and the "needs" note until a line and the customer's point are given;
//   3. the map cannot draw without a key, says so, and the point is typed instead (the click that places the customer
//      is proven by `src/core/map/map-place-customer.test.ts`: a drive cannot draw Google's map without a real key);
//   4. Run shows one "planning" state, then posts the cart form at the full level with `allPlans` and the time of day;
//   5. the plans as cards: three, the merged plan's tags, the server's promise sentence in the screen's language, the
//      customer's fee per shipment and in total, the company's cost, the price of waiting, the balanced total, as sent;
//      the ending in words and the stage times from the reply;
//   6. the switch to one table: a row per measure, a column per plan; and back;
//   7. a changed cart after a run says the plans are stale;
//   8. a goal with no plan (with the server's sentence) and a hidden plan behind "show", with its reason;
//   9. the simple plan answered: the banner and the ending;
//  10. ADVISE-512 reads "The stock figures could not be read" in the screen's language, with its code and "try again",
//      which posts the same cart again; ADVISE-423 offers no "try again";
//  11. RTL: the page is right to left, and the store pair and the run number read left to right;
//  12. no page errors;
//  13. (ticket 965) on a split plan — two Dawaa Now shipments, picked in the tab strip — "Why this plan": a promise bar
//      of four parts per shipment with sources, the pick end, the usual time, lengtheners marked "adds nothing"; the
//      money with a column per shipment, sources and the assumed banner; how deliveries go at each store; "why not
//      another store" asks the PROVISIONAL door `GET SourcingAdvisor/WhyNot` (stubbed with the reply's `search.whyNot`)
//      and shows a removal's rule, a pair the plan uses, and on Recommended a standing pair's sums and parts; a slot
//      shipment's skipped and next slots; the short-figure sentence with its chance, on the card and in the tab;
//      "What the run used": four counts, the marks of the run, every factor; never "fault", "performance", "rating" or
//      "out of stock".
// Ticket 963 (pins and the weight set), in a context of its own, against PROVISIONAL weight-set doors
// (`SourcingAdvisor/WeightSets`, `…/WeightSets/Version`, `…/WeightSets/Save`) and the save grant `SourcingAdvisorSave:01` (973's):
//  14. the panel opens on the candidate set, unchanged; Reach and shape has no switch for pricing waiting per shipment;
//  15. pin a line from a plan (store and mode): chips; Run plans again on the same figures (`basedOnRun`, the pins);
//      the refused pin stays listed with its reason, code and rule; each plan shows what the pins cost it; "figures as
//      read at …, from run …";
//  16. change a weight: "changed, not saved"; Run sends the draft in full as `basedOnRun`; the reply's draft is said;
//  17. the held copy gone (ADVISE-404): the cart runs again with its pins and draft, and the screen says so;
//  18. a change that needed a wider read: READ_AFRESH and its why are said;
//  19. save as a named set: the whole draft goes to the save door; the picker names the new set, no longer changed,
//      and Run names it; without the save grant the panel says the grant is needed;
//  20. pins that leave no plan: one banner naming them;
//  21. a trial set: the panel's mark and the run's banner;
//  22. RTL: the pins' cost figures and the refused pin's code are Ltr isolates reading left to right; no page errors.
//
//   1. run the app:  npx vite --port 5203 --strictPort
//   2. DRIVE_PORT=5203 node tools/sourcing-simulator-drive.mjs
//      (PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`
const SHOTS = 'tools/.sourcing-simulator-shots'
mkdirSync(SHOTS, { recursive: true })

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const REPLY = json('../src/features/oms/sourcing-simulator/advise-reply.fixture.json')
// Ticket 965: the same run with a split plan (two Dawaa Now shipments) shown second, as Fastest.
const SPLIT_PLAN = json('../src/features/oms/sourcing-simulator/split-plan.fixture.json')
const SPLIT = { ...REPLY, plans: [REPLY.plans[0], SPLIT_PLAN, ...REPLY.plans.slice(1)] }
// The OMS app boots i18next in English; `oms.locale = 'ar'` sets the page's direction (`src/core/theme/direction.ts`),
// so both passes read the English words. Every Arabic text the page has is pinned by `error-text.test.ts` and the
// locale's own keys; the server's Arabic sentences are picked when the language is Arabic (`use-plan-words.ts`).
const EN = json('../src/locales/en/sourcing-simulator.json')
const WORDS = { ltr: EN, rtl: EN }
const RUN_GRANT = 'SourcingAdvisorRun:06'
const SAVE_GRANT = 'SourcingAdvisorSave:01'
// Ticket 963: the pins, the run without them and the refused pin, shared with `pins-model.test.ts`.
const PINS = json('../src/features/oms/sourcing-simulator/pins-reply.fixture.json')
/** The baseline set as the PROVISIONAL read door gives it: the panel's keys and settings it does not show. */
const BASELINE_VALUES = {
  companyCostWeight: 1,
  feeWeight: 1,
  waitingPerHour: 5,
  splitPenalty: 0,
  mostShipments: 3,
  marginMultiplier: 1,
  buffer: true,
  stockConfidence: true,
  storeRecord: true,
  widerSlotReach: false,
  carrierModes: false,
  feePerOrder: false,
  pickUpInDeliveryPlan: false,
  coverPrice: 1,
  failurePrices: { late: 4, returned: 9 },
}
const SETS = () => [
  { name: 'Baseline', owner: null, versions: [1], candidateVersion: 1, trial: false },
  { name: 'Carriers on', owner: 'aalharbi', versions: [1, 2], candidateVersion: null, trial: true },
]

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: message }] : [],
    data,
  }),
})
const refusal = (status, errorCode, message) => envelope(null, { status, success: false, message, errorCode })

/** 4281's "four kinds of reason": no single store for pick-up, and Fewest nearly the same as Recommended. */
const WITH_REASONS = {
  ...REPLY,
  plans: REPLY.plans.filter((p) => p.goal !== 'PICK_UP').map((p) => (p.goal === 'BALANCED' ? { ...p, alsoGoals: ['FASTEST'] } : p)),
  noPlan: [
    { goal: 'PICK_UP', code: 'NO_SINGLE_STORE', lines: [1, 3], en: 'No pharmacy near you holds your whole order', ar: 'لا توجد صيدلية قريبة يتوفر فيها طلبك كاملًا' },
  ],
  hiddenPlans: [{ goal: 'FEWEST', code: 'NEARLY_SAME', as: 'BALANCED', minutesApart: 10, riyalsApart: 0.4 }],
}
const FALLBACK = {
  ...REPLY,
  solve: { ...REPLY.solve, ending: 'FALLBACK_ANSWERED', why: 'search timed out' },
  plans: [{ ...REPLY.plans[0], fallback: true, alsoGoals: [] }],
  noPlan: ['FASTEST', 'FEWEST', 'CHEAPEST', 'PICK_UP'].map((goal) => ({ goal, code: 'FALLBACK_ANSWERED', en: 'The simple plan answered', ar: 'أجابت الخطة البسيطة' })),
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})

async function open(dir, { granted = true, canSave = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4|5)\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  const wire = { posts: [], calls: [], next: [], whyNot: [], saves: [], sets: SETS(), values: { 'Baseline:1': BASELINE_VALUES, 'Carriers on:2': { ...BASELINE_VALUES, carrierModes: true } } }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    wire.calls.push(p)
    if (p === 'SourcingAdvisor/WhyNot') {
      // PROVISIONAL door (ticket 965): one store's rows of the held run's `search.whyNot[]`.
      const q = Object.fromEntries(url.searchParams)
      wire.whyNot.push(q)
      return route.fulfill(envelope(REPLY.search.whyNot.filter((r) => r.store === q.store)))
    }
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions')
      return route.fulfill(permissions(['DocumentList:03', 'SourcingAdvisor:01', ...(granted ? [RUN_GRANT] : []), ...(granted && canSave ? [SAVE_GRANT] : [])]))
    if (p === 'SourcingAdvisor/Workbench') return route.fulfill(envelope({ maps: null }))
    if (p === 'SourcingAdvisor/WeightSets') return route.fulfill(envelope(wire.sets))
    if (p === 'SourcingAdvisor/WeightSets/Version') {
      const q = new URL(route.request().url()).searchParams
      const name = q.get('name')
      const version = Number(q.get('version'))
      const set = wire.sets.find((x) => x.name === name)
      const values = wire.values[`${name}:${version}`]
      if (!set || !values) return route.fulfill(envelope(null, { status: 404, success: false, message: 'Not found' }))
      return route.fulfill(envelope({ name, version, values, candidate: set.candidateVersion === version, trial: set.trial }))
    }
    if (p === 'SourcingAdvisor/WeightSets/Save') {
      const body = JSON.parse(route.request().postData() || '{}')
      wire.saves.push(body)
      wire.sets.push({ name: body.name, owner: 'msartawi', versions: [1], candidateVersion: null, trial: false })
      wire.values[`${body.name}:1`] = body.values
      return route.fulfill(envelope({ name: body.name, version: 1 }))
    }
    if (p === 'SourcingAdvisor/Advise') {
      wire.posts.push(JSON.parse(route.request().postData() || '{}'))
      // One request, one reply: held a moment, so the one "planning" state can be seen.
      await new Promise((r) => setTimeout(r, 700))
      const answer = wire.next.shift() ?? envelope(REPLY)
      return route.fulfill(answer)
    }
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, wire }
}

/** Whether a text reads left to right on screen: its first character's box starts left of its last's. */
const readsLtr = (locator) =>
  locator.evaluate((el) => {
    const text = el.textContent.trim()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = null
    let at = -1
    while (walker.nextNode()) {
      const i = walker.currentNode.textContent.indexOf(text)
      if (i >= 0) {
        node = walker.currentNode
        at = i
        break
      }
    }
    if (!node) return null
    const box = (k) => {
      const r = document.createRange()
      r.setStart(node, k)
      r.setEnd(node, k + 1)
      return r.getBoundingClientRect()
    }
    return box(at).left < box(at + text.length - 1).left
  })
const isLtrIsolate = (locator) => locator.evaluate((el) => el.tagName === 'BDI' && el.getAttribute('dir') === 'ltr')
const text = async (locator) => ((await locator.textContent()) ?? '').replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()

const SIM = '/oms/sourcing-simulator'

async function drive(dir) {
  const W = WORDS[dir]
  const label = dir === 'rtl' ? 'RTL' : 'LTR'
  const money = (amount) => W.money.replace('{{amount}}', amount)

  // 1. without the run grant
  {
    const { context, page, wire } = await open(dir, { granted: false })
    await page.goto(`${BASE}${SIM}`)
    const card = page.locator('main [role="alert"]').first()
    await card.waitFor({ timeout: 15000 }).catch(() => {})
    await page.screenshot({ path: `${SHOTS}/${dir}-denied.png` })
    const said = (await card.count()) ? await text(card) : ''
    const leaf = await page.locator(`nav a[href="${SIM}"]`).count()
    check(
      `${label}: without the run grant, no leaf, the denied card, and the door is never asked`,
      said.includes(W.access.deniedTitle) && leaf === 0 && !wire.calls.includes('SourcingAdvisor/Advise') && !wire.calls.includes('SourcingAdvisor/Workbench'),
      `leaf=${leaf} card=${said}`,
    )
    await context.close()
  }

  const { context, page, errors, wire } = await open(dir)
  await page.goto(`${BASE}${SIM}`)
  await page.locator('[data-sim-cart]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)

  // 2. the leaf, the cart, Run off until the cart can run
  check(`${label}: the leaf is in the menu`, (await page.locator(`nav a[href="${SIM}"]`).count()) === 1)
  check(`${label}: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  check(
    `${label}: Run is off with the "needs" note before a line and the customer are given`,
    (await page.locator('[data-sim-run]').isDisabled()) && (await page.locator('[data-sim-needs="noLines"]').count()) === 1,
  )
  check(`${label}: before any run, the plans column says how to start`, (await page.locator('[data-run-none]').count()) === 1)

  // 3. the map cannot draw without a key: it says so, and the point is typed
  await page.locator('[data-sim-customer] [data-map-state="cannot-draw"]').waitFor({ timeout: 10000 })
  check(`${label}: with no map key the map says it cannot draw, and the point is typed instead`, (await page.getByText(W.customer.cannotDraw).count()) === 1)

  // build the cart: three lines, channel, time of day, the customer's point
  await page.locator('[data-sim-field="channel"]').selectOption('IOS')
  await page.locator('[data-sim-field="time"]').fill('19:42')
  const lines = [
    ['100234', '2'],
    ['100871', '1'],
    ['104410', '1'],
  ]
  for (const [i, [item, qty]] of lines.entries()) {
    if (i > 0) await page.locator('[data-sim-add-line]').click()
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-item]`).fill(item)
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-qty]`).fill(qty)
  }
  check(`${label}: a line without the customer still cannot run`, (await page.locator('[data-sim-needs="noPoint"]').count()) === 1)
  await page.locator('[data-sim-field="lat"]').fill('24.7741')
  await page.locator('[data-sim-field="lng"]').fill('46.7386')
  check(`${label}: with lines and the customer placed, Run is on`, !(await page.locator('[data-sim-run]').isDisabled()) && (await page.locator('[data-sim-placed]').count()) === 1)

  // 4. Run: one "planning" state, then the cart form at the full level with allPlans
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-planning]').waitFor({ timeout: 3000 })
  check(`${label}: while it runs, one "planning" state and Run is off`, (await page.locator('[data-run-planning]').count()) === 1 && (await page.locator('[data-sim-run]').isDisabled()))
  await page.locator('[data-plan-cards]').waitFor({ timeout: 5000 })
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const posted = wire.posts[0]
  check(
    `${label}: Run posts the cart at the full level with allPlans, the time of day and the customer's point`,
    wire.posts.length === 1 &&
      JSON.stringify(posted) ===
        JSON.stringify({
          channel: 'IOS',
          lines: [
            { lineNo: 1, item: '100234', quantity: 2, unit: 'EA' },
            { lineNo: 2, item: '100871', quantity: 1, unit: 'EA' },
            { lineNo: 3, item: '104410', quantity: 1, unit: 'EA' },
          ],
          customer: { point: { lat: 24.7741, lng: 46.7386 } },
          plannedFor: `${iso} 19:42:00`,
          level: 'full',
          allPlans: true,
          weightSet: { name: 'Baseline', version: 1 },
        }),
    JSON.stringify(posted),
  )

  // 5. the cards
  const cards = page.locator('[data-plan-card]')
  const goals = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-plan-card')))
  check(`${label}: three cards, in the reply's order`, goals.join() === 'BALANCED,CHEAPEST,PICK_UP', goals.join())
  const rec = page.locator('[data-plan-card="BALANCED"]')
  const tags = await rec.locator('[data-plan-tag]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check(`${label}: the merged plan carries its tags`, tags.join('|') === [W.tag.FASTEST, W.tag.FEWEST].join('|'), tags.join('|'))
  const head = await text(rec.locator('[data-plan-head] bdi').first())
  check(`${label}: the plan's label is the server's, in the screen's language`, head === 'Recommended', head)
  const promise = await text(rec.locator('[data-plan-promise] bdi').first())
  const promiseSaid = REPLY.plans[0].promise.en
  check(`${label}: the server's promise sentence, in the screen's language (the other beside it)`, promise === promiseSaid, promise)
  const fig = async (k) => text(rec.locator(`[data-plan-figure="${k}"] dd`))
  const figs = { fee: await fig('fee'), companyCost: await fig('companyCost'), waiting: await fig('waiting'), balanced: await fig('balanced') }
  check(
    `${label}: fee total, company's cost, price of waiting and balanced total as sent`,
    figs.fee === money('16.000') && figs.companyCost === money('17.420') && figs.waiting === money('7.000') && figs.balanced === money('40.420'),
    JSON.stringify(figs),
  )
  const shipFee = await text(rec.locator('[data-plan-shipment="1"] [data-shipment-fee] dd'))
  check(`${label}: the customer's fee per shipment`, shipFee === money('16.000'), shipFee)
  const ending = await text(page.locator('[data-run-ending]'))
  check(`${label}: the run's ending in words`, ending === W.ending.PROVEN_BEST, ending)
  const total = await text(page.locator('[data-run-stage="total"] dd'))
  check(`${label}: the stage times are read from the reply`, total === W.stages.ms.replace('{{ms}}', '771') && (await page.locator('[data-run-stage]').count()) === 8, total)
  await page.screenshot({ path: `${SHOTS}/${dir}-cards.png`, fullPage: true })

  // 6. switch to one table, and back
  await page.locator('[data-plans-view-switch="table"]').click()
  await page.locator('[data-plans-table]').waitFor({ timeout: 3000 })
  const rows = await page.locator('[data-plans-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-plans-row')))
  const cols = await page.locator('[data-plans-column]').evaluateAll((els) => els.map((e) => e.getAttribute('data-plans-column')))
  const feeCell = await text(page.locator('[data-plans-cell="fee:BALANCED"] span').first())
  const balancedCell = await text(page.locator('[data-plans-cell="balanced:CHEAPEST"] span').first())
  check(
    `${label}: the table has a row per measure and a column per plan, cells as sent`,
    rows.join() === 'promise,deliveries,storesAndModes,fee,companyCost,waiting,balanced' &&
      cols.join() === 'BALANCED,CHEAPEST,PICK_UP' &&
      feeCell === money('16.000') &&
      balancedCell === money('51.350') &&
      (await page.locator('[data-plan-cards]').count()) === 0,
    `${rows.join()} | ${cols.join()} | ${feeCell} | ${balancedCell}`,
  )
  check(`${label}: the table's columns carry the tags too`, (await page.locator('[data-plans-column="BALANCED"] [data-plan-tag]').count()) === 2)
  await page.screenshot({ path: `${SHOTS}/${dir}-table.png`, fullPage: true })

  // 11. RTL (and LTR alike): the store pair and the run number are isolates that read left to right
  const pair = page.locator('[data-plans-cell="storesAndModes:BALANCED"] .font-mono bdi').first()
  const runId = page.locator('[data-run-id] bdi').first()
  check(
    `${label}: the store pair and the run number are Ltr isolates reading left to right`,
    (await isLtrIsolate(pair)) && (await isLtrIsolate(runId)) && (await readsLtr(pair)) === true && (await readsLtr(runId)) === true,
  )
  await page.locator('[data-plans-view-switch="cards"]').click()
  check(`${label}: and back to cards`, (await page.locator('[data-plan-cards]').count()) === 1 && (await page.locator('[data-plans-table]').count()) === 0)

  // 7. a changed cart says the plans are stale
  await page.locator('[data-sim-line="1"] [data-sim-line-qty]').fill('3')
  check(`${label}: a changed cart after a run says the plans are stale`, (await page.locator('[data-run-stale]').count()) === 1)
  await page.locator('[data-sim-line="1"] [data-sim-line-qty]').fill('2')
  check(`${label}: put back, the plans are current again`, (await page.locator('[data-run-stale]').count()) === 0)

  // 8. a goal with no plan, and a hidden plan behind "show"
  wire.next.push(envelope(WITH_REASONS))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-plan-notes]').waitFor({ timeout: 5000 })
  const noPlan = await text(page.locator('[data-no-plan="PICK_UP"] bdi').first())
  check(
    `${label}: a goal with no plan is listed with the server's sentence and its code`,
    noPlan === WITH_REASONS.noPlan[0].en && (await page.locator('[data-no-plan-code="NO_SINGLE_STORE"]').count()) === 1,
    noPlan,
  )
  check(`${label}: hidden plans sit behind "show"`, (await page.locator('[data-hidden-plans="closed"]').count()) === 1 && (await page.locator('[data-hidden-plan]').count()) === 0)
  await page.locator('[data-hidden-toggle]').click()
  const hidden = await text(page.locator('[data-hidden-plan="FEWEST"]'))
  check(
    `${label}: a hidden plan shows its reason`,
    (await page.locator('[data-hidden-code="NEARLY_SAME"]').count()) === 1 && hidden.includes(W.goal.BALANCED) && hidden.includes('10'),
    hidden,
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-notes.png`, fullPage: true })

  // 9. the simple plan answered
  wire.next.push(envelope(FALLBACK))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-fallback]').waitFor({ timeout: 5000 })
  check(
    `${label}: the simple plan answered: the banner, the plan's flag and the ending`,
    (await text(page.locator('[data-run-ending]'))) === W.ending.FALLBACK_ANSWERED && (await page.locator('[data-plan-flag="fallback"]').count()) === 1,
  )

  // 10. ADVISE-512, then "try again"; ADVISE-423 offers none
  wire.next.push(refusal(503, 'ADVISE-512', 'The stock figures could not be read. No plan was made.'))
  const before = wire.posts.length
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-error-code="ADVISE-512"]').waitFor({ timeout: 5000 })
  const banner = await text(page.locator('[role="alert"]').filter({ has: page.locator('[data-run-error-code]') }))
  check(
    `${label}: ADVISE-512 reads in the screen's own words, with its code and "try again" (not the door's message)`,
    banner.includes(W.errors['ADVISE-512'].title) && banner.includes(W.errors['ADVISE-512'].body) && (await page.locator('[data-run-retry]').count()) === 1,
    banner,
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-error.png`, fullPage: true })
  await page.locator('[data-run-retry]').click()
  await page.locator('[data-plan-cards]').waitFor({ timeout: 5000 })
  check(
    `${label}: "try again" posts the same cart again and plans`,
    wire.posts.length === before + 2 && JSON.stringify(wire.posts.at(-1)) === JSON.stringify(wire.posts.at(-2)),
    `posts=${wire.posts.length - before}`,
  )
  wire.next.push(refusal(422, 'ADVISE-423', 'The cart has 51 lines. The advisor plans at most 50.'))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-error-code="ADVISE-423"]').waitFor({ timeout: 5000 })
  check(
    `${label}: ADVISE-423 reads in our words and offers no "try again"`,
    (await page.getByText(W.errors['ADVISE-423'].title).count()) === 1 && (await page.locator('[data-run-retry]').count()) === 0,
  )

  // 13. ticket 965: "Why this plan" and "What the run used" on a split plan
  wire.next.push(envelope(SPLIT))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-plan-card="FASTEST"]').waitFor({ timeout: 5000 })
  const cardShort = await text(page.locator('[data-plan-card="CHEAPEST"] [data-short-figure-sentence]'))
  check(
    `${label}: the card says a short-figure line in a plain sentence with its own chance`,
    cardShort === W.why.shortFigure.sentence.replace('{{line}}', '3').replace('{{n}}', '22'),
    cardShort,
  )
  await page.locator('[data-sim-tab="why"]').click()
  await page.locator('[data-sim-plan-pick="FASTEST"]').click()
  await page.locator('[data-why="FASTEST"]').waitFor({ timeout: 3000 })
  const why = page.locator('[data-why="FASTEST"]')
  const segs = await why.locator('[data-why-shipment] [data-why-segment]').evaluateAll((els) => els.map((e) => e.getAttribute('data-why-segment')))
  check(
    `${label}: the split plan's promise has a bar of four parts per shipment`,
    (await why.locator('[data-why-shipment]').count()) === 2 && segs.join() === 'madeReady,courierWait,travel,margin,madeReady,courierWait,travel,margin',
    segs.join(),
  )
  const part1 = await text(why.locator('[data-why-shipment="1"] [data-why-part="madeReady"]'))
  check(`${label}: each part with its minutes and its source`, part1.includes(W.why.promise.part.madeReady) && part1.includes('10') && part1.includes(W.why.source.STORES_OWN), part1)
  const pickEnd = await text(why.locator('[data-why-shipment="1"] [data-why-pick-end]'))
  const usual = await text(why.locator('[data-why-shipment="1"] [data-why-usual]'))
  check(
    `${label}: the pick end with its rule, and the usual time beside the promise`,
    pickEnd.includes('20:01') && pickEnd.includes(W.why.pickEndRule.CAUTIOUS_MADE_READY) && usual.includes('20:08'),
    `${pickEnd} | ${usual}`,
  )
  check(
    `${label}: lengtheners that add nothing say so; one that lengthens does not`,
    (await why.locator('[data-why-shipment="1"] [data-why-lengthener="DELIVERIES_WAITING"][data-adds-nothing="true"]').count()) === 1 &&
      (await why.locator('[data-why-shipment="2"] [data-why-lengthener="DELIVERIES_WAITING"][data-adds-nothing="false"]').count()) === 1,
  )
  check(`${label}: a straight-line distance is marked`, (await why.locator('[data-why-shipment="2"] [data-why-straight-line]').count()) === 1 && (await why.locator('[data-why-shipment="1"] [data-why-straight-line]').count()) === 0)
  const moneyRowsSeen = await why.locator('[data-why-money-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-why-money-row')))
  const rateCell = await text(why.locator('[data-why-money-cell="DELIVERY_RATE:2"]'))
  const balancedCell2 = await text(why.locator('[data-why-money-cell="balanced:plan"]'))
  check(
    `${label}: the money has a column per shipment, a row per part, every rate with its source`,
    (await why.locator('[data-why-money-column]').count()) === 2 &&
      moneyRowsSeen.join() === 'fee,DELIVERY_RATE,HANDLING,STORE_RECORD,companyCost,waiting,cover,split,balanced' &&
      rateCell.includes(money('15.000')) &&
      rateCell.includes(W.why.source.MEASURED) &&
      balancedCell2 === money('73.220') &&
      (await text(why.locator('[data-why-money-cell="DELIVERY_RATE:plan"]'))) === '',
    `${moneyRowsSeen.join()} | ${rateCell} | ${balancedCell2}`,
  )
  const assumedRows = await why.locator('[data-why-assumed-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-why-assumed-row')))
  check(`${label}: the banner names the assumed ones`, assumedRows.join() === 'fee,HANDLING', assumedRows.join())
  const record = await text(why.locator('[data-why-record="2"] [data-why-measure="calloutIgnored"]'))
  check(
    `${label}: how deliveries go at each store: the measure against like stores, the deliveries behind it, its cost`,
    (await why.locator('[data-why-record]').count()) === 2 && record.includes('23.0%') && record.includes('8.0%') && record.includes('41') && record.includes(money('0.300')),
    record,
  )
  const pairLtr = why.locator('[data-why-money-column="2"] bdi').first()
  check(`${label}: a shipment's column head, its number and store, is one Ltr isolate reading left to right`, (await isLtrIsolate(pairLtr)) && (await readsLtr(pairLtr)) === true)
  // why not another store: a removal, the plan's own pair, and on Recommended a standing pair
  await why.locator('[data-why-not-store]').selectOption('1203')
  await why.locator('[data-why-not-answer="1203"]').waitFor({ timeout: 3000 })
  const removed = await text(why.locator('[data-why-not-mode="DAWAA_NOW"]'))
  check(
    `${label}: "why not" asks the door for the store and the plan's goal, and a removed store gives its rule`,
    JSON.stringify(wire.whyNot.at(-1)) === JSON.stringify({ runId: REPLY.runId, store: '1203', goal: 'FASTEST' }) &&
      (await why.locator('[data-why-not-kind="removed"] [data-why-not-code="OUT_OF_REACH"]').count()) === 1 &&
      removed.includes(W.why.filter.OUT_OF_REACH) &&
      removed.includes('5'),
    removed,
  )
  await why.locator('[data-why-not-store]').selectOption('1061')
  await why.locator('[data-why-not-answer="1061"]').waitFor({ timeout: 3000 })
  check(`${label}: a store the plan already uses by that mode says so`, (await why.locator('[data-why-not-mode="DAWAA_NOW"][data-why-not-kind="inPlan"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/${dir}-why-split.png`, fullPage: true })
  await page.locator('[data-sim-plan-pick="BALANCED"]').click()
  const whyRec = page.locator('[data-why="BALANCED"]')
  await whyRec.waitFor({ timeout: 3000 })
  await whyRec.locator('[data-why-not-store]').selectOption('1061')
  await whyRec.locator('[data-why-not-answer="1061"]').waitFor({ timeout: 3000 })
  const sums = await text(whyRec.locator('[data-why-not-sums]'))
  const extra = await text(whyRec.locator('[data-why-not-part="STORE_RECORD"]'))
  check(
    `${label}: a standing store gives the best plan through it, against this plan, and what it costs more by part`,
    sums.includes(money('43.100')) && sums.includes(money('40.420')) && extra.includes(W.why.part.STORE_RECORD) && extra.includes(W.why.whyNot.more.replace('{{amount}}', money('1.900'))),
    `${sums} | ${extra}`,
  )
  // a slot shipment: skipped and next slots; the short-figure line in the tab
  await page.locator('[data-sim-plan-pick="CHEAPEST"]').click()
  const whyCheap = page.locator('[data-why="CHEAPEST"]')
  await whyCheap.waitFor({ timeout: 3000 })
  check(
    `${label}: a slot shipment lists the slots skipped and why, its next two slots, and the mark when a later one was cheaper`,
    (await whyCheap.locator('[data-why-skip="INSIDE_LEAD"]').count()) === 1 &&
      (await whyCheap.locator('[data-why-next-slot]').count()) === 2 &&
      (await whyCheap.locator('[data-why-later-cheaper]').count()) === 1 &&
      (await whyCheap.locator('[data-why-pick-end="HALF_WAY_TO_SLOT"]').count()) === 1,
  )
  check(`${label}: the tab says the short-figure line with its chance`, (await text(whyCheap.locator('[data-why-short-line="3"] [data-short-figure-sentence]'))) === cardShort)
  // what the run used
  await page.locator('[data-sim-tab="used"]').click()
  await page.locator('[data-used]').waitFor({ timeout: 3000 })
  const counts = {}
  for (const s of ['REAL_DATA', 'NEUTRAL_DEFAULT', 'ASSUMED', 'SWITCHED_OFF']) counts[s] = await text(page.locator(`[data-used-count="${s}"] dd`))
  check(`${label}: four counts on top`, JSON.stringify(counts) === JSON.stringify({ REAL_DATA: '8', NEUTRAL_DEFAULT: '2', ASSUMED: '3', SWITCHED_OFF: '2' }), JSON.stringify(counts))
  const marksSeen = await page.locator('[data-used-mark]').evaluateAll((els) => els.map((e) => e.getAttribute('data-used-mark')))
  check(`${label}: the marks of the run`, marksSeen.join() === 'straightLine,assumption,listFee,rangeNotConfirmed', marksSeen.join())
  const riders = await text(page.locator('[data-used-factor="RIDERS_AVAILABLE"]'))
  check(
    `${label}: every factor with how it enters, how it ran and its source`,
    (await page.locator('[data-used-factor]').count()) === 15 && riders.includes(W.used.factor.RIDERS_AVAILABLE) && riders.includes(W.used.entersAs.FILTER) && riders.includes(W.used.state.SWITCHED_OFF) && riders.includes('no data'),
    riders,
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-used.png`, fullPage: true })
  const panelWords = await text(page.locator('[data-sim-tabs]'))
  await page.locator('[data-sim-tab="why"]').click()
  const whyWords = await text(page.locator('[data-sim-tabs]'))
  check(`${label}: neither tab says "fault", "performance", "rating" or "out of stock"`, !/\b(fault|performance|rating)\b|out of stock/i.test(panelWords + whyWords))

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

/** Sets a range input the way a hand does: the native setter, then the input event React listens to. */
const slide = (locator, value) =>
  locator.evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)

async function buildCart(page) {
  await page.locator('[data-sim-field="channel"]').selectOption('IOS')
  for (const [i, [item, qty]] of [
    ['100234', '2'],
    ['100871', '1'],
    ['104410', '1'],
  ].entries()) {
    if (i > 0) await page.locator('[data-sim-add-line]').click()
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-item]`).fill(item)
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-qty]`).fill(qty)
  }
  await page.locator('[data-sim-field="lat"]').fill('24.7741')
  await page.locator('[data-sim-field="lng"]').fill('46.7386')
}

// ── Ticket 966: the Solver tab's five diagrams ──────────────────────────────────────────────────────────────────────
// Left to right and right to left, on the same fixture (the full level's `filterSteps`, `inputs.storeLines`, `search`):
//  S1. the funnel: every pair, then each step with the pairs standing, the run's cut said in words, a step opening to
//      the pairs it removed with the rule's words and figures, and the pairs offered;
//  S2. the stock per line: every store for the picked line, the record's figures as sent, "short by", the chosen store
//      following the plan picked in the strip;
//  S3. the trade-off: every kept plan once as a point, the three shown plans marked;
//  S4. what was tried: the search counts, ten rows and "show more", what a plan lost by and on what, a goal picker;
//  S5. the flow graph: NOT ONE request for its chunk (`FlowGraph`, `@xyflow/react`) until it opens; then the boxes and
//      lines, the chosen path animated, the controls, the mini-map and the library's attribution; a box drags; under
//      RTL the columns run from the right;
//  S6. no page errors.
async function fillCart(page) {
  await page.locator('[data-sim-cart]').waitFor({ timeout: 15000 })
  await page.locator('[data-sim-field="channel"]').selectOption('IOS')
  await page.locator('[data-sim-field="time"]').fill('19:42')
  const lines = [
    ['100234', '2'],
    ['100871', '1'],
    ['104410', '1'],
  ]
  for (const [i, [item, qty]] of lines.entries()) {
    if (i > 0) await page.locator('[data-sim-add-line]').click()
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-item]`).fill(item)
    await page.locator(`[data-sim-line="${i + 1}"] [data-sim-line-qty]`).fill(qty)
  }
  await page.locator('[data-sim-field="lat"]').fill('24.7741')
  await page.locator('[data-sim-field="lng"]').fill('46.7386')
}

async function solverDrive(dir) {
  const label = `${dir === 'rtl' ? 'RTL' : 'LTR'} solver`
  const S = WORDS[dir].solver
  const { context, page, errors } = await open(dir)
  const flowAsks = []
  page.on('request', (r) => /FlowGraph|xyflow/i.test(r.url()) && flowAsks.push(r.url()))
  await page.goto(`${BASE}${SIM}`)
  await fillCart(page)
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-plan-cards]').waitFor({ timeout: 5000 })
  await page.locator('[data-sim-tab="solver"]').click()
  await page.locator('[data-solver-panel="funnel"]').waitFor({ timeout: 5000 })

  // S1. the funnel
  const steps = await page.locator('[data-solver-step]').evaluateAll((els) => els.map((e) => e.getAttribute('data-solver-step')))
  const standing = await page.locator('[data-solver-standing]').evaluateAll((els) => els.map((e) => e.textContent.replace(/[⁦-⁩]/g, '').trim()))
  check(`${label}: the funnel starts from every pair and gives each step the pairs standing`, steps.join() === 'ALL,1,5,CUT,11' && standing.join() === '64,61,47,47,19', `${steps.join()} | ${standing.join()}`)
  check(
    `${label}: the cut is said in words with its code; the pairs offered close the funnel`,
    (await page.locator('[data-solver-cut="0"][data-solver-cut-code="OVER_PAIR_CAP"]').count()) === 1 &&
      (await text(page.locator('[data-solver-offered]'))) === S.funnel.offered.replace('{{count}}', '19'),
  )
  const step5 = page.locator('[data-solver-step="5"]')
  await step5.locator('summary').click()
  const removed = await text(step5.locator('[data-solver-removed-pair="1203:DAWAA_NOW"]'))
  check(
    `${label}: a step opens to the pairs it removed, with the rule's words and figures`,
    (await text(step5.locator('[data-solver-removed-count]'))) === '−14' && removed.includes('1203') && removed.includes(S.funnel.why.OUT_OF_REACH.replace('{{km}}', '6.8').replace('{{reachKm}}', '5.0')),
    removed,
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-solver-funnel.png`, fullPage: true })

  // S2. the stock per line
  await page.locator('[data-solver-diagram="stock"]').click()
  await page.locator('[data-solver-panel="stock"]').waitFor()
  const stores = await page.locator('[data-solver-stock-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-solver-stock-row')))
  const cell = async (store, k) => text(page.locator(`[data-solver-stock-row="${store}"] [data-solver-stock-cell="${k}"]`))
  check(
    `${label}: line 1 is worked through every store the run read, in the record's figures`,
    stores.join() === '1055,1090,1061' && (await cell('1061', 'afterDemand')) === '3' && (await cell('1061', 'confidence')) === '×0.80' && (await cell('1061', 'buffer')) === '−1' && (await cell('1061', 'offered')) === '1',
    stores.join(),
  )
  check(`${label}: a store short of the quantity says by how much`, (await cell('1061', 'serves')) === S.stock.shortBy.replace('{{count}}', '1'))
  await page.locator('[data-solver-line-pick="3"]').click()
  const chosenOn3 = async () => page.locator('[data-solver-stock-chosen]').evaluateAll((els) => els.map((e) => e.getAttribute('data-solver-stock-row')))
  check(`${label}: the store the Recommended plan sends line 3 from is marked`, (await chosenOn3()).join() === '1090')
  await page.locator('[data-sim-plan-pick="CHEAPEST"]').click()
  check(`${label}: picking Cheapest in the strip marks its store instead`, (await chosenOn3()).join() === '1055')
  const storeCell = page.locator('[data-solver-stock-row="1055"] td .font-mono bdi').first()
  check(`${label}: the store pair is an Ltr isolate that reads left to right`, (await isLtrIsolate(storeCell)) && (await readsLtr(storeCell)) === true)
  await page.screenshot({ path: `${SHOTS}/${dir}-solver-stock.png`, fullPage: true })

  // S3. the trade-off
  await page.locator('[data-solver-diagram="trade"]').click()
  await page.locator('[data-chart="scatter"] [data-scatter-point]').first().waitFor({ timeout: 5000 })
  const pts = await page.locator('[data-scatter-point]').count()
  const marked = await page.locator('[data-scatter-marked="true"]').count()
  const shapes = new Set(await page.locator('[data-scatter-point]').evaluateAll((els) => els.map((e) => e.getAttribute('data-scatter-shape'))))
  check(`${label}: the trade-off draws every kept plan once, the shown plans marked, shaped by deliveries`, pts === 12 && marked === 3 && shapes.size === 4, `points=${pts} marked=${marked} shapes=${[...shapes]}`)
  await page.screenshot({ path: `${SHOTS}/${dir}-solver-trade.png`, fullPage: true })

  // S4. what was tried
  await page.locator('[data-solver-diagram="tried"]').click()
  await page.locator('[data-solver-panel="tried"]').waitFor()
  const counts = await text(page.locator('[data-solver-counts]'))
  check(`${label}: the search counts as sent`, counts.includes('1,846') && counts.includes('212') && counts.includes('96'), counts)
  check(`${label}: ten kept plans, and "show more" for the rest`, (await page.locator('[data-solver-tried-row]').count()) === 10 && (await page.locator('[data-solver-show-more="2"]').count()) === 1)
  const lost = await text(page.locator('[data-solver-tried-row="2"] [data-solver-lost]'))
  check(`${label}: what a plan lost by and the part that cost it most`, lost.includes('1.450') && lost.includes(S.tried.part.WAITING), lost)
  await page.locator('[data-solver-show-more]').click()
  check(`${label}: "show more" lists every kept plan`, (await page.locator('[data-solver-tried-row]').count()) === 12)
  await page.locator('[data-solver-goal-pick="CHEAPEST"]').click()
  check(`${label}: another goal ranks its own kept plans`, (await page.locator('[data-solver-tried-row]').count()) === 2 && (await page.locator('[data-solver-show-more]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/${dir}-solver-tried.png`, fullPage: true })

  // S5. the flow graph: its chunk only when it opens
  check(`${label}: no request for the flow graph's chunk before it opens`, flowAsks.length === 0, flowAsks.join(' '))
  await page.locator('[data-sim-plan-pick="BALANCED"]').click()
  await page.locator('[data-solver-diagram="flow"]').click()
  await page.locator('[data-solver-flow] .react-flow__node').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(500)
  check(`${label}: opening the graph asks for its chunk`, flowAsks.length > 0, `${flowAsks.length} request(s)`)
  const nodes = await page.locator('.react-flow__node').count()
  const animated = await page.locator('.react-flow__edge.animated').count()
  const edges = await page.locator('.react-flow__edge').count()
  check(`${label}: the lines, the pairs, the shipment and the plan as boxes; the chosen path animated`, nodes === 11 && edges === 16 && animated === 5, `nodes=${nodes} edges=${edges} animated=${animated}`)
  check(
    `${label}: the controls, the mini-map and the library's attribution`,
    (await page.locator('.react-flow__controls').count()) === 1 && (await page.locator('.react-flow__minimap').count()) === 1 && (await page.locator('.react-flow__attribution').isVisible()),
  )
  const box = (id) => page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox()
  const line1 = await box('line:1')
  const planBox = await box('plan')
  check(`${label}: the columns run from the reading start`, dir === 'rtl' ? line1.x > planBox.x : line1.x < planBox.x, `line=${Math.round(line1.x)} plan=${Math.round(planBox.x)}`)
  const pair = page.locator('.react-flow__node[data-id="pair:1061:DAWAA_NOW"]')
  await pair.scrollIntoViewIfNeeded()
  const before = await pair.boundingBox()
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2 + 40, before.y + before.height / 2 + 60, { steps: 8 })
  await page.mouse.up()
  const after = await pair.boundingBox()
  check(`${label}: a box drags`, Math.abs(after.y - before.y) > 20, `dy=${Math.round(after.y - before.y)}`)
  await page.screenshot({ path: `${SHOTS}/${dir}-solver-flow.png`, fullPage: true })

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

async function drivePins(dir) {
  const W = WORDS[dir]
  const label = dir === 'rtl' ? 'RTL 963' : 'LTR 963'
  const money = (amount) => W.money.replace('{{amount}}', amount)

  // 18b. without the save grant the panel says it is needed
  {
    const { context, page } = await open(dir, { canSave: false })
    await page.goto(`${BASE}${SIM}`)
    await page.locator('[data-sim-weights] [data-weights-group]').first().waitFor({ timeout: 15000 })
    check(`${label}: without the save grant, no "save as" and the panel says the grant is needed`, (await page.locator('[data-weights-no-grant]').count()) === 1 && (await page.locator('[data-weights-save-open]').count()) === 0)
    await context.close()
  }

  const { context, page, errors, wire } = await open(dir)
  await page.goto(`${BASE}${SIM}`)
  await page.locator('[data-sim-weights] [data-weights-group]').first().waitFor({ timeout: 15000 })

  // 13. the panel opens on the candidate set, unchanged, and offers no switch for waiting per shipment
  const picker = page.locator('[data-weights-picker]')
  check(`${label}: the weight set opens on the candidate set, not changed`, (await picker.inputValue()) === JSON.stringify(['Baseline', 1]) && (await page.locator('[data-weights-changed]').count()) === 0)
  const reach = await page.locator('[data-weights-group="reach"] [data-weights-control]').evaluateAll((els) => els.map((e) => e.getAttribute('data-weights-control')))
  check(
    `${label}: Weights, Factors, Reach and shape — one fee per order a switch, and no switch for waiting on each shipment`,
    reach.join() === 'widerSlotReach,carrierModes,feePerOrder,pickUpInDeliveryPlan' &&
      (await page.locator('[data-weights-group="weights"] input[type="range"]').count()) === 6 &&
      (await page.locator('[data-weights-group="factors"] input[role="switch"]').count()) === 3,
    reach.join(),
  )

  await buildCart(page)
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-plan-cards]').waitFor({ timeout: 8000 })
  check(`${label}: before a pin, the pins panel says there are none`, (await page.locator('[data-pins-none]').count()) === 1)

  // 14. pin a line from the plan: its store, and another line's mode
  const ship = page.locator('[data-plan-card="BALANCED"] [data-plan-shipment="1"]')
  await ship.locator('[data-pin-line-store="3"]').click()
  await ship.locator('[data-pin-line-mode="2"]').click()
  const chips = await page.locator('[data-pin-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-pin-chip')))
  check(
    `${label}: pinning a line from a plan sets chips; the plans say they are stale until Run`,
    chips.join() === 'LINE_STORE:3:1090,LINE_MODE:2:DAWAA_NOW' && (await page.locator('[data-run-stale]').count()) === 1 && (await ship.locator('[data-pin-line-store="3"]').getAttribute('aria-pressed')) === 'true',
    chips.join(),
  )
  const PINNED = { ...REPLY, runId: '01JDM3P1N0000000000000000A', basedOnRun: REPLY.runId, figuresReadAt: '2026-11-26 19:42:03', refusedPins: PINS.refusedPins, withoutPins: PINS.withoutPins }
  wire.next.push(envelope(PINNED))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-figures-from]').waitFor({ timeout: 8000 })
  check(
    `${label}: a changed pin plans again on the same figures: basedOnRun with the pins, nothing of the cart`,
    JSON.stringify(wire.posts.at(-1)) === JSON.stringify({ basedOnRun: REPLY.runId, weightSet: { name: 'Baseline', version: 1 }, pins: PINS.pins, level: 'full', allPlans: true }),
    JSON.stringify(wire.posts.at(-1)),
  )
  const refused = page.locator('[data-pin-chip="LINE_MODE:2:DAWAA_NOW"]')
  const refusedText = await text(refused)
  check(
    `${label}: the refused pin stays listed with its reason, its step's code, the rule and its code`,
    (await refused.getAttribute('data-pin-refused')) === 'PIN_PAIR_REMOVED' &&
      refusedText.includes(W.pins.refused.PIN_PAIR_REMOVED.replace('{{step}}', '10')) &&
      refusedText.includes('PRODUCT_RULE') &&
      refusedText.includes('cold items: slot delivery and pick-up only') &&
      (await page.locator('[data-pin-chip="LINE_STORE:3:1090"][data-pin-refused]').count()) === 0,
    refusedText,
  )
  const costPart = (goal, part) => text(page.locator(`[data-plan-card="${goal}"] [data-pins-cost-part="${part}"] dd`))
  const cost = { minutes: await costPart('BALANCED', 'minutes'), fee: await costPart('BALANCED', 'fee'), companyCost: await costPart('BALANCED', 'companyCost'), deliveries: await costPart('BALANCED', 'deliveries') }
  check(
    `${label}: each plan shows what the pins cost it, from the run without pins`,
    cost.minutes === W.pins.cost.minutesValue.replace('{{n}}', '+15') &&
      cost.fee === money('0.000') &&
      cost.companyCost === money('+2.320') &&
      cost.deliveries === '0' &&
      (await page.locator('[data-plan-card="CHEAPEST"] [data-pins-cost="nothing"]').count()) === 1,
    JSON.stringify(cost),
  )
  const from = await text(page.locator('[data-run-figures-from]'))
  check(`${label}: "figures as read at …, from run …"`, from.includes('2026-11-26 19:42:03') && from.includes(REPLY.runId), from)
  const isoCost = page.locator('[data-plan-card="BALANCED"] [data-pins-cost-part="minutes"] dd bdi').first()
  const isoCode = refused.locator('[data-pin-reason] code bdi').last()
  check(
    `${label}: the pins' cost and the refused pin's code are Ltr isolates reading left to right`,
    (await isLtrIsolate(isoCost)) && (await isLtrIsolate(isoCode)) && (await readsLtr(isoCost)) === true && (await readsLtr(isoCode)) === true,
  )
  await page.locator('[data-plans-view-switch="table"]').click()
  check(`${label}: the table carries a row of what the pins cost`, (await page.locator('[data-plans-row="pinsCost"] [data-pins-cost]').count()) === 3)
  await page.locator('[data-plans-view-switch="cards"]').click()
  await page.screenshot({ path: `${SHOTS}/${dir}-pins.png`, fullPage: true })

  // 15. change a weight: "changed, not saved"; Run sends the draft in full on the same figures
  await slide(page.locator('[data-weights-control="companyCostWeight"] input[type="range"]'), 1.5)
  const shown = await text(page.locator('[data-weights-control="companyCostWeight"] [data-weights-value]'))
  check(`${label}: a changed weight marks "changed, not saved"`, (await page.locator('[data-weights-changed]').count()) === 1 && shown === '1.5' && (await page.locator('[data-run-stale]').count()) === 1, shown)
  const draftValues = { ...BASELINE_VALUES, companyCostWeight: 1.5 }
  const DRAFTED = { ...PINNED, runId: '01JDM3P1N0000000000000000B', basedOnRun: PINNED.runId, weightSet: { name: 'Baseline', version: 1, candidate: false, trial: false, draft: true, basedOn: { name: 'Baseline', version: 1 } } }
  wire.next.push(envelope(DRAFTED))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-draft]').waitFor({ timeout: 8000 })
  check(
    `${label}: a changed weight plans again on the same figures, the draft sent in full`,
    JSON.stringify(wire.posts.at(-1)) ===
      JSON.stringify({ basedOnRun: PINNED.runId, weightSet: { draft: { basedOn: { name: 'Baseline', version: 1 }, values: draftValues } }, pins: PINS.pins, level: 'full', allPlans: true }),
    JSON.stringify(wire.posts.at(-1)),
  )

  // 16. the held copy gone: ADVISE-404, then the cart runs again
  await page.locator('[data-weights-control="buffer"] input').uncheck()
  wire.next.push(refusal(404, 'ADVISE-404', 'Not found: run 01JDM3P1N0000000000000000B.'))
  wire.next.push(envelope({ ...REPLY, runId: '01JDM3P1N0000000000000000C', refusedPins: PINS.refusedPins, withoutPins: PINS.withoutPins }))
  const before404 = wire.posts.length
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-held-gone]').waitFor({ timeout: 8000 })
  const again = wire.posts.at(-1)
  check(
    `${label}: when the held copy is gone (ADVISE-404), the cart runs again with its pins and draft, and the screen says so`,
    wire.posts.length === before404 + 2 &&
      wire.posts.at(-2).basedOnRun === DRAFTED.runId &&
      again.channel === 'IOS' &&
      !('basedOnRun' in again) &&
      JSON.stringify(again.pins) === JSON.stringify(PINS.pins) &&
      again.weightSet?.draft?.values?.buffer === false &&
      (await page.locator('[data-run-error-code]').count()) === 0,
    JSON.stringify(again),
  )

  // 17. a change that needs a wider read is read afresh, and the screen says so
  await page.locator('[data-weights-control="carrierModes"] input').check()
  const why = 'a mode switched on: CARRIER_SAME_DAY'
  wire.next.push(envelope({ ...REPLY, runId: '01JDM3P1N0000000000000000D', solve: { ...REPLY.solve, marks: ['ASSUMED_RATES', 'READ_AFRESH'], readAfreshWhy: why }, refusedPins: PINS.refusedPins, withoutPins: PINS.withoutPins }))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-read-afresh]').waitFor({ timeout: 8000 })
  check(
    `${label}: a change that needed a wider read says it was read afresh, with the server's why`,
    wire.posts.at(-1).basedOnRun === '01JDM3P1N0000000000000000C' && (await text(page.locator('[data-run-read-afresh-why]'))) === why && (await page.getByText(W.replan.readAfresh).count()) === 1,
  )

  // 18. save as a named set
  await page.locator('[data-weights-save-open]').click()
  await page.locator('[data-weights-save-name]').fill('Late evenings')
  await page.locator('[data-weights-save-confirm]').click()
  // The list is read again after the save, so the picker names the new set once it holds it.
  await page
    .waitForFunction(
      (want) => document.querySelectorAll('[data-weights-changed]').length === 0 && document.querySelector('[data-weights-picker]')?.value === want,
      JSON.stringify(['Late evenings', 1]),
      { timeout: 8000 },
    )
    .catch(() => {})
  const saved = wire.saves.at(-1)
  check(
    `${label}: "save as a named set" sends the name, the version it came from and the whole draft`,
    JSON.stringify(saved) ===
      JSON.stringify({ name: 'Late evenings', basedOn: { name: 'Baseline', version: 1 }, values: { ...draftValues, buffer: false, carrierModes: true } }),
    JSON.stringify(saved),
  )
  check(
    `${label}: after the save the picker names the new set, no longer changed`,
    (await picker.inputValue()) === JSON.stringify(['Late evenings', 1]) && (await page.locator('[data-weights-changed]').count()) === 0,
    await picker.inputValue(),
  )
  wire.next.push(envelope({ ...REPLY, runId: '01JDM3P1N0000000000000000E', weightSet: { name: 'Late evenings', version: 1, candidate: false, trial: false, draft: false }, refusedPins: PINS.refusedPins, withoutPins: PINS.withoutPins }))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-figures-from], [data-run-summary]').first().waitFor({ timeout: 8000 })
  await page.waitForTimeout(900)
  check(`${label}: the next Run names the saved set`, JSON.stringify(wire.posts.at(-1).weightSet) === JSON.stringify({ name: 'Late evenings', version: 1 }), JSON.stringify(wire.posts.at(-1)))
  await page.screenshot({ path: `${SHOTS}/${dir}-weights.png`, fullPage: true })

  // 19. pins that leave no plan: one banner naming them
  await page.locator('[data-pins-one-shipment] input').check()
  const one = { kind: 'ONE_SHIPMENT' }
  const CLASH = {
    ...REPLY,
    runId: '01JDM3P1N0000000000000000F',
    plans: [],
    noPlan: ['BALANCED', 'FASTEST', 'FEWEST', 'CHEAPEST', 'PICK_UP'].map((goal) => ({ goal, code: 'PINS_CLASH', en: 'These pins leave no plan', ar: 'هذه التثبيتات لا تترك خطة' })),
    refusedPins: [PINS.refusedPins[0], { pins: [PINS.pins[0], one], code: 'PINS_CLASH', rule: 'no single store holds the whole cart with line 3 from 1090' }],
    withoutPins: PINS.withoutPins,
  }
  wire.next.push(envelope(CLASH))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-pins-clash]').waitFor({ timeout: 8000 })
  const clash = await page.locator('[data-pins-clash-pin]').evaluateAll((els) => els.map((e) => e.textContent.replace(/[\u2066-\u2069]/g, '').trim()))
  check(
    `${label}: pins that leave no plan raise one banner naming them and the rule`,
    (await page.locator('[data-pins-clash]').count()) === 1 &&
      clash.join('|') === [W.pins.chip.LINE_STORE.replace('{{line}}', '3').replace('{{store}}', '1090'), W.pins.chip.ONE_SHIPMENT].join('|') &&
      (await text(page.locator('[data-pins-clash-rule]'))) === CLASH.refusedPins[1].rule,
    clash.join('|'),
  )

  // 20. a trial set: the panel's mark, and the run's banner
  await picker.selectOption(JSON.stringify(['Carriers on', 2]))
  await page.locator('[data-weights-trial]').waitFor({ timeout: 8000 })
  wire.next.push(envelope({ ...REPLY, runId: '01JDM3P1N0000000000000000G', weightSet: { name: 'Carriers on', version: 2, candidate: false, trial: true, draft: false }, plans: REPLY.plans.map((p) => ({ ...p, trialSet: true })) }))
  await page.locator('[data-sim-run]').click()
  await page.locator('[data-run-trial-set]').waitFor({ timeout: 8000 })
  check(
    `${label}: a trial set carries the panel's mark and the run's banner`,
    (await page.locator('[data-weights-trial]').count()) === 1 && (await page.locator('[data-run-trial-set]').count()) === 1 && JSON.stringify(wire.posts.at(-1).weightSet) === JSON.stringify({ name: 'Carriers on', version: 2 }),
    JSON.stringify(wire.posts.at(-1)),
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-trial.png`, fullPage: true })

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
  await drivePins('ltr')
  await drivePins('rtl')
  await solverDrive('ltr')
  await solverDrive('rtl')
} catch (e) {
  console.error(e)
  results.push({ name: 'the drive ran to its end', pass: false })
}
await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
