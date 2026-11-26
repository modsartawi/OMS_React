// Sourcing simulator drive (ticket 962, BackOffice spec 4354 §19) — build a cart, run it, switch cards to table.
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

async function open(dir, { granted = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4|5)\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  const wire = { posts: [], calls: [], next: [], whyNot: [] }
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
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', 'SourcingAdvisor:01', ...(granted ? [RUN_GRANT] : [])]))
    if (p === 'SourcingAdvisor/Workbench') return route.fulfill(envelope({ maps: null }))
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

try {
  await drive('ltr')
  await drive('rtl')
} catch (e) {
  console.error(e)
  results.push({ name: 'the drive ran to its end', pass: false })
}
await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
