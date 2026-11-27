// Nearby stock on the highlighted search row (ticket 991, spec 983 D12) — drives the REAL
// app in Chromium, the wire stubbed at Playwright from the contract's open fixture.
//
//   1. run the app:  npx vite --port 5202 --strictPort
//   2. DRIVE_PORT=5202 node tools/callcenter-nearby-drive.mjs
//
// Asserts ticket 991's Proof, in LTR and RTL:
//   1. arrowing quickly through ten rows asks `StockElsewhere` ONCE, for the row the
//      keyboard settled on — never for every row;
//   2. the settled row says "0 here · Malqa 2 · Yasmin 5" under its price, and only it does;
//   3. an outage (`available: false`) says *could not check*, never *nobody has it*;
//   4. coming back to a row already asked about asks nothing (cached per item and plant);
//   5. a mouse resting on a row asks for that row.
// RTL is `dir="rtl"` with the English strings: the console's `lng` stays `en`.
// ⚠ STUB: StockElsewhere has no capture (BackOffice 876) — the shape is §3.5's.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5202}`
const SHOTS = 'tools/.callcenter-nearby-shots'
mkdirSync(SHOTS, { recursive: true })

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
    .response.body.data

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

let pass = 0
let fail = 0
const ok = (c, m, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

const OPENED = fixture('01-open-empty').state
const STATE = {
  ...OPENED,
  header: { ...OPENED.header, plant: '1101', plantName: 'Olaya' },
  capabilities: { ...OPENED.capabilities, canAddItem: true, canPriceCheck: true },
}

// Ten rows: the tenth is out of stock here (the walk's case), the ninth's stock hop is down.
const ROWS = Array.from({ length: 10 }, (_, i) => ({
  materialNumber: `30000${i}`,
  descriptionEn: `Panadol test item ${i + 1}`,
  descriptionAr: `بنادول ${i + 1}`,
  estimatePriceExVat: 9.13,
  atp: i === 9 ? 0 : 4,
}))
const LAST = ROWS[9].materialNumber
const OUTAGE = ROWS[8].materialNumber

const store = (plant, areaName, atp) => ({
  plant,
  city: 'Riyadh',
  areaName,
  address: 'x',
  atp,
  distanceKm: 1.5,
})
const stockFor = (item) =>
  item === OUTAGE
    ? { contractVersion: '1.7', itemNumber: item, originPlant: '1101', distanceKnown: true, available: false, stores: [], withStock: 0, truncated: false }
    : {
        contractVersion: '1.7',
        itemNumber: item,
        originPlant: '1101',
        distanceKnown: true,
        available: true,
        stores: [store('1204', 'Malqa', 2), store('1302', 'Yasmin', 5)],
        withStock: 2,
        truncated: false,
      }

const browser = await chromium.launch()
const allErrors = []

for (const dir of ['ltr', 'rtl']) {
  console.log(`\n${dir}`)
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const stockAsks = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  await page.route('**/api/**', (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state: STATE, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(STATE))
    if (p === 'CallCenterWeb/ItemSearch') return route.fulfill(envelope({ rows: ROWS, truncated: false, atpAvailable: true }))
    if (p === 'CallCenterWeb/StockElsewhere') {
      const item = new URL(url).searchParams.get('itemNumber')
      stockAsks.push(item)
      return route.fulfill(envelope(stockFor(item)))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  const box = page.locator('#cc-item-search')
  await box.waitFor({ timeout: 20_000 })
  await box.fill('panadol')
  await page.locator('[data-cc-search-row]').nth(9).waitFor({ timeout: 10_000 })

  // 1. Ten rows, quickly.
  await box.focus()
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(40)
  }
  ok(stockAsks.length === 0, `${dir}: nothing asked while the arrow is moving`, `${stockAsks.length} ask(s)`)
  await page.locator(`[data-cc-nearby="${LAST}"][data-cc-nearby-kind="listed"]`).waitFor({ timeout: 5_000 })
  ok(
    stockAsks.length === 1 && stockAsks[0] === LAST,
    `${dir}: ten rows arrowed quickly made ONE request, for the settled row`,
    JSON.stringify(stockAsks),
  )
  ok((await page.locator('[data-cc-nearby]').count()) === 1, `${dir}: only the settled row carries the line`)

  // 2. What it says.
  const line = page.locator(`[data-cc-nearby="${LAST}"]`)
  ok((await line.locator('[data-cc-nearby-here]').getAttribute('data-cc-nearby-here')) === '0', `${dir}: it says 0 here`)
  const stores = await line.locator('[data-cc-nearby-store]').allTextContents()
  ok(
    stores.length === 2 && /Malqa\s*2/.test(stores[0]) && /Yasmin\s*5/.test(stores[1]),
    `${dir}: then Malqa 2 · Yasmin 5, as ranked`,
    JSON.stringify(stores),
  )
  if (dir === 'ltr') {
    // The gaps are layout, not characters: compared with the whitespace taken out.
    const text = (await line.textContent()).replace(/\s+/g, '')
    ok(text === '0here·Malqa2·Yasmin5', `${dir}: the line reads "0 here · Malqa 2 · Yasmin 5"`, text)
  }
  await page.screenshot({ path: `${SHOTS}/${dir}-listed.png` })

  // 3. The outage row.
  await page.keyboard.press('ArrowUp')
  const outage = page.locator(`[data-cc-nearby="${OUTAGE}"][data-cc-nearby-kind="unknown"]`)
  await outage.waitFor({ timeout: 5_000 })
  const outageText = await outage.textContent()
  // The app renders English under dir="rtl" (`src/core/i18n.ts` keeps `lng: 'en'`).
  ok(
    /Could not check/.test(outageText),
    `${dir}: an outage says could-not-check`,
    outageText,
  )
  ok(
    !/no other store/.test(outageText),
    `${dir}: and never nobody-has-it`,
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-outage.png` })

  // 4. Back down: cached.
  const before = stockAsks.length
  await page.keyboard.press('ArrowDown')
  await page.locator(`[data-cc-nearby="${LAST}"][data-cc-nearby-kind="listed"]`).waitFor({ timeout: 5_000 })
  ok(stockAsks.length === before, `${dir}: coming back to a row already asked about asks nothing`, JSON.stringify(stockAsks))

  // 5. The mouse settles on row 3.
  const third = ROWS[2].materialNumber
  await page.locator(`[data-cc-search-row="${third}"]`).hover()
  await page.locator(`[data-cc-nearby="${third}"][data-cc-nearby-kind="listed"]`).waitFor({ timeout: 5_000 })
  ok(stockAsks.at(-1) === third, `${dir}: a mouse resting on a row asks for that row`)
  ok((await page.locator('[data-cc-nearby]').count()) === 1, `${dir}: still only one row carries the line`)

  ok(errors.length === 0, `${dir}: no console errors`, errors.join(' | '))
  allErrors.push(...errors)
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
