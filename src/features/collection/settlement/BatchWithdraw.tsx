import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { TriangleAlert } from 'lucide-react'

import { apiErrorKind, apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import type { SettlementLedgerRow } from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { branchSearch } from './addresses'
import { AccountShimmer } from './AccountStates'
import { settlementApi } from './api'
import {
  planBatchWithdraw,
  summariseBatchWithdraw,
  type BatchAttempt,
  type BatchOutcome,
  type BatchPlan,
} from './bulk'
import { criteriaForBatch } from './ledger'
import { REASON_MAX } from './posting'
import ReasonField from './ReasonField'

/**
 * **Cancel as a unit** — a posted batch withdrawn in one act (ticket 273, spec 267
 * D7), reached at `?view=batch&batch=<id>`.
 *
 * 🔑 **It is a loop over 272's mechanism, and not a new one.** Each row is
 * `Settlement/Cancel`, the same call the entry's own correction panel makes, so a
 * batch is *a handle and a provenance fact, never a second lifecycle*. There is no
 * bulk-cancel door on the wire and this screen does not ask for one.
 *
 * 🔑 **What a till already consumed is reported by name.** A cancel that lost its
 * race comes back as a 200 with the true remaining (272's contract), which is
 * exactly *"which rows a till already consumed and therefore could not be
 * cancelled"* — and a batch withdrawal that reported one number would hide the four
 * rows the accountant actually has to chase.
 *
 * 🚩 **A partly-withdrawn batch is not a failure and nothing rolls back.** Putting
 * money back onto branches to make a report look tidy is not a repair.
 *
 * ⚠️ **The remainder of a partly consumed entry is NOT written off here.** The
 * write-off is a separate act with a separate reason, and forgiving one because it
 * shares a batch with forty other rows is not what *"finance sent the wrong file"*
 * asks for. Each such row links to its own entry, where 272's panel offers it.
 */
export default function BatchWithdraw({ batchId }: { batchId: string }) {
  const { t } = useTranslation('settlement')
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<BatchOutcome | null>(null)

  // 🚩 The batch's rows come off the **ledger** — the estate-wide lookup that
  // already answers *"find this entry, whichever branch it is on"*, asked one field
  // wider. A batch spans branches by construction, so no single account holds it.
  const criteria = useMemo(() => criteriaForBatch(batchId), [batchId])
  const batch = useQuery({
    queryKey: ['settlement', 'ledger', criteria],
    queryFn: () => settlementApi.ledger(criteria),
    enabled: !!batchId,
  })

  const rows = useMemo(() => batch.data ?? [], [batch.data])
  const plan = useMemo(() => planBatchWithdraw(rows), [rows])

  const withdraw = useMutation({
    mutationFn: async () => {
      const attempts: BatchAttempt[] = []
      // ⚠️ **Sequential, deliberately.** A month's audit is forty rows; forty
      // concurrent writes would open forty connections against a door whose every
      // call takes a guarded UPDATE, and the report reads in the file's own order
      // because the loop runs in it.
      for (const row of plan.cancellable) {
        try {
          const result = await settlementApi.cancel(row.settlementEntryId, reason.trim())
          attempts.push({ row, result })
        } catch (error) {
          // 🔑 **Two very different things arrive here, and they are kept apart.**
          // A *business* refusal is the envelope saying no, with the server's own
          // words — `api-envelope` forbids swallowing that into a generic sentence,
          // so it joins the refusals and is named. Anything else (a transport
          // fault, a 500) leaves that entry's state genuinely **unknown**, and
          // telling an accountant an entry survived when the request merely timed
          // out would be a lie about money.
          //
          // Either way the loop continues: the other thirty-nine rows are not held
          // hostage by one.
          if (apiErrorKind(error) === 'business')
            attempts.push({
              row,
              result: null,
              refusedBecause: apiErrorMessage(error, t('batch.outcome.refusedUnstated')),
            })
          else attempts.push({ row, result: null, failed: true })
        }
      }
      return summariseBatchWithdraw(attempts)
    },
    onSuccess: (result) => {
      setOutcome(result)
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'ledger'] })
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'account'] })
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'fleet'] })
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'worklist'] })
    },
    // 🚩 There is no `onError` and there should not be: every call in the loop is
    // caught above and reported as its own row, so this mutation cannot reject.
    // A failure surface here would be a second, vaguer account of what the report
    // already says per entry.
  })

  const ready = plan.cancellable.length > 0 && reason.trim().length > 0

  return (
    <section className="flex flex-col gap-4" data-region="batch-withdraw" data-batch={batchId}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t('batch.title')}</h2>
        <p className="font-mono text-xs text-muted-foreground">{batchId}</p>
      </header>

      {batch.isError && (
        <ErrorBanner
          message={apiErrorMessage(batch.error, t('batch.errors.loadFailed'))}
          className="p-3"
        />
      )}

      {batch.isPending ? (
        <AccountShimmer label={t('batch.loading')} />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          {t('batch.empty')}
        </p>
      ) : outcome ? (
        <Outcome outcome={outcome} params={searchParams} />
      ) : (
        <>
          <BatchRows plan={plan} params={searchParams} />

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            <p className="text-sm">
              {t('batch.act.summary', {
                count: plan.cancellable.length,
                total: rows.length,
              })}
            </p>
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
              onClick={() => ready && !withdraw.isPending && withdraw.mutate()}
              aria-disabled={!ready || withdraw.isPending || undefined}
              data-testid="batch-commit"
            >
              {withdraw.isPending
                ? t('batch.act.working')
                : t('batch.act.commit', { count: plan.cancellable.length })}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

/** The batch, before the act: what will be attempted, and what will not. */
function BatchRows({ plan, params }: { plan: BatchPlan; params: URLSearchParams }) {
  const { t } = useTranslation('settlement')

  return (
    <div className="flex flex-col gap-3">
      <Group
        testId="batch-cancellable"
        title={t('batch.groups.cancellable', { count: plan.cancellable.length })}
      >
        {plan.cancellable.map((row) => (
          <Row key={row.settlementEntryId} row={row} params={params} />
        ))}
      </Group>

      {/* 🔑 Named, not counted — each with the reason it is not in the act. */}
      {plan.skipped.length > 0 && (
        <Group
          testId="batch-skipped"
          tone="attention"
          title={t('batch.groups.skipped', { count: plan.skipped.length })}
        >
          {plan.skipped.map(({ row, because }) => (
            <Row
              key={row.settlementEntryId}
              row={row}
              params={params}
              note={t(`batch.skipped.${because}`, {
                remaining: formatMoneyIn(row.remainingAmount, row.currencyKey),
              })}
            />
          ))}
        </Group>
      )}
    </div>
  )
}

/** What the act actually did — three groups, none of them an error surface. */
function Outcome({ outcome, params }: { outcome: BatchOutcome; params: URLSearchParams }) {
  const { t } = useTranslation('settlement')

  return (
    <div className="flex flex-col gap-3" data-region="batch-outcome">
      <p className="text-sm font-medium" data-testid="batch-outcome-summary">
        {t('batch.outcome.summary', { count: outcome.withdrawn.length })}
      </p>

      {/* 🔑 The ticket's own requirement: the rows a till already consumed, NAMED,
          with the server's words and the remaining it came back with. */}
      {outcome.refused.length > 0 && (
        <Group
          testId="batch-refused"
          tone="attention"
          title={t('batch.outcome.refused', { count: outcome.refused.length })}
        >
          {outcome.refused.map(({ row, reason, remaining }) => (
            <Row
              key={row.settlementEntryId}
              row={row}
              params={params}
              // ⚠️ One key, one sentence — never two joined with a `+` and a space.
              // The server's words are data riding on a named param; a sentence
              // assembled at the call site cannot be re-ordered by a translator.
              note={t(reason ? 'batch.outcome.refusedRow' : 'batch.outcome.refusedRowUnstated', {
                remaining: formatMoneyIn(remaining, row.currencyKey),
                reason,
              })}
            />
          ))}
        </Group>
      )}

      {outcome.failed.length > 0 && (
        <Group
          testId="batch-failed"
          tone="attention"
          title={t('batch.outcome.failed', { count: outcome.failed.length })}
        >
          {outcome.failed.map((row) => (
            <Row
              key={row.settlementEntryId}
              row={row}
              params={params}
              note={t('batch.outcome.failedRow')}
            />
          ))}
        </Group>
      )}

      {outcome.withdrawn.length > 0 && (
        <Group
          testId="batch-withdrawn"
          title={t('batch.outcome.withdrawn', { count: outcome.withdrawn.length })}
        >
          {outcome.withdrawn.map((row) => (
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

/** One entry of the batch — and a way to its own account, which is where a
 *  write-off lives (272). */
function Row({
  row,
  params,
  note,
}: {
  row: SettlementLedgerRow
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
        <span className="font-medium">{row.storeName}</span>
      </Link>
      <span className="text-xs text-muted-foreground">
        {t('batch.row.entry', { number: row.entryNumber })}
      </span>
      <span className="tabular-nums">{formatMoneyIn(row.amount, row.currencyKey)}</span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </li>
  )
}
