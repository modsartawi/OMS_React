/**
 * The pins (ticket 963, BackOffice spec 4354 §3; 4281 decisions 15 and 24; BackOffice 4359). Pure.
 *
 * - The pins the user set, as chips. A pin the run refused before the solve stays on its chip with its reason: the code,
 *   and for a removed pair the filter step, its code and the rule; for pins that clash together, the clash and its rule.
 * - Adding a pin: a line has at most one store pin and one mode pin (a second replaces the first); the same pin twice is
 *   one pin.
 * - What the pins cost each plan: the plan against the same goal of the run without pins the reply carries, in minutes
 *   (the last shipment's promise time), in riyals (the customer's fee and the company's cost, each its own difference:
 *   no total is made here, 4281 decision 28) and in deliveries.
 * - Pins that leave no plan: one banner naming them, only when no goal has a plan (4359: "no plan" only then).
 */
import type { AdvisePin, AdvisePlan, AdviseReply, PlanGoal } from '@/core/models/sourcing-run'

export interface PinRefusal {
  code: string
  step: number | string | null
  stepCode: string | null
  /** A product rule row's id, or `R1`–`R7` for pins that clash (BackOffice 4359). */
  rule: string | null
  /** A product rule's sentence, in both languages, when the server writes one. */
  en: string | null
  ar: string | null
}

export interface PinChip {
  /** Stable per pin: the kind and its fields. */
  key: string
  pin: AdvisePin
  /** Null while the pin holds (or before any run). */
  refusal: PinRefusal | null
}

export type PinsCost =
  | { kind: 'cost'; minutes: number; fee: number; companyCost: number; deliveries: number }
  /** The pins changed nothing on this plan. */
  | { kind: 'nothing' }
  /** The run without pins had no plan for this goal. */
  | { kind: 'noPlanWithout' }

export interface PinsClash {
  pins: AdvisePin[]
  rules: string[]
}

/** One key per pin, whatever order the server echoes its fields in. */
export function pinKey(pin: AdvisePin): string {
  switch (pin.kind) {
    case 'LINE_STORE':
      return `LINE_STORE:${pin.lineNo}:${pin.store}`
    case 'LINE_MODE':
      return `LINE_MODE:${pin.lineNo}:${pin.mode}`
    case 'NOT_STORE':
      return `NOT_STORE:${pin.store}`
    case 'NOT_MODE':
      return `NOT_MODE:${pin.mode}`
    case 'ONE_SHIPMENT':
      return 'ONE_SHIPMENT'
  }
}

export const samePin = (a: AdvisePin, b: AdvisePin) => pinKey(a) === pinKey(b)
export const hasPin = (pins: readonly AdvisePin[], pin: AdvisePin) => pins.some((p) => samePin(p, pin))

/** A second store (or mode) pin on the same line takes the first one's place. */
const displaces = (old: AdvisePin, pin: AdvisePin) =>
  old.kind === pin.kind && (pin.kind === 'LINE_STORE' || pin.kind === 'LINE_MODE') && 'lineNo' in old && old.lineNo === pin.lineNo

export function addPin(pins: readonly AdvisePin[], pin: AdvisePin): AdvisePin[] {
  if (hasPin(pins, pin)) return [...pins]
  const at = pins.findIndex((p) => displaces(p, pin))
  if (at < 0) return [...pins, pin]
  return pins.map((p, i) => (i === at ? pin : p))
}

export const removePin = (pins: readonly AdvisePin[], pin: AdvisePin): AdvisePin[] => pins.filter((p) => !samePin(p, pin))

export function pinChips(pins: readonly AdvisePin[], reply: Pick<AdviseReply, 'refusedPins'> | null): PinChip[] {
  const refused = reply?.refusedPins ?? []
  return pins.map((pin) => {
    const r = refused.find((x) => (x.pin && samePin(x.pin, pin)) || (x.pins ?? []).some((p) => samePin(p, pin)))
    return {
      key: pinKey(pin),
      pin,
      refusal: r ? { code: r.code, step: r.step ?? null, stepCode: r.stepCode ?? null, rule: r.rule ?? null, en: r.en ?? null, ar: r.ar ?? null } : null,
    }
  })
}

/** Minutes since midnight of day zero, from local wall clock `yyyy-MM-dd HH:mm:ss` (no zone: read as UTC, no DST). */
const minutesOf = (s: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s)
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null
}

/** A difference of two amounts sent to three decimals, kept to three. */
const riyals = (a: number, b: number) => Math.round((a - b) * 1000) / 1000

function costOf(plan: AdvisePlan, without: AdvisePlan | undefined): PinsCost {
  if (!without) return { kind: 'noPlanWithout' }
  const at = minutesOf(plan.promise.by)
  const was = minutesOf(without.promise.by)
  const cost = {
    minutes: at !== null && was !== null ? at - was : 0,
    fee: riyals(plan.totals.fee, without.totals.fee),
    companyCost: riyals(plan.totals.companyCost, without.totals.companyCost),
    deliveries: plan.totals.shipments - without.totals.shipments,
  }
  return cost.minutes === 0 && cost.fee === 0 && cost.companyCost === 0 && cost.deliveries === 0 ? { kind: 'nothing' } : { kind: 'cost', ...cost }
}

/** Per shown plan, what the pins cost it; empty when the run was sent without pins (no `withoutPins`). */
export function pinsCost(reply: Pick<AdviseReply, 'plans' | 'withoutPins'>): Partial<Record<PlanGoal, PinsCost>> {
  const without = reply.withoutPins
  if (!without) return {}
  const out: Partial<Record<PlanGoal, PinsCost>> = {}
  for (const p of reply.plans) out[p.goal] = costOf(p, without.plans.find((w) => w.goal === p.goal))
  return out
}

/**
 * The stores "never this store" offers: every store the run showed — on its plans, its hidden plans, the run without
 * pins, and the stores it read (the middle level's `inputs.stores`) — once each, in code order. None before a run.
 */
export function storesSeen(reply: Pick<AdviseReply, 'plans' | 'hiddenPlans' | 'withoutPins' | 'inputs'> | null): string[] {
  if (!reply) return []
  const plans = [...reply.plans, ...(reply.hiddenPlans ?? []).flatMap((h) => (h.plan ? [h.plan] : [])), ...(reply.withoutPins?.plans ?? [])]
  const read = (reply.inputs as { stores?: { store?: unknown }[] } | undefined)?.stores ?? []
  const codes = [...plans.flatMap((p) => p.shipments.map((s) => s.store)), ...read.map((s) => s.store).filter((s): s is string => typeof s === 'string')]
  return [...new Set(codes)].sort()
}

/**
 * The pins that leave no plan, when no goal has one and a clash is the reason; null otherwise. Named from the clash's own
 * list where the reply sends one, else every pin sent that was not refused on its own.
 */
export function pinsClash(reply: Pick<AdviseReply, 'plans' | 'noPlan' | 'refusedPins'>, pins: readonly AdvisePin[]): PinsClash | null {
  if (reply.plans.length > 0) return null
  const clashes = (reply.refusedPins ?? []).filter((r) => r.code === 'PINS_CLASH')
  if (clashes.length === 0 && !(reply.noPlan ?? []).some((n) => n.code === 'PINS_CLASH')) return null
  const listed = clashes.flatMap((c) => c.pins ?? [])
  const named = listed.length > 0 ? pins.filter((p) => hasPin(listed, p)) : pins.filter((p) => !(reply.refusedPins ?? []).some((r) => r.pin && samePin(r.pin, p)))
  return { pins: named, rules: clashes.map((c) => c.rule).filter((r): r is string => !!r) }
}
