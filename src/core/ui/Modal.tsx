import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { DIALOG, DIALOG_TITLE } from './overlay'

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
 *
 * Its look is the overlay card recipe (`./overlay`, spec 380 F15): `--card`, a
 * `--border-strong` edge, 10px, `--shadow-pop`, over the `--backdrop` scrim.
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
  /**
   * `false` while work the dialog owns is in flight (a batch of writes, a run of lookups): Escape and
   * a backdrop click then do nothing, so the dialog cannot vanish under a running batch — a second
   * Escape the browser will not let be refused shows it again at once. The caller's own buttons
   * decide for themselves. Defaults to `true`.
   */
  dismissable?: boolean
  /**
   * The accessible name of a close (X) button drawn at the end of the title bar (a `t()` string). Absent: no button,
   * and the title bar is drawn exactly as before — a dialog closes by its own footer buttons and Escape. Given by a
   * dialog with no footer to close it by (the copilot's larger map, oms-react 884). The button calls `onClose`.
   */
  closeLabel?: string
}

export default function Modal({
  open,
  onClose,
  title,
  onShow,
  width = '30rem',
  children,
  footer,
  dismissable = true,
  closeLabel,
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

  // Read when the browser closes the dialog, not when the listener was added.
  const dismissableRef = useRef(dismissable)
  dismissableRef.current = dismissable

  // Chromium's close watcher lets a page refuse ONE Escape per click or key: a second Escape with nothing between fires
  // a `cancel` that cannot be prevented, and the browser closes the dialog itself while `open` still says shown. A
  // dialog that may not be dismissed now (work in flight) would vanish, its answer landing in a dialog nobody sees (spec
  // 4050 review 2), so it is shown again at once — not shown anew: `onShow` does not run. A dismissable dialog is left
  // alone: its `cancel` already told its owner (`onClose`), who closes it.
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const onNativeClose = () => {
      if (!dialog.open && dialog.isConnected && !dismissableRef.current) dialog.showModal()
    }
    dialog.addEventListener('close', onNativeClose)
    return () => dialog.removeEventListener('close', onNativeClose)
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      // `cancel` is Escape. Prevent the default close so React state stays the
      // single source of truth for `open` — otherwise the element closes itself
      // and props say it is still open, and it can never be reopened.
      // React bubbles `cancel` through the component tree, so a modal opened from inside another
      // (the grouping dialog's paste box) would close its parent too; Escape belongs to the top one.
      onCancel={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (dismissable) onClose()
      }}
      // The backdrop is not a child element, so a backdrop click reports the
      // DIALOG as its target. A click on any content bubbles up from a child,
      // so target !== dialog. That difference is the whole dismissable-mask test.
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose()
      }}
      className={'m-auto max-h-[90vh] w-[92vw] p-0 ' + DIALOG}
      style={{ maxWidth: width }}
    >
      <div className="flex max-h-[90vh] flex-col">
        {closeLabel ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <h2 id="modal-title" className={'min-w-0 ' + DIALOG_TITLE}>
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
              className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted"
              data-modal-close=""
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <h2
            id="modal-title"
            className={'shrink-0 border-b border-border/60 px-3 py-2.5 ' + DIALOG_TITLE}
          >
            {title}
          </h2>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-3 py-2">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
