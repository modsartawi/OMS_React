import { useEffect, useRef, type ReactNode } from 'react'

/**
 * The app's modal, built on the native `<dialog>` element.
 *
 * The skeleton ships no component library (no radix/shadcn primitives were
 * installed — 405), and `showModal()` already provides, natively and correctly,
 * the things a hand-rolled modal gets wrong: a real top-layer stacking context
 * (no z-index war), focus trapped inside, focus restored to the trigger on
 * close, `aria-modal` semantics, inert content behind, and Escape-to-dismiss.
 *
 * The Angular prototype's dialogs are `[modal] [draggable]=false
 * [resizable]=false [dismissableMask]=true`; this reproduces that contract —
 * including backdrop-click to dismiss, which the native element does NOT give
 * for free (see `onClick`).
 */
export interface ModalProps {
  open: boolean
  /** Called for every dismissal path: Cancel, Escape, backdrop click. */
  onClose: () => void
  title: string
  /** Fires after the dialog is shown — the "load fresh data on open" hook. */
  onShow?: () => void
  /** Dialog width, e.g. `30rem`. Capped at the viewport on small screens. */
  width?: string
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({
  open,
  onClose,
  title,
  onShow,
  width = '30rem',
  children,
  footer,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Kept in a ref so re-rendering with a new closure never re-fires the effect —
  // `onShow` must run once per OPEN, not once per render.
  const onShowRef = useRef(onShow)
  onShowRef.current = onShow

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      onShowRef.current?.()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      // `cancel` is Escape. Prevent the default close so React state stays the
      // single source of truth for `open` — otherwise the element closes itself
      // and props say it is still open, and it can never be reopened.
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // The backdrop is not a child element, so a backdrop click reports the
      // DIALOG as its target. A click on any content bubbles up from a child,
      // so target !== dialog. That difference is the whole dismissable-mask test.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto max-h-[90vh] w-[92vw] rounded-md border border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/50"
      style={{ maxWidth: width }}
    >
      <div className="flex max-h-[90vh] flex-col">
        <h2
          id="modal-title"
          className="shrink-0 border-b border-border bg-muted/60 px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </h2>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-3 py-2">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
