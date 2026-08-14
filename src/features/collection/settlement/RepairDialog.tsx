import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { apiErrorMessage } from '@/core/api'
import type { SettlementOrphanRow } from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { formatDateTime } from '@/core/util/date-format'
import { settlementMoney } from './money-display'
import { settlementApi } from './api'
/** 🚩 The box itself, shared since 272 extracted it at its third copy — which is
 *  also where the 200-character limit lives (`posting.ts`'s `REASON_MAX`, D4), so
 *  an accountant never learns two limits for two boxes on one screen. */
import ReasonField from './ReasonField'

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
            // 🔑 **The server's own restored figure, not the lane row's.** 274 found
            // the repair answers `amount` — what actually went back onto the entry —
            // which is the honest thing to read back after an act.
            amount: settlementMoney(result.amount, ''),
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
          {/* ⚠️ **Four of this sentence's six facts were not on the wire.** 270 named
              the branch, its entry number and an age in days; `Settlement/Orphans`
              answers a consumption row and none of those (274 §B2). What is left is
              what the lane can actually act on — the money and the branch code — and
              the timestamp below carries the age at better resolution than a day
              count did. */}
          {t('repair.summary', {
            amount: settlementMoney(row.amount, ''),
            store: row.storeId,
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('repair.consumedAt', { at: formatDateTime(row.consumedAt) })}
        </p>
        {/* ⚠️ Stated before the act, not discovered after it: the server may find a
            document has since arrived, in which case this button does nothing at
            all — which is the correct outcome and not a failed repair. */}
        <p className="text-xs text-muted-foreground">{t('repair.raceHint')}</p>

        {/* The reason is required because the repair is an audit act — 272's pane
            renders it in the branch's column of time, and *"repaired, no reason
            given"* is a row that will be read months later by someone who was not
            here. 🚩 The control is `ReasonField`'s since 272 extracted it at its
            third copy; this one gained `dir="auto"` in the move, which it should
            have had all along (these reasons are routinely Arabic). */}
        <ReasonField
          value={reason}
          onValue={setReason}
          label={t('repair.reasonLabel')}
          hint={t('repair.reasonHint')}
          testId="repair-reason"
        />
      </div>
    </Modal>
  )
}
