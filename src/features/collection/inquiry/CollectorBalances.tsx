import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'

import type { DepositCollectorBalance } from '@/core/models/collection'
import { formatMoneyIn } from '@/core/money'

/**
 * The per-collector outstanding balances, in a collapsible panel labelled
 * **POSTED only** (ticket 256).
 *
 * 🚩 **The label is not decoration.** `Outstanding` is Σ(calculated − real) over
 * **POSTED** deposits; VOID ones are excluded because they never moved money. A
 * balance table that silently dropped a row class would read as wrong rather than
 * as scoped, and an accountant reconciling against it would chase the difference.
 * So the scope is on the panel's face, beside its title.
 *
 * 🚩 **It costs no fetch.** `balances` arrives in the same `{ rows, balances }`
 * response as the grid — that is what the response shape is *for* — so opening
 * the panel is a re-render and never a request.
 *
 * ⚠️ Collapsible, and **open on arrival**: it is a summary of the same result the
 * grid is showing, and a supervisor who has to discover it is a supervisor who
 * reconciles without it. The collapse is there to reclaim the height on a long
 * result, which is the same bargain the filter-row toggle strikes.
 */
export default function CollectorBalances({
  balances,
}: {
  balances: readonly DepositCollectorBalance[]
}) {
  const { t } = useTranslation('collection')
  const [open, setOpen] = useState(true)

  return (
    <section className="rounded-lg border border-border/60 bg-card/40">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 p-3 text-start text-sm font-semibold tracking-tight"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
          {t('deposits.balances.title')}
          {/* The scope, on the panel's face rather than in a tooltip. */}
          <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t('deposits.balances.postedOnly')}
          </span>
        </button>
      </h2>

      {open &&
        (balances.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-muted-foreground">{t('deposits.balances.empty')}</p>
        ) : (
          <div className="px-3 pb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs font-medium text-muted-foreground">
                  <th scope="col" className="py-1.5 text-start">
                    {t('deposits.balances.columns.collectorName')}
                  </th>
                  <th scope="col" className="py-1.5 text-end">
                    {t('deposits.balances.columns.depositCount')}
                  </th>
                  <th scope="col" className="py-1.5 text-end">
                    {t('deposits.balances.columns.totalCalculated')}
                  </th>
                  <th scope="col" className="py-1.5 text-end">
                    {t('deposits.balances.columns.totalReal')}
                  </th>
                  <th scope="col" className="py-1.5 text-end">
                    {t('deposits.balances.columns.outstanding')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {balances.map((balance) => (
                  <tr
                    key={balance.collectorOperatorId}
                    className="border-b border-border/40 last:border-b-0"
                  >
                    <th scope="row" className="py-1.5 text-start font-normal">
                      {balance.collectorName}
                    </th>
                    <td className="py-1.5 text-end tabular-nums">{balance.depositCount}</td>
                    <td className="py-1.5 text-end tabular-nums">
                      {formatMoneyIn(balance.totalCalculated, undefined)}
                    </td>
                    <td className="py-1.5 text-end tabular-nums">
                      {formatMoneyIn(balance.totalReal, undefined)}
                    </td>
                    {/* ⚠️ The sign is the row's own and stays that way. Positive
                        means the collector still owes the bank a trip; negative
                        means last trip's shortfall has since landed. Flipping
                        either would rewrite what finance is reading. */}
                    <td className="py-1.5 text-end font-medium tabular-nums">
                      {formatMoneyIn(balance.outstanding, undefined)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  )
}
