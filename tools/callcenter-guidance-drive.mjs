// The guidance strip, driven in the REAL app (ticket 171) — map 126's differentiator.
//
//   1. run the app:  npx vite --port 5210
//   2. node tools/callcenter-guidance-drive.mjs
//
// Nothing is stubbed except the wire, and the near-misses come from the contract's
// own committed fixture — `.issues/assets/136-cc-contract/03-near-miss-buy-side.json`,
// whose `stateFragment` holds one of each class by construction. The basket under
// them is fixture 02, because 138's density budget was measured inside a real
// console with a real basket and a real receipt, and a guidance surface judged in a
// vacuum always passes.
//
// Asserts ticket 171's Proof (`theStripScansAtAGlance`), over 138's states:
//   three · bigSet · many · readyOnly · none · getSideLanded, plus `definitions`
//   (the additive discount block the strip's headline is for).
//   ⚠ 138's other three states — `adding` · `didNotFire` · `firedOther` — are the
//   one-click ADD's, which is ticket 172. They land with it, in this file.
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
const fixture = (name) => raw(name).response.data

const OPEN_RESULT = fixture('01-open-empty')
// A real basket under the strip: 135 amendment 2 set this ticket's density budget
// inside a console that has one.
const PRICED = fixture('02-two-lines-priced')

// The contract's own three classes — a shortfall, an `isReady` offer that is
// out-ranked, and a `NOT_DISCOVERED` skip. Verbatim; the console is being driven
// against the frozen shape rather than against a mock of it.
const [ACTIONABLE, COUNTED, SKIPPED] = raw('03-near-miss-buy-side').stateFragment.nearMisses

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

/** A console whose order carries `nearMisses`, and nothing else changed. */
async function open(browser, nearMisses) {
  const state = { ...PRICED, nearMisses }
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
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ ...OPEN_RESULT, outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })

  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
  await page.locator('[data-cc-guidance]').waitFor({ timeout: 10_000 })
  return { context, page, errors }
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

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
