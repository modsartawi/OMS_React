// LF return panel drive (ticket 762, spec 759 F4; BackOffice 3369 §Wire, read door 3376).
//
// Drives the REAL app in Chromium against a STUB of 3376's LF return detail read (no live SIS.Api:
// 3376 is not built). The return delivery is the ticket-078 capture 9000000003 (category T),
// renumbered once per outcome; the forward LF delivery is 8000000253 re-typed `LF`. In LTR and RTL
// (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`, so the copy is English and only the
// stub ROWS carry Arabic — the document-donor-drive precedent), it asserts:
//   1. one fixture per outcome draws its chip and meaning; unanswered / nothingReceived / short
//      raise the attention banner with their own sentence, the other three none;
//   2. one row per line — item · SKU · asked · confirmed · refunded · restocked · reason — and an
//      unconfirmed quantity reads Pending, never 0; a confirmed 0 reads 0;
//   3. dates in local wall-clock (`yyyy-MM-dd HH:mm`) inside ltr isolates; a missing one "Not yet";
//   4. `forced` shows who forced it and why, each a <bdi>; no other outcome shows that block;
//   5. SKUs and quantities are ltr isolates, reason names <bdi>;
//   6. no panel — and no read — on the forward delivery or without grant 03; a bonded return
//      (the read answers null) draws nothing; a failing read says so in place;
//   7. the panel is read-only: no button inside it.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/lf-return-drive.mjs   (DRIVE_PORT=<port> for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.lf-return-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

const returnDoc = JSON.parse(readFileSync('.issues/assets/078-document-payloads/9000000003-delivery-return.json', 'utf8')).data
const forwardDoc = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000253-delivery.json', 'utf8')).data

const ACCESS = { canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true, canCreateLocalFulfillmentReturn: true }

const line = (itemNumber, sku, askedQuantity, confirmedQuantity, refundedQuantity, returnedToStock, reasonName) => ({
  itemNumber,
  sku,
  askedQuantity,
  confirmedQuantity,
  refundedQuantity,
  returnedToStock,
  reasonName,
})

function watches(rtl) {
  const damaged = rtl ? 'منتج تالف' : 'Damaged on arrival'
  const changed = rtl ? 'غيّر العميل رأيه' : 'Customer changed mind'
  const booked = '2026-11-02T10:05:00'
  const collected = '2026-11-03T14:30:00'
  const confirmed = '2026-11-05T09:15:00'
  return {
    // number → [outcome, watch]
    '9000000101': {
      outcome: 'open', bookedAt: booked, collectedAt: null, confirmedAt: null,
      lines: [line('000010', '100200300', 2, null, null, null, damaged), line('000020', '100200400', 1, 0, 0, 0, changed)],
    },
    '9000000102': {
      outcome: 'refunded', bookedAt: booked, collectedAt: collected, confirmedAt: confirmed,
      lines: [line('000010', '100200300', 2, 2, 2, 2, damaged)],
    },
    '9000000103': {
      outcome: 'short', bookedAt: booked, collectedAt: collected, confirmedAt: confirmed,
      lines: [line('000010', '100200300', 3, 1, 1, 0, damaged), line('000020', '100200400', 1, 1, 1, 1, changed)],
    },
    '9000000104': {
      outcome: 'nothingReceived', bookedAt: booked, collectedAt: collected, confirmedAt: confirmed,
      lines: [line('000010', '100200300', 2, 0, 0, 0, damaged)],
    },
    '9000000105': {
      outcome: 'unanswered', bookedAt: booked, collectedAt: collected, confirmedAt: null,
      lines: [line('000010', '100200300', 2, null, null, null, damaged)],
    },
    '9000000106': {
      outcome: 'forced', bookedAt: booked, collectedAt: collected, confirmedAt: null,
      forcedBy: rtl ? 'محمد السرطاوي' : 'm.sartawi',
      forcedReason: rtl ? 'لم ترد ستارلينكس خلال ١٤ يومًا' : 'Starlinks never answered; customer handed over both packs.',
      lines: [line('000010', '100200300', 2, null, 2, 0, damaged)],
    },
  }
}

const EXPECT = {
  '9000000101': ['open', 'Open', 'The pickup is booked. The refund waits for the warehouse to confirm what arrived.', null],
  '9000000102': ['refunded', 'Refunded', 'The warehouse confirmed everything asked, and the customer was refunded.', null],
  '9000000103': ['short', 'Short', 'The warehouse confirmed less than was asked. Only what arrived was refunded.',
    'Less arrived than was asked. Check the missing items with Starlinks before telling the customer.'],
  '9000000104': ['nothingReceived', 'Nothing received', 'The warehouse confirmed it received nothing. No refund was made.',
    'The warehouse says nothing arrived. Check with the driver and Starlinks before telling the customer.'],
  '9000000105': ['unanswered', 'Unanswered', 'The warehouse never confirmed this return. No refund was made.',
    'The warehouse never answered. Chase Starlinks, or force the refund by what the customer handed over.'],
  '9000000106': ['forced', 'Forced', 'An operator forced the refund by the quantity received. The automatic refund is stopped.', null],
}

const browser = await chromium.launch()

async function drive(dir) {
  const rtl = dir === 'rtl'
  const label = dir
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|404)/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  const WATCHES = watches(rtl)
  let access = ACCESS
  const lfReads = []
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope(access))
    const lf = p.match(/^SdDocumentWeb\/Delivery\/(\d+)\/LfReturn$/)
    if (lf) {
      lfReads.push(lf[1])
      if (lf[1] === '9000000199') return route.fulfill(envelope(null, { status: 400, success: false, message: 'Watch store unavailable' }))
      if (lf[1] === '9000000003') return route.fulfill(envelope(null, { status: 404, success: false, message: 'Not an LF return' }))
      return route.fulfill(envelope(WATCHES[lf[1]] ?? null))
    }
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) {
      const no = doc[1]
      if (no === '8000000253') return route.fulfill(envelope({ ...forwardDoc, deliveryDocumentType: 'LF', canReturn: true }))
      if (no.startsWith('9000000')) return route.fulfill(envelope({ ...returnDoc, documentNo: no }))
      return route.fulfill(envelope(null))
    }
    return route.fulfill(envelope({}))
  })

  const open = async (no) => {
    await page.goto(`${BASE}/oms/delivery/${no}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
  }
  const panel = () => page.locator('[data-lf-return-panel]')

  const htmlDir = await (async () => {
    await open('9000000101')
    return page.evaluate(() => document.documentElement.dir || 'ltr')
  })()
  check(`${label}: the page runs ${rtl ? 'right-to-left' : 'left-to-right'}`, htmlDir === (rtl ? 'rtl' : 'ltr'), htmlDir)

  // ── 1–5, 7: one fixture per outcome ─────────────────────────────────────────────────────────
  for (const [no, [outcome, chipText, meaning, banner]] of Object.entries(EXPECT)) {
    await open(no)
    await panel().waitFor({ timeout: 10000 })
    const v = await panel().evaluate((s) => {
      const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
      const cells = [...s.querySelectorAll('[data-lf-line]')].map((tr) =>
        [...tr.querySelectorAll('td')].map((td) => ({
          text: text(td),
          ltr: !!td.querySelector('bdi[dir="ltr"]'),
          bdi: !!td.querySelector('bdi'),
          pending: td.hasAttribute('data-lf-pending'),
        })),
      )
      return {
        chip: s.querySelector('[data-lf-chip]')?.getAttribute('data-lf-chip'),
        chipText: text(s.querySelector('[data-lf-chip]')),
        meaning: text(s.querySelector('[data-lf-meaning]')),
        banner: text(s.querySelector('[data-lf-attention-text]')),
        bannerTitle: text(s.querySelector('[data-lf-attention] .font-semibold')),
        headers: [...s.querySelectorAll('thead th')].map(text),
        cells,
        dates: Object.fromEntries(
          [...s.querySelectorAll('[data-lf-date]')].map((d) => [
            d.getAttribute('data-lf-date'),
            { text: text(d.querySelector('dd')), ltr: !!d.querySelector('dd bdi[dir="ltr"]') },
          ]),
        ),
        forcedBy: s.querySelector('[data-lf-forced-by] bdi') ? text(s.querySelector('[data-lf-forced-by]')) : null,
        forcedReason: s.querySelector('[data-lf-forced-reason] bdi') ? text(s.querySelector('[data-lf-forced-reason]')) : null,
        forcedBlock: !!s.querySelector('[data-lf-forced]'),
        buttons: s.querySelectorAll('button, input, select, textarea').length,
        // Above the two columns, so the banner is read first.
        beforeColumns: !!(s.compareDocumentPosition(document.querySelector('[data-spine]')) & Node.DOCUMENT_POSITION_FOLLOWING),
      }
    })
    check(`${label} ${outcome}: chip "${chipText}" with its meaning`, v.chip === outcome && v.chipText === chipText && v.meaning === meaning, `${v.chipText} | ${v.meaning}`)
    check(
      `${label} ${outcome}: ${banner ? 'raises the attention banner, saying what kind' : 'raises no banner'}`,
      banner ? v.banner === banner && v.bannerTitle === 'Action needed' : v.banner === null,
      v.banner ?? 'none',
    )
    check(
      `${label} ${outcome}: one row per line, item · SKU · asked · confirmed · refunded · restocked · reason`,
      JSON.stringify(v.headers) === JSON.stringify(['Item', 'SKU', 'Asked', 'Confirmed', 'Refunded', 'Restocked', 'Reason']) &&
        v.cells.length === WATCHES[no].lines.length,
      `${v.headers.join(',')} rows=${v.cells.length}`,
    )
    // Quantities: pending where the projection says so, a number in an ltr isolate otherwise.
    const wl = WATCHES[no]
    const qtyOk = v.cells.every((row, i) => {
      const l = wl.lines[i]
      const [item, sku, asked, conf, ref, rest, reason] = row
      const awaiting = wl.outcome === 'open' || wl.outcome === 'unanswered'
      const expectQ = (cell, value, pending) => (pending || value == null ? cell.pending && cell.text === 'Pending' : !cell.pending && cell.ltr && cell.text === String(value))
      return (
        item.ltr && item.text === l.itemNumber &&
        sku.ltr && sku.text === l.sku &&
        expectQ(asked, l.askedQuantity, false) &&
        expectQ(conf, l.confirmedQuantity, !wl.confirmedAt) &&
        expectQ(ref, l.refundedQuantity, awaiting) &&
        expectQ(rest, l.returnedToStock, awaiting) &&
        reason.bdi && !reason.ltr && reason.text === l.reasonName
      )
    })
    check(`${label} ${outcome}: quantities pending vs real, SKUs and numbers ltr, reasons <bdi>`, qtyOk, JSON.stringify(v.cells.map((r) => r.map((c) => `${c.text}${c.pending ? '(p)' : ''}`))))
    const dateOk = ['booked', 'collected', 'confirmed'].every((k) => {
      const raw = wl[`${k}At`]
      const d = v.dates[k]
      if (!raw) return d?.text === 'Not yet' && !d.ltr
      return d?.ltr && d.text === raw.slice(0, 16).replace('T', ' ')
    })
    check(`${label} ${outcome}: booked / collected / confirmed in local wall-clock, isolated`, dateOk, JSON.stringify(v.dates))
    if (outcome === 'forced')
      check(`${label} forced: who forced it and why, each <bdi>`, v.forcedBy === wl.forcedBy && v.forcedReason === wl.forcedReason, `${v.forcedBy} | ${v.forcedReason}`)
    else check(`${label} ${outcome}: no forced-by block`, !v.forcedBlock)
    check(`${label} ${outcome}: read-only — no control in the panel; above the columns`, v.buttons === 0 && v.beforeColumns, `controls=${v.buttons}`)
    await panel().screenshot({ path: `${SHOTS}/${dir}-${outcome}.png` })
  }
  await page.screenshot({ path: `${SHOTS}/${dir}-page-unanswered-context.png` })

  // ── 6: where it is not drawn ────────────────────────────────────────────────────────────────
  // The forward LF delivery (category D): never asked, never drawn.
  let before = lfReads.length
  await open('8000000253')
  check(`${label}: the forward LF delivery asks no watch and draws no panel`, lfReads.length === before && (await panel().count()) === 0, lfReads.slice(before).join(','))

  // A bonded return: asked, the read answers 404 → nothing drawn, no error.
  before = lfReads.length
  await open('9000000003')
  check(
    `${label}: a bonded return (read answers not-found) draws no panel and no error`,
    lfReads.slice(before).includes('9000000003') && (await panel().count()) === 0 && (await page.locator('[role="alert"]').count()) === 0,
  )

  // Without 03: never asked, never drawn — even on an LF return.
  access = { ...ACCESS, canCreateLocalFulfillmentReturn: false, canForceLocalFulfillmentReturnRefund: true }
  before = lfReads.length
  await open('9000000105')
  check(`${label}: without 03 (04 alone) no watch is asked and no panel drawn`, lfReads.length === before && (await panel().count()) === 0)
  access = ACCESS

  // A failing read: said in place.
  await open('9000000199')
  await panel().waitFor({ timeout: 10000 })
  const failed = await panel().evaluate((s) => s.querySelector('[role="alert"]')?.textContent ?? null)
  check(`${label}: a failing watch read is said in place`, /Watch store unavailable/.test(failed ?? ''), failed ?? 'none')

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
