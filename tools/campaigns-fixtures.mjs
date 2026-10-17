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
    features: ['points'],
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
  }, { published: ['2026-07-28 14:40', 'Omar (marketing)'] }),
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
  }, { published: ['2026-08-30 12:00', 'Reem (approver)'], campaignStatus: 'Disabled', publishedVersionNo: 2 }),
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

// ── 504: the stubbed block catalogue (GET RuleCampaign/Catalogue; PROVISIONAL until ticket 523 reads
// the real `Rules/Authoring/Catalogue`). The invented `RuleBlockCatalogue` structure, re-cut in 522 to
// the REAL block types and field names (BackOffice `RuleBlockCatalogue.cs`): conditions keyed by
// `check`, effects by `effect`, a condition's filter in `of`, an effect's in `filter`. `feature`
// gates the palette: coupons adds the coupon condition and the coupon effect, points the points
// blocks. The vitest proof (`src/core/rules/sentence.test.ts`) reads this same catalogue and these
// same campaigns. ──

const field = (key, kind, o = {}) => ({ key, kind, ...o })
const notMet = field('says', 'says', { role: 'notMet' })
const receiptLabel = field('label', 'says', { role: 'receiptLabel' })
const cond = (type, group, fields, o = {}) => ({ type, kind: 'condition', group, feature: null, decided: true, fields: [...fields, notMet], ...o })
const eff = (type, group, fields, o = {}) => ({ type, kind: 'effect', group, feature: null, decided: true, fields, ...o })
const discountScope = field('scope', 'choice', { options: ['items', 'fees', 'itemsAndFees'], clause: true, default: 'items' })

export const CATALOGUE = {
  groups: [
    { key: 'cart', kind: 'condition' },
    { key: 'customer', kind: 'condition' },
    { key: 'context', kind: 'condition' },
    { key: 'limits', kind: 'condition' },
    { key: 'couponConditions', kind: 'condition' },
    { key: 'advanced', kind: 'condition' },
    { key: 'discounts', kind: 'effect' },
    { key: 'freeGoods', kind: 'effect' },
    { key: 'bundles', kind: 'effect' },
    { key: 'points', kind: 'effect' },
    { key: 'couponEffects', kind: 'effect' },
    { key: 'messages', kind: 'effect' },
  ],
  blocks: [
    cond('minSubtotal', 'cart', [field('of', 'items'), field('amount', 'money'), field('basis', 'choice', { options: ['subtotal', 'total'], default: 'subtotal' })], { variant: 'basis' }),
    cond('minCount', 'cart', [field('count', 'count', { plural: true }), field('of', 'items')]),
    cond('minPoints', 'customer', [field('points', 'count')], { feature: 'points' }),
    cond('tier', 'customer', [field('in', 'choices', { options: ['S', 'G', 'P'] })]),
    cond('member', 'customer', [field('earning', 'flag', { default: false })], { variant: 'earning' }),
    cond('firstPurchase', 'customer', []),
    cond('audience', 'customer', [field('in', 'codes')], { decided: false }),
    cond('channel', 'context', [field('in', 'codes')]),
    cond('store', 'context', [field('in', 'codes')]),
    cond('budgetLeft', 'limits', [field('budget', 'budget')]),
    cond('coupon', 'couponConditions', [field('code', 'code')], { feature: 'coupons' }),
    cond('sessionFlag', 'advanced', [field('flag', 'code')]),
    cond('formula', 'advanced', [field('expr', 'formula')]),
    { type: 'group', kind: 'condition', group: 'advanced', feature: null, decided: true, fields: [field('mode', 'choice', { options: ['all', 'any'] })] },

    eff('discountItems', 'discounts', [field('kind', 'choice', { options: ['percent'], default: 'percent' }), field('value', 'discount', { unitFrom: 'kind' }), field('filter', 'items'), discountScope, receiptLabel], { variant: 'kind' }),
    eff('discountSession', 'discounts', [field('kind', 'choice', { options: ['amount', 'percent'] }), field('value', 'discount', { unitFrom: 'kind' }), field('filter', 'items'), discountScope, receiptLabel], { variant: 'kind' }),
    eff('discountPerItem', 'discounts', [field('from', 'choice', { options: ['valueMap'], default: 'valueMap' }), field('filter', 'items'), receiptLabel]),
    eff('freeUnits', 'freeGoods', [field('buy', 'count'), field('filter', 'items'), field('free', 'count', { plural: true }), receiptLabel]),
    eff('freeProduct', 'freeGoods', [field('count', 'count', { plural: true }), field('filter', 'items'), field('prompt', 'says', { role: 'cashierPrompt' }), receiptLabel]),
    eff('bundlePrice', 'bundles', [field('value', 'money'), receiptLabel]),
    eff('bundleDiscount', 'bundles', [field('value', 'money'), receiptLabel]),
    eff('discountCheapestInBundle', 'bundles', [receiptLabel]),
    eff('awardPoints', 'points', [field('amount', 'points', { unitFrom: 'unit' }), field('unit', 'choice', { options: ['SAR', 'PTS'] }), field('activity', 'code'), field('activates', 'timing', { clause: true }), field('expires', 'timing', { clause: true }), field('tierPoints', 'flag', { clause: true })], { feature: 'points' }),
    eff('burnPoints', 'points', [field('amount', 'points', { unitFrom: 'unit' }), field('unit', 'choice', { options: ['PTS'], default: 'PTS' }), field('tender', 'flag', { clause: true })], { feature: 'points' }),
    eff('createCoupon', 'couponEffects', [field('template', 'code'), field('validDays', 'days'), receiptLabel], { feature: 'coupons' }),
    eff('cashierMessage', 'messages', [field('text', 'says', { role: 'message' })]),
  ],
  formula: {
    // 507: what the guided ƒx helper offers — the prototype's helpers.js (ATTRS, FUNC_DOCS, OPS,
    // recipesFor) re-cut in 522 to the real paths the SIS.Rules checker knows and the text the codec
    // (`src/core/rules/expr.ts`) reads. `{filter}` in a recipe is the name of the rule's filter the
    // marketer picks; `{current}` the box's own formula.
    fields: [
      { path: 'session.subtotal', type: 'money', group: 'sale' },
      { path: 'session.total', type: 'money', group: 'sale' },
      { path: 'session.fees', type: 'money', group: 'sale' },
      { path: 'session.decimals', type: 'number', group: 'sale' },
      { path: 'session.channel', type: 'text', group: 'sale' },
      { path: 'session.store', type: 'text', group: 'sale' },
      { path: 'session.currency', type: 'text', group: 'sale' },
      { path: 'session.requestedPoints', type: 'number', group: 'sale' },
      { path: 'profile.loyaltyId', type: 'text', group: 'profile' },
      { path: 'profile.tier', type: 'text', group: 'profile' },
      { path: 'profile.points', type: 'number', group: 'profile' },
      { path: 'profile.tentativePoints', type: 'number', group: 'profile' },
      { path: 'item.net', type: 'money', group: 'item' },
      { path: 'item.lineNet', type: 'money', group: 'item' },
      { path: 'item.article', type: 'text', group: 'item' },
      { path: 'item.category', type: 'text', group: 'item' },
      { path: 'item.quantity', type: 'number', group: 'item' },
    ],
    functions: [
      { name: 'items', signature: "items('filter')", example: "items('Eligible')", snippet: "items('')", caret: 7 },
      { name: 'sum', signature: "sum(items('filter'), item.net)", example: "sum(items('Eligible'), item.net)", snippet: 'sum(, item.net)', caret: 4 },
      { name: 'count', signature: "count(items('filter'))", example: "count(items('Suncare')) >= 3", snippet: 'count()', caret: 6 },
      { name: 'round', signature: 'round(x, decimals, mode)', example: 'round(eligible * 0.1, 0, halfUp)', snippet: 'round(, 0, halfUp)', caret: 6 },
      { name: 'band', signature: 'band(x, from:rate, ...)', example: 'band(basis, 200:0.1, 400:0.12)', snippet: 'band(, 200:0.1, 400:0.12)', caret: 5 },
      { name: 'min', signature: 'min(a, b, ...)', example: 'min(back, 105)', snippet: 'min(, 100)', caret: 4 },
      { name: 'max', signature: 'max(a, b, ...)', example: 'max(back, 5)', snippet: 'max(, 5)', caret: 4 },
      { name: 'floor', signature: 'floor(x)', example: 'floor(basis / 10)', snippet: 'floor()', caret: 6 },
      { name: 'ceil', signature: 'ceil(x)', example: "ceil(count(items('Eligible')) / 2)", snippet: 'ceil()', caret: 5 },
      { name: 'if', signature: 'if(test, then, else)', example: "if(profile.tier == 'P', 0.15, 0.1)", snippet: 'if(, , )', caret: 3 },
    ],
    operators: ['+', '-', '*', '/', '(', ')', '>=', '>', '<=', '<', '==', '!=', 'and', 'or', 'not'],
    recipes: [
      { key: 'percentOfSpend', expect: 'number', formula: "round(sum(items('{filter}'), item.net) * 0.1, 0, halfUp)" },
      { key: 'tieredRate', expect: 'number', formula: "band(sum(items('{filter}'), item.net), 200:0.1, 400:0.12, 700:0.15)" },
      { key: 'capped', expect: 'number', formula: 'min({current}, 100)' },
      { key: 'pointsPerSar', expect: 'number', formula: "floor(sum(items('{filter}'), item.net) / 10)" },
      { key: 'topTiers', expect: 'number', formula: "if(profile.tier == 'P', 0.15, 0.1)" },
      { key: 'basketBigEnough', expect: 'bool', formula: 'session.total >= 150' },
      { key: 'enoughUnits', expect: 'bool', formula: "count(items('{filter}')) >= 3" },
      { key: 'goldOrPlatinum', expect: 'bool', formula: "profile.tier == 'G' or profile.tier == 'P'" },
      { key: 'enoughPoints', expect: 'bool', formula: 'profile.tentativePoints >= 30' },
      { key: 'tillOnly', expect: 'bool', formula: "session.channel == 'POS'" },
    ],
  },
}

// ── 506: the stubbed lookups (GET RuleCampaign/Lookups/{Categories|Collections|Materials}?search=,
// BackOffice 2758) that "Certain items…" searches: the prototype's categories, collections and
// catalog (its engine.js CATS / CATALOG, data.js collections), in the PROVISIONAL `RuleLookupItem`
// shape. A search matches a code or a name, ignoring case, and answers at most 20 hits. ──

export const LOOKUPS = {
  categories: [
    { code: 'A001', name: 'Medicines (OTC)' }, { code: 'A002', name: 'Beauty Care' }, { code: 'A003', name: 'Baby & Mother' },
    { code: 'A005', name: 'Personal Care' }, { code: 'A006', name: 'Prescription (Rx)' }, { code: 'A007', name: 'Services & fees' },
    { code: 'A008', name: 'Infant formula' },
  ],
  // A collection answers its articles: a pick writes them into the filter (2758).
  collections: [
    { code: 'SUNCARE', name: 'Suncare', articles: ['SUN-50', 'SUN-30', 'SUN-KID'] },
    { code: 'DIAPERS', name: 'Diapers', articles: ['DIA-4'] },
    { code: 'WIPES', name: 'Baby wipes', articles: ['WIP-80'] },
  ],
  materials: [
    { code: 'SUN-50', name: 'Sunblock SPF50 50ml' }, { code: 'SUN-30', name: 'Sun lotion SPF30 200ml' }, { code: 'SUN-KID', name: 'Kids sun spray SPF50' },
    { code: 'SER-VC', name: 'Vitamin C serum 30ml' }, { code: 'DIA-4', name: 'Diapers size 4, 52 pcs' }, { code: 'WIP-80', name: 'Baby wipes, 80 pcs' },
    { code: 'PAN-24', name: 'Paracetamol 500mg, 24 tabs' }, { code: 'AMOX-500', name: 'Amoxicillin 500mg (Rx)' }, { code: 'SHA-400', name: 'Shampoo 400ml' },
    { code: 'SHA-DAN', name: 'Anti-dandruff shampoo 400ml' }, { code: 'SHA-ARG', name: 'Argan oil shampoo 250ml' }, { code: 'BAL-400', name: 'Balsam (conditioner) 400ml' },
    { code: 'BAL-ARG', name: 'Argan oil balsam 250ml' }, { code: 'MIL-1', name: 'Infant formula stage 1' }, { code: 'GIFT-BAG', name: 'Travel pouch' },
    { code: 'FEE-DLV', name: 'Delivery fee' },
  ],
  // 509: what Settings ▸ Audience picks from (the prototype's COUNTRIES, CHANNELS and STORES).
  countries: [{ code: 'SA', name: 'Saudi Arabia' }, { code: 'BH', name: 'Bahrain' }],
  channels: [
    { code: 'POS', name: 'Store till (NewPos)' }, { code: 'CC', name: 'Call center / OMS' }, { code: 'SD', name: 'AddSdDocument' },
    { code: 'CMRC', name: 'Hybris web (later phase)' },
  ],
  stores: [
    { code: 'R101', name: 'Riyadh, Olaya' }, { code: 'J204', name: 'Jeddah, Tahlia' }, { code: 'D310', name: 'Dammam, Corniche' },
    { code: 'M01', name: 'Manama, Seef' },
  ],
}

/** What the stubbed lookup door answers for `kind` (`categories` | `collections` | `materials` |
 *  `countries` | `channels` | `stores`) and `search`. */
export function lookup(kind, search = '') {
  const q = search.trim().toLowerCase()
  return (LOOKUPS[kind] ?? []).filter((x) => !q || x.code.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)).slice(0, 20)
}

/**
 * GET RuleCampaign/Campaigns/{id}/BudgetUsage (510, BackOffice 2744; PROVISIONAL until 523) — a live
 * campaign's counters, one per budget: WKND20 has used SAR 12,345.50 of its SAR 50,000.00;
 * GP-BEAUTY15's busiest member has used 3 of 2 (an overshoot, ADR 0091); every other budget, nothing.
 */
const USED = { WKND20: 12345.5, 'GP-BEAUTY15': 3 }
export function budgetUsage(d) {
  return (d.campaign.budgets ?? []).map((b, i) => ({ budgetId: b.id, used: i === 0 ? (USED[d.code] ?? 0) : 0 }))
}

/**
 * PUT RuleCampaign/Campaigns/{id}/Budgets/{budgetId}/Limit (510, BackOffice 2744; PROVISIONAL until
 * 523) — a live budget's new limit, at once and with no publish; or `{ refused, message }`.
 */
export function changeLimit(d, budgetId, value) {
  if (d.campaignStatus !== 'Published') return { refused: 'RULES_NOT_LIVE', message: 'Only a live campaign’s limit changes on its own.' }
  const b = (d.campaign.budgets ?? []).find((x) => x.id === budgetId)
  if (!b) return { refused: 'RULES_BUDGET_NOT_FOUND', message: 'No such budget.' }
  if (!(value > 0)) return { refused: 'RULES_BAD_REQUEST', message: 'A budget limit must be above zero.' }
  b.value = value
  return { campaign: d }
}

// ── 512: the version history (PROVISIONAL doors until 524's Versions/*). Every published campaign has
// its live version, its rules as they are now; GIFT-POUCH has two before it (its live version is 3). ──

/** GIFT-POUCH's versions 1 and 2, worked back from its live rules. */
const EARLIER = (() => {
  const pouch = CAMPAIGNS.find((c) => c.code === 'GIFT-POUCH').campaign
  const at = (rules, f) => rules.map((r) => ({ ...r, then: r.then.map((e) => ({ ...e, ...f })) }))
  const v1 = at(structuredClone(pouch.rules), { label: says('Gift pouch', 'حقيبة هدية') })
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
