import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { RuleCouponBatchDeletion, RuleCouponBatchSummary } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCouponBatchExportKey, ruleCouponBatchesKey, ruleCouponExportsKey } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatNumber } from '@/core/util/number-format'
import { unusedOf } from './coupon-form'
import { Refusal } from './settings-ui'

/**
 * Delete unused (tickets 516, 526; the prototype's "Delete all unused coupons", kept to one batch):
 * the confirmation says, from the batch list's counts, how many codes nobody used and how many were
 * used. HQ (`CouponBatches/DeleteUnused`) deletes the codes nobody ever used — a code ever redeemed,
 * or held by a sale still paying, stays — and answers what it did, which the page reports. A refusal
 * shows here, verbatim.
 */
export default function DeleteUnusedDialog({
  campaignId,
  batch,
  onClose,
  onDeleted,
}: {
  campaignId: string
  /** The batch, as the list last read it. */
  batch: RuleCouponBatchSummary
  onClose: () => void
  onDeleted: (result: RuleCouponBatchDeletion) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => ruleCampaignApi.deleteUnused(batch.batchId),
    // The page hears of it FIRST: the re-read may drop an emptied batch, which unmounts this dialog
    // (a `mutate` callback would then never run). Then the counts and the codes are read afresh.
    // An emptied batch is gone from HQ: its codes are dropped, not read again (HQ would answer 404).
    onSuccess: (result) => {
      onDeleted(result)
      if (!result.kept) queryClient.removeQueries({ queryKey: ruleCouponBatchExportKey(campaignId, result.batchId) })
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ruleCouponBatchesKey(campaignId) }),
        queryClient.invalidateQueries({ queryKey: ruleCouponExportsKey(campaignId) }),
      ])
    },
  })
  const unused = unusedOf(batch)
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
          <Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()} data-coupons-delete-confirm="">
            {remove.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('coupons.deleteUnused.confirm', { count: unused })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-coupons-delete={batch.batchId}>
        <p data-coupons-delete-unused="">
          <Trans
            t={t}
            i18nKey="coupons.deleteUnused.body"
            count={unused}
            values={{ n: formatNumber(unused), batch: batch.batchId }}
            components={{ n: <Ltr />, batch: <bdi dir="ltr" className="font-mono" /> }}
          />
        </p>
        <p className="text-muted-foreground" data-coupons-delete-stay="">
          <Trans t={t} i18nKey="coupons.deleteUnused.stay" count={batch.used} values={{ n: formatNumber(batch.used) }} components={{ n: <Ltr /> }} />
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
