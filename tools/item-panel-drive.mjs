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

async function open(browser, { state, priceAnswer }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  /** Every price check that reached the wire, with its whole query string —
   *  where the *nothing else* rule is PROVEN rather than asserted. */
  const priceCalls = []

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
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }))
    return route.fulfill(envelope([]))
  })

  await page.goto(BASE + '/callcenter')
  await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
  return { context, page, errors, calls, priceCalls }
}

/** Type the term and wait for the row. The box settles for 250 ms before the
 *  catalogue is asked, which is the panel's own rule and not this drive's. */
async function search(page) {
  await page.locator('[data-cc-search-input]').fill(TERM)
  await page.locator(`[data-cc-search-row="${QUOTE.itemNumber}"]`).waitFor({ timeout: 10_000 })
}

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
    const { context, page, errors, calls, priceCalls } = await open(browser, {
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
      (await page.locator('[data-cc-panel-condition]').count()) === QUOTE.conditions.length,
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

    const panelText = await page.locator(`[data-cc-item-panel="${QUOTE.itemNumber}"]`).innerText()
    // 🚩 The one that matters: a fall-back would have put the estimate here, and
    // an agent reading a refused panel out loud would say a number ~13% under.
    check('🚩 the panel holds no figure at all', !/\d+\.\d/.test(panelText), panelText.replace(/\n/g, ' · '))
    check('and no price column at all', (await page.locator('[data-cc-panel-price]').count()) === 0)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/refused.png` })
    await context.close()
  }

  /* ------------------------------------------------------ 12. the shut gate */
  {
    console.log('\nthe panel is absent while the gate is shut')
    const { context, page, errors, priceCalls } = await open(browser, {
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
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await page.screenshot({ path: `${OUT}/gate-shut.png` })
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
