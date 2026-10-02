// Foundation drive (spec 380 step S1) — ticket 381 first; later S1 tickets extend it.
//
// 381: every screen paints in palette B, "Navy-led", set in IBM Plex. Proven here on the two
// screens S1 is judged on, Deliveries and Delivery details, in light, dark and RTL:
//   1. the page, card and rail grounds are palette B's values (362 §1–§2) — asserted against
//      362's hex, not against the token, because the claim is "these ARE the B values";
//   2. the face a cell is actually RENDERED in is IBM Plex Sans — read through the DevTools
//      protocol (`CSS.getPlatformFontsForNode`), not from `font-family`, which only names the
//      stack and would pass with every file missing;
//   3. an Arabic string renders in IBM Plex Sans Arabic, and that face carries 115% size-adjust;
//   4. a `font-mono` code renders in IBM Plex Mono;
//   5. a keyboard-focused button shows the 2px ring at a 2px offset — navy in light, GOLD in dark;
//   6. `core/ui/Button` is a 6px control, not a pill, and still 28px tall.
//   7. inside the (now navy) sidebar the focus ring is gold in both themes — the navy ring would
//      vanish on navy.
//
// 383: every grid mirrors under RTL and isolates its values. Direction is a boot fact, so every
// pass stores its locale (`oms.locale`: `en` or `ar`) before the app boots and index.html sets
// `<html dir>` from it — the real path, not a `dir` attribute forced from outside. Then, in the
// same four modes, on a viewport wide enough to render every column:
//   8. the Deliveries, Delivery details items, Change store, Central invoices and central-invoice
//      result grids are each RTL exactly when the page is (AG Grid's own `ag-rtl`, and the first
//      column painted at the reading start);
//   9. a Delivery no. pinned from the toolbar's own Pin control sits at the reading START;
//  10. a slot range, a `+966…` mobile, a negative amount and a date-time read in logical order —
//      measured as the rendered characters sorted by x, which is what an eye reads — with a
//      control that strips one isolate and must see the slot reverse.
// The Arabic text is a stub ROW value (there is no Arabic locale file, by design).
//
// Every `/api/**` call is stubbed (the delivery list needs a store grant a dev session lacks;
// see grid-theme-drive.mjs). Mocked data, real app, real browser, real CSS, real fonts.
//
//   1. run the app:  npx vite --port 5199   (any port; pass it as DRIVE_PORT)
//   2. node tools/foundation-drive.mjs
//
// Screenshots → tools/.foundation-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.foundation-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

const ARABIC_REASON = 'إلغاء بطلب العميل'

const DELIVERY = (over) => ({
  deliveryNo: '80001238',
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

const DOCUMENT = {
  documentNo: '1000000393',
  deliveryNo: '80001238',
  storeCode: '1001',
  documentType: 'CLCN',
  documentTypeDescription: 'Call Center',
  documentCategory: 'O',
  deliveryType: 'P',
  customerName: 'Test Customer',
  lines: [
    { itemNumber: '000010', materialCode: 'M1', materialDescription: 'Panadol 500mg', quantity: 2, netValue: 30 },
  ],
  conditions: [],
  status: { overallStatus: 'A', lastAction: 'X', lastActionDescription: 'Created' },
}

// Palette B (362 §1–§2), as the browser serialises it.
const PALETTE_B = {
  light: { background: 'rgb(242, 244, 248)', card: 'rgb(255, 255, 255)', ring: 'rgb(15, 76, 156)' },
  dark: { background: 'rgb(10, 17, 29)', card: 'rgb(17, 26, 40)', ring: 'rgb(253, 200, 1)' },
}
const NAVY = 'rgb(0, 37, 84)'

const browser = await chromium.launch()

// Theme and direction are stored BEFORE the app boots, and index.html's own pre-paint script
// turns them into `.dark` and `<html dir>` (383: direction is a boot fact, from the stored
// locale). There is no Arabic locale file, so `ar` renders the English strings under RTL.
async function bootAs(page, { theme, dir }) {
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )
}

async function driveOneMode({ theme, dir }) {
  const label = `${theme}/${dir}`
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await bootAs(page, { theme, dir })

  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'SdDocumentWeb/DeliveryDocumentList')
      return route.fulfill(
        envelope([
          DELIVERY({ failedJobsCount: 3 }),
          DELIVERY({ deliveryNo: '80001237', documentNo: '1000000394', reasonDescription: ARABIC_REASON }),
        ]),
      )
    if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(path)) return route.fulfill(envelope(DOCUMENT))
    if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path))
      return route.fulfill(envelope([]))
    if (/Access$/.test(path))
      return route.fulfill(
        envelope({ screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true }),
      )
    if (/\/(Outbox|Logs)$/.test(path)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const cdp = await context.newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')

  // The faces Chromium actually used for the text nodes directly inside the element tagged
  // `data-font-probe`. Found through CDP, then untagged again.
  async function probedFonts() {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-font-probe]' })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    await page.evaluate(() => document.querySelector('[data-font-probe]')?.removeAttribute('data-font-probe'))
    return fonts.map((f) => ({ family: f.familyName, glyphs: f.glyphCount, custom: f.isCustomFont }))
  }
  // …for the deepest element in `scope` whose OWN text contains `text`.
  async function renderedFonts(scope, text) {
    const found = await page.evaluate(
      ([s, t]) => {
        const root = document.querySelector(s)
        if (!root) return false
        const owner = [...root.querySelectorAll('*')].find((el) =>
          [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.includes(t)),
        )
        if (!owner) return false
        owner.setAttribute('data-font-probe', '')
        return true
      },
      [scope, text],
    )
    return found ? probedFonts() : []
  }
  const show = (fonts) => fonts.map((f) => `${f.family}×${f.glyphs}`).join(', ')

  const grounds = () =>
    page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      sidebar: (() => {
        const el = document.getElementById('layout-sidebar')
        return el ? getComputedStyle(el).backgroundColor : null
      })(),
    }))

  // Focus a button the way a keyboard user does, so `:focus-visible` (not just `:focus`) matches.
  // Then let the transition settle: Tailwind 4's `transition-colors` (core/ui/Button) animates
  // `outline-color` too, so a read on the focus frame catches the ring mid-fade from currentColor.
  async function ring(locator) {
    await page.keyboard.press('Shift')
    await locator.evaluate((el) => el.focus())
    await page.waitForTimeout(400)
    return locator.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        visible: el.matches(':focus-visible'),
        color: s.outlineColor,
        width: s.outlineWidth,
        style: s.outlineStyle,
        offset: s.outlineOffset,
      }
    })
  }

  // ---- Deliveries ----
  await page.goto(BASE + '/oms/deliveries')
  await page.getByRole('button', { name: /^load$/i }).waitFor({ timeout: 20000 })
  check(`${label}: the document direction is ${dir}`, (await page.evaluate(() => document.dir || 'ltr')) === dir)

  // Before any Arabic is on screen, the Arabic faces cost nothing (unicode-range gating).
  const arabicBefore = await page.evaluate(() =>
    [...document.fonts].filter((f) => /Plex Sans Arabic/.test(f.family)).map((f) => f.status),
  )
  check(
    `${label}: Deliveries — the four Arabic faces are declared and none is fetched before Arabic renders`,
    arabicBefore.length === 4 && arabicBefore.every((s) => s === 'unloaded'),
    arabicBefore.join(','),
  )

  await page.getByRole('button', { name: /^load$/i }).click()
  await page.waitForSelector(`.ag-cell >> text=${ARABIC_REASON}`, { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)

  const g = await grounds()
  check(`${label}: Deliveries — page ground is B's --background`, g.body === PALETTE_B[theme].background, g.body)
  check(`${label}: Deliveries — the sidebar is the brand navy in both themes`, g.sidebar === NAVY, g.sidebar)
  const card = await page.evaluate(() => getComputedStyle(document.querySelector('.ag-root-wrapper')).backgroundColor)
  check(`${label}: Deliveries — the grid card is B's --card`, card === PALETTE_B[theme].card, card)

  // A document-type cell: the ID columns are Plex Mono since 382 (grid-theme-drive.mjs
  // measures them), and the name column is past column virtualisation at this width.
  const cellFonts = await renderedFonts('.ag-root', 'CLCN')
  check(
    `${label}: Deliveries — a painted cell RENDERS in the self-hosted IBM Plex Sans`,
    cellFonts.length > 0 && cellFonts.every((f) => f.family === 'IBM Plex Sans' && f.custom),
    show(cellFonts),
  )
  // Every Arabic letter in Plex Sans Arabic; the spaces between words are Latin-range and fall to
  // Plex Sans, which is the unicode-range split working, not a fallback.
  const letters = ARABIC_REASON.replace(/\s/g, '').length
  const arabicFonts = await renderedFonts('.ag-root', ARABIC_REASON)
  check(
    `${label}: Deliveries — an Arabic cell RENDERS in IBM Plex Sans Arabic (Plex only, no platform face)`,
    arabicFonts.some((f) => f.family === 'IBM Plex Sans Arabic' && f.glyphs >= letters) &&
      arabicFonts.every((f) => /^IBM Plex Sans( Arabic)?$/.test(f.family) && f.custom),
    show(arabicFonts),
  )
  const arabicFaces = await page.evaluate(() =>
    [...document.fonts]
      .filter((f) => /Plex Sans Arabic/.test(f.family))
      .map((f) => ({ weight: f.weight, status: f.status, sizeAdjust: f.sizeAdjust })),
  )
  check(
    `${label}: Deliveries — the Arabic face loaded once Arabic rendered, and every Arabic face is size-adjust 115%`,
    arabicFaces.some((f) => f.status === 'loaded') && arabicFaces.every((f) => f.sizeAdjust === '115%'),
    JSON.stringify(arabicFaces),
  )
  const latinAdjust = await page.evaluate(() =>
    [...document.fonts].filter((f) => /^"?IBM Plex (Sans|Mono)"?$/.test(f.family)).map((f) => f.sizeAdjust),
  )
  check(
    `${label}: Deliveries — Latin Plex Sans and Mono are NOT size-adjusted`,
    latinAdjust.length === 3 && latinAdjust.every((v) => v === '100%'),
    latinAdjust.join(','),
  )

  const load = page.getByRole('button', { name: /^load$/i })
  const loadRing = await ring(load)
  check(
    `${label}: Deliveries — a keyboard-focused button shows the 2px ring at 2px, ${theme === 'dark' ? 'gold' : 'navy'}`,
    loadRing.visible &&
      loadRing.color === PALETTE_B[theme].ring &&
      loadRing.width === '2px' &&
      loadRing.style === 'solid' &&
      loadRing.offset === '2px',
    JSON.stringify(loadRing),
  )
  // The sidebar is navy in both themes, where the light navy ring would vanish (≈1.9:1): inside it
  // the ring is gold, the one thing gold on navy is for.
  const navRing = await ring(page.locator('#layout-sidebar a').first())
  check(
    `${label}: Deliveries — a focused sidebar link shows the GOLD ring in both themes`,
    navRing.visible && navRing.color === PALETTE_B.dark.ring && navRing.width === '2px',
    JSON.stringify(navRing),
  )
  await page.screenshot({ path: `${SHOTS}/deliveries-${theme}-${dir}.png` })

  // Ctrl+P on a grid screen (F19): the page AND the grid resolve light on paper. AG Grid sets its
  // own `color-scheme` on `.ag-styled-root` from `data-ag-theme-mode`, which is not media-scoped.
  await page.emulateMedia({ media: 'print' })
  const paper = await page.evaluate(() => ({
    body: getComputedStyle(document.body).backgroundColor,
    gridSchemes: [...new Set([...document.querySelectorAll('.ag-styled-root')].map((e) => getComputedStyle(e).colorScheme))],
  }))
  await page.emulateMedia({ media: 'screen' })
  check(
    `${label}: Deliveries printed — the page is light B and the grid's color-scheme is light`,
    paper.body === PALETTE_B.light.background && paper.gridSchemes.length > 0 && paper.gridSchemes.every((c) => c === 'light'),
    JSON.stringify(paper),
  )

  // ---- Delivery details ----
  await page.goto(BASE + '/oms/document/1000000393')
  const actions = page.locator('section[aria-label="Actions"]')
  await actions.waitFor({ timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)

  const dg = await grounds()
  check(`${label}: Details — page ground is B's --background`, dg.body === PALETTE_B[theme].background, dg.body)
  const actionsGround = await actions.evaluate((el) => getComputedStyle(el).backgroundColor)
  check(`${label}: Details — the command card is B's --card`, actionsGround === PALETTE_B[theme].card, actionsGround)

  // `core/ui/Button` — every button in the command bar is one.
  const shapes = await actions
    .locator('button')
    .evaluateAll((els) =>
      els.map((el) => ({ radius: getComputedStyle(el).borderRadius, height: el.getBoundingClientRect().height })),
    )
  check(
    `${label}: Details — core/ui/Button is a 6px control, not a pill, and still 28px tall`,
    shapes.length > 0 && shapes.every((s) => s.radius === '6px' && Math.round(s.height) === 28),
    JSON.stringify(shapes.slice(0, 3)) + ` (${shapes.length} buttons)`,
  )
  const commandRing = await ring(actions.locator('button').first())
  check(
    `${label}: Details — a focused command shows the ${theme === 'dark' ? 'gold' : 'navy'} ring`,
    commandRing.visible && commandRing.color === PALETTE_B[theme].ring && commandRing.width === '2px',
    JSON.stringify(commandRing),
  )

  // The `.font-mono` element ITSELF is tagged — searching by its text could land on some other
  // element that happens to contain the same short code.
  const mono = await page.evaluate(() => {
    const el = [...document.querySelectorAll('main .font-mono')].find((e) =>
      [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()),
    )
    if (!el) return null
    el.setAttribute('data-font-probe', '')
    return el.textContent.trim()
  })
  if (mono) {
    const monoFonts = await probedFonts()
    check(
      `${label}: Details — a font-mono code RENDERS in IBM Plex Mono`,
      monoFonts.length > 0 && monoFonts.every((f) => f.family.startsWith('IBM Plex Mono') && f.custom),
      `"${mono}" → ${show(monoFonts)}`,
    )
  } else {
    check(`${label}: Details — a font-mono code is on the page to measure`, false, 'none found')
  }
  await page.screenshot({ path: `${SHOTS}/details-${theme}-${dir}.png` })

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ---- 383: every grid mirrors under RTL and isolates its values ----------------------------------

// A real captured order (078): an eRx line carrying a NEGATIVE discount (-1.50).
const ERX = JSON.parse(readFileSync('.issues/assets/078-document-payloads/2000000551-erx.json', 'utf8')).data

const SLOT = '08:00 - 10:00'
const MOBILE = '+966 55 810 2177'
const ARABIC_NAME = 'نورة الحربي'
const ARABIC_CITY = 'الرياض'

const GRID_DELIVERY = (over) =>
  DELIVERY({
    deliveryNo: '80001240',
    timeSlotDescription: SLOT,
    customerPhone: MOBILE,
    entryTime: '2026-07-01T09:12:00',
    amountDue: -5,
    customerName: ARABIC_NAME,
    cityName: ARABIC_CITY,
    ...over,
  })

const LIST_ROW = (over) => ({
  id: 'A1',
  deliveryNo: '8006456897',
  storeCode: 'P983',
  country: 'SA',
  requestedBy: 'msartawi',
  requestedAt: '2026-09-29T10:15:00',
  reason: 'سُلّمت أثناء التحول ولم تُفوتر',
  status: 'BILLED',
  refusalCode: '',
  trxNumber: 'I8006456897',
  invoiceTotal: 151.5,
  cashRemainder: -5.125,
  billedAt: '2026-09-29T10:20:00',
  pickDocumentNo: 'P-000123',
  pickOutcome: 'CONSUMED',
  serialisedInGs1Market: false,
  serials: [],
  ...over,
})

async function routeGrids(route) {
  const req = route.request()
  const path = req.url().split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }),
    )
  if (path === 'SdDocumentWeb/DeliveryDocumentList')
    return route.fulfill(envelope([GRID_DELIVERY({}), GRID_DELIVERY({ deliveryNo: '80001239', documentNo: '1000000394' })]))
  if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(path)) return route.fulfill(envelope(ERX))
  if (/\/(Outbox|Logs)$/.test(path)) return route.fulfill(envelope([]))
  if (path === 'SdDocument/StoreDetails')
    return route.fulfill(
      envelope([
        { storeCode: '1001', city: ARABIC_CITY, region: 'الوسطى', storeAddress: 'طريق الملك فهد', deliveryStore: true },
        { storeCode: '1002', city: 'Jeddah', region: 'Western', storeAddress: 'Tahlia St', deliveryStore: false },
      ]),
    )
  if (path === 'SdDocument/Districts')
    return route.fulfill(
      envelope([
        { districtNameEn: 'Al Olaya', districtNameAr: 'العليا', cityNameEn: 'Riyadh', cityNameAr: ARABIC_CITY, storeCode: '1001', tempStoreCode: '', insuranceStoreCode: '' },
      ]),
    )
  if (path === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
  if (path === 'Sd/CentralInvoice' && req.method() === 'GET')
    return route.fulfill(envelope({ rows: [LIST_ROW({}), LIST_ROW({ id: 'A2', deliveryNo: '8006456512', cashRemainder: 0 })] }))
  if (path === 'Sd/CentralInvoice' && req.method() === 'POST') {
    const body = JSON.parse(req.postData() ?? '{}')
    return route.fulfill(
      envelope({
        results: body.deliveryNos.map((no) => ({
          deliveryNo: no,
          verdict: 'wait',
          code: 'CINV-CHANGED-RECENTLY',
          message: `Delivery ${no} changed in the last 24 hours; wait and send it again.`,
        })),
      }),
    )
  }
  if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path)) return route.fulfill(envelope([]))
  if (/Access$/.test(path))
    return route.fulfill(
      envelope({ canOpen: true, screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true }),
    )
  return route.fulfill(envelope([]))
}

// Is the grid in `scope` mirrored, and does its first column paint at the reading start? Both
// AG Grid's own class AND geometry: the first two header cells' order on screen.
const gridDirection = (page, scope) =>
  page.evaluate((s) => {
    const root = document.querySelector(`${s} .ag-root-wrapper`)
    if (!root) return null
    const heads = [...root.querySelectorAll('.ag-header-row-column .ag-header-cell')]
      .filter((h) => h.getAttribute('aria-colindex'))
      .sort((a, b) => Number(a.getAttribute('aria-colindex')) - Number(b.getAttribute('aria-colindex')))
    const [first, second] = heads.map((h) => h.getBoundingClientRect())
    return {
      // AG Grid marks the direction it was CREATED with on the grid's own element.
      rtlClass: root.closest('.ag-rtl, .ag-ltr')?.classList.contains('ag-rtl') ?? null,
      firstAtStart: first && second ? (first.left > second.left ? 'rtl' : 'ltr') : null,
    }
  }, scope)

// The text of `el` as an eye reads it: every rendered character sorted by x, left to right. For a
// machine value that reads correctly this equals its logical text in BOTH directions.
const visualOrderIn = (page, scope, colId, rowSel = '') =>
  page.evaluate(
    ([s, c, r]) => {
      const cell = document.querySelector(`${s} .ag-row${r}:not(.ag-header-row) .ag-cell[col-id="${c}"]`)
      if (!cell) return null
      const chars = []
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        for (let i = 0; i < n.textContent.length; i++) {
          const range = document.createRange()
          range.setStart(n, i)
          range.setEnd(n, i + 1)
          const box = range.getBoundingClientRect()
          if (box.width > 0) chars.push({ ch: n.textContent[i], x: box.left + box.width / 2 })
        }
      }
      return {
        logical: cell.textContent.trim(),
        visual: chars
          .sort((a, b) => a.x - b.x)
          .map((x) => x.ch)
          .join('')
          .trim(),
        isolated: !!cell.querySelector('bdi'),
      }
    },
    [scope, colId, rowSel],
  )

async function driveGrids({ theme, dir }) {
  const label = `${theme}/${dir} grids`
  const want = dir
  const context = await browser.newContext({ viewport: { width: 3400, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await bootAs(page, { theme, dir })
  await page.route('**/api/**', routeGrids)

  const mirrored = async (name, scope) => {
    const d = await gridDirection(page, scope)
    check(
      `${label}: ${name} — the grid is ${want.toUpperCase()} (ag-rtl ${want === 'rtl'}, first column at the reading start)`,
      !!d && d.rtlClass === (want === 'rtl') && d.firstAtStart === want,
      JSON.stringify(d),
    )
  }
  const readsInOrder = async (name, scope, colId, expected, rowSel = '') => {
    const v = await visualOrderIn(page, scope, colId, rowSel)
    check(
      `${label}: ${name} reads "${expected}" in order`,
      !!v && v.logical === expected && v.visual === expected && v.isolated,
      JSON.stringify(v),
    )
  }

  // ---- Deliveries ----
  await page.goto(BASE + '/oms/deliveries')
  await page.getByRole('button', { name: /^load$/i }).waitFor({ timeout: 20000 })
  const html = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }))
  check(
    `${label}: index.html set <html dir> from the stored locale before boot (lang stays i18n's en)`,
    html.dir === dir && html.lang === 'en',
    JSON.stringify(html),
  )
  await page.getByRole('button', { name: /^load$/i }).click()
  await page.waitForSelector('main .ag-row:not(.ag-header-row)', { timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  await mirrored('Deliveries', 'main')
  const firstRow = '[row-index="0"]'
  await readsInOrder('Deliveries — the slot', 'main', 'timeSlotDescription', SLOT, firstRow)
  await readsInOrder('Deliveries — the +966 mobile', 'main', 'customerPhone', MOBILE, firstRow)
  await readsInOrder('Deliveries — a negative amount due', 'main', 'amountDue', '-5.00', firstRow)
  await readsInOrder('Deliveries — the entry date-time', 'main', 'entryTime', '2026-07-01 09:12', firstRow)
  // Numbers stay at the cell's END (F28): the money cell's text hugs the inline-end edge.
  const moneyEdge = await page.evaluate(() => {
    const cell = document.querySelector('main .ag-row[row-index="0"] .ag-cell[col-id="amountDue"]')
    const text = cell?.querySelector('bdi')
    if (!cell || !text) return null
    const c = cell.getBoundingClientRect()
    const t = text.getBoundingClientRect()
    return { startGap: Math.round(t.left - c.left), endGap: Math.round(c.right - t.right) }
  })
  check(
    `${label}: Deliveries — money sits at the cell's ${dir === 'rtl' ? 'left' : 'right'} (its inline end)`,
    !!moneyEdge && (dir === 'rtl' ? moneyEdge.startGap < moneyEdge.endGap : moneyEdge.endGap < moneyEdge.startGap),
    JSON.stringify(moneyEdge),
  )
  // Control: the check can fail. Strip the slot's isolate and the same measure reverses it under
  // RTL (378's `10:00 - 08:00`); under LTR nothing moves.
  await page.evaluate(() => {
    const bdi = document.querySelector('main .ag-row[row-index="0"] .ag-cell[col-id="timeSlotDescription"] bdi')
    bdi?.replaceWith(document.createTextNode(bdi.textContent))
  })
  const stripped = await visualOrderIn(page, 'main', 'timeSlotDescription', firstRow)
  check(
    `${label}: control — the slot WITHOUT its isolate ${dir === 'rtl' ? 'reverses' : 'still reads in order'}`,
    !!stripped && (dir === 'rtl' ? stripped.visual !== SLOT : stripped.visual === SLOT),
    JSON.stringify(stripped),
  )

  // The Delivery no., pinned through the toolbar's own Pin control.
  await page.getByRole('button', { name: /^columns$/i }).click()
  await page.getByRole('button', { name: /^pin delivery no/i }).click()
  await page.keyboard.press('Escape')
  await page.mouse.move(5, 5)
  await page.waitForTimeout(400)
  const pin = await page.evaluate(() => {
    const wrapper = document.querySelector('main .ag-root-wrapper')?.getBoundingClientRect()
    const cell = document.querySelector('main .ag-row[row-index="0"] .ag-cell[col-id="deliveryNo"]')
    if (!wrapper || !cell) return null
    const c = cell.getBoundingClientRect()
    return {
      side: cell.className.match(/ag-cell-(?:first|last)-(left|right)-pinned/)?.[1] ?? null,
      startGap: Math.round(c.left - wrapper.left),
      endGap: Math.round(wrapper.right - c.right),
    }
  })
  check(
    `${label}: Deliveries — the pinned Delivery no. sits at the reading START (${dir === 'rtl' ? 'right' : 'left'})`,
    !!pin && pin.side === (dir === 'rtl' ? 'right' : 'left') && (dir === 'rtl' ? pin.endGap : pin.startGap) <= 2,
    JSON.stringify(pin),
  )
  await readsInOrder('Deliveries — the pinned Delivery no.', 'main', 'deliveryNo', '80001240', firstRow)
  await page.screenshot({ path: `${SHOTS}/grid-deliveries-${theme}-${dir}.png` })

  // ---- Delivery details: Items, and Change store's picker ----
  await page.goto(BASE + `/oms/document/${ERX.documentNo}`)
  await page.locator('#tabpanel-items .ag-row').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  await mirrored('Details · Items', '#tabpanel-items')
  await readsInOrder('Details · Items — the negative discount', '#tabpanel-items', 'discount', '-1.50', '[row-index="0"]')
  // The pinned totals row's label — the old `Ltr` renderer's one job, now the base's.
  const totals = await visualOrderIn(page, '#tabpanel-items', 'itemDescription', '.ag-row-pinned')
  check(
    `${label}: Details · Items — the pinned totals label reads in order`,
    !!totals && totals.visual === totals.logical && /^1 line · 1 unit$/.test(totals.logical) && totals.isolated,
    JSON.stringify(totals),
  )
  await page.screenshot({ path: `${SHOTS}/grid-items-${theme}-${dir}.png` })

  const changeStore = page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: /^change store$/i })
  const offered = (await changeStore.count()) > 0 && (await changeStore.getAttribute('aria-disabled')) !== 'true'
  check(`${label}: Details — Change store is offered on this captured order`, offered)
  if (offered) {
    await changeStore.click()
    await page.locator('dialog[open] .ag-row').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    await mirrored('Change store', 'dialog[open]')
    await readsInOrder('Change store — a store code', 'dialog[open]', 'storeCode', '1001', '[row-index="0"]')
    await page.screenshot({ path: `${SHOTS}/grid-change-store-${theme}-${dir}.png` })
    await page.keyboard.press('Escape')
  }

  // ---- Central invoices (the list) ----
  await page.goto(BASE + '/oms/central-invoices')
  await page.locator('[data-central-invoice-list] .ag-row').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  await mirrored('Central invoices', '[data-central-invoice-list]')
  const listRow = '[row-id="A1"]'
  await readsInOrder('Central invoices — the requested-at date-time', '[data-central-invoice-list]', 'requestedAt', '2026-09-29 10:15', listRow)
  await readsInOrder('Central invoices — a negative cash remainder', '[data-central-invoice-list]', 'cashRemainder', '-5.125', listRow)
  await page.screenshot({ path: `${SHOTS}/grid-central-invoices-${theme}-${dir}.png` })

  // ---- Central invoice (the raise) — its result grid ----
  await page.goto(BASE + '/oms/central-invoice')
  await page.locator('#central-invoice-list').fill('8000000121\n8000000174')
  await page.locator('#central-invoice-bulk-reason').fill('Rollout sheet, batch 1')
  await page.getByRole('button', { name: /^Raise central invoices?$/ }).last().click()
  await page.locator('[data-central-invoice-results] .ag-row').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  await mirrored('Central invoice results', '[data-central-invoice-results]')
  await readsInOrder('Central invoice results — the delivery no.', '[data-central-invoice-results]', 'deliveryNo', '8000000121', '[row-index="0"]')
  await readsInOrder('Central invoice results — the code', '[data-central-invoice-results]', 'code', 'CINV-CHANGED-RECENTLY', '[row-index="0"]')
  await page.screenshot({ path: `${SHOTS}/grid-central-invoice-results-${theme}-${dir}.png` })

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

for (const dir of ['ltr', 'rtl']) for (const theme of ['light', 'dark']) await driveOneMode({ theme, dir })
for (const dir of ['ltr', 'rtl']) for (const theme of ['light', 'dark']) await driveGrids({ theme, dir })

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
