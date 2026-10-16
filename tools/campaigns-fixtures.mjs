// Stub fixtures for the rule-campaign drives (spec 2737; ticket 501 creates them, the workspace
// slices 502–512, 515 and 516 extend them). They are the owner-approved prototype's sample campaigns
// (BackOffice `.scratch/proto/2734-rule-builder/data.js`) in the PROVISIONAL wire shape of
// `src/core/models/rule-campaign.ts` — no HQ contract exists yet (BackOffice 2758/2759); ticket 520
// re-points the shapes and these fixtures with them.
//
// Every date is LOCAL: a day `yyyy-MM-dd`, a moment `yyyy-MM-ddTHH:mm:ss`, never a `Z`.
// Three campaigns are NOT the prototype's — NATDAY-15 (scheduled), SPRING-DRAFT (a draft) and
// SUMMER-FLASH (disabled) — added so every state tile has a campaign under it.

const says = (en, ar = '') => ({ en, ar })
const stamp = (at, by) => ({ at: at.replace(' ', 'T') + ':00', by })

let seq = 0
const id = (p) => `${p}${++seq}`

const F = (name, o = {}) => ({ id: id('f'), name, cats: [], colls: [], skus: [], exclCats: [], scope: 'items', ...o })
const V = (name, formula) => ({ id: id('v'), name, formula })
const K = (type, o, s = says('')) => ({ id: id('c'), type, says: s, ...o })
const X = (type, o = {}) => ({ id: id('e'), type, ...o })
const R = (name, o = {}) => ({ id: id('r'), name, filters: [], values: [], when: { mode: 'all', items: [] }, then: [], partial: 'refuse', ...o })
const B = (name, scope, limit, value, period) => ({ id: id('b'), name, scope, limit, value, period })
const schedule = (from, until, days = []) => ({ from, until, days, hoursFrom: null, hoursTo: null })

const EXCL_RX = ['A006']

/** A campaign in the provisional wire shape. `live` / `created` take `'yyyy-MM-dd HH:mm'`. */
function campaign(o) {
  const { published, created, ...rest } = o
  return {
    description: '',
    tags: [],
    status: published ? 'live' : 'draft',
    schedule: schedule('2026-10-16', '2026-12-31'),
    audience: { countries: ['SA'], channels: [], stores: [], members: 'any' },
    budgets: [],
    features: { coupons: false, points: true },
    offlineOptOut: false,
    rules: [],
    created: created ? stamp(created[0], created[1]) : published ? stamp(published[0], published[1]) : null,
    live: published ? { version: 1, ...stamp(published[0], published[1]) } : null,
    approval: null,
    ...rest,
  }
}

export const CAMPAIGNS = [
  campaign({
    id: 'PCUT-SA01', code: 'PCUT-SA01', name: says('SAP promotional price cuts, sales org SA01', 'تخفيضات أسعار SAP، منظمة المبيعات SA01'),
    description: 'Promotional VKA0 price cuts move to the rule engine at a rule store (ADR 0090). One value-map campaign per sales org (ADR 0095).',
    tags: ['price cut'], schedule: schedule('2026-10-01', '2026-12-31'), published: ['2026-10-01 09:12', 'Reem (pricing)'],
    rules: [R('Price from the SA01 map', { then: [X('valueMap', { map: 'PCUT-SA01', label: says('Price cut', 'تخفيض السعر') })] })],
  }),
  (() => {
    const sun = F('sun', { colls: ['SUNCARE'] })
    return campaign({
      id: 'SUN-3FOR2', code: 'SUN-3FOR2', name: says('Suncare: any three, cheapest free, on a basket of SAR 150', 'العناية بالشمس: أي ثلاثة والأرخص مجاناً لسلة 150 ريال'),
      description: 'The first 2702 campaign. Anonymous, no budget: the only offline-safe one of the five.', tags: ['suncare', 'seasonal'],
      schedule: schedule('2026-08-01', '2026-11-01'), published: ['2026-07-28 14:40', 'Omar (marketing)'],
      rules: [R('Cheapest of every three suncare units free', {
        filters: [sun],
        when: { mode: 'all', items: [
          K('minCount', { count: 3, of: sun.id }, says('three suncare items', 'ثلاثة منتجات للعناية بالشمس')),
          K('minSubtotal', { amount: 150, basis: 'subtotal', of: '' }, says('a basket of SAR 150', 'سلة بقيمة 150 ريال')),
        ] },
        then: [X('freeUnits', { on: sun.id, buy: 3, free: 1, which: 'cheapest', label: says('Suncare 3 for 2', 'العناية بالشمس 3 بسعر 2') })],
      })],
    })
  })(),
  (() => {
    const diapers = F('diapers', { colls: ['DIAPERS'] })
    const wipes = F('wipes', { colls: ['WIPES'] })
    return campaign({
      id: 'BABY-BUNDLE', code: 'BABY-BUNDLE', name: says('Diapers + two packs of wipes for SAR 85', 'حفاضات مع عبوتي مناديل بـ 85 ريال'),
      description: 'A 2718 bundle: item lists with counts, greedy highest-net first, at most two per sale.', tags: ['baby'],
      published: ['2026-10-02 10:05', 'Omar (marketing)'],
      rules: [R('Bundle price', {
        filters: [diapers, wipes],
        when: { mode: 'all', items: [K('minCount', { count: 1, of: diapers.id }, says('a pack of diapers', 'عبوة حفاضات'))] },
        then: [X('bundle', { parts: [{ of: diapers.id, count: 1 }, { of: wipes.id, count: 2 }], max: 2, kind: 'bundlePrice', value: 85, label: says('Baby bundle', 'باقة الطفل') })],
      })],
    })
  })(),
  (() => {
    const beauty = F('beauty', { cats: ['A002'] })
    return campaign({
      id: 'GP-BEAUTY15', code: 'GP-BEAUTY15', name: says('Gold and Platinum: 15% off Beauty Care, twice a month', 'الذهبي والبلاتيني: خصم 15% على العناية بالجمال مرتين شهرياً'),
      description: 'The second 2702 campaign. A profile budget counts uses per member per month.', tags: ['tier', 'beauty'],
      audience: { countries: ['SA'], channels: [], stores: [], members: 'earning' },
      budgets: [B('twice a month per member', 'profile', 'uses', 2, 'month')], published: ['2026-08-01 08:00', 'Omar (marketing)'],
      rules: [R('15% off every Beauty Care line', {
        filters: [beauty],
        when: { mode: 'all', items: [
          K('tier', { in: ['G', 'P'] }, says('a Gold or Platinum member', 'عضو ذهبي أو بلاتيني')),
          K('minCount', { count: 1, of: beauty.id }, says('a Beauty Care item', 'منتج عناية بالجمال')),
        ] },
        then: [X('discountItems', { on: beauty.id, kind: 'percent', value: 15, per: 'line', label: says('15% Beauty for Gold+', 'خصم 15% على الجمال للذهبي') })],
      })],
    })
  })(),
  (() => {
    const beauty = F('beauty', { cats: ['A002'] })
    return campaign({
      id: 'BDAY-BEAUTY', code: 'BDAY-BEAUTY', name: says('Birthday week: 10% off Beauty Care', 'أسبوع الميلاد: خصم 10% على العناية بالجمال'),
      description: 'A draft waiting for approval. Uses the anniversary condition, which the profile-attributes work has not settled yet.', tags: ['tier', 'beauty'],
      status: 'waitingForApproval', created: ['2026-10-14 11:00', 'Omar (marketing)'],
      audience: { countries: ['SA'], channels: [], stores: [], members: 'earning' },
      budgets: [B('once a year per member', 'profile', 'uses', 1, 'year')],
      approval: { ...stamp('2026-10-15 16:20', 'Omar (marketing)'), note: 'Ready for the November CRM push.' },
      rules: [R('10% on beauty in the birthday week', {
        filters: [beauty],
        when: { mode: 'all', items: [K('anniversary', { path: 'birthday', withinDays: 7 }, says('a birthday this week', 'عيد ميلاد هذا الأسبوع'))] },
        then: [
          X('discountItems', { on: beauty.id, kind: 'percent', value: 10, per: 'unit', label: says('Birthday 10%', 'خصم الميلاد 10%') }),
          X('notify', { text: says('Happy birthday from Arbahi!', 'عيد ميلاد سعيد من أرباحي!') }),
        ],
      })],
    })
  })(),
  (() => {
    const eligible = F('eligible', { exclCats: [...EXCL_RX] })
    return campaign({
      id: 'WKND20', code: 'WKND20', name: says('Weekend coupon: 20% off, up to SAR 40', 'قسيمة نهاية الأسبوع: خصم 20% حتى 40 ريال'),
      description: "Campaign coupons live in SIS.Coupons under this campaign's template, limited only by budgets (ADR 0094). Thursday to Saturday.", tags: ['coupon'],
      schedule: schedule('2026-10-01', '2026-12-31', [4, 5, 6]), features: { coupons: true, points: true },
      budgets: [B('campaign money', 'campaign', 'money', 50000, 'lifetime')], published: ['2026-09-28 11:30', 'Sara (CRM)'],
      rules: [R('20% off the basket, Rx excluded', {
        filters: [eligible],
        when: { mode: 'all', items: [K('coupon', { source: 'campaign', pattern: '' }, says('a valid weekend coupon', 'قسيمة نهاية أسبوع صالحة'))] },
        then: [X('discountSession', { on: eligible.id, kind: 'percent', value: 20, cap: 40, scope: 'items', label: says('Weekend 20%', 'خصم نهاية الأسبوع 20%') })],
      })],
    })
  })(),
  (() => {
    const eligible = F('eligible', { exclCats: [...EXCL_RX] })
    return campaign({
      id: 'PTS-50OFF', code: 'PTS-50OFF', name: says('Pay SAR 30 of points, get SAR 50 off a basket of SAR 200', 'ادفع 30 ريال من النقاط واحصل على 50 ريال خصم لسلة 200 ريال'),
      description: 'The third 2702 campaign. Burn and discount are one rule, so they apply together or not at all.', tags: ['points'],
      audience: { countries: ['SA'], channels: [], stores: [], members: 'earning' }, published: ['2026-08-01 08:05', 'Sara (CRM)'],
      rules: [R('Burn 30, take 50 off, together or not at all', {
        filters: [eligible],
        when: { mode: 'all', items: [
          K('sessionFlag', { flag: 'pointsOffer' }, says('the customer said yes at the till', 'وافق العميل عند الكاشير')),
          K('minSubtotal', { amount: 200, basis: 'total', of: '' }, says('a basket of SAR 200 after earlier offers', 'سلة 200 ريال بعد العروض السابقة')),
          K('minPoints', { amount: 30, unit: 'SAR' }, says('SAR 30 of points', 'نقاط بقيمة 30 ريال')),
        ] },
        then: [X('burnPoints', { value: 30, unit: 'SAR' }), X('discountSession', { on: eligible.id, kind: 'amount', value: 50, cap: 0, scope: 'items', label: says('SAR 50 off for points', 'خصم 50 ريال مقابل النقاط') })],
      })],
    })
  })(),
  campaign({
    id: 'NEXT-VISIT', code: 'NEXT-VISIT', name: says('Spend SAR 300, get a weekend coupon for next time', 'أنفق 300 ريال واحصل على قسيمة لنهاية الأسبوع القادمة'),
    description: "A createCoupon effect: minted at close from WKND20's template and bound to the member (2717).", tags: ['coupon'],
    audience: { countries: ['SA'], channels: [], stores: [], members: 'identified' },
    budgets: [B('once a month per member', 'profile', 'uses', 1, 'month')], published: ['2026-10-03 13:00', 'Sara (CRM)'],
    rules: [R('Mint a coupon', {
      when: { mode: 'all', items: [K('minSubtotal', { amount: 300, basis: 'total', of: '' }, says('a basket of SAR 300', 'سلة بقيمة 300 ريال'))] },
      then: [X('createCoupon', { from: 'WKND20', validDays: 14, bindToMember: true }), X('notify', { text: says('A weekend coupon is in your Arbahi wallet', 'قسيمة نهاية الأسبوع في محفظة أرباحي') })],
    })],
  }),
  (() => {
    const eligible = F('eligible', { exclCats: [...EXCL_RX] })
    return campaign({
      id: 'WLCB', code: 'WLCB', name: says('Hayak welcome cashback: 10% back on a genuine first purchase', 'كاش باك حياك: 10% على أول عملية شراء'),
      description: 'The fourth 2702 campaign. "Once per member, ever" is a budget, so a second order the same afternoon is refused.', tags: ['points', 'welcome'],
      schedule: schedule('2026-08-15', '2026-12-31'), audience: { countries: ['SA'], channels: [], stores: [], members: 'earning' },
      budgets: [B('once per member, ever', 'profile', 'uses', 1, 'lifetime')], published: ['2026-08-14 17:45', 'Sara (CRM)'],
      rules: [R('10% of eligible spend, whole SAR, half up', {
        filters: [eligible],
        values: [V('spend', 'sum(eligible)'), V('back', 'round(spend * 0.10, 0, halfUp)')],
        when: { mode: 'all', items: [
          K('coupon', { source: 'pattern', pattern: 'HAYAK*' }, says('a Hayak coupon', 'قسيمة حياك')),
          K('firstPurchase', { is: 'never' }, says('a genuine first purchase', 'أول عملية شراء فعلية')),
          K('expr', { formula: 'back > 0' }, says('something to pay back', 'مبلغ للاسترداد')),
        ] },
        then: [X('awardPoints', { value: 'back', unit: 'SAR', activity: 'WLCB', activates: { mode: 'afterDays', value: 7 }, expires: { mode: 'afterDays', value: 30 } })],
      })],
    })
  })(),
  (() => {
    const earning = F('earning', { cats: ['A001', 'A002', 'A003', 'A005'] })
    return campaign({
      id: 'PRCB-AUG26', code: 'PRCB-AUG26', name: says('Arbahi points-back: online, 10/12/15% capped at SAR 105', 'استرداد نقاط أرباحي: أونلاين 10/12/15% بحد 105 ريال'),
      description: 'The fifth 2702 campaign, ended. A banded rate is a value with band().', tags: ['points', 'online'],
      schedule: schedule('2026-08-27', '2026-09-04'), audience: { countries: ['SA'], channels: ['CMRC'], stores: [], members: 'earning' },
      published: ['2026-08-25 12:00', 'Sara (CRM)'],
      rules: [R('Tiered points-back on earning categories', {
        filters: [earning],
        values: [V('basis', 'sum(earning)'), V('rate', 'band(basis, 200:0.10, 400:0.12, 700:0.15)'), V('back', 'min(round(basis * rate, 0, halfUp), 105)')],
        when: { mode: 'all', items: [K('minSubtotal', { amount: 200, basis: 'total', of: earning.id }, says('SAR 200 of eligible spend', '200 ريال من المشتريات المؤهلة'))] },
        then: [X('awardPoints', { value: 'back', unit: 'SAR', activity: 'PRCB', activates: { mode: 'on', value: '2026-09-10' }, expires: { mode: 'on', value: '2026-09-17' } })],
      })],
    })
  })(),
  (() => {
    const eligible = F('eligible', { exclCats: [...EXCL_RX] })
    return campaign({
      id: 'BH-SPEND10', code: 'BH-SPEND10', name: says('Bahrain: BHD 1.000 off a basket of BHD 10.000', 'البحرين: خصم 1.000 دينار لسلة 10.000 دينار'),
      description: 'A 3-decimal currency: amounts are in BHD, rounding is to the fils.', tags: ['BH'],
      audience: { countries: ['BH'], channels: [], stores: [], members: 'any' }, published: ['2026-10-05 09:30', 'Ali (Bahrain)'],
      rules: [R('BHD 1 off', {
        filters: [eligible],
        when: { mode: 'all', items: [K('minSubtotal', { amount: 10, basis: 'total', of: eligible.id }, says('a basket of BHD 10.000', 'سلة بقيمة 10.000 دينار'))] },
        then: [X('discountSession', { on: eligible.id, kind: 'amount', value: 1, cap: 0, scope: 'items', label: says('BHD 1 off', 'خصم 1 دينار') })],
      })],
    })
  })(),
  (() => {
    const earning = F('earning', { cats: ['A001', 'A002', 'A003', 'A005'] })
    return campaign({
      id: 'BASE-EARN', code: 'BASE-EARN', name: says('Arbahi base earn (standing campaign)', 'كسب أرباحي الأساسي'),
      description: 'Base earn becomes a standing campaign (2704). The rate here is an example.', tags: ['points', 'standing'],
      schedule: schedule('2026-01-01', null), audience: { countries: ['SA'], channels: [], stores: [], members: 'earning' },
      published: ['2026-09-30 08:00', 'Sara (CRM)'],
      rules: [R('One point per riyal of earning spend', {
        filters: [earning],
        values: [V('pts', 'floor(sum(earning))')],
        when: { mode: 'all', items: [K('expr', { formula: 'pts > 0' }, says('earning spend', 'مشتريات مؤهلة للكسب'))] },
        then: [X('awardPoints', { value: 'pts', unit: 'PTS', activity: 'BASE', activates: { mode: 'afterHours', value: 48 }, expires: { mode: 'afterDays', value: 365 } })],
      })],
    })
  })(),
  (() => {
    const serum = F('serum', { skus: ['SER-VC'] })
    return campaign({
      id: 'GIFT-POUCH', code: 'GIFT-POUCH', name: says('Free travel pouch with a Vitamin C serum', 'حقيبة سفر مجانية مع سيروم فيتامين سي'),
      description: 'A free unit of a product (2718): the engine never adds a line. If the pouch is not scanned, the cashier is prompted.', tags: ['gift'],
      published: ['2026-10-10 15:00', 'Omar (marketing)'],
      // 512: its third version — the two before it are `EARLIER` below.
      created: ['2026-10-03 10:00', 'Omar (marketing)'], live: { version: 3, ...stamp('2026-10-10 15:00', 'Omar (marketing)') },
      rules: [R('Pouch free with the serum', {
        filters: [serum],
        when: { mode: 'all', items: [K('minCount', { count: 1, of: serum.id }, says('a Vitamin C serum', 'سيروم فيتامين سي'))] },
        then: [X('freeProduct', { sku: 'GIFT-BAG', qty: 1, prompt: says('Scan a travel pouch: it is free with the serum', 'امسح حقيبة السفر: مجانية مع السيروم'), label: says('Free pouch', 'حقيبة مجانية') })],
      })],
    })
  })(),
  // ── Not the prototype's: one campaign per state the prototype's samples leave empty. ──
  campaign({
    id: 'NATDAY-15', code: 'NATDAY-15', name: says('National Day: 15% off the basket', 'اليوم الوطني: خصم 15% على السلة'),
    description: 'Approved ahead of its week: a scheduled campaign.', tags: ['seasonal'],
    schedule: { from: '2026-10-19', until: '2026-10-26', days: [], hoursFrom: '16:00', hoursTo: '23:00' },
    published: ['2026-10-12 10:00', 'Reem (approver)'], created: ['2026-10-11 09:00', 'Omar (marketing)'],
  }),
  campaign({
    id: 'SPRING-DRAFT', code: 'SPRING-DRAFT', name: says('Spring skincare (draft)', ''),
    schedule: schedule(null, null), created: ['2026-10-16 09:40', 'Omar (marketing)'],
  }),
  campaign({
    id: 'SUMMER-FLASH', code: 'SUMMER-FLASH', name: says('Summer flash sale', 'تخفيضات الصيف السريعة'),
    status: 'disabled', schedule: schedule('2026-09-01', null), published: ['2026-08-30 12:00', 'Reem (approver)'],
  }),
]

/** A campaign as the list door sends it — without its rules, budgets and audience. */
export const listRow = ({ id, code, name, tags, status, schedule, features, created, live }) => ({
  id, code, name, tags, status, schedule, features, created, live,
})

// ── 502: the stubbed HQ side of create and copy. HQ mints the code and the id; these mimic the
// prototype's `create` / `copyCampaign` so a drive can read the result back. ──

const BY = 'msartawi'
/** A code from `base`, as the prototype makes one (at most `max` long), unique within `store`. */
const mintCode = (store, base, max = 16) => {
  const root = base.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, max).replace(/^-|-$/g, '') || 'NEW'
  let code = root
  for (let n = 2; store.some((c) => c.id === code); n++) code = `${root}-${n}`
  return code
}

/** POST RuleCampaign/Campaigns — a blank draft from a name and features. `at` is a local moment. */
export function createDraft(store, { name, features }, at) {
  const code = mintCode(store, name.en)
  const draft = campaign({
    id: code, code, name: { en: name.en, ar: name.ar }, features: { coupons: !!features.coupons, points: !!features.points },
    schedule: schedule(null, null), created: [at, BY],
  })
  store.push(draft)
  return draft
}

/** POST RuleCampaign/Campaigns/{id}/Copy — an independent draft named "<name> (copy)". */
export function copyOf(store, source, at) {
  const code = mintCode(store, `${source.code}-COPY`, source.code.length + 5)
  const copy = {
    ...structuredClone(source),
    id: code, code,
    name: { en: `${source.name.en} (copy)`, ar: source.name.ar ? `${source.name.ar} (نسخة)` : '' },
    status: 'draft', live: null, approval: null, created: stamp(at, BY),
  }
  store.push(copy)
  return copy
}

// ── 503: templates (BackOffice 2759). The prototype's `sampleTemplates()` in the provisional shape: a
// campaign draft whose values are `{ placeholder: key }` marks or `{{key}}` inside a string, filled by
// the Create dialog. Its block and filter ids are the template's own; HQ keeps them in the draft. ──

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
      features: { coupons: false, points: false },
      rules: [{
        id: 'tr-spend', name: '{{pct}}% off the category', values: [], partial: 'refuse',
        filters: [{ id: 'tf-target', name: 'target', cats: P('cats'), colls: [], skus: [], exclCats: EXCL_RX, scope: 'items' }],
        when: { mode: 'all', items: [{ id: 'tc-spend', type: 'minSubtotal', amount: P('minSpend'), basis: 'total', of: '', says: says('a basket of SAR {{minSpend}}', 'سلة بقيمة {{minSpend}} ريال') }] },
        then: [{ id: 'te-spend', type: 'discountItems', on: 'tf-target', kind: 'percent', value: P('pct'), per: 'unit', label: says('{{pct}}% off', 'خصم {{pct}}%') }],
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
      features: { coupons: false, points: false },
      rules: [{
        id: 'tr-buy', name: 'Cheapest {{free}} of every {{buy}} free', values: [], partial: 'refuse',
        filters: [{ id: 'tf-set', name: 'set', cats: [], colls: P('coll'), skus: [], exclCats: EXCL_RX, scope: 'items' }],
        when: { mode: 'all', items: [{ id: 'tc-buy', type: 'minCount', count: P('buy'), of: 'tf-set', says: says('{{buy}} items from the collection', '{{buy}} منتجات من المجموعة') }] },
        then: [{ id: 'te-buy', type: 'freeUnits', on: 'tf-set', buy: P('buy'), free: P('free'), which: 'cheapest', label: says('{{buy}} for less', '{{buy}} بسعر أقل') }],
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
      features: { coupons: false, points: true },
      audience: { countries: ['SA'], channels: [], stores: [], members: 'earning' },
      rules: [{
        id: 'tr-tier', name: 'Tier points', partial: 'refuse',
        filters: [{ id: 'tf-earning', name: 'earning', cats: ['A001', 'A002', 'A003', 'A005'], colls: [], skus: [], exclCats: EXCL_RX, scope: 'items' }],
        values: [{ id: 'tv-pts', name: 'pts', formula: 'floor(sum(earning) * {{mult}})' }],
        when: { mode: 'all', items: [{ id: 'tc-tier', type: 'tier', in: [P('tier')], says: says('a {{tier}} member', 'عضو {{tier}}') }] },
        then: [{ id: 'te-tier', type: 'awardPoints', value: 'pts', unit: 'PTS', activity: 'TIERX', activates: { mode: 'afterHours', value: 48 }, expires: { mode: 'afterDays', value: 365 } }],
      }],
    },
  },
]

/** POST RuleCampaign/Templates/{id}/Create — a draft from the filled template the dialog sends. HQ
 *  would re-fill from `values` to check it; the stub takes the draft as sent. */
export function createFromTemplate(store, template, { draft }, at) {
  const code = mintCode(store, draft.name.en)
  const made = campaign({
    id: code, code, name: { en: draft.name.en, ar: draft.name.ar }, features: { coupons: !!draft.features.coupons, points: !!draft.features.points },
    ...(draft.audience ? { audience: structuredClone(draft.audience) } : {}),
    rules: structuredClone(draft.rules), tags: ['from template'], schedule: schedule(null, null), created: [at, BY],
  })
  store.push(made)
  return made
}

// ── 511: the stubbed HQ side of the approval life (BackOffice 2759): draft → waiting for approval
// → (sent back → draft) | live → disabled. A move from the wrong state is HQ's refusal, as the real
// door would answer it; who may move it is the drive's to stub (the roles door). ──

const FROM = { AskForApproval: ['draft'], Activate: ['waitingForApproval'], SendBack: ['waitingForApproval'], Disable: ['live'] }

/** POST RuleCampaign/Campaigns/{id}/{act}: the campaign moved, or `{ refused }` with HQ's code. */
export function lifecycle(c, act, { note = '', by, at }) {
  if (!FROM[act]?.includes(c.status) || (act === 'Disable' && !c.live)) return { refused: 'RULE_CAMPAIGN_WRONG_STATE' }
  const when = stamp(at, by)
  if (act === 'AskForApproval') Object.assign(c, { status: 'waitingForApproval', approval: { ...when, note }, sentBack: null })
  if (act === 'SendBack') Object.assign(c, { status: 'draft', approval: null, sentBack: { ...when, note } })
  if (act === 'Activate') Object.assign(c, { status: 'live', approval: null, sentBack: null, live: { version: (c.live?.version ?? 0) + 1, ...when } })
  if (act === 'Disable') Object.assign(c, { status: 'disabled', approval: null })
  return { campaign: c }
}

// ── 504: the stubbed block catalogue (GET RuleCampaign/Catalogue, BackOffice 2758). Every condition
// and effect the prototype offers (its app.js COND_PALETTE / EFFECT_PALETTE), with its fields in the
// PROVISIONAL `RuleBlockCatalogue` shape; `feature` gates the palette (505) as the create dialog
// promises: coupons adds the coupon condition, points the earn and burn blocks. The vitest proof
// (`src/core/rules/sentence.test.ts`) reads this same catalogue and these same campaigns. ──

const field = (key, kind, o = {}) => ({ key, kind, ...o })
const notMet = field('says', 'says', { role: 'notMet' })
const receiptLabel = field('label', 'says', { role: 'receiptLabel' })
const cond = (type, group, fields, o = {}) => ({ type, kind: 'condition', group, feature: null, decided: true, fields: [...fields, notMet], ...o })
const eff = (type, group, fields, o = {}) => ({ type, kind: 'effect', group, feature: null, decided: true, fields, ...o })

export const CATALOGUE = {
  groups: [
    { key: 'basket', kind: 'condition' },
    { key: 'attribute', kind: 'condition' },
    { key: 'coupon', kind: 'condition' },
    { key: 'loyalty', kind: 'condition' },
    { key: 'audience', kind: 'condition' },
    { key: 'sale', kind: 'condition' },
    { key: 'logic', kind: 'condition' },
    { key: 'discounts', kind: 'effect' },
    { key: 'points', kind: 'effect' },
    { key: 'couponsAndMessages', kind: 'effect' },
  ],
  blocks: [
    cond('minSubtotal', 'basket', [field('of', 'items'), field('amount', 'money'), field('basis', 'choice', { options: ['total', 'subtotal'] })], { variant: 'basis' }),
    cond('minCount', 'basket', [field('count', 'count', { plural: true }), field('of', 'items')]),
    cond('attribute', 'attribute', [field('path', 'code'), field('op', 'choice', { options: ['==', '!=', '>', '>=', '<', '<='] }), field('value', 'text')]),
    cond('expr', 'attribute', [field('formula', 'formula')]),
    cond('coupon', 'coupon', [field('source', 'choice', { options: ['campaign', 'pattern'] }), field('pattern', 'code')], { variant: 'source', feature: 'coupons' }),
    cond('member', 'loyalty', [field('is', 'choice', { options: ['identified', 'earning'] })], { variant: 'is' }),
    cond('tier', 'loyalty', [field('in', 'choices', { options: ['S', 'G', 'P'] })]),
    cond('minPoints', 'loyalty', [field('amount', 'points', { unitFrom: 'unit' }), field('unit', 'choice', { options: ['SAR', 'PTS'] })], { feature: 'points' }),
    cond('firstPurchase', 'loyalty', [field('is', 'choice', { options: ['never', 'done'] })], { variant: 'is' }),
    cond('anniversary', 'loyalty', [field('path', 'choice', { options: ['birthday', 'membership'] }), field('withinDays', 'days')], { variant: 'path', decided: false }),
    cond('audience', 'audience', [field('op', 'choice', { options: ['in', 'notIn'] }), field('name', 'text')], { variant: 'op', decided: false }),
    cond('channel', 'sale', [field('in', 'codes')]),
    cond('store', 'sale', [field('in', 'codes')]),
    cond('sessionFlag', 'sale', [field('flag', 'choice', { options: ['pointsOffer'] })], { variant: 'flag' }),
    cond('budgetLeft', 'sale', [field('budget', 'budget')]),
    { type: 'group', kind: 'condition', group: 'logic', feature: null, decided: true, fields: [field('mode', 'choice', { options: ['all', 'any'] })] },

    eff('discountItems', 'discounts', [field('kind', 'choice', { options: ['percent', 'amount', 'targetPrice'] }), field('value', 'discount', { unitFrom: 'kind' }), field('per', 'choice', { options: ['unit', 'line'] }), field('on', 'items'), receiptLabel], { variant: 'kind' }),
    eff('discountSession', 'discounts', [field('kind', 'choice', { options: ['percent', 'amount'] }), field('value', 'discount', { unitFrom: 'kind' }), field('on', 'items'), field('cap', 'money', { clause: true }), field('scope', 'choice', { options: ['items', 'fees', 'itemsAndFees'], clause: true, default: 'items' }), receiptLabel], { variant: 'kind' }),
    eff('discountFees', 'discounts', [field('kind', 'choice', { options: ['percent', 'amount'] }), field('value', 'discount', { unitFrom: 'kind' }), field('cap', 'money', { clause: true }), receiptLabel], { variant: 'kind' }),
    eff('freeUnits', 'discounts', [field('which', 'choice', { options: ['cheapest', 'dearest'] }), field('buy', 'count'), field('on', 'items'), field('free', 'count', { plural: true }), receiptLabel], { variant: 'which' }),
    eff('freeProduct', 'discounts', [field('qty', 'count', { plural: true }), field('sku', 'code'), field('prompt', 'says', { role: 'cashierPrompt' }), receiptLabel]),
    eff('valueMap', 'discounts', [field('map', 'code'), receiptLabel]),
    eff('bundle', 'discounts', [field('kind', 'choice', { options: ['bundlePrice', 'discount', 'cheapestFree'] }), field('parts', 'itemParts'), field('value', 'money'), field('max', 'count', { clause: true, plural: true }), receiptLabel], { variant: 'kind' }),
    eff('awardPoints', 'points', [field('value', 'points', { unitFrom: 'unit' }), field('unit', 'choice', { options: ['SAR', 'PTS'] }), field('activity', 'code'), field('activates', 'timing', { clause: true }), field('expires', 'timing', { clause: true })], { feature: 'points' }),
    eff('burnPoints', 'points', [field('value', 'points', { unitFrom: 'unit' }), field('unit', 'choice', { options: ['SAR', 'PTS'] })], { feature: 'points' }),
    eff('createCoupon', 'couponsAndMessages', [field('from', 'code'), field('validDays', 'days'), field('bindToMember', 'flag', { clause: true })]),
    eff('notify', 'couponsAndMessages', [field('text', 'says', { role: 'message' })]),
  ],
  formula: {
    // 507: what the guided ƒx helper offers — the prototype's helpers.js ATTRS (the decided ones),
    // FUNC_DOCS, OPS and recipesFor, in the PROVISIONAL `RuleFormulaGuide` shape. `{filter}` in a
    // recipe is the rule's filter the marketer picks; `{current}` the box's own formula.
    fields: [
      { path: 'session.subtotal', type: 'money', group: 'sale' },
      { path: 'session.total', type: 'money', group: 'sale' },
      { path: 'session.fees', type: 'money', group: 'sale' },
      { path: 'session.decimals', type: 'number', group: 'sale' },
      { path: 'session.channel', type: 'text', group: 'sale' },
      { path: 'session.store', type: 'text', group: 'sale' },
      { path: 'session.country', type: 'text', group: 'sale' },
      { path: 'profile.id', type: 'text', group: 'profile' },
      { path: 'profile.tier', type: 'text', group: 'profile' },
      { path: 'profile.points', type: 'money', group: 'profile' },
      { path: 'profile.tentativePoints', type: 'money', group: 'profile' },
      { path: 'profile.firstPurchase', type: 'text', group: 'profile' },
      { path: 'item.net', type: 'money', group: 'item' },
      { path: 'item.price', type: 'money', group: 'item' },
      { path: 'item.sku', type: 'text', group: 'item' },
      { path: 'item.category', type: 'text', group: 'item' },
    ],
    functions: [
      { name: 'sum', signature: 'sum(filter)', example: 'sum(beauty)', snippet: 'sum()', caret: 4 },
      { name: 'count', signature: 'count(filter)', example: 'count(suncare) >= 3', snippet: 'count()', caret: 6 },
      { name: 'round', signature: 'round(x, decimals, mode)', example: 'round(spend * 0.10, decimals, halfUp)', snippet: 'round(, decimals, halfUp)', caret: 6 },
      { name: 'band', signature: 'band(x, from:rate, ...)', example: 'band(spend, 200:0.10, 400:0.12)', snippet: 'band(, 200:0.10, 400:0.12)', caret: 5 },
      { name: 'min', signature: 'min(a, b, ...)', example: 'min(back, 100)', snippet: 'min(, 100)', caret: 4 },
      { name: 'max', signature: 'max(a, b, ...)', example: 'max(back, 5)', snippet: 'max(, 5)', caret: 4 },
      { name: 'floor', signature: 'floor(x)', example: 'floor(spend / 10)', snippet: 'floor()', caret: 6 },
      { name: 'ceil', signature: 'ceil(x)', example: 'ceil(count(items) / 2)', snippet: 'ceil()', caret: 5 },
      { name: 'abs', signature: 'abs(x)', example: 'abs(session.total - 100)', snippet: 'abs()', caret: 4 },
      { name: 'if', signature: 'if(test, then, else)', example: "if(profile.tier == 'P', 0.15, 0.10)", snippet: 'if(, , )', caret: 3 },
    ],
    operators: ['+', '-', '*', '/', '(', ')', '>=', '>', '<=', '<', '==', '!=', 'and', 'or', 'not'],
    recipes: [
      { key: 'percentOfSpend', expect: 'number', formula: 'round(sum({filter}) * 10 / 100, decimals, halfUp)' },
      { key: 'tieredRate', expect: 'number', formula: 'band(sum({filter}), 200:0.10, 400:0.12, 700:0.15)' },
      { key: 'capped', expect: 'number', formula: 'min({current}, 100)' },
      { key: 'pointsPerSar', expect: 'number', formula: 'floor(sum({filter}) / 10)' },
      { key: 'topTiers', expect: 'number', formula: "if(profile.tier == 'P', 0.15, 0.10)" },
      { key: 'basketBigEnough', expect: 'bool', formula: 'session.total >= 150' },
      { key: 'enoughUnits', expect: 'bool', formula: 'count({filter}) >= 3' },
      { key: 'goldOrPlatinum', expect: 'bool', formula: "profile.tier == 'G' or profile.tier == 'P'" },
      { key: 'enoughPoints', expect: 'bool', formula: 'profile.tentativePoints >= 30' },
      { key: 'tillOnly', expect: 'bool', formula: "session.channel == 'POS'" },
    ],
  },
}

// ── 507: the stubbed formula check (POST RuleCampaign/Formula/Check, BackOffice 2758). NOT the
// expression language: a canned answer. A word that is not a field, a function, a mode or a filter
// or value the request sent is an error with its span; anything else is valid, with a canned
// result on "the sample basket" (12.5, or yes for a test). ──

/** The result the stub gives every valid formula that needs a number. */
export const SAMPLE_RESULT = 12.5
const WORDS = ['decimals', 'halfUp', 'halfEven', 'down', 'up', 'and', 'or', 'not']

/** What the stubbed check door answers for a `RuleFormulaCheckRequest`. */
export function checkFormula(body) {
  const formula = String(body.formula ?? '')
  const answer = (o) => ({ ok: false, type: null, errors: [], warnings: [], result: null, ...o })
  if (!formula.trim()) return answer({ errors: [{ code: 'FORMULA_EMPTY', message: 'Write a number or a formula.', start: null, end: null }] })
  const known = new Set([
    ...CATALOGUE.formula.fields.map((f) => f.path),
    ...CATALOGUE.formula.functions.map((f) => f.name),
    ...WORDS,
    ...(body.filters ?? []).map((f) => f.name),
    ...(body.values ?? []).map((v) => v.name),
  ])
  // Quoted text is blanked so a word inside quotes is not looked up.
  const bare = formula.replace(/'[^']*'/g, (m) => ' '.repeat(m.length))
  for (const m of bare.matchAll(/[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*/g)) {
    if (!known.has(m[0]))
      return answer({
        errors: [{ code: 'FORMULA_UNKNOWN_NAME', message: `"${m[0]}" is not a field, a function, or a filter or value of this rule.`, start: m.index, end: m.index + m[0].length }],
      })
  }
  return body.expect === 'bool' ? answer({ ok: true, type: 'bool', result: true }) : answer({ ok: true, type: 'number', result: SAMPLE_RESULT })
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
  collections: [{ code: 'SUNCARE', name: 'Suncare' }, { code: 'DIAPERS', name: 'Diapers' }, { code: 'WIPES', name: 'Baby wipes' }],
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

// ── 509: the stubbed HQ side of Settings (BackOffice 2758). ──

const walkConds = (items, fn) => items.forEach((c) => { fn(c); if (Array.isArray(c.items)) walkConds(c.items, fn) })
const PROFILE_CONDS = { tier: 1, member: 1, firstPurchase: 1, minPoints: 1, audience: 1, anniversary: 1 }

/**
 * GET RuleCampaign/Campaigns/{id}/OfflineVerdict — the prototype's `offlineVerdict` (engine.js),
 * worked out from the saved draft. `safe` ignores the campaign's own "online only".
 */
export function offlineVerdict(c) {
  const r = new Map()
  const add = (code, message) => r.set(code, message)
  if (c.budgets.length) add('BUDGET', 'has a budget (a central counter)')
  if (c.audience.members !== 'any') add('MEMBERS_ONLY', 'is for members only')
  for (const rule of c.rules) {
    walkConds(rule.when.items, (cd) => {
      if (PROFILE_CONDS[cd.type]) add('PROFILE', 'reads the member profile')
      if (cd.type === 'coupon') add('COUPON', 'needs a coupon (redeemed at HQ)')
      if (cd.type === 'budgetLeft') add('BUDGET_READ', 'reads a budget')
      if (cd.type === 'expr' && /profile\./.test(cd.formula)) add('PROFILE', 'reads the member profile')
    })
    for (const v of rule.values) if (/profile\./.test(v.formula)) add('PROFILE', 'reads the member profile')
    for (const e of rule.then) {
      if (e.type === 'awardPoints') add('AWARDS_POINTS', 'awards points')
      if (e.type === 'burnPoints') add('TAKES_POINTS', 'takes points')
      if (e.type === 'createCoupon') add('CREATES_COUPON', 'creates a coupon')
    }
  }
  return { safe: r.size === 0, reasons: [...r].map(([code, message]) => ({ code, message })) }
}

/**
 * PUT RuleCampaign/Campaigns/{id}/Settings/{part} — the part saved onto the campaign, or `{ refused,
 * message }`: a feature switched off while a block uses it is refused, naming the rules.
 */
export function saveSettings(c, part, body, catalogue = CATALOGUE) {
  if (part === 'Details') Object.assign(c, { name: { en: body.name.en, ar: body.name.ar }, description: body.description })
  if (part === 'Schedule') c.schedule = structuredClone(body)
  if (part === 'Audience') c.audience = structuredClone(body)
  if (part === 'Offline') c.offlineOptOut = !!body.offlineOptOut
  if (part === 'Budgets') {
    // 510: HQ refuses a limit that is not above zero, as the drawer does.
    if (body.budgets.some((b) => !(b.value > 0))) return { refused: 'RULE_BUDGET_INVALID', message: 'A budget limit must be above zero.' }
    c.budgets = structuredClone(body.budgets)
  }
  if (part === 'Features') {
    const needs = new Map(catalogue.blocks.map((b) => [b.type, b.feature]))
    for (const f of ['coupons', 'points']) {
      if (body[f] || !c.features[f]) continue
      const using = c.rules.filter((r) => {
        const blocks = [...r.then]
        walkConds(r.when.items, (cd) => blocks.push(cd))
        return blocks.some((b) => needs.get(b.type) === f)
      })
      if (using.length) return { refused: 'RULE_FEATURE_IN_USE', message: `The ${f} feature is used by: ${using.map((r) => r.name).join(', ')}.` }
    }
    c.features = { coupons: !!body.coupons, points: !!body.points }
  }
  return { campaign: c }
}

/**
 * GET RuleCampaign/Campaigns/{id}/BudgetUsage (510, BackOffice 2744) — a live campaign's counters, one
 * per budget: WKND20 has used SAR 12,345.50 of its SAR 50,000.00; GP-BEAUTY15's busiest member has
 * used 3 of 2 (an overshoot, ADR 0091); every other budget, nothing yet.
 */
const USED = { WKND20: 12345.5, 'GP-BEAUTY15': 3 }
export function budgetUsage(c) {
  return c.budgets.map((b, i) => ({ budgetId: b.id, used: i === 0 ? (USED[c.id] ?? 0) : 0 }))
}

/**
 * PUT RuleCampaign/Campaigns/{id}/Budgets/{budgetId}/Limit (510, BackOffice 2744) — a live budget's new
 * limit, at once and with no publish; or `{ refused, message }`.
 */
export function changeLimit(c, budgetId, value) {
  if (c.status !== 'live') return { refused: 'RULE_CAMPAIGN_NOT_LIVE', message: 'Only a live campaign’s limit changes on its own.' }
  const b = c.budgets.find((x) => x.id === budgetId)
  if (!b) return { refused: 'RULE_BUDGET_NOT_FOUND', message: 'No such budget.' }
  if (!(value > 0)) return { refused: 'RULE_BUDGET_INVALID', message: 'A budget limit must be above zero.' }
  b.value = value
  return { campaign: c }
}

// ── 512: the stubbed version history (BackOffice 2759): GET RuleCampaign/Campaigns/{id}/Versions,
// GET …/Versions/{n} and POST …/Versions/{n}/Restore. Every published campaign has its live version,
// its rules as they are now; GIFT-POUCH has two before it (its live version is 3). A version keeps
// its rules' ids, as HQ's snapshot would. ──

/** GIFT-POUCH's versions 1 and 2, worked back from its live rules (built here, after CAMPAIGNS, so
 *  the fixtures' ids above do not move). */
const EARLIER = (() => {
  const pouch = CAMPAIGNS.find((c) => c.id === 'GIFT-POUCH')
  const at = (rules, f) => rules.map((r) => ({ ...r, then: r.then.map((e) => ({ ...e, ...f })) }))
  const v1 = at(structuredClone(pouch.rules), { prompt: says('', ''), label: says('Gift pouch', 'حقيبة هدية') })
  const v2 = at(structuredClone(pouch.rules), { label: says('Gift pouch', 'حقيبة هدية') })
  return {
    'GIFT-POUCH': [
      { version: 1, ...stamp('2026-10-03 10:00', 'Omar (marketing)'), note: 'First version: the pouch is free with the serum.', rules: v1 },
      { version: 2, ...stamp('2026-10-06 12:30', 'Reem (approver)'), note: 'The cashier is prompted to scan the pouch.', rules: v2 },
    ],
  }
})()
/** The live version's note, where one was written. */
const LIVE_NOTE = { 'GIFT-POUCH': 'The receipt says "Free pouch".' }

/** Each campaign's versions with their rules, by id — a context's own copy, so an activation or a
 *  restore stays in its run. */
export function versionsOf(store) {
  const out = new Map()
  for (const c of store) {
    if (!c.live) continue
    out.set(c.id, [
      ...structuredClone(EARLIER[c.id] ?? []),
      { version: c.live.version, at: c.live.at, by: c.live.by, note: LIVE_NOTE[c.id] ?? '', rules: structuredClone(c.rules) },
    ])
  }
  return out
}

/** A version as the list reads it: without its rules. */
export const versionRow = ({ rules, ...row }) => row

/** An activation publishes a version: the draft's rules as they were activated. */
export function publishVersion(versions, c, note = '') {
  versions.set(c.id, [...(versions.get(c.id) ?? []), { version: c.live.version, at: c.live.at, by: c.live.by, note, rules: structuredClone(c.rules) }])
}

/** POST …/Versions/{n}/Restore: the version is the campaign's NEW draft; its live version is
 *  untouched. Or `{ refused, message }` — a request waiting for approval is not changed under it. */
export function restoreVersion(c, versions, n) {
  const v = (versions.get(c.id) ?? []).find((x) => x.version === n)
  if (!v) return { refused: 'RULE_VERSION_NOT_FOUND', message: 'No such version.' }
  if (c.status === 'waitingForApproval') return { refused: 'RULE_CAMPAIGN_WAITING', message: 'A request waits for approval. Send it back first.' }
  Object.assign(c, { status: 'draft', rules: structuredClone(v.rules), approval: null, sentBack: null })
  return { campaign: c }
}
