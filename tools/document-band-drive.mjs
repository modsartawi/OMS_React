// Identity-band drive (ticket 091, spec 083 D-2) — drives the REAL app in
// Chromium and serves the FIVE CAPTURED PAYLOADS from
// `.issues/assets/078-document-payloads/` as the `SdDocument/Document/{no}`
// response, exactly as `tools/document-rail-drive.mjs` does. The payloads are
// replayed verbatim, so what renders here is what the live estate sent on
// 2026-07-24; the app is not stubbed, only the wire is.
//
// Asserts the ticket's Done-when, in BOTH themes:
//   1. the page opens straight into the band — no title row, no toolbar row,
//      and no Document/Customer field groups;
//   2. `documentNo` is the largest thing on the screen (measured, not assumed);
//   3. the five sub-ids sit under it, with "Placed" as one row;
//   4. the customer block sits at the END of the band;
//   5. Back is a chevron at the START of the band and routes to the list;
//   6. the overall lozenge renders as a monospace code on the two documents
//      that carry one and is absent on the three that do not;
//   7. (ticket 107) the band draws a 1px hairline that is distinguishable from
//      both its own ground and the page, in both themes. In light the band's ΔL
//      against the page carries the separation alone; in dark that step is +.058
//      (082 D-9's own figure) and the band was the one slab drawing it bare.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/document-band-drive.mjs
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

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// documentNo -> the captured `data` object.
const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

// The sub-ids each capture is expected to render, in band order (fields.test.ts
// asserts the same rule against the payloads; this asserts it reached the DOM).
const EXPECTED_SUBIDS = {
  '2000000551': ['Order i987123-260620', 'Type NUPP', 'Placed June 20, 2026 · 21:37', 'Store P100'],
  '8000000121': [
    'Order XXXC886',
    'Type Cash',
    'Delivery doc Delivery',
    'Placed March 6, 2025 · 02:46',
    'Store P001',
  ],
  '8000000174': [
    'Order FE000002',
    'Type Cash',
    'Delivery doc Delivery',
    'Placed April 24, 2025 · 22:29',
    'Store E001',
  ],
  '8000000253': [
    'Order 100371607',
    'Type ECommerce (Hybris)',
    'Delivery doc Delivery',
    'Placed July 14, 2026 · 00:44',
    'Store P001',
  ],
  '9000000003': [
    'Order 108020032',
    'Type ORRT',
    'Delivery doc Delivery Return',
    'Placed June 23, 2026 · 23:26',
    'Store BZ02',
  ],
}

// The two captures carrying `status.overallStatus`; the other three render no
// lozenge at all.
const OVERALL = { '2000000551': 'C', '8000000253': 'C' }

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
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

  const band = () => page.locator('[aria-label="Document identity"]')

  for (const documentNo of Object.keys(EXPECTED_SUBIDS)) {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await band().waitFor()
    await page.waitForTimeout(120)

    const bandText = (await band().innerText()).replace(/\s+/g, ' ').trim()
    check(`${documentNo}: the band leads with the document number`, bandText.startsWith(documentNo), bandText.slice(0, 60))

    const subIds = await band().locator('span:has(> b)').allInnerTexts()
    const read = subIds.map((s) => s.replace(/\s+/g, ' ').trim())
    check(
      `${documentNo}: the sub-ids read exactly D-2's rows`,
      JSON.stringify(read) === JSON.stringify(EXPECTED_SUBIDS[documentNo]),
      read.join(' · '),
    )

    const mono = await band().locator('.font-mono').allInnerTexts()
    const expectedOverall = OVERALL[documentNo]
    check(
      `${documentNo}: the overall lozenge ${expectedOverall ? `renders \`${expectedOverall}\` in monospace` : 'is omitted'}`,
      expectedOverall
        ? (await band().locator('.font-mono').first().innerText()).trim() === expectedOverall
        : !mono.some((m) => m.trim() === 'C'),
      mono.join(' | '),
    )
  }

  // --- the big line is the biggest thing on the screen -----------------------
  await page.goto(`${BASE}/oms/document/8000000253`)
  await band().waitFor()
  await page.waitForTimeout(150)
  const sizes = await page.evaluate(() => {
    const px = (el) => parseFloat(getComputedStyle(el).fontSize)
    const visible = [...document.querySelectorAll('body *')].filter(
      (el) => el.offsetParent !== null && el.textContent?.trim() && el.children.length === 0,
    )
    const docNo = visible.find((el) => el.textContent.trim() === '8000000253')
    // The maximum of everything ELSE, so a tie cannot pass as a win.
    const biggest = Math.max(...visible.filter((el) => el !== docNo).map(px))
    return { biggest, docNo: docNo ? px(docNo) : 0 }
  })
  check(
    'the document number is the largest text on the screen',
    sizes.docNo > 0 && sizes.docNo > sizes.biggest,
    `${sizes.docNo}px vs ${sizes.biggest}px for everything else`,
  )

  // --- the old chrome is gone ------------------------------------------------
  const body = (await page.locator('main, body').first().innerText()).replace(/\s+/g, ' ')
  check('the page title row is gone', !body.includes('Document Details'), body.slice(0, 80))
  check('the Back text link is gone — Back is the chevron', !body.includes('Back to Delivery Documents'))
  check(
    'the Document and Customer field groups are gone',
    !/\bLoyalty (Id|Mobile|Name)\b/.test(body) && !/\bRef Document No\b/.test(body),
  )
  // The Shipping Address group did NOT survive ticket 092: the address is a row
  // on the summary rail's Customer card now, and the standalone panel retired
  // with `FieldGroup`. What this drive still owns is that the band does not
  // duplicate the address — only the city, alongside the phone.
  check(
    'the address lives on the summary rail, not in a panel of its own',
    !body.includes('Shipping Address') && /customer/i.test(body),
    body.slice(0, 80),
  )

  // --- what left the band did not leave the screen ---------------------------
  // D-2 sends `refDocumentNo`, the source and the entry user to the
  // All-statuses disclosure's NEIGHBOURHOOD — a second group beside the
  // thirteen, which stay exactly as 090 left them.
  const disclosure = page.locator('summary', { hasText: 'All statuses' })
  await disclosure.click()
  const groups = await page.locator('details[open] h3, details[open] h4').allInnerTexts()
  const labels = await page.locator('details[open] dt').allInnerTexts()
  check(
    'the disclosure keeps its thirteen status rows unchanged',
    labels.filter((l) => /Status$|Last Action/.test(l)).length === 13,
    String(labels.length),
  )
  check(
    'and gains the provenance the band does not carry',
    ['Ref Document No', 'Source', 'Entry User'].every((l) => labels.includes(l)),
    groups.join(' | '),
  )
  await disclosure.click()

  // --- the band's own geometry ----------------------------------------------
  const geometry = await band().evaluate((el) => {
    const box = el.getBoundingClientRect()
    const link = el.querySelector('a[href="/oms/deliveries"]')
    const customer = el.lastElementChild
    return {
      dark: getComputedStyle(el).backgroundColor,
      linkStart: link ? link.getBoundingClientRect().left - box.left : null,
      linkTop: link ? link.getBoundingClientRect().top - box.top : null,
      customerEnd: box.right - customer.getBoundingClientRect().right,
      customerText: customer.textContent.replace(/\s+/g, ' ').trim(),
    }
  })
  check(
    'Back is a chevron at the START of the band',
    geometry.linkStart !== null && geometry.linkStart < 24 && geometry.linkTop < 24,
    `start ${geometry.linkStart}px, top ${geometry.linkTop}px`,
  )
  check(
    'the customer block sits at the END of the band',
    geometry.customerEnd < 24 && geometry.customerText.startsWith('sartawi'),
    `${geometry.customerText} (${geometry.customerEnd}px from the end)`,
  )

  // --- both themes -----------------------------------------------------------
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)
    await page.waitForTimeout(80)
    const contrast = await band().evaluate((el) => {
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => {
          const s = Number(v) / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const page = lum(getComputedStyle(document.body).backgroundColor)
      const style = getComputedStyle(el)
      const band = lum(style.backgroundColor)
      const ink = lum(style.color)
      const edge = lum(style.borderTopColor)
      const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      // `--brand-panel` is a deep-steel slab in BOTH themes: a dramatic dark
      // band against the light page, and a RAISED slab (ΔL +.058) against the
      // dark one — 082 D-9 states that asymmetry, so the assertion is
      // separation from the page, not "darker than" it.
      return {
        separated: Math.abs(band - page) > 0.01,
        inkContrast: ratio(ink, band),
        // Ticket 107. The ΔL above is the whole of the band's separation in
        // LIGHT and it is dramatic; in dark it is +.058, and the band was the
        // page's only slab drawing it with no hairline. The edge is measured
        // from BOTH sides — a border that matched either ground would be a
        // class name that paints nothing. It is NOT compared against a peer
        // slab's border: the peers' is an alpha over `--card`, and this drive
        // has no honest way to composite that (`getComputedStyle` hands back an
        // `oklab(… / .6)` string). The band deliberately draws `--border` at
        // full strength — the reason is on `IdentityBand.tsx`.
        edgeWidth: style.borderTopWidth,
        edgeVsBand: Math.abs(edge - band),
        edgeVsPage: Math.abs(edge - page),
        deltaL: Math.abs(band - page),
      }
    })
    check(
      `${theme}: the band is a distinct slab against the page`,
      contrast.separated,
      `ΔL ${contrast.deltaL.toFixed(3)}`,
    )
    check(
      `${theme}: and draws a 1px hairline distinguishable from BOTH its ground and the page`,
      contrast.edgeWidth === '1px' && contrast.edgeVsBand > 0.005 && contrast.edgeVsPage > 0.005,
      `${contrast.edgeWidth}, ΔL vs band ${contrast.edgeVsBand.toFixed(3)} · vs page ${contrast.edgeVsPage.toFixed(3)}`,
    )
    check(
      `${theme}: its ink clears AA on that slab`,
      contrast.inkContrast >= 4.5,
      `${contrast.inkContrast.toFixed(2)}:1`,
    )
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'))

  // --- the Dawaa Now tag -----------------------------------------------------
  // `isExpressDelivery` is `false` on all five captures, so the only way to see
  // the tag render is to flip the ONE field on a real payload. This is the
  // rendering half of the ticket's contract check: the wire field our model
  // binds is `isExpressDelivery` (present, `false`, on 5/5 captures), and when
  // it is true the band shows the tag.
  check(
    'no Dawaa Now tag on a document that is not express',
    !/dawaa now/i.test(await band().innerText()),
  )
  DOCUMENTS['8000000253'] = { ...DOCUMENTS['8000000253'], isExpressDelivery: true }
  await page.goto(`${BASE}/oms/document/8000000253`)
  await band().waitFor()
  await page.waitForTimeout(120)
  check(
    'flipping isExpressDelivery renders the Dawaa Now tag in the band',
    /dawaa now/i.test(await band().innerText()),
    (await band().innerText()).replace(/\s+/g, ' ').slice(0, 60),
  )

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  // --- the chevron actually leaves ------------------------------------------
  // Last, and after the error assertion: the destination is Screen 1, whose
  // lookup calls this drive answers with an empty envelope — its errors are the
  // stub's, not the band's.
  await band().locator('a[href="/oms/deliveries"]').click()
  await page.waitForTimeout(300)
  check('the chevron routes back to the list', page.url().endsWith('/oms/deliveries'), page.url())

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
