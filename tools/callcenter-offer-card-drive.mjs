// The pitch card and card D (ticket 996, spec 995 A + D), driven in the REAL app on a v1.14 stub.
//
//   1. run the app:  npx vite --port 5211
//   2. DRIVE_PORT=5211 node tools/callcenter-offer-card-drive.mjs
//
// 🚩 The v1.14 near-miss fields (C1/C2) are BackOffice 859 + 4458, unbuilt: the near-miss here is
// a stub of exactly 4458's shape, filled with the owner's walk case (tier S, 509366 × 1 at P721,
// bonus buy OMS000004571, buy 3 get 1 free, phone only, tiers P,G,S). The end date is six days
// from the browser's own today, so "6 days left" holds on any day this is run.
//
// Asserts ticket 996's Playwright proof — the card on a v1.14 stub adds 3 with one click and turns
// into card D on the next state:
//   1. the headline is the definition (*Buy 3, get the 4th free*), the author's *3+1* under it;
//   2. badges: phone only · Platinum, Gold, or Silver ✓ · ends … · 6 days left;
//   3. the strip is [in, add, add, FREE] and says 1 of 4;
//   4. the action says *Add 3 more, 1 of them free*, stock at the store beside it;
//   5. 🚩 no figure formatted as money anywhere on the pitch card (D5);
//   6. a Say line in English and in Arabic, with the phone clause;
//   7. ONE click sends ONE AddItem of 509366 × 3 and no price;
//   8. the next state (the engine fired −98.00 on the line, 4 × 98.00) draws card D: the amount,
//      Line 1 · 4 units, 4 × 98.00 = 392.00 · caller pays 294.00, the keep-all warning, a Say line;
//   9. a v1.13 near-miss (no definition, no units) degrades: description headline, the old meter.
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
  itemNumber: '509366',
  description: 'OWNER CASE ITEM 509366',
  qty: 1,
  unitPrice: { net: 85.22, gross: 98 },
  lineTotal: { net: 85.22, gross: 98 },
  conditions: [],
  promotions: [],
}

// The owner's case, on 4458's field names (stub).
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
// A v1.13 near-miss: none of the v1.14 facts.
const OLD = {
  offerId: 'BBY-OLD',
  description: 'Old-style label',
  isReady: false,
  progress: { have: 0, need: 1 },
  prereq: { kind: 'material', materialNumber: '509366' },
  skipReason: null,
}

const RESOLUTION = {
  offerId: OWNER.offerId,
  prereq: OWNER.prereq,
  items: [{ itemNumber: '509366', description: LINE.description, description2: 'صنف', estimatePriceExVat: 85.22, atp: 12 }],
  truncated: false,
  topN: 25,
}

const BEFORE = { ...PRICED, lines: [LINE], firedPromotions: [], nearMisses: [OWNER] }
// The engine's answer to the add: the line at 4, the offer fired for −98.00 on it.
const AFTER = {
  ...BEFORE,
  version: PRICED.version + 1,
  lines: [{ ...LINE, qty: 4, lineTotal: { net: 255.65, gross: 294 } }],
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
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

async function open(browser, state) {
  const addBodies = []
  const resolves = []
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
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
    if (p === 'CallCenterWeb/ResolvePrereq') {
      resolves.push(url)
      return route.fulfill(envelope(RESOLUTION))
    }
    if (p === 'CallCenterWeb/AddItem') {
      addBodies.push(JSON.parse(route.request().postData() ?? '{}'))
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
  return { context, page, errors, addBodies, resolves }
}

const strip = (s) => s.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
const text = async (page, selector) => strip(await page.locator(selector).first().innerText())

/** The console-authored text of one element (server text removed), for the no-money rule. */
const consoleText = (page, selector) =>
  page.evaluate((sel) => {
    const clone = document.querySelector(sel).cloneNode(true)
    for (const node of clone.querySelectorAll('[data-cc-server-text]')) node.remove()
    return clone.textContent
  }, selector)

async function run() {
  const browser = await chromium.launch()

  {
    const { context, page, errors, addBodies, resolves } = await open(browser, BEFORE)
    const card = `[data-cc-offer-card][data-cc-card="${OWNER.offerId}"]`
    await page.locator(card).waitFor({ timeout: 10_000 })

    // 1
    check('the headline is the definition', (await text(page, `${card} [data-cc-offer-headline]`)) === 'Buy 3, get the 4th free', await text(page, `${card} [data-cc-offer-headline]`))
    check('the author’s label is the subtitle', (await text(page, `${card} [data-cc-card-desc]`)) === '3+1')

    // 2
    const badges = await page.locator(`${card} [data-cc-offer-badge]`).evaluateAll((els) => els.map((el) => el.getAttribute('data-cc-offer-badge')))
    check('badges: phone only, tier, ends — in that order', badges.join(',') === 'phoneOnly,tier,ends', badges.join(','))
    const tier = await text(page, `${card} [data-cc-offer-badge="tier"]`)
    check(
      'the tier badge names the tiers and says the caller qualifies ✓',
      /Platinum, Gold, or Silver members/.test(tier) && tier.includes('✓') && /caller qualifies/.test(tier),
      tier,
    )
    const ends = await text(page, `${card} [data-cc-offer-badge="ends"]`)
    check('the end badge says the day (Thu 3 Dec) and 6 days left', /^Ends \w{3} \d{1,2} \w{3} · 6 days left$/.test(ends), ends)

    // 3
    const slots = await page.locator(`${card} [data-cc-offer-slot]`).evaluateAll((els) => els.map((el) => el.getAttribute('data-cc-offer-slot')))
    check('the strip is [in, add, add, FREE]', slots.join(',') === 'in,add,add,free', slots.join(','))
    check('and counts units: 1 of 4', (await text(page, `${card} [data-cc-offer-progress]`)) === '1 of 4 in the basket')
    check('the prerequisite counter is not drawn on a card with units', (await page.locator(`${card} [data-cc-meter]`).count()) === 0)

    // 4
    const add = `${card} [data-cc-offer-add]`
    check('the action says how many and how many free', (await text(page, add)) === 'Add 3 more, 1 of them free', await text(page, add))
    const addBox = await page.locator(add).boundingBox()
    check('the action is a 40px touch target', addBox && addBox.height >= 40, `${addBox?.height}px`)
    await page.locator(`${card} [data-cc-offer-stock]`).waitFor({ timeout: 5_000 })
    check(
      'stock at the order’s store sits beside it, from ResolvePrereq’s top row (asked once)',
      /12 in stock/i.test(await text(page, `${card} [data-cc-offer-stock]`)) && resolves.length === 1,
      `${await text(page, `${card} [data-cc-offer-stock]`)} · ${resolves.length} read(s)`,
    )
    check('a material offer draws no second list under its own add', (await page.locator(`${card} [data-cc-qualifying-row]`).count()) === 0)

    // 5
    const authored = await consoleText(page, card)
    const money = [...authored.matchAll(/\d+\.\d{2}(?!\d)|(?:SAR|SR)\s*\d/g)].map((m) => m[0])
    check('🚩 no figure formatted as money on the pitch card (D5)', money.length === 0, money.join(' · '))

    // 6
    const sayEn = await text(page, `${card} [data-cc-say]`)
    const sayAr = await text(page, `${card} [data-cc-say-ar]`)
    check(
      'the Say line, in English, names the add, the phone clause and the deadline',
      /Take 3 more and you get 1 of them free\./.test(sayEn) && /only for phone orders/.test(sayEn) && /It ends on /.test(sayEn),
      sayEn,
    )
    check(
      'and in Arabic, its own sentence, right to left',
      /مجانًا/.test(sayAr) && /الهاتف/.test(sayAr) && (await page.locator(`${card} [data-cc-say-ar]`).getAttribute('dir')) === 'rtl',
      sayAr,
    )
    if (process.env.DRIVE_SHOTS) await page.locator('[data-cc-promotions]').screenshot({ path: `${process.env.DRIVE_SHOTS}/996-pitch.png` })

    // 7
    await page.locator(add).click()
    await page.locator('[data-cc-applied-card]').waitFor({ timeout: 10_000 })
    check('one click sends ONE AddItem', addBodies.length === 1, `${addBodies.length}`)
    const body = addBodies[0] ?? {}
    check(
      'of 509366 × 3, and no price',
      body.itemNumber === '509366' && body.qty === 3 && !Object.keys(body).some((key) => /price|amount|gross|net/i.test(key)),
      JSON.stringify(body),
    )

    // 8
    const d = `[data-cc-applied-card="${OWNER.offerId}"]`
    check('the pitch card is gone: the offer fired', (await page.locator(card).count()) === 0)
    check('card D shows the engine’s amount', /98\.00/.test(await text(page, `${d} [data-cc-applied-amount]`)), await text(page, `${d} [data-cc-applied-amount]`))
    check('the line it landed on, and the quantity', (await text(page, `${d} [data-cc-applied-line]`)) === 'Line 1 · 4 units', await text(page, `${d} [data-cc-applied-line]`))
    const sum = await text(page, `${d} [data-cc-applied-sum]`)
    check('the arithmetic off the line’s own figures', sum === '4 × 98.00 = 392.00 · caller pays 294.00', sum)
    check('removing one takes the free one away', (await text(page, `${d} [data-cc-applied-keep]`)) === 'Removing one takes the free one away')
    const saidD = await text(page, `${d} [data-cc-say]`)
    check(
      'and a Say line with the engine’s saving',
      /You save 98\.00 SAR: you pay 294\.00 SAR for 4\./.test(saidD) && /Keep all 4/.test(saidD) && (await page.locator(`${d} [data-cc-say-ar]`).count()) === 1,
      saidD,
    )
    if (process.env.DRIVE_SHOTS) await page.locator('[data-cc-promotions]').screenshot({ path: `${process.env.DRIVE_SHOTS}/996-card-d.png` })
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // 9 — a v1.13 near-miss degrades.
  {
    const { context, page, errors } = await open(browser, { ...BEFORE, nearMisses: [OLD] })
    const card = `[data-cc-card="${OLD.offerId}"]`
    await page.locator(card).waitFor({ timeout: 10_000 })
    check('no definition → the headline is the description', (await text(page, `${card} [data-cc-offer-headline]`)) === OLD.description)
    check('no units → no strip, and the old meter and delta show', (await page.locator(`${card} [data-cc-offer-strip]`).count()) === 0 && (await page.locator(`${card} [data-cc-meter]`).count()) === 1 && /add 1 more/i.test(await text(page, `${card} [data-cc-delta]`)))
    check('no units → no one-click add of a guessed quantity', (await page.locator(`${card} [data-cc-offer-add]`).count()) === 0)
    check('no audience → no badges', (await page.locator(`${card} [data-cc-offer-badge]`).count()) === 0)
    check('no console errors (degraded)', errors.length === 0, errors[0] ?? '')
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
