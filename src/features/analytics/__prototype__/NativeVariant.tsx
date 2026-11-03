/* PROTOTYPE — throwaway. Ticket 747. The NATIVE variant: a query builder built entirely from our
 * own core/ui controls (Chip, Select, Button) and our own NativeChart. No Metabase SDK, no iframe.
 * The builder assembles the SAME `Plan` the Ask variant uses, turns it into MBQL, and POSTs it to
 * Metabase OSS's `/api/dataset` (run) or `/api/card` (save) through the Vite `/mbapi` proxy. This is
 * the "we build the builder ourselves over the free engine" path, side by side with the embedded one.
 * Raw fetch through `/mbapi` is a prototype exception to api-envelope. Copy is literal (throwaway).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, Rows3, Save, Table2, Hash } from 'lucide-react'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Select from '@/core/ui/Select'
import NativeChart, { type DataSet, type Display } from './NativeChart'
import { toMbql, type Plan } from './ask-matcher'

const env = import.meta.env
const FIELDS = JSON.parse(env.VITE_MB_FIELDS)
const TABLES = JSON.parse(env.VITE_MB_TABLES)
const DB = Number(env.VITE_MB_DATABASE_ID)

const SUBJECTS = [
  { key: 'till_sales', label: 'Till sales' },
  { key: 'orders', label: 'Orders' },
  { key: 'deliveries', label: 'Deliveries' },
] as const
type Table = (typeof SUBJECTS)[number]['key']

const MEASURES: Record<Table, { key: string; label: string }[]> = {
  till_sales: [
    { key: 'net', label: 'Value through our tills (SAR)' },
    { key: 'tillCount', label: 'Till sales' },
    { key: 'loyShare', label: 'Loyalty-identified share' },
    { key: 'returnRate', label: 'Return rate' },
    { key: 'nphies', label: 'Insurance (NPHIES) till sales' },
  ],
  orders: [{ key: 'count', label: 'Orders' }],
  deliveries: [
    { key: 'o2dMedian', label: 'Average order → delivered (min)' },
    { key: 'r2dMedian', label: 'Average ready → delivered (min)' },
    { key: 'sameDay', label: 'Delivered same day (share)' },
  ],
}
const PERCENT = new Set(['loyShare', 'returnRate', 'sameDay'])
const DATE_COL: Record<Table, string> = { till_sales: 'trx_date', orders: 'entry_time', deliveries: 'created_at' }

const GRAINS = [
  { key: '', label: 'No trend' },
  { key: 'month', label: 'By month' },
  { key: 'week', label: 'By week' },
  { key: 'day', label: 'By day' },
] as const
const DIMS = [
  { col: 'city', label: 'City' },
  { col: 'region', label: 'Region' },
  { col: 'channel', label: 'Channel', only: ['orders', 'deliveries'] as Table[] },
  { col: 'store_name', label: 'Store' },
]
const CITIES = ['Riyadh', 'Jeddah', 'Makkah', 'Madinah', 'Dammam', 'Khobar', 'Abha', 'Tabuk', 'Buraidah', 'Manama']
const CHANNELS = ['HungerStation', 'Call centre', 'Insurance platform', 'Own app + web', 'Other']
const PERIODS: { key: string; label: string; clause: (d: unknown) => unknown[] }[] = [
  { key: '7d', label: 'Last 7 days', clause: (d) => ['time-interval', d, -7, 'day'] },
  { key: '30d', label: 'Last 30 days', clause: (d) => ['time-interval', d, -30, 'day'] },
  { key: '4w', label: 'Last 4 weeks', clause: (d) => ['time-interval', d, -4, 'week'] },
  { key: '12m', label: 'Last 12 months', clause: (d) => ['time-interval', d, -12, 'month'] },
  { key: 'ytd', label: 'Year to date', clause: (d) => ['time-interval', d, 'current', 'year'] },
]
const DISPLAYS: { key: Display; label: string; Icon: typeof BarChart3 }[] = [
  { key: 'bar', label: 'Bars', Icon: BarChart3 },
  { key: 'row', label: 'Rows', Icon: Rows3 },
  { key: 'line', label: 'Line', Icon: LineIcon },
  { key: 'pie', label: 'Pie', Icon: PieIcon },
  { key: 'table', label: 'Table', Icon: Table2 },
  { key: 'scalar', label: 'Number', Icon: Hash },
]

// Drill ladder: what breaking a clicked value down one level groups by next.
const DRILL_CHILD: Record<string, { col?: string; grain?: string; label: string } | undefined> = {
  city: { col: 'store_name', label: 'store' },
  region: { col: 'city', label: 'city' },
  channel: { grain: 'month', label: 'month' },
  store_name: undefined, // leaf — filter only
}
const FINER: Record<string, string> = { month: 'day', week: 'day', day: '' }
type Drill = { col: string; label: string; value: string; unit?: 'day' | 'week' | 'month'; prevDims: string[]; prevGrain: string }
type Pick = { col: string; label: string; value: string; unit?: 'day' | 'week' | 'month' }

export default function NativeVariant() {
  const [table, setTable] = useState<Table>('till_sales')
  const [measureKey, setMeasureKey] = useState('net')
  const [grain, setGrain] = useState('')
  const [dims, setDims] = useState<string[]>(['city'])
  const [city, setCity] = useState('')
  const [channel, setChannel] = useState('')
  const [bahrain, setBahrain] = useState(false)
  const [periodKey, setPeriodKey] = useState('30d')
  const [topN, setTopN] = useState(0)
  const [override, setOverride] = useState<Display | ''>('')
  const [drills, setDrills] = useState<Drill[]>([])
  const [pick, setPick] = useState<Pick | null>(null)

  const measures = MEASURES[table]
  const measure = useMemo(() => measures.find((m) => m.key === measureKey) ?? measures[0], [measures, measureKey])
  const availDims = useMemo(() => DIMS.filter((d) => !d.only || d.only.includes(table)), [table])

  // switching subject: reset to that subject's first measure and drop dims it doesn't have
  const onTable = (t: Table) => {
    setTable(t)
    setMeasureKey(MEASURES[t][0].key)
    setDims((ds) => ds.filter((c) => DIMS.find((d) => d.col === c && (!d.only || d.only.includes(t)))))
    if (!['orders', 'deliveries'].includes(t)) setChannel('')
    setDrills([])
    setPick(null)
  }
  const toggleDim = (col: string) => setDims((ds) => (ds.includes(col) ? ds.filter((c) => c !== col) : [...ds, col]))

  const plan = useMemo<Plan>(() => {
    const by: Plan['by'] = []
    if (grain) by.push({ col: DATE_COL[table], label: grain[0].toUpperCase() + grain.slice(1), unit: grain as 'day' | 'week' | 'month' })
    for (const d of availDims) if (dims.includes(d.col)) by.push({ col: d.col, label: d.label })
    const filters: Plan['filters'] = []
    if (city) filters.push({ col: 'city', label: 'City', value: city })
    if (channel && table !== 'till_sales') filters.push({ col: 'channel', label: 'Channel', value: channel })
    if (bahrain) filters.push({ col: 'country', label: 'Country', value: 'Bahrain' })
    if (table === 'deliveries') filters.push({ col: 'delivered', label: 'Delivered', value: 1 })
    for (const d of drills) filters.push({ col: d.col, label: d.label, value: d.value, unit: d.unit })
    const period = PERIODS.find((p) => p.key === periodKey) ?? PERIODS[1]
    const display: Display = override || autoDisplay(by, table, dims)
    const title = `${measure.label}${by.filter((b) => !b.unit).length ? ' by ' + by.filter((b) => !b.unit).map((b) => b.label.toLowerCase()).join(' and ') : ''}${filters.filter((f) => f.col !== 'delivered').map((f) => ` · ${f.value}`).join('')} · ${period.label.toLowerCase()}`
    return { table, measure, by, filters, period, display, topN: topN || undefined, title }
  }, [table, measure, grain, dims, availDims, city, channel, bahrain, periodKey, topN, override, drills])

  const [data, setData] = useState<DataSet | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<{ id: number; title: string } | null>(null)
  const seq = useRef(0)

  // live preview: run the plan against /api/dataset on every change (debounced)
  useEffect(() => {
    const id = ++seq.current
    const q = toMbql(plan, FIELDS, TABLES, DB).dataset_query
    setBusy(true)
    const h = setTimeout(async () => {
      try {
        const res = await fetch('/mbapi/dataset', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.VITE_MB_API_KEY }, body: JSON.stringify(q) })
        const j = await res.json()
        if (id !== seq.current) return
        if (!res.ok || j.error) throw new Error(j.error || (await res.text()))
        setData({ cols: j.data.cols, rows: j.data.rows })
        setError(null)
      } catch (e) {
        if (id === seq.current) setError(String(e))
      } finally {
        if (id === seq.current) setBusy(false)
      }
    }, 250)
    return () => clearTimeout(h)
  }, [plan])

  const save = async () => {
    setSaved(null)
    const body = { name: plan.title, display: plan.display === 'row' ? 'bar' : plan.display === 'scalar' ? 'scalar' : plan.display, collection_id: Number(env.VITE_MB_COLLECTION_ID), type: 'question', description: 'Built with the native builder (prototype 747).', ...toMbql(plan, FIELDS, TABLES, DB) }
    const res = await fetch('/mbapi/card', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.VITE_MB_API_KEY }, body: JSON.stringify(body) })
    if (res.ok) setSaved({ id: (await res.json()).id, title: plan.title })
    else setError(await res.text())
  }

  // drill-through: click a mark → offer break-down / filter on the primary (first) grouping
  const prim = plan.by[0]
  const childFor = (p: Pick) => (p.unit ? (FINER[p.unit] ? { grain: FINER[p.unit], label: FINER[p.unit] } : undefined) : DRILL_CHILD[p.col])
  const onPick = ({ value }: { value: string }) => {
    if (!prim) return
    setPick({ col: prim.col, label: prim.label, value, unit: prim.unit })
  }
  const applyDrill = (p: Pick, mode: 'in' | 'filter') => {
    setDrills((ds) => [...ds, { col: p.col, label: p.label, value: p.value, unit: p.unit, prevDims: dims, prevGrain: grain }])
    // the clicked dimension is now a fixed filter → drop it from the grouping
    if (p.unit) setGrain('')
    else setDims((d) => d.filter((c) => c !== p.col))
    if (mode === 'in') {
      const child = childFor(p)
      if (child?.grain) setGrain(child.grain)
      else if (child?.col) setDims((d) => (d.includes(child.col!) ? d : [...d, child.col!]))
    }
    setOverride('')
    setPick(null)
  }
  const popDrill = (i: number) => {
    const at = drills[i]
    setDims(at.prevDims)
    setGrain(at.prevGrain)
    setDrills((ds) => ds.slice(0, i))
    setPick(null)
  }

  const percent = PERCENT.has(measure.key)

  return (
    <div className="grid h-full min-h-[70vh] grid-cols-[300px_1fr] gap-3">
      {/* the builder rail — all our own controls */}
      <aside className="flex flex-col gap-4 overflow-auto rounded-2xl border border-border bg-card p-4">
        <Group label="Subject">
          <div className="flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => (
              <Chip key={s.key} variant="tab" on={table === s.key} onClick={() => onTable(s.key)}>{s.label}</Chip>
            ))}
          </div>
        </Group>
        <Group label="Measure">
          <div className="flex flex-col gap-1.5">
            {measures.map((m) => (
              <Chip key={m.key} on={measureKey === m.key} onClick={() => setMeasureKey(m.key)} className="justify-start">{m.label}</Chip>
            ))}
          </div>
        </Group>
        <Group label="Trend">
          <Select value={grain} onChange={(e) => setGrain(e.target.value)}>
            {GRAINS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </Select>
        </Group>
        <Group label="Group by">
          <div className="flex flex-wrap gap-1.5">
            {availDims.map((d) => (
              <Chip key={d.col} on={dims.includes(d.col)} onClick={() => toggleDim(d.col)}>{d.label}</Chip>
            ))}
          </div>
        </Group>
        <Group label="Filter">
          <div className="flex flex-col gap-1.5">
            <Select value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">All cities</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            {table !== 'till_sales' && (
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="">All channels</option>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            )}
            <Chip on={bahrain} onClick={() => setBahrain((b) => !b)}>Bahrain only</Chip>
          </div>
        </Group>
        <Group label="Period & limit">
          <div className="flex flex-col gap-1.5">
            <Select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)}>
              {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </Select>
            <Select value={String(topN)} onChange={(e) => setTopN(Number(e.target.value))}>
              <option value="0">No limit</option>
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
            </Select>
          </div>
        </Group>
      </aside>

      {/* the result — our chart */}
      <section className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 truncate text-sm font-semibold"><bdi>{plan.title}</bdi></h2>
          <div className="ms-auto flex items-center gap-1">
            {DISPLAYS.map(({ key, label, Icon }) => (
              <Chip key={key} variant="tab" on={plan.display === key} onClick={() => setOverride(override === key ? '' : key)} title={label} aria-label={label} className="px-2">
                <Icon className="size-3.5" aria-hidden />
              </Chip>
            ))}
            <Button variant="secondary" onClick={() => void save()} className="ms-1">
              <Save className="size-3.5" aria-hidden />
              Save as view
            </Button>
          </div>
        </div>
        {drills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Drilled:</span>
            {drills.map((d, i) => (
              <button key={i} onClick={() => popDrill(i)} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-050 px-2 py-0.5 font-medium text-primary-800 hover:bg-primary/15">
                <bdi>{d.label}: {d.value}</bdi>
                <span aria-hidden>✕</span>
              </button>
            ))}
          </div>
        )}
        {pick && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary-050 px-3 py-2 text-xs">
            <span className="font-semibold text-primary-800"><bdi>{pick.label}: {pick.value}</bdi></span>
            {childFor(pick) && (
              <Button variant="primary" onClick={() => applyDrill(pick, 'in')}>Break down by {childFor(pick)!.label}</Button>
            )}
            <Button variant="secondary" onClick={() => applyDrill(pick, 'filter')}>Filter to this</Button>
            <button onClick={() => setPick(null)} className="ms-auto text-ink-3 hover:text-foreground" aria-label="Dismiss">✕</button>
          </div>
        )}
        {saved && (
          <div className="rounded-xl border border-success-border bg-success-050 px-3 py-1.5 text-xs text-success-800">
            Saved “<bdi>{saved.title}</bdi>” as view #{saved.id} — it’s now in HQ analytics and re-runs on demand.
          </div>
        )}
        {error && <div className="rounded-xl border border-danger-border bg-danger-050 p-3 text-xs text-danger-800">{error}</div>}
        <div className="relative h-[72vh]">
          {busy && <div className="absolute end-2 top-1 z-10 text-[11px] text-muted-foreground">running…</div>}
          {data ? <NativeChart data={data} display={plan.display} measureLabel={measure.label} percent={percent} onPick={onPick} /> : !error && <div className="grid h-full place-items-center text-sm text-muted-foreground">Building…</div>}
        </div>
        <p className="text-[11px] text-ink-3">
          Click any bar, slice or point to drill in · Native oms-react UI · Metabase OSS engine over <code>/api/dataset</code> · no SDK, no iframe
        </p>
      </section>
    </div>
  )
}

function autoDisplay(by: Plan['by'], table: Table, dims: string[]): Display {
  const hasUnit = by.some((b) => b.unit)
  if (by.length === 0) return 'scalar'
  if (hasUnit) return by.length > 1 ? 'line' : by[0].unit === 'week' ? 'bar' : 'line'
  if (dims.includes('store_name')) return 'table'
  if (dims.includes('channel') && table === 'orders') return 'pie'
  return 'row'
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}
