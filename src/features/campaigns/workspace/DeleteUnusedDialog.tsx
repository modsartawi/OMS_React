import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { RuleCouponStatus, RuleCouponUnusedDeleted } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCouponsKey } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatNumber } from '@/core/util/number-format'
import { Refusal } from './settings-ui'

/**
 * Delete unused (ticket 516; the prototype's "Delete all unused coupons", kept to one batch): the
 * confirmation says how many unused codes go and how many codes stay, by status, as the list last
 * read them. HQ deletes the batch's unused codes only — a used, disabled or expired code stays for
 * the history — and answers what it did, which the page reports. A refusal shows here, verbatim.
 */
export default function DeleteUnusedDialog({
  campaignId,
  batch,
  counts,
  onClose,
  onDeleted,
}: {
  campaignId: string
  batch: string
  /** The batch's codes by status, as the list last read them. */
  counts: Record<RuleCouponStatus, number>
  onClose: () => void
  onDeleted: (result: RuleCouponUnusedDeleted) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => ruleCampaignApi.deleteUnusedCoupons(campaignId, batch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleCouponsKey(campaignId) }),
  })
  const stay = counts.used + counts.disabled + counts.expired
  const close = () => {
    if (!remove.isPending) onClose()
  }

  return (
    <Modal
      open
      onClose={close}
      title={t('coupons.deleteUnused.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" disabled={remove.isPending} onClick={close}>
            {t('coupons.deleteUnused.cancel')}
          </Button>
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate(undefined, { onSuccess: onDeleted })} data-coupons-delete-confirm="">
            {remove.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('coupons.deleteUnused.confirm', { count: counts.unused })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-coupons-delete={batch}>
        <p data-coupons-delete-unused="">
          <Trans
            t={t}
            i18nKey="coupons.deleteUnused.body"
            count={counts.unused}
            values={{ n: formatNumber(counts.unused), batch }}
            components={{ n: <Ltr />, batch: <bdi dir="ltr" className="font-mono" /> }}
          />
        </p>
        <p className="text-muted-foreground" data-coupons-delete-stay="">
          <Trans
            t={t}
            i18nKey="coupons.deleteUnused.stay"
            count={stay}
            values={{ n: formatNumber(stay), used: formatNumber(counts.used), disabled: formatNumber(counts.disabled), expired: formatNumber(counts.expired) }}
            components={{ n: <Ltr />, used: <Ltr />, disabled: <Ltr />, expired: <Ltr /> }}
          />
        </p>
        {remove.isError && (
          <div data-coupons-delete-refusal="">
            <Refusal title={t('coupons.deleteUnused.refusedTitle')} fallback={t('coupons.deleteUnused.refused')} error={remove.error} />
          </div>
        )}
      </div>
    </Modal>
  )
}
