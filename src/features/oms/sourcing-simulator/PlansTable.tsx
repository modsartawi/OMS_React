import type { AdvisePlan } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { plansTable, type PlanCell } from './plans-table-model'
import PlanHead from './PlanHead'
import { usePlanWords } from './use-plan-words'

/**
 * The plans as one table (ticket 962, SIMT decision 1): a row per measure, a column per plan. A plain table, not a
 * grid: seven rows and at most five columns, read across.
 */
/** A promise sentence wraps; every figure stays on one line (`TD`). */
const WRAP_TD = 'min-w-48 px-2 py-1.5 align-top'

export default function PlansTable({ plans }: { plans: readonly AdvisePlan[] }) {
  const w = usePlanWords()
  const table = plansTable({ plans: [...plans] })
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card" data-plans-table="">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={`${TH} w-40`} scope="col" />
            {table.columns.map((c) => (
              <th key={c.goal} className={TH} scope="col" data-plans-column={c.goal}>
                <PlanHead column={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.measure} data-plans-row={r.measure}>
              <th className={`${TH} text-start font-medium`} scope="row">
                {w.t(`measure.${r.measure}`)}
              </th>
              {r.cells.map((cell, i) => (
                <td key={table.columns[i].goal} className={r.measure === 'promise' ? WRAP_TD : TD} data-plans-cell={`${r.measure}:${table.columns[i].goal}`}>
                  <Cell cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cell({ cell }: { cell: PlanCell }) {
  const w = usePlanWords()
  switch (cell.kind) {
    case 'text':
      return <bdi>{w.said(cell.text)}</bdi>
    case 'count':
      return <Ltr>{formatFigure(cell.value)}</Ltr>
    case 'shipments':
      return (
        <ul className="flex flex-col gap-0.5">
          {cell.shipments.map((s) => (
            <li key={s.no} className="flex flex-wrap gap-x-1.5">
              <span className="font-mono">
                <Ltr>{formatPair(s.store, s.storeName)}</Ltr>
              </span>
              <span className="text-muted-foreground">{w.mode(s.mode)}</span>
            </li>
          ))}
        </ul>
      )
    case 'money':
      return (
        <div className="flex flex-col tabular-nums">
          <span className="font-medium">
            <Ltr>{w.money(cell.value)}</Ltr>
          </span>
          {cell.perShipment && cell.perShipment.length > 1 && (
            <span className="text-muted-foreground">
              {cell.perShipment.map((v, i) => (
                <span key={i} className="me-1.5 inline-block">
                  <Ltr>{w.money(v)}</Ltr>
                </span>
              ))}
              {w.t('card.perShipment')}
            </span>
          )}
        </div>
      )
  }
}
