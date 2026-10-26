import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Copy, Loader2, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { DeliverectOrderRow } from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { rawView } from '@/core/util/raw-json'
import { orderRawKey, ordersApi } from './api'

/**
 * **The raw order, as Deliverect sent it** (ticket 478; contract § Orders monitor,
 * `GET Orders/{id}/Raw`) — read only, for checking a disputed order against its source. The body
 * is shown re-indented when it is JSON (`rawView`: white space only, every value byte for byte) or
 * exactly as received when it is not, and "As received" shows the verbatim text either way. Copy
 * takes the verbatim body.
 *
 * The frame is the house side sheet, `@/core/ui/SideSheet` (graduated by ticket 556). The JSON is ONE left-to-right island
 * (`dir="ltr"`, monospace), in Arabic too — never an isolate per value.
 */
export default function RawDrawer({ row, onClose }: { row: DeliverectOrderRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-orders')
  const titleId = useId()
  const raw = useQuery({
    queryKey: orderRawKey(row.deliverectOrderId),
    queryFn: () => ordersApi.raw(row.deliverectOrderId),
    retry: false,
  })
  const view = useMemo(() => (raw.data ? rawView(raw.data.rawBody ?? '') : null), [raw.data])
  const [verbatim, setVerbatim] = useState(false)


  // Inside the promise, so a page with no clipboard (plain http) says it could not copy rather than throwing.
  const copy = () => {
    const body = raw.data?.rawBody ?? ''
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(body))
      .then(
        () => notify.success(t('raw.copied')),
        () => notify.error(t('raw.copyFailed')),
      )
  }

  return (
    <SideSheet onClose={onClose} width="w-[52rem]" aria-labelledby={titleId} data-raw-drawer={row.deliverectOrderId}>
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{t('raw.eyebrow')}</span>
          <h2 id={titleId} className="text-sm font-semibold tracking-tight" data-raw-title="">
            <Ltr>{formatPair(row.platformKey, row.channelDisplayId)}</Ltr>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {view?.pretty && (
            <span className="flex items-center gap-1" role="group">
              <Button variant={verbatim ? 'text' : 'secondary'} aria-pressed={!verbatim} onClick={() => setVerbatim(false)} data-raw-formatted="">
                {t('raw.formatted')}
              </Button>
              <Button variant={verbatim ? 'secondary' : 'text'} aria-pressed={verbatim} onClick={() => setVerbatim(true)} data-raw-verbatim="">
                {t('raw.asReceived')}
              </Button>
            </span>
          )}
          <Button variant="secondary" onClick={copy} disabled={!raw.isSuccess} data-raw-copy="">
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {t('raw.copy')}
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('raw.close')}
            title={t('raw.close')}
            data-raw-close=""
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {raw.isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-raw-loading="">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('raw.loading')}
          </p>
        ) : raw.isError ? (
          <div data-raw-error={apiErrorCode(raw.error) ?? ''}>
            <ErrorBanner className="p-3" title={t('raw.failed')} message={apiErrorMessage(raw.error, t('results.failed'))}>
              {apiErrorCode(raw.error) && (
                <span className="font-mono text-xs">
                  <Ltr>{apiErrorCode(raw.error)}</Ltr>
                </span>
              )}
            </ErrorBanner>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-raw-received-at={raw.data.receivedAt}>
              <p>
                <Trans t={t} i18nKey="raw.receivedAt" values={{ at: formatDateTime(raw.data.receivedAt) }} components={{ t: <Ltr /> }} />
              </p>
              <p data-raw-note="">{view?.pretty ? t('raw.readOnly') : t('raw.notJson')}</p>
            </div>
            {/* One LTR island for the whole body, in Arabic too: never an isolate per value. */}
            <pre
              dir="ltr"
              className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre"
              data-raw-body={view?.pretty && !verbatim ? 'formatted' : 'verbatim'}
            >
              {view?.pretty && !verbatim ? view.text : (raw.data.rawBody ?? '')}
            </pre>
          </>
        )}
      </div>
    </SideSheet>
  )
}
