// The OMS access gate (ticket 125) — drives the REAL app in Chromium.
//
//   1. run the app:  npx vite --port 5206
//   2. node tools/oms-access-drive.mjs
//
// Port 5206 (124's empty-menu drive owns 5207; the two run in the same wave).
//
// Nothing about the app is stubbed except the wire: `Auth/Me`, `SdDocumentWeb/Access`,
// every other `*/Access` probe and the two OMS data calls are fulfilled from here, so a
// run needs no SIS.Api, no seeded user and no grant. Every `/api/**` request is RECORDED,
// which is how the "fires no data request" and "exactly one Access call" boxes are proven
// rather than asserted.
//
// Asserts the ticket's Proof:
//   1. entitled → the OMS group is in the nav and on the home page, the list loads rows,
//      and a document opens — all on the new `SdDocumentWeb/*` paths;
//   2. canOpenList:false → no OMS group in the sidebar AND no OMS section card;
//   3. canOpenList:false + deep link to /oms/deliveries → the denied card, and NO
//      DeliveryDocumentList request;
//   4. canOpenList:true + canOpenDetail:false → the list opens, the document deep link
//      shows the denied card and fires no Document request — the split a single grant loses;
//   5. an unreachable probe (500) hides the screen instead of revealing it — fail-closed;
//   6. one SdDocumentWeb/Access request per page life, shared by the menu and the guard.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5206}`
const DOC_NO = '9000000003'

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

// One delivery row, enough for the grid to render and for the row's document to open.
const DELIVERY_ROW = {
  deliveryNo: DOC_NO,
  documentNo: DOC_NO,
  status: 'OPEN',
  storeCode: 'P001',
  customerName: 'Drive Customer',
  documentType: 'ZOR',
}

const DOCUMENT = {
  documentNo: DOC_NO,
  documentCategory: 'T',
  status: 'OPEN',
  storeCode: 'P001',
  customerName: 'Drive Customer',
  lines: [],
  conditions: [],
}

/**
 * A fresh context per scenario (each one answers the probe differently, and react-query
 * caches per page anyway).
 *
 * @param opts.list    `canOpenList` the probe answers
 * @param opts.detail  `canOpenDetail` the probe answers
 * @param opts.probe   'ok' | 'unreachable' — 'unreachable' answers Access with a 500
 */
async function open(browser, { list = true, detail = true, probe = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'SdDocumentWeb/Access') {
      if (probe === 'unreachable')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'boom' }))
      return route.fulfill(envelope({ canOpenList: list, canOpenDetail: detail }))
    }
    if (p === 'SdDocumentWeb/DeliveryDocumentList') return route.fulfill(envelope([DELIVERY_ROW]))
    if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(p)) return route.fulfill(envelope(DOCUMENT))
    // Every other screen's probe: allowed, so the sidebar around OMS is normal.
    if (/Access$/.test(p))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }),
      )
    return route.fulfill(envelope([]))
  })

  return { context, page, errors, calls }
}

const count = (calls, re) => calls.filter((c) => re.test(c)).length

// The OMS door endpoints as they were BEFORE ticket 125 — the list, the two loads and the
// four write actions. Zero of these may be called any more. The five session-stable lookups
// (`SdDocument/DocumentTypes|DocumentSources|DeliveryDocumentTypes|StoreDetails|Districts`,
// in `core/services/lookups`) deliberately stay on the old door: `StoreDetails` feeds the
// store switcher for EVERY screen, so moving them behind the OMS grant would break the
// shell for an admin-only user. They are excluded here on purpose.
const OLD_DOOR = /^SdDocument\/(DeliveryDocumentList|Document\/|Delivery\/|Update|Reschedule)/
const navGroups = (page) =>
  page.locator('nav').first().locator('button, a').evaluateAll((els) => els.map((e) => e.innerText.trim()))
const sectionTitles = (page) =>
  page
    .locator('[data-section-card]')
    .evaluateAll((els) => els.map((e) => e.querySelector('h2')?.innerText.trim() ?? ''))

async function run() {
  const browser = await chromium.launch()

  // ============================================ 1 · entitled: unchanged, on the new paths
  {
    const { context, page, errors, calls } = await open(browser, { list: true, detail: true })
    await page.goto(BASE + '/')
    await page.locator('[data-section-card]').first().waitFor()
    await page.waitForTimeout(400)

    const titles = await sectionTitles(page)
    check('entitled: the OMS section card is on the home page', titles.some((x) => /OMS/i.test(x)), titles.join(' · '))
    const groups = await navGroups(page)
    check('entitled: the OMS group is in the sidebar', groups.some((g) => /OMS/i.test(g)), groups.join(' · '))

    await page.goto(BASE + '/oms/deliveries')
    await page.getByRole('button', { name: /^Load$/ }).waitFor()
    check('entitled: the list screen renders its filter panel, not a denied card', (await page.locator('[data-oms-denied]').count()) === 0)
    await page.getByRole('button', { name: /^Load$/ }).click()
    await page.locator('.ag-row').first().waitFor()
    check(
      'entitled: the search hits the NEW path — SdDocumentWeb/DeliveryDocumentList',
      count(calls, /^SdDocumentWeb\/DeliveryDocumentList$/) === 1 && count(calls, OLD_DOOR) === 0,
      calls.filter((c) => /DeliveryDocumentList/.test(c)).join(' · '),
    )

    await page.goto(BASE + `/oms/delivery/${DOC_NO}`)
    await page.waitForTimeout(600)
    check('entitled: the document deep link renders, not a denied card', (await page.locator('[data-oms-denied]').count()) === 0)
    check(
      'entitled: the document loads from the NEW path — SdDocumentWeb/Delivery/{no}',
      count(calls, /^SdDocumentWeb\/Delivery\//) >= 1 && count(calls, OLD_DOOR) === 0,
      calls.filter((c) => /Delivery\//.test(c)).join(' · '),
    )
    check('entitled: no page errors end to end', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ================================== 2 · canOpenList:false → the group vanishes, both places
  {
    const { context, page, errors } = await open(browser, { list: false, detail: false })
    await page.goto(BASE + '/')
    await page.locator('h1').waitFor()
    await page.waitForTimeout(700)

    const groups = await navGroups(page)
    check('denied list: the OMS group is absent from the sidebar', !groups.some((g) => /OMS/i.test(g)), groups.join(' · '))
    const titles = await sectionTitles(page)
    check(
      'denied list: and absent from the home page section cards too',
      titles.length > 0 && !titles.some((x) => /OMS/i.test(x)),
      titles.join(' · '),
    )
    check('denied list: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ===================== 3 · deep link to the list while denied → the card, and no data call
  {
    const { context, page, errors, calls } = await open(browser, { list: false, detail: false })
    await page.goto(BASE + '/oms/deliveries')
    await page.locator('[data-oms-denied="list"]').waitFor()
    await page.waitForTimeout(500)

    const copy = await page.locator('[data-oms-denied="list"]').innerText()
    check('denied list deep link: the denied card renders', copy.length > 0)
    check('it is announced as an alert', (await page.locator('[data-oms-denied="list"][role="alert"]').count()) === 1)
    check('it names the screen — no raw i18n key reached the screen', /Delivery Documents/.test(copy) && !/access\./.test(copy), copy.replace(/\s+/g, ' '))
    check(
      'and NO DeliveryDocumentList request was fired — the hole this ticket closes',
      count(calls, /DeliveryDocumentList/) === 0,
      calls.join(' · '),
    )
    check('denied list deep link: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ==================== 4 · list yes, detail no → the split a single-grant shortcut would lose
  {
    const { context, page, errors, calls } = await open(browser, { list: true, detail: false })
    await page.goto(BASE + '/oms/deliveries')
    await page.getByRole('button', { name: /^Load$/ }).waitFor()
    check('split grant: the LIST still opens on canOpenList alone', (await page.locator('[data-oms-denied]').count()) === 0)

    await page.goto(BASE + `/oms/document/${DOC_NO}`)
    await page.locator('[data-oms-denied="detail"]').waitFor()
    await page.waitForTimeout(500)
    const copy = await page.locator('[data-oms-denied="detail"]').innerText()
    check('split grant: the DOCUMENT deep link shows the denied card', /Document Details/.test(copy) && !/access\./.test(copy), copy.replace(/\s+/g, ' '))
    check(
      'split grant: and fired no Document request — the write screen never loaded',
      count(calls, /^SdDocumentWeb\/(Document|Delivery)\//) === 0,
      calls.join(' · '),
    )
    check(
      'split grant: the OMS group is still in the sidebar — the leaf gates on the LIST grant',
      (await navGroups(page)).some((g) => /OMS/i.test(g)),
    )
    check('split grant: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ============================================== 5 · an unreachable probe HIDES the screen
  {
    const { context, page, calls } = await open(browser, { probe: 'unreachable' })
    await page.goto(BASE + '/')
    await page.locator('h1').waitFor()
    // `retry: false` on both the menu probe and the guards, so this settles in one round trip.
    await page.waitForTimeout(1200)
    const titles = await sectionTitles(page)
    check(
      'fail-closed: a 500 from the probe hides the OMS section card rather than revealing it',
      !titles.some((x) => /OMS/i.test(x)),
      titles.join(' · '),
    )
    check(
      'fail-closed: and the OMS group is absent from the sidebar',
      !(await navGroups(page)).some((g) => /OMS/i.test(g)),
    )

    await page.goto(BASE + '/oms/deliveries')
    await page.locator('[data-oms-denied="list"]').waitFor({ timeout: 15000 })
    check('fail-closed: a deep link lands on the denied card, not the filter panel', true)
    check(
      'fail-closed: and still no DeliveryDocumentList request',
      count(calls, /DeliveryDocumentList/) === 0,
      calls.join(' · '),
    )
    // A server fault must not read as a missing grant: the card says the CHECK failed and
    // does not send an entitled operator to ask for a permission they already hold.
    const copy = await page.locator('[data-oms-denied="list"]').innerText()
    check(
      'fail-closed: the copy blames the failed check, not the operator’s grants',
      /Access check unavailable/.test(copy) && !/Ask an administrator/.test(copy) && !/access\./.test(copy),
      copy.replace(/\s+/g, ' '),
    )
    await context.close()
  }

  // ======================================= 6 · one probe call, shared by the menu and the page
  {
    const { context, page, calls } = await open(browser, { list: true, detail: true })
    await page.goto(BASE + '/oms/deliveries')
    await page.getByRole('button', { name: /^Load$/ }).waitFor()
    await page.waitForTimeout(800)
    check(
      'shared cache entry: exactly ONE SdDocumentWeb/Access request for menu + list guard',
      count(calls, /^SdDocumentWeb\/Access$/) === 1,
      `${count(calls, /^SdDocumentWeb\/Access$/)} call(s)`,
    )

    // The in-app route change is the case a mismatched `staleTime` would miss: the guard
    // mounting fresh must READ the menu's cached answer, not mark it stale and re-ask.
    await page.goto(BASE + '/')
    await page.locator('[data-section-card]').first().waitFor()
    calls.length = 0
    await page.locator('[data-section-card] a[href="/oms/deliveries"]').first().click()
    await page.getByRole('button', { name: /^Load$/ }).waitFor()
    await page.waitForTimeout(800)
    check(
      'shared cache entry: navigating INTO the screen in-app re-asks nothing',
      count(calls, /^SdDocumentWeb\/Access$/) === 0,
      `${count(calls, /^SdDocumentWeb\/Access$/)} call(s) after the click`,
    )

    // The document screen is the same story with a THIRD consumer of the key — the menu
    // probe, the list guard's cached entry and the detail guard. Counted over its own page
    // life (a full reload legitimately re-probes, so the tally restarts with it).
    calls.length = 0
    await page.goto(BASE + `/oms/delivery/${DOC_NO}`)
    await page.waitForTimeout(1000)
    check(
      'shared cache entry: exactly ONE for menu + detail guard on the document page life',
      count(calls, /^SdDocumentWeb\/Access$/) === 1,
      `${count(calls, /^SdDocumentWeb\/Access$/)} call(s)`,
    )
    await context.close()
  }

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
