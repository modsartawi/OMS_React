// Document pill-rail drive (ticket 090, spec 083 D-3) — drives the REAL app in
// Chromium and serves the FIVE CAPTURED PAYLOADS from
// `.issues/assets/078-document-payloads/` as the `SdDocument/Document/{no}`
// response. The payloads are replayed verbatim, so what renders here is what the
// live estate sent on 2026-07-24; the app is not stubbed, only the wire is.
// (SIS.Api is reachable on :5111 but needs an operator login this tool has no
// credentials for — same posture as bby-inquiry-drive.mjs, and the data is the
// live capture either way.)
//
// Asserts the ticket's rendered acceptance:
//   1. each of the five documents renders exactly the rail in D-3's table;
//   2. the anchor is the neutral outline (no severity ground) and pills carry
//      the mapped severity classes — Ready ok, Cancellation warn;
//   3. `9000000003`'s TRDY renders in monospace;
//   4. the Status TAB is gone and All statuses (13) opens the full breakdown;
//   5. Refresh sits at the very end of the rail and spins in place.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/document-rail-drive.mjs
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

// Spec 083 D-3's table, as the rail reads on screen.
const EXPECTED = {
  '2000000551': ['Last action Prescription Ready', 'Ready', 'Approval Approved'],
  '8000000121': ['Last action Rescheduled'],
  '8000000174': ['Last action Close Requested', 'Ready', 'Cancellation Close Requested'],
  '8000000253': ['Last action Delivered', 'Ready', 'Delivery Delivered'],
  '9000000003': ['Last action TRDY'],
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  let refreshCount = 0
  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    const doc = p.match(/^SdDocument\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) {
      refreshCount++
      return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    }
    if (/\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const rail = () => page.locator('[aria-label="Document status"]')

  for (const documentNo of Object.keys(EXPECTED)) {
    await page.goto(`${BASE}/oms/document/${documentNo}`)
    await rail().waitFor()
    await page.waitForTimeout(120)

    // The rail's entries, in order, as text: anchor + pills (the tail controls
    // — All statuses, Refresh — are buttons, not entries).
    const read = await rail().locator(String.raw`> span:not([aria-hidden])`).allInnerTexts()
    const entries = read.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
    check(
      `${documentNo}: rail reads exactly D-3's table`,
      JSON.stringify(entries) === JSON.stringify(EXPECTED[documentNo]),
      entries.join(' · '),
    )

    const classes = await rail().locator(String.raw`> span:not([aria-hidden])`).evaluateAll((els) => els.map((e) => e.className))
    const anchorClass = classes[0] ?? ''
    check(
      `${documentNo}: the anchor is a neutral outline, never a severity`,
      anchorClass.includes('border-border-strong') && !/bg-(success|attention|danger|primary)-050/.test(anchorClass),
      anchorClass,
    )

    const pillClasses = classes.slice(1)
    if (documentNo === '8000000253')
      check(
        '8000000253: Ready and Delivery both render ok (green)',
        pillClasses.length === 2 && pillClasses.every((c) => c.includes('bg-success-050')),
        pillClasses.join(' | '),
      )
    if (documentNo === '8000000174')
      check(
        '8000000174: Ready is ok and Cancellation is warn — same code R, two severities',
        pillClasses[0]?.includes('bg-success-050') && pillClasses[1]?.includes('bg-attention-050'),
        pillClasses.join(' | '),
      )
    if (documentNo === '2000000551')
      check(
        '2000000551: Approval renders ok',
        pillClasses[1]?.includes('bg-success-050'),
        pillClasses.join(' | '),
      )
    if (documentNo === '9000000003') {
      const mono = await rail().locator('.font-mono').allInnerTexts()
      check('9000000003: TRDY renders in monospace', mono.join('') === 'TRDY', mono.join(''))
    }
    if (documentNo === '8000000121')
      check('8000000121: no pill at all beside the anchor', pillClasses.length === 0, String(pillClasses.length))
  }

  // --- the Status tab is gone, the record is not -----------------------------
  await page.goto(`${BASE}/oms/document/8000000253`)
  await rail().waitFor()
  // Ticket 093 put a count badge inside each tab, so the label is the tab's text
  // with the trailing number dropped — `Items\n1` is still the Items tab.
  const tabs = (await page.locator('[role="tab"]').allInnerTexts()).map((text) =>
    text.replace(/\s*\d+\s*$/, '').trim(),
  )
  check('the Status tab is gone', !tabs.includes('Status'), tabs.join(' · '))
  check('the four remaining tabs are intact', tabs.join('|') === 'Items|Header Conditions|Log|Jobs', tabs.join('|'))

  const disclosure = page.locator('summary', { hasText: 'All statuses' })
  check('All statuses sits at the end of the rail, counting 13', (await disclosure.innerText()).trim() === 'All statuses 13')
  await disclosure.click()
  const rows = await page.locator('details[open] dt').allInnerTexts()
  // Ticket 091 put the provenance group (`Ref Document No`, `Source`,
  // `Entry User`) BESIDE the breakdown inside the same disclosure, so the count
  // is of the status rows rather than of every `dt` under it — D-3 keeps the
  // thirteen unchanged, and 091 added three neighbours, not three rows.
  const statusRows = rows.filter((label) => /Status$|Last Action/.test(label))
  check('opening it shows all thirteen rows', statusRows.length === 13, String(rows.length))
  check(
    'including the three code-only statuses the rail omits',
    ['Consignment Status', 'Control Status', 'Notification Status'].every((l) => rows.includes(l)),
    rows.join(', '),
  )
  await disclosure.click()

  // --- Refresh, at the very end of the rail ----------------------------------
  const refreshButton = rail().locator('button', { hasText: 'Refresh' })
  check('Refresh is inside the rail', (await refreshButton.count()) === 1)
  const lastChildIsRefresh = await rail().evaluate((el) => el.lastElementChild?.textContent?.includes('Refresh') === true)
  check('Refresh is the rail\'s last element', lastChildIsRefresh)

  const before = refreshCount
  await refreshButton.click()
  await page.waitForTimeout(400)
  check('clicking Refresh reloads the document', refreshCount > before, `${before} → ${refreshCount}`)
  check('no toast is raised on a successful refresh', (await page.locator('[data-sonner-toast]').count()) === 0)

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
