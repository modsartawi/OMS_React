import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ListTree, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { HUNGERSTATION_SYNC_HISTORY_DAYS, type HungerStationSyncLogRow } from '@/core/models/hungerstation'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import { formatDateTime } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { storesApi, syncLogsKey } from './api'
import { PushStatus, PushType } from './PushCells'
import PushLines from './PushLines'
import { LOGS_TAKE, figure, historyRefusal, pushReading } from './sync-history'

/**
 * **A HungerStation store's pushes** (ticket 554; contract § Stock sync, `GET Sync/{store}/Logs`) —
 * newest first, at most 15 days back: type (full or delta), start, end, status, rows sent and the
 * error. A failed push's row is red. Each push opens its lines in place (`PushLines`), with a way
 * back to the log. The WPF Last Logs / Log Items windows, shaped like the Deliverect logs drawer.
 *
 * It takes a store CODE, not a row: a removed store's logs stay readable from wherever its code is
 * known (the page opens it from `?logs=<code>`). DHS-00007 — no store and no logs for the code —
 * says so in words.
 */
export default function SyncLogsDrawer({ storeCode, storeName, onClose }: { storeCode: string; storeName: string; onClose: () => void }) {
  const { t } = useTranslation('hungerstation-stores')
  const titleId = useId()
  const [openPushId, setOpenPushId] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  /** Where the log was scrolled, and whose Lines button opened the push — given back on Back. */
  const returnTo = useRef<{ logId: string; scrollTop: number } | null>(null)
  const logs = useQuery({
    queryKey: syncLogsKey(storeCode),
    queryFn: () => storesApi.syncLogs(storeCode),
    retry: false,
  })
  const days = fsi(String(HUNGERSTATION_SYNC_HISTORY_DAYS))

  // The open push is read from the log as it stands, so a refetch updates it.
  const openPush = openPushId ? (logs.data?.find((l) => l.logId === openPushId) ?? null) : null

  const openLines = (logId: string) => {
    returnTo.current = { logId, scrollTop: scroller.current?.scrollTop ?? 0 }
    setOpenPushId(logId)
  }

  // Opening a push starts its lines at the top; Back puts the log where it was and gives focus
  // back to the push's Lines button.
  useLayoutEffect(() => {
    const box = scroller.current
    if (!box) return
    if (openPushId) {
      box.scrollTop = 0
      return
    }
    const back = returnTo.current
    if (!back) return
    returnTo.current = null
    box.scrollTop = back.scrollTop
    box.querySelector<HTMLButtonElement>(`[data-log-open-lines="${CSS.escape(back.logId)}"]`)?.focus()
  }, [openPushId])

  const refusal = logs.isError ? historyRefusal(apiErrorCode(logs.error)) : null

  return (
    <SideSheet onClose={onClose} width="w-[60rem]" aria-labelledby={titleId} data-hs-logs-drawer={storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('logs.eyebrow')}
        // A pair led by a machine value: one string, isolated once (bidi rule).
        title={<Ltr>{formatPair(storeCode, storeName)}</Ltr>}
        hint={t('logs.hint', { days, max: fsi(figure(LOGS_TAKE)) })}
        closeLabel={t('logs.close')}
        onClose={onClose}
        titleData={{ 'data-hs-logs-title': '' }}
        closeData={{ 'data-hs-logs-close': '' }}
      />
      <div ref={scroller} className={SHEET_BODY} data-hs-logs-scroller="">
        {openPush ? (
          <PushLines storeCode={storeCode} push={openPush} onBack={() => setOpenPushId(null)} />
        ) : logs.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-hs-logs-loading="">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('logs.loading')}
          </p>
        ) : refusal === 'unknownStore' ? (
          <p role="status" className="rounded-md border border-border/60 bg-card-2 px-3 py-2 text-sm text-muted-foreground" data-hs-logs-unknown="">
            {t('logs.unknownStore')}
          </p>
        ) : logs.isError ? (
          <div data-hs-logs-error={apiErrorCode(logs.error) ?? ''}>
            <ErrorBanner className="p-3" title={t('logs.failed')} message={apiErrorMessage(logs.error, t('dialog.failedHint'))} />
          </div>
        ) : logs.data.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-hs-logs-empty="">
            {t('logs.empty', { days })}
          </p>
        ) : (
          <table className="w-full border-collapse text-xs" data-hs-logs-table="">
            <thead className="border-b border-border/60 text-muted-foreground">
              <tr>
                <th className={TH}>{t('logs.columns.type')}</th>
                <th className={TH}>{t('logs.columns.start')}</th>
                <th className={TH}>{t('logs.columns.end')}</th>
                <th className={TH}>{t('logs.columns.status')}</th>
                <th className={TH + ' text-end'}>{t('logs.columns.rows')}</th>
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

/** One push. Machine values isolated left-to-right; the error is free text (`<bdi>`). */
function LogRow({ log, onLines }: { log: HungerStationSyncLogRow; onLines: () => void }) {
  const { t } = useTranslation('hungerstation-stores')
  const failed = pushReading(log) === 'failed'
  return (
    <tr className={'border-b border-border/40 ' + (failed ? 'bg-danger-050' : '')} data-hs-log={log.logId} data-hs-log-failed={failed ? '' : undefined}>
      <td className={TD} data-log-type="">
        <PushType syncType={log.syncType} />
      </td>
      <td className={TD} data-log-start="">
        <Ltr>{formatDateTime(log.startTime)}</Ltr>
      </td>
      <td className={TD} data-log-end="">
        {log.endTime ? <Ltr>{formatDateTime(log.endTime)}</Ltr> : null}
      </td>
      <td className={TD} data-log-status="">
        <PushStatus push={log} />
      </td>
      <td className={TD + ' text-end tabular-nums'} data-log-rows="">
        <Ltr>{figure(log.rows)}</Ltr>
      </td>
      <td className={'px-2 py-1.5 align-top ' + (log.error ? 'text-danger-800' : '')} data-log-error="">
        {log.error ? <bdi>{log.error}</bdi> : null}
      </td>
      <td className={TD} data-log-lines="">
        <button
          type="button"
          onClick={onLines}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-primary hover:bg-muted"
          data-log-open-lines={log.logId}
        >
          <ListTree className="h-3.5 w-3.5" aria-hidden />
          {t('logs.openLines')}
        </button>
      </td>
    </tr>
  )
}
