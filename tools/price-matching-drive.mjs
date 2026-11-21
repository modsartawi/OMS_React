// Ticket 937 drive — the matching team works the queue on the page, Mindsite suggestions labelled (BackOffice spec 4127,
// decision 8; doors BO 3501). Drives the REAL app in Chromium against STUBBED `PriceWatch/*` envelopes.
//
// Stubs follow the SHIPPED contract read from BackOffice `pricing2` on 2026-11-21 (`PriceWatchWebEndpoints.cs`,
// `PriceWatchMatchingService.cs`, `PriceWatchMatchService.cs`, `PriceWatchErrorCodes.cs`): `Matching/Coverage`,
// `Matching/{competitor}/Queue`, `Candidates/{id}/Exact|Comparable|NotTheSame`, `{competitor}/NotCarried { material }`,
// `{competitor}/Discovery`, `Matches/ConfirmByUrl { material, competitorCode, url }`.
// ⚠ GUESSED (BO 4135): the candidate `origin: 'MINDSITE'` on C-1a — not on any shipped wire yet.
// Still owed: the dev walk on a Nahdi queue.
//
//   1. a manager: Matching tab opens from the strip; coverage shows matched / not carried / still open per competitor;
//      the NAHDI queue (first competitor) is read; the first material in sales order is up with its best candidate.
//   2. the Mindsite suggestion is labelled; the next (scraper) candidate is not.
//   3. Not the same → POST NotTheSame, the material's next candidate comes up; Exact → POST Exact, next material.
//   4. a material with no candidate: Not carried only + confirm by URL; an http URL is refused client-side; a https
//      URL → POST ConfirmByUrl { material, competitorCode, url }; then Comparable on the next, then Not carried.
//   5. page worked → "Read the queue again". Request discovery → POST {competitor}/Discovery, toast with the count.
//   6. a refusal PWT-00021 (candidate closed) shows with its code and the queue is read again.
//   7. picking AMAZON_SA reads its queue.
//   8. a viewer (PriceWatch:03 only): queue + coverage, no actions, no confirm by URL, no discovery.
//   9. RTL (oms.locale = ar): renders, no raw keys. No page errors anywhere.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/price-matching-drive.mjs
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROOT = BASE + '/analytics/price-command-center?tab=matching'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const refusal = (code, message) => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 400, success: false, message, errors: [{ errorMessage: message, errorCode: code, internalErrorCode: '' }], data: null }),
})
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '')

const COVERAGE = [
  { competitorCode: 'NAHDI', competitorName: 'Nahdi', watched: 500, exact: 300, comparable: 20, notCarried: 5, open: 175 },
  { competitorCode: 'AMAZON_SA', competitorName: 'Amazon SA', watched: 500, exact: 120, comparable: 30, notCarried: 10, open: 340 },
]
const candidate = (over) => ({
  candidateId: 'C-x', rank: 1, listingId: 'L-x', url: 'https://www.nahdionline.com/en/p/1', title: 'Panadol Extra 24 tablets',
  brand: 'Panadol', sizeText: '24 tablets', sizeValue: 24, sizeUnit: 'piece', imageUrl: '', barcodes: ['6291100080012'],
  regularPrice: 21, offerPrice: 19.95, currency: 'SAR', observedAt: '2026-11-21T08:15:00', sellerName: 'Nahdi Online',
  isPlatformSeller: true, inStock: true, foundAt: '2026-11-20T23:00:00', ...over,
})
const ours = (title) => ({ title, brand: 'Brand', sizeValue: 24, sizeUnit: 'piece', imageUrl: '', barcodes: ['6291100080012'],
  basicPrice: 25, effectivePrice: 22.5, currency: 'SAR', priceDay: '2026-11-21' })
const item = (materialNumber, salesRank, candidates) => ({ materialNumber, salesRank, netSalesValue: 10000 / salesRank, isAddition: false, ours: ours(`OUR PRODUCT ${salesRank}`), candidates })
const NAHDI_QUEUE = {
  competitorCode: 'NAHDI', competitorName: 'Nahdi', open: 175,
  items: [
    item('100000001', 1, [candidate({ candidateId: 'C-1b', rank: 2, title: 'Scraper find' }), candidate({ candidateId: 'C-1a', rank: 1, origin: 'MINDSITE', title: 'Mindsite pick' })]),
    item('100000002', 2, []),
    item('100000003', 3, [candidate({ candidateId: 'C-3a', title: 'Third' })]),
    item('100000004', 4, [candidate({ candidateId: 'C-4a', title: 'Fourth' })]),
  ],
}
const AMAZON_QUEUE = { competitorCode: 'AMAZON_SA', competitorName: 'Amazon SA', open: 340, items: [item('100000009', 1, [candidate({ candidateId: 'C-9a' })])] }

const browser = await chromium.launch()

async function open(keys, { dir = 'ltr', refuse = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120000) // a cold dev server under load can take more than the default 30 s to serve the page
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.split('/api/')[1]
    calls.push({ path, method: req.method(), params: Object.fromEntries(url.searchParams), body: req.postData() })
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'Auth/Permissions') return route.fulfill(permissions(keys))
    if (path === 'PriceWatch/Matching/Coverage') return route.fulfill(envelope(COVERAGE))
    if (path === 'PriceWatch/Alerts/Mine' || path === 'PriceWatch/Alerts') return route.fulfill(envelope([]))
    if (path === 'PriceWatch/Matching/NAHDI/Queue') return route.fulfill(envelope(NAHDI_QUEUE))
    if (path === 'PriceWatch/Matching/AMAZON_SA/Queue') return route.fulfill(envelope(AMAZON_QUEUE))
    if (refuse && path === refuse.path) return route.fulfill(refusal(refuse.code, refuse.message))
    if (/^PriceWatch\/Matching\/Candidates\/[^/]+\/(Exact|Comparable)$/.test(path)) return route.fulfill(envelope({ matchId: 'M-1' }))
    if (/^PriceWatch\/Matching\/Candidates\/[^/]+\/NotTheSame$/.test(path)) return route.fulfill(envelope({ outcome: 'NOT_SAME' }))
    if (/^PriceWatch\/Matching\/[^/]+\/NotCarried$/.test(path)) return route.fulfill(envelope({ markedBy: 'msartawi' }))
    if (/^PriceWatch\/Matching\/[^/]+\/Discovery$/.test(path)) return route.fulfill(envelope({ requested: 42 }))
    if (path === 'PriceWatch/Matches/ConfirmByUrl') return route.fulfill(envelope({ matchId: 'M-2', matchKind: 'Exact', madeBy: 'Person' }))
    return route.fulfill(envelope({}))
  })
  return { page, context, errors, calls }
}

const rawKey = (text) => text.match(/\b(?:price-command-center:)?(?:matching|alerts|tabs|access)\.[a-zA-Z.-]+\b/)
const upItem = (page) => page.locator('[data-queue-item]').getAttribute('data-queue-item')
const upCandidate = async (page) => ((await page.locator('[data-queue-candidate]').count()) ? page.locator('[data-queue-candidate]').getAttribute('data-queue-candidate') : null)
const posted = (calls, path) => calls.find((c) => c.method === 'POST' && c.path === path)

try {
  // ── 1–7: a manager ──
  {
    const { page, context, errors, calls } = await open(['PriceWatch:03', 'PriceWatch:06'])
    await page.goto(ROOT)
    await page.waitForSelector('[data-queue-item]')
    const tabs = await page.locator('[role="tablist"] [data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))
    check('1. the Matching tab is in the strip', tabs.includes('matching'), JSON.stringify(tabs))
    check('1. the Matching tab is open', (await page.locator('[data-tab-panel]').getAttribute('data-tab-panel')) === 'matching')
    const nahdi = page.locator('[data-coverage-row="NAHDI"]')
    check('1. coverage: NAHDI matched 320, not carried 5, still open 175',
      (await nahdi.locator('[data-coverage-matched]').getAttribute('data-coverage-matched')) === '320' &&
      (await nahdi.locator('[data-coverage-not-carried]').getAttribute('data-coverage-not-carried')) === '5' &&
      (await nahdi.locator('[data-coverage-open]').getAttribute('data-coverage-open')) === '175')
    check('1. coverage: AMAZON_SA row too', (await page.locator('[data-coverage-row="AMAZON_SA"] [data-coverage-matched="150"]').count()) === 1)
    check('1. the first competitor’s queue is read', calls.some((c) => c.path === 'PriceWatch/Matching/NAHDI/Queue'))
    check('1. the first material in sales order is up', (await upItem(page)) === '100000001')
    check('1. …with its best-ranked candidate', (await upCandidate(page)) === 'C-1a')

    // 2. label
    check('2. the Mindsite suggestion is labelled', (await page.locator('[data-mindsite-suggested]').count()) === 1 && strip(await page.locator('[data-queue-theirs]').innerText()).includes('Suggested by Mindsite'))

    // 3. Not the same, then Exact
    await page.click('[data-matching-action="notTheSame"]')
    await page.waitForSelector('[data-queue-candidate="C-1b"]')
    check('3. Not the same → POST NotTheSame', !!posted(calls, 'PriceWatch/Matching/Candidates/C-1a/NotTheSame'))
    check('3. …the material’s next candidate is up', (await upItem(page)) === '100000001' && (await upCandidate(page)) === 'C-1b')
    check('2. the scraper candidate carries no label', (await page.locator('[data-mindsite-suggested]').count()) === 0)
    await page.click('[data-matching-action="exact"]')
    await page.waitForSelector('[data-queue-item="100000002"]')
    check('3. Exact → POST Exact', !!posted(calls, 'PriceWatch/Matching/Candidates/C-1b/Exact'))
    check('3. …the next material is up', (await upItem(page)) === '100000002')

    // 4. no candidate: confirm by URL
    check('4. no candidate: the sentence shows', (await page.locator('[data-queue-no-candidate]').count()) === 1)
    const actions = await page.locator('[data-matching-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-matching-action')))
    check('4. …only Not carried is offered', JSON.stringify(actions) === JSON.stringify(['notCarried']), JSON.stringify(actions))
    await page.fill('[data-matching-url]', 'http://www.nahdionline.com/p/2')
    check('4. an http URL is refused before it is sent', await page.locator('[data-matching-url-confirm]').isDisabled())
    check('4. …and says why', strip(await page.locator('[data-matching-url-form]').innerText()).includes('full https address'))
    await page.fill('[data-matching-url]', ' https://www.nahdionline.com/p/2 ')
    await page.click('[data-matching-url-confirm]')
    await page.waitForSelector('[data-queue-item="100000003"]')
    const byUrl = posted(calls, 'PriceWatch/Matches/ConfirmByUrl')
    check('4. confirm by URL sends { material, competitorCode, url } trimmed',
      byUrl?.body === JSON.stringify({ material: '100000002', competitorCode: 'NAHDI', url: 'https://www.nahdionline.com/p/2' }), byUrl?.body)
    await page.click('[data-matching-action="comparable"]')
    await page.waitForSelector('[data-queue-item="100000004"]')
    check('4. Comparable → POST Comparable', !!posted(calls, 'PriceWatch/Matching/Candidates/C-3a/Comparable'))
    await page.click('[data-matching-action="notCarried"]')
    await page.waitForSelector('[data-queue-done]')
    const nc = posted(calls, 'PriceWatch/Matching/NAHDI/NotCarried')
    check('4. Not carried → POST {competitor}/NotCarried { material }', nc?.body === JSON.stringify({ material: '100000004' }), nc?.body)
    check('3–4. coverage is read again after decisions', calls.filter((c) => c.path === 'PriceWatch/Matching/Coverage').length > 1)

    // 5. page done + discovery
    check('5. the worked page offers to read the queue again', (await page.locator('[data-queue-reload]').count()) === 1)
    await page.click('[data-matching-discovery]')
    // The count is isolated (FSI…PDI) inside the toast's sentence: compare with the isolates stripped.
    await page.waitForFunction(() => document.body.innerText.replace(/[⁦-⁩]/g, '').includes('Discovery asked for 42 materials.'))
    check('5. discovery → POST NAHDI/Discovery', !!posted(calls, 'PriceWatch/Matching/NAHDI/Discovery'))
    const reads = calls.filter((c) => c.path === 'PriceWatch/Matching/NAHDI/Queue').length
    await page.click('[data-queue-reload]')
    await page.waitForSelector('[data-queue-item="100000001"]')
    check('5. reading again starts the page over', calls.filter((c) => c.path === 'PriceWatch/Matching/NAHDI/Queue').length > reads)

    // 7. other competitor
    await page.locator('[data-matching-competitor]').selectOption('AMAZON_SA')
    await page.waitForSelector('[data-queue-item="100000009"]')
    check('7. picking AMAZON_SA reads its queue', calls.some((c) => c.path === 'PriceWatch/Matching/AMAZON_SA/Queue'))
    const body = strip(await page.locator('body').innerText())
    check('1–7. no raw i18n keys', !rawKey(body), String(rawKey(body)))
    check('1–7. no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/matching.png', fullPage: true }).catch(() => {})
    await context.close()
  }

  // ── 6: a refusal, the queue moved ──
  {
    const { page, context, errors, calls } = await open(['PriceWatch:03', 'PriceWatch:06'], {
      refuse: { path: 'PriceWatch/Matching/Candidates/C-1a/Exact', code: 'PWT-00021', message: "Candidate 'C-1a' is already decided." },
    })
    await page.goto(ROOT)
    await page.waitForSelector('[data-queue-candidate="C-1a"]')
    const reads = calls.filter((c) => c.path === 'PriceWatch/Matching/NAHDI/Queue').length
    await page.click('[data-matching-action="exact"]')
    await page.waitForSelector('[data-matching-refusal="PWT-00021"]')
    const text = strip(await page.locator('body').innerText())
    check('6. the refusal shows with its code', text.includes('PWT-00021') && text.includes('The decision was refused.'))
    check('6. …saying the queue was read again', text.includes('read again'))
    await page.waitForTimeout(300)
    check('6. the queue is read again', calls.filter((c) => c.path === 'PriceWatch/Matching/NAHDI/Queue').length > reads)
    check('6. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 8: a viewer ──
  {
    const { page, context, errors } = await open(['PriceWatch:03'])
    await page.goto(ROOT)
    await page.waitForSelector('[data-queue-item]')
    check('8. a viewer sees the queue and coverage', (await page.locator('[data-coverage-row]').count()) === 2 && (await page.locator('[data-queue-candidate]').count()) === 1)
    check('8. …with no actions, no confirm by URL, no discovery',
      (await page.locator('[data-matching-action], [data-matching-url-form], [data-matching-discovery]').count()) === 0)
    check('8. no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 9: RTL ──
  {
    const { page, context, errors } = await open(['PriceWatch:03', 'PriceWatch:06'], { dir: 'rtl' })
    await page.goto(ROOT)
    await page.waitForSelector('[data-queue-item]')
    const text = strip(await page.locator('body').innerText())
    check('9. RTL renders the queue with the Mindsite label', (await page.locator('[data-mindsite-suggested]').count()) === 1)
    check('9. RTL: no raw i18n keys', !rawKey(text), String(rawKey(text)))
    check('9. RTL: no page errors', errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: 'tools/.price-command-center-shots/matching-rtl.png', fullPage: true }).catch(() => {})
    await context.close()
  }
} catch (e) {
  check('drive ran to the end', false, String(e))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
