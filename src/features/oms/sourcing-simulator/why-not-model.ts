/**
 * "Why not another store" (ticket 965, BackOffice spec 4354 story 28; BackOffice 4379, the full level's
 * `search.whyNot[]` and `filterSteps`). The user picks a store; per mode the answer is the filter step that removed the
 * pair and its rule, or the best plan through the pair — its balanced total beside the open plan's, what it lost by and
 * the difference part by part, as the server worked them out — or why the search left it without a plan. Nothing is
 * subtracted here (4281 decision 28).
 *
 * The answer is read off the full-level reply the simulator already holds: the server has no door of its own for it
 * (the run record carries every pair's "why not"). A pair steps 1 to 5 removed is answered by `filterSteps` (its
 * `removed[]`, or a whole-store step's nearest five per mode); a later step's, the cut's or a standing pair's by
 * `search.whyNot`.
 */
import { DELIVERY_MODES, type AdviseFilterStep, type AdvisePlan, type AdviseRemovedPair, type AdviseReply } from '@/core/models/sourcing-run'

export type WhyNotLine =
  | { mode: string; kind: 'inPlan' }
  | { mode: string; kind: 'removed'; step: number | string | null; code: string }
  | { mode: string; kind: 'standing'; sum: number; planSum: number | null; lostBy: number | null; difference: { part: string; amount: number }[] }
  /** The search was given the pair and built no plan through it: `SERVES_FEWER` or `NOT_REACHED`. */
  | { mode: string; kind: 'noPlan'; code: string }

const modeOrder = (mode: string) => {
  const i = (DELIVERY_MODES as readonly string[]).indexOf(mode)
  return i < 0 ? DELIVERY_MODES.length : i
}

/** Every pair a filter step lists as removed: its own list, or a whole-store step's nearest per mode. */
const removedBy = (step: AdviseFilterStep): AdviseRemovedPair[] => [...(step.removed ?? []), ...(step.byMode ?? []).flatMap((m) => m.nearest)]

/** The answer for one store under the open plan: one line per mode; null when the reply carries no search (below full). */
export function whyNotAnswer(reply: Pick<AdviseReply, 'search' | 'filterSteps'>, store: string, plan: AdvisePlan): WhyNotLine[] | null {
  if (!reply.search) return null
  const lines = new Map<string, WhyNotLine>()
  for (const s of plan.shipments) if (s.store === store) lines.set(s.mode, { mode: s.mode, kind: 'inPlan' })
  for (const step of reply.filterSteps ?? []) {
    for (const r of removedBy(step)) {
      if (r.store !== store || lines.has(r.mode)) continue
      lines.set(r.mode, { mode: r.mode, kind: 'removed', step: step.step, code: r.code ?? step.code })
    }
  }
  for (const r of reply.search.whyNot) {
    if (r.store !== store || lines.has(r.mode)) continue
    if (r.removedAt !== undefined) {
      lines.set(r.mode, { mode: r.mode, kind: 'removed', step: r.removedAt, code: r.code ?? '' })
    } else if (r.goal === plan.goal) {
      lines.set(
        r.mode,
        r.plan
          ? { mode: r.mode, kind: 'standing', sum: r.plan.sum, planSum: plan.sum?.total ?? null, lostBy: r.lostBy ?? null, difference: r.difference ?? [] }
          : { mode: r.mode, kind: 'noPlan', code: r.code ?? '' },
      )
    }
  }
  return [...lines.values()].sort((a, b) => modeOrder(a.mode) - modeOrder(b.mode))
}

export interface WhyNotStore {
  store: string
  name: string | null
}

/** Every store the run read, removed, worked out or used, once each, by code; its name where the run gives one. */
export function whyNotStores(reply: AdviseReply): WhyNotStore[] {
  const names = new Map<string, string | null>()
  const add = (store: string, name: string | null) => {
    if (!names.get(store)) names.set(store, name)
  }
  for (const s of reply.inputs?.stores ?? []) add(s.store, s.name)
  for (const p of reply.plans) for (const s of p.shipments) add(s.store, s.storeName)
  for (const r of reply.search?.whyNot ?? []) add(r.store, null)
  for (const step of reply.filterSteps ?? []) for (const r of removedBy(step)) add(r.store, null)
  return [...names.entries()].map(([store, name]) => ({ store, name })).sort((a, b) => a.store.localeCompare(b.store))
}
