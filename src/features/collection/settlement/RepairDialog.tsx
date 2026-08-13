import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import type { SettlementOrphanRow } from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { formatDateTime } from '@/core/util/date-format'
import { settlementApi } from './api'
/** What a reason may carry — the same 200 the posted entry's reason takes (D4), so
 *  an accountant never learns two limits for two boxes on one screen. It is one
 *  constant in `posting.ts` because two that must agree eventually will not. */
import { REASON_MAX } from './posting'

/**
 * **Repair** — the wrong-money lane's action, and 🚩 **the only write on this
 * screen** (ticket 270; posting is 271's and correction 272's).
 *
 * It puts back money a branch handed over against a close that never completed:
 * the consumption exists, its document does not, and the entry it was taken from
 * is short by that amount.
 *
 * 🔑 **A no-op is not a failure, and this dialog's whole shape follows from that.**
 * The server's guard lives inside its UPDATE and is predicated on the consumption
 * *still* having no document — so a late Z arriving mid-click wins the race, and
 * the honest report is *"a document arrived for this consumption — nothing to
 * repair"*, said plainly, with the lane refreshed underneath. An error toast there
 * would be telling an accountant something went wrong when the system had just
 * healed itself.
 *
 * ⚠️ A refusal (`accepted: false`) is likewise a **200 carrying a reason**, exactly
 * as the till's own consume is (D8). Nothing here treats a business outcome as an
 * exception; `@/core/api` still owns the ones that genuinely are.
 */
export default function RepairDialog({
  row,
  onClose,
  onDone,
}: {
  row: SettlementOrphanRow | null
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation('settlement')
  const [reason, setReason] = useState('')

  // A fresh reason per row: a sentence written about 0331's 150.000 must not be
  // sitting in the box when the next orphan is opened.
  useEffect(() => setReason(''), [row?.settlementConsumptionId])

  const repair = useMutation({
    mutationFn: () => settlementApi.repair(row!.settlementConsumptionId, reason.trim()),
    onSuccess: (result) => {
      if (result?.noOp) {
        // 🔑 The race, lost — and said as the good news it is.
        toast.info(t('repair.noOp'))
      } else if (result?.accepted) {
        toast.success(
          t('repair.done', {
            amount: formatMoneyIn(row?.amount, row?.currencyKey),
            store: row?.storeId ?? '',
          }),
        )
      } else {
        // A refusal the server explained — its own words, passed through as data.
        toast.warning(result?.refusalReason || t('repair.refused'))
      }
      onDone()
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('repair.failed'))),
  })

  if (!row) return null
  const canRepair = reason.trim().length > 0 && !repair.isPending

  return (
    <Modal
      open
      onClose={onClose}
      title={t('repair.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('repair.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => canRepair && repair.mutate()}
            aria-disabled={!canRepair || undefined}
            data-testid="repair-confirm"
          >
            {t('repair.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <p>
          {t('repair.summary', {
            amount: formatMoneyIn(row.amount, row.currencyKey),
            store: row.storeId,
            storeName: row.storeName,
            entry: row.entryNumber,
            days: row.ageDays,
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('repair.consumedAt', { at: formatDateTime(row.consumedAt) })}
        </p>
        {/* ⚠️ Stated before the act, not discovered after it: the server may find a
            document has since arrived, in which case this button does nothing at
            all — which is the correct outcome and not a failed repair. */}
        <p className="text-xs text-muted-foreground">{t('repair.raceHint')}</p>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t('repair.reasonLabel')}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={REASON_MAX}
            rows={3}
            data-testid="repair-reason"
            className="rounded-md border border-border bg-card p-2 text-sm outline-none focus:border-primary/60"
          />
          {/* The reason is required because the repair is an audit act — 272's pane
              renders it in the branch's column of time, and *"repaired, no reason
              given"* is a row that will be read months later by someone who was not
              here. */}
          <span className="text-xs text-muted-foreground">{t('repair.reasonHint')}</span>
        </label>
      </div>
    </Modal>
  )
}
