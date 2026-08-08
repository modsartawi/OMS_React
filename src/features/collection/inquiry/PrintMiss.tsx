import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FileX2, Loader2, Unplug } from 'lucide-react'

/**
 * The three things a print route renders when it is NOT rendering a document —
 * one per non-`ready` outcome in `print-outcome.ts`.
 *
 * ⚠ This is CHROME, not a facsimile: it holds none of the documents' three-rule
 * exception. Every string goes through `t()`, the utilities are logical and the
 * colours are tokens, exactly like any other screen.
 *
 * 🚩 **All three exist for one reason: never a blank A4 sheet.** A blank sheet
 * prints as convincingly as a real one (spec 249, story 91), so every state a
 * print route can be in has to put a sentence on the page — including the
 * fetching one, which at 251 could not happen because the document was checked
 * in and at 259 lasts as long as the server takes.
 */

/** The shared frame: centred, narrow, one icon over a title and a sentence. */
function Notice({
  icon,
  title,
  hint,
  role,
}: {
  icon: ReactNode
  title: string
  /** Omitted by the pending state, which has a title and nothing to add to it —
   *  an empty paragraph is a gap a reader reads as a missing sentence. */
  hint?: string
  role: 'alert' | 'status'
}) {
  return (
    <div className="mx-auto mt-16 max-w-md p-6 text-center" role={role}>
      {icon}
      <div className="text-base font-semibold tracking-tight">{title}</div>
      {hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/**
 * The id did not resolve — the document is GONE, and we know that.
 *
 * Shared by the receipt and the ACR because the two misses are the same fact told
 * to the same reader: 245 §7 gives them different envelope codes
 * (`CollectionReceiptNotFound`, `AcrNotFound`) but deliberately the same sentence.
 */
export default function PrintMiss() {
  const { t } = useTranslation('collection')
  return (
    <Notice
      role="alert"
      icon={<FileX2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />}
      title={t('document.missingTitle')}
      hint={t('document.missingHint')}
    />
  )
}

/**
 * The document is on its way.
 *
 * ⚠ Not a shimmer of the sheet. A grey A4-shaped placeholder is precisely the
 * blank-sheet failure with a texture on it — and this route can be printed from
 * `Ctrl+P` the instant it opens, before the fetch settles. It says a sentence.
 */
export function PrintPending() {
  const { t } = useTranslation('collection')
  return (
    <Notice
      role="status"
      icon={
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
      }
      title={t('document.loading')}
    />
  )
}

/**
 * The fetch failed for a reason that is NOT "the document is gone" — a 403 from a
 * missing cookie marker, a 500, an unreachable SIS.Api.
 *
 * 🚩 **This is the state whose absence would be a lie.** Folding it into
 * `PrintMiss` would tell a user their receipt no longer exists because a server
 * was briefly down, and send them looking for a reversal that never happened.
 *
 * `message` is the server's own sentence, taken through `apiErrorMessage` by the
 * caller and rendered here as DATA — server-supplied text needs no key
 * (`i18n-zero-literal`), but the labels around it do.
 */
export function PrintFailure({ message }: { message: string }) {
  const { t } = useTranslation('collection')
  return (
    <div className="mx-auto mt-16 max-w-md p-6 text-center" role="alert">
      <Unplug className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('document.failedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t('document.failedHint')}</p>
    </div>
  )
}
