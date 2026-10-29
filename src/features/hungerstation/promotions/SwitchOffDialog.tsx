import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode } from '@/core/api'
import ReasonDialog from '@/core/hungerstation/ReasonDialog'
import { HUNGERSTATION_ERRORS, HUNGERSTATION_PROMOTION_ERRORS, type HungerStationPromotionDetail } from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { PROMOTIONS_KEY, promotionKey, promotionsApi } from './api'

/** After these the open detail no longer holds: a part switched off anyway (DHS-00014 names the
 *  part that was not), a part Sending, or the promotion closed meanwhile. */
const STALE: readonly (string | null)[] = [HUNGERSTATION_ERRORS.hungerStationFailed, HUNGERSTATION_PROMOTION_ERRORS.sending, HUNGERSTATION_PROMOTION_ERRORS.promotionSent]

/**
 * **Switch off** the whole promotion (ticket 671; `POST Promotions/{id}/SwitchOff { reason }`,
 * BackOffice 3216): every active part goes to HungerStation `active: false`. Nothing is deleted;
 * it reads Sending until HungerStation has switched off every part, then Switched off. Confirmed in
 * words on the area's reason dialog, on the danger button.
 *
 * `retry`: a switch-off that did not take (the promotion reads Failed once switched off or
 * replaced) — the same door retries exactly the parts still on HungerStation.
 *
 * A refused part answers DHS-00014 naming it — the others WERE switched off — so the dialog keeps
 * the message, says so, and the detail is re-read. DHS-00017 and `HungerStationPromotionSent` also
 * re-read it, so the button turns disabled or goes behind them.
 */
export default function SwitchOffDialog({ promotion, retry = false, onClose }: { promotion: HungerStationPromotionDetail; retry?: boolean; onClose: () => void }) {
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
      if (STALE.includes(apiErrorCode(err))) void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY })
    },
  })
  const partly = apiErrorCode(off.error) === HUNGERSTATION_ERRORS.hungerStationFailed

  return (
    <ReasonDialog
      open
      danger
      title={t('switchOff.title')}
      note={<Trans t={t} i18nKey={retry ? 'switchOff.retryNote' : 'switchOff.note'} values={{ name: promotion.name }} components={{ name: <bdi /> }} />}
      busy={off.isPending}
      error={off.error}
      confirmLabel={t(retry ? 'detail.switchOffAgain' : 'switchOff.confirm')}
      onEdit={() => off.reset()}
      onConfirm={(reason) => off.mutate(reason)}
      onClose={onClose}
    >
      <span data-switch-off-dialog={id} hidden />
      {partly && (
        <p role="alert" className="text-xs text-attention-800" data-switch-off-partly="">
          {t('switchOff.partly')}
        </p>
      )}
    </ReasonDialog>
  )
}
