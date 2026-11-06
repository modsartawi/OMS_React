/* PROTOTYPE — throwaway. Wayfinder ticket 798 (map 793). Never merge.
 *
 * The prototype's in-memory report: a stub semantic model (three areas), the acceptance case as
 * the sample report, the binding rules of 797 + 799, the save checks (ANALYTICS-411), live-figure
 * tokens (801) and seeded stub figures that move when a parameter value moves. No server.
 */
import type { AnalyticsNumberFormat, MeasureUnit, PeriodToken } from '@/core/models/analytics'

export interface Words {
  en: string
  ar: string
}
export const say = (w: Words | undefined, lang: string): string => (!w ? '' : lang.startsWith('ar') && w.ar ? w.ar : w.en || w.ar)

// ── The semantic model (stub) ───────────────────────────────────────────────────────────────

export type Area = 'till' | 'orders' | 'store_day'
export const AREAS: { key: Area; label: Words }[] = [
  { key: 'till', label: { en: 'Till sales', ar: 'مبيعات نقاط البيع' } },
  { key: 'orders', label: { en: 'Orders', ar: 'الطلبات' } },
  { key: 'store_day', label: { en: 'Stores by day (cross-area)', ar: 'الصيدليات يومياً (عبر المجالات)' } },
]

export interface Measure {
  key: string
  label: Words
  unit: MeasureUnit
  format: AnalyticsNumberFormat
  areas: Area[]
  /** A ratio: never summed across series or rows. */
  ratio?: boolean
}
export const MEASURES: Measure[] = [
  { key: 'net_value', label: { en: 'Net sales value', ar: 'صافي قيمة المبيعات' }, unit: 'SAR', format: 'SAR', areas: ['till', 'store_day'] },
  { key: 'sales', label: { en: 'Till sales', ar: 'عمليات البيع' }, unit: 'count', format: 'integer', areas: ['till'] },
  { key: 'orders', label: { en: 'Orders', ar: 'الطلبات' }, unit: 'count', format: 'integer', areas: ['orders', 'store_day'] },
  { key: 'cancelled', label: { en: 'Cancelled orders', ar: 'الطلبات الملغاة' }, unit: 'count', format: 'integer', areas: ['orders', 'store_day'] },
  { key: 'cancellation_rate', label: { en: 'Cancellation rate', ar: 'نسبة الإلغاء' }, unit: 'share', format: 'percent', areas: ['orders', 'store_day'], ratio: true },
  { key: 'deliveries', label: { en: 'Deliveries', ar: 'التوصيلات' }, unit: 'count', format: 'integer', areas: ['store_day'] },
]
export const measureOf = (key: string) => MEASURES.find((m) => m.key === key)

export interface Member {
  key: string
  label: Words
}
export interface Dimension {
  key: string
  label: Words
  members: Member[]
  /** A store reads as `code · name`. */
  machine?: boolean
}
const m = (key: string, en: string, ar: string): Member => ({ key, label: { en, ar } })
export const DIMENSIONS: Dimension[] = [
  {
    key: 'channel',
    label: { en: 'Channel', ar: 'القناة' },
    members: [
      m('hungerstation', 'HungerStation', 'هنقرستيشن'),
      m('own_app_web', 'Own app & web', 'التطبيق والموقع'),
      m('call_center', 'Call center', 'مركز الاتصال'),
      m('platforms', 'Other platforms', 'منصات أخرى'),
      m('wasfaty', 'Wasfaty', 'وصفتي'),
      m('offline', 'In store', 'داخل الصيدلية'),
    ],
  },
  {
    key: 'delivery_type',
    label: { en: 'Delivery type', ar: 'نوع التوصيل' },
    members: [m('QC', 'QC (express)', 'QC (سريع)'), m('DL', 'Standard delivery', 'توصيل عادي'), m('PK', 'Pick in store', 'استلام من الصيدلية'), m('none', '(none)', '(بدون)')],
  },
  {
    key: 'city',
    label: { en: 'City', ar: 'المدينة' },
    members: [m('riyadh', 'Riyadh', 'الرياض'), m('jeddah', 'Jeddah', 'جدة'), m('dammam', 'Dammam', 'الدمام'), m('makkah', 'Makkah', 'مكة المكرمة'), m('madinah', 'Madinah', 'المدينة المنورة')],
  },
  {
    key: 'region',
    label: { en: 'Region', ar: 'المنطقة' },
    members: [m('central', 'Central', 'الوسطى'), m('western', 'Western', 'الغربية'), m('eastern', 'Eastern', 'الشرقية')],
  },
  {
    key: 'store',
    label: { en: 'Store', ar: 'الصيدلية' },
    machine: true,
    members: [
      m('P001', 'Olaya 12', 'العليا ١٢'),
      m('P014', 'Tahlia', 'التحلية'),
      m('P027', 'King Fahd Rd', 'طريق الملك فهد'),
      m('P033', 'Corniche', 'الكورنيش'),
      m('P041', 'Al Khobar 3', 'الخبر ٣'),
      m('P058', 'Aziziyah', 'العزيزية'),
      m('P062', 'Quba', 'قباء'),
      m('P075', 'Malqa', 'الملقا'),
      m('P088', 'Rawdah', 'الروضة'),
      m('P093', 'Faisaliyah', 'الفيصلية'),
      m('P104', 'Shatea', 'الشاطئ'),
      m('P117', 'Naseem', 'النسيم'),
    ],
  },
]
export const dimensionOf = (key: string) => DIMENSIONS.find((d) => d.key === key)
/** Every area carries every dimension above, plus `date`. */
export const CATEGORY_DIMENSIONS = DIMENSIONS.map((d) => d.key)

// ── Parameters (797) ────────────────────────────────────────────────────────────────────────

export type ParamKind = 'period' | 'members' | 'grain' | 'threshold' | 'topN' | 'measure' | 'breakdown'
export const PARAM_KINDS: ParamKind[] = ['period', 'members', 'grain', 'threshold', 'topN', 'measure', 'breakdown']
export type Grain = 'day' | 'week' | 'month'
export const GRAINS: Grain[] = ['day', 'week', 'month']
export type ThresholdOp = 'off' | 'gt' | 'gte' | 'lt' | 'lte'
export const PROTO_PERIODS: PeriodToken[] = ['today', 'yesterday', 'this-week', 'last-week', 'last-7-days', 'last-30-days', 'this-month']

export type ParamValue =
  | { kind: 'period'; token: PeriodToken }
  | { kind: 'members'; values: string[] }
  | { kind: 'grain'; grain: Grain }
  | { kind: 'threshold'; op: ThresholdOp; value: number }
  | { kind: 'topN'; n: number }
  | { kind: 'measure'; key: string }
  | { kind: 'breakdown'; key: string }

export interface Param {
  name: string
  kind: ParamKind
  label: Words
  /** "Required" only means a viewer cannot clear it — every parameter has a default (797 §2). */
  required: boolean
  readyMade?: boolean
  /** members: the dimension it picks from (a binding may point it elsewhere per panel). */
  dimension?: string
  /** members: the author's pinned list; null = open search over every member. */
  pinned?: string[] | null
  multi?: boolean
  /** grain: the grains the author allows. */
  grains?: Grain[]
  /** threshold: the one measure it compares. */
  measure?: string
  /** measure / breakdown: the author's options. */
  options?: string[]
  default: ParamValue
}

export const RESERVED_NAMES = ['tv', 'refresh', 'cross', 'crossFrom']

export function blankParam(kind: ParamKind, taken: string[]): Param {
  const base = { period: 'period', members: 'members', grain: 'grain', threshold: 'threshold', topN: 'top', measure: 'figure', breakdown: 'split' }[kind]
  let name = base
  for (let i = 2; taken.includes(name); i++) name = `${base}-${i}`
  const label: Words = { en: '', ar: '' }
  switch (kind) {
    case 'period':
      return { name, kind, label, required: true, default: { kind, token: 'yesterday' } }
    case 'members':
      return { name, kind, label, required: false, dimension: 'city', pinned: null, multi: true, default: { kind, values: [] } }
    case 'grain':
      return { name, kind, label, required: true, grains: ['day', 'week', 'month'], default: { kind, grain: 'day' } }
    case 'threshold':
      return { name, kind, label, required: false, measure: 'cancellation_rate', default: { kind, op: 'off', value: 5 } }
    case 'topN':
      return { name, kind, label, required: true, default: { kind, n: 10 } }
    case 'measure':
      return { name, kind, label, required: true, options: ['net_value', 'sales'], default: { kind, key: 'net_value' } }
    case 'breakdown':
      return { name, kind, label, required: true, options: ['channel', 'region', 'city'], default: { kind, key: 'channel' } }
  }
}

// ── The report (801) ────────────────────────────────────────────────────────────────────────

export type ChartType = 'bar' | 'line' | 'kpi' | 'table'
export interface Series {
  id: string
  label: Words
  filters: { dimension: string; values: string[] }[]
}
export interface Panel {
  id: string
  title: Words
  area: Area
  measures: string[]
  /** The axis: a category dimension, `date`, or none (a KPI). */
  axis: string | null
  chart: ChartType
  series: Series[]
  /** Copied from a saved view (801 §2): its name, the revision copied, and whether it changed since. */
  from?: { view: Words; revision: number; changed: boolean }
  /** A model caveat the area declares (796: HungerStation cancels counted inside OMS only). */
  caveat?: Words
}
export type Block = { id: string; kind: 'panel'; panel: Panel } | { id: string; kind: 'text'; text: Words } | { id: string; kind: 'summary' }
export interface Section {
  id: string
  heading: Words
  blocks: Block[]
}
export interface Audience {
  everyone: boolean
  roles: string[]
  users: string[]
}
/** param name → panel id → the dimension a members parameter filters there, or `true`. Absent = not bound. */
export type Bindings = Record<string, Record<string, string | true>>
export interface Report {
  id: string
  title: Words
  owner: string
  revision: number
  params: Param[]
  bindings: Bindings
  sections: Section[]
  audience: Audience
}

export const panelsOf = (r: Report): Panel[] => r.sections.flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'panel' ? [b.panel] : [])))

// ── Binding rules (797 §4–5, 799 §2) ────────────────────────────────────────────────────────

export type BindReason = 'noTimeAxis' | 'seriesFilters' | 'thresholdShape' | 'topNShape' | 'measureShape' | 'breakdownShape' | 'notInArea'
export type BindCheck = { ok: true; target?: string } | { ok: false; reason: BindReason }

const seriesFilter = (p: Panel, dim: string) => p.series.some((s) => s.filters.some((f) => f.dimension === dim))
const categoryAxis = (p: Panel) => p.axis !== null && p.axis !== 'date'

export function canBind(param: Param, panel: Panel, target?: string): BindCheck {
  switch (param.kind) {
    case 'period':
      return { ok: true }
    case 'grain':
      return panel.axis === 'date' ? { ok: true } : { ok: false, reason: 'noTimeAxis' }
    case 'members': {
      const dim = target ?? param.dimension ?? ''
      if (!CATEGORY_DIMENSIONS.includes(dim)) return { ok: false, reason: 'notInArea' }
      return seriesFilter(panel, dim) ? { ok: false, reason: 'seriesFilters' } : { ok: true, target: dim }
    }
    case 'threshold':
      return panel.measures.includes(param.measure ?? '') && categoryAxis(panel) && panel.chart !== 'kpi' ? { ok: true } : { ok: false, reason: 'thresholdShape' }
    case 'topN':
      return categoryAxis(panel) && panel.chart !== 'kpi' ? { ok: true } : { ok: false, reason: 'topNShape' }
    case 'measure':
      return panel.measures.length === 1 && (param.options ?? []).every((o) => measureOf(o)?.areas.includes(panel.area))
        ? { ok: true }
        : { ok: false, reason: 'measureShape' }
    case 'breakdown':
      return categoryAxis(panel) && panel.chart !== 'kpi' && !(param.options ?? []).some((o) => seriesFilter(panel, o))
        ? { ok: true }
        : { ok: false, reason: 'breakdownShape' }
  }
}

/** Adding a parameter binds it to every panel that can take it (797 §4). */
export function prefill(param: Param, panels: Panel[]): Record<string, string | true> {
  const out: Record<string, string | true> = {}
  for (const p of panels) {
    const c = canBind(param, p)
    if (c.ok) out[p.id] = c.target ?? true
  }
  return out
}

// ── Save checks: ANALYTICS-411 (797 §9, 799, 801) ───────────────────────────────────────────

export type Refusal =
  | { what: 'name'; param: string; why: 'slug' | 'reserved' | 'duplicate' }
  | { what: 'binding'; param: string; panel: string; reason: BindReason }
  | { what: 'figure'; block: string; token: string }
  | { what: 'series'; panel: string; why: 'tooMany' | 'duplicate' }

export function validate(r: Report): Refusal[] {
  const out: Refusal[] = []
  const names = new Set<string>()
  for (const p of r.params) {
    if (RESERVED_NAMES.includes(p.name)) out.push({ what: 'name', param: p.name, why: 'reserved' })
    else if (!/^[a-z][a-z0-9-]*$/.test(p.name)) out.push({ what: 'name', param: p.name, why: 'slug' })
    else if (names.has(p.name)) out.push({ what: 'name', param: p.name, why: 'duplicate' })
    names.add(p.name)
  }
  const panels = panelsOf(r)
  for (const [name, bound] of Object.entries(r.bindings)) {
    const param = r.params.find((p) => p.name === name)
    if (!param) continue
    for (const [panelId, target] of Object.entries(bound)) {
      const panel = panels.find((p) => p.id === panelId)
      if (!panel) continue
      const c = canBind(param, panel, typeof target === 'string' ? target : undefined)
      if (!c.ok) out.push({ what: 'binding', param: name, panel: panelId, reason: c.reason })
    }
  }
  for (const p of panels) {
    if (p.series.length > 4) out.push({ what: 'series', panel: p.id, why: 'tooMany' })
    const labels = p.series.map((s) => s.label.en.trim().toLowerCase())
    if (new Set(labels).size !== labels.length) out.push({ what: 'series', panel: p.id, why: 'duplicate' })
  }
  for (const s of r.sections)
    for (const b of s.blocks)
      if (b.kind === 'text')
        for (const tok of tokensIn(b.text.en + ' ' + b.text.ar)) if (!figureExists(r, tok.panel, tok.figure)) out.push({ what: 'figure', block: b.id, token: tok.raw })
  return out
}

// ── Live figures (801 §3) ───────────────────────────────────────────────────────────────────

/** A token in a text block: `{p3:hs}` = panel p3, series hs; `{p1:total}` = panel p1's total. */
export const TOKEN = /\{([a-z0-9]+):([a-z0-9_]+)\}/g
export function tokensIn(text: string): { raw: string; panel: string; figure: string }[] {
  return [...text.matchAll(TOKEN)].map((x) => ({ raw: x[0], panel: x[1], figure: x[2] }))
}

/** The single values a panel offers a text block: one per series, or the total of an additive measure. */
export function figuresOf(p: Panel): { figure: string; label: Words }[] {
  if (p.series.length > 0) return p.series.map((s) => ({ figure: s.id, label: s.label }))
  const meas = measureOf(p.measures[0])
  return meas && !meas.ratio ? [{ figure: 'total', label: { en: 'Total', ar: 'الإجمالي' } }] : []
}
export function figureExists(r: Report, panelId: string, figure: string): boolean {
  const p = panelsOf(r).find((x) => x.id === panelId)
  return !!p && figuresOf(p).some((f) => f.figure === figure)
}

// ── Running a panel: the parameters applied, then stub figures ──────────────────────────────

export type Values = Record<string, ParamValue>
export const defaultsOf = (r: Report): Values => Object.fromEntries(r.params.map((p) => [p.name, p.default]))

export interface RunRow {
  x: string
  label: string
  values: Record<string, number | null>
}
export interface RunResult {
  measures: string[]
  axis: string | null
  /** The keys of `values`: series ids, or measure keys when the panel has no series. */
  keys: { key: string; label: Words; measure: string }[]
  rows: RunRow[]
  /** One value per key over the whole run (a KPI, a live figure). */
  overall: Record<string, number | null>
  /** Parameters that do not reach this panel, and why (797 §4: "says so on screen"). */
  notReached: { param: Param; reason: BindReason | 'unbound' }[]
  threshold?: { op: ThresholdOp; value: number; measure: string }
  topN?: number
}

const PERIOD_DAYS: Record<string, number> = { today: 1, yesterday: 1, 'this-week': 5, 'last-week': 7, 'last-7-days': 7, 'last-30-days': 30, 'this-month': 6 }

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

const CHANNEL_WEIGHT: Record<string, number> = { hungerstation: 0.11, own_app_web: 0.16, call_center: 0.04, platforms: 0.06, wasfaty: 0.03, offline: 0.6 }
const DT_WEIGHT: Record<string, number> = { QC: 0.07, DL: 0.21, PK: 0.04, none: 0.68 }
const BASE_PER_DAY: Record<string, number> = { net_value: 14_200_000, sales: 61_000, orders: 21_500, cancelled: 1_250, deliveries: 17_800 }
const RATE_BY: Record<string, number> = { hungerstation: 0.071, own_app_web: 0.046, call_center: 0.052, platforms: 0.064, wasfaty: 0.038, offline: 0.0, QC: 0.029, DL: 0.054, PK: 0.083, none: 0.0 }

type Filter = Record<string, string[]>

function figure(measure: string, filter: Filter, days: number, seed: string): number {
  const noise = 0.85 + 0.3 * hash(seed + measure + JSON.stringify(filter))
  if (measure === 'cancellation_rate') {
    const keys = [...(filter.channel ?? []), ...(filter.delivery_type ?? [])].filter((k) => RATE_BY[k] !== undefined && RATE_BY[k] > 0)
    const base = keys.length ? keys.reduce((a, k) => a + RATE_BY[k], 0) / keys.length : 0.052
    return Math.round(base * noise * 10000) / 10000
  }
  let w = 1
  const share = (dim: string, weights: Record<string, number> | null, size: number) => {
    const v = filter[dim]
    if (!v || v.length === 0) return 1
    return v.reduce((a, k) => a + (weights ? (weights[k] ?? 0) : 1 / size), 0)
  }
  w *= share('channel', CHANNEL_WEIGHT, 6)
  w *= share('delivery_type', DT_WEIGHT, 4)
  w *= share('city', null, 5)
  w *= share('region', null, 3)
  w *= share('store', null, 240)
  const v = (BASE_PER_DAY[measure] ?? 1000) * days * w * noise
  return measure === 'net_value' ? Math.round(v) : Math.round(v)
}

export function runPanel(r: Report, panel: Panel, values: Values): RunResult {
  const notReached: RunResult['notReached'] = []
  let measures = [...panel.measures]
  let axis = panel.axis
  let token: string = 'yesterday'
  let grain: Grain = 'day'
  const filter: Filter = {}
  let threshold: RunResult['threshold']
  let topN: number | undefined

  for (const p of r.params) {
    const bound = r.bindings[p.name]?.[panel.id]
    if (bound === undefined) {
      const c = canBind(p, panel)
      notReached.push({ param: p, reason: c.ok ? 'unbound' : c.reason })
      continue
    }
    const v = values[p.name] ?? p.default
    if (v.kind === 'period') token = v.token
    if (v.kind === 'grain') grain = v.grain
    if (v.kind === 'members' && v.values.length) filter[typeof bound === 'string' ? bound : (p.dimension ?? '')] = v.values
    if (v.kind === 'measure') measures = [v.key]
    if (v.kind === 'breakdown') axis = v.key
    if (v.kind === 'threshold' && v.op !== 'off') threshold = { op: v.op, value: v.value, measure: p.measure ?? '' }
    if (v.kind === 'topN') topN = v.n
  }

  const days = PERIOD_DAYS[token] ?? 1
  const keys: RunResult['keys'] =
    panel.series.length > 0
      ? panel.series.map((s) => ({ key: s.id, label: s.label, measure: measures[0] }))
      : measures.map((mk) => ({ key: mk, label: measureOf(mk)?.label ?? { en: mk, ar: mk }, measure: mk }))
  const seriesFilter = (k: string): Filter => {
    const s = panel.series.find((x) => x.id === k)
    const f: Filter = { ...filter }
    for (const sf of s?.filters ?? []) f[sf.dimension] = sf.values
    return f
  }

  let xs: { x: string; label: string; filter: Filter; days: number }[]
  if (axis === 'date') {
    const buckets = grain === 'day' ? days : grain === 'week' ? Math.max(1, Math.ceil(days / 7)) : 1
    const per = days / buckets
    xs = Array.from({ length: buckets }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 5 - (buckets - 1 - i) * (grain === 'day' ? 1 : 7)))
      const iso = d.toISOString().slice(0, 10)
      return { x: iso, label: grain === 'month' ? iso.slice(0, 7) : iso, filter: {}, days: per }
    })
  } else if (axis) {
    const dim = dimensionOf(axis)
    const pool = filter[axis]?.length ? (dim?.members ?? []).filter((mm) => filter[axis].includes(mm.key)) : (dim?.members ?? [])
    xs = pool.map((mm) => ({ x: mm.key, label: mm.key, filter: { [axis as string]: [mm.key] }, days }))
  } else xs = [{ x: 'all', label: 'all', filter: {}, days }]

  let rows: RunRow[] = xs.map((pt) => ({
    x: pt.x,
    label: pt.label,
    values: Object.fromEntries(
      keys.map((k) => {
        const f = { ...(panel.series.length ? seriesFilter(k.key) : filter), ...pt.filter }
        return [k.key, figure(k.measure, f, pt.days, token + pt.x + k.key)]
      }),
    ),
  }))

  if (threshold) {
    const key = keys.find((k) => k.measure === threshold!.measure)?.key
    const t = measureOf(threshold.measure)?.unit === 'share' ? threshold.value / 100 : threshold.value
    if (key)
      rows = rows.filter((row) => {
        const v = row.values[key] ?? 0
        return threshold!.op === 'gt' ? v > t : threshold!.op === 'gte' ? v >= t : threshold!.op === 'lt' ? v < t : v <= t
      })
  }
  if (axis && axis !== 'date') rows.sort((a, b) => (b.values[keys[0].key] ?? 0) - (a.values[keys[0].key] ?? 0))
  if (topN !== undefined && axis && axis !== 'date') rows = rows.slice(0, topN)

  const overall = Object.fromEntries(
    keys.map((k) => {
      const meas = measureOf(k.measure)
      const f = panel.series.length ? seriesFilter(k.key) : filter
      return [k.key, meas?.ratio ? figure(k.measure, f, days, token + 'all' + k.key) : rows.reduce((a, row) => a + (row.values[k.key] ?? 0), 0)]
    }),
  )
  return { measures, axis, keys, rows, overall, notReached, threshold, topN }
}

export function figureValue(r: Report, values: Values, panelId: string, fig: string): { value: number | null; measure: string } | null {
  const p = panelsOf(r).find((x) => x.id === panelId)
  if (!p || !figuresOf(p).some((f) => f.figure === fig)) return null
  const res = runPanel(r, p, values)
  const key = fig === 'total' ? res.keys[0]?.key : fig
  return { value: res.overall[key] ?? null, measure: res.keys.find((k) => k.key === key)?.measure ?? res.measures[0] }
}

// ── Teams (794) ─────────────────────────────────────────────────────────────────────────────

export const ROLES: { key: string; label: Words; removed?: boolean }[] = [
  { key: 'HQ_SALES', label: { en: 'HQ Sales', ar: 'مبيعات المركز الرئيسي' } },
  { key: 'HQ_OPS', label: { en: 'HQ Operations', ar: 'عمليات المركز الرئيسي' } },
  { key: 'DELIVERY_OPS', label: { en: 'Delivery operations', ar: 'عمليات التوصيل' } },
  { key: 'FINANCE', label: { en: 'Finance', ar: 'المالية' } },
  { key: 'CATEGORY_MGMT', label: { en: 'Category management', ar: 'إدارة الفئات' } },
  { key: 'OLD_ECOM', label: { en: 'E-commerce (old)', ar: 'التجارة الإلكترونية (قديم)' }, removed: true },
]
export const USERS: { key: string; name: string }[] = [
  { key: 'nalharbi', name: 'Noura Alharbi' },
  { key: 'kalotaibi', name: 'Khalid Alotaibi' },
  { key: 'sqahtani', name: 'Sara Alqahtani' },
  { key: 'fdosari', name: 'Faisal Aldosari' },
]

// ── The sample report: the owner's acceptance case (map 793 Notes, 799 §4) ───────────────────

const HS: Series = { id: 'hs', label: { en: 'HungerStation', ar: 'هنقرستيشن' }, filters: [{ dimension: 'channel', values: ['hungerstation'] }] }
const QC: Series = { id: 'qc', label: { en: 'QC', ar: 'QC' }, filters: [{ dimension: 'delivery_type', values: ['QC'] }] }

export const SAVED_VIEWS: { id: string; title: Words; revision: number; panel: Omit<Panel, 'id'> }[] = [
  {
    id: 'v-311',
    title: { en: 'HungerStation vs QC sales', ar: 'مبيعات هنقرستيشن مقابل QC' },
    revision: 3,
    panel: { title: { en: 'HungerStation against QC: net sales', ar: 'هنقرستيشن مقابل QC: صافي المبيعات' }, area: 'till', measures: ['net_value'], axis: null, chart: 'kpi', series: [HS, QC] },
  },
  {
    id: 'v-207',
    title: { en: 'Orders by city', ar: 'الطلبات حسب المدينة' },
    revision: 7,
    panel: { title: { en: 'Orders by city', ar: 'الطلبات حسب المدينة' }, area: 'orders', measures: ['orders'], axis: 'city', chart: 'bar', series: [] },
  },
  {
    id: 'v-188',
    title: { en: 'Daily cancellation rate', ar: 'نسبة الإلغاء اليومية' },
    revision: 2,
    panel: { title: { en: 'Cancellation rate by day', ar: 'نسبة الإلغاء حسب اليوم' }, area: 'orders', measures: ['cancellation_rate'], axis: 'date', chart: 'line', series: [] },
  },
]

export function sampleReport(): Report {
  const p1: Panel = { id: 'p1', title: { en: 'Net sales by channel', ar: 'صافي المبيعات حسب القناة' }, area: 'till', measures: ['net_value'], axis: 'channel', chart: 'bar', series: [] }
  const p2: Panel = { id: 'p2', ...SAVED_VIEWS[0].panel, from: { view: SAVED_VIEWS[0].title, revision: 3, changed: true } }
  const p3: Panel = {
    id: 'p3',
    title: { en: 'Cancellation rate: HungerStation against QC', ar: 'نسبة الإلغاء: هنقرستيشن مقابل QC' },
    area: 'orders',
    measures: ['cancellation_rate'],
    axis: 'date',
    chart: 'bar',
    series: [HS, QC],
    caveat: { en: 'HungerStation cancellations are counted inside OMS only; cancels made on the platform are not on the replica.', ar: 'تُحتسب إلغاءات هنقرستيشن داخل نظام الطلبات فقط؛ الإلغاءات التي تتم على المنصة غير موجودة في النسخة.' },
  }
  const p4: Panel = {
    id: 'p4',
    title: { en: 'Stores: sales, orders and cancellations', ar: 'الصيدليات: المبيعات والطلبات والإلغاءات' },
    area: 'store_day',
    measures: ['net_value', 'orders', 'cancellation_rate', 'deliveries'],
    axis: 'store',
    chart: 'table',
    series: [],
  }
  const params: Param[] = [
    { name: 'period', kind: 'period', label: { en: 'Period', ar: 'الفترة' }, required: true, readyMade: true, default: { kind: 'period', token: 'yesterday' } },
    { name: 'city', kind: 'members', label: { en: 'City', ar: 'المدينة' }, required: false, readyMade: true, dimension: 'city', pinned: null, multi: true, default: { kind: 'members', values: [] } },
    { name: 'store', kind: 'members', label: { en: 'Store', ar: 'الصيدلية' }, required: false, readyMade: true, dimension: 'store', pinned: null, multi: true, default: { kind: 'members', values: [] } },
    { name: 'channel', kind: 'members', label: { en: 'Channel', ar: 'القناة' }, required: false, readyMade: true, dimension: 'channel', pinned: null, multi: true, default: { kind: 'members', values: [] } },
    { name: 'grain', kind: 'grain', label: { en: 'By', ar: 'حسب' }, required: true, grains: ['day', 'week'], default: { kind: 'grain', grain: 'day' } },
    { name: 'figure', kind: 'measure', label: { en: 'Figure', ar: 'الرقم' }, required: true, options: ['net_value', 'sales'], default: { kind: 'measure', key: 'net_value' } },
    { name: 'split', kind: 'breakdown', label: { en: 'Split by', ar: 'التقسيم حسب' }, required: true, options: ['channel', 'region', 'city'], default: { kind: 'breakdown', key: 'channel' } },
    { name: 'cancel-above', kind: 'threshold', label: { en: 'Stores cancelling', ar: 'الصيدليات التي تلغي' }, required: false, measure: 'cancellation_rate', default: { kind: 'threshold', op: 'off', value: 5 } },
    { name: 'stores', kind: 'topN', label: { en: 'Stores shown', ar: 'عدد الصيدليات' }, required: true, default: { kind: 'topN', n: 10 } },
  ]
  const panels = [p1, p2, p3, p4]
  const bindings: Bindings = Object.fromEntries(params.map((p) => [p.name, prefill(p, panels)]))
  // The author unbound two pre-filled bindings (797 §4): the split stays off the store table, the top N off the channel bar.
  delete bindings.split.p4
  delete bindings.stores.p1
  return {
    id: 'r-1042',
    title: { en: 'Channel sales: HungerStation against QC', ar: 'مبيعات القنوات: هنقرستيشن مقابل QC' },
    owner: 'msartawi',
    revision: 3,
    params,
    bindings,
    audience: { everyone: false, roles: ['HQ_SALES', 'DELIVERY_OPS'], users: ['nalharbi'] },
    sections: [
      {
        id: 's1',
        heading: { en: 'Sales by channel', ar: 'المبيعات حسب القناة' },
        blocks: [
          { id: 'p1', kind: 'panel', panel: p1 },
          { id: 't1', kind: 'text', text: { en: 'Across every channel the tills took {p1:total} in the period.', ar: 'حصّلت نقاط البيع {p1:total} عبر جميع القنوات خلال الفترة.' } },
        ],
      },
      {
        id: 's2',
        heading: { en: 'HungerStation against QC', ar: 'هنقرستيشن مقابل QC' },
        blocks: [
          { id: 'p2', kind: 'panel', panel: p2 },
          { id: 'p3', kind: 'panel', panel: p3 },
          {
            id: 't2',
            kind: 'text',
            text: {
              en: 'HungerStation sold {p2:hs} against QC’s {p2:qc}. Their cancellation rates were {p3:hs} and {p3:qc}.',
              ar: 'باعت هنقرستيشن {p2:hs} مقابل {p2:qc} لـ QC. وكانت نسبتا الإلغاء {p3:hs} و{p3:qc}.',
            },
          },
        ],
      },
      { id: 's3', heading: { en: 'Stores', ar: 'الصيدليات' }, blocks: [{ id: 'p4', kind: 'panel', panel: p4 }] },
      { id: 's4', heading: { en: 'Summary', ar: 'الملخص' }, blocks: [{ id: 'sum', kind: 'summary' }] },
    ],
  }
}

/** The stub AI summary: written from this run's figures only, so the number check passes (801 §3). */
export function stubSummary(r: Report, values: Values, lang: string, fmt: (v: number | null, measure: string) => string): string | null {
  const hs = figureValue(r, values, 'p2', 'hs')
  const qc = figureValue(r, values, 'p2', 'qc')
  const hsr = figureValue(r, values, 'p3', 'hs')
  const qcr = figureValue(r, values, 'p3', 'qc')
  if (!hs || !qc || !hsr || !qcr) return null
  return lang.startsWith('ar')
    ? `تفوقت هنقرستيشن على QC في المبيعات (${fmt(hs.value, hs.measure)} مقابل ${fmt(qc.value, qc.measure)})، لكن نسبة إلغائها أعلى (${fmt(hsr.value, hsr.measure)} مقابل ${fmt(qcr.value, qcr.measure)}).`
    : `HungerStation outsold QC (${fmt(hs.value, hs.measure)} against ${fmt(qc.value, qc.measure)}) but cancelled more often (${fmt(hsr.value, hsr.measure)} against ${fmt(qcr.value, qcr.measure)}).`
}
