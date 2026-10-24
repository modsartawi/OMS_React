import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button, { type ButtonVariant } from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { controlRefusalWords } from './control-helpers'

/**
 * The Data sync screen's ONE confirm dialog (ticket 563), on the app modal — never `confirm()`.
 * 563's Pause / Resume / Cancel open it; 564 and 565 reuse it (`refusalWords` for their own codes,
 * `children` for their own fields).
 *
 * It names what it acts on (`actsOn`), says what the action does (`note`), takes an optional note
 * when `takesNote` (sent as typed; the caller trims via `controlBody`), and shows a refusal INSIDE
 * the dialog — the door's message, the screen's own sentence for the code, and the code — so the
 * note is not lost and the technician reads why.
 *
 * 🚩 Portalled to `<body>`: it opens from an AG Grid cell (a job row) and from the job drawer, and
 * the grid's own keyboard handling must never see the note's keystrokes. The native top layer
 * still stacks it above the drawer.
 */
export default function ControlDialog({
  title,
  actsOn,
  note,
  takesNote,
  confirmLabel,
  confirmVariant = 'primary',
  busy,
  error,
  refusalWords = controlRefusalWords,
  onConfirm,
  onClose,
  children,
}: {
  title: string
  /** What the action reaches, drawn under the title (ids and stores isolated by the caller). */
  actsOn: ReactNode
  /** What the action does, in a sentence. */
  note?: string
  /** Whether to offer the optional note field. */
  takesNote: boolean
  confirmLabel: string
  confirmVariant?: ButtonVariant
  busy: boolean
  /** The last failed send, if any. */
  error: unknown
  /** A refusal code → a `data-sync` key, or `null` to show the code alone. */
  refusalWords?: (code: string | null) => string | null
  /** The note as typed. */
  onConfirm: (note: string) => void
  onClose: () => void
  children?: ReactNode
}) {
  const { t } = useTranslation('data-sync')
  const [text, setText] = useState('')
  const code = error ? apiErrorCode(error) : null
  const wordsKey = error ? refusalWords(code) : null

  return createPortal(
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={title}
      width="34rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-control-close="">
            {t('controls.close')}
          </Button>
          <Button variant={confirmVariant} disabled={busy} onClick={() => !busy && onConfirm(text)} data-control-confirm="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('controls.sending') : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-control-dialog="">
        <div className="flex flex-col gap-1 text-xs" data-control-acts-on="">
          {actsOn}
        </div>
        {note && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-control-note-text="">
            {note}
          </p>
        )}
        {children}
        {takesNote && (
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t('controls.reason')}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
              disabled={busy}
              className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
              data-control-note=""
            />
          </label>
        )}
        {error != null && (
          <ErrorBanner className="p-2" title={t('controls.failed')} message={apiErrorMessage(error, t('controls.failedHint'))}>
            {wordsKey && (
              <span className="me-2 text-xs" data-control-refusal="">
                {t(wordsKey)}
              </span>
            )}
            {code && (
              <span className="font-mono text-xs" data-control-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>,
    document.body,
  )
}
