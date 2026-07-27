// Promotions-rail drive (ticket 117, spec 110) — drives the REAL app in Chromium and
// serves captured `Pricing/Simulate` responses from `.issues/assets/098-simulate-payloads/`
// as the wire, exactly as `tools/sim-strip-drive.mjs` and `tools/sim-states-drive.mjs`
// do. The app is not stubbed, only the wire.
//
// Its own file and its own port (5201) rather than an extension of 116's, so the two
// slices of this wave run without contending for either.
//
// Asserts the ticket's Done-when:
//   1. after a run the rail sits BESIDE the results at 66/34, as its own frame;
//   2. fires and near-misses render as cards in the SAME rail, a near-miss neutral
//      (`○`, no attention hue anywhere on its card) rather than a warning;
//   3. every fired card PRINTS the lines it touched, sorted — including the capture
//      where one bonus buy discounts two lines;
//   4. hovering a card tints exactly the lines it names, and nothing else;
//   5. a promo-off run STATES that nothing was measured rather than showing an empty
//      rail — and a promo-ON run that simply earned nothing says so differently.
//
//   1. run the app:  npx vite --port 5201
//   2. node tools/sim-rail-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`
const DIR = '.issues/assets/098-simulate-payloads/'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

const capture = (file) => JSON.parse(readFileSync(DIR + file, 'utf8')).response.data

/**
 * Three captures, three shapes of rail:
 *
 * - `two-lines`  — 05-pricing-elements: ONE applied bonus buy over a TWO-line basket,
 *   whose `affectedItemNumbers` arrive as `[20, 10]`. The whole printed-line-list rule
 *   exists because of this payload, and the wire order is what makes the sort visible.
 * - `both-kinds` — 03-applied-and-potential: one fired AND one near-miss, so the "same
 *   rail" claim is testable rather than asserted twice on two baskets.
 * - `plain`      — 01-plain-multiline: three lines, nothing fired, nothing missed. The
 *   measured-but-empty case, which must NOT read like the promo-off one.
 *
 * A fourth arrived with ticket 161:
 *
 * - `percent-miss` — 01-near-miss-owner-supplied: the `70% 2nd PCS` promotion, whose
 *   wire discount is `{ '%', 35 }`. THE regression capture — that 35 is a percentage,
 *   and the card printed it through the money formatter beside the currency word.
 */
const CAPTURES = {
  'two-lines': capture('05-pricing-elements.json'),
  'both-kinds': capture('03-applied-and-potential-owner-supplied.json'),
  plain: capture('01-plain-multiline.json'),
  'percent-miss': capture('01-near-miss-owner-supplied.json'),
}

async function run() {
  const browser = await chromium.launch()
  // 1600 px wide: the work area clears the 900 px container breakpoint comfortably, so
  // "beside" is the arrangement under test. The stacked one is ticket 119's drive.
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  let serving = 'two-lines'

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'Pricing/CacheAccess') return route.fulfill(envelope({ canClear: true }))
    if (p === 'Pricing/Simulate') return route.fulfill(envelope(CAPTURES[serving]))
    return route.fulfill(envelope({}))
  })

  const rail = () => page.locator('[data-promotions-rail]')
  const resultsFrame = () => page.locator('[data-work-area="results"]')

  const process = async () => {
    await page.getByRole('button', { name: /Process/ }).first().click()
    await page.waitForTimeout(450)
  }

  /** The rail as data: its state, its cards, and what each card prints. */
  const readRail = () =>
    rail().evaluate((el) => ({
      state: el.getAttribute('data-promotions-rail'),
      heading: el.querySelector('h2')?.innerText.trim() ?? null,
      text: el.innerText.replace(/\s+/g, ' ').trim(),
      cards: [...el.querySelectorAll('[data-promo-card]')].map((c) => ({
        kind: c.getAttribute('data-promo-card'),
        bby: c.getAttribute('data-bby'),
        lines: c.querySelector('[data-promo-part="lines"]')?.innerText.trim() ?? null,
        glyph: c.querySelector('[aria-hidden]')?.innerText.trim() ?? null,
      })),
      // The hue budget: a near-miss card must spend NEITHER of the screen's two hues.
      missAttention: [...el.querySelectorAll('[data-promo-card="missed"] *')].filter(
        (n) => typeof n.className === 'string' && /\b(bg|text|border)-attention/.test(n.className),
      ).length,
      missSuccess: [...el.querySelectorAll('[data-promo-card="missed"] *')].filter(
        (n) => typeof n.className === 'string' && /\b(bg|text|border)-success/.test(n.className),
      ).length,
      // A card must not have to be hovered to say which lines it touched.
      missedSection: el.querySelector('[data-promo-missed-section] h3')?.innerText.trim() ?? null,
    }))

  /** Which result lines are currently tinted by the cross-highlight. */
  const litLines = () =>
    resultsFrame().evaluate((el) =>
      [...el.querySelectorAll('tbody tr')]
        .filter((r) => /\bbg-primary-050\b/.test(r.className))
        .map((r) => Number(r.querySelector('td')?.innerText.trim())),
    )

  const boxes = async () => {
    const a = await resultsFrame().evaluate((el) => el.getBoundingClientRect().toJSON())
    const b = await rail().evaluate((el) => el.getBoundingClientRect().toJSON())
    return { results: a, rail: b }
  }

  await page.goto(`${BASE}/pricing/simulation`)
  await page.locator('[data-run-strip]').waitFor()
  await page.waitForTimeout(250)

  check(
    'before a run there is no rail at all — its states are statements about a RUN',
    (await rail().count()) === 0,
  )

  // ======================================== 1 · the 66/34 split, beside not below
  await page.locator('table').first().locator('tbody input').first().fill('107255')
  await page.locator('table').first().locator('tbody input').nth(1).fill('1')
  await process()
  await rail().waitFor()

  let box = await boxes()
  check(
    'after a run the rail sits BESIDE the results, not below them',
    Math.abs(box.rail.top - box.results.top) < 4 && box.rail.left > box.results.right - 4,
    `results ${Math.round(box.results.left)}–${Math.round(box.results.right)} @${Math.round(box.results.top)} · rail ${Math.round(box.rail.left)}–${Math.round(box.rail.right)} @${Math.round(box.rail.top)}`,
  )
  const span = box.rail.right - box.results.left
  const share = (box.results.width / span) * 100
  check(
    'at 66/34 — the results take two thirds of the split, the rail one',
    Math.abs(share - 66) <= 2.5,
    `${share.toFixed(1)}% / ${(100 - share - ((box.rail.left - box.results.right) / span) * 100).toFixed(1)}%`,
  )
  check(
    'the rail is its OWN frame, carrying the screen\'s third heading',
    (await readRail()).heading === 'Promotions' &&
      (await rail().evaluate((el) => /\brounded-lg\b/.test(el.className) && /\bbg-card\b/.test(el.className))),
    (await readRail()).heading ?? '(none)',
  )

  // ============================================ 2 · the printed line list, sorted
  let view = await readRail()
  check(
    'the two-line capture renders exactly one fired card',
    view.cards.length === 1 && view.cards[0].kind === 'fired',
    view.cards.map((c) => c.kind).join(', ') || '(none)',
  )
  check(
    'and the card PRINTS the lines it touched — sorted, though the wire sent [20, 10]',
    view.cards[0].lines === 'lines 10 · 20',
    String(view.cards[0].lines),
  )
  check(
    'the line list is readable with no pointer anywhere near the card',
    /lines 10 · 20/.test(view.text),
  )

  // ============================================ 3 · hover tints exactly those lines
  check('nothing is tinted at rest', (await litLines()).length === 0, JSON.stringify(await litLines()))

  await page.locator('[data-promo-card="fired"]').first().hover()
  await page.waitForTimeout(120)
  const lit = await litLines()
  const printed = view.cards[0].lines.replace('lines ', '').split(' · ').map(Number)
  check(
    'hovering the card tints exactly the lines it names — the highlight AGREES with the printed list',
    JSON.stringify([...lit].sort((a, b) => a - b)) === JSON.stringify(printed),
    `lit ${JSON.stringify(lit)} vs printed ${JSON.stringify(printed)}`,
  )
  await page.locator('h1').hover()
  await page.waitForTimeout(120)
  check('moving off the card clears the tint', (await litLines()).length === 0)

  // ==================================== 4 · fires and near-misses in the SAME rail
  serving = 'both-kinds'
  await process()
  view = await readRail()
  check(
    'a basket with one fire and one near-miss puts BOTH in one rail',
    view.cards.length === 2 &&
      view.cards.filter((c) => c.kind === 'fired').length === 1 &&
      view.cards.filter((c) => c.kind === 'missed').length === 1,
    view.cards.map((c) => c.kind).join(', ') || '(none)',
  )
  check(
    'there is exactly ONE promotions frame — the near-misses did not bring a second one back',
    (await page.locator('[data-promotions-rail]').count()) === 1,
  )
  check(
    'the near-misses are a SUB-section of Promotions, not a second frame with its own h2',
    // The rail carries exactly one heading, and "Could have applied" is not it. (The
    // screen's total h2 count is not asserted here: the two frames ticket 116 dissolves
    // still carry theirs, and counting them would make this drive fail on 116's landing
    // rather than on a defect of its own.)
    view.missedSection === 'Could have applied' && (await rail().locator('h2').count()) === 1,
    `${view.missedSection} · ${await rail().locator('h2').count()} h2 in the rail`,
  )
  check(
    'the fires read BEFORE the near-misses — what happened before what did not',
    view.cards[0].kind === 'fired' && view.cards[1].kind === 'missed',
    view.cards.map((c) => c.kind).join(' → '),
  )
  check(
    'a near-miss card is marked NEUTRAL with ○ rather than borrowing a fired kind glyph',
    view.cards[1].glyph === '○',
    String(view.cards[1].glyph),
  )
  check(
    // The ticket asks every card to name its bonus buy, its CONDITION TYPE and its line
    // list. The `○` takes the tile the kind glyph used to hold, so the kind has to be
    // named in words instead — and the near-miss capture is a `P` (set price), which is
    // exactly the kind that would be unreadable if it were dropped with the glyph.
    'and it still names its condition type — in words, since ○ took the glyph\'s tile',
    /Set price/.test(view.text),
    view.text,
  )
  check(
    'every card names its bonus buy',
    view.cards.every((c) => c.bby) && /000100000131/.test(view.text) && /000100000132/.test(view.text),
    view.cards.map((c) => c.bby).join(', '),
  )

  // This capture is the one where the promotion touches a STRICT SUBSET — two basket
  // lines, one of them promoted — so "tints exactly the lines it names" is a real claim
  // here rather than one satisfied by lighting everything.
  const total = await resultsFrame().locator('tbody tr').count()
  await page.locator('[data-promo-card="fired"]').first().hover()
  await page.waitForTimeout(120)
  const subset = await litLines()
  check(
    'hovering a card that touches SOME lines tints those and leaves the rest alone',
    total === 2 &&
      JSON.stringify(subset) === JSON.stringify(view.cards[0].lines.replace('lines ', '').split(' · ').map(Number)),
    `lit ${JSON.stringify(subset)} of ${total} line(s) · card prints "${view.cards[0].lines}"`,
  )
  await page.locator('[data-promo-card="missed"]').first().hover()
  await page.waitForTimeout(120)
  check(
    'a NEAR-MISS card tints nothing — the wire sends it no item linkage at all, which is why the rail is screen-level',
    (await litLines()).length === 0,
    JSON.stringify(await litLines()),
  )
  await page.locator('h1').hover()
  await page.waitForTimeout(120)
  check(
    'and it spends NEITHER of the screen\'s two hues — a near-miss is not a warning',
    view.missAttention === 0 && view.missSuccess === 0,
    `attention=${view.missAttention} success=${view.missSuccess}`,
  )

  check(
    'the near-miss names the promotion it is about, without being expanded',
    /2 PC for 29\.95 SR/.test(view.text),
    view.text,
  )
  // ---- ticket 161: what the offer GIVES, never a saving it cannot know -------------
  // This capture is the `P` (set price) near-miss, wire value 26.04. The card used to
  // print that through `formatMoney` beside the currency under a "Would save" label;
  // on the `%` capture the same slot printed a PERCENTAGE as `35.00 SAR`.
  check(
    'the near-miss states what the offer GIVES — the discount definition, not a total',
    /GIVES/.test(view.text) && /For 26\.04/.test(view.text),
    view.text,
  )
  // The NARROW rule 138 settled on: not "no `SAR` anywhere" — the server's own
  // description legitimately reads `2 PC for 29.95 SR`, and nobody may edit it — but no
  // figure the CLIENT composes may arrive formatted as money. So the wire value 26.04
  // must never appear with a currency word after it.
  check(
    'and it promises no saving at all — the label and the money-formatted pair are both gone',
    !/would save/i.test(view.text) && !/26\.04\s+[A-Za-z]{2,3}\b/.test(view.text),
    view.text,
  )

  await page.locator('[data-promo-card="missed"]').first().getByRole('button').first().click()
  await page.waitForTimeout(150)
  check(
    // NOT the found-vs-required meter: no capture in the corpus carries a
    // `prerequisites[]` array — the wire sent `[]` on all four near-misses — so the
    // meter has no evidence to render against and the honest path is the reason line.
    // The meter's own hue correction (neutral, not `bg-attention`) is covered by the
    // whole-card hue scan above, which re-runs over the expanded card below.
    'expanding a near-miss whose prerequisites the wire did not send says so in words',
    /didn't fire for this basket/.test((await readRail()).text),
    (await readRail()).text,
  )
  check(
    'and the expanded card still spends neither hue',
    (await readRail()).missAttention === 0 && (await readRail()).missSuccess === 0,
  )

  // =========== 4b · ticket 161's regression capture: a PERCENT near-miss on screen
  // `70% 2nd PCS`, wire discount `{ '%', 35 }`. Before 161 this card read `35.00 SAR`
  // under "Would save" — a percentage printed as money, a number the engine never
  // computed and the customer would never see. It must now read `35% off`.
  serving = 'percent-miss'
  await process()
  view = await readRail()
  check(
    'the percent near-miss states the DEFINITION — 35% off, the offer as a percentage',
    /35% off/.test(view.text),
    view.text,
  )
  check(
    'and 35 never reaches the money formatter — no 35.00, and no currency beside it',
    !/35\.00/.test(view.text) && !/would save/i.test(view.text),
    view.text,
  )

  // ============ 5 · promo-off says nothing was MEASURED; promo-on-but-empty does not
  serving = 'plain'
  await process()
  view = await readRail()
  check(
    'promotions ON but nothing earned: the rail says nothing FIRED — a measured answer',
    view.state === 'empty' && /No promotions fired on this basket\./.test(view.text),
    `${view.state} · ${view.text}`,
  )
  check(
    'and it prints no fired count, because zero fired is the sentence, not a badge',
    !/0 fired/.test(view.text),
    view.text,
  )

  // Switch promotions OFF and re-run the same basket.
  await page.locator('[data-chip-set]').click()
  await page.waitForTimeout(150)
  await page.getByLabel('Promotion').uncheck()
  await page.waitForTimeout(100)
  await process()
  view = await readRail()
  check(
    'a PROMO-OFF run states that nothing was MEASURED — never an empty rail reading as "nothing fired"',
    view.state === 'not-measured' &&
      /Promotions were switched off for this run — nothing was measured\./.test(view.text),
    `${view.state} · ${view.text}`,
  )
  check(
    'the two sentences are different — "nothing measured" is not "nothing fired"',
    !/No promotions fired/.test(view.text),
    view.text,
  )
  check(
    'the rail is still there, holding its width, so the results do not shift under it',
    (await rail().count()) === 1 &&
      Math.abs((await boxes()).results.width - box.results.width) < 4,
    `${Math.round(box.results.width)} → ${Math.round((await boxes()).results.width)}`,
  )
  check(
    'the promotion flag is chipped OFF in the strip, so the blacked-out rail is explained up there too',
    /PROMO off/i.test(await page.locator('[data-run-strip]').innerText()),
    (await page.locator('[data-run-strip]').innerText()).replace(/\s+/g, ' ').trim(),
  )

  // Back ON: the rail must recover, not stay blacked out.
  serving = 'both-kinds'
  await page.locator('[data-chip-set]').click()
  await page.waitForTimeout(150)
  await page.getByLabel('Promotion').check()
  await page.waitForTimeout(100)
  await process()
  view = await readRail()
  check(
    'switching promotions back on restores the cards — the blackout was about the run, not a latch',
    view.state === 'cards' && view.cards.length === 2,
    `${view.state} · ${view.cards.length} card(s)`,
  )

  check('no page errors while driving the promotions rail', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
