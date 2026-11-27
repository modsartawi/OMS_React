// The console in three columns with the step rail and the *Before you place it* checklist
// (spec 983 D1/D3/D9, ticket 984) — drives the REAL app in Chromium, the wire stubbed at
// Playwright from the contract's own fixtures.
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. DRIVE_PORT=5201 node tools/callcenter-rail-drive.mjs
//
// Asserts ticket 984's drive proof, light/LTR at 1366, 1280 and 1024 wide and RTL at 1366:
//   1. no sideways scroll — not the page, not the console, not a column;
//   2. three columns (caller · order · summary) from 1280 up, stacked in that order below;
//   3. the rail reads five steps in order, each with its own answer, green when done and
//      amber while missing — and its Review step agrees with the checklist;
//   4. the checklist names each server blocker once, and *Place order* is disabled while
//      any remains; on a ready order every step is green and *Place order* is live;
//   5. a step click focuses its section (caller → the phone box, items → the search,
//      fulfilment → the sentence's address word, review → the checklist).
// Screenshots → tools/.callcenter-rail-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`
const SHOTS = 'tools/.callcenter-rail-shots'
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

/** Fixture 01: the opened, empty order — six blockers. */
const OPENED = fixture('01-open-empty').state
/**
 * Fixture 02 settled by hand: an address and a slot, nothing blocking, `canSubmit`.
 * ⚠ No capture holds a ready-to-place order; the address and slot are stubbed.
 */
const PRICED = fixture('02-two-lines-priced')
const READY = {
  ...PRICED,
  header: {
    ...PRICED.header,
    address: {
      addressNumber: '2',
      label: 'Home',
      cityCode: 'RUH',
      cityName: 'Riyadh',
      districtCode: '011',
      districtName: 'Malqa',
      line: 'King Fahd Rd',
    },
    slot: { slotId: 'S16', from: '16:00', to: '18:00', isActive: true },
  },
  capabilities: { ...PRICED.capabilities, submitBlockers: [], canSubmit: true },
}

const browser = await chromium.launch()

async function open(state, { width, height = 768, dir = 'ltr' }) {
  const context = await browser.newContext({ viewport: { width, height } })
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

const box = (page, selector) => page.locator(selector).first().boundingBox()

/** Nothing scrolls sideways: the page, the console, its column grid or any column. */
async function noSideways(page, at) {
  const over = await page.evaluate(() => {
    const els = [
      document.scrollingElement,
      ...document.querySelectorAll('[data-cc-console], [data-cc-columns], [data-cc-col], [data-cc-receipt]'),
    ]
    return els
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.getAttribute('data-cc-col') ?? el.tagName}:${el.scrollWidth}>${el.clientWidth}`)
  })
  ok(over.length === 0, `${at}: nothing scrolls sideways`, over.join(', '))
}

async function layout(page, at, { width, dir = 'ltr' }, name) {
  const caller = await box(page, '[data-cc-col="caller"]')
  const order = await box(page, '[data-cc-col="order"]')
  const summary = await box(page, '[data-cc-receipt]')
  const rtl = dir === 'rtl'
  if (width >= 1280) {
    const inOrder = rtl
      ? caller.x > order.x && order.x > summary.x
      : caller.x < order.x && order.x < summary.x
    ok(
      inOrder && Math.abs(caller.y - order.y) <= 1 && Math.abs(order.y - summary.y) <= 1,
      `${at}: three columns side by side — caller, order, summary from the inline start`,
      JSON.stringify({ caller, order, summary }),
    )
  } else {
    ok(
      caller.y < order.y && order.y < summary.y && Math.abs(caller.width - order.width) <= 1,
      `${at}: below 1280 the columns stack — caller, then order, then summary`,
      JSON.stringify({ caller, order, summary }),
    )
    // Stacked, the summary is drawn whole (never squeezed to its heading), and scrolling
    // the console down brings *Place order* into view.
    const squeezed = await page
      .locator('[data-cc-receipt] > div.overflow-auto')
      .evaluate((el) => el.scrollHeight > el.clientHeight + 1)
    await page.locator('[data-cc-columns]').evaluate((el) => (el.scrollTop = el.scrollHeight))
    await page.waitForTimeout(100)
    const submit = await box(page, '[data-cc-submit]')
    ok(
      !squeezed && submit && submit.y >= 0 && submit.y + submit.height <= page.viewportSize().height,
      `${at}: stacked, the summary is whole and Place order scrolls into view`,
      JSON.stringify({ squeezed, submit }),
    )
    await page.screenshot({ path: `${SHOTS}/${name}-${dir}-${width}-bottom.png` })
    await page.locator('[data-cc-columns]').evaluate((el) => (el.scrollTop = 0))
  }
  // A clipped control is sideways overflow the scroll widths cannot see (the caller bar
  // clips its own row): every control in the caller column sits wholly inside it.
  const clipped = await page.evaluate(() => {
    const col = document.querySelector('[data-cc-col="caller"]').getBoundingClientRect()
    return [...document.querySelectorAll('[data-cc-col="caller"] button, [data-cc-col="caller"] input')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && (r.left < col.left - 1 || r.right > col.right + 1))
      .map((r) => `${Math.round(r.left)}–${Math.round(r.right)}`)
  })
  ok(clipped.length === 0, `${at}: every caller-column control fits inside the column`, clipped.join(', '))
  // The rail sits above the item search, inside the order column.
  const rail = await box(page, '[data-cc-rail]')
  const search = await box(page, '#cc-item-search')
  ok(
    rail && rail.x >= order.x - 1 && rail.x + rail.width <= order.x + order.width + 1 && (!search || rail.y < search.y),
    `${at}: the step rail heads the order column, above the item search`,
    JSON.stringify({ rail, search }),
  )
}

const railRead = (page) =>
  page.locator('[data-cc-rail-step]').evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-cc-rail-step'),
      state: el.getAttribute('data-cc-rail-state'),
      answer: el.querySelector('[data-cc-rail-answer]').textContent.replace(/[\u2066-\u2069]/g, '').trim(),
    })),
  )

const checkRead = (page) =>
  page.locator('[data-cc-check]').evaluateAll((els) =>
    els.map((el) => ({
      id: el.getAttribute('data-cc-check'),
      state: el.getAttribute('data-cc-check-state'),
      codes: el.getAttribute('data-cc-check-codes'),
      text: el.textContent.trim(),
    })),
  )

const activeIs = (page, predicate) => page.evaluate(predicate)

for (const viewport of [
  { width: 1366 },
  { width: 1280 },
  { width: 1024 },
  { width: 1366, dir: 'rtl' },
]) {
  const at = `${viewport.dir ?? 'ltr'} ${viewport.width}`

  // ---- the opened, empty order ----
  console.log(`\n${at} — opened order (fixture 01)`)
  {
    const { context, page, errors } = await open(OPENED, viewport)
    await noSideways(page, at)
    await layout(page, at, viewport, 'opened')

    const rail = await railRead(page)
    ok(
      rail.map((s) => s.id).join() === 'caller,items,fulfilment,payment,review',
      `${at}: the rail reads Caller · Items · Fulfilment · Payment · Review`,
      JSON.stringify(rail),
    )
    ok(
      rail.map((s) => s.state).join() === 'missing,missing,missing,done,missing',
      `${at}: amber everywhere but Payment, which the order holds from the start`,
      JSON.stringify(rail),
    )
    if (!viewport.dir) {
      ok(
        rail[0].answer === 'No caller yet' &&
          rail[2].answer === 'No address yet' &&
          rail[3].answer === 'cash on delivery' &&
          rail[4].answer === '6 things left',
        `${at}: each step shows its own answer`,
        JSON.stringify(rail.map((s) => s.answer)),
      )
    }
    const tone = await page
      .locator('[data-cc-rail-step="payment"]')
      .evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderColor])
    const amber = await page
      .locator('[data-cc-rail-step="caller"]')
      .evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderColor])
    ok(tone[0] !== amber[0], `${at}: a done step and a missing one are drawn in different tones`, JSON.stringify({ tone, amber }))

    const rows = await checkRead(page)
    const missing = rows.filter((r) => r.state === 'missing')
    ok(
      missing.map((r) => r.codes).sort().join() ===
        OPENED.capabilities.submitBlockers.slice().sort().join(),
      `${at}: the checklist names each of the six server blockers once`,
      JSON.stringify(rows),
    )
    ok(
      (await page.locator('[data-cc-checklist="blocked"]').count()) === 1 &&
        (await page.locator('[data-cc-submit]').isDisabled()),
      `${at}: Place order is disabled while the checklist has rows left`,
    )

    // ---- step clicks focus their sections ----
    await page.locator('[data-cc-rail-step="review"]').click()
    ok(
      await activeIs(page, () => document.activeElement?.id === 'cc-checklist'),
      `${at}: Review focuses the checklist`,
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)),
    )
    await page.locator('[data-cc-rail-step="fulfilment"]').click()
    ok(
      await activeIs(page, () => document.activeElement?.closest('[data-cc-chip]')?.getAttribute('data-cc-chip') === 'address'),
      `${at}: Fulfilment focuses the first thing it is missing — the address word`,
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 100)),
    )
    await page.locator('[data-cc-rail-step="caller"]').click()
    ok(
      await activeIs(page, () => document.activeElement?.id === 'cc-phone'),
      `${at}: Caller focuses the phone box`,
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)),
    )
    await page.screenshot({ path: `${SHOTS}/opened-${viewport.dir ?? 'ltr'}-${viewport.width}.png`, fullPage: true })
    ok(errors.length === 0, `${at}: no console errors`, errors.join(' | '))
    await context.close()
  }

  // ---- the ready order ----
  console.log(`\n${at} — ready order (fixture 02, settled)`)
  {
    const { context, page, errors } = await open(READY, viewport)
    await noSideways(page, at)
    await layout(page, at, viewport, 'ready')
    const rail = await railRead(page)
    ok(rail.every((s) => s.state === 'done'), `${at}: every step is green`, JSON.stringify(rail))
    if (!viewport.dir) {
      ok(
        rail[0].answer === 'Redacted Customer' &&
          rail[1].answer === '2 items' &&
          rail[2].answer === 'Home · 16:00–18:00' &&
          rail[4].answer === 'Ready to place',
        `${at}: the answers read the order — "Home · 16:00–18:00"`,
        JSON.stringify(rail.map((s) => s.answer)),
      )
    }
    const rows = await checkRead(page)
    ok(
      rows.length > 0 && rows.every((r) => r.state === 'done') && (await page.locator('[data-cc-checklist="ready"]').count()) === 1,
      `${at}: the checklist is clear`,
      JSON.stringify(rows),
    )
    ok(!(await page.locator('[data-cc-submit]').isDisabled()), `${at}: Place order is live`)
    await page.locator('[data-cc-rail-step="items"]').click()
    ok(
      await activeIs(page, () => document.activeElement?.id === 'cc-item-search'),
      `${at}: Items focuses the item search`,
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)),
    )
    await page.locator('[data-cc-rail-step="payment"]').click()
    ok(
      await activeIs(page, () => document.activeElement?.closest('[data-cc-chip]')?.getAttribute('data-cc-chip') === 'payment'),
      `${at}: Payment focuses the payment word`,
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 100)),
    )
    await page.screenshot({ path: `${SHOTS}/ready-${viewport.dir ?? 'ltr'}-${viewport.width}.png`, fullPage: true })
    ok(errors.length === 0, `${at}: no console errors`, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
