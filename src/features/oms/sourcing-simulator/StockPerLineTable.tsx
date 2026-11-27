import { useMemo, useState } from 'react'
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi, formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import NotFull from './NotFull'
import { stockPerLine } from './stock-per-line-model'
import { usePlanWords } from './use-plan-words'

/** A figure column's head: it may wrap, so the working's ten columns fit a card. */
const NUM_HEAD = 'px-2 py-1.5 align-bottom text-end font-medium'

const less = (n: number) => (n > 0 ? `−${formatFigure(n)}` : '0')

/**
 * The stock per line (ticket 966, spec 4354 §5): pick a cart line; every store the run read shows on hand, less what
 * orders and deliveries hold, the figure after open demand, times the confidence, less the buffer, the offered stock —
 * against the quantity needed — and the expected stock at pick time beside it, shown only. The store the selected
 * plan sends the line from is marked. Every figure is the record's, as sent.
 */
export default function StockPerLineTable({ reply, plan }: { reply: AdviseReply; plan: AdvisePlan | undefined }) {
  const w = usePlanWords()
  const { t } = w
  const [lineNo, setLineNo] = useState<number>(reply.lines[0]?.lineNo ?? 0)
  const stock = useMemo(() => stockPerLine(reply, lineNo, plan), [reply, lineNo, plan])
  if (!stock) return <NotFull />
  const { line } = stock

  return (
    <div className="flex flex-col gap-3" data-solver-stock={line.lineNo}>
      <div role="group" aria-label={t('solver.stock.lineLabel')} className="flex flex-wrap gap-1">
        {stock.lines.map((l) => (
          <Chip key={l.lineNo} on={l.lineNo === line.lineNo} onClick={() => setLineNo(l.lineNo)} data-solver-line-pick={l.lineNo}>
            {t('solver.stock.linePick', { lineNo: fsi(l.lineNo), quantity: fsi(formatFigure(l.quantity)), item: fsi(l.item) })}
          </Chip>
        ))}
      </div>
      {stock.rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-solver-stock-none="">
          {t('solver.stock.none')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-strong text-muted-foreground">
              <tr>
                <th className={TH}>{t('solver.stock.store')}</th>
                <th className={NUM_HEAD}>{t('solver.stock.onHand')}</th>
                <th className={NUM_HEAD}>{t('solver.stock.heldByOrders')}</th>
                <th className={NUM_HEAD}>{t('solver.stock.heldByDeliveries')}</th>
                <th className={NUM_HEAD}>{t('solver.stock.afterDemand')}</th>
                <th className={NUM_HEAD}>{t('solver.stock.confidence')}</th>
                <th className={NUM_HEAD}>{t('solver.stock.buffer')}</th>
                <th className={NUM_HEAD}>{t('solver.stock.offered')}</th>
                <th className={TH}>{t('solver.stock.needs', { quantity: fsi(formatFigure(line.quantity)) })}</th>
                <th className={NUM_HEAD}>{t('solver.stock.expected')}</th>
              </tr>
            </thead>
            <tbody>
              {stock.rows.map((r) => (
                <tr key={r.store} className={`border-b border-border/60 ${r.chosen ? 'bg-primary-050' : ''}`} data-solver-stock-row={r.store} data-solver-stock-chosen={r.chosen ? 'true' : undefined}>
                  <td className={TD}>
                    <span className="font-mono">
                      <Ltr>{r.storeName ? formatPair(r.store, r.storeName) : r.store}</Ltr>
                    </span>
                    {r.chosen && <span className="ms-2 rounded-full border border-primary-border px-1.5 py-px text-[11px]">{t('solver.stock.chosen')}</span>}
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-solver-stock-cell="onHand">
                    <Ltr>{formatFigure(r.onHand)}</Ltr>
                    <div className="text-[11px] text-muted-foreground">{t('solver.stock.sap', { count: fsi(formatFigure(r.sapStock)) })}</div>
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-solver-stock-cell="heldByOrders">
                    <Ltr>{less(r.heldByOrders)}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-solver-stock-cell="heldByDeliveries">
                    <Ltr>{less(r.heldByDeliveries)}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-solver-stock-cell="afterDemand">
                    <Ltr>{formatFigure(r.afterDemand)}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-solver-stock-cell="confidence">
                    <Ltr>{`×${r.confidence.toFixed(2)}`}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-solver-stock-cell="buffer">
                    <Ltr>{less(r.buffer)}</Ltr>
                  </td>
                  <td className={`${TD} text-end font-semibold tabular-nums`} data-solver-stock-cell="offered">
                    <Ltr>{formatFigure(r.offered)}</Ltr>
                  </td>
                  <td className={TD} data-solver-stock-cell="serves">
                    {r.covers ? (
                      <span className="rounded-full border border-border px-1.5 py-px text-[11px]">{t('solver.stock.canServe')}</span>
                    ) : (
                      <span className="rounded-full border border-attention-border bg-attention-050 px-1.5 py-px text-[11px] text-attention-800">
                        {t('solver.stock.shortBy', { count: fsi(formatFigure(r.shortBy)) })}
                      </span>
                    )}
                  </td>
                  <td className={`${TD} text-end tabular-nums text-muted-foreground`} data-solver-stock-cell="expected">
                    <Ltr>{formatFigure(r.expected)}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('solver.stock.hint')}</p>
    </div>
  )
}
