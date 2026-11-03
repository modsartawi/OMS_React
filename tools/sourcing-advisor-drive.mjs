// Sourcing advisor drive (ticket 738, spec 734 D15–D21) — scenario `explain-one-order`.
//
// Drives the REAL app in Chromium against a STUB of the two doors BackOffice BO-2 has not built, answering
// EXACTLY the D20 wire (camelCase):
//   GET SourcingAdvisor/Access  → { canView }                       (granted, not granted, a bare 403)
//   GET SourcingAdvisor/Explain → { orderNo, deliveryType, city, promisedBy, actual, best, candidates[],
//                                   saving, reasons[], rateVersion, placeholderRates }
//   and `SOURCING-403` (order not found or not scored yet) for order 8000000999.
// Delivery details replays the captured `8000000253-delivery.json` (as every document drive does).
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl") it asserts:
//   1. not granted: no menu item, no "Why this store?" on delivery details, the URL shows the denied card,
//      and Explain is never asked;
//   2. a bare 403 on the probe: the same — the probe fails closed;
//   3. granted: the leaf is in the OMS group; delivery details shows "Why this store?", and it opens the
//      explanation, which asks Explain for that order;
//   4. the order (delivery type, city, promised time), actual against cheapest with km, SAR, ready and
//      travel minutes and on-time state, the saving in SAR and the reasons as sentences (an unknown code
//      falls back);
//   5. the candidate table: each row's cost as sent and its parts as sent (never re-summed, review item 3),
//      the on-time state (unknown read as Unknown) and the stock evidence;
//   6. the "placeholder rates" banner when `placeholderRates` is true, and none when false;
//   7. `SOURCING-403` reads as its sentence for an order that is not scored;
//   8. RTL: `code · name` pairs, km and SAR are `Ltr` isolates that read left to right;
//   9. no page errors;
//  9b. an order number that trims to nothing shows its empty state with a way back, never the spinner,
//      and asks nothing (review item 4).
//
//
// Scenario `thirty-day-simulation` (ticket 739, spec 734 D15/D19/D20) stubs the third door,
//   GET SourcingAdvisor/Summary → { orders, ordersWithSaving, totalSaving, avgSaving, byCity[], byChannel[],
//                                   byDeliveryType[], top[], rateVersion, placeholderRates, scoredThrough }
// and asserts, in LTR and RTL:
//   10. the leaf opens on the last 30 days ending yesterday: the headline figures as sent (the share shown),
//       the three breakdowns, and the top-savings list;
//   11. a filter re-queries (city, then channel), and the URL keeps it;
//   12. a top-list row opens its explanation;
//   13. "placeholder rates" while `placeholderRates`, none without; "Scored through <date>" when the
//       range runs past `scoredThrough`, and from a `SOURCING-404` refusal's data;
//   14. a 93-day range is refused before any call; `SOURCING-402` from the door reads as its sentence;
//   15. RTL: headline SAR and the top grid's store pairs read left to right; no page errors;
//   16. a blank breakdown key reads "Unspecified", and a top list with a repeated or blank order number
//       draws every row under its own id (review item 5).
//
//   1. run the app:  npx vite --port 5202 --strictPort
//   2. DRIVE_PORT=5202 node tools/sourcing-advisor-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5202}`
const SHOTS = 'tools/.sourcing-advisor-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// ── Fixtures, the D20 shapes exactly ───────────────────────────────────────────────────────────
const DELIVERY = '8000000253'
const UNSCORED = '8000000999'
const REAL_RATES = '8000000254'
const CAPTURE = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000253-delivery.json', 'utf8')).data

const candidate = (store, storeName, over = {}) => ({
  store,
  storeName,
  km: 2.1,
  cost: 15.5,
  costParts: { courier: 12, pick: 3.5, split: 0, express: 0 },
  onTime: true,
  stockEvidence: 'recorded',
  ...over,
})
const explain = (orderNo, over = {}) => ({
  orderNo,
  deliveryType: 'D',
  city: 'الرياض',
  promisedBy: '2026-11-02T18:00:00',
  actual: { store: 'P007', storeName: 'Malaz', km: 7.43, cost: 24.5, onTime: true, readyMins: 18, travelMins: 22 },
  best: { store: 'P002', storeName: 'Rawdah', km: 2.1, cost: 15.5, onTime: true, readyMins: 12, travelMins: 7 },
  candidates: [
    candidate('P002', 'Rawdah'),
    // Parts that do not add up to the sent cost (3.33 + 1.33 + 0.00 + 5.33 = 9.99): the cost shows 10.00, as sent.
    candidate('P010', 'Olaya', { km: 3.9, cost: 10, costParts: { courier: 3.334, pick: 1.333, split: 0, express: 5.333 }, onTime: null, stockEvidence: 'estimated' }),
    candidate('P007', 'Malaz', { km: 7.43, cost: 24.5, costParts: { courier: 21, pick: 3.5, split: 0, express: 0 } }),
    candidate('P011', 'Sulay', { km: 9.2, cost: 30.75, costParts: { courier: 24.25, pick: 3.5, split: 3 }, onTime: false }),
  ],
  saving: 9,
  reasons: ['NEARER_STORE_STOCKED', 'STOCK_ESTIMATED', 'SOMETHING_NEW'],
  rateVersion: 'placeholder-2026-11',
  placeholderRates: true,
  ...over,
})

// The Summary door (739). Dates are the drive machine's local days, as the app's.
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dayOff = (n) => {
  const d = new Date()
  return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}
const YESTERDAY = dayOff(-1)
const DEFAULT_FROM = dayOff(-30)
const RANGE_402_FROM = dayOff(-91)
const breakdownRow = (key, orders, ordersWithSaving, totalSaving, avgSaving) => ({ key, orders, ordersWithSaving, totalSaving, avgSaving })
const summary = (q) => {
  const city = q.get('city') ?? ''
  const channel = q.get('channel') ?? ''
  const narrowed = city === 'Jeddah'
  return {
    orders: narrowed ? 400 : 1240,
    ordersWithSaving: narrowed ? 50 : 312,
    totalSaving: narrowed ? 450.5 : 2808.456,
    avgSaving: narrowed ? 9.01 : 9.0015,
    byCity: narrowed ? [breakdownRow('Jeddah', 400, 50, 450.5, 9.01)] : [breakdownRow('الرياض', 840, 262, 2358, 9), breakdownRow('Jeddah', 400, 50, 450.5, 9.01)],
    byChannel: [breakdownRow('HYBR', 1000, 300, 2700, 9), breakdownRow('CMRC', 0, 0, 0, null), breakdownRow('', 5, 1, 3, 3)],
    // byDeliveryType absent: read as empty.
    top: narrowed
      ? [
          // A repeated and a blank order number: every row still draws, under its own id.
          { orderNo: DELIVERY, actualStore: 'P007', bestStore: 'P002', saving: 30, reasons: [] },
          { orderNo: DELIVERY, actualStore: 'P007', bestStore: 'P002', saving: 20, reasons: [] },
          { orderNo: '', actualStore: 'P007', bestStore: 'P002', saving: 10, reasons: [] },
        ]
      : [
      { orderNo: DELIVERY, actualStore: 'P007', actualStoreName: 'Malaz', bestStore: 'P002', bestStoreName: 'Rawdah', saving: 41.5, reasons: ['NEARER_STORE_STOCKED', 'SOMETHING_NEW'] },
      { orderNo: REAL_RATES, actualStore: 'P011', bestStore: 'P010', bestStoreName: 'Olaya', saving: 12.25, reasons: ['ACTUAL_LATE'] },
    ],
    rateVersion: channel === 'CMRC' ? 'finance-2027-01' : 'placeholder-2026-11',
    placeholderRates: channel !== 'CMRC',
    // A range ending today runs past the last scored day (yesterday).
    scoredThrough: YESTERDAY,
  }
}

// ── The harness ────────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch()

async function open(dir, { access = 'granted' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const queries = {}
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    ;(queries[p] ??= []).push(url.searchParams)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    if (p === 'SourcingAdvisor/Access') {
      // A bare 403: no envelope at all, as a route without AllowCookieSession answers.
      if (access === 'bare403') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      return route.fulfill(envelope({ canView: access === 'granted' }))
    }
    if (p === 'SourcingAdvisor/Explain') {
      const orderNo = url.searchParams.get('orderNo')
      if (orderNo === UNSCORED)
        return route.fulfill(
          envelope(null, {
            status: 404,
            success: false,
            message: 'Order not found or not scored yet.',
            errors: [{ errorCode: 'SOURCING-403', internalErrorCode: '', errorMessage: 'Order not found or not scored yet.' }],
          }),
        )
      if (orderNo === REAL_RATES) return route.fulfill(envelope(explain(orderNo, { placeholderRates: false, rateVersion: 'finance-2027-01' })))
      return route.fulfill(envelope(explain(orderNo)))
    }
    if (p === 'SourcingAdvisor/Summary') {
      const q = url.searchParams
      if (q.get('city') === 'Tabuk')
        return route.fulfill(
          envelope({ scoredThrough: dayOff(-3) }, {
            status: 409,
            success: false,
            message: 'Scoring has not run for part of the range.',
            errors: [{ errorCode: 'SOURCING-404', internalErrorCode: '', errorMessage: 'Scoring has not run for part of the range.' }],
          }),
        )
      if (q.get('from') === RANGE_402_FROM)
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'Range over 92 days.',
            errors: [{ errorCode: 'SOURCING-402', internalErrorCode: '', errorMessage: 'Range over 92 days.' }],
          }),
        )
      return route.fulfill(envelope(summary(q)))
    }
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(doc[1] === DELIVERY ? CAPTURE : null))
    if (/\/(Logs|Outbox|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canView: false, canViewServingLists: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, queries }
}

const omsLinks = (page) => page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

/** Whether a text reads left to right on screen: its first character's box starts left of its last's. */
const readsLtr = (locator) =>
  locator.evaluate((el) => {
    const text = el.textContent.trim()
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = null
    let at = -1
    while (walker.nextNode()) {
      const i = walker.currentNode.textContent.indexOf(text)
      if (i >= 0) {
        node = walker.currentNode
        at = i
        break
      }
    }
    if (!node) return null
    const box = (k) => {
      const r = document.createRange()
      r.setStart(node, k)
      r.setEnd(node, k + 1)
      return r.getBoundingClientRect()
    }
    return box(at).left < box(at + text.length - 1).left
  })

/** An element is an `Ltr` isolate: a `<bdi dir="ltr">`. */
const isLtrIsolate = (locator) => locator.evaluate((el) => el.tagName === 'BDI' && el.getAttribute('dir') === 'ltr')

const WORDS = {
  denied: 'No access to the sourcing advisor',
  why: 'Why this store?',
  notScored: `Order ${UNSCORED} is not found, or has not been scored yet.`,
}

async function drive(dir) {
  const label = dir.toUpperCase()

  // 1. Not granted.
  {
    const { context, page, errors, calls } = await open(dir, { access: 'denied' })
    await page.goto(`${BASE}/oms/delivery/${DELIVERY}`)
    await page.locator('[data-header-no]').waitFor({ timeout: 20000 })
    await page.locator('[data-now-step]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1200)
    const links = await omsLinks(page)
    check(`${label}: not granted — no menu item`, !links.includes('/oms/sourcing-advisor'), links.join(' '))
    check(`${label}: not granted — no "Why this store?" on delivery details`, (await page.locator('[data-why-this-store]').count()) === 0)
    await page.goto(`${BASE}/oms/sourcing-advisor/order/${DELIVERY}`)
    const denied = page.locator('[role="alert"]', { hasText: WORDS.denied })
    await denied.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(`${label}: not granted — the URL shows the denied card and never asks Explain`, !calls.includes('SourcingAdvisor/Explain'))
    check(`${label}: no page errors (not granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 2. A bare 403 on the probe.
  {
    const { context, page, errors, calls } = await open(dir, { access: 'bare403' })
    await page.goto(`${BASE}/oms/delivery/${DELIVERY}`)
    await page.locator('[data-now-step]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1200)
    const links = await omsLinks(page)
    check(
      `${label}: a bare 403 on the probe — no menu item and no link`,
      !links.includes('/oms/sourcing-advisor') && (await page.locator('[data-why-this-store]').count()) === 0,
    )
    await page.goto(`${BASE}/oms/sourcing-advisor/order/${DELIVERY}`)
    const denied = page.locator('[role="alert"]', { hasText: WORDS.denied })
    await denied.waitFor({ timeout: 20000 })
    check(`${label}: a bare 403 — the denied card, no Explain call`, !calls.includes('SourcingAdvisor/Explain'))
    check(`${label}: no page errors (bare 403)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 3–9. Granted.
  {
    const { context, page, errors, queries } = await open(dir)
    await page.goto(`${BASE}/oms/delivery/${DELIVERY}`)
    await page.locator('nav a[href="/oms/sourcing-advisor"]').first().waitFor({ timeout: 20000 })
    check(`${label}: granted — the leaf is in the OMS group`, (await omsLinks(page)).includes('/oms/sourcing-advisor'))
    const why = page.locator('[data-why-this-store]')
    await why.waitFor({ timeout: 20000 })
    check(`${label}: granted — delivery details shows "Why this store?"`, (await why.innerText()).trim() === WORDS.why, await why.innerText())
    await why.click()
    await page.locator('[data-sourcing-explain]').waitFor({ timeout: 20000 })
    check(
      `${label}: the link opens the explanation, asking Explain for that order`,
      new URL(page.url()).pathname === `/oms/sourcing-advisor/order/${DELIVERY}` &&
        queries['SourcingAdvisor/Explain']?.at(-1)?.get('orderNo') === DELIVERY,
      page.url(),
    )
    await page.screenshot({ path: `${SHOTS}/explain-${dir}.png`, fullPage: true })

    // 4. The order, actual against cheapest, the saving and the reasons.
    const fact = (scope, attr) => page.locator(`${scope} [data-fact="${attr}"] dd`)
    const order = '[data-sourcing-card="order"]'
    check(
      `${label}: the order — number, delivery type, city, promised time`,
      (await fact(order, 'orderNo').innerText()).trim() === DELIVERY &&
        (await fact(order, 'deliveryType').innerText()).trim() === 'D' &&
        (await fact(order, 'city').innerText()).trim() === 'الرياض' &&
        (await fact(order, 'promisedBy').innerText()).includes('18:00'),
      [await fact(order, 'deliveryType').innerText(), await fact(order, 'city').innerText(), await fact(order, 'promisedBy').innerText()].join(' | '),
    )
    const sideText = async (attr) => {
      const s = `[data-sourcing-side="${attr}"]`
      return {
        store: (await page.locator(`${s} [data-side-store]`).innerText()).trim(),
        km: (await fact(s, 'km').innerText()).trim(),
        cost: (await fact(s, 'cost').innerText()).trim(),
        ready: (await fact(s, 'ready').innerText()).trim(),
        travel: (await fact(s, 'travel').innerText()).trim(),
        onTime: await page.locator(`${s} [data-fact="onTime"] [data-on-time]`).getAttribute('data-on-time'),
      }
    }
    const actual = await sideText('actual')
    const best = await sideText('best')
    check(
      `${label}: actual — P007 · Malaz, 7.4 km, SAR 24.50, ready 18 min, travel 22 min, on time`,
      JSON.stringify(actual) === JSON.stringify({ store: 'P007 · Malaz', km: '7.4 km', cost: 'SAR 24.50', ready: '18 min', travel: '22 min', onTime: 'yes' }),
      JSON.stringify(actual),
    )
    check(
      `${label}: cheapest on time — P002 · Rawdah, 2.1 km, SAR 15.50, ready 12 min, travel 7 min, on time`,
      JSON.stringify(best) === JSON.stringify({ store: 'P002 · Rawdah', km: '2.1 km', cost: 'SAR 15.50', ready: '12 min', travel: '7 min', onTime: 'yes' }),
      JSON.stringify(best),
    )
    const saving = page.locator('[data-sourcing-saving]')
    check(`${label}: the saving in SAR`, (await saving.getAttribute('data-sourcing-saving')) === 'shown' && (await saving.innerText()).trim() === 'Estimated saving: SAR 9.00', await saving.innerText())
    const reasons = await page.locator('[data-sourcing-reasons] li').allInnerTexts()
    check(
      `${label}: the reasons are sentences built from the codes; an unknown code falls back`,
      reasons.length === 3 &&
        reasons[0] === 'A nearer store had the stock and was on time.' &&
        reasons[1].startsWith('Some stock is estimated') &&
        reasons[2] === 'Another reason the advisor recorded (SOMETHING_NEW).',
      reasons.join(' | '),
    )

    // 5. The candidate table.
    const rows = await page.locator('[data-sourcing-candidates] tbody tr').evaluateAll((trs) =>
      trs.map((tr) => {
        const cell = (c) => tr.querySelector(`[data-cell="${c}"]`)?.textContent.trim()
        return {
          store: cell('store'),
          parts: ['courier', 'pick', 'split', 'express'].map(cell),
          cost: cell('cost'),
          onTime: tr.querySelector('[data-cell="onTime"] [data-on-time]')?.getAttribute('data-on-time'),
          stock: cell('stock'),
          actual: tr.hasAttribute('data-actual'),
          best: tr.hasAttribute('data-best'),
        }
      }),
    )
    check(`${label}: four candidate rows, in the order sent`, rows.map((r) => r.store).join(',') === 'P002 · Rawdah,P010 · Olaya,P007 · Malaz,P011 · Sulay', rows.map((r) => r.store).join(','))
    check(
      `${label}: each row shows the cost as sent and its parts as sent — never re-summed`,
      rows.map((r) => r.cost).join(',') === '15.50,10.00,24.50,30.75' && rows[1].parts.join(',') === '3.33,1.33,0.00,5.33' && rows[3].parts.join(',') === '24.25,3.50,3.00,—',
      JSON.stringify(rows.map((r) => [r.parts, r.cost])),
    )
    check(
      `${label}: on-time state per row — on time, unknown, on time, late`,
      rows.map((r) => r.onTime).join(',') === 'yes,unknown,yes,no' && (await page.locator('[data-candidate="P010 · Olaya"] [data-cell="onTime"]').innerText()).trim() === 'Unknown',
      rows.map((r) => r.onTime).join(','),
    )
    check(`${label}: stock evidence — recorded or estimated`, rows.map((r) => r.stock).join(',') === 'Recorded,Estimated,Recorded,Recorded', rows.map((r) => r.stock).join(','))
    check(`${label}: the actual and the cheapest rows are marked`, rows[2].actual && !rows[2].best && rows[0].best && !rows[0].actual)

    // 6. The placeholder banner.
    const banner = page.locator('[data-sourcing-placeholder]')
    check(
      `${label}: placeholderRates true — the "placeholder rates" banner, with the rate version`,
      (await banner.count()) === 1 && (await banner.innerText()).includes('Placeholder rates') && (await banner.innerText()).includes('placeholder-2026-11'),
    )

    // 8. RTL isolation (asserted in both directions; it only matters under RTL).
    const pair = page.locator('[data-sourcing-side="actual"] [data-side-store] bdi')
    const km = page.locator('[data-sourcing-side="actual"] [data-fact="km"] bdi')
    const sar = page.locator('[data-sourcing-side="best"] [data-fact="cost"] bdi')
    const cellPair = page.locator('[data-candidate="P002 · Rawdah"] [data-cell="store"] bdi')
    const cellCost = page.locator('[data-candidate="P010 · Olaya"] [data-cell="cost"] bdi')
    const savingAmount = page.locator('[data-sourcing-saving] bdi')
    check(
      `${label}: code · name pairs, km and SAR are Ltr isolates`,
      (await isLtrIsolate(pair)) && (await isLtrIsolate(km)) && (await isLtrIsolate(sar)) && (await isLtrIsolate(cellPair)) && (await isLtrIsolate(cellCost)) && (await isLtrIsolate(savingAmount)),
    )
    check(
      `${label}: each reads left to right on screen`,
      (await readsLtr(pair)) === true && (await readsLtr(km)) === true && (await readsLtr(sar)) === true && (await readsLtr(cellPair)) === true && (await readsLtr(savingAmount)) === true,
      [await readsLtr(pair), await readsLtr(km), await readsLtr(sar), await readsLtr(cellPair), await readsLtr(savingAmount)].join(','),
    )
    check(`${label}: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

    // 6b. Real rates: no banner.
    await page.goto(`${BASE}/oms/sourcing-advisor/order/${REAL_RATES}`)
    await page.locator('[data-sourcing-explain]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(200)
    check(`${label}: placeholderRates false — no banner`, (await page.locator('[data-sourcing-placeholder]').count()) === 0)

    // 7. SOURCING-403.
    await page.goto(`${BASE}/oms/sourcing-advisor/order/${UNSCORED}`)
    const refusal = page.locator('[data-sourcing-refusal]')
    await refusal.waitFor({ timeout: 20000 })
    check(
      `${label}: SOURCING-403 — the order is not scored, in its own sentence`,
      (await refusal.getAttribute('data-sourcing-refusal')) === 'refusal.notScored' && (await refusal.innerText()).replace(/[⁦-⁩]/g, '').includes(WORDS.notScored) &&
        // The order number rides the sentence as one FSI…PDI isolate (`fsi`, a `t()` interpolation).
        (await refusal.innerText()).includes(`⁨${UNSCORED}⁩`),
      await refusal.innerText(),
    )
    await page.screenshot({ path: `${SHOTS}/refusal-${dir}.png` })

    // 9b. A blank order number: its empty state and a way back, never the spinner, no Explain call.
    const asked = queries['SourcingAdvisor/Explain']?.length ?? 0
    await page.goto(`${BASE}/oms/sourcing-advisor/order/%20`)
    const noOrder = page.locator('[data-sourcing-no-order]')
    await noOrder.waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    check(
      `${label}: a blank order number shows its empty state with a back link, no spinner and no call`,
      (await page.locator('main [role="status"]').count()) === 0 &&
        (await noOrder.locator('a[data-sourcing-back]').getAttribute('href')) === '/oms/sourcing-advisor' &&
        (queries['SourcingAdvisor/Explain']?.length ?? 0) === asked,
      await noOrder.innerText(),
    )

    // The entry: the leaf's target opens an order by number.
    await page.goto(`${BASE}/oms/sourcing-advisor`)
    const input = page.locator('[data-sourcing-lookup] input')
    await input.waitFor({ timeout: 20000 })
    await input.fill(` ${REAL_RATES} `)
    await page.locator('[data-sourcing-lookup] button[type="submit"]').click()
    await page.locator('[data-sourcing-explain]').waitFor({ timeout: 20000 })
    check(`${label}: the entry opens an order's explanation by its number`, new URL(page.url()).pathname === `/oms/sourcing-advisor/order/${REAL_RATES}`, page.url())

    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

// ── Scenario `thirty-day-simulation` (739) ─────────────────────────────────────────────────────
async function thirtyDaySimulation(dir) {
  const label = `${dir.toUpperCase()} 739`
  const { context, page, errors, queries } = await open(dir)
  const summaryQs = () => queries['SourcingAdvisor/Summary'] ?? []
  const lastQ = () => summaryQs().at(-1)
  const tile = (attr) => page.locator(`[data-tile="${attr}"] [data-tile-value]`)
  const clean = (s) => s.replace(/[\u2066-\u2069]/g, '').trim()

  // 10. The leaf opens on the last 30 days.
  await page.goto(`${BASE}/oms/sourcing-advisor`)
  await page.locator('[data-sourcing-headline]').waitFor({ timeout: 20000 })
  check(
    `${label}: opens on the last 30 days, ending yesterday`,
    lastQ()?.get('from') === DEFAULT_FROM && lastQ()?.get('to') === YESTERDAY && !lastQ()?.has('city'),
    lastQ()?.toString(),
  )
  check(`${label}: the default range writes nothing to the URL`, new URL(page.url()).search === '', page.url())
  const head = {
    orders: clean(await tile('orders').innerText()),
    withSaving: clean(await tile('ordersWithSaving').innerText()),
    total: clean(await tile('totalSaving').innerText()),
    avg: clean(await tile('avgSaving').innerText()),
  }
  const sarText = (v) => `SAR ${v}`
  check(
    `${label}: headline — orders, with a saving and their share, total and average SAR as sent`,
    head.orders === '1240' && head.withSaving.replace(/\s+/g, '') === '31225.2%' &&
      clean(await page.locator('[data-tile="ordersWithSaving"] [data-share]').innerText()) === '25.2%' &&
      (await readsLtr(page.locator('[data-tile="ordersWithSaving"] [data-share] bdi'))) === true && head.total === sarText('2808.46') && head.avg === sarText('9.00'),
    JSON.stringify(head),
  )
  const bRows = (attr) => page.locator(`[data-sourcing-breakdown="${attr}"] tbody tr`).evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-breakdown-row')))
  check(`${label}: by city — two rows`, (await bRows('city')).join(',') === 'الرياض,Jeddah', (await bRows('city')).join(','))
  check(
    `${label}: by channel — a zero-order row has no share`,
    (await page.locator('[data-breakdown-row="CMRC"] [data-share]').count()) === 0 && (await page.locator('[data-breakdown-row="HYBR"] [data-share]').count()) === 1,
  )
  const blankKey = page.locator('[data-sourcing-breakdown="channel"] [data-breakdown-row=""] [data-cell="key"]')
  check(
    `${label}: a blank breakdown key reads "Unspecified"`,
    (await blankKey.count()) === 1 && ['Unspecified', 'غير محدد'].includes(clean(await blankKey.innerText())),
    await blankKey.innerText().catch(() => 'absent'),
  )
  check(`${label}: by delivery type absent — read as empty`, (await page.locator('[data-sourcing-breakdown="deliveryType"] table').count()) === 0)
  const topRows = await page.locator('[data-sourcing-top] .ag-row[row-id]').evaluateAll((rows) =>
    rows.map((r) => ['orderNo', 'actualStore', 'bestStore', 'saving'].map((c) => r.querySelector(`[col-id="${c}"]`)?.textContent.trim())),
  )
  check(
    `${label}: the top list — order, stores as code · name, saving to the halala`,
    JSON.stringify(topRows.map((r) => r.map(clean))) ===
      JSON.stringify([
        [DELIVERY, 'P007 · Malaz', 'P002 · Rawdah', '41.50'],
        [REAL_RATES, 'P011', 'P010 · Olaya', '12.25'],
      ]),
    JSON.stringify(topRows),
  )
  const reasons = await page.locator(`[data-sourcing-top] [row-id="0:${DELIVERY}"] [data-reason]`).allInnerTexts()
  check(
    `${label}: top reasons are sentences from the codes; an unknown one falls back`,
    dir === 'rtl' ? reasons.length === 2 : reasons.join(' | ') === 'A nearer store had the stock and was on time. | Another reason the advisor recorded (SOMETHING_NEW).',
    reasons.join(' | '),
  )

  // 13a. Placeholder rates on; the default range is scored through: no scored-through banner.
  check(`${label}: placeholderRates true — the banner`, (await page.locator('[data-sourcing-placeholder]').count()) === 1)
  check(`${label}: range fully scored — no "scored through"`, (await page.locator('[data-sourcing-scored-through]').count()) === 0)

  // 15. RTL isolation.
  const totalBdi = page.locator('[data-tile="totalSaving"] bdi')
  const pairCell = page.locator(`[data-sourcing-top] [row-id="0:${DELIVERY}"] [col-id="actualStore"] bdi`)
  check(`${label}: headline SAR and a top store pair read left to right`, (await isLtrIsolate(totalBdi)) && (await readsLtr(totalBdi)) === true && (await readsLtr(pairCell)) === true)
  await page.screenshot({ path: `${SHOTS}/summary-${dir}.png`, fullPage: true })

  // 11. A filter re-queries.
  const before = summaryQs().length
  await page.locator('[data-sourcing-filter="city"]').fill('Jeddah')
  await page.locator('[data-sourcing-apply]').click()
  await page.waitForFunction(() => document.querySelector('[data-tile="orders"] [data-tile-value]')?.textContent.includes('400'), null, { timeout: 20000 })
  check(
    `${label}: a city filter re-queries, keeping the range, and the URL keeps it`,
    summaryQs().length > before && lastQ()?.get('city') === 'Jeddah' && lastQ()?.get('from') === DEFAULT_FROM && new URL(page.url()).searchParams.get('city') === 'Jeddah',
    lastQ()?.toString(),
  )
  await page.locator('[data-sourcing-top] .ag-row[row-id="2:"]').first().waitFor({ timeout: 20000 }).catch(() => {})
  const narrowedIds = await page
    .locator('[data-sourcing-top] .ag-row[row-id]')
    .evaluateAll((rows) => [...new Set(rows.map((r) => r.getAttribute('row-id')))])
  check(
    `${label}: a repeated and a blank order number — every top row drawn, each under its own id`,
    JSON.stringify(narrowedIds) === JSON.stringify([`0:${DELIVERY}`, `1:${DELIVERY}`, '2:']),
    JSON.stringify(narrowedIds),
  )
  await page.locator('[data-sourcing-filter="channel"]').fill('CMRC')
  await page.locator('[data-sourcing-filter="channel"]').press('Enter')
  await page.waitForFunction(() => !document.querySelector('[data-sourcing-placeholder]'), null, { timeout: 20000 })
  check(`${label}: a channel filter re-queries; real rates — no placeholder banner`, lastQ()?.get('channel') === 'CMRC' && lastQ()?.get('city') === 'Jeddah')

  // 13b. A range ending today runs past the scored day.
  await page.goto(`${BASE}/oms/sourcing-advisor?from=${DEFAULT_FROM}&to=${dayOff(0)}`)
  const through = page.locator('[data-sourcing-scored-through]')
  await through.waitFor({ timeout: 20000 })
  check(
    `${label}: a range past scoredThrough — "Scored through <date>"`,
    (await through.getAttribute('data-sourcing-scored-through')) === YESTERDAY && clean(await through.innerText()).includes(YESTERDAY) && (dir === 'rtl' || (await through.innerText()).includes('Scored through')),
    await through.innerText(),
  )

  // 13c. SOURCING-404 with its scoredThrough.
  await page.goto(`${BASE}/oms/sourcing-advisor?city=Tabuk`)
  await page.locator('[data-sourcing-scored-through]').waitFor({ timeout: 20000 })
  check(
    `${label}: SOURCING-404 — "Scored through" from the refusal's data, no figures`,
    (await page.locator('[data-sourcing-scored-through]').getAttribute('data-sourcing-scored-through')) === dayOff(-3) &&
      (await page.locator('[data-sourcing-headline]').count()) === 0 && (await page.locator('[data-sourcing-refusal]').count()) === 0,
  )

  // 14. Refused before the call, then by the door.
  const n = summaryQs().length
  await page.goto(`${BASE}/oms/sourcing-advisor?from=${dayOff(-93)}&to=${YESTERDAY}`)
  await page.locator('[data-sourcing-problem="tooLong"]').waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  check(`${label}: 93 days — refused on screen, no Summary call`, summaryQs().length === n && (await page.locator('[data-sourcing-headline]').count()) === 0)
  await page.goto(`${BASE}/oms/sourcing-advisor?from=${RANGE_402_FROM}&to=${YESTERDAY}`)
  const refusal = page.locator('[data-sourcing-refusal]')
  await refusal.waitFor({ timeout: 20000 })
  check(
    `${label}: SOURCING-402 from the door — its own sentence`,
    (await refusal.getAttribute('data-sourcing-refusal')) === 'refusal.badRange' && (dir === 'rtl' || (await refusal.innerText()).includes('The range is at most 92 days')),
    await refusal.innerText(),
  )

  // 12. A top-list row opens its explanation.
  await page.goto(`${BASE}/oms/sourcing-advisor`)
  const link = page.locator(`[data-sourcing-top-link="${DELIVERY}"]`)
  await link.waitFor({ timeout: 20000 })
  await link.click()
  await page.locator('[data-sourcing-explain]').waitFor({ timeout: 20000 })
  check(
    `${label}: a top-list row opens its explanation`,
    new URL(page.url()).pathname === `/oms/sourcing-advisor/order/${DELIVERY}` && queries['SourcingAdvisor/Explain']?.at(-1)?.get('orderNo') === DELIVERY,
    page.url(),
  )

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
  await thirtyDaySimulation('ltr')
  await thirtyDaySimulation('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
