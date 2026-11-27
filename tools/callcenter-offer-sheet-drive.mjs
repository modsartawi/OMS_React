// The offer sheet (ticket 997, spec 995 B), driven in the REAL app on a v1.14 stub.
//
//   1. run the app:  npx vite --port 5211
//   2. DRIVE_PORT=5211 node tools/callcenter-offer-sheet-drive.mjs
//
// 🚩 `OfferWhatIf` (C3) is BackOffice 4459, unbuilt, and the near-miss facts (C1/C2) are 859 + 4458:
// the near-miss and the what-if here are stubs of exactly those shapes, filled with the owner's
// walk case (tier S, 509366 × 1 at P721, bonus buy OMS000004571, buy 3 get 1 free at 98.00, phone
// only, tiers P,G,S). The what-if's figures are the engine's answer that case should give
// (saving 98.00, 98.00 → 294.00, 73.50 each) — stub figures, not a live price.
//
// Asserts ticket 997's proof, counting the real requests:
//   1. 🚩 a closed card makes no OfferWhatIf call (whatIfIsReadOnlyOnOpen);
//   2. the title opens the sheet over the summary column; ONE read; Saves = the engine's saving,
//      Each works out = its unitAfter, Ends = the day + days left; how it works, who, the script;
//      the BBY chip *for support*;
//   3. 🚩 a basket change with the sheet open (a + on another line) → exactly ONE re-read
//      (basketChangeMakesTheWhatIfStale);
//   4. Add 3 from the sheet → ONE AddItem of 509366 × 3 → the offer fires → the sheet says
//      *Applied* and closes to card D, which takes focus; no read after it fired;
//   5. 🚩 a failed read shows the definition (*100% off 1*) and *Couldn't price this right now*,
//      never a figure (failedWhatIfShowsTheDefinitionNotAFigure);
//   6. Escape closes it and focus returns to the card's title; *Open* opens it too;
//   7. below 1280 px it is a full-height overlay.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5211}`
const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8')).response
    .body.data

const OPEN_RESULT = fixture('01-open-empty')
const PRICED = fixture('02-two-lines-priced')

const pad = (n) => String(n).padStart(2, '0')
const inDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const LINE = {
  ...PRICED.lines[0],
  lineId: 'L10',
  lineNumber: 1,
  itemNumber: '509366',
  description: 'OWNER CASE ITEM 509366',
  qty: 1,
  unitPrice: { net: 85.22, gross: 98 },
  lineTotal: { net: 85.22, gross: 98 },
  conditions: [],
  promotions: [],
}
// Another line, to change the basket with the sheet open.
const OTHER = { ...LINE, lineId: 'L11', lineNumber: 2, itemNumber: '100200', description: 'OTHER ITEM 100200', unitPrice: { net: 8.7, gross: 10 }, lineTotal: { net: 8.7, gross: 10 } }

const OWNER = {
  offerId: 'OMS000004571',
  description: '3+1',
  isReady: false,
  progress: { have: 0, need: 1, unitsHave: 1, unitsNeed: 3 },
  prereq: { kind: 'material', materialNumber: '509366' },
  skipReason: null,
  definition: { buyQty: 3, buyUom: 'EA', getQty: 1, getSameItem: true, discountType: 'percent', discountValue: 100 },
  endsOn: inDays(6),
  audience: { channelOnly: true, tiers: ['P', 'G', 'S'], callerQualifies: true },
}

const RESOLUTION = {
  offerId: OWNER.offerId,
  prereq: OWNER.prereq,
  items: [{ itemNumber: '509366', description: LINE.description, description2: 'صنف', estimatePriceExVat: 85.22, atp: 12 }],
  truncated: false,
  topN: 25,
}

const WHAT_IF = {
  offerId: OWNER.offerId,
  adds: [{ itemNumber: '509366', qty: 3 }],
  fires: true,
  saving: 98,
  payableBefore: 108,
  payableAfter: 304,
  unitAfter: 73.5,
}

const BEFORE = { ...PRICED, lines: [LINE, OTHER], firedPromotions: [], nearMisses: [OWNER] }
// The other line at 2: the basket moved, the offer is still one step away.
const MOVED = { ...BEFORE, version: PRICED.version + 1, lines: [LINE, { ...OTHER, qty: 2, lineTotal: { net: 17.4, gross: 20 } }] }
// The engine's answer to the add: the line at 4, the offer fired for −98.00 on it.
const AFTER = {
  ...MOVED,
  version: PRICED.version + 2,
  lines: [{ ...LINE, qty: 4, lineTotal: { net: 255.65, gross: 294 } }, MOVED.lines[1]],
  firedPromotions: [{ offerId: OWNER.offerId, description: '3+1', amount: -98, lineIds: ['L10'] }],
  nearMisses: [],
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: status < 400, message: status < 400 ? '' : 'boom', errors: [], data }),
})
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function open(browser, { state = BEFORE, whatIfFails = false, width = 1440 } = {}) {
  const calls = { whatIf: [], add: [], qty: [] }
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'CallCenterWeb/OfferWhatIf') {
      calls.whatIf.push(url)
      return route.fulfill(whatIfFails ? envelope(null, 500) : envelope(WHAT_IF))
    }
    if (p === 'CallCenterWeb/ResolvePrereq') return route.fulfill(envelope(RESOLUTION))
    if (p === 'CallCenterWeb/ChangeQty') {
      calls.qty.push(JSON.parse(route.request().postData() ?? '{}'))
      return route.fulfill(envelope(MOVED))
    }
    if (p === 'CallCenterWeb/AddItem') {
      calls.add.push(JSON.parse(route.request().postData() ?? '{}'))
      return route.fulfill(envelope(AFTER))
    }
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ ...OPEN_RESULT, outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    if (p === 'CallCenterWeb/ItemSearch') return route.fulfill(envelope({ truncated: false, atpAvailable: true, rows: [] }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
  await page.locator('[data-cc-promotions]').waitFor({ timeout: 10_000 })
  return { context, page, errors, calls }
}

const strip = (s) => s.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
const text = async (page, selector) => strip(await page.locator(selector).first().innerText())

const CARD = `[data-cc-offer-card][data-cc-card="${OWNER.offerId}"]`
const SHEET = `[data-cc-offer-sheet="${OWNER.offerId}"]`

async function run() {
  const browser = await chromium.launch()

  {
    const { context, page, errors, calls } = await open(browser)
    await page.locator(CARD).waitFor({ timeout: 10_000 })
    await wait(600)

    // 1
    check('🚩 a closed card makes no OfferWhatIf call', calls.whatIf.length === 0, `${calls.whatIf.length} call(s)`)
    check('the card has no sheet open', (await page.locator(SHEET).count()) === 0)

    // 2
    await page.locator(`${CARD} [data-cc-offer-title]`).click()
    await page.locator(SHEET).waitFor({ timeout: 5_000 })
    await page.locator(`${SHEET} [data-cc-offer-sheet-saving]`).waitFor({ timeout: 5_000 })
    check('opening the sheet makes ONE read', calls.whatIf.length === 1, `${calls.whatIf.length}`)
    check(
      'of this order and this offer',
      /transactionId=/.test(calls.whatIf[0] ?? '') && (calls.whatIf[0] ?? '').includes(`offerId=${OWNER.offerId}`),
      calls.whatIf[0],
    )
    const sheetBox = await page.locator(SHEET).boundingBox()
    const receiptBox = await page.locator('[data-cc-receipt]').boundingBox()
    check(
      'the sheet lies over the summary column',
      Math.abs(sheetBox.x - receiptBox.x) < 2 && Math.abs(sheetBox.width - receiptBox.width) < 2,
      `sheet x ${Math.round(sheetBox.x)} w ${Math.round(sheetBox.width)} · receipt x ${Math.round(receiptBox.x)} w ${Math.round(receiptBox.width)}`,
    )
    check('the header says Offer · phone orders only', (await text(page, `${SHEET} header`)).startsWith('Offer · phone orders only'), await text(page, `${SHEET} header`))
    check('the headline and the item', (await text(page, `${SHEET} [data-cc-offer-sheet-headline]`)) === 'Buy 3, get the 4th free' && /509366 · OWNER CASE ITEM 509366/.test(await text(page, `${SHEET} [data-cc-offer-sheet-item]`)), await text(page, `${SHEET} [data-cc-offer-sheet-item]`))
    check('Saves is the engine’s saving', /^98\.00\s*SAR$/.test(await text(page, `${SHEET} [data-cc-offer-sheet-figure="saves"] dd`)), await text(page, `${SHEET} [data-cc-offer-sheet-figure="saves"] dd`))
    check('Each works out is the engine’s unitAfter (never divided)', /^73\.50\s*SAR$/.test(await text(page, `${SHEET} [data-cc-offer-sheet-figure="each"] dd`)), await text(page, `${SHEET} [data-cc-offer-sheet-figure="each"] dd`))
    const ends = await text(page, `${SHEET} [data-cc-offer-sheet-figure="ends"] dd`)
    check('Ends: the day and 6 days left', /^\w{3} \d{1,2} \w{3} 6 days left$/.test(ends), ends)
    check('the total it becomes, from the engine', (await text(page, `${SHEET} [data-cc-offer-sheet-total]`)) === 'The order goes from 108.00 to 304.00.', await text(page, `${SHEET} [data-cc-offer-sheet-total]`))
    const how = await text(page, `${SHEET} [data-cc-offer-sheet-section="how"]`)
    check('how it works: the buy and the get side in words, and a bar in units', /Buy 3 of this item/.test(how) && /get 1 more of it free/.test(how) && /1 of 4 in the basket/.test(how), how)
    check('the bar is units: 1 of 4', (await page.locator(`${SHEET} [role="progressbar"]`).getAttribute('aria-valuenow')) === '1' && (await page.locator(`${SHEET} [role="progressbar"]`).getAttribute('aria-valuemax')) === '4')
    check('Add to the order: one row, Add 3 (whatIf.adds)', (await text(page, `${SHEET} [data-cc-offer-sheet-add]`)) === 'Add 3' && (await page.locator(`${SHEET} [data-cc-offer-sheet-add-row]`).count()) === 1)
    const who = await text(page, `${SHEET} [data-cc-offer-sheet-section="who"]`)
    check('who gets it: the tiers ✓ caller qualifies, and Phone orders', /Platinum, Gold, or Silver members/.test(who) && /✓ caller qualifies/.test(who) && /Phone orders/.test(who), who)
    const sayEn = await text(page, `${SHEET} [data-cc-say]`)
    const sayAr = await text(page, `${SHEET} [data-cc-say-ar]`)
    check('the script, in English, ends with the engine’s saving', /Take 3 more and you get 1 of them free\./.test(sayEn) && /Your membership qualifies/.test(sayEn) && /You’d save 98\.00 SAR, and the order comes to 304\.00 SAR\./.test(sayEn), sayEn)
    check('and in Arabic', /ستوفّر/.test(sayAr) && /عضويتك/.test(sayAr), sayAr)
    check('the BBY number is a chip, for support', /OMS000004571\s*for support/.test(await text(page, `${SHEET} [data-cc-offer-sheet-bby]`)), await text(page, `${SHEET} [data-cc-offer-sheet-bby]`))
    if (process.env.DRIVE_SHOTS) await page.screenshot({ path: `${process.env.DRIVE_SHOTS}/997-sheet.png` })

    // 3
    await page.locator('[data-cc-line-more="L11"]').click()
    await page.locator('[data-cc-line="L11"] [data-cc-line-qty]').first().waitFor()
    await wait(800)
    check('the basket changed with the sheet open (one ChangeQty)', calls.qty.length === 1, `${calls.qty.length}`)
    check('🚩 a basket change → exactly ONE re-read', calls.whatIf.length === 2, `${calls.whatIf.length} read(s)`)
    check('and the sheet still shows the engine’s saving', /98\.00/.test(await text(page, `${SHEET} [data-cc-offer-sheet-figure="saves"] dd`)))

    // 4
    await page.locator(`${SHEET} [data-cc-offer-sheet-add]`).click()
    await page.locator(`${SHEET} [data-cc-offer-sheet-applied]`).waitFor({ timeout: 5_000 })
    check('one AddItem of 509366 × 3', calls.add.length === 1 && calls.add[0].itemNumber === '509366' && calls.add[0].qty === 3, JSON.stringify(calls.add[0] ?? {}))
    check('the sheet says Applied with the engine’s amount', /^Applied — -?98\.00\s*SAR$/.test(await text(page, `${SHEET} [data-cc-offer-sheet-applied]`)), await text(page, `${SHEET} [data-cc-offer-sheet-applied]`))
    await page.locator(SHEET).waitFor({ state: 'detached', timeout: 5_000 })
    await wait(200)
    check('and closes to card D', (await page.locator(`[data-cc-applied-card="${OWNER.offerId}"]`).count()) === 1)
    check(
      'which takes focus',
      await page.evaluate((id) => document.activeElement?.getAttribute('data-cc-applied-card') === id, OWNER.offerId),
    )
    check('no read after the offer fired', calls.whatIf.length === 2, `${calls.whatIf.length}`)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // 5 — a failed read.
  {
    const { context, page, errors, calls } = await open(browser, { whatIfFails: true })
    await page.locator(`${CARD} [data-cc-offer-open]`).click()
    await page.locator(`${SHEET} [data-cc-offer-sheet-failed]`).waitFor({ timeout: 5_000 })
    check('*Open* opens the sheet too (one read)', calls.whatIf.length === 1, `${calls.whatIf.length}`)
    check('🚩 a failed read: Couldn’t price this right now', /^Couldn’t price this right now/.test(await text(page, `${SHEET} [data-cc-offer-sheet-failed]`)))
    check('and the definition where the saving would be: 100% off 1', (await text(page, `${SHEET} [data-cc-offer-sheet-definition]`)) === '100% off 1', await text(page, `${SHEET} [data-cc-offer-sheet-definition]`))
    const figures = await text(page, `${SHEET} [data-cc-offer-sheet-figures]`)
    const money = [...figures.matchAll(/\d+\.\d{2}(?!\d)|SAR/g)].map((m) => m[0])
    check('🚩 never a figure formatted as money', money.length === 0, money.join(' · '))
    check('the script has no saving clause', !/save/i.test(await text(page, `${SHEET} [data-cc-say]`)))

    // 6
    await page.keyboard.press('Escape')
    await page.locator(SHEET).waitFor({ state: 'detached', timeout: 5_000 })
    await wait(200)
    check(
      'Escape closes it and focus returns to the card',
      await page.evaluate((card) => document.activeElement === document.querySelector(`${card} [data-cc-offer-title]`), CARD),
    )
    check('no console errors (failed read)', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // 7 — below 1280 px, a full-height overlay.
  {
    const { context, page, errors } = await open(browser, { width: 1024 })
    await page.locator(`${CARD} [data-cc-offer-title]`).click()
    await page.locator(SHEET).waitFor({ timeout: 5_000 })
    const box = await page.locator(SHEET).boundingBox()
    check('below 1280 px the sheet is a full-height overlay', box.x <= 1 && box.width >= 1020 && box.y <= 1 && box.height >= 898, JSON.stringify(box))
    check('no console errors (narrow)', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
