import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode } from '@/core/api'
import ReasonDialog from '@/core/hungerstation/ReasonDialog'
import { HUNGERSTATION_PROMOTION_ERRORS, type HungerStationPromotionDetail } from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { PROMOTIONS_KEY, promotionKey, promotionsApi } from './api'

/**
 * **Switch off** the whole promotion (ticket 671; `POST Promotions/{id}/SwitchOff { reason }`,
 * BackOffice 3216): every part goes to HungerStation `active: false` at once. Nothing is deleted —
 * the promotion, its items and its sends stay, and it reads Switched off. Confirmed in words on the
 * area's reason dialog, on the danger button.
 *
 * The answer is the detail: it lands in the open sheet at once and every promotion read is
 * refreshed. A refusal stays in the dialog with its code; DHS-00017 (a part is Sending after all)
 * also re-reads the detail, so the button turns disabled behind it.
 */
export default function SwitchOffDialog({ promotion, onClose }: { promotion: HungerStationPromotionDetail; onClose: () => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  const qc = useQueryClient()
  const id = promotion.promotionId
  const off = useMutation({
    mutationFn: (reason: string) => promotionsApi.switchOff(id, { reason }),
    onSuccess: (detail) => {
      qc.setQueryData(promotionKey(id), detail)
      void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY, predicate: (q) => q.queryKey[2] !== 'detail' || q.queryKey[3] !== id })
      notify.success(t('switchOff.done'), t('switchOff.doneDetail', { name: fsi(promotion.name) }))
      onClose()
    },
    onError: (err) => {
      if (apiErrorCode(err) === HUNGERSTATION_PROMOTION_ERRORS.sending) void qc.invalidateQueries({ queryKey: promotionKey(id) })
    },
  })

  return (
    <ReasonDialog
      open
      danger
      title={t('switchOff.title')}
      note={<Trans t={t} i18nKey="switchOff.note" values={{ name: promotion.name }} components={{ name: <bdi /> }} />}
      busy={off.isPending}
      error={off.error}
      confirmLabel={t('switchOff.confirm')}
      onEdit={() => off.reset()}
      onConfirm={(reason) => off.mutate(reason)}
      onClose={onClose}
    >
      <span data-switch-off-dialog={id} hidden />
    </ReasonDialog>
  )
}
