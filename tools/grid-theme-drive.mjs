// Grid theme drive (ticket 085) — proves the AG Grid theme paints from the app
// TOKENS, in both themes, on the real painted DOM.
//
// `npm run typecheck` cannot see this: the theme is a runtime CSS emission, and
// the whole risk of the change is that a `var(--token)` param serialises to
// something the browser drops. So this reads computed styles back out of a live
// grid and compares them to the same tokens resolved on the same document.
//
// The grid params are ONE block shared by every instance (that is the point of
// the ticket), so the param assertions run against the Deliveries grid and the
// other four modules are driven to confirm they paint from it too.
//
// SIS.Api's delivery list needs a store grant a dev session does not have (see
// tools/palette-drive.mjs's note), so every `/api/**` call is mocked here —
// matching the harness in tools/bby-inquiry-drive.mjs. Mocked data, real app,
// real browser, real CSS.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/grid-theme-drive.mjs
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

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.route('**/api/**', async (route) => {
  const url = route.request().url()
  const path = url.split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }),
    )
  if (path === 'SdDocument/DeliveryDocumentList')
    return route.fulfill(
      envelope([
        DELIVERY({ failedJobsCount: 3, deliveryNo: '8000001' }),
        DELIVERY({ failedJobsCount: 0, deliveryNo: '8000002', documentNo: '1000000394' }),
      ]),
    )
  if (/^SdDocument\/Document\/[^/]+\/Outbox$/.test(path))
    return route.fulfill(envelope([OUTBOX({ outboxStatus: 'F' }), OUTBOX({ outboxStatus: 'S' })]))
  if (/^SdDocument\/Document\/[^/]+\/Logs$/.test(path))
    return route.fulfill(envelope([{ documentNo: '1000000393', action: 'CREATE', createdOn: '2026-07-01T09:00:00' }]))
  if (/^SdDocument\/(Document|Delivery)\/[^/]+$/.test(path)) return route.fulfill(envelope(DOCUMENT))
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
  if (/Access$/.test(path)) return route.fulfill(envelope({ screenAllowed: true, allowed: true }))
  // Anything else (notifications, slots, …) → benign empty success.
  return route.fulfill(envelope({}))
})

// `oms.darkMode` is the key both `src/layout/theme.ts` and index.html's
// pre-paint script use; the class + the AG attribute are what they set from it.
const setTheme = (theme) =>
  page.evaluate((t) => {
    localStorage.setItem('oms.darkMode', String(t === 'dark'))
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.dataset.agThemeMode = t
  }, theme)

// Resolve a colour against the LIVE document. Both sides of every assertion go
// through this one probe, so a check reads "grid == app" — not "grid == a hex I
// retyped here" — and hex, rgb() and `var()` all compare. A border param
// serialises to `solid 1px <color>`, so only the last word is a colour.
const asColor = (expr) =>
  page.evaluate((e) => {
    const probe = document.createElement('div')
    probe.style.color = String(e).trim().split(/\s+/).pop()
    document.body.appendChild(probe)
    const v = getComputedStyle(probe).color
    probe.remove()
    return v
  }, expr)

const token = (name) => asColor(`var(${name})`)

async function loadDeliveries() {
  await page.goto(BASE + '/oms/deliveries')
  await page.waitForSelector('.ag-root', { timeout: 20000 }).catch(() => {})
  await page
    .getByRole('button', { name: /load/i })
    .first()
    .click()
    .catch(() => {})
  await page.waitForSelector('.ag-center-cols-container .ag-row', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(400)
}

// --- the params, on a populated grid, in both themes -------------------------

// Every param is asserted twice over: once as the `--ag-*` custom property the
// theme emits (which is where a `var()` that failed to serialise would show up
// as an empty string), and again on a painted element for the ones that reach
// pixels. Both sides are read from the same live document, so the assertion is
// "the grid equals the app", never "the grid equals a hex retyped in this file".
const AG_PARAMS = [
  ['--ag-background-color', '--card', 'grid body ground'],
  ['--ag-foreground-color', '--foreground', 'cell text'],
  ['--ag-header-background-color', '--muted', 'header ground'],
  ['--ag-header-text-color', '--muted-foreground', 'header labels'],
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
  ['--ag-input-background-color', '--card', 'grid filter input ground'],
  ['--ag-input-border', '--input', 'grid filter input border'],
  ['--ag-invalid-color', '--danger', 'validation'],
]

for (const theme of ['light', 'dark']) {
  await loadDeliveries()
  await setTheme(theme)
  await page.waitForTimeout(400)

  const want = {
    card: await token('--card'),
    foreground: await token('--foreground'),
    muted: await token('--muted'),
    mutedForeground: await token('--muted-foreground'),
    card2: await token('--card-2'),
    primary: await token('--primary'),
    primary050: await token('--primary-050'),
    danger: await token('--danger'),
    primaryForeground: await token('--primary-foreground'),
  }

  // 1. every param resolves to its token
  const raw = await page.evaluate((names) => {
    const cs = getComputedStyle(document.querySelector('.ag-root-wrapper'))
    return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n)]))
  }, AG_PARAMS.map(([ag]) => ag))

  let mismatches = []
  for (const [ag, tok, paints] of AG_PARAMS) {
    const got = await asColor(raw[ag] || 'transparent')
    const expected = await token(tok)
    if (got !== expected || !raw[ag]) mismatches.push(`${ag} (${paints}) = ${raw[ag] || 'EMPTY'}, want ${tok}`)
  }
  check(
    `${theme}: all ${AG_PARAMS.length} grid params resolve to their tokens`,
    mismatches.length === 0,
    mismatches.join(' | '),
  )

  const scheme = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.ag-root-wrapper')).getPropertyValue('--ag-browser-color-scheme').trim(),
  )
  check(`${theme}: browserColorScheme still switches on data-ag-theme-mode`, scheme === theme, scheme)

  // 2. the painted DOM. The header ground rides `.ag-header-row::after` and the
  //    hover/selection overlay rides the cell container's `::before` — read
  //    where v36 actually paints, not where it is convenient to look.
  const got = await page.evaluate(() => {
    const s = (sel, prop, pseudo) => {
      const el = document.querySelector(sel)
      return el ? getComputedStyle(el, pseudo)[prop] : null
    }
    return {
      rowGround: s('.ag-row:not(.ag-header-row)', 'backgroundColor'),
      cellInk: s('.ag-cell', 'color'),
      headerGround: s('.ag-header-row', 'backgroundColor', '::after'),
      headerInk: s('.ag-header-cell-text', 'color'),
    }
  })
  check(`${theme}: row ground paints --card`, got.rowGround === want.card, `${got.rowGround}`)
  check(`${theme}: cell ink paints --foreground`, got.cellInk === want.foreground, `${got.cellInk}`)
  check(`${theme}: header ground paints --muted`, got.headerGround === want.muted, `${got.headerGround}`)
  check(`${theme}: header ink paints --muted-foreground`, got.headerInk === want.mutedForeground, `${got.headerInk}`)

  // Hover — must move to --card-2, not the page ground.
  await page.hover('.ag-row:not(.ag-header-row) .ag-cell')
  await page.waitForTimeout(300)
  const hover = await page.evaluate(() => {
    const row = document.querySelector('.ag-row-hover')
    return row ? getComputedStyle(row.querySelector('.ag-grid-scrolling-cells'), '::before').backgroundColor : null
  })
  check(`${theme}: row hover paints --card-2`, hover === want.card2, `${hover} (want ${want.card2})`)

  // Selection — the --primary-050 ground is AG's own overlay; the leading-edge
  // bar is our one CSS escape. Move the pointer off the row first: a
  // hovered+selected row is deliberately painted with the HOVER colour.
  await page.click('.ag-row:not(.ag-header-row) .ag-cell')
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
      // The row's own background layer must survive — the bar rides ::before
      // precisely so it does.
      rowLayer: getComputedStyle(row, '::after').backgroundColor,
    }
  })
  check(`${theme}: selected row ground paints --primary-050`, sel?.ground === want.primary050, `${sel?.ground}`)
  check(
    `${theme}: selected row accent bar paints --primary, 3px, leading edge`,
    sel?.bar === want.primary && sel?.barWidth === '3px' && sel?.left === '0px',
    `${sel?.bar} / ${sel?.barWidth} / left ${sel?.left}`,
  )
  check(
    `${theme}: the row's own background layer is intact (bar did not take ::after)`,
    sel?.rowLayer === want.card,
    `${sel?.rowLayer}`,
  )

  // The failed-jobs cellStyle pair.
  const cell = await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ag-cell')) {
      if (el.style.backgroundColor) {
        const s = getComputedStyle(el)
        return { inline: el.style.backgroundColor, bg: s.backgroundColor, ink: s.color, weight: s.fontWeight }
      }
    }
    return null
  })
  check(
    `${theme}: failed-jobs cell is --danger ground with --primary-foreground ink`,
    cell?.bg === want.danger && cell?.ink === want.primaryForeground,
    `${cell?.inline} → ${cell?.bg} / ${cell?.ink}`,
  )

  await page.screenshot({ path: `${SHOTS}/deliveries-${theme}.png` })
}

// --- the accent bar mirrors under dir="rtl" ----------------------------------

await loadDeliveries()
await page.click('.ag-row:not(.ag-header-row) .ag-cell')
await page.waitForTimeout(200)
const barEdges = () =>
  page.evaluate(() => {
    const a = getComputedStyle(document.querySelector('.ag-row-selected'), '::before')
    return { left: a.left, right: a.right }
  })
const ltrBar = await barEdges()
// AG Grid writes its own `direction` onto the grid root (that is what the
// `enableRtl` option flips), so flipping `<html>` alone would not reach a
// logical property inside the grid. Applying it to the grid root is exactly
// what `enableRtl` does — the switch this ticket declares a home for but
// deliberately does not wire.
await page.evaluate(() => document.querySelector('.ag-root-wrapper').setAttribute('dir', 'rtl'))
await page.waitForTimeout(300)
const rtlBar = await barEdges()
check(
  'selected-row bar sits on the leading edge and mirrors under dir="rtl"',
  ltrBar.left === '0px' && rtlBar.right === '0px' && rtlBar.left !== '0px',
  `ltr ${JSON.stringify(ltrBar)} · rtl ${JSON.stringify(rtlBar)}`,
)
await page.evaluate(() => document.querySelector('.ag-root-wrapper').removeAttribute('dir'))

// --- the other grid modules paint from the same block ------------------------

// The same surface list the Deliveries grid was checked against, run inside an
// arbitrary scope so each module is asserted rather than merely screenshotted.
// Returns false when no grid is mounted in the scope, so the caller can report
// an honest skip instead of a silent pass.
async function assertGridReadsTokens(scope, label) {
  const want = {
    card: await token('--card'),
    foreground: await token('--foreground'),
    muted: await token('--muted'),
    mutedForeground: await token('--muted-foreground'),
    primary050: await token('--primary-050'),
    primary: await token('--primary'),
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
      headerGround: s('.ag-header-row', 'backgroundColor', '::after'),
      headerInk: s('.ag-header-cell-text', 'color'),
    }
  }, scope)
  if (!got) return false

  const wrong = []
  if (got.rowGround !== want.card) wrong.push(`row ground ${got.rowGround} != --card`)
  if (got.cellInk !== want.foreground) wrong.push(`cell ink ${got.cellInk} != --foreground`)
  if (got.headerGround !== want.muted) wrong.push(`header ground ${got.headerGround} != --muted`)
  if (got.headerInk !== want.mutedForeground) wrong.push(`header ink ${got.headerInk} != --muted-foreground`)

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
    if (sel.bar !== want.primary || sel.barWidth !== '3px') wrong.push(`accent bar ${sel.bar}/${sel.barWidth}`)
  }

  check(
    `${label}: header, rows and ink${sel ? ' and selection' : ''} read from the tokens`,
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

check('no page errors during the drive', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
// The matrix is data-dependent (a state-gated command, a grid that only mounts
// on a result), so the denominator moves between runs. Print what was NOT
// covered — a bare "n/n passed" would read as "everything was covered".
if (skipped.length) console.log(`${skipped.length} skipped: ${skipped.join(' · ')}`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
