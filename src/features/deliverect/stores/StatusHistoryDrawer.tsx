import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { DeliverectStoreRow, DeliverectStoreStatusHistoryRow } from '@/core/models/deliverect'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { formatDateTime } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { STATUS_HISTORY_TAKE, statusHistoryKey, storesApi } from './api'
import { historyActionKey } from './store-status'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'


/**
 * **A store's status history** (ticket 481; contract § Store status, `GET StoreStatus/{store}/History`)
 * — the most recent changes as the door answers them: the action, the preparation delay, the reason,
 * who sent it and when, and Deliverect's answer.
 *
 * The frame is core's `SideSheet` (graduated by ticket 556; its header is core's `SideSheetHeader`, ticket 554). It reads the door when it opens.
 */
export default function StatusHistoryDrawer({ row, onClose }: { row: DeliverectStoreRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const titleId = useId()
  const history = useQuery({
    queryKey: statusHistoryKey(row.storeCode),
    queryFn: () => storesApi.statusHistory(row.storeCode),
    retry: false,
  })

  return (
    <SideSheet onClose={onClose} width="w-[56rem]" aria-labelledby={titleId} data-status-history-drawer={row.storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('history.eyebrow')}
        // A pair led by a machine value: one string, isolated once (bidi rule).
        title={<Ltr>{formatPair(row.storeCode, row.storeName)}</Ltr>}
        hint={t('history.hint', { max: fsi(String(STATUS_HISTORY_TAKE)) })}
        closeLabel={t('history.close')}
        onClose={onClose}
        titleData={{ 'data-status-history-title': '' }}
        closeData={{ 'data-status-history-close': '' }}
      />
      <div className={SHEET_BODY}>
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
    </SideSheet>
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
