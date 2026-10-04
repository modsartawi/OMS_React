// The call center console inside the rail shell (spec 380 C1, ticket 407) — drives the REAL app
// in Chromium, the wire stubbed at Playwright from the contract's own fixtures.
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/callcenter-shell-drive.mjs
//
// Asserts ticket 407's Proof, in light, dark and RTL, at 1280×720 and 1440×900:
//   1. the rail, the top bar and the store chip are on `/callcenter`, the crumb names the
//      console, and the rail sits at the inline-start edge (the right under RTL);
//   2. the rail starts collapsed (no stored preference) — and is never forced: a user who
//      pinned it open finds it open here too;
//   3. the caret lands on `cc-phone` on open — the shell's top bar does not take it;
//   4. the console fills the content area below the top bar and the page does not scroll;
//      the basket overflows and scrolls in its own column, and while it does the receipt,
//      its *Place order* and the page stay where they are;
//   5. Ctrl+K opens the core palette, once — one dialog, never the console's own.
// Screenshots → tools/.callcenter-shell-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5280}`
const SHOTS = 'tools/.callcenter-shell-shots'
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

/**
 * The opening order — no caller yet, so the caret's place is the phone box (165) — with a
 * basket long enough to overflow its column at both heights. ⚠ The lines are capture 02's
 * two priced lines repeated under fresh line ids; no capture holds an order this long.
 */
const OPENED = fixture('01-open-empty').state
const PRICED = fixture('02-two-lines-priced')
const LONG = {
  ...OPENED,
  lines: Array.from({ length: 14 }, (_, i) =>
    PRICED.lines.map((line) => ({ ...line, lineId: `${line.lineId}-${i}` })),
  ).flat(),
  totals: PRICED.totals,
}

const MODES = [
  { theme: 'light', dir: 'ltr' },
  { theme: 'dark', dir: 'ltr' },
  { theme: 'light', dir: 'rtl' },
]
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]

const browser = await chromium.launch()
const allErrors = []

async function open({ theme, dir }, viewport, { railPinnedOpen = false } = {}) {
  const context = await browser.newContext({ viewport })
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
  await page.addInitScript(
    ([t, d, pinned]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      // The rail's own key, written as its toggle writes it — or not at all.
      if (pinned) localStorage.setItem('oms.railExpanded', 'true')
    },
    [theme, dir, railPinnedOpen],
  )
  await page.route('**/api/**', (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state: LONG, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(LONG))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  return { context, page, errors }
}

const box = (page, selector) => page.locator(selector).first().boundingBox()

for (const mode of MODES)
  for (const viewport of SIZES) {
    const at = `${mode.theme}/${mode.dir} ${viewport.width}`
    console.log(`\n${at}`)
    const { context, page, errors } = await open(mode, viewport)

    // ---- 1. the shell is around the console ----
    ok(await page.locator('#layout-rail').isVisible(), `${at}: the rail is on /callcenter`)
    ok(await page.locator('#layout-topbar').isVisible(), `${at}: the top bar is on /callcenter`)
    const chip = page.locator('#layout-topbar [data-store-chip="set"]')
    ok((await chip.isVisible()) && /1001/.test(await chip.innerText()), `${at}: the store chip names the acting store`)
    const crumb = (await page.locator('[data-crumb]').innerText()).replace(/\s+/g, ' ')
    ok(/Call center/.test(crumb) && /Console/.test(crumb), `${at}: the crumb names the console from the menu`, crumb)
    ok((await page.locator('#layout-topbar [data-palette-field]').count()) === 1, `${at}: the top bar carries the palette field`)
    ok((await page.locator('main').count()) === 1, `${at}: one main landmark — the console's centre is not a second`)
    const rail = await box(page, '#layout-rail')
    const consoleBox = await box(page, '[data-cc-console]')
    const startEdge =
      mode.dir === 'rtl'
        ? Math.abs(rail.x + rail.width - viewport.width) <= 1 && consoleBox.x + consoleBox.width <= rail.x + 1
        : Math.abs(rail.x) <= 1 && consoleBox.x >= rail.x + rail.width - 1
    ok(startEdge, `${at}: the rail sits at the inline-start edge, the console beside it`, JSON.stringify({ rail, consoleBox }))

    // ---- 2. collapsed by default ----
    ok(
      (await page.locator('#layout-rail').getAttribute('data-rail')) === 'collapsed' && Math.round(rail.width) === 56,
      `${at}: the rail starts collapsed (56px)`,
      `${await page.locator('#layout-rail').getAttribute('data-rail')} ${rail.width}`,
    )

    // ---- 3. the caret ----
    ok(
      await page.evaluate(() => document.activeElement?.id === 'cc-phone'),
      `${at}: the caret lands on cc-phone on open`,
      await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80) ?? 'none'),
    )

    // ---- 4. the console fills the content area; its columns scroll, the page does not ----
    const bar = await box(page, '#layout-topbar')
    ok(
      Math.round(bar.height) === 44 &&
        Math.abs(consoleBox.y - (bar.y + bar.height)) <= 1 &&
        Math.abs(consoleBox.y + consoleBox.height - viewport.height) <= 1,
      `${at}: the console fills the content area below the 44px top bar`,
      JSON.stringify({ bar, consoleBox }),
    )
    const pageScroll = () =>
      page.evaluate(() => ({
        overflow: document.scrollingElement.scrollHeight - window.innerHeight,
        y: window.scrollY,
      }))
    ok((await pageScroll()).overflow <= 0, `${at}: the page has nothing to scroll`, JSON.stringify(await pageScroll()))

    const basket = page.locator('[data-cc-basket]')
    const overflowing = await basket.evaluate((el) => el.scrollHeight > el.clientHeight + 1)
    ok(overflowing, `${at}: the long basket overflows its own column`)
    const receiptBefore = await box(page, '[data-cc-receipt]')
    const submitBefore = await box(page, '[data-cc-submit]')
    await page.locator('[data-cc-line]').first().hover()
    await page.mouse.wheel(0, 2000)
    await page.waitForTimeout(250)
    const basketTop = await basket.evaluate((el) => el.scrollTop)
    const receiptAfter = await box(page, '[data-cc-receipt]')
    const submitAfter = await box(page, '[data-cc-submit]')
    ok(basketTop > 0, `${at}: the wheel over the basket scrolls the basket`, `scrollTop ${basketTop}`)
    ok(
      JSON.stringify(receiptAfter) === JSON.stringify(receiptBefore) &&
        JSON.stringify(submitAfter) === JSON.stringify(submitBefore) &&
        submitAfter.y + submitAfter.height <= viewport.height,
      `${at}: the receipt and its Place order stay put while the basket scrolls`,
      JSON.stringify({ receiptBefore, receiptAfter, submitAfter }),
    )
    ok((await pageScroll()).y === 0, `${at}: the page itself did not scroll`)
    // The receipt's own scroller is a column of its own, bounded inside the viewport.
    const receiptScroller = await page
      .locator('[data-cc-receipt] > div.overflow-auto')
      .evaluate((el) => ({ overflowY: getComputedStyle(el).overflowY, bottom: el.getBoundingClientRect().bottom }))
    ok(
      receiptScroller.overflowY === 'auto' && receiptScroller.bottom <= viewport.height,
      `${at}: the receipt scrolls in its own column`,
      JSON.stringify(receiptScroller),
    )
    await page.screenshot({ path: `${SHOTS}/console-${mode.theme}-${mode.dir}-${viewport.width}.png` })

    // ---- 5. Ctrl+K: the core palette, once ----
    await page.locator('#cc-phone').focus()
    await page.keyboard.press('Control+k')
    await page.locator('[data-palette]').waitFor({ timeout: 5000 })
    await page.waitForTimeout(150)
    ok(
      (await page.locator('[data-palette]').count()) === 1 &&
        (await page.locator('dialog[open]').count()) === 1 &&
        (await page.locator('[data-cc-palette]').count()) === 0,
      `${at}: Ctrl+K opens the core palette once`,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    ok(
      (await page.locator('dialog[open]').count()) === 0 &&
        (await page.evaluate(() => document.activeElement?.id === 'cc-phone')),
      `${at}: Esc closes it and the caret is back in cc-phone`,
    )

    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }

// ---- 2b. never forced: the user's own pinned-open preference applies here too ----
for (const mode of [MODES[0], MODES[2]]) {
  const at = `${mode.theme}/${mode.dir} 1440 pinned open`
  console.log(`\n${at}`)
  const { context, page, errors } = await open(mode, SIZES[1], { railPinnedOpen: true })
  const rail = await box(page, '#layout-rail')
  ok(
    (await page.locator('#layout-rail').getAttribute('data-rail')) === 'expanded' && Math.round(rail.width) === 240,
    `${at}: a rail the user pinned open stays open on /callcenter`,
    `${rail.width}`,
  )
  ok(
    await page.evaluate(() => document.activeElement?.id === 'cc-phone'),
    `${at}: and the caret still lands on cc-phone`,
  )
  const consoleBox = await box(page, '[data-cc-console]')
  ok(
    Math.abs(consoleBox.y + consoleBox.height - SIZES[1].height) <= 1 &&
      (await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight)),
    `${at}: the console still fills the content area with no page scroll`,
  )
  await page.screenshot({ path: `${SHOTS}/console-pinned-${mode.theme}-${mode.dir}-1440.png` })
  ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
  allErrors.push(...errors)
  await context.close()
}

ok(allErrors.length === 0, `nothing threw (${allErrors.length})`)
console.log('\n⚠ STUB: the long basket repeats capture 02’s two lines under fresh line ids.')
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
