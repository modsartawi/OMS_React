// Run-strip drive (ticket 113, spec 110) — drives the REAL app in Chromium and
// serves a captured `Pricing/Simulate` payload from
// `.issues/assets/098-simulate-payloads/` as the response, exactly as
// `tools/document-actions-drive.mjs` does for the document screen. The app is not
// stubbed, only the wire.
//
// Asserts the ticket's Done-when:
//   1. the determination collapses to chips — five ordinarily, eight with the
//      three test levers, nine with the pricing-elements flag — and every chip is
//      a readout: a span, never a button, with no cursor change;
//   2. the chip set is ONE tab stop for seven fields and two checkboxes, and the
//      whole collapsed strip is four stops (chip set + the three run controls);
//   3. `Edit ▾` expands the form IN PLACE (the collapsed row is replaced, not
//      pushed), focus lands on Plant, and the money readout is REMOVED, not moved;
//   4. `Done ▴` and `Esc` both collapse, and `Esc` returns focus to the chip set
//      rather than losing it to the document;
//   5. Process collapses the strip and the money reads in it;
//   6. a Process that FAILS still collapses, and the strip never expands itself;
//   7. `Ctrl`+`Enter` processes from inside the items grid;
//   8. `▶ Process` / `Clear` / `⛁ Wipe cache` sit together as one cluster, past
//      every other control in the row.
//
// Extended by ticket 114 — the status slot's three states:
//   9. after a run the slot is ABSENT; editing any input raises `↻ Inputs changed`
//      in it plus one dashed line above the results, neutral (a chip's own ground,
//      no hue) and not a chip; the results stay readable and undimmed; Process is
//      not blocked; and the mark CLEARS when the new results arrive;
//  10. a run in flight keeps the previous results on screen, reads `Processing…`,
//      waits 150 ms for its spinner and hairline (an ordinary run shows neither),
//      puts the hairline on the strip's own bottom edge with no layout shift, and
//      DISABLES `Edit ▾` rather than hiding it.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sim-strip-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const CAPTURE = '.issues/assets/098-simulate-payloads/03-applied-and-potential-owner-supplied.json'

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

/** A pricing rejection: the 400 business envelope the engine throws (ticket 013). */
const rejection = () => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 400,
    success: false,
    message: '[PRICING_ERROR] Distribution channel 99 is not defined for sales organisation 1000.',
    errors: [],
    data: null,
  }),
})

const SIMULATION = JSON.parse(readFileSync(CAPTURE, 'utf8')).response.data

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      // The rejection case below serves a 400 on purpose; its resource-load
      // console line is the assertion, not a fault.
      !/Failed to load resource/.test(m.text()) &&
      errors.push(m.text()),
  )

  /** Every basket posted, newest last — the evidence for "a Process happened". */
  const posted = []
  /** Flipped late in the run so the SAME app meets a rejection (assertion 6). */
  let rejectNext = false
  /** A gate on the Simulate response (assertion 10): when set, the route waits on
   *  this promise, so "a run is out" is a state the drive holds open and reads
   *  rather than a race it tries to sample. */
  let release = null
  const holdNext = () => {
    let resolve
    const gate = new Promise((r) => (resolve = r))
    release = () => {
      release = null
      resolve()
    }
    return gate
  }
  let gate = null

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'Pricing/CacheAccess') return route.fulfill(envelope({ canClear: true }))
    if (p === 'Pricing/Simulate') {
      posted.push(JSON.parse(route.request().postData() || '{}'))
      if (gate) {
        const held = gate
        gate = null
        await held
      }
      return route.fulfill(rejectNext ? rejection() : envelope(SIMULATION))
    }
    return route.fulfill(envelope({}))
  })

  const strip = () => page.locator('[data-run-strip]')
  const chipSet = () => page.locator('[data-chip-set]')
  const chips = () => page.locator('[data-run-strip] [data-chip]')

  /** The strip as data: its mode, its chips, and the money it is showing. */
  const readStrip = () =>
    strip().evaluate((el) => {
      const control = el.querySelector('[data-chip-set]')
      return {
        mode: el.getAttribute('data-run-strip'),
        expanded: control?.getAttribute('aria-expanded'),
        controlLabel: control?.innerText.replace(/\s+/g, ' ').trim() ?? '',
        chips: [...el.querySelectorAll('[data-chip]')].map((c) => ({
          text: c.innerText.replace(/\s+/g, ' ').trim(),
          tag: c.tagName,
          cursor: getComputedStyle(c).cursor,
          // A chip must not be an interactive element in disguise either.
          focusable: c.matches('button, a, input, select, [tabindex]'),
        })),
        // The money readout is identified by the one thing only it renders: the
        // net-total figure beside its currency.
        money: el.innerText.includes('Net total'),
        // Every tab stop the strip offers, in DOM order.
        stops: [...el.querySelectorAll('button, a, input, select, [tabindex]')]
          .filter((n) => !n.disabled)
          .map((n) => n.innerText.replace(/\s+/g, ' ').trim() || n.tagName),
        controls: [...el.querySelectorAll('button')]
          .map((b) => ({
            label: b.innerText.replace(/\s+/g, ' ').trim(),
            right: Math.round(b.getBoundingClientRect().right),
            top: Math.round(b.getBoundingClientRect().top),
          })),
      }
    })

  /** The focused element, described the way an assertion can read it. */
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return 'BODY'
      if (el.hasAttribute('data-chip-set')) return 'CHIP-SET'
      const label = el.closest('label')?.innerText.replace(/\s+/g, ' ').trim()
      return label || el.innerText?.replace(/\s+/g, ' ').trim() || el.tagName
    })

  const itemsTable = () => page.locator('table').first()

  await page.goto(`${BASE}/pricing/simulation`)
  await strip().waitFor()
  await page.waitForTimeout(200)

  // A material up front: `▶ Process` is legitimately disabled on an empty basket,
  // and the tab-stop count below is only meaningful once the run loop is takeable.
  await itemsTable().locator('input').first().fill('107255')

  // ------------------------------------------------- 1 · the chips are readouts
  let view = await readStrip()
  check(
    'the determination reads as five chips ordinarily',
    view.chips.length === 5,
    view.chips.map((c) => c.text).join(' · '),
  )
  check(
    'and they are the four determination fields plus the promotion flag, keyed and in order',
    /^PLANT/.test(view.chips[0]?.text ?? '') &&
      /^ORG/.test(view.chips[1]?.text ?? '') &&
      /^CHAN/.test(view.chips[2]?.text ?? '') &&
      /^\d{2} \w{3} \d{4}$/.test(view.chips[3]?.text ?? '') &&
      view.chips[4]?.text === 'PROMO on',
    view.chips.map((c) => c.text).join(' · '),
  )
  check(
    'every chip is a span, never a button, and changes no cursor',
    view.chips.every((c) => c.tag === 'SPAN' && !c.focusable && c.cursor !== 'pointer'),
    view.chips.map((c) => `${c.tag}/${c.cursor}`).join(' '),
  )
  check(
    'the chip set carries one aria-expanded and ends in a visible Edit ▾ tail',
    view.expanded === 'false' && view.controlLabel.endsWith('Edit ▾'),
    `${view.expanded} · ${view.controlLabel}`,
  )

  // ----------------------------------------------------- 2 · one tab stop
  check(
    'the whole collapsed strip is four tab stops — the chip set and the three run controls',
    view.stops.length === 4,
    view.stops.join(' | '),
  )
  await page.locator('h1').first().click()
  await page.keyboard.press('Tab')
  check(
    'and Tab from the page heading lands on the chip set itself, not on a chip',
    (await focused()) === 'CHIP-SET',
    await focused(),
  )
  await page.keyboard.press('Tab')
  check(
    'so a single Tab past it reaches ▶ Process — seven fields and two checkboxes cost one stop',
    /Process/.test(await focused()),
    await focused(),
  )

  // ------------------------------------------- 3 · Edit ▾ expands in place
  const stripTopBefore = await strip().evaluate((el) => Math.round(el.getBoundingClientRect().top))
  await chipSet().click()
  await page.waitForTimeout(100)
  view = await readStrip()
  check(
    'Edit ▾ expands the form and the control now reads Done ▴',
    view.mode === 'expanded' && view.expanded === 'true' && view.controlLabel === 'Done ▴',
    `${view.mode} · ${view.controlLabel}`,
  )
  check(
    'the expansion REPLACES the collapsed row in place — the strip still starts where it started',
    (await strip().evaluate((el) => Math.round(el.getBoundingClientRect().top))) === stripTopBefore,
    `${stripTopBefore} → ${await strip().evaluate((el) => Math.round(el.getBoundingClientRect().top))}`,
  )
  check(
    'and expanding focuses the first field, Plant',
    /Plant/.test(await focused()),
    await focused(),
  )
  check(
    'the run controls come with it — Process, Clear and Wipe cache sit in the form footer',
    view.controls.filter((c) => /Process|Clear|cache/i.test(c.label)).length === 3,
    view.controls.map((c) => c.label).join(' | '),
  )

  // --------------------------------------------- 4 · Esc, and the levers
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  check(
    'Esc collapses the form and returns focus to the chip set, never to the document',
    (await readStrip()).mode === 'collapsed' && (await focused()) === 'CHIP-SET',
    `${(await readStrip()).mode} · ${await focused()}`,
  )

  await chipSet().click()
  await itemsTable().locator('input').first().click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  check(
    'and Esc collapses from ANYWHERE while the form is open, not only from inside it',
    (await readStrip()).mode === 'collapsed' && (await focused()) === 'CHIP-SET',
    `${(await readStrip()).mode} · ${await focused()}`,
  )

  await chipSet().click()
  await page.getByLabel('Procedure key').fill('W')
  await page.getByLabel('Loyalty group').fill('0001')
  await page.getByLabel('Loyalty tier').selectOption('G')
  await page.waitForTimeout(100)
  await page.locator('[data-chip-set]').click() // Done ▴
  await page.waitForTimeout(100)
  view = await readStrip()
  check(
    'the three test levers raise the strip to eight chips',
    view.chips.length === 8,
    view.chips.map((c) => c.text).join(' · '),
  )
  check(
    'Done ▴ collapses it',
    view.mode === 'collapsed',
    view.mode,
  )

  await chipSet().click()
  await page.getByLabel('Pricing Elements').check()
  await page.locator('[data-chip-set]').click()
  await page.waitForTimeout(100)
  view = await readStrip()
  check(
    'and the pricing-elements flag makes nine, chipping key-only because presence IS its state',
    view.chips.length === 9 && view.chips[8].text === 'ELEM',
    view.chips.map((c) => c.text).join(' · '),
  )

  // Back to the ordinary run for the money assertions.
  await chipSet().click()
  await page.getByLabel('Procedure key').fill('')
  await page.getByLabel('Loyalty group').fill('')
  await page.getByLabel('Loyalty tier').selectOption('')
  await page.getByLabel('Pricing Elements').uncheck()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  const afterClear = await chips().count()
  check(
    'clearing the levers takes their chips away entirely — blank is no chip, never a muted one',
    afterClear === 5,
    String(afterClear),
  )

  // ------------------------------------------------------ 5 · Process
  await page.locator('[data-chip-set]').click() // expand, so the collapse is observable
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: /Process/ }).first().click()
  await page.waitForTimeout(400)
  view = await readStrip()
  check(
    'Process collapses the strip — the determination is settled the moment it is sent',
    view.mode === 'collapsed',
    view.mode,
  )
  check(
    'and the money reads in the strip: net total, discount, tax and calc time',
    view.money && /SAR/.test(await strip().innerText()),
    (await strip().innerText()).replace(/\s+/g, ' ').trim(),
  )
  check(
    'the run controls stay one terminal cluster, past every other control in the row',
    (() => {
      const run = view.controls.filter((c) => /Process|Clear|cache/i.test(c.label))
      const other = view.controls.filter((c) => !/Process|Clear|cache/i.test(c.label))
      return (
        run.length === 3 &&
        new Set(run.map((c) => c.top)).size === 1 &&
        other.every((o) => run.every((r) => r.right > o.right))
      )
    })(),
    view.controls.map((c) => `${c.label}@${c.right}`).join(' | '),
  )

  // The money is removed, not moved, while the form is open.
  await chipSet().click()
  await page.waitForTimeout(100)
  view = await readStrip()
  check(
    'opening the form REMOVES the money readout — a total belongs to a run, not to its editor',
    view.money === false,
    view.money ? 'still showing' : 'absent',
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  check(
    'and collapsing brings it back',
    (await readStrip()).money === true,
  )

  // ------------------------------------------------ 6 · a Process that fails
  const postsBeforeFailure = posted.length
  rejectNext = true
  await chipSet().click()
  await page.waitForTimeout(100)
  await page.getByRole('button', { name: /Process/ }).first().click()
  await page.waitForTimeout(500)
  view = await readStrip()
  check(
    'a Process that FAILS collapses the strip too — a failed Process is still a Process',
    view.mode === 'collapsed' && posted.length === postsBeforeFailure + 1,
    `${view.mode}, ${posted.length - postsBeforeFailure} post(s)`,
  )
  check(
    'and the strip never expands itself: the failure banner is on screen with the form still shut',
    (await page.getByRole('alert').count()) > 0 && view.expanded === 'false',
    `alerts=${await page.getByRole('alert').count()} expanded=${view.expanded}`,
  )
  check(
    'a failed run has no total, so the money is absent rather than zeroed',
    view.money === false,
  )

  // -------------------------------------- 7 · Ctrl+Enter from the items grid
  rejectNext = false
  const postsBeforeShortcut = posted.length
  await itemsTable().locator('input').first().click()
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(500)
  check(
    'Ctrl+Enter processes from inside the items grid',
    posted.length === postsBeforeShortcut + 1,
    `${posted.length - postsBeforeShortcut} post(s)`,
  )
  check(
    'and the basket it posts is the one the chips describe',
    posted.at(-1)?.header.plant === 'P001' &&
      posted.at(-1)?.header.isPromotionApplicable === true &&
      posted.at(-1)?.items[0]?.materialNumber === '107255',
    JSON.stringify(posted.at(-1)?.header ?? {}),
  )
  check('the shortcut is signposted on the button itself', /⌃⏎/.test(await strip().innerText()))

  // ============================================ ticket 114 — the status slot
  // The slot as data: its state, its words, and the two things that make it a
  // different species from a chip (dashed border) and keep it neutral (a chip's
  // own ground, nothing chromatic).
  const readSlot = () =>
    page.locator('[data-status-slot]').evaluate((el) => {
      const style = getComputedStyle(el)
      const chip = el.parentElement?.querySelector('[data-chip]')
      return {
        state: el.getAttribute('data-status-slot'),
        text: el.innerText.replace(/\s+/g, ' ').trim(),
        borderStyle: style.borderTopStyle,
        background: style.backgroundColor,
        chipBackground: chip ? getComputedStyle(chip).backgroundColor : '',
        // A chip is a readout; the slot is not a chip, and must not be mistaken
        // for one by anything that counts them.
        isChip: el.hasAttribute('data-chip'),
        focusable: el.matches('button, a, input, select, [tabindex]'),
        spinning: !!el.querySelector('.animate-spin'),
      }
    })

  /** The results frame: how many lines it shows, and whether it is dimmed. */
  const resultsCard = () => page.locator('h2', { hasText: 'Results' }).locator('..')
  const readResults = () =>
    resultsCard().evaluate((el) => ({
      rows: el.querySelectorAll('tbody tr').length,
      opacity: getComputedStyle(el).opacity,
      note: !!el.parentElement?.querySelector('[data-stale-note]'),
    }))

  // ------------------------------------------------------- 9 · staleness
  let slot = await readSlot()
  const settled = await readResults()
  check(
    'after a run the slot is ABSENT — silence is the healthy state',
    slot.state === 'absent' && slot.text === '' && settled.note === false,
    `${slot.state} · "${slot.text}"`,
  )
  check('and the run it describes is on screen', settled.rows > 0, `${settled.rows} line(s)`)

  // Every input counts; the quantity is the one the analyst actually retypes.
  await itemsTable().locator('input').nth(1).fill('7')
  await page.waitForTimeout(150)
  slot = await readSlot()
  const staleResults = await readResults()
  check(
    'changing an input raises ↻ Inputs changed in the slot',
    slot.state === 'stale' && /Inputs changed/.test(slot.text),
    `${slot.state} · "${slot.text}"`,
  )
  check(
    'and one dashed line above the results says it where the stale numbers are',
    staleResults.note === true,
  )
  check(
    'the slot is NOT a chip — dashed where a chip is solid, unfocusable, uncounted',
    slot.isChip === false &&
      slot.focusable === false &&
      slot.borderStyle === 'dashed' &&
      (await chips().count()) === 5,
    `${slot.borderStyle} · chips=${await chips().count()}`,
  )
  check(
    'and it is neutral by force: a chip\'s own ground, no hue borrowed from the budget',
    slot.background === slot.chipBackground,
    `${slot.background} vs chip ${slot.chipBackground}`,
  )
  check(
    'the stale results stay READABLE and undimmed — comparing totals is the loop',
    staleResults.rows === settled.rows && staleResults.opacity === '1',
    `${staleResults.rows} line(s) at opacity ${staleResults.opacity}`,
  )
  // The open form is where inputs change, so the mark has to survive expanding.
  await chipSet().click()
  await page.waitForTimeout(100)
  slot = await readSlot()
  check(
    'the mark comes with the expansion — the open form is where inputs change',
    slot.state === 'stale' && (await readStrip()).mode === 'expanded',
    `${slot.state} in the ${(await readStrip()).mode} strip`,
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)
  check(
    'and it MARKS only: Process is not blocked, nothing re-ran, nothing was discarded',
    (await page.getByRole('button', { name: /Process/ }).first().isEnabled()) &&
      posted.length === postsBeforeShortcut + 1,
    `${posted.length - postsBeforeShortcut} post(s) since the last run`,
  )

  // ------------------------------------------------- 10 · a run in flight
  // A fast run first: the spinner and the hairline must NEVER appear, which is
  // watched for continuously rather than sampled once.
  const watch = page.evaluate(async () => {
    let saw = ''
    const t0 = performance.now()
    while (performance.now() - t0 < 600) {
      const slotEl = document.querySelector('[data-status-slot]')
      if (slotEl?.querySelector('.animate-spin')) saw += 'spinner '
      if (document.querySelector('[data-run-hairline]')) saw += 'hairline '
      await new Promise((r) => requestAnimationFrame(r))
    }
    return saw.trim()
  })
  await page.getByRole('button', { name: /Process/ }).first().click()
  const flashed = await watch
  check(
    'an ordinary run flashes NO spinner and no hairline — the 150 ms wait holds',
    flashed === '',
    flashed || 'neither appeared',
  )
  slot = await readSlot()
  check(
    'and the new results clear the mark: the slot is absent again',
    slot.state === 'absent' && (await readResults()).note === false,
    slot.state,
  )

  // Now a run held open, so "in flight" is a state to read rather than a race.
  // Entered FROM the stale state, so "in flight is the only thing said" is a real
  // assertion rather than a vacuous one.
  await itemsTable().locator('input').nth(1).fill('4')
  await page.waitForTimeout(150)
  const beforeHeld = await readResults()
  check(
    'the run about to go out is a stale one — the mark and the line are both up',
    (await readSlot()).state === 'stale' && beforeHeld.note === true,
  )
  gate = holdNext()
  await page.getByRole('button', { name: /Process/ }).first().click()
  await page.waitForTimeout(60)
  slot = await readSlot()
  let held = await readResults()
  const stripStops = await readStrip()
  check(
    'a run in flight reads Processing… in the slot',
    slot.state === 'processing' && /Processing/.test(slot.text),
    `${slot.state} · "${slot.text}"`,
  )
  check(
    'the previous results STAY on screen — a 184 ms round trip is not a flicker of nothing',
    held.rows === beforeHeld.rows && (await strip().innerText()).includes('Net total'),
    `${held.rows} line(s), money ${stripStops.money ? 'present' : 'absent'}`,
  )
  check(
    'under 150 ms there is still no spinner and no hairline',
    slot.spinning === false && (await page.locator('[data-run-hairline]').count()) === 0,
  )
  check(
    'and in flight is the ONLY thing said: the stale line above the results stands down',
    held.note === false,
  )
  check(
    'Edit ▾ is DISABLED rather than hidden — hiding it would reflow the strip twice per run',
    (await chipSet().count()) === 1 && (await chipSet().isDisabled()),
    `${await chipSet().count()} control(s), disabled=${await chipSet().isDisabled()}`,
  )
  check(
    'and Clear and ⛁ Wipe cache lock with it while ▶ Process reads Processing…',
    (await page.getByRole('button', { name: 'Clear', exact: true }).isDisabled()) &&
      (await page.getByRole('button', { name: /cache/i }).isDisabled()) &&
      /Processing/.test(await page.getByRole('button', { name: /Processing/ }).first().innerText()),
  )

  // Past 150 ms: the spinner and the hairline arrive, and the hairline sits on the
  // strip's own bottom edge without moving anything.
  const stripBoxBefore = await strip().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
  })
  await page.waitForTimeout(250)
  slot = await readSlot()
  const hairline = await page.locator('[data-run-hairline]').evaluate((el) => {
    const bar = el.getBoundingClientRect()
    const host = el.closest('[data-run-strip]').getBoundingClientRect()
    return {
      height: Math.round(bar.height),
      // Inside the strip's own border, not a new region below it.
      offsetFromBottom: Math.round(host.bottom - bar.bottom),
      spansTheStrip: Math.round(bar.width) === Math.round(host.width),
      animated: getComputedStyle(el.firstElementChild).animationName,
    }
  })
  const stripBoxDuring = await strip().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
  })
  check(
    'past 150 ms the spinner appears in the slot',
    slot.spinning === true,
    slot.text,
  )
  check(
    'and a hairline runs along the strip’s OWN bottom edge, animated and indeterminate',
    hairline.height <= 2 &&
      hairline.offsetFromBottom <= 1 &&
      hairline.spansTheStrip &&
      hairline.animated === 'indeterminate',
    JSON.stringify(hairline),
  )
  check(
    'it introduces no layout shift — the strip’s own box is unmoved',
    stripBoxDuring.top === stripBoxBefore.top && stripBoxDuring.bottom === stripBoxBefore.bottom,
    `${JSON.stringify(stripBoxBefore)} → ${JSON.stringify(stripBoxDuring)}`,
  )

  release()
  await page.waitForTimeout(400)
  slot = await readSlot()
  held = await readResults()
  check(
    'and when the results arrive the slot empties and the hairline goes',
    slot.state === 'absent' &&
      (await page.locator('[data-run-hairline]').count()) === 0 &&
      held.rows > 0 &&
      (await chipSet().isEnabled()),
    `${slot.state} · ${held.rows} line(s)`,
  )

  check('no page errors while driving the strip', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
