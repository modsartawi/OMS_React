import { useEffect, useId, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { DeliverectStoreRow, DeliverectSyncLogRow } from '@/core/models/deliverect'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { SHEET } from '@/core/ui/overlay'
import { formatDateTime } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { SYNC_LOGS_TAKE, storesApi, syncLogsKey } from './api'
import { runFailed, syncTypeKey } from './sync-health'

/** The number a cell shows, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

const TH = 'px-2 py-1.5 text-start font-medium whitespace-nowrap'
const TD = 'px-2 py-1.5 align-top whitespace-nowrap'

/**
 * **A store's stock sync log** (ticket 480; contract § Stock sync, `GET Sync/{store}/Logs`) — the
 * last 50 runs, most recent first as the door answers them: type (full or delta), start, end, rows,
 * status, Deliverect's file id, its `processed` callback, and the error. A failed run's row is red.
 *
 * The frame copies the house side sheet (`admin/sync-console`'s `SnapshotDrawer`; a feature never
 * imports another): a native `<dialog>` docked to the inline end on the overlay recipe's `SHEET`,
 * over the `--backdrop` scrim, with its top layer, focus trap, focus given back and Escape. React
 * state stays the one source of truth for open. It reads the door when it opens.
 */
export default function SyncLogsDrawer({ row, onClose }: { row: DeliverectStoreRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const logs = useQuery({
    queryKey: syncLogsKey(row.storeCode),
    queryFn: () => storesApi.syncLogs(row.storeCode),
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
      data-sync-logs-drawer={row.storeCode}
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
      className={'end-0 my-0 me-0 ms-auto h-dvh max-h-dvh w-[60rem] max-w-[96vw] border-0 border-s p-0 ' + SHEET}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t('logs.eyebrow')}</span>
            <h2 id={titleId} className="text-sm font-semibold tracking-tight" data-sync-logs-title="">
              {/* A pair led by a machine value: one string, isolated once (bidi rule). */}
              <Ltr>{formatPair(row.storeCode, row.storeName)}</Ltr>
            </h2>
            <span className="text-xs text-muted-foreground">{t('logs.hint', { max: fsi(String(SYNC_LOGS_TAKE)) })}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('logs.close')}
            title={t('logs.close')}
            data-sync-logs-close=""
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          {logs.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" data-sync-logs-loading="">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('logs.loading')}
            </p>
          ) : logs.isError ? (
            <div data-sync-logs-error={apiErrorCode(logs.error) ?? ''}>
              <ErrorBanner className="p-3" title={t('logs.failed')} message={apiErrorMessage(logs.error, t('dialog.failedHint'))} />
            </div>
          ) : logs.data.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-sync-logs-empty="">
              {t('logs.empty')}
            </p>
          ) : (
            <table className="w-full border-collapse text-xs" data-sync-logs-table="">
              <thead className="border-b border-border/60 text-muted-foreground">
                <tr>
                  <th className={TH}>{t('logs.columns.type')}</th>
                  <th className={TH}>{t('logs.columns.start')}</th>
                  <th className={TH}>{t('logs.columns.end')}</th>
                  <th className={TH + ' text-end'}>{t('logs.columns.rows')}</th>
                  <th className={TH}>{t('logs.columns.status')}</th>
                  <th className={TH}>{t('logs.columns.fileId')}</th>
                  <th className={TH}>{t('logs.columns.callback')}</th>
                  <th className={TH}>{t('logs.columns.error')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((log) => (
                  <LogRow key={log.logId} log={log} />
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
 * One run. Machine values isolated left-to-right; the error is free text (`<bdi>`). A run with no
 * end yet is still going: its status is shown as sent, neutral, never as a failure.
 */
function LogRow({ log }: { log: DeliverectSyncLogRow }) {
  const { t } = useTranslation('deliverect-stores')
  const type = syncTypeKey(log.syncType)
  const running = log.endTime == null
  const failed = !running && runFailed(log.status)
  return (
    <tr
      className={'border-b border-border/40 ' + (failed ? 'bg-danger-050' : '')}
      data-sync-log={log.logId}
      data-sync-log-failed={failed ? '' : undefined}
    >
      <td className={TD} data-log-type="">
        {type ? t(`logs.type.${type}`) : <Ltr>{log.syncType}</Ltr>}
      </td>
      <td className={TD} data-log-start="">
        <Ltr>{formatDateTime(log.startTime)}</Ltr>
      </td>
      <td className={TD} data-log-end="">
        {log.endTime ? <Ltr>{formatDateTime(log.endTime)}</Ltr> : <span className="text-muted-foreground">{t('logs.running')}</span>}
      </td>
      <td className={TD + ' text-end tabular-nums'} data-log-rows="">
        <Ltr>{figure(log.rows)}</Ltr>
      </td>
      <td className={TD} data-log-status="">
        {running ? (
          log.status ? (
            <StatusBadge sev="mute">
              <Ltr>{log.status}</Ltr>
            </StatusBadge>
          ) : null
        ) : (
          <StatusBadge sev={failed ? 'bad' : 'ok'}>
            {/* One flex item: the words and the code, with the space between them kept. */}
            <span>
              {failed ? t('logs.failedRun') : t('logs.success')} <Ltr>{log.status}</Ltr>
            </span>
          </StatusBadge>
        )}
      </td>
      <td className={TD + ' font-mono'} data-log-file="">
        {log.fileId ? <Ltr>{log.fileId}</Ltr> : null}
      </td>
      <td className={TD + ' font-mono'} data-log-callback="">
        {log.callbackStatus ? <Ltr>{log.callbackStatus}</Ltr> : <span className="font-sans text-muted-foreground">{t('logs.noCallback')}</span>}
      </td>
      <td className={'px-2 py-1.5 align-top ' + (log.error ? 'text-danger-800' : '')} data-log-error="">
        {log.error ? <bdi>{log.error}</bdi> : null}
      </td>
    </tr>
  )
}
