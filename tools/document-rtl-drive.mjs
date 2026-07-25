// RTL / bidi drive (ticket 095, spec 083; the mechanisms were measured in the
// 080 mirroring audit) — drives the REAL app in Chromium against the five
// captured payloads in `.issues/assets/078-document-payloads/`, exactly as the
// other document drives do. The payloads are replayed verbatim; the app is not
// stubbed, only the wire is.
//
// The `dir` switch does NOT ship (095 Boundaries) — this tool sets `dir="rtl"`
// on `<html>` itself, which is precisely the manual devtools check the ticket's
// Proof describes, automated so it is repeatable.
//
// Asserts, in BOTH directions:
//   1. LTR is UNCHANGED — the six isolated values read in the same visual order
//      and at the same geometry as before the wrappers landed (an inline `<bdi>`
//      contributes no box), and no mirroring transform is applied;
//   2. the six bidi-hazard values render through `Ltr` and read left-to-right
//      under RTL — measured off character client rects, then RE-MEASURED with
//      the wrapper stripped from the DOM, which is the red half of the pair:
//      without it the value provably reorders;
//   3. the identity band's customer block pins to the band's END in both
//      directions (`ms-auto`, never `ml-auto`) — including when the band wraps,
//      which is the moment the latent fault would bite;
//   4. the back chevron and the external-link `↗` carry a mirroring transform
//      under RTL and none under LTR; Refresh `↻` and `⚡` carry none in either;
//   5. the selected-row accent bar rides `::before` on the row's START side in
//      both directions, and NO `box-shadow` carries it (shadow offsets are
//      physical and have no logical form).
//
// The ticket's sixth item — `border-start-start-radius: 0` on the work-area
// frame — has NO counterpart in this build and so is asserted nowhere: the
// prototype's notched `.gridwrap{border-radius:0 9px 9px 9px}` became an
// underline tablist over an unframed panel (`DocumentDetailsPage.tsx`), so
// there is no square notch meeting the active tab to keep on the right side.
// The grid's own `wrapperBorderRadius` is symmetric on all four corners.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/document-rtl-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

// `8000000121` is the one capture that carries every field under test at once:
// a city beside the phone in the band, a `documentDate`/`entryTime` pair, a
// delivery window, a driver phone, a `trackingUrl` (the corpus's only live
// external link) and lines to sum in the footer. `isExpressDelivery` is false on
// all five captures, so the ⚡ tag is switched on here — the same patch
// `document-band-drive.mjs` makes, and for the same reason.
const DOC = '8000000121'
DOCUMENTS[DOC] = { ...DOCUMENTS[DOC], isExpressDelivery: true }

/**
 * Read a value's VISUAL order off character client rects: the x of its first
 * printing character against the x of its last. `> 0` means the value reads
 * left-to-right on screen, whatever the paragraph around it is doing.
 *
 * Reasoning about bidi on paper is what the 080 audit overturned twice, so this
 * measures the rendered result rather than asserting a class name.
 */
const READS_LTR = (el) => {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.trim()) nodes.push(n)
  if (nodes.length === 0) return null
  const at = (node, offset) => {
    const range = node.ownerDocument.createRange()
    range.setStart(node, offset)
    range.setEnd(node, offset + 1)
    return range.getBoundingClientRect().x
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  return at(last, last.data.replace(/\s+$/, '').length - 1) - at(first, first.data.search(/\S/))
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    const doc = p.match(/^SdDocument\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  await page.addInitScript(`window.READS_LTR = ${READS_LTR.toString()}`)

  const band = () => page.locator('[aria-label="Document identity"]')
  const rail = () => page.locator('[aria-label="Document summary"]')
  // Every tab panel stays mounted and is hidden with CSS (D-23), so the grid
  // under test is scoped to the visible one.
  const items = () => page.locator('[role="tabpanel"]:not([hidden]) .ag-root-wrapper')
  const FOOTER = '.ag-grid-pinned-bottom-rows .ag-row'
  const LINE = '.ag-grid-scrolling-rows .ag-row'

  const setDir = async (dir) => {
    await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir)
    await page.waitForTimeout(120)
  }

  await page.goto(`${BASE}/oms/document/${DOC}`)
  await rail().waitFor()
  await page.waitForTimeout(200)

  // ── 1. the six hazards are wrapped, and the wrapper is doing work ───────────
  //
  // Each carries the value `8000000121` produces, so an isolate that drifted to
  // the wrong field fails here rather than passing on its position in the DOM.
  const HAZARDS = [
    // The band's two isolates: `Placed` sits inside the sub-ids' `<b>`, the
    // customer contact is the band's last element.
    ['the band’s Placed date · time', () => band().locator('b bdi'), 'March 6, 2025 · 02:46'],
    [
      'the band’s customer contact (phone · city)',
      () => band().locator('bdi').last(),
      '966501076360 · Dammam - ad dabab',
    ],
    ['the Customer card’s mobile', () => rail().locator('bdi').nth(0), '966501076360'],
    [
      'the Fulfilment card’s delivery window',
      () => rail().locator('bdi').nth(1),
      'Monday, 8pm - 10 pm',
    ],
    ['the Driver card’s mobile', () => rail().locator('bdi').nth(2), '0501076360'],
    ['the items grid’s totals footer', () => items().locator(FOOTER + ' bdi'), '1 line · 2 units'],
  ]

  for (const dir of ['ltr', 'rtl']) {
    await setDir(dir)
    for (const [name, locate, expected] of HAZARDS) {
      const el = locate().first()
      const count = await locate().count()
      const isolated =
        count > 0 &&
        (await el.evaluate((n) => n.tagName === 'BDI' && n.getAttribute('dir') === 'ltr'))
      const text = count > 0 ? (await el.innerText()).replace(/\s+/g, ' ').trim() : null
      const order = count > 0 ? await el.evaluate((n) => window.READS_LTR(n)) : null
      check(
        `${dir}: ${name} is isolated and reads left-to-right`,
        isolated && text === expected && order > 0,
        `${JSON.stringify(text)} order=${order === null ? 'n/a' : Math.round(order)}`,
      )
    }
  }

  // The red half: strip the isolate under RTL and the value provably reorders.
  // A hazard that reads correctly WITHOUT the wrapper would mean the wrapper is
  // decoration — and the audit's whole finding is that only some values break.
  await setDir('rtl')
  const broken = await band()
    .locator('bdi')
    .last()
    .evaluate((n) => {
      const parent = n.parentElement
      const before = window.READS_LTR(n)
      const text = n.textContent
      n.replaceWith(text)
      const after = window.READS_LTR(parent)
      return { before, after, text }
    })
  check(
    'rtl: the same value REORDERS once its isolate is stripped',
    broken.before > 0 && broken.after < 0,
    `${JSON.stringify(broken.text)} wrapped=${Math.round(broken.before)} bare=${Math.round(broken.after)}`,
  )
  await page.reload()
  await rail().waitFor()
  await page.waitForTimeout(200)

  // ── 2. the band's customer block pins to the band's END, both directions ────
  for (const dir of ['ltr', 'rtl']) {
    await setDir(dir)
    for (const width of [1600, 700]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.waitForTimeout(160)
      const geo = await band().evaluate((el) => {
        const cust = el.lastElementChild
        const b = el.getBoundingClientRect()
        const c = cust.getBoundingClientRect()
        return { startGap: c.left - b.left, endGap: b.right - c.right, wrapped: c.top > b.top + 20 }
      })
      // `ms-auto` eats the space on the START side, whichever side that is —
      // the physical `ml-auto` this replaces would eat the LEFT in both.
      const pinned = dir === 'ltr' ? geo.endGap < geo.startGap : geo.startGap < geo.endGap
      check(
        `${dir} @${width}px: the customer block pins to the band’s end${geo.wrapped ? ' (wrapped)' : ''}`,
        pinned,
        `start=${Math.round(geo.startGap)} end=${Math.round(geo.endGap)}`,
      )
    }
    await page.setViewportSize({ width: 1600, height: 1000 })
  }

  // ── 3. the icons that mirror, and the ones that must not ───────────────────
  const ICONS = [
    ['the back chevron', () => band().locator('a svg').first(), true],
    ['the external-link ↗', () => rail().locator('a[target="_blank"] svg').first(), true],
    ['Refresh ↻', () => page.locator('[aria-label="Document status"] button svg').last(), false],
    ['the ⚡ Dawaa Now tag', () => band().locator('span svg').first(), false],
  ]
  for (const dir of ['ltr', 'rtl']) {
    await setDir(dir)
    for (const [name, locate, mirrors] of ICONS) {
      if ((await locate().count()) === 0) {
        check(`${dir}: ${name} is on screen`, false, 'not found')
        continue
      }
      // Tailwind v4's `-scale-x-100` compiles to the standalone `scale`
      // property, not to a `transform` matrix — read both, so the probe cannot
      // pass an icon that is unflipped because it measured the wrong property.
      const flipped = await locate()
        .first()
        .evaluate((n) => {
          const s = getComputedStyle(n)
          return s.scale.startsWith('-1') || s.transform.startsWith('matrix(-1')
        })
      const want = mirrors && dir === 'rtl'
      check(
        `${dir}: ${name} ${want ? 'mirrors' : 'does not mirror'}`,
        flipped === want,
        `flipped=${flipped}`,
      )
    }
  }

  // ── 4. the selected-row bar: ::before on the start side, never a shadow ─────
  for (const dir of ['ltr', 'rtl']) {
    await setDir(dir)
    await items().locator(LINE).first().click()
    await page.waitForTimeout(120)
    const bar = await items().locator('.ag-row-selected').first().evaluate((row) => {
      const read = () => {
        const before = getComputedStyle(row, '::before')
        return { width: before.width, left: before.left, right: before.right }
      }
      const asBuilt = read()
      // The grid keeps its OWN direction: `enableRtl` is deliberately unwired
      // (095 Boundaries — F6/F8 belong to the effort that ships the `dir`
      // switch), so AG Grid's `.ag-ltr` root stays LTR even under `dir=rtl` and
      // the bar correctly follows the GRID, not the page. Forcing the row's
      // `direction` is what proves the spelling is logical rather than
      // page-coupled — it is exactly the flip `enableRtl` will perform.
      row.style.direction = 'rtl'
      const forced = read()
      row.style.direction = ''
      return {
        ...asBuilt,
        forcedRight: forced.right,
        direction: getComputedStyle(row).direction,
        rowShadow: getComputedStyle(row).boxShadow,
        cellShadow: getComputedStyle(row.querySelector('.ag-cell')).boxShadow,
      }
    })
    check(
      `${dir}: the selected-row bar is a 3px ::before on the grid’s own start side`,
      bar.width === '3px' && (bar.direction === 'ltr' ? bar.left === '0px' : bar.right === '0px'),
      `grid dir=${bar.direction} w=${bar.width} left=${bar.left} right=${bar.right}`,
    )
    check(
      `${dir}: and it follows a direction flip — the offset is logical, not physical`,
      bar.forcedRight === '0px',
      `right=${bar.forcedRight}`,
    )
    check(
      `${dir}: no box-shadow carries the bar`,
      bar.rowShadow === 'none' && bar.cellShadow === 'none',
      `row=${bar.rowShadow} cell=${bar.cellShadow}`,
    )
  }

  // ── 5. LTR is visually unchanged ───────────────────────────────────────────
  //
  // An inline `<bdi>` contributes no box of its own, so every isolated value
  // must occupy exactly the rect its parent gave it — which is what "no visual
  // change to the shipping screen" means, measured.
  await setDir('ltr')
  const inert = await page.evaluate(() =>
    [...document.querySelectorAll('bdi')].every((n) => {
      const s = getComputedStyle(n)
      const own = n.getBoundingClientRect()
      const parent = n.parentElement.getBoundingClientRect()
      return (
        s.display === 'inline' &&
        s.marginLeft === '0px' &&
        s.paddingLeft === '0px' &&
        own.height <= parent.height + 0.5 &&
        own.width <= parent.width + 0.5
      )
    }),
  )
  check('ltr: every isolate is an inert inline box — nothing on the screen moved', inert)

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
