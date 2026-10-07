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
//   1. the header's number IS the document number — and the largest text on
//      the page — on all five captures;
//   2. the header's now-step badge reads each capture's step (ticket 402
//      retired 090's pill rail; the badge is what says where it is now, from
//      the shared timeline derivation);
//   3. there are no tabs (ticket 404): Items is always shown, Pricing conditions
//      is a disclosure that opens to its grid, and a column width and a sort the
//      operator set on the Items grid SURVIVE the conditions opening and folding;
//   4. the facts column sits beside the spine from 1280px, and stacks under it
//      below — never a drawer, never hidden;
//   5. the terminal pair renders at the END of the bar, at cluster-button
//      height, and goes disabled while a command is in flight.
//
// Two collections the captures do not carry — Log and Jobs — are synthesised
// from plausible rows so the spine has something to draw; the rows are
// fixtures. `tools/document-spine-drive.mjs` is what asserts the spine.
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
 * Each capture's now-step, as the header's badge reads it (spec 380 D1/D2, ticket 402):
 * `header.test.ts` asserts the same table against the payloads; this asserts it reached
 * the DOM. Duplicated from `document-header-drive.mjs` on purpose — the acceptance pass
 * must not depend on another tool having run.
 */
const EXPECTED_NOW = {
  '2000000551': 'Ready',
  '8000000121': 'Created',
  '8000000174': 'Cancellation requested',
  '8000000253': 'Delivered',
  '9000000003': 'Created',
}

/**
 * Neither collection is on the captures — see the header note. `outboxStatus`
 * takes the model's own taxonomy (`'P'` pending, `'F'` failed, `'C'` completed):
 * one failed job means the spine opens on a failure banner, which is the state
 * an acceptance pass should be looking at.
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
    if (/\/DonorRequests$/.test(p)) return route.fulfill(envelope([]))
    if (/\/Logs$/.test(p)) return route.fulfill(envelope(LOGS))
    if (/\/Outbox$/.test(p)) return route.fulfill(envelope(JOBS))
    return route.fulfill(envelope({}))
  })

  const docHeader = () => page.locator('[aria-label="Document identity"]')
  const cards = () => page.locator('[aria-label="Document facts"]')
  const bar = () => page.locator('section[aria-label="Actions"]')
  const grid = () => page.locator('#doc-items .ag-root-wrapper')

  const open = async (documentNo) => {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await cards().waitFor()
    await page.waitForTimeout(200)
  }

  // ─────────────────────────────────── 1 · the header's number is the number ──
  //
  // Not "the number is in the header" — the ticket's claim is that it is the
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
    const inHeader = await docHeader()
      .locator('span', { hasText: new RegExp(`^${documentNo}$`) })
      .count()
    check(`${documentNo}: and it is the header's own line`, inHeader === 1, String(inHeader))
  }

  // ──────────────────────────────────── 2 · the now-step badge per capture ──
  for (const documentNo of DOCUMENT_NUMBERS) {
    await open(documentNo)
    const word = ((await docHeader().locator('[data-now-step]').innerText()) ?? '').replace(/\s+/g, ' ').trim()
    check(`${documentNo}: the now-step badge reads ${EXPECTED_NOW[documentNo]}`, word === EXPECTED_NOW[documentNo], word)
    check(`${documentNo}: and the pill rail is gone`, (await page.locator('[aria-label="Document status"]').count()) === 0)
  }

  // ───── 3 · no tabs: Items always shown, conditions a disclosure (ticket 404) ──
  await open('8000000174')
  const sections = await page.evaluate(() => ({
    tabs: document.querySelectorAll('[role="tab"], [role="tabpanel"]').length,
    items: document.querySelector('#doc-items')?.getBoundingClientRect().height ?? 0,
    conditions: document.querySelector('#doc-conditions')?.tagName ?? null,
    folded: document.querySelector('#doc-conditions')?.open === false,
  }))
  check(
    'no tabs: Items is shown, Pricing conditions is a folded disclosure',
    sections.tabs === 0 && sections.items > 0 && sections.conditions === 'DETAILS' && sections.folded,
    JSON.stringify(sections),
  )
  await page.locator('#doc-conditions > summary').click()
  await page.locator('#doc-conditions .ag-row').first().waitFor()
  check('the disclosure opens to its grid', await page.locator('#doc-conditions .ag-root-wrapper').isVisible())

  // The operator's own grid state: widen Description by dragging its resize
  // handle, then sort on it. Both are read back after a round trip through
  // conditions folding and opening again.
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

  for (let i = 0; i < 2; i++) {
    await page.locator('#doc-conditions > summary').click()
    await page.waitForTimeout(200)
  }
  const afterWidth = await widthOf()
  const afterSort = await sortOf()
  check(
    'both survive the conditions folding and opening — the items grid is never rebuilt',
    afterWidth === widened && afterSort === sorted,
    `${afterWidth}px / ${afterSort} (was ${widened}px / ${sorted})`,
  )

  // ─────────────────── 4 · the facts column beside the spine, or under it ──
  const layoutAt = async (width) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.waitForTimeout(220)
    return cards().evaluate((el) => {
      const column = el.parentElement.getBoundingClientRect()
      const spine = document.querySelector('[data-spine]').getBoundingClientRect()
      return {
        beside: spine.right <= column.left + 1 && Math.abs(spine.top - column.top) < 4,
        under: spine.bottom <= column.top + 1,
        hidden: getComputedStyle(el).display === 'none' || column.height === 0,
        rail340: Math.round(el.getBoundingClientRect().width) === 340,
      }
    })
  }
  const wide = await layoutAt(1600)
  check('from 1280px the facts column sits beside the spine, and no 340px rail', wide.beside && !wide.rail340, JSON.stringify(wide))
  const narrow = await layoutAt(880)
  check(
    'below 1280px it stacks under the spine — never a drawer, never hidden',
    narrow.under && !narrow.hidden,
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
  // Add Note… focuses the spine's composer (ticket 405), which posts it.
  await page.getByRole('button', { name: 'Add Note…' }).click()
  await page.waitForTimeout(200)
  await page.locator('#note-composer').fill('acceptance probe')
  await page.locator('[data-composer-post]').click()
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
