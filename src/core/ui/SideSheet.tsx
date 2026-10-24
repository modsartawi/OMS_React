import { useEffect, useRef, type DialogHTMLAttributes, type ReactNode } from 'react'
import { SHEET } from './overlay'

/**
 * **The house side sheet** — a native `<dialog>` docked to the inline end on the overlay recipe's
 * `SHEET`, over the `--backdrop` scrim, with the top layer, focus trap, focus given back and
 * Escape the platform gives a modal dialog. React state stays the one source of truth for open:
 * the sheet opens when it mounts and asks its owner to close (`onClose`) on Escape, on a backdrop
 * click or when the dialog is closed from outside.
 *
 * Graduated by ticket 556 from the frame the Deliverect orders drawers copied
 * (`admin/sync-console`'s `SnapshotDrawer` first), when the HungerStation orders monitor became a
 * third reader. Escape belongs to the TOP dialog only, so a sheet stacked over another sheet (the
 * raw view over an order) closes alone.
 *
 * `width` is the sheet's width utility (`w-[60rem]`); every other attribute (`aria-labelledby`,
 * `data-*`) lands on the dialog.
 */
export default function SideSheet({
  onClose,
  width,
  children,
  ...rest
}: { onClose: () => void; width: string; children: ReactNode } & Omit<
  DialogHTMLAttributes<HTMLDialogElement>,
  'onClose' | 'onCancel' | 'onClick' | 'className' | 'open' | 'children'
>) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      {...rest}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        // As core's Modal: Escape belongs to the top dialog, never to one that holds it too.
        e.stopPropagation()
        if (e.target === ref.current) onClose()
      }}
      onClose={() => {
        if (ref.current && !ref.current.open) onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={`end-0 my-0 me-0 ms-auto h-dvh max-h-dvh ${width} max-w-[96vw] border-0 border-s p-0 ${SHEET}`}
    >
      <div className="flex h-full flex-col">{children}</div>
    </dialog>
  )
}
