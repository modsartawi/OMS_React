/**
 * "Why not another store" (ticket 965, BackOffice spec 4354 story 28; 4281 decision 27, `search.whyNot[]`). The user
 * picks a store; per mode the answer is the filter step that removed the pair and its rule, or the best plan through
 * the pair — its balanced total beside the open plan's and the difference part by part, as the server worked them out.
 * Nothing is subtracted here (4281 decision 28): the difference is the server's.
 */
import { DELIVERY_MODES, type AdvisePlan, type AdviseReply, type AdviseWhyNot } from '@/core/models/sourcing-run'

export type WhyNotLine =
  | { mode: string; kind: 'inPlan' }
  | { mode: string; kind: 'removed'; step: number | string | null; code: string }
  | { mode: string; kind: 'standing'; sum: number | null; planSum: number | null; difference: { part: string; amount: number }[] }

const modeOrder = (mode: string) => {
  const i = (DELIVERY_MODES as readonly string[]).indexOf(mode)
  return i < 0 ? DELIVERY_MODES.length : i
}

/** The answer for one store under the open plan: one line per mode. A removal holds for every goal. */
export function whyNotAnswer(rows: readonly AdviseWhyNot[], store: string, plan: AdvisePlan): WhyNotLine[] {
  const used = new Set(plan.shipments.filter((s) => s.store === store).map((s) => s.mode))
  const lines = new Map<string, WhyNotLine>()
  for (const mode of used) lines.set(mode, { mode, kind: 'inPlan' })
  for (const r of rows) {
    if (r.store !== store || lines.has(r.mode)) continue
    if (r.code !== undefined && r.removedAt !== undefined) {
      lines.set(r.mode, { mode: r.mode, kind: 'removed', step: r.removedAt, code: r.code })
    } else if (r.goal === plan.goal) {
      lines.set(r.mode, { mode: r.mode, kind: 'standing', sum: r.sum ?? null, planSum: plan.sum?.total ?? null, difference: r.difference ?? [] })
    }
  }
  return [...lines.values()].sort((a, b) => modeOrder(a.mode) - modeOrder(b.mode))
}

export interface WhyNotStore {
  store: string
  name: string | null
}

/** A filter step's removed pair, read loosely: `filterSteps` is typed by the solver tab (966). */
const removedStores = (steps: unknown): string[] =>
  Array.isArray(steps)
    ? steps.flatMap((s) => {
        const removed = (s as { removed?: unknown }).removed
        return Array.isArray(removed) ? removed.map((r) => (r as { store?: unknown }).store).filter((x): x is string => typeof x === 'string') : []
      })
    : []

/** Every store the run read, removed, worked out or used, once each, by code; its name where the run gives one. */
export function whyNotStores(reply: AdviseReply): WhyNotStore[] {
  const names = new Map<string, string | null>()
  const add = (store: string, name: string | null) => {
    if (!names.get(store)) names.set(store, name)
  }
  for (const s of reply.inputs?.stores ?? []) add(s.store, s.name)
  for (const p of reply.plans) for (const s of p.shipments) add(s.store, s.storeName)
  for (const r of reply.search?.whyNot ?? []) add(r.store, null)
  for (const store of removedStores(reply.filterSteps)) add(store, null)
  return [...names.entries()].map(([store, name]) => ({ store, name })).sort((a, b) => a.store.localeCompare(b.store))
}
