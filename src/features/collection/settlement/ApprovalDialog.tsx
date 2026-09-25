import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { apiErrorMessage } from '@/core/api'
import { COLLECTION_ACCESS_KEY } from '@/core/collection/api'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { formatDateTime } from '@/core/util/date-format'
import { settlementApi } from './api'
import {
  afterSupervision,
  supervisionFailure,
  type ApprovalTarget,
  type SupervisionAct,
} from './approval'
import { entryKindLabel, entryStatusLabel } from './entry-cells'
import { settlementMoney } from './money-display'
import { REASON_MAX } from './posting'
import ReasonField, { invalidateSettlement } from './ReasonField'

/** What the dialog is open on — the entry, and which of the two acts was pressed. */
export type ApprovalRequest = { target: ApprovalTarget; act: SupervisionAct }

/** What an act is sent WITH — captured at the press, so a queue that refetches under
 *  the dialog cannot change which entry the answer is reported against. */
type ActVars = ApprovalRequest & { reason: string }

/**
 * **Approve or reject a pending surplus** — ticket 309, BackOffice 1977 / 1978.
 *
 * 🔑 **One dialog, opened from either place a supervisor meets a pending entry**: a row
 * of the *Awaiting approval* queue, or the entry's panel on its branch account. Both
 * hand it the same `ApprovalTarget`, so what is shown before the press cannot differ
 * by where the press happened.
 *
 * 🔑 **What is being authorised is on screen before the button** (story 9) — the
 * amount, the branch, the accountant who posted it and the description the branch
 * will read. Approving puts that money in a till's reach at the branch's next close.
 *
 * ⚠️ **Reject needs a reason, and the reason is the accountant's to read** — a blank
 * one is refused here before the call and by the server after it
 * (`SettlementRejectReasonRequired`); the box stops at the server's 200. It is final:
 * the dialog says so, because a supervisor who expects to *un-reject* later would
 * reject more lightly.
 *
 * 🚩 **A refusal is a 200 and reads as news, not as failure**: *somebody got there
 * first* is the ordinary case on a queue two supervisors work. A bare 403 means the
 * grant went between the page's probe and the press — it is said as that, and the
 * probe is re-read so the buttons go away.
 */
export default function ApprovalDialog({
  request,
  onClose,
}: {
  request: ApprovalRequest | null
  onClose: () => void
}) {
  const { t } = useTranslation('settlement')
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  // A fresh box per entry and per act: a reason typed about 1202 must not be sitting in
  // it when 1203 is opened.
  const key = request ? `${request.target.settlementEntryId}:${request.act}` : ''
  useEffect(() => setReason(''), [key])

  const decide = useMutation({
    mutationFn: (v: ActVars) =>
      v.act === 'approve'
        ? settlementApi.approve(v.target.settlementEntryId)
        : settlementApi.reject(v.target.settlementEntryId, v.reason),
    onSuccess: (result, v) => {
      // Always: whatever the answer, the entry's state is the server's now, and the
      // queue, the account and the open lane must read it again.
      invalidateSettlement(queryClient, v.target.storeId)
      const number = v.target.entryNumber
      const outcome = afterSupervision(v.act, result)
      switch (outcome.kind) {
        case 'done':
          toast.success(t(`approval.done.${outcome.act}`, { number }))
          break
        case 'decided':
          toast.warning(t('approval.decided', { number, status: entryStatusLabel(t, outcome.status) }))
          break
        case 'gone':
          toast.warning(t('approval.gone', { number }))
          break
        case 'refused':
          toast.warning(t('approval.refused', { number, code: outcome.reason }))
          break
      }
      onClose()
    },
    onError: (error) => {
      if (supervisionFailure(error) === 'forbidden') {
        toast.error(t('approval.errors.forbidden'))
        // The probe is read once per page life (`staleTime: Infinity`); re-reading it
        // is what takes the buttons away from a session that no longer holds the grant.
        void queryClient.invalidateQueries({ queryKey: COLLECTION_ACCESS_KEY })
        onClose()
        return
      }
      // ⚠️ The dialog stays open with the reason still in it — a 400 for an over-long
      // or blank reason is the server's own sentence, and throwing away what was typed
      // would make the supervisor write it twice.
      toast.error(apiErrorMessage(error, t('approval.errors.failed')))
    },
  })

  if (!request) return null
  const { target, act } = request
  const money = settlementMoney(target.amount, target.currencyKey)
  const canCommit = (act === 'approve' || reason.trim().length > 0) && !decide.isPending

  return (
    <Modal
      open
      onClose={onClose}
      title={t(`approval.${act}.title`, { number: target.entryNumber })}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('approval.cancel')}
          </Button>
          <Button
            variant={act === 'approve' ? 'primary' : 'danger'}
            // 🚩 Guarded here AND by `aria-disabled`: a second press while the first is
            // in flight must not send a second act. The server's predicated update would
            // refuse it — but as a warning about a decision this supervisor just made.
            onClick={() => canCommit && decide.mutate({ target, act, reason: reason.trim() })}
            aria-disabled={!canCommit || undefined}
            data-testid="approval-commit"
            data-act={act}
          >
            {t(`approval.${act}.commit`, { number: target.entryNumber })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-region="approval-dialog" data-entry={target.entryNumber}>
        {/* 🔑 Story 9, in the order it is read out: the money, the branch, who posted it,
            and what the branch will read. */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-xs text-muted-foreground">{t('approval.fields.amount')}</dt>
          <dd className="tabular-nums" data-testid="approval-amount">
            {t('approval.amountLine', { amount: money, currency: target.currencyKey, kind: entryKindLabel(t, target.entryKind) })}
          </dd>
          <dt className="text-xs text-muted-foreground">{t('approval.fields.branch')}</dt>
          <dd className="flex items-baseline gap-1.5">
            <span>{target.storeName}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{target.storeId}</span>
          </dd>
          <dt className="text-xs text-muted-foreground">{t('approval.fields.postedBy')}</dt>
          <dd>
            {t('approval.postedLine', { name: target.postedByName, at: formatDateTime(target.postedAt) })}
          </dd>
          <dt className="text-xs text-muted-foreground">{t('approval.fields.reason')}</dt>
          {/* Server text the branch reads verbatim — unlocalised, and routinely Arabic. */}
          <dd dir="auto" data-testid="approval-reason-shown">
            {target.reason}
          </dd>
        </dl>

        <p className="text-muted-foreground">{t(`approval.${act}.explain`)}</p>

        {act === 'reject' && (
          <ReasonField
            value={reason}
            onValue={setReason}
            label={t('approval.reject.reasonLabel')}
            hint={t('approval.reject.reasonHint', { max: REASON_MAX })}
            testId="approval-reason"
          />
        )}
      </div>
    </Modal>
  )
}
