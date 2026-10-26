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
import { BATCHES, CAMPAIGNS, budgetsOf, catalogueFor, listBatches, loadDraft, promotionCampaignsOf, validationOf } from './campaigns-fixtures.mjs'

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
// `stubs` (same shape, checked first). `data` may be a function of the path (and the request).
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
    if (re.test(path)) return route.fulfill(envelope(typeof data === 'function' ? data(path, route.request()) : data))
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

// --- 595: the shared field controls (Input / Select / Textarea / Field) -------
// Self-contained: its helpers and its screen. The Deliveries query bar's token
// popovers (its filter panel) are the form 595 moved onto the shared controls.

// Every control matching `selector` has a name a screen reader reads: a linked
// <label> (htmlFor/id), or failing that an aria-label/-labelledby.
async function expectLabelled(ctx, label, selector) {
  const out = await ctx.page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)]
    const nameOf = (el) =>
      [...(el.labels || [])].map((l) => l.textContent.trim()).join(' ') ||
      el.getAttribute('aria-label') ||
      (el.getAttribute('aria-labelledby') || '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent.trim() ?? '')
        .join(' ')
        .trim()
    return {
      count: els.length,
      linked: els.filter((el) => el.labels?.length).length,
      bare: els.filter((el) => !nameOf(el)).map((el) => el.outerHTML.slice(0, 60)),
    }
  }, selector)
  check(
    `${ctx.tag} ${label}: every field labelled`,
    out.count > 0 && out.bare.length === 0,
    `${out.count} field(s), ${out.linked} by <label for>${out.bare.length ? '; bare: ' + out.bare.join(' | ') : ''}`,
  )
}

// The control's aria-describedby resolves to an element whose text contains `fragment`.
async function expectDescribed(ctx, label, selector, fragment) {
  const text = await ctx.page.evaluate((sel) => {
    const el = document.querySelector(sel)
    return (el?.getAttribute('aria-describedby') || '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
  }, selector)
  check(`${ctx.tag} ${label}: described by its hint`, text.includes(fragment), JSON.stringify(text.slice(0, 80)))
}

// The control states invalid (aria-invalid=true, what a screen reader
// announces) and paints the danger edge.
async function expectInvalid(ctx, label, selector) {
  const aria = await ctx.page.evaluate((sel) => document.querySelector(sel)?.getAttribute('aria-invalid') ?? null, selector)
  check(`${ctx.tag} ${label}: announced invalid`, aria === 'true', `aria-invalid=${aria}`)
  await ctx.page.waitForTimeout(300) // transition-colors animates the edge
  await expectRole(ctx, `${label} invalid`, selector, 'border-top-color', '--danger')
}

// The shared field look: the --input edge on --card, a full pill at 28px.
async function expectFieldLook(ctx, label, selector) {
  await expectRole(ctx, label, selector, 'border-top-color', '--input')
  await expectRole(ctx, label, selector, 'background-color', '--card')
  const got = await styleOf(ctx.page, selector, [])
  check(`${ctx.tag} ${label}: 28px high`, !!got && Math.round(got.rect.h) === 28, got ? `${got.rect.h}px` : 'absent')
  await expectPill(ctx, label, selector)
}

// Opens a criterion's token popover — from + Filter when it is not in the bar yet.
async function openCriterion(page, field) {
  const token = page.locator(`[data-query-token="${field}"] button[aria-haspopup]`)
  if (await token.count()) await token.click()
  else {
    await page.locator('[data-query-add]').click()
    await page.locator(`[data-query-entry="${field}"]`).click()
  }
  await page.waitForSelector(`[data-token-popover="${field}"]`, { timeout: 5000 })
  await page.mouse.move(0, 0)
}
const closeCriterion = (page, field) => page.locator(`[data-token-popover="${field}"] [data-token-done]`).click()

SCREENS.push({
  key: 'deliveries-filter',
  path: '/oms/deliveries',
  ready: loadDeliveries,
  assert: async (ctx) => {
    const { page } = ctx
    const pop = (f) => `[data-token-popover="${f}"]`

    // Limit: a number Input in a Field with a hint.
    await openCriterion(page, 'limit')
    const limit = `${pop('limit')} input`
    await expectLabelled(ctx, 'Limit', limit)
    await expectDescribed(ctx, 'Limit', limit, 'rows load')
    await expectFieldLook(ctx, 'Limit (Input)', limit)
    await expectFocusRing(ctx, 'Limit (Input)', limit)
    await page.locator(limit).fill('0')
    await expectInvalid(ctx, 'Limit 0', limit)
    await page.screenshot({ path: `${SHOTS}/${ctx.screen.key}-limit-${ctx.mode.key}.png` })
    await page.locator(limit).fill('')
    await closeCriterion(page, 'limit')

    // Date: a Select, then a Custom range of two date Inputs, each its own Field.
    await openCriterion(page, 'date')
    const dateSel = `${pop('date')} select`
    await expectFieldLook(ctx, 'Date (Select)', dateSel)
    await expectFocusRing(ctx, 'Date (Select)', dateSel)
    await page.locator(dateSel).selectOption('custom')
    await expectLabelled(ctx, 'Date, Custom', `${pop('date')} input, ${pop('date')} select`)
    const toEnd = `${pop('date')} input[data-date-end="to"]`
    await page.locator(toEnd).fill('')
    await expectInvalid(ctx, 'Date, Custom with To cleared', toEnd)
    await page.screenshot({ path: `${SHOTS}/${ctx.screen.key}-date-${ctx.mode.key}.png` })
    await closeCriterion(page, 'date')

    // A text criterion and a select criterion.
    await openCriterion(page, 'deliveryNo')
    await expectLabelled(ctx, 'Delivery no.', `${pop('deliveryNo')} input`)
    await expectFieldLook(ctx, 'Delivery no. (Input)', `${pop('deliveryNo')} input`)
    await closeCriterion(page, 'deliveryNo')
    await openCriterion(page, 'isExpress')
    await expectLabelled(ctx, 'Dawaa Now', `${pop('isExpress')} select`)
    await expectFieldLook(ctx, 'Dawaa Now (Select)', `${pop('isExpress')} select`)
    await closeCriterion(page, 'isExpress')
  },
})

// Core's RULE_INPUT (51 uses) is re-pointed at the shared field look (595):
// one of its callers, the Coupon finder's code box, proves its callers restyled.
SCREENS.push({
  key: 'rule-input',
  path: '/campaigns/coupon-finder',
  ready: async (page) => {
    await page.goto(BASE + '/campaigns/coupon-finder')
    await page.waitForSelector('[data-finder-code]', { timeout: 20000 }).catch(() => {})
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
  },
  assert: async (ctx) => {
    await expectLabelled(ctx, 'Coupon code (RULE_INPUT)', '[data-finder-code]')
    await expectFieldLook(ctx, 'Coupon code (RULE_INPUT)', '[data-finder-code]')
    await expectFocusRing(ctx, 'Coupon code (RULE_INPUT)', '[data-finder-code]')
  },
})

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
  // A full-width toolbar: the pinned modes only (592's overlay/drawer modes are shell checks).
  modes: pinned,
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

// --- 597: the campaign workspace on the shared controls -----------------------
// The first area sweep (spec 590 §Shared controls). Self-contained: its stubs, its
// helper and its screen. It walks three workspace pages in light, dark and RTL —
// the rule builder with a block panel open (Input / Select fields, IconButtons),
// Settings ▸ Schedule (day Chips, date Inputs, a clear IconButton) and Coupons
// (the search Input in a Field) — and proves every field labelled, every icon
// button named, and the role tokens resolved. Fixtures: tools/campaigns-fixtures.mjs.

/** Each run its own copy of HQ's drafts and batches. */
const WORKSPACE_STORE = structuredClone(CAMPAIGNS)
const WORKSPACE_BATCHES = structuredClone(BATCHES)
const bodyOf = (req) => {
  try {
    return req.postDataJSON() ?? {}
  } catch {
    return {}
  }
}
const WORKSPACE_STUBS = [
  [/^Rules\/Authoring\/Drafts\/Load$/, (_, req) => loadDraft(WORKSPACE_STORE, bodyOf(req).campaign).draft ?? null],
  [/^Rules\/Authoring\/Catalogue$/, (_, req) => catalogueFor(bodyOf(req).features ?? [])],
  [/^Rules\/Authoring\/Validate$/, (_, req) => validationOf(bodyOf(req).campaign)],
  [/^Rules\/Authoring\/Budgets$/, (_, req) => budgetsOf(WORKSPACE_STORE, bodyOf(req).campaign)],
  [/^Rules\/Authoring\/CouponBatches\/List$/, (_, req) => listBatches(WORKSPACE_BATCHES, bodyOf(req).campaign).list ?? []],
  [/^Rules\/Authoring\/Promotions\/Campaigns$/, (_, req) => promotionCampaignsOf(WORKSPACE_STORE, bodyOf(req)).page ?? null],
  [/^Rules\/Authoring\/Lookups\//, []],
]

/** The three pinned modes the ticket names: light, dark, RTL. */
const lightDarkRtl = (m) => ['light', 'dark', 'rtl'].includes(m.key)

/** Goes to a workspace page and waits for its own hook; fonts settled, mouse parked. */
async function openWorkspacePage(page, path, hook) {
  await page.goto(BASE + path)
  await page.waitForSelector(hook, { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
}

// Every field (text-like input, select, textarea) inside `scope` wears the shared
// look: none is left on a local constant (the swept area's whole point).
async function expectAllFieldsShared(ctx, label, scope) {
  const out = await ctx.page.evaluate((sc) => {
    const root = document.querySelector(sc)
    const els = [...(root?.querySelectorAll('input, select, textarea') ?? [])].filter(
      (e) => !['checkbox', 'radio', 'hidden', 'file'].includes(e.type) && e.getBoundingClientRect().height > 0,
    )
    const probe = document.createElement('div')
    probe.style.color = 'var(--input)'
    document.body.appendChild(probe)
    const input = getComputedStyle(probe).color
    probe.style.color = 'var(--card)'
    const card = getComputedStyle(probe).color
    probe.remove()
    const bad = els.filter((e) => {
      const cs = getComputedStyle(e)
      return (cs.borderTopColor !== input && e.getAttribute('aria-invalid') !== 'true') || cs.backgroundColor !== card
    })
    return { n: els.length, bad: bad.map((e) => e.outerHTML.slice(0, 70)) }
  }, scope)
  check(`${ctx.tag} ${label}: all ${out.n} fields on the shared look`, out.n > 0 && out.bad.length === 0, out.bad.join(' | '))
}

SCREENS.push({
  key: 'campaign-workspace',
  path: '/campaigns/SUN-3FOR2/rules',
  stubs: WORKSPACE_STUBS,
  modes: lightDarkRtl,
  ready: (page) => openWorkspacePage(page, '/campaigns/SUN-3FOR2/rules', '[data-rule-card]'),
  assert: async (ctx) => {
    const { page, tag, mode, screen } = ctx
    const shot = (part) => page.screenshot({ path: `${SHOTS}/${screen.key}-${part}-${mode.key}.png` })

    // ── The rule builder: a block panel open on the first card's effect.
    const card = '[data-rule-card]'
    await page.locator(`${card} [data-effect]`).first().locator('[data-block-edit]').click()
    await page.waitForSelector(`${card} [data-block-panel]`, { timeout: 5000 })
    await page.mouse.move(0, 0)
    const panel = `${card} [data-block-panel]`
    const panelFields = `${panel} input:not([type=checkbox]):not([type=radio]), ${panel} select, ${panel} textarea`
    await expectLabelled(ctx, 'block panel', panelFields)
    await expectAllFieldsShared(ctx, 'block panel', panel)
    await expectFieldLook(ctx, 'block panel first field', `${panel} :is(input:not([type=checkbox]), select)`)
    await expectFocusRing(ctx, 'block panel first field', `${panel} :is(input:not([type=checkbox]), select)`)
    await expectIconButtonsNamed(ctx, 'rule card', card, 4)
    await expectLabelled(ctx, 'rule name', `${card} [data-rule-name]`)
    await expectAllFieldsShared(ctx, 'rule card', card)
    await shot('rules')

    // ── Settings ▸ Schedule: day chips, date inputs, a clear icon button.
    await openWorkspacePage(page, '/campaigns/NATDAY-15/settings/schedule', '[data-settings="schedule"]')
    const sched = '[data-settings="schedule"]'
    await expectLabelled(ctx, 'schedule', `${sched} input, ${sched} select`)
    await expectAllFieldsShared(ctx, 'schedule', sched)
    await expectFieldLook(ctx, 'start day (date Input)', '[data-settings-field="from"]')
    await expectIconButtonsNamed(ctx, 'schedule', sched, 1)
    const days = await page.evaluate(() =>
      [...document.querySelectorAll('[data-settings-day]')].map((b) => b.getAttribute('aria-pressed')),
    )
    check(`${tag} day chips: each exposes aria-pressed`, days.length === 7 && days.every((d) => d === 'true' || d === 'false'), days.join(','))
    // NATDAY-15 runs every day (no day pressed): press Sunday, read both looks, then unpress it.
    const sun = '[data-settings-day]:nth-child(1)'
    await expectChipLook(ctx, 'day chip', sun, false)
    await page.locator(sun).click()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400) // transition-colors (591's gotcha)
    const pressed = await page.locator(sun).getAttribute('aria-pressed')
    check(`${tag} day chip: a click presses it`, pressed === 'true', String(pressed))
    await expectChipLook(ctx, 'day chip', sun, true)
    await page.locator(sun).click()
    await expectAllPills(ctx, 'day chips', '[data-settings-day]')
    await shot('schedule')

    // ── Coupons: the search box in a Field, the shared search Input.
    await openWorkspacePage(page, '/campaigns/WKND20/coupons', '[data-coupons-search]')
    await expectLabelled(ctx, 'coupon search', '[data-coupons-search]')
    await expectFieldLook(ctx, 'coupon search (search Input)', '[data-coupons-search]')
    await expectFocusRing(ctx, 'coupon search (search Input)', '[data-coupons-search]')
    await shot('coupons')
  },
})

// --- 598: the rest of campaigns on the shared controls ------------------------
// The area sweep for every campaigns feature but the workspace (spec 590 §Shared
// controls). Self-contained: its fixtures (imported here, not at the top, so sibling
// blocks merge beside it), its stubs and its screen. It walks the area's three
// heaviest pages in light, dark and RTL — the Simulator (Fields with Select / Input,
// a basket line's Inputs and remove IconButton, the hit Buttons, the result's tab
// Chips), the no-promotion page (the search Input in a Field, status Chips) with its
// Create dialog open (tab Chips, name Fields), and Priority (Select / Input in a group
// row, move and delete IconButtons) — and proves every field labelled, every icon
// button named, the role tokens resolved.
// Reuses 597's `openWorkspacePage`, `expectAllFieldsShared`, `bodyOf`, `lightDarkRtl`.

const F598 = await import('./campaigns-fixtures.mjs')
const S598 = await import('./simulator-fixtures.mjs')
/** Each run its own copy of HQ's drafts. */
const REST_STORE = structuredClone(F598.CAMPAIGNS)
const REST_VERSION = { versionNo: F598.LIVE_VERSION, campaign: 'NATDAY-15', action: 'publish', schemaVersion: 1, publishedAt: '2026-10-12T10:00:00', publishedBy: 'Reem (approver)', requestedBy: 'Omar (marketing)', note: '' }
const REST_STUBS = [
  [/^Rules\/Authoring\/Lookups\/(\w+)$/, (p, req) => F598.lookup(p.split('/').pop(), bodyOf(req).q ?? '').hits ?? []],
  [/^Rules\/Authoring\/Simulate$/, (_, req) => S598.simulate(bodyOf(req)).sim ?? null],
  [/^Rules\/Authoring\/Drafts\/List$/, () => F598.draftsList(REST_STORE)],
  [/^Rules\/Authoring\/Order$/, () => F598.orderOf(REST_STORE)],
  [/^Rules\/Authoring\/Versions\/Load$/, () => ({ version: REST_VERSION, ruleset: F598.rulesetOf(REST_STORE), campaign: null })],
  [/^Rules\/Authoring\/Catalogue$/, (_, req) => F598.catalogueFor(bodyOf(req).features ?? [])],
  [/^Rules\/Authoring\/Promotions\/List$/, () => F598.promotionListOf(REST_STORE)],
  [/^Rules\/Authoring\/Promotions\/Campaigns$/, (_, req) => F598.promotionCampaignsOf(REST_STORE, bodyOf(req)).page ?? null],
  [/^Rules\/Authoring\/Templates\/List$/, F598.TEMPLATES],
]

SCREENS.push({
  key: 'campaigns-rest',
  path: '/campaigns/simulator',
  stubs: REST_STUBS,
  modes: lightDarkRtl,
  ready: (page) => openWorkspacePage(page, '/campaigns/simulator', '[data-sim-sale]'),
  assert: async (ctx) => {
    const { page, tag, mode, screen } = ctx
    const shot = (part) => page.screenshot({ path: `${SHOTS}/${screen.key}-${part}-${mode.key}.png` })

    // ── Simulator: the sale's Fields, a basket line, a run's tab Chips.
    const sale = '[data-sim-sale]'
    await expectLabelled(ctx, 'sale', `${sale} input:not([type=checkbox]), ${sale} select`)
    await expectAllFieldsShared(ctx, 'sale', sale)
    await expectFieldLook(ctx, 'store (Select in a Field)', '[data-sim-field="store"]')
    await expectFocusRing(ctx, 'store (Select in a Field)', '[data-sim-field="store"]')
    await expectFieldLook(ctx, 'date (date Input in a Field)', '[data-sim-field="date"]')
    await page.locator('[data-basket-find]').fill('sha-400')
    await page.waitForSelector('[data-basket-hit="SHA-400"]', { timeout: 5000 })
    await page.mouse.move(0, 0)
    await expectLabelled(ctx, 'item search', '[data-basket-find]')
    await expectFieldLook(ctx, 'item search (search Input)', '[data-basket-find]')
    await expectAllPills(ctx, 'item hits (outlined Buttons)', '[data-basket-hit]')
    await expectRole(ctx, 'item hit edge', '[data-basket-hit]', 'border-top-color', '--border')
    await page.locator('[data-basket-hit="SHA-400"]').click()
    await page.waitForSelector('[data-basket-line="SHA-400"]', { timeout: 5000 })
    await page.locator('[data-basket-price="SHA-400"]').fill('12.5')
    await page.locator('[data-basket-price="SHA-400"]').press('Enter')
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400) // a priced line is no longer invalid: its edge animates back
    const basket = '[data-sim-basket]'
    await expectLabelled(ctx, 'basket line', `${basket} [data-basket-qty], ${basket} [data-basket-price]`)
    await expectAllFieldsShared(ctx, 'basket', basket)
    await expectIconButtonsNamed(ctx, 'basket line', '[data-basket-line="SHA-400"]', 1)
    await page.locator('[data-sim-field="store"]').selectOption('R101')
    await page.locator('[data-sim-run]').click()
    await page.waitForSelector('[data-sim-tab]', { timeout: 10000 })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400) // transition-colors (591's gotcha)
    const tabs = await page.$$eval('[data-sim-tab]', (els) => els.map((e) => `${e.getAttribute('role')}:${e.getAttribute('aria-selected')}`))
    check(`${tag} result tabs: role=tab with aria-selected`, JSON.stringify(tabs) === '["tab:true","tab:false"]', tabs.join(','))
    await expectChipLook(ctx, 'result tab', '[data-sim-tab="lines"]', true)
    await expectChipLook(ctx, 'result tab', '[data-sim-tab="trace"]', false)
    await expectAllPills(ctx, 'result tabs', '[data-sim-tab]')
    await shot('simulator')

    // ── The no-promotion page: the search Input in a Field, the status Chips.
    await openWorkspacePage(page, '/campaigns/no-promotion', '[data-promotion-search]')
    await expectLabelled(ctx, 'campaign search', '[data-promotion-search]')
    await expectFieldLook(ctx, 'campaign search (search Input)', '[data-promotion-search]')
    await expectFocusRing(ctx, 'campaign search (search Input)', '[data-promotion-search]')
    await expectChipLook(ctx, 'status chip All', '[data-status-chip=""]', true)
    await expectChipLook(ctx, 'status chip', '[data-status-chip="Published"]', false)
    await expectAllPills(ctx, 'status chips', '[data-status-chip]')
    await shot('no-promotion')

    // ── Its Create dialog: tab Chips in the tablist, the name Fields.
    await page.locator('[data-new-campaign]').click()
    await page.waitForSelector('[data-create-tabs]', { timeout: 5000 })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)
    await expectChipLook(ctx, 'create tab (blank)', '[data-create-tab="blank"]', true)
    await expectChipLook(ctx, 'create tab (template)', '[data-create-tab="template"]', false)
    await expectAllPills(ctx, 'create tabs', '[data-create-tab]')
    await expectLabelled(ctx, 'create dialog', '[data-create-field]')
    await expectAllFieldsShared(ctx, 'create dialog', 'dialog[open]')
    await expectFieldLook(ctx, 'English name (Input in a Field)', '[data-create-field="nameEn"]')
    await shot('create')
    await page.keyboard.press('Escape')

    // ── Priority: a group row's Input / Select, the move and delete IconButtons.
    await openWorkspacePage(page, '/campaigns/priority', '[data-order-row]')
    await page.locator('[data-add-group]').click()
    await page.waitForSelector('[data-order-group]', { timeout: 5000 })
    await page.mouse.move(0, 0)
    const group = '[data-order-group]'
    await expectLabelled(ctx, 'group row', `${group} [data-group-name], ${group} [data-group-name-ar], ${group} select`)
    await expectAllFieldsShared(ctx, 'group row', group)
    await expectFieldLook(ctx, 'group mode (Select)', `${group} [data-group-mode]`)
    await expectIconButtonsNamed(ctx, 'group row', `${group} > div`, 3)
    await expectIconButtonsNamed(ctx, 'campaign row', '[data-order-row]', 2)
    await expectFieldLook(ctx, 'move to (Select)', '[data-order-row] [data-move-to]')
    await shot('priority')
  },
})

// --- 601: the admin screens on the shared controls -----------------------------
// The admin area sweep (spec 590 §Shared controls). Self-contained: its stubs, its
// helpers and its screens. Light, dark and RTL over the area's heaviest screens — Sync console
// (the Fleet toolbar, the Audit filter Fields),
// Authz admin (users + roles workspaces: search Inputs, tab Chips, danger IconButtons,
// the New role dialog's Fields) and UA admin (the search Input, the toolbar Buttons,
// the New identity dialog's Fields) — proving every field labelled and on the shared
// look, every icon button named, and the role tokens resolved.

const AUTHZ_ROLES = [
  { roleName: 'OMS_ADMIN', description: 'OMS administration', isComposite: false, directHolderCount: 2, isProtected: true },
  { roleName: 'OMS_VIEWER', description: 'Read the OMS screens', isComposite: false, directHolderCount: 5, isProtected: false },
  { roleName: 'CC_AGENT', description: 'Call-center agent', isComposite: true, directHolderCount: 3, isProtected: false },
]
const AUTHZ_PEOPLE = [
  { employeeId: '100201', displayName: 'Ahmad Saleh', phone: '0501112222', phoneClass: 'usable', email: '', deliveryChannel: 'sms', isActive: true, isSeeded: true, credentialState: 'active', isTotpEnrolled: true, lastLoginAt: '2026-10-20T08:00:00' },
  { employeeId: '100202', displayName: 'أحمد علي', phone: '0503334444', phoneClass: 'usable', email: '', deliveryChannel: 'sms', isActive: true, isSeeded: true, credentialState: 'active', isTotpEnrolled: false, lastLoginAt: null },
]
const ADMIN_STUBS = [
  // Authz admin
  [/^AuthzAdminWeb\/Access$/, { screenAllowed: true, canManageRoles: true, canManageUsers: true, assignableRoles: ['*'], revocableRoles: ['*'] }],
  [/^AuthzAdminWeb\/Employees$/, { rows: AUTHZ_PEOPLE, totalMatches: 2, rowCap: 50, isCapped: false }],
  [/^AuthzAdminWeb\/Users\/[^/]+\/Roles$/, ['OMS_VIEWER', 'CC_AGENT']],
  [/^AuthzAdminWeb\/Users\/[^/]+\/EffectiveAuthorizations$/, []],
  [/^AuthzAdminWeb\/Audit$/, []],
  [/^AuthzAdminWeb\/Grants$/, []],
  [/^AuthzAdminWeb\/Roles$/, AUTHZ_ROLES],
  [/^AuthzAdminWeb\/Roles\/[^/]+\/Holders$/, [{ userId: '100201', displayName: 'Ahmad Saleh', isActive: true }]],
  [/^AuthzAdminWeb\/Roles\/[^/]+$/, (path) => {
    const name = decodeURIComponent(path.split('/').pop())
    const r = AUTHZ_ROLES.find((x) => x.roleName === name) ?? AUTHZ_ROLES[1]
    return { ...r, memberSingleRoleNames: r.isComposite ? ['OMS_VIEWER'] : [], boundGrants: [] }
  }],
  // UA admin
  [/^UaAdminWeb\/Access$/, { canOpen: true }],
  [/^UaAdminWeb\/ReportCounts$/, { allPeople: 1200, notSeeded: 4, phoneGap: 12, awaitingActivation: 30, mustChangePassword: 7, disabled: 9, completedActivation: 1100 }],
  [/^UaAdminWeb\/(Employees|ReportCards\/[^/]+)$/, { rows: AUTHZ_PEOPLE, totalMatches: 2, rowCap: 50, isCapped: false }],
]

/** Goes to an admin page and waits for its own hook; fonts settled, mouse parked. */
async function openAdminPage(page, path, hook) {
  await page.goto(BASE + path)
  await page.waitForSelector(hook, { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
}

/** A tab Chip: role=tab with aria-selected; the look follows the selection. */
async function expectTabChips(ctx, label, tablist, min) {
  const tabs = await ctx.page.evaluate((sel) =>
    [...document.querySelectorAll(`${sel} [role="tab"]`)].map((b) => b.getAttribute('aria-selected')), tablist)
  check(
    `${ctx.tag} ${label}: ${tabs.length} tab chips, each exposes aria-selected, exactly one selected`,
    tabs.length >= min && tabs.every((s) => s === 'true' || s === 'false') && tabs.filter((s) => s === 'true').length === 1,
    tabs.join(','),
  )
  await expectAllPills(ctx, `${label} tabs`, `${tablist} [role="tab"]`)
  await expectChipLook(ctx, `${label} selected tab`, `${tablist} [role="tab"][aria-selected="true"]`, true)
  await expectChipLook(ctx, `${label} unselected tab`, `${tablist} [role="tab"][aria-selected="false"]`, false)
}

const FIELDS = (scope) => `${scope} input:not([type=checkbox]):not([type=radio]):not([type=file]), ${scope} select, ${scope} textarea`

SCREENS.push({
  key: 'admin-authz',
  path: '/admin/authz',
  stubs: ADMIN_STUBS,
  modes: lightDarkRtl,
  ready: (page) => openAdminPage(page, '/admin/authz', '[data-authz-users-search]'),
  assert: async (ctx) => {
    const { page, mode, screen } = ctx
    const shot = (part) => page.screenshot({ path: `${SHOTS}/${screen.key}-${part}-${mode.key}.png` })
    const main = 'main'

    // ── Users workspace: the workspace tabs, the search Input, the search Button.
    await expectTabChips(ctx, 'workspace switch', '[role="tablist"]:has([data-authz-workspace])', 2)
    const search = '[data-authz-users-search]'
    await expectLabelled(ctx, 'people search', search)
    await expectFieldLook(ctx, 'people search (search Input)', search)
    await expectFocusRing(ctx, 'people search (search Input)', search)
    await expectAllPills(ctx, 'Search button', '[data-authz-users-run]')
    await page.locator(search).fill('ahmad')
    await page.locator('[data-authz-users-run]').click()
    await page.locator(`${main} tbody tr`).first().click()
    await page.waitForSelector('[data-authz-user-tab]', { timeout: 10000 })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)
    await expectTabChips(ctx, 'person tabs', '[role="tablist"]:has([data-authz-user-tab])', 3)
    await expectIconButtonsNamed(ctx, 'person roles (remove)', main, 2)
    await expectAllFieldsShared(ctx, 'users workspace', main)
    await shot('users')

    // ── Roles workspace: its search Input + New role Button, a role's detail tabs and Held-by revoke.
    await page.locator('[data-authz-workspace="roles"]').click()
    await page.waitForSelector('[data-authz-roles-search]', { timeout: 10000 })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(400)
    await expectChipLook(ctx, 'Roles workspace tab after click', '[data-authz-workspace="roles"]', true)
    await expectLabelled(ctx, 'role search', '[data-authz-roles-search]')
    await expectFieldLook(ctx, 'role search (search Input)', '[data-authz-roles-search]')
    await page.getByRole('button', { name: 'CC_AGENT' }).first().click()
    await page.waitForTimeout(400)
    await expectIconButtonsNamed(ctx, 'composite members (remove)', main, 1)
    await shot('roles')

    // ── New role: a Select and two Inputs, each in a Field.
    await page.locator('[data-authz-new-role]').click()
    await page.waitForSelector('dialog[open]', { timeout: 5000 })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(300)
    await expectLabelled(ctx, 'New role dialog', FIELDS('dialog[open]'))
    await expectAllFieldsShared(ctx, 'New role dialog', 'dialog[open]')
    await expectFieldLook(ctx, 'role kind (Select)', 'dialog[open] select')
    await shot('new-role')
  },
})

SCREENS.push({
  key: 'admin-ua-users',
  path: '/admin/ua-users',
  stubs: ADMIN_STUBS,
  modes: lightDarkRtl,
  ready: (page) => openAdminPage(page, '/admin/ua-users', '[data-ua-search]'),
  assert: async (ctx) => {
    const { page, mode, screen } = ctx
    const shot = (part) => page.screenshot({ path: `${SHOTS}/${screen.key}-${part}-${mode.key}.png` })
    const search = '[data-ua-search]'
    await expectLabelled(ctx, 'people search', search)
    await expectFieldLook(ctx, 'people search (Input)', search)
    await expectFocusRing(ctx, 'people search (Input)', search)
    // The toolbar row: Search, Export, Bulk create, New identity — every one a Button pill.
    await expectAllPills(ctx, 'toolbar buttons', `section > div:has(${search}) button`)
    await expectRole(ctx, 'Bulk create (outlined Button)', `section > div:has(${search}) > button:nth-last-child(2)`, 'border-top-color', '--border')
    await shot('list')

    // New identity: five Fields (four Inputs, the channel Select).
    await page.locator(`section > div:has(${search}) > button:last-child`).click()
    await page.waitForSelector('dialog[open] #ni-id', { timeout: 5000 })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(300)
    await expectLabelled(ctx, 'New identity dialog', FIELDS('dialog[open]'))
    await expectAllFieldsShared(ctx, 'New identity dialog', 'dialog[open]')
    await expectFieldLook(ctx, 'employee id (Input)', 'dialog[open] #ni-id')
    await expectFieldLook(ctx, 'channel (Select)', 'dialog[open] #ni-channel')
    await shot('new-identity')
  },
})

// Sync console: the Fleet page's toolbar (a search Input and two Selects named by aria-label)
// and the Audit page's filter form (four Inputs, each in a Field).
const SYNC_PAGED = { items: [], total: 0, page: 1, pageSize: 50 }
const SYNC_HOUR = (hour, n) => ({ hour, pushPasses: 11820 * n, pullPasses: 23400 * n, connectFailures: 312 * n, chunksPushed: 40 * n, actionsPushed: 4912 * n, trxPulled: 18230 * n, errors: 9 * n })
const SYNC_STUBS = [
  [/^ActionSync\/Access$/, { screenAllowed: true, canOperate: true, canOnboard: true, canReplay: true }],
  [/^ActionSync\/Workers$/, { items: [] }],
  [/^ActionSync\/Fleet\/Summary$/, { asOf: '2026-10-09T12:04:31', total: 120, counts: { all: 120, onWorker: 119, onWpf: 1, paused: 0, offline: 1, behind: 7, erroring: 2, controlPending: 1 } }],
  [/^ActionSync\/Fleet\/LastHour$/, { current: SYNC_HOUR('2026-10-09T12:00:00', 1), previous: SYNC_HOUR('2026-10-09T11:00:00', 2) }],
  [/^ActionSync\/(Fleet|Audit|Commands)$/, SYNC_PAGED],
]

SCREENS.push({
  key: 'admin-sync',
  path: '/admin/sync',
  stubs: SYNC_STUBS,
  modes: lightDarkRtl,
  ready: (page) => openAdminPage(page, '/admin/sync', '[data-fleet-search]'),
  assert: async (ctx) => {
    const { page, mode, screen } = ctx
    const shot = (part) => page.screenshot({ path: `${SHOTS}/${screen.key}-${part}-${mode.key}.png` })
    const toolbar = '[data-fleet-search], [data-fleet-host], [data-fleet-sort]'
    await expectLabelled(ctx, 'fleet toolbar', toolbar)
    await expectAllFieldsShared(ctx, 'fleet page', 'main')
    await expectFieldLook(ctx, 'fleet search (search Input)', '[data-fleet-search]')
    await expectFieldLook(ctx, 'fleet host (Select)', '[data-fleet-host]')
    await expectFocusRing(ctx, 'fleet host (Select)', '[data-fleet-host]')
    await shot('fleet')

    await openAdminPage(page, '/admin/sync/audit', '[data-audit-filters]')
    await expectLabelled(ctx, 'audit filters', FIELDS('[data-audit-filters]'))
    await expectAllFieldsShared(ctx, 'audit filters', '[data-audit-filters]')
    await expectFieldLook(ctx, 'audit from (date Input)', '[data-audit-from]')
    await expectFieldLook(ctx, 'audit who (Input)', '[data-audit-who]')
    await expectAllPills(ctx, 'audit Apply / Clear', '[data-audit-apply], [data-audit-clear]')
    await shot('audit')
  },
})

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
