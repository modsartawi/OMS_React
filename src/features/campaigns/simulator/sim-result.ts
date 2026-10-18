import {
  RULE_TRACE_STATUSES,
  type RuleDraft,
  type RuleSimulatedLine,
  type RuleSimulateRequest,
  type RuleSimulation,
  type RuleTraceStatus,
  type Says,
} from '@/core/models/rule-campaign'
import type { RuleUnitEffect } from '@/core/models/rule-session'
import { currencyDecimals } from '@/core/money'
import { campaignCurrency } from '@/core/rules/sentence'
import { cartLines, roundTo, type BasketLine } from './basket'

// The simulator's request and HQ's answer, shaped for the page (tickets 514, 525). Pure. The client
// groups, counts and sums what HQ answered; it never works an effect out (ADR 0089).

/** The sale's currency by its country (HQ's request names both): the campaigns' own reading
 *  (`campaignCurrency`), at that currency's decimals — a Bahraini sale is in BHD at three. Null for a
 *  country with no currency known here. */
export function saleMoney(country: string): { currency: string; decimals: 2 | 3 } | null {
  const currency = campaignCurrency({ countries: [country] })
  return currency ? { currency, decimals: currencyDecimals(currency) === 3 ? 3 : 2 } : null
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

/** The sale's local moment as sent: `yyyy-MM-ddTHH:mm`, never a `Z`; null while either is blank. */
export function simAt(date: string, time: string): string | null {
  return DAY.test(date) && TIME.test(time) ? `${date}T${time}` : null
}

/** The coupon codes typed, split on spaces or commas, each once. */
export function couponCodes(text: string): string[] {
  return [...new Set(text.split(/[\s,]+/).filter(Boolean))]
}

/** The points the customer asks to redeem: blank is none; null when it is not a whole number. */
export function parsePoints(text: string): number | null {
  const s = text.trim()
  if (s === '') return 0
  return /^\d+$/.test(s) ? Number(s) : null
}

/**
 * What the run names from the `?draft=` the dashboard opened it with: the draft's id while the
 * campaign has a saved draft; nothing when it has none (it runs as the newest version publishes it,
 * since a `draft` it lacks is a 404); not ready while the campaign is still being read.
 */
export function draftTarget(param: string | null, loaded: RuleDraft | undefined): { ready: boolean; draft: string | null } {
  if (!param) return { ready: true, draft: null }
  if (!loaded) return { ready: false, draft: null }
  return { ready: true, draft: loaded.source === 'draft' ? loaded.code : null }
}

/**
 * Whether a run must name a draft: HQ refuses a dry run with nothing published and no draft
 * (`RULES_BAD_REQUEST`, "Nothing is published"). The live version is read from the order
 * (`versionNo` 0 = nothing published); unknown while it loads, so nothing is held back yet.
 */
export function needsDraft(draftParam: string | null, liveVersionNo: number | undefined): boolean {
  return !draftParam && liveVersionNo === 0
}

/** Where a near miss's gap sits, by rule and condition (1-based), from HQ's path
 *  `campaigns[i].rules[r].when[c]`; null for a path of another shape. */
export function gapPlace(path: string | null | undefined): { rule: number; condition: number } | null {
  const m = /rules\[(\d+)\]\.when\[(\d+)\]/.exec(path ?? '')
  return m ? { rule: Number(m[1]) + 1, condition: Number(m[2]) + 1 } : null
}

export interface SimForm {
  /** The typed basket; ignored while a file is the basket. */
  basket: readonly BasketLine[]
  /** The CSV file, sent as HQ's `csv` in place of the lines; null = the typed basket. */
  file: string | null
  store: string
  country: string
  channel: string
  memberId: string
  earning: boolean
  firstPurchase: boolean
  coupons: string
  points: string
  /** The offers' flags the customer said yes to. */
  flags: readonly string[]
  date: string
  time: string
  /** A saved draft's id, run in place of its live self; null = the newest version alone. */
  draft: string | null
}

/** The dry run's body, or null while the form lacks a basket (or a line's price), a store, a
 *  country, a channel, a moment or readable points. */
export function simRequest(f: SimForm): RuleSimulateRequest | null {
  const at = simAt(f.date, f.time)
  const money = saleMoney(f.country)
  const requestedPoints = parsePoints(f.points)
  if (!f.store || !money || !f.channel || !at || requestedPoints === null) return null
  const lines = f.file === null ? cartLines(f.basket, money.decimals) : []
  if (!lines || (f.file === null && lines.length === 0)) return null
  return {
    storeCode: f.store,
    country: f.country,
    channel: f.channel,
    currency: money.currency,
    decimals: money.decimals,
    lines,
    profile: { loyaltyId: f.memberId.trim(), tier: '', earning: f.earning, firstPurchase: f.firstPurchase, points: 0, audiences: [] },
    coupons: couponCodes(f.coupons),
    flags: [...f.flags],
    requestedPoints,
    ...(f.file !== null ? { csv: f.file } : {}),
    ...(f.draft ? { draft: f.draft } : {}),
    at,
  }
}

/** One campaign's rule effect on a line: its units summed. */
export interface LineEffect {
  campaign: string
  rule: string
  effect: string
  /** The line number it lands on. */
  line: number
  /** How many units it reached. */
  units: number
  /** Of those, how many it made free (`freeGoods`). */
  freeUnits: number
  amount: number
  label: Says | null
}

export interface ShapedLine extends RuleSimulatedLine {
  /** The line's unit effects, one entry per campaign, rule and effect, in HQ's order. */
  grouped: LineEffect[]
}

export interface ShapedSim {
  lines: ShapedLine[]
  /** Unit effects on a line HQ did not answer — kept, never dropped. */
  stray: LineEffect[]
  totals: { net: number; discount: number; netAfter: number }
  /** The campaigns by how they came out. */
  counts: Record<RuleTraceStatus, number>
}

/** Unit effects summed per (line, campaign, rule, effect), in first-seen order. */
export function sumUnits(effects: readonly RuleUnitEffect[], decimals: number): LineEffect[] {
  const out: LineEffect[] = []
  const at = new Map<string, LineEffect>()
  for (const e of effects) {
    const key = JSON.stringify([e.line, e.campaign, e.rule, e.effect])
    let g = at.get(key)
    if (!g) {
      g = { campaign: e.campaign, rule: e.rule, effect: e.effect, line: e.line, units: 0, freeUnits: 0, amount: 0, label: e.label }
      at.set(key, g)
      out.push(g)
    }
    g.units++
    if (e.freeGoods) g.freeUnits++
    g.amount = roundTo(g.amount + e.amount, decimals)
    g.label ??= e.label
  }
  return out
}

export function shapeSimulation(sim: RuleSimulation): ShapedSim {
  const d = sim.reply.decimals
  const lines: ShapedLine[] = [...(sim.lines ?? [])]
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((l) => ({ ...l, grouped: sumUnits(l.effects ?? [], d) }))
  const known = new Set(lines.map((l) => l.lineNumber))
  const stray = sumUnits((sim.reply.effects ?? []).filter((e) => !known.has(e.line)), d)
  const sum = (k: 'net' | 'discount' | 'netAfter') => roundTo(lines.reduce((s, l) => s + l[k], 0), d)
  const counts = Object.fromEntries(RULE_TRACE_STATUSES.map((s) => [s, 0])) as Record<RuleTraceStatus, number>
  for (const t of sim.reply.trace ?? []) if (Object.hasOwn(counts, t.status)) counts[t.status as RuleTraceStatus]++
  return { lines, stray, totals: { net: sum('net'), discount: sum('discount'), netAfter: sum('netAfter') }, counts }
}

/** One line of a refusal's details: "rule 1 → effect 1 → value: a percent is … (campaign.rules[0]…)"
 *  or "line 3: the quantity is more than 0". */
export interface RefusalLine {
  where: string | null
  message: string
  path: string | null
}

/** HQ's detail lines read into where, what and the path; a line in another form is kept whole. */
export function refusalLines(details: readonly string[]): RefusalLine[] {
  return details.map((d) => {
    // HQ writes `Where + ": " + Message + " (" + Path + ")"`; either end may be empty.
    const m = /^(.*?): (.*?)(?: \(([\w.[\]]*)\))?$/.exec(d)
    return m ? { where: m[1] || null, message: m[2], path: m[3] || null } : { where: null, message: d, path: null }
  })
}
