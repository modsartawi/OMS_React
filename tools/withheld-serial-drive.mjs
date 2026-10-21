// Withheld serial drive (ticket 540; BackOffice brief 2875, spec 2871, doors 2872–2874).
//
// Drives the REAL app in Chromium against a STUB of the brief's additive wire — the doors are built
// but not deployed, so there is no live SIS.Api to point at (the ticket's staging walk is the live
// proof). The stub answers as SIS.Api would for two support users:
//   - UNGRANTED (no `canSeePickSupportSerial`): the GS1 unit arrives `serialNumber: ""`,
//     `scannedText: ""`, `serialWithheld: true`; the copy text and a timeline detail carry
//     `[restricted]`; a serial key resolves to the plain unknown-key sentence;
//   - GRANTED (`canSeePickSupportSerial: true`): the serials as today, and the holds table.
// One delivery also has a plain unit (never had a serial), and one granted delivery comes back
// withheld anyway, to prove the data wins over the flag.
// In LTR and RTL it asserts:
//   1. ungranted: the GS1 unit reads Restricted (lock, tooltip), the plain unit reads "—";
//   2. ungranted: the units carry the one-line "Serials are restricted for your account" note;
//   3. ungranted: the search hint drops "serial";
//   4. ungranted: Copy as text puts the server's `[restricted]` text on the clipboard verbatim, and the
//      timeline shows `[restricted]` as sent;
//   5. ungranted: a serial key gives the plain no-match sentence — no "restricted" hint;
//   6. granted: the serial is drawn (left to right), no Restricted, no note, the hint names "serial";
//   7. granted: a serial key gives the holds table with the serial and no note;
//   8. granted, data withheld: the cell still reads Restricted (the data wins);
//   9. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/withheld-serial-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.withheld-serial-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: null, serverTime: '2026-10-21 09:41:07', data }),
})

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────

const DELIVERY = '8006777365'
/** A granted caller's delivery that SIS.Api withholds anyway: the data wins over the flag. */
const DISAGREE = '8006777370'
const SERIAL = 'SN12345'

const unit = (over) => ({
  pickIndex: 1,
  pickType: 'SCAN',
  channel: 'HHT',
  scannedText: `0106281234567890215${SERIAL}`,
  barcode: '06281234567890',
  gtin: '06281234567890',
  serialNumber: SERIAL,
  batchLot: 'B2026A',
  expiryDate: '2027-06-30',
  overrideReason: '',
  pickedBy: '1112-ph01',
  approvedBy: '',
  pickedAt: '2026-10-01T09:30:00',
  device: 'HHT-07',
  ...over,
})

/** The GS1 unit as SIS.Api sends it to each caller. */
const gs1Unit = (withheld) => (withheld ? unit({ serialNumber: '', scannedText: '', serialWithheld: true }) : unit({ serialWithheld: false }))
/** A unit that never had a serial (a plain barcode scan): an older-shape unit, no `serialWithheld`. */
const plainUnit = () => unit({ pickIndex: 2, scannedText: '6281234567890', serialNumber: '', batchLot: '', expiryDate: '' })

const COPY_WITHHELD = `Pick support - delivery ${DELIVERY}\nVerdict: HEALTHY\nUnit 1: GTIN 06281234567890 serial [restricted]\n`
const COPY_GRANTED = `Pick support - delivery ${DELIVERY}\nVerdict: HEALTHY\nUnit 1: GTIN 06281234567890 serial ${SERIAL}\n`
const DETAIL_WITHHELD = 'Picked GTIN 06281234567890 serial [restricted]'

const diagnosis = (deliveryNo, withheld) => ({
  deliveryNo,
  orderNo: '1000456789',
  currentStore: '1112',
  readyStatus: '',
  closeStatus: '',
  verdict: 'HEALTHY',
  refusalText: null,
  storeHistory: [],
  documents: [
    {
      documentNo: 'PD0001234',
      sourceType: 'OMS',
      sourceKey: deliveryNo,
      storeCode: '1112',
      state: 'OPEN',
      revision: 3,
      voidReason: '',
      createdAt: '2026-10-01T09:00:00',
      createdBy: '1112-ph01',
      lastPickAt: '2026-10-01T09:30:00',
      lastPickBy: '1112-ph01',
      confirmedAt: '0001-01-01T00:00:00',
      confirmedBy: '',
      consumedByStore: '',
      consumedByTrx: '',
      confirmMode: '',
      picked: 2,
      required: 2,
      lines: [
        {
          lineNumber: 1,
          sourceLine: 10,
          itemNumber: '100200',
          description: 'Panadol 500mg',
          quantity: 2,
          uom: 'BOX',
          shortQuantity: 0,
          shortReason: '',
          isPickable: true,
          coveredQuantity: 0,
          owedUnits: 2,
          coveredUnits: 0,
          required: 2,
          picked: 2,
          state: 'COMPLETE',
          units: [gs1Unit(withheld), plainUnit()],
        },
      ],
    },
  ],
  donorRequests: [],
  shapes: [],
  timeline: [
    {
      at: '2026-10-01T09:30:00',
      source: 'PICK_DOCUMENT',
      key: 'PD0001234',
      seq: 1,
      eventType: 'PICK',
      actor: '1112-ph01',
      approvedBy: '',
      reason: '',
      complaintRef: '',
      detail: withheld ? DETAIL_WITHHELD : `Picked GTIN 06281234567890 serial ${SERIAL}`,
      reconstructed: false,
    },
  ],
  copy: withheld ? { text: COPY_WITHHELD, json: '{\n  "serialNumber": "[restricted]"\n}' } : { text: COPY_GRANTED, json: `{\n  "serialNumber": "${SERIAL}"\n}` },
})

const resolution = (key, over = {}) => ({ key, matched: true, messageEn: null, messageAr: null, deliveries: [], serials: [], ...over })
const resolved = (deliveryNo, matchedBy) => ({ deliveryNo, orderNo: '1000456789', currentStore: '1112', closeStatus: '', matchedBy, shapes: [] })

const NO_MATCH_EN = `Nothing matches '${SERIAL}'.`
const NO_MATCH_AR = `لا شيء يطابق '${SERIAL}'.`

const HOLD = {
  serialNumber: SERIAL,
  gtin: '06281234567890',
  documentNo: 'PD0001234',
  sourceType: 'OMS',
  sourceKey: DELIVERY,
  storeCode: '1112',
  documentState: 'OPEN',
  consumedByTrx: '',
  deliveryNo: DELIVERY,
  hold: 'LIVE_PICK',
  shapes: [],
  explanationEn: 'Store 1112 holds this unit on a live pick.',
  explanationAr: 'الفرع 1112 يحتفظ بهذه الوحدة في تجهيز جارٍ.',
  serialWithheld: false,
}

// ── The harness ──────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch()

async function open(dir, { granted }) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const page = await context.newPage()
  const errors = []
  const bodies = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
    if (navigator.clipboard) {
      const write = navigator.clipboard.writeText.bind(navigator.clipboard)
      navigator.clipboard.writeText = (text) => {
        window.__copied = text
        return write(text)
      }
    }
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    const answer = (data) => {
      bodies[p] = JSON.stringify(data)
      return route.fulfill(envelope(data))
    }
    if (p === 'Auth/Me') return answer({ authenticated: true, userId: granted ? 'support02' : 'support01', currentStoreCode: 'P001' })
    if (p === 'SdDocumentWeb/Access')
      return answer({ canOpenList: true, canOpenDetail: true, canOpenPickSupport: true, ...(granted ? { canSeePickSupportSerial: true } : {}) })
    if (p === 'PickSupport/Resolve') {
      const key = url.searchParams.get('key') ?? ''
      if (key === DELIVERY || key === DISAGREE) return answer(resolution(key, { deliveries: [resolved(key, ['DELIVERY'])] }))
      // Ungranted: a serial key is an unknown key, the plain sentence (brief rule 5).
      if (key === SERIAL && granted) return answer(resolution(key, { deliveries: [resolved(DELIVERY, ['SERIAL'])], serials: [HOLD] }))
      return answer(resolution(key, { matched: false, messageEn: NO_MATCH_EN, messageAr: NO_MATCH_AR }))
    }
    const delivery = /^PickSupport\/Delivery\/([^/]+)$/.exec(p)
    if (delivery) {
      const no = decodeURIComponent(delivery[1])
      return answer(diagnosis(no, !granted || no === DISAGREE))
    }
    if (/Access$/.test(p)) return answer({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false })
    return answer([])
  })
  return { context, page, errors, bodies }
}

/** Whether a text reads left to right on screen: its first character's box starts left of its last's. */
const readsLtr = (locator) =>
  locator.evaluate((el) => {
    const text = el.textContent.trim()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const i = node.textContent.indexOf(text)
      if (i < 0) continue
      const box = (k) => {
        const r = document.createRange()
        r.setStart(node, k)
        r.setEnd(node, k + 1)
        return r.getBoundingClientRect()
      }
      return box(i).left < box(i + text.length - 1).left
    }
    return null
  })

async function openKey(page, key) {
  await page.goto(`${BASE}/oms/pick-support?key=${encodeURIComponent(key)}`)
}

/** The units table of the one document, expanded. */
async function units(page, deliveryNo) {
  const panel = page.locator(`[data-ps-panel="${deliveryNo}"]`)
  await panel.waitFor({ timeout: 10000 })
  await panel.locator('[data-ps-document="PD0001234"] summary').click()
  const table = panel.locator('[data-ps-units="1"]')
  await table.waitFor({ timeout: 5000 })
  return { panel, cells: table.locator('[data-ps-serial]') }
}

async function drive(dir) {
  const label = dir

  // ── Ungranted ──
  {
    const { context, page, errors, bodies } = await open(dir, { granted: false })
    await openKey(page, DELIVERY)
    const { panel, cells } = await units(page, DELIVERY)
    const gs1 = cells.nth(0)
    const plain = cells.nth(1)
    const restricted = gs1.locator('[data-ps-serial-restricted]')
    const tip = (await restricted.count()) ? await restricted.getAttribute('title') : null
    check(
      `${label} ungranted: the withheld GS1 unit reads Restricted, with the lock and the tooltip`,
      (await restricted.count()) === 1 && (await restricted.locator('svg').count()) === 1 && !!tip && tip.length > 10,
      `${(await gs1.innerText()).trim()} / title=${tip}`,
    )
    check(
      `${label} ungranted: the unit that never had a serial reads "—", not Restricted`,
      (await plain.innerText()).trim() === '—' && (await plain.locator('[data-ps-serial-restricted]').count()) === 0,
      (await plain.innerText()).trim(),
    )
    check(`${label} ungranted: the units carry the one restricted note`, (await panel.locator('[data-ps-serials-note]').count()) === 1)
    check(`${label} ungranted: no serial reached the page`, !(await page.locator('body').innerText()).includes(SERIAL))
    check(
      `${label} ungranted: the stubbed PickSupport/Delivery body carries no serial (the wire the live walk re-checks)`,
      !bodies[`PickSupport/Delivery/${DELIVERY}`].includes(SERIAL),
    )

    const placeholder = await page.locator('[data-ps-key]').getAttribute('placeholder')
    check(
      `${label} ungranted: the search hint drops "serial"`,
      !!placeholder && !/serial|تسلسلي/i.test(placeholder),
      placeholder ?? '',
    )

    await page.evaluate(() => navigator.clipboard.writeText('-'))
    await panel.locator('[data-ps-copy="text"]').first().click()
    await page.waitForTimeout(200)
    const copied = await page.evaluate(() => window.__copied ?? null)
    check(`${label} ungranted: Copy as text puts the [restricted] text on the clipboard verbatim`, copied === COPY_WITHHELD, JSON.stringify(copied))
    const detail = await panel.locator('[data-ps-timeline-row="PD0001234"]').innerText()
    check(`${label} ungranted: the timeline shows [restricted] as sent`, detail.includes(DETAIL_WITHHELD), detail.replace(/\s+/g, ' '))
    await page.screenshot({ path: `${SHOTS}/${label}-ungranted-units.png`, fullPage: true })

    await openKey(page, SERIAL)
    const noMatch = page.locator('[data-ps-no-match]')
    await noMatch.waitFor({ timeout: 10000 })
    const text = await noMatch.innerText()
    check(
      `${label} ungranted: a serial key gives the plain no-match sentence, with no restricted hint`,
      text.includes(NO_MATCH_EN) && text.includes(NO_MATCH_AR) && !/restrict|مقيّد/i.test(text) && (await page.locator('[data-ps-section="holds"]').count()) === 0,
      text.replace(/\s+/g, ' '),
    )
    check(`${label} ungranted: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── Granted ──
  {
    const { context, page, errors } = await open(dir, { granted: true })
    await openKey(page, DELIVERY)
    const { panel, cells } = await units(page, DELIVERY)
    const gs1 = cells.nth(0)
    check(
      `${label} granted: the serial is drawn, left to right, with no Restricted`,
      (await gs1.innerText()).trim() === SERIAL && (await gs1.locator('[data-ps-serial-restricted]').count()) === 0 && (await readsLtr(gs1)) === true,
      (await gs1.innerText()).trim(),
    )
    check(`${label} granted: the plain unit still reads "—"`, (await cells.nth(1).innerText()).trim() === '—')
    check(`${label} granted: no restricted note`, (await panel.locator('[data-ps-serials-note]').count()) === 0)
    const placeholder = await page.locator('[data-ps-key]').getAttribute('placeholder')
    check(`${label} granted: the search hint names "serial"`, !!placeholder && /serial|تسلسلي/i.test(placeholder), placeholder ?? '')

    await openKey(page, SERIAL)
    const holds = page.locator('[data-ps-section="holds"]')
    await holds.waitFor({ timeout: 10000 })
    const holdSerial = holds.locator('[data-ps-serial]').first()
    check(
      `${label} granted: a serial key gives the holds table with the serial and no note`,
      (await holdSerial.innerText()).trim() === SERIAL && (await holds.locator('[data-ps-serials-note]').count()) === 0,
      (await holdSerial.innerText()).trim(),
    )
    await page.screenshot({ path: `${SHOTS}/${label}-granted-holds.png`, fullPage: true })

    await openKey(page, DISAGREE)
    const disagree = await units(page, DISAGREE)
    check(
      `${label} granted, data withheld: the cell still reads Restricted (the data wins)`,
      (await disagree.cells.nth(0).locator('[data-ps-serial-restricted]').count()) === 1,
      (await disagree.cells.nth(0).innerText()).trim(),
    )
    check(`${label} granted: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

try {
  await drive('ltr')
  await drive('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
