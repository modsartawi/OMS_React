// Responsive-arrangement drive (ticket 119, spec 110) — drives the REAL app in
// Chromium and serves captured `Pricing/Simulate` responses from
// `.issues/assets/098-simulate-payloads/` as the wire, exactly as
// `tools/sim-strip-drive.mjs`, `tools/sim-density-drive.mjs` and
// `tools/sim-rail-drive.mjs` do. The app is not stubbed, only the wire.
//
// It measures the WORK AREA, never the viewport. The nav eats 240 px and the shell's
// main pads 16 px a side, so a 1280 laptop with the nav open is a ~1024 screen and a
// viewport-driven assertion here would be testing the wrong number. `setWorkArea`
// below calibrates the viewport against the measured work area rather than assuming a
// constant, so the drive stays honest if the shell's chrome ever changes.
//
// The three widths are the ticket's: 1400 (beside, roomy) · 960 (beside, and the width
// at which the trace inside the 66% column is tightest) · 780 (the floor — stacked).
//
// Asserts the ticket's Done-when:
//   1. above 900 px of work area the rail sits BESIDE the results at 66/34; below it
//      the layout stacks and the rail goes ABOVE them — the frame order changes;
//   2. stacked, the rail is a CARD ROW: a fired promotion is one card-sized card, not
//      a stripe across the screen;
//   3. the elements trace sheds `ctr` first, then `unit`, and never a number — and it
//      never scrolls sideways at any width;
//   4. the strip never fragments past two rows and no chip is ever truncated;
//   5. nothing that is visible at 1400 is hidden at 780 — narrowing changes
//      arrangement, never disclosure;
//   6. 115's density claims, re-measured at all three widths (34 px rows, no scroll
//      box, every captured line visible at once), since this is the drive with the
//      widths set up;
//   7. below the 780 floor the shell scrolls rather than inventing a fourth layout.
//
//   1. run the app:  npx vite --port 5203
//   2. node tools/sim-responsive-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`
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
 * - `elements` — 05-pricing-elements: TWO lines, seven trace rows each, and one fired
 *   bonus buy across both. The only capture in the corpus that carries a trace, so it
 *   is the only one the shed can be driven against — and it fires a promotion too, so
 *   the arrangement and the shed are measured on ONE basket rather than two.
 * - `both-kinds` — 03-applied-and-potential: one fired card AND one near-miss, so the
 *   stacked card row is measured on a rail that actually has two cards in it.
 * - `w-line`   — 04b-no-price: a line that did not price, whose `[070]` engine message
 *   rides on the LINE. Part of the "nothing new hides" inventory: a failure must be
 *   readable at 780 without opening anything.
 */
const CAPTURES = {
  elements: capture('05-pricing-elements.json'),
  'both-kinds': capture('03-applied-and-potential-owner-supplied.json'),
  'w-line': capture('04b-no-price.json'),
}

/** The three measured work-area widths, and the arrangement each must produce. */
const WIDTHS = [
  { work: 1400, arrangement: 'beside' },
  { work: 960, arrangement: 'beside' },
  { work: 780, arrangement: 'stacked' },
]

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1672, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  let serving = 'elements'

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

  const workArea = () => page.locator('[data-sim-work-area]')
  const resultsFrame = () => page.locator('[data-work-area="results"]')
  const rail = () => page.locator('[data-promotions-rail]')

  /** Set the VIEWPORT so the WORK AREA measures `target`. The shell's chrome (nav +
   *  main padding) is calibrated by measurement rather than assumed, so this keeps
   *  working if the nav's width changes — and it converges in two passes. */
  async function setWorkArea(target) {
    for (let i = 0; i < 5; i++) {
      const w = await workArea().evaluate((el) => el.getBoundingClientRect().width)
      if (Math.abs(w - target) < 1) return w
      const vw = page.viewportSize().width
      await page.setViewportSize({ width: Math.round(vw + (target - w)), height: 1100 })
      await page.waitForTimeout(150)
    }
    return workArea().evaluate((el) => el.getBoundingClientRect().width)
  }

  const process = async () => {
    await page.getByRole('button', { name: /Process/ }).first().click()
    await page.waitForTimeout(450)
  }

  const box = (locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON())

  /** Which trace columns are on screen, in order, plus whether the trace overflows. */
  const readTrace = () =>
    page.locator('[data-trace-level]').first().evaluate((el) => ({
      level: el.getAttribute('data-trace-level'),
      columns: [...el.querySelectorAll('th[data-trace-col]')].map((th) =>
        th.getAttribute('data-trace-col'),
      ),
      // Cell count per row must track the head — a shed that dropped a `<th>` and left
      // its `<td>`s would slide every column after it under the wrong heading.
      cellsPerRow: [...new Set([...el.querySelectorAll('tbody tr')].map((r) => r.children.length))],
      overflowsX: el.scrollWidth > el.clientWidth + 1,
      width: Math.round(el.getBoundingClientRect().width),
    }))

  /** The strip as rows: the distinct top edges its four groups occupy, and whether any
   *  chip is truncated or the chip set scrolls. */
  const readStrip = () =>
    page.locator('[data-run-strip]').evaluate((el) => {
      const groups = [...el.querySelectorAll('[data-strip-group]')]
      const rows = [...new Set(groups.map((g) => Math.round(g.getBoundingClientRect().top)))]
      const chips = [...el.querySelectorAll('[data-chip]')]
      const chipSet = el.querySelector('[data-chip-set]')
      return {
        rows: rows.length,
        groups: groups.length,
        chipCount: chips.length,
        // A truncated chip renders narrower than its own content; an ellipsis or a
        // clipped key would show up here as a positive difference.
        truncated: chips.filter((c) => c.scrollWidth > c.clientWidth + 1).length,
        chipSetScrolls: chipSet ? chipSet.scrollWidth > chipSet.clientWidth + 1 : false,
        stripScrolls: el.scrollWidth > el.clientWidth + 1,
        // The status slot must never wrap away from the chips it comments on: same
        // group, therefore same wrapping unit.
        slotInHead: Boolean(
          el.querySelector('[data-strip-group="head"] [data-status-slot], [data-strip-group="head"]'),
        ),
      }
    })

  /**
   * What the screen is SHOWING, as a set — the inventory "nothing new hides" is
   * checked against. Deliberately excludes the elements trace's columns: the shed is
   * the ONE thing this ticket rules hideable by width, and folding it into this sweep
   * would make the sweep contradict the rule it sits beside.
   */
  const inventory = () =>
    page.evaluate(() => ({
      chips: [...document.querySelectorAll('[data-chip]')].map((c) =>
        c.innerText.replace(/\s+/g, ' ').trim(),
      ),
      itemRows: document.querySelectorAll('[data-items-entry] tbody tr, table tbody tr').length > 0,
      resultLines: [...document.querySelectorAll('[data-result-line]')].map((r) =>
        r.innerText.replace(/\s+/g, ' ').trim(),
      ),
      railState: document.querySelector('[data-promotions-rail]')?.getAttribute('data-promotions-rail') ?? null,
      railText: document.querySelector('[data-promotions-rail]')?.innerText.replace(/\s+/g, ' ').trim() ?? '',
      cards: document.querySelectorAll('[data-promo-card]').length,
      missedSection: Boolean(document.querySelector('[data-promo-missed-section]')),
    }))

  /** 115's density claims, re-measured wherever the widths are already set up. Scoped
   *  to `[data-result-line]` — a bare `tbody tr` would also collect the elements
   *  trace's own rows, which live INSIDE this frame in an open expansion. */
  const density = () =>
    resultsFrame().evaluate((el) => {
      const rows = [...el.querySelectorAll('[data-result-line]')]
      return {
        lines: rows.length,
        heights: [...new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height)))],
        scrollBox: el.scrollHeight > el.clientHeight + 1,
        // Every line visible at once: the last row's bottom is inside the frame.
        allVisible: rows.every(
          (r) => r.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 1,
        ),
      }
    })

  await page.goto(`${BASE}/pricing/simulation`)
  await page.locator('[data-run-strip]').waitFor()
  await page.waitForTimeout(250)

  // A basket that prices two lines with a trace and fires one promotion.
  await page.locator('table').first().locator('tbody input').first().fill('107255')
  await page.locator('table').first().locator('tbody input').nth(1).fill('1')
  await page.locator('label').filter({ hasText: /Pricing elements/i }).first().click().catch(() => {})
  await process()
  await rail().waitFor()

  // ===================================================== 1 · the arrangement, by width
  const seen = {}
  for (const { work, arrangement } of WIDTHS) {
    const measured = await setWorkArea(work)
    await page.waitForTimeout(200)
    check(
      `the work area really measures ${work} px — the drive is testing the container, not the window`,
      Math.abs(measured - work) < 2,
      `${Math.round(measured)} px of work area at a ${page.viewportSize().width} px window`,
    )

    const r = await box(resultsFrame())
    const p = await box(rail())
    const beside = p.left > r.right - 4 && Math.abs(p.top - r.top) < 4
    const stackedAbove = p.bottom <= r.top + 4

    if (arrangement === 'beside') {
      check(
        `at ${work} px the rail sits BESIDE the results — above the 900 px breakpoint`,
        beside,
        `results ${Math.round(r.left)}–${Math.round(r.right)} @${Math.round(r.top)} · rail ${Math.round(p.left)}–${Math.round(p.right)} @${Math.round(p.top)}`,
      )
      const span = p.right - r.left
      check(
        `and at 66/34 — the results take two thirds of the split`,
        Math.abs((r.width / span) * 100 - 66) <= 2.5,
        `${((r.width / span) * 100).toFixed(1)}%`,
      )
    } else {
      check(
        `at ${work} px the layout STACKS and the rail goes ABOVE the results — the verdict never sits under the evidence it explains`,
        stackedAbove,
        `rail bottom ${Math.round(p.bottom)} · results top ${Math.round(r.top)}`,
      )
      check(
        'the frame ORDER changed with width — Items → Promotions → Results, not Items → Results | Promotions',
        !beside && Math.abs(p.left - r.left) < 4 && Math.abs(p.width - r.width) < 4,
        `rail ${Math.round(p.left)}–${Math.round(p.right)} · results ${Math.round(r.left)}–${Math.round(r.right)}`,
      )
    }

    // --------------------------------------------------------- 6 · 115's density, here
    // Measured BEFORE anything is opened: "34 px at rest" is a claim about the resting
    // line, and the Results frame's resting height depends only on how many lines were
    // priced.
    const d = await density()
    check(
      `at ${work} px the lines are 34 px at rest, every one visible, in a frame with no scroll box`,
      d.lines > 0 && d.heights.length === 1 && d.heights[0] === 34 && d.allVisible && !d.scrollBox,
      `${d.lines} line(s) at ${d.heights.join('/')} px · scrollBox=${d.scrollBox}`,
    )

    // ------------------------------------------------ 3 · the trace's shed, per width
    await page.locator('[data-result-line]').first().click()
    await page.waitForTimeout(200)
    const trace = await readTrace()
    check(
      `at ${work} px the trace fits its column WITHOUT scrolling sideways — it sheds, never scrolls`,
      !trace.overflowsX,
      `${trace.width} px wide · level ${trace.level} · ${trace.columns.length} columns`,
    )
    check(
      `at ${work} px every FIGURE is still on the trace — narrowing never removes a number`,
      ['base', 'rate', 'value'].every((c) => trace.columns.includes(c)),
      trace.columns.join(' '),
    )
    check(
      // The order, stated as the only illegal state: `unit` gone while `ctr` is still
      // standing. Either both are there, or only `ctr` went, or both went.
      `at ${work} px the shed respects its order — unit never goes before ctr`,
      trace.columns.includes('unit') || !trace.columns.includes('ctr'),
      `ctr ${trace.columns.includes('ctr') ? 'kept' : 'shed'} · unit ${trace.columns.includes('unit') ? 'kept' : 'shed'}`,
    )
    check(
      `at ${work} px the head and the cells shed TOGETHER — no column slides under the wrong heading`,
      trace.cellsPerRow.length === 1 && trace.cellsPerRow[0] === trace.columns.length,
      `${trace.columns.length} heads · ${trace.cellsPerRow.join('/')} cells`,
    )

    // ------------------------------------------------------- 4 · the strip's two rows
    const strip = await readStrip()
    check(
      `at ${work} px the strip stays within two rows — its four groups wrap as units`,
      strip.rows <= 2 && strip.groups === 2,
      `${strip.rows} row(s) across ${strip.groups} groups`,
    )
    check(
      `at ${work} px no chip is truncated and the chip set does not scroll`,
      strip.truncated === 0 && !strip.chipSetScrolls && !strip.stripScrolls,
      `${strip.chipCount} chips · ${strip.truncated} truncated`,
    )

    seen[work] = { trace, inventory: await inventory() }
    await page.locator('[data-result-line]').first().click()
    await page.waitForTimeout(150)
  }

  check(
    'the trace sheds as the column narrows — full at 1400, and BOTH identifiers gone at 960 where the 66% column is tightest',
    seen[1400].trace.columns.length === 11 &&
      !seen[960].trace.columns.includes('ctr') &&
      !seen[960].trace.columns.includes('unit'),
    `1400 → ${seen[1400].trace.level} (${seen[1400].trace.columns.length}) · 960 → ${seen[960].trace.level} (${seen[960].trace.columns.length}) · 780 → ${seen[780].trace.level} (${seen[780].trace.columns.length})`,
  )
  check(
    'and the trace answers to ITS OWN column, not the window: stacked at 780 it is WIDER than inside the 66% column at 960, and keeps more',
    seen[780].trace.width > seen[960].trace.width &&
      seen[780].trace.columns.length >= seen[960].trace.columns.length,
    `780 → ${seen[780].trace.width} px / ${seen[780].trace.columns.length} cols · 960 → ${seen[960].trace.width} px / ${seen[960].trace.columns.length} cols`,
  )

  // ============================================== 5 · nothing new hides at any width
  const wide = seen[1400].inventory
  const narrow = seen[780].inventory
  check(
    'every chip visible at 1400 is still visible at 780 — the strip hides nothing by narrowing',
    wide.chips.every((c) => narrow.chips.includes(c)) && narrow.chips.length === wide.chips.length,
    `${wide.chips.length} → ${narrow.chips.length}`,
  )
  check(
    'every result line visible at 1400 is still visible at 780',
    wide.resultLines.length > 0 && narrow.resultLines.length === wide.resultLines.length,
    `${wide.resultLines.length} → ${narrow.resultLines.length}`,
  )
  check(
    'the rail says the same thing at 780 as at 1400 — fires AND near-misses, unfolded',
    narrow.railState === wide.railState && narrow.cards === wide.cards,
    `${wide.railState}/${wide.cards} card(s) → ${narrow.railState}/${narrow.cards}`,
  )

  // ========================================= 2 · stacked, the rail is a CARD ROW
  serving = 'both-kinds'
  await setWorkArea(780)
  await process()
  await rail().waitFor()
  const railBox = await box(rail())
  const cards = await page.locator('[data-promo-card]').evaluateAll((els) =>
    els.map((e) => {
      const b = e.getBoundingClientRect()
      return { kind: e.getAttribute('data-promo-card'), width: Math.round(b.width), top: Math.round(b.top) }
    }),
  )
  check(
    'stacked, a fired promotion is one CARD-SIZED card — not a stripe across the work area',
    cards.length === 2 && cards.every((c) => c.width <= 341 && c.width >= 258),
    `rail ${Math.round(railBox.width)} px wide · cards ${cards.map((c) => `${c.kind} ${c.width}`).join(', ')}`,
  )
  check(
    'and the rail frame itself IS full width — it is the cards inside it that are bounded, not the frame',
    railBox.width > 700,
    `${Math.round(railBox.width)} px`,
  )
  check(
    'a near-miss still reads BELOW the fires when stacked — what happened before what did not',
    cards[0].kind === 'fired' && cards[1].kind === 'missed' && cards[1].top > cards[0].top,
    cards.map((c) => `${c.kind}@${c.top}`).join(' → '),
  )

  // Beside, the SAME rule gives one card per row filling the 34% column — the card row
  // is scoped to the rail's own width, so the wide arrangement keeps no dead space.
  await setWorkArea(1400)
  await page.waitForTimeout(200)
  const besideRail = await box(rail())
  const besideCards = await page.locator('[data-promo-card]').evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().width)),
  )
  check(
    'beside, a card FILLS the 34% column — the card row is the stacked arrangement, and the wide one keeps no dead space',
    besideCards.length === 2 && besideCards.every((w) => w > besideRail.width - 30),
    `rail ${Math.round(besideRail.width)} px · cards ${besideCards.join(', ')}`,
  )

  // ======================== 5b · a W line's message is on the LINE at every width
  serving = 'w-line'
  await process()
  await setWorkArea(1400)
  const wideW = (await resultsFrame().innerText()).replace(/\s+/g, ' ')
  await setWorkArea(780)
  await page.waitForTimeout(200)
  const narrowW = (await resultsFrame().innerText()).replace(/\s+/g, ' ')
  check(
    "a W line's engine message rides the LINE at 780 exactly as at 1400 — a failure is never something you go looking for",
    /not priced/i.test(narrowW) && narrowW.length >= wideW.length - 2,
    `${narrowW.slice(0, 120)}…`,
  )

  // ================================= 7 · the floor: below 780 the shell scrolls
  await page.setViewportSize({ width: 700, height: 1100 })
  await page.waitForTimeout(250)
  const floor = await workArea().evaluate((el) => ({
    width: Math.round(el.getBoundingClientRect().width),
    docScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }))
  const floorBoxes = { r: await box(resultsFrame()), p: await box(rail()) }
  check(
    'below the floor the work area HOLDS 780 and the shell scrolls horizontally — no further arrangement exists',
    floor.width >= 780 && floor.docScrollsX,
    `${floor.width} px work area in a 700 px window · scrolls=${floor.docScrollsX}`,
  )
  check(
    'and the arrangement is unchanged from 780 — no phone layout, ever',
    floorBoxes.p.bottom <= floorBoxes.r.top + 4,
    `rail bottom ${Math.round(floorBoxes.p.bottom)} · results top ${Math.round(floorBoxes.r.top)}`,
  )

  check('no page errors while driving the responsive arrangement', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
