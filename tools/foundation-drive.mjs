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
// 387: below 1280px the rail overlays the page; below 640px it is a drawer. In the same four modes,
// with the preference stored EXPANDED throughout:
//  26. at 1100px the rail is collapsed; its toggle lays the 240px tree over the page from the inline
//      start, over the --backdrop scrim, without moving the grid's edges or writing the preference;
//      navigation, Esc (focus back on the toggle) and a scrim click close it; 1280 is pinned again;
//  27. at 390px there is no rail: the hamburger at the top bar's inline start opens a navy drawer
//      holding every granted group and leaf (the flyouts' own lists); the body cannot scroll, Tab
//      stays inside, the user menu opens inside it, and Esc, the scrim and navigation close it,
//      each handing focus back to the hamburger.
//
// 388: overlays share one recipe, and toasts sit bottom-end in 082's colours. In the same four modes:
//  28. a warning, an error, a success and an info toast, each raised by the Deliveries list's own
//      code path, compute 082's -050 ground, -border edge and -800 ink (info: the primary tiers),
//      render in IBM Plex Sans, and are 340px, 8px, --shadow-pop, a 12.5px/600 title over 12px;
//  29. they land at the bottom inline-END corner, 16px in, clear of the store chip, the bell and the
//      open bell panel; an English server message keeps its full stop at its end under RTL, with a
//      control that drops the per-line direction and must see the stop flip;
//  30. the bell panel, the store chip's panel and the column chooser are the 8px card recipe; the
//      hand-drawn Save-view dialog and a core Modal (Change store) are the 10px dialog recipe over
//      the --backdrop scrim, the Modal's title 13px semibold;
//  31. the user menu and the rail flyout are navy with the white 12% edge, and the user menu's
//      keyboard focus shows the GOLD ring;
//  32. a broadcast arriving on the bell's poll raises a NEUTRAL toast in the card recipe, its View a
//      6px --primary control and its Dismiss a 6px --muted one; and the Toaster re-reads <html dir>.
//
// 389: the bell opens a dense dropdown. In the same four modes, with four stubbed notifications:
//  33. the badge computes gold with navy ink in both themes, ringed in --card; opening the panel
//      makes no Read call and leaves the badge and the unread dots as they were;
//  34. the panel is 360px, max 440px tall, with a 36px header holding an "N new" chip (primary-050 /
//      primary-800, its count isolated ltr) and a 24px Mark all as read;
//  35. rows are 8px × 12px on --divider rules with a --card-2 hover, a 12.5px title (600 unread,
//      500 muted read), an 11px --ink-3 time at the inline end, a 6px --primary unread dot, and a
//      12px body clamped to two lines; a wrapped title keeps its dot on its first line; the time's
//      count and the chip's are isolated ltr; an English body keeps its stop at its end under RTL;
//  36. the type tag sits on its own line, squared, 10px uppercase: BROADCAST in the primary tier,
//      JOB --muted; Esc and an outside click still close the panel; a row click and Mark all mark.
//
// 390: a dialog's own failure shows inside the dialog. In the same four modes:
//  37. a stubbed `success:false` envelope on the UA set-password dialog and on the settlement
//      post-entry dialog shows the server's sentence INSIDE the open dialog, and no toast is raised
//      while it is open; under RTL the banner's English sentence keeps its full stop at its end (core
//      ErrorBanner isolates its message), with a control that strips the isolate and must see it flip;
//  38. a successful set-password closes its dialog and its toast is reachable (a hit-test at the
//      toast's close button lands on the toast); the post-entry dialog's success panel keeps it
//      open with its toast already up, which is the control — that hit-test lands on the DIALOG —
//      and closing it leaves the toast reachable.
//
// 391: the screens that are not reworked hold under the foundation. `--all-screens` visits every
// granted menu leaf, read off the real rail, in the same four modes (39–44 at `driveScreens`): no
// page error, no clipped grid header, the gold marker on that leaf alone, a toast at the bottom
// inline-END corner, and a capture to .issues/assets/391-shots/ for the owner's S1 sign-off.
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
  await page.getByRole('button', { name: /^search$/i }).waitFor({ timeout: 20000 })
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

  await page.getByRole('button', { name: /^search$/i }).click()
  await page.waitForSelector('.ag-row', { timeout: 20000 })
  // Since the views rail (398) the Reason column sits past column virtualisation at this width:
  // scroll the grid toward its inline end until the column renders.
  await page.evaluate(async () => {
    const scroller = document.querySelector('.ag-body-horizontal-scroll-viewport')
    const step = document.dir === 'rtl' ? -240 : 240
    for (let i = 0; i < 20 && scroller && !document.querySelector('.ag-cell[col-id="documentReason"]'); i++) {
      scroller.scrollBy({ left: step })
      await new Promise((resolve) => setTimeout(resolve, 80))
    }
  })
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

  const load = page.getByRole('button', { name: /^search$/i })
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
  // Since 402 a code on Details is isolated (F24), so its text sits in the `.font-mono`
  // element's `<bdi>` child, which inherits the face: tag whichever holds the text.
  const mono = await page.evaluate(() => {
    const holdsText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const el = [...document.querySelectorAll('main .font-mono')]
      .map((e) => (holdsText(e) ? e : [...e.children].find((c) => c.tagName === 'BDI' && holdsText(c))))
      .find(Boolean)
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
  await page.getByRole('button', { name: /^search$/i }).waitFor({ timeout: 20000 })
  const html = await page.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang }))
  check(
    `${label}: index.html set <html dir> from the stored locale before boot (lang stays i18n's en)`,
    html.dir === dir && html.lang === 'en',
    JSON.stringify(html),
  )
  await page.getByRole('button', { name: /^search$/i }).click()
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

  // The Delivery no., pinned at the reading start by its own column (401, L10).
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
  await page.locator('#doc-items .ag-row').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  await mirrored('Details · Items', '#doc-items')
  await readsInOrder('Details · Items — the negative discount', '#doc-items', 'discount', '-1.50', '[row-index="0"]')
  // The pinned totals row's label — the old `Ltr` renderer's one job, now the base's.
  const totals = await visualOrderIn(page, '#doc-items', 'itemDescription', '.ag-row-pinned')
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
  // 408: the header is a sentence that takes its OWN direction (`dir="auto"`), so these English
  // strings read left-to-right even on an RTL page; the control sets it to the page's direction
  // first, standing in for an Arabic template, where the isolate is what keeps the window whole.
  await slotValue.evaluate((el) => {
    el.closest('[data-cc-sentence]')?.setAttribute('dir', document.documentElement.dir || 'ltr')
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
  // 393 put the single-key switch and the shortcuts sheet between the theme and sign out.
  check(
    `${label}: the menu carries the single-key switch (on) and the Keyboard shortcuts sheet`,
    (await menu.getByRole('menuitemcheckbox', { name: 'Single-key shortcuts' }).getAttribute('aria-checked')) === 'true' &&
      (await menu.getByRole('menuitem', { name: 'Keyboard shortcuts' }).count()) === 1,
  )
  await page.keyboard.press('ArrowDown')
  const down = await focused()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  const wrapped = await focused()
  await page.keyboard.press('ArrowDown')
  const back = await focused()
  check(
    `${label}: the arrows move through the items and wrap`,
    down.text === 'Single-key shortcuts' && wrapped.text === 'Sign out' && back.text === 'Dark mode',
    JSON.stringify({ down, wrapped, back }),
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

// ── 387: below 1280px the rail overlays the page; below 640px it is a drawer ─────────────────
//
// The same OMS + Collections session as the rail part, with the Deliveries list stubbed so a grid
// is on screen to measure. The stored preference is EXPANDED throughout, so a collapsed rail can
// only come from the width.

const BACKDROP = { light: 'rgba(13, 16, 21, 0.32)', dark: 'rgba(0, 0, 0, 0.5)' }

async function routeNarrow(route) {
  const path = route.request().url().split('/api/')[1].split('?')[0]
  if (path === 'SdDocumentWeb/DeliveryDocumentList') return routeGrids(route)
  return routeRail(route)
}

async function driveNarrow({ theme, dir }) {
  const label = `${theme}/${dir} narrow`
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await bootAs(page, { theme, dir })
  await page.route('**/api/**', routeNarrow)

  const rail = page.locator('#layout-rail')
  const nav = rail.locator('nav')
  const scrim = page.locator('[data-rail-scrim]')
  const toggle = rail.getByRole('button', { name: /^(Expand|Collapse) menu$/ })
  const box = (loc) => loc.evaluate((el) => el.getBoundingClientRect().toJSON())
  const stored = () => page.evaluate(() => localStorage.getItem('oms.railExpanded'))
  const focusedLabel = () =>
    page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim())

  // ---- 1100px: collapsed whatever the preference ----
  await page.goto(BASE + '/oms/deliveries')
  await page.evaluate(() => localStorage.setItem('oms.railExpanded', 'true'))
  await page.reload()
  await page.getByRole('button', { name: /^search$/i }).waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /^search$/i }).click()
  await page.waitForSelector('main .ag-row:not(.ag-header-row)', { timeout: 20000 })
  await page.waitForTimeout(300)
  const r0 = await box(rail)
  check(
    `${label}: at 1100px the rail is COLLAPSED (56px) even with the preference expanded`,
    (await rail.getAttribute('data-rail-mode')) === 'overlay' &&
      (await rail.getAttribute('data-rail')) === 'collapsed' &&
      Math.round(r0.width) === 56 &&
      (await stored()) === 'true',
    JSON.stringify({ width: r0.width, stored: await stored() }),
  )
  const grid = page.locator('main .ag-root-wrapper').first()
  const g0 = await box(grid)

  // Each granted group's leaves as its flyout lists them: what the phone drawer must hold too.
  const flyout = page.locator('#layout-rail [role="dialog"]')
  await rail.locator('[data-rail-group="deliveries:menu.oms"]').click()
  await flyout.waitFor({ timeout: 5000 })
  check(`${label}: at 1100px a group's icon still opens its flyout`, (await page.getByRole('dialog', { name: 'OMS' }).count()) === 1)
  const grantedLeaves = [...(await flyout.getByRole('link').allInnerTexts())]
  await rail.locator('[data-rail-group="collection:menu.collections"]').hover()
  await page.getByRole('dialog', { name: 'Collections' }).waitFor({ timeout: 5000 })
  grantedLeaves.push(...(await flyout.getByRole('link').allInnerTexts()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // ---- The toggle overlays the tree: the page does not move ----
  await toggle.click()
  await scrim.waitFor({ timeout: 5000 })
  await page.waitForTimeout(200)
  const r1 = await box(rail)
  const n1 = await box(nav)
  const g1 = await box(grid)
  const scrimBg = await scrim.evaluate((el) => getComputedStyle(el).backgroundColor)
  check(
    `${label}: the toggle lays the 240px labelled tree over the page from the inline start`,
    (await rail.getAttribute('data-rail')) === 'expanded' &&
      Math.round(n1.width) === 240 &&
      (rtl ? Math.round(n1.right) === 1100 : Math.round(n1.left) === 0) &&
      (await toggle.getAttribute('aria-expanded')) === 'true' &&
      (await nav.getByRole('link', { name: 'Delivery Documents' }).isVisible()),
    JSON.stringify({ nav: [n1.left, n1.right], width: n1.width }),
  )
  check(
    `${label}: the rail keeps its 56px footprint and the grid's edges do not move`,
    Math.round(r1.width) === 56 && Math.round(g1.left) === Math.round(g0.left) && Math.round(g1.right) === Math.round(g0.right),
    JSON.stringify({ rail: r1.width, before: [g0.left, g0.right], after: [g1.left, g1.right] }),
  )
  check(`${label}: the scrim is the --backdrop token`, scrimBg === BACKDROP[theme], scrimBg)
  check(`${label}: opening the overlay does not write the preference`, (await stored()) === 'true')
  await page.screenshot({ path: `${SHOTS}/narrow-1100-overlay-${theme}-${dir}.png` })

  // Navigation closes it.
  await nav.getByRole('link', { name: 'Raise central invoices' }).click()
  await page.waitForURL(/\/oms\/central-invoice$/, { timeout: 10000 })
  await page.waitForTimeout(200)
  check(
    `${label}: navigating from the overlaid tree closes it`,
    (await rail.getAttribute('data-rail')) === 'collapsed' && (await scrim.count()) === 0,
  )

  // Esc closes it and hands focus back to the toggle.
  await toggle.click()
  await scrim.waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check(
    `${label}: Esc closes the overlaid tree and returns focus to the toggle`,
    (await rail.getAttribute('data-rail')) === 'collapsed' && (await focusedLabel()) === 'Expand menu',
    String(await focusedLabel()),
  )

  // A click on the scrim closes it.
  await toggle.click()
  await scrim.waitFor({ timeout: 5000 })
  await page.mouse.click(rtl ? 300 : 800, 600)
  await page.waitForTimeout(150)
  check(
    `${label}: a click on the scrim closes the overlaid tree`,
    (await rail.getAttribute('data-rail')) === 'collapsed' && (await scrim.count()) === 0,
  )
  check(`${label}: the preference is still expanded after the overlay closes`, (await stored()) === 'true')

  // ---- The band's edges: 1280 is pinned (the preference comes back), 1279 is not ----
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.waitForTimeout(200)
  const r2 = await box(rail)
  check(
    `${label}: at 1280px the rail is pinned and the stored preference expands it again`,
    (await rail.getAttribute('data-rail-mode')) === 'pinned' &&
      (await rail.getAttribute('data-rail')) === 'expanded' &&
      Math.round(r2.width) === 240,
    JSON.stringify({ width: r2.width }),
  )
  await page.setViewportSize({ width: 1279, height: 900 })
  await page.waitForTimeout(200)
  check(
    `${label}: at 1279px it is collapsed again`,
    (await rail.getAttribute('data-rail-mode')) === 'overlay' && Math.round((await box(rail)).width) === 56,
  )

  // ---- 390px: no rail, a hamburger and a drawer ----
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto(BASE + '/oms/deliveries')
  const burger = page.locator('#layout-topbar [data-drawer-button]')
  await burger.waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)
  const b0 = await box(burger)
  const crumb0 = await box(page.locator('#layout-topbar [data-crumb]'))
  check(
    `${label}: at 390px there is no rail, and the hamburger leads the top bar at its inline start`,
    (await rail.count()) === 0 &&
      (await burger.getAttribute('aria-label')) === 'Open menu' &&
      (rtl ? b0.left >= crumb0.right && b0.right >= 380 : b0.right <= crumb0.left && b0.left <= 10),
    JSON.stringify({ burger: [b0.left, b0.right], crumb: [crumb0.left, crumb0.right] }),
  )
  await page.screenshot({ path: `${SHOTS}/narrow-390-${theme}-${dir}.png` })
  // The lock is only provable on a page that scrolls. The list's one-line query bar (399) no
  // longer makes it taller than 800px, so the drive makes it so rather than lean on a layout.
  await page.evaluate(() => {
    const tall = document.createElement('div')
    tall.style.height = '2000px'
    tall.setAttribute('data-drive-spacer', '')
    document.querySelector('main')?.append(tall)
  })
  const canScroll = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)

  const drawer = page.locator('[data-rail-drawer]')
  await burger.click()
  await drawer.waitFor({ timeout: 5000 })
  await page.waitForTimeout(200)
  const d0 = await box(drawer)
  const drawerBg = await drawer.evaluate((el) => getComputedStyle(el).backgroundColor)
  const drawerScrim = await page.locator('[data-drawer-scrim]').evaluate((el) => getComputedStyle(el).backgroundColor)
  check(
    `${label}: the hamburger opens a navy drawer (a dialog named Menu) from the inline start, over the --backdrop scrim`,
    (await page.getByRole('dialog', { name: 'Menu' }).count()) === 1 &&
      drawerBg === NAVY &&
      drawerScrim === BACKDROP[theme] &&
      (rtl ? Math.round(d0.right) === 390 : Math.round(d0.left) === 0) &&
      (await burger.getAttribute('aria-expanded')) === 'true',
    JSON.stringify({ drawerBg, drawerScrim, edges: [d0.left, d0.right] }),
  )
  const drawerNav = drawer.locator('nav')
  const leaves = await drawerNav.getByRole('link').allInnerTexts()
  const heads = await drawerNav.locator('section').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  check(
    `${label}: the drawer holds every granted group and every granted leaf, and nothing else`,
    JSON.stringify(heads) === JSON.stringify(['OMS', 'Collections']) &&
      grantedLeaves.length > 0 &&
      JSON.stringify(leaves) === JSON.stringify(grantedLeaves),
    JSON.stringify({ heads, leaves, grantedLeaves }),
  )
  check(`${label}: the drawer carries the brand, linking /`, (await drawer.locator('a[href="/"]').count()) === 1)
  check(
    `${label}: focus moves to the drawer's first leaf`,
    (await page.evaluate(() => document.activeElement?.textContent?.trim())) === leaves[0],
  )
  // Body scroll is locked: a wheel over the scrim moves nothing.
  const lock = await page.evaluate(() => getComputedStyle(document.body).overflow)
  await page.mouse.move(rtl ? 30 : 360, 400)
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(200)
  const scrolled = await page.evaluate(() => scrollY)
  check(
    `${label}: body scroll is locked while the drawer is open`,
    canScroll && lock === 'hidden' && scrolled === 0,
    JSON.stringify({ canScroll, lock, scrolled }),
  )
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab')
  check(
    `${label}: Tab stays inside the drawer`,
    await page.evaluate(() => !!document.activeElement?.closest('[data-rail-drawer]')),
  )
  await page.screenshot({ path: `${SHOTS}/narrow-390-drawer-${theme}-${dir}.png` })

  // The user menu sits at the drawer's foot and opens inside it; its Esc closes only itself.
  await drawer.locator('[data-user-menu-button]').click()
  const userMenu = page.locator('[data-user-menu]')
  await userMenu.waitFor({ timeout: 5000 })
  const u0 = await box(userMenu)
  check(
    `${label}: the user menu opens inside the drawer, on screen`,
    u0.left >= 0 && u0.right <= 390 && u0.top >= 0 && (await userMenu.getByRole('menuitem', { name: 'Sign out' }).count()) === 1,
    JSON.stringify([u0.left, u0.right, u0.top]),
  )
  // Tab from inside the open user menu closes it and wraps, still inside the drawer.
  await page.keyboard.press('Tab')
  await page.waitForTimeout(150)
  check(
    `${label}: Tab from the open user menu closes it and stays inside the drawer`,
    (await userMenu.count()) === 0 &&
      (await page.evaluate(() => !!document.activeElement?.closest('[data-rail-drawer]'))),
  )
  await drawer.locator('[data-user-menu-button]').click()
  await userMenu.waitFor({ timeout: 5000 })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check(
    `${label}: Esc closes the user menu and leaves the drawer open`,
    (await userMenu.count()) === 0 && (await drawer.count()) === 1,
  )

  // Esc closes the drawer, hands focus back to the hamburger, and unlocks the body.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check(
    `${label}: Esc closes the drawer, returns focus to the hamburger and unlocks scrolling`,
    (await drawer.count()) === 0 &&
      (await focusedLabel()) === 'Open menu' &&
      (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== 'hidden',
    String(await focusedLabel()),
  )

  // A click on the scrim closes it.
  await burger.click()
  await drawer.waitFor({ timeout: 5000 })
  await page.mouse.click(rtl ? 20 : 370, 400)
  await page.waitForTimeout(150)
  check(
    `${label}: a click on the scrim closes the drawer, focus back on the hamburger`,
    (await drawer.count()) === 0 && (await focusedLabel()) === 'Open menu',
  )

  // Navigation closes it.
  await burger.click()
  await drawer.waitFor({ timeout: 5000 })
  await drawer.getByRole('link', { name: 'Ledger' }).click()
  await page.waitForURL(/\/collection\/settlement\/ledger$/, { timeout: 10000 })
  await page.waitForTimeout(200)
  check(
    `${label}: navigating from the drawer closes it, focus back on the hamburger`,
    (await drawer.count()) === 0 && (await focusedLabel()) === 'Open menu',
  )

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ---------------------------------------------------------------------------------------------
// 388: overlays share one recipe, and toasts sit bottom-end in 082's colours. The Deliveries list
// raises each toast through its own code path: a failed lookup warns, a failed search errors (with
// an English server message), saving a view succeeds and deleting it informs.

const SERVER_MESSAGE = 'Cannot move to OUT_FOR_DELIVERY (OUT_FOR_DELIVERY).'

const routeOverlays = () => {
  let searches = 0
  return async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    // One lookup fails (the FilterPanel warns once per failed lookup), and the first search
    // answers a business refusal; the second search loads the grid.
    if (path === 'SdDocument/DocumentTypes') return route.fulfill({ status: 500, body: 'boom' })
    if (path === 'SdDocumentWeb/DeliveryDocumentList' && searches++ === 0)
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 400, success: false, message: SERVER_MESSAGE, errors: [], data: null }),
      })
    if (path === 'Notifications/Poll') return route.fulfill(envelope({ items: [], watermark: 1 }))
    if (path === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORES))
    return routeGrids(route)
  }
}

async function driveOverlays({ theme, dir }) {
  const label = `${theme}/${dir} overlays`
  const rtl = dir === 'rtl'
  const VIEW = { width: 1600, height: 1000 }
  const context = await browser.newContext({ viewport: VIEW })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await bootAs(page, { theme, dir })
  await page.route('**/api/**', routeOverlays())
  const cdp = await context.newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')

  // A token as the browser resolves it, through the property it is used as.
  const resolve = (name, prop = 'backgroundColor') =>
    page.evaluate(
      ([n, p]) => {
        const probe = document.createElement('div')
        probe.style[p] = n.startsWith('--') ? `var(${n})` : n
        document.body.appendChild(probe)
        const v = getComputedStyle(probe)[p]
        probe.remove()
        return v
      },
      [name, prop],
    )
  const box = (loc) => loc.evaluate((el) => el.getBoundingClientRect().toJSON())
  // A Tailwind `shadow-*` utility composes four empty ring/inset layers ahead of its own; the
  // shadow cast is the token's when everything ahead of it is one of those transparent layers.
  const isPop = (shadow) =>
    shadow === SHADOW_POP ||
    (shadow.endsWith(', ' + SHADOW_POP) &&
      shadow
        .slice(0, -SHADOW_POP.length - 2)
        .split(/,\s*(?=rgba)/)
        .every((layer) => layer === 'rgba(0, 0, 0, 0) 0px 0px 0px 0px'))
  const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  const surface = (loc) =>
    loc.evaluate((el) => {
      const s = getComputedStyle(el)
      return {
        bg: s.backgroundColor,
        ink: s.color,
        edge: s.borderTopColor,
        endEdge: s.borderInlineEndColor,
        radius: s.borderTopLeftRadius,
        shadow: s.boxShadow,
      }
    })
  // The face Chromium actually rendered a node in (CDP, as in the paint part).
  const renderedFace = async (selector) => {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    return fonts.map((f) => f.familyName)
  }

  const chip = page.locator('#layout-topbar [data-store-chip]')
  const bell = page.locator('#layout-topbar').getByRole('button', { name: 'Notifications' })
  const toaster = page.locator('[data-sonner-toaster]')

  // ---- The warning: a failed lookup, raised as the screen boots ----
  await page.goto(BASE + '/oms/deliveries')
  const SHADOW_POP = await resolve('--shadow-pop', 'boxShadow')
  const CARD = await resolve('--card')
  const STRONG = await resolve('--border-strong', 'borderTopColor')

  // One status toast: 082's tiers, Plex, and the recipe's geometry.
  const checkToast = async (type, tier) => {
    const toast = page.locator(`[data-sonner-toast][data-type="${type}"]`).first()
    await toast.waitFor({ timeout: 15000 })
    await page.waitForTimeout(600) // sonner's enter transition
    const s = await surface(toast)
    const want = {
      bg: await resolve(`--${tier}-050`),
      ink: await resolve(`--${tier}-800`, 'color'),
      edge: await resolve(`--${tier}-border`, 'borderTopColor'),
    }
    check(
      `${label}: a ${type} toast computes 082's --${tier}-050 ground, -border edge and -800 ink`,
      s.bg === want.bg && s.ink === want.ink && s.edge === want.edge,
      JSON.stringify({ got: s, want }),
    )
    const geo = await toast.evaluate((el) => {
      const title = el.querySelector('[data-title]')
      const desc = el.querySelector('[data-description]')
      return {
        width: el.getBoundingClientRect().width,
        title: [getComputedStyle(title).fontSize, getComputedStyle(title).fontWeight],
        desc: desc && getComputedStyle(desc).fontSize,
        descInk: desc && getComputedStyle(desc).color,
      }
    })
    check(
      `${label}: the ${type} toast is 340px, 8px, --shadow-pop, a 12.5px/600 title and a 12px description in its ink`,
      Math.round(geo.width) === 340 &&
        s.radius === '8px' &&
        isPop(s.shadow) &&
        geo.title[0] === '12.5px' &&
        geo.title[1] === '600' &&
        geo.desc === '12px' &&
        geo.descInk === want.ink,
      JSON.stringify({ geo, radius: s.radius, shadow: s.shadow }),
    )
    await toast.locator('[data-title]').evaluate((el) => el.setAttribute('data-toast-probe', ''))
    const faces = await renderedFace('[data-toast-probe]')
    await page.evaluate(() => document.querySelector('[data-toast-probe]')?.removeAttribute('data-toast-probe'))
    check(
      `${label}: the ${type} toast renders in IBM Plex Sans`,
      faces.length > 0 && faces.every((f) => /^IBM Plex Sans/.test(f)),
      JSON.stringify(faces),
    )
    return toast
  }

  const warning = await checkToast('warning', 'attention')

  // ---- The corner: bottom-end, 16px off both edges, mapped by direction ----
  const t0 = await box(warning)
  check(
    `${label}: toasts sit at the bottom inline-END corner, 16px in (${rtl ? 'bottom-left' : 'bottom-right'})`,
    Math.abs(VIEW.height - 16 - t0.bottom) <= 1 &&
      (rtl ? Math.abs(t0.left - 16) <= 1 : Math.abs(VIEW.width - 16 - t0.right) <= 1) &&
      (await toaster.getAttribute('data-x-position')) === (rtl ? 'left' : 'right') &&
      (await toaster.getAttribute('data-y-position')) === 'bottom',
    JSON.stringify(t0),
  )

  // ---- The error: a refused search, its server text read the right way round ----
  await page.getByRole('button', { name: /^search$/i }).click()
  const error = await checkToast('error', 'danger')
  const desc = error.locator('[data-description]')
  check(`${label}: the error toast carries the server's message`, (await desc.innerText()) === SERVER_MESSAGE)
  // Where the message's closing ")" and its full stop land: always on one line, so the two can
  // be compared. In an LTR paragraph the "." follows the ")" to its right; resolved as RTL, the
  // neutral "." takes the paragraph's direction and jumps to the far left of the line.
  const ends = () =>
    desc.evaluate((el) => {
      const text = el.firstChild
      const at = (i) => {
        const r = document.createRange()
        r.setStart(text, i)
        r.setEnd(text, i + 1)
        return r.getBoundingClientRect().left
      }
      const n = text.textContent.length
      return { paren: at(n - 2), stop: at(n - 1), bidi: getComputedStyle(el).unicodeBidi }
    })
  const e0 = await ends()
  check(
    `${label}: the English server message keeps its full stop at its end (each line takes its own first strong direction)`,
    e0.bidi === 'plaintext' && e0.stop > e0.paren,
    JSON.stringify(e0),
  )
  if (rtl) {
    // Control: without the per-line direction the paragraph takes the page's RTL and the stop flips.
    await desc.evaluate((el) => (el.style.unicodeBidi = 'normal'))
    const e1 = await ends()
    await desc.evaluate((el) => (el.style.unicodeBidi = ''))
    check(`${label}: control — without it, the stop flips to the start under RTL`, e1.stop < e1.paren, JSON.stringify(e1))
  }

  // ---- Clear of the top bar, and of the open bell panel ----
  await bell.click()
  const panel = page.getByRole('dialog', { name: 'Notifications' })
  await panel.waitFor({ timeout: 5000 })
  const toasts = await page.locator('[data-sonner-toast]').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().toJSON()),
  )
  const [chipBox, bellBox, panelBox] = [await box(chip), await box(bell), await box(panel)]
  check(
    `${label}: every toast is clear of the store chip, the bell and the open bell panel`,
    toasts.length >= 2 && toasts.every((t) => !overlaps(t, chipBox) && !overlaps(t, bellBox) && !overlaps(t, panelBox)),
    JSON.stringify({ toasts: toasts.length, panelBottom: panelBox.bottom }),
  )
  const ps = await surface(panel)
  check(
    `${label}: the bell panel is the card recipe — --card, --border-strong, 8px, --shadow-pop`,
    ps.bg === CARD && ps.edge === STRONG && ps.radius === '8px' && isPop(ps.shadow),
    JSON.stringify(ps),
  )
  await page.screenshot({ path: `${SHOTS}/overlays-toasts-${theme}-${dir}.png` })
  await page.keyboard.press('Escape')

  // ---- The store chip's panel ----
  await chip.click()
  const store = page.getByRole('dialog', { name: 'Acting store' })
  await store.waitFor({ timeout: 5000 })
  const ss = await surface(store)
  check(
    `${label}: the store chip's panel is the card recipe`,
    ss.bg === CARD && ss.edge === STRONG && ss.radius === '8px' && isPop(ss.shadow),
    JSON.stringify(ss),
  )
  await page.keyboard.press('Escape')

  // ---- The search loads; the column chooser and the hand-drawn Save-view dialog ----
  await page.getByRole('button', { name: /^search$/i }).click()
  await page.waitForSelector('main .ag-row:not(.ag-header-row)', { timeout: 20000 })
  await page.getByRole('button', { name: 'Columns' }).click()
  const chooser = page.locator('main').getByText('Show columns', { exact: true }).locator('xpath=../..')
  const cs = await surface(chooser)
  check(
    `${label}: the column chooser is the card recipe`,
    cs.bg === CARD && cs.edge === STRONG && cs.radius === '8px' && isPop(cs.shadow),
    JSON.stringify(cs),
  )
  await page.getByRole('button', { name: 'Columns' }).click()

  // The views rail's + Save current view opens core Modal (ticket 400, L12).
  await page.locator('[data-view-save]').click()
  const saveDialog = page.getByRole('dialog', { name: 'Save view' })
  await saveDialog.waitFor({ timeout: 5000 })
  await page.waitForTimeout(200)
  const sd = await surface(saveDialog)
  const scrimBg = await saveDialog.evaluate((el) => getComputedStyle(el, '::backdrop').backgroundColor)
  check(
    `${label}: the Save-view dialog is the dialog recipe (10px, --border-strong) over the --backdrop scrim`,
    sd.radius === '10px' && sd.edge === STRONG && isPop(sd.shadow) && scrimBg === BACKDROP[theme],
    JSON.stringify({ sd, scrimBg }),
  )
  await page.getByLabel('View name').fill('Failed jobs')
  await page.getByLabel('View name').press('Enter')
  await checkToast('success', 'success')

  // Delete sits in the view's ⋯ menu, with no confirm; its toast offers Undo.
  const viewRow = page.locator('[data-view-row][data-view-name="Failed jobs"]')
  await viewRow.hover()
  await viewRow.locator('[data-view-menu-trigger]').click()
  await page.locator('[data-view-menu] [data-view-action="delete"]').click()
  await checkToast('info', 'primary')
  await page.screenshot({ path: `${SHOTS}/overlays-toast-stack-${theme}-${dir}.png` })

  // ---- `dir` re-read: sonner's corner follows the attribute if it ever moves (while a toast is up) ----
  await page.evaluate((d) => (document.documentElement.dir = d), rtl ? 'ltr' : 'rtl')
  await page.waitForTimeout(100)
  const flipped = await toaster.getAttribute('data-x-position')
  await page.evaluate((d) => (document.documentElement.dir = d), rtl ? 'rtl' : 'ltr')
  await page.waitForTimeout(100)
  check(
    `${label}: the Toaster re-reads <html dir> — flipped, it takes the other corner, and back`,
    flipped === (rtl ? 'right' : 'left') && (await toaster.getAttribute('data-x-position')) === (rtl ? 'left' : 'right'),
    JSON.stringify({ flipped }),
  )


  // ---- A core Modal: Change store on Delivery details ----
  await page.goto(BASE + `/oms/document/${ERX.documentNo}`)
  const changeStore = page.getByRole('region', { name: 'Actions' }).getByRole('button', { name: /^change store$/i })
  await changeStore.waitFor({ timeout: 20000 })
  await changeStore.click()
  const modal = page.locator('dialog[open]')
  await modal.waitFor({ timeout: 10000 })
  await page.waitForTimeout(200)
  const m = await surface(modal)
  const mod = await modal.evaluate((el) => {
    const title = getComputedStyle(el.querySelector('#modal-title'))
    return { backdrop: getComputedStyle(el, '::backdrop').backgroundColor, title: [title.fontSize, title.fontWeight] }
  })
  check(
    `${label}: a Modal computes --card, --border-strong, the 10px radius, --shadow-pop and the --backdrop scrim`,
    m.bg === CARD && m.edge === STRONG && m.radius === '10px' && isPop(m.shadow) && mod.backdrop === BACKDROP[theme],
    JSON.stringify({ m, mod }),
  )
  check(`${label}: the Modal's title is 13px semibold`, mod.title[0] === '13px' && mod.title[1] === '600', JSON.stringify(mod.title))
  await page.screenshot({ path: `${SHOTS}/overlays-modal-${theme}-${dir}.png` })
  await page.keyboard.press('Escape')
  await modal.waitFor({ state: 'detached', timeout: 5000 })

  // ---- From the rail: the user menu and the flyout are navy, white-edged, gold-ringed ----
  // `--rail-accent-foreground` is white in both themes; the edge is it at 12%.
  const WHITE_12 = await resolve('color-mix(in oklab, var(--rail-accent-foreground) 12%, transparent)', 'borderTopColor')
  const avatar = page.locator('#layout-rail [data-user-menu-button]')
  await avatar.focus()
  await page.keyboard.press('Enter')
  const userMenu = page.locator('[data-user-menu]')
  await userMenu.waitFor({ timeout: 5000 })
  await page.waitForTimeout(100)
  const um = await surface(userMenu)
  const ring = await page.evaluate(() => {
    const el = document.activeElement
    const s = getComputedStyle(el)
    return { role: el.getAttribute('role'), outline: s.outlineColor, style: s.outlineStyle, visible: el.matches(':focus-visible') }
  })
  check(
    `${label}: the user menu is navy with the rail's white 12% edge and --shadow-pop`,
    um.bg === NAVY && um.edge === WHITE_12 && isPop(um.shadow),
    JSON.stringify({ um, WHITE_12 }),
  )
  check(
    `${label}: the user menu's focused item shows the GOLD focus ring`,
    ring.role === 'menuitemcheckbox' && ring.visible && ring.style === 'solid' && ring.outline === GOLD,
    JSON.stringify(ring),
  )
  await page.screenshot({ path: `${SHOTS}/overlays-user-menu-${theme}-${dir}.png` })
  await page.keyboard.press('Escape')

  await page.locator('#layout-rail [data-rail-group="deliveries:menu.oms"]').click()
  const fly = page.locator('#layout-rail [data-rail-flyout]')
  await fly.waitFor({ timeout: 5000 })
  const fs = await surface(fly)
  check(
    `${label}: the rail flyout is navy, its inline-end edge white 12%, with --shadow-pop`,
    fs.bg === NAVY && fs.endEdge === WHITE_12 && isPop(fs.shadow),
    JSON.stringify(fs),
  )
  await page.keyboard.press('Escape')

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()

  // ---- A neutral toast: a broadcast arriving on the bell's poll, with View and Dismiss ----
  const ctx2 = await browser.newContext({ viewport: VIEW })
  const p2 = await ctx2.newPage()
  await bootAs(p2, { theme, dir })
  const now = Date.now()
  const BROADCAST = {
    notificationId: 'N-388',
    typeCode: 'BROADCAST',
    title: 'Store 1017 closes at 21:00',
    body: 'Route late orders to 1001.',
    createdAt: new Date(now - 30_000).toISOString(),
    expiresAt: new Date(now + 3_600_000).toISOString(),
    status: 'Active',
    isRead: false,
    displayStyle: 'Banner',
    readScope: 'Device',
  }
  await p2.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Notifications/Poll') return route.fulfill(envelope({ items: [BROADCAST], watermark: 2 }))
    return routeGrids(route)
  })
  await p2.goto(BASE + '/oms/deliveries')
  const neutral = p2.locator('[data-sonner-toast]').filter({ hasText: BROADCAST.title })
  await neutral.waitFor({ timeout: 20000 })
  await p2.waitForTimeout(600)
  const resolve2 = (name, prop = 'backgroundColor') =>
    p2.evaluate(
      ([n, q]) => {
        const probe = document.createElement('div')
        probe.style[q] = `var(${n})`
        document.body.appendChild(probe)
        const v = getComputedStyle(probe)[q]
        probe.remove()
        return v
      },
      [name, prop],
    )
  const ns = await surface(neutral)
  const nd = await neutral.locator('[data-description]').evaluate((el) => getComputedStyle(el).color)
  check(
    `${label}: a neutral toast is the card recipe — --card, --border-strong, --foreground, a --muted-foreground description`,
    ns.bg === (await resolve2('--card')) &&
      ns.edge === (await resolve2('--border-strong', 'borderTopColor')) &&
      ns.ink === (await resolve2('--foreground', 'color')) &&
      nd === (await resolve2('--muted-foreground', 'color')) &&
      isPop(ns.shadow),
    JSON.stringify({ ns, nd }),
  )
  const buttons = await neutral.locator('[data-button]').evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el)
      return { cancel: el.hasAttribute('data-cancel'), bg: s.backgroundColor, ink: s.color, radius: s.borderTopLeftRadius }
    }),
  )
  const action = buttons.find((b) => !b.cancel)
  const cancel = buttons.find((b) => b.cancel)
  check(
    `${label}: its action is a 6px --primary control and its cancel a 6px --muted one`,
    !!action && !!cancel &&
      action.bg === (await resolve2('--primary')) && action.ink === (await resolve2('--primary-foreground', 'color')) &&
      cancel.bg === (await resolve2('--muted')) && cancel.ink === (await resolve2('--foreground', 'color')) &&
      action.radius === '6px' && cancel.radius === '6px',
    JSON.stringify(buttons),
  )
  await p2.screenshot({ path: `${SHOTS}/overlays-neutral-toast-${theme}-${dir}.png` })
  await ctx2.close()
}

// ---------------------------------------------------------------------------------------------
// 389: the bell opens a dense dropdown. The poll answers four notifications — an unread broadcast
// whose body runs past two lines, an unread job, a read broadcast and a read job — all older than
// the arrival window, so none toasts over the panel. Every Read call is counted: opening the panel
// must make none.

const BELL_NOW = Date.now()
const NC = (id, typeCode, isRead, minutesAgo, title, body) => ({
  notificationId: id,
  typeCode,
  title,
  body,
  createdAt: new Date(BELL_NOW - minutesAgo * 60_000).toISOString(),
  expiresAt: new Date(BELL_NOW + 3_600_000).toISOString(),
  status: 'Active',
  isRead,
  displayStyle: typeCode === 'BROADCAST' ? 'Banner' : 'Toast',
  readScope: 'Device',
})
const BELL_ITEMS = [
  NC(
    'N-1',
    'BROADCAST',
    false,
    21,
    'Store 1017 closes at 21:00 on 3 Oct',
    'Reroute evening slots to 1002 Al Malaz. Couriers already on route finish their runs; new evening ' +
      'orders for 1017 go to 1002 until the store reopens on Sunday morning.',
  ),
  // A title long enough to wrap: it runs on uncut, and the unread dot stays on its first line.
  NC(
    'N-2',
    'JOB_DONE',
    false,
    40,
    'Export ready: the Central region deliveries for September, every store and every slot',
    'Route late orders to 1001.',
  ),
  NC('N-3', 'BROADCAST', true, 120, 'Pricing cache cleared for the Central region', 'Promotions re-read from SAP at 06:10.'),
  NC('N-4', 'JOB_DONE', true, 1440, 'Bulk user import finished', '74 identities created, 0 refused.'),
]

async function driveBell({ theme, dir }) {
  const label = `${theme}/${dir} bell`
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await bootAs(page, { theme, dir })
  let reads = 0
  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Notifications/Poll') return route.fulfill(envelope({ items: BELL_ITEMS, watermark: 4 }))
    if (/^Notifications\/[^/]+\/Read$/.test(path)) {
      reads++
      return route.fulfill(envelope({ ok: true }))
    }
    return routeGrids(route)
  })

  const resolve = (name, prop = 'backgroundColor') =>
    page.evaluate(
      ([n, q]) => {
        const probe = document.createElement('div')
        probe.style[q] = `var(${n})`
        document.body.appendChild(probe)
        const v = getComputedStyle(probe)[q]
        probe.remove()
        return v
      },
      [name, prop],
    )
  const style = (loc, ...props) =>
    loc.evaluate((el, ps) => {
      const s = getComputedStyle(el)
      return Object.fromEntries(ps.map((p) => [p, s[p]]))
    }, props)
  const box = (loc) => loc.evaluate((el) => el.getBoundingClientRect().toJSON())

  const bar = page.locator('#layout-topbar')
  const bell = bar.getByRole('button', { name: 'Notifications' })
  const badge = bell.locator('[data-nc-badge]')
  const panel = page.getByRole('dialog', { name: 'Notifications' })
  const rows = panel.locator('[data-nc-row]')
  const chip = panel.locator('[data-nc-new]')
  const markAll = panel.getByRole('button', { name: 'Mark all as read' })
  // A row's cells, in DOM order: the dot, the title, the time, the body, the tag's line.
  const cell = (row, i) => row.locator(':scope > span').nth(i)

  await page.goto(BASE + '/oms/deliveries')
  await badge.waitFor({ timeout: 20000 })
  await page.waitForTimeout(300)

  // ---- The badge: gold with navy ink in both themes, ringed in --card against the bar ----
  const bs = await style(badge, 'backgroundColor', 'color', 'boxShadow')
  const card = await resolve('--card')
  check(
    `${label}: the badge computes gold (#FDC801) with navy ink (#002554)`,
    bs.backgroundColor === 'rgb(253, 200, 1)' && bs.color === NAVY,
    JSON.stringify(bs),
  )
  check(
    `${label}: the badge's ring is --card, the bar's own ground`,
    bs.boxShadow.includes(card) && (await style(bar, 'backgroundColor')).backgroundColor === card,
    `${bs.boxShadow} vs ${card}`,
  )
  check(`${label}: the badge counts the two unread`, (await badge.innerText()).trim() === '2')

  // ---- Opening marks nothing read ----
  await bell.click()
  await panel.waitFor()
  await page.waitForTimeout(400)
  check(
    `${label}: opening the panel marks nothing read — no Read call, the badge and both dots stay`,
    reads === 0 && (await badge.innerText()).trim() === '2' && (await panel.locator('[data-nc-unread]').count()) === 2,
    `reads=${reads}`,
  )

  // ---- The panel: 360px, max 440px tall, a 36px header with "2 new" and Mark all as read ----
  const pb = await box(panel)
  const ps = await style(panel, 'maxHeight', 'backgroundColor', 'borderTopColor', 'borderTopLeftRadius')
  check(
    `${label}: the panel is 360px wide, max 440px tall, on the 8px card recipe`,
    Math.round(pb.width) === 360 &&
      ps.maxHeight === '440px' &&
      pb.height <= 440 &&
      ps.backgroundColor === card &&
      ps.borderTopColor === (await resolve('--border-strong', 'borderTopColor')) &&
      ps.borderTopLeftRadius === '8px',
    JSON.stringify({ w: pb.width, h: pb.height, ...ps }),
  )
  const bb = await box(bell)
  check(
    `${label}: the panel hangs from the bell at its inline end, inside the viewport`,
    (rtl ? Math.abs(pb.left - bb.left) <= 1 : Math.abs(pb.right - bb.right) <= 1) && pb.left >= 0 && pb.right <= 1600,
    JSON.stringify({ panel: [pb.left, pb.right], bell: [bb.left, bb.right] }),
  )
  const head = panel.locator('h3').locator('..')
  const cs = await style(chip, 'backgroundColor', 'color')
  check(
    `${label}: the header is 36px, with an "N new" chip on primary-050 / primary-800`,
    Math.round((await box(head)).height) === 36 &&
      (await chip.innerText()).trim() === '2 new' &&
      cs.backgroundColor === (await resolve('--primary-050')) &&
      cs.color === (await resolve('--primary-800', 'color')),
    JSON.stringify(cs),
  )
  check(
    `${label}: the chip's count is a machine value, isolated ltr`,
    (await chip.locator('bdi[dir="ltr"]').innerText()) === '2',
  )
  check(`${label}: Mark all as read is a 24px text control`, Math.round((await box(markAll)).height) === 24)

  // ---- Rows: 8px × 12px, --divider rules, a 12.5px title, an 11px --ink-3 time ----
  const [unread, unreadJob, readCast] = [rows.nth(0), rows.nth(1), rows.nth(2)]
  const rs = await style(unread, 'paddingTop', 'paddingInlineStart', 'borderBottomColor')
  check(
    `${label}: a row is 8px × 12px, ruled in --divider`,
    rs.paddingTop === '8px' &&
      rs.paddingInlineStart === '12px' &&
      rs.borderBottomColor === (await resolve('--divider', 'borderBottomColor')),
    JSON.stringify(rs),
  )
  const ut = await style(cell(unread, 1), 'fontSize', 'fontWeight', 'color')
  const rt = await style(cell(readCast, 1), 'fontSize', 'fontWeight', 'color')
  check(
    `${label}: titles are 12.5px — 600 unread; 500 in muted-foreground read`,
    ut.fontSize === '12.5px' &&
      ut.fontWeight === '600' &&
      rt.fontSize === '12.5px' &&
      rt.fontWeight === '500' &&
      rt.color === (await resolve('--muted-foreground', 'color')),
    JSON.stringify({ ut, rt }),
  )
  const tm = await style(cell(unread, 2), 'fontSize', 'color')
  const [tb, rb] = [await box(cell(unread, 2)), await box(unread)]
  check(
    `${label}: the relative time is 11px --ink-3, at the row's inline end`,
    tm.fontSize === '11px' &&
      tm.color === (await resolve('--ink-3', 'color')) &&
      (rtl ? tb.left - rb.left <= 13 : rb.right - tb.right <= 13),
    JSON.stringify({ tm, time: [tb.left, tb.right], row: [rb.left, rb.right] }),
  )
  check(
    `${label}: the time's count is a machine value, isolated ltr`,
    (await cell(unread, 2).locator('bdi[dir="ltr"]').innerText()) === '21',
  )
  await readCast.hover()
  await page.waitForTimeout(200)
  check(`${label}: hover takes --card-2`, (await style(readCast, 'backgroundColor')).backgroundColor === (await resolve('--card-2')))

  // ---- The unread dot: 6px --primary, none on a read row ----
  const dot = unread.locator('[data-nc-unread]')
  const db = await box(dot)
  check(
    `${label}: unread is a 6px --primary dot; a read row has none`,
    Math.round(db.width) === 6 &&
      Math.round(db.height) === 6 &&
      (await style(dot, 'backgroundColor')).backgroundColor === (await resolve('--primary')) &&
      (await readCast.locator('[data-nc-unread]').count()) === 0,
    JSON.stringify(db),
  )

  // A wrapped title: the dot centres on its first line, not on the whole title.
  const wrapped = await cell(unreadJob, 1).evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, height: r.height, line: parseFloat(getComputedStyle(el).lineHeight) }
  })
  const wd = await box(unreadJob.locator('[data-nc-unread]'))
  const wdMid = wd.top + wd.height / 2
  check(
    `${label}: when a title wraps, its unread dot sits on the first line`,
    wrapped.height >= 2 * wrapped.line - 1 && Math.abs(wdMid - (wrapped.top + wrapped.line / 2)) <= 1.5,
    JSON.stringify({ wrapped, dotMid: wdMid }),
  )

  // ---- The body: 12px muted, clamped to two lines ----
  const body = unread.locator('[data-nc-body]')
  const bodyStyle = await style(body, 'fontSize', 'color', 'lineHeight', 'webkitLineClamp')
  const clamp = await body.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }))
  check(
    `${label}: the body is 12px muted-foreground, clamped to two lines (the long one overflows the clamp)`,
    bodyStyle.fontSize === '12px' &&
      bodyStyle.color === (await resolve('--muted-foreground', 'color')) &&
      bodyStyle.webkitLineClamp === '2' &&
      Math.abs(clamp.client - 2 * parseFloat(bodyStyle.lineHeight)) <= 1 &&
      clamp.scroll > clamp.client,
    JSON.stringify({ bodyStyle, clamp }),
  )

  // ---- The type tag: its own line under the body, squared, 10px uppercase; BROADCAST primary ----
  const cast = unread.locator('[data-nc-tag]')
  const job = unreadJob.locator('[data-nc-tag]')
  const ts = await style(cast, 'backgroundColor', 'color', 'borderTopColor', 'borderTopLeftRadius', 'fontSize', 'textTransform')
  check(
    `${label}: a BROADCAST tag computes the primary tier — primary-050 ground, primary-border edge, primary-800 ink`,
    (await cast.getAttribute('data-nc-tag')) === 'broadcast' &&
      ts.backgroundColor === (await resolve('--primary-050')) &&
      ts.borderTopColor === (await resolve('--primary-border', 'borderTopColor')) &&
      ts.color === (await resolve('--primary-800', 'color')),
    JSON.stringify(ts),
  )
  check(
    `${label}: … and is not amber`,
    ts.backgroundColor !== (await resolve('--attention-050')) && ts.color !== (await resolve('--attention-800', 'color')),
  )
  check(
    `${label}: the tag is squared (4px), 10px uppercase`,
    ts.borderTopLeftRadius === '4px' && ts.fontSize === '10px' && ts.textTransform === 'uppercase',
    JSON.stringify(ts),
  )
  check(`${label}: a JOB tag stays --muted`, (await style(job, 'backgroundColor')).backgroundColor === (await resolve('--muted')))
  const [titleB, bodyB, tagB] = [await box(cell(unread, 1)), await box(body), await box(cast)]
  check(
    `${label}: the tag sits on its own line under the body, and the title is not cut`,
    tagB.top >= bodyB.bottom &&
      bodyB.top >= titleB.bottom - 1 &&
      (await cell(unread, 1).evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)),
    JSON.stringify({ title: titleB.bottom, body: [bodyB.top, bodyB.bottom], tag: tagB.top }),
  )

  // ---- Server text reads in its own direction: an English body keeps its stop at its end ----
  const jobBody = unreadJob.locator('[data-nc-body] bdi')
  const ends = () =>
    jobBody.evaluate((el) => {
      const text = el.firstChild
      const at = (i) => {
        const r = document.createRange()
        r.setStart(text, i)
        r.setEnd(text, i + 1)
        return r.getBoundingClientRect().left
      }
      const n = text.textContent.length
      return { digit: at(n - 2), stop: at(n - 1) }
    })
  const e0 = await ends()
  check(`${label}: an English body keeps its full stop at its end (a <bdi>, dir auto)`, e0.stop > e0.digit, JSON.stringify(e0))
  if (rtl) {
    // Control: without the isolate the line takes the panel's RTL and the stop flips.
    await jobBody.evaluate((el) => (el.style.unicodeBidi = 'normal'))
    const e1 = await ends()
    await jobBody.evaluate((el) => (el.style.unicodeBidi = ''))
    check(`${label}: control — without it, the stop flips to the start under RTL`, e1.stop < e1.digit, JSON.stringify(e1))
  }

  await page.mouse.move(0, 999)
  await page.screenshot({ path: `${SHOTS}/bell-${theme}-${dir}.png` })

  // ---- Still today's dropdown: Esc and an outside click close it, nothing marked read ----
  await page.keyboard.press('Escape')
  const closedByEsc = (await panel.count()) === 0
  await bell.click()
  await panel.waitFor()
  await page.mouse.click(800, 600)
  check(
    `${label}: Esc and an outside click close it, and neither marks anything read`,
    closedByEsc && (await panel.count()) === 0 && reads === 0 && (await badge.innerText()).trim() === '2',
    `reads=${reads}`,
  )

  // ---- A row click marks that one read; Mark all marks the rest, and the chip and badge go ----
  await bell.click()
  await panel.waitFor()
  await rows.nth(0).click()
  await page.waitForTimeout(300)
  const afterOne = { reads, chip: (await chip.innerText()).trim(), badge: (await badge.innerText()).trim() }
  await markAll.click()
  await page.waitForTimeout(300)
  check(
    `${label}: a row click marks one read ("1 new"); Mark all marks the other, and the chip and badge go`,
    afterOne.reads === 1 &&
      afterOne.chip === '1 new' &&
      afterOne.badge === '1' &&
      reads === 2 &&
      (await chip.count()) === 0 &&
      (await badge.count()) === 0 &&
      (await markAll.isDisabled()),
    JSON.stringify({ afterOne, reads }),
  )

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ---------------------------------------------------------------------------------------------
// 390: a dialog's own failure shows inside the dialog. A native `showModal()` dialog sits in the
// top layer, so a toast raised while it is open paints under its backdrop and cannot be reached.
// The UA set-password dialog and the settlement post-entry dialog are driven through a stubbed
// `success:false` envelope (the server's sentence must show INSIDE the open dialog, and no toast
// may be raised), then through a success (its toast must be reachable: a hit-test at the toast's
// close button lands on the toast). The post-entry dialog stays open on its success panel with its
// toast already raised, which is the control: a hit-test there lands on the DIALOG.

const SET_PASSWORD_REFUSAL = 'The temporary password does not meet the password policy.'
const POST_REFUSAL = 'Settlement posting is closed while the month is being audited.'

const refusal = (message) => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 400, success: false, message, errors: [], data: null }),
})

const UA_PERSON = {
  employeeId: '2001',
  displayName: 'Person 2001',
  phone: '0500000000',
  phoneClass: 'usable',
  email: '',
  deliveryChannel: 'sms',
  isActive: true,
  isSeeded: true,
  credentialState: 'active',
  isTotpEnrolled: false,
  lastLoginAt: '2026-07-01T09:00:00',
}

const SETTLEMENT_BRANCH = {
  storeId: '0331',
  storeName: 'Riyadh Olaya 0331',
  city: 'Riyadh',
  area: 'Riyadh',
  servedBy: '',
  isMine: true,
}

const routeDialogs = (calls) => async (route) => {
  const req = route.request()
  const path = req.url().split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1001' }),
    )
  if (path === 'Notifications/Poll') return route.fulfill(envelope({ items: [], watermark: 1 }))
  if (path === 'UaAdminWeb/Access') return route.fulfill(envelope({ canOpen: true }))
  if (path === 'CollectionWeb/Access')
    return route.fulfill(
      envelope({
        canOpenCollections: true,
        canOpenAcrs: true,
        canOpenDeposits: true,
        canOpenAttempts: true,
        canOpenSettlement: true,
      }),
    )
  if (/Access$/.test(path)) return route.fulfill(envelope({}))
  // The first press of each dialog is refused; the second succeeds.
  if (path === 'UaAdminWeb/Employees/SetPassword')
    return route.fulfill(calls.setPassword++ === 0 ? refusal(SET_PASSWORD_REFUSAL) : envelope({ success: true }))
  if (path === 'Settlement/Post')
    return route.fulfill(
      calls.post++ === 0
        ? refusal(POST_REFUSAL)
        : envelope({
            settlementEntryId: '01J9SETLPOST900',
            entryNumber: 900,
            amount: 150,
            status: 'OPEN',
            businessDay: '0001-01-01T00:00:00',
          }),
    )
  if (path === 'UaAdminWeb/ReportCounts')
    return route.fulfill(
      envelope({ allPeople: 1, notSeeded: 0, phoneGap: 0, awaitingActivation: 0, mustChangePassword: 0, disabled: 0 }),
    )
  if (path.startsWith('UaAdminWeb/ReportCards/') || path === 'UaAdminWeb/Employees')
    return route.fulfill(envelope({ rows: [UA_PERSON], totalMatches: 1, rowCap: 50, isCapped: false }))
  if (path === 'UaAdminWeb/Employees/2001')
    return route.fulfill(
      envelope({
        ...UA_PERSON,
        found: true,
        createdAt: '2026-01-01T08:00:00',
        updatedAt: '2026-07-01T08:00:00',
        disabledAt: null,
        disabledBy: '',
        credentialCreatedAt: null,
      }),
    )
  if (path.endsWith('/Sessions')) return route.fulfill(envelope([]))
  if (path.endsWith('/Audit')) return route.fulfill(envelope({ entries: [], totalEntries: 0, rowCap: 50, isCapped: false }))
  if (path === 'Settlement/Branches') return route.fulfill(envelope([SETTLEMENT_BRANCH]))
  if (path === 'Settlement/Account')
    return route.fulfill(
      envelope({ storeId: SETTLEMENT_BRANCH.storeId, storeName: SETTLEMENT_BRANCH.storeName, entries: [], consumptions: [] }),
    )
  return route.fulfill(envelope([]))
}

async function driveDialogs({ theme, dir }) {
  const label = `${theme}/${dir} dialogs`
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await bootAs(page, { theme, dir })
  const calls = { setPassword: 0, post: 0 }
  await page.route('**/api/**', routeDialogs(calls))

  const openDialog = page.locator('dialog[open]')
  const toasts = page.locator('[data-sonner-toast]')
  // What a pointer at the centre of the first toast's close button would actually hit.
  const hitToastClose = () =>
    page.evaluate(() => {
      const button = document.querySelector('[data-sonner-toast] [data-close-button]')
      if (!button) return 'no toast'
      const r = button.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (hit?.closest('[data-sonner-toast]')) return 'toast'
      if (hit?.closest('dialog')) return 'dialog'
      return hit ? hit.tagName.toLowerCase() : 'nothing'
    })

  // ---- The UA set-password dialog ----
  await page.goto(BASE + '/admin/ua-users')
  await page.getByRole('button', { name: /People/i }).first().click()
  await page.getByText('Person 2001').first().click()
  await page.getByRole('button', { name: 'Set temp password' }).click()
  await openDialog.waitFor({ timeout: 10000 })
  // The toasts are counted once the answer has landed and before anything else is waited on —
  // a toast left to expire while the drive waited would pass the no-toast check vacuously.
  const pressAndCount = async (press, endpoint) => {
    const answered = page.waitForResponse((r) => r.url().includes(endpoint))
    await press()
    await answered
    await page.waitForTimeout(800) // long enough for a toast to have entered
    const raised = await toasts.count()
    // Not fatal: the old code toasted instead, and that must read as a FAIL, not a crash.
    await openDialog.getByRole('alert').waitFor({ timeout: 5000 }).catch(() => {})
    return raised
  }
  const uaToasts = await pressAndCount(
    () => page.getByRole('button', { name: 'Set password', exact: true }).click(),
    'Employees/SetPassword',
  )
  const alertText = async () =>
    ((await openDialog.getByRole('alert').first().textContent({ timeout: 1000 }).catch(() => '')) ?? '').replace(/\s+/g, ' ')
  const uaAlert = await alertText()
  check(
    `${label}: a refused set-password shows the server's sentence inside the open dialog`,
    (await openDialog.count()) === 1 && uaAlert.includes(SET_PASSWORD_REFUSAL) && uaAlert.includes('Action failed'),
    uaAlert,
  )
  check(`${label}: …and raises no toast while the dialog is open`, uaToasts === 0, String(uaToasts))
  // The server's sentence reads in its own direction: under RTL an English message keeps its full
  // stop at its end, because ErrorBanner isolates its message (a <bdi>; 388 handed this on).
  const bannerText = openDialog.getByRole('alert').locator('bdi')
  const ends = () =>
    bannerText.evaluate((el) => {
      const text = el.firstChild
      const at = (i) => {
        const r = document.createRange()
        r.setStart(text, i)
        r.setEnd(text, i + 1)
        return r.getBoundingClientRect().left
      }
      const n = text.textContent.length
      return { letter: at(n - 2), stop: at(n - 1) }
    })
  const e0 = await ends().catch(() => null)
  check(
    `${label}: the banner's English server sentence keeps its full stop at its end (a <bdi>, dir auto)`,
    !!e0 && e0.stop > e0.letter,
    JSON.stringify(e0),
  )
  if (dir === 'rtl' && e0) {
    // Control: without the isolate the sentence takes the dialog's RTL and the stop flips.
    await bannerText.evaluate((el) => (el.style.unicodeBidi = 'normal'))
    const e1 = await ends()
    check(`${label}: control — with the isolate stripped the stop flips to the start`, e1.stop < e1.letter, JSON.stringify(e1))
    await bannerText.evaluate((el) => (el.style.unicodeBidi = ''))
  }
  await page.screenshot({ path: `${SHOTS}/390-set-password-refused-${theme}-${dir}.png` })

  await page.getByRole('button', { name: 'Set password', exact: true }).click()
  await toasts.first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(600) // sonner's enter transition
  check(
    `${label}: a successful set-password closes the dialog and toasts`,
    (await openDialog.count()) === 0 && (await toasts.first().innerText()).includes('Temporary password set'),
    (await toasts.first().innerText()).replace(/\s+/g, ' '),
  )
  const uaHit = await hitToastClose()
  check(`${label}: …and that toast is reachable — a hit-test at its close button lands on the toast`, uaHit === 'toast', uaHit)

  // ---- The settlement post-entry dialog ----
  await page.goto(BASE + '/collection/settlement')
  await page.locator('[data-testid="post-open"]').click()
  await openDialog.waitFor({ timeout: 10000 })
  await page.locator('[data-testid="post-branch"]').fill(SETTLEMENT_BRANCH.storeId)
  await page.locator('[data-testid="post-branch-resolved"]').waitFor({ timeout: 10000 })
  await page.locator('[data-testid="post-amount"]').fill('150')
  await page.locator('[data-testid="post-reason"]').fill('Till short at the evening close')
  await page.locator('[data-testid="post-review"]').click()
  const postToasts = await pressAndCount(() => page.locator('[data-testid="post-commit"]').click(), 'Settlement/Post')
  const postAlert = await alertText()
  check(
    `${label}: a refused post shows the server's sentence inside the open dialog, still on the review step`,
    (await openDialog.count()) === 1 &&
      postAlert.includes(POST_REFUSAL) &&
      (await page.locator('[data-testid="post-commit"]').count()) === 1,
    postAlert,
  )
  check(`${label}: …and raises no toast while the dialog is open`, postToasts === 0, String(postToasts))
  await page.screenshot({ path: `${SHOTS}/390-post-entry-refused-${theme}-${dir}.png` })

  await page.locator('[data-testid="post-commit"]').click()
  await page.locator('[data-region="post-done"]').waitFor({ timeout: 10000 })
  await toasts.first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(600)
  check(
    `${label}: a successful post clears the refusal and shows its panel`,
    (await openDialog.getByRole('alert').count()) === 0,
  )
  // The control: the success toast is up while the dialog is still open, and it is unreachable.
  const underHit = await hitToastClose()
  check(`${label}: control — a toast raised under the open dialog is hit-tested as the DIALOG`, underHit === 'dialog', underHit)
  await page.locator('[data-testid="post-close"]').click()
  await page.waitForTimeout(200)
  const postHit = await hitToastClose()
  check(
    `${label}: closing the dialog leaves its toast reachable — the hit-test lands on the toast`,
    (await openDialog.count()) === 0 && postHit === 'toast',
    postHit,
  )

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ---------------------------------------------------------------------------------------------
// 391: the screens that are not reworked hold under the foundation (F29, R3). `--all-screens`
// (or DRIVE_ONLY=screens) runs this part alone. In the same four modes, with every grant given:
//  39. the menu's leaves are read off the real rail (every group and sub-group opened), so the
//      list visited IS the granted menu, not a copy of it;
//  40. each leaf boots with no page error, and no grid header on it is clipped: every header
//      label sits inside its row and every header row is 382's 28px;
//  41. the expanded rail marks exactly that leaf: `aria-current="page"` and the gold marker;
//  42. a toast raised through the app's own `notify` lands at the bottom inline-END corner;
//  43. each leaf is captured to .issues/assets/391-shots/ for the owner's S1 sign-off;
//  44. Raise central invoices' textareas compute a 6px radius — the control shape the sweep gave
//      `NoteField` and its siblings (377).
// It also PRINTS (never fails on) what the sweep looks for and the eye can miss: a control whose
// text overflows its box, and a grid header label cut short along its width.

const ALL_SCREENS_SHOTS = '.issues/assets/391-shots'
const ALL_GRANTS = {
  canOpen: true,
  canOpenList: true,
  canOpenDetail: true,
  screenAllowed: true,
  allowed: true,
  canOpenConsole: true,
  canOpenLoyMember: true,
  canOpenNphies: true,
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenAssignment: true,
  canOpenReady: true,
  canOpenSettlement: true,
  canAdmin: true,
  canSupport: true,
  canBroadcast: true,
  canClear: true,
  canSuperviseSettlement: true,
  categories: ['CASH_CLOSE'],
  withdrawCategories: ['CASH_CLOSE'],
}

// A few rows per screen, so the sweep sees cells under 26px — shaped after each feature's own
// drive (named beside each), cut to what the first paint reads. Arabic where a name can be.
const TODAY = new Date().toISOString().slice(0, 10)
const FEW = (n, make) => Array.from({ length: n }, (_, i) => make(i))
const CC_TWO_LINES = JSON.parse(readFileSync('.issues/assets/136-cc-contract/02-two-lines-priced.json', 'utf8')).response.body.data
const SCREEN_DATA = {
  // collection-drive.mjs makeRows / makeAcrRows / makeAttemptRows / makeDepositRows
  'CollectionWeb/Collections': FEW(4, (i) => ({
    collectionReceiptId: `01J0COLLECT${i}`,
    collectionReceiptNo: 91000 + i,
    storeId: String(1001 + i),
    storeName: `Al Dawaa Store ${1001 + i}`,
    profitCenter: `PH-${1001 + i}`,
    storeText: `PH-${1001 + i} (${1001 + i})`,
    collectorOperatorId: '4470',
    collectorName: i % 2 ? ARABIC_NAME : 'Collector 4470',
    closerOperatorId: '7780',
    closerName: 'Pharmacist 7780',
    openedAt: `${TODAY}T07:00:00`,
    closedAt: `${TODAY}T15:04:00`,
    collectedAt: `${TODAY}T15:40:00`,
    businessDay: `${TODAY}T00:00:00`,
    salesDate: `${TODAY}T00:00:00`,
    systemCash: 12480.5 + i,
    countedCash: 12475 + i,
    variance: i === 1 ? -5.5 : 0,
    varianceReasonCode: '',
    varianceReasonText: '',
    openingFloat: 500,
    countedCashNet: 11975 + i,
    retainedFloat: 500,
    netCollected: 11975 + i,
    cardTotal: 8310.25 + i,
    cardTransactionCount: 96,
    zReportIds: `Z-${88121 + i}`,
    currencyKey: 'SAR',
    collectionType: i % 2 ? 'Regular+Surplus' : 'Regular',
    hasSurplus: i % 2 === 1,
    hasTheft: false,
    theftAmount: 0,
    amount: 11975 + i,
    surplus: i % 2 ? -100 : 0,
    description: i % 2 ? 'مرتجع شبكة 5512' : '',
    cashSales: 11975 + i,
    settlement: 0,
    settlementAdjustmentTotal: 0,
    settlementEntryNumber: 0,
    settlementDescription: '',
    shiftSettlementAdjustment: 0,
    shiftSettlementEntryNumber: 0,
    shiftCardTotal: 8310.25,
    receiptKind: 'SHIFT',
    isSettlement: false,
    collectionStatus: 'COLLECTED',
    isOffSystem: false,
    offSystemAt: null,
    offSystemBy: '',
    offSystemReasonCode: '',
    offSystemReasonText: '',
    zNumber: 412 + i,
    amendmentCount: 0,
    lastAmendedBy: '',
    slipCount: i,
  })),
  'CollectionWeb/Acrs': FEW(3, (i) => ({
    acrId: `01J0ACR${i}`,
    acrNumber: 40 + i,
    label: `Riyadh run ${40 + i}`,
    collectorOperatorId: '4470',
    collectorName: 'Collector 4470',
    acrDate: `${TODAY}T00:00:00`,
    status: i === 0 ? 'OPEN' : 'CLOSED',
    createdAt: `${TODAY}T08:15:00`,
    closedAt: i === 0 ? '0001-01-01T00:00:00' : `${TODAY}T19:32:00`,
    linkedCollectionCount: 12,
    cashSalesTotal: 143610.75 + i,
    settlementTotal: 300,
    bankedTotal: 143910.75 + i,
    cardTotalSum: 99120.5 + i,
    cardTransactionCountSum: 812,
    depositId: i === 0 ? '' : `01J0DEPOSIT${i}`,
    depositNumber: i === 0 ? 0 : 5500 + i,
    depositStatus: i === 0 ? '' : 'POSTED',
  })),
  'CollectionWeb/Attempts': FEW(3, (i) => ({
    attemptId: `01J0ATTEMPT${i}`,
    collectorStaffId: '4470',
    collectorName: 'Collector 4470',
    storeCode: String(1001 + i),
    storeName: `Al Dawaa Store ${1001 + i}`,
    profitCenter: `PH-${1001 + i}`,
    storeText: `PH-${1001 + i} (${1001 + i})`,
    shiftId: `01J0SHIFT${i}`,
    businessDay: `${TODAY}T00:00:00`,
    attemptTime: `${TODAY}T09:12:00`,
    reasonCode: i % 2 ? 'STORE_CLOSED' : 'NO_CASH',
    reasonText: i % 2 ? 'Branch shut for maintenance' : '',
  })),
  'CollectionWeb/Deposits': {
    rows: FEW(3, (i) => ({
      depositId: `01J0DEPOSIT${i}`,
      depositNumber: 5500 + i,
      collectorOperatorId: '4470',
      collectorName: 'Collector 4470',
      bankCode: 'RJHI',
      bankName: 'Al Rajhi Bank',
      status: 'POSTED',
      depositedAt: `${TODAY}T11:20:00`,
      createdAt: `${TODAY}T11:22:00`,
      calculatedAmount: 143910.75,
      realAmount: 143910.75,
      diffAmount: 0,
      reasonCode: '',
      noteText: '',
      voidedBy: '',
      voidedAt: '0001-01-01T00:00:00',
      voidReason: '',
      lines: [
        { acrId: `01J0ACR${i}`, acrNumber: 40 + i, netCollectedAtDeposit: 143910.75, netCollectedNow: 143910.75, drift: 0, hasDrift: false },
      ],
      attachments: [],
    })),
    balances: [
      { collectorOperatorId: '4470', collectorName: 'Collector 4470', depositCount: 3, totalCalculated: 431732.25, totalReal: 431732.25, outstanding: 400 },
    ],
  },
  // ready-drive.mjs DAY / RECEIPT
  'CollectionWeb/Ready': [
    { kind: 'DAY', storeId: 'P019', storeName: 'Al-Dawaa P019', profitCenter: 'PH-019', storeText: 'PH-019', currencyKey: 'SAR', businessDay: '2026-09-20T00:00:00', shiftId: '01K5ZB7M2N3P4R5S6T7V8W9X0Y', zNumber: 412, settlementDocumentId: '', entryNumber: 0, cashToHandOver: 1000.5, surplusDeducted: 250, readySince: '2026-09-20T23:05:12', daysWaiting: 5 },
    { kind: 'SETTLEMENT', storeId: 'P019', storeName: 'Al-Dawaa P019', profitCenter: 'PH-019', storeText: 'PH-019', currencyKey: 'SAR', businessDay: null, shiftId: '', zNumber: null, settlementDocumentId: '01K5ZC1A2B3C4D5E6F7G8H9J0K', entryNumber: 143, cashToHandOver: 120.5, surplusDeducted: null, readySince: '2026-09-23T10:41:00', daysWaiting: 2 },
  ],
  // four-filters-drive.mjs / assignment-upload-drive.mjs
  'CollectionWeb/AssignmentOptions': {
    accountants: [{ staffId: '4466', displayName: 'ضحى' }],
    collectors: [{ staffId: 'COLL-9', displayName: 'فهد القحطاني' }],
    supervisors: [],
    defaultScope: null,
  },
  'CollectionWeb/Assignment/People': [
    { staffId: '4466', displayName: 'ضحى', role: 'ACCOUNTANT', supervisorId: '', isActive: true, updatedBy: 'seed', updatedAt: '2026-09-01T00:00:00' },
    { staffId: '5120', displayName: 'فهد القحطاني', role: 'COLLECTOR', supervisorId: '', isActive: true, updatedBy: 'seed', updatedAt: '2026-09-01T00:00:00' },
  ],
  'CollectionWeb/Assignment/Branches': ['P019', 'P020', 'P021'].map((storeCode, i) => ({
    storeCode,
    storeName: `Al-Dawaa ${storeCode}`,
    city: 'Riyadh',
    area: 'Central',
    accountantId: i < 2 ? '4466' : '',
    collectorId: i < 2 ? '5120' : '',
    updatedBy: 'seed',
    updatedAt: '2026-09-01T00:00:00',
  })),
  // ua-users-scale-drive.mjs / ua-bulk-create-drive.mjs / this drive's ranges part
  'UaAdminWeb/ReportCounts': { allPeople: 6000, notSeeded: 12, phoneGap: 400, awaitingActivation: 152, mustChangePassword: 3, disabled: 40 },
  'UaAdminWeb/ReportCards/all': { rows: [UA_PERSON, { ...UA_PERSON, employeeId: '2002', displayName: ARABIC_NAME }], totalMatches: 2, rowCap: 50, isCapped: false },
  'AuthzAdminWeb/Roles': [
    { roleName: 'CALL_CENTER_AGENT', description: '', isComposite: false, directHolderCount: 3, isProtected: false },
    { roleName: 'AUTHZ_ADMIN', description: '', isComposite: false, directHolderCount: 1, isProtected: true },
  ],
  'UaAdminWeb/Sessions/Counts': { all: 2, web: 1, mobile: 1, backoffice: 0, pos: 0, idle: 0 },
  'UaAdminWeb/Sessions': {
    rows: [
      { sessionId: 'S1', userId: 'msartawi', displayName: ARABIC_NAME, currentStoreCode: '1001', channel: 'web', createdTime: '2026-09-12T08:07:00', lastSeenTime: '2026-09-12T08:09:00', ipAddress: '10.0.0.7', userAgent: 'Chrome' },
      { sessionId: 'S2', userId: '2001', displayName: 'Person 2001', currentStoreCode: '1002', channel: 'mobile', createdTime: '2026-09-12T07:01:00', lastSeenTime: '2026-09-12T08:00:00', ipAddress: '10.0.0.8', userAgent: 'okhttp' },
    ],
    totalMatches: 2,
    rowCap: 50,
    isCapped: false,
  },
  // central-invoice-list-drive.mjs, through this drive's grids part
  'Sd/CentralInvoice': { rows: [LIST_ROW({}), LIST_ROW({ id: 'A2', deliveryNo: '8006456512', status: 'REFUSED', refusalCode: 'CINV-CHANGED-RECENTLY', cashRemainder: 0 })] },
  'SdDocumentWeb/DeliveryDocumentList': [GRID_DELIVERY({}), GRID_DELIVERY({ deliveryNo: '80001239', documentNo: '1000000394' })],
  // nphies-eligibility-drive.mjs / nphies-authorizations-drive.mjs
  'Nphies/Providers': [
    { providerCode: 'P001', providerId: '10000000146421', license: 'PR-FHIR-001' },
    { providerCode: 'P002', providerId: '10000000146422', license: 'PR-FHIR-002' },
  ],
  'Nphies/Payers': [],
  'Nphies/CodeSystem': { contractVersion: 1, items: [] },
  'Nphies/EligibilityResponses': {
    rows: [
      { id: 'ELG-1', eligibilityPurpose: 'benefits', providerCode: 'P001', payerCode: 'PAY-9', patientId: '0000000003', patientIdType: 'PRC', patientGender: 'male', patientName: 'Muhammad Ali Abbas', patientBirthDate: '2010-08-21T00:00:00', actionDateTime: `${TODAY}T09:15:00`, success: true, inforce: true, coverage: true, isEligible: true, siteEligibility: 'eligible', errorMessage: '', disposition: 'Eligibility confirmed by the payer.', statusCode: 200, transfer: false, newborn: false, occupation: 'student', maritalStatus: 'U' },
      { id: 'ELG-2', eligibilityPurpose: 'benefits', providerCode: 'P001', payerCode: 'PAY-9', patientId: '0000000004', patientIdType: 'PRC', patientGender: 'female', patientName: ARABIC_NAME, patientBirthDate: '1990-01-02T00:00:00', actionDateTime: `${TODAY}T08:15:00`, success: true, inforce: true, coverage: true, isEligible: true, siteEligibility: 'outside-network', errorMessage: '', disposition: '', statusCode: 200, transfer: false, newborn: false, occupation: 'student', maritalStatus: 'U' },
    ],
    total: 2,
    page: 1,
    pageSize: 50,
  },
  'Nphies/AuthResponses': {
    rows: ['approved', 'rejected'].map((adjudicationOutcome, i) => ({
      id: `AUTH-${i + 1}`, eligibilityId: 'ELG-1', providerCode: 'P001', payerCode: 'PAY-9', patientId: '0000000003', preAuthRef: `PA-100${i + 1}`, claimProcessingCodes: 'Complete', queued: false, error: false, cancelled: false, adjudicationOutcome, needComm: false, isDispensed: false, dispensedTime: '', dispensedStore: '', actionDateTime: `${TODAY}T09:15:00`, responseDateTime: `${TODAY}T09:15:00`, serviceDate: `${TODAY}T09:15:00`, errorMessageShort: '', disposition: 'Approved by the payer.', statusCode: 200, claimType: 0,
    })),
    total: 2,
    page: 1,
    pageSize: 50,
  },
  // bby-inquiry-drive.mjs ROW
  'Bby/List': {
    rows: [
      { bbyNumber: '100234', description: 'Buy 2 Pepsi get 1 free', bbyProfile: 'STD', validFrom: '20260101', validTo: '20261231', validFromTime: '000000', validToTime: '235959', promoNumber: 'PR-9', linkCategoryBuy: 'A', linkCategoryGet: 'A', bbyStatus: 'A', offerId: 'OF-1', limitNumber: 0, minValue: 0, maxValue: 0, condTargetType: 'P', includes: '', excludes: '', score: 0, originFilter: '', priceListType: '', isStackable: false, allowNestedStacking: false, stackingExcludes: '', loyGroups: '', loyTiers: '', createdAt: '2026-07-01T10:00:00Z', createdBy: 'msartawi', isActive: true },
      { bbyNumber: '100235', description: 'اشترِ 2 واحصل على 1 مجاناً', bbyProfile: 'STD', validFrom: '20260101', validTo: '20261231', validFromTime: '000000', validToTime: '235959', promoNumber: 'PR-10', linkCategoryBuy: 'A', linkCategoryGet: 'A', bbyStatus: 'A', offerId: 'OF-2', limitNumber: 0, minValue: 0, maxValue: 0, condTargetType: 'P', includes: '', excludes: '', score: 0, originFilter: '', priceListType: '', isStackable: false, allowNestedStacking: false, stackingExcludes: '', loyGroups: '', loyTiers: '', createdAt: '2026-07-01T10:00:00Z', createdBy: 'msartawi', isActive: true },
    ],
    capReached: false,
  },
  // idoc-inspector-drive.mjs METADATA, cut down
  'IDocInspector/Metadata': {
    legend: { sourceTag: [], conditionSource: [], conditionClass: [], conditionControl: [], iDocType: [], billingType: [], workflowType: [], paymentGroup: [], errorType: [] },
    registeredWorkflowTypes: ['ZAGG'],
  },
  // the call center's contract fixture, as callcenter-drive.mjs serves it
  'CallCenterWeb/Open': { outcome: 'opened', state: CC_TWO_LINES, existing: null },
  'CallCenterWeb/State': CC_TWO_LINES,
  'CallCenterWeb/CustomerRequests': [],
}

// The settlement estate is the app's own fixture modules (settlement-drive.mjs reads them the
// same way), fetched once from the dev server.
let SETTLEMENT = null
async function loadSettlement(page) {
  SETTLEMENT ??= await page.evaluate(async () => {
    const fleet = await import('/src/features/collection/settlement/fleet-fixture.ts')
    const lane = await import('/src/features/collection/settlement/open-lane-fixture.ts')
    const accounts = await import('/src/features/collection/settlement/settlement-fixture.ts')
    const ledger = Object.values(accounts.SETTLEMENT_ACCOUNTS)
      .flatMap((a) => a.entries.map((e) => ({ ...e, storeName: a.storeName, currencyKey: 'SAR' })))
      .slice(0, 12)
    return {
      fleet: fleet.SETTLEMENT_FLEET.slice(0, 12),
      orphans: fleet.SETTLEMENT_ORPHANS,
      lane: lane.SETTLEMENT_OPEN_LANE.slice(0, 12),
      uncollected: lane.SETTLEMENT_UNCOLLECTED.slice(0, 6),
      ledger,
    }
  })
}

async function routeScreens(route) {
  const url = new URL(route.request().url())
  const path = url.pathname.split('/api/')[1]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'Mohamed Sartawi', currentStoreCode: '1001' }),
    )
  if (path === 'Notifications/Poll') return route.fulfill(envelope({ items: [], watermark: 1 }))
  if (path === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORES))
  if (/Access$/.test(path)) return route.fulfill(envelope(ALL_GRANTS))
  if (path === 'Settlement/Fleet') return route.fulfill(envelope(SETTLEMENT?.fleet ?? []))
  if (path === 'Settlement/Orphans') return route.fulfill(envelope(SETTLEMENT?.orphans ?? []))
  if (path === 'Settlement/Uncollected') return route.fulfill(envelope(SETTLEMENT?.uncollected ?? []))
  if (path === 'Settlement/Ledger') {
    const status = url.searchParams.get('status')
    if (status !== 'OPEN') return route.fulfill(envelope([]))
    return route.fulfill(envelope(url.searchParams.get('sort') ? SETTLEMENT?.lane ?? [] : SETTLEMENT?.ledger ?? []))
  }
  if (path in SCREEN_DATA) return route.fulfill(envelope(SCREEN_DATA[path]))
  return route.fulfill(envelope([]))
}

// What a leaf needs pressed before it shows rows, where it does not load on its own.
const SCREEN_ACTIONS = {
  '/oms/deliveries': (page) => page.getByRole('button', { name: /^search$/i }).click(),
  '/admin/ua-users': (page) => page.locator('[data-card="all"]').click(),
  '/admin/sessions': (page) => page.locator('main').getByRole('button', { name: /^All\b/ }).click(),
  '/collection/settlement/ledger': (page) => page.getByRole('button', { name: 'Everything still open' }).click(),
  // Ticket 424: Ready for collection opens blank and loads nothing until Search.
  '/collection/ready': (page) => page.getByRole('button', { name: /^search$/i }).click(),
  // Ticket 425: so do the ACRs.
  '/collection/acrs': (page) => page.getByRole('button', { name: /^search$/i }).click(),
}

async function driveScreens({ theme, dir }) {
  const label = `${theme}/${dir} screens`
  const rtl = dir === 'rtl'
  const VIEW = { width: 1600, height: 1000 }
  mkdirSync(ALL_SCREENS_SHOTS, { recursive: true })
  const context = await browser.newContext({ viewport: VIEW })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await bootAs(page, { theme, dir })
  await page.addInitScript(() => localStorage.setItem('oms.railExpanded', 'true'))
  await page.route('**/api/**', routeScreens)
  const nav = page.locator('#layout-rail nav')

  // ---- The leaves, read off the real menu: open every closed group and sub-group ----
  await page.goto(BASE + '/oms/deliveries')
  await nav.locator('a[href]').first().waitFor({ timeout: 20000 })
  await loadSettlement(page)
  for (let i = 0; i < 40; i++) {
    const closed = nav.locator('button[aria-expanded="false"]')
    if (!(await closed.count())) break
    await closed.first().click()
  }
  const leaves = [
    ...new Set(await nav.locator('a[href]').evaluateAll((as) => as.map((a) => new URL(a.href).pathname))),
  ].filter((p) => p !== '/') // the brand mark's link home, not a menu leaf
  check(
    `${label}: the granted menu opens to its leaves (every group and sub-group)`,
    leaves.length >= 25 && (await nav.locator('button[aria-expanded="false"]').count()) === 0,
    `${leaves.length} leaves`,
  )

  // Home is not a menu leaf, but it is the screen everyone lands on: visited too, with no leaf
  // marked.
  for (const path of ['/', ...leaves]) {
    const slug = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')
    const at = `${label} ${path}`
    errors.length = 0
    await page.goto(BASE + path)
    await page.locator('main').first().waitFor({ timeout: 20000 })
    await page.waitForLoadState('networkidle')
    if (SCREEN_ACTIONS[path]) {
      await SCREEN_ACTIONS[path](page)
      await page.waitForLoadState('networkidle')
    }
    await page.waitForTimeout(500)

    // No grid header on the leaf is clipped: each label inside its own header cell (a column
    // with no group spans the group row too, so its cell is two rows tall), each row 28px.
    const heads = await page.evaluate(() =>
      [...document.querySelectorAll('.ag-header-row')]
        .filter((row) => row.getBoundingClientRect().width > 0)
        .map((row) => {
          const r = row.getBoundingClientRect()
          const texts = [...row.querySelectorAll('.ag-header-cell-text, .ag-header-group-text')].filter(
            (t) => t.getBoundingClientRect().width > 0,
          )
          const cut = texts
            .filter((t) => {
              const b = t.getBoundingClientRect()
              const c = t.closest('.ag-header-cell, .ag-header-group-cell').getBoundingClientRect()
              return b.top < c.top - 0.5 || b.bottom > c.bottom + 0.5 || t.scrollHeight > t.clientHeight + 1
            })
            .map((t) => t.textContent)
          const narrow = texts
            .filter((t) => t.scrollWidth > t.clientWidth + 1)
            .map((t) => `${t.textContent} ${t.scrollWidth}/${t.clientWidth}`)
          return { height: Math.round(r.height), cut, narrow }
        }),
    )
    check(
      `${at}: no grid header is clipped (every label inside its cell, every row 28px)`,
      heads.every((h) => h.height === 28 && h.cut.length === 0),
      JSON.stringify(heads.filter((h) => h.height !== 28 || h.cut.length)),
    )

    // A form control is a 6px control (F7, 377): the textareas the sweep moved off `rounded-lg`
    // — `NoteField`'s shape — measured where one is on a menu leaf.
    if (path === '/oms/central-invoice')
      for (const radius of await page.locator('main textarea').evaluateAll((els) => els.map((el) => getComputedStyle(el).borderRadius)))
        check(`${at}: a textarea is a 6px control`, radius === '6px', radius)

    // The rail marks exactly this leaf: one link that is `aria-current` OR paints a marker.
    // The call center too, since 407 joined it to the shell.
    {
      const marked = (
        await nav.locator('a[href]').evaluateAll((as) =>
          as.map((a) => ({
            path: new URL(a.href).pathname,
            current: a.getAttribute('aria-current'),
            marker: getComputedStyle(a, '::before').backgroundColor,
          })),
        )
      ).filter((a) => a.current || a.marker !== 'rgba(0, 0, 0, 0)')
      check(
        path === '/'
          ? `${at}: no leaf is marked on Home`
          : `${at}: the rail's gold marker sits on this leaf, and only this one`,
        path === '/'
          ? marked.length === 0
          : marked.length === 1 && marked[0].path === path && marked[0].current === 'page' && marked[0].marker === GOLD,
        JSON.stringify(marked),
      )
    }

    // A toast through the app's own notify — the dev server's one instance of the module, so it
    // reaches the one Toaster.
    const title = `drive-391 ${slug}`
    await page.evaluate(async (t) => {
      const { notify } = await import('/src/core/services/notify.ts')
      notify.info(t)
    }, title)
    const toast = page.locator('[data-sonner-toast]').filter({ hasText: title })
    await toast.waitFor({ timeout: 5000 })
    await page.waitForTimeout(600) // sonner's enter transition
    const t = await toast.evaluate((el) => el.getBoundingClientRect().toJSON())
    check(
      `${at}: a toast lands at the bottom inline-END corner (${rtl ? 'bottom-left' : 'bottom-right'})`,
      Math.abs(VIEW.height - 16 - t.bottom) <= 1 &&
        (rtl ? Math.abs(t.left - 16) <= 1 : Math.abs(VIEW.width - 16 - t.right) <= 1),
      JSON.stringify(t),
    )

    // The sweep's eye-help: printed, never failed.
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('main button, main input, main select, main [role="tab"], #layout-topbar button')]
        .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0)
        .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()} "${(el.textContent || el.value || el.placeholder || '').trim().slice(0, 30)}" ` +
            `${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`,
        ),
    )
    // …and a cell whose content stands taller than its 26px row (a badge, a button, a chip).
    const tallCells = await page.evaluate(() =>
      [...document.querySelectorAll('.ag-center-cols-container .ag-cell, .ag-pinned-left-cols-container .ag-cell, .ag-pinned-right-cols-container .ag-cell')]
        .flatMap((cell) => {
          const c = cell.getBoundingClientRect()
          return [...cell.querySelectorAll('*')]
            .filter((el) => {
              const b = el.getBoundingClientRect()
              return b.height > 0 && (b.top < c.top - 0.5 || b.bottom > c.bottom + 0.5)
            })
            .map((el) => `${cell.getAttribute('col-id')}: ${el.tagName.toLowerCase()} ${Math.round(el.getBoundingClientRect().height)}px in ${Math.round(c.height)}px`)
        })
        .filter((v, i, all) => all.indexOf(v) === i),
    )
    const narrow = heads.flatMap((h) => h.narrow)
    if (overflow.length || narrow.length || tallCells.length)
      console.log(`SWEEP ${at}: ${JSON.stringify({ overflow, narrow, tallCells })}`)

    check(`${at}: no page errors`, errors.length === 0, errors.join(' | ').slice(0, 400))
    await toast.evaluate((el) => (el.style.visibility = 'hidden')) // the capture is about the screen
    await page.screenshot({ path: `${ALL_SCREENS_SHOTS}/${slug}-${theme}-${dir}.png` })
  }
  await context.close()
}

// DRIVE_ONLY=paint|grids|ranges|rail|topbar|narrow|overlays|bell|dialogs|screens runs one part, for a
// slice's inner loop; `--all-screens` is DRIVE_ONLY=screens; unset runs all.
const ONLY = process.argv.includes('--all-screens') ? 'screens' : process.env.DRIVE_ONLY
const PARTS = {
  paint: driveOneMode,
  grids: driveGrids,
  ranges: driveRanges,
  rail: driveRail,
  topbar: driveTopbar,
  narrow: driveNarrow,
  overlays: driveOverlays,
  bell: driveBell,
  dialogs: driveDialogs,
  screens: driveScreens,
}
for (const [part, drive] of Object.entries(PARTS))
  if (!ONLY || ONLY === part)
    for (const dir of ['ltr', 'rtl']) for (const theme of ['light', 'dark']) await drive({ theme, dir })

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
