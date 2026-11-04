/* PROTOTYPE — throwaway. Ticket 747. A LINKED dashboard: several native panels (KPIs, a master
 * grid, a pie, a trend line, a speed chart) that all share ONE selection + a board filter strip.
 * Click a store row → every other panel cross-filters to that store. Each panel is just a query to
 * Metabase OSS `/api/dataset` rendered by our own NativeChart — no SDK, no iframe. This proves the
 * "professional dashboard, cross-filtered, master-detail" shape is ours to build. Copy is literal.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Store, X } from 'lucide-react'
import Button from '@/core/ui/Button'
import Select from '@/core/ui/Select'
import NativeChart, { type DataSet } from './NativeChart'
import { toMbql, type Plan } from './ask-matcher'

const env = import.meta.env
const FIELDS = JSON.parse(env.VITE_MB_FIELDS)
const TABLES = JSON.parse(env.VITE_MB_TABLES)
const DB = Number(env.VITE_MB_DATABASE_ID)

type Table = 'till_sales' | 'orders' | 'deliveries'
const DATE_COL: Record<Table, string> = { till_sales: 'trx_date', orders: 'entry_time', deliveries: 'created_at' }
const REGIONS = ['Central', 'Western', 'Eastern', 'Southern', 'Northern', 'Bahrain']
const CHANNELS = ['HungerStation', 'Call centre', 'Insurance platform', 'Own app + web', 'Other']
const PERIODS: Record<string, { label: string; clause: (d: unknown) => unknown[] }> = {
  '7d': { label: 'Last 7 days', clause: (d) => ['time-interval', d, -7, 'day'] },
  '30d': { label: 'Last 30 days', clause: (d) => ['time-interval', d, -30, 'day'] },
  '12m': { label: 'Last 12 months', clause: (d) => ['time-interval', d, -12, 'month'] },
}

type By = Plan['by']
type Filters = Plan['filters']
function mk(table: Table, measure: { key: string; label: string }, by: By, filters: Filters, periodKey: string, display: Plan['display'], topN?: number): Plan {
  return { table, measure, by, filters, period: PERIODS[periodKey] ?? PERIODS['30d'], display, topN, title: measure.label }
}
async function runQuery(plan: Plan): Promise<DataSet> {
  const q = toMbql(plan, FIELDS, TABLES, DB).dataset_query
  const res = await fetch('/mbapi/dataset', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.VITE_MB_API_KEY }, body: JSON.stringify(q) })
  const j = await res.json()
  if (!res.ok || j.error) throw new Error(String(j.error ?? 'query failed'))
  return { cols: j.data.cols, rows: j.data.rows }
}

const nf = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const pf = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 })

export default function LinkedBoardVariant() {
  const [region, setRegion] = useState('')
  const [channel, setChannel] = useState('')
  const [periodKey, setPeriodKey] = useState('30d')
  const [selStore, setSelStore] = useState<string | null>(null)

  // one filter set shared by the panels; the grid is the selector so it ignores selStore
  const specs = useMemo(() => {
    const geo = (withStore: boolean, withChannel: boolean): Filters => {
      const f: Filters = []
      if (region) f.push({ col: 'region', label: 'Region', value: region })
      if (withChannel && channel) f.push({ col: 'channel', label: 'Channel', value: channel })
      if (withStore && selStore) f.push({ col: 'store_name', label: 'Store', value: selStore })
      return f
    }
    const deliv = (withStore: boolean): Filters => [...geo(withStore, true), { col: 'delivered', label: 'Delivered', value: 1 }]
    const month = (table: Table): By[number] => ({ col: DATE_COL[table], label: 'Month', unit: 'month' })
    return {
      kpiValue: mk('till_sales', { key: 'net', label: 'Value through our tills (SAR)' }, [], geo(true, false), periodKey, 'scalar'),
      kpiOrders: mk('orders', { key: 'count', label: 'Orders' }, [], geo(true, true), periodKey, 'scalar'),
      kpiSpeed: mk('deliveries', { key: 'o2dMedian', label: 'Avg order → delivered (min)' }, [], deliv(true), periodKey, 'scalar'),
      kpiLoy: mk('till_sales', { key: 'loyShare', label: 'Loyalty share' }, [], geo(true, false), periodKey, 'scalar'),
      grid: mk('till_sales', { key: 'net', label: 'Value through our tills (SAR)' }, [{ col: 'store_name', label: 'Store' }], geo(false, false), periodKey, 'table', 15),
      pie: mk('orders', { key: 'count', label: 'Orders' }, [{ col: 'channel', label: 'Channel' }], geo(true, false), periodKey, 'pie'),
      line: mk('till_sales', { key: 'net', label: 'Value through our tills (SAR)' }, [month('till_sales')], geo(true, false), '12m', 'line'),
      speed: mk('deliveries', { key: 'o2dMedian', label: 'Avg order → delivered (min)' }, [{ col: 'channel', label: 'Channel' }], deliv(true), periodKey, 'row'),
    }
  }, [region, channel, periodKey, selStore])

  // Streaming, per panel: only a panel whose QUERY changed re-runs (clicking a store leaves the store
  // grid alone), each redraws the moment its own answer lands, the old chart stays dimmed meanwhile,
  // and an answer to a superseded query is dropped (latest[k] no longer matches).
  const [res, setRes] = useState<Record<string, DataSet | undefined>>({})
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState<string[]>([])
  const latest = useRef<Record<string, string>>({})
  useEffect(() => {
    const changed = Object.entries(specs).flatMap(([k, p]) => {
      const q = JSON.stringify(toMbql(p, FIELDS, TABLES, DB).dataset_query)
      if (latest.current[k] === q) return []
      latest.current[k] = q
      return [[k, p, q] as const]
    })
    if (!changed.length) return
    setPending((cur) => new Set([...cur, ...changed.map(([k]) => k)]))
    setFailed((f) => f.filter((k) => !changed.some(([c]) => c === k)))
    for (const [k, p, q] of changed) {
      runQuery(p)
        .then((d) => {
          if (latest.current[k] === q) setRes((r) => ({ ...r, [k]: d }))
        })
        .catch(() => {
          if (latest.current[k] === q) setFailed((f) => [...f, k])
        })
        .finally(() => {
          if (latest.current[k] !== q) return
          setPending((cur) => {
            const n = new Set(cur)
            n.delete(k)
            return n
          })
        })
    }
  }, [specs])
  const total = Object.keys(specs).length
  const busy = pending.size > 0
  const done = total - pending.size
  const err = failed.length ? 'One or more panels failed to load.' : null

  const scalar = (d?: DataSet) => (d?.rows[0]?.[d.cols.length - 1] as number | undefined)
  const gridRows = (res.grid?.rows ?? []) as [string, number][]

  return (
    <div className="flex flex-col gap-3 pb-2">
      {/* board-level filter strip */}
      <style>{'@keyframes rc-indeterminate { 0% { inset-inline-start: -40%; } 100% { inset-inline-start: 100%; } }'}</style>
      <div className="relative flex flex-wrap items-center gap-2 overflow-hidden rounded-2xl border border-border bg-card p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Board filters</span>
        <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-40">
          <option value="">All regions</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-44">
          <option value="">All channels</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} className="w-40">
          {Object.entries(PERIODS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </Select>
        <div className="ms-auto flex items-center gap-2">
          {busy && (
            <span className="flex items-center gap-2 text-xs font-medium text-foreground" role="status" aria-live="polite">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
              Updating…
              <span className="tabular-nums text-muted-foreground">
                {done} of {total} panels
              </span>
            </span>
          )}
          {selStore ? (
            <Button variant="secondary" onClick={() => setSelStore(null)}>
              <Store className="size-3.5" aria-hidden />
              <bdi>{selStore}</bdi>
              <X className="size-3.5" aria-hidden />
            </Button>
          ) : (
            <span className="text-[11px] text-ink-3">Click a store row to focus every panel</span>
          )}
        </div>
        {/* determinate board progress along the strip's bottom edge */}
        <div className={`absolute inset-x-0 bottom-0 h-1 bg-muted transition-opacity duration-300 ${busy ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {err && <div className="rounded-xl border border-danger-border bg-danger-050 p-2 text-xs text-danger-800">{err}</div>}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Value through our tills" loading={pending.has('kpiValue')} value={scalar(res.kpiValue)} suffix=" SAR" />
        <Kpi label="Orders" loading={pending.has('kpiOrders')} value={scalar(res.kpiOrders)} />
        <Kpi label="Avg order → delivered" loading={pending.has('kpiSpeed')} value={scalar(res.kpiSpeed)} suffix=" min" />
        <Kpi label="Loyalty-identified share" loading={pending.has('kpiLoy')} value={scalar(res.kpiLoy)} percent />
      </div>

      {/* main grid: master (stores) + line on the left, pie + speed on the right */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-3">
          <Panel loading={pending.has('grid')} title={`Top stores by till value${region ? ` · ${region}` : ''}`} hint="the master — click a row">
            <div className="max-h-[36vh] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-grid-head text-grid-head-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold">Store</th>
                    <th className="px-3 py-2 text-end font-semibold">Value (SAR)</th>
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map(([store, value]) => (
                    <tr
                      key={store}
                      onClick={() => setSelStore((s) => (s === store ? null : store))}
                      className={`cursor-pointer border-t border-border ${selStore === store ? 'bg-primary-050 text-primary-800' : 'odd:bg-card even:bg-card-2 hover:bg-accent'}`}
                    >
                      <td className="px-3 py-1.5 text-start"><bdi>{store}</bdi></td>
                      <td className="px-3 py-1.5 text-end tabular-nums">{nf.format(value)}</td>
                    </tr>
                  ))}
                  {gridRows.length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-muted-foreground">No stores</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel loading={pending.has('line')} title={`${selStore ?? 'All stores'} — value by month`} grow>
            <div className="h-[34vh]">{res.line ? <NativeChart data={res.line} display="line" measureLabel="Value (SAR)" /> : <Empty />}</div>
          </Panel>
        </div>
        <div className="flex flex-col gap-3">
          <Panel loading={pending.has('pie')} title={`Orders by channel${selStore ? ` · ${selStore}` : ''}`} grow>
            <div className="h-[34vh]">{res.pie ? <NativeChart data={res.pie} display="pie" measureLabel="Orders" /> : <Empty />}</div>
          </Panel>
          <Panel loading={pending.has('speed')} title={`Delivery speed by channel${selStore ? ` · ${selStore}` : ''}`} grow>
            <div className="h-[34vh]">{res.speed ? <NativeChart data={res.speed} display="row" measureLabel="Avg min" /> : <Empty />}</div>
          </Panel>
        </div>
      </div>

      <p className="text-[11px] text-ink-3">
        Eight linked panels · one shared selection + board filters · each panel is a query to Metabase OSS <code>/api/dataset</code>, rendered by our own charts · no SDK, no iframe
      </p>
    </div>
  )
}

function Kpi({ label, loading, value, suffix, percent }: { label: string; loading: boolean; value?: number; suffix?: string; percent?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-3" aria-busy={loading}>
      <LoadBar on={loading} />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden />}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums text-foreground transition-opacity duration-300 ${loading ? 'opacity-40' : ''}`}>
        {value == null ? '—' : percent ? pf.format(value) : nf.format(value)}
        {value != null && suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  )
}

function Panel({ title, hint, grow, loading, children }: { title: string; hint?: string; grow?: boolean; loading: boolean; children: React.ReactNode }) {
  return (
    <section className={`relative flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-3 ${grow ? 'flex-1' : ''}`} aria-busy={loading}>
      <LoadBar on={loading} />
      <div className="flex items-center gap-2">
        {loading && <Loader2 className="size-4 animate-spin text-primary" aria-hidden />}
        <h3 className="text-sm font-semibold"><bdi>{title}</bdi></h3>
        {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
      </div>
      <div className={`relative min-h-0 transition-opacity duration-300 ${loading ? 'pointer-events-none opacity-35' : ''}`}>{children}</div>
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

function Empty() {
  return <div className="grid h-full place-items-center text-xs text-muted-foreground">Loading…</div>
}
