import { useEffect, useId, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { DeliverectStoreRow, DeliverectStoreStatusHistoryRow } from '@/core/models/deliverect'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { SHEET } from '@/core/ui/overlay'
import { formatDateTime } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { STATUS_HISTORY_TAKE, statusHistoryKey, storesApi } from './api'
import { historyActionKey } from './store-status'
import { TD, TH } from './table-cells'


/**
 * **A store's status history** (ticket 481; contract § Store status, `GET StoreStatus/{store}/History`)
 * — the most recent changes as the door answers them: the action, the preparation delay, the reason,
 * who sent it and when, and Deliverect's answer.
 *
 * The frame is 480's `SyncLogsDrawer` (itself `admin/sync-console`'s `SnapshotDrawer` recipe): a
 * native `<dialog>` docked to the inline end on the overlay recipe's `SHEET`. It reads the door when
 * it opens.
 */
export default function StatusHistoryDrawer({ row, onClose }: { row: DeliverectStoreRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const history = useQuery({
    queryKey: statusHistoryKey(row.storeCode),
    queryFn: () => storesApi.statusHistory(row.storeCode),
    retry: false,
  })

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-status-history-drawer={row.storeCode}
      onCancel={(e) => {
        e.preventDefault()
        // As core's Modal: Escape belongs to the top dialog, never to one that holds it too.
        e.stopPropagation()
        if (e.target === ref.current) onClose()
      }}
      onClose={() => {
        if (ref.current && !ref.current.open) onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={'end-0 my-0 me-0 ms-auto h-dvh max-h-dvh w-[56rem] max-w-[96vw] border-0 border-s p-0 ' + SHEET}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t('history.eyebrow')}</span>
            <h2 id={titleId} className="text-sm font-semibold tracking-tight" data-status-history-title="">
              {/* A pair led by a machine value: one string, isolated once (bidi rule). */}
              <Ltr>{formatPair(row.storeCode, row.storeName)}</Ltr>
            </h2>
            <span className="text-xs text-muted-foreground">{t('history.hint', { max: fsi(String(STATUS_HISTORY_TAKE)) })}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('history.close')}
            title={t('history.close')}
            data-status-history-close=""
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          {history.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" data-status-history-loading="">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('history.loading')}
            </p>
          ) : history.isError ? (
            <div data-status-history-error={apiErrorCode(history.error) ?? ''}>
              <ErrorBanner className="p-3" title={t('history.failed')} message={apiErrorMessage(history.error, t('dialog.failedHint'))} />
            </div>
          ) : history.data.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-status-history-empty="">
              {t('history.empty')}
            </p>
          ) : (
            <table className="w-full border-collapse text-xs" data-status-history-table="">
              <thead className="border-b border-border/60 text-muted-foreground">
                <tr>
                  <th className={TH}>{t('history.columns.action')}</th>
                  <th className={TH + ' text-end'}>{t('history.columns.delay')}</th>
                  <th className={TH}>{t('history.columns.reason')}</th>
                  <th className={TH}>{t('history.columns.by')}</th>
                  <th className={TH}>{t('history.columns.at')}</th>
                  <th className={TH}>{t('history.columns.answer')}</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((entry, i) => (
                  // The contract gives a history row no id: its time, action and place keep the key unique.
                  <HistoryRow key={`${entry.at}-${entry.action}-${i}`} entry={entry} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </dialog>
  )
}

/**
 * One change. Machine values (the delay, the user, the time) isolated left-to-right; the reason and
 * Deliverect's answer are free text (`<bdi>`). An action the contract does not name (the hours push)
 * is shown as sent.
 */
function HistoryRow({ entry }: { entry: DeliverectStoreStatusHistoryRow }) {
  const { t } = useTranslation('deliverect-stores')
  const action = historyActionKey(entry.action)
  return (
    <tr className="border-b border-border/40" data-status-history-row={entry.action}>
      <td className={TD} data-history-action="">
        {action ? t(`statusAction.actions.${action}`) : <Ltr>{entry.action}</Ltr>}
      </td>
      <td className={TD + ' text-end tabular-nums'} data-history-delay="">
        {entry.delayMinutes != null ? <Ltr>{String(entry.delayMinutes)}</Ltr> : null}
      </td>
      <td className="px-2 py-1.5 align-top" data-history-reason="">
        <bdi>{entry.reason}</bdi>
      </td>
      <td className={TD + ' font-mono'} data-history-by="">
        <Ltr>{entry.by}</Ltr>
      </td>
      <td className={TD} data-history-at="">
        <Ltr>{formatDateTime(entry.at)}</Ltr>
      </td>
      <td className="px-2 py-1.5 align-top" data-history-answer="">
        {entry.deliverectAnswer ? <bdi>{entry.deliverectAnswer}</bdi> : null}
      </td>
    </tr>
  )
}
