// The command palette, driven against the WIRED console (ticket 192).
//
//   1. npx vite --port 5199
//   2. node tools/command-palette-drive.mjs
//
// ⚠ Not to be confused with `tools/palette-drive.mjs`, which is the POS COLOUR
// palette and has nothing to do with this screen. 192's own ticket flags the
// collision; this is the file it asked for.
//
// 🚩 **The negatives are asserted as hard as the positives.** This drive is the
// only place the ticket's central promise can be proved, because it is a promise
// about what a *sequence of keys* cannot reach:
//
//   1. `Ctrl+K` opens from inside the search box AND from inside the phone field
//      — the console's resting focus is a text box twice over, which is the
//      whole reason single-letter accelerators were killed (153)
//   2. `Ctrl+K` over an open confirmation sheet does NOTHING — a palette over a
//      decision the agent has been asked to make is two truths on one screen
//   3. the rows come in one order: offers, then order verbs, then the two
//      terminal acts LAST
//   4. the offer rows are the strip's own — same count as the top bar's badge
//   5. a refused verb is a DISABLED row carrying its reason, still aimable, and
//      `Enter` on it does nothing at all
//   6. 🚩 no MISTYPED key sequence reaches *Place order*: it is never auto-aimed,
//      a query matching only a terminal aims at nothing, and the aimed row is
//      always in view. ⚠ The DELIBERATE ↓ then Enter does place the order — 153
//      ruling 3 gives submit no modal anywhere on this console, and the palette
//      row presses the button the receipt already gates on `canSubmit` — so that
//      path is asserted for what it is: exactly ONE submit, with one requestId
//   7. 🚩 *Abandon call* reaches only its `Keep`-defaulted modal — never the void
//   8. `Esc` closes the palette and the caret lands back where it was
//   9. `Ctrl+K` is advertised in the search box's placeholder
//  10. the foot carries the four keys, and there is no second cheat sheet
//  11. nothing throws
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const OUT = '.issues/assets/192-command-palette'

mkdirSync(OUT, { recursive: true })

const capture = (name) =>
  JSON.parse(
    readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'),
  )
const fixture = (name) => capture(name).response.body.data

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

let pass = 0
let fail = 0
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`)))

const browser = await chromium.launch()

/** The order the palette is asked about: a caller, two priced lines, offers. */
const ATTACHED = fixture('02-two-lines-priced')

/**
 * The near-misses with class diversity — the corpus's only ACTIONABLE card, and
 * the same file `palette-model.test.ts` asserts the offer rows against. ⚠ It is
 * `unreachable-v1_0.json`: 859 leaves every captured `offerId` blank, so the
 * three rendering classes have no live source and this fixture states them.
 */
const NEAR_MISSES = JSON.parse(
  readFileSync(
    new URL('../src/features/callcenter/console/__fixtures__/unreachable-v1_0.json', import.meta.url),
    'utf8',
  ),
).nearMissClasses.nearMisses

const SCENARIOS = {
  /**
   * The resting shape: everything live, offers on the strip.
   *
   * ⚠ `canSubmit` is DERIVED true — capture 02 carries `NO_ADDRESS` (the capture
   * environment reached the loyalty attach but not the address book), and a dead
   * *Place order* would make "no mistyped key sequence places the order" prove
   * nothing at all. The order this scenario is asked about is one the door WOULD
   * place, which is what makes the negative worth asserting.
   */
  live: {
    ...ATTACHED,
    nearMisses: NEAR_MISSES,
    capabilities: {
      ...ATTACHED.capabilities,
      canSubmit: true,
      submitBlockers: [],
      capabilityReasons: {},
    },
  },
  /**
   * ⚠ Derived — the fulfilment axis shut by a delivery-only source, which is the
   * one live phase-1 rule that shuts a capability, plus a dead submit. Both
   * `capabilityReasons` and `submitBlockers` are the SERVER's shapes.
   */
  refused: {
    ...ATTACHED,
    nearMisses: NEAR_MISSES,
    capabilities: {
      ...ATTACHED.capabilities,
      canChangeFulfilment: false,
      canSubmit: false,
      submitBlockers: ['NO_ADDRESS'],
      capabilityReasons: { canChangeFulfilment: 'DELIVERY_ONLY_SOURCE' },
    },
  },
  /** No caller: the palette's caller row must be *Attach*, and the phone field
   *  is on screen to open the palette from. */
  noCaller: {
    ...fixture('01-open-empty').state ?? fixture('01-open-empty'),
  },
}

async function open(scenario) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const pageErrors = []
  const wire = []
  const served = SCENARIOS[scenario]

  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      pageErrors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const p = request.url().split('/api/')[1].split('?')[0]
    if (request.method() === 'POST') {
      let body = null
      try {
        body = request.postDataJSON()
      } catch {
        body = null
      }
      wire.push({ path: p, body })
    }
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'a.alharbi',
          displayName: 'A. Alharbi',
          currentStoreCode: '1001',
        }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(served))
    // 🚩 Answered, but never expected: rule 7 asserts this endpoint is NEVER
    // reached by any key sequence — only by the modal's own *Abandon it*.
    if (p === 'CallCenterWeb/Abandon') return route.fulfill(envelope({ abandoned: true }))
    // ⚠ STUB — the order number a real submit answers with, so the deliberate
    // path below can be followed to its end. Every assertion about it is about
    // the REQUEST, which is this drive's own bytes either way.
    if (p === 'CallCenterWeb/Submit')
      return route.fulfill(
        envelope({
          outcome: 'submitted',
          documentNo: '4500001234',
          state: { ...served, status: 'submitted' },
        }),
      )
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })

  await page.goto(`${BASE}/callcenter`)
  await page.waitForSelector('[data-cc-chips]')
  return { context, page, pageErrors, wire }
}

const shoot = async (page, name) => {
  await page.addStyleTag({ content: '.fixed{display:none !important}' })
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

/** The key itself, pressed wherever the caret happens to be. */
const ctrlK = (page) => page.keyboard.press('Control+k')
const paletteOpen = (page) => page.locator('[data-cc-palette]').count().then((n) => n > 0)

const allErrors = []

/* ------------------------------------- 1. it opens from inside a text box -- */

console.log('\nCtrl+K from inside the boxes the agent lives in')
{
  const { context, page, pageErrors } = await open('live')

  // The search box — where the agent lives after the caller is attached.
  await page.click('#cc-item-search')
  await page.type('#cc-item-search', 'pan')
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')
  ok(await paletteOpen(page), 'Ctrl+K opens the palette from inside the SEARCH box')
  // 🚩 Chrome's omnibox key, taken. If the default were not prevented the agent
  // would be typing into the browser's address bar mid-call.
  ok(
    (await page.locator('[data-cc-palette-input]:focus').count()) === 1,
    'and the caret is in the palette, not the browser',
  )
  await shoot(page, 'open-from-search')

  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-cc-palette]', { state: 'detached' })
  ok(!(await paletteOpen(page)), 'Esc closes it')
  // 8. The whole "way home" story: the native <dialog> restores focus.
  ok(
    (await page.locator('#cc-item-search:focus').count()) === 1,
    '🚩 and the caret lands back in the box the agent was typing in',
  )
  ok(
    (await page.locator('#cc-item-search').inputValue()) === 'pan',
    'with what they had typed still there',
  )

  allErrors.push(...pageErrors)
  await context.close()
}

console.log('\nCtrl+K from the phone field — the console’s OTHER resting focus')
{
  const { context, page, pageErrors } = await open('noCaller')
  await page.click('#cc-phone')
  await page.type('#cc-phone', '0555')
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')
  ok(await paletteOpen(page), 'Ctrl+K opens the palette from inside the PHONE field')
  const rows = await page.$$eval('[data-cc-palette-row]', (els) =>
    els.map((e) => e.dataset.ccPaletteRow),
  )
  ok(rows.includes('verb:attachCaller'), 'an order with no caller offers *Attach caller*')
  ok(!rows.includes('verb:removeCaller'), 'and never both caller rows at once')
  await shoot(page, 'open-from-phone')
  allErrors.push(...pageErrors)
  await context.close()
}

/* ------------------------------ 2. inert over a confirmation sheet --------- */

console.log('\nCtrl+K over an open sheet — the negative that matters most')
{
  const { context, page, pageErrors } = await open('live')
  // Any of the console's sheets will do; the abandon confirmation is the one
  // the agent is most likely to be looking at when their hand reaches for K.
  await page.click('[data-cc-abandon]')
  await page.waitForSelector('dialog[open]')
  await ctrlK(page)
  await page.waitForTimeout(150)
  ok(!(await paletteOpen(page)), '🚩 Ctrl+K over an open confirmation sheet does NOTHING')
  ok(
    (await page.locator('dialog[open]').count()) === 1,
    'and the decision the agent was asked to make is still the only thing on screen',
  )
  await shoot(page, 'inert-over-sheet')

  await page.keyboard.press('Escape')
  await page.waitForSelector('dialog[open]', { state: 'detached' })
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')
  ok(await paletteOpen(page), 'and it opens again the moment the sheet is gone')

  // The palette itself is a <dialog>, so the key cannot re-enter over its own
  // query — which is what stops Ctrl+K becoming a toggle that discards typing.
  await page.type('[data-cc-palette-input]', 'note')
  await ctrlK(page)
  await page.waitForTimeout(100)
  ok(
    (await page.locator('[data-cc-palette-input]').inputValue()) === 'note',
    'Ctrl+K over the palette itself leaves the agent’s own query alone',
  )
  allErrors.push(...pageErrors)
  await context.close()
}

/* ---------------------------------- 3+4. the rows, in the one order -------- */

console.log('\nthe rows: offers, verbs, terminals last')
{
  const { context, page, pageErrors } = await open('live')
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')

  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-cc-palette-row]')]
    const badge = document.querySelector('[data-cc-guidance-count]')
    return {
      ids: rows.map((r) => r.dataset.ccPaletteRow),
      kinds: rows.map((r) => r.dataset.ccPaletteKind),
      offerText: rows
        .filter((r) => r.dataset.ccPaletteKind === 'offer')
        .map((r) => r.innerText),
      topCount: badge ? Number(badge.dataset.ccGuidanceCount) : 0,
      aimed: document.querySelector('[data-cc-palette-aimed]')?.dataset.ccPaletteAimed ?? null,
      foot: document.querySelector('[data-cc-palette-foot]')?.innerText ?? '',
    }
  })

  ok(
    m.kinds.indexOf('verb') > m.kinds.lastIndexOf('offer'),
    'every offer row is above every verb row',
  )
  ok(
    m.kinds.indexOf('terminal') > m.kinds.lastIndexOf('verb'),
    '🚩 and the two terminal acts are LAST',
  )
  ok(
    JSON.stringify(m.ids.slice(-2)) === JSON.stringify(['terminal:place', 'terminal:abandon']),
    'the last two rows are *Place order* and *Abandon call*, in that order',
  )
  // 4. The strip's own view model, read once — the palette and the badge count
  //    the same offers or this fails.
  ok(
    m.kinds.filter((k) => k === 'offer').length === m.topCount,
    `the palette lists exactly the offers the top bar counts (${m.topCount})`,
  )
  // 6a. Nothing auto-aims at a terminal act.
  ok(m.aimed !== null && !m.aimed.startsWith('terminal:'), '🚩 the auto-aim is never a terminal act')
  // 3. Line verbs stay out: the palette is one level deep and its object is the
  //    order, which keeps *void* aimed at a line the agent is looking at.
  ok(
    !m.ids.some((id) => /qty|uom|void/i.test(id)),
    'no line verb has a row — quantity, unit of measure and void stay in the basket',
  )
  // 10. The whole cheat sheet, and there is no other.
  ok(
    /ctrl\+k/i.test(m.foot) && /move/i.test(m.foot) && /run/i.test(m.foot) && /esc/i.test(m.foot),
    'the foot carries the four keys',
  )
  await shoot(page, 'rows')
  allErrors.push(...pageErrors)
  await context.close()
}

/* ---------------------------------- 5. a refused verb is a disabled row ---- */

console.log('\na refused verb — the console’s ONE deliberate exception')
{
  const { context, page, pageErrors } = await open('refused')
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')

  const m = await page.evaluate(() => {
    const row = document.querySelector('[data-cc-palette-row="verb:fulfilment"]')
    const place = document.querySelector('[data-cc-palette-row="terminal:place"]')
    return {
      disabled: row?.getAttribute('aria-disabled'),
      reason: document.querySelector('[data-cc-palette-reason="verb:fulfilment"]')?.innerText ?? '',
      placeDisabled: place?.getAttribute('aria-disabled'),
      placeReason:
        document.querySelector('[data-cc-palette-reason="terminal:place"]')?.innerText ?? '',
    }
  })
  ok(m.disabled === 'true', 'a verb the door would refuse is drawn DISABLED rather than withheld')
  ok(m.reason.length > 0, 'and it carries its reason')
  // 🚩 The reason is the chip row's own sentence, and never a wire code.
  ok(!/DELIVERY_ONLY_SOURCE|_/.test(m.reason), 'the reason is words, never the server’s code')
  ok(/collect/i.test(m.reason), 'and it is the SAME sentence the chip row prints')
  // *Place order*'s reason is the receipt's own blocker list, not a second one.
  ok(m.placeDisabled === 'true', 'a dead *Place order* is a disabled row')
  ok(/address/i.test(m.placeReason), 'carrying the server’s own submit blocker, worded')
  await shoot(page, 'refused-rows')

  // 5b. Still aimable, and inert. `↓` walks onto it; `Enter` does nothing.
  await page.fill('[data-cc-palette-input]', 'fulfilment')
  await page.waitForSelector('[data-cc-palette-row="verb:fulfilment"]')
  const aimed = await page.$eval(
    '[data-cc-palette-aimed]',
    (e) => e.dataset.ccPaletteAimed,
  )
  ok(aimed === 'verb:fulfilment', '🚩 a disabled row is still aimed at — it is not skipped past')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  ok(await paletteOpen(page), 'Enter on it does NOTHING — the palette stays open')
  ok(
    (await page.locator('[data-cc-fulfilment-picker]').count()) === 0,
    'and the picker the door would refuse never opens',
  )
  allErrors.push(...pageErrors)
  await context.close()
}

/* ------------------------- 6. no key sequence places an order -------------- */

console.log('\nthe terminal acts — what no sequence of keys can reach')
{
  const { context, page, pageErrors, wire } = await open('live')
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')

  // A query that matches ONLY the act that ends the call. Ruling 3's sharpest
  // case: the palette aims at nothing and Enter reaches nothing.
  await page.fill('[data-cc-palette-input]', 'abandon call')
  await page.waitForTimeout(100)
  const only = await page.$$eval('[data-cc-palette-row]', (els) =>
    els.map((e) => e.dataset.ccPaletteRow),
  )
  ok(
    only.length === 1 && only[0] === 'terminal:abandon',
    'a query can narrow to *Abandon call* alone',
  )
  ok(
    (await page.locator('[data-cc-palette-aimed]').count()) === 0,
    '🚩 and then NOTHING is aimed at — the agent must press ↓',
  )
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  ok(await paletteOpen(page), 'Enter on a query matching only a terminal does nothing at all')
  await shoot(page, 'abandon-aims-at-nothing')

  // The same for *Place order*: it never takes the auto-aim.
  await page.fill('[data-cc-palette-input]', 'place order')
  await page.waitForTimeout(100)
  ok(
    (await page.locator('[data-cc-palette-aimed]').count()) === 0,
    '🚩 *Place order* is never the auto-aimed row either',
  )
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  ok(
    wire.filter((w) => w.path === 'CallCenterWeb/Submit').length === 0,
    '🚩 no MISTYPED key sequence has placed the order',
  )

  // 🚩 The aim is kept in view. The terminals live at the bottom of a list that
  // scrolls, and an `Enter` on a row below the fold is a row the agent cannot
  // read — which on these two rows is the whole risk.
  await page.fill('[data-cc-palette-input]', '')
  await page.waitForTimeout(100)
  for (let n = 0; n < 20; n++) await page.keyboard.press('ArrowDown')
  const visible = await page.evaluate(() => {
    const el = document.querySelector('[data-cc-palette-aimed]')
    if (!el) return null
    const box = el.getBoundingClientRect()
    const list = el.parentElement.getBoundingClientRect()
    return box.top >= list.top - 1 && box.bottom <= list.bottom + 1
  })
  ok(visible === true, '🚩 the aimed row is scrolled into view, never left below the fold')
  await shoot(page, 'aim-in-view')

  // 7. Abandon, reached deliberately, still meets its Keep-defaulted modal.
  await page.fill('[data-cc-palette-input]', 'abandon')
  await page.waitForTimeout(100)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-cc-abandon-confirm], dialog[open]')
  ok(!(await paletteOpen(page)), 'a deliberate ↓ then Enter closes the palette…')
  ok((await page.locator('dialog[open]').count()) === 1, '…and opens the abandon confirmation')
  ok(
    wire.filter((w) => w.path === 'CallCenterWeb/Abandon').length === 0,
    '🚩 and NOTHING has been voided — the keyboard has no shortcut past the modal',
  )
  const buttons = await page.$$eval('dialog[open] button', (els) => els.map((e) => e.innerText))
  ok(buttons.some((b) => /keep/i.test(b)), 'the modal still offers *Keep it* beside the void')
  await shoot(page, 'abandon-modal')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // ⚠ **The deliberate path to *Place order*, asserted for what it IS.** 153
  // ruling 3 gives submit no modal anywhere on this console — the palette row
  // presses the button the receipt already gates on `canSubmit`, and the two
  // guards between a mistyped `Enter` and it are *sorted last* and *never
  // auto-aimed*, both proved above. So a deliberate ↓ then Enter DOES place the
  // order, exactly as the receipt's own button does, and this asserts that it
  // takes ONE submit and not two.
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')
  await page.fill('[data-cc-palette-input]', 'place order')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  const submits = wire.filter((w) => w.path === 'CallCenterWeb/Submit')
  ok(submits.length === 1, `a deliberate ↓ then Enter places the order, ONCE (${submits.length})`)
  ok(
    typeof submits[0]?.body?.requestId === 'string' && submits[0].body.requestId.length > 0,
    'carrying one requestId, like every other verb (law 3)',
  )
  allErrors.push(...pageErrors)
  await context.close()
}

/* --------------------------- the verbs that DO run, and the placeholder ---- */

console.log('\nthe rows that run')
{
  const { context, page, pageErrors } = await open('live')
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')
  await page.fill('[data-cc-palette-input]', 'order note')
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-cc-note-form], dialog[open]')
  ok((await page.locator('dialog[open]').count()) === 1, 'Enter on an aimed verb opens its section')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // 🚩 *Search items* is the way home for focus stranded on a chip.
  await page.click('[data-cc-chip-open="store"]')
  await page.waitForSelector('dialog[open]')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  await ctrlK(page)
  await page.waitForSelector('[data-cc-palette]')
  await page.fill('[data-cc-palette-input]', 'search items')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  ok(
    (await page.locator('#cc-item-search:focus').count()) === 1,
    '🚩 *Search items* is the way home — the caret lands in the search box',
  )

  // 9. The one key the agent has to memorise, written where the caret already is.
  const placeholder = await page.getAttribute('#cc-item-search', 'placeholder')
  ok(/ctrl\+k/i.test(placeholder ?? ''), 'Ctrl+K is advertised in the search box’s placeholder')
  await shoot(page, 'way-home')
  allErrors.push(...pageErrors)
  await context.close()
}

/* ------------------------------------------------------------ verdict ----- */

ok(allErrors.length === 0, `nothing threw (${allErrors.length})`)
if (allErrors.length) console.log(allErrors.join('\n'))

console.log('\n⚠ STUBS: the `refused` scenario’s `capabilityReasons` and shut `canChangeFulfilment`')
console.log('  are derived — `capabilityReasons` is 176’s PROPOSED field and no capture carries it.')
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
