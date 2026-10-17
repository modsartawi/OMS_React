import type {
  RuleCreatedCoupon,
  RuleSessionHold,
  RuleSessionLookup,
  RuleSessionRefusal,
  RuleUnitEffect,
} from '@/core/models/rule-session'
import type { Says } from '@/core/models/rule-campaign'

// A customer session read for support (ticket 527): HQ answers the cart as the channel sent it and
// the effects PER UNIT (line, 0-based unit), never per line or per campaign. The Cart items and
// Campaigns tabs read them grouped. Sums are rounded to the session's decimals. Pure: no React, no
// i18n.

/** A campaign's effect on one line, its units summed. */
export interface LineEffect {
  campaign: string
  rule: string
  effect: string
  amount: number
  label: Says | null
  /** How many of the units are free goods. */
  freeUnits: number
}

/** One unit of a line: what it was given off, by whom, and whether it came back. */
export interface UnitRow {
  /** 0-based, as on the wire. */
  unit: number
  discount: number
  campaigns: string[]
  returned: boolean
}

export interface CartRow {
  line: number
  article: string
  category: string | null
  quantity: number
  gross: number
  netBeforePromotion: number
  discount: number
  netAfter: number
  fee: boolean
  effects: LineEffect[]
  units: UnitRow[]
}

const roundTo = (n: number, decimals: number) => {
  const f = 10 ** Math.max(0, decimals)
  return Math.round(n * f) / f
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Each cart line by line number, with its effects summed per campaign, rule and effect, and its units. */
export function cartRows(s: RuleSessionLookup): CartRow[] {
  const d = s.session.decimals
  const lines = [...(s.cart?.lines ?? [])].sort((a, b) => a.lineNumber - b.lineNumber)
  return lines.map((l) => {
    const on = (s.effects ?? []).filter((e) => e.line === l.lineNumber)
    const effects: LineEffect[] = []
    for (const e of on) {
      const same = effects.find((x) => x.campaign === e.campaign && x.rule === e.rule && x.effect === e.effect)
      if (same) {
        same.amount = roundTo(same.amount + e.amount, d)
        same.label ??= e.label
        same.freeUnits += e.freeGoods ? 1 : 0
      } else {
        effects.push({ campaign: e.campaign, rule: e.rule, effect: e.effect, amount: roundTo(e.amount, d), label: e.label ?? null, freeUnits: e.freeGoods ? 1 : 0 })
      }
    }
    const back = (s.returned ?? []).filter((r) => r.line === l.lineNumber).map((r) => r.unit)
    // A counted line has a unit per piece; a weighed one (a fractional quantity) is one unit.
    const count = Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : 1
    const indexes = [...new Set([...Array.from({ length: count }, (_, i) => i), ...on.map((e) => e.unit), ...back])].sort((a, b) => a - b)
    const units = indexes.map((unit): UnitRow => {
      const mine = on.filter((e) => e.unit === unit)
      return { unit, discount: roundTo(sum(mine.map((e) => e.amount)), d), campaigns: [...new Set(mine.map((e) => e.campaign))], returned: back.includes(unit) }
    })
    const discount = roundTo(sum(on.map((e) => e.amount)), d)
    return {
      line: l.lineNumber,
      article: l.article,
      category: l.category ?? null,
      quantity: l.quantity,
      gross: l.gross,
      netBeforePromotion: l.netBeforePromotion,
      discount,
      netAfter: roundTo(l.netBeforePromotion - discount, d),
      fee: l.fee,
      effects,
      units,
    }
  })
}

/** The sale's money: the cart before promotions, every effect, and the net. Null without a cart. */
export function sessionTotals(s: RuleSessionLookup): { before: number; discount: number; net: number } | null {
  if (!s.cart) return null
  const d = s.session.decimals
  const before = roundTo(sum(s.cart.lines.map((l) => l.netBeforePromotion)), d)
  const discount = roundTo(sum((s.effects ?? []).map((e) => e.amount)), d)
  return { before, discount, net: roundTo(before - discount, d) }
}

/** What one campaign did on the session, and what it was refused. */
export interface CampaignRow {
  campaign: string
  /** It gave something, or holds a budget for what it will give; else it was only refused. */
  applied: boolean
  discount: number
  freeUnits: number
  /** Points awarded or burned, summed per effect and unit. */
  points: { effect: string; unit: string; amount: number }[]
  holds: RuleSessionHold[]
  createdCoupons: RuleCreatedCoupon[]
  refusals: RuleSessionRefusal[]
}

/**
 * Every campaign the session names, in the order first seen across its effects, points, holds,
 * created codes and refusals; and the refusals that name no campaign (the sale's own).
 */
export function sessionCampaigns(s: RuleSessionLookup): { campaigns: CampaignRow[]; sale: RuleSessionRefusal[] } {
  const d = s.session.decimals
  const rows = new Map<string, CampaignRow>()
  const row = (campaign: string) => {
    let r = rows.get(campaign)
    if (!r) {
      r = { campaign, applied: false, discount: 0, freeUnits: 0, points: [], holds: [], createdCoupons: [], refusals: [] }
      rows.set(campaign, r)
    }
    return r
  }
  const effects: RuleUnitEffect[] = s.effects ?? []
  for (const e of effects) {
    const r = row(e.campaign)
    r.discount = roundTo(r.discount + e.amount, d)
    r.freeUnits += e.freeGoods ? 1 : 0
  }
  for (const p of s.points ?? []) {
    const r = row(p.campaign)
    const same = r.points.find((x) => x.effect === p.effect && x.unit === p.unit)
    if (same) same.amount = roundTo(same.amount + p.amount, d)
    else r.points.push({ effect: p.effect, unit: p.unit, amount: p.amount })
  }
  for (const h of s.holds ?? []) row(h.campaign).holds.push(h)
  for (const c of s.createdCoupons ?? []) row(c.campaign).createdCoupons.push(c)
  const sale: RuleSessionRefusal[] = []
  for (const f of s.refusals ?? []) {
    if (f.campaign) row(f.campaign).refusals.push(f)
    else sale.push(f)
  }
  const campaigns = [...rows.values()].map((c) => ({
    ...c,
    applied: c.discount > 0 || c.freeUnits > 0 || c.points.length > 0 || c.createdCoupons.length > 0 || c.holds.length > 0,
  }))
  return { campaigns, sale }
}
