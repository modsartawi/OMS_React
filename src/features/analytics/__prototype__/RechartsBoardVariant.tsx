/* PROTOTYPE — throwaway. Map 741 follow-up to ticket 747: "use Recharts instead of building charts
 * from scratch". The same synthetic data and the same Metabase OSS `/api/dataset` queries as the
 * Linked board, but every panel is a stock Recharts 3 component. Nothing here is a hand-drawn chart:
 * sparklines, brush-zoom, stacked/100% stacks, reference lines, treemap, bubble scatter and a
 * composed bar+average all come from the library; we only supply data, tokens and RTL props.
 *
 * Colour follows the dataviz method: one hue for a single series; the five channels keep a FIXED
 * hue each (validated light + dark with validate_palette.js), so a filter never repaints them; no
 * status colours as series; one y-axis per chart. Copy is literal (throwaway branch).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import Select from '@/core/ui/Select'
import type { DataSet } from './NativeChart'
import { toMbql, type Plan } from './ask-matcher'

const env = import.meta.env
const FIELDS = JSON.parse(env.VITE_MB_FIELDS)
const TABLES = JSON.parse(env.VITE_MB_TABLES)
const DB = Number(env.VITE_MB_DATABASE_ID)

type Table = Plan['table']
const DATE_COL: Record<Table, string> = { till_sales: 'trx_date', orders: 'entry_time', deliveries: 'created_at' }
const REGIONS = ['Central', 'Western', 'Eastern', 'Southern', 'Northern', 'Bahrain']
const CHANNELS = ['HungerStation', 'Call centre', 'Insurance platform', 'Own app + web', 'Other']
const TARGET_MIN = 75

// Validated categorical order (teal, gold, blue, pink, violet) — light vs the white card, dark vs #111a28.
const CAT_LIGHT = ['#0f98a3', '#c98f00', '#3567b8', '#d0628f', '#8160d6']
const CAT_DARK = ['#169aa3', '#b8860e', '#5585d4', '#cf6496', '#8b6fe0']

const last = (n: number, unit: 'day' | 'week' | 'month') => ({ label: `last ${n} ${unit}s`, clause: (d: unknown) => ['time-interval', d, -n, unit] })
const P30 = last(30, 'day')
const P12 = last(12, 'month')
const P26W = last(26, 'week')

function mk(table: Table, key: string, by: Plan['by'], filters: Plan['filters'], period = P30, topN?: number): Plan {
  return { table, measure: { key, label: key }, by, filters, period, display: 'table', topN, title: key }
}
const day = (t: Table) => ({ col: DATE_COL[t], label: 'Day', unit: 'day' as const })
const week = (t: Table) => ({ col: DATE_COL[t], label: 'Week', unit: 'week' as const })
const month = (t: Table) => ({ col: DATE_COL[t], label: 'Month', unit: 'month' as const })

async function runQuery(plan: Plan): Promise<DataSet> {
  const q = toMbql(plan, FIELDS, TABLES, DB).dataset_query
  // Metabase sorts by the aggregation when there is no temporal breakout; for time series sort by time.
  if (plan.by.some((b) => b.unit)) delete (q.query as Record<string, unknown>)['order-by']
  const res = await fetch('/mbapi/dataset', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.VITE_MB_API_KEY }, body: JSON.stringify(q) })
  const j = await res.json()
  if (!res.ok || j.error) throw new Error(String(j.error ?? 'query failed'))
  return { cols: j.data.cols, rows: j.data.rows }
}

const nf = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const cf = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const pf = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 })
const dDay = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })
const dMonth = new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' })
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0))

/** rows [x, value] → [{ x, value }] */
const series1 = (d?: DataSet) => (d?.rows ?? []).map((r) => ({ x: String(r[0]), value: num(r[r.length - 1]) }))
/** rows [x, s, value] → [{ x, [s]: value }] — one object per x, one key per series */
function pivot(d?: DataSet) {
  const by = new Map<string, Record<string, number | string>>()
  for (const r of d?.rows ?? []) {
    const x = String(r[0])
    const o = by.get(x) ?? { x }
    o[String(r[1])] = num(r[2])
    by.set(x, o)
  }
  return [...by.values()]
}

function useTokens() {
  const dark = document.documentElement.classList.contains('dark')
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  const cat = dark ? CAT_DARK : CAT_LIGHT
  return {
    dark,
    ink: v('--foreground'),
    muted: v('--muted-foreground'),
    faint: v('--ink-3'),
    grid: v('--border'),
    card: v('--card'),
    one: cat[2], // single-series hue: the DMSCO-family blue
    channel: Object.fromEntries(CHANNELS.map((c, i) => [c, cat[i]])) as Record<string, string>,
  }
}

export default function RechartsBoardVariant({ rtl }: { rtl: boolean }) {
  const t = useTokens()
  const [region, setRegion] = useState('')

  const specs = useMemo(() => {
    const geo: Plan['filters'] = region ? [{ col: 'region', label: 'Region', value: region }] : []
    const deliv: Plan['filters'] = [...geo, { col: 'delivered', label: 'Delivered', value: 1 }]
    const store = { col: 'store_name', label: 'Store' }
    return {
      kValue: mk('till_sales', 'net', [], geo),
      kOrders: mk('orders', 'count', [], geo),
      kSpeed: mk('deliveries', 'o2dMedian', [], deliv),
      kLoy: mk('till_sales', 'loyShare', [], geo),
      sValue: mk('till_sales', 'net', [day('till_sales')], geo),
      sOrders: mk('orders', 'count', [day('orders')], geo),
      sSpeed: mk('deliveries', 'o2dMedian', [day('deliveries')], deliv),
      sLoy: mk('till_sales', 'loyShare', [day('till_sales')], geo),
      daily: mk('till_sales', 'net', [day('till_sales')], geo, P12),
      monthly: mk('till_sales', 'net', [month('till_sales')], geo, P12),
      chMonth: mk('orders', 'count', [month('orders'), { col: 'channel', label: 'Channel' }], geo, P12),
      chWeek: mk('orders', 'count', [week('orders'), { col: 'channel', label: 'Channel' }], geo, P26W),
      speedCity: mk('deliveries', 'o2dMedian', [{ col: 'city', label: 'City' }], deliv),
      valueCity: mk('till_sales', 'net', [{ col: 'city', label: 'City' }], geo),
      stValue: mk('till_sales', 'net', [store], geo),
      stLoy: mk('till_sales', 'loyShare', [store], geo),
      stCount: mk('till_sales', 'tillCount', [store], geo),
    }
  }, [region])

  // Each panel updates the moment ITS query returns - never wait for the slowest of 17. The previous
  // result stays on screen (dimmed) until the new one lands; a newer filter discards older answers.
  const [res, setRes] = useState<Record<string, DataSet | undefined>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<string[]>([])
  const gen = useRef(0)
  useEffect(() => {
    const my = ++gen.current
    setPending(new Set(Object.keys(specs)))
    setFailed([])
    for (const [k, p] of Object.entries(specs)) {
      runQuery(p)
        .then((d) => {
          if (my === gen.current) setRes((r) => ({ ...r, [k]: d }))
        })
        .catch(() => {
          if (my === gen.current) setFailed((f) => [...f, k])
        })
        .finally(() => {
          if (my !== gen.current) return
          setPending((cur) => {
            const n = new Set(cur)
            n.delete(k)
            return n
          })
        })
    }
  }, [specs])
  const total = Object.keys(specs).length
  const done = total - pending.size
  const busy = pending.size > 0
  const loading = (...keys: string[]) => keys.some((k) => pending.has(k))
  const err = failed.length ? `${failed.join(', ')} failed to load.` : null

  const scalar = (d?: DataSet) => (d ? num(d.rows[0]?.[d.cols.length - 1]) : undefined)

  // derived series
  const daily = useMemo(() => series1(res.daily), [res.daily])
  const dailyAvg = daily.length ? daily.reduce((s, r) => s + r.value, 0) / daily.length : 0
  const monthly = useMemo(() => {
    const m = series1(res.monthly)
    return m.map((r, i) => {
      const w = m.slice(Math.max(0, i - 2), i + 1)
      return { ...r, avg3: w.reduce((s, x) => s + x.value, 0) / w.length }
    })
  }, [res.monthly])
  const chMonth = useMemo(() => pivot(res.chMonth), [res.chMonth])
  const chWeek = useMemo(() => pivot(res.chWeek), [res.chWeek])
  const speedCity = useMemo(() => series1(res.speedCity).sort((a, b) => b.value - a.value), [res.speedCity])
  const valueCity = useMemo(() => {
    const rows = series1(res.valueCity)
    const max = Math.max(1, ...rows.map((r) => r.value))
    return rows.map((r) => ({ name: r.x, size: r.value, share: r.value / max }))
  }, [res.valueCity])
  const stores = useMemo(() => {
    const loy = new Map((res.stLoy?.rows ?? []).map((r) => [String(r[0]), num(r[1])]))
    const cnt = new Map((res.stCount?.rows ?? []).map((r) => [String(r[0]), num(r[1])]))
    return (res.stValue?.rows ?? []).map((r) => ({ store: String(r[0]), value: num(r[1]), loy: loy.get(String(r[0])) ?? 0, count: cnt.get(String(r[0])) ?? 0 }))
  }, [res.stValue, res.stLoy, res.stCount])

  // shared chart props — recessive axes/grid, text in ink tokens, RTL mirrors the x-axis and moves y to the right
  const axis = { stroke: t.faint, tick: { fill: t.muted, fontSize: 11 }, tickLine: false, axisLine: false }
  const xAxis = { ...axis, reversed: rtl }
  const yAxis = { ...axis, orientation: (rtl ? 'right' : 'left') as 'right' | 'left', width: 52 }
  const grid = <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
  const tip = {
    contentStyle: { background: t.card, border: `1px solid ${t.grid}`, borderRadius: 10, fontSize: 12, color: t.ink, direction: (rtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr' },
    itemStyle: { color: t.ink },
    labelStyle: { color: t.muted, marginBottom: 4 },
  }
  const legendText = (n: unknown) => <span style={{ color: t.muted }}>{String(n)}</span>
  const legend = <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={legendText} />
  const fmtDay = (x: unknown) => dDay.format(new Date(String(x)))
  const fmtMonth = (x: unknown) => dMonth.format(new Date(String(x)))

  return (
    <div className="flex flex-col gap-3 pb-2">
      <style>{'@keyframes rc-indeterminate { 0% { inset-inline-start: -40%; } 100% { inset-inline-start: 100%; } }'}</style>
      <div className="relative flex flex-wrap items-center gap-2 overflow-hidden rounded-2xl border border-border bg-card p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Board filters</span>
        <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-40" aria-busy={busy}>
          <option value="">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        {busy ? (
          <span className="ms-auto flex items-center gap-2 text-xs font-medium text-foreground" role="status" aria-live="polite">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
            Updating {region ? <bdi>{region}</bdi> : 'all regions'}…
            <span className="tabular-nums text-muted-foreground">
              {done} of {total} panels
            </span>
          </span>
        ) : (
          <span className="ms-auto text-[11px] text-ink-3">Every panel below is a stock Recharts 3 component — no hand-drawn charts</span>
        )}
        {/* determinate board progress along the strip's bottom edge */}
        <div className={`absolute inset-x-0 bottom-0 h-1 bg-muted transition-opacity duration-300 ${busy ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>
      {err && <div className="rounded-xl border border-danger-border bg-danger-050 p-2 text-xs text-danger-800">{err}</div>}

      {/* 1. KPI tiles with sparklines — AreaChart with no axes */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Value through our tills · 30 days" loading={loading('kValue', 'sValue')} value={scalar(res.kValue)} suffix=" SAR" spark={series1(res.sValue)} color={t.one} tip={tip} fmt={(v) => nf.format(v)} rtl={rtl} />
        <Kpi label="Orders · 30 days" loading={loading('kOrders', 'sOrders')} value={scalar(res.kOrders)} spark={series1(res.sOrders)} color={t.one} tip={tip} fmt={(v) => nf.format(v)} rtl={rtl} />
        <Kpi label="Avg order → delivered · 30 days" loading={loading('kSpeed', 'sSpeed')} value={scalar(res.kSpeed)} suffix=" min" spark={series1(res.sSpeed)} color={t.one} tip={tip} fmt={(v) => nf.format(v)} rtl={rtl} />
        <Kpi label="Loyalty-identified share · 30 days" loading={loading('kLoy', 'sLoy')} value={scalar(res.kLoy)} percent spark={series1(res.sLoy)} color={t.one} tip={tip} fmt={(v) => pf.format(v)} rtl={rtl} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* 2. Area + Brush + ReferenceLine */}
        <Panel loading={loading('daily')} title="Value through our tills by day · last 12 months" lib="AreaChart · Brush · ReferenceLine" hint="drag the handles under the chart to zoom">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="rc-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.one} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={t.one} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {grid}
              <XAxis dataKey="x" {...xAxis} tickFormatter={fmtDay} minTickGap={40} />
              <YAxis {...yAxis} tickFormatter={(v) => cf.format(v)} />
              <Tooltip {...tip} labelFormatter={fmtDay} formatter={(v) => [`${nf.format(num(v))} SAR`, 'Value']} />
              <ReferenceLine y={dailyAvg} stroke={t.muted} strokeDasharray="4 4" label={{ value: `daily avg ${cf.format(dailyAvg)}`, fill: t.muted, fontSize: 11, position: rtl ? 'insideTopLeft' : 'insideTopRight' }} />
              <Area type="monotone" dataKey="value" stroke={t.one} strokeWidth={2} fill="url(#rc-fill)" dot={false} activeDot={{ r: 4, stroke: t.card, strokeWidth: 2 }} />
              <Brush dataKey="x" height={22} stroke={t.faint} fill={t.card} travellerWidth={8} tickFormatter={fmtDay} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* 3. Stacked bars, fixed hue per channel */}
        <Panel loading={loading('chMonth')} title="Orders by month and channel · last 12 months" lib="BarChart stackId · Legend">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chMonth} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              {grid}
              <XAxis dataKey="x" {...xAxis} tickFormatter={fmtMonth} />
              <YAxis {...yAxis} tickFormatter={(v) => cf.format(v)} />
              <Tooltip {...tip} labelFormatter={fmtMonth} formatter={(v, n) => [nf.format(num(v)), n]} cursor={{ fill: t.grid, opacity: 0.4 }} />
              {legend}
              {CHANNELS.map((c, i) => (
                <Bar key={c} dataKey={c} stackId="ch" fill={t.channel[c]} stroke={t.card} strokeWidth={1} maxBarSize={40} radius={i === CHANNELS.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 4. 100% stacked area — channel mix */}
        <Panel loading={loading('chWeek')} title="Channel mix of orders by week · last 26 weeks" lib="AreaChart stackOffset=&quot;expand&quot;">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chWeek} stackOffset="expand" margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              {grid}
              <XAxis dataKey="x" {...xAxis} tickFormatter={fmtDay} minTickGap={30} />
              <YAxis {...yAxis} tickFormatter={(v) => pf.format(v)} />
              <Tooltip {...tip} labelFormatter={(x) => `Week of ${fmtDay(x)}`} formatter={(v, n) => [nf.format(num(v)), n]} />
              {legend}
              {CHANNELS.map((c) => (
                <Area key={c} type="monotone" dataKey={c} stackId="mix" stroke={t.card} strokeWidth={1} fill={t.channel[c]} fillOpacity={0.9} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Panel>

        {/* 5. Horizontal bars vs a target line, direct labels */}
        <Panel loading={loading('speedCity')} title={`Avg order → delivered by city · last 30 days · target ${TARGET_MIN} min`} lib="BarChart layout=&quot;vertical&quot; · ReferenceLine · LabelList">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={speedCity} layout="vertical" margin={{ top: 4, right: 36, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" {...xAxis} tickFormatter={(v) => nf.format(v)} />
              <YAxis type="category" dataKey="x" {...yAxis} width={76} interval={0} />
              <Tooltip {...tip} formatter={(v) => [`${nf.format(num(v))} min`, 'Avg order → delivered']} cursor={{ fill: t.grid, opacity: 0.4 }} />
              <ReferenceLine x={TARGET_MIN} stroke={t.ink} strokeDasharray="4 4" label={{ value: `target ${TARGET_MIN}`, fill: t.ink, fontSize: 11, position: 'insideBottomRight' }} />
              <Bar dataKey="value" fill={t.one} radius={rtl ? [4, 0, 0, 4] : [0, 4, 4, 0]} maxBarSize={16}>
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => nf.format(num(v))} style={{ fill: t.muted, fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* 6. Treemap — sequential single hue by size */}
        <Panel loading={loading('valueCity')} title="Where the value is · city share of till value · last 30 days" lib="Treemap">
          <ResponsiveContainer width="100%" height={240}>
            <Treemap data={valueCity} dataKey="size" nameKey="name" aspectRatio={4 / 3} isAnimationActive={false} content={<TreeCell color={t.one} card={t.card} rtl={rtl} />}>
              <Tooltip {...tip} formatter={(v) => [`${nf.format(num(v))} SAR`, 'Value']} />
            </Treemap>
          </ResponsiveContainer>
        </Panel>

        {/* 7. Bubble scatter — stores, value vs loyalty share, size = till sales */}
        <Panel loading={loading('stValue', 'stLoy', 'stCount')} title="Stores · till value vs loyalty share · bubble = till sales · last 30 days" lib="ScatterChart · ZAxis">
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
              <XAxis type="number" dataKey="value" name="Value" {...xAxis} tickFormatter={(v) => cf.format(v)} />
              <YAxis type="number" dataKey="loy" name="Loyalty share" {...yAxis} tickFormatter={(v) => pf.format(v)} domain={['auto', 'auto']} />
              <ZAxis type="number" dataKey="count" range={[30, 260]} />
              <Tooltip {...tip} content={<StoreTip t={t} />} cursor={{ strokeDasharray: '3 3', stroke: t.faint }} />
              <Scatter data={stores} fill={t.one} fillOpacity={0.55} stroke={t.card} strokeWidth={2} />
            </ScatterChart>
          </ResponsiveContainer>
        </Panel>

        {/* 8. Composed — monthly bars + 3-month average, SAME axis and unit */}
        <Panel loading={loading('monthly')} title="Value through our tills by month, with a 3-month average" lib="ComposedChart (Bar + Line, one axis)" wide>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              {grid}
              <XAxis dataKey="x" {...xAxis} tickFormatter={fmtMonth} />
              <YAxis {...yAxis} tickFormatter={(v) => cf.format(v)} />
              <Tooltip {...tip} labelFormatter={fmtMonth} formatter={(v, n) => [`${nf.format(num(v))} SAR`, n === 'avg3' ? '3-month average' : 'Month']} cursor={{ fill: t.grid, opacity: 0.4 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: t.muted }} formatter={(n) => legendText(n === 'avg3' ? '3-month average' : 'Month')} />
              <Bar dataKey="value" fill={t.one} fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line dataKey="avg3" type="monotone" stroke={t.one} strokeWidth={2} dot={{ r: 3, fill: t.one, stroke: t.card, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <p className="text-[11px] text-ink-3">
        Recharts 3.10 (MIT) · each panel is a query to Metabase OSS <code>/api/dataset</code> · channel hues fixed per channel and validated for colour-blind separation in light and dark · Arabic mirrors the axes with <code>reversed</code> + <code>orientation</code>
      </p>
    </div>
  )
}

type Tip = { contentStyle: React.CSSProperties; itemStyle: React.CSSProperties; labelStyle: React.CSSProperties }

function Kpi({ label, loading, value, suffix, percent, spark, color, tip, fmt, rtl }: { label: string; loading: boolean; value?: number; suffix?: string; percent?: boolean; spark: { x: string; value: number }[]; color: string; tip: Tip; fmt: (v: number) => string; rtl: boolean }) {
  const id = `spark-${label.replace(/\W/g, '')}`
  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-3" aria-busy={loading}>
      <LoadBar on={loading} />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums text-foreground transition-opacity duration-300 ${loading ? 'opacity-40' : ''}`}>
        {value == null ? '—' : percent ? pf.format(value) : nf.format(value)}
        {value != null && suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
      <div dir="ltr" className={`mt-1 h-12 transition-opacity duration-300 ${loading ? 'opacity-30' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="x" hide reversed={rtl} />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip {...tip} labelFormatter={(x) => dDay.format(new Date(String(x)))} formatter={(v) => [fmt(num(v)), '']} separator="" />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Panel({ title, lib, hint, wide, loading, children }: { title: string; lib: string; hint?: string; wide?: boolean; loading: boolean; children: React.ReactNode }) {
  return (
    <section className={`relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-3 ${wide ? 'xl:col-span-2' : ''}`} aria-busy={loading}>
      <LoadBar on={loading} />
      <div className="flex flex-wrap items-center gap-2">
        {loading && <Loader2 className="size-4 animate-spin text-primary" aria-hidden />}
        <h3 className="text-sm font-semibold">
          <bdi>{title}</bdi>
        </h3>
        <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{lib}</code>
        {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
      </div>
      {/* SVG text inherits dir; under RTL it flips text-anchor and labels collide. Keep the SVG LTR and mirror with props. */}
      <div dir="ltr" className={`relative min-w-0 transition-opacity duration-300 ${loading ? 'pointer-events-none opacity-35' : ''}`}>
        {children}
      </div>
      {loading && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex justify-center">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm">Updating…</span>
        </div>
      )}
    </section>
  )
}

/** A thin indeterminate bar along the card's top edge while its query runs. */
function LoadBar({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary-050" aria-hidden>
      <div className="absolute top-0 h-full w-2/5 bg-primary" style={{ animation: 'rc-indeterminate 1.1s ease-in-out infinite' }} />
    </div>
  )
}

/** Treemap tile: one hue, opacity by share (sequential light → dark), 2px surface gap, label when it fits. */
function TreeCell(props: { x?: number; y?: number; width?: number; height?: number; name?: string; share?: number; size?: number; color: string; card: string; rtl: boolean }) {
  const { x = 0, y = 0, width = 0, height = 0, name, share = 0, size = 0, color, card, rtl } = props
  const tx = rtl ? x + width - 8 : x + 8
  const anchor = rtl ? 'end' : 'start'
  if (!name) return null
  const fits = width > 64 && height > 30
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4} fill={color} fillOpacity={0.25 + 0.75 * share} stroke={card} strokeWidth={2} />
      {fits && (
        <>
          <text x={tx} y={y + 18} textAnchor={anchor} fill={share > 0.5 ? '#ffffff' : 'currentColor'} fontSize={12} fontWeight={600}>
            {name}
          </text>
          <text x={tx} y={y + 33} textAnchor={anchor} fill={share > 0.5 ? '#ffffff' : 'currentColor'} fontSize={11} opacity={0.85}>
            {cf.format(size)} SAR
          </text>
        </>
      )}
    </g>
  )
}

function StoreTip({ active, payload, t }: { active?: boolean; payload?: { payload: { store: string; value: number; loy: number; count: number } }[]; t: ReturnType<typeof useTokens> }) {
  const p = active && payload?.[0]?.payload
  if (!p) return null
  return (
    <div style={{ background: t.card, border: `1px solid ${t.grid}`, borderRadius: 10, fontSize: 12, color: t.ink, padding: '8px 10px' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        <bdi>{p.store}</bdi>
      </div>
      <div>Value: {nf.format(p.value)} SAR</div>
      <div>Loyalty share: {pf.format(p.loy)}</div>
      <div>Till sales: {nf.format(p.count)}</div>
    </div>
  )
}
