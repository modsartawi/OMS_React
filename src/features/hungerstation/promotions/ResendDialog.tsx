import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode } from '@/core/api'
import ReasonDialog from '@/core/hungerstation/ReasonDialog'
import { HUNGERSTATION_PROMOTION_ERRORS } from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { PROMOTIONS_KEY, promotionKey, promotionsApi } from './api'

/** The part a Resend acts on. */
export interface ResendTarget {
  promotionId: string
  partId: string
  /** The name the part was sent under. */
  name: string
}

/**
 * **Resend one part** (ticket 669; `POST Promotions/{id}/Parts/{partId}/Resend`, BackOffice 3214):
 * the part goes to HungerStation again UNCHANGED, under its identity — for example once the next
 * stock sync has listed a material HungerStation could not find. Confirmed on the area's reason
 * dialog with a mandatory reason.
 *
 * The answer is the detail: it lands in the open sheet at once (the part now reads Sending, so the
 * sheet's light poll takes over), and every promotion read is refreshed. A refusal stays in the
 * dialog with its code; DHS-00017 (the part is Sending after all) also re-reads the detail, so the
 * button turns disabled behind it.
 */
export default function ResendDialog({ target, onClose }: { target: ResendTarget; onClose: () => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: (reason: string) => promotionsApi.resend(target.promotionId, target.partId, { reason }),
    onSuccess: (detail) => {
      qc.setQueryData(promotionKey(target.promotionId), detail)
      void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY })
      notify.success(t('resend.done'), t('resend.doneDetail', { part: fsi(target.name) }))
      onClose()
    },
    onError: (err) => {
      if (apiErrorCode(err) === HUNGERSTATION_PROMOTION_ERRORS.sending) void qc.invalidateQueries({ queryKey: promotionKey(target.promotionId) })
    },
  })

  return (
    <ReasonDialog
      open
      title={t('resend.title')}
      note={<Trans t={t} i18nKey="resend.note" values={{ part: target.name }} components={{ part: <bdi /> }} />}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('resend.confirm')}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <span data-resend-dialog={target.partId} hidden />
    </ReasonDialog>
  )
}
