// Deliveries list drive (spec 380 S3) — the list's own drive, which the S3 slices extend.
//
// Ticket 396: the grid's derived Status column (L10, from the shared timeline derivation D1).
// In light and dark, LTR and RTL, on the real painted DOM:
//   - the Status column sits SECOND, after Delivery no., in reading order (so on the right
//     under RTL);
//   - each stub row shows the state word the timeline derives for it — Created, Ready, Out for
//     delivery, Delivered, Cancellation requested, Cancelled — including pick-in-store (no Out)
//     and Cancelled after delivery (`X`);
//   - the dot is the state's token (Cancellation requested is `--fam-cancel-request` indigo,
//     never amber; Cancelled `--danger`), and the word's ink clears 4.5:1 on its row;
//   - the word sits in a `<bdi>` with no invisible isolate characters, sits after the dot in
//     reading order, and a two-word state reads in order under RTL;
//   - the value IS the word: the floating filter narrows on it.
//
// Ticket 397: the Delivery inspector (L6, L13, L15, L16's J/K/Enter/I, L18).
//   - before a search the pane is open at 360 px with its empty prompt;
//   - J/K and ↓/↑ move ONE current row (selection follows focus), J from outside the grid, J
//     held (repeat) and J on an Arabic layout (event.key Arabic, event.code KeyJ) — and the
//     inspector follows with NO network request (asserted on the request log);
//   - the sections come from the row: header, the timeline with the window as the next step's
//     expectation, the rewind marker, Dawaa Now gold on navy, the due tag, the failed-jobs
//     banner only when > 0, never the handover OTP; Cancellation requested indigo;
//   - the slot and the courier line are each ONE ltr isolate and read in order under RTL;
//   - Enter on a cell and a double-click open Delivery details; Back restores the current row;
//     Enter on a button stays the button's;
//   - `I`, the chevron and the grid bar toggle fold and unfold it; folded, the grid takes the
//     width back;
//   - the separator sits on the inline-start edge: arrows step 16, Home/End, double-click resets,
//     a drag resizes, and width + open/closed survive a reload; a malformed store reads 360, open.
//
// Ticket 398: the views rail's lenses (L1, L2, L7, L9, L17).
//   - the 220px rail sits at the inline-start edge on `--card-2`; before a search every count
//     reads "—";
//   - after a search the counts are the loaded rows each lens matches, Needs attention's in
//     danger ink while above 0; the pill reads "8 deliveries";
//   - clicking a lens narrows the grid with NO request (asserted on the request log), takes the
//     `--primary-050` ground and the `--cursor` bar, and changes no count;
//   - a column filter shows "N of M shown" + Clear grid filters, and changes no count;
//   - a lens with no loaded rows shows its empty state over a STILL-MOUNTED grid;
//   - a full page (rows = Limit) reads "N+" on every lens and shows the cut-off line; "8+" is
//     one ltr isolate with no invisible isolate characters;
//   - "Show: Needs attention" from Ctrl+K applies the lens, with no key and no request.
//
// Ticket 399: the query bar (L8, L16's `/`).
//   - the bar sits at the top of the centre column; before a search it holds the Limit token
//     alone ("Limit: 200", no ×), then Search at the inline end (left under RTL);
//   - + Filter lists the 13 entries for the 14 criteria in four groups — When · Find one ·
//     Narrow · Rows — and marks the ones in the search "in search";
//   - an added and an edited token go dashed `--attention`, the note reads "N changes not
//     searched", Search carries the amber dot; × leaves a struck ghost with a restore; Discard
//     goes back to the search that ran; Done closes a popover without a request;
//   - Enter in a token popover searches (one request, with the value just typed) and does NOT
//     open Delivery details, though a row is current; a search that FAILS keeps its edit flagged;
//   - the Date is one relative token: "Last 3 days" sends FromDate/ToDate for today-2..today and
//     still reads "Last 3 days" after the search;
//   - `/` from a grid cell focuses + Filter, prevented; the store chip's value is mono and one ltr
//     isolate; Back from Delivery details restores the tokens with nothing pending.
//
// SIS.Api's delivery list needs a store grant a dev session does not have, so every `/api/**`
// call is stubbed here, as in tools/grid-theme-drive.mjs. The RTL passes store
// `oms.locale = ar` before boot (383); the chrome stays English and the DATA carries Arabic
// (no Arabic locale file exists), as the prototypes drove it.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/deliveries-list-drive.mjs        (DRIVE_PORT=5280 for another port)
//
// Screenshots → tools/.deliveries-list-shots/.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.deliveries-list-shots'
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

const ROW = (over) => ({
  deliveryNo: '80001200',
  documentNo: '1000000400',
  deliveryDocumentType: 'Forward',
  orderNo: '900100',
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
  rescheduledTime: '',
  netTotal: 475.22,
  paidAmount: 475.22,
  deliveryFees: 25,
  amountDue: 0,
  readyStatus: '',
  clearStatus: '',
  deliveryStatus: '',
  closeStatus: '',
  outForDeliveryTime: '',
  actualDeliveryTime: '',
  lastAction: '',
  failedJobsCount: 0,
  courierCode: 'JAH',
  courierDriverName: 'Khalid N.',
  customerOtp: OTP,
  ...over,
})

// The handover secret every stub row carries: the inspector must never show it.
const OTP = '482913'

// One row per state, keyed by delivery no. `dot` is the dot's token, `ink` the word's.
const CASES = [
  { no: '80001201', word: 'Created', key: 'created', dot: '--ink-3', ink: '--muted-foreground', over: {} },
  { no: '80001202', word: 'Ready', key: 'ready', dot: '--ink-3', ink: '--muted-foreground', over: { readyStatus: 'R', rescheduled: true, rescheduledTime: '2026-10-02T15:30:00', rescheduledReason: 'Customer asked', rescheduledUser: 'msartawi', isExpressDelivery: true, amountDue: 72.5, isActiveInStore: false, note: 'Gate 3, call on arrival' } },
  { no: '80001203', word: 'Out for delivery', key: 'out', dot: '--primary', ink: '--primary', over: { readyStatus: 'R', deliveryStatus: 'O', outForDeliveryTime: '2026-10-02T17:12:00', failedJobsCount: 2 } },
  { no: '80001204', word: 'Delivered', key: 'delivered', dot: '--success', ink: '--success-800', over: { readyStatus: 'C', deliveryStatus: 'D', actualDeliveryTime: '2026-10-02T18:05:00' } },
  { no: '80001205', word: 'Cancellation requested', key: 'requested', dot: '--fam-cancel-request', ink: '--fam-cancel-request', over: { readyStatus: 'R', closeStatus: 'R' } },
  { no: '80001206', word: 'Cancelled', key: 'cancelled', dot: '--danger', ink: '--danger-800', over: { readyStatus: 'C', deliveryStatus: 'D', closeStatus: 'X' } },
  // Pick-in-store, ready: no Out step, still reads Ready. The list sends the description.
  { no: '80001207', word: 'Ready', key: 'ready', dot: '--ink-3', ink: '--muted-foreground', over: { deliveryType: 'PickInStore', readyStatus: 'R' } },
  // Closed (C) by the worker while out for delivery.
  { no: '80001208', word: 'Cancelled', key: 'cancelled', dot: '--danger', ink: '--danger-800', over: { readyStatus: 'R', deliveryStatus: 'O', closeStatus: 'C' } },
]

const ARABIC_NAME = 'نورة الحربي'
const ARABIC_DRIVER = 'خالد ن.'

const rows = (dir) =>
  CASES.map((c, i) =>
    ROW({
      deliveryNo: c.no,
      documentNo: String(1000000401 + i),
      orderNo: String(900101 + i),
      ...(dir === 'rtl' && i % 2 === 0 ? { customerName: ARABIC_NAME, courierDriverName: ARABIC_DRIVER } : {}),
      ...c.over,
    }),
  )

const routeApi = (dir) => async (route) => {
  const url = route.request().url()
  const path = url.split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: '1017' }),
    )
  // 398: a search narrowed by store returns no failed rows, so Needs attention matches none.
  if (path === 'SdDocumentWeb/DeliveryDocumentList')
    return route.fulfill(
      envelope(/[?&]StoreCode=/.test(url) ? rows(dir).filter((r) => !r.failedJobsCount) : rows(dir)),
    )
  if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path))
    return route.fulfill(envelope([]))
  // Delivery details after Enter / a double-click: a business "not found" is enough — the
  // drive checks where Enter went, not the record page (402–405 drive that).
  if (/^SdDocumentWeb\/(Delivery|Document)\//.test(path))
    return route.fulfill(envelope(null, { success: false, message: 'Not found in this drive' }))
  if (/Access$/.test(path))
    return route.fulfill(envelope({ screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true }))
  return route.fulfill(envelope({}))
}

const browser = await chromium.launch()

async function drive({ theme, dir }) {
  const label = `${theme}/${dir}`
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )
  await page.route('**/api/**', routeApi(dir))
  // Every /api/ request, in order: J/K must add none (397).
  const requests = []
  page.on('request', (r) => r.url().includes('/api/') && requests.push(r.url().split('/api/')[1]))

  await page.goto(BASE + '/oms/deliveries')
  // 397: before any search, the inspector is open at its default width with its empty prompt.
  await page.waitForSelector('[data-inspector-empty]', { timeout: 20000 }).catch(() => {})
  const before = await page.evaluate(() => ({
    width: document.getElementById('delivery-inspector')?.getBoundingClientRect().width ?? 0,
    empty: document.querySelector('[data-inspector-empty]')?.textContent ?? '',
  }))
  check(
    `${label}: before a search the inspector is open at 360 px with its empty prompt`,
    before.width === 360 && before.empty.includes('Select a delivery to inspect it.') && /J\s*K/.test(before.empty),
    `width ${before.width} · "${before.empty}"`,
  )
  await page.locator('[data-query-search]').click().catch(() => {})
  await page.waitForSelector('.ag-center-cols-container .ag-row', { timeout: 20000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)

  // 1. Status sits second, in reading order.
  const order = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.ag-header-row-column .ag-header-cell[col-id]')]
      .filter((h) => h.getAttribute('aria-colindex'))
      .sort((a, b) => Number(a.getAttribute('aria-colindex')) - Number(b.getAttribute('aria-colindex')))
    const ids = heads.map((h) => h.getAttribute('col-id'))
    const rect = (id) => heads.find((h) => h.getAttribute('col-id') === id)?.getBoundingClientRect()
    const no = rect('deliveryNo')
    const status = rect('status')
    return {
      ids: ids.slice(0, 3),
      label: heads[1]?.querySelector('.ag-header-cell-text')?.textContent?.trim(),
      after: no && status ? (status.left > no.left ? 'right' : 'left') : null,
    }
  })
  check(
    `${label}: Status is the second column, after Delivery no. in reading order`,
    order.ids[0] === 'deliveryNo' &&
      order.ids[1] === 'status' &&
      order.label === 'Status' &&
      order.after === (dir === 'rtl' ? 'left' : 'right'),
    `${order.ids.join(', ')} · "${order.label}" · Status sits ${order.after} of Delivery no.`,
  )

  // 2–4. Every row: the word, the dot's token, the word's ink and its contrast, the isolate.
  const read = await page.evaluate(
    ({ cases }) => {
      const resolve = (expr) => {
        const probe = document.createElement('div')
        probe.style.color = expr
        document.body.appendChild(probe)
        const v = getComputedStyle(probe).color
        probe.remove()
        return v
      }
      const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
      const lum = ([r, g, b]) => {
        const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (a, b) => {
        const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p)
        return (x + 0.05) / (y + 0.05)
      }
      const card = resolve('var(--card)')
      return cases.map((c) => {
        const noCell = [...document.querySelectorAll('.ag-row:not(.ag-header-row) .ag-cell[col-id="deliveryNo"]')].find(
          (el) => el.textContent.trim() === c.no,
        )
        const rowIndex = noCell?.closest('.ag-row')?.getAttribute('row-index')
        const cell = document.querySelector(`.ag-row[row-index="${rowIndex}"] .ag-cell[col-id="status"]`)
        const host = cell?.querySelector('[data-status]')
        const dot = host?.querySelector('[aria-hidden]')
        const bdi = host?.querySelector('bdi')
        let wordOrder = 'n/a'
        if (bdi && c.word.includes(' ')) {
          // Two words: does the first sit to the LEFT of the last on screen? (English reads LTR
          // inside its isolate, under either page direction.)
          const text = bdi.firstChild
          const r1 = document.createRange()
          r1.setStart(text, 0)
          r1.setEnd(text, c.word.indexOf(' '))
          const r2 = document.createRange()
          r2.setStart(text, c.word.lastIndexOf(' ') + 1)
          r2.setEnd(text, c.word.length)
          wordOrder = r1.getBoundingClientRect().left < r2.getBoundingClientRect().left ? 'ltr' : 'reversed'
        }
        const dotBox = dot?.getBoundingClientRect()
        const bdiBox = bdi?.getBoundingClientRect()
        return {
          no: c.no,
          found: !!cell,
          text: cell?.textContent ?? '',
          key: host?.getAttribute('data-status') ?? null,
          dotOk: !!dot && getComputedStyle(dot).backgroundColor === resolve(`var(${c.dot})`),
          dotColor: dot ? getComputedStyle(dot).backgroundColor : null,
          inkOk: !!bdi && getComputedStyle(bdi).color === resolve(`var(${c.ink})`),
          contrast: bdi ? ratio(getComputedStyle(bdi).color, card) : 0,
          bdi: !!bdi && bdi.textContent === c.word,
          dotSide: dotBox && bdiBox ? (dotBox.left < bdiBox.left ? 'left' : 'right') : null,
          wordOrder,
          amber: dot ? getComputedStyle(dot).backgroundColor === resolve('var(--attention)') : false,
        }
      })
    },
    { cases: CASES },
  )

  for (const [i, r] of read.entries()) {
    const c = CASES[i]
    const isolated = !/[\u2066-\u2069\u200e\u200f]/.test(r.text)
    const dotSide = dir === 'rtl' ? 'right' : 'left'
    check(
      `${label}: ${c.no} reads "${c.word}" with a ${c.dot} dot and ${c.ink} ink`,
      r.found &&
        r.text === c.word &&
        r.key === c.key &&
        r.dotOk &&
        !r.amber &&
        r.inkOk &&
        r.contrast >= 4.5 &&
        r.bdi &&
        isolated &&
        r.dotSide === dotSide &&
        r.wordOrder !== 'reversed',
      `text "${r.text}" · key ${r.key} · dot ${r.dotColor}${r.dotOk ? '' : ' (WRONG)'} · ink ${r.inkOk ? 'ok' : 'WRONG'} ${r.contrast.toFixed(2)}:1 · bdi ${r.bdi} · no isolate chars ${isolated} · dot on the ${r.dotSide} · words ${r.wordOrder}`,
    )
  }

  await page.screenshot({ path: `${SHOTS}/status-${theme}-${dir}.png` })

  // 5. The value IS the word: the column's floating filter narrows on it.
  const statusFilter = page.locator('.ag-floating-filter[col-id="status"] input')
  const filterFound = (await statusFilter.count()) === 1
  if (filterFound) {
    await statusFilter.fill('cancel')
    await page.waitForTimeout(1200)
  }
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('.ag-row:not(.ag-header-row) .ag-cell[col-id="status"]')]
      .map((c) => c.textContent.trim())
      .sort(),
  )
  check(
    `${label}: filtering Status on "cancel" leaves the two cancellations and the request`,
    filterFound && JSON.stringify(shown) === JSON.stringify(['Cancellation requested', 'Cancelled', 'Cancelled']),
    filterFound ? shown.join(' | ') : 'no floating filter under the Status header',
  )
  if (filterFound) await statusFilter.fill('')
  await page.waitForTimeout(800)

  await inspectorChecks({ page, label, theme, dir, requests })
  await lensChecks({ page, label, theme, dir, requests })
  await queryChecks({ page, label, theme, dir, requests })

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

// ----- 397: the Delivery inspector -----------------------------------------------------------

/** Click a row's Delivery no. cell (pinned at the reading start), which selects and focuses it. */
async function clickRow(page, no) {
  await page.locator('.ag-row .ag-cell[col-id="deliveryNo"]', { hasText: new RegExp(`^${no}$`) }).first().click()
  await page.waitForTimeout(150)
}

/** Where the one current row is: the inspector's row, the selected and the focused grid rows. */
const where = (page) =>
  page.evaluate(() => {
    const noAt = (i) =>
      document.querySelector(`.ag-row[row-index="${i}"] .ag-cell[col-id="deliveryNo"]`)?.textContent?.trim() ?? null
    const selected = [...new Set([...document.querySelectorAll('.ag-row-selected')].map((r) => r.getAttribute('row-index')))]
    return {
      inspector: document.querySelector('[data-inspector-row]')?.getAttribute('data-inspector-row') ?? null,
      selected: selected.join(','),
      selectedNo: selected.length === 1 ? noAt(selected[0]) : null,
      focused: document.querySelector('.ag-cell-focus')?.closest('.ag-row')?.getAttribute('row-index') ?? null,
    }
  })

const paneWidth = (page) =>
  page.evaluate(() => document.getElementById('delivery-inspector')?.getBoundingClientRect().width ?? 0)

async function inspectorChecks({ page, label, theme, dir, requests }) {
  const rtl = dir === 'rtl'

  // 6. One current row: J/K, ↓/↑, J from outside the grid, held, on an Arabic layout.
  await clickRow(page, '80001208')
  requests.length = 0
  const trail = []
  const expectAt = async (step, index) => {
    await page.waitForTimeout(120)
    const w = await where(page)
    const no = await page.evaluate(
      (i) => document.querySelector(`.ag-row[row-index="${i}"] .ag-cell[col-id="deliveryNo"]`)?.textContent?.trim(),
      index,
    )
    const ok = w.selected === String(index) && w.inspector === no && w.selectedNo === no
    trail.push(`${step}→${index}${ok ? '' : ` (selected ${w.selected}, inspector ${w.inspector})`}`)
    return ok
  }
  let moves = await expectAt('click', 0)
  await page.keyboard.press('j')
  moves = (await expectAt('J', 1)) && moves
  await page.keyboard.press('ArrowDown')
  moves = (await expectAt('↓', 2)) && moves
  await page.keyboard.press('k')
  moves = (await expectAt('K', 1)) && moves
  await page.keyboard.press('ArrowUp')
  moves = (await expectAt('↑', 0)) && moves
  // Out of the grid: focus on the page itself.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await page.keyboard.press('j')
  moves = (await expectAt('J outside', 1)) && moves
  // An Arabic layout: event.key is Arabic, event.code is the physical KeyJ.
  await page.evaluate(() =>
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ت', code: 'KeyJ', bubbles: true, cancelable: true })),
  )
  moves = (await expectAt('J (Arabic)', 2)) && moves
  // Held: a hidden navigation command repeats.
  await page.evaluate(() =>
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'j', code: 'KeyJ', repeat: true, bubbles: true, cancelable: true }),
    ),
  )
  moves = (await expectAt('J held', 3)) && moves
  check(`${label}: J/K and ↓/↑ move one current row and the inspector follows it`, moves, trail.join(' · '))
  check(
    `${label}: stepping made no network request`,
    requests.length === 0,
    requests.length ? requests.join(', ') : 'request log empty',
  )

  // 7. The sections, from the row: 80001202 is Ready, rescheduled, Dawaa Now, 72.50 due.
  await clickRow(page, '80001202')
  const read = await page.evaluate(
    ({ otp, rtl }) => {
      const resolve = (expr, prop = 'color') => {
        const probe = document.createElement('div')
        probe.style[prop] = expr
        document.body.appendChild(probe)
        const v = getComputedStyle(probe)[prop]
        probe.remove()
        return v
      }
      const aside = document.getElementById('delivery-inspector')
      const step = (k) => aside.querySelector(`[data-step="${k}"]`)
      const ltrIn = (f) => aside.querySelector(`[data-field="${f}"] dd bdi[dir="ltr"]`)
      /** Does substring `a` sit to the LEFT of substring `b` inside one isolate, on screen? */
      const leftOf = (bdi, a, b) => {
        const node = bdi?.firstChild
        if (!node) return null
        const at = (s) => {
          const i = node.textContent.indexOf(s)
          const r = document.createRange()
          r.setStart(node, i)
          r.setEnd(node, i + s.length)
          return r.getBoundingClientRect().left
        }
        return at(a) < at(b)
      }
      const no = aside.querySelector('[data-inspector-no]')
      const gold = aside.querySelector('[data-tag="dawaaNow"]')
      const slot = ltrIn('slot')
      const courier = ltrIn('courier')
      return {
        no: no?.textContent,
        noMono: no ? /Plex Mono/.test(getComputedStyle(no).fontFamily) && getComputedStyle(no).fontSize === '18px' : false,
        status: aside.querySelector('[data-status]')?.textContent,
        steps: [...aside.querySelectorAll('[data-step]')].map((s) => `${s.dataset.step}:${s.dataset.state}`).join(' '),
        expect: step('out')?.querySelector('[data-expect]')?.textContent,
        expectIsolated: step('out')?.querySelector('[data-expect] bdi[dir="ltr"]')?.textContent,
        marker: step('created')?.querySelector('[data-marker]')?.textContent,
        gold:
          !!gold &&
          getComputedStyle(gold).backgroundColor === resolve('var(--gold)', 'backgroundColor') &&
          getComputedStyle(gold).color === resolve('var(--gold-foreground)'),
        due: aside.querySelector('[data-tag="due"]')?.textContent,
        banner: !!aside.querySelector('[data-failed-banner]'),
        otp: aside.textContent.includes(otp),
        notActive: aside.querySelector('[data-field="store"]')?.textContent,
        slot: slot?.textContent,
        slotInOrder: leftOf(slot, '02 Oct', '10:00'),
        courier: courier?.textContent,
        courierInOrder: leftOf(courier, 'JAH', 'Khalid'),
        amountDue: aside.querySelector('[data-field="amountDue"]')?.textContent,
        money: ['net', 'paid', 'fees'].map((f) => aside.querySelector(`[data-field="${f}"] dd`)?.textContent).join(' '),
        note: aside.querySelector('[data-field="note"]')?.textContent,
        rescheduled: aside.querySelector('[data-field="rescheduled"] dd')?.textContent,
        invisible: /[⁦-⁩]/.test(aside.textContent),
        // Each line of the reschedule value starts at the value's inline start in either direction.
        startAligned: (() => {
          const dd = aside.querySelector('[data-field="rescheduled"] dd')
          const lines = [...(dd?.querySelectorAll('bdi') ?? [])]
          if (!dd || lines.length !== 2) return false
          const box = dd.getBoundingClientRect()
          return lines.every((l) =>
            rtl ? Math.abs(l.getBoundingClientRect().right - box.right) <= 1 : Math.abs(l.getBoundingClientRect().left - box.left) <= 1,
          )
        })(),
      }
    },
    { otp: OTP, rtl },
  )
  check(
    `${label}: the header — delivery no. in mono 18px, status, Dawaa Now gold on navy, Due 72.50`,
    read.no === '80001202' && read.noMono && read.status === 'Ready' && read.gold && read.due === 'Due 72.50',
    `no ${read.no} mono18 ${read.noMono} · status ${read.status} · gold ${read.gold} · due "${read.due}"`,
  )
  check(
    `${label}: the timeline — next step expects the window, the rewind marker on Created`,
    read.steps === 'created:done ready:current out:next delivered:later' &&
      read.expect === 'expected 10:00–12:00' &&
      read.expectIsolated === '10:00–12:00' &&
      /^Rescheduled/.test(read.marker ?? ''),
    `${read.steps} · "${read.expect}" (isolated "${read.expectIsolated}") · marker "${read.marker}"`,
  )
  check(
    `${label}: fulfilment, money and note from the row; no banner at 0 failed jobs; never the OTP`,
    /Not active in store/.test(read.notActive ?? '') &&
      read.rescheduled === 'Customer asked2026-10-02 15:30 · msartawi' &&
      read.money === '475.22 475.22 25.00' &&
      read.amountDue === 'Amount due72.50' &&
      read.note === 'Gate 3, call on arrival' &&
      !read.banner &&
      !read.otp &&
      !read.invisible &&
      read.startAligned,
    `reschedule lines at the inline start ${read.startAligned} · store "${read.notActive}" · rescheduled "${read.rescheduled}" · money ${read.money} · "${read.amountDue}" · note "${read.note}" · banner ${read.banner} · otp shown ${read.otp} · isolate chars ${read.invisible}`,
  )
  check(
    `${label}: the slot and the courier are each one ltr isolate, read in order`,
    read.slot === '02 Oct 2026 · 10:00–12:00' &&
      read.slotInOrder === true &&
      read.courier === 'JAH · Khalid N.' &&
      read.courierInOrder === true,
    `slot "${read.slot}" in order ${read.slotInOrder} · courier "${read.courier}" in order ${read.courierInOrder}`,
  )
  await page.screenshot({ path: `${SHOTS}/inspector-${theme}-${dir}.png` })

  if (rtl) {
    // An Arabic driver name: the code still leads, the pair still one isolate.
    await clickRow(page, '80001201')
    const arabic = await page.evaluate((driver) => {
      const bdi = document.querySelector('#delivery-inspector [data-field="courier"] dd bdi[dir="ltr"]')
      const node = bdi?.firstChild
      if (!node) return { text: null }
      const left = (s) => {
        const i = node.textContent.indexOf(s)
        const r = document.createRange()
        r.setStart(node, i)
        r.setEnd(node, i + s.length)
        return r.getBoundingClientRect().left
      }
      return { text: bdi.textContent, codeFirst: left('JAH') < left(driver) }
    }, ARABIC_DRIVER)
    check(
      `${label}: an Arabic driver name keeps the courier code at the start of its one isolate`,
      arabic.text === `JAH · ${ARABIC_DRIVER}` && arabic.codeFirst === true,
      `"${arabic.text}" · code first ${arabic.codeFirst}`,
    )
  }

  // 8. The banner only when jobs failed; Cancellation requested is indigo on the spine too.
  await clickRow(page, '80001203')
  const banner = await page.evaluate(() => document.querySelector('#delivery-inspector [data-failed-banner]')?.textContent ?? null)
  await clickRow(page, '80001205')
  const indigo = await page.evaluate(() => {
    const li = document.querySelector('#delivery-inspector [data-step="requested"]')
    const dot = li?.querySelector(':scope > span[aria-hidden]')
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--fam-cancel-request)'
    document.body.appendChild(probe)
    const want = getComputedStyle(probe).backgroundColor
    probe.remove()
    return { state: li?.dataset.state, ok: !!dot && getComputedStyle(dot).backgroundColor === want }
  })
  check(
    `${label}: "2 jobs failed" on the row that has them; Cancellation requested is an indigo step`,
    banner === '2 jobs failedOpen the full record to see the jobs.' && indigo.state === 'requested' && indigo.ok,
    `banner "${banner}" · requested ${indigo.state} indigo ${indigo.ok}`,
  )

  // 9. Enter on a cell opens Details; Back restores the current row. A double-click opens too.
  await clickRow(page, '80001204')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/oms\/delivery\/80001204$/, { timeout: 5000 }).catch(() => {})
  const enterUrl = new URL(page.url()).pathname
  await page.goBack()
  await page.waitForSelector('[data-inspector-row]', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(300)
  const restored = await where(page)
  check(
    `${label}: Enter on a cell opens Delivery details; Back restores the current row in the inspector`,
    enterUrl === '/oms/delivery/80001204' && restored.inspector === '80001204' && restored.selectedNo === '80001204',
    `Enter → ${enterUrl} · back: inspector ${restored.inspector}, selected ${restored.selectedNo}`,
  )
  // A column on screen (the far ones are virtualised away).
  await page
    .locator('.ag-row[row-index="2"] .ag-cell[col-id="documentNo"]')
    .first()
    .dblclick({ timeout: 5000 })
    .catch(() => {})
  await page.waitForURL(/\/oms\/delivery\/\d+$/, { timeout: 5000 }).catch(() => {})
  const dblUrl = new URL(page.url()).pathname
  if (dblUrl !== '/oms/deliveries') await page.goBack()
  await page.waitForSelector('[data-inspector-row]', { timeout: 10000 }).catch(() => {})
  check(`${label}: a double-click opens Delivery details`, /^\/oms\/delivery\/8000120\d$/.test(dblUrl), dblUrl)

  // Enter on a button stays the button's: the toggle folds the pane, the page stays.
  await page.locator('[data-inspector-toggle]').focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const onButton = await page.evaluate(() => ({
    path: location.pathname,
    pane: !!document.getElementById('delivery-inspector'),
    pressed: document.querySelector('[data-inspector-toggle]')?.getAttribute('aria-pressed'),
  }))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const back = await page.evaluate(() => !!document.getElementById('delivery-inspector'))
  check(
    `${label}: Enter on a button is the button's — the toggle folds and unfolds, no navigation`,
    onButton.path === '/oms/deliveries' && !onButton.pane && onButton.pressed === 'false' && back,
    `${onButton.path} · pane ${onButton.pane} · pressed ${onButton.pressed} · unfolded again ${back}`,
  )

  // 10. `I` folds and unfolds; folded, the grid takes the width back. The chevron folds too.
  const gridWidth = () => page.evaluate(() => document.querySelector('.ag-root-wrapper')?.getBoundingClientRect().width ?? 0)
  await clickRow(page, '80001204')
  const open = await gridWidth()
  const toggleTitle = await page.locator('[data-inspector-toggle]').getAttribute('title')
  const toggleKeys = await page.locator('[data-inspector-toggle]').getAttribute('aria-keyshortcuts')
  await page.keyboard.press('i')
  await page.waitForTimeout(300)
  const folded = { pane: await paneWidth(page), grid: await gridWidth() }
  await page.keyboard.press('i')
  await page.waitForTimeout(300)
  const unfolded = { pane: await paneWidth(page), grid: await gridWidth() }
  await page.locator('[data-inspector-collapse]').click()
  await page.waitForTimeout(200)
  const chevron = await paneWidth(page)
  await page.locator('[data-inspector-toggle]').click()
  await page.waitForTimeout(200)
  check(
    `${label}: I folds and unfolds the inspector; the grid takes its width back; the chevron folds it`,
    folded.pane === 0 &&
      folded.grid >= open + 360 &&
      unfolded.pane === 360 &&
      Math.abs(unfolded.grid - open) < 2 &&
      chevron === 0 &&
      (await paneWidth(page)) === 360 &&
      /Inspector \(⁨?I⁩?\)/.test(toggleTitle ?? '') &&
      toggleKeys === 'I',
    `grid ${open} → ${folded.grid} folded → ${unfolded.grid} · chevron ${chevron} · title "${toggleTitle}" · keys ${toggleKeys}`,
  )

  // 11. The separator, on the inline-start edge: keys, double-click, drag, then a reload.
  const sep = page.locator('[data-inspector-separator]')
  const edge = await page.evaluate(() => {
    const aside = document.getElementById('delivery-inspector').getBoundingClientRect()
    const s = document.querySelector('[data-inspector-separator]').getBoundingClientRect()
    const grid = document.querySelector('.ag-root-wrapper').getBoundingClientRect()
    return { sep: s.left + s.width / 2, start: aside.left, end: aside.right, paneLeftOfGrid: aside.right <= grid.left }
  })
  const onStartEdge = rtl
    ? Math.abs(edge.sep - edge.end) <= 1 && edge.paneLeftOfGrid
    : Math.abs(edge.sep - edge.start) <= 1 && !edge.paneLeftOfGrid
  const grow = rtl ? 'ArrowRight' : 'ArrowLeft'
  const shrink = rtl ? 'ArrowLeft' : 'ArrowRight'
  const steps = []
  const press = async (key) => {
    await page.keyboard.press(key)
    await page.waitForTimeout(80)
    const now = await paneWidth(page)
    const aria = await sep.getAttribute('aria-valuenow')
    steps.push(`${key}=${now}${String(now) === aria ? '' : ` (aria ${aria})`}`)
    return now
  }
  await sep.focus()
  const sepOk =
    (await press(grow)) === 376 &&
    (await press(shrink)) === 360 &&
    (await press('Home')) === 320 &&
    (await press('End')) === 560 &&
    (await press(shrink)) === 544 &&
    steps.every((s) => !s.includes('aria')) &&
    (await sep.getAttribute('aria-valuemin')) === '320' &&
    (await sep.getAttribute('aria-valuemax')) === '560'
  await sep.dblclick()
  await page.waitForTimeout(100)
  const reset = await paneWidth(page)
  check(
    `${label}: the separator sits on the inline-start edge; arrows step 16, Home/End, a double-click resets 360`,
    onStartEdge && sepOk && reset === 360,
    `on start edge ${onStartEdge} · ${steps.join(' ')} · double-click ${reset}`,
  )

  const box = await sep.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + 200)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + (rtl ? 100 : -100), box.y + 200, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  const dragged = await paneWidth(page)
  await page.reload()
  await page.waitForSelector('[data-inspector-empty]', { timeout: 15000 }).catch(() => {})
  const reloaded = await paneWidth(page)
  // J before any search: refused with its reason, never a dead key.
  await page.keyboard.press('j')
  const refusal = await page
    .locator('[data-sonner-toast]')
    .first()
    .textContent({ timeout: 3000 })
    .catch(() => null)
  await page.keyboard.press('i')
  await page.waitForTimeout(150)
  await page.reload()
  await page.waitForSelector('[data-inspector-toggle]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(200)
  const stayedFolded = (await paneWidth(page)) === 0
  const pressed = await page.locator('[data-inspector-toggle]').getAttribute('aria-pressed')
  await page.evaluate(() => localStorage.setItem('oms.deliveries.inspector.v1', '{"width":"wide",'))
  await page.reload()
  await page.waitForSelector('[data-inspector-empty]', { timeout: 15000 }).catch(() => {})
  const malformed = await paneWidth(page)
  check(
    `${label}: a drag resizes, and width and open/closed survive a reload; a malformed store reads 360, open`,
    dragged === 460 && reloaded === 460 && stayedFolded && pressed === 'false' && malformed === 360,
    `drag ${dragged} · reload ${reloaded} · folded after reload ${stayedFolded} (pressed ${pressed}) · malformed → ${malformed}`,
  )
  check(
    `${label}: J before a search toasts its reason`,
    (refusal ?? '').includes('There are no rows to step through yet'),
    `"${refusal}"`,
  )
}

// ----- 398: the lenses ----------------------------------------------------------------------

/** The rail's counts, in rail order, the active lens, the pill, the cut line and the rows shown. */
async function lensState(page) {
  return page.evaluate(() => ({
    counts: [...document.querySelectorAll('[data-views-rail] [data-lens]')].map((b) => [
      b.getAttribute('data-lens'),
      b.querySelector('[data-lens-count]')?.textContent ?? '',
    ]),
    active: document.querySelector('[data-views-rail] [data-lens][aria-current="true"]')?.getAttribute('data-lens'),
    pill: document.querySelector('[data-row-pill]')?.textContent ?? null,
    cut: document.querySelector('[data-cut-line]')?.textContent ?? null,
    shownNos: [...new Set([...document.querySelectorAll('.ag-row .ag-cell[col-id="deliveryNo"]')].map((c) => c.textContent.trim()))].sort(),
  }))
}

const countsText = (state) => state.counts.map(([, c]) => c).join(' ')

async function search(page) {
  await page.locator('[data-query-search]').click()
  await page.waitForTimeout(900)
}

/** Sets one criterion through its token — opened from + Filter when it is not in the bar yet. */
async function setCriterion(page, field, value) {
  const token = page.locator(`[data-query-token="${field}"] button[aria-haspopup]`)
  if (await token.count()) await token.click()
  else {
    await page.locator('[data-query-add]').click()
    await page.locator(`[data-query-entry="${field}"]`).click()
  }
  const control = page.locator(`[data-token-popover="${field}"]`).locator('input, select').first()
  if ((await control.evaluate((el) => el.tagName)) === 'SELECT') await control.selectOption(value)
  else await control.fill(value)
}

/** Drops a criterion with its token's ×. */
async function dropCriterion(page, field) {
  await page.locator(`[data-query-token="${field}"] [data-token-remove]`).click()
}

async function lensChecks({ page, label, theme, dir, requests }) {
  const rtl = dir === 'rtl'
  const listRequests = () => requests.filter((r) => r.startsWith('SdDocumentWeb/DeliveryDocumentList')).length

  // 12. The rail, before any search: inline-start edge, 220px, --card-2, every count "—".
  await page.reload()
  await page.waitForSelector('[data-views-rail]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(200)
  const rail = await page.evaluate(() => {
    const nav = document.querySelector('[data-views-rail]')
    const main = document.querySelector('main')?.getBoundingClientRect()
    const r = nav?.getBoundingClientRect()
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--card-2)'
    document.body.appendChild(probe)
    const want = getComputedStyle(probe).backgroundColor
    probe.remove()
    const style = nav ? getComputedStyle(nav) : null
    return {
      width: r?.width ?? 0,
      left: Math.round((r?.left ?? -1) - (main?.left ?? 0)),
      right: Math.round((main?.right ?? 0) - (r?.right ?? -1)),
      ground: style?.backgroundColor === want,
      endBorder: style ? parseFloat(document.dir === 'rtl' ? style.borderLeftWidth : style.borderRightWidth) : 0,
    }
  })
  const before = await lensState(page)
  check(
    `${label}: the 220px views rail sits flush at the inline-start edge on --card-2 with an inline-end border`,
    rail.width === 220 && (rtl ? rail.right === 0 : rail.left === 0) && rail.ground && rail.endBorder >= 1,
    JSON.stringify(rail),
  )
  check(
    `${label}: before a search every lens count reads "—", in rail order`,
    JSON.stringify(before.counts.map(([id]) => id)) ===
      JSON.stringify(['all', 'attention', 'cancelRequested', 'dawaaNow', 'rescheduled']) &&
      countsText(before) === '— — — — —' &&
      before.pill === null,
    `${countsText(before)} · pill ${before.pill}`,
  )

  // 13. After a search: counts are the loaded rows each lens matches.
  await search(page)
  const loaded = await lensState(page)
  const danger = await page.evaluate(() => {
    const el = document.querySelector('[data-lens="attention"] [data-lens-count]')
    const quiet = document.querySelector('[data-lens="all"] [data-lens-count]')
    const probe = document.createElement('div')
    probe.style.color = 'var(--danger-800)'
    document.body.appendChild(probe)
    const want = getComputedStyle(probe).color
    probe.remove()
    return { attention: getComputedStyle(el).color === want, all: getComputedStyle(quiet).color === want }
  })
  check(
    `${label}: after a search the counts are the loaded rows each lens matches; the pill reads "8 deliveries"`,
    countsText(loaded) === '8 1 1 1 1' && loaded.pill === '8 deliveries' && loaded.cut === null && loaded.active === 'all',
    `${countsText(loaded)} · pill "${loaded.pill}" · cut ${loaded.cut} · active ${loaded.active}`,
  )
  check(
    `${label}: Needs attention's count is danger ink while above 0, the others are not`,
    danger.attention && !danger.all,
    JSON.stringify(danger),
  )

  // 14. A lens narrows the grid with no request; the active row takes --primary-050 + --cursor.
  const reqBefore = listRequests()
  await page.locator('[data-lens="attention"]').click()
  await page.waitForTimeout(300)
  const attention = await lensState(page)
  const look = await page.evaluate(() => {
    const row = document.querySelector('[data-lens="attention"]')
    const bar = row?.querySelector('span[aria-hidden]')
    const tone = (expr) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = expr
      document.body.appendChild(probe)
      const v = getComputedStyle(probe).backgroundColor
      probe.remove()
      return v
    }
    const rr = row.getBoundingClientRect()
    const br = bar?.getBoundingClientRect()
    return {
      ground: getComputedStyle(row).backgroundColor === tone('var(--primary-050)'),
      bar: !!bar && getComputedStyle(bar).backgroundColor === tone('var(--cursor)') && Math.round(br.width) === 3,
      barAtStart: br ? (document.dir === 'rtl' ? Math.round(rr.right - br.right) : Math.round(br.left - rr.left)) : -1,
    }
  })
  await page.screenshot({ path: `${SHOTS}/lens-${theme}-${dir}.png` })
  await page.locator('[data-lens="rescheduled"]').click()
  await page.waitForTimeout(300)
  const rescheduled = await lensState(page)
  const reqAfter = listRequests()
  check(
    `${label}: clicking a lens narrows the grid with NO request and changes no count`,
    JSON.stringify(attention.shownNos) === '["80001203"]' &&
      attention.pill === '1 delivery' &&
      JSON.stringify(rescheduled.shownNos) === '["80001202"]' &&
      countsText(attention) === '8 1 1 1 1' &&
      reqAfter === reqBefore,
    `attention ${attention.shownNos} "${attention.pill}" · rescheduled ${rescheduled.shownNos} · requests ${reqBefore}→${reqAfter}`,
  )
  check(
    `${label}: the active lens takes the --primary-050 ground and a 3px --cursor bar on its inline-start edge`,
    attention.active === 'attention' && look.ground && look.bar && look.barAtStart === 0,
    JSON.stringify(look),
  )

  // 15. A column filter: "N of M shown" + Clear grid filters; the counts stay.
  await page.locator('[data-lens="all"]').click()
  const statusFilter = page.locator('.ag-floating-filter[col-id="status"] input')
  await statusFilter.fill('cancel')
  await page.waitForTimeout(1200)
  const filtered = await lensState(page)
  const clear = await page.locator('[data-clear-grid-filters]').count()
  const shownIsolates = await page.evaluate(() =>
    [...document.querySelectorAll('[data-row-pill] bdi[dir="ltr"]')].map((b) => b.textContent),
  )
  await page.locator('[data-clear-grid-filters]').click().catch(() => {})
  await page.waitForTimeout(600)
  const cleared = await lensState(page)
  const clearGone = (await page.locator('[data-clear-grid-filters]').count()) === 0
  check(
    `${label}: a column filter shows "3 of 8 shown" + Clear grid filters and changes no count; Clear restores "8 deliveries"`,
    filtered.pill === '3 of 8 shown' &&
      JSON.stringify(shownIsolates) === '["3","8"]' &&
      clear === 1 &&
      countsText(filtered) === '8 1 1 1 1' &&
      cleared.pill === '8 deliveries' &&
      clearGone,
    `"${filtered.pill}" (${shownIsolates}) · clear ${clear} · ${countsText(filtered)} · after "${cleared.pill}"`,
  )

  // 16. A lens with no loaded rows: its empty state over a still-mounted grid.
  await setCriterion(page, 'storeCode', '1017')
  await search(page)
  await page.locator('[data-lens="attention"]').click()
  await page.waitForTimeout(400)
  const empty = await page.evaluate(() => ({
    text: document.querySelector('[data-lens-empty]')?.textContent ?? null,
    grid: !!document.querySelector('.ag-root'),
    agOverlay: [...document.querySelectorAll('.ag-overlay-wrapper')].some((o) => o.offsetParent !== null && o.textContent.trim() !== ''),
    attentionCount: document.querySelector('[data-lens="attention"] [data-lens-count]')?.textContent,
  }))
  check(
    `${label}: a lens with no loaded rows shows "No loaded rows match this lens" over a still-mounted grid`,
    empty.text === 'No loaded rows match this lens' && empty.grid && !empty.agOverlay && empty.attentionCount === '0',
    JSON.stringify(empty),
  )
  await page.screenshot({ path: `${SHOTS}/lens-empty-${theme}-${dir}.png` })
  await page.locator('[data-lens="all"]').click()
  await dropCriterion(page, 'storeCode')

  // 17. A full page (rows = Limit): "N+" on every lens and the cut-off line.
  await setCriterion(page, 'limit', '8')
  await search(page)
  const cut = await lensState(page)
  const plus = await page.evaluate(() => {
    const bdi = document.querySelector('[data-lens="all"] [data-lens-count] bdi')
    return {
      dir: bdi?.getAttribute('dir'),
      text: bdi?.textContent,
      clean: ![...document.querySelectorAll('[data-views-rail], [data-row-summary]')].some((n) => /[\u2066-\u2069]/.test(n.textContent)),
    }
  })
  check(
    `${label}: a Limit-hit search reads "N+" on every lens, "8+ deliveries" and the cut-off line`,
    countsText(cut) === '8+ 1+ 1+ 1+ 1+' &&
      cut.pill === '8+ deliveries' &&
      cut.cut === 'Showing the newest 8, there may be more. Narrow the search or raise the limit.',
    `${countsText(cut)} · "${cut.pill}" · "${cut.cut}"`,
  )
  check(
    `${label}: "8+" is one ltr isolate with no invisible isolate characters`,
    plus.dir === 'ltr' && plus.text === '8+' && plus.clean,
    JSON.stringify(plus),
  )
  await page.screenshot({ path: `${SHOTS}/lens-cut-${theme}-${dir}.png` })
  // A lower bound reads plural whatever its number.
  await page.locator('[data-lens="rescheduled"]').click()
  await page.waitForTimeout(300)
  const cutOne = await lensState(page)
  check(`${label}: a lower bound of one reads "1+ deliveries"`, cutOne.pill === '1+ deliveries', `"${cutOne.pill}"`)
  await page.locator('[data-lens="all"]').click()

  // 18. The palette: "Show: Needs attention" applies the lens, with no key and no request.
  const reqPalette = listRequests()
  await page.locator('[data-lens="all"]').focus()
  await page.keyboard.press('Control+k')
  await page.waitForSelector('[data-palette-input]', { timeout: 5000 }).catch(() => {})
  const rowsListed = await page.evaluate(() =>
    ['all', 'attention', 'cancelRequested', 'dawaaNow', 'rescheduled'].map((id) => {
      const row = document.querySelector(`[data-palette-row="screen:lens.${id}"]`)
      return row ? `${row.textContent.trim()}|${row.querySelectorAll('kbd').length}` : null
    }),
  )
  await page.locator('[data-palette-input]').fill('Show: Needs attention')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const viaPalette = await lensState(page)
  check(
    `${label}: each lens is a "Show: ‹lens›" row in This screen with no key`,
    rowsListed.every((r) => r && r.startsWith('Show: ') && r.endsWith('|0')) &&
      rowsListed[1].startsWith('Show: Needs attention'),
    rowsListed.join(' · '),
  )
  check(
    `${label}: "Show: Needs attention" from Ctrl+K applies the lens with no request`,
    viaPalette.active === 'attention' && JSON.stringify(viaPalette.shownNos) === '["80001203"]' && listRequests() === reqPalette,
    `active ${viaPalette.active} · ${viaPalette.shownNos} · requests ${reqPalette}→${listRequests()}`,
  )
}

// ----- 399: the query bar --------------------------------------------------------------------

/** The bar as it reads: its tokens in order, the note, the dot and the open popover. */
async function barState(page) {
  return page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.borderColor = 'var(--attention)'
    document.body.appendChild(probe)
    const amber = getComputedStyle(probe).borderTopColor
    probe.remove()
    const tokens = [...document.querySelectorAll('[data-query-bar] [data-query-token]')].map((t) => {
      const style = getComputedStyle(t.firstElementChild)
      const value = t.querySelector('[data-token-value]')
      return {
        field: t.getAttribute('data-query-token'),
        state: t.getAttribute('data-token-state'),
        text: t.querySelector('button[aria-haspopup]')?.textContent.trim() ?? '',
        value: value?.textContent.trim() ?? '',
        dashedAmber: style.borderTopStyle === 'dashed' && style.borderTopColor === amber,
        struck: !!value && getComputedStyle(value).textDecorationLine.includes('line-through'),
        removable: !!t.querySelector('[data-token-remove]'),
        restorable: !!t.querySelector('[data-token-restore]'),
      }
    })
    return {
      tokens,
      note: document.querySelector('[data-pending-note]')?.textContent.trim() ?? '',
      dot: !!document.querySelector('[data-query-search] [data-pending-dot]'),
      popover: document.querySelector('[data-token-popover]')?.getAttribute('data-token-popover') ?? null,
    }
  })
}

const tokenOf = (state, field) => state.tokens.find((t) => t.field === field)
/** A local calendar day, `offset` days back — the drive and the browser share the machine's zone. */
const localDay = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function queryChecks({ page, label, theme, dir, requests }) {
  const rtl = dir === 'rtl'
  const listCalls = () => requests.filter((r) => r.startsWith('SdDocumentWeb/DeliveryDocumentList'))

  // 19. Before a search: the bar heads the centre column, holding the Limit alone, then Search.
  await page.reload()
  await page.waitForSelector('[data-query-bar]', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(200)
  const layout = await page.evaluate(() => {
    const bar = document.querySelector('[data-query-bar]')?.getBoundingClientRect()
    const title = document.querySelector('main h1')?.getBoundingClientRect()
    const searchBtn = document.querySelector('[data-query-search]')?.getBoundingClientRect()
    const add = document.querySelector('[data-query-add]')?.getBoundingClientRect()
    return {
      above: !!bar && !!title && bar.bottom <= title.top,
      searchAtEnd: !!searchBtn && !!add && (document.dir === 'rtl' ? searchBtn.right < add.left : searchBtn.left > add.right),
      searchName: document.querySelector('[data-query-search]')?.textContent.trim(),
    }
  })
  const blank = await barState(page)
  check(
    `${label}: before a search the bar heads the centre column with "Limit: 200" alone, no ×, and Search at the inline end`,
    layout.above &&
      layout.searchAtEnd &&
      layout.searchName === 'Search' &&
      blank.tokens.length === 1 &&
      blank.tokens[0].text === 'Limit:200' &&
      !blank.tokens[0].removable &&
      blank.note === '' &&
      !blank.dot,
    `${JSON.stringify(layout)} · ${JSON.stringify(blank.tokens)} · note "${blank.note}" · dot ${blank.dot}`,
  )

  // 20. + Filter: the 14 criteria as 13 entries in four groups, the Limit "in search".
  await page.locator('[data-query-add]').click()
  await page.waitForSelector('[data-query-menu]', { timeout: 3000 }).catch(() => {})
  const menu = await page.evaluate(() => ({
    title: document.querySelector('[data-query-menu]')?.firstElementChild?.textContent.trim(),
    groups: [...document.querySelectorAll('[data-query-menu] [data-query-group]')].map((g) => [
      g.getAttribute('aria-label'),
      [...g.querySelectorAll('[data-query-entry]')].map((e) => e.textContent.trim()),
    ]),
    focused: document.activeElement?.getAttribute('data-query-entry'),
  }))
  check(
    `${label}: + Filter lists all 14 criteria in When · Find one · Narrow · Rows, the Limit "in search"`,
    menu.title === 'All 14 search criteria' &&
      JSON.stringify(menu.groups) ===
        JSON.stringify([
          ['When', ['Date']],
          ['Find one', ['Delivery no.', 'Document no.', 'Order no.', 'Mobile']],
          ['Narrow', ['Store', 'Document type', 'Source', 'Delivery doc. type', 'Delivery type', 'Dawaa Now', 'Reason']],
          ['Rows', ['Limitin search']],
        ]) &&
      menu.focused === 'date',
    JSON.stringify(menu),
  )
  await page.screenshot({ path: `${SHOTS}/query-menu-${theme}-${dir}.png` })
  await page.keyboard.press('Escape')
  const escBack = await page.evaluate(() => ({
    menu: !!document.querySelector('[data-query-menu]'),
    focus: document.activeElement?.hasAttribute('data-query-add'),
  }))
  check(`${label}: Esc closes + Filter and hands focus back to it`, !escBack.menu && escBack.focus, JSON.stringify(escBack))

  // 21. An added Date and Store: dashed amber, "2 changes not searched", the amber dot.
  await setCriterion(page, 'date', 'last3')
  await setCriterion(page, 'storeCode', '1017')
  await page.locator('[data-token-popover="storeCode"] [data-token-done]').click()
  const added = await barState(page)
  check(
    `${label}: an added token is dashed amber, the note reads "2 changes not searched" and Search carries the dot`,
    tokenOf(added, 'date')?.text === 'Date:Last 3 days' &&
      tokenOf(added, 'storeCode')?.state === 'added' &&
      tokenOf(added, 'storeCode')?.dashedAmber &&
      tokenOf(added, 'date')?.dashedAmber &&
      added.note === '2 changes not searchedDiscard' &&
      added.dot &&
      added.popover === null,
    `${JSON.stringify(added.tokens)} · note "${added.note}" · dot ${added.dot}`,
  )
  const storeValue = await page.evaluate(() => {
    const bdi = document.querySelector('[data-query-token="storeCode"] [data-token-value] bdi')
    return {
      dir: bdi?.getAttribute('dir'),
      mono: !!bdi && /Plex Mono/.test(getComputedStyle(bdi).fontFamily),
      text: bdi?.textContent,
      clean: !/[⁦-⁩]/.test(document.querySelector('[data-query-bar]')?.textContent ?? ''),
    }
  })
  check(
    `${label}: the Store value is mono and one ltr isolate, with no invisible isolate characters in the bar`,
    storeValue.dir === 'ltr' && storeValue.mono && storeValue.text === '1017' && storeValue.clean,
    JSON.stringify(storeValue),
  )

  // 22. Search: one request, the relative Date resolved to today-2..today, nothing pending after.
  const before = listCalls().length
  await search(page)
  const ran = listCalls().slice(before)
  const params = new URLSearchParams((ran[0] ?? '').split('?')[1] ?? '')
  const applied = await barState(page)
  check(
    `${label}: Search sends "Last 3 days" as FromDate ${localDay(2)} / ToDate ${localDay(0)} with the Store`,
    ran.length === 1 &&
      params.get('FromDate') === localDay(2) &&
      params.get('ToDate') === localDay(0) &&
      params.get('StoreCode') === '1017' &&
      params.get('Limit') === '200',
    ran.join(' | '),
  )
  check(
    `${label}: after Search the tokens are applied, the Date still reads "Last 3 days", and nothing is flagged`,
    applied.tokens.every((t) => t.state === 'applied' && !t.dashedAmber) &&
      tokenOf(applied, 'date')?.value === 'Last 3 days' &&
      applied.note === '' &&
      !applied.dot,
    `${JSON.stringify(applied.tokens.map((t) => [t.field, t.state, t.value]))} · note "${applied.note}"`,
  )

  // 23. Done closes without searching; the edit is flagged.
  const beforeDone = listCalls().length
  await setCriterion(page, 'storeCode', '1002')
  await page.locator('[data-token-popover="storeCode"] [data-token-done]').click()
  await page.waitForTimeout(300)
  const edited = await barState(page)
  check(
    `${label}: Done closes the popover with no request; the edited Store is dashed amber, "1 change not searched"`,
    listCalls().length === beforeDone &&
      edited.popover === null &&
      tokenOf(edited, 'storeCode')?.state === 'edited' &&
      tokenOf(edited, 'storeCode')?.dashedAmber &&
      edited.note.startsWith('1 change not searched') &&
      edited.dot,
    `${listCalls().length - beforeDone} requests · ${JSON.stringify(tokenOf(edited, 'storeCode'))} · "${edited.note}"`,
  )

  // 24. × leaves a struck ghost with a restore; restore and Discard both go back.
  await dropCriterion(page, 'date')
  const ghost = await barState(page)
  check(
    `${label}: × leaves the Date as a struck ghost with a restore, "2 changes not searched"`,
    tokenOf(ghost, 'date')?.state === 'ghost' &&
      tokenOf(ghost, 'date')?.struck &&
      tokenOf(ghost, 'date')?.dashedAmber &&
      tokenOf(ghost, 'date')?.restorable &&
      !tokenOf(ghost, 'date')?.removable &&
      ghost.note.startsWith('2 changes not searched'),
    `${JSON.stringify(tokenOf(ghost, 'date'))} · "${ghost.note}"`,
  )
  await page.screenshot({ path: `${SHOTS}/query-pending-${theme}-${dir}.png` })
  await page.locator('[data-query-token="date"] [data-token-restore]').click()
  const restored = await barState(page)
  await page.locator('[data-query-discard]').click()
  const discarded = await barState(page)
  check(
    `${label}: restore brings the Date back; Discard restores the last-run criteria and clears every flag`,
    tokenOf(restored, 'date')?.state === 'applied' &&
      restored.note.startsWith('1 change not searched') &&
      tokenOf(discarded, 'storeCode')?.value === '1017' &&
      discarded.tokens.every((t) => t.state === 'applied') &&
      discarded.note === '' &&
      !discarded.dot &&
      listCalls().length === beforeDone,
    `restored "${restored.note}" · ${JSON.stringify(discarded.tokens.map((t) => [t.field, t.state, t.value]))} · "${discarded.note}"`,
  )

  // 25. Enter in a token popover searches — and does NOT open Delivery details, though a row is current.
  await clickRow(page, '80001201')
  const current = await where(page)
  await page.locator('[data-query-token="storeCode"] button[aria-haspopup]').click()
  await page.locator('[data-token-popover="storeCode"] input').fill('1002')
  const beforeEnter = listCalls().length
  await page.keyboard.press('Enter')
  await page.waitForTimeout(900)
  const enterRan = listCalls().slice(beforeEnter)
  const afterEnter = await barState(page)
  const path = new URL(page.url()).pathname
  const focusAfter = await page.evaluate(
    () => document.activeElement?.closest('[data-query-token]')?.getAttribute('data-query-token') ?? null,
  )
  check(
    `${label}: Enter in a token popover searches once, with the value just typed, and stays on the list`,
    current.inspector === '80001201' &&
      enterRan.length === 1 &&
      /StoreCode=1002/.test(enterRan[0]) &&
      path === '/oms/deliveries' &&
      afterEnter.popover === null &&
      afterEnter.note === '' &&
      focusAfter === 'storeCode',
    `current ${current.inspector} · ${enterRan.join(' | ')} · at ${path} · popover ${afterEnter.popover} · "${afterEnter.note}" · focus ${focusAfter}`,
  )

  // 25b. A search that fails is not a search that ran: its edit stays flagged, and Discard goes
  // back to the criteria that last came back. (A business refusal, so no console error.)
  await page.route(
    '**/api/SdDocumentWeb/DeliveryDocumentList**',
    (route) => route.fulfill(envelope(null, { success: false, message: 'Refused in this drive' })),
    { times: 1 },
  )
  await setCriterion(page, 'storeCode', '9999')
  await search(page)
  const failed = await barState(page)
  const failedCard = await page.evaluate(() => !!document.querySelector('main [role="alert"]'))
  await page.locator('[data-query-discard]').click()
  const afterFail = await barState(page)
  check(
    `${label}: a failed search keeps its edit flagged; Discard goes back to the search that came back`,
    failedCard &&
      tokenOf(failed, 'storeCode')?.state === 'edited' &&
      failed.note.startsWith('1 change not searched') &&
      failed.dot &&
      tokenOf(afterFail, 'storeCode')?.value === '1002' &&
      afterFail.note === '',
    `card ${failedCard} · ${JSON.stringify(tokenOf(failed, 'storeCode'))} · "${failed.note}" · after Discard ${tokenOf(afterFail, 'storeCode')?.value}`,
  )
  await search(page)
  await page.waitForSelector('.ag-center-cols-container .ag-row', { timeout: 10000 }).catch(() => {})

  // 26. The Limit: always shown, editable, never removable.
  await setCriterion(page, 'limit', '30')
  const limitEdit = await barState(page)
  await page.screenshot({ path: `${SHOTS}/query-edit-${theme}-${dir}.png` })
  await page.keyboard.press('Escape')
  check(
    `${label}: the Limit token edits in place (dashed amber at 30) and has no ×`,
    tokenOf(limitEdit, 'limit')?.text === 'Limit:30' &&
      tokenOf(limitEdit, 'limit')?.state === 'edited' &&
      tokenOf(limitEdit, 'limit')?.dashedAmber &&
      !tokenOf(limitEdit, 'limit')?.removable,
    JSON.stringify(tokenOf(limitEdit, 'limit')),
  )
  await page.locator('[data-query-discard]').click()

  // 27. `/` from a grid cell focuses + Filter, and the press is prevented (Firefox's quick-find).
  await clickRow(page, '80001202')
  await page.evaluate(() => {
    window.__slash = null
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Slash') window.__slash = e.defaultPrevented
    })
  })
  await page.keyboard.press('Slash')
  const slash = await page.evaluate(() => ({
    focus: document.activeElement?.hasAttribute('data-query-add') ?? false,
    prevented: window.__slash,
    shortcut: document.querySelector('[data-query-add]')?.getAttribute('aria-keyshortcuts'),
  }))
  check(
    `${label}: / from a grid cell focuses + Filter, prevented`,
    slash.focus && slash.prevented === true && slash.shortcut === '/',
    JSON.stringify(slash),
  )

  // 28. Back from Delivery details restores the search: the same tokens, nothing pending.
  const tokensBefore = (await barState(page)).tokens.map((t) => t.text)
  await clickRow(page, '80001204')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/oms\/delivery\/\d+$/, { timeout: 5000 }).catch(() => {})
  const away = new URL(page.url()).pathname
  await page.goBack()
  await page.waitForSelector('[data-query-bar]', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(400)
  const back = await barState(page)
  check(
    `${label}: Back from Delivery details restores the tokens with nothing pending`,
    away !== '/oms/deliveries' &&
      JSON.stringify(back.tokens.map((t) => t.text)) === JSON.stringify(tokensBefore) &&
      back.note === '' &&
      !back.dot,
    `${away} · ${back.tokens.map((t) => t.text).join(' | ')} vs ${tokensBefore.join(' | ')}`,
  )
  if (rtl) await page.screenshot({ path: `${SHOTS}/query-rtl-${theme}.png` })
}

for (const theme of ['light', 'dark']) {
  for (const dir of ['ltr', 'rtl']) await drive({ theme, dir })
}

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
