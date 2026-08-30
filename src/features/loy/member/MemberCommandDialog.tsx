import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import Button from '@/core/ui/Button'
import type { ButtonVariant } from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'

/**
 * The confirmation shell every **member command** on this tab wears (spec 301).
 *
 * 🚩 **Extracted here rather than copied a fourth time.** Ticket 303 wrote the
 * shell, 304 and 305 copied it verbatim, and 305's review recorded the call:
 * *defensible at two, Shotgun Surgery at 306/307 — the extraction is the first
 * thing to weigh in 306*. This is that extraction. What was being copied is not
 * decoration: it is four **rules** that must hold identically on every command,
 * and four copies of a rule is four places for one of them to quietly stop
 * holding.
 *
 * The four:
 *
 * 1. 🚩 **A dialog over a write in flight cannot be dismissed** — not by the
 *    footer, not by Escape, not by the backdrop. There is no server-side
 *    idempotency anywhere in the module, so a dialog that closed mid-write would
 *    let the control be reopened and pressed again, and that second press is a
 *    second **member update snapshot** and a second trail row.
 * 2. 🚩 **The confirm is disarmed with `aria-disabled`, never `disabled`.** A
 *    command that is unavailable *for a reason* has to stay focusable to be able
 *    to state it (`core/ui/Button` carries the same rule) — and the guard is the
 *    `onClick` early return, not the attribute, so a forced click writes nothing
 *    either.
 * 3. **The spinner rides the confirm**, so the thing the analyst pressed is the
 *    thing that says it is working.
 * 4. 🚩 **A refusal is drawn HERE, at the bottom of the body** — inside the
 *    confirmation, beside whatever caused it, with nothing cleared and nothing
 *    closed (ticket 220's rule). A toast would take the explanation away from the
 *    thing that has to be corrected.
 *
 * What each command keeps for itself is what actually differs: its body, its
 * words, and what makes it confirmable. Those are decisions; this is the shape
 * they are drawn in.
 */
export default function MemberCommandDialog({
  title,
  width = '30rem',
  busy,
  cannotConfirm,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'primary',
  confirmTestId,
  /** The refusal to draw, already worded by `commandRefusalText`, or null. */
  error,
  onClose,
  onConfirm,
  children,
}: {
  title: string
  width?: string
  busy: boolean
  cannotConfirm: boolean
  confirmLabel: string
  cancelLabel: string
  confirmVariant?: ButtonVariant
  confirmTestId: string
  error?: string | null
  onClose: () => void
  onConfirm: () => void
  children: ReactNode
}) {
  return (
    <Modal
      open
      // 🚩 Rule 1. Escape and the backdrop both arrive here.
      onClose={() => !busy && onClose()}
      title={title}
      width={width}
      footer={
        <>
          <Button
            variant="text"
            onClick={() => !busy && onClose()}
            aria-disabled={busy || undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            data-testid={confirmTestId}
            // 🚩 Rules 2 and 3: focusable while disarmed, and the guard is the
            // early return below rather than the attribute.
            aria-disabled={cannotConfirm || undefined}
            onClick={() => !cannotConfirm && onConfirm()}
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {children}
        {/* 🚩 Rule 4. Last in the body, so it appears under the thing it is
            about rather than above it. */}
        {error && <ErrorBanner message={error} className="p-2.5" />}
      </div>
    </Modal>
  )
}
