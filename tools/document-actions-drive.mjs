// Action-bar drive (ticket 094, spec 083 D-10/D-11) — drives the REAL app in
// Chromium and serves the five captured payloads from
// `.issues/assets/078-document-payloads/` as the document response, exactly as
// `tools/document-items-drive.mjs` does. The app is not stubbed, only the wire.
//
// Asserts the ticket's Done-when:
//   1. the bar renders as three labelled clusters in order of increasing
//      consequence, each holding exactly two commands, plus an UNLABELLED
//      terminal pair pinned to the end;
//   2. every cluster carries its family colour and the quiet tier carries none;
//   3. the terminal pair is the same height as every cluster button — a tier,
//      not a commit — and Cancel Order wears no check mark;
//   4. all eight commands render on all five documents: nothing is ever hidden;
//   5. `closeStatus === 'R'` disables Request Cancellation WITH a reason on
//      hover and on focus, and leaves Withdraw Request the cluster's only
//      takeable member;
//   6. Return Document reads the server's `canReturn` and states WHICH of three
//      things is wrong — not a delivery, not on the Starlinks bonded rail,
//      nothing left to return — each on hover AND on focus, plus the enabled
//      case (ticket 290, spec 289 D2);
//   7. busy disables everything with NO reason;
//   8. the standing textarea and its label are gone from the page;
//   9. Add Note… is always enabled and its dialog's confirm stays disabled until
//      text is typed;
//  10. the note typed in the Change Store dialog is the note that POSTS.
//
// Two assertions the corpus cannot show verbatim say so at their call sites:
// `canReturn` and `returnedQuantity` are BackOffice spec 1283 §2b additions no
// capture carries, so the enabled case and the exhausted case are synthesised
// from a real payload — the mutation is the fixture, the rule under test is the
// app's. The captures untouched are the fail-closed proof: absent `canReturn`
// disables Return Document on all five.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/document-actions-drive.mjs
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
const DOCUMENT_NUMBERS = Object.keys(DOCUMENTS).sort()

/** Two stores for the Change Store picker — `8000000253` is pick-in-store (`P`). */
const STORE_DETAILS = [
  { storeCode: 'P001', city: 'Riyadh', region: 'Central', storeAddress: 'King Fahd Rd', deliveryStore: true },
  { storeCode: 'P002', city: 'Jeddah', region: 'West', storeAddress: 'Tahlia St', deliveryStore: false },
]

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  /** Every mutation the app posted, newest last — assertion 10's evidence. */
  const posted = []

  /**
   * How long a mutation takes to answer. Set to a few seconds late in the run so
   * the bar can be read WHILE a command is in flight — that is assertion 7's
   * whole subject, and it is the only thing that differs between the two wires.
   */
  let updateDelayMs = 0

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'SdDocumentWeb/UpdateDocument' || p === 'SdDocumentWeb/UpdateDelivery') {
      posted.push({ path: p, body: JSON.parse(route.request().postData() || '{}') })
      if (updateDelayMs) await new Promise((r) => setTimeout(r, updateDelayMs))
      return route.fulfill(envelope(true))
    }
    if (p === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORE_DETAILS))
    if (p === 'SdDocument/Districts') return route.fulfill(envelope([]))
    // Ticket 125 put the OMS screens behind SdDocumentWeb/Access; the detail page
    // guards on canOpenDetail, so this drive must answer the probe or every
    // assertion below meets the denied card instead of the screen.
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/Outbox$/.test(p) || /\/Logs$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const bar = () => page.locator('section[aria-label="Actions"]')
  const open = async (documentNo) => {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await bar().waitFor()
    await page.waitForTimeout(150)
  }
  /**
   * The same screen through the DELIVERY route.
   *
   * Return Document's first reason is read off the route, not off
   * `documentCategory` — so *Open the delivery to return it.* is the honest
   * answer on `/oms/document/*` and the other two causes are only reachable
   * from here, which is where an operator returns from.
   */
  const openDelivery = async (deliveryNo) => {
    await page.goto(`${BASE}/oms/delivery/${deliveryNo}`)
    await bar().waitFor()
    await page.waitForTimeout(150)
  }

  /** A token's value as the browser resolves it, in `rgb(…)` form. */
  const token = (name) =>
    page.evaluate((varName) => {
      const probe = document.createElement('span')
      probe.style.color = `var(${varName})`
      document.body.append(probe)
      const value = getComputedStyle(probe).color
      probe.remove()
      return value
    }, name)

  /** The whole bar as data: clusters in DOM order, then the unlabelled tail. */
  const readBar = () =>
    bar().evaluate((section) => {
      const buttonOf = (el) => {
        const style = getComputedStyle(el)
        const box = el.getBoundingClientRect()
        return {
          label: el.innerText.replace(/\s+/g, ' ').trim(),
          ground: style.backgroundColor,
          ink: style.color,
          borderColour: style.borderTopColor,
          height: Math.round(box.height),
          right: Math.round(box.right),
          top: Math.round(box.top),
          nativeDisabled: el.disabled === true,
          ariaDisabled: el.getAttribute('aria-disabled') === 'true',
          describedBy: el.getAttribute('aria-describedby'),
          icons: [...el.querySelectorAll('svg')].map((s) => s.getAttribute('class') || ''),
        }
      }
      // A cluster is a labelled column; the terminal tier is the only button
      // group in the bar with no label above it.
      const columns = [...section.querySelectorAll('div.flex-col')]
      const clusters = columns.map((col) => ({
        // `textContent`, not `innerText`: the cluster label is uppercased by
        // CSS, and the assertion is about the STRING the app renders, not about
        // the case the stylesheet paints it in.
        label: col.querySelector('span')?.textContent.trim() ?? '',
        commands: [...col.querySelectorAll('button')].map(buttonOf),
      }))
      const clustered = new Set(columns.flatMap((col) => [...col.querySelectorAll('button')]))
      const terminal = [...section.querySelectorAll('button')]
        .filter((b) => !clustered.has(b))
        .map(buttonOf)
      return { clusters, terminal }
    })

  // ---------------------------------------------------------------- 1 · grammar
  await open('8000000253')
  const layout = await readBar()
  check(
    'the bar reads as three labelled clusters in order of increasing consequence',
    layout.clusters.map((c) => c.label).join(' | ') ===
      'Fulfilment | Cancellation request | Notes & docs',
    layout.clusters.map((c) => c.label).join(' | '),
  )
  check(
    'each cluster holds exactly two commands, so the single-label case never arises',
    layout.clusters.every((c) => c.commands.length === 2),
    layout.clusters.map((c) => c.commands.length).join(','),
  )
  check(
    'and the commands read in the order the taxonomy fixed',
    layout.clusters.flatMap((c) => c.commands.map((b) => b.label)).join(' | ') ===
      'Reschedule | Change Store | Request Cancellation | Withdraw Request | Add Note… | Return Document',
    layout.clusters.flatMap((c) => c.commands.map((b) => b.label)).join(' | '),
  )
  check(
    'the terminal pair sits outside every cluster, unlabelled, override then cancel',
    layout.terminal.map((b) => b.label).join(' | ') === 'Force Cancel | Cancel Order',
    layout.terminal.map((b) => b.label).join(' | '),
  )
  check(
    'and is pinned to the END of the bar — past every cluster button',
    layout.terminal.every((b) =>
      layout.clusters.flatMap((c) => c.commands).every((x) => b.right > x.right),
    ),
    `terminal right=${layout.terminal.map((b) => b.right)} clusters max=${Math.max(
      ...layout.clusters.flatMap((c) => c.commands.map((x) => x.right)),
    )}`,
  )

  // ------------------------------------------------------ 2 · colour per family
  const famFulfilment = await token('--fam-fulfilment')
  const famCancelRequest = await token('--fam-cancel-request')
  const danger = await token('--danger')
  const dangerInk = await token('--danger-800')
  const [fulfilment, cancelRequest, notes] = layout.clusters
  check(
    'the fulfilment cluster is filled with --fam-fulfilment',
    fulfilment.commands.every((b) => b.ground === famFulfilment),
    fulfilment.commands.map((b) => b.ground).join(' '),
  )
  check(
    'the cancellation-request cluster is filled with --fam-cancel-request — indigo, not red',
    cancelRequest.commands.every((b) => b.ground === famCancelRequest) &&
      famCancelRequest !== danger,
    cancelRequest.commands.map((b) => b.ground).join(' '),
  )
  check(
    'the quiet tier carries no family colour at all',
    notes.commands.every((b) => b.ground === 'rgba(0, 0, 0, 0)'),
    notes.commands.map((b) => b.ground).join(' '),
  )
  const [forceCancel, cancelOrder] = layout.terminal
  check(
    'Cancel Order is the filled red — the sanctioned cancel',
    cancelOrder.ground === danger,
    cancelOrder.ground,
  )
  check(
    'Force Cancel beside it is the OUTLINED red, separated by weight rather than a second red',
    forceCancel.ground === 'rgba(0, 0, 0, 0)' && forceCancel.ink === dangerInk,
    `${forceCancel.ground} / ${forceCancel.ink}`,
  )

  // ------------------------------------------ 3 · a tier, not a commit; no check
  const clusterHeights = layout.clusters.flatMap((c) => c.commands.map((b) => b.height))
  check(
    'the terminal pair is the SAME height as every cluster button — never enlarged',
    layout.terminal.every((b) => clusterHeights.every((h) => h === b.height)),
    `terminal=${layout.terminal.map((b) => b.height)} clusters=${clusterHeights}`,
  )
  const checkMark = await bar().evaluate((section) =>
    [...section.querySelectorAll('button')].some((b) =>
      [...b.querySelectorAll('svg')].some((s) => /check/i.test(s.getAttribute('class') || '')),
    ),
  )
  check('no command on the bar wears a check mark — nothing here is a happy ending', !checkMark)

  // -------------------------------------------------- 8 · the textarea is gone
  const textareas = await page.locator('section[aria-label="Actions"] textarea').count()
  check('the standing note textarea is gone from the action bar', textareas === 0, String(textareas))

  // ------------------------------------------------- 4 · nothing is ever hidden
  const EIGHT = [
    'Reschedule',
    'Change Store',
    'Request Cancellation',
    'Withdraw Request',
    'Add Note…',
    'Return Document',
    'Force Cancel',
    'Cancel Order',
  ].sort()
  let allEight = true
  for (const documentNo of DOCUMENT_NUMBERS) {
    await open(documentNo)
    const shown = await bar().evaluate((s) =>
      [...s.querySelectorAll('button')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()).sort(),
    )
    if (shown.join('|') !== EIGHT.join('|')) allEight = false
  }
  check('all eight commands render on all five captured documents', allEight)

  // ------------------------------------ 5 · the open-cancellation-request gate
  await open('8000000174')
  const requested = await readBar()
  const byLabel = (b, label) =>
    [...b.clusters.flatMap((c) => c.commands), ...b.terminal].find((x) => x.label === label)
  const requestCancellation = byLabel(requested, 'Request Cancellation')
  const withdraw = byLabel(requested, 'Withdraw Request')
  check(
    'with a cancellation request already open, Request Cancellation is disabled',
    requestCancellation.ariaDisabled === true,
    JSON.stringify({ aria: requestCancellation.ariaDisabled, native: requestCancellation.nativeDisabled }),
  )
  check(
    'and stays focusable, so it can state its reason on FOCUS as well as on hover',
    requestCancellation.nativeDisabled === false && requestCancellation.describedBy !== null,
    requestCancellation.describedBy,
  )
  const reasonText = await page.locator('#command-reason-request-close').innerText()
  check(
    'the reason names the contradiction the live data proves',
    reasonText.trim() === 'A cancellation request is already open for this document.',
    reasonText.trim(),
  )
  // Opacity, not `isVisible()`: the reason is hidden by opacity alone so that it
  // stays in the accessibility tree for `aria-describedby`, which means
  // Playwright would call it "visible" at rest.
  const reasonOpacity = () =>
    page
      .locator('#command-reason-request-close')
      .evaluate((el) => Number(getComputedStyle(el).opacity))
  check('the reason is out of the way until asked for', (await reasonOpacity()) === 0)
  await page.getByRole('button', { name: 'Request Cancellation' }).hover()
  await page.waitForTimeout(250)
  check('it appears on hover', (await reasonOpacity()) === 1)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(250)
  check('and retreats again', (await reasonOpacity()) === 0)
  await page.getByRole('button', { name: 'Request Cancellation' }).focus()
  await page.waitForTimeout(250)
  check('and appears on keyboard focus too — a disabled command must still be reachable', (await reasonOpacity()) === 1)
  check(
    'which it is, because it carries aria-disabled rather than the disabled attribute',
    await page
      .getByRole('button', { name: 'Request Cancellation' })
      .evaluate((el) => el === document.activeElement),
  )
  check(
    'while Withdraw Request stays takeable — the cluster promotes by SUBTRACTION',
    withdraw.ariaDisabled === false && withdraw.nativeDisabled === false,
    JSON.stringify(withdraw),
  )
  check(
    'and nothing grows, moves or changes colour to say so',
    withdraw.ground === famCancelRequest && withdraw.height === requestCancellation.height,
    `${withdraw.ground} h=${withdraw.height} vs h=${requestCancellation.height}`,
  )

  // ------------------------------------------ 6 · the three Return Document reasons
  // `canReturn` is absent on every capture, and absent must read as NOT
  // returnable — this is the fail-closed half of the gate, at no cost.
  let returnGated = true
  for (const documentNo of DOCUMENT_NUMBERS) {
    await open(documentNo)
    const b = byLabel(await readBar(), 'Return Document')
    if (!b.ariaDisabled) returnGated = false
  }
  check(
    'Return Document is disabled on every captured document — none carries canReturn',
    returnGated,
  )

  const returnReason = page.locator('#command-reason-return-document')
  const returnOpacity = () => returnReason.evaluate((el) => Number(getComputedStyle(el).opacity))
  /** Read the reason the way an operator does: on hover, then on keyboard focus. */
  const readReturnReason = async (what) => {
    const button = page.getByRole('button', { name: 'Return Document' })
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)
    const atRest = await returnOpacity()
    await button.hover()
    await page.waitForTimeout(250)
    const onHover = await returnOpacity()
    const text = (await returnReason.innerText()).trim()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(250)
    await button.focus()
    await page.waitForTimeout(250)
    const onFocus = await returnOpacity()
    check(
      `the ${what} reason is out of the way until asked for, then appears on hover AND on focus`,
      atRest === 0 && onHover === 1 && onFocus === 1,
      `rest=${atRest} hover=${onHover} focus=${onFocus}`,
    )
    return text
  }

  // (a) not a delivery — `2000000551` is the eRx capture, `documentCategory: 'X'`.
  await open('2000000551')
  check(
    'an order says which document to open instead of naming the rule',
    (await readReturnReason('not-a-delivery')) === 'Open the delivery to return it.',
  )

  // (b) not on the rail — a delivery with lines still remaining and no
  // `canReturn`, reached through the DELIVERY route: on the document route the
  // honest reason is the one above, and it would mask this one.
  await openDelivery('8000000253')
  check(
    'a delivery the server will not take a return against names the rail',
    (await readReturnReason('wrong-store')) ===
      'Only bonded deliveries handled by Starlinks can be returned here.',
  )

  // (c) nothing left — same `canReturn`, every line already fully returned. The
  // screen splits the server's ONE false into these two causes off the line
  // projection; the split is a reason string and never an eligibility decision.
  const original = DOCUMENTS['8000000253']
  DOCUMENTS['8000000253'] = {
    ...original,
    lines: original.lines.map((line) => ({ ...line, returnedQuantity: line.quantity })),
  }
  await openDelivery('8000000253')
  check(
    'and an exhausted delivery says THAT instead, off the same false',
    (await readReturnReason('exhausted')) ===
      'Everything on this delivery has already been returned.',
  )

  // (c2) the document this rule exists for: `9000000003` is opened AS a delivery
  // and carries `documentCategory: 'T'`. Keyed off the category, its reason was
  // *Open the delivery to return it.* — about the delivery already on screen.
  await openDelivery('9000000003')
  const categoryT = await readReturnReason('delivery-return category')
  check(
    'a T-category delivery never tells the operator to open the delivery they are looking at',
    categoryT !== 'Open the delivery to return it.' &&
      categoryT === 'Only bonded deliveries handled by Starlinks can be returned here.',
    categoryT,
  )

  // (d) the enabled case — `canReturn: true`, and nothing else changed.
  DOCUMENTS['8000000253'] = { ...original, canReturn: true }
  await open('8000000253')
  const takeable = byLabel(await readBar(), 'Return Document')
  check(
    'canReturn: true enables it, with no reason attached',
    takeable.ariaDisabled === false &&
      takeable.nativeDisabled === false &&
      takeable.describedBy === null,
    JSON.stringify(takeable),
  )
  // (e) disabled follows `canReturn` ALONE — an exhausted projection the server
  // nonetheless says yes to stays takeable.
  DOCUMENTS['8000000253'] = {
    ...original,
    canReturn: true,
    lines: original.lines.map((line) => ({ ...line, returnedQuantity: line.quantity })),
  }
  await open('8000000253')
  check(
    'and stays enabled even where the DERIVED reason would have said exhausted',
    byLabel(await readBar(), 'Return Document').ariaDisabled === false,
  )
  DOCUMENTS['8000000253'] = original

  // -------------------------------------------------- 9 · Add Note… and its rule
  await open('8000000253')
  const addNote = byLabel(await readBar(), 'Add Note…')
  check(
    'Add Note… is always enabled — its emptiness rule moved into its dialog',
    addNote.ariaDisabled === false && addNote.nativeDisabled === false,
    JSON.stringify(addNote),
  )
  await page.getByRole('button', { name: 'Add Note…' }).click()
  await page.waitForTimeout(200)
  const confirmAdd = page.getByRole('button', { name: 'Add Note', exact: true })
  check(
    'its dialog opens with the confirm disabled — an empty note is meaningless in a log',
    await confirmAdd.isDisabled(),
  )
  await page.locator('#command-note').fill('Customer called about the address')
  await page.waitForTimeout(80)
  check('and enables it the moment text is typed', !(await confirmAdd.isDisabled()))
  await confirmAdd.click()
  await page.waitForTimeout(300)
  const notePost = posted.at(-1)
  check(
    'the note typed in the dialog is the note that posts, on the category’s own endpoint',
    notePost?.path === 'SdDocumentWeb/UpdateDelivery' &&
      notePost?.body.actionType === 'DADN' &&
      notePost?.body.note === 'Customer called about the address',
    JSON.stringify(notePost),
  )

  // ------------------------------- 10 · the Change Store note is the one that posts
  await open('8000000253')
  await page.getByRole('button', { name: 'Change Store' }).click()
  await page.waitForTimeout(400)
  // A real mouse click at the row's own coordinates. Inside a `<dialog>` the
  // grid's scrolling container wins Playwright's hit test on a locator click, so
  // the click is issued positionally instead — the "commit unblocks" assertion
  // below is what proves it actually selected a row.
  // Scoped to the open `<dialog>`: the page's own items grid is still mounted
  // behind the modal, and an unscoped `.ag-row` picks IT.
  const rowBox = await page
    .locator('dialog[open] .ag-grid-scrolling-rows .ag-row')
    .first()
    .boundingBox()
  await page.mouse.click(rowBox.x + 40, rowBox.y + rowBox.height / 2)
  await page.waitForTimeout(150)
  await page.locator('#change-store-note').fill('Moved to the Riyadh branch')
  await page.waitForTimeout(80)
  const commitStore = page.locator('dialog[open]').getByRole('button', { name: 'Change Store' })
  check('picking a row unblocks the Change Store commit', !(await commitStore.isDisabled()))
  await commitStore.click()
  await page.waitForTimeout(400)
  const storePost = posted.at(-1)
  check(
    'the note typed in the Change Store dialog is the one that posts, beside the new store',
    storePost?.body.actionType === 'DCST' &&
      storePost?.body.note === 'Moved to the Riyadh branch' &&
      storePost?.body.actionData === 'P001',
    JSON.stringify(storePost),
  )

  // --------------------------------------------------- 7 · busy explains nothing
  // A slow update leaves the bar busy long enough to read it mid-flight.
  updateDelayMs = 2500
  await open('8000000174')
  await page.getByRole('button', { name: 'Add Note…' }).click()
  await page.waitForTimeout(200)
  await page.locator('#command-note').fill('busy probe')
  await page.getByRole('button', { name: 'Add Note', exact: true }).click()
  await page.waitForTimeout(400)
  const busy = await readBar()
  const busyCommands = [...busy.clusters.flatMap((c) => c.commands), ...busy.terminal]
  check(
    'while a command is in flight every command is disabled',
    busyCommands.every((b) => b.nativeDisabled || b.ariaDisabled),
    busyCommands.filter((b) => !b.nativeDisabled && !b.ariaDisabled).map((b) => b.label).join(','),
  )
  check(
    'and NONE of them explains itself — the spinner already reports it',
    busyCommands.every((b) => b.describedBy === null),
    busyCommands.filter((b) => b.describedBy).map((b) => b.label).join(','),
  )
  await page.waitForTimeout(2600)

  // ------------------------------------------------- 1b · the bar wraps, tail last
  await page.setViewportSize({ width: 720, height: 1000 })
  await page.waitForTimeout(200)
  const narrow = await readBar()
  const clusterRows = new Set(narrow.clusters.flatMap((c) => c.commands.map((b) => b.top)))
  check(
    'below the width where three clusters fit, the cluster group WRAPS rather than hiding anything',
    clusterRows.size > 1,
    `${clusterRows.size} rows`,
  )
  check(
    'and the terminal pair is still last, still the same height, still eight commands',
    narrow.terminal.map((b) => b.label).join(' | ') === 'Force Cancel | Cancel Order' &&
      narrow.terminal.every((b) => b.height === narrow.clusters[0].commands[0].height) &&
      narrow.clusters.flatMap((c) => c.commands).length + narrow.terminal.length === 8,
    JSON.stringify(narrow.terminal.map((b) => [b.label, b.height, b.top])),
  )

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
