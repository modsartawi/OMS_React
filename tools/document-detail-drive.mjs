// Document Details ACCEPTANCE drive (ticket 096, spec 083) — the end-to-end pass
// over the whole rebuilt Screen 2, after the five region tickets (090–095) each
// drove their own region. It drives the REAL app in Chromium and serves the five
// captured payloads from `.issues/assets/078-document-payloads/` as the document
// response, exactly as its five predecessors do: the payloads are replayed
// verbatim, so what renders is what the live estate sent on 2026-07-24; the app
// is not stubbed, only the wire is. (SIS.Api is reachable on :5111 but wants an
// operator login this tool has no credentials for — same posture as
// `bby-inquiry-drive.mjs`, and the data is the live capture either way.)
//
// Asserts the ticket's five acceptance items:
//   1. the identity band's big line IS the document number — and the largest
//      text on the page — on all five captures;
//   2. the pill rail's entries match 090's corpus table exactly, pill counts
//      2·0·2·2·0 beside the anchor (this is 090's note honoured: the corpus
//      table is asserted here, in the acceptance pass, not only in its own
//      region drive);
//   3. all four tabs — Items · Header Conditions · Log · Jobs — switch, and a
//      column width and a sort the operator set on the Items grid SURVIVE the
//      switch away and back (D-23: panels are hidden with CSS, never unmounted);
//   4. the summary rail unstacks ABOVE the work area below 900px, and sits
//      beside it at 340px above;
//   5. the terminal pair renders at the END of the bar, at cluster-button
//      height, and goes disabled while a command is in flight.
//
// Two collections the captures do not carry — Log and Jobs — are synthesised
// from plausible rows so the two deferred tabs have a grid to switch to at all;
// the rows are fixtures, the tab machinery under test is the app's.
//
// `DRIVE_SHOTS=<dir>` also writes a full-page screenshot per document per theme,
// which is what the ticket's manual both-theme pass is read from.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/document-detail-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
const SHOT_DIR = process.env.DRIVE_SHOTS || ''

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
const DOCUMENT_NUMBERS = Object.keys(DOCUMENTS).sort()

/**
 * Spec 083 D-3's table, as the rail reads on screen, beside the pill count the
 * ticket names (2·0·2·2·0 beside the anchor). The count is a LITERAL rather than
 * `rail.length - 1`: derived from the same array, it could only restate the
 * comparison above it, and the ticket's expectation is the number.
 *
 * Duplicated from `document-rail-drive.mjs` on purpose — the region drive keeps
 * its own copy because it asserts the rail's severities and monospace besides,
 * and the acceptance pass must not depend on another tool having run.
 */
const EXPECTED_RAIL = {
  '2000000551': { rail: ['Last action Prescription Ready', 'Ready', 'Approval Approved'], pills: 2 },
  '8000000121': { rail: ['Last action Rescheduled'], pills: 0 },
  '8000000174': { rail: ['Last action Close Requested', 'Ready', 'Cancellation Close Requested'], pills: 2 },
  '8000000253': { rail: ['Last action Delivered', 'Ready', 'Delivery Delivered'], pills: 2 },
  '9000000003': { rail: ['Last action TRDY'], pills: 0 },
}

/**
 * Neither collection is on the captures — see the header note. `outboxStatus`
 * takes the model's own taxonomy (`'P'` pending, `'F'` failed, `'C'` completed):
 * one failed job means the Jobs tab count reads the FAILURE rather than the
 * total, which is the state an acceptance pass should be looking at.
 */
const LOGS = [
  { logNo: '1', actionTypeDescription: 'Created', entryTime: '2025-03-06T02:46:00', entryUser: 'msartawi', note: '' },
  { logNo: '2', actionTypeDescription: 'Rescheduled', entryTime: '2025-03-06T09:12:00', entryUser: 'msartawi', note: 'Customer asked for the evening slot' },
]
const JOBS = [
  { outboxId: '1', actionTypeDescription: 'Create', outboxStatus: 'C', attemptCount: 1 },
  { outboxId: '2', actionTypeDescription: 'Notify', outboxStatus: 'F', attemptCount: 4, errorMessage: 'Endpoint unreachable' },
]

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  /** How long a mutation takes to answer — raised for assertion 5. */
  let updateDelayMs = 0

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'SdDocumentWeb/UpdateDocument' || p === 'SdDocumentWeb/UpdateDelivery') {
      if (updateDelayMs) await new Promise((r) => setTimeout(r, updateDelayMs))
      return route.fulfill(envelope(true))
    }
    // Ticket 125 put the OMS screens behind SdDocumentWeb/Access; the detail page
    // guards on canOpenDetail, so this drive must answer the probe or every
    // assertion below meets the denied card instead of the screen.
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/Logs$/.test(p)) return route.fulfill(envelope(LOGS))
    if (/\/Outbox$/.test(p)) return route.fulfill(envelope(JOBS))
    return route.fulfill(envelope({}))
  })

  const band = () => page.locator('[aria-label="Document identity"]')
  const rail = () => page.locator('[aria-label="Document status"]')
  const cards = () => page.locator('[aria-label="Document summary"]')
  const bar = () => page.locator('section[aria-label="Actions"]')
  /** Every panel stays mounted and is CSS-hidden (D-23), so scope to the visible one. */
  const grid = () => page.locator('[role="tabpanel"]:not([hidden]) .ag-root-wrapper')

  // 093 put a count badge inside every tab, so a tab's LABEL is its text with the
  // trailing number dropped — `Items 1` is still the Items tab. Declared once and
  // also shipped into the page, so the node side and the browser side of the tab
  // assertions cannot drift apart.
  const TAB_LABEL = (text) => text.replace(/\s*\d+\s*$/, '').trim()
  await page.addInitScript(`window.TAB_LABEL = ${TAB_LABEL.toString()}`)

  const open = async (documentNo) => {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await cards().waitFor()
    await page.waitForTimeout(200)
  }

  // ─────────────────────────────────── 1 · the band's big line is the number ──
  //
  // Not "the number is in the band" — the ticket's claim is that it is the
  // LARGEST thing on the screen, which only a measurement over every other text
  // node can answer.
  for (const documentNo of DOCUMENT_NUMBERS) {
    await open(documentNo)
    const biggest = await page.evaluate(() => {
      let best = null
      for (const el of document.querySelectorAll('body *')) {
        // Leaf text only: a container inherits its child's box, not its size.
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) continue
        if (!el.getClientRects().length) continue
        const size = parseFloat(getComputedStyle(el).fontSize)
        if (!best || size > best.size) best = { size, text: el.innerText.trim() }
      }
      return best
    })
    check(
      `${documentNo}: the document number is the largest text on the screen`,
      biggest?.text === documentNo,
      `${JSON.stringify(biggest?.text)} @${biggest?.size}px`,
    )
    const inBand = await band()
      .locator('span', { hasText: new RegExp(`^${documentNo}$`) })
      .count()
    check(`${documentNo}: and it is the identity band's own line`, inBand === 1, String(inBand))
  }

  // ────────────────────────────────────── 2 · the rail against 090's corpus ──
  for (const documentNo of DOCUMENT_NUMBERS) {
    await open(documentNo)
    const expected = EXPECTED_RAIL[documentNo]
    const read = await rail().locator(String.raw`> span:not([aria-hidden])`).allInnerTexts()
    const entries = read.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
    check(
      `${documentNo}: the pill rail reads exactly D-3's table`,
      JSON.stringify(entries) === JSON.stringify(expected.rail),
      entries.join(' · '),
    )
    // The anchor is always present and never counts as a pill.
    check(
      `${documentNo}: ${expected.pills} pill(s) beside the anchor`,
      entries.length - 1 === expected.pills && entries[0]?.startsWith('Last action'),
      `${Math.max(entries.length - 1, 0)} pills, anchor=${JSON.stringify(entries[0])}`,
    )
  }

  // ───────────────────────── 3 · the four tabs, and what survives a switch ──
  await open('8000000174')
  const TABS = ['Items', 'Header Conditions', 'Log', 'Jobs']
  const tabLabels = (await page.locator('[role="tab"]').allInnerTexts()).map(TAB_LABEL)
  check('the work area carries exactly the four tabs', tabLabels.join(' | ') === TABS.join(' | '), tabLabels.join(' | '))

  for (const label of TABS) {
    await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click()
    await page.waitForTimeout(220)
    const state = await page.evaluate((name) => {
      const tab = [...document.querySelectorAll('[role="tab"]')].find(
        (t) => window.TAB_LABEL(t.innerText) === name,
      )
      const panel = document.getElementById(tab.getAttribute('aria-controls'))
      const others = [...document.querySelectorAll('[role="tabpanel"]')].filter((p) => p !== panel)
      return {
        selected: tab.getAttribute('aria-selected') === 'true',
        shown: !panel.hasAttribute('hidden') && panel.getBoundingClientRect().height > 0,
        // Hidden, but still MOUNTED — that is what makes the survival below possible.
        othersHidden: others.every((p) => p.hasAttribute('hidden')),
        othersMounted: others.every((p) => p.children.length > 0),
      }
    }, label)
    check(
      `the ${label} tab switches to its own panel, the other three stay mounted but hidden`,
      state.selected && state.shown && state.othersHidden && state.othersMounted,
      JSON.stringify(state),
    )
  }

  // The operator's own grid state: widen Description by dragging its resize
  // handle, then sort on it. Both are read back after a full round trip through
  // the other three tabs.
  await page.getByRole('tab', { name: /^Items/ }).click()
  await page.waitForTimeout(220)
  // The floating-filter row carries the same `col-id`, so the header proper is
  // the one that is not a filter cell.
  const header = () =>
    grid().locator('.ag-header-cell[col-id="itemDescription"]:not(.ag-floating-filter)')
  const widthOf = async () => Math.round((await header().boundingBox()).width)
  const sortOf = () => header().getAttribute('aria-sort')

  const startWidth = await widthOf()
  const handle = await header().locator('.ag-header-cell-resize').first().boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(handle.x + handle.width / 2 + 90, handle.y + handle.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(200)
  const widened = await widthOf()
  check(
    'the operator can widen the Description column',
    widened > startWidth + 60,
    `${startWidth}px → ${widened}px`,
  )

  await header().locator('.ag-header-cell-label').click()
  await page.waitForTimeout(200)
  const sorted = await sortOf()
  check('and sort on it', sorted === 'ascending', String(sorted))

  for (const label of ['Header Conditions', 'Log', 'Jobs', 'Items']) {
    await page.getByRole('tab', { name: new RegExp(`^${label}`) }).click()
    await page.waitForTimeout(200)
  }
  const afterWidth = await widthOf()
  const afterSort = await sortOf()
  check(
    'both survive a round trip through every other tab — the grid is hidden, never rebuilt',
    afterWidth === widened && afterSort === sorted,
    `${afterWidth}px / ${afterSort} (was ${widened}px / ${sorted})`,
  )

  // ───────────────────────────────── 4 · the rail unstacks above the work area ──
  const layoutAt = async (width) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForTimeout(220)
    return cards().evaluate((el) => {
      const work = el.parentElement.lastElementChild
      const r = el.getBoundingClientRect()
      const w = work.getBoundingClientRect()
      return {
        railWidth: Math.round(r.width),
        beside: r.right <= w.left + 1 && Math.abs(r.top - w.top) < 4,
        above: r.bottom <= w.top + 1,
        hidden: getComputedStyle(el).display === 'none' || r.height === 0,
      }
    })
  }
  const wide = await layoutAt(1600)
  check(
    'above 900px the summary rail is 340px beside the work area',
    wide.railWidth === 340 && wide.beside,
    JSON.stringify(wide),
  )
  const narrow = await layoutAt(880)
  check(
    'below 900px it unstacks ABOVE the work area — never a drawer, never hidden',
    narrow.above && !narrow.hidden,
    JSON.stringify(narrow),
  )
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.waitForTimeout(180)

  // ────────────────────────── 5 · the terminal pair, the reasons, and busy ──
  //
  // A trimmed read of the bar. `document-actions-drive.mjs` has the full one and
  // owns the grammar; this reads only what the acceptance pass asserts, from the
  // same DOM shape — a labelled column is a cluster, and the buttons in no column
  // are the terminal tier.
  const readBar = () =>
    bar().evaluate((section) => {
      const buttonOf = (el) => ({
        label: el.innerText.replace(/\s+/g, ' ').trim(),
        height: Math.round(el.getBoundingClientRect().height),
        // `right` is the LTR reading of "at the end of the bar". The drive never
        // mirrors — `document-rtl-drive.mjs` is where the logical spelling of
        // this bar is measured.
        right: Math.round(el.getBoundingClientRect().right),
        nativeDisabled: el.disabled === true,
        ariaDisabled: el.getAttribute('aria-disabled') === 'true',
        describedBy: el.getAttribute('aria-describedby'),
      })
      const columns = [...section.querySelectorAll('div.flex-col')]
      const clustered = new Set(columns.flatMap((col) => [...col.querySelectorAll('button')]))
      return {
        cluster: [...clustered].map(buttonOf),
        terminal: [...section.querySelectorAll('button')].filter((b) => !clustered.has(b)).map(buttonOf),
      }
    })

  const idle = await readBar()
  check(
    'the terminal pair is the unlabelled tail of the bar — override then cancel',
    idle.terminal.map((b) => b.label).join(' | ') === 'Force Cancel | Cancel Order',
    idle.terminal.map((b) => b.label).join(' | '),
  )
  check(
    'it renders at the END of the bar, past every cluster button',
    idle.terminal.every((b) => idle.cluster.every((c) => b.right > c.right)),
    `terminal=${idle.terminal.map((b) => b.right)} clusters max=${Math.max(...idle.cluster.map((c) => c.right))}`,
  )
  check(
    'at cluster-button height — a tier, not a commit',
    idle.terminal.every((b) => idle.cluster.every((c) => c.height === b.height)),
    `terminal=${idle.terminal.map((b) => b.height)} clusters=${idle.cluster.map((c) => c.height)}`,
  )

  // The other half of the ticket's framing sentence — "that the action bar's
  // disabled-with-reason states behave". `8000000174` is the capture that carries
  // an open cancellation request, so the gate under test is the document's own
  // state rather than a synthesised one.
  const byLabel = (read, label) =>
    [...read.cluster, ...read.terminal].find((b) => b.label === label)
  const gated = byLabel(idle, 'Request Cancellation')
  check(
    'a command contradicted by the document is disabled but still focusable',
    gated.ariaDisabled === true && gated.nativeDisabled === false && gated.describedBy !== null,
    JSON.stringify(gated),
  )
  // Opacity, not `isVisible()`: the reason is hidden by opacity alone so it stays
  // in the accessibility tree for `aria-describedby`.
  const reason = page.locator('#command-reason-request-close')
  const reasonOpacity = () => reason.evaluate((el) => Number(getComputedStyle(el).opacity))
  check('and its reason is out of the way until asked for', (await reasonOpacity()) === 0)
  await page.getByRole('button', { name: 'Request Cancellation' }).hover()
  await page.waitForTimeout(250)
  const onHover = await reasonOpacity()
  await page.mouse.move(0, 0)
  await page.getByRole('button', { name: 'Request Cancellation' }).focus()
  await page.waitForTimeout(250)
  check(
    'then explains itself on hover AND on keyboard focus',
    onHover === 1 &&
      (await reasonOpacity()) === 1 &&
      (await page
        .getByRole('button', { name: 'Request Cancellation' })
        .evaluate((el) => el === document.activeElement)),
    `hover=${onHover} focus=${await reasonOpacity()} · ${(await reason.innerText()).trim()}`,
  )

  // A slow mutation leaves the bar busy long enough to read it mid-flight.
  updateDelayMs = 2500
  await page.getByRole('button', { name: 'Add Note…' }).click()
  await page.waitForTimeout(200)
  await page.locator('#command-note').fill('acceptance probe')
  await page.getByRole('button', { name: 'Add Note', exact: true }).click()
  await page.waitForTimeout(400)
  const busy = await readBar()
  check(
    'and goes disabled while a command is in flight — with nothing to explain, the spinner reports it',
    busy.terminal.every((b) => b.nativeDisabled && b.describedBy === null),
    JSON.stringify(busy.terminal),
  )
  await page.waitForTimeout(2600)
  updateDelayMs = 0
  const recovered = await readBar()
  check(
    'and takeable again once the command answers',
    recovered.terminal.every((b) => !b.nativeDisabled && !b.ariaDisabled),
    JSON.stringify(recovered.terminal),
  )

  // ─────────────────────────────────────────── the both-theme manual capture ──
  //
  // The drive cannot judge whether the arrangement READS right; it can put the
  // evidence on disk for the pass that can. Every capture in both themes, which
  // is also every collapse the five cards make.
  if (SHOT_DIR) {
    mkdirSync(SHOT_DIR, { recursive: true })
    for (const theme of ['light', 'dark']) {
      // The theme is stored, and `index.html` re-applies it pre-paint on every
      // load — so toggling the class alone would be undone by the next `goto`.
      // Writing the stored choice is what makes it survive the navigation, and
      // it is also how the operator's own choice reaches a fresh tab.
      await page.evaluate(
        (mode) => localStorage.setItem('oms.darkMode', String(mode === 'dark')),
        theme,
      )
      for (const documentNo of DOCUMENT_NUMBERS) {
        await open(documentNo)
        await page.screenshot({ path: path.join(SHOT_DIR, `${documentNo}-${theme}.png`), fullPage: true })
      }
      // The width that forces the cluster group to wrap, and the one that
      // unstacks the rail — the two arrangements the ticket names by hand.
      await page.setViewportSize({ width: 720, height: 1400 })
      await open('8000000174')
      await page.screenshot({ path: path.join(SHOT_DIR, `narrow-${theme}.png`), fullPage: true })
      await page.setViewportSize({ width: 1600, height: 1000 })
      // The items grid's selected row — its accent bar is a `::before` painted
      // from the tokens, so it is one of the few things that can only be judged
      // with the dark theme actually on.
      await open('8000000253')
      await grid().locator('.ag-grid-scrolling-rows .ag-row').first().click()
      await page.waitForTimeout(150)
      await page.screenshot({ path: path.join(SHOT_DIR, `selected-${theme}.png`), fullPage: true })
    }
    await page.evaluate(() => localStorage.removeItem('oms.darkMode'))
    console.log(`\nscreenshots → ${SHOT_DIR}`)
  }

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
