// Delivery money strip drive (ticket 789, BackOffice spec 3389 user stories 67–70, door 3391).
//
// Drives the REAL app in Chromium against a STUB of 3391's `GET SdDocumentWeb/OrderDocumentList`
// in the REAL shape BackOffice built (pricing2 `OrderDocumentSearchPage`, 3389 hotfix): `{ rows, limited }`. The delivery is the ticket-078 capture 8000000253, its order re-pointed to
// 1006358459 (refDocumentNo) and its amount due set to 40.50; the order's search row answers the
// 1006358459 money (CHANNEL, patient 63.65, insurer 2.66). In LTR and RTL it asserts:
//   1. the strip is drawn above the two columns: CHANNEL badge, patient 63.65, insurer 2.66 and the
//      delivery's own amount due 40.50, each in an ltr isolate; the row was asked by DocumentNo;
//   2. with the insurance-view grant it links to /oms/document/1006358459#insurance, and following
//      the link lands on the order's Insurance section;
//   3. without the grant the money still shows and there is no link;
//   4. no strip for a non-insurance order, without the list grant (no read asked), or on the
//      order's own Document page (no read asked); a failing read is said in place;
//   5. nothing in the strip but the link: read-only.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/delivery-money-strip-drive.mjs   (DRIVE_PORT=<port> for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.delivery-money-strip-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', code } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: code ? [{ errorCode: code, errorMessage: message }] : [], data }),
})

const orderDoc = JSON.parse(readFileSync('.issues/assets/078-document-payloads/2000000551-erx.json', 'utf8')).data
const deliveryDoc = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000253-delivery.json', 'utf8')).data
const READ = JSON.parse(readFileSync('src/features/oms/document/__fixtures__/insurance-1006358459.json', 'utf8'))

/** Delivery no → its order. 8000000253 delivers the insurance order; 8000000254 a plain one; 8000000299's row read fails. */
const ORDER_OF = { 8000000253: '1006358459', 8000000254: '2000000551', 8000000299: '1006358499' }

const row = (documentNo, insurance) => ({
  orderNo: 'BUPA-20261105125734-451',
  documentNo,
  documentCategory: 'O',
  documentType: 'BUPA',
  documentTypeDescription: 'Bupa',
  documentSource: 'ERX',
  documentSourceDescription: 'eRx',
  storeCode: 'P001',
  customerName: 'Patient',
  customerPhone: '0500000000',
  entryTime: '2026-11-05T12:57:34',
  overallStatus: 'B',
  lastAction: 'DPIK',
  readyStatus: 'C',
  deliveryStatus: 'B',
  clearStatus: '',
  closeStatus: '',
  controlStatus: '',
  netTotal: 66.31,
  amountDue: 63.65,
  latestDeliveryNo: '8000000253',
  guardState: 'none',
  isInsuranceOrder: insurance,
  moneySource: insurance ? 'CHANNEL' : null,
  patientTotal: insurance ? 63.65 : null,
  insurerTotal: insurance ? 2.66 : null,
  patientId: null,
  memberId: null,
})

const GRANTED = { canOpenList: true, canOpenDetail: true, canViewInsurance: true }

const browser = await chromium.launch()

async function drive(dir) {
  const rtl = dir === 'rtl'
  const label = dir
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|404|500)|net::ERR_FAILED/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  let access = GRANTED
  const asked = []
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope(access))
    if (p === 'SdDocumentWeb/OrderDocumentList') {
      const no = url.searchParams.get('DocumentNo')
      asked.push(no)
      if (no === '1006358499') return route.fulfill(envelope(null, { status: 400, success: false, message: 'Order search unavailable' }))
      // The real answer: { rows, limited } — never a bare array.
      return route.fulfill(envelope({ rows: [row(no, no === '1006358459')], limited: false }))
    }
    const ins = p.match(/^SdDocumentWeb\/Document\/(\d+)\/Insurance$/)
    if (ins) return route.fulfill(envelope(READ))
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    if (/\/PrescriptionSessions$/.test(p)) return route.fulfill(envelope({ sessions: [] }))
    if (/\/Callout$/.test(p)) return route.fulfill(envelope({ callouts: [] }))
    const doc = p.match(/^SdDocumentWeb\/(Document|Delivery)\/(\d+)$/)
    if (doc) {
      if (doc[1] === 'Delivery')
        return route.fulfill(envelope({ ...deliveryDoc, documentNo: doc[2], refDocumentNo: ORDER_OF[doc[2]] ?? '', amountDue: 40.5 }))
      return route.fulfill(envelope({ ...orderDoc, documentNo: doc[2], documentCategory: 'O' }))
    }
    return route.fulfill(envelope({}))
  })

  const open = async (path) => {
    await page.goto(`${BASE}${path}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(600)
  }
  const strip = () => page.locator('[data-delivery-money-strip]')
  const readStrip = () =>
    strip().evaluate((s) => {
      const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
      const fig = (f) => s.querySelector(`[data-strip-figure="${f}"] dd`)
      return {
        source: s.querySelector('[data-money-source]')?.getAttribute('data-money-source'),
        sourceText: text(s.querySelector('[data-money-source]')),
        patient: text(fig('patient')),
        insurer: text(fig('insurer')),
        amountDue: text(fig('amountDue')),
        ltr: ['patient', 'insurer', 'amountDue'].every((f) => !!fig(f)?.querySelector('bdi[dir="ltr"]')),
        link: s.querySelector('[data-strip-link]')?.getAttribute('href') ?? null,
        controls: s.querySelectorAll('button, input, select, textarea').length,
        beforeColumns: !!(s.compareDocumentPosition(document.querySelector('[data-spine]')) & Node.DOCUMENT_POSITION_FOLLOWING),
      }
    })

  // ── 1–2: granted ────────────────────────────────────────────────────────────────────────────
  await open('/oms/delivery/8000000253')
  check(`${label}: the page runs ${rtl ? 'right-to-left' : 'left-to-right'}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  await strip().waitFor({ timeout: 10000 })
  const s1 = await readStrip()
  check(`${label}: the order row is asked by its document no`, asked.includes('1006358459'), asked.join(','))
  check(`${label}: the strip sits above the two columns`, s1.beforeColumns)
  check(`${label}: CHANNEL badge`, s1.source === 'CHANNEL' && s1.sourceText === 'Channel', s1.sourceText)
  check(
    `${label}: patient 63.65, insurer 2.66 and the delivery's own amount due 40.50, in ltr isolates`,
    s1.patient === '63.65' && s1.insurer === '2.66' && s1.amountDue === '40.50' && s1.ltr,
    JSON.stringify(s1),
  )
  check(`${label}: with the grant, a link to the order's Insurance section`, s1.link === '/oms/document/1006358459#insurance', s1.link)
  check(`${label}: no control in the strip: read-only`, s1.controls === 0, String(s1.controls))
  await page.screenshot({ path: `${SHOTS}/${dir}-granted.png` })
  await strip().locator('[data-strip-link]').click()
  await page.locator('[data-insurance-section]').waitFor({ timeout: 10000 })
  check(`${label}: the link lands on the order's Insurance section`, new URL(page.url()).pathname === '/oms/document/1006358459' && new URL(page.url()).hash === '#insurance', page.url())

  // ── 4: absent ───────────────────────────────────────────────────────────────────────────────
  asked.length = 0
  await page.goto(`${BASE}/oms/document/1006358459`)
  await page.locator('[data-spine]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  check(`${label}: no strip and no row read on the order's own page`, (await strip().count()) === 0 && asked.length === 0, asked.join(','))
  await open('/oms/delivery/8000000254')
  check(`${label}: no strip for a delivery of a non-insurance order`, (await strip().count()) === 0 && asked.includes('2000000551'))
  await open('/oms/delivery/8000000299')
  check(
    `${label}: a failing row read is said in place`,
    (await strip().count()) === 0 && /Order search unavailable/.test((await page.locator('main').textContent()) ?? ''),
  )

  // ── 3: without the insurance grant; then without the list grant ─────────────────────────────
  access = { canOpenList: true, canOpenDetail: true }
  await page.reload()
  await open('/oms/delivery/8000000253')
  await strip().waitFor({ timeout: 10000 })
  const s3 = await readStrip()
  check(`${label}: without the insurance grant the money shows, no link`, s3.patient === '63.65' && s3.amountDue === '40.50' && s3.link === null, JSON.stringify(s3))
  await page.screenshot({ path: `${SHOTS}/${dir}-no-grant.png` })

  access = { canOpenDetail: true }
  asked.length = 0
  await page.reload()
  await open('/oms/delivery/8000000253')
  check(`${label}: without the list grant, no strip and no row read`, (await strip().count()) === 0 && asked.length === 0, asked.join(','))

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
