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
  ...over,
})

// One row per state, keyed by delivery no. `dot` is the dot's token, `ink` the word's.
const CASES = [
  { no: '80001201', word: 'Created', key: 'created', dot: '--ink-3', ink: '--muted-foreground', over: {} },
  { no: '80001202', word: 'Ready', key: 'ready', dot: '--ink-3', ink: '--muted-foreground', over: { readyStatus: 'R', rescheduled: true, rescheduledTime: '2026-10-02T15:30:00' } },
  { no: '80001203', word: 'Out for delivery', key: 'out', dot: '--primary', ink: '--primary', over: { readyStatus: 'R', deliveryStatus: 'O', outForDeliveryTime: '2026-10-02T17:12:00' } },
  { no: '80001204', word: 'Delivered', key: 'delivered', dot: '--success', ink: '--success-800', over: { readyStatus: 'C', deliveryStatus: 'D', actualDeliveryTime: '2026-10-02T18:05:00' } },
  { no: '80001205', word: 'Cancellation requested', key: 'requested', dot: '--fam-cancel-request', ink: '--fam-cancel-request', over: { readyStatus: 'R', closeStatus: 'R' } },
  { no: '80001206', word: 'Cancelled', key: 'cancelled', dot: '--danger', ink: '--danger-800', over: { readyStatus: 'C', deliveryStatus: 'D', closeStatus: 'X' } },
  // Pick-in-store, ready: no Out step, still reads Ready. The list sends the description.
  { no: '80001207', word: 'Ready', key: 'ready', dot: '--ink-3', ink: '--muted-foreground', over: { deliveryType: 'PickInStore', readyStatus: 'R' } },
  // Closed (C) by the worker while out for delivery.
  { no: '80001208', word: 'Cancelled', key: 'cancelled', dot: '--danger', ink: '--danger-800', over: { readyStatus: 'R', deliveryStatus: 'O', closeStatus: 'C' } },
]

const ARABIC_NAME = 'نورة الحربي'

const rows = (dir) =>
  CASES.map((c, i) =>
    ROW({
      deliveryNo: c.no,
      documentNo: String(1000000401 + i),
      orderNo: String(900101 + i),
      ...(dir === 'rtl' && i % 2 === 0 ? { customerName: ARABIC_NAME } : {}),
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
  if (path === 'SdDocumentWeb/DeliveryDocumentList') return route.fulfill(envelope(rows(dir)))
  if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path))
    return route.fulfill(envelope([]))
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

  await page.goto(BASE + '/oms/deliveries')
  await page.waitForSelector('.ag-root', { timeout: 20000 }).catch(() => {})
  await page.getByRole('button', { name: /load/i }).first().click().catch(() => {})
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

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

for (const theme of ['light', 'dark']) {
  for (const dir of ['ltr', 'rtl']) await drive({ theme, dir })
}

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
