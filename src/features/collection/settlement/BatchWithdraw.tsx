import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { formatMoneyOfUnknownCurrency } from '@/core/money'
import type { SettlementBulkCancelResult, SettlementBulkCancelRow } from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { branchSearch } from './addresses'
import { settlementApi } from './api'
import { REASON_MAX } from './posting'
import ReasonField from './ReasonField'

/**
 * **Cancel as a unit** — a posted batch withdrawn in one act (ticket 273, spec 267
 * D7), reached at `/collection/settlement/upload?batch=<id>` (283 — until then it was
 * `?view=batch&batch=<id>`, and those addresses still redirect here).
 *
 * 🔑 **274 replaced the loop with the door that was always meant to do this.** 273
 * built this screen as N round trips from the browser: fetch the cross-estate ledger
 * filtered to the batch, decide per row which entries were still cancellable, call
 * `Settlement/Cancel` on each, and assemble the partial-failure report here.
 * `Settlement/Bulk/Cancel` (BackOffice ticket 1186) is that loop, server-side, in one
 * request — and 274 found that the ledger door the old path stood on **does not
 * exist**, so it had never worked against a real server and could not have.
 *
 * ⚠️ **What went with it: the preview.** There is no listing of the batch before the
 * act, because nothing enumerates a batch's entries — a batch spans branches by
 * construction, so no single account holds it, and the ledger that could is §B1's
 * ask. The act is therefore named rather than previewed: *withdraw everything this
 * batch posted*, with the outcome reported per row afterwards. The reason field is
 * what makes that deliberate rather than a button press.
 *
 * The rulings 273 encoded all survive, one layer down where the money is:
 *
 * - 🔑 **What a till already consumed is reported by name.** The door answers a row
 *   per entry with its own `accepted`, the server's `refusalReason` and the **true
 *   remaining** — which is exactly *"which rows a till already consumed and therefore
 *   could not be cancelled"*. A withdrawal that reported one number would hide the
 *   four rows the accountant actually has to chase.
 * - 🚩 **A partly-withdrawn batch is not a failure and nothing rolls back.**
 * - ⚠️ **The remainder of a partly consumed entry is NOT written off here.** The
 *   write-off is a separate act with a separate reason, and forgiving one because it
 *   shares a batch with forty other rows is not what *"finance sent the wrong file"*
 *   asks for. Each such row links to its own entry, where 272's panel offers it.
 */
export default function BatchWithdraw({ batchId }: { batchId: string }) {
  const { t } = useTranslation('settlement')
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<SettlementBulkCancelResult | null>(null)

  const withdraw = useMutation({
    mutationFn: () => settlementApi.bulkCancel(batchId, reason.trim()),
    onSuccess: (result) => {
      setOutcome(result)
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'account'] })
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'fleet'] })
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'orphans'] })
    },
    // 🚩 A refused ROW is not an error — it arrives inside a 200 and is reported
    // below by name. `onError` is only for the call itself failing, which leaves the
    // whole batch's state unknown rather than decided.
  })

  const ready = reason.trim().length > 0 && !withdraw.isPending

  return (
    <section className="flex flex-col gap-4" data-region="batch-withdraw" data-batch={batchId}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t('batch.title')}</h2>
        <p className="font-mono text-xs text-muted-foreground">{batchId}</p>
      </header>

      {withdraw.isError && (
        <ErrorBanner
          message={apiErrorMessage(withdraw.error, t('batch.errors.withdrawFailed'))}
          className="p-3"
        />
      )}

      {outcome ? (
        <Outcome outcome={outcome} params={searchParams} />
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
          <p className="text-sm">{t('batch.act.wholeBatch')}</p>
          {/* ⚠️ Said before the act, not discovered after it: what a till has taken
              is not withdrawn by this, and a partly consumed entry keeps its
              remainder until someone writes it off on its own account. */}
          <p className="text-xs text-muted-foreground">{t('batch.act.notRetroVoided')}</p>
          <ReasonField
            value={reason}
            onValue={setReason}
            label={t('batch.act.reasonLabel')}
            hint={t('batch.act.reasonHint', { max: REASON_MAX })}
            testId="batch-reason"
          />
          <Button
            variant="primary"
            className="w-fit"
            onClick={() => ready && withdraw.mutate()}
            aria-disabled={!ready || undefined}
            data-testid="batch-commit"
          >
            {withdraw.isPending ? t('batch.act.working') : t('batch.act.commitAll')}
          </Button>
        </div>
      )}
    </section>
  )
}

/** What the act actually did — the server's own tally, then the rows behind it. */
function Outcome({
  outcome,
  params,
}: {
  outcome: SettlementBulkCancelResult
  params: URLSearchParams
}) {
  const { t } = useTranslation('settlement')

  const refused = (outcome.rows ?? []).filter((r) => !r.accepted)
  const withdrawn = (outcome.rows ?? []).filter((r) => r.accepted)

  return (
    <div className="flex flex-col gap-3" data-region="batch-outcome">
      <p className="text-sm font-medium" data-testid="batch-outcome-summary">
        {t('batch.outcome.summary', { count: outcome.cancelled, total: outcome.total })}
      </p>

      {/* 🔑 The ticket's own requirement: the rows a till already consumed, NAMED,
          with the server's words and the remaining it came back with. */}
      {refused.length > 0 && (
        <Group
          testId="batch-refused"
          tone="attention"
          title={t('batch.outcome.refused', { count: refused.length })}
        >
          {refused.map((row) => (
            <Row
              key={row.settlementEntryId}
              row={row}
              params={params}
              // ⚠️ One key, one sentence — never two joined with a `+` and a space.
              // The server's words are data riding on a named param; a sentence
              // assembled at the call site cannot be re-ordered by a translator.
              note={t(
                row.refusalReason ? 'batch.outcome.refusedRow' : 'batch.outcome.refusedRowUnstated',
                {
                  remaining: formatMoneyOfUnknownCurrency(row.remainingAmount),
                  reason: row.refusalReason,
                },
              )}
            />
          ))}
        </Group>
      )}

      {withdrawn.length > 0 && (
        <Group testId="batch-withdrawn" title={t('batch.outcome.withdrawn', { count: withdrawn.length })}>
          {withdrawn.map((row) => (
            <Row key={row.settlementEntryId} row={row} params={params} />
          ))}
        </Group>
      )}
    </div>
  )
}

function Group({
  testId,
  title,
  tone = 'quiet',
  children,
}: {
  testId: string
  title: string
  tone?: 'attention' | 'quiet'
  children: React.ReactNode
}) {
  return (
    <section
      data-testid={testId}
      className={`rounded-lg border ${
        tone === 'attention'
          ? 'border-attention-border bg-attention-050'
          : 'border-border/60 bg-card/40'
      }`}
    >
      <header
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold ${
          tone === 'attention' ? 'text-attention-800' : ''
        }`}
      >
        {tone === 'attention' && <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
        {title}
      </header>
      <ul className="divide-y divide-border/40 border-t border-border/40">{children}</ul>
    </section>
  )
}

/**
 * One entry of the batch — and a way to its own account, which is where a write-off
 * lives (272).
 *
 * ⚠️ **The branch shows as a code, not a name.** The cancel door answers `storeId`
 * and no `storeName`; resolving one would need a read this screen has no door for.
 * The link still lands on the account, which is headed by the branch's full name.
 */
function Row({
  row,
  params,
  note,
}: {
  row: SettlementBulkCancelRow
  params: URLSearchParams
  note?: string
}) {
  const { t } = useTranslation('settlement')

  return (
    <li
      data-entry={row.entryNumber}
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
    >
      <Link
        to={branchSearch(params, row.storeId, row.entryNumber)}
        className="flex items-baseline gap-2 hover:underline"
      >
        <span className="font-mono text-[12px] text-muted-foreground">{row.storeId}</span>
      </Link>
      <span className="text-xs text-muted-foreground">
        {t('batch.row.entry', { number: row.entryNumber })}
      </span>
      <span className="tabular-nums">{formatMoneyOfUnknownCurrency(row.amount)}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </li>
  )
}
