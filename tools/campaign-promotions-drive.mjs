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
//        — or, for 535 (`list: 'flyer'`), a 560-campaign flyer first, then those rows
//   POST Rules/Authoring/Promotions/Campaigns { promotionCode | null, q?, mechanic?, status?, page, pageSize } →
//        HQ's page, filtered and paged as HQ does it (`campaignsPage`); 404 RULES_PROMOTION_NOT_FOUND for a
//        code neither a record nor an upload; a bare 403 (`campaigns: 'denied'`); BO ask J's fields only
//        with `askJ` (535)
//   POST Rules/Authoring/Drafts/List → two drafts never published and one published (535)
//   POST Rules/Authoring/Drafts/Save → the new draft (535's New campaign)
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

// ── 535 fixtures: a promotion's campaigns (POST Rules/Authoring/Promotions/Campaigns) ──
// HQ's reading, stubbed: `q` matches the id and both names in any case; `status` in any case;
// `mechanics` counts the rows matching q and status (not mechanic), a null mechanic uncounted;
// `total` is the filtered count; rows by id; past the last page an empty page; `generatedNames` the
// promotion's whole count. A code neither a record nor an upload (the stray code) is a 404
// RULES_PROMOTION_NOT_FOUND. BO ask J (BackOffice 2855, unbuilt) answers `promotionCode`, `budgets`
// and `withBudget` only with `askJ`.
const FLYER = '0001000050-261023-261029'
const MECHANICS = ['percentOff', 'bundle', 'fixedPrice', 'buyXgetY']
const pad = (n) => String(n).padStart(4, '0')
/** A `Promotions/Campaigns` row, every field the contract names. */
const campaignRow = (over) => ({
  id: '',
  nameEn: '',
  nameAr: '',
  nameArGenerated: false,
  mechanic: 'builder',
  skuCount: 1,
  ruleCount: 1,
  windowFrom: '2026-10-23T00:00:00',
  windowUntil: '2026-10-29T00:00:00',
  status: 'Published',
  ...over,
})
/** The Arabic name the drive searches for: one campaign of the flyer holds it. */
const AR_SEARCH = 'واقي'
const AR_HIT = `${FLYER}-C0237`
/** The flyer: 560 campaigns of its activated upload (every 50th uploaded before 2846, no mechanic),
 *  and the 12 a pending re-upload adds — rows already, but not in the promotion's counts. */
const FLYER_CAMPAIGNS = [
  ...Array.from({ length: 560 }, (_, i) =>
    campaignRow({
      id: `${FLYER}-C${pad(i + 1)}`,
      nameEn: `Flyer offer ${i + 1}`,
      nameAr: `${FLYER}-C${pad(i + 1)}` === AR_HIT ? 'واقي الشمس للأطفال' : `عرض النشرة ${i + 1}`,
      nameArGenerated: i % 5 === 0,
      mechanic: i % 50 === 49 ? null : MECHANICS[i % 4],
      skuCount: 4,
    }),
  ),
  ...Array.from({ length: 12 }, (_, i) => campaignRow({ id: `${FLYER}-P${pad(i + 1)}`, nameEn: `Re-upload offer ${i + 1}`, nameAr: `عرض إعادة الرفع ${i + 1}`, mechanic: 'bundle', status: 'Pending' })),
]
const CAMPAIGNS_535 = {
  [FLYER]: FLYER_CAMPAIGNS,
  [LIVE]: [1, 2, 3].map((n) => campaignRow({ id: `${LIVE}-S${n}`, nameEn: `Sunscreen ${n}`, nameAr: `واقي ${n}`, mechanic: 'percentOff', windowFrom: '2026-10-09T00:00:00', windowUntil: '2026-10-15T00:00:00' })),
  [PENDING]: [1, 2, 3, 4].map((n) => campaignRow({ id: `${PENDING}-N${n}`, mechanic: 'bundle', status: 'Pending' })),
  [HAND]: [campaignRow({ id: 'RAMADAN-DATES', nameEn: 'Dates 2 for 1', nameAr: 'تمور 2 بسعر 1' }), campaignRow({ id: 'RAMADAN-JUICE', nameEn: 'Juice 10% off', nameAr: 'عصير خصم 10%' })],
  [ENDED]: [1, 2, 3, 4, 5].map((n) => campaignRow({ id: `${ENDED}-B${n}`, mechanic: 'fixedPrice', windowFrom: '2026-09-01T00:00:00', windowUntil: '2026-09-07T00:00:00' })),
  [DISABLED]: [],
  // The no-promotion page: hand-built campaigns (builder), one of a mechanic and one of a status this
  // client has no word for.
  '': [
    campaignRow({ id: 'WKND20', nameEn: 'Weekend coupon: 20% off', nameAr: 'قسيمة نهاية الأسبوع: خصم 20%', ruleCount: 2, windowFrom: '2026-10-01T00:00:00', windowUntil: '2026-12-30T00:00:00' }),
    campaignRow({ id: 'NATDAY-15', nameEn: 'National Day 15% off', nameAr: 'اليوم الوطني خصم 15%', ruleCount: 3 }),
    campaignRow({ id: 'SPIN-1', nameEn: 'Spin the wheel', nameAr: 'أدر العجلة', mechanic: 'spinTheWheel' }),
    campaignRow({ id: 'SUMMER-OLD', nameEn: 'Summer (old)', nameAr: 'الصيف (قديم)', status: 'Archived', windowFrom: null, windowUntil: null }),
  ],
}
/** BO ask J: a campaign's budgets (its `budgets[]` length). */
const budgetsOf = (r) => (r.id.endsWith('3') ? 1 : 0)

function campaignsPage(body, { askJ }) {
  const asked = body.promotionCode ?? ''
  const code = Object.keys(CAMPAIGNS_535).find((k) => k.toLowerCase() === asked.toLowerCase())
  if (code === undefined) return { message: `There is no promotion ${asked}: neither a record nor an upload.` }
  const all = CAMPAIGNS_535[code]
  const q = (body.q ?? '').toLowerCase()
  const status = (body.status ?? '').toLowerCase()
  const matching = all.filter((r) => (!q || [r.id, r.nameEn, r.nameAr].some((v) => v.toLowerCase().includes(q))) && (!status || r.status.toLowerCase() === status))
  const mechanics = {}
  for (const r of matching) if (r.mechanic != null) mechanics[r.mechanic] = (mechanics[r.mechanic] ?? 0) + 1
  const rows = matching.filter((r) => !body.mechanic || r.mechanic === body.mechanic).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const page = body.page ?? 1
  const size = Math.min(body.pageSize ?? 50, 200)
  return {
    page: {
      promotionCode: code || null,
      total: rows.length,
      page,
      pageSize: size,
      mechanics,
      generatedNames: all.filter((r) => r.nameArGenerated).length,
      campaigns: rows.slice((page - 1) * size, page * size).map((r) => (askJ ? { ...r, promotionCode: code || null, budgets: budgetsOf(r) } : r)),
      ...(askJ ? { withBudget: all.filter((r) => budgetsOf(r) > 0).length } : {}),
    },
  }
}

/** 535's list: the flyer first (live, a re-upload pending), then 534's rows. */
const LIST_535 = [
  promotion({
    promotionCode: FLYER,
    nameEn: 'Autumn flyer',
    nameAr: 'نشرة الخريف',
    state: 'live',
    liveVersionNo: 43,
    campaignCount: 560,
    skuCount: 2240,
    note: 'Flyer 50, all stores',
    windowFrom: '2026-10-23T00:00:00',
    windowUntil: '2026-10-29T00:00:00',
    ...upload(5, 'pending', 'approver1'),
    uploadNote: 'SAP promotion 0001000050',
    createdAt: '2026-10-20T08:00:00',
  }),
  ...LIST,
]

/** Drafts/List: two never published, one published (version 3) — only the first two are listed. */
const draftSummary = (campaign, en, ar, publishedVersionNo) => ({ campaign, name: { en, ar }, revision: 2, features: ['points'], publishedVersionNo, updatedAt: '2026-10-19T09:40:00', updatedBy: 'Omar (marketing)', state: 'editing', requestedBy: '' })
const DRAFTS = [draftSummary('SPRING-DRAFT', 'Spring skincare', 'العناية الربيعية', 0), draftSummary('WKND20', 'Weekend coupon: 20% off', 'قسيمة نهاية الأسبوع', 3), draftSummary('GIFT-POUCH', 'Gift pouch', 'حقيبة هدية', 0)]

/** Drafts/Save at revision 0: the new draft, as HQ answers it. */
const savedDraft = (body) => ({
  code: body.campaign?.id,
  source: 'draft',
  revision: 1,
  features: body.features ?? [],
  campaign: body.campaign,
  name: body.campaign?.name,
  publishedVersionNo: 0,
  updatedAt: '2026-10-21T10:00:00',
  updatedBy: ME,
  validation: { canActivate: false, errors: [], warnings: [], offline: null },
  state: 'editing',
  tree: null,
  origin: '',
  campaignStatus: '',
  requestedBy: '',
  requestedAt: '0001-01-01T00:00:00',
  requestNote: '',
  reviewedBy: '',
  reviewedAt: '0001-01-01T00:00:00',
  reviewNote: '',
})

const browser = await chromium.launch()

async function open(dir, path, { list = 'ok', campaigns = 'ok', askJ = false } = {}) {
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
    if (p === 'Rules/Authoring/Promotions/List') return route.fulfill(list === 'denied' ? BARE_403 : envelope(list === 'flyer' ? LIST_535 : LIST))
    // 535: a promotion's campaigns, filtered and paged as HQ does it; Drafts/List for the no-promotion page.
    if (p === 'Rules/Authoring/Promotions/Campaigns') {
      if (campaigns === 'denied') return route.fulfill(BARE_403)
      const out = campaignsPage(JSON.parse(req.postData() || '{}'), { askJ })
      return route.fulfill(out.page ? envelope(out.page) : envelope(null, { status: 404, success: false, message: out.message, errorCode: 'RULES_PROMOTION_NOT_FOUND' }))
    }
    if (p === 'Rules/Authoring/Drafts/List') return route.fulfill(envelope(DRAFTS))
    if (p === 'Rules/Authoring/Drafts/Save') return route.fulfill(envelope(savedDraft(JSON.parse(req.postData() || '{}'))))
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

// ── 535 ── a promotion's page, its campaigns paged and filtered by HQ. In LTR and RTL it asserts:
//  12. a 560-campaign promotion: Campaigns asked as a POST for the promotion, page 1 of 50; the header
//      (code, names, kind, state, window, live version, note and the differing upload note); the
//      tiles (campaigns with "+12 pending", SKUs, generated Arabic names; no "with a budget" while
//      BO ask J is unanswered); 50 rows by id with every column; the pager walks pages on the server
//      and the last page holds the pending re-upload's rows; Re-upload and Its upload; no assign,
//      unassign, delete, promotion budget or promotion-wide disable;
//  13. every mechanics key is a chip with its count after "All"; a chip narrows to its mechanic and goes
//      back to page 1, every chip keeping its count; the status filter narrows to Pending;
//  14. an Arabic search finds the campaign by its Arabic name; a row opens /campaigns/:id with the
//      list's context; Back restores the search and the chip;
//  15. BO ask J stubbed: with `withBudget` the tile shows it;
//  16. the no-promotion page sends promotionCode null; builder and an unknown mechanic are chips; an
//      unknown status renders Disabled; the drafts never published are listed (a published one is
//      not); From a template opens Create campaign on its template tab; New campaign on the blank
//      tab, a taken id is not pre-checked, and Create sends one Drafts/Save at revision 0;
//  17. a stale promotion link (HQ's 404 RULES_PROMOTION_NOT_FOUND) says so, with the way back;
//  18. Campaigns refused with a bare 403 reads "You do not have access to this action.", never an empty table,
//      and the filters stay;
//  19. no raw key and no page error.
const CAMPAIGNS_DOOR = 'Rules/Authoring/Promotions/Campaigns'
/** The page's own reads (50 a page), not the one-row read of the unfiltered total behind "+N pending". */
const campaignBodies = (calls) => calls.filter((c) => c.p === CAMPAIGNS_DOOR).map((c) => JSON.parse(c.body || '{}')).filter((b) => b.pageSize === 50)
const pageGrid = '[data-promotion-campaigns-grid]'
const pageRows = (page) =>
  page.locator(`${pageGrid} .ag-row`).evaluateAll((rows) =>
    rows
      .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      .map((r) => ({
        id: r.getAttribute('row-id'),
        cells: Object.fromEntries([...r.querySelectorAll('.ag-cell')].map((c) => [c.getAttribute('col-id'), c.innerText.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()])),
        status: r.querySelector('[data-campaign-status]')?.getAttribute('data-campaign-status') ?? null,
        generated: !!r.querySelector('[data-generated]'),
        windowIsolated: !!r.querySelector('.ag-cell[col-id="window"] bdi'),
      })),
  )
/** Wait until the grid's first row is `id` and the count line reads `count` (null: any). */
async function waitPage(page, id, count) {
  await page.waitForFunction(
    ([sel, first, want]) => {
      const rows = [...document.querySelectorAll(`${sel} .ag-row`)].sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
      const shown = document.querySelector('[data-campaigns-count]')?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
      return rows[0]?.getAttribute('row-id') === first && (want === null || shown === want)
    },
    [pageGrid, id, count],
    { timeout: 20000 },
  )
}
const params = (page) => Object.fromEntries(new URL(page.url()).searchParams)
const chipsOf = (page) =>
  page.locator('[data-mechanic-chip]').evaluateAll((els) =>
    els.map((e) => ({ mechanic: e.getAttribute('data-mechanic-chip'), count: e.querySelector('[data-chip-count]')?.textContent?.replace(/[⁦-⁩]/g, '').trim(), on: e.getAttribute('aria-pressed') === 'true' })),
  )
const fmt = (n) => n.toLocaleString('en-US')
/** HQ's mechanics for the flyer, unfiltered: every counted key, in first-seen order. */
const FLYER_MECHANICS = (() => {
  const m = {}
  for (const r of FLYER_CAMPAIGNS) if (r.mechanic != null) m[r.mechanic] = (m[r.mechanic] ?? 0) + 1
  return m
})()

async function drive535(dir) {
  const tag = `${dir.toUpperCase()} 535`
  const flyerPath = `${ROUTE}/promotions/${FLYER}`

  // ── 12 ──
  {
    const { context, page, errors, calls } = await open(dir, flyerPath, { list: 'flyer' })
    await waitPage(page, `${FLYER}-C0001`, `Showing 1–50 of ${fmt(FLYER_CAMPAIGNS.length)} campaigns`)
    const first = campaignBodies(calls)[0]
    check(`${tag} 12: Campaigns is asked as a POST for the promotion, page 1 of 50`, calls.some((c) => c.p === CAMPAIGNS_DOOR && c.method === 'POST') && JSON.stringify(first) === JSON.stringify({ promotionCode: FLYER, page: 1, pageSize: 50 }), JSON.stringify(first))
    const fact = (k) => text(page.locator(`[data-promotion-fact="${k}"] dd`))
    check(`${tag} 12: the header: code, both names, kind, state`, (await text(page.locator('[data-promotion-header] h1'))) === FLYER && (await text(page.locator('[data-promotion-names]'))) === 'Autumn flyer نشرة الخريف' && (await fact('kind')) === 'Uploaded' && (await fact('state')) === 'Live')
    check(`${tag} 12: …the window, the live version, the note and the upload note that differs`, (await fact('window')) === '2026-10-23 – 2026-10-29' && (await fact('liveVersionNo')) === '43' && (await fact('note')) === 'Flyer 50, all stores' && (await fact('uploadNote')) === 'SAP promotion 0001000050')
    const tile = (k) => text(page.locator(`[data-promotion-tile="${k}"] [data-tile-count]`))
    check(`${tag} 12: the campaigns tile is the promotion's count`, (await tile('campaigns')) === '560', await tile('campaigns'))
    const pending = page.locator('[data-pending-beyond]')
    await pending.waitFor({ timeout: 10000 })
    check(`${tag} 12: …with "+12 pending" (the unfiltered total is larger), the signed count isolated whole`, (await text(pending)) === '+12 pending' && (await pending.locator('bdi[dir="ltr"]').innerText()).replace(/[⁦-⁩]/g, '') === '+12', await text(pending))
    // Read in its words' order in RTL too: the count is drawn first (leftmost), not after "pending".
    check(`${tag} 12: …drawn "+12 pending", the count first, in ${dir.toUpperCase()} too`, await pending.evaluate((el) => Math.abs(el.querySelector('bdi').getBoundingClientRect().left - el.getBoundingClientRect().left) < 2))
    check(`${tag} 12: SKUs and generated Arabic names`, (await tile('skus')) === '2,240' && (await tile('generatedNames')) === fmt(FLYER_CAMPAIGNS.filter((r) => r.nameArGenerated).length), `${await tile('skus')} ${await tile('generatedNames')}`)
    check(`${tag} 12: no "with a budget" tile while BO ask J is unanswered`, (await page.locator('[data-promotion-tile="withBudget"]').count()) === 0)
    // The grid draws only the rows in view: the count line says 50, the drawn ones run by id from the first.
    let rows = await pageRows(page)
    check(`${tag} 12: 50 rows a page, by id`, rows.length > 10 && rows.every((r, i) => r.id === `${FLYER}-C${String(i + 1).padStart(4, '0')}`), `${rows.length} ${rows[0]?.id}`)
    const r1 = rows[0]
    check(
      `${tag} 12: every column: id, both names, the generated badge, mechanic, SKUs, rules, window, status`,
      r1.cells.id === `${FLYER}-C0001` && r1.cells.nameEn === 'Flyer offer 1' && r1.cells.nameAr.startsWith('عرض النشرة 1') && r1.generated && r1.cells.mechanic === 'percentOff' && r1.cells.skuCount === '4' && r1.cells.ruleCount === '1' && r1.cells.window === '2026-10-23 – 2026-10-29' && r1.status === 'Published' && r1.cells.status === 'Published',
      JSON.stringify(r1),
    )
    check(`${tag} 12: …the window isolated once; a name the upload did not generate has no badge`, r1.windowIsolated && !rows[1].generated)
    await page.locator('nav[aria-label="Result pages"] button').last().click()
    await waitPage(page, `${FLYER}-C0051`, `Showing 51–100 of ${fmt(FLYER_CAMPAIGNS.length)} campaigns`)
    check(`${tag} 12: Next asks HQ for page 2 and lands in the URL`, params(page).page === '2' && campaignBodies(calls).at(-1).page === 2)
    await page.goto(`${BASE}${flyerPath}?page=12`)
    await waitPage(page, `${FLYER}-C0551`, `Showing 551–572 of ${fmt(FLYER_CAMPAIGNS.length)} campaigns`)
    rows = await pageRows(page)
    check(`${tag} 12: the last page holds the pending re-upload's rows, Pending`, rows.length === 22 && rows.at(-1).id === `${FLYER}-P0012` && rows.at(-1).status === 'Pending' && rows.at(-1).cells.status === 'Pending')
    const reupload = page.locator('[data-promotion-reupload]')
    const its = page.locator('[data-promotion-its-upload]')
    check(`${tag} 12: Re-upload links the campaign upload`, (await text(reupload)) === 'Re-upload' && (await reupload.getAttribute('href')) === '/campaigns/upload')
    check(`${tag} 12: Its upload links /campaigns/uploads/:promotionCode`, (await text(its)) === 'Its upload' && (await its.getAttribute('href')) === `/campaigns/uploads/${FLYER}`)
    check(`${tag} 12: no assign, unassign, delete, promotion budget or promotion-wide disable`, (await page.locator('main button, main a', { hasText: /(assign|unassign|delete|disable)|budget/i }).count()) === 0)
    check(`${tag} 19: no raw key, no page error (a promotion)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/535-${dir}-flyer.png`, fullPage: true })
    await its.click()
    await page.waitForURL(`${BASE}/campaigns/uploads/${FLYER}`)
    check(`${tag} 12: …and Its upload opens it`, new URL(page.url()).pathname === `/campaigns/uploads/${FLYER}`)
    await context.close()
  }

  // ── 13 ──
  {
    const { context, page, errors, calls } = await open(dir, `${flyerPath}?page=3`, { list: 'flyer' })
    await waitPage(page, `${FLYER}-C0101`, null)
    let chips = await chipsOf(page)
    const expected = [['', fmt(Object.values(FLYER_MECHANICS).reduce((a, b) => a + b, 0))], ...Object.entries(FLYER_MECHANICS).map(([k, n]) => [k, fmt(n)])]
    check(`${tag} 13: every mechanics key is a chip with its count, after "All" with the sum`, JSON.stringify(chips.map((c) => [c.mechanic, c.count])) === JSON.stringify(expected), JSON.stringify(chips))
    check(`${tag} 13: "All" reads All and is on`, (await text(page.locator('[data-mechanic-chip=""]'))).startsWith('All') && chips[0].on)
    await page.locator('[data-mechanic-chip="bundle"]').click()
    await waitPage(page, `${FLYER}-C0002`, `Showing 1–50 of ${fmt(FLYER_MECHANICS.bundle)} campaigns`)
    check(`${tag} 13: a chip narrows to its mechanic and goes back to page 1`, params(page).mechanic === 'bundle' && params(page).page === undefined && campaignBodies(calls).at(-1).mechanic === 'bundle' && campaignBodies(calls).at(-1).page === 1)
    chips = await chipsOf(page)
    check(`${tag} 13: …the chip is on, and every chip keeps its count`, chips.find((c) => c.mechanic === 'bundle').on && JSON.stringify(chips.map((c) => [c.mechanic, c.count])) === JSON.stringify(expected), JSON.stringify(chips))
    check(`${tag} 13: …every row is that mechanic`, (await pageRows(page)).every((r) => r.cells.mechanic === 'bundle'))
    await page.locator('[data-status-chip="Pending"]').click()
    await waitPage(page, `${FLYER}-P0001`, 'Showing 1–12 of 12 campaigns')
    const rows = await pageRows(page)
    check(`${tag} 13: the status filter narrows to the pending re-upload's 12`, params(page).status === 'Pending' && campaignBodies(calls).at(-1).status === 'Pending' && rows.length === 12 && rows.every((r) => r.status === 'Pending'))
    chips = await chipsOf(page)
    check(`${tag} 13: …the chip counts follow the status`, JSON.stringify(chips.map((c) => [c.mechanic, c.count])) === JSON.stringify([['', '12'], ['bundle', '12']]), JSON.stringify(chips))
    await page.locator('[data-pending-beyond]').waitFor({ timeout: 10000 })
    check(`${tag} 13: …and "+12 pending" still weighs the unfiltered total`, (await text(page.locator('[data-pending-beyond]'))) === '+12 pending')
    check(`${tag} 19: no raw key, no page error (filters)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/535-${dir}-filtered.png`, fullPage: true })
    await context.close()
  }

  // ── 14 ──
  {
    const { context, page, errors, calls } = await open(dir, flyerPath, { list: 'flyer' })
    await waitPage(page, `${FLYER}-C0001`, null)
    await page.locator('[data-promotion-search]').fill(AR_SEARCH)
    await waitPage(page, AR_HIT, 'Showing 1–1 of 1 campaign')
    check(`${tag} 14: an Arabic search finds the campaign by its Arabic name`, params(page).q === AR_SEARCH && campaignBodies(calls).at(-1).q === AR_SEARCH && (await pageRows(page))[0].cells.nameAr.startsWith('واقي الشمس للأطفال'))
    await page.locator('[data-mechanic-chip="percentOff"]').click()
    await page.waitForFunction(() => new URL(location.href).searchParams.get('mechanic') === 'percentOff')
    await waitPage(page, AR_HIT, 'Showing 1–1 of 1 campaign')
    const link = page.locator(`[data-promotion-campaign="${AR_HIT}"]`)
    // The grid takes the new rows (the same ids, a new context) after the URL has changed.
    await page.waitForFunction((id) => document.querySelector(`[data-promotion-campaign="${id}"]`)?.getAttribute('href')?.includes('mechanic=percentOff'), AR_HIT, { timeout: 5000 }).catch(() => {})
    check(`${tag} 14: the id is a link carrying the list's context`, decodeURIComponent((await link.getAttribute('href')) ?? '') === `/campaigns/${AR_HIT}?promotion=${FLYER}&q=${AR_SEARCH}&mechanic=percentOff`, await link.getAttribute('href'))
    check(`${tag} 19: no raw key, no page error (search)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    await page.locator(`${pageGrid} .ag-row[row-id="${AR_HIT}"] .ag-cell[col-id="nameEn"]`).click()
    await page.waitForURL((u) => u.pathname === `/campaigns/${AR_HIT}`)
    const ctx = params(page)
    check(`${tag} 14: a row opens /campaigns/:id with the list's context`, ctx.promotion === FLYER && ctx.q === AR_SEARCH && ctx.mechanic === 'percentOff' && ctx.status === undefined && ctx.page === undefined, page.url())
    await page.goBack()
    await waitPage(page, AR_HIT, 'Showing 1–1 of 1 campaign')
    check(
      `${tag} 14: Back restores the search and the chip`,
      new URL(page.url()).pathname === flyerPath && params(page).q === AR_SEARCH && params(page).mechanic === 'percentOff' && (await page.locator('[data-promotion-search]').inputValue()) === AR_SEARCH && (await page.locator('[data-mechanic-chip="percentOff"]').getAttribute('aria-pressed')) === 'true',
    )
    await context.close()
  }

  // ── 15 ──
  {
    const { context, page } = await open(dir, flyerPath, { list: 'flyer', askJ: true })
    await waitPage(page, `${FLYER}-C0001`, null)
    const withBudget = page.locator('[data-promotion-tile="withBudget"]')
    await withBudget.waitFor({ timeout: 10000 })
    check(`${tag} 15: BO ask J answered: "With a budget" shows the page's withBudget`, (await text(withBudget.locator('[data-tile-count]'))) === fmt(FLYER_CAMPAIGNS.filter((r) => budgetsOf(r) > 0).length) && (await text(withBudget)).includes('With a budget'), await text(withBudget))
    await context.close()
  }

  // ── 16 ──
  {
    const { context, page, errors, calls } = await open(dir, `${ROUTE}/no-promotion`)
    await waitPage(page, 'NATDAY-15', 'Showing 1–4 of 4 campaigns')
    check(`${tag} 16: the no-promotion page sends promotionCode null`, campaignBodies(calls)[0]?.promotionCode === null, JSON.stringify(campaignBodies(calls)[0]))
    const chips = await chipsOf(page)
    check(`${tag} 16: builder and an unknown mechanic are chips`, JSON.stringify(chips.map((c) => [c.mechanic, c.count])) === JSON.stringify([['', '4'], ['builder', '3'], ['spinTheWheel', '1']]), JSON.stringify(chips))
    const rows = await pageRows(page)
    const old = rows.find((r) => r.id === 'SUMMER-OLD')
    check(`${tag} 16: an unknown status renders Disabled; no window is empty`, old?.status === 'Disabled' && old?.cells.status === 'Disabled' && old?.cells.window === '', JSON.stringify(old))
    await page.locator('[data-never-published-draft]').first().waitFor({ timeout: 10000 })
    const drafts = await page.locator('[data-never-published-draft]').evaluateAll((els) => els.map((e) => e.getAttribute('data-never-published-draft')))
    check(`${tag} 16: the drafts never published are listed, a published one is not`, JSON.stringify(drafts) === '["SPRING-DRAFT","GIFT-POUCH"]', JSON.stringify(drafts))
    check(`${tag} 16: …each reading "Draft, never published"`, (await text(page.locator('[data-never-published-draft="SPRING-DRAFT"]'))).includes('Draft, never published'))
    check(`${tag} 16: no Re-upload or Its upload here`, (await page.locator('[data-promotion-reupload], [data-promotion-its-upload]').count()) === 0)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/535-${dir}-no-promotion.png`, fullPage: true })

    const dialog = page.locator('dialog[open]')
    await page.locator('[data-from-template]').click()
    await dialog.waitFor()
    await dialog.locator('[data-template-none]').waitFor({ timeout: 10000 })
    check(`${tag} 16: From a template opens Create campaign on its template tab`, (await dialog.locator('#modal-title').innerText()) === 'Create campaign' && (await dialog.locator('[data-create-tab="template"]').getAttribute('aria-selected')) === 'true')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    await page.locator('[data-new-campaign]').click()
    await dialog.waitFor()
    check(`${tag} 16: New campaign opens it on the blank tab`, (await dialog.locator('[data-create-tab="blank"]').getAttribute('aria-selected')) === 'true')
    await dialog.locator('[data-create-field="nameEn"]').fill('Ramadan nights')
    await dialog.locator('[data-create-field="nameAr"]').fill('ليالي رمضان')
    await dialog.locator('[data-create-field="id"]').fill('WKND20')
    await page.waitForTimeout(200)
    check(`${tag} 16: a taken id is not pre-checked (HQ's 409 is the guard)`, (await dialog.locator('[data-create-problem="id"]').count()) === 0)
    check(`${tag} 19: no raw key, no page error (no promotion)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    await dialog.locator('[data-create-field="id"]').fill('RAMADAN-NIGHTS')
    await dialog.locator('[data-create-submit]').click()
    await page.waitForURL(`${BASE}/campaigns/RAMADAN-NIGHTS`, { timeout: 10000 })
    const saves = calls.filter((c) => c.p === 'Rules/Authoring/Drafts/Save').map((c) => JSON.parse(c.body))
    check(`${tag} 16: Create sends ONE Drafts/Save at revision 0 and opens the draft`, saves.length === 1 && saves[0].revision === 0 && saves[0].campaign.id === 'RAMADAN-NIGHTS', JSON.stringify(saves))
    await context.close()
  }

  // ── 17 ──
  {
    const { context, page } = await open(dir, `${ROUTE}/promotions/${STRAY}`)
    const gone = page.locator('[data-promotion-not-found]')
    await gone.waitFor({ timeout: 20000 })
    check(`${tag} 17: a stale link HQ answers 404 RULES_PROMOTION_NOT_FOUND says so`, (await text(gone)) === 'There is no such promotion: the link may be stale.' && (await page.locator(pageGrid).count()) === 0)
    check(`${tag} 17: …with the way back to the list`, (await page.locator('[data-promotion-back]').getAttribute('href')) === ROUTE)
    await context.close()
  }

  // ── 18 ──
  {
    const { context, page, errors } = await open(dir, flyerPath, { list: 'flyer', campaigns: 'denied' })
    const failed = page.locator('[data-promotion-campaigns-failed]')
    await failed.waitFor({ timeout: 20000 })
    check(`${tag} 18: a bare 403 on Campaigns reads "${DENIED}", never an empty table`, (await text(failed)) === DENIED && (await page.locator(pageGrid).count()) === 0, await text(failed))
    check(`${tag} 18: …and the search and status filter stay, so a refused filter can be cleared`, (await page.locator('[data-promotion-search]').count()) === 1 && (await page.locator('[data-status-chip]').count()) === 4)
    check(`${tag} 19: no raw key, no page error (denied)`, !(await rawKey(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await drive('ltr')
await drive('rtl')
await drive535('ltr')
await drive535('rtl')
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
