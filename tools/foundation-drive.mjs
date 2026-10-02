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
// The `dir` switch does not ship until 383's boot wiring, so the RTL passes set `dir="rtl"` on
// <html> before the app boots, the way document-rtl-drive.mjs does. The Arabic text is a stub ROW
// value (there is no Arabic locale file, by design).
//
// Every `/api/**` call is stubbed (the delivery list needs a store grant a dev session lacks;
// see grid-theme-drive.mjs). Mocked data, real app, real browser, real CSS, real fonts.
//
//   1. run the app:  npx vite --port 5199   (any port; pass it as DRIVE_PORT)
//   2. node tools/foundation-drive.mjs
//
// Screenshots → tools/.foundation-shots/.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

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

async function driveOneMode({ theme, dir }) {
  const label = `${theme}/${dir}`
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // Before the app boots, as index.html's own pre-paint script reads it.
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

  const cellFonts = await renderedFonts('.ag-root', '80001238')
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

for (const dir of ['ltr', 'rtl']) for (const theme of ['light', 'dark']) await driveOneMode({ theme, dir })

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
