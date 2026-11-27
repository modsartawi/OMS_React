// The numbered basket with each line's pricing underneath (spec 983 D4/D5, ticket 985) —
// drives the REAL app in Chromium, the wire stubbed at Playwright from the contract's own
// fixture 02 (the live "Vat %" + amount shape), widened to four lines with a medicine line.
//
//   1. run the app:  npx vite --port 5205 --strictPort
//   2. DRIVE_PORT=5205 node tools/callcenter-basket-drive.mjs
//
// Asserts ticket 985's drive proof:
//   1. the grid's columns, and lines numbered 1..4 by position, in LTR and RTL, no sideways scroll;
//   2. the quiet second line: item number, VAT class (15% / medicine 0%), the offer;
//   3. a line expands and collapses (chevron and name), and its detail reads basic price ·
//      each condition by name · net · VAT as rate AND amount · line total — never "Vat %";
//   4. the keyboard reaches the expander and the stepper, and Enter on the expander opens it;
//   5. the stepper sends a new quantity (never money), − is held at the last unit;
//   6. voiding line 2 of 4 renumbers 3→2 and 4→3, and an open detail stays with its line.
// Screenshots → tools/.callcenter-basket-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5205}`
const SHOTS = 'tools/.callcenter-basket-shots'
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
const [L10, L30] = PRICED.lines
/** A medicine line: the engine's MWST condition at a zero amount (0% VAT). */
const L20 = {
  ...L30,
  lineId: 'L20',
  itemNumber: '101685',
  description: 'PANADOL ADVANCE 500MG 24 TAB',
  description2: 'بنادول أدفانس ٥٠٠ ملغ ٢٤ قرص',
  unitPrice: { net: 9.5, gross: 9.5 },
  lineTotal: { net: 9.5, gross: 9.5 },
  conditions: [
    { type: 'VKP0', description: 'Basic Price', value: 9.5, isStatistical: false },
    { type: 'MWST', description: 'Vat %', value: 0, isStatistical: false },
  ],
  promotions: [],
}
const L40 = { ...L30, lineId: 'L40', itemNumber: '200023', description: '8X4 DEO SPRAY FRESH 150ML', promotions: [] }

// The coupon skips medicine (the engine's own exclusion): L20 is not among its lines.
const FOUR = {
  ...PRICED,
  lines: [L10, L20, L30, L40],
  firedPromotions: PRICED.firedPromotions.map((f) => ({ ...f, lineIds: f.lineIds.filter((id) => id !== 'L20') })),
}
const withQty = (state, lineId, qty, version) => ({
  ...state,
  version,
  lines: state.lines.map((l) => (l.lineId === lineId ? { ...l, qty } : l)),
})
const without = (state, lineId, version) => ({ ...state, version, lines: state.lines.filter((l) => l.lineId !== lineId) })

const browser = await chromium.launch()

async function open(state, { width = 1366, height = 900, dir = 'ltr' } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  const sent = []
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
  let current = state
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state: current, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(current))
    if (p === 'CallCenterWeb/ChangeQty') {
      const body = route.request().postDataJSON()
      sent.push({ p, body })
      current = withQty(current, body.lineId, body.newQty, current.version + 1)
      return route.fulfill(envelope(current))
    }
    if (p === 'CallCenterWeb/VoidLine') {
      const body = route.request().postDataJSON()
      sent.push({ p, body })
      current = without(current, body.lineId, current.version + 1)
      return route.fulfill(envelope(current))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  return { context, page, errors, sent }
}

/** Text as read, with the bidi isolates (FSI…PDI) a `t()` interpolation carries stripped. */
const plain = (s) => (s ?? '').replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ')
const text = async (page, selector) => plain(await page.locator(selector).first().innerText())
const numbers = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-cc-line-number]')].map((el) => [
      el.getAttribute('data-cc-line-number'),
      el.textContent.trim(),
    ]),
  )
const sideways = (page) =>
  page.evaluate(() =>
    [document.scrollingElement, ...document.querySelectorAll('[data-cc-console], [data-cc-col], [data-cc-basket]')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.getAttribute('data-cc-col') ?? el.getAttribute('data-cc-basket') ?? el.tagName}:${el.scrollWidth}>${el.clientWidth}`),
  )

// ---- 1 + 2. the grid, numbered, and its quiet second line ----
for (const view of [
  { width: 1366, dir: 'ltr' },
  { width: 1024, dir: 'ltr' },
  { width: 1366, dir: 'rtl' },
]) {
  const at = `${view.dir} ${view.width}`
  console.log(`\n${at}`)
  const { context, page, errors } = await open(FOUR, view)
  ok(
    (await page.locator('[data-cc-basket-columns] [role="columnheader"]').count()) === 7,
    `${at}: seven columns — # · item · qty · price · discount · total · void`,
  )
  const nums = await numbers(page)
  ok(
    JSON.stringify(nums) === JSON.stringify([['L10', '1'], ['L20', '2'], ['L30', '3'], ['L40', '4']]),
    `${at}: lines numbered 1..4 by position`,
    JSON.stringify(nums),
  )
  const over = await sideways(page)
  ok(over.length === 0, `${at}: nothing scrolls sideways`, over.join(', '))
  ok(
    (await page.locator('[data-cc-line-vat-class="15"]').count()) === 3 &&
      (await page.locator('[data-cc-line-vat-class="0"]').count()) === 1 &&
      (await text(page, '[data-cc-line="L20"] [data-cc-line-vat-class]')).includes('0%'),
    `${at}: the VAT class reads 15% on the three taxed lines and 0% on the medicine line`,
  )
  ok(
    (await text(page, `[data-cc-line="L10"]`)).includes(L10.itemNumber) &&
      (await page.locator('[data-cc-line="L10"] [data-cc-line-promo]').count()) === L10.promotions.length,
    `${at}: the second line carries the item number and the offer`,
  )
  ok(
    (await text(page, '[data-cc-line-price="L10"]')).includes(L10.unitPrice.gross.toFixed(2)) &&
      (await page.locator('[data-cc-line-discount="L10"] [data-numeric]').count()) === 2 &&
      (await page.locator('[data-cc-line-discount="L20"] [data-numeric]').count()) === 0,
    `${at}: price is the server's unit price; discount lists each discount condition, never a sum`,
    await text(page, '[data-cc-line="L10"]'),
  )
  await page.screenshot({ path: `${SHOTS}/grid-${view.dir}-${view.width}.png` })
  ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
  await context.close()
}

// ---- 3. expand and collapse; the detail reads VAT as rate and amount ----
{
  console.log('\nexpand / collapse')
  const { context, page, errors } = await open(FOUR)
  const expander = page.locator('[data-cc-line-expand="L10"]')
  ok((await expander.getAttribute('aria-expanded')) === 'false', 'a line starts closed')
  ok((await page.locator('[data-cc-line-pricing]').count()) === 0, 'and no detail is drawn')
  await expander.click()
  ok((await expander.getAttribute('aria-expanded')) === 'true', 'the chevron opens it (aria-expanded)')
  const detail = page.locator('[data-cc-line-pricing="L10"]')
  ok(await detail.isVisible(), 'the detail sits under its line')
  const rows = await detail.evaluate((el) =>
    [...el.querySelectorAll('[data-cc-pricing-row]')].map((r) => r.getAttribute('data-cc-pricing-row')),
  )
  ok(
    JSON.stringify(rows) === JSON.stringify(['condition', 'condition', 'condition', 'net', 'vat', 'total']),
    'basic price · each condition · net · VAT · line total, in that order',
    JSON.stringify(rows),
  )
  const all = await text(page, '[data-cc-line-pricing="L10"]')
  ok(all.includes('Basic Price') && all.includes('25.72') && all.includes('10% Coupon'), 'each condition by its own name and value', all)
  ok(all.includes(L10.lineTotal.net.toFixed(2)), 'net is the line’s own net', all)
  const vat = await text(page, '[data-cc-line-pricing="L10"] [data-cc-pricing-row="vat"]')
  ok(/VAT 15%/.test(vat) && vat.includes('3.47') && !/Vat %/.test(vat), '🚩 VAT reads as rate AND amount ("VAT 15%" · 3.47), never "Vat % 3.47"', vat)
  ok(all.includes(L10.lineTotal.gross.toFixed(2)), 'the line total is the projection’s gross', all)
  await page.screenshot({ path: `${SHOTS}/expanded-ltr.png` })
  await expander.click()
  ok(
    (await expander.getAttribute('aria-expanded')) === 'false' && (await page.locator('[data-cc-line-pricing]').count()) === 0,
    'a second click collapses it',
  )
  await page.locator('[data-cc-line="L20"] bdi', { hasText: L20.description }).click()
  const med = await text(page, '[data-cc-line-pricing="L20"] [data-cc-pricing-row="vat"]')
  ok(/VAT 0%/.test(med) && med.includes('0.00'), 'clicking the name opens it too, and a medicine line reads VAT 0% · 0.00', med)
  ok(errors.length === 0, 'no console errors', errors[0] ?? '')
  await context.close()
}

// ---- 4. the keyboard reaches the expander and the stepper ----
{
  console.log('\nkeyboard')
  const { context, page, errors } = await open(FOUR)
  await page.locator('#cc-item-search').focus()
  const reached = []
  for (let i = 0; i < 40 && reached.length < 8; i++) {
    await page.keyboard.press('Tab')
    const hit = await page.evaluate(() => {
      const el = document.activeElement
      for (const a of ['data-cc-line-expand', 'data-cc-line-less', 'data-cc-line-qty', 'data-cc-line-more', 'data-cc-line-void'])
        if (el?.hasAttribute(a)) return `${a}=${el.getAttribute(a)}`
      return null
    })
    if (hit) reached.push(hit)
  }
  ok(reached[0] === 'data-cc-line-expand=L10', 'Tab from the search reaches line 1’s expander first', reached.join(', '))
  ok(
    reached.includes('data-cc-line-more=L10') && reached.includes('data-cc-line-qty=L10'),
    'then its quantity field and its + step',
    reached.join(', '),
  )
  // − on a 2-unit line is live and reachable; − on a 1-unit line is held (zero is a void).
  ok(reached.includes('data-cc-line-less=L10'), 'the − step is reachable on a line above one unit', reached.join(', '))
  ok(await page.locator('[data-cc-line-less="L30"]').isDisabled(), '− is held at the last unit (L30, qty 1)')
  await page.locator('[data-cc-line-expand="L10"]').focus()
  await page.keyboard.press('Enter')
  ok(
    (await page.locator('[data-cc-line-expand="L10"]').getAttribute('aria-expanded')) === 'true' &&
      (await page.locator('[data-cc-line-pricing="L10"]').isVisible()),
    'Enter on the expander opens the detail',
  )
  await page.keyboard.press('Space')
  ok((await page.locator('[data-cc-line-pricing="L10"]').count()) === 0, 'Space closes it again')
  const focus = await page.evaluate(() => {
    const el = document.activeElement
    const s = getComputedStyle(el)
    return s.outlineStyle !== 'none' || s.boxShadow !== 'none'
  })
  ok(focus, 'the focused expander shows a focus ring')
  ok(errors.length === 0, 'no console errors', errors[0] ?? '')
  await context.close()
}

// ---- 5 + 6. the stepper sends a quantity; a void renumbers, the open detail stays ----
{
  console.log('\nstepper and void')
  const { context, page, errors, sent } = await open(FOUR)
  await page.locator('[data-cc-line-more="L10"]').click()
  await page.waitForFunction(() => document.querySelector('[data-cc-line-qty="L10"]')?.value === '3')
  const qty = sent.find((s) => s.p === 'CallCenterWeb/ChangeQty')
  ok(
    qty && qty.body.lineId === 'L10' && qty.body.newQty === 3 && !Object.keys(qty.body).some((k) => /price|amount|discount|number/i.test(k)),
    '+ sends ChangeQty { lineId, newQty: 3 } — no money, no line number',
    JSON.stringify(qty?.body),
  )
  await page.locator('[data-cc-line-expand="L30"]').click()
  await page.locator('[data-cc-line-void="L20"]').click()
  await page.waitForFunction(() => !document.querySelector('[data-cc-line="L20"]'))
  const nums = await numbers(page)
  ok(
    JSON.stringify(nums) === JSON.stringify([['L10', '1'], ['L30', '2'], ['L40', '3']]),
    '🚩 voiding line 2 of 4 renumbers 3→2 and 4→3',
    JSON.stringify(nums),
  )
  const voided = sent.find((s) => s.p === 'CallCenterWeb/VoidLine')
  ok(voided && voided.body.lineId === 'L20' && !('lineNumber' in voided.body), 'the void names the line by id, never by number', JSON.stringify(voided?.body))
  ok(
    (await page.locator('[data-cc-line-pricing="L30"]').isVisible()) && (await page.locator('[data-cc-line-pricing]').count()) === 1,
    'the detail opened on L30 stays with L30 after it becomes line 2',
  )
  ok(
    /How line 2 was priced/.test(plain(await page.locator('[data-cc-line-pricing="L30"]').getAttribute('aria-label'))),
    'and its accessible name says line 2 now',
  )
  await page.screenshot({ path: `${SHOTS}/after-void.png` })
  ok(errors.length === 0, 'no console errors', errors[0] ?? '')
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
