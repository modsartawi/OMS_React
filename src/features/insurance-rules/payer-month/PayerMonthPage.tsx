import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CalendarCheck, History, Loader2, Lock, LockOpen, ScanSearch } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { PayerMonthRow } from '@/core/models/insurance-payer-month'
import { formatClock } from '@/core/nphies/format'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { TD, TH } from '@/core/ui/sheet-table'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import ActDialog from './ActDialog'
import { canManagePayerMonths, payerMonthAccessQuery } from './access'
import { auditKey, correctionsKey, monthKey, payerMonthApi } from './api'
import PayerSheet from './PayerSheet'
import {
  closeAction,
  closeAllOffer,
  counted,
  mergeRow,
  periodFromParams,
  periodText,
  periodToParams,
  rowState,
  type ActTarget,
  type Period,
} from './payer-month-rules'

/**
 * **Payer months** (oms 896; BackOffice spec 1623, tickets 1628, 1639, 1644, 1648) — the insurance team closes a
 * payer's month so NewPos tills refuse insurance returns and corrections in it, closes a whole month in one act,
 * reopens one for a late correction, and reads each payer-month's history and corrections register.
 *
 * 🚩 The page opens on the LEDGER read (no `activity`): the payers already on the ledger, and the payers with a
 * correction. "Show payers with activity" adds every payer with sales in the month — a scan of the month's sales,
 * so it runs only when pressed, never on open, on a period change or on a timer (`staleTime: Infinity`). Close all
 * is offered only once that list is read, and states its count from it.
 *
 * One grant for the whole screen (`InsurancePayerMonthWeb/Access`, D36). The gate below hides; the server's grant
 * filter on every door refuses.
 */
const STATE_SEV: Record<ReturnType<typeof rowState>, Severity> = { closed: 'ok', reopened: 'warn', open: 'mute' }

export default function PayerMonthPage() {
  const { t } = useTranslation('insurance-payer-month')
  return (
    <ScreenGate
      query={payerMonthAccessQuery()}
      can={canManagePayerMonths}
      ns="insurance-payer-month"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <PayerMonthBody />
    </ScreenGate>
  )
}

function PayerMonthBody() {
  const { t, i18n } = useTranslation('insurance-payer-month')
  const queryClient = useQueryClient()
  const { query: period, update } = useUrlQuery<Period>(periodFromParams, periodToParams)
  const { year, month } = period
  const periodValue = periodText(period)

  // Which period the activity list was asked for. A different period opens on its ledger read again: the scan
  // is per month, and pressing for one month must not scan the next one the user looks at.
  const [activityFor, setActivityFor] = useState<string | null>(null)
  const showingActivity = activityFor === periodValue
  // Leaving the month forgets the press, so coming back to it (by the pickers or by back/forward) opens on the
  // ledger again and never re-scans on its own.
  useEffect(() => {
    setActivityFor((prev) => (prev === periodValue ? prev : null))
  }, [periodValue])

  const ledger = useQuery({
    queryKey: monthKey(year, month, false),
    queryFn: () => payerMonthApi.month(year, month, false),
    retry: false,
  })
  const activity = useQuery({
    queryKey: monthKey(year, month, true),
    queryFn: () => payerMonthApi.month(year, month, true),
    enabled: showingActivity,
    // 🚩 Never re-scanned on its own: only the button reads it again.
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
  })

  // While the scan runs the ledger stays on screen; the activity list replaces it once it has answered.
  const viewingActivity = showingActivity && activity.data !== undefined
  const shown = viewingActivity ? activity : ledger
  const rows = shown.data
  const activityFailed = showingActivity && activity.isError
  const offer = closeAllOffer({ activity: showingActivity && activity.isSuccess, rows: activity.data })

  const onShowActivity = () => {
    if (showingActivity) void activity.refetch()
    else setActivityFor(periodValue)
  }

  // ---- the acts --------------------------------------------------------------------------------------------
  const [target, setTarget] = useState<ActTarget | null>(null)
  const [sheetRow, setSheetRow] = useState<PayerMonthRow | null>(null)

  const act = useMutation({
    mutationFn: async ({ target: tgt, reason }: { target: ActTarget; reason: string }) =>
      tgt.kind === 'closeAll'
        ? { kind: 'closeAll' as const, answer: await payerMonthApi.closeAll(tgt, reason) }
        : { kind: tgt.kind, answer: await payerMonthApi.act(tgt, reason) },
    onSuccess: (done, { target: tgt }) => {
      setTarget(null)
      const at = fsi(periodText(tgt))
      if (done.kind === 'closeAll') {
        // The list re-reads (ticket Proof): the activity read too, because close-all's own answer omits a payer
        // with only a correction, which the month read lists. One more scan, after a deliberate month-end only.
        void queryClient.invalidateQueries({ queryKey: monthKey(tgt.year, tgt.month, true) })
        toast.success(t('done.closedAll', counted(done.answer.closedCount)), { description: at })
      } else {
        const row = done.answer
        queryClient.setQueryData<PayerMonthRow[]>(monthKey(tgt.year, tgt.month, true), (prev) => (prev ? mergeRow(prev, row) : prev))
        void queryClient.invalidateQueries({ queryKey: auditKey(row.customerId, tgt.year, tgt.month) })
        void queryClient.invalidateQueries({ queryKey: correctionsKey(row.customerId, tgt.year, tgt.month) })
        toast.success(t(done.kind === 'close' ? 'done.closed' : 'done.reopened'), {
          description: fsi(formatPair(row.customerId, periodText(tgt))),
        })
      }
      void queryClient.invalidateQueries({ queryKey: monthKey(tgt.year, tgt.month, false) })
    },
  })

  const openAct = (next: ActTarget) => {
    act.reset()
    setTarget(next)
  }

  // ---- the period ------------------------------------------------------------------------------------------
  const months = useMemo(() => {
    const name = new Intl.DateTimeFormat(i18n.language, { month: 'long' })
    return Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: name.format(new Date(2000, i, 1)) }))
  }, [i18n.language])
  // The field holds what is typed; the period takes it only once it is a year, so "202" on the way to "2025"
  // is kept as typed rather than snapped back.
  const [yearDraft, setYearDraft] = useState(String(year))
  useEffect(() => setYearDraft(String(year)), [year])
  const setYear = (value: string) => {
    setYearDraft(value)
    const y = Number(value)
    if (Number.isInteger(y) && y >= 2000 && y <= 9999) update((p) => ({ ...p, year: y }))
  }

  const reading = ledger.isFetching || activity.isFetching
  const emptyKey = viewingActivity ? 'list.emptyActivity' : 'list.emptyLedger'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/60 bg-card p-3" data-testid="payer-month-toolbar">
        <Field label={t('period.year')} className="w-24">
          <Input
            type="number"
            min={2000}
            max={9999}
            value={yearDraft}
            onChange={(e) => setYear(e.target.value)}
            onBlur={() => setYearDraft(String(year))}
            dir="ltr"
            data-testid="payer-month-year"
          />
        </Field>
        <Field label={t('period.month')} className="w-40">
          <Select value={month} onChange={(e) => update((p) => ({ ...p, month: Number(e.target.value) }))} data-testid="payer-month-month">
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          variant="secondary"
          onClick={onShowActivity}
          disabled={activity.isFetching}
          title={t('list.activityHint')}
          data-testid="payer-month-show-activity"
        >
          {activity.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ScanSearch className="h-3.5 w-3.5" aria-hidden />}
          {t(showingActivity ? 'list.rereadActivity' : 'list.showActivity')}
        </Button>
        <span className="flex-1" />
        {offer ? (
          <Button
            variant="danger"
            onClick={() => openAct({ kind: 'closeAll', count: offer.count, year, month })}
            disabled={activity.isFetching}
            data-testid="payer-month-close-all"
          >
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
            {t('closeAll.button', counted(offer.count))}
          </Button>
        ) : (
          !showingActivity && <span className="text-xs text-muted-foreground">{t('closeAll.notOffered')}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="payer-month-caption">
        <span>{t(viewingActivity ? 'list.activityCaption' : 'list.ledgerCaption')}</span>
        {rows && <span>{t('list.count', counted(rows.length))}</span>}
        {reading ? (
          <span className="flex items-center gap-1" role="status">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t(activity.isFetching ? 'list.readingActivity' : 'list.reading')}
          </span>
        ) : (
          shown.dataUpdatedAt > 0 && <span>{t('list.loadedAt', { time: fsi(formatClock(shown.dataUpdatedAt)) })}</span>
        )}
      </div>

      {activityFailed && (
        <ErrorBanner title={t('list.failed')} message={apiErrorMessage(activity.error, t('list.failed'))} className="p-3" />
      )}
      {shown.isError ? (
        <ErrorBanner title={t('list.failed')} message={apiErrorMessage(shown.error, t('list.failed'))} className="p-3" />
      ) : rows && rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="payer-month-empty">
          {t(emptyKey, { period: fsi(periodValue) })}
        </p>
      ) : rows ? (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full text-sm" data-testid="payer-month-table">
            <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
              <tr>
                <th className={TH}>{t('col.payer')}</th>
                <th className={TH}>{t('col.state')}</th>
                <th className={TH}>{t('col.lastAct')}</th>
                <th className={TH}>{t('col.reason')}</th>
                <th className={`${TH} text-end`}>{t('col.corrections')}</th>
                <th className={`${TH} text-end`}>{t('col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <PayerRow
                  key={row.customerId}
                  row={row}
                  onAct={(kind) => openAct({ kind, row, year, month })}
                  onDetails={() => setSheetRow(row)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ActDialog
        target={target}
        offer={offer}
        busy={act.isPending}
        error={act.error}
        onClose={() => !act.isPending && setTarget(null)}
        onConfirm={(reason) => target && act.mutate({ target, reason })}
      />
      {sheetRow && <PayerSheet row={sheetRow} onClose={() => setSheetRow(null)} />}
    </div>
  )
}

function PayerRow({ row, onAct, onDetails }: { row: PayerMonthRow; onAct: (kind: 'close' | 'reopen') => void; onDetails: () => void }) {
  const { t } = useTranslation('insurance-payer-month')
  const state = rowState(row)
  const action = closeAction(row)
  const at = formatDateTime(row.lastActionAt)

  return (
    <tr className="border-t border-border/60" data-testid="payer-month-row" data-payer={row.customerId} data-state={state}>
      <td className={TD}>
        <Ltr>{row.customerId}</Ltr>
      </td>
      <td className={TD}>
        <StatusBadge sev={STATE_SEV[state]}>{t(`state.${state}`)}</StatusBadge>
      </td>
      <td className={TD}>
        {row.hasRow && (
          <span className="flex flex-col text-xs">
            <Ltr>{at}</Ltr>
            <span className="text-muted-foreground">{t('row.lastActBy', { actor: fsi(row.lastActionBy) })}</span>
          </span>
        )}
      </td>
      <td className={`${TD} max-w-[24rem] whitespace-normal text-xs`}>
        <bdi>{row.lastActionReason}</bdi>
      </td>
      <td className={`${TD} text-end`} data-testid="payer-month-row-corrections">
        <Ltr>{row.correctionCount}</Ltr>
      </td>
      <td className={`${TD} text-end`}>
        <span className="inline-flex items-center gap-1">
          <Button variant="text" onClick={onDetails} aria-label={t('row.detailsLabel', { payer: fsi(row.customerId) })} data-testid="payer-month-details">
            <History className="h-3.5 w-3.5" aria-hidden />
            {t('row.details')}
          </Button>
          {action.act === 'reopen' ? (
            <Button variant="secondary" onClick={() => onAct('reopen')} data-testid="payer-month-reopen">
              <LockOpen className="h-3.5 w-3.5" aria-hidden />
              {t('row.reopen')}
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => onAct('close')}
              // The corrections count rides the close action (BackOffice 1639): closing is a review.
              title={action.corrections > 0 ? t('row.correctionsOnClose', counted(action.corrections)) : undefined}
              data-testid="payer-month-close"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden />
              {t('row.close')}
              {action.corrections > 0 && (
                <span className="rounded-full bg-attention-050 px-1.5 text-attention-800" data-testid="payer-month-close-count">
                  <Ltr>{action.corrections}</Ltr>
                </span>
              )}
            </Button>
          )}
        </span>
      </td>
    </tr>
  )
}
