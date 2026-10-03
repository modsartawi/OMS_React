// Delivery details facts-column drive (spec 380 D4, ticket 404; ruling 371 §3).
//
// Drives the REAL app in Chromium. The headers are the ticket-078 live captures, patched only
// where a case needs a state no capture holds (a prescription, four lines with a deleted one,
// two header conditions, the order's files); only the wire is stubbed.
//
// In light and dark, LTR and RTL (`oms.locale = 'ar'` sets `dir="rtl"`; there is no Arabic locale
// file, so the copy stays English and the stub ROWS carry the Arabic), at 1280 and at 1440, it
// asserts:
//   1. there are no tabs and no 340px summary rail: the page is two columns, the spine at the
//      inline start and the facts column at the inline end, side by side;
//   2. a full delivery draws all five blocks in order (Customer · Prescription (e-Rx) ·
//      Fulfilment · Driver & tracking · Payment) with the rows `railCards` gives; a sparse one
//      draws only Customer · Fulfilment · Payment, its blank rows omitted, never an em dash;
//   3. each value isolated by kind (a figure or a code `Ltr`, free text a dir-auto <bdi>), and
//      reading left-to-right under RTL; IDs in Plex Mono, money in Sans; label then value in the
//      reading direction;
//   4. Items is headed with its count and the grid is SIZED TO ITS ROWS: no empty floor under
//      the last line, on four lines and on one; a deleted line is struck; the totals footer pins;
//   5. Pricing conditions is a folded disclosure showing its count (isolated), and expands to
//      its grid;
//   6. the Attachments door survives: a disclosure with its file count, and the Prescription
//      block's Files · 3 · Show opens it, moves focus to it, and reads the files once;
//   7. a cancelled delivery keeps 083 D-10's evidence-only command bar: every command drawn;
//   8. no raw t() key and no page error.
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/document-facts-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
const SHOTS = 'tools/.document-facts-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', siblings = {} } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data, ...siblings }),
})

const CAPTURES = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  CAPTURES[capture.data.documentNo] = capture.data
}

const ARABIC_NAME = 'محمد سرطاوي'
const ARABIC_CITY = 'الدمام - الدباب'
const ORDER = '2000000551'

/** The cases, keyed by number. `dir` lets the RTL pass carry Arabic rows. */
function cases(dir) {
  const rtl = dir === 'rtl'
  const base = CAPTURES['8000000121']
  const line = base.lines[0]
  const D = '2026-10-02T'
  const full = {
    ...base,
    documentNo: '8000000300',
    customer: { ...base.customer, customerName: rtl ? ARABIC_NAME : base.customer.customerName },
    shippingAddress: { ...base.shippingAddress, cityName: rtl ? ARABIC_CITY : base.shippingAddress.cityName },
    deliveryScheduleFromTime: `${D}10:00:00`,
    deliveryScheduleToTime: `${D}12:00:00`,
    approvalNumber: 'c9364852',
    patientId: '1197634478',
    clinicianName: 'Dr. Demo Clinician',
    referenceErx: 'ERX-778104',
    status: { ...base.status, readyStatus: 'R', deliveryStatus: 'O', closeStatus: '', lastAction: 'DOFD' },
    lines: [
      line,
      { ...line, lineNumber: 2, itemNumber: '200707', itemDescription: 'Travel care kit — demo', quantity: 1, unitPrice: 27.5, discount: -1.5, grossAmount: 27.5, vatAmount: 3.9, netAmount: 29.9 },
      { ...line, lineNumber: 3, itemNumber: '200708', itemDescription: 'Cotton pads — demo', quantity: 2, unitPrice: 10, grossAmount: 20, vatAmount: 3, netAmount: 23, deleted: true },
      { ...line, lineNumber: 4, itemNumber: '300114', itemDescription: 'Prescription syrup 100 ml — demo', quantity: 1, unitPrice: 14.72, grossAmount: 14.72, vatAmount: 2.21, netAmount: 16.93 },
    ],
    conditions: [
      ...base.conditions,
      { ...base.conditions[0], stepNumber: 312, condType: 'HDIS', conditionDescription: 'Header discount', condAmount: -5, cardType: '', paymentMethod: '', referenceNumber: '' },
    ],
    attachmentOwnerNo: ORDER,
    attachmentCategory: 'P2E',
    attachmentCount: 3,
  }
  const sparseBase = CAPTURES['8000000253']
  const sparse = {
    ...sparseBase,
    customer: { ...sparseBase.customer, customerPhone: '', customerId: '' },
    customerId: '',
    shippingAddress: null,
    note: '',
    courierCode: '',
    courierDriverName: '',
    courierDriverPhone: '',
    trackingId: '',
    trackingUrl: '',
  }
  const cancelled = {
    ...full,
    documentNo: '8000000902',
    status: { ...full.status, deliveryStatus: '', closeStatus: 'C', lastAction: 'DCLS' },
  }
  return { '8000000300': full, [sparse.documentNo]: sparse, '8000000902': cancelled }
}

const STORED = ['rx-front.jpg', 'rx-back.jpg', 'altibbi.pdf'].map((fileName, i) => ({
  attachmentId: `01K61A00000000000000000${i}AB`,
  status: 'STORED',
  ownerKind: 'SD_DOCUMENT',
  ownerKey: ORDER,
  category: 'P2E',
  kind: 'PRESCRIPTION',
  fileName,
  sizeBytes: 4096,
  storedAt: `2026-09-26T10:1${i}:44`,
  sourceDevice: 'P001-01',
  uploadedBy: '20145',
  caption: '',
  storeCode: 'P001',
}))

/** Read a value's VISUAL order off character rects: > 0 means it reads left-to-right on screen. */
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

/** Resolve a token to the computed value of a property, through a throwaway probe. */
const RESOLVE = (prop, expr) => {
  const probe = document.createElement('div')
  probe.style[prop] = expr
  document.body.appendChild(probe)
  const v = getComputedStyle(probe)[prop]
  probe.remove()
  return v
}

/** An items or conditions grid's height facts: is the body exactly its rows tall? */
const GRID_FIT = (root) => {
  // AG Grid 36's own structure: the body is `.ag-grid-scrolling-rows`, its lines are the rows of
  // `.ag-grid-scrolling-container`, the totals sit in `.ag-grid-pinned-bottom-rows-container`.
  const body = root.querySelector('.ag-grid-scrolling-rows')
  root.scrollIntoView({ block: 'center' })
  const rows = [...body.querySelectorAll('.ag-grid-scrolling-container > .ag-row')]
  const pinned = root.querySelector('.ag-grid-pinned-bottom-rows-container')
  const pinnedRows = pinned ? [...pinned.querySelectorAll(':scope > .ag-row')] : []
  const lastRow = rows.reduce((max, r) => Math.max(max, r.getBoundingClientRect().bottom), 0)
  const bodyBox = body.getBoundingClientRect()
  // Nothing lies over the last line: the point just above its bottom edge is one of its cells
  // (an overlay scrollbar laid over the body would answer here instead).
  const last = rows.at(-1)?.getBoundingClientRect()
  const hit = last ? document.elementFromPoint((bodyBox.left + bodyBox.right) / 2, last.bottom - 3) : null
  const hscroll = root.querySelector('.ag-body-horizontal-scroll')?.getBoundingClientRect()
  return {
    lastLineUncovered: !!hit?.closest('.ag-row'),
    // The scrollbar's lane, when it has one, lies inside the grid's frame.
    scrollInFrame: !hscroll || hscroll.height === 0 || hscroll.bottom <= root.getBoundingClientRect().bottom + 1,
    rows: rows.length,
    rowHeight: rows[0] ? Math.round(rows[0].getBoundingClientRect().height) : 0,
    bodyHeight: Math.round(bodyBox.height),
    // The space between the last line's bottom and the body's bottom (the "floor").
    floor: Math.round(bodyBox.bottom - lastRow),
    pinnedRows: pinnedRows.length,
    pinnedGap: pinnedRows[0] ? Math.round(pinnedRows[0].getBoundingClientRect().top - lastRow) : null,
  }
}

const ISOLATE_CHARS = /[\u2066-\u2069\u200e\u200f]/

const browser = await chromium.launch()

async function drive({ theme, dir, width }) {
  const label = `${theme}/${dir}@${width}`
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width, height: 1000 } })
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
  await page.addInitScript(
    `window.READS_LTR = ${READS_LTR.toString()}; window.RESOLVE = ${RESOLVE.toString()}; window.GRID_FIT = ${GRID_FIT.toString()}`,
  )
  const CASES = cases(dir)
  let byOwnerCalls = 0
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    if (/\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    if (p === 'AttachmentWeb/Access') return route.fulfill(envelope({ categories: ['P2E', 'ALTIBBI'], withdrawCategories: [] }))
    if (p === 'AttachmentWeb/ByOwner') {
      byOwnerCalls += 1
      return route.fulfill(envelope(STORED, { siblings: { withdrawn: [], withdrawReasons: [] } }))
    }
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(CASES[doc[1]] ?? CAPTURES[doc[1]] ?? null))
    return route.fulfill(envelope({}))
  })

  const facts = () => page.locator('[aria-label="Document facts"]')
  const open = async (no) => {
    await page.goto(`${BASE}/oms/delivery/${no}`)
    await facts().waitFor({ timeout: 20000 })
    await page.locator('#doc-items .ag-row').first().waitFor({ timeout: 20000 })
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(250)
  }
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${theme}-${dir}-${width}-${name}.png`, fullPage: true })

  // ── 1: two columns, no tabs, no summary rail ─────────────────────────────────────────────────
  await open('8000000300')
  const commandsOf = () =>
    page.evaluate(() => [...document.querySelectorAll('[data-command]')].map((b) => b.getAttribute('data-command')))
  const fullBar = await commandsOf()
  const layout = await page.evaluate((rtl) => {
    const spine = document.querySelector('[data-spine]').getBoundingClientRect()
    const column = document.querySelector('[aria-label="Document facts"]').parentElement.getBoundingClientRect()
    return {
      tabs: document.querySelectorAll('[role="tablist"], [role="tab"], [role="tabpanel"]').length,
      summaryRail: document.querySelectorAll('[aria-label="Document summary"]').length,
      sameTop: Math.abs(spine.top - column.top) < 2,
      beside: rtl ? spine.left >= column.right - 1 : spine.right <= column.left + 1,
      spineWidth: Math.round(spine.width),
      columnWidth: Math.round(column.width),
    }
  }, rtl)
  check(`${label}: no tabs and no summary rail`, layout.tabs === 0 && layout.summaryRail === 0, JSON.stringify(layout))
  check(
    `${label}: the spine at the inline start (${rtl ? 'right' : 'left'}), the facts column beside it at the end`,
    layout.sameTop && layout.beside && layout.spineWidth >= 340 && layout.spineWidth <= 420 && layout.columnWidth > 600,
    `spine ${layout.spineWidth}px, facts ${layout.columnWidth}px`,
  )

  // ── 2–3: the five blocks, their rows, their isolates ─────────────────────────────────────────
  const readBlocks = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-facts-block]')].map((b) => ({
        key: b.getAttribute('data-facts-block'),
        title: b.querySelector('h3').textContent,
        rows: [...b.querySelectorAll('dd[data-fact]')].map((dd) => dd.getAttribute('data-fact')),
      })),
    )
  const blocks = await readBlocks()
  check(
    `${label}: a full delivery draws all five blocks, in order`,
    blocks.map((b) => b.title).join(' · ') === 'Customer · Prescription (e-Rx) · Fulfilment · Driver & tracking · Payment',
    blocks.map((b) => b.title).join(' · '),
  )
  const expectedRows = {
    customer: 'name,mobile,loyaltyId,city',
    prescription: 'approvalNumber,patientId,clinicianName,referenceErx,files',
    fulfilment: 'deliveryType,store,window,note',
    driver: 'courierCode,courierDriverName,courierDriverPhone,courierDriverApproved,trackingId',
    payment: 'instrument,deliveryFees,paidAmount,amountDue,netTotal',
  }
  check(
    `${label}: each block carries the rows railCards gives it`,
    blocks.every((b) => b.rows.join(',') === expectedRows[b.key]),
    blocks.map((b) => `${b.key}=${b.rows.join(',')}`).join(' | '),
  )
  const kinds = await page.evaluate(() => {
    const dd = (key) => document.querySelector(`dd[data-fact="${key}"]`)
    const kind = (key) => {
      const iso = dd(key).querySelector('bdi')
      return iso ? (iso.getAttribute('dir') === 'ltr' ? 'ltr' : 'auto') : 'none'
    }
    const mono = (key) => /Plex Mono/i.test(getComputedStyle(dd(key)).fontFamily)
    const row = (key) => {
      const v = dd(key).getBoundingClientRect()
      const l = dd(key).previousElementSibling.getBoundingClientRect()
      return { labelX: l.left, valueX: v.left }
    }
    return {
      ltr: ['mobile', 'loyaltyId', 'approvalNumber', 'store', 'window', 'courierDriverPhone', 'trackingId', 'netTotal', 'amountDue'].map(
        (k) => [k, kind(k)],
      ),
      auto: ['name', 'city', 'clinicianName', 'note', 'courierDriverName', 'instrument', 'deliveryType'].map((k) => [k, kind(k)]),
      reads: ['mobile', 'window', 'courierDriverPhone', 'netTotal'].map((k) => [k, window.READS_LTR(dd(k).querySelector('bdi'))]),
      mono: ['loyaltyId', 'approvalNumber', 'patientId', 'referenceErx', 'store', 'courierCode', 'trackingId', 'mobile'].map((k) => [k, mono(k)]),
      sans: ['netTotal', 'amountDue', 'deliveryFees', 'window', 'name'].map((k) => [k, mono(k)]),
      order: row('name'),
      text: document.querySelector('[aria-label="Document facts"]').textContent,
      blockGround: getComputedStyle(document.querySelector('[aria-label="Document facts"]')).backgroundColor,
      card: window.RESOLVE('backgroundColor', 'var(--card)'),
      rxInk: getComputedStyle(document.querySelector('[data-facts-block="prescription"] h3')).color,
      rx: window.RESOLVE('color', 'var(--prescription)'),
    }
  })
  check(`${label}: figures and codes are one ltr isolate each`, kinds.ltr.every(([, k]) => k === 'ltr'), JSON.stringify(kinds.ltr))
  check(`${label}: names, words and notes are dir-auto <bdi>`, kinds.auto.every(([, k]) => k === 'auto'), JSON.stringify(kinds.auto))
  check(`${label}: the phone, the window and the money read left-to-right`, kinds.reads.every(([, x]) => x > 0), JSON.stringify(kinds.reads))
  check(`${label}: IDs and codes are in Plex Mono`, kinds.mono.every(([, m]) => m), JSON.stringify(kinds.mono))
  check(`${label}: money, the window and names stay in Sans`, kinds.sans.every(([, m]) => !m), JSON.stringify(kinds.sans))
  check(
    `${label}: the label leads its value in the reading direction`,
    rtl ? kinds.order.labelX > kinds.order.valueX : kinds.order.labelX < kinds.order.valueX,
    JSON.stringify(kinds.order),
  )
  check(`${label}: no em dash and no isolate character in the facts`, !kinds.text.includes('—') && !ISOLATE_CHARS.test(kinds.text))
  check(`${label}: the facts sit on --card; the Prescription heading is --prescription`, kinds.blockGround === kinds.card && kinds.rxInk === kinds.rx, `${kinds.blockGround} / ${kinds.rxInk}`)

  // ── 4: Items sized to its rows ───────────────────────────────────────────────────────────────
  const items = await page.evaluate(() => {
    const section = document.querySelector('#doc-items')
    const fit = window.GRID_FIT(section.querySelector('.ag-root-wrapper'))
    const deleted = [...section.querySelectorAll('.ag-grid-scrolling-container > .ag-row')].find((r) => r.textContent.includes('Cotton pads'))
    return {
      heading: section.querySelector('h3').textContent,
      countIso: section.querySelector('h3 bdi[dir="ltr"]')?.textContent ?? null,
      fit,
      struck: deleted ? getComputedStyle(deleted).textDecorationLine : null,
      footer: section.querySelector('.ag-grid-pinned-bottom-rows-container')?.textContent ?? '',
    }
  })
  check(`${label}: Items is headed with its count, the count isolated`, items.heading === 'Items · 4' && items.countIso === '4', items.heading)
  check(
    `${label}: the items grid is sized to its four rows, no empty floor, nothing over the last line`,
    items.fit.rows === 4 && items.fit.floor <= 1 && items.fit.bodyHeight <= 4 * items.fit.rowHeight + 2 && items.fit.lastLineUncovered && items.fit.scrollInFrame,
    JSON.stringify(items.fit),
  )
  check(`${label}: the totals footer pins directly under the last line`, items.fit.pinnedRows === 1 && Math.abs(items.fit.pinnedGap) <= 1 && items.footer.includes('4 lines'), JSON.stringify({ gap: items.fit.pinnedGap, footer: items.footer.slice(0, 40) }))
  check(`${label}: a deleted line is struck through`, items.struck === 'line-through', String(items.struck))

  // ── 5: Pricing conditions, folded with its count ────────────────────────────────────────────
  const condClosed = await page.evaluate(() => {
    const d = document.querySelector('#doc-conditions')
    return { tag: d.tagName, open: d.open, summary: d.querySelector('summary').textContent, iso: d.querySelector('summary bdi[dir="ltr"]')?.textContent ?? null, grid: !!d.querySelector('.ag-root-wrapper') }
  })
  check(
    `${label}: Pricing conditions is a folded disclosure showing its count`,
    condClosed.tag === 'DETAILS' && !condClosed.open && condClosed.summary === 'Pricing conditions · 2' && condClosed.iso === '2',
    JSON.stringify(condClosed),
  )
  await page.locator('#doc-conditions > summary').click()
  await page.locator('#doc-conditions .ag-row').first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(200)
  const condOpen = await page.evaluate(() => {
    const d = document.querySelector('#doc-conditions')
    return { open: d.open, fit: window.GRID_FIT(d.querySelector('.ag-root-wrapper')), visible: d.querySelector('.ag-root-wrapper').getBoundingClientRect().height > 0 }
  })
  check(
    `${label}: …and expands to its two rows, sized to them`,
    condOpen.open && condOpen.visible && condOpen.fit.rows === 2 && condOpen.fit.floor <= 1 && condOpen.fit.lastLineUncovered && condOpen.fit.scrollInFrame,
    JSON.stringify(condOpen.fit),
  )
  await shot('full')

  // ── 6: the Attachments door ─────────────────────────────────────────────────────────────────
  const door = await page.evaluate(() => {
    const d = document.querySelector('#doc-attachments')
    return d ? { tag: d.tagName, open: d.open, summary: d.querySelector('summary').textContent, iso: d.querySelector('summary bdi[dir="ltr"]')?.textContent ?? null } : null
  })
  check(
    `${label}: the Attachments door is a folded disclosure with its file count`,
    door?.tag === 'DETAILS' && !door.open && door.summary === 'Attachments · 3' && door.iso === '3' && byOwnerCalls === 0,
    JSON.stringify({ door, byOwnerCalls }),
  )
  const show = page.locator('[data-facts-block="prescription"] button[data-row-action="files"]')
  check(`${label}: the Prescription block offers Files · 3 · Show`, (await show.count()) === 1 && (await show.getAttribute('aria-label')) === "Show the order's files under Attachments")
  await show.click()
  await page.locator('#doc-attachments [data-testid="slip-list"]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(200)
  const opened = await page.evaluate(() => {
    const d = document.querySelector('#doc-attachments')
    return {
      open: d.open,
      focused: document.activeElement === d.querySelector('summary'),
      files: d.querySelectorAll('tr[data-slip]').length,
    }
  })
  check(`${label}: Show opens it, moves focus to it, and reads the files once`, opened.open && opened.focused && opened.files === 3 && byOwnerCalls === 1, JSON.stringify({ ...opened, byOwnerCalls }))
  await page.locator('#doc-attachments > summary').click()
  await page.waitForTimeout(150)
  await page.locator('#doc-attachments > summary').click()
  await page.waitForTimeout(300)
  check(`${label}: folding and reopening reads nothing more`, (await page.locator('#doc-attachments').evaluate((d) => d.open)) && byOwnerCalls === 1, `${byOwnerCalls}`)

  // ── 2/4 again: a sparse delivery ─────────────────────────────────────────────────────────────
  await open('8000000253')
  const sparse = await readBlocks()
  check(
    `${label}: a sparse delivery draws only Customer · Fulfilment · Payment`,
    sparse.map((b) => b.key).join(',') === 'customer,fulfilment,payment',
    sparse.map((b) => b.key).join(','),
  )
  check(
    `${label}: …with its blank rows omitted`,
    sparse[0]?.rows.join(',') === 'name' && sparse[1]?.rows.join(',') === 'deliveryType,store',
    sparse.map((b) => `${b.key}=${b.rows.join(',')}`).join(' | '),
  )
  const sparseItems = await page.evaluate(() => {
    const section = document.querySelector('#doc-items')
    return {
      heading: section.querySelector('h3').textContent,
      fit: window.GRID_FIT(section.querySelector('.ag-root-wrapper')),
      text: document.querySelector('[aria-label="Document facts"]').textContent,
      conditions: document.querySelector('#doc-conditions summary').textContent,
      attachments: document.querySelectorAll('#doc-attachments').length,
    }
  })
  check(`${label}: one line, no empty floor under it`, sparseItems.heading === 'Items · 1' && sparseItems.fit.rows === 1 && sparseItems.fit.floor <= 1 && sparseItems.fit.bodyHeight <= sparseItems.fit.rowHeight + 2 && sparseItems.fit.lastLineUncovered, JSON.stringify(sparseItems.fit))
  check(`${label}: no em dash on a sparse delivery`, !sparseItems.text.includes('—'))
  check(`${label}: no conditions reads "· 0", and no files means no Attachments door`, sparseItems.conditions === 'Pricing conditions · 0' && sparseItems.attachments === 0, JSON.stringify(sparseItems))
  await shot('sparse')

  // ── 7: a cancelled delivery keeps the evidence-only command bar ──────────────────────────────
  await open('8000000902')
  const bar = await commandsOf()
  const more = await page.getByRole('button', { name: /^more/i }).count()
  check(
    `${label}: a cancelled delivery draws the same commands as a live one (evidence-only gating, no More menu)`,
    bar.length >= 7 && bar.join(',') === fullBar.join(',') && more === 0,
    bar.join(','),
  )

  const body = await page.locator('body').innerText()
  const raw = body.match(/\b(document|common)[.:][a-zA-Z]+(\.[a-zA-Z]+)+\b/g) ?? []
  check(`${label}: no raw t() key on screen`, raw.length === 0, raw.join(', '))
  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

for (const width of [1280, 1440]) {
  for (const theme of ['light', 'dark']) {
    for (const dir of ['ltr', 'rtl']) await drive({ theme, dir, width })
  }
}

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
