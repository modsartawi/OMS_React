import { NEW_VIEW_PATH } from '@/core/analytics-routes'
import { assignSlots, CHART_SLOT_COUNT } from '@/core/charts/slots'
import { saysIn } from '@/core/rules/sentence'
import { formatPair } from '@/core/util/bidi'
import type { AnalyticsItem, AnalyticsLabel, AnalyticsModel, AnalyticsSemanticQuery, AnalyticsViewDefinition } from '@/core/models/analytics'
import { editingItemOf, type EditingItem } from './item-save'
import type { ChartChoice } from './shape-rules'
export { DEFAULT_PERIOD, PERIODS } from './periods'
import { dimensionOf, measureOf, readDefinition } from './wire'

/**
 * The chart editor's pure pieces (ticket 775) beside the shape rules (`./shape-rules`) and the generated
 * title (`./title`): what may be picked from the model, which breakdown is coloured, how a colour pick
 * moves the saved member → slot map, and how a caller opens the editor seeded with a definition.
 */

export const NUMBER_FORMATS = ['auto', 'integer', 'decimal', 'percent', 'SAR', 'minutes'] as const
export const LEGEND_POSITIONS = ['bottom', 'top', 'end', 'hidden'] as const

/** A breakdown cap: a table takes up to three (755 Q3), and nothing takes more. */
export const MAX_DIMENSIONS = 3

/** The measures that may be picked: those whose area is available. The rest are shown with its reason. */
export function pickableMeasures(model: AnalyticsModel) {
  const unavailable = new Set(model.areas.filter((a) => !a.available).map((a) => a.key))
  return model.measures.filter((m) => !unavailable.has(m.area))
}

/** The breakdowns every chosen measure allows (all of them before a measure is chosen), in model order. */
export function allowedDimensions(measures: readonly string[], model: AnalyticsModel) {
  const chosen = measures.map((k) => measureOf(model, k)).filter((m) => !!m)
  return model.dimensions.filter((d) => chosen.every((m) => m.dimensions.includes(d.key)))
}

/**
 * The breakdown a chart colours by: its last category (non-time) breakdown — a bar's or donut's own
 * category, a line's or area's series, a two-breakdown bar's second. `null` when it has none.
 */
export function colourDimension(definition: AnalyticsViewDefinition, model: AnalyticsModel): string | null {
  const cats = definition.query.dimensions.filter((k) => dimensionOf(model, k)?.kind !== 'time')
  return cats.at(-1) ?? null
}

/**
 * `member` takes `slot`; the member that held it takes `member`'s old one, so no two share a colour.
 * `members` are the ones on screen, assigned by the entity rule first, so the swap sees real slots.
 */
export function withMemberSlot(
  saved: Readonly<Record<string, number>>,
  members: readonly string[],
  member: string,
  slot: number,
): Record<string, number> {
  const now = settledSlots(saved, members)
  const before = now[member]
  const next = { ...now }
  for (const [m, s] of Object.entries(now)) if (s === slot && m !== member) {
    if (before === undefined) delete next[m]
    else next[m] = before
  }
  next[member] = slot
  return next
}

/**
 * A colour-picker member as the editor shows it (ticket 775's picker, review fix): the model's inline label
 * (free text, `<bdi>`); else the name `Analytics/DimensionValues` gives it, as one `code · name` pair (a machine
 * value led pair, `Ltr` once); else its code alone. Never the bare key when a name is known.
 */
export function colourMemberWords(
  dimension: string,
  member: string,
  model: AnalyticsModel,
  names: ReadonlyMap<string, AnalyticsLabel>,
  lang: string,
): { text: string; kind: 'text' | 'machine' } {
  const inline = saysIn(dimensionOf(model, dimension)?.values.find((v) => v.key === member)?.label, lang)
  if (inline) return { text: inline, kind: 'text' }
  const name = saysIn(names.get(member), lang)
  return { text: name && name !== member ? formatPair(member, name) : member, kind: 'machine' }
}

/**
 * Compare with the previous period (766 story 23, §C `compareToPrevious`) is offered where the shape shows it:
 * a KPI's ▲▼ against the previous figure, and a line over time drawing the previous period beside it.
 */
export const comparesToPrevious = (choice: ChartChoice | null): boolean => choice === 'kpi' || choice === 'line'

/** The query with `compareToPrevious` stored when it is on and the chosen type offers it, and left out otherwise. */
export function withCompare<Q extends AnalyticsSemanticQuery>(query: Q, choice: ChartChoice | null, on: boolean): Q {
  const { compareToPrevious: _, ...rest } = query
  return (on && comparesToPrevious(choice) ? { ...rest, compareToPrevious: true } : rest) as Q
}

/** The saved map plus a slot for every member on screen that finds one free (written when saved). */
export function settledSlots(saved: Readonly<Record<string, number>>, members: readonly string[]): Record<string, number> {
  const out: Record<string, number> = { ...saved }
  for (const [m, s] of assignSlots(members, { kind: 'saved', map: saved })) if (s !== null && s < CHART_SLOT_COUNT) out[m] = s
  return out
}

// ── Opening the editor seeded (772's drill "Save as view", 776) ─────────────────────────────────────────

export { NEW_VIEW_PATH }

/**
 * What a caller may hand the editor: a definition, and optionally a title it already has. `item` (776) is the
 * existing item being edited: its id, revision and standing, so the save is in place or a copy, not a new item.
 */
export interface EditorSeed {
  definition: AnalyticsViewDefinition
  title?: AnalyticsLabel
  subtitle?: AnalyticsLabel
  item?: EditingItem
}

/**
 * A `<Link>`/`navigate` target that opens the view editor seeded: `navigate(to, { state })`. The seed
 * rides in ROUTE STATE (not the URL), so it is lost on a hard reload, when the editor opens empty.
 */
export function newViewLink(seed?: EditorSeed): { to: string; state: { editorSeed: EditorSeed } | null } {
  return { to: NEW_VIEW_PATH, state: seed ? { editorSeed: seed } : null }
}

/** The seed in a location's state, read defensively; `null` when there is none. */
export function readEditorSeed(state: unknown): EditorSeed | null {
  const raw = state && typeof state === 'object' ? (state as Record<string, unknown>).editorSeed : null
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (!s.definition || typeof s.definition !== 'object') return null
  const said = (v: unknown): AnalyticsLabel | undefined => {
    if (!v || typeof v !== 'object') return undefined
    const o = v as Record<string, unknown>
    return { en: typeof o.en === 'string' ? o.en : '', ar: typeof o.ar === 'string' ? o.ar : '' }
  }
  const item = readEditingItem(s.item)
  return { definition: readDefinition(s.definition), title: said(s.title), subtitle: said(s.subtitle), ...(item ? { item } : {}) }
}

/** Opens the editor on an existing view (776): its definition and words, and its standing for the save. */
export function editItemLink(item: AnalyticsItem): { to: string; state: { editorSeed: EditorSeed } } {
  return {
    to: NEW_VIEW_PATH,
    state: { editorSeed: { definition: item.definition, title: item.title, subtitle: item.subtitle, item: editingItemOf(item) } },
  }
}

/** A seeded standing, or `undefined` when any field the save needs is missing (never PUT blind). */
function readEditingItem(v: unknown): EditingItem | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const tiers = ['personal', 'shared', 'certified']
  if (typeof o.id !== 'string' || !o.id || typeof o.owner !== 'string' || typeof o.revision !== 'number') return undefined
  if (typeof o.tier !== 'string' || !tiers.includes(o.tier) || (o.kind !== 'view' && o.kind !== 'board')) return undefined
  return editingItemOf({
    id: o.id,
    kind: o.kind,
    owner: o.owner,
    tier: o.tier as EditingItem['tier'],
    revision: o.revision,
    copiedFrom: typeof o.copiedFrom === 'string' ? o.copiedFrom : null,
    sourceChangedSinceCopy: o.sourceChangedSinceCopy === true,
  })
}
