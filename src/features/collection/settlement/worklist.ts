import type { SettlementOrphanRow } from '@/core/models/settlement'

/**
 * The worklist's triage — **the module the whole door is judged on** (ticket 270,
 * spec 267 D2), narrowed by ticket 274 to the one lane that has a door.
 *
 * 🔑 **Triage is why this screen works, and the prototype proved it by failing.**
 * An untriaged *needs you* list went from 3 cards at six branches to ~140 at estate
 * scale, of which 131 were merely ageing — and the four that were actually *wrong*
 * sank into them. So the lanes were ordered **by what they cost**:
 *
 * | lane | 274's finding |
 * |---|---|
 * | wrong money | ✅ `Settlement/Orphans` — enumerated in full, each repairable, estate-wide |
 * | cash waiting | ❌ **no door.** The fleet row carries a flag and nothing enumerates it (§B2) |
 * | ageing | ❌ **removed outright.** Spec 1173 rules entry staleness *fog* (§B3) |
 *
 * ⚠️ **The ageing lane is gone rather than empty, and that is the honest outcome.**
 * It was *a count and a way through* against a threshold 270's own ticket forbade
 * inventing — correctly, because the grace period is money policy. BackOffice spec
 * 1173 then declined to set one: *"whether an entry goes stale is fog, and there is
 * no notification rail behind it by design"*. A lane cannot count against a rule the
 * domain has not made, so it does not pretend to.
 *
 * 🔑 **The estate-wide carve-out survives, and is now the server's.** 1255 of 1394
 * branches are unassigned; under a naive *mine* their money would be on nobody's
 * screen. `Settlement/Orphans` takes no scope at all — a door with none cannot be
 * narrowed by accident — and the fleet door OR's the same carve-out into every
 * scoped predicate.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock.
 */

export type WorklistLanes = {
  /** 🔑 Estate-wide, always. Enumerated in full — they are rare and each is money. */
  wrongMoney: SettlementOrphanRow[]
  /** Is there anything at all to do? Used for the *nothing needs you* case, which
   *  is a real and good answer rather than an empty screen. */
  isEmpty: boolean
}

/**
 * Oldest first, tie-broken by id so the order is **total** — two rows can share a
 * timestamp, and a comparator that left them unordered would let a re-render
 * reshuffle the lane under the reader's cursor.
 *
 * ⚠️ **Ordered on `consumedAt`, not on a day count.** 270 sorted by the server's own
 * `ageDays`; the live door does not send one (§B2's projection is deliberately
 * narrow — the four extra fields would each turn a seek on
 * `IX_SettlementConsumption_Orphan` into a lookup per row). The timestamp IS the
 * age, at better resolution, and it is still the **server's clock** — which was the
 * whole reason `ageDays` had to come from the server. Nothing here reads `Date.now`,
 * so this module's answers do not change overnight.
 */
const byOldestFirst = (a: SettlementOrphanRow, b: SettlementOrphanRow) => {
  if (a.consumedAt !== b.consumedAt) return a.consumedAt < b.consumedAt ? -1 : 1
  const [x, y] = [a.settlementConsumptionId, b.settlementConsumptionId]
  return x < y ? -1 : x > y ? 1 : 0
}

export function buildWorklist(
  orphans: readonly SettlementOrphanRow[] | null | undefined,
): WorklistLanes {
  // 🔑 The lane takes the answer as it came. No scope, no filter, no branch
  // predicate — this is the carve-out, and it is one line long so that adding one
  // is visible in a diff.
  const wrongMoney = [...(orphans ?? [])].sort(byOldestFirst)

  return { wrongMoney, isEmpty: wrongMoney.length === 0 }
}
