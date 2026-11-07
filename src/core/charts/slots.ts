/**
 * The colour-slot rule (spec 766 §F, ticket 767): a chart colours by ENTITY, never by rank, so
 * filtering never repaints the members that remain.
 *
 * - A dimension the model serves with inline values (channel group, country) has a **fixed** slot
 *   per value: its catalogue position.
 * - Any other breakdown uses the definition's **saved** member → slot map, written when the view is
 *   saved; a member the map does not hold takes the next free slot, in the order the members come.
 * - There are {@link CHART_SLOT_COUNT} slots (the validated palette, `--chart-1…5`). A member that
 *   finds none free gets `null`; 768's "top 5 plus Other" folds those before they are drawn.
 *
 * Pure: no React, no DOM.
 */

/** The validated categorical palette has five slots (766 §E amendment 2). */
export const CHART_SLOT_COUNT = 5

export type SlotRule =
  /** The catalogue's own order of a small fixed dimension's values. */
  | { kind: 'fixed'; order: readonly string[] }
  /** The definition's saved member → slot map (may be empty). */
  | { kind: 'saved'; map: Readonly<Record<string, number>> }

const isSlot = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < CHART_SLOT_COUNT

/** Each member's slot, `null` when none is left. Members are taken in the order given. */
export function assignSlots(members: readonly string[], rule: SlotRule): Map<string, number | null> {
  const out = new Map<string, number | null>()
  const taken = new Set<number>()
  const preset = new Map<string, number>()

  if (rule.kind === 'fixed') {
    rule.order.forEach((member, i) => {
      if (isSlot(i)) preset.set(member, i)
    })
  } else {
    for (const [member, slot] of Object.entries(rule.map)) if (isSlot(slot)) preset.set(member, slot)
  }
  // Every preset slot is reserved, present in this answer or not: a member filtered out today keeps
  // its colour for tomorrow, so nobody else may borrow it.
  for (const slot of preset.values()) taken.add(slot)

  for (const member of members) {
    if (out.has(member)) continue
    const fixed = preset.get(member)
    if (fixed !== undefined) {
      out.set(member, fixed)
      continue
    }
    let next: number | null = null
    for (let s = 0; s < CHART_SLOT_COUNT; s++)
      if (!taken.has(s)) {
        next = s
        break
      }
    if (next !== null) taken.add(next)
    out.set(member, next)
  }
  return out
}

/** The CSS colour of a slot, read live from the token so a theme switch repaints with no re-render. */
export function slotColour(slot: number | null): string {
  return slot === null ? CHART_INK.other : `var(--chart-${slot + 1})`
}

/**
 * The chart chrome's inks (766 §F: ticks, gridlines and legend text in ink, never in a series colour).
 * Token references, so they follow light and dark through the cascade.
 */
export const CHART_INK = {
  tick: 'var(--muted-foreground)',
  grid: 'var(--divider)',
  axis: 'var(--border-strong)',
  legend: 'var(--foreground)',
  /** "Other" is ink grey (768), never a sixth hue. */
  other: 'var(--ink-3)',
  card: 'var(--card)',
  cursor: 'var(--accent)',
} as const

/**
 * A series chart row's own fill (ticket 820). Recharts gives a data row's `fill` priority over a
 * `<Bar fill>`, so a row fill on a multi-series bar painted every series in slot 0. The row carries
 * a fill only when there is ONE series: its member's slot (`colourBy: 'member'`) or slot 0. With two
 * or more series there is none, and each series' own slot colour applies.
 */
export function seriesRowFill(seriesCount: number, colourBy: 'member' | 'single', slot: number | null): string | undefined {
  if (seriesCount !== 1) return undefined
  return colourBy === 'member' ? slotColour(slot) : slotColour(0)
}

/** A dimmed series' opacity while another is highlighted (825). */
export const DIMMED_OPACITY = 0.25

/**
 * A series' opacity under a highlight (825): full when nothing is highlighted or it is the one; dimmed
 * otherwise. The highlight is opacity only — a series keeps its own colour.
 */
export function seriesOpacity(highlighted: string | null, key: string): number {
  return highlighted === null || highlighted === key ? 1 : DIMMED_OPACITY
}
