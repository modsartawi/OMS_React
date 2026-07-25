import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import type { ButtonVariant } from '@/core/ui/Button'
import type { UpdateActionKind } from './actions'
import NoteField from './NoteField'

/**
 * Screen 2 — the note-carrying commands' own confirm dialog (spec 083 D-11,
 * ticket 094).
 *
 * The standing textarea above the action bar is gone; every command that posts a
 * note now captures it **inside its own confirm dialog**, exactly as
 * `RequestCloseDialog` already does for the cancellation reason. One component
 * serves all four because they differ in only two things — whether the note is
 * required, and whether the command is terminal:
 *
 * - **Add Note…** is always enabled on the bar; its emptiness rule lives HERE,
 *   as a disabled confirm, which is the place that can actually enforce it. An
 *   empty note is meaningless in an append-only log.
 * - **Cancel Order · Force Cancel · Withdraw Request** ask for confirmation and
 *   take an OPTIONAL note, which is what they have always posted. Their confirm
 *   restates the command and wears the command's own terminal-tier treatment —
 *   the one button that ends an order should say what it ends.
 *
 * Deleting the standing textarea also deletes `pendingNote`: with nothing on
 * screen to snapshot, the note typed in a dialog is unambiguously the note that
 * posts.
 */

/** The commands whose note this dialog captures. Request Close has its own picker. */
export type NoteCommandKind = Extract<
  UpdateActionKind,
  'add-note' | 'close' | 'force-close' | 'cancel-close-request'
>

/** The terminal pair confirms in red; the other two are ordinary commits. */
const CONFIRM_VARIANT: Record<NoteCommandKind, ButtonVariant> = {
  'add-note': 'primary',
  close: 'danger',
  'force-close': 'danger-outlined',
  'cancel-close-request': 'primary',
}

export default function NoteDialog({
  kind,
  onClose,
  onConfirmed,
}: {
  /**
   * The pending command, or `null` when none is — which is also what closes the
   * dialog. One field, so an open dialog can never be in the "open with no
   * command" state a separate `open` flag would allow.
   */
  kind: NoteCommandKind | null
  onClose: () => void
  onConfirmed: (kind: NoteCommandKind, note: string) => void
}) {
  const { t } = useTranslation('document')
  const [note, setNote] = useState('')

  const required = kind === 'add-note'
  const trimmed = note.trim()
  const canSubmit = kind !== null && (!required || trimmed.length > 0)

  function submit() {
    if (kind === null || !canSubmit) return
    onConfirmed(kind, trimmed)
    onClose()
  }

  // The bar's label ends in an ellipsis to say "this opens a dialog"; once the
  // dialog IS open the ellipsis has nothing left to promise, so Add Note takes
  // its own title key rather than reusing the command label.
  const title = kind === null ? '' : required ? t('note.title') : t(`actions.${kind}`)

  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      title={title}
      width="27rem"
      // Clear the previous text on every open — a note carried over from a
      // dismissed dialog would be one careless click from being posted.
      onShow={() => setNote('')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          <Button
            variant={kind === null ? 'primary' : CONFIRM_VARIANT[kind]}
            disabled={!canSubmit}
            onClick={submit}
          >
            {title}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {required ? (
          <p className="text-[0.8125rem] text-muted-foreground">{t('note.hintRequired')}</p>
        ) : (
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden />
            <span>{t('confirm.message')}</span>
          </p>
        )}
        <NoteField id="command-note" value={note} onChange={setNote} required={required} />
      </div>
    </Modal>
  )
}
