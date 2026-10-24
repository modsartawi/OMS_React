import type { HungerStationOrderLine } from '@/core/models/hungerstation'

// The order a HungerStation order's lines are shown in (spec 3028, ticket 556). Pure: no React.

/**
 * The lines in the order given, each replacement placed right after the line it replaced
 * (`replacedId` names that line's `itemId`), a replacement of a replacement right after that one,
 * and two replacements of one line in the order given. The door already sends them so; this keeps
 * the rule true whatever order arrives.
 *
 * A replacement whose line is not in the order stays where it was given. Bad data (a cycle) loses
 * no line and repeats none: what the walk did not reach is appended in the order given.
 */
export function lineOrder(lines: readonly HungerStationOrderLine[]): HungerStationOrderLine[] {
  const ids = new Set(lines.map((l) => l.itemId))
  const isRoot = (l: HungerStationOrderLine) => l.replacedId === null || !ids.has(l.replacedId)
  const out: HungerStationOrderLine[] = []
  const placed = new Set<HungerStationOrderLine>()
  const place = (l: HungerStationOrderLine) => {
    if (placed.has(l)) return
    placed.add(l)
    out.push(l)
    for (const r of lines) if (r.replacedId === l.itemId && !isRoot(r)) place(r)
  }
  for (const l of lines) if (isRoot(l)) place(l)
  for (const l of lines) if (!placed.has(l)) place(l)
  return out
}
