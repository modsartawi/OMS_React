import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import StatusBadge from '@/core/ui/StatusBadge'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { historyKey, storesApi } from './api'

/**
 * **A store's mark / unmark history** (spec 3447 story 8; ticket 847) — who, when, why and through
 * which door, newest first. It takes a store CODE, so `?history=<code>` opens it for a store the
 * filters hide.
 */
export default function HistoryDrawer({ storeCode, storeName, onClose }: { storeCode: string; storeName: string; onClose: () => void }) {
  const { t } = useTranslation('hybris-stock-stores')
  const titleId = useId()
  const history = useQuery({ queryKey: historyKey(storeCode), queryFn: () => storesApi.history(storeCode), retry: false })
  const rows = history.data ?? []

  return (
    <SideSheet onClose={onClose} width="w-[44rem]" aria-labelledby={titleId} data-history-drawer={storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('history.eyebrow')}
        title={<Ltr>{storeName ? formatPair(storeCode, storeName) : storeCode}</Ltr>}
        closeLabel={t('history.close')}
        onClose={onClose}
        closeData={{ 'data-history-close': '' }}
      />
      <div className={SHEET_BODY}>
        {history.isPending && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('history.loading')}
          </p>
        )}
        {history.isError && <ErrorBanner className="p-2" title={t('history.failed')} message={apiErrorMessage(history.error, t('results.failed'))} />}
        {history.isSuccess && rows.length === 0 && (
          <p className="text-xs text-muted-foreground" data-history-empty="">
            {t('history.empty')}
          </p>
        )}
        {rows.length > 0 && (
          <table className="w-full text-xs" data-history-table="">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className={TH}>{t('history.at')}</th>
                <th className={TH}>{t('history.by')}</th>
                <th className={TH}>{t('history.action')}</th>
                <th className={TH}>{t('history.reason')}</th>
                <th className={TH}>{t('history.door')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.changeId || i} className="border-b border-border/50" data-history-row={r.action}>
                  <td className={TD}>
                    <Ltr>{formatDateTime(r.changedAt)}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{r.changedBy}</Ltr>
                  </td>
                  <td className={TD}>
                    {/* M mark, U unmark (the contract's letters); a letter the contract does not name shows as sent. */}
                    {r.action === 'M' ? (
                      <StatusBadge sev="go">{t('history.marked')}</StatusBadge>
                    ) : r.action === 'U' ? (
                      <StatusBadge sev="mute">{t('history.unmarked')}</StatusBadge>
                    ) : (
                      <StatusBadge sev="mute">
                        <Ltr>{r.action}</Ltr>
                      </StatusBadge>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top whitespace-pre-wrap" data-history-reason="">
                    <bdi>{r.reason}</bdi>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{r.door}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </SideSheet>
  )
}
