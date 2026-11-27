// Ticket 994 — changing the store never leaves the console stuck. Drives the REAL app in
// Chromium with the wire stubbed at Playwright from the contract's own fixtures.
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/callcenter-store-change-drive.mjs
//
// Changes the store both ways — the console's own override (`StorePicker`) and the top-bar
// switcher (`Auth/SwitchStore`) — and asserts after each that the console is still usable:
//   A. a collection order still on the store `open` SEEDED (plantSource `seededAtOpen`, the
//      gate shut): the seeded store is choosable, and choosing it opens the gate (§2.3 item 4,
//      capture 10 `pickupConfirmSeededStore`) — the stuck state ticket 994 found;
//   B. mid-order, the console override moves the store and back, previewed and re-priced;
//   C. mid-order, the top-bar switcher moves the acting store; the order keeps its plant and
//      every control keeps working, the override included;
//   D. after a top-bar switch, the next order opens seeded at the NEW store and that store
//      can be chosen for collection.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { permissions, ALL_SCREENS } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`

const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
const fixture = (name) => raw(name).response.body.data

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

let pass = 0
let fail = 0
const check = (m, c, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

const STORES = [
  { storeCode: '1001', city: 'Riyadh', region: 'Central', storeAddress: 'King AbdelAziz Road' },
  { storeCode: '1204', city: 'Riyadh', region: 'Central', storeAddress: 'Olaya North' },
  { storeCode: '2301', city: 'Jeddah', region: 'Western', storeAddress: 'Al Rawdah' },
].map((s) => ({ ...s, deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false }))
const plantName = (code) => STORES.find((s) => s.storeCode === code)?.storeAddress ?? null
/** What each store charges, as a factor on the captured line price — so a move re-prices. */
const PRICE_AT = { 1001: 1, 1204: 0.9, 2301: 1.1 }

const PRICED = fixture('02-two-lines-priced')
const CONFIRM_SEEDED = raw('10-opening-gate').pickupConfirmSeededStore.response.body.data

/** A collection order with the caller attached, still on the store `open` seeded. */
const seededPickup = (plant) => ({
  ...CONFIRM_SEEDED,
  version: CONFIRM_SEEDED.version - 1,
  header: { ...CONFIRM_SEEDED.header, plant, plantName: plantName(plant), plantSource: 'seededAtOpen', entryStore: plant },
  capabilities: {
    ...CONFIRM_SEEDED.capabilities,
    canAddItem: false,
    canPriceCheck: false,
    canApplyCoupon: false,
    canConfirmSeededStore: true,
    capabilityReasons: { canApplyCoupon: 'STORE_NOT_CHOSEN' },
    submitBlockers: ['NO_LINES', 'STORE_NOT_CHOSEN', 'MISSING_SOURCE_REFERENCE'],
  },
})

/** A collection order mid-call: caller, a chosen store, two priced lines. */
const MID_ORDER = {
  ...PRICED,
  header: { ...PRICED.header, deliveryType: 'PickInStore', plantSource: 'chosenForPickup', address: null },
  capabilities: { ...PRICED.capabilities, submitBlockers: ['MISSING_SOURCE_REFERENCE'] },
}

const repriced = (state, plant) => {
  const factor = PRICE_AT[plant] / PRICE_AT[state.header.plant]
  const scale = (m) => ({ net: +(m.net * factor).toFixed(2), gross: +(m.gross * factor).toFixed(2) })
  const lines = state.lines.map((line) => ({ ...line, unitPrice: scale(line.unitPrice), lineTotal: scale(line.lineTotal) }))
  const net = +lines.reduce((sum, l) => sum + l.lineTotal.net, 0).toFixed(2)
  const gross = +lines.reduce((sum, l) => sum + l.lineTotal.gross, 0).toFixed(2)
  const fee = state.totals.deliveryFee?.amount ?? 0
  return { lines, totals: { ...state.totals, net, vat: +(gross - net).toFixed(2), gross, payable: +(gross + fee).toFixed(2) } }
}

const browser = await chromium.launch()

async function open({ openState, actingStore = '1001' }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const wire = []
  let acting = actingStore
  let opens = 0
  let served = openState
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    let body = null
    if (route.request().method() === 'POST')
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
    wire.push({ path: p, body })
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: acting }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions([...ALL_SCREENS]))
    if (p === 'Auth/SwitchStore') {
      acting = body.storeCode
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: acting }),
      )
    }
    if (p === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORES))
    if (p === 'CallCenterWeb/Open') {
      opens += 1
      // The first open is the scenario's; any later one is a fresh order seeded at the
      // agent's acting store NOW, which is what `open` reads (`caller.EntryStore`).
      if (opens > 1) served = { ...seededPickup(acting), transactionId: `06FRESH${opens}`.padEnd(26, '0') }
      return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    }
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(served))
    if (p === 'CallCenterWeb/Abandon')
      return route.fulfill(envelope({ outcome: 'abandoned', transactionId: body.transactionId }))
    if (p === 'CallCenterWeb/SetStore') {
      const target = body.storeCode
      const moves = served.lines.length > 0 && target !== served.header.plant
      if (moves && !body.confirmToken) {
        const after = repriced(served, target)
        return route.fulfill(
          envelope({
            ...served,
            pendingConfirmation: {
              kind: 'storeChange',
              confirmToken: `TOKEN-${target}`,
              expiresInMs: 120_000,
              detail: {
                fromPlant: served.header.plant,
                fromPlantName: served.header.plantName,
                toPlant: target,
                toPlantName: plantName(target),
                lineDiffs: served.lines.map((line, i) => ({
                  lineId: line.lineId,
                  itemNumber: line.itemNumber,
                  description: line.description,
                  fromGross: line.lineTotal.gross,
                  toGross: after.lines[i].lineTotal.gross,
                })),
              },
            },
          }),
        )
      }
      const blockers = served.capabilities.submitBlockers.filter((c) => c !== 'STORE_NOT_CHOSEN')
      served = {
        ...served,
        ...(moves ? repriced(served, target) : {}),
        version: served.version + 1,
        pendingConfirmation: null,
        header: { ...served.header, plant: target, plantName: plantName(target), plantSource: 'chosenForPickup' },
        capabilities: {
          ...served.capabilities,
          canAddItem: true,
          canPriceCheck: true,
          canApplyCoupon: true,
          canConfirmSeededStore: false,
          capabilityReasons: {},
          submitBlockers: blockers,
        },
      }
      return route.fulfill(envelope(served))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  return { context, page, errors, wire, served: () => served, acting: () => acting }
}

const text = async (page, selector) => ((await page.locator(selector).first().innerText()) ?? '').replace(/\s+/g, ' ')
const storeChip = (page) => text(page, '[data-cc-chip="store"]')

/** The console's own override, end to end: open, pick, accept the preview if one comes. */
async function override(page, storeCode) {
  await page.locator('[data-cc-chip-open="store"]').first().click()
  await page.locator('[data-cc-store-picker]').waitFor({ timeout: 10_000 })
  const option = page.locator(`[data-cc-store-option="${storeCode}"]`)
  if (await option.isDisabled()) return 'disabled'
  await option.click()
  const sheet = page.locator('[data-cc-confirm-sheet="storeChange"]')
  await Promise.race([
    sheet.waitFor({ timeout: 10_000 }),
    page.locator('[data-cc-store-picker]').waitFor({ state: 'detached', timeout: 10_000 }),
  ])
  if (await sheet.isVisible()) {
    await page.locator('[data-cc-confirm-accept]').click()
    await sheet.waitFor({ state: 'detached', timeout: 10_000 })
  }
  await page.waitForLoadState('networkidle')
  return 'applied'
}

/** The top bar's store chip → its select. */
async function switchTopBar(page, storeCode) {
  await page.locator('#layout-topbar [data-store-chip]').click()
  const select = page.locator('#layout-store-panel select')
  await select.waitFor({ timeout: 10_000 })
  const disabled = await select.isDisabled()
  if (!disabled) await select.selectOption(storeCode)
  await page.waitForLoadState('networkidle')
  await page.keyboard.press('Escape')
  return disabled ? 'disabled' : 'switched'
}

/** "Usable": no modal or busy strip left standing, and the item search is there to type in. */
async function usable(page, at) {
  check(`${at}: no confirmation sheet left open`, (await page.locator('[data-cc-confirm-sheet]').count()) === 0)
  check(`${at}: no busy strip left standing`, (await page.locator('[data-cc-busy]').count()) === 0)
  check(`${at}: no fault over the order`, (await page.locator('[data-cc-notice]').count()) === 0)
  check(`${at}: the opening card has retired`, (await page.locator('[data-cc-steps]').count()) === 0)
  const search = page.locator('[data-cc-search-input]')
  check(`${at}: the item search is there and enabled`, (await search.count()) > 0 && (await search.first().isEnabled()))
}

// ---- A. the seeded collection store is choosable ----
{
  console.log('\nA. a collection order still on the store open seeded')
  const { context, page, errors, wire } = await open({ openState: seededPickup('1001') })
  check('the gate is shut: the opening card stands', (await page.locator('[data-cc-steps]').count()) === 1)
  const result = await override(page, '1001')
  check('🚩 the seeded store can be chosen in the picker', result === 'applied', result)
  if (result === 'applied') {
    const sends = wire.filter((w) => w.path === 'CallCenterWeb/SetStore')
    check('it rides SetStore with the store the order already holds', sends.length === 1 && sends[0].body.storeCode === '1001')
    await usable(page, 'A')
  }
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- B. mid-order, the console override moves the store and back ----
{
  console.log('\nB. mid-order, the console override, both ways')
  const { context, page, errors, served } = await open({ openState: MID_ORDER })
  const basketBefore = await text(page, '[data-cc-basket]')
  check('the override to 1204 applies', (await override(page, '1204')) === 'applied')
  check('the chip names 1204', (await storeChip(page)).includes('1204'), await storeChip(page))
  check('the basket re-priced', (await text(page, '[data-cc-basket]')) !== basketBefore)
  await usable(page, 'B after 1204')
  check('and back to 1001 applies', (await override(page, '1001')) === 'applied')
  check('the chip names 1001', (await storeChip(page)).includes('1001'), await storeChip(page))
  check('the server holds 1001', served().header.plant === '1001')
  await usable(page, 'B after 1001')
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- C. mid-order, the top-bar switcher ----
{
  console.log('\nC. mid-order, the top-bar switcher')
  const { context, page, errors, wire, acting } = await open({ openState: MID_ORDER })
  const result = await switchTopBar(page, '2301')
  check('the top-bar switcher takes the switch', result === 'switched', result)
  check('the acting store moved to 2301', acting() === '2301')
  check('the order keeps its own plant', (await storeChip(page)).includes('1001'), await storeChip(page))
  await usable(page, 'C after the top-bar switch')
  check('the console override still works after it', (await override(page, '1204')) === 'applied')
  check('the chip names 1204', (await storeChip(page)).includes('1204'), await storeChip(page))
  await usable(page, 'C after the override')
  check('back on the top bar to 1001', (await switchTopBar(page, '1001')) === 'switched')
  await usable(page, 'C after switching back')
  check('nothing re-opened the order', wire.filter((w) => w.path === 'CallCenterWeb/Open').length === 1)
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

// ---- D. after a top-bar switch, the next order is seeded at the new store ----
{
  console.log('\nD. a top-bar switch, then the next order')
  const { context, page, errors } = await open({ openState: seededPickup('1001') })
  check('the top-bar switch to 1204', (await switchTopBar(page, '1204')) === 'switched')
  // Leave this order for a fresh one, the way an agent would: abandon.
  await page.locator('[data-cc-abandon]').first().click()
  await page.locator('[data-cc-abandon-confirm]').click()
  await page.waitForLoadState('networkidle')
  await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
  check('the fresh order is seeded at 1204', (await storeChip(page)).includes('1204'), await storeChip(page))
  const result = await override(page, '1204')
  check('🚩 and 1204 can be chosen for collection', result === 'applied', result)
  if (result === 'applied') await usable(page, 'D')
  check('no console errors', errors.length === 0, errors[0] ?? '')
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
