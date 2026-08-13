import type {
  SettlementFleetRow,
  SettlementOrphanRow,
  SettlementUncollectedRow,
  SettlementWorklistResult,
} from '@/core/models/settlement'
import { branchesInScope, type ScopeResolution } from './scope'

/**
 * The worklist's triage — **the module the whole door is judged on** (ticket 270,
 * spec 267 D2).
 *
 * 🔑 **Triage is why this screen works, and the prototype proved it by failing.**
 * An untriaged *needs you* list went from 3 cards at six branches to ~140 at estate
 * scale, of which 131 were merely ageing — and the four that were actually *wrong*
 * sank into them. So the lanes are ordered **by what they cost**:
 *
 * | lane | contents | scope |
 * |---|---|---|
 * | wrong money | orphan consumptions, **enumerated in full**, each repairable | 🔑 always estate-wide |
 * | cash waiting | prepared-but-uncollected receipts, showing **age** | 🔑 always estate-wide |
 * | ageing | **a count and a way through** — never a card each | honours the scope |
 *
 * 🔑 **The estate-wide carve-out is the load-bearing part.** 1255 of 1394 branches
 * are unassigned; under a naive *mine* scope their money would be on nobody's
 * screen. Wrong money and cash waiting are rare, enumerated, and belong to whoever
 * is looking. Only the ageing count (here) and the search ranking (`search.ts`)
 * honour the scope.
 *
 * ⚠️ **This function never receives the scope for the first two lanes.** The
 * `ScopeResolution` reaches exactly one line below, and the two enumerated lanes
 * are returned from the worklist answer untouched — a shape in which "tidying the
 * scope handling" cannot narrow them without deleting a comment first. The door
 * they come from takes no scope parameter either (`api.ts`), so the rule is
 * enforced twice: once on the wire and once here.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock — `ageDays` is the server's own
 * figure, so this module's answers do not change overnight.
 */

/** The ageing lane, in full. 🔑 **There is no row array on this type, and that is
 *  the point** — the lane cannot render a card each because it is never handed the
 *  entries to render. A count, the branches behind it, and a way through. */
export type AgeingLane = {
  /** Entries open longer than the server's threshold, across the branches in scope. */
  count: number
  /** How many branches those entries are spread over — *47 across 9 branches* reads
   *  very differently from *47 on one*, and the second is a phone call. */
  branchCount: number
  /** The server's own threshold. ⚠️ The ticket forbids inventing one here. */
  thresholdDays: number
}

export type WorklistLanes = {
  /** 🔑 Estate-wide, always. Enumerated in full — they are rare and each is money. */
  wrongMoney: SettlementOrphanRow[]
  /** 🔑 Estate-wide, always. */
  cashWaiting: SettlementUncollectedRow[]
  /** The one lane the scope touches. */
  ageing: AgeingLane
  /** Is there anything at all to do? Used for the *nothing needs you* case, which
   *  is a real and good answer rather than an empty screen. */
  isEmpty: boolean
}

/** Oldest first, tie-broken by id so the order is **total** — two rows can share a
 *  day count, and a comparator that left them unordered would let a re-render
 *  reshuffle the lane under the reader's cursor. */
const byAgeThen = <T extends { ageDays: number }>(key: (row: T) => string) => (a: T, b: T) =>
  b.ageDays - a.ageDays || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)

export function buildWorklist(
  worklist: SettlementWorklistResult | null | undefined,
  fleet: readonly SettlementFleetRow[] | null | undefined,
  resolution: ScopeResolution,
): WorklistLanes {
  // 🔑 The two enumerated lanes take the answer as it came. No scope, no filter,
  // no branch predicate — this is the carve-out, and it is three lines long so that
  // adding one is visible in a diff.
  const wrongMoney = [...(worklist?.orphans ?? [])].sort(
    byAgeThen<SettlementOrphanRow>((r) => r.settlementConsumptionId),
  )
  const cashWaiting = [...(worklist?.uncollected ?? [])].sort(
    byAgeThen<SettlementUncollectedRow>((r) => r.documentId),
  )

  // …and the ageing lane, which is the ONLY thing on this screen the scope narrows.
  const scoped = branchesInScope(fleet, resolution).filter((r) => r.ageingCount > 0)
  const ageing: AgeingLane = {
    count: scoped.reduce((sum, r) => sum + r.ageingCount, 0),
    branchCount: scoped.length,
    thresholdDays: worklist?.ageingThresholdDays ?? 0,
  }

  return {
    wrongMoney,
    cashWaiting,
    ageing,
    isEmpty: wrongMoney.length === 0 && cashWaiting.length === 0 && ageing.count === 0,
  }
}
