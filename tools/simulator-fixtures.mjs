// Simulator stubs (spec 2737; ticket 514 built them, ticket 525 re-cut them to the REAL shapes): the
// reply of `POST Rules/Authoring/Simulate` (BackOffice 2758, the brief's "Doors" and "The `evaluate`
// reply"; `RuleBuilderService.SimulateAsync`), served at the Playwright route layer by
// tools/simulator-drive.mjs inside the real envelope.
//
// The six baskets are the prototype's (BackOffice `.scratch/proto/2734-rule-builder/smoke-engine.js`),
// with the prototype engine's own answers on them (which campaign took what off which line, the
// trace, near misses, points, the cashier prompt), written here in HQ's shape: `{ basedOnVersion,
// campaign, at, lines: [{ lineNumber, article, quantity, net, discount, netAfter, effects }], reply }`,
// the effects PER UNIT (a rule's units sum exactly, the residual on the first unit of the line), the
// trace with HQ's status and code words. A basket is matched by its store and its lines (article and
// quantity); any other basket gets no effect, except that a basket of 300 earns NEXT-VISIT's coupon —
// so the drive can see "will create".
//
// The request is read as HQ reads it: `campaign` and `draft` together are RULES_BAD_REQUEST; lines and
// a csv together, or a csv HQ cannot read, are RULES_BAD_BASKET by file line (`BasketCsv`'s rules and
// messages); a line number twice is RULES_DUPLICATE_LINE; an unknown draft is 404
// RULES_DRAFT_NOT_FOUND.
import { CAMPAIGNS, LIVE_VERSION } from './campaigns-fixtures.mjs'

const says = (en, ar) => ({ en, ar })

/** The prototype's sample order's groups (campaigns-fixtures.mjs `TREE`). */
const GROUP = { 'SUN-3FOR2': 'g-items', 'BABY-BUNDLE': 'g-items', WKND20: 'g-basket', 'PTS-50OFF': 'g-basket' }

/** The prototype's catalog prices (engine.js CATALOG), SAR, and the category each sells under. */
export const CATALOG = {
  'SUN-50': [55, 'A002'], 'SUN-30': [42, 'A002'], 'SUN-KID': [38.5, 'A002'], 'SER-VC': [89, 'A002'], 'DIA-4': [79, 'A003'],
  'WIP-80': [14.5, 'A003'], 'PAN-24': [9.75, 'A001'], 'AMOX-500': [21, 'A006'], 'SHA-400': [27, 'A005'], 'SHA-DAN': [32, 'A005'],
  'SHA-ARG': [38, 'A005'], 'BAL-400': [29, 'A005'], 'BAL-ARG': [36, 'A005'], 'MIL-1': [68, 'A008'], 'GIFT-BAG': [12, 'A002'], 'FEE-DLV': [15, 'A007'],
}

/** Each campaign's unit effect, as the engine names it. */
const EFFECT = {
  'PCUT-SA01': 'discountPerItem', 'SUN-3FOR2': 'freeUnits', 'BABY-BUNDLE': 'bundlePrice', 'GP-BEAUTY15': 'discountItems',
  'GIFT-POUCH': 'freeProduct', WKND20: 'discountSession', 'PTS-50OFF': 'discountSession', 'BH-SPEND10': 'discountSession',
}
const FREE = new Set(['freeUnits', 'freeProduct'])

/** HQ's reason per trace code, in both languages (the English is the prototype's own words). */
const CODE_AR = {
  notMet: 'لم تتحقق شروطها', nothingLeft: 'لم يبقَ ما تعطيه', lostToGroup: 'خسرت في مجموعتها', window: 'خارج تواريخها',
  audience: 'ليست لجمهور هذا البيع', refused: 'رُفضت',
}

// The prototype engine's answers, compacted: lines [sku, qty, net, {code: off}], trace [code, status,
// reason], near [code, text], awards [code, points], prompts [code], refused [coupon].
const RAW = {
  default: {
    store: 'R101', cur: 'SAR', burn: 0,
    lines: [['SUN-50', 2, 110, { 'GP-BEAUTY15': 16.5 }], ['SUN-30', 1, 42, { 'SUN-3FOR2': 42 }], ['SER-VC', 1, 89, { 'GP-BEAUTY15': 13.35 }], ['DIA-4', 1, 79, { 'BABY-BUNDLE': 16.82 }], ['WIP-80', 2, 29, { 'BABY-BUNDLE': 6.18 }], ['PAN-24', 1, 9.75, { 'PCUT-SA01': 1.8 }], ['AMOX-500', 1, 21, {}]],
    trace: [['PCUT-SA01', 'applied'], ['SUN-3FOR2', 'applied'], ['BABY-BUNDLE', 'applied'], ['GP-BEAUTY15', 'applied'], ['GIFT-POUCH', 'applied'], ['WKND20', 'notTriggered', 'notMet', 'a valid weekend coupon'], ['PTS-50OFF', 'notTriggered', 'notMet', 'the member said yes at the till'], ['BH-SPEND10', 'skipped', 'audience', 'not for SA'], ['NEXT-VISIT', 'notTriggered', 'notMet', 'a basket of SAR 300'], ['WLCB', 'notTriggered', 'notMet', 'a Hayak coupon; a genuine first purchase'], ['PRCB-AUG26', 'skipped', 'window', 'ended 2026-09-04'], ['BASE-EARN', 'applied']],
    near: [['NEXT-VISIT', 'add SAR 16.90']], awards: [['BASE-EARN', 262]], prompts: ['GIFT-POUCH'], offers: ['PTS-50OFF'], refused: [],
  },
  huda: {
    store: 'R101', cur: 'SAR', burn: 30,
    lines: [['SER-VC', 3, 267, { 'GP-BEAUTY15': 40.05, 'PTS-50OFF': 50 }], ['AMOX-500', 1, 21, {}], ['GIFT-BAG', 1, 12, { 'GIFT-POUCH': 12 }]],
    trace: [['PCUT-SA01', 'notTriggered', 'nothingLeft', 'nothing left to give (earlier offers took it)'], ['SUN-3FOR2', 'notTriggered', 'notMet', 'three suncare items'], ['BABY-BUNDLE', 'notTriggered', 'notMet', 'a pack of diapers'], ['GP-BEAUTY15', 'applied'], ['GIFT-POUCH', 'applied'], ['WKND20', 'notTriggered', 'notMet', 'a valid weekend coupon'], ['PTS-50OFF', 'applied'], ['BH-SPEND10', 'skipped', 'audience', 'not for SA'], ['NEXT-VISIT', 'notTriggered', 'notMet', 'a basket of SAR 300'], ['WLCB', 'notTriggered', 'notMet', 'a Hayak coupon; a genuine first purchase'], ['PRCB-AUG26', 'skipped', 'window', 'ended 2026-09-04'], ['BASE-EARN', 'applied']],
    near: [['SUN-3FOR2', '3 more items of sun'], ['BABY-BUNDLE', '1 more item of diapers'], ['NEXT-VISIT', 'add SAR 102.05']], awards: [['BASE-EARN', 176]], prompts: [], offers: [], refused: [],
  },
  fahad: {
    store: 'R101', cur: 'SAR', burn: 0,
    lines: [['SHA-400', 2, 54, { 'PCUT-SA01': 10 }], ['PAN-24', 3, 29.25, { 'PCUT-SA01': 5.4 }]],
    trace: [['PCUT-SA01', 'applied'], ['SUN-3FOR2', 'notTriggered', 'notMet', 'three suncare items; a basket of SAR 150'], ['BABY-BUNDLE', 'notTriggered', 'notMet', 'a pack of diapers'], ['GP-BEAUTY15', 'notTriggered', 'notMet', 'a Gold or Platinum member; a Beauty Care item'], ['GIFT-POUCH', 'notTriggered', 'notMet', 'a Vitamin C serum'], ['WKND20', 'notTriggered', 'refused', 'a valid weekend coupon (code HAYAK10 not found)'], ['PTS-50OFF', 'lost', 'lostToGroup', '"Basket offers" takes the first campaign that applies'], ['BH-SPEND10', 'skipped', 'audience', 'not for SA'], ['NEXT-VISIT', 'notTriggered', 'notMet', 'a basket of SAR 300'], ['WLCB', 'applied'], ['PRCB-AUG26', 'skipped', 'window', 'ended 2026-09-04'], ['BASE-EARN', 'applied']],
    near: [['SUN-3FOR2', '3 more items of sun and add SAR 66.75'], ['BABY-BUNDLE', '1 more item of diapers'], ['GIFT-POUCH', '1 more item of serum'], ['NEXT-VISIT', 'add SAR 232.15']], awards: [['WLCB', 7], ['BASE-EARN', 67]], prompts: [], offers: [], refused: ['HAYAK10'],
  },
  bahrain: {
    store: 'M01', cur: 'BHD', burn: 0,
    lines: [['SER-VC', 1, 8.927, { 'BH-SPEND10': 0.618 }], ['SUN-50', 1, 5.517, { 'BH-SPEND10': 0.382 }]],
    trace: [['PCUT-SA01', 'skipped', 'audience', 'not for BH'], ['SUN-3FOR2', 'skipped', 'audience', 'not for BH'], ['BABY-BUNDLE', 'skipped', 'audience', 'not for BH'], ['GP-BEAUTY15', 'skipped', 'audience', 'not for BH'], ['GIFT-POUCH', 'skipped', 'audience', 'not for BH'], ['WKND20', 'skipped', 'audience', 'not for BH'], ['PTS-50OFF', 'skipped', 'audience', 'not for BH'], ['BH-SPEND10', 'applied'], ['NEXT-VISIT', 'skipped', 'audience', 'not for BH'], ['WLCB', 'skipped', 'audience', 'not for BH'], ['PRCB-AUG26', 'skipped', 'window', 'ended 2026-09-04'], ['BASE-EARN', 'skipped', 'audience', 'not for BH']],
    near: [], awards: [], prompts: [], offers: [], refused: [],
  },
}

const byCode = new Map(CAMPAIGNS.map((c) => [c.code, c]))
const rule0 = (code) => byCode.get(code)?.campaign.rules?.[0]
const signature = (lines) => lines.map((l) => `${l.article}:${l.quantity}`).sort().join(',')
const round = (n, d) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d

/** A campaign's receipt label: its first effect that has one. */
function labelOf(code) {
  for (const r of byCode.get(code)?.campaign.rules ?? []) for (const e of r.then) if (e.label) return e.label
  return null
}

/** A line's money for one campaign, PER UNIT: a free effect is one unit at its whole worth; a
 *  discount is shared over the units, the residual on the first. */
function unitsOf(code, lineNumber, quantity, off, d) {
  const effect = EFFECT[code] ?? 'discountItems'
  const base = { campaign: code, rule: rule0(code)?.id ?? 'r1', effect, line: lineNumber, label: labelOf(code), freeGoods: FREE.has(effect) }
  if (FREE.has(effect)) return [{ ...base, unit: 0, amount: off }]
  const each = Math.floor((off / quantity) * 10 ** d) / 10 ** d
  return Array.from({ length: quantity }, (_, u) => ({ ...base, unit: u, amount: u === 0 ? round(off - each * (quantity - 1), d) : each }))
}

/** A near miss's gaps from the prototype's words: items of a filter, and money to add. */
function nearOf([code, text], currency) {
  const when = rule0(code)?.when ?? []
  const at = (check) => Math.max(0, when.findIndex((k) => k.check === check))
  const gaps = []
  const items = /(\d+) more items? of (\S+)/.exec(text)
  if (items) {
    const i = at('minCount')
    gaps.push({ check: 'minCount', path: `campaign.rules[0].when[${i}]`, amount: Number(items[1]), unit: 'items', currency: null, text: says(`add ${items[1]} of ${items[2]}`, `أضف ${items[1]} من ${items[2]}`), says: when[i]?.says ?? null })
  }
  const money = /add [A-Z]{3} ([\d.]+)/.exec(text)
  if (money) {
    const i = at('minSubtotal')
    gaps.push({ check: 'minSubtotal', path: `campaign.rules[0].when[${i}]`, amount: Number(money[1]), unit: 'money', currency, text: says(`add ${currency} ${money[1]}`, `أضف ${money[1]} ${currency}`), says: when[i]?.says ?? null })
  }
  const label = labelOf(code) ?? byCode.get(code)?.name
  return { campaign: code, rule: rule0(code)?.id ?? 'r1', text: says(`${text} for ${label.en}`, label.ar), gaps }
}

const points = (campaign, effect, amount, o = {}) => ({
  campaign, rule: rule0(campaign)?.id ?? 'r1', effect, amount, desired: amount, tierAmount: 0, unit: 'PTS', activity: campaign, activates: null, expires: null, tender: false, value: 0, ...o,
})

const emptyReply = (currency, decimals) => ({
  rulesetVersion: LIVE_VERSION, currency, decimals, effects: [], points: [], nearMisses: [], refusals: [], trace: [], prompts: [], messages: [], offers: [], member: null, wallet: null, createdCoupons: [],
})

/** HQ's answer to a matched basket: the prototype's figures in HQ's shape. */
function fromRaw(raw, lines, body) {
  const d = body.decimals
  const reply = emptyReply(body.currency, d)
  const byArticle = new Map(raw.lines.map((l) => [l[0], l]))
  for (const l of lines) for (const [code, off] of Object.entries(byArticle.get(l.article)?.[3] ?? {})) reply.effects.push(...unitsOf(code, l.lineNumber, l.quantity, off, d))
  const money = (code) => round(reply.effects.filter((e) => e.campaign === code).reduce((s, e) => s + e.amount, 0), d)
  reply.trace = raw.trace.map(([campaign, status, code = null, reason = null]) => ({
    campaign, group: GROUP[campaign] ?? null, status, code, money: status === 'applied' ? money(campaign) : 0, reason: reason ? says(reason, CODE_AR[code] ?? '') : null,
  }))
  reply.nearMisses = raw.near.map((n) => nearOf(n, body.currency))
  reply.points = raw.awards.map(([code, n]) => points(code, 'awardPoints', n))
  if (raw.burn > 0) reply.points.push(points('PTS-50OFF', 'burnPoints', raw.burn, { unit: 'SAR', tender: true, value: raw.burn }))
  reply.prompts = raw.prompts.map((code) => {
    const e = rule0(code).then.find((x) => x.prompt)
    return { campaign: code, rule: rule0(code).id, articles: ['GIFT-BAG'], count: e.count ?? 1, text: e.prompt }
  })
  reply.offers = raw.offers
    .filter((code) => !body.flags?.includes(code))
    .map((code) => ({ campaign: code, rule: rule0(code).id, flag: code, text: says('Pay 30 points for SAR 50 off?', 'ادفع 30 نقطة مقابل خصم 50 ريال؟') }))
  reply.refusals = raw.refused
    .filter((c) => body.coupons?.includes(c))
    .map((c) => ({ code: 'RULES_COUPON_NOT_VALID', campaign: null, rule: null, budget: null, reason: says(`The coupon ${c} is not valid.`, `القسيمة ${c} غير صالحة.`) }))
  return reply
}

/** A refusal in SIS.Api's envelope terms: the first error is the refusal, every further one a detail
 *  under the same code. */
const refused = (code, message, details = [], status = 400) => ({ refused: code, message, details, status })

/** `RuleBuilderService.BasketCsv`, ported: the cart lines of a CSV, or every bad line by its file line. */
export function basketCsv(csv) {
  const rows = csv.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n').map((t, i) => ({ text: t.trim(), line: i + 1 })).filter((r) => r.text)
  if (rows.length < 2) return refused('RULES_BAD_BASKET', 'A basket CSV is a header line (article,quantity,net,...) and at least one cart line.')
  const header = rows[0].text.split(',').map((h) => h.trim().toLowerCase())
  const col = (...n) => header.findIndex((h) => n.includes(h))
  const [article, quantity, net, lineNo, unit, gross, vat, category, fee] = [
    col('article', 'material', 'sku'), col('quantity', 'qty'), col('net'), col('line', 'linenumber'), col('unit'), col('gross'), col('vatrate', 'vat'), col('category'), col('fee'),
  ]
  if (article < 0 || quantity < 0 || net < 0)
    return refused('RULES_BAD_BASKET', "A basket CSV's header names article, quantity and net (and optionally line, unit, gross, vatRate, category, fee).")
  const errors = []
  const lines = []
  for (const { text, line } of rows.slice(1)) {
    const cells = text.split(',').map((c) => c.trim())
    const cell = (i) => (i >= 0 && i < cells.length ? cells[i] : '')
    const num = (i, what, otherwise) => {
      if (cell(i) === '' && otherwise !== undefined) return otherwise
      const m = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)([+-]?)$/.exec(cell(i))
      if (m && !(m[1] && m[3])) return Number(`${m[1] || m[3]}${m[2]}`)
      errors.push(`line ${line}: ${what} is a number, not '${cell(i)}'`)
      return null
    }
    const before = errors.length
    if (!cell(article)) errors.push(`line ${line}: the article is required`)
    const qty = num(quantity, 'quantity')
    if (qty !== null && qty <= 0) errors.push(`line ${line}: the quantity is more than 0`)
    const lineNet = num(net, 'net')
    const lineGross = num(gross, 'gross', lineNet ?? 0)
    const rate = num(vat, 'vatRate', 0)
    const n = num(lineNo, 'line', lines.length + 1)
    if (n !== null && (!Number.isInteger(n) || n < 1)) errors.push(`line ${line}: the line number is a whole number from 1`)
    const f = cell(fee).toLowerCase()
    if (f && !['true', 'false', '1', '0'].includes(f)) errors.push(`line ${line}: fee is true or false`)
    if (errors.length > before) continue
    lines.push({ lineNumber: n, article: cell(article), quantity: qty, unit: cell(unit) || 'EA', baseUnitQuantity: qty, gross: lineGross, netBeforePromotion: lineNet, vatRate: rate, category: cell(category), fee: f === 'true' || f === '1', attributes: {} })
  }
  return errors.length ? refused('RULES_BAD_BASKET', 'The basket CSV is refused.', errors) : { lines }
}

/** The six baskets by their store and lines. */
const KEYS = new Map(Object.entries(RAW).map(([k, r]) => [`${r.store}|${signature(r.lines.map(([article, quantity]) => ({ article, quantity })))}`, k]))
export const SIX_BASKETS = Object.fromEntries(Object.entries(RAW).map(([k, r]) => [k, { store: r.store, lines: r.lines.map(([sku, qty, net]) => ({ sku, qty, net })) }]))

/**
 * What the stubbed dry run answers for a request body: `{ sim }` or a refusal `{ refused, message,
 * details, status }`. `invalid` names drafts the checker refuses, with the lines it refuses them by.
 */
export function simulate(body, { invalid = {} } = {}) {
  if (body.campaign && body.draft) return refused('RULES_BAD_REQUEST', "Simulate the builder's campaign or a saved draft, not both.")
  let lines = body.lines ?? []
  if (body.csv) {
    if (lines.length) return refused('RULES_BAD_BASKET', 'Send the basket as lines or as a CSV upload, not both.')
    const read = basketCsv(body.csv)
    if (read.refused) return read
    lines = read.lines
  }
  if (body.decimals !== 2 && body.decimals !== 3) return refused('RULES_BAD_DECIMALS', `A currency has 2 or 3 decimals, not ${body.decimals}.`)
  const twice = lines.find((l, i) => lines.findIndex((m) => m.lineNumber === l.lineNumber) !== i)
  if (twice) return refused('RULES_DUPLICATE_LINE', `Line number ${twice.lineNumber} is in the cart twice; every effect is keyed by it.`)
  if (body.draft) {
    const d = byCode.get(body.draft)
    if (!d || d.source !== 'draft') return refused('RULES_DRAFT_NOT_FOUND', `Campaign ${body.draft} has no draft.`, [], 404)
    if (invalid[body.draft]) return refused('RULES_INVALID_CAMPAIGN', "The campaign is refused by the rule engine's checker: fix it before simulating.", invalid[body.draft])
  }

  const d = body.decimals
  const key = KEYS.get(`${body.storeCode}|${signature(lines)}`)
  let reply
  if (key) reply = fromRaw(RAW[key], lines, body)
  else {
    reply = emptyReply(body.currency, d)
    const total = lines.reduce((s, l) => s + l.netBeforePromotion, 0)
    if (total >= 300) {
      const e = rule0('NEXT-VISIT').then.find((x) => x.effect === 'createCoupon')
      reply.createdCoupons.push({ campaign: 'NEXT-VISIT', rule: rule0('NEXT-VISIT').id, template: e.template, validDays: e.validDays, validFrom: null, validTo: null, label: e.label, code: null, state: null })
    }
  }
  // The newest version never holds a draft never published; a run of its draft places it last in the base.
  if (body.draft && !reply.trace.some((t) => t.campaign === body.draft))
    reply.trace.push({ campaign: body.draft, group: null, status: 'notTriggered', code: 'audience', money: 0, reason: says('a birthday this week', 'عيد ميلاد هذا الأسبوع') })

  return {
    sim: {
      basedOnVersion: LIVE_VERSION,
      campaign: body.draft ?? null,
      at: body.at ? `${body.at}:00` : '2026-10-16T18:30:00',
      lines: lines.map((l) => {
        const effects = reply.effects.filter((e) => e.line === l.lineNumber)
        const discount = round(effects.reduce((s, e) => s + e.amount, 0), d)
        return { lineNumber: l.lineNumber, article: l.article, quantity: l.quantity, net: l.netBeforePromotion, discount, netAfter: round(l.netBeforePromotion - discount, d), effects }
      }),
      reply,
    },
  }
}
