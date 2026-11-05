import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import type { CrossFilter, DrillStep } from './effective-query'

/**
 * Cross-filter and drill by on a board (spec 766 §F, ticket 772) — pure.
 *
 * - A click on a bar, a slice or a table row is a POINT: the member of the category dimension that mark
 *   stands for. Time members (a day) are not points: the board's period already filters time. ⚠ ruling.
 * - The point sets the board's cross-filter; the same click again clears it (`toggleCrossFilter`).
 * - Drill by re-asks the clicked panel, in place, from that point into another allowed dimension
 *   (`drillTargets`), with a breadcrumb back (`crumbsOf`). Not saved, and not in the URL.
 */

export interface MarkPoint {
  dimension: string
  member: string
}

/** The clicked mark as a point, or `null` when it cannot filter (a time member, an unknown dimension). */
export function pointOf(dimension: string, member: string, model: AnalyticsModel): MarkPoint | null {
  const dim = model.dimensions.find((d) => d.key === dimension)
  if (!dim || dim.kind !== 'category' || member === '') return null
  return { dimension, member }
}

const same = (a: CrossFilter, b: CrossFilter) => a.source === b.source && a.dimension === b.dimension && a.member === b.member

/** A click sets the cross-filter; the same mark clicked again clears it; any other mark replaces it. */
export function toggleCrossFilter(current: CrossFilter | null | undefined, clicked: CrossFilter): CrossFilter | null {
  return current && same(current, clicked) ? null : clicked
}

/**
 * The dimensions drill by offers, in the model's order: every category dimension that EVERY measure of
 * the view may be broken down by, except the ones the (drilled) view already shows or has drilled through.
 */
export function drillTargets(view: AnalyticsViewDefinition, model: AnalyticsModel, steps: readonly DrillStep[]): string[] {
  const measures = view.query.measures.map((k) => model.measures.find((m) => m.key === k))
  const used = new Set([...view.query.dimensions, ...steps.flatMap((s) => [s.dimension, s.into])])
  return model.dimensions
    .filter((d) => d.kind === 'category' && !used.has(d.key))
    .filter((d) => measures.length > 0 && measures.every((m) => m?.dimensions.includes(d.key)))
    .map((d) => d.key)
}

/** One crumb: the breakdown shown at that depth, and the point it was drilled from (none for the view). */
export interface Crumb {
  depth: number
  dimension: string
  member: MarkPoint | null
}

export function crumbsOf(view: AnalyticsViewDefinition, steps: readonly DrillStep[]): Crumb[] {
  return [
    { depth: 0, dimension: view.query.dimensions[0] ?? '', member: null },
    ...steps.map((s, i) => ({ depth: i + 1, dimension: s.into, member: { dimension: s.dimension, member: s.member } })),
  ]
}
