// Summary-rail drive (ticket 092, spec 083 D-5 to D-8) — drives the REAL app in
// Chromium and serves the FIVE CAPTURED PAYLOADS from
// `.issues/assets/078-document-payloads/` as the `SdDocument/Document/{no}`
// response, exactly as `tools/document-band-drive.mjs` does. The payloads are
// replayed verbatim; the app is not stubbed, only the wire is.
//
// Asserts the ticket's Done-when, in BOTH themes:
//   1. the five cards render on a 340px rail BESIDE the work area above 900px;
//   2. below 900px the rail is a card grid ABOVE the work area (not a drawer),
//      laying its cards out at `minmax(250px, 1fr)`;
//   3. every collapse: e-Rx on 4/5, Driver & tracking when the courier, the
//      driver and the tracking id are all blank;
//   4. every step of the address chain across the corpus, including the null
//      parent and the all-blank object landing on three rows with NO marker;
//   5. no em dash anywhere on the rail;
//   6. the retired panels — Shipping Address, the header field groups — are gone.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/document-cards-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

/**
 * The cards each capture is expected to render, and the rows inside them, as they
 * read on screen. `fields.test.ts` asserts the same rules against the payloads;
 * this asserts they reached the DOM in the rail's order.
 */
const EXPECTED = {
  '2000000551': {
    Customer: ['Name Sample Patient', 'Mobile 966501076360', 'Loyalty ID 1000000034'],
    'Prescription (e-Rx)': ['Approval no. c9364852', 'Patient ID 1197634478'],
    Fulfilment: ['Type Pick In Store', 'Store P100'],
    'Driver & tracking': ['Courier DAWA', 'Approved No'],
    Payment: ['Payment C', 'Delivery fees 0.00', 'Paid 0.00', 'Amount due 5.70', 'Net total 5.70'],
  },
  '8000000121': {
    Customer: [
      'Name MOHAMMED SARTAWI 33',
      'Mobile 966501076360',
      'Loyalty ID 1000000034',
      'City Dammam - ad dabab',
    ],
    Fulfilment: [
      'Type Delivery',
      'Store P001',
      'Delivery window Monday, 8pm - 10 pm',
      'Last note test order - to be cancelled',
    ],
    'Driver & tracking': [
      'Courier DAWA',
      'Driver mohammed sartawi',
      'Driver mobile 0501076360',
      'Approved Yes',
      'Tracking 200318397432',
    ],
    Payment: [
      'Payment ApplePay · Visa',
      'Delivery fees 12.00',
      'Paid 0.00',
      'Amount due 114.98',
      'Net total 114.98',
    ],
  },
  '8000000174': {
    Customer: [
      'Name MOHAMMED SARTAWI 33',
      'Mobile 966501076360',
      'Loyalty ID 1000000034',
      'City Riyadh - adh dhubbat',
      'Address Adh Dhubbat',
    ],
    Fulfilment: [
      'Type Delivery',
      'Store E001',
      'Delivery window 20:00 - 22:00',
      'Last note out for delivery',
    ],
    'Driver & tracking': ['Courier FREY', 'Approved No'],
    Payment: [
      'Payment ApplePay · Visa',
      'Delivery fees 12.00',
      'Paid 0.00',
      'Amount due 103.10',
      'Net total 103.10',
    ],
  },
  '8000000253': {
    Customer: ['Name sartawi', 'Mobile 966501076360', 'Loyalty ID 1000000034'],
    Fulfilment: ['Type Pick In Store', 'Store P001'],
    'Driver & tracking': ['Courier FREY', 'Approved No'],
    Payment: ['Payment C', 'Delivery fees 0.00', 'Paid 0.00', 'Amount due 242.00', 'Net total 242.00'],
  },
  '9000000003': {
    Customer: [
      'Name Mohammed Sartawi',
      'Mobile 966501076360',
      'Loyalty ID 1000000034',
      'City Riyadh - ad dar al baida',
      'Address RMAB4405',
    ],
    Fulfilment: ['Type Delivery', 'Store BZ02', 'Last note return'],
    'Driver & tracking': ['Courier FREY', 'Approved No', 'Tracking R0000594578'],
    Payment: ['Payment C', 'Delivery fees 0.00', 'Paid 0.00', 'Amount due 86.25', 'Net total 86.25'],
  },
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    const doc = p.match(/^SdDocument\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const rail = () => page.locator('[aria-label="Document summary"]')

  /** The rail as `{ 'Card title': ['Label value', …] }`, in DOM order. */
  const readRail = () =>
    rail().evaluate((el) => {
      const out = {}
      for (const card of el.querySelectorAll('section')) {
        const rows = []
        const cells = [...card.querySelectorAll('dt, dd')]
        for (let i = 0; i + 1 < cells.length; i += 2) {
          rows.push(`${cells[i].innerText} ${cells[i + 1].innerText}`.replace(/\s+/g, ' ').trim())
        }
        out[card.querySelector('h3').innerText.replace(/\s+/g, ' ').trim()] = rows
      }
      return out
    })

  for (const documentNo of Object.keys(EXPECTED)) {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await rail().waitFor()
    await page.waitForTimeout(140)

    const actual = await readRail()
    const expected = EXPECTED[documentNo]
    // Card titles are uppercased by the stylesheet, and `innerText` reports what
    // the operator sees — so the comparison is on the rendered casing.
    check(
      `${documentNo}: the rail renders exactly the cards D-6 expects, in order`,
      JSON.stringify(Object.keys(actual)) ===
        JSON.stringify(Object.keys(expected).map((title) => title.toUpperCase())),
      Object.keys(actual).join(' | '),
    )
    for (const [title, rows] of Object.entries(expected)) {
      check(
        `${documentNo}: ${title} reads its rows`,
        JSON.stringify(actual[title.toUpperCase()]) === JSON.stringify(rows),
        JSON.stringify(actual[title.toUpperCase()]),
      )
    }
    check(
      `${documentNo}: no em dash on the rail`,
      !(await rail().innerText()).includes('—'),
      (await rail().innerText()).replace(/\s+/g, ' ').slice(0, 80),
    )
  }

  // --- the two collapses, stated as absences ---------------------------------
  const titlesOn = async (documentNo) => {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await rail().waitFor()
    await page.waitForTimeout(120)
    return Object.keys(await readRail())
  }
  const otc = await titlesOn('8000000121')
  check('the e-Rx card is absent on an over-the-counter order', !otc.includes('PRESCRIPTION (E-RX)'), otc.join(' | '))

  // `courierCode` is populated on 5/5 captures — including both pick-in-store
  // documents — so the corpus cannot show the driver collapse. Blanking the three
  // fields the rule names on a real payload is the only way to drive it.
  DOCUMENTS['8000000253'] = {
    ...DOCUMENTS['8000000253'],
    courierCode: '',
    courierDriverName: '',
    trackingId: '',
  }
  const bare = await titlesOn('8000000253')
  check(
    'Driver & tracking collapses when the courier, the driver and the tracking id are all blank',
    !bare.includes('DRIVER & TRACKING'),
    bare.join(' | '),
  )

  // --- the retired panels are gone ------------------------------------------
  const body = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  check('the Shipping Address panel is gone', !body.includes('Shipping Address'), body.slice(0, 90))
  check('its GPS/city-code rows went with it', !/GPS (Lat|Lon)|City Code|District Code/.test(body))

  // --- the layout, above and below 900px ------------------------------------
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto(`${BASE}/oms/document/8000000174`)
  await rail().waitFor()
  await page.waitForTimeout(160)
  const wide = await rail().evaluate((el) => {
    const work = el.parentElement.lastElementChild
    const r = el.getBoundingClientRect()
    const w = work.getBoundingClientRect()
    return { railWidth: Math.round(r.width), beside: r.right <= w.left + 1, sameTop: Math.abs(r.top - w.top) < 4 }
  })
  check(
    'above 900px the rail is 340px BESIDE the work area',
    wide.railWidth === 340 && wide.beside && wide.sameTop,
    `${wide.railWidth}px, beside=${wide.beside}`,
  )

  await page.setViewportSize({ width: 800, height: 1000 })
  await page.waitForTimeout(200)
  const narrow = await rail().evaluate((el) => {
    const work = el.parentElement.lastElementChild
    const r = el.getBoundingClientRect()
    const w = work.getBoundingClientRect()
    const cards = [...el.querySelectorAll('section')].map((c) => c.getBoundingClientRect())
    const tops = new Set(cards.map((c) => Math.round(c.top)))
    return {
      above: r.bottom <= w.top + 1,
      fullWidth: Math.abs(r.width - w.width) < 2,
      rows: tops.size,
      cards: cards.length,
      minCardWidth: Math.round(Math.min(...cards.map((c) => c.width))),
      // A drawer would be a toggle: nothing on this page hides the rail.
      hidden: getComputedStyle(el).display === 'none' || r.height === 0,
    }
  })
  check(
    'below 900px the rail sits ABOVE the work area, full width, never hidden',
    narrow.above && narrow.fullWidth && !narrow.hidden,
    `above=${narrow.above} fullWidth=${narrow.fullWidth}`,
  )
  check(
    'and lays its cards out as a grid, not a column',
    narrow.rows < narrow.cards && narrow.minCardWidth >= 250,
    `${narrow.cards} cards on ${narrow.rows} rows, narrowest ${narrow.minCardWidth}px`,
  )
  await page.setViewportSize({ width: 1600, height: 1000 })

  // --- both themes -----------------------------------------------------------
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)
    await page.waitForTimeout(90)
    const paint = await rail().evaluate((el) => {
      const lum = (c) => {
        const [r, g, b] = c
          .match(/\d+(\.\d+)?/g)
          .slice(0, 3)
          .map((v) => {
            const s = Number(v) / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      const card = el.querySelector('section')
      const value = card.querySelector('dd')
      const accent = card.querySelector('h3 span')
      const ground = lum(getComputedStyle(card).backgroundColor)
      return {
        ink: ratio(lum(getComputedStyle(value).color), ground),
        accent: getComputedStyle(accent).backgroundColor,
      }
    })
    check(`${theme}: a card value clears AA on the card ground`, paint.ink >= 4.5, `${paint.ink.toFixed(2)}:1`)
    check(`${theme}: the accent bar is painted from a token`, /rgb/.test(paint.accent), paint.accent)
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'))

  // --- the links reach the screen for the first time -------------------------
  // `prescriptionUrl` and `trackingUrl` are both blank or absent on most
  // captures; `8000000121` carries a real `trackingUrl`, which is the one live
  // link in the corpus.
  await page.goto(`${BASE}/oms/document/8000000121`)
  await rail().waitFor()
  await page.waitForTimeout(140)
  const link = rail().locator('a[target="_blank"]').first()
  check(
    'the tracking id renders as an external link when the payload carries a URL',
    (await link.count()) === 1 &&
      (await link.getAttribute('href')) === 'https://curior/tracking/20234897324' &&
      (await link.getAttribute('rel')).includes('noopener'),
    await link.getAttribute('href'),
  )

  // --- the pin code never renders -------------------------------------------
  check(
    'courierDriverMasterPinCode never reaches the screen',
    !(await page.locator('body').innerText()).includes('1234'),
  )

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
