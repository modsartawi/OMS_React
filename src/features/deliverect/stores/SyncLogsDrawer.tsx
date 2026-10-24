import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ListTree, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { DeliverectStoreRow, DeliverectSyncLogRow } from '@/core/models/deliverect'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { formatDateTime } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { SYNC_LOGS_TAKE, storesApi, syncLogsKey } from './api'
import PushLines from './PushLines'
import { runFailed, syncTypeKey } from './sync-health'
import { figure } from './sync-lines'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'


/**
 * **A store's stock sync log** (ticket 480; contract § Stock sync, `GET Sync/{store}/Logs`) — the
 * last 50 runs, most recent first as the door answers them: type (full or delta), start, end, rows,
 * status, Deliverect's file id, its `processed` callback, and the error. A failed run's row is red.
 *
 * The frame is core's `SideSheet` (ticket 556; its header core's `SideSheetHeader`, ticket 554): a native `<dialog>`
 * docked to the inline end, with its top layer, focus trap, focus given back and Escape. React
 * state stays the one source of truth for open. It reads the door when it opens.
 *
 * Ticket 550: each run opens its lines in place (`PushLines`), with a way back to the log.
 */
export default function SyncLogsDrawer({ row, onClose }: { row: DeliverectStoreRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const titleId = useId()
  // The open run by id: its row is read from the log as it stands, so a refetch updates it.
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  /** Where the log was scrolled, and whose Lines button opened the run — given back on Back. */
  const returnTo = useRef<{ logId: string; scrollTop: number } | null>(null)
  const logs = useQuery({
    queryKey: syncLogsKey(row.storeCode),
    queryFn: () => storesApi.syncLogs(row.storeCode),
    retry: false,
  })

  const openRun = openRunId ? (logs.data?.find((l) => l.logId === openRunId) ?? null) : null

  const openLines = (logId: string) => {
    returnTo.current = { logId, scrollTop: scroller.current?.scrollTop ?? 0 }
    setOpenRunId(logId)
  }

  // Opening a run starts its lines at the top (PushLines focuses its Back); Back puts the log
  // where it was and gives focus back to the run's Lines button.
  useLayoutEffect(() => {
    const box = scroller.current
    if (!box) return
    if (openRunId) {
      box.scrollTop = 0
      return
    }
    const back = returnTo.current
    if (!back) return
    returnTo.current = null
    box.scrollTop = back.scrollTop
    box.querySelector<HTMLButtonElement>(`[data-log-open-lines="${CSS.escape(back.logId)}"]`)?.focus()
  }, [openRunId])

  return (
    <SideSheet onClose={onClose} width="w-[60rem]" aria-labelledby={titleId} data-sync-logs-drawer={row.storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('logs.eyebrow')}
        // A pair led by a machine value: one string, isolated once (bidi rule).
        title={<Ltr>{formatPair(row.storeCode, row.storeName)}</Ltr>}
        hint={t('logs.hint', { max: fsi(String(SYNC_LOGS_TAKE)) })}
        closeLabel={t('logs.close')}
        onClose={onClose}
        titleData={{ 'data-sync-logs-title': '' }}
        closeData={{ 'data-sync-logs-close': '' }}
      />
      <div ref={scroller} className={SHEET_BODY} data-sync-logs-scroller="">
        {openRun ? (
          <PushLines storeCode={row.storeCode} log={openRun} onBack={() => setOpenRunId(null)} />
        ) : logs.isPending ? (
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
                <th className={TH}>{t('logs.columns.lines')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.map((log) => (
                <LogRow key={log.logId} log={log} onLines={() => openLines(log.logId)} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SideSheet>
  )
}

/**
 * One run. Machine values isolated left-to-right; the error is free text (`<bdi>`). A run with no
 * end yet is still going: its status is shown as sent, neutral, never as a failure.
 */
function LogRow({ log, onLines }: { log: DeliverectSyncLogRow; onLines: () => void }) {
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
      <td className={TD} data-log-lines="">
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onLines}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-muted"
            data-log-open-lines={log.logId}
          >
            <ListTree className="h-3.5 w-3.5" aria-hidden />
            {t('logs.openLines')}
          </button>
          {log.linesKept === false && (
            <span className="text-muted-foreground" data-log-lines-gone="">
              {t('logs.linesGone')}
            </span>
          )}
        </span>
      </td>
    </tr>
  )
}
