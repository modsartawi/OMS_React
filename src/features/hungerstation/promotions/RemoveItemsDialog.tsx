import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { apiErrorCode } from '@/core/api'
import ReasonDialog from '@/core/hungerstation/ReasonDialog'
import { HUNGERSTATION_PROMOTION_ERRORS } from '@/core/models/hungerstation'
import Ltr from '@/core/ui/Ltr'
import { formatFigure as figure } from '@/core/util/number-format'
import { PROMOTIONS_KEY, promotionKey, promotionsApi } from './api'

/** The refusals after which the open detail no longer holds: re-read it, so the page locks behind. */
const STALE = [HUNGERSTATION_PROMOTION_ERRORS.sending, HUNGERSTATION_PROMOTION_ERRORS.promotionSent] as const

/**
 * 670: **Remove items** — `POST …/RemoveItems { materialNumbers, reason }` (BackOffice 3215). The
 * answer is the plain detail: the items read Removed (still listed), their parts re-send. A refusal
 * stays in the dialog with its code; DHS-00017 (a part is Sending) and `HungerStationPromotionSent`
 * (switched off or replaced meanwhile) also re-read the detail, so the bar locks behind them.
 */
export default function RemoveItemsDialog({
  promotionId,
  materialNumbers,
  onDone,
  onClose,
}: {
  promotionId: string
  materialNumbers: string[]
  onDone: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: (reason: string) => promotionsApi.removeItems(promotionId, { materialNumbers, reason }),
    onSuccess: (answer) => {
      qc.setQueryData(promotionKey(promotionId), answer)
      void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY, predicate: (q) => q.queryKey[2] !== 'detail' })
      onDone()
    },
    onError: (err) => {
      if ((STALE as readonly (string | null)[]).includes(apiErrorCode(err))) void qc.invalidateQueries({ queryKey: promotionKey(promotionId) })
    },
  })
  return (
    <ReasonDialog
      open
      title={t('detail.removeTitle')}
      note={<Trans t={t} i18nKey="detail.removeNote" count={materialNumbers.length} values={{ n: figure(materialNumbers.length) }} components={{ n: <Ltr /> }} />}
      busy={remove.isPending}
      error={remove.error}
      confirmLabel={t('detail.removeConfirm')}
      danger
      onEdit={() => remove.reset()}
      onConfirm={(reason) => remove.mutate(reason)}
      onClose={onClose}
    >
      <span data-promotion-remove-dialog={materialNumbers.length} hidden />
    </ReasonDialog>
  )
}
