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
//   5. a lone document draws no section; a 404 (route not deployed) and a bare 403 draw nothing; any
//      other failed read (a 500) draws the "Family" section (no count) with one quiet line inside it,
//      in the ruled words only; the page still works.
//
// Ticket 907 adds, on the prototype's "big family" (order 1000887766 -> three deliveries, the middle
// one 8005000012 with six billings; answered `truncated: true`), in LTR light at desktop width, RTL
// dark at 375px and LTR dark at 375px:
//   6. the billings past the first fold behind "+ 5 more billings", which expands them in place;
//   7. the truncated warning sits under the tree; on the Bupa family a billing is grey, no link,
//      tooltip "Billings have no page", its till invoice a dashed label in an ltr isolate, and the
//      root's partner reference a dashed label (source · order number) in an ltr isolate;
//   8. at phone width every row stays one line, the page does not scroll sideways, and the badge,
//      the number and the status chip are whole (only the meta line is cut short).
//
// The review fixes (impl/3953-review-fixes) add: the "+ N more billings" button sits right after the
// first billing; a member whose parent is not in the answer (an orphan) is a top-level row after the
// root's tree and counted; the warning names no cap; and on a deep family (30 deliveries, the last one
// open) the window never scrolls, the tree's own box scrolls the open row into view, and a Refresh
// (refetch) does not scroll it again.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/document-family-drive.mjs   (DRIVE_PORT=<port> for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
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

// Ticket 907: the prototype's big family, answered cut short at the cap.
const BIG = [
  member('1000887766', 'O', null, { documentType: 'CMRC', documentTypeDescription: 'Commerce order', status: 'C', statusDescription: 'Completed', pageKind: 'document', storeCode: 'R001', storeName: 'Riyadh 1' }),
]
for (let d = 1; d <= 3; d++) {
  const dNo = `80050000${10 + d}`
  BIG.push(member(dNo, 'D', ['1000887766', 'O'], { documentType: 'DLVR', documentTypeDescription: 'Delivery', status: 'C', statusDescription: 'Delivered', pageKind: 'delivery', storeCode: `R00${d}`, storeName: `Riyadh ${d} long store name for the ellipsis` }))
  for (let b = 1; b <= (d === 2 ? 6 : 1); b++)
    BIG.push(member(`30050${d}000${b}`, 'B', [dNo, 'D'], { tillInvoiceNo: `R00${d}-00${d}${b}`, storeCode: `R00${d}`, storeName: `Riyadh ${d}` }))
}
// An orphan: its parent (a return order) is not in the answer. It is drawn, top level, after the root's tree.
BIG.push(member('6005000099', 'T', ['3009999999', 'R'], { documentType: 'DLVR', documentTypeDescription: 'Return delivery', status: 'C', statusDescription: 'Delivered', pageKind: 'delivery' }))
const ORDER_TREE = ['O:1005551234', 'D:8007000001', 'B:3007700101', 'D:8007000002']

const browser = await chromium.launch()

async function drive(dir) {
  const rtl = dir === 'rtl'
  const label = dir
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|403|404|500)|net::ERR_FAILED/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  const asked = []
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', 'DocumentDetails:03']))
    const fam = p.match(/^SdDocumentWeb\/Document\/(\d+)\/Family$/)
    if (fam) {
      const no = fam[1]
      const category = url.searchParams.get('category')
      asked.push(`${category}:${no}`)
      if (no === '8009999999') return route.fulfill(envelope(null, { status: 500, success: false, message: 'Family read failed' }))
      // The route not deployed: a plain 404. A grant refusal: a bare 403 (no envelope, no code).
      if (no === '8009999404') return route.fulfill({ status: 404, contentType: 'text/plain', body: '' })
      if (no === '8009999403') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
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
        billingTitle: s.querySelector('[data-family-member="B:3007700101"]')?.getAttribute('title') ?? null,
        till: s.querySelector('[data-family-member="B:3007700101"] [data-family-till] bdi[dir="ltr"]')?.textContent ?? null,
        // Led by the partner's name (free text): one `<bdi>` (dir auto) around the whole pair, not `Ltr`.
        partner: (() => {
          const b = s.querySelector('[data-family-member="O:1005551234"] [data-family-partner] > bdi')
          return b && !b.hasAttribute('dir') ? b.textContent : null
        })(),
        partnerCount: s.querySelectorAll('[data-family-partner]').length,
        truncated: !!s.querySelector('[data-family-truncated]'),
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
  check(`${label}: the billing's tooltip says billings have no page`, t1.billingTitle === 'Billings have no page', String(t1.billingTitle))
  check(`${label}: the billing's till invoice is a dashed label, isolated whole`, t1.till === 'J044-0551100', String(t1.till))
  check(`${label}: the root's partner reference is a label (source · order number), one <bdi> around the pair, on the root only`, t1.partner === 'BUPA · BUPA-7781203' && t1.partnerCount === 1, String(t1.partner))
  check(`${label}: a whole family shows no cut-short warning`, !t1.truncated)
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
  for (const [no, why] of [['8009999404', 'a 404 (route not deployed)'], ['8009999403', 'a bare 403']]) {
    await open(`/oms/delivery/${no}`)
    await page.waitForTimeout(400)
    check(
      `${label}: ${why} draws nothing at all, and the page still works`,
      asked.includes(`D:${no}`) && (await section().count()) === 0 && (await page.locator('[data-family-failed]').count()) === 0 && (await page.locator('[data-facts-block]').count()) > 0,
    )
  }
  await open('/oms/delivery/8009999999')
  const failed = page.locator('#doc-family [data-family-failed]')
  await failed.waitFor({ timeout: 10000 }).catch(() => {})
  const failedCount = await failed.count()
  const failedTitle = (await section().count()) ? (await section().locator('summary').textContent()).trim() : 'no section'
  check(
    `${label}: a 500 draws the "Family" section (no count) with one quiet line inside it, in the ruled words only, and the page still works`,
    failedCount === 1 && failedTitle === 'Family' && (await failed.textContent()).trim() === "The family couldn't be loaded." &&
      (await failed.locator('bdi').count()) === 0 && (await page.locator('[data-facts-block]').count()) > 0,
    `${failedTitle} | ${failedCount ? await failed.textContent() : 'no line'}`,
  )
  if (failedCount) await section().screenshot({ path: `${SHOTS}/${dir}-failed.png` })

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// -- 6-8 (ticket 907): the big family, folded, cut short, at desktop and phone width, light and dark --
async function driveBig(dir, { dark, width }) {
  const rtl = dir === 'rtl'
  const label = `${dir} ${dark ? 'dark' : 'light'} ${width}px`
  const context = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(([d, k]) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.darkMode', String(k))
  }, [dir, dark])
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', 'DocumentDetails:03']))
    const fam = p.match(/^SdDocumentWeb\/Document\/(\d+)\/Family$/)
    if (fam) return route.fulfill(envelope({ askedNo: fam[1], askedCategory: url.searchParams.get('category'), rootNo: '1000887766', rootCategory: 'O', truncated: true, nodes: BIG }))
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    if (/\/PrescriptionSessions$/.test(p)) return route.fulfill(envelope({ sessions: [] }))
    if (/\/Callout$/.test(p)) return route.fulfill(envelope({ callouts: [] }))
    const doc = p.match(/^SdDocumentWeb\/(Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope({ ...deliveryDoc, documentNo: doc[2], documentCategory: 'D', refDocumentNo: '1000887766' }))
    return route.fulfill(envelope({}))
  })
  await page.goto(`${BASE}/oms/delivery/8005000012`)
  await page.locator('[data-spine]').waitFor({ timeout: 20000 })
  const section = page.locator('#doc-family')
  await section.waitFor({ timeout: 10000 })
  const mode = await page.evaluate(() => `${document.documentElement.classList.contains('dark')},${document.documentElement.dir || 'ltr'}`)
  check(`${label}: the theme is ${dark ? 'dark' : 'light'}, the page ${dir}`, mode === `${dark},${dir}`, mode)
  const billingsOfMiddle = () =>
    section.evaluate((s) => [...s.querySelectorAll('[data-family-member^="B:30050200"]')].map((r) => r.getAttribute('data-family-member')))
  const title = (await section.locator('summary').textContent()).replace(/\s+/g, ' ')
  check(`${label}: the title counts all thirteen members, folded ones and the orphan included`, /\(13\)/.test(title), title)
  check(`${label}: loading the page never scrolls the window`, (await page.evaluate(() => window.scrollY)) === 0)
  const orphan = await section.evaluate((s) => {
    const rows = [...s.querySelectorAll('[data-family-member]')].map((r) => r.getAttribute('data-family-member'))
    const li = s.querySelector('[data-family-member="T:6005000099"]')?.closest('li')
    return { last: rows[rows.length - 1], topLevel: li?.parentElement?.hasAttribute('data-family-tree') ?? false, href: li?.querySelector('a')?.getAttribute('href') ?? null }
  })
  check(
    `${label}: the orphan is a top-level row after the root's tree, linked by its pageKind`,
    orphan.last === 'T:6005000099' && orphan.topLevel && orphan.href === '/oms/delivery/6005000099',
    JSON.stringify(orphan),
  )
  const before = await billingsOfMiddle()
  const more = section.locator('[data-family-more="D:8005000012"]')
  const moreText = (await more.count()) ? (await more.textContent()).replace(/\s+/g, ' ') : 'no button'
  check(`${label}: six billings fold to the first, then "+ 5 more billings"`, JSON.stringify(before) === '["B:3005020001"]' && /\+\s*5 more billings/.test(moreText), `${before.join()} | ${moreText}`)
  const placed = await more.evaluate((btn) => {
    const prev = btn.closest('li').previousElementSibling
    return prev?.querySelector(':scope > [data-family-member]')?.getAttribute('data-family-member') ?? null
  })
  check(`${label}: the fold button sits right after the first billing, where the folded ones appear`, placed === 'B:3005020001', String(placed))
  check(
    `${label}: a delivery with one billing shows it, and only the six-billing delivery folds`,
    (await section.locator('[data-family-member="B:3005010001"]').count()) === 1 && (await section.locator('[data-family-more]').count()) === 1,
  )
  const warn = section.locator('[data-family-truncated]')
  const warnOk = (await warn.count()) === 1 &&
    (await warn.evaluate((w) => {
      const tree = w.parentElement.querySelector('[data-family-tree]')
      return !!(tree.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING) && w.textContent.trim() === 'Family cut short — not every document is shown.'
    }))
  check(`${label}: the cut-short warning sits under the tree, naming no cap`, warnOk, (await warn.count()) ? await warn.textContent() : 'none')
  const fit = () =>
    page.evaluate(() => {
      const rows = [...document.querySelectorAll('#doc-family [data-family-member]')]
      const whole = (el) => !el || el.scrollWidth <= el.clientWidth + 1
      const bad = rows.filter((r) => {
        const parts = ['[data-family-category]', '[data-family-no]', '[data-family-status]'].map((q) => r.querySelector(q)).filter(Boolean)
        const box = r.getBoundingClientRect()
        const mids = parts.map((e) => { const b = e.getBoundingClientRect(); return b.top + b.height / 2 })
        const oneLine = Math.max(...mids) - Math.min(...mids) <= 3 && box.height < 40
        const inside = parts.every((e) => { const b = e.getBoundingClientRect(); return b.left >= box.left - 1 && b.right <= box.right + 1 })
        return !(oneLine && inside && parts.every(whole))
      })
      return { bad: bad.map((r) => r.getAttribute('data-family-member')), pageScroll: document.documentElement.scrollWidth - window.innerWidth }
    })
  const f1 = await fit()
  check(`${label}: folded, every row is one line, badge/number/chip whole and inside it; no sideways scroll`, f1.bad.length === 0 && f1.pageScroll <= 0, `bad=${f1.bad.join()} scroll=${f1.pageScroll}`)
  await section.screenshot({ path: `${SHOTS}/big-${dir}-${dark ? 'dark' : 'light'}-${width}-folded.png` })
  await more.click()
  const after = await billingsOfMiddle()
  check(
    `${label}: "+ 5 more billings" expands all six in place, in order, and goes away`,
    JSON.stringify(after) === JSON.stringify([1, 2, 3, 4, 5, 6].map((b) => `B:300502000${b}`)) && (await section.locator('[data-family-more]').count()) === 0,
    after.join(),
  )
  const f2 = await fit()
  check(`${label}: expanded, every row still fits`, f2.bad.length === 0 && f2.pageScroll <= 0, `bad=${f2.bad.join()} scroll=${f2.pageScroll}`)
  if (width < 500) {
    const cut = await section.locator('[data-family-member="D:8005000012"] [data-family-meta]').evaluate((m) => m.scrollWidth > m.clientWidth)
    check(`${label}: at phone width the meta line is the one cut short`, cut)
  }
  const inlineStart = await section.locator('[data-family-tree] ul').first().evaluate((u, r) => {
    const cs = getComputedStyle(u)
    const l = parseFloat(cs.borderLeftWidth), rr = parseFloat(cs.borderRightWidth)
    return r ? rr > 0 && l === 0 : l > 0 && rr === 0
  }, rtl)
  check(`${label}: the indentation sits on the inline-start side`, inlineStart)
  await section.screenshot({ path: `${SHOTS}/big-${dir}-${dark ? 'dark' : 'light'}-${width}-expanded.png` })
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// -- review fixes: a deep family scrolls only its own box, once ---------------------------------------
const DEEP = [member('1000770000', 'O', null, { pageKind: 'document' })]
for (let d = 1; d <= 30; d++)
  DEEP.push(member(`80077000${String(d).padStart(2, '0')}`, 'D', ['1000770000', 'O'], { documentTypeDescription: 'Delivery', statusDescription: 'Delivered', pageKind: 'delivery' }))

async function driveDeep(dir) {
  const label = `${dir} deep`
  const context = await browser.newContext({ viewport: { width: 1280, height: 700 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  let familyReads = 0
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['DocumentList:03', 'DocumentDetails:03']))
    const fam = p.match(/^SdDocumentWeb\/Document\/(\d+)\/Family$/)
    if (fam) {
      familyReads++
      return route.fulfill(envelope({ askedNo: fam[1], askedCategory: url.searchParams.get('category'), rootNo: '1000770000', rootCategory: 'O', truncated: false, nodes: DEEP }))
    }
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    if (/\/PrescriptionSessions$/.test(p)) return route.fulfill(envelope({ sessions: [] }))
    if (/\/Callout$/.test(p)) return route.fulfill(envelope({ callouts: [] }))
    if (p === 'SdDocumentWeb/OrderDocumentList') return route.fulfill(envelope({ rows: [], limited: false }))
    const doc = p.match(/^SdDocumentWeb\/(Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope({ ...deliveryDoc, documentNo: doc[2], documentCategory: 'D', refDocumentNo: '1000770000' }))
    return route.fulfill(envelope({}))
  })
  await page.goto(`${BASE}/oms/delivery/8007700030`)
  await page.locator('[data-spine]').waitFor({ timeout: 20000 })
  await page.locator('#doc-family [data-family-open]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(400)
  const where = () =>
    page.evaluate(() => {
      const box = document.querySelector('#doc-family [data-family-scroll]')
      const row = document.querySelector('#doc-family [data-family-open]')
      const b = box.getBoundingClientRect(), r = row.getBoundingClientRect()
      return { windowY: window.scrollY, boxTop: box.scrollTop, scrollable: box.scrollHeight > box.clientHeight, rowInBox: r.top >= b.top - 1 && r.bottom <= b.bottom + 1 }
    })
  const w1 = await where()
  check(
    `${label}: the window does not scroll; the tree's own box scrolls the open row (the last of 31) into view`,
    w1.windowY === 0 && w1.scrollable && w1.boxTop > 0 && w1.rowInBox,
    JSON.stringify(w1),
  )
  await page.evaluate(() => { document.querySelector('#doc-family [data-family-scroll]').scrollTop = 0 })
  const readsBefore = familyReads
  await page.getByRole('button', { name: 'Refresh' }).click()
  for (let i = 0; i < 40 && familyReads === readsBefore; i++) await page.waitForTimeout(100)
  await page.waitForTimeout(600)
  const w2 = await where()
  check(`${label}: a Refresh re-reads the family and scrolls nothing again`, familyReads > readsBefore && w2.boxTop === 0 && w2.windowY === 0, `reads ${readsBefore}->${familyReads} ${JSON.stringify(w2)}`)
  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await driveDeep('ltr')
await driveDeep('rtl')
await driveBig('ltr', { dark: false, width: 1440 })
await driveBig('rtl', { dark: true, width: 375 })
await driveBig('ltr', { dark: true, width: 375 })
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
