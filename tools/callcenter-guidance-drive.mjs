// The guidance strip, driven in the REAL app (ticket 171) — map 126's differentiator.
//
//   1. run the app:  npx vite --port 5210
//   2. node tools/callcenter-guidance-drive.mjs
//
// Nothing is stubbed except the wire. 🚩 The near-misses come from TWO places since
// the v1.2 capture (177): the three rendering classes are the v1.0 provisional in
// `src/features/callcenter/console/__fixtures__/unreachable-v1_0.json`, because the
// capture of `03-near-miss-buy-side.json` holds two unready offers with blank
// `offerId`s (859) and no `NOT_DISCOVERED` (855); the `captured` scenario drives that
// real projection as its own case. The basket under
// them is fixture 02, because 138's density budget was measured inside a real
// console with a real basket and a real receipt, and a guidance surface judged in a
// vacuum always passes.
//
// Asserts ticket 171's Proof (`theStripScansAtAGlance`), over 138's states:
//   three · bigSet · many · readyOnly · none · getSideLanded, plus `definitions`
//   (the additive discount block the strip's headline is for);
// and ticket 172's (`oneClickAddSaysWhatHappened`), over 138's remaining three —
//   adding · didNotFire · firedOther:
//   10. the handful is THREE and it is the server's `topN`, never a client slice;
//   11. the qualifying row carries Arabic on the META line, beside the item
//       number and the estimate;
//   12. the add runs on the row that launched it (`Adding…`) and 🚩 the row does
//       NOT move while it runs — measured, not assumed;
//   13. each of the three outcomes renders its OWN banner, outside the clamp:
//       fired · a better offer fired instead · did not fire (the offer stays and
//       only its meter moves);
//   14. `Search the other N` lands in the console's own item search, narrowed to
//       the offer — the request carries it, and the panel says which offer.
//
//   1. three classes, visibly distinct in RANK, TREATMENT and WORDS: only the
//      actionable class is a card, only it carries an action, `already counted`
//      says there is nothing to do, and a blocked offer says WHY in the agent's
//      words — never the wire code, including for a category this client has
//      never seen;
//   2. the top-ranked actionable card is open BY CONSTRUCTION — proven by
//      re-ordering the server's list, not by reading one hardcoded id;
//   3. an open card SPANS both columns (measured against its closed sibling);
//   4. the strip WRAPS: the region never scrolls sideways, at seven offers;
//   5. the head is pinned OUTSIDE the clamp — it stays put while the body
//      scrolls, which is where 172's outcome banner hangs;
//   6. the actionable count is mirrored in the TOP BAR;
//   7. 🚩 what is VISIBLE, not how tall the region is: at seven offers the open
//      card's set statement, its meter and its delta are all inside the
//      scroller's visible box, and every class is still reachable;
//   8. 🚩 no figure formatted as MONEY anywhere in the region — asserted in the
//      narrow form, over a fixture whose own description carries `SAR`;
//   9. the empty state leaves no hole, and the get-side acknowledgement
//      disappears ON ITS OWN when a get-side prerequisite arrives, with no
//      other change.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`

const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
// v1.2 (857): a capture is `{ request, response: { statusCode, body } }` where
// `body` is the envelope — so a payload is one level deeper than it was.
const fixture = (name) => raw(name).response.body.data

// 🚩 The legs the capture could NOT take, from the same file `__fixtures__/payloads.ts`
// reads (ticket 177). NOT the wire: 859 leaves every captured `offerId` blank, which
// costs the three rendering classes AND 404s the resolve leg this drive's click-through
// needs. Held at the v1.0 provisional until 859 lands and both can be re-captured.
const UNREACHABLE = JSON.parse(
  readFileSync(
    new URL('../src/features/callcenter/console/__fixtures__/unreachable-v1_0.json', import.meta.url),
    'utf8',
  ),
)

const OPEN_RESULT = fixture('01-open-empty')
// A real basket under the strip: 135 amendment 2 set this ticket's density budget
// inside a console that has one.
const PRICED = fixture('02-two-lines-priced')

// The three classes — a shortfall, an `isReady` offer that is out-ranked, and a
// `NOT_DISCOVERED` skip. 🚩 These are the UNREACHABLE block, not the capture: the
// captured `stateFragment` holds two offers, both unready, both with a blank
// `offerId` (859), and `NOT_DISCOVERED` cannot be produced at all until 855 lands.
// The shape is the contract's either way; only the class diversity is provisional.
const [ACTIONABLE, COUNTED, SKIPPED] = UNREACHABLE.nearMissClasses.nearMisses

// What the capture really holds, driven as its own scenario below — the state the
// console will actually meet the day it is pointed at the live server.
const CAPTURED_NEAR_MISSES = raw('03-near-miss-buy-side').stateFragment.nearMisses

/** A near-miss shaped like the fixture's, varied only where a scenario is about
 *  the variation. Ids are made distinct so "which card" is provable. */
const like = (base, over) => ({ ...base, ...over })

const BIG_SET = like(ACTIONABLE, {
  offerId: 'BBY-7001',
  description: '25% off personal care',
  progress: { have: 0, need: 2 },
  prereq: { kind: 'grouping', groupingId: 'G-7001', eligibleCount: 997 },
})
const SECOND_ACTIONABLE = like(ACTIONABLE, {
  offerId: 'BBY-6032',
  description: 'Buy 2 get 1 — vitamins',
  prereq: { kind: 'grouping', groupingId: 'G-6032', eligibleCount: 18 },
})
const THIRD_ACTIONABLE = like(ACTIONABLE, {
  offerId: 'BBY-6210',
  description: 'SAR 29.95 for any 2 — first aid',
  prereq: { kind: 'material', groupingId: null, eligibleCount: 1 },
})
const SECOND_SKIPPED = like(SKIPPED, {
  offerId: 'BBY-6110',
  description: '15% off baby care',
  // 🚩 A category this client has never seen — §9's minor-version addition. It
  // must still read as words.
  skipReason: 'ACCUMULATION_EXHAUSTED',
})
const ORIGIN_SKIPPED = like(SKIPPED, { offerId: 'BBY-6501', description: 'SAR 20 off skin care', skipReason: 'ORIGIN_FILTERED' })

// 787-C landing: a get-side prerequisite in the list IS the coverage.
const GET_SIDE = like(SECOND_ACTIONABLE, {
  offerId: 'BBY-6033',
  prereq: { kind: 'condition', groupingId: 'G-6033', eligibleCount: 18 },
})

// The additive discount block (§9 — absent from the frozen fixtures, degraded
// while it is). The strip's whole first ruling is that THIS is the headline.
const WITH_DEFINITIONS = [
  like(ACTIONABLE, { offerId: 'BBY-5510', discount: { discountType: '%', value: 20 } }),
  like(SECOND_ACTIONABLE, { discount: { discountType: 'P', value: 29.95, quantity: 2 } }),
  like(THIRD_ACTIONABLE, { discount: { discountType: 'N', value: 1, nthFree: 3 } }),
  like(COUNTED, { discount: { discountType: 'R', value: 30 } }),
  ORIGIN_SKIPPED,
]

const SCENARIOS = {
  three: [ACTIONABLE, COUNTED, SKIPPED],
  bigSet: [BIG_SET, COUNTED, SKIPPED],
  many: [ACTIONABLE, SECOND_ACTIONABLE, THIRD_ACTIONABLE, BIG_SET, COUNTED, ORIGIN_SKIPPED, SECOND_SKIPPED],
  readyOnly: [COUNTED, ORIGIN_SKIPPED, SECOND_SKIPPED],
  none: [],
  getSideLanded: [ACTIONABLE, GET_SIDE, COUNTED, SKIPPED],
  definitions: WITH_DEFINITIONS,
  // The construction test: the server's order is different, so a hardcoded id
  // would open the wrong card.
  reordered: [COUNTED, SECOND_ACTIONABLE, ACTIONABLE, SKIPPED],
  // 🚩 Ticket 177 — the wire as it ACTUALLY is: two offers, both unready, both
  // with a blank `offerId` (859). Every scenario above is the provisional; this
  // is the one the console will meet on the day it is pointed at the server.
  captured: CAPTURED_NEAR_MISSES,
}

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

// The on-demand half (§3.3) — the contract's own resolution for BBY-5510: three
// ranked, ATP-filtered rows, one of them with a degraded stock read, all three
// carrying `description2`. `truncated: true` against a 42-strong population, so
// the route to the rest is real.
// 🚩 The captured leg is a 404 (859): §3.3 addresses an offer by `offerId` and
// every captured one is blank, so the click-through cannot reach its own
// near-miss. Held at the v1.0 provisional — the drive still has to prove the
// surface, and there is no other input for it.
const RESOLUTION = UNREACHABLE.prereqResolution.data

/**
 * A console whose order carries `nearMisses`, and nothing else changed.
 *
 * `opts.afterAdd` is what the engine answers an `AddItem` with — the whole
 * `SessionState`, as every mutating verb does (law 2), with its `version` moved
 * on. `opts.addDelayMs` holds the answer long enough for the in-flight row to be
 * measured, which is the only way to prove it does not move.
 */
async function open(browser, nearMisses, opts = {}) {
  const state = { ...PRICED, nearMisses }
  const requests = []
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
    requests.push(url)
    const p = url.split('/api/')[1].split('?')[0]
    // 🚩 On demand and never inline: the console asks for one offer's items when
    // a card is opened, and the drive records every call so "never inline" is a
    // measurement rather than a comment.
    if (p === 'CallCenterWeb/ResolvePrereq')
      return route.fulfill(envelope(opts.resolution ?? RESOLUTION))
    if (p === 'CallCenterWeb/AddItem') {
      if (opts.addDelayMs) await new Promise((r) => setTimeout(r, opts.addDelayMs))
      return route.fulfill(envelope(opts.afterAdd ?? { ...state, version: state.version + 1 }))
    }
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ ...OPEN_RESULT, outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    if (p === 'CallCenterWeb/ItemSearch')
      return route.fulfill(envelope({ truncated: false, atpAvailable: true, rows: [] }))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })

  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
  await page.locator('[data-cc-guidance]').waitFor({ timeout: 10_000 })
  return { context, page, errors, requests }
}

const text = async (page, selector) => (await page.locator(selector).first().innerText()).trim()

/**
 * 🚩 138's own finding, the hard way: a clamped region turns new content into
 * SCROLL, so every height check passes while the route to the rest of a set drops
 * below the fold. This is the assertion that catches it — is the element's box
 * actually inside the scroller's visible box, right now, with no scrolling.
 */
async function visibleInside(page, scroller, selector) {
  const box = await page.locator(selector).first().boundingBox()
  const clip = await page.locator(scroller).boundingBox()
  if (!box || !clip) return false
  return box.y >= clip.y - 1 && box.y + box.height <= clip.y + clip.height + 1
}

/**
 * "Formatted as money", in the narrow form the ruling requires: a figure wearing
 * a currency word, or a figure whose decimals were FORCED to two (`12.00`,
 * `8.40`) — the shape a money formatter produces. NOT "no `SAR` anywhere": the
 * fixture's own `"SAR 10 off when you buy 3 — baby care"` is server text nobody
 * may edit, and the broad form fails on it.
 */
/**
 * The region's text with the SERVER's own text taken out — every node the
 * console marks `data-cc-server-text` is a promotion description passed through
 * as data. It is the half of the narrow rule that the region can actually keep:
 * `"SAR 10 off when you buy 3"` is in the contract's own fixture and nobody may
 * edit it, so the assertion is about what the CONSOLE formats.
 */
const consoleText = (page) =>
  page.evaluate(() => {
    const clone = document.querySelector('[data-cc-guidance]').cloneNode(true)
    for (const node of clone.querySelectorAll('[data-cc-server-text]')) node.remove()
    return clone.textContent
  })

function moneyShaped(regionText) {
  const offenders = []
  for (const m of regionText.matchAll(/(?:SAR|SR)\s*\d[\d.,]*|\d[\d.,]*\s*(?:SAR|SR)\b/g)) offenders.push(m[0])
  for (const m of regionText.matchAll(/\d+\.\d{2}(?!\d)/g))
    if (String(Number(m[0])) !== m[0]) offenders.push(m[0])
  return offenders
}

async function run() {
  const browser = await chromium.launch()

  // ---- 1, 6, 8. one of each class: rank, treatment, words — and the count ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.three)

    check(
      'only the actionable offer is drawn as a card',
      (await page.locator('[data-cc-card]').count()) === 1 &&
        (await page.locator('[data-cc-card-class="actionable"]').count()) === 1,
      `${await page.locator('[data-cc-card]').count()} card(s)`,
    )
    check(
      'the already-counted offer is a pill, not a card, and carries no action',
      (await page.locator(`[data-cc-counted-item="${COUNTED.offerId}"]`).isVisible()) &&
        (await page.locator(`[data-cc-card="${COUNTED.offerId}"]`).count()) === 0 &&
        (await page.locator(`[data-cc-counted-item="${COUNTED.offerId}"] button`).count()) === 0,
    )
    const countedWords = await text(page, '[data-cc-guidance-counted]')
    check(
      'and says in WORDS that there is nothing to do',
      /already counted/i.test(countedWords) && /better offer/i.test(countedWords),
      countedWords.replace(/\s+/g, ' '),
    )

    // The blocked class: one collapsed line, never a card — and the WHY is the
    // agent's sentence, not the wire's code.
    const blockedLine = await text(page, '[data-cc-unavailable-toggle]')
    check(
      "the unreachable offers collapse to one line that says they can't be reached",
      /can't be reached/i.test(blockedLine),
      blockedLine.replace(/\s+/g, ' '),
    )
    await page.locator('[data-cc-unavailable-toggle]').click()
    const reason = await text(page, `[data-cc-unavailable-item="${SKIPPED.offerId}"] [data-cc-reason]`)
    check('a blocked offer says WHY in the agent’s words', reason.length > 0 && /checked from this basket/i.test(reason), reason)
    check(
      '🚩 and never the wire code',
      !(await text(page, '[data-cc-guidance]')).includes(SKIPPED.skipReason),
      SKIPPED.skipReason,
    )

    // The three classes are told apart by more than hue: card vs pill vs line is
    // three different ELEMENTS with three different words. Rank is the order.
    const order = await page.evaluate(() => {
      const region = document.querySelector('[data-cc-guidance-scroll]')
      return [...region.querySelectorAll('[data-cc-card],[data-cc-guidance-counted],[data-cc-unavailable-toggle]')].map(
        (el) => (el.hasAttribute('data-cc-card') ? 'card' : el.hasAttribute('data-cc-guidance-counted') ? 'counted' : 'blocked'),
      )
    })
    check('the classes are ranked: actionable, then counted, then blocked', order.join('>') === 'card>counted>blocked', order.join('>'))

    // 6 — the count, mirrored where the agent is looking (US51).
    check(
      'the actionable count is mirrored in the top bar',
      (await page.locator('[data-cc-guidance-count]').getAttribute('data-cc-guidance-count')) === '1' &&
        /1 offer within reach/i.test(await text(page, '[data-cc-guidance-count]')),
      await text(page, '[data-cc-guidance-count]'),
    )

    // 8 — the region's own property. The fixture's own SAR-carrying description
    // is on screen, and it is not a violation; a formatted figure would be.
    check(
      "the server's own currency word is passed through untouched",
      (await text(page, '[data-cc-guidance]')).includes('SAR 10 off when you buy 3'),
      'fixture 03’s description',
    )
    const authored = await consoleText(page)
    check(
      '🚩 no figure formatted as money anywhere the console authors',
      moneyShaped(authored).length === 0,
      moneyShaped(authored).join(' · '),
    )

    // What it needs — the meter, the delta, and the honest set statement.
    check('the card carries a meter', await page.locator(`[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-meter]`).isVisible())
    check(
      'and the delta, in the agent’s words',
      /add 1 more/i.test(await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-delta]`)),
      await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-delta]`),
    )
    const set = await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-set]`)
    check(
      'the prerequisite is stated as a SET with its honest cardinality',
      /any 1 from this selection/i.test(set) && /42 qualify/i.test(set),
      set,
    )

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 2, 3. open by construction, and an open card spans both columns ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.reordered)
    check(
      'the open card is the top-ranked ACTIONABLE offer, not the first offer',
      (await page.locator(`[data-cc-card="${SECOND_ACTIONABLE.offerId}"]`).getAttribute('data-cc-card-open')) === 'open',
      `server order starts with ${SCENARIOS.reordered[0].offerId} (counted)`,
    )
    check(
      '🚩 and not a hardcoded id — the other actionable card is closed',
      (await page.locator(`[data-cc-card="${ACTIONABLE.offerId}"]`).getAttribute('data-cc-card-open')) === 'closed',
    )

    const openBox = await page.locator(`[data-cc-card="${SECOND_ACTIONABLE.offerId}"]`).boundingBox()
    const closedBox = await page.locator(`[data-cc-card="${ACTIONABLE.offerId}"]`).boundingBox()
    check(
      'the open card spans BOTH columns',
      openBox.width > closedBox.width * 1.8,
      `open ${Math.round(openBox.width)}px vs closed ${Math.round(closedBox.width)}px`,
    )
    check(
      'a CLOSED card still states its set — the cardinality is not behind the disclosure',
      /any 1 from this selection · 42 qualify/.test(
        await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-set]`),
      ),
      await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-set]`),
    )

    // Closing it hands the width back — the span is the OPEN state's, not the card's.
    await page.locator(`[data-cc-card="${SECOND_ACTIONABLE.offerId}"] button[aria-expanded]`).first().click()
    const reclosed = await page.locator(`[data-cc-card="${SECOND_ACTIONABLE.offerId}"]`).boundingBox()
    check('closing it hands the column back', reclosed.width < openBox.width * 0.6, `${Math.round(reclosed.width)}px`)

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 4, 5, 7. seven offers: it wraps, the head stays put, and what matters is VISIBLE ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.many)
    const region = '[data-cc-guidance]'
    const scroller = '[data-cc-guidance-scroll]'

    check('all four actionable offers are drawn', (await page.locator('[data-cc-card]').count()) === 4)
    check(
      'the top bar count agrees with what is drawn',
      (await page.locator('[data-cc-guidance-count]').getAttribute('data-cc-guidance-count')) === '4',
    )

    // 4 — it WRAPS. Never a sideways scroll: the one gesture nobody performs mid-call.
    const sideways = await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      return { scrollW: el.scrollWidth, clientW: el.clientWidth }
    }, scroller)
    check('the strip never scrolls sideways', sideways.scrollW <= sideways.clientW + 1, JSON.stringify(sideways))
    const consoleBox = await page.locator('[data-cc-console]').boundingBox()
    const regionBox = await page.locator(region).boundingBox()
    check(
      'and it stays inside the console rather than pushing it wider',
      regionBox.width <= consoleBox.width + 1,
      `${Math.round(regionBox.width)}px`,
    )

    // 5 — the head is pinned OUTSIDE the clamp (where 172's outcome banner hangs).
    const headInside = await page.evaluate(
      (sel) => document.querySelector(sel).contains(document.querySelector('[data-cc-guidance-head]')),
      scroller,
    )
    check('the head is not inside the clamped body', headInside === false)
    await page.locator(scroller).evaluate((el) => el.scrollTo(0, el.scrollHeight))
    check(
      'and it stays put while the body scrolls',
      (await page.locator('[data-cc-guidance-head]').isVisible()) &&
        (await visibleInside(page, region, '[data-cc-guidance-head]')),
    )
    const scrolled = await page.locator(scroller).evaluate((el) => el.scrollTop)
    check('the body is the thing that scrolls', scrolled > 0, `scrollTop ${scrolled}`)
    check(
      'every class is still reachable at seven offers',
      (await page.locator('[data-cc-guidance-counted]').isVisible()) &&
        (await page.locator('[data-cc-unavailable-toggle]').isVisible()),
    )

    // 7 — 🚩 what is VISIBLE, not how tall it is. Back to the top: the open
    // card's three obligations must be inside the scroller's own box.
    await page.locator(scroller).evaluate((el) => el.scrollTo(0, 0))
    const openCard = `[data-cc-card="${ACTIONABLE.offerId}"]`
    for (const [what, sel] of [
      ['what it gives', `${openCard} [data-cc-card-desc]`],
      ['its meter', `${openCard} [data-cc-meter]`],
      ['its delta', `${openCard} [data-cc-delta]`],
      ['the set statement', `${openCard} [data-cc-set]`],
    ])
      check(`${what} is visible without scrolling`, await visibleInside(page, scroller, sel))

    // The clamp itself, stated once — it is a budget, not the assertion.
    const bodyHeight = await page.locator(scroller).evaluate((el) => el.getBoundingClientRect().height)
    check('the body is clamped at 18rem', bodyHeight <= 288 + 1, `${Math.round(bodyHeight)}px`)
    check(
      'the basket is still the region that grows',
      (await page.locator('[data-cc-basket]').boundingBox()).height > 0 &&
        regionBox.height < (await page.locator('[data-cc-console]').boundingBox()).height * 0.45,
      `${Math.round(regionBox.height)}px`,
    )

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- the big set: the cardinality is the SERVER's, and it is printed honestly ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.bigSet)
    const set = await text(page, `[data-cc-card="${BIG_SET.offerId}"] [data-cc-set]`)
    check('a 997-strong set says so rather than naming an item', /997 qualify/.test(set) && /any 2/.test(set), set)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- the discount definition is the HEADLINE, and the description the sub-line ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.definitions)
    const gives = `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-gives]`
    check('the card leads with what the offer GIVES', (await text(page, gives)) === '20% off', await text(page, gives))
    const givesSize = await page.locator(gives).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    const descSize = await page
      .locator(`[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-card-desc]`)
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    check(
      '🚩 at HEADLINE size, with the server’s description demoted beneath it',
      givesSize >= descSize * 1.4,
      `${givesSize}px vs ${descSize}px`,
    )
    check(
      'and the description is still there, untouched',
      (await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-card-desc]`)) === ACTIONABLE.description,
    )
    check(
      'a set price reads as pieces, not as a price',
      (await text(page, `[data-cc-card="${SECOND_ACTIONABLE.offerId}"] [data-cc-gives]`)) === 'Both for 29.95',
    )
    check(
      'free goods read as the piece they land on',
      (await text(page, `[data-cc-card="${THIRD_ACTIONABLE.offerId}"] [data-cc-gives]`)) === '3rd free',
    )
    // 🚩 The definitions themselves are the risk here: `Both for 29.95` is the
    // honest numeral, and `29.95 SAR` / `30.00` are what may never appear.
    const authored = await consoleText(page)
    // The scan's own self-test: a check that had quietly stopped seeing the
    // console's figures would pass forever. It sees this one.
    check('the scan is looking at the figures the console authors', authored.includes('29.95'))
    check('🚩 and still no figure formatted as money', moneyShaped(authored).length === 0, moneyShaped(authored).join(' · '))
    check(
      'the scan would catch one if it were there',
      moneyShaped(`${authored} 29.95 SAR`).length === 1 && moneyShaped(`${authored} 30.00`).length === 1,
    )
    check('no savings total is printed anywhere', !/save|saving/i.test(await text(page, '[data-cc-guidance]')))
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- nothing actionable: honest, and not a hole ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.readyOnly)
    check('no cards are drawn', (await page.locator('[data-cc-card]').count()) === 0)
    check('and the top bar claims nothing', (await page.locator('[data-cc-guidance-count]').count()) === 0)
    check(
      'the two classes that remain are still told apart',
      (await page.locator('[data-cc-guidance-counted]').isVisible()) &&
        (await page.locator('[data-cc-unavailable-toggle]').isVisible()),
    )
    await page.locator('[data-cc-unavailable-toggle]').click()
    const unknown = await text(page, `[data-cc-unavailable-item="${SECOND_SKIPPED.offerId}"] [data-cc-reason]`)
    check(
      '🚩 a skip category this client has never seen still reads as WORDS',
      unknown.length > 0 && !unknown.includes('ACCUMULATION') && !/[A-Z]{3,}_/.test(unknown),
      unknown,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- no near-misses at all ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.none)
    check('the empty region says so in one line', await page.locator('[data-cc-guidance-empty]').isVisible())
    check('and leaves no clamped body behind it', (await page.locator('[data-cc-guidance-scroll]').count()) === 0)
    const height = (await page.locator('[data-cc-guidance]').boundingBox()).height
    check('it costs the basket almost nothing', height < 120, `${Math.round(height)}px`)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 177: the capture's own near-misses, blank offer ids and all ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.captured)
    const cards = await page.locator('[data-cc-card]').count()
    check(
      '🚩 two offers sharing one blank offerId still draw two cards',
      cards === CAPTURED_NEAR_MISSES.length,
      `${cards} of ${CAPTURED_NEAR_MISSES.length}`,
    )
    const strip = await text(page, '[data-cc-guidance]')
    check(
      'and neither of them prints the empty id at the agent',
      !/offerId|undefined|null/i.test(strip),
    )
    check(
      'the region still says the get side is unchecked',
      (await page.locator('[data-cc-guidance-getside]').count()) === 1,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 9. 787-C lands: the acknowledgement disappears on its own ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.three)
    check(
      'while the get side is unchecked, the surface says so once',
      (await page.locator('[data-cc-guidance-getside]').count()) === 1 &&
        /buy-one-get-one/i.test(await text(page, '[data-cc-guidance-getside]')),
    )
    await context.close()

    const landed = await open(browser, SCENARIOS.getSideLanded)
    check(
      '🚩 a get-side prerequisite arriving removes it, with no other change',
      (await landed.page.locator('[data-cc-guidance-getside]').count()) === 0 &&
        (await landed.page.locator('[data-cc-card]').count()) === 2,
    )
    check('no console errors', errors.length === 0 && landed.errors.length === 0, errors[0] ?? landed.errors[0] ?? '')
    await landed.context.close()
  }

  // ================= ticket 172 — the half that DOES something =================

  // ---- 10, 11. the qualifying handful: three, the server's, and Arabic on the meta line ----
  {
    const { context, page, errors, requests } = await open(browser, SCENARIOS.three)
    const card = `[data-cc-card="${ACTIONABLE.offerId}"]`
    await page.locator(`${card} [data-cc-qualifying-row]`).first().waitFor({ timeout: 10_000 })

    check(
      'the open card resolves its prerequisite to actual items',
      (await page.locator(`${card} [data-cc-qualifying-row]`).count()) === 3,
      `${await page.locator(`${card} [data-cc-qualifying-row]`).count()} row(s)`,
    )
    check(
      '🚩 on demand — one resolution, for the open card only',
      requests.filter((u) => u.includes('ResolvePrereq')).length === 1 &&
        requests.some((u) => u.includes(`offerId=${ACTIONABLE.offerId}`)) &&
        !requests.some((u) => u.includes(`offerId=${COUNTED.offerId}`)),
      requests.filter((u) => u.includes('ResolvePrereq')).length + ' call(s)',
    )
    check(
      '🚩 and never on Bby/* — 134’s one-grant ruling',
      !requests.some((u) => /\/api\/Bby\//.test(u)),
    )

    // 11 — the Arabic name, on the META line beside the item number and the
    // estimate. Its own line would have pushed the route to the rest below the
    // fold (138's second Arabic finding); here it costs zero pixels.
    const meta = `${card} [data-cc-qualifying-row="200145"] [data-cc-qualifying-meta]`
    const parts = await page.locator(`${meta} [data-cc-qualifying-part]`).evaluateAll((els) =>
      els.map((el) => [el.getAttribute('data-cc-qualifying-part'), el.textContent.trim()]),
    )
    check(
      'the qualifying row carries item number · Arabic · estimate, in that order',
      parts.map(([id]) => id).join('>') === 'itemNumber>description2>estimate',
      parts.map(([id]) => id).join('>'),
    )
    check(
      '🚩 and the Arabic is the master’s own name',
      parts[1][1] === 'معجون أسنان',
      parts[1][1],
    )
    check(
      'the Arabic run is bidi-isolated and dir-PINNED, never dir="auto"',
      await page
        .locator(`${meta} [data-cc-qualifying-part="description2"] bdi`)
        .evaluate((el) => el.getAttribute('dir') === 'ltr'),
    )
    check(
      'the estimate stays off the money column and is marked as one',
      /^≈9\.13$/.test(parts[2][1]),
      parts[2][1],
    )
    check(
      'a degraded stock read is drawn as unknown, not as none',
      (await page
        .locator(`${card} [data-cc-qualifying-row="200190"] [data-cc-atp]`)
        .getAttribute('data-cc-atp')) === 'unknown',
    )
    const authored = await consoleText(page)
    check(
      '🚩 still no figure formatted as money, with the items on screen',
      moneyShaped(authored).length === 0 && authored.includes('9.13'),
      moneyShaped(authored).join(' · '),
    )

    // 🚩 138's own finding, on the content 172 adds: a clamped region turns new
    // content into SCROLL, and what went below the fold when Arabic took a line
    // of its own was **the third item and the route to the rest** — the two
    // things this ticket puts inside the clamp. Height checks all passed while
    // it happened, so the assertion is what is VISIBLE.
    const scroller = '[data-cc-guidance-scroll]'
    for (const [what, sel] of [
      ['the third qualifying item', `${card} [data-cc-qualifying-row="200190"]`],
      ['the route to the rest', `${card} [data-cc-search-rest]`],
      ['its Arabic name', `${card} [data-cc-qualifying-row="200190"] [data-cc-qualifying-part="description2"]`],
    ])
      check(`${what} is visible without scrolling`, await visibleInside(page, scroller, sel))

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 7b. and still visible at SEVEN offers, where 138 measured the budget ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.many)
    const card = `[data-cc-card="${ACTIONABLE.offerId}"]`
    const scroller = '[data-cc-guidance-scroll]'
    await page.locator(`${card} [data-cc-qualifying-row]`).first().waitFor({ timeout: 10_000 })
    await page.locator(scroller).evaluate((el) => el.scrollTo(0, 0))
    for (const [what, sel] of [
      ['the first qualifying item', `${card} [data-cc-qualifying-row="200145"]`],
      ['the third qualifying item', `${card} [data-cc-qualifying-row="200190"]`],
      ['the route to the rest', `${card} [data-cc-search-rest]`],
    ])
      check(`at seven offers, ${what} is still visible`, await visibleInside(page, scroller, sel))
    const region = await page.locator('[data-cc-guidance]').boundingBox()
    const console_ = await page.locator('[data-cc-console]').boundingBox()
    check(
      'and the region is still inside 135’s density budget with the items open',
      region.height < console_.height * 0.45,
      `${Math.round(region.height)}px of ${Math.round(console_.height)}px`,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 10b. three is the SERVER's topN — the client slices nothing ----
  {
    const wider = {
      ...RESOLUTION,
      items: [...RESOLUTION.items, { ...RESOLUTION.items[0], itemNumber: '200999' }],
    }
    const { context, page, errors } = await open(browser, SCENARIOS.three, { resolution: wider })
    const rows = `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-qualifying-row]`
    await page.locator(rows).first().waitFor({ timeout: 10_000 })
    check(
      '🚩 a fourth row the server ranked is drawn — the handful is topN, not a client slice',
      (await page.locator(rows).count()) === 4,
      `${await page.locator(rows).count()} row(s)`,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 12. adding: the row that launched it says so, and does NOT move ----
  {
    const { context, page, errors } = await open(browser, SCENARIOS.three, { addDelayMs: 1200 })
    const card = `[data-cc-card="${ACTIONABLE.offerId}"]`
    const row = `${card} [data-cc-qualifying-row="200145"]`
    await page.locator(row).waitFor({ timeout: 10_000 })
    const before = await page.locator(row).boundingBox()
    const others = await page.locator(`${card} [data-cc-qualifying-row]`).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-cc-qualifying-row')),
    )

    await page.locator(`${card} [data-cc-qualifying-add="200145"]`).click()
    check(
      'the add runs on the row that launched it',
      /adding/i.test(await text(page, `${card} [data-cc-qualifying-add="200145"]`)),
      await text(page, `${card} [data-cc-qualifying-add="200145"]`),
    )
    const during = await page.locator(row).boundingBox()
    check(
      '🚩 and the row does not move while it runs',
      Math.abs(during.y - before.y) < 1 && Math.abs(during.x - before.x) < 1,
      `${Math.round(before.y)} → ${Math.round(during.y)}`,
    )
    check(
      'the order of the rows is untouched mid-flight',
      (
        await page.locator(`${card} [data-cc-qualifying-row]`).evaluateAll((els) =>
          els.map((el) => el.getAttribute('data-cc-qualifying-row')),
        )
      ).join(',') === others.join(','),
    )
    check(
      'no second add can be launched on top of it',
      await page.locator(`${card} [data-cc-qualifying-add="200146"]`).isDisabled(),
    )
    await page.locator('[data-cc-outcome]').waitFor({ timeout: 10_000 })
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 13. three outcomes, because the re-price is the ENGINE's ----
  const addFrom = async (afterAdd) => {
    const opened = await open(browser, SCENARIOS.three, { afterAdd })
    const add = `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-qualifying-add="200145"]`
    await opened.page.locator(add).waitFor({ timeout: 10_000 })
    await opened.page.locator(add).click()
    await opened.page.locator('[data-cc-outcome]').waitFor({ timeout: 10_000 })
    return opened
  }
  const nextState = (over) => ({ ...PRICED, nearMisses: SCENARIOS.three, version: PRICED.version + 1, ...over })

  {
    // 1 — fired: the offer moved to the fired list.
    const { context, page, errors } = await addFrom(
      nextState({
        nearMisses: [COUNTED, SKIPPED],
        firedPromotions: [
          ...PRICED.firedPromotions,
          { offerId: ACTIONABLE.offerId, description: ACTIONABLE.description, amount: -9.5, lineIds: ['L1'] },
        ],
      }),
    )
    check(
      'a fired offer says so',
      (await page.locator('[data-cc-outcome]').getAttribute('data-cc-outcome')) === 'fired' &&
        /this offer applied/i.test(await text(page, '[data-cc-outcome-said]')),
      await text(page, '[data-cc-outcome]'),
    )
    check('and the card it came from is gone — the offer is no longer a near-miss', (await page.locator(`[data-cc-card="${ACTIONABLE.offerId}"]`).count()) === 0)
    // 🚩 The banner is where 171 pinned its slot: OUTSIDE the clamp, so it does
    // not scroll away from the agent who has just pressed the button.
    check(
      '🚩 the outcome banner is outside the clamped body',
      await page.evaluate(
        () =>
          !!document.querySelector('[data-cc-guidance-head]')?.contains(document.querySelector('[data-cc-outcome]')) &&
          !document.querySelector('[data-cc-guidance-scroll]')?.contains(document.querySelector('[data-cc-outcome]')),
      ),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  {
    // 2 — a DIFFERENT offer fired. The caller is about to be told a figure that
    // belongs to something else, so it is named.
    const { context, page, errors } = await addFrom(
      nextState({
        nearMisses: [{ ...ACTIONABLE, progress: { have: 2, need: 3 } }, COUNTED, SKIPPED],
        firedPromotions: [
          ...PRICED.firedPromotions,
          { offerId: 'BBY-9900', description: 'SAR 15 off two — oral care', amount: -15, lineIds: ['L1'] },
        ],
      }),
    )
    check(
      'a better offer firing instead is said out loud, and named',
      (await page.locator('[data-cc-outcome]').getAttribute('data-cc-outcome')) === 'firedOther' &&
        /better offer fired instead/i.test(await text(page, '[data-cc-outcome-said]')) &&
        (await text(page, '[data-cc-outcome]')).includes('SAR 15 off two'),
      await text(page, '[data-cc-outcome]'),
    )
    // 🚩 The offer's own name carries a currency word, and it is SERVER text —
    // the region's rule is *no figure the console formats as money*.
    const authored = await consoleText(page)
    check('🚩 and the console still formats no money around it', moneyShaped(authored).length === 0, moneyShaped(authored).join(' · '))
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  {
    // 3 — nothing fired. The offer STAYS and only its meter moves. Silence here
    // reads as a broken button; removing the card reads as a bug.
    const { context, page, errors } = await addFrom(
      nextState({ nearMisses: [{ ...ACTIONABLE, progress: { have: 2, need: 3 } }, COUNTED, SKIPPED] }),
    )
    check(
      'an add that fired nothing says what is still needed',
      (await page.locator('[data-cc-outcome]').getAttribute('data-cc-outcome')) === 'didNotFire' &&
        /still needs 1 more/i.test(await text(page, '[data-cc-outcome-said]')),
      await text(page, '[data-cc-outcome-said]'),
    )
    check(
      '🚩 the offer STAYS — the card is still there',
      (await page.locator(`[data-cc-card="${ACTIONABLE.offerId}"]`).count()) === 1,
    )
    check(
      '🚩 and only its meter moved: 1/2 → 2/3',
      /2\/3/.test(await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-meter]`)),
      await text(page, `[data-cc-card="${ACTIONABLE.offerId}"] [data-cc-meter]`),
    )
    // It is read once and dismissed — a banner the agent cannot clear becomes
    // furniture by the third call.
    await page.locator('[data-cc-outcome-dismiss]').click()
    check('the banner is dismissible', (await page.locator('[data-cc-outcome]').count()) === 0)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 14. the route to the rest is a HAND-OFF, not a second list ----
  {
    const { context, page, errors, requests } = await open(browser, SCENARIOS.bigSet)
    const card = `[data-cc-card="${BIG_SET.offerId}"]`
    await page.locator(`${card} [data-cc-search-rest]`).waitFor({ timeout: 10_000 })
    const route = await text(page, `${card} [data-cc-search-rest]`)
    check(
      'a 997-strong set offers the route to the rest, with the honest figure',
      /search the other 994/i.test(route),
      route,
    )

    await page.locator(`${card} [data-cc-search-rest]`).click()
    check(
      '🚩 it lands in the console’s own item search — no second list, no modal',
      (await page.locator('[data-cc-search-scope]').count()) === 1 &&
        (await page.locator('[data-cc-qualifying-row]').count()) > 0,
    )
    check(
      'and the panel says WHICH offer it is narrowed to',
      (await text(page, '[data-cc-search-scope]')).includes(BIG_SET.description),
      await text(page, '[data-cc-search-scope]'),
    )
    check(
      'the cursor is already in the box the agent is about to type in',
      await page.evaluate(() => document.activeElement?.id === 'cc-item-search'),
    )

    await page.locator('[data-cc-search-input]').fill('tooth')
    await page.locator('[data-cc-search-empty],[data-cc-search-row]').first().waitFor({ timeout: 10_000 })
    const searches = requests.filter((u) => u.includes('CallCenterWeb/ItemSearch'))
    check(
      '🚩 and the search itself is narrowed to the offer',
      searches.length > 0 && searches.every((u) => u.includes(`offerId=${BIG_SET.offerId}`)),
      searches.at(-1) ?? 'no search',
    )

    await page.locator('[data-cc-search-scope-clear]').click()
    check('the way back to the whole catalogue is one click', (await page.locator('[data-cc-search-scope]').count()) === 0)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
