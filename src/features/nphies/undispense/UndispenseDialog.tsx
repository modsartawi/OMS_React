import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { canConfirmUndispense, undispenseRefusalKey } from './undispense-rules'

/**
 * The manual undispense's one question, a **note**, and its confirmation (ticket 898, BackOffice
 * spec 3208 story 7). Confirm stays disabled while the note is blank.
 *
 * A refusal renders HERE, not as a toast: the modal is a native `showModal()` dialog in the top
 * layer, so a toast raised while it is open would sit under the scrim (the `CancelDialog` and
 * `ReleaseDialog` precedent). The dialog stays open so the agent reads it beside the act.
 */
export interface UndispenseDialogProps {
  /** The authorization it is about; `null` = closed. */
  authId: string | null
  busy: boolean
  error: unknown
  onClose: () => void
  onConfirm: (note: string) => void
}

export default function UndispenseDialog({ authId, busy, error, onClose, onConfirm }: UndispenseDialogProps) {
  const { t } = useTranslation('undispense')
  const [note, setNote] = useState('')
  const ready = canConfirmUndispense(note, busy)
  const blank = note.trim() === ''
  const refusal = error ? undispenseRefusalKey(error) : null

  return (
    <Modal
      open={authId !== null}
      onClose={onClose}
      title={t('dialog.title')}
      // Every open starts blank: the last case's reason must not land on this one's row.
      onShow={() => setNote('')}
      width="28rem"
      dismissable={!busy}
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy}>
            {t('dialog.back')}
          </Button>
          <Button
            variant="danger"
            aria-disabled={!ready}
            title={blank ? t('dialog.noteRequired') : undefined}
            onClick={() => ready && onConfirm(note)}
            data-testid="undispense-confirm"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {t('dialog.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {/* A value interpolated into a t() sentence is isolated whole with fsi (bidi rule). */}
        <p>{t('dialog.body', { authId: fsi(authId ?? '') })}</p>

        {error !== null && error !== undefined && (
          <ErrorBanner
            title={t('dialog.refused')}
            // The page's own sentence for a code it knows; the server's own otherwise.
            message={refusal ? t(refusal) : apiErrorMessage(error, t('dialog.refused'))}
            className="p-2"
          />
        )}

        <Field label={t('dialog.note')} hint={blank ? t('dialog.noteRequired') : undefined}>
          <Textarea
            rows={3}
            className="w-full"
            value={note}
            placeholder={t('dialog.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            dir="auto"
            data-testid="undispense-note"
          />
        </Field>
      </div>
    </Modal>
  )
}
