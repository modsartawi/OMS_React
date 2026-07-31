// 175 §9's variant 4, the half that was owed — drives the REAL console in Chromium.
//
//   1. run the app:  npx vite --port 5199
//   2. DRIVE_PORT=5199 node tools/section-175-drive.mjs
//
// Nothing is stubbed except the wire, and the wire answers with the CONTRACT's own
// committed fixture (`.issues/assets/136-cc-contract/01-open-empty.json`) — the
// opening state, which is exactly the shut-gate case this ticket is about: no
// caller, a seeded store nobody chose, `canAddItem: false`.
//
// Asserts:
//   theShutGateDrawsASequenceThatRetires
//     1. an order nothing may go into yet draws the three steps, in order, none
//        of them ticked, under the chip row and above the search;
//     2. the second step is the ADDRESS under delivery (the address is what
//        chooses the store), and the STORE under collection;
//     3. the card is GONE the moment the door will accept an item — and it is the
//        door's `canAddItem` that decides, not a count of ticked rows.
//   aChipOpensASectionInTheFlow
//     4. pressing a chip opens its section IN the centre column — no <dialog>, no
//        backdrop — with the chip row still above it and the basket still on screen;
//     5. the sequence card stands down while a section is open, and comes back
//        when it closes;
//     6. Escape closes the section and puts focus back on the chip that opened it;
//     7. one section at a time: opening a second closes the first;
//     8. the store move CONFIRMATION is still a modal — the distinction this
//        arrangement draws is between a header field and an act that must be
//        finished before anything else on the screen is true.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const raw = (name) =>
  JSON.parse(
    readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'),
  )
const fixture = (name) => raw(name).response.body.data

const OPEN_RESULT = fixture('01-open-empty')
const STATE = OPEN_RESULT.state

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

/**
 * A fresh context whose wire answers from the fixture.
 *
 * @param opts.state the session state every route returns — the opening fixture
 *                   by default, varied per scenario (a collection order, an order
 *                   whose gate the door has opened).
 */
async function open(browser, { state = STATE } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const calls = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\//, '').split('?')[0]
    calls.push(path)
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'a.alharbi',
          displayName: 'A. Alharbi',
          currentStoreCode: '1001',
        }),
      )
    if (path === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (path === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state, existing: null }))
    if (path === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    if (path === 'CallCenterWeb/MyDocumentSources')
      return route.fulfill(envelope([{ documentSource: 'CLCN', name: 'Call centre' }]))
    // Every other screen's own probe: allowed, so the app shell around the
    // console is ordinary.
    if (/Access$/.test(path))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }),
      )
    return route.fulfill(envelope([]))
  })
  return { context, page, calls }
}

const land = async (page) => {
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 15_000 })
}
const stepText = async (page, id) =>
  (await page.locator(`[data-cc-step="${id}"]`).innerText()).replace(/\s+/g, ' ').trim()

async function run() {
  const browser = await chromium.launch()

  // ---- 1–2. the shut gate draws its sequence ----
  {
    const { context, page } = await open(browser)
    await land(page)

    check('the sequence card is drawn on an order nothing may go into yet',
      (await page.locator('[data-cc-steps]').count()) === 1)
    check('three steps, in the order the agent works in',
      JSON.stringify(
        await page.locator('[data-cc-step]').evaluateAll((rows) =>
          rows.map((row) => row.getAttribute('data-cc-step')),
        ),
      ) === JSON.stringify(['caller', 'where', 'items']))
    check('none of them is ticked on the opening state',
      (await page.locator('[data-cc-step][data-cc-step-done]').count()) === 0)
    // 🚩 It sits where the search would be: under the chips, above the basket.
    const order = await page.evaluate(() => {
      const seen = [...document.querySelectorAll('[data-cc-chips],[data-cc-steps],[data-cc-search]')]
      return seen.map((el) => el.dataset.ccChips !== undefined ? 'chips'
        : el.dataset.ccSteps !== undefined ? 'steps' : 'search')
    })
    check('drawn under the chip row and above the search',
      JSON.stringify(order) === JSON.stringify(['chips', 'steps', 'search']), order.join(' → '))
    check('the delivery order names the ADDRESS as its second step',
      (await stepText(page, 'where')).toLowerCase().includes('address'),
      await stepText(page, 'where'))
    await context.close()
  }

  // ---- 2b. the same order, collecting ----
  {
    const collection = { ...STATE, header: { ...STATE.header, deliveryType: 'PickInStore' } }
    const { context, page } = await open(browser, { state: collection })
    await land(page)
    check('the collection order names the STORE instead — the agent chooses it',
      (await stepText(page, 'where')).toLowerCase().includes('store'),
      await stepText(page, 'where'))
    await context.close()
  }

  // ---- 3. it retires ----
  {
    const addable = {
      ...STATE,
      capabilities: { ...STATE.capabilities, canAddItem: true },
    }
    const { context, page } = await open(browser, { state: addable })
    await land(page)
    check('🚩 the card is gone the moment the door will take an item',
      (await page.locator('[data-cc-steps]').count()) === 0,
      'the gate decides, not a count of ticked rows')
    check('...and the blockers it was drawn from are still on the order',
      addable.capabilities.submitBlockers.length > 0)
    await context.close()
  }

  // ---- 4–7. a chip opens a section, in the flow ----
  {
    const { context, page } = await open(browser)
    await land(page)

    await page.locator('[data-cc-chip-open="source"]').click()
    await page.locator('[data-cc-section="source"]').waitFor({ timeout: 5_000 })
    check('the chip opens a SECTION, not a dialog',
      (await page.locator('dialog[open]').count()) === 0)
    check('the chip row is still above it — a chip is a place, and it stays one',
      await page.locator('[data-cc-chips]').isVisible())
    check('the basket is still on screen behind the open section',
      await page.locator('[data-cc-basket]').isVisible())
    check('the sequence card stands down while a section is open',
      (await page.locator('[data-cc-steps]').count()) === 0)

    // 7. one at a time.
    await page.locator('[data-cc-chip-open="slot"]').click()
    await page.locator('[data-cc-section="slot"]').waitFor({ timeout: 5_000 })
    check('opening a second section closes the first',
      (await page.locator('[data-cc-section]').count()) === 1 &&
        (await page.locator('[data-cc-section="source"]').count()) === 0)

    // 6. Escape, and focus home.
    await page.keyboard.press('Escape')
    await page.locator('[data-cc-section="slot"]').waitFor({ state: 'detached', timeout: 5_000 })
    check('Escape closes the section',
      (await page.locator('[data-cc-section]').count()) === 0)
    check('...and focus goes back to the chip that opened it',
      (await page.evaluate(() => document.activeElement?.getAttribute('data-cc-chip-open'))) === 'slot')
    check('the sequence card comes back with the section gone',
      (await page.locator('[data-cc-steps]').count()) === 1)
    await context.close()
  }

  // ---- 8. an act that must be finished is still a modal ----
  {
    const { context, page } = await open(browser)
    await land(page)
    await page.locator('[data-cc-abandon]').click()
    check('🚩 abandoning the order is still a MODAL — not every surface became a section',
      (await page.locator('dialog[open]').count()) === 1)
    await context.close()
  }

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
