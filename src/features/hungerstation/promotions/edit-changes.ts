import type { HungerStationPromotionPartChange } from '@/core/models/hungerstation'

/**
 * The Check preview of an in-place edit (ticket 670, BackOffice 3215) — pure. The server recomputes
 * the parts from the edited rows and answers, per part, what happens to it and which materials leave
 * or join it; this reads that answer in the user's terms. The page never recomputes the parts.
 */

export interface EditMove {
  materialNumber: string
  /** The part's name on HungerStation. */
  from: string
  to: string
}

export interface EditChangeSummary {
  /** Combinations no part carried: each a new HungerStation promotion. */
  newParts: HungerStationPromotionPartChange[]
  /** Parts the edit leaves with no item: sent `active: false`. */
  switchedOff: HungerStationPromotionPartChange[]
  /** Parts re-sent under their unchanged identity. */
  updated: HungerStationPromotionPartChange[]
  /** Parts not re-sent. */
  unchanged: number
  /** A material leaving one part and joining another. */
  moved: EditMove[]
  /** Leaving with no part to join: out of the promotion. */
  removed: { materialNumber: string; from: string }[]
  /** Joining with no part to leave: new to the promotion. */
  added: { materialNumber: string; to: string }[]
  /** HungerStation calls the edit makes: one per new, updated or switched-off part. */
  calls: number
  /** Something changes on HungerStation. */
  any: boolean
}

export function editChanges(changes: readonly HungerStationPromotionPartChange[]): EditChangeSummary {
  const leftFrom = new Map<string, string>()
  for (const p of changes) for (const m of p.leaving) leftFrom.set(m, p.name)
  const joinedTo = new Map<string, string>()
  for (const p of changes) for (const m of p.joining) joinedTo.set(m, p.name)

  const moved: EditMove[] = []
  const removed: EditChangeSummary['removed'] = []
  for (const [materialNumber, from] of leftFrom) {
    const to = joinedTo.get(materialNumber)
    if (to !== undefined) moved.push({ materialNumber, from, to })
    else removed.push({ materialNumber, from })
  }
  const added = [...joinedTo].filter(([m]) => !leftFrom.has(m)).map(([materialNumber, to]) => ({ materialNumber, to }))

  const of = (kind: HungerStationPromotionPartChange['change']) => changes.filter((p) => p.change === kind)
  const newParts = of('new')
  const switchedOff = of('switchedOff')
  const updated = of('updated')
  const calls = newParts.length + switchedOff.length + updated.length
  return { newParts, switchedOff, updated, unchanged: of('unchanged').length, moved, removed, added, calls, any: calls > 0 }
}
