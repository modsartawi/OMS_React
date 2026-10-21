// Campaign promotions drive (BackOffice ADR 0097, brief 2848 renamed by 2862; ticket 534 creates it —
// 535 and 536 each ADD a section of their own below the previous one, and leave earlier checks unchanged).
//
// Drives the REAL app in Chromium against STUBS of the rule engine's promotion doors, on the REAL envelope
// { statusCode, success, message, errors: [{ errorCode, internalErrorCode, errorMessage }], data }, the
// fields exactly as the 2737 brief's section "HQ contract: promotions (2846-2847)" names them (checked
// against SIS.Api's RulePromotionWebEndpoints.cs / RulePromotionService.cs reply types on pricing2):
//   POST Rules/Authoring/Promotions/List (no body) → seven rows in HQ's order, newest first: a pending
//        upload (unnamed), a live upload, a live hand-made promotion, a stray code (`origin: null`, an
//        unlisted state `archived`), an ended upload, a disabled hand-made one with no window — then the
//        no-promotion row (`promotionCode: null, origin: null`); or a bare 403 with no body (`list: 'denied'`)
// Never a live SIS.Api: the doors are built (BackOffice 2846-2847) but not deployed anywhere this drive
// can reach; ticket 538 walks them.
//
// ── 534 ── in LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; the namespace is English only), it asserts:
//   1. the Campaigns group's first leaf reads Promotions, opens /campaigns and is the lit one there;
//   2. List is asked as a POST; the page names itself;
//   3. one row per promotion in the reply's order, the no-promotion row last, reading "No promotion";
//   4. the state badges (live, pending, ended, disabled), an unlisted state rendered as disabled;
//   5. the kind from origin: Uploaded / Hand-made, none for the stray code nor the no-promotion row;
//   6. the window as the INCLUSIVE days sent, isolated once; none for a null window; counts;
//   7. both names, or the code alone; the live version only when live; an upload's revision, state,
//      uploader and approver, nothing for a hand-made one; the status bar counts the promotions;
//   8. Upload a promotion links /campaigns/upload;
//   9. a row opens /campaigns/promotions/:promotionCode (Promotions still lit), its header from the list
//      row; the no-promotion row opens /campaigns/no-promotion; a stale code says so; Back returns;
//  10. a bare 403 reads "You do not have access to this action.", never an empty list;
//  11. no raw key and no page error.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/campaign-promotions-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ROUTE = '/campaigns'
/** Set SHOTS=<dir> to save a screenshot of each surface (never into the repo). */
const SHOTS = process.env.SHOTS || ''

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope.
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: message }] : [],
    data,
  }),
})
const BARE_403 = { status: 403, body: '' }

const ME = 'author1'
const DENIED = 'You do not have access to this action.'

const LIVE = '0001000048-261009-261015'
const PENDING = '0001000049-261016-261022'
const HAND = 'RAMADAN-BUNDLES'
const STRAY = 'OLD-FLYER'
const ENDED = '0001000040-260901-260907'
const DISABLED = 'SUMMER-CLEARANCE'

/** A `Promotions/List` row, every field the contract names; days are `DateTime?` on the wire. */
const promotion = (over) => ({
  promotionCode: LIVE,
  nameEn: '',
  nameAr: '',
  origin: 'upload',
  note: '',
  campaignCount: 0,
  skuCount: 0,
  windowFrom: null,
  windowUntil: null,
  state: 'disabled',
  liveVersionNo: null,
  revision: null,
  uploadState: null,
  uploadedBy: null,
  uploadNote: null,
  approvedBy: null,
  createdAt: '2026-10-01T09:00:00',
  ...over,
})
const upload = (revision, uploadState, approvedBy) => ({ revision, uploadState, uploadedBy: 'author2', uploadNote: 'SAP promotion number', approvedBy })

const LIST = [
  // An upload waiting for approval is already its promotion; nothing of it is live, and it has no names yet.
  promotion({ promotionCode: PENDING, state: 'pending', campaignCount: 4, skuCount: 18, windowFrom: '2026-10-16T00:00:00', windowUntil: '2026-10-22T00:00:00', ...upload(1, 'pending', null), createdAt: '2026-10-19T08:00:00' }),
  promotion({
    promotionCode: LIVE,
    nameEn: 'Sunscreen offers',
    nameAr: 'أسبوع واقي الشمس',
    state: 'live',
    liveVersionNo: 42,
    campaignCount: 3,
    skuCount: 41,
    windowFrom: '2026-10-09T00:00:00',
    windowUntil: '2026-10-15T00:00:00',
    ...upload(3, 'activated', 'approver1'),
    createdAt: '2026-10-08T09:00:00',
  }),
  promotion({ promotionCode: HAND, nameEn: 'Ramadan bundles', nameAr: 'باقات رمضان', origin: 'manual', state: 'live', liveVersionNo: 42, campaignCount: 2, skuCount: 9, windowFrom: '2026-10-01T00:00:00', windowUntil: '2026-10-31T00:00:00', createdAt: '2026-10-05T10:00:00' }),
  // A campaign stamped with a code that is neither a record nor an upload: its own row, origin null.
  promotion({ promotionCode: STRAY, origin: null, state: 'archived', campaignCount: 1, skuCount: 2, windowFrom: '2026-08-01T00:00:00', windowUntil: '2026-08-07T00:00:00', createdAt: '2026-08-01T00:00:00' }),
  promotion({ promotionCode: ENDED, nameEn: 'Back to school', nameAr: 'العودة إلى المدارس', state: 'ended', liveVersionNo: null, campaignCount: 5, skuCount: 30, windowFrom: '2026-09-01T00:00:00', windowUntil: '2026-09-07T00:00:00', ...upload(2, 'activated', 'approver2'), createdAt: '2026-08-30T09:00:00' }),
  promotion({ promotionCode: DISABLED, nameEn: 'Summer clearance', nameAr: 'تصفية الصيف', origin: 'manual', state: 'disabled', createdAt: '2026-07-01T09:00:00' }),
  // The no-promotion row, last: the hand-built campaigns in no promotion.
  promotion({ promotionCode: null, origin: null, state: 'live', liveVersionNo: 42, campaignCount: 12, skuCount: 64, windowFrom: '2026-01-01T00:00:00', windowUntil: '2026-12-31T00:00:00', createdAt: '0001-01-01T00:00:00' }),
]
const NO_PROMOTION_KEY = ' no-promotion'

const browser = await chromium.launch()

async function open(dir, path, { list = 'ok' } = {}) {
  const context = await browser.newContext({ viewport: { width: 1800, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // A stubbed 4xx is the drive's own doing.
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    calls.push({ p, method: req.method(), body: req.postData() })
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: ME, currentStoreCode: 'P001' }))
    if (p === 'Rules/Authoring/Promotions/List') return route.fulfill(list === 'denied' ? BARE_403 : envelope(LIST))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}${path}`)
  return { context, page, errors, calls }
}

const text = async (loc) => (await loc.innerText()).replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()

/** The rows of a grid in their drawn order, each as { id, cells: { colId: text }, state }. */
const gridRows = (page) =>
  page.locator('[data-promotions-grid] .ag-row').evaluateAll((rows) =>
    rows
      .map((r) => ({
        index: Number(r.getAttribute('row-index')),
        id: r.getAttribute('row-id'),
        cells: Object.fromEntries([...r.querySelectorAll('.ag-cell')].map((c) => [c.getAttribute('col-id'), c.innerText.replace(/[⁦-⁩]/g, '').trim()])),
        state: r.querySelector('[data-promotion-state]')?.getAttribute('data-promotion-state') ?? null,
        noPromotion: !!r.querySelector('[data-no-promotion]'),
        windowIsolated: !!r.querySelector('.ag-cell[col-id="window"] bdi'),
      }))
      .sort((a, b) => a.index - b.index),
  )
const rawKey = async (page) => /campaign-promotions:|campaign-list:|\b(list|kind|state|uploadState|promotion|columns|facts)\.[a-z]+[A-Za-z.]*\b/.test(await page.locator('main').innerText())

async function drive(dir) {
  const tag = dir.toUpperCase()

  // ── 1-8: the list ──
  {
    const { context, page, errors, calls } = await open(dir, ROUTE)
    await page.locator('[data-promotions-grid] .ag-row').nth(LIST.length - 1).waitFor({ timeout: 20000 })
    check(`${tag} 1: the document is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    const leaf = page.locator(`nav a[href="${ROUTE}"]`)
    check(`${tag} 1: the Campaigns group's leaf reads Promotions`, (await leaf.count()) === 1 && (await text(leaf.first())) === 'Promotions', (await leaf.count()) ? await text(leaf.first()) : 'none')
    check(`${tag} 1: …and is the lit leaf on /campaigns`, (await leaf.first().getAttribute('aria-current')) === 'page')
    check(`${tag} 1: no "Campaigns" leaf is left in the group's place`, (await page.locator('nav a', { hasText: /^Campaigns$/ }).count()) === 0)
    check(`${tag} 2: List is asked as a POST`, calls.some((c) => c.p === 'Rules/Authoring/Promotions/List' && c.method === 'POST'))
    check(`${tag} 2: the page names itself`, (await text(page.locator('[data-campaign-promotions] h1'))) === 'Promotions')

    const rows = await gridRows(page)
    const ids = rows.map((r) => r.id)
    check(`${tag} 3: one row per promotion, in the reply's order`, ids.join(',') === [PENDING, LIVE, HAND, STRAY, ENDED, DISABLED, NO_PROMOTION_KEY].join(','), ids.join(','))
    const last = rows.at(-1)
    check(`${tag} 3: the no-promotion row is last and reads "No promotion"`, last?.noPromotion === true && last?.cells.promotion === 'No promotion', JSON.stringify(last?.cells))
    const by = Object.fromEntries(rows.map((r) => [r.id, r]))
    check(
      `${tag} 4: the state badges`,
      by[PENDING].state === 'pending' && by[LIVE].state === 'live' && by[ENDED].state === 'ended' && by[DISABLED].state === 'disabled' && by[NO_PROMOTION_KEY].state === 'live',
      rows.map((r) => r.state).join(','),
    )
    check(
      `${tag} 4: the badges read our words`,
      by[PENDING].cells.state === 'Pending' && by[LIVE].cells.state === 'Live' && by[ENDED].cells.state === 'Ended' && by[DISABLED].cells.state === 'Disabled',
      rows.map((r) => r.cells.state).join(','),
    )
    check(`${tag} 4: an unlisted state renders as disabled`, by[STRAY].state === 'disabled' && by[STRAY].cells.state === 'Disabled', by[STRAY].cells.state)
    check(
      `${tag} 5: the kind from origin`,
      by[LIVE].cells.kind === 'Uploaded' && by[PENDING].cells.kind === 'Uploaded' && by[HAND].cells.kind === 'Hand-made' && by[DISABLED].cells.kind === 'Hand-made',
      rows.map((r) => r.cells.kind).join(','),
    )
    check(`${tag} 5: no kind for the stray code (origin null) nor the no-promotion row`, by[STRAY].cells.kind === '' && by[NO_PROMOTION_KEY].cells.kind === '')
    check(`${tag} 6: the window is the inclusive days sent`, by[LIVE].cells.window === '2026-10-09 – 2026-10-15' && by[NO_PROMOTION_KEY].cells.window === '2026-01-01 – 2026-12-31', by[LIVE].cells.window)
    check(`${tag} 6: …isolated once`, by[LIVE].windowIsolated)
    check(`${tag} 6: a null window shows none`, by[DISABLED].cells.window === '', by[DISABLED].cells.window)
    check(`${tag} 6: the campaign and SKU counts`, by[LIVE].cells.campaignCount === '3' && by[LIVE].cells.skuCount === '41' && by[NO_PROMOTION_KEY].cells.campaignCount === '12')
    check(`${tag} 7: both names`, by[LIVE].cells.promotion === LIVE && by[LIVE].cells.nameEn === 'Sunscreen offers' && by[LIVE].cells.nameAr === 'أسبوع واقي الشمس')
    check(`${tag} 7: an unnamed promotion shows its code alone`, by[PENDING].cells.promotion === PENDING && by[PENDING].cells.nameEn === '' && by[PENDING].cells.nameAr === '')
    check(`${tag} 7: the live version only when live`, by[LIVE].cells.liveVersionNo === '42' && by[ENDED].cells.liveVersionNo === '' && by[PENDING].cells.liveVersionNo === '')
    check(
      `${tag} 7: an upload's revision, state, uploader and approver`,
      by[LIVE].cells.revision === '3' && by[LIVE].cells.uploadState === 'Activated' && by[LIVE].cells.uploadedBy === 'author2' && by[LIVE].cells.approvedBy === 'approver1',
      JSON.stringify(by[LIVE].cells),
    )
    check(`${tag} 7: a pending upload has no approver yet`, by[PENDING].cells.uploadState === 'Pending' && by[PENDING].cells.approvedBy === '' && by[PENDING].cells.revision === '1')
    check(`${tag} 7: a hand-made promotion has no upload facts`, by[HAND].cells.revision === '' && by[HAND].cells.uploadState === '' && by[HAND].cells.uploadedBy === '' && by[HAND].cells.approvedBy === '')
    check(`${tag} 7: the status bar counts the promotions, not the no-promotion row`, (await text(page.locator('[data-status-count]'))) === '6 promotions', await text(page.locator('[data-status-count]')))
    const up = page.locator('[data-promotions-upload]')
    check(`${tag} 8: Upload a promotion links /campaigns/upload`, (await text(up)) === 'Upload a promotion' && (await up.getAttribute('href')) === '/campaigns/upload')
    check(`${tag} 8: there is no New promotion yet (536), no promotion budget and no promotion-wide disable`, (await page.locator('main button', { hasText: /New promotion|budget|Disable/i }).count()) === 0)
    check(`${tag} 11: no raw key, no page error (list)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/534-${dir}-list.png`, fullPage: true })

    await up.click()
    await page.waitForURL(`${BASE}/campaigns/upload`)
    check(`${tag} 8: …and opens it`, new URL(page.url()).pathname === '/campaigns/upload')
    await context.close()
  }

  // ── 9: a row opens its promotion; the no-promotion row its page ──
  {
    const { context, page, errors } = await open(dir, ROUTE)
    await page.locator('[data-promotions-grid] .ag-row').nth(LIST.length - 1).waitFor({ timeout: 20000 })
    // A click anywhere on the row (here its English name) opens it, not only the code's link.
    await page.locator(`[data-promotions-grid] .ag-row[row-id="${LIVE}"] .ag-cell[col-id="nameEn"]`).click()
    await page.waitForURL(`${BASE}/campaigns/promotions/${LIVE}`)
    check(`${tag} 9: a row opens /campaigns/promotions/:promotionCode`, new URL(page.url()).pathname === `/campaigns/promotions/${LIVE}`)
    await page.locator('[data-promotion-header]').waitFor({ timeout: 10000 })
    check(`${tag} 9: its header from the list row: the code and both names`, (await text(page.locator('[data-promotion-header] h1'))) === LIVE && (await text(page.locator('[data-promotion-names]'))) === 'Sunscreen offers أسبوع واقي الشمس')
    const fact = (k) => text(page.locator(`[data-promotion-fact="${k}"] dd`))
    check(`${tag} 9: kind, state, window and live version`, (await fact('kind')) === 'Uploaded' && (await fact('state')) === 'Live' && (await fact('window')) === '2026-10-09 – 2026-10-15' && (await fact('liveVersionNo')) === '42')
    check(`${tag} 9: Promotions is still the lit leaf`, (await page.locator(`nav a[href="${ROUTE}"]`).first().getAttribute('aria-current')) === 'page')
    await page.locator('[data-promotion-back]').click()
    await page.waitForURL(`${BASE}${ROUTE}`)
    check(`${tag} 9: Back returns to the Promotions list`, new URL(page.url()).pathname === ROUTE)

    await page.locator('[data-promotions-grid] [data-no-promotion]').waitFor({ timeout: 10000 })
    await page.locator('[data-promotions-grid] [data-no-promotion]').click()
    await page.waitForURL(`${BASE}/campaigns/no-promotion`)
    await page.locator('[data-promotion-header]').waitFor({ timeout: 10000 })
    check(`${tag} 9: the no-promotion row opens /campaigns/no-promotion, reading "No promotion"`, (await text(page.locator('[data-promotion-header] h1'))) === 'No promotion' && (await page.locator('[data-promotion-fact="kind"]').count()) === 0)
    check(`${tag} 11: no raw key, no page error (a promotion)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/534-${dir}-no-promotion.png`, fullPage: true })
    await context.close()
  }
  {
    // HQ keeps codes unique in any case; a link typed in another case still finds its promotion.
    const { context, page } = await open(dir, `${ROUTE}/promotions/${HAND.toLowerCase()}`)
    await page.locator('[data-promotion-header]').waitFor({ timeout: 20000 })
    check(`${tag} 9: a code in another case opens its promotion`, (await text(page.locator('[data-promotion-header] h1'))) === HAND && (await text(page.locator('[data-promotion-fact="kind"] dd'))) === 'Hand-made')
    await context.close()
  }
  {
    const { context, page } = await open(dir, `${ROUTE}/promotions/NOPE-0001`)
    const gone = page.locator('[data-promotion-not-found]')
    await gone.waitFor({ timeout: 20000 })
    check(`${tag} 9: a stale code says so, with the way back`, (await text(gone)) === 'There is no such promotion: the link may be stale.' && (await page.locator('[data-promotion-back]').getAttribute('href')) === ROUTE)
    await context.close()
  }

  // ── 10: no grant ──
  {
    const { context, page, errors } = await open(dir, ROUTE, { list: 'denied' })
    const failed = page.locator('[data-promotions-failed]')
    await failed.waitFor({ timeout: 20000 })
    check(`${tag} 10: a bare 403 reads "${DENIED}", never an empty list`, (await text(failed)) === DENIED && (await page.locator('[data-promotions-grid]').count()) === 0, await text(failed))
    check(`${tag} 10: …and Upload a promotion is still offered (no guessed role hides it)`, (await page.locator('[data-promotions-upload]').count()) === 1)
    check(`${tag} 11: no raw key, no page error (denied)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page } = await open(dir, `${ROUTE}/promotions/${LIVE}`, { list: 'denied' })
    const failed = page.locator('[data-promotion-failed]')
    await failed.waitFor({ timeout: 20000 })
    check(`${tag} 10: a bare 403 on a promotion's page reads "${DENIED}" too`, (await text(failed)) === DENIED, await text(failed))
    await context.close()
  }
}

await drive('ltr')
await drive('rtl')
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
