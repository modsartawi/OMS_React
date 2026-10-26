import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode } from '@/core/api'
import ReasonDialog, { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import { fieldRefusal } from '@/core/hungerstation/reason'
import { HUNGERSTATION_ERRORS } from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { ORDERS_KEY, ordersApi } from './api'

/** The order a retry acts on. */
export interface RetryTarget {
  orderId: string
  orderCode: string
}

/** The two refusals shown inline with their own words: no longer failed, and no such order. */
const INLINE = [HUNGERSTATION_ERRORS.notFailed, HUNGERSTATION_ERRORS.noSuchOrder] as const

/**
 * **Retry a failed HungerStation order** (ticket 556; contract `POST Orders/{orderId}/Retry`) —
 * offered only when the row is `retryable`, confirmed on the area's reason dialog with a mandatory
 * reason. The note says it re-runs the order's LATEST run only (the neutral wording the ticket's
 * open question asks for).
 *
 * On success every orders read is refreshed: the row reads `pending` until the worker has run it.
 * DHS-00012 (no longer failed) shows inline and refreshes the row; DHS-00011 shows inline; DHS-00008
 * shows under the reason. The dialog stays open on a refusal.
 */
export default function RetryDialog({ target, onClose }: { target: RetryTarget; onClose: () => void }) {
  const { t } = useTranslation('hungerstation-orders')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: (reason: string) => ordersApi.retry(target.orderId, reason),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ORDERS_KEY })
      const order = fsi(target.orderCode)
      // The contract answers `requeued: true`; a `false` is reported, never dressed up as success.
      if (result?.requeued === false) notify.info(t('retry.notRequeued'), t('retry.notRequeuedDetail', { order }))
      else notify.success(t('retry.done'), t('retry.doneDetail', { order }))
      onClose()
    },
    onError: (err) => {
      if (apiErrorCode(err) === HUNGERSTATION_ERRORS.notFailed) void qc.invalidateQueries({ queryKey: ORDERS_KEY })
    },
  })
  const inline = fieldRefusal(send.error, INLINE, '')

  return (
    <ReasonDialog
      open
      title={t('retry.title')}
      note={<Trans t={t} i18nKey="retry.note" values={{ order: target.orderCode }} components={{ order: <Ltr /> }} />}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('retry.confirm')}
      handledCodes={INLINE}
      // A corrected reason is not still marked with the refusal it was refused for.
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1" data-retry-dialog={target.orderId}>
        {inline && (
          <div className="flex flex-col gap-1" data-retry-refusal={inline.code}>
            <p className="text-xs text-danger-800">{t(inline.code === HUNGERSTATION_ERRORS.notFailed ? 'retry.notFailed' : 'retry.noSuchOrder')}</p>
            <InlineRefusal message={inline.message} code={inline.code} />
          </div>
        )}
      </div>
    </ReasonDialog>
  )
}
