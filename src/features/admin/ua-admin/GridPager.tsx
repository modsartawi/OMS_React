import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageCountFromTotalMatches, pagerButtonEnablement } from './pager'

interface Props {
  page: number
  totalMatches: number
  /** The envelope's "more rows exist beyond this page" flag — it enables Next. */
  isCapped: boolean
  /** True while the next page is in flight; both buttons go inert. */
  busy: boolean
  onPage: (page: number) => void
}

/**
 * The grid footer (ticket 148). Previous / Next plus a "Page N of M" readout —
 * no numbered pages, because *All people* is 120 of them and nobody navigates to
 * page 87 on purpose. The caller decides whether to render this at all
 * (`showsPager`); a one-page result grows no controls.
 */
export default function GridPager({ page, totalMatches, isCapped, busy, onPage }: Props) {
  const { t } = useTranslation('ua-admin')
  const pages = pageCountFromTotalMatches(totalMatches)
  const { previous, next } = pagerButtonEnablement({ page, isCapped })

  const btn =
    'inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-medium ' +
    'transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

  return (
    <nav
      aria-label={t('pager.ariaLabel')}
      className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-1.5"
    >
      <button className={btn} disabled={!previous || busy} onClick={() => onPage(page - 1)}>
        {/* Chevrons are logical: rtl:rotate-180 mirrors them with the text direction. */}
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        {t('pager.previous')}
      </button>
      <span className="tabular-nums text-xs text-muted-foreground">
        {t('pager.readout', { page, pages: pages.toLocaleString() })}
      </span>
      <button className={btn} disabled={!next || busy} onClick={() => onPage(page + 1)}>
        {t('pager.next')}
        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
      </button>
    </nav>
  )
}
