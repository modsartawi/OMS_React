// Density-and-disclosure drive (ticket 116, spec 110) — drives the REAL app in
// Chromium and serves captured `Pricing/Simulate` responses from
// `.issues/assets/098-simulate-payloads/` as the wire, exactly as
// `tools/sim-strip-drive.mjs` and `tools/sim-states-drive.mjs` do. The app is not
// stubbed, only the wire.
//
// Density and disclosure are ONE concern — a line's resting height and what happens
// when it opens are the same measurement — so this drive carries both, including the
// three claims ticket 115 made that have no pure surface (34 px rows, no scroll box,
// every captured line visible at once).
//
// Its own file and its own port (5200) rather than an extension of 113's or 120's, so
// it runs in the same wave as ticket 117 without contending for either.
//
// Asserts the ticket's Done-when:
//   1. every line of every captured basket is visible at once, 34 px at rest, in a
//      frame with no scroll box — and NOTHING is open until it is clicked;
//   2. a line's twisty expands its rules IN PLACE inside the Results frame, never
//      wider than it, several lines open at once, and a re-run closes them all;
//   3. the money foot foots: `net + tax = net total`, against the payload's own figures;
//   4. a condition card shows rate and base without a second click, and a statistical
//      condition carries the neutral uppercase STAT key with no hue;
//   5. the elements trace is a sibling that appears only when the run carried trace
//      rows — as a plain table, and NO AG Grid remains anywhere in the feature;
//   6. a `W` line's engine message rides the LINE, never the expansion.
//
//   1. run the app:  npx vite --port 5200
//   2. node tools/sim-density-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5200}`
const ASSETS = '.issues/assets/098-simulate-payloads/'

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

const capture = (file) => JSON.parse(readFileSync(ASSETS + file, 'utf8')).response.data

/** The three captures this drive reads, plus one stated deviation from the corpus. */
const PAYLOADS = {
  // 3 lines, no discount, no trace rows — the density case.
  plain: capture('01-plain-multiline.json'),
  // 2 lines, 7 pricing-element rows each — the elements-trace case.
  elements: capture('05-pricing-elements.json'),
  // 2 lines, one of them `W` with a `[070]` message — the message-on-the-line case.
  noPrice: capture('04b-no-price.json'),
}

/**
 * ZERO statistical rows appear on any of the eleven captures — recorded on ticket 111
 * and restated on 116, which is why the toggle that reported them never rendered. The
 * `isStatistics` flag is still load-bearing, so the STAT key is driven against a stated
 * deviation from the corpus rather than a fabricated payload: one real capture, one
 * flag flipped on its first condition row.
 */
const STATISTICAL = (() => {
  const base = capture('02-fired-bonus-buy.json')
  const items = base.items.map((item, i) =>
    i === 0
      ? { ...item, conditions: item.conditions.map((c, j) => (j === 0 ? { ...c, isStatistics: true } : c)) }
      : item,
  )
  return { ...base, items }
})()

/** `netValue + taxValue = netTotal` on the payload itself — the arithmetic the foot prints. */
const money = (n) => Number(String(n).replace(/,/g, ''))

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  let served = PAYLOADS.plain

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'Pricing/CacheAccess') return route.fulfill(envelope({ canClear: true }))
    if (p === 'Pricing/Simulate') return route.fulfill(envelope(served))
    return route.fulfill(envelope({}))
  })

  const resultsFrame = () => page.locator('[data-work-area="results"]')
  const lines = () => page.locator('[data-result-line]')
  const line = (n) => page.locator(`[data-result-line="${n}"]`)
  const expansion = (n) => page.locator(`[data-line-expansion="${n}"]`)

  /** Process the basket currently typed in, with the payload `served` names. */
  async function process() {
    await page.getByRole('button', { name: /Process/ }).first().click()
    await page.waitForTimeout(400)
  }

  /** The Results frame as measurement: its box, its scroll, its rows. */
  const readFrame = () =>
    resultsFrame().evaluate((el) => {
      const box = el.getBoundingClientRect()
      const rows = [...el.querySelectorAll('[data-result-line]')]
      return {
        width: Math.round(box.width),
        top: Math.round(box.top),
        height: Math.round(box.height),
        // A scroll box is the shape the rework retired: the frame is as tall as its
        // content, so scrollHeight never exceeds clientHeight and nothing clips.
        scrolls: el.scrollHeight > el.clientHeight + 1,
        maxHeight: getComputedStyle(el).maxHeight,
        rowHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
        // Every line visible at once: the last row's bottom is inside the frame.
        allInside:
          rows.length > 0 &&
          rows[rows.length - 1].getBoundingClientRect().bottom <= box.bottom + 1,
        // The whole page, not just this frame — the feature must end with zero grids.
        grids: document.querySelectorAll('.ag-root-wrapper, .ag-root').length,
      }
    })

  await page.goto(`${BASE}/pricing/simulation`)
  await page.locator('[data-run-strip]').waitFor()
  await page.waitForTimeout(250)

  // ============================================ 1 · density, and nothing auto-opens
  await page.locator('table').first().locator('tbody input').first().fill('107255')
  await process()
  await resultsFrame().waitFor()

  let frame = await readFrame()
  check(
    'every line of the captured basket is on screen at once',
    (await lines().count()) === PAYLOADS.plain.items.length && frame.allInside,
    `${await lines().count()} of ${PAYLOADS.plain.items.length} · allInside=${frame.allInside}`,
  )
  check(
    'each line rests at 34 px — two text rows, no more',
    frame.rowHeights.every((h) => h === 34),
    frame.rowHeights.join(' / '),
  )
  check(
    'the Results frame has no scroll box and no max-height — it is as tall as its content',
    !frame.scrolls && frame.maxHeight === 'none',
    `scrolls=${frame.scrolls} max-height=${frame.maxHeight}`,
  )
  check(
    'NOTHING is open on arrival — the resting height depends only on line count',
    (await page.locator('[data-line-expansion]').count()) === 0 &&
      (await page.locator('[data-line-twisty="open"]').count()) === 0,
    `${await page.locator('[data-line-expansion]').count()} expansion(s)`,
  )
  const restingHeight = frame.height

  // ==================================================== 2 · expanding, in place
  const firstItem = PAYLOADS.plain.items[0].itemNumber
  const secondItem = PAYLOADS.plain.items[1].itemNumber
  await line(firstItem).click()
  await page.waitForTimeout(150)

  check(
    'clicking a line opens its expansion in place, and marks the line open',
    (await expansion(firstItem).isVisible()) &&
      (await line(firstItem).getAttribute('aria-expanded')) === 'true',
    `aria-expanded=${await line(firstItem).getAttribute('aria-expanded')}`,
  )
  let after = await readFrame()
  check(
    'the frame grew DOWNWARD — it did not move, and it did not get wider',
    after.width === frame.width && after.top === frame.top && after.height > restingHeight,
    `${frame.width}×${restingHeight} → ${after.width}×${after.height} (top ${frame.top}→${after.top})`,
  )
  const expansionBox = await expansion(firstItem).evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width) }
  })
  const frameBox = await resultsFrame().evaluate((el) => {
    const b = el.getBoundingClientRect()
    return { left: Math.round(b.left), right: Math.round(b.right) }
  })
  check(
    'the expansion is NEVER wider than the frame it opened inside',
    expansionBox.left >= frameBox.left && expansionBox.right <= frameBox.right,
    `expansion ${expansionBox.left}–${expansionBox.right} within frame ${frameBox.left}–${frameBox.right}`,
  )
  check(
    'the lines around it are still lines — the expansion did not cover them',
    (await lines().count()) === PAYLOADS.plain.items.length &&
      (await line(secondItem).isVisible()),
  )

  await line(secondItem).click()
  await page.waitForTimeout(150)
  check(
    'ANY NUMBER open at once — two lines\' rules read side by side',
    (await page.locator('[data-line-expansion]').count()) === 2 &&
      (await expansion(firstItem).isVisible()) &&
      (await expansion(secondItem).isVisible()),
    `${await page.locator('[data-line-expansion]').count()} open`,
  )
  await line(firstItem).click()
  await page.waitForTimeout(150)
  check(
    'closing one leaves the other open, and closed contributes nothing',
    (await page.locator('[data-line-expansion]').count()) === 1 &&
      (await expansion(secondItem).isVisible()),
    `${await page.locator('[data-line-expansion]').count()} open`,
  )
  await line(secondItem).click()
  await page.waitForTimeout(150)
  check(
    'with all of them shut the frame is back to its resting height exactly',
    (await readFrame()).height === restingHeight,
    `${(await readFrame()).height} vs ${restingHeight}`,
  )

  // A re-run must close everything: `conditionKey` is not stable across runs, so a
  // surviving expansion would show the previous run's conditions on the new lines.
  await line(firstItem).click()
  await page.waitForTimeout(100)
  await process()
  check(
    'a re-run closes every expansion and opens none of its own',
    (await page.locator('[data-line-expansion]').count()) === 0,
    `${await page.locator('[data-line-expansion]').count()} open after re-run`,
  )

  // ======================================================== 3 · the money foot foots
  for (const [name, payload] of [
    ['plain', PAYLOADS.plain],
    ['elements', PAYLOADS.elements],
  ]) {
    served = payload
    await process()
    for (const item of payload.items) {
      await line(item.itemNumber).click()
      await page.waitForTimeout(120)
      const foot = await expansion(item.itemNumber)
        .locator('[data-money-foot]')
        .innerText()
      const figures = foot.match(/-?[\d,]+\.\d{2}/g)?.map(money) ?? []
      const [net, tax, total] = figures
      check(
        `[${name} · line ${item.itemNumber}] the money foot proves net + tax = net total`,
        figures.length === 3 &&
          Math.abs(net + tax - total) < 0.005 &&
          Math.abs(net - item.netValue) < 0.005 &&
          Math.abs(tax - item.taxValue) < 0.005 &&
          Math.abs(total - item.netTotal) < 0.005,
        `${foot.replace(/\s+/g, ' ').trim()} · wire ${item.netValue}+${item.taxValue}=${item.netTotal}`,
      )
      await line(item.itemNumber).click()
      await page.waitForTimeout(80)
    }
  }

  // ========================= 4 · the rules: rate and base at rest, and the STAT key
  served = STATISTICAL
  await process()
  const statLine = STATISTICAL.items[0].itemNumber
  await line(statLine).click()
  await page.waitForTimeout(150)

  const cards = expansion(statLine).locator('[data-condition-card]')
  check(
    'the aggregator is the sole producer of the rule list — one card per group',
    (await cards.count()) > 0,
    `${await cards.count()} card(s)`,
  )
  check(
    'EVERY card shows its rate and base at rest — no second click, and no card expands',
    (await expansion(statLine).locator('[data-rate-base]').count()) === (await cards.count()) &&
      (await cards.first().locator('[data-rate-base]').innerText()).includes('Rate:') &&
      (await cards.first().locator('[data-rate-base]').innerText()).includes('Base:') &&
      (await cards.locator('button').count()) === 0,
    (await cards.first().locator('[data-rate-base]').innerText()).replace(/\s+/g, ' ').trim(),
  )

  const statCards = expansion(statLine).locator('[data-statistical="yes"]')
  check(
    'a statistical condition is LISTED rather than hidden — the toggle is gone, not the row',
    (await statCards.count()) === 1 && (await statCards.first().isVisible()),
    `${await statCards.count()} statistical card(s)`,
  )
  const stat = statCards.first().locator('[data-stat-key]')
  check(
    'and it carries the neutral uppercase STAT key',
    (await stat.count()) === 1 && (await stat.innerText()).trim() === 'STAT',
    (await stat.innerText()).trim(),
  )
  const statHue = await stat.evaluate((el) => {
    const s = getComputedStyle(el)
    const sibling = el.closest('[data-condition-card]')
    return {
      bg: s.backgroundColor,
      fg: s.color,
      cardBg: getComputedStyle(sibling).backgroundColor,
    }
  })
  const neutralGround = await expansion(statLine)
    .locator('[data-statistical="no"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  check(
    'no hue on it — the STAT key is a neutral chip and the card ground is unchanged',
    statHue.cardBg === neutralGround,
    `stat chip ${statHue.bg} / ${statHue.fg} · card ${statHue.cardBg} vs plain ${neutralGround}`,
  )
  check(
    'no AG Grid remains anywhere in the feature',
    (await readFrame()).grids === 0,
    `${(await readFrame()).grids} grid(s)`,
  )

  // ================================= 5 · the elements trace, a sibling and opt-in
  served = PAYLOADS.plain
  await process()
  await line(firstItem).click()
  await page.waitForTimeout(150)
  check(
    'a run that carried no trace rows shows NO elements section at all',
    (await expansion(firstItem).locator('[data-elements-trace]').count()) === 0,
  )

  served = PAYLOADS.elements
  await process()
  const traceLine = PAYLOADS.elements.items[0].itemNumber
  await line(traceLine).click()
  await page.waitForTimeout(150)
  const trace = expansion(traceLine).locator('[data-elements-trace]')
  check(
    'a run that requested pricing elements shows the trace, as a PLAIN table',
    (await trace.count()) === 1 && (await trace.locator('table').count()) === 1,
  )
  check(
    'with one row per trace row and its eleven column labels',
    (await trace.locator('tbody tr').count()) ===
      PAYLOADS.elements.items[0].pricingElements.length &&
      (await trace.locator('thead th').count()) === 11,
    `${await trace.locator('tbody tr').count()} row(s) · ${await trace.locator('thead th').count()} column(s)`,
  )
  check(
    'the trace is a SIBLING of the rules, not nested inside a card',
    (await trace.locator('[data-condition-card]').count()) === 0 &&
      (await expansion(traceLine).locator('[data-condition-card]').count()) > 0,
  )
  check(
    'and the trace did not widen the frame either',
    (await readFrame()).width === frame.width,
    `${(await readFrame()).width} vs ${frame.width}`,
  )
  check(
    'with NO nested scroll region inside the disclosure, in either axis (spec 110 §66)',
    await expansion(traceLine).evaluate((el) =>
      [el, ...el.querySelectorAll('*')].every(
        (n) => n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1,
      ),
    ),
  )

  // ============================== 6 · a W line's message rides the LINE, not the expansion
  served = PAYLOADS.noPrice
  await process()
  const wItem = PAYLOADS.noPrice.items.find((i) => (i.pricingStatus ?? '').trim() !== '')
  const wMessage = wItem.pricingStatusMessages[0]
  check(
    "the W line's engine message is on the LINE, closed",
    (await line(wItem.itemNumber).innerText()).includes(wMessage) &&
      (await page.locator('[data-line-expansion]').count()) === 0,
    (await line(wItem.itemNumber).innerText()).replace(/\s+/g, ' ').trim(),
  )
  await line(wItem.itemNumber).click()
  await page.waitForTimeout(150)
  const wExpansion = await expansion(wItem.itemNumber).innerText()
  check(
    'and opening it does NOT print the message a second time',
    !wExpansion.includes(wMessage) && !wExpansion.includes('Pricing messages'),
    wExpansion.replace(/\s+/g, ' ').trim().slice(0, 160),
  )
  check(
    'nor a money foot footing the five zeros the wire sent — there is no arithmetic to check',
    (await expansion(wItem.itemNumber).locator('[data-money-foot]').count()) === 0 &&
      !/0\.00/.test(wExpansion.split('Applied pricing rules')[0]),
    wExpansion.replace(/\s+/g, ' ').trim().slice(0, 120),
  )

  check('no page errors while driving density and disclosure', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
