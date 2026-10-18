// Stub fixtures for the rule-campaign drives (spec 2737; ticket 501 created them, 502–516 extended
// them, ticket 522 re-cut them to the REAL shapes of BackOffice 2758/2759). A campaign is the
// `Rules/Authoring/Drafts/Load` reply around the campaign JSON (schema 1) — the owner-approved
// prototype's sample campaigns (BackOffice `.scratch/proto/2734-rule-builder/data.js`) rewritten into
// schema 1 the way BackOffice's own fixture writes the five 2702 campaigns
// (`Tests/Data.Tests/Rules/Fixtures/five-2702.json`): conditions keyed by `check`, effects by
// `effect`, filters by id, named values as operator-first JSON.
//
// Every date is LOCAL: a day `yyyy-MM-dd`, a moment `yyyy-MM-ddTHH:mm:ss`, never a `Z`; a time HQ
// never set is `0001-01-01T00:00:00`. Three campaigns are NOT the prototype's — NATDAY-15
// (scheduled), SPRING-DRAFT (a draft never published) and SUMMER-FLASH (disabled) — added so every
// state tile has a campaign under it.

const says = (en, ar = '') => ({ en, ar })

/** HQ's "never set" time. */
export const NEVER = '0001-01-01T00:00:00'
/** `'yyyy-MM-dd HH:mm'` → a local moment. */
const moment = (at) => at.replace(' ', 'T') + ':00'

const RX = ['A006']
const F = (id, name, o = {}) => ({ id, name, ...o })
const R = (name, o = {}) => ({ id: 'r1', name, filters: [], values: [], when: [], then: [], ...o })
const B = (id, en, ar, scope, limit, value, period) => ({ id, name: says(en, ar), scope, limit, value, period })

const REASON = {
  budget: says('has a budget, counted centrally', 'لديها ميزانية تُحسب مركزياً'),
  profile: says('reads the member profile, looked up at HQ', 'تقرأ ملف العضو من المركز'),
  points: says('awards or takes points', 'تمنح النقاط أو تخصمها'),
  coupon: says('needs a coupon, checked at HQ', 'تحتاج قسيمة يتحقق منها المركز'),
}
const PROFILE_CHECKS = new Set(['minPoints', 'tier', 'member', 'firstPurchase', 'audience'])
const walk = (conds, fn) => conds.forEach((c) => { fn(c); if (Array.isArray(c.conditions)) walk(c.conditions, fn) })

/** HQ's offline verdict on a campaign, as `validation.offline` answers it (the prototype's rules). */
export function offlineOf(c) {
  const codes = new Set()
  if ((c.budgets ?? []).length) codes.add('budget')
  if (c.audience?.members && c.audience.members !== 'any') codes.add('profile')
  for (const r of c.rules) {
    walk(r.when, (cd) => {
      if (PROFILE_CHECKS.has(cd.check)) codes.add('profile')
      if (cd.check === 'coupon') codes.add('coupon')
      if (cd.check === 'budgetLeft') codes.add('budget')
    })
    for (const e of r.then) {
      if (e.effect === 'awardPoints' || e.effect === 'burnPoints') codes.add('points')
      if (e.effect === 'createCoupon') codes.add('profile')
    }
  }
  return { safe: codes.size === 0, onlineOnly: !!c.onlineOnly, reasons: [...codes].map((code) => ({ code, ...REASON[code] })) }
}

/** The features a campaign's blocks need, where the fixture does not say: points for a points block. */
function featuresOf(c) {
  let points = false
  for (const r of c.rules) {
    walk(r.when, (cd) => (points ||= cd.check === 'minPoints'))
    points ||= r.then.some((e) => e.effect === 'awardPoints' || e.effect === 'burnPoints')
  }
  return points ? ['points'] : []
}

/** A validation with no issue. */
export const validationOf = (c) => ({ canActivate: true, errors: [], warnings: [], offline: offlineOf(c) })

/**
 * A `Drafts/Load` reply. `published: [at, by]` makes it live (version `publishedVersionNo`, no draft:
 * `source: published`, revision 0); without it the campaign never went live and has a draft.
 */
function draft(campaign, o = {}) {
  const { published, saved, ...rest } = o
  const [at, by] = published ?? saved ?? ['2026-10-16 09:40', 'Omar (marketing)']
  return {
    code: campaign.id,
    source: published ? 'published' : 'draft',
    revision: published ? 0 : 1,
    features: featuresOf(campaign),
    campaign,
    name: campaign.name,
    publishedVersionNo: published ? 1 : 0,
    updatedAt: moment(at),
    updatedBy: by,
    validation: validationOf(campaign),
    state: 'editing',
    tree: null,
    origin: '',
    campaignStatus: published ? 'Published' : '',
    requestedBy: '',
    requestedAt: NEVER,
    requestNote: '',
    reviewedBy: '',
    reviewedAt: NEVER,
    reviewNote: '',
    ...rest,
  }
}

const SA = { countries: ['SA'], members: 'any' }
const SA_EARNING = { countries: ['SA'], members: 'earning' }
const EARNING_MEMBER = { check: 'member', earning: true, says: says('an earning member', 'عضو يكسب النقاط') }

export const CAMPAIGNS = [
  draft({
    id: 'PCUT-SA01', name: says('SAP promotional price cuts, sales org SA01', 'تخفيضات أسعار SAP، منظمة المبيعات SA01'),
    window: { from: '2026-10-01', until: '2026-12-31' }, audience: SA,
    valueMap: { means: 'targetPrice', unit: 'EA', entries: [['PAN-24', 7.95], ['SHA-400', 22]] },
    rules: [R('Price from the SA01 map', { then: [{ effect: 'discountPerItem', from: 'valueMap', label: says('Price cut', 'تخفيض السعر') }] })],
  }, { published: ['2026-10-01 09:12', 'Reem (pricing)'] }),
  draft({
    id: 'SUN-3FOR2', name: says('Suncare: any three, cheapest free, on a basket of SAR 150', 'العناية بالشمس: أي ثلاثة والأرخص مجاناً لسلة 150 ريال'),
    window: { from: '2026-08-01', until: '2026-11-01' }, audience: SA,
    rules: [R('Cheapest of every three suncare units free', {
      filters: [F('f-sun', 'sun', { articles: ['SUN-50', 'SUN-30', 'SUN-KID'] })],
      when: [
        { check: 'minCount', count: 3, of: 'f-sun', says: says('three suncare items', 'ثلاثة منتجات للعناية بالشمس') },
        { check: 'minSubtotal', amount: 150, basis: 'subtotal', says: says('a basket of SAR 150', 'سلة بقيمة 150 ريال') },
      ],
      then: [{ effect: 'freeUnits', filter: 'f-sun', buy: 3, free: 1, label: says('Suncare 3 for 2', 'العناية بالشمس 3 بسعر 2') }],
    })],
  }, { published: ['2026-07-28 14:40', 'Omar (marketing)'], features: ['points'] }), // points on, no points block yet (504's palette)
  draft({
    id: 'BABY-BUNDLE', name: says('Diapers + two packs of wipes for SAR 85', 'حفاضات مع عبوتي مناديل بـ 85 ريال'), audience: SA,
    rules: [R('Bundle price', {
      filters: [F('f-diapers', 'diapers', { articles: ['DIA-4'] }), F('f-wipes', 'wipes', { articles: ['WIP-80'] })],
      bundle: { lists: [{ filter: 'f-diapers', count: 1 }, { filter: 'f-wipes', count: 2 }], max: 2 },
      when: [{ check: 'minCount', count: 1, of: 'f-diapers', says: says('a pack of diapers', 'عبوة حفاضات') }],
      then: [{ effect: 'bundlePrice', value: 85, label: says('Baby bundle', 'باقة الطفل') }],
    })],
  }, { published: ['2026-10-02 10:05', 'Omar (marketing)'] }),
  draft({
    id: 'GP-BEAUTY15', name: says('Gold and Platinum: 15% off Beauty Care, twice a month', 'الذهبي والبلاتيني: خصم 15% على العناية بالجمال مرتين شهرياً'),
    audience: SA_EARNING, budgets: [B('b-twice-a-month', 'twice a month per member', 'مرتان شهرياً لكل عضو', 'profile', 'uses', 2, 'month')],
    rules: [R('15% off every Beauty Care line', {
      filters: [F('f-beauty', 'beauty', { categories: ['A002'], exclude: { categories: [...RX] } })],
      when: [
        { check: 'tier', in: ['G', 'P'], says: says('a Gold or Platinum member', 'عضو ذهبي أو بلاتيني') },
        { check: 'minCount', count: 1, of: 'f-beauty', says: says('a Beauty Care item', 'منتج عناية بالجمال') },
        { check: 'budgetLeft', budget: 'b-twice-a-month', says: says('twice a month per member', 'مرتان شهرياً لكل عضو') },
      ],
      then: [{ effect: 'discountItems', filter: 'f-beauty', kind: 'percent', value: 15, label: says('15% Beauty for Gold+', 'خصم 15% على الجمال للذهبي') }],
    })],
  }, { published: ['2026-08-01 08:00', 'Omar (marketing)'] }),
  draft({
    id: 'BDAY-BEAUTY', name: says('Birthday week: 10% off Beauty Care', 'أسبوع الميلاد: خصم 10% على العناية بالجمال'),
    audience: SA_EARNING, budgets: [B('b-once-a-month', 'once a month per member', 'مرة شهرياً لكل عضو', 'profile', 'uses', 1, 'month')],
    rules: [R('10% on beauty in the birthday week', {
      filters: [F('f-beauty', 'beauty', { categories: ['A002'], exclude: { categories: [...RX] } })],
      when: [{ check: 'audience', in: ['BIRTHDAY-WEEK'], says: says('a birthday this week', 'عيد ميلاد هذا الأسبوع') }],
      then: [
        { effect: 'discountItems', filter: 'f-beauty', kind: 'percent', value: 10, label: says('Birthday 10%', 'خصم الميلاد 10%') },
        { effect: 'cashierMessage', text: says('Wish the member a happy birthday', 'هنّئ العضو بعيد ميلاده') },
      ],
    })],
  }, {
    saved: ['2026-10-15 16:10', 'Omar (marketing)'], revision: 3, state: 'pending',
    requestedBy: 'Omar (marketing)', requestedAt: moment('2026-10-15 16:20'), requestNote: 'Ready for the November CRM push.',
  }),
  draft({
    id: 'WKND20', name: says('Weekend coupon: 20% off', 'قسيمة نهاية الأسبوع: خصم 20%'),
    window: { from: '2026-10-01', until: '2026-12-31', days: ['thu', 'fri', 'sat'] }, audience: SA,
    budgets: [B('b-money', 'campaign money', 'ميزانية الحملة', 'campaign', 'money', 50000, 'lifetime')],
    rules: [R('20% off the basket, Rx excluded', {
      filters: [F('f-eligible', 'eligible', { exclude: { categories: [...RX] } })],
      when: [{ check: 'coupon', code: 'WKND*', says: says('a valid weekend coupon', 'قسيمة نهاية أسبوع صالحة') }],
      then: [{ effect: 'discountSession', filter: 'f-eligible', kind: 'percent', value: 20, scope: 'items', label: says('Weekend 20%', 'خصم نهاية الأسبوع 20%') }],
    })],
  }, { published: ['2026-09-28 11:30', 'Sara (CRM)'], features: ['coupons', 'points'] }),
  draft({
    id: 'PTS-50OFF', name: says('Pay 30 points, get SAR 50 off a basket of SAR 200', 'ادفع 30 نقطة واحصل على خصم 50 ريال لسلة 200 ريال'),
    audience: SA_EARNING,
    rules: [R('Burn 30, take 50 off, together or not at all', {
      partial: 'refuse',
      filters: [F('f-eligible', 'eligible', { exclude: { categories: [...RX] } })],
      when: [
        EARNING_MEMBER,
        { check: 'sessionFlag', flag: 'pointsOffer', says: says('the member said yes at the till', 'وافق العضو عند الكاشير') },
        { check: 'minSubtotal', amount: 200, basis: 'total', says: says('a basket of SAR 200 after earlier offers', 'سلة 200 ريال بعد العروض السابقة') },
        { check: 'minPoints', points: 30, says: says('30 points', '30 نقطة') },
      ],
      then: [
        { effect: 'burnPoints', amount: 30, unit: 'PTS' },
        { effect: 'discountSession', filter: 'f-eligible', kind: 'amount', value: 50, label: says('SAR 50 off for 30 points', 'خصم 50 ريال مقابل 30 نقطة') },
      ],
    })],
  }, { published: ['2026-08-01 08:05', 'Sara (CRM)'] }),
  draft({
    id: 'NEXT-VISIT', name: says('Spend SAR 300, get a weekend coupon for next time', 'أنفق 300 ريال واحصل على قسيمة لنهاية الأسبوع القادمة'),
    audience: { countries: ['SA'], members: 'identified' },
    budgets: [B('b-once-a-month', 'once a month per member', 'مرة شهرياً لكل عضو', 'profile', 'uses', 1, 'month')],
    rules: [R('Mint a coupon', {
      when: [{ check: 'minSubtotal', amount: 300, basis: 'total', says: says('a basket of SAR 300', 'سلة بقيمة 300 ريال') }],
      then: [
        { effect: 'createCoupon', template: 'WKND20', validDays: 14, label: says('Weekend coupon', 'قسيمة نهاية الأسبوع') },
        { effect: 'cashierMessage', text: says('A weekend coupon is in the member’s wallet', 'قسيمة نهاية الأسبوع في محفظة العضو') },
      ],
    })],
  }, { published: ['2026-10-03 13:00', 'Sara (CRM)'], features: ['coupons', 'points'] }),
  draft({
    id: 'WLCB', name: says('Hayak welcome cashback: 10% back on a genuine first purchase', 'كاش باك حياك: 10% على أول عملية شراء'),
    window: { from: '2026-08-15', until: '2026-12-31' }, audience: SA_EARNING,
    budgets: [B('b-once', 'once per member, ever', 'مرة واحدة لكل عضو', 'profile', 'uses', 1, 'lifetime')],
    rules: [R('10% of eligible spend, whole SAR, half up', {
      filters: [F('f-eligible', 'Eligible', { exclude: { categories: [...RX] } })],
      values: [
        { name: 'eligible', expr: ['sum', ['items', 'f-eligible'], '$item.net'] },
        { name: 'back', expr: ['round', ['*', '$eligible', 0.1], 0, 'halfUp'] },
      ],
      when: [
        EARNING_MEMBER,
        { check: 'coupon', code: 'HAYAK*', says: says('a Hayak coupon', 'قسيمة حياك') },
        { check: 'firstPurchase', says: says('a genuine first purchase', 'أول عملية شراء فعلية') },
        { check: 'formula', expr: ['>', '$back', 0], says: says('something to pay back', 'مبلغ للاسترداد') },
        { check: 'budgetLeft', budget: 'b-once', says: says('once per member, ever', 'مرة واحدة لكل عضو') },
      ],
      then: [{ effect: 'awardPoints', amount: '$back', unit: 'SAR', activity: 'WLCB', activates: { afterDays: 7 }, expires: { afterDays: 30 } }],
    })],
  }, { published: ['2026-08-14 17:45', 'Sara (CRM)'], features: ['coupons', 'points'] }),
  draft({
    id: 'PRCB-AUG26', name: says('Arbahi points-back: online, 10/12/15% capped at SAR 105', 'استرداد نقاط أرباحي: أونلاين 10/12/15% بحد 105 ريال'),
    window: { from: '2026-08-27', until: '2026-09-04' }, audience: { countries: ['SA'], channels: ['CMRC'], members: 'earning' },
    rules: [R('Tiered points-back on earning categories', {
      filters: [F('f-earning', 'earning', { categories: ['A001', 'A002', 'A003', 'A005'] })],
      values: [
        { name: 'basis', expr: ['sum', ['items', 'f-earning'], '$item.net'] },
        { name: 'rate', expr: ['band', '$basis', [[200, 0.1], [400, 0.12], [700, 0.15]]] },
        { name: 'back', expr: ['min', ['round', ['*', '$basis', '$rate'], 0, 'halfUp'], 105] },
      ],
      when: [{ check: 'minSubtotal', amount: 200, of: 'f-earning', basis: 'total', says: says('SAR 200 of eligible spend', '200 ريال من المشتريات المؤهلة') }],
      then: [{ effect: 'awardPoints', amount: '$back', unit: 'SAR', activity: 'PRCB', activates: { on: '2026-09-10' }, expires: { on: '2026-09-17' } }],
    })],
  }, { published: ['2026-08-25 12:00', 'Sara (CRM)'] }),
  draft({
    id: 'BH-SPEND10', name: says('Bahrain: BHD 1.000 off a basket of BHD 10.000', 'البحرين: خصم 1.000 دينار لسلة 10.000 دينار'),
    audience: { countries: ['BH'], members: 'any' },
    rules: [R('BHD 1 off', {
      filters: [F('f-eligible', 'eligible', { exclude: { categories: [...RX] } })],
      when: [{ check: 'minSubtotal', amount: 10, basis: 'total', of: 'f-eligible', says: says('a basket of BHD 10.000', 'سلة بقيمة 10.000 دينار') }],
      then: [{ effect: 'discountSession', filter: 'f-eligible', kind: 'amount', value: 1, label: says('BHD 1 off', 'خصم 1 دينار') }],
    })],
  }, { published: ['2026-10-05 09:30', 'Ali (Bahrain)'] }),
  draft({
    id: 'BASE-EARN', name: says('Arbahi base earn (standing campaign)', 'كسب أرباحي الأساسي'),
    window: { from: '2026-01-01' }, audience: SA_EARNING,
    rules: [R('One point per riyal of earning spend', {
      filters: [F('f-earning', 'earning', { categories: ['A001', 'A002', 'A003', 'A005'] })],
      values: [{ name: 'pts', expr: ['floor', ['sum', ['items', 'f-earning'], '$item.net']] }],
      when: [{ check: 'formula', expr: ['>', '$pts', 0], says: says('earning spend', 'مشتريات مؤهلة للكسب') }],
      then: [{ effect: 'awardPoints', amount: '$pts', unit: 'PTS', activity: 'BASE', activates: { afterDays: 2 }, expires: { afterDays: 365 } }],
    })],
  }, { published: ['2026-09-30 08:00', 'Sara (CRM)'] }),
  draft({
    id: 'GIFT-POUCH', name: says('Free travel pouch with a Vitamin C serum', 'حقيبة سفر مجانية مع سيروم فيتامين سي'), audience: SA,
    rules: [R('Pouch free with the serum', {
      filters: [F('f-serum', 'serum', { articles: ['SER-VC'] }), F('f-pouch', 'pouch', { articles: ['GIFT-BAG'] })],
      when: [{ check: 'minCount', count: 1, of: 'f-serum', says: says('a Vitamin C serum', 'سيروم فيتامين سي') }],
      then: [{
        effect: 'freeProduct', filter: 'f-pouch', count: 1,
        prompt: says('Scan a travel pouch: it is free with the serum', 'امسح حقيبة السفر: مجانية مع السيروم'), label: says('Free pouch', 'حقيبة مجانية'),
      }],
    })],
  }, { published: ['2026-10-10 15:00', 'Omar (marketing)'], publishedVersionNo: 3 }),
  // ── Not the prototype's: one campaign per state the prototype's samples leave empty. ──
  draft({
    id: 'NATDAY-15', name: says('National Day: 15% off the basket', 'اليوم الوطني: خصم 15% على السلة'),
    window: { from: '2026-10-19', until: '2026-10-26', hours: { from: '16:00', until: '23:00' } }, audience: SA,
    rules: [R('15% off', {
      filters: [F('f-eligible', 'eligible', { exclude: { categories: [...RX] } })],
      then: [{ effect: 'discountSession', filter: 'f-eligible', kind: 'percent', value: 15, label: says('National Day 15%', 'خصم اليوم الوطني 15%') }],
    })],
  }, { published: ['2026-10-12 10:00', 'Reem (approver)'] }),
  draft({ id: 'SPRING-DRAFT', name: says('Spring skincare (draft)', ''), rules: [] }, {
    saved: ['2026-10-16 09:40', 'Omar (marketing)'],
    validation: {
      canActivate: false,
      errors: [{ severity: 'error', rule: null, ruleId: null, block: 'campaign', index: null, field: null, where: 'campaign', message: 'a campaign needs at least one rule', path: 'campaign.rules' }],
      warnings: [],
      offline: null,
    },
  }),
  draft({
    id: 'SUMMER-FLASH', name: says('Summer flash sale', 'تخفيضات الصيف السريعة'), window: { from: '2026-09-01' }, audience: SA,
    rules: [R('10% off', {
      filters: [F('f-eligible', 'eligible', { exclude: { categories: [...RX] } })],
      then: [{ effect: 'discountSession', filter: 'f-eligible', kind: 'percent', value: 10, label: says('Summer 10%', 'خصم الصيف 10%') }],
    })],
  }, { published: ['2026-08-30 12:00', 'Reem (approver)'], campaignStatus: 'Disabled' }),
]

/** A campaign as the PROVISIONAL list door sends it (524 composes it from Drafts/List, Order and the
 *  live ruleset): the draft's own words; `state` is null for a live campaign with no draft. */
export const listRow = (d) => ({
  campaign: d.code,
  name: d.name,
  state: d.source === 'published' ? null : d.state,
  campaignStatus: d.campaignStatus,
  publishedVersionNo: d.publishedVersionNo,
  window: d.campaign.window ?? null,
  features: d.features,
  updatedAt: d.updatedAt,
  updatedBy: d.updatedBy,
})

// ── 522: the draft doors (POST Rules/Authoring/Drafts/Load | Save | Delete, BackOffice 2758 + 2759).
// A refusal is `{ refused, status, message }`; the drive wraps it in the refusal envelope. ──

const BY = 'msartawi'
const CODE = /^[A-Za-z0-9._-]{1,40}$/

const refuse = (refused, status, message) => ({ refused, status, message })

/** A new draft in the store: never published, editing, revision 1. */
function newDraft(store, campaign, features, at, origin = '') {
  const made = draft(structuredClone(campaign), { saved: [at, BY], features: [...features], origin })
  store.push(made)
  return made
}

/** POST Rules/Authoring/Drafts/Load { campaign }. */
export function loadDraft(store, code) {
  const d = store.find((c) => c.code === code)
  return d ? { draft: d } : refuse('RULES_DRAFT_NOT_FOUND', 404, 'No draft or version of this campaign.')
}

/** POST Rules/Authoring/Drafts/Save { campaign, features, revision }: the draft whole at its revision. */
export function saveDraft(store, body, at) {
  const id = body?.campaign?.id
  if (typeof id !== 'string' || !CODE.test(id)) return refuse('RULES_BAD_CAMPAIGN_CODE', 400, 'A campaign is named by its id: at most 40 of A-Z a-z 0-9 . _ -')
  const d = store.find((c) => c.code === id)
  if (!d) {
    if (body.revision !== 0) return refuse('RULES_DRAFT_STALE', 409, 'The draft changed since it was loaded: load it again.')
    return { draft: newDraft(store, body.campaign, body.features ?? [], at) }
  }
  if (d.state === 'pending') return refuse('RULES_DRAFT_PENDING', 409, 'The draft waits for approval and cannot change.')
  if (d.revision !== body.revision) return refuse('RULES_DRAFT_STALE', 409, 'The draft changed since it was loaded: load it again.')
  remember(d)
  Object.assign(d, {
    campaign: structuredClone(body.campaign),
    name: structuredClone(body.campaign.name),
    features: [...(body.features ?? [])],
    revision: d.revision + 1,
    source: 'draft',
    state: 'editing',
    updatedAt: moment(at),
    updatedBy: BY,
    validation: validationOf(body.campaign),
    ...(body.tree ? { tree: structuredClone(body.tree) } : {}),
  })
  return { draft: d }
}

/** The published copies, by code, so a deleted draft falls back to its live campaign. */
const PUBLISHED = new Map()
function remember(d) {
  if (d.campaignStatus && !PUBLISHED.has(d.code)) PUBLISHED.set(d.code, structuredClone(d.campaign))
}

/** POST Rules/Authoring/Drafts/Delete { campaign, revision }. */
export function deleteDraft(store, body) {
  const i = store.findIndex((c) => c.code === body?.campaign)
  if (i < 0 || store[i].source === 'published') return refuse('RULES_DRAFT_NOT_FOUND', 404, 'This campaign has no draft.')
  const d = store[i]
  if (d.state === 'pending') return refuse('RULES_DRAFT_PENDING', 409, 'The draft waits for approval and cannot change.')
  if (d.revision !== body.revision) return refuse('RULES_DRAFT_STALE', 409, 'The draft changed since it was loaded: load it again.')
  if (!d.campaignStatus) store.splice(i, 1)
  else {
    const live = PUBLISHED.get(d.code) ?? d.campaign
    Object.assign(d, { source: 'published', revision: 0, state: 'editing', campaign: structuredClone(live), name: live.name, validation: validationOf(live) })
  }
  return { deleted: { campaign: d.code, deleted: true } }
}

/** A code from `base` (at most `max` long), unique within `store`. */
const mintCode = (store, base, max = 16) => {
  const root = base.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, max).replace(/^-|-$/g, '') || 'NEW'
  let code = root
  for (let n = 2; store.some((c) => c.code === code); n++) code = `${root}-${n}`
  return code
}

/** POST RuleCampaign/Campaigns/{id}/Copy (PROVISIONAL until 524's Drafts/Copy) — a new draft "<name> (copy)". */
export function copyOf(store, source, at) {
  const code = mintCode(store, `${source.code}-COPY`, source.code.length + 5)
  const campaign = {
    ...structuredClone(source.campaign),
    id: code,
    name: { en: `${source.name.en} (copy)`, ar: source.name.ar ? `${source.name.ar} (نسخة)` : '' },
  }
  return newDraft(store, campaign, source.features, at, `copy:${source.code}`)
}

// ── 503: templates (BackOffice 2759; PROVISIONAL until 524). The prototype's `sampleTemplates()`: a
// schema-1 campaign whose values are `{ placeholder: key }` marks or `{{key}}` inside a string, filled
// by the Create dialog. ──

const P = (key) => ({ placeholder: key })
export const TEMPLATES = [
  {
    id: 'T-SPEND-PCT', name: says('Spend X, get Y% off a category', 'أنفق مبلغاً واحصل على خصم على فئة'), enabled: true,
    description: 'A basket threshold and a percent off the categories picked. Marketing fills in three values.',
    placeholders: [
      { key: 'minSpend', label: 'Minimum basket (SAR)', kind: 'number', min: 50, max: 1000, default: 200 },
      { key: 'pct', label: 'Percent off', kind: 'number', min: 5, max: 30, default: 10 },
      { key: 'cats', label: 'Category', kind: 'pick', lookup: 'categories', default: ['A002'] },
    ],
    draft: {
      name: says('Spend SAR {{minSpend}}, get {{pct}}% off', 'أنفق {{minSpend}} ريال واحصل على خصم {{pct}}%'),
      features: [],
      rules: [{
        id: 'tr-spend', name: '{{pct}}% off the category', values: [], partial: 'refuse',
        filters: [{ id: 'tf-target', name: 'target', categories: P('cats'), exclude: { categories: [...RX] } }],
        when: [{ check: 'minSubtotal', amount: P('minSpend'), basis: 'total', says: says('a basket of SAR {{minSpend}}', 'سلة بقيمة {{minSpend}} ريال') }],
        then: [{ effect: 'discountItems', filter: 'tf-target', kind: 'percent', value: P('pct'), label: says('{{pct}}% off', 'خصم {{pct}}%') }],
      }],
    },
  },
  {
    id: 'T-BUY-N', name: says('Buy N in a collection, get M free', 'اشترِ عدداً من مجموعة واحصل على قطع مجاناً'), enabled: true,
    description: 'The bonus-buy shape most stores know. Cheapest units go free.',
    placeholders: [
      { key: 'coll', label: 'Collection', kind: 'pick', lookup: 'collections', default: ['SUNCARE'] },
      { key: 'buy', label: 'Buy (N)', kind: 'number', min: 2, max: 6, default: 3 },
      { key: 'free', label: 'Free (M)', kind: 'number', min: 1, max: 2, default: 1 },
    ],
    draft: {
      name: says('Buy {{buy}}, get {{free}} free', 'اشترِ {{buy}} واحصل على {{free}} مجاناً'),
      features: [],
      rules: [{
        id: 'tr-buy', name: 'Cheapest {{free}} of every {{buy}} free', values: [], partial: 'refuse',
        filters: [{ id: 'tf-set', name: 'set', articles: P('coll'), exclude: { categories: [...RX] } }],
        when: [{ check: 'minCount', count: P('buy'), of: 'tf-set', says: says('{{buy}} items from the collection', '{{buy}} منتجات من المجموعة') }],
        then: [{ effect: 'freeUnits', filter: 'tf-set', buy: P('buy'), free: P('free'), label: says('{{buy}} for less', '{{buy}} بسعر أقل') }],
      }],
    },
  },
  {
    id: 'T-TIER-PTS', name: says('Extra points for a tier', 'نقاط إضافية لفئة عضوية'), enabled: false,
    description: 'Award a multiple of the base earn to one tier. Waits on the tier rules work.',
    placeholders: [
      { key: 'tier', label: 'Tier', kind: 'choice', options: [{ code: 'S', name: 'Silver' }, { code: 'G', name: 'Gold' }, { code: 'P', name: 'Platinum' }], default: 'G' },
      { key: 'mult', label: 'Points per riyal', kind: 'number', min: 1, max: 5, default: 2 },
    ],
    draft: {
      name: says('Tier {{tier}}: {{mult}} points per riyal', 'الفئة {{tier}}: {{mult}} نقاط لكل ريال'),
      features: ['points'],
      audience: { countries: ['SA'], members: 'earning' },
      rules: [{
        id: 'tr-tier', name: 'Tier points', partial: 'refuse',
        filters: [{ id: 'tf-earning', name: 'earning', categories: ['A001', 'A002', 'A003', 'A005'], exclude: { categories: [...RX] } }],
        values: [{ name: 'pts', expr: ['floor', ['*', ['sum', ['items', 'tf-earning'], '$item.net'], P('mult')]] }],
        when: [{ check: 'tier', in: [P('tier')], says: says('a {{tier}} member', 'عضو {{tier}}') }],
        then: [{ effect: 'awardPoints', amount: '$pts', unit: 'PTS', activity: 'TIERX', activates: { afterDays: 2 }, expires: { afterDays: 365 } }],
      }],
    },
  },
]

/** POST RuleCampaign/Templates/{id}/Create (PROVISIONAL until 524's Drafts/FromTemplate) — a new
 *  draft from the filled template the dialog sends; the stub takes the draft as sent. */
export function createFromTemplate(store, template, { draft: filled }, at) {
  const code = mintCode(store, filled.name.en)
  const campaign = {
    id: code,
    name: { en: filled.name.en, ar: filled.name.ar },
    ...(filled.audience ? { audience: structuredClone(filled.audience) } : {}),
    rules: structuredClone(filled.rules),
  }
  return newDraft(store, campaign, filled.features ?? [], at, `template:${template.id}`)
}

// ── 511: the approval life (PROVISIONAL doors until 524's Approvals/*), over the draft's `state` and
// `campaignStatus`. A move from the wrong state is HQ's refusal. ──

/** POST RuleCampaign/Campaigns/{id}/{act}: the draft moved, or `{ refused }` with HQ's code. */
export function lifecycle(d, act, { note = '', by, at }) {
  remember(d)
  const when = moment(at)
  const drafted = d.source === 'draft'
  if (act === 'AskForApproval') {
    if (!drafted || d.state === 'pending') return { refused: 'RULES_DRAFT_PENDING' }
    Object.assign(d, { state: 'pending', requestedBy: by, requestedAt: when, requestNote: note, reviewedBy: '', reviewedAt: NEVER, reviewNote: '' })
  } else if (act === 'SendBack') {
    if (d.state !== 'pending') return { refused: 'RULES_NOT_PENDING' }
    Object.assign(d, { state: 'sentBack', reviewedBy: by, reviewedAt: when, reviewNote: note })
  } else if (act === 'Activate') {
    if (d.state !== 'pending') return { refused: 'RULES_NOT_PENDING' }
    PUBLISHED.set(d.code, structuredClone(d.campaign))
    Object.assign(d, {
      source: 'published', revision: 0, state: 'editing', campaignStatus: 'Published', publishedVersionNo: d.publishedVersionNo + 1,
      requestedBy: '', requestedAt: NEVER, requestNote: '', reviewedBy: by, reviewedAt: when, reviewNote: note, updatedAt: when, updatedBy: by,
    })
  } else if (act === 'Disable') {
    if (d.campaignStatus !== 'Published') return { refused: 'RULES_NOT_LIVE' }
    Object.assign(d, { campaignStatus: 'Disabled', publishedVersionNo: d.publishedVersionNo + 1 })
  } else return { refused: 'RULES_BAD_REQUEST' }
  return { campaign: d }
}

// ── 523: the block catalogue (POST Rules/Authoring/Catalogue { features }, BackOffice 2758). A port of
// BackOffice `RuleBlockCatalogue.cs` (its groups, blocks, sentences, fields and examples, word for
// word), served gated as HQ gates it: a block of a feature the campaign lacks is not listed, nor a
// budget's coupon scope without coupons or its points limits without points; a group is listed only
// with a block in it. Newtonsoft writes every unset member as null. The vitest proofs
// (`src/core/rules/sentence.test.ts`, the palette's) read this same catalogue. ──

const LT = (en, ar) => ({ en, ar })
const FLD = (name, type, o = {}) => ({ name, type, required: !!o.required, unit: o.unit ?? null, values: o.values ?? null, lookup: o.lookup ?? null, default: o.default ?? null, fields: o.fields ?? null })
const SAY_TEXT = LT('not met yet', 'لم يتحقق بعد')
const LABEL_TEXT = LT('Offer', 'عرض')
const saysField = FLD('says', 'text')
const labelField = FLD('label', 'text', { required: true })
const ofField = FLD('of', 'filter')
const scopeField = FLD('scope', 'choice', { values: ['items', 'fees', 'itemsAndFees'], default: 'items' })
const catBlock = (kind, type, group, en, ar, sentenceEn, sentenceAr, feature, offline, example, fields, path) => ({
  kind, type, group, name: LT(en, ar), sentence: LT(sentenceEn, sentenceAr), feature, offline, open: null, path, fields, example,
})
const cond = (type, group, en, ar, sEn, sAr, feature, offline, example, ...fields) =>
  catBlock('condition', type, group, en, ar, sEn, sAr, feature, offline, { check: type, ...example }, [FLD('check', 'code', { required: true }), ...fields], 'rule.when[]')
const eff = (type, group, en, ar, sEn, sAr, feature, offline, example, ...fields) =>
  catBlock('effect', type, group, en, ar, sEn, sAr, feature, offline, { effect: type, ...example }, [FLD('effect', 'code', { required: true }), ...fields], 'rule.then[]')
const setting = (path, group, en, ar, sEn, sAr, example, ...fields) => {
  const type = path.slice(path.indexOf('.') + 1).replace(/\[\]$/, '')
  return catBlock('setting', type, group, en, ar, sEn, sAr, null, type === 'budgets' ? 'budget' : null, example, fields, path)
}

const GROUPS = [
  ['cart', 'condition', 'Cart', 'السلة'], ['customer', 'condition', 'Customer', 'العميل'], ['context', 'condition', 'Where and how', 'المكان والقناة'],
  ['limits', 'condition', 'Budgets', 'الميزانيات'], ['couponConditions', 'condition', 'Coupons', 'القسائم'], ['advanced', 'condition', 'Advanced', 'متقدم'],
  ['discounts', 'effect', 'Discounts', 'الخصومات'], ['freeGoods', 'effect', 'Free goods', 'بضاعة مجانية'], ['bundles', 'effect', 'Bundles', 'الحزم'],
  ['points', 'effect', 'Points', 'النقاط'], ['couponEffects', 'effect', 'Coupons', 'القسائم'], ['messages', 'effect', 'Messages', 'الرسائل'],
  ['items', 'setting', 'Items', 'الأصناف'], ['campaign', 'setting', 'Campaign', 'الحملة'],
].map(([id, kind, en, ar]) => ({ id, kind, name: LT(en, ar) }))

const BLOCKS = [
  cond('minSubtotal', 'cart', 'Minimum subtotal', 'حد أدنى للمجموع', 'the subtotal of {of} is at least {amount}', 'مجموع {of} لا يقل عن {amount}', null, null,
    { amount: 100, says: SAY_TEXT }, FLD('amount', 'money', { required: true, unit: 'currency' }), ofField, FLD('basis', 'choice', { values: ['subtotal', 'total'], default: 'subtotal' }), saysField),
  cond('minCount', 'cart', 'Minimum count', 'حد أدنى للعدد', 'at least {count} units of {of}', '{count} وحدات على الأقل من {of}', null, null,
    { count: 2, says: SAY_TEXT }, FLD('count', 'count', { required: true, unit: 'units' }), ofField, saysField),
  cond('minPoints', 'customer', 'Minimum points', 'حد أدنى للنقاط', 'the member has at least {points} points', 'لدى العضو {points} نقطة على الأقل', 'points', 'profile',
    { points: 500, says: SAY_TEXT }, FLD('points', 'points', { required: true, unit: 'points' }), saysField),
  cond('tier', 'customer', 'Tier', 'الفئة', "the member's tier is {in}", 'فئة العضو {in}', null, 'profile',
    { in: ['G', 'P'], says: SAY_TEXT }, FLD('in', 'codes', { required: true }), saysField),
  cond('member', 'customer', 'Member', 'عضو', 'the customer is a member (earning: {earning})', 'العميل عضو (يكسب النقاط: {earning})', null, 'profile',
    { earning: true, says: SAY_TEXT }, FLD('earning', 'bool', { default: false }), saysField),
  cond('firstPurchase', 'customer', 'First purchase', 'أول عملية شراء', "it is the member's first purchase", 'إنها أول عملية شراء للعضو', null, 'profile',
    { says: SAY_TEXT }, saysField),
  {
    ...cond('audience', 'customer', 'Audience', 'الجمهور', 'the member is in {in}', 'العضو ضمن {in}', null, 'profile',
      { in: ['VIP'], says: SAY_TEXT }, FLD('in', 'codes', { required: true, lookup: 'audiences' }), saysField),
    open: 'How an audience is uploaded and versioned is not decided (spec 2737, Further Notes): the lookup lists the audiences published campaigns already name.',
  },
  cond('channel', 'context', 'Channel', 'القناة', 'the sale is made through {in}', 'البيع عبر {in}', null, null,
    { in: ['CASH'], says: SAY_TEXT }, FLD('in', 'codes', { required: true }), saysField),
  cond('store', 'context', 'Store', 'الفرع', 'the sale is made at {in}', 'البيع في {in}', null, null,
    { in: ['S101'], says: SAY_TEXT }, FLD('in', 'codes', { required: true, lookup: 'stores' }), saysField),
  cond('budgetLeft', 'limits', 'Budget left', 'رصيد الميزانية', 'budget {budget} is not used up', 'الميزانية {budget} لم تُستنفد', null, 'budget',
    { budget: 'b1', says: SAY_TEXT }, FLD('budget', 'budget', { required: true, lookup: 'budgets' }), saysField),
  cond('coupon', 'couponConditions', 'Coupon', 'قسيمة', 'the customer presents coupon {code}', 'يقدم العميل القسيمة {code}', 'coupons', 'coupon',
    { code: 'HAYAK*', says: SAY_TEXT }, FLD('code', 'code', { required: true }), saysField),
  cond('sessionFlag', 'advanced', 'Customer accepts', 'قبول العميل', 'the customer accepts {flag}', 'يقبل العميل {flag}', null, null,
    { flag: 'use-points', says: SAY_TEXT }, FLD('flag', 'code', { required: true }), saysField),
  cond('formula', 'advanced', 'Formula', 'معادلة', '{expr} is true', '{expr} صحيحة', null, null,
    { expr: ['>=', '$session.subtotal', 50], says: SAY_TEXT }, FLD('expr', 'formula', { required: true }), saysField),
  cond('group', 'advanced', 'Group', 'مجموعة', '{mode} of these are met', '{mode} من هذه متحققة', null, null,
    { mode: 'any', conditions: [{ check: 'firstPurchase', says: SAY_TEXT }] },
    FLD('mode', 'choice', { required: true, values: ['all', 'any'] }), FLD('conditions', 'conditions', { required: true }), saysField),

  eff('discountItems', 'discounts', 'Discount items', 'خصم على الأصناف', '{value}% off {filter}', 'خصم {value}% على {filter}', null, null,
    { filter: 'f1', kind: 'percent', value: 10, label: LABEL_TEXT },
    FLD('filter', 'filter', { required: true }), FLD('kind', 'choice', { required: true, values: ['percent'] }), FLD('value', 'percent', { required: true, unit: '%' }), scopeField, labelField),
  eff('discountSession', 'discounts', 'Discount the basket', 'خصم على السلة', '{value} off {filter}, spread pro rata', 'خصم {value} على {filter} موزع بالتناسب', null, null,
    { kind: 'amount', value: 20, label: LABEL_TEXT },
    FLD('filter', 'filter'), FLD('kind', 'choice', { required: true, values: ['amount', 'percent'] }), FLD('value', 'formula', { required: true, unit: 'currency|%' }), scopeField, labelField),
  eff('discountPerItem', 'discounts', 'Price from the value map', 'سعر من جدول القيم', 'each item of {filter} priced from the value map', 'كل صنف من {filter} بسعر من جدول القيم', null, null,
    { from: 'valueMap', label: LABEL_TEXT },
    FLD('from', 'choice', { required: true, values: ['valueMap'], lookup: 'valueMaps' }), FLD('filter', 'filter'), labelField),
  eff('freeUnits', 'freeGoods', 'Buy N, cheapest free', 'اشترِ N والأرخص مجاناً', 'of every {buy} of {filter}, the {free} cheapest free', 'من كل {buy} من {filter} الأرخص {free} مجاناً', null, null,
    { filter: 'f1', buy: 3, free: 1, label: LABEL_TEXT },
    FLD('filter', 'filter', { required: true }), FLD('buy', 'count', { required: true, unit: 'units' }), FLD('free', 'count', { required: true, unit: 'units' }), labelField),
  eff('freeProduct', 'freeGoods', 'A free product', 'منتج مجاني', '{count} of {filter} free, prompted if not scanned', '{count} من {filter} مجاناً مع تنبيه إن لم يُمسح', null, null,
    { filter: 'f1', count: 1, label: LABEL_TEXT },
    FLD('filter', 'filter', { required: true }), FLD('count', 'count', { required: true, unit: 'units' }), FLD('prompt', 'text'), labelField),
  eff('bundlePrice', 'bundles', 'Bundle price', 'سعر الحزمة', 'each bundle for {value}', 'كل حزمة بسعر {value}', null, null,
    { value: 30, label: LABEL_TEXT }, FLD('value', 'money', { required: true, unit: 'currency' }), labelField),
  eff('bundleDiscount', 'bundles', 'Bundle discount', 'خصم الحزمة', '{value} off each bundle', 'خصم {value} على كل حزمة', null, null,
    { value: 5, label: LABEL_TEXT }, FLD('value', 'money', { required: true, unit: 'currency' }), labelField),
  eff('discountCheapestInBundle', 'bundles', 'Cheapest in bundle free', 'الأرخص في الحزمة مجاناً', 'the cheapest unit of each bundle free', 'أرخص وحدة في كل حزمة مجاناً', null, null,
    { label: LABEL_TEXT }, labelField),
  eff('awardPoints', 'points', 'Award points', 'منح نقاط', 'award {amount} {unit}', 'منح {amount} {unit}', 'points', 'points',
    { amount: 500, unit: 'PTS', activity: 'BONUS' },
    FLD('amount', 'formula', { required: true, unit: 'SAR|PTS' }), FLD('unit', 'choice', { required: true, values: ['SAR', 'PTS'] }), FLD('activity', 'code', { required: true }),
    FLD('activates', 'pointsDate'), FLD('expires', 'pointsDate'), FLD('tierPoints', 'bool', { default: false })),
  eff('burnPoints', 'points', 'Use points', 'استخدام النقاط', 'use {amount} points (pays the bill: {tender})', 'استخدام {amount} نقطة (دفع الفاتورة: {tender})', 'points', 'points',
    { amount: 500, unit: 'PTS' },
    FLD('amount', 'formula', { required: true, unit: 'points' }), FLD('unit', 'choice', { required: true, values: ['PTS'] }), FLD('tender', 'bool', { default: false })),
  eff('createCoupon', 'couponEffects', 'Coupon for next time', 'قسيمة للزيارة القادمة', 'a coupon of {template}, valid {validDays} days', 'قسيمة من {template} صالحة {validDays} يوماً', 'coupons', 'profile',
    { template: 'NEXT-VISIT', validDays: 30, label: LABEL_TEXT },
    FLD('template', 'code', { required: true }), FLD('validDays', 'count', { required: true, unit: 'days' }), labelField),
  eff('cashierMessage', 'messages', 'Cashier message', 'رسالة للكاشير', 'tell the cashier {text}', 'أبلغ الكاشير {text}', null, null,
    { text: LT('Offer the gift bag', 'اعرض كيس الهدية') }, FLD('text', 'text', { required: true })),

  setting('rule.filters[]', 'items', 'Item filter', 'مرشح الأصناف', '{name}: {categories} and {articles}, except {exclude}', '{name}: {categories} و{articles} باستثناء {exclude}',
    { id: 'f1', name: 'Beauty', categories: ['A002'], exclude: { categories: ['A006'] } },
    FLD('id', 'code', { required: true }), FLD('name', 'code'), FLD('categories', 'codes', { lookup: 'categories' }), FLD('articles', 'codes', { lookup: 'materials' }),
    FLD('exclude', 'object', { fields: [FLD('categories', 'codes', { lookup: 'categories', default: ['A006'] })] })),
  setting('rule.values[]', 'items', 'Named value', 'قيمة مسماة', '{name} = {expr}', '{name} = {expr}',
    { name: 'back', expr: ['*', '$session.subtotal', 0.1] }, FLD('name', 'code', { required: true }), FLD('expr', 'formula', { required: true })),
  setting('rule.bundle', 'items', 'Bundle', 'حزمة', 'a bundle of {lists}', 'حزمة من {lists}',
    { lists: [{ filter: 'f1', count: 1 }] },
    FLD('lists', 'objects', { required: true, fields: [FLD('filter', 'filter', { required: true }), FLD('count', 'count', { required: true, unit: 'units' })] }),
    FLD('sameAttribute', 'code'), FLD('max', 'count', { unit: 'bundles' })),
  setting('rule.partial', 'items', 'Points not covered', 'نقاط غير كافية', 'when the points do not cover it: {partial}', 'عند عدم كفاية النقاط: {partial}',
    'refuse', FLD('partial', 'choice', { values: ['refuse', 'scale'], default: 'refuse' })),
  setting('campaign.budgets[]', 'campaign', 'Budget', 'ميزانية', 'limit the {limit} to {value} per {scope} per {period}', 'حد {limit} إلى {value} لكل {scope} لكل {period}',
    { id: 'b1', name: LT('Uses per member', 'الاستخدامات لكل عضو'), scope: 'profile', limit: 'uses', value: 1, period: 'month' },
    FLD('id', 'code', { required: true }), FLD('name', 'text', { required: true }),
    FLD('scope', 'choice', { required: true, values: ['campaign', 'profile', 'store', 'session', 'coupon'] }),
    FLD('limit', 'choice', { required: true, values: ['uses', 'money', 'pointsGiven', 'pointsTaken'] }),
    FLD('value', 'number', { required: true }), FLD('period', 'choice', { required: true, values: ['lifetime', 'day', 'week', 'month'] })),
  setting('campaign.window', 'campaign', 'Schedule', 'الجدول', 'from {from} until {until}, on {days}, {hours}', 'من {from} حتى {until} أيام {days} {hours}',
    { from: '2026-11-01', until: '2026-12-01', days: ['thu', 'fri'], hours: { from: '16:00', until: '23:00' } },
    FLD('from', 'date'), FLD('until', 'date'), FLD('days', 'codes', { values: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] }),
    FLD('hours', 'object', { fields: [FLD('from', 'time', { required: true }), FLD('until', 'time', { required: true })] })),
  setting('campaign.audience', 'campaign', 'Audience', 'الجمهور', 'in {countries}, through {channels}, at {stores}, for {members}', 'في {countries} عبر {channels} في {stores} لـ {members}',
    { countries: ['SA'], members: 'any' },
    FLD('countries', 'codes'), FLD('channels', 'codes'), FLD('stores', 'codes', { lookup: 'stores' }), FLD('members', 'choice', { values: ['any', 'identified', 'earning'], default: 'any' })),
  setting('campaign.valueMap', 'campaign', 'Value map', 'جدول القيم', 'a {means} per material, in {unit}', '{means} لكل صنف بوحدة {unit}',
    { means: 'targetPrice', unit: 'EA', entries: [['PAN-24', 7.95]] },
    FLD('means', 'choice', { required: true, values: ['targetPrice', 'percentOff', 'amountOff'] }), FLD('unit', 'code', { required: true }),
    FLD('entries', 'entries', { required: true, lookup: 'valueMaps' })),
  setting('campaign.onlineOnly', 'campaign', 'Online only', 'عبر الإنترنت فقط', 'never run on an offline till', 'لا تعمل على نقطة بيع غير متصلة',
    true, FLD('onlineOnly', 'bool', { default: false })),
]

const ALL_FEATURES = ['coupons', 'points']
/** A choice value that belongs to a feature (a budget's coupon scope, its points limits). */
const FEATURE_VALUES = { coupon: 'coupons', pointsGiven: 'points', pointsTaken: 'points' }
const LOOKUP_KINDS = ['categories', 'collections', 'materials', 'stores', 'audiences', 'valueMaps', 'budgets']

/** What `Rules/Authoring/Catalogue { features }` answers: unknown features ignored, any case. */
export function catalogueFor(features = []) {
  const asked = new Set((features ?? []).filter((f) => typeof f === 'string').map((f) => f.trim().toLowerCase()))
  const on = ALL_FEATURES.filter((f) => asked.has(f))
  const gateField = (f) => ({
    ...f,
    values: f.values ? f.values.filter((v) => !FEATURE_VALUES[v] || on.includes(FEATURE_VALUES[v])) : null,
    fields: f.fields ? f.fields.map(gateField) : null,
  })
  const blocks = BLOCKS.filter((b) => b.feature === null || on.includes(b.feature)).map((b) => structuredClone({ ...b, fields: b.fields.map(gateField) }))
  return {
    schema: 1,
    features: on,
    allFeatures: [...ALL_FEATURES],
    groups: GROUPS.filter((g) => blocks.some((b) => b.group === g.id)).map((g) => structuredClone(g)),
    conditions: blocks.filter((b) => b.kind === 'condition'),
    effects: blocks.filter((b) => b.kind === 'effect'),
    settings: blocks.filter((b) => b.kind === 'setting'),
    lookups: [...LOOKUP_KINDS],
  }
}

/** The catalogue with every feature on: what the builder reads blocks through. */
export const CATALOGUE = catalogueFor(ALL_FEATURES)

// ── 523: the stubbed lookups (POST Rules/Authoring/Lookups/{lookup} { q, campaign? }, BackOffice 2758)
// in the real `RuleLookupItem` shape: `name { en, ar }` (categories, collections and stores in English
// only), `detail`, a collection's `articles`, a value map's `entries`, A006's `neverDiscount`. The
// prototype's categories, collections and catalog (its engine.js CATS / CATALOG, data.js collections). A
// search matches a code or a name, ignoring case, and answers at most 50 hits; a material search
// shorter than three characters and an unknown lookup are refused `RULES_BAD_LOOKUP`. ──

const hit = (code, en, ar = '', o = {}) => ({ code, name: LT(en, ar), detail: o.detail ?? null, articles: o.articles ?? null, entries: o.entries ?? null, neverDiscount: !!o.neverDiscount })

export const LOOKUPS = {
  categories: [
    hit('A001', 'Medicines (OTC)'), hit('A002', 'Beauty Care'), hit('A003', 'Baby & Mother'), hit('A005', 'Personal Care'),
    hit('A006', 'Prescription (Rx)', '', { neverDiscount: true }), hit('A007', 'Services & fees'), hit('A008', 'Infant formula'),
  ],
  // A collection answers its articles: a pick writes them into the filter (2758).
  collections: [
    hit('SUNCARE', 'Suncare', '', { articles: ['SUN-50', 'SUN-30', 'SUN-KID'] }),
    hit('DIAPERS', 'Diapers', '', { articles: ['DIA-4'] }),
    hit('WIPES', 'Baby wipes', '', { articles: ['WIP-80'] }),
  ],
  materials: [
    hit('SUN-50', 'Sunblock SPF50 50ml', 'واقي شمس 50', { detail: 'A002' }), hit('SUN-30', 'Sun lotion SPF30 200ml', '', { detail: 'A002' }),
    hit('SUN-KID', 'Kids sun spray SPF50', '', { detail: 'A002' }), hit('SER-VC', 'Vitamin C serum 30ml', '', { detail: 'A002' }),
    hit('DIA-4', 'Diapers size 4, 52 pcs', '', { detail: 'A003' }), hit('WIP-80', 'Baby wipes, 80 pcs', '', { detail: 'A003' }),
    hit('PAN-24', 'Paracetamol 500mg, 24 tabs', '', { detail: 'A001' }), hit('AMOX-500', 'Amoxicillin 500mg (Rx)', '', { detail: 'A006' }),
    hit('SHA-400', 'Shampoo 400ml', '', { detail: 'A005' }), hit('SHA-DAN', 'Anti-dandruff shampoo 400ml', '', { detail: 'A005' }),
    hit('SHA-ARG', 'Argan oil shampoo 250ml', '', { detail: 'A005' }), hit('BAL-400', 'Balsam (conditioner) 400ml', '', { detail: 'A005' }),
    hit('BAL-ARG', 'Argan oil balsam 250ml', '', { detail: 'A005' }), hit('MIL-1', 'Infant formula stage 1', '', { detail: 'A008' }),
    hit('GIFT-BAG', 'Travel pouch', '', { detail: 'A002' }), hit('FEE-DLV', 'Delivery fee', '', { detail: 'A007' }),
  ],
  // 509: the stores Settings ▸ Audience searches; `detail` is the engine HQ holds each on.
  stores: [
    hit('R101', 'Riyadh, Olaya', '', { detail: 'Rule' }), hit('J204', 'Jeddah, Tahlia', '', { detail: 'BonusBuy' }),
    hit('D310', 'Dammam, Corniche', '', { detail: 'BonusBuy' }), hit('M01', 'Manama, Seef', '', { detail: 'BonusBuy' }),
  ],
  audiences: [hit('VIP', 'VIP')],
  valueMaps: [hit('PCUT-SA01', 'Price cut (SA)', 'تخفيض السعر', { detail: 'targetPrice SAR', entries: 3 })],
  budgets: [],
}

const BAD_LOOKUP = (message) => ({ refused: 'RULES_BAD_LOOKUP', status: 400, message })

/** What the stubbed lookup door answers for `kind` and `q`: `{ hits }`, or a refusal. */
export function lookup(kind, q = '') {
  if (!LOOKUP_KINDS.includes(kind)) return BAD_LOOKUP(`There is no lookup '${kind}'.`)
  const s = (q ?? '').trim().toLowerCase()
  if (kind === 'materials' && s.length < 3) return BAD_LOOKUP('A material search needs at least 3 characters.')
  const hits = (LOOKUPS[kind] ?? []).filter((x) => !s || x.code.toLowerCase().includes(s) || x.name.en.toLowerCase().includes(s) || (x.name.ar && x.name.ar.includes(q.trim())))
  return { hits: hits.slice(0, 50) }
}

// ── 523: Validate (POST Rules/Authoring/Validate { campaign, tree? }) — the stub checks nothing of its
// own: it answers the campaign as sound, with its offline verdict (`validationOf`). A drive that needs
// issues answers them itself. ──

// ── 523: the value map's CSV (POST Rules/Authoring/ValueMaps/Upload { campaign, csv }): `material,number`
// per line, an optional header naming material | article | sku. A line that is not a material and a
// number is an error pointed at its line (`block: file`, `where: "line 3"`); a material listed twice
// is a warning. Nothing is stored: the answer's campaign has the map's entries replaced. ──

const fileIssue = (severity, line, message) => ({ severity, rule: null, ruleId: null, block: 'file', index: null, field: null, where: `line ${line}`, message, path: '' })

export function uploadValueMap(campaign, csv) {
  const errors = []
  const warnings = []
  const entries = []
  const seen = new Set()
  const lines = String(csv ?? '').split(/\r?\n/)
  lines.forEach((text, i) => {
    const line = i + 1
    if (!text.trim()) return
    const cells = text.split(',').map((x) => x.trim())
    if (i === 0 && /^(material|article|sku)$/i.test(cells[0])) return
    const n = Number(cells[1])
    if (cells.length !== 2 || !cells[0] || cells[1] === '' || !Number.isFinite(n)) return errors.push(fileIssue('error', line, 'A line is a material and a number.'))
    if (seen.has(cells[0])) warnings.push(fileIssue('warning', line, `${cells[0]} is listed twice: the last line counts.`))
    seen.add(cells[0])
    entries.push([cells[0], n])
  })
  if (!entries.length && !errors.length) errors.push(fileIssue('error', 1, 'The file has no entries.'))
  if (errors.length) return { accepted: false, entries: 0, campaign: null, errors, warnings }
  const last = new Map(entries)
  const map = campaign.valueMap ?? { means: 'targetPrice', unit: 'EA', entries: [] }
  return { accepted: true, entries: last.size, campaign: { ...campaign, valueMap: { ...map, entries: [...last] } }, errors: [], warnings }
}

// ── 523: budgets (POST Rules/Authoring/Budgets { campaign } and Budgets/SetLimit { campaign, budget,
// limit }, BackOffice 2758 over 2744). The NEWEST VERSION's budgets — a published campaign's — with
// the limit in force (a live limit set here, else the declared one) and this period's used / held /
// overshoot summed over every scope key: WKND20's campaign money has SAR 12,345.50 used and SAR 250
// held of SAR 50,000.00; GP-BEAUTY15's member budget has one member at 3 uses of 2 (overshoot 1, ADR
// 0091); every other budget, nothing. ──

const COUNTED = { WKND20: { used: 12345.5, held: 250, counters: 1 }, 'GP-BEAUTY15': { used: 3, held: 0, counters: 1 } }
const PERIOD_KEY = { lifetime: 'lifetime', day: '2026-10-15', week: '2026-W42', month: '2026-10' }

/** What `Budgets { campaign }` answers for a campaign of `store`; `limits` holds the live limits set (`campaign|budget` → limit). */
export function budgetsOf(store, code, limits = new Map()) {
  const d = store.find((x) => x.code === code)
  if (!d || d.campaignStatus !== 'Published') return []
  return (d.campaign.budgets ?? []).map((b, i) => {
    const limitValue = limits.get(`${code}|${b.id}`) ?? b.value
    const c = i === 0 ? COUNTED[code] : undefined
    const used = c?.used ?? 0
    return {
      campaign: code, budget: b.id, name: b.name, scope: b.scope, limit: b.limit, period: b.period,
      declared: b.value, limitValue, periodKey: PERIOD_KEY[b.period] ?? 'lifetime',
      used, held: c?.held ?? 0, overshoot: Math.max(0, Math.round((used - limitValue) * 1000) / 1000), counters: c?.counters ?? 0,
    }
  })
}

/** `Budgets/SetLimit { campaign, budget, limit }`: `{ set }`, or a refusal. */
export function setLimit(store, limits, body) {
  if (body?.limit == null) return { refused: 'RULES_BAD_REQUEST', status: 400, message: 'Send { campaign, budget, limit }: the new limit is required.' }
  if (!(body.limit >= 0)) return { refused: 'RULES_BAD_REQUEST', status: 400, message: `A budget limit is zero or more, not ${body.limit}.` }
  const view = budgetsOf(store, body.campaign, limits).find((v) => v.budget === body.budget)
  if (!view) return { refused: 'RULES_BUDGET_NOT_FOUND', status: 404, message: `The newest version of ${body.campaign} declares no budget ${body.budget}.` }
  limits.set(`${body.campaign}|${body.budget}`, body.limit)
  const countersAbove = view.used > body.limit ? view.counters : 0
  return { set: { campaignId: body.campaign, budgetId: body.budget, limitValue: body.limit, previousLimit: view.limitValue, countersAbove } }
}

// ── 512: the version history (PROVISIONAL doors until 524's Versions/*). Every published campaign has
// its live version, its rules as they are now; GIFT-POUCH has two before it (its live version is 3). ──

/** GIFT-POUCH's versions 1 and 2, worked back from its live rules. */
const EARLIER = (() => {
  const pouch = CAMPAIGNS.find((c) => c.code === 'GIFT-POUCH').campaign
  const at = (rules, f) => rules.map((r) => ({ ...r, then: r.then.map((e) => ({ ...e, ...f })) }))
  // Version 1 had no cashier prompt (schema 1 leaves an unset `prompt` out).
  const v1 = at(structuredClone(pouch.rules), { label: says('Gift pouch', 'حقيبة هدية') }).map((r) => ({ ...r, then: r.then.map(({ prompt, ...e }) => e) }))
  const v2 = at(structuredClone(pouch.rules), { label: says('Gift pouch', 'حقيبة هدية') })
  return {
    'GIFT-POUCH': [
      { version: 1, at: moment('2026-10-03 10:00'), by: 'Omar (marketing)', note: 'First version: the pouch is free with the serum.', rules: v1 },
      { version: 2, at: moment('2026-10-06 12:30'), by: 'Reem (approver)', note: 'The cashier is prompted to scan the pouch.', rules: v2 },
    ],
  }
})()
/** The live version's note, where one was written. */
const LIVE_NOTE = { 'GIFT-POUCH': 'The receipt says "Free pouch".' }

/** Each campaign's versions with their rules, by code — a context's own copy. */
export function versionsOf(store) {
  const out = new Map()
  for (const d of store) {
    if (!d.publishedVersionNo || !d.campaignStatus) continue
    out.set(d.code, [
      ...structuredClone(EARLIER[d.code] ?? []),
      { version: d.publishedVersionNo, at: d.updatedAt, by: d.updatedBy, note: LIVE_NOTE[d.code] ?? '', rules: structuredClone(d.campaign.rules) },
    ])
  }
  return out
}

/** A version as the list reads it: without its rules. */
export const versionRow = ({ rules, ...row }) => row

/** An activation publishes a version: the draft's rules as they were activated. */
export function publishVersion(versions, d, note = '') {
  versions.set(d.code, [...(versions.get(d.code) ?? []), { version: d.publishedVersionNo, at: d.reviewedAt, by: d.reviewedBy, note, rules: structuredClone(d.campaign.rules) }])
}

/** POST …/Versions/{n}/Restore: the version is the campaign's NEW draft (`origin: restore:N`); the
 *  live version is untouched. Or `{ refused, message }` — a pending draft is frozen. */
export function restoreVersion(d, versions, n) {
  const v = (versions.get(d.code) ?? []).find((x) => x.version === n)
  if (!v) return { refused: 'RULES_VERSION_NOT_FOUND', message: 'No such version.' }
  if (d.state === 'pending') return { refused: 'RULES_DRAFT_PENDING', message: 'A request waits for approval. Send it back first.' }
  remember(d)
  Object.assign(d, {
    source: 'draft', state: 'editing', revision: d.revision + 1, origin: `restore:${n}`,
    campaign: { ...d.campaign, rules: structuredClone(v.rules) },
    requestedBy: '', requestedAt: NEVER, requestNote: '', reviewedBy: '', reviewedAt: NEVER, reviewNote: '',
  })
  d.validation = validationOf(d.campaign)
  return { campaign: d }
}

// ── 515: campaign coupons ──
//   GET  RuleCampaign/Campaigns/{id}/Coupons          → the campaign's codes (`COUPONS`, by id)
//   POST RuleCampaign/Campaigns/{id}/Coupons/Batches  → one batch minted (`createBatch`)
// A code carries no redemption limit (ADR 0094): `uses` is a count. HQ answers `expired` itself.
const coupon = (c, status, batch, o = {}) => ({ code: c, status, kind: 'random', uses: status === 'used' ? 1 : 0, member: null, batch, created: '2026-09-28T11:30:00', from: null, until: null, ...o })

export const COUPONS = {
  WKND20: [
    // The prototype's three, then one of each other status and a universal flyer code.
    coupon('WKND-4F7K2Q', 'unused', 'k3m9q2xa'),
    coupon('WKND-9XH3PL', 'used', 'k3m9q2xa'),
    coupon('WKND-T2M8VA', 'unused', 'k3m9q2xa'),
    coupon('WKND-P5R8ZD', 'disabled', 'k3m9q2xa'),
    coupon('WKND-B3N6QW', 'expired', 'k3m9q2xa', { until: '2026-10-10' }),
    coupon('WKND-FLYER', 'used', 'u7d2w4pe', { kind: 'universal', uses: 12, created: '2026-10-01T09:00:00', from: '2026-10-01', until: '2026-10-31' }),
  ],
}

const ALPHABET = { lettersAndDigits: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', letters: 'ABCDEFGHJKLMNPQRSTUVWXYZ', digits: '0123456789' }
let batchSeq = 0
let rand = 515
/** A deterministic draw, so a run's codes are the same each time. */
const next = (n) => ((rand = (rand * 1103515245 + 12345) % 2147483648), (rand >>> 16) % n)

/**
 * HQ mints one batch: its codes and its batch id. A universal code the campaign already has, or a
 * campaign without the coupons feature, is refused.
 */
export function createBatch(c, list, body, at) {
  if (!c.features.includes('coupons')) return { refused: 'RULE_COUPONS_OFF', message: 'Coupons are off for this campaign. / القسائم غير مفعلة لهذه الحملة.' }
  const batch = `nb${String(++batchSeq).padStart(6, '0')}`
  const created = at.replace(' ', 'T') + ':00'
  const taken = new Set(list.map((k) => k.code))
  const mint = () => {
    // A stub HQ: a shape it has run out of would loop here; the drive never asks that much.
    for (let tries = 0; tries < 100000; tries++) {
      const abc = ALPHABET[body.charset]
      let s = ''
      for (let i = 0; i < body.length; i++) s += abc[next(abc.length)]
      const k = [body.prefix, s, body.suffix].filter(Boolean).join('-')
      if (!taken.has(k)) return taken.add(k), k
    }
    throw new Error('the stub ran out of codes for this shape')
  }
  const one = (k, kind, member = null) => ({ code: k, status: 'unused', kind, uses: 0, member, batch, created, from: body.from, until: body.until })
  let out
  if (body.kind === 'universal') {
    if (taken.has(body.code)) return { refused: 'RULE_COUPON_CODE_TAKEN', message: 'This code is already in use. / هذا الرمز مستخدم.' }
    out = [one(body.code, 'universal')]
  } else if (body.kind === 'random') out = Array.from({ length: body.count }, () => one(mint(), 'random'))
  else out = body.members.map((m) => one(mint(), 'personal', m))
  list.unshift(...out)
  return { batch: { batch, count: out.length } }
}

// ── 516: coupon CSV import and delete unused ──
//   POST   RuleCampaign/Campaigns/{id}/Coupons/Imports/Check     → `checkImport`
//   POST   RuleCampaign/Campaigns/{id}/Coupons/Imports           → `importBatch`
//   DELETE RuleCampaign/Campaigns/{id}/Coupons/Batches/{b}/Unused → `deleteUnused`
/** The member ids the stub HQ knows. */
export const MEMBERS = ['M-100231', 'M-055410', 'M-200118']
/** Codes SIS.Coupons holds under OTHER campaigns: the campaign's own list does not show them. */
export const CODES_ELSEWHERE = ['HAYAK15']

/** HQ's check of an import's rows: codes SIS.Coupons holds, and member ids it does not know. */
export function checkImport(list, rows) {
  const held = new Set([...list.map((k) => k.code), ...CODES_ELSEWHERE])
  return {
    inUse: rows.filter((r) => held.has(r.code)).map((r) => r.code),
    unknownMembers: [...new Set(rows.filter((r) => r.member && !MEMBERS.includes(r.member)).map((r) => r.member))],
  }
}

/** HQ imports the rows as one batch of `imported` codes; a row it would reject refuses the whole import. */
export function importBatch(c, list, rows, at) {
  if (!c.features.includes('coupons')) return { refused: 'RULE_COUPONS_OFF', message: 'Coupons are off for this campaign. / القسائم غير مفعلة لهذه الحملة.' }
  const check = checkImport(list, rows)
  if (check.inUse.length || check.unknownMembers.length) return { refused: 'RULE_COUPON_IMPORT_STALE', message: 'A row was taken since the check; check the rows again. / تغيّر أحد الصفوف منذ التحقق.' }
  const batch = `im${String(++batchSeq).padStart(6, '0')}`
  const created = at.replace(' ', 'T') + ':00'
  const out = rows.map((r) => ({ code: r.code, status: 'unused', kind: 'imported', uses: 0, member: r.member, batch, created, from: null, until: null }))
  list.unshift(...out)
  return { batch: { batch, count: out.length } }
}

/** HQ deletes a batch's unused codes; every other code of the batch stays. */
export function deleteUnused(list, batch) {
  const before = list.length
  const kept = list.filter((k) => k.batch === batch && k.status !== 'unused').length
  const keep = list.filter((k) => !(k.batch === batch && k.status === 'unused'))
  list.splice(0, list.length, ...keep)
  return { deleted: before - keep.length, kept }
}
