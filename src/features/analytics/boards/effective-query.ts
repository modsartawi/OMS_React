import type {
  AnalyticsBoardPanel,
  AnalyticsFilter,
  AnalyticsModel,
  AnalyticsQueryInput,
  AnalyticsViewQuery,
  AnalyticsViewDefinition,
  BoardPeriod,
  Bindings,
  Param,
} from '@/core/models/analytics'
import { boardPeriodOf, valueOf, type ParamValues } from './params'
import { seriesBindReason } from './series'
import { measureOf } from './wire'

/**
 * A board panel's effective query (spec 766 §F, ticket 771) — pure: the panel's saved view, plus every
 * board filter that reaches it, resolved to ONE canonical `Analytics/Query` input. The input is the
 * panel's TanStack Query key, so the same inputs are the same entry and a changed filter re-runs only
 * the panels it reaches.
 *
 * Since 819 (ticket 821) the board's state is its parameters' values: a parameter reaches a panel when the
 * board BINDS it there. A bound `members` parameter filters the dimension its binding names, unless none
 * of the view's measures may be broken down by it in the model (a channel filter never reaches till
 * sales) — v1's rule, which the server applies today. A bound period goes as the RELATIVE token, which
 * the server resolves, so a saved board keeps its meaning. The other kinds have no wire yet (no new door
 * in 821): they reach nothing until their tickets add them.
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

/** The board-wide state every panel's query is made from: the parameters, their bindings and values. */
export interface BoardContext {
  params: readonly Param[]
  bindings: Bindings
  values: ParamValues
  crossFilter?: CrossFilter | null
  /**
   * 823: the saved item whose parameters these are, when the server sent them (`params` + `bindings` on
   * the wire): its panels ask by item (`{ itemId, revision, panelId, values }`) and the server applies the
   * bindings. Absent for a v1 board the web converted (821): a server that has not converted it cannot
   * apply bindings, so it keeps v1's resolved wire.
   */
  item?: { id: string; revision: number } | null
  /**
   * 828: a report's draft in the designer — not saved yet, or edited since its revision: every panel asks with
   * its inline definition and the draft's parameters and bindings (`{ definition, params, bindings, panelId,
   * values }`), never by item, which would run the saved revision instead.
   */
  inline?: boolean
}

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

/** A v1 board's context (no `item`) gives v1's resolved form; one with an `item` asks by item (823), a draft (`inline`, 828) inline. */
export function effectiveQuery(source: PanelSource, context: BoardContext & { item?: null; inline?: false }, drill?: readonly DrillStep[]): AnalyticsViewQuery
export function effectiveQuery(source: PanelSource, context: BoardContext, drill?: readonly DrillStep[]): AnalyticsQueryInput
export function effectiveQuery(
  { panel, view, revision, model }: PanelSource,
  { params, bindings, values, crossFilter, item, inline }: BoardContext,
  drill: readonly DrillStep[] = [],
): AnalyticsQueryInput {
  const measures = view.query.measures.map((k) => measureOf(model, k))
  const breaksBy = (dimension: string) => measures.some((m) => m?.dimensions.includes(dimension))
  const crossed =
    crossFilter && crossFilter.source !== panel.id && !panel.optOut.includes('crossFilter') && breaksBy(crossFilter.dimension)
      ? { crossFilter: { dimension: crossFilter.dimension, values: [crossFilter.member] } }
      : {}

  if (item || inline) {
    return {
      ...(drill.length || inline || !item ? { definition: drilledDefinition(view, drill), params: [...params], bindings } : { itemId: item.id, revision: item.revision }),
      panelId: panel.id,
      values: boundValues(params, bindings, values, panel.id),
      ...crossed,
      ...comparing(view),
    }
  }

  let period: string | null = null
  const reached: AnalyticsFilter[] = []
  for (const param of params) {
    const bound = bindings[param.name]?.[panel.id]
    if (!bound) continue
    const value = valueOf(param, values)
    if (value.kind === 'period') {
      const p = boardPeriodOf(value)
      if (p) period = periodToken(p)
    } else if (value.kind === 'members') {
      const dimension = typeof bound === 'string' ? bound : param.dimension
      // 825: a dimension the panel's own series filter on is theirs (`seriesFilters`): the parameter never reaches it.
      if (dimension && value.values.length > 0 && breaksBy(dimension) && !seriesBindReason(dimension, view)) reached.push({ dimension, values: canonical(value.values) })
    }
  }
  reached.sort((a, b) => (a.dimension < b.dimension ? -1 : a.dimension > b.dimension ? 1 : 0))

  return {
    ...(drill.length ? { definition: drilledDefinition(view, drill) } : { viewId: panel.viewId, revision }),
    ...(period === null ? {} : { period }),
    filters: reached,
    ...crossed,
    // 766 §C: the previous period's rows ride back when the view compares to it (story 23).
    ...comparing(view),
  }
}

/**
 * The values of the parameters bound to one panel (823), canonical — members sorted and de-duplicated — so
 * equal choices give equal keys, and a parameter bound elsewhere never re-keys this panel.
 */
export function boundValues(params: readonly Param[], bindings: Bindings, values: ParamValues, panelId: string): ParamValues {
  const out: ParamValues = {}
  for (const param of params) {
    if (!bindings[param.name]?.[panelId]) continue
    const v = valueOf(param, values)
    out[param.name] = v.kind === 'members' ? { kind: 'members', values: canonical(v.values) } : v
  }
  return out
}

/**
 * The period a panel is asked over, for drill to detail (774): the bound period parameter's (a relative
 * token, or `from..to`), else the view's own.
 */
export function panelPeriod(panel: ViewPanel, view: AnalyticsViewDefinition, { params, bindings, values }: BoardContext): string | null {
  for (const param of params) {
    if (param.kind !== 'period' || !bindings[param.name]?.[panel.id]) continue
    const p = boardPeriodOf(valueOf(param, values))
    if (p) return periodToken(p)
  }
  return view.query.period ?? null
}

/** `{ compareToPrevious: true }` when the view compares with the previous period; nothing otherwise. */
export const comparing = (view: AnalyticsViewDefinition): { compareToPrevious?: true } =>
  view.query.compareToPrevious ? { compareToPrevious: true } : {}

/** The canonical key of an effective query: equal inputs give equal strings (keys written in one order). */
export function panelKey(input: AnalyticsQueryInput): string {
  return JSON.stringify(input, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}
