/**
 * The one confirmation that stands in front of every abandon (ticket 163, US6).
 *
 * There is deliberately **one** of these, shared by both paths: the abandon on
 * the already-open screen and the abandon from inside a live order are the same
 * act, so they get the same sentence and the same two buttons. A second dialog
 * with different wording would be two acts wearing one name, and the agent would
 * have to learn both.
 *
 * What it owes the agent is the thing a bare "Are you sure?" withholds: **what
 * is being thrown away**, named — whose call it was and how many lines are in
 * it. That is why it takes an `AbandonTarget` rather than a boolean.
 *
 * 🚩 The dismissing action is the DEFAULT one. Escape, the backdrop and *Keep
 * it* all cancel; abandoning takes a deliberate click on the one destructive
 * button in the dialog. A mis-click must not void a basket (US6).
 */
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import type { AbandonTarget } from './open-outcome'

export default function AbandonConfirm({
  target,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  /** `null` closes the dialog — the target IS the open state. */
  target: AbandonTarget | null
  busy: boolean
  /** A failed abandon, already turned into agent-facing text by the caller. */
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('callcenter')
  return (
    <Modal
      open={target !== null}
      // A dismissal while the void is in flight would leave the screen claiming
      // an order that may be gone. The request settles either way, so the dialog
      // holds until it does.
      onClose={() => !busy && onCancel()}
      title={t('abandon.title')}
      width="26rem"
      footer={
        <>
          <Button variant="text" onClick={onCancel} disabled={busy} data-cc-abandon-cancel>
            {t('abandon.keep')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy} data-cc-abandon-confirm>
            {busy ? t('abandon.working') : t('abandon.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm" data-cc-abandon-dialog>
        <p>
          {target?.customerName
            ? t('abandon.bodyNamed', { name: target.customerName })
            : t('abandon.bodyAnonymous')}
        </p>
        {/* The cost, stated. A line count is what "five minutes of work" looks
            like from here; an amount would be money the console did not compute. */}
        <p className="text-muted-foreground" data-cc-abandon-cost>
          {t('abandon.cost', { count: target?.lineCount ?? 0 })}
        </p>
        {error && (
          <p className="rounded-md border border-danger-border bg-danger-050 p-2 text-danger-800" data-cc-abandon-error>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
