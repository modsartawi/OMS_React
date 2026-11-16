// Document family drive (ticket 906, BackOffice spec 3953 "Family panel", endpoint 3954).
//
// Drives the REAL app in Chromium against a STUB of 3954's
// `GET SdDocumentWeb/Document/{no}/Family?category=` in the shape spec 3953 fixes (ruling 3944):
// `{ askedNo, askedCategory, rootNo, rootCategory, truncated, nodes: [...] }`. The family is the
// prototype's "Bupa order, two deliveries": order 1005551234 → deliveries 8007000001 (billed by
// 3007700101) and 8007000002. The endpoint is NOT deployed anywhere yet (2026-11-16), so this is the
// only proof until the sandbox walk. In LTR and RTL it asserts:
//   1. on a delivery the "Family (4)" section is first in the facts column and open; the read was
//      asked by the record's number and its category D;
//   2. the tree is drawn from the root in order, the open delivery tinted, tagged "You are here" and
//      not a link; the order and the sibling delivery link to their pages; the billing is no link;
//   3. one click on the sibling, then the order, then back to the first delivery lands each page,
//      and each page draws the same tree with its own member open;
//   4. the indentation sits on the inline-start side (left in LTR, right in RTL);
//   5. a lone document and a failed read draw no section, and the page still works.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/document-family-drive.mjs   (DRIVE_PORT=<port> for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.document-family-shots'
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

const member = (no, category, parent, extra = {}) => ({
  no,
  category,
  parentNo: parent?.[0] ?? null,
  parentCategory: parent?.[1] ?? null,
  documentType: null,
  documentTypeDescription: null,
  status: null,
  statusDescription: null,
  storeCode: 'J044',
  storeName: 'Jeddah 44',
  entryTime: '2026-11-09T13:05:00',
  pageKind: null,
  partnerReference: null,
  tillInvoiceNo: null,
  ...extra,
})
const NODES = [
  member('1005551234', 'O', null, {
    documentType: 'BUPA', documentTypeDescription: 'Bupa', status: 'C', statusDescription: 'Completed', pageKind: 'document',
    entryTime: '2026-11-09T09:12:00', partnerReference: { source: 'BUPA', orderNo: 'BUPA-7781203', sourceReference: '7781203' },
  }),
  member('8007000001', 'D', ['1005551234', 'O'], { documentType: 'DLVR', documentTypeDescription: 'Delivery', status: 'C', statusDescription: 'Delivered', pageKind: 'delivery' }),
  member('3007700101', 'B', ['8007000001', 'D'], { tillInvoiceNo: 'J044-0551100', entryTime: '2026-11-09T13:20:00' }),
  member('8007000002', 'D', ['1005551234', 'O'], {
    documentType: 'DLVR', documentTypeDescription: 'Delivery', status: 'B', statusDescription: 'Out for delivery', pageKind: 'delivery',
    storeCode: 'J051', storeName: 'Jeddah 51', entryTime: '2026-11-10T11:40:00',
  }),
]
const FAMILY_OF = new Set(NODES.map((n) => `${n.category}:${n.no}`))
const ORDER_TREE = ['O:1005551234', 'D:8007000001', 'B:3007700101', 'D:8007000002']

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
  const asked = []
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const fam = p.match(/^SdDocumentWeb\/Document\/(\d+)\/Family$/)
    if (fam) {
      const no = fam[1]
      const category = url.searchParams.get('category')
      asked.push(`${category}:${no}`)
      if (no === '8009999999') return route.fulfill(envelope(null, { status: 500, success: false, message: 'Family read failed' }))
      if (!FAMILY_OF.has(`${category}:${no}`))
        return route.fulfill(envelope({ askedNo: no, askedCategory: category, rootNo: no, rootCategory: category, truncated: false, nodes: [member(no, category, null)] }))
      return route.fulfill(envelope({ askedNo: no, askedCategory: category, rootNo: '1005551234', rootCategory: 'O', truncated: false, nodes: NODES }))
    }
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    if (/\/PrescriptionSessions$/.test(p)) return route.fulfill(envelope({ sessions: [] }))
    if (/\/Callout$/.test(p)) return route.fulfill(envelope({ callouts: [] }))
    if (p === 'SdDocumentWeb/OrderDocumentList') return route.fulfill(envelope({ rows: [], limited: false }))
    const doc = p.match(/^SdDocumentWeb\/(Document|Delivery)\/(\d+)$/)
    if (doc) {
      if (doc[1] === 'Delivery') return route.fulfill(envelope({ ...deliveryDoc, documentNo: doc[2], documentCategory: 'D', refDocumentNo: '1005551234' }))
      return route.fulfill(envelope({ ...orderDoc, documentNo: doc[2], documentCategory: 'O' }))
    }
    return route.fulfill(envelope({}))
  })

  const section = () => page.locator('#doc-family')
  const open = async (path) => {
    await page.goto(`${BASE}${path}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(600)
  }
  const readTree = () =>
    section().evaluate((s) => {
      const rows = [...s.querySelectorAll('[data-family-member]')]
      const nested = s.querySelector('[data-family-tree] ul')
      const cs = nested ? getComputedStyle(nested) : null
      return {
        open: s.open,
        title: s.querySelector('summary').textContent.replace(/\s+/g, ' ').trim(),
        order: rows.map((r) => r.getAttribute('data-family-member')),
        openRows: rows.filter((r) => r.hasAttribute('data-family-open')).map((r) => r.getAttribute('data-family-member')),
        hereTag: s.querySelector('[data-family-open] [data-family-here]')?.textContent.trim() ?? null,
        openIsLink: s.querySelector('[data-family-open]')?.tagName === 'A',
        links: Object.fromEntries(rows.map((r) => [r.getAttribute('data-family-member'), r.tagName === 'A' ? r.getAttribute('href') : null])),
        firstInFacts: !!(s.compareDocumentPosition(document.querySelector('[data-facts-block]')) & Node.DOCUMENT_POSITION_FOLLOWING),
        borderLeft: cs ? parseFloat(cs.borderLeftWidth) : 0,
        borderRight: cs ? parseFloat(cs.borderRightWidth) : 0,
        noIsolated: rows.every((r) => !!r.querySelector('[data-family-no] bdi[dir="ltr"]')),
      }
    })

  // ── 1–2: on the second delivery ─────────────────────────────────────────────────────────────
  await open('/oms/delivery/8007000002')
  check(`${label}: the page runs ${rtl ? 'right-to-left' : 'left-to-right'}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  await section().waitFor({ timeout: 10000 })
  const t1 = await readTree()
  check(`${label}: the read is asked by number and category D`, asked.includes('D:8007000002'), asked.join(','))
  check(`${label}: "Family (4)", open by default, first in the facts column`, t1.open && /\(4\)/.test(t1.title) && t1.firstInFacts, `${t1.title} open=${t1.open} first=${t1.firstInFacts}`)
  // The app's `lng` stays `en` (core/i18n.ts): RTL is driven by direction, the Arabic words by the
  // en/ar mirror test (family-i18n-keys.test.ts), so the title is not asserted in Arabic here.
  check(`${label}: the tree is drawn from the root, in order`, JSON.stringify(t1.order) === JSON.stringify(ORDER_TREE), t1.order.join(' '))
  check(`${label}: the open delivery is tagged "You are here" and is not a link`, JSON.stringify(t1.openRows) === '["D:8007000002"]' && !!t1.hereTag && !t1.openIsLink, `${t1.hereTag}`)
  check(
    `${label}: the order and the sibling link to their pages; the billing is no link`,
    t1.links['O:1005551234'] === '/oms/document/1005551234' && t1.links['D:8007000001'] === '/oms/delivery/8007000001' && t1.links['B:3007700101'] === null,
    JSON.stringify(t1.links),
  )
  check(`${label}: every number is in an ltr isolate`, t1.noIsolated)
  check(
    `${label}: the indentation sits on the inline-start side`,
    rtl ? t1.borderRight > 0 && t1.borderLeft === 0 : t1.borderLeft > 0 && t1.borderRight === 0,
    `left=${t1.borderLeft} right=${t1.borderRight}`,
  )
  await section().screenshot({ path: `${SHOTS}/${dir}-delivery-2.png` })

  // ── 3: one click each way ───────────────────────────────────────────────────────────────────
  await section().locator('[data-family-member="D:8007000001"]').click()
  await page.waitForURL('**/oms/delivery/8007000001', { timeout: 10000 })
  await page.locator('#doc-family [data-family-open][data-family-member="D:8007000001"]').waitFor({ timeout: 10000 })
  const t2 = await readTree()
  check(`${label}: one click opens the sibling delivery, which draws the same tree with itself open`, JSON.stringify(t2.order) === JSON.stringify(ORDER_TREE) && JSON.stringify(t2.openRows) === '["D:8007000001"]', t2.openRows.join())
  await section().locator('[data-family-member="O:1005551234"]').click()
  await page.waitForURL('**/oms/document/1005551234', { timeout: 10000 })
  await page.locator('#doc-family [data-family-open][data-family-member="O:1005551234"]').waitFor({ timeout: 10000 })
  check(`${label}: one click opens the order on the document page, asked with category O`, asked.includes('O:1005551234'), asked.join(','))
  await section().screenshot({ path: `${SHOTS}/${dir}-order.png` })
  await section().locator('[data-family-member="D:8007000002"]').click()
  await page.waitForURL('**/oms/delivery/8007000002', { timeout: 10000 })
  await page.locator('#doc-family [data-family-open][data-family-member="D:8007000002"]').waitFor({ timeout: 10000 })
  check(`${label}: and back to the second delivery in one click`, true)

  // ── 5: absent ───────────────────────────────────────────────────────────────────────────────
  await open('/oms/document/2000000551')
  check(`${label}: a lone document draws no Family section`, (await section().count()) === 0 && asked.includes('O:2000000551'))
  await open('/oms/delivery/8009999999')
  check(`${label}: a failed read draws no section and the page still works`, (await section().count()) === 0 && (await page.locator('[data-facts-block]').count()) > 0)

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
