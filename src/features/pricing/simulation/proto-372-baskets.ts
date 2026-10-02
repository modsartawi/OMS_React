import type {
  AppliedBonusBuy,
  SimulationResult,
  SimulationResultCondition,
  SimulationResultItem,
} from '@/core/models/simulation'
import { PAYLOADS } from './__fixtures__/payloads'

/* PROTOTYPE 372 — the baskets the stub serves for Pricing/Simulate.
 *
 * Five are the REAL 098 captures. Two are FICTIONAL, built to the captured shapes,
 * because the corpus has neither:
 *   many   — 12 lines (098: every real basket is 1–3 lines), incl. a big-ticket line,
 *            a zero-VAT line, a W line, two promotions and a manual condition.
 *   buyget — a pure BUY line (a zero-value `isPrerequisite` row — the shape taxonomy
 *            040 says `BbyProcess` stamps, but NO capture shows one), its GET line,
 *            and a buy+get set-price line.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

type Row = Partial<SimulationResultCondition> & Pick<SimulationResultCondition, 'stepNumber' | 'conditionType' | 'description' | 'conditionValue'>

function cond(r: Row): SimulationResultCondition {
  return {
    conditionCounter: 0,
    conditionRate: 0,
    conditionRateUnit: '',
    conditionBaseValue: 0,
    isStatistics: false,
    conditionOrigin: 'A',
    isBonusBuy: false,
    bbyNumber: null,
    isPrerequisite: false,
    isCondition: false,
    conditionKey: null,
    ...r,
  }
}

function line(
  n: number,
  material: string,
  desc: string,
  qty: number,
  unit: number,
  discounts: Row[] = [],
  vat = 15,
): SimulationResultItem {
  const gross = r2(qty * unit)
  const ds = discounts.map(cond)
  const promo = r2(ds.filter((d) => d.conditionOrigin !== 'M').reduce((s, d) => s + d.conditionValue, 0))
  const manual = r2(ds.filter((d) => d.conditionOrigin === 'M').reduce((s, d) => s + d.conditionValue, 0))
  const net = r2(gross + promo + manual)
  const tax = r2((net * vat) / 100)
  return {
    itemNumber: n,
    materialNumber: material,
    materialDescription: desc,
    quantity: qty,
    unitOfMeasure: 'EA',
    netPrice: unit,
    netValue: net,
    taxValue: tax,
    grossValue: gross,
    netTotal: r2(net + tax),
    salesDiscount: 0,
    promotionDiscount: r2(promo + manual),
    pricingStatus: '',
    pricingStatusMessages: [],
    conditions: [
      cond({ stepNumber: 5, conditionType: 'VKP0', description: 'Basic Price', conditionRate: unit, conditionRateUnit: 'SAR', conditionBaseValue: qty, conditionValue: gross }),
      ...ds,
      cond({ stepNumber: 140, conditionType: 'MWST', description: 'Vat %', conditionRate: vat, conditionBaseValue: net, conditionValue: tax }),
    ],
  }
}

const pct2nd = (bby: string, base: number, counters: number[], key: string): Row[] =>
  counters.map((c) => ({
    stepNumber: 118, conditionCounter: c, conditionType: 'ZB03', description: '70% 2nd PCS', conditionRate: -35, conditionRateUnit: '%',
    conditionBaseValue: base, conditionValue: r2(-base * 0.35), conditionOrigin: 'B', isBonusBuy: true, bbyNumber: bby, isCondition: true, conditionKey: key,
  }))

function result(items: SimulationResultItem[], applied: AppliedBonusBuy[]): SimulationResult {
  const priced = items.filter((i) => i.pricingStatus !== 'W')
  const s = (k: 'netValue' | 'taxValue' | 'grossValue' | 'netTotal' | 'promotionDiscount') => r2(priced.reduce((a, i) => a + i[k], 0))
  return {
    header: {
      currency: 'SAR', netValue: s('netValue'), taxValue: s('taxValue'), grossValue: s('grossValue'), netTotal: s('netTotal'),
      totalDiscount: s('promotionDiscount'), salesDiscount: 0, promotionDiscount: s('promotionDiscount'), headerDiscount: 0, receivableValue: s('netTotal'), payment: 0,
    },
    items,
    appliedBonusBuys: applied,
    potentialBonusBuys: [],
  }
}

function wLine(n: number): SimulationResultItem {
  return {
    ...line(n, 'COUP01', 'COUPON 10 SAR', 1, 0),
    netPrice: 0, netValue: 0, taxValue: 0, grossValue: 0, netTotal: 0,
    pricingStatus: 'W',
    pricingStatusMessages: ["[070] Mandatory condition 'VKP0' is missing at step 5"],
    conditions: [cond({ stepNumber: 140, conditionType: 'MWST', description: 'Vat %', conditionValue: 0 })],
  }
}

const MANY = (() => {
  const items = [
    line(10, '200706', 'PANADOL EXTRA 24 TAB', 2, 91.26, pct2nd('000100000131', 91.26, [1, 2], 'K131-1')),
    line(20, '200382', 'CETAPHIL GENTLE CLEANSER 236ML', 1, 31.26),
    line(30, '200710', 'CENTRUM ADVANCE 60 TAB', 2, 59, pct2nd('000100000131', 59, [3, 4], 'K131-2')),
    line(40, '310045', 'OMRON M3 BLOOD PRESSURE MONITOR', 1, 1249),
    line(50, '200511', 'AUGMENTIN 1G 14 TAB', 1, 38.5, [], 0),
    line(60, '200388', 'NIVEA SOFT 200ML', 2, 14.98, [
      { stepNumber: 119, conditionCounter: 1, conditionType: 'ZB01', description: '2 PC for 25 SR', conditionRate: -2.48, conditionRateUnit: 'SAR', conditionBaseValue: 14.98, conditionValue: -2.48, conditionOrigin: 'B', isBonusBuy: true, bbyNumber: '000100000132', isPrerequisite: true, isCondition: true, conditionKey: 'K132-1' },
      { stepNumber: 119, conditionCounter: 2, conditionType: 'ZB01', description: '2 PC for 25 SR', conditionRate: -2.48, conditionRateUnit: 'SAR', conditionBaseValue: 14.98, conditionValue: -2.48, conditionOrigin: 'B', isBonusBuy: true, bbyNumber: '000100000132', isPrerequisite: true, isCondition: true, conditionKey: 'K132-1' },
    ]),
    wLine(70),
    line(80, '200402', 'BEPANTHEN CREAM 30G', 1, 27.75, [
      { stepNumber: 119, conditionType: 'ZB01', description: 'Bby Price', conditionRate: -10, conditionRateUnit: '%', conditionBaseValue: 27.75, conditionValue: -2.78, conditionOrigin: 'M' },
    ]),
    line(90, '200455', 'VOLTAREN EMULGEL 100G', 1, 46.9),
    line(100, '200460', 'SENSODYNE REPAIR 75ML', 3, 21.5),
    line(110, '200470', 'BEPANTHEN BABY 100G', 1, 52.25),
    line(120, '200480', 'LISTERINE COOL MINT 500ML', 1, 24.95),
  ]
  const applied: AppliedBonusBuy[] = [
    { bbyNumber: '000100000131', promoNumber: '0001000040', offerId: '', description: '70% 2nd PCS', discountType: 'ZB03', discountKind: '%', totalDiscountValue: r2(items[0].promotionDiscount + items[2].promotionDiscount), affectedItemNumbers: [10, 30], remainingUsage: 0,
      applications: [{ conditionKey: 'K131-1', buyItemNumbers: [], getItemNumbers: [10] }, { conditionKey: 'K131-2', buyItemNumbers: [], getItemNumbers: [30] }] },
    { bbyNumber: '000100000132', promoNumber: '0001000041', offerId: '', description: '2 PC for 25 SR', discountType: 'ZB01', discountKind: 'P', totalDiscountValue: items[5].promotionDiscount, affectedItemNumbers: [60], remainingUsage: 0,
      applications: [{ conditionKey: 'K132-1', buyItemNumbers: [60], getItemNumbers: [60] }] },
  ]
  return result(items, applied)
})()

const BUYGET = (() => {
  const items = [
    // The pure BUY line: it qualifies the promotion and carries a zero-value prerequisite row.
    line(10, '200710', 'CENTRUM ADVANCE 60 TAB', 1, 89, [
      { stepNumber: 117, conditionType: 'ZB02', description: 'Buy Centrum, 10 SR off lip care', conditionRate: 0, conditionRateUnit: 'SAR', conditionBaseValue: 89, conditionValue: 0, conditionOrigin: 'B', isBonusBuy: true, bbyNumber: '000100000140', isPrerequisite: true, isCondition: false, conditionKey: 'K140-1' },
    ]),
    // Its GET line: the reward lands here.
    line(20, '200720', 'BLISTEX LIP MEDEX 7G', 1, 15, [
      { stepNumber: 117, conditionType: 'ZB02', description: 'Buy Centrum, 10 SR off lip care', conditionRate: -10, conditionRateUnit: 'SAR', conditionBaseValue: 15, conditionValue: -10, conditionOrigin: 'B', isBonusBuy: true, bbyNumber: '000100000140', isPrerequisite: false, isCondition: true, conditionKey: 'K140-1' },
    ]),
    // buy+get: a set price discounts the very line that qualifies it.
    line(30, '200706', 'PANADOL EXTRA 24 TAB', 2, 14.5, [
      { stepNumber: 119, conditionCounter: 1, conditionType: 'ZB01', description: '2 PC for 25 SR', conditionRate: -2, conditionRateUnit: 'SAR', conditionBaseValue: 14.5, conditionValue: -2, conditionOrigin: 'B', isBonusBuy: true, bbyNumber: '000100000141', isPrerequisite: true, isCondition: true, conditionKey: 'K141-1' },
      { stepNumber: 119, conditionCounter: 2, conditionType: 'ZB01', description: '2 PC for 25 SR', conditionRate: -2, conditionRateUnit: 'SAR', conditionBaseValue: 14.5, conditionValue: -2, conditionOrigin: 'B', isBonusBuy: true, bbyNumber: '000100000141', isPrerequisite: true, isCondition: true, conditionKey: 'K141-1' },
    ]),
  ]
  const applied: AppliedBonusBuy[] = [
    { bbyNumber: '000100000140', promoNumber: '0001000050', offerId: '', description: 'Buy Centrum, 10 SR off lip care', discountType: 'ZB02', discountKind: 'R', totalDiscountValue: -10, affectedItemNumbers: [10, 20], remainingUsage: 4,
      applications: [{ conditionKey: 'K140-1', buyItemNumbers: [10], getItemNumbers: [20] }] },
    { bbyNumber: '000100000141', promoNumber: '0001000051', offerId: '', description: '2 PC for 25 SR', discountType: 'ZB01', discountKind: 'P', totalDiscountValue: -4, affectedItemNumbers: [30], remainingUsage: 0,
      applications: [{ conditionKey: 'K141-1', buyItemNumbers: [30], getItemNumbers: [30] }] },
  ]
  return result(items, applied)
})()

export const PROTO_BASKETS: Record<string, { label: string; result: SimulationResult }> = {
  '06': { label: '06 manual + 2 promos', result: PAYLOADS['manual-conditions'] },
  '05': { label: '05 bby on 2 lines', result: PAYLOADS['pricing-elements'] },
  '02': { label: '02 fired', result: PAYLOADS['fired-bonus-buy'] },
  '01': { label: '01 plain ×3', result: PAYLOADS['plain-multiline'] },
  '04b': { label: '04b W line', result: PAYLOADS['no-price'] },
  many: { label: '12 lines (fictional)', result: MANY },
  buyget: { label: 'buy→get (fictional)', result: BUYGET },
}
