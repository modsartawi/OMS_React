import { useState } from 'react'
import type { TFunction } from 'i18next'
import { Check, Copy } from 'lucide-react'

import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import type { InvoiceCandidate } from '@/core/models/retail-invoice'
import { enumLabel } from './invoice-columns'
import { canRetry, type DownloadOutcome } from './download-outcome'

/**
 * The two things a download can say before or instead of a file (ticket 265).
 *
 * Both are thin renderers over decisions taken elsewhere — `needsDownloadConfirm`
 * in `invoice-columns.ts` and `downloadOutcome` in `download-outcome.ts` — which
 * is the split the ticket asks for: **all of the logic is unit-tested without a
 * DOM**, and React Testing Library is still not installed.
 */

/**
 * The confirm step — 🚩 **the one place the client may act on renderability at
 * all.**
 *
 * The search returns rows that cannot be rendered, unfiltered and unflagged, and
 * that is an owner ruling (988) rather than a gap: `RetailTrx` also holds cash
 * clearances (`trxTypeCode: 700`), training receipts and suspended (parked)
 * sales. Downloading one is a `422 RENDER_FAILED` the user could not have
 * predicted, so this dialog **names what the row actually is** and lets them
 * decide.
 *
 * ⚠️ It does not prevent anything. The action stays enabled, the row stays in the
 * list, and no `renderable` flag is derived — a server flag is only on the table
 * if the confirm fails in practice. And it never fires on `Sales`/`Return`: a
 * confirm on the normal path would train people to click through it.
 */
export function DownloadConfirmDialog({
  row,
  t,
  onCancel,
  onConfirm,
}: {
  row: InvoiceCandidate | null
  t: TFunction
  onCancel: () => void
  onConfirm: () => void
}) {
  const unknown = t('invoice.download.confirm.unknownValue')

  return (
    <Modal
      open={row !== null}
      onClose={onCancel}
      title={t('invoice.download.confirm.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onCancel}>
            {t('invoice.download.confirm.cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('invoice.download.confirm.submit')}
          </Button>
        </>
      }
    >
      {row && (
        <div className="flex flex-col gap-2 text-[0.8125rem]">
          <p>
            {/* The enum names prettify through the SAME lookup the grid uses, so
                an unknown value reads here exactly as it reads on the row —
                itself, never a blank.
                ⚠️ A genuinely EMPTY value is one of the cases that got us here:
                `needsDownloadConfirm` confirms on a blank type or status, and
                `enumLabel` answers `''` for one. Naming the gap is the point of
                the sentence, so it says so rather than leaving a hole in it. */}
            {t('invoice.download.confirm.body', {
              trxType: enumLabel(t, 'trxType', row.trxType) || unknown,
              trxStatus: enumLabel(t, 'trxStatus', row.trxStatus) || unknown,
              trxNumber: row.trxNumber,
            })}
          </p>
          <p className="text-muted-foreground">{t('invoice.download.confirm.hint')}</p>
        </div>
      )}
    </Modal>
  )
}

/**
 * The failure dialog — one sentence from contract §4's table, the retry button
 * that row of the table earns, and the `attemptId` when the server journalled
 * one.
 *
 * 🔑 **503 and 504 arrive here as different sentences with different
 * retry-ability**, which is the whole reason `download-outcome.ts` exists: this
 * component never decides, it only draws what it was handed.
 */
export function DownloadFailureDialog({
  outcome,
  attemptId,
  attempts,
  t,
  onClose,
  onRetry,
}: {
  outcome: DownloadOutcome | null
  /** The envelope's `attemptId`, read with 262's `apiErrorAttemptId`. */
  attemptId: string | null
  /** Attempts made so far for this row, the first included. */
  attempts: number
  t: TFunction
  onClose: () => void
  onRetry: () => void
}) {
  const retry = outcome !== null && canRetry(outcome, attempts)

  return (
    <Modal
      open={outcome !== null}
      onClose={onClose}
      title={t('invoice.download.failure.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('invoice.download.failure.close')}
          </Button>
          {/* ⚠️ A BUTTON, and never a loop. SIS.Api has already retried the
              internal call twice (250 ms, then 1 s) on connect-refused/503 only,
              so three attempts have failed by the time a 503 is drawn here; an
              automatic client retry would triple a recycling host's load at the
              worst moment. A user pressing this is a different thing. */}
          {retry && (
            <Button variant="primary" onClick={onRetry}>
              {t('invoice.download.failure.retry')}
            </Button>
          )}
        </>
      }
    >
      {outcome && (
        <div className="flex flex-col gap-3">
          <ErrorBanner message={t(outcome.messageKey)} className="p-3" />
          {attemptId && <AttemptReference attemptId={attemptId} outcome={outcome} t={t} />}
        </div>
      )}
    </Modal>
  )
}

/**
 * The support handle, and it is **copyable** because copying it is the only thing
 * anyone does with it.
 *
 * `attemptId` is the row id in the HQ `ReportRenderAttempt` log — one row per
 * attempt, written before the render starts, carrying the key, `requestedBy`,
 * duration and outcome. **There is no separate audit; that table is it**, so this
 * string is the only handle a user can quote in a support conversation.
 *
 * 🚩 The id renders whenever the envelope carried one, but the *"quote this"*
 * line is gated on `expectsAttemptId` — true on 422/504 only, the arms where a
 * render was actually attempted and journalled. An id arriving on an arm where
 * nothing was attempted would point at no row, and telling someone to quote it
 * would send them to support with a reference support cannot look up.
 */
function AttemptReference({
  attemptId,
  outcome,
  t,
}: {
  attemptId: string
  outcome: DownloadOutcome
  t: TFunction
}) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    // `?.` — a non-secure context (plain http on a test box) has no clipboard at
    // all, and the id is still selectable text on the page, so a failure to copy
    // is not a failure to communicate.
    void navigator.clipboard?.writeText(attemptId).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-3">
      <div className="text-xs font-medium text-muted-foreground">
        {t('invoice.download.failure.attemptId')}
      </div>
      <div className="flex items-center gap-2">
        <code data-testid="attempt-id" className="font-mono text-xs text-foreground">
          {attemptId}
        </code>
        <Button variant="outlined" onClick={copy}>
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? t('invoice.download.failure.copied') : t('invoice.download.failure.copy')}
        </Button>
      </div>
      {outcome.expectsAttemptId && (
        <p className="text-xs text-muted-foreground">{t('invoice.download.failure.quote')}</p>
      )}
    </div>
  )
}
