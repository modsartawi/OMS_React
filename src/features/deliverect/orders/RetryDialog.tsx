import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { InlineRefusal } from '@/core/deliverect/ReasonDialog'
import { fieldRefusal } from '@/core/deliverect/reason'
import { DELIVERECT_ERRORS, type DeliverectOrderRow } from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { ORDERS_KEY, ordersApi } from './api'

/** The two refusals the retry door names (contract § Orders monitor), shown inline in the dialog. */
const INLINE = [DELIVERECT_ERRORS.notFailed, DELIVERECT_ERRORS.noSuchOrder] as const

/**
 * **Retry a failed order** (ticket 478; contract `POST Orders/{id}/Retry`) — offered for a refused or
 * status-failed order only, and confirmed here on the app modal, never a browser `confirm()`. The
 * note says what the retry does for that outcome: a refused order is run again, a failed status
 * call is sent again.
 *
 * The contract names no reason for this write (HITL-478), so the dialog asks for none. DLV-00007
 * (not in a failed state) and DLV-00006 (no such order) show inline with the server's own words;
 * either one means the row moved on, so the reads are refreshed. Any other refusal shows with its
 * code. The dialog stays open on a refusal.
 */
export default function RetryDialog({ row, onClose }: { row: DeliverectOrderRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-orders')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: () => ordersApi.retry(row.deliverectOrderId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ORDERS_KEY })
      notify.success(t('retry.done'), t('retry.doneDetail', { order: fsi(row.channelDisplayId) }))
      onClose()
    },
    onError: (err) => {
      if (fieldRefusal(err, INLINE, '') !== null) void qc.invalidateQueries({ queryKey: ORDERS_KEY })
    },
  })
  const inline = fieldRefusal(send.error, INLINE, t('retry.failedHint'))
  const code = apiErrorCode(send.error)
  const note = row.outcome === 'statusFailed' ? 'retry.notes.statusFailed' : 'retry.notes.refused'

  return (
    <Modal
      open
      onClose={() => !send.isPending && onClose()}
      title={t('retry.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={send.isPending} data-retry-cancel="">
            {t('retry.cancel')}
          </Button>
          <Button variant="primary" disabled={send.isPending} onClick={() => send.mutate()} data-retry-confirm="">
            {send.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {send.isPending ? t('retry.sending') : t('retry.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-retry-dialog={row.deliverectOrderId}>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-retry-note={row.outcome}>
          <Trans t={t} i18nKey={note} values={{ order: row.channelDisplayId }} components={{ order: <Ltr /> }} />
        </p>
        {inline && (
          <div className="flex flex-col gap-1" data-retry-refusal={inline.code}>
            {inline.code === DELIVERECT_ERRORS.notFailed && <p className="text-xs text-danger-800">{t('retry.notFailed')}</p>}
            <InlineRefusal message={inline.message} code={inline.code} />
          </div>
        )}
        {send.isError && !inline && (
          <ErrorBanner className="p-2" title={t('retry.failed')} message={apiErrorMessage(send.error, t('retry.failedHint'))}>
            {code && (
              <span className="font-mono text-xs" data-retry-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
