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
