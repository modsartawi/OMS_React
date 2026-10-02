import type { SimulationResultItem } from '@/core/models/simulation'
import Ltr from '@/core/ui/Ltr'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import { KIND_CHIP } from './promo-kind'
import { tickStep, type LineWaterfall, type WfStep } from './waterfall'

/* PROTOTYPE 372 — throwaway. Copy is literal (prototype), not t().
 *
 * The waterfall is a LEDGER TABLE whose bars are decoration: every figure the bars
 * draw is also a cell a screen reader reads in order (`aria-hidden` on the track),
 * so "the chart needs its own accessibility text" (Far's risk) is answered by
 * construction — there is no chart to describe, only a table with a picture beside
 * each row. Bars sit on `inset-inline-start`, so the axis runs with the text and
 * mirrors in RTL.
 *
 * Hue: one spend only — a promotion that moved the price is `success`, the screen's
 * existing "fired" hue (100's budget). Base, net, tax and total are neutrals; a
 * manual condition is neutral and hatched; a not-footing gap is `attention`.
 */

interface Props {
  item: SimulationResultItem
  wf: LineWaterfall
  /** The figure the axis runs to — this line's own peak, or the basket's. */
  scalePeak: number
  currency: string
  /** conditionKey → the get lines of that application (a buy row names them). */
  partners?: Map<string, number[]>
}

const LABEL: Partial<Record<WfStep['kind'], string>> = {
  net: 'Net',
  total: 'Net total',
  gap: 'Not in the conditions',
}

const BAR: Record<WfStep['kind'], string> = {
  base: 'bg-muted-foreground/60',
  price: 'bg-muted-foreground/40',
  promo: 'bg-success',
  buy: '',
  manual: 'bg-[repeating-linear-gradient(135deg,var(--color-ink-3)_0_3px,transparent_3px_6px)] ring-1 ring-inset ring-ink-3',
  net: 'bg-muted-foreground/60',
  tax: 'bg-border-strong',
  total: 'bg-foreground/85',
  gap: 'bg-attention',
  stat: '',
}

export default function SimWaterfall({ item, wf, scalePeak, currency, partners }: Props) {
  const peak = Math.max(scalePeak, wf.peak, 0.01)
  const step = tickStep(peak)
  const ticks: number[] = []
  for (let v = 0; v <= peak + 1e-9; v += step) ticks.push(v)
  const pct = (v: number) => `${((v / peak) * 100).toFixed(3)}%`

  return (
    <table data-waterfall className="w-full table-fixed border-collapse text-[12px]">
      <caption className="sr-only">{`How line ${item.itemNumber}'s price was built`}</caption>
      <colgroup>
        <col className="w-[44%]" />
        <col />
        <col className="w-[92px]" />
      </colgroup>
      <tbody>
        {wf.steps.map((s, i) => {
          const fromZero = s.kind === 'base' || s.kind === 'net' || s.kind === 'total'
          const subtotal = s.kind === 'net' || s.kind === 'total'
          const drawn = s.kind !== 'stat' && s.kind !== 'buy'
          const lo = Math.min(s.from, s.to)
          const w = Math.abs(s.to - s.from)
          return (
            <tr
              key={i}
              data-wf-step={s.kind}
              className={`h-[26px] ${subtotal ? 'border-t border-border' : ''} ${s.kind === 'total' ? 'font-semibold' : ''}`}
            >
              <td className="min-w-0 pe-2">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  {s.code ? (
                    <span className="w-[38px] shrink-0 font-mono text-[11px] text-ink-3">{s.code}</span>
                  ) : (
                    <span className="w-[38px] shrink-0" aria-hidden />
                  )}
                  <span className={`truncate ${s.kind === 'stat' || s.kind === 'buy' ? 'text-muted-foreground' : ''}`}>
                    {LABEL[s.kind] ?? <Ltr>{s.description}</Ltr>}
                  </span>
                  {s.count > 1 ? <Chip>{`×${s.count}`}</Chip> : null}
                  {s.kind === 'manual' ? <Chip>MANUAL</Chip> : null}
                  {s.kind === 'stat' ? <Chip>STAT</Chip> : null}
                  <span className="truncate text-[11px] text-ink-3">{secondary(s, item)}</span>
                </div>
              </td>
              <td className="px-1" aria-hidden>
                <div className="relative h-[26px]">
                  {ticks.map((v) => (
                    <span key={v} className="absolute inset-y-0 w-px bg-divider" style={{ insetInlineStart: pct(v) }} />
                  ))}
                  {drawn ? (
                    <span
                      className={`absolute top-1/2 h-[10px] -translate-y-1/2 rounded-[2px] ${BAR[s.kind]}`}
                      style={{ insetInlineStart: pct(lo), width: w > 0 ? `max(1px, ${pct(w)})` : '1px' }}
                    />
                  ) : null}
                  {/* the running figure a delta step leaves behind — a hairline the next step starts from */}
                  {!fromZero && drawn ? (
                    <span className="absolute inset-y-[5px] w-px bg-foreground/50" style={{ insetInlineStart: pct(s.to) }} />
                  ) : null}
                </div>
              </td>
              <td className={`ps-2 text-end tabular-nums ${s.kind === 'stat' || s.kind === 'buy' ? 'text-muted-foreground' : ''}`}>
                {amount(s, partners)}
                {s.kind === 'total' ? <span className="ms-1 text-[10px] font-medium text-muted-foreground">{currency}</span> : null}
              </td>
            </tr>
          )
        })}
        <tr aria-hidden className="h-[18px]">
          <td />
          <td className="px-1">
            <div className="relative h-[18px] text-[10px] text-ink-3">
              {ticks.map((v) => (
                <span key={v} className="absolute top-0 -translate-x-1/2 rtl:translate-x-1/2 tabular-nums" style={{ insetInlineStart: pct(v) }}>
                  {formatNumber(v)}
                </span>
              ))}
            </div>
          </td>
          <td className="ps-2 text-end text-[10px] text-ink-3">{currency}</td>
        </tr>
      </tbody>
    </table>
  )
}

function Chip({ children }: { children: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-[4px] px-1 text-[10px] font-bold tracking-wider ${KIND_CHIP}`}>
      {children}
    </span>
  )
}

/** The "of what": `2 × 91.26` for the base, `−35% of 91.26` for a percentage, the
 *  rate for a fixed amount. Blank for derived steps. */
function secondary(s: WfStep, item: SimulationResultItem): string {
  if (s.rate == null) return ''
  if (s.kind === 'base') return `${formatNumber(item.quantity)} × ${formatMoney(s.rate)}`
  const each = s.count > 0 && s.base != null ? s.base / s.count : null
  if (s.rateUnit === '%') return each != null ? `${formatNumber(s.rate)}% of ${formatMoney(each)}` : `${formatNumber(s.rate)}%`
  if (s.kind === 'tax') return `${formatNumber(s.rate)}%`
  return ''
}

function amount(s: WfStep, partners?: Map<string, number[]>): string {
  if (s.kind === 'buy') {
    const lines = s.conditionKey ? partners?.get(s.conditionKey) : undefined
    return lines && lines.length ? `→ line ${lines.join(' · ')}` : 'qualifies'
  }
  if (s.kind === 'base' || s.kind === 'net' || s.kind === 'total') return formatMoney(s.to)
  const v = s.amount
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${formatMoney(Math.abs(v))}`
}
