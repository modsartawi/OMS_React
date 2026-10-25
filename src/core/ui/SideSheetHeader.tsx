import type { ReactNode } from 'react'
import { X } from 'lucide-react'

/** `data-*` hooks a caller hangs on a part of the header (drives find it by them). */
type DataAttrs = Record<`data-${string}`, string>

/**
 * **A side sheet's header** (ticket 554) — the eyebrow, the title (the sheet's label: pass the
 * same `titleId` as the sheet's `aria-labelledby`), an optional hint and the close button, as every
 * drawer on core's `SideSheet` draws it. The body below it takes `SHEET_BODY` (`./sheet-table`).
 * A drawer with more in its header (the raw views' copy and format buttons) draws its own.
 */
export default function SideSheetHeader({
  titleId,
  eyebrow,
  title,
  hint,
  closeLabel,
  onClose,
  titleData,
  closeData,
}: {
  titleId: string
  eyebrow: ReactNode
  /** The caller isolates its data values. */
  title: ReactNode
  hint?: ReactNode
  /** The close button's accessible name and title (a `t()` string). */
  closeLabel: string
  onClose: () => void
  titleData?: DataAttrs
  closeData?: DataAttrs
}) {
  return (
    <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{eyebrow}</span>
        <h2 id={titleId} className="text-sm font-semibold tracking-tight" {...titleData}>
          {title}
        </h2>
        {hint != null && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        {...closeData}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </header>
  )
}
