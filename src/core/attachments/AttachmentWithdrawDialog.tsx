import { useEffect, useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { StoredAttachment } from '@/core/models/attachment'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import { attachmentsApi } from './api'
import AttachmentSourceText from './AttachmentSourceText'
import type { AttachmentsPanelWords } from './panel-words'
import { attachmentSource, wallClockText } from './rules'
import {
  WITHDRAW_NOTE_MAX,
  canConfirmWithdraw,
  needsWithdrawNote,
  withdrawAnswer,
  withdrawBody,
  withdrawCanResend,
  withdrawClosesDialog,
  type WithdrawAnswer,
  type WithdrawBody,
  type WithdrawClosingAnswer,
  type WithdrawReason,
} from './withdraw'

/**
 * **Withdraw a file** (spec 319's ticket 323, BackOffice 2035; lifted into the shared
 * panel by ticket 326): the confirm dialog, opened over the panel for one stored
 * file. It names the file, says the withdrawal is final, and asks for a reason from
 * the caller's list (and a note, where the reason needs one).
 *
 * The reasons are data, shown in the order given: the slip drawer's five bundle
 * labels, or (331) the server's `withdrawReasons`, `label` beside `labelArabic`.
 *
 * An answer that leaves nothing to do here (a 200, a 404, a bare 403) goes to
 * `onSettled` and the panel acts on it. The rest stay in the dialog with the
 * user's input kept: a 400 or a failure shows the server's words, and a 503
 * `NOT_SET_UP` shows them with no way to press again.
 *
 * 🚩 **One press, one request.** Confirm is disabled while the request is in
 * flight, and the press is held by a ref as well, which a double-click cannot slip
 * past the way it slips past a re-render. The dialog cannot be dismissed while it
 * waits either. A repeat would be harmless anyway (a withdrawn file answers 200
 * unchanged), but its answer would land twice.
 */
export default function AttachmentWithdrawDialog({
  file,
  reasons,
  words,
  onClose,
  onSettled,
}: {
  file: StoredAttachment
  reasons: readonly WithdrawReason[]
  words: Pick<
    AttachmentsPanelWords,
    'sourceColumn' | 'withdrawTitle' | 'withdrawFinal' | 'withdrawNoteRequired' | 'withdrawConfirm' | 'withdrawFailed'
  >
  onClose: () => void
  /** A closing answer, and the error it came with (`null` for a 200). */
  onSettled: (answer: WithdrawClosingAnswer, error: unknown) => void
}) {
  const { t } = useTranslation('attachments')
  const noteId = useId()
  const [reasonCode, setReasonCode] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [refusal, setRefusal] = useState<{ answer: WithdrawAnswer; error: unknown } | null>(null)
  const inFlight = useRef(false)

  const withdraw = useMutation({
    mutationFn: (body: WithdrawBody) => attachmentsApi.withdraw(file.attachmentId, body),
    onSettled: (_data, error) => {
      inFlight.current = false
      const answer = withdrawAnswer(error)
      if (withdrawClosesDialog(answer)) onSettled(answer, error)
      else setRefusal({ answer, error })
    },
  })

  const pending = withdraw.isPending
  const blocked = refusal !== null && !withdrawCanResend(refusal.answer)
  const ready = canConfirmWithdraw(reasons, reasonCode, note) && !pending && !blocked
  const confirm = () => {
    if (!ready || reasonCode === null || inFlight.current) return
    inFlight.current = true
    setRefusal(null)
    withdraw.mutate(withdrawBody(reasonCode, note))
  }
  const dismiss = () => {
    if (!pending) onClose()
  }

  // The browser may still close a modal dialog on a repeated Escape, however the
  // cancel is refused (the drawer's frame guards against the same thing). Modal only
  // hears the cancel, so the native close is caught here: while the request is in
  // flight the dialog is shown again, and otherwise React state is told it closed.
  const content = useRef<HTMLDivElement>(null)
  const latest = useRef({ pending, onClose })
  latest.current = { pending, onClose }
  useEffect(() => {
    const dialog = content.current?.closest('dialog')
    if (!dialog) return
    const onNativeClose = () => {
      if (dialog.open) return
      if (latest.current.pending) dialog.showModal()
      else latest.current.onClose()
    }
    dialog.addEventListener('close', onNativeClose)
    return () => dialog.removeEventListener('close', onNativeClose)
  }, [])

  const noteNeeded = needsWithdrawNote(reasons, reasonCode)

  return (
    <Modal
      open
      onClose={dismiss}
      title={words.withdrawTitle}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={dismiss} disabled={pending} data-testid="slip-withdraw-cancel">
            {t('withdraw.cancel')}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!ready} data-testid="slip-withdraw-confirm">
            {pending ? t('withdraw.sending') : words.withdrawConfirm}
          </Button>
        </>
      }
    >
      <div
        ref={content}
        className="flex flex-col gap-3 text-sm"
        data-region="slip-withdraw"
        data-withdraw-for={file.attachmentId}
      >
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs" data-testid="slip-withdraw-slip">
          <dt className="text-muted-foreground">{t('columns.fileName')}</dt>
          <dd className="break-all font-medium" dir="auto">
            {file.fileName}
          </dd>
          <dt className="text-muted-foreground">{words.sourceColumn}</dt>
          <dd>
            <AttachmentSourceText source={attachmentSource(file)} />
          </dd>
          <dt className="text-muted-foreground">{t('columns.storedAt')}</dt>
          <dd className="tabular-nums">{wallClockText(file.storedAt)}</dd>
        </dl>

        <p
          className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800"
          data-testid="slip-withdraw-final"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {words.withdrawFinal}
        </p>

        <fieldset className="flex flex-col gap-1.5" disabled={pending}>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">{t('withdraw.reason')}</legend>
          {reasons.map(({ code, label, labelArabic }) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="slip-withdraw-reason"
                value={code}
                checked={reasonCode === code}
                onChange={() => setReasonCode(code)}
                data-reason={code}
              />
              <span dir="auto">{label}</span>
              {labelArabic && (
                <span dir="auto" lang="ar">
                  {labelArabic}
                </span>
              )}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="text-xs font-medium text-muted-foreground">
            {t('withdraw.note')}
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={WITHDRAW_NOTE_MAX}
            disabled={pending}
            required={noteNeeded}
            dir="auto"
            rows={3}
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
            data-testid="slip-withdraw-note"
          />
          <span className="text-xs text-muted-foreground">
            {noteNeeded ? words.withdrawNoteRequired : t('withdraw.noteOptional')}{' '}
            {t('withdraw.noteLimit', { max: WITHDRAW_NOTE_MAX })}
          </span>
        </div>

        {refusal && (
          // The server's words as sent: English, then Arabic, on their own lines.
          <div className="whitespace-pre-line" data-testid="slip-withdraw-error" data-answer={refusal.answer}>
            <ErrorBanner message={apiErrorMessage(refusal.error, words.withdrawFailed)} className="p-3" />
          </div>
        )}
      </div>
    </Modal>
  )
}
