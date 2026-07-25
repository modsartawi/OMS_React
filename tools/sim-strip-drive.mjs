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

  // Ticket 120 made the PRE-RUN screen the open form — there is no run to condense
  // before the first Process. The collapsed-row assertions below are about the
  // strip's steady state, so collapse it first; 120's own drive owns the pre-run
  // state itself.
  if ((await readStrip()).mode === 'expanded') {
    await page.locator('[data-chip-set]').click()
    await page.waitForTimeout(100)
  }

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
