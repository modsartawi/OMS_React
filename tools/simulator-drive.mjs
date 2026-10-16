// Simulator drive (spec 2737, ticket 514): Campaigns ▸ Simulator, the rule engine's dry run.
//
// Drives the REAL app in Chromium against STUBS. No HQ contract exists yet (BackOffice 2758 is
// unwritten), so the stubs serve the PROVISIONAL shapes of `src/core/models/rule-campaign.ts` on the
// REAL envelope { statusCode, success, message, errors: [{ errorCode, internalErrorCode,
// errorMessage }], data }; ticket 520 re-points them:
//   POST RuleCampaign/Simulate             → tools/simulator-fixtures.mjs `simulate`: the prototype's
//                                            six baskets with the prototype engine's answers; the
//                                            first `refuseRun` runs are refused
//   GET  RuleCampaign/Lookups/{Materials|Stores|Channels}?search= → tools/campaigns-fixtures.mjs `lookup`
//   GET  RuleCampaign/Campaigns[/{id}], …/Validate, RuleCampaign/Roles → the dashboard's way in
// Never a live SIS.Api.
//
// It asserts:
//   1. the Campaigns group has a Simulator leaf, ungated, that opens /campaigns/simulator and lights itself;
//   2. before a run: no result, Run off, the date and time are today's LOCAL now;
//   3. a TYPED basket: items found by SKU or name, a repeat adds to its line, a quantity typed, a line removed;
//   4. Run POSTs the basket, store, member, channel and the LOCAL moment (no Z), live versions only;
//   5. the result: totals, effects per line with both labels, the effects on the whole sale, near misses
//      with their gap, and the trace per campaign (rules, conditions met / not, the group, a skip's reason);
//   6. a changed sale marks the result stale;
//   7. a CSV basket, pasted: bad rows flagged row by row and the rows refused until fixed; then they
//      replace the basket and the run shows a free unit, points taken and three near misses;
//   8. a CSV basket, uploaded as a file at a Bahraini store: three decimals in BHD;
//   9. a basket of SAR 300 shows the coupon NEXT-VISIT "will create";
//  10. the dashboard's "Simulate the working copy" opens the simulator on that draft, and Run sends it;
//      "Use every working copy" sends includeDrafts;
//  11. a refused run shows the door's own message; a bonus-buy store says rule campaigns never apply;
//  12. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/simulator-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { CAMPAIGNS, listRow, lookup } from './campaigns-fixtures.mjs'
import { SIX_BASKETS, simulate } from './simulator-fixtures.mjs'
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

const RUN_REFUSED = 'The store D999 is not known to HQ. / المتجر D999 غير معروف.'

const browser = await chromium.launch()

async function open({ refuseRun = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const runs = []
  let refusals = refuseRun
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
    // PROVISIONAL doors (ticket 520 re-points them).
    if (p === 'RuleCampaign/Simulate' && req.method() === 'POST') {
      const body = req.postDataJSON()
      runs.push(body)
      if (refusals > 0) {
        refusals--
        return route.fulfill(envelope(null, { status: 409, success: false, message: RUN_REFUSED, errorCode: 'RULE_SIM_UNKNOWN_STORE' }))
      }
      return route.fulfill(envelope(simulate(body)))
    }
    const lk = /^RuleCampaign\/Lookups\/(Materials|Stores|Channels)$/.exec(p)
    if (lk && req.method() === 'GET') return route.fulfill(envelope(lookup(lk[1].toLowerCase(), url.searchParams.get('search') ?? '')))
    if (p === 'RuleCampaign/Campaigns' && req.method() === 'GET') return route.fulfill(envelope(CAMPAIGNS.map(listRow)))
    const one = /^RuleCampaign\/Campaigns\/([^/]+)$/.exec(p)
    if (one && req.method() === 'GET') return route.fulfill(envelope(CAMPAIGNS.find((c) => c.id === decodeURIComponent(one[1]))))
    if (/^RuleCampaign\/Campaigns\/[^/]+\/Validate$/.test(p)) return route.fulfill(envelope({ messages: [] }))
    if (p === 'RuleCampaign/Roles') return route.fulfill(envelope({ author: true, approver: false }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, runs }
}

/** A locator's text without the bidi isolates (FSI…PDI) the page wraps values in. */
const text = async (loc) => (await loc.innerText()).replace(/[⁦-⁩]/g, '')
const run = (page) => page.locator('[data-sim-run]')
const field = (page, k) => page.locator(`[data-sim-field="${k}"]`)
const basketSkus = (page) => page.$$eval('[data-basket-line]', (els) => els.map((e) => e.getAttribute('data-basket-line')))
const qty = (page, sku) => page.locator(`[data-basket-qty="${sku}"]`)

async function addItem(page, search, sku) {
  await page.locator('[data-basket-find]').fill(search)
  await page.locator(`[data-basket-hit="${sku}"]`).click()
}
async function setQty(page, sku, n) {
  await qty(page, sku).fill(String(n))
  await qty(page, sku).press('Enter')
}
const total = (page, k) => page.locator(`[data-sim-total="${k}"] dd`).innerText()
const lineEffects = (page, line) => page.locator(`[data-sim-line-effects="${line}"]`)

{
  const { context, page, errors, calls, runs } = await open({ refuseRun: 1 })
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns/simulator"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Simulator leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns/simulator`)
  await page.locator('[data-simulator]').waitFor({ timeout: 15000 })
  check('1: it opens /campaigns/simulator and lights itself, not Campaigns',
    (await leaf.getAttribute('aria-current')) === 'page' && (await page.locator('a[href="/campaigns"]').first().getAttribute('aria-current')) !== 'page')
  check('1: ungated — no probe call was made', !calls.some((c) => /RuleCampaign\/Access/.test(c)))

  // ── 2 ──
  check('2: no result yet, and Run is off', (await page.locator('[data-sim-no-result]').count()) === 1 && (await run(page).isDisabled()) && (await page.locator('[data-sim-needs]').count()) === 1)
  check('2: the date and time are today\'s LOCAL now', (await field(page, 'date').inputValue()) === '2026-10-16' && (await field(page, 'time').inputValue()) === '18:30',
    `${await field(page, 'date').inputValue()} ${await field(page, 'time').inputValue()}`)
  await page.locator('[data-sim-field="channel"] option[value="POS"]').waitFor({ state: 'attached' })
  check('2: the channel starts on the first HQ lists', (await field(page, 'channel').inputValue()) === 'POS')
  check('2: the store waits to be chosen', (await field(page, 'store').inputValue()) === '')

  // ── 3 ──
  await addItem(page, 'sha-400', 'SHA-400')
  await addItem(page, 'paracetamol', 'PAN-24')
  await addItem(page, 'SHA-400', 'SHA-400')
  check('3: items found by SKU or by name; a repeat adds to its line', JSON.stringify(await basketSkus(page)) === '["SHA-400","PAN-24"]' && (await qty(page, 'SHA-400').inputValue()) === '2')
  check('3: a line shows the SKU and the name HQ gave it', /Paracetamol 500mg, 24 tabs/.test(await page.locator('[data-basket-line="PAN-24"]').innerText()))
  await setQty(page, 'PAN-24', 3)
  await qty(page, 'SHA-400').fill('0')
  await qty(page, 'SHA-400').press('Enter')
  check('3: a quantity is typed; a 0 is put back', (await qty(page, 'PAN-24').inputValue()) === '3' && (await qty(page, 'SHA-400').inputValue()) === '2')
  await addItem(page, 'serum', 'SER-VC')
  await page.locator('[data-basket-remove="SER-VC"]').click()
  check('3: a line is removed', JSON.stringify(await basketSkus(page)) === '["SHA-400","PAN-24"]')
  check('3: Run waits for a store', await run(page).isDisabled())
  await field(page, 'store').selectOption('R101')
  await field(page, 'member').fill('M-208877')
  check('3: …then it may run', !(await run(page).isDisabled()) && (await page.locator('[data-sim-needs]').count()) === 0)

  // ── 11a: a refused run ──
  await run(page).click()
  await page.getByText(RUN_REFUSED).waitFor({ timeout: 5000 })
  check('11: a refused run shows the door\'s own message', await page.getByText(RUN_REFUSED).isVisible())

  // ── 4 ──
  await run(page).click()
  await page.locator('[data-sim-totals]').waitFor({ timeout: 5000 })
  const body = runs.at(-1)
  check('4: Run POSTs the basket, store, member, channel and moment',
    JSON.stringify(body) === JSON.stringify({
      basket: [{ sku: 'SHA-400', qty: 2 }, { sku: 'PAN-24', qty: 3 }], store: 'R101', memberId: 'M-208877', channel: 'POS',
      at: '2026-10-16T18:30:00', includeDrafts: false, draftId: null,
    }), JSON.stringify(body))
  check('4: the moment is local, never a Z', !/Z$/.test(body.at))

  // ── 5 ──
  check('5: totals — gross, discounts, to pay', (await total(page, 'gross')) === 'SAR 83.25' && (await total(page, 'discount')) === 'SAR 15.40' && (await total(page, 'net')) === 'SAR 67.85',
    `${await total(page, 'gross')} ${await total(page, 'discount')} ${await total(page, 'net')}`)
  await lineEffects(page, 1).waitFor()
  const l1 = lineEffects(page, 1).locator('[data-sim-effect]')
  check('5: effects per line — PCUT-SA01 takes SAR 10.00 off line 1', (await l1.count()) === 1 && /PCUT-SA01\s*SAR 10\.00 off/.test(await text(l1)), await text(l1))
  check('5: …with its receipt label in both languages',
    (await l1.locator('[data-says-en]').innerText()) === 'Price cut' && (await l1.locator('[data-says-ar]').innerText()) === 'تخفيض السعر' && (await l1.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
  check('5: grid cells carry no FSI / PDI (they would reach Ctrl+C)', !/[⁦-⁩]/.test(await page.locator('[data-sim-lines]').innerText()))
  check('5: …and SAR 5.40 off line 2', /SAR 5\.40 off/.test(await text(lineEffects(page, 2))))
  const lineRow = page.locator('[data-sim-lines] .ag-row[row-id="2"]')
  check('5: the line reads its gross, off and net', /29\.25/.test(await lineRow.innerText()) && /5\.40/.test(await lineRow.innerText()) && /23\.85/.test(await lineRow.innerText()))
  const sess = page.locator('[data-sim-session]')
  check('5: the whole sale — WLCB 7 points and BASE-EARN points, pending',
    /WLCB\s*7 points earned, pending/.test(await text(sess)) && (await sess.locator('[data-sim-effect-code="BASE-EARN"][data-sim-effect="points"]').count()) === 1, await text(sess))
  const near = page.locator('[data-sim-near-miss="SUN-3FOR2"]')
  check('5: a near miss with its gap and the offer, both languages',
    /3 more items of sun for Suncare 3 for 2/.test(await text(near)) && (await near.locator('[data-says-ar]').innerText()) === 'العناية بالشمس 3 بسعر 2', await text(near))
  await page.locator('[data-sim-tab="trace"]').click()
  await page.locator('[data-sim-trace]').waitFor()
  check('5: the trace counts the campaigns by outcome', /3 applied · 7 not met · 3 skipped · 0 stopped by a budget · 0 lost in a group/.test(await text(page.locator('[data-sim-trace-summary]'))),
    await text(page.locator('[data-sim-trace-summary]')))
  const bday = page.locator('[data-sim-trace-campaign="BDAY-BEAUTY"]')
  check('5: a skipped campaign says why, its rules not reached',
    (await bday.getAttribute('data-sim-outcome')) === 'skipped' && (await bday.locator('[data-sim-trace-reason]').innerText()) === 'draft, not published' &&
      (await bday.locator('[data-sim-trace-rule][data-ran="false"]').count()) >= 1)
  const gp = page.locator('[data-sim-trace-campaign="GP-BEAUTY15"]')
  check('5: a campaign not met shows which conditions passed and failed, in both languages',
    (await gp.getAttribute('data-sim-outcome')) === 'notMet' && (await gp.locator('[data-sim-condition][data-met="false"]').count()) >= 1 &&
      (await gp.locator('[data-sim-condition] [data-says-ar]').count()) >= 1)
  const wknd = page.locator('[data-sim-trace-campaign="WKND20"]')
  check('5: a grouped campaign names its group and mode', (await text(wknd.locator('[data-sim-trace-group]'))) === 'In Basket offers · first that yields')
  const pcut = page.locator('[data-sim-trace-campaign="PCUT-SA01"]')
  check('5: an applied campaign in the base, with both names, its rule ran',
    (await pcut.getAttribute('data-sim-outcome')) === 'applied' && /Base group/.test(await pcut.locator('[data-sim-trace-group]').innerText()) &&
      (await pcut.locator('[data-says-ar]').first().innerText()).startsWith('تخفيضات') && (await pcut.locator('[data-sim-trace-rule][data-ran="true"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/514-typed-trace.png`, fullPage: true })
  await page.locator('[data-sim-tab="lines"]').click()

  // ── 6 ──
  check('6: not stale right after a run', (await page.locator('[data-sim-stale]').count()) === 0)
  await setQty(page, 'PAN-24', 4)
  check('6: a changed sale marks the result stale', (await page.locator('[data-sim-stale]').count()) === 1)

  // ── 7 ──
  await page.locator('[data-basket-upload]').click()
  await page.locator('[data-csv-text]').fill('sku,qty\nSER-VC,3\nAMOX-500,0\nNOPE-1,1\n,2\nGIFT-BAG,')
  await page.waitForFunction(() => document.querySelectorAll('[data-csv-check]').length === 5 && !document.querySelector('[data-csv-check="checking"]'))
  const checkOf = (line) => page.locator(`[data-csv-preview] .ag-row[row-id="${line}"] [data-csv-check]`).getAttribute('data-csv-check')
  check('7: each row is checked — good, bad quantity, unknown SKU, no SKU',
    (await checkOf(2)) === 'ok' && (await checkOf(3)) === 'badQty' && (await checkOf(4)) === 'unknownSku' && (await checkOf(5)) === 'noSku' && (await checkOf(6)) === 'ok',
    JSON.stringify([await checkOf(2), await checkOf(3), await checkOf(4), await checkOf(5), await checkOf(6)]))
  check('7: a good row reads its item\'s name', (await page.locator('[data-csv-preview] .ag-row[row-id="2"]').innerText()).includes('Vitamin C serum 30ml'))
  check('7: the rows are refused until every one is good', (await page.locator('[data-csv-use]').isDisabled()) && (await page.locator('[data-csv-fix]').count()) === 1 &&
    /2 good · 3 to fix · 0 being checked/.test(await text(page.locator('[data-csv-tally]'))))
  await page.locator('[data-csv-text]').fill('sku,qty\nSER-VC,3\nAMOX-500,1\nGIFT-BAG,')
  await page.waitForFunction(() => document.querySelectorAll('[data-csv-check="ok"]').length === 3)
  check('7: fixed, the rows may be used', !(await page.locator('[data-csv-use]').isDisabled()) && (await text(page.locator('[data-csv-use]'))) === 'Use 3 rows')
  await page.locator('[data-csv-use]').click()
  check('7: they replace the basket, a blank quantity read as 1',
    JSON.stringify(await basketSkus(page)) === '["SER-VC","AMOX-500","GIFT-BAG"]' && (await qty(page, 'SER-VC').inputValue()) === '3' && (await qty(page, 'GIFT-BAG').inputValue()) === '1' &&
      (await page.locator('[data-basket-csv]').count()) === 0)
  await field(page, 'member').fill('M-055410')
  await run(page).click()
  await page.waitForFunction(() => document.querySelector('[data-sim-total="gross"] dd')?.textContent === 'SAR 300.00')
  check('7: the CSV basket runs — totals', (await total(page, 'net')) === 'SAR 197.95')
  check('7: line 3 shows GIFT-POUCH\'s free unit', /GIFT-POUCH\s*1 free unit, worth SAR 12\.00/.test(await text(lineEffects(page, 3))), await text(lineEffects(page, 3)))
  check('7: line 1 shows two campaigns', (await lineEffects(page, 1).locator('[data-sim-effect]').count()) === 2)
  check('7: points taken as a tender, on the whole sale', /PTS-50OFF\s*SAR 30\.00 of points taken as a tender/.test(await text(page.locator('[data-sim-session]'))))
  check('7: three near misses, money and items', (await page.locator('[data-sim-near-miss]').count()) === 3 && /add SAR 102\.05 for/.test(await text(page.locator('[data-sim-near-miss="NEXT-VISIT"]'))))
  await page.screenshot({ path: `${SHOTS}/514-csv-lines.png`, fullPage: true })

  // ── 8 ──
  await page.locator('[data-basket-upload]').click()
  await page.locator('[data-csv-file]').setInputFiles({ name: 'bahrain.csv', mimeType: 'text/csv', buffer: Buffer.from('\uFEFFSKU;Quantity\r\nSER-VC;1\r\nSUN-50;1\r\n') })
  await page.waitForFunction(() => document.querySelectorAll('[data-csv-check="ok"]').length === 2)
  check('8: an uploaded file fills the text and is checked', (await page.locator('[data-csv-text]').inputValue()).includes('SER-VC;1'))
  await page.locator('[data-csv-use]').click()
  check('8: …and replaces the basket', JSON.stringify(await basketSkus(page)) === '["SER-VC","SUN-50"]')
  await field(page, 'store').selectOption('M01')
  await field(page, 'member').fill('')
  await run(page).click()
  await page.waitForFunction(() => document.querySelector('[data-sim-total="gross"] dd')?.textContent?.startsWith('BHD'))
  check('8: a Bahraini store reads BHD at three decimals', (await total(page, 'gross')) === 'BHD 14.444' && (await total(page, 'discount')) === 'BHD 1.000', await total(page, 'discount'))
  check('8: …the run sent no member (a walk-in)', runs.at(-1).memberId === null && runs.at(-1).store === 'M01')
  check('8: …and BH-SPEND10 on its lines, at three decimals', /BH-SPEND10\s*BHD 0\.618 off/.test(await text(lineEffects(page, 1))))

  // ── 9 ──
  await page.locator('[data-basket-remove="SUN-50"]').click()
  await setQty(page, 'SER-VC', 4)
  await field(page, 'store').selectOption('J204')
  await run(page).click()
  await page.waitForFunction(() => document.querySelector('[data-sim-total="gross"] dd')?.textContent === 'SAR 356.00')
  const coupon = page.locator('[data-sim-session] [data-sim-effect="createCoupon"]')
  check('9: a basket of SAR 300 — NEXT-VISIT will create a coupon', (await coupon.count()) === 1 && /NEXT-VISIT\s*Will create a WKND20 coupon at close/.test(await text(coupon)), await text(page.locator('[data-sim-session]')))

  // ── 11b ──
  await field(page, 'store').selectOption('D310')
  await run(page).click()
  await page.locator('[data-sim-bonus-buy]').waitFor({ timeout: 5000 })
  check('11: a bonus-buy store says rule campaigns never apply there', /never apply here/.test(await page.locator('[data-sim-bonus-buy]').innerText()))

  // ── 10 ──
  await page.goto(`${BASE}/campaigns/BDAY-BEAUTY`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 15000 })
  await page.locator('[data-campaign-actions]').click()
  await page.locator('[data-campaign-action="simulate"]').click()
  await page.waitForURL(`${BASE}/campaigns/simulator?draft=BDAY-BEAUTY`)
  const chip = page.locator('[data-sim-draft="BDAY-BEAUTY"]')
  await chip.locator('[data-sim-draft-name]').waitFor({ timeout: 10000 })
  check('10: "Simulate the working copy" opens the simulator on that draft, both names shown',
    /BDAY-BEAUTY/.test(await chip.innerText()) && /Birthday week: 10% off Beauty Care/.test(await chip.innerText()) && (await chip.locator('[dir="rtl"]').innerText()).length > 0)
  check('10: with one working copy chosen, "every working copy" is off', await field(page, 'includeDrafts').isDisabled())
  for (const { sku, qty: n } of SIX_BASKETS.default.basket) {
    await addItem(page, sku, sku)
    if (n > 1) await setQty(page, sku, n)
  }
  await field(page, 'store').selectOption('R101')
  await run(page).click()
  await page.waitForFunction(() => document.querySelector('[data-sim-total="gross"] dd')?.textContent === 'SAR 379.75')
  check('10: Run sends the draft\'s id, live versions for the rest', runs.at(-1).draftId === 'BDAY-BEAUTY' && runs.at(-1).includeDrafts === false, JSON.stringify(runs.at(-1)))
  check('10: the default basket\'s cashier prompt is on the whole sale, in both languages',
    /Scan a travel pouch/.test(await text(page.locator('[data-sim-session] [data-sim-effect="message"]'))) &&
      (await page.locator('[data-sim-session] [data-sim-effect="message"] [data-says-ar]').innerText()) === 'امسح حقيبة السفر: مجانية مع السيروم')
  await page.locator('[data-sim-drop-draft]').click()
  await page.waitForURL(`${BASE}/campaigns/simulator`)
  await page.locator('[data-sim-draft]').waitFor({ state: 'detached', timeout: 5000 })
  check('10: the draft is dropped from the address', page.url() === `${BASE}/campaigns/simulator` && (await page.locator('[data-sim-draft]').count()) === 0)
  await field(page, 'includeDrafts').check()
  const sent = runs.length
  await run(page).click()
  for (let i = 0; i < 50 && runs.length === sent; i++) await page.waitForTimeout(100)
  check('10: "every working copy" sends includeDrafts, no draft id', runs.at(-1).includeDrafts === true && runs.at(-1).draftId === null, JSON.stringify(runs.at(-1)))
  await page.screenshot({ path: `${SHOTS}/514-draft.png`, fullPage: true })

  check('12: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
