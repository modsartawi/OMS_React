import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { SHEET } from '@/core/ui/overlay'

/**
 * The scorecard's side sheet — the house pattern (`sync-console`'s `SnapshotDrawer`; a feature never
 * imports another): a native `<dialog>` docked to the inline end over the `--backdrop` scrim, with its
 * top layer, focus trap, focus given back and Escape. React state stays the one source of truth for open.
 * A second sheet opened from the first (a card measure's drill) stacks above it in the top layer.
 */
export default function Sheet({
  eyebrow,
  title,
  actions,
  width = 'w-[60rem]',
  onClose,
  children,
  ...data
}: {
  eyebrow: ReactNode
  title: ReactNode
  actions?: ReactNode
  width?: string
  onClose: () => void
  children: ReactNode
} & Record<`data-${string}`, string>) {
  const { t } = useTranslation('dispatch-scorecard')
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      {...data}
      onCancel={(e) => {
        e.preventDefault()
        // As core's Modal: Escape belongs to the top dialog, never to one that holds it too.
        e.stopPropagation()
        if (e.target === ref.current) onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={`end-0 my-0 me-0 ms-auto h-dvh max-h-dvh ${width} max-w-[96vw] border-0 border-s p-0 ${SHEET}`}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{eyebrow}</span>
            <h2 id={titleId} className="text-sm font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('sheet.close')}
              title={t('sheet.close')}
              data-sc-close=""
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  )
}
