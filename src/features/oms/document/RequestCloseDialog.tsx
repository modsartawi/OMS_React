import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { CANCEL_REASONS } from '@/core/constants/cancel-reasons'

/**
 * Screen 2 — Request Close cancellation-reason picker.
 *
 * The reason the operator picks becomes the `note` on the Request Close call —
 * there are no codes (Risk R-2: the canonical list has no SIS.Api endpoint yet).
 *
 * The dialog IS the confirmation for the action: it opens directly from the
 * command panel with no pre-confirm, and its primary button commits (D-20).
 */
export default function RequestCloseDialog({
  open,
  onClose,
  onConfirmed,
}: {
  open: boolean
  onClose: () => void
  onConfirmed: (reason: string) => void
}) {
  const { t } = useTranslation('document')
  const [reason, setReason] = useState('')

  function submit() {
    const picked = reason.trim()
    if (!picked) return
    onConfirmed(picked)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('actions.request-close')}
      width="27rem"
      // Clear the previous pick on every open — a reason carried over from a
      // dismissed dialog would be one careless click from being posted.
      onShow={() => setReason('')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          <Button variant="primary" disabled={!reason} onClick={submit}>
            <Flag className="h-3.5 w-3.5" aria-hidden />
            {t('actions.request-close')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-[0.8125rem] text-muted-foreground">{t('requestClose.hint')}</p>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="request-close-reason">
            {t('requestClose.label')}
          </label>
          <select
            id="request-close-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-[0.8125rem]"
          >
            <option value="">{t('requestClose.placeholder')}</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  )
}
