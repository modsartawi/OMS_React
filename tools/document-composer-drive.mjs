// Note composer + Delivery details keys drive (ticket 405, spec 380 D8, D10; rulings 371 "Notes",
// 365 §6). Drives the REAL app in Chromium, light, dark and RTL; only the wire is stubbed: the
// captured payloads in `.issues/assets/078-document-payloads/` answer the record, the Log is a
// per-run store the stubbed add-note post appends to, and the list answers two stub rows.
//
// Asserts, in each theme/direction:
//   1. the composer sits on the spine's Now line, empty, its Post disabled; the bar's Reschedule,
//      Request Cancellation and Add Note… carry R / C / N (`aria-keyshortcuts`, "Label (R)");
//   2. Add Note… focuses the composer (no dialog), and so does N from the page — typing nothing;
//   3. Ctrl+Enter on an empty composer posts nothing;
//   4. Ctrl+Enter posts today's add-note body on the category's own endpoint, the box empties,
//      and the note joins the spine as the newest note row, below the Now line;
//   5. Esc with unsent text: the first Esc only blurs the box; the second toasts the refusal and
//      the page stays, text intact;
//   6. a failed post (a `success:false` business envelope) shows inline under the box, with its
//      message and code, keeps the text, and raises no toast;
//   6b. while a note posts the box is read-only and Esc is still refused; a post that answers
//      after a palette jump to another record leaves that record's page alone, and its failure
//      is toasted naming the record it was for;
//   7. R and C open Reschedule and Request Cancellation; Esc closes the dialog and stays on the
//      page; C where a request is already open opens nothing and toasts the button's reason;
//   8. `?` opens the help sheet listing R, C, N and Esc on this screen;
//   9. Esc on a pasted link goes to the list route;
//  10. from the list (a criterion set, the second row current): Enter opens Details, N then
//      Esc-Esc goes back with history-back, the query token and the current row restored;
//  11. N on a list row lands on Details with the composer focused and no dialog;
//  12. the document route: no letter keys (and no dev refusal), Add Note… still focuses the box;
//  13. RTL: Post sits at the inline end (left), the Ctrl Enter hint reads in order.
// No page errors anywhere (the key registry's dev refusals are console errors, so a refused key
// would fail this too).
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/document-composer-drive.mjs
//
// Screenshots → tools/.document-composer-shots/ (gitignored).
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.document-composer-shots'
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

/** A list row for the two captured deliveries. */
const ROW = (over) => ({
  deliveryNo: '8000000253',
  documentNo: '1000000777',
  deliveryDocumentType: 'Forward',
  orderNo: '900777',
  storeCode: '1017',
  documentDate: '2026-10-02T00:00:00',
  deliveryType: 'Delivery  ',
  documentType: 'CLCN',
  documentSource: 'Web',
  entryTime: '2026-10-02T14:42:00',
  isActiveInStore: true,
  timeSlotDescription: '10:00 - 12:00',
  timeSlotDay: 'Today',
  deliveryScheduleFromTime: '2026-10-02T10:00:00',
  deliveryScheduleToTime: '2026-10-02T12:00:00',
  customerName: 'Noura Al-Harbi',
  customerPhone: '0510008238',
  rescheduled: false,
  netTotal: 475.22,
  paidAmount: 475.22,
  deliveryFees: 25,
  amountDue: 0,
  readyStatus: '',
  clearStatus: '',
  deliveryStatus: '',
  closeStatus: '',
  failedJobsCount: 0,
  ...over,
})
const LIST = [
  ROW({}),
  ROW({ deliveryNo: '8000000174', documentNo: '1000000778', orderNo: '900778', readyStatus: 'R', closeStatus: 'R' }),
]

const REQUEST_OPEN = 'A cancellation request is already open for this document.'
const UNSENT = "Your note isn't posted yet. Post it or clear it before going back."
const REJECTED = 'Notes are closed on this document.'
const REJECTED_CODE = 'NOTE_CLOSED'

/** One wire per run: its Log grows with every accepted add-note post. */
function wire() {
  const logs = {}
  const posted = []
  const state = { failNext: false, delayMs: 0 }
  const routeApi = async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1017' }))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true }))
    if (p === 'SdDocumentWeb/DeliveryDocumentList') return route.fulfill(envelope(LIST))
    if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes|Districts)$/.test(p))
      return route.fulfill(envelope([]))
    if (p === 'SdDocumentWeb/UpdateDocument' || p === 'SdDocumentWeb/UpdateDelivery') {
      const body = JSON.parse(route.request().postData() || '{}')
      posted.push({ path: p, body })
      if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs))
      if (state.failNext) {
        state.failNext = false
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: REJECTED,
            errors: [{ errorCode: REJECTED_CODE, errorMessage: REJECTED }],
          }),
        )
      }
      const rows = (logs[body.documentNo] ??= [])
      rows.push({
        logNo: String(900 + rows.length),
        documentNo: body.documentNo,
        entryTime: new Date().toISOString().slice(0, 19),
        entryUser: 'msartawi',
        actionType: body.actionType,
        actionTypeDescription: 'Add Note',
        actionData: '',
        actionOldData: '',
        note: body.note,
        staffId: '',
        storeCode: '1017',
      })
      return route.fulfill(envelope(true))
    }
    const logsOf = p.match(/^SdDocumentWeb\/Document\/(\d+)\/Logs$/)
    if (logsOf) return route.fulfill(envelope(logs[logsOf[1]] ?? []))
    if (/\/(Outbox|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (p.startsWith('Slots/AvailableSlots/')) return route.fulfill(envelope({ slots: [] }))
    if (p === 'Slots/RescheduleReasons') return route.fulfill(envelope([]))
    if (p === 'SdDocument/StoreDetails') return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  }
  return { routeApi, posted, state }
}

const bar = (page) => page.locator('section[aria-label="Actions"]')

async function openDetails(page, route) {
  await page.goto(`${BASE}${route}`)
  await bar(page).waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
}

/** Focus on nothing in particular: the page's body. */
async function blurAll(page) {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await page.waitForTimeout(80)
}

/** What the page shows right now. */
const read = (page) =>
  page.evaluate(() => {
    const box = document.getElementById('note-composer')
    const form = box?.closest('form')
    const post = form?.querySelector('[data-composer-post]')
    const now = document.querySelector('[data-now-line]')
    const past = [...document.querySelectorAll('[data-spine] ol')].at(-1)
    const firstPast = past?.querySelector('li')
    const dialog = document.querySelector('dialog[open]')
    return {
      url: location.pathname,
      idx: window.history.state?.idx ?? null,
      onNowLine: !!(now && box && now.contains(box)),
      composer: form?.getAttribute('data-composer') ?? null,
      value: box?.value ?? null,
      readOnly: box?.readOnly ?? null,
      focused: document.activeElement === box,
      postDisabled: post ? post.disabled : null,
      postTitle: post?.getAttribute('title') ?? null,
      postKeys: post?.getAttribute('aria-keyshortcuts') ?? null,
      boxKeys: box?.getAttribute('aria-keyshortcuts') ?? null,
      dialog: dialog ? (dialog.querySelector('#modal-title')?.textContent.trim() ?? 'dialog') : null,
      notes: [...document.querySelectorAll('[data-entry="note"]')].map((li) => li.textContent.trim()),
      firstPast: firstPast?.getAttribute('data-entry') ?? null,
      firstPastText: firstPast?.textContent.trim() ?? null,
      failure: document.querySelector('[data-composer-failure]')?.textContent.trim() ?? null,
      failureCode: document.querySelector('[data-composer-code] bdi[dir="ltr"]')?.textContent.trim() ?? null,
      toasts: [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.textContent.trim()),
      sheet: [...document.querySelectorAll('[data-shortcuts-sheet] [data-shortcut^="screen:"]')].map((l) =>
        l.textContent.replace(/\s+/g, ' ').trim(),
      ),
    }
  })

const buttonKeys = (page) =>
  page.evaluate(() =>
    ['reschedule', 'request-close', 'add-note'].map((kind) => {
      const b = document.querySelector(`[data-command="${kind}"]`)
      return [kind, b?.getAttribute('aria-keyshortcuts') ?? null, b?.getAttribute('title') ?? null]
    }),
  )

/** Closes every toast through its own close button — never by removing sonner's nodes from under React. */
async function dismissToasts(page) {
  for (const close of await page.locator('[data-sonner-toast] [data-close-button]').all()) await close.click().catch(() => {})
  await page.waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 0, null, { timeout: 3000 }).catch(() => {})
}

async function drive({ theme, dir }) {
  const label = `${theme}/${dir}`
  const rtl = dir === 'rtl'
  const { routeApi, posted, state } = wire()
  const context = await chromium.launch().then((b) => b.newContext({ viewport: { width: 1440, height: 1000 } }))
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // The refused post (6) answers 400 on purpose; the browser logs that one resource failure.
  const provoked = /Failed to load resource: the server responded with a status of 400/
  page.on('console', (m) => m.type() === 'error' && !provoked.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )
  await page.route('**/api/**', routeApi)

  // ------------------------------------------------------------ 1 · the composer at rest
  await openDetails(page, '/oms/delivery/8000000253')
  const rest = await read(page)
  const keysOnBar = await buttonKeys(page)
  check(
    `${label}: the composer sits on the Now line, empty, and cannot post`,
    rest.onNowLine && rest.composer === 'empty' && rest.value === '' && rest.postDisabled === true,
    JSON.stringify(rest),
  )
  check(
    `${label}: the bar's Reschedule, Request Cancellation and Add Note… carry R, C and N`,
    JSON.stringify(keysOnBar) ===
      JSON.stringify([
        ['reschedule', 'R', 'Reschedule (\u2068R\u2069)'],
        ['request-close', 'C', 'Request Cancellation (\u2068C\u2069)'],
        ['add-note', 'N', 'Add Note… (\u2068N\u2069)'],
      ]) && rest.boxKeys === 'N' && rest.postKeys === 'Control+Enter',
    JSON.stringify({ keysOnBar, box: rest.boxKeys, post: rest.postKeys }),
  )

  // ----------------------------------------------- 2 · Add Note… and N focus the composer
  await page.locator('[data-command="add-note"]').click()
  await page.waitForTimeout(150)
  const viaButton = await read(page)
  await blurAll(page)
  await page.keyboard.press('n')
  await page.waitForTimeout(150)
  const viaN = await read(page)
  check(
    `${label}: Add Note… focuses the composer and opens no dialog`,
    viaButton.focused && viaButton.dialog === null,
    JSON.stringify({ focused: viaButton.focused, dialog: viaButton.dialog }),
  )
  check(`${label}: N focuses the composer and types nothing`, viaN.focused && viaN.value === '', JSON.stringify(viaN.value))

  // --------------------------------------------------------- 3 · an empty one posts nothing
  const before = posted.length
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(250)
  check(`${label}: Ctrl+Enter on an empty composer posts nothing`, posted.length === before, `${posted.length - before} post(s)`)

  // -------------------------------------------- 4 · Ctrl+Enter posts and the note joins the spine
  const NOTE = rtl ? 'العميل اتصل بخصوص البوابة' : 'Customer called about the gate'
  await page.locator('#note-composer').fill(NOTE)
  await page.waitForTimeout(80)
  const typed = await read(page)
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(1200)
  const sent = await read(page)
  const post = posted.at(-1)
  check(
    `${label}: with text the composer is unsent and Post is enabled`,
    typed.composer === 'unsent' && typed.postDisabled === false,
    JSON.stringify({ composer: typed.composer, post: typed.postDisabled }),
  )
  check(
    `${label}: Ctrl+Enter posts today's add-note body (documentNo + note) on UpdateDelivery`,
    posted.length === before + 1 &&
      post.path === 'SdDocumentWeb/UpdateDelivery' &&
      JSON.stringify(post.body) === JSON.stringify({ documentNo: '8000000253', actionType: 'DADN', note: NOTE }),
    JSON.stringify(post),
  )
  check(
    `${label}: the box empties and the note joins the spine as the newest row, below the Now line`,
    sent.value === '' &&
      sent.composer === 'empty' &&
      sent.notes.length === 1 &&
      sent.notes[0].includes(NOTE) &&
      sent.firstPast === 'note' &&
      !sent.toasts.some((t) => /failed|done/i.test(t)),
    JSON.stringify({ value: sent.value, notes: sent.notes, first: sent.firstPast, toasts: sent.toasts }),
  )
  await page.screenshot({ path: `${SHOTS}/posted-${theme}-${dir}.png` })

  // ------------------------------------------- 5 · Esc with unsent text: blur, then refused
  await page.locator('#note-composer').fill('unsent draft')
  await page.locator('#note-composer').focus()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const firstEsc = await read(page)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const secondEsc = await read(page)
  check(
    `${label}: Esc in the composer only blurs it, and the page stays`,
    !firstEsc.focused && firstEsc.url === '/oms/delivery/8000000253' && firstEsc.toasts.length === 0,
    JSON.stringify({ focused: firstEsc.focused, url: firstEsc.url, toasts: firstEsc.toasts }),
  )
  check(
    `${label}: a second Esc with unsent text toasts the refusal and stays, text intact`,
    secondEsc.url === '/oms/delivery/8000000253' &&
      secondEsc.toasts.some((t) => t.includes(UNSENT)) &&
      secondEsc.value === 'unsent draft',
    JSON.stringify({ url: secondEsc.url, toasts: secondEsc.toasts, value: secondEsc.value }),
  )
  await page.screenshot({ path: `${SHOTS}/esc-refused-${theme}-${dir}.png` })
  await dismissToasts(page)

  // ---------------------------------------------------- 6 · a failed post shows inline
  state.failNext = true
  await page.locator('#note-composer').focus()
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(800)
  const failed = await read(page)
  check(
    `${label}: a refused post shows inline with its message and code, keeps the text, and toasts nothing`,
    failed.failure?.includes('The note was not posted') &&
      failed.failure.includes(REJECTED) &&
      failed.failureCode === REJECTED_CODE &&
      failed.value === 'unsent draft' &&
      failed.composer === 'unsent' &&
      failed.toasts.length === 0,
    JSON.stringify({ failure: failed.failure, code: failed.failureCode, value: failed.value, toasts: failed.toasts }),
  )
  await page.screenshot({ path: `${SHOTS}/failed-${theme}-${dir}.png` })

  // ------------------------------- 6b · posting: locked, Esc refused, and a jump away mid-post
  state.delayMs = 1500
  await page.locator('#note-composer').fill('slow note')
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(200)
  const posting = await read(page)
  await page.keyboard.type('more')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  const postingEsc = await read(page)
  await page.waitForTimeout(1800)
  const slowDone = await read(page)
  check(
    `${label}: while a note posts the box is read-only, takes no typing, and Esc stays refused`,
    posting.composer === 'posting' &&
      posting.readOnly === true &&
      postingEsc.value === 'slow note' &&
      postingEsc.url === '/oms/delivery/8000000253' &&
      postingEsc.toasts.some((t) => t.includes(UNSENT)) &&
      slowDone.value === '' &&
      slowDone.notes.some((n) => n.includes('slow note')),
    JSON.stringify({ posting: [posting.composer, posting.readOnly], esc: [postingEsc.value, postingEsc.url], done: slowDone.value }),
  )
  await dismissToasts(page)
  state.failNext = true
  await page.locator('#note-composer').fill('lost on the way')
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(150)
  await page.keyboard.press('Control+k')
  await page.locator('[data-palette-input]').fill('8000000174')
  await page.waitForSelector('[data-palette-row="jump:delivery"]', { timeout: 3000 }).catch(() => {})
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2200)
  const jumped = await read(page)
  check(
    `${label}: a post answering after a jump leaves the new record alone and toasts its failure by number`,
    jumped.url === '/oms/delivery/8000000174' &&
      jumped.value === '' &&
      jumped.composer === 'empty' &&
      jumped.failure === null &&
      // The number is isolated whole (fsi: a toast is a string-only sink).
      jumped.toasts.some((t) => t.includes('The note on ⁨8000000253⁩ was not posted') && t.includes(REJECTED)),
    JSON.stringify({ url: jumped.url, value: jumped.value, failure: jumped.failure, toasts: jumped.toasts }),
  )
  state.delayMs = 0
  await dismissToasts(page)
  await openDetails(page, '/oms/delivery/8000000253')
  await blurAll(page)

  // ------------------------------------------------------------ 7 · R and C open their dialogs
  await page.keyboard.press('r')
  await page.waitForTimeout(400)
  const r = await read(page)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const afterR = await read(page)
  await page.keyboard.press('c')
  await page.waitForTimeout(400)
  const c = await read(page)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const afterC = await read(page)
  check(
    `${label}: R opens Reschedule and C opens Request Cancellation; Esc closes each and stays on the page`,
    r.dialog === 'Reschedule' &&
      afterR.dialog === null &&
      afterR.url === '/oms/delivery/8000000253' &&
      c.dialog === 'Request Cancellation' &&
      afterC.dialog === null &&
      afterC.url === '/oms/delivery/8000000253',
    JSON.stringify([r.dialog, afterR.dialog, afterR.url, c.dialog, afterC.dialog, afterC.url]),
  )

  // ------------------------------------------------------------------ 8 · ? opens the sheet
  await blurAll(page)
  await page.keyboard.press('Shift+Slash')
  await page.waitForTimeout(300)
  const sheet = await read(page)
  check(
    `${label}: ? opens the help sheet listing R, C, N and Esc for this screen`,
    sheet.sheet.length === 4 &&
      sheet.sheet[0].startsWith('Reschedule') &&
      sheet.sheet[1].startsWith('Request Cancellation') &&
      sheet.sheet[2].startsWith('Add Note…') &&
      sheet.sheet[3].startsWith('Back to Delivery Documents'),
    JSON.stringify(sheet.sheet),
  )
  await page.screenshot({ path: `${SHOTS}/sheet-${theme}-${dir}.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  // ------------------------------------------- 7b · C refused where a request is already open
  await openDetails(page, '/oms/delivery/8000000174')
  await blurAll(page)
  await page.keyboard.press('c')
  await page.waitForTimeout(400)
  const refusedC = await read(page)
  check(
    `${label}: C with a request already open opens nothing and toasts the button's reason`,
    refusedC.dialog === null && refusedC.toasts.some((t) => t.includes(REQUEST_OPEN)),
    JSON.stringify({ dialog: refusedC.dialog, toasts: refusedC.toasts }),
  )
  await dismissToasts(page)

  // -------------------------------------------------- 9 · Esc on a pasted link: the list route
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  const pastedBack = await read(page)
  check(`${label}: Esc on a pasted link goes to the list route`, pastedBack.url === '/oms/deliveries', pastedBack.url)

  // ---------------------------- 10 · from the list: Esc-Esc goes back with the query and row
  await page.goto(`${BASE}/oms/deliveries`)
  await page.waitForSelector('[data-query-search]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(500)
  await page.locator('[data-query-add]').click()
  await page.locator('[data-query-entry="storeCode"]').click()
  await page.locator('[data-token-popover="storeCode"]').locator('input, select').first().fill('1017')
  await page.locator('[data-query-search]').click()
  await page.waitForTimeout(1000)
  await page.locator('.ag-row .ag-cell[col-id="deliveryNo"]', { hasText: /^8000000174$/ }).first().click()
  await page.waitForTimeout(200)
  const listIdx = (await read(page)).idx
  await page.keyboard.press('Enter')
  await bar(page).waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
  const onDetails = await read(page)
  await page.keyboard.press('n')
  await page.waitForTimeout(150)
  const focusedFromList = (await read(page)).focused
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const blurred = await read(page)
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-status-bar]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  const restored = await page.evaluate(() => ({
    url: location.pathname,
    idx: window.history.state?.idx ?? null,
    token: document.querySelector('[data-query-token="storeCode"]')?.getAttribute('data-token-state') ?? null,
    tokenText: document.querySelector('[data-query-token="storeCode"]')?.textContent.trim() ?? null,
    inspector: document.querySelector('[data-inspector-row]')?.getAttribute('data-inspector-row') ?? null,
    selected: [...document.querySelectorAll('.ag-row-selected .ag-cell[col-id="deliveryNo"]')].map((c) => c.textContent.trim()),
  }))
  check(
    `${label}: Enter from the list opens Details, and N focuses its composer`,
    onDetails.url === '/oms/delivery/8000000174' && focusedFromList,
    JSON.stringify({ url: onDetails.url, focusedFromList }),
  )
  check(
    `${label}: Esc-Esc from the composer goes BACK (history) to the list, query token and current row restored`,
    blurred.url === '/oms/delivery/8000000174' &&
      restored.url === '/oms/deliveries' &&
      restored.idx === listIdx &&
      restored.token === 'applied' &&
      restored.tokenText.includes('1017') &&
      restored.inspector === '8000000174' &&
      restored.selected.includes('8000000174'),
    JSON.stringify({ blurred: blurred.url, listIdx, restored }),
  )
  await page.screenshot({ path: `${SHOTS}/back-to-list-${theme}-${dir}.png` })

  // --------------------------------------------- 11 · N on a list row: the composer, no dialog
  await page.locator('.ag-row .ag-cell[col-id="deliveryNo"]', { hasText: /^8000000253$/ }).first().click()
  await page.waitForTimeout(200)
  await page.keyboard.press('n')
  await bar(page).waitFor({ timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  const intent = await read(page)
  check(
    `${label}: N on a list row lands on Details with the composer focused and no dialog`,
    intent.url === '/oms/delivery/8000000253' && intent.focused && intent.dialog === null,
    JSON.stringify({ url: intent.url, focused: intent.focused, dialog: intent.dialog }),
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  check(`${label}: and Esc-Esc from there goes back to the list`, new URL(page.url()).pathname === '/oms/deliveries', page.url())

  // ------------------------------- 12 · the document route: no letters, Add Note… still focuses
  await openDetails(page, '/oms/document/8000000253')
  await blurAll(page)
  await page.keyboard.press('n')
  await page.keyboard.press('r')
  await page.waitForTimeout(300)
  const docRoute = await read(page)
  await page.locator('[data-command="add-note"]').click()
  await page.waitForTimeout(150)
  const docFocus = await read(page)
  check(
    `${label}: on the document route letters do nothing and hint nothing; Add Note… still focuses the composer`,
    !docRoute.focused && docRoute.dialog === null && docRoute.boxKeys === null && docFocus.focused,
    JSON.stringify({ focused: docRoute.focused, dialog: docRoute.dialog, keys: docRoute.boxKeys, after: docFocus.focused }),
  )

  // --------------------------------------------------------------- 13 · RTL placement
  if (rtl) {
    await openDetails(page, '/oms/delivery/8000000253')
    const layout = await page.evaluate(() => {
      const box = document.getElementById('note-composer').getBoundingClientRect()
      const post = document.querySelector('[data-composer-post]').getBoundingClientRect()
      const hint = document.querySelector('[data-composer-hint] [data-key-chord]')
      const caps = [...hint.querySelectorAll('kbd')].map((k) => [k.textContent, k.getBoundingClientRect().x])
      return { dir: document.documentElement.dir, postLeft: post.left, boxLeft: box.left, caps }
    })
    check(
      `${label}: Post sits at the inline end (left) and the Ctrl Enter hint reads in order`,
      layout.dir === 'rtl' &&
        Math.abs(layout.postLeft - layout.boxLeft) < 2 &&
        layout.caps.length === 2 &&
        layout.caps[0][0] === 'Ctrl' &&
        layout.caps[0][1] < layout.caps[1][1],
      JSON.stringify(layout),
    )
  }

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.browser().close()
}

for (const [theme, dir] of [['light', 'ltr'], ['dark', 'ltr'], ['light', 'rtl']]) {
  await drive({ theme, dir })
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
