/**
 * A prescription that already has an open order, confirmed before submit (ticket 1009, spec 1006
 * D5).
 *
 * A **body**, not a mechanism, like `BelowAtpConfirm`: the modal, the two buttons and their order,
 * the re-issue notice and the failure line are `ConfirmSheet`'s. All this draws is the sentence
 * naming the open order.
 *
 * 🚩 **Nothing focusable in the body.** The native dialog focuses its first focusable element,
 * which must stay *Go back* — so Enter never confirms (ticket 153's keyboard grammar), and Esc is
 * *Go back* through the sheet's own close.
 */
import { useTranslation } from 'react-i18next'
import { activePrescriptionCopy, type ActivePrescriptionAsk } from './active-prescription'
import ConfirmSheet, { type PreviewReissue } from './ConfirmSheet'
import { NOTE } from './console-notes'

export default function ActivePrescriptionConfirm({
  ask,
  reissue,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  /** `null` closes the sheet — the ask IS the open state. */
  ask: ActivePrescriptionAsk | null
  reissue: PreviewReissue | null
  busy: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('callcenter')
  const copy = ask ? activePrescriptionCopy(ask, t) : null
  return (
    <ConfirmSheet
      open={ask !== null}
      marker="activePrescription"
      title={copy?.title ?? ''}
      reissue={reissue}
      busy={busy}
      error={error}
      keepLabel={copy?.keep ?? ''}
      confirmLabel={copy?.confirm ?? ''}
      busyLabel={copy?.working ?? ''}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {copy && (
        <>
          <p data-cc-active-prescription-body {...(ask?.documentNo ? { 'data-cc-active-prescription-order': ask.documentNo } : {})}>
            {copy.body}
          </p>
          <p className={NOTE.attention} data-cc-active-prescription-note>
            {t('activePrescription.note')}
          </p>
        </>
      )}
    </ConfirmSheet>
  )
}
