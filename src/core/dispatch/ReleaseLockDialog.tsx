import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { RELEASE_REASONS, type ReleaseLockResult } from '@/core/models/dispatch-board'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { dispatchApi } from './access'
import { releaseForm, releaseRefusal } from './release'

/**
 * Release lock (BackOffice 2959, oms ticket 541) — the ONE dialog that releases a locked competed
 * delivery. The board's inspector (541) opens it, and Delivery details' action (542) reuses it, so it
 * lives in `@/core/` and speaks in the `dispatch-board` namespace (the `central-invoice` precedent:
 * a core dialog speaks in the namespace of the feature it was born in).
 *
 * It owns its write: a reason from the four the door knows, and for `Other` a note. Confirm stays
 * disabled until `releaseForm` says the form may be sent. A refusal (`CALLOUT-102/103/104`) shows in
 * the dialog in its own sentence with its code; any other failure shows the server's message. The
 * dialog stays open on a refusal so nothing typed is lost. One-way: there is no undo, and it says so.
 *
 * The caller is told of the release (`onReleased`) and refreshes what it shows; the move to another
 * store is the existing Change store on Delivery details, never part of this dialog.
 */
export default function ReleaseLockDialog({
  open,
  deliveryNumber,
  heldBy,
  onClose,
  onReleased,
}: {
  open: boolean
  deliveryNumber: string
  /** The store the lock holds the delivery at (the winner, else the fallback store), for the sentence. */
  heldBy: string
  onClose: () => void
  onReleased: (result: ReleaseLockResult) => void
}) {
  const { t } = useTranslation('dispatch-board')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const form = releaseForm({ reason, note }, deliveryNumber)
  const release = useMutation({
    mutationFn: () => dispatchApi.releaseLock(form.body!),
    onSuccess: (result) => onReleased(result),
  })
  const busy = release.isPending
  const refusal = release.isError ? releaseRefusal(release.error) : null
  const code = release.isError ? apiErrorCode(release.error) : null
  const edit = () => release.isError && release.reset()

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      onShow={() => {
        setReason('')
        setNote('')
        release.reset()
      }}
      title={t('release.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-release-cancel="">
            {t('release.cancel')}
          </Button>
          <Button variant="danger" disabled={!form.ready || busy} onClick={() => form.ready && release.mutate()} data-release-confirm="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('release.sending') : t('release.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-release-dialog={deliveryNumber}>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-release-note-text="">
          <Trans
            t={t}
            i18nKey={heldBy ? 'release.explainHeld' : 'release.explain'}
            values={{ delivery: deliveryNumber, store: heldBy }}
            components={{ d: <Ltr />, s: <Ltr /> }}
          />
        </p>
        <fieldset className="flex flex-col gap-1.5 text-sm">
          <legend className="mb-1 text-xs font-medium">{t('release.reason')}</legend>
          {RELEASE_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input
                type="radio"
                name="release-reason"
                value={r}
                checked={reason === r}
                disabled={busy}
                onChange={() => {
                  setReason(r)
                  edit()
                }}
                data-release-reason={r}
              />
              {t(`reasons.${r}`)}
            </label>
          ))}
        </fieldset>
        <Field label={reason === 'Other' ? t('release.noteRequired') : t('release.noteOptional')}>
          <Textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              edit()
            }}
            rows={3}
            dir="auto"
            disabled={busy}
            aria-invalid={form.problem === 'noteMissing' && reason === 'Other' ? true : undefined}
            className="w-full"
            data-release-note=""
          />
        </Field>
        {!release.isError && form.problem && (
          <p className="text-xs text-muted-foreground" data-release-blocked={form.problem}>
            {t(`release.blocked.${form.problem}`)}
          </p>
        )}
        {refusal && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-danger-800" data-release-refusal={refusal.code}>
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {t(refusal.key)}
              <span className="ms-1.5 font-mono">
                <Ltr>{refusal.code}</Ltr>
              </span>
            </span>
          </p>
        )}
        {release.isError && !refusal && (
          <ErrorBanner className="p-2" title={t('release.failed')} message={apiErrorMessage(release.error, t('release.failedHint'))}>
            {code && (
              <span className="font-mono text-xs" data-release-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
