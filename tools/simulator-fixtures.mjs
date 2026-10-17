// Simulator stubs (spec 2737, ticket 514): the PROVISIONAL `POST RuleCampaign/Simulate` answer
// (`RuleSimResult`, src/core/models/rule-campaign.ts), served at the Playwright route layer by
// tools/simulator-drive.mjs. No HQ contract exists yet (BackOffice 2758); ticket 520 re-points it.
//
// The six baskets are the prototype's (BackOffice `.scratch/proto/2734-rule-builder/smoke-engine.js`),
// with the prototype engine's own answers on them (lines, which campaign took what off which line,
// the trace, near misses, points, the cashier prompt), turned into the provisional wire shape here.
// The names, "not met" texts and receipt labels in both languages come from the campaign fixtures.
// A basket that is not one of the six is priced at the catalog's prices with no campaign, except
// that a basket of SAR 300 earns NEXT-VISIT's coupon — so the drive can see "will create".
import { CAMPAIGNS } from './campaigns-fixtures.mjs'

/** The prototype's sample order's groups (data.js `tree`). */
const GROUPS = {
  'SUN-3FOR2': { id: 'g-items', name: 'Item deals', mode: 'highest' },
  'BABY-BUNDLE': { id: 'g-items', name: 'Item deals', mode: 'highest' },
  WKND20: { id: 'g-basket', name: 'Basket offers', mode: 'first' },
  'PTS-50OFF': { id: 'g-basket', name: 'Basket offers', mode: 'first' },
}

/** The prototype's catalog prices (engine.js CATALOG), SAR. */
export const CATALOG = {
  'SUN-50': ['Sunblock SPF50 50ml', 55], 'SUN-30': ['Sun lotion SPF30 200ml', 42], 'SUN-KID': ['Kids sun spray SPF50', 38.5],
  'SER-VC': ['Vitamin C serum 30ml', 89], 'DIA-4': ['Diapers size 4, 52 pcs', 79], 'WIP-80': ['Baby wipes, 80 pcs', 14.5],
  'PAN-24': ['Paracetamol 500mg, 24 tabs', 9.75], 'AMOX-500': ['Amoxicillin 500mg (Rx)', 21], 'SHA-400': ['Shampoo 400ml', 27],
  'SHA-DAN': ['Anti-dandruff shampoo 400ml', 32], 'SHA-ARG': ['Argan oil shampoo 250ml', 38], 'BAL-400': ['Balsam (conditioner) 400ml', 29],
  'BAL-ARG': ['Argan oil balsam 250ml', 36], 'MIL-1': ['Infant formula stage 1', 68], 'GIFT-BAG': ['Travel pouch', 12], 'FEE-DLV': ['Delivery fee', 15],
}

/** The stores' currency and engine (engine.js STORES). */
export const STORES = { R101: ['SAR', 'Rule'], J204: ['SAR', 'Rule'], D310: ['SAR', 'BonusBuy'], M01: ['BHD', 'Rule'] }

// The prototype engine's answers, compacted: lines [sku, name, qty, gross, off, net, {code: off}],
// trace [code, status, reason], near [code, text], awards [code, points], messages [code, en, ar].
const RAW = {
  "default": {"sim":{},"cur":"SAR","store":"R101","gross":379.75,"disc":96.65,"net":283.1,"burn":0,"lines":[["SUN-50","Sunblock SPF50 50ml",2,110,16.5,93.5,{"GP-BEAUTY15":16.5}],["SUN-30","Sun lotion SPF30 200ml",1,42,42,0,{"SUN-3FOR2":42}],["SER-VC","Vitamin C serum 30ml",1,89,13.35,75.65,{"GP-BEAUTY15":13.35}],["DIA-4","Diapers size 4, 52 pcs",1,79,16.82,62.18,{"BABY-BUNDLE":16.82}],["WIP-80","Baby wipes, 80 pcs",2,29,6.18,22.82,{"BABY-BUNDLE":6.18}],["PAN-24","Paracetamol 500mg, 24 tabs",1,9.75,1.8,7.95,{"PCUT-SA01":1.8}],["AMOX-500","Amoxicillin 500mg (Rx)",1,21,0,21,{}]],"trace":[["PCUT-SA01","applied",null],["SUN-3FOR2","applied",null],["BABY-BUNDLE","applied",null],["GP-BEAUTY15","applied",null],["BDAY-BEAUTY","skipped","draft, not published"],["GIFT-POUCH","applied",null],["WKND20","notTriggered","a valid weekend coupon"],["PTS-50OFF","notTriggered","the customer said yes at the till"],["BH-SPEND10","skipped","not for SA"],["NEXT-VISIT","notTriggered","a basket of SAR 300"],["WLCB","notTriggered","a Hayak coupon; a genuine first purchase"],["PRCB-AUG26","skipped","ended 2026-09-04"],["BASE-EARN","applied",null]],"near":[["NEXT-VISIT","add SAR 16.90"]],"awards":[["BASE-EARN",262]],"messages":[["GIFT-POUCH","Scan a travel pouch: it is free with the serum","امسح حقيبة السفر: مجانية مع السيروم"]],"coupons":[]},
  "huda": {"sim":{"flags":{"pointsOffer":true},"profileKey":"huda","basket":[{"sku":"SER-VC","qty":3},{"sku":"AMOX-500","qty":1},{"sku":"GIFT-BAG","qty":1}]},"cur":"SAR","store":"R101","gross":300,"disc":102.05,"net":197.95,"burn":30,"lines":[["SER-VC","Vitamin C serum 30ml",3,267,90.05,176.95,{"GP-BEAUTY15":40.05,"PTS-50OFF":50}],["AMOX-500","Amoxicillin 500mg (Rx)",1,21,0,21,{}],["GIFT-BAG","Travel pouch",1,12,12,0,{"GIFT-POUCH":12}]],"trace":[["PCUT-SA01","notTriggered","nothing left to give (earlier offers took it)"],["SUN-3FOR2","notTriggered","three suncare items"],["BABY-BUNDLE","notTriggered","a pack of diapers"],["GP-BEAUTY15","applied",null],["BDAY-BEAUTY","skipped","draft, not published"],["GIFT-POUCH","applied",null],["WKND20","notTriggered","a valid weekend coupon"],["PTS-50OFF","applied",null],["BH-SPEND10","skipped","not for SA"],["NEXT-VISIT","notTriggered","a basket of SAR 300"],["WLCB","notTriggered","a Hayak coupon; a genuine first purchase"],["PRCB-AUG26","skipped","ended 2026-09-04"],["BASE-EARN","applied",null]],"near":[["SUN-3FOR2","3 more items of sun"],["BABY-BUNDLE","1 more item of diapers"],["NEXT-VISIT","add SAR 102.05"]],"awards":[["BASE-EARN",176]],"messages":[],"coupons":[]},
  "fahad": {"sim":{"profileKey":"fahad","coupon":"HAYAK10","basket":[{"sku":"SHA-400","qty":2},{"sku":"PAN-24","qty":3}]},"cur":"SAR","store":"R101","gross":83.25,"disc":15.4,"net":67.85,"burn":0,"lines":[["SHA-400","Shampoo 400ml",2,54,10,44,{"PCUT-SA01":10}],["PAN-24","Paracetamol 500mg, 24 tabs",3,29.25,5.4,23.85,{"PCUT-SA01":5.4}]],"trace":[["PCUT-SA01","applied",null],["SUN-3FOR2","notTriggered","three suncare items; a basket of SAR 150"],["BABY-BUNDLE","notTriggered","a pack of diapers"],["GP-BEAUTY15","notTriggered","a Gold or Platinum member; a Beauty Care item"],["BDAY-BEAUTY","skipped","draft, not published"],["GIFT-POUCH","notTriggered","a Vitamin C serum"],["WKND20","notTriggered","a valid weekend coupon (code HAYAK10 not found)"],["PTS-50OFF","notTriggered","the customer said yes at the till; a basket of SAR 200 after earlier offers; SAR 30 of points"],["BH-SPEND10","skipped","not for SA"],["NEXT-VISIT","notTriggered","a basket of SAR 300"],["WLCB","applied",null],["PRCB-AUG26","skipped","ended 2026-09-04"],["BASE-EARN","applied",null]],"near":[["SUN-3FOR2","3 more items of sun and add SAR 66.75"],["BABY-BUNDLE","1 more item of diapers"],["GIFT-POUCH","1 more item of serum"],["NEXT-VISIT","add SAR 232.15"]],"awards":[["WLCB",7],["BASE-EARN",67]],"messages":[],"coupons":[]},
  "bahrain": {"sim":{"store":"M01","profileKey":"walkin","basket":[{"sku":"SER-VC","qty":1},{"sku":"SUN-50","qty":1}]},"cur":"BHD","store":"M01","gross":14.444,"disc":1,"net":13.444,"burn":0,"lines":[["SER-VC","Vitamin C serum 30ml",1,8.927,0.618,8.309,{"BH-SPEND10":0.618}],["SUN-50","Sunblock SPF50 50ml",1,5.517,0.382,5.135,{"BH-SPEND10":0.382}]],"trace":[["PCUT-SA01","skipped","not for BH"],["SUN-3FOR2","skipped","not for BH"],["BABY-BUNDLE","skipped","not for BH"],["GP-BEAUTY15","skipped","not for BH"],["BDAY-BEAUTY","skipped","draft, not published"],["GIFT-POUCH","skipped","not for BH"],["WKND20","skipped","not for BH"],["PTS-50OFF","skipped","not for BH"],["BH-SPEND10","applied",null],["NEXT-VISIT","skipped","not for BH"],["WLCB","skipped","not for BH"],["PRCB-AUG26","skipped","ended 2026-09-04"],["BASE-EARN","skipped","not for BH"]],"near":[],"awards":[],"messages":[],"coupons":[]},
  "offline": {"sim":{"offline":true},"cur":"SAR","store":"R101","gross":379.75,"disc":66.8,"net":312.95,"burn":0,"lines":[["SUN-50","Sunblock SPF50 50ml",2,110,0,110,{}],["SUN-30","Sun lotion SPF30 200ml",1,42,42,0,{"SUN-3FOR2":42}],["SER-VC","Vitamin C serum 30ml",1,89,0,89,{}],["DIA-4","Diapers size 4, 52 pcs",1,79,16.82,62.18,{"BABY-BUNDLE":16.82}],["WIP-80","Baby wipes, 80 pcs",2,29,6.18,22.82,{"BABY-BUNDLE":6.18}],["PAN-24","Paracetamol 500mg, 24 tabs",1,9.75,1.8,7.95,{"PCUT-SA01":1.8}],["AMOX-500","Amoxicillin 500mg (Rx)",1,21,0,21,{}]],"trace":[["PCUT-SA01","applied",null],["SUN-3FOR2","applied",null],["BABY-BUNDLE","applied",null],["GP-BEAUTY15","skipped","offline, and this campaign is not offline-safe"],["BDAY-BEAUTY","skipped","draft, not published"],["GIFT-POUCH","applied",null],["WKND20","skipped","offline, and this campaign is not offline-safe"],["PTS-50OFF","skipped","offline, and this campaign is not offline-safe"],["BH-SPEND10","skipped","not for SA"],["NEXT-VISIT","skipped","offline, and this campaign is not offline-safe"],["WLCB","skipped","offline, and this campaign is not offline-safe"],["PRCB-AUG26","skipped","ended 2026-09-04"],["BASE-EARN","skipped","offline, and this campaign is not offline-safe"]],"near":[],"awards":[],"messages":[["GIFT-POUCH","Scan a travel pouch: it is free with the serum","امسح حقيبة السفر: مجانية مع السيروم"]],"coupons":[]},
  "wknd": {"sim":{"coupon":"WKND-4F7K2Q"},"cur":"SAR","store":"R101","gross":379.75,"disc":136.65,"net":243.1,"burn":0,"lines":[["SUN-50","Sunblock SPF50 50ml",2,110,30.76,79.24,{"GP-BEAUTY15":16.5,"WKND20":14.26}],["SUN-30","Sun lotion SPF30 200ml",1,42,42,0,{"SUN-3FOR2":42}],["SER-VC","Vitamin C serum 30ml",1,89,24.91,64.09,{"GP-BEAUTY15":13.35,"WKND20":11.56}],["DIA-4","Diapers size 4, 52 pcs",1,79,26.31,52.69,{"BABY-BUNDLE":16.82,"WKND20":9.49}],["WIP-80","Baby wipes, 80 pcs",2,29,9.66,19.34,{"BABY-BUNDLE":6.18,"WKND20":3.48}],["PAN-24","Paracetamol 500mg, 24 tabs",1,9.75,3.01,6.74,{"PCUT-SA01":1.8,"WKND20":1.21}],["AMOX-500","Amoxicillin 500mg (Rx)",1,21,0,21,{}]],"trace":[["PCUT-SA01","applied",null],["SUN-3FOR2","applied",null],["BABY-BUNDLE","applied",null],["GP-BEAUTY15","applied",null],["BDAY-BEAUTY","skipped","draft, not published"],["GIFT-POUCH","applied",null],["WKND20","applied",null],["PTS-50OFF","lost","\"Basket offers\" takes the first campaign that applies: WKND20"],["BH-SPEND10","skipped","not for SA"],["NEXT-VISIT","notTriggered","a basket of SAR 300"],["WLCB","notTriggered","a Hayak coupon; a genuine first purchase"],["PRCB-AUG26","skipped","ended 2026-09-04"],["BASE-EARN","applied",null]],"near":[["NEXT-VISIT","add SAR 56.90"]],"awards":[["BASE-EARN",222]],"messages":[["GIFT-POUCH","Scan a travel pouch: it is free with the serum","امسح حقيبة السفر: مجانية مع السيروم"]],"coupons":[]},
}

const byCode = new Map(CAMPAIGNS.map((c) => [c.code, c]))
const FREE_UNIT = new Set(['SUN-3FOR2', 'GIFT-POUCH'])
const OUTCOME = { applied: 'applied', notTriggered: 'notMet', skipped: 'skipped', suppressed: 'budget', lost: 'lost' }
const signature = (basket) => basket.map((l) => `${l.sku}:${l.qty}`).sort().join(',')

/** A campaign's receipt label: its first effect that has one; else its name. */
function labelOf(code) {
  const c = byCode.get(code)
  for (const r of c?.rules ?? []) for (const e of r.then) if (e.label?.en) return e.label
  return c?.name ?? { en: code, ar: '' }
}

const effect = (code, kind, line, o = {}) => ({
  campaignId: code, code, kind, line, amount: null, quantity: null, points: null, label: null, coupon: null, ...o,
})

/** The trace of one campaign: its rules and their top-level conditions, met or not by the reason. */
function traceOf([code, status, reason]) {
  const c = byCode.get(code)
  const outcome = OUTCOME[status]
  return {
    campaignId: c?.id ?? code,
    code,
    name: c?.name ?? { en: code, ar: '' },
    outcome,
    reason: outcome === 'skipped' || outcome === 'budget' ? reason : null,
    group: GROUPS[code] ?? null,
    lostTo: null,
    rules: (c?.rules ?? []).map((r) => ({
      ruleId: r.id,
      name: r.name,
      ran: outcome !== 'skipped',
      conditions: r.when.items.map((k) => ({
        conditionId: k.id,
        says: k.says,
        met: outcome === 'applied' || !(reason ?? '').includes(k.says.en),
      })),
    })),
  }
}

function nearOf([code, text]) {
  const items = /^(\d+) more items? of (\S+)/.exec(text)
  const money = /add [A-Z]{3} ([\d.]+)/.exec(text)
  const gap = items ? { kind: 'items', count: Number(items[1]), of: items[2] } : { kind: 'money', amount: Number(money[1]) }
  return { campaignId: byCode.get(code)?.id ?? code, code, gap, offer: labelOf(code) }
}

function fromRaw(raw) {
  const [currency, engine] = STORES[raw.store]
  const effects = []
  raw.lines.forEach(([, , , , , , by], i) => {
    for (const [code, off] of Object.entries(by)) {
      effects.push(FREE_UNIT.has(code)
        ? effect(code, 'freeUnit', i + 1, { quantity: 1, amount: off, label: labelOf(code) })
        : effect(code, 'discount', i + 1, { amount: off, label: labelOf(code) }))
    }
  })
  for (const [code, points] of raw.awards) effects.push(effect(code, 'points', null, { points }))
  if (raw.burn > 0) effects.push(effect('PTS-50OFF', 'pointsTaken', null, { amount: raw.burn }))
  for (const [code, en, ar] of raw.messages) effects.push(effect(code, 'message', null, { label: { en, ar } }))
  return {
    currency,
    engine,
    lines: raw.lines.map(([sku, name, qty, gross, discount, net], i) => ({ line: i + 1, sku, name, qty, gross, discount, net })),
    totals: { gross: raw.gross, discount: raw.disc, net: raw.net },
    effects,
    trace: raw.trace.map(traceOf),
    nearMisses: raw.near.map(nearOf),
  }
}

/** The six baskets by their store and lines (the offline and coupon runs share the default basket). */
const DEFAULT_BASKET = [
  { sku: 'SUN-50', qty: 2 }, { sku: 'SUN-30', qty: 1 }, { sku: 'SER-VC', qty: 1 }, { sku: 'DIA-4', qty: 1 },
  { sku: 'WIP-80', qty: 2 }, { sku: 'PAN-24', qty: 1 }, { sku: 'AMOX-500', qty: 1 },
]
const basketOf = (k) => RAW[k].sim.basket ?? DEFAULT_BASKET
const storeOf = (k) => RAW[k].sim.store ?? RAW[k].store
const SCENARIOS = new Map(['default', 'huda', 'fahad', 'bahrain'].map((k) => [`${storeOf(k)}|${signature(basketOf(k))}`, k]))
export const SIX_BASKETS = Object.fromEntries(Object.keys(RAW).map((k) => [k, { store: storeOf(k), basket: basketOf(k) }]))

/** What the stubbed dry run answers for a request body. */
export function simulate(body) {
  const known = SCENARIOS.get(`${body.store}|${signature(body.basket)}`)
  if (known) return fromRaw(RAW[known])
  const [currency, engine] = STORES[body.store] ?? ['SAR', 'Rule']
  const lines = body.basket.map((l, i) => {
    const [name, price] = CATALOG[l.sku] ?? [l.sku, 0]
    const gross = Math.round(price * l.qty * 100) / 100
    return { line: i + 1, sku: l.sku, name, qty: l.qty, gross, discount: 0, net: gross }
  })
  const gross = Math.round(lines.reduce((s, l) => s + l.gross, 0) * 100) / 100
  const effects =
    engine === 'Rule' && gross >= 300 ? [effect('NEXT-VISIT', 'createCoupon', null, { coupon: 'WKND20', label: labelOf('NEXT-VISIT') })] : []
  return { currency, engine, lines, totals: { gross, discount: 0, net: gross }, effects, trace: [], nearMisses: [] }
}
