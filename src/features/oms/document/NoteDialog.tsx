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
 * note with its act captures it **inside its own confirm dialog**, exactly as
 * `RequestCloseDialog` already does for the cancellation reason.
 *
 * **Cancel Order · Force Cancel · Withdraw Request** ask for confirmation and
 * take an OPTIONAL note, which is what they have always posted. Their confirm
 * restates the command and wears the command's own terminal-tier treatment —
 * the one button that ends an order should say what it ends.
 *
 * **Add Note… is not here any more** (spec 380 D8, ticket 405): it posts from the
 * composer at the spine's Now line, which amends D-11 for Add note only. The
 * other commands keep their notes in here, so the composer's text is only ever
 * Add note's and `pendingNote`'s ambiguity does not come back.
 */

/** The commands whose note this dialog captures. Request Close has its own picker. */
export type NoteCommandKind = Extract<UpdateActionKind, 'close' | 'force-close' | 'cancel-close-request'>

/** The terminal pair confirms in red; Withdraw Request is an ordinary commit. */
const CONFIRM_VARIANT: Record<NoteCommandKind, ButtonVariant> = {
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

  function submit() {
    if (kind === null) return
    onConfirmed(kind, note.trim())
    onClose()
  }

  const title = kind === null ? '' : t(`actions.${kind}`)

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
            disabled={kind === null}
            onClick={submit}
          >
            {title}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="flex items-start gap-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden />
          <span>{t('confirm.message')}</span>
        </p>
        <NoteField id="command-note" value={note} onChange={setNote} />
      </div>
    </Modal>
  )
}
