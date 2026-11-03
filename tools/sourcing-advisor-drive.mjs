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
//   5. the candidate table: each row's cost parts add up to its cost, the on-time state (unknown read as
//      Unknown) and the stock evidence;
//   6. the "placeholder rates" banner when `placeholderRates` is true, and none when false;
//   7. `SOURCING-403` reads as its sentence for an order that is not scored;
//   8. RTL: `code · name` pairs, km and SAR are `Ltr` isolates that read left to right;
//   9. no page errors.
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
    // Parts that round apart from the sent cost: 3.33 + 1.33 + 0.00 + 5.33 = 9.99 on screen.
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
    const adds = rows.every((r) => {
      const sum = r.parts.reduce((s, v) => s + (v === '—' ? 0 : Math.round(Number(v) * 100)), 0)
      return sum === Math.round(Number(r.cost) * 100)
    })
    check(
      `${label}: each row's cost parts add up to its cost as shown`,
      adds && rows[1].parts.join(',') === '3.33,1.33,0.00,5.33' && rows[1].cost === '9.99' && rows[3].parts.join(',') === '24.25,3.50,3.00,—' && rows[3].cost === '30.75',
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

try {
  await drive('ltr')
  await drive('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
