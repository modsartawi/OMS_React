import type { AdvisePlan } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatPair } from '@/core/util/bidi'
import { moneyRows, type MoneyCell, type MoneyRow } from './money-rows-model'
import SourcePill from './SourcePill'
import { usePlanWords } from './use-plan-words'

/** A money row's label key: the plan's own rows by name, a cost part by its code. */
const rowKey = (r: MoneyRow) => (r.kind === 'part' ? `why.part.${r.key}` : `why.money.row.${r.key}`)

/**
 * The money (ticket 965, spec 4354 §6): a row per part, a column per shipment and one for the plan, every figure as
 * sent with its source, and a banner naming the figures that stand on an assumption. The plan column holds only the
 * totals the server sent (4281 decision 28).
 */
export default function MoneyTable({ plan }: { plan: AdvisePlan }) {
  const w = usePlanWords()
  const { t } = w
  const money = moneyRows(plan)
  const cell = (c: MoneyCell | null, strong: boolean) =>
    c ? (
      <span className="inline-flex flex-wrap items-center justify-end gap-1">
        <span className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>
          <Ltr>{w.money(c.amount)}</Ltr>
        </span>
        <SourcePill source={c.source} />
      </span>
    ) : null
  return (
    <div className="flex flex-col gap-2" data-why-money="">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className={TH}>{t('why.money.inRiyals')}</th>
              {money.columns.map((c) => (
                <th key={c.no} className={`${TH} text-end`} data-why-money-column={c.no}>
                  <Ltr>{formatPair(c.no, c.store)}</Ltr>
                </th>
              ))}
              <th className={`${TH} text-end`}>{t('why.money.plan')}</th>
            </tr>
          </thead>
          <tbody>
            {money.rows.map((r) => {
              const strong = r.kind === 'companyCost' || r.key === 'balanced'
              return (
                <tr key={r.key} className="border-b border-border/60 last:border-b-0" data-why-money-row={r.key}>
                  <td className={`${TD} ${strong ? 'font-semibold' : ''}`}>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      {t(rowKey(r), { defaultValue: r.key })}
                      {r.kind === 'fee' && <span className="rounded-full border border-border px-1.5 py-px text-[11px] font-normal text-muted-foreground">{t('why.money.listFee')}</span>}
                    </span>
                  </td>
                  {r.cells.map((c, i) => (
                    <td key={money.columns[i].no} className={`${TD} text-end`} data-why-money-cell={`${r.key}:${money.columns[i].no}`}>
                      {cell(c, strong)}
                    </td>
                  ))}
                  <td className={`${TD} text-end`} data-why-money-cell={`${r.key}:plan`}>
                    {cell(r.plan, strong)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {money.assumed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-why-assumed="">
          <span className="font-semibold">{t('why.money.assumed')}</span>
          {money.assumed.map((k) => (
            <span key={k} className="rounded-full border border-attention-border px-1.5 py-px" data-why-assumed-row={k}>
              {k === 'fee' ? t('why.money.row.fee') : t(`why.part.${k}`, { defaultValue: k })}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
