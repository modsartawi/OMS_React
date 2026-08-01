import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pagerEnablement } from './list-window'

/**
 * Previous / Next plus a "Page N of M" readout — the footer both Nphies lists
 * carry (tickets 212 + 214).
 *
 * It lives in `core/` beside the arithmetic it renders: the two lists page the
 * same envelope with the same rules, and a feature may never import another
 * feature (`.claude/rules/feature-structure.md`). One copy is also what keeps the
 * two footers from disagreeing about which of the buttons is live.
 *
 * No numbered pages, because nobody navigates to page 87 on purpose. Unlike the
 * Ua Users footer there is no `isCapped` flag to interpret: both envelopes carry
 * the true `total`, so the last page is arithmetic (`pagerEnablement`).
 *
 * It takes the already-resolved `page` and `pages` rather than a total, so that
 * both come from the same read — the server's echoed page number, and a count
 * computed with the size the server actually served.
 *
 * **Labels are props, not `t()` calls.** This component adds no i18n namespace of
 * its own; each list passes its own namespace's strings, which keeps zero-literal
 * a caller concern exactly as `StatusBadge` does with its child.
 */
export interface ListPagerLabels {
  ariaLabel: string
  previous: string
  next: string
  /** Already interpolated by the caller — "Page 2 of 7". */
  readout: string
}

export default function ListPager({
  page,
  pages,
  busy,
  labels,
  onPage,
}: {
  page: number
  pages: number
  busy: boolean
  labels: ListPagerLabels
  onPage: (page: number) => void
}) {
  const { previous, next } = pagerEnablement({ page, pages })

  const btn =
    'inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-medium ' +
    'transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <nav
      aria-label={labels.ariaLabel}
      className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-1.5"
    >
      <button className={btn} disabled={!previous || busy} onClick={() => onPage(page - 1)}>
        {/* Chevrons are logical: rtl:rotate-180 mirrors them with the text direction. */}
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
        {labels.previous}
      </button>
      <span className="tabular-nums text-xs text-muted-foreground">{labels.readout}</span>
      <button className={btn} disabled={!next || busy} onClick={() => onPage(page + 1)}>
        {labels.next}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      </button>
    </nav>
  )
}
