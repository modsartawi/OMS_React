import { useTranslation } from 'react-i18next'
import { ExternalLink, TriangleAlert } from 'lucide-react'

import type { DepositInquiryRow } from '@/core/models/collection'
import { formatMoneyIn } from '@/core/money'
import { lineHasDrift } from './deposit-drift'

/**
 * The selected deposit's claimed-ACR lines and its slips, **stacked in place
 * beneath the grid** (ticket 256).
 *
 * ⚠️ **A detail modal was considered and rejected.** A deposit whose banked total
 * no longer matches its claimed ACRs is precisely what the accountant opens this
 * screen to find, and drift behind a click is drift taken on faith. So the region
 * follows the selected row rather than opening over it.
 *
 * 🚩 **It costs no fetch.** `lines` and `attachments` ride on the row itself —
 * `CollectionWeb/Deposits` answers `{ rows, balances }` with the whole tree
 * attached — so selecting a different deposit is a re-render and never a request.
 * That is the shape's entire purpose; a second call here would undo it.
 *
 * Slips are **ordinary links opening in a new tab**, which is all the WPF's
 * `Open Slip(s)` ever did: the mobile backend hosts the files and SIS.Api never
 * takes or serves bytes, so there is no viewer to build.
 */
export default function DepositDetail({ deposit }: { deposit: DepositInquiryRow | null }) {
  const { t } = useTranslation('collection')

  if (!deposit) {
    // The grid really does select its first row on arrival, so this is what an
    // empty result — or a CTRL-click that deselected — leaves behind: a sentence
    // rather than a bare heading over nothing.
    return (
      <section
        data-region="deposit-detail"
        className="rounded-lg border border-border/60 bg-card/40 p-4"
        aria-live="polite"
      >
        <h2 className="text-sm font-semibold tracking-tight">{t('deposits.detail.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('deposits.detail.none')}</p>
      </section>
    )
  }

  const lines = deposit.lines ?? []
  const attachments = deposit.attachments ?? []

  return (
    <section
      data-region="deposit-detail"
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
      aria-live="polite"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('deposits.detail.title')}</h2>
        {/* Which deposit this region is following, said out loud: the region moves
            with the selection, so a heading that never named a deposit would leave
            the reader guessing which row they clicked. */}
        <span className="font-mono text-[12px] text-muted-foreground">
          {t('deposits.detail.forDeposit', {
            number: deposit.depositNumber,
            collector: deposit.collectorName,
          })}
        </span>
      </header>

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('deposits.detail.linesTitle')}
        </h3>
        {lines.length === 0 ? (
          // Not an error: the exchanged-foreign-currency follow-up banks real cash
          // against no ACR at all, and that is a legitimate deposit.
          <p className="mt-1 text-sm text-muted-foreground">{t('deposits.detail.noLines')}</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs font-medium text-muted-foreground">
                <th scope="col" className="py-1.5 text-start">
                  {t('deposits.detail.lineColumns.acrNumber')}
                </th>
                <th scope="col" className="py-1.5 text-end">
                  {t('deposits.detail.lineColumns.netCollectedAtDeposit')}
                </th>
                <th scope="col" className="py-1.5 text-end">
                  {t('deposits.detail.lineColumns.netCollectedNow')}
                </th>
                <th scope="col" className="py-1.5 text-end">
                  {t('deposits.detail.lineColumns.drift')}
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const drifted = lineHasDrift(line)
                return (
                  <tr
                    key={line.acrId}
                    data-drift={drifted ? 'true' : 'false'}
                    className={`border-b border-border/40 last:border-b-0 ${
                      drifted ? 'bg-attention-050' : ''
                    }`}
                  >
                    <th scope="row" className="py-1.5 text-start font-mono text-[12px] font-normal">
                      {line.acrNumber}
                    </th>
                    <td className="py-1.5 text-end tabular-nums">
                      {formatMoneyIn(line.netCollectedAtDeposit, undefined)}
                    </td>
                    <td className="py-1.5 text-end tabular-nums">
                      {formatMoneyIn(line.netCollectedNow, undefined)}
                    </td>
                    <td className="py-1.5 text-end tabular-nums">
                      {drifted ? (
                        // 🚩 The flag, and the whole reason this region is not a
                        // modal. The figure is the server's own `drift` — nothing
                        // here subtracts the two amounts beside it; see
                        // `deposit-drift.ts` for why that matters.
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-attention-border px-2 py-0.5 text-xs font-medium text-attention-800"
                          title={t('deposits.detail.driftedHint')}
                        >
                          <TriangleAlert className="h-3 w-3" aria-hidden />
                          {/* ⚠️ One key taking the amount as a named param, not a
                              label glued to a figure: the sentence a screen
                              reader hears is a sentence, and a locale that
                              orders it differently can. */}
                          <span className="sr-only">
                            {t('deposits.detail.driftedBy', {
                              amount: formatMoneyIn(line.drift, undefined),
                            })}
                          </span>
                          <span aria-hidden>{formatMoneyIn(line.drift, undefined)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {t('deposits.detail.noDrift')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('deposits.detail.slipsTitle')}
        </h3>
        {attachments.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{t('deposits.detail.noSlips')}</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {attachments.map((slip) => (
              <li key={slip.attachmentId}>
                {/* ⚠️ `rel="noopener noreferrer"` alongside `target="_blank"`: the
                    slip is hosted by the mobile backend, so the tab it opens is
                    not ours and must not reach back through `window.opener`. */}
                <a
                  href={slip.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {slip.fileName || t('deposits.detail.unnamedSlip')}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
