/* PROTOTYPE — throwaway. Ticket 747. A NATIVE chart renderer (recharts) themed from the DMSCO
 * tokens. No Metabase frontend, no SDK, no iframe: this is OUR component drawing rows that came
 * back from Metabase OSS's `/api/dataset`. It proves the "build the builder ourselves" path —
 * the engine stays Metabase (free, OSS), the whole UI is ours.
 * Copy is literal (throwaway branch).
 */
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type Display = 'line' | 'bar' | 'row' | 'pie' | 'table' | 'scalar'

type Col = { name: string; display_name: string; base_type?: string }
export type DataSet = { cols: Col[]; rows: (string | number | null)[][] }

function tokens() {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  return {
    ink: v('--foreground'),
    muted: v('--muted-foreground'),
    grid: v('--border'),
    card: v('--card'),
    palette: [v('--primary'), v('--gold'), v('--success'), v('--post'), v('--prescription'), v('--attention'), v('--danger'), v('--ink-3')].filter(Boolean),
  }
}

const nf = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const pf = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 })

export type Pick = { value: string; seriesLabel?: string }

export default function NativeChart({ data, display, measureLabel, percent, onPick }: { data: DataSet; display: Display; measureLabel: string; percent?: boolean; onPick?: (p: Pick) => void }) {
  const pickable = Boolean(onPick)
  const pick = (value: unknown, seriesLabel?: string) => onPick?.({ value: String(value), seriesLabel })
  const t = useMemo(tokens, [data])
  const fmt = (n: unknown) => (typeof n !== 'number' ? '—' : percent ? pf.format(n) : nf.format(n))
  const measureIdx = data.cols.length - 1
  const dims = data.cols.slice(0, measureIdx)
  const twoDim = dims.length >= 2
  // all hooks run unconditionally (rules of hooks) — the branches below only read them
  const pivot = useMemo(() => {
    if (!twoDim) return null
    const series = [...new Set(data.rows.map((r) => String(r[1])))]
    const byX = new Map<string, Record<string, number | string>>()
    for (const r of data.rows) {
      const x = String(r[0])
      const row = byX.get(x) ?? { name: x }
      row[String(r[1])] = r[measureIdx] as number
      byX.set(x, row)
    }
    return { series, rows: [...byX.values()] }
  }, [data, twoDim, measureIdx])
  const single = useMemo(() => data.rows.map((r) => ({ name: String(r[0]), value: r[measureIdx] as number })), [data, measureIdx])

  // scalar — a single number
  if (display === 'scalar' || dims.length === 0) {
    const val = data.rows[0]?.[measureIdx]
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 py-10">
        <div className="text-5xl font-semibold tabular-nums text-foreground">{fmt(val)}</div>
        <div className="text-sm text-muted-foreground">{measureLabel}</div>
      </div>
    )
  }

  // table — a plain native grid
  if (display === 'table') {
    return (
      <div className="max-h-full overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-grid-head text-grid-head-foreground">
            <tr>
              {data.cols.map((c, i) => (
                <th key={c.name} className={`px-3 py-2 font-semibold ${i === measureIdx ? 'text-end' : 'text-start'}`}>{c.display_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, ri) => (
              <tr key={ri} className={`border-t border-border odd:bg-card even:bg-card-2 ${pickable ? 'cursor-pointer hover:bg-accent' : ''}`} onClick={pickable ? () => pick(r[0]) : undefined}>
                {r.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-1.5 ${ci === measureIdx ? 'text-end tabular-nums' : 'text-start'}`}>
                    {ci === measureIdx ? fmt(cell) : <bdi>{String(cell ?? '—')}</bdi>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // two dimensions where the first is time → multi-series line (dim2 pivoted into series above)
  const axis = { stroke: t.muted, fontSize: 11 }
  const tip = {
    contentStyle: { background: t.card, border: `1px solid ${t.grid}`, borderRadius: 10, fontSize: 12, color: t.ink },
    formatter: (val: number) => [fmt(val), measureLabel] as [string, string],
  }

  if (display === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={single} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="75%" innerRadius="45%" paddingAngle={2} onClick={pickable ? (d: { name?: string }) => pick(d?.name) : undefined} cursor={pickable ? 'pointer' : undefined}>
            {single.map((_, i) => (
              <Cell key={i} fill={t.palette[i % t.palette.length]} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 11, color: t.muted }} />
          <Tooltip {...tip} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (display === 'line') {
    // Axes and lines must be DIRECT children — recharts does not look through fragments to find them.
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pivot ? pivot.rows : single} margin={{ top: 8, right: 16, bottom: 4, left: 8 }} onClick={pickable ? (e: { activeLabel?: string }) => e?.activeLabel && pick(e.activeLabel) : undefined}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" {...axis} tickLine={false} />
          <YAxis {...axis} tickLine={false} width={56} tickFormatter={fmt} />
          <Tooltip {...tip} />
          {pivot && <Legend wrapperStyle={{ fontSize: 11, color: t.muted }} />}
          {pivot
            ? pivot.series.map((s, i) => <Line key={s} type="monotone" dataKey={s} stroke={t.palette[i % t.palette.length]} strokeWidth={2} dot={false} />)
            : <Line type="monotone" dataKey="value" stroke={t.palette[0]} strokeWidth={2.5} dot={false} />}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // bar (vertical) or row (horizontal) — axes rendered as direct children, props switched on orientation
  const horizontal = display === 'row'
  const rotate = !horizontal && single.length > 6
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={single} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={t.grid} strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
        <XAxis
          type={horizontal ? 'number' : 'category'}
          dataKey={horizontal ? undefined : 'name'}
          tickFormatter={horizontal ? fmt : undefined}
          interval={horizontal ? undefined : 0}
          angle={rotate ? -30 : 0}
          textAnchor={rotate ? 'end' : 'middle'}
          height={rotate ? 56 : 24}
          {...axis}
          tickLine={false}
        />
        <YAxis
          type={horizontal ? 'category' : 'number'}
          dataKey={horizontal ? 'name' : undefined}
          tickFormatter={horizontal ? undefined : fmt}
          width={horizontal ? 120 : 56}
          {...axis}
          tickLine={false}
        />
        <Tooltip {...tip} cursor={{ fill: t.grid, opacity: 0.3 }} />
        <Bar dataKey="value" radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={48} onClick={pickable ? (d: { name?: string }) => pick(d?.name) : undefined} cursor={pickable ? 'pointer' : undefined}>
          {single.map((_, i) => (
            <Cell key={i} fill={t.palette[i % t.palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
