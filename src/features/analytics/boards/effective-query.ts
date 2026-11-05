import type {
  AnalyticsBoardPanel,
  AnalyticsFilter,
  AnalyticsModel,
  AnalyticsQueryInput,
  AnalyticsViewDefinition,
  BoardFilterKey,
  BoardFilters,
  BoardPeriod,
} from '@/core/models/analytics'
import { measureOf } from './wire'

/**
 * A board panel's effective query (spec 766 §F, ticket 771) — pure: the panel's saved view, plus every
 * board filter that reaches it, resolved to ONE canonical `Analytics/Query` input. The input is the
 * panel's TanStack Query key, so the same inputs are the same entry and a changed filter re-runs only
 * the panels it reaches.
 *
 * A board filter reaches a panel unless the panel opted out of it, or none of the view's measures may
 * be broken down by that dimension in the model (a channel filter never reaches till sales).
 * The period goes as the RELATIVE token, which the server resolves, so a saved board keeps its meaning.
 *
 * The cross-filter (772) is one member clicked on one panel. It reaches every other panel, unless the
 * panel opted out of `crossFilter` or its measures never break down by that dimension; its source panel
 * keeps its key, so it does not re-run. A panel drilled by (772) asks its drilled definition INLINE.
 */

export type ViewPanel = Extract<AnalyticsBoardPanel, { kind: 'view' }>

/** One view panel with what it links to: its view's definition and revision, and the model. */
export interface PanelSource {
  panel: ViewPanel
  view: AnalyticsViewDefinition
  revision: number
  model: AnalyticsModel
}

/** The cross-filter: the member clicked on panel `source`, in the dimension that mark stands for. */
export interface CrossFilter {
  source: string
  dimension: string
  member: string
}

/** One step of drill by: from the point `dimension = member`, break the panel down by `into`. */
export interface DrillStep {
  dimension: string
  member: string
  into: string
}

/** The board-wide state every panel's query is made from. */
export interface BoardContext {
  filters: BoardFilters
  crossFilter?: CrossFilter | null
}

/** Each category filter of the strip → the model dimension it filters. */
export const FILTER_DIMENSIONS = {
  city: 'city',
  region: 'region',
  store: 'store',
  channel: 'channel_group',
  country: 'country',
} as const satisfies Record<Exclude<BoardFilterKey, 'period' | 'crossFilter'>, string>

export type CategoryFilterKey = keyof typeof FILTER_DIMENSIONS
export const CATEGORY_FILTERS = Object.keys(FILTER_DIMENSIONS) as CategoryFilterKey[]

/** The period as the wire carries it: the relative token, or a fixed range `from..to` (⚠). */
export const periodToken = (p: BoardPeriod): string => (p.kind === 'relative' ? p.token : `${p.from}..${p.to}`)

const canonical = (values: readonly string[]) => [...new Set(values)].sort()

/**
 * The view's definition drilled by `steps` (772): each step's point becomes a filter and its `into` the
 * breakdown, in place of the first dimension. Not saved — "Save as view" (775) is what keeps it.
 */
export function drilledDefinition(view: AnalyticsViewDefinition, steps: readonly DrillStep[]): AnalyticsViewDefinition {
  if (steps.length === 0) return view
  const [, ...rest] = view.query.dimensions
  const last = steps[steps.length - 1]
  return {
    ...view,
    query: {
      ...view.query,
      dimensions: [last.into, ...rest.filter((d) => d !== last.into && !steps.some((s) => s.dimension === d))],
      filters: [...view.query.filters, ...steps.map((s) => ({ dimension: s.dimension, values: [s.member] }))],
    },
  }
}

export function effectiveQuery(
  { panel, view, revision, model }: PanelSource,
  { filters, crossFilter }: BoardContext,
  drill: readonly DrillStep[] = [],
): AnalyticsQueryInput {
  const opted = new Set(panel.optOut)
  const measures = view.query.measures.map((k) => measureOf(model, k))
  const breaksBy = (dimension: string) => measures.some((m) => m?.dimensions.includes(dimension))

  const reached: AnalyticsFilter[] = CATEGORY_FILTERS.filter((f) => !opted.has(f) && filters[f].length > 0 && breaksBy(FILTER_DIMENSIONS[f]))
    .map((f) => ({ dimension: FILTER_DIMENSIONS[f], values: canonical(filters[f]) }))
    .sort((a, b) => (a.dimension < b.dimension ? -1 : a.dimension > b.dimension ? 1 : 0))

  const crossed =
    crossFilter && crossFilter.source !== panel.id && !opted.has('crossFilter') && breaksBy(crossFilter.dimension)
      ? { crossFilter: { dimension: crossFilter.dimension, values: [crossFilter.member] } }
      : {}

  return {
    ...(drill.length ? { definition: drilledDefinition(view, drill) } : { viewId: panel.viewId, revision }),
    ...(opted.has('period') ? {} : { period: periodToken(filters.period) }),
    filters: reached,
    ...crossed,
  }
}

/** The canonical key of an effective query: equal inputs give equal strings (keys written in one order). */
export function panelKey(input: AnalyticsQueryInput): string {
  return JSON.stringify(input, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}
