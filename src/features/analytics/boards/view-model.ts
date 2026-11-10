import { assignSlots, type SlotRule } from '@/core/charts/slots'
import { saysIn } from '@/core/rules/sentence'
import type {
  AnalyticsModel,
  AnalyticsQueryResult,
  AnalyticsViewDefinition,
  MeasureShape,
  MeasureUnit,
} from '@/core/models/analytics'
import { dimensionOf, measureOf } from './wire'
import { drawnResult } from './unsplit'

/**
 * The result → view model (spec 766 §F, ticket 767): one `Analytics/Query` answer, its definition and
 * the model, turned into exactly what a `core/charts` form draws. Pure — every rule a chart obeys is
 * decided here and proven in `view-model.test.ts`; the components only render it.
 *
 * Slice 0 builds the bar view (one measure × one category). 768 adds the time forms, the top 5 plus
 * "Other", compare-previous and the formats by unit beside {@link toBarView}, reusing
 * {@link viewMeasureOf} and {@link slotRuleFor}; a model label reads through core's `saysIn`.
 */

export interface ViewMeasure {
  key: string
  label: string
  unit: MeasureUnit
  shape: MeasureShape
}

export interface BarPoint {
  /** The member's key, as the server sent it. */
  member: string
  /** What the axis and tooltip say: the model's label for a fixed value, else the member itself. */
  label: string
  value: number | null
  /** Its colour slot (`@/core/charts/slots`), `null` when none is free. */
  slot: number | null
}

export interface BarView {
  kind: 'bar'
  orientation: 'vertical' | 'horizontal'
  measure: ViewMeasure
  category: { key: string; label: string }
  points: BarPoint[]
  /**
   * `member` — each bar in its entity's colour (a fixed dimension, or a saved slot map).
   * `single` — one series, one colour: an open breakdown nobody has assigned colours to.
   */
  colourBy: 'member' | 'single'
  empty: boolean
  truncated: boolean
}

/** The measure as the model describes it; the result column's own shape and unit win when sent. */
export function viewMeasureOf(key: string, model: AnalyticsModel, result: AnalyticsQueryResult, lang: string): ViewMeasure {
  const m = measureOf(model, key)
  const col = result.columns.find((c) => c.key === key)
  return {
    key,
    label: saysIn(m?.label, lang) || key,
    unit: col?.unit ?? m?.unit ?? 'count',
    shape: col?.shape ?? m?.shape ?? 'additive',
  }
}

/** Which slot rule colours a breakdown: fixed for an inline-valued dimension, else the saved map. */
export function slotRuleFor(dimension: string, model: AnalyticsModel, definition: AnalyticsViewDefinition): SlotRule | null {
  const dim = dimensionOf(model, dimension)
  if (dim && dim.values.length > 0) return { kind: 'fixed', order: dim.values.map((v) => v.key) }
  const saved = definition.slots?.[dimension]
  return saved ? { kind: 'saved', map: saved } : null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export function toBarView(
  result: AnalyticsQueryResult,
  definition: AnalyticsViewDefinition,
  model: AnalyticsModel,
  lang: string,
): BarView {
  // 864 (spec 3543 decision 12): an "All" row of a cross-area answer is never drawn (`./unsplit`).
  result = drawnResult(result)
  const measureKey = definition.query.measures[0] ?? result.columns.find((c) => c.role === 'measure')?.key ?? ''
  const categoryKey = definition.query.dimensions[0] ?? result.columns.find((c) => c.role === 'dimension')?.key ?? ''
  const dim = dimensionOf(model, categoryKey)
  const valueLabel = new Map(dim?.values.map((v) => [v.key, saysIn(v.label, lang)]) ?? [])

  const members = result.rows.map((r) => String(r[categoryKey] ?? ''))
  const rule = slotRuleFor(categoryKey, model, definition)
  const slots = rule ? assignSlots(members, rule) : null

  return {
    kind: 'bar',
    orientation: definition.chart.orientation ?? 'vertical',
    measure: viewMeasureOf(measureKey, model, result, lang),
    category: { key: categoryKey, label: saysIn(dim?.label, lang) || categoryKey },
    points: result.rows.map((row, i) => {
      const member = members[i]
      return {
        member,
        label: valueLabel.get(member) || member,
        value: num(row[measureKey]),
        slot: slots ? (slots.get(member) ?? null) : 0,
      }
    }),
    colourBy: slots ? 'member' : 'single',
    empty: result.rows.length === 0,
    truncated: result.truncated,
  }
}
