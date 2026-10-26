// DMSCO theme drive (spec 590, ticket 591) — THE theme drive. It walks a list of
// screens in every mode (light, dark, RTL) and proves, on the real painted DOM:
//   - controls resolve to their ROLE tokens, read through computed style and
//     compared with the same token resolved on the same live document — never a
//     pinned hex. The contrast gate (`tools/check-contrast.mjs`) owns the values;
//     this drive owns "the screen actually paints from them";
//   - navigating links in primary ink carry an underline (590: `--primary` is
//     nearly the body ink, so the underline is what marks a link);
//   - h-7 controls are full pills (`--radius: 1rem`), the grid wrapper stays 8px;
//   - the Deliveries list shows as many rows at 1568×744 as before the theme (584: nothing gets bigger).
// It saves one screenshot per screen per mode for review → tools/.dmsco-theme-shots/.
//
// GROWING IT (592 shell, 594 buttons/chips, 595 fields, 597–605 area screens):
//   - a new MODE (rail collapsed, phone drawer) is one entry in MODES;
//   - a new SCREEN is one entry in SCREENS: { key, path, stubs?, ready, assert };
//   - assertions are the helpers in the "assertion helpers" block — reuse them,
//     add a helper there rather than inlining a probe in a screen.
// `SCREENS=deliveries,shell` and `MODES=dark` env vars narrow a run.
//
// Every `/api/**` call is stubbed (the delivery list needs a store grant a dev
// session lacks) — mocked data, real app, real browser, real CSS.
//
//   1. run the app:  npx vite --port 5291
//   2. node tools/dmsco-theme-drive.mjs        (DRIVE_PORT=… for another port)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5291}`
const SHOTS = 'tools/.dmsco-theme-shots'
mkdirSync(SHOTS, { recursive: true })

// --- results -----------------------------------------------------------------

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const skipped = []
const skip = (what) => {
  skipped.push(what)
  console.log(`  SKIP  ${what}`)
}

// --- stubs -------------------------------------------------------------------

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const DELIVERY = (i) => ({
  deliveryNo: String(8000001 + i),
  documentNo: String(1000000393 + i),
  deliveryDocumentType: 'LF',
  orderNo: String(900001 + i),
  storeCode: '1001',
  documentDate: '2026-07-01T00:00:00',
  deliveryType: 'P',
  documentType: 'CLCN',
  documentSource: 'W',
  entryTime: '2026-07-01T09:12:00',
  isActiveInStore: true,
  timeSlotDescription: '10:00 - 12:00',
  customerName: i % 3 === 0 ? 'عميل تجريبي' : 'Test Customer',
  customerPhone: '0500000000',
  netTotal: 120.5 + i,
  paidAmount: 120.5 + i,
  deliveryFees: 10,
  amountDue: 0,
  failedJobsCount: i % 7 === 0 ? 2 : 0,
})

// Shared stubs every screen gets: [pathRegex, data]. A screen adds its own in
// `stubs` (same shape, checked first). `data` may be a function of the path.
const COMMON_STUBS = [
  [/^Auth\/Me$/, { authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }],
  // Every screen-open probe answers yes so every menu entry and screen is reachable.
  [
    /Access$/,
    { screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true },
  ],
  [/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/, []],
  [/^SdDocumentWeb\/DeliveryDocumentList$/, Array.from({ length: 60 }, (_, i) => DELIVERY(i))],
]

const routeApi = (screenStubs) => async (route) => {
  const path = route.request().url().split('/api/')[1].split('?')[0]
  for (const [re, data] of [...screenStubs, ...COMMON_STUBS]) {
    if (re.test(path)) return route.fulfill(envelope(typeof data === 'function' ? data(path) : data))
  }
  // Anything else (notifications, slots, …) → benign empty success.
  return route.fulfill(envelope({}))
}

// --- modes -------------------------------------------------------------------

// Theme, direction and rail state are boot facts: index.html's pre-paint script
// reads them from localStorage, so they are set before the app boots.
const MODES = [
  { key: 'light', theme: 'light', dir: 'ltr' },
  { key: 'dark', theme: 'dark', dir: 'ltr' },
  { key: 'rtl', theme: 'light', dir: 'rtl' },
]

const VIEWPORT = { width: 1568, height: 744 }

// The Deliveries list's fully visible rows at VIEWPORT BEFORE the theme, measured
// by this drive's own `visibleGridRows` on the pre-591 stylesheet (spec 590's
// tip 18f21c2c, stubbed). The theme must not cost a row (584). Ticket 591 quotes
// 19 — 584's staging figure, taken on the prototype — but the stubbed app on the
// pre-theme stylesheet shows 15 here; see ticket 591's Comments.
const BEFORE_THEME_ROWS = 15

const browser = await chromium.launch()

async function openPage(mode, screen) {
  const context = await browser.newContext({ viewport: screen.viewport || VIEWPORT })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(
    ([t, d, rail]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
      if (rail !== undefined) localStorage.setItem('oms.railExpanded', String(rail))
    },
    [mode.theme, mode.dir, mode.railExpanded],
  )
  await page.route('**/api/**', routeApi(screen.stubs || []))
  return { context, page, errors }
}

// --- probes ------------------------------------------------------------------

// Resolve any colour expression (a `var(--token)`, hex, rgb) on the LIVE
// document to the browser's canonical rgb() string. Both sides of every colour
// assertion go through this, so a check reads "element == role token".
const asColor = (page, expr) =>
  page.evaluate((e) => {
    const probe = document.createElement('div')
    probe.style.color = e
    document.body.appendChild(probe)
    const v = getComputedStyle(probe).color
    probe.remove()
    return v
  }, expr)
const token = (page, name) => asColor(page, `var(${name})`)

// Computed style of the first element matching `selector` (null if none).
// A trailing `::before` / `::after` reads that pseudo-element (v36 paints the
// grid header ground on `.ag-header-row::after`).
const styleOf = (page, selector, props) =>
  page.evaluate(
    ([full, ps]) => {
      const [sel, pseudo] = full.split(/(?=::(?:before|after)$)/)
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el, pseudo || null)
      const r = el.getBoundingClientRect()
      return Object.fromEntries([...ps.map((p) => [p, cs.getPropertyValue(p)]), ['rect', { x: r.x, y: r.y, w: r.width, h: r.height }]])
    },
    [selector, props],
  )

// --- assertion helpers (reuse these; add new ones here) ----------------------

// `selector`'s CSS `prop` paints the role `tokenName`. `prop` is a colour
// property (background-color, color, border-*-color, outline-color, …).
async function expectRole(ctx, label, selector, prop, tokenName) {
  const { page, tag } = ctx
  const got = await styleOf(page, selector, [prop])
  if (!got) return check(`${tag} ${label}: ${selector} present`, false)
  const want = await token(page, tokenName)
  check(`${tag} ${label}: ${prop} is ${tokenName}`, got[prop] === want, `${got[prop]} vs ${want}`)
}

// Two role tokens resolve to the same colour in this mode (e.g. dark `--ring`
// is the gold). Role-to-role, never role-to-hex.
async function expectSameRole(ctx, label, a, b) {
  const [x, y] = [await token(ctx.page, a), await token(ctx.page, b)]
  check(`${ctx.tag} ${label}: ${a} is ${b}`, x === y, `${x} vs ${y}`)
}

// The control is a full pill: its corner radius is at least half its height.
async function expectPill(ctx, label, selector) {
  const got = await styleOf(ctx.page, selector, ['border-start-start-radius', 'border-end-end-radius'])
  if (!got) return check(`${ctx.tag} ${label}: ${selector} present`, false)
  const r = Math.min(parseFloat(got['border-start-start-radius']), parseFloat(got['border-end-end-radius']))
  check(`${ctx.tag} ${label}: full pill`, r >= got.rect.h / 2 - 0.5, `radius ${r}px, height ${got.rect.h}px`)
}

// The element's corner radius is exactly `px`.
async function expectRadius(ctx, label, selector, px) {
  const got = await styleOf(ctx.page, selector, ['border-start-start-radius'])
  if (!got) return check(`${ctx.tag} ${label}: ${selector} present`, false)
  check(`${ctx.tag} ${label}: radius ${px}px`, parseFloat(got['border-start-start-radius']) === px, got['border-start-start-radius'])
}

// Keyboard focus on `selector` draws the `--ring` outline.
async function expectFocusRing(ctx, label, selector) {
  const { page } = ctx
  // Real keyboard navigation, so the browser grants :focus-visible: focus the
  // control, step off it and back with the keyboard.
  await page.locator(selector).first().focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  // `transition-colors` animates outline-color too: read after it settles.
  await page.waitForTimeout(300)
  await expectRole(ctx, `${label} focused`, selector, 'outline-color', '--ring')
  await page.evaluate(() => document.activeElement?.blur())
}

// Every navigating link in primary ink (`--primary` / `--primary-800`) inside
// `scope` is underlined. A probe link is also planted in `scope`, so the
// shared rule itself is proven even on a screen that has no link of its own;
// the count of real links is reported so a vacuous pass is visible.
async function expectLinksUnderlined(ctx, scope = 'body') {
  const { page, tag } = ctx
  const inks = [await token(page, '--primary'), await token(page, '--primary-800')]
  const out = await page.evaluate(
    ([sc, inks]) => {
      const root = document.querySelector(sc)
      const probe = document.createElement('a')
      probe.href = '#dmsco-probe'
      probe.className = 'text-primary'
      probe.textContent = 'probe'
      probe.setAttribute('data-dmsco-probe', '')
      root.appendChild(probe)
      const links = [...root.querySelectorAll('a[href]')].filter((a) => inks.includes(getComputedStyle(a).color))
      const bare = links.filter((a) => !getComputedStyle(a).textDecorationLine.includes('underline'))
      const probeOk = getComputedStyle(probe).textDecorationLine.includes('underline') && inks.includes(getComputedStyle(probe).color)
      probe.remove()
      return { real: links.length - 1, bare: bare.filter((a) => a !== probe).map((a) => a.textContent.trim().slice(0, 30)), probeOk }
    },
    [scope, inks],
  )
  check(`${tag} links: the shared rule underlines a primary-ink link`, out.probeOk)
  check(`${tag} links: every real primary-ink link underlined`, out.bare.length === 0, `${out.real} real link(s)${out.bare.length ? '; bare: ' + out.bare.join(' | ') : ''}`)
}

// Rows of a grid that are on screen: `full` lie wholly inside the body viewport,
// `partial` touch it at all (`full` + a row cut by the bottom edge).
async function visibleGridRows(page, gridSelector = '.ag-root-wrapper') {
  return page.evaluate((sel) => {
    const grid = document.querySelector(sel)
    // The body viewport is the first ancestor of a data row that clips
    // vertically — found by behaviour, not by an AG Grid class name (v36 moved
    // them: header rows are `.ag-row.ag-header-row` inside the same viewport).
    // The visible band starts under the last header row.
    const first = grid?.querySelector('.ag-row[row-index]:not(.ag-header-row)')
    let vp = first?.parentElement
    while (vp && vp !== grid && !/(auto|scroll|hidden)/.test(getComputedStyle(vp).overflowY)) vp = vp.parentElement
    if (!vp || vp === grid) return { full: -1, partial: -1 }
    const box = vp.getBoundingClientRect()
    const heads = [...grid.querySelectorAll('.ag-header-row')].map((h) => h.getBoundingClientRect().bottom)
    const top = Math.max(box.top, ...heads)
    // One entry per row index: a pinned column renders the same row twice.
    const byIndex = new Map()
    for (const r of grid.querySelectorAll('.ag-row[row-index]:not(.ag-header-row)')) {
      const b = r.getBoundingClientRect()
      if (b.height > 0) byIndex.set(r.getAttribute('row-index'), b)
    }
    const rows = [...byIndex.values()]
    return {
      full: rows.filter((b) => b.top >= top - 0.5 && b.bottom <= box.bottom + 0.5).length,
      partial: rows.filter((b) => b.bottom > top + 0.5 && b.top < box.bottom - 0.5).length,
    }
  }, gridSelector)
}

// The shell, on whatever screen is open: page ground, top bar, rail, direction.
async function assertShell(ctx, { activeRail = true } = {}) {
  const { page, mode, tag } = ctx
  await expectRole(ctx, 'page', 'body', 'background-color', '--background')
  await expectRole(ctx, 'page', 'body', 'color', '--foreground')
  await expectRole(ctx, 'top bar', 'header', 'background-color', '--card')
  await expectRole(ctx, 'top bar', 'header', 'border-bottom-color', '--border')
  // 592 turns the rail ground into the radial gradient; it rewrites this line.
  await expectRole(ctx, 'rail', 'aside[data-rail]', 'background-color', '--rail')
  await expectRole(ctx, 'rail', 'aside[data-rail]', 'color', '--rail-foreground')
  if (activeRail) {
    // Expanded: the leaf carries aria-current. Collapsed: the lit group icon
    // inside the `[data-active]` row. 592 turns this into the filled navy pill.
    const active = (await page.$('aside[data-rail] [aria-current="page"]'))
      ? 'aside[data-rail] [aria-current="page"]'
      : 'aside[data-rail] [data-active] > *'
    await expectRole(ctx, 'rail active item', active, 'background-color', '--rail-accent')
    await expectRole(ctx, 'rail active item', active, 'color', '--rail-accent-foreground')
  }
  // The ring/cursor roles per theme: navy in light, the one gold in dark.
  if (mode.theme === 'dark') {
    await expectSameRole(ctx, 'ring', '--ring', '--gold')
    await expectSameRole(ctx, 'cursor', '--cursor', '--gold')
  } else {
    await expectSameRole(ctx, 'ring', '--ring', '--primary')
    await expectSameRole(ctx, 'cursor', '--cursor', '--primary')
  }
  const dir = await page.evaluate(() => document.documentElement.dir || 'ltr')
  check(`${tag} direction is ${mode.dir}`, dir === mode.dir, dir)
  const rail = await styleOf(page, 'aside[data-rail]', [])
  if (rail) {
    const atStart = mode.dir === 'rtl' ? rail.rect.x + rail.rect.w >= VIEWPORT.width - 1 : rail.rect.x <= 1
    check(`${tag} rail sits at inline-start`, atStart, `x ${rail.rect.x}, w ${rail.rect.w}`)
  }
}

// --- screens -----------------------------------------------------------------

async function loadDeliveries(page) {
  await page.goto(BASE + '/oms/deliveries')
  await page.waitForSelector('[data-query-search]', { timeout: 20000 }).catch(() => {})
  await page.locator('[data-query-search]').first().click().catch(() => {})
  await page.mouse.move(0, 0) // off the Search button: its hover ground is primary/85
  await page.waitForSelector('.ag-center-cols-container .ag-row', { timeout: 20000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

const SCREENS = [
  {
    key: 'shell',
    path: '/',
    ready: async (page) => {
      await page.goto(BASE + '/')
      await page.waitForSelector('aside[data-rail]', { timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(400)
    },
    assert: async (ctx) => {
      // Home is no menu entry, so no rail item is active here.
      await assertShell(ctx, { activeRail: false })
      await expectLinksUnderlined(ctx, 'main')
    },
  },
  {
    key: 'deliveries',
    path: '/oms/deliveries',
    ready: loadDeliveries,
    assert: async (ctx) => {
      const { page, tag } = ctx
      await assertShell(ctx)
      const search = '[data-query-search]'
      await expectRole(ctx, 'Search (primary Button)', search, 'background-color', '--primary')
      await expectRole(ctx, 'Search (primary Button)', search, 'color', '--primary-foreground')
      await expectPill(ctx, 'Search (h-7 Button)', search)
      await expectFocusRing(ctx, 'Search', search)
      await expectRole(ctx, 'grid', '.ag-header-row::after', 'background-color', '--grid-head')
      await expectRole(ctx, 'grid', '.ag-row:not(.ag-header-row) .ag-cell', 'color', '--foreground')
      await expectRadius(ctx, 'grid wrapper', '.ag-root-wrapper', 8)
      await expectLinksUnderlined(ctx, 'main')
      const rows = await visibleGridRows(page)
      check(
        `${tag} Deliveries list shows ${BEFORE_THEME_ROWS} rows at ${VIEWPORT.width}×${VIEWPORT.height}, as before the theme`,
        rows.full === BEFORE_THEME_ROWS,
        JSON.stringify(rows),
      )
    },
  },
]

// --- 594: Button / IconButton / Chip on the Deliveries list -------------------
// Self-contained: its helpers and its screen live in this block and the screen
// is pushed onto SCREENS, so sibling tickets' blocks merge beside it.

// Every element matching `selector` is a full pill (radius ≥ half its height).
// Reports the count so a vacuous pass is visible.
async function expectAllPills(ctx, label, selector) {
  const out = await ctx.page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0)
    const bad = els.filter((e) => {
      const cs = getComputedStyle(e)
      const r = Math.min(parseFloat(cs.borderStartStartRadius), parseFloat(cs.borderEndEndRadius))
      return r < e.getBoundingClientRect().height / 2 - 0.5
    })
    return { n: els.length, bad: bad.map((e) => e.textContent.trim().slice(0, 20) || e.outerHTML.slice(0, 60)) }
  }, selector)
  check(`${ctx.tag} ${label}: all ${out.n} are full pills`, out.n > 0 && out.bad.length === 0, out.bad.join(' | '))
}

// Every icon-only button (no text of its own) inside `scope` has an accessible
// name, and each is the square IconButton. `min` guards a vacuous pass.
async function expectIconButtonsNamed(ctx, label, scope, min = 1) {
  const out = await ctx.page.evaluate((sc) => {
    const root = document.querySelector(sc)
    const icons = [...(root?.querySelectorAll('button') ?? [])].filter((b) => !b.textContent.trim())
    return {
      n: icons.length,
      unnamed: icons.filter((b) => !(b.getAttribute('aria-label') || '').trim() && !b.getAttribute('aria-labelledby')).length,
      notSquare: icons.filter((b) => {
        const r = b.getBoundingClientRect()
        return Math.abs(r.width - r.height) > 0.5
      }).length,
    }
  }, scope)
  check(
    `${ctx.tag} ${label}: ${out.n} icon button(s), every one named and square`,
    out.n >= min && out.unnamed === 0 && out.notSquare === 0,
    JSON.stringify(out),
  )
}

// A chip's look follows the state it exposes: on = primary-050 / primary-800 /
// primary border; off = card ground with the border.
async function expectChipLook(ctx, label, selector, on) {
  if (on) {
    await expectRole(ctx, `${label} (on)`, selector, 'background-color', '--primary-050')
    await expectRole(ctx, `${label} (on)`, selector, 'color', '--primary-800')
    await expectRole(ctx, `${label} (on)`, selector, 'border-top-color', '--primary')
  } else {
    await expectRole(ctx, `${label} (off)`, selector, 'background-color', '--card')
    await expectRole(ctx, `${label} (off)`, selector, 'border-top-color', '--border')
  }
}

SCREENS.push({
  key: 'deliveries-controls',
  path: '/oms/deliveries',
  ready: loadDeliveries,
  assert: async (ctx) => {
    const { page, tag } = ctx
    const toolbar = '[role="toolbar"]'

    // Toolbar buttons and the grid bar's Inspector chip are pills, on Button's outlined look.
    await expectAllPills(ctx, 'toolbar buttons', `${toolbar} button`)
    await expectAllPills(ctx, 'Inspector toggle', '[data-inspector-toggle]')
    await expectRole(ctx, 'toolbar Export (outlined Button)', `${toolbar} [data-toolbar-export]`, 'border-top-color', '--border')

    // Disabled with a reason: no row is selected after a search, so Open Order is
    // aria-disabled, keeps a reason, is reachable by Tab and does nothing on click.
    const openOrder = `${toolbar} [data-toolbar-open-order]`
    const idle = await page.evaluate((sel) => {
      const b = document.querySelector(sel)
      b?.focus()
      return {
        ariaDisabled: b?.getAttribute('aria-disabled'),
        nativeDisabled: b?.disabled,
        reason: b?.getAttribute('title') ?? '',
        focused: document.activeElement === b,
      }
    }, openOrder)
    check(
      `${tag} Open Order with no row: aria-disabled, focusable, states a reason`,
      idle.ariaDisabled === 'true' && idle.nativeDisabled === false && idle.focused && idle.reason.trim().length > 0,
      JSON.stringify(idle),
    )
    await expectFocusRing(ctx, 'disabled-with-reason Open Order', openOrder)
    const urlBefore = page.url()
    await page.locator(openOrder).click({ force: true })
    await page.waitForTimeout(200)
    check(`${tag} Open Order with no row: a click goes nowhere`, page.url() === urlBefore, page.url())

    // Icon buttons carry names: the Columns chooser's pin buttons.
    await page.locator(`${toolbar} [data-toolbar-columns]`).click()
    await page.waitForTimeout(200)
    await expectIconButtonsNamed(ctx, 'Columns chooser', `${toolbar} [data-columns-chooser]`, 3)
    await page.keyboard.press('Escape')
    await page.mouse.move(0, 0)

    // Lens chips expose pressed state; the look follows it. The active lens also
    // keeps aria-current (the Deliveries list drive reads it).
    const lenses = await page.evaluate(() =>
      [...document.querySelectorAll('[data-views-rail] [data-lens]')].map((b) => ({
        id: b.getAttribute('data-lens'),
        pressed: b.getAttribute('aria-pressed'),
        current: b.getAttribute('aria-current'),
      })),
    )
    const pressed = lenses.filter((l) => l.pressed === 'true')
    check(
      `${tag} lens chips: each exposes aria-pressed, exactly one pressed and it is the current lens`,
      lenses.length === 5 && lenses.every((l) => l.pressed === 'true' || l.pressed === 'false') &&
        pressed.length === 1 && pressed[0].current === 'true',
      JSON.stringify(lenses),
    )
    await expectChipLook(ctx, 'lens chip', '[data-lens="all"]', true)
    await expectChipLook(ctx, 'lens chip', '[data-lens="attention"]', false)
    await expectPill(ctx, 'lens chip', '[data-lens="all"]')
    await page.locator('[data-lens="attention"]').click()
    // transition-colors: read the on look after it settles (591's gotcha).
    await page.waitForTimeout(400)
    const after = await page.evaluate(() => document.querySelector('[data-lens="attention"]')?.getAttribute('aria-pressed'))
    check(`${tag} lens chip: clicking a lens presses it`, after === 'true', String(after))
    await expectChipLook(ctx, 'lens chip after click', '[data-lens="attention"]', true)
    await page.locator('[data-lens="all"]').click()
    await page.mouse.move(0, 0)

    // The Inspector toggle is a Chip: its look follows its aria-pressed.
    const inspectorOn = (await page.locator('[data-inspector-toggle]').getAttribute('aria-pressed')) === 'true'
    await expectChipLook(ctx, 'Inspector chip', '[data-inspector-toggle]', inspectorOn)
  },
})

// --- run ---------------------------------------------------------------------

const onlyScreens = process.env.SCREENS?.split(',')
const onlyModes = process.env.MODES?.split(',')

for (const screen of SCREENS.filter((s) => !onlyScreens || onlyScreens.includes(s.key))) {
  for (const mode of MODES.filter((m) => !onlyModes || onlyModes.includes(m.key))) {
    const tag = `[${screen.key}/${mode.key}]`
    const { context, page, errors } = await openPage(mode, screen)
    try {
      await screen.ready(page)
      await screen.assert({ page, mode, screen, tag })
      await page.screenshot({ path: `${SHOTS}/${screen.key}-${mode.key}.png` })
      check(`${tag} no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '))
    } catch (e) {
      check(`${tag} drove without throwing`, false, String(e).split('\n')[0])
    } finally {
      await context.close()
    }
  }
}

await browser.close()

const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed${skipped.length ? `, ${skipped.length} skipped` : ''} — screenshots in ${SHOTS}/`)
process.exit(passed === results.length ? 0 : 1)
