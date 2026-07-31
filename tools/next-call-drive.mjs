// The two ends of a call — the caret at the start, the way on at the end.
//
//   1. run the app:  npx vite --port 5199
//   2. DRIVE_PORT=5199 node tools/next-call-drive.mjs
//
// The wire answers from the contract's own committed fixtures: the opening state
// (`01-open-empty`), a priced two-line order (`02-two-lines-priced`) with the
// door's submit gate opened, and the real `Submit` response (`07`).
//
// Asserts:
//   theCaretIsInThePhoneBox
//     1. the console opens with the caret in the mobile-number box (US9);
//     2. 🚩 and it is there again on the NEXT order, which is the case an
//        `autoFocus` cannot answer — the console never unmounts between the two,
//        so the input the attribute was written on is an element that has
//        already been used up.
//   aPlacedOrderOffersTheNextOne
//     3. the order number is drawn with a live control under it — before this
//        the finished screen had none, and the only way on was a page reload;
//     4. pressing it asks nothing: a placed order is a document, there is
//        nothing to void, so no confirmation stands between the agent and the
//        next caller;
//     5. it lands on a genuinely new order — new transaction, empty basket, no
//        order number left over from the last call;
//     6. and an order still OPEN offers no such control: the way out of a live
//        basket is *abandon*, which asks first.
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

const EMPTY = fixture('01-open-empty').state
const PRICED = fixture('02-two-lines-priced').state ?? fixture('02-two-lines-priced')
const SUBMITTED = raw('07-submit-already-submitted').submitted.response.body.data

/** The same order with the door's submit gate open — the fixture is captured a
 *  slot and an address short, and this drive is not about the blockers. */
const READY = {
  ...PRICED,
  capabilities: { ...PRICED.capabilities, canSubmit: true, submitBlockers: [] },
}
/** What the server sends back once the document exists: the transaction is closed
 *  and every verb stands down on `status`. */
const CLOSED = {
  ...READY,
  status: 'submitted',
  capabilities: { ...READY.capabilities, canSubmit: false, canAddItem: false },
}
/** The next call's order — a different transaction, nobody on it. */
const NEXT = { ...EMPTY, transactionId: 'NEXT-CALL-0001' }

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
 * A fresh context whose wire answers from the fixtures.
 *
 * `states` is the queue `Open` walks: the first call gets the first entry, the
 * second call the second — which is how *place, then take the next call* is
 * driven without the console ever being reloaded. `State` answers whatever the
 * last open (or the last submit) made current.
 */
async function open(browser, { states = [EMPTY] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  let opened = 0
  let current = states[0]
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\//, '').split('?')[0]
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
    if (path === 'CallCenterWeb/Open') {
      current = states[Math.min(opened, states.length - 1)]
      opened += 1
      return route.fulfill(envelope({ outcome: 'opened', state: current, existing: null }))
    }
    if (path === 'CallCenterWeb/State') return route.fulfill(envelope(current))
    if (path === 'CallCenterWeb/Submit') {
      current = CLOSED
      return route.fulfill(envelope({ ...SUBMITTED, state: CLOSED }))
    }
    if (path === 'CallCenterWeb/MyDocumentSources')
      return route.fulfill(envelope([{ documentSource: 'CLCN', name: 'Call centre' }]))
    if (/Access$/.test(path))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }),
      )
    return route.fulfill(envelope([]))
  })
  return { context, page, opens: () => opened }
}

const land = async (page) => {
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 15_000 })
}
const focused = (page) => page.evaluate(() => document.activeElement?.id ?? '')

async function run() {
  const browser = await chromium.launch()

  // ---- 1. the caret, on the first call ----
  {
    const { context, page } = await open(browser)
    await land(page)
    await page.locator('#cc-phone').waitFor({ timeout: 5_000 })
    check('the console opens with the caret in the mobile box', (await focused(page)) === 'cc-phone')
    await context.close()
  }

  // ---- 2–5. place, then take the next call ----
  {
    const { context, page, opens } = await open(browser, { states: [READY, NEXT] })
    await land(page)

    check('an order still open offers no *next order* control',
      (await page.locator('[data-cc-new-order]').count()) === 0,
      'the way out of a live basket is abandon, and it asks first')

    await page.locator('[data-cc-submit]').click()
    await page.locator('[data-cc-order-placed]').waitFor({ timeout: 10_000 })
    check('the placed order draws its number',
      (await page.locator('[data-cc-order-no]').innerText()).trim() === SUBMITTED.documentNo,
      SUBMITTED.documentNo)
    check('🚩 ...and a live control under it — the finished screen is not a dead end',
      (await page.locator('[data-cc-new-order]').isVisible()))
    check('*Place order* is gone with the order it placed',
      (await page.locator('[data-cc-submit]').count()) === 0)

    await page.locator('[data-cc-new-order]').click()
    await page.locator('#cc-phone').waitFor({ timeout: 10_000 })
    check('it asks nothing first — a placed order is a document, not something to void',
      (await page.locator('dialog[open]').count()) === 0)
    check('a second order was opened', opens() === 2, `${opens()} opens`)
    check('the last call\'s order number went with it',
      (await page.locator('[data-cc-order-placed]').count()) === 0)
    check('the basket the caller was read out is gone too',
      (await page.locator('[data-cc-line]').count()) === 0)
    check('🚩 and the caret is in the mobile box for the next caller',
      (await focused(page)) === 'cc-phone', await focused(page))
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
