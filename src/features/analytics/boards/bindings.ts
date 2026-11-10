import type { AnalyticsModel, AnalyticsViewDefinition, BindReason, Bindings, Param, ParamKind } from '@/core/models/analytics'
import { isReservedName, TOP_N_MAX, TOP_N_MIN } from './params'
import { seriesBindReason, seriesOf } from './series'
import { chartOffers, choiceOf } from './shape-rules'
import { GRAINS } from './editor'
import { dimensionOf, measureOf } from './wire'

/**
 * The binding module (spec 819 §E, 797 §4–5, 799 §2; ticket 824) — pure, mirrored from the server's rules
 * for instant feedback (the server stays the authority, and refuses at save with `ANALYTICS-411`). A panel
 * is judged by its view's definition and the model: its measures, its dimensions (time or category), its
 * chart type and its named series. `bind-cases.json` beside this module is the case table the server's
 * validator reads too.
 */

export type BindCheck = { ok: true; target?: string } | { ok: false; reason: BindReason }

const no = (reason: BindReason): BindCheck => ({ ok: false, reason })

/** Whether this view's measures break down by a dimension: v1's rule for a filter reaching a panel (`effectiveQuery`). */
const breaksBy = (view: AnalyticsViewDefinition, model: AnalyticsModel, dimension: string) =>
  view.query.measures.some((k) => measureOf(model, k)?.dimensions.includes(dimension))

/** Whether the chart the view saved is still offered for this selection (v1's shape table). */
function fits(view: AnalyticsViewDefinition, model: AnalyticsModel, measures: readonly string[], dimensions: readonly string[]): boolean {
  const choice = choiceOf(view.chart)
  const offer = chartOffers({ measures, dimensions, series: seriesOf(view).length, calculations: view.query.calculations?.length ?? 0 }, model).find((o) => o.choice === choice)
  return !!offer?.offered
}

/**
 * Whether a parameter can bind to a panel, and to which dimension for a `members` one (`target` points it
 * at another dimension on this panel, else its own):
 * - **period** binds anywhere;
 * - **grain** needs a time axis;
 * - **members** needs a category dimension the panel's measures break down by (its area), that none of
 *   the panel's series filter on;
 * - **threshold** needs that measure and a category breakdown — a KPI cannot filter itself to empty;
 * - **top N** needs one category dimension and no time axis;
 * - **measure** needs a one-measure panel where every option is in the same area, breaks down by the
 *   panel's dimensions and keeps its chart (the shape table);
 * - **breakdown** needs a category axis where every option is a category the measures break down by, no
 *   series filters on it, and the chart still fits.
 * ⚠ The 92-day percentile cap on a measure option is the server's to check at save (it needs the period).
 */
export function canBind(param: Param, view: AnalyticsViewDefinition, model: AnalyticsModel, target?: string): BindCheck {
  const dims = view.query.dimensions
  const time = dims.filter((k) => dimensionOf(model, k)?.kind === 'time')
  const cats = dims.filter((k) => dimensionOf(model, k)?.kind === 'category')
  const kpi = view.chart.type === 'kpi'
  switch (param.kind) {
    case 'period':
      return { ok: true }
    case 'grain':
      return time.length > 0 ? { ok: true } : no('noTimeAxis')
    case 'members': {
      const dim = target ?? param.dimension ?? ''
      if (dimensionOf(model, dim)?.kind !== 'category' || !breaksBy(view, model, dim)) return no('notInArea')
      return seriesBindReason(dim, view) ? no('seriesFilters') : { ok: true, target: dim }
    }
    case 'threshold':
      return !kpi && cats.length > 0 && !!param.measure && view.query.measures.includes(param.measure) ? { ok: true } : no('thresholdShape')
    case 'topN':
      return !kpi && cats.length === 1 && time.length === 0 ? { ok: true } : no('topNShape')
    case 'measure': {
      const options = param.options ?? []
      const own = view.query.measures.length === 1 ? measureOf(model, view.query.measures[0]) : null
      const each = (key: string) => {
        const m = measureOf(model, key)
        return !!m && !!own && m.area === own.area && dims.every((d) => m.dimensions.includes(d)) && fits(view, model, [key], dims)
      }
      return own && options.length > 0 && options.every(each) ? { ok: true } : no('measureShape')
    }
    case 'breakdown': {
      const options = param.options ?? []
      const axis = cats[0]
      const each = (key: string) =>
        dimensionOf(model, key)?.kind === 'category' &&
        view.query.measures.every((m) => measureOf(model, m)?.dimensions.includes(key)) &&
        !seriesBindReason(key, view) &&
        fits(
          view,
          model,
          view.query.measures,
          dims.map((d) => (d === axis ? key : d)),
        )
      return !kpi && !!axis && options.length > 0 && options.every(each) ? { ok: true } : no('breakdownShape')
    }
  }
}

/** A panel as the binding module sees it: its id, and its view's definition — `null` while unknown (loading, removed). */
export interface BindPanel {
  id: string
  definition: AnalyticsViewDefinition | null
}

/** Adding a parameter binds it to every panel that can take it (797 §4); a panel not known yet is left out. */
export function prefill(param: Param, panels: readonly BindPanel[], model: AnalyticsModel): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (const p of panels) {
    if (!p.definition) continue
    const c = canBind(param, p.definition, model)
    if (c.ok) out[p.id] = c.target ?? true
  }
  return out
}

/**
 * A declaration problem, as `ANALYTICS-411`'s `data.problems[]` lists it (⚠ the web's shape, from the 798
 * prototype's `validate`): a name, a binding (the parameter, the panel and why), or a default the
 * parameter itself refuses. Series problems (825) ride the same list as `{ what: 'series', … }`.
 */
export type ParamProblem =
  | { what: 'name'; param: string; why: 'slug' | 'reserved' | 'duplicate' }
  | { what: 'binding'; param: string; panel: string; reason: BindReason }
  | { what: 'default'; param: string }

/** A parameter's name is its URL key: lower-case letters, digits and dashes, starting with a letter. */
export const PARAM_NAME = /^[a-z][a-z0-9-]*$/

/** What is wrong with a name, live: reserved, not a slug, or already taken by another parameter (`taken`). */
export function nameProblem(name: string, taken: readonly string[]): 'slug' | 'reserved' | 'duplicate' | null {
  if (isReservedName(name)) return 'reserved'
  if (!PARAM_NAME.test(name)) return 'slug'
  return taken.includes(name) ? 'duplicate' : null
}

/** Whether the parameter itself accepts its default (797 §2: every parameter has one a scheduled run can use). */
export function defaultFits(param: Param): boolean {
  const d = param.default
  if (d.kind !== param.kind) return false
  switch (d.kind) {
    case 'period':
      return true
    case 'members':
      return (!param.pinned || d.values.every((v) => param.pinned!.includes(v))) && (param.multi !== false || d.values.length <= 1)
    case 'grain':
      return !param.grains?.length || param.grains.includes(d.grain)
    case 'threshold':
      return Number.isFinite(d.value) && !(param.required && d.op === 'off')
    case 'topN':
      return Number.isInteger(d.n) && d.n >= TOP_N_MIN && d.n <= TOP_N_MAX
    case 'measure':
    case 'breakdown':
      return (param.options ?? []).includes(d.key)
  }
}

/**
 * The save-time checks (the server's `ANALYTICS-411` is the authority): each name, each binding to a panel
 * whose view is known, each default. A binding to a panel no longer on the item is left out (it is dropped
 * with the panel); one to a panel still loading is the server's to judge.
 */
export function validate(params: readonly Param[], bindings: Bindings, panels: readonly BindPanel[], model: AnalyticsModel): ParamProblem[] {
  const out: ParamProblem[] = []
  const seen: string[] = []
  for (const p of params) {
    const why = nameProblem(p.name, seen)
    if (why) out.push({ what: 'name', param: p.name, why })
    seen.push(p.name)
  }
  for (const p of params) {
    for (const [panelId, target] of Object.entries(bindings[p.name] ?? {})) {
      const definition = panels.find((x) => x.id === panelId)?.definition
      if (!definition) continue
      const c = canBind(p, definition, model, typeof target === 'string' ? target : undefined)
      if (!c.ok) out.push({ what: 'binding', param: p.name, panel: panelId, reason: c.reason })
    }
  }
  for (const p of params) if (!defaultFits(p)) out.push({ what: 'default', param: p.name })
  return out
}

// ── Declaring (the parameter inspector's operations; 829's report designer reuses them) ───────────────────

/** An item's parameters and their bindings. */
export interface Declarations {
  params: Param[]
  bindings: Bindings
}

const BASE_NAMES: Record<ParamKind, string> = { period: 'period', members: 'members', grain: 'grain', threshold: 'threshold', topN: 'top', measure: 'figure', breakdown: 'split' }

/** A fresh parameter of a kind, with a free name (`members`, `members-2`, …) and a default it accepts, from this model. */
export function blankParam(kind: ParamKind, taken: readonly string[], model: AnalyticsModel): Param {
  const base = BASE_NAMES[kind]
  let name = base
  for (let i = 2; taken.includes(name); i++) name = `${base}-${i}`
  const label = { en: '', ar: '' }
  const categories = model.dimensions.filter((d) => d.kind === 'category').map((d) => d.key)
  const first = model.measures[0]
  switch (kind) {
    case 'period':
      return { name, kind, label, required: true, default: { kind, token: 'yesterday' } }
    case 'members':
      return { name, kind, label, required: false, dimension: categories[0] ?? '', pinned: null, multi: true, default: { kind, values: [] } }
    case 'grain':
      return { name, kind, label, required: true, grains: [...GRAINS], default: { kind, grain: 'day' } }
    case 'threshold':
      return { name, kind, label, required: false, measure: (model.measures.find((m) => m.shape === 'rate') ?? first)?.key ?? '', default: { kind, op: 'off', value: 5 } }
    case 'topN':
      return { name, kind, label, required: true, default: { kind, n: 10 } }
    case 'measure': {
      const options = model.measures.filter((m) => m.area === first?.area).slice(0, 2).map((m) => m.key)
      return { name, kind, label, required: true, options, default: { kind, key: options[0] ?? '' } }
    }
    case 'breakdown': {
      const options = categories.slice(0, 3)
      return { name, kind, label, required: true, options, default: { kind, key: options[0] ?? '' } }
    }
  }
}

/** Adds a parameter, bound to every panel that can take it. */
export function addParam(decl: Declarations, param: Param, panels: readonly BindPanel[], model: AnalyticsModel): Declarations {
  return { params: [...decl.params, param], bindings: { ...decl.bindings, [param.name]: prefill(param, panels, model) } }
}

/**
 * Changes a parameter in place (its position kept). A rename carries its bindings to the new name; a new
 * kind, or a `members` parameter pointed at another dimension, pre-fills its bindings again; any other
 * change keeps the author's bindings as they are.
 */
export function changeParam(decl: Declarations, name: string, next: Param, panels: readonly BindPanel[], model: AnalyticsModel): Declarations {
  const before = decl.params.find((p) => p.name === name)
  if (!before) return decl
  const again = before.kind !== next.kind || (next.kind === 'members' && before.dimension !== next.dimension)
  const { [name]: kept = {}, ...rest } = decl.bindings
  return {
    params: decl.params.map((p) => (p.name === name ? next : p)),
    bindings: { ...rest, [next.name]: again ? prefill(next, panels, model) : kept },
  }
}

/** Removes a parameter, a ready-made one too (797 item 6), and its bindings. */
export function removeParam(decl: Declarations, name: string): Declarations {
  const { [name]: _gone, ...bindings } = decl.bindings
  void _gone
  return { params: decl.params.filter((p) => p.name !== name), bindings }
}

/** Binds a parameter to a panel (`true`, or the dimension a `members` one filters there), or unbinds it (`null`). */
export function bind(decl: Declarations, name: string, panelId: string, target: string | true | null): Declarations {
  const { [panelId]: _was, ...others } = decl.bindings[name] ?? {}
  void _was
  return { ...decl, bindings: { ...decl.bindings, [name]: target === null ? others : { ...others, [panelId]: target } } }
}

/** A panel added to the item: every parameter that can take it binds to it (797 §4, as v1's filters reached a new panel). */
export function bindPanel(decl: Declarations, panel: BindPanel, model: AnalyticsModel): Declarations {
  let next = decl
  for (const p of decl.params) {
    const c = panel.definition ? canBind(p, panel.definition, model) : null
    if (c?.ok) next = bind(next, p.name, panel.id, c.target ?? true)
  }
  return next
}

/** Bindings to panels still on the item only. */
export const keptBindings = (bindings: Bindings, panelIds: ReadonlySet<string>): Bindings =>
  Object.fromEntries(Object.entries(bindings).map(([name, bound]) => [name, Object.fromEntries(Object.entries(bound).filter(([id]) => panelIds.has(id)))]))

export type OverviewCell =
  | { panel: string; state: 'bound'; target: string | true }
  | { panel: string; state: 'unbound' }
  /** Not bound, and it cannot be: why. */
  | { panel: string; state: 'cannot'; reason: BindReason }
  /** Bound, but the binding does not fit (save refuses it): why. */
  | { panel: string; state: 'broken'; reason: BindReason }

/** The binding overview (spec 819 §E): parameters × panels, each cell bound, unbound, can't and why, or broken. */
export function overview(decl: Declarations, panels: readonly BindPanel[], model: AnalyticsModel): { param: string; cells: OverviewCell[] }[] {
  return decl.params.map((p) => ({
    param: p.name,
    cells: panels.map((panel): OverviewCell => {
      const bound = decl.bindings[p.name]?.[panel.id]
      const c = panel.definition ? canBind(p, panel.definition, model, typeof bound === 'string' ? bound : undefined) : null
      if (bound !== undefined) return c && !c.ok ? { panel: panel.id, state: 'broken', reason: c.reason } : { panel: panel.id, state: 'bound', target: bound }
      return c && !c.ok ? { panel: panel.id, state: 'cannot', reason: c.reason } : { panel: panel.id, state: 'unbound' }
    }),
  }))
}
