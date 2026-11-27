import { useMemo } from 'react'
import ScatterChart, { ScatterMark, type ScatterPoint, type ScatterShape } from '@/core/charts/ScatterChart'
import { CHART_INK } from '@/core/charts/slots'
import type { AdviseReply } from '@/core/models/sourcing-run'
import { fsi, formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import NotFull from './NotFull'
import { clock, tradeOffPoints } from './tried-model'
import { usePlanWords } from './use-plan-words'

const SHAPES: readonly ScatterShape[] = ['circle', 'square', 'triangle', 'diamond']

/**
 * The trade-off (ticket 966, spec 4354 §19; SIMT "how it is drawn": a recharts scatter): every plan the search kept, at
 * the minutes until the whole order has arrived and at its fee with the company's cost, shaped by its deliveries, the
 * plans shown marked and named. Its tooltip gives the fee and the company's cost as sent; no total is printed.
 */
export default function TradeOffChart({ reply }: { reply: AdviseReply }) {
  const w = usePlanWords()
  const { t } = w
  const points = useMemo(() => tradeOffPoints(reply), [reply])
  const scatter = useMemo<ScatterPoint[]>(
    () =>
      points.map((p) => ({
        id: p.id,
        x: p.minutes,
        y: p.money,
        shape: p.shape,
        marked: p.shown.length > 0,
        label: p.shown.length ? w.goal(p.shown[0]) : undefined,
        tip: [
          p.shipments.map((s) => formatPair(s.store, w.mode(s.mode))).join(', '),
          t('solver.trade.tipBy', { time: fsi(clock(p.promiseBy)) }),
          t('solver.trade.tipFee', { amount: w.money(p.fee) }),
          t('solver.trade.tipCost', { amount: w.money(p.companyCost) }),
          t('solver.trade.tipDeliveries', { count: fsi(formatFigure(p.deliveries)) }),
        ],
      })),
    [points, w, t],
  )
  if (!reply.search) return <NotFull />
  if (!points.length)
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-solver-trade-none="">
        {t('solver.trade.none')}
      </p>
    )

  return (
    <div className="flex flex-col gap-2" data-solver-trade={points.length}>
      <ScatterChart
        points={scatter}
        xLabel={t('solver.trade.x')}
        yLabel={t('solver.trade.y')}
        formatX={(v) => t('solver.trade.minutes', { count: formatFigure(v) })}
        formatY={(v) => formatFigure(v)}
        ariaLabel={t('solver.trade.aria')}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-solver-trade-legend="">
        {SHAPES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <ScatterMark shape={s} cx={7} cy={7} r={4} fill={CHART_INK.other} />
            </svg>
            {t(`solver.trade.shape.${s}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <ScatterMark shape="circle" cx={7} cy={7} r={5} fill="var(--primary)" />
          </svg>
          {t('solver.trade.shownMark')}
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">{t('solver.trade.hint')}</p>
    </div>
  )
}
