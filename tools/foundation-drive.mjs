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
//   7. inside the navy rail the focus ring is gold in both themes — the navy ring would vanish on
//      navy.
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
// 384: ranges, pairs and server text read the right way round outside grid cells. In the same four
// modes, each measured as the characters sorted by x:
//  11. the call center's slot chip reads `18:00–21:00` for an 18:00–21:00 window (373's shipped
//      break read `21:00–18:00`), and the store chip's `code · name` pair is ONE ltr isolate, code
//      first, with an Arabic name; a control strips the chip's isolate and must see it reverse;
//  12. the existing-order screen's opened-at (a formatDateTime) and line count;
//  13. the Delivery details window row, one range string isolated once;
//  14. the broadcast title counter reads `40 / 200`, with a strip-the-isolate control;
//  15. the bonus-buy download counter, held mid-run at `2 / 12`;
//  16. an active session's started-at (a formatDateTime in a plain table).
//
// 385: navigation lives in an expanding navy rail, collapsed by default. In the same four modes,
// with only OMS and Collections granted:
//  17. the collapsed rail shows only the granted groups, its tooltip the group's label;
//  18. the gold marker is a `::before` at inset-inline-start 0, painted flush on the rail's
//      inline-start edge (a screen pixel) in both directions;
//  19. clicking a group opens its 240px flyout (a dialog labelled by the group) with focus on the
//      first link; hover switches the group; the Settlement sub-group is a header link plus
//      indented leaves; Esc closes and returns focus; an outside click and navigation close it;
//  20. the toggle expands to the labelled tree, and the preference persists across a reload either
//      way — a malformed stored value boots collapsed;
//  21. print emulation hides the rail.
//
// 386: the top bar carries the crumb, the store chip and the bell; the user menu sits at the rail
// foot. In the same four modes:
//  22. the bar is 44px on --card and its only controls are the store chip and the bell; no footer;
//  23. the crumb reads group / screen, group / sub-group / screen on a Settlement screen, and ends on
//      a record's number (mono, through Ltr) — each read in order along the reading direction;
//  24. the store chip reads the acting store, opens today's switcher (focused, Esc and outside click
//      close it), and with `currentStoreCode: ""` takes the attention tone on every screen;
//  25. the user menu opens navy from the rail foot with name, user id, the theme toggle, sign out
//      and the build stamp; focus, arrows, Esc and outside click behave as a menu; sign out lands
//      on /login; print emulation hides the bar.
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
      rail: (() => {
        const el = document.getElementById('layout-rail')
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
  check(`${label}: Deliveries — the rail is the brand navy in both themes`, g.rail === NAVY, g.rail)
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
  // The rail is navy in both themes, where the light navy ring would vanish (≈1.9:1): inside it
  // the ring is gold, the one thing gold on navy is for.
  const navRing = await ring(page.locator('#layout-rail a').first())
  check(
    `${label}: Deliveries — a focused rail link shows the GOLD ring in both themes`,
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

// ── 384: ranges, pairs and server text outside grid cells ─────────────────────────────────────
//
// The same visual-order measure as the grid checks, on any element: the rendered characters sorted
// by x. A machine value isolated whole reads its logical text in both directions; the control strips
// one isolate and must see the window reverse under RTL.
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
      // The FSI…PDI pair is invisible and has no box; the logical text is read without it.
      logical: el.textContent.replace(/[⁦-⁩]/g, '').trim(),
      visual: chars
        .sort((a, b) => a.x - b.x)
        .map((x) => x.ch)
        .join('')
        .trim(),
      isolate: bdi ? bdi.getAttribute('dir') ?? 'auto' : /[⁦-⁨]/.test(el.textContent) ? 'fsi' : null,
    }
  })

// The call center's open order: the contract's own empty-open capture, with a window and a store
// whose name is Arabic — the pair must still read code first, as one isolated value.
const CC_OPEN = JSON.parse(readFileSync('.issues/assets/136-cc-contract/01-open-empty.json', 'utf8')).response.body.data
const CC_SLOT = { slotId: 'S-1800', from: '18:00', to: '21:00', isActive: true }

async function driveRanges({ theme, dir }) {
  const label = `${theme}/${dir} ranges`
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await bootAs(page, { theme, dir })

  let existingOrder = false
  let downloads = 0
  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }),
      )
    if (path === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (path === 'CallCenterWeb/Open') {
      if (existingOrder)
        return route.fulfill(
          envelope({
            outcome: 'refusedExisting',
            state: null,
            existing: {
              transactionId: 'PRIOR',
              customerName: 'خالد ن.',
              lineCount: 2,
              openedAt: '2026-07-29T21:49:00',
              plant: '1001',
            },
          }),
        )
      return route.fulfill(
        envelope({
          ...CC_OPEN,
          state: { ...CC_OPEN.state, header: { ...CC_OPEN.state.header, plantName: ARABIC_CITY, slot: CC_SLOT } },
        }),
      )
    }
    if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(path))
      return route.fulfill(
        envelope({
          ...ERX,
          deliveryScheduleFromTime: '2026-07-01T18:00:00',
          deliveryScheduleToTime: '2026-07-01T21:00:00',
        }),
      )
    if (/\/(Outbox|Logs)$/.test(path)) return route.fulfill(envelope([]))
    if (path === 'Notifications/Access') return route.fulfill(envelope({ canBroadcast: true }))
    if (path === 'BonusBuyDownloadWeb/Download') {
      downloads += 1
      // The third number never answers, so the counter holds mid-run at `2 / 12`.
      if (downloads >= 3) return
      const { bbyNumber } = route.request().postDataJSON()
      return route.fulfill(envelope({ bbyNumber, status: 'succeeded', overwritten: false, message: null }))
    }
    if (path === 'UaAdminWeb/Sessions/Counts')
      return route.fulfill(envelope({ all: 1, web: 1, mobile: 0, backoffice: 0, pos: 0, idle: 0 }))
    if (path === 'UaAdminWeb/Sessions')
      return route.fulfill(
        envelope({
          rows: [
            {
              sessionId: 'S1',
              userId: 'msartawi',
              displayName: 'خالد ن.',
              currentStoreCode: '1001',
              channel: 'web',
              createdTime: '2026-09-12T08:07:00',
              lastSeenTime: '2026-09-12T08:09:00',
              ipAddress: '10.0.0.7',
              userAgent: 'Chrome',
            },
          ],
          totalMatches: 1,
          rowCap: 50,
          isCapped: false,
        }),
      )
    if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path)) return route.fulfill(envelope([]))
    if (/Access$/.test(path))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true }),
      )
    return route.fulfill(envelope([]))
  })

  const readsInOrder = async (name, locator, expected, isolate = 'ltr') => {
    const v = await visualOf(locator)
    check(
      `${label}: ${name} reads "${expected}" in order`,
      !!v && v.logical === expected && v.visual === expected && v.isolate === isolate,
      JSON.stringify(v),
    )
  }

  // ---- The call center: the shipped slot chip (373's break), and the store pair ----
  await page.goto(BASE + '/callcenter')
  await page.locator('[data-cc-chip="slot"]').waitFor({ timeout: 20000 })
  await page.evaluate(() => document.fonts.ready)
  const slotValue = page.locator('[data-cc-chip="slot"] [data-cc-chip-value]')
  await readsInOrder('the call center slot chip', slotValue, '18:00–21:00')
  const store = await visualOf(page.locator('[data-cc-chip="store"] [data-cc-chip-value]'))
  check(
    `${label}: the store chip's \`code · name\` pair is ONE left-to-right isolate, code first`,
    !!store && store.isolate === 'ltr' && store.logical === `1001 · ${ARABIC_CITY}` && store.visual.startsWith('1001 ·'),
    JSON.stringify(store),
  )
  // Control: strip the chip's isolate and the same window reverses under RTL (373's `21:00–18:00`).
  await slotValue.evaluate((el) => {
    const bdi = el.querySelector('bdi')
    bdi?.replaceWith(document.createTextNode(bdi.textContent))
  })
  const bare = await visualOf(slotValue)
  check(
    `${label}: control — the slot chip WITHOUT its isolate ${dir === 'rtl' ? 'reverses' : 'still reads in order'}`,
    !!bare && (dir === 'rtl' ? bare.visual === '21:00–18:00' : bare.visual === '18:00–21:00'),
    JSON.stringify(bare),
  )
  await page.screenshot({ path: `${SHOTS}/range-callcenter-${theme}-${dir}.png` })

  // ---- The call center's existing order: a formatDateTime outside a grid ----
  existingOrder = true
  await page.goto(BASE + '/callcenter')
  await page.locator('[data-cc-existing="opened"]').waitFor({ timeout: 20000 })
  await readsInOrder('the existing order’s opened-at', page.locator('[data-cc-existing="opened"]'), '2026-07-29 21:49')
  await readsInOrder('the existing order’s line count', page.locator('[data-cc-existing="lines"]'), '2')

  // ---- Delivery details: the window row, one string isolated once ----
  await page.goto(BASE + `/oms/document/${ERX.documentNo}`)
  const windowRow = page.locator('main dd bdi', { hasText: /^18:00/ }).first()
  await windowRow.waitFor({ timeout: 20000 })
  await readsInOrder('the Delivery details window', windowRow, '18:00–21:00')
  await page.screenshot({ path: `${SHOTS}/range-details-${theme}-${dir}.png` })

  // ---- Broadcast: the title's `n / m` counter ----
  await page.goto(BASE + '/admin/broadcast')
  await page.locator('#bc-title').waitFor({ timeout: 20000 })
  await page.locator('#bc-title').fill('x'.repeat(40))
  const counter = page.locator('#bc-title').locator('xpath=..').locator('bdi').first()
  await readsInOrder('the broadcast title counter', counter, '40 / 200')
  // Control: an `n / m` with no isolate reverses under RTL (378: `200 / 40`).
  await counter.evaluate((el) => el.replaceWith(document.createTextNode(el.textContent)))
  const bareCounter = await visualOf(page.locator('#bc-title').locator('xpath=..').locator('span').first())
  check(
    `${label}: control — the counter WITHOUT its isolate ${dir === 'rtl' ? 'reverses' : 'still reads in order'}`,
    !!bareCounter && (dir === 'rtl' ? bareCounter.visual === '200 / 40' : bareCounter.visual === '40 / 200'),
    JSON.stringify(bareCounter),
  )
  await page.screenshot({ path: `${SHOTS}/range-broadcast-${theme}-${dir}.png` })

  // ---- Bonus-buy download: the run's `done / total` counter, held mid-run ----
  await page.goto(BASE + '/pricing/bonus-buy-download')
  const numbers = page.locator('textarea').first()
  await numbers.waitFor({ timeout: 20000 })
  await numbers.fill(Array.from({ length: 12 }, (_, i) => String(4000100 + i)).join('\n'))
  await page.getByRole('button', { name: /^download$/i }).click()
  const progress = page.locator('main span.tabular-nums bdi').first()
  await page.locator('main span.tabular-nums bdi', { hasText: '2 / 12' }).waitFor({ timeout: 20000 })
  await readsInOrder('the bonus-buy download counter', progress, '2 / 12')

  // ---- Active sessions: two formatDateTime cells outside a grid ----
  await page.goto(BASE + '/admin/sessions')
  const search = page.getByPlaceholder(/search live sessions/i)
  await search.waitFor({ timeout: 20000 })
  await search.fill('msartawi')
  await search.press('Enter')
  const started = page.locator('table tbody tr td bdi', { hasText: '2026-09-12 08:07' }).first()
  await started.waitFor({ timeout: 20000 })
  await readsInOrder('an active session’s started-at', started, '2026-09-12 08:07')

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ── 385: navigation lives in an expanding navy rail, collapsed by default ──────────────────────
//
// The session is granted OMS and Collections only; every other probe answers a denial (each
// predicate reads `=== true`, so `{}` is a no), and the rail must draw exactly two groups.

const GOLD = 'rgb(253, 200, 1)'
const WHITE = 'rgb(255, 255, 255)'
const RAIL_MUTED = 'rgb(143, 160, 189)'

// One screen pixel, as painted (grid-theme-drive.mjs's measure): a pseudo-element has no box to
// read, so "the marker sits flush on the edge" is asked of the screen itself.
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
  return x.length === 3 && y.length === 3 && x.every((v, i) => Math.abs(v - y[i]) <= 8)
}

async function routeRail(route) {
  const path = route.request().url().split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }),
    )
  if (path === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
  if (path === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
  if (path === 'CollectionWeb/Access')
    return route.fulfill(
      envelope({
        canOpenCollections: true,
        canOpenAcrs: true,
        canOpenDeposits: true,
        canOpenAttempts: true,
        canOpenAssignment: true,
        canOpenSettlement: true,
        canOpenReady: true,
      }),
    )
  if (/Access$/.test(path)) return route.fulfill(envelope({}))
  return route.fulfill(envelope([]))
}

async function driveRail({ theme, dir }) {
  const label = `${theme}/${dir} rail`
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await bootAs(page, { theme, dir })
  await page.route('**/api/**', routeRail)

  const rail = page.locator('#layout-rail')
  const flyout = page.locator('#layout-rail [role="dialog"]')
  const box = (loc) => loc.evaluate((el) => el.getBoundingClientRect().toJSON())
  const focused = () =>
    page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim() ?? '',
      tag: document.activeElement?.tagName,
      group: document.activeElement?.getAttribute('data-rail-group'),
      inFlyout: !!document.activeElement?.closest('[role="dialog"]'),
    }))
  const linkLook = (loc) =>
    loc.evaluate((el) => ({
      current: el.getAttribute('aria-current'),
      marker: getComputedStyle(el, '::before').backgroundColor,
      ink: getComputedStyle(el).color,
    }))

  // ---- A malformed stored preference boots collapsed ----
  await page.goto(BASE + '/oms/deliveries')
  await page.evaluate(() => localStorage.setItem('oms.railExpanded', '{oops'))
  await page.reload()
  await page.locator('#layout-rail [data-rail-group]').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  const r0 = await box(rail)
  check(
    `${label}: a malformed stored preference boots the rail COLLAPSED at 56px`,
    (await rail.getAttribute('data-rail')) === 'collapsed' && Math.round(r0.width) === 56,
    JSON.stringify({ width: r0.width }),
  )
  check(
    `${label}: the rail sits on the inline-start side (${rtl ? 'right' : 'left'})`,
    rtl ? Math.round(r0.right) === 1600 : Math.round(r0.left) === 0,
    JSON.stringify({ left: r0.left, right: r0.right }),
  )

  // ---- Only the granted groups, each with its label as the tooltip ----
  const groups = await page
    .locator('#layout-rail [data-rail-group]')
    .evaluateAll((els) => els.map((e) => ({ label: e.getAttribute('aria-label'), title: e.getAttribute('title') })))
  check(
    `${label}: the collapsed rail shows ONLY the granted groups (OMS, Collections), tooltip = label`,
    JSON.stringify(groups.map((x) => x.label)) === JSON.stringify(['OMS', 'Collections']) &&
      groups.every((x) => x.title === x.label),
    JSON.stringify(groups),
  )
  check(`${label}: the brand mark at the top links /`, (await rail.locator('a').first().getAttribute('href')) === '/')

  // ---- The active marker: gold, flush on the inline-start edge ----
  const activeRow = rail.locator('[data-active]')
  check(
    `${label}: exactly one group is marked active (OMS, on Deliveries)`,
    (await activeRow.count()) === 1 && (await activeRow.locator('[data-rail-group]').getAttribute('aria-label')) === 'OMS',
  )
  const marker = await activeRow.evaluate((el) => {
    const b = getComputedStyle(el, '::before')
    return {
      insetInlineStart: b.insetInlineStart,
      width: b.width,
      bg: b.backgroundColor,
      shadows: [el, ...el.querySelectorAll('*')].map((e) => getComputedStyle(e).boxShadow).filter((s) => s !== 'none'),
    }
  })
  check(
    `${label}: the marker is a 3px gold ::before at inset-inline-start 0, not an inset shadow`,
    marker.insetInlineStart === '0px' && marker.width === '3px' && marker.bg === GOLD && marker.shadows.length === 0,
    JSON.stringify(marker),
  )
  const row = await box(activeRow)
  const y = Math.round(row.top + row.height / 2)
  const px = {
    edge: await pixelAt(page, rtl ? Math.floor(r0.right) - 1 : Math.ceil(r0.left), y),
    inside: await pixelAt(page, rtl ? Math.floor(r0.right) - 5 : Math.ceil(r0.left) + 4, y),
    far: await pixelAt(page, rtl ? Math.ceil(r0.left) + 1 : Math.floor(r0.right) - 2, y),
  }
  check(
    `${label}: the gold marker is painted FLUSH on the rail's ${rtl ? 'right' : 'left'} edge, and only there`,
    near(px.edge, GOLD) && !near(px.inside, GOLD) && !near(px.far, GOLD),
    JSON.stringify(px),
  )
  await page.screenshot({ path: `${SHOTS}/rail-collapsed-${theme}-${dir}.png` })

  // ---- The flyout ----
  const omsBtn = rail.locator('[data-rail-group="deliveries:menu.oms"]')
  const colBtn = rail.locator('[data-rail-group="collection:menu.collections"]')
  await omsBtn.click()
  await flyout.waitFor({ timeout: 5000 })
  const f1 = await box(flyout)
  check(
    `${label}: clicking a group opens its 240px flyout — a dialog labelled by the group, against the rail`,
    (await page.getByRole('dialog', { name: 'OMS' }).count()) === 1 &&
      Math.round(f1.width) === 240 &&
      (rtl ? Math.round(f1.right) === Math.round(r0.left) : Math.round(f1.left) === Math.round(r0.right)) &&
      (await omsBtn.getAttribute('aria-expanded')) === 'true',
    JSON.stringify({ left: f1.left, right: f1.right, width: f1.width }),
  )
  const f1Focus = await focused()
  check(
    `${label}: focus moves to the flyout's first link`,
    f1Focus.tag === 'A' && f1Focus.inFlyout && f1Focus.text === 'Delivery Documents',
    JSON.stringify(f1Focus),
  )
  const flyLeaf = await linkLook(flyout.getByRole('link', { name: 'Delivery Documents' }))
  check(
    `${label}: the flyout's active leaf is current, gold-marked, in white ink`,
    flyLeaf.current === 'page' && flyLeaf.marker === GOLD && flyLeaf.ink === WHITE,
    JSON.stringify(flyLeaf),
  )

  // Hover switches the group while one is open (menu-bar behaviour).
  await colBtn.hover()
  await page.getByRole('dialog', { name: 'Collections' }).waitFor({ timeout: 5000 })
  check(
    `${label}: hovering another group switches the flyout to it`,
    (await page.getByRole('dialog', { name: 'OMS' }).count()) === 0 && (await colBtn.getAttribute('aria-expanded')) === 'true',
  )
  check(`${label}: focus follows the switch to the new flyout's first link`, (await focused()).text === 'Cash Collections')
  const sub = flyout.locator('[data-region="menu-subgroup"]')
  const subLeaves = await sub.getByRole('link').allInnerTexts()
  const subIndent = await sub.evaluate((el) => {
    const s = getComputedStyle(el)
    return { ms: s.marginInlineStart, edge: s.borderInlineStartWidth }
  })
  check(
    `${label}: the Settlement sub-group is a header link plus indented leaves, always open`,
    (await flyout.getByRole('link', { name: 'Settlement Account' }).count()) === 1 &&
      JSON.stringify(subLeaves) === JSON.stringify(['Overview', 'Open settlements', 'Ledger', 'Bulk upload']) &&
      subIndent.ms !== '0px' &&
      subIndent.edge === '1px',
    JSON.stringify({ subLeaves, subIndent }),
  )
  await page.screenshot({ path: `${SHOTS}/rail-flyout-${theme}-${dir}.png` })

  // Esc closes and returns focus to the group's icon.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const afterEsc = await focused()
  check(
    `${label}: Esc closes the flyout and returns focus to its group`,
    (await flyout.count()) === 0 && afterEsc.group === 'collection:menu.collections',
    JSON.stringify(afterEsc),
  )

  // An outside click closes it.
  await omsBtn.click()
  await flyout.waitFor({ timeout: 5000 })
  await page.locator('main').click({ position: { x: 300, y: 600 } })
  await page.waitForTimeout(150)
  check(`${label}: an outside click closes the flyout`, (await flyout.count()) === 0)

  // Navigation closes it.
  await omsBtn.click()
  await flyout.getByRole('link', { name: 'Raise central invoices' }).click()
  await page.waitForURL(/\/oms\/central-invoice$/, { timeout: 10000 })
  await page.waitForTimeout(150)
  check(`${label}: navigating from the flyout closes it`, (await flyout.count()) === 0)

  // ---- Expanded: the labelled tree, remembered across a reload ----
  await rail.getByRole('button', { name: 'Expand menu' }).click()
  await page.waitForTimeout(150)
  const r1 = await box(rail)
  check(
    `${label}: the toggle expands the rail to the 240px labelled tree`,
    (await rail.getAttribute('data-rail')) === 'expanded' && Math.round(r1.width) === 240,
    JSON.stringify({ width: r1.width }),
  )
  await page.reload()
  await rail.getByRole('button', { name: 'Collapse menu' }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check(
    `${label}: the expanded preference persists across a reload`,
    (await rail.getAttribute('data-rail')) === 'expanded' &&
      (await page.evaluate(() => localStorage.getItem('oms.railExpanded'))) === 'true',
  )
  const heads = await rail.locator('nav button[aria-expanded]').evaluateAll((els) =>
    els
      .filter((e) => getComputedStyle(e).textTransform === 'uppercase')
      .map((e) => ({ text: e.textContent.trim(), ink: getComputedStyle(e).color, open: e.getAttribute('aria-expanded') })),
  )
  const omsHead = heads.find((h) => h.text === 'OMS')
  const colHead = heads.find((h) => h.text === 'Collections')
  check(
    `${label}: tree group headers are uppercase rail-muted, white while they hold the active screen`,
    heads.length === 2 &&
      omsHead?.ink === WHITE &&
      omsHead?.open === 'true' &&
      colHead?.ink === RAIL_MUTED &&
      colHead?.open === 'false',
    JSON.stringify(heads),
  )
  const treeLeaf = await linkLook(rail.getByRole('link', { name: 'Raise central invoices' }))
  check(
    `${label}: the tree's active leaf is current, gold-marked, in white ink`,
    treeLeaf.current === 'page' && treeLeaf.marker === GOLD && treeLeaf.ink === WHITE,
    JSON.stringify(treeLeaf),
  )
  // The header's LAST icon: the first is the group's own.
  const chevron = await rail
    .locator('nav button[aria-expanded="false"]')
    .first()
    .locator('svg')
    .last()
    .evaluate((el) => getComputedStyle(el).scale)
  check(
    `${label}: a closed group's forward chevron is ${rtl ? '' : 'not '}mirrored`,
    rtl ? chevron === '-1 1' : chevron === 'none',
    chevron,
  )
  await page.screenshot({ path: `${SHOTS}/rail-expanded-${theme}-${dir}.png` })

  await rail.getByRole('button', { name: 'Collapse menu' }).click()
  await page.reload()
  await page.locator('#layout-rail [data-rail-group]').first().waitFor({ timeout: 20000 })
  check(
    `${label}: collapsing persists across a reload too`,
    (await rail.getAttribute('data-rail')) === 'collapsed' &&
      (await page.evaluate(() => localStorage.getItem('oms.railExpanded'))) === 'false',
  )

  // ---- Ctrl+P: the rail never reaches paper (F20) ----
  await page.emulateMedia({ media: 'print' })
  const printed = await rail.evaluate((el) => getComputedStyle(el).display)
  await page.emulateMedia({ media: 'screen' })
  check(`${label}: print emulation hides the rail`, printed === 'none', printed)

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ── 386: the top bar carries the crumb, the store chip and the bell; the user menu sits at the
//    rail foot ───────────────────────────────────────────────────────────────────────────────────
//
// The same OMS + Collections session as the rail part, with a store list to pick from. A second
// session with `currentStoreCode: ""` (the live 2026-08-02 answer) drives the unset chip.

const STORES = [
  { storeCode: '1001', city: 'Riyadh', region: 'C', storeAddress: '', deliveryStore: true },
  { storeCode: '1002', city: 'Jeddah', region: 'W', storeAddress: '', deliveryStore: true },
]

const routeTopbar = (store) => async (route) => {
  const path = route.request().url().split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'Mohamed Sartawi', currentStoreCode: store }),
    )
  if (path === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORES))
  if (path === 'Notifications/Poll') return route.fulfill(envelope({ items: [], watermark: 1 }))
  if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(path)) return route.fulfill(envelope(DOCUMENT))
  return routeRail(route)
}

async function driveTopbar({ theme, dir }) {
  const label = `${theme}/${dir} topbar`
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await bootAs(page, { theme, dir })
  await page.route('**/api/**', routeTopbar('1001'))

  const bar = page.locator('#layout-topbar')
  const crumb = bar.locator('[data-crumb]')
  const chip = bar.locator('[data-store-chip]')
  const rail = page.locator('#layout-rail')
  const box = (loc) => loc.evaluate((el) => el.getBoundingClientRect().toJSON())
  // The crumb's parts as the eye reads them: each <li>'s text, ordered along the reading
  // direction by x (the separators are aria-hidden spans inside the <li>s).
  const crumbRead = () =>
    crumb.locator('li').evaluateAll(
      (lis, isRtl) =>
        lis
          .map((li) => {
            const r = li.getBoundingClientRect()
            return { text: li.textContent.replace(/^\//, '').trim(), x: r.left }
          })
          .sort((a, b) => (isRtl ? b.x - a.x : a.x - b.x))
          .map((p) => p.text),
      rtl,
    )
  const focused = () =>
    page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim() ?? '',
      tag: document.activeElement?.tagName,
      role: document.activeElement?.getAttribute('role'),
      chip: document.activeElement?.hasAttribute('data-store-chip'),
      avatar: document.activeElement?.hasAttribute('data-user-menu-button'),
    }))
  const cssVar = (name) =>
    page.evaluate((n) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = `var(${n})`
      document.body.appendChild(probe)
      const v = getComputedStyle(probe).backgroundColor
      probe.remove()
      return v
    }, name)

  // ---- The bar: 44px on --card, holding only the crumb, the store chip and the bell ----
  await page.goto(BASE + '/oms/deliveries')
  await chip.waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  const b0 = await box(bar)
  const barBg = await bar.evaluate((el) => getComputedStyle(el).backgroundColor)
  check(
    `${label}: the top bar is 44px tall on --card`,
    Math.round(b0.height) === 44 && barBg === PALETTE_B[theme].card,
    JSON.stringify({ height: b0.height, bg: barBg }),
  )
  const controls = await bar.evaluate((el) =>
    [...el.querySelectorAll('button, a, input, select')].map(
      (c) => c.getAttribute('aria-label') || c.textContent.trim(),
    ),
  )
  check(
    `${label}: the bar's only controls are the store chip and the bell — no theme or account button`,
    controls.length === 2 && /Acting store/.test(controls[0]) && controls[1] === 'Notifications',
    JSON.stringify(controls),
  )
  check(`${label}: no footer row is rendered`, (await page.locator('footer').count()) === 0)

  // ---- The crumb ----
  check(
    `${label}: the crumb reads OMS / Delivery Documents, the screen marked current`,
    JSON.stringify(await crumbRead()) === JSON.stringify(['OMS', 'Delivery Documents']) &&
      (await crumb.locator('[aria-current="page"]').innerText()) === 'Delivery Documents' &&
      (await crumb.getAttribute('aria-label')) === 'Breadcrumb',
    JSON.stringify(await crumbRead()),
  )
  const sep = await crumb.locator('[aria-hidden]').first().innerText()
  check(`${label}: the crumb's separator is a slash`, sep === '/', sep)

  await page.goto(BASE + '/collection/settlement/open')
  await crumb.waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  check(
    `${label}: on a Settlement screen the crumb carries the sub-group`,
    JSON.stringify(await crumbRead()) === JSON.stringify(['Collections', 'Settlement Account', 'Open settlements']),
    JSON.stringify(await crumbRead()),
  )

  await page.goto(BASE + '/oms/document/1000000393')
  await crumb.locator('[data-crumb-record]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  const rec = await crumb.locator('[data-crumb-record]').evaluate((el) => ({
    text: el.textContent,
    mono: /Plex Mono/.test(getComputedStyle(el).fontFamily),
    isolate: el.querySelector('bdi')?.getAttribute('dir'),
  }))
  check(
    `${label}: on a record the crumb ends on its number — mono, through Ltr — read in order`,
    JSON.stringify(await crumbRead()) === JSON.stringify(['OMS', 'Delivery Documents', '1000000393']) &&
      rec.mono &&
      rec.isolate === 'ltr',
    JSON.stringify({ read: await crumbRead(), rec }),
  )
  const c0 = await box(crumb)
  check(
    `${label}: the crumb starts at the bar's inline start (${rtl ? 'right' : 'left'})`,
    rtl ? b0.right - c0.right < 24 : c0.left - b0.left < 24,
    JSON.stringify({ bar: [b0.left, b0.right], crumb: [c0.left, c0.right] }),
  )
  await page.screenshot({ path: `${SHOTS}/topbar-record-${theme}-${dir}.png`, clip: { x: 0, y: 0, width: 1600, height: 120 } })

  // ---- The store chip ----
  await page.goto(BASE + '/oms/deliveries')
  await chip.waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  const chipLook = await chip.evaluate((el) => ({
    state: el.getAttribute('data-store-chip'),
    name: el.textContent.trim(),
    code: el.querySelector('bdi')?.textContent,
    codeDir: el.querySelector('bdi')?.getAttribute('dir'),
    mono: /Plex Mono/.test(getComputedStyle(el.querySelector('bdi').parentElement).fontFamily),
    bg: getComputedStyle(el).backgroundColor,
  }))
  check(
    `${label}: the store chip reads "Acting store 1001", the code mono through Ltr, in the quiet tone`,
    chipLook.state === 'set' &&
      chipLook.name === 'Acting store 1001' &&
      chipLook.code === '1001' &&
      chipLook.codeDir === 'ltr' &&
      chipLook.mono &&
      chipLook.bg !== (await cssVar('--color-attention-050')),
    JSON.stringify(chipLook),
  )
  const bell = bar.getByRole('button', { name: 'Notifications' })
  const [ch, be] = [await box(chip), await box(bell)]
  check(
    `${label}: the store chip then the bell sit at the bar's inline end (${rtl ? 'left' : 'right'})`,
    rtl
      ? be.left - b0.left < 24 && ch.left > be.right - 1
      : b0.right - be.right < 24 && ch.right < be.left + 1,
    JSON.stringify({ chip: [ch.left, ch.right], bell: [be.left, be.right] }),
  )

  await chip.click()
  const panel = page.getByRole('dialog', { name: 'Acting store' })
  await panel.waitFor({ timeout: 5000 })
  await page.waitForTimeout(200)
  const picker = panel.getByRole('combobox', { name: 'Acting store' })
  await picker.locator('option[value="1002"]').waitFor({ state: 'attached', timeout: 5000 })
  check(
    `${label}: the chip opens today's store switcher, on the acting store, focused`,
    (await picker.inputValue()) === '1001' && (await picker.evaluate((el) => el === document.activeElement)),
    JSON.stringify({ value: await picker.inputValue(), focus: await focused() }),
  )
  await page.screenshot({ path: `${SHOTS}/topbar-store-${theme}-${dir}.png`, clip: { x: 0, y: 0, width: 1600, height: 200 } })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check(
    `${label}: Esc closes the store panel and returns focus to the chip`,
    (await panel.count()) === 0 && (await focused()).chip,
  )
  await chip.click()
  await panel.waitFor({ timeout: 5000 })
  await page.locator('main').click({ position: { x: 300, y: 600 } })
  await page.waitForTimeout(150)
  check(`${label}: an outside click closes the store panel`, (await panel.count()) === 0)
  // Navigating (here, the router's own popstate path, as Back takes) closes it too.
  await chip.click()
  await panel.waitFor({ timeout: 5000 })
  await page.evaluate(() => {
    history.pushState(null, '', '/collection/settlement/open')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  // A data router moves `location` only once the lazy route has loaded; the crumb naming
  // the new screen is that moment.
  await crumb.getByText('Open settlements').waitFor({ timeout: 10000 })
  await page.waitForTimeout(150)
  check(
    `${label}: navigating closes the store panel`,
    (await panel.count()) === 0 && new URL(page.url()).pathname === '/collection/settlement/open',
  )
  await page.goto(BASE + '/oms/deliveries')
  await chip.waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)

  // ---- The user menu at the rail foot ----
  const avatar = rail.locator('[data-user-menu-button]')
  const menu = page.getByRole('menu', { name: 'Account menu' })
  const r0 = await box(rail)
  const a0 = await box(avatar)
  check(
    `${label}: the avatar sits at the rail foot, below the expand toggle`,
    a0.bottom > r0.bottom - 60 && a0.top > (await box(rail.getByRole('button', { name: 'Expand menu' }))).bottom - 1,
    JSON.stringify({ avatar: [a0.top, a0.bottom], rail: r0.bottom }),
  )
  await avatar.click()
  await menu.waitFor({ timeout: 5000 })
  const panelBox = await box(page.locator('[data-user-menu]'))
  const menuText = await page.locator('[data-user-menu]').innerText()
  const darkItem = menu.getByRole('menuitemcheckbox', { name: 'Dark mode' })
  check(
    `${label}: the user menu opens from the rail foot with name, user id, theme, sign out and the build stamp`,
    /Mohamed Sartawi/.test(menuText) &&
      /msartawi/.test(menuText) &&
      (await darkItem.count()) === 1 &&
      (await menu.getByRole('menuitem', { name: 'Sign out' }).count()) === 1 &&
      /^Build v[\w.-]+\+\w+/.test(await page.locator('[data-build-stamp]').innerText()) &&
      (await avatar.getAttribute('aria-expanded')) === 'true',
    JSON.stringify(menuText),
  )
  check(
    `${label}: the menu opens against the rail's inline-end edge, level with its foot`,
    (rtl ? Math.abs(panelBox.right - (r0.left - 8)) <= 1 : Math.abs(panelBox.left - (r0.right + 8)) <= 1) &&
      panelBox.bottom > r0.bottom - 20,
    JSON.stringify({ panel: [panelBox.left, panelBox.right, panelBox.bottom], rail: [r0.left, r0.right] }),
  )
  const menuBg = await page.locator('[data-user-menu]').evaluate((el) => getComputedStyle(el).backgroundColor)
  check(`${label}: it opens from the rail, so it is navy`, menuBg === NAVY, menuBg)
  check(
    `${label}: focus lands on the first item, the theme toggle, checked as the theme is`,
    (await focused()).role === 'menuitemcheckbox' &&
      (await darkItem.getAttribute('aria-checked')) === String(theme === 'dark'),
    JSON.stringify(await focused()),
  )
  await page.keyboard.press('ArrowDown')
  const down = await focused()
  await page.keyboard.press('ArrowDown')
  const wrapped = await focused()
  check(
    `${label}: the arrows move through the items and wrap`,
    down.text === 'Sign out' && wrapped.role === 'menuitemcheckbox',
    JSON.stringify({ down, wrapped }),
  )
  await page.screenshot({ path: `${SHOTS}/topbar-user-menu-${theme}-${dir}.png` })

  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const flipped = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  check(
    `${label}: the theme toggle flips the theme and the menu stays open`,
    flipped === (theme !== 'dark') && (await menu.count()) === 1 &&
      (await darkItem.getAttribute('aria-checked')) === String(theme !== 'dark'),
    JSON.stringify({ flipped }),
  )
  await darkItem.click()
  await page.waitForTimeout(200)

  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check(
    `${label}: Esc closes the user menu and returns focus to the avatar`,
    (await menu.count()) === 0 && (await focused()).avatar,
    JSON.stringify(await focused()),
  )
  await avatar.click()
  await menu.waitFor({ timeout: 5000 })
  await page.locator('main').click({ position: { x: 300, y: 600 } })
  await page.waitForTimeout(150)
  check(`${label}: an outside click closes the user menu`, (await menu.count()) === 0)

  // Opening the user menu closes a group's flyout; opening a flyout closes the user menu.
  await rail.locator('[data-rail-group="deliveries:menu.oms"]').click()
  await avatar.click()
  await page.waitForTimeout(150)
  const flyGone = (await page.locator('#layout-rail [role="dialog"]').count()) === 0
  await rail.locator('[data-rail-group="deliveries:menu.oms"]').click()
  await page.waitForTimeout(150)
  check(
    `${label}: the user menu and a flyout never stand open together`,
    flyGone && (await menu.count()) === 0 && (await page.locator('#layout-rail [role="dialog"]').count()) === 1,
  )
  await page.keyboard.press('Escape')

  // Expanded, the foot shows the name and the user id beside the avatar.
  await rail.getByRole('button', { name: 'Expand menu' }).click()
  await page.waitForTimeout(150)
  const footText = await avatar.innerText()
  check(`${label}: the expanded rail's foot names the user and their id`, /Mohamed Sartawi/.test(footText) && /msartawi/.test(footText), JSON.stringify(footText))
  await rail.getByRole('button', { name: 'Collapse menu' }).click()

  // ---- Ctrl+P: the top bar never reaches paper (F20) ----
  await page.emulateMedia({ media: 'print' })
  const printed = await bar.evaluate((el) => getComputedStyle(el).display)
  await page.emulateMedia({ media: 'screen' })
  check(`${label}: print emulation hides the top bar`, printed === 'none', printed)

  // ---- Sign out ----
  await avatar.click()
  await menu.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL(/\/login$/, { timeout: 10000 })
  check(`${label}: Sign out ends the session and lands on the login page`, true)

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()

  // ---- No acting store: the chip takes the attention tone, on every screen ----
  const unset = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const p2 = await unset.newPage()
  const errors2 = []
  p2.on('pageerror', (e) => errors2.push(String(e)))
  await bootAs(p2, { theme, dir })
  await p2.route('**/api/**', routeTopbar(''))
  const chip2 = p2.locator('#layout-topbar [data-store-chip]')
  for (const at of ['/oms/deliveries', '/collection/settlement/ledger']) {
    await p2.goto(BASE + at)
    await chip2.waitFor({ timeout: 20000 })
    await p2.waitForTimeout(300)
    const look = await chip2.evaluate((el) => {
      const probe = (v) => {
        const d = document.createElement('div')
        d.style.color = `var(${v})`
        document.body.appendChild(d)
        const c = getComputedStyle(d).color
        d.remove()
        return c
      }
      const s = getComputedStyle(el)
      return {
        state: el.getAttribute('data-store-chip'),
        text: el.textContent.trim(),
        bg: s.backgroundColor,
        ink: s.color,
        edge: s.borderTopColor,
        want: { bg: probe('--color-attention-050'), ink: probe('--color-attention-800'), edge: probe('--color-attention-border') },
      }
    })
    check(
      `${label}: with no store set the chip carries the attention tone (${at})`,
      look.state === 'unset' &&
        look.text === 'No acting store' &&
        look.bg === look.want.bg &&
        look.ink === look.want.ink &&
        look.edge === look.want.edge,
      JSON.stringify(look),
    )
  }
  await p2.screenshot({ path: `${SHOTS}/topbar-store-unset-${theme}-${dir}.png`, clip: { x: 0, y: 0, width: 1600, height: 120 } })
  await chip2.click()
  const picker2 = p2.getByRole('dialog', { name: 'Acting store' }).getByRole('combobox', { name: 'Acting store' })
  await picker2.locator('option[value="1002"]').waitFor({ state: 'attached', timeout: 5000 })
  check(
    `${label}: the unset chip opens the switcher on "Choose a store…", not on the first store`,
    (await picker2.inputValue()) === '' &&
      /pick one before raising an authorization/.test(await p2.getByRole('dialog', { name: 'Acting store' }).innerText()),
  )
  check(`${label}: no page errors (unset store)`, errors2.length === 0, errors2.slice(0, 3).join(' | '))
  await unset.close()
}

// DRIVE_ONLY=paint|grids|ranges|rail|topbar runs one part, for a slice's inner loop; unset runs all.
const ONLY = process.env.DRIVE_ONLY
const PARTS = { paint: driveOneMode, grids: driveGrids, ranges: driveRanges, rail: driveRail, topbar: driveTopbar }
for (const [part, drive] of Object.entries(PARTS))
  if (!ONLY || ONLY === part)
    for (const dir of ['ltr', 'rtl']) for (const theme of ['light', 'dark']) await drive({ theme, dir })

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
