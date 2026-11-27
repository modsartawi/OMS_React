// Last orders with *Reorder all*, and usually-buys chips (ticket 990, spec 983 D11, contract
// v1.13 C2) — drives the REAL app in Chromium, the wire stubbed at Playwright. The history read
// is a stub of exactly BackOffice 4455's shape (the server half is unbuilt).
//
//   1. run the app:  npx vite --port 5210 --strictPort
//   2. DRIVE_PORT=5210 node tools/callcenter-history-drive.mjs
//
// Asserts, in light/ltr and light/rtl (ar) at 1280:
//   1. no history read and no panel before a caller is attached;
//   2. the attach reads it ONCE, and the panel sits between the caller and the address book;
//   3. an order card: `number · date` isolated once, the payable, the items in short;
//   4. *Reorder all* sends one AddItem per line, one at a time, each its own requestId and the
//      line's own qty + uom; a refused line shows the server's message and the rest continue;
//      the toast says "2 / 3 added";
//   5. a usual chip is ONE AddItem of qty 1;
//   6. a BUSY that outlives the schedule stops the loop: nothing after it is sent, and the
//      report offers *Add the remaining*;
//   7. no re-read across the whole call;
//   8. a degraded read (null lists) is *could not load* with Retry, never "no history".
// Screenshots → tools/.callcenter-history-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`
const SHOTS = 'tools/.callcenter-history-shots'
mkdirSync(SHOTS, { recursive: true })

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
    .response.body.data

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const refused = (code, message) => ({
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 409,
    success: false,
    message,
    errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }],
    data: code === 'SESSION_BUSY' ? { retryAfterMs: 400 } : null,
  }),
})

let pass = 0
let fail = 0
const ok = (c, m, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

const OPENED = fixture('01-open-empty').state
const FOUND_MOBILE = '0501076360'
const MEMBER = { loyId: 'C-1000000034', mobile: '966501076360', fullName: 'Fatimah Al-Otaibi', tier: 'Gold', pointsBalance: 4120, email: 'f@example.com' }

/** ⚠ STUB: attached, with a store chosen so the door accepts adds. */
const ATTACHED = {
  ...OPENED,
  version: OPENED.version + 1,
  header: {
    ...OPENED.header,
    customer: { customerId: MEMBER.loyId, name: MEMBER.fullName, mobile: MEMBER.mobile, loyaltyAttached: true },
  },
  capabilities: {
    ...OPENED.capabilities,
    canAddItem: true,
    canOpenAddressBook: true,
    capabilityReasons: {},
    submitBlockers: OPENED.capabilities.submitBlockers.filter((code) => code !== 'NO_CUSTOMER'),
  },
}

/** ⚠ STUB of exactly C2 / BackOffice 4455. */
const HISTORY = {
  orders: [
    {
      orderNumber: '1000004417',
      date: '2026-11-20T10:12:00',
      channel: 'CallCenter',
      status: 'Delivered',
      payable: 64.3,
      items: [
        { itemNumber: '100001', description: 'PANADOL EXTRA 24', qty: 2, uom: 'PAC' },
        { itemNumber: '100002', description: 'VITAMIN C 1000', qty: 1, uom: 'EA' },
        { itemNumber: '100003', description: 'NIVEA CREAM 50ML', qty: 1, uom: 'EA' },
      ],
    },
    {
      orderNumber: '1000003990',
      date: '2026-10-02T18:40:00',
      channel: 'Store',
      status: 'Completed',
      payable: 120,
      items: [
        { itemNumber: '200001', description: 'BUSY ITEM A', qty: 1, uom: 'EA' },
        { itemNumber: '200002', description: 'BUSY ITEM B', qty: 1, uom: 'EA' },
        { itemNumber: '200003', description: 'BUSY ITEM C', qty: 1, uom: 'EA' },
        { itemNumber: '200004', description: 'BUSY ITEM D', qty: 1, uom: 'EA' },
      ],
    },
  ],
  usual: Array.from({ length: 8 }, (_, i) => ({
    itemNumber: `30000${i}`,
    description: i === 0 ? 'بانادول أكسترا' : `USUAL ITEM ${i}`,
    timesBought: 8 - i,
  })),
}

const browser = await chromium.launch()

async function open({ dir }, { history = HISTORY } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const wire = []
  const adds = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  let state = OPENED
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    wire.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['CallCenter:03']))
    if (p === 'CallCenterWeb/Open') return route.fulfill(envelope({ outcome: 'opened', state, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(state))
    if (p.startsWith('CallCenterWeb/MemberByMobile/')) return route.fulfill(envelope(MEMBER))
    if (p === 'CallCenterWeb/AttachCustomer') return route.fulfill(envelope((state = ATTACHED)))
    if (p === 'CallCenterWeb/CustomerHistory') return route.fulfill(envelope(history))
    if (p === 'CallCenterWeb/AddItem') {
      const body = JSON.parse(route.request().postData())
      adds.push({ ...body, at: Date.now() })
      // A slow answer, so a parallel loop would be visible as overlapping adds.
      await new Promise((r) => setTimeout(r, 60))
      if (body.itemNumber === '100002') return route.fulfill(refused('ITEM_NOT_FOUND', 'Item 100002 is blocked at this store.'))
      if (body.itemNumber === '200002') return route.fulfill(refused('SESSION_BUSY', 'The order is busy.'))
      state = { ...state, version: state.version + 1 }
      return route.fulfill(envelope(state))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.locator('[data-cc-caller-bar]').waitFor({ timeout: 180_000 })
  await page.waitForLoadState('networkidle')
  return { context, page, errors, wire, adds }
}

const attach = async (page) => {
  await page.locator('#cc-phone').fill(FOUND_MOBILE)
  await page.keyboard.press('Enter')
  await page.locator('[data-cc-attach]').click()
  await page.locator('[data-cc-caller]').waitFor({ timeout: 10_000 })
}

const reads = (wire) => wire.filter((p) => p === 'CallCenterWeb/CustomerHistory').length

for (const mode of [{ dir: 'ltr' }, { dir: 'rtl' }]) {
  const at = mode.dir
  console.log(`\n${at}`)
  const { context, page, errors, wire, adds } = await open(mode)

  // 1. Nothing before attach.
  ok(reads(wire) === 0, `${at}: no history read before a caller is attached`)
  ok((await page.locator('[data-cc-history]').count()) === 0, `${at}: no history panel before attach`)

  // 2. One read on attach, in the column's slot.
  await attach(page)
  await page.locator('[data-cc-history-order="1000004417"]').waitFor({ timeout: 10_000 })
  ok(reads(wire) === 1, `${at}: the attach reads the history once`, `${reads(wire)}`)
  const order = await page.evaluate(() => {
    const col = document.querySelector('[data-cc-col="caller"]')
    const kids = [...col.children]
    const hist = col.querySelector('[data-cc-history]')
    const idx = kids.indexOf(hist)
    const card = document.querySelector('[data-cc-history-order="1000004417"]')
    const id = card.querySelector('[data-cc-history-order-id]')
    return {
      afterCaller: idx === 1 && kids[0].matches('[data-cc-caller-bar]'),
      beforeBook: !col.querySelector('[data-cc-address-cards]') || kids.indexOf(col.querySelector('[data-cc-address-cards]')) > idx,
      idText: id.textContent,
      idIsolated: id.closest('bdi')?.getAttribute('dir') === 'ltr',
      cardText: card.innerText,
      chips: document.querySelectorAll('[data-cc-usual-chip]').length,
      orders: document.querySelectorAll('[data-cc-history-order]').length,
    }
  })
  ok(order.afterCaller, `${at}: the history sits right under the caller`)
  ok(order.beforeBook, `${at}: …and above the address book`)
  ok(/^1000004417 · 20 Nov 2026$/.test(order.idText), `${at}: the order reads number · date`, order.idText)
  ok(order.idIsolated, `${at}: number · date is isolated once, LTR`)
  ok(/64\.30/.test(order.cardText) && /PANADOL EXTRA 24/.test(order.cardText), `${at}: the card shows the payable and the items`)
  ok(order.orders === 2 && order.chips === 8, `${at}: 2 orders and 8 usual chips`, `${order.orders}/${order.chips}`)
  await page.screenshot({ path: `${SHOTS}/light-${at}-attached.png` })

  // 4. Reorder all, with a refusal on line 2.
  await page.locator('[data-cc-reorder="1000004417"]').click()
  await page.locator('[data-cc-reorder-report="1000004417"]').waitFor({ timeout: 10_000 })
  const first = adds.slice(0, 3)
  ok(adds.length === 3, `${at}: Reorder all sends one AddItem per line`, `${adds.length}`)
  ok(
    first.map((a) => `${a.itemNumber}x${a.qty}${a.uom}`).join(',') === '100001x2PAC,100002x1EA,100003x1EA',
    `${at}: in the order's order, with each line's qty and uom`,
    first.map((a) => `${a.itemNumber}x${a.qty}${a.uom}`).join(','),
  )
  ok(new Set(first.map((a) => a.requestId)).size === 3, `${at}: each line its own requestId`)
  ok(first.every((a, i) => i === 0 || a.at - first[i - 1].at >= 50), `${at}: one at a time, never in parallel`)
  const reportText = await page.locator('[data-cc-reorder-refused="100002"]').innerText()
  ok(/blocked at this store/.test(reportText) && /VITAMIN C/.test(reportText), `${at}: the refused line shows the server's message`, reportText)
  const toast = await page.locator('[data-sonner-toast]').first().innerText().catch(() => '')
  ok(/2 \/ 3/.test(toast), `${at}: the toast says 2 / 3 added`, toast)
  await page.screenshot({ path: `${SHOTS}/light-${at}-reordered.png` })
  await page.locator('[data-cc-reorder-dismiss]').click()

  // 5. A usual chip is one add of qty 1.
  const before = adds.length
  await page.locator('[data-cc-usual-chip="300003"]').click()
  await page.waitForFunction((n) => document.querySelectorAll('[data-cc-usual-chip][disabled]').length === 0, null, { timeout: 5000 })
  await page.waitForTimeout(300)
  const chipAdds = adds.slice(before)
  ok(chipAdds.length === 1 && chipAdds[0].itemNumber === '300003' && chipAdds[0].qty === 1, `${at}: a chip is ONE add of qty 1`, JSON.stringify(chipAdds.map((a) => [a.itemNumber, a.qty])))

  // 6. BUSY stops the loop.
  const pre = adds.length
  await page.locator('[data-cc-reorder="1000003990"]').click()
  await page.locator('[data-cc-reorder-stopped="busy"]').waitFor({ timeout: 20_000 })
  const busyAdds = adds.slice(pre).map((a) => a.itemNumber)
  ok(busyAdds[0] === '200001' && busyAdds.slice(1).every((n) => n === '200002'), `${at}: nothing after the busy line is sent`, busyAdds.join(','))
  ok(busyAdds.filter((n) => n === '200002').length === 6, `${at}: the busy line rode the contract schedule (6 attempts)`)
  ok((await page.locator('[data-cc-reorder-rest="1000003990"]').count()) === 1, `${at}: the report offers Add the remaining`)
  ok(/3/.test(await page.locator('[data-cc-reorder-stopped="busy"]').innerText()), `${at}: it counts the 3 not tried`)
  await page.screenshot({ path: `${SHOTS}/light-${at}-busy.png` })

  // 7. Never re-read.
  ok(reads(wire) === 1, `${at}: still one history read across the call`, `${reads(wire)}`)
  ok(errors.length === 0, `${at}: no page errors`, errors.join(' | '))
  await context.close()
}

// 8. Degraded.
{
  console.log('\ndegraded')
  const { context, page, wire } = await open({ dir: 'ltr' }, { history: { orders: null, usual: null } })
  await attach(page)
  await page.locator('[data-cc-history-error="orders"]').waitFor({ timeout: 10_000 })
  ok((await page.locator('[data-cc-history-empty]').count()) === 0, 'null lists never read as "no history"')
  ok((await page.locator('[data-cc-history-error="usual"]').count()) === 1, 'both lists say could not load')
  await page.locator('[data-cc-history-retry]').click()
  await page.waitForTimeout(500)
  ok(reads(wire) === 2, 'Retry re-reads', `${reads(wire)}`)
  await page.screenshot({ path: `${SHOTS}/light-ltr-degraded.png` })
  await context.close()
}

await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
