// Non-result-states drive (ticket 120, spec 110) — drives the REAL app in
// Chromium and serves captured `Pricing/Simulate` responses from
// `.issues/assets/098-simulate-payloads/` as the wire, exactly as
// `tools/sim-strip-drive.mjs` does. The app is not stubbed, only the wire.
//
// Its own file and its own port (5204) rather than an extension of 113's, so it
// runs in the same wave as 114 without contending for either.
//
// Asserts the ticket's Done-when:
//   1. before the first Process the screen is the open form, the Items frame and
//      ONE line of quiet text — one frame, one heading, no skeleton, no dashed
//      empty box, no sample basket, and the three test levers already reachable;
//   2. the manual-conditions disclosure lives INSIDE the Items frame, opens itself
//      the moment a row exists, carries a count on its label, and offers no way to
//      shut itself while rows are there;
//   3. a whole-run 400 REPLACES the work area — the previous run's results are
//      gone, Items has not moved a pixel, the money is absent rather than zeroed —
//      and the banner carries the route: an item fault points at Items, a
//      determination fault opens the form ONLY on click.
//
//   1. run the app:  npx vite --port 5204
//   2. node tools/sim-states-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
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

/**
 * The two whole-run 400s the 098 capture session actually produced.
 *
 * `item` is `04a-unknown-material` verbatim — a CODED basket fault. `determination`
 * is the code-less pricing-procedure rejection finding 5 records for a bad
 * distribution channel; `errors: []` is the point of it, since the route is read
 * off the code and this envelope has none.
 */
const rejection = (kind) => {
  const body =
    kind === 'item'
      ? {
          message: "UoM 'EA' is not valid for material '32423333'.",
          errors: [
            {
              errorCode: 'INVALID_UOM',
              internalErrorCode: null,
              errorMessage: "UoM 'EA' is not valid for material '32423333'.",
            },
          ],
        }
      : {
          message:
            '[PRICING_ERROR] Distribution channel 99 is not defined for sales organisation 1000.',
          errors: [],
        }
  return {
    status: 400,
    contentType: 'application/json',
    body: JSON.stringify({ statusCode: 400, success: false, ...body, data: null }),
  }
}

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
      // The rejection cases below serve a 400 on purpose; their resource-load
      // console lines are the assertion, not a fault.
      !/Failed to load resource/.test(m.text()) &&
      errors.push(m.text()),
  )

  /** `null` → serve the capture; 'item' | 'determination' → serve that rejection. */
  let reject = null

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'Pricing/CacheAccess') return route.fulfill(envelope({ canClear: true }))
    if (p === 'Pricing/Simulate')
      return route.fulfill(reject ? rejection(reject) : envelope(SIMULATION))
    return route.fulfill(envelope({}))
  })

  const strip = () => page.locator('[data-run-strip]')
  const itemsFrame = () => page.locator('h2', { hasText: 'Items' }).locator('xpath=ancestor::div[1]')
  const itemsTable = () => page.locator('table').first()

  /** The screen as data: its frames, its headings, and which work area is up. */
  const readScreen = () =>
    page.locator('section').first().evaluate((root) => {
      const framed = [...root.querySelectorAll('div')].filter(
        (el) =>
          typeof el.className === 'string' &&
          /\brounded-lg\b/.test(el.className) &&
          /\bbg-card\b/.test(el.className),
      )
      return {
        stripMode: root.querySelector('[data-run-strip]')?.getAttribute('data-run-strip') ?? null,
        // Every framed card on the screen — the count the rework budgets.
        frames: framed.length,
        headings: [...root.querySelectorAll('h1, h2')].map((h) => h.innerText.trim()),
        workArea: root.querySelector('[data-work-area]')?.getAttribute('data-work-area') ?? null,
        workAreaText: root.querySelector('[data-work-area]')?.innerText.trim() ?? '',
        // A skeleton or a dashed empty box is the shape this state must NOT draw.
        dashed: [...root.querySelectorAll('*')].filter(
          (el) => typeof el.className === 'string' && /\bborder-dashed\b/.test(el.className),
        ).length,
        pulsing: root.querySelectorAll('.animate-pulse').length,
        failure: root.querySelector('[data-sim-failure]') !== null,
        faultRoute: root.querySelector('[data-fault-route]')?.getAttribute('data-fault-route') ?? null,
        money: root.querySelector('[data-run-strip]')?.innerText.includes('Net total') ?? false,
        itemRows: root.querySelectorAll('table tbody tr').length,
      }
    })

  const manual = () => page.locator('[data-manual-conditions]')
  const readManual = () =>
    manual().evaluate((el) => ({
      state: el.getAttribute('data-manual-conditions'),
      count: el.querySelector('[data-manual-count]')?.innerText.trim() ?? null,
      // A twisty at all: present only while the disclosure is empty and closable.
      toggles: el.querySelectorAll('[data-manual-toggle]').length,
      rows: el.querySelectorAll('tbody tr').length,
      // The frame it sits in — must be the Items frame, not a fourth one.
      framedUnder:
        el.closest('div.bg-card')?.querySelector('h2')?.innerText.trim() ?? '(unframed)',
    }))

  await page.goto(`${BASE}/pricing/simulation`)
  await strip().waitFor()
  await page.waitForTimeout(250)

  // ================================================== 1 · before the first Process
  let view = await readScreen()
  check(
    'before the first Process the run strip is EXPANDED as the form — there is no run to condense',
    view.stripMode === 'expanded',
    String(view.stripMode),
  )
  check(
    'the three test levers are reachable without opening anything',
    (await page.getByLabel('Procedure key').isVisible()) &&
      (await page.getByLabel('Loyalty group').isVisible()) &&
      (await page.getByLabel('Loyalty tier').isVisible()),
  )
  check(
    'and none of them chips, because none of them is set',
    (await page.locator('[data-run-strip] [data-chip]').count()) === 0,
  )
  check(
    'the screen is ONE frame and ONE heading past the title — the Items frame',
    view.frames === 1 && view.headings.join(' · ') === 'POS Simulation · Items',
    `${view.frames} frame(s) · ${view.headings.join(' · ')}`,
  )
  check(
    'with one blank item row',
    view.itemRows === 1 &&
      (await itemsTable().locator('tbody input').first().inputValue()) === '',
    `${view.itemRows} row(s)`,
  )
  check(
    'where the work area will be there is ONE line of quiet text',
    view.workArea === 'pre-run' && view.workAreaText === 'Process a basket to see results.',
    `${view.workArea} · "${view.workAreaText}"`,
  )
  check(
    'no empty frames, no dashed placeholder box, no skeleton',
    view.dashed === 0 && view.pulsing === 0 && view.workArea !== 'results',
    `dashed=${view.dashed} pulsing=${view.pulsing}`,
  )

  // ================================================ 2 · the manual-conditions fold
  let mc = await readManual()
  check(
    'manual conditions live INSIDE the Items frame — there is no fourth frame for them',
    mc.framedUnder === 'Items',
    mc.framedUnder,
  )
  check(
    'empty, the disclosure is shut and carries no count',
    mc.state === 'closed' && mc.count === null && mc.toggles === 1,
    `${mc.state} · count=${mc.count} · toggles=${mc.toggles}`,
  )

  await page.getByRole('button', { name: 'Add condition' }).click()
  await page.waitForTimeout(100)
  mc = await readManual()
  check(
    'THE DISCLOSURE OPENS ITSELF the moment a row exists — a defaulted item number can never sit silently behind a closed twisty',
    mc.state === 'open' && mc.rows === 1,
    `${mc.state} · ${mc.rows} row(s)`,
  )
  check(
    'and it carries a count on its label',
    mc.count === '1 row',
    String(mc.count),
  )
  check(
    'with no control offered to shut it again while the row is there',
    mc.toggles === 0,
    `${mc.toggles} toggle(s)`,
  )
  check(
    'the frame count is unchanged — the disclosure grew the Items frame, it did not add one',
    (await readScreen()).frames === 1,
    `${(await readScreen()).frames} frame(s)`,
  )

  await page.getByRole('button', { name: 'Add condition' }).click()
  await page.waitForTimeout(100)
  check('the count follows the rows', (await readManual()).count === '2 rows', (await readManual()).count)

  // Back to a clean basket for the run assertions.
  for (const _ of [0, 1]) {
    await page.getByRole('button', { name: 'Remove condition' }).first().click()
    await page.waitForTimeout(50)
  }
  check(
    'removing the last row shuts it again and takes the count away',
    (await readManual()).state === 'closed' && (await readManual()).count === null,
    (await readManual()).state,
  )

  // ==================================================== 3 · the whole-run failure
  await itemsTable().locator('tbody input').first().fill('107255')
  await page.getByRole('button', { name: /Process/ }).first().click()
  await page.waitForTimeout(500)
  view = await readScreen()
  check(
    'a successful run puts the results in the work area',
    view.workArea === 'results' && view.money === true,
    `${view.workArea} · money=${view.money}`,
  )
  const itemsTopOnSuccess = await itemsFrame().evaluate((el) =>
    Math.round(el.getBoundingClientRect().top),
  )

  // ---- an ITEM fault: coded, and it points at Items --------------------------
  reject = 'item'
  await page.getByRole('button', { name: /Process/ }).first().click()
  await page.waitForTimeout(500)
  view = await readScreen()
  check(
    'a whole-run 400 REPLACES the work area — the previous run\'s results are gone, not pushed below an error',
    view.failure === true && view.workArea === null,
    `failure=${view.failure} workArea=${view.workArea}`,
  )
  check(
    'and Items stays exactly where it was, so the offending line is corrected in place',
    (await itemsFrame().evaluate((el) => Math.round(el.getBoundingClientRect().top))) ===
      itemsTopOnSuccess,
    `${itemsTopOnSuccess} → ${await itemsFrame().evaluate((el) => Math.round(el.getBoundingClientRect().top))}`,
  )
  check(
    'a failed run has no total, so the money is absent rather than zeroed',
    view.money === false && !/0\.00/.test(await strip().innerText()),
    (await strip().innerText()).replace(/\s+/g, ' ').trim(),
  )
  check(
    'the strip still collapsed on this Process — a Process that fails is still a Process',
    view.stripMode === 'collapsed',
    String(view.stripMode),
  )
  check(
    'the banner carries the route, and an ITEM fault points at Items',
    view.faultRoute === 'items' &&
      /Correct the offending line in Items above/.test(await page.getByRole('alert').innerText()),
    String(view.faultRoute),
  )
  check(
    'the server\'s own sentence is on the banner, not a generic "unexpected"',
    /UoM 'EA' is not valid for material '32423333'\./.test(await page.getByRole('alert').innerText()),
    (await page.getByRole('alert').innerText()).replace(/\s+/g, ' ').trim(),
  )

  // ---- a DETERMINATION fault: code-less, and it opens the form ON CLICK ------
  reject = 'determination'
  await page.getByRole('button', { name: /Process/ }).first().click()
  await page.waitForTimeout(500)
  view = await readScreen()
  check(
    'a DETERMINATION fault points at the run settings instead',
    view.faultRoute === 'settings',
    String(view.faultRoute),
  )
  check(
    'and it does NOT open the form by itself — the analyst chooses when the screen moves',
    view.stripMode === 'collapsed',
    String(view.stripMode),
  )
  await page.locator('[data-fault-route="settings"]').click()
  await page.waitForTimeout(150)
  view = await readScreen()
  check(
    'clicking the route opens the form',
    view.stripMode === 'expanded',
    String(view.stripMode),
  )
  check(
    'the banner is still there behind it — the route explains the failure, it does not dismiss it',
    view.failure === true,
  )

  check('no page errors while driving the non-result states', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
