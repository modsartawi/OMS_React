import type { AnalyticsDimension, AnalyticsLabel, AnalyticsMeasure, AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { CALCULATION_KEY_PATTERN, MAX_VARIANTS, type AnalyticsVariant } from '@/core/models/analytics-calculations'
import { saysIn } from '@/core/rules/sentence'
import { labelOverride, settleCalculations } from './calculations-edit'
import { filterableDimensions, pickableMeasures } from './editor'
import { dimensionOf, measureOf } from './wire'

/**
 * Filtered measures — "variants" (ticket 863, BackOffice spec 3543 part B, decisions 5–8, the owner-kept 3546 defaults).
 * Pure: no React.
 *
 * A variant is a model measure under its own filters, named by a key (delivery value = till value where the delivery
 * type is DL). Its key is also listed in `query.measures`, which is what selects and places its column, so every
 * picker that reads the query's measures — the calculations, the sort, the chart shape table — sees it once the model
 * it asks knows the key: {@link variantModel} adds one measure per variant (its measure's shape and unit, decision 7).
 *
 * As in `./calculations-edit`, the web's copy of the server's rules only chooses what to offer; `AnalyticsVariants`
 * (SIS.Api) validates the same rules and refuses the rest with `ANALYTICS-406`.
 *
 * ⚠ 864 (cross-area) relaxes {@link variantMeasures}' one-area rule; the server does the same in 3548.
 */

/** Names in `lang` joined as a list ("Region and City", "المنطقة والمدينة"; "Delivery or Pickup" as a disjunction). */
export const listOf = (names: readonly string[], lang: string, type: 'conjunction' | 'disjunction' = 'conjunction'): string =>
  new Intl.ListFormat(lang, { type }).format(names)

/** A variant's default label, from the locale (`boards:variant.label`: "{{measure}} ({{values}})"). */
export type VariantWord = (names: { measure: string; values: string }) => string

/** What the author picks: the key is the builder's to give. */
export type VariantDraft = Omit<AnalyticsVariant, 'key'>

/** Why a variant cannot be added: each a `boards:editor.variant.why.<reason>` key. */
export type VariantProblem =
  /** Four per query (decision 5). */
  | 'full'
  /** Owner-kept 3546 default: a variant needs at least one filter holding a value. */
  | 'noFilter'
  /** Decision 6: a filter on a dimension the query breaks down by would leave a column of nulls. */
  | 'brokenDown'
  /** Decision 6: a filter on a dimension its measure's area lacks. */
  | 'notFilterable'
  /** Its measure is not one of the query's area (one area per query until 864). */
  | 'measure'
  /** Decision 5: the label is both languages or neither. */
  | 'oneLanguage'

/** Why a variant was taken out when the query changed under it: a `boards:editor.variant.dropped.<reason>` key. */
export interface DroppedVariant {
  variant: AnalyticsVariant
  reason: 'brokenDown' | 'measure'
}

const variantsOf = (def: AnalyticsViewDefinition) => def.query.variants ?? []

/**
 * The measures a variant may filter: the pickable measures of the query's own area (the area of its first model
 * measure), or every pickable measure before one is chosen. Model measures only — never a variant of a variant.
 */
export function variantMeasures(def: AnalyticsViewDefinition, model: AnalyticsModel): string[] {
  const own = new Set(variantsOf(def).map((v) => v.key))
  const area = def.query.measures.filter((k) => !own.has(k)).map((k) => measureOf(model, k)?.area).find(Boolean) ?? null
  return pickableMeasures(model)
    .filter((m) => !area || m.area === area)
    .map((m) => m.key)
}

/** The dimensions a variant of `measure` may filter on (decision 6): its own filterable breakdowns the query does not break down by. */
export function variantFilterDimensions(measure: string, queryDimensions: readonly string[], model: AnalyticsModel): AnalyticsDimension[] {
  const own = measureOf(model, measure)?.dimensions ?? []
  const dims = model.dimensions.filter((d) => own.includes(d.key) && !queryDimensions.includes(d.key))
  return filterableDimensions(dims)
}

const filled = (draft: VariantDraft) => draft.filters.filter((f) => f.values.length > 0)

/** Why `draft` cannot be added to `def`, or `null` when it can. */
export function variantProblem(draft: VariantDraft, def: AnalyticsViewDefinition, model: AnalyticsModel): VariantProblem | null {
  if (variantsOf(def).length >= MAX_VARIANTS) return 'full'
  if (!variantMeasures(def, model).includes(draft.measure)) return 'measure'
  const filters = filled(draft)
  if (filters.length === 0) return 'noFilter'
  if (filters.some((f) => def.query.dimensions.includes(f.dimension))) return 'brokenDown'
  const allowed = new Set(variantFilterDimensions(draft.measure, def.query.dimensions, model).map((d) => d.key))
  if (filters.some((f) => !allowed.has(f.dimension))) return 'notFilterable'
  if (draft.label && !labelOverride(draft.label).ok) return 'oneLanguage'
  return null
}

const clean = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_')

/**
 * A fresh key (3519's rule `[a-z][A-Za-z0-9_]{0,39}`): `<measure>_<filter values>`, cut to 40, then `_2`, `_3` while it is
 * taken by a measure, a dimension, a calculation or another variant.
 */
export function variantKey(draft: VariantDraft, def: AnalyticsViewDefinition): string {
  const raw = [clean(draft.measure), ...filled(draft).flatMap((f) => f.values.map(clean))].join('_')
  const base = (CALCULATION_KEY_PATTERN.test(raw.slice(0, 1)) ? raw : `v_${raw}`).slice(0, 40)
  const taken = new Set([...def.query.measures, ...def.query.dimensions, ...(def.query.calculations ?? []).map((c) => c.key), ...variantsOf(def).map((v) => v.key)])
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const tail = `_${n}`
    const key = base.slice(0, 40 - tail.length) + tail
    if (!taken.has(key)) return key
  }
}

/** A new variant, keyed, listed in the measures after the others. `def` unchanged when {@link variantProblem} refuses it. */
export function addVariant(def: AnalyticsViewDefinition, draft: VariantDraft, model: AnalyticsModel): AnalyticsViewDefinition {
  if (variantProblem(draft, def, model)) return def
  const label = draft.label ? labelOverride(draft.label) : null
  const variant: AnalyticsVariant = {
    key: variantKey(draft, def),
    measure: draft.measure,
    filters: filled(draft).map((f) => ({ dimension: f.dimension, values: [...f.values] })),
    ...(label?.ok && label.label ? { label: label.label } : {}),
  }
  return { ...def, query: { ...def.query, measures: [...def.query.measures, variant.key], variants: [...variantsOf(def), variant] } }
}

/** A variant's label set (both languages) or cleared (`undefined`, the derived default). */
export function relabelVariant(def: AnalyticsViewDefinition, key: string, label: AnalyticsLabel | undefined): AnalyticsViewDefinition {
  const variants = variantsOf(def).map((v) => {
    if (v.key !== key) return v
    const { label: _old, ...rest } = v
    void _old
    return label ? { ...rest, label } : rest
  })
  return { ...def, query: { ...def.query, variants } }
}

/** A variant taken out with its key, then the calculations that read it settled away (`./calculations-edit`). */
export function removeVariant(def: AnalyticsViewDefinition, key: string, model: AnalyticsModel): AnalyticsViewDefinition {
  const query = { ...def.query, measures: def.query.measures.filter((k) => k !== key), variants: variantsOf(def).filter((v) => v.key !== key) }
  return settleCalculations(settleVariants({ ...def, query }, model).definition, model).definition
}

/**
 * The variants re-checked against the query as it now is. One whose key left the measures (the author unticked it)
 * goes quietly; one whose filter is now on a breakdown, or whose measure left the query's area, goes with its key and
 * is reported. No variants leaves no `variants` at all. The calculations are the caller's to settle after.
 */
export function settleVariants(def: AnalyticsViewDefinition, model: AnalyticsModel): { definition: AnalyticsViewDefinition; dropped: DroppedVariant[] } {
  const all = variantsOf(def)
  if (all.length === 0 && !('variants' in def.query)) return { definition: def, dropped: [] }
  const dropped: DroppedVariant[] = []
  const shell = { ...def, query: { ...def.query, variants: [] } }
  const kept = all.filter((v) => {
    if (!def.query.measures.includes(v.key)) return false
    const reason = v.filters.some((f) => def.query.dimensions.includes(f.dimension))
      ? 'brokenDown'
      : !variantMeasures(shell, model).includes(v.measure)
        ? 'measure'
        : null
    if (reason) dropped.push({ variant: v, reason })
    return !reason
  })
  const gone = new Set(dropped.map((d) => d.variant.key))
  const { variants: _old, ...query } = def.query
  void _old
  const measures = def.query.measures.filter((k) => !gone.has(k))
  return { definition: { ...def, query: kept.length ? { ...query, measures, variants: kept } : { ...query, measures } }, dropped }
}

/** A filter value's name in `lang`: the dimension's inline label, else its code. */
const valueName = (dimension: string, value: string, model: Pick<AnalyticsModel, 'dimensions'>, lang: string) =>
  saysIn(dimensionOf(model, dimension)?.values.find((v) => v.key === value)?.label, lang) || value

/**
 * A variant's label in `lang`: its own (both languages), else "{measure} ({filter values})" — a filter's values read as
 * either ("Delivery or Pickup", they are any-of), the filters one after another.
 */
export function variantLabel(variant: Pick<AnalyticsVariant, 'measure' | 'filters' | 'label'>, model: Pick<AnalyticsModel, 'measures' | 'dimensions'>, lang: string, word: VariantWord): string {
  const own = saysIn(variant.label ?? undefined, lang)
  if (own) return own
  const measure = saysIn(measureOf(model, variant.measure)?.label, lang) || variant.measure
  const groups = variant.filters.map((f) => listOf(f.values.map((v) => valueName(f.dimension, v, model, lang)), lang, 'disjunction'))
  return word({ measure, values: new Intl.ListFormat(lang, { type: 'unit', style: 'short' }).format(groups) })
}

/**
 * `model` plus one measure per variant: its measure's shape, unit and area (decision 7), labelled in `lang`, and its
 * breakdowns less the ones it filters (so the breakdown picker never offers them, decision 6). The same object when
 * there are none, so a definition without variants reads exactly as before.
 */
export function variantModel(model: AnalyticsModel, variants: readonly AnalyticsVariant[] | null | undefined, lang: string, word: VariantWord): AnalyticsModel {
  const added: AnalyticsMeasure[] = (variants ?? [])
    .filter((v) => !measureOf(model, v.key))
    .flatMap((v) => {
      const base = measureOf(model, v.measure)
      if (!base) return []
      const filtered = new Set(v.filters.map((f) => f.dimension))
      const text = variantLabel(v, model, lang, word)
      return [{ ...base, key: v.key, label: { en: text, ar: text }, dimensions: base.dimensions.filter((d) => !filtered.has(d)) }]
    })
  return added.length ? { ...model, measures: [...model.measures, ...added] } : model
}

/**
 * The variants an edit took out (`before` → `after`) with why, for the editor's note — read by re-settling `after` with
 * `before`'s variants and their keys restored, so a variant the author unticked (no rule removed it) is not named.
 */
export function droppedVariantsBy(before: AnalyticsViewDefinition, after: AnalyticsViewDefinition, model: AnalyticsModel): DroppedVariant[] {
  const had = variantsOf(before)
  if (had.length === 0) return []
  const kept = new Set(variantsOf(after).map((v) => v.key))
  const lost = had.filter((v) => !kept.has(v.key))
  if (lost.length === 0) return []
  const measures = [...after.query.measures, ...lost.map((v) => v.key).filter((k) => !after.query.measures.includes(k))]
  return settleVariants({ ...after, query: { ...after.query, measures, variants: had } }, model).dropped.filter((d) => lost.includes(d.variant))
}
