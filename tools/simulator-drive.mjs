// Simulator drive (spec 2737; ticket 514 built it, ticket 525 re-pointed it): Campaigns ▸ Simulator,
// the rule engine's dry run on the REAL door.
//
// Drives the REAL app in Chromium against STUBS of the real BackOffice 2758 shapes, inside the real
// envelope { statusCode, success, message, errors: [{ errorCode, internalErrorCode, errorMessage }],
// data } (a refusal's first error is the refusal, every further one a detail under the same code; a
// missing grant is a BARE 403 with no body):
//   POST Rules/Authoring/Simulate            → tools/simulator-fixtures.mjs `simulate`: the prototype's
//                                              baskets with the prototype engine's answers, in HQ's
//                                              shape; HQ's own refusals of the request
//   POST Rules/Authoring/Lookups/{materials|stores} { q } → tools/campaigns-fixtures.mjs `lookup`
//   POST Rules/Authoring/Drafts/List + Order (the list's doors) and POST Rules/Authoring/Drafts/Load
//        { campaign } → the dashboard's way in
// Never a live SIS.Api.
//
// It asserts:
//   1. the Campaigns group has a Simulator leaf, ungated, that opens /campaigns/simulator and lights itself;
//   2. before a run: no result, Run off, today's LOCAL date and time, SA and the first channel;
//   3. a TYPED basket: items found by SKU or name (with HQ's category), a repeat adds to its line, a
//      quantity typed, a line removed; Run waits for a store AND a unit price on every line;
//  11. a run refused by a bare 403 says the grant is missing;
//   4. Run POSTs the evaluate request: store, country, channel, currency, decimals, cart lines (net =
//      price × quantity), the member's profile, coupons, flags, points and the LOCAL moment (no Z);
//      neither campaign nor draft;
//   5. the result: what it ran on, totals, unit effects summed per line with both labels, points and
//      a coupon's refusal on the whole sale, near misses with their gaps (path and "not met" text),
//      and the trace in HQ's order with its status, code, group and reason;
//   6. a changed sale marks the result stale;
//   7. a CSV basket, pasted: a header HQ cannot read and bad lines flagged by file line, refused until
//      fixed; then the file IS the basket, sent as `csv`, and the run shows a free unit, points taken
//      as a tender and three near misses; HQ's own refusals of a file (a line number twice, a bad line)
//      are shown with their code and lines;
//   8. a CSV basket, uploaded as a file, at a Bahraini store: BHD at three decimals, a walk-in, and the
//      bonus-buy store's note;
//   9. a basket of SAR 300 shows the coupon NEXT-VISIT "will create";
//  10. the dashboard's "Simulate the working copy" opens the simulator on that draft, and Run sends
//      `draft`; a cashier prompt; an offer the customer says yes to goes back as a flag; a campaign
//      with no saved draft runs live; the draft is dropped from the address;
//  13. a draft the checker refuses (RULES_INVALID_CAMPAIGN) lists its blocks, where → what, with the
//      path, and links to the campaign;
//  12. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/simulator-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { CAMPAIGNS, draftsList, loadDraft, lookup, orderOf } from './campaigns-fixtures.mjs'
import { CATALOG, SIX_BASKETS, simulate } from './simulator-fixtures.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.campaigns-shots'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/campaigns-drive.mjs); a refusal's details follow it
// under the same code.
const envelope = (data, { status = 200, success = true, message = '', errorCode, details = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [errorCode, ...details.map(() => errorCode)].map((c, i) => ({ errorCode: c, errorMessage: i === 0 ? message : details[i - 1], internalErrorCode: '' })) : [],
    data,
  }),
})
/** A missing grant: SIS.Api's grant filter answers before any handler, with no body at all. */
const BARE_403 = { status: 403, contentType: 'text/plain', body: '' }

const CHECKER_LINE = 'rule 1 → effect 1 → value: a percent is more than 0 and at most 100 (campaign.rules[0].then[0].value)'

const browser = await chromium.launch()

async function open({ denyRuns = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const runs = []
  // What the drive switches on for a stretch: drafts the checker refuses, a file HQ refuses once.
  const stub = { denials: denyRuns, invalid: {}, badBasketOnce: null }
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
    const p = url.pathname.split('/api/')[1]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Rules/Authoring/Simulate' && req.method() === 'POST') {
      const body = req.postDataJSON()
      runs.push(body)
      if (stub.denials > 0) {
        stub.denials--
        return route.fulfill(BARE_403)
      }
      if (stub.badBasketOnce && body.csv) {
        const lines = stub.badBasketOnce
        stub.badBasketOnce = null
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'The basket CSV is refused.', errorCode: 'RULES_BAD_BASKET', details: lines }))
      }
      const out = simulate(body, { invalid: stub.invalid })
      return route.fulfill(out.sim ? envelope(out.sim) : envelope(null, { status: out.status, success: false, message: out.message, errorCode: out.refused, details: out.details }))
    }
    const lk = /^Rules\/Authoring\/Lookups\/(\w+)$/.exec(p)
    if (lk && req.method() === 'POST') {
      const out = lookup(lk[1], req.postDataJSON()?.q ?? '')
      return route.fulfill(out.hits ? envelope(out.hits) : envelope(null, { status: out.status, success: false, message: out.message, errorCode: out.refused }))
    }
    if (p === 'Rules/Authoring/Drafts/List' && req.method() === 'POST') return route.fulfill(envelope(draftsList(CAMPAIGNS)))
    if (p === 'Rules/Authoring/Order' && req.method() === 'POST') return route.fulfill(envelope(orderOf(CAMPAIGNS)))
    if (p === 'Rules/Authoring/Drafts/Load' && req.method() === 'POST') {
      const out = loadDraft(CAMPAIGNS, req.postDataJSON()?.campaign)
      return route.fulfill(out.draft ? envelope(out.draft) : envelope(null, { status: 404, success: false, message: out.message, errorCode: out.refused }))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, runs, stub }
}

/** A locator's text without the bidi isolates (FSI…PDI) the page wraps values in. */
const text = async (loc) => (await loc.innerText()).replace(/[⁦-⁩]/g, '')
const run = (page) => page.locator('[data-sim-run]')
const field = (page, k) => page.locator(`[data-sim-field="${k}"]`)
const basketSkus = (page) => page.$$eval('[data-basket-line]', (els) => els.map((e) => e.getAttribute('data-basket-line')))
const qty = (page, sku) => page.locator(`[data-basket-qty="${sku}"]`)
const price = (page, sku) => page.locator(`[data-basket-price="${sku}"]`)

async function addItem(page, search, sku) {
  await page.locator('[data-basket-find]').fill(search)
  await page.locator(`[data-basket-hit="${sku}"]`).click()
}
async function setQty(page, sku, n) {
  await qty(page, sku).fill(String(n))
  await qty(page, sku).press('Enter')
}
async function setPrice(page, sku, n) {
  await price(page, sku).fill(String(n))
  await price(page, sku).press('Enter')
}
async function runAndWait(page, runs) {
  const sent = runs.length
  await run(page).click()
  for (let i = 0; i < 50 && runs.length === sent; i++) await page.waitForTimeout(100)
  await page.waitForFunction(() => !document.querySelector('[data-sim-run]')?.textContent?.includes('Running'))
}
const total = (page, k) => page.locator(`[data-sim-total="${k}"] dd`).innerText()
const lineEffects = (page, line) => page.locator(`[data-sim-line-effects="${line}"]`)
const refusalCode = (page) => page.locator('[data-sim-refusal-code]').getAttribute('data-sim-refusal-code')

{
  const { context, page, errors, calls, runs, stub } = await open({ denyRuns: 1 })
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns/simulator"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Simulator leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns/simulator`)
  await page.locator('[data-simulator]').waitFor({ timeout: 15000 })
  check('1: it opens /campaigns/simulator and lights itself, not Campaigns',
    (await leaf.getAttribute('aria-current')) === 'page' && (await page.locator('a[href="/campaigns"]').first().getAttribute('aria-current')) !== 'page')
  check('1: ungated — no rule-door probe was made', !calls.some((c) => /Rules?\/.*Access|RuleCampaign\/Access/.test(c)), calls.filter((c) => /Access/.test(c)).join(', '))

  // ── 2 ──
  check('2: no result yet, and Run is off', (await page.locator('[data-sim-no-result]').count()) === 1 && (await run(page).isDisabled()) && (await page.locator('[data-sim-needs]').count()) === 1)
  check('2: the date and time are today\'s LOCAL now', (await field(page, 'date').inputValue()) === '2026-10-16' && (await field(page, 'time').inputValue()) === '18:30',
    `${await field(page, 'date').inputValue()} ${await field(page, 'time').inputValue()}`)
  check('2: the country starts on SA, the channel on the first listed', (await field(page, 'country').inputValue()) === 'SA' && (await field(page, 'channel').inputValue()) === 'POS')
  check('2: the store waits to be chosen', (await field(page, 'store').inputValue()) === '')

  // ── 3 ──
  await addItem(page, 'sha-400', 'SHA-400')
  await addItem(page, 'paracetamol', 'PAN-24')
  await addItem(page, 'SHA-400', 'SHA-400')
  check('3: items found by SKU or by name; a repeat adds to its line', JSON.stringify(await basketSkus(page)) === '["SHA-400","PAN-24"]' && (await qty(page, 'SHA-400').inputValue()) === '2')
  const pan = await text(page.locator('[data-basket-line="PAN-24"]'))
  check('3: a line shows the SKU, HQ\'s category and the name HQ gave it', /PAN-24 · A001/.test(pan) && /Paracetamol 500mg, 24 tabs/.test(pan), pan)
  await setQty(page, 'PAN-24', 3)
  await qty(page, 'SHA-400').fill('0')
  await qty(page, 'SHA-400').press('Enter')
  check('3: a quantity is typed; a 0 is put back', (await qty(page, 'PAN-24').inputValue()) === '3' && (await qty(page, 'SHA-400').inputValue()) === '2')
  await addItem(page, 'serum', 'SER-VC')
  await page.locator('[data-basket-remove="SER-VC"]').click()
  check('3: a line is removed', JSON.stringify(await basketSkus(page)) === '["SHA-400","PAN-24"]')
  await field(page, 'store').selectOption('R101')
  check('3: Run waits for a unit price on every line', (await run(page).isDisabled()) && (await price(page, 'SHA-400').getAttribute('aria-invalid')) === 'true')
  await setPrice(page, 'SHA-400', CATALOG['SHA-400'][0])
  await setPrice(page, 'PAN-24', '9.755')
  check('3: a price past the currency\'s decimals is put back', (await price(page, 'PAN-24').inputValue()) === '' && (await run(page).isDisabled()))
  await setPrice(page, 'PAN-24', CATALOG['PAN-24'][0])
  await field(page, 'member').fill('M-208877')
  await field(page, 'coupons').fill('HAYAK10')
  check('3: …then it may run', !(await run(page).isDisabled()) && (await page.locator('[data-sim-needs]').count()) === 0)

  // ── 11a: a bare 403 ──
  await run(page).click()
  await page.getByText('You do not have the rule-author permission').waitFor({ timeout: 5000 })
  check('11: a run refused by a bare 403 says the grant is missing', await page.getByText('You do not have the rule-author permission').isVisible())

  // ── 4 ──
  await runAndWait(page, runs)
  await page.locator('[data-sim-totals]').waitFor({ timeout: 5000 })
  const body = runs.at(-1)
  const line = (n, article, quantity, net, category) => ({ lineNumber: n, article, quantity, unit: 'EA', baseUnitQuantity: quantity, gross: net, netBeforePromotion: net, vatRate: 0, category, fee: false, attributes: {} })
  check('4: Run POSTs the evaluate request — store, country, currency, cart lines, profile, coupons, flags, points, moment',
    JSON.stringify(body) === JSON.stringify({
      storeCode: 'R101', country: 'SA', channel: 'POS', currency: 'SAR', decimals: 2,
      lines: [line(1, 'SHA-400', 2, 54, 'A005'), line(2, 'PAN-24', 3, 29.25, 'A001')],
      profile: { loyaltyId: 'M-208877', tier: '', earning: true, firstPurchase: false, points: 0, audiences: [] },
      coupons: ['HAYAK10'], flags: [], requestedPoints: 0, at: '2026-10-16T18:30',
    }), JSON.stringify(body))
  check('4: the moment is local, never a Z; neither campaign nor draft is sent', !/Z$/.test(body.at) && !('campaign' in body) && !('draft' in body) && !('csv' in body))

  // ── 5 ──
  check('5: it says what it ran on', /Run on live version 41 at 2026-10-16 18:30\./.test(await text(page.locator('[data-sim-based]'))), await text(page.locator('[data-sim-based]')))
  check('5: totals — before promotions, discounts, to pay', (await total(page, 'net')) === 'SAR 83.25' && (await total(page, 'discount')) === 'SAR 15.40' && (await total(page, 'netAfter')) === 'SAR 67.85',
    `${await total(page, 'net')} ${await total(page, 'discount')} ${await total(page, 'netAfter')}`)
  await lineEffects(page, 1).waitFor()
  const l1 = lineEffects(page, 1).locator('[data-sim-effect]')
  check('5: the units summed per line — PCUT-SA01 takes SAR 10.00 off line 1, on its 2 units', (await l1.count()) === 1 && /PCUT-SA01\s*SAR 10\.00 off by the value map on 2 units/.test(await text(l1)), await text(l1))
  check('5: …with its receipt label in both languages',
    (await l1.locator('[data-says-en]').innerText()) === 'Price cut' && (await l1.locator('[data-says-ar]').innerText()) === 'تخفيض السعر' && (await l1.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
  check('5: grid cells carry no FSI / PDI (they would reach Ctrl+C)', !/[⁦-⁩]/.test(await page.locator('[data-sim-lines]').innerText()))
  check('5: …and SAR 5.40 off line 2, on 3 units', /SAR 5\.40 off by the value map on 3 units/.test(await text(lineEffects(page, 2))))
  const lineRow = page.locator('[data-sim-lines] .ag-row[row-id="2"]')
  check('5: the line reads its article, the typed name, net, off and to pay',
    /PAN-24/.test(await lineRow.innerText()) && /Paracetamol/.test(await lineRow.innerText()) && /29\.25/.test(await lineRow.innerText()) && /5\.40/.test(await lineRow.innerText()) && /23\.85/.test(await lineRow.innerText()))
  const sess = page.locator('[data-sim-session]')
  check('5: the whole sale — WLCB 7 points and BASE-EARN 67 points, pending',
    /WLCB\s*7 points earned, pending/.test(await text(sess)) && /BASE-EARN\s*67 points earned, pending/.test(await text(sess)), await text(sess))
  const ref = sess.locator('[data-sim-effect="refusal"]')
  check('5: …and the coupon HQ refused, its code and reason in both languages',
    (await ref.count()) === 1 && /RULES_COUPON_NOT_VALID/.test(await text(ref)) && /The coupon HAYAK10 is not valid\./.test(await text(ref)) && (await ref.locator('[data-says-ar]').innerText()).length > 0)
  const near = page.locator('[data-sim-near-miss="SUN-3FOR2"]')
  check('5: a near miss reads HQ\'s text and BOTH its gaps',
    /3 more items of sun and add SAR 66\.75 for Suncare 3 for 2/.test(await text(near)) && (await near.locator('[data-sim-gap]').count()) === 2, await text(near))
  const gap = near.locator('[data-sim-gap="minCount"]')
  check('5: a gap carries its path and the condition\'s own "not met" text, both languages',
    (await gap.getAttribute('data-sim-gap-path')) === 'campaign.rules[0].when[0]' && /Not met yet:\s*three suncare items/.test(await text(gap.locator('[data-sim-gap-says]'))) &&
      (await gap.locator('[data-sim-gap-says] [data-says-ar]').innerText()) === 'ثلاثة منتجات للعناية بالشمس', await text(gap))
  check('5: four near misses in all', (await page.locator('[data-sim-near-miss]').count()) === 4)
  check('5: a store on the rule engine shows no bonus-buy note', (await page.locator('[data-sim-bonus-buy]').count()) === 0)
  await page.locator('[data-sim-tab="trace"]').click()
  await page.locator('[data-sim-trace]').waitFor()
  check('5: the trace counts the campaigns by status', /3 applied · 6 not triggered · 2 skipped · 1 lost/.test(await text(page.locator('[data-sim-trace-summary]'))),
    await text(page.locator('[data-sim-trace-summary]')))
  const order = await page.$$eval('[data-sim-trace-campaign]', (els) => els.map((e) => e.getAttribute('data-sim-trace-campaign')))
  check('5: the trace is in HQ\'s evaluation order', JSON.stringify(order) === JSON.stringify(['PCUT-SA01', 'SUN-3FOR2', 'BABY-BUNDLE', 'GP-BEAUTY15', 'GIFT-POUCH', 'WKND20', 'PTS-50OFF', 'BH-SPEND10', 'NEXT-VISIT', 'WLCB', 'PRCB-AUG26', 'BASE-EARN']), JSON.stringify(order))
  const bh = page.locator('[data-sim-trace-campaign="BH-SPEND10"]')
  check('5: a skipped campaign says why — its code and HQ\'s reason in both languages',
    (await bh.getAttribute('data-sim-status')) === 'skipped' && (await bh.getAttribute('data-sim-code')) === 'audience' && /Not for this sale's audience/.test(await text(bh)) &&
      (await bh.locator('[data-sim-trace-reason] [data-says-en]').innerText()) === 'not for SA' && (await bh.locator('[data-sim-trace-reason] [data-says-ar]').innerText()).length > 0)
  const wknd = page.locator('[data-sim-trace-campaign="WKND20"]')
  check('5: a grouped campaign names its group; a refused one says so', /In group g-basket/.test(await text(wknd.locator('[data-sim-trace-group]'))) && (await wknd.getAttribute('data-sim-code')) === 'refused')
  const pts = page.locator('[data-sim-trace-campaign="PTS-50OFF"]')
  check('5: a campaign lost in its group', (await pts.getAttribute('data-sim-status')) === 'lost' && /Lost in its group/.test(await text(pts)))
  const pcut = page.locator('[data-sim-trace-campaign="PCUT-SA01"]')
  check('5: an applied campaign in the base, with what it gave',
    (await pcut.getAttribute('data-sim-status')) === 'applied' && /Base, stackable/.test(await pcut.locator('[data-sim-trace-group]').innerText()) && /Gave SAR 15\.40/.test(await text(pcut)), await text(pcut))
  await page.screenshot({ path: `${SHOTS}/525-typed-trace.png`, fullPage: true })
  await page.locator('[data-sim-tab="lines"]').click()

  // ── 6 ──
  check('6: not stale right after a run', (await page.locator('[data-sim-stale]').count()) === 0)
  await setQty(page, 'PAN-24', 4)
  check('6: a changed sale marks the result stale', (await page.locator('[data-sim-stale]').count()) === 1)

  // ── 7 ──
  await page.locator('[data-basket-upload]').click()
  await page.locator('[data-csv-text]').fill('sku,qty\nSER-VC,3')
  check('7: a header without net is refused whole, by HQ\'s rule', (await page.locator('[data-csv-problem="header"]').count()) === 1 && (await page.locator('[data-csv-use]').isDisabled()))
  await page.locator('[data-csv-text]').fill('article,quantity,net,category\nSER-VC,3,267,A002\nAMOX-500,0,21,A006\n\n,1,5\nGIFT-BAG,1,abc')
  await page.waitForFunction(() => document.querySelectorAll('[data-csv-check]').length === 4)
  const checkOf = (l) => page.locator(`[data-csv-preview] .ag-row[row-id="${l}"] [data-csv-check]`).getAttribute('data-csv-check')
  check('7: each line is checked by its FILE line — good, quantity not above 0, no article, net not a number',
    (await checkOf(2)) === 'ok' && (await checkOf(3)) === 'quantityNotPositive' && (await checkOf(5)) === 'noArticle' && (await checkOf(6)) === 'badNet',
    JSON.stringify([await checkOf(2), await checkOf(3), await checkOf(5), await checkOf(6)]))
  check('7: the file is refused until every line is good', (await page.locator('[data-csv-use]').isDisabled()) && (await page.locator('[data-csv-fix]').count()) === 1 &&
    /1 good · 3 to fix/.test(await text(page.locator('[data-csv-tally]'))))
  // A file the pre-check passes but HQ refuses: one line number twice.
  await page.locator('[data-csv-text]').fill('line,article,quantity,net\n1,SER-VC,1,89\n1,SUN-50,1,55')
  await page.locator('[data-csv-use]').click()
  check('7: a used file IS the basket — the typed lines give way', (await page.locator('[data-basket-file="2"]').count()) === 1 && (await page.locator('[data-basket-line]').count()) === 0)
  await runAndWait(page, runs)
  await page.locator('[data-sim-refusal-code]').waitFor({ timeout: 5000 })
  check('7: HQ\'s own refusal of the file shows its message and code (a line number twice)',
    (await refusalCode(page)) === 'RULES_DUPLICATE_LINE' && (await page.getByText('Line number 1 is in the cart twice').count()) === 1)
  await page.locator('[data-basket-typed]').click()
  check('7: "Type a basket instead" brings the typed lines back', JSON.stringify(await basketSkus(page)) === '["SHA-400","PAN-24"]')
  await page.locator('[data-basket-upload]').click()
  const HUDA = 'article,quantity,net,category\nSER-VC,3,267,A002\nAMOX-500,1,21,A006\nGIFT-BAG,1,12,A002'
  await page.locator('[data-csv-text]').fill(HUDA)
  check('7: fixed, the file may be used', !(await page.locator('[data-csv-use]').isDisabled()) && (await text(page.locator('[data-csv-use]'))) === 'Use this file of 3 lines')
  await page.locator('[data-csv-use]').click()
  stub.badBasketOnce = ["line 3: quantity is a number, not 'x'"]
  await runAndWait(page, runs)
  await page.locator('[data-sim-refusal-lines]').waitFor({ timeout: 5000 })
  const badLine = page.locator('[data-sim-refusal-line="line 3"]')
  check('7: HQ\'s RULES_BAD_BASKET names the file line', (await refusalCode(page)) === 'RULES_BAD_BASKET' && (await text(badLine.locator('[data-sim-refusal-where]'))) === 'line 3' && /quantity is a number, not 'x'/.test(await text(badLine)))
  await field(page, 'coupons').fill('')
  await field(page, 'member').fill('M-055410')
  await runAndWait(page, runs)
  await page.waitForFunction(() => document.querySelector('[data-sim-total="net"] dd')?.textContent === 'SAR 300.00')
  const csvBody = runs.at(-1)
  check('7: the file goes to HQ as csv, written as pasted, with no lines', csvBody.csv === HUDA && csvBody.lines.length === 0, JSON.stringify(csvBody).slice(0, 200))
  check('7: the file basket runs — to pay', (await total(page, 'netAfter')) === 'SAR 197.95')
  check('7: line 3 shows GIFT-POUCH\'s free unit', /GIFT-POUCH\s*1 free unit, worth SAR 12\.00 on 1 unit/.test(await text(lineEffects(page, 3))), await text(lineEffects(page, 3)))
  check('7: line 1 shows two campaigns, each its units summed',
    (await lineEffects(page, 1).locator('[data-sim-effect]').count()) === 2 && /GP-BEAUTY15\s*SAR 40\.05 off on 3 units/.test(await text(lineEffects(page, 1))) && /PTS-50OFF\s*SAR 50\.00 off the sale/.test(await text(lineEffects(page, 1))),
    await text(lineEffects(page, 1)))
  check('7: points taken as a tender, on the whole sale', /PTS-50OFF\s*SAR 30\.00 of points taken as a tender/.test(await text(page.locator('[data-sim-session]'))))
  check('7: three near misses, money and items', (await page.locator('[data-sim-near-miss]').count()) === 3 && /add SAR 102\.05/.test(await text(page.locator('[data-sim-near-miss="NEXT-VISIT"]'))))
  await page.screenshot({ path: `${SHOTS}/525-csv-lines.png`, fullPage: true })

  // ── 8 ──
  await page.locator('[data-basket-typed]').click()
  await page.locator('[data-basket-upload]').click()
  await page.locator('[data-csv-file]').setInputFiles({ name: 'bahrain.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFFSKU,Qty,Net\r\nSER-VC,1,8.927\r\nSUN-50,1,5.517\r\n') })
  await page.waitForFunction(() => document.querySelectorAll('[data-csv-check="ok"]').length === 2)
  check('8: an uploaded file fills the text and is checked', (await page.locator('[data-csv-text]').inputValue()).includes('SER-VC,1,8.927'))
  await page.locator('[data-csv-use]').click()
  await field(page, 'store').selectOption('M01')
  await field(page, 'country').selectOption('BH')
  await field(page, 'member').fill('')
  await runAndWait(page, runs)
  await page.waitForFunction(() => document.querySelector('[data-sim-total="net"] dd')?.textContent?.startsWith('BHD'))
  check('8: a Bahraini sale reads BHD at three decimals', (await total(page, 'net')) === 'BHD 14.444' && (await total(page, 'discount')) === 'BHD 1.000', await total(page, 'discount'))
  check('8: …the run sent BHD, three decimals and a walk-in', runs.at(-1).currency === 'BHD' && runs.at(-1).decimals === 3 && runs.at(-1).profile.loyaltyId === '' && runs.at(-1).storeCode === 'M01')
  check('8: …and BH-SPEND10 on its lines, at three decimals', /BH-SPEND10\s*BHD 0\.618 off the sale, its share on this line/.test(await text(lineEffects(page, 1))), await text(lineEffects(page, 1)))
  check('11: a bonus-buy store says the rule campaigns do not apply at its till', /do not apply until the store is flipped/.test(await text(page.locator('[data-sim-bonus-buy]'))))

  // ── 9 ──
  await page.locator('[data-basket-typed]').click()
  await page.locator('[data-basket-remove="SHA-400"]').click()
  await page.locator('[data-basket-remove="PAN-24"]').click()
  await addItem(page, 'SER-VC', 'SER-VC')
  await setQty(page, 'SER-VC', 4)
  await setPrice(page, 'SER-VC', 89)
  await field(page, 'country').selectOption('SA')
  await field(page, 'store').selectOption('J204')
  await runAndWait(page, runs)
  await page.waitForFunction(() => document.querySelector('[data-sim-total="net"] dd')?.textContent === 'SAR 356.00')
  const coupon = page.locator('[data-sim-session] [data-sim-effect="createdCoupon"]')
  check('9: a basket of SAR 300 — NEXT-VISIT will create a coupon, its label in both languages',
    (await coupon.count()) === 1 && /NEXT-VISIT\s*Will create a WKND20 coupon at close/.test(await text(coupon)) && (await coupon.locator('[data-says-ar]').innerText()) === 'قسيمة نهاية الأسبوع',
    await text(page.locator('[data-sim-session]')))

  // ── 10 ──
  await page.goto(`${BASE}/campaigns/BDAY-BEAUTY`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 15000 })
  await page.locator('[data-campaign-actions]').click()
  await page.locator('[data-campaign-action="simulate"]').click()
  await page.waitForURL(`${BASE}/campaigns/simulator?draft=BDAY-BEAUTY`)
  const chip = page.locator('[data-sim-draft="BDAY-BEAUTY"]')
  await chip.locator('[data-sim-draft-name]').waitFor({ timeout: 10000 })
  check('10: "Simulate the working copy" opens the simulator on that draft, both names shown',
    /BDAY-BEAUTY/.test(await chip.innerText()) && /Birthday week: 10% off Beauty Care/.test(await chip.innerText()) && (await chip.locator('[dir="rtl"]').innerText()).length > 0 &&
      (await chip.getAttribute('data-sim-draft-sent')) === 'BDAY-BEAUTY')
  for (const { sku, qty: n } of SIX_BASKETS.default.lines) {
    await addItem(page, sku, sku)
    if (n > 1) await setQty(page, sku, n)
    await setPrice(page, sku, CATALOG[sku][0])
  }
  await field(page, 'store').selectOption('R101')
  await runAndWait(page, runs)
  await page.waitForFunction(() => document.querySelector('[data-sim-total="net"] dd')?.textContent === 'SAR 379.75')
  check('10: Run sends the draft\'s id, and no campaign', runs.at(-1).draft === 'BDAY-BEAUTY' && !('campaign' in runs.at(-1)), JSON.stringify(runs.at(-1)).slice(0, 120))
  check('10: it says the campaign ran as its draft', /BDAY-BEAUTY ran as its draft\./.test(await text(page.locator('[data-sim-based]'))))
  const prompt = page.locator('[data-sim-session] [data-sim-effect="prompt"]')
  check('10: the cashier prompt is on the whole sale, in both languages',
    /Scan a travel pouch/.test(await text(prompt)) && (await prompt.locator('[data-says-ar]').innerText()) === 'امسح حقيبة السفر: مجانية مع السيروم')
  const offer = page.locator('[data-sim-session] [data-sim-effect="offer"]')
  check('10: an offer asks the customer, its words in both languages', (await offer.count()) === 1 && /Pay 30 points for SAR 50 off\?/.test(await text(offer)))
  await page.locator('[data-sim-offer-yes="PTS-50OFF"]').check()
  check('10: a yes changes the sale — the result is stale', (await page.locator('[data-sim-stale]').count()) === 1)
  await runAndWait(page, runs)
  await page.waitForFunction(() => !document.querySelector('[data-sim-stale]'))
  check('10: the yes goes back as the offer\'s flag', JSON.stringify(runs.at(-1).flags) === '["PTS-50OFF"]' && (await page.locator('[data-sim-effect="offer"]').count()) === 0)

  // ── 13 ──
  stub.invalid['BDAY-BEAUTY'] = [CHECKER_LINE]
  await setQty(page, 'PAN-24', 2)
  await runAndWait(page, runs)
  await page.locator('[data-sim-refusal-lines]').waitFor({ timeout: 5000 })
  const block = page.locator('[data-sim-refusal-line="campaign.rules[0].then[0].value"]')
  check('13: a draft the checker refuses is listed by block — where, what, and the path',
    (await refusalCode(page)) === 'RULES_INVALID_CAMPAIGN' && (await text(block.locator('[data-sim-refusal-where]'))) === 'rule 1 → effect 1 → value' &&
      /a percent is more than 0 and at most 100/.test(await text(block)) && /campaign\.rules\[0\]\.then\[0\]\.value/.test(await text(block)), await text(page.locator('[data-sim-refusal-lines]')))
  check('13: …with the way to the campaign', (await page.locator('[data-sim-refusal-open]').getAttribute('href')) === '/campaigns/BDAY-BEAUTY')
  delete stub.invalid['BDAY-BEAUTY']
  await page.screenshot({ path: `${SHOTS}/525-invalid.png`, fullPage: true })

  await page.locator('[data-sim-drop-draft]').click()
  await page.waitForURL(`${BASE}/campaigns/simulator`)
  await page.locator('[data-sim-draft]').waitFor({ state: 'detached', timeout: 5000 })
  check('10: the draft is dropped from the address', page.url() === `${BASE}/campaigns/simulator` && (await page.locator('[data-sim-draft]').count()) === 0)
  await runAndWait(page, runs)
  check('10: run live, no draft is sent', !('draft' in runs.at(-1)), JSON.stringify(runs.at(-1)).slice(0, 120))

  // A campaign with no saved draft (PCUT-SA01 is live only): it runs as the live version.
  await page.goto(`${BASE}/campaigns/simulator?draft=PCUT-SA01`)
  const live = page.locator('[data-sim-draft="PCUT-SA01"]')
  await live.locator('[data-sim-draft-name]').waitFor({ timeout: 10000 })
  check('10: a campaign with no saved draft says it runs live, and sends no draft', /no saved draft/.test(await text(live)) && (await live.getAttribute('data-sim-draft-sent')) === '')

  check('12: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
