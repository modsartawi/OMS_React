// The call center's order header as a sentence over a ledger (spec 380 C3–C6, ticket 408) —
// drives the REAL app in Chromium, the wire stubbed at Playwright from the contract's open
// fixture with the header facts set by this file.
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/callcenter-sentence-drive.mjs
//
// Asserts ticket 408's Proof, in light, dark and RTL (English strings under dir="rtl" and
// Arabic stub rows — there is no Arabic locale file):
//   1. the chip row is gone; the sentence and the ledger draw the order, slot by slot, in
//      their four looks (settled, blocked, ghost, readout);
//   2. Tab moves through the words in the sentence's reading order, then the ledger;
//      readouts are not stops;
//   3. Enter (and Space) opens the word's in-flow section and moves focus into it; Esc
//      closes it and puts focus back on the word;
//   4. an Arabic caller name shows whole, between "for" and "from";
//   5. an 18:00–21:00 window reads 18:00–21:00 in every mode, RTL included — and, under RTL,
//      still does in a right-to-left sentence (an Arabic template's), where a control
//      without the isolate reverses it;
//   6. the address word opens the address book; the delivery store is a readout titled
//      with why; a mode flip rewrites the sentence — the address and the window leave and
//      the store becomes a control.
// Screenshots → tools/.callcenter-sentence-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5280}`
const SHOTS = 'tools/.callcenter-sentence-shots'
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

const CALLER = 'فاطمة بنت عبدالله العتيبي'
const OPENED = fixture('01-open-empty').state

/** ⚠ STUB: the open fixture with a caller, an address, a window and the bookkeeping set
 *  here — no capture holds an order this far along with an Arabic caller. */
const DELIVERING = {
  ...OPENED,
  header: {
    ...OPENED.header,
    deliveryType: 'Delivery',
    plant: '1101',
    plantName: 'الملقا',
    plantSource: 'derivedFromAddress',
    customer: { customerId: 'C-1000000034', name: CALLER, mobile: '966501076360', loyaltyAttached: true },
    address: {
      addressNumber: '1',
      label: 'Home',
      cityCode: 'RUH',
      cityName: 'الرياض',
      districtCode: 'MLQ',
      districtName: 'الملقا',
      line: 'Anas Ibn Malik Rd, bldg 14',
    },
    slot: { slotId: 'S-1', from: '18:00', to: '21:00', isActive: true },
    documentSource: 'CLCN',
    sourceReference: 'CRM-889231',
    orderNote: 'Call before arrival — the building gate is on the side street',
    coupons: [],
  },
  capabilities: {
    ...OPENED.capabilities,
    canAddItem: true,
    canOpenAddressBook: true,
    canChangeStore: true,
    capabilityReasons: {},
    submitBlockers: ['NO_LINES'],
  },
}

/** The same order after the flip: collected, its store not yet chosen — one save point
 *  later, or the console keeps the state it has (`applyState`). */
const COLLECTING = {
  ...DELIVERING,
  version: DELIVERING.version + 1,
  header: { ...DELIVERING.header, deliveryType: 'PickInStore', address: null, slot: null, retainedAddressLabel: 'Home' },
  capabilities: { ...DELIVERING.capabilities, submitBlockers: ['NO_LINES', 'STORE_NOT_CHOSEN'] },
}

const MODES = [
  { theme: 'light', dir: 'ltr' },
  { theme: 'dark', dir: 'ltr' },
  { theme: 'light', dir: 'rtl' },
]

const browser = await chromium.launch()
const allErrors = []

async function open({ theme, dir }, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const errors = []
  const wire = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    wire.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: DELIVERING, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(DELIVERING))
    if (p === 'CallCenterWeb/SetFulfilment') return route.fulfill(envelope(COLLECTING))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-sentence]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  return { context, page, errors, wire }
}

/** The text of a node as laid out: its characters sorted by their x (foundation-drive's). */
const visualOf = (locator) =>
  locator.evaluate((el) => {
    const chars = []
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (let i = 0; i < n.textContent.length; i++) {
        const range = document.createRange()
        range.setStart(n, i)
        range.setEnd(n, i + 1)
        const box = range.getBoundingClientRect()
        if (box.width > 0) chars.push({ ch: n.textContent[i], x: box.left + box.width / 2 })
      }
    }
    const bdi = el.matches('bdi') ? el : el.querySelector('bdi')
    return {
      logical: el.textContent.trim(),
      visual: chars
        .sort((a, b) => a.x - b.x)
        .map((x) => x.ch)
        .join('')
        .trim(),
      isolate: bdi ? (bdi.getAttribute('dir') ?? 'auto') : null,
    }
  })

/** Tab through the header from its first control, collecting the stops it makes. */
async function tabStops(page) {
  await page.locator('[data-cc-chips] [data-cc-chip-open]').first().focus()
  const stops = []
  for (let i = 0; i < 12; i++) {
    const id = await page.evaluate(() => {
      const el = document.activeElement
      return el?.closest('[data-cc-chips]') ? el.getAttribute('data-cc-chip-open') : null
    })
    if (!id) break
    stops.push(id)
    await page.keyboard.press('Tab')
  }
  return stops
}

const lookOf = (page, id) => page.locator(`[data-cc-chip="${id}"]`).getAttribute('data-cc-word-look')
const focusedOpen = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-cc-chip-open') ?? null)
const focusInSection = (page, name) =>
  page.evaluate((n) => !!document.activeElement?.closest(`[data-cc-section="${n}"]`), name)

const viewport = { width: 1440, height: 900 }
for (const mode of MODES) {
  const at = `${mode.theme}/${mode.dir}`
  console.log(`\n${at}`)
  const { context, page, errors, wire } = await open(mode, viewport)
  ok((await page.evaluate(() => document.documentElement.dir || 'ltr')) === mode.dir, `${at}: the document is ${mode.dir}`)

  // ---- 1. the sentence and the ledger, in their looks ----
  const sentence = (await page.locator('[data-cc-sentence]').innerText()).replace(/\s+/g, ' ').trim()
  ok(
    sentence ===
      `Deliver to Home · الملقا · الرياض for ${CALLER} from 1101 · الملقا at 18:00–21:00, cash on delivery.`,
    `${at}: the delivery sentence says the order`,
    sentence,
  )
  ok(
    (await page.locator('[data-cc-chips]').getAttribute('data-cc-sentence-shape')) === 'delivery',
    `${at}: the delivery shape`,
  )
  const ledger = (await page.locator('[data-cc-ledger]').innerText()).replace(/\s+/g, ' ').trim()
  ok(
    /^SOURCE CLCN REF CRM-889231 COUPON \+ coupon NOTE “Call before arrival/i.test(ledger),
    `${at}: the ledger lists Source · Ref · Coupon · Note, and an empty coupon reads "+ coupon"`,
    ledger,
  )
  ok(
    (await lookOf(page, 'slot')) === 'settled' &&
      (await lookOf(page, 'address')) === 'settled' &&
      (await lookOf(page, 'caller')) === 'readout' &&
      (await lookOf(page, 'store')) === 'readout' &&
      (await lookOf(page, 'coupon')) === 'ghost',
    `${at}: settled words, the two readouts and a ghost coupon`,
  )
  const settledBorder = await page
    .locator('[data-cc-chip="slot"]')
    .evaluate((el) => ({ style: getComputedStyle(el).borderTopStyle, width: getComputedStyle(el).borderTopWidth }))
  ok(settledBorder.style === 'solid' && settledBorder.width === '1px', `${at}: a settled word is bordered`, JSON.stringify(settledBorder))
  ok(
    (await page.locator('[data-cc-chip="caller"]').evaluate((el) => el.tagName)) === 'SPAN' &&
      (await page.locator('[data-cc-chip="store"]').evaluate((el) => el.tagName)) === 'SPAN',
    `${at}: the caller's name and the delivery store are plain words, not controls`,
  )
  const storeTitle = await page.locator('[data-cc-chip="store"]').getAttribute('title')
  ok(
    /follows the delivery address/.test(storeTitle ?? '') && (await page.locator('[data-cc-store-derived]').count()) === 1,
    `${at}: the delivery store's title says it follows the address`,
    storeTitle ?? 'none',
  )
  ok(
    (await page.locator('[data-cc-chip-open="store"]').count()) === 0,
    `${at}: and there is no store picker on a delivery order`,
  )

  // ---- 2. Tab follows the reading order ----
  const stops = await tabStops(page)
  ok(
    JSON.stringify(stops) ===
      JSON.stringify(['fulfilment', 'address', 'slot', 'payment', 'source', 'reference', 'coupon', 'note']),
    `${at}: Tab moves mode → address → window → payment, then Source → Ref → Coupon → Note`,
    JSON.stringify(stops),
  )
  // The sentence's controls sit on the page in the order Tab takes them (English copy, so
  // left to right on each line, whatever the document's direction).
  const placed = await page.locator('[data-cc-sentence] [data-cc-chip-open]').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { id: el.getAttribute('data-cc-chip-open'), top: Math.round(r.top), left: r.left }
    }),
  )
  const inReadingOrder = placed.every(
    (p, i) => i === 0 || p.top > placed[i - 1].top + 4 || (Math.abs(p.top - placed[i - 1].top) <= 4 && p.left > placed[i - 1].left),
  )
  ok(inReadingOrder, `${at}: each word stands where it is read`, JSON.stringify(placed))

  // ---- 3. Enter opens a section and moves focus in; Esc closes it and returns focus ----
  await page.locator('[data-cc-chip-open="note"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-cc-section="note"]').waitFor({ timeout: 5000 })
  ok(await focusInSection(page, 'note'), `${at}: Enter on the note opens its section, focus inside it`)
  ok(await page.locator('[data-cc-sentence]').isVisible(), `${at}: the sentence stays above the open section`)
  await page.screenshot({ path: `${SHOTS}/section-note-${mode.theme}-${mode.dir}.png` })
  await page.keyboard.press('Escape')
  await page.locator('[data-cc-section="note"]').waitFor({ state: 'detached', timeout: 5000 })
  ok((await focusedOpen(page)) === 'note', `${at}: Esc closes it and focus is back on the note`)

  await page.locator('[data-cc-chip-open="fulfilment"]').focus()
  await page.keyboard.press('Space')
  await page.locator('[data-cc-section="fulfilment"]').waitFor({ timeout: 5000 })
  ok(await focusInSection(page, 'fulfilment'), `${at}: Space on the mode word opens its section, focus inside it`)
  await page.keyboard.press('Escape')
  await page.locator('[data-cc-section="fulfilment"]').waitFor({ state: 'detached', timeout: 5000 })
  ok((await focusedOpen(page)) === 'fulfilment', `${at}: Esc returns focus to the mode word`)

  // ---- 4. an Arabic caller name, whole, between "for" and "from" ----
  const callerGeometry = await page.evaluate(() => {
    const p = document.querySelector('[data-cc-sentence]')
    const name = p.querySelector('[data-cc-chip="caller"] bdi')
    const rectOf = (word) => {
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.parentElement.closest('[data-cc-chip]')) continue
        const at = n.textContent.search(new RegExp(`\\b${word}\\b`))
        if (at < 0) continue
        const range = document.createRange()
        range.setStart(n, at)
        range.setEnd(n, at + word.length)
        return range.getBoundingClientRect()
      }
      return null
    }
    const forBox = rectOf('for')
    const fromBox = rectOf('from')
    const nameBox = name.getBoundingClientRect()
    return {
      text: name.textContent,
      pieces: name.getClientRects().length,
      for: forBox && { left: forBox.left, right: forBox.right, top: Math.round(forBox.top) },
      from: fromBox && { left: fromBox.left, right: fromBox.right, top: Math.round(fromBox.top) },
      name: { left: nameBox.left, right: nameBox.right, top: Math.round(nameBox.top) },
    }
  })
  ok(
    callerGeometry.text === CALLER && callerGeometry.pieces === 1,
    `${at}: the Arabic caller name is one whole run`,
    JSON.stringify(callerGeometry),
  )
  ok(
    !!callerGeometry.for &&
      !!callerGeometry.from &&
      callerGeometry.for.right <= callerGeometry.name.left + 1 &&
      callerGeometry.name.right <= callerGeometry.from.left + 1,
    `${at}: and it stands between "for" and "from"`,
    JSON.stringify(callerGeometry),
  )

  // ---- 5. the window reads 18:00–21:00 ----
  const window = await visualOf(page.locator('[data-cc-chip="slot"] [data-cc-chip-value]'))
  ok(
    window.logical === '18:00–21:00' && window.visual === '18:00–21:00' && window.isolate === 'ltr',
    `${at}: the window reads 18:00–21:00, one left-to-right isolate`,
    JSON.stringify(window),
  )
  const store = await visualOf(page.locator('[data-cc-chip="store"] [data-cc-chip-value]'))
  ok(
    store.isolate === 'ltr' && store.logical === '1101 · الملقا' && store.visual.startsWith('1101 ·'),
    `${at}: the store's code · name pair is one left-to-right isolate, code first`,
    JSON.stringify(store),
  )
  // ---- 5b. the same under an RTL SENTENCE ----
  // The sentence takes its own direction (`dir="auto"`), so these English strings lay out
  // left-to-right even on an RTL page and would read in order without any isolate. An
  // Arabic template's paragraph is right-to-left: stand in for it by setting the sentence
  // RTL, then prove the isolates are what keep the name whole and the window in order —
  // and that the measure CAN fail (the control strips the window's isolate).
  if (mode.dir === 'rtl') {
    await page.locator('[data-cc-sentence]').evaluate((p) => p.setAttribute('dir', 'rtl'))
    const rtlWindow = await visualOf(page.locator('[data-cc-chip="slot"] [data-cc-chip-value]'))
    ok(
      rtlWindow.visual === '18:00–21:00' && rtlWindow.isolate === 'ltr',
      `${at}: in a right-to-left sentence the window still reads 18:00–21:00`,
      JSON.stringify(rtlWindow),
    )
    const rtlName = await page.locator('[data-cc-chip="caller"] bdi').evaluate((el) => ({
      text: el.textContent,
      pieces: el.getClientRects().length,
    }))
    ok(rtlName.text === CALLER && rtlName.pieces === 1, `${at}: and the Arabic name is still one whole run`, JSON.stringify(rtlName))
    await page.locator('[data-cc-chip="slot"] [data-cc-chip-value]').evaluate((el) => {
      const bdi = el.querySelector('bdi')
      bdi?.replaceWith(document.createTextNode(bdi.textContent))
    })
    const bare = await visualOf(page.locator('[data-cc-chip="slot"] [data-cc-chip-value]'))
    ok(bare.visual === '21:00–18:00', `${at}: control — without its isolate the window reverses there`, JSON.stringify(bare))
    // Put the page back as it was: the rest of this pass drives the real render.
    await page.reload()
    await page.locator('[data-cc-sentence]').waitFor({ timeout: 20_000 })
    await page.waitForLoadState('networkidle')
  }
  await page.screenshot({ path: `${SHOTS}/delivery-${mode.theme}-${mode.dir}.png` })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${SHOTS}/delivery-${mode.theme}-${mode.dir}-1280.png` })
  await page.setViewportSize(viewport)

  // ---- 6a. the address word opens the address book ----
  await page.locator('[data-cc-chip-open="address"]').click()
  await page.locator('[data-cc-address-picker]').waitFor({ timeout: 5000 })
  ok(await page.locator('[data-cc-address-picker]').isVisible(), `${at}: the address word opens the address book`)
  await page.keyboard.press('Escape')
  await page.locator('[data-cc-address-picker]').waitFor({ state: 'hidden', timeout: 5000 })

  // ---- 6b. a mode flip rewrites the sentence ----
  await page.locator('[data-cc-chip-open="fulfilment"]').click()
  await page.locator('[data-cc-fulfilment-option="PickInStore"]').click()
  await page.locator('[data-cc-chips][data-cc-sentence-shape="collection"]').waitFor({ timeout: 5000 })
  const collection = (await page.locator('[data-cc-sentence]').innerText()).replace(/\s+/g, ' ').trim()
  ok(
    collection === `Collect from 1101 · الملقا for ${CALLER}, pay on collection.`,
    `${at}: the flip rewrites the sentence to the collection shape`,
    collection,
  )
  ok(
    (await page.locator('[data-cc-chip="address"]').count()) === 0 &&
      (await page.locator('[data-cc-chip="slot"]').count()) === 0,
    `${at}: the address and the window leave — absent, not disabled`,
  )
  ok(
    (await page.locator('[data-cc-chip-open="store"]').count()) === 1 && (await lookOf(page, 'store')) === 'blocked',
    `${at}: the store is now a control, blocked while the server says it is not chosen`,
  )
  const blockedBorder = await page
    .locator('[data-cc-chip="store"]')
    .evaluate((el) => getComputedStyle(el).borderTopStyle)
  ok(blockedBorder === 'dashed', `${at}: a blocked word is a dashed attention fill`, blockedBorder)
  ok(
    (await page.locator('[data-cc-store-derived]').count()) === 0,
    `${at}: the "follows the address" readout leaves with the address`,
  )
  const collectStops = await tabStops(page)
  ok(
    JSON.stringify(collectStops) ===
      JSON.stringify(['fulfilment', 'store', 'payment', 'source', 'reference', 'coupon', 'note']),
    `${at}: Tab follows the collection sentence: mode → store → payment, then the ledger`,
    JSON.stringify(collectStops),
  )
  await page.locator('[data-cc-chip-open="store"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-cc-section="store"]').waitFor({ timeout: 5000 })
  ok(await focusInSection(page, 'store'), `${at}: Enter on the store opens the store section`)
  await page.keyboard.press('Escape')
  await page.locator('[data-cc-section="store"]').waitFor({ state: 'detached', timeout: 5000 })
  ok((await focusedOpen(page)) === 'store', `${at}: Esc returns focus to the store word`)
  ok(wire.filter((p) => p === 'CallCenterWeb/SetFulfilment').length === 1, `${at}: one SetFulfilment on the wire`)
  await page.screenshot({ path: `${SHOTS}/collection-${mode.theme}-${mode.dir}.png` })

  ok((await page.locator('[data-cc-chip-open]').count()) > 0 && errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
  allErrors.push(...errors)
  await context.close()
}

ok(allErrors.length === 0, `nothing threw (${allErrors.length})`)
console.log('\n⚠ STUB: the open fixture with a caller, an address, a window and the bookkeeping set by this file.')
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
