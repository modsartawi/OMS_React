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
//      physical and have no logical form);
//   6. the RETURN DIALOG mirrors (ticket 295) — its `me-auto` gate sentence,
//      `text-end` value cell and `text-start` header cells report the same
//      LOGICAL geometry in both directions, so a physical twin (`mr-auto`,
//      `text-right`, `text-left`) fails the `rtl` half while leaving the `ltr`
//      half byte-identical.
//   7. the ATTACHMENTS TAB mirrors (ticket 327), and its + Add prescription
//      (ticket 330): the Add button and caption field sit at the region's START,
//      an Arabic caption reads right-to-left in its field, and the POSTED
//      `Caption` part is the Arabic exactly as typed — in both directions.
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
// `canReturn` is switched on for the same reason `isExpressDelivery` is: it is
// a BackOffice spec 1283 §2b addition that these captures predate, and without
// it Return Document renders disabled-with-a-reason and section 6's dialog never
// opens. The capture's single line (quantity 2, undeleted) is what section 6
// measures. ⚠ It contributes NO fee rows — its one item-0 `DFEE` carries a blank
// `condCategory`, as every condition on this capture does, and `refundableFees`
// filters on category `F` (ticket 293's recorded drift). The dialog renders
// `data-return-fees=0`, which is why section 6 asserts nothing about fees.
// Ticket 295.
DOCUMENTS[DOC] = { ...DOCUMENTS[DOC], isExpressDelivery: true, canReturn: true }

// Section 7 (spec 324, ticket 327): the Attachments tab in the Arabic layout. The order capture
// `2000000551` is patched with the three attachment fields (BackOffice 2063 + 2077's stub) — and it
// alone, so every section above reads the captures exactly as before. Its one file carries an
// Arabic caption, which must read right-to-left whatever the page's direction.
const RX_DOC = '2000000551'
DOCUMENTS[RX_DOC] = { ...DOCUMENTS[RX_DOC], attachmentOwnerNo: RX_DOC, attachmentCount: 1, attachmentCategory: 'P2E' }
const RX_CAPTION = 'الوصفة الطبية — صفحة ٢'
const RX_FILES = [
  {
    attachmentId: '01K61A0000000000000000RTL1',
    status: 'STORED',
    ownerKind: 'SD_DOCUMENT',
    ownerKey: RX_DOC,
    category: 'P2E',
    kind: 'PRESCRIPTION',
    fileName: 'rx-front.jpg',
    sizeBytes: 4096,
    storedAt: '2026-09-26T10:12:44',
    sourceDevice: '',
    uploadedBy: 'U123',
    caption: RX_CAPTION,
    storeCode: '',
  },
]

/** Every `Caption` part an Upload posted (ticket 330), decoded from the wire's UTF-8 bytes; `null` for none. */
const postedCaptions = []
const captionPart = (request) => {
  const raw = (request.postDataBuffer() ?? Buffer.alloc(0)).toString('latin1')
  const m = /name="Caption"\r\n\r\n([\s\S]*?)\r\n--/.exec(raw)
  return m ? Buffer.from(m[1], 'latin1').toString('utf8') : null
}

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
    // Ticket 125 put the OMS screens behind SdDocumentWeb/Access; the detail page
    // guards on canOpenDetail, so this drive must answer the probe or every
    // assertion below meets the denied card instead of the screen.
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    // Section 7 (ticket 327): the one document that names an attachment owner and category.
    if (p === 'AttachmentWeb/Access') return route.fulfill(envelope({ categories: ['P2E'], withdrawCategories: [] }))
    if (p === 'AttachmentWeb/ByOwner')
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data: RX_FILES, withdrawn: [] }),
      })
    // Section 7 (ticket 330): + Add prescription — the posted Caption part is kept to be asserted.
    if (p === 'AttachmentWeb/Upload') {
      postedCaptions.push(captionPart(route.request()))
      return route.fulfill(envelope({ ...RX_FILES[0], attachmentId: `01K61A000000000000000RTLU${postedCaptions.length}` }))
    }
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
    // A grid cell: isolated by the base renderer every grid spreads (383, F25) —
    // a `<bdi>` left to `dir=auto`, which resolves LTR on this Latin label.
    ['the items grid’s totals footer', () => items().locator(FOOTER + ' bdi'), '1 line · 2 units', 'auto'],
  ]

  for (const dir of ['ltr', 'rtl']) {
    await setDir(dir)
    for (const [name, locate, expected, isolateDir = 'ltr'] of HAZARDS) {
      const el = locate().first()
      const count = await locate().count()
      const isolated =
        count > 0 &&
        (await el.evaluate(
          (n, d) => n.tagName === 'BDI' && (d === 'auto' ? !n.hasAttribute('dir') : n.getAttribute('dir') === d),
          isolateDir,
        ))
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
      // The grid keeps the direction it BOOTED with: `enableRtl` is `@initial`
      // and read once from the boot `dir` (383), and this drive flips `dir` at
      // runtime, so AG Grid's `.ag-ltr` root stays LTR under `dir=rtl` and the
      // bar correctly follows the GRID, not the page. Forcing the row's
      // `direction` is what proves the spelling is logical rather than
      // page-coupled — it is exactly the flip `enableRtl` performs at boot.
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
  const notInert = await page.evaluate(() =>
    [...document.querySelectorAll('bdi')]
      .filter((n) => {
        const s = getComputedStyle(n)
        const own = n.getBoundingClientRect()
        const parent = n.parentElement.getBoundingClientRect()
        // A grid cell's value box clips with an ellipsis (383's base renderer
        // isolates every cell): a long item name overflows it exactly as the bare
        // text did, so width is compared only where the parent does not clip.
        const clips = getComputedStyle(n.parentElement).overflow === 'hidden'
        return !(
          s.display === 'inline' &&
          s.marginLeft === '0px' &&
          s.paddingLeft === '0px' &&
          own.height <= parent.height + 0.5 &&
          (clips || own.width <= parent.width + 0.5)
        )
      })
      .map((n) => `${n.parentElement.className.split(' ')[0]}: ${n.textContent.slice(0, 30)}`),
  )
  check('ltr: every isolate is an inert inline box — nothing on the screen moved', notInert.length === 0, notInert.slice(0, 4).join(' | '))

  // ── 6. the return dialog mirrors ───────────────────────────────────────────
  //
  // Ticket 295's RTL pass. The dialog is the wave's one new surface, and it is
  // built almost entirely out of logical utilities that have never been measured
  // under a direction flip. Three are asserted here, and each was chosen because
  // it has a PHYSICAL TWIN that looks identical in LTR and lands on the wrong
  // edge in RTL — the class of fault a class-name grep cannot see:
  //
  //   `me-auto`    on the gate sentence     (twin: `mr-auto`)
  //   `text-end`   on the line value cell   (twin: `text-right`)
  //   `text-start` on the line header cells (twin: `text-left`)
  //
  // ⚠ A utility with NO physical twin is not worth an assertion here: the
  // select-all column's `w-9` is direction-neutral, and "the first cell sits at
  // the start" follows from table layout under `dir` rather than from anything
  // this screen chose. Asserting it would read as coverage while being unable to
  // fail for the stated reason. The fees table is likewise unasserted — on
  // capture `8000000121` every `condCategory` comes back blank (ticket 293's
  // recorded drift), so that document offers no fee rows to measure at all.
  //
  // Pinning is asserted as a LOGICAL gap, so a correctly-mirrored element reports
  // the SAME numbers in both directions and the two checks read as one fact.
  // Asserting a physical side outright would pass a physically-pinned element in
  // one direction, which is the mistake the 080 audit made twice.
  //
  // ⚠ **Mutation-checked** on build (2026-08-24), because an RTL assertion that
  // cannot fail is worse than none. Swapping each utility to its physical twin
  // (`mr-auto`, `text-right`, `text-left`) leaves the `ltr` check passing
  // BYTE-IDENTICALLY and fails only the `rtl` one. That asymmetry is the whole
  // hazard — a physical utility is invisible in the direction we develop in —
  // and it is also the bar each check must clear: a check that fails in both
  // directions is measuring its own selector, not the layout.
  for (const dir of ['ltr', 'rtl']) {
    await setDir(dir)
    // `getByRole('button', { name })` would match the disabled-reason tooltip
    // text too; the command bar's own button is scoped by its section.
    await page
      .locator('[aria-label="Actions"] button', { hasText: 'Return Document' })
      .first()
      .click()
    const dialog = page.locator('dialog[open]')
    // ⚠ The wait must not THROW, or the check below cannot fail: a bare
    // `waitFor` aborts the drive on a dialog that never opens, and the `check`
    // that follows it would then only ever run in the case where it passes —
    // reading as coverage while being unable to report the one thing it names.
    // Reported as a failure and the direction skipped, so the remaining
    // assertions do not cascade into noise off a dialog that isn't there.
    const opened = await dialog
      .waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true, () => false)
    check(`${dir}: the return dialog opens`, opened)
    // ⚠ Escape on the way out of the FAILURE path too. The dialog is modal, so
    // one left open swallows the next direction's click on the command bar and
    // the drive dies at the click rather than reporting the direction that
    // actually broke.
    if (!opened) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(150)
      continue
    }

    // Tick every line: the per-line VALUE cell renders empty until its line is
    // picked (the client never invents a total for a line nobody asked back), so
    // an unticked dialog has no `text-end` money to measure at all.
    await dialog.locator('input[aria-label="Select all lines"]').check()
    await page.waitForTimeout(120)

    const geometry = await dialog.evaluate((root, dir) => {
      // ⚠ `startGap` is LOGICAL: under RTL the start edge IS the right edge, so
      // the physical gaps swap. Measuring `left - left` in both directions is
      // the same physical-thinking mistake these assertions exist to catch, and
      // it reports a correctly-mirrored element as a failure.
      const pin = (rect, box) => {
        const b = box.getBoundingClientRect()
        const left = rect.left - b.left
        const right = b.right - rect.right
        return dir === 'rtl' ? { startGap: right, endGap: left } : { startGap: left, endGap: right }
      }
      // Where the GLYPHS landed, not where the box is: `text-start`/`text-end`
      // move text inside a cell that keeps its own rect either way, so a range
      // over the element would report the one thing these utilities never touch.
      const glyphs = (el) => {
        const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let node = null
        for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.trim()) node = n
        if (!node) return null
        const range = el.ownerDocument.createRange()
        range.setStart(node, node.data.search(/\S/))
        range.setEnd(node, node.data.replace(/\s+$/, '').length)
        return pin(range.getBoundingClientRect(), el)
      }

      const out = {}
      // The gate sentence rides `me-auto` inside a `justify-end` footer, so it
      // is pushed to the footer's START in BOTH directions.
      const gate = root.querySelector('[data-return-gate]')
      if (gate) out.gate = pin(gate.getBoundingClientRect(), gate.parentElement)
      // A ticked line's value cell is `text-end`: its glyphs hug the cell's END.
      const money = root.querySelector('[data-return-value]')
      if (money) out.money = glyphs(money)
      // A line-table header is `text-start`: its glyphs hug the cell's START.
      // ⚠ Selected STRUCTURALLY — the first header carrying text, the lines
      // table's line-number column. Selecting it by computed `text-align: start`
      // would let the SELECTOR do the assertion: a `text-left` swap would match
      // nothing and the check would fail in BOTH directions, including the LTR
      // one where that swap is genuinely invisible. The mutation must fail the
      // `rtl` half only, or it is not measuring the hazard.
      const head = [...root.querySelectorAll('thead th')].find((th) => th.textContent.trim())
      if (head) out.head = glyphs(head)
      return out
    }, dir)

    // A pinned edge is tight (a few px of padding); the opposite edge is slack.
    const pinned = (m) => m && m.startGap < m.endGap
    check(
      `${dir}: the gate sentence pins to the footer's START (me-auto, not mr-auto)`,
      pinned(geometry.gate),
      `start=${geometry.gate?.startGap?.toFixed(1)} end=${geometry.gate?.endGap?.toFixed(1)}`,
    )
    check(
      `${dir}: a money cell hugs its cell's END (text-end, not text-right)`,
      geometry.money && geometry.money.endGap < geometry.money.startGap,
      `start=${geometry.money?.startGap?.toFixed(1)} end=${geometry.money?.endGap?.toFixed(1)}`,
    )
    check(
      `${dir}: a line header hugs its cell's START (text-start, not text-left)`,
      pinned(geometry.head),
      `start=${geometry.head?.startGap?.toFixed(1)} end=${geometry.head?.endGap?.toFixed(1)}`,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
  await setDir('ltr')

  // ── 7. the Attachments tab mirrors (ticket 327) ─────────────────────────────
  //
  // The tab is the new surface. Measured LOGICALLY, as section 6 is, so a correctly
  // mirrored element reports the same fact in both directions:
  //   - the tab is the tablist's LAST, at its END (after Jobs in reading order);
  //   - the list sits at the work area's START and the preview beside it at the END;
  //   - a header cell's glyphs hug the cell's START (`text-start`, twin `text-left`);
  //   - the Arabic caption reads RIGHT-TO-LEFT in both directions (`dir="auto"`).
  await page.goto(`${BASE}/oms/document/${RX_DOC}`)
  await rail().waitFor()
  await page.locator('#tab-attachments').waitFor()
  await page.locator('#tab-attachments').click()
  await page.locator('#tabpanel-attachments [data-testid="slip-list"]').waitFor()
  for (const dir of ['ltr', 'rtl']) {
    await setDir(dir)
    const geo = await page.evaluate((dir) => {
      const tab = document.querySelector('#tab-attachments').getBoundingClientRect()
      const jobs = document.querySelector('#tab-jobs').getBoundingClientRect()
      const panel = document.querySelector('#tabpanel-attachments')
      const list = panel.querySelector('[data-testid="slip-list"]').getBoundingClientRect()
      const preview = panel.querySelector('[data-region="slip-preview"]').getBoundingClientRect()
      // "after" in reading order: further right in LTR, further left in RTL.
      const after = (a, b) => (dir === 'rtl' ? a.right <= b.left + 0.5 : a.left >= b.right - 0.5)
      const th = panel.querySelector('thead th')
      const text = [...th.childNodes].find((n) => n.nodeType === 3 && n.data.trim())
      const range = document.createRange()
      range.setStart(text, 0)
      range.setEnd(text, text.data.length)
      const glyphs = range.getBoundingClientRect()
      const cell = th.getBoundingClientRect()
      const startGap = dir === 'rtl' ? cell.right - glyphs.right : glyphs.left - cell.left
      const endGap = dir === 'rtl' ? glyphs.left - cell.left : cell.right - glyphs.right
      return { tabAfterJobs: after(tab, jobs), previewAfterList: after(preview, list), startGap, endGap }
    }, dir)
    check(`${dir}: the Attachments tab sits after Jobs, at the tablist's end`, geo.tabAfterJobs)
    check(`${dir}: the preview sits after the file list, at the work area's end`, geo.previewAfterList)
    check(
      `${dir}: a list header hugs its cell's START (text-start, not text-left)`,
      geo.startGap < geo.endGap,
      `start=${geo.startGap.toFixed(1)} end=${geo.endGap.toFixed(1)}`,
    )
    // An Arabic run reads right-to-left inside any paragraph, so the order alone cannot fail;
    // what `dir="auto"` adds is the caption's OWN direction — right-to-left even on an LTR page,
    // so its neutral characters (the dash, the digit) sit where an Arabic reader expects them.
    const caption = page.locator('#tabpanel-attachments [data-cell="caption"]')
    const captionText = await caption.innerText()
    const read = await caption.evaluate((n) => ({ order: window.READS_LTR(n), direction: getComputedStyle(n).direction }))
    check(
      `${dir}: the Arabic caption is exact, isolated as right-to-left, and reads so`,
      captionText === RX_CAPTION && read.direction === 'rtl' && read.order < 0,
      `${JSON.stringify(captionText)} direction=${read.direction} order=${Math.round(read.order)}`,
    )

    // + Add prescription (ticket 330): the button and the caption field hug the region's START.
    const add = await page.evaluate((dir) => {
      const region = document.querySelector('#tabpanel-attachments [data-region="slip-add"]').getBoundingClientRect()
      const gaps = (el) => {
        const r = el.getBoundingClientRect()
        return dir === 'rtl'
          ? { start: region.right - r.right, end: r.left - region.left }
          : { start: r.left - region.left, end: region.right - r.right }
      }
      return {
        button: gaps(document.querySelector('#tabpanel-attachments [data-testid="slip-add"]')),
        field: gaps(document.querySelector('#tabpanel-attachments [data-testid="slip-add-caption"]')),
      }
    }, dir)
    check(
      `${dir}: + Add prescription and its caption field sit at the region's START`,
      add.button.start < 1 && add.button.end > add.button.start && add.field.start < 1 && add.field.end > add.field.start,
      JSON.stringify(add),
    )
    // An Arabic caption, typed and posted: the field reads it right-to-left, and the WIRE carries it exactly.
    const typed = `وصفة مرسلة بالبريد — ${dir === 'rtl' ? 'صفحة ١' : 'صفحة ٢'}`
    const field = page.locator('#tabpanel-attachments [data-testid="slip-add-caption"]')
    await field.fill(typed)
    const fieldDirection = await field.evaluate((n) => getComputedStyle(n).direction)
    const posts = postedCaptions.length
    await page.locator('#tabpanel-attachments [data-testid="slip-add-input"]').setInputFiles({
      name: `rx-${dir}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
    })
    await page
      .locator(`#tabpanel-attachments li[data-upload="rx-${dir}.pdf"][data-status="stored"]`)
      .waitFor({ timeout: 8000 })
      .catch(() => {})
    const posted = postedCaptions[posts] ?? ''
    check(
      `${dir}: an Arabic caption reads right-to-left in its field, and the POSTED Caption part is exactly as typed`,
      fieldDirection === 'rtl' &&
        postedCaptions.length === posts + 1 &&
        Buffer.from(posted, 'utf8').equals(Buffer.from(typed, 'utf8')),
      `direction=${fieldDirection} posted=${JSON.stringify(posted)}`,
    )
  }
  await setDir('ltr')

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
