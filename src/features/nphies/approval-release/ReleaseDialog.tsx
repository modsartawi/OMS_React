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
import { RELEASE_SUFFIX, canConfirmRelease, refusalKey } from './release-rules'

/**
 * The release's one question, a **note**, and its confirmation step (ticket 751, spec 3342
 * stories 5–6). It names the approval number it is about to change and what it becomes.
 *
 * A refusal renders HERE, not as a toast: the modal is a native `showModal()` dialog in the
 * browser's top layer, so a toast raised while it is open sits under the scrim (the
 * `CancelDialog` precedent). The dialog stays open so the agent reads it beside the act.
 */
export interface ReleaseDialogProps {
  /** The approval number as it stands; `null` = closed. */
  approvalNumber: string | null
  busy: boolean
  error: unknown
  onClose: () => void
  onConfirm: (note: string) => void
}

export default function ReleaseDialog({ approvalNumber, busy, error, onClose, onConfirm }: ReleaseDialogProps) {
  const { t } = useTranslation('approval-release')
  const [note, setNote] = useState('')
  const ready = canConfirmRelease(note, busy)
  const blank = note.trim() === ''
  const refusal = error ? refusalKey(error) : null

  return (
    <Modal
      open={approvalNumber !== null}
      onClose={onClose}
      title={t('dialog.title')}
      // Every open starts blank: a note carried over from the last release would put the last
      // case's reason on this one's log row.
      onShow={() => setNote('')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('dialog.back')}
          </Button>
          <Button
            variant="danger"
            aria-disabled={!ready}
            title={blank ? t('dialog.noteRequired') : undefined}
            onClick={() => ready && onConfirm(note)}
            data-testid="release-confirm"
          >
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {t('dialog.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {/* A value interpolated into a t() sentence is isolated whole with fsi (bidi rule). */}
        <p>
          {t('dialog.body', {
            approvalNumber: fsi(approvalNumber ?? ''),
            released: fsi(`${approvalNumber ?? ''}${RELEASE_SUFFIX}`),
          })}
        </p>

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
            data-testid="release-note"
          />
        </Field>
      </div>
    </Modal>
  )
}
