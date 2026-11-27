// Comparison results drive (tickets 971, 972, 973; BackOffice spec 4354 §16–§18) — drives the REAL app against a
// STUBBED wire in the shapes of the REAL doors (BackOffice 4393 results, 4394 trials, 4396 phase 2 bar, pricing2
// 35a4e56be). The stubs are the replies the model tests read: `src/features/oms/sourcing-results/stub-first.json`
// (Top, Panels, Differ), `stub-tabs.json` (the five reading tabs), `stub-trials.json`, `stub-bar.json`, and
// `stub-codes.json` (the server's own code list, `Results/Codes`).
//
// Left to right and right to left (`oms.locale = 'ar'` sets dir="rtl"; the app's words stay English, as on every
// screen, so the RTL pass proves the mirroring and the isolation), asserts:
//   1. the page opens under the advisor view grant (`SourcingAdvisor:01`), and says no access without it;
//   2. the first screen reads Top, Panels and Differ with the filter bar's query names; the sentence, the seven segments
//      ("breaks the nesting" first), the two brackets over the segments the server names, the line under the bar;
//   3. the three panels: the promise check's pills, the express stamp, the cost notice in counts, rates worded by the
//      code list, no riyal figure, a mark with no orders greyed and a mark's count opening through `mark=`;
//   4. "Where the plans differ" per view (`Differ?view=`), a minus read as the advisor earlier, an ending opening its orders;
//   5. a segment opens its orders (`segment=`, `page`, `pageSize`, `sort`, `desc`); the list sorts and pages;
//   6. one order's card: the whole plan, the stores only and what happened, its riyal figures each with a source;
//      "Open the stored run in the simulator" only under the run grant (`SourcingSimulator:03`), opening `?run=`;
//   7. the filters re-read the doors (period, `runMark`, `shortFigure`, `set` + `version`); the seven tabs;
//   8. Trials: the list, a result with its refusals in the server's order, the factor table's fifteen rows; the form
//      refuses 31 days and starts a trial on 14 (`{name, version, from, to}`, days `yyyy-MM-dd 00:00:00`); the result
//      opens beside the candidate's trial (`Trials/Beside?trialId=&otherId=`): banner, two thin bars, kinds, estimate,
//      promise under the set; removed;
//   9. Phase 2 bar: its picker (28 days, channel group, step), the nine limits with state and why (the server's words),
//      figures isolated, read-only figures apart, a largest difference marked, a ruling written and the split check
//      recorded through `Close`, the reading accepted with a note through `Accept`;
//  10. the five reading tabs on their doors, every figure that opens orders sending the server's figure names;
//  11. no page error and no raw key.
//
//   1. run the app:  npx vite --port 5203 --strictPort
//   2. DRIVE_PORT=5203 node tools/sourcing-results-drive.mjs
//      (PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`
const SHOTS = 'tools/.sourcing-results-shots'
mkdirSync(SHOTS, { recursive: true })

const read = (name) => JSON.parse(readFileSync(`src/features/oms/sourcing-results/${name}`, 'utf8'))
const FIRST = read('stub-first.json')
const TABS = read('stub-tabs.json')
const TRIALS = read('stub-trials.json')
const BAR = read('stub-bar.json')
const CODES = read('stub-codes.json')
const TRIAL_SET = '01JE2A5M4N3B2V1C0X9Z8L7K6J'
const CANDIDATE = '01JE1Z9Y8X7W6V5T4S3R2Q1P0N'
const RUN_ID = '01JDQ7Y3K2M5N8P0R4S6T9V1WX'
/** The grants (the save and mark keys are the weight-set screens' until their reconciliation names them). */
const VIEW = 'SourcingAdvisor:01'
const SAVE = 'SourcingAdvisorSave:01'
const MARK = 'SourcingAdvisorMark:06'
const RUN = 'SourcingSimulator:03'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

// ── the orders behind a figure, and one order (BO 4393 `OrderListRow`, `ResultsOrderCard`) ────────────────
const CLASSES = ['SAME_PLAN', 'ANOTHER_STORE', 'ANOTHER_MODE', 'FEWER_SHIPMENTS', 'OUTSIDE_RULES']
const CHANNELS = ['IOS', 'ROID', 'WEB', 'CC']
const CITIES = ['Riyadh', 'Jeddah', 'الدمام', 'Makkah']
const ENDINGS = ['ON_TIME', 'ON_TIME', 'LATE', 'RETURNED', 'CANCELLED', 'CUSTOMER_CANCELLED']
const ORDER_TOTAL = 137
const orderRows = (q) => {
  const page = Number(q.page), pageSize = Number(q.pageSize)
  const from = (page - 1) * pageSize
  const rows = []
  for (let i = from; i < Math.min(ORDER_TOTAL, from + pageSize); i++) {
    const cls = q.segment === 'ANOTHER_STORE' ? 'ANOTHER_STORE' : CLASSES[i % CLASSES.length]
    rows.push({
      orderNumber: String(4500718000 + i),
      landedAt: `2026-11-${String(13 + (i % 14)).padStart(2, '0')}T${String(8 + (i % 14)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
      channel: CHANNELS[i % CHANNELS.length],
      channelGroup: 'APP_SITE',
      city: CITIES[i % CITIES.length],
      wholeClass: cls,
      storesClass: cls === 'ANOTHER_MODE' ? 'SAME_PLAN' : cls,
      segment: q.segment ?? 'SAME_PLAN_BOTH',
      wholeEstimate: cls === 'OUTSIDE_RULES' || cls === 'SAME_PLAN' ? null : -6 + (i % 9) - 4,
      storesEstimate: cls === 'OUTSIDE_RULES' || cls === 'SAME_PLAN' ? null : -3,
      ending: ENDINGS[i % ENDINGS.length],
      marks: [],
      shortFigure: i % 11 === 0,
      runId: RUN_ID,
    })
  }
  return { filter: FIRST.top.filter, total: ORDER_TOTAL, page, pageSize, sort: q.sort ?? 'LANDED', desc: q.desc === 'true', rows }
}
const shipment = (o) => ({
  no: 1, deliveryNo: '', store: 'P901', mode: 'DAWAA_NOW', lines: [1, 2], slotFrom: null, slotTo: null, promisedBy: '2026-11-20T15:02:00',
  matched: true, promiseChecked: true, withinPromise: true, handedOverAt: null, distanceBand: 'KM_2_4', ending: '', cancelledBy: '', late: false,
  stockChecked: false, covered: false, failedPick: false, listFee: 15, feePaid: null, feeSource: 'RULE_TABLE', ...o,
})
const orderCard = (orderNumber) => ({
  orderNumber, landedAt: '2026-11-20T14:10:00', channel: 'IOS', channelGroup: 'APP_SITE', city: 'Riyadh', runId: RUN_ID, madeBy: 'CHANNEL', ownRunReason: '',
  ranAt: '2026-11-20T14:10:04', weightSetName: 'Baseline', weightSetVersion: 3, wholeClass: 'ANOTHER_STORE', storesClass: 'ANOTHER_STORE', segment: 'ANOTHER_STORE',
  notComparableWhy: '', outsideCode: '', outsideStepCode: '', outsideRule: '', outsideLineNo: 0, outsideStore: '', outsideMode: '', wholeEstimate: -9, storesEstimate: -7,
  ending: 'LATE', marks: ['ASSUMED_RATES'], shortFigureLines: 0, asItStands: false, halfCancelled: false, expressToFallback: false, handMoved: false, ownSplit: '',
  laterSlotCheaper: false, pairsBeforeCut: 120, pairsCut: 20, feeCompared: 'SAME',
  wholeListFee: { amount: 15, source: 'RULE_TABLE' }, realListFee: { amount: 15, source: 'RULE_TABLE' }, feePaid: { amount: 15, source: 'PAID' },
  wholeCompanyCost: null, realCompanyCost: null,
  wholePlan: [shipment({})],
  storesOnly: [shipment({ store: 'P901' })],
  deliveries: [shipment({ no: 1, deliveryNo: '8000000253', store: 'P910', handedOverAt: '2026-11-20T15:21:00', ending: 'DELIVERED', late: true, listFee: null, feePaid: 15, feeSource: 'PAID' })],
})

// ── the trial and bar doors' answers (BO 4394, 4396; record JSON) ──────────────────────────────────────
const factorRowsIdle = () => TRIALS.factorTable.rows.map((r) => ({ ...r, trialId: '', state: '', compared: 0, plansChanged: 0, share: 0, kinds: {} }))
const newTrial = (b, id) => ({
  ...TRIALS.trials[0], trialId: id, name: b.name, version: b.version, from: b.from, to: b.to, state: 'WAITING', ahead: 1, startedBy: 'msartawi',
  addedAt: '2026-11-27 09:00:00', repeat: false, trialSet: false, besideCandidate: 'Baseline', besideCandidateVersion: 3,
})

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────
const isLtrIsolate = (locator) => locator.evaluate((el) => !!el.closest('bdi[dir="ltr"]') || !!el.querySelector('bdi[dir="ltr"]'))
/** Text with its isolates (FSI…PDI, from `fsi()` in a `t()` sentence) taken out, to match words around a figure. */
const plain = (text) => text.replace(/[⁦-⁩]/g, '')
const sameFields = (a, b) => !!a && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
const box = async (locator) => (await locator.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
/** The server's English words for a code (the app's language stays English). */
const words = (family, code) => CODES.find((c) => c.family === family && c.code === code)?.en ?? code

async function scenario(browser, lang) {
  const tag = `[${lang}]`
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await context.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'false')
  }, lang)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  const wire = {
    asks: {},
    grant: true,
    runGrant: false,
    opens: [],
    trials: structuredClone(TRIALS.trials),
    starts: [],
    tables: [],
    besides: [],
    bars: [],
    bar: structuredClone(BAR),
    closes: [],
    accepts: [],
  }
  const asked = (door, q) => ((wire.asks[door] ??= []).push(q), q)
  const last = (door) => wire.asks[door]?.at(-1)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    const q = Object.fromEntries(url.searchParams)
    const body = () => JSON.parse(route.request().postData() || '{}')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(wire.grant ? [VIEW, SAVE, MARK, ...(wire.runGrant ? [RUN] : [])] : []))
    // The simulator a stored run's link opens: its read door answers the run is not there.
    if (p === 'SourcingAdvisor/Runs/Open') {
      wire.opens.push(q.runId)
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ statusCode: 404, success: false, message: 'Run not found', errors: [{ errorCode: 'ADVISE-404', internalErrorCode: '', errorMessage: 'Run not found' }], data: null }) })
    }
    if (p === 'SourcingAdvisor/WeightSets') return route.fulfill(envelope([]))
    if (p === 'SourcingAdvisor/Results/Codes') return route.fulfill(envelope(CODES))
    const echo = (reply) => ({ ...reply, filter: { ...reply.filter, period: q.period ?? 'DAYS_7', channelGroup: q.channelGroup ?? 'ALL' } })
    if (p === 'SourcingAdvisor/Results/Top') return route.fulfill(envelope(echo(FIRST.top, asked('top', q))))
    if (p === 'SourcingAdvisor/Results/Panels') return route.fulfill(envelope(echo(FIRST.panels, asked('panels', q))))
    if (p === 'SourcingAdvisor/Results/Differ') return route.fulfill(envelope(echo(FIRST.differ[asked('differ', q).view ?? 'WHOLE_PLAN'])))
    if (p === 'SourcingAdvisor/Results/Breakdown') return route.fulfill(envelope(TABS.breakdowns[asked('breakdown', q).by ?? 'MODE']))
    if (p === 'SourcingAdvisor/Results/Outside') return route.fulfill(envelope(TABS.outside, asked('outside', q)))
    if (p === 'SourcingAdvisor/Results/Checks') return route.fulfill(envelope(TABS.checks, asked('checks', q)))
    if (p === 'SourcingAdvisor/Results/LaterSlots') return route.fulfill(envelope(TABS.laterSlots, asked('laterSlots', q)))
    if (p === 'SourcingAdvisor/Results/NotRun') return route.fulfill(envelope(TABS.notRun, asked('notRun', q)))
    if (p === 'SourcingAdvisor/Results/Orders') return route.fulfill(envelope(orderRows(asked('orders', q))))
    if (p === 'SourcingAdvisor/Results/Order') return route.fulfill(envelope(orderCard(asked('order', q).orderNumber)))
    // ── trials ──
    if (p === 'SourcingAdvisor/Trials') return route.fulfill(envelope(wire.trials))
    if (p === 'SourcingAdvisor/Trials/Start') {
      const b = body()
      wire.starts.push(b)
      const row = newTrial(b, `01JE4NEWTRIAL${String(wire.starts.length).padStart(13, '0')}`)
      wire.trials.push(row)
      return route.fulfill(envelope(row))
    }
    if (p === 'SourcingAdvisor/Trials/FactorTable') {
      if (route.request().method() === 'POST') {
        const b = body()
        wire.tables.push(b)
        return route.fulfill(envelope({ trial: TRIALS.trials[4], rows: factorRowsIdle().map((r) => ({ ...r, state: 'WAITING' })) }))
      }
      const trial = wire.trials.find((t) => t.trialId === q.trialId)
      return route.fulfill(envelope(q.trialId === TRIAL_SET ? TRIALS.factorTable : { trial, rows: factorRowsIdle() }))
    }
    if (p === 'SourcingAdvisor/Trials/Beside') {
      wire.besides.push(q)
      return route.fulfill(envelope(TRIALS.beside))
    }
    // ── the phase 2 bar ──
    const barReply = (query) => {
      const from = query.from ?? '2026-10-30'
      const to = new Date(Date.parse(from) + 28 * 86400000).toISOString().slice(0, 10)
      return { ...wire.bar, reading: { ...wire.bar.reading, from: `${from} 00:00:00`, to: `${to} 00:00:00`, channelGroup: query.channelGroup ?? 'APP_SITE', step: query.step ?? 'STORES_ONLY' } }
    }
    if (p === 'SourcingAdvisor/Results/Phase2Bar') {
      wire.bars.push(q)
      return route.fulfill(envelope(barReply(q)))
    }
    if (p === 'SourcingAdvisor/Results/Phase2Bar/Close') {
      const b = body()
      wire.closes.push(b)
      const close = { kind: b.kind, key: b.key, mark: b.mark, text: b.text, by: 'msartawi', at: '2026-11-27 09:12:00' }
      const r = wire.bar.reading
      if (b.kind === 'ORDER') for (const o of r.largestDifferences.filter((x) => x.orderNumber === b.key)) Object.assign(o, { mark: b.mark, markedBy: 'msartawi', markedAt: close.at })
      if (b.kind === 'SHELF_CHANCE') Object.assign(r.shelfChance.find((s) => `${s.mode}|${s.stockClass}` === b.key) ?? {}, { ruling: close })
      if (b.kind === 'SPLIT_CHECK') r.splitCheck = close
      return route.fulfill(envelope(barReply({ from: b.from, channelGroup: b.channelGroup })))
    }
    if (p === 'SourcingAdvisor/Results/Phase2Bar/Accept') {
      const b = body()
      wire.accepts.push(b)
      const kept = { id: '01JE5KEPT0000000000000000', from: `${b.from} 00:00:00`, to: '2026-11-27 00:00:00', channelGroup: b.channelGroup, step: b.step, candidateName: 'Baseline', candidateVersion: 3, met: false, note: b.note, readBy: 'owner.dmsco', readAt: '2026-11-27 09:20:00' }
      wire.bar.kept = [...wire.bar.kept, kept]
      return route.fulfill(envelope(kept))
    }
    return route.fulfill(envelope({}))
  })

  // 1. without the grant: the denial
  if (lang === 'en') {
    wire.grant = false
    await page.goto(`${BASE}/oms/sourcing-results`)
    await page.getByRole('alert').first().waitFor({ timeout: 15000 })
    const denied = await page.getByRole('alert').first().innerText()
    check(`${tag} without the advisor view grant the page says no access`, /No access to the comparison results/.test(denied), denied.slice(0, 80))
    wire.grant = true
  }

  await page.goto(`${BASE}/oms/sourcing-results`)
  await page.locator('[data-results-top]').waitFor({ timeout: 15000 })
  await page.locator('[data-results-differ]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(300)
  const top0 = wire.asks.top?.[0]
  check(
    `${tag} the first screen reads Top, Panels and Differ: 14 days of all three channel groups, the whole plan`,
    top0?.period === 'DAYS_14' && top0?.channelGroup === 'ALL' && wire.asks.panels?.[0]?.period === 'DAYS_14' && wire.asks.differ?.[0]?.view === 'WHOLE_PLAN',
    JSON.stringify({ top: top0, differ: wire.asks.differ?.[0] }),
  )
  const dir = await page.evaluate(() => document.documentElement.dir)
  check(`${tag} the page direction`, dir === (lang === 'ar' ? 'rtl' : 'ltr'), dir)
  check(`${tag} the period read, from the reply's echo`, (await page.locator('[data-results-period]').innerText()).includes('2026-11-26'))

  // 2. the sentence, the bar, the brackets
  const sentence = await page.locator('[data-results-sentence]').innerText()
  check(`${tag} the sentence carries the orders compared and the two brackets' shares`, sentence.includes('39,870') && sentence.includes('77.5%') && sentence.includes('68.8%'), sentence)
  check(`${tag} the sentence's figures are isolated LTR`, (await page.locator('[data-results-sentence] bdi[dir="ltr"]').count()) === 3)
  const segments = await page.locator('[data-segment]').evaluateAll((els) => els.map((e) => e.getAttribute('data-segment')))
  check(
    `${tag} the bar draws the seven segments, "breaks the nesting" first`,
    JSON.stringify(segments) === JSON.stringify(['BREAKS_NESTING', 'SAME_PLAN_BOTH', 'SAME_STORES_OTHER_WAY', 'ANOTHER_STORE', 'CALLOUT_FALLBACK', 'OUTSIDE_RULES', 'NOT_COMPARABLE']),
    segments.join(','),
  )
  const seg = async (s) => box(page.locator(`[data-segment="${s}"]`))
  const [s1, s2, s3, sLast] = [await seg('BREAKS_NESTING'), await seg('SAME_PLAN_BOTH'), await seg('SAME_STORES_OTHER_WAY'), await seg('NOT_COMPARABLE')]
  check(`${tag} the first segment stands at the reading start`, lang === 'ar' ? s1.x > sLast.x : s1.x < sLast.x, `first.x=${Math.round(s1.x)} last.x=${Math.round(sLast.x)}`)
  const spanOf = (a, b) => Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x)
  const planBox = await box(page.locator('[data-bracket="plan"]'))
  const storesBox = await box(page.locator('[data-bracket="stores"]'))
  check(
    `${tag} the whole plan's bracket spans "breaks the nesting" and "same plan"; the stores only's, "same plan" and "same stores"`,
    Math.abs(planBox.width - spanOf(s1, s2)) < 4 && Math.abs(storesBox.width - spanOf(s2, s3)) < 4,
    `plan=${Math.round(planBox.width)} vs ${Math.round(spanOf(s1, s2))}, stores=${Math.round(storesBox.width)} vs ${Math.round(spanOf(s2, s3))}`,
  )
  const hatch = await page.locator('[data-segment="CALLOUT_FALLBACK"]').evaluate((el) => getComputedStyle(el).backgroundImage)
  check(`${tag} the callout fallback is hatched`, hatch.includes('repeating-linear-gradient'))
  const runs = await page.locator('[data-results-runs]').innerText()
  check(`${tag} the line under the bar: landed, run and not ended yet, not run — plain counts`, runs.includes('43,512') && runs.includes('2,310') && runs.includes('1,332') && (await page.locator('[data-results-runs] [data-drill]').count()) === 0, runs)
  check(`${tag} the segments add up: no mismatch note`, (await page.locator('[data-results-mismatch]').count()) === 0)
  check(`${tag} a legend count is an LTR isolate`, await isLtrIsolate(page.locator('[data-drill="segment:ANOTHER_STORE"] bdi').first()))

  // 3. the panels
  const states = await page.locator('[data-results-panel="promise"] [data-promise-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-promise-row')}=${e.getAttribute('data-promise-state')}`))
  check(`${tag} the promise check: Dawaa Now inside the band, pick-up two rows with a target and no band`, JSON.stringify(states) === JSON.stringify(['DAWAA_NOW=inside', 'PICK_UP:APP_SITE=target', 'PICK_UP:CALL_CENTRE=target']), states.join(' '))
  check(`${tag} Dawaa Now carries the express stamp's own share`, (await page.locator('[data-results-panel="promise"] [data-promise-row="DAWAA_NOW"]').innerText()).includes('92.1%'))
  const notice = await page.locator('[data-cost-notice]').innerText()
  check(`${tag} the cost notice: no riyal total, 5 of 6 rates assumed`, notice.includes('No riyal total') && notice.includes('5') && notice.includes('6'), notice)
  const rates = await page.locator('[data-cost-rates]').innerText()
  check(`${tag} the rates in the code list's words, a real one with its source`, rates.includes(words('MONEY_ROW', 'DELIVERY_RATE')) && rates.includes(words('SOURCE', 'MEASURED')), rates.replace(/\s+/g, ' '))
  const fee = await page.locator('[data-cost-fee]').innerText()
  check(`${tag} the list fee compared order by order, in counts`, ['37,800', '1,474', '35,305', '1,021'].every((n) => fee.includes(n)), fee)
  check(`${tag} no riyal figure anywhere on the page`, !/SAR\s*\d|\d\s*SAR|ر\.س/.test(await page.locator('[data-sourcing-results]').innerText()))
  check(`${tag} a mark with no orders in the period is greyed`, (await page.locator('[data-mark="NO_ROUTING_EQUIVALENT"][data-mark-none]').count()) === 1)
  check(`${tag} the marks the server sends, its new ones worded`, (await page.locator('[data-mark="AS_IT_STANDS"]').innerText()).includes('Compared as it stands'))

  // 4. where the plans differ
  const wholeRows = await page.locator('[data-differ-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-differ-row')))
  check(
    `${tag} the whole plan's rows in the server's order, same plan last as the reference`,
    JSON.stringify(wholeRows) === JSON.stringify(['ANOTHER_MODE', 'FEWER_SHIPMENTS', 'MORE_SHIPMENTS', 'ANOTHER_STORE', 'OUTSIDE_RULES', 'CALLOUT_FALLBACK', 'SAME_PLAN']),
    wholeRows.join(','),
  )
  check(`${tag} a minus reads as the advisor's plan arriving earlier`, /arrives 6 min earlier/.test(plain(await page.locator('[data-differ-row="ANOTHER_STORE"] [data-differ-estimate]').innerText())))
  check(`${tag} a plus reads as later`, /arrives 40 min later/.test(plain(await page.locator('[data-differ-row="FEWER_SHIPMENTS"] [data-differ-estimate]').innerText())))
  check(`${tag} outside the rules has no estimate, and says why`, (await page.locator('[data-differ-row="OUTSIDE_RULES"] [data-differ-estimate="none"]').count()) === 1)
  check(`${tag} the fixed note stands under the table`, (await page.locator('[data-differ-note]').innerText()).length > 80)
  const hatchedEnding = await page.locator('[data-differ-row="ANOTHER_STORE"] [data-ending="CUSTOMER_CANCELLED"]').evaluate((el) => getComputedStyle(el).backgroundImage)
  check(`${tag} the customer's own cancellation is hatched`, hatchedEnding.includes('repeating-linear-gradient'))
  await page.screenshot({ path: `${SHOTS}/${lang}-page.png`, fullPage: true })
  await page.locator('[data-differ-row="ANOTHER_STORE"] [data-drill="class:WHOLE_PLAN:ANOTHER_STORE:LATE"]').click()
  await page.locator('dialog[open][data-results-drawer="class:WHOLE_PLAN:ANOTHER_STORE:LATE"]').waitFor({ timeout: 10000 })
  check(`${tag} an ending's count opens its orders by view, class and ending`, sameFields(pick(last('orders'), ['view', 'class', 'ending']), { view: 'WHOLE_PLAN', class: 'ANOTHER_STORE', ending: 'LATE' }), JSON.stringify(last('orders')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await page.locator('[data-differ-view="STORES_ONLY"]').click()
  await page.locator('[data-results-differ="STORES_ONLY"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)
  const storesRows = await page.locator('[data-differ-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-differ-row')))
  check(`${tag} the stores only reads its own door: another store, outside the rules, the callout fallback, same plan`, last('differ')?.view === 'STORES_ONLY' && JSON.stringify(storesRows) === JSON.stringify(['ANOTHER_STORE', 'OUTSIDE_RULES', 'CALLOUT_FALLBACK', 'SAME_PLAN']), storesRows.join(','))
  check(`${tag} the view is kept in the URL`, page.url().includes('view=STORES_ONLY'), page.url())

  // 5. a segment opens its orders
  await page.locator('[data-segment="ANOTHER_STORE"]').click()
  const drawer = page.locator('dialog[open][data-results-drawer]')
  await drawer.waitFor({ timeout: 10000 })
  await drawer.locator('[data-order-row]').first().waitFor({ timeout: 10000 })
  check(
    `${tag} the segment opens its orders: segment, the first page of 25, newest first`,
    sameFields(pick(last('orders'), ['segment', 'page', 'pageSize', 'sort', 'desc', 'period']), { segment: 'ANOTHER_STORE', page: '1', pageSize: '25', sort: 'LANDED', desc: 'true', period: 'DAYS_14' }),
    JSON.stringify(last('orders')),
  )
  check(`${tag} the drawer lists one page of 25`, (await drawer.locator('[data-order-row]').count()) === 25)
  check(`${tag} the class columns sort nothing: no sort button on them`, (await drawer.locator('[data-sort]').count()) === 6)
  await drawer.locator('[data-sort="ORDER"]').click()
  await page.waitForTimeout(400)
  check(`${tag} a column header sorts the list`, last('orders')?.sort === 'ORDER' && last('orders')?.desc === 'false', JSON.stringify(last('orders')))
  await drawer.locator('nav button').last().click()
  await page.waitForTimeout(400)
  check(`${tag} the pager asks for the next page`, last('orders')?.page === '2', JSON.stringify(last('orders')))
  check(`${tag} an order number is an LTR isolate`, await isLtrIsolate(drawer.locator('[data-order] bdi').first()))

  // 6. one order
  const orderNo = await drawer.locator('[data-order]').first().getAttribute('data-order')
  await drawer.locator('[data-order]').first().click()
  await drawer.locator('[data-order-card]').waitFor({ timeout: 10000 })
  check(`${tag} the card reads the chosen order`, last('order')?.orderNumber === orderNo, `${orderNo}`)
  const plan = await drawer.locator('[data-card-side="whole-plan"]').innerText()
  const happened = await drawer.locator('[data-card-side="happened"]').innerText()
  check(`${tag} the advisor's plan beside what happened, the stores only between`, plan.includes('P901') && happened.includes('P910') && (await drawer.locator('[data-card-side="stores-only"]').count()) === 1, `${plan.replace(/\n/g, ' ')} | ${happened.replace(/\n/g, ' ')}`)
  const dashed = await drawer.locator('[data-card-side="happened"]').evaluate((el) => getComputedStyle(el).borderStyle)
  check(`${tag} what happened sits in a dashed box`, dashed.includes('dashed'), dashed)
  const money = await drawer.locator('[data-card-money]').innerText()
  check(`${tag} the order's riyal figures each with its source, unknown ones said so`, money.includes('15.00') && money.includes(words('MONEY_SOURCE', 'PAID')) && money.includes('not known'), money.replace(/\s+/g, ' '))
  await page.screenshot({ path: `${SHOTS}/${lang}-drawer.png` })
  check(`${tag} "Open the stored run in the simulator" is not offered under the view grant alone`, (await drawer.locator('[data-open-simulator]').count()) === 0)

  wire.runGrant = true
  await page.goto(`${BASE}/oms/sourcing-results`)
  await page.locator('[data-results-top]').waitFor({ timeout: 15000 })
  await page.locator('[data-segment="ANOTHER_STORE"]').click()
  await drawer.locator('[data-order]').first().waitFor({ timeout: 10000 })
  await drawer.locator('[data-order]').first().click()
  await drawer.locator('[data-order-card]').waitFor({ timeout: 10000 })
  const opener = drawer.locator('[data-open-simulator]')
  check(`${tag} with the run grant (${RUN}) it is offered, naming the order's run`, (await opener.getAttribute('data-open-simulator')) === RUN_ID)
  await opener.click()
  await page.waitForURL(new RegExp(`/oms/sourcing-simulator\\?run=${RUN_ID}$`), { timeout: 10000 })
  await page.locator('[data-stored-gone]').waitFor({ timeout: 15000 })
  check(`${tag} it opens the simulator on the stored run, which asks Runs/Open for it`, wire.opens.at(-1) === RUN_ID, JSON.stringify(wire.opens))
  wire.runGrant = false

  // 7. a mark's count, the filters, the tabs
  await page.goto(`${BASE}/oms/sourcing-results`)
  await page.locator('[data-results-top]').waitFor({ timeout: 15000 })
  await page.locator('[data-drill="mark:RANGE_NOT_CONFIRMED"]').click()
  await page.locator('dialog[open][data-results-drawer="mark:RANGE_NOT_CONFIRMED"]').waitFor({ timeout: 10000 })
  check(`${tag} a mark's count opens its orders through the filter's own mark`, last('orders')?.mark === 'RANGE_NOT_CONFIRMED' && last('orders')?.segment === undefined, JSON.stringify(last('orders')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check(`${tag} Escape closes the drawer`, (await page.locator('dialog[open][data-results-drawer]').count()) === 0)
  const before = wire.asks.top.length
  await page.locator('[data-period="DAYS_30"]').click()
  await page.locator('[data-filter="run-mark"]').selectOption('ROAD_NOT_MEASURED')
  await page.locator('[data-filter="short-figure"]').click()
  await page.waitForTimeout(600)
  const ask = last('top')
  check(
    `${tag} the filters re-read the doors: 30 days, one run mark, a line the stock figure could not cover`,
    wire.asks.top.length > before && ask?.period === 'DAYS_30' && ask?.runMark === 'ROAD_NOT_MEASURED' && ask?.shortFigure === 'true' && last('panels')?.runMark === 'ROAD_NOT_MEASURED',
    JSON.stringify(ask),
  )
  const setOptions = await page.locator('[data-filter="set"] option').evaluateAll((els) => els.map((e) => e.value))
  check(`${tag} the set picker offers the cost panel's set and the trials' sets`, setOptions.includes('Baseline@3') && setOptions.includes('Dawaa Now reach 8 km@1'), setOptions.join(','))
  await page.locator('[data-filter="set"]').selectOption('Baseline@3')
  await page.waitForTimeout(500)
  check(`${tag} the candidate set by name and version`, last('top')?.set === 'Baseline' && last('top')?.version === '3', JSON.stringify(last('top')))
  const tabs = await page.locator('[data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))
  check(`${tag} the seven tabs in the spec's order`, JSON.stringify(tabs) === JSON.stringify(['breakdowns', 'outside-rules', 'checks', 'later-slots', 'not-run', 'trials', 'phase-2-bar']), tabs.join(','))

  // 8. Trials (ticket 973)
  await page.goto(`${BASE}/oms/sourcing-results?tab=trials`)
  await page.locator('[data-trials-list]').waitFor({ timeout: 15000 })
  const trialStates = await page.locator('[data-trial]').evaluateAll((els) => els.map((e) => e.getAttribute('data-trial-state')))
  check(`${tag} the trials newest first: waiting, running, done, done, stopped`, JSON.stringify(trialStates) === JSON.stringify(['WAITING', 'RUNNING', 'DONE', 'DONE', 'FAILED']), trialStates.join(','))
  check(`${tag} the queue line names the running trial and one waiting`, /One trial is running; 1 waits/.test(plain(await page.locator('[data-trials-queue]').innerText())))
  check(`${tag} a trial's period is one LTR isolate`, await isLtrIsolate(page.locator(`[data-trial="${TRIAL_SET}"] td`).nth(1).locator('bdi').first()))
  const result = page.locator(`[data-trial-result="${TRIAL_SET}"]`)
  await result.waitFor({ timeout: 10000 })
  const refusals = await result.locator('[data-trial-refusal]').evaluateAll((els) => els.map((e) => e.getAttribute('data-trial-refusal')))
  check(`${tag} the trial set's result opens first, refusals in the server's order`, JSON.stringify(refusals) === JSON.stringify(['NEEDS_WIDER_READ', 'STORE_NOT_READ']), refusals.join(','))
  const counts = await result.locator('[data-trial-counts]').innerText()
  check(`${tag} orders, solved, refused, no plan, failed`, ['39,870', '38,372', '1,420', '66', '12'].every((n) => counts.includes(n)), counts.replace(/\n/g, ' '))
  check(`${tag} a trial set's result stands under its banner`, (await result.locator('[data-trial-set-banner]').count()) === 1)
  await result.locator('[data-factor="SLOT_LOAD"]').waitFor({ timeout: 10000 })
  const factors = await result.locator('[data-factor]').evaluateAll((els) => els.map((e) => e.getAttribute('data-factor')))
  check(`${tag} the factor table: fifteen rows in the server's order`, factors.length === 15 && factors[2] === 'RECORD_SLOT_LATE' && factors[14] === 'COUNT_FACTOR_ON', factors.join(','))
  check(`${tag} a factor that changes no plan says so; one still running says so`, (await result.locator('[data-factor="NAMED_STORE_STAYS"] [data-factor-none]').count()) === 1 && (await result.locator('[data-factor="COUNT_FACTOR_ON"][data-factor-state="RUNNING"]').count()) === 1)
  // a done trial with no factor table yet: the candidate's
  await page.locator(`[data-trial="${CANDIDATE}"] [data-trial-show]`).click()
  await page.locator(`[data-trial-result="${CANDIDATE}"] [data-factor-start]`).click()
  await page.waitForTimeout(400)
  check(`${tag} the factor table starts on the version and period, as the server reads them`, sameFields(wire.tables.at(-1), { name: 'Baseline', version: 3, from: '2026-11-12 00:00:00', to: '2026-11-25 00:00:00' }), JSON.stringify(wire.tables.at(-1)))
  check(`${tag} the candidate set's own trial offers nothing beside it`, (await page.locator(`[data-trial-result="${CANDIDATE}"] [data-trial-result-beside]`).count()) === 0)
  await page.locator(`[data-trial="${TRIAL_SET}"] [data-trial-show]`).click()

  // start a trial: 31 days refused, 14 started
  await page.locator('[data-trial-name]').fill('Margin ×1.1')
  await page.locator('[data-trial-version]').fill('1')
  await page.locator('[data-trial-from]').fill('2026-10-26')
  await page.locator('[data-trial-to]').fill('2026-11-25')
  await page.waitForTimeout(200)
  check(`${tag} the form refuses a period of 31 days`, (await page.locator('[data-trial-problem="TOO_LONG"]').count()) === 1 && (await page.locator('[data-trial-start]').isDisabled()))
  await page.locator('[data-trial-from]').fill('2026-11-12')
  await page.waitForTimeout(200)
  await page.locator('[data-trial-start]').click()
  await page.locator('[data-trial-started]').waitFor({ timeout: 10000 })
  check(`${tag} the trial starts: a saved version by name and number, whole days`, sameFields(wire.starts.at(-1), { name: 'Margin ×1.1', version: 1, from: '2026-11-12 00:00:00', to: '2026-11-25 00:00:00' }), JSON.stringify(wire.starts.at(-1)))
  check(`${tag} it waits its turn, and says how many wait before it`, /waits its turn; 1 waits before it/.test(plain(await page.locator('[data-trial-started]').innerText())), plain(await page.locator('[data-trial-started]').innerText()))
  await page.screenshot({ path: `${SHOTS}/${lang}-trials.png`, fullPage: true })

  // open the trial set beside the candidate set's trial
  await result.locator('[data-trial-result-beside]').click()
  await page.locator('[data-beside-banner]').waitFor({ timeout: 15000 })
  check(`${tag} "open with this set beside it" reads the two trials side by side, the candidate's first`, sameFields(wire.besides.at(-1), { trialId: CANDIDATE, otherId: TRIAL_SET }) && page.url().includes(`against=${CANDIDATE}`) && page.url().includes(`beside=${TRIAL_SET}`), JSON.stringify(wire.besides.at(-1)))
  const banner = await page.locator('[data-beside-banner]').innerText()
  check(`${tag} the banner names both sets, the orders compared and those left out of both`, /trial set/.test(banner) && banner.includes('Dawaa Now reach 8 km') && banner.includes('Baseline') && banner.includes('38,300') && banner.includes('1,570'), banner.replace(/\n/g, ' '))
  check(`${tag} the filter bar names the set beside it`, (await page.locator('[data-filter="beside"]').innerText()).includes('Dawaa Now reach 8 km'))
  const thinBars = await page.locator('[data-beside-bar]').count()
  const firstThin = await box(page.locator('[data-beside-bar="beside"] [data-share-segment="SAME_PLAN"]'))
  const lastThin = await box(page.locator('[data-beside-bar="beside"] [data-share-segment="NOT_COMPARABLE"]'))
  const thinBar = await box(page.locator('[data-beside-bar="beside"] [data-chart="share-bar"]'))
  const mainBar = await box(page.locator('[data-segment="SAME_PLAN_BOTH"]'))
  check(`${tag} a thin bar for each set against what happened, thinner than the page's`, thinBars === 2 && thinBar.height > 0 && thinBar.height < mainBar.height, `${thinBars} ${thinBar.height} < ${mainBar.height}`)
  check(`${tag} the thin bar's first segment stands at the reading start`, lang === 'ar' ? firstThin.x > lastThin.x : firstThin.x < lastThin.x)
  check(`${tag} under the set beside it: the same plan for 26,180 of 38,300`, (await page.locator('[data-beside-bar="beside"] p').innerText()).includes('26,180'))
  const kinds = await page.locator('[data-beside-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-beside-kind')))
  check(`${tag} the plans that differ between the two sets, by kind`, JSON.stringify(kinds) === JSON.stringify(['ANOTHER_STORE', 'ANOTHER_MODE', 'FEWER_SHIPMENTS', 'MORE_SHIPMENTS']), kinds.join(','))
  check(`${tag} the estimate between the sets: a minus is the set beside it earlier`, /promises 4 min earlier/.test(plain(await page.locator('[data-beside-estimate]').innerText())))
  check(`${tag} the promise check under that set`, (await page.locator('[data-beside-promise-row="DAWAA_NOW"]').innerText()).includes('85.5%'))
  check(`${tag} still no riyal figure with a set beside it`, !/SAR\s*\d|\d\s*SAR|ر\.س/.test(await page.locator('[data-sourcing-results]').innerText()))
  await page.screenshot({ path: `${SHOTS}/${lang}-beside.png`, fullPage: true })
  await page.locator('[data-beside-clear]').click()
  await page.waitForTimeout(400)
  check(`${tag} removing the set beside it clears the banner and the URL`, (await page.locator('[data-beside-banner]').count()) === 0 && !page.url().includes('beside='), page.url())

  // 9. Phase 2 bar (ticket 973)
  await page.locator('[data-tab="phase-2-bar"]').click()
  await page.locator('[data-bar-limits]').waitFor({ timeout: 15000 })
  check(`${tag} the bar's first read: the app and the site, step 1, the last 28 days`, sameFields(wire.bars[0], { channelGroup: 'APP_SITE', step: 'STORES_ONLY' }), JSON.stringify(wire.bars[0]))
  const limits = await page.locator('[data-bar-limit]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-bar-limit')}=${e.getAttribute('data-bar-state')}`))
  check(
    `${tag} the nine limits a to i, each with its state`,
    JSON.stringify(limits) ===
      JSON.stringify(['STOP_FINDINGS=MET', 'ORDERS_RUN=MET', 'DAWAA_NOW_PROMISE=NOT_MET', 'DISTANCE_BANDS=NOT_MET', 'SHELF_CHANCE=NOT_MET', 'SPLIT_CHECK=CANNOT_READ_YET', 'LARGEST_DIFFERENCES=NOT_MET', 'OUTSIDE_RULES=MET', 'RATES=CANNOT_READ_YET']),
    limits.join(' '),
  )
  check(`${tag} the tally: 3 met, 4 not met, 2 cannot be read yet; the bar not met`, /3 limits met, 4 not met, 2 that cannot be read yet/.test(await page.locator('[data-bar-tally]').innerText()) && (await page.locator('[data-bar-state="NOT_MET"]').count()) >= 1)
  check(`${tag} "cannot be read yet" says why, in the server's words`, (await page.locator('[data-bar-limit="SPLIT_CHECK"] [data-bar-why]').innerText()).includes(words('PHASE2_WHY', 'SPLIT_CHECK_NOT_RECORDED')))
  check(`${tag} a limit not met says why`, (await page.locator('[data-bar-limit="DAWAA_NOW_PROMISE"] [data-bar-why]').innerText()).includes(words('PHASE2_WHY', 'HALF_OUTSIDE_BAND')))
  const bandFigure = page.locator('[data-bar-limit="DISTANCE_BANDS"] [data-bar-figure="KM_6_UP.percent"]')
  check(`${tag} a band's figure in words, its value an LTR isolate`, (await bandFigure.innerText()).includes('6 km or more') && (await bandFigure.innerText()).includes('74.0%') && (await isLtrIsolate(bandFigure.locator('bdi').first())))
  check(`${tag} the bar's period is one LTR isolate`, await isLtrIsolate(page.locator('[data-bar-period] bdi').first()))
  check(`${tag} the readings stand apart, five of them`, (await page.locator('[data-bar-readings] [data-bar-reading]').count()) === 5)
  const groups = await page.locator('[data-largest-group]').evaluateAll((els) => els.map((e) => e.textContent))
  check(`${tag} the largest differences in four lists, each with its marked count`, groups.length === 4 && groups[0].includes('1 / 2'), groups.join(' | '))
  await page.locator('[data-largest-row="0081734455"] [data-largest-select]').selectOption('WRONG_RULE')
  await page.locator('[data-largest-row="0081734455"][data-largest-mark="WRONG_RULE"]').waitFor({ timeout: 10000 })
  check(
    `${tag} a largest difference is marked through Close`,
    sameFields(wire.closes.at(-1), { from: '2026-10-30', channelGroup: 'APP_SITE', kind: 'ORDER', key: '0081734455', mark: 'WRONG_RULE', text: '' }),
    JSON.stringify(wire.closes.at(-1)),
  )
  check(`${tag} without the run grant an order opens no stored run`, (await page.locator('[data-largest-open]').count()) === 0)
  const due = page.locator('[data-bar-ruling-due="SLOT|BOOK_AT_ZERO"]')
  await due.locator('[data-bar-ruling-text]').fill('Counts few at zero book; keep the figure.')
  await due.locator('[data-bar-ruling-save]').click()
  await page.locator('[data-bar-ruling-written="SLOT|BOOK_AT_ZERO"]').waitFor({ timeout: 10000 })
  check(`${tag} a ruling is written through Close`, sameFields(wire.closes.at(-1), { from: '2026-10-30', channelGroup: 'APP_SITE', kind: 'SHELF_CHANCE', key: 'SLOT|BOOK_AT_ZERO', mark: 'RULED', text: 'Counts few at zero book; keep the figure.' }), JSON.stringify(wire.closes.at(-1)))
  await page.locator('[data-bar-split-mark]').selectOption('WITHIN_LIMIT')
  await page.locator('[data-bar-split-text]').fill('Read 40 split orders; none of no named cause.')
  await page.locator('[data-bar-split-save]').click()
  await page.locator('[data-bar-split-done="WITHIN_LIMIT"]').waitFor({ timeout: 10000 })
  check(`${tag} the split check is recorded through Close`, wire.closes.at(-1)?.kind === 'SPLIT_CHECK' && wire.closes.at(-1)?.key === '' && wire.closes.at(-1)?.mark === 'WITHIN_LIMIT', JSON.stringify(wire.closes.at(-1)))
  await page.screenshot({ path: `${SHOTS}/${lang}-bar.png`, fullPage: true })
  await page.locator('[data-bar-step="WHOLE_PLAN"]').click()
  await page.locator('[data-bar-channel]').selectOption('CALL_CENTRE')
  await page.locator('[data-bar-from]').fill('2026-10-01')
  await page.waitForTimeout(600)
  check(`${tag} the picker re-reads the bar: step 2, the call centre, from 2026-10-01`, sameFields(wire.bars.at(-1), { from: '2026-10-01', channelGroup: 'CALL_CENTRE', step: 'WHOLE_PLAN' }), JSON.stringify(wire.bars.at(-1)))
  check(`${tag} the 28 days run to 2026-10-28`, (await page.locator('[data-bar-period]').innerText()).includes('2026-10-28'))
  await page.locator('[data-bar-accept-note]').fill('Read with finance; rates still assumed.')
  await page.locator('[data-bar-accept-button]').click()
  await page.locator('[data-bar-kept-row]').first().waitFor({ timeout: 10000 })
  check(
    `${tag} the reading is accepted through Accept, with its step and a note, and kept`,
    sameFields(wire.accepts.at(-1), { from: '2026-10-01', channelGroup: 'CALL_CENTRE', step: 'WHOLE_PLAN', note: 'Read with finance; rates still assumed.' }) && (await page.locator('[data-bar-kept]').innerText()).includes('owner.dmsco'),
    JSON.stringify(wire.accepts.at(-1)),
  )

  // 10. the five reading tabs (ticket 972)
  await readingTabs(page, tag, lang, wire, last)

  // 11. no error, no raw key
  const all = await page.locator('main').innerText()
  check(`${tag} no raw i18n key on the page`, !/\b(top|promise|cost|marks|differ|tabs|drawer|card|filters|trials|bar|beside)\.[a-zA-Z]+/.test(all))
  check(`${tag} no page error`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

function pick(o, keys) {
  return o ? Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])) : o
}

async function readingTabs(page, tag, lang, wire, last) {
  const drawerFor = async (figure) => {
    await page.locator(`[data-drill="${figure}"]`).first().click()
    await page.locator(`dialog[open][data-results-drawer="${figure}"]`).waitFor({ timeout: 10000 })
    const q = last('orders')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(250)
    return q
  }
  const tab = async (name) => {
    await page.locator(`[data-tab="${name}"]`).click()
    await page.locator(`[data-tab-panel="${name}"] [data-reading-tab="${name}"]`).waitFor({ timeout: 10000 })
    await page.waitForTimeout(300)
  }

  // Breakdowns: the default tab
  await page.goto(`${BASE}/oms/sourcing-results`)
  await page.locator('[data-breakdowns-table="MODE"]').waitFor({ timeout: 15000 })
  check(`${tag} Breakdowns opens first and reads its door by mode, with the page's filters`, last('breakdown')?.by === 'MODE' && last('breakdown')?.period === 'DAYS_14', JSON.stringify(last('breakdown')))
  const modeRows = await page.locator('[data-breakdown-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-breakdown-row')))
  check(`${tag} Breakdowns by mode: the rows in the order sent`, JSON.stringify(modeRows) === JSON.stringify(['SLOT_ONLY', 'PICK_UP_ONLY', 'DAWAA_NOW_ONLY', 'SLOT_AND_DAWAA_NOW', 'BEYOND_BORDER', 'OTHER']), modeRows.join(','))
  check(`${tag} Breakdowns: eleven count columns beside the row name`, (await page.locator('[data-breakdowns-table] th[data-col]').count()) === 11)
  const total = await page.locator('[data-breakdown-total]').innerText()
  check(`${tag} Breakdowns: the total row as sent`, total.includes('39,870') && total.includes('27,429') && total.includes('1,236'), total.replace(/\s+/g, ' '))
  check(`${tag} Breakdowns: a count is an LTR isolate`, await isLtrIsolate(page.locator('[data-breakdown-total] td:nth-child(3) bdi').first()))
  const nameCell = await box(page.locator('[data-breakdowns-table] thead th').first())
  const ordersCell = await box(page.locator('[data-breakdowns-table] th[data-col="orders"]'))
  check(`${tag} Breakdowns: the row name stands at the reading start`, lang === 'ar' ? nameCell.x > ordersCell.x : nameCell.x < ordersCell.x)
  check(`${tag} Breakdowns: a mode row's orders open them by grouping and key`, sameFields(pick(await drawerFor('breakdown:MODE:SLOT_ONLY'), ['by', 'key']), { by: 'MODE', key: 'SLOT_ONLY' }))
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-breakdowns.png`, fullPage: true })
  await page.locator('[data-breakdown-by="CITY"]').click()
  await page.locator('[data-breakdowns-table="CITY"]').waitFor({ timeout: 10000 })
  check(`${tag} Breakdowns by city asks the door by city; a city is free text`, last('breakdown')?.by === 'CITY' && (await page.locator('[data-breakdown-row="Riyadh"] bdi').first().getAttribute('dir')) !== 'ltr')
  await page.locator('[data-breakdown-by="MADE_BY"]').click()
  await page.locator('[data-breakdowns-table="MADE_BY"]').waitFor({ timeout: 10000 })
  check(`${tag} Breakdowns by who made the run: the channel, or OMS and why`, (await page.locator('[data-breakdown-row="NO_CHECKOUT_RUN"]').innerText()).includes(words('OWN_RUN', 'NO_CHECKOUT_RUN')) && (await page.locator('[data-breakdown-row="CHANNEL"]').count()) === 1)
  await page.locator('[data-breakdown-by="DAY"]').click()
  await page.locator('[data-breakdowns-table="DAY"]').waitFor({ timeout: 10000 })
  const days = await page.locator('[data-breakdown-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-breakdown-row')))
  check(`${tag} Breakdowns by day: 14 days, oldest first, a date an LTR isolate`, days.length === 14 && days[0] === '2026-11-13' && (await isLtrIsolate(page.locator('[data-breakdown-row="2026-11-13"] td:first-child bdi').first())), `${days.length} ${days[0]}`)

  // Outside the advisor's rules
  await tab('outside-rules')
  const reasons = await page.locator('[data-outside-reason]').evaluateAll((els) => els.map((e) => e.getAttribute('data-outside-reason')))
  check(`${tag} Outside the rules: one row per refused pin and step`, reasons.length === 6 && reasons[0] === 'PIN_PAIR_REMOVED|OUT_OF_REACH', reasons.join(','))
  const firstReason = await page.locator('[data-outside-reason="PIN_PAIR_REMOVED|OUT_OF_REACH"]').innerText()
  check(`${tag} Outside the rules: the pin and the step in words`, firstReason.includes(words('PIN', 'PIN_PAIR_REMOVED')) && firstReason.includes('A store out of reach for the mode'), firstReason.replace(/\s+/g, ' '))
  check(`${tag} Outside the rules: the group line and the total`, /group of their own/.test(await page.locator('[data-outside-rules-group]').innerText()) && (await page.locator('[data-outside-rules-total]').innerText()).includes('1,240'))
  check(`${tag} Outside the rules: a reason's orders open them by pin and step`, sameFields(pick(await drawerFor('outside:PIN_PAIR_REMOVED|OUT_OF_REACH'), ['outside', 'outsideStep']), { outside: 'PIN_PAIR_REMOVED', outsideStep: 'OUT_OF_REACH' }))
  const noStep = await drawerFor('outside:PIN_NO_STOCK|')
  check(`${tag} Outside the rules: a reason with no step asks by the pin alone`, noStep?.outside === 'PIN_NO_STOCK' && noStep?.outsideStep === undefined, JSON.stringify(noStep))
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-outside-rules.png`, fullPage: true })

  // Promise and stock checks
  await tab('checks')
  await page.locator('[data-shelf-table]').waitFor({ timeout: 10000 })
  check(`${tag} Checks: the promise check's three rows, from the checks door`, (await page.locator('[data-reading-tab="checks"] [data-promise-row]').count()) === 3 && !!last('checks'))
  const bands = await page.locator('[data-distance-band]').evaluateAll((els) => els.map((e) => e.getAttribute('data-distance-band')))
  check(`${tag} Checks: Dawaa Now by distance band`, JSON.stringify(bands) === JSON.stringify(['KM_0_2', 'KM_2_4', 'KM_4_6', 'KM_6_UP']), bands.join(','))
  check(`${tag} Checks: a band's express stamp share`, (await page.locator('[data-distance-band="KM_0_2"]').innerText()).includes('95.2%'))
  check(`${tag} Checks: the stock check by mode`, (await page.locator('[data-stock-check]').count()) === 3 && (await page.locator('[data-stock-check="SLOT"]').innerText()).includes('288'))
  const shelf = await page.locator('[data-shelf-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-shelf-row')}=${e.getAttribute('data-verdict')}`))
  check(`${tag} Checks: the shelf chance rows from the phase 2 bar's reading, each with the server's verdict`, shelf.length === 8 && shelf[0] === 'DAWAA_NOW|BOOK_BELOW_ZERO=ENOUGH_TO_CHANGE' && shelf.includes('SLOT|HELD_BY_DELIVERIES=TOO_FEW'), shelf.join(' '))
  check(`${tag} Checks: a row waiting for a ruling says so`, (await page.locator('[data-shelf-row="SLOT|BOOK_AT_ZERO"]').innerText()).includes('waits for a written ruling') || (await page.locator('[data-shelf-row="SLOT|BOOK_AT_ZERO"]').innerText()).includes('ruled'))
  check(`${tag} Checks: a row's figures are LTR isolates`, await isLtrIsolate(page.locator('[data-shelf-row="SLOT|BOOK_BELOW_ZERO"] td:nth-child(3) bdi').first()))
  const fleet = await page.locator('[data-fleet-ratios]').innerText()
  check(`${tag} Checks: each mode's fleet ratio, none where there is none`, fleet.includes('0.84') && fleet.includes('0.93') && fleet.includes('—'), fleet.replace(/\s+/g, ' '))
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-checks.png`, fullPage: true })

  // Later slots
  await tab('later-slots')
  const sentence = await page.locator('[data-later-slots-sentence]').innerText()
  check(`${tag} Later slots: one sentence with the count and its share`, sentence.includes('1,318') && sentence.includes('8.0%') && sentence.includes('16,536'), sentence.replace(/\s+/g, ' '))
  check(`${tag} Later slots: labelled evidence for phase 2, no riyal`, (await page.locator('[data-phase2-evidence]').innerText()).includes('evidence for phase 2') && !/SAR|ر\.س|riyal/i.test(sentence))
  await page.locator('[data-later-slots-chart] [data-chart="bar"] svg').first().waitFor({ timeout: 10000 })
  const bars = page.locator('[data-later-slots-chart] .recharts-bar-rectangle')
  check(`${tag} Later slots: a bar per hour with orders`, (await bars.count()) >= 18, String(await bars.count()))
  await bars.nth(12).click()
  await page.locator('dialog[open][data-results-drawer^="laterSlot:"]').waitFor({ timeout: 10000 })
  check(`${tag} Later slots: an hour's bar opens its orders by hour`, /^\d+$/.test(last('orders')?.hour ?? ''), JSON.stringify(last('orders')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-later-slots.png`, fullPage: true })

  // Orders not run
  await tab('not-run')
  const notRun = await page.locator('[data-not-run-reason]').evaluateAll((els) => els.map((e) => e.getAttribute('data-not-run-reason')))
  check(`${tag} Orders not run: the server's four reasons`, JSON.stringify(notRun) === JSON.stringify(['TOO_LATE', 'THREE_FAILED', 'OUTSIDE_SHARE', 'PICK_UP_ONLY']), notRun.join(','))
  const ownRun = await page.locator('[data-own-run-reason]').evaluateAll((els) => els.map((e) => e.getAttribute('data-own-run-reason')))
  check(`${tag} Orders not run: the orders OMS ran itself, by why`, JSON.stringify(ownRun) === JSON.stringify(['NO_CHECKOUT_RUN', 'CART_CHANGED', 'RUN_HAD_PINS']), ownRun.join(','))
  check(`${tag} Orders not run: an own-run reason opens its orders as a breakdown row`, sameFields(pick(await drawerFor('breakdown:MADE_BY:CART_CHANGED'), ['by', 'key']), { by: 'MADE_BY', key: 'CART_CHANGED' }))
  await page.screenshot({ path: `${SHOTS}/${lang}-tab-not-run.png`, fullPage: true })

  let pending = 0
  let raw = ''
  for (const name of ['breakdowns', 'outside-rules', 'checks', 'later-slots', 'not-run']) {
    await tab(name)
    pending += await page.locator(`[data-tab-panel="${name}"] [data-tab-pending]`).count()
    const text = await page.locator('[data-tab-panel]').innerText()
    const hit = text.match(/\b(reading|stockClasses|breakdowns|outsideRules|checks|laterSlots|notRun)\.[a-zA-Z]+/)
    if (hit) raw += `${name}:${hit[0]} `
    if (/SAR\s*\d|\d\s*SAR|ر\.س/.test(text)) raw += `${name}:riyal `
  }
  check(`${tag} the five reading tabs are built: none says pending`, pending === 0)
  check(`${tag} the five reading tabs: no raw key and no riyal figure`, raw === '', raw)
}

async function run() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
  try {
    for (const lang of ['en', 'ar']) await scenario(browser, lang)
  } finally {
    await browser.close()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
