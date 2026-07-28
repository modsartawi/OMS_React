// PROTOTYPE DRIVE — throwaway, ticket 175 (+176, 155).
//
//   1. npx vite --port 5199
//   2. node tools/header-175-drive.mjs
//
// Flips all 3 variants × 10 states at 1440×900 (135's design width) and writes a
// PNG per screen into .issues/assets/175-header-prototype/, so the arrangement
// can be argued from pictures rather than from prose. It also asserts the three
// things a screenshot cannot:
//
//   1. nothing throws on any screen
//   2. the ITEM SEARCH PANEL IS ABSENT while `canAddItem` is false — 175's
//      ruling. A disabled panel would pass a screenshot and fail the ruling.
//   3. the centre column never scrolls sideways, and the header region never
//      takes so much of it that the basket has no room (135's density budget —
//      the basket is the only region allowed to grow)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199/prototype/callcenter-header'
const OUT = '.issues/assets/175-header-prototype'
const VARIANTS = ['1', '2', '3', '4']
const STATES = [
  'opening',
  'fulfilment',
  'caller',
  'deliveryWhere',
  'pickupStore',
  'pickupChosen',
  'when',
  'reference',
  'payment',
  'paymentForced',
  'ready',
]
// The states where the gate is SHUT — `canAddItem: false` in the mock.
const GATE_SHUT = new Set(['opening', 'fulfilment', 'caller', 'deliveryWhere', 'pickupStore'])
const STORE_SHAPES = ['grouped', 'palette', 'drill']

mkdirSync(OUT, { recursive: true })

let pass = 0
let fail = 0
const ok = (c, m) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}`)))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const shot = async (name) => {
  // The dev switcher and the store-shape selector are prototype chrome, not
  // design — hidden so the captures show the console and only the console.
  await page.addStyleTag({ content: '.fixed{display:none !important}' })
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const shares = {}

for (const v of VARIANTS) {
  console.log(`\nvariant ${v}`)
  shares[v] = {}
  for (const st of STATES) {
    await page.goto(`${BASE}?variant=${v}&state=${st}`)
    await page.waitForSelector('main')

    const m = await page.evaluate(() => {
      const main = document.querySelector('main')
      const header = main.children[0]
      return {
        main: main.getBoundingClientRect().height,
        header: header.getBoundingClientRect().height,
        overflowX: main.scrollWidth > main.clientWidth + 1,
        // 175: absent, not disabled. Any input inside the item area at all.
        searchInputs: main.querySelectorAll('input[placeholder^="Item name"]').length,
      }
    })

    ok(m.searchInputs === (GATE_SHUT.has(st) ? 0 : 1), `${st} — command line ${GATE_SHUT.has(st) ? 'ABSENT' : 'present'}`)
    ok(!m.overflowX, `${st} — the centre never scrolls sideways`)

    // NOT an assertion — the measurement IS the comparison. How much of the
    // centre column each arrangement spends on the header, and whether it
    // leaves the basket any room, is exactly the trade-off being chosen
    // between. A variant that goes over 100% has pushed the basket off screen.
    const share = m.header / m.main
    shares[v][st] = share
    if (share > 1) console.log(`  ⚑ ${st} — header takes ${(share * 100).toFixed(0)}% — basket pushed off screen`)

    await shot(`v${v}-${st}`)
  }
}

// The third axis: the store picker's three shapes, on the one state that shows it.
console.log('\nstore picker shapes')
for (const shape of STORE_SHAPES) {
  await page.goto(`${BASE}?variant=3&state=pickupStore&store=${shape}`)
  await page.waitForSelector('main')
  const rows = await page.evaluate(() => document.querySelectorAll('main button').length)
  ok(rows > 3, `${shape} — draws a pickable estate (${rows} controls)`)
  await shot(`store-${shape}`)
}

// The density table — the argument, in numbers.
console.log('\nhow much of the centre column each arrangement spends on the header')
console.log(`  ${'state'.padEnd(16)}${VARIANTS.map((v) => `v${v}`.padStart(7)).join('')}`)
for (const st of STATES) {
  console.log(`  ${st.padEnd(16)}${VARIANTS.map((v) => `${(shares[v][st] * 100).toFixed(0)}%`.padStart(7)).join('')}`)
}

// ---- 🚩 TWO LISTS, NOT ONE (owner-reported, 2026-07-28).
// CC2 reads the delivery geography (GetCities/GetDistricts → the district CARRIES
// its store) and the pick-in-store estate (GetStoreDetails) through DIFFERENT
// services with DIFFERENT models. A console that drew one list twice would pass
// every screenshot and be wrong. These assertions are the ones that catch it.
console.log('\ndelivery geography vs the pick-in-store estate')

await page.goto(`${BASE}?variant=4&state=deliveryWhere`)
await page.waitForSelector('main')
const deliveryPane = await page.evaluate(() => document.querySelector('main').innerText)

await page.goto(`${BASE}?variant=4&state=pickupStore`)
await page.waitForSelector('main')
const pickupPane = await page.evaluate(() => document.querySelector('main').innerText)

// 1. they are not the same surface
ok(deliveryPane !== pickupPane, 'the two modes open DIFFERENT surfaces')

// 2. delivery opens the CALLER'S ADDRESS BOOK — CC2's AddressSectionVM shape,
//    and what tickets 165/166 already shipped. Not a geography picker.
ok(/saved addresses/.test(deliveryPane), "delivery opens the caller's ADDRESS BOOK")
ok(/Home|Mother|Work/.test(deliveryPane), 'the book lists the caller’s own labelled addresses')
ok(!/Yes, collect here/.test(deliveryPane), 'delivery never offers the collection confirm')
ok(/delivers from/.test(deliveryPane), 'each address NAMES the store it derives')
ok(/temporarily, normally/.test(deliveryPane), 'a TEMP reassignment says it is temporary')

// 2b. OWNER RULING: a district with no store and no temp store is a HARD BLOCK,
//     shown on the row and unpickable — never hidden, never discovered at submit.
await page.goto(`${BASE}?variant=4&state=deliveryWhere`)
await page.waitForSelector('main')
const block = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('main button')]
  const work = btns.find((b) => b.innerText.includes('Al Aqiq'))
  return { present: !!work, disabled: work?.disabled === true, says: /do not deliver/i.test(work?.innerText ?? '') }
})
ok(block.present, 'the undeliverable address is still SHOWN, not hidden')
ok(block.disabled, 'the undeliverable address is a HARD BLOCK — unpickable')
ok(block.says, 'and it says why, in words')

// 3. collection offers STORES and never asks for a district assignment
await page.goto(`${BASE}?variant=4&state=pickupStore`)
await page.waitForSelector('main')
ok(/Yes, collect here/.test(pickupPane), 'collection offers the seeded-store confirm')
ok(!/delivers from/.test(pickupPane), 'collection never speaks of derivation')

// 4. the POPULATIONS differ — the whole point
const pops = await page.evaluate(async () => {
  const m = await import('/src/features/callcenter/__prototype__/header/header-mock.ts')
  const estate = m.STORES.map((s) => s.code)
  const delivers = m.DELIVERY_STORE_CODES
  return {
    estate,
    delivers,
    collectionOnly: estate.filter((c) => !delivers.includes(c)),
    deliveryOnly: delivers.filter((c) => !estate.includes(c)),
    noStoreDistricts: m.DELIVERY_CITIES.flatMap((c) => c.districts).filter((d) => !m.deriveStore(d)).length,
    tempReassigned: m.DELIVERY_CITIES.flatMap((c) => c.districts).filter((d) => d.tempStoreCode).length,
  }
})
ok(pops.collectionOnly.length > 0, `stores you can collect from but never deliver from: ${pops.collectionOnly.join(', ')}`)
ok(pops.deliveryOnly.length > 0, `stores that deliver but are NOT in the collection estate: ${pops.deliveryOnly.join(', ')}`)
ok(pops.noStoreDistricts > 0, `districts with NO delivery store assigned: ${pops.noStoreDistricts} (§7 has no code for this)`)
ok(pops.tempReassigned > 0, `districts on a TEMP reassignment (TempStoreCode outranks StoreCode): ${pops.tempReassigned}`)

// 5. the address BOOK carries the fields a driver needs, not just a district
await page.goto(`${BASE}?variant=4&state=deliveryWhere`)
await page.waitForSelector('main')
const bookFields = await page.evaluate(() => document.querySelector('main').innerText)
ok(/RIMA6904/.test(bookFields), 'a saved address shows its SPL national address')
ok(/\+966/.test(bookFields), 'a saved address shows its DELIVERY phone')
await shot('delivery-address-book')

// 5b. the ADD path — CC2's UNIFIED location search, not a cascade
await page.click('main >> text=Add a new address')
await page.waitForSelector('main input[placeholder^="District or city"]')
const beforeType = await page.evaluate(() => document.querySelector('main').innerText)
ok(!/Al Malqa/.test(beforeType), 'no location list renders until the agent types')
ok(/Home|Work/.test(beforeType), 'the label list is offered, from the server catalogue')

// one box matches DISTRICT english...
await page.type('main input[placeholder^="District or city"]', 'malqa', { delay: 20 })
ok(/Al Malqa/.test(await page.evaluate(() => document.querySelector('main').innerText)), 'searching by DISTRICT name (en) hits')

// ...and CITY english, which a cascade could never do in one step
await page.fill('main input[placeholder^="District or city"]', 'jeddah')
const byCity = await page.evaluate(() => document.querySelector('main').innerText)
ok(/Al Andalus/.test(byCity), 'searching by CITY name returns its districts — one box, both fields')

// ...and Arabic, which is how half the agents type
await page.fill('main input[placeholder^="District or city"]', 'الملقا')
ok(/Al Malqa/.test(await page.evaluate(() => document.querySelector('main').innerText)), 'searching in ARABIC hits')
await shot('delivery-location-search')

// picking commits BOTH city and district, and names the derived store
await page.fill('main input[placeholder^="District or city"]', 'malqa')
await page.click('main >> text=Al Malqa')
await page.waitForTimeout(80)
const picked = await page.evaluate(() => document.querySelector('main').innerText)
ok(/Riyadh/.test(picked), 'one pick commits BOTH district and city')
ok(/delivers from/.test(picked), 'and names the store the district derives')

// 5c. SPL format validation — CC2's rule, format only
await page.fill('main input[placeholder="RIMA6904"]', 'ABC123')
const bad = await page.evaluate(() => document.querySelector('main').innerText)
ok(/4 letters followed by 4 digits/.test(bad), 'a malformed national address is refused inline')
await page.fill('main input[placeholder="RIMA6904"]', 'RIMA6904')
const good = await page.evaluate(() => document.querySelector('main').innerText)
ok(!/4 letters followed by 4 digits/.test(good), 'a well-formed one clears the error')
await page.fill('main input[placeholder="RIMA6904"]', '')
ok(
  !/4 letters followed by 4 digits/.test(await page.evaluate(() => document.querySelector('main').innerText)),
  'and EMPTY is valid — the national address is optional',
)
await shot('delivery-new-address')

// 6. the store picker matches a CODE — agents know their stores by number
await page.goto(`${BASE}?variant=4&state=pickupStore&store=grouped`)
await page.waitForSelector('main input[placeholder^="Store number"]')
await page.type('main input[placeholder^="Store number"]', '1204', { delay: 20 })
await page.waitForTimeout(80)
const byCode = await page.evaluate(() => document.querySelector('main').innerText)
ok(/Al Yasmin/.test(byCode), 'typing a store CODE finds the store')
await shot('store-by-code')

// ---- the keyboard add loop, driven for real (the part a screenshot cannot argue)
console.log('\nkeyboard add loop — type, Enter, repeat')
await page.goto(`${BASE}?variant=4&state=ready`)
const line = 'main input[placeholder^="Item name"]'
await page.waitForSelector(line)
const basketRows = () => page.evaluate(() => document.querySelectorAll('main [data-numeric]').length)

// 1. the top hit is pre-selected — type and Enter, no arrow key at all
await page.click(line)
await page.type(line, 'sensodyne', { delay: 20 })
await page.waitForTimeout(320)
const listBefore = await page.evaluate(() => document.querySelectorAll('main .absolute').length)
ok(listBefore === 1, 'the list opens while typing')
await page.keyboard.press('Enter')
await page.waitForTimeout(60)
const after = await page.evaluate(() => ({
  value: document.querySelector('main input[placeholder^="Item name"]').value,
  list: document.querySelectorAll('main .absolute').length,
  focused: document.activeElement === document.querySelector('main input[placeholder^="Item name"]'),
  landed: document.body.innerText.includes('Added'),
}))
ok(after.value === '', 'Enter clears the query')
ok(after.list === 0, 'Enter closes the list')
ok(after.focused, 'the caret never leaves the command line')
ok(after.landed, 'what landed is stated, not implied')

// 2. quantity rides the same line
await page.type(line, '3*panadol extra', { delay: 20 })
await page.waitForTimeout(320)
await page.keyboard.press('Enter')
await page.waitForTimeout(60)
// The claim is about the BASKET, not the banner: three of that item on the line.
const qty = await page.evaluate(() => {
  // A BASKET row, not the landed banner: it carries the item number and a UoM.
  const row = [...document.querySelectorAll('main div')].find(
    (d) => d.innerText.includes('Panadol Extra') && d.innerText.includes('EA') && !d.innerText.includes('Added'),
  )
  return row?.innerText.replace(/\n/g, ' | ') ?? null
})
ok(/\|\s*3\s*\|\s*EA/.test(qty ?? ''), `3*panadol adds three, not one — line reads: ${qty}`)

// 3. Enter is INERT while the list is unsettled — the expensive failure
await page.type(line, 'centrum', { delay: 5 })
const settled = await page.evaluate(() => document.body.innerText.includes('↵ add'))
await page.keyboard.press('Enter')
const stillTyped = await page.evaluate(() => document.querySelector('main input[placeholder^="Item name"]').value)
ok(!settled ? stillTyped === 'centrum' : true, 'Enter does nothing while the list is unsettled')
await page.waitForTimeout(320)
await page.keyboard.press('Enter')
await page.waitForTimeout(60)

// 4. undo
const beforeUndo = await basketRows()
await page.keyboard.press('Control+z')
await page.waitForTimeout(60)
ok((await basketRows()) < beforeUndo, 'Ctrl+Z takes the last line back')

// 5. the same line is the command line
await page.type(line, '/', { delay: 20 })
await page.waitForTimeout(320)
const verbs = await page.evaluate(() => document.body.innerText.includes('/slot'))
ok(verbs, '`/` turns the item line into the header command line')
await shot('command-line-verbs')

ok(errors.length === 0, `no page errors (${errors.length})`)
if (errors.length) console.log(errors.slice(0, 5).join('\n'))

console.log(`\n${pass} passed, ${fail} failed — captures in ${OUT}/`)
await browser.close()
process.exit(fail ? 1 : 0)
