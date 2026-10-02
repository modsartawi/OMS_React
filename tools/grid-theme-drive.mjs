// Grid theme drive (tickets 085, 382) — proves the AG Grid theme paints from the
// app TOKENS, in both themes, on the real painted DOM, and that every grid
// carries the Ops Console look (spec 380 F6, F8, F9).
//
// `npm run typecheck` cannot see this: the theme is a runtime CSS emission, and
// the whole risk of the change is that a `var(--token)` param serialises to
// something the browser drops. So this reads computed styles back out of a live
// grid and compares them to the same tokens resolved on the same document.
//
// The grid params are ONE block shared by every instance (that is the point of
// 085), so the param assertions run against the Deliveries grid and the other
// four modules are driven to confirm they paint from it too.
//
// Ticket 382 adds, on Deliveries, in light and dark × ltr and rtl:
//   - 26px rows under a 28px header on the `--grid-head` pair, 11.5/600 header
//     labels, an 8px wrapper and a `--border-strong` pinned-column rule;
//   - the Delivery no. RENDERS in Plex Mono at 600 (CDP, not just
//     `font-family`), the other IDs in mono, money in the sans;
//   - the selected row's 3px `--cursor` bar is VISIBLE over a column the user
//     pinned at the start — read as a screen pixel, with a control that drops
//     the bar to z-index 1 and must lose it (362 §6's finding);
//   - a drag over cell text plus Ctrl+C puts that text on the clipboard.
// The other modules additionally assert 26/28 and selectable cell text.
//
// The `dir` switch does not ship until 383's boot wiring, so the RTL passes set
// `dir="rtl"` on <html> before the app boots, the way foundation-drive.mjs does;
// the grid itself stays LTR until 383 flips `enableRtl`.
//
// SIS.Api's delivery list needs a store grant a dev session does not have (see
// tools/palette-drive.mjs's note), so every `/api/**` call is mocked here —
// matching the harness in tools/bby-inquiry-drive.mjs. Mocked data, real app,
// real browser, real CSS.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/grid-theme-drive.mjs        (DRIVE_PORT=5280 for another port)
//
// Screenshots (light + dark, one per grid module) → tools/.grid-shots/.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.grid-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// Surfaces this run could not reach. Reported at the end next to the pass count
// so a green total never stands in for full coverage.
const skipped = []
const skip = (what) => {
  skipped.push(what)
  console.log(`  SKIP  ${what}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const DELIVERY = (over) => ({
  deliveryNo: '8000001',
  documentNo: '1000000393',
  deliveryDocumentType: 'LF',
  orderNo: '900001',
  storeCode: '1001',
  documentDate: '2026-07-01T00:00:00',
  deliveryType: 'P',
  documentType: 'CLCN',
  documentSource: 'W',
  entryTime: '2026-07-01T09:12:00',
  isActiveInStore: true,
  timeSlotDescription: '10:00 - 12:00',
  customerName: 'Test Customer',
  customerPhone: '0500000000',
  netTotal: 120.5,
  paidAmount: 120.5,
  deliveryFees: 10,
  amountDue: 0,
  failedJobsCount: 0,
  ...over,
})

const OUTBOX = (over) => ({
  documentNo: '1000000393',
  outboxStatus: 'S',
  messageType: 'IDOC',
  createdOn: '2026-07-01T09:20:00',
  ...over,
})

const DOCUMENT = {
  documentNo: '1000000393',
  deliveryNo: '8000001',
  storeCode: '1001',
  documentType: 'CLCN',
  documentTypeDescription: 'Call Center',
  documentCategory: 'O',
  deliveryType: 'P',
  customerName: 'Test Customer',
  lines: [
    { itemNumber: '000010', materialCode: 'M1', materialDescription: 'Panadol 500mg', quantity: 2, netValue: 30 },
    { itemNumber: '000020', materialCode: 'M2', materialDescription: 'Vitamin C', quantity: 1, netValue: 90.5 },
  ],
  conditions: [],
  status: { overallStatus: 'A', lastAction: 'X', lastActionDescription: 'Created' },
}

const BBY_ROW = (over) => ({
  bbyNumber: '100234',
  description: 'Buy 2 Pepsi get 1 free',
  bbyProfile: 'STD',
  validFrom: '20260101',
  validTo: '20261231',
  validFromTime: '000000',
  validToTime: '235959',
  bbyStatus: 'A',
  isActive: true,
  createdAt: '2026-07-01T10:00:00Z',
  ...over,
})

// The Arabic stub row of the RTL passes (no Arabic locale file exists; the
// chrome stays English, the DATA is Arabic, as the prototypes drove it).
const ARABIC_NAME = 'عميل تجريبي'

const routeApi = (dir) => async (route) => {
  const url = route.request().url()
  const path = url.split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }),
    )
  if (path === 'SdDocumentWeb/DeliveryDocumentList')
    return route.fulfill(
      envelope([
        DELIVERY({ failedJobsCount: 3, deliveryNo: '8000001' }),
        DELIVERY({
          failedJobsCount: 0,
          deliveryNo: '8000002',
          documentNo: '1000000394',
          ...(dir === 'rtl' ? { customerName: ARABIC_NAME } : {}),
        }),
      ]),
    )
  if (/^SdDocumentWeb\/Document\/[^/]+\/Outbox$/.test(path))
    return route.fulfill(envelope([OUTBOX({ outboxStatus: 'F' }), OUTBOX({ outboxStatus: 'S' })]))
  if (/^SdDocumentWeb\/Document\/[^/]+\/Logs$/.test(path))
    return route.fulfill(envelope([{ documentNo: '1000000393', action: 'CREATE', createdOn: '2026-07-01T09:00:00' }]))
  if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(path)) return route.fulfill(envelope(DOCUMENT))
  if (path === 'Bby/List')
    return route.fulfill(envelope({ rows: [BBY_ROW({}), BBY_ROW({ bbyNumber: '100235' })], capReached: false }))
  // The filter panel's lookup reads iterate their payload — an empty object
  // would throw before the grid ever mounts.
  if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path))
    return route.fulfill(envelope([]))
  // The Change Store picker's two grids.
  if (path === 'SdDocument/StoreDetails')
    return route.fulfill(
      envelope([
        { storeCode: '1001', storeName: 'Riyadh Central', cityName: 'Riyadh' },
        { storeCode: '1002', storeName: 'Jeddah North', cityName: 'Jeddah' },
      ]),
    )
  if (path === 'SdDocument/Districts')
    return route.fulfill(
      envelope([
        { districtCode: 'D1', districtName: 'Al Olaya', cityCode: 'C1', cityName: 'Riyadh', storeCode: '1001' },
        { districtCode: 'D2', districtName: 'Al Malaz', cityCode: 'C1', cityName: 'Riyadh', storeCode: '1001' },
      ]),
    )
  // Every screen-open probe answers yes so each grid module is reachable.
  // canOpenList/canOpenDetail answer the OMS probe added in ticket 125; the other flags
  // answer every sibling screen probe.
  if (/Access$/.test(path))
    return route.fulfill(envelope({ screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true }))
  // Anything else (notifications, slots, …) → benign empty success.
  return route.fulfill(envelope({}))
}

const browser = await chromium.launch()

// One context per mode: theme and direction are set before the app boots, the
// way index.html's own pre-paint script reads them, and the clipboard is granted
// for the copy check.
async function openContext({ theme, dir, width = 1600 }) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      // An init script can run before <html> exists; set `dir` the moment it does.
      if (d !== 'rtl') return
      const apply = () => document.documentElement?.setAttribute('dir', 'rtl')
      if (document.documentElement) return apply()
      new MutationObserver((_, o) => {
        if (document.documentElement) {
          apply()
          o.disconnect()
        }
      }).observe(document, { childList: true })
    },
    [theme, dir],
  )
  await page.route('**/api/**', routeApi(dir))
  return { context, page, errors }
}

// Resolve a colour against the LIVE document. Both sides of every assertion go
// through this one probe, so a check reads "grid == app" — not "grid == a hex I
// retyped here" — and hex, rgb() and `var()` all compare. A border param
// serialises to `solid 1px <color>`, so only the last word is a colour.
const asColor = (page, expr) =>
  page.evaluate((e) => {
    const probe = document.createElement('div')
    probe.style.color = String(e).trim().split(/\s+/).pop()
    document.body.appendChild(probe)
    const v = getComputedStyle(probe).color
    probe.remove()
    return v
  }, expr)

const tokenOf = (page) => (name) => asColor(page, `var(${name})`)

async function loadDeliveries(page) {
  await page.goto(BASE + '/oms/deliveries')
  await page.waitForSelector('.ag-root', { timeout: 20000 }).catch(() => {})
  await page
    .getByRole('button', { name: /load/i })
    .first()
    .click()
    .catch(() => {})
  await page.waitForSelector('.ag-center-cols-container .ag-row', { timeout: 20000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

// One screen pixel, as painted — the only honest read of "is the bar VISIBLE",
// since a pseudo-element's computed style is the same whether or not a pinned
// cell paints over it.
async function pixelAt(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } })
  return page.evaluate(async (b64) => {
    const blob = await (await fetch('data:image/png;base64,' + b64)).blob()
    const canvas = new OffscreenCanvas(1, 1)
    const g = canvas.getContext('2d')
    g.drawImage(await createImageBitmap(blob), 0, 0)
    const [r, gg, b] = g.getImageData(0, 0, 1, 1).data
    return `rgb(${r}, ${gg}, ${b})`
  }, png.toString('base64'))
}
const near = (a, b) => {
  const n = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number)
  const [x, y] = [n(a), n(b)]
  return x.length === 3 && y.length === 3 && x.every((v, i) => Math.abs(v - y[i]) <= 2)
}

// --- the params, on a populated grid ----------------------------------------

// Every param is asserted twice over: once as the `--ag-*` custom property the
// theme emits (which is where a `var()` that failed to serialise would show up
// as an empty string), and again on a painted element for the ones that reach
// pixels. Both sides are read from the same live document, so the assertion is
// "the grid equals the app", never "the grid equals a hex retyped in this file".
const AG_PARAMS = [
  ['--ag-background-color', '--card', 'grid body ground'],
  ['--ag-foreground-color', '--foreground', 'cell text'],
  ['--ag-header-background-color', '--grid-head', 'header ground'],
  ['--ag-header-text-color', '--grid-head-foreground', 'header labels'],
  ['--ag-border-color', '--border', 'default border'],
  ['--ag-row-hover-color', '--card-2', 'hover overlay'],
  ['--ag-selected-row-background-color', '--primary-050', 'selection overlay'],
  ['--ag-accent-color', '--primary', 'focus ring / checkboxes'],
  ['--ag-odd-row-background-color', '--card', 'zebra — off'],
  ['--ag-row-border', '--divider', 'rules between rows'],
  ['--ag-header-row-border', '--border-strong', 'rule under the header'],
  ['--ag-pinned-row-background-color', '--muted', 'totals footer ground'],
  ['--ag-pinned-row-text-color', '--foreground', 'totals footer ink'],
  ['--ag-pinned-row-border', '--border-strong', 'rule above the footer'],
  ['--ag-pinned-column-border', '--border-strong', 'rule beside a pinned column'],
  ['--ag-input-background-color', '--card', 'grid filter input ground'],
  ['--ag-input-border', '--input', 'grid filter input border'],
  ['--ag-invalid-color', '--danger', 'validation'],
]

async function driveDeliveries({ theme, dir }) {
  const label = `${theme}/${dir}`
  // Wide enough that column virtualisation renders the store code, the money
  // and the name columns this pass reads (Deliveries has 41 columns).
  const { context, page, errors } = await openContext({ theme, dir, width: 3200 })
  const token = tokenOf(page)
  await loadDeliveries(page)

  const cdp = await context.newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  // The faces Chromium actually used for the text in `selector` — read on the
  // element that OWNS the text node (AG Grid wraps a value in a span), tagged
  // for CDP and untagged again.
  async function renderedFonts(selector) {
    const tagged = await page.evaluate((sel) => {
      const host = document.querySelector(sel)
      if (!host) return false
      const owner = [host, ...host.querySelectorAll('*')].find((el) =>
        [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
      )
      owner?.setAttribute('data-font-probe', '')
      return !!owner
    }, selector)
    if (!tagged) return []
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-font-probe]' })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    await page.evaluate(() => document.querySelector('[data-font-probe]')?.removeAttribute('data-font-probe'))
    return fonts.map((f) => ({ family: f.familyName, custom: f.isCustomFont }))
  }
  const show = (fonts) => fonts.map((f) => f.family).join(', ') || 'none'

  const want = {
    card: await token('--card'),
    foreground: await token('--foreground'),
    gridHead: await token('--grid-head'),
    gridHeadForeground: await token('--grid-head-foreground'),
    card2: await token('--card-2'),
    primary050: await token('--primary-050'),
    cursor: await token('--cursor'),
    danger: await token('--danger'),
    primaryForeground: await token('--primary-foreground'),
  }

  // 1. every param resolves to its token
  const raw = await page.evaluate((names) => {
    const cs = getComputedStyle(document.querySelector('.ag-root-wrapper'))
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n)]))
  }, AG_PARAMS.map(([ag]) => ag))

  const mismatches = []
  for (const [ag, tok, paints] of AG_PARAMS) {
    const got = await asColor(page, raw[ag] || 'transparent')
    const expected = await token(tok)
    if (got !== expected || !raw[ag]) mismatches.push(`${ag} (${paints}) = ${raw[ag] || 'EMPTY'}, want ${tok}`)
  }
  check(`${label}: all ${AG_PARAMS.length} grid params resolve to their tokens`, mismatches.length === 0, mismatches.join(' | '))

  const scheme = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.ag-root-wrapper')).getPropertyValue('--ag-browser-color-scheme').trim(),
  )
  check(`${label}: browserColorScheme still switches on data-ag-theme-mode`, scheme === theme, scheme)

  // 2. the painted DOM. The header ground rides `.ag-header-row::after` and the
  //    hover/selection overlay rides the cell container's `::before` — read
  //    where v36 actually paints, not where it is convenient to look.
  const got = await page.evaluate(() => {
    const s = (sel, prop, pseudo) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el, pseudo)[prop] : null
    }
    const headText = document.querySelector('.ag-header-cell-text')
    const cell = (col) => {
      const el = document.querySelector(`.ag-row:not(.ag-header-row) .ag-cell[col-id="${col}"]`)
      if (!el) return null
      const c = getComputedStyle(el)
      return { family: c.fontFamily, weight: c.fontWeight, size: c.fontSize }
    }
    return {
      rowGround: s('.ag-row:not(.ag-header-row)', 'backgroundColor'),
      cellInk: s('.ag-cell', 'color'),
      headerGround: s('.ag-header-row', 'backgroundColor', '::after'),
      headerInk: s('.ag-header-cell-text', 'color'),
      rowHeight: document.querySelector('.ag-row:not(.ag-header-row)')?.getBoundingClientRect().height,
      headerHeight: document.querySelector('.ag-header-row-column')?.getBoundingClientRect().height,
      headFont: headText ? `${getComputedStyle(headText).fontSize}/${getComputedStyle(headText).fontWeight}` : null,
      radius: s('.ag-root-wrapper', 'borderRadius'),
      zebra: [...document.querySelectorAll('.ag-row:not(.ag-header-row)')]
        .slice(0, 2)
        .map((r) => getComputedStyle(r).backgroundColor),
      deliveryNo: cell('deliveryNo'),
      documentNo: cell('documentNo'),
      orderNo: cell('orderNo'),
      storeCode: cell('storeCode'),
      netTotal: cell('netTotal'),
      customerName: cell('customerName'),
      monoSemibold: [...document.fonts].some(
        (f) => /IBM Plex Mono/.test(f.family) && f.weight === '600' && f.status === 'loaded',
      ),
    }
  })
  check(`${label}: row ground paints --card`, got.rowGround === want.card, `${got.rowGround}`)
  check(`${label}: cell ink paints --foreground`, got.cellInk === want.foreground, `${got.cellInk}`)
  check(`${label}: header ground paints --grid-head`, got.headerGround === want.gridHead, `${got.headerGround}`)
  check(
    `${label}: header ink paints --grid-head-foreground`,
    got.headerInk === want.gridHeadForeground,
    `${got.headerInk}`,
  )
  check(`${label}: a row measures 26px`, got.rowHeight === 26, `${got.rowHeight}`)
  check(`${label}: the header row measures 28px`, got.headerHeight === 28, `${got.headerHeight}`)
  check(`${label}: header labels are 11.5px / 600`, got.headFont === '11.5px/600', `${got.headFont}`)
  check(`${label}: the grid wrapper radius is 8px`, got.radius === '8px', `${got.radius}`)
  check(
    `${label}: no zebra — consecutive rows share the --card ground`,
    got.zebra.length === 2 && got.zebra.every((c) => c === want.card),
    got.zebra.join(' / '),
  )

  // IDs in Plex Mono (359, 362 §6) — the Delivery no. at 600 — and money in the sans.
  const isMono = (c) => !!c && /^"?IBM Plex Mono"?/.test(c.family)
  const isSans = (c) => !!c && /^"?IBM Plex Sans"?,/.test(c.family)
  check(
    `${label}: the Delivery no. computes Plex Mono at weight 600`,
    isMono(got.deliveryNo) && got.deliveryNo.weight === '600',
    JSON.stringify(got.deliveryNo),
  )
  const deliveryNoFaces = await renderedFonts('.ag-row:not(.ag-header-row) .ag-cell[col-id="deliveryNo"]')
  check(
    `${label}: …and RENDERS in the self-hosted Plex Mono, its 600 face loaded (no faux bold)`,
    deliveryNoFaces.length > 0 &&
      deliveryNoFaces.every((f) => f.family.startsWith('IBM Plex Mono') && f.custom) &&
      got.monoSemibold,
    `${show(deliveryNoFaces)} · 600 loaded ${got.monoSemibold}`,
  )
  check(
    `${label}: document no., order no. and store code compute Plex Mono at 400`,
    [got.documentNo, got.orderNo, got.storeCode].every((c) => isMono(c) && c.weight === '400'),
    [got.documentNo, got.orderNo, got.storeCode].map((c) => c?.family.split(',')[0]).join(' · '),
  )
  check(
    `${label}: money and names stay in Plex Sans`,
    isSans(got.netTotal) && isSans(got.customerName),
    `${got.netTotal?.family.split(',')[0]} · ${got.customerName?.family.split(',')[0]}`,
  )
  check(
    `${label}: the cells are 12px`,
    [got.deliveryNo, got.netTotal].every((c) => c?.size === '12px'),
    `${got.deliveryNo?.size} · ${got.netTotal?.size}`,
  )

  // Hover — must move to --card-2, not the page ground.
  await page.hover('.ag-row:not(.ag-header-row) .ag-cell')
  await page.waitForTimeout(300)
  const hover = await page.evaluate(() => {
    const row = document.querySelector('.ag-row-hover')
    return row ? getComputedStyle(row.querySelector('.ag-grid-scrolling-cells'), '::before').backgroundColor : null
  })
  check(`${label}: row hover paints --card-2`, hover === want.card2, `${hover} (want ${want.card2})`)

  // 3. native copy (F9): drag across the Delivery no.'s text, Ctrl+C, and the
  //    clipboard holds it. The second row — the first is the failed-jobs one.
  await page.evaluate(() => navigator.clipboard.writeText(''))
  const span = await page.evaluate(() => {
    const cell = [...document.querySelectorAll('.ag-row:not(.ag-header-row) .ag-cell[col-id="deliveryNo"]')].find(
      (c) => c.textContent.trim() === '8000002',
    )
    if (!cell) return null
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
    let text = walker.nextNode()
    while (text && !text.textContent.trim()) text = walker.nextNode()
    const range = document.createRange()
    range.selectNodeContents(text)
    const r = range.getBoundingClientRect()
    return { left: r.left, right: r.right, y: r.top + r.height / 2, userSelect: getComputedStyle(cell).userSelect }
  })
  check(`${label}: cell text is selectable (user-select: text)`, span?.userSelect === 'text', `${span?.userSelect}`)
  if (span) {
    await page.mouse.move(span.left + 1, span.y)
    await page.mouse.down()
    await page.mouse.move(span.right - 1, span.y, { steps: 8 })
    await page.mouse.move(span.right + 2, span.y, { steps: 2 })
    await page.mouse.up()
    const selected = await page.evaluate(() => window.getSelection().toString())
    await page.keyboard.press('Control+C')
    await page.waitForTimeout(150)
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    check(
      `${label}: drag-select a cell's text + Ctrl+C puts it on the clipboard`,
      clip.trim() === '8000002',
      `selection "${selected}" → clipboard "${clip}"`,
    )
  } else {
    check(`${label}: the Delivery no. 8000002 cell is on screen to copy from`, false, 'not found')
  }
  await page.evaluate(() => window.getSelection().removeAllRanges())

  // 4. selection — the --primary-050 ground is AG's own overlay; the 3px
  //    `--cursor` bar is our one CSS escape. Move the pointer off the row
  //    first: a hovered+selected row is deliberately painted with the HOVER colour.
  await page.click('.ag-row:not(.ag-header-row) .ag-cell[col-id="customerName"]')
  await page.mouse.move(10, 10)
  await page.waitForTimeout(300)
  const sel = await page.evaluate(() => {
    const row = document.querySelector('.ag-row-selected')
    if (!row) return null
    const bar = getComputedStyle(row, '::before')
    return {
      ground: getComputedStyle(row.querySelector('.ag-grid-scrolling-cells'), '::before').backgroundColor,
      bar: bar.backgroundColor,
      barWidth: bar.width,
      left: bar.left,
      z: bar.zIndex,
      // The row's own background layer must survive — the bar rides ::before
      // precisely so it does.
      rowLayer: getComputedStyle(row, '::after').backgroundColor,
    }
  })
  check(`${label}: selected row ground paints --primary-050`, sel?.ground === want.primary050, `${sel?.ground}`)
  check(
    `${label}: selected row bar paints --cursor (${theme === 'dark' ? 'gold' : 'navy'}), 3px, leading edge, z-index 3`,
    sel?.bar === want.cursor && sel?.barWidth === '3px' && sel?.left === '0px' && sel?.z === '3',
    `${sel?.bar} / ${sel?.barWidth} / left ${sel?.left} / z ${sel?.z}`,
  )
  check(
    `${label}: the row's own background layer is intact (bar did not take ::after)`,
    sel?.rowLayer === want.card,
    `${sel?.rowLayer}`,
  )

  // 5. the cursor bar stays VISIBLE over a column the USER pinned at the start
  //    (362 §6: v36 pinned cells paint over the row's ::before). The column
  //    state is set through the grid's own api — the same call the column
  //    drag / saved views make — taken from the app's AG Grid module instance.
  const pinned = await page.evaluate(async () => {
    const url = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((n) => /\/\.vite\/deps\/ag-grid-community\.js/.test(n))
    if (!url) return 'ag-grid-community module not found'
    const { getGridApi } = await import(url)
    const api = getGridApi(document.querySelector('.ag-root-wrapper'))
    if (!api) return 'grid api not found'
    api.applyColumnState({ state: [{ colId: 'deliveryNo', pinned: 'left' }] })
    return 'ok'
  })
  await page.mouse.move(10, 10)
  await page.waitForTimeout(400)
  const geo = await page.evaluate(() => {
    const row = document.querySelector('.ag-row-selected')
    const pinnedCell = row?.querySelector('.ag-cell[col-id="deliveryNo"].ag-cell-last-left-pinned')
    if (!row || !pinnedCell) return null
    const r = row.getBoundingClientRect()
    const c = pinnedCell.getBoundingClientRect()
    return { x: Math.floor(r.left) + 1, y: Math.floor(r.top + r.height / 2), cellLeft: c.left - r.left }
  })
  check(
    `${label}: the Delivery no. is pinned at the row's start`,
    pinned === 'ok' && geo?.cellLeft === 0,
    `${pinned} · ${JSON.stringify(geo)}`,
  )
  if (geo) {
    const visible = await pixelAt(page, geo.x, geo.y)
    check(
      `${label}: the cursor bar is VISIBLE over the pinned cell (screen pixel = --cursor)`,
      near(visible, want.cursor),
      `${visible} (want ${want.cursor})`,
    )
    // Control: at the old z-index 1 the pinned cell buries the bar — the check
    // above can tell the difference, so its pass is not vacuous.
    await page.addStyleTag({
      content: '.ag-row-selected:not(.ag-full-width-row)::before { z-index: 1 !important }',
    })
    await page.waitForTimeout(100)
    const buried = await pixelAt(page, geo.x, geo.y)
    check(`${label}: control — at z-index 1 the pinned cell paints over the bar`, !near(buried, want.cursor), buried)
  }
  await page.screenshot({ path: `${SHOTS}/deliveries-${theme}-${dir}.png` })

  // 6. the failed-jobs cellStyle pair — on a fresh load, which also drops the
  //    pin and the control style.
  await loadDeliveries(page)
  const cell = await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ag-cell')) {
      if (el.style.backgroundColor) {
        const s = getComputedStyle(el)
        return { inline: el.style.backgroundColor, bg: s.backgroundColor, ink: s.color }
      }
    }
    return null
  })
  check(
    `${label}: failed-jobs cell is --danger ground with --primary-foreground ink`,
    cell?.bg === want.danger && cell?.ink === want.primaryForeground,
    `${cell?.inline} → ${cell?.bg} / ${cell?.ink}`,
  )

  // 7. the bar mirrors. AG Grid writes its own `direction` onto the grid root
  //    (that is what `enableRtl` flips, and 383 wires it), so flipping the root
  //    is exactly the switch — the bar's spelling must be logical.
  await page.click('.ag-row:not(.ag-header-row) .ag-cell[col-id="customerName"]')
  await page.waitForTimeout(200)
  const barEdges = () =>
    page.evaluate(() => {
      const a = getComputedStyle(document.querySelector('.ag-row-selected'), '::before')
      return { left: a.left, right: a.right }
    })
  const ltrBar = await barEdges()
  await page.evaluate(() => document.querySelector('.ag-root-wrapper').setAttribute('dir', 'rtl'))
  await page.waitForTimeout(300)
  const rtlBar = await barEdges()
  check(
    `${label}: the cursor bar sits on the leading edge and mirrors under a flipped grid`,
    ltrBar.left === '0px' && rtlBar.right === '0px' && rtlBar.left !== '0px',
    `ltr ${JSON.stringify(ltrBar)} · rtl ${JSON.stringify(rtlBar)}`,
  )

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

for (const dir of ['ltr', 'rtl']) for (const theme of ['light', 'dark']) await driveDeliveries({ theme, dir })

// --- the other grid modules paint from the same block ------------------------

const { context, page, errors } = await openContext({ theme: 'light', dir: 'ltr' })
const token = tokenOf(page)

// `oms.darkMode` is the key both `src/layout/theme.ts` and index.html's
// pre-paint script use; the class + the AG attribute are what they set from it.
const setTheme = (theme) =>
  page.evaluate((t) => {
    localStorage.setItem('oms.darkMode', String(t === 'dark'))
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.dataset.agThemeMode = t
  }, theme)

// The same surface list the Deliveries grid was checked against, run inside an
// arbitrary scope so each module is asserted rather than merely screenshotted.
// Returns false when no grid is mounted in the scope, so the caller can report
// an honest skip instead of a silent pass.
async function assertGridReadsTokens(scope, label) {
  const want = {
    card: await token('--card'),
    foreground: await token('--foreground'),
    gridHead: await token('--grid-head'),
    gridHeadForeground: await token('--grid-head-foreground'),
    primary050: await token('--primary-050'),
    cursor: await token('--cursor'),
  }
  const got = await page.evaluate((root) => {
    const s = (sel, prop, pseudo) => {
      const el = document.querySelector(`${root} ${sel}`)
      return el ? getComputedStyle(el, pseudo)[prop] : null
    }
    // Sample a row the app has NOT deliberately overridden — the Jobs tab's
    // first row is the `--danger` failed-job style, which is asserted
    // separately and would read as a failure here.
    const rows = [...document.querySelectorAll(`${root} .ag-row:not(.ag-header-row)`)]
    const plain = rows.find((r) => !r.style.backgroundColor)
    if (!plain) return null
    return {
      rowGround: getComputedStyle(plain).backgroundColor,
      cellInk: getComputedStyle(plain.querySelector('.ag-cell')).color,
      cellSelect: getComputedStyle(plain.querySelector('.ag-cell')).userSelect,
      rowHeight: plain.getBoundingClientRect().height,
      headerHeight: document.querySelector(`${root} .ag-header-row-column`)?.getBoundingClientRect().height,
      headerGround: s('.ag-header-row', 'backgroundColor', '::after'),
      headerInk: s('.ag-header-cell-text', 'color'),
    }
  }, scope)
  if (!got) return false

  const wrong = []
  if (got.rowGround !== want.card) wrong.push(`row ground ${got.rowGround} != --card`)
  if (got.cellInk !== want.foreground) wrong.push(`cell ink ${got.cellInk} != --foreground`)
  if (got.headerGround !== want.gridHead) wrong.push(`header ground ${got.headerGround} != --grid-head`)
  if (got.headerInk !== want.gridHeadForeground) wrong.push(`header ink ${got.headerInk} != --grid-head-foreground`)
  if (got.rowHeight !== 26) wrong.push(`row ${got.rowHeight}px != 26`)
  if (got.headerHeight !== 28) wrong.push(`header ${got.headerHeight}px != 28`)
  // Native copy reaches every grid through the global options (F9).
  if (got.cellSelect !== 'text') wrong.push(`cell user-select ${got.cellSelect} != text`)

  // Selection, on this module's own grid. Several of these grids are read-only
  // inquiry surfaces with no row selection enabled (the Details tabs, BBY), so
  // a row that will not select is a NOT-APPLICABLE, not a failure — say which.
  await page.click(`${scope} .ag-row:not(.ag-header-row) .ag-cell`).catch(() => {})
  await page.mouse.move(4, 4)
  await page.waitForTimeout(250)
  const sel = await page.evaluate((root) => {
    const row = document.querySelector(`${root} .ag-row-selected`)
    if (!row) return null
    const bar = getComputedStyle(row, '::before')
    const cells = row.querySelector('.ag-grid-scrolling-cells')
    return {
      ground: cells ? getComputedStyle(cells, '::before').backgroundColor : null,
      bar: bar.backgroundColor,
      barWidth: bar.width,
    }
  }, scope)
  if (sel) {
    if (sel.ground !== want.primary050) wrong.push(`selection ground ${sel.ground} != --primary-050`)
    if (sel.bar !== want.cursor || sel.barWidth !== '3px') wrong.push(`cursor bar ${sel.bar}/${sel.barWidth}`)
  }

  check(
    `${label}: 26/28, selectable text, header, rows and ink${sel ? ' and selection' : ''} read from the tokens`,
    wrong.length === 0,
    wrong.join(' | '),
  )
  if (!sel) skip(`${label} — selection not asserted (row selection is off on this grid)`)
  return true
}

// Document Details — DetailGrid, reused across four tabs (Items, Conditions,
// Log, Jobs); Jobs also carries the second cellStyle pair. Each tab panel stays
// mounted (D-23), so each is asserted through its own tabpanel scope.
for (const theme of ['light', 'dark']) {
  await page.goto(BASE + '/oms/document/1000000393')
  await setTheme(theme)
  await page.waitForSelector('.ag-root', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(600)
  const want = { danger: await token('--danger'), ink: await token('--primary-foreground') }

  for (const tab of ['items', 'conditions', 'log', 'jobs']) {
    await page.click(`#tab-${tab}`).catch(() => {})
    await page.waitForTimeout(500)
    const asserted = await assertGridReadsTokens(`#tabpanel-${tab}`, `${theme}: Document Details · ${tab}`)
    if (!asserted) skip(`${theme}: Document Details · ${tab} — no rows in this tab's grid`)
    await page.screenshot({ path: `${SHOTS}/document-${tab}-${theme}.png` })
  }
  const jobRow = await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ag-row')) {
      if (el.style.backgroundColor) {
        const s = getComputedStyle(el)
        return { bg: s.backgroundColor, ink: s.color }
      }
    }
    return null
  })
  check(
    `${theme}: failed-job row is --danger ground with --primary-foreground ink`,
    jobRow?.bg === want.danger && jobRow?.ink === want.ink,
    `${jobRow?.bg} / ${jobRow?.ink}`,
  )

  // Change Store picker — a native <dialog>, so it is `dialog[open]`, not
  // `[role=dialog]`. It holds two grids but renders one at a time (the picker
  // is store-mode or district-mode, never both), and the command itself is
  // state-gated. Anything not reached is logged as a SKIP, never a silent pass.
  const changeStore = page.getByRole('button', { name: /change store/i }).first()
  const offered = (await changeStore.count()) > 0 && (await changeStore.isEnabled().catch(() => false))
  if (offered) {
    await changeStore.click().catch(() => {})
    await page.waitForTimeout(1000)
    const asserted = await assertGridReadsTokens('dialog[open]', `${theme}: Change Store picker`)
    if (!asserted) skip(`${theme}: Change Store dialog opened with no grid rows`)
    await page.screenshot({ path: `${SHOTS}/change-store-${theme}.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  } else {
    skip(`${theme}: Change Store not offered for this document state`)
  }
}

// BBY Inquiry (mocked contracts) and the Simulation bonus-buy panel.
for (const [name, path] of [
  ['bby-inquiry', '/pricing/bonus-buy-inquiry'],
  ['simulation', '/pricing/simulation'],
]) {
  for (const theme of ['light', 'dark']) {
    await page.goto(BASE + path)
    await setTheme(theme)
    await page.waitForSelector('main', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(900)
    const asserted = await assertGridReadsTokens('main', `${theme}: ${name}`)
    if (!asserted) skip(`${theme}: ${name} — no grid mounted on load (needs a result first)`)
    await page.screenshot({ path: `${SHOTS}/${name}-${theme}.png` })
  }
}

check('no page errors in the module pass', errors.length === 0, errors.slice(0, 3).join(' | '))

await context.close()
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
// The matrix is data-dependent (a state-gated command, a grid that only mounts
// on a result), so the denominator moves between runs. Print what was NOT
// covered — a bare "n/n passed" would read as "everything was covered".
if (skipped.length) console.log(`${skipped.length} skipped: ${skipped.join(' · ')}`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
