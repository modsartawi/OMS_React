// DMSCO theme drive (spec 590, ticket 591) — THE theme drive. It walks a list of
// screens in every mode (light, dark, RTL) and proves, on the real painted DOM:
//   - controls resolve to their ROLE tokens, read through computed style and
//     compared with the same token resolved on the same live document — never a
//     pinned hex. The contrast gate (`tools/check-contrast.mjs`) owns the values;
//     this drive owns "the screen actually paints from them";
//   - navigating links in primary ink carry an underline (590: `--primary` is
//     nearly the body ink, so the underline is what marks a link);
//   - h-7 controls are full pills (`--radius: 1rem`), the grid wrapper stays 8px;
//   - the Deliveries list shows as many rows at 1568×744 as before the theme (584: nothing gets bigger);
//   - the shell (592): the rail head carries the DMSCO lockup expanded and the symbol
//     collapsed, the rail and every rail-born panel (flyout, overlaid tree, drawer) wear
//     the radial gradient, exactly one active item is drawn as the filled pill, and the
//     top bar's palette field and store chip are pills — rail expanded and collapsed, at
//     the overlay width and in the phone drawer, mirrored under RTL.
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
import { mkdirSync, readFileSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

// The `common` namespace, for copy the shell must carry (the lockup's name, the wordmark).
const COMMON = JSON.parse(readFileSync('src/locales/en/common.json', 'utf8'))

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
// A mode may carry its own `viewport` (default VIEWPORT) and a `rail` band: none =
// pinned (≥1280px), 'overlay' (640–1279px) or 'drawer' (<640px). A screen may take
// only some modes (`screen.modes`, a predicate). The pinned modes default to the rail
// COLLAPSED (the stored preference's default); `railExpanded: true` pins it open.
const VIEWPORT = { width: 1568, height: 744 }
const NARROW = { width: 1100, height: 744 }
const PHONE = { width: 400, height: 800 }

const MODES = [
  { key: 'light', theme: 'light', dir: 'ltr' },
  { key: 'dark', theme: 'dark', dir: 'ltr' },
  { key: 'rtl', theme: 'light', dir: 'rtl' },
  // 592: the rail expanded, the overlaid tree, and the phone drawer.
  { key: 'expanded', theme: 'light', dir: 'ltr', railExpanded: true },
  { key: 'dark-expanded', theme: 'dark', dir: 'ltr', railExpanded: true },
  { key: 'rtl-expanded', theme: 'light', dir: 'rtl', railExpanded: true },
  { key: 'overlay', theme: 'light', dir: 'ltr', viewport: NARROW, rail: 'overlay' },
  { key: 'drawer', theme: 'light', dir: 'ltr', viewport: PHONE, rail: 'drawer' },
  { key: 'dark-drawer', theme: 'dark', dir: 'ltr', viewport: PHONE, rail: 'drawer' },
  { key: 'rtl-drawer', theme: 'light', dir: 'rtl', viewport: PHONE, rail: 'drawer' },
]

/** The pinned modes: a full-width window, the rail beside the page. */
const pinned = (m) => !m.rail

// The Deliveries list's fully visible rows at VIEWPORT BEFORE the theme, measured
// by this drive's own `visibleGridRows` on the pre-591 stylesheet (spec 590's
// tip 18f21c2c, stubbed). The theme must not cost a row (584). Ticket 591 quotes
// 19 — 584's staging figure, taken on the prototype — but the stubbed app on the
// pre-theme stylesheet shows 15 here; see ticket 591's Comments.
const BEFORE_THEME_ROWS = 15

const browser = await chromium.launch()

async function openPage(mode, screen) {
  const context = await browser.newContext({ viewport: mode.viewport || screen.viewport || VIEWPORT })
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
  await expectTopBarPills(ctx)
  await expectRailGround(ctx, 'rail', 'aside[data-rail]')
  await expectRole(ctx, 'rail', 'aside[data-rail]', 'color', '--rail-foreground')
  const state = await page.getAttribute('aside[data-rail]', 'data-rail')
  await expectRailHead(ctx, 'rail', 'aside[data-rail]', state)
  if (activeRail) await expectActivePill(ctx, 'rail', 'aside[data-rail]')
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
  await expectAtInlineStart(ctx, 'rail', 'aside[data-rail]')
}

// --- the DMSCO shell's helpers (ticket 592) ----------------------------------

// The element sits flush on the inline-start edge of the window, in either direction,
// and wholly inside it.
async function expectAtInlineStart(ctx, label, selector) {
  const got = await styleOf(ctx.page, selector, [])
  if (!got) return check(`${ctx.tag} ${label}: ${selector} present`, false)
  const vw = ctx.page.viewportSize().width
  const [x0, x1] = [got.rect.x, got.rect.x + got.rect.w]
  const atStart = x0 >= -1 && x1 <= vw + 1 && (ctx.mode.dir === 'rtl' ? x1 >= vw - 1 : x0 <= 1)
  check(`${ctx.tag} ${label} sits at inline-start`, atStart, `x ${got.rect.x}, w ${got.rect.w}`)
}

// The rail ground: the radial deep navy from `--rail-gradient-from` to
// `--rail-gradient-to`, lit from the inline-start top corner (mirrored under RTL).
async function expectRailGround(ctx, label, selector) {
  const { page, mode, tag } = ctx
  const got = await styleOf(page, selector, ['background-image'])
  if (!got) return check(`${tag} ${label}: ${selector} present`, false)
  const [from, to] = [await token(page, '--rail-gradient-from'), await token(page, '--rail-gradient-to')]
  const img = got['background-image']
  const corner = mode.dir === 'rtl' ? 'at 100% 0%' : 'at 0% 0%'
  check(
    `${tag} ${label}: ground is the radial --rail-gradient-from → --rail-gradient-to, from the inline-start corner`,
    img.startsWith('radial-gradient(') && img.includes(from) && img.includes(to) && img.includes(corner) && img.indexOf(from) < img.indexOf(to),
    img,
  )
}

// The rail head inside `scope`: ONE DMSCO lockup, in the head link to `/`, named by
// `common:brandLockup`. Expanded it is the lockup, a divider and "BackOffice"
// (`common:brandName`); collapsed it is the dotted-D symbol alone (taller than wide —
// the crop). No al-dawaa glyph anywhere in the scope.
async function expectRailHead(ctx, label, scope, want) {
  const { page, tag } = ctx
  const out = await page.evaluate((sc) => {
    const root = document.querySelector(sc)
    const marks = [...(root?.querySelectorAll('[data-brand-lockup]') ?? [])]
    const m = marks[0]
    const img = m?.querySelector('img')
    const r = img?.getBoundingClientRect()
    return {
      count: marks.length,
      state: m?.getAttribute('data-brand-lockup'),
      inHead: !!m?.closest('a[href="/"]'),
      alt: img?.alt,
      loaded: !!img && img.complete && img.naturalWidth > 0,
      w: r?.width,
      h: r?.height,
      divider: !!m?.querySelector('[data-brand-lockup-divider]'),
      words: m?.textContent?.trim() ?? '',
      aldawaa: root?.querySelectorAll('[aria-label="al-dawaa"]').length ?? -1,
    }
  }, scope)
  const expanded = want === 'expanded'
  check(
    `${tag} ${label} head: one DMSCO ${expanded ? 'lockup' : 'symbol'} in the link home, named "${COMMON.brandLockup}"`,
    out.count === 1 && out.state === want && out.inHead && out.alt === COMMON.brandLockup && out.loaded,
    JSON.stringify(out),
  )
  check(
    expanded
      ? `${tag} ${label} head: lockup, divider, then "${COMMON.brandName}"`
      : `${tag} ${label} head: the symbol alone, cropped (taller than wide)`,
    expanded ? out.divider && out.words === COMMON.brandName && out.w > out.h : !out.divider && out.words === '' && out.h > out.w,
    JSON.stringify({ words: out.words, divider: out.divider, w: out.w, h: out.h }),
  )
  check(`${tag} ${label} head: no al-dawaa glyph`, out.aldawaa === 0, String(out.aldawaa))
}

// Exactly one active item inside `scope` — `aria-current` on a leaf, or the lit
// group icon in a collapsed rail's `[data-active]` row — drawn as the filled pill:
// `--rail-pill` ground, white ink, a gold icon, a full pill, and no 3px bar on it or
// its row. Nothing else in the scope wears the pill ground.
async function expectActivePill(ctx, label, scope) {
  const { page, tag } = ctx
  const [pill, white, gold] = [
    await token(page, '--rail-pill'),
    await token(page, '--rail-accent-foreground'),
    await token(page, '--rail-active'),
  ]
  const out = await page.evaluate(
    ([sc, pill]) => {
      const root = document.querySelector(sc)
      const active = [...new Set(root.querySelectorAll('[aria-current="page"], [data-active] > *'))]
      const el = active[0]
      const bar = (e) => {
        const b = getComputedStyle(e, '::before')
        return b.content !== 'none' && b.content !== 'normal' && parseFloat(b.width) > 0
      }
      const pills = [...root.querySelectorAll('*')].filter((e) => getComputedStyle(e).backgroundColor === pill)
      if (!el) return { count: 0, pills: pills.length }
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        count: active.length,
        pills: pills.length,
        bg: cs.backgroundColor,
        ink: cs.color,
        icon: el.querySelector('svg') ? getComputedStyle(el.querySelector('svg')).color : null,
        radius: Math.min(parseFloat(cs.borderStartStartRadius), parseFloat(cs.borderEndEndRadius)),
        h: r.height,
        bar: bar(el) || bar(el.parentElement),
      }
    },
    [scope, pill],
  )
  check(`${tag} ${label}: exactly one active item`, out.count === 1, JSON.stringify(out))
  check(
    `${tag} ${label}: the active item is the filled pill (--rail-pill, white ink, gold icon), no bar`,
    out.bg === pill && out.ink === white && out.icon === gold && out.radius >= out.h / 2 - 0.5 && !out.bar && out.pills === 1,
    JSON.stringify(out),
  )
}

// The top bar's palette field and store chip are full pills; the field's ground is `--card`.
async function expectTopBarPills(ctx) {
  const { page } = ctx
  if (await page.$('[data-palette-field]')) {
    await expectPill(ctx, 'palette field', '[data-palette-field]')
    await expectRole(ctx, 'palette field', '[data-palette-field]', 'background-color', '--card')
  } else skip(`${ctx.tag} palette field (no palette host on this screen)`)
  await expectPill(ctx, 'store chip', '[data-store-chip]')
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
    modes: pinned,
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
    modes: pinned,
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
  {
    // 592: the panels that open from the rail wear its ground, its lockup and its
    // pill — the flyout (collapsed), the overlaid tree (640–1279px) and the phone
    // drawer (<640px). On Deliveries, so OMS › Deliveries is the active item.
    key: 'rail-panels',
    path: '/oms/deliveries',
    modes: (m) => !m.railExpanded,
    ready: async (page) => {
      await page.goto(BASE + '/oms/deliveries')
      await page.waitForSelector('#layout-topbar', { timeout: 20000 }).catch(() => {})
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(400)
    },
    assert: async (ctx) => {
      const { page, mode, tag } = ctx
      if (mode.rail === 'drawer') {
        check(`${tag} no rail below 640px`, (await page.$('aside[data-rail]')) === null)
        await page.locator('[data-drawer-button]').click()
        await page.waitForSelector('[data-rail-drawer]', { timeout: 5000 })
        // Off the drawer's head (the hamburger sat under it), onto the scrim.
        await page.mouse.move(mode.dir === 'rtl' ? 10 : page.viewportSize().width - 10, page.viewportSize().height / 2)
        await page.waitForTimeout(200)
        await expectRailGround(ctx, 'drawer', '[data-rail-drawer]')
        await expectRailHead(ctx, 'drawer', '[data-rail-drawer]', 'expanded')
        await expectActivePill(ctx, 'drawer', '[data-rail-drawer]')
        await expectAtInlineStart(ctx, 'drawer', '[data-rail-drawer]')
      } else if (mode.rail === 'overlay') {
        await expectRailHead(ctx, 'rail', 'aside[data-rail]', 'collapsed')
        await page.locator('aside[data-rail] nav > button[aria-expanded]').click()
        await page.waitForSelector('[data-rail-scrim]', { timeout: 5000 })
        await page.mouse.move(page.viewportSize().width - 10, page.viewportSize().height / 2) // off the toggle
        await page.waitForTimeout(200)
        await expectRailGround(ctx, 'overlaid tree', 'aside[data-rail] > nav')
        await expectRailHead(ctx, 'overlaid tree', 'aside[data-rail] > nav', 'expanded')
        await expectActivePill(ctx, 'overlaid tree', 'aside[data-rail] > nav')
      } else {
        await page.locator('[data-rail-group="deliveries:menu.oms"]').click()
        await page.waitForSelector('[data-rail-flyout]', { timeout: 5000 })
        await page.mouse.move(page.viewportSize().width - 10, page.viewportSize().height - 10)
        await page.waitForTimeout(200)
        await expectRailGround(ctx, 'flyout', '[data-rail-flyout]')
        await expectActivePill(ctx, 'flyout', '[data-rail-flyout]')
      }
    },
  },
]

// --- run ---------------------------------------------------------------------

const onlyScreens = process.env.SCREENS?.split(',')
const onlyModes = process.env.MODES?.split(',')

for (const screen of SCREENS.filter((s) => !onlyScreens || onlyScreens.includes(s.key))) {
  for (const mode of MODES.filter((m) => (!onlyModes || onlyModes.includes(m.key)) && (!screen.modes || screen.modes(m)))) {
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
