import type {
  AnalyticsBoardDefinition,
  AnalyticsDimensionValue,
  AnalyticsModel,
  AnalyticsBoardPanel,
  BoardFilterKey,
  BoardFilters,
  BoardPeriod,
  Bindings,
  Param,
  ParamValue,
} from '@/core/models/analytics'
import { BASE_FILTERS, boardDefaults } from './board'
import { saysIn } from '@/core/rules/sentence'
import { dimensionOf } from './wire'

/**
 * A board's parameters (spec 819 §C, ticket 821) — pure. v1's six board filters are the six ready-made
 * parameters (797 item 6), keeping v1's names, so every v1 permalink still opens. A board that carries
 * `params` and `bindings` is used as it is; a v1 board (saved `filters`, each panel's `optOut`) is
 * converted here the way the server will convert it on read. The server's conversion is the authority
 * once it lands.
 */

/** A parameter's value by its name: the strip's state, and what the permalink writes. */
export type ParamValues = Record<string, ParamValue>

/** v1's six board filters, in the strip's order. */
export const READY_MADE = ['period', 'city', 'region', 'store', 'channel', 'country'] as const
export type ReadyMadeName = (typeof READY_MADE)[number]

/** Each ready-made `members` parameter → the model dimension it filters (v1's `FILTER_DIMENSIONS`). */
export const READY_MADE_DIMENSIONS = {
  city: 'city',
  region: 'region',
  store: 'store',
  channel: 'channel_group',
  country: 'country',
} as const satisfies Record<Exclude<ReadyMadeName, 'period'>, string>

const isReadyMade = (name: string): name is ReadyMadeName => (READY_MADE as readonly string[]).includes(name)

export const periodValue = (p: BoardPeriod): ParamValue =>
  p.kind === 'relative' ? { kind: 'period', token: p.token } : { kind: 'period', from: p.from, to: p.to }

/** A period value as v1's `BoardPeriod`; `null` for a value of another kind. */
export function boardPeriodOf(v: ParamValue | undefined): BoardPeriod | null {
  if (v?.kind !== 'period') return null
  return 'token' in v ? { kind: 'relative', token: v.token } : { kind: 'fixed', from: v.from, to: v.to }
}

/**
 * The six ready-made parameters with `filters` as their defaults. Their label is left empty: the strip
 * words a ready-made parameter with no label of its own as v1 did (`board.filters.<name>`).
 */
export function readyMadeParams(filters: BoardFilters): Param[] {
  const label = { en: '', ar: '' }
  return READY_MADE.map((name): Param =>
    name === 'period'
      ? { name, kind: 'period', label, required: true, default: periodValue(filters.period) }
      : { name, kind: 'members', label, required: false, dimension: READY_MADE_DIMENSIONS[name], pinned: null, multi: true, default: { kind: 'members', values: [...filters[name]] } },
  )
}

type ViewPanel = Extract<AnalyticsBoardPanel, { kind: 'view' }>
const viewPanels = (def: AnalyticsBoardDefinition) => def.panels.filter((p): p is ViewPanel => p.kind === 'view')

/**
 * v1's board as parameters + bindings (797 item 6): its saved filters become the six defaults, and v1's
 * implicit rule — a filter reaches a panel unless the panel opted out of it, or none of the panel's
 * measures break down by the filter's dimension — becomes explicit bindings. `reaches` answers the
 * second half when the panels' views are known; without it every panel that did not opt out is bound,
 * and the effective query still drops a filter its measures cannot take, as v1 did.
 */
export function convertV1Board(def: AnalyticsBoardDefinition, reaches: (panel: ViewPanel, dimension: string) => boolean = () => true): { params: Param[]; bindings: Bindings } {
  const params = readyMadeParams(boardDefaults(def))
  const bindings: Bindings = {}
  for (const param of params) {
    const bound: Record<string, string | true> = {}
    for (const p of viewPanels(def)) {
      if ((p.optOut ?? []).includes(param.name as BoardFilterKey)) continue
      if (param.kind === 'period') bound[p.id] = true
      else if (param.dimension && reaches(p, param.dimension)) bound[p.id] = param.dimension
    }
    bindings[param.name] = bound
  }
  return { params, bindings }
}

/** The tolerant read: a board's own `params` and `bindings` when it has them, else v1's converted. */
export function boardParams(def: AnalyticsBoardDefinition): { params: Param[]; bindings: Bindings } {
  return def.params && def.bindings ? { params: def.params, bindings: def.bindings } : convertV1Board(def)
}

/** Every parameter's default, by name. */
export const defaultsOf = (params: readonly Param[]): ParamValues => Object.fromEntries(params.map((p) => [p.name, p.default]))

/** A parameter's value, falling back to its default when the values hold none of its kind. */
export function valueOf(param: Param, values: ParamValues): ParamValue {
  const v = values[param.name]
  return v && v.kind === param.kind ? v : param.default
}

/**
 * The v1 shape a board's parameters mean, which the board editor saves beside them so a v1 server still
 * reads the board: the six ready-made parameters' defaults as v1's filters, and each panel's opt-outs from
 * the bindings (plus the cross-filter's own opt-out, which stays on the panel).
 */
export function v1Of(def: AnalyticsBoardDefinition): { filters: BoardFilters; panels: AnalyticsBoardPanel[] } {
  const { params, bindings } = boardParams(def)
  const filters = filtersOf(defaultsOf(params))
  const panels = def.panels.map((p) => {
    if (p.kind !== 'view') return p
    const off = params.filter((x) => isReadyMade(x.name) && !bindings[x.name]?.[p.id]).map((x) => x.name as BoardFilterKey)
    // A ready-made parameter the board deleted reaches nothing: the panel reads as opted out of it.
    const gone = READY_MADE.filter((n) => !params.some((x) => x.name === n))
    const cross: BoardFilterKey[] = (p.optOut ?? []).includes('crossFilter') ? ['crossFilter'] : []
    return { ...p, optOut: [...new Set([...off, ...gone]), ...cross].sort(byKeyOrder) }
  })
  return { filters, panels }
}

/** The six ready-made parameters' values as v1's filters (the board editor's strip). */
export function filtersOf(values: ParamValues): BoardFilters {
  const out: BoardFilters = { ...BASE_FILTERS }
  for (const name of READY_MADE) {
    const v = values[name]
    if (name === 'period') out.period = boardPeriodOf(v) ?? out.period
    else if (v?.kind === 'members') out[name] = [...v.values]
  }
  return out
}

const KEY_ORDER: BoardFilterKey[] = [...READY_MADE, 'crossFilter']
const byKeyOrder = (a: BoardFilterKey, b: BoardFilterKey) => KEY_ORDER.indexOf(a) - KEY_ORDER.indexOf(b)

/** A ready-made parameter's v1 words (`board.filters.<name>`), for one whose label is left empty; else `null`. */
export const readyMadeLabelKey = (name: string): string | null => (isReadyMade(name) ? `board.filters.${name}` : null)

/** A parameter's words: its own label in `lang`, else a ready-made one's v1 words, else its name. */
export function paramLabel(param: Param, lang: string, t: (key: string) => string): string {
  const key = readyMadeLabelKey(param.name)
  return saysIn(param.label, lang) || (key ? t(key) : param.name)
}

/** The place dimensions v1 searched on the server whatever the model listed (771); any other is inline. */
const SEARCHED_DIMENSIONS = ['city', 'region', 'store']

export type StripControl =
  | { kind: 'period' }
  | { kind: 'searched'; dimension: string }
  | { kind: 'inline'; dimension: string; values: AnalyticsDimensionValue[] }
  /** 823: the author's pinned members, named from the model's inline values where it holds them. */
  | { kind: 'pinned'; dimension: string; values: AnalyticsDimensionValue[] }
  | { kind: 'grain' | 'threshold' | 'topN' | 'measure' | 'breakdown' }
  | { kind: 'none' }

/**
 * Which control the strip draws for a parameter: v1's rule for the six, carried to any `members`
 * parameter — a place dimension is searched; any other picks from the model's inline values, and is
 * not drawn when the model does not hold it. A pinned list (823) offers the author's members only; every
 * other kind has a control of its own.
 */
export function stripControlOf(param: Param, model: AnalyticsModel): StripControl {
  if (param.kind === 'period') return { kind: 'period' }
  if (param.kind !== 'members') return { kind: param.kind }
  if (!param.dimension) return { kind: 'none' }
  if (param.pinned) {
    const inline = dimensionOf(model, param.dimension)?.values ?? []
    const values = param.pinned.map((key) => inline.find((v) => v.key === key) ?? { key, label: { en: '', ar: '' } })
    return { kind: 'pinned', dimension: param.dimension, values }
  }
  if (SEARCHED_DIMENSIONS.includes(param.dimension)) return { kind: 'searched', dimension: param.dimension }
  const d = dimensionOf(model, param.dimension)
  return d ? { kind: 'inline', dimension: d.key, values: d.values ?? [] } : { kind: 'none' }
}

// ── 823: the other kinds, the reserved names, and the "not filtered by …" set ─────────────────────────

/** The query keys that are never a parameter's name (spec 819 §E): TV mode, auto-refresh and the cross-filter. */
export const RESERVED_NAMES = ['tv', 'refresh', 'cross', 'crossFrom'] as const
export const isReservedName = (name: string): boolean => (RESERVED_NAMES as readonly string[]).includes(name)

/** A top N parameter's range (spec 819 §C). */
export const TOP_N_MIN = 1
export const TOP_N_MAX = 100

/** Whether two values are the same: members as a set (the order they were picked in does not count). */
export function sameValue(a: ParamValue, b: ParamValue): boolean {
  if (a.kind === 'members' && b.kind === 'members') {
    const x = new Set(a.values)
    const y = new Set(b.values)
    return x.size === y.size && [...x].every((v) => y.has(v))
  }
  if (a.kind === 'threshold' && b.kind === 'threshold') return a.op === b.op && (a.op === 'off' || a.value === b.value)
  return canonicalWord(a) === canonicalWord(b)
}

const canonicalWord = (v: ParamValue) => JSON.stringify(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : 1)))

/** Whether the viewer moved a parameter off the author's default. */
export const movedOff = (param: Param, values: ParamValues): boolean => !sameValue(valueOf(param, values), param.default)

/** A parameter the server says does not reach a panel, and why (`Analytics/Query`'s `notReached[]`, ⚠ proposed). */
export interface NotReached {
  param: string
  reason: string
}

/**
 * The parameters a panel's "not filtered by …" line names (spec 819 §E): of those the answer says do not
 * reach it, the author sees all, and a runner only those moved off their defaults — a parameter still at
 * the author's value misleads no one. In the strip's order; a name the board does not declare is ignored.
 */
export function notFilteredBy(params: readonly Param[], values: ParamValues, notReached: readonly NotReached[], role: 'author' | 'runner'): Param[] {
  const names = new Set(notReached.map((n) => n.param))
  return params.filter((p) => names.has(p.name) && (role === 'author' || movedOff(p, values)))
}
