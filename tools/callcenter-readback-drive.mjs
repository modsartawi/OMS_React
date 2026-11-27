// The read-back sentence in the summary column (spec 983 D8, ticket 988) — drives the REAL
// app in Chromium, the wire stubbed at Playwright on contract v1.13.
//
//   1. run the app:  npx vite --port 5208 --strictPort
//   2. DRIVE_PORT=5208 node tools/callcenter-readback-drive.mjs
//
// Asserts, LTR at 1366 and RTL at 1366:
//   1. a delivery order reads: items · saving · total · delivered to the label, the window ·
//      cash on delivery — the total the server's payable (deliberately NOT a sum);
//   2. the sentence sits under *Before you place it* and above *Place order*;
//   3. collection reads "ready to collect at 1001 · …" and "pay when you collect", no window;
//   4. no slot yet: the window is left out — no dangling comma, no blank;
//   5. under RTL the figures, the window and the quantities are LTR isolates and the address
//      label and the item names are `<bdi>`.
// Screenshots → tools/.callcenter-readback-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5208}`
const SHOTS = 'tools/.callcenter-readback-shots'
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

const PRICED = fixture('02-two-lines-priced')
const TOTALS = {
  ...PRICED.totals,
  beforeDiscount: 38.58,
  discount: 3.87,
  // ⚠ Not net + vat + fee: the sentence must say the server's payable.
  payable: 61.07,
}
const HOME = {
  addressNumber: '2',
  label: 'Home',
  cityCode: 'RUH',
  cityName: 'Riyadh',
  districtCode: '011',
  districtName: 'Malqa',
  line: 'King Fahd Rd',
}
const DELIVER = {
  ...PRICED,
  header: { ...PRICED.header, address: HOME, slot: { slotId: 'S16', from: '16:00', to: '18:00', isActive: true } },
  totals: TOTALS,
  capabilities: { ...PRICED.capabilities, submitBlockers: [], canSubmit: true },
}
const STATES = {
  deliver: DELIVER,
  collect: { ...DELIVER, header: { ...DELIVER.header, deliveryType: 'PickInStore', address: null, slot: null } },
  noSlot: {
    ...DELIVER,
    header: { ...DELIVER.header, slot: null },
    capabilities: { ...DELIVER.capabilities, submitBlockers: ['MISSING_SLOT'], canSubmit: false },
  },
}

const browser = await chromium.launch()

async function open(state, { dir = 'ltr' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.addInitScript((d) => {
    localStorage.setItem('oms.darkMode', 'false')
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
  }, dir)
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  return { context, page, errors }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
// Money spaces its currency with a margin, not a character, so innerText reads `3.87SAR`.
const sentence = async (page) => strip(await page.locator('[data-cc-readback-sentence]').innerText())
const clauses = (page) =>
  page.locator('[data-cc-readback-clause]').evaluateAll((els) => els.map((el) => el.getAttribute('data-cc-readback-clause')))

console.log('\nltr 1366 — delivery')
{
  const { context, page, errors } = await open(STATES.deliver)
  const said = await sentence(page)
  ok(
    said ===
      "That's 2 × 8X4 DEO SPRAY MODN CHARM 150ML and 1 × 8X4 DEO SPRAY MUSK/MARKNT 150M. You save 3.87SAR. Your total is 61.07SAR. We'll deliver it to Home, 16:00–18:00. You pay cash on delivery.",
    '🚩 items · saving · the server’s payable (61.07, not a sum) · Home, 16:00–18:00 · cash on delivery',
    said,
  )
  const box = (sel) => page.locator(sel).first().boundingBox()
  const [checklist, readback, place] = await Promise.all([box('#cc-checklist'), box('[data-cc-readback]'), box('[data-cc-submit]')])
  ok(
    checklist && readback && place && checklist.y + checklist.height <= readback.y + 1 && readback.y + readback.height <= place.y + 1,
    'it sits under Before you place it and above Place order',
    JSON.stringify({ checklist, readback, place }),
  )
  await page.locator('[data-cc-receipt]').screenshot({ path: `${SHOTS}/deliver-ltr.png` })
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

console.log('\nltr 1366 — collection')
{
  const { context, page, errors } = await open(STATES.collect)
  const said = await sentence(page)
  ok(
    said.endsWith("It'll be ready to collect at 1001 · King AbdelAziz Road. You pay when you collect."),
    'ready to collect at the store (code · name), pay when you collect',
    said,
  )
  ok(!/16:00|Home/.test(said), 'no window and no address under collection', said)
  await page.locator('[data-cc-receipt]').screenshot({ path: `${SHOTS}/collect-ltr.png` })
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

console.log('\nltr 1366 — no slot yet')
{
  const { context, page, errors } = await open(STATES.noSlot)
  const said = await sentence(page)
  ok(said.includes("We'll deliver it to Home. You pay"), 'the window is left out — no dangling comma, no blank', said)
  const ids = (await clauses(page)).join()
  ok(ids === 'items,saving,total,where,payment', 'the clauses stay in order', ids)
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

console.log('\nrtl 1366 — delivery')
{
  const { context, page, errors } = await open(STATES.deliver, { dir: 'rtl' })
  ok((await page.evaluate(() => document.documentElement.dir)) === 'rtl', 'the page is right-to-left')
  const kinds = await page
    .locator('[data-cc-readback-sentence] bdi')
    .evaluateAll((els) => els.map((el) => `${el.getAttribute('dir') ?? 'auto'}:${el.textContent.replace(/\s+/g, ' ').trim()}`))
  const has = (k) => kinds.some((x) => x.startsWith(k))
  ok(
    has('ltr:2') && has('ltr:1') && has('ltr:3.87') && has('ltr:61.07') && has('ltr:16:00–18:00'),
    'quantities, figures and the window are LTR isolates, the window whole',
    JSON.stringify(kinds),
  )
  ok(has('auto:Home') && has('auto:8X4 DEO SPRAY MODN CHARM'), 'the address label and the item names are <bdi>', JSON.stringify(kinds))
  await page.locator('[data-cc-receipt]').screenshot({ path: `${SHOTS}/deliver-rtl.png` })
  ok(errors.length === 0, 'no console errors', errors.join(' | '))
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
