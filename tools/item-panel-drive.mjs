// The *about this item* panel's drive (ticket 185) — the REAL console in
// Chromium, with only the wire stubbed.
//
//   1. run the app:  npx vite --port 5212
//   2. node tools/item-panel-drive.mjs
//
// ⚠ WHAT IS A CAPTURE AND WHAT IS A STUB, said up front (177's rule):
//
//   • the PRICE CHECK answers are the contract's own committed capture —
//     `.issues/assets/136-cc-contract/12-price-check.json` (857, v1.10), driven
//     live against the real `CallCenterWeb/PriceCheck` handler, the real pricing
//     engine and ASP.NET Core's own result execution. Its `quoted` leg, its
//     `refusedBeforeAttach` 409 and the BASKET LINE the same item became under
//     the same header are all that exchange's bytes;
//   • the ITEM SEARCH answer beneath them is this drive's own — BackOffice 799
//     has not built the endpoint, so there is no capture to take. Its
//     `estimatePriceExVat` is an ex-VAT figure under what the caller pays, which
//     is what the material master really serves — and deliberately one the
//     capture contains nowhere, so assertion 6 is able to fail.
//
// What it asserts — the ticket's Proof plus the two wire rules that are only
// observable ON the wire and therefore cannot be asserted in the pure test:
//
//   expanding a row quotes the real price
//     1. the row carries an expander, and expanding it draws the panel;
//     2. 🚩 the price is drawn WITH `SAR` — it is engine money, in the money
//        register, exactly like a basket line;
//     3. 🚩 and it is the capture's `unitPrice.gross`, which is the same number as
//        the basket line the SAME item became under the SAME header (§3.4 rule 1,
//        the whole ticket) — asserted against the capture's line, not the quote;
//     4. the conditions behind it are drawn — the store price and VAT as separate
//        things, which is what explains the gap to the estimate above;
//
//   the estimate does not move, and no row changes shape
//     5. 🚩 the row's meta line is byte-identical before and after expanding, with
//        its `≈` estimate still on it (168's spatial rule, untouched);
//     6. 🚩 the estimate appears NOWHERE inside the panel — the two numbers coexist
//        on one screen and never swap places;
//
//   the offers half speaks the guidance strip's language and holds no money
//     7. every offer is drawn with its progress and its state in words;
//     8. 🚩 the offers region contains no currency word and no money-shaped figure;
//     9. `offersComplete: false` prints *offers were not fully checked* — and the
//        same panel over `true` drops that one line and changes nothing else,
//        which is what "it flips with no client change" means;
//
//   a pricing failure is a refusal, never the estimate
//    10. `NO_CUSTOMER_ATTACHED` reaches the agent as a sentence, never as a code;
//    11. 🚩 and the panel then holds NO figure at all — least of all the row's
//        estimate, which is the number a fall-back would have put there;
//
//   the gate, and the wire
//    12. 🚩 `canPriceCheck: false` ⇒ no expander on any row and NO `PriceCheck`
//        call is ever made — quoting at a store nobody chose is a silent wrong
//        price, said out loud;
//    13. 🚩 the request carries `transactionId` and `itemNumber` and NOTHING else
//        — no quantity, no plant, no sales org, no `requestId`. Map note 4 is
//        enforced by the wire having no other field;
//    14. 🚩 it is asked on `CallCenterWeb/PriceCheck` and never on
//        `Pricing/Simulate` — a different grant, and a body that would hand an
//        agent price-affecting power;
//    15. nothing throws.
//
// ⚠ TICKET 186's half, and its own capture warning: **the STOCK answers below are
// this drive's stubs, not a capture.** BackOffice 876 shipped without one on
// purpose — §11's captures are round trips against live services and this read's
// second hop is a remote stock service the test host cannot reach, so the only
// scenario it could ever record is an outage, and committing that would freeze an
// outage as the contract's shape. The stubs are §3.5's documented shape.
//
//   who else has it
//    16. the same panel carries a store list: nearest first, ATP beside each;
//    17. 🚩 the capped list states the honest total that was NOT capped;
//    18. 🚩 read-only by ruling — the whole block holds NO control at all, and it
//        names the store-change path in words instead;
//    19. 🚩 a row whose distance is unknown is DRAWN BLANK and is never dropped;
//    20. 🚩 `distanceKnown: false` orders by store code and SAYS it is unranked —
//        never a plausible ranking measured from (0,0);
//
//   and the two halves fail independently — the ticket's whole reason for two calls
//    21. 🚩 the stock hop answering `available: false` leaves the price on screen
//        and byte-identical, and says *we could not check* — which is a different
//        sentence, in a different element, from *nobody has it*;
//    22. 🚩 the stock read REFUSING leaves the price on screen and intact;
//    23. 🚩 the price refusing leaves the store list on screen and intact;
//    24. 🚩 the shut gate sends no `StockElsewhere` either, and the request carries
//        `transactionId` and `itemNumber` and nothing else.
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`
const OUT = '.issues/assets/185-item-panel'
mkdirSync(OUT, { recursive: true })

const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
const fixture = (name) => raw(name).response.body.data

const OPEN_RESULT = fixture('01-open-empty')
const PRICE_CAPTURE = raw('12-price-check')
/** The quote — the capture's own `PriceCheckResult`. */
const QUOTE = PRICE_CAPTURE.quoted.response.body.data
/** 🚩 The BASKET LINE the same item became under the same header, from the same
 *  exchange. Assertion 3 reads its `unitPrice.gross` rather than the quote's, so
 *  the equality is proved against the other side of the rule. */
const SAME_LINE = PRICE_CAPTURE.theSameItemAsABasketLine.response.body.data.lines[0]
/** The refusal before the caller is attached — a 409 CARRYING the envelope. */
const REFUSAL = PRICE_CAPTURE.refusedBeforeAttach.response.body

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

/* --------------------------------------------------------- the search stub ⚠ */

const CUSTOMER = {
  customerId: 'C-REDACTED',
  name: 'Redacted Customer',
  mobile: '9665REDACTED',
  loyaltyAttached: true,
}

/**
 * ⚠ Hand-authored: 799 has not built `ItemSearch`.
 *
 * 🚩 `ESTIMATE` is deliberately a figure the capture contains NOWHERE — not the
 * quote's `gross`, not its `net`, not any condition value. `Item.UnitPrice` is a
 * material-master column and the engine's `VKP0` is a condition record; they
 * happen to agree in this store's data, and an estimate set to the value they
 * share would make assertion 6 unable to fail. It is still what the master really
 * serves — ex-VAT, and under what the caller pays.
 */
const ESTIMATE = 12.5

const SEARCH = {
  truncated: false,
  atpAvailable: true,
  rows: [
    {
      materialNumber: QUOTE.itemNumber,
      descriptionEn: QUOTE.description,
      descriptionAr: QUOTE.description2,
      estimatePriceExVat: ESTIMATE,
      atp: 4,
    },
  ],
}

const TERM = 'deo'

/**
 * ⚠ Hand-authored to §3.5's documented shape — 876 shipped no capture, and why is
 * in the header.
 *
 * 🚩 The rows are deliberately NOT in store-code order: `1305` sits between `1204`
 * and `1102`, so a ranked list left alone and a list re-sorted by code are
 * different sequences and assertion 20 is able to fail. `1305` also carries a null
 * distance in the middle of a ranked list, which is where a "drop the ones we
 * cannot place" bug would show.
 */
const STOCK = {
  contractVersion: '1.7',
  itemNumber: QUOTE.itemNumber,
  originPlant: '1101',
  distanceKnown: true,
  available: true,
  stores: [
    { plant: '1204', city: 'Riyadh', areaName: 'North Riyadh', address: 'King Abdullah Rd', atp: 6, distanceKm: 4.2 },
    { plant: '1305', city: 'Riyadh', areaName: 'Al Malaz', address: 'Salahuddin Rd', atp: 3, distanceKm: null },
    { plant: '1102', city: 'Riyadh', areaName: 'Olaya', address: 'Olaya St', atp: 11, distanceKm: 12.8 },
  ],
  withStock: 23,
  truncated: true,
}

/** The outage, exactly as the server sends it: a **200** carrying
 *  `available: false` and an empty list. It is not an error, and the console must
 *  not read it as *nobody has it*. */
const STOCK_UNKNOWN = { ...STOCK, available: false, stores: [], withStock: 0, truncated: false }

/** The unlocatable origin (`BZ01` and its two siblings are real rows in the dev
 *  estate — 876's discharged deployment obligation). Every distance null, and the
 *  list must come out by code. */
const STOCK_UNRANKED = {
  ...STOCK,
  distanceKnown: false,
  stores: STOCK.stores.map((s) => ({ ...s, distanceKm: null })),
}

/** The state the console opens on: the capture's empty order with the caller
 *  ATTACHED, because the gate is *a caller and a store somebody chose* and this
 *  drive's subject starts after both. */
function seedState({ canPriceCheck = true } = {}) {
  const state = OPEN_RESULT.state
  return {
    ...state,
    header: { ...state.header, customer: CUSTOMER },
    capabilities: { ...state.capabilities, canAddItem: true, canPriceCheck },
  }
}

async function open(browser, { state, priceAnswer, stockAnswer = envelope(STOCK) }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  /** Every price check that reached the wire, with its whole query string —
   *  where the *nothing else* rule is PROVEN rather than asserted. */
  const priceCalls = []
  /** The same, for the stock hop — a separate ledger because the whole ticket is
   *  that these are two calls. */
  const stockCalls = []

  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const p = url.pathname.split('/api/')[1]
    calls.push(`${request.method()} ${p}`)

    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    if (p === 'CallCenterWeb/ItemSearch') return route.fulfill(envelope(SEARCH))
    if (p === 'CallCenterWeb/PriceCheck') {
      priceCalls.push({
        params: Object.fromEntries(url.searchParams),
        method: request.method(),
        body: request.postData(),
      })
      return route.fulfill(priceAnswer)
    }
    if (p === 'CallCenterWeb/StockElsewhere') {
      stockCalls.push({
        params: Object.fromEntries(url.searchParams),
        method: request.method(),
        body: request.postData(),
      })
      return route.fulfill(stockAnswer)
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }))
    return route.fulfill(envelope([]))
  })

  await page.goto(BASE + '/callcenter')
  await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
  return { context, page, errors, calls, priceCalls, stockCalls }
}

/** Type the term and wait for the row. The box settles for 250 ms before the
 *  catalogue is asked, which is the panel's own rule and not this drive's. */
async function search(page) {
  await page.locator('[data-cc-search-input]').fill(TERM)
  await page.locator(`[data-cc-search-row="${QUOTE.itemNumber}"]`).waitFor({ timeout: 10_000 })
}

/**
 * The panel's text with the STOCK half cut out.
 *
 * 186 gave this panel a second region, and its figures are a different KIND of
 * number: an ATP count and a distance in kilometres are availability, not money,
 * and neither is somewhere a price estimate could be written. The price half's
 * *no figure at all* rule is read over the price half.
 */
const priceHalfText = (page) =>
  page.locator(`[data-cc-item-panel="${QUOTE.itemNumber}"]`).evaluate((el) => {
    const clone = el.cloneNode(true)
    for (const node of clone.querySelectorAll('[data-cc-stock]')) node.remove()
    return clone.textContent
  })

const metaOf = (page) =>
  page.locator(`[data-cc-search-row="${QUOTE.itemNumber}"] [data-cc-search-meta]`).innerText()

/**
 * *Formatted as money*, in the two parts `guidance-view.test.ts` settled: a
 * figure wearing a currency word, or one whose decimals were FORCED to two.
 * `29.95` is not that — it is the numeral the value already is.
 */
const moneyShaped = (text) =>
  /(?:SAR|SR)\s*\d|\d\s*(?:SAR|SR)\b/.test(text) ||
  (text.match(/\d+\.\d\d(?!\d)/g) ?? []).some((f) => String(Number(f)) !== f)

async function run() {
  const browser = await chromium.launch()
  console.log('\n⚠ the PRICE CHECK answers are the contract capture (fixture 12); the ITEM SEARCH beneath is a stub\n')

  /* ------------------------------------------------ the quote, and the row */
  {
    console.log('expanding a search row quotes the real price')
    const { context, page, errors, calls, priceCalls, stockCalls } = await open(browser, {
      state: seedState(),
      priceAnswer: envelope(QUOTE),
    })
    await search(page)

    // 5. The row BEFORE. Captured first, because the claim is that expanding
    //    changes nothing about it.
    const metaBefore = await metaOf(page)
    check('the row carries its ≈ estimate on the meta line', /≈/.test(metaBefore), metaBefore.replace(/\n/g, ' · '))

    check('the row carries an expander', (await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).count()) === 1)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator(`[data-cc-item-panel="${QUOTE.itemNumber}"]`).waitFor({ timeout: 10_000 })

    const priceText = await page.locator('[data-cc-panel-price]').innerText()
    // 2. The register rule, from the other side: this figure MUST wear the
    //    currency word, because it is the one number here that is engine money.
    check('the price is drawn with SAR', /SAR/.test(priceText), priceText.replace(/\n/g, ' '))
    // 3. 🚩 The whole ticket, against the OTHER side of the rule.
    check(
      'and it is the price the basket line for the same item costs',
      priceText.includes(SAME_LINE.unitPrice.gross.toFixed(2)),
      `line ${SAME_LINE.unitPrice.gross}`,
    )
    check(
      'the conditions behind it are drawn, VAT as its own thing',
      (await page.locator('[data-cc-panel-conditions] [data-cc-condition]').count()) === QUOTE.conditions.length,
    )

    // 5. The row AFTER — byte-identical. 168's spatial rule is what stops a list
    //    reflowing under an agent who is scanning it mid-sentence.
    const metaAfter = await metaOf(page)
    check('the row meta line is unchanged by the expansion', metaAfter === metaBefore)

    // 6. 🚩 The estimate is not in the panel, in any form.
    const panelText = await page.locator(`[data-cc-item-panel="${QUOTE.itemNumber}"]`).innerText()
    check(
      'the estimate appears nowhere inside the panel',
      !panelText.includes(String(ESTIMATE)) && !panelText.includes('≈'),
      `estimate ${ESTIMATE}`,
    )

    // 7-8. The offers half.
    const offersText = await page.locator('[data-cc-panel-offers]').innerText()
    check(
      'every offer the server sent is drawn',
      (await page.locator('[data-cc-panel-offer]').count()) === QUOTE.offers.length,
    )
    // 🚩 Every `offerId` in this capture is the empty string (859), so an offer
    //    handle keyed on it would collapse two distinct offers into one — the
    //    agent shown one offer where the engine sent two.
    const handles = await page.locator('[data-cc-panel-offer]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-cc-panel-offer')),
    )
    check(
      '🚩 each offer is separately addressable even though the wire named none',
      new Set(handles).size === QUOTE.offers.length,
      handles.join(', '),
    )
    check(
      'each offer carries its progress, in the strip own two counts',
      (await page.locator('[data-cc-panel-progress]').count()) === QUOTE.offers.length,
    )
    check('🚩 the offers region carries no figure formatted as money', !moneyShaped(offersText), offersText.replace(/\n/g, ' · '))
    // 9. The honesty flag, while 787-C is outstanding.
    check(
      'offersComplete:false prints that offers were not fully checked',
      (await page.locator('[data-cc-panel-offers-incomplete]').count()) === 1,
    )

    // 13-14. The wire. This is the assertion that cannot live in the pure test.
    check('exactly one PriceCheck reached the wire', priceCalls.length === 1, JSON.stringify(priceCalls.map((c) => c.params)))
    check(
      '🚩 it carried transactionId and itemNumber and NOTHING else',
      JSON.stringify(Object.keys(priceCalls[0]?.params ?? {}).sort()) === JSON.stringify(['itemNumber', 'transactionId']),
      Object.keys(priceCalls[0]?.params ?? {}).join(', '),
    )
    check('it is a GET and carries no body — a pure read takes no requestId', priceCalls[0]?.method === 'GET' && !priceCalls[0]?.body)
    // 14. 🚩 The route the ticket forbids, asserted rather than assumed: it is
    //     gated on the pricing-analysis screen's grant, and its body carries
    //     manual conditions and a sales org that would beat the plant's.
    check(
      '🚩 nothing was asked of Pricing/Simulate',
      !calls.some((c) => /Pricing\/Simulate/i.test(c)),
      calls.filter((c) => /Pricing/i.test(c)).join(', '),
    )

    /* ------------------------------ 16-19. the same panel's second half (186) */
    check('the panel carries a stock block too', (await page.locator('[data-cc-stock]').count()) === 1)
    const plants = await page
      .locator('[data-cc-stock-row]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-cc-stock-row')))
    // 16 + 19. Every store the server sent, IN the server's own ranked order —
    // including the one it could not place, which keeps its rank.
    check(
      '🚩 every store is drawn, in the server ranking, with the unplaceable one kept',
      JSON.stringify(plants) === JSON.stringify(STOCK.stores.map((s) => s.plant)),
      plants.join(', '),
    )
    check(
      '🚩 the store with no distance draws BLANK — not 0 km, which reads as *here*',
      (await page.locator('[data-cc-stock-distance="1305"]').innerText()).trim() === '',
    )
    check(
      'the placed stores draw their distance',
      /4\.2/.test(await page.locator('[data-cc-stock-distance="1204"]').innerText()),
    )
    // 2. One availability number, and it is the ATP the server sent.
    check(
      'each store carries one availability number, and it is its ATP',
      (await page.locator('[data-cc-stock-atp="1102"]').innerText()).includes('11'),
    )
    // 17. The cap, said honestly — 3 of 23, never "3 stores have it".
    const stockCount = await page.locator('[data-cc-stock-count]').innerText()
    check('🚩 the capped list states the total that was NOT capped', /23/.test(stockCount), stockCount)
    // 18. 🚩 Read-only BY RULING: not one control, and the path named in words.
    const stockControls = await page.locator('[data-cc-stock] button, [data-cc-stock] a, [data-cc-stock] input').count()
    check('🚩 the stock block holds no control at all — read-only by ruling', stockControls === 0, `${stockControls} found`)
    check('and it names the store-change path in words', (await page.locator('[data-cc-stock-readonly]').count()) === 1)
    check('the list is not announced as unranked while it IS ranked', (await page.locator('[data-cc-stock-unranked]').count()) === 0)

    // The stock wire, same shape rule as the price's.
    check('exactly one StockElsewhere reached the wire', stockCalls.length === 1)
    check(
      '🚩 it carried transactionId and itemNumber and NOTHING else',
      JSON.stringify(Object.keys(stockCalls[0]?.params ?? {}).sort()) === JSON.stringify(['itemNumber', 'transactionId']),
      Object.keys(stockCalls[0]?.params ?? {}).join(', '),
    )
    check('it is a GET and carries no body — a pure read takes no requestId', stockCalls[0]?.method === 'GET' && !stockCalls[0]?.body)
    // 🚩 The two halves are TWO calls. If one read ever served both, the
    // independence the rest of this drive asserts would be a coincidence.
    check(
      '🚩 the price and the stock are two separate calls',
      calls.filter((c) => /PriceCheck/.test(c)).length === 1 && calls.filter((c) => /StockElsewhere/.test(c)).length === 1,
    )

    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/quoted.png` })
    await context.close()
  }

  /* --------------------------------- 9. the flag flipping, with no client change */
  {
    console.log('\noffersComplete flipping to true changes one line and nothing else')
    const { context, page, errors } = await open(browser, {
      state: seedState(),
      priceAnswer: envelope({ ...QUOTE, offersComplete: true }),
    })
    await search(page)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator(`[data-cc-item-panel="${QUOTE.itemNumber}"]`).waitFor({ timeout: 10_000 })

    check(
      'the not-fully-checked line is gone',
      (await page.locator('[data-cc-panel-offers-incomplete]').count()) === 0,
    )
    check(
      'and the offers themselves are exactly as before',
      (await page.locator('[data-cc-panel-offer]').count()) === QUOTE.offers.length,
    )
    check('the price is still drawn', (await page.locator('[data-cc-panel-price]').count()) === 1)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ----------------------------------- 10-11. the refusal that is never a number */
  {
    console.log('\na pricing failure is a refusal, never the estimate')
    const { context, page, errors } = await open(browser, {
      state: seedState(),
      priceAnswer: {
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(REFUSAL),
      },
    })
    await search(page)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator('[data-cc-panel-refusal]').waitFor({ timeout: 10_000 })

    const refusal = await page.locator('[data-cc-panel-refusal]').innerText()
    check('the refusal is worded, not a machine code', !/NO_CUSTOMER_ATTACHED/.test(refusal), refusal)
    check('and it names the caller as what is missing', /caller/i.test(refusal), refusal)

    const panelText = await priceHalfText(page)
    // 🚩 The one that matters: a fall-back would have put the estimate here, and
    // an agent reading a refused panel out loud would say a number ~13% under.
    //
    // ⚠ Scoped to the PRICE half by 186, and deliberately: this panel now has a
    // second region whose figures are AVAILABILITY — ATP counts and kilometres,
    // neither of them money and neither of them a thing an estimate could be
    // written into. The rule was always about the one number this refusal must
    // not produce, and reading it over the stock list too would have made a
    // passing store list fail a pricing rule.
    check('🚩 the price half holds no figure at all', !/\d+\.\d/.test(panelText), panelText)
    check(
      'and the stock half is untouched beside it — the two fail apart',
      (await page.locator('[data-cc-stock-row]').count()) === STOCK.stores.length,
    )
    check('and no price column at all', (await page.locator('[data-cc-panel-price]').count()) === 0)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/refused.png` })
    await context.close()
  }

  /* ------------------------------------------------------ 12. the shut gate */
  {
    console.log('\nthe panel is absent while the gate is shut')
    const { context, page, errors, priceCalls, stockCalls } = await open(browser, {
      state: seedState({ canPriceCheck: false }),
      priceAnswer: envelope(QUOTE),
    })
    await search(page)

    check('no row carries an expander', (await page.locator('[data-cc-item-expand]').count()) === 0)
    check('no panel is on screen', (await page.locator('[data-cc-item-panel]').count()) === 0)
    // 🚩 The proof that the gate is a gate and not a hidden control: nothing was
    // ever asked of the door.
    check('🚩 no PriceCheck reached the wire', priceCalls.length === 0)
    // The row is otherwise untouched — the estimate is still where 168 put it.
    check('the row still carries its ≈ estimate', /≈/.test(await metaOf(page)))
    // 24. 🚩 The gate is ONE predicate over the whole panel: the stock hop is not
    //     asked either, and a list ranked from a store nobody chose is exactly as
    //     wrong as a price quoted from one.
    check('🚩 no StockElsewhere reached the wire either', stockCalls.length === 0)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/gate-shut.png` })
    await context.close()
  }

  /* --------------------- 20. an unlocatable origin is unranked, not plausible */
  {
    console.log('\nan unlocatable origin produces an honestly unranked list')
    const { context, page, errors } = await open(browser, {
      state: seedState(),
      priceAnswer: envelope(QUOTE),
      stockAnswer: envelope(STOCK_UNRANKED),
    })
    await search(page)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator('[data-cc-stock]').waitFor({ timeout: 10_000 })

    const plants = await page
      .locator('[data-cc-stock-row]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-cc-stock-row')))
    // 🚩 By CODE — and the stub's own order is not that order, so this can fail.
    check('🚩 the list is ordered by store code', JSON.stringify(plants) === JSON.stringify(['1102', '1204', '1305']), plants.join(', '))
    check(
      '🚩 and it says so — an unranked list that stays silent is read as nearest-first',
      (await page.locator('[data-cc-stock-unranked]').count()) === 1,
    )
    // The fiction this rule exists to refuse: a full set of plausible distances
    // measured from the Gulf of Guinea.
    const stockText = await page.locator('[data-cc-stock]').innerText()
    check('🚩 no distance is invented for any row', !/\d\s*km/i.test(stockText), stockText.replace(/\n/g, ' · '))
    check('every store is still listed', plants.length === STOCK.stores.length)
    check('the price is untouched by any of it', (await page.locator('[data-cc-panel-price]').count()) === 1)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/stock-unranked.png` })
    await context.close()
  }

  /* ------------- 21. the outage that must not cost the agent the price */
  {
    console.log('\na stock outage leaves the price on screen, and does not say *nobody has it*')
    const { context, page, errors } = await open(browser, {
      state: seedState(),
      priceAnswer: envelope(QUOTE),
      stockAnswer: envelope(STOCK_UNKNOWN),
    })
    await search(page)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator('[data-cc-stock-unknown]').waitFor({ timeout: 10_000 })

    // 🚩 The ticket's own reason for two calls, on the wire.
    const priceText = await page.locator('[data-cc-panel-price]').innerText()
    check('🚩 the price the agent asked for is still on screen', /SAR/.test(priceText), priceText.replace(/\n/g, ' '))
    check(
      'and it is still the same number, unchanged by the outage',
      priceText.includes(SAME_LINE.unitPrice.gross.toFixed(2)),
    )
    check('the offers half is intact too', (await page.locator('[data-cc-panel-offers]').count()) === 1)
    // 🚩 Three-way, not two-way (135): *we could not check* is its own element.
    check('🚩 it does NOT say nobody has it', (await page.locator('[data-cc-stock-none]').count()) === 0)
    check('no store list is drawn from an unanswered hop', (await page.locator('[data-cc-stock-row]').count()) === 0)
    const unknown = await page.locator('[data-cc-stock-unknown]').innerText()
    check("and it says so in the agent's words", /could/i.test(unknown), unknown)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/stock-unknown.png` })
    await context.close()
  }

  /* --------------- the third of the three, on the wire: nobody else has it */
  {
    console.log('\nan answered read with no store says nobody has it — the OTHER sentence')
    const { context, page, errors } = await open(browser, {
      state: seedState(),
      priceAnswer: envelope(QUOTE),
      stockAnswer: envelope({ ...STOCK, stores: [], withStock: 0, truncated: false }),
    })
    await search(page)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator('[data-cc-stock-none]').waitFor({ timeout: 10_000 })

    // 🚩 The pair that matters: this answer and the outage above differ by ONE
    // wire boolean, and they must not read the same down a phone.
    check('🚩 it does not say *we could not check*', (await page.locator('[data-cc-stock-unknown]').count()) === 0)
    check('no store list, and no read-only sentence about a list that is not there', (await page.locator('[data-cc-stock-readonly]').count()) === 0)
    check('the price is on screen as ever', (await page.locator('[data-cc-panel-price]').count()) === 1)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ------------------------- 22. the stock read REFUSING, same independence */
  {
    console.log('\na refused stock read leaves the price on screen')
    const { context, page, errors } = await open(browser, {
      state: seedState(),
      priceAnswer: envelope(QUOTE),
      stockAnswer: { status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, success: false, message: 'boom', errors: [], data: null }) },
    })
    await search(page)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator('[data-cc-stock-refusal]').waitFor({ timeout: 10_000 })

    check('🚩 the price is still on screen', /SAR/.test(await page.locator('[data-cc-panel-price]').innerText()))
    check('and its conditions are still drawn', (await page.locator('[data-cc-panel-conditions]').count()) === 1)
    const refusal = await page.locator('[data-cc-stock-refusal]').innerText()
    check('the stock refusal is a sentence, not a code', !/[A-Z]{4,}_[A-Z]/.test(refusal), refusal)
    check('and it is not *nobody has it* either', (await page.locator('[data-cc-stock-none]').count()) === 0)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* --------------- 23. and the same rule from the other side: the price refusing */
  {
    console.log('\na refused price leaves the store list on screen')
    const { context, page, errors } = await open(browser, {
      state: seedState(),
      priceAnswer: { status: 409, contentType: 'application/json', body: JSON.stringify(REFUSAL) },
      stockAnswer: envelope(STOCK),
    })
    await search(page)
    await page.locator(`[data-cc-item-expand="${QUOTE.itemNumber}"]`).click()
    await page.locator('[data-cc-panel-refusal]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-stock-row="1204"]').waitFor({ timeout: 10_000 })

    check(
      '🚩 the store list survived the price refusing, whole',
      (await page.locator('[data-cc-stock-row]').count()) === STOCK.stores.length,
    )
    check('with its ATP numbers', (await page.locator('[data-cc-stock-atp="1204"]').innerText()).includes('6'))
    check('and the price is a refusal, not a number', (await page.locator('[data-cc-panel-price]').count()) === 0)
    // 🚩 The one number that must never appear on a refused price stays absent
    // even now that the panel has a second half full of figures: the ATP counts
    // and distances are availability, and the estimate is money.
    const panelText = await page.locator(`[data-cc-item-panel="${QUOTE.itemNumber}"]`).innerText()
    check('🚩 and the estimate is still nowhere in the panel', !panelText.includes(String(ESTIMATE)) && !panelText.includes('≈'))
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/price-refused-stock-listed.png` })
    await context.close()
  }

  await browser.close()

  const passed = results.filter((r) => r.pass).length
  console.log(`\n${passed}/${results.length}`)
  if (passed !== results.length) {
    console.log('\nfailed:')
    for (const r of results.filter((x) => !x.pass)) console.log(`  ✗ ${r.name}`)
    process.exitCode = 1
  }
}

await run()
