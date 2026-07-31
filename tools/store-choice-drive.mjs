// Two things about the fulfilment store — the one the agent chooses, and the one
// they must not.
//
//   1. run the app:  npx vite --port 5199
//   2. DRIVE_PORT=5199 node tools/store-choice-drive.mjs
//
// Asserts:
//   theChosenStoreAppears
//     1. 🚩 a collection store the agent picks shows on the chip AT ONCE, on a
//        `setStore` answer whose version the server did not advance — the guard
//        used to read that as "same save point, same state" and keep the store
//        they had just replaced, which is the *"I had to reload the page"*
//        report;
//     2. and the rail's *collecting from* block moves with it;
//     3. 🚩 an answer that does not show the move at all is not rendered as
//        truth: the console re-reads the order (§6.1) rather than going on
//        naming the branch the agent replaced.
//     3b. 🚩 the same on the ADDRESS route, where the plant is DERIVED: a
//        `setAddress` that answers the placeholder plant `P000` must not leave
//        that on the chip — which is the reported defect, reload and all.
//   deliveryHasNoStoreToChoose
//     4. on a DELIVERY order the store chip is not a control — the plant is
//        derived from the caller's address, server-side;
//     5. ...and it says so beside the row, rather than being silently inert;
//     6. the command palette has no *store* verb there either — one rule, both
//        ways in;
//     7. on a COLLECTION order the same chip opens the picker as before.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const fixture = (name) =>
  JSON.parse(
    readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'),
  ).response.body.data

const EMPTY = fixture('01-open-empty').state

/** The order as it opens on a collection call: the agent's own entry store, seeded. */
const COLLECTION = {
  ...EMPTY,
  header: { ...EMPTY.header, deliveryType: 'PickInStore', plant: '1001', plantName: 'King AbdelAziz Road', plantSource: 'seededAtOpen' },
}
const DELIVERY = {
  ...EMPTY,
  header: { ...EMPTY.header, deliveryType: 'Delivery', plantSource: 'derivedFromAddress' },
  capabilities: { ...EMPTY.capabilities, canChangeStore: true },
}

/** A caller on the order, and the book open to them — the address route's setup. */
const WITH_CALLER = {
  ...DELIVERY,
  header: {
    ...DELIVERY.header,
    customer: { customerId: 'C1', name: 'Redacted Customer', mobile: '9665000', loyaltyAttached: true },
    address: null,
  },
  capabilities: { ...DELIVERY.capabilities, canOpenAddressBook: true },
}

const ADDRESS = {
  addressNumber: '77120',
  label: 'Home',
  cityCode: '0021',
  cityName: 'Riyadh',
  districtCode: 'R-114',
  districtName: 'Al Malqa',
  street1: 'Anas Ibn Malik',
  street2: null,
  buildingNumber: '2314',
  additionalNumber: null,
  postalCode: '13521',
  mobile: '9665000',
  isDefault: true,
}

/** 🚩 The placeholder plant the reported defect leaves on the chip. */
const PLACEHOLDER = 'P000'

const CHOSEN = '1044'

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
 * @param opts.state      what `Open` answers.
 * @param opts.setStore   how the server answers the override:
 *                        `'stuck-version'` — the move, on the SAME version the
 *                        order already had (the reported defect);
 *                        `'swallowed'`     — a 200 that does not show the move at
 *                        all, with the truth available on the next `getState`.
 */
async function open(browser, { state = COLLECTION, setStore = 'stuck-version' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const calls = []
  // What the ORDER holds server-side — what `getState` answers, which the
  // swallowed case only reveals on the re-read.
  let current = state
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\//, '').split('?')[0]
    calls.push(path)
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (path === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (path === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: current, existing: null }))
    if (path === 'CallCenterWeb/State') return route.fulfill(envelope(current))
    if (path === 'CallCenterWeb/SetStore') {
      const moved = {
        ...current,
        // 🚩 The version does NOT move. That is the defect being driven: the
        // engine saved, the counter did not follow, and the console used to
        // discard the answer as a replay of what it already had.
        etag: `${current.etag}-MOVED`,
        header: { ...current.header, plant: CHOSEN, plantName: 'Al Rawdah', plantSource: 'agentChosen' },
      }
      current = moved
      // A 200 that shows nothing — the truth is on the order, not in the answer.
      if (setStore === 'swallowed') return route.fulfill(envelope(state))
      return route.fulfill(envelope(moved))
    }
    if (path === 'CallCenterWeb/CustomerAddresses') return route.fulfill(envelope([ADDRESS]))
    if (path === 'CallCenterWeb/SetAddress') {
      // What the ORDER ends up at — the district rule's answer, server-side.
      current = {
        ...current,
        etag: `${current.etag}-ADDR`,
        header: {
          ...current.header,
          address: ADDRESS,
          plant: CHOSEN,
          plantName: 'Al Rawdah',
          plantSource: 'derivedFromAddress',
        },
      }
      // 🚩 ...and what the VERB answers: the address landed, the plant is the
      // placeholder. This is the response the console must not render as truth.
      return route.fulfill(
        envelope({
          ...current,
          header: { ...current.header, plant: PLACEHOLDER, plantName: '' },
        }),
      )
    }
    if (path === 'CallCenterWeb/MyDocumentSources')
      return route.fulfill(envelope([{ documentSource: 'CLCN', name: 'Call centre' }]))
    if (path === 'StoreDetails' || /StoreDetails$/.test(path))
      return route.fulfill(
        envelope([
          { storeCode: '1001', city: 'Riyadh', region: 'Central', storeAddress: 'King AbdelAziz Road' },
          { storeCode: CHOSEN, city: 'Riyadh', region: 'Central', storeAddress: 'Al Rawdah' },
        ]),
      )
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
const chipText = async (page) =>
  (await page.locator('[data-cc-chips]').innerText()).replace(/\s+/g, ' ')

async function run() {
  const browser = await chromium.launch()

  // ---- 1–2. the chosen store appears, on a version that did not move ----
  {
    const { context, page } = await open(browser)
    await land(page)
    await page.locator('[data-cc-chip-open="store"]').click()
    await page.locator('[data-cc-section="store"]').waitFor({ timeout: 5_000 })
    await page.locator(`[data-cc-store-option="${CHOSEN}"]`).click()
    await page.locator('[data-cc-section="store"]').waitFor({ state: 'detached', timeout: 10_000 })
    check('🚩 the store the agent chose is on the chip at once, with no reload',
      (await chipText(page)).includes(CHOSEN), await chipText(page))
    check('and the rail is collecting from it',
      (await page.locator('[data-cc-collection="chosen"]').innerText()).includes(CHOSEN))
    await context.close()
  }

  // ---- 3. an answer that shows nothing is not rendered as truth ----
  {
    const { context, page, calls } = await open(browser, { setStore: 'swallowed' })
    await land(page)
    const before = calls.filter((c) => c === 'CallCenterWeb/State').length
    await page.locator('[data-cc-chip-open="store"]').click()
    await page.locator('[data-cc-section="store"]').waitFor({ timeout: 5_000 })
    await page.locator(`[data-cc-store-option="${CHOSEN}"]`).click()
    await page.waitForFunction(
      (code) => document.querySelector('[data-cc-chips]')?.textContent?.includes(code),
      CHOSEN,
      { timeout: 10_000 },
    ).catch(() => {})
    check('🚩 a 200 that does not show the move makes the console ASK the order',
      calls.filter((c) => c === 'CallCenterWeb/State').length > before,
      `${calls.filter((c) => c === 'CallCenterWeb/State').length} getState calls`)
    check('...and what the order actually holds is what the chip says',
      (await chipText(page)).includes(CHOSEN), await chipText(page))
    await context.close()
  }

  // ---- 3b. the address route, where the plant is derived ----
  {
    const { context, page } = await open(browser, { state: WITH_CALLER })
    await land(page)
    await page.locator('[data-cc-pick-address]').first().click()
    await page.locator(`[data-cc-address-option="${ADDRESS.addressNumber}"]`).click()
    await page
      .waitForFunction(
        (code) => document.querySelector('[data-cc-chips]')?.textContent?.includes(code),
        CHOSEN,
        { timeout: 10_000 },
      )
      .catch(() => {})
    const chips = await chipText(page)
    check('🚩 the derived store is the one the order holds, not the placeholder the verb answered',
      chips.includes(CHOSEN) && !chips.includes(PLACEHOLDER), chips)
    await context.close()
  }

  // ---- 4–6. a delivery order has no store to choose ----
  {
    const { context, page } = await open(browser, { state: DELIVERY })
    await land(page)
    check('🚩 the store chip is not a control on a delivery order',
      (await page.locator('[data-cc-chip-open="store"]').count()) === 0)
    check('...and it says why, beside the row',
      await page.locator('[data-cc-store-derived]').isVisible())
    // 6. the other way in. 🚩 The palette's rule is the opposite of the chip
    //    row's on purpose (192): a question the agent ASKED gets an answer, so
    //    the row stays and is dead, carrying the same sentence as the chip row.
    await page.keyboard.press('Control+k')
    await page.locator('[data-cc-palette]').waitFor({ timeout: 5_000 })
    const store = page.locator('[data-cc-palette-row="verb:changeStore"]')
    check('the palette cannot run *Change store* on a delivery order either',
      (await store.getAttribute('aria-disabled')) === 'true' ||
        (await store.getAttribute('data-cc-palette-disabled')) !== null ||
        (await store.isDisabled().catch(() => false)),
      await store.innerText())
    check('...and it gives the SAME sentence the chip row does',
      (await store.innerText()).includes('follows the delivery address'),
      (await store.innerText()).replace(/\s+/g, ' '))
    await context.close()
  }

  // ---- 7. collection still chooses ----
  {
    const { context, page } = await open(browser)
    await land(page)
    check('a collection order chooses its store exactly as before',
      (await page.locator('[data-cc-chip-open="store"]').count()) === 1)
    check('...and draws no derived-store sentence',
      (await page.locator('[data-cc-store-derived]').count()) === 0)
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
