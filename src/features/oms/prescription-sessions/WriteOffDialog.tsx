import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import {
  PRESCRIPTION_SESSION_NS,
  PRESCRIPTION_WRITE_OFF_REASONS,
  wordText,
  writeOffReasonWord,
} from '@/core/prescription-session/words'
import { fsi } from '@/core/util/bidi'
import { prescriptionSessionsApi } from './api'
import type { OpenGridRow } from './open-row'
import { writeOffBlock, writeOffBody, writeOffRefusal, type WriteOffForm } from './write-off'
import { useWriteOffGrant } from './write-off-grant'

/** `PrescriptionSessionWidths.EndNote`: the server clamps the note to this. */
const NOTE_MAX = 400

/**
 * "Close without invoice" (ticket 548; BackOffice spec 2994 story 72): a coded reason, a note
 * (required for Other), and a confirm that names the session and its holding store. Every refusal
 * shows here — the envelope message and its code, never a generic toast — and the dialog stays
 * open so the note is not lost. On success the Open list is re-read (the row leaves it, the flag
 * counts change) and a toast names the session.
 */
export default function WriteOffDialog({ row, onClose }: { row: OpenGridRow; onClose: () => void }) {
  const { t } = useTranslation('prescription-sessions')
  const { t: tw } = useTranslation(PRESCRIPTION_SESSION_NS)
  const queryClient = useQueryClient()
  const deny = useWriteOffGrant((s) => s.deny)
  const [form, setForm] = useState<WriteOffForm>({ reason: '', note: '' })

  const send = useMutation({
    mutationFn: () => prescriptionSessionsApi.writeOff(row.sessionId, writeOffBody(form)),
    onSuccess: () => {
      toast.success(t('writeOff.done', { session: fsi(row.displayId) }))
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['prescription-sessions', 'open'] })
    },
    onError: (err) => {
      if (writeOffRefusal(err).kind === 'notGranted') deny()
    },
  })

  const refusal = send.isError ? writeOffRefusal(send.error) : null
  const block = writeOffBlock(form)
  const busy = send.isPending
  const ready = block === null && !busy && refusal?.kind !== 'notGranted'

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t('writeOff.title')}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-ps-write-off-cancel="">
            {t('writeOff.cancel')}
          </Button>
          <Button variant="danger" disabled={!ready} onClick={() => ready && send.mutate()} data-ps-write-off-confirm="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('writeOff.sending') : t('writeOff.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-ps-write-off-dialog={row.sessionId}>
        <p className="text-sm" data-ps-write-off-names="">
          <Trans
            t={t}
            i18nKey="writeOff.names"
            values={{ session: row.displayId, store: row.holdingStore }}
            components={{ v: <Ltr /> }}
          />
        </p>

        <fieldset className="flex flex-col gap-1.5" disabled={busy}>
          <legend className="mb-1 text-xs font-medium">{t('writeOff.reason')}</legend>
          {PRESCRIPTION_WRITE_OFF_REASONS.map((code) => (
            <label key={code} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={`ps-write-off-reason-${row.sessionId}`}
                value={code}
                checked={form.reason === code}
                onChange={() => setForm((f) => ({ ...f, reason: code }))}
                className="mt-1"
                data-ps-write-off-reason={code}
              />
              <span className="flex flex-col">
                {wordText(tw, writeOffReasonWord(code))}
                {code === 'GOODS_NEVER_LEFT' && (
                  <span className="text-xs text-muted-foreground" data-ps-write-off-put-back="">
                    {t('writeOff.putBackHint')}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1 text-xs font-medium">
          {form.reason === 'OTHER' ? t('writeOff.noteRequired') : t('writeOff.noteOptional')}
          <textarea
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            rows={3}
            dir="auto"
            maxLength={NOTE_MAX}
            required={form.reason === 'OTHER'}
            disabled={busy}
            aria-describedby="ps-write-off-note-hint"
            className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
            data-ps-write-off-note=""
          />
          {block === 'noteRequired' && (
            <span id="ps-write-off-note-hint" className="font-normal text-muted-foreground" data-ps-write-off-note-hint="">
              {t('writeOff.noteHint')}
            </span>
          )}
        </label>

        {refusal?.kind === 'notGranted' && (
          <ErrorBanner className="p-2" title={t('writeOff.notGrantedTitle')} message={t('writeOff.notGranted')}>
            <span data-ps-write-off-refusal="notGranted" />
          </ErrorBanner>
        )}
        {refusal?.kind === 'refused' && (
          <ErrorBanner className="p-2" title={t('writeOff.refusedTitle')} message={refusal.message || t('writeOff.failed')}>
            {refusal.labelKey && (
              <span className="me-2 text-xs" data-ps-write-off-refusal-label="">
                {t(refusal.labelKey)}
              </span>
            )}
            <span className="font-mono text-xs" data-ps-write-off-refusal={refusal.code}>
              <Ltr>{refusal.code}</Ltr>
            </span>
          </ErrorBanner>
        )}
        {refusal?.kind === 'failed' && (
          <ErrorBanner className="p-2" title={t('writeOff.refusedTitle')} message={t('writeOff.failed')}>
            <span data-ps-write-off-refusal="failed" />
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
